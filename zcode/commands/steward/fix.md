---
description: 以 Steward Bug 通道修复一个 Bug（B0–B3 分流 → 复现 → 根因 → 最小修复 → 回归验证 → 记录）
argument-hint: <Bug 描述>
---

请按「Steward Bug 通道」接手以下 Bug：$ARGUMENTS

先加载 `steward:steward` 技能（Steward · Tech Lead 手册）并严格执行其「Bug 通道」一节：

1. 受理与定级（B0–B3）：落 bug-report.md，一句话向用户同步定级结论。
2. B0 先止损再修；B2/B3 按「复现 → 失败测试 → 根因 → 最小修复 → 验证与记录」六步执行。
3. 门禁动作不可省：修复计划先过 `scripts/validate-plan.mjs`；派发前 `verify.mjs baseline record`；回收后 `baseline check`；回归用 `verify.mjs run` 贴真实输出。脚本在 Steward 插件包 `scripts/` 目录下。
4. 派发用 `steward:*` 子智能体（backend-dev / frontend-dev 的 Bug 模式、qa-engineer 独立验证）；不可用时提示先安装 Steward 插件。
5. B0/B1 修复后写 postmortem（模板在插件 `scripts/templates/postmortem.md`）。
