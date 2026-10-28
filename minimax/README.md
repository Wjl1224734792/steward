# dev-team · 软件开发团队（MiniMax 插件版）

角色化软件开发团队：主对话代理担任 **Tech Lead**，接收软件需求后拆解成任务 DAG，按「依赖 + 文件所有权」串行/并行派发子智能体，全流程交付并贴真实测试输出。

本包是 zcode 版 `dev-team` 插件（v0.4.1）的 **MiniMax Plugin V1 移植版**，团队名册、六阶段流程、调度规则与铁律完全一致，差异只在宿主适配。v1.1.0 起附带可选的 GenUI 可视化技能。

## 团队名册（7 角色 + 外援）

| 角色 | 派发名 | 职责 |
|---|---|---|
| 需求分析师 | `dev-team:pm` | 模糊需求 → 可测规格（02-spec.md） |
| 方案设计师 | `dev-team:architect` | 规格 → 技术方案 + 任务 DAG（文件所有权 / 依赖） |
| 后端工程师 | `dev-team:backend-dev` | 按任务单 TDD 实施，只动白名单文件 |
| 前端工程师 | `dev-team:frontend-dev` | 实施 UI + 产出浏览器验收脚本 |
| 测试工程师 | `dev-team:qa-engineer` | 测试 / lint / typecheck 质量门，回派产品缺陷 |
| 浏览器验收员 | `dev-team:browser-tester` | 真实浏览器 GUI 黑盒验收，逐条判定 + 证据 |
| 代码评审员 | `dev-team:reviewer` | 交付前终审 diff，blocking / non-blocking / suggestion |
| （外援）Explore | 内置 `explore` | L 级需求开工前的仓库勘察（00-context.md 共享地图） |

## 核心机制

- **六阶段流程**：受理定级（S/M/L）→（勘察）→ 方案 → 实施 → QA 质量门 → 浏览器验收 → 终审汇报。
- **串行/并行调度**：派发单位是任务不是角色名额，同类角色可多实例；并行条件 = 无依赖 且 文件所有权不相交；并行批撞并发上限自动回退串行（结果等价）。
- **检索工具栈**：全员继承宿主 `tavily-remote`（搜索/深度研究）与 `context7`（库文档查证，防凭记忆臆造 API），缺省退回 `web_search` / `web_fetch`。
- **工件交接**：`tmp/dev-team/<run-id>/` 下 00-context / 01-requirement / 02-spec / 03-plan / reports / final-report。
- **修复回派**：QA / 浏览器 / 评审发现的缺陷按归属回派原开发，循环上限 2 轮。

## 技能

| 技能 | 作用 |
|---|---|
| `dev-team:dev-team` | Tech Lead 调度手册（完整文字流程，不依赖任何可视化） |
| `dev-team:dev-team-visualizer` | 可选呈现层：把已落盘的任务表与门禁报告渲染成 `mavis.widget.v1` 视图 |

**可视化两个视图**（均为可选，业务流程不依赖它）：

- **任务 DAG 与并行批次**（`kind="diagram"`）：从 `03-plan.md` 任务表渲染依赖链、最长依赖链、可并行批次，并标出文件所有权冲突。
- **质量门与缺陷回派看板**（`kind="dashboard"`）：从 `reports/qa.md`、`browser.md`、`review.md` 汇总阻断项、待回派、已修复与按严重度排序的缺陷明细。

衍生技能内含从 `minimax/genui-widget@mavis.widget.v1` 完整拷贝的 GenUI 基座（`genui.json` 记录实际摘要），自包含、可自由修改。

## 使用

```text
用开发团队完成：给 tmp/demo 写一个金额汇总脚本，带单测并跑绿
启动开发团队，帮我实现一个用户登录功能并做浏览器验收
```

触发方式有两层：

1. **Hook 自动注入**（`hooks/hooks.json` → `scripts/trigger.mjs`）：输入里出现「开发团队 / 开发小组 / dev-team」时，`UserPromptSubmit` 事件向主代理注入「加载 `dev-team:dev-team` 技能并按 Tech Lead 手册执行」的上下文。命中失败会静默放行，不会阻断对话。
2. **技能自然触发**：`skills/dev-team/SKILL.md` 的 `description` 覆盖「帮我实现一个…」「开发一个…」等语义，由模型直接加载。

## 与 zcode 版的适配差异

| 维度 | zcode 版 | MiniMax 版 |
|---|---|---|
| 清单 | `.zcode-plugin/plugin.json` | `.minimax-plugin/plugin.json`（schemaVersion 1） |
| 技能目录 | `skills/dev-team/SKILL.md` | 同名同结构，frontmatter `name` = 目录名 |
| 子代理 frontmatter | `tools: [Read, Bash, WebFetch, ...]` | 小写原生工具名（`read` / `bash` / `web_fetch` …），无 `color`，无 `task` |
| 调度工具 | Agent 工具 | `task` 工具（`agent_name` = `dev-team:<角色>`） |
| 并行批次 | 同消息多 Agent 调用 | 同消息多 `task` 调用，省略 `run_in_background` |
| 并发上限错误 | `concurrency limit exceeded` | `SUBAGENT_CONCURRENCY_LIMIT` |
| 斜杠命令 | `commands/dev-team.md` + `$ARGUMENTS` | 无该能力 → 改由 `UserPromptSubmit` Hook 注入 |
| 浏览器验收 | 宿主浏览器技能 + nodeRepl | `browser-use:control-in-app-browser` + `mcp_browser` |
| 外部检索 | tavily / context7 MCP | `tavily-remote` / `context7` MCP，缺省退 `web_search` / `web_fetch` |

## 目录结构

```text
dev-team/
├── .minimax-plugin/plugin.json   # 插件清单
├── icon.png / icon-dark.png      # Code 类图标（明/暗）
├── hooks/hooks.json              # UserPromptSubmit 触发器
├── scripts/trigger.mjs           # 触发脚本（Node，fail open）
├── skills/
│   ├── dev-team/SKILL.md         # Tech Lead 调度手册
│   └── dev-team-visualizer/      # 可选 GenUI 呈现层
│       ├── SKILL.md
│       ├── genui.json            # fork 出处与基座摘要
│       └── references/
│           ├── components.md     # 两个组件配方
│           ├── data-schema.json  # 数据契约
│           ├── examples.md       # 两个完整可运行 Widget 示例
│           └── genui-widget/     # 完整拷贝的 GenUI 基座
└── agents/*.md                   # 7 个角色子代理
```

## 安装位置

- 仓库源：`E:\CodeStore\plugins\dev-team\minimax\`
- 已安装：`C:\Users\12247\.minimax\plugins\dev-team\`

仓库改动后需重新拷贝到安装目录（MiniMax 会自动重扫本地插件，无需重启）：

```powershell
Copy-Item -LiteralPath "E:\CodeStore\plugins\dev-team\minimax\*" -Destination "C:\Users\12247\.minimax\plugins\dev-team\" -Recurse -Force
```

## 许可

MIT · Copyright (c) 2026 Lin
