# Steward · 长期维护型研发团队

> 不只是把需求写完，而是让项目在每次变更后仍然可理解、可验证、可回滚、可继续演进。

简体中文 | [English](README.en.md)

Steward 是面向 ZCode / MiniMax / DeepSeek Harness（DSH）的多角色研发团队插件。主对话代理担任 **Tech Lead**，把需求拆成任务 DAG，按「依赖 + 文件所有权」调度子智能体。

## Steward 是什么

当前版本（ZCode 1.1.0 / MiniMax 1.1.0 / DSH 1.2.0）覆盖功能交付（含 subagent / inline 两种执行模式）、Bug 修复（B0–B3 分流）、只出计划、维护循环、接手存量与演进循环；v0.8 起双宿主共享 docTier=3 完整文档流水线（七阶段文档树 + PRD/FRD/契约/页面/测试/部署全量模板 + 命名守卫与文档检查）与 M/L 需求的第一性原理澄清/提问预算，v0.8.1 起双宿主共享 `steward:using-steward` 技能路由，技能/agent 正文单一源生成，MiniMax 另附带维护健康看板等可选 GenUI 视图；DSH 侧（0.2.0 起）用 DSH 原生机制实现：0.3.0 起角色**不再注册为 Agent Preset**（可写专员模式会绕过门禁），0.4.0 移除自建私有配置与 HTTP 桥（配置改走原生 Config）、0.5.0 主技能按需拆出 `inline` / `docs` 并接入 **Agent Teams 共享任务板**，0.6.0 补上第一版 **Steward 团队面板**（Web 整页：Agent 关系图 + 点成员进子会话 + 逐角色模型/档位配置；路由 = 项目 `steward.config.json` 优先，其次面板，最后继承主代理），0.9.0 新增 `docs-governance` 文档治理技能与 G1–G11 本地门禁，1.0.0 收口；**DSH 1.2.0 把看板从左侧导航的整页改成每会话一份的右侧栏面板**——派发图（`Lead → 任务` 派发箭头 + 任务依赖连线）、子代理实时状态（点一行在右侧栏打开它的子会话）、`tmp/steward/<run>/` 产物（点一行打开文件），任务来源按「共享任务板 > `run.json` > 待办清单」三级回落（不再要求启用 Agent Teams），「设置 → Steward」只保留逐角色模型/思考强度表格。

**ZCode 侧 1.0.0 与 MiniMax 侧 1.0.0 分别对齐 DSH 1.0.0 的规范流程优化**（两侧机制各自原生、语义对齐）：新增 `steward:docs-governance` 文档治理技能（活 / 记录 / 基线三类分治、体积预算与 hub-and-spoke 拆册、frontmatter 读契约、`history/` 版本快照与双向溯源）与宿主无关的 `steward:project-lifecycle` 项目全生命周期技能；ZCode 侧门禁在 `scripts/docs-gov/`、MiniMax 侧在 `scripts/`（各宿主自有脚本，不互相灌包）；MiniMax 侧另把主技能按需拆出 `inline` / `docs` 两个小技能（主技能只留指针），机制用 MiniMax Code 自己的（技能按需加载 + 子代理 frontmatter + hooks + Mini App）。DSH 侧功能零改动。

**1.1.0 起**：DSH 原生名册命令 `/steward` 改名 **`/steward-roster`**——命令与 `steward` 技能同名时，client 侧会把同名 token 判给命令，`/steward` 永远变成命令回显、技能正文注入不了（遮蔽根因）；改名后 `/steward` 恢复为触发技能的斜杠手势（ZCode/MiniMax 的 `/steward` 系斜杠命令不受影响）。门禁脚本单一源迁至 `shared/scripts/`（三宿主共享；`zcode/scripts/` 降为 ZCode/MiniMax 专有工具 + 生成物）。新增通用 harness 技能投放路径（`.agents/skills/`，见下文「通用 harness 安装」）。

## 工作模式

| 模式 | 命令 | 状态 |
|---|---|---|
| 功能交付 | `/steward <需求>` | 0.6.0 可用 |
| 直接执行（inline） | `/steward:inline <需求>` | 0.10.0 可用（仅 S / B3 / 维护小修；M 需显式要求；L 与 B0/B1/B2 禁止） |
| 需求澄清 | 随 `/steward`（M/L/二义） | 0.8.0 起双宿主可用（第一性原理四问 + 最多 3 个 P0；S 级不追问） |
| Bug 修复 | `/steward:fix <Bug>` | 0.5.0 可用（ZCode 命令；MiniMax / DSH 用自然语言触发） |
| 只出计划 | `/steward:plan <需求>` | 0.5.0 可用（ZCode 命令；MiniMax / DSH 用自然语言触发） |
| 维护循环 | `/steward:maintain` | 0.6.0 可用（`maintain.mjs` 扫描 + backlog；MiniMax / DSH 用自然语言触发） |
| 接手存量 | `/steward:take-over` | 0.7.0 可用（扫描生成 T1 + 首轮健康扫描；MiniMax / DSH 用自然语言触发） |
| 文档流水线 | `docTier: 3`（随 `/steward`） | 0.8.0 起双宿主可用（七阶段树 + 全量模板 + 文档检查；MiniMax 1.6.0 同步） |
| 主技能按需拆分 | 加载 `steward:inline` / `steward:docs` | 1.0.0 起 MiniMax 可用（DSH 0.5.0 同款：主技能只留指针，小节按需加载） |
| 文档治理 | 加载 `steward:docs-governance` | 1.0.0 起 MiniMax 可用（DSH 0.9.0 同款：三类文档分治 + G1–G11 门禁 + 基线快照） |
| 技能路由 | 加载 `steward:using-steward` | 0.8.1 起双宿主可用（不知道用哪个入口/技能时先做路由） |
| 子代理模型配置 | 加载 `steward:agent-settings` | 0.9.0 起 MiniMax 可用（可视化配置页 / CLI；ZCode 沿用宿主默认模型）；DSH 0.2.0–0.3.0 曾是 Settings 页 + `steward_config` 工具，**0.4.0 起 `steward_config` 工具已移除**，配置来源改为「项目根 `steward.config.json` 的 `modelRouting` 优先，其次「设置 → Steward」的模型表格（原生 Config namespace `steward`），都没有则继承主代理」 |
| DSH 原生机制 | 随插件注册 | 0.2.0 起用原生扩展点；0.3.0 起角色**去模式化**；0.4.0 起**不再自建私有配置文件与 HTTP 桥**（配置改走原生 Config namespace `steward`）；0.5.0 起 `inline` / `docs` 按需技能 + **Agent Teams 共享任务板**（`steward_board` 建板，原生 Team 面板即看板）；0.6.0 起有团队面板，**1.2.0 起改为每会话一份的右侧栏看板**（派发图 / 子代理 / 产物；client 半只注册右侧栏 tab 类型、会话标题栏入口与设置分区，不再注册整页与左侧导航入口） |
| 宿主守卫 hooks | 随插件生效（PreToolUse） | 0.11.0 起双宿主可用（三道守卫：密钥 / 所有权 / 危险命令） |

功能交付：受理定级（S/M/L）→ 方案 → 批准门 → 实施 → QA → 浏览器验收 → 终审 → 收尾。Bug 修复按严重度分流：B2/B3 走「复现 → 失败测试 → 根因 → 最小修复 → 回归 → 记录」，B0/B1 增加止损与 postmortem 复盘。只出计划：方案 → 计划校验 → Plan Critic → 用户批准后停止，不实施。维护循环：八类扫描（依赖/安全/重复/churn/文档漂移/循环依赖/flaky/TODO/重构比例）→ 评分排序 backlog → 小修 → 更新 HEALTH。接手：扫描生成 T1 项目记忆 + 首轮健康扫描，先盘点后动手。演进与 T3/文档流水线见 [docs/ROADMAP.md](docs/ROADMAP.md)。

## 团队名册（7 角色 + 外援）

| 角色 | 派发名 | 职责 |
|---|---|---|
| 需求分析师 | `steward:pm` | 模糊需求 → 可测规格 |
| 架构师 | `steward:architect` | 规格 → 技术方案 + 任务 DAG |
| 后端工程师 | `steward:backend-dev` | 按任务单 TDD 实施 |
| 前端工程师 | `steward:frontend-dev` | 实施 UI + 验收脚本 |
| 测试工程师 | `steward:qa-engineer` | 测试 / lint / typecheck 质量门 |
| 浏览器验收员 | `steward:browser-tester` | 真实浏览器黑盒验收 |
| 代码评审员 | `steward:reviewer` | 终审 diff，三级意见 |
| 外援 Explore | 内置 | L 级开工前仓库勘察 |

> DSH 侧的角色是**派单时注入的章程**（不注册 Agent Preset，模式选择器里没有 Steward 专员模式）；派发时用 `steward_dispatch(role=...)` 只填角色，不手写模型。

## 核心机制

- **任务 DAG + 文件所有权**：并行条件 = 无依赖 且 文件所有权不相交。
- **S/M/L 分档**：小需求不走全员大会；M/L 过计划批准门（干净上下文 Plan Critic + 用户批准）。
- **执行模式（v0.10.0）**：`execution.mode` 可选 `subagent`（默认，派子代理）或 `inline`（主代理自己按 DAG 执行）；inline 仍保留计划、baseline、TDD、verify 与报告，只换执行者，不降门禁。S / B3 / 维护小修可直接使用，M 需显式开启，L 与 B0/B1/B2 禁止。
- **宿主守卫 hooks（v0.11）**：MiniMax 侧补齐 ZCode 已有的三道 PreToolUse 守卫（`secret` 密钥扫描 / `ownership` 文件所有权 / `dangerous` 危险命令），已在 `hooks/hooks.json` 注册并随插件生效，fail-open。
- **主技能按需拆分（v1.0.0，MiniMax 侧）**：主技能里的「执行模式（inline）」与「T3 文档按需升级 + 文档流水线」两节，在 MiniMax 生成物里拆成 `steward:inline` / `steward:docs` 两个小技能，主技能只留一行指针——共享正文 `shared/` 仍是单一来源，拆分由宿主配置 `host/<宿主>/skills/split-rules.json` 驱动，DSH 侧同款做法。
- **文档治理（v1.0.0，MiniMax 侧）**：新增 `steward:docs-governance`——「活文档管体积 / 记录文档管索引 / 基线文档管版本」三类分治、体积预算与 hub-and-spoke 拆册、frontmatter 读契约、`07-治理` 内部分层与归档轮转、`history/` 版本快照与双向溯源；随包提供 `scripts/docs-gate.mjs`（G1–G11 门禁，含 `check` / `init` / `fix` / `--baseline-write`）与 `scripts/doc-snapshot.mjs`（九步基线快照，幂等）。
- **可信变更门禁（v0.5）**：`validate-plan.mjs` 机检计划（路径存在 / DAG 无环 / 所有权不相交 / AC 覆盖 / 测试改动须声明理由）；`verify.mjs` 独立复跑测试/lint/typecheck（支持 `--repeat` 查 flaky）；`baseline record/check` 记回滚锚点并拦截越界 diff；`run-state.mjs` 断点恢复 + 同一错误连续 2 次即停 + 失败重试预算。全部为本地 Node 脚本，不做 CI。
- **Bug 通道（v0.5）**：B0–B3 分级；可复现 Bug 无失败测试不修；反作弊（测试 diff 须声明理由、弱化断言判 blocking）。
- **维护循环（v0.6）**：`maintain.mjs` 八类扫描（依赖/安全/重复/churn/文档漂移/循环依赖/flaky/TODO）→ 评分排序 backlog → 小修闭环 → 更新 HEALTH.md。
- **浏览器证据契约（v0.6）**：`browser-evidence.json`——每步判定引用 ARIA/DOM/console/network/URL 可读状态；优先 Playwright / Chrome DevTools MCP，退内置浏览器；布局/颜色类问题标「视觉未验证」，截图只作附件。
- **学习循环（v0.6）**：05-record 回填——评审发现/事故教训/用户纠正沉淀到 CONSTITUTION / ADR / RUNBOOK / HEALTH。
- **轻量技能（v0.6）**：`systematic-debugging`、`tdd`、`verification-before-completion`，按需加载不默认注入。
- **技能路由（v0.8.1，ZCode 侧）**：不知道用哪个入口/技能时加载 `steward:using-steward`；它只做路由，不替代主技能。
- **子代理模型与思考强度可视化配置（v0.9.0，MiniMax 侧）**：7 个子代理的模型与档位可视化改——应用内的 Mini App 配置页，或 `agent-config.mjs serve` 起的本地页；档位下拉只列该模型真实支持的集合（实时读本机模型目录，不硬编码）；写盘走「校验 → 备份 → 写 → 复校 → 失败回滚」。项目级 `steward.config.json` 下次派单即生效；插件默认改完 build + 安装后**新会话**生效。顺带修掉「frontmatter 只写 model 不写 effort → 直接调用子代理时档位落到 low」的偏差。
- **DSH 侧原生机制对齐（DSH 0.2.0 → 0.4.0）**：不把 ZCode 的角色/配置形状移植过来，而是用 DSH 自己的扩展点实现同样功能——① **角色不注册 Agent Preset**：DSH 里 preset 就是用户可选的会话模式，没有「内部 preset」；把 7 个角色做成 preset 等于把可写的专员模式摆进选择器，用户切过去改代码就绕开了计划门 / 基线守卫 / QA / 终审，所以 `steward_dispatch` 让子代理跑 DSH 内置的 `standard` 组合，把该角色的章程（`roles/*.md`）拼在派单正文前（章程在前、任务在后），角色不出现在模式选择器里；② **路由只有一个来源**：项目根 `steward.config.json` 的 `modelRouting.<role>`，跟代码一起进仓库、可评审可回滚，用随包的 `validate-config.mjs` 机检——因此 `steward_config` 工具已移除，配置来源是「项目文件 > 团队面板里的原生 Config（namespace `steward`）> 继承主代理」；③ `/steward-roster` 注册在原生人类命令注册表（1.1.0 起由 `/steward` 改名，`/steward` 现在是触发 `steward` 技能的斜杠手势）；④ 技能仍走 `ctx.skills`；⑤ **没有自建私有配置文件、也没有自建 HTTP 桥**——配置走 DSH 原生 Config，面板走原生 `configForms`，团队面板整页由 client 半注册到 `main` / `sidebar.panellist` / `settings.section`。派发前用 `llm.resolveModelInfo` 预检模型与档位。DSH 侧独立构建器 `node host/dsh/build.mjs` 只读 `shared/`（含 `shared/scripts/`）与 `zcode/skills/` 参考库、只写 `dsh/`，并在生成 `roles/*.md` 时把宿主 MCP / `context7` 之类的 ZCode/MiniMax 事实替换成 DSH 原生检索口径；包契约机检：`index.js` 里出现 `agentPresets.register` / `steward_config` / `webServer` / `/api/dsh-steward` 任一项判失败；同时**必须保留** `export const Config` / `settings.describe` / `agentTeams` / `steward.config.json`，缺任一项同样判失败。
- **项目记忆（v0.5）**：`take-over.mjs` 可为目标项目生成 AGENTS.md + `docs/project/` 七件套初稿（T0/T1）。
- **工件交接**：`tmp/steward/<run-id>/`，不在 prompt 里转述长文。
- **三道质量门**：QA → 浏览器验收（有 UI）→ 评审；缺陷按归属回派，最多 2 轮。
- **真实输出**：不美化、不编造；失败就是失败。

## 目录结构

```text
steward/
├── shared/                     # 唯一正文源：技能 / agent 共享正文 + 门禁脚本单一源 shared/scripts/（含 @@SLOT@@ 宿主槽位）
├── host/{zcode,minimax,dsh}/   # 宿主片段：frontmatter、派发机制、模型表、浏览器操作方式等
├── zcode/                      # ZCode 插件包（技能/agent 由 build.mjs 生成）
├── minimax/                    # MiniMax 插件包（技能/agent 由 build.mjs 生成；含 miniapp/ 配置页）
├── dsh/                        # DSH 插件包（Host/Client 插件 + 技能/角色/脚本，由 build.mjs 生成）
├── docs/
│   ├── README.md
│   ├── ROADMAP.md              # 2026 路线图
│   └── ROADMAP-STATUS.md       # 路线图交付状态与证据
├── README.md                   # 中文版（本文件）
├── README.en.md                # English version
└── CHANGELOG.md
```

> 维护者注意：ZCode / MiniMax 的技能与 agent 正文改 `shared/`（共享部分）或 `host/<宿主>/`，跑 `node zcode/scripts/build.mjs`；DSH 侧正文同样来自 `shared/` + `host/dsh/`，但由**独立构建器** `node host/dsh/build.mjs` 生成，只读 `shared/`（含 `shared/scripts/`）与 `zcode/skills/` 参考库、只写 `dsh/`。两个构建器互不写对方的包；`--check` 都会拦住手改与漂移。插件安装目录不需要也不应运行构建器。
>
> **宿主侧隔离**：ZCode 侧只改 `zcode/` + `host/zcode/`，MiniMax 侧只改 `minimax/` + `host/minimax/`，DSH 侧只改 `dsh/` + `host/dsh/`；`shared/`（含 `shared/scripts/`）是三宿主共享源，`zcode/scripts/` 自 1.1.0 起只剩 ZCode/MiniMax 专有工具与生成物（DSH 不再读取它）。安装/更新也各走各的：ZCode 用 `zcode plugins update`，MiniMax 用 `agent-config.mjs install --apply`，DSH 用插件管理器的 `install_bundle`（目标目录 `dsh/`）。详见根目录 `AGENTS.md`。

## 安装（三侧导航）

三个宿主各自的**完整安装 → 使用 → 排障**都在侧包 README 里，本节只做导航：

| 宿主 | 包目录 | 怎么装（详见链接） | 开工入口 |
|---|---|---|---|
| ZCode | `zcode/` | 本地 marketplace 目录方式，5 步：[zcode/README.md](zcode/README.md) | 新任务输入 `/steward <需求>` |
| MiniMax | `minimax/` | 先重建再拷贝到 `%USERPROFILE%\.minimax\plugins\steward\`：[minimax/README.md](minimax/README.md) | 自然语言（输入含「开发团队 / Steward」自动触发） |
| DSH | `dsh/` | 源码仓库重建 `dsh/` → 插件管理器 `install_bundle` 指向 `dsh/` → **重启 DSH**：[host/dsh/README.zh.md](host/dsh/README.zh.md) | 自然语言「用 Steward 做 <需求>」；名册命令 `/steward-roster`（`/steward` 是触发技能的斜杠手势） |

> 更新 / 升级与排障同样在各侧 README。生成物（`zcode/`、`minimax/`、`dsh/`）不要手改：改 `shared/` 或 `host/<宿主>/` 后重跑对应构建器（见上方维护者注意）。

## 通用 harness 安装（不装整包，只投 4 个技能）

Steward 有 4 个**宿主无关**的纯指令技能——不依赖子代理 / 斜杠命令 / hooks，正文都在本仓库 `shared/skills/` 下，任何支持「技能目录」的 harness 都可以不装整包、直接投放：`systematic-debugging`（系统化调试纪律）、`tdd`（测试先行纪律）、`verification-before-completion`（完成前验证纪律）、`project-lifecycle`（项目全生命周期规范，随包带 `references/` 与 `assets/`）。

- **项目级**（只对该仓库生效）：复制到 `<目标仓库>/.agents/skills/<技能名>/`；
- **用户级**（该机器所有项目生效）：复制到 `~/.agents/skills/<技能名>/`。DSH 原生按这两条路径发现技能；其它 harness 按各自的技能目录约定放置即可。

可复制的命令（PowerShell，项目级；`<repo>` 换成本仓库检出位置，`<目标仓库>` 换成要投放的项目）：

```powershell
$src = "<repo>\shared\skills"; $dst = "<目标仓库>\.agents\skills"
New-Item -ItemType Directory -Force "$dst" | Out-Null
'systematic-debugging','tdd','verification-before-completion','project-lifecycle' |
  ForEach-Object { Copy-Item -Path "$src\$_" -Destination "$dst\$_" -Recurse -Force }
```

用户级把 `$dst` 换成 `"$env:USERPROFILE\.agents\skills"` 即可。纯目录复制（SKILL.md + references/assets），**不需要任何 npm/npx 安装器**，新会话起生效。

## 路线图

- [docs/ROADMAP.md](docs/ROADMAP.md) · 交付状态：[docs/ROADMAP-STATUS.md](docs/ROADMAP-STATUS.md)
- 已实现（v0.5）：Bug 通道（B0–B3）、计划批准门 + Plan Critic、计划校验 / 独立验证 / 基线守卫、run.json 断点恢复、T0/T1 项目记忆生成。
- 已实现（v0.6）：维护循环（maintain.mjs 八类扫描）、浏览器证据契约、学习循环（05-record 回填）、systematic-debugging / TDD / verification 三个轻量技能、可选 worktree + finishing、模型路由 + 重试预算。
- 已实现（v0.7）：接手存量（take-over 扫描 + 首轮健康扫描）、演进循环（重构比例 / codemod 计划）、T3 模板六件按需升级、双宿主本地构建（build.mjs 单一正文源 + 校验）、可选宿主守卫 hooks（所有权/危险命令/密钥）、GenUI 维护健康看板（专用配方 C）、monorepo/多服务口径。
- 已实现（v0.8）：文档流水线完整吸收——七阶段 `docs/01..07` 树、19 类模板 + T2 需求/证据/记录模板、AGENTS/rules 约束层、命名守卫与文档检查本地脚本（`scripts/doc/`）；需求澄清内核（第一性原理四问 + 最多 3 个 P0 提问预算，S 级不追问）；worktree 多分支合并演练 6/6 PASS；taskboard 两处 non-blocking 清理（过滤竞态 + Cache-Control）22/22。文档流水线与澄清内核自 MiniMax 1.6.0 起由 build.mjs 同步到双宿主。
- 已实现（v0.8.1）：`steward:using-steward` 技能路由——不知道用哪个入口/技能时，先路由到功能交付 / Bug / 只出计划 / 维护 / 接手 / 文档流水线，并提示何时加载 debugging / TDD / 完成前验证；MiniMax 侧自 1.6.2 起同步（路由表按宿主适配：ZCode 斜杠命令 / MiniMax 自然语言）。
- 已实现（DSH 0.2.0 → 0.5.0）：DSH 侧用宿主原生机制实现——`steward_dispatch` over `ctx.subagents`、`/steward` 注册到原生 commands（1.1.0 起改名 `/steward-roster`）、技能走 `ctx.skills`；独立构建器 `node host/dsh/build.mjs`（只读 `shared/`（含 `shared/scripts/`）与 `zcode/skills/` 参考库、只写 `dsh/`）。0.2.0 曾把 7 个角色注册为 Agent Preset，**0.3.0 已移除**（preset 就是用户可选的会话模式，可写专员模式会绕过门禁），改为派单注入章程；**0.4.0 再收一刀**：删 Config / `steward_config` / 整个浏览器半，路由只留项目 `steward.config.json`；**0.5.0**：主技能按需拆出 `inline` / `docs` 两个技能（正文仍来自 `shared/`，拆分只在 DSH 生成物里），并新增 `steward_board` 把 `03-plan.json` 建成 **Agent Teams 共享任务板**（G1 计划门 → 工作单 → G2 QA → G3 终审，依赖即 DAG，文件所有权即写入范围），Web Team 面板直接当看板。`node --test host/dsh/tests/` 14 例覆盖「工具/命令/技能注册 / 技能拆分 / 不注册预设 / 章程注入 / 项目级路由与降级 / 组合缺失拒绝 / 建板与幂等 / status / brief / 无团队时报错 / 产物无设置与客户端残留」。
- 已实现（v1.0.0，MiniMax 侧对齐 DSH 1.0.0）：主技能按需拆分（`inline` / `docs`）+ `docs-governance` 文档治理技能 + 随包门禁（`docs-gate.mjs` G1–G11、`doc-snapshot.mjs` 快照幂等）；共享构建器新增三个宿主钩子（宿主级技能拆分 / 宿主整技能覆盖 / 宿主脚本目录），ZCode 侧输出逐字节不变；两宿主版本同升 1.0.0。
- 已实现（1.1.0）：DSH 原生命令改名 `/steward-roster`，解除对同名技能的 client 侧遮蔽（破坏性变更；`/steward` 恢复为技能手势）；门禁脚本单一源 `zcode/scripts/` → `shared/scripts/`；通用 harness 技能投放路径（`.agents/skills/`）文档化；文档职责重排与版本号统一。
- 已实现（DSH 1.2.0）：看板从左侧导航整页迁到**每会话一份的右侧栏面板**（`kind: steward`，由会话标题栏图标 / 引导页 / 首次派发自动打开进出），内容为运行卡片 + **派发图**（`Lead` 根节点、派发箭头、任务依赖连线、列宽 130–238px 自适应、列间距均分并居中；待办清单也画成 `Lead → 各项`）+ 列表 / 归属矩阵 + 子代理区（点行进子会话）+ 产物区（点行打开文件）；任务来源「共享任务板 > `run.json` + `03-plan.json` > `todos`」三级回落，不再要求 Agent Teams；「设置 → Steward」只留逐角色模型表格；`steward_dispatch` 的 label 带角色前缀。客户端半重写、构建器契约翻转（**禁止** `main` / `sidebar.panellist` 回归），`node --test host/dsh/tests/` **76 例**。
- 重点（后续）：MiniMax 宿主 GenUI 实机验收；DSH 右侧栏看板在真实浏览器里的视觉验收（几何与交互已由 76 例单测覆盖，本机浏览器扩展离线，尚未做人工点检）。

## 从 dev-team 更名

Steward 是原 `dev-team` 插件的更名版本。插件 ID、命令、agent 前缀、技能命名空间均已更新为 `steward`；旧版本可卸载后安装新版本。

## License

MIT
