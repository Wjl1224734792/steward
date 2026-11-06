#!/usr/bin/env node
/**
 * take-over.mjs — 接手存量项目：扫描仓库并生成 T1 项目记忆初稿。
 *
 * 用法：
 *   node take-over.mjs <仓库根>            # 只扫描，输出盘点报告
 *   node take-over.mjs <仓库根> --write    # 扫描 + 生成 AGENTS.md 与 docs/project/*.md（缺什么补什么，绝不覆盖已存在文件）
 *   node take-over.mjs <仓库根> --json     # 机读盘点结果
 *
 * 退出码：0 = 成功；2 = 用法/目录错误；1 = --write 时生成失败。
 * 原则：探测到什么写什么；探测不到留 {{...}} 占位符，不编造。
 */
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync,
} from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const TPL_DIR = join(SCRIPT_DIR, 'templates');

const T1_FILES = [
  'AGENTS.md',
  'docs/project/CONSTITUTION.md',
  'docs/project/ARCHITECTURE.md',
  'docs/project/DECISIONS.md',
  'docs/project/RUNBOOK.md',
  'docs/project/CHANGELOG.md',
  'docs/project/HEALTH.md',
];

// --- args ---
const args = process.argv.slice(2);
const root = resolve(args.find((a) => !a.startsWith('--')) || '.');
const doWrite = args.includes('--write');
const asJson = args.includes('--json');
if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.error(`[take-over] 目录不存在：${root}`);
  process.exit(2);
}

function readJsonSafe(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function firstExisting(candidates) {
  for (const c of candidates) if (c && existsSync(join(root, c))) return c;
  return null;
}

function findTopPkgJson() {
  // 根 package.json；monorepo 场景只取根，其余列入扫描备注。
  return firstExisting(['package.json']);
}

function detectPackageManager() {
  if (firstExisting(['pnpm-lock.yaml'])) return 'pnpm';
  if (firstExisting(['yarn.lock'])) return 'yarn';
  if (firstExisting(['package-lock.json'])) return 'npm';
  if (firstExisting(['bun.lockb', 'bun.lock'])) return 'bun';
  return null;
}

function scan() {
  const pkgPath = findTopPkgJson();
  const pkg = pkgPath ? readJsonSafe(join(root, pkgPath)) : null;
  const pm = detectPackageManager();

  const scripts = (pkg && typeof pkg.scripts === 'object' && pkg.scripts) || {};
  const pickScript = (...names) => {
    for (const n of names) if (typeof scripts[n] === 'string' && scripts[n].trim()) return `${pm ?? 'npm'} run ${n}`;
    return null;
  };

  // 测试框架线索
  const testHints = [];
  if (pkg?.devDependencies) {
    for (const fw of ['vitest', 'jest', 'mocha', '@playwright/test', 'cypress', 'ava', 'node:test']) {
      if (pkg.devDependencies[fw] || pkg.dependencies?.[fw]) testHints.push(fw);
    }
  }
  if (typeof scripts.test === 'string' && scripts.test.includes('node --test')) testHints.push('node:test');

  const goMod = firstExisting(['go.mod']);
  const pyProject = firstExisting(['pyproject.toml', 'requirements.txt', 'setup.py']);
  const cargoToml = firstExisting(['Cargo.toml']);

  const topDirs = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !['node_modules', '.git', 'dist', 'build', '.venv', 'venv', 'target'].includes(d.name) && !d.name.startsWith('.'))
    .map((d) => d.name)
    .slice(0, 12);

  const docsDir = existsSync(join(root, 'docs'));
  const t1Present = T1_FILES.map((f) => ({ file: f, present: existsSync(join(root, f)) }));
  const hasGithubWorkflows = existsSync(join(root, '.github', 'workflows'));
  const hasGit = existsSync(join(root, '.git'));
  const configPresent = existsSync(join(root, 'steward.config.json'));

  const commands = {
    install: pm ? `${pm} install` : null,
    dev: pickScript('dev', 'start', 'serve'),
    test: pickScript('test'),
    lint: pickScript('lint'),
    typecheck: pickScript('typecheck', 'type-check', 'tsc'),
    build: pickScript('build'),
  };

  return {
    root,
    projectName: pkg?.name ?? root.split(sep).pop(),
    ecosystem: pkg ? 'node' : goMod ? 'go' : pyProject ? 'python' : cargoToml ? 'rust' : 'unknown',
    packageManager: pm,
    testHints: [...new Set(testHints)],
    commands,
    topDirs,
    docsDir,
    t1Present,
    configPresent,
    hasGithubWorkflows,
    hasGit,
    monorepoNote: pkg?.workspaces ? `workspaces: ${JSON.stringify(pkg.workspaces).slice(0, 120)}` : null,
  };
}

function render(tplName, vars) {
  let text = readFileSync(join(TPL_DIR, tplName), 'utf8');
  for (const [k, v] of Object.entries(vars)) text = text.split(`{{${k}}}`).join(v);
  return text;
}

function moduleMapLines(scan) {
  if (!scan.topDirs.length) return '| （未发现顶级目录） |  |  |';
  return scan.topDirs.map((d) => `| \`${d}/\` | TODO(确认) | TODO |`).join('\n');
}

function buildVars(scan) {
  const cmd = (k) => scan.commands[k] || 'TODO(探测失败，人工填写)';
  return {
    PROJECT_NAME: scan.projectName,
    PROJECT_PURPOSE: 'TODO(人工填写：2~3 句项目定位)',
    PROJECT_RED_LINES: 'TODO(拍板)',
    INSTALL_CMD: cmd('install'),
    DEV_CMD: cmd('dev'),
    TEST_CMD: cmd('test'),
    LINT_CMD: cmd('lint'),
    TYPECHECK_CMD: cmd('typecheck'),
    BUILD_CMD: cmd('build'),
    MODULE_MAP: moduleMapLines(scan),
    SERVICES_TABLE: '| TODO | TODO | TODO |',
    DATE: new Date().toISOString().slice(0, 10),
  };
}

// --- main ---
const scanResult = scan();
const missingT1 = scanResult.t1Present.filter((t) => !t.present).map((t) => t.file);

let generated = [];
let skipped = [];
if (doWrite) {
  const vars = buildVars(scanResult);
  for (const file of missingT1) {
    const dest = join(root, file);
    const tpl = file.split('/').pop();
    try {
      mkdirSync(dest.substring(0, dest.lastIndexOf(sep)), { recursive: true });
      writeFileSync(dest, render(tpl, vars).replace(/\r\n/g, '\n'), 'utf8');
      generated.push(file);
    } catch (e) {
      console.error(`[take-over] 生成失败：${file} — ${e.message}`);
      process.exit(1);
    }
  }
  skipped = scanResult.t1Present.filter((t) => t.present).map((t) => t.file);
}

const gaps = [];
if (!scanResult.hasGit) gaps.push('不是 git 仓库：基线 hash / 回滚锚点不可用，建议 git init');
if (!scanResult.commands.test) gaps.push('未探测到测试命令：门禁 test 无法自动执行');
if (!scanResult.commands.lint) gaps.push('未探测到 lint 命令');
if (!scanResult.configPresent) gaps.push('缺少 steward.config.json：请按 ROADMAP §5.4 创建并用 validate-config.mjs 校验');
if (scanResult.hasGithubWorkflows) gaps.push('存在 .github/workflows：与 Steward「不做 CI/CD」原则无关，不会被读取');
const stillMissing = (f) => !scanResult.t1Present.find((t) => t.file === f)?.present && !generated.includes(f) && !skipped.includes(f);
if (stillMissing('AGENTS.md')) gaps.push('缺 AGENTS.md（T0）');
for (const t of scanResult.t1Present) if (t.file !== 'AGENTS.md' && stillMissing(t.file)) gaps.push(`缺 ${t.file}（T1）`);

if (asJson) {
  console.log(JSON.stringify({ scan: scanResult, generated, skipped, gaps }, null, 2));
} else {
  const line = (ok) => (ok ? '✓' : '✗');
  console.log(`# take-over 盘点：${scanResult.projectName}`);
  console.log(`- 仓库根：${scanResult.root}`);
  console.log(`- 生态：${scanResult.ecosystem}${scanResult.packageManager ? ` / ${scanResult.packageManager}` : ''}${scanResult.monorepoNote ? ` / ${scanResult.monorepoNote}` : ''}`);
  console.log(`- 测试框架线索：${scanResult.testHints.join(', ') || '未发现'}`);
  console.log(`- git：${line(scanResult.hasGit)}  CI 目录(.github/workflows)：${line(scanResult.hasGithubWorkflows)}（仅盘点，不使用）`);
  console.log(`- 探测命令：${Object.entries(scanResult.commands).map(([k, v]) => `${k}=${v ?? '✗'}`).join('  ')}`);
  console.log('- T1 完整性：');
  for (const t of scanResult.t1Present) console.log(`    ${line(t.present)} ${t.file}`);
  if (generated.length) console.log(`- 本次生成：\n${generated.map((f) => `    + ${f}`).join('\n')}`);
  if (skipped.length) console.log(`- 已存在跳过（不覆盖）：\n${skipped.map((f) => `    = ${f}`).join('\n')}`);
  console.log(`- 缺口清单（${gaps.length}）：`);
  for (const g of gaps) console.log(`    ! ${g}`);
  console.log('- 下一步：确认各文档中 TODO/占位符（不许留编造内容），创建并校验 steward.config.json。');
}
process.exit(0);
