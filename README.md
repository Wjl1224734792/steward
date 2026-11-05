# Steward · 长期维护型研发团队

> 不只是把需求写完，而是让项目在每次变更后仍然可理解、可验证、可回滚、可继续演进。
>
> More than shipping features: keep the project understandable, verifiable, reversible, and evolvable after every change.

[中文](#中文) | [English](#english)

---

## 中文

### Steward 是什么

Steward 是面向 ZCode / MiniMax 的多角色研发团队插件。主对话代理担任 **Tech Lead**，把需求拆成任务 DAG，按「依赖 + 文件所有权」调度子智能体。当前版本覆盖功能交付；路线图覆盖 Bug 修复、维护循环与接手存量项目。

### 工作模式

| 模式 | 命令 | 状态 |
|---|---|---|
| 功能交付 | `/steward <需求>` | 0.4.3 可用 |
| Bug 修复 | `/steward fix <Bug>` | 路线图 v0.5 |
| 只出计划 | `/steward plan <需求>` | 路线图 v0.5 |
| 维护循环 | `/steward maintain` | 路线图 v0.6 |
| 接手存量 | `/steward take-over` | 路线图 v0.6 |

当前版本实现功能交付：受理定级（S/M/L）→ 方案 → 实施 → QA → 浏览器验收 → 终审。Bug / 维护 / 接手的完整设计见 [docs/ROADMAP.md](docs/ROADMAP.md)。

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
- **S/M/L 分档**：小需求不走全员大会。
- **工件交接**：`tmp/steward/<run-id>/`，不在 prompt 里转述长文。
- **三道质量门**：QA → 浏览器验收（有 UI）→ 评审；缺陷按归属回派，最多 2 轮。
- **真实输出**：不美化、不编造；失败就是失败。

### 目录结构

```text
steward/
├── zcode/                 # ZCode 插件包
├── minimax/               # MiniMax 插件包
├── docs/
│   ├── README.md
│   └── ROADMAP.md         # 2026 路线图
└── README.md
```

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
      "version": "0.4.3",
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

- [docs/ROADMAP.md](docs/ROADMAP.md)
- 重点：Bug 通道（B0–B3）、维护循环、项目记忆 T0–T3、影响面分析、独立验证、可选 worktree、浏览器 accessibility tree 证据。

### 从 dev-team 更名

Steward 是原 `dev-team` 插件的更名版本。插件 ID、命令、agent 前缀、技能命名空间均已更新为 `steward`；旧版本可卸载后安装新版本。

---

## English

### What is Steward

Steward is a role-based engineering team plugin for ZCode and MiniMax. The lead agent acts as **Tech Lead**, decomposes work into a task DAG with file ownership, and dispatches specialist subagents. The current release covers feature delivery; bug fixing, maintenance loops, and taking over existing projects are on the roadmap.

### Modes

| Mode | Command | Status |
|---|---|---|
| Feature delivery | `/steward <request>` | Available in 0.4.3 |
| Bug fix | `/steward fix <bug>` | Roadmap v0.5 |
| Plan only | `/steward plan <request>` | Roadmap v0.5 |
| Maintenance | `/steward maintain` | Roadmap v0.6 |
| Takeover | `/steward take-over` | Roadmap v0.6 |

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
- **S/M/L sizing**: small changes do not trigger the full team.
- **Artifact handoff**: `tmp/steward/<run-id>/`; no long prose in prompts.
- **Three quality gates**: QA → browser acceptance (when UI) → review; defects are routed back, at most two rounds.
- **Evidence over claims**: real output only; no polishing, no fabrication.

### Repository layout

```text
steward/
├── zcode/                 # ZCode plugin package
├── minimax/               # MiniMax plugin package
├── docs/
│   ├── README.md
│   └── ROADMAP.md         # 2026 roadmap
└── README.md
```

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
      "version": "0.4.3",
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

- [docs/ROADMAP.md](docs/ROADMAP.md)
- Highlights: bug track (B0–B3), maintenance loop, project memory T0–T3, impact analysis, independent verification, optional worktree, accessibility-tree browser evidence.

### Renamed from dev-team

Steward is the renamed version of the `dev-team` plugin. The plugin ID, command, agent prefix, and skill namespace are now `steward`; uninstall the old version before installing the new one.

### License

MIT
