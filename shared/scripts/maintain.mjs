#!/usr/bin/env node
/**
 * maintain.mjs — Steward 维护循环的 Observe 步骤：八类扫描 → 评分排序的维护 backlog。
 *
 * 用法：
 *   node maintain.mjs <仓库根> [--out <reports/maintenance-YYYYMMDD.md>] [--json] [--churn-days 90]
 *
 * 扫描类别（受 steward.config.json 的 maintenance 开关控制，缺省全开）：
 *   dependencies   依赖清单盘点（过期/漏洞需联网的部分 fail-open 标记人工检查）
 *   security       npm audit --json（不可用则标记，不阻塞）
 *   duplication    跨文件重复代码块（≥6 行相同窗口）
 *   churn          近 N 天 git 修改频率 Top（git log --name-only）
 *   docDrift       AGENTS.md 文档索引/命令与仓库现状比对（引用的文档不存在、命令与 package.json 不符）
 *   architectureDrift  ESM import 依赖图成环检测
 *   flaky          npm test 连跑 2 次结果比对（--skip-flaky 可跳过）
 *   todo           TODO/FIXME/HACK/XXX 扫描（file:line 证据）
 *
 * 评分：score = 类别权重 × 影响面 ÷ 修复成本，降序输出 backlog；只读，不改任何文件。
 * 退出码：0 = 有报告；2 = 用法/环境错误。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, resolve, sep } from 'node:path';

const SRC_RE = /\.(m?js|cjs|jsx|tsx?|py|go|rs)$/i;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.steward', 'coverage', 'tmp', '.venv']);
const TODO_RE = /\b(TODO|FIXME|HACK|XXX)\b/;
const IMPORT_RE = /(?:^|\n)\s*import\s[^'"]*['"](\.[^'"]+)['"]|(?:^|\n)\s*export\s[^'"]*from\s*['"](\.[^'"]+)['"]/g;

function die(code, msg) { console.error(`[maintain] ${msg}`); process.exit(code); }
function walk(root, dir = root, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.github') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(root, p, acc); continue; }
    if (SRC_RE.test(e.name) || /\.md$/i.test(e.name)) acc.push(p);
  }
  return acc;
}
function rel(root, p) { return relative(root, p).split(sep).join('/'); }

const args = {};
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[++i] ?? true;
}
const root = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
if (!existsSync(root) || !statSync(root).isDirectory()) die(2, `目录不存在：${root}`);

const cfgPath = join(root, 'steward.config.json');
const cfg = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : null;
const enabled = (k) => !cfg?.maintenance || cfg.maintenance[k] !== false;

const findings = [];
const add = (category, weight, title, evidence, cost) => findings.push({ category, weight, title, evidence, cost, score: +(weight * evidence.length / cost).toFixed(1) });

const files = walk(root).filter((f) => !f.includes(`${sep}templates${sep}`));
const srcFiles = files.filter((f) => SRC_RE.test(f));
const mdFiles = files.filter((f) => /\.md$/i.test(f));

function sh(cmd, argv, opts = {}) {
  // Windows 下 npm 需经 shell 解析；Node 24 起 shell:true 不接受参数数组，改为拼单串
  const useShell = opts.shell === true;
  const spec = useShell ? `${cmd} ${argv.join(' ')}` : cmd;
  const argvFinal = useShell ? [] : argv;
  const r = spawnSync(spec, argvFinal, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...opts });
  return { status: r.status, out: `${r.stdout || ''}`, err: `${r.stderr || ''}` };
}

// --- dependencies ---
if (enabled('dependencies')) {
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const deps = Object.keys(pkg.dependencies ?? {});
    const dev = Object.keys(pkg.devDependencies ?? {});
    const outdated = sh('npm', ['outdated', '--json']);
    const stale = outdated.status !== 0 && outdated.status !== 1
      ? null
      : Object.entries(JSON.parse(outdated.out || '{}')).filter(([, v]) => v.latest && v.current !== v.latest);
    if (stale === null) {
      add('dependencies', 2, `依赖共 ${deps.length + dev.length} 个；npm outdated 不可用（离线/无 registry），需联网环境补跑`, [], 1);
    } else if (stale.length) {
      add('dependencies', 2, `${stale.length} 个依赖落后于 latest`, stale.slice(0, 15).map(([k, v]) => `${k}: ${v.current} → ${v.latest}`), 2);
    }
  } else {
    add('dependencies', 2, '无 package.json：依赖扫描不适用（go.mod/Cargo.toml 等需对应生态工具）', [], 1);
  }
}

// --- security ---
if (enabled('security')) {
  if (existsSync(join(root, 'package-lock.json')) || existsSync(join(root, 'pnpm-lock.yaml'))) {
    const audit = sh('npm', ['audit', '--json']);
    if (audit.status === 0 && audit.out) {
      const vulns = JSON.parse(audit.out).metadata?.vulnerabilities ?? {};
      const n = (vulns.high ?? 0) + (vulns.critical ?? 0) + (vulns.moderate ?? 0) + (vulns.low ?? 0);
      if (n) add('security', 5, `npm audit 报告 ${n} 个漏洞（high+critical: ${(vulns.high ?? 0) + (vulns.critical ?? 0)}）`, Object.entries(vulns).filter(([, c]) => c).map(([k, c]) => `${k}: ${c}`), 2);
    } else {
      add('security', 5, 'npm audit 不可用（离线/无 lockfile 安装），安全扫描需人工或联网补跑', [], 1);
    }
  } else {
    add('security', 5, '无 lockfile：安全基线不明，建议提交 lockfile 后跑 npm audit', [], 1);
  }
}

// --- duplication（跨文件 ≥6 行相同窗口） ---
if (enabled('duplication')) {
  const WINDOW = 6;
  const seen = new Map(); // hash -> [{file,line,firstLine}]
  for (const f of srcFiles) {
    const lines = readFileSync(f, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//') && !l.startsWith('*'));
    for (let i = 0; i + WINDOW <= lines.length; i++) {
      const key = lines.slice(i, i + WINDOW).join('\n');
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push({ file: rel(root, f), line: i + 1 });
    }
  }
  const dups = [...seen.entries()].filter(([, locs]) => new Set(locs.map((l) => l.file)).size > 1);
  if (dups.length) {
    // 贪心去重：同一文件对只报一次最大窗口
    const pairs = new Map();
    for (const [, locs] of dups) {
      for (const a of locs) for (const b of locs) {
        if (a.file >= b.file) continue;
        const k = `${a.file}|${b.file}`;
        pairs.set(k, (pairs.get(k) ?? 0) + 1);
      }
    }
    const top = [...pairs.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10);
    add('duplication', 3, `${dups.length} 个跨文件重复代码窗口（≥${WINDOW} 行）`, top.map(([k, c]) => `${k.replace('|', ' ↔ ')}：${c} 个窗口`), 3);
  }
}

// --- churn + 重构比例 ---
{
  const churnDays = parseInt(args['churn-days'], 10) || 90;
  const since = new Date(Date.now() - churnDays * 86400e3).toISOString().slice(0, 10);
  const gl = sh('git', ['log', `--since=${since}`, '--name-only', '--format=']);
  if (gl.status === 0 && gl.out.trim()) {
    const counts = new Map();
    for (const line of gl.out.split('\n')) { const f = line.trim(); if (f) counts.set(f, (counts.get(f) ?? 0) + 1); }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const hot = top.filter(([, c]) => c >= 10);
    if (hot.length) add('churn', 2, `近 ${churnDays} 天高频改动文件（churn ≥10，重构/加测试候选）`, hot.map(([f, c]) => `${f}: ${c} 次`), 2);

    // 重构比例：演进循环输入——重构类提交占比过低说明在堆功能不还债（GitClear：AI 时代重构率显著下降）
    const subjects = sh('git', ['log', `--since=${since}`, '--format=%s']).out.split('\n').filter(Boolean);
    if (subjects.length >= 20) {
      const reRefactor = /refactor|重构|cleanup|clean up|chore|技术债|debt|rename|extract|拆分|reorganiz/i;
      const refac = subjects.filter((s) => reRefactor.test(s)).length;
      const ratio = refac / subjects.length;
      if (ratio < 0.1) add('churn', 2, `近 ${churnDays} 天重构/还债类提交占比仅 ${(ratio * 100).toFixed(0)}%（${refac}/${subjects.length}，<10%），演进欠账风险`, [`git log --since=${since} --format=%s | grep -ciE 'refactor|重构|cleanup|chore'`], 2);
    }
  }
}

// --- docDrift：AGENTS.md 引用存在性 + 命令一致性 ---
if (enabled('docDrift')) {
  const agentsPath = join(root, 'AGENTS.md');
  if (existsSync(agentsPath)) {
    const text = readFileSync(agentsPath, 'utf8');
    const missing = [...text.matchAll(/\]\((docs\/project\/[\w.-]+)\)/g)].map((m) => m[1]).filter((p) => !existsSync(join(root, p)));
    if (missing.length) add('docDrift', 3, `AGENTS.md 引用了 ${missing.length} 个不存在的文档`, [...new Set(missing)], 1);
    const pkgPath = join(root, 'package.json');
    if (existsSync(pkgPath)) {
      const scripts = JSON.parse(readFileSync(pkgPath, 'utf8')).scripts ?? {};
      const badCmds = [...text.matchAll(/^\|\s*\w+\s*\|\s*`?(\w+) run (\w+)`?\s*\|/gm)]
        .filter(([, pm, s]) => !scripts[s])
        .map(([, pm, s]) => `${pm} run ${s}（package.json 无此脚本）`);
      if (badCmds.length) add('docDrift', 3, `AGENTS.md 命令速查与 package.json 不一致`, badCmds, 1);
    }
  } else {
    add('docDrift', 3, '缺 AGENTS.md（T0）：项目记忆地基未建立', [], 2);
  }
  for (const must of ['docs/project/CONSTITUTION.md', 'docs/project/HEALTH.md']) {
    if (!existsSync(join(root, must))) add('docDrift', 3, `缺 ${must}（T1）`, [], 2);
  }
}

// --- architectureDrift：ESM 相对 import 成环 ---
if (enabled('architectureDrift')) {
  const graph = new Map();
  for (const f of srcFiles) {
    const text = readFileSync(f, 'utf8');
    const deps = [];
    for (const m of text.matchAll(IMPORT_RE)) {
      const spec = m[1] || m[2];
      if (!spec) continue;
      const base = resolve(f, '..', spec);
      for (const cand of [base, `${base}.mjs`, `${base}.js`, `${base}.cjs`, join(base, 'index.js'), join(base, 'index.mjs')]) {
        if (existsSync(cand) && statSync(cand).isFile()) { deps.push(rel(root, cand)); break; }
      }
    }
    graph.set(rel(root, f), deps);
  }
  const state = new Map(); // 0=visiting 1=done
  const cycles = [];
  const dfs = (n, stack) => {
    if (state.get(n) === 1) return;
    if (stack.includes(n)) { cycles.push([...stack.slice(stack.indexOf(n)), n].join(' → ')); return; }
    stack.push(n);
    for (const d of graph.get(n) ?? []) if (state.get(d) !== 1) dfs(d, stack);
    stack.pop();
    state.set(n, 1);
  };
  for (const n of graph.keys()) dfs(n, []);
  if (cycles.length) add('architectureDrift', 4, `检测到 ${cycles.length} 个模块循环依赖`, [...new Set(cycles)].slice(0, 10), 3);
}

// --- flaky：测试连跑 2 次比对 ---
if (enabled('flaky') && !args['skip-flaky']) {
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath) && JSON.parse(readFileSync(pkgPath, 'utf8')).scripts?.test) {
    const runs = [0, 1].map(() => sh('npm', ['test'], { shell: process.platform === 'win32' }));
    const codes = runs.map((r) => r.status);
    if (codes[0] !== codes[1]) add('flaky', 4, `测试连跑 2 次结果不一致（exit ${codes.join(' vs ')}）——flaky 或环境依赖`, ['复跑命令：npm test；建议 --repeat 5 定位用例'], 2);
  }
}

// --- TODO 扫描 ---
{
  const hits = [];
  for (const f of srcFiles) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((l, i) => { if (TODO_RE.test(l)) hits.push(`${rel(root, f)}:${i + 1}`); });
  }
  if (hits.length) add('todo', 1, `${hits.length} 处 TODO/FIXME/HACK/XXX`, hits.slice(0, 20), 2);
}

// --- 输出 ---
findings.sort((a, b) => b.score - a.score);
const total = findings.reduce((s, f) => s + f.score, 0);
const date = new Date().toISOString().slice(0, 10);

function renderMarkdown() {
  const lines = [
    `# 维护报告 ${date}`,
    '',
    `> maintain.mjs 扫描 ${root}；${srcFiles.length} 个源文件 / ${mdFiles.length} 个文档；健康分 ${total.toFixed(1)}（越低越好，findings ${findings.length} 项）`,
    '',
    '| # | 类别 | 分 | 发现 | 证据 | 修复成本 |',
    '|---|---|---|---|---|---|',
  ];
  findings.forEach((f, i) => lines.push(`| ${i + 1} | ${f.category} | ${f.score} | ${f.title} | ${f.evidence.length ? f.evidence.map((e) => `\`${e}\``).join('；') : '—'} | ${f.cost} |`));
  if (!findings.length) lines.push('| — | — | 0 | 未发现需处理项 | — | — |');
  lines.push('', '## 维护 backlog（按 score 降序，score = 权重 × 影响面 ÷ 成本）', '');
  findings.forEach((f, i) => lines.push(`${i + 1}. [${f.category}] ${f.title}`));
  lines.push('', '> 下一步：小项逐个修（单写者、证据闭环）；大项转 /steward 立项；处理后更新 docs/project/HEALTH.md。');
  return lines.join('\n');
}

if (args.json) {
  console.log(JSON.stringify({ root, date, score: total, findings }, null, 2));
} else if (args.out) {
  const outPath = resolve(String(args.out).replace('YYYYMMDD', date.replace(/-/g, '')));
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(outPath.slice(0, Math.max(outPath.lastIndexOf('/'), outPath.lastIndexOf('\\'))), { recursive: true });
  writeFileSync(outPath, renderMarkdown().replace(/\r\n/g, '\n'), 'utf8');
  console.log(`[maintain] 报告已写入：${outPath}（findings ${findings.length}，健康分 ${total.toFixed(1)}）`);
  findings.slice(0, 5).forEach((f, i) => console.log(`  ${i + 1}. [${f.category}] ${f.title}`));
} else {
  console.log(renderMarkdown());
}
