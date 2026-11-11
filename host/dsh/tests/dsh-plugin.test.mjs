/**
 * DSH 侧 Steward 插件（生成物 dsh/）的宿主契约测试。
 *
 * 直接 import 生成包，用假 ctx 驱动 apply()，覆盖：
 *  - 技能 / 工具 / 桥接路由注册
 *  - 配置读写与校验（未知模型、未知档位、半截 route）
 *  - steward_config 工具（list / set / reset）
 *  - steward_dispatch 工具（角色配置 → agentOptions、默认继承、parent delivery）
 *
 * 不启动 HTTP 服务：路由 handler 用假 IncomingMessage/Writable 直调。
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { after, before, test } from 'node:test';

const PLUGIN = new URL('../../../dsh/index.js', import.meta.url);

const CATALOG = {
  p1: [
    { id: 'm-high', name: 'M High' },
    { id: 'm-none', name: 'M None' },
  ],
  p2: [{ id: 'm2', name: 'M2' }],
};
const EFFORTS = {
  'p1/m-high': [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }],
  'p1/m-none': [],
  'p2/m2': [{ id: 'max', name: 'Max' }],
};

function fakeRequest({ method = 'GET', url = '/', headers = {}, body = undefined }) {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  stream.method = method;
  stream.url = url;
  stream.headers = headers;
  stream.socket = { remoteAddress: '127.0.0.1' };
  return stream;
}

function fakeResponse() {
  const state = { status: 0, headers: {}, body: '', ended: false };
  const response = {
    get writableEnded() { return state.ended; },
    writeHead(status, headers) { state.status = status; state.headers = headers ?? {}; return response; },
    end(chunk) {
      state.body = chunk === undefined ? '' : String(chunk);
      state.ended = true;
      return response;
    },
  };
  return { response, state };
}

const HOST = '127.0.0.1:53701';

function collect() {
  const registered = { skills: [], tools: [], routes: [] };
  const services = {
    skills: {
      register(skill) { registered.skills.push(skill); return () => {}; },
    },
    tools: {
      register(definition) { registered.tools.push(definition); return () => {}; },
    },
    webServer: {
      register(route) { registered.routes.push(route); return () => {}; },
    },
    llm: {
      listProviders: () => Object.keys(CATALOG).map((id) => ({ id, name: id.toUpperCase() })),
      listModels: (provider) => CATALOG[provider] ?? [],
      resolveModelInfo: async (provider, model) => {
        const efforts = EFFORTS[`${provider}/${model}`];
        if (efforts === undefined) throw new Error(`unknown model ${provider}/${model}`);
        return { provider, id: model, name: model, reasoning: { efforts, defaultEffort: efforts[0]?.id } };
      },
    },
    subagents: {
      getProvider: (name) => (name === 'spawn'
        ? { name, capabilities: { agentOptions: true }, inheritsParentContext: false, prepareContinuable() {} }
        : undefined),
      list: () => ['spawn'],
      startActivation: async (spec) => {
        registered.activations = registered.activations ?? [];
        registered.activations.push(spec);
        return { childId: 'child-1' };
      },
    },
  };
  const logger = { info() {}, warn() {}, error() {} };
  const scoped = {
    get: (name) => services[name],
    ...Object.fromEntries(Object.entries(services).map(([name, value]) => [name, value])),
    effect(callback) { const disposer = callback(); return disposer ?? (() => {}); },
    logger,
  };
  const ctx = {
    ...scoped,
    inject(names, callback) {
      for (const name of names) assert.ok(services[name] !== undefined, `test fake is missing service ${name}`);
      callback(scoped);
    },
  };
  return { ctx, registered, services };
}

let workDir;
let bucket;

before(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'dsh-steward-test-'));
  process.env.DSH_HOME = workDir;
  const module = await import(PLUGIN.href);
  const collected = collect();
  module.apply(collected.ctx);
  bucket = collected.registered;
});

after(() => {
  rmSync(workDir, { recursive: true, force: true });
  delete process.env.DSH_HOME;
});

function boot() {
  return bucket;
}

test('apply registers skills, tools and bridge routes', async () => {
  const registered = boot();
  const skillNames = registered.skills.map((skill) => skill.name).sort();
  assert.deepEqual(skillNames, [
    'agent-settings',
    'steward',
    'systematic-debugging',
    'tdd',
    'using-steward',
    'verification-before-completion',
  ]);
  for (const skill of registered.skills) {
    assert.ok(skill.content.length > 100, `${skill.name} should carry a body`);
    assert.equal(skill.source, 'bundled');
  }
  assert.deepEqual(registered.tools.map((tool) => tool.name).sort(), ['steward_config', 'steward_dispatch']);
  assert.deepEqual(registered.routes.map((route) => route.path).sort(), [
    '/api/dsh-steward/config',
    '/api/dsh-steward/reset',
    '/api/dsh-steward/state',
  ]);
  for (const route of registered.routes) assert.equal(route.kind, 'exact');
});

test('state route returns the live catalog and effective roster', async () => {
  const bucket = boot();
  const route = bucket.routes.find((entry) => entry.path === '/api/dsh-steward/state');
  const request = fakeRequest({ headers: { host: HOST } });
  const { response, state } = fakeResponse();
  await route.handler(request, response);
  assert.equal(state.status, 200);
  const payload = JSON.parse(state.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.value.configPath, join(workDir, 'steward', 'subagent-config.json'));
  assert.equal(payload.value.providers.length, 2);
  assert.equal(payload.value.providers.find((provider) => provider.id === 'p1').models.length, 2);
  assert.equal(payload.value.roles.length, 7);
  for (const role of payload.value.roles) {
    assert.equal(role.source, 'inherit');
    assert.equal(role.provider, '');
  }
});

test('save route validates the model catalog and persists the configuration', async () => {
  const bucket = boot();
  const route = bucket.routes.find((entry) => entry.path === '/api/dsh-steward/config');
  const save = async (config) => {
    const request = fakeRequest({
      method: 'POST',
      headers: { host: HOST, origin: `http://${HOST}` },
      body: { config },
    });
    const { response, state } = fakeResponse();
    await route.handler(request, response);
    return { status: state.status, payload: JSON.parse(state.body) };
  };

  const unknownEffort = await save({ defaults: { provider: '', model: '', effort: '' }, roles: { reviewer: { provider: 'p1', model: 'm-high', effort: 'turbo' } } });
  assert.equal(unknownEffort.payload.ok, false);
  assert.match(unknownEffort.payload.message, /不支持思考强度/);

  const unknownModel = await save({ defaults: { provider: '', model: '', effort: '' }, roles: { reviewer: { provider: 'p1', model: 'ghost', effort: '' } } });
  assert.equal(unknownModel.payload.ok, false);
  assert.match(unknownModel.payload.message, /不在当前模型目录/);

  const partial = await save({ defaults: { provider: '', model: '', effort: '' }, roles: { reviewer: { provider: 'p1', model: '', effort: '' } } });
  assert.equal(partial.payload.ok, true);
  const saved = JSON.parse(readFileSync(join(workDir, 'steward', 'subagent-config.json'), 'utf8'));
  assert.equal(saved.roles.reviewer, undefined, 'a partial route is normalized away rather than persisted');

  const ok = await save({ defaults: { provider: 'p2', model: 'm2', effort: 'max' }, roles: { reviewer: { provider: 'p1', model: 'm-high', effort: 'high' } } });
  assert.equal(ok.payload.ok, true);
  const reviewer = ok.payload.value.roles.find((role) => role.id === 'reviewer');
  assert.equal(reviewer.name, '代码评审员');
  assert.equal(reviewer.provider, 'p1');
  assert.equal(reviewer.model, 'm-high');
  assert.equal(reviewer.effort, 'high');
  assert.equal(reviewer.source, 'role');
  const qa = ok.payload.value.roles.find((role) => role.id === 'qa-engineer');
  assert.equal(qa.source, 'defaults');
  assert.equal(qa.provider, 'p2');
  const onDisk = JSON.parse(readFileSync(join(workDir, 'steward', 'subagent-config.json'), 'utf8'));
  assert.equal(onDisk.defaults.effort, 'max');
});

test('rejects cross-site bridge writes', async () => {
  const bucket = boot();
  const route = bucket.routes.find((entry) => entry.path === '/api/dsh-steward/config');
  const request = fakeRequest({
    method: 'POST',
    headers: { host: HOST, origin: 'http://evil.example', 'sec-fetch-site': 'cross-site' },
    body: { config: { defaults: { provider: '', model: '', effort: '' }, roles: {} } },
  });
  const { response, state } = fakeResponse();
  await route.handler(request, response);
  assert.equal(state.status, 403);
});

test('steward_config lists, sets and resets role routes', async () => {
  const bucket = boot();
  const tool = bucket.tools.find((entry) => entry.name === 'steward_config');
  const exec = { agent: { id: 'session-test' }, signal: new AbortController().signal };

  const listed = await tool.execute({ action: 'list' }, exec);
  assert.equal(listed.action, 'list');
  assert.equal(listed.roles.length, 7);
  assert.ok(listed.providers.length >= 2);

  const set = await tool.execute({ action: 'set', role: 'qa-engineer', provider: 'p1', model: 'm-high', effort: 'low' }, exec);
  assert.equal(set.action, 'set');
  assert.equal(set.roles.find((role) => role.id === 'qa-engineer').source, 'role');
  assert.equal(set.roles.find((role) => role.id === 'qa-engineer').effort, 'low');

  await assert.rejects(
    () => tool.execute({ action: 'set', role: 'qa-engineer', provider: 'p1', model: 'm-high', effort: 'max' }, exec),
    /不支持思考强度/,
  );

  const reset = await tool.execute({ action: 'reset', role: 'qa-engineer' }, exec);
  assert.equal(reset.roles.find((role) => role.id === 'qa-engineer').source, 'defaults');
});

test('steward_dispatch applies the configured route and role prompt', async () => {
  const bucket = boot();
  const configPath = join(workDir, 'steward', 'subagent-config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.roles.architect = { provider: 'p1', model: 'm-high', effort: 'high' };
  config.roles.pm = { provider: 'p2', model: 'm2', effort: '' };
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync(join(workDir, 'steward'), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  const tool = bucket.tools.find((entry) => entry.name === 'steward_dispatch');
  const exec = { agent: { id: 'session-parent' }, signal: new AbortController().signal };
  const value = await tool.execute({
    role: 'architect',
    description: '架构方案：导出',
    prompt: '把订单导出方案拆成任务 DAG。',
    cwd: '/tmp/repo',
  }, exec);
  assert.equal(value.kind, 'activation');
  assert.equal(value.childId, 'child-1');
  assert.equal(value.provider, 'p1');
  assert.equal(value.model, 'm-high');
  assert.equal(value.effort, 'high');

  const activation = bucket.activations.at(-1);
  assert.equal(activation.provider, 'spawn');
  assert.equal(activation.delivery, 'parent');
  assert.equal(activation.label, '架构方案：导出');
  assert.equal(activation.request.parent.id, 'session-parent');
  assert.equal(activation.request.cwd, '/tmp/repo');
  assert.deepEqual(activation.request.agentOptions, { provider: 'p1', model: 'm-high', reasoningEffort: 'high' });
  assert.match(activation.request.prompt[0].text, /架构师/);
  assert.match(activation.request.prompt[0].text, /把订单导出方案拆成任务 DAG/);

  const inherited = await tool.execute({ role: 'browser-tester', description: '冒烟', prompt: '只回复 OK' }, exec);
  assert.equal(inherited.source, 'defaults');
  assert.equal(inherited.provider, 'p2');
  assert.equal(bucket.activations.at(-1).request.agentOptions.provider, 'p2');
  assert.equal(bucket.activations.at(-1).request.agentOptions.reasoningEffort, 'max');
  assert.match(bucket.activations.at(-1).request.prompt[0].text, /浏览器验收员/);

  const noEffort = await tool.execute({ role: 'pm', description: '规格', prompt: '只回复 OK' }, exec);
  assert.equal(noEffort.role, 'pm');
  assert.equal(bucket.activations.at(-1).request.agentOptions.reasoningEffort, undefined);

  await assert.rejects(
    () => tool.execute({ role: 'ghost', description: 'x', prompt: 'y' }, exec),
    /unknown steward role/,
  );
});

test('steward_dispatch lets a project steward.config.json modelRouting override the settings page', async () => {
  const bucket = boot();
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const projectDir = join(workDir, 'demo-project');
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(join(projectDir, 'steward.config.json'), JSON.stringify({
    docTier: 1,
    modelRouting: { 'qa-engineer': { model: 'p1/m-high', effort: 'low', fallback: 'p2/m2' } },
  }, null, 2));

  const tool = bucket.tools.find((entry) => entry.name === 'steward_dispatch');
  const exec = { agent: { id: 'session-parent' }, signal: new AbortController().signal };
  const value = await tool.execute({
    role: 'qa-engineer',
    description: 'QA',
    prompt: '跑门禁。',
    cwd: projectDir,
  }, exec);
  assert.equal(value.source, 'project');
  assert.deepEqual(bucket.activations.at(-1).request.agentOptions, { provider: 'p1', model: 'm-high', reasoningEffort: 'low' });

  const malformedDir = join(workDir, 'bad-project');
  mkdirSync(malformedDir, { recursive: true });
  writeFileSync(join(malformedDir, 'steward.config.json'), JSON.stringify({ modelRouting: { 'qa-engineer': { model: 'no-slash' } } }));
  const fellBack = await tool.execute({ role: 'qa-engineer', description: 'QA', prompt: '跑门禁。', cwd: malformedDir }, exec);
  assert.equal(fellBack.source, 'defaults');
});
