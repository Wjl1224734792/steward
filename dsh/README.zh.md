# Steward · 长期维护型研发团队（DSH 插件）

Steward 是给 DeepSeek Harness 用的多角色研发团队插件：主对话代理担任 **Tech Lead**，把需求拆成任务 DAG，按「依赖 + 文件所有权」把任务派给对应角色的子代理，走完计划批准门、QA、浏览器验收与终审才交付。

目标不是「一次把代码写完」，而是让项目在每次变更后仍然**可理解、可验证、可回滚、可继续演进**。

插件只用 DSH 原生扩展点：角色 = **派单时注入的章程**（`roles/*.md`，**不注册 Agent Preset**，因此不占模式选择器），模型路由 = 项目根 `steward.config.json` 优先、其次**设置页**，派发 = `steward_dispatch` over `ctx.subagents`（子代理跑内置 `standard` 组合），人类入口 = `/steward-roster` 原生命令（`/steward` 是触发 `steward` 技能的斜杠手势，手势后接空格或直接回车），技能 = `ctx.skills`，界面 = **每会话一份的右侧栏团队面板**（默认**以主代理为中心向外辐射的可拖拽画板**，可一键整理为辐射 / 鱼骨 / 树状；连线是 Lead→每个子代理，节点带角色 / 实际模型 / 任务 / 状态 / 耗时 / 用量，点节点进子会话，顶部一条原生任务进度条）+ **设置 → Steward 的模型表格**，只用原生 slot / configForms / 原生会话跳转，无自建 HTTP 桥。

## 安装

前置：本机装有 Node.js。`dsh/` 是 `host/dsh/build.mjs` 的生成物，**安装前先在源码仓库重建**：

```powershell
node host/dsh/build.mjs            # 重建 dsh/（只写 dsh/，不碰 ZCode / MiniMax / shared）
node host/dsh/build.mjs --check    # 期望 PASS 且零 warning
```

然后在 DSH 里用插件管理器安装本地 bundle 目录：

```text
plugin_manager(action="install_bundle", target="<repo>/dsh")
```

装完**重启 DSH**（Host 代码在重启后加载），再开**新会话**使用——技能目录是会话级快照，旧会话可能仍显示上一版文案。升级 = 对同一目录重新 `install_bundle` 并重启；开发期热重载可用插件管理器的禁用 / 启用。插件安装目录不需要也不应运行构建器。

## 安装后你会得到

| 能力 | 形态 |
|---|---|
| 7 个角色 | 派单时注入的角色章程（`roles/*.md`）：pm、architect、backend-dev、frontend-dev、qa-engineer、browser-tester、reviewer。**不注册 Agent Preset**——角色不会出现在模式选择器里 |
| 派发 | `steward_dispatch(role, description, prompt, cwd?)`：一个角色一次调用，章程自动拼进派单正文，返回子会话 id，结果自动回传 |
| 模型与档位 | 项目根 `steward.config.json` 的 `modelRouting.<role>`（仓库优先，跑 `scripts/validate-config.mjs`）；没写的角色用**设置 → Steward** 里的该角色 / 默认配置；都没有则继承主代理 |
| **右侧栏团队面板** | 每会话一份，三种打开方式（会话标题栏的 Steward 图标 / 右侧栏引导页 / 首次派发自动打开）：**默认是自由拖拽 / 缩放的思维导图画板**——`Lead` 在视觉中心，子代理按角色向两侧辐射（空阶段自动省略）；工具栏可一键整理为**辐射 / 鱼骨 / 树状**（`⟲` 按上次选择重新布局），卡片始终可**自由拖动**；连线是 Lead → 每个子代理的星形、无箭头；工具行可**过滤**（`全部 / 隐藏已完成 / 只看活跃`，选择会记住）；节点显示角色 / **实际模型**（provider/model + 思考强度）/ 任务 / 状态（等待输入 / 运行中 / 待开始 / 已完成 / 空闲）/ 耗时 / tokens，**点节点在右侧栏打开子会话**，点 `⌄` 原地展开详情（提供方 / 四类 token / 轮次·步骤 / 模式 / 子会话 id）；拖空白处平移、`Ctrl`+滚轮或工具栏缩放、双击复位。顶部是**原生任务进度条**（只给 `完成/总数` 与来源，不列任务名）；底部是可折叠的产物区（`tmp/steward/<run>/`，点一行打开文件）。任务列表本身用 DSH 自带的，面板不再复制一份 |
| 主技能 | `steward`：Tech Lead 调度手册（定级 / DAG / 派单 / 门禁 / 收尾） |
| 文档入口（4 个） | `docs-new`（新建项目，01→07 建基线）、`docs-takeover`（接手存量，先盘点落位再补）、`docs-feature`（单个功能 / 需求变更，只改受影响阶段）、`docs-review`（派 reviewer 独立评审 + 签发收据）。**一个场景一个入口，不再「一个技能全走」** |
| 文档规范总库 | `docs-rules`：七阶段规范正文、SSOT 地图、变更联动表、模板索引（**不是入口**） |
| 文件就绪硬门 | `scripts/docs-ready.mjs`：阶段产物 / 空壳 / 占位符 / `na` 理由 / FR↔FP 追溯 / 计划 `docsRead` / 评审机读结论逐项机检；收据 `.steward/docs-state.json` 通过后 `backend-dev` / `frontend-dev` 才允许派发 |
| 按需技能 | `inline`（主代理自己动手时的硬动作与范围）、`docs-governance`（文档拆分 / 归档 / 版本快照与 `docs-gate` / `doc-snapshot` 门禁的增量层） |
| 配套技能 | `using-steward`（路由）、`agent-settings`（模型配置）、`systematic-debugging`、`tdd`、`verification-before-completion` |
| 共享任务板 | `steward_board(action="sync"/"status"/"brief")`：把 `03-plan.json` 变成 Agent Teams 板上的门禁 + 工作单；任务状态在**原生 Team 面板**里看，右侧栏团队面板只显示进度计数与来源 |
| 命令 | `/steward-roster`：回显名册与路由口径（不负责派活）；`/steward` 是触发 `steward` 技能的斜杠手势 |
| 门禁脚本 | `scripts/`：`validate-plan.mjs`、`verify.mjs`（含 `baseline record/check`）、`run-state.mjs`、`maintain.mjs`、`take-over.mjs`、`validate-config.mjs`、`docs-ready.mjs`（文档就绪收据）、`docs-gate.mjs` / `doc-snapshot.mjs`（文档治理），以及 `doc/` 文档流水线工具 |

## 为什么不注册模式（Agent Preset）

DSH 里 preset 就是**用户可选的会话模式**，没有「内部 preset」这种东西。把 7 个角色做成 preset，等于把「Steward · 后端工程师」这类**可写的专员模式**摆进选择器：用户切过去随手改代码，就得到一个绕开计划门、基线守卫、QA 与终审的假 Steward——正好把本插件唯一的价值（流程与门禁）绕掉。

所以 DSH 侧不注册任何 Agent Preset：Steward 是一套流程（技能 + 工具 + 门禁脚本），`steward_dispatch` 让子代理跑在 DSH 内置的 `standard` 组合上，把该角色的**章程**拼在派单正文前面。代价是工人拥有 `standard` 的全套原生工具（委派深度默认 1，会挡住「工人再派工」），收益是模式选择器干净、也没有一套要和 DSH 升级同步的 preset 组合要维护。

## 为什么把路由放在项目里

同样的道理：**配置的第一来源是项目本身**。子代理的模型与思考强度写在项目根 `steward.config.json` 的 `modelRouting.<role>`——它跟代码一起进仓库、进同一个 diff、可评审可回滚，并且能用随包的 `validate-config.mjs` 机检。项目里没写的角色才落到**设置 → Steward** 里的原生 Config（namespace `steward`），再没有就继承主代理。这样「这个仓库里 QA 用哪个模型」永远有确定答案，不会被某台机器的临时设置盖掉。插件**不带** `steward_config` 工具，也**不自建**私有配置文件或 HTTP 桥。

## 共享任务板与右侧栏团队面板（Agent Teams）

宿主启用「智能体团队」后，共享任务板是任务状态的**权威来源**；**会话页头的原生 Team 面板**是读任务详情的地方（成员状态、负责人、依赖、就绪态、写入范围与文件重叠告警）。Steward 的**右侧栏团队面板**不再复刻任务板，只做两件事：**画智能体**（谁在哪、用什么模型、在做什么、跑到哪）与**数任务**（顶部进度条只给 `完成/总数`、进行中 / 被阻塞计数和来源）。`steward_board(action="sync", plan="<工件>/03-plan.json", level="M")` 把计划变成板上的原生任务（幂等，按描述里的 `steward:plan=` / `steward:gate=` 标记匹配）：

| 板上任务 | 来源 | 在原生 Team 面板里能看出什么 |
|---|---|---|
| `G1 · 计划批准` | 门禁 | 未完成时所有工作单 claim 不上（原生依赖闸门，绕不过去） |
| `T<id> · <role> · <标题>` | `03-plan.json` 的 tasks | 状态点、负责人、依赖、就绪态；写范围来自文件所有权，重叠会出告警 |
| `G2 · QA 门禁` / `G3 · 终审` | 门禁 | 依赖全部工作单 / 依赖 QA，流程顺序在板上一目了然 |

- 任务描述是固定块：目标、完成标准、所有权、报告落点、覆盖的 AC，外加 `steward:plan=` / `steward:role=` 标记（Team 面板里两行摘要 + 展开可读全文）。
- 状态口径：`pending` 未开始 / `in_progress` 有人在做 / `completed` 报告已落盘且该任务所有权内验证通过。**被依赖阻塞的任务 claim 不上**——Steward 的 DAG 与门禁在原生层执行。
- 派活：`steward_board(action="brief", role="backend-dev", task="T1")` 取自包含任务书 → `spawn_teammate` → `team_task_update(action="reassign", owner=<teammate>)`；teammate 先 claim 再动手。
- 没启用团队时没有 `agentTeams` 服务，`steward_board` 直接报错，回到 `steward_dispatch` + `run.json` 的单人模式；右侧栏团队面板的进度条此时回落到会话任务列表（`todo_write` 的 `todos` 投影），智能体工作流图不受影响。

## 文档入口与开发硬门（docTier=3）

文档不再是一个「全走」的技能：按场景分成三个入口 + 一个审查入口，规范与模板单独成库。

| 你说的 | 加载 | 管到哪 |
|---|---|---|
| 新建项目 / 从零搭文档基线 | `docs-new` | 01-需求（PRD→FRD）→ 02-架构 → 03-契约（+05-页面）→ 06-测试基线 → 07-治理件 → 闭环 → 审查 → 收据 |
| 接手存量仓库 | `docs-takeover` | `take-over.mjs` 生成 T1 → 盘点与落位映射（需拍板）→ `docs-gate --baseline-write` 记基线 → 按缺口补齐 |
| 单个功能 / 需求变更 | `docs-feature` | 影响面扫描 → 打包需拍板项 → 只改受影响的阶段（其余 `na` + 理由）→ 联动表同批落档 |
| 审查 / 能不能开工 | `docs-review` | reviewer 全新实例（干净上下文、只读）→ 结论落 `docs/07-治理/评审记录/` + 机读块 → `approve` |

**硬门不是提示词**：`steward.config.json` 配了 `docTier: 3` 后，`steward_dispatch` 在派 `backend-dev` / `frontend-dev` 前会校验 `.steward/docs-state.json` 的收据与文档哈希，未通过直接拒绝（`architect` / `reviewer` / `qa-engineer` / `browser-tester` 不受限，留人补文档与评审）。收据只由脚本签发：

```bash
node scripts/docs-ready.mjs <root> init --scope new|takeover|feature --write   # 声明范围
node scripts/docs-ready.mjs <root> check [--plan <03-plan.json>] [--strict]    # 闭环机检
node scripts/docs-ready.mjs <root> approve --review <评审记录>                  # 签发收据
node scripts/docs-ready.mjs <root> status                                      # 现状（含 stale）
```

判据与错误码（`E-DOC-MISSING` / `E-DOC-PLACEHOLDER` / `E-DOC-THIN` / `E-NA-REASON` / `E-PLAN-DOCSREAD` / `E-PLAN-NA-CONFLICT` / `E-STATE-STALE` / `E-REVIEW-*`）都在 `docs-ready --help` 与 `docs-rules` 技能里。口径类文档（PRD / FRD / 架构 / 契约 / 页面 / 测试方案）改一次收据即失效——`执行步骤.md`、`评审状态.md`、`评审记录/` 已从哈希里排除，日常销项不会触发重审。

**回滚**：把 `docTier` 改回 1/2 即关闭整套门禁（不需要改代码），变更记进 `05-record.md`。

## 文档治理（`docs-governance`，增量层）

`docs-new` / `docs-takeover` / `docs-feature` 管**建与补**，`docs-governance` 管树建好之后**别长成屎山**：拆分、归档、版本、读契约。触发语：「文档太长了」「评审记录堆在 07-治理」「需求文档要留版本」。

| 三类文档 | 生长方式 | 治理手段 |
|---|---|---|
| 活文档（AGENTS / README / docs 地图 / T1 / 单册） | 原地修订，同一主题只一份 | 体积预算（100 / 120 / 150 / 120 / 400 / 150 行）+ hub-and-spoke 拆册 |
| 记录文档（ADR 单条、评审记录单篇） | 只增不改，单条不可变 | 薄索引（恒读）+ 按季 `archive/` 轮转 |
| 基线文档（PRD / FRD / API 契约 / 数据模型） | 原地修订 + 里程碑快照 | frontmatter `version` + 修订记录 + 同域 `history/` 快照与 sha256 清单 |

两个随包脚本（纯 Node、零依赖，在目标仓库根用绝对路径运行）：

| 脚本 | 作用 |
|---|---|
| `scripts/docs-gate.mjs <root> check` | G1–G11：体积预算、frontmatter 读契约、AGENTS 无 frontmatter、07 分层、自动索引区块、ADR 双向、版本三处一致、快照完整性、现版不入历史、修订依据、计划 `docsRead` |
| `scripts/docs-gate.mjs <root> init` / `fix` | 建 07 内部分层与各域 `history/` 骨架；重写 `docs/README.md` 自动索引区块（幂等不覆盖） |
| `scripts/doc-snapshot.mjs <doc> --next <ver>` | 基线快照：原文进 `history/` + manifest 哈希 + 索引行 + `superseded-by` + 现版 bump + 修订行（幂等，重跑输出 `skip`） |

预算与基线可在项目 `steward.config.json` 的 `docsGovernance` 覆盖；存量项目先 `--baseline-write` 记基线，此后只减不增。与 `doc-check.mjs` 并存不互替。

## Steward 右侧栏团队面板（每会话一份）

面板在会话的**右侧栏**里。DSH 的右侧栏本身按会话保存布局，所以**每个会话各开各的面板，切换会话就是切换面板**。打开方式三种：

1. 会话标题栏的 **Steward 图标**（`conversation.session.header.utilities`）；
2. **右侧栏引导页**（guide）里的「Steward 团队」入口；
3. **自动打开**：该会话第一次出现 Steward 派发（`steward_dispatch` 派出的子代理，label 形如 `backend-dev · T1 导出接口`）时自动打开一次；用户手动关掉后不再抢回。

**面板只回答一件事：哪个智能体、用什么模型、在做什么、到哪了。** 自上而下三块：

1. **任务进度条（原生任务）**：一行 `完成/总数` + 每任务一段（完成绿 / 进行中蓝呼吸 / 待开始灰 / 被阻塞橙）+ 进行中/被阻塞计数 + 来源（`Agent Teams 任务板` 或 `会话任务列表`）。**只给计数，不列任务名**——要读任务请用 DSH 自带的列表 / 原生 Team 面板。
2. **思维导图画板（默认辐射布局，自由拖拽 + 缩放画布）**：`Lead · 本会话` 在视觉中心（自己的实际模型与用量），子代理按角色向左右两侧展开（没有智能体的阶段自动省略）。工具栏可一键整理为辐射 / 鱼骨 / 树状，整理后仍可自由拖拽；连线一律从 Lead 指向每个子代理，无箭头。每个节点一屏可读：
   - 角色（中文名）与状态点（role id 见节点详情）；
   - **实际模型**：`model @ 思考强度`（取自该子会话的 `modelSelection` 投影，即真实跑过的模型；还没发过请求时显示「模型待定」，不编造）；
   - 任务描述（派单时的 description）；
   - 用时（运行中每秒刷新）与 tokens（四桶求和）。

   交互：图是**自由画布**——**按住节点拖动 = 移动这张卡**（位置按会话记在本地，工具栏 `⟲` 或快捷键 `r` 按上次布局预设重新整理），按住空白处拖动 = 平移画布；`Ctrl`/`⌘`+滚轮在指针处缩放，缩放与平移按会话记住；工具栏 `− / 100% / + / ⤢ / 辐射 / 鱼骨 / 树状 / ⟲`（点百分数复位、`⤢` 适应窗口、三个预设一键整理、`⟲` 重新布局），画布获得焦点后 `+` / `-` / `0` / `f` / `r` / 方向键可用，双击空白处复位。**点节点 = 在右侧栏打开该子代理会话**（拖动不会误开）；点右下角 `⌄` = 原地展开详情（提供方 / 思考强度 / 四类 token / 轮次·步骤 / 模式 / 子会话 id / 打开按钮）。第二行工具是**过滤**：`全部 / 隐藏已完成 / 只看活跃`（右端显示「已隐藏 N 个」，选择记在本地 `dsh-steward.panel.filters`）。
3. **产物区（默认折叠）**：`tmp/steward/<run>/` 下的文件（`run.json`、`03-plan.json`，以及 `reports/`、`evidence/` 里的报告与证据），点一行在右侧栏打开文件；运行目录显示在折叠标题下。

**数据全部来自原生实时投影**，没有任务文件轮询：

| 面板里看到的 | 来源（DSH 原生） |
|---|---|
| 子代理清单 / 角色 | `subagentCatalog` 投影（label = `角色 · 任务`） |
| 运行中 / **等待输入** | 会话 UI 状态（`useSessionStatus` 的 `running` / `pendingInteraction`） |
| 实际模型 | `modelSelection` 投影（`lastUsed`，否则 `next`） |
| tokens | `tokenUsage` 投影（uncachedInput / output / cacheRead / cacheWrite） |
| 用时 / 是否正常收尾 | `subagentTiming` 投影（`settledMs`、`active.since`、`lastTurnCompleted`） |
| 轮次 / 步骤（详情） | `sessionStats` 投影（面板按需向宿主请求一次子会话投影） |
| 任务进度 | `agentTeam` 投影（Agent Teams 共享任务板），没有则 `todos` 投影（会话任务列表） |
| 产物 / 运行目录 | workspace-files Remote，15s 轮询一次 |

面板**不读** `03-plan.json` 的任务内容、**不画**任务 DAG / 归属矩阵、**不复制**任务列表：任务状态由 DSH 原生任务系统负责（早期「面板里那份任务列表经常不更新」的根因就是复制了一份）。读不到产物时产物区显示一行说明，其余照常。

**设置页只留模型**：「设置 → Steward」分区只渲染逐角色模型与思考强度表格（角色 / 提供方 / 模型 / 思考强度 / 来源 + 默认兜底行 + 保存 / 撤销），运行面板不再出现在设置页。优先级口径不变：项目根 `steward.config.json` 的 `modelRouting.<role>` 优先 > 设置页该角色 > 设置页默认 > 继承主代理。

左侧导航里**不再有 Steward 页面**：面板只存在于右侧栏，不注册 Agent Preset、不写文件、不自建 HTTP 桥。

## 快速开始

1. **安装**：按上文「安装」一节执行——重建 `dsh/` → `install_bundle` 指向 `<repo>/dsh` → 重启 DSH。

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
| 新建项目文档 | 「新建项目 / 初始化七阶段文档」→ `docs-new`：01→07 建基线，审查通过后签发收据 |
| 接手存量文档 | 「接手这个仓库 / 存量项目补文档」→ `docs-takeover`：先盘点落位，再按缺口补齐 |
| 单个功能文档 | 「给这个功能写文档 / 这个需求要动哪些文档」→ `docs-feature`：影响面 → 只改受影响阶段 |
| 审查文档 | 「审查文档 / 文档齐了吗 / 能不能开工」→ `docs-review`：reviewer 全新实例评审 → 评审记录 → `approve` |
| 文档规范与模板 | 「PRD/FRD/契约怎么写」→ `docs-rules`（总库，不是入口） |
| 文档治理 | 「文档太长了 / 评审堆在 07 / 需求文档要留版本」→ `docs-governance`：拆分、归档、`history/` 快照、`docs-gate` / `doc-snapshot` |
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
- DSH 侧的范围：技能（主技能 + 按需 `inline` / `docs`）、角色（派单注入章程，不注册模式）、模型路由（项目配置优先 + 设置页）、派发、**右侧栏团队面板**（每会话一份；默认以主代理为中心的可拖拽思维导图画板（辐射 / 鱼骨 / 树状一键整理，连线 Lead→每个子代理），节点带角色 / 实际模型 / 任务 / 状态 / 耗时 / 用量；顶部原生任务进度条只给计数）与设置页模型表格、共享任务板（Agent Teams）、`/steward-roster` 名册命令与门禁脚本已对齐。ZCode/MiniMax 的 `PreToolUse` 守卫 hooks 尚未移植（DSH 的工具守卫是宿主内另一套机制）。浏览器验收按「仓库自带 Playwright → DSH 侧栏人工驱动 → 人工兜底」三级。

## 通用 harness 技能投放（不装整包，只投 4 个技能）

Steward 有 4 个**宿主无关**的纯指令技能——不依赖子代理 / 命令注册 / hooks，正文都在本仓库 `shared/skills/` 下，任何支持「技能目录」的 harness 都可以不装整包、直接投放：`systematic-debugging`（系统化调试纪律）、`tdd`（测试先行纪律）、`verification-before-completion`（完成前验证纪律）、`project-lifecycle`（项目全生命周期规范，随包带 `references/` 与 `assets/`）。

- **项目级**（只对该仓库生效）：复制到 `<目标仓库>/.agents/skills/<技能名>/`；
- **用户级**（该机器所有项目生效）：复制到 `~/.agents/skills/<技能名>/`。DSH 原生按这两条路径发现技能（`dsh-skill-filesystem` 的 project-agents / user-agents 两个发现根）；其它 harness 按各自的技能目录约定放置即可。

可复制的命令（PowerShell，项目级；`<repo>` 换成本仓库检出位置，`<目标仓库>` 换成要投放的项目）：

```powershell
$src = "<repo>\shared\skills"; $dst = "<目标仓库>\.agents\skills"
New-Item -ItemType Directory -Force "$dst" | Out-Null
'systematic-debugging','tdd','verification-before-completion','project-lifecycle' |
  ForEach-Object { Copy-Item -Path "$src\$_" -Destination "$dst\$_" -Recurse -Force }
```

用户级把 `$dst` 换成 `"$env:USERPROFILE\.agents\skills"`（或设 `DSH_AGENTS_HOME` 指向自定义目录）即可。纯目录复制（SKILL.md + references/assets），**不需要任何 npm/npx 安装器**，新会话起生效。

## 排障

- **输入 `/steward` 回显的是名册而不是技能正文**：1.1.0 起名册命令已改名 `/steward-roster`，`/steward` 恢复为触发 `steward` 技能的斜杠手势——若仍回显名册，说明装的是旧版本，重新 `install_bundle` 并重启 DSH。
- **`/steward` 手势没触发技能**：手势要求 `/steward` 后接空格（或直接回车），连写（如 `/steward做个X`）不识别为手势；用自然语言「用 Steward 做 <需求>」最稳。
- **装完没变化**：Host 代码在 DSH 重启后才加载；技能目录是会话级快照，开**新会话**；开发期可用插件管理器的禁用 / 启用热重载。
- **手改 `dsh/` 被 `--check` 拦下**：`dsh/` 是生成物，改正文（`shared/` 或 `host/dsh/`）后重跑 `node host/dsh/build.mjs`。
- **模型路由不生效**：`steward.config.json` 的 `modelRouting.<role>` 格式错误（如 `model` 缺 `provider/` 前缀）按「没配置」处理、降级继承主代理；跑 `node <包>/scripts/validate-config.mjs <项目根>/steward.config.json` 校验结构。
- **已知限制**：包内 `scripts/validate-config.mjs` 直接运行会因缺宿主专有模块 `agent-config-core.mjs` 报错（该模块不随 DSH 包分发；不影响 `steward_dispatch` 的项目级路由读取——那是插件运行时自己解析的）；需要机检时到源码仓库对同源脚本运行。

## 更多

- 仓库与完整说明（中文）：<https://github.com/Wjl1224734792/steward>
- English: <https://github.com/Wjl1224734792/steward/blob/main/dsh/README.en.md>
- 变更记录：<https://github.com/Wjl1224734792/steward/blob/main/CHANGELOG.md>
- 路线图：<https://github.com/Wjl1224734792/steward/blob/main/docs/ROADMAP.md>
- License: MIT
