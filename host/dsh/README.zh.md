# Steward · 长期维护型研发团队（DSH 插件）

Steward 是给 DeepSeek Harness 用的多角色研发团队插件：主对话代理担任 **Tech Lead**，把需求拆成任务 DAG，按「依赖 + 文件所有权」把任务派给对应角色的子代理，走完计划批准门、QA、浏览器验收与终审才交付。

目标不是「一次把代码写完」，而是让项目在每次变更后仍然**可理解、可验证、可回滚、可继续演进**。

插件完全用 DSH 原生扩展点实现：角色 = **Agent Presets**，模型路由 = 原生 **Settings**（命名空间 `steward`），派发 = `steward_dispatch` over `ctx.subagents`，人类入口 = `/steward` 原生命令，技能 = `ctx.skills`。

## 安装后你会得到

| 能力 | 形态 |
|---|---|
| 7 个角色 | Agent Presets：`steward-pm`、`steward-architect`、`steward-backend-dev`、`steward-frontend-dev`、`steward-qa-engineer`、`steward-browser-tester`、`steward-reviewer` |
| 派发 | `steward_dispatch(role, description, prompt, cwd?)`：一个角色一次调用，返回子会话 id，结果自动回传 |
| 模型与档位 | `steward_config(action="list" / "set" / "reset")` 或「设置 → Steward」原生设置页 |
| 主技能 | `steward`：Tech Lead 调度手册（定级 / DAG / 派单 / 门禁 / 收尾） |
| 配套技能 | `using-steward`（路由）、`agent-settings`（模型配置）、`systematic-debugging`、`tdd`、`verification-before-completion` |
| 命令 | `/steward`：回显名册、角色 preset id 与当前生效路由（不负责派活） |
| 门禁脚本 | `scripts/`：`validate-plan.mjs`、`verify.mjs`（含 `baseline record/check`）、`run-state.mjs`、`maintain.mjs`、`take-over.mjs`、`validate-config.mjs`，以及 `doc/` 文档流水线工具 |
| 设置页 | 「设置 → Steward」：逐角色选 provider / model / reasoning effort，保存后下一次派发立即生效 |

## 快速开始

1. **安装**：在 DSH 里用插件管理器安装本地包目录（源码仓库先 `node host/dsh/build.mjs` 重建 `dsh/`）：

   ```text
   plugin_manager(action="install_bundle", target="<repo>/dsh")
   ```

2. **新开一个会话**，直接用自然语言提需求，例如：

   ```text
   用 Steward 给 tmp/demo 写一个金额汇总脚本，带单测并跑绿
   ```

   主代理会加载 `steward` 技能：受理定级（S/M/L）→ 需求澄清 → 任务 DAG + 文件所有权 → 派子代理 → QA → 浏览器验收 → 终审 → 汇报。

3. **需要换子代理模型**：打开「设置 → Steward」，或直接说「配置子代理模型」。保存后下一次 `steward_dispatch` 立即使用新路由，不需要重启。

## 入口与模式

| 想做什么 | 怎么说 |
|---|---|
| 功能交付 | 「用 Steward 做 <需求>」→ 六阶段 + 计划批准门 |
| 直接执行（inline） | 「你直接做 / 别派子代理」→ 限 S / B3 / 维护小修；M 需显式要求；L 与 B0/B1/B2 禁止 |
| Bug 修复 | 「修这个 Bug / 这个功能坏了」→ B0–B3 分流 |
| 只出计划 | 「只出方案，先别写代码」→ 到批准门停止，不实施 |
| 维护循环 | 「做一次维护扫描」→ 八类扫描 + 评分 backlog + 小修 |
| 接手存量 | 「接手这个仓库，先盘点再动手」→ T1 项目记忆 + 首轮健康扫描 |
| 文档流水线 | `docTier: 3`（随 `/steward`）→ 七阶段文档树 + 全量模板 |
| 改模型 / 档位 | 「配置子代理模型」→ `agent-settings` + 「设置 → Steward」 |
| 不知道用哪个入口 | 加载 `using-steward` 做路由 |

## 角色名册

| 角色 | preset | 职责 |
|---|---|---|
| 需求分析师 | `steward-pm` | 模糊需求 → 可测规格 |
| 架构师 | `steward-architect` | 规格 → 技术方案 + 任务 DAG |
| 后端工程师 | `steward-backend-dev` | 按任务单 TDD 实施 |
| 前端工程师 | `steward-frontend-dev` | UI 实施 + 验收脚本 |
| 测试工程师 | `steward-qa-engineer` | 测试 / lint / typecheck 质量门 |
| 浏览器验收员 | `steward-browser-tester` | 真实浏览器黑盒验收 |
| 代码评审员 | `steward-reviewer` | 终审 diff，三级意见 |

## 模型路由的优先级

1. 项目根 `steward.config.json` 的 `modelRouting.<role>`（最高，下次派发即生效）
2. 「设置 → Steward」页 / `steward_config set`
3. `steward_config set` 写入的默认配置
4. 继承主代理

派发前会用 `llm.resolveModelInfo` 校验模型与档位；模型不存在或档位不支持会直接报错（`MODEL_SELECTION_INVALID`），不会静默降级。

## 工作方式与边界

- 只有「无依赖 且 文件所有权不相交」的任务才并行；其余按任务 DAG 串行。
- S/M/L 三档：小需求不走全员大会；M/L 过计划批准门（干净上下文 Plan Critic + 用户批准）。
- 可信变更门禁：计划机检、独立复跑测试 / lint / typecheck、基线守卫、断点恢复与失败重试预算。
- 三道质量门：QA → 浏览器验收（有 UI）→ 评审；缺陷按归属回派，最多 2 轮。
- 真实输出：不美化、不编造，失败就是失败。
- DSH 0.2.0 的范围：技能、角色（Agent Presets）、模型路由（原生 Settings）、派发、`/steward` 与门禁脚本已对齐；ZCode/MiniMax 的 `PreToolUse` 守卫 hooks 尚未移植（DSH 的工具守卫是宿主内另一套机制）。浏览器验收按「仓库自带 Playwright → DSH 侧栏人工驱动 → 人工兜底」三级。

## 更多

- 仓库与完整说明（中文）：<https://github.com/Wjl1224734792/steward>
- English: <https://github.com/Wjl1224734792/steward/blob/main/dsh/README.en.md>
- 变更记录：<https://github.com/Wjl1224734792/steward/blob/main/CHANGELOG.md>
- 路线图：<https://github.com/Wjl1224734792/steward/blob/main/docs/ROADMAP.md>
- License: MIT
