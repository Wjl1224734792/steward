---
name: using-steward
description: Steward 技能路由（DSH）。当用户不知道用 Steward 的哪个入口/技能、问「该用哪个模式/从哪开始」、或在功能交付、Bug 修复、只出计划、维护、接手、文档流水线、主代理直接执行（inline）、调试、TDD、完成前验证之间做选择时，先读本技能做路由。Use when the user is unsure which Steward mode or skill to use, or asks where to start.
---

<!-- 由 host/dsh/build.mjs 从 shared/ + host/dsh/ 生成，请勿手改；改源后重跑 node host/dsh/build.mjs。 -->

# Steward 技能路由（不知道用哪个时先读这个）

> 本技能只做路由，不替代主技能。选定入口后按对应技能执行；不要把路由本身当成流程，也不要新造角色。DSH 的派活入口靠自然语言 + 技能加载（原生 `/steward` 命令只回显名册/预设/路由）。

## 先判断：这是哪类事？

| 用户意图 | 路由到 | 怎么开始 |
|---|---|---|
| 开发/修改一个功能、新页面、新接口 | 主技能 `steward`（功能交付） | 加载 `steward` 技能，按六阶段走 |
| 修 Bug / 功能坏了 / 线上异常 | 主技能 `steward`（Bug 通道 B0–B3） | 先定级再复现，可复现 Bug 无失败测试不修 |
| 只要方案、先别写代码 | 主技能 `steward`（只出计划模式） | 到批准门停止，不派 dev/qa |
| 依赖升级、安全扫描、文档漂移、flaky | 主技能 `steward`（维护循环） | 跑 `maintain.mjs` 出排序 backlog |
| 接手一个不熟的存量仓库 | 主技能 `steward`（接手存量） | 先用 `take-over.mjs` 生成 T1 再动手 |
| 需要 PRD/FRD/契约/页面/测试/部署全套文档 | 主技能 `steward`（docTier=3 文档流水线） | 先设 `steward.config.json` 的 `docTier: 3` |
| 小改动、让主代理自己干 | 主技能 `steward`（inline 执行模式） | S / B3 / 维护小修；M 需显式要求；L 与 B0/B1/B2 禁止 |
| 改子代理用的模型 / 思考强度 | `agent-settings` | 打开「设置 → Steward」，或 `steward_config` |

## 轻量技能什么时候加载

| 信号 | 加载 |
|---|---|
| Bug 说不通、要复现 / 缩小 / 根因 | `systematic-debugging` |
| 实现或修 Bug 要测试先行 | `tdd` |
| 准备说「完成 / 修好了 / 全绿」 | `verification-before-completion` |
| 想改子代理用的模型 / 思考强度 | `agent-settings` |

派单时在 prompt 里点名「加载 `xxx` 技能并遵守」；不要默认塞给所有任务。

## 三条纪律

1. **不新造角色/流程**：只用 7 个角色 + 5 个轻量技能（含本路由与子代理模型配置）+ 主技能；需要新角色先给方案，不直接加。
2. **S 级直接做**：≤3 文件、单层、无 UI / 无 schema，可走 inline（主技能「执行模式」节；用户要求或配置 `execution.mode: "inline"`），不派全员、不建深文档；计划与 verify 仍不可省。
3. **不确定就先走只出计划模式**：先把方案 / 影响面 / 风险摆出来，再决定做不做；不要猜着写。

## 反例

- 用户说「加个按钮」就直接写代码：没定级、没看 UI 约定、没走计划门。
- 明明是 Bug 却走 feature 六阶段：复现和失败测试都缺。
- 一上来派 7 个角色：S 级也开批准门，流程税高于改动本身。
- 把 inline 当免检：跳过计划、baseline 或 verify，自己写又自己判通过。
- 不知道用哪个就硬猜一个模式：不读本表、不说明假设。

## 边界

- 本技能只做「把用户带到正确入口」，不执行流程；路由表与主技能冲突时以主技能正文为准。
- 文档流水线与需求澄清是主技能内的两节（docTier=3 / Stage 0.1），不是独立入口。
