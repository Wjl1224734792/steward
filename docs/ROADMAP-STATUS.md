# 路线图交付状态（ROADMAP-STATUS）

> 对照 [ROADMAP.md](ROADMAP.md) §6 的交付表逐项记录：项 / 状态 / 证据 / 备注。状态 ∈ 未开始 / 进行中 / 已实现 / 部分实现。证据以真实命令输出为准。

## P0（v0.5，ZCode 0.5.0 / MiniMax 1.3.0）— 2026-11-06

验证环境：fixture 仓库 `tmp/steward-fixtures/ledger-demo/`（git 基线 a7fc1b1，Node v24.15.0 / win32，零依赖 node:test）。本仓库未做任何 commit / push，全部改动留在工作区。

| # | 交付 | 状态 | 证据 | 备注 |
|---|---|---|---|---|
| 1 | steward.config.json + AGENTS.md / docs/project/* 模板 + take-over 扫描 | 已实现 | `take-over.mjs . --write` 在 fixture 生成 7 件套（首次运行暴露模板名拼接 bug `CONSTITUTION.md.md`，已修复后重跑通过）；幂等重跑全部标记「已存在跳过」；`validate-config.mjs` 正例 exit 0 / 负例 5 个错误全中 exit 1；生成的 `npm run test` 真实可跑（npm test 6/6 绿） | 探测不到的命令留 TODO 占位符，不编造 |
| 2 | tasks.json + validate-plan.mjs | 已实现 | 正例 PASS（exit 0）；5 个负例全部按预期 FAIL（exit 1）：E-CYCLE、E-OVERLAP、E-PATH-MISSING、E-AC-UNCOVERED、E-TEST-UNDECLARED | 额外实现：E-PATH-ESCAPE、E-PATH-CONFLICT、E-TEST-NOT-OWNED（fixture 演练中发现 testChanges 与所有权不一致的契约缺口后补的校验） |
| 3 | run.json + 恢复 + 同错误 2 次即停 | 已实现 | `run-state.mjs`：init/start/done 全链路 exit 0；同一错误签名连续 fail 2 次 → exit 2 + status=stopped + stopReason；不同错误不停摆；停摆后 start 被拒（exit 1）；resume 恢复就绪队列 | 错误签名做了归一化（数字/路径差异视为同一错误），防绕过 |
| 4 | verify.mjs + 反作弊 + 基线 hash/越界 diff 守卫 | 已实现 | `verify.mjs run`：绿 exit 0 / 注入失败用例 FAIL exit 1 / `--repeat 3` 稳定；`baseline record` 记 HEAD a7fc1b1 + 脏文件；`baseline check`：所有权内改动 PASS（exit 0）、越界改 AGENTS.md FAIL（exit 1 + 回滚命令）、未声明测试 diff FAIL（exit 1） | 可回滚锚点即基线 HEAD；fixture 内已实际用 `git checkout <hash> -- <file>` 恢复 |
| 5 | /steward fix MVP（B2/B3） | 已实现 | 真实 Bug（splitEvenly 丢失余数，[33,33,33] 和=99）走完整六步：bug-report → repro（真实输出）→ 派单 `backend-dev`（Bug 模式，先红 fail 2 → 修复 → 绿 6/6）→ root-cause.md → `verify.mjs run` PASS + `baseline check` PASS（改动面=所有权）→ fix.md + CHANGELOG + 回归测试 2 条 | fixture 内以本地 commit 记录修复（fixture 自身 git，不影响本仓库） |
| 6 | /steward fix B0/B1 文档化流程 + postmortem 模板 | 已实现 | B1 桌面推演落 `.steward/bug-run/postmortem.md`（时间线/止损记录/根因/为什么没发现/教训/行动项）；教训已回填 fixture CONSTITUTION（金额分配求和不变量红线） | B0 止损为模拟动作（fixture 无真实生产），流程与工件齐备 |
| 7 | 计划批准门 + Plan Critic | 已实现 | 技能 Stage 1.5 写入双宿主 SKILL.md（Critic 用 reviewer 的「计划评审模式」，干净上下文，blocking 不清不批准；用户批准后才进 Stage 2）；reviewer.md 两种模式提示词就位 | Critic 在真实 M/L 需求上的表现待 v0.5 后实际使用观察（fixture 是单任务 B2，不触发批准门） |

### 已知偏差

- **脚本双份**：`zcode/scripts/` 是唯一源，`minimax/scripts/` 由 `build.mjs` 同步（不手改副本，`--check` 会拦住不同步）；v0.7.1 起技能/agent 正文也改为 `shared/` + `host/` 生成。
- **fixture 内 git commit**：fixture 是测试脚手架（gitignore 的 tmp/ 内、独立 git 仓库），其内部的 `git init/commit` 属测试环境搭建，不影响本仓库工作区与历史；本仓库自身未 commit / push。
- **Plan Critic / 批准门的实战演练**：P0 验收以 fixture 单任务 Bug 为主，批准门与 Critic 以提示词与流程落地为准，未在多任务 M/L 需求上跑过全程（v0.5 后首次真实使用时观察）。

## P1（v0.6，ZCode 0.6.0 / MiniMax 1.4.0）— 2026-11-06

| # | 交付 | 状态 | 证据 | 备注 |
|---|---|---|---|---|
| 8 | /steward maintain：八类扫描 → HEALTH.md + 维护 backlog | 已实现 | `maintain.mjs` 自扫插件仓库：7 findings / 健康分 13.0——含「836 个跨文件重复窗口」（与已知偏差「脚本双份」一致，佐证 P2 项 16）、「缺 AGENTS.md（T0）」、16 处 TODO；fixture 扫描干净（健康分 0）且完成 Record 演练：报告落 `.steward/maintain-run/reports/maintenance.md`、HEALTH.md 回填 lockfile backlog 条目 | npm audit / outdated 离线 fail-open 标记人工补跑；不自动升级依赖 |
| 9 | 浏览器证据契约 | 部分实现 | 双宿主 browser-tester.md 已写入契约（browser-evidence.json：ARIA/DOM/console/network/URL、provider/fallbackUsed、visual unverified）；SKILL Stage 4 同步 | schema+提示词已落地；browser-evidence.json 的真实 UI 全流程演练待首个带 UI 的任务（fixture 无 UI）——不下「已验证」结论 |
| 10 | ADR/CHANGELOG/05-record 学习循环 | 已实现 | SKILL「学习循环（05-record）」节（六类来源 → 五个沉淀位置，双宿主）；机制已在 P0 演练：postmortem 教训回填 fixture CONSTITUTION（金额求和不变量红线）、maintain 结论回填 HEALTH.md | 用户拍板类回填须先问 |
| 11 | systematic-debugging / TDD / verification 技能 | 已实现 | 双宿主 `skills/{systematic-debugging,tdd,verification-before-completion}/SKILL.md`；minimax plugin.json skills 列表注册（JSON 校验通过）；SKILL 派单指引：Bug 模式加载 systematic-debugging | 按需加载，不默认注入 |
| 12 | 可选 worktree + 任务分支 + finishing | 已实现（规则） | SKILL Stage 5.5 finishing（05-record → 汇报 → 询问处置）+「隔离与并行写」节（worktree 三种触发条件、DAG 顺序串行合并、每合并跑 verify）；默认仍 baseline-hash 单写者 | worktree 合并流程未在真实多分支场景演练（无此类 fixture 场景）；规则以提示词为准 |
| 13 | 模型路由 + fallback + 预算 | 已实现 | validate-config 对 modelRouting（角色白名单告警）与 budget.maxTotalAttempts（负例 exit 1）校验通过；run-state `--budget-attempts 2` 两次 fail 后停摆 exit 2、stopReason=budget-exhausted（真实输出）；SKILL「模型路由与预算」节（MiniMax model+effort 成对传、fallback 重试一次） | 派发级 fallback 以提示词纪律落地；token 级预算无法跨宿主可靠获取，采用「失败重试次数」预算（诚实口径） |

### P1 已知偏差

- 浏览器证据与 worktree 合并为「规则已落地、端到端演练待真实场景」，未声称已验证。
- token/轮次预算采用失败重试次数口径（maxTotalAttempts）；宿主未暴露 token 计数接口，不做假预算。

## P2（v0.7，ZCode 0.7.1 / MiniMax 1.5.1）— 2026-11-06

| # | 交付 | 状态 | 证据 | 备注 |
|---|---|---|---|---|
| 14 | 架构演进：模块边界/循环依赖/重复率/重构比例检查，codemod/批量改动计划 | 已实现 | maintain.mjs 新增重构比例检查（`<0.1` 报警，<20 提交窗口正确跳过——自扫实测）；SKILL「演进循环」节（双宿主）：四类检查 + codemod 走计划模式分批执行（每批 verify+baseline，红了即停）+ 边界变化先立 ADR | 循环依赖/重复率/churn 检查 P1 已有，此处纳入演进循环口径 |
| 15 | T3 文档按需升级 | 已实现 | `scripts/templates/t3/` 六件（PRD/FRD/CONTRACT/PAGE-LAYOUT/TEST-PLAN/DEPLOYMENT），build.mjs 已同步 minimax；SKILL「T3 按需升级」节（docTier=3，验收条目收敛进 AC 由 validate-plan 机检） | 模板为骨架；PRD/FRD 的实际产出质量待首个 docTier=3 项目检验 |
| 16 | 双宿主单一正文源 + 本地构建脚本 | 已实现（v0.7.1） | **技能/agent 正文单一源**：`shared/`（共享正文 + `@@SLOT@@`）+ `host/<宿主>/`（frontmatter/名册与派发/标签/浏览器操作方式）→ `build.mjs` 生成 2 宿主 ×（4 技能 + 7 agent）= 22 个文件；生成物带「请勿手改」标记。`--check` 校验：生成一致性（篡改测试：手改 `minimax/agents/pm.md` → FAIL exit 1，重建恢复）、脚本/模板同步、清单、frontmatter、版本节奏、残留槽位；缺 `shared/`+`host/` 布局友好失败 exit 2。生成前后逐文件 diff：仅计划内归一 + 生成标记，无内容丢失（minimax 模型表/派发方式/可视化/glm 注记、zcode hooks 行均保留） | 维护方式：只改 `shared/` 或 `host/` 后跑 `node zcode/scripts/build.mjs`；脚本仍以 zcode 为源同步到 minimax（宿主包自包含） |
| 17 | ZCode hooks：所有权/危险命令/密钥 | 部分实现 | `scripts/hooks/guard.mjs` 三模式真实 stdin 用例全过：dangerous（rm -rf/force push 拦、npm test 放）、secret（sk-/PEM 拦、env 引用放）、ownership（白名单外拦/白名单内放，POSIX+Windows 双路径风格）、坏 JSON fail-open；配置示例 `zcode/hooks/hooks.json` + README 挂载说明 | 脚本级验证完成；**宿主级拦截端到端验证需用户在 settings 挂载**（插件级 hooks 支持未经验证，如实标注） |
| 18 | GenUI 健康/进度看板 | 已实现（契约） | visualizer data-schema.json 新增 `maintenance` 数据集（健康分/分类计数/backlog 条目 + fieldRules + nullPolicy），JSON 校验通过；渲染配方复用既有 dashboard 模式 | 视图渲染实际效果待 MiniMax 宿主验证（ZCode 无 GenUI） |
| 19 | Monorepo / 多服务 | 已实现（口径） | SKILL「Monorepo / 多服务」节（双宿主）：workspaces 探测（take-over 已有 monorepoNote）、services 多服务配置（P0 schema 已支持）、按 package 所有权、子包级 maintain 汇总 | 未建 monorepo fixture 实测；口径与既有脚本能力一致，无新增未验证声明 |

### P2 已知偏差

- 项 17：宿主挂载属用户环境操作，脚本侧已验证；项 18：GenUI 渲染效果待 MiniMax 宿主实测。均如实标注，不虚报「已验证」。项 16 已于 v0.7.1 完整落地（技能/agent 正文单一源 + 生成一致性校验）。
