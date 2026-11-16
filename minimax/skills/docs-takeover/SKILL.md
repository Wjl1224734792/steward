---
name: docs-takeover
description: Steward 文档入口（MiniMax Code）· 接手存量项目。触发语「接手这个仓库」「存量项目补文档」「先盘点再补文档」「给老项目建文档基线」。只在 docTier=3 时适用：先 take-over.mjs 生成 T1 并盘点落位，再按 01→07 补齐缺口，跑 docs-ready 闭环与 docs-review 独立审查，签发收据后开发才可派发。Use when taking over an existing repository whose documentation is missing, scattered or unclassified and a T3 baseline has to be established before implementation continues.
---

<!-- 由 zcode/scripts/build.mjs 从 shared/ + host/minimax/ 生成，请勿手改；改源后重跑 build.mjs。 -->

# 文档入口 · 接手存量项目（docTier=3）

> 本入口负责**把存量仓库的文档盘清楚、归位、补齐**；从零建项目用 `steward:docs-new`，单个功能或需求变更用 `steward:docs-feature`，审查用 `steward:docs-review`。写作规范、SSOT 地图与联动表在 `steward:docs-rules`。
> 脚本路径约定：`<插件>` = 本技能所在插件包根目录（技能文件向上两级）。
> 宿主说明（MiniMax Code）：没有斜杠命令入口，入口靠自然语言加载本技能；派子代理用 `task` 工具（`agent_name="steward:<角色>"`），派单正文必须自包含。

## 0. 前置（先盘点，后动手）

1. `steward.config.json` 设 `docTier: 3`（或按用户明确要求；没同意就先别改）。
2. 生成 T1 初稿并**逐条确认占位符**：

```bash
node <插件>/scripts/take-over.mjs <root>            # 只扫描，出盘点报告（推荐先跑）
node <插件>/scripts/take-over.mjs <root> --write    # 生成 AGENTS.md + docs/project/ 六件（缺什么补什么，不覆盖）
```

探测不到的项会留 `{{...}}` / `TODO(拍板)`。**未确认的占位符不许当事实引用**，也不许直接拿去派单。

## 1. 盘点 + 落位映射（需拍板）

- 通读 README / 现有文档 / 代码骨架 / 门禁脚本，产出**现状盘点表**（每行带 `file:line` 证据）：已有文档 → 应落哪一阶段、是否过时、与代码是否一致。
- 出**落位映射表**：`现有文件 → docs/0X-XXX/`，`git mv` 保历史（不复制）。
- 盘点结论与落位决定写进 `docs/07-治理/评审记录/评审记录-YYYYMMDD-接手盘点.md`（结论先行 + 机械项 / 需拍板项）。**不要**在 `07-治理/` 根新建盘点文档：`docs-gate` G4 只允许四个活文档与 `adr/`、`评审记录/` 两个子目录。
- 需拍板项（阶段 na、文档归属、口径分歧）打包给用户，**AI 不私改**。

## 2. 声明文档范围

```bash
node <插件>/scripts/docs-ready.mjs <root> init --scope takeover --write
```

按盘点结果把本项目**确实不存在**的阶段标 `na` 并写理由（例：「无界面，05-页面 na」「契约内嵌在 SDK 类型定义里，03 以 types 为准」）。`na` 会被 `steward:docs-review` 复核，写「暂时不想写」会被打回。

## 3. 建树与治理收口

```bash
node <插件>/scripts/doc/doc-init.mjs <root> --tier 3 --write   # 幂等：只补缺的目录与索引骨架
node <插件>/scripts/docs-gate.mjs <root> init                  # 07 分层 + 各域 history/ + 自动索引区块
node <插件>/scripts/docs-gate.mjs <root> --baseline-write      # 存量记基线：体积超限/缺依据先记账，此后只减不增
node <插件>/scripts/doc/doc-check.mjs <root>                   # T1 / 索引 / 死链
```

存量项目先记基线再要求绿：一开始就要求全部预算达标，只会逼出「删内容凑行数」。

## 4. 逐阶段补齐（01 → 07，先补 `gate=dev` 的）

| 阶段 | 补什么 | 依据 |
|---|---|---|
| 01-需求 | PRD（现状即需求）+ FRD（把现有行为反写成功能点，标注「现状」与「待改」） | 代码与真实行为为准，文档从代码回填 |
| 02-架构 | 架构总纲（实际分层，不是理想分层）+ `{X}工程化` + 横切域现状 | 代码结构 + 构建脚本 |
| 03-契约 | 数据模型（**以 ORM schema 为唯一事实来源**回填）+ API 清单 + 现有错误码 | schema / 路由 / 现有文档 |
| 04-专项 | 有算法 / AI / 规则引擎才建，否则 na | — |
| 05-页面 | 有界面才建：IA 路由表 + 逐页布局稿 + 详设 | 真实页面，别照模板想象 |
| 06-测试 | 现有测试金字塔 + 黄金集（从既有用例反写）+ 覆盖率现状 | 测试代码 |
| 07-治理 | 执行步骤（剩余工序）+ 开发顺序 + 已发生的关键决策补 ADR | 提交历史 / ISSUE |

补文档期间**不动产品代码**：接手期的代码改动要单独立项，走主技能（`steward:steward`）的功能交付或 Bug 修复通道。

## 5. 闭环 + 审查 + 收据

```bash
node <插件>/scripts/docs-ready.mjs <root> check [--plan <03-plan.json>]
```

清零 error（`W-TRACE-*` 由评审复核），然后加载 `steward:docs-review` 技能、派 `steward:reviewer` 全新实例评审 → 记录落 `docs/07-治理/评审记录/` 并在 `docs/07-治理/评审状态.md` 追加一行 → 通过后签发：

```bash
node <插件>/scripts/docs-ready.mjs <root> approve --review docs/07-治理/评审记录/评审记录-YYYYMMDD-接手盘点.md
```

## 6. 出口判据

- `docs-ready status` → `READY`；`doc-check` 绿；`docs-gate check` 在基线内绿（无新增超限）；
- 每个 `required` 阶段都有能在 `steward:docs-review` 里站得住的内容，`na` 有可复核理由；
- 阶段②计划（若已有）的每个任务 `docsRead` 指向真实文档。

## 禁止

- **先盘点后动手**：没盘点就改文档 = 制造第二份真相。
- **不顺手重构**：接手期改代码要单独立项；用户没要求就别碰。
- **不把「现状」写成「目标」**：FRD 里要区分现状行为与待改口径，否则开发照文档实现旧 bug。
- **不私改需拍板项**：归属 / na / 口径分歧列进评审记录等拍板。
- **不用 `git mv` 之外的方式迁移**存量文档（要保历史），迁完同步 `docs/README.md` 与根 `AGENTS.md` 索引。
