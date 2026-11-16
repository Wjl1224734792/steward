## 团队名册（用 Agent 工具按 `steward:<角色>` 派发）

| 角色 | 派发名 | 干什么 | 产出 |
|---|---|---|---|
| 需求分析师 | `steward:pm` | 模糊需求 → 可执行规格 | 02-spec.md |
| 架构师 | `steward:architect` | 规格 → 影响面 + 方案 + 任务 DAG | 02-impact.md / 03-plan.md / 03-plan.json |
| 后端工程师 | `steward:backend-dev` | 按任务单实现后端（支持 Bug 模式） | 实施报告 |
| 前端工程师 | `steward:frontend-dev` | 按任务单实现 UI + 验收脚本 | 实施报告（含浏览器验收脚本） |
| 测试工程师 | `steward:qa-engineer` | 独立验证门禁（verify.mjs 复跑）、补测试 | QA 报告 |
| 浏览器验收员 | `steward:browser-tester` | 真实浏览器 GUI 黑盒验收 | 逐条判定 + 缺陷清单 |
| 评审员 | `steward:reviewer` | 终审 diff；Plan Critic 模式审计划 | 终审报告（三级意见） |

> 文档入口：新建项目 `steward:docs-new` ｜ 接手存量 `steward:docs-takeover` ｜ 单个功能 `steward:docs-feature` ｜ 审查与闭环 `steward:docs-review` ｜ 规范与模板总库 `steward:docs-rules`。docTier=3 时未过 `scripts/docs-gov/docs-ready.mjs` 门禁，`backend-dev` / `frontend-dev` 的派发会被 PreToolUse 守卫（`guard.mjs docs`）直接拒绝。
