
**文档治理（文档越写越长 / 要快照 / 评审记录堆积时）**：加载 `steward:docs-governance` 技能——三类文档分治（活文档管体积 / 记录文档管索引 / 基线文档管版本）、体积预算与 hub-and-spoke 拆册、frontmatter 读契约、`history/` 版本快照与双向溯源；门禁脚本随包提供（`scripts/docs-gate.mjs` G1–G11、`scripts/doc-snapshot.mjs` 快照幂等），交付收尾跑一次 `docs-gate check`（与 `doc-check` 并存不互替，两者都要绿）。
