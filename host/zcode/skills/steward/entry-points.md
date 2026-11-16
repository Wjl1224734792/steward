**入口（斜杠命令）**：`/steward`（功能交付）、`/steward:inline`（主代理直接执行低风险任务）、`/steward:fix`（Bug 通道）、`/steward:plan`（只出计划）、`/steward:maintain`（维护循环）、`/steward:take-over`（接手存量）。

- 文档治理/拆分/归档/版本溯源：「文档太长了」「评审堆在 07」「需求文档要留版本」——加载 `steward:docs-governance` 技能，跑 `scripts/docs-gov/docs-gate.mjs` 与 `scripts/docs-gov/doc-snapshot.mjs`。

**文档入口（docTier=3，四个入口各管一段，不是「一个技能全走」）**：

| 你说 | 加载 | 做到哪为止 |
|---|---|---|
| 「新建项目」「初始化七阶段文档」 | `steward:docs-new` | 01→07 建树 + PRD/FRD/架构/契约/页面/测试/治理骨架 |
| 「接手这个仓库」「存量项目补文档」 | `steward:docs-takeover` | 先 `scripts/take-over.mjs` 盘点落位，再按缺口补齐 |
| 「给这个功能写文档」「这个需求要动哪些文档」 | `steward:docs-feature` | 影响面扫描 → 只改受影响的阶段（其余显式 na + 理由） |
| 「审查文档」「文档齐了吗」「先看看能不能开工」 | `steward:docs-review` | 派 reviewer 全新实例评审 → 评审记录 → 签发收据 |

写文档的规范正文、SSOT 地图、联动表与模板索引进 `steward:docs-rules`（不是入口）。**门禁是硬的**：`steward.config.json` 的 `docTier: 3` 时，`backend-dev` / `frontend-dev` 的派发会先校验 `.steward/docs-state.json` 收据与文档哈希，未过 `scripts/docs-gov/docs-ready.mjs` 一律拒绝；`architect` / `pm` / `reviewer` / `qa-engineer` 不受限（要留人补文档和评审）。
