// @ts-check
/**
 * Steward Mini App · 节点进程载荷
 *
 * 职责：为「子代理模型与思考强度」配置页提供同源后端。
 *  - 静态资源：只服务 client 白名单里的 index.html / app.css / app.js，其它路径一律 404；
 *  - API：GET /api/state、POST /api/save，业务逻辑全部委托给核心模块 createRequestHandler。
 *
 * 核心模块的定位方式（重要）：本文件的源码位置是 host/minimax/miniapp/node/server.mjs，
 * 该目录下并不存在 scripts/；构建后落到 minimax/miniapp/node/server.mjs，此时
 * <pluginRoot>/scripts/agent-config-core.mjs 才成立。因此必须用 context.pluginRoot 动态定位，
 * 不能用静态相对 import（静态 import 在源码目录下解析失败，也会把构建路径写死）。
 *
 * 端口：只用宿主分配的 context.listen.host / context.listen.port（宿主带端口鉴权守卫），
 * 自己绝不选端口。运行状态写 context.dataDir，绝不写 pluginRoot。
 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/** 客户端静态资源白名单：只服务固定文件名，不接受任意路径。 */
const CLIENT_ASSETS = new Map([
  ['index.html', 'text/html; charset=utf-8'],
  ['app.css', 'text/css; charset=utf-8'],
  ['app.js', 'text/javascript; charset=utf-8'],
]);

/**
 * @param {{ pluginRoot: string, dataDir: string, listen: { host: string, port: number }, logger: { info: Function, warn?: Function, error: Function }, signal?: AbortSignal }} context
 * @returns {Promise<{ dispose: () => Promise<void> }>}
 */
export async function start(context) {
  const clientRoot = normalize(join(context.pluginRoot, 'miniapp', 'client'));

  // 宿主按 miniapp.json 的 surface.path 打开页面（例如 /settings），该路径必须能拿到首页；
  // 这里从清单里读出真实路径一并服务，避免「清单写 /settings、只服务 /」导致宿主打开就是 404。
  const surfacePaths = new Set(['/', '/index.html']);
  try {
    const manifest = JSON.parse(await readFile(join(context.pluginRoot, 'miniapp', 'miniapp.json'), 'utf8'));
    const declared = typeof manifest?.surface?.path === 'string' ? manifest.surface.path.trim() : '';
    if (declared && declared.startsWith('/')) surfacePaths.add(declared);
  } catch (error) {
    if (typeof context.logger.warn === 'function') {
      context.logger.warn('miniapp.manifest.surface_unreadable', { message: String(error?.message ?? error) });
    }
  }

  // 核心模块必须从运行副本定位：源码目录里没有 scripts/，构建后才会有。
  const coreUrl = pathToFileURL(join(context.pluginRoot, 'scripts', 'agent-config-core.mjs')).href;
  const core = await import(coreUrl);
  if (typeof core.createRequestHandler !== 'function') {
    throw new Error('agent-config-core.mjs 未导出 createRequestHandler，无法启动配置页后端');
  }

  // 静态资源预读进内存：白名单固定，启动后不再变化；缺 index.html 直接失败（页面根本打不开）。
  /** @type {Map<string, { body: Buffer, type: string }>} */
  const assets = new Map();
  for (const [name, type] of CLIENT_ASSETS) {
    const file = normalize(join(clientRoot, name));
    if (file !== clientRoot && !file.startsWith(clientRoot + sep)) continue;
    try {
      assets.set(name, { body: await readFile(file), type });
    } catch (error) {
      if (name === 'index.html') throw new Error('配置页缺少必需资源 index.html：' + clientRoot);
      if (typeof context.logger.warn === 'function') {
        context.logger.warn('miniapp.asset.missing', { name, message: String(error?.message ?? error) });
      }
    }
  }

  // 核心模块的处理器签名是原生 (req, res) => void，直接复用同一套路由与校验规则，
  // 保证 Mini App 与本地页（agent-config.mjs serve）行为一致。
  const coreHandler = core.createRequestHandler({
    pluginRoot: context.pluginRoot,
    repoRoot: null,
    clientDir: clientRoot,
  });

  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://miniapp.local');
      const path = url.pathname;
      const method = request.method ?? 'GET';

      // 静态白名单优先：非白名单的页面路径一律 404，绝不放行到任意文件。
      if ((method === 'GET' || method === 'HEAD') && surfacePaths.has(path)) {
        sendAsset(assets, response, 'index.html', method);
        return;
      }
      if ((method === 'GET' || method === 'HEAD') && (path === '/app.css' || path === '/app.js')) {
        sendAsset(assets, response, path.slice(1), method);
        return;
      }
      if (path === '/api/state' || path === '/api/save') {
        coreHandler(request, response);
        return;
      }
      sendJson(response, 404, { ok: false, error: 'not_found', message: '未找到该路径' });
    } catch (error) {
      context.logger.error('miniapp.request.failed', { message: String(error?.message ?? error) });
      if (!response.headersSent) {
        sendJson(response, 500, { ok: false, error: 'internal_error', message: '服务内部错误，请稍后重试。' });
      } else {
        response.end();
      }
    }
  });

  await listen(server, context.listen.host, context.listen.port);
  context.logger.info('miniapp.steward.settings.listening', { assets: assets.size });

  let disposed = false;
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    if (context.signal && typeof context.signal.removeEventListener === 'function') {
      context.signal.removeEventListener('abort', onAbort);
    }
    assets.clear();
    await close(server);
  };

  function onAbort() {
    void dispose();
  }

  if (context.signal) {
    context.signal.addEventListener('abort', onAbort, { once: true });
    if (context.signal.aborted) await dispose();
  }

  return { dispose };
}

/**
 * @param {Map<string, { body: Buffer, type: string }>} assets 预读的静态资源
 * @param {import('node:http').ServerResponse} response
 * @param {string} name 白名单内的文件名
 * @param {string} method 请求方法（HEAD 只发头）
 */
function sendAsset(assets, response, name, method) {
  const asset = assets.get(name);
  if (!asset) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': asset.type,
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(asset.body),
  });
  response.end(method === 'HEAD' ? undefined : asset.body);
}

/** @param {import('node:http').ServerResponse} response */
function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

/**
 * @param {import('node:http').Server} server
 * @param {string} host
 * @param {number} port
 */
function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once('error', onError);
    // 端口由宿主分配（带端口鉴权守卫），绝不能自己选端口。
    server.listen(port, host, () => {
      server.off('error', onError);
      resolve();
    });
  });
}

/** @param {import('node:http').Server} server */
function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
