---
name: steward
description: Steward 软件研发团队调度手册（Tech Lead）。覆盖三类入口：①功能交付——用户提出要开发的软件需求/功能/改动（「帮我实现一个…」「用开发团队完成这个需求」「启动开发团队」「/steward」），受理 → 定级 → 拆解任务 DAG → 按依赖与文件所有权派发子智能体（PM / 架构师 / 前后端 / QA / 浏览器验收 / 代码评审）→ 质量门 → 终审 → 汇报；②Bug 修复——「修这个 Bug」，按 B0–B3 分流走调试与修复通道；③只出计划——出方案与计划等批准，不写代码。v0.5 起自带可信变更门禁（计划校验、独立验证、基线 hash / 越界 diff 守卫）。Use when the user asks to develop a feature, fix a bug, or produce an implementation plan with a dispatched team of subagents.
---
