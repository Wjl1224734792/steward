# Steward · 长期维护型研发团队

> 不只是把需求写完，而是让项目在每次变更后仍然可理解、可验证、可回滚、可继续演进。
>
> More than shipping features: keep the project understandable, verifiable, reversible, and evolvable after every change.

[中文](#中文) | [English](#english)

---

## 中文

### Steward 是什么

Steward 是面向 ZCode / MiniMax 的多角色研发团队插件。主对话代理担任 **Tech Lead**，把需求拆成任务 DAG，按「依赖 + 文件所有权」调度子智能体。当前版本（ZCode 0.7.1 / MiniMax 1.5.1）覆盖功能交付、Bug 修复（B0–B3 分流）、只出计划、维护循环、接手存量与演进循环；技能/agent 正文单一源生成。

### 工作模式

| 模式 | 命令 | 状态 |
|---|---|---|
| 功能交付 | `/steward <需求>` | 0.6.0 可用 |
| Bug 修复 | `/steward fix <Bug>` | 0.5.0 可用（ZCode 命令；MiniMax 用自然语言触发） |
| 只出计划 | `/steward plan <需求>` | 0.5.0 可用（ZCode 命令；MiniMax 用自然语言触发） |
| 维护循环 | `/steward maintain` | 0.6.0 可用（`maintain.mjs` 扫描 + backlog；MiniMax 用自然语言触发） |
| 接手存量 | `/steward take-over` | 0.7.0 可用（扫描生成 T1 + 首轮健康扫描；MiniMax 用自然语言触发） |

功能交付：受理定级（S/M/L）→ 方案 → 批准门 → 实施 → QA → 浏览器验收 → 终审 → 收尾。Bug 修复按严重度分流：B2/B3 走「复现 → 失败测试 → 根因 → 最小修复 → 回归 → 记录」，B0/B1 增加止损与 postmortem 复盘。只出计划：方案 → 计划校验 → Plan Critic → 用户批准后停止，不实施。维护循环：八类扫描（依赖/安全/重复/churn/文档漂移/循环依赖/flaky/TODO/重构比例）→ 评分排序 backlog → 小修 → 更新 HEALTH。接手：扫描生成 T1 项目记忆 + 首轮健康扫描，先盘点后动手。演进与 T3 见 [docs/ROADMAP.md](docs/ROADMAP.md)。

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
      "version": "0.7.1",
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
- 已实现（v0.7）：接手存量（take-over 扫描 + 首轮健康扫描）、演进循环（重构比例 / codemod 计划）、T3 模板六件按需升级、双宿主本地构建（build.mjs 单一正文源 + 校验）、可选宿主守卫 hooks（所有权/危险命令/密钥）、GenUI 维护看板契约、monorepo/多服务口径。
- 重点（后续）：技能/agent 正文单一源化（当前以 build.mjs 漂移报告兜底）、浏览器证据与 worktree 合并的真实场景演练。

### 从 dev-team 更名

Steward 是原 `dev-team` 插件的更名版本。插件 ID、命令、agent 前缀、技能命名空间均已更新为 `steward`；旧版本可卸载后安装新版本。

---

## English

### What is Steward

Steward is a role-based engineering team plugin for ZCode and MiniMax. The lead agent acts as **Tech Lead**, decomposes work into a task DAG with file ownership, and dispatches specialist subagents. The current release (ZCode 0.7.0 / MiniMax 1.5.0) covers feature delivery, bug fixing (B0-B3 triage), plan-only mode, the maintenance loop, and takeover (T1 generation + first health scan).

### Modes

| Mode | Command | Status |
|---|---|---|
| Feature delivery | `/steward <request>` | Available in 0.6.0 |
| Bug fix | `/steward fix <bug>` | Available in 0.5.0 (ZCode command; on MiniMax trigger by natural language) |
| Plan only | `/steward plan <request>` | Available in 0.5.0 (ZCode command; on MiniMax trigger by natural language) |
| Maintenance | `/steward maintain` | Available in 0.6.0 (`maintain.mjs` scan + backlog; on MiniMax trigger by natural language) |
| Takeover | `/steward take-over` | Available in 0.7.0+ (T1 generation + first health scan; on MiniMax trigger by natural language) |

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
      "version": "0.7.1",
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
- Shipped in v0.7: takeover (T1 generation + first health scan), evolution loop (refactor-ratio check, codemod planning), six on-demand T3 templates, local dual-host build (build.mjs single source + validation), optional host guards (ownership / dangerous commands / secrets), GenUI maintenance dashboard contract, monorepo / multi-service guidance.
- Next: single-sourcing the skill/agent prose (currently drift-reported by build.mjs), real-scenario drills for browser evidence and worktree merges.
- Next (v0.7+): architecture evolution checks, T3 doc upgrades on demand, single-source dual-host build, ZCode hooks, GenUI dashboard, monorepo support.

### Renamed from dev-team

Steward is the renamed version of the `dev-team` plugin. The plugin ID, command, agent prefix, and skill namespace are now `steward`; uninstall the old version before installing the new one.

### License

MIT
