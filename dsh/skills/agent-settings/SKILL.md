---
name: agent-settings
description: Steward 子代理模型与思考强度配置（DSH）。入口是 Web GUI 里的「Steward 团队」面板（侧栏「Steward 团队」或设置 → Steward）——面板显示每个 Agent 的实时状态与任务、可点击进子会话，并可逐角色设置 provider / model / 思考强度；项目根 steward.config.json 的 modelRouting 对该角色优先。Use when the user asks which model or thinking effort a Steward subagent uses, wants to change a role's model/effort, or wants to look at the Steward panel.
---

<!-- 由 host/dsh/build.mjs 从 shared/ + host/dsh/ 生成，请勿手改；改源后重跑 node host/dsh/build.mjs。 -->

# 子代理模型与思考强度配置（DSH）

> 目标：让用户**看得见、改得动、验得了** 7 个子代理的模型与思考强度。DSH 侧入口是插件自带的 **Steward 团队面板**：一个整页（侧栏「Steward 团队」，同一表格也在「设置 → Steward」），上面同时有运行总览、团队切换、Lead/成员卡、门禁阶段条与工作单行，以及这张按角色的模型表格。

## 生效规则（唯一事实链）

1. **用户当次指定**（本轮明确说用哪个模型/档位）——派发时按用户指令，并提示这与配置不一致。
2. **项目级** `<项目根>/steward.config.json` 的 `modelRouting.<role>`（`{ "model": "provider/model", "effort": "…" }`）——**仓库优先**，改完跑 `scripts/validate-config.mjs`，下一次派单即生效。
3. **面板里的该角色配置**（DSH 原生 Settings 命名空间 `steward`，写在 profile 的 `cordis.patch.yml` 的 `- id: steward` 行）。
4. **面板默认配置**——角色没有单独配置时套用。
5. **继承主代理**——以上都没有时。

派发结果里会回显本次实际生效的路由与来源（`from steward.config.json` / `from the Steward panel` / `inherited parent model`），用它核对，不要猜。

## 你要做的

1. **先看**：让用户打开面板（「打开 Steward 面板」/ 侧栏「Steward 团队」），或在 `steward.config.json` 里读 `modelRouting`；把「角色 / 生效模型 / 思考强度 / 来源」照实讲，不要编默认值。
2. **改**：
   - 用户要「看着改」→ 让他在面板里按角色选 provider / model / 思考强度，点保存（面板会做真实校验并回显）。
   - 用户要改仓库级 → 编辑项目根 `steward.config.json` 的 `modelRouting`，跑 `node <包>/scripts/validate-config.mjs <项目根>/steward.config.json`。
3. **看 Agent 状态**：面板里的成员卡显示 运行中 / 空闲 / 创建中 / 失败、所用模型、当前任务；**点卡片直接进它的会话**。共享任务板显示门禁与工作单的状态、负责人、依赖、写入范围与重叠告警——向用户汇报进度时以它为准（或贴 `steward_board(action="status")` 的文本快照）。
4. **回报真实结果**：贴改后的值、校验输出、以及下一次派发回执里的路由来源。失败就是失败。

## 纪律

- **`provider/model` 成对**：面板里要么都选，要么都留空（继承）；`effort` 只在该模型真实支持的集合内选，留空用模型默认档位。
- **仓库优先**：面板里改了但仓库 `modelRouting` 有该角色时，生效的仍是仓库值——面板里会标出来源，别谎报「已生效」。
- **不手改生成物**：`roles/*.md`、技能正文是构建产物；配置只走面板或 `steward.config.json`。
- **不写密钥**：只取模型名与档位，绝不回显任何 API key / baseURL。

## 边界

- 本技能只管「模型/档位配置 + 面板怎么看」，不改子代理的职责、提示词或工具集——角色章程随派单注入，子代理跑 DSH 内置 `standard` 组合（本插件不注册 Agent Preset，角色不会出现在模式选择器里）。
