---
name: docs
description: Steward 文档流水线（docTier=3，MiniMax Code）。当需求属 L 级、涉及契约/多端/合规、或项目 steward.config.json 设了 docTier: 3 时加载：七阶段文档树（需求/架构/契约/专项/页面/测试/治理）、模板索引、变更联动表与本地门禁（doc-init / doc-check / guard-naming），以及 PRD/FRD 验收条目如何收敛进 02-spec.md 的 AC。文档变长 / 要归档 / 要版本快照 → 加载 steward:docs-governance。Use when a Steward run needs the full seven-phase documentation pipeline rather than the default thin project memory.
---

# Steward · 文档流水线（docTier=3）

> 本技能从主技能按需拆出：只在需要建深文档树时加载。docTier<3 不建这套目录，不要为了「完整」建空树。
> 加载入口（MiniMax 无斜杠命令）：用户说「按 docTier=3 建文档树」「这套需求要留完整文档」，或项目 `steward.config.json` 设 `docTier: 3`。
> **文档变长 / 要归档 / 要版本快照？** 加载 `steward:docs-governance` 技能（活/记录/基线三类分治、拆分预算、07 分层归档、`history/` 版本溯源、`docs-gate` / `doc-snapshot` 本地门禁）。

<!-- 由 zcode/scripts/build.mjs 从 shared/ + host/minimax/ 生成，请勿手改；改源后重跑 build.mjs。 -->

## T3 文档按需升级（docTier=3，v0.7）

- 触发：L 级 / 合规 / 新项目，或用户明确要求；在 `steward.config.json` 设 `docTier: 3`。
- 产物六件：PRD、FRD、契约（CONTRACT）、页面布局（PAGE-LAYOUT）、测试方案（TEST-PLAN）、部署工程化（DEPLOYMENT）——模板在插件 `scripts/templates/t3/`，按需复制填空；PRD/FRD 的验收条目最终收敛进 02-spec.md 的 AC，被 validate-plan 机检。
- T3 是升级不是常态：每个 T3 文档都要能回答「它防的是什么漂移」，答不出就别建。

## 文档流水线（完整版，docTier=3）


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
三个脚本 exit code 非 0 一律如实上报。

**与 T3 六件骨架的关系**：以 `references/doc-pipeline/templates/` 完整库为准；`scripts/templates/t3/` 六件保留给轻量场景，不重复维护正文。

**DocTier 判定**：S/M 级不建深树；L 级且涉及契约/多端/合规/新项目才提升到 3。不要为了「完整」建空目录。

**文档治理（文档越写越长 / 要快照 / 评审记录堆积时）**：加载 `steward:docs-governance` 技能——三类文档分治（活文档管体积 / 记录文档管索引 / 基线文档管版本）、体积预算与 hub-and-spoke 拆册、frontmatter 读契约、`history/` 版本快照与双向溯源；门禁脚本随包提供（`scripts/docs-gate.mjs` G1–G11、`scripts/doc-snapshot.mjs` 快照幂等），交付收尾跑一次 `docs-gate check`（与 `doc-check` 并存不互替，两者都要绿）。
