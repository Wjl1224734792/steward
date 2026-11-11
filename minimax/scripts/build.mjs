#!/usr/bin/env node
/**
 * build.mjs — Steward 双宿主构建与校验（本地脚本，不做 CI）。
 *
 * 单一正文源（v0.7.1）：
 *   - 脚本 / 模板 / 文档流水线参考库：`zcode/` 侧是唯一正文源，`minimax/` 由本脚本同步。
 *   - 技能 / agent 正文：`shared/` 是唯一正文；宿主差异（frontmatter、派发机制、工具名、
 *     模型表、浏览器操作方式等）放 `host/<host>/` 片段；本脚本渲染出两版并校验一致性。
 *   - Mini App 载荷（v0.9.0）：`host/minimax/miniapp/` 是唯一正文源，整体同步到 `minimax/miniapp/`；
 *     `host/minimax/package.json` 同步到包根 `minimax/package.json`。ZCode 宿主没有 Mini App 能力，
 *     所以 `zcode/` 侧**不同步** miniapp。
 *   - 生成物带「请勿手改」标记；`--check` 会发现手改/未重建并报错。
 *
 * 槽位协议（写在 shared 正文里）：
 *   @@SLOT:相对路径@@   必填片段 → host/<host>/<相对路径>.md（缺失即报错）
 *   @@SLOT?:相对路径@@  可选片段（缺失或为空则删除该行）
 *
 * 用法：
 *   node zcode/scripts/build.mjs            # 同步 scripts/templates/references + Mini App 载荷 + 渲染 24 个技能/agent 文件
 *   node zcode/scripts/build.mjs --check    # 只校验不写（不一致即 exit 1）
 *   node zcode/scripts/build.mjs --json     # 机读结果
 *
 * 退出码：0 = 通过；1 = 校验/渲染错误；2 = 不在源码仓库布局内运行。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

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
// 文档流水线的本地脚本与参考库同样纳入单一正文源（v0.8.0 起双宿主共享）
syncDir(join(zc, 'scripts', 'doc'), join(mx, 'scripts', 'doc'), 'minimax/scripts/doc');
syncDir(join(zc, 'skills', 'steward', 'references'), join(mx, 'skills', 'steward', 'references'), 'minimax/skills/steward/references');

// --- 1.2 Mini App 载荷（v0.9.0）：host/minimax/miniapp/ → minimax/miniapp/，package.json → 包根 ---
// ZCode 宿主没有 Mini App 能力，zcode/ 侧不做同步。
{
  const SYNC_HINT = '跑 node zcode/scripts/build.mjs 同步';
  const miniSrc = join(hostsRoot, 'minimax', 'miniapp');
  const miniDst = join(mx, 'miniapp');
  if (!existsSync(miniSrc)) {
    errors.push('[miniapp] 缺源目录 host/minimax/miniapp/（Mini App 载荷的唯一正文源）');
  } else if (!existsSync(miniDst) && checkOnly) {
    errors.push(`[miniapp] minimax/miniapp 缺失（${SYNC_HINT}）`);
  }
  if (existsSync(miniSrc)) {
    // 递归同步；src 是唯一正文源，dst 里多出来的文件说明有人绕过源直接加文件，一并报错。
    const walkMini = (src, dst, label) => {
      if (!existsSync(dst)) {
        if (checkOnly) { errors.push(`[miniapp] ${label} 缺失（${SYNC_HINT}）`); return; }
        mkdirSync(dst, { recursive: true });
      }
      for (const e of readdirSync(src, { withFileTypes: true })) {
        const s = join(src, e.name);
        const d = join(dst, e.name);
        if (e.isDirectory()) { walkMini(s, d, `${label}/${e.name}`); continue; }
        if (!existsSync(d) || readFileSync(s, 'utf8') !== readFileSync(d, 'utf8')) {
          if (checkOnly) errors.push(`[miniapp] ${label}/${e.name} 与 host/minimax 源不一致（${SYNC_HINT}）`);
          else { copyFileSync(s, d); synced.push(`minimax/${label}/${e.name}`); }
        }
      }
    };
    walkMini(miniSrc, miniDst, 'miniapp');
  }
  const pkgSrc = join(hostsRoot, 'minimax', 'package.json');
  const pkgDst = join(mx, 'package.json');
  if (!existsSync(pkgSrc)) {
    errors.push('[miniapp] 缺源文件 host/minimax/package.json（Mini App 入口声明）');
  } else if (!existsSync(pkgDst) || readFileSync(pkgSrc, 'utf8') !== readFileSync(pkgDst, 'utf8')) {
    if (checkOnly) errors.push(`[miniapp] minimax/package.json 与 host/minimax/package.json 不一致（${SYNC_HINT}）`);
    else { copyFileSync(pkgSrc, pkgDst); synced.push('minimax/package.json'); }
  }
}

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

const LIGHT_SKILLS = ['systematic-debugging', 'tdd', 'verification-before-completion', 'using-steward', 'agent-settings'];
const AGENTS = ['pm', 'architect', 'backend-dev', 'frontend-dev', 'qa-engineer', 'browser-tester', 'reviewer'];
// 官方契约的思考强度白名单（大小写敏感）；effort 只在同时声明 model 时生效。
const EFFORT_VALUES = ['default', 'off', 'on', 'none', 'low', 'medium', 'high', 'xhigh', 'max'];
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
    targets.push({ out: join(pluginDir, 'skills', s, 'SKILL.md'), text: withBanner(renderSlots(src, host, `skills/${s} (${host})`), host) });
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
  else { mkdirSync(dirname(t.out), { recursive: true }); writeFileSync(t.out, t.text, 'utf8'); generated.push(rel); }
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
  // 版本：两宿主同号发布，直接比较清单 version 字段
  if (zm.version !== mm.version) {
    warnings.push(`[manifest] 两宿主版本不一致：ZCode ${zm.version} / MiniMax ${mm.version}（期望一致）`);
  }
}

// --- 3.2 MiniMax 包路径契约（宿主要求包内路径全 ASCII，违反则整包被拒载入） ---
{
  const SEGMENT = /^[A-Za-z0-9._-]+$/;
  const bad = [];
  const walkPkg = (dir, rel = '') => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walkPkg(p, r);
      else {
        if (!/^[\x00-\x7f]*$/.test(r)) { bad.push('非 ASCII 路径: ' + r); continue; }
        for (const seg of r.split('/')) if (!SEGMENT.test(seg)) { bad.push('路径段不合规: ' + r); break; }
      }
    }
  };
  walkPkg(join(mx, 'skills'));
  walkPkg(join(mx, 'agents'));
  walkPkg(join(mx, 'scripts'));
  walkPkg(join(mx, 'hooks'));
  // Mini App 载荷同理：路径里出现中文/全角字符会让整包被宿主拒绝载入。
  walkPkg(join(mx, 'miniapp'));
  for (const e of readdirSync(mx, { withFileTypes: true })) {
    if (e.isFile() && !/^[\x00-\x7f]*$/.test(e.name)) bad.push('非 ASCII 文件名: ' + e.name);
  }
  for (const b2 of bad) errors.push('[package] minimax 包路径不合规（宿主会拒绝整个包）: ' + b2);
}

// --- 3.5 hooks.json 校验（事件名白名单 + JSON 合法 + matcher 取值） ---
const HOOK_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'PostToolUseFailure', 'Stop'];
// 各宿主 PreToolUse/PermissionRequest 的 matcher 只能匹配**精确的原生工具名**（大小写敏感）：
// MiniMax 用小写原生名（bash / read / write / edit / task），ZCode 用其宿主原生名（Bash / Read / Write / Edit）。
// matcher 写错不会报错、只会永不触发——属于静默失效，必须在构建期拦住。
const HOOK_TOOL_NAMES = {
  zcode: new Set(['Bash', 'Read', 'Write', 'Edit', 'Agent', 'Glob', 'Grep', 'Task']),
  minimax: new Set(['bash', 'read', 'write', 'edit', 'task', 'glob', 'grep']),
};
for (const [label, pkgDir] of [['zcode', zc], ['minimax', mx]]) {
  const p = join(pkgDir, 'hooks', 'hooks.json');
  if (!existsSync(p)) continue;
  let j;
  try {
    j = JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    errors.push(`[hooks] ${p} JSON 解析失败：${e.message}`);
    continue;
  }
  for (const e of Object.keys(j.hooks ?? {})) if (!HOOK_EVENTS.includes(e)) errors.push(`[hooks] ${p} 含不支持的事件名：${e}`);
  const allowed = HOOK_TOOL_NAMES[label];
  for (const group of j.hooks?.PreToolUse ?? []) {
    if (!group.matcher) continue;
    for (const raw of String(group.matcher).split('|')) {
      const name = raw.trim();
      if (!name) continue;
      if (!allowed.has(name)) {
        errors.push(`[hooks] ${p} 的 matcher 含无效工具名「${name}」（${label} 宿主只接受：${[...allowed].join(' / ')}）；写错不会报错、只会永不触发`);
      }
    }
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

// --- 4.2 MiniMax agent 的 model / effort 契约（v0.9.0） ---
// 官方契约：effort 只在同时声明 model 时生效；模型名必须是 provider/model；
// effort 只能取白名单值（大小写敏感），未知档位会让派发失败。
{
  const agentDir = join(hostsRoot, 'minimax', 'agents');
  for (const a of AGENTS) {
    const file = `host/minimax/agents/${a}.frontmatter.md`;
    const text = readText(join(agentDir, `${a}.frontmatter.md`));
    if (text === null) continue; // 缺文件已在渲染段报错
    const fm = fmOf(text);
    if (!fm) continue; // 缺 frontmatter 已在 4 段报错
    const modelLine = fm.match(/^model:[ \t]*(.+)$/m);
    const effortLine = fm.match(/^effort:[ \t]*(.+)$/m);
    const unquote = (v) => v.trim().replace(/^(['"])(.*)\1$/, '$2').trim();
    if (modelLine) {
      const model = unquote(modelLine[1]);
      if (!model.includes('/') || model.startsWith('/') || model.endsWith('/')) {
        errors.push(`[${file}] model 必须是 provider/model 形态（含且不含多余 '/'），实际：${JSON.stringify(model)}`);
      }
    }
    if (effortLine) {
      const effort = unquote(effortLine[1]);
      if (!modelLine) errors.push(`[${file}] 有 effort 但没有 model：官方契约要求 effort 只随 model 生效`);
      if (!EFFORT_VALUES.includes(effort)) {
        errors.push(`[${file}] effort 取值不在白名单（${EFFORT_VALUES.join(', ')}），实际：${JSON.stringify(effort)}`);
      }
    }
  }
}

// --- 4.3 名册表 ↔ agent frontmatter 一致性（只对 MiniMax 宿主） ---
// 名册（skills/steward/roster.md 的「模型分配」表）与 frontmatter 是同一事实的两处写法，
// 手工改一处就会漂移，所以逐角色机检。表格式：| `steward:<role>` | `model` | `effort` | ... |
{
  const rosterPath = join(hostsRoot, 'minimax', 'skills', 'steward', 'roster.md');
  const roster = readText(rosterPath);
  if (roster === null) {
    errors.push('[roster] 缺 host/minimax/skills/steward/roster.md');
  } else {
    const rows = new Map(); // role -> { model, effort }
    let inTable = false;
    for (const line of roster.split('\n')) {
      const trimmed = line.trim();
      if (!inTable) {
        if (/^###\s*模型分配/.test(trimmed)) inTable = true;
        continue;
      }
      if (!trimmed.startsWith('|')) {
        if (trimmed === '') continue;
        break; // 表格结束
      }
      const cells = trimmed.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const roleCell = cells[0] ?? '';
      if (!/^`steward:[A-Za-z0-9._-]+`$/.test(roleCell)) continue; // 表头与分隔行
      const role = roleCell.slice(1, -1).slice('steward:'.length);
      const unquote = (v) => (v ?? '').replace(/^`(.*)`$/, '$1').trim();
      rows.set(role, { model: unquote(cells[1]), effort: unquote(cells[2]) });
    }
    if (rows.size === 0) errors.push('[roster] 没在 host/minimax/skills/steward/roster.md 的「模型分配」表里解析到任何角色行');
    for (const [role, row] of rows) {
      if (!AGENTS.includes(role)) { errors.push(`[roster] 名册表出现未知角色：「steward:${role}」不在 ${AGENTS.join('/')} 之内`); continue; }
      const text = readText(join(hostsRoot, 'minimax', 'agents', `${role}.frontmatter.md`));
      const fm = text === null ? null : fmOf(text);
      if (!fm) { errors.push(`[roster] 无法读取 host/minimax/agents/${role}.frontmatter.md 的 frontmatter，无法比对名册表`); continue; }
      const unquote = (v) => v.trim().replace(/^(['"])(.*)\1$/, '$2').trim();
      const fmModel = fm.match(/^model:[ \t]*(.+)$/m);
      const fmEffort = fm.match(/^effort:[ \t]*(.+)$/m);
      const frontModel = fmModel ? unquote(fmModel[1]) : '(未声明)';
      const frontEffort = fmEffort ? unquote(fmEffort[1]) : '(未声明)';
      if (frontModel !== row.model || frontEffort !== row.effort) {
        errors.push(
          `[roster] steward:${role} 名册表与 frontmatter 不一致：名册 model=${row.model} / effort=${row.effort}；frontmatter model=${frontModel} / effort=${frontEffort}（两处一起改，或改用 agent-config.mjs set）`
        );
      }
    }
    for (const a of AGENTS) {
      if (!rows.has(a)) errors.push(`[roster] 名册表缺角色 steward:${a} 的模型分配行`);
    }
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
