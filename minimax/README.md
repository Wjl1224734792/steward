# Steward · MiniMax 插件版

角色化研发团队：主对话代理担任 **Tech Lead**，把需求拆成任务 DAG，按「依赖 + 文件所有权」串行/并行派发子智能体。当前版本（1.5.1）覆盖功能交付、Bug 修复（B0–B3 分流）、只出计划、维护循环与接手存量，并自带可信变更门禁与演进循环（T3 按需升级）；演进细节见 [路线图](../docs/ROADMAP.md)。

本包是 ZCode 版 Steward（0.7.1）的 **MiniMax Plugin V1 移植版**，团队名册、六阶段流程、调度规则与铁律一致，差异只在宿主适配。v1.2.0 起使用 Steward 名称，并继续附带可选的 GenUI 可视化技能。

## 团队名册（7 角色 + 外援）

| 角色 | 派发名 | 职责 |
|---|---|---|
| 需求分析师 | `steward:pm` | 模糊需求 → 可测规格（02-spec.md） |
| 方案设计师 | `steward:architect` | 规格 → 技术方案 + 任务 DAG（文件所有权 / 依赖） |
| 后端工程师 | `steward:backend-dev` | 按任务单 TDD 实施，只动白名单文件 |
| 前端工程师 | `steward:frontend-dev` | 实施 UI + 产出浏览器验收脚本 |
| 测试工程师 | `steward:qa-engineer` | 测试 / lint / typecheck 质量门，回派产品缺陷 |
| 浏览器验收员 | `steward:browser-tester` | 真实浏览器 GUI 黑盒验收，逐条判定 + 证据 |
| 代码评审员 | `steward:reviewer` | 交付前终审 diff，blocking / non-blocking / suggestion |
| （外援）Explore | 内置 `explore` | L 级需求开工前的仓库勘察（00-context.md 共享地图） |

## 核心机制

- **六阶段流程 + 批准门**：受理定级（S/M/L）→（勘察）→ 方案（影响面 + 机读计划）→ 计划校验 + Plan Critic + 用户批准（M/L）→ 实施 → QA 质量门 → 浏览器验收 → 终审汇报。
- **串行/并行调度**：派发单位是任务不是角色名额，同类角色可多实例；并行条件 = 无依赖 且 文件所有权不相交；并行批撞并发上限自动回退串行。
- **可信变更门禁（scripts/，本地 Node 脚本，不做 CI）**：`validate-plan.mjs` 机检计划（路径/DAG 环/所有权/AC 覆盖/测试改动声明）；`verify.mjs` 独立复跑门禁并查 flaky；`baseline record/check` 回滚锚点 + 越界 diff 守卫 + 未声明测试 diff 拦截（反作弊）；`run-state.mjs` 断点恢复、同一错误连续 2 次即停；`take-over.mjs` 生成目标项目 AGENTS.md + docs/project/（T0/T1）初稿。
- **Bug 通道**：输入描述 Bug（「修这个 Bug」「这个功能坏了」）即按 B0–B3 分流：B2/B3 走复现 → 失败测试 → 根因 → 最小修复 → 回归 → 记录；B0/B1 先止损并写 postmortem。
- **检索工具栈**：全员继承宿主 `tavily-remote`（搜索/深度研究）与 `context7`（库文档查证），缺省退回 `web_search` / `web_fetch`。
- **工件交接**：`tmp/steward/<run-id>/` 下 00-context / 01-requirement / 02-spec / 02-impact / 03-plan(.md/.json) / run.json / baseline.json / reports / final-report。
- **修复回派**：QA / 浏览器 / 评审发现的缺陷按归属回派原开发，循环上限 2 轮。

## 技能

| 技能 | 作用 |
|---|---|
| `steward:steward` | Tech Lead 调度手册（完整文字流程，不依赖任何可视化） |
| `steward:steward-visualizer` | 可选呈现层：把已落盘的任务表与门禁报告渲染成 `mavis.widget.v1` 视图 |
| `steward:systematic-debugging` | 系统化调试纪律（复现 → 缩小 → 假设 → 验证 → 根因），Bug 任务按需加载 |
| `steward:tdd` | TDD 纪律（红 → 绿 → 重构），实现类任务按需加载 |
| `steward:verification-before-completion` | 完成前验证纪律（复跑 + 真实输出才可声称完成） |

**可视化两个视图**（均为可选，业务流程不依赖它）：

- **任务 DAG 与并行批次**（`kind="diagram"`）：从 `03-plan.md` 任务表渲染依赖链、最长依赖链、可并行批次，并标出文件所有权冲突。
- **质量门与缺陷回派看板**（`kind="dashboard"`）：从 `reports/qa.md`、`browser.md`、`review.md` 汇总阻断项、待回派、已修复与按严重度排序的缺陷明细。

衍生技能内含从 `minimax/genui-widget@mavis.widget.v1` 完整拷贝的 GenUI 基座（`genui.json` 记录实际摘要），自包含、可自由修改。

## 使用

```text
用 Steward 完成：给 tmp/demo 写一个金额汇总脚本，带单测并跑绿
启动 Steward 开发团队，帮我实现一个用户登录功能并做浏览器验收
```

触发方式有两层：

1. **Hook 自动注入**（`hooks/hooks.json` → `scripts/trigger.mjs`）：输入里出现「开发团队 / 开发小组 / Steward」时，`UserPromptSubmit` 事件向主代理注入「加载 `steward:steward` 技能并按 Tech Lead 手册执行」的上下文。命中失败会静默放行，不会阻断对话。
2. **技能自然触发**：`skills/steward/SKILL.md` 的 `description` 覆盖「帮我实现一个…」「开发一个…」等语义，由模型直接加载。

## 与 ZCode 版的适配差异

| 维度 | ZCode 版 | MiniMax 版 |
|---|---|---|
| 清单 | `.zcode-plugin/plugin.json` | `.minimax-plugin/plugin.json`（schemaVersion 1） |
| 技能目录 | `skills/steward/SKILL.md` | 同名同结构，frontmatter `name` = 目录名 |
| 子代理 frontmatter | `tools: [Read, Bash, WebFetch, ...]` | 小写原生工具名（`read` / `bash` / `web_fetch` …），无 `color`，无 `task` |
| 调度工具 | Agent 工具 | `task` 工具（`agent_name` = `steward:<角色>`） |
| 并行批次 | 同消息多 Agent 调用 | 同消息多 `task` 调用，省略 `run_in_background` |
| 并发上限错误 | `concurrency limit exceeded` | `SUBAGENT_CONCURRENCY_LIMIT` |
| 斜杠命令 | `commands/steward.md` + `$ARGUMENTS` | 无该能力 → 改由 `UserPromptSubmit` Hook 注入 |
| 浏览器验收 | 宿主浏览器技能 + nodeRepl | `browser-use:control-in-app-browser` + `mcp_browser` |
| 外部检索 | tavily / context7 MCP | `tavily-remote` / `context7` MCP，缺省退 `web_search` / `web_fetch` |

## 目录结构

```text
minimax/
├── .minimax-plugin/plugin.json   # 插件清单
├── icon.png / icon-dark.png      # Code 类图标（明/暗）
├── hooks/hooks.json              # UserPromptSubmit 触发器
├── scripts/trigger.mjs           # 触发脚本（Node，fail open）
├── scripts/*.mjs                 # 可信变更门禁脚本（validate-config / take-over / validate-plan / run-state / verify）与 templates/ 模板
├── skills/
│   ├── steward/SKILL.md          # Tech Lead 调度手册
│   └── steward-visualizer/       # 可选 GenUI 呈现层
│       ├── SKILL.md
│       ├── genui.json            # fork 出处与基座摘要
│       └── references/
│           ├── components.md     # 两个组件配方
│           ├── data-schema.json  # 数据契约
│           ├── examples.md       # 两个完整可运行 Widget 示例
│           └── genui-widget/     # 完整拷贝的 GenUI 基座
└── agents/*.md                   # 7 个角色子代理
```

## 安装

把本仓库的 `minimax/` 复制到 `%USERPROFILE%\.minimax\plugins\steward\`：

```powershell
Copy-Item -LiteralPath "<repo>\minimax\*" -Destination "$env:USERPROFILE\.minimax\plugins\steward\" -Recurse -Force
```

MiniMax 会自动重扫本地插件，无需重启。改动后重新拷贝即可。

## English

Steward is a role-based engineering team plugin for MiniMax. The lead agent acts as Tech Lead, decomposes work into a task DAG with file ownership, and dispatches PM / architect / backend & frontend devs / QA / browser tester / reviewer subagents. Release 1.5.1 covers feature delivery, the B0-B3 bug track, plan-only mode, the maintenance loop, takeover (T1 generation + first health scan), the evolution loop (architecture drift / duplication / refactor-ratio checks, codemod planning), on-demand T3 docs, browser evidence contract, learning loop, and trusted-change gates with a retry budget.

Skills: `steward:steward` (Tech Lead workflow) and `steward:steward-visualizer` (optional GenUI views).

Trigger: the `UserPromptSubmit` hook loads the skill when the input contains "开发团队", "开发小组", or "Steward". Install by copying `minimax/` into `%USERPROFILE%\.minimax\plugins\steward\`.

Version: 1.5.1 · License: MIT · Copyright (c) 2026 Lin
