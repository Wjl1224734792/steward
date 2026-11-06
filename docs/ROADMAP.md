# Steward 路线图 2026：从「功能交付」到「长期维护」

> 状态：P0–P2 已实施（v0.5→v0.7.3，2026-11-06，含 M/L、浏览器证据、codemod、hooks 四项真实演练与 GenUI 维护健康看板设计，见 [ROADMAP-STATUS.md](ROADMAP-STATUS.md)）· 原始草案 v1
> 适用：`zcode/` 与 `minimax/` 两个宿主版本
> 依据：2025–2026 多智能体开发、规范驱动、AI 编码代理与软件演化研究（见文末参考）

---

## 0. 摘要

现在的 Steward 是一个**功能交付团队**：一个需求进来，按 DAG 派发 7 个角色，交付后结束。

下一阶段要把它变成**能长期维护和演进项目的团队**：除了功能，还要能**修 Bug、做维护、控漂移、留记忆**，并且按风险自动选择轻/重流程。

核心原则只有一句：

> **流程强度与风险成正比，证据强度与不确定性成正比。**

一个文案错别字不应该走 7 个角色；一个生产数据损坏必须走止损、根因、复盘。这两件事都需要，关键是**分流**，不是二选一。

---

## 1. 现状与缺口

### 1.1 已有能力

| 能力 | 说明 |
|---|---|
| 7 角色分工 | PM / 架构师 / 前后端 / QA / 浏览器验收 / 评审 |
| S/M/L 分档 | 小需求不走全员大会 |
| 六阶段流程 | 受理 → 方案 → 实施 → QA → 浏览器 → 终审 |
| DAG + 文件所有权 | 依赖驱动、并行批、越界约束 |
| 修复回派 | QA/浏览器/评审发现缺陷回派原开发，上限 2 轮 |
| 真实输出纪律 | 不美化、不编造 |
| 双宿主 | ZCode 与 MiniMax 各自适配 |
| 可选 GenUI | 任务 DAG、缺陷看板与维护健康看板 |

### 1.2 关键缺口

| # | 缺口 | 现状 | 后果 |
|---|---|---|---|
| 1 | **没有 Bug 通道** | 所有任务都走 feature 流程 | 小 Bug 也要 PM/架构/多角色，太重；紧急 Bug 没有止损/根因/复盘流程 |
| 2 | **没有项目记忆** | 工件只存在于单次 run | 跨会话/跨变更丢失设计意图；同一坑反复踩 |
| 3 | **没有维护循环** | 只响应需求 | 依赖/安全/重复/漂移无人管（Parnas 的 lack of movement） |
| 4 | **没有影响面分析** | 计划主要列文件 | 改 A 漏 B；ignorant surgery |
| 5 | **验证靠信任** | QA 可改测试，reviewer 主要读报告 | 假绿、测试造假、回归漏检 |
| 6 | **并行写是软约束** | 同一工作区，文件所有权靠 prompt | 语义冲突；越界事后才发现 |
| 7 | **没有漂移检测** | 文档/规格/测试与代码无一致性检查 | spec drift / doc drift |
| 8 | **没有度量** | 无成功率、返工、成本基线 | 无法证明迭代有效，容易堆功能 |

---

## 2. 第一性原理

### 2.1 项目是七层承诺

一个软件项目，本质是对未来行为的一组承诺：

| 层 | 内容 | 例子 |
|---|---|---|
| 1. Intent | 为什么做、做什么、不做什么 | 目标、范围、用户场景 |
| 2. Contract | 必须表现出的行为与不变量 | AC、API 契约、错误语义、权限 |
| 3. Structure | 如何组织以满足契约 | 模块边界、数据模型、依赖方向 |
| 4. Implementation | 代码与配置 | 源码、迁移、基础设施 |
| 5. Evidence | 凭什么相信它满足契约 | 测试、运行日志、浏览器证据、评审 |
| 6. Decision history | 为什么这样选，否决了什么 | ADR、CHANGELOG、评审记录 |
| 7. Operating knowledge | 怎么构建、运行、排障 | RUNBOOK、命令、端口、环境 |

**维护 = 在变化和熵增下，保持这七层一致。**

大多数 Bug 不是「代码写错了」，而是七层之间出现了裂缝：意图变了契约没变、契约变了实现没跟、实现变了测试没补、决策变了没人记录。

### 2.2 软件老化的两个根因

Parnas 1994 年的《Software Aging》指出：

1. **Lack of movement**：环境变了（依赖、平台、安全、业务），软件没有跟着动。
2. **Ignorant surgery**：改动的人不理解原设计，局部修补，复杂度越叠越高。

这两条正好对应 AI 维护的两个天然弱点：

- AI 倾向「完成任务」，不倾向「主动跟进环境变化」→ 第一条；
- AI 没有长期项目记忆，每次会话都可能做局部最优决策 → 第二条。

### 2.3 维护方程

把长期可维护性拆成可评估的式子：

```text
长期可维护性 =
  Legibility（可理解）
  × Verifiability（可验证）
  × Reversibility（可回滚）
  × Memory（可记忆）
  ÷ [ Coupling（耦合） × Drift（漂移） × ProcessTax（流程税） ]
```

| 项 | 含义 | 现在 | 该补什么 |
|---|---|---|---|
| **Legibility** | Agent 能否快速找到相关意图、结构、约束 | 有 00-context、DAG、文件所有权 | 项目级 AGENTS.md、架构图、术语表、repo map |
| **Verifiability** | 能否证明改对了 | QA/浏览器/评审三道门 | 独立复跑、反作弊、ARIA/console/network 证据 |
| **Reversibility** | 改错了能否低成本撤销 | 无 commit/push，改动留工作区 | 基线 hash、任务分支、可选 worktree、小步提交 |
| **Memory** | 知识能否跨会话/跨变更留存 | 只有单次 run 的 markdown | ADR、CHANGELOG、HEALTH、决策/教训库 |
| **Coupling** | 改一处会连带炸多少 | 文件所有权只是软约束 | 单写者默认、接口契约、模块边界检查 |
| **Drift** | 文档/规格/测试离代码有多远 | 没有一致性检查 | doc-code 联动检查、AC 追溯、命令/链接校验 |
| **ProcessTax** | 每次变更要付多少流程成本 | 七角色 + 六阶段，S/M/L 已缓解 | 文档分层、维护模式、Bug 分流 |

**用途**：每个新功能都问一句——它提升分子还是降低分母？只是「看起来更专业」但增加流程税的，不做。

### 2.4 四个循环

```text
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ 变更循环    │   │ 健康循环    │   │ 学习循环    │   │ 演进循环    │
│ Change      │   │ Health      │   │ Learning    │   │ Evolution   │
│ 已有        │   │ 缺          │   │ 半有        │   │ 缺          │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
```

| 循环 | 做什么 | 触发 | 现状 |
|---|---|---|---|
| **变更循环** | 一个需求/缺陷从进来到交付 | 用户提出 | 已有（六阶段） |
| **健康循环** | 主动观察依赖、安全、重复、churn、漂移、flaky、债务 | 定期/发布前 | 缺 |
| **学习循环** | 把评审发现、用户纠正、事故沉淀成规则/ADR/测试 | 每次变更后 | 半有（只回派，不沉淀） |
| **演进循环** | 架构拆分、依赖升级、迁移、废弃 API、性能/安全改造 | 规划/触发 | 缺 |

长期维护不是「把变更循环跑很多次」，而是**四个循环都转起来**。

### 2.5 行业证据

| 证据 | 结论 | 对本项目的含义 |
|---|---|---|
| **CooperBench**（2026-01） | 两个 Agent 协作成功率约 25%，比单 Agent 同时做两个任务低约一半；通信花 20% 预算但不提升成功率 | 并行写是高风险；文件所有权防不了语义冲突 |
| **MAST**（NeurIPS 2025） | 多 Agent 失败三大类：规格、Agent 间错位、任务验证；step repetition 常见 | 投资规格、状态、独立验证 |
| **Cognition**（2026-04） | 目前有效的是「单写者 + 干净上下文评审 + manager/children」 | 并行用于只读智能，写操作单线程或隔离 |
| **GitClear**（2025–2026） | AI 参与度上升，重构下降约 70%、长期维护下降 74%，重复 +81%、churn +15% | 必须显式做重构/复用/维护，否则越写越难维护 |
| **Spec Kit / Kiro** | 规范驱动有效，但 spec-first 不自动解决长期漂移；Tessl spec-as-source 也有非确定性 | 规格要配漂移检测和联动同改，不是写完就完 |
| **superpowers** | TDD、系统化、复杂度最小、证据优先；技能膨胀会拖慢简单任务 | 只取脊柱，不搬全家桶 |

---

## 3. 设计原则

1. **按风险分级**：功能 S/M/L；Bug B0–B3；维护按影响面。
2. **默认单写者**：并行只用于独立任务与只读智能。
3. **先影响面后动手**：改代码前先回答「会影响哪些意图/契约/模块/测试/文档」。
4. **项目记忆优先**：AGENTS + `docs/project/` 是长期维护的地基。
5. **证据优先**：独立复跑、exit code、ARIA/console/network；不接受「应该没问题」。
6. **可回滚**：基线 hash、任务分支、可选 worktree、小步提交。
7. **不做 GitHub CI/CD**：本地门禁脚本 + 可选 git hook；不生成 `.github/workflows`。
8. **不做角色/技能膨胀**：优先扩展现有角色 + 少量技能。
9. **文档分层 T0–T3**：按项目阶段和变更规模升级，默认不跑全套。
10. **度量驱动**：没有基线的功能不做；每个版本用 fixture 验证。

---

## 4. 运行模式

### 4.1 `/steward` — 功能交付（现有，优化）

保留 S/M/L 与六阶段，补：

- Stage 0：读 `AGENTS.md` / `docs/project/`，确定 docTier 与变更规模；
- Stage 1：architect 输出 `02-impact.md`（影响面）+ `03-plan.json`（任务 DAG）；
- Stage 1.5：Plan Critic 干净上下文审计划；M/L 暂停等用户批准；
- Stage 2：默认单写者；独立模块可用 `--worktree`；
- Stage 3：QA 独立复跑 + 反作弊；
- Stage 4：浏览器证据契约；
- Stage 5：reviewer 增量审 + 测试完整性；
- Stage 5.5：finishing：验证、总结、询问 merge/PR/保留/丢弃、清理。

### 4.2 `/steward fix` — Bug 调试与修复（新增，重点）

Bug 不应该走 feature 流程。按严重度分流：

| 等级 | 判定 | 流程 | 角色 |
|---|---|---|---|
| **B0** | 生产不可用、数据损坏、安全/资损 | **先止损**（回滚/开关/降级）→ 复现 → 根因 → 最小修复 → 回归 → 复盘 | Tech Lead + 调试开发 + QA + reviewer（+ 浏览器） |
| **B1** | 核心功能受损、有 workaround | 复现 → 根因 → 修复 → 回归 → 复盘 | Tech Lead + 调试开发 + QA/reviewer |
| **B2** | 一般缺陷、边界场景 | 复现 → 失败测试 → 根因 → 修复 → 验证 | 1 个开发 + 独立验证 |
| **B3** | 轻微、文案、样式 | 复现（可选）→ 修复 → 验证 | 1 个开发 + Tech Lead 抽查 |

> B0–B3 是 Bug 等级，和路线图的 P0/P1/P2 不是一套编号。

**六步流程：**

```text
B0 受理与定级
  - 读 Bug 报告：现象、步骤、预期/实际、环境、影响面、最近变更
  - 定级 B0–B3；B0 先止损，不在生产上调试

B1 复现
  - 确定性复现：环境、数据、步骤、日志
  - 能写失败测试就先写（红）
  - 连续 2 次无法复现 → 停，列需要补充的信息；不猜

B2 隔离与根因
  - 系统化调试：复现 → 缩小范围 → 提假设 → 验证假设 → 根因
  - 回归型 Bug 用 git bisect / 最近变更对比
  - 找到被破坏的不变量/契约；读 ADR 与架构文档
  - 产出 root-cause.md：根因、证据、影响面、为什么之前没发现

B3 修复
  - 修根因，不修症状；最小改动，不做顺手重构
  - 回归测试：先红后绿；没有可复现测试的，说明原因并加监控/守卫
  - 行为/契约/决策变化 → 同改文档与 ADR

B4 验证
  - 失败测试转绿；相关测试/lint/typecheck 全绿
  - 有 UI → 浏览器证据（ARIA/console/network；视觉问题标「视觉未验证」）
  - B0/B1 必须独立 QA；B2 至少独立复跑；B3 Tech Lead 抽查

B5 记录与学习
  - 更新 HEALTH/CHANGELOG；B0/B1 写 postmortem
  - 把教训回填 CONSTITUTION/rules/测试
  - 建立 Bug ↔ 回归测试的链接
```

**Bug 工件：**

```text
tmp/steward/<run-id>/
  bug-report.md      # 现象/步骤/预期/实际/环境/影响
  repro.md           # 最小复现 + 日志 + 失败测试
  root-cause.md      # 根因/证据/影响面/为什么没发现
  fix.md             # 改动/回归测试/验证命令
  evidence/          # 测试输出、浏览器证据、diff
  postmortem.md      # B0/B1 必填：时间线/根因/教训/行动项
```

**Bug 铁律：**

- 可复现的 Bug，没有失败测试不修；
- 修根因，不修症状；禁止 `catch { }` 吞错、禁止关闭/弱化测试；
- B0 先止损再修，止损也是变更，要记录；
- 同一区域重复出 Bug → 加不变量/测试，并回填 CONSTITUTION；
- 不把 Bug 修复伪装成「顺手重构」；需要重构就单独立项。

**Bug 指标：**

- 复现时间、修复时间、回归率、逃逸率（QA 未发现）、新增回归测试数；
- 按模块统计 Bug 密度，作为维护 backlog 的输入。

### 4.3 `/steward maintain` — 维护循环（新增）

| 步骤 | 做什么 | 产出 |
|---|---|---|
| Observe | 依赖/漏洞/重复/churn/文档漂移/架构漂移/flaky/TODO 扫描 | 原始数据 |
| Score | 风险 × 影响 ÷ 成本 | 排序后的 backlog |
| Fix small | 一次一个，单写者，证据闭环 | 修复 + 测试 |
| Record | 更新 HEALTH/CHANGELOG/DECISIONS | 维护报告 |

- 触发：用户手动、发布前、或系统计划任务；**不做 CI/CD**。
- 输出：`reports/maintenance-YYYYMMDD.md` + 更新 `HEALTH.md`。
- 大改造不在这里做，转入 `/steward` 或演进循环。

### 4.4 `/steward take-over` — 接手存量项目（新增）

- 扫描 README/文档/依赖/目录/测试/CI/部署；
- 生成 `AGENTS.md` + `docs/project/` 初稿；
- 输出盘点表（带 `file:line` 证据）与缺口清单；
- **先盘点后动手**，不做大重构；
- 需拍板项列给用户，不私改。

### 4.5 `/steward plan` — 只出计划（可选）

- 只做受理、影响面、计划、Plan Critic、批准；
- 不写代码；
- 适合 L 级/高风险/需要先对齐方案的需求。

---

## 5. 架构与工件

### 5.1 项目记忆 T0–T3

| 层 | 内容 | 何时用 | 成本 |
|---|---|---|---|
| **T0** | `AGENTS.md`（≤100 行）：定位、命令速查、红线、文档索引、DoD | 永远 | 极低 |
| **T1** | `docs/project/`：CONSTITUTION、ARCHITECTURE、DECISIONS、RUNBOOK、CHANGELOG、HEALTH | 首次接入 / 接手项目 | 低 |
| **T2** | 单次变更包：01-intent、02-impact、03-plan、04-evidence、05-record | M/L 变更 | 中 |
| **T3** | PRD/FRD、契约、页面布局、测试方案、部署工程化、阶段门禁 | 新项目/大型/合规 | 高 |

**T1 是地基，不是装饰。** 没有它，AI 每次都从零理解项目，必然 ignorant surgery。

**T3 按需升级**：在 `steward.config.json` 设 `docTier`，或 Tech Lead 在 L 级需求时提升。eng-doc-pipeline 的全套模板作为 T3 库，不是每次必跑。

### 5.2 T1 文件职责

| 文件 | 内容 | 维护时机 |
|---|---|---|
| `AGENTS.md` | 定位、命令、红线（≤1 行/条）、文档索引、DoD | 模块/命令/红线变化时 |
| `CONSTITUTION.md` | 质量/安全/架构/测试/数据访问红线；不可协商项 | 决策变化时 |
| `ARCHITECTURE.md` | 模块地图、边界、依赖方向、数据流、不变量 | 架构变化时 |
| `DECISIONS.md` | ADR 追加日志：背景/决策/备选/后果/状态 | 每个架构决策 |
| `RUNBOOK.md` | 安装/启动/测试/lint/端口/env/排障 | 命令/环境变化时 |
| `CHANGELOG.md` | 用户可见变更 | 每次交付 |
| `HEALTH.md` | 债务/风险/依赖/测试健康/漂移/待办 | 每次维护循环 |

### 5.3 变更包

```text
tmp/steward/<run-id>/
  01-intent.md        # 为什么做、做什么、不做什么、AC 编号
  02-impact.md        # 影响哪些意图/契约/模块/不变量/测试/文档/迁移/回滚
  03-plan.md          # 人类可读计划
  03-plan.json        # 机读任务 DAG（lint 的输入）
  04-evidence/        # 测试输出、浏览器证据、diff、评审
  05-record.md        # 改了什么、为什么、文档更新、决策、遗留
```

`02-impact.md` 是长期维护的关键：动手前先理解「这一刀会切到哪里」。

### 5.4 `steward.config.json`

```json
{
  "schemaVersion": 1,
  "docTier": 1,
  "commands": {
    "install": "pnpm install",
    "dev": "pnpm dev",
    "test": "pnpm test",
    "lint": "pnpm lint",
    "typecheck": "pnpm tsc --noEmit",
    "build": "pnpm build"
  },
  "services": [
    { "name": "web", "cmd": "pnpm dev", "port": 3000, "ready": "http://localhost:3000" }
  ],
  "gates": {
    "test": true,
    "lint": true,
    "typecheck": true,
    "build": false
  },
  "browser": {
    "provider": "playwright-mcp",
    "fallback": "built-in",
    "visual": "unverified"
  },
  "isolation": {
    "mode": "baseline-hash",
    "worktree": false
  },
  "maintenance": {
    "dependencies": true,
    "security": true,
    "duplication": true,
    "docDrift": true,
    "architectureDrift": true,
    "flaky": true
  }
}
```

> `provider` 优先 `playwright-mcp` / `chrome-devtools-mcp`；不可用退回内置浏览器。
> `worktree: false` 是默认；只有独立模块/高风险/长任务才临时开启。

### 5.5 角色与技能

**不新增第 8 个角色（至少 v0.5 不新增）。**

理由：

- 现有 7 角色已覆盖实现、测试、验收、评审；Bug 修复是「任务类型」差异，不是「角色」差异。
- 新增角色会增加上下文与调度成本；先用现有角色 + 技能验证。
- 如果度量显示「跨模块、难复现 Bug」占比高，再评估 `steward:debugger`。

**扩展现有角色：**

| 角色 | 增量 |
|---|---|
| `backend-dev` / `frontend-dev` | 增加「Bug 模式」：复现 → 失败测试 → 根因 → 最小修复 → 回归；禁止顺手重构 |
| `qa-engineer` | 独立复跑、反作弊、flaky 复跑、Bug 回归验证 |
| `browser-tester` | ARIA/console/network 证据；视觉问题标「视觉未验证」 |
| `reviewer` | 增量 diff、测试完整性、根因与回归测试检查、nit 上限 |
| `architect` | 增加影响面分析（`02-impact.md`）与不变量 |
| `pm` | 需求澄清增加 brainstorming：复述理解、2–3 个替代方案、关键取舍 |

**轻量技能（按需加载，不默认注入）：**

- `systematic-debugging`：复现 → 缩小 → 假设 → 验证 → 根因；
- `writing-plans`：任务拆到「一次会话可完成 + 明确验证」；
- `verification-before-completion`：声称完成前必须复跑并贴证据。

**明确不搬**：superpowers 的 40 个技能、强制 worktree、每任务 2–5 分钟硬约束。技能膨胀会拖慢简单任务。

### 5.6 证据与门禁

| 机制 | 作用 | 约束 |
|---|---|---|
| `validate-plan.mjs` | 路径存在、DAG 无环、所有权不相交、AC 覆盖、影响面完整 | Stage 1 必跑 |
| Plan Critic | 干净上下文审计划 | M/L 必跑 |
| `verify.mjs` | 探测并执行 test/lint/typecheck/build，记录 exit code/耗时/输出 | QA/reviewer 独立跑 |
| 反作弊 | 测试文件 diff 必须说明理由；禁止弱化断言；flaky 复跑 | 违者 blocking |
| 基线 hash | 派发前记录 HEAD；回收时检查所有权外 diff；回滚锚点 | 每个任务 |
| 浏览器证据 | URL/ARIA/console/network/截图；`visual: unverified` | UI 改动必跑 |
| 可选 worktree | 独立模块并行写隔离 | 默认关闭 |
| ZCode hooks | 所有权/危险命令/密钥拦截 | P2 |

**浏览器证据契约：**

```json
{
  "url": "http://localhost:3000/orders",
  "viewport": "1440x900",
  "theme": "light",
  "steps": [
    {
      "id": "AC-2",
      "action": "click 导出 CSV",
      "expected": "下载开始，文件名 orders.csv",
      "actual": "下载开始，文件名 orders.csv",
      "verdict": "pass",
      "evidence": {
        "aria": "button[name=\"导出 CSV\"]",
        "console": [],
        "network": ["GET /api/orders/export 200"],
        "screenshot": "reports/screens/export.png"
      }
    }
  ],
  "visual": "unverified"
}
```

- 判定必须引用 ARIA/DOM/console/network 等可读状态；
- 截图只作附件；
- 布局/颜色/溢出 → `visual: "unverified"`，交视觉模型或人工。

---

## 6. 路线图

### P0（v0.5）— 可信变更 + Bug 通道 MVP

> **状态（2026-11-06）：7/7 已实现并在 fixture 仓库验收通过**——逐项证据见 [ROADMAP-STATUS.md](ROADMAP-STATUS.md)。

**目标**：让每次变更可理解、可验证、可回滚；让 Bug 不再走 feature 流程。

| # | 交付 | 验收 |
|---|---|---|
| 1 | `steward.config.json` + `AGENTS.md` / `docs/project/*` 模板 + `take-over` 扫描 | 在一个 fixture 仓库生成完整 T1，命令真实可跑 |
| 2 | `tasks.json` + `validate-plan.mjs` | 成环/重叠/路径不存在/AC 未覆盖都能报错 |
| 3 | `run.json` + 恢复 + 同错误 2 次即停 | 中断后可续跑；死循环被拦住 |
| 4 | `verify.mjs` + 反作弊 + 基线 hash/越界 diff 守卫 | 改测试变绿被判 blocking；越界改动被拦；可回滚 |
| 5 | `/steward fix` MVP（B2/B3） | 一个真实 Bug：复现 → 失败测试 → 根因 → 修复 → 验证 → 记录 |
| 6 | `/steward fix` B0/B1 文档化流程 + postmortem 模板 | 演练一次：止损 → 根因 → 回归 → 复盘 |
| 7 | 计划批准门 + Plan Critic | M/L 计划未批准不实施；Critic 能指出 AC/依赖问题 |

**P0 不做**：完整维护循环、自动依赖升级、worktree 默认、T3 全套文档。

### P1（v0.6）— 维护循环 + 证据 + 学习

> **状态（2026-11-06）：6/6 已实现（其中 9 浏览器证据、12 worktree 为「规则落地、端到端演练待真实场景」）**——见 [ROADMAP-STATUS.md](ROADMAP-STATUS.md)。

| # | 交付 | 验收 |
|---|---|---|
| 8 | `/steward maintain`：依赖/安全/重复/churn/漂移/flaky/TODO 扫描 → `HEALTH.md` | 在一个项目跑出可执行的维护 backlog |
| 9 | 浏览器证据契约（Playwright/Chrome DevTools MCP → ARIA/console/network；内置浏览器兜底） | UI Bug 的 pass/fail 有可读证据；视觉问题标未验证 |
| 10 | ADR/CHANGELOG/05-record 学习循环 | 评审发现/用户纠正能回填 CONSTITUTION/rules |
| 11 | `systematic-debugging` / TDD / verification 技能 | Bug 任务能按技能执行；完成声明有证据 |
| 12 | 可选 worktree + 任务分支 + finishing | 独立模块并行不冲突；收尾可 merge/PR/保留/丢弃 |
| 13 | 模型路由 + fallback + token/轮次预算 | 限流可切 fallback；预算超限停止并报告 |

### P2（v0.7+）— 演进

> **状态（2026-11-06）：6/6 已实现（17 宿主级挂载、18 已于 v1.5.3 落地专用配方 C、实机待用户确认；16 已于 v0.7.1 补齐）**——见 [ROADMAP-STATUS.md](ROADMAP-STATUS.md)。

| # | 交付 | 验收 |
|---|---|---|
| 14 | 架构演进：模块边界/循环依赖/重复率/重构比例检查，codemod/批量改动计划 | 能发现并规划一次真实重构 |
| 15 | T3 文档按需升级（PRD/FRD、契约、页面布局、测试方案、部署） | L/合规项目可一键提升 docTier |
| 16 | 双宿主单一正文源 + 本地构建脚本（不做 CI） | 改一处生成两版；清单/frontmatter 校验通过 |
| 17 | ZCode hooks：所有权/危险命令/密钥 | 越界写入/危险命令被宿主拦截 |
| 18 | GenUI 健康/进度看板 | 健康分 / 趋势、8 类分布与 backlog 可视化 |
| 19 | Monorepo / 多服务 | 按 package 划分所有权与服务启动 |

### 明确不做

- ❌ GitHub CI/CD、`.github/workflows`；
- ❌ 默认 worktree；
- ❌ 每次变更全套 PRD/FRD/七阶段；
- ❌ 继续加角色/加技能（除非度量证明必要）；
- ❌ 追公开 benchmark 分数；
- ❌ 自动 commit/push（除非用户明确要求）。

---

## 7. 度量

| 类别 | 指标 | 目标 |
|---|---|---|
| 功能 | 交付成功率、返工轮次、人工介入次数、耗时、token、diff 大小 | 有基线，逐版改善 |
| Bug | 复现时间、修复时间、回归率、逃逸率、新增回归测试数 | 复现/修复时间下降；回归测试只增不减 |
| 维护 | 依赖过期数、漏洞数、重复率、churn、重构比例、文档漂移数、flaky 率 | 趋势不恶化 |
| 流程 | 每次变更的角色数/阶段数、流程税、成本 | 小变更不跑重流程 |

**评测方式**：`evals/fixtures/` 放 5–8 个代表性场景（小 Bug、跨文件 feature、UI 改动、重构、依赖升级、失败测试修复），每版跑一遍，结果写 `EVALS.md`。

---

## 8. 参考

### 软件演化与维护

- David Parnas, *Software Aging* (1994) — https://www.cs.kent.edu/~jmaletic/cs63902/Papers/Parnas94.pdf
- Martin Fowler, *Architecture Decision Record* — https://martinfowler.com/bliki/ArchitectureDecisionRecord.html
- Martin Fowler, *Exploring Gen AI: Spec-Driven Development* — https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
- GitClear, *The Maintainability Gap: 2026 AI Code Quality Research* — https://www.gitclear.com/the_ai_code_quality_maintainability_gap
- AGENTS.md — https://agents.md

### 多智能体与编码代理

- CooperBench, *Why Coding Agents Cannot be Your Teammates Yet* (2026-01) — https://cooperbench.com
- MAST, *Why Do Multi-Agent LLM Systems Fail?* (NeurIPS 2025) — https://arxiv.org/abs/2503.13657
- Cognition, *Multi-Agents: What's Actually Working* (2026-04) — https://cognition.com/blog/multi-agents-working
- Anthropic, *How we built our multi-agent research system* — https://www.anthropic.com/engineering/multi-agent-research-system

### 规范驱动与工具

- GitHub Spec Kit — https://github.com/github/spec-kit
- AWS Kiro — https://kiro.dev/docs/specs
- BMAD-METHOD — https://github.com/bmad-code-org/BMAD-METHOD
- superpowers — https://github.com/obra/superpowers
- Playwright MCP — https://playwright.dev/mcp/introduction

### 本项目参考技能

- `eng-doc-pipeline`：`E:\CodeStore\有灵\.agents\skills\eng-doc-pipeline`
  - 保留脊柱：SSOT、联动同改、门禁、变更先拍板后落档；
  - 分层减重：T0–T3，不默认跑全套。

---

## 9. 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-11-06 | v1 | 初稿：现状/第一性原理/维护方程/四循环/Bug 通道/T0–T3/路线图/度量 |
| 2026-11-06 | v1.1 | P0（v0.5）实施完成：7/7 项交付并验收，状态与证据见 ROADMAP-STATUS.md |
| 2026-11-06 | v1.2 | P1（v0.6）实施完成：6/6 项交付（9/12 为规则落地），状态与证据见 ROADMAP-STATUS.md |
| 2026-11-06 | v1.3 | P2（v0.7）实施完成：6/6 项交付（16/17/18 为部分实现或待宿主实测），P0–P2 全部落地 |
| 2026-11-06 | v1.4 | v0.7.1：P2 项 16 补齐——技能/agent 正文单一源化（shared/ + host/ → build.mjs 生成），生成一致性校验落地 |
| 2026-11-06 | v1.5 | v0.7.2：四项能力演练完成（M/L 批准门+Critic、浏览器证据、codemod 分批、hooks 守卫）；演练发现并修复 verify.mjs 自动探测缺陷与 guard 输出契约问题 |
| 2026-11-06 | v1.6 | v0.7.3：GenUI 维护健康看板专用配方 C（健康分/分级/趋势/8 类矩阵/排序 backlog）+ 完整示例与本地视觉验收；data-schema 增加 history 与展示口径派生值 |
