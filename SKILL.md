---
name: 面试官
description: 帮助 HR / 面试官完成完整面试评估流程 — 收集简历与岗位信息、可选生成面试题、切分面试对话、生成多维度评估报告与「面试评价总结」。当用户说"面试官"、"面试评价"、"帮我评估候选人"、"分析这段面试对话"时触发。
metadata:
  short-description: 简历 + 岗位 + 对话 → 多维度评估报告
---

# 面试官 Skill

> 触发词：**面试官** / **面试评价** / **评估候选人** / **分析面试对话**

## ⚠️ 强制规则（必须遵守）

**所有题目生成、对话切分、报告生成，都必须通过 Bash 工具执行 CLI 命令完成。绝不要在对话中直接生成题目或报告。**

原因：

1. CLI 调用了**调优过的 prompt**（含 answer 字段），你自己生成会丢失答案/评价总结
2. CLI 输出落到磁盘存档，HR 可以转发
3. CLI 有进度提示、JSON 解析回退、流式输出

**CLI 路径**：`/Volumes/world/program/interview-skill/bin/interview.mjs`（绝对路径，避免 cwd 问题）

**每个阶段结束后**：用 Bash 调 CLI → 命令完成后用 `cat` 把生成的 Markdown 文件**完整**展示给用户（带"标准答案 / 评估要点"段，不要简化或复述）。

## 何时使用

用户需要做一次完整面试评估时使用本 skill。典型触发：

- "帮我评估一下这个候选人"
- "面试官，这是一份简历和岗位，生成面试题"
- "分析这段面试对话，出一份报告"
- 用户已经在某个 stage 中，要进入下一阶段

不要用于：

- 单纯技术问答（用默认 Codex 即可）
- 单纯生成简历（用默认 Codex 即可）
- 与面试无关的任务

## 工作流（5 阶段对话式）

按顺序引导用户，每阶段结束问"是否进入下一步"：

### Stage 1：收集简历 + 岗位

- 简历来源（按优先级让用户选）：
  1. 用户直接粘贴文本
  2. 指定路径（PDF / TXT / MD）
  3. 列出某目录下简历让用户选（可用 `ls /Volumes/other/epro/` 等用户提到的目录）
- 岗位 6 字段：title / industry / salary / years / location / requirements
- 仅 title 与 requirements 必填，其他可空

收集完后，把简历和岗位 JSON 写到临时文件：

```bash
# 简历保存到 /tmp/<candidate>_resume.txt（或 .pdf / .md）
# 岗位 JSON 保存到 /tmp/<candidate>_job.json
```

后续 Stage 都复用这两个文件。

### Stage 2：面试题（可选，必须用 CLI）

**必须执行的命令**：

```bash
node /Volumes/world/program/interview-skill/bin/interview.mjs questions \
  --resume /tmp/<candidate>_resume.<ext> \
  --job-json @/tmp/<candidate>_job.json \
  [--count 11] [--difficulty 中级] [--focus "关键词1,关键词2"] \
  --output /tmp/<candidate>_questions.md
```

**参数默认值**：

- `--count 11`（客观 6 + 主观 5）
- `--difficulty 中级`
- `--focus ""`（用户没指定则空）

**完成后**：

```bash
cat /tmp/<candidate>_questions.md
```

把完整内容（**含"标准答案 / 评估要点"段**）原样展示给用户。

**追问支持**（用户要求调整时重新跑命令）：

- "再生成 5 道" → `--count 5`
- "增加难度" → `--difficulty 高级`
- "重点考 Vue3" → `--focus "Vue3,响应式原理"`
- "导出 Markdown" → 命令本身已用 `--output` 写到磁盘

### Stage 3：对话切分（必须用 CLI）

```bash
node /Volumes/world/program/interview-skill/bin/interview.mjs diarize \
  --resume /tmp/<candidate>_resume.<ext> \
  --job-json @/tmp/<candidate>_job.json \
  --dialogue /tmp/<candidate>_dialogue.txt \
  --output /tmp/<candidate>_diarized.md
```

完成后 `cat /tmp/<candidate>_diarized.md` 展示给用户。

### Stage 4：评估报告（必须用 CLI）

```bash
node /Volumes/world/program/interview-skill/bin/interview.mjs evaluate \
  --resume /tmp/<candidate>_resume.<ext> \
  --job-json @/tmp/<candidate>_job.json \
  --dialogue /tmp/<candidate>_dialogue.txt \
  --report-type comprehensive \
  --candidate-name "<候选人姓名>" \
  --output /tmp/<candidate>_report.md
```

报告类型：
- `comprehensive`（综合型，默认）
- `professional`（专业型）
- `concise`（简洁型）

完成后 `cat /tmp/<candidate>_report.md` 展示给用户（**必须包含末尾"面试评价总结"段**）。

### Stage 5：追问 & 收尾

可选：
- 把所有产物（题目 + 切分 + 报告）汇总到一个 Markdown 文件保存到磁盘
- 调整某维度重新生成报告（修改 job 后重跑 Stage 4）
- 回到 Stage 1 给下一个候选人评估

## 关键约定

1. **API key** 通过 `MINIMAX_API_KEY` 环境变量 / `.env.local` 读取。
2. **绝对路径**：所有 node 命令必须用 `/Volumes/world/program/interview-skill/bin/interview.mjs` 全路径。
3. **简历和岗位** 一旦收集完整，后续 Stage 都复用，**不要让用户重复提供**。
4. **临时文件路径**：统一用 `/tmp/<candidate>_<purpose>.{txt,md,json,pdf}`。
5. **遇到错误**：把 CLI 的 stderr 完整展示给用户，让用户决定是否重试。
6. **不要修改 prompt 文件**（`prompts/*.txt`）除非用户明确要求。

## 依赖

- Node ≥ 18（用 fetch API）
- `pdf-parse@1.1.1`（PDF 简历解析）
- `MINIMAX_API_KEY` 环境变量
- 模型：`MiniMax-M3`（OpenAI 兼容协议，endpoint `https://api.minimaxi.com/v1/chat/completions`）
