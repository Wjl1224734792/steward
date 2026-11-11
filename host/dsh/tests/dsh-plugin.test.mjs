/**
 * DSH 侧 Steward 插件（生成物 dsh/）的宿主契约测试。
 *
 * 覆盖 DSH 原生机制：
 *  - 7 个角色以 Agent Presets 注册（persona + 原生工具组合）
 *  - Config 的 volatile 字段由原生 Settings 命名空间 `steward` 提供
 *  - steward_config 读写同一份原生设置并做模型目录校验
 *  - steward_dispatch 以 agentPreset + agentOptions 启动子代理
 *  - /steward 人类命令
 *  - 技能注册
 *
 * 不启动宿主：用假 ctx 驱动 apply()。schemastery 由真实 dsh profile 解析
 * （DSH_PROFILE_DIR），因此测试要求本机装有 DSH profile。
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';

const PLUGIN = new URL('../../../dsh/index.js', import.meta.url);
const ROLE_IDS = ['pm', 'architect', 'backend-dev', 'frontend-dev', 'qa-engineer', 'browser-tester', 'reviewer'];

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

function empty() {
  return { provider: '', model: '', effort: '' };
}

function emptyConfig() {
  return { defaults: empty(), roles: Object.fromEntries(ROLE_IDS.map((id) => [id, empty()])) };
}

function mergeDeep(target, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const result = target !== null && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    result[key] = value !== null && typeof value === 'object' && !Array.isArray(value)
      ? mergeDeep(result[key], value)
      : structuredClone(value);
  }
  return result;
}

/** Live config references backed by mutable state, like the real volatile fields. */
function liveConfig(state) {
  const route = (read) => ({
    provider: { get: () => read().provider },
    model: { get: () => read().model },
    effort: { get: () => read().effort },
  });
  return {
    defaults: route(() => state.config.defaults),
    roles: Object.fromEntries(ROLE_IDS.map((id) => [id, route(() => state.config.roles[id])])),
  };
}

const logger = { info() {}, warn() {}, error() {} };

function createBucket(overrides = {}) {
  const state = {
    config: emptyConfig(),
    revision: 1,
    presets: [],
    skills: [],
    tools: [],
    commands: [],
    activations: [],
    updates: [],
  };
  const services = {
    skills: {
      register(skill) { state.skills.push(skill); return () => {}; },
    },
    tools: {
      register(definition) { state.tools.push(definition); return () => {}; },
    },
    settings: {
      documentPath: join(tmpdir(), 'dsh-profile', 'cordis.patch.yml'),
      describe() {
        return [{ ns: 'steward', revision: state.revision, writable: true, value: structuredClone(state.config) }];
      },
      async update(ns, patch) {
        assert.equal(ns, 'steward', 'writes must target the native steward namespace');
        state.updates.push(structuredClone(patch));
        state.config = mergeDeep(state.config, structuredClone(patch));
        state.revision += 1;
      },
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
        ? { name, capabilities: { agentOptions: true, agentPreset: true }, inheritsParentContext: false, prepareContinuable() {} }
        : undefined),
      list: () => ['spawn'],
      startActivation: async (spec) => {
        state.activations.push(spec);
        return { childId: 'child-1' };
      },
    },
    agentPresets: {
      async register(definition) {
        state.presets.push(definition);
        return async () => {};
      },
      async resolve(id) {
        return state.presets.find((preset) => preset.id === id) ?? null;
      },
    },
    commands: {
      register(definition) { state.commands.push(definition); return () => {}; },
    },
  };
  for (const [name, value] of Object.entries(overrides.services ?? {})) services[name] = value;

  const scoped = {
    get: (name) => services[name],
    ...services,
    effect(callback) {
      const disposer = callback();
      return disposer ?? (() => {});
    },
    logger,
  };
  const ctx = {
    ...scoped,
    inject(names, callback) {
      for (const name of names) assert.ok(services[name] !== undefined, `test fake is missing service ${name}`);
      callback(scoped);
    },
  };
  return { ctx, state, services, config: liveConfig(state) };
}

let workDir;
let plugin;

before(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'dsh-steward-test-'));
  process.env.DSH_HOME = workDir;
  plugin = await import(PLUGIN.href);
});

after(() => {
  rmSync(workDir, { recursive: true, force: true });
  delete process.env.DSH_HOME;
});

async function boot(overrides) {
  const bucket = createBucket(overrides);
  plugin.apply(bucket.ctx, bucket.config);
  // Preset registration resolves asynchronously; give the microtask/macrotask a chance.
  await new Promise((resolve) => setImmediate(resolve));
  return bucket;
}

test('apply registers DSH-native extension points', async () => {
  const bucket = await boot();
  const skillNames = bucket.state.skills.map((skill) => skill.name).sort();
  assert.deepEqual(skillNames, [
    'agent-settings',
    'steward',
    'systematic-debugging',
    'tdd',
    'using-steward',
    'verification-before-completion',
  ]);
  for (const skill of bucket.state.skills) assert.ok(skill.content.length > 100, `${skill.name} should carry a body`);

  assert.deepEqual(bucket.state.tools.map((tool) => tool.name).sort(), ['steward_config', 'steward_dispatch']);
  assert.deepEqual(bucket.state.commands.map((command) => command.name), ['steward']);

  assert.equal(bucket.state.presets.length, 7);
  assert.deepEqual(bucket.state.presets.map((preset) => preset.id).sort(), ROLE_IDS.map((id) => `steward-${id}`).sort());
  for (const preset of bucket.state.presets) {
    assert.ok(preset.name.startsWith('Steward · '), `${preset.id} needs a display name`);
    assert.ok(preset.description.length > 0, `${preset.id} needs a description`);
    const names = preset.plugins.map((row) => row.name);
    assert.ok(names.includes('@deepseek-ai/dsh-persona'), `${preset.id} must compose a persona`);
    assert.ok(names.includes('@deepseek-ai/dsh-tool-fs'), `${preset.id} must compose the fs tools`);
    assert.ok(names.includes('@deepseek-ai/dsh-tool-web'), `${preset.id} must compose web tools`);
    assert.ok(names.includes('@deepseek-ai/dsh-tool-skill'), `${preset.id} must compose the skill loader`);
    assert.ok(names.includes('cordis:group'), `${preset.id} must compose the compaction group`);
    const persona = preset.plugins.find((row) => row.name === '@deepseek-ai/dsh-persona');
    assert.ok(persona.config.prefix.length > 100, `${preset.id} persona should carry the role body`);
    assert.doesNotMatch(persona.config.prefix, /^---/, 'frontmatter must be stripped from the persona');
    assert.doesNotMatch(persona.config.prefix, /由 host\/dsh\/build\.mjs/, 'the build banner must be stripped from the persona');
    assert.doesNotMatch(persona.config.prefix, /context7|宿主 MCP/, 'ZCode/MiniMax MCP prose must be rewritten for DSH');
    // Configs these plugins require (mount fails with a partial config).
    assert.deepEqual(preset.plugins.find((row) => row.name === '@deepseek-ai/dsh-tool-todo').config, { allowParallelInProgress: true });
    assert.deepEqual(preset.plugins.find((row) => row.name === '@deepseek-ai/dsh-tool-fs-search').config, { sampleOverCapGlobResults: false });
    assert.equal(preset.plugins.find((row) => row.name === '@deepseek-ai/dsh-tool-fs').config.applyPatch, false);
    const shell = preset.plugins.filter((row) => /tool-(pwsh|bash)$/.test(row.name));
    assert.equal(shell.length, 1, `${preset.id} must compose exactly one shell tool for this platform`);
  }

  // The exported Config is the native settings schema and yields volatile refs.
  assert.equal(typeof plugin.Config, 'function');
  const parsed = plugin.Config({});
  assert.equal(typeof parsed.roles.reviewer.provider.get, 'function');
  assert.equal(parsed.roles.reviewer.provider.get(), '');
  assert.equal(typeof parsed.defaults.effort.get, 'function');
  assert.ok('pm' in parsed.roles);
});

test('steward_config lists the live catalog, presets and effective routes', async () => {
  const bucket = await boot();
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_config');
  const listed = await tool.execute({ action: 'list' });
  assert.equal(listed.action, 'list');
  assert.equal(listed.namespace, 'steward');
  assert.ok(listed.documentPath.length > 0);
  assert.equal(listed.roles.length, 7);
  assert.equal(listed.providers.length, 2);
  for (const role of listed.roles) {
    assert.equal(role.preset, `steward-${role.id}`);
    assert.equal(role.source, 'inherit');
    assert.equal(role.provider, '');
  }
});

test('steward_config validates against the catalog and persists through native settings', async () => {
  const bucket = await boot();
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_config');

  await assert.rejects(
    () => tool.execute({ action: 'set', role: 'reviewer', provider: 'p1', model: 'm-high', effort: 'turbo' }),
    /不支持思考强度/,
  );
  await assert.rejects(
    () => tool.execute({ action: 'set', role: 'reviewer', provider: 'p1', model: 'ghost', effort: '' }),
    /不在当前模型目录/,
  );
  await assert.rejects(
    () => tool.execute({ action: 'set', role: 'reviewer', provider: 'p1', model: '', effort: '' }),
    /provider and model must be supplied together/,
  );
  assert.equal(bucket.state.updates.length, 0, 'invalid writes must never reach the settings service');

  const set = await tool.execute({ action: 'set', role: 'reviewer', provider: 'p1', model: 'm-high', effort: 'high' });
  assert.deepEqual(bucket.state.updates.at(-1), { roles: { reviewer: { provider: 'p1', model: 'm-high', effort: 'high' } } });
  const reviewer = set.roles.find((role) => role.id === 'reviewer');
  assert.equal(reviewer.source, 'role');
  assert.equal(reviewer.provider, 'p1');
  assert.equal(reviewer.effort, 'high');
  assert.equal(set.roles.find((role) => role.id === 'qa-engineer').source, 'inherit');

  const defaults = await tool.execute({ action: 'set', provider: 'p2', model: 'm2', effort: 'max' });
  assert.deepEqual(bucket.state.updates.at(-1), { defaults: { provider: 'p2', model: 'm2', effort: 'max' } });
  assert.equal(defaults.roles.find((role) => role.id === 'qa-engineer').source, 'defaults');
  assert.equal(defaults.roles.find((role) => role.id === 'qa-engineer').provider, 'p2');

  const reset = await tool.execute({ action: 'reset', role: 'reviewer' });
  assert.deepEqual(bucket.state.updates.at(-1), { roles: { reviewer: { provider: '', model: '', effort: '' } } });
  assert.equal(reset.roles.find((role) => role.id === 'reviewer').source, 'defaults');

  const cleared = await tool.execute({ action: 'reset' });
  assert.equal(cleared.roles.every((role) => role.source === 'inherit'), true);
});

test('steward_dispatch starts a child on the role preset with the configured route', async () => {
  const bucket = await boot();
  const configTool = bucket.state.tools.find((entry) => entry.name === 'steward_config');
  await configTool.execute({ action: 'set', role: 'architect', provider: 'p1', model: 'm-high', effort: 'high' });
  await configTool.execute({ action: 'set', role: 'pm', provider: 'p2', model: 'm2', effort: '' });

  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');
  const exec = { agent: { id: 'session-parent' }, signal: new AbortController().signal };
  const value = await tool.execute({
    role: 'architect',
    description: '架构方案：导出',
    prompt: '把订单导出方案拆成任务 DAG。',
    cwd: '/tmp/repo',
  }, exec);
  assert.equal(value.kind, 'activation');
  assert.equal(value.childId, 'child-1');
  assert.equal(value.preset, 'steward-architect');
  assert.equal(value.provider, 'p1');
  assert.equal(value.model, 'm-high');
  assert.equal(value.effort, 'high');

  const activation = bucket.state.activations.at(-1);
  assert.equal(activation.provider, 'spawn');
  assert.equal(activation.delivery, 'parent');
  assert.equal(activation.label, '架构方案：导出');
  assert.equal(activation.request.parent.id, 'session-parent');
  assert.equal(activation.request.cwd, '/tmp/repo');
  assert.equal(activation.request.agentPreset, 'steward-architect');
  assert.deepEqual(activation.request.agentOptions, { provider: 'p1', model: 'm-high', reasoningEffort: 'high' });
  // The persona belongs to the preset; the dispatch prompt is only the task.
  assert.equal(activation.request.prompt[0].text, '把订单导出方案拆成任务 DAG。');

  const inherited = await tool.execute({ role: 'browser-tester', description: '冒烟', prompt: '只回复 OK' }, exec);
  assert.equal(inherited.source, 'inherit');
  assert.equal(bucket.state.activations.at(-1).request.agentPreset, 'steward-browser-tester');
  assert.equal(bucket.state.activations.at(-1).request.agentOptions, undefined);

  const noEffort = await tool.execute({ role: 'pm', description: '规格', prompt: '只回复 OK' }, exec);
  assert.equal(noEffort.role, 'pm');
  assert.deepEqual(bucket.state.activations.at(-1).request.agentOptions, { provider: 'p2', model: 'm2' });

  await assert.rejects(
    () => tool.execute({ role: 'ghost', description: 'x', prompt: 'y' }, exec),
    /unknown steward role/,
  );
});

test('steward_dispatch rejects a broken preset and a provider without preset support', async () => {
  const broken = await boot({
    services: {
      agentPresets: {
        async register() { return async () => {}; },
        async resolve(id) { return { id, broken: 'persona failed' }; },
      },
    },
  });
  const brokenTool = broken.state.tools.find((entry) => entry.name === 'steward_dispatch');
  const exec = { agent: { id: 'session-parent' }, signal: new AbortController().signal };
  await assert.rejects(
    () => brokenTool.execute({ role: 'pm', description: 'x', prompt: 'y' }, exec),
    /failed to activate/,
  );

  const legacy = await boot({
    services: {
      subagents: {
        getProvider: (name) => ({ name, capabilities: { agentOptions: true, agentPreset: false }, inheritsParentContext: false }),
        list: () => ['spawn'],
        startActivation: async () => ({ childId: 'child-legacy' }),
      },
    },
  });
  const legacyTool = legacy.state.tools.find((entry) => entry.name === 'steward_dispatch');
  await assert.rejects(
    () => legacyTool.execute({ role: 'pm', description: 'x', prompt: 'y' }, exec),
    /does not support independent agent preset selection/,
  );
  assert.equal(legacy.state.activations.length, 0);
});

test('steward_dispatch lets a project steward.config.json modelRouting override the settings page', async () => {
  const bucket = await boot();
  const projectDir = join(workDir, 'demo-project');
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(join(projectDir, 'steward.config.json'), JSON.stringify({
    docTier: 1,
    modelRouting: { 'qa-engineer': { model: 'p1/m-high', effort: 'low', fallback: 'p2/m2' } },
  }, null, 2));

  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');
  const exec = { agent: { id: 'session-parent' }, signal: new AbortController().signal };
  const value = await tool.execute({ role: 'qa-engineer', description: 'QA', prompt: '跑门禁。', cwd: projectDir }, exec);
  assert.equal(value.source, 'project');
  assert.deepEqual(bucket.state.activations.at(-1).request.agentOptions, { provider: 'p1', model: 'm-high', reasoningEffort: 'low' });

  const malformedDir = join(workDir, 'bad-project');
  mkdirSync(malformedDir, { recursive: true });
  writeFileSync(join(malformedDir, 'steward.config.json'), JSON.stringify({ modelRouting: { 'qa-engineer': { model: 'no-slash' } } }));
  const fellBack = await tool.execute({ role: 'qa-engineer', description: 'QA', prompt: '跑门禁。', cwd: malformedDir }, exec);
  assert.equal(fellBack.source, 'inherit');
});

test('dispatch falls back to the live Config references when settings describe is absent', async () => {
  const bucket = await boot({
    services: {
      settings: {
        documentPath: '',
        async update() { throw new Error('not used'); },
      },
    },
  });
  bucket.state.config.roles.pm = { provider: 'p1', model: 'm-high', effort: 'low' };
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');
  const exec = { agent: { id: 'session-parent' }, signal: new AbortController().signal };
  const value = await tool.execute({ role: 'pm', description: '规格', prompt: '只回复 OK' }, exec);
  assert.equal(value.source, 'role');
  assert.deepEqual(bucket.state.activations.at(-1).request.agentOptions, { provider: 'p1', model: 'm-high', reasoningEffort: 'low' });
});

test('/steward reports the roster, presets and routes', async () => {
  const bucket = await boot();
  const command = bucket.state.commands.find((entry) => entry.name === 'steward');
  assert.equal(typeof command.handler, 'function');
  const result = command.handler({ rawInput: 'roles' });
  assert.equal(result.kind, 'success');
  assert.match(result.text, /steward-architect/);
  assert.match(result.text, /设置 → Steward/);
  assert.match(result.text, /steward_dispatch/);
});
