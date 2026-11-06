---
description: 以 Steward 维护循环体检一个项目（八类扫描 → 评分排序 → 小修 → HEALTH 台账）
argument-hint: <项目根目录，缺省为当前仓库>
---

请按「Steward 维护循环」处理以下项目：$ARGUMENTS

先加载 `steward:steward` 技能（Steward · Tech Lead 手册）并严格执行其「维护循环」一节：

1. Observe：跑插件 `scripts/maintain.mjs <项目根> --out <工件>/reports/maintenance.md`，做八类扫描（依赖 / 安全 / 重复 / churn / 文档漂移 / 循环依赖 / flaky / TODO）。
2. Score：按脚本评分（风险 × 影响 ÷ 成本）排序，产出维护 backlog。
3. Fix small：一次一个、单写者、证据闭环（修 + 测试 + `verify.mjs run` 绿；小修也要 `baseline record/check`）。大改造不在这里做，转 `/steward` 立项。
4. Record：更新 `docs/project/HEALTH.md` 台账与维护 backlog、CHANGELOG；依赖/漏洞类只列清单请用户拍板，不自动升级。

不做 CI/CD，不自动改依赖。
