import { callLLM, extractJSON } from "../llm.mjs";
import { buildQuestionsPrompt } from "../prompts.mjs";

/**
 * 生成面试题
 * options: { resume, job, count?, types?, difficulty?, focus? }
 *   默认: count=11 (客观6+主观5), types="客观,主观", difficulty="中级", focus=""
 */
export async function runQuestions({
  resume,
  job,
  count = 11,
  difficulty = "中级",
  focus = "",
}) {
  const prompt = await buildQuestionsPrompt({ resume, job, focus });
  const text = await callLLM(
    [
      {
        role: "system",
        content: "你只输出严格 JSON，不要解释，不要在 JSON 外面加任何文字。",
      },
      { role: "user", content: prompt },
    ],
    { json: true, maxTokens: 8000 }
  );
  const data = extractJSON(text);
  let questions = data.questions || [];

  // 按 count 截断
  if (questions.length > count) {
    const objective = questions.filter((q) => q.type === "客观");
    const subjective = questions.filter((q) => q.type === "主观");
    const objTarget = Math.min(6, objective.length);
    const subjTarget = Math.max(0, count - objTarget);
    questions = [...objective.slice(0, objTarget), ...subjective.slice(0, subjTarget)];
  }

  return { questions, difficulty, focus };
}

/**
 * 把 questions 格式化成 Markdown
 */
export function questionsToMarkdown({ questions, difficulty, focus, job, candidateName }) {
  const lines = [];
  lines.push(`# 面试题`);
  lines.push("");
  if (candidateName) lines.push(`> **候选人**：${candidateName}`);
  if (job?.title) lines.push(`> **应聘岗位**：${job.title}`);
  lines.push(`> **难度**：${difficulty}`);
  if (focus) lines.push(`> **重点技能**：${focus}`);
  lines.push(`> **题目数量**：${questions.length} 道`);
  lines.push("");
  lines.push("---");
  lines.push("");

  let objIdx = 0;
  let subjIdx = 0;
  questions.forEach((q, i) => {
    lines.push(`## ${i + 1}. [${q.type}] ${q.question}`);
    lines.push("");
    lines.push(`**参考要点**：${q.reference}`);
    lines.push("");
    if (q.type === "客观") objIdx++;
    else subjIdx++;
  });

  lines.push("---");
  lines.push("");
  lines.push(`**题型分布**：客观 ${objIdx} 道 / 主观 ${subjIdx} 道`);
  return lines.join("\n");
}
