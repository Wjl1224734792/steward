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
| 9 | 浏览器证据契约 | 已实现（v0.7.2 演练） | taskboard fixture 真实浏览器（ZCode IAB）7 步证据落 `.steward/ml-run/browser-evidence.json`：优先级徽标（ARIA/DOM）、过滤三态（DOM + fetch 捕获 ?priority=）、导出 tasks.json（下载内容四字段 + 锚点 download 钩子）、空结果导出 []（Blob 运行时捕获）、完成/取消、失败态「加载失败：…」→恢复「暂无任务」、console/网络（宿主 [RUM] 噪声已区分）；visual=unverified | 演练同时发现真实问题：GET /api/tasks 无 Cache-Control 时停机瞬间可能读到缓存（已记 non-blocking）；截图未采集，视觉判定未做。**v0.8.0 已清理两项 non-blocking**（过滤竞态 + no-store），fixture 22/22 PASS |
| 10 | ADR/CHANGELOG/05-record 学习循环 | 已实现 | SKILL「学习循环（05-record）」节（六类来源 → 五个沉淀位置，双宿主）；机制已在 P0 演练：postmortem 教训回填 fixture CONSTITUTION（金额求和不变量红线）、maintain 结论回填 HEALTH.md | 用户拍板类回填须先问 |
| 11 | systematic-debugging / TDD / verification 技能 | 已实现 | 双宿主 `skills/{systematic-debugging,tdd,verification-before-completion}/SKILL.md`；minimax plugin.json skills 列表注册（JSON 校验通过）；SKILL 派单指引：Bug 模式加载 systematic-debugging | 按需加载，不默认注入 |
| 12 | 可选 worktree + 任务分支 + finishing | 已实现（v0.8.0 演练） | SKILL Stage 5.5 finishing +「隔离与并行写」节（三种触发条件、DAG 顺序串行合并、每合并跑 verify）；v0.8.0 真实多分支演练：T1/T2 两个文件集不相交任务各自 worktree 实现 + `node --test`，主工作区 `--no-ff` 串行合并，合并后 pass 2 → pass 4；同文件冲突探针 `UU README.md`；清理后主分支仍绿——**6/6 PASS**，记录 `tmp/steward-fixtures/worktree-demo/DRILL.md` | 路由/合并顺序/冲突边界/清理均已验证；生产项目仍未实际启用 worktree（默认关闭） |
| 13 | 模型路由 + fallback + 预算 | 已实现 | validate-config 对 modelRouting（角色白名单告警）与 budget.maxTotalAttempts（负例 exit 1）校验通过；run-state `--budget-attempts 2` 两次 fail 后停摆 exit 2、stopReason=budget-exhausted（真实输出）；SKILL「模型路由与预算」节（MiniMax model+effort 成对传、fallback 重试一次） | 派发级 fallback 以提示词纪律落地；token 级预算无法跨宿主可靠获取，采用「失败重试次数」预算（诚实口径） |

### P1 已知偏差

- 项 9 已于 v0.7.2 完成真实浏览器演练（证据见上）；worktree 合并已于 v0.8.0 完成真实多分支演练（DRILL.md 6/6 PASS）。
- token/轮次预算采用失败重试次数口径（maxTotalAttempts）；宿主未暴露 token 计数接口，不做假预算。

## P2（v0.7，ZCode 0.7.3 / MiniMax 1.5.3）— 2026-11-06

| # | 交付 | 状态 | 证据 | 备注 |
|---|---|---|---|---|
| 14 | 架构演进：模块边界/循环依赖/重复率/重构比例检查，codemod/批量改动计划 | 已实现 | maintain.mjs 新增重构比例检查（`<0.1` 报警，<20 提交窗口正确跳过——自扫实测）；SKILL「演进循环」节（双宿主）：四类检查 + codemod 走计划模式分批执行（每批 verify+baseline，红了即停）+ 边界变化先立 ADR | 循环依赖/重复率/churn 检查 P1 已有，此处纳入演进循环口径 |
| 15 | T3 文档按需升级 | 已实现 | `scripts/templates/t3/` 六件（PRD/FRD/CONTRACT/PAGE-LAYOUT/TEST-PLAN/DEPLOYMENT），build.mjs 已同步 minimax；SKILL「T3 按需升级」节（docTier=3，验收条目收敛进 AC 由 validate-plan 机检） | 模板为骨架；PRD/FRD 的实际产出质量待首个 docTier=3 项目检验 |
| 16 | 双宿主单一正文源 + 本地构建脚本 | 已实现（v0.7.1） | **技能/agent 正文单一源**：`shared/`（共享正文 + `@@SLOT@@`）+ `host/<宿主>/`（frontmatter/名册与派发/标签/浏览器操作方式）→ `build.mjs` 生成 2 宿主 ×（4 技能 + 7 agent）= 22 个文件；生成物带「请勿手改」标记。`--check` 校验：生成一致性（篡改测试：手改 `minimax/agents/pm.md` → FAIL exit 1，重建恢复）、脚本/模板同步、清单、frontmatter、版本节奏、残留槽位；缺 `shared/`+`host/` 布局友好失败 exit 2。生成前后逐文件 diff：仅计划内归一 + 生成标记，无内容丢失（minimax 模型表/派发方式/可视化/glm 注记、zcode hooks 行均保留） | 维护方式：只改 `shared/` 或 `host/` 后跑 `node zcode/scripts/build.mjs`；脚本仍以 zcode 为源同步到 minimax（宿主包自包含） |
| 17 | ZCode hooks：所有权/危险命令/密钥 | 已实现（配置+契约自检；live 拦截待新会话） | 按宿主权威格式修正：`zcode/hooks/hooks.json`（PreToolUse + Write/Edit/Bash matcher + `${CLAUDE_PLUGIN_ROOT}`，无非法键）随插件分发；工作区 `.zcode/config.json`（`enabled:true` + `${ZCODE_PROJECT_DIR}` 三守卫）已挂载；`scripts/hooks/selftest.mjs` **11/11 PASS**（危险命令/密钥/所有权/坏 JSON，exit 0/2 + stdout 为空契约）；`zcode/hooks/README.md` 说明激活/关闭/ownership 文件格式 | hook 配置会话启动时加载：**宿主级 live 拦截在新会话生效**，本会话内以契约自检+配置校验验证，不虚报「已拦截」 |
| 18 | GenUI 健康/进度看板 | 已实现（v1.5.3 配方 C） | **专用配方 C**：components.md（视觉基线 + 页头 / 健康分 + 分级 + 环比 + SVG 趋势 / 3 KPI / 状态分布 / 8 类矩阵 / 排序 backlog / 详情 / 动作条）、examples.md 完整示例 C（7 条 backlog、5 点 history）、data-schema 增加可选 history 与展示口径派生值（healthGrade/openCount/maxScore/scoreDelta/topCategory）；`check-widget.mjs` 示例 A/B/C **3/3 PASS**；同源预览：1180 宽亮色截图、暗色令牌对比度 ≥4.5:1、640 窄屏无横向溢出、类别筛选 / 隐藏已修复 / 排序 / 展开 / 3 个 sendPrompt / 空-错误-缺字段态全过 | MiniMax 宿主实机待用户确认（ZCode 无 GenUI）；IAB 截图在会话后续调用超时，暗色 / 窄屏以计算样式与几何断言代替；Playwright click 超时，交互以页面内 DOM click 验证 |
| 19 | Monorepo / 多服务 | 已实现（口径） | SKILL「Monorepo / 多服务」节（双宿主）：workspaces 探测（take-over 已有 monorepoNote）、services 多服务配置（P0 schema 已支持）、按 package 所有权、子包级 maintain 汇总 | 未建 monorepo fixture 实测；口径与既有脚本能力一致，无新增未验证声明 |

### P2 已知偏差

- 项 17：配置已挂载、契约自检通过，宿主级 live 拦截需新会话验证；项 18：配方 C 与本地预览验收完成（v1.5.3），MiniMax 宿主实机待用户确认。项 16 已于 v0.7.1 完整落地。

## P3（v0.8，ZCode 0.8.1 / MiniMax 1.6.0）— 2026-11-07

| # | 交付 | 状态 | 证据 | 备注 |
|---|---|---|---|---|
| 20 | 文档流水线完整吸收（双宿主） | 已实现 | `zcode/skills/steward/references/doc-pipeline/`：hub README + 7 references + 19 类模板 + `templates/README.md` + T2 `01-REQUIREMENT`/`04-EVIDENCE`/`05-RECORD` + assets 基线（共 33 个 md）；`PROVENANCE.md` 记录来源/改编。`zcode/scripts/doc/`：`doc-init` / `doc-check` / `guard-naming`。技能经共享正文渲染，两宿主同节。fixture `tmp/steward-fixtures/doc-pipeline-demo/`：`test-doc-scripts.mjs` **30/30 PASS**（doc-init dry-run/写入/幂等；doc-check 正例 + 死链/未索引/缺 T1 负例；guard-naming WAVE/PRIORITY/`--init`/拒绝覆盖/stale/误伤保护）；模板拆分对照仅计划内适配。**MiniMax 1.6.0 同步**：`minimax/skills/steward/references/doc-pipeline/`（33 个 md）与 `minimax/scripts/doc/`（4 个文件）由 build.mjs 从 `zcode/` 侧单向同步，逐字节同源；对齐自检 **13/13 PASS**（含两树同源、MiniMax 包内 doc-init 五态、doc-check/guard-naming 对 fixture exit 0、库内 83 条引用可解析） | 外部 skill 快照冻结；文档流水线自 1.6.0 起为双宿主共享事实源 |
| 21 | 需求澄清内核（第一性原理 + 提问预算，双宿主） | 已实现（提示词级） | 技能 Stage 0.1（共享正文，两宿主同节）：M/L / 二义 / 新领域启用；第一性原理四问（问题/约束/备选/非目标+成功指标）+ 最多 3 个 P0 提问预算；S 级不追问；`templates/01-REQUIREMENT.md`。不引入「强制先问后写」硬门槛。提问工具按宿主分流：ZCode `AskUserQuestion` / MiniMax `ask_user` | 未做 agent 行为回归；等真实 M/L 需求观察是否只问 3 个 P0、是否把假设落盘 |
| 22 | 技能路由 `steward:using-steward`（ZCode 侧） | 已实现（提示词级） | `zcode/skills/using-steward/SKILL.md`：7 类入口（功能 / Bug / 计划 / 维护 / 接手 / 文档 / 澄清）+ 3 个轻量技能加载信号 + 3 条纪律 + 反例；主技能 ZCode frontmatter/banner 增加 ⑥ 技能路由；`build.mjs --check` PASS（仅预期 warning 0.8.1 vs 1.6.0）；MiniMax 生成物逐字节不变 | MiniMax 1.6.0 未同步，1.6.1 待补；路由为提示词级，未做 agent 行为回归 |

### P3 已知偏差

- MiniMax 侧已于 1.6.0 完成对齐（文档流水线 + 澄清内核 + 斜杠命令口径），版本节奏 warning 消失。
- `steward:using-steward` 为 ZCode-only（v0.8.1）；MiniMax 1.6.0 未带该技能，1.6.1 待补，因此当前版本节奏 warning 为预期。
- AFC/AIAPaaS 分支的 §5.0 仅**部分吸收**（第一性原理 + 提问预算），未引入「强制先问后写」；见 `PROVENANCE.md`。
- 需求澄清（Stage 0.1）为提示词级规则，未做 agent 行为回归；S/M 不触发，等真实 M/L 需求观察。
- 技能路由为提示词级规则，未做 agent 行为回归。

## 能力演练汇总（v0.7.2）— 2026-11-06

| 演练 | 覆盖能力 | 结果 | 证据（tmp/steward-fixtures/，gitignored） |
|---|---|---|---|
| taskboard M/L 全流程 | 规格 → architect 真实派单 → validate-plan → Plan Critic（干净上下文）→ 批准门 → T1/T2 并行真实派单 → QA 独立门 → 浏览器证据 → 终审 → 05-record | 交付完成：QA 18/18（--repeat 3 无 flaky）、终审「可交付」 | `taskboard/.steward/ml-run/`（02-spec/impact/plan、01-approval、reports/{t1,t2,qa,review}、browser-evidence.json、verify-result.json、05-record.md） |
| 浏览器证据 | ARIA/DOM/console/network/URL、下载内容、空态、失败恢复、visual unverified | 7 步全 pass；失败态→恢复真实验证 | `taskboard/.steward/ml-run/browser-evidence.json` |
| codemod 分批迁移 | 演进循环：12 call site 4 批 + 清理，每批 verify + baseline check，串行 DAG | 5/5 任务 done，每批 exit 0，最终无旧引用 | `legacy-api/.steward/codemod-run/`（03-plan.json、verify-T1..T5.json、05-record.md） |
| hooks 守卫 | 危险命令/密钥/所有权 + 宿主契约（exit 0/2、stdout 空、fail-open） | 11/11 PASS；工作区配置已挂载 | `zcode/scripts/hooks/selftest.mjs` 输出；`.zcode/config.json` |

### 演练中发现并修复的产品问题

- v0.7.2：`verify.mjs` 自动探测模式误判未探测门禁（M/L 演练 QA 阶段复现）→ 已修复并回归。
- v0.7.2：`guard.mjs` stdout 输出不符合宿主严格 JSON 契约 → 改为 stderr + exit 2。
- 记录待跟进（non-blocking）：taskboard 过滤快速切换响应竞态；GET /api/tasks 缺 Cache-Control。**已于 v0.8.0 清理**（22/22 PASS，见下）。

## v0.8 补充演练与清理（2026-11-06）

| 项 | 覆盖 | 结果 | 证据（tmp/steward-fixtures/，gitignored） |
|---|---|---|---|
| worktree 多分支合并 | 两个文件集不相交任务（sum / slug）各自 worktree + `node --test`；主工作区按 DAG 顺序 `--no-ff` 串行合并，每合并复跑；同文件冲突探针 | **6/6 PASS**：merge T1 后 pass 2；merge T2 后 pass 4；冲突 `UU README.md`；worktree/分支清理后主分支仍 pass 4 | `worktree-demo/DRILL.md` |
| taskboard 遗留清理 | 过滤竞态（refresh-guard 序号 + AbortController）、`GET /api/tasks` 加 `Cache-Control: no-store` | **22/22 PASS**（store 10 + HTTP 9 + guard 3） | `taskboard/.steward/cleanup-20261106.md` |
| 需求澄清内核 | Stage 0.1 第一性原理四问 + 最多 3 个 P0；S 级不追问；`templates/01-REQUIREMENT.md` | 渲染进双宿主 SKILL（共享正文，提问工具按宿主分流） | `shared/skills/steward.body.md`；`host/*/skills/steward/ask-tool.md` |
