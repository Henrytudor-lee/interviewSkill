import { callLLM, extractJSON } from "../llm.mjs";
import { buildQuestionsPrompt } from "../prompts.mjs";

/**
 * 生成面试题
 * options: { resume, job, count?, difficulty?, focus? }
 *   默认: count=11 (客观6+主观5), difficulty="中级", focus=""
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
        content: "你是面试出题助手。直接输出严格 JSON，不思考、不解释。",
      },
      { role: "user", content: prompt },
    ],
    { json: true, maxTokens: 8000, temperature: 0.5 }
  );
  const data = extractJSON(text);
  let questions = data.questions || [];
  const candidateLevel = data.candidateLevel || "";
  const levelReason = data.levelReason || "";

  // 按 count 截断
  if (questions.length > count) {
    const objective = questions.filter((q) => q.type === "客观");
    const subjective = questions.filter((q) => q.type === "主观");
    const objTarget = Math.min(6, objective.length);
    const subjTarget = Math.max(0, count - objTarget);
    questions = [...objective.slice(0, objTarget), ...subjective.slice(0, subjTarget)];
  }

  return { questions, difficulty, focus, candidateLevel, levelReason };
}

/**
 * 把 questions 格式化成 Markdown
 */
export function questionsToMarkdown({ questions, difficulty, focus, job, candidateName, candidateLevel, levelReason }) {
  const lines = [];
  lines.push(`# 面试题`);
  lines.push("");
  if (candidateName) lines.push(`> **候选人**：${candidateName}`);
  if (job?.title) lines.push(`> **应聘岗位**：${job.title}`);
  lines.push(`> **难度**：${difficulty}`);
  if (focus) lines.push(`> **重点技能**：${focus}`);
  lines.push(`> **题目数量**：${questions.length} 道`);
  if (candidateLevel) lines.push(`> **候选人画像**：${candidateLevel}${levelReason ? `（${levelReason}）` : ""}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  let objIdx = 0;
  let subjIdx = 0;
  questions.forEach((q, i) => {
    const answerLabel = q.type === "客观" ? "标准答案" : "评估要点";
    lines.push(`## ${i + 1}. [${q.type}] ${q.question}`);
    lines.push("");
    lines.push(`**${answerLabel}**：${q.answer}`);
    lines.push("");
    if (q.type === "客观") objIdx++;
    else subjIdx++;
  });

  lines.push("---");
  lines.push("");
  lines.push(`**题型分布**：客观 ${objIdx} 道 / 主观 ${subjIdx} 道`);
  return lines.join("\n");
}
