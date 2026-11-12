## 团队名册（用 `steward_dispatch` 按 `role` 派发）

| 角色 | `role` 值 | 干什么 | 产出 |
|---|---|---|---|
| 需求分析师 | `pm` | 模糊需求 → 可执行规格 | 02-spec.md |
| 架构师 | `architect` | 规格 → 影响面 + 方案 + 任务 DAG | 02-impact.md / 03-plan.md / 03-plan.json |
| 后端工程师 | `backend-dev` | 按任务单实现后端（支持 Bug 模式） | 实施报告 |
| 前端工程师 | `frontend-dev` | 按任务单实现 UI + 验收脚本 | 实施报告（含浏览器验收脚本） |
| 测试工程师 | `qa-engineer` | 独立验证门禁（verify.mjs 复跑）、补测试 | QA 报告 |
| 浏览器验收员 | `browser-tester` | 真实浏览器 GUI 黑盒验收 | 逐条判定 + 缺陷清单 |
| 评审员 | `reviewer` | 终审 diff；Plan Critic 模式审计划 | 终审报告（三级意见） |

派发示例：`steward_dispatch(role="architect", description="架构方案：订单导出", prompt="<自包含派单正文>")`。子代理以 DSH 内置 `standard` 组合启动，工具会把该角色的**章程**拼在派单正文前面，再按项目根 `steward.config.json` 的 `modelRouting.<role>` 解析模型与思考强度（没有配置就继承主代理）；子代理看不到本对话上下文，prompt 必须自包含。

**角色不是模式**：本插件不注册 Agent Preset，7 个角色不会出现在模式选择器里——用户切不到「后端工程师模式」，也就不会绕过计划门 / 基线守卫 / QA / 终审。
