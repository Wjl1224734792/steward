# Steward · 长期维护型研发团队（DSH 插件）

Steward 是给 DeepSeek Harness 用的多角色研发团队插件：主对话代理担任 **Tech Lead**，把需求拆成任务 DAG，按「依赖 + 文件所有权」把任务派给对应角色的子代理，走完计划批准门、QA、浏览器验收与终审才交付。

目标不是「一次把代码写完」，而是让项目在每次变更后仍然**可理解、可验证、可回滚、可继续演进**。

插件只用 DSH 原生扩展点：角色 = **派单时注入的章程**（`roles/*.md`，**不注册 Agent Preset**，因此不占模式选择器），模型路由 = 项目根 `steward.config.json` 优先、其次**面板设置**，派发 = `steward_dispatch` over `ctx.subagents`（子代理跑内置 `standard` 组合），人类入口 = `/steward` 原生命令，技能 = `ctx.skills`，界面 = **Steward 团队面板**（侧栏整页 + 设置页分区，只用原生 slot / configForms / 原生会话跳转，无自建 HTTP 桥）。

## 安装后你会得到

| 能力 | 形态 |
|---|---|
| 7 个角色 | 派单时注入的角色章程（`roles/*.md`）：pm、architect、backend-dev、frontend-dev、qa-engineer、browser-tester、reviewer。**不注册 Agent Preset**——角色不会出现在模式选择器里 |
| 派发 | `steward_dispatch(role, description, prompt, cwd?)`：一个角色一次调用，章程自动拼进派单正文，返回子会话 id，结果自动回传 |
| 模型与档位 | 项目根 `steward.config.json` 的 `modelRouting.<role>`（仓库优先，跑 `scripts/validate-config.mjs`）；没写的角色用**面板**里的该角色 / 默认配置；都没有则继承主代理 |
| **团队面板** | 侧栏「Steward 团队」整页（`main` slot）：运行总览（成员 / 完成比 / 阻塞 + 进度条）、多团队切换条、Lead 行 + 成员卡（**点卡进子会话**）、门禁阶段条 + 工作单行列表、逐角色模型与思考强度表格；同一表格也在「设置 → Steward」 |
| 主技能 | `steward`：Tech Lead 调度手册（定级 / DAG / 派单 / 门禁 / 收尾） |
| 按需技能 | `inline`（主代理自己动手时的硬动作与范围）、`docs`（docTier=3 七阶段文档流水线）——从主技能拆出，只在需要时加载 |
| 配套技能 | `using-steward`（路由）、`agent-settings`（模型配置）、`systematic-debugging`、`tdd`、`verification-before-completion` |
| 共享任务板 | `steward_board(action="sync"/"status"/"brief")`：把 `03-plan.json` 变成 Agent Teams 板上的门禁 + 工作单，状态在 Web Team 面板里直接看 |
| 命令 | `/steward`：回显名册与路由口径（不负责派活） |
| 门禁脚本 | `scripts/`：`validate-plan.mjs`、`verify.mjs`（含 `baseline record/check`）、`run-state.mjs`、`maintain.mjs`、`take-over.mjs`、`validate-config.mjs`，以及 `doc/` 文档流水线工具 |

## 为什么不注册模式（Agent Preset）

DSH 里 preset 就是**用户可选的会话模式**，没有「内部 preset」这种东西。把 7 个角色做成 preset，等于把「Steward · 后端工程师」这类**可写的专员模式**摆进选择器：用户切过去随手改代码，就得到一个绕开计划门、基线守卫、QA 与终审的假 Steward——正好把本插件唯一的价值（流程与门禁）绕掉。

所以 DSH 侧不注册任何 Agent Preset：Steward 是一套流程（技能 + 工具 + 门禁脚本），`steward_dispatch` 让子代理跑在 DSH 内置的 `standard` 组合上，把该角色的**章程**拼在派单正文前面。代价是工人拥有 `standard` 的全套原生工具（委派深度默认 1，会挡住「工人再派工」），收益是模式选择器干净、也没有一套要和 DSH 升级同步的 preset 组合要维护。

## 为什么把路由放在项目里

同样的道理：**配置也只有一个来源**。子代理的模型与思考强度写在项目根 `steward.config.json` 的 `modelRouting.<role>`——它跟代码一起进仓库、进同一个 diff、可评审可回滚，并且能用随包的 `validate-config.mjs` 机检。因此本插件**不声明原生 Config、不提供「设置 → Steward」页、不带 `steward_config` 工具，也没有浏览器半**：per-machine 的模型设置只会让「这个仓库里 QA 用哪个模型」变成查不到的历史。

## 共享任务板就是看板（Agent Teams）

宿主启用「智能体团队」后，**Web 会话页头的 Team 面板就是 Steward 的运行看板**，不再另做一套 UI。`steward_board(action="sync", plan="<工件>/03-plan.json", level="M")` 把计划变成板上的原生任务（幂等，按描述里的 `steward:plan=` / `steward:gate=` 标记匹配）：

| 板上任务 | 来源 | 在面板里能看出什么 |
|---|---|---|
| `G1 · 计划批准` | 门禁 | 未完成时所有工作单 claim 不上（原生依赖闸门，绕不过去） |
| `T<id> · <role> · <标题>` | `03-plan.json` 的 tasks | 状态点、负责人、依赖、就绪态；写范围来自文件所有权，重叠会出告警 |
| `G2 · QA 门禁` / `G3 · 终审` | 门禁 | 依赖全部工作单 / 依赖 QA，流程顺序在板上一目了然 |

- 任务描述是固定块：目标、完成标准、所有权、报告落点、覆盖的 AC，外加 `steward:plan=` / `steward:role=` 标记（面板两行摘要 + 展开可读全文）。
- 状态口径：`pending` 未开始 / `in_progress` 有人在做 / `completed` 报告已落盘且该任务所有权内验证通过。**被依赖阻塞的任务 claim 不上**——Steward 的 DAG 与门禁在原生层执行。
- 派活：`steward_board(action="brief", role="backend-dev", task="T1")` 取自包含任务书 → `spawn_teammate` → `team_task_update(action="reassign", owner=<teammate>)`；teammate 先 claim 再动手。
- 没启用团队时没有 `agentTeams` 服务，`steward_board` 直接报错，回到 `steward_dispatch` + `run.json` 的单人模式。

## Steward 团队面板（Web 整页）

侧栏点 **Steward 团队**（`sidebar.panellist` 入口 → `main` 整页）。页面骨架、字号与边线沿用宿主自己的页面尺度（20px 页标题 / 14px 节标题 / `.5px` 发丝线 / 960px 内容列），深浅色全部由 `--dsw-alias-*` 主题 token 驱动，不写死颜色。

**这一步卡在哪，看一张图就够了。** 任务板是一个「分叉再汇合」的 DAG（G1 → T1/T2/T3 → G2 → G3），所以主视图是**依赖图**而不是列表：

1. **运行总览**：页头右侧是完成环 + 分段进度（每格一个任务，门禁位置带刻度）+ 成员/进行中/阻塞计数。有多个 Agent Teams 会话时上方出现**团队切换条**（`role="tablist"`，方向键可切），一次只展开一个团队。
2. **依赖图（默认视图）**：按依赖分层从左到右排布，正交折线 + 箭头；节点显示任务短号、标题（去掉重复的角色前缀）、负责人首字母与写入文件数；状态用左侧色条 + 虚线（阻塞）+ 图例表达。**悬停/选中会高亮整条上下游路径**，其余节点淡出。键盘：Tab 进入，方向键在任务间移动，Enter 看详情，Esc 取消。深板会自动收窄节点保证不横向溢出；超过 40 个任务时默认回落列表。
3. **归属矩阵**：一行一个写入路径、一列一个代理（真 `<table>`，可读屏），同一文件被两个代理写入的那一行标「重叠」并变色——Steward 的文件所有权纪律一眼可查。
4. **列表**：与图联动的完整文本视图（点行高亮图上节点，反之亦然），也是图的无障碍替代。
5. **详情与右栏**：选中任务后在左下方显示详情（状态 / 负责人 / 依赖（可点跳到前置）/ 写入范围 / 重叠告警 / 任务描述 + 「打开负责人会话」）；右栏是 Lead 与成员（头像 + 状态 + 模型 + 当前任务，点击进子会话）以及**需要你知道**的告警（成员失败、文件重叠、断链依赖、环状依赖）。
6. **模型与思考强度**：一张紧凑表格（角色 / 提供方 / 模型 / 思考强度 / 来源），首行是「默认（兜底）」；目录来自宿主实时模型目录，保存走原生 `configForms`，写入 profile 的 `- id: steward` 行。**项目根 `steward.config.json` 的 `modelRouting` 对该角色优先**，每行标出实际来源；窄屏（<760px）自动降级为逐角色卡片。

没有团队任务板时，页面给出建板引导（三步）与「复制建板指令」按钮（粘给 Lead 即可）。面板不会出现在模式选择器里，也不做任何文件写入或自定义 HTTP 桥。

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

3. **需要换子代理模型**：在项目根 `steward.config.json` 写 `modelRouting`（或直接说「配置子代理模型」，主代理会加载 `agent-settings` 技能来改并跑 `validate-config.mjs`）。下一次 `steward_dispatch` 立即使用新路由，不需要重启。

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
| 改模型 / 档位 | 「配置子代理模型」→ `agent-settings`：改项目根 `steward.config.json` 的 `modelRouting` 并跑 `validate-config.mjs` |
| 不知道用哪个入口 | 加载 `using-steward` 做路由 |

## 角色名册

| 角色 | `role` | 职责 |
|---|---|---|
| 需求分析师 | `pm` | 模糊需求 → 可测规格 |
| 架构师 | `architect` | 规格 → 技术方案 + 任务 DAG |
| 后端工程师 | `backend-dev` | 按任务单 TDD 实施 |
| 前端工程师 | `frontend-dev` | UI 实施 + 验收脚本 |
| 测试工程师 | `qa-engineer` | 测试 / lint / typecheck 质量门 |
| 浏览器验收员 | `browser-tester` | 真实浏览器黑盒验收 |
| 代码评审员 | `reviewer` | 终审 diff，三级意见 |

## 模型路由

```json
{
  "modelRouting": {
    "reviewer": { "model": "ctaigw/glm-5.3", "effort": "high" },
    "qa-engineer": { "model": "ctaigw/glm-5.3-flash" }
  }
}
```

1. **用户当次指定**：本轮明确说「用 X 模型」时按用户指令派发。
2. **项目级** `modelRouting.<role>`：`steward_dispatch` 按派单的 `cwd` 上溯找项目根并读取，下次派发即生效。
3. **继承主代理**：没有该角色的条目时沿用主代理当前模型与档位。

派发前会用 `llm.resolveModelInfo` 校验模型与档位；模型不存在或档位不支持会直接报错，不会静默降级。格式错误（如 `model` 少了 `provider/` 前缀）按「没有配置」处理，落到继承主代理。改完跑 `node <包>/scripts/validate-config.mjs <项目根>/steward.config.json` 校验结构。

## 工作方式与边界

- 只有「无依赖 且 文件所有权不相交」的任务才并行；其余按任务 DAG 串行。
- S/M/L 三档：小需求不走全员大会；M/L 过计划批准门（干净上下文 Plan Critic + 用户批准）。
- 可信变更门禁：计划机检、独立复跑测试 / lint / typecheck、基线守卫、断点恢复与失败重试预算。
- 三道质量门：QA → 浏览器验收（有 UI）→ 评审；缺陷按归属回派，最多 2 轮。
- 真实输出：不美化、不编造，失败就是失败。
- DSH 侧 0.6.0 的范围：技能（主技能 + 按需 `inline` / `docs`）、角色（派单注入章程，不注册模式）、模型路由（项目配置优先 + 面板）、派发、**团队面板**（整页 + 设置分区）、共享任务板（Agent Teams）、`/steward` 与门禁脚本已对齐。ZCode/MiniMax 的 `PreToolUse` 守卫 hooks 尚未移植（DSH 的工具守卫是宿主内另一套机制）。浏览器验收按「仓库自带 Playwright → DSH 侧栏人工驱动 → 人工兜底」三级。

## 更多

- 仓库与完整说明（中文）：<https://github.com/Wjl1224734792/steward>
- English: <https://github.com/Wjl1224734792/steward/blob/main/dsh/README.en.md>
- 变更记录：<https://github.com/Wjl1224734792/steward/blob/main/CHANGELOG.md>
- 路线图：<https://github.com/Wjl1224734792/steward/blob/main/docs/ROADMAP.md>
- License: MIT
