#!/usr/bin/env node
/**
 * build.mjs — Steward 双宿主构建与校验（本地脚本，不做 CI）。
 *
 * 单一正文源（v0.7.1）：
 *   - 脚本 / 模板：`zcode/scripts/` 是唯一正文源，`minimax/scripts/` 由本脚本同步。
 *   - 技能 / agent 正文：`shared/` 是唯一正文；宿主差异（frontmatter、派发机制、工具名、
 *     模型表、浏览器操作方式等）放 `host/<host>/` 片段；本脚本渲染出两版并校验一致性。
 *   - 生成物带「请勿手改」标记；`--check` 会发现手改/未重建并报错。
 *
 * 槽位协议（写在 shared 正文里）：
 *   @@SLOT:相对路径@@   必填片段 → host/<host>/<相对路径>.md（缺失即报错）
 *   @@SLOT?:相对路径@@  可选片段（缺失或为空则删除该行）
 *
 * 用法：
 *   node zcode/scripts/build.mjs            # 同步 scripts + 渲染 22 个技能/agent 文件
 *   node zcode/scripts/build.mjs --check    # 只校验不写（不一致即 exit 1）
 *   node zcode/scripts/build.mjs --json     # 机读结果
 *
 * 退出码：0 = 通过；1 = 校验/渲染错误；2 = 不在源码仓库布局内运行。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// 本脚本位于 <仓库根>/zcode/scripts/build.mjs（minimax/scripts/ 副本同理），仓库根为上两级
const root = resolve(import.meta.dirname ?? process.cwd(), '..', '..');
const zc = join(root, 'zcode');
const mx = join(root, 'minimax');
const shared = join(root, 'shared');
const hostsRoot = join(root, 'host');
const checkOnly = process.argv.includes('--check');
const asJson = process.argv.includes('--json');

if (!existsSync(shared) || !existsSync(hostsRoot)) {
  console.error('[build] 本脚本只用于 Steward 源码仓库构建（需要 shared/ 与 host/）；插件安装目录无需运行。');
  process.exit(2);
}

const errors = [];
const warnings = [];
const synced = [];
const generated = [];

function fmOf(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

function frontmatterErrors(file, text, { needName = true, hostMx = false } = {}) {
  const fm = fmOf(text);
  if (!fm) return [`[${file}] 缺 frontmatter（--- 块）`];
  const errs = [];
  if (needName && !/^name:\s*\S/m.test(fm)) errs.push(`[${file}] frontmatter 缺 name`);
  if (!/^description:\s*\S/m.test(fm)) errs.push(`[${file}] frontmatter 缺 description`);
  if (hostMx && /^color:/m.test(fm)) errs.push(`[${file}] MiniMax agent 不应有 color 字段`);
  if (hostMx && /^tools:\s*\[[^\]]*[A-Z]/m.test(fm)) errs.push(`[${file}] MiniMax agent tools 应为小写原生工具名`);
  return errs;
}

function readText(p) {
  return existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null;
}

// --- 1. 脚本与模板：单一正文源同步 ---
const scriptFiles = readdirSync(join(zc, 'scripts')).filter((f) => f.endsWith('.mjs'));
for (const f of scriptFiles) {
  const src = join(zc, 'scripts', f);
  const dst = join(mx, 'scripts', f);
  if (!existsSync(dst) || readFileSync(src, 'utf8') !== readFileSync(dst, 'utf8')) {
    if (checkOnly) errors.push(`[scripts] minimax/scripts/${f} 与 zcode 版不一致（单一正文源被破坏，跑 node zcode/scripts/build.mjs 同步）`);
    else { copyFileSync(src, dst); synced.push(`minimax/scripts/${f}`); }
  }
}
// scripts/hooks/ 子目录同样纳入单一正文源
{
  const hSrc = join(zc, 'scripts', 'hooks');
  const hDst = join(mx, 'scripts', 'hooks');
  if (!existsSync(hDst)) { if (checkOnly) errors.push('[scripts] minimax/scripts/hooks 缺失'); else mkdirSync(hDst, { recursive: true }); }
  for (const f of existsSync(hSrc) ? readdirSync(hSrc).filter((x) => x.endsWith('.mjs')) : []) {
    const s = join(hSrc, f); const d = join(hDst, f);
    if (!existsSync(d) || readFileSync(s, 'utf8') !== readFileSync(d, 'utf8')) {
      if (checkOnly) errors.push(`[scripts] minimax/scripts/hooks/${f} 与 zcode 版不一致`);
      else { copyFileSync(s, d); synced.push(`minimax/scripts/hooks/${f}`); }
    }
  }
}
const tplSrc = join(zc, 'scripts', 'templates');
const tplDst = join(mx, 'scripts', 'templates');
function syncDir(src, dst, label) {
  if (!existsSync(dst)) { if (checkOnly) errors.push(`[templates] ${label} 缺失`); else mkdirSync(dst, { recursive: true }); }
  for (const e of existsSync(src) ? readdirSync(src, { withFileTypes: true }) : []) {
    const s = join(src, e.name); const d = join(dst, e.name);
    if (e.isDirectory()) { syncDir(s, d, `${label}/${e.name}`); continue; }
    if (!existsSync(d) || readFileSync(s, 'utf8') !== readFileSync(d, 'utf8')) {
      if (checkOnly) errors.push(`[templates] ${label}/${e.name} 与 zcode 版不一致`);
      else { copyFileSync(s, d); synced.push(`${label}/${e.name}`); }
    }
  }
}
syncDir(tplSrc, tplDst, 'minimax/scripts/templates');

// --- 2. 渲染引擎：shared/ + host/<host>/ → 技能与 agent 两版 ---
const bannerOf = (host) => `<!-- 由 zcode/scripts/build.mjs 从 shared/ + host/${host}/ 生成，请勿手改；改源后重跑 build.mjs。 -->`;

function renderSlots(text, host, label) {
  const hostDir = join(hostsRoot, host);
  const use = (slot, optional) => {
    const frag = readText(join(hostDir, `${slot}.md`));
    if (frag === null) {
      if (!optional) errors.push(`[render] ${label}：缺必填片段 host/${host}/${slot}.md`);
      return null;
    }
    return frag.replace(/\n+$/, '');
  };
  const out = [];
  for (const line of text.split('\n')) {
    const only = line.match(/^\s*@@SLOT(\?)?:([^@]+)@@\s*$/);
    if (only) {
      const frag = use(only[2].trim(), Boolean(only[1]));
      if (frag) out.push(frag);
      continue;
    }
    out.push(line.replace(/@@SLOT(\?)?:([^@]+)@@/g, (m, q, slot) => use(slot.trim(), Boolean(q)) ?? ''));
  }
  const rendered = out.join('\n');
  if (rendered.includes('@@SLOT')) errors.push(`[render] ${label}：渲染后仍残留 @@SLOT（片段内含槽位或标记写法错误）`);
  return rendered;
}

function assemble(fm, host, body) {
  const head = fm.replace(/\n+$/, '');
  const text = body.replace(/^\n+/, '').replace(/\n+$/, '');
  return `${head}\n\n${bannerOf(host)}\n\n${text}\n`;
}

function withBanner(fullText, host) {
  const m = fullText.match(/^---\n[\s\S]*?\n---\n/);
  if (!m) return `${bannerOf(host)}\n\n${fullText.replace(/^\n+/, '').replace(/\n+$/, '')}\n`;
  const head = m[0].replace(/\n+$/, '');
  const rest = fullText.slice(m[0].length).replace(/^\n+/, '').replace(/\n+$/, '');
  return `${head}\n\n${bannerOf(host)}\n\n${rest}\n`;
}

const LIGHT_SKILLS = ['systematic-debugging', 'tdd', 'verification-before-completion'];
const AGENTS = ['pm', 'architect', 'backend-dev', 'frontend-dev', 'qa-engineer', 'browser-tester', 'reviewer'];
const targets = [];

for (const host of ['zcode', 'minimax']) {
  const hostDir = join(hostsRoot, host);      // 宿主片段（构建输入）
  const pluginDir = host === 'zcode' ? zc : mx; // 插件包（生成物落点）

  const fm = readText(join(hostDir, 'skills/steward/frontmatter.md'));
  const bodyRaw = readText(join(root, 'shared/skills/steward.body.md'));
  if (fm === null) errors.push(`[render] 缺 host/${host}/skills/steward/frontmatter.md`);
  if (bodyRaw === null) errors.push('[render] 缺 shared/skills/steward.body.md');
  if (fm !== null && bodyRaw !== null) {
    targets.push({
      out: join(pluginDir, 'skills/steward/SKILL.md'),
      text: assemble(fm, host, renderSlots(bodyRaw, host, `skills/steward (${host})`)),
    });
  }

  for (const s of LIGHT_SKILLS) {
    const src = readText(join(root, 'shared/skills', s, 'SKILL.md'));
    if (src === null) { errors.push(`[render] 缺 shared/skills/${s}/SKILL.md`); continue; }
    targets.push({ out: join(pluginDir, 'skills', s, 'SKILL.md'), text: withBanner(src, host) });
  }

  for (const a of AGENTS) {
    const afm = readText(join(hostDir, 'agents', `${a}.frontmatter.md`));
    const abody = readText(join(root, 'shared/agents', `${a}.body.md`));
    if (afm === null) { errors.push(`[render] 缺 host/${host}/agents/${a}.frontmatter.md`); continue; }
    if (abody === null) { errors.push(`[render] 缺 shared/agents/${a}.body.md`); continue; }
    targets.push({
      out: join(pluginDir, 'agents', `${a}.md`),
      text: assemble(afm, host, renderSlots(abody, host, `agents/${a} (${host})`)),
    });
  }
}

for (const t of targets) {
  const existing = readText(t.out);
  if (existing === t.text) continue;
  const rel = t.out.slice(root.length + 1);
  if (checkOnly) errors.push(`[render] ${rel} 与生成结果不一致（手改或未重建；跑 node zcode/scripts/build.mjs）`);
  else { writeFileSync(t.out, t.text, 'utf8'); generated.push(rel); }
}

// --- 3. 清单校验（plugin.json 列表与磁盘一致 + 版本节奏） ---
function checkManifest(manifestPath, base, { hasSkillsArray, hasAgentsArray, hasCommands }) {
  if (!existsSync(manifestPath)) { errors.push(`[manifest] 缺 ${manifestPath}`); return null; }
  let m;
  try { m = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch (e) { errors.push(`[manifest] ${manifestPath} JSON 解析失败：${e.message}`); return null; }
  if (hasSkillsArray) {
    for (const s of m.skills ?? []) if (!existsSync(join(base, s))) errors.push(`[manifest] ${manifestPath} 列出的技能不存在：${s}`);
    const onDisk = readdirSync(join(base, 'skills')).filter((d) => existsSync(join(base, 'skills', d, 'SKILL.md'))).map((d) => `skills/${d}/SKILL.md`);
    for (const s of onDisk) if (!(m.skills ?? []).includes(s)) warnings.push(`[manifest] ${manifestPath} 磁盘上有技能但未列出：${s}`);
  }
  if (hasAgentsArray) {
    for (const a of m.agents ?? []) if (!existsSync(join(base, a))) errors.push(`[manifest] ${manifestPath} 列出的 agent 不存在：${a}`);
  }
  if (hasCommands && m.commands && !existsSync(join(base, m.commands))) errors.push(`[manifest] commands 目录不存在：${m.commands}`);
  return m;
}
const zm = checkManifest(join(zc, '.zcode-plugin', 'plugin.json'), zc, { hasSkillsArray: false, hasAgentsArray: false, hasCommands: true });
const mm = checkManifest(join(mx, '.minimax-plugin', 'plugin.json'), mx, { hasSkillsArray: true, hasAgentsArray: true, hasCommands: false });
if (zm && mm) {
  // 版本节奏：ZCode 0.x.y ↔ MiniMax 1.(x-2).y（0.7.0↔1.5.0、0.7.1↔1.5.1）
  const zv = /^0\.(\d+)\.(\d+)/.exec(zm.version);
  const mv = /^1\.(\d+)\.(\d+)/.exec(mm.version);
  if (zv && mv && (Number(mv[1]) !== Number(zv[1]) - 2 || Number(mv[2]) !== Number(zv[2]))) {
    warnings.push(`[manifest] 两宿主版本为 ZCode ${zm.version} / MiniMax ${mm.version}，不符合版本节奏（期望 1.${Number(zv[1]) - 2}.${zv[2]}）`);
  }
}

// --- 3.5 hooks.json 校验（事件名白名单 + JSON 合法） ---
const HOOK_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'PostToolUseFailure', 'Stop'];
for (const p of [join(zc, 'hooks', 'hooks.json'), join(mx, 'hooks', 'hooks.json')]) {
  if (!existsSync(p)) continue;
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    for (const e of Object.keys(j.hooks ?? {})) if (!HOOK_EVENTS.includes(e)) errors.push(`[hooks] ${p} 含不支持的事件名：${e}`);
  } catch (e) {
    errors.push(`[hooks] ${p} JSON 解析失败：${e.message}`);
  }
}

// --- 4. frontmatter 校验（双宿主全部技能与 agent，含生成物） ---
for (const [label, base, hostMx] of [['zcode', zc, false], ['minimax', mx, true]]) {
  for (const d of readdirSync(join(base, 'skills'))) {
    const p = join(base, 'skills', d, 'SKILL.md');
    if (existsSync(p)) errors.push(...frontmatterErrors(`${label}/skills/${d}`, readFileSync(p, 'utf8')));
  }
  for (const f of readdirSync(join(base, 'agents')).filter((x) => x.endsWith('.md'))) {
    errors.push(...frontmatterErrors(`${label}/agents/${f}`, readFileSync(join(base, 'agents', f), 'utf8'), { hostMx }));
  }
}

// --- 5. 输出 ---
const result = { ok: errors.length === 0, errors, warnings, synced, generated };
if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  if (synced.length && !checkOnly) console.log(`[build] 已同步 ${synced.length} 个脚本/模板文件到 minimax/scripts/：\n  ${synced.join('\n  ')}`);
  if (generated.length) console.log(`[build] 已生成 ${generated.length} 个技能/agent 文件：\n  ${generated.join('\n  ')}`);
  for (const w of warnings) console.log(`[build] ⚠ ${w}`);
  if (errors.length) {
    console.error(`[build] FAIL — ${errors.length} 个错误：`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log(`[build] PASS — 单一正文源${checkOnly ? '校验' : '同步+渲染'}完成：scripts/templates 同源、技能/agent 生成一致、frontmatter 与清单合法`);
}
