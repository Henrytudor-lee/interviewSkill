import { streamLLM } from "../llm.mjs";
import { buildReportPrompt } from "../prompts.mjs";

/**
 * 流式生成评估报告
 * 返回 AsyncGenerator<string>
 */
export async function* runEvaluate({
  resume,
  job,
  dialogue,
  candidateName,
  reportType = "comprehensive",
}) {
  const prompt = await buildReportPrompt({
    resume,
    job,
    dialogue,
    candidateName,
    reportType,
  });
  const stream = streamLLM(
    [
      {
        role: "system",
        content: "你是一位资深技术面试官，撰写真实、有针对性、有证据的评估报告。直接输出报告 Markdown。",
      },
      { role: "user", content: prompt },
    ],
    { maxTokens: 16000 }
  );
  for await (const chunk of stream) {
    yield chunk;
  }
}
