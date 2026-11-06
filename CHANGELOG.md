# Changelog

本仓库所有用户可见变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [ZCode 0.8.0] - 2026-11-06

> MiniMax 侧保持 1.5.3；文档流水线待 1.6.0 用 MiniMax harness 同步。版本节奏因此有一条预期 warning。

### Added（ZCode 侧：文档流水线）

- **完整吸收 `eng-doc-pipeline`（Desktop 2026-10-28 快照）**：新增 `zcode/skills/steward/references/doc-pipeline/`——hub README（保留七阶段流水线、SSOT 地图、SOP、阶段门禁、错误表）、7 个 references（AGENTS 层级 / 编码规范 / 数据访问 / 前端规范 / 命名守卫 / 联动表 / 接手 SOP）、19 类模板 + `templates/README.md` + T2 的 `04-EVIDENCE.md` / `05-RECORD.md`、通用编程规范基线；`PROVENANCE.md` 记录来源与逐项改编。
- **T0–T3 映射**：T1 `docs/project/` 只放摘要 + 链接；docTier=3 的深正文进 `docs/01..07`；T0 仍 ≤100 行；约束正文进 `AGENTS.md` / `.agents/rules/`；视觉 token 进 `.agents/designs/DESIGN.md`。
- **三个 ZCode-only 本地脚本**（`zcode/scripts/doc/`，不进 build.mjs 同步范围）：`doc-init.mjs`（建七阶段树 + 索引骨架，幂等不覆盖）、`doc-check.mjs`（T1 / 索引 / 死链 / 未索引文件）、`guard-naming.mjs`（波次/工单/优先级/批次命名守卫，`[FROZEN]` / `[BURN-DOWN]` 基线只减不增）。
- **技能路由**：`shared` 技能正文在 T3 节后加可选槽位；`host/zcode/.../doc-pipeline.md` 渲染出「文档流水线（ZCode 完整版，docTier=3）」节；MiniMax 无该片段，生成物逐字节不变。

### Changed

- 口径统一：CI/CD → 本地门禁脚本 + 可选 git hook（不创建 `.github/workflows`）；「同 commit」→「同一批变更」（默认不提交）；浏览器优先级改为 Playwright MCP / Chrome DevTools MCP → 内置浏览器兜底，证据统一 `browser-evidence.json`；可靠性排序链统一（原 `agents-files.md` 与 SKILL §6.3 不一致）。
- `zcode/.zcode-plugin/plugin.json` 0.7.3 → 0.8.0；根 README / `zcode/README.md` 中英同步；MiniMax 清单未动。

### 验证

- `node zcode/scripts/build.mjs --check` exit 0（仅版本节奏 warning：0.8.0 vs 1.5.3）。
- `git status --porcelain -- minimax/` 空；`git show HEAD:minimax/skills/steward/SKILL.md` 与工作区 CRLF 归一后逐字节相同；ZCode SKILL.md 含新节且 `@@SLOT` 残留 0。
- `check-doc-refs.mjs`：32 个 md、markdown 链接 + 反引号引用全部解析通过。
- 模板拆分对照：19 个模板与源 `templates.md` 对照，缺失行 21 条，全部为计划内适配（CI→本地门禁 / commit→同一批变更 / 路径 / Steward 说明），无大段丢失。
- fixture `tmp/steward-fixtures/doc-pipeline-demo/`：`test-doc-scripts.mjs` **30/30 PASS**——doc-init dry-run/写入/幂等；doc-check 正例 + 死链 / 未索引 / 缺 T1 三个负例；guard-naming 干净 / WAVE / PRIORITY / `--init` / 拒绝覆盖 / stale / 最终通过；`maintain.mjs` exit 0 且无 docDrift finding。
- `guard-naming` 误伤用例 `web3-client.ts` / `test-s3.ts` / `approval-batch.ts` 不命中。

### 已知偏差

- MiniMax 侧未同步（按用户要求本次只动 ZCode 侧）；`minimax/` 与 `host/minimax/` 零改动。
- 版本节奏 warning 预期存在，1.6.0 后消失。
- 外部 `eng-doc-pipeline` 快照冻结；后续以 vendored 库为 ZCode 事实源。
- 未吸收 AFC/AIAPaaS 分支的「§5.0 强制头脑风暴 / 先问后写」（与 Steward 轻量 Stage 0 冲突），记入 PROVENANCE。

## [ZCode 0.7.3 / MiniMax 1.5.3] - 2026-11-06

### Added（MiniMax GenUI）

- **维护健康看板（配方 C）**：`/steward maintain` 后的专用 dashboard 设计——页头（扫描日期 / 来源 / 分级）、健康分 + 环比 + SVG 趋势、3 个 KPI、状态分布条、8 类扫描计数矩阵（点击筛选）、按得分排序的 backlog（得分条 / 成本点 / 状态 / 展开详情），动作条提供「按类别汇总」「单项修复计划」「健康分口径」三种 sendPrompt。纯 CSS/SVG，仅用 `--mw-*` 令牌。
- `data-schema.json` 的 `maintenance` 增加可选 `history`（HEALTH.md 扫描记录，≥2 点才画趋势 / 环比）与展示口径派生值（healthGrade / openCount / maxScore / scoreDelta / topCategory）；明确 `categories` 是扫描计数、`backlog` 是挑选后的处置项，两者不必一一对应。
- `examples.md` 新增完整示例 C（7 条 backlog、5 点 history、代表性维护扫描数据）；`SKILL.md` 路由与 `host/minimax/skills/steward/visualizer.md` 判定同步。

### Fixed

- 维护看板此前只有数据契约、没有渲染配方，宿主只能套通用 dashboard 模板：健康分无视觉锚点、8 类无呈现、backlog 无优先级视觉。本版补齐专用配方与完整示例。

### 验证

- `check-widget.mjs`（本地工具）：示例 A/B/C 全部 PASS——DSL 结构、必填属性、meta/data JSON、脚本语法、令牌白名单、无硬编码色、无 Chart.js/fetch/eval/本地存储、dashboard ≥2 按钮与 ≥2 sendPrompt、fallback 非空。
- 同源 HTML 预览（模拟 `--mw-*` 明 / 暗令牌）：1180 宽亮色截图验收布局；暗色令牌计算色与关键文本 / 背景对比度 ≥4.5:1；640 窄屏无横向溢出（hero 单列、类别 2 列、行卡片化）；交互（类别筛选 / 隐藏已修复 / 按成本与得分排序 / 行展开 / 3 个 sendPrompt payload）与状态（空 / 错误 / 缺字段）全部通过。
- 限制：IAB 截图服务在本会话后续调用超时，暗色 / 窄屏以计算样式与几何断言代替截图；Playwright 点击超时，交互以页面内 DOM click 验证（同一事件处理器）。MiniMax 宿主实机渲染仍待用户确认（ZCode 无 GenUI）。

## [ZCode 0.7.2 / MiniMax 1.5.2] - 2026-11-06

### Fixed

- **verify.mjs 自动探测缺陷**（真实演练发现）：无 steward.config.json 时，未探测到命令的 lint/typecheck 被误判为「启用但缺命令」直接退出；现自动模式只运行探测到命令的门禁（config 模式仍严格校验）。由 taskboard M/L 演练的 QA 阶段复现。
- **guard.mjs 宿主契约对齐**：阻断原因从 stdout 改为 stderr，stdout 保持空（宿主对 hooks stdout 做严格 JSON 校验，未知键会判失败）；exit 2 语义不变。
- **hooks/hooks.json 格式修正**：移除非法注释键，改用 `${CLAUDE_PLUGIN_ROOT}` 展开插件内 guard 路径，事件名收敛到宿主白名单。

### Added

- **hooks 契约自检** `scripts/hooks/selftest.mjs`：11 例覆盖危险命令（rm -rf/force push/reset --hard）、密钥（sk-/PEM）、所有权（白名单内外/无上下文）、坏 JSON fail-open，断言 exit 0/2 与 stdout 为空；全部 PASS。
- **工作区 hooks 挂载** `.zcode/config.json`（enabled=true + PreToolUse 三守卫，`${ZCODE_PROJECT_DIR}` 相对路径）；插件级 `zcode/hooks/hooks.json` 同时随插件分发。hook 配置在会话启动时加载，**宿主级拦截在新会话生效**（本会话内以 selftest + 配置校验验证）。
- **hooks 使用说明** `zcode/hooks/README.md`（契约、两种激活方式、关闭方法、ownership 文件格式）。

### 演练（本版验证路线图能力，非产品行为变更）

- **M/L 全流程**：taskboard fixture（Node HTTP + 静态 UI）走完 spec → architect 真实派单 → validate-plan → Plan Critic（修正后批准）→ T1/T2 并行真实派单 → QA 独立门（18/18，--repeat 3 无 flaky）→ 真实浏览器 7 步证据（browser-evidence.json）→ reviewer 终审「可交付」→ 05-record；过程中发现并修复 verify.mjs 缺陷。
- **codemod 演练**：legacy-api fixture（12 call site）4 批 + 清理，每批 npm test exit 0 + baseline check PASS，最终无旧引用、run completed。
- 演练工件在 `tmp/steward-fixtures/`（gitignored），结论与证据汇总见 `docs/ROADMAP-STATUS.md`。

## [ZCode 0.7.1 / MiniMax 1.5.1] - 2026-11-06

### Changed（内部构建，兑现 P2 项 16）

- **技能/agent 正文单一源化**：新增 `shared/`（唯一正文源，含 `@@SLOT@@` 宿主槽位）与 `host/<宿主>/`（frontmatter、名册与派发机制、工具名标签、浏览器操作方式等片段）；`build.mjs` 渲染出 2 宿主 ×（4 技能 + 7 agent）= 22 个文件，生成物带「请勿手改」标记。改一处（shared 或 host 片段）→ 生成两版。
- `build.mjs --check` 升级为**生成一致性校验**：手改生成文件、未重建、缺必填片段、残留槽位、脚本不同步、清单/frontmatter 非法、版本节奏不符 → exit 1；缺 `shared/`+`host/` 布局（如插件安装目录）→ 友好失败 exit 2。
- 无害措辞归一（以信息更全的一版为准）：两宿主统一「仓库根路径」输入项、i18n 词条表述、维护/Bug/只出计划小节标题与 codemod 口径；minimax 的 browser-tester 补上与 zcode 一致的「返回报告的格式」节。

### 验证

- 生成前后逐文件 diff：仅计划内措辞归一 + 生成标记，无内容丢失（minimax 的模型表/派发方式/可视化/glm 注记、zcode 的 hooks 行/模型默认口径均保留；无残留槽位）。
- 篡改测试：手改 `minimax/agents/pm.md` → `--check` FAIL exit 1；重建后 PASS。`minimax/scripts/build.mjs` 副本 `--check` PASS；缺布局目录运行 exit 2。
- 既有门禁回归（validate-config / validate-plan / verify / maintain）全部 PASS。

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
