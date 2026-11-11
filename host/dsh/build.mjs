#!/usr/bin/env node
/**
 * DSH 侧 Steward 构建器（只作用于 DSH 侧）。
 *
 * 输入（只读）：
 *   - shared/skills/、shared/agents/            技能与角色共享正文（含 @@SLOT@@）
 *   - host/dsh/                                 DSH 宿主片段、插件代码、清单、locale、icon、roles.json
 *   - zcode/scripts/                            门禁脚本 / 模板 / 文档流水线参考库（只读复制）
 * 输出（唯一写入目标）：
 *   - dsh/                                      DSH 插件包（提交到仓库）
 *
 * 本脚本**不修改** zcode/、minimax/、shared/、zcode/scripts/：DSH 侧任务与另外两个宿主完全隔离。
 * 共享正文里少数 ZCode/MiniMax 事实（agent-config.mjs / build.mjs 脚本行、MCP 检索栈、
 * 可视化配置入口）在 DSH 输出里由本脚本按行替换，不改共享源。
 *
 * 用法：
 *   node host/dsh/build.mjs            # 同步包文件 + 渲染技能/角色 + 生成清单
 *   node host/dsh/build.mjs --check    # 只校验不写（不一致即 exit 1）
 *   node host/dsh/build.mjs --json     # 机读结果
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const here = import.meta.dirname ?? process.cwd();
const root = resolve(here, '..', '..');
const hostDir = here;
const shared = join(root, 'shared');
const zc = join(root, 'zcode');
const outDir = join(root, 'dsh');
const checkOnly = process.argv.includes('--check');
const asJson = process.argv.includes('--json');

if (!existsSync(shared) || !existsSync(zc)) {
  console.error('[dsh-build] 本脚本只用于 Steward 源码仓库构建（需要 shared/ 与 zcode/）；插件安装目录无需运行。');
  process.exit(2);
}

const AGENTS = ['pm', 'architect', 'backend-dev', 'frontend-dev', 'qa-engineer', 'browser-tester', 'reviewer'];
const LIGHT_SKILLS = ['systematic-debugging', 'tdd', 'verification-before-completion', 'using-steward', 'agent-settings'];
const SKIP_SCRIPTS = new Set(['agent-config.mjs', 'agent-config-core.mjs', 'trigger.mjs', 'build.mjs']);

const errors = [];
const warnings = [];
const synced = [];
const generated = [];
const targets = [];

function readText(p) {
  return existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null;
}

function fmOf(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

function fmField(fm, key) {
  const m = (fm ?? '').match(new RegExp(`^${key}:[ \\t]*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^(['"])(.*)\1$/, '$2') : '';
}

function frontmatterErrors(file, text) {
  const fm = fmOf(text);
  if (!fm) return [`[${file}] 缺 frontmatter（--- 块）`];
  const errs = [];
  if (!/^name:\s*\S/m.test(fm)) errs.push(`[${file}] frontmatter 缺 name`);
  if (!/^description:\s*\S/m.test(fm)) errs.push(`[${file}] frontmatter 缺 description`);
  return errs;
}

const BANNER = '<!-- 由 host/dsh/build.mjs 从 shared/ + host/dsh/ 生成，请勿手改；改源后重跑 node host/dsh/build.mjs。 -->';

function renderSlots(text, label) {
  const use = (slot, optional) => {
    const frag = readText(join(hostDir, `${slot}.md`));
    if (frag === null) {
      if (!optional) errors.push(`[render] ${label}：缺必填片段 host/dsh/${slot}.md`);
      return null;
    }
    return frag.replace(/\n+$/, '');
  };
  const lines = [];
  for (const line of text.split('\n')) {
    const only = line.match(/^\s*@@SLOT(\?)?:([^@]+)@@\s*$/);
    if (only) {
      const frag = use(only[2].trim(), Boolean(only[1]));
      if (frag) lines.push(frag);
      continue;
    }
    lines.push(line.replace(/@@SLOT(\?)?:([^@]+)@@/g, (m, q, slot) => use(slot.trim(), Boolean(q)) ?? ''));
  }
  const rendered = lines.join('\n');
  if (rendered.includes('@@SLOT')) errors.push(`[render] ${label}：渲染后仍残留 @@SLOT（片段内含槽位或标记写法错误）`);
  return rendered;
}

function assemble(fm, body) {
  const head = fm.replace(/\n+$/, '');
  const text = body.replace(/^\n+/, '').replace(/\n+$/, '');
  return `${head}\n\n${BANNER}\n\n${text}\n`;
}

function withBanner(fullText) {
  const m = fullText.match(/^---\n[\s\S]*?\n---\n/);
  if (!m) return `${BANNER}\n\n${fullText.replace(/^\n+/, '').replace(/\n+$/, '')}\n`;
  const head = m[0].replace(/\n+$/, '');
  const rest = fullText.slice(m[0].length).replace(/^\n+/, '').replace(/\n+$/, '');
  return `${head}\n\n${BANNER}\n\n${rest}\n`;
}

/**
 * 共享正文里属于 ZCode/MiniMax 事实、但 DSH 需要不同表述的行，在这里按行替换；
 * 只改 DSH 生成物，不改 shared/。
 */
function dshRewrite(text, label) {
  const lines = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('| `agent-config.mjs')) continue; // DSH 用原生设置页 / steward_config，没有该脚本
    if (line.startsWith('| `build.mjs')) continue; // DSH 构建器是 host/dsh/build.mjs，不随包提供
    if (line.startsWith('**检索工具栈（宿主 MCP')) {
      lines.push('**检索工具栈（DSH 宿主工具，团队全员继承可用）**：`web_search`（网页搜索）、`web_fetch`（抓取正文）、`research`（多来源证据包）、`platform_search`（GitHub / V2EX / B站 / Reddit 等站点内搜索）、`domain_search`（包 / 论文 / 漏洞 / 金融等垂直源）。各角色的查证纪律已写进自身提示词；这些工具不可用时如实标注「检索不可用」，不阻塞流程，不得凭记忆臆造 API。');
      continue;
    }
    if (line.includes('**可视化配置入口**')) {
      lines.push('- **可视化配置入口**：用户要「看得见、改得动」子代理的模型与思考强度时，加载 `steward:agent-settings` 技能（「设置 → Steward」页或 `steward_config` 工具）——**不要手改配置或 frontmatter**，也不要凭记忆写模型名（模型不存在会在派发时直接失败 `MODEL_SELECTION_INVALID`）。');
      continue;
    }
    lines.push(line);
  }
  if (lines.join('\n') === text) warnings.push(`[render] ${label}：DSH 行替换没有命中任何目标行（共享正文可能已改，检查 build.mjs 的 dshRewrite）`);
  return lines.join('\n');
}

/**
 * 角色正文里属于 ZCode/MiniMax 事实的检索纪律行（优先宿主 MCP / context7），
 * DSH 没有这些 MCP，按行替换成 DSH 原生检索与「读依赖源码」口径，保留原编号。
 */
function dshAgentRewrite(text) {
  const lines = [];
  for (const line of text.split('\n')) {
    if (line.includes('context7') || line.includes('宿主 MCP') || line.includes('MCP 不可用')) {
      const prefix = line.match(/^\s*\d+\.\s*/);
      lines.push(`${prefix === null ? '- ' : prefix[0]}库/框架 API 拿不准时先查证再写：优先读仓库既有用法与依赖源码（node_modules 类型定义），其次用 \`web_search\` / \`web_fetch\` 查官方文档或 \`research\` 做多来源核对——绝不凭记忆臆造 API；检索不可用时如实标注并直接读仓库。`);
      continue;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

// --- 1. 渲染技能 / 角色 ---
{
  const fm = readText(join(hostDir, 'skills/steward/frontmatter.md'));
  const body = readText(join(shared, 'skills/steward.body.md'));
  if (fm === null) errors.push('[render] 缺 host/dsh/skills/steward/frontmatter.md');
  if (body === null) errors.push('[render] 缺 shared/skills/steward.body.md');
  if (fm !== null && body !== null) {
    const rendered = renderSlots(body, 'skills/steward');
    targets.push({ out: join(outDir, 'skills/steward/SKILL.md'), text: assemble(fm, dshRewrite(rendered, 'skills/steward')) });
  }

  for (const s of LIGHT_SKILLS) {
    // 宿主可整体覆盖一个小技能（正文与入口是宿主事实，不适合槽位拼接）；否则用 shared 正文。
    const override = readText(join(hostDir, 'skills', s, 'SKILL.md'));
    const src = override ?? readText(join(shared, 'skills', s, 'SKILL.md'));
    if (src === null) { errors.push(`[render] 缺 shared/skills/${s}/SKILL.md`); continue; }
    targets.push({ out: join(outDir, 'skills', s, 'SKILL.md'), text: withBanner(renderSlots(src, `skills/${s}`)) });
  }

  for (const a of AGENTS) {
    const afm = readText(join(hostDir, 'agents', `${a}.frontmatter.md`));
    const abody = readText(join(shared, 'agents', `${a}.body.md`));
    if (afm === null) { errors.push(`[render] 缺 host/dsh/agents/${a}.frontmatter.md`); continue; }
    if (abody === null) { errors.push(`[render] 缺 shared/agents/${a}.body.md`); continue; }
    targets.push({ out: join(outDir, 'roles', `${a}.md`), text: assemble(afm, dshAgentRewrite(renderSlots(abody, `agents/${a}`))) });
  }
}

// --- 2. 包文件 / 脚本 / 模板 / 参考库：host/dsh 与 zcode 侧只读源 → dsh/ ---
function syncFile(src, dst, label, { binary = false } = {}) {
  if (!existsSync(src)) { errors.push(`[sync] 缺源文件 ${label}`); return; }
  const same = existsSync(dst) && (binary ? readFileSync(src).equals(readFileSync(dst)) : readFileSync(src, 'utf8') === readFileSync(dst, 'utf8'));
  if (same) return;
  if (checkOnly) { errors.push(`[sync] ${label} 与源不一致（跑 node host/dsh/build.mjs）`); return; }
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
  synced.push(`dsh/${label}`);
}

function syncDir(src, dst, label) {
  if (!existsSync(dst)) {
    if (checkOnly) errors.push(`[sync] ${label} 缺失（跑 node host/dsh/build.mjs）`);
    else mkdirSync(dst, { recursive: true });
  }
  for (const e of existsSync(src) ? readdirSync(src, { withFileTypes: true }) : []) {
    const s = join(src, e.name);
    const d = join(dst, e.name);
    if (e.isDirectory()) { syncDir(s, d, `${label}/${e.name}`); continue; }
    syncFile(s, d, `${label}/${e.name}`);
  }
}

for (const f of ['package.json', 'cordis.patch.yml', 'index.js', 'client.js', 'icon.svg']) {
  syncFile(join(hostDir, f), join(outDir, f), f);
}
for (const name of existsSync(join(hostDir, 'locale')) ? readdirSync(join(hostDir, 'locale')) : []) {
  if (!name.endsWith('.json')) continue;
  syncFile(join(hostDir, 'locale', name), join(outDir, 'locale', name), `locale/${name}`);
}
for (const f of readdirSync(join(zc, 'scripts')).filter((name) => name.endsWith('.mjs'))) {
  if (SKIP_SCRIPTS.has(f)) continue;
  syncFile(join(zc, 'scripts', f), join(outDir, 'scripts', f), `scripts/${f}`);
}
syncDir(join(zc, 'scripts', 'templates'), join(outDir, 'scripts', 'templates'), 'scripts/templates');
syncDir(join(zc, 'scripts', 'doc'), join(outDir, 'scripts', 'doc'), 'scripts/doc');
syncDir(join(zc, 'skills', 'steward', 'references'), join(outDir, 'skills', 'steward', 'references'), 'skills/steward/references');

// --- 3. 运行期清单（Host 插件读取） ---
function addManifest(rel, value) {
  targets.push({ out: join(outDir, rel), text: JSON.stringify(value, null, 2) + '\n' });
}

{
  const skills = [];
  const skillsRoot = join(outDir, 'skills');
  for (const name of existsSync(skillsRoot) ? readdirSync(skillsRoot) : []) {
    const file = join(skillsRoot, name, 'SKILL.md');
    if (!existsSync(file)) continue;
    const fm = fmOf(readText(file) ?? '');
    const skillName = fmField(fm, 'name') || name;
    const description = fmField(fm, 'description');
    if (skillName === '' || description === '') { errors.push(`[dsh] skills/${name}/SKILL.md 缺 name/description，无法生成运行期清单`); continue; }
    skills.push({ name: skillName, description, path: `skills/${name}/SKILL.md`, dir: `skills/${name}` });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  if (skills.length !== 6) errors.push(`[dsh] 技能清单应有 6 项，实际 ${skills.length} 项`);
  addManifest('skills/manifest.json', { version: 1, skills });

  let metaRoles = [];
  const rolesMeta = readText(join(hostDir, 'roles.json'));
  if (rolesMeta === null) {
    errors.push('[dsh] 缺 host/dsh/roles.json');
  } else {
    try {
      metaRoles = JSON.parse(rolesMeta).roles ?? [];
    } catch (e) {
      errors.push(`[dsh] host/dsh/roles.json JSON 解析失败：${e.message}`);
    }
  }
  const metaIds = metaRoles.map((role) => role.id);
  for (const a of AGENTS) if (!metaIds.includes(a)) errors.push(`[dsh] host/dsh/roles.json 缺角色 ${a}`);
  for (const id of metaIds) if (!AGENTS.includes(id)) errors.push(`[dsh] host/dsh/roles.json 出现未知角色 ${id}`);
  if (new Set(metaIds).size !== metaIds.length) errors.push('[dsh] host/dsh/roles.json 角色 id 重复');
  const roles = [];
  for (const a of AGENTS) {
    const meta = metaRoles.find((role) => role.id === a) ?? {};
    const fm = fmOf(readText(join(hostDir, 'agents', `${a}.frontmatter.md`)) ?? '');
    const name = fmField(fm, 'name') || a;
    if (name !== a) errors.push(`[dsh] host/dsh/agents/${a}.frontmatter.md 的 name（${name}）必须等于角色 id`);
    if (typeof meta.title !== 'string' || meta.title === '') errors.push(`[dsh] roles.json 角色 ${a} 缺 title`);
    if (typeof meta.summary !== 'string' || meta.summary === '') errors.push(`[dsh] roles.json 角色 ${a} 缺 summary`);
    roles.push({ id: a, name: meta.title ?? a, description: meta.summary ?? '', path: `roles/${a}.md` });
  }
  addManifest('roles/manifest.json', { version: 1, roles });
}

// --- 4. 写入渲染 / 清单目标并校验 ---
for (const t of targets) {
  if (readText(t.out) === t.text) continue;
  const rel = t.out.slice(root.length + 1).replace(/\\/g, '/');
  if (checkOnly) { errors.push(`[render] ${rel} 与生成结果不一致（手改或未重建；跑 node host/dsh/build.mjs）`); continue; }
  mkdirSync(dirname(t.out), { recursive: true });
  writeFileSync(t.out, t.text, 'utf8');
  generated.push(rel);
}

// frontmatter 校验（DSH 全部技能与角色）
for (const name of existsSync(join(outDir, 'skills')) ? readdirSync(join(outDir, 'skills')) : []) {
  const file = join(outDir, 'skills', name, 'SKILL.md');
  if (existsSync(file)) errors.push(...frontmatterErrors(`dsh/skills/${name}`, readFileSync(file, 'utf8')));
}
for (const f of existsSync(join(outDir, 'roles')) ? readdirSync(join(outDir, 'roles')).filter((x) => x.endsWith('.md')) : []) {
  errors.push(...frontmatterErrors(`dsh/roles/${f}`, readFileSync(join(outDir, 'roles', f), 'utf8')));
}

// 包契约（DSH 宿主可加载性）
{
  let pkg = null;
  try {
    pkg = JSON.parse(readFileSync(join(outDir, 'package.json'), 'utf8'));
  } catch (e) {
    errors.push(`[dsh] dsh/package.json 解析失败：${e.message}`);
  }
  if (pkg !== null) {
    if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') errors.push('[dsh] package.json 的 dsh.bundle.patch 必须是 ./cordis.patch.yml');
    if (pkg.dsh?.client?.platform !== 'web') errors.push('[dsh] package.json 的 dsh.client.platform 必须是 web');
    for (const sub of ['./client', './locale/*.json', './icon']) {
      if (pkg.exports?.[sub] === undefined) errors.push(`[dsh] package.json exports 缺 ${sub}`);
    }
    for (const f of ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg', 'locale/en.json', 'locale/zh.json']) {
      if (!existsSync(join(outDir, f))) errors.push(`[dsh] 缺运行期文件 ${f}`);
    }
    const icon = join(outDir, 'icon.svg');
    if (existsSync(icon)) {
      if (statSync(icon).size > 256 * 1024) errors.push('[dsh] icon.svg 超过 256 KiB（宿主会拒绝）');
      if (!/^\s*<svg[\s>]/.test(readText(icon) ?? '')) errors.push('[dsh] icon.svg 不是 SVG 根元素');
    }
    for (const loc of ['en', 'zh']) {
      let json = null;
      try {
        json = JSON.parse(readFileSync(join(outDir, 'locale', `${loc}.json`), 'utf8'));
      } catch (e) {
        errors.push(`[dsh] locale/${loc}.json 解析失败：${e.message}`);
      }
      if (json !== null && (typeof json.meta?.title !== 'string' || json.meta.title === '' || typeof json.meta?.description !== 'string' || json.meta.description === '')) {
        errors.push(`[dsh] locale/${loc}.json 必须含 meta.title 与 meta.description`);
      }
    }
    const patch = readText(join(outDir, 'cordis.patch.yml')) ?? '';
    if (!patch.includes(`name: ${pkg.name}`)) errors.push(`[dsh] cordis.patch.yml 未插入 name: ${pkg.name} 的 row`);
    if (typeof pkg.version !== 'string' || pkg.version === '') errors.push('[dsh] package.json 缺 version');
    if (typeof pkg.peerDependencies?.['@deepseek-ai/schemastery'] !== 'string') {
      errors.push('[dsh] package.json 必须声明 @deepseek-ai/schemastery peerDependency（原生 Config 需要）');
    }
    if (!Array.isArray(pkg.dsh?.client?.inject) || !pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-settings')) {
      errors.push('[dsh] package.json dsh.client.inject 必须包含 @deepseek-ai/dsh-client-ui-settings（configForms）');
    }
  }
}

// DSH 原生机制契约：宿主半用 Agent Presets / Config / 原生命令，客户端半用 configForms。
{
  const host = readText(join(outDir, 'index.js')) ?? '';
  const client = readText(join(outDir, 'client.js')) ?? '';
  for (const [needle, label] of [
    ['agentPresets', 'ctx.agentPresets（角色 Agent Presets）'],
    ['export const Config', '原生 Config（设置命名空间 steward）'],
    ['settings.update', '原生设置持久化'],
    ['commands.register', '原生人类命令注册'],
    ['skills.register', '原生技能注册'],
    ['agentPreset', '派发时选择 agent preset'],
  ]) {
    if (!host.includes(needle)) errors.push(`[dsh] index.js 缺少 ${label}`);
  }
  if (host.includes('webServer') || host.includes('/api/dsh-steward')) {
    errors.push('[dsh] index.js 仍含自定义 HTTP 桥（webServer / /api/dsh-steward）；DSH 侧应使用原生 settings/configForms');
  }
  if (!client.includes('configForms')) errors.push('[dsh] client.js 必须通过 configForms 读写原生设置');
  if (client.includes('/api/dsh-steward')) errors.push('[dsh] client.js 仍含自定义 HTTP 桥；应改用 configForms');
}

// --- 5. 输出 ---
const result = { ok: errors.length === 0, errors, warnings, synced, generated };
if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  if (synced.length && !checkOnly) console.log(`[dsh-build] 已同步 ${synced.length} 个包文件/脚本/模板/参考库文件：\n  ${synced.join('\n  ')}`);
  if (generated.length) console.log(`[dsh-build] 已生成 ${generated.length} 个技能/角色/清单文件：\n  ${generated.join('\n  ')}`);
  for (const w of warnings) console.log(`[dsh-build] ⚠ ${w}`);
  if (errors.length) {
    console.error(`[dsh-build] FAIL — ${errors.length} 个错误：`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log(`[dsh-build] PASS — DSH 包${checkOnly ? '校验' : '构建'}完成：包文件同步、技能/角色渲染、运行期清单与包契约合法（未触碰 ZCode / MiniMax / shared）`);
}
