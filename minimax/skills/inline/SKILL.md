---
name: inline
description: Steward 直接执行（inline）模式（MiniMax Code）。当用户说「你直接做 / 别派子代理」、或项目 steward.config.json 的 execution.mode 为 inline 时加载：允许范围（S 级 / B3 / 维护小修；M 需显式要求；L 与 B0/B1/B2 禁止）、六个不可省的硬动作（迷你方案、baseline record/check、失败测试、verify 真实输出、落报告与 05-record、不越文件所有权）与常见反模式。MiniMax 宿主没有斜杠命令，入口是自然语言或 execution.mode 配置。Use when the lead agent must carry out a Steward task itself instead of dispatching a subagent.
---

# Steward · 直接执行（inline）模式

> 本技能从主技能按需拆出：只在「主代理自己动手」时加载。执行者换了，**门禁一个都不能降**。
> 加载入口（MiniMax 无斜杠命令）：用户说「你直接做」「别派子代理」，或项目 `steward.config.json` 的 `execution.mode` 设为 `inline`；不确定该走哪个入口时先加载 `steward:using-steward` 做路由。

<!-- 由 zcode/scripts/build.mjs 从 shared/ + host/minimax/ 生成，请勿手改；改源后重跑 build.mjs。 -->

## 执行模式（subagent / inline——换执行者，不降门禁）

两种执行者，同一套门禁：

- **subagent（默认）**：按任务 DAG 派 `steward:backend-dev` / `steward:frontend-dev` 等子代理实施。
- **inline**：你按 DAG 顺序自己执行任务（一次一个，单写者），计划、baseline、TDD、verify、报告一个都不能省。

**优先级**：用户当次明确指令（`/steward:inline`、`--inline`、「你直接做 / 别派子代理」）> `steward.config.json` 的 `execution.mode` > 默认 `subagent`。

**允许范围**：
- 可直接使用：S 级功能、Bug B3、维护循环 Fix small、单文件文档/配置改动（用户要求或配置 `execution.mode: "inline"` 时）。
- M 级：仅当用户显式要求（`--inline` 或配置显式 `execution.mode: "inline"`）；**只把实施者换成你，Stage 3 QA 与 Stage 5 reviewer 照旧派**。
- 禁止：L 级、B0/B1/B2、跨模块、含 schema/契约迁移、UI 大改。命中禁止项就回退 subagent，并一句话告诉用户原因。

**inline 的硬动作**（缺一不可）：
1. 计划不省：S 级写迷你方案；B3/M 仍出 `03-plan.json` 并跑 `validate-plan.mjs`。
2. `verify.mjs baseline record` → 按 DAG 顺序一次一个任务执行（M 级用 `run-state.mjs start/done` 标记）→ `baseline check`；越界即停。
3. 可复现缺陷先写失败测试；实现遵守 `steward:tdd`。
4. `verify.mjs run` 贴真实输出；红了就是失败，不许解释掉。
5. 落 `reports/t<ID>-lead.md`（改了什么/证据/偏差）与 `05-record.md`；不 git commit/push。
6. 不越出计划文件所有权；要扩权先在 `03-plan.md` 记录并告知用户。

**不能做的事**：把 inline 当免检（跳过计划/baseline/TDD/verify）；自己写测试又自己宣布通过（M 级必须独立 QA）；顺手重构；并行多任务。
