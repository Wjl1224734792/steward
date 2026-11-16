---
description: 以 Steward 文档入口·审查文档与闭环（docs-ready check 机检 → reviewer 全新实例逐阶段评审 → 评审记录落盘 → 通过则 docs-ready approve 签发收据；docTier=3）
argument-hint: <审查范围或阶段清单，可留空缺省全树>
---

请按「Steward 文档入口 · 审查与闭环」审查以下文档：$ARGUMENTS

先加载 `steward:docs-review` 技能（文档入口 · 审查与闭环）并严格执行其流程：

1. 先跑 `scripts/docs-gov/docs-ready.mjs <root> check --json` 拿缺漏清单（先机检再派人，别让评审员替你找错别字）。
2. 派 `steward:reviewer` 全新实例（干净上下文、只读）：把判据抄进派单（阶段产物齐不齐 / 口径与关键数字一致 / FR↔FP 无孤儿 / AC 可测 / 契约与 schema 一致 / na 理由站得住），不塞实施上下文与历史结论。
3. 结论由你（Lead）落盘到 `docs/07-治理/评审记录/评审记录-YYYYMMDD-<主题>.md` 并追加机读块，不许篡改评审结论。
4. 通过 → `docs-ready approve` 签发收据；不通过 → 回对应入口（`/steward:docs-new` / `/steward:docs-takeover` / `/steward:docs-feature`）补齐后重审。
