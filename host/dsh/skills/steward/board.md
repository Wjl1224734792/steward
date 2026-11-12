## 共享任务板（Agent Teams，DSH）

宿主启用「智能体团队」后，**任务板就是唯一的实时看板**：会话页头的 Team 面板里有成员状态（provisioning / running / inactive / failed）与任务板（未开始 = 灰点、被依赖阻塞 = 橙点、进行中 = loading、完成 = 绿点），并显示负责人、依赖、就绪态、写入范围与**文件重叠告警**。Lead 不再靠脑子记「谁在做哪张单」。

**建板（计划批准后一次）**：`steward_board(action="sync", plan="<工件目录>/03-plan.json", level="M")`。不要手写板上的任务：

| 板上任务 | 来源 | 作用 |
|---|---|---|
| `G1 · 计划批准` | 门禁 | 未完成时所有工作单都 claim 不上（原生依赖闸门） |
| `T<id> · <role> · <标题>` | `03-plan.json` 的 tasks | 工作单：描述里带目标 / 完成标准 / 所有权 / 报告落点；`writeScopes` = 文件清单（重叠会告警） |
| `G2 · QA 门禁` | 门禁 | 依赖全部工作单，完成前不进终审 |
| `G3 · 终审` | 门禁 | 依赖 G2 |

**派活**：`steward_board(action="brief", role="backend-dev", task="T1", plan="<…>")` 取自包含任务书 → `spawn_teammate(name="backend-dev-t1", description="…", prompt=<任务书>)` → `team_task_update(action="reassign", expected_revision=<最新>, owner=<teammate target>)` 把板上任务分给它；teammate 先 claim 再动手。

**状态口径**（面板颜色与它一致）：
- `pending` = 未开始；`in_progress` = 有人在做；`completed` = 实施报告已落盘且该任务所有权内的验证通过。
- 不许提前 complete：报告不在、`verify.mjs run` 没跑、把别人的任务标完成，都算造假（与「铁律」同级）。
- 阻塞没解就 claim 不上——这就是 Steward 的 DAG 在原生层被执行，**不要删 `blocked_by` 抢跑**。

**回派与修复**：缺陷回派给**同一个** teammate（`send_message`），不要为同一角色反复 spawn（teammate 名字永久占用）；板上把该任务 `reopen` 回 `pending` 并在描述里记轮次。

**看板自检**：`steward_board(action="status", plan="<…>")` 返回与面板一致的文本快照（门禁进度 / 每单状态·负责人·阻塞·就绪）。向用户同步进度时贴它，不要自己编。

**没启用团队时**：会话里没有 `agentTeams` 服务，`steward_board` 会直接报错——此时走单人模式（`steward_dispatch` + `run.json`），照 DAG 派活，只是没有看板。
