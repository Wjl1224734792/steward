#!/usr/bin/env node
/**
 * guard.mjs — Steward 宿主 hook 守卫（P2）：所有权 / 危险命令 / 密钥扫描。
 *
 * 由宿主 hook（PreToolUse 类事件）挂载：hook 把事件 JSON 写到本脚本 stdin，
 * 本脚本判定是否放行——允许 exit 0；阻止 exit 2，**stdout 保持空**，阻断原因写 stderr。
 * 两个宿主都是「exit 2 + stderr」语义（MiniMax PreToolUse：exit 2 即 deny，stderr 是给 Agent 看的理由），
 * 所以这里不写 stdout JSON：宿主对 stdout 走严格 JSON 校验，多余键会判失败。
 *
 * 用法（hooks.json 里按事件配四种模式）：
 *   node guard.mjs ownership   # Edit/Write 的文件必须在 .steward/ownership.json 的白名单内（该文件由 Tech Lead 派发时生成）
 *   node guard.mjs dangerous   # Bash 命令命中危险模式（rm -rf /、force push、reset --hard、DROP TABLE 等）→ 阻止
 *   node guard.mjs secret      # Write/Edit 内容疑似密钥（sk-、ghp_、AKIA、PEM 私钥、.env 提交）→ 阻止
 *   node guard.mjs docs        # Agent/Task 派发 backend-dev / frontend-dev 时校验文档就绪收据（docTier=3 项目）→ 未过则阻止
 *
 * 任何解析失败都 fail-open（exit 0），不阻塞正常工作；守卫只做加分项。
 * docs 模式的判据与 scripts/docs-gov/lib/docs-state.mjs（scripts/docs-gov/docs-ready.mjs CLI 共用）同源；
 * lib 经动态 import 加载，缺失或异常也 fail-open，不影响其余三种模式。
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const mode = process.argv[2];
if (!['ownership', 'dangerous', 'secret', 'docs'].includes(mode)) {
  console.error('[guard] 未知模式（ownership | dangerous | secret | docs）'); process.exit(0); // fail-open
}

let raw = '';
try { raw = readFileSync(0, 'utf8'); } catch { process.exit(0); }
let evt = null;
try { evt = JSON.parse(raw || '{}'); } catch { process.exit(0); }

const tool = String(evt.tool_name ?? evt.tool ?? '').toLowerCase();
const input = evt.tool_input ?? evt.input ?? {};
const filePath = input.file_path ?? input.path ?? input.notebook_path ?? '';
const command = typeof input.command === 'string' ? input.command : '';
const content = typeof input.content === 'string' ? input.content
  : typeof input.new_string === 'string' ? input.new_string : '';

// 宿主契约：stdout 走严格 JSON 校验，未知键会判失败；因此阻断原因走 stderr，stdout 保持空，靠 exit 2 表达 deny。
const block = (reason) => {
  console.error(reason);
  process.exit(2);
};

// --- dangerous ---
const DANGEROUS = [
  [/\brm\s+(-[a-z]*\s+)*-?[rf]{2,}\b|\brm\s+-rf?\s+[\\/]/i, '递归/强制删除（rm -rf）'],
  [/git\s+push\s+.*--force/i, 'git force push'],
  [/git\s+reset\s+--hard/i, 'git reset --hard'],
  [/git\s+clean\s+-[a-z]*f/i, 'git clean -f'],
  [/drop\s+table|truncate\s+table|drop\s+database/i, '破坏性 SQL'],
  [/\bmkfs\b|\bdd\s+if=/i, '磁盘级破坏命令'],
  [/:\(\)\{.*\};:/, 'fork bomb'],
];
if (mode === 'dangerous') {
  if (command) {
    for (const [re, label] of DANGEROUS) {
      if (re.test(command)) block(`命中危险命令守卫：${label}。如确属任务需要，请向用户说明后由用户执行。`);
    }
  }
  process.exit(0);
}

// --- secret ---
const SECRET = [
  [/\b(sk|rk)-[A-Za-z0-9]{20,}\b/, '疑似 API 密钥（sk-…）'],
  [/ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/, '疑似 GitHub token'],
  [/AKIA[0-9A-Z]{16}/, '疑似 AWS AccessKey'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'PEM 私钥'],
  [/(api[_-]?key|secret|password|token)\s*[:=]\s*['"][A-Za-z0-9+/]{24,}['"]/i, '疑似硬编码凭据'],
];
if (mode === 'secret') {
  if (content) {
    for (const [re, label] of SECRET) {
      if (re.test(content)) block(`密钥扫描守卫：内容含${label}。请改用环境变量/密钥管理；若为测试桩请换明显假值（如 "test-placeholder"）。`);
    }
  }
  process.exit(0);
}

// --- ownership ---
// Git Bash / POSIX 风格绝对路径（/e/foo）在 Windows 下归一化为盘符路径（E:\foo）
function normalizeAbs(p) {
  const m = /^\/([a-z])\/(.*)$/i.exec(p);
  if (m && process.platform === 'win32') return resolve(`${m[1].toUpperCase()}:/${m[2]}`);
  return resolve(p);
}
if (mode === 'ownership') {
  const cfg = '.steward/ownership.json';
  if (!existsSync(cfg) || !filePath) process.exit(0); // 无派发上下文 → 不启用该守卫
  let own;
  try { own = JSON.parse(readFileSync(cfg, 'utf8')); } catch { process.exit(0); }
  const root = own.root ? normalizeAbs(String(own.root)) : normalizeAbs(process.cwd());
  const abs = isAbsolute(filePath) ? normalizeAbs(filePath) : normalizeAbs(join(process.cwd(), filePath));
  const rel = relative(root, abs).split('\\').join('/');
  if (rel.startsWith('..')) block(`路径越出仓库根：${rel}`);
  const allowed = Object.values(own.tasks ?? {}).flat().map((f) => String(f).split('\\').join('/').replace(/^\.\//, ''));
  if (allowed.length && !allowed.includes(rel)) {
    block(`所有权守卫：${rel} 不在当前任务白名单（${allowed.join(', ')}）。需要扩权时报告 Tech Lead。`);
  }
  process.exit(0);
}

// --- docs ---
// 文档就绪硬门（1.2.0 对齐 DSH 1.3.0）：docTier=3 的项目在派 backend-dev / frontend-dev 前
// 必须持有有效收据（.steward/docs-state.json，由 scripts/docs-gov/docs-ready.mjs 签发）——缺失、机检不过、
// 评审未 approved 或哈希与文档树不一致都直接拒绝；architect / pm / reviewer / qa-engineer /
// browser-tester 不受限（要留人补文档与评审）。回滚 = 把 steward.config.json 的 docTier 改回 1/2。
if (mode === 'docs') {
  const roleRaw = String(input.subagent_type ?? input.agent_type ?? '').trim();
  const role = roleRaw.replace(/^steward:/, '');
  if (!['backend-dev', 'frontend-dev'].includes(role)) process.exit(0);
  // 项目根：事件 cwd 优先，向上最多 6 层找 steward.config.json / .git（与宿主派发口径一致）
  let current = resolve(typeof evt.cwd === 'string' && evt.cwd !== '' ? evt.cwd : process.cwd());
  let root = current;
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(current, 'steward.config.json')) || existsSync(join(current, '.git'))) { root = current; break; }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  try {
    const { checkReadiness, formatGaps, readState } = await import('../docs-gov/lib/docs-state.mjs');
    let config = null;
    try { config = JSON.parse(readFileSync(join(root, 'steward.config.json'), 'utf8')); } catch { /* 无配置 → 不启用门禁 */ }
    if (config?.docTier !== 3) process.exit(0);

    const read = readState(root);
    if (read.state === null) {
      block(
        `文档就绪门禁拦截：${read.error ?? `缺 ${join(root, '.steward/docs-state.json')}`}。`
        + `docTier=3 项目派 ${role} 前需要文档收据：跑 "node <插件>/scripts/docs-gov/docs-ready.mjs ${root} init --scope new|takeover|feature --write"，`
        + '按 docs-new / docs-takeover / docs-feature 入口补文档，docs-review 审查后再 approve。architect / pm / reviewer / qa-engineer 不受限。',
      );
    }
    const result = checkReadiness({ root, gate: 'dev' });
    if (!result.ok) {
      block(
        `文档就绪门禁拦截（${result.errors.length} 处缺漏，根目录 ${root}）：${formatGaps(result.errors)}。`
        + `修复后（入口技能：docs-new / docs-takeover / docs-feature）跑 docs-review 审查，再 `
        + `"node <插件>/scripts/docs-gov/docs-ready.mjs ${root} approve --review <评审记录>"。${role} 在收据变绿前保持拦截。`,
      );
    }
    if (read.state.ok !== true || read.state.review?.status !== 'approved') {
      block(
        `文档就绪门禁拦截：${join(root, '.steward/docs-state.json')} 没有已通过的收据`
        + `（ok=${JSON.stringify(read.state.ok)}，review=${JSON.stringify(read.state.review?.status ?? 'none')}）。`
        + '加载 steward:docs-review 技能审查后 approve；手改收据绕不过门禁（哈希会校验）。',
      );
    }
    process.exit(0);
  } catch {
    process.exit(0); // lib 缺失 / 异常 → fail-open，不阻塞正常工作
  }
}
