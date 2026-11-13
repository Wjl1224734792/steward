> 当前版本（DSH 侧 1.1.0）：功能交付（六阶段 + 批准门）+ 需求澄清（第一性原理 + 提问预算）+ 任务 DAG / 文件所有权 + Bug 通道（B0–B3）+ 可信变更门禁（计划校验 / 独立验证 / 基线守卫 / run-state）+ 维护循环 + 接手存量 + 浏览器证据契约 + 学习循环 + 收尾 + 文档流水线（docTier=3，细节见按需技能 `docs`）+ 文档治理（`docs-governance` 增量层：拆分 / 归档 / `history/` 版本快照 + `docs-gate` / `doc-snapshot` 门禁）+ 项目全生命周期（`project-lifecycle`）+ **Steward 团队面板**（Web 整页：运行总览 + 团队切换 + Lead/成员卡点击进子会话 + 门禁阶段条与工作单 + 逐角色模型表格）+ 项目级子代理模型路由（`steward.config.json` 优先于面板）+ **Agent Teams 共享任务板**。角色是**派单时注入的章程**：本插件不注册 Agent Preset，7 个角色不会出现在模式选择器里。
>
> **DSH 宿主映射（读正文前先记住这几条）**：
> ①文中 `steward:<角色>` 指 `steward_dispatch` 工具的 `role` 参数（`pm` / `architect` / `backend-dev` / `frontend-dev` / `qa-engineer` / `browser-tester` / `reviewer`），派发时**只填 role，不手写模型**——子代理以 DSH 内置 `standard` 组合启动，角色章程由工具拼在派单正文前，模型与思考强度按「项目根 `steward.config.json` 的 `modelRouting.<role>` > 面板该角色 > 面板默认 > 继承主代理」解析；
> ②文中 `steward:xxx` 技能 = 本宿主技能名 `xxx`（如 `tdd`、`systematic-debugging`、`agent-settings`、`inline`、`docs`）；
> ③文中 `/steward:inline` = 用户明确说「你直接做 / 别派子代理」或 `steward.config.json` 的 `execution.mode: "inline"`，此时**加载 `inline` 技能**按它列的硬动作执行；DSH 的原生 `/steward-roster` 命令只回显名册/路由口径，派活入口仍是自然语言 + 本技能（`/steward` 是触发本技能的斜杠手势，手势后接空格或直接回车）；
> ④门禁脚本表里若出现 `agent-config.mjs` / `build.mjs`，那是源码仓库工具、**不随本包提供**：改子代理模型改 **Steward 面板**（侧栏「Steward 团队」或设置 → Steward）或项目根 `steward.config.json` 的 `modelRouting`（仓库优先）；更新本插件走插件管理器；源码构建用 `node host/dsh/build.mjs`。
