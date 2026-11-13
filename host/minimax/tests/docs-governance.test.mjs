/**
 * docs-governance.test.mjs — MiniMax 侧文档治理随包脚本与构建产物契约测试。
 *
 * 覆盖三类用例：
 *   1. 文档门禁冒烟：最小 docs 树跑 `minimax/scripts/docs-gate.mjs <root> check`，
 *      断言退出码语义（有 error → 1）、输出含 G 编号门禁结论；`--json` 输出可解析且含 ok / errors。
 *   2. 快照幂等：`minimax/scripts/doc-snapshot.mjs` 首跑生成 history/ 快照与 manifest.json，
 *      同命令复跑输出 skip 且不改动任何文件（目录树内容指纹比对）。
 *   3. 构建产物契约（防回归）：inline / docs / docs-governance / project-lifecycle 四技能随包、清单恰好 11 项且路径都存在、
 *      主技能三节已拆走只留指针、拆出技能正文承接原节、随包脚本与 host/minimax/scripts 正文源逐字节一致。
 *
 * 全部跑真实进程，不 mock；临时目录建在仓库 tmp/ 下，测试结束用 fs.rmSync 自行清理（不用 PowerShell 递归删）。
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const MX = join(ROOT, 'minimax');
const GATE = join(MX, 'scripts', 'docs-gate.mjs');
const SNAPSHOT = join(MX, 'scripts', 'doc-snapshot.mjs');
const HOST_SCRIPTS = join(ROOT, 'host', 'minimax', 'scripts');

const PRD_DIR = 'docs/01-需求';
const PRD_NAME = 'PRD-x';

const PRD = `---
read: task
status: active
version: v1.0
---

# PRD x

> 版本：v1.0
> 状态：生效

## 1. 背景

MiniMax 侧文档门禁冒烟用的最小需求文档，正文很短，不会撞体积预算。

## 修订记录

| 版本 | 日期 | 变更摘要（FR/FP 编号） | 依据（拍板留痕） | 拍板人 | 快照 |
|---|---|---|---|---|---|
| v1.0 | 2026-11-12 | 初版 | ADR-0001 | 测试 | - |
`;

/** Run one of the packaged scripts and return exit code plus stdout / stderr. */
function run(script, args) {
  const res = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  return { code: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '', out: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

function write(root, rel, content) {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  return full;
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** 最小 docs 树：根 AGENTS.md + docs/README.md（无自动索引区块 → G5 error）+ 一份带 frontmatter version 的 PRD。 */
function newProject(t) {
  mkdirSync(join(ROOT, 'tmp'), { recursive: true });
  const root = mkdtempSync(join(ROOT, 'tmp', 'qa-mx-dgov-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  write(root, 'AGENTS.md', '# AGENTS\n\n文档地图见 docs/README.md。\n');
  write(root, 'docs/README.md', '# 文档地图\n\n（尚未生成自动索引区块。）\n');
  write(root, `${PRD_DIR}/${PRD_NAME}.md`, PRD);
  return root;
}

/** 目录树内容指纹（相对路径 + 内容 sha256），用于「未改动任何文件」断言。 */
function treeDigest(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else files.push(abs);
    }
  };
  walk(root);
  return files
    .sort()
    .map((abs) => `${relative(root, abs).replace(/\\/g, '/')}:${sha256(readFileSync(abs))}`)
    .join('\n');
}

/** 所有 `## ` 标题行（按行首判定，避免正文里提到标题文本造成误判）。 */
function headingLines(text) {
  return text.split(/\r?\n/).filter((line) => /^##\s/.test(line));
}

// --- 1. 文档门禁冒烟 ---------------------------------------------------------

test('docs-gate check 对最小 docs 树报 G 编号 error 并 exit 1', (t) => {
  const root = newProject(t);
  const res = run(GATE, [root, 'check']);
  assert.equal(res.code, 1, `有 error 时应 exit 1：${res.out}`);
  assert.match(res.out, /G\d+/, '输出应含 G 编号的门禁结论');
  assert.match(res.out, /\[docs-gate\] FAIL/);
  assert.match(res.out, /G5/, 'docs/README.md 缺索引区块标记应报 G5');
});

test('docs-gate check --json 输出可解析 JSON 且含 ok / errors 字段', (t) => {
  const root = newProject(t);
  const res = run(GATE, [root, 'check', '--json']);
  assert.equal(res.code, 1, res.out);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.ok, false);
  assert.ok(Array.isArray(parsed.errors), 'errors 应为数组');
  assert.ok(parsed.errors.length > 0, '应至少一条 error');
  assert.ok(Array.isArray(parsed.warnings), 'warnings 应为数组');
  assert.ok(parsed.errors.some((e) => e.id === 'G5'), 'errors 应含 G5');
});

// --- 2. 快照幂等 -------------------------------------------------------------

test('doc-snapshot 首跑生成 history/ 快照与 manifest.json，复跑 skip 且不改任何文件', (t) => {
  const root = newProject(t);
  const doc = join(root, PRD_DIR, `${PRD_NAME}.md`);
  const args = [doc, '--next', 'v2.0', '--note', '测试', '--ref', 'ADR-0001', '--by', '测试'];

  const first = run(SNAPSHOT, args);
  assert.equal(first.code, 0, first.out);

  const snapshotPath = join(root, PRD_DIR, 'history', `${PRD_NAME}-v1.0.md`);
  assert.ok(existsSync(snapshotPath), '应生成 history/ 快照');
  const snapshot = readFileSync(snapshotPath, 'utf8');
  assert.match(snapshot, /status:\s*archived/);
  assert.match(snapshot, /superseded-by:\s*\.\.\/PRD-x\.md/);

  const manifest = JSON.parse(readFileSync(join(root, PRD_DIR, 'history', 'manifest.json'), 'utf8'));
  assert.equal(manifest.snapshots[`${PRD_NAME}-v1.0.md`].sha256, sha256(snapshot), 'manifest sha256 应与快照磁盘内容一致');

  const bumped = readFileSync(doc, 'utf8');
  assert.match(bumped, /^version:\s*v2\.0$/m, '现版 frontmatter 应 bump 到 v2.0');
  assert.match(bumped, /^> 版本：v2\.0$/m, '现版头部版本行应 bump 到 v2.0');

  const before = treeDigest(root);
  const second = run(SNAPSHOT, args);
  assert.equal(second.code, 0, second.out);
  assert.match(second.out, /skip/i, '复跑应输出 skip');
  assert.equal(treeDigest(root), before, '幂等复跑不得改动任何文件');
});

// --- 2b. docs-governance 技能正文（AC3） -------------------------------------------

test('docs-governance 技能正文覆盖 0–12 小节、脚本路径与 MiniMax 化口径（无 DSH 专属机制词）', () => {
  const rel = 'host/minimax/skills/docs-governance/SKILL.md';
  const text = readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
  assert.match(text, /^---\nname: docs-governance\n/m, 'frontmatter 应含 name: docs-governance');
  assert.match(text, /^description:/m, 'frontmatter 应含 description');
  for (let n = 0; n <= 12; n += 1) {
    assert.ok(
      text.split('\n').some((line) => line.startsWith('## ' + n + '.')),
      '应包含小节 ## ' + n + '.',
    );
  }
  assert.match(text, /docs-gate\.mjs/, '应给出 docs-gate.mjs 脚本路径');
  assert.match(text, /doc-snapshot\.mjs/, '应给出 doc-snapshot.mjs 脚本路径');
  for (const term of ['Agent Teams', 'steward_dispatch', 'steward_board', 'configForms', 'cordis', '原生 Config', 'Config/Settings', 'DSH 构建器']) {
    assert.ok(!text.includes(term), '不应出现 DSH 专属机制词：' + term);
  }
  const tableRows = text.split('\n').filter((line) => line.startsWith('|')).length;
  assert.ok(tableRows >= 60, '正文表格规模不应缩水（当前 ' + tableRows + ' 行）');
});
// --- 3. 构建产物契约（防回归） -------------------------------------------------

test('minimax 包含 inline / docs / docs-governance / project-lifecycle 四技能，清单恰好 11 项、路径都存在、三宿主同版本', () => {
  for (const skill of ['inline', 'docs', 'docs-governance']) {
    assert.ok(existsSync(join(MX, 'skills', skill, 'SKILL.md')), `缺 minimax/skills/${skill}/SKILL.md`);
  }
  const pkg = JSON.parse(readFileSync(join(MX, '.minimax-plugin', 'plugin.json'), 'utf8'));
  // 版本口径 = AC8「三侧 manifest/package.json 的 version 均一致」，不钉死具体发版号：
  // 钉死会在每次发版时变成过期断言（1.0.1 → 1.1.0 已经这样红过一次）。
  // 基准取 host/dsh/package.json 的 version，并顺带把 DSH 侧纳入同号校验（原用例只比两宿主）。
  const dshVersion = JSON.parse(readFileSync(join(ROOT, 'host', 'dsh', 'package.json'), 'utf8')).version;
  assert.match(dshVersion, /^\d+\.\d+\.\d+$/, `DSH package.json version 应是语义化版本号，实际 "${dshVersion}"`);
  assert.equal(pkg.version, dshVersion, `MiniMax 清单 version 应与 DSH 包一致（基准 ${dshVersion}）`);
  assert.equal(pkg.skills.length, 11, 'MiniMax 清单 skills 应恰好 11 项（7 基础 + inline / docs / docs-governance / project-lifecycle）');
  // project-lifecycle 的 references/ assets/ 必须随包，否则技能正文里的相对链接在包内断链
  for (const res of ['references', 'assets']) {
    const dir = join(MX, 'skills', 'project-lifecycle', res);
    assert.ok(existsSync(dir), `minimax/skills/project-lifecycle/${res} 未随包`);
    assert.ok(readdirSync(dir).length > 0, `minimax/skills/project-lifecycle/${res} 是空目录`);
  }
  for (const rel of pkg.skills) {
    assert.ok(existsSync(join(MX, rel)), `清单列出的 ${rel} 不存在`);
  }
  const zc = JSON.parse(readFileSync(join(ROOT, 'zcode', '.zcode-plugin', 'plugin.json'), 'utf8'));
  assert.equal(zc.version, dshVersion, `ZCode 清单 version 应与 DSH 包一致（三宿主同号，基准 ${dshVersion}）`);
});

test('主技能三节已拆走只留指针，拆出技能正文承接原节', () => {
  const main = readFileSync(join(MX, 'skills', 'steward', 'SKILL.md'), 'utf8');
  for (const heading of ['## 执行模式', '## T3 文档按需升级', '## 文档流水线']) {
    assert.ok(
      !headingLines(main).some((line) => line.startsWith(heading)),
      `主技能不应再包含标题 ${heading}`,
    );
  }
  assert.match(main, /steward:inline/, '主技能应留 steward:inline 指针');
  assert.match(main, /steward:docs/, '主技能应留 steward:docs 指针');

  const inline = readFileSync(join(MX, 'skills', 'inline', 'SKILL.md'), 'utf8');
  assert.ok(
    headingLines(inline).some((line) => line.startsWith('## 执行模式')),
    'inline 技能应承接「执行模式」节',
  );
  const docs = readFileSync(join(MX, 'skills', 'docs', 'SKILL.md'), 'utf8');
  assert.ok(
    headingLines(docs).some((line) => line.startsWith('## T3 文档按需升级')),
    'docs 技能应承接「T3 文档按需升级」节',
  );
  assert.ok(
    headingLines(docs).some((line) => line.startsWith('## 文档流水线')),
    'docs 技能应承接「文档流水线」节',
  );
});

test('minimax/scripts 门禁脚本与 host/minimax/scripts 正文源逐字节一致', () => {
  for (const name of ['docs-gate.mjs', 'doc-snapshot.mjs']) {
    const packaged = readFileSync(join(MX, 'scripts', name));
    assert.ok(packaged.length > 0, `${name} 不应为空`);
    const source = readFileSync(join(HOST_SCRIPTS, name));
    assert.equal(packaged.equals(source), true, `${name} 与 host/minimax/scripts 正文源不一致`);
  }
});
