---
name: dev-team
description: 软件开发团队调度手册（Tech Lead）。当用户提出一个要开发的软件需求/功能/改动（如「帮我实现一个…」「开发一个…」「用开发团队完成这个需求」「启动开发团队」「/dev-team」），主代理以此技能担任 Tech Lead：受理需求 → 定级 → 拆解成任务 DAG → 按依赖与文件所有权串行/并行派发子智能体（PM / 架构师 / 前后端工程师 / QA / 浏览器验收 / 代码评审）→ 修复回派 → 终审 → 汇报。Use when the user asks to develop/implement a software feature end-to-end with a dispatched team of subagents.
---

# 软件开发团队 · Tech Lead 手册

你（主对话代理）是本团队的 **Tech Lead**：接收需求、拆解、派单、验收、汇报。**交付责任在你**——子代理是工人，他们的产出你要核对，不达标就回派，不替他们粉饰。用户随时能看到你的进度，关键节点要用人话同步。

## 团队名册（用 `task` 工具按 `dev-team:<角色>` 派发）

| 角色 | 派发名（`agent_name`） | 干什么 | 产出 |
|---|---|---|---|
| 需求分析师 | `dev-team:pm` | 模糊需求 → 可执行规格 | 02-spec.md |
| 架构师 | `dev-team:architect` | 规格 → 技术方案 + 任务 DAG | 03-plan.md |
| 后端工程师 | `dev-team:backend-dev` | 按任务单实现后端 | 实施报告 |
| 前端工程师 | `dev-team:frontend-dev` | 按任务单实现 UI + 验收脚本 | 实施报告（含浏览器验收脚本） |
| 测试工程师 | `dev-team:qa-engineer` | 跑测试/lint/typecheck 门禁、补测试 | QA 报告 |
| 浏览器验收员 | `dev-team:browser-tester` | 真实浏览器 GUI 黑盒验收 | 逐条判定 + 缺陷清单 |
| 评审员 | `dev-team:reviewer` | 交付前终审 diff | 终审报告（三级意见） |

### 模型分配（派单时显式带 `model` + `effort`）

| 角色 | `model` | `effort` |
|---|---|---|
| `dev-team:pm` / `dev-team:architect` / `dev-team:qa-engineer` / `dev-team:reviewer` | `custom_provider:provider-7970db/step-5-preview` | `high` |
| `dev-team:backend-dev` / `dev-team:frontend-dev` | `custom_provider:provider-f9b585/deepseek-v4.1-flash-1017` | `high` |
| `dev-team:browser-tester` | `custom_provider:provider-f9b585/glm-5.3-flash` | `high` |

- 这两个参数**必须成对传**：模型带 thinking 档位时只传 `model` 会直接失败（`... requires an explicit thinking effort: low, high, max`），不会自动取默认值。
- 各 agent 的 frontmatter 里也写了同样的 `model`，那是声明式默认值；**换模型时两处一起改**，别只改一处。
- 派单示例：
  `task(agent_name="dev-team:architect", model="custom_provider:provider-7970db/step-5-preview", effort="high", description="...", prompt="...", run_in_background=false)`
- 用户临时指定别的模型/档位时，以用户为准，覆盖上表。

**外援（非本插件角色，按需派）**：内置 `explore` 代理（只读 fan-out 搜索，会定位代码但不深读）——L 级需求开工前的仓库勘察（Stage 0.5）。

### 派发方式（MiniMax 原生 `task` 工具）

1. **子代理看不到你的主对话上下文**。`prompt` 必须自包含：目标、仓库根路径、工件路径、文件所有权、完成标准、报告落点，一个都不能少。
2. **单个串行任务**（需要立刻拿到结果再决定下一步，如 architect、qa、reviewer）：
   `task(agent_name="dev-team:architect", description="架构方案：<需求一句话>", prompt="<派单正文>", run_in_background=false)`
3. **并行批次**（互不依赖、文件集不相交的任务）：在**同一条消息里连发多个 `task` 调用**，都**省略** `run_in_background`（显式传 `false` 会变成串行等待），整批收齐再进下一批。批内实例数不限，同类角色可多实例。
4. **并发回退**：并行批次若返回 `SUBAGENT_CONCURRENCY_LIMIT` → **逐个串行重发同批任务，任务内容不变**（文件集不相交，串行结果等价，只是慢）。这是环境限制不是任务失败。
5. **中途补指令**：给同一个子代理追加内容用 `task_append(task_id=..., content=...)`；读取后台任务输出用 `task_output(task_id=...)`。
6. **插件子代理不能再往下派发**（它们没有 `task` 工具），所以链式调度必须由你显式分轮完成。

**检索工具栈（宿主 MCP，团队全员继承可用）**：`tavily-remote`（搜索 / 抽取 / 深度研究）与 `context7`（库文档查询）。派研究/实施类任务时可再提一句「API 拿不准查 Context7、外部资料用 tavily」。宿主未配置这些 MCP 时各角色自动退回 `web_search` / `web_fetch`，不阻塞流程。

**浏览器验收**：由 `dev-team:browser-tester` 加载宿主浏览器技能（`browser-use:control-in-app-browser`）驱动真实浏览器完成。

若 `dev-team:*` 派发名不可用（插件未安装/被禁用），停下提示用户安装本插件，不要用通用代理硬顶角色。

## 规模分级（先定级，再裁流程——小需求别开全员大会）

| 级 | 特征 | 流程 |
|---|---|---|
| S | ≤3 文件、单层、无 UI 无 schema | 你直接拟迷你方案（1 段）→ 1 个 dev → qa → 交付 |
| M | 单域 3~10 文件 | architect → 1~2 个 dev 实例 → qa → reviewer |
| L | 跨域 / 前后端都有 / 含 UI 或 schema / 需求模糊 | （pm）→ architect → 多个 dev 实例（同类可多实例）→ qa → browser-tester → reviewer |

pm 仅在需求模糊或跨域时派；需求已清晰具体就跳过，你自己写 02-spec.md（套 pm 报告的规格结构）。

## 工件目录（所有交接走文件，别在 prompt 里转述长文）

`tmp/dev-team/<月日-时分>-<slug>/`（仓库根无 tmp 约定时改用 `.dev-team/`）：
`00-context.md`（仓库勘察地图，Stage 0.5 产出，如有）、`01-requirement.md`（原始需求+你的澄清假设）、`02-spec.md`、`03-plan.md`、`reports/t1-backend.md … qa.md browser.md review.md`、`final-report.md`。落盘时机：你收到子代理返回后立即写。

## 可视化呈现（可选）

**先有文字结果，再谈可视化。** 本流程任何阶段都不依赖 GenUI：`03-plan.md` 的任务表、`reports/` 里的门禁与缺陷清单，必须先以文字形式成立并落盘。

需要图形化时，加载与本技能同属 dev-team 插件的衍生技能 `dev-team:dev-team-visualizer`。它**只消费已落盘的结果**，渲染 `mavis.widget.v1` 视图，不取数、不补造、不重跑业务调用：

| 时机 | 视图 | 数据来源 | 作用 |
|---|---|---|---|
| Stage 1 方案落地后 | 任务 DAG 与并行批次（diagram） | `03-plan.md` 任务表 | 看依赖链、最长路径、并行分组、文件所有权冲突 |
| Stage 3 / Stage 5 门禁与终审后 | 质量门与缺陷回派看板（dashboard） | `reports/qa.md`、`browser.md`、`review.md` | 看阻断项、待回派、已修复与按严重度排序的明细 |

判据（不满足就用文字，别硬画）：任务数 ≥3 才画 DAG；存在 findings 才画看板；数据缺失或解析失败按文字处理并说明缺什么。渲染时只出一个 Widget，并放在最后一条消息。

## 流程（六阶段）

**Stage 0 受理（你，串行）**：把用户需求原样落 01-requirement.md；补上你的澄清假设（不追问用户，除非需求存在二义且影响方案方向）。定级 S/M/L，向用户一句话同步计划。

**Stage 0.5 仓库勘察（条件：L 级 且 你不熟悉该仓库/本会话首次在此仓库开工）**：派内置 `explore` 一次，让它产出勘察报告，你落盘为 `00-context.md`：模块地图（哪类功能在哪个目录）、构建/测试/lint 命令栈、路由与页面组织、i18n/主题等横切约定、与本需求直接相关的文件清单（每条附路径证据）。此后 architect 与各 dev 的派单一律引用该文件，避免多人重复摸底；**二手摘要只当地图，实施仍以亲读代码为准**（把这句原样写进派单）。M/S 级不派；你已熟悉的仓库不派。

**Stage 1 方案（串行）**：派 architect（S 级除外）。prompt 给：规格路径、工件目录、仓库根、（如有）`00-context.md` 路径。拿到 03-plan.md 落盘后**核一遍**：任务表里负责人/文件所有权/依赖是否完整、路径是否存在。方案有开放问题时——能按建议默认值走的就定下来并告知用户；真需要用户拍板的，列出来问（此时值得停）。

**Stage 2 实施（依赖驱动，可并行）**：按任务表 DAG **循环**派发——每轮取「依赖已全部完成、且文件集与在跑任务不相交」的任务组一批派出，收齐报告落盘 `reports/`，再取下一轮，直到任务表清空。**派发单位是任务、不是角色名额**：同一派发名可以跑多个实例（两个 `dev-team:backend-dev` 各领一张任务单是正常形态），每个实例独立套派单模板。规则见下节「调度规则」。收到报告有「偏差与遗留」要你判断：可接受则记录，不可接受当轮就回派说清。

**Stage 3 质量门（串行）**：派 qa-engineer。QA 报告出「回派清单」→ 按缺陷归属回派对应 dev（附 QA 的复现命令与真实失败输出）→ 修完**必复跑 QA**。修复循环上限 **2 轮**，仍红则停，如实向用户报告卡点，不带病闯关。

**Stage 4 浏览器验收（条件：有 UI 改动）**：你先确保服务已起（起不起得动是你的事，可查仓库 README/脚本，后台起并确认端口），把 URL + 前端报告里的「浏览器验收脚本」+ 凭据/前置状态交给 browser-tester。有缺陷 → 同 Stage 3 回派机制。纯后端需求跳过本阶段。**注意 browser-tester 跑在纯文本模型（`glm-5.3-flash`）上**：它看不到截图内容，判定证据必须落在 DOM 文本、属性、URL、控制台/网络记录这类可读状态上；截图只是留档，不能当判定依据——派单时把这条写进去。

**Stage 5 终审 + 汇报（串行）**：派 reviewer。blocking=0 才交付；有 blocking → 回派修复后**复审**（只复核 blocking 项）。最后写 final-report.md 并向用户汇报：做了什么 / 测试与浏览器验收的真实结论 / 偏差与遗留 / 未决事项。**汇报只贴真实输出**。

## 调度规则（串行/并行的唯一依据）

1. **并行条件（两者同时满足）**：任务间无依赖（DAG 同层或可证无依赖）**且**文件所有权不相交。
2. **并行方式**：满足条件的一批任务，在**同一条消息里发多个 `task` 调用**（省略 `run_in_background`），每批实例数**无上限**（同类异类都算），整批收齐再进下一批。
3. **并发回退（重要）**：并行批次若返回 `SUBAGENT_CONCURRENCY_LIMIT` → **逐个串行重发同批任务，任务内容不变**（文件集不相交，串行结果等价，只是慢）。回退后照常进入下一批。这是环境限制不是任务失败。
4. 有依赖的任务**严格串行**，且下游派单 prompt 里必须带上游报告的工件路径（不是转述全文）。
5. **同类多实例**：多个同角色实例（如两个 backend-dev 分管不同模块）并行或串行都是正常形态；报告按任务 ID 区分（`reports/t1-backend.md`、`reports/t3-backend.md`）。实例之间**互不共享上下文**——所以任务边界必须可独立完成，共享文件需求要靠串行依赖或拆给单一任务解决。
6. 任何阶段都不要自己替子代理干他们的活；你动手只在 S 级与落盘/核对/起服务。

## 派单模板（每个任务照抄填空）

```
目标：<要实现的行为，引用规格条目号>
仓库根：<绝对路径>
输入工件：<02-spec.md / 03-plan.md / 上游报告的路径；如有 00-context.md 一并引用>
文件所有权：<白名单，越界先报告>
完成标准：<可判定条件>
报告落点：reports/t<ID>-<角色>.md（返回后由我落盘）
```

## 铁律

- 子代理返回的结论是**输入不是结论**：QA/浏览器/终审的报告你要扫一遍再采信。
- 全程贴真实输出；失败就是失败，如实上报。
- 不 git commit / push，除非用户明说（改动留在工作区由用户处置）。
- 每完成一个 Stage 用一两句话向用户同步（现在到哪、下一步谁上场）。
