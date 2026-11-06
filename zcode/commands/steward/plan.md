---
description: 以 Steward 只出计划模式处理一个需求（受理 → 影响面 → 方案 DAG → 计划校验 → Plan Critic → 用户批准，不实施）
argument-hint: <需求描述>
---

请按「Steward 只出计划」模式接手以下需求：$ARGUMENTS

先加载 `steward:steward` 技能（Steward · Tech Lead 手册），执行 Stage 0（受理定级）→ Stage 0.5（L 级仓库勘察，如需）→ Stage 1（architect 产出 02-impact.md / 03-plan.md / 03-plan.json）→ Stage 1.5（Plan Critic 干净上下文审计划 + 用户批准门）。

**到此为止，不进实施**：不派任何 dev / qa，不建 run.json。最终向用户交付：规格、影响面、计划（含机读 03-plan.json 与 validate-plan.mjs 校验结果）、Critic 意见、待拍板问题清单。`steward:*` 子智能体不可用时提示先安装 Steward 插件。
