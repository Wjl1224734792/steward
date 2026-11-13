# Steward · MiniMax 插件版

角色化研发团队：主对话代理担任 **Tech Lead**，把需求拆成任务 DAG，按「依赖 + 文件所有权」串行/并行派发子智能体。当前版本（1.1.0）覆盖功能交付（subagent / inline 两种执行模式）、Bug 修复（B0–B3 分流）、只出计划、维护循环与接手存量，并自带可信变更门禁、演进循环（T3 按需升级）、需求澄清内核、docTier=3 完整文档流水线、主技能按需拆分（`inline` / `docs` 按需加载，主技能只留指针）、文档治理（`steward:docs-governance` + `docs-gate` / `doc-snapshot` 本地门禁）、宿主无关的 `steward:project-lifecycle` 与 `steward:using-steward` 技能路由；演进细节见 [路线图](../docs/ROADMAP.md)。

本包是 Steward 的 **MiniMax Plugin V1 移植版**，与 ZCode 版**同版本同源**（团队名册、六阶段流程、调度规则与铁律一致），差异只在宿主适配。v1.2.0 起使用 Steward 名称，并继续附带可选的 GenUI 可视化技能。

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
- **可信变更门禁（scripts/，本地 Node 脚本，不做 CI）**：`validate-plan.mjs` 机检计划（路径/DAG 环/所有权/AC 覆盖/测试改动声明）；`verify.mjs` 独立复跑门禁并查 flaky；`baseline record/check` 回滚锚点 + 越界 diff 守卫 + 未声明测试 diff 拦截（反作弊）；`run-state.mjs` 断点恢复、同一错误连续 2 次即停；`take-over.mjs` 生成目标项目 AGENTS.md + docs/project/（T0/T1）初稿。包内 `scripts/` 下这些脚本与 `templates/`、`doc/` 自 1.1.0 起是构建生成物（唯一正文源在仓库 `shared/scripts/`），不手改。
- **Bug 通道**：输入描述 Bug（「修这个 Bug」「这个功能坏了」）即按 B0–B3 分流：B2/B3 走复现 → 失败测试 → 根因 → 最小修复 → 回归 → 记录；B0/B1 先止损并写 postmortem。
- **需求澄清内核（Stage 0.1）**：M/L 级、需求二义或新领域时先做第一性原理四问（问题 / 约束 / 备选 / 非目标+成功指标），最多问 3 个 P0 问题（S 级不追问）；P1/P2 按默认值写进 `01-requirement.md` 的假设并一句话告知。
- **文档流水线（docTier=3）**：完整参考库在 `skills/steward/references/doc-pipeline/`（七阶段文档树 + 19 类模板 + 规范正文），本地门禁脚本在 `scripts/doc/`（`doc-init` 建树 / `doc-check` 索引死链 / `guard-naming` 命名守卫）——与 ZCode 侧逐字节同源，由 build.mjs 同步，勿手工改副本。
- **宿主守卫 hooks**：`scripts/hooks/guard.mjs` 三道 PreToolUse 守卫（`secret` 密钥扫描 / `ownership` 文件所有权 / `dangerous` 危险命令），已在 `hooks/hooks.json` 注册并随插件生效；fail-open，解析失败不阻塞。
- **检索工具栈**：全员继承宿主 `tavily-remote`（搜索/深度研究）与 `context7`（库文档查证），缺省退回 `web_search` / `web_fetch`。
- **工件交接**：`tmp/steward/<run-id>/` 下 00-context / 01-requirement / 02-spec / 02-impact / 03-plan(.md/.json) / run.json / baseline.json / reports / final-report。
- **修复回派**：QA / 浏览器 / 评审发现的缺陷按归属回派原开发，循环上限 2 轮。

## 技能

| 技能 | 作用 |
|---|---|
| `steward:steward` | Tech Lead 调度手册（完整文字流程，不依赖任何可视化） |
| `steward:agent-settings` | 子代理模型与思考强度配置（Mini App 配置页 / `agent-config.mjs` CLI；项目根 `steward.config.json` 的 `modelRouting` 优先） |
| `steward:steward-visualizer` | 可选呈现层：把已落盘的任务表与门禁报告渲染成 `mavis.widget.v1` 视图 |
| `steward:systematic-debugging` | 系统化调试纪律（复现 → 缩小 → 假设 → 验证 → 根因），Bug 任务按需加载 |
| `steward:tdd` | TDD 纪律（红 → 绿 → 重构），实现类任务按需加载 |
| `steward:using-steward` | 技能路由：不知道用哪个入口/技能时先读它，路由到功能交付 / Bug / 只出计划 / 维护 / 接手 / 文档流水线 |
| `steward:verification-before-completion` | 完成前验证纪律（复跑 + 真实输出才可声称完成） |
| `steward:inline` | 直接执行模式（主代理按 DAG 自己动手），按需加载，主技能只留指针 |
| `steward:docs` | docTier=3 七阶段文档流水线，按需加载 |
| `steward:docs-governance` | 文档治理：活/记录/基线三类分治、拆分 / 归档 / `history/` 版本快照 + `docs-gate` / `doc-snapshot` 门禁 |
| `steward:project-lifecycle` | 项目全生命周期母本（`references/` 与 `assets/` 随包） |

> 共 11 个技能，与 `.minimax-plugin/plugin.json` 的 `skills` 清单一一对应。

**可视化三个视图**（均为可选，业务流程不依赖它）：

- **任务 DAG 与并行批次**（`kind="diagram"`）：从 `03-plan.md` 任务表渲染依赖链、最长依赖链、可并行批次，并标出文件所有权冲突。
- **质量门与缺陷回派看板**（`kind="dashboard"`）：从 `reports/qa.md`、`browser.md`、`review.md` 汇总阻断项、待回派、已修复与按严重度排序的缺陷明细。
- **维护健康看板**（`kind="dashboard"`）：从 `reports/maintenance-*.md` 与 `HEALTH.md` 渲染健康分、分级、趋势、八类扫描计数与按得分排序的维护 backlog。

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
| 守卫 hooks | `hooks/hooks.json` 用 `${CLAUDE_PLUGIN_ROOT}`，matcher 匹配 `Write\|Edit` / `Bash` | `hooks/hooks.json` 用 `${PLUGIN_ROOT}`（Windows 走 `commandWindows`），matcher 匹配小写原生名 `write\|edit` / `bash` |
| 浏览器验收 | 宿主浏览器技能 + nodeRepl | `browser-use:control-in-app-browser` + `mcp_browser` |
| 外部检索 | tavily / context7 MCP | `tavily-remote` / `context7` MCP，缺省退 `web_search` / `web_fetch` |

## 目录结构

```text
minimax/
├── .minimax-plugin/plugin.json   # 插件清单
├── icon.png / icon-dark.png      # Code 类图标（明/暗）
├── hooks/hooks.json              # UserPromptSubmit 触发器 + 三道 PreToolUse 守卫
├── hooks/README.md                # 守卫说明（触发工具 / 契约 / 关闭方式）
├── scripts/trigger.mjs           # 触发脚本（Node，fail open）
├── scripts/hooks/guard.mjs        # 三道守卫实现（secret / ownership / dangerous）
├── scripts/hooks/selftest.mjs     # 守卫契约自检（16 例）
├── scripts/*.mjs                 # 可信变更门禁脚本与 templates/、doc/（生成物：唯一正文源在仓库 shared/scripts/，v1.1.0 起由 build.mjs 回写/同步）
├── scripts/doc/                  # 文档流水线本地脚本（doc-init / doc-check / guard-naming；生成物，源 shared/scripts/doc/）
├── skills/
│   ├── steward/SKILL.md          # Tech Lead 调度手册
│   ├── steward/references/       # 文档流水线参考库（七阶段树规范 + 全量模板，与 ZCode 侧同源）
│   ├── using-steward/SKILL.md    # 技能路由（不知道用哪个入口时先读）
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

## 安装 / 更新

**① 先重建**（`minimax/` 是 `build.mjs` 的生成物，**不要直接改**；改了 `shared/` 或 `host/` 后先跑）：

```powershell
node "<repo>\zcode\scripts\build.mjs"
node "<repo>\zcode\scripts\build.mjs" --check   # 期望 exit 0 且零 warning
```

**② 再拷贝**到 `%USERPROFILE%\.minimax\plugins\steward\`：

```powershell
Copy-Item -Path "<repo>\minimax\*" -Destination "$env:USERPROFILE\.minimax\plugins\steward\" -Recurse -Force
```

> 用 `-Path` 而不是 `-LiteralPath`：后者不展开 `*`，会**静默复制 0 个文件**（报错被吞掉，看着像成功了）。

> **拷贝不会删除安装目录里的旧文件**——仓库里删掉的文件会残留。要真正镜像用 `robocopy`（退出码 0–7 为成功）：

```powershell
robocopy "<repo>\minimax" "$env:USERPROFILE\.minimax\plugins\steward" /MIR /NFL /NDL /NJH /NJS /NP
```

本地插件在**会话启动时**被扫描并载入，运行中的会话不会热加载：改动后重新拷贝，**新插件从下一个新会话起生效**（当前会话里仍是旧清单）。要立刻拿到新清单，重启 MiniMax Code 最稳。

## 配置子代理模型与思考强度

子代理的模型与档位有两个来源：**项目根 `steward.config.json` 的 `modelRouting.<role>` 优先**（跟代码一起进仓库、可评审可回滚），其次是插件默认（改完 build + 安装后**新会话**生效）。

- **可视化配置页**：MiniMax 应用面板里打开 Steward 的子代理模型配置页（Mini App）；宿主未接纳时用功能等价的本地页——在源码仓库执行 `node zcode/scripts/agent-config.mjs serve`，浏览器打开 `http://127.0.0.1:7317`（端口占用会自动换并打印实际地址）。档位下拉只列该模型真实支持的集合（实时读本机模型目录，不硬编码）；写盘走「校验 → 备份 → 写 → 复校 → 失败回滚」。
- **命令行直改**：`node zcode/scripts/agent-config.mjs set --role qa-engineer --model custom_provider:provider-f9b585/glm-5.3-flash --effort medium --scope both`（`--scope` 取 project / plugin / both）。
- **只看不改**：`node zcode/scripts/agent-config.mjs show`。
- 改插件默认后要在源码仓库跑 `node zcode/scripts/agent-config.mjs install --apply`（build + 镜像安装到本机插件目录），改动**新会话**才生效；只影响本机 MiniMax，不更新 ZCode。

## 通用 harness 安装（不装整包，只投 4 个技能）

Steward 有 4 个**宿主无关**的纯指令技能——不依赖子代理 / 斜杠命令 / hooks，正文都在本仓库 `shared/skills/` 下，任何支持「技能目录」的 harness 都可以不装整包、直接投放：`systematic-debugging`（系统化调试纪律）、`tdd`（测试先行纪律）、`verification-before-completion`（完成前验证纪律）、`project-lifecycle`（项目全生命周期规范，随包带 `references/` 与 `assets/`）。

- **项目级**（只对该仓库生效）：复制到 `<目标仓库>/.agents/skills/<技能名>/`；
- **用户级**（该机器所有项目生效）：复制到 `~/.agents/skills/<技能名>/`。DSH 原生按这两条路径发现技能；其它 harness 按各自的技能目录约定放置即可。

可复制的命令（PowerShell，项目级；`<repo>` 换成本仓库检出位置，`<目标仓库>` 换成要投放的项目）：

```powershell
$src = "<repo>\shared\skills"; $dst = "<目标仓库>\.agents\skills"
New-Item -ItemType Directory -Force "$dst" | Out-Null
'systematic-debugging','tdd','verification-before-completion','project-lifecycle' |
  ForEach-Object { Copy-Item -Path "$src\$_" -Destination "$dst\$_" -Recurse -Force }
```

用户级把 `$dst` 换成 `"$env:USERPROFILE\.agents\skills"` 即可。纯目录复制（SKILL.md + references/assets），**不需要任何 npm/npx 安装器**，新会话起生效。

## 排障

- **装了没生效**：本地插件在**会话启动时**载入、不热加载——重开会话或重启 MiniMax Code 最稳；确认装在 `%USERPROFILE%\.minimax\plugins\steward\`。
- **复制 0 个文件**：用 `-Path` 而非 `-LiteralPath`（后者不展开 `*`，会静默复制 0 个文件）；仓库里删掉的文件拷贝不会删，要镜像用 `robocopy "<repo>\minimax" "$env:USERPROFILE\.minimax\plugins\steward" /MIR`。
- **`--check` 报不一致 / 版本不一致 warning**：`minimax/` 是生成物，手改会被 `node zcode/scripts/build.mjs --check` 拦下（包内 `scripts/` 下门禁脚本与 `templates/`、`doc/` 的唯一正文源在仓库 `shared/scripts/`）；构建器要求 ZCode / MiniMax 同号，只有一侧升版会出 warning。
- **触发关键词没命中**：`UserPromptSubmit` hook 命中失败会静默放行（不阻断对话）；直接说「用 Steward 完成…」或让主代理加载 `steward:steward` 技能。

## English

Steward is a role-based engineering team plugin for MiniMax. The lead agent acts as Tech Lead, decomposes work into a task DAG with file ownership, and dispatches PM / architect / backend & frontend devs / QA / browser tester / reviewer subagents. Release 1.1.0 covers feature delivery with subagent / inline execution modes, the B0-B3 bug track, plan-only mode, the maintenance loop, takeover (T1 generation + first health scan), the evolution loop (architecture drift / duplication / refactor-ratio checks, codemod planning), on-demand T3 docs, the first-principles clarification kernel, the full docTier=3 documentation pipeline (seven-phase tree + 19 template types + naming guard / doc checks), the using-steward skill router, browser evidence contract, learning loop, trusted-change gates with a retry budget, and the maintenance health dashboard.

The bundle ships **11 skills**: `steward:steward` (Tech Lead workflow), `steward:agent-settings` (subagent model config), `steward:steward-visualizer` (optional GenUI views: task DAG, defect triage, maintenance health), `steward:inline` / `steward:docs` (on-demand splits of the main skill), `steward:docs-governance` (document governance with local `docs-gate` / `doc-snapshot` gates), `steward:project-lifecycle` (the harness-agnostic lifecycle skill), `steward:using-steward` (router), plus `steward:systematic-debugging` / `steward:tdd` / `steward:verification-before-completion`.

Trigger: the `UserPromptSubmit` hook loads the skill when the input contains "开发团队", "开发小组", or "Steward". Install by copying `minimax/` into `%USERPROFILE%\.minimax\plugins\steward\`. Local plugins are scanned when a session starts and are not hot-reloaded into a running session — a newly installed plugin becomes available from the next new session (restart MiniMax Code to pick it up immediately).

Version: 1.1.0 · License: MIT · Copyright (c) 2026 Lin
