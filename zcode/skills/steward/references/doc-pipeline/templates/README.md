<!-- 来源：eng-doc-pipeline templates.md（2026-10-28 快照）；Steward ZCode 侧适配见 ../PROVENANCE.md -->

# 文档模板索引（Steward ZCode 完整库）

> 所有模板只做「骨架 + 填空」，不写教程。落位以七阶段树为准；docTier<3 **不要**为了完整而建空目录。

## 文档落位速查

| 文档类型 | 落位 |
|---|---|
| PRD、FRD（功能需求）、业务流程、领域参数清单 | `docs/01-需求/` |
| 架构设计总纲、{X}工程化.md（架构对象 + **横切域**：安全/可观测性…） | `docs/02-架构/` |
| 部署工程化（环境矩阵/晋级回滚/本地门禁清单） | `docs/02-架构/`（⑥ 主产物） |
| 数据模型/ER、API 与协议、外部集成 | `docs/03-契约/` |
| 算法 / AI-Agent / 领域规则专项 | `docs/04-专项/`（名字按项目定） |
| 页面设计（IA/路由/页面↔GT）· 页面布局稿（区域/栅格/断点/四态/滚动归属）· 页面详设-{端}（逐页/组件清单） | `docs/05-页面/` |
| 视觉规范 DESIGN.md + 主题参考稿（有界面项目必有） | `.agents/designs/`（视觉唯一权威） |
| 测试方案（金字塔/黄金集/NFR 映射/门禁清单） | `docs/06-测试/` |
| ADR、执行步骤（进度 SSOT）、开发顺序（开工 SSOT）、评审记录 | `docs/07-治理/` |

## 模板清单

| 模板 | 文件 | 用途 |
|---|---|---|
| PRD | `PRD.md` | 为什么做 / 给谁做 / 做成什么样算成功 |
| FRD | `FRD.md` | 把 PRD 的 FR 展开成功能点级行为规格 |
| {X}工程化 | `ENGINEERING.md` | 每个架构对象一份（后端/前端/部署/AI/数据…） |
| 可观测性工程化 | `OBSERVABILITY.md` | 日志/trace/指标/告警的横切 SSOT |
| 部署工程化 | `DEPLOYMENT.md` | 部署单元/环境矩阵/晋级回滚/本地门禁/runbook |
| API 契约 | `API.md` | 端点、错误码号段、权限注入、专项接口 |
| 数据模型 | `DATA-MODEL.md` | ER/DDL/软删/审计/ORM schema 权威口径 |
| 黄金集 | `GOLDEN-SET.md` | 领域硬规则逐条，期望写死数字边界 |
| 页面设计 | `PAGE-DESIGN.md` | IA / 路由表 / 页面↔验收锚点 |
| 页面布局稿 | `PAGE-LAYOUT.md` | 逐页区域/栅格/断点/四态/滚动归属 |
| 页面详设 | `PAGE-DETAIL.md` | 逐页区块/交互/硬阻断/GT/组件清单 |
| DESIGN | `DESIGN.md` | 视觉 token / 主题 / 布局框架唯一权威 |
| 前端层级规范 | `FRONTEND-RULES.md` | `.agents/rules/frontend.md` 骨架 |
| ADR | `ADR.md` | 选型/边界决策的追加日志 |
| 评审记录 | `REVIEW-RECORD.md` | 结论先行；机械修复项 vs 需拍板项 |
| 执行步骤 | `EXECUTION-STEPS.md` | 现状盘点 + 剩余工序 + 开放项台账（OP-xx） |
| 开发顺序 | `DEV-ORDER.md` | 开工顺序 SSOT：依赖链/波次/并行/估算 |
| 测试方案 | `TEST-PLAN.md` | 测试金字塔/黄金集/NFR 映射/门禁清单 |
| 提交前自检 | `PRE-COMMIT-CHECKLIST.md` | 23 项打印版检查表 |
| 受理与澄清 | `01-REQUIREMENT.md` | T2 变更包：原始需求 + 第一性原理四问 + 假设/问题台账 |
| 变更证据 | `04-EVIDENCE.md` | T2 变更包：verify/baseline/browser 证据索引 |
| 变更记录 | `05-RECORD.md` | T2 变更包：改了什么/为什么/文档更新/决策/遗留 |

## 与 Steward 产物的关系

- **T2 受理**：`01-REQUIREMENT.md` 是 Stage 0 的落盘模板；M/L/二义需求先过第一性原理四问与最多 3 个 P0 提问预算（技能 Stage 0.1），S 级不追问、直接按默认推进。
- **PRD/FRD 的验收条目**最终收敛到 `02-spec.md` 的 AC，由 `validate-plan.mjs` 机检；模板里的 AC 只做来源追溯，不另立第二套验收口径。
- **PAGE-LAYOUT 的验收脚本**交给 browser-tester，判定证据写 `browser-evidence.json`；四项证据（入口/观察/截图/对照基准 + 工具）是该文件的补充检查清单。
- **TEST-PLAN 的门禁**用 `verify.mjs`（`--repeat` 查 flaky）；不要另写 门禁配置。
- **DEPLOYMENT 的「本地门禁清单」**只列本地命令（lint/typecheck/test/build），不生成 `.github/workflows`；需要提交前拦截时用可选 git hook。
- **PRE-COMMIT-CHECKLIST 的「落门禁」**指本地脚本/lint，不是 CI（对比说明）。
- **T2 变更包**目录是 `tmp/steward/<run>/`；`04-EVIDENCE.md` / `05-RECORD.md` 由 Tech Lead 在交付时落盘。
