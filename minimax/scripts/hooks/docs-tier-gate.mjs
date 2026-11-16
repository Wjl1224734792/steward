#!/usr/bin/env node
/**
 * docs-tier-gate.mjs — docTier=3 派发硬门（MiniMax Code 宿主，PreToolUse Hook）。
 *
 * 语义与 DSH 侧 steward_dispatch 里的 assertDocsReady 一致：docTier=3 的项目在
 * 「文档就绪收据」（.steward/docs-state.json）缺失 / 未签发 / 评审未通过 / 口径哈希过期时，
 * 不许派 backend-dev / frontend-dev；architect / pm / reviewer / qa-engineer / browser-tester 不受限，
 * 保证「谁去把文档补齐、评审、签发」这条路始终开着。
 *
 * 宿主契约（与 scripts/hooks/guard.mjs 同款）：
 *   - 宿主把事件 JSON 写到本脚本 stdin：{ tool_name, tool_input: { agent_name, ... }, cwd? }；
 *   - 放行 = exit 0 且 stdout 保持空；拒绝 = exit 2 且理由写 stderr；
 *   - 宿主对 stdout 走严格 JSON 校验，所以本脚本任何路径都不写 stdout；
 *   - 任何解析/异常路径一律 fail-open（exit 0），不阻塞正常工作。
 *
 * 判据来源：scripts/lib/docs-state.mjs（与 docs-ready.mjs CLI 共用同一套判据与哈希），
 * 避免「脚本判绿、钩子拦下」的两套真相。
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATE_REL, checkReadiness, formatGaps, readState } from '../lib/docs-state.mjs';

const SELF_DIR = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
/** 插件根：<plugin>/scripts/hooks/ → <plugin>（宿主源目录与随包目录同构）。 */
const PLUGIN_ROOT = resolve(SELF_DIR, '..', '..');
/** 文档就绪 CLI 的绝对路径（随包后即 <plugin>/scripts/docs-ready.mjs）。 */
const DOCS_READY = join(PLUGIN_ROOT, 'scripts', 'docs-ready.mjs');

/** 会被文档门拦的角色（写产品代码的角色）；其余角色不受门禁限制。 */
const DOC_GATED_ROLES = new Set(['backend-dev', 'frontend-dev']);

/** 项目根标志文件：优先 steward.config.json，其次 .git。 */
const ROOT_MARKERS = ['steward.config.json', '.git'];

/** 剥 BOM + 归一换行（Windows 上 PowerShell / 编辑器可能写 BOM）。 */
function parseJsonText(text) {
  return JSON.parse(String(text).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'));
}

/** 向上最多 6 层找项目根（与 DSH findProjectRoot 同逻辑）。 */
function findProjectRoot(startDir) {
  let current = resolve(startDir);
  for (let depth = 0; depth < 6; depth += 1) {
    if (ROOT_MARKERS.some((marker) => existsSync(join(current, marker)))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return resolve(startDir);
}

/** 从 agent_name 里取角色：steward:backend-dev / backend-dev 都取到 backend-dev。 */
function roleOf(agentName) {
  const value = String(agentName ?? '').trim();
  if (value === '') return '';
  const idx = value.lastIndexOf(':');
  return (idx >= 0 ? value.slice(idx + 1) : value).trim();
}

/** 修复路径 + 回滚提示（每个拒绝理由都要给 Agent 可执行的出路）。 */
function repairSteps(root, { init = false } = {}) {
  const steps = [];
  if (init) {
    steps.push(`  1) node "${DOCS_READY}" "${root}" init --scope new|takeover|feature --write   # 建就绪状态文件`);
  } else {
    steps.push(`  1) node "${DOCS_READY}" "${root}" check --gate dev                          # 复跑机检看还缺什么`);
  }
  steps.push('  2) 按缺漏码补文档（技能：docs-new / docs-takeover / docs-feature）');
  steps.push(`  3) 用 docs-review 评审后：node "${DOCS_READY}" "${root}" approve --review "<评审记录>"`);
  steps.push(`回滚：把 "${join(root, 'steward.config.json')}" 的 docTier 改回 1 或 2（开发不再要求文档先就绪）。`);
  return steps.join('\n');
}

/** 拒绝：理由走 stderr，stdout 保持空，靠 exit 2 表达 deny。 */
function deny(reason) {
  process.stderr.write(`${reason}\n`);
  return 2;
}

function main() {
  let raw;
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    return 0; // 读不到事件 → fail-open
  }
  let evt;
  try {
    evt = parseJsonText(raw.trim() === '' ? '{}' : raw);
  } catch {
    return 0; // 事件解析失败 → fail-open
  }
  if (typeof evt !== 'object' || evt === null || Array.isArray(evt)) return 0;

  const tool = String(evt.tool_name ?? evt.tool ?? '').trim().toLowerCase();
  if (tool !== 'task') return 0;

  const input = (typeof evt.tool_input === 'object' && evt.tool_input !== null ? evt.tool_input : {}) ?? {};
  const role = roleOf(input.agent_name ?? input.subagent_type);
  if (!DOC_GATED_ROLES.has(role)) return 0;

  const cwdRaw = typeof evt.cwd === 'string' && evt.cwd !== ''
    ? evt.cwd
    : (typeof input.cwd === 'string' && input.cwd !== '' ? input.cwd : process.cwd());
  const root = findProjectRoot(cwdRaw);

  let config = null;
  try {
    config = parseJsonText(readFileSync(join(root, 'steward.config.json'), 'utf8'));
  } catch {
    config = null; // 配置缺失 / 损坏 → 当作非 docTier=3，放行
  }
  if (typeof config !== 'object' || config === null || Array.isArray(config)) return 0;
  if (config.docTier !== 3) return 0;

  // --- ① 收据存在？ ---
  const read = readState(root);
  if (read.state === null) {
    const code = read.error !== null ? 'E-STATE-SCHEMA' : 'E-STATE-MISSING';
    const reason = read.error !== null
      ? `状态文件无法解析：${read.error}`
      : `缺 ${STATE_REL}（docTier=3 项目在派开发前必须有文档就绪收据）`;
    return deny([
      `docs gate blocked: ${code} — ${reason}。`,
      `  项目根：${root}`,
      repairSteps(root, { init: true }),
      '  收据只能由 docs-ready.mjs 签发；手改 .steward/docs-state.json 不是绕过门禁的办法。',
    ].join('\n'));
  }
  const state = read.state;

  // --- ② 机检绿不绿（含收据哈希是否过期） ---
  const result = checkReadiness({ root, gate: 'dev' });
  if (!result.ok) {
    return deny([
      `docs gate blocked: ${root} 有 ${result.errors.length} 项文档缺漏：${formatGaps(result.errors, 5)}`,
      repairSteps(root),
      '  实现角色在收据变绿之前一直被拦；改口径类文档后收据会过期，须重新评审并 approve。',
    ].join('\n'));
  }

  // --- ③ 收据签发过、评审通过？ ---
  if (state.ok !== true || state.review?.status !== 'approved') {
    return deny([
      `docs gate blocked: ${join(root, '.steward/docs-state.json')} 没有已签发的收据（ok=${JSON.stringify(state.ok)}, review=${JSON.stringify(state.review?.status ?? 'none')}）。`,
      repairSteps(root),
      '  手改收据不是绕过门禁的办法——收据必须由 docs-ready.mjs approve 签发。',
    ].join('\n'));
  }

  return 0; // 全部通过 → 放行
}

// 未预期的异常一律 fail-open（exit 0）：门禁只做拦截，不许把正常工作卡死。
let exitCode = 0;
try {
  exitCode = main();
} catch {
  exitCode = 0;
}
process.exitCode = exitCode;
