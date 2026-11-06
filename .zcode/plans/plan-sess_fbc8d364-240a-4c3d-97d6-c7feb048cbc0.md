## Context

Steward 的 T3 目前只有 6 个骨架模板（`zcode/scripts/templates/t3/`），没有文档 SSOT 地图、联动表、命名守卫与文档检查；`docs/ROADMAP.md` §8 仍把 `eng-doc-pipeline` 当外部参考。目标：**ZCode 侧全量吸收 `C:\Users\12247\Desktop\skills\eng-doc-pipeline`（2026-10-28 快照），做到装了 Steward 就不再单装该技能**；`minimax/` 与 `host/minimax/` 零改动，MiniMax 侧留给你之后用 MiniMax harness 升到 1.6.0。

已确认：docTier=3 沿用 `docs/01-需求 … 07-治理` 七阶段树；全量吸收（8 个 references + 19 类模板 + 通用规范基线 + 命名守卫）；ZCode 升 0.8.0，MiniMax 保持 1.5.3。

## 设计

### 1. 文档库位置与结构（ZCode-only）

新增 `zcode/skills/steward/references/doc-pipeline/`（放在技能 references 下，按需加载；不经过 `shared/`，`build.mjs` 不渲染、不向 minimax 同步）：

- `README.md`：流水线 hub，保留原 §0–§8（七阶段、SSOT 地图、SOP、门禁、错误表、示例），新增「与 Steward T0–T3 映射」与模板索引。
- 7 个散装参考 + `templates/`（原第 8 个 reference `templates.md` 按 19 个模板拆分）：
  - `agents-files.md`、`coding-standards.md`、`data-access.md`、`frontend-standards.md`、`naming-guard.md`、`sync-rules.md`、`takeover.md`
  - `templates/README.md`（落位速查）+ 19 个模板文件（PRD / FRD / ENGINEERING / OBSERVABILITY / DEPLOYMENT / API / DATA-MODEL / GOLDEN-SET / PAGE-DESIGN / PAGE-LAYOUT / PAGE-DETAIL / DESIGN / FRONTEND-RULES / ADR / REVIEW-RECORD / EXECUTION-STEPS / DEV-ORDER / TEST-PLAN / PRE-COMMIT-CHECKLIST）
  - `templates/04-EVIDENCE.md`、`templates/05-RECORD.md`（T2 变更包，补齐 ROADMAP 只有口径没有模板的缺口）
  - `assets/通用编程规范与指南.md`（原样基线）
- `PROVENANCE.md`：来源路径、快照日期、逐项改编说明、有意省略项（`locales/`、AFC/AIAPaaS 分支的 §5.0 强制头脑风暴）。

### 2. 与 Steward 的口径对齐（改编规则）

- **CI/CD → 本地门禁**：原文「CI 拦截 / CI 薄壳 / 落 CI」统一改成「本地门禁脚本 + 可选 git hook」；不生成 `.github/workflows`，不引入 GitHub Actions。
- **同 commit → 同一批变更**：用户要求提交时才同 commit；否则留在工作区并列出联动清单。
- **浏览器优先级**：改成 Steward 口径（Playwright MCP / Chrome DevTools MCP → 内置浏览器兜底）；证据格式以 `browser-evidence.json` 为准，原文四项证据作为补充检查清单；视觉问题仍标 `visual: unverified`。
- **去重**：TDD 细节引用 `steward:tdd`；T1 扫描引用 `take-over.mjs`；AC 收敛引用 `02-spec.md` + `validate-plan.mjs`；不另建第二套证据/测试口径。
- **修内部漂移**：原 `agents-files.md` 与 SKILL §6.3 的可靠性排序不一致，全库统一为「本地门禁 > 可选 pre-commit hook > lint/tsc > 根 AGENTS 红线 > 子目录 AGENTS > `.agents/rules` > 本技能 > docs 散文」。
- **不吸收** AFC/AIAPaaS 分支的 §5.0「强制先问后写」——与 Steward 轻量 Stage 0（仅二义且影响方向时追问）冲突，记入 PROVENANCE。

### 3. T0–T3 映射（写进 hub README）

- T0 `AGENTS.md` 仍 ≤100 行，只放索引/红线；溢出进 `.agents/rules/`。
- T1 `docs/project/` 仍是「每轮必读薄记忆」；docTier=3 时 ARCHITECTURE/DECISIONS/RUNBOOK 只放摘要 + 链接，正文进 `docs/02-架构/`、`docs/07-治理/`，不复制。
- T2 是 `tmp/steward/<run>/` 变更包；`04-evidence` / `05-record` 用新模板。
- T3 是 `docs/01…07` + `docs/README.md` 地图 + `.agents/designs/DESIGN.md`，仅 docTier=3 建；docTier<3 不建深树。
- `scripts/templates/t3/` 六件保留为跨宿主骨架；ZCode 以 `references/doc-pipeline/templates/` 完整库为准（MiniMax 侧 1.6.0 再同步）。

### 4. 技能路由（关键：MiniMax 输出逐字节不变）

- `shared/skills/steward.body.md` 在 T3 节末尾**紧贴**加一行 `@@SLOT?:skills/steward/doc-pipeline@@`（前后不加空行）。
- 新增 `host/zcode/skills/steward/doc-pipeline.md`（片段以空行开头），渲染出 `## 文档流水线（ZCode 完整版，docTier=3）`：启用条件、先读 hub、七阶段树、T1/T3 关系、变更入口、三个本地脚本、与六件骨架的权威关系。
- MiniMax 无该片段 → 可选槽位整行被删除，`minimax/skills/steward/SKILL.md` 必须与 HEAD 逐字节相同（构建后 diff 验证）。

### 5. 本地脚本（ZCode-only，放 `zcode/scripts/doc/`）

该目录是 `build.mjs` 的同步盲区（它只同步顶层 `scripts/*.mjs` 与 `scripts/hooks/`），不会进 MiniMax：

- `doc-init.mjs <root> [--write] [--tier 3]`：dry-run 默认；建 7 个文档目录 + `docs/README.md` 骨架 + `.agents/{rules,designs}`；幂等、绝不覆盖；缺 T1 时提示先跑 `take-over.mjs`。
- `doc-check.mjs <root> [--tier n] [--json]`：T1 存在性（tier=3 为 error）、`docs/README.md` 存在、AGENTS/docs 死链（剥离代码围栏，跳过外链/纯锚点）、`docs/01…07` 文件是否全部进索引；exit 1 on error。
- `guard-naming.mjs <root> [--baseline <file>] [--init] [--json]`：移植命名守卫（WAVE/ISSUE/PRIORITY/BATCH/BATCH_ZH 正则、`web3`/`test-s3`/`approval-batch` 误伤保护、`[FROZEN]`/`[BURN-DOWN]` 基线、fresh/stale 判定）；`--init` 生成存量基线，默认拒绝覆盖。
- `README.md`：用法、退出码、ZCode-only 说明与 MiniMax 1.6.0 同步提示。

### 6. 版本与文档

- `zcode/.zcode-plugin/plugin.json` → 0.8.0，描述补文档流水线；`host/zcode/.../frontmatter.md` 描述补 docTier=3 触发词；`host/zcode/.../banner.md` → 0.8.0。
- 根 `README.md`（中英）、`zcode/README.md`（中英）：版本行、能力条目、安装示例；明确「MiniMax 1.5.3，文档库待 1.6.0 同步」。
- `CHANGELOG.md`：新增 `[ZCode 0.8.0]`（Added / Changed / 验证 / 已知偏差）。
- `docs/ROADMAP.md`：新增 P3（v0.8，ZCode 先行）项 20；更新 §5.1 T3、§5.3 T2 命名（与实现对齐）、§8 参考、§9 变更记录。
- `docs/ROADMAP-STATUS.md`：新增 P3 项 20 证据与已知偏差（MiniMax 未同步、版本节奏 warning）。

## 改动文件

**新增（ZCode-only）**：上述 `zcode/skills/steward/references/doc-pipeline/**`、`zcode/scripts/doc/**`、`host/zcode/skills/steward/doc-pipeline.md`。

**修改**：`shared/skills/steward.body.md`（仅 1 行槽位）、`host/zcode/skills/steward/{frontmatter,banner}.md`、`zcode/skills/steward/SKILL.md`（build 生成）、`zcode/.zcode-plugin/plugin.json`、`README.md`、`zcode/README.md`、`CHANGELOG.md`、`docs/ROADMAP.md`、`docs/ROADMAP-STATUS.md`。

**明确不动**：`minimax/**`、`host/minimax/**`、`shared/agents/**`、`zcode/scripts/*.mjs`（顶层）、`zcode/scripts/templates/**`、`zcode/commands/**`、`zcode/hooks/**`。

## 验证（真实命令 + 预期）

```bash
cd /e/CodeStore/plugins/dev-team

# 1. 构建与“MiniMax 零改动”
node zcode/scripts/build.mjs
node zcode/scripts/build.mjs --check    # PASS；仅 1 条版本节奏 warning（0.8.0 vs 1.5.3）
git status --porcelain -- minimax/      # 空
git diff --exit-code -- minimax/        # exit 0
diff <(git show HEAD:minimax/skills/steward/SKILL.md) minimax/skills/steward/SKILL.md  # 无输出

# 2. 技能内容与引用完整性
grep -c "文档流水线（ZCode 完整版" zcode/skills/steward/SKILL.md   # 1
grep -c "@@SLOT" zcode/skills/steward/SKILL.md                     # 0
node tmp/steward-tools/check-doc-refs.mjs                          # 0 broken links

# 3. docTier=3 fixture 正负例
FIX=tmp/steward-fixtures/doc-pipeline-demo
node zcode/scripts/doc/doc-init.mjs $FIX              # dry-run 列表
node zcode/scripts/doc/doc-init.mjs $FIX --write      # 建树
node zcode/scripts/doc/doc-init.mjs $FIX --write      # 幂等，全部跳过
node zcode/scripts/doc/doc-check.mjs $FIX             # PASS exit 0
# 注入死链 / 未索引文件 / 删 T1 → 各 FAIL exit 1；修复 → PASS
node zcode/scripts/doc/guard-naming.mjs $FIX          # PASS
# 新建 src/user-login.w8s4.test.ts → FAIL；--init → PASS；新增违规 → FAIL；删基线文件 → stale FAIL
# web3-client.ts / test-s3.ts / approval-batch.ts → PASS（不误伤）
node zcode/scripts/maintain.mjs $FIX                  # docDrift 0 findings

# 4. 安装包结构
rm -rf tmp/steward-fixtures/plugin-package && cp -r zcode tmp/steward-fixtures/plugin-package
node -e "JSON.parse(...)"                             # plugin.json 0.8.0
find .../references/doc-pipeline -type f | wc -l      # 33
```

另做逐文件 diff 审查：8 个 reference 的差异只允许「路径 / CI→本地门禁 / commit 口径 / 浏览器优先级 / 可靠性链」五类适配；模板按源 `templates.md` 的 19 个段逐一对照，确认正文无丢失。

## 不在范围

- MiniMax 侧全部工作（你之后用 MiniMax harness 做 1.6.0）。
- 新角色 / 新技能 / 新命令；CI/CD；改写外部 skill；AFC 分支 §5.0。
- 全量 sync-rule 机检（只做命名守卫、文档索引/死链、现有 docDrift）。

## 风险

- **槽位位置**导致 MiniMax 输出变化 → 严格「无空行槽位 + 片段以空行开头」，构建后逐字节 diff。
- **模板拆分丢正文** → 逐模板对照源文件，差异只允许计划内适配。
- **doc-check 误报** → 剥离代码围栏、跳过外链/纯锚点；fixture 覆盖正负例。
- **版本节奏 warning** → 你已确认只升 ZCode；在 CHANGELOG/STATUS 标为已知偏差，MiniMax 1.6.0 后消失。
- **快照冻结** → PROVENANCE 记录来源与改编；后续以 vendored 库为准，MiniMax 同步时回填。