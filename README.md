# Steward · 长期维护型研发团队

> 不只是把需求写完，而是让项目在每次变更后仍然可理解、可验证、可回滚、可继续演进。
>
> More than shipping features: keep the project understandable, verifiable, reversible, and evolvable after every change.

[中文](#中文) | [English](#english)

---

## 中文

### Steward 是什么

Steward 是面向 ZCode / MiniMax / DeepSeek Harness（DSH）的多角色研发团队插件。主对话代理担任 **Tech Lead**，把需求拆成任务 DAG，按「依赖 + 文件所有权」调度子智能体。当前版本（ZCode 0.11.0 / MiniMax 0.11.0 / DSH 0.2.0）覆盖功能交付（含 subagent / inline 两种执行模式）、Bug 修复（B0–B3 分流）、只出计划、维护循环、接手存量与演进循环；v0.8 起双宿主共享 docTier=3 完整文档流水线（七阶段文档树 + PRD/FRD/契约/页面/测试/部署全量模板 + 命名守卫与文档检查）与 M/L 需求的第一性原理澄清/提问预算，v0.8.1 起双宿主共享 `steward:using-steward` 技能路由，技能/agent 正文单一源生成，MiniMax 另附带维护健康看板等可选 GenUI 视图；DSH 侧（0.2.0 起）完全用 DSH 原生机制实现：7 个角色 = Agent Presets（persona + 原生工具组合）、模型路由 = 原生 Settings 命名空间 `steward`、派发 = `steward_dispatch` over `ctx.subagents`、人类入口 = `/steward` 原生命令、技能 = `ctx.skills`。

### 工作模式

| 模式 | 命令 | 状态 |
|---|---|---|
| 功能交付 | `/steward <需求>` | 0.6.0 可用 |
| 直接执行（inline） | `/steward:inline <需求>` | 0.10.0 可用（仅 S / B3 / 维护小修；M 需显式要求；L 与 B0/B1/B2 禁止） |
| 需求澄清 | 随 `/steward`（M/L/二义） | 0.8.0 起双宿主可用（第一性原理四问 + 最多 3 个 P0；S 级不追问） |
| Bug 修复 | `/steward:fix <Bug>` | 0.5.0 可用（ZCode 命令；MiniMax 用自然语言触发） |
| 只出计划 | `/steward:plan <需求>` | 0.5.0 可用（ZCode 命令；MiniMax 用自然语言触发） |
| 维护循环 | `/steward:maintain` | 0.6.0 可用（`maintain.mjs` 扫描 + backlog；MiniMax 用自然语言触发） |
| 接手存量 | `/steward:take-over` | 0.7.0 可用（扫描生成 T1 + 首轮健康扫描；MiniMax 用自然语言触发） |
| 文档流水线 | `docTier: 3`（随 `/steward`） | 0.8.0 起双宿主可用（七阶段树 + 全量模板 + 文档检查；MiniMax 1.6.0 同步） |
| 技能路由 | 加载 `steward:using-steward` | 0.8.1 起双宿主可用（不知道用哪个入口/技能时先做路由） |
| 子代理模型配置 | 加载 `steward:agent-settings` | 0.9.0 起 MiniMax 可用（可视化配置页 / CLI；ZCode 沿用宿主默认模型）；DSH 0.2.0 起为原生 Settings「设置 → Steward」页 + `steward_config` 工具 |
| DSH 原生机制 | 随插件注册 | 0.2.0 起：7 个角色 = Agent Presets（`steward-<role>`）、模型路由 = 原生 Settings 命名空间 `steward`、`steward_dispatch` over `ctx.subagents`、`/steward` 原生命令、技能走 `ctx.skills` |
| 宿主守卫 hooks | 随插件生效（PreToolUse） | 0.11.0 起双宿主可用（三道守卫：密钥 / 所有权 / 危险命令） |

功能交付：受理定级（S/M/L）→ 方案 → 批准门 → 实施 → QA → 浏览器验收 → 终审 → 收尾。Bug 修复按严重度分流：B2/B3 走「复现 → 失败测试 → 根因 → 最小修复 → 回归 → 记录」，B0/B1 增加止损与 postmortem 复盘。只出计划：方案 → 计划校验 → Plan Critic → 用户批准后停止，不实施。维护循环：八类扫描（依赖/安全/重复/churn/文档漂移/循环依赖/flaky/TODO/重构比例）→ 评分排序 backlog → 小修 → 更新 HEALTH。接手：扫描生成 T1 项目记忆 + 首轮健康扫描，先盘点后动手。演进与 T3/文档流水线见 [docs/ROADMAP.md](docs/ROADMAP.md)。

### 团队名册（7 角色 + 外援）

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

### 核心机制

- **任务 DAG + 文件所有权**：并行条件 = 无依赖 且 文件所有权不相交。
- **S/M/L 分档**：小需求不走全员大会；M/L 过计划批准门（干净上下文 Plan Critic + 用户批准）。
- **执行模式（v0.10.0）**：`execution.mode` 可选 `subagent`（默认，派子代理）或 `inline`（主代理自己按 DAG 执行）；inline 仍保留计划、baseline、TDD、verify 与报告，只换执行者，不降门禁。S / B3 / 维护小修可直接使用，M 需显式开启，L 与 B0/B1/B2 禁止。
- **宿主守卫 hooks（v0.11）**：MiniMax 侧补齐 ZCode 已有的三道 PreToolUse 守卫（`secret` 密钥扫描 / `ownership` 文件所有权 / `dangerous` 危险命令），已在 `hooks/hooks.json` 注册并随插件生效，fail-open。
- **可信变更门禁（v0.5）**：`validate-plan.mjs` 机检计划（路径存在 / DAG 无环 / 所有权不相交 / AC 覆盖 / 测试改动须声明理由）；`verify.mjs` 独立复跑测试/lint/typecheck（支持 `--repeat` 查 flaky）；`baseline record/check` 记回滚锚点并拦截越界 diff；`run-state.mjs` 断点恢复 + 同一错误连续 2 次即停 + 失败重试预算。全部为本地 Node 脚本，不做 CI。
- **Bug 通道（v0.5）**：B0–B3 分级；可复现 Bug 无失败测试不修；反作弊（测试 diff 须声明理由、弱化断言判 blocking）。
- **维护循环（v0.6）**：`maintain.mjs` 八类扫描（依赖/安全/重复/churn/文档漂移/循环依赖/flaky/TODO）→ 评分排序 backlog → 小修闭环 → 更新 HEALTH.md。
- **浏览器证据契约（v0.6）**：`browser-evidence.json`——每步判定引用 ARIA/DOM/console/network/URL 可读状态；优先 Playwright / Chrome DevTools MCP，退内置浏览器；布局/颜色类问题标「视觉未验证」，截图只作附件。
- **学习循环（v0.6）**：05-record 回填——评审发现/事故教训/用户纠正沉淀到 CONSTITUTION / ADR / RUNBOOK / HEALTH。
- **轻量技能（v0.6）**：`systematic-debugging`、`tdd`、`verification-before-completion`，按需加载不默认注入。
- **技能路由（v0.8.1，ZCode 侧）**：不知道用哪个入口/技能时加载 `steward:using-steward`；它只做路由，不替代主技能。
- **子代理模型与思考强度可视化配置（v0.9.0，MiniMax 侧）**：7 个子代理的模型与档位可视化改——应用内的 Mini App 配置页，或 `agent-config.mjs serve` 起的本地页；档位下拉只列该模型真实支持的集合（实时读本机模型目录，不硬编码）；写盘走「校验 → 备份 → 写 → 复校 → 失败回滚」。项目级 `steward.config.json` 下次派单即生效；插件默认改完 build + 安装后**新会话**生效。顺带修掉「frontmatter 只写 model 不写 effort → 直接调用子代理时档位落到 low」的偏差。
- **DSH 侧原生机制对齐（DSH 0.2.0）**：不再把 ZCode 的角色/配置机制移植过来，而是用 DSH 自己的扩展点实现同样功能——① 7 个角色是 **Agent Presets**（`steward-pm` … `steward-reviewer`），每个 preset 由 `dsh-persona` + 原生工具插件（fs / fs-search / pwsh|bash / web / skill / todo / compaction …）组合而成，子代理的系统提示与工具集来自 preset，`steward_dispatch` 只传任务正文；② 模型与思考强度是本插件的 **Config**（字段 `.volatile()`），由原生 Settings 服务作为命名空间 `steward` 提供、经 profile 配置编辑器持久化，保存后**原地生效**（不需要重启）；③ 设置页走 `ctx.configForms` + `remote.session.modelCatalog()`，不再自建 HTTP 桥，也没有 `~/.dsh/steward/subagent-config.json` 这类私有配置文件；④ `/steward` 注册在原生人类命令注册表；⑤ 技能仍走 `ctx.skills`。项目根 `steward.config.json` 的 `modelRouting` 仍优先于设置页（与 ZCode/MiniMax 口径一致），派发前用 `llm.resolveModelInfo` 预检。DSH 侧独立构建器 `node host/dsh/build.mjs` 只读 `shared/` 与 `zcode/scripts/`、只写 `dsh/`，并在生成 `roles/*.md` 时把宿主 MCP / `context7` 之类的 ZCode/MiniMax 事实替换成 DSH 原生检索口径。
- **项目记忆（v0.5）**：`take-over.mjs` 可为目标项目生成 AGENTS.md + `docs/project/` 七件套初稿（T0/T1）。
- **工件交接**：`tmp/steward/<run-id>/`，不在 prompt 里转述长文。
- **三道质量门**：QA → 浏览器验收（有 UI）→ 评审；缺陷按归属回派，最多 2 轮。
- **真实输出**：不美化、不编造；失败就是失败。

### 目录结构

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
└── README.md
```

> 维护者注意：ZCode / MiniMax 的技能与 agent 正文改 `shared/`（共享部分）或 `host/<宿主>/`，跑 `node zcode/scripts/build.mjs`；DSH 侧正文同样来自 `shared/` + `host/dsh/`，但由**独立构建器** `node host/dsh/build.mjs` 生成，只读 `shared/`、只写 `dsh/`。两个构建器互不写对方的包；`--check` 都会拦住手改与漂移。插件安装目录不需要也不应运行构建器。
>
> **宿主侧隔离**：ZCode 侧只改 `zcode/` + `host/zcode/`，MiniMax 侧只改 `minimax/` + `host/minimax/`，DSH 侧只改 `dsh/` + `host/dsh/`；`shared/` 是 ZCode/MiniMax 共享源、DSH 只读消费，`zcode/scripts/` 同理。安装/更新也各走各的：ZCode 用 `zcode plugins update`，MiniMax 用 `agent-config.mjs install --apply`，DSH 用插件管理器的 `install_bundle`（目标目录 `dsh/`）。详见根目录 `AGENTS.md`。

### 安装

#### ZCode

1. 克隆仓库到任意目录（例如 `steward/`）。
2. 在仓库同级建 `marketplace.json`，`source` 指向你克隆后的 `zcode/` 目录：

```json
{
  "name": "my-local-plugins",
  "plugins": [
    {
      "name": "steward",
      "source": "./steward/zcode",
      "version": "0.11.0",
      "displayName": "Steward · 长期维护型研发团队",
      "category": "developer-tools"
    }
  ]
}
```

3. ZCode → 插件市场 → 添加插件市场，粘贴 `marketplace.json` 所在目录。
4. 安装 **Steward**。
5. 新任务输入 `/steward <需求>`。

#### MiniMax

把 `minimax/` 复制到 `%USERPROFILE%\.minimax\plugins\steward\`：

```powershell
Copy-Item -Path "<repo>\minimax\*" -Destination "$env:USERPROFILE\.minimax\plugins\steward\" -Recurse -Force
```

> 更新前先跑 `node "<repo>\zcode\scripts\build.mjs"` 重建 `minimax/`（它是生成物）；用 `-Path` 而非 `-LiteralPath`（后者不展开 `*`，会静默复制 0 个文件）。拷贝不删旧文件，需要镜像用 `robocopy "<repo>\minimax" "$env:USERPROFILE\.minimax\plugins\steward" /MIR`。改动**从下一个新会话起生效**（本地插件在会话启动时载入，不热加载）。

输入包含「开发团队 / 开发小组 / Steward」时，`UserPromptSubmit` Hook 自动加载技能；也可以直接描述需求。

#### DSH（DeepSeek Harness）

`dsh/` 是标准 DSH 插件包（Host + Client + 技能/角色 + 门禁脚本）。更新前先跑 `node host/dsh/build.mjs` 重建 `dsh/`（只写 `dsh/`，不碰 ZCode/MiniMax），然后在 DSH 里用插件管理器安装本地 bundle 目录：

```text
plugin_manager(action="install_bundle", target="<repo>/dsh")
```

装好后：

- 技能目录里出现 `steward` / `using-steward` / `agent-settings` / `systematic-debugging` / `tdd` / `verification-before-completion`（`ctx.skills` 注册）；
- Agent Preset 名册里出现 7 个角色预设 `steward-pm` … `steward-reviewer`（`ctx.agentPresets` 注册），每个都是 persona + 原生工具组合；
- 多出两个工具：`steward_config`（看/改角色模型与档位）与 `steward_dispatch`（把任务派给某个角色预设）；
- 多出 `/steward` 人类命令（列名册、预设 id 与当前生效路由）；
- 「设置 → Steward」出现一页原生设置（`settings.section`），读写命名空间 `steward`。

升级时重新 `install_bundle` 指向同一目录；Host 代码在 DSH 重启后加载（本次开发用插件管理器的禁用/启用即可热重载；Client 设置页随页面刷新）。配置**不再写私有 JSON**：保存走 DSH 原生 settings/configEditor，落在 profile 的 `cordis.patch.yml` 里 `- id: steward` 的 `config` 覆盖行；宿主拥有该文件与其余行，插件不手改它。

> DSH 0.2.0 的边界：技能、角色（Agent Presets）、模型路由（原生 Settings）、派发、`/steward` 命令与门禁脚本已对齐；ZCode/MiniMax 的 `PreToolUse` 守卫 hooks 尚未移植（DSH 的工具守卫是宿主内另一套机制，后续按需补）。浏览器验收角色改用「仓库自带 Playwright → DSH 侧栏人工驱动 → 人工兜底」三级方式，不再引用 ZCode 侧的 Tabbit 技能。

#### 配置子代理的模型与思考强度（v0.9.0 / DSH 0.2.0）

装好后新开会话，直接说「配置子代理模型」「把 QA 换个模型并调高思考强度」即可：主代理加载 `agent-settings`，读宿主实时模型目录并展示 7 个角色当前的模型 / 档位与生效来源。

- **可视化配置页**：MiniMax 应用面板里打开 Steward 的子代理模型配置页（Mini App）；宿主未接纳时用功能等价的本地页——在源码仓库执行 `node zcode/scripts/agent-config.mjs serve`，浏览器打开 `http://127.0.0.1:7317`（端口占用会自动换并打印实际地址）。**DSH** 用「设置 → Steward」页：逐角色选提供方 / 模型 / 思考强度，「刷新模型目录」重新读取 `remote.session.modelCatalog()`，保存经原生 settings 直接生效（下一次派单即用）。
- **命令行直改（MiniMax）**：`node zcode/scripts/agent-config.mjs set --role qa-engineer --model custom_provider:provider-f9b585/glm-5.3-flash --effort medium --scope both`（`--scope` 取 project / plugin / both）。
- **只看不改（MiniMax）**：`node zcode/scripts/agent-config.mjs show`。
- **DSH 工具直改**：`steward_config(action="set", role="qa-engineer", provider="ctaigw", model="glm-5.3", effort="high")`；省略 `role` 改默认配置，`action="reset"` 清空。写入同样走原生 settings（profile 的 `cordis.patch.yml`），不落私有文件。
- 改 MiniMax 插件默认后要在源码仓库跑 `node zcode/scripts/agent-config.mjs install --apply`（build + 镜像安装到本机插件目录），改动**新会话**才生效。

### 使用

```text
/steward 给 tmp/demo 写一个金额汇总脚本，带单测并跑绿
```

### 路线图

- [docs/ROADMAP.md](docs/ROADMAP.md) · 交付状态：[docs/ROADMAP-STATUS.md](docs/ROADMAP-STATUS.md)
- 已实现（v0.5）：Bug 通道（B0–B3）、计划批准门 + Plan Critic、计划校验 / 独立验证 / 基线守卫、run.json 断点恢复、T0/T1 项目记忆生成。
- 已实现（v0.6）：维护循环（maintain.mjs 八类扫描）、浏览器证据契约、学习循环（05-record 回填）、systematic-debugging / TDD / verification 三个轻量技能、可选 worktree + finishing、模型路由 + 重试预算。
- 已实现（v0.7）：接手存量（take-over 扫描 + 首轮健康扫描）、演进循环（重构比例 / codemod 计划）、T3 模板六件按需升级、双宿主本地构建（build.mjs 单一正文源 + 校验）、可选宿主守卫 hooks（所有权/危险命令/密钥）、GenUI 维护健康看板（专用配方 C）、monorepo/多服务口径。
- 已实现（v0.8）：文档流水线完整吸收——七阶段 `docs/01..07` 树、19 类模板 + T2 需求/证据/记录模板、AGENTS/rules 约束层、命名守卫与文档检查本地脚本（`scripts/doc/`）；需求澄清内核（第一性原理四问 + 最多 3 个 P0 提问预算，S 级不追问）；worktree 多分支合并演练 6/6 PASS；taskboard 两处 non-blocking 清理（过滤竞态 + Cache-Control）22/22。文档流水线与澄清内核自 MiniMax 1.6.0 起由 build.mjs 同步到双宿主。
- 已实现（v0.8.1）：`steward:using-steward` 技能路由——不知道用哪个入口/技能时，先路由到功能交付 / Bug / 只出计划 / 维护 / 接手 / 文档流水线，并提示何时加载 debugging / TDD / 完成前验证；MiniMax 侧自 1.6.2 起同步（路由表按宿主适配：ZCode 斜杠命令 / MiniMax 自然语言）。
- 已实现（DSH 0.2.0）：DSH 侧改用宿主原生机制重写——7 个角色注册为 Agent Presets（`ctx.agentPresets`，persona + 原生工具组合）、模型路由走原生 Config/Settings（命名空间 `steward`，volatile 原地生效，经 profile 的 configEditor 持久化）、设置页走 `ctx.configForms` + `remote.session.modelCatalog()`（删掉自建 HTTP 桥与私有配置 JSON）、`steward_dispatch` over `ctx.subagents`（传 `agentPreset`，不再把角色提示词拼进 prompt）、`/steward` 注册到原生 commands、技能走 `ctx.skills`；独立构建器 `node host/dsh/build.mjs`（只读 `shared/`、只写 `dsh/`，并把角色正文里的 ZCode/MiniMax MCP 口径替换为 DSH 原生检索），`node --test host/dsh/tests/` 8 例覆盖预设注册 / Config / 原生设置持久化 / 预设派发 / 项目级路由 / 命令。
- 重点（后续）：MiniMax 宿主 GenUI 实机验收；DSH 设置页在真实浏览器里的渲染与交互验收（本次已用 Client Slots 检查确认页面 occupant active，但未做视觉截图）。

### 从 dev-team 更名

Steward 是原 `dev-team` 插件的更名版本。插件 ID、命令、agent 前缀、技能命名空间均已更新为 `steward`；旧版本可卸载后安装新版本。

---

## English

### What is Steward

Steward is a role-based engineering team plugin for ZCode, MiniMax and DeepSeek Harness (DSH). The lead agent acts as **Tech Lead**, decomposes work into a task DAG with file ownership, and dispatches specialist subagents. The current release (ZCode 0.11.0 / MiniMax 0.11.0 / DSH 0.2.0) covers feature delivery with two execution modes (subagent / inline), bug fixing (B0-B3 triage), plan-only mode, the maintenance loop, takeover (T1 generation + first health scan), and the evolution loop; both legacy hosts share the full docTier=3 documentation pipeline (seven-phase docs tree + full PRD/FRD/contract/page/test/deployment templates + naming guard and doc checks) plus a first-principles clarification step with a 3-question P0 budget for M/L requests, plus a using-steward router skill on both hosts, with optional MiniMax GenUI views for the task DAG, defect triage, and maintenance health. Since DSH 0.2.0 the DSH side is implemented entirely with DSH-native mechanisms: seven role **Agent Presets** (persona + native tool compositions), model routes in the native Settings namespace `steward`, `steward_dispatch` over `ctx.subagents`, a native `/steward` command, and skills through `ctx.skills`.

### Modes

| Mode | Command | Status |
|---|---|---|
| Feature delivery | `/steward <request>` | Available in 0.6.0 |
| Inline execution | `/steward:inline <request>` | Available in 0.10.0 (S / B3 / maintenance small fixes only; M requires explicit opt-in; L and B0/B1/B2 are not allowed) |
| Clarification | with `/steward` (M/L/ambiguous) | Available in 0.8.0+ on both hosts (first-principles four questions + max 3 P0 questions; S-level skips) |
| Bug fix | `/steward:fix <bug>` | Available in 0.5.0 (ZCode command; on MiniMax trigger by natural language) |
| Plan only | `/steward:plan <request>` | Available in 0.5.0 (ZCode command; on MiniMax trigger by natural language) |
| Maintenance | `/steward:maintain` | Available in 0.6.0 (`maintain.mjs` scan + backlog; on MiniMax trigger by natural language) |
| Takeover | `/steward:take-over` | Available in 0.7.0+ (T1 generation + first health scan; on MiniMax trigger by natural language) |
| Documentation pipeline | `docTier: 3` (with `/steward`) | Available in 0.8.0+ on both hosts (seven-phase tree + full templates + doc checks; MiniMax synced in 1.6.0) |
| Skill routing | load `steward:using-steward` | Available in 0.8.1+ on both hosts (route to the right mode when unsure which entry point/skill to use) |
| Subagent model config | load `steward:agent-settings` | Available in 0.9.0 on MiniMax (visual config page / CLI; ZCode keeps the host default model); DSH 0.2.0 ships a native Settings → Steward page plus the `steward_config` tool |
| DSH native mechanisms | registered with the plugin | DSH 0.2.0+: 7 roles are Agent Presets (`steward-<role>`), model routes live in the native `steward` settings namespace, `steward_dispatch` delegates over `ctx.subagents`, `/steward` is a native command, skills register through `ctx.skills` |

Feature delivery: intake & sizing (S/M/L) → plan → approval gate → implementation → QA → browser acceptance → final review → finishing. Bug fixes are triaged by severity: B2/B3 follow "repro → failing test → root cause → minimal fix → regression → record"; B0/B1 add mitigation-first and a postmortem. Plan-only mode stops after the approval gate — no implementation. Maintenance: an eight-category scan (deps / security / duplication / churn / doc drift / cycles / flaky / TODO) → scored backlog → small fixes → HEALTH.md updates. Full design: [docs/ROADMAP.md](docs/ROADMAP.md).

### Roster (7 roles + Explore)

| Role | Dispatch name | Responsibility |
|---|---|---|
| Requirements analyst | `steward:pm` | Vague request → testable spec |
| Architect | `steward:architect` | Spec → technical plan + task DAG |
| Backend dev | `steward:backend-dev` | TDD implementation within file ownership |
| Frontend dev | `steward:frontend-dev` | UI implementation + acceptance script |
| QA engineer | `steward:qa-engineer` | Test / lint / typecheck gate |
| Browser tester | `steward:browser-tester` | Black-box browser acceptance |
| Reviewer | `steward:reviewer` | Final diff review, three severity levels |
| Explore (external) | built-in | Repository reconnaissance for L-sized work |

### Core mechanics

- **Task DAG + file ownership**: parallel only when there is no dependency and file sets are disjoint.
- **S/M/L sizing**: small changes do not trigger the full team; M/L go through the plan approval gate (clean-context Plan Critic + user approval).
- **Execution modes (v0.10.0)**: `execution.mode` is either `subagent` (default: dispatch specialist subagents) or `inline` (the lead executes the plan itself, one task at a time). Inline keeps the plan, baseline, TDD, verify, and report gates — only the executor changes. S / B3 / maintenance small fixes are inline-eligible; M requires an explicit opt-in; L and B0/B1/B2 are forbidden.
- **Trusted-change gates (v0.5)**: `validate-plan.mjs` machine-checks the plan (paths exist / DAG acyclic / ownership disjoint / AC coverage / test changes must declare a reason); `verify.mjs` independently reruns test/lint/typecheck (`--repeat` detects flaky); `baseline record/check` records a rollback anchor and blocks out-of-bounds diffs; `run-state.mjs` resumes interrupted runs, stops after the same error twice, and enforces a retry budget. Local Node scripts only — no CI.
- **Bug track (v0.5)**: B0–B3 severity; a reproducible bug is not fixed without a failing test; anti-cheating (undeclared test diffs and weakened assertions are blocking).
- **Maintenance loop (v0.6)**: `maintain.mjs` scans eight categories (deps / security / duplication / churn / doc drift / cycles / flaky / TODO) → scored backlog → small fixes with evidence → HEALTH.md updates.
- **Browser evidence contract (v0.6)**: `browser-evidence.json` — every verdict cites readable state (ARIA/DOM/console/network/URL); Playwright / Chrome DevTools MCP first, built-in browser as fallback; layout/color findings are marked "visually unverified"; screenshots are attachments only.
- **Learning loop (v0.6)**: 05-record backfill — review findings, incident lessons, and user corrections are persisted into CONSTITUTION / ADRs / RUNBOOK / HEALTH.
- **Lightweight skills (v0.6)**: `systematic-debugging`, `tdd`, `verification-before-completion` — loaded on demand, never injected by default.
- **Skill router (v0.8.1, ZCode side)**: load `steward:using-steward` when the user is unsure which entry point or skill to use; it only routes, never replaces the main skill.
- **Subagent model and thinking-effort configuration (v0.9.0, MiniMax side)**: change the model and effort of the 7 subagents from a visual page (an in-app Mini App, or the equivalent local page started by `agent-config.mjs serve`). The effort dropdown lists only the levels the selected model really supports (read live from the local model catalog, never hardcoded), and every write follows validate → back up → write → re-validate → roll back on failure. Project-level `steward.config.json` takes effect on the next dispatch; plugin defaults take effect in a **new session** after build + install. This also fixes the existing defect where agent frontmatter declared `model` but not `effort`, so a directly invoked subagent ran on the runtime default (observed: low) instead of the roster's high.
- **DSH native mechanisms (DSH 0.2.0)**: instead of porting the ZCode role/config mechanisms, the DSH side is rebuilt on DSH's own extension points. (1) The seven roles are **Agent Presets** (`steward-pm` … `steward-reviewer`), each composing `dsh-persona` with native tool plugins (fs / fs-search / pwsh|bash / web / skill / todo / compaction …); a dispatched child gets its system prompt and tool set from the preset, and `steward_dispatch` only carries the task text. (2) Model and reasoning-effort routes are this plugin's **Config** (`.volatile()` fields), served by the native Settings service as namespace `steward` and persisted through the profile's config editor; saving updates in place, with no restart. (3) The settings page renders over `ctx.configForms` + `remote.session.modelCatalog()` — no private HTTP bridge and no `~/.dsh/steward/subagent-config.json`. (4) `/steward` registers on the native human-command registry. (5) Skills still register through `ctx.skills`. Project-level `steward.config.json` `modelRouting` still outranks the settings page, and dispatch preflights the route with `llm.resolveModelInfo`. The DSH-only builder `node host/dsh/build.mjs` reads `shared/` and `zcode/scripts/`, writes only `dsh/`, and rewrites host-specific prose in the generated `roles/*.md` (host MCP / `context7`) into DSH-native retrieval guidance.
- **Project memory (v0.5)**: `take-over.mjs` drafts AGENTS.md + the seven `docs/project/` files (T0/T1) for a target project.
- **Artifact handoff**: `tmp/steward/<run-id>/`; no long prose in prompts.
- **Three quality gates**: QA → browser acceptance (when UI) → review; defects are routed back, at most two rounds.
- **Evidence over claims**: real output only; no polishing, no fabrication.

### Repository layout

```text
steward/
├── shared/                     # Single source: shared skill / agent bodies (with @@SLOT@@ markers)
├── host/{zcode,minimax,dsh}/   # Host fragments: frontmatter, dispatch mechanics, model table, browser ops
├── zcode/                      # ZCode plugin package (skills/agents generated by build.mjs)
├── minimax/                    # MiniMax plugin package (skills/agents generated by build.mjs)
├── dsh/                        # DSH plugin package (host/client plugin + skills/roles/scripts, generated)
├── docs/
│   ├── README.md
│   ├── ROADMAP.md              # 2026 roadmap
│   └── ROADMAP-STATUS.md       # Delivery status with evidence
└── README.md
```

> Maintainer note: ZCode / MiniMax bodies are edited in `shared/` (common) or `host/<host>/` (host deltas) and generated with `node zcode/scripts/build.mjs`; the DSH side also consumes `shared/` but is generated by its own builder, `node host/dsh/build.mjs`, which only reads `shared/` and only writes `dsh/`. Neither builder writes the other host's package; both `--check` modes catch hand edits and drift. Installed plugin copies do not need and should not run a builder.
>
> **Host isolation**: ZCode-side work touches only `zcode/` + `host/zcode/`; MiniMax-side work touches only `minimax/` + `host/minimax/`; DSH-side work touches only `dsh/` + `host/dsh/`. `shared/` is the ZCode/MiniMax shared source, consumed read-only by DSH; `zcode/scripts/` is likewise read-only for DSH. Install/update separately: `zcode plugins update` for ZCode, `agent-config.mjs install --apply` for MiniMax, `plugin_manager install_bundle` targeting `dsh/` for DSH. See `AGENTS.md`.

### Installation

#### ZCode

1. Clone the repository (for example into `steward/`).
2. Create `marketplace.json` next to the repository; point `source` at your cloned `zcode/` directory:

```json
{
  "name": "my-local-plugins",
  "plugins": [
    {
      "name": "steward",
      "source": "./steward/zcode",
      "version": "0.11.0",
      "displayName": "Steward — long-lived engineering team",
      "category": "developer-tools"
    }
  ]
}
```

3. ZCode → Plugin Marketplace → Add Marketplace, and paste the directory containing `marketplace.json`.
4. Install **Steward**.
5. Start a new task with `/steward <request>`.

#### MiniMax

Copy `minimax/` into `%USERPROFILE%\.minimax\plugins\steward\`:

```powershell
Copy-Item -LiteralPath "<repo>\minimax\*" -Destination "$env:USERPROFILE\.minimax\plugins\steward\" -Recurse -Force
```

When the input contains "开发团队", "开发小组", or "Steward", the `UserPromptSubmit` hook loads the skill automatically.

#### DSH (DeepSeek Harness)

`dsh/` is a standard DSH bundle (Host + Client + skills/roles + gate scripts). Rebuild it with `node host/dsh/build.mjs` (writes only `dsh/`), then install the local bundle directory from DSH:

```text
plugin_manager(action="install_bundle", target="<repo>/dsh")
```

After installation a session sees six skills (`steward`, `using-steward`, `agent-settings`, `systematic-debugging`, `tdd`, `verification-before-completion`) through `ctx.skills`, seven Agent Presets (`steward-pm` … `steward-reviewer`) through `ctx.agentPresets`, two tools (`steward_config`, `steward_dispatch`), a `/steward` command, and a native **Settings → Steward** section over the `steward` settings namespace. Model routes persist through the native settings service into your profile's `cordis.patch.yml` (`- id: steward` config override); the plugin never hand-edits that file. Host code loads on DSH restart or a plugin-manager disable/enable; the settings page follows a browser refresh.

> DSH 0.2.0 boundaries: skills, roles (Agent Presets), model routing (native Settings), dispatch, the `/steward` command and the gate scripts are aligned; the ZCode/MiniMax `PreToolUse` guard hooks are not ported yet (DSH tool guards are a different in-Host mechanism). The browser tester uses a three-step ladder — repository Playwright → DSH sidebar driven by a human → manual fallback — instead of the ZCode-only Tabbit skill.

#### Configure subagent models and thinking effort (v0.9.0 / DSH 0.2.0)

Start a new session and say "configure subagent models" or "switch QA to another model with a higher thinking effort": the main agent loads `agent-settings`, reads the live model catalog and shows each role's current model, effort and where it comes from.

- **Visual page (MiniMax)**: open the Steward subagent model configuration page in the MiniMax app panel (Mini App). If the host has not accepted the Mini App yet, use the equivalent local page: run `node zcode/scripts/agent-config.mjs serve` in the source repo and open `http://127.0.0.1:7317` (the port is printed if it had to change).
- **Visual page (DSH)**: Settings → Steward over `ctx.configForms`. Pick provider / model / reasoning effort per role; the effort dropdown lists exactly what `remote.session.modelCatalog()` reports for that model. "Refresh catalog" re-reads it; saving writes through the native settings service and applies to the next dispatch immediately.
- **CLI (MiniMax)**: `node zcode/scripts/agent-config.mjs set --role qa-engineer --model custom_provider:provider-f9b585/glm-5.3-flash --effort medium --scope both` (`--scope` is project / plugin / both).
- **Read only (MiniMax)**: `node zcode/scripts/agent-config.mjs show`.
- **DSH tool**: `steward_config(action="set", role="qa-engineer", provider="ctaigw", model="glm-5.3", effort="high")`; omit `role` to edit the defaults, use `action="reset"` to clear. Writes use the same native settings path (no private JSON file).
- After changing MiniMax plugin defaults run `node zcode/scripts/agent-config.mjs install --apply` in the source repo (build + mirror-install); changes apply in a **new session**.

### Usage

```text
/steward Write a money-summary script in tmp/demo, with unit tests and a green run.
```

### Roadmap

- [docs/ROADMAP.md](docs/ROADMAP.md) · Delivery status: [docs/ROADMAP-STATUS.md](docs/ROADMAP-STATUS.md)
- Shipped in v0.5: bug track (B0–B3), plan approval gate + Plan Critic, plan validation / independent verification / baseline guard, resumable run state, T0/T1 project memory generation.
- Shipped in v0.6: maintenance loop (eight-category scan), browser evidence contract, learning loop (05-record backfill), systematic-debugging / TDD / verification skills, optional worktree + finishing, model routing + retry budget.
- Shipped in v0.7: takeover (T1 generation + first health scan), evolution loop (refactor-ratio check, codemod planning), six on-demand T3 templates, local dual-host build (build.mjs single source + validation), optional host guards (ownership / dangerous commands / secrets), GenUI maintenance health dashboard (dedicated recipe C), monorepo / multi-service guidance.
- Shipped in v0.8: full documentation pipeline — seven-phase `docs/01..07` tree, 19 template types + T2 requirement/evidence/record templates, AGENTS/rules constraint layer, naming guard and doc checks as local scripts (`scripts/doc/`); first-principles clarification kernel (four questions + a max-3 P0 question budget, S-level skips); worktree multi-branch merge drill 6/6 PASS; taskboard two non-blocking leftovers cleaned up (filter race + Cache-Control), fixture 22/22. The docs pipeline and clarification kernel are synced to both hosts by build.mjs since MiniMax 1.6.0.
- Shipped in v0.8.1: `steward:using-steward` router — when unsure which entry point/skill to use, route to feature delivery / bug / plan-only / maintenance / takeover / docs, and point to debugging / TDD / verification before completion; the MiniMax side is synced since 1.6.2 (routing table adapts per host: ZCode slash commands / MiniMax natural language).
- Shipped in DSH 0.2.0: the DSH side is rebuilt on native mechanisms — seven Agent Presets (`ctx.agentPresets`, persona + native tool compositions), model routes as this plugin's Config served by the native Settings namespace `steward` (volatile fields, persisted through the profile config editor), a settings page over `ctx.configForms` + `remote.session.modelCatalog()` (the private HTTP bridge and `~/.dsh/steward/subagent-config.json` are gone), preset-based dispatch over `ctx.subagents`, a native `/steward` command, and skills through `ctx.skills`. The independent builder `node host/dsh/build.mjs` reads `shared/` and writes only `dsh/`, and rewrites ZCode/MiniMax-only MCP prose in generated role bodies into DSH-native retrieval guidance. `node --test host/dsh/tests/` covers eight cases: preset registration, Config, native settings persistence, preset dispatch, project routing, and the command.
- Next: MiniMax-host GenUI verification and DSH settings-page browser rendering/interaction verification (the Client Slots check confirmed the page occupant is active, but no visual capture was taken).

### Renamed from dev-team

Steward is the renamed version of the `dev-team` plugin. The plugin ID, command, agent prefix, and skill namespace are now `steward`; uninstall the old version before installing the new one.

### License

MIT
