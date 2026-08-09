const API_URL = "https://api.minimaxi.com/v1/chat/completions";
const MODEL = "MiniMax-M3";

/**
 * 剥离 <think>...</think> 块（含跨行）
 */
export function stripThink(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/**
 * 从 markdown code block 中提取 JSON
 * - 处理 M3 即便设置了 json_object 也会用 ```json ... ``` 包裹的情况
 * - 如果 JSON 解析失败，抛出包含原始内容的详细错误
 */
export function extractJSON(text) {
  if (!text?.trim()) {
    throw new Error("无法解析：LLM 返回内容为空");
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : text.trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      try {
        return JSON.parse(candidate.slice(first, last + 1));
      } catch {
        // 继续往下走
      }
    }
    const preview = candidate.slice(0, 400);
    throw new Error(
      `无法解析 JSON（可能 LLM 输出被截断或不完整）。原文前 400 字符：\n${preview}`
    );
  }
}

function getApiKey() {
  const key = process.env.MINIMAX_API_KEY;
  if (!key) {
    throw new Error(
      "未配置 MINIMAX_API_KEY。请通过以下方式之一设置：\n" +
        "  1. 在 .env 文件中添加 MINIMAX_API_KEY=sk-...\n" +
        "  2. 设置环境变量 export MINIMAX_API_KEY=sk-...\n" +
        "  3. 调用时传 --api-key sk-..."
    );
  }
  return key;
}

/**
 * 非流式调用 LLM
 * opts: { json?: boolean, temperature?: number, maxTokens?: number }
 */
export async function callLLM(messages, opts = {}) {
  const apiKey = getApiKey();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4096,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM 调用失败 (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = stripThink(raw).trim();
  if (!cleaned) {
    throw new Error(
      "LLM 返回内容为空（可能安全过滤拦截或模型只输出了 think 块）。原始返回：" +
        (raw ? raw.slice(0, 300) : "(完全为空)")
    );
  }
  return cleaned;
}

/**
 * 流式调用 LLM，逐块 yield 清洗后的文本
 */
export async function* streamLLM(messages, opts = {}) {
  const apiKey = getApiKey();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4096,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`LLM 流式调用失败 (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inThink = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content ?? "";
        if (!delta) continue;

        let chunk = "";
        let i = 0;
        while (i < delta.length) {
          if (!inThink) {
            const startIdx = delta.indexOf("<think>", i);
            if (startIdx === -1) {
              chunk += delta.slice(i);
              break;
            }
            chunk += delta.slice(i, startIdx);
            inThink = true;
            i = startIdx + 7;
          } else {
            const endIdx = delta.indexOf("</think>", i);
            if (endIdx === -1) {
              i = delta.length;
              break;
            }
            inThink = false;
            i = endIdx + 8;
          }
        }
        if (chunk) yield chunk;
      } catch {
        // 忽略解析错误
      }
    }
  }
}
