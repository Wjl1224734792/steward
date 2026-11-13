/**
 * DSH 侧 Steward 插件（生成物 dsh/）的宿主契约测试。
 *
 * 覆盖 DSH 原生机制：
 *  - host-only：两个工具（`steward_dispatch` / `steward_board`）+ `/steward-roster` 名册命令 + 9 个技能，没有 Config、没有浏览器半
 *  - 角色是派单时注入的章程，**不注册 Agent Preset**（模式选择器必须保持干净）
 *  - 模型路由只来自项目 `steward.config.json` 的 `modelRouting.<role>`，缺失则继承主代理
 *  - 子代理固定以内置 `standard` 组合启动；缺失/损坏时拒绝派发
 *
 * 不启动宿主：用假 ctx 驱动 apply()。
 */
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PLUGIN = new URL('../../../dsh/index.js', import.meta.url);
const ROLES = new URL('../../../dsh/roles/', import.meta.url);
const ROLE_IDS = ['pm', 'architect', 'backend-dev', 'frontend-dev', 'qa-engineer', 'browser-tester', 'reviewer'];
/** Child composition every dispatch pins; must match index.js CHILD_PRESET. */
const CHILD_PRESET = 'standard';

/**
 * The role charter exactly as index.js builds it: frontmatter and the build
 * banner stripped, trimmed.
 * @param {string} roleId role id.
 * @returns {string} charter text.
 */
function roleBody(roleId) {
  const raw = readFileSync(new URL(`${roleId}.md`, ROLES), 'utf8').replace(/\r\n/g, '\n');
  return raw.replace(/^---\n[\s\S]*?\n---\n?/, '').replace(/^\s*<!--[\s\S]*?-->\s*/, '').trim();
}

/** Fixture plan: two work items with a dependency, one acceptance criterion. */
const PLAN = {
  acceptanceCriteria: [{ id: 'AC1', text: '导出接口返回 200', coveredBy: ['T1'] }],
  tasks: [
    { id: 'T1', title: '实现导出接口', role: 'backend-dev', files: ['src/export.js'], newFiles: [], dependsOn: [], doneWhen: '导出接口返回 200 且单测全绿' },
    { id: 'T2', title: '补导出单测', role: 'qa-engineer', files: ['test/export.test.js'], newFiles: [], dependsOn: ['T1'], doneWhen: '单测覆盖 AC1 且全绿' },
  ],
};

/**
 * Write a plan fixture into `<dir>/03-plan.json`.
 * @param {string} dir run directory.
 * @param {object} plan plan body.
 * @returns {string} absolute plan path.
 */
function writePlan(dir, plan = PLAN) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, '03-plan.json');
  writeFileSync(file, JSON.stringify(plan, null, 2));
  return file;
}

const llm = {
  resolveModelInfo: async (provider, model) => {
    if (provider !== 'p1' || model !== 'm-high') throw new Error(`unknown model ${provider}/${model}`);
    return { provider, id: model, name: model, reasoning: { efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }], defaultEffort: 'low' } };
  },
};

const logger = { info() {}, warn() {}, error() {} };

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

function emptyConfig() {
  return { defaults: { provider: '', model: '', effort: '' }, roles: Object.fromEntries(ROLE_IDS.map((id) => [id, { provider: '', model: '', effort: '' }])) };
}

function createBucket(overrides = {}) {
  const state = { skills: [], tools: [], commands: [], activations: [], board: { tasks: [], seq: 1 }, config: emptyConfig() };
  const services = {
    skills: {
      register(skill) { state.skills.push(skill); return () => {}; },
    },
    tools: {
      register(definition) { state.tools.push(definition); return () => {}; },
    },
    llm,
    settings: {
      documentPath: join(tmpdir(), 'dsh-profile', 'cordis.patch.yml'),
      describe() {
        return [{ ns: 'steward', revision: 1, writable: true, value: structuredClone(state.config) }];
      },
      async update(ns, patch) {
        assert.equal(ns, 'steward', 'writes must target the native steward namespace');
        for (const [roleId, selection] of Object.entries(patch.roles ?? {})) state.config.roles[roleId] = { ...selection };
        if (patch.defaults !== undefined) state.config.defaults = { ...patch.defaults };
      },
    },
    agentTeams: {
      membership: (agent) => ({ role: 'lead', name: agent?.id ?? 'lead' }),
      tryMembership: (agent) => ({ role: 'lead', name: agent?.id ?? 'lead' }),
      listTasks: () => state.board.tasks
        .filter((task) => task.status !== 'deleted')
        .map((task) => ({
          ...task,
          blockedBy: [...task.blockedBy],
          writeScopes: [...task.writeScopes],
          ready: task.blockedBy.every((id) => state.board.tasks.find((entry) => entry.id === id)?.status === 'completed'),
        })),
      createTask: (agent, spec) => {
        const task = {
          id: `task-${state.board.seq++}`,
          revision: 1,
          subject: spec.subject,
          description: spec.description,
          status: 'pending',
          blockedBy: [...(spec.blockedBy ?? [])],
          writeScopes: [...(spec.writeScopes ?? [])],
          writeScopeWarnings: [],
        };
        state.board.tasks.push(task);
        return task;
      },
      updateTask: (agent, spec) => {
        const task = state.board.tasks.find((entry) => entry.id === spec.taskId);
        if (task === undefined) throw new Error(`no such task ${spec.taskId}`);
        if (task.revision !== spec.expectedRevision) throw new Error(`stale revision for ${spec.taskId}`);
        if (spec.action === 'edit') {
          if (spec.subject !== undefined) task.subject = spec.subject;
          if (spec.description !== undefined) task.description = spec.description;
          if (spec.writeScopes !== undefined) task.writeScopes = [...spec.writeScopes];
        } else if (spec.action === 'set_dependencies') {
          task.blockedBy = [...(spec.blockedBy ?? [])];
        }
        task.revision += 1;
        return task;
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
    // The plugin only resolves the shipped child composition; it registers none.
    agentPresets: {
      async register(definition) {
        state.presets = [...(state.presets ?? []), definition];
        return async () => {};
      },
      async resolve(id) {
        return id === CHILD_PRESET ? { id } : null;
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
let emptyDir;
let plugin;

before(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'dsh-steward-test-'));
  emptyDir = join(workDir, 'no-routing');
  mkdirSync(emptyDir, { recursive: true });
  plugin = await import(PLUGIN.href);
});

after(() => {
  rmSync(workDir, { recursive: true, force: true });
});

async function boot(overrides) {
  const bucket = createBucket(overrides);
  plugin.apply(bucket.ctx, bucket.config);
  await new Promise((resolve) => setImmediate(resolve));
  return bucket;
}

function execFor() {
  return { agent: { id: 'session-parent' }, signal: new AbortController().signal };
}

test('apply registers the two tools, one command and the bundled skills — nothing else', async () => {
  const bucket = await boot();
  assert.deepEqual(bucket.state.tools.map((tool) => tool.name).sort(), ['steward_board', 'steward_dispatch']);
  assert.deepEqual(bucket.state.commands.map((command) => command.name), ['steward-roster']);
  assert.deepEqual(bucket.state.skills.map((skill) => skill.name).sort(), [
    'agent-settings',
    'docs',
    'docs-governance',
    'inline',
    'steward',
    'systematic-debugging',
    'tdd',
    'using-steward',
    'verification-before-completion',
  ]);
  for (const skill of bucket.state.skills) assert.ok(skill.content.length > 100, `${skill.name} should carry a body`);

  // The native Config schema backs the Steward panel; the project file still wins at dispatch.
  assert.equal(typeof plugin.Config, 'function');
  const parsed = plugin.Config({});
  assert.equal(typeof parsed.roles.reviewer.provider.get, 'function');
  assert.equal(parsed.roles.reviewer.provider.get(), '');
  assert.ok('pm' in parsed.roles);
  assert.equal(bucket.state.presets?.length ?? 0, 0, 'the plugin must not register agent presets');
});

test('the main skill points at the split-out inline and docs skills', async () => {
  const bucket = await boot();
  const main = bucket.state.skills.find((skill) => skill.name === 'steward');
  assert.match(main.content, /加载 `inline` 技能/);
  assert.match(main.content, /加载 `docs` 技能/);
  // The extracted sections moved out of the main body.
  assert.doesNotMatch(main.content, /^## 执行模式（/m);
  assert.doesNotMatch(main.content, /^## 文档流水线（/m);
  const inline = bucket.state.skills.find((skill) => skill.name === 'inline');
  assert.match(inline.content, /^## 执行模式（/m);
  assert.match(inline.content, /inline 的硬动作|硬动作/);
  const docs = bucket.state.skills.find((skill) => skill.name === 'docs');
  assert.match(docs.content, /^## T3 文档按需升级（/m);
  assert.match(docs.content, /^## 文档流水线（/m);
});

test('every role charter is a dispatch payload, not a mode', async () => {
  for (const id of ROLE_IDS) {
    const charter = roleBody(id);
    assert.ok(charter.length > 500, `${id}: charter should carry the role body`);
    assert.doesNotMatch(charter, /^---/, `${id}: frontmatter must be stripped from the charter`);
    assert.doesNotMatch(charter, /由 host\/dsh\/build\.mjs/, `${id}: the build banner must be stripped from the charter`);
    assert.doesNotMatch(charter, /context7|宿主 MCP/, `${id}: ZCode/MiniMax MCP prose must be rewritten for DSH`);
  }

  const bucket = await boot();
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');
  for (const role of ROLE_IDS) {
    const exec = execFor();
    const value = await tool.execute({ role, description: `${role} task`, prompt: '只回复 OK' }, exec);
    assert.equal(value.childPreset, CHILD_PRESET, `${role} must run the shipped composition`);
    const spec = bucket.state.activations.at(-1);
    // DSH >= 0.2.1-rc.2 removed the nested `request` object: the task fields
    // are the activation spec itself and the backend dereferences spec.parent.
    assert.equal(spec.request, undefined, `${role}: the activation spec must not nest a request object`);
    assert.deepEqual(spec.parent, exec.agent, `${role}: the child must be owned by the calling agent`);
    const text = spec.prompt[0].text;
    assert.ok(text.startsWith(roleBody(role)), `${role}: the dispatch must inject that role's charter`);
    assert.ok(text.endsWith('只回复 OK'), `${role}: the task must stay last`);
    assert.equal(spec.agentPreset, CHILD_PRESET);
  }
});

test('the runtime normalizes CRLF role charters (Windows checkout state)', async () => {
  // A Windows checkout (`core.autocrlf=true`) rewrites the packaged role files
  // to CRLF. The injected charter must not carry the \r, and must still match
  // the LF baseline the host contract compares against.
  const crlfPkg = join(workDir, 'crlf-pkg');
  cpSync(fileURLToPath(new URL('../../../dsh/', import.meta.url)), crlfPkg, { recursive: true });
  for (const id of ROLE_IDS) {
    const file = join(crlfPkg, 'roles', `${id}.md`);
    const lf = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    writeFileSync(file, lf.replace(/\n/g, '\r\n'), 'utf8');
  }

  const crlfPlugin = await import(pathToFileURL(join(crlfPkg, 'index.js')).href);
  const bucket = createBucket();
  crlfPlugin.apply(bucket.ctx, bucket.config);
  await new Promise((resolve) => setImmediate(resolve));

  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');
  await tool.execute({ role: 'backend-dev', description: 'CRLF 检出态冒烟', prompt: '只回复 OK' }, execFor());
  const text = bucket.state.activations.at(-1).prompt[0].text;
  assert.ok(!text.includes('\r'), '注入的章程不得带入 CRLF 的 \\r');
  assert.ok(text.startsWith(roleBody('backend-dev')), 'CRLF 检出态下的章程必须与 LF 基准一致');
});

test('dispatch inherits the parent route when the project configures none', async () => {
  const bucket = await boot();
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');
  const value = await tool.execute({ role: 'reviewer', description: '冒烟', prompt: '只回复 OK', cwd: emptyDir }, execFor());
  assert.equal(value.source, 'inherit');
  assert.equal(value.provider, '');
  assert.equal(bucket.state.activations.at(-1).agentOptions, undefined);
});

test('the panel route applies when the project has no entry, and the project still wins', async () => {
  const bucket = await boot();
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');

  bucket.state.config.roles.reviewer = { provider: 'p1', model: 'm-high', effort: 'high' };
  const viaRole = await tool.execute({ role: 'reviewer', description: '冒烟', prompt: '只回复 OK', cwd: emptyDir }, execFor());
  assert.equal(viaRole.source, 'role');
  assert.deepEqual(bucket.state.activations.at(-1).agentOptions, { provider: 'p1', model: 'm-high', reasoningEffort: 'high' });

  bucket.state.config.roles.reviewer = { provider: '', model: '', effort: '' };
  bucket.state.config.defaults = { provider: 'p1', model: 'm-high', effort: 'low' };
  const viaDefaults = await tool.execute({ role: 'pm', description: '规格', prompt: '只回复 OK', cwd: emptyDir }, execFor());
  assert.equal(viaDefaults.source, 'defaults');

  const projectDir = join(workDir, 'panel-vs-project');
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(join(projectDir, 'steward.config.json'), JSON.stringify({ modelRouting: { 'qa-engineer': { model: 'p1/m-high', effort: 'high' } } }));
  const viaProject = await tool.execute({ role: 'qa-engineer', description: 'QA', prompt: 'x', cwd: projectDir }, execFor());
  assert.equal(viaProject.source, 'project');
  assert.equal(viaProject.effort, 'high');
});

test('dispatch applies modelRouting from the project steward.config.json', async () => {
  const bucket = await boot();
  const projectDir = join(workDir, 'demo-project');
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(join(projectDir, 'steward.config.json'), JSON.stringify({
    docTier: 1,
    modelRouting: { 'qa-engineer': { model: 'p1/m-high', effort: 'high' } },
  }, null, 2));

  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');
  const value = await tool.execute({ role: 'qa-engineer', description: 'QA', prompt: '跑门禁。', cwd: projectDir }, execFor());
  assert.equal(value.source, 'project');
  assert.equal(value.provider, 'p1');
  assert.equal(value.model, 'm-high');
  assert.equal(value.effort, 'high');
  assert.deepEqual(bucket.state.activations.at(-1).agentOptions, { provider: 'p1', model: 'm-high', reasoningEffort: 'high' });

  // A role without its own entry still inherits.
  const inherited = await tool.execute({ role: 'pm', description: '规格', prompt: '只回复 OK', cwd: projectDir }, execFor());
  assert.equal(inherited.source, 'inherit');

  // An unsupported effort fails loudly instead of dispatching a bad route.
  writeFileSync(join(projectDir, 'steward.config.json'), JSON.stringify({
    modelRouting: { 'qa-engineer': { model: 'p1/m-high', effort: 'turbo' } },
  }));
  await assert.rejects(
    () => tool.execute({ role: 'qa-engineer', description: 'QA', prompt: 'x', cwd: projectDir }, execFor()),
    /does not support reasoning effort/,
  );
});

test('a malformed modelRouting entry degrades to inherit instead of half-applying', async () => {
  const bucket = await boot();
  const projectDir = join(workDir, 'bad-project');
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(join(projectDir, 'steward.config.json'), JSON.stringify({ modelRouting: { 'qa-engineer': { model: 'no-slash' } } }));

  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');
  const value = await tool.execute({ role: 'qa-engineer', description: 'QA', prompt: '跑门禁。', cwd: projectDir }, execFor());
  assert.equal(value.source, 'inherit');
  assert.equal(bucket.state.activations.at(-1).agentOptions, undefined);
});

test('dispatch fails loudly when the child composition or preset support is missing', async () => {
  const exec = execFor();

  const broken = await boot({
    services: {
      agentPresets: {
        async register() { return async () => {}; },
        async resolve(id) { return { id, broken: 'persona failed' }; },
      },
    },
  });
  const brokenTool = broken.state.tools.find((entry) => entry.name === 'steward_dispatch');
  await assert.rejects(() => brokenTool.execute({ role: 'pm', description: 'x', prompt: 'y' }, exec), /failed to activate/);
  assert.equal(broken.state.activations.length, 0, 'a broken composition must not start a child');

  const missing = await boot({
    services: {
      agentPresets: {
        async register() { return async () => {}; },
        async resolve() { return null; },
      },
    },
  });
  const missingTool = missing.state.tools.find((entry) => entry.name === 'steward_dispatch');
  await assert.rejects(() => missingTool.execute({ role: 'pm', description: 'x', prompt: 'y' }, exec), /is not registered/);

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

  const bucket = await boot();
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');
  await assert.rejects(() => tool.execute({ role: 'ghost', description: 'x', prompt: 'y' }, exec), /unknown steward role/);
});

test('/steward-roster reports the roster and the routing rule without publishing modes', async () => {
  const bucket = await boot();
  const command = bucket.state.commands.find((entry) => entry.name === 'steward-roster');
  const result = command.handler({ rawInput: 'roles' });
  assert.equal(result.kind, 'success');
  assert.match(result.text, /architect（架构师）/);
  assert.match(result.text, /组合 `standard`/);
  assert.match(result.text, /steward\.config\.json/);
  assert.match(result.text, /steward_dispatch/);
  assert.match(result.text, /不注册 Agent Preset/);
  assert.doesNotMatch(result.text, /steward-architect/);
});

test('registered command names never shadow a skill name (client-side token claim)', async () => {
  const bucket = await boot();
  // 数据源必须是生成物：命令名取自 dsh/index.js 的运行时注册（本文件 :19 的导入先例），
  // 技能名取自 dsh/skills/manifest.json —— 这样能同时防住「改了源忘了重建」。
  // host/dsh/skills/manifest.json 并不存在，技能清单只有构建产物这一份。
  const commandNames = bucket.state.commands.map((command) => command.name);
  const skillManifest = JSON.parse(readFileSync(new URL('../../../dsh/skills/manifest.json', import.meta.url), 'utf8'));
  const skillNames = skillManifest.skills.map((skill) => skill.name);
  const collision = commandNames.filter((name) => skillNames.includes(name));
  assert.deepEqual(
    collision,
    [],
    '命令名与技能名同名时，client 侧会把同名 token claim 给 command，该行永远不会变成 prompt，'
    + `技能正文注入不了（遮蔽根因）。冲突命令名：[${collision.join(', ')}]；技能名集合：[${skillNames.join(', ')}]。`
    + '修法是给命令改名（先例：/steward → /steward-roster），不要动技能名；改完重跑 node host/dsh/build.mjs 刷新生成物。',
  );
});

test('the shipped host half keeps its native-mechanism shape', () => {
  const source = readFileSync(PLUGIN, 'utf8');
  for (const banned of ['agentPresets.register', 'steward_config', 'webServer', '/api/dsh-steward']) {
    assert.ok(!source.includes(banned), `dsh/index.js must not reference ${banned}`);
  }
  for (const required of ['export const Config', 'settings.describe', 'agentTeams', 'steward.config.json']) {
    assert.ok(source.includes(required), `dsh/index.js must keep ${required}`);
  }
});

test('steward_board sync turns the plan into gates and work items', async () => {
  const bucket = await boot();
  const planPath = writePlan(join(workDir, 'run-m'));
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_board');
  const result = await tool.execute({ action: 'sync', plan: planPath, level: 'M' }, execFor());
  assert.equal(result.action, 'sync');

  const tasks = bucket.state.board.tasks;
  assert.equal(tasks.length, 5, 'G1 + two work items + G2 + G3');
  const g1 = tasks.find((task) => task.subject.startsWith('G1'));
  const g2 = tasks.find((task) => task.subject.startsWith('G2'));
  const g3 = tasks.find((task) => task.subject.startsWith('G3'));
  const t1 = tasks.find((task) => task.subject.startsWith('T1 · backend-dev'));
  const t2 = tasks.find((task) => task.subject.startsWith('T2 · qa-engineer'));
  for (const task of [g1, g2, g3, t1, t2]) assert.ok(task, 'every board task exists');

  // Work items carry the plan brief, file scopes and the plan gate as a blocker.
  assert.match(t1.subject, /实现导出接口/);
  assert.deepEqual(t1.writeScopes, ['src/export.js']);
  assert.deepEqual(t1.blockedBy, [g1.id]);
  assert.match(t1.description, /steward:plan=T1/);
  assert.match(t1.description, /reports\/t1-backend-dev\.md/);
  assert.match(t1.description, /AC1 导出接口返回 200/);

  // Dependencies follow the plan DAG, then the gates close over every work item.
  assert.deepEqual([...t2.blockedBy].sort(), [g1.id, t1.id].sort());
  assert.deepEqual([...g2.blockedBy].sort(), [t1.id, t2.id].sort());
  assert.deepEqual(g3.blockedBy, [g2.id]);

  assert.match(result.text, /共享任务板/);
  assert.match(result.text, /门禁：G1 ⏸ \/ G2 ⏸ \/ G3 ⏸/);
  assert.match(result.text, /T2 · qa-engineer/);
});

test('steward_board sync is idempotent and level S creates no gates', async () => {
  const bucket = await boot();
  const planPath = writePlan(join(workDir, 'run-idem'));
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_board');
  await tool.execute({ action: 'sync', plan: planPath, level: 'S' }, execFor());
  const afterFirst = bucket.state.board.tasks.length;
  assert.equal(afterFirst, 2, 'level S boards only the work items');
  assert.equal(bucket.state.board.tasks.some((task) => task.subject.startsWith('G')), false);

  await tool.execute({ action: 'sync', plan: planPath, level: 'S' }, execFor());
  assert.equal(bucket.state.board.tasks.length, afterFirst, 'a second sync must not duplicate tasks');

  // Re-syncing at M adds the gates over the same work items.
  await tool.execute({ action: 'sync', plan: planPath, level: 'M' }, execFor());
  const subjects = bucket.state.board.tasks.map((task) => task.subject);
  assert.equal(new Set(subjects).size, subjects.length, 'subjects stay unique across levels');
  assert.equal(bucket.state.board.tasks.length, 5, 'two work items + G1..G3');

  // A changed plan updates the existing work item instead of creating another.
  const edited = structuredClone(PLAN);
  edited.tasks[0].title = '实现导出接口（含 CSV）';
  const editedPlan = writePlan(join(workDir, 'run-idem'), edited);
  await tool.execute({ action: 'sync', plan: editedPlan, level: 'M' }, execFor());
  const t1s = bucket.state.board.tasks.filter((task) => task.subject.startsWith('T1 ·'));
  assert.equal(t1s.length, 1);
  assert.match(t1s[0].subject, /含 CSV/);
});

test('steward_board status mirrors the board and reports readiness', async () => {
  const bucket = await boot();
  const planPath = writePlan(join(workDir, 'run-status'));
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_board');
  await tool.execute({ action: 'sync', plan: planPath, level: 'M' }, execFor());
  const status = await tool.execute({ action: 'status', plan: planPath, level: 'M' }, execFor());
  assert.match(status.text, /进度：0\/2 工作单完成/);
  assert.match(status.text, /\| 任务 \| 状态 \| 负责人 \| 依赖 \|/);
  assert.match(status.text, /⛔ 被阻塞/, 'work items are blocked by G1');
  assert.match(status.text, /状态口径/);
});

test('steward_board brief composes charter, plan task and board id', async () => {
  const bucket = await boot();
  const planPath = writePlan(join(workDir, 'run-brief'));
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_board');
  await tool.execute({ action: 'sync', plan: planPath, level: 'M' }, execFor());
  const brief = await tool.execute({ action: 'brief', plan: planPath, role: 'backend-dev', task: 'T1' }, execFor());
  assert.ok(brief.text.startsWith(roleBody('backend-dev')), 'the brief opens with the role charter');
  assert.match(brief.text, /任务板：task-\d+/);
  assert.match(brief.text, /steward:plan=T1/);
  assert.match(brief.text, /完成协议/);

  await assert.rejects(
    () => tool.execute({ action: 'brief', plan: planPath, role: 'backend-dev', task: 'T9' }, execFor()),
    /计划里没有任务/,
  );
});

test('steward_board fails loudly when the host has no Agent Teams', async () => {
  const bucket = await boot({ services: { agentTeams: undefined } });
  const planPath = writePlan(join(workDir, 'run-solo'));
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_board');
  await assert.rejects(
    () => tool.execute({ action: 'sync', plan: planPath, level: 'M' }, execFor()),
    /Agent Teams 未启用/,
  );
  await assert.rejects(
    () => tool.execute({ action: 'sync' }, execFor()),
    /需要 plan 参数/,
  );
});

/**
 * Load the generated client bundle once. The bundle is an ES module, so a second
 * dynamic import of the same URL would be answered from the module cache and its
 * `__ModuleLoader__.load` call would never run again.
 * @returns {Promise<{ id: string, factory: Function }>} loader id and factory.
 */
let clientBundle = null;
async function loadClientFactory() {
  if (clientBundle !== null) return clientBundle;
  const source = readFileSync(new URL('../../../dsh/client.js', import.meta.url), 'utf8');
  let loaded = null;
  const previousWindow = globalThis.window;
  globalThis.window = { __ModuleLoader__: { load: (definition) => { loaded = definition; } } };
  try {
    await import(`data:text/javascript,${encodeURIComponent(source)}`);
  } finally {
    globalThis.window = previousWindow;
  }
  assert.ok(loaded, 'the bundle must call window.__ModuleLoader__.load');
  clientBundle = { id: loaded.id, factory: loaded.factory };
  return clientBundle;
}

/**
 * A stateful React stand-in for render tests: state cells survive passes, effects
 * run inline, and every component is expanded down to host elements. Enough to
 * drive a view switch through a real `onClick` prop and see the next render.
 */
function createRenderHarness(options) {
  const stateless = Boolean(options && options.stateless);
  // Hooks are keyed by component identity (name + occurrence in the pass), the way
  // React keeps a hook list per component instance — a global counter would mix
  // cells up as soon as a view switch changes the tree shape.
  const cells = new Map();
  const ownerStack = [];
  let owners = new Map();
  let hooks = new Map();
  const enterOwner = (label) => {
    const seen = owners.get(label) || 0;
    owners.set(label, seen + 1);
    return label + '#' + seen;
  };
  const stub = {
    createElement: (type, props, ...children) => {
      const merged = { ...(props || {}) };
      if (children.length === 1) merged.children = children[0];
      else if (children.length > 1) merged.children = children;
      return { type, props: merged, children };
    },
    useState: (init) => {
      const initial = typeof init === 'function' ? init() : init;
      if (stateless) return [initial, () => {}];
      const owner = ownerStack.length > 0 ? ownerStack[ownerStack.length - 1] : 'root';
      const index = hooks.get(owner) || 0;
      hooks.set(owner, index + 1);
      const key = owner + '|' + index;
      if (!cells.has(key)) cells.set(key, { value: initial });
      const cell = cells.get(key);
      return [cell.value, (next) => { cell.value = typeof next === 'function' ? next(cell.value) : next; }];
    },
    useEffect: (effect) => { effect(); },
    useMemo: (factory) => factory(),
    useRef: (init) => ({ current: init }),
    useCallback: (fn) => fn,
    Component: class {
      constructor(props) { this.props = props; this.state = {}; }
    },
  };

  const expandComponent = (label, render) => {
    ownerStack.push(enterOwner(label));
    try {
      return render();
    } finally {
      ownerStack.pop();
    }
  };

  const expand = (element, out = []) => {
    if (element === null || element === undefined) return out;
    if (typeof element !== 'object') return out;
    if (Array.isArray(element)) {
      for (const item of element) expand(item, out);
      return out;
    }
    const type = element.type;
    if (type === 'style') return out;
    if (typeof type === 'function') {
      const label = type.name || type.displayName || 'anonymous';
      if (type.prototype instanceof stub.Component) {
        return expandComponent(label, () => expand(new type(element.props).render(), out));
      }
      return expandComponent(label, () => expand(type(element.props), out));
    }
    const children = [];
    for (const child of element.children || []) {
      if (child === null || child === undefined) continue;
      if (typeof child === 'object') {
        for (const node of expand(child, [])) children.push(node);
      } else {
        children.push(child);
      }
    }
    out.push({ type, props: element.props || {}, children });
    return out;
  };

  const collect = (nodes, predicate, found = []) => {
    for (const node of nodes) {
      if (predicate(node)) found.push(node);
      collect(node.children.filter((child) => typeof child === 'object'), predicate, found);
    }
    return found;
  };
  const labelOf = (node) => node.children.filter((child) => typeof child !== 'object').join('');
  const textOf = (node) => node.children.map((child) => (typeof child === 'object' ? textOf(child) : String(child))).join('');
  const byClass = (name) => (node) => typeof node.props.className === 'string' && node.props.className.split(/\s+/).indexOf(name) >= 0;
  const reset = () => { cells.clear(); };

  /** Render to host elements across passes so effect-driven state settles. */
  const settle = async (make) => {
    let host = [];
    for (let pass = 0; pass < 4; pass += 1) {
      owners = new Map();
      hooks = new Map();
      ownerStack.length = 0;
      host = expand(make());
      if (pass < 3) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return host;
  };

  return { stub, expand, collect, labelOf, textOf, byClass, reset, settle };
}

/**
 * A client Context stand-in: captures slot registrations and right-Sidebar tab
 * types, and answers the optional `ctx.inject([...], run)` the plugin uses so a
 * profile without the right Sidebar still keeps the settings section.
 * @param options - services to override.
 * @returns the context plus what the plugin registered.
 */
function createClientContext(options) {
  const settings = options && options.settings;
  const registered = [];
  const tabTypes = [];
  const ctx = {
    slots: {
      inject: (name, callback) => callback(),
      register: (definition, component) => {
        registered.push({ options: definition, component });
        return () => {};
      },
    },
    locale: { getLocale: () => ({ id: (options && options.locale) || 'zh-CN' }) },
    remote: (options && options.remote) || { session: { modelCatalog: async () => ({ ok: true, value: { groups: [] } }) } },
    configForms: settings || { get: () => ({ getSnapshot: () => ({ status: 'loading' }), subscribe: () => () => {}, mutate: async () => true }) },
    uiWorkspace: { openSession: () => {} },
    sidebarRightTabs: {
      register: (definition) => {
        tabTypes.push(definition);
        return () => {};
      },
    },
    sidebarRight: (options && options.sidebarRight) || {
      mounted: { getSnapshot: () => undefined, subscribe: () => () => {} },
      openTab: () => {},
      openResource: () => {},
    },
    sessions: (options && options.sessions) || {
      list: { getSnapshot: () => ({ projectionsBySession: {} }), subscribe: () => () => {} },
    },
    effect: (callback) => { callback(); },
  };
  if (!options || options.useInject !== false) ctx.inject = (names, run) => run(ctx);
  return { ctx, registered, tabTypes };
}

/** The registered board body plus the injected face for one Session. */
function boardEntry(registered) {
  const entry = registered.find((item) => item.options.name === 'sidebar.right.pane.tab');
  assert.ok(entry, 'the board body must register into sidebar.right.pane.tab');
  return entry;
}

/** Render the board for one Session with the given scope services. */
function boardRender(registered, sessionId, props) {
  const entry = boardEntry(registered);
  const face = typeof entry.options.inject === 'function' ? entry.options.inject(sessionId) : {};
  return () => entry.component({ ...face, sessionId, ...(props || {}) });
}

/** Job-shaped facts the board would read off disk. */
function sampleFacts(overrides) {
  return {
    status: 'ready',
    dir: 'tmp/steward/1113-1518-demo',
    run: { status: 'running', updatedAt: '2026-11-13T07:20:00.000Z' },
    plan: null,
    artifacts: [{ path: 'tmp/steward/1113-1518-demo/final-report.md', name: 'final-report.md', size: 2048 }],
    ...(overrides || {}),
  };
}

/**
 * The board is a per-Session right-Sidebar tab: the tab type, its body and chip
 * title, a header button, and a settings section for models. The old full page and
 * its left-nav entry must stay gone — the panel is opened per Session, not as a page.
 */
test('the client registers a right-sidebar board, its title, a header button and the settings section', async () => {
  const { id, factory } = await loadClientFactory();
  assert.equal(id, 'dsh-steward');

  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  assert.deepEqual(instance.inject, ['slots', 'locale', 'remote', 'remote.session', 'configForms', 'uiWorkspace']);

  const { ctx, registered, tabTypes } = createClientContext();
  instance.apply(ctx);

  assert.deepEqual(registered.map((entry) => entry.options.name), [
    'settings.section',
    'sidebar.right.pane.tab',
    'sidebar.right.pane.tab.title',
    'conversation.session.header.utilities',
  ]);
  assert.deepEqual(
    registered.filter((entry) => entry.options.name === 'main' || entry.options.name === 'sidebar.panellist'),
    [],
    'there is no full page and no left-nav entry any more',
  );

  assert.equal(registered[0].options.id, 'steward', 'the settings section keeps its id');
  assert.equal(registered[1].options.key, 'dsh-steward', 'the body is keyed by the tab type id');
  assert.equal(registered[2].options.key, 'dsh-steward', 'the chip title uses the same key');
  assert.equal(registered[3].options.id, 'steward-board');
  assert.ok(registered[3].options.order < 0, 'the header button sits left of the overflow menu');

  assert.equal(tabTypes.length, 1);
  assert.equal(tabTypes[0].id, 'dsh-steward');
  assert.equal(tabTypes[0].kind, 'steward', 'openTab() names the kind');
  assert.match(tabTypes[0].title('sidebar://steward'), /看板/);
  assert.equal(tabTypes[0].guide.length, 1, 'the guide page offers a way in');
  assert.equal(tabTypes[0].guide[0].id, 'steward-board');

  // The empty board explains itself instead of throwing.
  const renderEmpty = boardRender(registered, 'session-empty', {});
  const emptyHost = await harness.settle(renderEmpty);
  const emptyText = emptyHost.map((node) => harness.textOf(node)).join('\n');
  assert.match(emptyText, /Steward 运行看板/);
  assert.match(emptyText, /还没有任务/);
  assert.match(emptyText, /还没有派发子代理/);

  // The header button renders as a real control and calls the injected opener.
  const buttonEntry = registered[3];
  let opened = 0;
  const buttonHost = harness.expand(buttonEntry.component({ text: { openPanel: '打开 Steward 看板' }, openPanel: () => { opened += 1; } }));
  const buttons = harness.collect(buttonHost, harness.byClass('stwd-headbtn'));
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].props['aria-label'], '打开 Steward 看板');
  buttons[0].props.onClick();
  assert.equal(opened, 1);

  // The English dictionary covers the same surfaces.
  const enHarness = createRenderHarness();
  const enInstance = factory((name) => (name === 'react' ? enHarness.stub : {}));
  const en = createClientContext({ locale: 'en-US' });
  enInstance.apply(en.ctx);
  const enHost = await enHarness.settle(boardRender(en.registered, 'session-empty', {}));
  const enText = enHost.map((node) => enHarness.textOf(node)).join('\n');
  assert.match(enText, /Steward run board/);
  assert.match(enText, /No tasks yet/);
  assert.match(enText, /No subagent dispatched/);
});

/**
 * The first Steward dispatch in a Session opens the board once and only once: a
 * plain `subagent` call must not steal the panel, and closing it afterwards has to
 * stick for that Session.
 */
test('the board opens itself once when a Steward dispatch appears', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));

  const opened = [];
  const listeners = new Set();
  let snapshot = {
    projectionsBySession: {
      'session-a': { values: { subagentCatalog: [{ id: 'child-1', mode: 'one-shot', label: '查一下文档' }] } },
    },
  };
  const { ctx } = createClientContext({
    sidebarRight: {
      mounted: { getSnapshot: () => 'session-a', subscribe: () => () => {} },
      openTab: (kind) => opened.push(kind),
      openResource: () => {},
    },
    sessions: {
      list: {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
    },
  });
  instance.apply(ctx);
  assert.deepEqual(opened, [], 'a plain subagent call never opens the board');

  snapshot = {
    projectionsBySession: {
      'session-a': { values: { subagentCatalog: [{ id: 'child-2', mode: 'one-shot', label: 'backend-dev · T1 导出接口' }] } },
    },
  };
  for (const listener of listeners) listener();
  assert.deepEqual(opened, ['steward'], 'a Steward dispatch opens the board');

  for (const listener of listeners) listener();
  assert.deepEqual(opened, ['steward'], 'it does not fight the user for the panel afterwards');
});

/**
 * A host half that predates the role-prefixed label, or a plain `subagent` call
 * inside a Steward run, still opens the board: the run directory on disk is the
 * evidence, probed once per Session.
 */
test('the board also opens when a run directory exists but the dispatch label carries no role', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));

  const opened = [];
  const workspaceFiles = {
    list: async (sessionId, path) => (path === 'tmp/steward'
      ? { ok: true, value: { path, entries: [{ name: '1113-1518-demo', type: 'directory' }], truncated: false } }
      : { ok: false, error: { message: 'workspace-file/not-found', code: 'workspace-file/not-found' } }),
    read: async () => ({ ok: false, error: { message: 'workspace-file/not-found', code: 'workspace-file/not-found' } }),
  };
  const snapshot = {
    projectionsBySession: {
      'session-probe': { values: { subagentCatalog: [{ id: 'child-1', mode: 'one-shot', label: '查一下文档' }] } },
    },
  };
  const { ctx } = createClientContext({
    remote: { session: { modelCatalog: async () => ({ ok: true, value: { groups: [] } }) }, workspaceFiles },
    sidebarRight: {
      mounted: { getSnapshot: () => 'session-probe', subscribe: () => () => {} },
      openTab: (kind) => opened.push(kind),
      openResource: () => {},
    },
    sessions: { list: { getSnapshot: () => snapshot, subscribe: () => () => {} } },
  });
  instance.apply(ctx);
  assert.deepEqual(opened, [], 'the probe is asynchronous');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(opened, ['steward'], 'a run directory opens the board');
});

/**
 * The board is the point of the panel: a layered dependency graph by default, an
 * ownership matrix for file conflicts and a row list as the complete text
 * alternative — plus live subagents and the files the run produced.
 */
test('the board renders a dependency graph, an ownership matrix, a list, subagents and artifacts', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  const { ctx, registered } = createClientContext();
  instance.apply(ctx);

  const values = {
    agentTeam: {
      enabled: true,
      tasks: [
        { id: 'g1', subject: 'G1 · 计划批准', status: 'completed', ownerName: '', blockedBy: [], writeScopes: [] },
        { id: 't1', subject: 'T1 · backend-dev · 导出接口', status: 'in_progress', ownerName: 'backend-dev-t1', blockedBy: ['g1'], writeScopes: ['src/export.ts', 'test/export.test.ts'], description: '目标：导出接口返回 200' },
        { id: 't2', subject: 'T2 · frontend-dev · 导出按钮', status: 'pending', ownerName: 'frontend-dev-t3', blockedBy: ['t1'], writeScopes: ['test/export.test.ts'], ready: false },
        { id: 'g2', subject: 'G2 · QA 门禁', status: 'pending', ownerName: '', blockedBy: ['t1'], writeScopes: [] },
      ],
    },
    subagentCatalog: [
      { id: 'child-1', mode: 'one-shot', label: 'backend-dev · T1 导出接口', activity: 'running' },
      { id: 'child-2', mode: 'one-shot', label: 'qa-engineer · T4 QA', activity: 'inactive' },
    ],
  };
  const opened = [];
  const props = {
    loadRun: async () => sampleFacts(),
    useProjection: (key) => values[key],
    useSessions: (selector) => selector({ byId: { 'child-1': { title: 'T1 导出接口实现' } } }),
    useSessionStatus: (selector) => selector(new Map([['child-1', { running: true }]])),
    openSession: (id, mode) => opened.push(['session', id, mode]),
    openFile: (path) => opened.push(['file', path]),
  };
  const renderBoard = boardRender(registered, 'session-run01', props);

  // 1) Default view: the dispatch graph — a Lead node, the tasks it dispatched and
  // the dependency edges between them.
  let host = await harness.settle(renderBoard);
  const leadNodes = harness.collect(host, harness.byClass('stwd-node-lead'));
  assert.equal(leadNodes.length, 1, 'the graph has one Lead root');
  assert.match(String(leadNodes[0].props['aria-label']), /Lead/, 'the root is named');
  const nodes = harness.collect(host, harness.byClass('stwd-node-task'));
  assert.equal(nodes.length, 4, 'every task is a graph node');
  const edges = harness.collect(host, harness.byClass('stwd-edge'));
  assert.equal(edges.length, 4, 'three dependencies plus the dispatch into the root task');
  assert.equal(harness.collect(host, harness.byClass('stwd-edge-dispatch')).length, 1, 'exactly one task has no prerequisite');
  const labels = nodes.map((node) => String(node.props['aria-label']));
  assert.ok(labels.some((label) => label.indexOf('T1 ') === 0 && label.indexOf('进行中') > 0), 'a node names its task and state');
  assert.ok(labels.some((label) => label.indexOf('backend-dev-t1') > 0), 'a node names its owner');
  const xOf = (short) => {
    const node = nodes.find((entry) => String(entry.props['aria-label']).indexOf(short + ' ') === 0);
    const match = /translate\(([-\d.]+)/.exec(String(node.props.transform));
    return Number(match ? match[1] : NaN);
  };
  assert.ok(xOf('G1') < xOf('T1'), 'layers run left to right');
  assert.ok(xOf('T1') < xOf('G2'), 'the QA gate follows the work item');
  assert.match(host.map((node) => harness.textOf(node)).join('\n'), /共享任务板/, 'the source is named');

  // 2) Subagents: one row per dispatch, live status, click opens the child session.
  const subrows = harness.collect(host, harness.byClass('stwd-subrow'));
  assert.equal(subrows.length, 2, 'one row per dispatched subagent');
  assert.match(harness.textOf(subrows[0]), /T1 导出接口实现/, 'the child Session title is the row title');
  assert.match(harness.textOf(subrows[0]), /运行中/, 'a running child is labelled, not just coloured');
  assert.match(harness.textOf(subrows[1]), /空闲/);
  subrows[0].props.onClick();
  assert.deepEqual(opened[0], ['session', 'child-1', 'one-shot'], 'clicking a subagent opens its child session');

  // 3) Artifacts: the run directory listing is a clickable file list.
  const artrows = harness.collect(host, harness.byClass('stwd-artrow'));
  assert.equal(artrows.length, 1);
  assert.match(harness.textOf(artrows[0]), /final-report\.md/);
  artrows[0].props.onClick();
  assert.deepEqual(opened[1], ['file', 'tmp/steward/1113-1518-demo/final-report.md'], 'clicking an artifact opens the file');

  // 4) Selecting a node opens the task detail.
  const t1Node = nodes.find((node) => String(node.props['aria-label']).indexOf('T1 ') === 0);
  t1Node.props.onClick();
  host = await harness.settle(renderBoard);
  const detail = harness.collect(host, harness.byClass('stwd-detail'))[0];
  assert.ok(detail, 'clicking a node opens the detail');
  assert.match(harness.textOf(detail), /T1 · backend-dev · 导出接口/);
  assert.match(harness.textOf(detail), /src\/export\.ts/);
  assert.match(harness.textOf(detail), /导出接口返回 200/, 'the task description is readable in the panel');

  // 5) Ownership matrix: the file both agents write is flagged as overlapping.
  const viewTabs = harness.collect(host, harness.byClass('stwd-viewtab'));
  assert.deepEqual(viewTabs.map(harness.textOf), ['依赖图', '列表', '归属']);
  viewTabs[2].props.onClick();
  host = await harness.settle(renderBoard);
  const table = harness.collect(host, (node) => node.type === 'table')[0];
  assert.ok(table, 'the matrix is a real table');
  const columnHeads = harness.collect([table], (node) => node.type === 'th' && node.props.scope === 'col').map(harness.textOf);
  assert.ok(columnHeads.some((cell) => cell.indexOf('backend-dev-t1') >= 0), 'one column per agent');
  const matrixRows = harness.collect(host, (node) => typeof node.props.className === 'string' && node.props.className.indexOf('stwd-matrix-row-overlap') >= 0);
  assert.equal(matrixRows.length, 1, 'only the shared file is flagged');
  assert.match(harness.textOf(matrixRows[0]), /test\/export\.test\.ts/);
  assert.equal(harness.collect(host, harness.byClass('stwd-node')).length, 0, 'the graph is replaced, not stacked');

  // 6) List: the complete text alternative, one row per task.
  harness.collect(host, harness.byClass('stwd-viewtab'))[1].props.onClick();
  host = await harness.settle(renderBoard);
  const rows = harness.collect(host, harness.byClass('stwd-row'))
    .filter((node) => node.props.className.indexOf('stwd-subrow') < 0 && node.props.className.indexOf('stwd-artrow') < 0);
  assert.equal(rows.length, 4, 'one row per task');
  assert.match(harness.textOf(rows[1]), /T1 · backend-dev · 导出接口/, 'the row carries the whole title');
  assert.match(harness.textOf(rows[1]), /进行中/);
});

/**
 * Without Agent Teams the board still has to say something: the todo list is the
 * fallback source, and a cyclic board degrades to the list with an explanation.
 */
test('the board falls back to the todo list and refuses to draw a cyclic graph', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  const { ctx, registered } = createClientContext();
  instance.apply(ctx);

  const todoValues = {
    todos: [
      { content: '写规格', status: 'completed' },
      { content: '实现导出', status: 'in_progress' },
    ],
  };
  const renderTodo = boardRender(registered, 'session-todo', {
    loadRun: async () => ({ status: 'empty', dir: '', run: null, plan: null, artifacts: [] }),
    useProjection: (key) => todoValues[key],
  });
  let host = await harness.settle(renderTodo);
  assert.equal(harness.collect(host, harness.byClass('stwd-node-task')).length, 2, 'two todo items are two nodes');
  assert.equal(harness.collect(host, harness.byClass('stwd-node-lead')).length, 1, 'the Lead root is drawn too');
  assert.equal(harness.collect(host, harness.byClass('stwd-edge-dispatch')).length, 2, 'each todo hangs off the Lead with a line');
  assert.equal(harness.collect(host, harness.byClass('stwd-edge')).length, 2, 'a todo list has no dependencies');
  assert.match(host.map((node) => harness.textOf(node)).join('\n'), /待办清单/, 'the fallback source is named');

  // A cycle cannot be layered: the list takes over and the panel says why.
  const cycleValues = {
    agentTeam: {
      enabled: true,
      tasks: [
        { id: 't1', subject: 'T1 · backend-dev · 甲', status: 'pending', ownerName: 'backend-dev-t1', blockedBy: ['t2'], writeScopes: [] },
        { id: 't2', subject: 'T2 · backend-dev · 乙', status: 'pending', ownerName: 'backend-dev-t1', blockedBy: ['t1'], writeScopes: [] },
      ],
    },
  };
  const renderCycle = boardRender(registered, 'session-cycle', {
    loadRun: async () => ({ status: 'empty', dir: '', run: null, plan: null, artifacts: [] }),
    useProjection: (key) => cycleValues[key],
  });
  host = await harness.settle(renderCycle);
  assert.equal(harness.collect(host, harness.byClass('stwd-node')).length, 0, 'no layered graph for a cyclic board');  const cycleRows = harness.collect(host, harness.byClass('stwd-row'))
    .filter((node) => node.props.className.indexOf('stwd-subrow') < 0 && node.props.className.indexOf('stwd-artrow') < 0);
  assert.equal(cycleRows.length, 2, 'the list takes over');
  const alerts = harness.collect(host, harness.byClass('stwd-alert')).map(harness.textOf);
  assert.ok(alerts.some((text) => text.indexOf('环状依赖') >= 0), `the panel explains the cycle (alerts: ${alerts.join(' | ')})`);
});

/**
 * The board reads the run off disk through the host's workspace-files Remote: the
 * newest run directory wins, 03-plan.json supplies ownership and run.json status.
 */
test('the board reads plan + run.json + artifacts off disk through the workspace-files Remote', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));

  const listings = {
    'tmp/steward': [
      { name: '1112-0930-old', type: 'directory' },
      { name: '1113-1518-demo', type: 'directory' },
    ],
    'tmp/steward/1113-1518-demo': [
      { name: 'run.json', type: 'file', size: 120 },
      { name: '03-plan.json', type: 'file', size: 400 },
    ],
    'tmp/steward/1113-1518-demo/reports': [{ name: 'qa.md', type: 'file', size: 3000 }],
    'tmp/steward/1112-0930-old': [],
  };
  const reads = {
    'tmp/steward/1113-1518-demo/run.json': JSON.stringify({
      status: 'running',
      updatedAt: '2026-11-13T07:20:00.000Z',
      tasks: { T1: { status: 'done', attempts: 1 }, T2: { status: 'running' } },
    }),
    'tmp/steward/1113-1518-demo/03-plan.json': JSON.stringify({
      acceptanceCriteria: [{ id: 'AC1', text: '导出接口返回 200', coveredBy: ['T1'] }],
      tasks: [
        { id: 'T1', title: '导出接口', role: 'backend-dev', files: ['src/export.js'], newFiles: [], dependsOn: [] },
        { id: 'T2', title: '导出按钮', role: 'frontend-dev', files: ['src/ui/button.vue'], newFiles: [], dependsOn: ['T1'] },
      ],
    }),
  };
  const calls = [];
  const workspaceFiles = {
    list: async (sessionId, path) => {
      calls.push(['list', path]);
      assert.equal(sessionId, 'session-run07');
      return listings[path] === undefined
        ? { ok: false, error: { message: 'workspace-file/not-found', code: 'workspace-file/not-found' } }
        : { ok: true, value: { path, entries: listings[path], truncated: false } };
    },
    read: async (sessionId, path) => {
      calls.push(['read', path]);
      assert.equal(sessionId, 'session-run07');
      return reads[path] === undefined
        ? { ok: false, error: { message: 'workspace-file/not-found', code: 'workspace-file/not-found' } }
        : { ok: true, value: { text: reads[path], absolutePath: path, version: 'v1', offset: 1, lines: 1, eof: true } };
    },
  };

  const { ctx, registered } = createClientContext({
    remote: { session: { modelCatalog: async () => ({ ok: true, value: { groups: [] } }) }, workspaceFiles },
  });
  instance.apply(ctx);

  const entry = boardEntry(registered);
  const face = entry.options.inject('session-run07');
  const facts = await face.loadRun();
  assert.equal(facts.dir, 'tmp/steward/1113-1518-demo', 'the newest run directory wins');
  assert.equal(facts.run.status, 'running');
  assert.ok(facts.artifacts.some((item) => item.name === 'reports/qa.md'), 'nested reports are listed');
  assert.ok(calls.some(([method, path]) => method === 'list' && path === 'tmp/steward'), 'discovery walks the run root');

  // Rendering the same Session turns plan + run.json into the graph.
  const host = await harness.settle(() => entry.component({
    ...face,
    sessionId: 'session-run07',
    useProjection: () => undefined,
  }));
  const nodes = harness.collect(host, harness.byClass('stwd-node-task'));
  assert.equal(nodes.length, 2, 'the plan tasks become nodes');
  assert.equal(harness.collect(host, harness.byClass('stwd-node-lead')).length, 1, 'the Lead root heads the plan graph');
  assert.equal(harness.collect(host, harness.byClass('stwd-edge-dispatch')).length, 1, 'the first task hangs off the Lead');
  assert.equal(harness.collect(host, harness.byClass('stwd-edge')).length, 2, 'one dispatch edge plus T1 → T2');
  const nodeLabels = nodes.map((node) => String(node.props['aria-label']));
  assert.ok(nodeLabels.some((label) => label.indexOf('T1 ') === 0 && label.indexOf('完成') > 0), 'run.json drives the status');
  assert.ok(nodeLabels.some((label) => label.indexOf('T2 ') === 0 && label.indexOf('进行中') > 0));
  assert.ok(host.map((node) => harness.textOf(node)).join('\n').indexOf('run.json') >= 0, 'the source is named');
});

/**
 * The injected face is how a row reaches the host: a child Session opens as a
 * `subagentchat` resource in the right Sidebar, an artifact as a `file` resource.
 */
test('the board face opens child sessions and artifacts in the right sidebar', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  const calls = [];
  const { ctx, registered } = createClientContext({
    sidebarRight: {
      mounted: { getSnapshot: () => undefined, subscribe: () => () => {} },
      openTab: (kind) => calls.push(['tab', kind]),
      openResource: (address, options) => calls.push(['resource', address, options]),
    },
  });
  instance.apply(ctx);

  const face = boardEntry(registered).options.inject('session-run09');
  face.openSession('child-7', 'one-shot');
  const chat = calls.find(([kind]) => kind === 'resource');
  assert.ok(chat, 'opening a child uses the Sidebar resource path');
  assert.equal(chat[1], 'dsh-resource://subagentchat/session/child-7?parent=session-run09&mode=one-shot');
  assert.equal(chat[2].kind, 'subagentchat', 'the claim names the subagentchat type');

  face.openFile('tmp/steward/1113-1518-demo/reports/qa.md');
  const file = calls.filter(([kind]) => kind === 'resource').pop();
  assert.equal(file[1], 'dsh-resource://file/session/session-run09/tmp/steward/1113-1518-demo/reports/qa.md');

  face.openPanel();
  assert.deepEqual(calls.filter(([kind]) => kind === 'tab'), [['tab', 'steward']], 'the panel opens by kind');
});

/**
 * The configuration surface is the densest part of the panel. Render it against a
 * settled native settings snapshot plus a live model catalog and assert the table
 * shape: column headers, the defaults row, one row per role, three selects each.
 */
test('the settings section renders the model table with a defaults row and one row per role', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();

  const snapshot = {
    status: 'ready',
    writable: true,
    revision: 4,
    value: {
      defaults: { provider: '', model: '', effort: '' },
      roles: { 'backend-dev': { provider: 'ctaigw', model: 'glm-5.3', effort: 'high' } },
    },
  };
  const catalog = {
    ok: true,
    value: {
      groups: [
        { id: 'ctaigw', name: 'CTAIGW', models: [{ id: 'glm-5.3', name: 'GLM 5.3', reasoning: { efforts: [{ id: 'high', name: 'High' }] } }] },
      ],
    },
  };

  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  const { ctx, registered } = createClientContext({
    remote: { session: { modelCatalog: async () => catalog } },
    settings: { get: () => ({ getSnapshot: () => snapshot, subscribe: () => () => {}, mutate: async () => true }) },
  });
  instance.apply(ctx);

  const settingsEntry = registered.find((entry) => entry.options.name === 'settings.section');
  assert.ok(settingsEntry, 'the settings section is registered');
  const { collect, labelOf, textOf, byClass } = harness;
  const host = await harness.settle(() => settingsEntry.component({}));

  assert.deepEqual(collect(host, byClass('stwd-th')).map(labelOf), ['角色', '提供方', '模型', '思考强度', '来源']);

  const rows = collect(host, byClass('stwd-tr')).filter((node) => node.props.className.indexOf('stwd-tr-head') < 0);
  assert.equal(rows.length, 8, 'one defaults row plus one row per role');
  assert.match(rows[0].props.className, /stwd-tr-default/);
  assert.equal(collect(host, (node) => node.type === 'select').length, 24, 'three route selects per row');

  const selects = collect(host, (node) => node.type === 'select');
  assert.equal(selects[0].props.value, '', 'the defaults provider inherits the parent agent');
  const backend = selects.slice(9, 12);
  assert.deepEqual(backend.map((node) => node.props.value), ['ctaigw', 'glm-5.3', 'high'], 'a configured role carries its own route');
  const options = collect(host, (node) => node.type === 'option').map(labelOf);
  assert.ok(options.includes('GLM 5.3'), `the live catalog feeds the model select (options: ${options.join(' | ')})`);

  const sources = collect(host, (node) => typeof node.props.className === 'string'
    && node.props.className.split(/\s+/).some((name) => name.indexOf('stwd-pill-src-') === 0));
  assert.ok(sources.length >= 8, 'every row shows where its route comes from');
  assert.ok(sources.some((node) => node.props.className.indexOf('stwd-pill-src-role') >= 0), 'the configured role is marked as custom');
  assert.ok(sources.some((node) => node.props.className.indexOf('stwd-pill-src-inherit') >= 0), 'unconfigured roles are marked as inherited');

  const toolbar = collect(host, byClass('stwd-toolbar'));
  assert.equal(toolbar.length, 1, 'one save toolbar');
  assert.match(textOf(toolbar[0]), /已同步/, 'an untouched form reports itself in sync');
  const save = collect(toolbar, (node) => node.type === 'button' && node.props.className.indexOf('stwd-btn-primary') >= 0)[0];
  assert.ok(save, 'the primary save action is present');
  assert.equal(save.props.disabled, true, 'save is disabled until something changes');
});

/**
 * The stylesheet is the one dependency the panel shares with the host: every
 * `--dsw-*` reference must be a real theme token, tokens outside the published
 * alias catalog must carry a fallback, and every selector must stay scoped.
 */
test('the board stylesheet stays scoped and uses only host theme tokens', async () => {
  const { factory } = await loadClientFactory();
  const source = readFileSync(new URL('../../../dsh/client.js', import.meta.url), 'utf8');

  // Published by `cordis_inspect_query` Theme.listTokens on this host.
  const catalog = new Set([
    '--dsw-alias-bg-base',
    '--dsw-alias-bg-layer-1',
    '--dsw-alias-bg-layer-2',
    '--dsw-alias-bg-overlay',
    '--dsw-alias-border-l1',
    '--dsw-alias-border-l2',
    '--dsw-alias-brand-primary',
    '--dsw-alias-label-primary',
    '--dsw-alias-label-secondary',
    '--dsw-alias-state-error-primary',
    '--dsw-alias-state-idle-primary',
    '--dsw-alias-state-success-primary',
    '--dsw-alias-state-warn-primary',
    '--dsw-specific-sidebar-fill',
  ]);
  // Named in the client bundles of the shipped host packages (Agent Teams panel,
  // Plugin Manager page, right Sidebar).
  const nativeExtras = new Set([
    '--dsw-alias-label-tertiary',
    '--dsw-alias-label-caption',
    '--dsw-alias-border-l3',
    '--dsw-alias-border-l4',
    '--dsw-alias-bg-layer-3',
    '--dsw-alias-bg-module-platform',
    '--dsw-alias-interactive-bg-hover',
    '--dsw-alias-interactive-bg-active',
    '--dsw-alias-state-business-primary',
    '--dsw-alias-state-business-tertiary',
    '--dsw-alias-button-primary-fill',
    '--dsw-alias-label-primary-foreground',
    '--dsw-elevation-panel',
    '--dsw-elevation-prominent',
    '--dsw-elevation-stroke',
    '--dsw-elevation-stroke-color',
    '--dsw-focus-ring-color',
  ]);

  const used = new Set([...source.matchAll(/--dsw-[a-z0-9-]+/g)].map((match) => match[0]));
  assert.ok(used.size > 10, 'the board must be styled with theme tokens');

  const unknown = [...used].filter((token) => !catalog.has(token) && !nativeExtras.has(token));
  assert.deepEqual(unknown, [], `unknown theme tokens: ${unknown.join(', ')}`);

  // Anything the Theme catalog does not publish needs a fallback in every var() use.
  for (const token of used) {
    if (catalog.has(token)) continue;
    const bare = new RegExp('var\\(' + token + '\\s*\\)');
    assert.doesNotMatch(source, bare, `${token} needs a fallback: var(${token}, …)`);
    const withFallback = new RegExp('var\\(' + token + '\\s*,');
    assert.match(source, withFallback, `${token} is never given a fallback value`);
  }

  const literals = [...source.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((match) => match[0].toLowerCase());
  const colors = literals.filter((value) => value !== '#fff');
  assert.deepEqual(colors, [], `literal colors are artwork-only, found: ${colors.join(', ')}`);

  // Render the panel and read the stylesheet it ships: scoped, balanced, host scale.
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  const { ctx, registered } = createClientContext();
  instance.apply(ctx);
  const entry = boardEntry(registered);
  const face = entry.options.inject('session-style');
  const tree = entry.component({ ...face, sessionId: 'session-style', loadRun: async () => ({ status: 'empty', dir: '', run: null, plan: null, artifacts: [] }) });

  const collectStyles = (element, found = []) => {
    if (element === null || element === undefined) return found;
    if (typeof element !== 'object') return found;
    if (Array.isArray(element)) {
      for (const item of element) collectStyles(item, found);
      return found;
    }
    if (element.type === 'style') {
      found.push(element);
      return found;
    }
    if (typeof element.type === 'function') {
      return collectStyles(element.type.prototype instanceof harness.stub.Component
        ? new element.type(element.props).render()
        : element.type(element.props), found);
    }
    for (const child of element.children || []) collectStyles(child, found);
    return found;
  };

  const styleNodes = collectStyles(tree);
  assert.ok(styleNodes.length >= 1, 'the board ships its own stylesheet');
  const css = styleNodes[0].children.join('\n');
  assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length, 'stylesheet braces must balance');
  assert.doesNotMatch(css, /;;/, 'stylesheet must not carry empty declarations');
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...withoutComments.matchAll(/([^{}]+)\{/g)].map((match) => match[1].trim());
  const KEYFRAME_STEP = /^(from|to|\d+%)(,\s*(from|to|\d+%))*$/;
  const unscoped = selectors.filter((selector) => selector !== ''
    && selector.charAt(0) !== '@'
    && !KEYFRAME_STEP.test(selector)
    && selector.indexOf('.stwd-') < 0);
  assert.deepEqual(unscoped, [], `styles must stay scoped to the plugin prefix: ${unscoped.join(' | ')}`);
  for (const needle of ['font-size:14px', 'font-size:11px', 'border:.5px', 'overflow-y:auto']) {
    assert.ok(css.includes(needle), `styles must keep the host scale, missing ${needle}`);
  }
});

