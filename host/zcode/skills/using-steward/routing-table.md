| 用户意图 | 路由 | 要点 |
|---|---|---|
| 开发新功能 / 改现有功能 | `/steward <需求>` | 主技能；S/M/L 定级，M/L 走计划批准门 |
| 修 Bug / 行为不对 | `/steward:fix <Bug>` | B0–B3 分流；B2/B3 先写失败测试 |
| 只要方案，先别动手 | `/steward:plan <需求>` | 到批准门停止，不实施 |
| 维护 / 体检 / 还债 | `/steward:maintain` | 八类扫描 → backlog → 小修 → HEALTH |
| 接手存量项目 | `/steward:take-over` | 先盘点后动手 |
| 写 PRD/FRD/契约/页面/测试/部署 | `/steward` + `docTier: 3` | 读主技能目录下 `references/doc-pipeline/README.md` |
| 需求模糊 / 不知道从哪开始 | `/steward:plan` 或 Stage 0.1 | 最多 3 个 P0 问题；S 级不追问 |
