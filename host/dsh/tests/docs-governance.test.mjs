/**
 * docs-governance.test.mjs — 文档治理门禁脚本的端到端用例（DSH 侧）。
 *
 * 覆盖：
 *   - docs-gate.mjs 的 check / init / fix 与 G1–G11 检查矩阵（每条都能被 fixture 触发或放行）
 *   - doc-snapshot.mjs 的九步快照算法与幂等（二次执行 skip）
 *
 * 全部在 os.tmpdir() 下建临时项目，跑真实进程，断言退出码与关键输出（G 编号 / skip），
 * 不 mock、不依赖仓库内任何真实项目文档。
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

const SCRIPTS = join(import.meta.dirname, '..', 'scripts');
const GATE = join(SCRIPTS, 'docs-gate.mjs');
const SNAPSHOT = join(SCRIPTS, 'doc-snapshot.mjs');

const PRD_DIR = 'docs/01-需求';
const PRD_NAME = 'PRD-演示';
const GOV = 'docs/07-治理';

const PRD = `---
read: task
status: active
version: v1.0
baseline: true
---

# PRD 演示

> 版本：v1.0
> 状态：生效

## 1. 背景

演示用的需求文档，正文很短，不会撞体积预算。

## 修订记录

| 版本 | 日期 | 变更摘要（FR/FP 编号） | 依据（拍板留痕） | 拍板人 | 快照 |
|---|---|---|---|---|---|
| v1.0 | 2026-10-01 | 初版 | 01-approval.md | 用户 | - |
`;

/** Run one of the bundled scripts and return its exit code plus merged output. */
function run(script, args) {
  const res = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  return { code: res.status, out: `${res.stdout ?? ''}${res.stderr ?? ''}` };
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

/** A fresh temporary project: docTier=3 config, plain AGENTS/README (no frontmatter). */
function newProject(t) {
  const root = mkdtempSync(join(tmpdir(), 'dsh-dgov-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  write(root, 'steward.config.json', `${JSON.stringify({ docTier: 3 }, null, 2)}\n`);
  write(root, 'AGENTS.md', '# AGENTS\n\n文档地图见 docs/README.md，项目记忆见 docs/project/。\n');
  write(root, 'README.md', '# Demo\n\n定位 / 快速开始 / 当前状态 / 链接。\n');
  return root;
}

/** init, then add legal living docs, then rebuild the generated index block. */
function cleanProject(t) {
  const root = newProject(t);
  const init = run(GATE, [root, 'init']);
  assert.equal(init.code, 0, `init 应成功：${init.out}`);
  write(root, `${PRD_DIR}/${PRD_NAME}.md`, PRD);
  write(root, `${PRD_DIR}/01-approval.md`, '# 需求批准\n\n- 2026-10-01 v1.0 初版批准\n');
  write(root, 'docs/02-架构/架构总纲.md', '# 架构总纲\n\n单体 + 一个本地脚本，无外部服务。\n');
  const fix = run(GATE, [root, 'fix']);
  assert.equal(fix.code, 0, `fix 应成功：${fix.out}`);
  return root;
}

/** Write a history snapshot plus its README index row and manifest entry. */
function addSnapshot(root, { version = 'v0.9', badHash = false } = {}) {
  const rel = `${PRD_DIR}/history/${PRD_NAME}-${version}.md`;
  const body = `---
status: archived
version: ${version}
superseded-by: ../${PRD_NAME}.md
---

> ⚠ 已被 v1.0 取代 → 现版：../${PRD_NAME}.md（本文件为历史快照，不可修改）

# PRD 演示（${version}）

> 版本：${version}

## 修订记录

| 版本 | 日期 | 变更摘要（FR/FP 编号） | 依据（拍板留痕） | 拍板人 | 快照 |
|---|---|---|---|---|---|
| ${version} | 2026-09-01 | 基线 | 01-approval.md | 用户 | - |
`;
  write(root, rel, body);
  const readme = join(root, PRD_DIR, 'history', 'README.md');
  writeFileSync(
    readme,
    `${readFileSync(readme, 'utf8').replace(/\n+$/, '')}\n| ${version} | 2026-09-01 | 基线 | 01-approval.md | [快照](${PRD_NAME}-${version}.md) |\n`,
    'utf8',
  );
  write(
    root,
    `${PRD_DIR}/history/manifest.json`,
    `${JSON.stringify({
      version: 1,
      snapshots: {
        [`${PRD_NAME}-${version}.md`]: {
          sha256: badHash ? '0'.repeat(64) : sha256(body),
          bytes: Buffer.byteLength(body, 'utf8'),
          takenAt: '2026-09-01',
        },
      },
    }, null, 2)}\n`,
  );
  return rel;
}

// --- CLI surface -----------------------------------------------------------

test('docs-gate --help prints usage and exits 0', () => {
  const help = run(GATE, ['--help']);
  assert.equal(help.code, 0, help.out);
  assert.match(help.out, /check/);
  assert.match(help.out, /init/);
  assert.match(help.out, /fix/);
});

test('docs-gate rejects a missing root with exit 2', (t) => {
  const root = newProject(t);
  const missing = run(GATE, [join(root, 'nope'), 'check']);
  assert.equal(missing.code, 2, missing.out);
});

test('docs-gate init scaffolds the 07 layers, history dirs and an index block, and is idempotent', (t) => {
  const root = newProject(t);
  const first = run(GATE, [root, 'init']);
  assert.equal(first.code, 0, first.out);
  for (const rel of [
    `${GOV}/adr`,
    `${GOV}/评审记录`,
    `${GOV}/执行步骤.md`,
    `${GOV}/开发顺序.md`,
    `${GOV}/评审状态.md`,
    `${GOV}/ADR-索引.md`,
    `${PRD_DIR}/history/README.md`,
    `${PRD_DIR}/history/manifest.json`,
    'docs/README.md',
    'docs/governance-baseline.json',
  ]) {
    assert.ok(existsSync(join(root, rel)), `init 应创建 ${rel}`);
  }
  const readme = readFileSync(join(root, 'docs/README.md'), 'utf8');
  assert.match(readme, /<!-- docs-gate:index:begin -->/);
  assert.match(readme, /<!-- docs-gate:index:end -->/);

  // A freshly initialised project is already green.
  const check = run(GATE, [root, 'check']);
  assert.equal(check.code, 0, `init 后应立即绿灯：${check.out}`);

  // Idempotent: a second init changes nothing and still exits 0.
  const before = readFileSync(join(root, 'docs/README.md'), 'utf8');
  const second = run(GATE, [root, 'init']);
  assert.equal(second.code, 0, second.out);
  assert.equal(readFileSync(join(root, 'docs/README.md'), 'utf8'), before, 'init 不得覆盖已有文件');
});

test('docs-gate --json reports a machine-readable result', (t) => {
  const root = cleanProject(t);
  const res = run(GATE, [root, 'check', '--json']);
  assert.equal(res.code, 0, res.out);
  const parsed = JSON.parse(res.out);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.tier, 3);
  assert.ok(Array.isArray(parsed.errors));
  assert.ok(Array.isArray(parsed.warnings));
  assert.equal(typeof parsed.checked.docs, 'number');
});

// --- G1–G11 ----------------------------------------------------------------

test('G1 flags a living document that outgrows its budget', (t) => {
  const root = cleanProject(t);
  const oversized = `# 后端工程化\n\n${Array.from({ length: 450 }, (_, i) => `第 ${i + 1} 行正文。`).join('\n')}\n`;
  write(root, 'docs/02-架构/后端工程化.md', oversized);
  run(GATE, [root, 'fix']);
  const res = run(GATE, [root, 'check']);
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /G1/);
});

test('G2 rejects read: dir without a scope', (t) => {
  const root = cleanProject(t);
  write(root, 'docs/02-架构/分册.md', '---\nread: dir\n---\n\n# 分册\n\n正文。\n');
  run(GATE, [root, 'fix']);
  const res = run(GATE, [root, 'check']);
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /G2/);
});

test('G3 rejects frontmatter on AGENTS.md', (t) => {
  const root = cleanProject(t);
  write(root, 'AGENTS.md', '---\nread: always\n---\n\n# AGENTS\n\n文档地图见 docs/README.md。\n');
  const res = run(GATE, [root, 'check']);
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /G3/);
});

test('G4 rejects a review record sitting in the 07 root', (t) => {
  const root = cleanProject(t);
  write(root, `${GOV}/评审记录-20261112-x.md`, '# 评审记录 x\n\n结论：可进入架构。\n');
  const res = run(GATE, [root, 'check']);
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /G4/);
});

test('G5 flags an archived file missing from the index block, and fix turns it green', (t) => {
  const root = cleanProject(t);
  write(root, `${GOV}/评审记录/archive/2026Q3/评审记录-20260701-旧基线.md`, '# 旧评审\n\n结论：通过。\n');
  const red = run(GATE, [root, 'check']);
  assert.equal(red.code, 1, red.out);
  assert.match(red.out, /G5/);
  const fix = run(GATE, [root, 'fix']);
  assert.equal(fix.code, 0, fix.out);
  const green = run(GATE, [root, 'check']);
  assert.equal(green.code, 0, `fix 后应绿灯：${green.out}`);
});

test('G6 flags an ADR that is missing from ADR-索引.md', (t) => {
  const root = cleanProject(t);
  write(root, `${GOV}/adr/ADR-0001-演示决策.md`, '# ADR-0001 · 演示决策\n\n> 状态：接受\n> 日期：2026-10-01\n> 决策者：用户\n\n## 背景\n\n演示。\n');
  run(GATE, [root, 'fix']);
  const res = run(GATE, [root, 'check']);
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /G6/);
});

test('G7 flags a frontmatter version that disagrees with the revision table', (t) => {
  const root = cleanProject(t);
  const bumped = PRD.replace('version: v1.0', 'version: v1.1').replace('> 版本：v1.0', '> 版本：v1.1');
  write(root, `${PRD_DIR}/${PRD_NAME}.md`, bumped);
  const res = run(GATE, [root, 'check']);
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /G7/);
});

test('G8 flags a snapshot whose sha256 no longer matches the manifest', (t) => {
  const root = cleanProject(t);
  addSnapshot(root, { version: 'v0.9', badHash: true });
  run(GATE, [root, 'fix']);
  const res = run(GATE, [root, 'check']);
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /G8/);
});

test('G9 flags a current version that also exists as a history snapshot', (t) => {
  const root = cleanProject(t);
  addSnapshot(root, { version: 'v1.0' });
  run(GATE, [root, 'fix']);
  const res = run(GATE, [root, 'check']);
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /G9/);
});

test('G10 warns (and errors under --strict) on a revision row without evidence', (t) => {
  const root = cleanProject(t);
  const withEmptyEvidence = PRD.replace(
    '| v1.0 | 2026-10-01 | 初版 | 01-approval.md | 用户 | - |',
    '| v1.0 | 2026-10-01 | 初版 | | 用户 | - |',
  );
  write(root, `${PRD_DIR}/${PRD_NAME}.md`, withEmptyEvidence);
  const lenient = run(GATE, [root, 'check']);
  assert.equal(lenient.code, 0, `缺依据默认只告警：${lenient.out}`);
  assert.match(lenient.out, /G10/);
  const strict = run(GATE, [root, 'check', '--strict']);
  assert.equal(strict.code, 1, `--strict 应把 G10 升为 error：${strict.out}`);
  assert.match(strict.out, /G10/);
});

test('G11 flags a docTier=3 plan task without docsRead', (t) => {
  const root = cleanProject(t);
  write(root, '03-plan.json', `${JSON.stringify({ level: 'M', tasks: [{ id: 'T1', role: 'backend-dev' }] }, null, 2)}\n`);
  const res = run(GATE, [root, 'check']);
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /G11/);
});

test('G11 accepts a plan whose docsRead points at real documents', (t) => {
  const root = cleanProject(t);
  write(root, '03-plan.json', `${JSON.stringify({
    level: 'M',
    tasks: [{ id: 'T1', role: 'backend-dev', docsRead: [`${PRD_DIR}/${PRD_NAME}.md`] }],
  }, null, 2)}\n`);
  const res = run(GATE, [root, 'check']);
  assert.equal(res.code, 0, res.out);
});

// --- doc-snapshot ----------------------------------------------------------

test('doc-snapshot archives the baseline, bumps the current doc, and is idempotent', (t) => {
  const root = cleanProject(t);
  const args = [join(root, PRD_DIR, `${PRD_NAME}.md`), '--next', 'v1.1', '--note', '段 2 阈值调整', '--ref', '01-approval.md', '--by', '用户'];
  const first = run(SNAPSHOT, args);
  assert.equal(first.code, 0, first.out);

  const snapshotPath = join(root, PRD_DIR, 'history', `${PRD_NAME}-v1.0.md`);
  assert.ok(existsSync(snapshotPath), '快照文件应落在同域 history/');
  const snapshot = readFileSync(snapshotPath, 'utf8');
  assert.match(snapshot, /status:\s*archived/);
  assert.match(snapshot, /superseded-by:\s*\.\.\/PRD-演示\.md/);
  assert.match(snapshot, /已被 v1\.1 取代/);

  // The current document is bumped in all three places.
  const current = readFileSync(join(root, PRD_DIR, `${PRD_NAME}.md`), 'utf8');
  assert.match(current, /^version:\s*v1\.1$/m);
  assert.match(current, /^> 版本：v1\.1$/m);
  assert.match(current, /\| v1\.1 \|/);
  assert.match(current, /\[v1\.0\]\(history\/PRD-演示-v1\.0\.md\)/);

  // The manifest hash recomputes from the snapshot bytes on disk.
  const manifest = JSON.parse(readFileSync(join(root, PRD_DIR, 'history', 'manifest.json'), 'utf8'));
  const entry = manifest.snapshots[`${PRD_NAME}-v1.0.md`];
  assert.ok(entry, 'manifest 应记录该快照');
  assert.equal(entry.sha256, sha256(snapshot));
  assert.equal(entry.bytes, Buffer.byteLength(snapshot, 'utf8'));

  // history/README.md indexes the snapshot, and the snapshot is in docs/README.md.
  const historyReadme = readFileSync(join(root, PRD_DIR, 'history/README.md'), 'utf8');
  assert.match(historyReadme, new RegExp(`\\[快照\\]\\(${PRD_NAME}-v1\\.0\\.md\\)`));
  const docsReadme = readFileSync(join(root, 'docs/README.md'), 'utf8');
  assert.ok(docsReadme.includes('01-需求/history/PRD-演示-v1.0.md'), '快照必须进自动索引区块');

  // The governance gate stays green after a snapshot.
  const check = run(GATE, [root, 'check']);
  assert.equal(check.code, 0, `快照后应绿灯：${check.out}`);

  // A second identical run is a no-op that reports skip.
  const second = run(SNAPSHOT, args);
  assert.equal(second.code, 0, second.out);
  assert.match(second.out, /skip/i);
  assert.equal(readFileSync(snapshotPath, 'utf8'), snapshot, '幂等：快照不得被重写');
  assert.equal(readFileSync(join(root, PRD_DIR, `${PRD_NAME}.md`), 'utf8'), current, '幂等：现版不得被重复追加');
});

test('doc-snapshot refuses a hand-edited immutable snapshot', (t) => {
  const root = cleanProject(t);
  const doc = join(root, PRD_DIR, `${PRD_NAME}.md`);
  const args = [doc, '--next', 'v1.1', '--note', '首次冻结', '--ref', '01-approval.md', '--by', '用户'];
  assert.equal(run(SNAPSHOT, args).code, 0);
  const snapshotPath = join(root, PRD_DIR, 'history', `${PRD_NAME}-v1.0.md`);
  writeFileSync(snapshotPath, `${readFileSync(snapshotPath, 'utf8')}\n手改的一行。\n`, 'utf8');
  const res = run(SNAPSHOT, args);
  assert.equal(res.code, 1, res.out);
  assert.match(res.out, /不可变|已存在|手改/);
});

test('doc-snapshot rejects --next equal to the current version and a malformed --next', (t) => {
  const root = cleanProject(t);
  const doc = join(root, PRD_DIR, `${PRD_NAME}.md`);
  const same = run(SNAPSHOT, [doc, '--next', 'v1.0']);
  assert.equal(same.code, 1, same.out);
  const bad = run(SNAPSHOT, [doc, '--next', 'next']);
  assert.equal(bad.code, 1, bad.out);
  const usage = run(SNAPSHOT, []);
  assert.equal(usage.code, 2, usage.out);
});

test('doc-snapshot requires a frontmatter version instead of guessing one', (t) => {
  const root = cleanProject(t);
  write(root, `${PRD_DIR}/无版本.md`, '# 无版本\n\n> 版本：v3.0\n\n正文。\n');
  const res = run(SNAPSHOT, [join(root, PRD_DIR, '无版本.md'), '--next', 'v3.1']);
  assert.equal(res.code, 1, res.out);
});
