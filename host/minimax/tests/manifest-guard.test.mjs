/**
 * manifest-guard.test.mjs — MiniMax 侧插件清单（.minimax-plugin/plugin.json）的宿主契约守卫。
 *
 * 背景（2026-11-17 实测）：宿主对清单 description 有长度上限，超限时整个包被宿主拒绝，
 * Mini App 起不来。症状极具迷惑性：
 *   - miniapp open 返回 RUNTIME_FAILED，宿主日志只有 "[MiniApp] Browser open failed code=start_failed"；
 *   - 但插件运行时本身健康（宿主记录 runtime.ready、端口已监听、页面与 API 都能正常服务）；
 *   - 逐项二分后定位到清单 description：2341 字失败，1905 字通过，686 字通过。
 * 这里用 1200 字作保守上限，并禁止同一长句在描述里重复出现（本次故障的诱因就是英文段被拼了两遍）。
 *
 * 另加两条清单自洽守卫：skills / agents / hooks 声明的文件必须真实存在。
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const PKG = join(ROOT, 'minimax');
const MANIFEST = join(PKG, '.minimax-plugin', 'plugin.json');

/** 宿主实测下 description 的保守长度上限（实测 2341 失败 / 1905 通过）。 */
const DESCRIPTION_MAX = 1200;

test('清单 description 不超过宿主上限', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  assert.equal(typeof manifest.description, 'string');
  assert.ok(
    manifest.description.length <= DESCRIPTION_MAX,
    `description 长度 ${manifest.description.length} 超过上限 ${DESCRIPTION_MAX}：宿主会拒绝整个包，Mini App 将无法打开`,
  );
});

test('清单 description 不含重复长句', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const sentences = manifest.description
    .split(/(?<=[。.;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40);
  const seen = new Set();
  for (const s of sentences) {
    assert.ok(!seen.has(s), `description 里有重复句子：${s.slice(0, 60)}…`);
    seen.add(s);
  }
});

test('清单声明的 skills / agents / hooks 文件都存在', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  for (const rel of manifest.skills ?? []) {
    assert.ok(existsSync(join(PKG, rel)), `清单声明的技能文件不存在：${rel}`);
  }
  for (const rel of manifest.agents ?? []) {
    assert.ok(existsSync(join(PKG, rel)), `清单声明的 agent 文件不存在：${rel}`);
  }
  for (const rel of manifest.hooks ?? []) {
    assert.ok(existsSync(join(PKG, rel)), `清单声明的 hooks 文件不存在：${rel}`);
  }
});
