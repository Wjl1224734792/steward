
## 文档流水线（ZCode 完整版，docTier=3）

> 本节只在 ZCode 侧渲染；MiniMax 侧仍用上面 T3 六件骨架，1.6.0 再同步。

**启用**：`steward.config.json` 设 `docTier: 3`，或 L 级 / 合规 / 新项目由你提升。docTier<3 **不建**深文档树，只维护 T0 `AGENTS.md` + T1 `docs/project/`。

**索引**：`references/doc-pipeline/README.md`（相对本技能目录）是唯一入口；模板在 `references/doc-pipeline/templates/`，规范正文在同级 `*.md`。写 PRD/FRD/架构/契约/页面/测试/部署/治理文档前先读索引，不凭记忆写。

**目录（docTier=3）**：
- `docs/01-需求/` PRD + FRD；`docs/02-架构/` 架构总纲 + {X}工程化 + 可观测性 + 部署工程化；`docs/03-契约/` 数据模型 + API/错误码；`docs/04-专项/`；`docs/05-页面/` 页面设计 + 布局稿 + 详设；`docs/06-测试/` 测试方案 + 黄金集；`docs/07-治理/` ADR + 执行步骤 + 开发顺序 + 评审记录；`docs/README.md` 文档地图。
- 约束正文：根/子目录 `AGENTS.md` + `.agents/rules/`；视觉 token：`.agents/designs/DESIGN.md`。
- T1 `docs/project/` 仍是每轮必读薄记忆：ARCHITECTURE/DECISIONS/RUNBOOK 只放摘要 + 链接，正文进深文档，交叉引用不复制。

**七阶段在 Steward 流程里的位置**：需求（PRD→FRD）在 Stage 0/1；架构/契约/页面在 Stage 1 冻结；实现/质量/部署/治理在 Stage 2–5 落档。每阶段出口按 `references/doc-pipeline/README.md` 的门禁清单独立通读、清点关键数字、用 `file:line` 证据，结论写 `docs/07-治理/评审记录-*.md`。

**变更入口**：新需求 / 改口径 / 改范围先做影响面扫描（SSOT 地图 + 联动表）→ 需拍板项列给用户 → 拍板后按联动表同批落档；不拍板不动文档。

**本地门禁（不做 CI）**：
- `node <插件>/scripts/doc/doc-init.mjs <root> --tier 3 [--write]`：建七阶段树 + 索引骨架；幂等不覆盖。
- `node <插件>/scripts/doc/doc-check.mjs <root>`：T1 / 索引 / 死链 / 未索引文件；exit 1 即失败。
- `node <插件>/scripts/doc/guard-naming.mjs <root>`：代码产物禁波次/工单/批次编号；基线只减不增。
三个脚本 exit code 非 0 一律如实上报；脚本只在 ZCode 侧提供。

**与 T3 六件骨架的关系**：ZCode 以 `references/doc-pipeline/templates/` 完整库为准；`scripts/templates/t3/` 六件保留给 MiniMax 与轻量场景，不重复维护正文。

**DocTier 判定**：S/M 级不建深树；L 级且涉及契约/多端/合规/新项目才提升到 3。不要为了「完整」建空目录。
