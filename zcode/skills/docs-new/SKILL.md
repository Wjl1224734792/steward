---
name: docs-new
description: Steward 文档入口（ZCode）· 新建项目。触发语「新建项目」「从零开始」「初始化七阶段文档」「新项目先把文档搭起来」。只在 docTier=3 时适用：建 01-07 七阶段文档树、按 PRD→FRD→架构→契约→页面→测试→治理 顺序产出，跑 docs-ready 闭环机检、docs-review 独立审查，签发收据后 backend-dev / frontend-dev 才允许派发。Use when starting a brand-new project that needs the full seven-phase documentation baseline before any implementation.
---

<!-- 由 zcode/scripts/build.mjs 从 shared/ + host/zcode/ 生成，请勿手改；改源后重跑 build.mjs。 -->

# 文档入口 · 新建项目（docTier=3）

> 本入口负责**从零**建立七阶段文档基线；接手存量用 `steward:docs-takeover`，单个功能或需求变更用 `steward:docs-feature`，审查用 `steward:docs-review`。写作规范、SSOT 地图、联动表与模板索引在 `steward:docs-rules`，本技能只管流程与出口。
> 脚本路径约定：`<插件>` = 本技能所在插件包根目录（技能文件向上两级）。命令都在**目标项目根**跑。

## 0. 前置检查（不做完别往下）

1. 读项目根 `steward.config.json`：没有 `docTier: 3` 就停下，告诉用户「这个入口要先把 `docTier` 设成 3（会启用文档门禁：未过门禁不许派开发），要继续吗」，得到明确同意再写配置。
2. 读 `AGENTS.md` 与 `docs/project/CONSTITUTION.md`（存在才读）：红线优先于本流程。
3. 确认这是**新项目**：仓库里没有 `docs/01-需求…07-治理`。已有文档 → 换 `steward:docs-takeover`。

## 1. 声明文档范围（显式，不猜）

```bash
node <插件>/scripts/docs-gov/docs-ready.mjs <root> init --scope new --write
```

`new` 范围默认把 8 条阶段项（`01-需求` … `07-治理` + `部署`）全部标 `required`。**立刻按项目形态复核一遍**并编辑 `.steward/docs-state.json`：

- 纯后端 / 无界面 → `05-页面` 改 `na`，`reason` 写清依据（如「无 UI，只有 CLI 与 SDK」）；
- 没有算法 / AI / 规则引擎 → `04-专项` 改 `na` + 理由；
- `部署` 的 `gate` 保持 `delivery`（交付前补齐即可，不拦开发）；其余保持 `dev`。
- **不许**为了让门禁变绿去改 `required` 语义；`na` 必须能被 `docs-review` 复核。

## 2. 建树与骨架

```bash
node <插件>/scripts/doc/doc-init.mjs <root> --tier 3 --write   # 01-07 + .agents/rules + .agents/designs + docs/README.md（幂等）
node <插件>/scripts/docs-gov/docs-gate.mjs <root> init         # 07 分层（adr/ 评审记录/）+ 各域 history/ + 自动索引区块
```

同时（新建项目才做）：根 `AGENTS.md` 红线与命令速查、`README.md`、`.gitignore`、`.editorconfig`。

## 3. ① 需求（PRD → FRD）

- 模板：`references/doc-pipeline/templates/PRD.md` / `FRD.md`（在 `skills/steward/references/`；先读 `doc-pipeline/README.md` §3.1，不凭记忆写）。
- PRD：背景痛点（可量化）/ ≥3 条数字目标 / In-Out 与分期批次 / 角色权限矩阵 / FR 编号 / AC / 第一性原理四问。
- FRD：FR→FP 追溯总表 / 字段与校验 / 规则顺序 / 状态流转 / 权限与数据范围 / 异常与错误码号段 / AC↔GT 预留。
- 门禁：PRD 能让业务方判「做不做、先做哪批」；FRD 能让研发直接建实体端点、测试直接写字段级用例；**FR↔FP 无孤儿**（`docs-ready check` 会给 `W-TRACE-FR`，`--strict` 升 error，收口到 0）。

## 4. ② 架构（目录定稿 → 补全根 AGENTS）

- `架构总纲.md`（分层 / 上下文图 / 选型表 / 安全收口点）+ `{X}工程化.md`（后端 / 前端 / AI…）+ 横切域（可观测性 / 性能 / 成本）。
- 目录结构定稿后**回头补全根 `AGENTS.md`**（目录职责、命令速查、文档索引），再进 ③。

## 5. ③ 契约冻结（最关键）+ 同批起草治理件

- `03-契约/`：`数据模型.md`（ER + 可落库 DDL + 软删/审计/幂等口径）、`API接口与错误码.md`（BaseURL / 认证 / 信封 / 错误码号段 / 端点清单 / 权限）。
- 同批起草（不许拖到 ④ 之后）：编码规范（`AGENTS.md` 条款 + `.agents/rules/` 正文）、`07-治理/执行步骤.md`、`07-治理/开发顺序.md`。
- 有界面则并行 `05-页面/`：`页面设计.md`（IA + 路由表）→ **逐页布局稿**（区域 / 栅格 / 断点 / 四态 / 滚动归属）→ `页面详设-<端>.md` → 组件清单；视觉 token 只引 `.agents/designs/DESIGN.md`，不复制数值。

## 6. ⑤ 测试基线（开发前就要有，TDD 才有依据）

- `06-测试/`：`测试方案.md`（金字塔 / 工具 / 覆盖率阈值）+ `黄金集.md`（硬规则逐条：编号 | 依据 | 场景 | 输入 | 期望阻断/放行 | 错误码，期望写死数字边界）+ NFR 验证映射。
- `部署` 归属 `delivery`：本轮可以先开档记现状，交付前用 `check --gate delivery` 收口。

## 7. 闭环 + 审查 + 收据（**不绿不许开发**）

```bash
node <插件>/scripts/docs-gov/docs-ready.mjs <root> check --plan <工件>/03-plan.json   # 有阶段②计划就带上
# 清零所有 error（warning 里 W-TRACE-* 交 docs-review 复核）
```

1. 加载 `steward:docs-review` 技能，用 Agent 工具派 `steward:reviewer` **全新实例**独立评审 → 结论落 `docs/07-治理/评审记录/评审记录-YYYYMMDD-<主题>.md`（含 `docs-review` 机读块），并在 `评审状态.md` 表尾追加一行。
2. 评审通过后签发收据：

```bash
node <插件>/scripts/docs-gov/docs-ready.mjs <root> approve --review docs/07-治理/评审记录/评审记录-YYYYMMDD-<主题>.md
```

3. 收据 `ok:true` 后，PreToolUse 守卫（`guard.mjs docs` 模式）才放行 `steward:backend-dev` / `steward:frontend-dev`；`steward:architect` / `steward:reviewer` / `steward:qa-engineer` 一直可派（要留人补文档和评审）。

## 8. 出口判据

- `docs-ready status` → `READY`（`approved=true`、`stale=false`）；
- `docs-gate check` 与 `doc-check` 不因本入口新建的文档报 error；
- 阶段②计划 `validate-plan.mjs` PASS，且每个任务 `docsRead` 指向真实、`required` 的文档；
- 交付前 `docs-ready check --gate delivery` 清空 error。

## 禁止

- **不许**用空目录 / `.gitkeep` / `{{占位}}` / `待补` 交差：`E-PHASE-EMPTY`、`E-DOC-THIN`、`E-DOC-PLACEHOLDER` 会打回。
- **不许**跳 ① 直接写接口：契约必返工（见 `steward:docs-rules` §7 常见错误）。
- **不许**自写自批：`docs-review` 必须独立实例，`approve` 只认 `approved + blocking 0`。
- **不许**没收据就派开发，或改 `docTier` 去绕门禁（要绕就让用户明确改成 1/2 并记进 `05-record`）。
- 口径类文档（PRD / FRD / 架构 / 契约 / 页面 / 测试方案）改一次，收据即失效，必须重跑 §7；只改 `执行步骤.md` / `评审状态.md` / `评审记录/` 不影响收据（哈希已排除）。
