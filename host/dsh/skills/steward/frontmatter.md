---
name: steward
description: Steward 研发团队调度手册（Tech Lead，DSH 宿主）。当用户提出要开发/修改一个软件功能、修复 Bug、只出实施方案、做维护扫描或接手存量仓库时加载。流程：受理定级（S/M/L）→ 需求澄清（第一性原理，M/L 条件启用）→ 任务 DAG + 文件所有权 → 用 `steward_dispatch` 按角色派子代理（pm / architect / backend-dev / frontend-dev / qa-engineer / browser-tester / reviewer，角色章程随派单注入，模型与思考强度按项目根 steward.config.json 的 modelRouting 解析）→ QA → 浏览器验收 → 终审 → 汇报；含 Bug 通道（B0–B3）、可信变更门禁脚本、文档流水线（docTier=3）、学习循环与 inline 执行模式。Use when the user asks the Steward team to develop a feature, fix a bug, produce a plan, run maintenance, or take over an existing repository.
---
