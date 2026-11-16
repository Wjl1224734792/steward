| 用户意图 | 路由 | 要点 |
|---|---|---|
| 开发新功能 / 改现有功能 | 主技能（自然语言：「用 Steward 完成…」） | S/M/L 定级，M/L 走计划批准门 |
| 修 Bug / 行为不对 | Bug 通道（自然语言：「帮我修这个 Bug」） | B0–B3 分流；B2/B3 先写失败测试 |
| 只要方案，先别动手 | 只出计划模式（自然语言：「出个方案先别写」） | 到批准门停止，不实施 |
| 想让我直接做 / 别派子代理 | `steward:inline` 技能（自然语言：「你直接做」「别派子代理」） | 仅 S / B3 / 维护小修；M 需显式要求；L 与 B0/B1/B2 禁止 |
| 维护 / 体检 / 还债 | 维护循环（自然语言：「扫一遍依赖与重复」） | 八类扫描 → backlog → 小修 → HEALTH |
| 接手存量项目 | 接手存量（自然语言：「接手这个项目」） | 先盘点后动手 |
| 新建项目 / 从零搭文档基线 | `steward:docs-new`（自然语言：「新建项目」「初始化七阶段文档」） | docTier=3；建树 → 需求 → 架构 → 契约 → 页面 → 测试 → 治理 → `steward:docs-review` → 签发收据 |
| 接手存量仓库要补文档 | `steward:docs-takeover`（自然语言：「接手这个仓库」「存量项目补文档」） | 先 `take-over.mjs` 盘点落位，再按缺口补齐 |
| 单个功能 / 需求变更要动哪些文档 | `steward:docs-feature`（自然语言：「给这个功能写文档」） | 影响面扫描 → 只改受影响阶段（其余显式 na + 理由） |
| 审查文档 / 能不能开工 | `steward:docs-review`（自然语言：「文档齐了吗」「先看看能不能开工」） | 派 `steward:reviewer` 全新实例评审 → 评审记录 → `docs-ready approve` 签收据 |
| 需要 PRD/FRD/契约/页面/测试的写法与模板 | `steward:docs-rules`（总库，不是入口） | 规范正文、SSOT 地图、联动表与模板索引见 `skills/steward/references/doc-pipeline/README.md` |
| 文档太长 / 评审堆在 07 / 文档要留版本 | `steward:docs-governance` 技能（自然语言：「文档太长了」「评审堆在 07」「需求文档要留版本」） | 活/记录/基线三类分治 + 体积预算 + 归档轮转 + `history/` 快照溯源；门禁 `docs-gate` / `doc-snapshot` |
| 需求模糊 / 不知道从哪开始 | 只出计划模式 或 主技能 Stage 0.1 | 最多 3 个 P0 问题；S 级不追问 |
| 配置子代理模型 / 思考强度 / 给某角色换模型 | `steward:agent-settings` | 先读本机模型目录再改；model 与 effort 成对传 |
