---
name: verification-before-completion
description: 完成前验证纪律。当你准备声称任务完成、交付、或汇报「全绿」之前加载：必须真实复跑门禁并贴输出，禁止用记忆、推断或子代理转述代替复跑。Use before claiming any task is done, green, or ready for delivery.
---

<!-- 由 host/dsh/build.mjs 从 shared/ + host/dsh/ 生成，请勿手改；改源后重跑 node host/dsh/build.mjs。 -->

# 完成前验证（verification-before-completion）

铁律：**「应该通过」不算通过**。声称完成的唯一依据是刚刚真实跑过的命令和它的 exit code。

## 声称完成前，逐条自问

1. **我复跑了吗？** 在最后一次代码改动**之后**，用仓库真实门禁命令跑过（test / lint / typecheck，按 steward.config.json 的 gates）。改完测试后没复跑 → 先跑。
2. **输出是真的吗？** 报告里贴的是本次运行的真实输出（截关键行），不是上次的、不是推断的、不是子代理转述未经核对结论的。QA 的独立判定以 verify.mjs 的 exit code 为准。
3. **验收标准逐条对了吗？** 对照规格/任务单的每条 AC：自动化测试覆盖 / 浏览器证据（ARIA/console/network）/ 明确标注未覆盖——三选一，不许留「应该没问题」。
4. **改动面干净吗？** 只动了所有权白名单内的文件；越界改动已回退或已报备。
5. **失败处理对了吗？** 有失败就是失败：如实上报，不许解释掉、不许降级成「已知问题」蒙混交付；flaky 用重复跑确认，不许挑一次绿的。

## 反模式（出现即违规）

- 「测试应该能过」（没跑）·「这个改动不影响其他模块」（没验证）·「之前的输出就代表现在」（过期证据）·「子代理说它过了」（未独立核对）·「只 skip 一个用例」（测试造假）。
