---
name: docs-rules
description: Steward 文档规范与模板总库（DSH，docTier=3）。**不是入口**：建文档用 docs-new（新建项目）/ docs-takeover（接手存量）/ docs-feature（单个功能或需求变更），审查与闭环用 docs-review；本技能只在需要查七阶段规范正文、SSOT 地图、变更联动表与模板索引时加载。Use when a Steward run needs the writing rules, SSOT map, change-link table or template index of the seven-phase documentation pipeline, not to start building documents.
---

# Steward · 文档规范与模板总库（docTier=3）

> **本技能不是入口**。按场景选入口：新建项目 → `docs-new`；接手存量仓库 → `docs-takeover`；单个功能 / 需求变更 → `docs-feature`；审查文档与闭环 → `docs-review`。
> 本技能只回答「写在哪、怎么写、改了要联动什么」；入口技能负责流程、产物清单与出口判据，闭环由 `scripts/docs-ready.mjs` 机检。
> **文档变长 / 要归档 / 要版本快照？** 加载 `docs-governance` 技能（拆分预算、07 分层归档、`history/` 版本溯源、`docs-gate` / `doc-snapshot` 门禁）。
