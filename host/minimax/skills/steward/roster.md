## 团队名册（用 `task` 工具按 `steward:<角色>` 派发）

| 角色 | 派发名（`agent_name`） | 干什么 | 产出 |
|---|---|---|---|
| 需求分析师 | `steward:pm` | 模糊需求 → 可执行规格 | 02-spec.md |
| 架构师 | `steward:architect` | 规格 → 影响面 + 方案 + 任务 DAG | 02-impact.md / 03-plan.md / 03-plan.json |
| 后端工程师 | `steward:backend-dev` | 按任务单实现后端（支持 Bug 模式） | 实施报告 |
| 前端工程师 | `steward:frontend-dev` | 按任务单实现 UI + 验收脚本 | 实施报告（含浏览器验收脚本） |
| 测试工程师 | `steward:qa-engineer` | 独立验证门禁（verify.mjs 复跑）、补测试 | QA 报告 |
| 浏览器验收员 | `steward:browser-tester` | 真实浏览器 GUI 黑盒验收 | 逐条判定 + 缺陷清单 |
| 评审员 | `steward:reviewer` | 终审 diff；Plan Critic 模式审计划 | 终审报告（三级意见） |

### 模型分配（派单时显式带 `model` + `effort`）

| 角色 | `model` | `effort` | 生效方式 |
|---|---|---|---|
| `steward:pm` | `custom_provider:provider-7970db/step-5-preview` | `high` | 插件默认；项目级 `modelRouting` 可覆盖 |
| `steward:architect` | `custom_provider:provider-7970db/step-5-preview` | `high` | 插件默认；项目级 `modelRouting` 可覆盖 |
| `steward:backend-dev` | `custom_provider:provider-f9b585/deepseek-v4.1-flash-1017` | `high` | 插件默认；项目级 `modelRouting` 可覆盖 |
| `steward:frontend-dev` | `custom_provider:provider-f9b585/deepseek-v4.1-flash-1017` | `high` | 插件默认；项目级 `modelRouting` 可覆盖 |
| `steward:qa-engineer` | `custom_provider:provider-7970db/step-5-preview` | `high` | 插件默认；项目级 `modelRouting` 可覆盖 |
| `steward:browser-tester` | `custom_provider:provider-f9b585/glm-5.3-flash` | `high` | 插件默认；项目级 `modelRouting` 可覆盖 |
| `steward:reviewer` | `custom_provider:provider-7970db/step-5-preview` | `high` | 插件默认；项目级 `modelRouting` 可覆盖 |

- 这两个参数**必须成对传**：模型带 thinking 档位时只传 `model` 会直接失败（`... requires an explicit thinking effort: low, high, max`），不会自动取默认值。
- 各 agent 的 frontmatter 现在**同时声明 `model` 与 `effort`**（声明式默认值）；名册表与本文件的 frontmatter 由 `build.mjs` 机检一致性，**不要手改其中一处**。改模型请用可视化配置页（`steward:agent-settings`）或 `agent-config.mjs set`，避免两处漂移。
- 派单示例：
  `task(agent_name="steward:architect", model="custom_provider:provider-7970db/step-5-preview", effort="high", description="...", prompt="...", run_in_background=false)`
- 用户临时指定别的模型/档位时，以用户为准，覆盖上表。

**生效优先级**：用户当次指定 > 项目级 `steward.config.json` 的 `modelRouting`（下次派单即生效）> 插件 frontmatter 默认（build + 安装后**新会话**生效）。
