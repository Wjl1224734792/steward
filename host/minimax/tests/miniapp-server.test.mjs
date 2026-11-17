/**
 * miniapp-server.test.mjs — Steward Mini App 节点载荷（host/minimax/miniapp/node/server.mjs）的路由契约测试。
 *
 * 覆盖六类用例：
 *   1. 页面入口：清单里的 surface.path（/settings）及其带尾斜杠形式（/settings/）都能拿到首页；
 *   2. 静态资源：根路径（/app.css、/app.js）与 surface 前缀下（/settings/app.css）都提供；
 *   3. 白名单：不认识的路径一律 404，绝不放行任意文件；
 *   4. API 委托：/api/state、/api/save 交给核心模块的 createRequestHandler；
 *   5. 请求台账：dataDir/requests.log 记录每个请求的方法与路径（不含凭据与业务内容）；
 *   6. 契约前提：客户端 index.html 用根绝对路径引用资源，页面在任何打开位置都能取到资源。
 *
 * 临时目录建在仓库 tmp/ 下，测试结束用 fs.rmSync 自行清理（不用 PowerShell 递归删）。
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const SERVER_ENTRY = join(ROOT, 'host', 'minimax', 'miniapp', 'node', 'server.mjs');

/** 找一个空闲端口：先绑 0 拿到端口号，再放掉，避免测试撞固定端口。 */
async function freePort() {
  const probe = createNetServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

/**
 * 造一个最小的「宿主包」目录：Mini App 载荷 + 核心模块桩。
 * @returns {{ pluginRoot: string, dataDir: string, cleanup: () => void }}
 */
function makePackage() {
  const base = mkdtempSync(join(ROOT, 'tmp', 'miniapp-server-'));
  const pluginRoot = join(base, 'plugin');
  const dataDir = join(base, 'data');
  mkdirSync(join(pluginRoot, 'miniapp', 'client'), { recursive: true });
  mkdirSync(join(pluginRoot, 'scripts'), { recursive: true });
  mkdirSync(dataDir, { recursive: true });

  writeFileSync(
    join(pluginRoot, 'miniapp', 'miniapp.json'),
    JSON.stringify({ schemaVersion: 1, surface: { path: '/steward' } }, null, 2),
    'utf8',
  );
  writeFileSync(join(pluginRoot, 'miniapp', 'client', 'index.html'), '<!doctype html><title>cfg</title>', 'utf8');
  writeFileSync(join(pluginRoot, 'miniapp', 'client', 'app.css'), 'body{color:#111}', 'utf8');
  writeFileSync(join(pluginRoot, 'miniapp', 'client', 'app.js'), 'console.log(1)', 'utf8');
  writeFileSync(
    join(pluginRoot, 'scripts', 'agent-config-core.mjs'),
    [
      'export function createRequestHandler() {',
      '  return (req, res) => {',
      '    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });',
      '    res.end(JSON.stringify({ ok: true, via: "core" }));',
      '  };',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );

  return { pluginRoot, dataDir, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

/**
 * 起一个真实的 Mini App 节点进程载荷。
 * @returns {Promise<{ base: string, dispose: () => Promise<void>, pkg: ReturnType<typeof makePackage> }>}
 */
async function startServer() {
  const pkg = makePackage();
  const port = await freePort();
  const { start } = await import(pathToFileURL(SERVER_ENTRY).href);
  const handle = await start({
    pluginRoot: pkg.pluginRoot,
    dataDir: pkg.dataDir,
    listen: { host: '127.0.0.1', port },
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  });
  return { base: `http://127.0.0.1:${port}`, dispose: handle.dispose, pkg };
}

test('Mini App 节点载荷：页面入口 / 静态资源 / API 委托 / 请求台账', async (t) => {
  const server = await startServer();
  t.after(async () => {
    await server.dispose();
    server.pkg.cleanup();
  });

  await t.test('surface.path 与带尾斜杠形式都能拿到首页', async () => {
    for (const path of ['/steward', '/steward/']) {
      const res = await fetch(server.base + path);
      assert.equal(res.status, 200, path + ' 应返回 200');
      assert.match(res.headers.get('content-type') || '', /text\/html/, path + ' 应返回 HTML');
    }
  });

  await t.test('静态资源在根路径与 surface 前缀下都提供', async () => {
    const cases = [
      ['/app.css', /text\/css/],
      ['/app.js', /javascript/],
      ['/steward/app.css', /text\/css/],
      ['/steward/app.js', /javascript/],
    ];
    for (const [path, expected] of cases) {
      const res = await fetch(server.base + path);
      assert.equal(res.status, 200, path + ' 应返回 200');
      assert.match(res.headers.get('content-type') || '', expected, path + ' 的 content-type 不对');
    }
  });

  await t.test('非白名单路径一律 404', async () => {
    for (const path of ['/nope', '/steward/nope', '/../package.json']) {
      const res = await fetch(server.base + path);
      assert.equal(res.status, 404, path + ' 应返回 404');
    }
  });

  await t.test('/api/state 与 /api/save 交给核心模块处理器', async () => {
    const state = await fetch(server.base + '/api/state');
    assert.equal(state.status, 200);
    assert.deepEqual(await state.json(), { ok: true, via: 'core' });
    const save = await fetch(server.base + '/api/save', { method: 'POST', body: '{}' });
    assert.equal(save.status, 200);
  });

  await t.test('请求台账写入 dataDir，只记方法与路径', async () => {
    const logPath = join(server.pkg.dataDir, 'requests.log');
    const raw = readFileSync(logPath, 'utf8');
    const records = raw.trim().split('\n').map((line) => JSON.parse(line));
    assert.ok(records.some((r) => r.event === 'start'), '应有启动记录');
    assert.ok(records.some((r) => r.event === 'listening'), '应记录监听地址');
    assert.ok(records.some((r) => r.event === 'asset' && r.path === '/steward'), '应记录页面请求');
    assert.ok(records.some((r) => r.event === 'api' && r.path === '/api/state'), '应记录 API 请求');
    assert.ok(records.some((r) => r.event === 'miss'), '应记录未命中路径');
    assert.ok(!raw.includes('authorization'), '台账不应记录凭据');
  });
});

test('客户端 index.html 用根绝对路径引用资源', () => {
  const html = readFileSync(join(ROOT, 'host', 'minimax', 'miniapp', 'client', 'index.html'), 'utf8');
  assert.match(html, /href="\/app\.css"/, '样式表应是根绝对路径');
  assert.match(html, /src="\/app\.js"/, '脚本应是根绝对路径');
  assert.ok(!html.includes('href="./'), '不应再使用相对路径引用资源');
  assert.ok(!html.includes('src="./'), '不应再使用相对路径引用资源');
});

test('Mini App 清单声明 surface 路径，根 package.json 指向 miniapp.json', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'host', 'minimax', 'miniapp', 'miniapp.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.surface.path, '/steward');
  assert.ok(!/^\/(settings|__mavis__)/.test(manifest.surface.path), 'surface 路径不得占用宿主保留路由');
  assert.deepEqual(manifest.artifacts.client, ['./miniapp/client']);
  assert.deepEqual(manifest.artifacts.node, ['./miniapp/node']);
  assert.equal(manifest.runtime.entry, './miniapp/node/server.mjs');

  const pkg = JSON.parse(readFileSync(join(ROOT, 'host', 'minimax', 'package.json'), 'utf8'));
  assert.equal(pkg.mcode.schemaVersion, 2);
  assert.equal(pkg.mcode.miniApp, './miniapp/miniapp.json');
});
