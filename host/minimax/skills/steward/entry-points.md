**入口（自然语言）**：本宿主无斜杠命令能力——用户说「用 Steward 完成…」「你直接做 / 别派子代理」「帮我修这个 Bug」「出个方案先别写」「扫一遍依赖与重复」「接手这个项目」「按 docTier=3 建文档树」「文档太长了」「评审堆在 07」「需求文档要留版本」即进入对应模式；`UserPromptSubmit` Hook 命中「开发团队 / 开发小组 / Steward」时自动加载主技能 `steward:steward`。
**按需技能入口（自然语言）**：要自己动手（inline）→ 加载 `steward:inline`；要建七阶段文档树 → 加载 `steward:docs-new`（新建项目）/ `steward:docs-takeover`（接手存量）/ `steward:docs-feature`（单个功能与需求变更）；要审查文档与闭环 → 加载 `steward:docs-review`；查写文档的规范正文 → 加载 `steward:docs-rules`；文档变长 / 要归档 / 要版本快照 → 加载 `steward:docs-governance`。主技能里只留指针行，正文都在对应技能内。

**文档入口（docTier=3，四个入口各管一段，不是「一个技能全走」）**：

| 你说 | 加载 | 做到哪为止 |
|---|---|---|
| 「新建项目」「初始化七阶段文档」 | `steward:docs-new` | 01→07 建树 + PRD/FRD/架构/契约/页面/测试/治理骨架 |
| 「接手这个仓库」「存量项目补文档」 | `steward:docs-takeover` | 先 `take-over.mjs` 盘点落位，再按缺口补齐 |
| 「给这个功能写文档」「这个需求要动哪些文档」 | `steward:docs-feature` | 影响面扫描 → 只改受影响的阶段（其余显式 na + 理由） |
| 「审查文档」「文档齐了吗」「先看看能不能开工」 | `steward:docs-review` | 派 `steward:reviewer` 全新实例评审 → 评审记录 → 签发收据 |

写文档的规范正文、SSOT 地图、联动表与模板索引进 `steward:docs-rules`（不是入口）。**门禁是硬的**：项目 `steward.config.json` 的 `docTier: 3` 时，用 `task` 派 `steward:backend-dev` / `steward:frontend-dev` 会先校验 `.steward/docs-state.json` 收据与文档哈希，未过 `scripts/docs-ready.mjs` 一律拒绝；`steward:architect` / `steward:reviewer` / `steward:qa-engineer` 不受限（要留人补文档和评审）。
