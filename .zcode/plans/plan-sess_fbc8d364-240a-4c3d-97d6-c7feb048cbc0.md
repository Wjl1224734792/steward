## Context

P0–P2 已交付，但 `docs/ROADMAP-STATUS.md` 记录的 P2 项 16 仍是「部分实现」：**技能/agent 正文双源维护**（zcode 与 minimax 各一份手写，靠 build.mjs 的漂移报告兜底）。这正是「不二改、长期可维护」要还的最后一笔债。目标：把 22 个技能/agent 文件（4 技能 ×2 宿主 + 7 agent ×2 宿主）改成**单一正文源 + 宿主片段 → build.mjs 生成**，让改一处生效两版，`--check` 能拦住手改与漂移；同时按建议做本地 commit（不 push）。

已核实的差异（只读盘点）：
- 两个 `skills/steward/SKILL.md`（209/247 行）约 90% 相同；差异为：宿主 frontmatter/banner、名册与派发章节（minimax 多「模型分配」「派发方式」整节）、检索工具名（tavily / `tavily-remote`）、Stage 0.5 的 Explore/explore、Stage 4 的 glm 注记、调度规则 #2/#3、模型路由 bullet 2、可视化整节（仅 minimax）、脚本表 hooks 行（仅 zcode）。
- 7 对 agent：reviewer 正文完全一致（仅 frontmatter 不同）；pm/architect/backend-dev/frontend-dev/qa-engineer 仅 1~3 处措辞/工具名差异；browser-tester 差异较大（证据铁律块、操作方式整节、provider 枚举、工件目录输入项）。
- 3 个轻量技能应逐字节相同（重构后由生成保证）。
- `zcode/scripts/build.mjs` 已有可复用骨架：`fmOf`/`frontmatterErrors`（36–45 行）、`checkManifest`（86–103 行）、版本节奏校验（106–113 行）、`syncDir`（70–83 行）、scripts/templates 同步（47–83 行）；漂移报告（131–142 行）将被「生成一致性校验」取代。第 90–92 行 `lists` 是死代码，顺带删除。

## 目标结构

```text
shared/                                  # 唯一正文源（新增）
  skills/steward.body.md                 # 共享正文，含 @@SLOT@@ 标记
  skills/{systematic-debugging,tdd,verification-before-completion}/SKILL.md  # 整文件共享
  agents/<name>.body.md                  # 7 个 agent 共享正文
host/<zcode|minimax>/                    # 宿主片段（新增）
  skills/steward/{frontmatter,head,dispatch-call,concurrency-error,
                  explore-agent,hooks-row?,model-routing-dispatch,
                  model-default-line?,visualizer?,browser-model-note?}.md
  labels/{tavily,context7,web-fallback}.md   # 检索工具名标签，agent 与技能复用
  agents/<name>.frontmatter.md
  agents/browser-tester.{operation-methods,provider-enum,evidence-rule?}.md
```

**槽位协议**（build.mjs 实现，纯 Node 无依赖）：
- `@@SLOT:相对路径@@` → 必填，读 `host/<host>/<相对路径>.md`，缺失即报错；
- `@@SLOT?:相对路径@@` → 可选（empty 即删除整行），用于仅单宿主内容（visualizer、hooks 行、glm 注记、zcode 的 model 默认行、minimax 的证据铁律、zcode 的 evidence-rule 缺失）；
- 生成文件在 frontmatter 后插入一行生成标记：`<!-- 由 zcode/scripts/build.mjs 从 shared/ + host/<host>/ 生成，请勿手改 -->`；
- 渲染后输出不得残留 `@@SLOT`；生成目标路径不变（`zcode/`、`minimax/` 下原位），**plugin.json 与 commands 不动**。

**输出映射（22 个文件）**：
- `shared/skills/steward.body.md` + host frontmatter → `<host>/skills/steward/SKILL.md`
- `shared/skills/<name>/SKILL.md` → `<host>/skills/<name>/SKILL.md`（逐字节）
- `shared/agents/<name>.body.md` + host frontmatter → `<host>/agents/<name>.md`

**无害措辞归一**（避免为无意义差异建槽位）：两宿主统一为——名册/派单章节外的一切正文；「仓库根路径」输入项两边都保留；frontend i18n 措辞统一「词条齐全（缺词条是缺陷）」；QA 的 Context7 走 label 片段；维护/Bug/计划/演进小节标题统一为带命令的写法（如 `## 维护循环（/steward maintain，v0.6）`）。

## 改动文件

1. **新增** `shared/`（11 个文件）+ `host/zcode/`、`host/minimax/`（各约 20 个小片段）。
2. **改写** `zcode/scripts/build.mjs`：
   - 新渲染引擎（~70 行）：读 shared body → 递归替换槽位（行内/整行两种）→ 拼 frontmatter + 生成标记 → 与现有文件比对，`--check` 报差异文件、默认写入；解析失败/残留标记/缺必填槽位 → exit 1；
   - 保留并复用：scripts/hooks/templates 同步、`checkManifest`、`frontmatterErrors`、版本节奏校验；删除死代码与旧漂移报告；
   - 新增仓库布局守卫：无 `shared/` 或 `host/` → 明确报错「build.mjs 仅用于源码仓库」exit 2（minimax 安装副本运行时的友好失败）；
   - 同步到 `minimax/scripts/build.mjs`（沿用现有单一源同步）。
3. **重新生成** 22 个技能/agent 文件（内容与现状语义等价，仅归一措辞 + 生成标记）。
4. **版本**：`zcode/.zcode-plugin/plugin.json` 0.7.0→**0.7.1**、`minimax/.minimax-plugin/plugin.json` 1.5.0→**1.5.1**；README×4 与生成 banner 同步引用；版本节奏校验（0.x ↔ 1.(x-2)）保持通过。
5. **文档**：根 `README.md`（中英目录结构 + 维护者说明「改 shared/ 后跑 build.mjs」）、`CHANGELOG.md` 新增 0.7.1/1.5.1 条目、`docs/ROADMAP-STATUS.md` 项 16 → 已实现（证据引用 build 校验输出）、`docs/ROADMAP.md` 状态行补 P2 补记。

## 实施顺序

1. 快照现状：`tmp/pre-single-source/` 复制 16 个目标文件（22 个里 3 个轻量技能本来相同，也一并存）——用于生成后逐文件 diff。
2. 建 `shared/` 与 `host/` 片段（以现 zcode/minimax 文本为素材，按上述差异图拆槽）。
3. 改 build.mjs，跑生成。
4. 逐文件 diff 快照，确认：仅生成标记 + 计划内归一措辞变化；minimax 的模型表/派发方式/可视化/glm 注记完整保留；zcode 的 hooks 行保留；无内容丢失。
5. 版本与文档更新。

## 验证（全部真实命令 + exit code）

```bash
cd /e/CodeStore/plugins/dev-team
node zcode/scripts/build.mjs            # 生成 22 文件
node zcode/scripts/build.mjs --check    # 必须 PASS（幂等）
# 篡改测试：手改一个生成文件 → --check 必须 FAIL exit 1；重建后恢复
printf '\n手改' >> minimax/agents/pm.md && node zcode/scripts/build.mjs --check; echo "期望 exit=1"
node zcode/scripts/build.mjs && node zcode/scripts/build.mjs --check
# 既有门禁不回归
F=tmp/steward-fixtures/ledger-demo
node zcode/scripts/validate-config.mjs $F/steward.config.json
node zcode/scripts/validate-plan.mjs $F/.steward/bug-run/03-plan.json --root $F
node zcode/scripts/verify.mjs run --root $F
node zcode/scripts/maintain.mjs $F --skip-flaky
# 清单/frontmatter/版本节奏由 build --check 覆盖；额外确认 minimax skills 注册数仍为 5
node -e "console.log(require('./minimax/.minimax-plugin/plugin.json').version)"
```

## 提交（本地，不 push）

1. 先提交现状：`git add -A && git commit -m "feat: Steward 路线图 P0–P2（v0.5→v0.7.0）"`（45 个改动/新增）。
2. 再提交单一源化：`git add -A && git commit -m "refactor: 双宿主技能/agent 正文单一源化（build.mjs 生成）+ v0.7.1/1.5.1"`。
不 push、不改写历史。

## 风险与回滚

- **生成内容语义漂移**：以快照 diff 逐文件核对为门禁；发现缺失立即修槽位再生成。
- **构建脚本复杂度**：渲染引擎限定 ~70 行、零依赖；`--check` 覆盖全部生成文件，手改可发现。
- **回滚**：全部改动在工作区/本地提交；`git revert` 或 `git reset` 到第一个提交即可回到 P0–P2 状态；`shared/`、`host/` 为纯新增，删除不影响插件包。

## 不在本次范围

- 真实 M/L 需求演练批准门、UI 项目演练 browser-evidence.json、codemod 演练（需真实项目）。
- ZCode settings 挂载 hooks（用户环境操作）。
- 双语 README 正文合并（中英为有意双版），仅同步维护者说明。
