/**
 * docs-ready.test.mjs — 文档就绪闭环门的端到端用例（DSH 侧）。
 *
 * 覆盖：
 *   - init / check / approve / status 四条子命令与退出码契约
 *   - 检查矩阵：缺状态、缺阶段目录、缺必填件、占位符、空壳、na 无理由、计划 docsRead
 *   - 收据：评审机读块、评审状态表索引、签发后哈希失效（含 hashExclude 有效）
 *
 * 全部在 os.tmpdir() 下建临时项目，跑真实进程，不 mock。
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

const SCRIPT = join(import.meta.dirname, '..', 'scripts', 'docs-ready.mjs');
const REVIEW = 'docs/07-治理/评审记录/评审记录-20261116-契约.md';
const STATUS = 'docs/07-治理/评审状态.md';

const REVIEW_BODY = `# 评审记录：契约冻结 ｜ 2026-11-16

## 结论（先行）
可进入开发。

## 一、机械修复项

| # | 位置 | 问题 | 修法 | 状态 |
|---|---|---|---|---|
| 1 | API接口.md:12 | 错误码未列号段 | 补号段表 | 已修 |

<!-- docs-review:begin -->
{"status":"approved","blocking":0,"scope":"feature","reviewedAt":"2026-11-16T22:40:00+08:00"}
<!-- docs-review:end -->
`;

const API_DOC = `# API 接口契约

## 基础约定

- BaseURL：/api
- 认证：Bearer
- 统一信封：{ code, data, message }

## 错误码号段

| 号段 | 含义 |
|---|---|
| 4001 | 参数校验失败 |
| 4002 | 权限不足 |

## 端点清单

| 方法 | 路径 | 入参 | 出参 | 错误码 | 权限 |
|---|---|---|---|---|---|
| GET | /api/items | q | list | 4001 | read |
| POST | /api/items | body | item | 4002 | write |

说明：权限主体一律从认证凭据解析，不信任请求体。
`;

const DATA_MODEL = `# 数据模型

## ER 总览

- items：主表，含 tenant_id 行级隔离字段
- item_logs：审计表，只追加

## DDL

| 表 | 字段 | 类型 | 约束 |
|---|---|---|---|
| items | id | uuid | pk |
| items | tenant_id | uuid | 非空，行级隔离 |
| items | deleted_at | timestamptz | 软删，进唯一约束 |

## 口径注释

软删与唯一约束组合：unique (tenant_id, code, deleted_at)；审计表只追加不更新。
`;

function project(t) {
  const dir = mkdtempSync(join(tmpdir(), 'docs-ready-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function write(root, rel, text) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text, 'utf8');
}

function readJson(root, rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'));
}

function patchState(root, mutate) {
  const rel = '.steward/docs-state.json';
  const state = readJson(root, rel);
  mutate(state);
  write(root, rel, `${JSON.stringify(state, null, 2)}\n`);
}

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

/** init（feature 范围只要 03-契约）+ 契约文档 + 评审记录 + 评审状态表。 */
function stageReady(t) {
  const root = project(t);
  const init = run([root, 'init', '--scope', 'feature', '--require', '03-契约', '--write']);
  assert.equal(init.status, 0, init.stderr);
  write(root, 'docs/03-契约/API接口.md', API_DOC);
  write(root, 'docs/03-契约/数据模型.md', DATA_MODEL);
  write(root, STATUS, '# 评审状态\n\n| 阶段 | 最新结论 | 日期 | 评审记录 |\n|---|---|---|---|\n| 契约 | 通过 | 2026-11-16 | 评审记录-20261116-契约.md |\n');
  write(root, REVIEW, REVIEW_BODY);
  return root;
}

test('--help prints usage and exits 0', () => {
  const res = run(['--help']);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /docs-ready\.mjs/);
  assert.match(res.stdout, /init/);
  assert.match(res.stdout, /approve/);
});

test('a missing root exits 2', () => {
  const res = run([join(tmpdir(), 'docs-ready-does-not-exist-xyz'), 'check']);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /根目录不存在/);
});

test('check without a state file reports E-STATE-MISSING and exits 1', (t) => {
  const root = project(t);
  const res = run([root, 'check', '--json']);
  assert.equal(res.status, 1);
  const parsed = JSON.parse(res.stdout);
  assert.equal(parsed.ok, false);
  assert.ok(parsed.errors.some((error) => error.id === 'E-STATE-MISSING'), res.stdout);
});

test('init is dry-run by default and idempotent with --write', (t) => {
  const root = project(t);
  const dry = run([root, 'init', '--scope', 'new', '--json']);
  assert.equal(dry.status, 0);
  assert.equal(JSON.parse(dry.stdout).written, false);
  assert.equal(existsSync(join(root, '.steward/docs-state.json')), false, 'dry-run must not write');

  const first = run([root, 'init', '--scope', 'new', '--write', '--json']);
  assert.equal(first.status, 0);
  const parsed = JSON.parse(first.stdout);
  assert.equal(parsed.written, true);
  assert.equal(parsed.required.length, 8, 'scope=new requires all eight phase entries');

  const state = readJson(root, '.steward/docs-state.json');
  const before = JSON.stringify(state);
  const second = run([root, 'init', '--scope', 'feature', '--write', '--json']);
  assert.equal(second.status, 0);
  assert.equal(JSON.parse(second.stdout).skipped, true);
  assert.equal(JSON.stringify(readJson(root, '.steward/docs-state.json')), before, 'init must never overwrite');
});

test('init rejects an unknown --scope and an unknown --require id', (t) => {
  const root = project(t);
  assert.equal(run([root, 'init', '--scope', 'bogus']).status, 2);
  assert.equal(run([root, 'init', '--scope', 'feature', '--require', '99-不存在']).status, 2);
});

test('feature scope marks the untouched phases na with a reason', (t) => {
  const root = project(t);
  assert.equal(run([root, 'init', '--scope', 'feature', '--require', '03-契约', '--write']).status, 0);
  const state = readJson(root, '.steward/docs-state.json');
  const contract = state.phases.find((phase) => phase.id === '03-契约');
  assert.equal(contract.status, 'required');
  const requirements = state.phases.find((phase) => phase.id === '01-需求');
  assert.equal(requirements.status, 'na');
  assert.ok(requirements.reason.trim() !== '', 'na needs a reviewable reason');
});

test('check reports a missing phase directory', (t) => {
  const root = project(t);
  run([root, 'init', '--scope', 'feature', '--require', '03-契约', '--write']);
  const res = run([root, 'check', '--json']);
  assert.equal(res.status, 1);
  assert.ok(JSON.parse(res.stdout).errors.some((error) => error.id === 'E-PHASE-DIR'), res.stdout);
});

test('check catches a required doc pattern that matches nothing', (t) => {
  const root = project(t);
  run([root, 'init', '--scope', 'feature', '--require', '03-契约', '--write']);
  write(root, 'docs/03-契约/API接口.md', API_DOC);
  const res = run([root, 'check', '--json']);
  assert.equal(res.status, 1);
  const parsed = JSON.parse(res.stdout);
  assert.ok(parsed.errors.some((error) => error.id === 'E-DOC-MISSING' && /数据模型/.test(error.message)), res.stdout);
});

test('check catches template placeholders and empty shells', (t) => {
  const root = project(t);
  run([root, 'init', '--scope', 'feature', '--require', '03-契约', '--write']);
  write(root, 'docs/03-契约/API接口.md', `${API_DOC}\nTODO(拍板) 这个号段还没定。\n`);
  write(root, 'docs/03-契约/数据模型.md', '# 数据模型\n\n待补\n');
  const res = run([root, 'check', '--json']);
  assert.equal(res.status, 1);
  const ids = JSON.parse(res.stdout).errors.map((error) => error.id);
  assert.ok(ids.includes('E-DOC-PLACEHOLDER'), res.stdout);
  assert.ok(ids.includes('E-DOC-THIN'), res.stdout);
});

test('check catches an na phase without a reason', (t) => {
  const root = project(t);
  run([root, 'init', '--scope', 'feature', '--require', '03-契约', '--write']);
  patchState(root, (state) => {
    state.phases.find((phase) => phase.id === '01-需求').reason = '   ';
  });
  const res = run([root, 'check', '--json']);
  assert.equal(res.status, 1);
  assert.ok(JSON.parse(res.stdout).errors.some((error) => error.id === 'E-NA-REASON'), res.stdout);
});

test('check validates plan docsRead: empty, missing path, and a phase marked na', (t) => {
  const root = project(t);
  run([root, 'init', '--scope', 'feature', '--require', '03-契约', '--write']);
  write(root, 'docs/03-契约/API接口.md', API_DOC);
  write(root, 'docs/03-契约/数据模型.md', DATA_MODEL);
  // 01 在 feature 范围里是 na；计划却引用了它，必须冲突。
  write(root, 'docs/01-需求/PRD-演示.md', '# PRD 演示\n\n本文件只用于验证「计划引用 na 阶段」这条判定。\n');
  write(root, 'run/03-plan.json', JSON.stringify({
    tasks: [
      { id: 'T1', role: 'backend-dev', docsRead: [] },
      { id: 'T2', role: 'backend-dev', docsRead: ['docs/03-契约/不存在.md'] },
      { id: 'T3', role: 'backend-dev', docsRead: ['docs/01-需求/PRD-演示.md'] },
    ],
  }));
  const res = run([root, 'check', '--plan', 'run/03-plan.json', '--json']);
  assert.equal(res.status, 1);
  const ids = JSON.parse(res.stdout).errors.map((error) => error.id);
  assert.ok(ids.includes('E-PLAN-DOCSREAD'), res.stdout);
  assert.ok(ids.includes('E-PLAN-NA-CONFLICT'), res.stdout);
});

test('approve requires an existing review record with an approved machine block', (t) => {
  const root = stageReady(t);
  const missing = run([root, 'approve', '--review', 'docs/07-治理/评审记录/无此记录.md', '--json']);
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /E-REVIEW-MISSING/);

  write(root, REVIEW, '# 评审记录\n\n结论：修复后可。\n');
  const noBlock = run([root, 'approve', '--review', REVIEW, '--json']);
  assert.equal(noBlock.status, 1);
  assert.match(noBlock.stdout, /E-REVIEW-NOT-APPROVED/);

  write(root, REVIEW, REVIEW_BODY.replace('"approved"', '"changes-requested"'));
  const rejected = run([root, 'approve', '--review', REVIEW, '--json']);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stdout, /E-REVIEW-NOT-APPROVED/);
});

test('approve refuses when the record is not listed in 评审状态.md', (t) => {
  const root = stageReady(t);
  write(root, STATUS, '# 评审状态\n\n| 阶段 | 最新结论 | 日期 | 评审记录 |\n|---|---|---|---|\n');
  const res = run([root, 'approve', '--review', REVIEW, '--json']);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /E-REVIEW-UNINDEXED/);
});

test('approve issues a receipt, status reports READY, and a doc edit turns it stale', (t) => {
  const root = stageReady(t);
  const ok = run([root, 'approve', '--review', REVIEW, '--json']);
  assert.equal(ok.status, 0, ok.stderr);
  const issued = JSON.parse(ok.stdout);
  assert.equal(issued.ok, true);
  assert.match(issued.docsHash, /^sha256:[0-9a-f]{64}$/);

  const state = readJson(root, '.steward/docs-state.json');
  assert.equal(state.ok, true);
  assert.equal(state.review.status, 'approved');
  assert.equal(state.docsHash, issued.docsHash);

  assert.equal(run([root, 'status', '--json']).status, 0);

  write(root, 'docs/03-契约/API接口.md', `${API_DOC}\n新增一条口径变更。\n`);
  const stale = run([root, 'check', '--json']);
  assert.equal(stale.status, 1);
  assert.ok(JSON.parse(stale.stdout).errors.some((error) => error.id === 'E-STATE-STALE'), stale.stdout);
  assert.equal(run([root, 'status', '--json']).status, 1, 'status must fail while stale');
});

test('bookkeeping docs excluded from the hash do not invalidate the receipt', (t) => {
  const root = stageReady(t);
  assert.equal(run([root, 'approve', '--review', REVIEW]).status, 0);
  write(root, 'docs/07-治理/执行步骤.md', '# 执行步骤\n\n| 项 | 状态 |\n|---|---|\n| T1 契约 | 完成 |\n');
  write(root, STATUS, `${readFileSync(join(root, STATUS), 'utf8')}| 契约 | 通过（复核） | 2026-11-16 | 评审记录-20261116-契约.md |\n`);
  const res = run([root, 'check', '--json']);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(run([root, 'status', '--json']).status, 0);
});

test('FR↔FP traceability is a warning by default and an error under --strict', (t) => {
  const root = project(t);
  run([root, 'init', '--scope', 'feature', '--require', '01-需求', '--write']);
  write(root, 'docs/01-需求/PRD-导出.md', `# PRD 导出

## 背景与痛点

运营每周手工整理导出数据，平均耗时 3 小时，且口径不一致导致对账差异；目标是让业务方自助导出，把口径收敛到服务端一处。

## 角色与权限

| 角色 | 可导出范围 | 备注 |
|---|---|---|
| 运营 | 本租户全量 | 需审批后放开大文件 |
| 财务 | 本租户对账子集 | 只读 |
| 管理员 | 本租户全量 | 可配置上限 |

## 功能需求

- FR-1 按筛选条件导出 CSV，单次上限 10 万行
- FR-2 按筛选条件导出 XLSX，单次上限 5 万行

## 验收标准

- AC1 导出接口返回 200 且文件可被 Excel 打开
- AC2 超出上限返回错误码 4101，且不产生部分文件

## 范围与非目标

本期做筛选导出与上限校验；本期不做定时导出、不做邮件推送、不做跨租户导出。

## 成功指标

- 运营手工整理耗时从 3 小时降到 10 分钟以内
- 对账差异工单数量下降 50%
`);
  write(root, 'docs/01-需求/FRD-导出.md', `# FRD 导出

## 追溯总表

| FR | FP | 说明 |
|---|---|---|
| FR-1 | FP-1.1 | CSV 导出过滤与分页 |

## 逐功能点

### FP-1.1 CSV 导出

- 输入：筛选条件（时间区间、状态）、目标行数上限
- 校验：上限 100000，超出返回错误码 4101，不落半成品文件
- 处理规则：先校验再取数，取数走流式，避免一次性载入内存
- 输出：CSV 文件流，字段顺序固定，表头使用中文列名
- 权限与数据范围：按认证凭据解析租户与角色，行级过滤，不信任请求体
- 异常与错误码：4101 超上限；4102 筛选条件非法；4103 无导出权限

### FP-2.1 XLSX 导出

- 输入：同 FP-1.1
- 校验：上限 50000
- 输出：XLSX 文件，首行冻结，数值列保持数字类型
- 异常与错误码：复用 4101–4103

## 跨功能约束

导出任务必须可审计：记录操作人、筛选条件、行数、结果状态。
`);
  const loose = run([root, 'check', '--json']);
  assert.equal(loose.status, 0, loose.stdout);
  assert.ok(JSON.parse(loose.stdout).warnings.some((warning) => warning.id === 'W-TRACE-FR'), loose.stdout);

  const strict = run([root, 'check', '--strict', '--json']);
  assert.equal(strict.status, 1);
  assert.ok(JSON.parse(strict.stdout).errors.some((error) => error.id === 'E-TRACE-FR'), strict.stdout);
});

test('a stale receipt can be re-issued after a legitimate document edit', (t) => {
  const root = stageReady(t);
  assert.equal(run([root, 'approve', '--review', REVIEW]).status, 0);

  write(root, 'docs/03-契约/API接口.md', `${API_DOC}\n新增一条口径变更。\n`);
  assert.equal(run([root, 'check']).status, 1, 'check must report the stale receipt');
  assert.equal(run([root, 'status']).status, 1);

  // approve replaces the receipt; staleness of the old one must not deadlock it.
  const reissue = run([root, 'approve', '--review', REVIEW, '--json']);
  assert.equal(reissue.status, 0, reissue.stdout);
  assert.equal(run([root, 'status', '--json']).status, 0);
});

test('an unknown subcommand exits 2', (t) => {
  const root = project(t);
  const res = run([root, 'bogus']);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /未知子命令/);
});
