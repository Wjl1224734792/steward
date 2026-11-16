---
name: docs-review
description: Steward 文档入口（DSH）· 审查文档与闭环。触发语「审查文档」「文档评审」「检查文档闭环」「文档齐了吗」「先看看文档能不能开工」。派 reviewer 全新实例（干净上下文、只读）按阶段门禁逐份评审，结论落 docs/07-治理/评审记录/ 并写机读块，通过后跑 docs-ready approve 签发收据；不通过则回 docs-new / docs-takeover / docs-feature 补齐后重审。Use when the seven-phase documents need independent review, or when the readiness gate must be re-checked before implementation.
---

# 文档入口 · 审查与闭环（docTier=3）

> 本入口负责**独立评审 + 签发收据**；写文档在 `docs-new` / `docs-takeover` / `docs-feature`，规范在 `docs-rules`。评审人只读，落盘由你（Lead）做——这是本入口最容易作弊的地方，纪律在最后。
> 脚本路径约定：`<插件>` = 本技能所在插件包根目录（技能文件向上两级）。

## 0. 对象与材料

1. 跑闭环机检，拿到缺漏清单（**先跑这个再派人**，别让评审员替你找错别字）：

```bash
node <插件>/scripts/docs-ready.mjs <root> check --plan <工件>/03-plan.json --json
```

2. 准备材料给评审员（派单正文里写清路径，不给实施上下文）：
   - `.steward/docs-state.json`（范围声明：哪些阶段 required、哪些 na 及理由）
   - `docs/README.md` 文档地图 + `docs/01-需求 … 07-治理` 实际文件清单
   - `docs-rules` 的 §1 七阶段流水线 / §2 SSOT 地图 / §3 各文档必含项（把**判据**抄进派单，别让子代理自己找）
   - 有的话：`<工件>/02-spec.md`、`<工件>/02-impact.md`、`<工件>/03-plan.json`

## 1. 派单（reviewer 全新实例，干净上下文）

```
steward_dispatch(role="reviewer", description="文档阶段门禁评审",
  prompt="文档评审模式。你只读不改任何文件，也不看实施过程。\n"
       + "仓库根：<root>；范围声明：<root>/.steward/docs-state.json；文档地图：<root>/docs/README.md。\n"
       + "评审对象：<阶段列表，如 01-需求 / 02-架构 / 03-契约 / 06-测试 / 07-治理>。\n"
       + "判据（逐条过，缺证据就标 blocking）：\n"
       + "① 阶段产物齐不齐、是不是空壳；② 同一数字/口径在跨文档间是否一致（实体数/端点/FR/FP/AC/参数值）；\n"
       + "③ FR↔FP 追溯无孤儿；④ AC 可测且覆盖 FR；⑤ 契约与数据模型/Schema 一致；\n"
       + "⑥ 页面布局稿逐页可落地（有 UI 时）；⑦ 黄金集期望值写死数字边界；\n"
       + "⑧ na 的阶段理由站得住（不成立就是 blocking）。\n"
       + "输出：结论先行（可 / 修复后可 / 不可）→ 机械修复项（file:line + 修法）→ 需拍板项（只列不私改）→ 关键数字清点。\n"
       + "结尾单行写：RESULT=approved|changes-requested blocking=<数字>")
```

要求：**不把实施上下文、历史结论塞给它**；评审员只认文档现状与判据。

## 2. 结论落盘（Lead 做，不许篡改）

写 `docs/07-治理/评审记录/评审记录-YYYYMMDD-<主题>.md`（`docs-gate` G4 只允许这个子目录），结构照 `references/doc-pipeline/templates/REVIEW-RECORD.md`：结论先行 → 机械修复项表（`file:line` + 修法 + 状态）→ 需拍板项表（只列不私改）→ 关键数字清点 → 遗留开放项（只引 `执行步骤.md` §三 台账，不复制）。

文件末尾追加**机读块**（`docs-ready approve` 只认这个）：

```markdown
<!-- docs-review:begin -->
{"status":"approved","blocking":0,"scope":"<new|takeover|feature>","reviewedAt":"2026-08-01T10:00:00+08:00"}
<!-- docs-review:end -->
```

规则：
- `status` 只能是 `approved` 或 `changes-requested`；`blocking` 必须等于评审员给出的数字。
- **只有**评审员结论为「可」且 `blocking=0` 才写 `approved`；「修复后可」= `changes-requested`。
- 同时在 `docs/07-治理/评审状态.md` 表尾追加一行（阶段 | 结论 | 日期 | 记录链接）；`approve` 会对这条做 `E-REVIEW-UNINDEXED` 校验。

## 3. 签发或回派

```bash
# 通过：check 全绿 + 评审 approved + 已进评审状态表 → 签发收据
node <插件>/scripts/docs-ready.mjs <root> approve --review docs/07-治理/评审记录/评审记录-YYYYMMDD-<主题>.md
```

- 不通过：把 `changes-requested` + blocking 清单回派给写文档的入口（`docs-new` / `docs-takeover` / `docs-feature`），改完**重新评审**（不复用上轮结论），再走本步。
- 签发后把收据路径和结论向用户汇报；此后可派 `backend-dev` / `frontend-dev`。

## 4. 出口判据

- `docs-ready status` → `READY`（`approved=true`、`stale=false`、`review.status=approved`）；
- 评审记录有结论、有 `file:line` 证据、有机读块；`评审状态.md` 有对应行；
- `blocking` 项要么已修（记录里销项），要么显式升级成需拍板项并拿到用户结论。

## 5. 复核（复审）口径

- 只复核上一轮的 blocking 项 + 改动后的联动产物，**重新通读**受影响文档；
- 发现新的 blocking 也要写（不许因为「上轮说可」就放水）；
- 复审记录另起一篇或同篇追加，机读块 `reviewedAt` 更新、`blocking` 反映当前状态。

## 禁止（本入口的红线）

- **自审自批**：写文档的人（你或子代理）不能自己出 `approved`；必须 `reviewer` 全新实例。
- **改结论不改文档**：把 blocking 写成 0 而文档没动 = 伪造收据，等同于关掉门禁。
- **只审文字不审一致性**：跨文档数字对不上、契约与 schema 不一致，都是 blocking。
- **把需拍板项私自改掉**：列进评审记录，等用户拍板后按联动表同批落档。
- **复用历史结论**：文档改过就必须重审；`docs-ready` 的 `E-STATE-STALE` 就是为这件事存在的。
