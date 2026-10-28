# dev-team 组件配方

两个领域配方，均只消费 `dev-team` 业务流已落盘的结构化结果。数据契约见 `data-schema.json`，完整可运行示例见 `examples.md`。

通用约束（继承 `references/genui-widget/` 基座，不可放宽）：

- 只用 `--mw-*` 主题令牌，禁止硬编码背景/文字/边框色，禁止 `var(--mw-*)` 回退值。
- 脚本只从 `window.__mavisData['<name>']` 取数，禁止从 DOM 反推数据，禁止 `eval` / `new Function` / `fetch` / `localStorage`。
- 默认只输出**一个** `<mavis-widget>`，且必须是最后一条助手消息；其后不得再调工具。
- `sendPrompt` 的 `text` 与 `userIntent` 一律使用会话语言（本插件面向中文场景，默认中文）。
- 数字全部取整展示；`text` 必须是用户可读的问题，不写隐藏指令。

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
