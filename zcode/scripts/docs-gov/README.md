# scripts/docs-gov/ — 文档治理门禁（ZCode 专用）

对齐 DSH 0.9.0 的文档治理能力（`host/dsh/scripts/` 同源语义）：

| 脚本 | 作用 |
|---|---|
| `docs-gate.mjs <root> [check]` | G1–G11 文档治理门禁（体积预算 / frontmatter / AGENTS 无头部 / 07 分层 / 自动索引区块 / ADR 双向 / 版本三处一致 / 快照完整性 / 现版不入历史 / 修订依据 / 计划 docsRead），支持 `init` / `fix` / `--baseline-write` / `--json` / `--strict` |
| `doc-snapshot.mjs <doc> --next <vX.Y>` | 基线文档版本快照（原文进同域 `history/` + manifest sha256 + 索引行 + superseded-by + 现版 bump + 修订行），幂等，重跑输出 skip |

配套技能：`skills/docs-governance/`（`steward:docs-governance`）。与 `scripts/doc/` 的
`doc-check.mjs` 并存不互替：`doc-check` 管树/死链/T1/索引基线；`docs-gate` 管治理增量。

**为什么在本子目录**：`build.mjs` 只同步 `scripts/*.mjs`（顶层）与 `scripts/hooks/`、
`scripts/templates/`、`scripts/doc/` 到 MiniMax；本目录是同步盲区，保证 ZCode 专属脚本
不进 `minimax/scripts/`。**不要**把本目录加进 build.mjs 的同步清单（那会把 ZCode 侧实现
灌进 MiniMax 包）。要动这两个脚本时：以 `host/dsh/scripts/` 的同名脚本为上游参照，语义
对齐、宿主措辞可异；两侧行为差异（门禁编号、退出码）不允许无记名分叉。
