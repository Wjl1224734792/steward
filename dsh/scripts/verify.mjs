#!/usr/bin/env node
/**
 * verify.mjs — Steward 独立验证：门禁复跑、反作弊、基线 hash / 越界 diff 守卫。
 *
 * 子命令：
 *   run      [--config <steward.config.json>] [--root <dir>] [--only test,lint]
 *            [--repeat N] [--with-build] [--json] [--out <verify-result.json>]
 *            探测并执行 test/lint/typecheck(/build) 门禁，记录 exit code/耗时/输出。
 *            --repeat N：测试门禁连跑 N 次，结果不一致 → FLAKY（exit 3）。
 *   baseline record [--root <dir>] [--out <baseline.json>]
 *            记录 HEAD + 当前脏文件内容 hash（派发前回滚锚点）。
 *   baseline check --baseline <path> [--plan <03-plan.json>] [--task T1] [--root <dir>] [--json]
 *            对比基线：基线之外被改动的文件 − 计划所有权 = 越界（E-OUT-OF-BOUNDS，exit 1）；
 *            被改动的测试文件 − testChanges 声明 = 未声明测试 diff（E-TEST-DIFF-UNDECLARED，exit 1）。
 *            通过时打印回滚锚点与改动归属。
 *
 * 退出码：0 = 通过；1 = 门禁失败/越界/未声明测试 diff；2 = 用法/环境错误；3 = FLAKY。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, relative, resolve } from 'node:path';

const GATES = ['test', 'lint', 'typecheck', 'build'];
const TEST_RE = /(^|[\\/])(tests?|__tests__)([\\/])|\.test\.[jt]sx?$|\.spec\.[jt]sx?$|test_[^\\/]*\.py$|_test\.go$/i;

function die(code, msg) { console.error(`[verify] ${msg}`); process.exit(code); }
function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) die(2, `git ${args.join(' ')} 失败：${(r.stderr || r.stdout || '').trim().slice(0, 300)}`);
  return r.stdout;
}
function sha256Of(absPath) {
  try { return createHash('sha256').update(readFileSync(absPath)).digest('hex'); } catch { return null; }
}
function isTestFile(relPath) { return TEST_RE.test(relPath.split('\\').join('/')); }

// ---------- run ----------
function cmdRun(args) {
  const root = resolve(args.root || '.');
  if (!statSync(root).isDirectory()) die(2, `目录不存在：${root}`);
  const configPath = args.config ? resolve(args.config) : join(root, 'steward.config.json');
  const hasConfig = existsSync(configPath);
  const config = hasConfig ? JSON.parse(readFileSync(configPath, 'utf8')) : null;

  // 解析各门禁命令
  const commands = {};
  if (config?.commands) {
    for (const g of GATES) if (typeof config.commands[g] === 'string') commands[g] = config.commands[g];
  } else {
    const pkgPath = join(root, 'package.json');
    if (!existsSync(pkgPath)) die(2, `未找到 ${configPath} 也未找到 package.json，无法自动探测门禁`);
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const scripts = pkg.scripts || {};
    const pm = existsSync(join(root, 'pnpm-lock.yaml')) ? 'pnpm'
      : existsSync(join(root, 'yarn.lock')) ? 'yarn'
        : existsSync(join(root, 'bun.lockb')) ? 'bun' : 'npm';
    const run = (s) => `${pm} run ${s}`;
    if (scripts.test) commands.test = run('test');
    if (scripts.lint) commands.lint = run('lint');
    if (scripts.typecheck || scripts['type-check']) commands.typecheck = scripts.typecheck ? run('typecheck') : run('type-check');
    if (args.withBuild && scripts.build) commands.build = run('build');
    if (!Object.keys(commands).length) die(2, 'package.json 中未探测到 test/lint/typecheck 脚本');
  }

  const only = args.only ? String(args.only).split(',').map((s) => s.trim()) : null;
  const gates = GATES.filter((g) => {
    if (only && !only.includes(g)) return false;
    if (config?.gates) return config.gates[g] === true;
    // 无配置（自动探测）时：只跑探测到命令的门禁，不跑 build；未探测到的 lint/typecheck 静默跳过
    return g !== 'build' && Boolean(commands[g]);
  });
  const missing = gates.filter((g) => !commands[g]);
  if (missing.length) die(2, `门禁 ${missing.join(', ')} 被启用但没有对应命令（检查 steward.config.json 的 commands/gates）`);
  if (!gates.length) die(2, '没有可运行的门禁（检查 steward.config.json 的 gates、package.json 脚本或 --only 参数）');

  const repeat = Math.max(1, parseInt(args.repeat, 10) || 1);
  const results = [];
  for (const g of gates) {
    const runs = [];
    const n = g === 'test' ? repeat : 1;
    for (let i = 0; i < n; i++) {
      const started = Date.now();
      const r = spawnSync(commands[g], {
        cwd: root, shell: true, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      });
      const output = `${r.stdout || ''}${r.stderr || ''}`;
      const lines = output.replace(/\r/g, '').split('\n');
      runs.push({
        exitCode: r.status ?? (r.error ? -1 : 0),
        durationMs: Date.now() - started,
        outputTail: (r.error ? String(r.error) : lines.slice(-50).join('\n')).slice(0, 4000),
      });
      if (g !== 'test') break;
    }
    const exitCodes = [...new Set(runs.map((x) => x.exitCode))];
    results.push({ gate: g, command: commands[g], runs, exitCode: exitCodes.length === 1 ? exitCodes[0] : 'FLAKY', flaky: exitCodes.length > 1 });
  }

  const failed = results.filter((r) => r.exitCode !== 0 && r.exitCode !== 'FLAKY');
  const flaky = results.filter((r) => r.flaky);
  const verdict = failed.length ? 'FAIL' : flaky.length ? 'FLAKY' : 'PASS';
  const exitCode = failed.length ? 1 : flaky.length ? 3 : 0;
  const summary = {
    root, verdict, exitCode, at: new Date().toISOString(),
    gates: results.map((r) => ({
      gate: r.gate, command: r.command, exitCode: r.exitCode, flaky: r.flaky,
      durationMs: r.runs.reduce((s, x) => s + x.durationMs, 0),
      runs: r.runs.map((x) => ({ exitCode: x.exitCode, durationMs: x.durationMs })),
    })),
  };

  if (args.out) {
    const outPath = resolve(args.out);
    const dirOf = outPath.slice(0, Math.max(outPath.lastIndexOf('/'), outPath.lastIndexOf('\\')));
    if (dirOf) mkdirSync(dirOf, { recursive: true });
    writeFileSync(outPath, JSON.stringify({ ...summary, runs: results }, null, 2) + '\n', 'utf8');
  }

  if (args.json) {
    console.log(JSON.stringify({ ...summary, runs: results }, null, 2));
  } else {
    console.log(`[verify] 门禁结果：${verdict}`);
    for (const r of results) {
      for (let i = 0; i < r.runs.length; i++) {
        const x = r.runs[i];
        console.log(`  ${x.exitCode === 0 ? '✓' : '✗'} ${r.gate}#${i + 1} exit=${x.exitCode} ${x.durationMs}ms  $ ${r.command}`);
      }
    }
    if (flaky.length) {
      console.error('[verify] ⚠ 检测到 flaky（同门禁多次运行结果不一致）：');
      for (const r of flaky) console.error(`    ${r.gate}: exit codes = ${r.runs.map((x) => x.exitCode).join(', ')}`);
    }
    if (failed.length) {
      console.error('[verify] 失败门禁真实输出（尾部）：');
      for (const r of failed) console.error(`--- ${r.gate} ---\n${r.runs[0].outputTail}`);
    }
  }
  process.exit(exitCode);
}

// ---------- baseline ----------
function gitStatusFiles(root) {
  const out = git(root, ['status', '--porcelain=v1', '-z', '--no-renames', '--untracked-files=all']);
  const files = new Map(); // rel -> {code}
  const tokens = out.split('\0');
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok) continue;
    const code = tok.slice(0, 2);
    let path = tok.slice(3);
    if (code.includes('R') || code.includes('C')) i++; // 跳过 rename/copy 的第二段
    if (!path) continue;
    files.set(path.split('\\').join('/'), code);
  }
  return files;
}

function cmdBaselineRecord(args) {
  const root = resolve(args.root || '.');
  const head = git(root, ['rev-parse', 'HEAD']).trim();
  const dirty = gitStatusFiles(root);
  const files = {};
  for (const [rel] of dirty) files[rel] = sha256Of(join(root, rel));
  const baseline = {
    schemaVersion: 1, kind: 'steward-baseline', root, head,
    at: new Date().toISOString(), dirtyFiles: files,
  };
  const outPath = args.out ? resolve(args.out) : join(root, 'baseline.json');
  mkdirSync(outPath.substring(0, Math.max(outPath.lastIndexOf('/'), outPath.lastIndexOf('\\'))), { recursive: true });
  writeFileSync(outPath, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  console.log(`[verify] 基线已记录：HEAD=${head.slice(0, 12)}，脏文件 ${Object.keys(files).length} 个 → ${outPath}`);
  console.log('[verify] 回滚锚点：git checkout ' + head.slice(0, 12) + ' -- <文件>；任务结束后用 baseline check 比对。');
}

function cmdBaselineCheck(args) {
  if (!args.baseline) die(2, 'check 需要 --baseline <baseline.json>');
  const baseline = JSON.parse(readFileSync(resolve(args.baseline), 'utf8'));
  if (baseline.kind !== 'steward-baseline') die(2, '文件不是 steward baseline（kind 不符）');
  const root = resolve(args.root || baseline.root || '.');

  let ownership = null; // rel -> [taskIds]
  let declaredTests = new Map(); // rel -> reason
  if (args.plan) {
    const plan = JSON.parse(readFileSync(resolve(args.plan), 'utf8'));
    ownership = new Map();
    for (const t of plan.tasks ?? []) {
      if (args.task && t.id !== args.task) continue;
      for (const f of [...(t.files ?? []), ...(t.newFiles ?? [])]) {
        const norm = f.split('\\').join('/').replace(/^\.\//, '');
        if (!ownership.has(norm)) ownership.set(norm, []);
        ownership.get(norm).push(t.id);
      }
    }
    for (const c of plan.testChanges ?? []) {
      if (args.task && c.task && c.task !== args.task) continue;
      declaredTests.set(c.file.split('\\').join('/').replace(/^\.\//, ''), c.reason || '(未写理由)');
    }
  } else if (!args.allowAny) {
    die(2, 'check 需要 --plan <03-plan.json> 以获得所有权清单（或显式 --allow-any 跳过越界检查，不推荐）');
  }

  const problems = [];
  const current = gitStatusFiles(root);
  const headNow = git(root, ['rev-parse', 'HEAD']).trim();
  if (headNow !== baseline.head) {
    problems.push({ code: 'W-HEAD-MOVED', msg: `HEAD 已从 ${baseline.head.slice(0, 12)} 变为 ${headNow.slice(0, 12)}（期间有提交，回滚锚点需重新评估）` });
  }

  const touched = [];
  for (const [rel, code] of current) {
    const before = baseline.dirtyFiles[rel] ?? undefined;
    const now = sha256Of(join(root, rel));
    if (before === undefined || before !== now) touched.push({ rel, code });
  }
  // 基线里有、现在消失的文件 = 被删除，也算被改动
  for (const rel of Object.keys(baseline.dirtyFiles)) {
    if (!current.has(rel) && existsSync(join(root, rel)) === false) touched.push({ rel, code: 'D?' });
  }

  const outOfBounds = [];
  const undeclaredTests = [];
  const owned = [];
  for (const { rel } of touched) {
    if (ownership && !ownership.has(rel)) outOfBounds.push(rel);
    else {
      owned.push(rel);
      if (isTestFile(rel) && !declaredTests.has(rel)) undeclaredTests.push(rel);
    }
  }

  const verdict = outOfBounds.length || undeclaredTests.length ? 'FAIL' : 'PASS';
  const exitCode = verdict === 'FAIL' ? 1 : 0;
  if (args.json) {
    console.log(JSON.stringify({ verdict, exitCode, head: headNow, baselineHead: baseline.head, touched, owned, outOfBounds, undeclaredTests, problems }, null, 2));
  } else {
    console.log(`[verify] 基线比对：${verdict}（基线 ${baseline.at}，HEAD ${baseline.head.slice(0, 12)}）`);
    console.log(`  计划内改动（${owned.length}）：${owned.join(', ') || '无'}`);
    if (outOfBounds.length) {
      console.error(`  ✗ 越界改动（${outOfBounds.length}）——不在任何任务所有权内：`);
      for (const f of outOfBounds) console.error(`      ${f}\n        回滚：git checkout ${baseline.head.slice(0, 12)} -- "${f}"（若文件在基线前已脏，先用基线 hash 恢复内容）`);
    }
    if (undeclaredTests.length) {
      console.error(`  ✗ 未声明的测试改动（${undeclaredTests.length}）——testChanges 未给理由（反作弊）：`);
      for (const f of undeclaredTests) console.error(`      ${f}`);
    }
    for (const p of problems) console.error(`  ⚠ [${p.code}] ${p.msg}`);
  }
  process.exit(exitCode);
}

// ---------- main ----------
const [cmd, ...rest] = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) args[rest[i].slice(2)] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
}
switch (cmd) {
  case 'run': cmdRun(args); break;
  case 'baseline':
    if (rest[0] === 'record') cmdBaselineRecord(args);
    else if (rest[0] === 'check') cmdBaselineCheck(args);
    else die(2, 'baseline 需要 record 或 check 子命令');
    break;
  default: die(2, `未知子命令：${cmd ?? '(缺省)'}（可用：run | baseline record | baseline check）`);
}
