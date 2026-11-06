# Steward 组件配方

三个领域配方，均只消费 Steward 业务流已落盘的结构化结果。数据契约见 `data-schema.json`，完整可运行示例见 `examples.md`。

通用约束（继承 `references/genui-widget/` 基座，不可放宽）：

- 只用 `--mw-*` 主题令牌，禁止硬编码背景/文字/边框色，禁止 `var(--mw-*)` 回退值。
- 脚本只从 `window.__mavisData['<name>']` 取数，禁止从 DOM 反推数据，禁止 `eval` / `new Function` / `fetch` / `localStorage`。
- 默认只输出**一个** `<mavis-widget>`，且必须是最后一条助手消息；其后不得再调工具。
- `sendPrompt` 的 `text` 与 `userIntent` 一律使用会话语言（本插件面向中文场景，默认中文）。
- 数字全部取整展示；`text` 必须是用户可读的问题，不写隐藏指令。

## 视觉基线（配方 A/B/C 共用）

看板不是「把数据摆出来」，而是让人一眼看出**先做什么、风险在哪、趋势往哪走**。三个配方共用同一套版式与组件，避免风格漂移：

| 项 | 规范 |
|---|---|
| 间距 | 外边距 16px；区块间距 12px；卡片内边距 14–16px；行内元素 6–8px |
| 圆角 | 卡片/面板 12px；行/按钮/输入 8px；徽标/小标签 6px |
| 字号 | 区块标题 14px/500；正文与表格 12–14px/400；分数与 KPI 数字 24–40px/700；最小 12px |
| 数字 | 一律 `font-variant-numeric: tabular-nums`；显示前取整，不用科学计数法 |
| 色彩 | 语义色（success/warning/danger）只用于分级、状态与趋势方向；类别/负责人用中性色，最多用 `--mw-accent` 标「当前项」或「最多」 |
| 结构 | 一律 CSS Grid/Flex；`header → 概览 → 分布/矩阵 → 明细 → 动作条`；无 float、无 `position: fixed` |
| 交互 | 筛选/排序/展开全部本地完成；`focus-visible` 用 2px `--mw-accent` 描边；点击目标 ≥28px 高 |
| 响应式 | 断点 760px：双栏概览堆叠，表格行转两行卡片，隐藏次要列但保留标题、状态与主指标 |
| 禁止 | 阴影、渐变、模糊、发光、`border-left` 圆角卡片、emoji、大写转换、字距调整、硬编码主题色 |

组件约定：**KPI 卡**（标签 12px muted + 数值 24px/700 + 一行注释）、**状态徽标**（语义色文字 + 1px 同色边框，不用实心色块）、**筛选芯片**（选中态 accent 边框 + `--mw-surface-muted` 背景 + `aria-pressed`）、**得分条**（4px 高轨道 + accent 填充 + 右侧数值，数值必须可见）、**详情面板**（`--mw-surface-muted` 背景、证据用等宽字体、动作按钮右对齐）。

---

## 配方 A：任务 DAG 与并行批次视图

### 业务问题与选择规则

**问题**：这一轮能并行派发哪些任务？谁在等谁？哪两个任务抢同一批文件、不能同时跑？

**选择规则**：`03-plan.md` 的任务表中存在 ≥3 个任务，且用户关心调度顺序、并行批次或文件所有权冲突时渲染。任务数 ≤2 时保持文字表格即可——两个节点画不出 DAG，强行渲染只是装饰。

### 输入字段

| 字段 | 必需 | 单位 | 缺省 | 出处 |
|---|---|---|---|---|
| `tasks[].id` | 是 | — | — | 03-plan.md 任务表 |
| `tasks[].title` | 是 | — | 截断至 14 字 + `…` | 同上 |
| `tasks[].owner` | 是 | 角色名 | — | 同上 |
| `tasks[].deps` | 是 | 任务ID数组 | `[]` | 同上 |
| `tasks[].files` | 是 | 文件路径数组 | `[]` | 同上 |
| `tasks[].criteria` | 是 | — | — | 同上 |
| `tasks[].status` | 否 | — | `pending` | Tech Lead 落盘时回填 |
| `batches` | 否 | 批次 | 由 `deps` 拓扑推导 | 同上 |
| `conflicts` | 否 | 冲突对 | 由 `files` 求交集推导 | 同上 |

### Widget 形态

- `kind="diagram"`，`capabilities="resize,sendPrompt"`。
- 语义层级：**批次泳道（列）** → **任务卡** → **任务详情检视面板**。列从左到右 = 依赖推进方向（上游在左）。
- 顶部一行三个概览数字：任务总数、最长依赖链层数、可并行批次数。
- 任务卡内含：任务ID、负责人色点、标题、依赖摘要（`依赖 T1` / `无上游`）、文件数、状态徽标。文件所有权有冲突时整卡用 `--mw-danger` 描边并显示冲突角标。
- 负责人配色使用 `--mw-chart-1` ~ `--mw-chart-6` 轮转，图例用 HTML 自绘，不用 Chart.js（节点数少且无连续量纲）。

### 本地交互

1. 点击任务卡 → 右侧检视面板更新，展示该任务完整的**文件所有权清单**与**完成标准**（纯本地，不发 prompt）。
2. 点击批次列头 → 高亮该批次内全部任务卡，其余降为次要色（本地过滤）。
3. 点击「冲突」概览 → 展开冲突文件清单（本地）。

### 推理跟进（sendPrompt）

仅在用户点击任务卡的「展开派单」按钮时触发，payload 只带稳定标识与最小必要字段：

```json
{
  "taskId": "T2",
  "owner": "frontend-dev",
  "title": "登录页表单与三语文案",
  "deps": ["T1"],
  "fileCount": 2,
  "batchIndex": 2
}
```

`text` 示例：「请为任务 T2（登录页表单与三语文案，负责人 frontend-dev）展开完整派单：文件所有权白名单、依赖上游产物路径与可判定的完成标准。」

### 状态表现

| 状态 | 表现 |
|---|---|
| 加载 | 保留三数字概览位与列骨架，数字显示 `--`，卡片位为 `--mw-surface-muted` 占位块 |
| 空 | 保持布局，居中一行「尚未产出 03-plan.md 任务表，无法渲染任务 DAG」 |
| 错误 | 保留布局，卡片区顶部内联一行「任务表解析失败，以下为原始表格」并附最小可用表格，不整页报错 |
| 权限/鉴权 | 本配方不涉及鉴权；若工件目录不可读，按空态处理并提示先跑完 Stage 1 方案 |

### 文本回退

不渲染 Widget 时，输出 Markdown 任务表（任务ID / 负责人 / 依赖 / 文件数 / 状态）加一段「并行批次：第 N 批 = T…、T…」，并说明文件所有权冲突项。

---

## 配方 B：质量门与缺陷回派看板

### 业务问题与选择规则

**问题**：现在还有多少必须修的缺陷？分别归谁？已经回派了几轮、还剩几轮？

**选择规则**：`reports/` 下 QA、浏览器验收、终审任一报告产出 findings 时渲染。缺陷为 0 且门禁全绿时仍渲染（交付就绪状态本身是结论），但用空态文案而非空图。

### 输入字段

| 字段 | 必需 | 单位 | 缺省 | 出处 |
|---|---|---|---|---|
| `findings[].id` | 是 | — | — | qa.md / browser.md / review.md |
| `findings[].stage` | 是 | `qa`/`browser`/`review` | — | 同上 |
| `findings[].severity` | 是 | `blocking`/`non-blocking`/`suggestion` | — | 同上 |
| `findings[].location` | 是 | 文件:行 | — | 同上 |
| `findings[].summary` | 是 | — | — | 同上 |
| `findings[].owner` | 是 | 角色名 | — | 同上 |
| `findings[].repro` | 是 | 命令/步骤 | — | 同上 |
| `findings[].status` | 是 | `open`/`rerouted`/`fixed`/`waived` | `open` | 同上 |
| `gates[]` | 否 | 检查项 | `[]` | 同上 |
| `rounds` | 否 | 轮（上限 2） | `{}` | Tech Lead 落盘 |

### Widget 形态

- `kind="dashboard"`，`capabilities="resize,sendPrompt"`。
- 语义层级：**KPI 行**（4 张：阻断项、待回派、已修复、三类门禁通过情况）→ **严重度分布条** → **缺陷明细表**（按严重度排序）。
- 严重度分布是 3 个桶的可比数据点（≤5），用 CSS bench 条渲染，**不调用 Chart.js**。
- 明细表每行一个发现：级别、阶段、位置、问题摘要、归属、状态。级别用 `--mw-danger` / `--mw-warning` / `--mw-text-muted` 三档语义色，并在表头给出一行图例。

### 本地交互

1. 点击阶段筛选芯片（全部 / QA / 浏览器 / 终审）→ 表格行本地过滤，KPI 数字同步重算。
2. 点击「只看未修复」→ 本地过滤 `status !== 'fixed'`。
3. 悬停严重度 bench 条 → CSS tooltip 显示计数。

### 推理跟进（sendPrompt）

点击缺陷行的「回派」按钮触发，payload 携带该发现的稳定标识：

```json
{
  "findingId": "F1",
  "stage": "qa",
  "severity": "blocking",
  "owner": "backend-dev",
  "location": "src/modules/auth/session.ts:42",
  "summary": "会话过期后仍可继续调用受保护接口",
  "repro": "pnpm test src/modules/auth/session.test.ts",
  "status": "open"
}
```

`text` 示例：「请按缺陷 F1（blocking，归属 backend-dev，src/modules/auth/session.ts:42）回派给 backend-dev 修复，附上复现命令 pnpm test src/modules/auth/session.test.ts 与真实失败输出；修复后必须复跑 QA。」

### 状态表现

| 状态 | 表现 |
|---|---|
| 加载 | KPI 数字 `--`，bench 条为占位块，表格区保留表头与 3 行占位 |
| 空 | KPI 数字为 0，表格区居中一行「QA、浏览器验收、终审三类门禁均无发现」 |
| 错误 | 保留布局，表格区顶部内联一行「部分报告缺失或解析失败」，只渲染解析成功的发现 |
| 权限/鉴权 | 本配方不涉及鉴权；报告不可读时按错误态呈现，不伪造门禁结论 |

### 文本回退

输出按严重度分组的 Markdown 清单：每条给出来源阶段、级别、位置、问题、归属、复现命令、状态，并注明修复循环已用轮次与剩余轮次。

---

## 配方 C：维护健康看板

### 业务问题与选择规则

**问题**：这次维护扫描最该先修什么？健康在变好还是变差？哪一类问题在堆积？

**选择规则**：`maintain.mjs` 产出了 `reports/maintenance-*.md`，或 `docs/project/HEALTH.md` 有维护 backlog 时渲染。backlog 为空也要渲染——健康态本身是结论，用空态文案而不是空图。只有健康分/日期、没有任何 backlog 与类别计数时，退回文字说明缺什么。

### 输入字段

| 字段 | 必需 | 单位 | 缺省 | 出处 |
|---|---|---|---|---|
| `date` | 是 | — | — | maintain 报告 / HEALTH.md |
| `score` | 是 | 分（越低越好） | — | maintain.mjs 健康分 |
| `categories` | 否 | 个（扫描计数） | 八类补 0 | maintain.mjs 分类计数 |
| `history` | 否 | 点 | 不显示趋势/环比 | HEALTH.md 扫描记录（≥2 点才用） |
| `backlog[].id` | 是 | — | — | 维护 backlog |
| `backlog[].category` | 是 | 八类之一 | — | 同上 |
| `backlog[].score` | 是 | 分 | — | 权重 × 影响面 ÷ 成本 |
| `backlog[].title` | 是 | — | — | 同上 |
| `backlog[].evidence` | 是 | — | — | file:line / 命令 / 计数 |
| `backlog[].cost` | 是 | 1~3 | — | 修复成本，3 最贵 |
| `backlog[].status` | 否 | — | `open` | open / fixed / deferred / escalated |

八类固定顺序与展示名：`dependencies` 依赖、`security` 安全、`duplication` 重复、`churn` 变更频率、`docDrift` 文档漂移、`architectureDrift` 架构漂移、`flaky` 不稳定测试、`todo` TODO。`categories` 是扫描计数，`backlog` 是 Tech Lead 挑选后的处置项，两者不必一一对应——不要拿 backlog 条数反推类别计数。

### Widget 形态

- `kind="dashboard"`，`capabilities="resize,sendPrompt"`，`height="1140"`、`min-height="620"`、`max-height="1200"`（7 条 backlog 的完整内容约 1100px；条目更少时可下探到 720）。
- 语义层级：**页头**（扫描日期 + 来源 + 分级徽标）→ **健康概览**（健康分 + 分级 + 环比 + 趋势线；3 个 KPI：待处理 / 已修复 / 最高得分；状态分布条）→ **类别矩阵**（8 格，点击筛选）→ **优先处理**（按得分排序的 backlog 行 + 展开详情）→ **动作条**。
- 健康分 `40px/700`，旁边写明「越低越好」；分级按未修复条数：0 健康（success）、1–4 需关注（warning）、≥5 待治理（danger），并在分级下方用 12px 注明「按未修复条目数分级」。
- `history` ≥2 点时画 SVG 迷你趋势线（accent 线 + 12% 透明面积），并显示「较上次 −1.0」；负数为改善（success），正数为恶化（danger），相等为「持平」（muted）。不足 2 点只显示健康分，不画趋势。
- KPI：待处理 = status 缺省或 open 的条数；已修复 = fixed；最高得分 = `max(backlog[].score, 0)`。三个数字都带一行注释说明口径。
- 状态分布条：open / fixed / deferred / escalated 四段堆叠条（CSS，≤5 个数据点，不用 Chart.js），下方图例带计数。全为 0 时显示空轨道与「无处置项」。
- 类别矩阵：4 列 × 2 行（窄屏 2 列），每格 = 展示名 + 扫描计数 + 小圆点；计数为 0 的格子用 muted 色；扫描计数最大的类别加「最多」小徽标（accent 描边），不做彩虹配色。
- 优先处理列表：每行 = 序号 + 标题/证据摘要 + 类别 + 得分条（按当前最大得分归一化）+ 得分值 + 成本点（1~3 个实心点）+ 状态徽标 + 展开箭头。默认按得分降序，得分相同按成本升序、id 升序。行点击/回车展开详情：完整证据（等宽字体）、类别代码、得分、成本、状态，右对齐「生成修复计划」按钮。
- 列表上方一行 12px 说明：「得分 = 权重 × 影响面 ÷ 成本，得分越高越先处理」；工具栏放「隐藏已修复」开关与「按得分 / 按成本」排序，以及当前筛选的「显示 X / Y」。
- 动作条：主按钮「按类别汇总维护计划」，次按钮「健康分怎么算」；都在 `sendPrompt` 里带上当前筛选状态。

### 本地交互

1. 点击类别格 → 只显示该类别的 backlog 行；再次点击或点「全部」取消筛选；类别格 `aria-pressed` 同步。
2. 点击「隐藏已修复」→ 过滤 `status !== 'fixed'`，KPI 保持全局口径，列表显示「显示 X / Y」。
3. 切换「按得分 / 按成本」→ 本地重排，不重置筛选。
4. 点击/回车行 → 展开或收起该行详情；同一时间只展开一行，`aria-expanded` 同步。
5. 键盘：所有可点击元素可 Tab 到达，Enter/Space 触发；`focus-visible` 可见。

### 推理跟进（sendPrompt）

单项修复计划（行详情内按钮）：

```json
{
  "backlogId": "M1",
  "category": "duplication",
  "score": 8.0,
  "cost": 3,
  "status": "open",
  "evidence": "zcode/scripts/verify.mjs ↔ minimax/scripts/verify.mjs：312 个窗口"
}
```

`text` 示例：「请为维护项 M1（duplication，得分 8.0，成本 3）生成修复计划：先核对证据范围，再给出最小改动步骤、验证命令与回滚方式；不要顺手重构无关代码。」

汇总（动作条主按钮）：

```json
{
  "byCategory": { "duplication": ["M1"], "docDrift": ["M2"] },
  "openCount": 5,
  "filteredCategory": null,
  "sort": "score"
}
```

`text` 示例：「请按当前维护 backlog 汇总一份分派计划：按类别说明先做什么、每项的最小验证命令与预计成本，并标出哪些需要你拍板。」

算法说明（动作条次按钮）：`text` 示例「请解释维护健康分的计算口径：权重、影响面、成本分别怎么取，以及分数变化说明什么；不要重新扫描。」

### 状态表现

| 状态 | 表现 |
|---|---|
| 加载 | 保留页头、健康分位、3 个 KPI、8 个类别格与 3 行骨架；数字显示 `--`，趋势线为灰轨 |
| 空 | 健康分 0、分级「健康」；待处理/已修复为 0，最高得分显示 `--`（无条目可比）；类别格全 0；列表区居中一行「本次扫描没有需要处理的维护项，保持现状」；保留两个动作按钮 |
| 错误 | 保留布局，概览下方内联一行「维护扫描结果缺失或解析失败：<缺什么>」，只渲染解析成功的部分，不整页报错；数据整体缺失时禁用筛选/排序控件，避免在无数据时渲染出伪零值 |
| 缺字段 | 该行保留并标「待补全」，不静默丢弃；缺 `history` 只隐藏趋势，不算错误 |
| 权限/鉴权 | 本配方不涉及鉴权；报告不可读按错误态呈现，绝不伪造健康分或清零 |

### 文本回退

输出：健康分与分级 + 状态计数 + 八类计数表 + 按得分降序的 backlog 清单（编号 / 类别 / 得分 / 成本 / 状态 / 证据）+ 一句话结论（先做什么）。必须能独立成立，不能只写「见上图」。
