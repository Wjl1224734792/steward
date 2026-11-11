#!/usr/bin/env node
/**
 * validate-config-execution.test.mjs — execution.mode 配置校验的零依赖测试（node:test）。
 *
 * 跑法：node --test zcode/scripts/tests/validate-config-execution.test.mjs
 *
 * 约定：
 *   - 每个用例在 os.tmpdir() 下自建配置，结束后统一清理；
 *   - 统一带 --skip-catalog，避免依赖本机模型目录；
 *   - 直接跑真实的 validate-config.mjs，不 mock。
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'validate-config.mjs');
const TEMP_DIRS = [];

function makeTemp(prefix) {
  const dir = mkdtempSync(join(os.tmpdir(), 'steward-validate-config-' + prefix + '-'));
  TEMP_DIRS.push(dir);
  return dir;
}

after(() => {
  for (const dir of TEMP_DIRS) rmSync(dir, { recursive: true, force: true });
});

function runConfig(prefix, cfg) {
  const dir = makeTemp(prefix);
  const cfgPath = join(dir, 'steward.config.json');
  writeFileSync(cfgPath, JSON.stringify({ schemaVersion: 1, ...cfg }, null, 2) + '\n', 'utf8');
  return spawnSync(process.execPath, [SCRIPT, cfgPath, '--skip-catalog'], { encoding: 'utf8' });
}

describe('execution.mode 配置校验', () => {
  test('合法取值 subagent / inline → exit 0', () => {
    for (const mode of ['subagent', 'inline']) {
      const res = runConfig('ok-' + mode, { execution: { mode } });
      assert.equal(res.status, 0, res.stderr || res.stdout);
      assert.match(res.stdout, /结果：PASS/);
    }
  });

  test('省略 mode（空对象）→ exit 0', () => {
    const res = runConfig('empty', { execution: {} });
    assert.equal(res.status, 0, res.stderr || res.stdout);
    assert.match(res.stdout, /结果：PASS/);
  });

  test('非法枚举 solo → exit 1，报错点名 execution.mode', () => {
    const res = runConfig('bad-mode', { execution: { mode: 'solo' } });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /execution\.mode/);
    assert.match(res.stderr, /subagent \| inline/);
  });

  test('execution 非对象（数组 / null / 字符串）→ exit 1', () => {
    for (const value of [[], null, 'inline']) {
      const res = runConfig('bad-type', { execution: value });
      assert.equal(res.status, 1, `值 ${JSON.stringify(value)} 应被拦截`);
      assert.match(res.stderr, /execution 必须是对象/);
    }
  });

  test('未知子键 → exit 0，但输出警告', () => {
    const res = runConfig('unknown-key', { execution: { mode: 'inline', allowAll: true } });
    assert.equal(res.status, 0, res.stderr || res.stdout);
    assert.match(res.stdout, /execution\.allowAll 是未知字段/);
  });
});
