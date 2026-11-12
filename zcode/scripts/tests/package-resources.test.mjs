/**
 * 插件包随包资源契约（防回归）。
 *
 * `steward:project-lifecycle` 的技能正文引用了 references/ 与 assets/ 下的相对
 * 链接，这些附属目录必须随包一起渲染，否则包内链接全部断链——ZCode 1.0.0 只随包
 * 了 SKILL.md，1.0.1 起按 HOST_SKILL_RESOURCES 补齐（两宿主同机制）。
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PACKAGES = { zcode: join(ROOT, 'zcode'), minimax: join(ROOT, 'minimax') };

/** 技能正文里指向随包附属目录的相对链接。 */
function linkedResources(skillDir) {
  const skill = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
  const links = new Set();
  for (const match of skill.matchAll(/\]\(((?:references|assets)\/[^)#]+)\)/g)) links.add(match[1]);
  return [...links];
}

test('project-lifecycle 的 references/ 与 assets/ 随包，正文相对链接不断链', () => {
  for (const [host, pkg] of Object.entries(PACKAGES)) {
    const skillDir = join(pkg, 'skills', 'project-lifecycle');
    for (const dir of ['references', 'assets']) {
      const full = join(skillDir, dir);
      assert.ok(existsSync(full), `${host}: 缺 skills/project-lifecycle/${dir}`);
      assert.ok(readdirSync(full).length > 0, `${host}: skills/project-lifecycle/${dir} 是空目录`);
    }
    const links = linkedResources(skillDir);
    assert.ok(links.length > 0, `${host}: 正文里没解析到随包相对链接`);
    for (const link of links) {
      assert.ok(existsSync(join(skillDir, link)), `${host}: 包内相对链接断链 ${link}`);
    }
  }
});

test('两宿主随包资源集合一致（同一 shared 源渲染）', () => {
  const list = (host) => {
    const base = join(PACKAGES[host], 'skills', 'project-lifecycle');
    const out = [];
    for (const dir of ['references', 'assets']) {
      for (const name of readdirSync(join(base, dir))) out.push(`${dir}/${name}`);
    }
    return out.sort();
  };
  assert.deepEqual(list('zcode'), list('minimax'), '两宿主随包资源集合应一致');
});
