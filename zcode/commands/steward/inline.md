---
description: 以 Steward inline 模式处理低风险需求（主代理直接执行计划；计划 / 基线 / TDD / verify 不省略）
argument-hint: <需求描述>
---

请按「Steward inline 执行模式」接手以下需求：$ARGUMENTS

先加载 `steward:steward` 技能（Steward · Tech Lead 手册），按「执行模式（subagent / inline）」与「流程」执行：

1. 定级：仅 S 级功能、Bug B3、维护小修、单文件文档/配置改动默认允许 inline；M 级仅当用户明确要求；L 级与 B0/B1/B2 禁止 inline——命中禁止项就回退 subagent 流程并说明原因。
2. 计划不省：S 级写迷你方案；B3/M 仍出 `03-plan.json` 并跑 `validate-plan.mjs`。
3. 门禁不省：`verify.mjs baseline record` → 按 DAG 顺序一次一个任务执行（M 级用 `run-state.mjs start/done`）→ `baseline check`。
4. TDD：可复现缺陷先写失败测试；`verify.mjs run` 贴真实输出。
5. 报告：落 `reports/t<ID>-lead.md` 与 `05-record.md`；M 级仍派 qa-engineer 独立复跑，Stage 5 reviewer 照旧。
6. 不 git commit / push，除非用户明说。
