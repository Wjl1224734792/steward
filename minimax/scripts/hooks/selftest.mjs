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
let total = 0;
const check = (name, r, expect) => {
  total++;
  const ok = r.code === expect && r.stdout === '' && (expect === 0 || r.stderr.length > 0);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  exit=${r.code}${ok ? '' : `  stdout=${JSON.stringify(r.stdout)} stderr=${JSON.stringify(r.stderr)}`}`);
};

for (const c of cases) check(c.name, run(c.mode, c.event), c.expect);
check('所有权：白名单外 → 阻断', run('ownership', { tool_name: 'Edit', tool_input: { file_path: 'README.md' } }), 2);
check('所有权：白名单内 → 放行', run('ownership', { tool_name: 'Edit', tool_input: { file_path: 'src/ok.mjs' } }), 0);
check('所有权：无派发上下文 → 放行', run('ownership', { tool_name: 'Edit', tool_input: { file_path: 'README.md' } }, tmpdir()), 0);
check('坏 JSON → fail-open 放行', run('dangerous', 'not json'), 0);

// docs 模式：文档就绪硬门（docTier=3 项目派 backend-dev / frontend-dev 前校验收据）。
// 项目 tier3 = docTier=3 无收据；tier1 = docTier=1；green = docTier=3 + 已签发全绿收据。
const READY = resolve(import.meta.dirname, '..', 'docs-gov', 'docs-ready.mjs');
const docsRoot = mkdtempSync(join(tmpdir(), 'steward-docs-'));
const mkProject = (name, config) => {
  const p = join(docsRoot, name);
  mkdirSync(join(p, 'docs', '03-契约'), { recursive: true });
  mkdirSync(join(p, 'docs', '07-治理', '评审记录'), { recursive: true });
  writeFileSync(join(p, 'steward.config.json'), JSON.stringify(config));
  return p;
};
const tier3 = mkProject('tier3', { docTier: 3 });
const tier1 = mkProject('tier1', { docTier: 1 });
const green = mkProject('green', { docTier: 3 });
const API_DOC = `# API 接口契约\n\n## 基础约定\n\n- BaseURL：/api\n- 认证：Bearer\n- 统一信封：{ code, data, message }\n\n## 错误码号段\n\n| 号段 | 含义 |\n|---|---|\n| 4001 | 参数校验失败 |\n| 4002 | 权限不足 |\n\n## 端点清单\n\n| 方法 | 路径 | 入参 | 出参 | 错误码 | 权限 |\n|---|---|---|---|---|---|\n| GET | /api/items | q | list | 4001 | read |\n| POST | /api/items | body | item | 4002 | write |\n`;
const MODEL_DOC = `# 数据模型\n\n## ER 总览\n\n- items：主表，含 tenant_id 行级隔离字段\n\n## DDL\n\n| 表 | 字段 | 类型 | 约束 |\n|---|---|---|---|\n| items | id | uuid | pk |\n| items | tenant_id | uuid | 非空，行级隔离 |\n| items | deleted_at | timestamptz | 软删，进唯一约束 |\n\n## 口径注释\n\n软删与唯一约束组合：unique (tenant_id, code, deleted_at)。审计表只追加不更新，不做物理删除。\n`;
const REVIEW_DOC = `# 评审记录：契约冻结\n\n## 结论（先行）\n可进入开发。\n\n## 一、机械修复项\n\n| # | 位置 | 问题 | 修法 | 状态 |\n|---|---|---|---|---|\n| 1 | API接口.md:12 | 错误码未列号段 | 补号段表 | 已修 |\n\n<!-- docs-review:begin -->\n{"status":"approved","blocking":0,"scope":"feature","reviewedAt":"2026-11-16T22:40:00+08:00"}\n<!-- docs-review:end -->\n`;
for (const p of [tier1, green]) {
  writeFileSync(join(p, 'docs', '03-契约', 'API接口.md'), API_DOC);
  writeFileSync(join(p, 'docs', '03-契约', '数据模型.md'), MODEL_DOC);
  writeFileSync(join(p, 'docs', '07-治理', '评审状态.md'), '# 评审状态\n\n| 阶段 | 最新结论 | 日期 | 评审记录 |\n|---|---|---|---|\n| 契约 | 通过 | 2026-11-16 | 评审记录-20261116-契约.md |\n');
  writeFileSync(join(p, 'docs', '07-治理', '评审记录', '评审记录-20261116-契约.md'), REVIEW_DOC);
}
{
  const init = spawnSync(process.execPath, [READY, green, 'init', '--scope', 'feature', '--require', '03-契约', '--write'], { encoding: 'utf8' });
  const approve = spawnSync(process.execPath, [READY, green, 'approve', '--review', 'docs/07-治理/评审记录/评审记录-20261116-契约.md'], { encoding: 'utf8' });
  if (init.status !== 0 || approve.status !== 0) {
    failed++;
    total++;
    console.log(`FAIL  文档门禁：green 项目收据签发失败  init=${init.status} approve=${approve.status}  ${JSON.stringify(approve.stderr || approve.stdout)}`);
  } else {
    check('文档门禁：docTier=3 缺收据 → 阻断', run('docs', { tool_name: 'Agent', tool_input: { subagent_type: 'steward:backend-dev' } }, tier3), 2);
    check('文档门禁：非实现角色 → 放行', run('docs', { tool_name: 'Agent', tool_input: { subagent_type: 'steward:reviewer' } }, tier3), 0);
    check('文档门禁：docTier≠3 → 放行', run('docs', { tool_name: 'Task', tool_input: { subagent_type: 'backend-dev' } }, tier1), 0);
    check('文档门禁：收据已签发且绿 → 放行', run('docs', { tool_name: 'Task', tool_input: { subagent_type: 'steward:frontend-dev' } }, green), 0);
    check('文档门禁：坏 JSON → fail-open 放行', run('docs', 'not json', tier3), 0);
  }
}
rmSync(dir, { recursive: true, force: true });
rmSync(docsRoot, { recursive: true, force: true });

console.log(failed ? `\n[selftest] FAIL — ${failed} 例失败` : `\n[selftest] PASS — ${total} 例全部符合宿主契约（exit 0 放行 / exit 2 阻断 / stdout 为空）`);
process.exit(failed ? 1 : 0);
