---
description: 以 Steward 文档入口·新建项目建立七阶段文档基线（范围声明 → 建树 → 01→07 产出 → docs-ready 机检 → docs-review 独立评审 → 签发收据；docTier=3）
argument-hint: <项目简述或项目根，缺省为当前仓库>
---

请按「Steward 文档入口 · 新建项目」为以下项目建立文档基线：$ARGUMENTS

先加载 `steward:docs-new` 技能（文档入口 · 新建项目）并严格执行其流程：

1. 前置检查：目标项目根 `steward.config.json` 需 `docTier: 3`——不是 3 时先向用户说明「会启用文档就绪硬门：未过门禁不许派开发」，明确同意再改配置；确认仓库尚无 `docs/01-需求…07-治理`，已有则改走 `/steward:docs-takeover`。
2. 按技能顺序执行：`scripts/docs-gov/docs-ready.mjs <root> init --scope new --write` 声明范围并复核 na → `scripts/doc/doc-init.mjs <root> --tier 3 --write` 建树 → 按 PRD → FRD → 架构 → 契约 → 页面 → 测试 → 治理产出（模板与规范在 `steward:docs-rules`，不凭记忆写）。
3. 门禁动作不可省：`docs-ready check` 闭环机检（FR↔FP 孤儿追溯收口到 0）→ 派 `steward:reviewer` 全新实例独立评审（按 `steward:docs-review` 流程）→ `docs-ready approve` 签发收据。
4. 收据（`.steward/docs-state.json`）没绿之前不派 backend-dev / frontend-dev（docTier=3 的 PreToolUse 守卫会直接拒绝）。
5. 脚本在 Steward 插件包 `scripts/docs-gov/` 与 `scripts/doc/` 目录下，都在目标项目根执行。
