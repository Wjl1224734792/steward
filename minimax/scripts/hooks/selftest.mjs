#!/usr/bin/env node
/**
 * selftest.mjs — guard.mjs 宿主契约自检（本地，不做 CI）。
 *
 * 按宿主 hook 的真实调用方式（stdin 事件 JSON + exit code 契约）逐例断言：
 *   允许 = exit 0 且 stdout 为空；阻断 = exit 2 且 stderr 非空、stdout 为空（宿主严格 JSON 校验安全）。
 *
 * 用法：node selftest.mjs
 * 退出码：0 = 全过；1 = 有失败。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT = resolve(import.meta.dirname, 'guard.mjs');
const cases = [];
const add = (name, mode, event, expect) => cases.push({ name, mode, event, expect });

add('危险命令 rm -rf → 阻断', 'dangerous', { tool_name: 'Bash', tool_input: { command: 'rm -rf /tmp/x' } }, 2);
add('危险命令 force push → 阻断', 'dangerous', { tool_name: 'Bash', tool_input: { command: 'git push --force origin main' } }, 2);
add('危险命令 reset --hard → 阻断', 'dangerous', { tool_name: 'Bash', tool_input: { command: 'git reset --hard HEAD~1' } }, 2);
add('普通测试命令 → 放行', 'dangerous', { tool_name: 'Bash', tool_input: { command: 'npm test' } }, 0);
const fakeKey = ['sk', 'abcdefghij0123456789ABCDEFGHIJ'].join('-');
add('密钥 sk- → 阻断', 'secret', { tool_name: 'Write', tool_input: { file_path: 'a.ts', content: `const k = "${fakeKey}";` } }, 2);
const fakePem = ['-----BEGIN', 'RSA PRIVATE KEY-----'].join(' ');
add('PEM 私钥 → 阻断', 'secret', { tool_name: 'Edit', tool_input: { file_path: 'k.pem', new_string: fakePem } }, 2);
add('env 引用 → 放行', 'secret', { tool_name: 'Write', tool_input: { file_path: 'a.ts', content: 'const k = process.env.KEY;' } }, 0);

// MiniMax 宿主原生事件载荷：工具名小写（write/edit/bash），write 用 path+content、edit 用 file_path+new_string。
// 守卫必须在这两种载荷下都给出同样判定，否则 MiniMax 侧注册了守卫也不生效。
add('MiniMax write 密钥 → 阻断', 'secret', { tool_name: 'write', tool_input: { path: 'a.ts', content: `const k = "${fakeKey}";` } }, 2);
add('MiniMax edit PEM 私钥 → 阻断', 'secret', { tool_name: 'edit', tool_input: { file_path: 'k.pem', new_string: fakePem } }, 2);
add('MiniMax write env 引用 → 放行', 'secret', { tool_name: 'write', tool_input: { path: 'a.ts', content: 'const k = process.env.KEY;' } }, 0);
add('MiniMax bash 危险命令 → 阻断', 'dangerous', { tool_name: 'bash', tool_input: { command: 'rm -rf /tmp/x' } }, 2);
add('MiniMax bash 普通命令 → 放行', 'dangerous', { tool_name: 'bash', tool_input: { command: 'npm test' } }, 0);

// ownership：临时仓库 + 白名单
const dir = mkdtempSync(join(tmpdir(), 'steward-guard-'));
mkdirSync(join(dir, '.steward'), { recursive: true });
mkdirSync(join(dir, 'src'), { recursive: true });
writeFileSync(join(dir, '.steward', 'ownership.json'), JSON.stringify({ root: dir, tasks: { T1: ['src/ok.mjs'] } }));
const run = (mode, event, cwd = dir) => {
  const r = spawnSync(process.execPath, [SCRIPT, mode], {
    cwd, input: typeof event === 'string' ? event : JSON.stringify(event),
    encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_ROOT: resolve(import.meta.dirname, '..', '..') },
  });
  return { code: r.status, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
};

let failed = 0;
const check = (name, r, expect) => {
  const ok = r.code === expect && r.stdout === '' && (expect === 0 || r.stderr.length > 0);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  exit=${r.code}${ok ? '' : `  stdout=${JSON.stringify(r.stdout)} stderr=${JSON.stringify(r.stderr)}`}`);
};

for (const c of cases) check(c.name, run(c.mode, c.event), c.expect);
check('所有权：白名单外 → 阻断', run('ownership', { tool_name: 'Edit', tool_input: { file_path: 'README.md' } }), 2);
check('所有权：白名单内 → 放行', run('ownership', { tool_name: 'Edit', tool_input: { file_path: 'src/ok.mjs' } }), 0);
check('所有权：无派发上下文 → 放行', run('ownership', { tool_name: 'Edit', tool_input: { file_path: 'README.md' } }, tmpdir()), 0);
check('坏 JSON → fail-open 放行', run('dangerous', 'not json'), 0);
rmSync(dir, { recursive: true, force: true });

console.log(failed ? `\n[selftest] FAIL — ${failed} 例失败` : `\n[selftest] PASS — ${cases.length + 4} 例全部符合宿主契约（exit 0 放行 / exit 2 阻断 / stdout 为空）`);
process.exit(failed ? 1 : 0);
