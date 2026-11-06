# 来源与改编说明（PROVENANCE）

## 来源

- 源路径：`C:\Users\12247\Desktop\skills\eng-doc-pipeline`
- 变体：Desktop canonical（与 `E:\CodeStore\有灵\.agents\skills\eng-doc-pipeline`、AIOS、demo、明德AIERP 的副本逐字节相同）
- 快照日期：2026-11-06；源文件 mtime 2026-10-28 17:53
- 源规模：`SKILL.md` 37,796 B / 336 行；`references/` 7 个文件 + `templates.md` 691 行 / 37,507 B；`assets/通用编程规范与指南.md` 42,468 B / 677 行；`locales/` 2 个文件
- 吸收范围：8 个 references（`templates.md` 拆为 `templates/`）、assets 基线、naming guard 规则与脚本

## 目标

- `zcode/skills/steward/references/doc-pipeline/`（ZCode-only，按需加载）
- `zcode/scripts/doc/`（ZCode-only，本地脚本）
- MiniMax 侧零改动；1.6.0 由用户用 MiniMax harness 同步

## 计划内改编

1. **Hub**：原 `SKILL.md` → 本目录 `README.md`；删 frontmatter / locales；新增「与 Steward T0–T3 映射」、ZCode-only 说明、模板索引。
2. **路径**：`references/xxx.md` → 同级 `xxx.md`；`templates.md` → `templates/`（19 个模板 + `templates/README.md` + T2 `01-REQUIREMENT.md` / `04-EVIDENCE.md` / `05-RECORD.md`）。
3. **CI/CD → 本地门禁**：不生成 `.github/workflows`；原文「CI 拦截 / CI 薄壳 / 落 CI」改为本地脚本 + 可选 git hook。`assets/通用编程规范与指南.md` 保留通用提法，但文件头加 Steward 口径覆盖。
4. **commit → 同一批变更**：Steward 默认不提交；用户明确要求时才同 commit。`commit message` 保留（历史坐标）。
5. **浏览器优先级**：原「内置浏览器优先」改为 Steward 口径（Playwright MCP / Chrome DevTools MCP → 内置浏览器兜底）；证据格式统一 `browser-evidence.json`，原文四项证据作为补充检查清单；视觉问题标 `visual: "unverified"`。
6. **可靠性排序**：原 `agents-files.md` §1 与 SKILL §6.3 不一致；统一为「本地门禁 > 可选 pre-commit hook > lint/tsc > 根 AGENTS 红线 > 子目录 AGENTS > `.agents/rules` > 本库 > docs 散文」。
7. **T0 行数**：原 ≤300 行 → Steward ≤100 行（溢出进 `.agents/rules/`）；同步 hub / `agents-files.md` / `coding-standards.md`。
8. **T1/T3 分工**：T1 `docs/project/` 只放摘要 + 链接；深正文进 `docs/01..07`；新增 `04-EVIDENCE.md` / `05-RECORD.md` 对齐 T2 变更包。
9. **去重**：TDD 指向 `steward:tdd`；T1 扫描指向 `take-over.mjs`；AC 收敛到 `02-spec.md` + `validate-plan.mjs`；测试门禁指向 `verify.mjs`。
10. **命名守卫**：规则与基线语义保留；脚本提取为 `zcode/scripts/doc/guard-naming.mjs`（CLI `<root>`、`--init`、`--json`、误伤保护）；`naming-guard.md` 保留项目内参考实现并注明以插件脚本为准。
11. **需求澄清内核（ZCode 侧）**：Stage 0.1 吸收「第一性原理四问 + 最多 3 个 P0 提问预算」；新增 `templates/01-REQUIREMENT.md`。**不引入** AFC 分支的「强制先问后写」硬门槛，S 级不追问。

## 有意省略

- `locales/en-US.json`、`zh-CN.json`：Steward 插件清单自有 i18n，不需要技能级展示元数据。
- AFC/AIAPaaS 分支的「§5.0 开工前头脑风暴」：**部分吸收**——保留第一性原理四问与提问预算（最多 3 个 P0；S 级不追问），不引入「强制先问后写」硬门槛；落点见技能 Stage 0.1 与 `templates/01-REQUIREMENT.md`。
- 任何 GitHub Actions / CI YAML 骨架：按用户硬约束不创建。

## 保真说明

- 19 个模板按源 `templates.md` 的 `##` 模板段逐一拆分；正文保留，仅加 Steward 适配说明与模板头。
- 7 个散装 reference 保留原结构与正文；差异仅限上述改编规则。
- 已知内部漂移已修：可靠性排序链统一；模板索引从单文件改为目录索引。
- **后续维护**：本目录是 ZCode 侧事实源；外部 `eng-doc-pipeline` 不再作为 ZCode 事实源。MiniMax 1.6.0 同步时从本目录回填。
