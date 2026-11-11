#!/usr/bin/env node
/**
 * agent-config.mjs — 子代理模型与思考强度配置的 CLI（本机模型目录 / 查看 / 设置 / 本地页 / 安装）。
 *
 * 用法：
 *   node agent-config.mjs catalog                              打印本机模型目录（provider 分组 + 档位集合）
 *   node agent-config.mjs show [--project <root>] [--repo <root>] [--json]
 *   node agent-config.mjs set --role <role> --model <key> [--effort <e>] [--fallback <key>] [--fallback-effort <e>]
 *                             [--scope project|plugin|both] [--project <root>] [--repo <root>] [--json]
 *   node agent-config.mjs serve [--port 7317] [--project <root>] [--repo <root>] [--config <config.yaml>]
 *   node agent-config.mjs install [--repo <root>] [--target <dir>] [--apply] [--json]
 *
 * 退出码：0 = 成功；1 = 校验或写入失败；2 = 用法错误。
 * 所有写盘操作都先备份、再跑官方校验器（validate-config.mjs / build.mjs），失败自动回滚。
 */
import http from 'node:http';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

import {
  ROLES,
  buildState,
  createRequestHandler,
  loadCatalog,
  mirrorDir,
  resolveClientDir,
  resolveRepoRoot,
  validateAssignment,
  writePluginDefaults,
  writeProjectConfig,
} from './agent-config-core.mjs';

/** 本脚本所在目录（安装后的插件目录里也能跑） */
const HERE = import.meta.dirname;
/** 包根：zcode/scripts 的上两级 */
const PACKAGE_ROOT = resolve(HERE, '..', '..');

const PLUGIN_NAME = 'steward';
const DEFAULT_PORT = 7317;
const MAX_PORT = 7337;

/** 打印错误并退出（退出码约定：0 成功 / 1 校验或写入失败 / 2 用法错误） */
function die(code, message) {
  console.error('[agent-config] ' + message);
  process.exit(code);
}

/** 解析 --key value 形式的参数；无值时记为 true */
function parseArgs(argv) {
  const out = {};
  const rest = [];
  for (let i = 0; i < argv.length; i = i + 1) {
    const token = argv[i];
    if (token.slice(0, 2) === '--') {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.slice(0, 2) === '--') { out[key] = true; continue; }
      out[key] = next;
      i = i + 1;
    } else {
      rest.push(token);
    }
  }
  out._ = rest;
  return out;
}

/** 项目根参数：默认取 process.cwd() */
function projectOf(args) {
  return resolve(typeof args.project === 'string' ? args.project : process.cwd());
}

/** 仓库根参数：显式给就用，否则从起点向上探测 */
function repoOf(args, fromDir) {
  if (typeof args.repo === 'string') return resolve(args.repo);
  const start = typeof args.project === 'string' ? resolve(args.project) : process.cwd();
  const detected = resolveRepoRoot(start);
  if (detected) return detected;
  return resolveRepoRoot(fromDir || start);
}

/** 显示宽度：CJK 记 2 列，其余 1 列（表格对齐用） */
function displayWidth(text) {
  let w = 0;
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    const wide = (code >= 0x1100 && code <= 0x115f) || (code >= 0x2e80 && code <= 0xa4cf)
      || (code >= 0xac00 && code <= 0xd7a3) || (code >= 0xf900 && code <= 0xfaff)
      || (code >= 0xfe30 && code <= 0xfe6f) || (code >= 0xff00 && code <= 0xff60)
      || (code >= 0xffe0 && code <= 0xffe6);
    w = w + (wide ? 2 : 1);
  }
  return w;
}

/** 按显示宽度右补空格 */
function pad(text, width) {
  const s = String(text);
  return s + ' '.repeat(Math.max(0, width - displayWidth(s)));
}

/** 打印简单文本表格 */
function printTable(headers, rows) {
  const widths = headers.map((h) => displayWidth(h));
  for (const row of rows) {
    for (let c = 0; c < row.length; c = c + 1) widths[c] = Math.max(widths[c], displayWidth(row[c]));
  }
  const line = (cells) => cells.map((cell, i) => pad(cell, widths[i])).join('  ').replace(/\s+$/, '');
  console.log(line(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) console.log(line(row));
}

/** 模型与档位的一致性提示（show / install 用） */
function effortNote(catalog, model, effort) {
  if (!catalog.ok || !model || !effort) return '';
  const hit = catalog.models.find((m) => m.key === model);
  if (!hit) return '';
  if (!hit.supportsEffort) return '（该模型无档位，effort 不生效）';
  if (hit.effortOptions.indexOf(effort) < 0) return '（档位不在模型支持范围）';
  if (hit.nonStandardEfforts.indexOf(effort) >= 0) return '（非标准档位名）';
  return '';
}

// ---------------------------------------------------------------------------
// catalog：打印本机模型目录
// ---------------------------------------------------------------------------

/** 执行 catalog 子命令：按供应商分组列出模型与档位集合 */
function cmdCatalog(args) {
  const catalog = loadCatalog(typeof args.config === 'string' ? { configPath: args.config } : undefined);
  if (args.json) {
    console.log(JSON.stringify(catalog, null, 2));
    return catalog.ok ? 0 : 1;
  }

  console.log('本机模型配置：' + (catalog.source || '(未找到)'));
  console.log('状态：' + (catalog.ok ? '可用' : '不可用（档位校验已降级）'));
  if (catalog.warning) console.log('原因：' + catalog.warning);
  console.log('');

  const byProvider = new Map();
  for (const m of catalog.models) {
    if (!byProvider.has(m.provider)) byProvider.set(m.provider, []);
    byProvider.get(m.provider).push(m);
  }
  for (const prov of catalog.providers) {
    const items = byProvider.get(prov.id) || [];
    console.log(prov.label + '（' + prov.kind + '）· ' + items.length + ' 个模型');
    for (const m of items) {
      const eff = m.supportsEffort ? m.effortOptions.join('/') : '不支持档位';
      const ctx = m.context ? Math.round(m.context / 1000) + 'k' : '?';
      const out = m.output ? Math.round(m.output / 1000) + 'k' : '?';
      const flags = [];
      if (!m.reasoning) flags.push('无推理');
      if (!m.enabled) flags.push('已禁用');
      if (m.nonStandardEfforts.length) flags.push('非标准档位：' + m.nonStandardEfforts.join('/'));
      console.log('  ' + pad(m.model, 42) + ' ctx ' + pad(ctx, 7) + ' out ' + pad(out, 6) + ' 档位 ' + eff
        + (flags.length ? '  [' + flags.join('；') + ']' : ''));
    }
    console.log('');
  }
  console.log('规范 key 形如 custom_provider:provider-7970db/step-5-preview 或 minimax/MiniMax-M3.1-Flash。');
  return catalog.ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// show：7 个角色的当前分配与来源
// ---------------------------------------------------------------------------

/** 执行 show 子命令：打印 7 个角色的生效模型/档位与来源；--json 输出 buildState() */
function cmdShow(args) {
  const state = buildState({
    projectRoot: projectOf(args),
    repoRoot: repoOf(args),
    configPath: typeof args.config === 'string' ? args.config : undefined,
  });
  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
    return 0;
  }

  console.log('项目根：' + state.project.root + (state.project.exists ? '' : '（steward.config.json 尚未创建）'));
  console.log('仓库根：' + (state.repo.root || '(未找到 Steward 源码仓库)') + (state.repo.detected ? '' : '（未识别）'));
  console.log('模型目录：' + (state.catalog.ok ? '可用' : '不可用（档位校验已降级）') + ' · ' + state.catalog.models.length + ' 个模型');
  console.log('');

  const sourceText = (r) => (r.source === 'project' ? '项目级覆盖' : (r.source === 'plugin' ? '插件默认' : '未配置'));
  const rows = state.roles.map((r) => [
    r.displayName + '（' + r.role + '）',
    r.model ? r.model : '—',
    r.effort ? r.effort + effortNote(state.catalog, r.model, r.effort) : '（跟随模型默认）',
    sourceText(r) + (r.differsFromPlugin ? ' · 与插件默认不同' : ''),
  ]);
  printTable(['角色', '生效模型', '思考强度', '来源'], rows);

  const diff = state.roles.filter((r) => r.differsFromPlugin);
  if (diff.length) {
    console.log('');
    console.log('与插件默认不同的角色（' + diff.length + '）：' + diff.map((r) => r.role).join('、'));
  }
  const missing = state.roles.filter((r) => !r.model);
  if (missing.length) {
    console.log('');
    console.log('警告：以下角色没有任何模型配置，派单会退回父模型或直接失败：' + missing.map((r) => r.role).join('、'));
  }
  return 0;
}

// ---------------------------------------------------------------------------
// set：校验后落盘
// ---------------------------------------------------------------------------

/** 执行 set 子命令：校验单角色分配后写入项目级 / 插件默认 / 两者 */
function cmdSet(args) {
  if (typeof args.role !== 'string' || args.role === '') die(2, 'set 缺少 --role <role>（可用：' + ROLES.join(' / ') + '）');
  if (typeof args.model !== 'string' || args.model === '') die(2, 'set 缺少 --model <provider/model>（可用 key 见 catalog 子命令）');
  const scope = typeof args.scope === 'string' ? args.scope : 'project';
  if (['project', 'plugin', 'both'].indexOf(scope) < 0) die(2, '--scope 必须是 project | plugin | both，实际：' + scope);

  const entry = { model: args.model };
  if (typeof args.effort === 'string') entry.effort = args.effort;
  if (typeof args['fallback'] === 'string') {
    entry.fallback = { model: args['fallback'] };
    if (typeof args['fallback-effort'] === 'string') entry.fallback.effort = args['fallback-effort'];
  }

  const projectDir = projectOf(args);
  const repoDir = repoOf(args, projectDir);
  const catalog = loadCatalog(typeof args.config === 'string' ? { configPath: args.config } : undefined);

  // 校验（与页面共用同一套规则）：不合法就退出 1，不写任何文件
  const checked = validateAssignment(args.role, entry, catalog);
  if (args.json) {
    if (!checked.ok) {
      console.log(JSON.stringify({ ok: false, written: [], validation: {}, warnings: checked.warnings, errors: checked.errors }, null, 2));
      return 1;
    }
  } else {
    for (const w of checked.warnings) console.log('警告：' + w);
    if (!checked.ok) {
      console.error('[agent-config] 校验失败，未写入任何文件：');
      for (const e of checked.errors) console.error('  ✗ ' + e);
      return 1;
    }
  }

  const written = [];
  const validation = {};
  const errors = [];
  const warnings = [];
  if (scope === 'project' || scope === 'both') {
    const r = writeProjectConfig(projectDir, { [args.role]: entry }, { catalog });
    written.push(...r.written);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    Object.assign(validation, r.validation);
  }
  if ((scope === 'plugin' || scope === 'both') && errors.length === 0) {
    if (!repoDir) {
      errors.push('未找到 Steward 源码仓库（需含 host/minimax/agents 与 zcode/scripts）：请用 --repo 指定，或改用 --scope project。');
    } else {
      const r = writePluginDefaults(repoDir, { [args.role]: { model: entry.model, effort: entry.effort === undefined ? null : entry.effort } }, { catalog });
      written.push(...r.written);
      errors.push(...r.errors);
      warnings.push(...r.warnings);
      Object.assign(validation, r.validation);
    }
  }

  const ok = errors.length === 0;
  if (args.json) {
    console.log(JSON.stringify({ ok, written, validation, warnings, errors }, null, 2));
    return ok ? 0 : 1;
  }
  for (const w of warnings) console.log('警告：' + w);
  if (!ok) {
    console.error('[agent-config] 写入失败（错误信息如下，校验器输出原样保留）：');
    for (const e of errors) console.error('  ✗ ' + e);
    return 1;
  }
  console.log('已写入（' + written.length + ' 处）：');
  for (const w of written) console.log('  [' + w.scope + '] ' + w.role + ' → ' + w.target + '  ' + w.message);
  for (const key of Object.keys(validation)) {
    const v = validation[key];
    console.log('校验器 ' + key + '：exit ' + v.exitCode);
    console.log('  命令：' + v.command);
    for (const line of String(v.output).split(/\r?\n/)) console.log('  | ' + line);
  }
  if (scope === 'plugin' || scope === 'both') console.log('提示：插件默认的改动需要新会话（或重新安装插件后）生效。');
  return 0;
}

// ---------------------------------------------------------------------------
// serve：本地页
// ---------------------------------------------------------------------------

/** 平台默认的插件安装目录（只用于提示与 install 默认目标） */
function defaultTarget() {
  return join(os.homedir(), '.minimax', 'plugins', PLUGIN_NAME);
}

/** 执行 serve 子命令：起本地页并监听 127.0.0.1，端口占用则依次尝试 7317..7337 */
function cmdServe(args) {
  const startPort = args.port === undefined ? DEFAULT_PORT : Number(args.port);
  if (!Number.isInteger(startPort) || startPort <= 0 || startPort > 65535) die(2, '--port 必须是 1~65535 的整数，实际：' + args.port);

  const projectDir = projectOf(args);
  const repoDir = repoOf(args, projectDir);
  const clientDir = resolveClientDir({ packageRoot: PACKAGE_ROOT, repoRoot: repoDir });
  if (!clientDir) {
    console.error('[agent-config] 警告：未找到页面资产目录（期望 host/minimax/miniapp/client/index.html）；'
      + '/ 已经可用，但 / 会返回 500。');
  }

  const handler = createRequestHandler({
    projectRoot: projectDir,
    repoRoot: repoDir,
    configPath: typeof args.config === 'string' ? args.config : undefined,
    clientDir,
  });
  const server = http.createServer(handler);

  let port = startPort;
  let attempts = 0;
  const tryListen = () => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && port < MAX_PORT && port < startPort + (MAX_PORT - DEFAULT_PORT)) {
        port = port + 1;
        attempts = attempts + 1;
        console.log('端口被占用，尝试 ' + port + ' …');
        tryListen();
        return;
      }
      console.error('[agent-config] 启动失败：' + err.message + (err.code === 'EADDRINUSE' ? '（' + startPort + '~' + MAX_PORT + ' 都被占用）' : ''));
      process.exit(1);
    });
    server.listen(port, '127.0.0.1', () => {
      const url = 'http://127.0.0.1:' + port + '/';
      console.log('Steward 子代理模型配置页已启动：' + url);
      console.log('项目根：' + projectDir);
      console.log('仓库根：' + (repoDir || '(未找到 Steward 源码仓库，插件级写入将不可用)'));
      if (clientDir) console.log('页面资产：' + clientDir);
      console.log('按 Ctrl+C 退出。');
    });
  };
  tryListen();
  return null;
}

// ---------------------------------------------------------------------------
// install：build + 镜像同步（默认只演练）
// ---------------------------------------------------------------------------

/** 执行 install 子命令：默认只打印演练；--apply 才真正 build 并镜像到插件安装目录 */
function cmdInstall(args) {
  const repoDir = repoOf(args, process.cwd());
  if (!repoDir) die(1, '未找到 Steward 源码仓库（需含 host/minimax/agents 与 zcode/scripts）：请用 --repo 指定。');
  const target = typeof args.target === 'string' ? resolve(args.target) : defaultTarget();
  const apply = args.apply === true;

  const plan = {
    repoRoot: repoDir,
    target,
    apply,
    steps: [join(repoDir, 'zcode', 'scripts', 'build.mjs'), join(repoDir, 'minimax')],
  };

  if (args.json && !apply) {
    console.log(JSON.stringify({ ok: true, applied: false, plan }, null, 2));
    return 0;
  }

  console.log('安装演练（未做任何改动）：');
  console.log('  仓库根：' + repoDir);
  console.log('  1) 构建：node ' + join(repoDir, 'zcode', 'scripts', 'build.mjs') + '  （工作目录：' + repoDir + '）');
  console.log('  2) 镜像：' + join(repoDir, 'minimax') + '  →  ' + target);
  console.log('     （复制全部文件 + 删除目标里多余的旧文件；只动 steward 这一个插件目录）');

  if (!apply) {
    console.log('这是演练。确认无误后加 --apply 真正执行。');
    return 0;
  }

  const build = spawnSync(process.execPath, [join(repoDir, 'zcode', 'scripts', 'build.mjs')], {
    cwd: repoDir,
    encoding: 'utf8',
    windowsHide: true,
  });
  const buildOut = [(build.stdout || ''), (build.stderr || '')].join('').trim();
  const buildCode = typeof build.status === 'number' ? build.status : -1;
  console.log('构建输出（exit ' + buildCode + '）：');
  for (const line of buildOut.split(/\r?\n/)) console.log('  | ' + line);
  if (buildCode !== 0) {
    console.error('[agent-config] 构建失败（exit ' + buildCode + '），已中止镜像：安装目录未改动。');
    return 1;
  }

  const stats = mirrorDir(join(repoDir, 'minimax'), target);
  console.log('镜像完成：复制 ' + stats.copied + ' 个文件，删除 ' + stats.removed + ' 个多余条目 → ' + target);
  console.log('改动在新会话生效（已运行的会话仍用旧配置）。');
  if (args.json) console.log(JSON.stringify({ ok: true, applied: true, plan: { ...plan, stats } }, null, 2));
  return 0;
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

/** 打印用法 */
function usage() {
  console.log(['',
    '用法：node agent-config.mjs <命令> [选项]',
    '',
    '  catalog                                      打印本机模型目录（provider 分组 + 档位集合）',
    '  show [--project <root>] [--repo <root>]       打印 7 个角色当前分配与来源',
    '  set --role <role> --model <key>              校验后落盘（--effort / --fallback / --scope project|plugin|both）',
    '  serve [--port 7317] [--project <root>]       起本地配置页（127.0.0.1）',
    '  install [--repo <root>] [--target <dir>]     默认演练；--apply 才 build + 镜像到插件安装目录',
    '',
    '通用选项：--json（机读输出）--config <config.yaml>（指定本机模型配置）',
    '退出码：0 成功 / 1 校验或写入失败 / 2 用法错误',
    '',
  ].join('\n'));
}

const argv = process.argv.slice(2);
const command = argv[0];
const args = parseArgs(argv.slice(1));

let code = 0;
if (command === 'catalog') code = cmdCatalog(args);
else if (command === 'show') code = cmdShow(args);
else if (command === 'set') code = cmdSet(args);
else if (command === 'serve') code = cmdServe(args);
else if (command === 'install') code = cmdInstall(args);
else if (command === 'help' || command === '--help' || command === undefined) { usage(); code = command === undefined ? 2 : 0; }
else { usage(); die(2, '未知命令：' + command); }

if (code !== null && code !== undefined) process.exit(code);

