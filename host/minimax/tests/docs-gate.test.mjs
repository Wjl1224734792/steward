/**
 * docs-gate.test.mjs — MiniMax 侧「docTier=3 文档未就绪禁止派发开发子代理」硬门（PreToolUse Hook）测试。
 *
 * 覆盖：非 task 工具放行 / docTier≠3 放行 / 缺收据拒绝 / 收据未签发或评审未通过拒绝 /
 *       口径改动导致收据过期拒绝 / 收据齐备放行 / 非开发角色不受门禁限制。
 *
 * 全部跑真实进程（spawnSync 喂 stdin 事件 JSON），不 mock；
 * 临时项目夹具建在 os.tmpdir() 下，测试结束用 fs.rmSync 自行清理。
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const HOOK = join(ROOT, 'host', 'minimax', 'scripts', 'hooks', 'docs-tier-gate.mjs');
const LIB = join(ROOT, 'host', 'minimax', 'scripts', 'lib', 'docs-state.mjs');

const { computeDocsHash, defaultState, readState, writeState } = await import(pathToFileURL(LIB).href);

/** 无占位符的正文填充（避开 {{ / 待补 / TBD / （待填） 等模板痕迹，且长度过 E-DOC-THIN 阈值）。 */
const FILLER = '本文档用于验证 Steward 文档就绪收据的机检链路：说明本阶段的范围、输入、输出与验收口径，供派发硬门、文档评审与实现角色共同引用，减少开发期返工与口径漂移。';

/** 一份满足「阶段产物 / 非空壳 / 无占位符」的最小文档。 */
function docBody(title) {
  return [
    '---',
    'read: task',
    'status: active',
    'version: v1.0',
    '---',
    '',
    `# ${title}`,
    '',
    '> 版本：v1.0',
    '> 状态：生效',
    '',
    '## 1. 范围',
    '',
    FILLER,
    FILLER,
    '',
    '## 2. 验收口径',
    '',
    FILLER,
    FILLER,
    '',
  ].join('\n');
}

function write(root, rel, content) {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  return full;
}

/**
 * 建项目夹具：.git 钉住项目根（findProjectRoot 向上找 6 层也不会跑到祖先目录）。
 * @param {import('node:test').TestContext} t
 * @param {{docTier?: number|null}} [options] docTier=null 表示不写 steward.config.json。
 */
function makeProject(t, { docTier = 3 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'steward-docs-gate-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.git'), { recursive: true });
  if (docTier !== null) write(root, 'steward.config.json', `${JSON.stringify({ docTier }, null, 2)}\n`);
  return root;
}

/** 补齐 dev 门要求的全部阶段产物。 */
function writeDocs(root) {
  const files = [
    'docs/01-需求/PRD-门禁测试.md',
    'docs/01-需求/FRD-门禁测试.md',
    'docs/02-架构/门禁测试架构.md',
    'docs/02-架构/门禁测试工程化.md',
    'docs/03-契约/门禁测试数据模型.md',
    'docs/03-契约/门禁测试接口.md',
    'docs/04-专项/门禁测试专项.md',
    'docs/05-页面/门禁测试页面.md',
    'docs/05-页面/门禁测试布局.md',
    'docs/06-测试/门禁测试方案.md',
    'docs/07-治理/执行步骤.md',
    'docs/07-治理/开发顺序.md',
    'docs/07-治理/ADR-索引.md',
  ];
  for (const rel of files) write(root, rel, docBody(rel));
  return files;
}

/** 签发收据（与 docs-ready.mjs approve 同口径：ok + docsHash + review）。 */
function writeReceipt(root, { ok = true, review = { status: 'approved' }, hash } = {}) {
  writeState(root, defaultState('new'));
  const state = readState(root).state;
  state.ok = ok;
  state.docsHash = hash ?? computeDocsHash(root).hash;
  state.approvedAt = new Date().toISOString();
  state.review = review;
  writeState(root, state);
  return state;
}

/** 跑钩子：事件 JSON 走 stdin。 */
function runHook(event, cwd) {
  const payload = JSON.stringify({ ...event, cwd });
  const res = spawnSync(process.execPath, [HOOK], { input: payload, encoding: 'utf8' });
  return { code: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

/** 派发事件（MiniMax 侧用 task 工具，agent_name 形如 steward:<角色>）。 */
function taskEvent(agentName) {
  return { tool_name: 'task', tool_input: { agent_name: agentName, description: '派单', prompt: '正文' } };
}

/** 断言「放行」：exit 0 且 stdout 为空（宿主对 stdout 走严格 JSON 校验）。 */
function assertAllow(res, label) {
  assert.equal(res.code, 0, `${label} 应放行（exit 0），实际 ${res.code}：${res.stderr}`);
  assert.equal(res.stdout, '', `${label} 不得写 stdout：${res.stdout}`);
}

/** 断言「拒绝」：exit 2、stdout 为空、stderr 给出理由 + 修复命令 + 回滚提示。 */
function assertDeny(res, label) {
  assert.equal(res.code, 2, `${label} 应拒绝（exit 2），实际 ${res.code}：${res.stdout}${res.stderr}`);
  assert.equal(res.stdout, '', `${label} 不得写 stdout：${res.stdout}`);
  assert.match(res.stderr, /docs-ready\.mjs/, `${label} 理由应含修复命令：${res.stderr}`);
  assert.match(res.stderr, /docTier/, `${label} 理由应含 docTier 回滚提示：${res.stderr}`);
}

// --- 1. 非 task 工具放行 -------------------------------------------------------

test('非 task 工具事件直接放行（exit 0，stdout 空）', (t) => {
  const root = makeProject(t, { docTier: 3 });
  const res = runHook({ tool_name: 'write', tool_input: { file_path: join(root, 'a.ts'), content: 'x' } }, root);
  assertAllow(res, 'write 事件');
});

test('事件 JSON 不可解析时 fail-open（exit 0）', (t) => {
  const root = makeProject(t, { docTier: 3 });
  const res = spawnSync(process.execPath, [HOOK], { input: 'not-json', encoding: 'utf8' });
  assert.equal(res.status, 0, `坏事件应 fail-open：${res.stderr}`);
  assert.equal(res.stdout ?? '', '');
});

// --- 2. docTier≠3 放行 ---------------------------------------------------------

test('docTier=2 时不设门（exit 0）', (t) => {
  const root = makeProject(t, { docTier: 2 });
  const res = runHook(taskEvent('steward:backend-dev'), root);
  assertAllow(res, 'docTier=2 派发');
});

test('没有 steward.config.json 时按非 docTier=3 放行（exit 0）', (t) => {
  const root = makeProject(t, { docTier: null });
  const res = runHook(taskEvent('steward:backend-dev'), root);
  assertAllow(res, '无配置派发');
});

// --- 3. 缺收据拒绝 -------------------------------------------------------------

test('docTier=3 且缺 .steward/docs-state.json → 拒绝（exit 2，给缺件码与 init 命令）', (t) => {
  const root = makeProject(t, { docTier: 3 });
  const res = runHook(taskEvent('steward:backend-dev'), root);
  assertDeny(res, '缺收据派发');
  assert.match(res.stderr, /E-STATE-MISSING/, `理由应含缺件码：${res.stderr}`);
  assert.match(res.stderr, /init --scope/, `理由应含 init 命令：${res.stderr}`);
  assert.match(res.stderr, /docs-(new|takeover|feature)/, `理由应指向文档入口技能：${res.stderr}`);
});

// --- 4. 收据未签发 / 评审未通过 ------------------------------------------------

test('docTier=3 且收据 ok=false → 拒绝（exit 2）', (t) => {
  const root = makeProject(t, { docTier: 3 });
  writeDocs(root);
  writeReceipt(root, { ok: false, review: null });
  const res = runHook(taskEvent('steward:backend-dev'), root);
  assertDeny(res, '收据未签发派发');
  assert.match(res.stderr, /ok=false/, `理由应说明收据未签发：${res.stderr}`);
  assert.match(res.stderr, /approve/, `理由应给出签发命令：${res.stderr}`);
});

test('docTier=3 且评审未 approved → 拒绝（exit 2）', (t) => {
  const root = makeProject(t, { docTier: 3 });
  writeDocs(root);
  writeReceipt(root, { review: { status: 'pending' } });
  const res = runHook(taskEvent('steward:backend-dev'), root);
  assertDeny(res, '评审未通过派发');
  assert.match(res.stderr, /review="pending"/, `理由应说明评审状态：${res.stderr}`);
});

// --- 5. 口径改动 → 收据过期 ----------------------------------------------------

test('docTier=3 且口径文档被改（哈希过期）→ 拒绝（exit 2）', (t) => {
  const root = makeProject(t, { docTier: 3 });
  writeDocs(root);
  writeReceipt(root);
  write(root, 'docs/01-需求/PRD-门禁测试.md', `${docBody('PRD-门禁测试')}\n口径补写：新增一条验收条目。\n`);
  const res = runHook(taskEvent('steward:backend-dev'), root);
  assertDeny(res, '收据过期派发');
  assert.match(res.stderr, /E-STATE-STALE/, `理由应含过期码：${res.stderr}`);
});

// --- 6. 收据齐备放行 -----------------------------------------------------------

test('docTier=3 且收据 approved + 哈希一致 → 放行（exit 0）', (t) => {
  const root = makeProject(t, { docTier: 3 });
  writeDocs(root);
  writeReceipt(root);
  const res = runHook(taskEvent('steward:backend-dev'), root);
  assertAllow(res, '收据齐备派发');
});

// --- 7. 非开发角色不受门禁限制 ------------------------------------------------

test('docTier=3 缺收据时，非开发角色（reviewer / architect / pm / qa-engineer / browser-tester）仍放行', (t) => {
  const root = makeProject(t, { docTier: 3 });
  for (const role of ['steward:reviewer', 'steward:architect', 'steward:pm', 'steward:qa-engineer', 'steward:browser-tester']) {
    const res = runHook(taskEvent(role), root);
    assertAllow(res, `${role} 派发`);
  }
});

test('裸角色名（backend-dev，不带 steward: 前缀）同样受门禁限制', (t) => {
  const root = makeProject(t, { docTier: 3 });
  const res = runHook(taskEvent('backend-dev'), root);
  assertDeny(res, '裸角色名派发');
});

test('agent_name 认不出时 fail-open（exit 0）', (t) => {
  const root = makeProject(t, { docTier: 3 });
  const res = runHook({ tool_name: 'task', tool_input: { description: '没有 agent_name' } }, root);
  assertAllow(res, '无 agent_name 派发');
});

test('cwd 在项目子目录时仍向上找到项目根并拒绝（exit 2）', (t) => {
  const root = makeProject(t, { docTier: 3 });
  const sub = join(root, 'src', 'backend');
  mkdirSync(sub, { recursive: true });
  const res = runHook(taskEvent('steward:backend-dev'), sub);
  assertDeny(res, '子目录派发');
  assert.match(res.stderr, /E-STATE-MISSING/, `理由应含缺件码：${res.stderr}`);
});

test('钩子脚本存在且语法正确', () => {
  assert.ok(existsSync(HOOK), `钩子脚本应存在：${HOOK}`);
});
