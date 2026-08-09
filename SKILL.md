---
name: 面试官
description: 帮助 HR / 面试官完成完整面试评估流程 — 收集简历与岗位信息、可选生成面试题、切分面试对话、生成多维度评估报告与「面试评价总结」。当用户说"面试官"、"面试评价"、"帮我评估候选人"、"分析这段面试对话"时触发。
metadata:
  short-description: 简历 + 岗位 + 对话 → 多维度评估报告
---

# 面试官 Skill

> 触发词：**面试官** / **面试评价** / **评估候选人** / **分析面试对话**

## 何时使用

用户需要做一次完整面试评估时使用本 skill。典型触发：

- "帮我评估一下这个候选人"
- "面试官，这是一份简历和岗位，生成面试题"
- "分析这段面试对话，出一份报告"
- 用户已经在某个 step 中，要进入下一阶段

不要用于：

- 单纯技术问答（用默认 Codex 即可）
- 单纯生成简历（用默认 Codex 即可）
- 与面试无关的任务

## 工作流（5 阶段对话式）

按顺序引导用户，每阶段结束问"是否进入下一步"：

### Stage 1：收集简历 + 岗位

- 简历来源（按优先级让用户选）：
  1. 用户直接粘贴文本
  2. 指定路径（PDF / TXT / MD），用 `node bin/interview.mjs` 调用前 `readResume()` 自动判断扩展名
  3. 列出某目录下简历让用户选（可用 `ls /Volumes/other/epro/` 等用户提到的目录）
- 岗位 6 字段：title / industry / salary / years / location / requirements
  - 仅 title 与 requirements 是必填，其他可空

### Stage 2：面试题（可选，可追问调整）

默认生成 **11 道**：客观 6（全部简答）+ 主观 5（结合简历具体经历）。

命令：

```bash
node bin/interview.mjs questions \
  --resume <path> --job-json @<job.json> \
  [--count 11] [--difficulty 中级] [--focus "Vue3,TypeScript"]
```

**重要约束**（必须传给 LLM）：
- 客观题仅限**简答题**，**严禁**选择题 / 判断对错题 / 代码题 / 场景方案题
- 主观题必须**结合候选人简历具体经历**

如果用户要调整：
- "再生成 5 道" → `--count 5`
- "增加难度" → `--difficulty 高级`
- "重点考 Vue3" → `--focus "Vue3,响应式原理"`

### Stage 3：对话切分

```bash
node bin/interview.mjs diarize \
  --resume <path> --job-json @<job.json> --dialogue <path> \
  [--output <path>]
```

输入：用户粘贴的对话文本或上传的文件。
输出：`【面试官】xxx \n 【候选人】yyy` 格式 Markdown。

### Stage 4：评估报告（流式）

```bash
node bin/interview.mjs evaluate \
  --resume <path> --job-json @<job.json> --dialogue <path> \
  --report-type comprehensive \
  [--output <path>] [--candidate-name "张三"]
```

报告类型：
- `comprehensive`（综合型，默认） — 6 维度均衡
- `professional`（专业型） — 专业技术能力占 50%+
- `concise`（简洁型） — 每维度一段话

**末尾必须包含「面试评价总结」段**（约 300 字，分技术性 + 综合性两部分，prompt 已固定）。

**追问支持**：
- "重新生成某维度" → 把 resume/job 缓存后重新调 evaluate
- "调整岗位要求" → 修改 job.requirements 后重新调
- "导出 Markdown" → 加 `--output`

### Stage 5：追问 & 收尾

可选：
- 把所有产物（题目 + 切分 + 报告）汇总到一个 Markdown 文件保存到磁盘
- 回到 Stage 1 给下一个候选人评估

## 关键约定

1. **API key** 通过环境变量 `MINIMAX_API_KEY` 读取，调用前确认用户已设置。
2. **简历和岗位** 一旦收集完整，后续 Stage 都复用，**不要让用户重复提供**。
3. **中间产物缓存**：对话式运行时，把 resume 文本 / job JSON / dialogue 文本 / candidateName 存在 skill 上下文，不要每次重新询问。
4. **遇到错误**：LLM 返回空内容、JSON 解析失败、流式中断 —— 都用具体错误信息呈现给用户，让用户决定是否重试。
5. **不要修改 prompt 文件**（`prompts/*.txt`）除非用户明确要求，因为这些是经过调优的。

## 依赖

- Node ≥ 18（用 fetch API）
- `pdf-parse@1.1.1`（PDF 简历解析）
- `MINIMAX_API_KEY` 环境变量
- 模型：`MiniMax-M3`（OpenAI 兼容协议，endpoint `https://api.minimaxi.com/v1/chat/completions`）
