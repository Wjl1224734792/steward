#!/usr/bin/env node
/**
 * validate-plan.mjs — 校验 Steward 任务计划（03-plan.json / tasks.json）。
 *
 * 用法：
 *   node validate-plan.mjs <03-plan.json> [--root <仓库根>] [--json]
 *
 * 校验项（对应 ROADMAP §6 P0-2）：
 *   E-SCHEMA         字段缺失/类型错误/任务ID重复/依赖引用不存在/自依赖
 *   E-PATH-MISSING   既有文件路径在仓库中不存在
 *   E-PATH-CONFLICT  声明为新增但文件已存在
 *   E-PATH-ESCAPE    路径越出仓库根（绝对路径 / ../）
 *   E-CYCLE          依赖图成环
 *   E-OVERLAP        两个任务拥有同一文件（文件所有权不相交）
 *   E-AC-UNCOVERED   验收标准没有被任何任务覆盖
 *   E-ROLE           负责人不在 {backend-dev, frontend-dev, qa-engineer}
 *   E-IMPACT-MISSING 引用的 02-impact.md 不存在或缺必需小节
 *   E-TEST-UNDECLARED 任务文件里的测试文件未在 testChanges 声明理由（反作弊）
 *
 * 退出码：0 = 通过；1 = 有错误；2 = 文件/用法错误。
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const ROLES = ['backend-dev', 'frontend-dev', 'qa-engineer'];
const IMPACT_REQUIRED_SECTIONS = ['意图', '契约', '模块', '测试', '文档', '回滚'];

const args = process.argv.slice(2);
const planPath = resolve(args.find((a) => !a.startsWith('--')) || '');
if (!planPath || !existsSync(planPath)) {
  console.error(`[validate-plan] 计划文件不存在：${planPath || '(未指定)'}`);
  process.exit(2);
}
const rootIdx = args.indexOf('--root');
const root = rootIdx >= 0 ? resolve(args[rootIdx + 1]) : resolve('.');
if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.error(`[validate-plan] 仓库根不存在：${root}`);
  process.exit(2);
}

const errors = [];
const err = (code, msg) => errors.push({ code, msg });

let plan;
try {
  plan = JSON.parse(readFileSync(planPath, 'utf8'));
} catch (e) {
  console.error(`[validate-plan] JSON 解析失败：${e.message}`);
  process.exit(1);
}
if (typeof plan !== 'object' || plan === null || Array.isArray(plan)) {
  console.error('[validate-plan] 根节点必须是 JSON 对象');
  process.exit(1);
}

// --- schema ---
if (plan.schemaVersion !== 1) err('E-SCHEMA', `schemaVersion 必须是 1，实际：${JSON.stringify(plan.schemaVersion)}`);
const tasks = Array.isArray(plan.tasks) ? plan.tasks : null;
if (!tasks || !tasks.length) err('E-SCHEMA', 'tasks 必须是非空数组');
const acs = Array.isArray(plan.acceptanceCriteria) ? plan.acceptanceCriteria : null;
if (!acs) err('E-SCHEMA', 'acceptanceCriteria 必须是数组');
const testChanges = Array.isArray(plan.testChanges) ? plan.testChanges : [];

const ids = new Set();
const taskById = new Map();
if (tasks) {
  for (const t of tasks) {
    if (typeof t !== 'object' || t === null) { err('E-SCHEMA', 'tasks 内必须是对象'); continue; }
    if (typeof t.id !== 'string' || !/^T\d+$/i.test(t.id)) { err('E-SCHEMA', `任务ID格式应为 T<数字>，实际：${JSON.stringify(t.id)}`); continue; }
    if (ids.has(t.id)) err('E-SCHEMA', `任务ID重复：${t.id}`);
    ids.add(t.id);
    taskById.set(t.id, t);
    if (!ROLES.includes(t.role)) err('E-ROLE', `${t.id} 负责人必须是 ${ROLES.join(' | ')}，实际：${JSON.stringify(t.role)}`);
    if (typeof t.title !== 'string' || !t.title.trim()) err('E-SCHEMA', `${t.id} 缺 title`);
    if (typeof t.doneWhen !== 'string' || !t.doneWhen.trim()) err('E-SCHEMA', `${t.id} 缺 doneWhen（完成标准必须可判定）`);
    const deps = t.dependsOn ?? [];
    if (!Array.isArray(deps)) err('E-SCHEMA', `${t.id}.dependsOn 必须是数组`);
    for (const d of deps) {
      if (!tasks.some((x) => x.id === d)) err('E-SCHEMA', `${t.id} 依赖了不存在的任务：${d}`);
      if (d === t.id) err('E-SCHEMA', `${t.id} 依赖自己`);
    }
    const files = t.files ?? [];
    const newFiles = t.newFiles ?? [];
    if (!Array.isArray(files) || !Array.isArray(newFiles)) err('E-SCHEMA', `${t.id}.files / newFiles 必须是数组`);
    if (!files.length && !newFiles.length) err('E-SCHEMA', `${t.id} 没有任何文件所有权（files/newFiles 均为空）`);
  }
}

// --- 路径：存在性 / 越界 / 冲突 ---
function ownedFiles(t) {
  return [...(t.files ?? []), ...(t.newFiles ?? [])];
}
const ownerOf = new Map(); // normalized path -> taskId
if (tasks) {
  for (const t of tasks) {
    for (const f of (t.files ?? [])) {
      if (typeof f !== 'string' || !f.trim()) { err('E-SCHEMA', `${t.id}.files 含空路径`); continue; }
      if (isAbsolute(f)) { err('E-PATH-ESCAPE', `${t.id} 使用绝对路径：${f}（必须用相对仓库根的路径）`); continue; }
      const abs = resolve(root, f);
      const rel = relative(root, abs);
      if (rel.startsWith('..') || isAbsolute(rel)) { err('E-PATH-ESCAPE', `${t.id} 路径越出仓库根：${f}`); continue; }
      if (!existsSync(abs)) err('E-PATH-MISSING', `${t.id} 声明的既有文件不存在：${f}（仓库根 ${root}）`);
      const norm = rel.split(sep).join('/');
      if (ownerOf.has(norm)) err('E-OVERLAP', `文件所有权重叠：${norm} 同时属于 ${ownerOf.get(norm)} 和 ${t.id}`);
      else ownerOf.set(norm, t.id);
    }
    for (const f of (t.newFiles ?? [])) {
      if (typeof f !== 'string' || !f.trim()) { err('E-SCHEMA', `${t.id}.newFiles 含空路径`); continue; }
      if (isAbsolute(f)) { err('E-PATH-ESCAPE', `${t.id} 使用绝对路径：${f}`); continue; }
      const abs = resolve(root, f);
      const rel = relative(root, abs);
      if (rel.startsWith('..') || isAbsolute(rel)) { err('E-PATH-ESCAPE', `${t.id} 路径越出仓库根：${f}`); continue; }
      if (existsSync(abs)) err('E-PATH-CONFLICT', `${t.id} 声明为新增但文件已存在：${f}`);
      const norm = rel.split(sep).join('/');
      if (ownerOf.has(norm)) err('E-OVERLAP', `文件所有权重叠：${norm} 同时属于 ${ownerOf.get(norm)} 和 ${t.id}`);
      else ownerOf.set(norm, t.id);
    }
  }
}

// --- DAG 无环（Kahn）---
if (tasks && tasks.length) {
  const indeg = new Map();
  const adj = new Map();
  for (const t of tasks) { indeg.set(t.id, 0); adj.set(t.id, []); }
  for (const t of tasks) {
    for (const d of (t.dependsOn ?? [])) {
      if (adj.has(d) && d !== t.id) { adj.get(d).push(t.id); indeg.set(t.id, indeg.get(t.id) + 1); }
    }
  }
  let queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  let seen = 0;
  while (queue.length) {
    const n = queue.pop();
    seen += 1;
    for (const m of adj.get(n)) {
      indeg.set(m, indeg.get(m) - 1);
      if (indeg.get(m) === 0) queue.push(m);
    }
  }
  if (seen !== tasks.length) {
    const cyclic = tasks.filter((t) => indeg.get(t.id) > 0).map((t) => t.id);
    err('E-CYCLE', `依赖图成环，涉及任务：${cyclic.join(' → … → ')}（环内任务：${cyclic.join(', ')}）`);
  }
}

// --- AC 覆盖 ---
if (acs) {
  for (const ac of acs) {
    if (typeof ac !== 'object' || ac === null) { err('E-SCHEMA', 'acceptanceCriteria 内必须是对象'); continue; }
    if (typeof ac.id !== 'string' || !ac.id.trim()) { err('E-SCHEMA', `AC 缺 id：${JSON.stringify(ac)}`); continue; }
    if (typeof ac.text !== 'string' || !ac.text.trim()) err('E-SCHEMA', `${ac.id} 缺 text（验收标准必须可判定）`);
    const coveredBy = ac.coveredBy ?? null;
    if (!Array.isArray(coveredBy) || !coveredBy.length) { err('E-AC-UNCOVERED', `${ac.id} 没有覆盖任务（coveredBy 为空）`); continue; }
    for (const tid of coveredBy) {
      if (!ids.has(tid)) err('E-AC-UNCOVERED', `${ac.id} 的 coveredBy 引用不存在的任务：${tid}`);
    }
  }
}

// --- 影响面完整性 ---
if (typeof plan.impact === 'string' && plan.impact.trim()) {
  const impactAbs = isAbsolute(plan.impact) ? plan.impact : resolve(planPath.includes(sep) ? planPath.substring(0, planPath.lastIndexOf(sep)) || root : root, plan.impact);
  if (!existsSync(impactAbs)) {
    err('E-IMPACT-MISSING', `02-impact.md 不存在：${plan.impact}（相对计划文件目录或仓库根）`);
  } else {
    const text = readFileSync(impactAbs, 'utf8');
    const missing = IMPACT_REQUIRED_SECTIONS.filter((s) => !text.includes(s));
    if (missing.length) err('E-IMPACT-MISSING', `02-impact.md 缺必需小节关键词：${missing.join('、')}（需覆盖 意图/契约/模块/测试/文档/回滚）`);
  }
} else {
  err('E-IMPACT-MISSING', '计划未引用 02-impact.md（字段 impact 必填）');
}

// --- 反作弊：测试文件改动必须有声明理由 ---
const TEST_RE = /(^|[\\/])(tests?|__tests__)([\\/])|\.test\.[jt]sx?$|\.spec\.[jt]sx?$|test_[^\\/]*\.py$|_test\.go$/i;
const declared = new Set(testChanges.map((c) => (typeof c?.file === 'string' ? c.file.split(sep).join('/').replace(/^\.\//, '') : null)).filter(Boolean));
if (tasks) {
  for (const t of tasks) {
    for (const f of ownedFiles(t)) {
      const norm = f.split(sep).join('/').replace(/^\.\//, '');
      if (TEST_RE.test(norm) && !declared.has(norm)) {
        err('E-TEST-UNDECLARED', `${t.id} 修改测试文件但 testChanges 未声明理由：${norm}`);
      }
    }
  }
  for (const c of testChanges) {
    if (typeof c?.reason !== 'string' || !c.reason.trim()) err('E-TEST-UNDECLARED', `testChanges 中 ${c?.file ?? '(?)'} 缺 reason`);
    if (c?.task && !ids.has(c.task)) err('E-SCHEMA', `testChanges 引用不存在的任务：${c.task}`);
    if (typeof c?.file === 'string' && c.task && taskById.has(c.task)) {
      const t = taskById.get(c.task);
      const norm = c.file.split(sep).join('/').replace(/^\.\//, '');
      const owned = [...(t.files ?? []), ...(t.newFiles ?? [])].map((f) => f.split(sep).join('/').replace(/^\.\//, ''));
      if (!owned.includes(norm)) err('E-TEST-NOT-OWNED', `testChanges 声明 ${c.task} 修改 ${norm}，但该文件不在 ${c.task} 的 files/newFiles 里`);
    }
  }
}

// --- 输出 ---
if (args.includes('--json')) {
  console.log(JSON.stringify({ file: planPath, valid: errors.length === 0, errors }, null, 2));
} else if (errors.length) {
  console.error(`[validate-plan] FAIL — ${errors.length} 个错误（${planPath}）：`);
  for (const e of errors) console.error(`  ✗ [${e.code}] ${e.msg}`);
  process.exit(1);
} else {
  console.log(`[validate-plan] PASS — ${tasks?.length ?? 0} 个任务、${acs?.length ?? 0} 条 AC、DAG 无环、所有权不相交（${planPath}）`);
}
process.exit(errors.length ? 1 : 0);
