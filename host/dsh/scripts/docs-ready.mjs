#!/usr/bin/env node
/**
 * docs-ready.mjs — 文档就绪闭环门（DSH 宿主，零依赖）。
 *
 * 把「文档能不能支撑开发」变成一次可复跑的机检：阶段产物、空壳、占位符、
 * 索引外的必填件、FR↔FP 追溯、计划 docsRead、评审机读结论，逐项给码。
 * 通过后签发收据（`ok:true` + docsHash）；`steward_dispatch` 在派开发前校验
 * 同一份收据与同一个哈希，口径一改立即失效。
 *
 * 用法：
 *   node docs-ready.mjs <root> init --scope <new|takeover|feature> [--require <阶段id>]... [--write] [--json]
 *   node docs-ready.mjs <root> check [--gate dev|delivery] [--plan <03-plan.json>] [--strict] [--json]
 *   node docs-ready.mjs <root> approve --review <评审记录> [--gate dev|delivery] [--plan <...>] [--json]
 *   node docs-ready.mjs <root> status [--json]
 *   node docs-ready.mjs --help
 *
 * 退出码：0 = 通过（允许 warning）；1 = 有 error / 收据缺失或过期；2 = 用法或根目录错误。
 * 约定：--json 时 stdout 只有 JSON；人读模式下 warning 走 stdout、error 走 stderr。
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, resolve } from 'node:path';
import {
  DEFAULT_HASH_EXCLUDE,
  PHASE_IDS,
  REVIEW_BEGIN,
  REVIEW_END,
  SCOPES,
  STATE_REL,
  checkReadiness,
  computeDocsHash,
  defaultState,
  parseReviewRecord,
  readState,
  statePath,
  validateState,
  writeState,
} from './lib/docs-state.mjs';

const USAGE = `用法：
  node docs-ready.mjs <root> init --scope <new|takeover|feature> [--require <阶段id>]... [--write] [--json]
  node docs-ready.mjs <root> check [--gate dev|delivery] [--plan <03-plan.json>] [--strict] [--json]
  node docs-ready.mjs <root> approve --review <评审记录> [--gate dev|delivery] [--plan <...>] [--json]
  node docs-ready.mjs <root> status [--json]
  node docs-ready.mjs --help

命令：
  init     写初始状态 ${STATE_REL}（默认 dry-run；--write 才落盘；已存在一律跳过不覆盖）
  check    跑就绪机检：阶段产物 / 空壳 / 占位符 / na 理由 / FR↔FP 追溯 / 计划 docsRead / 收据是否过期
  approve  在 check 通过且评审记录为 approved 时签发收据（ok + docsHash + approvedAt）
  status   打印收据现状与实时哈希比较（派发门用同一判据）

选项：
  --scope <new|takeover|feature>  文档入口范围
  --require <阶段id>              feature 范围下改成 required 的阶段（可重复）
  --gate <dev|delivery>           只判该归属的阶段（默认 dev）
  --plan <03-plan.json>           校验任务 docsRead 与阶段声明是否对得上
  --strict                        追溯类 warning 升为 error
  --json                          机读输出
  --help                          打印本帮助（exit 0）

阶段 id：${PHASE_IDS.join('、')}
`;

const GATES = ['dev', 'delivery'];

// --- args -------------------------------------------------------------------

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}

const flag = (name) => args.includes(`--${name}`);
const valueOf = (name) => {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return null;
  const value = args[index + 1];
  return value !== undefined && !value.startsWith('--') ? value : '';
};
const valuesOf = (name) => {
  const out = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index + 1];
    if (args[index] === `--${name}` && value !== undefined && !value.startsWith('--')) out.push(value);
  }
  return out;
};

const positional = args.filter((arg) => !arg.startsWith('--'));
const root = resolve(positional[0] ?? process.cwd());
const command = positional[1] ?? 'check';
const asJson = flag('json');

function fail(code, message) {
  if (asJson) console.log(JSON.stringify({ ok: false, root, error: message }, null, 2));
  else console.error(`[docs-ready] ${message}`);
  process.exit(code);
}

if (!existsSync(root) || !statSync(root).isDirectory()) fail(2, `根目录不存在：${root}`);

const gate = valueOf('gate') ?? 'dev';
if (!GATES.includes(gate)) fail(2, `--gate 必须是 ${GATES.join(' / ')}（收到 ${valueOf('gate') ?? '空'}）`);
const planPath = valueOf('plan');
const strict = flag('strict');

function printLines(items, symbol, sink) {
  for (const item of items) {
    const where = item.file ? `${item.file} — ` : '';
    sink(`  ${symbol} ${item.id} ${where}${item.message}`);
  }
}

function printCheck(result) {
  if (!result.ok) {
    for (const warning of result.warnings) console.log(`  ⚠ ${warning.id} ${warning.file ? `${warning.file} — ` : ''}${warning.message}`);
    for (const error of result.errors) console.error(`  ✗ ${error.id} ${error.file ? `${error.file} — ` : ''}${error.message}`);
    console.error(
      `[docs-ready] FAIL — scope=${result.info.scope ?? '?'} gate=${gate}；error ${result.errors.length} / warning ${result.warnings.length}`,
    );
    if (result.info.pendingDelivery.length > 0) {
      console.error(`  · 交付前还需补：${result.info.pendingDelivery.join('、')}（--gate delivery）`);
    }
    return;
  }
  for (const warning of result.warnings) console.log(`  ⚠ ${warning.id} ${warning.file ? `${warning.file} — ` : ''}${warning.message}`);
  console.log(
    `[docs-ready] PASS — scope=${result.info.scope} gate=${gate}；检查 ${result.info.files} 份文档；warning ${result.warnings.length}`,
  );
  if (result.info.pendingDelivery.length > 0) {
    console.log(`  · 交付前还需补：${result.info.pendingDelivery.join('、')}（--gate delivery）`);
  }
}

// --- commands ---------------------------------------------------------------

function runInit() {
  const scope = valueOf('scope');
  if (!SCOPES.includes(scope)) fail(2, `init 需要 --scope ${SCOPES.join(' | ')}`);
  const requireIds = valuesOf('require');
  const unknown = requireIds.filter((id) => !PHASE_IDS.includes(id));
  if (unknown.length > 0) fail(2, `--require 有未知阶段：${unknown.join('、')}（可选：${PHASE_IDS.join('、')}）`);

  const file = statePath(root);
  if (existsSync(file)) {
    if (asJson) {
      console.log(JSON.stringify({ ok: true, root, file: STATE_REL, skipped: true, reason: '状态文件已存在，init 不覆盖' }, null, 2));
    } else {
      console.log(`[docs-ready] 跳过：${STATE_REL} 已存在（init 不覆盖；改范围请直接编辑状态文件）`);
    }
    return 0;
  }

  const state = defaultState(scope, requireIds);
  const required = state.phases.filter((phase) => phase.status === 'required').map((phase) => phase.id);
  const na = state.phases.filter((phase) => phase.status === 'na').map((phase) => phase.id);
  const write = flag('write');
  if (write) writeState(root, state);

  if (asJson) {
    console.log(JSON.stringify({ ok: true, root, file: STATE_REL, written: write, scope, required, na }, null, 2));
  } else {
    console.log(`[docs-ready] ${write ? '已写入' : 'dry-run（加 --write 落盘）'}：${join(root, STATE_REL)}`);
    console.log(`  scope=${scope}；required：${required.join('、') || '(无)'}`);
    if (na.length > 0) console.log(`  na（需 docs-review 复核理由）：${na.join('、')}`);
    console.log('  下一步：node scripts/doc/doc-init.mjs <root> --tier 3 --write 建七阶段树，再按入口技能补文档');
  }
  return 0;
}

function runCheck() {
  const result = checkReadiness({ root, planPath, gate, strict });
  if (asJson) {
    console.log(
      JSON.stringify(
        { ok: result.ok, root, gate, scope: result.info.scope, errors: result.errors, warnings: result.warnings, info: result.info },
        null,
        2,
      ),
    );
  } else {
    printCheck(result);
  }
  return result.ok ? 0 : 1;
}

function runApprove() {
  const reviewPath = valueOf('review');
  if (reviewPath === null || reviewPath === '') fail(2, 'approve 需要 --review <评审记录路径>');

  // 签发就是替换收据：旧收据过期不该阻止重新签发（check 与派发门仍然报 stale）。
  const result = checkReadiness({ root, planPath, gate, strict, ignoreStale: true });
  if (!result.ok) {
    if (asJson) {
      console.log(
        JSON.stringify(
          { ok: false, root, gate, errors: result.errors, warnings: result.warnings, info: result.info },
          null,
          2,
        ),
      );
    } else {
      printCheck(result);
      console.error('[docs-ready] approve 失败：先清零上面的 error 再签发收据');
    }
    return 1;
  }

  // 签发前不再提示「还没有评审」——这一步就是来签收评审结论的。
  result.warnings = result.warnings.filter((warning) => warning.id !== 'W-REVIEW-PENDING');

  const reviewAbs = isAbsolute(reviewPath) ? reviewPath : join(root, reviewPath);
  if (!existsSync(reviewAbs)) {
    const message = `E-REVIEW-MISSING 评审记录不存在：${reviewPath}`;
    if (asJson) console.log(JSON.stringify({ ok: false, root, error: message }, null, 2));
    else console.error(`[docs-ready] ${message}`);
    return 1;
  }
  const recordText = readFileSync(reviewAbs, 'utf8');
  const record = parseReviewRecord(recordText);
  const approved = record !== null && record.status === 'approved' && Number(record.blocking ?? 0) === 0;
  if (!approved) {
    const hint = record === null
      ? `缺机读块（${REVIEW_BEGIN} … ${REVIEW_END}），用 docs-review 技能生成`
      : `status=${JSON.stringify(record.status)} blocking=${JSON.stringify(record.blocking)}；只有 approved + blocking 0 可签发`;
    const message = `E-REVIEW-NOT-APPROVED 评审记录未通过：${reviewPath}（${hint}）`;
    if (asJson) console.log(JSON.stringify({ ok: false, root, error: message }, null, 2));
    else console.error(`[docs-ready] ${message}`);
    return 1;
  }

  const statusFile = join(root, 'docs/07-治理/评审状态.md');
  if (existsSync(statusFile)) {
    const name = basename(reviewAbs);
    if (!readFileSync(statusFile, 'utf8').includes(name)) {
      const message = `E-REVIEW-UNINDEXED 评审记录没有进 docs/07-治理/评审状态.md 的表：${name}`;
      if (asJson) console.log(JSON.stringify({ ok: false, root, error: message }, null, 2));
      else console.error(`[docs-ready] ${message}`);
      return 1;
    }
  }

  const read = readState(root);
  if (read.state === null) fail(2, '状态文件在 approve 过程中消失，请重跑 init');
  const state = read.state;
  state.ok = true;
  state.docsHash = result.info.hash;
  state.approvedAt = new Date().toISOString();
  state.review = {
    status: 'approved',
    record: reviewPath,
    at: new Date().toISOString(),
    scope: typeof record.scope === 'string' ? record.scope : state.scope,
  };
  writeState(root, state);

  if (asJson) {
    console.log(
      JSON.stringify(
        { ok: true, root, file: STATE_REL, scope: state.scope, gate, docsHash: state.docsHash, review: state.review, warnings: result.warnings },
        null,
        2,
      ),
    );
  } else {
    for (const warning of result.warnings) {
      console.log(`  ⚠ ${warning.id} ${warning.file ? `${warning.file} — ` : ''}${warning.message}`);
    }
    console.log(`[docs-ready] PASS — 收据已签发：${STATE_REL}`);
    console.log(`  scope=${state.scope} gate=${gate} docsHash=${state.docsHash}`);
    console.log(`  评审记录：${reviewPath}`);
    console.log('  下一步：可派 backend-dev / frontend-dev；口径类文档再改动会让收据失效');
  }
  return 0;
}

function runStatus() {
  const read = readState(root);
  if (read.error !== null) {
    if (asJson) console.log(JSON.stringify({ ok: false, root, error: read.error }, null, 2));
    else console.error(`[docs-ready] ${read.error}`);
    return 1;
  }
  if (read.missing) {
    const message = `E-STATE-MISSING 缺 ${STATE_REL}：先跑 init`;
    if (asJson) console.log(JSON.stringify({ ok: false, root, error: message }, null, 2));
    else console.error(`[docs-ready] ${message}`);
    return 1;
  }
  const state = read.state;
  const shape = validateState(state);
  const hashResult = computeDocsHash(root, state.hashExclude ?? DEFAULT_HASH_EXCLUDE);
  const stale = state.ok === true && hashResult.ok && typeof state.docsHash === 'string' && state.docsHash !== hashResult.hash;
  const ok = shape.length === 0 && state.ok === true && !stale && state.review?.status === 'approved';
  const payload = {
    ok,
    root,
    file: STATE_REL,
    scope: state.scope ?? null,
    approved: state.ok === true,
    stale,
    docsHash: state.docsHash ?? null,
    currentHash: hashResult.ok ? hashResult.hash : null,
    review: state.review ?? null,
    approvedAt: state.approvedAt ?? null,
    errors: shape,
  };
  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`[docs-ready] ${ok ? 'READY' : 'NOT-READY'} — ${STATE_REL}`);
    console.log(`  scope=${payload.scope ?? '?'} approved=${payload.approved} stale=${payload.stale} review=${payload.review?.status ?? 'none'}`);
    if (payload.docsHash !== null) console.log(`  docsHash=${payload.docsHash}`);
    if (stale) console.log('  ⚠ 口径类文档已改动：重跑 check 与 docs-review 后再 approve');
    if (shape.length > 0) printLines(shape, '✗', (line) => console.error(line));
  }
  return ok ? 0 : 1;
}

// --- dispatch ---------------------------------------------------------------

const handlers = { init: runInit, check: runCheck, approve: runApprove, status: runStatus };
const handler = handlers[command];
if (handler === undefined) fail(2, `未知子命令「${command}」（可选：${Object.keys(handlers).join(' / ')}）`);
process.exit(handler());
