#!/usr/bin/env node
/**
 * agent-config-core.mjs — 子代理模型与思考强度配置的核心逻辑（纯 Node、零依赖）。
 *
 * 职责：
 *   1. 解析本机模型配置（~/.minimax/config.yaml 的零依赖 YAML 子集）→ 模型目录 catalog
 *   2. 唯一的分配校验规则（CLI 与本地页面共用）
 *   3. 双层落盘：项目级 steward.config.json 的 modelRouting / 插件默认 frontmatter + 名册表
 *   4. buildState()：把两处配置汇总成前端页面契约的数据结构
 *   5. createRequestHandler()：本地页面的 HTTP 路由
 *
 * 设计约束（见任务单）：
 *   - 只取 model / name / limit / thinking / reasoning 等字段，options.apiKey、baseURL 一律丢弃；
 *   - 写盘先备份、校验不过自动回滚，绝不留下半写状态；
 *   - 所有错误中文、带真实原因，不吞异常。
 */

import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 7 个子代理角色的固定顺序（前端表格顺序也依赖它） */
export const ROLES = ['pm', 'architect', 'backend-dev', 'frontend-dev', 'qa-engineer', 'browser-tester', 'reviewer'];

/** 角色内置中文名：插件 frontmatter 没写 x-mavis.displayName 时的兜底 */
const ROLE_LABELS = {
  'pm': '需求分析师 PM',
  'architect': '架构师',
  'backend-dev': '后端工程师',
  'frontend-dev': '前端工程师',
  'qa-engineer': '测试工程师 QA',
  'browser-tester': '浏览器验收员',
  'reviewer': '代码评审员',
};

/** 公认为标准的思考强度档位名；不在此列的本机档位（如 mediem / hign）会被标为非标准 */
const STANDARD_EFFORTS = new Set(['default', 'off', 'on', 'none', 'low', 'medium', 'high', 'xhigh', 'max']);

/** 页面静态资产白名单：服务端固定拼接文件名，绝不接受前端传入的路径 */
const CLIENT_FILES = new Set(['index.html', 'app.css', 'app.js']);

const CLIENT_CONTENT_TYPES = {
  'index.html': 'text/html; charset=utf-8',
  'app.css': 'text/css; charset=utf-8',
  'app.js': 'text/javascript; charset=utf-8',
};

/** POST /api/save 请求体上限 256 KiB */
const MAX_BODY_BYTES = 256 * 1024;

const PROJECT_CONFIG_NAME = 'steward.config.json';

/** BOM 字符（用码点构造，避免源码里出现不可见字符） */
const BOM = String.fromCharCode(0xfeff);

/** 本模块所在目录（用于找 validate-config.mjs）与包根 */
const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, '..', '..');

// ============================================================================
// YAML 子集解析
// ============================================================================

/**
 * 去掉行尾注释（引号内的不算注释）。
 * @param {string} text 原始行
 * @returns {string} 去注释后的行
 */
function stripComment(text) {
  let quote = null;
  for (let i = 0; i < text.length; i = i + 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\' && quote === '"') { i = i + 1; continue; }
      if (ch === quote) { quote = null; }
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '#' && (i === 0 || /\s/.test(text[i - 1]))) return text.slice(0, i);
  }
  return text;
}

/**
 * 去掉标量两侧引号并处理常见转义；裸值原样返回（含中文、数字、合法标识符）。
 * @param {string} raw 原始标量文本
 * @returns {string} 去引号后的字符串
 */
function unquoteScalar(raw) {
  const t = raw.trim();
  if (t.length >= 2) {
    const head = t[0];
    const tail = t[t.length - 1];
    if (head === "'" && tail === "'") return t.slice(1, -1).replace(/''/g, "'");
    if (head === '"' && tail === '"') {
      return t.slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
  }
  return t;
}

/**
 * 解析零依赖 YAML 子集（块映射 + 块序列 + 标量），面向本机模型配置的真实结构。
 *
 * 支持：空格缩进的嵌套映射、键下块序列（- item，缩进比键多）、标量的裸值 / 单引号 / 双引号、
 * 行尾注释、空行与纯注释行、--- 文档分隔。不支持锚点别名、流式集合、多行块标量——遇到即抛错。
 *
 * @param {string} text YAML 文本
 * @returns {Record<string, unknown>} 解析结果（普通对象）
 * @throws {Error} 语法错误，消息形如「YAML 第 N 行：...」
 */
export function parseYaml(text) {
  const rawLines = String(text === undefined || text === null ? '' : text).replace(/^﻿/, '').split(/\r?\n/);
  const lines = [];
  for (let i = 0; i < rawLines.length; i = i + 1) {
    const lineNo = i + 1;
    const raw = rawLines[i];
    if (/^\s*$/.test(raw)) continue;
    const indentMatch = raw.match(/^[ \t]*/);
    const indentRaw = indentMatch ? indentMatch[0] : '';
    const bodyRaw = raw.slice(indentRaw.length);
    if (bodyRaw.startsWith('#')) continue;
    if (/^---\s*$/.test(bodyRaw) || /^\.\.\.\s*$/.test(bodyRaw)) continue;
    if (indentRaw.indexOf('\t') >= 0) throw new Error('YAML 第 ' + lineNo + ' 行：缩进不允许使用 Tab');
    const body = stripComment(bodyRaw).replace(/\s+$/, '');
    if (!body) continue;
    lines.push({ indent: indentRaw.length, body, line: lineNo });
  }
  if (lines.length === 0) return {};

  const root = {};
  // 栈帧：{ indent, node, isSeq, pendingKey }；pendingKey 表示该帧上「值待定的键」
  const stack = [{ indent: lines[0].indent, node: root, isSeq: false, pendingKey: null }];

  /** 取出 key: rest 形式的映射键；不是映射行时返回 null */
  function splitKey(body, lineNo) {
    const first = body.charAt(0);
    if (first === '"' || first === "'") {
      const q = first;
      let j = 1;
      while (j < body.length) {
        if (q === '"' && body[j] === '\\') { j = j + 2; continue; }
        if (body[j] === q) {
          if (q === "'" && body[j + 1] === "'") { j = j + 2; continue; }
          break;
        }
        j = j + 1;
      }
      if (j >= body.length) throw new Error('YAML 第 ' + lineNo + ' 行：键的引号未闭合');
      const after = body.slice(j + 1);
      const m = after.match(/^\s*:(?:\s+(.*))?$/);
      if (!m) return null;
      return { key: unquoteScalar(body.slice(0, j + 1)), rest: (m[1] ? m[1] : '').trim() };
    }
    const colon = body.indexOf(':');
    if (colon < 0) return null;
    const key = body.slice(0, colon).trim();
    if (key === '') throw new Error('YAML 第 ' + lineNo + ' 行：缺少键名');
    const after = body.slice(colon + 1);
    if (after !== '' && !/^\s/.test(after)) return null; // 形如 a:b 的裸值不是键
    return { key, rest: after.trim() };
  }

  for (const ln of lines) {
    const indent = ln.indent;
    const body = ln.body;
    const lineNo = ln.line;

    // 弹出比当前行更深的帧
    while (stack.length > 1 && indent < stack[stack.length - 1].indent) stack.pop();
    const top = stack[stack.length - 1];

    // ---- 序列项 ----
    if (/^-(?:\s|$)/.test(body)) {
      const rest = body.slice(1).trim();
      let seqNode = null;
      if (top.isSeq && indent === top.indent) {
        seqNode = top.node;
      } else if (top.pendingKey && indent > top.indent) {
        const pendingKey = top.pendingKey;
        if (Array.isArray(top.node[pendingKey])) throw new Error('YAML 第 ' + lineNo + ' 行：键「' + pendingKey + '」不能同时是映射与序列');
        seqNode = [];
        top.node[pendingKey] = seqNode;
        top.pendingKey = null;
        stack.push({ indent, node: seqNode, isSeq: true, pendingKey: null });
      } else if (indent === top.indent && !top.isSeq) {
        throw new Error('YAML 第 ' + lineNo + ' 行：序列前缺少键');
      } else {
        throw new Error('YAML 第 ' + lineNo + ' 行：序列缩进错乱（期望 ' + top.indent + ' 个空格，实际 ' + indent + '）');
      }
      if (rest === '') throw new Error('YAML 第 ' + lineNo + ' 行：空的序列项');
      const r0 = rest.charAt(0);
      if (rest.indexOf(': ') >= 0 && r0 !== '"' && r0 !== "'") {
        throw new Error('YAML 第 ' + lineNo + ' 行：不支持序列内的行内映射');
      }
      seqNode.push(unquoteScalar(rest));
      continue;
    }

    // ---- 映射行 ----
    const kv = splitKey(body, lineNo);
    if (!kv) throw new Error('YAML 第 ' + lineNo + ' 行：不是合法的「键: 值」（缩进错乱或多余内容）');

    let container = null;
    if (indent === top.indent && !top.isSeq) {
      container = top.node;
    } else if (top.pendingKey && indent > top.indent) {
      container = top.node[top.pendingKey];
      top.pendingKey = null;
      if (Array.isArray(container)) throw new Error('YAML 第 ' + lineNo + ' 行：序列里不能再嵌映射');
      stack.push({ indent, node: container, isSeq: false, pendingKey: null });
    } else if (indent > top.indent) {
      throw new Error('YAML 第 ' + lineNo + ' 行：缩进错乱（上一行不是可以继续展开的键）');
    } else {
      throw new Error('YAML 第 ' + lineNo + ' 行：缩进错乱（期望 ' + top.indent + ' 个空格，实际 ' + indent + '）');
    }

    if (Object.prototype.hasOwnProperty.call(container, kv.key)) {
      throw new Error('YAML 第 ' + lineNo + ' 行：重复键「' + kv.key + '」');
    }

    if (kv.rest === '') {
      container[kv.key] = {};
      stack[stack.length - 1].pendingKey = kv.key;
    } else {
      const head = kv.rest.charAt(0);
      if (head === '|' || head === '>' || head === '&' || head === '*') {
        throw new Error('YAML 第 ' + lineNo + ' 行：不支持的多行标量、锚点或别名（' + kv.rest + '）');
      }
      if (head === '{' || head === '[') throw new Error('YAML 第 ' + lineNo + ' 行：不支持的流式集合写法');
      container[kv.key] = unquoteScalar(kv.rest);
    }
  }
  return root;
}

// ============================================================================
// 模型目录
// ============================================================================

/**
 * 默认探测顺序：MINIMAX_CONFIG 环境变量 → ~/.minimax/config.yaml → ~/.minimax-code/config.yaml。
 * @returns {string[]} 依次尝试的路径
 */
function defaultConfigCandidates() {
  const list = [];
  if (process.env.MINIMAX_CONFIG) list.push(resolve(process.env.MINIMAX_CONFIG));
  list.push(join(os.homedir(), '.minimax', 'config.yaml'));
  list.push(join(os.homedir(), '.minimax-code', 'config.yaml'));
  return list;
}

/** 规范 key 前缀 → 供应商类型 */
function providerKindOf(prefix) {
  return prefix.indexOf('custom_provider:') === 0 ? 'custom' : 'managed';
}

/**
 * 把 provider / custom_provider 两段摊平成模型列表。
 * 只读取模型标识、显示名、上下文/输出上限、reasoning 与思考档位；apiKey / baseURL 等一律丢弃。
 * @param {Record<string, unknown>} doc 解析后的配置对象
 * @returns {{ models: object[], providers: object[] }} 模型与供应商
 */
function extractCatalog(doc) {
  const models = [];
  const providers = [];
  const seen = new Set();

  const pushProvider = (id, label) => {
    if (seen.has(id)) return;
    seen.add(id);
    providers.push({ id, label: label || id, kind: providerKindOf(id) });
  };

  const readModels = (modelsSection, providerId, providerLabel) => {
    if (!modelsSection || typeof modelsSection !== 'object' || Array.isArray(modelsSection)) return;
    for (const modelId of Object.keys(modelsSection)) {
      const info = modelsSection[modelId];
      const node = info && typeof info === 'object' ? info : {};
      const thinking = node.thinking && typeof node.thinking === 'object' ? node.thinking : null;
      const rawEfforts = thinking && Array.isArray(thinking.effortOptions) ? thinking.effortOptions : [];
      const effortOptions = rawEfforts
        .filter((e) => typeof e === 'string' && e.trim() !== '')
        .map((e) => e.trim());
      const limit = node.limit && typeof node.limit === 'object' ? node.limit : {};
      const enabledRaw = node.enabled;
      models.push({
        key: providerId + '/' + modelId,
        provider: providerId,
        providerLabel: providerLabel || providerId,
        model: modelId,
        displayName: typeof node.name === 'string' && node.name.trim() ? node.name.trim() : modelId,
        enabled: enabledRaw === undefined ? true : !(enabledRaw === false || String(enabledRaw) === 'false'),
        reasoning: node.reasoning === true || String(node.reasoning) === 'true',
        supportsEffort: effortOptions.length > 0,
        effortOptions,
        nonStandardEfforts: effortOptions.filter((e) => !STANDARD_EFFORTS.has(e)),
        context: limit.context === undefined ? null : (Number.isFinite(Number(limit.context)) ? Number(limit.context) : null),
        output: limit.output === undefined ? null : (Number.isFinite(Number(limit.output)) ? Number(limit.output) : null),
      });
    }
  };

  const managed = doc && doc.provider && typeof doc.provider === 'object' ? doc.provider : {};
  for (const name of Object.keys(managed)) {
    const prov = managed[name];
    if (!prov || typeof prov !== 'object') continue;
    const label = typeof prov.name === 'string' && prov.name.trim() ? prov.name.trim() : name;
    pushProvider(name, label);
    readModels(prov.models, name, label);
  }

  // 自定义供应商：custom_provider.<key>，规范 key 前缀为 custom_provider:<key>
  const custom = doc && doc.custom_provider && typeof doc.custom_provider === 'object' ? doc.custom_provider : {};
  for (const key of Object.keys(custom)) {
    const prov = custom[key];
    if (!prov || typeof prov !== 'object') continue;
    const providerId = 'custom_provider:' + key;
    const label = typeof prov.name === 'string' && prov.name.trim() ? prov.name.trim() : key;
    pushProvider(providerId, label);
    readModels(prov.models, providerId, label);
  }

  return { models, providers };
}

/**
 * 读取本机模型目录（模型的 effortOptions 是档位校验的唯一权威来源）。
 * 读不到配置或解析失败都返回 ok:false + warning，绝不抛未捕获异常。
 *
 * @param {{ configPath?: string }} [options] 指定配置路径；省略时按默认顺序探测
 * @returns {{ ok: boolean, source: string, warning: string, models: object[], providers: object[] }}
 */
export function loadCatalog({ configPath } = {}) {
  const candidates = configPath ? [resolve(configPath)] : defaultConfigCandidates();
  const tried = [];
  let chosen = null;
  for (const p of candidates) {
    tried.push(p);
    try {
      if (existsSync(p) && statSync(p).isFile()) { chosen = p; break; }
    } catch {
      // 权限等异常：继续尝试下一个候选，最后统一报告尝试过的路径
    }
  }

  if (!chosen) {
    return {
      ok: false,
      source: tried.join(' → '),
      warning: '未找到本机模型配置（已尝试：' + tried.join(' → ') + '）；档位校验已降级，模型是否存在无法校验。'
        + '可用环境变量 MINIMAX_CONFIG 指定配置文件路径。',
      models: [],
      providers: [],
    };
  }

  let text;
  try {
    text = readFileSync(chosen, 'utf8');
  } catch (e) {
    return {
      ok: false,
      source: chosen,
      warning: '读取本机模型配置失败（' + chosen + '）：' + e.message + '；档位校验已降级。',
      models: [],
      providers: [],
    };
  }

  let doc;
  try {
    doc = parseYaml(text);
  } catch (e) {
    return {
      ok: false,
      source: chosen,
      warning: '解析本机模型配置失败（' + chosen + '）：' + e.message + '；档位校验已降级。',
      models: [],
      providers: [],
    };
  }

  const extracted = extractCatalog(doc);
  if (extracted.models.length === 0) {
    return {
      ok: false,
      source: chosen,
      warning: '本机模型配置（' + chosen + '）里没有解析到任何模型（provider / custom_provider 段为空或结构不符）；档位校验已降级。',
      models: [],
      providers: extracted.providers,
    };
  }
  return { ok: true, source: chosen, warning: '', models: extracted.models, providers: extracted.providers };
}

/**
 * 在目录里按规范 key 精确查找模型。
 * @param {{ models?: object[] } | null} catalog 目录
 * @param {string} key 规范模型 key
 * @returns {object | null} 命中的模型或 null
 */
export function findModel(catalog, key) {
  if (!catalog || !Array.isArray(catalog.models) || typeof key !== 'string' || key === '') return null;
  for (const m of catalog.models) if (m.key === key) return m;
  return null;
}

// ============================================================================
// 校验（唯一一套规则：CLI 与页面共用）
// ============================================================================

/** 模型不存在时最多列出多少个可用 key，避免把 20+ 个全糊到错误里 */
const MAX_SUGGESTIONS = 8;

function suggestModels(catalog) {
  const keys = (catalog && Array.isArray(catalog.models) ? catalog.models : []).map((m) => m.key);
  const shown = keys.slice(0, MAX_SUGGESTIONS);
  const more = keys.length > shown.length ? '（共 ' + keys.length + ' 个，仅列前 ' + shown.length + ' 个）' : '';
  return '可用模型 key：' + shown.join('、') + more;
}

/**
 * 校验单条 { model, effort?, fallback? } 分配。
 * catalog.ok 为 false 时，模型存在性与档位合法性的检查降级为 warning（不阻断）。
 *
 * @param {string} role 角色名，必须在 ROLES 内
 * @param {{ model?: unknown, effort?: unknown, fallback?: unknown } | null} entry 分配项；null 表示「清空该角色覆盖」
 * @param {object | null} catalog loadCatalog() 的结果
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateAssignment(role, entry, catalog) {
  const errors = [];
  const warnings = [];
  const label = 'modelRouting.' + role;
  const degraded = !catalog || catalog.ok !== true;
  if (degraded) {
    warnings.push('模型目录不可用，已跳过「模型是否存在」与「档位是否合法」的校验（降级为警告）。'
      + (catalog && catalog.warning ? '原因：' + catalog.warning : ''));
  }

  if (ROLES.indexOf(role) < 0) {
    errors.push('未知角色「' + role + '」，必须是：' + ROLES.join(' / '));
    return { ok: false, errors, warnings };
  }
  if (entry === null || entry === undefined) return { ok: errors.length === 0, errors, warnings };
  if (typeof entry !== 'object' || Array.isArray(entry)) {
    errors.push(label + ' 必须是对象 { model, effort?, fallback? }，实际：' + JSON.stringify(entry));
    return { ok: false, errors, warnings };
  }

  const hasVal = (v) => v !== undefined && v !== null && v !== '';

  const checkPair = (scopeLabel, item) => {
    const model = item.model;
    const effort = item.effort;

    // 规则 2/5：model 必填且形如 provider/model；给了 effort 必须给 model
    if (model === undefined || model === null || model === '') {
      if (hasVal(effort)) {
        errors.push(scopeLabel + '.effort 已给出（' + JSON.stringify(effort) + '）但缺少 ' + scopeLabel + '.model：'
          + 'model 与 effort 必须成对声明，单传 effort 不生效。');
      } else {
        errors.push(scopeLabel + '.model 缺失（必填）');
      }
      return;
    }
    if (typeof model !== 'string') {
      errors.push(scopeLabel + '.model 必须是字符串，实际：' + JSON.stringify(model));
      return;
    }
    if (model === '' || model.trim() !== model) {
      errors.push(scopeLabel + '.model 不能为空或含首尾空白，实际：' + JSON.stringify(model));
      return;
    }
    const slash = model.indexOf('/');
    if (slash <= 0 || slash === model.length - 1) {
      errors.push(scopeLabel + '.model 必须是「provider/model」形式（例如 custom_provider:provider-7970db/step-5-preview），'
        + '实际：' + JSON.stringify(model));
      return;
    }

    // 规则 3：模型必须在本机目录里存在（目录不可用时降级为 warning）
    const hit = findModel(catalog, model);
    if (!degraded && !hit) {
      errors.push(scopeLabel + '.model 在本机模型目录中不存在：' + model
        + '。运行时该模型会直接失败 MODEL_SELECTION_INVALID（不会回退父模型）。' + suggestModels(catalog));
    } else if (degraded && !hit) {
      warnings.push(scopeLabel + '.model 无法校验是否存在（模型目录不可用）：' + model);
    }

    // 规则 4：effort 可选，给了就必须在该模型的档位集合内
    if (!hasVal(effort)) return;
    if (typeof effort !== 'string') {
      errors.push(scopeLabel + '.effort 必须是字符串，实际：' + JSON.stringify(effort));
      return;
    }
    if (degraded || !hit) return; // 已降级或已报模型不存在，不再叠加档位错误
    if (!hit.supportsEffort) {
      errors.push(scopeLabel + '.effort 不可用：该模型不支持思考强度（' + hit.key + ' 未声明 effortOptions），'
        + '请去掉 effort 只传 model。');
      return;
    }
    if (hit.effortOptions.indexOf(effort) < 0) {
      errors.push(scopeLabel + '.effort「' + effort + '」不在该模型支持的档位内（' + hit.key + '）：'
        + hit.effortOptions.join(' / '));
      return;
    }
    if (hit.nonStandardEfforts.indexOf(effort) >= 0) {
      warnings.push(scopeLabel + '.effort「' + effort + '」是本机模型配置里的非标准档位名'
        + '（不在 default/off/on/none/low/medium/high/xhigh/max 中），按配置原文判定为合法。');
    }
  };

  checkPair(label, entry);

  // 规则 6：fallback 可选对象，同规则校验
  const fb = entry.fallback;
  if (fb !== undefined && fb !== null) {
    const fbLabel = label + '.fallback';
    if (typeof fb !== 'object' || Array.isArray(fb)) {
      errors.push(fbLabel + ' 必须是对象 { model, effort? }，实际：' + JSON.stringify(fb));
    } else {
      checkPair(fbLabel, fb);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ============================================================================
// 项目级配置（steward.config.json）
// ============================================================================

/**
 * 读取项目级配置。
 * @param {string} projectRoot 项目根目录
 * @returns {{ path: string, exists: boolean, config: object | null, error: string }}
 */
export function readProjectConfig(projectRoot) {
  const root = resolve(projectRoot || process.cwd());
  const path = join(root, PROJECT_CONFIG_NAME);
  if (!existsSync(path)) return { path, exists: false, config: null, error: '' };
  try {
    const raw = readFileSync(path, 'utf8').replace(/^﻿/, '');
    const parsed = raw.trim() === '' ? {} : JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { path, exists: true, config: null, error: PROJECT_CONFIG_NAME + ' 根节点必须是 JSON 对象（' + path + '）' };
    }
    return { path, exists: true, config: parsed, error: '' };
  } catch (e) {
    return { path, exists: true, config: null, error: '解析 ' + path + ' 失败：' + e.message };
  }
}

/** 备份目标文件为同目录 <name>.bak（只留一份，覆盖旧备份） */
function backupFile(file) {
  if (!existsSync(file)) return null;
  const bak = file + '.bak';
  copyFileSync(file, bak);
  return bak;
}

/** 还原或删除：有备份则还原，无备份则删除新建的文件 */
function restoreFromBackup(file, bak) {
  try {
    if (bak) copyFileSync(bak, file);
    else if (existsSync(file)) rmSync(file, { force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * 用 spawnSync 跑一个 node 脚本，收集真实 exit code 与输出。
 * @param {string} scriptPath 脚本绝对路径
 * @param {string[]} args 参数
 * @param {string} cwd 工作目录
 * @returns {{ command: string, exitCode: number, output: string }} 命令回显、退出码、合并输出
 */
function runNodeScript(scriptPath, args, cwd) {
  const quote = (s) => (/\s/.test(s) ? '"' + s + '"' : s);
  const command = [process.execPath, scriptPath, ...args].map(quote).join(' ');
  const res = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 300000,
    windowsHide: true,
  });
  const output = [(res.stdout || ''), (res.stderr || '')].join('').trim();
  const exitCode = typeof res.status === 'number' ? res.status : -1;
  return {
    command,
    exitCode,
    output: output || (res.error ? '执行失败：' + res.error.message : '(无输出)'),
  };
}

/**
 * 写入项目级 steward.config.json 的 modelRouting（增量合并，其它字段原样保留）。
 *
 * 安全措施：写前备份 .bak → 写后跑同目录 validate-config.mjs → 非 0 退出则自动还原（原本不存在则删掉新建文件）。
 *
 * @param {string} projectRoot 项目根目录（必须已存在）
 * @param {Record<string, object | null>} assignments { role: { model, effort?, fallback? } }；null 表示删除该角色覆盖
 * @param {{ catalog?: object }} [options] 可选模型目录（省略则自行加载）
 * @returns {{ ok: boolean, written: object[], validation: object, errors: string[], warnings: string[] }}
 */
export function writeProjectConfig(projectRoot, assignments, options) {
  const opts = options || {};
  const catalog = opts.catalog;
  const errors = [];
  const warnings = [];
  const written = [];
  const validation = {};
  const root = projectRoot ? resolve(projectRoot) : '';
  let isDir = false;
  try { isDir = Boolean(root) && statSync(root).isDirectory(); } catch { isDir = false; }
  if (!isDir) {
    return { ok: false, written, validation, warnings, errors: ['项目根目录不存在或不是目录：' + (projectRoot || '(未提供)')] };
  }
  const entries = assignments && typeof assignments === 'object' ? assignments : {};

  // 1) 全量校验：任一角色不合法则一个字都不写
  const cat = catalog || loadCatalog();
  const checked = {};
  for (const role of Object.keys(entries)) {
    const res = validateAssignment(role, entries[role], cat);
    errors.push(...res.errors.map((e) => '[项目级 ' + role + '] ' + e));
    warnings.push(...res.warnings.map((w) => '[项目级 ' + role + '] ' + w));
    if (res.ok) checked[role] = entries[role];
  }
  if (errors.length) {
    errors.push('校验未通过，已中止写入：项目级配置一个字都没写。');
    return { ok: false, written, validation, errors, warnings };
  }
  if (Object.keys(checked).length === 0) {
    warnings.push('没有需要写入的角色，项目级配置未改动。');
    return { ok: true, written, validation, errors, warnings };
  }

  const current = readProjectConfig(root);
  if (current.error) {
    errors.push(current.error + '；为避免覆盖人工修改，已中止写入。');
    return { ok: false, written, validation, errors, warnings };
  }
  const base = current.exists && current.config ? current.config : { schemaVersion: 1 };
  const next = { ...base };
  const routing = (base.modelRouting && typeof base.modelRouting === 'object' && !Array.isArray(base.modelRouting))
    ? { ...base.modelRouting } : {};

  // 增量合并：只动传入的角色，其它字段原样保留
  for (const role of Object.keys(checked)) {
    const entry = checked[role];
    if (entry === null) { delete routing[role]; continue; }
    const item = { model: entry.model };
    if (entry.effort !== undefined && entry.effort !== null && entry.effort !== '') item.effort = entry.effort;
    if (entry.fallback && typeof entry.fallback === 'object') {
      const fb = { model: entry.fallback.model };
      if (entry.fallback.effort !== undefined && entry.fallback.effort !== null && entry.fallback.effort !== '') {
        fb.effort = entry.fallback.effort;
      }
      item.fallback = fb;
    }
    routing[role] = item;
  }
  if (Object.keys(routing).length === 0) delete next.modelRouting;
  else next.modelRouting = routing;

  const bak = backupFile(current.path);
  try {
    writeFileSync(current.path, JSON.stringify(next, null, 2) + '\n', 'utf8');
  } catch (e) {
    restoreFromBackup(current.path, bak);
    errors.push('写入 ' + current.path + ' 失败：' + e.message + '；已自动回滚，未落盘。');
    return { ok: false, written, validation, errors, warnings };
  }

  // 2) 官方校验器复核
  const validator = join(HERE, 'validate-config.mjs');
  if (!existsSync(validator)) {
    const restored = restoreFromBackup(current.path, bak);
    errors.push('找不到校验器 validate-config.mjs（' + validator + '），无法确认写入有效'
      + (restored ? '；已自动回滚，未落盘。' : '；自动回滚失败，请手动检查 ' + current.path + ' 与同名 .bak。'));
    return { ok: false, written, validation, errors, warnings };
  }
  const result = runNodeScript(validator, [current.path], root);
  validation.project = result;
  if (result.exitCode !== 0) {
    const restored = restoreFromBackup(current.path, bak);
    errors.push('validate-config.mjs 校验失败（exit ' + result.exitCode + '）'
      + (restored ? '；已自动回滚，未落盘。' : '；自动回滚失败，请手动检查同名 .bak。'));
    const lines = result.output.split(/\r?\n/).filter((l) => /✗|错误|FAIL/.test(l)).slice(0, 10);
    for (const line of lines) errors.push('  ' + line.trim());
    return { ok: false, written, validation, errors, warnings };
  }
  for (const line of result.output.split(/\r?\n/)) {
    if (/^\s*⚠/.test(line)) warnings.push('[validate-config] ' + line.trim());
  }
  for (const role of Object.keys(checked)) {
    written.push({
      scope: 'project',
      role,
      target: current.path,
      message: checked[role] === null ? '已删除项目级覆盖' : '已写入项目级配置',
    });
  }
  return { ok: true, written, validation, errors, warnings };
}

// ============================================================================
// 插件默认（frontmatter + 名册表）
// ============================================================================

/**
 * 判定目录是不是 Steward 源码仓库根：同时含 host/minimax/agents 与 zcode/scripts。
 * @param {string | null | undefined} dir 目录
 * @returns {boolean} 是否是仓库根
 */
function isRepoRoot(dir) {
  if (!dir) return false;
  try {
    return statSync(join(dir, 'host', 'minimax', 'agents')).isDirectory()
      && statSync(join(dir, 'zcode', 'scripts')).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 从给定起点向上查找 Steward 源码仓库根。
 * @param {string} cwd 起点目录（也可以是文件路径）
 * @returns {string | null} 仓库根绝对路径或 null
 */
export function resolveRepoRoot(cwd) {
  let dir;
  try {
    dir = resolve(cwd || process.cwd());
    if (!statSync(dir).isDirectory()) dir = dirname(dir);
  } catch {
    return null;
  }
  for (let i = 0; i < 10; i = i + 1) {
    if (isRepoRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * 定位页面静态资产目录（必须含 index.html）。
 * 依次尝试 packageRoot 与 repoRoot 下的已知布局，安装后的插件包也能命中。
 * @param {{ packageRoot?: string, repoRoot?: string }} [options] 起点
 * @returns {string | null} 资产目录绝对路径或 null
 */
export function resolveClientDir(options) {
  const opts = options || {};
  const candidateList = [];
  const push = (base, parts) => {
    if (!base) return;
    candidateList.push(join(resolve(base), ...parts));
  };
  push(opts.packageRoot, ['host', 'minimax', 'miniapp', 'client']);
  push(opts.packageRoot, ['miniapp', 'client']);
  push(opts.packageRoot, ['client']);
  push(opts.repoRoot, ['host', 'minimax', 'miniapp', 'client']);
  for (const dir of candidateList) {
    try {
      if (statSync(dir).isDirectory() && existsSync(join(dir, 'index.html'))) return dir;
    } catch {
      // 不存在：继续下一个候选
    }
  }
  return null;
}

/** 读 frontmatter 里某个顶层键的原始值（缩进为 0 的行），没有返回 null */
function readFrontmatterField(fmText, key) {
  const safe = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^' + safe + ':[ \\t]*(.*)$', 'm');
  const m = fmText.match(re);
  if (!m) return null;
  const v = unquoteScalar(m[1]);
  return v === '' ? null : v;
}

/** 从 frontmatter 读 x-mavis.displayName（缩进的子键） */
function readDisplayName(fmText) {
  const xm = fmText.match(/^x-mavis:[ \t]*(?:\r?\n)((?:[ \t]+.*(?:\r?\n|$))*)/m);
  if (!xm) return '';
  const m = xm[1].match(/^[ \t]+displayName:[ \t]*(.*)$/m);
  return m ? unquoteScalar(m[1]) : '';
}

/** 拆 frontmatter 与正文：{ fm: null } 表示没有 frontmatter 块；raw 是原始块（含结尾换行） */
function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { fm: null, raw: '', rest: text };
  return { fm: m[1], raw: m[0], rest: text.slice(m[0].length) };
}

/**
 * 读取插件默认分配：7 个角色 frontmatter 的 model / effort / displayName，以及名册表的同一份数据。
 *
 * @param {string} repoRoot 源码仓库根
 * @returns {{ ok: boolean, root: string | null, agents: object, roster: object, errors: string[] }}
 */
export function readPluginDefaults(repoRoot) {
  const root = repoRoot ? resolve(repoRoot) : null;
  const agents = {};
  const roster = {};
  const errors = [];
  for (const role of ROLES) {
    agents[role] = { model: null, effort: null, displayName: ROLE_LABELS[role] };
    roster[role] = { model: null, effort: null };
  }

  if (!root || !isRepoRoot(root)) {
    errors.push('未找到 Steward 源码仓库（需同时含 host/minimax/agents 与 zcode/scripts）：' + (root || '(未提供)'));
    return { ok: false, root, agents, roster, errors };
  }

  for (const role of ROLES) {
    const file = join(root, 'host', 'minimax', 'agents', role + '.frontmatter.md');
    if (!existsSync(file)) { errors.push('缺少 agent 定义文件：' + file); continue; }
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (e) {
      errors.push('读取 ' + file + ' 失败：' + e.message);
      continue;
    }
    const parts = splitFrontmatter(text);
    if (parts.fm === null) { errors.push(file + ' 缺 frontmatter（--- 块）'); continue; }
    agents[role] = {
      model: readFrontmatterField(parts.fm, 'model'),
      effort: readFrontmatterField(parts.fm, 'effort'),
      displayName: readDisplayName(parts.fm) || ROLE_LABELS[role],
    };
  }

  const rosterPath = join(root, 'host', 'minimax', 'skills', 'steward', 'roster.md');
  if (!existsSync(rosterPath)) {
    errors.push('缺少名册表：' + rosterPath);
  } else {
    let text = '';
    try {
      text = readFileSync(rosterPath, 'utf8');
    } catch (e) {
      errors.push('读取 ' + rosterPath + ' 失败：' + e.message);
    }
    const parsed = parseRoster(text);
    for (const role of ROLES) if (parsed[role]) roster[role] = parsed[role];
  }

  return { ok: errors.length === 0, root, agents, roster, errors };
}

/** 拆一行 markdown 表格为单元格（去首尾空白） */
function splitTableRow(line) {
  const t = line.trim();
  const inner = t.charAt(0) === '|' ? t.slice(1) : t;
  const trimmed = inner.charAt(inner.length - 1) === '|' ? inner.slice(0, -1) : inner;
  return trimmed.split('|').map((c) => c.trim());
}

/** 取单元格里的反引号值；无引号时取原文 */
function cellValue(cell) {
  const m = (cell || '').match(/`([^`]+)`/);
  if (m) return m[1].trim();
  const t = (cell || '').trim();
  return t === '' ? null : t;
}

/**
 * 解析名册表「模型分配」：兼容旧表（一行多角色，用 / 分隔）与新表（一角色一行）。
 * @param {string} text roster.md 全文
 * @returns {Record<string, { model: string | null, effort: string | null }>} 角色 → 分配
 */
function parseRoster(text) {
  const out = {};
  if (!text) return out;
  for (const line of text.split(/\r?\n/)) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = splitTableRow(line);
    if (cells.length < 2) continue;
    const found = cells[0].match(/steward:[a-z-]+/g);
    if (!found) continue;
    const roles = found.map((s) => s.slice('steward:'.length));
    const model = cellValue(cells[1]);
    const rawEffort = cells.length > 2 ? cellValue(cells[2]) : null;
    // 第三列若已是「生效方式」说明（新表），就不是档位
    const effort = rawEffort && !/覆盖|生效|插件/.test(rawEffort) ? rawEffort : null;
    for (const role of roles) out[role] = { model, effort };
  }
  return out;
}

/**
 * 把 frontmatter 里的 model / effort 改成目标值，文件其余部分逐字节不变。
 * 规则：有 effort 则替换（没有就插在 model 之后）；entry 无 effort 则删掉 effort 行。
 * @param {string} text 完整文件内容
 * @param {{ model: string, effort?: string | null }} entry 目标值
 * @returns {string} 新内容
 */
function applyFrontmatterModel(text, entry) {
  const parts = splitFrontmatter(text);
  if (parts.fm === null) throw new Error('缺 frontmatter（--- 块），拒绝修改');
  const eol = parts.raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const fmLines = parts.fm.split(/\r?\n/);
  let modelIdx = -1;
  let effortIdx = -1;
  for (let i = 0; i < fmLines.length; i = i + 1) {
    if (modelIdx < 0 && /^model:/.test(fmLines[i])) modelIdx = i;
    if (effortIdx < 0 && /^effort:/.test(fmLines[i])) effortIdx = i;
  }
  if (modelIdx >= 0) fmLines[modelIdx] = 'model: "' + entry.model + '"';
  else fmLines.push('model: "' + entry.model + '"');
  if (entry.effort) {
    const effortLine = 'effort: "' + entry.effort + '"';
    if (effortIdx >= 0) fmLines[effortIdx] = effortLine;
    else fmLines.splice(modelIdx >= 0 ? modelIdx + 1 : fmLines.length, 0, effortLine);
  } else if (effortIdx >= 0) {
    fmLines.splice(effortIdx, 1);
  }
  return '---' + eol + fmLines.join(eol) + eol + '---' + eol + parts.rest;
}

/** 一格名册表值（反引号包裹，缺省用 —） */
function rosterCell(v) {
  return v ? '`' + v + '`' : '—';
}

/** 一行名册表的模型分配行（新格式：一角色一行） */
function rosterRow(role, entry) {
  return '| `steward:' + role + '` | ' + rosterCell(entry.model) + ' | ' + rosterCell(entry.effort)
    + ' | 插件默认；项目级 `modelRouting` 可覆盖 |';
}

/**
 * 同步名册表：按角色定位行并替换 model / effort 单元格；
 * 旧格式（一行多角色，用 / 分隔）会被拆成每角色一行；缺失的角色插到表格末尾。
 * @param {string} text roster.md 全文
 * @param {Record<string, { model: string, effort?: string | null }>} targets 目标值（键为角色）
 * @returns {string} 新内容
 */
function syncRoster(text, targets) {
  const eol = text.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);

  // 找「模型分配」表头：表头行 + 分隔行，且表头含 model / 模型
  let headerIdx = -1;
  for (let i = 0; i < lines.length - 1; i = i + 1) {
    if (!/^\s*\|/.test(lines[i])) continue;
    if (/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1]) && /model|模型/.test(lines[i])) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return text;

  let endIdx = headerIdx;
  while (endIdx + 1 < lines.length && /^\s*\|/.test(lines[endIdx + 1])) endIdx = endIdx + 1;

  const pending = new Set(Object.keys(targets));
  const rows = [];
  for (let i = headerIdx + 2; i <= endIdx; i = i + 1) {
    const cells = splitTableRow(lines[i]);
    const found = cells[0] ? cells[0].match(/steward:[a-z-]+/g) : null;
    if (!found) { rows.push(lines[i]); continue; }
    if (found.length === 1) {
      const role = found[0].slice('steward:'.length);
      if (Object.prototype.hasOwnProperty.call(targets, role)) {
        rows.push(rosterRow(role, targets[role]));
        pending.delete(role);
      } else {
        rows.push(lines[i]);
      }
      continue;
    }
    // 旧格式：一个单元格写了多个角色 → 拆成每角色一行，未传值的角色保留原值
    const model = cellValue(cells[1]);
    const rawEffort = cells.length > 2 ? cellValue(cells[2]) : null;
    const effort = rawEffort && !/覆盖|生效|插件/.test(rawEffort) ? rawEffort : null;
    for (const token of found) {
      const role = token.slice('steward:'.length);
      if (Object.prototype.hasOwnProperty.call(targets, role)) {
        rows.push(rosterRow(role, targets[role]));
        pending.delete(role);
      } else {
        rows.push(rosterRow(role, { model, effort }));
      }
    }
  }

  for (const role of ROLES) {
    if (pending.has(role)) rows.push(rosterRow(role, targets[role]));
  }
  lines.splice(headerIdx + 2, endIdx - headerIdx - 1, ...rows);
  return lines.join(eol);
}

/**
 * 写入插件默认：7 个 agent frontmatter 的 model/effort + 名册表，跑 build.mjs 复核，失败自动还原。
 *
 * build.mjs 会重新生成 minimax/ 与 zcode/ 的产物——这是预期行为；但源码改写失败或 build 非 0 退出时必须回滚。
 *
 * @param {string} repoRoot 源码仓库根
 * @param {Record<string, { model: string, effort?: string | null } | null>} assignments 角色 → 目标值；null/undefined 表示跳过
 * @param {{ catalog?: object }} [options] 可选模型目录
 * @returns {{ ok: boolean, written: object[], validation: object, errors: string[], warnings: string[] }}
 */
export function writePluginDefaults(repoRoot, assignments, options) {
  const opts = options || {};
  const catalog = opts.catalog;
  const errors = [];
  const warnings = [];
  const written = [];
  const validation = {};
  const root = repoRoot ? resolve(repoRoot) : null;
  if (!root || !isRepoRoot(root)) {
    return { ok: false, written, validation, warnings, errors: ['不是 Steward 源码仓库（需含 host/minimax/agents 与 zcode/scripts）：' + (root || '(未提供)')] };
  }
  const entries = assignments && typeof assignments === 'object' ? assignments : {};

  // 1) 全量校验：任一角色不合法则一个字都不写
  const cat = catalog || loadCatalog();
  const checked = {};
  for (const role of Object.keys(entries)) {
    const entry = entries[role];
    if (entry === null || entry === undefined) continue;
    const res = validateAssignment(role, entry, cat);
    errors.push(...res.errors.map((e) => '[插件默认 ' + role + '] ' + e));
    warnings.push(...res.warnings.map((w) => '[插件默认 ' + role + '] ' + w));
    if (res.ok) checked[role] = entry;
  }
  if (errors.length) {
    errors.push('校验未通过，已中止写入：插件默认文件一个字都没改。');
    return { ok: false, written, validation, errors, warnings };
  }
  if (Object.keys(checked).length === 0) {
    warnings.push('没有需要写入的角色，插件默认未改动。');
    return { ok: true, written, validation, errors, warnings };
  }

  // 2) 改写源码（全部先备份，记录用于失败回滚）
  const backups = [];
  const payouts = [];
  const rosterPath = join(root, 'host', 'minimax', 'skills', 'steward', 'roster.md');

  const commit = (file, nextText, role, message) => {
    const bak = backupFile(file);
    backups.push({ file, bak });
    writeFileSync(file, nextText, 'utf8');
    payouts.push({ scope: 'plugin', role, target: file, message });
  };

  try {
    for (const role of Object.keys(checked)) {
      const file = join(root, 'host', 'minimax', 'agents', role + '.frontmatter.md');
      if (!existsSync(file)) throw new Error('缺少 agent 定义文件：' + file);
      const before = readFileSync(file, 'utf8');
      const after = applyFrontmatterModel(before, checked[role]);
      commit(file, after, role, '已更新 agent frontmatter 的 model/effort');
    }
    if (existsSync(rosterPath)) {
      const before = readFileSync(rosterPath, 'utf8');
      const after = syncRoster(before, checked);
      if (after !== before) commit(rosterPath, after, '(名册表)', '已同步名册表的模型分配');
      else warnings.push('名册表已是目标值，未改动。');
    } else {
      warnings.push('未找到名册表 ' + rosterPath + '，只更新了 frontmatter。');
    }
  } catch (e) {
    errors.push('改写插件默认失败：' + e.message);
  }

  if (errors.length) {
    for (const b of backups.reverse()) restoreFromBackup(b.file, b.bak);
    errors.push('写入失败，已还原全部备份。');
    return { ok: false, written, validation, errors, warnings };
  }

  // 3) build.mjs 复核
  const builder = join(root, 'zcode', 'scripts', 'build.mjs');
  if (!existsSync(builder)) {
    for (const b of backups.reverse()) restoreFromBackup(b.file, b.bak);
    errors.push('找不到构建脚本 ' + builder + '，已还原全部备份。');
    return { ok: false, written, validation, errors, warnings };
  }
  const result = runNodeScript(builder, [], root);
  validation.plugin = result;
  if (result.exitCode !== 0) {
    for (const b of backups.reverse()) restoreFromBackup(b.file, b.bak);
    errors.push('build.mjs 复核失败（exit ' + result.exitCode + '），已还原全部备份（' + backups.length + ' 个文件）。');
    const lines = result.output.split(/\r?\n/).filter((l) => l.trim()).slice(-10);
    for (const line of lines) errors.push('  ' + line);
    return { ok: false, written, validation, errors, warnings };
  }
  for (const line of result.output.split(/\r?\n/)) {
    if (/警告|⚠/.test(line) && line.trim()) warnings.push('[build] ' + line.trim());
  }
  written.push(...payouts);
  return { ok: true, written, validation, errors, warnings };
}

// ============================================================================
// 状态汇总
// ============================================================================

/** 本地时区的 ISO8601（带 +08:00 这类偏移，页面可直接显示） */
function localIsoString(date) {
  const d = date || new Date();
  const pad = (n) => String(Math.abs(n)).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
    + sign + pad(Math.floor(Math.abs(off) / 60)) + ':' + pad(Math.abs(off) % 60);
}

/** 读项目级 modelRouting.<role>，规范化为 { model, effort, fallback } 或 null */
function projectEntry(projectConfig, role) {
  const routing = projectConfig && projectConfig.modelRouting && typeof projectConfig.modelRouting === 'object'
    ? projectConfig.modelRouting : {};
  const raw = routing[role];
  if (!raw || typeof raw !== 'object') return null;
  const model = typeof raw.model === 'string' && raw.model ? raw.model : null;
  if (!model) return null;
  const effort = typeof raw.effort === 'string' && raw.effort ? raw.effort : null;
  let fallback = null;
  if (raw.fallback && typeof raw.fallback === 'object' && typeof raw.fallback.model === 'string' && raw.fallback.model) {
    fallback = {
      model: raw.fallback.model,
      effort: typeof raw.fallback.effort === 'string' && raw.fallback.effort ? raw.fallback.effort : null,
    };
  }
  return { model, effort, fallback };
}

/**
 * 汇总项目级 + 插件默认，生成前端页面契约的状态（字段名与形状按契约固定）。
 *
 * 生效优先级：项目级 modelRouting > 插件 frontmatter 默认 > 无。
 *
 * @param {{ projectRoot?: string, repoRoot?: string, configPath?: string }} [options] 起点
 * @returns {object} state
 */
export function buildState(options) {
  const opts = options || {};
  const configPath = opts.configPath;
  const catalog = loadCatalog({ configPath });
  const projectDir = resolve(opts.projectRoot || process.cwd());
  const projectCfg = readProjectConfig(projectDir);
  const detectedRepo = opts.repoRoot ? resolve(opts.repoRoot) : resolveRepoRoot(projectDir);
  const repoOk = Boolean(detectedRepo && isRepoRoot(detectedRepo));
  const plugin = repoOk
    ? readPluginDefaults(detectedRepo)
    : { ok: false, root: null, agents: {}, roster: {}, errors: ['未找到 Steward 源码仓库'] };

  const roles = ROLES.map((role) => {
    const pluginAgent = (plugin.agents && plugin.agents[role]) || {};
    const pluginModel = pluginAgent.model || null;
    const pluginEffort = pluginAgent.effort || null;
    const project = projectEntry(projectCfg.config, role);

    let model = null;
    let effort = null;
    let fallback = null;
    let source = 'none';
    if (project) {
      model = project.model;
      effort = project.effort;
      fallback = project.fallback;
      source = 'project';
    } else if (pluginModel) {
      model = pluginModel;
      effort = pluginEffort;
      source = 'plugin';
    }

    return {
      role,
      displayName: pluginAgent.displayName || ROLE_LABELS[role],
      model,
      effort,
      fallback,
      source,
      pluginModel,
      pluginEffort,
      differsFromPlugin: Boolean(project) && (model !== pluginModel || (effort || null) !== (pluginEffort || null)),
    };
  });

  return {
    ok: true,
    generatedAt: localIsoString(),
    project: { root: projectDir, configPath: projectCfg.path, exists: projectCfg.exists },
    repo: { root: detectedRepo, detected: repoOk },
    catalog: { ok: catalog.ok, source: catalog.source, warning: catalog.warning, models: catalog.models },
    roles,
  };
}

// ============================================================================
// 镜像同步
// ============================================================================

/**
 * 镜像同步 src → dest：复制全部文件（递归子目录），并删除 dest 中源不存在的文件/目录。
 * @param {string} src 源目录
 * @param {string} dest 目标目录
 * @returns {{ copied: number, removed: number }} 复制与删除的条目数
 */
export function mirrorDir(src, dest) {
  const from = resolve(src);
  const to = resolve(dest);
  let isDir = false;
  try { isDir = statSync(from).isDirectory(); } catch { isDir = false; }
  if (!isDir) throw new Error('源目录不存在：' + from);
  if (from === to) throw new Error('源目录与目标目录相同，拒绝镜像：' + from);
  mkdirSync(to, { recursive: true });

  const stats = { copied: 0, removed: 0 };

  const walk = (relPath) => {
    const srcDir = relPath ? join(from, relPath) : from;
    const destDir = relPath ? join(to, relPath) : to;
    const srcNames = new Set(readdirSync(srcDir));
    for (const name of readdirSync(destDir)) {
      if (srcNames.has(name)) continue;
      rmSync(join(destDir, name), { recursive: true, force: true });
      stats.removed = stats.removed + 1;
    }
    for (const name of srcNames) {
      const s = join(srcDir, name);
      const d = join(destDir, name);
      const st = statSync(s);
      if (st.isDirectory()) {
        mkdirSync(d, { recursive: true });
        walk(relPath ? join(relPath, name) : name);
      } else if (st.isFile()) {
        copyFileSync(s, d);
        stats.copied = stats.copied + 1;
      }
    }
  };
  walk('');
  return stats;
}

// ============================================================================
// HTTP 路由层
// ============================================================================

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

function sendText(res, status, text, contentType) {
  const buf = Buffer.from(text, 'utf8');
  res.writeHead(status, { 'Content-Type': contentType || 'text/plain; charset=utf-8', 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
  res.end(buf);
}

/** 读取请求体（上限 256 KiB）；超限或出错时以 Error 拒绝 */
function readBody(req, limit) {
  return new Promise((onOk, onErr) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size = size + chunk.length;
      if (size > limit) {
        onErr(new Error('请求体超过上限 ' + Math.round(limit / 1024) + ' KiB'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => onOk(Buffer.concat(chunks).toString('utf8')));
    req.on('error', (e) => onErr(new Error('读取请求体失败：' + e.message)));
  });
}

/**
 * 创建本地页面的请求处理器（http.createServer 或 Mini App 桥接复用）。
 *
 * 路由：GET / 与 /index.html、GET /app.css、GET /app.js、GET /api/state、POST /api/save。
 * 安全：静态文件名固定白名单；projectRoot 必须是已存在目录；repoRoot 必须含 host/minimax/agents
 * 与 zcode/scripts；写操作串行化（忙标志），防重复点击双写。
 *
 * @param {{ projectRoot?: string, repoRoot?: string, configPath?: string, clientDir?: string }} [options]
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void}
 */
export function createRequestHandler(options) {
  const opts = options || {};
  const projectRoot = opts.projectRoot;
  const repoRoot = opts.repoRoot;
  const configPath = opts.configPath;
  let busy = false;
  const client = opts.clientDir || resolveClientDir({
    packageRoot: PACKAGE_ROOT,
    repoRoot: repoRoot || resolveRepoRoot(projectRoot || process.cwd()),
  });

  const fail = (res, status, messages) => {
    sendJson(res, status, { ok: false, written: [], validation: {}, warnings: [], errors: messages });
  };

  const handleSave = async (req, res) => {
    if (busy) {
      fail(res, 409, ['已有一次保存正在进行，请稍候再试（写操作已串行化）。本次未做任何写入。']);
      return;
    }
    busy = true;
    try {
      let raw;
      try {
        raw = await readBody(req, MAX_BODY_BYTES);
      } catch (e) {
        fail(res, 400, [e.message + '。已自动回滚，未落盘。']);
        return;
      }
      let body;
      try {
        body = raw.trim() === '' ? {} : JSON.parse(raw);
      } catch (e) {
        fail(res, 400, ['请求体不是合法 JSON：' + e.message + '。已自动回滚，未落盘。']);
        return;
      }
      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        fail(res, 400, ['请求体必须是 JSON 对象。已自动回滚，未落盘。']);
        return;
      }

      const scope = body.scope === undefined ? 'project' : body.scope;
      if (['project', 'plugin', 'both'].indexOf(scope) < 0) {
        fail(res, 400, ['scope 必须是 project | plugin | both，实际：' + JSON.stringify(scope) + '。已自动回滚，未落盘。']);
        return;
      }
      const assignments = body.assignments;
      if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) {
        fail(res, 400, ['assignments 必须是对象 { role: { model, effort?, fallback? } }。已自动回滚，未落盘。']);
        return;
      }
      if (Object.keys(assignments).length === 0) {
        fail(res, 400, ['assignments 为空，没有需要保存的角色。已自动回滚，未落盘。']);
        return;
      }

      // 路径白名单：projectRoot 必须是已存在目录；repoRoot 必须是 Steward 源码仓库
      const targetProject = body.projectRoot ? resolve(String(body.projectRoot)) : (projectRoot ? resolve(projectRoot) : null);
      const targetRepo = body.repoRoot ? resolve(String(body.repoRoot)) : (repoRoot ? resolve(repoRoot) : null);
      const needsProject = scope === 'project' || scope === 'both';
      const needsPlugin = scope === 'plugin' || scope === 'both';

      if (needsProject) {
        let ok = false;
        try { ok = Boolean(targetProject) && statSync(targetProject).isDirectory(); } catch { ok = false; }
        if (!ok) {
          fail(res, 400, ['projectRoot 不是已存在的目录：' + (targetProject || '(未提供)') + '。已自动回滚，未落盘。']);
          return;
        }
      }
      if (needsPlugin) {
        if (!targetRepo || !isRepoRoot(targetRepo)) {
          fail(res, 400, ['repoRoot 不是 Steward 源码仓库（需含 host/minimax/agents 与 zcode/scripts）：'
            + (targetRepo || '(未提供)') + '。已自动回滚，未落盘。']);
          return;
        }
      }

      // 先全量校验：任一角色不合法 → 一个字都不写
      const cat = loadCatalog({ configPath });
      const errors = [];
      const warnings = [];
      const valid = {};
      for (const role of Object.keys(assignments)) {
        const entry = assignments[role];
        const r = validateAssignment(role, entry, cat);
        errors.push(...r.errors.map((e) => '[scope=' + scope + '] ' + e));
        warnings.push(...r.warnings);
        if (r.ok) valid[role] = entry;
      }
      if (errors.length) {
        errors.push('校验未通过，已自动回滚，未落盘。');
        sendJson(res, 400, { ok: false, written: [], validation: {}, warnings, errors });
        return;
      }

      const written = [];
      const validation = {};
      if (needsProject && targetProject) {
        const r = writeProjectConfig(targetProject, valid, { catalog: cat });
        written.push(...r.written);
        errors.push(...r.errors);
        warnings.push(...r.warnings);
        Object.assign(validation, r.validation);
      }
      if (needsPlugin && targetRepo && errors.length === 0) {
        const pluginAssign = {};
        for (const role of Object.keys(valid)) {
          const entry = valid[role];
          if (!entry) continue; // null = 删除项目级覆盖，对插件默认无意义
          pluginAssign[role] = { model: entry.model, effort: entry.effort === undefined ? null : entry.effort };
        }
        if (Object.keys(pluginAssign).length) {
          const r = writePluginDefaults(targetRepo, pluginAssign, { catalog: cat });
          written.push(...r.written);
          errors.push(...r.errors);
          warnings.push(...r.warnings);
          Object.assign(validation, r.validation);
        }
      } else if (needsPlugin && errors.length > 0) {
        errors.push('项目级写入失败：按「全有或全无」原则未继续写插件默认。');
      }

      if (errors.length) {
        sendJson(res, 400, { ok: false, written, validation, warnings, errors });
        return;
      }
      if (needsPlugin) warnings.push('插件默认已更新：改动在新会话（或重新安装插件后）生效。');
      sendJson(res, 200, { ok: true, written, validation, warnings, errors: [] });
    } catch (e) {
      fail(res, 500, ['处理 /api/save 时发生未预期错误：' + e.message]);
    } finally {
      busy = false;
    }
  };

  return (req, res) => {
    let pathname = '';
    try {
      pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    } catch {
      sendText(res, 400, '非法的请求路径');
      return;
    }
    const method = String(req.method || 'GET').toUpperCase();

    if (pathname === '/api/state') {
      if (method !== 'GET' && method !== 'HEAD') { sendJson(res, 405, { ok: false, errors: ['/api/state 只支持 GET'] }); return; }
      try {
        sendJson(res, 200, buildState({ projectRoot, repoRoot, configPath }));
      } catch (e) {
        sendJson(res, 500, { ok: false, errors: ['读取状态失败：' + e.message] });
      }
      return;
    }

    if (pathname === '/api/save') {
      if (method !== 'POST') { sendJson(res, 405, { ok: false, errors: ['/api/save 只支持 POST'] }); return; }
      handleSave(req, res);
      return;
    }

    if (method !== 'GET' && method !== 'HEAD') { sendText(res, 405, '不支持的请求方法'); return; }

    const name = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    if (!CLIENT_FILES.has(name)) { sendText(res, 404, '未找到：' + pathname); return; }
    if (!client) {
      sendText(res, 500, '未找到页面资产目录（期望含 index.html / app.css / app.js）：请用 CLI 的 install --apply 安装插件，或在 Steward 源码仓库内运行。');
      return;
    }
    const file = join(client, name);
    try {
      const buf = readFileSync(file);
      res.writeHead(200, { 'Content-Type': CLIENT_CONTENT_TYPES[name], 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
      if (method === 'HEAD') res.end();
      else res.end(buf);
    } catch (e) {
      sendText(res, 500, '读取页面资产失败：' + file + '\n' + e.message, 'text/plain; charset=utf-8');
    }
  };
}

