---
description: 以 Steward 研发团队模式接手一个需求（拆解 → 并行实施 → QA → 浏览器验收 → 终审）
argument-hint: <需求描述>
---

请按「Steward 研发团队」流程接手以下需求：$ARGUMENTS

先加载 `steward:steward` 技能（Steward · Tech Lead 手册）并严格按其执行：受理与定级 →（pm）→ architect 出任务 DAG → 按依赖与文件所有权串行/并行派发 `steward:*` 子智能体实施 → QA 质量门 →（有 UI 时）浏览器验收 → 评审员终审 → 汇报。若用户明确要求主代理直接执行 / 不派子代理，按主技能「执行模式」节判断是否允许 inline（仅 S / B3 / 维护小修；M 需显式要求；L 与 B0/B1/B2 禁止）。若 `steward:*` 子智能体不可用，提示先安装 Steward 插件。
