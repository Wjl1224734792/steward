/**
 * DSH 侧 Steward 插件（生成物 dsh/）的宿主契约测试。
 *
 * 覆盖 DSH 原生机制：
 *  - host-only：一个 `steward_dispatch` 工具 + `/steward` 命令 + 6 个技能，没有 Config、没有浏览器半
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
  assert.deepEqual(bucket.state.commands.map((command) => command.name), ['steward']);
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

test('/steward reports the roster and the routing rule without publishing modes', async () => {
  const bucket = await boot();
  const command = bucket.state.commands.find((entry) => entry.name === 'steward');
  const result = command.handler({ rawInput: 'roles' });
  assert.equal(result.kind, 'success');
  assert.match(result.text, /architect（架构师）/);
  assert.match(result.text, /组合 `standard`/);
  assert.match(result.text, /steward\.config\.json/);
  assert.match(result.text, /steward_dispatch/);
  assert.match(result.text, /不注册 Agent Preset/);
  assert.doesNotMatch(result.text, /steward-architect/);
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

test('the client bundle registers the page, its sidebar entry and the settings section', async () => {
  const { id, factory } = await loadClientFactory();
  assert.equal(id, 'dsh-steward');

  const reactStub = {
    createElement: (type, props, ...children) => {
      const merged = { ...(props || {}) };
      if (children.length === 1) merged.children = children[0];
      else if (children.length > 1) merged.children = children;
      return { type, props: merged, children };
    },
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useEffect: () => {},
    useMemo: (factory) => factory(),
    useRef: (init) => ({ current: init }),
    useCallback: (fn) => fn,
    Component: class {
      constructor(props) {
        this.props = props;
        this.state = {};
      }
    },
  };
  const instance = factory((name) => (name === 'react' ? reactStub : {}));
  assert.deepEqual(instance.inject, ['slots', 'locale', 'remote', 'remote.session', 'configForms', 'uiWorkspace']);

  const registered = [];
  const ctx = {
    slots: {
      inject: (name, callback) => callback(),
      register: (options, component) => {
        registered.push({ options, component });
        return () => {};
      },
    },
    locale: { getLocale: () => ({ id: 'zh-CN' }) },
    remote: { session: { modelCatalog: async () => ({ ok: true, value: { groups: [] } }) } },
    configForms: {
      get: () => ({
        getSnapshot: () => ({ status: 'loading' }),
        subscribe: () => () => {},
        mutate: async () => true,
      }),
    },
    uiWorkspace: { openSession: () => {} },
    effect: (callback) => {
      callback();
    },
  };
  instance.apply(ctx);

  assert.deepEqual(registered.map((entry) => entry.options.name), ['main', 'sidebar.panellist', 'settings.section']);
  assert.equal(registered[0].options.key, 'steward');
  assert.equal(registered[1].options.id, 'steward');

  /** Expand function/class components until only host elements remain. */
  const renderTree = (element) => {
    if (element === null || element === undefined) return '';
    if (typeof element !== 'object') return String(element);
    if (Array.isArray(element)) return element.map(renderTree).join('');
    const type = element.type;
    if (type === 'style') return '';
    if (typeof type === 'function') {
      if (type.prototype instanceof reactStub.Component) {
        const instance = new type(element.props);
        return renderTree(instance.render());
      }
      return renderTree(type(element.props));
    }
    return (element.children || []).map(renderTree).join('');
  };

  /** Collect host elements whose className list matches, in document order. */
  const collectByClass = (element, matcher, found = []) => {
    if (element === null || element === undefined) return found;
    if (typeof element !== 'object') return found;
    if (Array.isArray(element)) {
      for (const item of element) collectByClass(item, matcher, found);
      return found;
    }
    const type = element.type;
    if (type === 'style') return found;
    if (typeof type === 'function') {
      if (type.prototype instanceof reactStub.Component) {
        return collectByClass(new type(element.props).render(), matcher, found);
      }
      return collectByClass(type(element.props), matcher, found);
    }
    const className = element.props && element.props.className;
    if (typeof className === 'string' && matcher(className.split(/\s+/))) found.push(element);
    for (const child of element.children || []) collectByClass(child, matcher, found);
    return found;
  };

  const hasClass = (name) => (classes) => classes.indexOf(name) >= 0;

  /** Collect host elements of one tag, in document order. */
  const collectTag = (element, tag, found = []) => {
    if (element === null || element === undefined) return found;
    if (typeof element !== 'object') return found;
    if (Array.isArray(element)) {
      for (const item of element) collectTag(item, tag, found);
      return found;
    }
    const type = element.type;
    if (typeof type === 'function') {
      if (type.prototype instanceof reactStub.Component) {
        return collectTag(new type(element.props).render(), tag, found);
      }
      return collectTag(type(element.props), tag, found);
    }
    if (type === tag) found.push(element);
    for (const child of element.children || []) collectTag(child, tag, found);
    return found;
  };

  // Rendering the page without team data must explain the empty state, not throw.
  const page = registered[0].component({ useSessions: () => undefined, useSessionStatus: () => undefined });
  const flat = renderTree(page);
  assert.match(flat, /Steward 团队/);
  assert.match(flat, /还没有共享任务板/);
  assert.match(flat, /子代理（steward_dispatch）/);
  assert.equal(collectByClass(page, hasClass('stwd-tab')).length, 0, 'no team means no switcher');
  assert.equal(collectByClass(page, hasClass('stwd-gate')).length, 0, 'no gate rail without gate tasks');

  // The English dictionary must cover the same page: render it with an en-US locale.
  const enRegistered = [];
  const enInstance = factory((name) => (name === 'react' ? reactStub : {}));
  enInstance.apply({
    ...ctx,
    locale: { getLocale: () => ({ id: 'en-US' }) },
    slots: {
      inject: (name, callback) => callback(),
      register: (options, component) => { enRegistered.push({ options, component }); return () => {}; },
    },
  });
  const enFlat = renderTree(enRegistered[0].component({ useSessions: () => undefined, useSessionStatus: () => undefined }));
  assert.match(enFlat, /Steward team/, 'the page title is localized');
  assert.match(enFlat, /No shared task board yet/, 'the empty state is localized');
  assert.match(enFlat, /Subagents \(steward_dispatch\)/, 'section titles are localized');
  assert.match(enFlat, /Subagent models and reasoning effort/, 'the configuration section is localized');

  // Regression: the live host returns `modelSelection.next = null` for members
  // that never picked a model. Reading `.provider` off that null used to blank
  // the whole slot; the card must degrade to the inherited label instead.
  const teamState = {
    projectionsBySession: {
      'session-lead': {
        values: {
          agentTeam: {
            members: [{ id: 'child-1', name: 'backend-dev-t1', phase: 'active' }],
            tasks: [{
              id: 't1',
              subject: 'T1 · backend-dev · 实现导出',
              status: 'pending',
              ownerName: 'backend-dev-t1',
              blockedBy: [],
              writeScopes: ['src/export.ts'],
              writeScopeWarnings: [],
              ready: true,
            }],
          },
        },
      },
      'child-1': { values: { modelSelection: { next: null } } },
      'session-lead-2': { values: { subagentCatalog: [{ id: 'child-9', mode: 'spawn', activity: 'running' }] } },
    },
  };
  const withTeam = registered[0].component({
    useSessions: (selector) => selector(teamState),
    useSessionStatus: () => undefined,
  });
  const flatTeam = renderTree(withTeam);
  assert.match(flatTeam, /backend-dev-t1/);
  assert.match(flatTeam, /继承主代理/, 'a null route must fall back to the inherited label');
  assert.match(flatTeam, /child-9/, 'solo subagents come from the subagentCatalog projection');
  assert.doesNotMatch(flatTeam, /团队 · session-/, 'the team label must strip the raw session- prefix');
  assert.doesNotMatch(flatTeam, /[⛔▶○]/, 'task state is a dot plus a label, never an emoji glyph');
  assert.equal(collectByClass(withTeam, hasClass('stwd-tab')).length, 0, 'one team means no switcher');
  // The board is a dependency graph by default, not a list of rows.
  const singleNodes = collectByClass(withTeam, hasClass('stwd-node'));
  assert.equal(singleNodes.length, 1, 'one task renders one graph node');
  assert.match(String(singleNodes[0].props['aria-label']), /T1 · backend-dev · 实现导出/, 'the node names the whole task');
  assert.equal(collectByClass(withTeam, hasClass('stwd-viewtab')).length, 3, 'three board views are offered');
  assert.equal(collectByClass(withTeam, hasClass('stwd-seg')).length, 1, 'one progress segment per task');
  assert.equal(collectByClass(withTeam, hasClass('stwd-legend-item')).length, 4, 'the legend names every state');
  assert.equal(collectByClass(withTeam, hasClass('stwd-rail-lead')).length, 1, 'the rail carries the lead');
  assert.equal(collectByClass(withTeam, hasClass('stwd-matrix')).length, 0, 'the graph is the default view, not the matrix');

  // Two teams: one tab strip, still exactly one expanded roster, gates in step order.
  const twoTeamState = {
    projectionsBySession: {
      'session-aaa11111': {
        values: {
          agentTeam: {
            members: [{ id: 'child-a', name: 'pm-a', phase: 'active' }],
            tasks: [
              { id: 'g1', subject: 'G1 · 计划批准', status: 'completed', ownerName: '', blockedBy: [], writeScopes: [], writeScopeWarnings: [] },
              { id: 'g2', subject: 'G2 · QA 门禁', status: 'pending', ownerName: '', blockedBy: ['g1'], writeScopes: [], writeScopeWarnings: [], ready: false },
              { id: 't1', subject: 'T1 · backend-dev · 实现导出', status: 'in_progress', ownerName: 'pm-a', blockedBy: ['g1'], writeScopes: ['src/export.ts'], writeScopeWarnings: [] },
              { id: 't2', subject: 'T2 · qa-engineer · 补单测', status: 'pending', ownerName: '', blockedBy: ['t1'], writeScopes: [], writeScopeWarnings: [], ready: false },
            ],
          },
        },
      },
      'session-bbb22222': {
        values: {
          agentTeam: {
            members: [{ id: 'child-b', name: 'reviewer-b', phase: 'active' }],
            tasks: [],
          },
        },
      },
    },
  };
  const twoTeams = registered[0].component({
    useSessions: (selector) => selector(twoTeamState),
    useSessionStatus: () => undefined,
  });
  const flatTwo = renderTree(twoTeams);
  assert.equal(collectByClass(twoTeams, hasClass('stwd-tab')).length, 2, 'two teams produce two tabs');
  assert.equal(collectByClass(twoTeams, hasClass('stwd-rail-lead')).length, 1, 'only the active team is expanded');
  assert.match(flatTwo, /aaa1111/, 'the tab label is the session tail, not the raw id');
  const twoNodes = collectByClass(twoTeams, hasClass('stwd-node'));
  assert.equal(twoNodes.length, 4, 'every task is a node');
  const nodeLabels = twoNodes.map((node) => String(node.props['aria-label']).split(' ')[0]).sort();
  assert.deepEqual(nodeLabels, ['G1', 'G2', 'T1', 'T2'], 'nodes carry their short plan labels');
  assert.equal(collectByClass(twoTeams, hasClass('stwd-edge')).length, 3, 'one edge per dependency');
  const xOf = (label) => {
    const node = twoNodes.find((entry) => String(entry.props['aria-label']).indexOf(label + ' ') === 0);
    const match = /translate\(([-\d.]+)/.exec(String(node.props.transform));
    return Number(match ? match[1] : NaN);
  };
  assert.ok(xOf('G1') < xOf('T1'), 'a dependency sits left of its dependant');
  assert.ok(xOf('T1') < xOf('T2'), 'the chained work item sits one layer further right');
  assert.match(flatTwo, /阻塞/, 'blocked work is labelled, not conveyed by color alone');
  assert.match(flatTwo, /进行中/);
  assert.match(flatTwo, /pm-a/);
  assert.doesNotMatch(flatTwo, /session-bbb22222/, 'the collapsed team is not rendered as a panel');

  // The stylesheet is the one dependency this panel shares with the host: it has to
  // stay scoped to `.stwd-` (never leak into host UI), balanced, and on the host's
  // scale — 20px page title, 14px section title, 11px meta, .5px hairlines, 960px column.
  const styleNodes = collectTag(page, 'style');
  assert.equal(styleNodes.length, 1, 'the page renders exactly one stylesheet');
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
  for (const needle of ['font-size:20px', 'line-height:28px', 'font-size:14px', 'font-size:11px', 'border:.5px', 'max-width:960px']) {
    assert.ok(css.includes(needle), `styles must keep the host scale, missing ${needle}`);
  }

  const settings = renderTree(registered[2].component({}));
  assert.match(settings, /正在读取原生设置服务|子代理模型与思考强度|默认配置/);
});

/**
 * The panel stylesheet is the only shared styling dependency with the host: every
 * `--dsw-*` reference must be a real theme token, and tokens outside the published
 * alias catalog must carry a CSS fallback so a renamed token degrades instead of
 * blanking a color.
 */
test('the panel stylesheet uses only host theme tokens, with fallbacks outside the catalog', async () => {
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
  // Plugin Manager page) and of the two mature third-party panels in this profile.
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
  assert.ok(used.size > 10, 'the panel must be styled with theme tokens');

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
});

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
 * The configuration surface is the densest part of the panel. Render it against a
 * settled native settings snapshot plus a live model catalog and assert the table
 * shape: column headers, the defaults row, one row per role, three selects each.
 */
test('the configuration surface renders as a table with a defaults row and one row per role', async () => {
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
  const registered = [];
  instance.apply({
    slots: {
      inject: (name, callback) => callback(),
      register: (options, component) => { registered.push({ options, component }); return () => {}; },
    },
    locale: { getLocale: () => ({ id: 'zh-CN' }) },
    remote: { session: { modelCatalog: async () => catalog } },
    configForms: { get: () => ({ getSnapshot: () => snapshot, subscribe: () => () => {}, mutate: async () => true }) },
    uiWorkspace: { openSession: () => {} },
    effect: (callback) => { callback(); },
  });

  const { collect, labelOf, textOf, byClass } = harness;
  const host = await harness.settle(() => registered[2].component({}));

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
 * The board is the point of the panel: a layered dependency graph by default, an
 * ownership matrix for file conflicts, and the row list as the complete text
 * alternative. Drive the switch through real click props.
 */
test('the board renders a dependency graph, an ownership matrix and a list', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  const registered = [];
  instance.apply({
    slots: {
      inject: (name, callback) => callback(),
      register: (options, component) => { registered.push({ options, component }); return () => {}; },
    },
    locale: { getLocale: () => ({ id: 'zh-CN' }) },
    remote: { session: { modelCatalog: async () => ({ ok: true, value: { groups: [] } }) } },
    configForms: { get: () => ({ getSnapshot: () => ({ status: 'loading' }), subscribe: () => () => {}, mutate: async () => true }) },
    uiWorkspace: { openSession: () => {} },
    effect: (callback) => { callback(); },
  });

  const state = {
    projectionsBySession: {
      'session-run01': {
        values: {
          agentTeam: {
            members: [
              { id: 'child-a', name: 'backend-dev-t1', phase: 'active' },
              { id: 'child-b', name: 'frontend-dev-t3', phase: 'active' },
            ],
            tasks: [
              { id: 'g1', subject: 'G1 · 计划批准', status: 'completed', ownerName: '', blockedBy: [], writeScopes: [], writeScopeWarnings: [] },
              { id: 't1', subject: 'T1 · backend-dev · 导出接口', status: 'in_progress', ownerName: 'backend-dev-t1', blockedBy: ['g1'], writeScopes: ['src/export.ts', 'test/export.test.ts'], writeScopeWarnings: [] },
              { id: 't2', subject: 'T2 · frontend-dev · 导出按钮', status: 'pending', ownerName: 'frontend-dev-t3', blockedBy: ['g1'], writeScopes: ['test/export.test.ts'], writeScopeWarnings: [], ready: true },
              { id: 'g2', subject: 'G2 · QA 门禁', status: 'pending', ownerName: '', blockedBy: ['t1', 't2'], writeScopes: [], writeScopeWarnings: [], ready: false },
            ],
          },
        },
      },
    },
  };
  const pageProps = { useSessions: (selector) => selector(state), useSessionStatus: () => undefined };
  const renderPage = () => registered[0].component(pageProps);

  // 1) Default view: the dependency graph.
  let host = await harness.settle(renderPage);
  const nodes = harness.collect(host, harness.byClass('stwd-node'));
  assert.equal(nodes.length, 4, 'every task is a graph node');
  assert.equal(harness.collect(host, harness.byClass('stwd-edge')).length, 4, 'one edge per dependency');
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
  assert.equal(harness.collect(host, harness.byClass('stwd-rail-lead')).length, 1, 'the rail shows the lead');
  assert.equal(harness.collect(host, harness.byClass('stwd-rail-member')).length, 2, 'the rail shows every member');

  // 2) Ownership matrix: the file both agents write is flagged as overlapping.
  const viewTabs = harness.collect(host, harness.byClass('stwd-viewtab'));
  assert.deepEqual(viewTabs.map(harness.textOf), ['依赖图', '归属矩阵', '列表']);
  viewTabs[1].props.onClick();
  host = await harness.settle(renderPage);
  const table = harness.collect(host, (node) => node.type === 'table')[0];
  assert.ok(table, 'the matrix is a real table');
  const columnHeads = harness.collect([table], (node) => node.type === 'th' && node.props.scope === 'col').map(harness.textOf);
  assert.ok(columnHeads.some((cell) => cell.indexOf('backend-dev-t1') >= 0), 'one column per agent');
  const overlapRows = harness.collect(host, (node) => typeof node.props.className === 'string' && node.props.className.indexOf('stwd-matrix-row-overlap') >= 0);
  assert.equal(overlapRows.length, 1, 'only the shared file is flagged');
  assert.match(harness.textOf(overlapRows[0]), /test\/export\.test\.ts/);
  assert.equal(harness.collect(host, harness.byClass('stwd-node')).length, 0, 'the graph is replaced, not stacked');

  // 3) List: the complete text alternative, one row per task.
  const listTabs = harness.collect(host, harness.byClass('stwd-viewtab'));
  listTabs[2].props.onClick();
  host = await harness.settle(renderPage);
  const rows = harness.collect(host, harness.byClass('stwd-row'));
  assert.equal(rows.length, 4, 'one row per task');
  assert.match(harness.textOf(rows[1]), /T1 · backend-dev · 导出接口/, 'the row carries the whole title');
  assert.match(harness.textOf(rows[1]), /进行中/);
});

/**
 * Model settings and the solo dispatch list share one tabbed footer: the model table
 * is the default pane, both panes stay mounted (an unsaved draft survives a switch),
 * and the solo list is capped with an explicit "show more".
 */
test('the footer tabs switch between the model table and a capped solo list', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  const registered = [];
  const snapshot = {
    status: 'ready',
    writable: true,
    revision: 2,
    value: { defaults: { provider: '', model: '', effort: '' }, roles: {} },
  };
  const catalog = {
    ok: true,
    value: {
      groups: [
        { id: 'ctaigw', name: 'CTAIGW', models: [{ id: 'glm-5.3', name: 'GLM 5.3', reasoning: { efforts: [{ id: 'high', name: 'High' }] } }] },
      ],
    },
  };
  instance.apply({
    slots: {
      inject: (name, callback) => callback(),
      register: (options, component) => { registered.push({ options, component }); return () => {}; },
    },
    locale: { getLocale: () => ({ id: 'zh-CN' }) },
    remote: { session: { modelCatalog: async () => catalog } },
    configForms: { get: () => ({ getSnapshot: () => snapshot, subscribe: () => () => {}, mutate: async () => true }) },
    uiWorkspace: { openSession: () => {} },
    effect: (callback) => { callback(); },
  });

  const solo = Array.from({ length: 8 }, (_, index) => ({
    id: 'child-solo-' + (index + 1),
    name: 'backend-dev-solo-' + (index + 1),
    mode: 'spawn',
    activity: index === 0 ? 'running' : 'idle',
  }));
  const state = {
    projectionsBySession: {
      'session-run02': {
        values: {
          agentTeam: {
            members: [{ id: 'child-a', name: 'backend-dev-t1', phase: 'active' }],
            tasks: [{ id: 't1', subject: 'T1 · backend-dev · 实现导出', status: 'in_progress', ownerName: 'backend-dev-t1', blockedBy: [], writeScopes: ['src/export.ts'], writeScopeWarnings: [] }],
          },
        },
      },
      'session-solo02': { values: { subagentCatalog: solo } },
    },
  };
  const renderPage = () => registered[0].component({ useSessions: (selector) => selector(state), useSessionStatus: () => undefined });

  let host = await harness.settle(renderPage);

  // Two panes, the model table selected by default.
  const tabs = harness.collect(host, harness.byClass('stwd-ftab'));
  assert.equal(tabs.length, 2, 'the footer offers exactly two panes');
  assert.match(harness.textOf(tabs[0]), /子代理模型与思考强度/, 'the first pane is the model table');
  assert.match(harness.textOf(tabs[1]), /子代理（steward_dispatch）/, 'the second pane is the solo list');
  assert.match(harness.textOf(tabs[1]), /8/, 'and it carries the count');
  assert.equal(tabs[0].props['aria-selected'], 'true', 'the model table is the default pane');
  assert.equal(tabs[1].props['aria-selected'], 'false');
  const panes = harness.collect(host, harness.byClass('stwd-tabpanel'));
  assert.equal(panes.length, 2, 'both panes stay mounted');
  const configPane = panes.find((pane) => pane.props.id === 'stwd-pane-config');
  const soloPane = panes.find((pane) => pane.props.id === 'stwd-pane-solo');
  assert.equal(configPane.props.hidden, false, 'the model table is visible');
  assert.equal(soloPane.props.hidden, true, 'the solo list is hidden until its tab is chosen');
  assert.equal(harness.collect(host, harness.byClass('stwd-tr')).length, 9, 'the model table renders in the default pane');

  // The solo list is capped: six rows plus an explicit "show more".
  tabs[1].props.onClick();
  host = await harness.settle(renderPage);
  const soloRows = () => harness.collect(host, harness.byClass('stwd-row'));
  assert.equal(soloRows().length, 6, 'the solo list shows one page at a time');
  const more = harness.collect(host, (node) => node.type === 'button' && harness.textOf(node).indexOf('显示更多') === 0)[0];
  assert.ok(more, 'a show-more control continues the list');
  more.props.onClick();
  host = await harness.settle(renderPage);
  assert.equal(soloRows().length, 8, 'show more reveals the remaining rows');
  const collapse = harness.collect(host, (node) => node.type === 'button' && harness.textOf(node) === '收起')[0];
  assert.ok(collapse, 'the expanded list can be collapsed again');
  collapse.props.onClick();
  host = await harness.settle(renderPage);
  assert.equal(soloRows().length, 6, 'collapsing returns to the first page');

  // An unsaved route edit survives switching panes.
  const backTabs = harness.collect(host, harness.byClass('stwd-ftab'));
  backTabs[0].props.onClick();
  host = await harness.settle(renderPage);
  const providerSelect = harness.collect(host, (node) => node.type === 'select')[0];
  providerSelect.props.onChange({ target: { value: 'ctaigw' } });
  host = await harness.settle(renderPage);
  const afterEdit = harness.collect(host, (node) => node.type === 'select')[0];
  assert.equal(afterEdit.props.value, 'ctaigw', 'the edit is staged in the table');
  const soloTab = harness.collect(host, harness.byClass('stwd-ftab'))[1];
  soloTab.props.onClick();
  host = await harness.settle(renderPage);
  harness.collect(host, harness.byClass('stwd-ftab'))[0].props.onClick();
  host = await harness.settle(renderPage);
  const afterSwitch = harness.collect(host, (node) => node.type === 'select')[0];
  assert.equal(afterSwitch.props.value, 'ctaigw', 'an unsaved draft survives a tab switch');
  assert.match(harness.textOf(harness.collect(host, harness.byClass('stwd-toolbar'))[0]), /有未保存修改/);
});

/**
 * A cyclic board cannot be layered: the panel must fall back to the list and say
 * why instead of drawing a broken graph.
 */
test('a cyclic board falls back to the list with an explanation', async () => {
  const { factory } = await loadClientFactory();
  // Stateless on purpose: the list fallback is derived during render
  // (`view === 'dag' && cycle`), so no state has to survive a pass here.
  const harness = createRenderHarness({ stateless: true });
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  const registered = [];
  instance.apply({
    slots: {
      inject: (name, callback) => callback(),
      register: (options, component) => { registered.push({ options, component }); return () => {}; },
    },
    locale: { getLocale: () => ({ id: 'zh-CN' }) },
    remote: { session: { modelCatalog: async () => ({ ok: true, value: { groups: [] } }) } },
    configForms: { get: () => ({ getSnapshot: () => ({ status: 'loading' }), subscribe: () => () => {}, mutate: async () => true }) },
    uiWorkspace: { openSession: () => {} },
    effect: (callback) => { callback(); },
  });

  const state = {
    projectionsBySession: {
      'session-cycle': {
        values: {
          agentTeam: {
            members: [{ id: 'child-a', name: 'backend-dev-t1', phase: 'active' }],
            tasks: [
              { id: 't1', subject: 'T1 · backend-dev · 甲', status: 'pending', ownerName: 'backend-dev-t1', blockedBy: ['t2'], writeScopes: [], writeScopeWarnings: [] },
              { id: 't2', subject: 'T2 · backend-dev · 乙', status: 'pending', ownerName: 'backend-dev-t1', blockedBy: ['t1'], writeScopes: [], writeScopeWarnings: [] },
            ],
          },
        },
      },
    },
  };

  const host = await harness.settle(() => registered[0].component({
    useSessions: (selector) => selector(state),
    useSessionStatus: () => undefined,
  }));

  assert.equal(harness.collect(host, harness.byClass('stwd-node')).length, 0, 'no layered graph for a cyclic board');
  assert.equal(harness.collect(host, harness.byClass('stwd-row')).length, 2, 'the list takes over');
  const alerts = harness.collect(host, harness.byClass('stwd-alert')).map(harness.textOf);
  assert.ok(alerts.some((text) => text.indexOf('环状依赖') >= 0), `the panel explains the cycle (alerts: ${alerts.join(' | ')})`);
});



