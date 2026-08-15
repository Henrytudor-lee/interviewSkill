#!/usr/bin/env node
/**
 * 面试官 Skill CLI
 *
 * 用法：
 *   interview questions --resume <path> --job-json <json|@file> [--count 11] [--difficulty 中级] [--focus "关键词"] [--output <file>]
 *   interview diarize   --resume <path> --job-json <json|@file> --dialogue <file> [--output <file>]
 *   interview evaluate  --resume <path> --job-json <json|@file> --dialogue <file> --report-type comprehensive [--output <file>]
 *
 * API key 优先级：--api-key > .env/.env.local > 环境变量 MINIMAX_API_KEY
 */

import { existsSync, readFileSync } from "fs";
import { writeFile } from "fs/promises";
import { readResume } from "../src/pdf.mjs";
import { runQuestions, questionsToMarkdown } from "../src/commands/questions.mjs";
import { runDiarize, turnsToMarkdown } from "../src/commands/diarize.mjs";
import { runEvaluate } from "../src/commands/evaluate.mjs";

/**
 * 极简 .env 解析：不依赖 dotenv 包，支持 # 注释和引号
 */
function loadDotenv() {
  for (const path of [".env", ".env.local"]) {
    if (!existsSync(path)) continue;
    const txt = readFileSync(path, "utf8");
    for (const line of txt.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const [, key, rawVal] = m;
      if (process.env[key] !== undefined) continue;
      let val = rawVal.trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}
loadDotenv();

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function help() {
  console.log(`面试官 Skill CLI

子命令：
  questions   生成面试题
  diarize     切分说话人
  evaluate    生成评估报告

通用参数：
  --resume <path>          简历文件路径（PDF / TXT / MD）
  --job-json <json|@file>  岗位 JSON，@ 前缀表示从文件读取
  --dialogue <path>        面试对话文本文件路径（diarize/evaluate 必填）
  --output <path>          输出到文件（默认 stdout）
  --api-key <sk-...>       API key（默认从 .env/.env.local 或环境变量 MINIMAX_API_KEY 读取）

questions 额外参数：
  --count <n>              题目数量（默认 11：客观6+主观5）
  --difficulty <level>     难度（初级/中级/高级，默认 中级）
  --focus "关键词1,关键词2"  重点技能关键词

evaluate 额外参数：
  --report-type <type>     报告类型：comprehensive/professional/concise（默认 comprehensive）
  --candidate-name <name>  候选人姓名

示例：
  interview questions --resume ./resume.pdf --job-json @job.json --focus "Vue3,TypeScript"
  interview diarize --resume ./resume.pdf --job-json @job.json --dialogue ./dialogue.txt
  interview evaluate --resume ./resume.pdf --job-json @job.json --dialogue ./dialogue.txt --report-type comprehensive
`);
}

async function readJobJson(raw) {
  let s = raw;
  if (s.startsWith("@")) {
    s = readFileSync(s.slice(1), "utf8").trim();
  }
  return JSON.parse(s);
}

async function readDialogue(path) {
  return readFileSync(path, "utf8").trim();
}

async function maybeWriteOutput(path, content) {
  if (!path) {
    process.stdout.write(content);
    if (!content.endsWith("\n")) process.stdout.write("\n");
  } else {
    await writeFile(path, content);
    console.error(`✓ 已写入 ${path}（${content.length} 字符）`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    help();
    process.exit(0);
  }

  const cmd = argv[0];
  const args = parseArgs(argv.slice(1));

  if (args["api-key"]) {
    process.env.MINIMAX_API_KEY = args["api-key"];
  }

  if (!args.resume) {
    console.error("错误：缺少 --resume <path>");
    process.exit(1);
  }
  if (!args["job-json"]) {
    console.error("错误：缺少 --job-json <json|@file>");
    process.exit(1);
  }

  console.error(`读取简历: ${args.resume}`);
  const resume = await readResume(args.resume);
  console.error(`✓ 简历长度 ${resume.length} 字`);

  console.error(`解析岗位 JSON`);
  const job = await readJobJson(args["job-json"]);
  console.error(`✓ 岗位: ${job.title || "(未命名)"}`);

  const candidateName = args["candidate-name"] || "";

  if (cmd === "questions") {
    const count = args.count ? parseInt(args.count, 10) : 11;
    const difficulty = args.difficulty || "中级";
    const focus = args.focus || "";
    console.error(`生成面试题: count=${count}, difficulty=${difficulty}, focus="${focus}"`);
    const result = await runQuestions({ resume, job, count, difficulty, focus });
    const md = questionsToMarkdown({
      questions: result.questions,
      difficulty: result.difficulty,
      focus: result.focus,
      candidateLevel: result.candidateLevel,
      levelReason: result.levelReason,
      job,
      candidateName,
    });
    await maybeWriteOutput(args.output, md);
  } else if (cmd === "diarize") {
    if (!args.dialogue) {
      console.error("错误：diarize 子命令需要 --dialogue <path>");
      process.exit(1);
    }
    console.error(`读取对话: ${args.dialogue}`);
    const dialogue = await readDialogue(args.dialogue);
    console.error(`✓ 对话长度 ${dialogue.length} 字`);
    console.error(`切分说话人...`);
    const turns = await runDiarize({ resume, job, dialogue });
    console.error(`✓ 切分完成，共 ${turns.length} 段`);
    const md = turnsToMarkdown({ turns, candidateName });
    await maybeWriteOutput(args.output, md);
  } else if (cmd === "evaluate") {
    if (!args.dialogue) {
      console.error("错误：evaluate 子命令需要 --dialogue <path>");
      process.exit(1);
    }
    const reportType = args["report-type"] || "comprehensive";
    if (!["comprehensive", "professional", "concise"].includes(reportType)) {
      console.error(`错误：--report-type 必须是 comprehensive/professional/concise，当前: ${reportType}`);
      process.exit(1);
    }
    console.error(`读取对话: ${args.dialogue}`);
    const dialogue = await readDialogue(args.dialogue);
    console.error(`✓ 对话长度 ${dialogue.length} 字`);
    console.error(`生成报告 (type=${reportType}, stream)...`);
    let buf = "";
    if (args.output) {
      const ws = (await import("fs")).createWriteStream(args.output);
      for await (const chunk of runEvaluate({
        resume,
        job,
        dialogue,
        candidateName,
        reportType,
      })) {
        ws.write(chunk);
        buf += chunk;
        process.stderr.write(".");
      }
      ws.end();
      console.error(`\n✓ 已写入 ${args.output}（${buf.length} 字符）`);
    } else {
      for await (const chunk of runEvaluate({
        resume,
        job,
        dialogue,
        candidateName,
        reportType,
      })) {
        process.stdout.write(chunk);
        buf += chunk;
        process.stderr.write(".");
      }
      process.stderr.write("\n");
    }
  } else {
    console.error(`未知子命令: ${cmd}`);
    help();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n✗ 错误: ${err.message || err}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
