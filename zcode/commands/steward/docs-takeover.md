---
description: 以 Steward 文档入口·接手存量项目建文档基线（take-over 盘点落位 → 范围声明 → 按 01→07 补缺口 → docs-ready 机检 → docs-review 独立评审 → 签发收据；docTier=3）
argument-hint: <项目根目录，缺省为当前仓库>
---

请按「Steward 文档入口 · 接手存量项目」为以下项目建立文档基线：$ARGUMENTS

先加载 `steward:docs-takeover` 技能（文档入口 · 接手存量项目）并严格执行其流程：

1. 前置：目标项目根 `steward.config.json` 需 `docTier: 3`——没同意就先别改，向用户说明会启用文档就绪硬门（未过门禁不许派开发）。
2. 先盘点后动手：`scripts/take-over.mjs <root>` 只扫描出报告，逐条确认 `{{...}}` / `TODO(拍板)` 占位符（未确认的不许当事实引用）；落位映射用 `git mv` 保历史；需拍板项打包给用户，AI 不私改。
3. 按技能顺序执行：`docs-ready init --scope takeover --write` 声明范围（确实不存在的阶段标 na + 理由）→ `doc-init --tier 3` 建树 → `docs-gate --baseline-write` 记存量基线 → 按 01→07 补缺口（先补 gate=dev 的阶段）。
4. 门禁动作不可省：`docs-ready check` 闭环机检 → 派 `steward:reviewer` 全新实例独立评审（按 `steward:docs-review` 流程）→ `docs-ready approve` 签发收据；收据绿之前不派 backend-dev / frontend-dev。
5. 与 `/steward:take-over`（开发侧接手：T1 + 健康扫描 + 维护 backlog）区分：本命令只建文档基线，不动业务代码。
