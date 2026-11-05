---
name: steward-visualizer
description: "把 Steward 研发团队流程的结构化产物渲染成可视化结果：任务 DAG 与并行批次视图（方案阶段的 03-plan.md 任务表 → 依赖链、最长路径、文件所有权冲突、并行批次），以及质量门与缺陷回派看板（QA / 浏览器验收 / 终审报告 → 阻断项、待回派、已修复与按严重度排序的缺陷明细）。当用户要看清任务调度顺序、并行分组、文件冲突，或要一眼看清当前还有多少必须修的缺陷、分别归属谁时使用。Renders the Steward plugin's structured outputs as mavis.widget.v1 visualizations — the task DAG with parallel batches, and the QA/review defect triage dashboard."
---

# Steward 可视化（Tech Lead 视觉化层）

本技能是 Steward 业务流的**可选呈现层**。业务流本身不依赖它：没有 GenUI 也能完整跑完并交付。任务 DAG 与缺陷清单在任何情况下都必须先以文字形式成立，本技能只负责把它们变成**更容易看懂的视图**。

## 你要做什么

1. **先拿到业务结果**：读 `tmp/steward/<run-id>/03-plan.md` 或 `reports/*.md`，按 `references/data-schema.json` 的契约整理成结构化数据。Visualizer **不取数、不重跑业务调用、不补造缺失行**——它只是把已经落盘的结果换个形状。
2. **再读基座**：读本技能内的 `references/genui-widget/SKILL.md`，以及它链接的 `references/color-system.md`、`references/visual-rules.md`、`references/widget-patterns.md`、`references/widget-recipes.md`。这是一份完整的独立副本，规则不可放宽。
3. **选配方**：见下节。
4. **输出**：默认**只输出一个** `<mavis-widget>`，且它必须是最后一条助手消息——之后不得再调任何工具。需要一句解释就放在同一条消息里。

## 何时渲染 / 何时只用文字

| 情况 | 动作 |
|---|---|
| 任务表 ≥3 个任务，用户问调度顺序、并行批次或文件冲突 | 配方 A（diagram） |
| QA / 浏览器 / 终审产出了 findings，用户问「还剩什么没修」「归谁」 | 配方 B（dashboard） |
| 两者都问到，且都有数据 | 优先配方 B（当前能否交付比调度图更紧急）；下一轮再出配方 A |
| 数据不足（任务 ≤2、无 findings、只有一句话结论） | **只用文字**，不要渲染空图 |
| 用户明确要纯文字 / 只要表格 | 只用文字 |
| 数据缺失或解析失败 | 只用文字说明缺什么，不渲染半张图 |

配方细节（业务问题、选择规则、字段、空值策略、交互、状态、文本回退）见 `references/components.md`。

## 硬性要求

- **只消费业务流产物**：数据来源必须标在 `<mavis-meta>` 的 `dataSource` 里，字段与 `references/data-schema.json` 对齐。
- **不发明**：缺行就少画一行，缺字段就按缺省值渲染并计入错误提示；绝不补造任务、缺陷、命令或结论。
- **不泄密**：工件路径只写到任务ID / 文件名层级即可，不要把绝对路径、凭据、token、环境变量写进 Widget 数据。
- **一个 Widget**：`kind` 按配方选（A=`diagram`，B=`dashboard`），都必须带 `capabilities="resize,sendPrompt"`、`streaming="html-first"`、`theme="app"`、`token-set="mavis.semantic.v1"`。
- **主题令牌**：只用 `--mw-bg`、`--mw-surface`、`--mw-surface-muted`、`--mw-text`、`--mw-text-muted`、`--mw-text-subtle`、`--mw-border`、`--mw-accent`、`--mw-success`、`--mw-warning`、`--mw-danger`、`--mw-chart-1`~`--mw-chart-6`。不给 `var(--mw-*)` 加回退值，不用硬编码配色，不用 Tailwind。
- **渲染器与样本量匹配**：本技能两个配方都用 CSS/SVG，**不调用 `new Chart(...)`**（严重度分布只有 3 个桶，节点数少且无连续量纲）。若未来新增图表，先按 `widget-patterns.md` 的判定规则确认样本量 ≥6。
- **交互分层**：筛选、排序、切换、检视面板一律本地 JS；只有「展开派单」「按归属回派」这类需要模型推理的跟进才用 `window.mavis.sendPrompt(text, metadata)`，payload 只带稳定标识和最小必要字段。
- **语言**：`sendPrompt` 的 `text` 与 `metadata.userIntent` 必须与会话语言一致（中文会话就两个都写中文）。`userIntent` 是用户意图上下文，不是内部英文标签。
- **不生成 `submitForm`**，不伪造用户点击，不编造数据来源。

## 状态覆盖

每个 Widget 都要覆盖：工作态（数据已填充）、加载态（布局骨架 + `--` 占位）、空态（保留布局 + 一行说明为什么没数据）、错误态（保留布局 + 内联短提示 + 可用部分）、鉴权/权限态（本技能不涉及鉴权；工件不可读按空态或错误态处理，绝不伪造门禁结论）。

## 文本回退

Widget 无法渲染时，同一条消息里给出等价的文字结果：配方 A 给任务表 + 并行批次分组 + 冲突清单；配方 B 给按严重度分组的缺陷清单 + 修复轮次与剩余轮次。文字结果必须能独立成立，不能只是「见上图」。

## 出处

本技能是用户自有的衍生技能，GenUI 基座从 `minimax/genui-widget@mavis.widget.v1` 完整拷贝而来（`genui.json` 的 `sourceDigest` 记录了实际摘要，计算方法：按相对路径排序后对每行 `<相对路径> <文件sha256>` 拼接取 sha256）。基座更新不会自动改写本技能，需要时手动重新拷贝。
