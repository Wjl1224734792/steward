---
name: inline
description: Steward 直接执行（inline）模式（DSH）。当用户明确说「你直接做 / 别派子代理」、或项目 steward.config.json 的 execution.mode 为 inline 时加载：允许范围（S 级 / B3 / 维护小修；M 需显式要求；L 与 B0/B1/B2 禁止）、六个不可省的硬动作（迷你方案、baseline record/check、失败测试、verify 真实输出、落报告与 05-record、不越文件所有权）与常见反模式。Use when the lead agent must carry out a Steward task itself instead of dispatching a subagent.
---

# Steward · 直接执行（inline）模式

> 本技能从主技能按需拆出：只在「主代理自己动手」时加载。执行者换了，**门禁一个都不能降**。
