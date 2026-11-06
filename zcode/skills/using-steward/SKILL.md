---
name: using-steward
description: Steward 技能路由（ZCode 侧）。当用户不知道用 Steward 的哪个入口/技能、问「该用哪个模式/从哪开始」、或在功能交付、Bug 修复、只出计划、维护、接手、文档流水线、调试、TDD、完成前验证之间做选择时，先读本技能做路由。Use when the user is unsure which Steward mode or skill to use, or asks where to start.
---

# Steward 技能路由（不知道用哪个时先读这个）

> 本技能只做路由，不替代主技能。选定入口后按对应技能/命令执行；不要把路由本身当成流程，也不要新造角色。

## 先判断：这是哪类事？

| 用户意图 | 路由 | 要点 |
|---|---|---|
| 开发新功能 / 改现有功能 | `/steward <需求>` | 主技能；S/M/L 定级，M/L 走计划批准门 |
| 修 Bug / 行为不对 | `/steward fix <Bug>` | B0–B3 分流；B2/B3 先写失败测试 |
| 只要方案，先别动手 | `/steward plan <需求>` | 到批准门停止，不实施 |
| 维护 / 体检 / 还债 | `/steward maintain` | 八类扫描 → backlog → 小修 → HEALTH |
| 接手存量项目 | `/steward take-over` | 先盘点后动手 |
| 写 PRD/FRD/契约/页面/测试/部署 | `/steward` + `docTier: 3` | 读主技能目录下 `references/doc-pipeline/README.md` |
| 需求模糊 / 不知道从哪开始 | `/steward plan` 或 Stage 0.1 | 最多 3 个 P0 问题；S 级不追问 |

## 轻量技能什么时候加载

| 信号 | 加载 |
|---|---|
| Bug 说不通、要复现 / 缩小 / 根因 | `steward:systematic-debugging` |
| 实现或修 Bug 要测试先行 | `steward:tdd` |
| 准备说「完成 / 修好了 / 全绿」 | `steward:verification-before-completion` |

派单时在 prompt 里点名「加载 `steward:xxx` 并遵守」；不要默认塞给所有任务。

## 三条纪律

1. **不新造角色/流程**：只用 7 个角色 + 3 个轻量技能 + 主技能；需要新角色先给方案，不直接加。
2. **S 级直接做**：≤3 文件、单层、无 UI / 无 schema，不派全员、不建深文档。
3. **不确定就先 `/steward plan`**：先把方案 / 影响面 / 风险摆出来，再决定做不做；不要猜着写。

## 反例

- 用户说「加个按钮」就直接写代码：没定级、没看 UI 约定、没走计划门。
- 明明是 Bug 却走 feature 六阶段：复现和失败测试都缺。
- 一上来派 7 个角色：S 级也开批准门，流程税高于改动本身。
- 不知道用哪个就硬猜一个模式：不读本表、不说明假设。

## 边界

- 本技能只在 **ZCode 侧**提供；MiniMax 侧等 1.6.1 再同步（当前 1.6.0 没有本路由）。
- 路由表与主技能冲突时，以主技能正文为准；本技能只负责「把用户带到正确入口」。
