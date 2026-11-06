#!/usr/bin/env node
/**
 * build.mjs — 双宿主构建与校验（本地脚本，不做 CI）。
 *
 * 单一正文源策略（v0.7）：
 *   - 脚本与模板：`zcode/scripts/` 是唯一正文源；`minimax/scripts/` 是构建产物，本脚本一键同步。
 *   - 技能/agent 正文：目前双源维护（宿主派发机制差异大，自动转换风险高），本脚本做
 *     frontmatter 校验 + 清单校验 + 正文漂移报告，漂移需人工收敛（见 ROADMAP-STATUS）。
 *
 * 用法：
 *   node build.mjs            # 校验 + 同步 minimax/scripts（内容有差异才写）
 *   node build.mjs --check    # 只校验不写（检查 scripts 是否同步、清单/frontmatter 是否合法）
 *   node build.mjs --json     # 机读结果
 *
 * 退出码：0 = 通过；1 = 有错误（frontmatter/清单非法，或 --check 时脚本未同步）。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// 本脚本位于 <仓库根>/zcode/scripts/build.mjs，仓库根为上两级
const root = resolve(import.meta.dirname ?? process.cwd(), '..', '..');
const zc = join(root, 'zcode');
const mx = join(root, 'minimax');
const checkOnly = process.argv.includes('--check');
const asJson = process.argv.includes('--json');

const errors = [];
const warnings = [];
const synced = [];

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

// --- 1. 脚本与模板：单一正文源同步 ---
const scriptFiles = readdirSync(join(zc, 'scripts')).filter((f) => f.endsWith('.mjs'));
for (const f of scriptFiles) {
  const src = join(zc, 'scripts', f);
  const dst = join(mx, 'scripts', f);
  if (!existsSync(dst) || readFileSync(src, 'utf8') !== readFileSync(dst, 'utf8')) {
    if (checkOnly) errors.push(`[scripts] minimax/scripts/${f} 与 zcode 版不一致（单一正文源被破坏，跑 node build.mjs 同步）`);
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

// --- 2. 清单校验（plugin.json 列表与磁盘一致 + 版本一致） ---
function checkManifest(manifestPath, base, { hasSkillsArray, hasAgentsArray, hasCommands }) {
  if (!existsSync(manifestPath)) { errors.push(`[manifest] 缺 ${manifestPath}`); return null; }
  let m;
  try { m = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch (e) { errors.push(`[manifest] ${manifestPath} JSON 解析失败：${e.message}`); return null; }
  const lists = hasSkillsArray
    ? { skills: m.skills, agents: m.agents }
    : { skills: m.skills ? ['skills/steward/SKILL.md'] : [], agents: m.agents ? readdirSync(join(base, 'agents')).filter((f) => f.endsWith('.md')).map((f) => `agents/${f}`) : [] };
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
  // 版本节奏：ZCode 0.x.0 ↔ MiniMax 1.(x-2).0（0.5.0↔1.3.0、0.6.0↔1.4.0、0.7.0↔1.5.0）
  const zv = /^0\.(\d+)\./.exec(zm.version);
  const mv = /^1\.(\d+)\./.exec(mm.version);
  if (zv && mv && Number(mv[1]) !== Number(zv[1]) - 2) {
    warnings.push(`[manifest] 两宿主版本为 ZCode ${zm.version} / MiniMax ${mm.version}，不符合版本节奏（期望 MiniMax 1.${Number(zv[1]) - 2}.0）`);
  }
}

// --- 3. frontmatter 校验（双宿主全部技能与 agent） ---
for (const d of readdirSync(join(zc, 'skills'))) {
  const p = join(zc, 'skills', d, 'SKILL.md');
  if (existsSync(p)) errors.push(...frontmatterErrors(`zcode/skills/${d}`, readFileSync(p, 'utf8')));
}
for (const d of readdirSync(join(mx, 'skills'))) {
  const p = join(mx, 'skills', d, 'SKILL.md');
  if (existsSync(p)) errors.push(...frontmatterErrors(`minimax/skills/${d}`, readFileSync(p, 'utf8')));
}
for (const f of readdirSync(join(zc, 'agents')).filter((x) => x.endsWith('.md'))) {
  errors.push(...frontmatterErrors(`zcode/agents/${f}`, readFileSync(join(zc, 'agents', f), 'utf8'), { hostMx: false }));
}
for (const f of readdirSync(join(mx, 'agents')).filter((x) => x.endsWith('.md'))) {
  errors.push(...frontmatterErrors(`minimax/agents/${f}`, readFileSync(join(mx, 'agents', f), 'utf8'), { hostMx: true }));
}

// --- 4. 正文漂移报告（技能/agent 正文仍双源维护，报告差异规模） ---
function sectionHeadings(text) { return [...text.matchAll(/^## .+$/gm)].map((m) => m[0]); }
const drift = [];
for (const skill of ['steward']) {
  const a = readFileSync(join(zc, 'skills', skill, 'SKILL.md'), 'utf8');
  const b = readFileSync(join(mx, 'skills', skill, 'SKILL.md'), 'utf8');
  const ha = new Set(sectionHeadings(a));
  const hb = new Set(sectionHeadings(b));
  const onlyA = [...ha].filter((h) => !hb.has(h));
  const onlyB = [...hb].filter((h) => !ha.has(h));
  if (onlyA.length || onlyB.length) drift.push(`skills/${skill}: 仅 zcode 有节 ${JSON.stringify(onlyA)}；仅 minimax 有节 ${JSON.stringify(onlyB)}`);
}

const result = { ok: errors.length === 0, errors, warnings, synced, drift };
if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  if (synced.length && !checkOnly) console.log(`[build] 已同步 ${synced.length} 个文件到 minimax/scripts/：\n  ${synced.join('\n  ')}`);
  for (const d of drift) console.log(`[build] 正文漂移（双源维护，需人工收敛）：${d}`);
  for (const w of warnings) console.log(`[build] ⚠ ${w}`);
  if (errors.length) {
    console.error(`[build] FAIL — ${errors.length} 个错误：`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log(`[build] PASS — 脚本/模板单一正文源${checkOnly ? '校验' : '同步'}完成；frontmatter 与清单校验通过`);
}
