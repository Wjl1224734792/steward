#!/usr/bin/env node
/**
 * validate-config.mjs — 校验 steward.config.json（T1 配置）。
 *
 * 用法：node validate-config.mjs [路径] [--skip-catalog]（默认 ./steward.config.json）
 * 退出码：0 = 有效；1 = 有错误；2 = 文件不存在/不可读。
 * 未知字段只告警（允许项目扩展），已知字段类型/枚举错误会阻断。
 *
 * 目录感知校验（v0.9.0）：modelRouting.<role>.model / effort 会对照本机模型目录检查——
 *   - 模型不存在会在派发时直接失败（MODEL_SELECTION_INVALID）；
 *   - effort 必须属于该模型的 effortOptions。
 * 读不到本机模型配置时（catalog.ok === false）以上检查降级为警告；`--skip-catalog` 可完全跳过
 * （用于跨机器共享的配置）。
 */
import { readFileSync } from 'node:fs';
// 同目录模块：build.mjs 会把 zcode/scripts/*.mjs 整体同步到 minimax/scripts/，两处路径都成立。
import { loadCatalog, findModel } from './agent-config-core.mjs';

const SCHEMA_VERSION = 1;

const CMD_KEYS = ['install', 'dev', 'test', 'lint', 'typecheck', 'build'];
const GATE_KEYS = ['test', 'lint', 'typecheck', 'build'];
const MAINT_KEYS = ['dependencies', 'security', 'duplication', 'docDrift', 'architectureDrift', 'flaky'];
const BROWSER_PROVIDERS = ['playwright-mcp', 'chrome-devtools-mcp', 'built-in'];
const BROWSER_FALLBACKS = ['built-in', 'none'];
const BROWSER_VISUAL = ['unverified', 'verified'];
const ISOLATION_MODES = ['baseline-hash', 'worktree'];

// 模型目录状态：main 里在解析配置前加载一次，validate() 只用结果。
const catalogState = { checked: false, ok: false, reason: '', catalog: null };

const errors = [];
const warnings = [];
const ROLES = ['pm', 'architect', 'backend-dev', 'frontend-dev', 'qa-engineer', 'browser-tester', 'reviewer'];
const known = new Set(['schemaVersion', 'docTier', 'commands', 'services', 'gates', 'browser', 'isolation', 'maintenance', 'modelRouting', 'budget']);

function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

function checkStringMap(obj, keys, label, { required = false } = {}) {
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined) { if (required) err(`${label}.${k} 缺失（必填）`); continue; }
    if (typeof v !== 'string' || v.trim() === '') err(`${label}.${k} 必须是非空字符串，实际：${JSON.stringify(v)}`);
  }
}

function checkBoolMap(obj, keys, label) {
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined) { warn(`${label}.${k} 未设置，默认按 false 处理`); continue; }
    if (typeof v !== 'boolean') err(`${label}.${k} 必须是 boolean，实际：${JSON.stringify(v)}`);
  }
}

/**
 * 目录感知校验：模型必须能在本机模型目录里命中（否则派发会 MODEL_SELECTION_INVALID），
 * effort 必须属于该模型的 effortOptions。读不到目录时整项降级为警告，不阻断。
 * @param {string} label  报错前缀，如 "modelRouting.architect"
 * @param {string} model
 * @param {string | undefined} effort
 * @param {string} source 引用来源名（用于降级警告措辞）
 */
function checkAgainstCatalog(label, model, effort, source) {
  if (!catalogState.checked) return;
  if (catalogState.ok === false) {
    const why = catalogState.reason || '读不到本机模型配置';
    warn(`${label}.model：跳过目录校验（${why}），无法确认模型「${model}」是否存在`);
    return;
  }
  const hit = findModel(catalogState.catalog, model);
  if (!hit) {
    err(`${label}.model：模型「${model}」不在本机模型目录中（运行时派发会失败 MODEL_SELECTION_INVALID；如需跨机器共享配置可加 --skip-catalog）`);
    return;
  }
  if (effort === undefined) return;
  const options = Array.isArray(hit.effortOptions) ? hit.effortOptions : [];
  if (options.length === 0) {
    err(`${label}.effort：模型「${model}」不支持思考强度，请删掉 ${source} 里的 effort`);
    return;
  }
  if (!options.includes(effort)) {
    err(`${label}.effort：模型「${model}」不支持档位「${effort}」，可选：${options.join(', ')}`);
  }
}

function validate(cfg) {
  if (typeof cfg !== 'object' || cfg === null || Array.isArray(cfg)) { err('根节点必须是 JSON 对象'); return; }
  if (cfg.schemaVersion !== SCHEMA_VERSION) err(`schemaVersion 必须是 ${SCHEMA_VERSION}，实际：${JSON.stringify(cfg.schemaVersion)}`);
  if (cfg.docTier !== undefined) {
    if (!Number.isInteger(cfg.docTier) || cfg.docTier < 0 || cfg.docTier > 3) err('docTier 必须是 0~3 的整数');
  } else warn('docTier 未设置，默认按 1 处理');

  if (cfg.commands !== undefined) {
    if (typeof cfg.commands !== 'object' || cfg.commands === null || Array.isArray(cfg.commands)) err('commands 必须是对象');
    else { checkStringMap(cfg.commands, CMD_KEYS, 'commands'); known.add('commands'); }
  } else warn('commands 未设置：verify.mjs 将退回 package.json 自动探测');

  if (cfg.services !== undefined) {
    if (!Array.isArray(cfg.services)) err('services 必须是数组');
    else {
      cfg.services.forEach((s, i) => {
        if (typeof s !== 'object' || s === null) { err(`services[${i}] 必须是对象`); return; }
        if (typeof s.name !== 'string' || s.name.trim() === '') err(`services[${i}].name 必须是非空字符串`);
        if (typeof s.cmd !== 'string' || s.cmd.trim() === '') err(`services[${i}].cmd 必须是非空字符串`);
        if (s.port !== undefined && !Number.isInteger(s.port)) err(`services[${i}].port 必须是整数`);
        if (s.ready !== undefined && typeof s.ready !== 'string') err(`services[${i}].ready 必须是字符串`);
        for (const k of Object.keys(s)) if (!['name', 'cmd', 'port', 'ready'].includes(k)) warn(`services[${i}].${k} 是未知字段`);
      });
    }
  }

  if (cfg.gates !== undefined) {
    if (typeof cfg.gates !== 'object' || cfg.gates === null || Array.isArray(cfg.gates)) err('gates 必须是对象');
    else checkBoolMap(cfg.gates, GATE_KEYS, 'gates');
  }

  if (cfg.browser !== undefined) {
    const b = cfg.browser;
    if (typeof b !== 'object' || b === null || Array.isArray(b)) err('browser 必须是对象');
    else {
      if (b.provider !== undefined && !BROWSER_PROVIDERS.includes(b.provider)) err(`browser.provider 必须是 ${BROWSER_PROVIDERS.join(' | ')}，实际：${JSON.stringify(b.provider)}`);
      if (b.fallback !== undefined && !BROWSER_FALLBACKS.includes(b.fallback)) err(`browser.fallback 必须是 ${BROWSER_FALLBACKS.join(' | ')}，实际：${JSON.stringify(b.fallback)}`);
      if (b.visual !== undefined && !BROWSER_VISUAL.includes(b.visual)) err(`browser.visual 必须是 ${BROWSER_VISUAL.join(' | ')}，实际：${JSON.stringify(b.visual)}`);
      for (const k of Object.keys(b)) if (!['provider', 'fallback', 'visual'].includes(k)) warn(`browser.${k} 是未知字段`);
    }
  }

  if (cfg.isolation !== undefined) {
    const iso = cfg.isolation;
    if (typeof iso !== 'object' || iso === null || Array.isArray(iso)) err('isolation 必须是对象');
    else {
      if (iso.mode !== undefined && !ISOLATION_MODES.includes(iso.mode)) err(`isolation.mode 必须是 ${ISOLATION_MODES.join(' | ')}，实际：${JSON.stringify(iso.mode)}`);
      if (iso.worktree !== undefined && typeof iso.worktree !== 'boolean') err(`isolation.worktree 必须是 boolean，实际：${JSON.stringify(iso.worktree)}`);
      if (iso.mode === 'worktree' && iso.worktree === false) err('isolation.mode=worktree 与 isolation.worktree=false 矛盾');
      for (const k of Object.keys(iso)) if (!['mode', 'worktree'].includes(k)) warn(`isolation.${k} 是未知字段`);
    }
  }

  if (cfg.maintenance !== undefined) {
    const m = cfg.maintenance;
    if (typeof m !== 'object' || m === null || Array.isArray(m)) err('maintenance 必须是对象');
    else checkBoolMap(m, MAINT_KEYS, 'maintenance');
  }

  if (cfg.modelRouting !== undefined) {
    const mr = cfg.modelRouting;
    if (typeof mr !== 'object' || mr === null || Array.isArray(mr)) err('modelRouting 必须是对象');
    else {
      for (const [role, r] of Object.entries(mr)) {
        if (!ROLES.includes(role)) warn(`modelRouting."${role}" 不是已知角色（${ROLES.join('/')}）`);
        if (typeof r !== 'object' || r === null) { err(`modelRouting.${role} 必须是对象 { model, effort?, fallback? }`); continue; }
        const hasModel = typeof r.model === 'string' && r.model.trim() !== '';
        if (!hasModel) err(`modelRouting.${role}.model 必须是非空字符串`);
        if (r.effort !== undefined) {
          if (typeof r.effort !== 'string') err(`modelRouting.${role}.effort 必须是字符串`);
          // 成对约束：effort 只在同时声明 model 时生效（官方契约）。
          else if (!hasModel) err(`modelRouting.${role}.effort 需要同时声明 model：effort 只随 model 生效`);
        }
        if (hasModel) checkAgainstCatalog(`modelRouting.${role}`, r.model.trim(), r.effort, 'modelRouting');
        if (r.fallback !== undefined) {
          const fb = r.fallback;
          if (typeof fb !== 'object' || fb === null || Array.isArray(fb)) {
            err(`modelRouting.${role}.fallback 必须是 { model: "...", effort?: "..." }`);
          } else if (typeof fb.model !== 'string' || !fb.model.trim()) {
            err(`modelRouting.${role}.fallback 必须是 { model: "...", effort?: "..." }`);
          } else {
            if (fb.effort !== undefined && typeof fb.effort !== 'string') {
              err(`modelRouting.${role}.fallback.effort 必须是字符串，实际：${JSON.stringify(fb.effort)}`);
            } else {
              checkAgainstCatalog(`modelRouting.${role}.fallback`, fb.model.trim(), fb.effort, 'modelRouting');
            }
          }
        }
      }
    }
  }

  if (cfg.budget !== undefined) {
    const b = cfg.budget;
    if (typeof b !== 'object' || b === null || Array.isArray(b)) err('budget 必须是对象');
    else {
      if (b.maxTotalAttempts !== undefined && (!Number.isInteger(b.maxTotalAttempts) || b.maxTotalAttempts < 1)) err('budget.maxTotalAttempts 必须是正整数');
      for (const k of Object.keys(b)) if (k !== 'maxTotalAttempts') warn(`budget.${k} 是未知字段`);
    }
  }

  for (const k of Object.keys(cfg)) if (!known.has(k)) warn(`根级字段 "${k}" 是未知字段（允许扩展，但 verify/门禁脚本不会读取）`);
}

// --- main ---
const skipCatalog = process.argv.includes('--skip-catalog');
const path = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'steward.config.json';
let raw;
try {
  raw = readFileSync(path, 'utf8');
} catch {
  console.error(`[validate-config] 无法读取配置文件：${path}`);
  process.exit(2);
}

let cfg;
try {
  cfg = JSON.parse(raw);
} catch (e) {
  console.error(`[validate-config] JSON 解析失败：${path}\n  ${e.message}`);
  process.exit(1);
}

// 目录加载放在配置解析之后：配置文件本身坏了要先报那个错，不必白读模型目录。
if (!skipCatalog) {
  catalogState.checked = true;
  try {
    const catalog = loadCatalog();
    catalogState.catalog = catalog;
    catalogState.ok = catalog && catalog.ok === true;
    catalogState.reason = catalogState.ok ? '' : String((catalog && catalog.reason) || '模型目录不可用');
  } catch (e) {
    // loadCatalog 内部已做探测与降级，走到这里说明是意料外异常：同样降级为警告，不阻断。
    catalogState.ok = false;
    catalogState.reason = `读取模型目录失败：${e.message}`;
  }
  if (!catalogState.ok) warn(`模型目录不可用（${catalogState.reason}），modelRouting 的模型/档位检查已降级为警告`);
}

validate(cfg);

if (warnings.length) console.log(`警告（${warnings.length}）：`);
for (const w of warnings) console.log(`  ⚠ ${w}`);
if (errors.length) {
  console.error(`错误（${errors.length}）：`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(`[validate-config] 结果：FAIL（${path}）`);
  process.exit(1);
}
console.log(`[validate-config] 结果：PASS（${path}）`);
process.exit(0);
