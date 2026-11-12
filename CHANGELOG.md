# Changelog

本仓库所有用户可见变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [Unreleased]

> 文档与打包修复：仓库 README 拆成中英两个单语版本，DSH 插件页补上插件介绍与用法。不新增功能，不改运行时逻辑；按要求未更新本机 DSH 插件（留给用户手动更新）。

### Changed

- **根 README 拆为两个版本**：`README.md` 只保留中文（默认入口），新增 `README.en.md` 只保留 English；两文件顶部互相链接，不再把中英写在同一文件。`docs/README.md` 的仓库根索引同步。
- **DSH 插件页补介绍**：此前 DSH 插件管理页点开 Steward 没有任何介绍（bundle 无 README，locale 也没有 `meta.detail`）。新增 `host/dsh/README.zh.md` / `host/dsh/README.en.md`（定位、安装后得到什么、快速开始、入口与模式、角色名册、模型路由优先级、边界），由构建器复制为 `dsh/README.zh.md` / `dsh/README.en.md`；`locale/en.json`、`locale/zh.json` 的 `meta.detail` 分别指向对应文件，DSH 插件管理器据此在插件页渲染长介绍。
- **插件卡片文案**：`locale` 的 `meta.title` / `meta.description` 从「Steward · 子代理模型」改为插件整体定位与用法摘要（7 个 Agent Presets、派发、计划批准门、Bug 通道、维护循环、门禁脚本、设置页），不再只描述设置页。
- **包清单与构建校验**：`host/dsh/package.json` 的 `files` 增加 `README*.md`；`host/dsh/build.mjs` 同步 README，并把「`meta.detail` 必须指向存在的包根 `README*.md`、非空、≤ 1 MiB」纳入包契约机检。
- **README 口径订正**：模式表中 Bug / 只出计划 / 维护 / 接手在 DSH 与 MiniMax 一样按自然语言触发；使用示例补充「DSH 用自然语言，`/steward` 只回显名册 / 预设 / 路由」；DSH 安装段补「插件管理页可见介绍」。

### 验证

- `node host/dsh/build.mjs` → exit 0；`node host/dsh/build.mjs --check` → exit 0（幂等，README 与 `meta.detail` 契约通过）。
- `node --test host/dsh/tests/` → **8 pass / 0 fail**（运行时逻辑未改）。
- `dsh/README.zh.md`、`dsh/README.en.md` 与 `host/dsh/` 源逐字节一致；`locale/{zh,en}.json` 的 `meta.detail` 目标文件均存在。
- 未执行 `plugin_manager install_bundle` / 插件更新：本机 DSH 由用户手动更新。

## [DSH 0.8.0] - 2026-11-12

> 面板从「排整齐的卡片」改成**以依赖图为核心的可视化驾驶舱**：任务板是「分叉再汇合」的 DAG，列表/树无法表达汇合，所以主视图改为分层依赖图，并补上文件 × 代理的归属矩阵。只改渲染层与样式，数据来源、会话跳转、`configForms` 保存逻辑与构建契约不变；只动 DSH 侧。

### Changed

- **依赖图成为主视图**（手写 SVG，无第三方依赖）：按最长路径分层、同层用两轮 barycenter 降交叉、正交折线 + 箭头、阻塞目标用虚线；悬停/选中高亮整条上下游路径，其余节点淡出；深板自适应收窄节点（下限 148px）避免横向溢出，超过容器才滚动；>40 个任务默认回落列表。
- **归属矩阵（文件 × 代理）**：真 `<table>`（可读屏），一行一个写入路径、一列一个代理；**重叠由任务数据自己算**（同一文件 ≥2 个不同 owner），不解析本地化告警字符串；重叠行置顶并标「重叠」，超过 30 行截断提示。
- **运行总览**：完成环（SVG `stroke-dasharray`）+ 每任务一段的分段进度（门禁位置带刻度）+ 成员/进行中/阻塞计数；替换 0.7.0 的摘要行。
- **视图形状**：视图切换（依赖图 / 归属矩阵 / 列表，`aria-pressed` 按钮组）、图例（四态，文字 + 点）、选中详情卡（状态 / 负责人 / 依赖可点跳转 / 写入范围 / 重叠告警 / 描述 / 打开负责人会话）、右栏（Lead + 成员头像行点击进子会话 + 需要你知道的告警）。
- **文本呈现**：节点标题去掉与负责人重复的角色前缀（`T1 · backend-dev · 实现导出` → `实现导出`），按 6px/单位估算宽度并在词边界换行，截断才加 `…`；依赖与写入范围用等宽小胶囊。
- **无障碍**：图 `role="group"` + 每个节点 `role="button" tabindex=0 aria-pressed` 且 `aria-label` 含任务、状态、负责人；方向键空间导航、Enter 选中、Esc 取消；焦点环用独立 `rect` 描边（不依赖 SVG outline）；列表是完整文本替代；状态不靠颜色（图例 + 节点虚线 + 详情/列表文字）；`prefers-reduced-motion` 关闭呼吸动效。
- **空态/降级**：环状依赖 → 告警（列出环上 id）并自动切列表；断链依赖 → 告警计数 + 详情卡标注；未启用团队 → 三步引导 + 复制建板指令。
- 版本：`dsh/package.json` 0.7.0 → **0.8.0**。

### 验证

- `node host/dsh/build.mjs` → exit 0；`node host/dsh/build.mjs --check` → exit 0；`node --check dsh/client.js` → exit 0。
- `node --test host/dsh/tests/` → **20 pass / 0 fail**（新增：三层视图切换——点真 `onClick` 后矩阵出现真 `<table>` 且重叠行只 1 行、列表 4 行；图的节点/边计数与分层左右顺序；节点 `aria-label` 含状态与负责人；环状依赖回落列表并给出告警；token 白名单新增 `--dsw-focus-ring-color`）。
- 几何复核：真实组件对 6 任务 5 层板输出 `960×144` 画布、5 列 x=10/203/396/589/782、标题单行不截断（`实现订单导出接口`），无横向溢出。
- **未做真实浏览器截图验收**：浏览器扩展未连接（`visual: unverified`）；刷新 GUI 后需人工确认浅/深色首屏与窄屏表现。

## [DSH 0.7.0] - 2026-11-12

> 面板 UI 重设计：把「一堆等权卡片」改成宿主页面尺度的运行驾驶舱（总览 → 团队 → 任务板 → 单人派发 → 模型表格）。**只改渲染层与样式**：数据来源、会话跳转、`configForms` 保存逻辑与构建契约不变；只动 DSH 侧。

### Changed

- **页面骨架对齐宿主**：标题 20px/500、节标题 14px/500、正文 13px、元信息 11px，`.5px` 发丝线、8/12px 圆角、960px 内容列、28px 顶距、32px 节间距——取自宿主自身页面（插件管理页、原生 Agent Teams 面板）。
- **团队总览 + 团队切换**：页头右侧显示成员数 / 完成比 / 阻塞数与进度条；多个 Agent Teams 会话改为 `role="tablist"` 切换条（方向键可切），一次只展开一个团队，不再整页重复看板。
- **Lead 不再居中悬浮**：原「320px 居中卡片 + 14px 短竖线 + 全宽网格」改为「Lead 整行（徽标 / 会话短 id / 模型 / 状态 / 打开会话）+ 成员卡网格（minmax 232px）」。
- **门禁阶段条 + 工作单行**：G1→G2→G3 改为阶段条（点 + id + 名称 + 状态文字）；工作单改为行列表（状态点 / 标题 / 负责人 · 依赖 · 写入范围 / 状态胶囊 / 跳转箭头），长串折叠为等宽小胶囊并以 `+N` 收尾，完整值进 `title`。
- **状态去 emoji**：移除 `⛔ ▶ ○ ✓` 字形，改为「状态点 + 文字」；阻塞用 `state-warn`（琥珀），红色只留给真正的失败。
- **团队标签修正**：原 `teamSessionId.slice(0, 8)` 会渲染出 `session-`；改为去掉 `session-` 前缀后取可读尾部（≤12 字符，不再切断单词）。
- **配置区表格化**：8 张竖卡 → 一张表（角色 / 提供方 / 模型 / 思考强度 / 来源），首行「默认（兜底）」高亮；工具栏（未保存 · 刷新目录 · 撤销 · 保存）吸底；`<760px` 降级为逐角色卡片并显示字段标签。
- **空态与加载态**：无任务板时给三步引导 + 复制建板指令；模型目录加载改为骨架行；错误/告警统一成带色带的 `Alert`。
- **侧栏图标**：`◆` 字符 → 内联 SVG（使用 slot 提供的 `size`、`currentColor`、16 viewBox）。
- **无障碍**：卡片与行是 `<button>`；团队切换走 tablist 语义并支持方向键；状态不只靠颜色；`:focus-visible` 2px 焦点环；动效尊重 `prefers-reduced-motion`。
- **Token 兜底 + 机检**：`--dsw-*` 引用统一为「Theme 目录内 token 直用、目录外 token 必带 fallback」；新增测试防 token 拼写漂移、字面色和样式越界。
- 版本：`dsh/package.json` 0.6.2 → **0.7.0**。

### 验证

- `node host/dsh/build.mjs` → exit 0；`node host/dsh/build.mjs --check` → exit 0；`node --check dsh/client.js` → exit 0。
- `node --test host/dsh/tests/` → **18 pass / 0 fail**（新增：样式 token/作用域/尺度契约、多团队 tab、门禁顺序与状态文字、无 emoji 状态、团队标签无 `session-` 残留、配置表格结构 + 工具栏状态、中文/英文双语渲染）。
- 结构复核：假 React 逐层展开渲染树，确认首屏顺序为「页头总览 → 团队切换 → Lead/成员 → 阶段条/工作单 → 单人派发 → 模型表格」，配置区为 8 行（默认 + 7 角色）× 3 个下拉，窄屏断点存在。
- **未做真实浏览器截图验收**：浏览器扩展未连接（`visual: unverified`）；刷新 GUI 后需人工确认浅/深色首屏与窄屏表现。

## [DSH 0.6.2] - 2026-11-12

> 修用户实测白屏：面板整页崩溃（`slot entry crashed in 'main'`）。

### Fixed

- **`TypeError: Cannot read properties of null (reading 'provider')`**：真实的 `modelSelection.next` 对没选过模型的成员是 **`null`**（不是 `undefined`），`MemberCard` 直接把 `null` 当对象读字段。改为 `memberModelLabel()`：投影缺失 / `next` 为空 / 字段非字符串一律降级为「继承主代理」，外层 `try/catch` 兜底。
- **整页白屏**：新增 `PanelBoundary`（错误边界）包住面板动态区与设置分区——任何一段渲染报错只在原地显示「这一段渲染失败（其余部分仍然可用）」，不再卸载整个 slot；成员数组里的空元素也跳过。
- **测试补真渲染**：客户端冒烟改成迷你渲染器（展开函数/类组件到宿主元素），并新增回归用例——成员 `modelSelection.next = null` 时必须渲染出「继承主代理」而不是抛错；同时覆盖单人子代理（`subagentCatalog`）与任务板行。
- 版本：`dsh/package.json` 0.6.1 → **0.6.2**。

### 验证

- `node host/dsh/build.mjs` / `--check` → exit 0；`node --test host/dsh/tests/` → **16 pass / 0 fail**；`node --check dsh/client.js` → exit 0。

## [DSH 0.6.1] - 2026-11-12

> 面板补两块：**单人模式的子代理也上图**（读原生 `subagentCatalog` 投影，点卡进会话），以及**没有任务板时的建板引导 + 一键复制指令**。

### Changed

- **子代理区**：遍历 `projectionsBySession[*].values.subagentCatalog`，把 `steward_dispatch` 派出的子代理列成卡片（运行中 / 空闲、来源会话、`mode`），点击走同一条 `openSession({ parentSessionId, childSessionId, mode: 'continuable' })`——不启用 Agent Teams 也能看到派过谁。
- **空态引导**：没有 Team 任务板时，页面顶部给出「让 Lead 用 `steward_board` 建板」的说明与「复制建板指令」按钮（`navigator.clipboard`，失败静默，文字仍可读）。
- 版本：`dsh/package.json` 0.6.0 → **0.6.1**。

### 验证

- `node host/dsh/build.mjs` → exit 0；`node --test host/dsh/tests/` → **16 pass / 0 fail**；`node --check dsh/client.js` → exit 0。
- 未做真实浏览器点击验收（扩展未连接）。

## [DSH 0.6.0] - 2026-11-12

> DSH 侧补上 **Steward 团队面板**：Web 整页（侧栏 ◆「Steward 团队」）展示 Agent 关系图与共享任务板、点成员卡直接进子会话，并把这些子代理的模型与思考强度做成可改的表单（原生 `configForms`，写 profile 的 `- id: steward`）。路由分两层：**项目根 `steward.config.json` 优先**，其次面板（该角色 → 默认），最后继承主代理。**只改 DSH 侧**：`zcode/`、`minimax/`、`shared/`、`zcode/scripts/` 无 diff。

### Changed

- **团队面板（client 半回归，纯原生）**：`client.js` 用 `ctx.slots` 注册 `main`（整页，key `steward`）+ `sidebar.panellist`（侧栏入口）+ `settings.section`（同一表单的设置分区）。
  - **Agent 关系图**：Lead 节点 + 成员卡（运行中 / 空闲 / 创建中 / 失败状态点、模型、当前任务），数据来自原生 `agentTeam` 投影；**点成员卡**用 `ctx.uiWorkspace.openSession({ parentSessionId, childSessionId, mode: 'continuable' })` 打开子会话（与原生 Team 面板同一套跳转）。
  - **共享任务板**：读同一投影，显示门禁 / 工作单状态、负责人、依赖、写入范围与文件重叠告警。
  - **模型与档位表单**：逐角色 provider / model / effort（目录来自 `remote.session.modelCatalog()`），保存走 `ctx.configForms` 的 `mutate`（原生设置，不写私有文件、无自建 HTTP 桥）。
- **路由分层**：`steward_dispatch` 先读项目根 `steward.config.json` 的 `modelRouting.<role>`，没有再读面板（该角色 → 默认）→ 最后继承主代理；结果回执标出来源（`from steward.config.json` / `from the Steward panel` / `inherited parent model`）。
- **host 半恢复原生 Config**：`export const Config`（7 角色 + defaults × provider/model/effort，volatile）与 schemastery 解析回填；`/steward` 的路由口径同步为两层优先级。
- **构建契约**：重新要求 `export const Config` / `settings.describe` / `client.js` / `configForms` / `settings.section`，并新增 `main`、`sidebar.panellist`、`uiWorkspace` 断言；`package.json` 恢复 `./client` 导出、`dsh.client`（inject `dsh-client-ui-settings`）与 schemastery peer。仍禁止 `agentPresets.register`、`steward_config`、`/api/dsh-steward`。
- **技能**：`agent-settings` 重写为「面板入口 + 路由优先级 + 看板口径」；主技能 banner 升到 0.6.0（①④条改为两层路由 + 面板入口）。
- 版本：`dsh/package.json` 0.5.0 → **0.6.0**。

### 验证

- `node host/dsh/build.mjs` → exit 0；`--check` → exit 0。
- `node --test host/dsh/tests/` → **16 pass / 0 fail**（新增：面板路由（角色 / 默认 / 项目优先）、客户端 bundle 冒烟——用假 `window.__ModuleLoader__` + 假 react 执行 `factory`/`apply`，断言注册 `main`(key `steward`) / `sidebar.panellist`(id `steward`) / `settings.section`，并渲染无团队数据时的页面文案）。
- `node --check dsh/index.js`、`node --check dsh/client.js` → exit 0。
- 热重载 `set_plugin(include:steward, false→true)` → `application: applied`。
- **未做**：真实浏览器里点开面板的截图/点击验收（浏览器扩展当前未连接）；要求用户刷新页面后自检。

## [DSH 0.5.0] - 2026-11-12

> DSH 侧两件事：① 主技能按需拆分（`inline` / `docs`）；② 接入 **Agent Teams 共享任务板**——Web 原生 Team 面板就是看板，不再自建 UI。**只改 DSH 侧**：`zcode/`、`minimax/`、`shared/`、`zcode/scripts/` 无 diff（拆分发生在生成物里，正文仍单一来源）。

### Changed

- **技能按需拆分**：`host/dsh/build.mjs` 按标题锚点把共享正文里的「执行模式（subagent / inline）」拆成 `inline` 技能、「T3 文档按需升级 + 文档流水线」拆成 `docs` 技能，主技能里只留一行指针；技能目录 6 → 8，构建契约同步；`using-steward` 路由表补两行与「加载信号」两行。
- **共享任务板（`steward_board`）**：新工具，三个动作，全部经 `ctx.agentTeams` 操作原生任务板：
  - `sync`：读 `03-plan.json` 幂等建板——`G1 · 计划批准` → 工作单 `T<id> · <role> · <标题>`（依赖 = G1 + `dependsOn`；`writeScopes` = `files` + `newFiles`；描述是固定块：目标 / 完成标准 / 所有权 / 报告落点 / 覆盖的 AC，加 `steward:plan=` 标记）→ `G2 · QA 门禁`（依赖全部工作单）→ `G3 · 终审`（依赖 G2）。M/L 建门禁，S 不建。
  - `status`：回读板面，输出与 Web Team 面板一致的文本快照（门禁进度、`n/m 完成`、可开始任务、每单状态/负责人/依赖、文件重叠告警）。
  - `brief`：生成可直接交给 `spawn_teammate` 的自包含任务书（角色章程 + 计划任务块 + 板上任务号 + 完成协议）。
  - 未启用 Agent Teams 时 `sync`/`status` 明确报错，回落到 `steward_dispatch` + `run.json` 单人模式。
- **技能正文**：主技能新增「共享任务板」一节（建板 / 派活 / 状态口径 / 回派 / 自检）并把 banner 升到 0.5.0；`using-steward` 增补任务板与按需技能路由。
- **构建契约**：新增 `agentTeams` 断言与「技能清单 8 项」；技能枚举改为「磁盘 ∪ 本轮渲染目标」，支持新拆出的技能目录。
- 版本：`dsh/package.json` 0.4.0 → **0.5.0**。

### 验证

- `node host/dsh/build.mjs` → exit 0；`node host/dsh/build.mjs --check` → exit 0。
- `node --test host/dsh/tests/` → **14 pass / 0 fail**（新增技能拆分、建板 / 幂等 / 分级、status、brief、无团队时报错）。
- `node --check dsh/index.js` → exit 0。
- 热重载后技能目录出现 `inline` / `docs`（会话技能列表已含两项）。
- **实建板**（真实 host，非 mock）：`steward_board(action="sync", plan=…/03-plan.json, level="M")` → 「已同步 6 个任务到共享任务板」，返回门禁 G1/G2/G3 + 三张工作单的状态表；工作单初始全部 `⛔ 被阻塞`（等 G1），T2/T3 依赖 T1，G2 依赖全部工作单。
- 浏览器扩展未连接，未截取 Team 面板截图；面板可见性由用户侧确认。

## [DSH 0.4.0] - 2026-11-12

> DSH 侧**第二轮减法：host-only**。删掉原生 Config、`steward_config` 工具和整个浏览器半（设置页），模型路由只留项目根 `steward.config.json` 的 `modelRouting`。理由与角色去模式化同源：配置也只能有一个来源——跟代码一起进仓库、进同一个 diff、可评审可回滚，并用随包的 `validate-config.mjs` 机检；per-machine 的模型设置会让「这个仓库里 QA 用哪个模型」变成查不到的历史。**只改 DSH 侧**：`zcode/`、`minimax/`、`shared/`、`zcode/scripts/` 无 diff。

### Changed

- **删除浏览器半**：`host/dsh/client.js`（原 526 行）与 `dsh/client.js` 移除；`package.json` 去掉 `./client` 导出、`files` 里的 `client.js`、整个 `dsh.client` 段，以及 `@deepseek-ai/schemastery` peer 依赖。「设置 → Steward」页不再存在。
- **删除 `steward_config` 工具**：`list/set/reset` 与整套模型目录读取（`buildCatalog` / `getCatalog` / `validateConfig`）一并删除；`/steward` 改为只回显名册 + 路由口径。
- **路由只来自项目**：`steward_dispatch` 按派单 `cwd` 上溯找项目根、读 `steward.config.json` 的 `modelRouting.<role>`；没有该角色的条目或格式错误（`model` 缺 `provider/` 前缀）一律降级为继承主代理；派发回执写明 `from steward.config.json`。
- **index.js 766 → 326 行**：去掉 Config schema、设置读写、模型目录与重复脚手架。
- **构建契约改为 host-only**：`host/dsh/build.mjs` 要求含 `commands.register` / `skills.register` / `agentPreset` / `startActivation` / `dispatchPrompt` / `steward.config.json`；出现 `agentPresets.register` / `export const Config` / `settings.update` / `steward_config` / `webServer`，或存在 `dsh/client.js`，任意一项直接判失败；同步清单不再复制 `client.js`。
- **技能正文**：主技能 banner 升到 0.4.0（①④条改为项目路由）、`agent-settings` 改写为「读/改项目 `modelRouting` + `validate-config.mjs`」、`roster` / `entry-points` / `model-routing-dispatch` / `model-default-line` / `using-steward` 同步；`build.mjs` 的 DSH 行替换同改。
- **README / locale**：中英 README 删掉设置页与 `steward_config`，新增「为什么把路由放在项目里」与路由示例；仓库根 README 同步；`locale/{zh,en}.json` 的 `meta.description` 改为 host-only 口径。
- 版本：`dsh/package.json` 0.3.0 → **0.4.0**。

### 验证

- `node host/dsh/build.mjs` → exit 0；`node host/dsh/build.mjs --check` → exit 0（README / locale / 技能清单与源一致）。
- `node --test host/dsh/tests/` → **8 pass / 0 fail**（只注册一个工具 / 每个角色章程都是派单载荷 / 无路由时继承 / 项目 `modelRouting` 生效 / 坏配置降级 / 组合缺失拒绝派发 / 命令口径 / 产物无设置与客户端残留）。
- `node --check dsh/index.js` → exit 0；`Test-Path dsh/client.js` → `False`。
- 热重载：`plugin_manager set_plugin(include:steward, false→true)` → `application: applied`。
- 实派（带项目路由）：临时项目写 `steward.config.json` 的 `modelRouting.reviewer = { "model": "ctaigw/glm-5.3-flash" }`，`steward_dispatch(role=reviewer, cwd=<临时项目>)` → `started steward subagent dec081f5-… (role reviewer, composition standard; ctaigw/glm-5.3-flash from steward.config.json)`。
- 已知现象：本会话的技能目录是会话级快照，`steward` 那条描述仍显示上一版文案（`agent-settings` 已刷新）；新会话 / 重启后即为新文案，包内文件与源逐字节一致（`--check` 通过）。

## [DSH 0.3.0] - 2026-11-12

> DSH 侧**角色去模式化**（用户拍板方案 A）：不再把 7 个角色注册成 Agent Preset。理由：DSH 里 preset 就是用户可选的会话模式，没有「内部 preset」；可写的专员模式一旦摆进选择器，用户切过去改代码就绕开了计划门 / 基线守卫 / QA / 终审，等于把 Steward 唯一的价值绕掉。**只改 DSH 侧**：`zcode/`、`minimax/`、`shared/`、`zcode/scripts/` 无 diff。

### Changed

- **角色 → 派单时注入的章程**：删除 `ctx.agentPresets.register` 与整套 preset 组合（persona + 11 行原生工具子集）。`steward_dispatch` 改为把 `roles/<role>.md` 正文（去 frontmatter 与生成 banner）拼在任务正文前，子代理固定以内置 `standard` 组合启动（`agentPreset: 'standard'`）。派单正文结构：章程 → `---` → `# 本次任务（派单正文）` → 任务（任务在最后，是模型最近读到的指令）。
- **组合可用性预检**：派发前解析 `standard`，未注册 / 激活失败时给出可读原因（不再只靠 provider 的隐晦错误）；spawn 后端仍需 `capabilities.agentPreset`，仍「不静默降级」。
- **工具输出字段**：`steward_config` / `steward_dispatch` 的 `preset` 改为 `childPreset`（固定 `standard`）；`/steward` 输出改为「名册 + 组合 `standard` + 生效路由」，并明示「本插件不注册 Agent Preset，7 个角色不会出现在模式选择器里」。
- **设置页文案**：副标题与「角色（Agent Presets）」分组改为「角色」，元信息显示「子代理组合：standard」，不再展示 `steward-*` 预设 id（`client.js` + 中英 `STRINGS`）。
- **技能正文**：主技能 banner 升到 DSH 侧 0.3.0（①条与版本行改为「章程随派单注入，子代理跑 `standard` 组合」）、名册片段补「角色不是模式」说明、`agent-settings` 边界同步。
- **包契约机检**：`host/dsh/build.mjs` 的「原生机制契约」删掉 `agentPresets` 必含项，新增反向断言——`index.js` 出现 `agentPresets.register` 直接判失败；并要求存在 `dispatchPrompt`、`startActivation`。技能清单改为优先读本轮内存渲染结果，修掉「改技能 `description` 后 `--check` 假失败」的单趟不一致。
- **版本与口径**：`dsh/package.json` 0.2.0 → **0.3.0**；`host/dsh/README.{zh,en}.md`、仓库根 README、`locale/{zh,en}.json` 的 `meta.description` 全部改为「角色是派单注入的章程，不注册 Agent Preset」，DSH README 新增「为什么不注册模式」一节说明取舍（工人跑 `standard` 组合、委派深度默认 1 挡住工人再派工）。

### 验证

- `node host/dsh/build.mjs` → exit 0；`node host/dsh/build.mjs --check` → exit 0（幂等）。
- `node --test host/dsh/tests/` → **9 pass / 0 fail**（不注册预设 / 章程是派单载荷 / 章程注入到 prompt 首部且任务在尾部 / 组合缺失或损坏时拒绝派发 / Config / 原生设置持久化 / 项目级路由 / 设置不可用回退 / `/steward` 不暴露预设 id）。
- `node --check dsh/index.js`、`node --check dsh/client.js` → exit 0。
- 热重载：`plugin_manager set_plugin(include:steward, false→true)` → `application: applied`；重载后技能目录里的 `steward` 描述已是新口径（「角色章程随派单注入」）。
- 实派：`steward_dispatch(role=reviewer)` → `started steward subagent 3b1f1340-… (role reviewer, composition standard; qoder/qmodel_latest @ xhigh)`；子会话 `session.v4.jsonl` 头部 `"agentPreset":"standard"`、`agent-preset/selected {"agentPreset":"standard"}`，首条 inbox 消息以「你是软件开发团队的代码评审员（终审门）」开头（章程在前），子代理回传 `CHARTER_SMOKE_OK` + 原样引用章程首句。
- 未触碰 `zcode/`、`minimax/`、`shared/`、`zcode/scripts/`（`git status` 仅 `host/dsh/`、`dsh/` 与根 README/CHANGELOG/ROADMAP-STATUS）。

## [DSH 0.2.0] - 2026-11-11

> DSH 侧按「功能对齐、机制原生」重写：不再把 ZCode/MiniMax 的角色与配置形状搬进 DSH，而是用 DSH 自己的扩展点实现同样能力。**只改 DSH 侧**：`zcode/`、`minimax/`、`shared/`、`zcode/scripts/` 无 diff。

### Changed

- **角色 → Agent Presets**：7 个角色注册为 `ctx.agentPresets` 预设（`steward-pm` … `steward-reviewer`，order 100+）；每个预设 = `@deepseek-ai/dsh-persona`（角色正文）+ 原生工具组合（agent-instructions / time-context / fs / fs-search / pwsh|bash / todo / web / skill / present / compaction 组）。子代理的系统提示与工具集由 preset 提供，角色提示词不再拼进派发 prompt。
- **模型路由 → 原生 Config/Settings**：新增 `export const Config`（`defaults` + 7 角色 × `provider/model/effort`，字段 `.volatile()`），由原生 Settings 服务提供命名空间 `steward`，经 profile 的 `configEditor` 持久化；保存原地生效，不需要重启。删除 `~/.dsh/steward/subagent-config.json` 与自建 `/api/dsh-steward/*` HTTP 桥。
- **设置页 → configForms**：Client 半改注入 `slots` / `locale` / `remote` / `remote.session` / `configForms`，注册 `settings.section`（id `steward`，order 50），通过 `ctx.configForms.get('steward')` 读写、`remote.session.modelCatalog()` 取实时模型与档位；保留来源徽标、刷新/撤销/保存与冲突提示。
- **派发 → 预设 + agentOptions**：`steward_dispatch` 调 `ctx.subagents.startActivation` 时传 `agentPreset: steward-<role>`，角色 persona 由 preset 注入；派发前校验 preset 可解析、spawn 后端 `capabilities.agentPreset` 为真、模型/档位可用。项目级 `steward.config.json` `modelRouting` 仍优先。
- **新增 `/steward` 命令**：注册到原生 `ctx.commands`，输出名册、预设 id、当前生效路由与设置命名空间。
- **`steward_config`**：`list/set/reset` 读写同一原生设置（不再写私有 JSON），输出增加 `namespace` / `documentPath` / 每角色 `preset`；写前仍用 `llm.resolveModelInfo` 校验未知模型与档位。
- **构建器**：`host/dsh/build.mjs` 生成角色正文时新增宿主转写（ZCode/MiniMax 的宿主 MCP / `context7` → DSH 原生 `web_search` / `web_fetch` / `research` 与读依赖源码）；包契约新增原生机制机检（host 必须含 `agentPresets` / `export const Config` / `commands.register` / `skills.register` / `agentPreset`，禁止 `webServer` 与 `/api/dsh-steward`；client 必须用 `configForms`）；`package.json` 声明 `@deepseek-ai/schemastery` peer 依赖、`dsh.client.inject` 含 `@deepseek-ai/dsh-client-ui-settings`，版本 0.2.0。
- **技能正文同步原生口径**：主技能 banner 升级到 DSH 0.2.0（角色 = Agent Presets、`/steward` 只回显名册）、`agent-settings` 不再引用 `~/.dsh/steward/subagent-config.json` 而指向原生 Settings 命名空间 `steward`、`using-steward` / `entry-points` 更新斜杠命令说法。
- **浏览器验收角色**：`host/dsh/agents/browser-tester.operation-methods.md` 去掉 ZCode 专属 Tabbit，改为「仓库自带 Playwright → DSH 侧栏人工驱动 → 人工兜底」，provider 枚举同步为 `playwright | sidebar | manual`。

### 验证

- `node host/dsh/build.mjs` / `--check` → exit 0；`node --check dsh/index.js`、`node --check dsh/client.js` → exit 0。
- `node --test host/dsh/tests/` → **8 pass / 0 fail**；`node --test zcode/scripts/tests/` → 54 pass / 0 fail；`node zcode/scripts/build.mjs --check` → exit 0。
- `Config.listConfigs(include:steward)` → `status: schema`，7 角色 × 3 字段均 `x-cordis.volatile: true`。
- 实派证据：`steward_config set(role=reviewer, ctaigw/glm-5.3@high)` → profile `cordis.patch.yml` 出现 `- id: steward` 覆盖行；`steward_dispatch(role=reviewer)` → 子会话头 `agentPreset: steward-reviewer`、`subagent/descriptor` 记录 `ctaigw/glm-5.3@high`、system message 以评审员 persona 开头、task prompt 只含派单正文；子代理回传 `STEWARD_PRESET_OK`。
- Client Slots `settings.section` → occupant `steward`（order 50）`active: true`（Client 半加载 + `configForms` 注入成功）。浏览器视觉/交互截图仍未做，不宣称视觉通过。
- `git status`：仅 `dsh/`、`host/dsh/` 与 README/CHANGELOG/ROADMAP-STATUS；其他宿主与共享源无改动。

## [DSH 0.1.0] - 2026-11-11

> 新增第三个宿主：**DeepSeek Harness（DSH）**。`dsh/` 是标准 DSH bundle（Host + Client 双层插件），由 **DSH 专属构建器** `node host/dsh/build.mjs` 从 `shared/` + `host/dsh/` + `zcode/scripts/`（只读引用）生成，只写 `dsh/`。核心诉求是「可视化配置子代理的模型与思考强度」：设置页实时读宿主 `llm` 模型目录，7 个角色逐行选 provider / model / effort，保存后下一次派单即生效。本次**只改 DSH 侧**：`zcode/`、`minimax/`、`shared/`、`zcode/scripts/` 均无改动（`git status` 可证），共享正文里少数 ZCode/MiniMax 事实由 DSH 构建器按行替换。

### Added

- **DSH 插件包（`dsh/`，由 `host/dsh/` 生成）**：`index.js` 注册 6 个技能（`steward` / `using-steward` / `agent-settings` / `systematic-debugging` / `tdd` / `verification-before-completion`）、2 个工具与 3 条配置桥路由；`client.js` 在 `settings.section`、`plugins.bundle.config`、`plugins.row.config` 三个槽位注册同一配置页。
- **DSH 专属构建器 `host/dsh/build.mjs`**：渲染 DSH 技能/角色、同步包文件与门禁脚本、生成 `skills/manifest.json` / `roles/manifest.json`、校验包契约；只读 `shared/` 与 `zcode/scripts/`，只写 `dsh/`。共享正文中的脚本表行（`agent-config.mjs` / `build.mjs`）、MCP 检索栈、可视化配置入口在 DSH 输出里按行替换，不改共享源。
- **`steward_dispatch` 工具**：按 `role` 派 Steward 子代理；把该角色配置映射为子代理 `agentOptions`（provider/model/reasoningEffort），角色提示词拼进任务 prompt，`delivery: 'parent'`，返回 child id。未配置角色继承默认配置，默认也未配置则继承主代理。项目根 `steward.config.json` 的 `modelRouting.<role>` 优先于设置页（与 ZCode/MiniMax 的「项目级 > 插件默认」口径一致）。
- **`steward_config` 工具**：`list` / `set` / `reset`；与设置页共用同一份配置与校验逻辑（未知模型、未知档位、半截 provider+model 都会拒绝）。
- **「设置 → Steward」配置页**：默认配置 + 7 个角色，各自 provider / model / effort 下拉；档位只列所选模型真实支持的集合（`llm.resolveModelInfo`）；来源徽标（自定义 / 默认 / 继承主代理）、保存 / 撤销 / 刷新模型目录、错误与成功回显；主题 token 与宿主设置页一致。
- **配置存储**：`~/.dsh/steward/subagent-config.json`（原子写：临时文件 + rename），不重写用户的 `cordis.patch.yml`。
- **DSH 角色提示词**：`host/dsh/agents/*.frontmatter.md` + `shared/agents/*.body.md` 渲染为 `dsh/roles/*.md`；`host/dsh/roles.json` 提供短标题与摘要；两个运行期清单由构建生成、Host 启动时读取。
- **DSH 宿主片段**：主技能槽位（banner / roster / entry-points / dispatch-call / concurrency-error / model-routing-dispatch / model-default-line / explore-agent / ask-tool）、两个整技能覆盖（`agent-settings` / `using-steward`）、浏览器验收方式（Tabbit 优先 / Playwright / 人工兜底）与宿主检索标签（`web_search` / `web_fetch` / `research` / `platform_search` / `domain_search`）。
- **DSH 门禁脚本**：`take-over` / `validate-config` / `validate-plan` / `run-state` / `verify` / `maintain` + `templates/` + `doc/` + `skills/steward/references/` 从 `zcode/` 只读复制（跳过 MiniMax 专用 `agent-config*.mjs`、`trigger.mjs`、构建器 `build.mjs`）。
- **测试**：`host/dsh/tests/dsh-plugin.test.mjs`（7 例）覆盖技能/工具/路由注册、状态路由、配置校验与落盘、跨站写拒绝、`steward_config` 三类动作、`steward_dispatch` 的配置映射 / 默认继承 / 角色提示词 / 错误角色、项目级 `modelRouting` 优先。

### Changed

- **README / AGENTS / CHANGELOG**：改为三宿主口径，新增 DSH 独立构建、安装、配置页与工具说明；宿主隔离约定明确 DSH 只读 `shared/` 与 `zcode/scripts/`、只写 `dsh/`。
- **未改动**：`zcode/`、`minimax/`、`shared/`、`zcode/scripts/` 与外两宿主清单均保持仓库现状；ZCode/MiniMax 的构建检查与 54 例测试照常通过。

### 验证

- `node host/dsh/build.mjs` → exit 0；`node host/dsh/build.mjs --check` → exit 0（幂等、无 `@@SLOT` 残留、包契约合法）。
- `node --check dsh/index.js`、`node --check dsh/client.js` → exit 0。
- `node --test host/dsh/tests/` → **7 pass / 0 fail**；`node --test zcode/scripts/tests/` → **54 pass / 0 fail**（外两宿主未受影响）。
- `node zcode/scripts/build.mjs --check` → exit 0（未改 ZCode/MiniMax，检查仍绿）。
- 插件管理器 `install_bundle(target=<repo>/dsh)` → `application: applied`；「设置 → Steward」槽位 occupant 为 `steward`（order 50）且 active；技能目录实际出现 6 个 Steward 技能；`steward_config` / `steward_dispatch` 工具可调用。
- 实机派发证据：把 `reviewer` 配置为 `ctaigw/glm-5.3 @ high` 后调用 `steward_dispatch`，子会话 `request/header` 记录 `{"provider":"ctaigw","model":"glm-5.3","reasoningEffort":"high"}`，子代理回传 `STEWARD_OK`；另用临时项目 `steward.config.json` 的 `modelRouting.qa-engineer = ctaigw/glm-5.3 @ high` 派发同角色，配置页为空也能命中项目级路由，子会话 header 同样为 `ctaigw/glm-5.3 @ high`。
- 视觉验收限制：本次环境 Tabbit 浏览器需要 dsh web 的认证 URL，未取得；设置页的渲染外观未做浏览器截图核对，仅验证了槽位注册、Client 模块加载与 JS 语法。待有认证页面补做明暗主题与可读性核对。

## [ZCode 0.11.0 / MiniMax 0.11.0] - 2026-11-11

> MiniMax 侧对齐 ZCode 已有的能力：补齐三道 PreToolUse 宿主守卫（密钥 / 所有权 / 危险命令）。此前 MiniMax 包虽已同步 `scripts/hooks/guard.mjs`，但 `hooks.json` 只注册了 UserPromptSubmit 触发器——守卫脚本从未被宿主调用，属于带病上线。本次补齐注册、技能正文挂载与说明文档，两宿主版本号同步升至 0.11.0。

### Added

- **MiniMax 宿主守卫注册**：`minimax/hooks/hooks.json` 增加 `PreToolUse` 段，按 MiniMax 契约声明三道守卫——`secret`（write/edit 内容疑似密钥）、`ownership`（write/edit 目标文件不在 `.steward/ownership.json` 白名单）、`dangerous`（bash 命中 `rm -rf` / `git push --force` / `git reset --hard` / `git clean -f` / 破坏性 SQL / `mkfs`·`dd` / fork bomb）。
- **宿主差异适配**：MiniMax 用 `${PLUGIN_ROOT}`（Windows 走 `commandWindows`），matcher 用小写原生工具名 `write|edit` / `bash`（非 ZCode 的 `Write|Edit` / `Bash`）——契约见 plugin-creator 的 `local-plugin-hooks.md`。
- **技能正文挂载**：新增 `host/minimax/skills/steward/hooks-row.md`，使 MiniMax 主技能的门禁脚本表列出守卫入口，与 ZCode 侧对齐。
- **`minimax/hooks/README.md`**：守卫说明（触发工具、stdin/exit code 契约、激活与关闭方式、ownership.json 格式）。

### Changed

- **守卫自检跨宿主化**：`scripts/hooks/selftest.mjs` 新增 5 例 MiniMax 原生事件载荷（工具名小写、write 用 `path`+`content`、edit 用 `file_path`+`new_string`），确保证卫在 MiniMax 字段名下判定一致；自检从 11 例扩到 16 例。
- 两宿主版本号统一升至 **0.11.0**（build.mjs 要求两宿主同号），README / 清单 / 路线图同步。
- **build.mjs 新增 matcher 机检**：hooks.json 的 `PreToolUse.matcher` 只允许各宿主精确的原生工具名（MiniMax 小写 `bash`/`write`/`edit`…，ZCode `Bash`/`Write`/`Edit`…）。matcher 写错不会报错、只会永不触发，属静默失效——构建期直接拦下。
- **出厂 banner 版本同步**：两宿主 `host/*/skills/steward/banner.md` 的「当前版本（x.y.z）」随发布号更新；MiniMax banner 补「+ 可选宿主守卫 hooks（secret / ownership / dangerous）」能力句。
- **guard.mjs 头部注释订正**：原注释写「阻止 exit 2 并输出 JSON `{decision:block, reason}`」，与实现（stdout 保持空 + stderr + exit 2）不符；两个宿主都是「exit 2 + stderr」语义，注释按实际口径改写。

### 验证

- `node zcode/scripts/build.mjs` → exit 0；`node zcode/scripts/build.mjs --check` → exit 0、零 warning。
- `node zcode/scripts/hooks/selftest.mjs` → **16 例全 PASS**（exit 0 放行 / exit 2 阻断 / stdout 为空）。
- `node --test zcode/scripts/tests/` → 全绿。
- 安装镜像后逐字节比对仓库 `minimax/` 与 `%USERPROFILE%\\.minimax\\plugins\\steward\\` 一致。

## [ZCode 0.10.0 / MiniMax 0.10.0] - 2026-11-11

> 新增「执行模式」：在默认的 subagent（派子代理）之外，允许主代理按计划自己执行低风险任务（inline）。这不是流程降级——计划、baseline、TDD、verify 与报告全部保留，只换执行者；S / B3 / 维护小修默认允许，M 需显式开启，L 与 B0/B1/B2 禁止。

### Added

- **`execution.mode` 配置**：`steward.config.json` 新增 `execution.mode: "subagent" | "inline"`，默认 `subagent`；`validate-config.mjs` 增加枚举校验与未知子键警告。
- **`/steward:inline` 命令（ZCode）**：主代理按 DAG 顺序直接执行；MiniMax 侧用自然语言「你直接做 / 别派子代理」触发。
- **主技能「执行模式」节**：优先级（用户当次指令 > 配置 > 默认）、允许范围（S / B3 / 维护小修；M 显式；L 与 B0/B1/B2 禁止）、inline 硬动作（计划、baseline、TDD、verify、`reports/t<ID>-lead.md`、05-record）与反例。
- **路由与入口同步**：`using-steward` 路由表、两宿主 entry-points、`trigger.mjs` 上下文均识别 inline 意图。
- **测试**：新增 `validate-config-execution.test.mjs`，覆盖合法枚举、非法枚举、非对象、未知子键四类。

### Changed

- 调度规则第 6 条由「任何阶段都不要自己替子代理干活」改为「默认不替；inline 允许范围内例外，门禁不降级」，消除与 S 级流程的矛盾。
- S 级、B3、维护 Fix small 允许走 inline；M 级仅在显式要求时 inline，且 Stage 3 QA 与 Stage 5 reviewer 照旧派；L 与 B0/B1/B2 禁止 inline。
- 架构师任务表的 `role` 明确为「任务类型」，不代表执行者。
- 两宿主版本号统一为 0.10.0；README / 插件清单同步。

### 验证

- `node zcode/scripts/build.mjs` → exit 0
- `node zcode/scripts/build.mjs --check` → exit 0、零 warning
- `node --test zcode/scripts/tests/agent-config.test.mjs` → 49 pass / 0 fail
- `node --test zcode/scripts/tests/validate-config-execution.test.mjs` → **5 tests / 1 suite / 5 pass / 0 fail**
- `validate-config.mjs` 正例 exit 0（PASS）/ 负例 exit 1，报错点名 `execution.mode 必须是 subagent | inline`

## [ZCode 0.9.0 / MiniMax 0.9.0] - 2026-11-11

> 新增「子代理模型与思考强度可视化配置」：7 个子代理的模型与档位可视化改，不再手改三处文件（frontmatter / 名册表 / 项目配置）。同时修掉一个现存偏差——插件子代理的 frontmatter 只声明了 `model` 没声明 `effort`，直接调用子代理时思考强度会落到运行时默认（实测 low），而不是名册写的 high。两宿主版本号统一为 0.9.0。

### Added

- **可视化配置页（Mini App 主壳 + 本地页回落壳，同一套页面资产）**：插件包内新增 `miniapp/`（`miniapp.json` + client 载荷 + node 载荷），MiniMax 宿主在应用面板给出永久入口；宿主未接纳时用 `agent-config.mjs serve` 起本地页（127.0.0.1，默认 7317，占用自动换端口）。两条路共用同一份页面与同一套 API（`GET /api/state` / `POST /api/save`）。
- **`agent-config.mjs`（catalog / show / set / serve / install）**：读本机模型目录（`~/.minimax/config.yaml`）得到真实可用的模型与每个模型支持的档位集合；展示 7 个角色的当前分配与**生效来源**（项目级覆盖 / 插件默认 / 未配置）；按角色改 model / effort / fallback；写盘走「校验 → 备份 → 写 → 复校 → 失败自动回滚」。
- **`steward:agent-settings` 技能**：用户说「配置子代理模型 / 思考强度」时路由到它。双宿主共享正文 + 宿主差异槽位（MiniMax 侧给 Mini App / 本地页 / 命令行三条入口；ZCode 侧只做口径说明——ZCode 用宿主默认模型）。
- **`validate-config.mjs` 目录感知校验**：`modelRouting` 的 model 必须存在于本机模型目录（否则运行时 `MODEL_SELECTION_INVALID`，不回退父模型），effort 必须属于该模型的档位集合；读不到本机配置时降级为警告不阻断，`--skip-catalog` 可显式跳过。
- **`build.mjs` 新增机检**：agent frontmatter 的 `effort` 必须与 `model` 同时出现、取值须在白名单内；名册表与 frontmatter 逐角色一致性检查（不一致即 build 失败并指出角色）；Mini App 载荷同步 + MiniMax 包 ASCII 路径契约校验扩展到 `miniapp/`。

### Fixed

- **子代理默认思考强度偏差**：7 个 agent 的 frontmatter 补 `effort: high`。此前缺失时，直接调用子代理（非经主技能派单）会按模型默认档位跑（实测 low），与名册表声明的 high 不符。
- **名册表与 frontmatter 漂移**：名册表改为每角色一行并新增「生效方式」列，由 `build.mjs` 与 frontmatter 机检一致性；不再依赖「换模型时两处一起改」的人记。

### Changed

- `steward.config.json` 的 `modelRouting.<role>.fallback` 允许可选 `effort`（向后兼容：只写 model 仍合法）。
- `UserPromptSubmit` 触发器新增模型配置意图（「子代理 + 模型/思考强度/档位」），命中时注入 `steward:agent-settings` 上下文，并**优先于**主 Steward 触发；未命中仍静默 fail-open。
- 主技能「模型路由与预算」节补**生效优先级链**：用户当次指定 > 项目级 `modelRouting`（下次派单即生效）> 插件 frontmatter 默认（build + 安装后新会话生效）。

### 验证

- `node zcode/scripts/build.mjs` → exit 0（单一正文源同步 + 渲染 + 清单/frontmatter 校验 PASS）；`node zcode/scripts/build.mjs --check` → exit 0 零 warning。
- `node --test zcode/scripts/tests/agent-config.test.mjs` → **49 tests / 10 suites / 49 pass / 0 fail**（YAML 解析正负例、catalog、校验规则、项目级读写与回滚、插件级同步与回滚、状态组装、HTTP 路由、镜像同步）。
- `node zcode/scripts/agent-config.mjs catalog` → 本机 8 个供应商 / 19 个模型，档位集合逐模型列出，非标准档位（mediem / hign）标「非标准档位」，无推理模型标「不支持档位」。
- `node zcode/scripts/agent-config.mjs show` → 7 个角色的生效模型 / 档位 / 来源（当前均为「插件默认」）。
- 本地页实跑（`serve --port 7317`）：`GET /` 200（4126B，含角色表头）、`/app.css` 200、`/app.js` 200、`GET /api/state` 200（roles=7、models=19、catalog.ok=true、repo.detected=true）。
- 保存失败路径：`POST /api/save` 传目录里不存在的模型 → **400**，错误原文点名「本机模型目录中不存在 … 运行时该模型会直接失败 MODEL_SELECTION_INVALID」并列出前 8 个可用 key（共 19 个），**配置文件未创建**。
- 保存成功路径：`POST /api/save` → **200**，落盘 `modelRouting.architect = {model, effort: medium, fallback:{model, effort: max}}`，随包返回校验器真实输出（`[validate-config] 结果：PASS`，exit 0）。
- 路径防护：`/miniapp.json` → 404；`/../scripts/build.mjs` → 404。
- Mini App 冷启动（构建产物 `minimax/miniapp/node/server.mjs`，start(context) 实跑）：监听宿主分配端口后 `GET /` 200、`/api/state` 200（qa-engineer 显示 model + effort=high + source=plugin）、`/miniapp.json` 404、`dispose()` 正常回收。
- `node zcode/scripts/agent-config.mjs install --repo … --apply` → 构建 exit 0 + 镜像 98 个文件到 `C:\Users\12247\.minimax\plugins\steward`；安装目录核对：版本 **0.9.0**、`miniapp/` 与 `package.json` 到位、`skills/agent-settings` 已注册、agent frontmatter 含 `effort: high`。
- 实跑抓到并修复两处真 bug：① `install --apply` 首次执行崩在 `ReferenceError: spawnSync is not defined`（CLI 漏导入 node:child_process）——已补导入并重跑通过；② Mini App 声明的 `surface.path` 是 `/settings`，而服务端只服务 `/`，宿主按声明路径打开会 404——改为启动时读 `miniapp.json` 的真实 `surface.path` 一并服务（复测：`/`、`/settings`、`/index.html` 均 200，未知路径仍 404）。
- 终审自查（独立评审子代理在产出结论前被上游 provider 网络错误打断，未出报告）：硬编码绝对路径 0 处（新增文件全量扫描）、调试残留 0 处（CLI 的 console.log 是正常输出，测试内那处在 build stub 字符串里）、凭据字段 0 处（catalog JSON 中 apiKey / baseURL 零命中，模型字段只有白名单那 12 个）。
- **effort 修复的实机证据**：新开会话（`mcode exec`）真实派发 `steward:qa-engineer`，运行时 `local_runtime_session_agent_definitions.definition_json` 记录其模型为 `custom_provider:provider-7970db/step-5-preview` 且 `thinking.effort = high`——证明 frontmatter 的 `effort` 确实被宿主解析（修复前同族定义里没有 effort 字段，档位落到运行时默认）。


### 已知偏差

- Mini App 的宿主接纳与实机交互待首次实机验证；独立本地页功能等价，不受此影响。
- 本机模型配置里存在非标准档位名（`mediem`、`hign`）：以配置原文为准判定合法，页面只做软提示，**不擅自改用户配置**。

## [ZCode 0.8.2 / MiniMax 0.8.2] - 2026-11-07

> MiniMax 侧对齐：v0.8.1 的 `steward:using-steward` 技能路由同步到 MiniMax（路由表按宿主适配）；v0.8.2 的斜杠命令注册修复为 ZCode-only（MiniMax 无斜杠命令能力，不适用）。**两宿主版本号统一为 0.8.2**——原「ZCode 0.x ↔ MiniMax 1.(x-2)」的错位节奏在同仓同发后不再需要。

### Added（MiniMax 1.6.2 对齐）

- **`steward:using-steward` 同步到 MiniMax**：技能正文上提为 `shared/skills/using-steward/SKILL.md`（与 systematic-debugging / tdd / verification-before-completion 同属轻量技能族），路由表下沉为宿主片段 `host/<host>/skills/using-steward/routing-table.md`——ZCode 列斜杠命令（`/steward` / `/steward:fix` / `/steward:plan` / `/steward:maintain` / `/steward:take-over`），MiniMax 列自然语言触发（「用 Steward 完成…」「帮我修这个 Bug」「出个方案先别写」「扫一遍依赖与重复」「接手这个项目」「按 docTier=3 建文档树」）。
- **build.mjs 支持轻量技能槽位渲染**：轻量技能正文现在也走 `renderSlots`，可引用宿主片段；渲染时自动创建技能目录（`mkdirSync`），新增技能不再因目录不存在而 ENOENT。
- `minimax/.minimax-plugin/plugin.json` 1.6.0 → **1.6.2**，技能清单加 `skills/using-steward/SKILL.md`；技能 frontmatter 补 ⑥技能路由；banner 同步版本与能力。

### Fixed

- **MiniMax 包路径契约——插件在列表里看不见的根因**：MiniMax Plugin V1 要求**包内路径全为 ASCII**（`validatePluginPortablePath` → `NON_PORTABLE_PATH`；路径段须匹配 `^[A-Za-z0-9._-]+$`）。v1.6.0 同步文档流水线时带入的 `assets/通用编程规范与指南.md` 触发该规则 → **整个包被宿主拒绝载入**，表现为插件列表里没有 Steward、hook 不触发、子会话看不到 `steward:*` 技能。修复：文件改名为 `assets/coding-guidelines-baseline.md`（正文标题保持中文），同步更新 6 处路径引用。
- **build.mjs 新增 MiniMax 包路径契约校验**：包内出现非 ASCII 路径或不合规路径段即 build 失败（exit 1），防止再次踩同一个坑。
- **部署改为镜像语义**：单纯拷贝不会删除安装目录里的旧文件——仓库里删掉的文件会残留（本次残留的中文名文件正是让包继续被拒的原因之一）。部署时先删源已不存在的文件再拷贝。

### Changed

- 共享正文的「入口」片段（`host/<host>/skills/steward/entry-points.md`）在 MiniMax 侧改为指向「主技能 `steward:steward`」并补 docTier=3 自然语言入口——该片段现在被主技能与路由技能两处复用，措辞需无歧义。
- **两宿主版本号统一为 0.8.2**：`minimax/.minimax-plugin/plugin.json` 1.6.2 → **0.8.2**（与 ZCode 侧同号）；`host/minimax/skills/steward/banner.md`、`minimax/README.md`（中英）、根 README（中英）、ROADMAP / ROADMAP-STATUS 同步。
- **build.mjs 版本校验改为「两宿主版本必须一致」**：原规则 ZCode 0.x.y ↔ MiniMax 1.(x-2).y 依赖版本号本身可推导；统一版本号后该正则会失配、校验静默失效。改为直接比较两个清单的 `version` 字段，更简单也更严格。

### 验证

- `node zcode/scripts/build.mjs --check` exit 0，**零 warning**（两宿主版本一致，均为 0.8.2）。
- 两版 `skills/using-steward/SKILL.md` 渲染完成，`@@SLOT` 残留 0；ZCode 出斜杠命令路由表，MiniMax 出自然语言路由表。
- MiniMax 清单技能数 5 → 6，build.mjs 的「磁盘有技能但未列出」warning 为 0。
- YAML frontmatter 真解析器校验两版全部通过。

### 已知偏差

- v0.8.2 的斜杠命令注册修复（`/steward fix` → `/steward:fix`）为 **ZCode-only**：MiniMax 宿主无斜杠命令能力，本次不改 `minimax/` 的命令结构。
- 技能路由为提示词级技能，未做 agent 行为回归。

## [ZCode 0.8.2 / MiniMax 1.6.0] - 2026-11-07

> ZCode-only 修复：斜杠命令后缀入口此前全部未注册。`.md` 文件名里的点号不合法（宿主规则 `^[a-z0-9][a-z0-9_:-]{0,63}$`），`/steward fix` 实际只是 `/steward` 带参数 `fix ...`。改为子目录命名后，入口变为 `/steward:fix` / `/steward:plan` / `/steward:take-over`，并新增 `/steward:maintain`。

### Fixed

- **命令注册**：`zcode/commands/steward.fix.md` / `steward.plan.md` / `steward.take-over.md` → `zcode/commands/steward/{fix,plan,take-over}.md`。命令名由相对 `commands/` 的路径推导，子目录用 `:` 连接，因此触发方式变为 `/steward:fix`、`/steward:plan`、`/steward:take-over`；`/steward` 保持不变。
- **补缺失入口**：新增 `zcode/commands/steward/maintain.md` → `/steward:maintain`，此前技能正文写了维护循环入口但没有命令文件。

### Changed

- `host/zcode/skills/steward/{entry-points,frontmatter,banner}.md`、`zcode/skills/using-steward/SKILL.md`、根 README、`zcode/README.md`、`docs/ROADMAP.md` 的命令口径统一改为冒号命名。
- `zcode/.zcode-plugin/plugin.json` 0.8.1 → 0.8.2；`marketplace.json` 同步 0.8.2（本地目录市场按清单版本判更新）。

### 验证

- `node zcode/scripts/build.mjs --check` exit 0；仅 1 条预期版本节奏 warning（ZCode 0.8.2 / MiniMax 1.6.0，期望 1.6.2）。
- 按宿主同一规则推导命令名：`/steward`、`/steward:fix`、`/steward:plan`、`/steward:take-over`、`/steward:maintain` **5/5 OK**。
- `plugins update steward@dev-codestore-f437d635` 成功（0.8.0 → 0.8.2）；随后 `zcode commands list` 实际列出 5 条：`/steward`、`/steward:fix`、`/steward:maintain`、`/steward:plan`、`/steward:take-over`。
- `zcode/skills/steward/SKILL.md` 已由 `build.mjs` 重新生成，入口行为冒号形态。

### 已知偏差

- MiniMax 侧无斜杠命令能力，本修复不改 `minimax/` 的命令结构；其 1.6.2 同步项见上方条目。
- 桌面端已在跑的会话不会热加载新命令，需重启 ZCode 或开新会话后生效（宿主在会话启动时载入插件命令）。

## [ZCode 0.8.1 / MiniMax 1.6.0] - 2026-11-07

> ZCode-only patch：新增 `steward:using-steward` 技能路由。MiniMax 1.6.0 未同步该技能；若要双宿主，1.6.1 再同步（版本节奏 warning 预期）。

### Added

- **`steward:using-steward`（ZCode 侧）**：不知道用哪个入口/技能时先读的路由技能——功能交付 / Bug / 只出计划 / 维护 / 接手 / 文档流水线 / 需求澄清七类入口，以及 `systematic-debugging` / `tdd` / `verification-before-completion` 的加载信号；含三条纪律（不新造角色、S 级直接做、不确定先 `/steward plan`）与反例。
- 主技能 ZCode frontmatter/banner 增加 ⑥ 技能路由入口；`zcode/.zcode-plugin/plugin.json` 0.8.0 → 0.8.1。

### 验证

- `node zcode/scripts/build.mjs --check` exit 0；仅 1 条预期版本节奏 warning（0.8.1 vs 1.6.0，期望 1.6.1）。
- MiniMax 生成物逐字节不变（本技能 ZCode-only；`minimax/` 与 `host/minimax/` 未改）。
- 新技能 frontmatter 合法、路由表覆盖 7 类入口 + 3 个轻量技能；`@@SLOT` 残留 0。

### 已知偏差

- MiniMax 侧已于 1.6.2 同步（见上方条目）；1.6.1 未单独发布。
- 路由为提示词级技能，未做 agent 行为回归。

## [ZCode 0.8.0 / MiniMax 1.6.0] - 2026-11-06

> MiniMax 侧在 1.6.0 对齐 ZCode 0.8.0：文档流水线与需求澄清内核同步到 MiniMax，版本节奏 warning 消失。

### Added（ZCode 侧：文档流水线）

- **完整吸收 `eng-doc-pipeline`（Desktop 2026-10-28 快照）**：新增 `zcode/skills/steward/references/doc-pipeline/`——hub README（保留七阶段流水线、SSOT 地图、SOP、阶段门禁、错误表）、7 个 references（AGENTS 层级 / 编码规范 / 数据访问 / 前端规范 / 命名守卫 / 联动表 / 接手 SOP）、19 类模板 + `templates/README.md` + T2 的 `01-REQUIREMENT.md` / `04-EVIDENCE.md` / `05-RECORD.md`、通用编程规范基线；`PROVENANCE.md` 记录来源与逐项改编。
- **T0–T3 映射**：T1 `docs/project/` 只放摘要 + 链接；docTier=3 的深正文进 `docs/01..07`；T0 仍 ≤100 行；约束正文进 `AGENTS.md` / `.agents/rules/`；视觉 token 进 `.agents/designs/DESIGN.md`。
- **三个本地脚本**（`zcode/scripts/doc/`；自 MiniMax 1.6.0 起进入 build.mjs 同步范围，双宿主共享）：`doc-init.mjs`（建七阶段树 + 索引骨架，幂等不覆盖）、`doc-check.mjs`（T1 / 索引 / 死链 / 未索引文件）、`guard-naming.mjs`（波次/工单/优先级/批次命名守卫，`[FROZEN]` / `[BURN-DOWN]` 基线只减不增）。
- **技能路由**：文档流水线与需求澄清两节自 MiniMax 1.6.0 起上提为 `shared/skills/steward.body.md` 的共享正文，双宿主渲染出同一节（宿主差异只剩提问工具名与入口形态两个小槽位）。
- **需求澄清内核**：Stage 0.1 条件启用（M/L / 二义 / 新领域）；第一性原理四问（问题 / 约束 / 备选 / 非目标+成功指标）+ 最多 3 个 P0 提问预算；S 级不追问；新增 `templates/01-REQUIREMENT.md`。不引入「强制先问后写」硬门槛。

### Added（MiniMax 1.6.0 对齐）

- **文档流水线同步到 MiniMax**：`minimax/skills/steward/references/doc-pipeline/`（33 个 md：hub README + 7 references + 19 类模板 + `templates/README.md` + assets 基线 + PROVENANCE）与 `minimax/scripts/doc/`（`doc-init` / `doc-check` / `guard-naming` + README）由 `build.mjs` 从 `zcode/` 侧单向同步，两树逐字节同源。
- **需求澄清内核同步到 MiniMax**：Stage 0.1 渲染进 MiniMax 技能正文，提问工具用宿主原生 `ask_user`（ZCode 侧仍是 `AskUserQuestion`）。
- **斜杠命令口径宿主中立**：共享正文里的 `/steward fix` / `/steward maintain` / `/steward plan` / `/steward take-over` 改为中性措辞，命令形态下沉到 `host/<host>/skills/steward/entry-points.md`（ZCode 斜杠命令 / MiniMax 自然语言 + Hook 自动加载）。
- **版本与清单**：`minimax/.minimax-plugin/plugin.json` 1.5.3 → 1.6.0，描述补文档流水线与澄清内核；技能 frontmatter 同步补 ④文档流水线 / ⑤需求澄清，并去掉 MiniMax 侧无效的 `/steward` 入口。
- **宿主适配**：doc 脚本的排除目录加 `.minimax`（目标仓库的宿主目录不该被命名守卫 / 文档检查扫到）；接手模式提示从 `/steward take-over` 改为「接手这个项目」。

### 演练与清理

- **worktree 多分支合并演练**：两个文件集不相交的任务各自在独立 worktree 实现并 `node --test`，主工作区按 DAG 顺序 `--no-ff` 串行合并，每次合并后复跑；同文件冲突探针产生 `UU README.md`；清理后主分支仍绿——**6/6 PASS**。记录 `tmp/steward-fixtures/worktree-demo/DRILL.md`。
- **taskboard 两处 non-blocking 清理**：过滤快速切换竞态（`public/refresh-guard.js` 序号 + AbortController）、`GET /api/tasks` 加 `Cache-Control: no-store`；fixture `npm test` **22/22 PASS**。记录 `.steward/cleanup-20261106.md`。

### Changed

- 口径统一：CI/CD → 本地门禁脚本 + 可选 git hook（不创建 `.github/workflows`）；「同 commit」→「同一批变更」（默认不提交）；浏览器优先级改为 Playwright MCP / Chrome DevTools MCP → 内置浏览器兜底，证据统一 `browser-evidence.json`；可靠性排序链统一（原 `agents-files.md` 与 SKILL §6.3 不一致）。
- `zcode/.zcode-plugin/plugin.json` 0.7.3 → 0.8.0；`minimax/.minimax-plugin/plugin.json` 1.5.3 → 1.6.0；根 README / `zcode/README.md` / `minimax/README.md` 中英同步。
- **build.mjs 同步范围扩展**：新增 `zcode/scripts/doc/` 与 `zcode/skills/steward/references/` → `minimax/` 的单向同步（文档流水线参考库与本地脚本自此为单一正文源）。
- **删除 v0.7.1 遗留的孤儿生成物** `host/zcode/skills/steward/SKILL.md`（build.mjs 自 v0.7.1 起不读不写它，内容停在 0.7.1）。
- **安装说明订正**：原「MiniMax 会自动重扫本地插件，无需重启」与实测不符——本地插件在**会话启动时**被扫描并载入，运行中的会话不热加载（新插件从下一个新会话起生效）；`minimax/README.md` 中英同步订正。

### 验证

- `node zcode/scripts/build.mjs --check` exit 0，**零 warning**（版本节奏 0.8.0 ↔ 1.6.0 已匹配）；`build.mjs` 同步 38 个文件、渲染 2 个技能文件。
- 两版 SKILL.md 残留 `@@SLOT` 均为 0；ZCode 出「AskUserQuestion」+ 斜杠命令入口，MiniMax 出「ask_user」+ 自然语言入口，各一份、无交叉。
- YAML frontmatter 用真解析器（python + pyyaml）校验：25 个技能/agent frontmatter 全过（0 bad），两版清单 JSON 合法。
- `check-doc-refs.mjs`：33 个 md、markdown 链接 + 反引号引用全部解析通过。
- 模板拆分对照：19 个模板与源 `templates.md` 对照，缺失行 21 条，全部为计划内适配（CI→本地门禁 / commit→同一批变更 / 路径 / Steward 说明），无大段丢失。
- 对齐自检 `tmp/verify-1.6.0.mjs` **13/13 PASS**：scripts/doc（4 个文件）与 references/doc-pipeline（33 个文件）两树与 ZCode 侧逐字节同源；MiniMax 包内 `doc-init` dry-run / `--write` 建树 / 幂等 / tier<3 跳过 / 非法根 exit 2 全对；`doc-check` 与 `guard-naming` 对 fixture exit 0；references 内无 ZCode 专属措辞、无 `/steward take-over`；库内 83 条引用全部可解析（顺带修掉 PROVENANCE 里 3 个指向 `templates/` 的不可解析路径）。
- fixture `tmp/steward-fixtures/doc-pipeline-demo/`：`test-doc-scripts.mjs` **30/30 PASS**——doc-init dry-run/写入/幂等；doc-check 正例 + 死链 / 未索引 / 缺 T1 三个负例；guard-naming 干净 / WAVE / PRIORITY / `--init` / 拒绝覆盖 / stale / 最终通过；`maintain.mjs` exit 0 且无 docDrift finding。
- `guard-naming` 误伤用例 `web3-client.ts` / `test-s3.ts` / `approval-batch.ts` 不命中。
- taskboard `npm test` **22/22 PASS**；worktree `DRILL.md` **6/6 PASS**。

### 已知偏差

- 外部 `eng-doc-pipeline` 快照冻结；后续以 vendored 库为双宿主事实源。
- **运行时载入时点**：`~/.minimax/plugins/steward/` 已部署且通过包校验，但**安装它的那个会话不会热加载**——实测证据：安装后新开的子会话既无 `steward:*` 技能也无 steward 的 `UserPromptSubmit` 注入块，`plugin-hook-cache` 无新快照（本地包物化发生在会话启动时，见 `dev-team` v1.1.0 快照时间戳与会话启动一致）。需开新会话或重启 app 才生效。
- 需求澄清仍是提示词级规则，未做 agent 行为回归；等真实 M/L 需求观察。
- AFC/AIAPaaS 分支的 §5.0 仅**部分吸收**（第一性原理 + 提问预算），未引入「强制先问后写」；需求澄清为提示词级规则，未做 agent 行为回归，等真实 M/L 需求观察。

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
