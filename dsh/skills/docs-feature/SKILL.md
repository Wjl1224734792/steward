---
name: docs-feature
description: Steward 文档入口（DSH）· 单个功能与需求变更。触发语「给这个功能写文档」「这个需求要动哪些文档」「补 PRD/FRD」「需求变更文档」「功能做完了把文档补上」。只在 docTier=3 时适用：先按 SSOT 地图与联动表做影响面扫描、打包需拍板项，再只改受影响的阶段（其余显式 na + 理由），跑 docs-ready --plan 校验任务 docsRead，经 docs-review 通过后签发收据。Use when a specific feature or requirement change needs its documents added or updated inside an existing T3 project.
---

<!-- 由 host/dsh/build.mjs 从 shared/ + host/dsh/ 生成，请勿手改；改源后重跑 node host/dsh/build.mjs。 -->

# 文档入口 · 单个功能 / 需求变更（docTier=3）

> 本入口负责**在已有文档树上做增量**；从零建树用 `docs-new`，接手存量用 `docs-takeover`，审查用 `docs-review`。SSOT 地图、联动表与模板在 `docs-rules`。
> 脚本路径约定：`<插件>` = 本技能所在插件包根目录（技能文件向上两级）。

## 0. 前置

1. `steward.config.json` 是 `docTier: 3` 且 `.steward/docs-state.json` 已存在（没有 → 先跑 `docs-new` / `docs-takeover`）。
2. 读 `docs-rules` 里的 **SSOT 地图（§2）** 与 **联动表（§4）**：决定这次动哪些文档，靠表，不靠印象。

## 1. 变更入口五步（不拍板不动文档）

```
① 影响面扫描：PRD 的 FR（新增/改口径/改批次）/ FRD 功能点 / 契约端点与错误码 /
   数据模型 / 页面与布局 / 黄金集 / 开发顺序波次 / 估算 / 种子数据
② 需拍板项打包给用户：批次归属（本次 or 延后）/ 口径选项 / 范围 In-Out / 工作量影响
③ 用户拍板（选型级落 ADR；需求级 bump PRD 版本 + 修订记录；动契约则契约文档升版）
④ 同一批变更落档（联动表全表执行，含「零改动」产物也要点名）
⑤ 归档结论：需要写进评审记录的（na 理由、口径拍板）随审查一次留下
```

> 用户已经通过 `steward` 批准过计划（`01-approval.md`）时，③ 可引用该结论，不重复追问。

## 2. 声明本次范围（只点亮受影响的阶段）

```bash
node <插件>/scripts/docs-ready.mjs <root> init --scope feature --require 03-契约 --require 07-治理 --write
```

- `--require` 只给**本次确实要动**的阶段；其余自动 `na` 并预填理由（「本次功能未触及（docs-review 复核）」）。
- 状态文件已存在时 `init` 会跳过：直接编辑 `.steward/docs-state.json`，把本次涉及的阶段改回 `required`，其余保持 `na` 并写理由。
- 影响面来源：`<工件>/02-impact.md` 的「文档」小节 + `03-plan.json` 每个任务的 `docsRead`。

## 3. 按联动表落档（改 A 必同改 B）

| 改了什么 | 同批必须改 |
|---|---|
| PRD 的 FR 新增 / 改口径 / 改批次 | FRD 对应 FP + FR↔FP 追溯表 + PRD 版本与修订记录 |
| FRD 功能点（字段 / 规则 / 状态 / 异常 / 权限） | `03-契约/`（数据模型 / API / 错误码）+ `06-测试/` 黄金集 + `05-页面/` 对应详设 |
| 接口 / schema / 错误码 | `03-契约/` + ORM schema 与迁移（schema 是机读唯一事实来源）+ 计划 manifest 自查 |
| 页面 / 组件 / 路由 / 布局 / 断点 | `05-页面/` 路由表 + 布局稿 + 详设；视觉 token 只引 `.agents/designs/DESIGN.md` |
| 领域参数（费率 / 上限 / 生效日） | 参数 SSOT 清单 + 需求相关节 + 黄金集期望值 |
| 技术选型 | **先写** `07-治理/adr/ADR-NNNN-*.md` 再改代码 |
| 完成一个任务 | `07-治理/执行步骤.md` 销项；波次变化同批重排 `开发顺序.md` |

细节写进既有文档的对应章节，**不新建平行副本**（同主题只一份；正文不复制，用引用 + 章节号）。

## 4. 闭环机检（带计划才有牙齿）

```bash
node <插件>/scripts/docs-ready.mjs <root> check --plan <工件>/03-plan.json
```

- `E-PLAN-DOCSREAD`：任务 `docsRead` 为空或指向不存在的文档 → 回计划补；
- `E-PLAN-NA-CONFLICT`：任务读了被标 `na` 的阶段 → 要么把该阶段改回 `required` 并补文档，要么承认这个任务不依赖它；
- `E-DOC-PLACEHOLDER` / `E-DOC-THIN`：新写的章节还是占位或空壳；
- `W-TRACE-FR` / `W-TRACE-FP`：新 FR 没落成 FP、新 FP 找不到所属 FR → 补追溯表（`--strict` 升 error）。

## 5. 审查与收据

加载 `docs-review` 派 `reviewer` 全新实例评审（干净上下文，只看文档与计划），记录落 `docs/07-治理/评审记录/评审记录-YYYYMMDD-<主题>.md`、`评审状态.md` 补一行；通过后：

```bash
node <插件>/scripts/docs-ready.mjs <root> approve --review docs/07-治理/评审记录/评审记录-YYYYMMDD-<主题>.md
```

收据 `ok:true` 才允许派 `backend-dev` / `frontend-dev` 实施本功能。

## 6. 出口判据

- `docs-ready status` → `READY`，且 `stale=false`；
- 联动表里被点名的每个产物都有对应改动，**没动的产物在评审记录里显式写「零改动」**；
- 计划每个任务 `docsRead` 通过 `check --plan`；
- `执行步骤.md` 有本次任务的销项行（或挂成带编号的开放项）。

## 禁止

- **不拍板不动文档**：口径 / 范围 / 批次有分歧就停下问，拍板结论必须留痕（ADR / 评审记录 / PRD 修订记录之一）。
- **不许只改代码不改文档**：契约、参数、布局、黄金集的变化都是同一批变更的一部分。
- **不许把 `na` 当省事**：`na` 意味着「这次真的不涉及」，且要被评审复核；被计划引用会直接 `E-PLAN-NA-CONFLICT`。
- **不许自写自批**：`approve` 只认独立 `docs-review` 的 `approved + blocking 0`。
- 口径类文档一改收据即失效；只改 `执行步骤.md` / `评审状态.md` / `评审记录/` 不影响收据。
