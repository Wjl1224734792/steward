# 路线图交付状态（ROADMAP-STATUS）

> 对照 [ROADMAP.md](ROADMAP.md) §6 的交付表逐项记录：项 / 状态 / 证据 / 备注。状态 ∈ 未开始 / 进行中 / 已实现 / 部分实现。证据以真实命令输出为准。

## DSH 0.6.0（Steward 团队面板）— 2026-11-12

> 用户要求：能在 Web 里**看图看 agent 情况**、**点进去看每个子代理会话**、**自己配子代理模型与思考强度**；并拍板配置走原生设置（B 方案），仓库值优先、没写就往下落。0.6.0 用原生 `main` slot 做整页 + `sidebar.panellist` 入口，跳转用 `ctx.uiWorkspace.openSession`，配置用 `ctx.configForms`，数据用原生 `agentTeam` 投影——不自建 HTTP 桥、不写私有文件。

| # | 交付 | 状态 | 证据 | 备注 |
|---|---|---|---|---|
| D12 | Steward 团队面板（整页 + 侧栏 + 设置分区） | 已实现 | `node host/dsh/build.mjs` / `--check` exit 0；`node --test host/dsh/tests/` **16 pass / 0 fail**（含客户端 bundle 冒烟：假 `__ModuleLoader__` + 假 react 执行 `factory`/`apply`，断言 `main`(key steward) / `sidebar.panellist`(id steward) / `settings.section` 注册成功，并渲染「无团队数据」文案不含异常）；`node --check dsh/client.js` exit 0；热重载 `application: applied` | 图 = Lead + 成员卡（状态点/模型/当前任务），点击走 `openSession({parentSessionId, childSessionId, mode:'continuable'})`；任务板读 `projectionsBySession[*].values.agentTeam`；配置表单复用 0.2.0 的 configForms 逻辑（目录 `remote.session.modelCatalog()`） |
| D13 | 路由两层（项目优先 + 面板） | 已实现 | 单测「panel route applies when the project has no entry, and the project still wins」：面板 role → `source: role`；面板 defaults → `source: defaults`；项目 `modelRouting` → `source: project`（且 project 覆盖面板） | 回执文案标来源（`from steward.config.json` / `from the Steward panel`）；`/steward` 口径同步 |

## DSH 0.5.0（按需技能 + Agent Teams 任务板）— 2026-11-12

> 0.4.0 之后主技能仍是 20KB 一坨，且任务状态只活在 `run.json` 与 Lead 脑子里。0.5.0 把两件事补上：① inline 与文档流水线按需拆出（正文仍来自 `shared/`，拆分只在 DSH 生成物里，不碰共享源）；② 任务板交给 **Agent Teams 共享任务板**，Web 原生 Team 面板即看板，`steward_board` 只负责把计划变成板上的门禁 + 工作单。

| # | 交付 | 状态 | 证据 | 备注 |
|---|---|---|---|---|
| D10 | 技能按需拆分（`inline` / `docs`） | 已实现 | `node host/dsh/build.mjs` exit 0、`--check` exit 0；技能清单 6→8；`node --test host/dsh/tests/` 中「主技能指针 + 拆出小节」用例 PASS；热重载后会话技能列表出现 `inline` / `docs` | 拆分规则在 `build.mjs` 的 `SPLIT_RULES`（按 `## ` 标题锚点）；共享正文标题若改，构建会 FAIL 提示同步 |
| D11 | Agent Teams 共享任务板（`steward_board`） | 已实现 | `node --test host/dsh/tests/` **14 pass / 0 fail**（建板依赖与写范围 / 幂等 / S 级不建门禁 / status 表格 / brief 含章程与板上任务号 / 无 team 服务时报错）；真实 host 实建板：`steward_board(sync, level=M)` → 「已同步 6 个任务」+ 门禁 G1/G2/G3 + 3 张工作单（初始全 `⛔ 被阻塞`，T2/T3 依赖 T1，G2 依赖全部工作单） | 门禁/工作单靠描述里的 `steward:gate=` / `steward:plan=` 标记幂等匹配；任务板是只读视图（原生面板不提供编辑），改动一律走工具；未做 teammate 实派（`spawn_teammate` → claim → complete）的端到端演练 |

## DSH 0.4.0（host-only 收敛）— 2026-11-12

> 0.3.0 把角色从 preset 上摘了下来，留了两个「自建机制」的尾巴：原生 Config/Settings 路由与配套设置页。0.4.0 一并收掉：**配置只能有一个来源**——项目根 `steward.config.json` 的 `modelRouting.<role>`，跟代码一起进仓库、进同一个 diff、可评审可回滚，并用随包的 `validate-config.mjs` 机检。插件因此变成 host-only：删 `client.js`、删 `steward_config`、删 Config。**D1–D3 行是 0.2.0 的历史记录，其「原生 Settings」口径已被本版取代。**

| # | 交付 | 状态 | 证据 | 备注 |
|---|---|---|---|---|
| D8 | 删浏览器半 + `steward_config` + 原生 Config，路由只走项目配置 | 已实现 | `node host/dsh/build.mjs` exit 0 / `--check` exit 0；`node --test host/dsh/tests/` **8 pass / 0 fail**；`node --check dsh/index.js` exit 0；`Test-Path dsh/client.js` → `False`；热重载 `set_plugin(include:steward, false→true)` → `application: applied`；实派 `steward_dispatch(role=reviewer, cwd=<临时项目含 modelRouting>)` → `started steward subagent dec081f5-… (role reviewer, composition standard; ctaigw/glm-5.3-flash from steward.config.json)` | index.js 766 → 326 行；host 只注册 1 个工具 + 1 个命令 + 6 技能；坏配置（`model` 缺 `provider/`）降级为继承主代理（单测覆盖）；未在真实浏览器核对（本版已无设置页可核对） |
| D9 | 构建器 host-only 契约 | 已实现 | `--check` 对反向断言生效：`agentPresets.register` / `export const Config` / `settings.update` / `steward_config` / `webServer` / 存在 `dsh/client.js` 任一出现即 FAIL；`package.json` 契约同步检查「无 `dsh.client`、无 `./client` 导出、无 schemastery peer」 | 同步清单删掉 `client.js`；`dsh/client.js` 已从生成物删除 |

## DSH 0.3.0（角色去模式化）— 2026-11-12

> 0.2.0 把 7 个角色注册成 Agent Preset。DSH 里 preset 就是用户可选的会话模式（`PresetDefinition` 只有 id/name/description/order/plugins，没有 hidden 字段），而子代理人设只能来自 preset —— 所以「工人有系统提示级人设」与「模式选择器干净」不可兼得。0.3.0 选后者：角色章程改由 `steward_dispatch` 注入派单正文，子代理固定跑内置 `standard` 组合。**D1 / D3 行是 0.2.0 的历史记录，其「Agent Presets」口径已被本版取代。**

| # | 交付 | 状态 | 证据 | 备注 |
|---|---|---|---|---|
| D6 | 角色去预设化（章程注入 + `standard` 组合） | 已实现 | `node host/dsh/build.mjs` exit 0 / `--check` exit 0；`node --test host/dsh/tests/` **9 pass / 0 fail**；`node --check dsh/index.js`、`node --check dsh/client.js` exit 0；热重载 `plugin_manager set_plugin(include:steward, false→true)` → `application: applied`，重载后技能描述已变新口径；实派 `steward_dispatch(role=reviewer)` → `started steward subagent 3b1f1340-… (role reviewer, composition standard; qoder/qmodel_latest @ xhigh)`；子会话 JSONL：`{"origin":"subagent","delegationDepth":1,"agentPreset":"standard"}`、`agent-preset/selected {"agentPreset":"standard"}`，首条 inbox 以「你是软件开发团队的代码评审员（终审门）」开头；子代理回 `CHARTER_SMOKE_OK` + 章程首句 | 工人跑 `standard` 组合 → 拥有全套原生工具；「单写者」靠派单正文约束，不再靠缺工具硬挡（委派深度默认 1 仍挡住工人再派工）。未在真实浏览器里核对模式选择器（单测断言预设注册数为 0；roster 由宿主提供，不再含 Steward 条目） |
| D7 | 构建器单趟一致（技能清单） | 已实现 | 改技能 `description` 后首次 `--check` 会假失败（清单读的是上一轮磁盘产物）：`✗ [render] dsh/skills/manifest.json 与生成结果不一致`；把清单来源改为优先读本轮内存渲染结果后，`build` → `--check` 单趟 exit 0 | 只改清单取数来源，其余生成逻辑不变 |

## DSH 0.2.0（DSH 原生机制重写）— 2026-11-11

> 上一版（DSH 0.1.0）是在 DSH 里重做 ZCode/MiniMax 的一套形状：角色提示词拼进 prompt、私有 `~/.dsh/steward/subagent-config.json`、自建 `/api/dsh-steward/*` 桥 + 自绘配置页、斜杠命令缺失。0.2.0 按「功能对齐、机制原生」重写：用 DSH 自己的 Agent Presets / Config+Settings / configForms / commands / skills 实现同样能力。

| # | 交付 | 状态 | 证据 | 备注 |
|---|---|---|---|---|
| D1 | DSH 插件包（Host + Client），原生机制 | 已实现 | `node host/dsh/build.mjs` exit 0、`--check` exit 0；`node --test host/dsh/tests/` **8 pass / 0 fail**；`node --check dsh/index.js`、`node --check dsh/client.js` exit 0；`Config.listConfigs(include:steward)` → `status: schema`，7 角色 × provider/model/effort 全部 `x-cordis.volatile: true`；`plugin_manager set_plugin(include:steward, false/true)` → `application: applied`，技能目录随启停出现/消失 | Host：7 个角色 **Agent Presets**（`ctx.agentPresets.register`，每个 = `dsh-persona` + fs/fs-search/pwsh/web/skill/todo/present/compaction 原生工具组合）、原生 **Config**（命名空间 `steward`，volatile 原地生效）、`steward_config`/`steward_dispatch` 工具、`/steward` 命令、6 技能；Client：`settings.section` occupant `steward`（order 50）active，页面走 `ctx.configForms` + `remote.session.modelCatalog()`；无 HTTP 桥、无私有配置文件 |
| D2 | 原生 Settings 子代理模型/档位配置 | 已实现 | `steward_config(list)` 返回 `namespace=steward` + `documentPath=<profile>/cordis.patch.yml`；`set(role=reviewer, ctaigw/glm-5.3@high)` → profile `cordis.patch.yml` 新增 `- id: steward` 覆盖行（`config.roles.reviewer = {provider, model, effort}`）；`reset(role=reviewer)` → 写回空值；未知模型/档位/半截 route 在写前拒绝（单测 3 例） | 设置写入走原生 `settings.update` → `configEditor.edit`；`describe()` 的 `value/base/user/revision` 由宿主生成，插件不手改 patch；volatile 更新不重启插件 |
| D3 | 预设派发（Agent Preset + agentOptions） | 已实现 | 实派 `steward_dispatch(role=reviewer)` → `started steward subagent 46afd244-…`；子会话 JSONL 头部 `{"origin":"subagent","delegationDepth":1,"agentPreset":"steward-reviewer"}`，紧接 `agent-preset/selected {"agentPreset":"steward-reviewer"}` 与 `subagent/descriptor {"provider":"spawn","agentProvider":"ctaigw","agentModel":"glm-5.3","agentReasoningEffort":"high"}`；`request/header.config = {provider:ctaigw, model:glm-5.3, reasoningEffort:high, maxTokens:128000}`；子会话 system message 以「你是软件开发团队的代码评审员（终审门）…」开头（persona 来自 preset），task prompt 只含派单正文；子代理回传 `STEWARD_PRESET_OK` | 角色提示词不再拼进 prompt；项目级 `steward.config.json` modelRouting 优先（单测覆盖）；preset 未激活/后端不支持 agentPreset 时派发前拒绝 |
| D4 | DSH 侧独立构建、其他宿主零改动 | 已实现 | `node host/dsh/build.mjs --check` exit 0；`node --test host/dsh/tests/` 8/8；`node --test zcode/scripts/tests/` 54/54；`node zcode/scripts/build.mjs --check` exit 0；`git status` 仅 `dsh/` 与 `host/dsh/`（以及 README/CHANGELOG/ROADMAP-STATUS 文档），`zcode/`、`minimax/`、`shared/`、`zcode/scripts/` 无 diff | 构建器只读 `shared/`、`zcode/scripts/`，只写 `dsh/`；新增角色正文转写：把 ZCode/MiniMax 的宿主 MCP / `context7` 口径替换为 DSH 原生 `web_search`/`web_fetch`/`research` 与读依赖源码；包契约新增「原生机制」机检（禁止 `webServer`/`/api/dsh-steward`，要求 `configForms`） |
| D5 | 浏览器实机验收 | 部分实现 | Client Slots `settings.section` 查询：occupant `steward`（order 50）`active: true`，证明 Client 半加载、`configForms` 注入成功、页面已注册 | 未做真实浏览器截图/明暗主题/交互核对；不宣称视觉通过。Tabbit 认证 URL 仍不可得 |

## P5（v0.11，ZCode 0.11.0 / MiniMax 0.11.0）— 2026-11-11

| # | 交付 | 状态 | 证据 | 备注 |
|---|---|---|---|---|
| 25 | MiniMax 侧宿主守卫对齐（PreToolUse 三道守卫） | 已实现 | ① 缺口定位：审计发现 `minimax/scripts/hooks/guard.mjs` 已随包同步，但 `minimax/hooks/hooks.json` 只注册了 UserPromptSubmit——守卫脚本从未被宿主调用（带病上线）；② 注册：`minimax/hooks/hooks.json` 增加 `PreToolUse` 段（`write|edit` → secret + ownership；`bash` → dangerous），按 MiniMax 契约用 `${PLUGIN_ROOT}` + `commandWindows` + 小写原生工具名（契约见 plugin-creator `local-plugin-hooks.md`）；③ 技能正文：新增 `host/minimax/skills/steward/hooks-row.md`，门禁脚本表列出守卫入口；④ 说明：新增 `minimax/hooks/README.md`；⑤ 跨宿主自检：`selftest.mjs` 补 5 例 MiniMax 原生载荷（write 用 path+content、edit 用 file_path+new_string），**16 例全 PASS**（exit 0 放行 / exit 2 阻断 / stdout 为空）；⑥ 构建：`node zcode/scripts/build.mjs` exit 0、`--check` exit 0 零 warning；⑦ 单测：`node --test zcode/scripts/tests/` 全绿；⑧ 安装：`install --apply` 镜像到本机插件目录，逐字节比对一致 | 与 ZCode 侧同源同款守卫，差异仅在宿主契约（ZCode 用 `${CLAUDE_PLUGIN_ROOT}` + `Write|Edit`/`Bash`，MiniMax 用 `${PLUGIN_ROOT}` + `write|edit`/`bash`）；ownership 守卫需 Tech Lead 生成 `.steward/ownership.json` 才启用（有意设计，避免全局误拦）；dangerous/secret 守卫按插件级默认生效，删除 `hooks/hooks.json` 即关闭 |

## P4（v0.9，ZCode 0.9.0 / MiniMax 0.9.0）— 2026-11-11

| # | 交付 | 状态 | 证据 | 备注 |
|---|---|---|---|---|
| 23 | 子代理模型与思考强度可视化配置 | 已实现 | ① 构建：`node zcode/scripts/build.mjs` exit 0、`--check` exit 0 零 warning；② 单测：`node --test zcode/scripts/tests/agent-config.test.mjs` **49 tests / 10 suites / 49 pass / 0 fail**；③ 目录：`agent-config.mjs catalog` 列本机 8 供应商 / 19 模型 + 逐模型档位集合（非标准档位 mediem / hign 照原文标注）；④ 现状：`show` 输出 7 角色与生效来源；⑤ 本地页实跑：`GET /` 200、`/api/state` 200（roles=7、models=19）、`POST /api/save` 非法模型 400 且不落盘、合法写入 200 且随包返回 `[validate-config] 结果：PASS`（exit 0）、`/miniapp.json` 与 `/../scripts/build.mjs` 均 404；⑥ Mini App 冷启动：start(context) 实跑，`/` 200、`/api/state` 200、dispose 正常；⑦ 安装：`install --apply` 构建 exit 0 + 镜像 98 文件到本机插件目录，安装后版本 0.9.0、`miniapp/` 与 `skills/agent-settings` 到位；⑧ **effort 修复的硬证据**：新开会话实派 `steward:qa-engineer`，运行时 `local_runtime_session_agent_definitions` 记录其模型为 `custom_provider:provider-7970db/step-5-preview` 且 `thinking.effort = high`（旧会话同族定义无 effort 字段，即此前落到运行时默认） | 页面载体两形态：Mini App（主壳，与现有复制目录同一条安装链）+ `serve` 本地页（回落壳，同一份页面资产）。**Mini App 在真实宿主中的接纳与交互尚未实机验证**，本地页功能等价不受影响；档位名以本机配置原文为准（mediem / hign 不擅自纠正）；模型路由是 MiniMax-only，ZCode 侧沿用宿主默认模型 |

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

## P3（v0.8，两宿主同为 0.8.2）— 2026-11-07

| # | 交付 | 状态 | 证据 | 备注 |
|---|---|---|---|---|
| 20 | 文档流水线完整吸收（双宿主） | 已实现 | `zcode/skills/steward/references/doc-pipeline/`：hub README + 7 references + 19 类模板 + `templates/README.md` + T2 `01-REQUIREMENT`/`04-EVIDENCE`/`05-RECORD` + assets 基线（共 33 个 md）；`PROVENANCE.md` 记录来源/改编。`zcode/scripts/doc/`：`doc-init` / `doc-check` / `guard-naming`。技能经共享正文渲染，两宿主同节。fixture `tmp/steward-fixtures/doc-pipeline-demo/`：`test-doc-scripts.mjs` **30/30 PASS**（doc-init dry-run/写入/幂等；doc-check 正例 + 死链/未索引/缺 T1 负例；guard-naming WAVE/PRIORITY/`--init`/拒绝覆盖/stale/误伤保护）；模板拆分对照仅计划内适配。**MiniMax 1.6.0 同步**：`minimax/skills/steward/references/doc-pipeline/`（33 个 md）与 `minimax/scripts/doc/`（4 个文件）由 build.mjs 从 `zcode/` 侧单向同步，逐字节同源；对齐自检 **13/13 PASS**（含两树同源、MiniMax 包内 doc-init 五态、doc-check/guard-naming 对 fixture exit 0、库内 83 条引用可解析） | 外部 skill 快照冻结；文档流水线自 1.6.0 起为双宿主共享事实源 |
| 21 | 需求澄清内核（第一性原理 + 提问预算，双宿主） | 已实现（提示词级） | 技能 Stage 0.1（共享正文，两宿主同节）：M/L / 二义 / 新领域启用；第一性原理四问（问题/约束/备选/非目标+成功指标）+ 最多 3 个 P0 提问预算；S 级不追问；`templates/01-REQUIREMENT.md`。不引入「强制先问后写」硬门槛。提问工具按宿主分流：ZCode `AskUserQuestion` / MiniMax `ask_user` | 未做 agent 行为回归；等真实 M/L 需求观察是否只问 3 个 P0、是否把假设落盘 |
| 22 | 技能路由 `steward:using-steward`（双宿主） | 已实现（提示词级） | 正文上提为 `shared/skills/using-steward/SKILL.md`，路由表下沉为 `host/<host>/skills/using-steward/routing-table.md`：ZCode 列斜杠命令、MiniMax 列自然语言触发。7 类入口（功能 / Bug / 计划 / 维护 / 接手 / 文档 / 澄清）+ 3 个轻量技能加载信号 + 3 条纪律 + 反例；主技能 frontmatter/banner 增加 ⑥ 技能路由；两版 `@@SLOT` 残留 0；`build.mjs --check` exit 0 零 warning | 路由为提示词级，未做 agent 行为回归 |
| 24 | MiniMax 包路径契约修复（插件不可见根因） | 已实现 | 宿主要求包内路径全 ASCII（`NON_PORTABLE_PATH`）；v1.6.0 带入的 `assets/通用编程规范与指南.md` 使**整个包被拒载入**（插件列表无 Steward、hook 不触发、子会话无 `steward:*`）。修复：改名 `assets/coding-guidelines-baseline.md` + 更新 6 处引用；build.mjs 新增路径契约校验；部署改镜像语义。验证：已安装包 89 文件 / 路径契约 0 违规；hook-cache 出现 `steward v0.8.2` 快照；`plugin-data/hooks/steward` 已生成；禁用表只含 fangzhi-crm（steward 默认启用） | ZCode 侧同源改名；两宿主包内路径现已全部 ASCII |
| 23 | 斜杠命令注册修复（ZCode-only） | 已实现 | `zcode/commands/steward.fix.md` / `steward.plan.md` / `steward.take-over.md` → `zcode/commands/steward/{fix,plan,take-over}.md`，并新增 `maintain.md`；命令名由相对 `commands/` 的路径推导，子目录用 `:` 连接 → `/steward:fix` / `/steward:plan` / `/steward:take-over` / `/steward:maintain`（此前 `.md` 文件名里的点号不合法，后缀入口实际未注册）；`zcode commands list` 实列 5 条 | MiniMax 无斜杠命令能力，本项不适用；`minimax/` 命令结构未改 |

### P3 已知偏差

- MiniMax 侧已完成对齐（文档流水线 + 澄清内核 + 技能路由），两宿主版本号统一为 0.8.2。
- v0.8.2 的斜杠命令注册修复为 ZCode-only，MiniMax 侧无对应能力。
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
