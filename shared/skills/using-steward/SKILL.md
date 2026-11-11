---
name: using-steward
description: Steward 技能路由。当用户不知道用 Steward 的哪个入口/技能、问「该用哪个模式/从哪开始」、或在功能交付、Bug 修复、只出计划、维护、接手、文档流水线、主代理直接执行（inline）、调试、TDD、完成前验证之间做选择时，先读本技能做路由。Use when the user is unsure which Steward mode or skill to use, or asks where to start.
---

# Steward 技能路由（不知道用哪个时先读这个）

> 本技能只做路由，不替代主技能。选定入口后按对应技能/命令执行；不要把路由本身当成流程，也不要新造角色。

## 先判断：这是哪类事？

@@SLOT:skills/using-steward/routing-table@@

## 轻量技能什么时候加载

| 信号 | 加载 |
|---|---|
| Bug 说不通、要复现 / 缩小 / 根因 | `steward:systematic-debugging` |
| 实现或修 Bug 要测试先行 | `steward:tdd` |
| 准备说「完成 / 修好了 / 全绿」 | `steward:verification-before-completion` |
| 想改子代理用的模型 / 思考强度 | `steward:agent-settings` |

派单时在 prompt 里点名「加载 `steward:xxx` 并遵守」；不要默认塞给所有任务。

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
