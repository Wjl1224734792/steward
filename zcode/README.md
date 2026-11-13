# Steward · ZCode 插件

角色化研发团队插件：主对话代理担任 **Tech Lead**，把需求拆成任务 DAG，按「依赖 + 文件所有权」串行/并行派发子智能体；也可切换 inline 由 Tech Lead 自己执行低风险任务。当前版本（1.1.0）覆盖功能交付（subagent / inline 两种执行模式）、Bug 修复（B0–B3 分流）、只出计划、维护循环与接手存量，ZCode 侧含 docTier=3 完整文档流水线（七阶段树 + 全量模板 + 命名守卫/文档检查）、文档治理（`steward:docs-governance`）、项目全生命周期（`steward:project-lifecycle`）、M/L 需求澄清（第一性原理 + 提问预算）与 `steward:using-steward` 技能路由，并自带可信变更门禁、演进循环与单一正文源构建（门禁脚本单一源自 1.1.0 起在仓库 `shared/scripts/`）；演进细节见 [路线图](../docs/ROADMAP.md)。

> A role-based engineering team plugin for ZCode. Release 1.1.0 covers feature delivery with subagent / inline execution modes, the B0–B3 bug track, plan-only mode, the maintenance loop, and takeover, with a full docTier=3 documentation pipeline, a lightweight first-principles clarification step (max 3 P0 questions), and a using-steward router skill on the ZCode side, trusted-change gates, single-source generation and the evolution loop built in.

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
| （外援）Explore | 内置 `Explore` | L 级需求开工前的仓库勘察（00-context.md 共享地图） |

## 核心机制

- **六阶段流程 + 批准门**：受理定级（S/M/L）→（勘察）→ 方案（影响面 + 机读计划）→ 计划校验 + Plan Critic + 用户批准（M/L）→ 实施 → QA 质量门 → 浏览器验收 → 终审汇报。
- **串行/并行调度**：派发单位是任务不是角色名额，同类角色可多实例；并行条件 = 无依赖 且 文件所有权不相交；并行批撞并发上限自动回退串行。
- **执行模式（0.10.0）**：`execution.mode` 可选 `subagent`（默认）或 `inline`（主代理按 DAG 自己执行）；inline 仍保留计划、baseline、TDD、verify 与报告；S / B3 / 维护小修可直接使用，M 需显式开启，L 与 B0/B1/B2 禁止。
- **可信变更门禁（scripts/，本地 Node 脚本，不做 CI）**：`validate-plan.mjs` 机检计划（路径/DAG 环/所有权/AC 覆盖/测试改动声明）；`verify.mjs` 独立复跑门禁并查 flaky；`baseline record/check` 回滚锚点 + 越界 diff 守卫 + 未声明测试 diff 拦截（反作弊）；`run-state.mjs` 断点恢复、同一错误连续 2 次即停；`take-over.mjs` 生成目标项目 AGENTS.md + docs/project/（T0/T1）初稿。包内 `scripts/` 下这些脚本与 `templates/`、`doc/` 自 1.1.0 起是构建生成物（唯一正文源在仓库 `shared/scripts/`），不手改。
- **检索工具栈**：全员继承宿主 tavily（搜索/深度研究）与 Context7（库文档查证），缺省退回 WebSearch。
- **工件交接**：`tmp/steward/<run-id>/` 下 00-context / 01-requirement / 02-spec / 02-impact / 03-plan(.md/.json) / run.json / baseline.json / reports / final-report。
- **需求澄清（M/L 条件启用）**：第一性原理四问（问题/约束/备选/非目标+成功指标）+ 最多 3 个 P0 提问预算；S 级不追问；模板 `references/doc-pipeline/templates/01-REQUIREMENT.md`。
- **技能路由（0.8.1，ZCode 侧）**：不知道用哪个入口/技能时加载 `steward:using-steward`；它只做路由，不替代主技能。
- **文档流水线（docTier=3，ZCode 侧）**：`references/doc-pipeline/` 七阶段文档树全量模板（PRD/FRD/契约/页面/测试/部署）+ AGENTS/rules 约束层；`scripts/doc/` 提供 `doc-init` / `doc-check` / `guard-naming` 本地门禁（MiniMax 侧 1.6.0 同步）。
- **修复回派**：QA / 浏览器 / 评审发现的缺陷按归属回派原开发，循环上限 2 轮。

## 命令

| 命令 | 说明 |
|---|---|
| `/steward <需求>` | 功能交付全流程（六阶段） |
| `/steward:inline <需求>` | inline 执行：主代理按计划直接做，仅 S / B3 / 维护小修；M 需显式要求；L 与 B0/B1/B2 禁止 |
| `/steward:fix <Bug 描述>` | Bug 通道：B0–B3 分流 → 复现 → 失败测试 → 根因 → 最小修复 → 回归 → 记录；B0/B1 先止损并写 postmortem |
| `/steward:plan <需求>` | 只出计划：方案 → 计划校验 → Plan Critic → 用户批准，不实施 |
| `/steward:maintain [项目根]` | 维护循环：八类扫描 → 评分排序 backlog → 小修 → 更新 HEALTH |
| `/steward:take-over [项目根]` | 接手存量：扫描生成 T1 + 首轮健康扫描，先盘点后动手 |

## 安装（本地目录方式）

1. 克隆仓库到任意目录（例如 `steward/`；本插件包位于仓库的 `zcode/` 子目录）。
2. 在**同级目录**建 `marketplace.json`（示例）：

   ```json
   {
     "name": "my-local-plugins",
     "plugins": [
       {
         "name": "steward",
         "source": "./steward/zcode",
         "version": "1.1.0",
         "displayName": "Steward · 长期维护型研发团队",
         "category": "developer-tools"
       }
     ]
   }
   ```

3. ZCode → 插件市场 → 添加 → 添加插件市场，粘贴 `marketplace.json` 所在目录。
4. 个人 → 你的市场名 → Steward → 安装。
5. 新建任务试用：`/steward <需求描述>`。

## 使用

```text
/steward 给 tmp/demo 写一个金额汇总脚本，带单测并跑绿
/steward:fix 三人分账时总金额少了 1 分
/steward:plan 给后台加一个导出 CSV 的按钮
```

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

- **命令列表不对 / 入口缺失**：`zcode commands list` 应列出 5 条命令（`/steward`、`/steward:fix`、`/steward:plan`、`/steward:maintain`、`/steward:take-over`）；缺命令多半是旧版本，按上面「安装」步骤重装或升级。
- **更新 / 升级**：`zcode plugins update steward@<marketplace>`；改过 `shared/` 或 `host/zcode/` 的先在仓库跑 `node zcode/scripts/build.mjs` 重建（`zcode/` 是生成物，不手改，`--check` 会拦手改与漂移）。
- **`--check` 报不一致 / 版本不一致 warning**：`node zcode/scripts/build.mjs --check` 校验生成物与单一源一致、ZCode / MiniMax 同号；报「与 shared/scripts 版不一致」说明手改了包内脚本副本（正文源在仓库 `shared/scripts/`），报版本不一致说明只有一侧升了版，跟齐即可。
- **技能正文里的脚本表出现 `agent-config.mjs`**：那是 MiniMax 侧的配置工具（ZCode 侧子代理沿用宿主默认模型，不需要它）；它在源码仓库 `zcode/scripts/` 里，不在目标项目的技能包安装目录。

## English

Steward is a role-based engineering team plugin for ZCode. The lead agent acts as Tech Lead, decomposes work into a task DAG with file ownership, and dispatches PM / architect / backend & frontend devs / QA / browser tester / reviewer subagents. Release 1.1.0 covers feature delivery with subagent / inline execution modes (`/steward:inline`), the B0-B3 bug track (`/steward:fix`), plan-only mode (`/steward:plan`), the maintenance loop (`/steward:maintain`), takeover (`/steward:take-over`), browser evidence contract, learning loop, the evolution loop, and trusted-change gates; the ZCode side adds a full docTier=3 documentation pipeline (seven-phase tree, full templates, naming guard and doc checks), a first-principles clarification step (max 3 P0 questions for M/L), and a using-steward router skill; skills/agents are single-sourced and generated by build.mjs.

Roster: `steward:pm`, `steward:architect`, `steward:backend-dev`, `steward:frontend-dev`, `steward:qa-engineer`, `steward:browser-tester`, `steward:reviewer`.

Usage:

```text
/steward Write a money-summary script in tmp/demo, with unit tests and a green run.
/steward:fix The 3-way bill split loses one cent.
/steward:plan Add an export-CSV button to the admin panel.
```

Version: 1.1.0 · License: MIT
