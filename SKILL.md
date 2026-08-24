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
# 简历保存到 <output_dir>/<candidate>_resume.<ext>
# 岗位 JSON 保存到 <output_dir>/<candidate>_job.json
```

后续 Stage 都复用这两个文件。

**Stage 1 → Stage 2 衔接**：只要简历 + title + requirements 三个核心信息齐全，**立即进入 Stage 2**，不要询问"是否生成面试题"。只有当用户明确说"先不生成题目"或"跳过 Stage 2"时才跳过。

## ⚠️ 输出文件路径（必须遵守）

**默认（用户没指定工作区）**：所有文件落到 `/tmp/<candidate>_<purpose>.{txt,md,json,pdf}`

**如果用户提供了工作区目录**，文件必须落在工作区内：

| 用户语境 | 工作区路径 |
|---|---|
| "工作目录是 X / 工作区是 X / 项目目录 X" | 用户说的 X |
| "输出到这个文件夹 / 放到 X / 保存到 X" | 用户说的 X |
| 用户提供的简历路径是 `<dir>/xxx.pdf`，且没说其他 | `<dir>`（简历所在目录） |
| 用户列出的目录（`ls /Volumes/other/epro/` 等） | 该目录 |

**路径模板**（用户给了工作区 `<ws>` 后）：

- 简历 → `<ws>/<candidate>_resume.<ext>`
- 岗位 JSON → `<ws>/<candidate>_job.json`
- 对话文本 → `<ws>/<candidate>_dialogue.txt`
- 面试题 → `<ws>/<candidate>_questions.md`
- 切分结果 → `<ws>/<candidate>_diarized.md`
- 报告 → `<ws>/<candidate>_report.md`

**判断不出来时**：用默认 /tmp/，并在展示文件路径时告知用户"已保存到 /tmp/xxx（如需放到指定目录请告诉我）"。

---

### Stage 2：面试题（可选，必须用 CLI）

**必须执行的命令**：

```bash
node /Volumes/world/program/interview-skill/bin/interview.mjs questions \
  --resume <output_dir>/<candidate>_resume.<ext> \
  --job-json @<output_dir>/<candidate>_job.json \
  [--count 11] [--difficulty 中级] [--focus "关键词1,关键词2"] \
  --output <output_dir>/<candidate>_questions.md
```

**参数默认值**：

- `--count 11`（客观 6 + 主观 5）
- `--difficulty 中级`
- `--focus ""`（用户没指定则空）

**完成后**：

```bash
cat <output_dir>/<candidate>_questions.md
```

把完整内容（**含"标准答案 / 评估要点"段**）原样展示给用户。

**追问支持**（用户要求调整时重新跑命令）：

- "再生成 5 道" → `--count 5`
- "增加难度" → `--difficulty 高级`
- "重点考 Vue3" → `--focus "Vue3,响应式原理"`
- "导出 Markdown" → 命令本身已用 `--output` 写到磁盘

### Stage 3：对话切分（必须用 CLI）

**Stage 2 → Stage 3 衔接**：用户确认题目完成（或直接说"下一步 / 生成报告"），**立即进入 Stage 3**，不要询问"是否继续"。

```bash
node /Volumes/world/program/interview-skill/bin/interview.mjs diarize \
  --resume <output_dir>/<candidate>_resume.<ext> \
  --job-json @<output_dir>/<candidate>_job.json \
  --dialogue <output_dir>/<candidate>_dialogue.txt \
  --output <output_dir>/<candidate>_diarized.md
```

完成后 `cat <output_dir>/<candidate>_diarized.md` 展示给用户。

### Stage 4：评估报告（必须用 CLI）

**Stage 3 → Stage 4 衔接**：对话切分完成 + 候选人姓名已知，**立即进入 Stage 4**，不要询问"是否生成报告"。

```bash
node /Volumes/world/program/interview-skill/bin/interview.mjs evaluate \
  --resume <output_dir>/<candidate>_resume.<ext> \
  --job-json @<output_dir>/<candidate>_job.json \
  --dialogue <output_dir>/<candidate>_dialogue.txt \
  --report-type comprehensive \
  --candidate-name "<候选人姓名>" \
  --output <output_dir>/<candidate>_report.md
```

报告类型：
- `comprehensive`（综合型，默认）
- `professional`（专业型）
- `concise`（简洁型）

完成后 `cat <output_dir>/<candidate>_report.md` 展示给用户（**必须包含末尾"面试评价总结"段**）。

### Stage 5：追问 & 收尾

可选：
- 把所有产物（题目 + 切分 + 报告）汇总到一个 Markdown 文件保存到磁盘
- 调整某维度重新生成报告（修改 job 后重跑 Stage 4）
- 回到 Stage 1 给下一个候选人评估

## 关键约定

1. **API key** 通过 `MINIMAX_API_KEY` 环境变量 / `.env.local` 读取。
2. **绝对路径**：所有 node 命令必须用 `/Volumes/world/program/interview-skill/bin/interview.mjs` 全路径。
3. **简历和岗位** 一旦收集完整，后续 Stage 都复用，**不要让用户重复提供**。
4. **文件路径**：用 `<output_dir>/<candidate>_<purpose>.{txt,md,json,pdf}`，见上方"输出文件路径"规则。
5. **遇到错误**：把 CLI 的 stderr 完整展示给用户，让用户决定是否重试。
6. **不要修改 prompt 文件**（`prompts/*.txt`）除非用户明确要求。

## 依赖

- Node ≥ 18（用 fetch API）
- `pdf-parse@1.1.1`（PDF 简历解析）
- `MINIMAX_API_KEY` 环境变量
- 模型：`MiniMax-M3`（OpenAI 兼容协议，endpoint `https://api.minimaxi.com/v1/chat/completions`）
