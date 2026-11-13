---
name: agent-settings
description: Steward 子代理模型与思考强度配置（DSH）。模型在「设置 → Steward」里逐角色配置（provider / model / 思考强度）；会话标题栏的 Steward 图标打开该会话的右侧栏看板，看子代理实时状态、点一行进子会话、看任务与产物。项目根 steward.config.json 的 modelRouting 对该角色优先。Use when the user asks which model or thinking effort a Steward subagent uses, wants to change a role's model/effort, or wants to watch a Steward run on the right-sidebar board.
---

<!-- 由 host/dsh/build.mjs 从 shared/ + host/dsh/ 生成，请勿手改；改源后重跑 node host/dsh/build.mjs。 -->

# 子代理模型与思考强度配置（DSH）

> 目标：让用户**看得见、改得动、验得了** 7 个子代理的模型与思考强度。DSH 侧两块入口各管一件事：**设置 → Steward** 里是这张按角色的模型表格（逐角色 provider / model / 思考强度 + 默认兜底行）；运行情况看**每会话一份的右侧栏看板**（会话标题栏的 Steward 图标打开，或直接点右侧栏里已打开的「Steward 看板」tab）——任务图、子代理实时状态、产物都在那儿。

## 生效规则（唯一事实链）

1. **用户当次指定**（本轮明确说用哪个模型/档位）——派发时按用户指令，并提示这与配置不一致。
2. **项目级** `<项目根>/steward.config.json` 的 `modelRouting.<role>`（`{ "model": "provider/model", "effort": "…" }`）——**仓库优先**，改完跑 `scripts/validate-config.mjs`，下一次派单即生效。
3. **设置 → Steward 里的该角色配置**（DSH 原生 Settings 命名空间 `steward`，写在 profile 的 `cordis.patch.yml` 的 `- id: steward` 行）。
4. **设置页的默认配置**——角色没有单独配置时套用。
5. **继承主代理**——以上都没有时。

派发结果里会回显本次实际生效的路由与来源（`from steward.config.json` / `from Settings → Steward`（设置页）/ `inherited parent model`），用它核对，不要猜。

## 你要做的

1. **先看**：让用户点会话标题栏的 Steward 图标、或直接点右侧栏里已打开的「Steward 看板」tab 看运行；模型值去「设置 → Steward」读，也可以直接看 `steward.config.json` 的 `modelRouting`。把「角色 / 生效模型 / 思考强度 / 来源」照实讲，不要编默认值。
2. **改**：
   - 用户要「看着改」→ 让他在「设置 → Steward」里按角色选 provider / model / 思考强度，点保存（设置页会做真实校验并回显）。
   - 用户要改仓库级 → 编辑项目根 `steward.config.json` 的 `modelRouting`，跑 `node <包>/scripts/validate-config.mjs <项目根>/steward.config.json`。
3. **看 Agent 状态**：右侧栏看板的子代理区每个派发一行，显示 运行中 / 空闲、角色 chip 与子代理会话标题；**点一行在右侧栏打开它的子会话**。任务区按来源显示共享任务板 / `run.json` / 待办清单（头部徽标标出来源），状态、负责人、依赖、写入范围与重叠告警都在那里——向用户汇报进度时以它为准（或贴 `steward_board(action="status")` 的文本快照）。
4. **回报真实结果**：贴改后的值、校验输出、以及下一次派发回执里的路由来源。失败就是失败。

## 纪律

- **`provider/model` 成对**：设置页里要么都选，要么都留空（继承）；`effort` 只在该模型真实支持的集合内选，留空用模型默认档位。
- **仓库优先**：设置页里改了但仓库 `modelRouting` 有该角色时，生效的仍是仓库值——设置页的「来源」列会标出来源，别谎报「已生效」。
- **不手改生成物**：`roles/*.md`、技能正文是构建产物；配置只走设置页或 `steward.config.json`。
- **不写密钥**：只取模型名与档位，绝不回显任何 API key / baseURL。

## 边界

- 本技能只管「模型/档位配置 + 设置页与右侧栏看板怎么看」，不改子代理的职责、提示词或工具集——角色章程随派单注入，子代理跑 DSH 内置 `standard` 组合（本插件不注册 Agent Preset，角色不会出现在模式选择器里）。
