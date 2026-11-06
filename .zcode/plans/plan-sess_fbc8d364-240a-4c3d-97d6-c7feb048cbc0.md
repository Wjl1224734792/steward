## Context

`docs/ROADMAP-STATUS.md` 项 18（GenUI 健康/进度看板）目前只有 `maintenance` 数据契约，**没有专用渲染配方**——`references/components.md` 只有配方 A（任务 DAG）和配方 B（质量门缺陷），`examples.md` 也没有维护看板示例。MiniMax 只能拿通用 dashboard 模板硬套，结果是：健康分没有视觉锚点、8 类维护项没有呈现、backlog 没有优先级视觉、状态/趋势缺失——这就是「UI 看板太丑」的根因。

这次按上下文理解为 `/steward maintain` 的 **GenUI 维护健康看板**（ROADMAP 项 18）。目标：新增一套专用「配方 C」，并做一版可用于实机渲染的完整示例 + 本地同源预览验收。

## 设计方向：维护控制台（CSS/SVG，无 Chart.js）

```text
┌──────────────────────────────────────────────────────────────┐
│ 维护健康   2026-11-06 · maintain.mjs            [待治理]      │
├─────────────────────────────┬────────────────────────────────┤
│ 13.0                        │ 待处理 5   已修复 1   最高得分 8.0 │
│ 健康分（越低越好）            │                                │
│ 较上次 −1.0   ▁▂▃▅▄          │ 状态分布 ████████░░░░           │
├─────────────────────────────┴────────────────────────────────┤
│ 类别分布（8 格，可点击筛选）                                   │
│ [重复 836] [待办 16] [文档 2] [churn 0] …                      │
├──────────────────────────────────────────────────────────────┤
│ 优先处理 (5)                       [隐藏已修复] [按得分 ▾]     │
│ 01 M1 跨文件重复代码窗口   duplication 8.0 ████████ 成本●●● 待处理 ›│
│ 02 M2 AGENTS.md 缺失      docDrift    4.5 ████     成本●○○ 待处理 ›│
│ …（点击行展开证据与「生成修复计划」）                            │
├──────────────────────────────────────────────────────────────┤
│ [按类别汇总维护计划]                    [健康分怎么算]          │
└──────────────────────────────────────────────────────────────┘
```

设计要点：
- **信息层级**：健康分（40px）+ 分级徽标 → 3 个 KPI → 状态分布 → 类别矩阵 → 按得分排序的 backlog → 详情/动作。
- **真实数据**：分级按未修复条目数（0 健康 / 1–4 需关注 / ≥5 待治理，写进 schema 的展示口径）；得分条按当前最大得分归一化；趋势/环比只用 `history`（HEALTH.md 有记录才显示），不推算、不补造。
- **视觉规范**：只用 `--mw-*` 令牌；12px 圆角、1px 边框、无阴影/渐变/发光；文字 400/500，700 只用于分数与 KPI；分类用中性色 + 「最多」徽标，语义色只给状态/分级；无 emoji，图标用 CSS/SVG。
- **交互**：类别格筛选、隐藏已修复、得分/成本排序、行展开详情（本地）；`sendPrompt` 只保留 3 个高价值动作（单项修复计划、按类别汇总、健康分算法说明）。
- **状态**：加载骨架、空态（健康分 0 + 无待办文案）、错误态（保留布局 + 内联提示）、缺字段（保留行并标「待补全」）。
- **响应式**：≥760px 双栏 hero；<760px 堆叠，backlog 行转两行卡片。

## 改动文件

**产品（MiniMax 可视化技能）**
1. `minimax/skills/steward-visualizer/SKILL.md`
   - frontmatter description 增加维护健康看板触发词（中英）。
   - 「何时渲染」表加一行：`/steward maintain` 后 → 配方 C。
   - 硬性要求：三个配方、C 也用 CSS/SVG、kind 映射（A=diagram，B/C=dashboard）。
2. `minimax/skills/steward-visualizer/references/components.md`
   - 新增「视觉基线」小节（间距/字号/圆角/徽标/响应式断点，A/B/C 共用）。
   - 新增「配方 C：维护健康看板」：业务问题、选择规则、输入字段、Widget 形态、本地交互、sendPrompt、状态表现、文本回退。
3. `minimax/skills/steward-visualizer/references/examples.md`
   - 新增「示例 C」完整可运行 `<mavis-widget>`：代表性维护扫描数据（健康分 13.0、8 类计数、5 条 backlog、5 点 history），含完整 CSS/HTML/script/fallback。
4. `minimax/skills/steward-visualizer/references/data-schema.json`
   - `maintenance` 增加可选 `history: [{date, score}]`（仅来自 HEALTH.md，缺省不报错）。
   - `derivedValues` 增加展示口径：`healthGrade`（按未修复数）、`openCount`、`maxScore`、`scoreDelta`、`categoryCounts`（8 类补零）。
   - `fieldRules` 明确 categories 是扫描计数、backlog 是挑选后的处置项，两者不必一一对应。
5. `host/minimax/skills/steward/visualizer.md`
   - 表格增加 `/steward maintain 扫描后` → 维护健康看板（dashboard）→ `reports/maintenance-*.md` + HEALTH.md → 健康分/类别分布/优先级 backlog；判据补「有扫描结果就画，backlog 为空用空态」。
   - 跑 `node zcode/scripts/build.mjs` 重新生成 `minimax/skills/steward/SKILL.md`（单一正文源，不手改生成物）。

**版本与文档**
6. `zcode/.zcode-plugin/plugin.json` 0.7.2→0.7.3；`minimax/.minimax-plugin/plugin.json` 1.5.2→1.5.3（保持 0.x ↔ 1.(x−2) 节奏；ZCode 侧仅版本同步，无行为变更）。
7. `README.md`（中英）、`zcode/README.md`、`minimax/README.md`：版本号同步；根 README 把「GenUI 维护看板契约」改为「维护健康看板（专用配方 C）」；顺手修掉已过期的「Next」条目（单一源化、GenUI dashboard 实际已完成）。
8. `CHANGELOG.md` 新增 `[ZCode 0.7.3 / MiniMax 1.5.3]`：Added（配方 C、history/派生值）、Fixed（维护看板此前只有契约没有配方）、验证（本地预览 + 契约检查；MiniMax 实机待用户确认）。
9. `docs/ROADMAP-STATUS.md` 项 18 → 已实现（v1.5.3 专用配方 C + 本地视觉验收）；`docs/ROADMAP.md` 状态行与 v1.6 变更记录补一行。

**验收工件（tmp，gitignored）**
10. `tmp/steward-tools/genui-preview.mjs`：从 `examples.md` 抽取示例 C，拼装独立预览 HTML（模拟 `--mw-*` 明/暗令牌、注入 `window.__mavisData`、stub `window.mavis.sendPrompt`），支持 `?state=empty|error|missing`。
11. `tmp/steward-tools/check-widget.mjs`：契约检查（单 widget、必填属性、meta/data JSON、script 语法、令牌白名单、无硬编码色、无 Chart.js/fetch/eval/localStorage、交互均声明 sendPrompt、fallback 存在）。
12. 会话可视化目录 `maintenance-dashboard.html`：同一预览的 inline 版本（先加载 `visualize` 技能按规范生成），最终回复中引用，让用户直接在 ZCode 里看设计。

## 验证（真实命令 + 真实输出）

```bash
cd /e/CodeStore/plugins/dev-team
node zcode/scripts/build.mjs            # 重新生成 minimax/skills/steward/SKILL.md
node zcode/scripts/build.mjs --check    # 必须 PASS
node -e "JSON.parse(require('fs').readFileSync('minimax/skills/steward-visualizer/references/data-schema.json','utf8')); console.log('schema OK')"
node tmp/steward-tools/check-widget.mjs # 示例 A/B/C 契约检查全过（A/B 不改也应保持通过）
node tmp/steward-tools/genui-preview.mjs
# 起本地静态服务后用浏览器验收：
#   1180×900 明/暗、640×900 明 → 截图 + DOM 断言
#   交互：类别筛选 / 隐藏已修复 / 按成本排序 / 行展开 / 三个 sendPrompt payload
#   状态：empty / error / missing（缺字段行保留并标待补全）
```

浏览器验收会记录：截图、DOM 文本断言（分数/分级/KPI/8 类/行数/排序）、`window.__sent` 的 sendPrompt payload、窄屏无横向溢出。最后把结果写进 CHANGELOG 与 ROADMAP-STATUS 的验证栏。

## 不在本次范围

- 不重做配方 A/B 的结构（只把共用视觉基线写进 components.md；B 如需重排另起任务）。
- 不在 MiniMax 宿主实机渲染（ZCode 无 GenUI；实机效果仍由用户切到 MiniMax 确认）。
- 不改脚本门禁、不动 hooks、不 commit / 不 push；完成后把改动与验收结果汇报，等你确认是否提交。

## 风险

- **宿主渲染差异**：MiniMax 的 GenUI 渲染器可能与本地浏览器略有差异；对策是只用文档化 DSL/令牌、零外部依赖、无 Chart.js，并把所有主题相关样式留给 `--mw-*`。
- **示例膨胀**：示例 C 控制在 ~350 行内；视觉基线抽成小节，避免 A/B/C 重复。
- **版本同步**：ZCode 无行为变更但同步 patch 版本，保持双宿主节奏；如你不想升版本，可在实施前去掉这一项。