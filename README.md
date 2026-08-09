# 面试官 Skill

> Codex Skill — 一句话触发，自动完成"简历 + 岗位 → 面试题 → 对话切分 → 评估报告"完整流程。

## 这是什么

一个命令行驱动的 Codex skill，复用 [MiniMax-M3](https://platform.minimaxi.com) 大模型，帮 HR / 面试官完成一次完整面试评估。所有交互通过 Codex 会话对话完成，不需要任何 UI。

## 工作流

```
[1] 收集输入       简历（粘贴/PDF/目录）+ 岗位 6 字段
[2] 面试题（可选） 数量 / 难度 / 重点技能（默认：客观6+主观5，全部简答题）
[3] 对话处理       粘贴/上传面试对话文本 → LLM 切分说话人
[4] 评估报告       流式输出 6 维度评估 + 末尾「面试评价总结」
[5] 追问 & 保存    调整面试题/报告/岗位要求，或导出 Markdown 文件
```

## 安装

```bash
git clone git@github.com:Henrytudor-lee/interviewSkill.git
cd interviewSkill
npm install
cp .env.example .env
# 编辑 .env 填入 MINIMAX_API_KEY
```

## 作为 Codex Skill 安装

将整个项目软链到 `~/.codex/skills/interviewer/`：

```bash
ln -s "$(pwd)" ~/.codex/skills/interviewer
```

重启 Codex 后，输入 **"面试官"** 或 **"面试评价"** 触发。

## CLI 直接使用

不依赖 Codex 也可单独使用：

```bash
# 生成面试题（默认 11 道：客观6+主观5）
node bin/interview.mjs questions \
  --resume ./examples/sample-resume.pdf \
  --job-json '{"title":"前端工程师","requirements":"Vue3,React,TypeScript"}'

# 切分说话人
node bin/interview.mjs diarize \
  --resume ./examples/sample-resume.pdf \
  --job-json @./examples/sample-job.json \
  --dialogue ./examples/sample-dialogue.txt

# 生成评估报告（流式）
node bin/interview.mjs evaluate \
  --resume ./examples/sample-resume.pdf \
  --job-json @./examples/sample-job.json \
  --dialogue ./examples/sample-dialogue.txt \
  --report-type comprehensive \
  --output ./report.md
```

参数速查：

| 参数 | 说明 |
|---|---|
| `--resume <path>` | 简历文件（PDF/TXT/MD） |
| `--job-json <json\|@file>` | 岗位 JSON，@ 前缀读文件 |
| `--dialogue <path>` | 面试对话文本 |
| `--output <path>` | 输出文件（默认 stdout） |
| `--count <n>` | 题目数量（默认 11） |
| `--difficulty <level>` | 初级/中级/高级（默认 中级） |
| `--focus "关键词1,关键词2"` | 重点技能关键词 |
| `--report-type <type>` | comprehensive/professional/concise |
| `--candidate-name <name>` | 候选人姓名 |
| `--api-key <sk-...>` | API key（默认读环境变量） |

## 默认输出格式

面试题默认生成 **11 道**：客观 6 道（全部简答题）+ 主观 5 道（结合候选人简历具体经历），**严禁选择题、判断对错题、代码题、场景方案题**。

评估报告默认 6 维度（专业技术能力 / 语言表达 / 逻辑思维 / 解决问题 / 工作态度 / 稳定性）+ 末尾"面试评价总结"（技术性 + 综合性，约 300 字）。

## 追问能力

- "再生成 5 道题，重点问 Vue3 响应式原理" → 重新调 `questions`
- "把第六维度稳定性写得更细一点" → 重新调 `evaluate`
- "岗位要求增加熟悉 Vite" → 修改 job.requirements 后重新调
- "把这次评估导成 Markdown 文件" → 加 `--output`

## 开发

```bash
npm install         # 安装 pdf-parse@1.1.1
DEBUG=1 node bin/interview.mjs questions --resume ...  # 看 stack
```

依赖只有 `pdf-parse@1.1.1`，其它全部用 Node 内置 fetch。

## License

MIT
