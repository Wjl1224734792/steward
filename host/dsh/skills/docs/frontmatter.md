---
name: docs
description: Steward 文档流水线（docTier=3，DSH）。当需求属 L 级、涉及契约/多端/合规、或用户在项目 steward.config.json 设了 docTier: 3 时加载：七阶段文档树（需求/架构/契约/专项/页面/测试/治理）、模板索引、变更联动表与本地门禁（doc-init / doc-check / guard-naming），以及 PRD/FRD 验收条目如何收敛进 02-spec.md 的 AC。Use when a Steward run needs the full seven-phase documentation pipeline rather than the default thin project memory.
---

# Steward · 文档流水线（docTier=3）

> 本技能从主技能按需拆出：只在需要建深文档树时加载。docTier<3 不建这套目录，不要为了「完整」建空树。
