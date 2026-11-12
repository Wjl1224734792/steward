# Steward · 长期维护型研发团队

> 不只是把需求写完，而是让项目在每次变更后仍然可理解、可验证、可回滚、可继续演进。

简体中文 | [English](README.en.md)

Steward 是面向 ZCode / MiniMax / DeepSeek Harness（DSH）的多角色研发团队插件。主对话代理担任 **Tech Lead**，把需求拆成任务 DAG，按「依赖 + 文件所有权」调度子智能体。

## Steward 是什么

当前版本（ZCode 1.0.0 / MiniMax 1.0.0 / DSH 1.0.0）覆盖功能交付（含 subagent / inline 两种执行模式）、Bug 修复（B0–B3 分流）、只出计划、维护循环、接手存量与演进循环；v0.8 起双宿主共享 docTier=3 完整文档流水线（七阶段文档树 + PRD/FRD/契约/页面/测试/部署全量模板 + 命名守卫与文档检查）与 M/L 需求的第一性原理澄清/提问预算，v0.8.1 起双宿主共享 `steward:using-steward` 技能路由，技能/agent 正文单一源生成，MiniMax 另附带维护健康看板等可选 GenUI 视图；DSH 侧（0.2.0 起）用 DSH 原生机制实现：0.3.0 起角色**不再注册为 Agent Preset**（可写专员模式会绕过门禁），0.4.0 收敛为 host-only，0.5.0 主技能按需拆出 `inline` / `docs` 并接入 **Agent Teams 共享任务板**，0.6.0 补上 **Steward 团队面板**（Web 整页：Agent 关系图 + 点成员进子会话 + 逐角色模型/档位配置；路由 = 项目 `steward.config.json` 优先，其次面板，最后继承主代理），0.9.0 新增 `docs-governance` 文档治理技能与 G1–G11 本地门禁，1.0.0 收口。

**ZCode 侧 1.0.0 与 MiniMax 侧 1.0.0 分别对齐 DSH 1.0.0 的规范流程优化**（两侧机制各自原生、语义对齐）：新增 `steward:docs-governance` 文档治理技能（活 / 记录 / 基线三类分治、体积预算与 hub-and-spoke 拆册、frontmatter 读契约、`history/` 版本快照与双向溯源）与宿主无关的 `steward:project-lifecycle` 项目全生命周期技能；ZCode 侧门禁在 `scripts/docs-gov/`、MiniMax 侧在 `scripts/`（各宿主自有脚本，不互相灌包）；MiniMax 侧另把主技能按需拆出 `inline` / `docs` 两个小技能（主技能只留指针），机制用 MiniMax Code 自己的（技能按需加载 + 子代理 frontmatter + hooks + Mini App）。DSH 侧功能零改动。

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
| 子代理模型配置 | 加载 `steward:agent-settings` | 0.9.0 起 MiniMax 可用（可视化配置页 / CLI；ZCode 沿用宿主默认模型）；DSH 0.2.0–0.3.0 曾是原生 Settings 页 + `steward_config`，**0.4.0 起改为项目根 `steward.config.json` 的 `modelRouting`**（设置页与工具已移除） |
| DSH 原生机制 | 随插件注册 | 0.2.0 起用原生扩展点；0.3.0 起角色**去模式化**；0.4.0 起 **host-only**（无设置页 / 无私有配置 / 无浏览器半）；0.5.0 起 `inline` / `docs` 按需技能 + **Agent Teams 共享任务板**（`steward_board` 建板，原生 Team 面板即看板） |
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
- **DSH 侧原生机制对齐（DSH 0.2.0 → 0.4.0）**：不把 ZCode 的角色/配置形状移植过来，而是用 DSH 自己的扩展点实现同样功能——① **角色不注册 Agent Preset**：DSH 里 preset 就是用户可选的会话模式，没有「内部 preset」；把 7 个角色做成 preset 等于把可写的专员模式摆进选择器，用户切过去改代码就绕开了计划门 / 基线守卫 / QA / 终审，所以 `steward_dispatch` 让子代理跑 DSH 内置的 `standard` 组合，把该角色的章程（`roles/*.md`）拼在派单正文前（章程在前、任务在后），角色不出现在模式选择器里；② **路由只有一个来源**：项目根 `steward.config.json` 的 `modelRouting.<role>`，跟代码一起进仓库、可评审可回滚，用随包的 `validate-config.mjs` 机检——因此不声明原生 Config、不提供设置页、不带 `steward_config` 工具；③ `/steward` 注册在原生人类命令注册表；④ 技能仍走 `ctx.skills`；⑤ 插件是 **host-only**：没有浏览器半、没有自建 HTTP 桥、没有私有配置文件。派发前用 `llm.resolveModelInfo` 预检模型与档位。DSH 侧独立构建器 `node host/dsh/build.mjs` 只读 `shared/` 与 `zcode/scripts/`、只写 `dsh/`，并在生成 `roles/*.md` 时把宿主 MCP / `context7` 之类的 ZCode/MiniMax 事实替换成 DSH 原生检索口径；包契约机检含反向断言——`index.js` 里出现 `agentPresets.register` / `export const Config` / `settings.update` / `steward_config` 任一项直接判失败，`dsh/client.js` 存在也判失败。
- **项目记忆（v0.5）**：`take-over.mjs` 可为目标项目生成 AGENTS.md + `docs/project/` 七件套初稿（T0/T1）。
- **工件交接**：`tmp/steward/<run-id>/`，不在 prompt 里转述长文。
- **三道质量门**：QA → 浏览器验收（有 UI）→ 评审；缺陷按归属回派，最多 2 轮。
- **真实输出**：不美化、不编造；失败就是失败。

## 目录结构

```text
steward/
├── shared/                     # 唯一正文源：技能 / agent 共享正文（含 @@SLOT@@ 宿主槽位）
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

> 维护者注意：ZCode / MiniMax 的技能与 agent 正文改 `shared/`（共享部分）或 `host/<宿主>/`，跑 `node zcode/scripts/build.mjs`；DSH 侧正文同样来自 `shared/` + `host/dsh/`，但由**独立构建器** `node host/dsh/build.mjs` 生成，只读 `shared/`、只写 `dsh/`。两个构建器互不写对方的包；`--check` 都会拦住手改与漂移。插件安装目录不需要也不应运行构建器。
>
> **宿主侧隔离**：ZCode 侧只改 `zcode/` + `host/zcode/`，MiniMax 侧只改 `minimax/` + `host/minimax/`，DSH 侧只改 `dsh/` + `host/dsh/`；`shared/` 是 ZCode/MiniMax 共享源、DSH 只读消费，`zcode/scripts/` 同理。安装/更新也各走各的：ZCode 用 `zcode plugins update`，MiniMax 用 `agent-config.mjs install --apply`，DSH 用插件管理器的 `install_bundle`（目标目录 `dsh/`）。详见根目录 `AGENTS.md`。

## 安装

### ZCode

1. 克隆仓库到任意目录（例如 `steward/`）。
2. 在仓库同级建 `marketplace.json`，`source` 指向你克隆后的 `zcode/` 目录：

```json
{
  "name": "my-local-plugins",
  "plugins": [
    {
      "name": "steward",
      "source": "./steward/zcode",
      "version": "1.0.0",
      "displayName": "Steward · 长期维护型研发团队",
      "category": "developer-tools"
    }
  ]
}
```

3. ZCode → 插件市场 → 添加插件市场，粘贴 `marketplace.json` 所在目录。
4. 安装 **Steward**。
5. 新任务输入 `/steward <需求>`。

### MiniMax

把 `minimax/` 复制到 `%USERPROFILE%\.minimax\plugins\steward\`：

```powershell
Copy-Item -Path "<repo>\minimax\*" -Destination "$env:USERPROFILE\.minimax\plugins\steward\" -Recurse -Force
```

> 更新前先跑 `node "<repo>\zcode\scripts\build.mjs"` 重建 `minimax/`（它是生成物）；用 `-Path` 而非 `-LiteralPath`（后者不展开 `*`，会静默复制 0 个文件）。拷贝不删旧文件，需要镜像用 `robocopy "<repo>\minimax" "$env:USERPROFILE\.minimax\plugins\steward" /MIR`。改动**从下一个新会话起生效**（本地插件在会话启动时载入，不热加载）。

> 1.0.0 的 MiniMax 包共 **11 个技能**：`steward` / `using-steward` / `agent-settings` / `steward-visualizer` / `systematic-debugging` / `tdd` / `verification-before-completion` / `inline`（直接执行模式，按需加载） / `docs`（docTier=3 文档流水线，按需加载） / `docs-governance`（文档治理：拆分 / 归档 / 版本快照 + G1–G11 门禁） / `project-lifecycle`（项目全生命周期母本，references 与 assets 随包）。门禁脚本 `scripts/docs-gate.mjs` 与 `scripts/doc-snapshot.mjs` 随包提供，在目标仓库根用绝对路径调用。

输入包含「开发团队 / 开发小组 / Steward」时，`UserPromptSubmit` Hook 自动加载技能；也可以直接描述需求。

### DSH（DeepSeek Harness）

`dsh/` 是标准 DSH 插件包（Host + 技能/角色 + 门禁脚本；**没有 Client 半**）。更新前先跑 `node host/dsh/build.mjs` 重建 `dsh/`（只写 `dsh/`，不碰 ZCode/MiniMax），然后在 DSH 里用插件管理器安装本地 bundle 目录：

```text
plugin_manager(action="install_bundle", target="<repo>/dsh")
```

装好后：

- 技能目录里出现 `steward` / `using-steward` / `agent-settings` / `inline` / `docs` / `systematic-debugging` / `tdd` / `verification-before-completion`（`ctx.skills` 注册，后两个由主技能按需拆出）；
- **模式选择器里不会多出任何 Steward 模式**（插件不注册 Agent Preset）；角色是 `steward_dispatch` 在派单时注入的章程，7 个 `role` 取值即名册；
- 多出两个工具：`steward_dispatch`（把任务派给某个角色，子代理以内置 `standard` 组合启动）与 `steward_board`（`sync` 把 `03-plan.json` 建成 Agent Teams 板上的门禁 + 工作单，`status` 回读看板，`brief` 生成 teammate 任务书）；
- 多出 `/steward` 人类命令（列名册与路由口径）；
- 插件管理页点开 **Steward** 能看到本插件介绍与用法（`dsh/README.zh.md`，英文 `dsh/README.en.md`）。

升级时重新 `install_bundle` 指向同一目录；Host 代码在 DSH 重启后加载（开发时用插件管理器的禁用/启用即可热重载）。子代理模型路由不写任何私有配置、也不进 profile：它是**项目文件** `steward.config.json` 的 `modelRouting`，跟代码一起进仓库。

> DSH 0.5.0 的边界：技能（主技能 + 按需 `inline` / `docs`）、角色（派单注入章程，**不注册模式**）、模型路由（项目 `steward.config.json`）、派发、共享任务板（Agent Teams）、`/steward` 命令与门禁脚本已对齐；插件是 host-only（无设置页、无浏览器半、无私有配置）。工人跑在 `standard` 组合上，拥有全套原生工具（委派深度默认 1，会挡住「工人再派工」），单写者纪律靠派单正文约束而不是缺工具硬挡。ZCode/MiniMax 的 `PreToolUse` 守卫 hooks 尚未移植（DSH 的工具守卫是宿主内另一套机制，后续按需补）。浏览器验收角色改用「仓库自带 Playwright → DSH 侧栏人工驱动 → 人工兜底」三级方式，不再引用 ZCode 侧的 Tabbit 技能。

### 共享任务板 / 看板（DSH 0.5.0，需启用 Agent Teams）

在插件页启用「智能体团队」后，会话页头的 **Team 面板**就是 Steward 的看板：成员状态 + 共享任务板（状态点、负责人、依赖、就绪态、写入范围与重叠告警）。计划批准后一次 `steward_board(action="sync", plan="<工件>/03-plan.json", level="M")` 建板：

- `G1 · 计划批准` → 所有工作单的 blocker；`T<id> · <role> · <标题>`（写范围 = 文件所有权，重叠会告警）；`G2 · QA 门禁`（依赖全部工作单）→ `G3 · 终审`。
- 被依赖阻塞的任务 claim 不上——Steward 的 DAG 与门禁在原生层执行，删 `blocked_by` 抢跑属于绕过门禁。
- 派活：`steward_board(action="brief", role=..., task="T1")` → `spawn_teammate` → `team_task_update(action="reassign", owner=...)`；进度同步用 `steward_board(action="status")` 的文本快照（与面板一致）。

### 配置子代理的模型与思考强度（v0.9.0；DSH 0.4.0 起为项目配置）

装好后新开会话，直接说「配置子代理模型」「把 QA 换个模型并调高思考强度」即可：主代理加载 `agent-settings`，按项目根 `steward.config.json` 展示 7 个角色的模型 / 档位与来源。

- **可视化配置页**：MiniMax 应用面板里打开 Steward 的子代理模型配置页（Mini App）；宿主未接纳时用功能等价的本地页——在源码仓库执行 `node zcode/scripts/agent-config.mjs serve`，浏览器打开 `http://127.0.0.1:7317`（端口占用会自动换并打印实际地址）。
- **命令行直改（MiniMax）**：`node zcode/scripts/agent-config.mjs set --role qa-engineer --model custom_provider:provider-f9b585/glm-5.3-flash --effort medium --scope both`（`--scope` 取 project / plugin / both）。
- **只看不改（MiniMax）**：`node zcode/scripts/agent-config.mjs show`。
- **DSH（项目配置）**：在项目根 `steward.config.json` 写 `modelRouting.<role>`（`{ "model": "provider/model", "effort": "…" }`），跑 `node <包>/scripts/validate-config.mjs <项目根>/steward.config.json` 校验；删条目即回到继承主代理。DSH 侧没有设置页，也没有 `steward_config` 工具。
- 改 MiniMax 插件默认后要在源码仓库跑 `node zcode/scripts/agent-config.mjs install --apply`（build + 镜像安装到本机插件目录），改动**新会话**才生效。

## 使用

```text
/steward 给 tmp/demo 写一个金额汇总脚本，带单测并跑绿
```

> DSH 侧用自然语言说「用 Steward 做 <需求>」；原生 `/steward` 命令只回显名册与路由口径，不负责派活。

## 路线图

- [docs/ROADMAP.md](docs/ROADMAP.md) · 交付状态：[docs/ROADMAP-STATUS.md](docs/ROADMAP-STATUS.md)
- 已实现（v0.5）：Bug 通道（B0–B3）、计划批准门 + Plan Critic、计划校验 / 独立验证 / 基线守卫、run.json 断点恢复、T0/T1 项目记忆生成。
- 已实现（v0.6）：维护循环（maintain.mjs 八类扫描）、浏览器证据契约、学习循环（05-record 回填）、systematic-debugging / TDD / verification 三个轻量技能、可选 worktree + finishing、模型路由 + 重试预算。
- 已实现（v0.7）：接手存量（take-over 扫描 + 首轮健康扫描）、演进循环（重构比例 / codemod 计划）、T3 模板六件按需升级、双宿主本地构建（build.mjs 单一正文源 + 校验）、可选宿主守卫 hooks（所有权/危险命令/密钥）、GenUI 维护健康看板（专用配方 C）、monorepo/多服务口径。
- 已实现（v0.8）：文档流水线完整吸收——七阶段 `docs/01..07` 树、19 类模板 + T2 需求/证据/记录模板、AGENTS/rules 约束层、命名守卫与文档检查本地脚本（`scripts/doc/`）；需求澄清内核（第一性原理四问 + 最多 3 个 P0 提问预算，S 级不追问）；worktree 多分支合并演练 6/6 PASS；taskboard 两处 non-blocking 清理（过滤竞态 + Cache-Control）22/22。文档流水线与澄清内核自 MiniMax 1.6.0 起由 build.mjs 同步到双宿主。
- 已实现（v0.8.1）：`steward:using-steward` 技能路由——不知道用哪个入口/技能时，先路由到功能交付 / Bug / 只出计划 / 维护 / 接手 / 文档流水线，并提示何时加载 debugging / TDD / 完成前验证；MiniMax 侧自 1.6.2 起同步（路由表按宿主适配：ZCode 斜杠命令 / MiniMax 自然语言）。
- 已实现（DSH 0.2.0 → 0.5.0）：DSH 侧用宿主原生机制实现——`steward_dispatch` over `ctx.subagents`、`/steward` 注册到原生 commands、技能走 `ctx.skills`；独立构建器 `node host/dsh/build.mjs`（只读 `shared/`、只写 `dsh/`）。0.2.0 曾把 7 个角色注册为 Agent Preset，**0.3.0 已移除**（preset 就是用户可选的会话模式，可写专员模式会绕过门禁），改为派单注入章程；**0.4.0 再收一刀**：删 Config / `steward_config` / 整个浏览器半，路由只留项目 `steward.config.json`；**0.5.0**：主技能按需拆出 `inline` / `docs` 两个技能（正文仍来自 `shared/`，拆分只在 DSH 生成物里），并新增 `steward_board` 把 `03-plan.json` 建成 **Agent Teams 共享任务板**（G1 计划门 → 工作单 → G2 QA → G3 终审，依赖即 DAG，文件所有权即写入范围），Web Team 面板直接当看板。`node --test host/dsh/tests/` 14 例覆盖「工具/命令/技能注册 / 技能拆分 / 不注册预设 / 章程注入 / 项目级路由与降级 / 组合缺失拒绝 / 建板与幂等 / status / brief / 无团队时报错 / 产物无设置与客户端残留」。
- 已实现（v1.0.0，MiniMax 侧对齐 DSH 1.0.0）：主技能按需拆分（`inline` / `docs`）+ `docs-governance` 文档治理技能 + 随包门禁（`docs-gate.mjs` G1–G11、`doc-snapshot.mjs` 快照幂等）；共享构建器新增三个宿主钩子（宿主级技能拆分 / 宿主整技能覆盖 / 宿主脚本目录），ZCode 侧输出逐字节不变；两宿主版本同升 1.0.0。
- 重点（后续）：MiniMax 宿主 GenUI 实机验收；DSH 设置页在真实浏览器里的渲染与交互验收（本次已用 Client Slots 检查确认页面 occupant active，但未做视觉截图）。

## 从 dev-team 更名

Steward 是原 `dev-team` 插件的更名版本。插件 ID、命令、agent 前缀、技能命名空间均已更新为 `steward`；旧版本可卸载后安装新版本。

## License

MIT
