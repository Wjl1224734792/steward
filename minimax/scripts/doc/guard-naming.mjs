#!/usr/bin/env node
/**
 * guard-naming.mjs — 代码产物命名守卫（Steward 双宿主）。
 *
 * 规则：文件名编码「做什么」，不编码「第几批」。波次/工单/优先级/批次编号属于进度元数据，
 * 应写执行步骤与评审记录，不写进代码产物名字。
 *
 * 用法：
 *   node guard-naming.mjs <root> [--baseline <file>] [--init] [--force] [--json]
 *
 * 基线：默认 <root>/scripts/file-naming-baseline.txt
 *   [FROZEN]   已应用迁移目录等不可改名项（永久）
 *   [BURN-DOWN] 待清理存量（只减不增；清理后删行，条目失效也会报错）
 *
 * 退出码：0 = 通过；1 = 新违规 / 基线失效；2 = 用法或基线错误。
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));
const asJson = flags.has('--json');
const doInit = flags.has('--init');
const force = flags.has('--force');
const rootArg = positional[0] ?? process.cwd();
const root = resolve(rootArg);

const baselineFlag = args.indexOf('--baseline');
const baselinePath = baselineFlag >= 0 && args[baselineFlag + 1]
  ? resolve(root, args[baselineFlag + 1])
  : join(root, 'scripts/file-naming-baseline.txt');

if (!existsSync(root) || !lstatSync(root).isDirectory()) {
  fail(2, `根目录不存在或不是目录：${root}`);
}

const EXCLUDE_SEGMENTS = new Set([
  '.git', '.zcode', '.minimax', '.steward', 'docs', 'tmp', 'node_modules', 'dist', 'coverage',
  'playwright-report', 'test-results', 'generated', '.umi', '.umi-production', '.umi-test',
  '.next', 'build', 'out', 'vendor',
]);

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|astro|sql|prisma|py|go|java|kt|rs|rb|php|cs|swift|css|scss|less|json)$/i;

const MARKERS = [
  { id: 'WAVE', pattern: /(?:^|[._\-\s])w\d{1,2}(?:[._\-]?\d{1,2})?(?:[._\-]?s\d{1,2})?(?:[._\-]|$)/i, hint: '波次 / 子批编号（W1、W7.2、W8S3）' },
  { id: 'ISSUE', pattern: /(?:^|[._\-\s])op[-_]?\d{2,}(?:[._\-]|$)/i, hint: '开放项编号（OP-142）' },
  { id: 'PRIORITY', pattern: /(?:^|[._\-\s])p\d{1,2}(?:[._\-]|$)/i, hint: '优先级 / 子批编号（P1、P2）' },
  { id: 'BATCH', pattern: /(?:^|[._\-\s])(?:phase|stage|wave)[._\-]?\d{1,2}(?:[._\-]|$)/i, hint: '批量 / 阶段英文词（phase2、stage3）' },
  { id: 'BATCH_ZH', pattern: /(?:篇[一二三四五六七八九十百零\d]+|第[一二三四五六七八九十百零\d]+批)/, hint: '批次中文标记（篇二十七、第三批）' },
];

const hitMarkers = (name) => MARKERS.filter((m) => m.pattern.test(name));

const loadBaseline = () => {
  const result = { frozen: new Set(), burnDown: new Set() };
  if (!existsSync(baselinePath)) return result;
  let section = 'burnDown';
  for (const raw of readFileSync(baselinePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '[FROZEN]') { section = 'frozen'; continue; }
    if (line === '[BURN-DOWN]') { section = 'burnDown'; continue; }
    if (line === '' || line.startsWith('#')) {
      if (line.includes('[FROZEN]')) section = 'frozen';
      else if (line.includes('[BURN-DOWN]')) section = 'burnDown';
      continue;
    }
    result[section].add(line);
  }
  return result;
};

const walk = (dir, violations) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    process.stderr.write(`[guard-naming] 跳过不可读目录 ${dir}：${e.message}\n`);
    return;
  }
  for (const entry of entries) {
    const name = entry.name;
    if (EXCLUDE_SEGMENTS.has(name)) continue;
    const full = join(dir, name);
    const rel = relative(root, full).split(sep).join('/');
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      const hits = hitMarkers(name);
      if (hits.length > 0) violations.push({ path: `${rel}/`, hits: hits.map((h) => h.id), hints: hits.map((h) => h.hint) });
      walk(full, violations);
    } else if (entry.isFile() && CODE_EXT.test(name)) {
      const stem = name.replace(CODE_EXT, '');
      const hits = hitMarkers(stem);
      if (hits.length > 0) violations.push({ path: rel, hits: hits.map((h) => h.id), hints: hits.map((h) => h.hint) });
    }
  }
};

const violations = [];
walk(root, violations);
const baseline = loadBaseline();
const known = new Set([...baseline.frozen, ...baseline.burnDown]);
const current = new Set(violations.map((v) => v.path));
const fresh = violations.filter((v) => !known.has(v.path));
const stale = [...known].filter((entry) => !current.has(entry));

if (doInit) {
  if (existsSync(baselinePath) && !force) {
    fail(2, `基线已存在：${baselinePath}\n  需要重建请加 --force（会覆盖 [BURN-DOWN] 段）。`);
  }
  const lines = [
    '# guard-naming 基线',
    '# [FROZEN] 已应用迁移目录等不可改名项；[BURN-DOWN] 待清理存量（只减不增）',
    '',
    '[FROZEN]',
    '',
    '[BURN-DOWN]',
    ...violations.map((v) => v.path),
    '',
  ];
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, lines.join('\n'), 'utf8');
  const result = { ok: true, mode: 'init', root, baseline: baselinePath, written: violations.length };
  if (asJson) console.log(JSON.stringify(result, null, 2));
  else console.log(`guard:naming 基线已写入 ${baselinePath}（${violations.length} 条 [BURN-DOWN]）`);
  process.exit(0);
}

const result = {
  ok: fresh.length === 0 && stale.length === 0,
  root,
  baseline: baselinePath,
  fresh,
  stale,
  counts: { burnDown: baseline.burnDown.size, frozen: baseline.frozen.size, current: violations.length },
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  if (fresh.length > 0) {
    console.error(`guard:naming 失败 —— ${fresh.length} 个新文件 / 目录带阶段编号命名\n`);
    for (const v of fresh) {
      console.error(`  ${v.path}`);
      console.error(`    命中：${v.hits.map((id, i) => `${id} ${v.hints[i]}`).join(' / ')}`);
    }
    console.error('\n  文件名说「做什么」，不说「第几批」；阶段归属写执行步骤与评审记录。\n');
  }
  if (stale.length > 0) {
    console.error(`guard:naming 失败 —— 基线有 ${stale.length} 条已失效（已改名 / 删除）\n`);
    for (const entry of stale) console.error(`  ${entry}`);
    console.error('\n  基线只减不增：请从基线文件删除对应行。\n');
  }
  if (result.ok) {
    console.log(`guard:naming 通过（待清理 ${baseline.burnDown.size} 条 / 历史冻结 ${baseline.frozen.size} 条 / 新违规 0）`);
  }
}

process.exit(result.ok ? 0 : 1);

function fail(code, message) {
  if (asJson) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  else console.error(`[guard-naming] ${message}`);
  process.exit(code);
}
