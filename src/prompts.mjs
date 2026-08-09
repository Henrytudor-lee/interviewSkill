function truncateResume(text, max = 800) {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n\n[简历已截断，仅保留前 " + max + " 字用于出题定位关键技能]";
}

import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROMPTS_DIR = join(__dirname, "..", "prompts");

const cache = new Map();

async function loadPrompt(name) {
  if (!cache.has(name)) {
    const path = join(PROMPTS_DIR, `${name}.txt`);
    cache.set(name, await readFile(path, "utf8"));
  }
  return cache.get(name);
}

/**
 * 替换 ${placeholder} 占位符（不处理转义，简单模板足够）
 */
function fillTemplate(template, vars) {
  return template.replace(/\$\{(\w+)\}/g, (_, key) => {
    return vars[key] ?? "";
  });
}

export async function buildQuestionsPrompt({ resume, job, focus }) {
  const tpl = await loadPrompt("questions");
  const focusBlock = focus
    ? `- **重点技能关键词**：${focus}（请在出题时围绕这些关键词强化）`
    : "";
  return fillTemplate(tpl, {
    resume,
    "job.title": job.title ?? "",
    "job.industry": job.industry ?? "",
    "job.salary": job.salary ?? "",
    "job.years": job.years ?? "",
    "job.location": job.location ?? "",
    "job.requirements": job.requirements ?? "",
    focusBlock,
  });
}

export async function buildDiarizePrompt({ resume, job, dialogue }) {
  const tpl = await loadPrompt("diarize");
  return fillTemplate(tpl, {
    resume,
    "job.title": job.title ?? "",
    "job.industry": job.industry ?? "",
    "job.years": job.years ?? "",
    "job.requirements": job.requirements ?? "",
    dialogue,
  });
}

export async function buildReportPrompt({
  resume,
  job,
  dialogue,
  candidateName,
  reportType,
}) {
  const tpl = await loadPrompt("report");
  const typeMap = {
    comprehensive: "综合型",
    professional: "专业型",
    concise: "简洁型",
  };
  const focusMap = {
    comprehensive:
      "均衡覆盖 6 个维度，每个维度都给出具体评价",
    professional:
      "深入展开『专业技术能力』维度（占 50% 以上篇幅），其他维度简略但保留核心判断",
    concise: "每维度只给一段话总结，不分亮点/待改进，重点给最终结论",
  };
  return fillTemplate(tpl, {
    resume,
    jobJson: JSON.stringify(job, null, 2),
    dialogue,
    candidateName: candidateName || "未知候选人",
    "job.title": job.title ?? "",
    reportTypeLabel: typeMap[reportType] ?? reportType,
    focusBlock: focusMap[reportType] ?? "",
  });
}
