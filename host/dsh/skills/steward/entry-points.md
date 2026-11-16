**入口（DSH：自然语言触发本技能；`/steward` 斜杠手势直接触发本技能（手势后接空格或直接回车）；名册命令 `/steward-roster` 只回显名册/路由）**：

- 功能交付：「用 Steward 做 <需求>」「启动开发团队实现 <需求>」——走六阶段 + 批准门。
- 直接执行（inline）：「你直接做 / 别派子代理」——限 S / B3 / 维护小修；M 需显式要求；L 与 B0/B1/B2 禁止。
- Bug 修复：「修这个 Bug / 这个功能坏了」——按 B0–B3 分流。
- 只出计划：「只出方案，先别写代码」——到批准门停止。
- 维护循环：「做一次维护扫描」；接手存量：「接手这个仓库，先盘点再动手」。
- 改子代理模型/档位：「配置子代理模型」——加载 `agent-settings` 技能，改项目根 `steward.config.json` 的 `modelRouting`，跑 `scripts/validate-config.mjs` 校验。
- 文档治理/拆分/归档/版本溯源：「文档太长了」「评审堆在 07」「需求文档要留版本」——加载 `docs-governance` 技能，跑 `scripts/docs-gate.mjs` 与 `scripts/doc-snapshot.mjs`。

**文档入口（docTier=3，四个入口各管一段，不是「一个技能全走」）**：

| 你说 | 加载 | 做到哪为止 |
|---|---|---|
| 「新建项目」「初始化七阶段文档」 | `docs-new` | 01→07 建树 + PRD/FRD/架构/契约/页面/测试/治理骨架 |
| 「接手这个仓库」「存量项目补文档」 | `docs-takeover` | 先 `take-over.mjs` 盘点落位，再按缺口补齐 |
| 「给这个功能写文档」「这个需求要动哪些文档」 | `docs-feature` | 影响面扫描 → 只改受影响的阶段（其余显式 na + 理由） |
| 「审查文档」「文档齐了吗」「先看看能不能开工」 | `docs-review` | 派 reviewer 全新实例评审 → 评审记录 → 签发收据 |

写文档的规范正文、SSOT 地图、联动表与模板索引进 `docs-rules`（不是入口）。**门禁是硬的**：`steward.config.json` 的 `docTier: 3` 时，`backend-dev` / `frontend-dev` 的派发会先校验 `.steward/docs-state.json` 收据与文档哈希，未过 `scripts/docs-ready.mjs` 一律拒绝；`architect` / `reviewer` / `qa-engineer` 不受限（要留人补文档和评审）。
