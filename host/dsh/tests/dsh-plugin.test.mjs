/**
 * DSH 侧 Steward 插件（生成物 dsh/）的宿主契约测试。
 *
 * 覆盖 DSH 原生机制：
 *  - host-only：两个工具（`steward_dispatch` / `steward_board`）+ `/steward-roster` 名册命令 + 13 个技能，没有 Config、没有浏览器半
 *  - docTier=3 时 `steward_dispatch` 校验文档收据（`.steward/docs-state.json`），未过门禁拒绝派开发
 *  - 角色是派单时注入的章程，**不注册 Agent Preset**（模式选择器必须保持干净）
 *  - 模型路由只来自项目 `steward.config.json` 的 `modelRouting.<role>`，缺失则继承主代理
 *  - 子代理固定以内置 `standard` 组合启动；缺失/损坏时拒绝派发
 *
 * 不启动宿主：用假 ctx 驱动 apply()。
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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
    'docs-feature',
    'docs-governance',
    'docs-new',
    'docs-review',
    'docs-rules',
    'docs-takeover',
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

test('the main skill points at the split-out inline, docs-rules and the four documentation entries', async () => {
  const bucket = await boot();
  const main = bucket.state.skills.find((skill) => skill.name === 'steward');
  assert.match(main.content, /加载 `inline` 技能/);
  assert.match(main.content, /`docs-new`/);
  assert.match(main.content, /`docs-rules`/);
  // The extracted sections moved out of the main body.
  assert.doesNotMatch(main.content, /^## 执行模式（/m);
  assert.doesNotMatch(main.content, /^## 文档流水线（/m);
  const inline = bucket.state.skills.find((skill) => skill.name === 'inline');
  assert.match(inline.content, /^## 执行模式（/m);
  assert.match(inline.content, /inline 的硬动作|硬动作/);
  // docs-rules is the rules library, not an entry: it keeps the pipeline sections
  // and says so in its own body.
  const rules = bucket.state.skills.find((skill) => skill.name === 'docs-rules');
  assert.match(rules.content, /^## T3 文档按需升级（/m);
  assert.match(rules.content, /^## 文档流水线（/m);
  assert.match(rules.content, /不是入口/);
  // The four entries point at the readiness gate instead of repeating the pipeline.
  for (const [name, needle] of [
    ['docs-new', /docs-ready\.mjs/],
    ['docs-takeover', /docs-ready\.mjs/],
    ['docs-feature', /docs-ready\.mjs/],
    ['docs-review', /docs-ready\.mjs/],
  ]) {
    const skill = bucket.state.skills.find((entry) => entry.name === name);
    assert.match(skill.content, needle, `${name} must route through the readiness gate`);
  }
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

// --- documentation gate (docTier=3) ------------------------------------------------

const DOCS_READY = new URL('../../../dsh/scripts/docs-ready.mjs', import.meta.url);
const DOC_REVIEW_REL = 'docs/07-治理/评审记录/评审记录-20261116-契约.md';

const DOC_API = `# API 接口契约

## 基础约定

- BaseURL：/api
- 认证：Bearer token，权限主体一律从凭据解析，不信任请求体
- 统一信封：{ code, data, message }
- 分页：page / pageSize，默认 20，最大 200

## 错误码号段

| 号段 | 含义 |
|---|---|
| 4001 | 参数校验失败 |
| 4002 | 权限不足 |
| 4003 | 资源不存在 |

## 端点清单

| 方法 | 路径 | 入参 | 出参 | 错误码 | 权限 |
|---|---|---|---|---|---|
| GET | /api/items | q、page | list | 4001 | read |
| POST | /api/items | body | item | 4001、4002 | write |
| DELETE | /api/items/:id | id | null | 4003 | write |

## 变更纪律

改端点必须同批更新本文档与版本修订记录；错误码只增不删，废弃号段保留并标注。
`;

const DOC_MODEL = `# 数据模型

## ER 总览

- items：主表，含 tenant_id 行级隔离字段
- item_logs：审计表，只追加

## DDL

| 表 | 字段 | 类型 | 约束 |
|---|---|---|---|
| items | id | uuid | pk |
| items | tenant_id | uuid | 非空，行级隔离 |
| items | code | varchar(64) | 非空 |
| items | deleted_at | timestamptz | 软删，进唯一约束 |
| item_logs | id | bigserial | pk |
| item_logs | item_id | uuid | 逻辑关联，不建物理外键 |

## 口径注释

唯一约束含 deleted_at：unique (tenant_id, code, deleted_at)。
审计表只追加不更新，PII 字段落库前脱敏，查询走索引并 EXPLAIN 验证。
`;

const DOC_REVIEW = `# 评审记录：契约冻结

## 结论（先行）

可进入开发。

<!-- docs-review:begin -->
{"status":"approved","blocking":0,"scope":"feature","reviewedAt":"2026-11-16T22:40:00+08:00"}
<!-- docs-review:end -->
`;

function docsReady(...args) {
  return spawnSync(process.execPath, [fileURLToPath(DOCS_READY), ...args], { encoding: 'utf8' });
}

function writeDoc(root, rel, text) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text, 'utf8');
}

/**
 * Build a docTier=3 project whose documentation receipt is green (or not).
 * @param {string} name directory name under the test work dir.
 * @param {{approve?: boolean}} [options] issue the receipt or leave it pending.
 */
function stageDocsProject(name, { approve = true } = {}) {
  const root = join(workDir, name);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'steward.config.json'), JSON.stringify({ docTier: 3 }, null, 2));
  const init = docsReady(root, 'init', '--scope', 'feature', '--require', '03-契约', '--write');
  assert.equal(init.status, 0, init.stderr);
  writeDoc(root, 'docs/03-契约/API接口.md', DOC_API);
  writeDoc(root, 'docs/03-契约/数据模型.md', DOC_MODEL);
  writeDoc(root, 'docs/07-治理/评审状态.md', '# 评审状态\n\n| 阶段 | 结论 | 日期 | 评审记录 |\n|---|---|---|---|\n| 契约 | 通过 | 2026-11-16 | 评审记录-20261116-契约.md |\n');
  writeDoc(root, DOC_REVIEW_REL, DOC_REVIEW);
  if (approve) {
    const res = docsReady(root, 'approve', '--review', DOC_REVIEW_REL);
    assert.equal(res.status, 0, `${res.stdout}${res.stderr}`);
  }
  return root;
}

test('docTier=3 blocks implementers until a documentation receipt exists', async () => {
  const bucket = await boot();
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');
  const root = join(workDir, 'docs-gate-none');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'steward.config.json'), JSON.stringify({ docTier: 3 }));

  await assert.rejects(
    () => tool.execute({ role: 'backend-dev', description: '实施', prompt: '写代码', cwd: root }, execFor()),
    /docs gate blocked/,
  );
  await assert.rejects(
    () => tool.execute({ role: 'frontend-dev', description: '实施', prompt: '写代码', cwd: root }, execFor()),
    /docs gate blocked/,
  );
  // Document authors and reviewers must stay dispatchable, otherwise nobody can
  // ever satisfy the gate.
  const architect = await tool.execute({ role: 'architect', description: '方案', prompt: '出方案', cwd: root }, execFor());
  assert.equal(architect.role, 'architect');
});

test('docTier=3 lets implementers through once the receipt is green', async () => {
  const bucket = await boot();
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');
  const root = stageDocsProject('docs-gate-green');

  const value = await tool.execute({ role: 'backend-dev', description: '实施', prompt: '写代码', cwd: root }, execFor());
  assert.equal(value.role, 'backend-dev');
  assert.equal(bucket.state.activations.length, 1);
});

test('editing a rule-bearing document turns the receipt stale and blocks again', async () => {
  const bucket = await boot();
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');
  const root = stageDocsProject('docs-gate-stale');
  writeDoc(root, 'docs/03-契约/API接口.md', `${DOC_API}\n新增一条口径变更。\n`);

  await assert.rejects(
    () => tool.execute({ role: 'backend-dev', description: '实施', prompt: '写代码', cwd: root }, execFor()),
    /E-STATE-STALE/,
  );
});

test('bookkeeping-only edits keep the receipt valid for implementers', async () => {
  const bucket = await boot();
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');
  const root = stageDocsProject('docs-gate-bookkeeping');
  writeDoc(root, 'docs/07-治理/执行步骤.md', '# 执行步骤\n\n| 项 | 状态 |\n|---|---|\n| T1 契约 | 完成 |\n');

  const value = await tool.execute({ role: 'backend-dev', description: '实施', prompt: '写代码', cwd: root }, execFor());
  assert.equal(value.role, 'backend-dev');
});

test('a hand-edited receipt without an approved review stays blocked', async () => {
  const bucket = await boot();
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');
  const root = stageDocsProject('docs-gate-forged', { approve: false });

  // Forge the flags but not the hash: the gate compares the receipt with the tree.
  const stateFile = join(root, '.steward/docs-state.json');
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  state.ok = true;
  state.review = { status: 'approved', record: DOC_REVIEW_REL, at: '2026-11-16T00:00:00Z' };
  writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

  await assert.rejects(
    () => tool.execute({ role: 'backend-dev', description: '实施', prompt: '写代码', cwd: root }, execFor()),
    /docs gate blocked/,
  );
});

test('docTier below 3 keeps the old dispatch behaviour', async () => {
  const bucket = await boot();
  const tool = bucket.state.tools.find((entry) => entry.name === 'steward_dispatch');
  const root = join(workDir, 'docs-gate-off');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'steward.config.json'), JSON.stringify({ docTier: 1 }));

  const value = await tool.execute({ role: 'backend-dev', description: '实施', prompt: '写代码', cwd: root }, execFor());
  assert.equal(value.role, 'backend-dev');
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
function panelEntry(registered) {
  const entry = registered.find((item) => item.options.name === 'sidebar.right.pane.tab');
  assert.ok(entry, 'the board body must register into sidebar.right.pane.tab');
  return entry;
}

/** Render the board for one Session with the given scope services. */
function panelRender(registered, sessionId, props) {
  const entry = panelEntry(registered);
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
  assert.match(tabTypes[0].title('sidebar://steward'), /团队/);
  assert.equal(tabTypes[0].guide.length, 1, 'the guide page offers a way in');
  assert.equal(tabTypes[0].guide[0].id, 'steward-board');

  // The empty panel explains itself instead of throwing.
  const renderEmpty = panelRender(registered, 'session-empty', {});
  const emptyHost = await harness.settle(renderEmpty);
  const emptyText = emptyHost.map((node) => harness.textOf(node)).join('\n');
  assert.match(emptyText, /Steward 团队/);
  assert.match(emptyText, /还没有派发智能体/);
  assert.match(emptyText, /原生任务列表为空/);
  assert.match(emptyText, /产物/);

  // The header button renders as a real control and calls the injected opener.
  const buttonEntry = registered[3];
  let opened = 0;
  const buttonHost = harness.expand(buttonEntry.component({ text: { openPanel: '打开 Steward 团队面板' }, openPanel: () => { opened += 1; } }));
  const buttons = harness.collect(buttonHost, harness.byClass('stwd-headbtn'));
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].props['aria-label'], '打开 Steward 团队面板');
  buttons[0].props.onClick();
  assert.equal(opened, 1);

  // The English dictionary covers the same surfaces.
  const enHarness = createRenderHarness();
  const enInstance = factory((name) => (name === 'react' ? enHarness.stub : {}));
  const en = createClientContext({ locale: 'en-US' });
  enInstance.apply(en.ctx);
  const enHost = await enHarness.settle(panelRender(en.registered, 'session-empty', {}));
  const enText = enHost.map((node) => enHarness.textOf(node)).join('\n');
  assert.match(enText, /Steward team/);
  assert.match(enText, /No agent dispatched/);
  assert.match(enText, /native task list is empty/);
});

/**
 * The first Steward dispatch in a Session opens the board once and only once: a
 * plain `subagent` call must not steal the panel, and closing it afterwards has to
 * stick for that Session.
 */
test('the panel opens itself once when a Steward dispatch appears', async () => {
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
test('the panel also opens when a run directory exists but the dispatch label carries no role', async () => {
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
/**
 * The graph is the point of the panel: one node per dispatched agent, connected to
 * the Lead, grouped into status lanes, and clickable into the child session.
 */
test('the panel draws one agent card per dispatch inside stage bands', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  const { ctx, registered } = createClientContext();
  instance.apply(ctx);

  const NOW = 1700000000000;
  const values = {
    subagentCatalog: [
      { id: 'child-run', mode: 'one-shot', label: 'backend-dev · T1 导出接口', createdAt: 1000 },
      { id: 'child-run2', mode: 'continuable', label: 'backend-dev · T2 导出按钮', createdAt: 1500 },
      { id: 'child-wait', mode: 'continuable', label: 'qa-engineer · T4 复跑门禁', createdAt: 2000 },
      { id: 'child-done', mode: 'one-shot', label: 'reviewer · T5 终审', createdAt: 3000 },
    ],
    agentTeam: {
      enabled: true,
      tasks: [
        { id: 'b1', subject: 'T1 · 实现导出接口', status: 'completed' },
        { id: 'b2', subject: 'T2 · 实现导出按钮', status: 'completed' },
        { id: 'b3', subject: 'T3 · QA 门禁', status: 'in_progress' },
        { id: 'b4', subject: 'T4 · 终审', status: 'pending', ready: false },
      ],
    },
  };
  const leadValues = {
    modelSelection: { lastUsed: { provider: 'deepseek', model: 'deepseek-v4.1', reasoningEffort: 'high' }, next: null },
    tokenUsage: { uncachedInputTokens: 1000, outputTokens: 300 },
    sessionStats: { turns: 4, steps: 11 },
  };
  const summaries = {
    'child-run': {
      title: 'T1 导出接口',
      projectionValues: {
        subagentTiming: { settledMs: 60000, active: { since: NOW - 222000, through: NOW } },
        tokenUsage: { uncachedInputTokens: 5000, outputTokens: 1400, cacheReadTokens: 2000, cacheWriteTokens: 0 },
        modelSelection: { lastUsed: { provider: 'deepseek', model: 'deepseek-v4.1', reasoningEffort: 'high' }, next: null },
      },
    },
    'child-run2': {
      title: 'T2 导出按钮',
      projectionValues: {
        subagentTiming: { settledMs: 45000, active: { since: NOW - 45000, through: NOW } },
        tokenUsage: { uncachedInputTokens: 2000, outputTokens: 600 },
        modelSelection: { lastUsed: { provider: 'deepseek', model: 'deepseek-chat' }, next: null },
      },
    },
    'child-wait': {
      title: 'T4 复跑门禁',
      projectionValues: {
        subagentTiming: { settledMs: 30000 },
        tokenUsage: { uncachedInputTokens: 1000, outputTokens: 200 },
        modelSelection: { lastUsed: { provider: 'deepseek', model: 'deepseek-chat' }, next: null },
      },
    },
    'child-done': {
      title: 'T5 终审',
      projectionValues: {
        subagentTiming: { settledMs: 90000, lastTurnCompleted: true },
        tokenUsage: { uncachedInputTokens: 3000, outputTokens: 700 },
        modelSelection: { lastUsed: { provider: 'deepseek', model: 'deepseek-v4.1', reasoningEffort: 'high' }, next: null },
      },
    },
  };
  const status = new Map([
    ['child-run', { running: true }],
    ['child-run2', { running: true }],
    ['child-wait', { running: true, pendingInteraction: { kind: 'question' } }],
    ['child-done', { running: false }],
  ]);
  const opened = [];
  const props = {
    now: () => NOW,
    loadRun: async () => ({ status: 'empty', dir: '', artifacts: [] }),
    useProjection: (key) => (key === 'subagentCatalog' ? values.subagentCatalog
      : key === 'agentTeam' ? values.agentTeam
        : key === 'modelSelection' ? leadValues.modelSelection
          : key === 'tokenUsage' ? leadValues.tokenUsage
            : key === 'sessionStats' ? leadValues.sessionStats
              : undefined),
    useSessions: (selector) => selector({
      byId: { ...summaries, 'session-graph': { displayTitle: '给导出模块补接口与测试' } },
      projectionsBySession: {},
    }),
    useSessionStatus: (selector) => selector(status),
    openSession: (id, mode) => opened.push([id, mode]),
    openFile: () => {},
  };
  const render = panelRender(registered, 'session-graph', props);

  // 1) The workflow tree is the default view: Lead root, stage hubs, one card per agent.
  let host = await harness.settle(render);
  assert.equal(harness.collect(host, harness.byClass('stwd-gnode')).length, 4, 'one node per dispatched agent');
  assert.equal(harness.collect(host, harness.byClass('stwd-leadnode')).length, 1, 'the Lead roots the tree');
  const bandTitles = harness.collect(host, harness.byClass('stwd-hub-title')).map(harness.textOf);
  assert.deepEqual(bandTitles, ['实施', '质量', '评审'], `the stage hubs are drawn (${bandTitles.join(' | ')})`);
  const bandCounts = harness.collect(host, harness.byClass('stwd-hub-count')).map(harness.textOf);
  assert.deepEqual(bandCounts, ['2', '1', '1'], 'every hub counts its own cards');
  assert.equal(harness.collect(host, harness.byClass('stwd-link-trunk')).length, 3, 'the trunk chains the Lead and the hubs');
  assert.equal(harness.collect(host, harness.byClass('stwd-link-branch')).length, 4, 'one branch per agent card');
  assert.equal(harness.collect(host, harness.byClass('stwd-graph-edges')).length, 0, 'no pairwise spaghetti edges');
  const panelText = host.map((node) => harness.textOf(node)).join('\n');
  assert.ok(panelText.indexOf('给导出模块补接口与测试') >= 0, 'the Lead shows its own task title');

  // 2) A node names the role, the actual model, the task and the live numbers.
  const mains = harness.collect(host, harness.byClass('stwd-gnode-main'));
  const runMain = mains.find((node) => String(node.props['aria-label']).indexOf('backend-dev') >= 0);
  assert.ok(runMain, 'the backend node is rendered');
  assert.match(String(runMain.props['aria-label']), /后端工程师/);
  assert.match(String(runMain.props['aria-label']), /deepseek-v4\.1 @ high/);
  assert.match(String(runMain.props['aria-label']), /运行中/);
  assert.match(String(runMain.props['aria-label']), /T1 导出接口/);
  assert.match(harness.textOf(runMain), /T1 导出接口/);
  assert.match(harness.textOf(runMain), /4m 42s/, 'the live elapsed time is rendered');
  assert.match(harness.textOf(runMain), /8\.4k/, 'the summed tokens are rendered');
  const waitMain = mains.find((node) => String(node.props['aria-label']).indexOf('qa-engineer') >= 0);
  assert.match(String(waitMain.props['aria-label']), /等待输入/);

  // Cards of one stage stack on its branch; stages flow down the trunk.
  const boxOf = (needle) => harness.collect(host, harness.byClass('stwd-gnode'))
    .find((node) => harness.textOf(node).indexOf(needle) >= 0);
  const topOf = (node) => Number(String(node.props.style.top).replace('px', ''));
  const leftOfNode = (node) => Number(String(node.props.style.left).replace('px', ''));
  assert.equal(leftOfNode(boxOf('T1 导出接口')), leftOfNode(boxOf('T2 导出按钮')), 'siblings share one branch column');
  assert.equal(topOf(boxOf('T2 导出按钮')) - topOf(boxOf('T1 导出接口')), 84, 'siblings stack by one row pitch');
  assert.ok(topOf(boxOf('T4 复跑门禁')) > topOf(boxOf('T2 导出按钮')), 'the next stage sits further down the trunk');

  // 3) The native task list becomes one bar — counts only, never the tasks.
  assert.match(panelText, /2\/4/, 'the bar counts the native tasks');
  assert.match(panelText, /Agent Teams 任务板/, 'the source is named');
  assert.equal(harness.collect(host, harness.byClass('stwd-tseg')).length, 4, 'one segment per native task');
  for (const subject of ['T1 · 实现导出接口', 'T3 · QA 门禁']) {
    assert.equal(panelText.indexOf(subject) < 0, true, `task text must not leak into the panel: ${subject}`);
  }

  // 4) Clicking a node opens its child session; the chevron opens the facts.
  runMain.props.onClick();
  assert.deepEqual(opened[0], ['child-run', 'one-shot'], 'a node opens its child session');
  const runBox = boxOf('T1 导出接口');
  harness.collect([runBox], harness.byClass('stwd-gnode-more'))[0].props.onClick();
  host = await harness.settle(render);
  const detail = harness.collect(host, harness.byClass('stwd-gdetail'))[0];
  assert.ok(detail, 'the detail block appears');
  const detailText = harness.textOf(detail);
  assert.match(detailText, /deepseek-v4\.1/, 'the detail names the model');
  assert.match(detailText, /deepseek/, 'the detail names the provider');
  assert.match(detailText, /high/, 'the detail names the reasoning effort');
  assert.match(detailText, /一次性/, 'the detail names the child mode');
  assert.match(detailText, /缓存读 2000/, 'the detail breaks the usage buckets down');
  const detailButton = harness.collect([detail], (node) => node.type === 'button' && harness.textOf(node) === '打开会话')[0];
  assert.ok(detailButton, 'the detail offers the open action');
  const before = opened.length;
  detailButton.props.onClick();
  assert.equal(opened.length, before + 1);

  // 5) Filters: hide the completed card, then keep only the active ones.
  host = await harness.settle(render);
  const filterOf = (needle) => harness.collect(host, harness.byClass('stwd-filter'))
    .find((node) => harness.textOf(node).indexOf(needle) >= 0);
  filterOf('隐藏已完成').props.onClick();
  host = await harness.settle(render);
  assert.equal(harness.collect(host, harness.byClass('stwd-gnode')).length, 3, 'the completed card is hidden');
  assert.ok(harness.textOf(host[0]).indexOf('已隐藏 1 个') >= 0, 'the panel says how many are hidden');
  filterOf('只看活跃').props.onClick();
  host = await harness.settle(render);
  const activeLabels = harness.collect(host, harness.byClass('stwd-gnode-main')).map((node) => String(node.props['aria-label']));
  assert.equal(activeLabels.length, 3, 'only running and waiting cards survive the active filter');
  assert.ok(activeLabels.every((label) => !/已完成/.test(label)), 'no completed card slips through');
  filterOf('全部').props.onClick();
  host = await harness.settle(render);
  assert.equal(harness.collect(host, harness.byClass('stwd-gnode')).length, 4, 'the full roster comes back');

  // 6) A hub collapses into its header and keeps its count.
  const bandHeadOf = (needle) => harness.collect(host, harness.byClass('stwd-hub-head'))
    .find((node) => harness.textOf(node).indexOf(needle) >= 0);
  bandHeadOf('实施').props.onClick();
  host = await harness.settle(render);
  assert.equal(harness.collect(host, harness.byClass('stwd-gnode')).length, 2, 'the collapsed hub hides its cards');
  assert.equal(harness.textOf(harness.collect(host, harness.byClass('stwd-hub-count'))[0]), '2', 'the hub still counts them');
  assert.equal(bandHeadOf('实施').props['aria-expanded'], 'false', 'the hub header reports the collapsed state');
  bandHeadOf('实施').props.onClick();
  host = await harness.settle(render);
  assert.equal(harness.collect(host, harness.byClass('stwd-gnode')).length, 4, 'expanding brings the cards back');

  // 7) Dragging a card moves it (and swallows the click); the relayout tool snaps back.
  const view = harness.collect(host, harness.byClass('stwd-graph-view'))[0];
  const card = harness.collect(host, harness.byClass('stwd-gnode'))
    .find((node) => harness.textOf(node).indexOf('T1 导出接口') >= 0);
  const leftOf = (node) => Number(String(node.props.style.left).replace('px', ''));
  const topOfCard = (node) => Number(String(node.props.style.top).replace('px', ''));
  const startLeft = leftOf(card);
  const startTop = topOfCard(card);
  const widthOfCard = Number(String(card.props.style.width).replace('px', ''));
  const heightOfCard = Number(String(card.props.style.height).replace('px', ''));
  const startX = startLeft + widthOfCard / 2;
  const startY = startTop + heightOfCard / 2;
  view.props.onPointerDown({ button: 0, clientX: startX, clientY: startY, pointerId: 1, target: null });
  view.props.onPointerMove({ clientX: startX + 60, clientY: startY + 40, pointerId: 1, target: null });
  const swallowed = { prevented: false, stopped: false };
  view.props.onClickCapture({
    preventDefault: () => { swallowed.prevented = true; },
    stopPropagation: () => { swallowed.stopped = true; },
  });
  assert.ok(swallowed.prevented && swallowed.stopped, 'the click that follows a drag is swallowed');
  view.props.onPointerUp({ pointerId: 1, target: null });
  host = await harness.settle(render);
  const moved = harness.collect(host, harness.byClass('stwd-gnode'))
    .find((node) => harness.textOf(node).indexOf('T1 导出接口') >= 0);
  assert.equal(leftOf(moved), startLeft + 60, 'the dragged card keeps its new x');
  assert.equal(topOfCard(moved), startTop + 40, 'the dragged card keeps its new y');
  assert.equal(opened.length, before + 1, 'a drag must not open the child session');
  const relayoutTool = harness.collect(host, harness.byClass('stwd-graph-tool'))
    .find((node) => String(node.props['aria-label']).indexOf('重新布局') >= 0);
  relayoutTool.props.onClick();
  host = await harness.settle(render);
  const snapped = harness.collect(host, harness.byClass('stwd-gnode'))
    .find((node) => harness.textOf(node).indexOf('T1 导出接口') >= 0);
  assert.equal(leftOf(snapped), startLeft, 're-layout restores the computed position');
  assert.equal(topOfCard(snapped), startTop);
});

/**
 * The filter choice is remembered: the panel writes it to local storage and reads it
 * back on the next mount, so hiding the finished agents survives a reload.
 */
test('the graph remembers its filter across mounts', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  const { ctx, registered } = createClientContext();
  instance.apply(ctx);

  const store = new Map();
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
  };
  const previousWindow = globalThis.window;
  globalThis.window = { localStorage: storage };
  try {
    const props = {
      now: () => 1700000000000,
      loadRun: async () => ({ status: 'empty', dir: '', artifacts: [] }),
      useProjection: (key) => (key === 'subagentCatalog' ? [
        { id: 'child-done', mode: 'one-shot', label: 'reviewer · 终审', createdAt: 1 },
        { id: 'child-run', mode: 'one-shot', label: 'pm · 写规格', createdAt: 2 },
      ] : undefined),
      useSessions: (selector) => selector({
        byId: { 'child-done': { projectionValues: { subagentTiming: { settledMs: 90000, lastTurnCompleted: true } } } },
        projectionsBySession: {},
      }),
      useSessionStatus: (selector) => selector(new Map([
        ['child-done', { running: false }],
        ['child-run', { running: true }],
      ])),
      openSession: () => {},
      openFile: () => {},
    };
    let host = await harness.settle(panelRender(registered, 'session-prefs', props));
    const hide = harness.collect(host, harness.byClass('stwd-filter'))
      .find((node) => harness.textOf(node).indexOf('隐藏已完成') >= 0);
    hide.props.onClick();
    host = await harness.settle(panelRender(registered, 'session-prefs', props));
    const stored = JSON.parse(store.get('dsh-steward.panel.filters'));
    assert.equal(stored.filter, 'hide-done', 'the choice is persisted');
    assert.equal(harness.collect(host, harness.byClass('stwd-filter-on')).map(harness.textOf)[0], '隐藏已完成', 'the active filter is marked');

    // A fresh mount starts from the stored choice without any click.
    harness.reset();
    host = await harness.settle(panelRender(registered, 'session-prefs', props));
    assert.equal(harness.collect(host, harness.byClass('stwd-gnode')).length, 1, 'the stored filter applies on mount');
  } finally {
    globalThis.window = previousWindow;
  }
});

/**
 * The tree is a canvas: it zooms from the toolbar or the keyboard, pans on a drag,
 * and resets on a double click — all without changing which node opens a session.
 */
test('the agent graph is a canvas that zooms, pans and resets', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  const { ctx, registered } = createClientContext();
  instance.apply(ctx);

  const props = {
    now: () => 1700000000000,
    loadRun: async () => ({ status: 'empty', dir: '', artifacts: [] }),
    useProjection: (key) => (key === 'subagentCatalog' ? [
      { id: 'child-a', mode: 'one-shot', label: 'pm · 写规格', createdAt: 1 },
      { id: 'child-b', mode: 'continuable', label: 'architect · 出方案', createdAt: 2 },
    ] : undefined),
    useSessions: (selector) => selector({ byId: {}, projectionsBySession: {} }),
    useSessionStatus: (selector) => selector(new Map()),
    openSession: () => {},
    openFile: () => {},
  };
  const render = panelRender(registered, 'session-canvas', props);
  const stageOf = (host) => harness.collect(host, harness.byClass('stwd-graph-stage'))[0];
  const viewOf = (host) => harness.collect(host, harness.byClass('stwd-graph-view'))[0];

  let host = await harness.settle(render);
  assert.match(String(stageOf(host).props.style.transform), /scale\(1\)/, 'the canvas opens at 100%');
  assert.match(harness.textOf(harness.collect(host, harness.byClass('stwd-graph-hint'))[0]), /拖空白平移/, 'the pan/zoom hint is visible');
  const tools = harness.collect(host, harness.byClass('stwd-graph-tool'));
  assert.deepEqual(tools.map(harness.textOf), ['−', '100%', '+', '⤢', '⟲'], 'the zoom and layout controls are wired to the canvas');

  // Toolbar zoom in, then the keyboard zooms out.
  tools[2].props.onClick();
  host = await harness.settle(render);
  assert.match(String(stageOf(host).props.style.transform), /scale\(1\.12\)/);
  assert.equal(harness.textOf(harness.collect(host, harness.byClass('stwd-graph-zoom'))[0]), '112%');
  viewOf(host).props.onKeyDown({ key: '-', preventDefault: () => {} });
  host = await harness.settle(render);
  assert.match(String(stageOf(host).props.style.transform), /scale\(1\)/);

  // Zoom in again, then drag the canvas: the content translates.
  harness.collect(host, harness.byClass('stwd-graph-tool'))[2].props.onClick();
  host = await harness.settle(render);
  const view = viewOf(host);
  view.props.onPointerDown({ button: 0, clientX: 120, clientY: 120, pointerId: 1, target: null, currentTarget: null });
  view.props.onPointerMove({ clientX: 40, clientY: 60, pointerId: 1, target: null, currentTarget: null });
  view.props.onPointerUp({ pointerId: 1, target: null, currentTarget: null });
  host = await harness.settle(render);
  assert.match(String(stageOf(host).props.style.transform), /translate\(-\d+px,-\d+px\) scale\(1\.12\)/, 'a drag pans the canvas');

  // Double click on the background resets the view.
  viewOf(host).props.onDoubleClick({ target: null });
  host = await harness.settle(render);
  assert.match(String(stageOf(host).props.style.transform), /translate\(0px,0px\) scale\(1\)/);
  assert.equal(harness.textOf(harness.collect(host, harness.byClass('stwd-graph-zoom'))[0]), '100%');
});

/**
 * The panel counts the host's own task list — the Agent Teams board first, the
 * Session's todo list second — and never renders a task row of its own.
 */
test('the panel counts the native task list without ever listing its tasks', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  const { ctx, registered } = createClientContext();
  instance.apply(ctx);

  const renderWith = (projections) => panelRender(registered, 'session-task', {
    now: () => 1700000000000,
    loadRun: async () => ({ status: 'empty', dir: '', artifacts: [] }),
    useProjection: (key) => projections[key],
  });

  // 1) The shared board wins when it carries tasks; the todo list is not consulted.
  let host = await harness.settle(renderWith({
    agentTeam: {
      enabled: true,
      tasks: [
        { id: 'b1', subject: '板任务甲', status: 'completed' },
        { id: 'b2', subject: '板任务乙', status: 'in_progress' },
      ],
    },
    todos: [{ content: '待办甲', status: 'completed' }, { content: '待办乙', status: 'pending' }],
  }));
  let text = host.map((node) => harness.textOf(node)).join('\n');
  assert.match(text, /1\/2/);
  assert.match(text, /Agent Teams 任务板/);
  assert.equal(text.indexOf('板任务甲') < 0, true, 'board task text stays out of the panel');
  assert.equal(text.indexOf('待办甲') < 0, true, 'todo text stays out of the panel');

  // 2) Without a board the Session's own todo list is counted instead.
  host = await harness.settle(renderWith({
    agentTeam: { enabled: false, tasks: [{ id: 'b1', subject: '不应出现', status: 'completed' }] },
    todos: [
      { content: '待办甲', status: 'completed' },
      { content: '待办乙', status: 'in_progress' },
      { content: '待办丙', status: 'pending' },
    ],
  }));
  text = host.map((node) => harness.textOf(node)).join('\n');
  assert.match(text, /1\/3/);
  assert.match(text, /会话任务列表/);
  assert.equal(text.indexOf('待办甲') < 0, true);

  // 3) No native tasks at all means an honest empty bar, not a fabricated one.
  host = await harness.settle(renderWith({}));
  text = host.map((node) => harness.textOf(node)).join('\n');
  assert.match(text, /原生任务列表为空/);
  assert.equal(harness.collect(host, harness.byClass('stwd-tseg')).length, 0);
});

/**
 * The list view is the dense alternative to the graph: the same agents, no tree,
 * still clickable into the child session.
 */
test('the list view lists agents only and the graph stays the default', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  const { ctx, registered } = createClientContext();
  instance.apply(ctx);

  const opened = [];
  const props = {
    now: () => 1700000000000,
    loadRun: async () => ({ status: 'empty', dir: '', artifacts: [] }),
    useProjection: (key) => (key === 'subagentCatalog' ? [
      { id: 'child-a', mode: 'one-shot', label: 'pm · 写规格', createdAt: 1 },
      { id: 'child-b', mode: 'continuable', label: 'architect · 出方案', createdAt: 2 },
    ] : undefined),
    useSessions: (selector) => selector({ byId: {}, projectionsBySession: {} }),
    useSessionStatus: (selector) => selector(new Map([['child-a', { running: false }]])),
    openSession: (id, mode) => opened.push([id, mode]),
    openFile: () => {},
  };
  const render = panelRender(registered, 'session-list', props);

  let host = await harness.settle(render);
  const tabs = harness.collect(host, harness.byClass('stwd-viewtab'));
  assert.deepEqual(tabs.map(harness.textOf), ['图', '列表']);
  assert.equal(tabs[0].props['aria-pressed'], 'true', 'the graph is the default view');
  assert.equal(harness.collect(host, harness.byClass('stwd-gnode')).length, 2);
  assert.equal(harness.collect(host, harness.byClass('stwd-arow')).length, 0);

  tabs[1].props.onClick();
  host = await harness.settle(render);
  assert.equal(harness.collect(host, harness.byClass('stwd-gnode')).length, 0, 'the graph gives way to the list');
  const rows = harness.collect(host, harness.byClass('stwd-arow'));
  assert.equal(rows.length, 2, 'one row per agent');
  const main = harness.collect(rows, harness.byClass('stwd-arow-main'))[0];
  main.props.onClick();
  assert.deepEqual(opened[0], ['child-a', 'one-shot']);
  const panelText = host.map((node) => harness.textOf(node)).join('\n');
  assert.equal(panelText.indexOf('任务列表') >= 0, true, 'the native list is pointed at, not copied');

  harness.collect(host, harness.byClass('stwd-viewtab'))[0].props.onClick();
  host = await harness.settle(render);
  assert.equal(harness.collect(host, harness.byClass('stwd-gnode')).length, 2, 'the graph comes back');
});

/**
 * Nothing invented: an agent whose Session recorded no projections shows a pending
 * model and no usage instead of a guessed route.
 */
test('an agent without recorded projections degrades honestly', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  const { ctx, registered } = createClientContext();
  instance.apply(ctx);

  const props = {
    now: () => 1700000000000,
    loadRun: async () => ({ status: 'empty', dir: '', artifacts: [] }),
    useProjection: (key) => (key === 'subagentCatalog' ? [
      { id: 'child-bare', mode: 'one-shot', label: 'reviewer · 还没开始' },
    ] : undefined),
    useSessions: (selector) => selector({ byId: {}, projectionsBySession: {} }),
    useSessionStatus: (selector) => selector(new Map()),
    openSession: () => {},
    openFile: () => {},
  };
  const host = await harness.settle(panelRender(registered, 'session-bare', props));
  const main = harness.collect(host, harness.byClass('stwd-gnode-main'))[0];
  assert.ok(main, 'the bare agent still draws a node');
  const text = harness.textOf(main);
  assert.match(text, /模型待定/, 'no model is invented');
  assert.match(text, /—/, 'no usage is invented');
  assert.match(String(main.props['aria-label']), /待开始/);
});

/**
 * The run directory supplies artifacts only: the panel never reads 03-plan.json or
 * draws task nodes from it any more.
 */
test('the run directory supplies artifacts only, collapsed until asked for', async () => {
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
      tasks: { T1: { status: 'done' } },
    }),
    'tmp/steward/1113-1518-demo/03-plan.json': JSON.stringify({
      tasks: [{ id: 'T1', title: '导出接口', role: 'backend-dev', files: ['src/export.js'], dependsOn: [] }],
    }),
  };
  const calls = [];
  const workspaceFiles = {
    list: async (sessionId, path) => {
      calls.push(['list', path]);
      return listings[path] === undefined
        ? { ok: false, error: { message: 'workspace-file/not-found', code: 'workspace-file/not-found' } }
        : { ok: true, value: { path, entries: listings[path], truncated: false } };
    },
    read: async (sessionId, path) => {
      calls.push(['read', path]);
      return reads[path] === undefined
        ? { ok: false, error: { message: 'workspace-file/not-found', code: 'workspace-file/not-found' } }
        : { ok: true, value: { text: reads[path], absolutePath: path, version: 'v1', offset: 1, lines: 1, eof: true } };
    },
  };

  const { ctx, registered } = createClientContext({
    remote: { session: { modelCatalog: async () => ({ ok: true, value: { groups: [] } }) }, workspaceFiles },
  });
  instance.apply(ctx);

  const entry = panelEntry(registered);
  const face = entry.options.inject('session-run07');
  const facts = await face.loadRun();
  assert.equal(facts.dir, 'tmp/steward/1113-1518-demo', 'the newest run directory wins');
  assert.equal(facts.run, undefined, 'run.json is only used to rank directories');
  assert.ok(facts.artifacts.some((item) => item.name === 'reports/qa.md'), 'nested reports are listed');
  assert.ok(calls.some(([method, path]) => method === 'list' && path === 'tmp/steward'), 'discovery walks the run root');
  assert.equal(calls.some(([method, path]) => method === 'read' && path.endsWith('03-plan.json')), false, 'the plan is never read');

  const opened = [];
  const render = () => entry.component({
    ...face,
    sessionId: 'session-run07',
    now: () => 1700000000000,
    useProjection: () => undefined,
    openFile: (path) => opened.push(path),
  });

  // Collapsed by default: the artifacts exist but stay folded.
  let host = await harness.settle(render);
  assert.equal(harness.collect(host, harness.byClass('stwd-artrow')).length, 0, 'artifacts start collapsed');
  assert.equal(harness.collect(host, harness.byClass('stwd-gnode')).length, 0, 'the plan never becomes nodes');
  const head = harness.collect(host, harness.byClass('stwd-artifacts-head'))[0];
  assert.ok(head, 'the artifacts section has a toggle');
  head.props.onClick();
  host = await harness.settle(render);
  const rows = harness.collect(host, harness.byClass('stwd-artrow'));
  assert.ok(rows.length >= 1, 'opening the section lists the files');
  rows[0].props.onClick();
  assert.equal(opened.length, 1, 'clicking an artifact opens it');
  assert.ok(harness.collect(host, harness.byClass('stwd-artifacts-dir')).length === 1, 'the run directory is shown');
});

/**
 * The injected face is how a row reaches the host: a child Session opens as a
 * `subagentchat` resource in the right Sidebar, an artifact as a `file` resource,
 * and the panel can ask the host to read a child's projections.
 */
test('the panel face opens child sessions, artifacts and asks for child projections', async () => {
  const { factory } = await loadClientFactory();
  const harness = createRenderHarness();
  const instance = factory((name) => (name === 'react' ? harness.stub : {}));
  const calls = [];
  const refreshed = [];
  const { ctx, registered } = createClientContext({
    sidebarRight: {
      mounted: { getSnapshot: () => undefined, subscribe: () => () => {} },
      openTab: (kind) => calls.push(['tab', kind]),
      openResource: (address, options) => calls.push(['resource', address, options]),
    },
    sessions: {
      list: { getSnapshot: () => ({ projectionsBySession: {} }), subscribe: () => () => {} },
      refreshProjections: async (id) => { refreshed.push(id); },
    },
  });
  instance.apply(ctx);

  const face = panelEntry(registered).options.inject('session-run09');
  assert.equal(typeof face.now(), 'number', 'the face supplies the panel clock');

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

  await face.refreshChild('child-9');
  assert.deepEqual(refreshed, ['child-9'], 'the face asks the host for a child projection read');
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
test('the panel stylesheet stays scoped and uses only host theme tokens', async () => {
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
  const entry = panelEntry(registered);
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

