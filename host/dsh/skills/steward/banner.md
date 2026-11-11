> 当前版本（DSH 0.2.0，原生机制重写）：功能交付（六阶段 + 批准门）+ 需求澄清（第一性原理 + 提问预算）+ 任务 DAG / 文件所有权 + Bug 通道（B0–B3）+ 可信变更门禁（计划校验 / 独立验证 / 基线守卫 / run-state）+ 维护循环 + 接手存量 + 浏览器证据契约 + 学习循环 + 收尾 + 文档流水线（docTier=3）+ 子代理模型与思考强度原生配置（设置 → Steward）+ 宿主原生执行模式（subagent / inline）。角色本身是 DSH **Agent Presets**（`steward-<role>`：persona + 原生工具组合）。
>
> **DSH 宿主映射（读正文前先记住这几条）**：
> ①文中 `steward:<角色>` 指 `steward_dispatch` 工具的 `role` 参数（`pm` / `architect` / `backend-dev` / `frontend-dev` / `qa-engineer` / `browser-tester` / `reviewer`），派发时**只填 role，不手写模型**——子代理以对应 Agent Preset 启动，模型与思考强度由原生设置自动套用；
> ②文中 `steward:xxx` 技能 = 本宿主技能名 `xxx`（如 `tdd`、`systematic-debugging`、`agent-settings`）；
> ③文中 `/steward:inline` = 用户明确说「你直接做 / 别派子代理」或 `steward.config.json` 的 `execution.mode: "inline"`；DSH 的原生 `/steward` 命令只回显名册/预设/当前路由，派活入口仍是自然语言 + 本技能；
> ④门禁脚本表里若出现 `agent-config.mjs` / `build.mjs`，那是源码仓库工具、**不随本包提供**：改子代理模型走「设置 → Steward」（原生 Settings）或 `steward_config` 工具；更新本插件走插件管理器；源码构建用 `node host/dsh/build.mjs`。
