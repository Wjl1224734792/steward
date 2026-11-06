## 可视化呈现（可选）

**先有文字结果，再谈可视化。** 本流程任何阶段都不依赖 GenUI：`03-plan.md` 的任务表、`reports/` 里的门禁与缺陷清单，必须先以文字形式成立并落盘。

需要图形化时，加载与本技能同属 Steward 插件的衍生技能 `steward:steward-visualizer`。它**只消费已落盘的结果**，渲染 `mavis.widget.v1` 视图，不取数、不补造、不重跑业务调用：

| 时机 | 视图 | 数据来源 | 作用 |
|---|---|---|---|
| Stage 1 方案落地后 | 任务 DAG 与并行批次（diagram） | `03-plan.md` 任务表 | 看依赖链、最长路径、并行分组、文件所有权冲突 |
| Stage 3 / Stage 5 门禁与终审后 | 质量门与缺陷回派看板（dashboard） | `reports/qa.md`、`browser.md`、`review.md` | 看阻断项、待回派、已修复与按严重度排序的明细 |
| 维护扫描后 | 维护健康看板（dashboard） | `reports/maintenance-*.md`、`docs/project/HEALTH.md` | 看健康分与趋势、八类分布、状态分布与按得分排序的 backlog |

判据（不满足就用文字，别硬画）：任务数 ≥3 才画 DAG；存在 findings 才画质量门看板；有维护扫描结果就画维护健康看板（backlog 为空用空态，健康态本身是结论）；数据缺失或解析失败按文字处理并说明缺什么。渲染时只出一个 Widget，并放在最后一条消息。
