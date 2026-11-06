# Steward · 长期维护型研发团队

> 不只是把需求写完，而是让项目在每次变更后仍然可理解、可验证、可回滚、可继续演进。
>
> More than shipping features: keep the project understandable, verifiable, reversible, and evolvable after every change.

[中文](#中文) | [English](#english)

---

## 中文

### Steward 是什么

Steward 是面向 ZCode / MiniMax 的多角色研发团队插件。主对话代理担任 **Tech Lead**，把需求拆成任务 DAG，按「依赖 + 文件所有权」调度子智能体。当前版本（ZCode 0.8.2 / MiniMax 1.6.2）覆盖功能交付、Bug 修复（B0–B3 分流）、只出计划、维护循环、接手存量与演进循环；v0.8 起双宿主共享 docTier=3 完整文档流水线（七阶段文档树 + PRD/FRD/契约/页面/测试/部署全量模板 + 命名守卫与文档检查）与 M/L 需求的第一性原理澄清/提问预算，v0.8.1 起双宿主共享 `steward:using-steward` 技能路由，技能/agent 正文单一源生成，MiniMax 另附带维护健康看板等可选 GenUI 视图。

### 工作模式

| 模式 | 命令 | 状态 |
|---|---|---|
| 功能交付 | `/steward <需求>` | 0.6.0 可用 |
| 需求澄清 | 随 `/steward`（M/L/二义） | 0.8.0 起双宿主可用（第一性原理四问 + 最多 3 个 P0；S 级不追问） |
| Bug 修复 | `/steward:fix <Bug>` | 0.5.0 可用（ZCode 命令；MiniMax 用自然语言触发） |
| 只出计划 | `/steward:plan <需求>` | 0.5.0 可用（ZCode 命令；MiniMax 用自然语言触发） |
| 维护循环 | `/steward:maintain` | 0.6.0 可用（`maintain.mjs` 扫描 + backlog；MiniMax 用自然语言触发） |
| 接手存量 | `/steward:take-over` | 0.7.0 可用（扫描生成 T1 + 首轮健康扫描；MiniMax 用自然语言触发） |
| 文档流水线 | `docTier: 3`（随 `/steward`） | 0.8.0 起双宿主可用（七阶段树 + 全量模板 + 文档检查；MiniMax 1.6.0 同步） |
| 技能路由 | 加载 `steward:using-steward` | 0.8.1 起双宿主可用（不知道用哪个入口/技能时先做路由） |

功能交付：受理定级（S/M/L）→ 方案 → 批准门 → 实施 → QA → 浏览器验收 → 终审 → 收尾。Bug 修复按严重度分流：B2/B3 走「复现 → 失败测试 → 根因 → 最小修复 → 回归 → 记录」，B0/B1 增加止损与 postmortem 复盘。只出计划：方案 → 计划校验 → Plan Critic → 用户批准后停止，不实施。维护循环：八类扫描（依赖/安全/重复/churn/文档漂移/循环依赖/flaky/TODO/重构比例）→ 评分排序 backlog → 小修 → 更新 HEALTH。接手：扫描生成 T1 项目记忆 + 首轮健康扫描，先盘点后动手。演进与 T3/文档流水线见 [docs/ROADMAP.md](docs/ROADMAP.md)。

### 团队名册（7 角色 + 外援）

| 角色 | 派发名 | 职责 |
|---|---|---|
| 需求分析师 | `steward:pm` | 模糊需求 → 可测规格 |
| 架构师 | `steward:architect` | 规格 → 技术方案 + 任务 DAG |
| 后端工程师 | `steward:backend-dev` | 按任务单 TDD 实施 |
| 前端工程师 | `steward:frontend-dev` | 实施 UI + 验收脚本 |
| 测试工程师 | `steward:qa-engineer` | 测试 / lint / typecheck 质量门 |
| 浏览器验收员 | `steward:browser-tester` | 真实浏览器黑盒验收 |
| 代码评审员 | `steward:reviewer` | 终审 diff，三级意见 |
| 外援 Explore | 内置 | L 级开工前仓库勘察 |

### 核心机制

- **任务 DAG + 文件所有权**：并行条件 = 无依赖 且 文件所有权不相交。
- **S/M/L 分档**：小需求不走全员大会；M/L 过计划批准门（干净上下文 Plan Critic + 用户批准）。
- **可信变更门禁（v0.5）**：`validate-plan.mjs` 机检计划（路径存在 / DAG 无环 / 所有权不相交 / AC 覆盖 / 测试改动须声明理由）；`verify.mjs` 独立复跑测试/lint/typecheck（支持 `--repeat` 查 flaky）；`baseline record/check` 记回滚锚点并拦截越界 diff；`run-state.mjs` 断点恢复 + 同一错误连续 2 次即停 + 失败重试预算。全部为本地 Node 脚本，不做 CI。
- **Bug 通道（v0.5）**：B0–B3 分级；可复现 Bug 无失败测试不修；反作弊（测试 diff 须声明理由、弱化断言判 blocking）。
- **维护循环（v0.6）**：`maintain.mjs` 八类扫描（依赖/安全/重复/churn/文档漂移/循环依赖/flaky/TODO）→ 评分排序 backlog → 小修闭环 → 更新 HEALTH.md。
- **浏览器证据契约（v0.6）**：`browser-evidence.json`——每步判定引用 ARIA/DOM/console/network/URL 可读状态；优先 Playwright / Chrome DevTools MCP，退内置浏览器；布局/颜色类问题标「视觉未验证」，截图只作附件。
- **学习循环（v0.6）**：05-record 回填——评审发现/事故教训/用户纠正沉淀到 CONSTITUTION / ADR / RUNBOOK / HEALTH。
- **轻量技能（v0.6）**：`systematic-debugging`、`tdd`、`verification-before-completion`，按需加载不默认注入。
- **技能路由（v0.8.1，ZCode 侧）**：不知道用哪个入口/技能时加载 `steward:using-steward`；它只做路由，不替代主技能。
- **项目记忆（v0.5）**：`take-over.mjs` 可为目标项目生成 AGENTS.md + `docs/project/` 七件套初稿（T0/T1）。
- **工件交接**：`tmp/steward/<run-id>/`，不在 prompt 里转述长文。
- **三道质量门**：QA → 浏览器验收（有 UI）→ 评审；缺陷按归属回派，最多 2 轮。
- **真实输出**：不美化、不编造；失败就是失败。

### 目录结构

```text
steward/
├── shared/                # 唯一正文源：技能 / agent 共享正文（含 @@SLOT@@ 宿主槽位）
├── host/{zcode,minimax}/  # 宿主片段：frontmatter、派发机制、模型表、浏览器操作方式等
├── zcode/                 # ZCode 插件包（技能/agent 由 build.mjs 生成）
├── minimax/               # MiniMax 插件包（技能/agent 由 build.mjs 生成）
├── docs/
│   ├── README.md
│   ├── ROADMAP.md         # 2026 路线图
│   └── ROADMAP-STATUS.md  # 路线图交付状态与证据
└── README.md
```

> 维护者注意：技能与 agent 正文只改 `shared/`（共享部分）或 `host/<宿主>/`（宿主差异），然后运行 `node zcode/scripts/build.mjs` 生成两版；`--check` 会拦住手改与漂移。插件安装目录不需要也不应运行该脚本。

### 安装

#### ZCode

1. 克隆仓库到任意目录（例如 `steward/`）。
2. 在仓库同级建 `marketplace.json`，`source` 指向你克隆后的 `zcode/` 目录：

```json
{
  "name": "my-local-plugins",
  "plugins": [
    {
      "name": "steward",
      "source": "./steward/zcode",
      "version": "0.8.2",
      "displayName": "Steward · 长期维护型研发团队",
      "category": "developer-tools"
    }
  ]
}
```

3. ZCode → 插件市场 → 添加插件市场，粘贴 `marketplace.json` 所在目录。
4. 安装 **Steward**。
5. 新任务输入 `/steward <需求>`。

#### MiniMax

把 `minimax/` 复制到 `%USERPROFILE%\.minimax\plugins\steward\`：

```powershell
Copy-Item -LiteralPath "<repo>\minimax\*" -Destination "$env:USERPROFILE\.minimax\plugins\steward\" -Recurse -Force
```

输入包含「开发团队 / 开发小组 / Steward」时，`UserPromptSubmit` Hook 自动加载技能；也可以直接描述需求。

### 使用

```text
/steward 给 tmp/demo 写一个金额汇总脚本，带单测并跑绿
```

### 路线图

- [docs/ROADMAP.md](docs/ROADMAP.md) · 交付状态：[docs/ROADMAP-STATUS.md](docs/ROADMAP-STATUS.md)
- 已实现（v0.5）：Bug 通道（B0–B3）、计划批准门 + Plan Critic、计划校验 / 独立验证 / 基线守卫、run.json 断点恢复、T0/T1 项目记忆生成。
- 已实现（v0.6）：维护循环（maintain.mjs 八类扫描）、浏览器证据契约、学习循环（05-record 回填）、systematic-debugging / TDD / verification 三个轻量技能、可选 worktree + finishing、模型路由 + 重试预算。
- 已实现（v0.7）：接手存量（take-over 扫描 + 首轮健康扫描）、演进循环（重构比例 / codemod 计划）、T3 模板六件按需升级、双宿主本地构建（build.mjs 单一正文源 + 校验）、可选宿主守卫 hooks（所有权/危险命令/密钥）、GenUI 维护健康看板（专用配方 C）、monorepo/多服务口径。
- 已实现（v0.8）：文档流水线完整吸收——七阶段 `docs/01..07` 树、19 类模板 + T2 需求/证据/记录模板、AGENTS/rules 约束层、命名守卫与文档检查本地脚本（`scripts/doc/`）；需求澄清内核（第一性原理四问 + 最多 3 个 P0 提问预算，S 级不追问）；worktree 多分支合并演练 6/6 PASS；taskboard 两处 non-blocking 清理（过滤竞态 + Cache-Control）22/22。文档流水线与澄清内核自 MiniMax 1.6.0 起由 build.mjs 同步到双宿主。
- 已实现（v0.8.1）：`steward:using-steward` 技能路由——不知道用哪个入口/技能时，先路由到功能交付 / Bug / 只出计划 / 维护 / 接手 / 文档流水线，并提示何时加载 debugging / TDD / 完成前验证；MiniMax 侧自 1.6.2 起同步（路由表按宿主适配：ZCode 斜杠命令 / MiniMax 自然语言）。
- 重点（后续）：MiniMax 宿主 GenUI 实机验收。

### 从 dev-team 更名

Steward 是原 `dev-team` 插件的更名版本。插件 ID、命令、agent 前缀、技能命名空间均已更新为 `steward`；旧版本可卸载后安装新版本。

---

## English

### What is Steward

Steward is a role-based engineering team plugin for ZCode and MiniMax. The lead agent acts as **Tech Lead**, decomposes work into a task DAG with file ownership, and dispatches specialist subagents. The current release (ZCode 0.8.2 / MiniMax 1.6.2) covers feature delivery, bug fixing (B0-B3 triage), plan-only mode, the maintenance loop, takeover (T1 generation + first health scan), and the evolution loop; both hosts share the full docTier=3 documentation pipeline (seven-phase docs tree + full PRD/FRD/contract/page/test/deployment templates + naming guard and doc checks) plus a first-principles clarification step with a 3-question P0 budget for M/L requests, plus a using-steward router skill on both hosts, with optional MiniMax GenUI views for the task DAG, defect triage, and maintenance health.

### Modes

| Mode | Command | Status |
|---|---|---|
| Feature delivery | `/steward <request>` | Available in 0.6.0 |
| Clarification | with `/steward` (M/L/ambiguous) | Available in 0.8.0+ on both hosts (first-principles four questions + max 3 P0 questions; S-level skips) |
| Bug fix | `/steward:fix <bug>` | Available in 0.5.0 (ZCode command; on MiniMax trigger by natural language) |
| Plan only | `/steward:plan <request>` | Available in 0.5.0 (ZCode command; on MiniMax trigger by natural language) |
| Maintenance | `/steward:maintain` | Available in 0.6.0 (`maintain.mjs` scan + backlog; on MiniMax trigger by natural language) |
| Takeover | `/steward:take-over` | Available in 0.7.0+ (T1 generation + first health scan; on MiniMax trigger by natural language) |
| Documentation pipeline | `docTier: 3` (with `/steward`) | Available in 0.8.0+ on both hosts (seven-phase tree + full templates + doc checks; MiniMax synced in 1.6.0) |
| Skill routing | load `steward:using-steward` | Available in 0.8.1+ on both hosts (route to the right mode when unsure which entry point/skill to use) |

Feature delivery: intake & sizing (S/M/L) → plan → approval gate → implementation → QA → browser acceptance → final review → finishing. Bug fixes are triaged by severity: B2/B3 follow "repro → failing test → root cause → minimal fix → regression → record"; B0/B1 add mitigation-first and a postmortem. Plan-only mode stops after the approval gate — no implementation. Maintenance: an eight-category scan (deps / security / duplication / churn / doc drift / cycles / flaky / TODO) → scored backlog → small fixes → HEALTH.md updates. Full design: [docs/ROADMAP.md](docs/ROADMAP.md).

### Roster (7 roles + Explore)

| Role | Dispatch name | Responsibility |
|---|---|---|
| Requirements analyst | `steward:pm` | Vague request → testable spec |
| Architect | `steward:architect` | Spec → technical plan + task DAG |
| Backend dev | `steward:backend-dev` | TDD implementation within file ownership |
| Frontend dev | `steward:frontend-dev` | UI implementation + acceptance script |
| QA engineer | `steward:qa-engineer` | Test / lint / typecheck gate |
| Browser tester | `steward:browser-tester` | Black-box browser acceptance |
| Reviewer | `steward:reviewer` | Final diff review, three severity levels |
| Explore (external) | built-in | Repository reconnaissance for L-sized work |

### Core mechanics

- **Task DAG + file ownership**: parallel only when there is no dependency and file sets are disjoint.
- **S/M/L sizing**: small changes do not trigger the full team; M/L go through the plan approval gate (clean-context Plan Critic + user approval).
- **Trusted-change gates (v0.5)**: `validate-plan.mjs` machine-checks the plan (paths exist / DAG acyclic / ownership disjoint / AC coverage / test changes must declare a reason); `verify.mjs` independently reruns test/lint/typecheck (`--repeat` detects flaky); `baseline record/check` records a rollback anchor and blocks out-of-bounds diffs; `run-state.mjs` resumes interrupted runs, stops after the same error twice, and enforces a retry budget. Local Node scripts only — no CI.
- **Bug track (v0.5)**: B0–B3 severity; a reproducible bug is not fixed without a failing test; anti-cheating (undeclared test diffs and weakened assertions are blocking).
- **Maintenance loop (v0.6)**: `maintain.mjs` scans eight categories (deps / security / duplication / churn / doc drift / cycles / flaky / TODO) → scored backlog → small fixes with evidence → HEALTH.md updates.
- **Browser evidence contract (v0.6)**: `browser-evidence.json` — every verdict cites readable state (ARIA/DOM/console/network/URL); Playwright / Chrome DevTools MCP first, built-in browser as fallback; layout/color findings are marked "visually unverified"; screenshots are attachments only.
- **Learning loop (v0.6)**: 05-record backfill — review findings, incident lessons, and user corrections are persisted into CONSTITUTION / ADRs / RUNBOOK / HEALTH.
- **Lightweight skills (v0.6)**: `systematic-debugging`, `tdd`, `verification-before-completion` — loaded on demand, never injected by default.
- **Skill router (v0.8.1, ZCode side)**: load `steward:using-steward` when the user is unsure which entry point or skill to use; it only routes, never replaces the main skill.
- **Project memory (v0.5)**: `take-over.mjs` drafts AGENTS.md + the seven `docs/project/` files (T0/T1) for a target project.
- **Artifact handoff**: `tmp/steward/<run-id>/`; no long prose in prompts.
- **Three quality gates**: QA → browser acceptance (when UI) → review; defects are routed back, at most two rounds.
- **Evidence over claims**: real output only; no polishing, no fabrication.

### Repository layout

```text
steward/
├── shared/                # Single source: shared skill / agent bodies (with @@SLOT@@ markers)
├── host/{zcode,minimax}/  # Host fragments: frontmatter, dispatch mechanics, model table, browser ops
├── zcode/                 # ZCode plugin package (skills/agents generated by build.mjs)
├── minimax/               # MiniMax plugin package (skills/agents generated by build.mjs)
├── docs/
│   ├── README.md
│   ├── ROADMAP.md         # 2026 roadmap
│   └── ROADMAP-STATUS.md  # Delivery status with evidence
└── README.md
```

> Maintainer note: edit only `shared/` (common prose) or `host/<host>/` (host deltas), then run `node zcode/scripts/build.mjs` to regenerate both hosts; `--check` catches hand edits and drift. Installed plugin copies do not need and should not run the build script.

### Installation

#### ZCode

1. Clone the repository (for example into `steward/`).
2. Create `marketplace.json` next to the repository; point `source` at your cloned `zcode/` directory:

```json
{
  "name": "my-local-plugins",
  "plugins": [
    {
      "name": "steward",
      "source": "./steward/zcode",
      "version": "0.8.2",
      "displayName": "Steward — long-lived engineering team",
      "category": "developer-tools"
    }
  ]
}
```

3. ZCode → Plugin Marketplace → Add Marketplace, and paste the directory containing `marketplace.json`.
4. Install **Steward**.
5. Start a new task with `/steward <request>`.

#### MiniMax

Copy `minimax/` into `%USERPROFILE%\.minimax\plugins\steward\`:

```powershell
Copy-Item -LiteralPath "<repo>\minimax\*" -Destination "$env:USERPROFILE\.minimax\plugins\steward\" -Recurse -Force
```

When the input contains "开发团队", "开发小组", or "Steward", the `UserPromptSubmit` hook loads the skill automatically.

### Usage

```text
/steward Write a money-summary script in tmp/demo, with unit tests and a green run.
```

### Roadmap

- [docs/ROADMAP.md](docs/ROADMAP.md) · Delivery status: [docs/ROADMAP-STATUS.md](docs/ROADMAP-STATUS.md)
- Shipped in v0.5: bug track (B0–B3), plan approval gate + Plan Critic, plan validation / independent verification / baseline guard, resumable run state, T0/T1 project memory generation.
- Shipped in v0.6: maintenance loop (eight-category scan), browser evidence contract, learning loop (05-record backfill), systematic-debugging / TDD / verification skills, optional worktree + finishing, model routing + retry budget.
- Shipped in v0.7: takeover (T1 generation + first health scan), evolution loop (refactor-ratio check, codemod planning), six on-demand T3 templates, local dual-host build (build.mjs single source + validation), optional host guards (ownership / dangerous commands / secrets), GenUI maintenance health dashboard (dedicated recipe C), monorepo / multi-service guidance.
- Shipped in v0.8: full documentation pipeline — seven-phase `docs/01..07` tree, 19 template types + T2 requirement/evidence/record templates, AGENTS/rules constraint layer, naming guard and doc checks as local scripts (`scripts/doc/`); first-principles clarification kernel (four questions + a max-3 P0 question budget, S-level skips); worktree multi-branch merge drill 6/6 PASS; taskboard two non-blocking leftovers cleaned up (filter race + Cache-Control), fixture 22/22. The docs pipeline and clarification kernel are synced to both hosts by build.mjs since MiniMax 1.6.0.
- Shipped in v0.8.1: `steward:using-steward` router — when unsure which entry point/skill to use, route to feature delivery / bug / plan-only / maintenance / takeover / docs, and point to debugging / TDD / verification before completion; the MiniMax side is synced since 1.6.2 (routing table adapts per host: ZCode slash commands / MiniMax natural language).
- Next: MiniMax-host GenUI verification.

### Renamed from dev-team

Steward is the renamed version of the `dev-team` plugin. The plugin ID, command, agent prefix, and skill namespace are now `steward`; uninstall the old version before installing the new one.

### License

MIT
