# Changelog

本仓库所有用户可见变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [ZCode 0.7.0 / MiniMax 1.5.0] - 2026-11-06

对应路线图 P2（v0.7+）——演进；证据见 [docs/ROADMAP-STATUS.md](docs/ROADMAP-STATUS.md)。

### Added（功能）

- **演进循环**：maintain.mjs 新增重构比例检查（近 N 天 refactor/还债类提交占比 <10% 报警，呼应 GitClear 的重构率下降证据）；SKILL 新增「演进循环」节——架构漂移 / 循环依赖 / 重复率 / 重构比例检查，批量改动（codemod）必须走计划模式（转换脚本 + 抽样验证 + 分批执行 + 每批 verify/baseline，红了即停），模块边界变化先立 ADR。
- **接手存量 `/steward take-over`（ZCode 命令；MiniMax 自然语言触发）**：take-over.mjs 扫描生成 T1 → 占位符逐项确认（证据化，禁止编造）→ maintain.mjs 首轮健康扫描回填 HEALTH → 盘点报告 + 待拍板清单；先盘点后动手。
- **T3 文档按需升级**：模板六件（PRD / FRD / 契约 / 页面布局 / 测试方案 / 部署工程化）在 `scripts/templates/t3/`；SKILL「T3 按需升级」节（docTier=3 触发，验收条目收敛进 AC 由 validate-plan 机检；每个 T3 文档必须说清它防什么漂移）。
- **双宿主本地构建**：`build.mjs`——scripts/templates 单一正文源（zcode 为源一键同步 minimax，`--check` 只校验）+ 双宿主清单校验（plugin.json 列表 ↔ 磁盘）+ frontmatter 校验（含 MiniMax 小写 tools / 无 color 规则）+ 版本节奏检查（ZCode 0.x ↔ MiniMax 1.(x-2)）+ 技能正文漂移报告。不做 CI。
- **可选宿主守卫 hooks**：`scripts/hooks/guard.mjs` 三模式（ownership 所有权白名单 / dangerous 危险命令 / secret 密钥扫描），stdin JSON → exit 2 阻断、fail-open；配置示例 `zcode/hooks/hooks.json`，挂载方式见 README。
- **GenUI 维护看板契约**：visualizer data-schema 新增 `maintenance` 数据集（健康分 + 分级 backlog，来源 maintain 报告与 HEALTH.md，nullPolicy 明确）。
- **Monorepo / 多服务口径**：SKILL「Monorepo / 多服务」节——workspaces 探测（take-over）、多服务 services 配置（steward.config.json）、按 package 划分所有权、子包级 maintain 汇总进 HEALTH。

### Fixed

- guard.mjs 兼容 Git Bash 的 POSIX 风格绝对路径（`/e/...` → Windows 盘符归一化）。
- build.mjs 模板同步支持子目录（t3/）。

### 验证

guard.mjs 三模式真实 stdin 用例全过（拦/放/坏 JSON fail-open，双路径风格）；build.mjs check→sync→recheck 三态通过（能抓出未同步文件与 frontmatter 问题）；maintain 自扫含重构比例检查（<20 提交正确跳过）；data-schema.json 合法。脚本/模板之外，技能与 agent 正文仍双源维护（漂移报告已接入 build.mjs），完整正文单一源化记为已知偏差。

## [ZCode 0.6.0 / MiniMax 1.4.0] - 2026-11-06

对应路线图 P1（v0.6）——维护循环 + 证据 + 学习；证据见 [docs/ROADMAP-STATUS.md](docs/ROADMAP-STATUS.md)。

### Added（功能）

- **维护循环**：`maintain.mjs` 八类扫描（依赖 / 安全（npm audit，离线 fail-open）/ 跨文件重复 / churn / 文档漂移 / ESM 循环依赖 / flaky 复跑 / TODO）→ 按「权重 × 影响面 ÷ 成本」排序的维护 backlog；配套 SKILL「维护循环」节（Observe → Score → Fix small → Record，更新 HEALTH.md）。
- **浏览器证据契约**：browser-tester 交付 `browser-evidence.json`（每步判定引用 ARIA/DOM/console/network/URL；provider 与 fallbackUsed 如实记录；布局/颜色/溢出标 `visual: "unverified"`；截图只作附件）；驱动优先 Playwright MCP / Chrome DevTools MCP，不可用退内置浏览器。
- **学习循环**：SKILL 新增「学习循环（05-record）」节——评审发现 / 事故教训 / 用户纠正 / 架构决策 / 维护结论分别回填 CONSTITUTION / DECISIONS(ADR) / RUNBOOK / CHANGELOG / HEALTH。
- **三个轻量技能**（按需加载，不默认注入）：`steward:systematic-debugging`（复现 → 缩小 → 假设 → 验证 → 根因）、`steward:tdd`（红 → 绿 → 重构）、`steward:verification-before-completion`（完成声称必须复跑贴证据）。
- **可选 worktree + 收尾**：SKILL 新增 Stage 5.5 finishing（05-record → 汇报 → 询问处置）与「隔离与并行写」节（worktree 仅独立模块 / 高风险 / 长任务三种情况临时开启，按 DAG 顺序串行合并；默认仍为基线 hash 单写者）。
- **模型路由 + fallback + 预算**：steward.config.json 支持 `modelRouting`（角色 → model/effort + fallback）与 `budget.maxTotalAttempts`；validate-config 校验结构；run-state `--budget-attempts` 预算超限停摆（exit 2，reason=budget-exhausted）。

### Changed（变更）

- `maintain.mjs` 兼容 Node 24（shell:true 不再接受参数数组）。

### 验证

- `maintain.mjs` 在本插件仓库自扫出 7 项 findings（含 836 个跨文件重复窗口——与「脚本双份维护」已知偏差一致，佐证 P2 项 16 的必要性）；fixture 扫描干净并完成 Record 步骤演练（HEALTH.md 回填 lockfile 条目）。
- `validate-config` 对 modelRouting/budget 负例报错正确；`run-state` 预算用尽停摆 exit 2。
- 浏览器证据契约以提示词 + schema 落地；真实 UI 项目的 browser-evidence.json 全流程演练待首个带 UI 的任务（fixture 无 UI）。

## [ZCode 0.5.0 / MiniMax 1.3.0] - 2026-11-06

对应路线图 [docs/ROADMAP.md](docs/ROADMAP.md) P0（v0.5）——可信变更 + Bug 通道 MVP；交付状态与证据见 [docs/ROADMAP-STATUS.md](docs/ROADMAP-STATUS.md)。

### Added（功能）

- **Bug 通道 `/steward fix`（ZCode 命令；MiniMax 自然语言触发）**：B0–B3 分流；B2/B3 六步（复现 → 失败测试 → 根因 → 最小修复 → 回归 → 记录）；B0/B1 止损流程 + postmortem 模板（`scripts/templates/postmortem.md`）。
- **只出计划 `/steward plan`（ZCode 命令）**：方案 → 计划校验 → Plan Critic → 用户批准后停止，不实施。
- **计划批准门 + Plan Critic**：M/L 计划必须先过干净上下文 Critic（复用 `steward:reviewer` 的计划评审模式）与用户批准，未批准不实施。
- **门禁脚本五件套**（双宿主 `scripts/`，纯 Node 无依赖，本地执行不做 CI）：
  - `validate-config.mjs`：steward.config.json 校验（docTier/commands/services/gates/browser/isolation/maintenance）。
  - `take-over.mjs`：扫描目标仓库，生成 AGENTS.md + `docs/project/` 七件套初稿（T0/T1）与缺口清单，绝不覆盖已存在文件。
  - `validate-plan.mjs`：机读计划校验（路径存在/越出根、DAG 无环、文件所有权不相交、AC 覆盖、影响面六节、测试改动必须声明理由——反作弊）。
  - `run-state.mjs`：run.json 状态机（DAG 派发进度、断点恢复、停摆守卫——同一错误连续 2 次即停 exit 2）。
  - `verify.mjs`：门禁独立复跑（exit code/耗时/输出留证、`--repeat` 查 flaky）+ 基线 hash 记录/比对（越界 diff、未声明测试 diff 拦截、回滚锚点）。
- **项目记忆**：T0（AGENTS.md）+ T1（CONSTITUTION/ARCHITECTURE/DECISIONS/RUNBOOK/CHANGELOG/HEALTH）模板，take-over 按探测结果填充、探测不到留占位符不编造。
- **技能与角色增量**：Tech Lead 手册新增「项目记忆与门禁脚本」「Bug 通道」「只出计划」三节与 Stage 1.5 批准门；architect 增加影响面分析与 03-plan.json 输出；backend/frontend-dev 增加 Bug 模式（先失败测试、修根因不修症状、最小改动）；qa-engineer 改为 verify.mjs 独立复跑 + 反作弊检查；reviewer 增加 Plan Critic 模式与测试完整性/文档同步检查。角色数保持 7 个。

### Changed（变更）

- 工件目录新增 `02-impact.md`、`03-plan.json`、`run.json`、`baseline.json`、`verify-result.json`。
- M/L 需求流程在方案与实施之间插入 Stage 1.5（Critic + 批准）。
- `.gitignore` 增加 `tmp/`（本地验收 fixture 与运行工件不入库）。

### 验证

全部 P0 验收在 fixture 仓库 `tmp/steward-fixtures/ledger-demo/` 以真实命令跑通（含负例），证据见 `docs/ROADMAP-STATUS.md`。

## [ZCode 0.4.3 / MiniMax 1.2.0] - 2026-11-05

### Changed

- 更名 dev-team → Steward（插件 ID / 命令 / agent 前缀 / 技能命名空间），中英文 README 同步。
- MiniMax 版固定各角色模型并补充模型派单说明。
- 新增 2026 路线图（功能 / Bug / 维护 / 接手四条通道）。
