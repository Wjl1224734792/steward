#!/usr/bin/env node
/**
 * validate-config.mjs — 校验 steward.config.json（T1 配置）。
 *
 * 用法：node validate-config.mjs [路径]（默认 ./steward.config.json）
 * 退出码：0 = 有效；1 = 有错误；2 = 文件不存在/不可读。
 * 未知字段只告警（允许项目扩展），已知字段类型/枚举错误会阻断。
 */
import { readFileSync } from 'node:fs';

const SCHEMA_VERSION = 1;

const CMD_KEYS = ['install', 'dev', 'test', 'lint', 'typecheck', 'build'];
const GATE_KEYS = ['test', 'lint', 'typecheck', 'build'];
const MAINT_KEYS = ['dependencies', 'security', 'duplication', 'docDrift', 'architectureDrift', 'flaky'];
const BROWSER_PROVIDERS = ['playwright-mcp', 'chrome-devtools-mcp', 'built-in'];
const BROWSER_FALLBACKS = ['built-in', 'none'];
const BROWSER_VISUAL = ['unverified', 'verified'];
const ISOLATION_MODES = ['baseline-hash', 'worktree'];

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
        if (typeof r.model !== 'string' || !r.model.trim()) err(`modelRouting.${role}.model 必须是非空字符串`);
        if (r.effort !== undefined && typeof r.effort !== 'string') err(`modelRouting.${role}.effort 必须是字符串`);
        if (r.fallback !== undefined) {
          if (typeof r.fallback !== 'object' || r.fallback === null || typeof r.fallback.model !== 'string' || !r.fallback.model.trim()) {
            err(`modelRouting.${role}.fallback 必须是 { model: "..." }`);
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
const path = process.argv[2] || 'steward.config.json';
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
