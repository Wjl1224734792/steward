---
description: 以 Steward 文档入口·单个功能/需求变更落档（SSOT 影响面扫描 → 需拍板项 → 用户拍板 → 联动表落档 → docs-ready --plan 机检 → docs-review 通过签发收据；docTier=3）
argument-hint: <功能或需求变更描述>
---

请按「Steward 文档入口 · 单个功能 / 需求变更」为以下变更落文档：$ARGUMENTS

先加载 `steward:docs-feature` 技能（文档入口 · 单个功能 / 需求变更）并严格执行其流程：

1. 前置：目标项目 `docTier: 3` 且 `.steward/docs-state.json` 已存在——没有就先走 `/steward:docs-new` 或 `/steward:docs-takeover` 建基线。
2. 变更入口五步不跳步：影响面扫描（读 `steward:docs-rules` 的 SSOT 地图与联动表，靠表不靠印象）→ 需拍板项打包给用户 → 用户拍板 → 同批落档（联动表全表执行，「零改动」产物也点名）→ 归档结论随审查留下。
3. 范围声明：`docs-ready init --scope feature --require <本次确实要动的阶段>`，其余自动 na + 理由；`--require` 不许为了让门禁变绿虚报。
4. 门禁动作不可省：`docs-ready check --plan <工件>/03-plan.json` → 派 `steward:reviewer` 全新实例评审 → 通过后 `docs-ready approve` 签发 / 刷新收据。
