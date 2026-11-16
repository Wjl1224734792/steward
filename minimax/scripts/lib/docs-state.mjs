#!/usr/bin/env node
/**
 * docs-state.mjs — Steward 文档就绪状态库（MiniMax Code 宿主，零依赖）。
 *
 * 单一职责：把「文档是否准备好可以开发」这件事做成**可机检的数据**。
 * 状态文件落在项目根 `.steward/docs-state.json`（不放进 docs/：那里是散文域，
 * 机器状态混进去会被 docs-gate 的 G4/G5 白名单与索引区块误伤）。
 *
 * 由 `scripts/docs-ready.mjs`（CLI）与插件宿主半 `scripts/hooks/docs-tier-gate.mjs`（派发硬门 Hook）共用，
 * 保证「脚本判绿」与「派发放行」用的是同一套哈希与同一套缺漏判据。
 *
 * 核心约定：
 *   - 阶段条目是**显式声明**（required / na + 理由），不做「猜你要不要」；
 *   - docsHash 只覆盖口径类文档，排除开发期必然变动的执行步骤 / 评审状态 / 评审记录，
 *     否则销一次项就要重新过一遍评审；
 *   - 失败一律给出可执行修复路径与错误码，不静默通过。
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, sep } from 'node:path';

/** 状态文件（相对项目根，POSIX 分隔符）。 */
export const STATE_REL = '.steward/docs-state.json';
/** 状态文件 schema 版本；结构变更时 +1，旧文件按 E-STATE-SCHEMA 报错。 */
export const SCHEMA_VERSION = 1;
/** 文档入口范围。 */
export const SCOPES = ['new', 'takeover', 'feature'];
/** 阶段归属：dev = 不通过就不许派开发；delivery = 交付前补齐即可，不拦派发。 */
export const GATES = ['dev', 'delivery'];

/** 默认哈希排除项：开发期正常变动的治理活文档。 */
export const DEFAULT_HASH_EXCLUDE = [
  'docs/07-治理/执行步骤.md',
  'docs/07-治理/评审状态.md',
  'docs/07-治理/评审记录/',
];

export const MAX_HASH_FILES = 5000;
export const MAX_HASH_BYTES = 20 * 1024 * 1024;
/** 必填文档的「空壳」下限：去 frontmatter 与空白后的字符数。 */
export const THIN_CHARS = 200;

/** 评审记录里的机读块标记（doc-snapshot / docs-gate 同款风格）。 */
export const REVIEW_BEGIN = '<!-- docs-review:begin -->';
export const REVIEW_END = '<!-- docs-review:end -->';

/** 模板占位符：出现在必填文档里即未写完。 */
export const PLACEHOLDER_PATTERNS = ['{{', 'TODO(拍板)', '待补', 'TBD', '（待填）', '(待填)'];

/**
 * 阶段定义（默认值）。groups = 每个内层数组是一组「命中任一即可」的 glob；
 * exact = 固定文件名的治理活文档；gate = 归属；mergeMarker = 允许合并声明的标记。
 */
export const PHASES = [
  {
    id: '01-需求',
    dir: 'docs/01-需求',
    gate: 'dev',
    groups: [['PRD*.md'], ['FRD*.md']],
    exact: [],
    mergeMarker: '功能点级规格',
  },
  { id: '02-架构', dir: 'docs/02-架构', gate: 'dev', groups: [['*架构*.md'], ['*工程化*.md']], exact: [] },
  { id: '03-契约', dir: 'docs/03-契约', gate: 'dev', groups: [['*数据模型*.md'], ['*API*.md', '*接口*.md']], exact: [] },
  { id: '04-专项', dir: 'docs/04-专项', gate: 'dev', groups: [['*.md']], exact: [] },
  { id: '05-页面', dir: 'docs/05-页面', gate: 'dev', groups: [['*页面*.md'], ['*布局*.md']], exact: [] },
  { id: '06-测试', dir: 'docs/06-测试', gate: 'dev', groups: [['*测试方案*.md', '*测试*.md']], exact: [] },
  {
    id: '07-治理',
    dir: 'docs/07-治理',
    gate: 'dev',
    groups: [],
    exact: ['执行步骤.md', '开发顺序.md', 'ADR-索引.md'],
  },
  { id: '部署', dir: 'docs/02-架构', gate: 'delivery', groups: [['*部署*.md']], exact: [] },
];

/** 阶段 id 列表（给 CLI 的 --require 校验用）。 */
export const PHASE_IDS = PHASES.map((phase) => phase.id);

const posix = (value) => String(value).split(sep).join('/');

/** 状态文件绝对路径。 */
export function statePath(root) {
  return join(root, STATE_REL);
}

/**
 * 读取状态文件。
 * @param {string} root project root.
 * @returns {{state: object|null, file: string, error: string|null, missing: boolean}}
 */
export function readState(root) {
  const file = statePath(root);
  if (!existsSync(file)) return { state: null, file, error: null, missing: true };
  try {
    return { state: JSON.parse(readFileSync(file, 'utf8')), file, error: null, missing: false };
  } catch (error) {
    return { state: null, file, error: `状态文件无法解析：${error.message}`, missing: false };
  }
}

/** 写状态文件（自动建 `.steward/`）。 */
export function writeState(root, state) {
  const file = statePath(root);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  return file;
}

/**
 * 结构校验；只判「能不能被机检」，不判内容是否齐全。
 * @param {unknown} state parsed JSON.
 * @returns {{id: string, message: string}[]} errors.
 */
export function validateState(state) {
  const errors = [];
  const add = (message) => errors.push({ id: 'E-STATE-SCHEMA', message });
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    add('根节点必须是 JSON 对象');
    return errors;
  }
  if (state.schemaVersion !== SCHEMA_VERSION) {
    add(`schemaVersion 必须是 ${SCHEMA_VERSION}，实际：${JSON.stringify(state.schemaVersion)}`);
  }
  if (!SCOPES.includes(state.scope)) {
    add(`scope 必须是 ${SCOPES.join(' / ')} 之一，实际：${JSON.stringify(state.scope)}`);
  }
  if (!Array.isArray(state.phases) || state.phases.length === 0) {
    add('phases 必须是非空数组');
    return errors;
  }
  state.phases.forEach((phase, index) => {
    const label = `phases[${index}]`;
    if (typeof phase !== 'object' || phase === null) {
      add(`${label} 必须是对象`);
      return;
    }
    if (typeof phase.id !== 'string' || phase.id.trim() === '') add(`${label}.id 必须是非空字符串`);
    if (typeof phase.dir !== 'string' || phase.dir.trim() === '') add(`${label}.dir 必须是非空字符串`);
    if (!GATES.includes(phase.gate)) add(`${label}.gate 必须是 ${GATES.join(' / ')}`);
    if (phase.status !== 'required' && phase.status !== 'na') add(`${label}.status 必须是 required / na`);
    if (phase.status === 'na' && typeof phase.reason !== 'string') add(`${label}.reason 在 na 时必须是字符串`);
    if (phase.groups !== undefined
      && (!Array.isArray(phase.groups) || phase.groups.some((group) => !Array.isArray(group)))) {
      add(`${label}.groups 必须是「glob 数组」的数组`);
    }
    if (phase.exact !== undefined
      && (!Array.isArray(phase.exact) || phase.exact.some((name) => typeof name !== 'string'))) {
      add(`${label}.exact 必须是字符串数组`);
    }
  });
  if (state.hashExclude !== undefined
    && (!Array.isArray(state.hashExclude) || state.hashExclude.some((rule) => typeof rule !== 'string'))) {
    add('hashExclude 必须是字符串数组');
  }
  return errors;
}

/**
 * 列出参与哈希与检查的文档（相对项目根的 POSIX 路径）。
 * 跳过隐藏项、history/、archive/（基线快照不是现行口径）。
 */
export function listDocs(root) {
  const out = [];
  const walk = (absDir, relDir, depth) => {
    if (depth > 8) return;
    let entries;
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const abs = join(absDir, entry.name);
      const rel = relDir === '' ? entry.name : `${relDir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === 'history' || entry.name === 'archive') continue;
        walk(abs, rel, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(rel);
      }
    }
  };
  if (existsSync(join(root, 'AGENTS.md'))) out.push('AGENTS.md');
  walk(join(root, 'docs'), 'docs', 0);
  return out.sort();
}

/**
 * 文档口径哈希：路径 + 内容（CRLF 归一），排除 hashExclude。
 * @returns {{ok: true, hash: string, files: number, bytes: number} | {ok: false, error: string}}
 */
export function computeDocsHash(root, hashExclude = DEFAULT_HASH_EXCLUDE) {
  const sha = createHash('sha256');
  const excluded = (rel) => hashExclude.some((rule) => (rule.endsWith('/') ? rel.startsWith(rule) : rel === rule));
  let files = 0;
  let bytes = 0;
  for (const rel of listDocs(root)) {
    if (excluded(rel)) continue;
    let content;
    try {
      content = readFileSync(join(root, rel));
    } catch {
      continue;
    }
    files += 1;
    bytes += content.length;
    if (files > MAX_HASH_FILES || bytes > MAX_HASH_BYTES) {
      return {
        ok: false,
        error: `文档树超过哈希上限（${MAX_HASH_FILES} 文件 / ${MAX_HASH_BYTES} 字节），请缩小编排范围`,
      };
    }
    sha.update(rel);
    sha.update('\0');
    sha.update(content.toString('utf8').replace(/\r\n/g, '\n'));
    sha.update('\0');
  }
  return { ok: true, hash: `sha256:${sha.digest('hex')}`, files, bytes };
}

/** 简易 glob（`*` 任意字符、`?` 单字符），大小写不敏感。 */
function globToRegExp(glob) {
  const escaped = String(glob)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function matchAny(names, patterns) {
  const regs = patterns.map(globToRegExp);
  return names.some((name) => regs.some((reg) => reg.test(name)));
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

/** 正文长度：去 frontmatter、去空白后的字符数（判空壳）。 */
function bodyLength(text) {
  return String(text)
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .replace(/\s+/g, '')
    .length;
}

/**
 * 单阶段检查。
 * @returns {{errors: object[], warnings: object[], files: string[]}}
 */
function checkPhase(root, phase) {
  const errors = [];
  const warnings = [];
  const abs = join(root, phase.dir);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    errors.push({ id: 'E-PHASE-DIR', message: `${phase.id}：目录不存在 ${phase.dir}`, file: phase.dir });
    return { errors, warnings, files: [] };
  }
  const files = readdirSync(abs).filter((name) => name.endsWith('.md') && !name.startsWith('.'));
  if (files.length === 0) {
    errors.push({ id: 'E-PHASE-EMPTY', message: `${phase.id}：目录里没有文档（只有占位文件）`, file: phase.dir });
  }
  for (const group of phase.groups ?? []) {
    if (matchAny(files, group)) continue;
    const merged = phase.mergeMarker !== undefined
      && files.some((name) => readText(join(abs, name)).includes(phase.mergeMarker));
    if (merged) {
      warnings.push({
        id: 'W-MERGED',
        message: `${phase.id}：缺 ${group.join(' / ')}，按合并声明（含「${phase.mergeMarker}」）放行`,
        file: phase.dir,
      });
    } else {
      errors.push({
        id: 'E-DOC-MISSING',
        message: `${phase.id}：缺 ${group.join(' 或 ')}`,
        file: phase.dir,
      });
    }
  }
  for (const name of phase.exact ?? []) {
    if (!existsSync(join(abs, name))) {
      errors.push({ id: 'E-DOC-MISSING', message: `${phase.id}：缺固定活文档 ${name}`, file: `${phase.dir}/${name}` });
    }
  }

  const requiredDocs = new Set();
  for (const group of phase.groups ?? []) {
    for (const name of files) if (matchAny([name], group)) requiredDocs.add(name);
  }
  for (const name of files) {
    const text = readText(join(abs, name));
    const placeholder = PLACEHOLDER_PATTERNS.find((pattern) => text.includes(pattern));
    if (placeholder !== undefined) {
      errors.push({
        id: 'E-DOC-PLACEHOLDER',
        message: `${phase.id}/${name}：还有模板占位「${placeholder}」`,
        file: `${phase.dir}/${name}`,
      });
    }
    if (requiredDocs.has(name) && bodyLength(text) < THIN_CHARS) {
      errors.push({
        id: 'E-DOC-THIN',
        message: `${phase.id}/${name}：正文不足 ${THIN_CHARS} 字，像空壳（去 frontmatter 与空白计）`,
        file: `${phase.dir}/${name}`,
      });
    }
  }
  return { errors, warnings, files };
}

const normalizeId = (value) => String(value).replace(/^0+(?=\d)/, '');

/** FR↔FP 追溯：PRD 的每个 FR 必须在 FRD 出现，FRD 的 FP 必须挂在已有 FR 下。 */
function checkTraceability(root, analyzed, errors, warnings, strict) {
  if (!analyzed.some((entry) => entry.phase.id === '01-需求')) return;
  const dir = join(root, 'docs/01-需求');
  let files = [];
  try {
    files = readdirSync(dir).filter((name) => name.endsWith('.md'));
  } catch {
    return;
  }
  const prd = files.filter((name) => /PRD/i.test(name));
  const frd = files.filter((name) => /FRD/i.test(name));
  if (prd.length === 0 || frd.length === 0) return;

  const frIds = new Set();
  for (const name of prd) {
    for (const match of readText(join(dir, name)).matchAll(/\bFR-(\d+(?:\.\d+)?)\b/g)) {
      frIds.add(normalizeId(match[1]));
    }
  }
  const frdText = frd.map((name) => readText(join(dir, name))).join('\n');
  const frdFr = new Set([...frdText.matchAll(/\bFR-(\d+(?:\.\d+)?)\b/g)].map((match) => normalizeId(match[1])));
  const mentioned = (id) => frdFr.has(id) || [...frdFr].some((other) => other.startsWith(`${id}.`));
  const orphanFr = [...frIds].filter((id) => !mentioned(id));
  const sink = strict ? errors : warnings;
  if (orphanFr.length > 0) {
    sink.push({
      id: strict ? 'E-TRACE-FR' : 'W-TRACE-FR',
      message: `PRD 的 ${orphanFr.map((id) => `FR-${id}`).join('、')} 未在 FRD 出现（追溯断链）`,
    });
  }
  const fpIds = [...new Set([...frdText.matchAll(/\bFP-(\d+(?:\.\d+)?)\b/g)].map((match) => match[1]))];
  const badFp = fpIds.filter((fp) => {
    if (frIds.size === 0) return false;
    const parent = normalizeId(fp.split('.')[0]);
    return !frIds.has(parent);
  });
  if (badFp.length > 0) {
    sink.push({
      id: strict ? 'E-TRACE-FP' : 'W-TRACE-FP',
      message: `FRD 的 ${badFp.map((fp) => `FP-${fp}`).join('、')} 找不到所属 FR`,
    });
  }
}

function resolveFromRoot(root, value) {
  return isAbsolute(value) ? value : join(root, value);
}

/** 计划联动：docTier=3 时每个任务必须声明 docsRead，且路径真实存在、不是被标 na 的阶段。 */
function checkPlan(root, state, planPath, errors) {
  const abs = resolveFromRoot(root, planPath);
  let plan;
  try {
    plan = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (error) {
    errors.push({ id: 'E-PLAN-DOCSREAD', message: `计划文件无法读取/解析：${planPath}（${error.message}）` });
    return;
  }
  const tasks = Array.isArray(plan?.tasks) ? plan.tasks : [];
  if (tasks.length === 0) {
    errors.push({ id: 'E-PLAN-DOCSREAD', message: '计划没有 tasks，无法核对 docsRead' });
    return;
  }
  for (const task of tasks) {
    const label = typeof task?.id === 'string' ? task.id : '(无 id)';
    const docs = Array.isArray(task?.docsRead)
      ? task.docsRead.filter((doc) => typeof doc === 'string' && doc.trim() !== '')
      : [];
    if (docs.length === 0) {
      errors.push({ id: 'E-PLAN-DOCSREAD', message: `${label}：docTier=3 时 docsRead 不得为空`, file: planPath });
      continue;
    }
    for (const doc of docs) {
      const rel = posix(doc).replace(/^\.\//, '');
      if (!existsSync(join(root, rel))) {
        errors.push({ id: 'E-PLAN-DOCSREAD', message: `${label} 的 docsRead 指向不存在的文档：${doc}` });
        continue;
      }
      const owning = state.phases.filter((phase) => rel.startsWith(`${phase.dir}/`));
      if (owning.length > 0 && owning.every((phase) => phase.status === 'na')) {
        errors.push({ id: 'E-PLAN-NA-CONFLICT', message: `${label} 读了被标 na 的阶段文档：${doc}` });
      }
    }
  }
}

/**
 * 就绪判定（check / approve / 派发硬门共用）。
 * @param {object} options
 * @param {string} options.root project root.
 * @param {string|null} [options.planPath] 03-plan.json 路径。
 * @param {'dev'|'delivery'} [options.gate] 只判该归属的阶段。
 * @param {boolean} [options.strict] 追溯类 warning 升为 error。
 * @param {boolean} [options.ignoreStale] 重新签发时忽略「旧收据已过期」（approve 专用：它要做的正是替换过期收据；check 与派发门仍然照报/照拦）。
 * @returns {{ok: boolean, errors: object[], warnings: object[], info: object}}
 */
export function checkReadiness({ root, planPath = null, gate = 'dev', strict = false, ignoreStale = false }) {
  const errors = [];
  const warnings = [];
  const info = { scope: null, phases: [], pendingDelivery: [], hash: null, files: 0 };
  const fail = () => ({ ok: false, errors, warnings, info });

  const read = readState(root);
  if (read.error !== null) {
    errors.push({ id: 'E-STATE-SCHEMA', message: read.error });
    return fail();
  }
  if (read.missing) {
    errors.push({
      id: 'E-STATE-MISSING',
      message: `缺 ${STATE_REL}：先跑 docs-ready init --scope <new|takeover|feature> --write`,
    });
    return fail();
  }
  const state = read.state;
  const shape = validateState(state);
  if (shape.length > 0) {
    errors.push(...shape);
    return fail();
  }
  info.scope = state.scope;

  const hashResult = computeDocsHash(root, state.hashExclude ?? DEFAULT_HASH_EXCLUDE);
  if (!hashResult.ok) {
    errors.push({ id: 'E-STATE-SCHEMA', message: hashResult.error });
  } else {
    info.hash = hashResult.hash;
    info.files = hashResult.files;
    if (state.ok === true && state.docsHash !== hashResult.hash && !ignoreStale) {
      errors.push({
        id: 'E-STATE-STALE',
        message: '收据与当前文档哈希不一致（口径改过，或收据被手工改过）：重跑 check 与 docs-review 后再 approve',
      });
    }
  }

  const analyzed = [];
  for (const phase of state.phases) {
    if (phase.status === 'na') {
      if (String(phase.reason ?? '').trim() === '') {
        errors.push({ id: 'E-NA-REASON', message: `${phase.id} 标为 na 但没写理由` });
      }
      info.phases.push({ id: phase.id, status: 'na', ok: true });
      continue;
    }
    if (gate === 'dev' && phase.gate === 'delivery') {
      info.pendingDelivery.push(phase.id);
      info.phases.push({ id: phase.id, status: 'pending-delivery', ok: true });
      continue;
    }
    const result = checkPhase(root, phase);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    analyzed.push({ phase, files: result.files });
    info.phases.push({ id: phase.id, status: 'checked', ok: result.errors.length === 0 });
  }

  checkTraceability(root, analyzed, errors, warnings, strict);
  if (planPath !== null && planPath !== '') checkPlan(root, state, planPath, errors);

  if (state.review?.status !== 'approved') {
    warnings.push({ id: 'W-REVIEW-PENDING', message: '还没有通过的文档评审：跑 docs-review 后再 approve' });
  }
  return { ok: errors.length === 0, errors, warnings, info };
}

/**
 * 解析评审记录的机读块。
 * @param {string} text review record markdown.
 * @returns {{status?: string, blocking?: number, scope?: string} | null}
 */
export function parseReviewRecord(text) {
  const start = text.indexOf(REVIEW_BEGIN);
  const end = text.indexOf(REVIEW_END);
  if (start < 0 || end < start) return null;
  try {
    const parsed = JSON.parse(text.slice(start + REVIEW_BEGIN.length, end).trim());
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 生成初始状态（init）。
 * @param {'new'|'takeover'|'feature'} scope
 * @param {string[]} [requireIds] feature 范围下要标记为 required 的阶段 id。
 */
export function defaultState(scope, requireIds = []) {
  const required = new Set(requireIds);
  return {
    schemaVersion: SCHEMA_VERSION,
    scope,
    docTier: 3,
    createdAt: new Date().toISOString(),
    phases: PHASES.map((phase) => ({
      id: phase.id,
      dir: phase.dir,
      gate: phase.gate,
      groups: phase.groups,
      exact: phase.exact,
      // feature 只点亮受影响的阶段，其余显式 na 并留可复核理由；new / takeover 全量必填。
      status: scope === 'feature' && !required.has(phase.id) ? 'na' : 'required',
      reason: scope === 'feature' && !required.has(phase.id) ? '本次功能未触及（docs-review 复核）' : '',
    })),
    hashExclude: [...DEFAULT_HASH_EXCLUDE],
    review: null,
    ok: false,
    docsHash: null,
    approvedAt: null,
  };
}

/** 一排缺漏摘要（派发拒绝报文用，最多 limit 条）。 */
export function formatGaps(items, limit = 3) {
  return items.slice(0, limit).map((item) => `${item.id} ${item.message}`).join('；');
}
