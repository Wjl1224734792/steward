#!/usr/bin/env node
/**
 * doc-check.mjs — docTier=3 文档索引 / 死链 / T1 检查（Steward ZCode 侧）。
 *
 * 用法：
 *   node doc-check.mjs <root> [--tier <n>] [--json]
 *
 * 检查：
 *   1. T1 是否存在（AGENTS.md + docs/project/ 六件）；tier=3 时缺 T1 记 error。
 *   2. 深文档树存在时必须有不 docs/README.md。
 *   3. AGENTS.md 与 docs 下所有 .md 的相对链接是否存在（跳过外链、纯锚点、代码围栏）。
 *   4. docs/01..07 下的 .md 是否都进了 docs/README.md 索引（双向核对）。
 *
 * 退出码：0 = 通过（可有 warning）；1 = 有 error；2 = 用法/根目录错误。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));
const asJson = flags.has('--json');
const tierIdx = args.indexOf('--tier');
const root = resolve(positional[0] ?? process.cwd());

if (!existsSync(root)) {
  fail(2, `根目录不存在：${root}`);
}

const T1 = [
  'AGENTS.md',
  'docs/project/CONSTITUTION.md',
  'docs/project/ARCHITECTURE.md',
  'docs/project/DECISIONS.md',
  'docs/project/RUNBOOK.md',
  'docs/project/CHANGELOG.md',
  'docs/project/HEALTH.md',
];
const DEEP_DIRS = ['docs/01-需求', 'docs/02-架构', 'docs/03-契约', 'docs/04-专项', 'docs/05-页面', 'docs/06-测试', 'docs/07-治理'];
const EXCLUDE_SEGMENTS = new Set(['.git', '.zcode', '.steward', 'node_modules', 'dist', 'coverage', 'playwright-report', 'test-results', 'tmp']);

const configTier = readConfigTier(root);
const tier = tierIdx >= 0
  ? Number(args[tierIdx + 1])
  : (Number.isInteger(configTier) ? configTier : 1);
if (!Number.isInteger(tier) || tier < 0 || tier > 3) {
  fail(2, `--tier 必须是 0~3 的整数（收到 ${args[tierIdx + 1] ?? '空'}）`);
}

const errors = [];
const warnings = [];
const add = (level, code, message, extra = {}) => (level === 'error' ? errors : warnings).push({ code, message, ...extra });

// 1. T1
const missingT1 = T1.filter((p) => !existsSync(join(root, p)));
if (missingT1.length > 0) {
  const message = `缺 T1 项目记忆：${missingT1.join('、')}（先跑 scripts/take-over.mjs <root> --write 或 /steward take-over）`;
  if (tier >= 3) add('error', 'E-T1-MISSING', message, { tier });
  else add('warning', 'W-T1-MISSING', message, { tier });
}

// 2. 深文档树 + 索引
const deepFound = DEEP_DIRS.filter((d) => existsSync(join(root, d)));
const docsReadme = join(root, 'docs/README.md');
if (deepFound.length > 0 && !existsSync(docsReadme)) {
  add('error', 'E-DOCS-INDEX-MISSING', `存在深文档目录（${deepFound.join('、')}）但缺 docs/README.md 文档地图。`, { deepDirs: deepFound });
}
if (tier >= 3 && deepFound.length === 0) {
  add('warning', 'W-DEEP-TREE-MISSING', 'docTier=3 但未建 docs/01..07；先跑 scripts/doc/doc-init.mjs <root> --write。');
}

// 3. 死链
const mdFiles = [];
walkMd(root, mdFiles);
let checkedLinks = 0;
for (const file of mdFiles) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const cleaned = line.replace(/`[^`\n]*`/g, '');
    for (const m of cleaned.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = normalizeTarget(m[1]);
      if (target === null) continue;
      checkedLinks++;
      if (!targetExists(root, file, target)) {
        add('error', 'E-DEAD-LINK', `链接不存在：${target}`, { file: rel(root, file), line: i + 1, target });
      }
    }
  }
}

// 4. 索引完整性
let indexedFiles = 0;
if (existsSync(docsReadme)) {
  const indexText = readFileSync(docsReadme, 'utf8');
  for (const d of DEEP_DIRS) {
    const dir = join(root, d);
    if (!existsSync(dir)) continue;
    const files = [];
    walkMd(dir, files);
    for (const file of files) {
      if (file === docsReadme) continue;
      indexedFiles++;
      const fromDocs = rel(join(root, 'docs'), file);
      const fromRoot = rel(root, file);
      if (!indexText.includes(fromDocs) && !indexText.includes(fromRoot)) {
        add('error', 'E-UNINDEXED', `文档未进 docs/README.md 索引：${fromRoot}`, { file: fromRoot, expectAny: [fromDocs, fromRoot] });
      }
    }
  }
}

// 5. T0 索引提示（tier=3）
const agents = join(root, 'AGENTS.md');
if (tier >= 3 && existsSync(agents)) {
  const t = readFileSync(agents, 'utf8');
  if (deepFound.length > 0 && !t.includes('docs/README.md')) {
    add('warning', 'W-AGENTS-NO-DOCS-INDEX', 'AGENTS.md 的文档索引未指向 docs/README.md（T3 文档地图）。', { file: 'AGENTS.md' });
  }
  if (!t.includes('docs/project/')) {
    add('warning', 'W-AGENTS-NO-T1-INDEX', 'AGENTS.md 的文档索引未指向 docs/project/（T1 项目记忆）。', { file: 'AGENTS.md' });
  }
}

const ok = errors.length === 0;
const result = {
  ok,
  root,
  tier,
  source: tierIdx >= 0 ? '--tier' : (Number.isInteger(configTier) ? 'steward.config.json' : 'default'),
  checked: { mdFiles: mdFiles.length, links: checkedLinks, deepDirs: deepFound.length, indexedFiles },
  errors,
  warnings,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  for (const w of warnings) console.log(`  ⚠ ${w.code} ${w.message}`);
  for (const e of errors) {
    const loc = e.file ? `${e.file}${e.line ? `:${e.line}` : ''}` : '';
    console.error(`  ✗ ${e.code} ${loc}${loc ? ' — ' : ''}${e.message}`);
  }
  console.log(`[doc-check] ${ok ? 'PASS' : 'FAIL'} — tier=${tier}（${result.source}），检查 ${mdFiles.length} 个 md / ${checkedLinks} 条链接；error ${errors.length} / warning ${warnings.length}`);
}

process.exit(ok ? 0 : 1);

// --- helpers ---

function readConfigTier(r) {
  for (const p of [join(r, 'steward.config.json'), join(r, '.steward/steward.config.json')]) {
    if (!existsSync(p)) continue;
    try {
      const cfg = JSON.parse(readFileSync(p, 'utf8'));
      if (Number.isInteger(cfg.docTier)) return cfg.docTier;
    } catch {
      return null;
    }
  }
  return null;
}

function walkMd(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (EXCLUDE_SEGMENTS.has(e.name)) continue;
    if (e.isSymbolicLink()) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walkMd(full, out);
    else if (e.isFile() && e.name.endsWith('.md')) out.push(full);
  }
}

function normalizeTarget(raw) {
  let t = raw.trim();
  if (t.startsWith('<') && t.endsWith('>')) t = t.slice(1, -1).trim();
  t = t.split(/\s+/)[0];
  if (t === '' || t.startsWith('#') || t.startsWith('//')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return null;
  const pathPart = t.split('#')[0].split('?')[0];
  if (pathPart === '') return null;
  try {
    return decodeURIComponent(pathPart);
  } catch {
    return pathPart;
  }
}

function targetExists(r, fromFile, target) {
  if (/^[a-zA-Z]:[\\/]/.test(target) || target.startsWith('/')) {
    return existsSync(target.startsWith('/') ? join(r, target) : target);
  }
  return existsSync(resolve(dirname(fromFile), target));
}

function rel(from, to) {
  return relative(from, to).split(sep).join('/');
}

function fail(code, message) {
  if (asJson) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  else console.error(`[doc-check] ${message}`);
  process.exit(code);
}
