import { callLLM, extractJSON } from "../llm.mjs";
import { buildDiarizePrompt } from "../prompts.mjs";

/**
 * 切分说话人
 */
export async function runDiarize({ resume, job, dialogue }) {
  const prompt = await buildDiarizePrompt({ resume, job, dialogue });
  const text = await callLLM(
    [
      {
        role: "system",
        content: "你只输出严格 JSON，不要解释，不要在 JSON 外面加任何文字。",
      },
      { role: "user", content: prompt },
    ],
    { json: true, maxTokens: 16000 }
  );
  const data = extractJSON(text);
  return data.turns || [];
}

/**
 * 把 turns 格式化成 Markdown（【面试官】xxx \n\n 【候选人】yyy）
 */
export function turnsToMarkdown({ turns, candidateName }) {
  const lines = [];
  lines.push(`# 面试对话切分`);
  lines.push("");
  if (candidateName) lines.push(`> **候选人**：${candidateName}`);
  lines.push(`> **对话段数**：${turns.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const turn of turns) {
    const speaker = turn.speaker === "面试官" ? "【面试官】" : "【候选人】";
    lines.push(`${speaker}${turn.text}`);
    lines.push("");
  }
  return lines.join("\n");
}
