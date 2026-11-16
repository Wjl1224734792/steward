| 用户意图 | 路由 | 要点 |
|---|---|---|
| 开发新功能 / 改现有功能 | `/steward <需求>` | 主技能；S/M/L 定级，M/L 走计划批准门 |
| 修 Bug / 行为不对 | `/steward:fix <Bug>` | B0–B3 分流；B2/B3 先写失败测试 |
| 只要方案，先别动手 | `/steward:plan <需求>` | 到批准门停止，不实施 |
| 想让我直接做 / 别派子代理 | `/steward:inline <需求>` | 仅 S / B3 / 维护小修；M 需显式要求；L 与 B0/B1/B2 禁止 |
| 维护 / 体检 / 还债 | `/steward:maintain` | 八类扫描 → backlog → 小修 → HEALTH |
| 接手存量项目（开发侧） | `/steward:take-over` | 先盘点后动手 |
| 新建项目 / 从零搭文档基线 | `/steward:docs-new` | docTier=3；建树 01→07 → 机检 → 独立评审 → 签发收据 |
| 接手存量仓库补文档 | `/steward:docs-takeover` | docTier=3；先盘点落位再按缺口补齐（只建文档基线，与开发侧 `/steward:take-over` 区分） |
| 单个功能 / 需求变更要动哪些文档 | `/steward:docs-feature` | docTier=3；SSOT 影响面扫描 → 只改受影响阶段（其余显式 na） |
| 审查文档 / 文档齐了吗 / 能不能开工 | `/steward:docs-review` | docTier=3；机检 → reviewer 全新实例评审 → 签发收据 |
| 文档越写越长要拆分 / 归档 / 版本快照 | `steward:docs-governance` | docTier=3 增量层，按需加载技能 |
| 需求模糊 / 不知道从哪开始 | `/steward:plan` 或 Stage 0.1 | 最多 3 个 P0 问题；S 级不追问 |
| 配置子代理模型 / 思考强度 | `steward:agent-settings` | ZCode 用宿主默认模型；按角色换模型请到 MiniMax 宿主 |
