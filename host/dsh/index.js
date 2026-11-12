/**
 * dsh-steward — Host half, built on DSH-native extension points.
 *
 *  - Roles are **dispatch-time charters**, not Agent Presets. A registered
 *    preset is by definition a user-selectable session mode, and a specialist
 *    mode a human can switch into bypasses the plan gate, baseline guard, QA
 *    and review that give Steward its value. `steward_dispatch` therefore
 *    starts every child on the shipped `standard` composition and prepends the
 *    role charter to the task prompt, so roles never appear in the mode picker.
 *  - Model routes have two layers, both visible in the Steward panel:
 *    `<repo>/steward.config.json` (`modelRouting.<role>`) wins because it is
 *    versioned with the code, then this plugin's native **Config** (namespace
 *    `steward`, edited on the panel through `configForms`), then the parent
 *    route. There is no private config file and no custom HTTP bridge.
 *  - `steward_dispatch` is a thin delegation tool over `ctx.subagents`: it
 *    composes the role charter + task prompt, resolves the route and calls
 *    `startActivation` on the `standard` composition.
 *  - `steward_board` mirrors `03-plan.json` onto the Agent Teams shared task
 *    board, so the native Team panel is the live dashboard.
 *  - `/steward` is registered on the native human-command registry.
 *  - Skills are registered on the native `ctx.skills` registry.
 *
 * `@deepseek-ai/schemastery` is resolved from the installed package or the
 * active profile (see `resolveSchemastery`); nothing else outside Node builtins
 * is imported.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROLES_DIR = path.join(HERE, 'roles');
const SKILLS_DIR = path.join(HERE, 'skills');
/** Native settings namespace — must equal the Loader row id in cordis.patch.yml. */
const CONFIG_NS = 'steward';
/** DSH in-process subagent backend that supports independent preset selection. */
const SUBAGENT_PROVIDER = 'spawn';
/**
 * Composition every dispatched child runs on. The shipped `standard` preset is
 * always registered (with or without the code-work tools), so a role never
 * needs its own preset — and this plugin never registers one.
 */
const CHILD_PRESET = 'standard';

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

const BANNER = /^\s*<!--[\s\S]*?-->\s*/;

function stripFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

const ROLE_MANIFEST = readJson(path.join(ROLES_DIR, 'manifest.json'), { roles: [] });
const SKILL_MANIFEST = readJson(path.join(SKILLS_DIR, 'manifest.json'), { skills: [] });
const ROLES = Array.isArray(ROLE_MANIFEST.roles) ? ROLE_MANIFEST.roles : [];
const ROLE_IDS = ROLES.map((role) => role.id);
const ROLE_BY_ID = new Map(ROLES.map((role) => [role.id, role]));

/**
 * Resolve schemastery from the installed package (npm install) or, for a
 * linked checkout, from the active profile's hoisted node_modules.
 */
function resolveSchemastery() {
  const load = (from) => createRequire(from)('@deepseek-ai/schemastery');
  try {
    return load(import.meta.url);
  } catch {
    // linked checkout: fall through to the active profile
  }
  const candidates = [];
  const profileDir = process.env.DSH_PROFILE_DIR;
  if (typeof profileDir === 'string' && profileDir !== '') candidates.push(path.join(profileDir, 'package.json'));
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  try {
    for (const name of fs.readdirSync(path.join(home, 'profiles'))) {
      candidates.push(path.join(home, 'profiles', name, 'package.json'));
    }
  } catch {
    // no profiles directory
  }
  for (const manifest of candidates) {
    if (!fs.existsSync(manifest)) continue;
    try {
      return load(manifest);
    } catch {
      // try the next profile
    }
  }
  throw new Error(
    '[dsh-steward] cannot resolve @deepseek-ai/schemastery. Install the plugin as a package (declared peer dependency) '
    + 'or keep the linked checkout inside a dsh profile whose node_modules contains @deepseek-ai/schemastery.',
  );
}

const z = resolveSchemastery();

// --- Config: native DSH settings --------------------------------------------------
// The Steward panel edits this namespace through ctx.configForms (per role:
// provider / model / effort). A project's steward.config.json still wins at
// dispatch time, so the repository stays the authoritative layer.

function routeSchema(label) {
  return z.object({
    provider: z.string().default('').description(`${label}：LLM 提供方 id；留空表示继承主代理`).volatile(),
    model: z.string().default('').description(`${label}：模型 id（与 provider 成对）；留空表示继承主代理`).volatile(),
    effort: z.string().default('').description(`${label}：模型支持的思考强度 id；留空使用模型默认`).volatile(),
  });
}

export const Config = z.object({
  defaults: routeSchema('默认配置'),
  roles: z.object(Object.fromEntries(ROLES.map((role) => [role.id, routeSchema(role.name ?? role.id)]))),
}).description('Steward 面板：每个角色（或默认）的模型与思考强度；项目根 steward.config.json 的 modelRouting 优先，保存后下一次派发生效');

function unwrap(value) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') return value.get();
  return value;
}

function emptySelection() {
  return { provider: '', model: '', effort: '' };
}

function readSelection(route) {
  if (route === null || typeof route !== 'object') return emptySelection();
  const provider = String(unwrap(route.provider) ?? '').trim();
  const model = String(unwrap(route.model) ?? '').trim();
  const effort = String(unwrap(route.effort) ?? '').trim();
  // A route is provider+model together; a partial route is dropped instead of
  // being half-applied later.
  if (provider === '' || model === '') return emptySelection();
  return { provider, model, effort };
}

function normalizeSelection(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return emptySelection();
  return readSelection(raw);
}

function readConfig(config) {
  const roles = {};
  for (const id of ROLE_IDS) roles[id] = readSelection(config?.roles?.[id]);
  return { defaults: readSelection(config?.defaults), roles };
}

function normalizeConfig(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { defaults: emptySelection(), roles: Object.fromEntries(ROLE_IDS.map((id) => [id, emptySelection()])) };
  }
  const roles = {};
  for (const id of ROLE_IDS) roles[id] = normalizeSelection(raw.roles?.[id]);
  return { defaults: normalizeSelection(raw.defaults), roles };
}

/** Live config as served by the native settings document, falling back to the config refs. */
function currentConfig(ctx, config) {
  try {
    const settings = ctx.get('settings');
    if (settings !== undefined && typeof settings.describe === 'function') {
      const entry = settings.describe().find((row) => row.ns === CONFIG_NS);
      if (entry !== undefined && entry.value !== undefined) return normalizeConfig(entry.value);
    }
  } catch {
    // settings service not mounted yet: use the config references
  }
  return readConfig(config);
}

function settingsDocumentPath(ctx) {
  try {
    const settings = ctx.get('settings');
    const documentPath = settings?.documentPath;
    return typeof documentPath === 'string' ? documentPath : '';
  } catch {
    return '';
  }
}

/** Settings-layer route for one role: its own entry, then the defaults, then inherit. */
function effectiveFor(config, roleId) {
  const own = config.roles[roleId];
  if (own !== undefined && own.provider !== '' && own.model !== '') return { ...own, source: 'role' };
  if (config.defaults.provider !== '' && config.defaults.model !== '') return { ...config.defaults, source: 'defaults' };
  return { ...emptySelection(), source: 'inherit' };
}

// --- Routing: <project>/steward.config.json ---------------------------------------
// One source of truth, in the repository. A route is `{ model: "provider/model",
// effort?: "..." }`; anything malformed is ignored so a typo degrades to
// "inherit the parent" instead of dispatching a half-applied route.

function findProjectRoot(startDir) {
  let current = path.resolve(startDir);
  for (let depth = 0; depth < 6; depth += 1) {
    if (fs.existsSync(path.join(current, 'steward.config.json'))) return current;
    if (fs.existsSync(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(startDir);
}

function projectRouteFor(roleId, startDir) {
  try {
    const root = findProjectRoot(startDir);
    const raw = readJson(path.join(root, 'steward.config.json'), null);
    const route = raw?.modelRouting?.[roleId];
    if (route === null || typeof route !== 'object' || Array.isArray(route)) return null;
    const model = typeof route.model === 'string' ? route.model.trim() : '';
    const slash = model.indexOf('/');
    if (slash <= 0 || slash === model.length - 1) return null;
    const effort = typeof route.effort === 'string' ? route.effort.trim() : '';
    return { provider: model.slice(0, slash), model: model.slice(slash + 1), effort, source: 'project' };
  } catch {
    return null;
  }
}

/** The route a role actually dispatches with: project config, then the panel. */
function resolveRoute(ctx, config, roleId, startDir) {
  const project = projectRouteFor(roleId, startDir);
  if (project !== null) return project;
  return effectiveFor(normalizeConfig(currentConfig(ctx, config)), roleId);
}

async function resolveBaseDirectory(ctx, parent, args) {
  if (typeof args?.cwd === 'string' && args.cwd !== '') return path.resolve(args.cwd);
  try {
    const workingDirectory = ctx.get('workingDirectory');
    if (workingDirectory !== undefined && typeof workingDirectory.ensure === 'function') {
      return await workingDirectory.ensure(parent, undefined);
    }
  } catch {
    // fall through to the process directory
  }
  return process.cwd();
}

// --- Roles → dispatch-time charters ----------------------------------------------

const roleCharters = new Map();

/** The role body with frontmatter and build banner stripped: a dispatch payload. */
function roleCharter(roleId) {
  if (roleCharters.has(roleId)) return roleCharters.get(roleId);
  const role = ROLE_BY_ID.get(roleId);
  let text = '';
  if (role !== undefined) {
    try {
      text = stripFrontmatter(fs.readFileSync(path.join(HERE, role.path), 'utf8')).replace(BANNER, '').trim();
    } catch {
      text = '';
    }
  }
  roleCharters.set(roleId, text);
  return text;
}

/**
 * The dispatch prompt: charter first, assigned task last, so the work being
 * requested is the most recent instruction the child reads. A missing charter
 * degrades to the bare task instead of failing the dispatch.
 */
function dispatchPrompt(roleId, task) {
  const charter = roleCharter(roleId);
  if (charter === '') return task;
  return `${charter}\n\n---\n\n# 本次任务（派单正文）\n\n${task}`;
}

/**
 * The shipped `standard` composition must resolve before a child is started;
 * otherwise the activation fails with an opaque provider error. Resolution is
 * best effort: profiles without the preset service still dispatch.
 */
async function assertChildPresetReady(ctx) {
  const presets = ctx.get('agentPresets');
  if (presets === undefined || typeof presets.resolve !== 'function') return;
  let preset;
  try {
    preset = await presets.resolve(CHILD_PRESET);
  } catch (error) {
    throw new Error(`subagent composition "${CHILD_PRESET}" is not available: ${errorMessage(error)}`);
  }
  if (preset === undefined || preset === null) {
    throw new Error(`subagent composition "${CHILD_PRESET}" is not registered (it may still be loading)`);
  }
  if (typeof preset.broken === 'string' && preset.broken !== '') {
    throw new Error(`subagent composition "${CHILD_PRESET}" failed to activate: ${preset.broken}`);
  }
}

// --- Tools -----------------------------------------------------------------------

function toolError(message) {
  return new Error(message);
}

function textBlocks(text) {
  return [{ type: 'text', text }];
}

// --- Agent Teams board ------------------------------------------------------------
// With the host's Agent Teams bundle enabled, the shared task board *is* Steward's
// live dashboard: gates and work items are native tasks, so readiness, ownership,
// file scopes and blockers are rendered by the native Team panel instead of a
// bespoke UI. Without that bundle the board actions fail loudly and the solo
// `steward_dispatch` path stays in charge.

const BOARD_KEY = { gate: 'steward:gate', plan: 'steward:plan' };
const GATES = [
  { id: 'G1', subject: 'G1 · 计划批准', description: 'Plan Critic + 用户批准完成后关闭这张门：所有工作单都在等它。' },
  { id: 'G2', subject: 'G2 · QA 门禁', description: '全部工作单完成后派 qa-engineer 独立复跑 verify.mjs，出 QA 报告。' },
  { id: 'G3', subject: 'G3 · 终审', description: 'QA 通过后派 reviewer 终审 diff：越界 / 正确性 / 测试 / 残留 / 安全 / 风格 / 文档。' },
];

function boardKey(kind, id) {
  return `${BOARD_KEY[kind]}=${id}`;
}

function taskLabel(taskId) {
  const id = String(taskId ?? '');
  return id.startsWith('T') ? id : `T${id}`;
}

function shorten(text, max) {
  const value = String(text ?? '').trim();
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function sameList(left, right) {
  const a = Array.isArray(left) ? left : [];
  const b = Array.isArray(right) ? right : [];
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function ownedFilesOf(task) {
  return [...(task.files ?? []), ...(task.newFiles ?? [])].map((file) => String(file));
}

/** Dependency-first ordering; throws on a cycle instead of looping forever. */
function orderPlanTasks(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ordered = [];
  const state = new Map();
  const visit = (task) => {
    const mark = state.get(task.id);
    if (mark === 'done') return;
    if (mark === 'visiting') throw toolError(`计划依赖成环：${task.id}`);
    state.set(task.id, 'visiting');
    for (const dep of task.dependsOn ?? []) {
      const upstream = byId.get(dep);
      if (upstream !== undefined) visit(upstream);
    }
    state.set(task.id, 'done');
    ordered.push(task);
  };
  for (const task of tasks) visit(task);
  return ordered;
}

function reportPath(task) {
  return `reports/t${String(task.id).replace(/^T/i, '')}-${task.role}.md`;
}

function planTaskBlock(task, planLabel, plan) {
  const acs = (plan.acceptanceCriteria ?? [])
    .filter((ac) => (ac.coveredBy ?? []).includes(task.id))
    .map((ac) => `${ac.id} ${ac.text}`);
  return [
    `目标：${task.title}`,
    `完成标准：${task.doneWhen}`,
    `所有权：${ownedFilesOf(task).join('、') || '（未声明）'}`,
    `报告：${reportPath(task)}`,
    ...(acs.length === 0 ? [] : [`验收：${acs.join('；')}`]),
    '',
    boardKey('plan', task.id),
    `steward:role=${task.role}`,
    `steward:plan=${planLabel}`,
  ].join('\n');
}

function findBoardTask(boardTasks, key) {
  return (boardTasks ?? []).find((task) => task.status !== 'deleted' && String(task.description ?? '').includes(key)) ?? null;
}

function renderBoard(level, planLabel, plan, boardTasks) {
  const labelOf = new Map((boardTasks ?? []).map((task) => [task.id, task.subject]));
  const statusGlyph = (task) => {
    if (task.status === 'completed') return '✅ 完成';
    if (task.status === 'in_progress') return '▶ 进行中';
    if (task.status === 'pending' && task.ready === false) return '⛔ 被阻塞';
    return '⚪ 待开始';
  };
  const gateRow = (gateId) => findBoardTask(boardTasks, boardKey('gate', gateId));
  const planRows = (plan.tasks ?? []).map((task) => ({ task, board: findBoardTask(boardTasks, boardKey('plan', task.id)) }));

  const lines = [`## 共享任务板 · ${planLabel}（${level} 级）`, ''];
  const gateText = GATES
    .map((gate) => {
      const board = gateRow(gate.id);
      if (board === null) return null;
      return `${gate.subject.split(' · ')[0]} ${board.status === 'completed' ? '✅' : board.status === 'in_progress' ? '▶' : '⏸'}`;
    })
    .filter((value) => value !== null);
  if (gateText.length > 0) lines.push(`门禁：${gateText.join(' / ')}`);

  const done = planRows.filter((row) => row.board?.status === 'completed').length;
  const ready = planRows.filter((row) => row.board !== null && row.board.status === 'pending' && row.board.ready === true);
  lines.push(`进度：${done}/${planRows.length} 工作单完成${ready.length === 0 ? '' : `；可开始：${ready.map((row) => taskLabel(row.task.id)).join('、')}`}`);
  lines.push('');
  lines.push('| 任务 | 状态 | 负责人 | 依赖 |');
  lines.push('|---|---|---|---|');
  for (const gate of GATES) {
    const board = gateRow(gate.id);
    if (board === null) continue;
    lines.push(`| ${gate.subject} | ${statusGlyph(board)} | ${board.ownerName ?? '—'} | ${board.blockedBy.length === 0 ? '—' : board.blockedBy.map((id) => labelOf.get(id) ?? id).join('、')} |`);
  }
  for (const row of planRows) {
    const subject = `${taskLabel(row.task.id)} · ${row.task.role} · ${shorten(row.task.title, 40)}`;
    if (row.board === null) {
      lines.push(`| ${subject} | （未建板） | — | — |`);
      continue;
    }
    const blockers = row.board.blockedBy.length === 0 ? '—' : row.board.blockedBy.map((id) => labelOf.get(id) ?? id).join('、');
    lines.push(`| ${subject} | ${statusGlyph(row.board)} | ${row.board.ownerName ?? '未分配'} | ${blockers} |`);
  }

  const warnings = (boardTasks ?? []).flatMap((task) => (Array.isArray(task.writeScopeWarnings) ? task.writeScopeWarnings : []));
  const uniqueWarnings = [...new Set(warnings)];
  if (uniqueWarnings.length > 0) {
    lines.push('', `⚠ 文件重叠：${uniqueWarnings.join('；')}`);
  }
  lines.push('', '状态口径：pending=未开始，in_progress=有人在做，completed=报告已落盘且该任务所有权内验证通过；被依赖阻塞的任务 claim 不上。');
  return lines.join('\n');
}

function defineStewardTools(ctx, config) {
  const tools = ctx.get('tools');
  if (tools === undefined) return;

  const boardTool = {
    name: 'steward_board',
    description: 'Agent Teams shared task board — Steward\'s live dashboard. action="sync" turns <plan>/03-plan.json into board tasks (G1 plan gate, one work task per plan task with file scopes and dependencies, G2 QA gate, G3 final review) idempotently, matched through the steward:plan= / steward:gate= markers in each description; action="status" returns the same board state the native Team panel renders (gate progress, per-task status/owner/blockers/readiness); action="brief" composes the self-contained task text to hand to spawn_teammate (role charter + plan task + board task id + completion protocol). Requires the host Agent Teams bundle; sync/status fail loudly without it and the solo steward_dispatch path stays in charge.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['sync', 'status', 'brief'], description: 'Operation to perform.' },
        plan: { type: 'string', description: 'Path to 03-plan.json (absolute, or relative to the working directory).' },
        level: { type: 'string', enum: ['S', 'M', 'L'], description: 'Run sizing for sync/status: M/L create the G1/G2/G3 gates, S creates none. Defaults to M.' },
        role: { type: 'string', enum: ROLE_IDS.slice(), description: 'Steward role for action="brief".' },
        task: { type: 'string', description: 'Plan task id (e.g. "T1") for action="brief".' },
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { action: { type: 'string' }, text: { type: 'string' } },
        required: ['action', 'text'],
      },
      render: (_args, value) => textBlocks(value.text),
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const action = String(args?.action ?? '');
      const planPath = String(args?.plan ?? '').trim();
      if (planPath === '') throw toolError('steward_board 需要 plan 参数：03-plan.json 的路径');
      const baseDir = await resolveBaseDirectory(ctx, exec.agent, {});
      const resolvedPlan = path.isAbsolute(planPath) ? planPath : path.resolve(baseDir, planPath);
      const plan = readJson(resolvedPlan, null);
      if (plan === null || !Array.isArray(plan.tasks) || plan.tasks.length === 0) {
        throw toolError(`读不到计划文件或计划里没有 tasks：${resolvedPlan}`);
      }
      const planLabel = path.basename(path.dirname(resolvedPlan)) || 'run';

      if (action === 'brief') {
        const roleId = String(args?.role ?? '');
        if (!ROLE_IDS.includes(roleId)) throw toolError(`unknown steward role "${roleId}"`);
        const taskId = String(args?.task ?? '');
        const task = plan.tasks.find((entry) => String(entry.id) === taskId);
        if (task === undefined) {
          throw toolError(`计划里没有任务 "${taskId}"（可用：${plan.tasks.map((entry) => entry.id).join('、')}）`);
        }
        const teams = ctx.get('agentTeams');
        const boardTask = teams !== undefined && exec.agent !== undefined && typeof teams.listTasks === 'function'
          ? findBoardTask(teams.listTasks(exec.agent), boardKey('plan', task.id))
          : null;
        const brief = [
          boardTask === null ? '任务板：未建板（单人模式，按报告落点交付）' : `任务板：${boardTask.id}（先 claim 再动手；做完 complete）`,
          planTaskBlock(task, planLabel, plan),
          '',
          '完成协议：只改「所有权」里的文件；把实施报告写到「报告」路径并附真实命令输出；验证通过后再把板上任务标记 complete。做不动、要越权或发现规格冲突 → send_message 给 Lead，不要自行扩权。',
        ].join('\n');
        return { action, text: dispatchPrompt(roleId, brief) };
      }

      const teams = ctx.get('agentTeams');
      if (teams === undefined || typeof teams.listTasks !== 'function') {
        throw toolError('Agent Teams 未启用：本会话没有 agentTeams 服务。单人模式请继续用 steward_dispatch + run.json；要用共享看板，请在插件页启用「智能体团队」后刷新页面。');
      }
      const agent = exec.agent;
      if (agent === undefined) throw toolError('steward_board requires a calling agent');
      const level = String(args?.level ?? 'M').toUpperCase();

      if (action === 'status') {
        return { action, text: renderBoard(level, planLabel, plan, teams.listTasks(agent)) };
      }
      if (action !== 'sync') throw toolError(`unknown action "${action}" (expected sync/status/brief)`);

      const wantGates = level === 'M' || level === 'L';
      const upsert = async (spec) => {
        const key = boardKey(spec.kind, spec.id);
        const existing = findBoardTask(teams.listTasks(agent), key);
        if (existing === null) {
          return await teams.createTask(agent, {
            subject: spec.subject,
            description: spec.description,
            blockedBy: spec.blockedBy,
            writeScopes: spec.writeScopes,
          });
        }
        let current = existing;
        const contentChanged = current.subject !== spec.subject
          || current.description !== spec.description
          || !sameList(current.writeScopes, spec.writeScopes);
        if (contentChanged && current.status !== 'completed') {
          current = await teams.updateTask(agent, {
            taskId: current.id,
            expectedRevision: current.revision,
            action: 'edit',
            subject: spec.subject,
            description: spec.description,
            writeScopes: spec.writeScopes,
          });
        }
        if (!sameList(current.blockedBy, spec.blockedBy)) {
          current = await teams.updateTask(agent, {
            taskId: current.id,
            expectedRevision: current.revision,
            action: 'set_dependencies',
            blockedBy: spec.blockedBy,
          });
        }
        return current;
      };

      const gateIds = new Map();
      const planIdToBoard = new Map();
      let touched = 0;
      const gateSpec = (gate, blockedBy) => ({
        kind: 'gate',
        id: gate.id,
        subject: gate.subject,
        description: `${gate.description}\n\n${boardKey('gate', gate.id)}`,
        writeScopes: [],
        blockedBy,
      });

      if (wantGates) {
        const task = await upsert(gateSpec(GATES[0], []));
        gateIds.set(GATES[0].id, task.id);
        touched += 1;
      }
      for (const task of orderPlanTasks(plan.tasks)) {
        const blockedBy = [];
        if (wantGates && gateIds.has('G1')) blockedBy.push(gateIds.get('G1'));
        for (const dep of task.dependsOn ?? []) {
          const boardId = planIdToBoard.get(dep);
          if (boardId !== undefined) blockedBy.push(boardId);
        }
        const board = await upsert({
          kind: 'plan',
          id: task.id,
          subject: `${taskLabel(task.id)} · ${task.role} · ${shorten(task.title, 48)}`,
          description: planTaskBlock(task, planLabel, plan),
          writeScopes: ownedFilesOf(task),
          blockedBy,
        });
        planIdToBoard.set(task.id, board.id);
        touched += 1;
      }
      if (wantGates) {
        const workIds = [...planIdToBoard.values()];
        for (const gate of GATES.slice(1)) {
          const blockedBy = gate.id === 'G2' ? workIds : [gateIds.get('G2')].filter((id) => id !== undefined);
          const task = await upsert(gateSpec(gate, blockedBy));
          gateIds.set(gate.id, task.id);
          touched += 1;
        }
      }
      const text = `已同步 ${touched} 个任务到共享任务板（门禁 ${wantGates ? 'G1/G2/G3' : '无'}）。\n\n${renderBoard(level, planLabel, plan, teams.listTasks(agent))}`;
      return { action: 'sync', text };
    },
  };

  ctx.effect(() => tools.register(boardTool), 'steward: steward_board tool');

  const dispatchTool = {
    name: 'steward_dispatch',
    description: 'Dispatch one Steward specialist subagent by role (pm, architect, backend-dev, frontend-dev, qa-engineer, browser-tester, reviewer). The child starts on the DSH built-in `standard` composition and this tool prepends the role charter to the task prompt, so roles never become user-selectable session modes. A `modelRouting.<role>` entry in the project root `steward.config.json` sets the child provider/model/reasoning effort (resolved from the dispatch cwd); without one the child inherits the parent route. Returns the child session id immediately; the child sends its final result back as a completion notice. The prompt must be self-contained because the child does not see this conversation. Use one call per task.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        role: { type: 'string', enum: ROLE_IDS.slice(), description: 'Steward role to dispatch.' },
        description: { type: 'string', description: 'A short (3-5 word) description of the delegated task, for display.' },
        prompt: { type: 'string', description: 'The complete, self-contained task: goal, repository root, artifact paths, file ownership, acceptance criteria and report destination.' },
        cwd: { type: 'string', description: 'Initial child working directory; relative paths resolve against the current directory. Omit to inherit. Also selects the project whose steward.config.json supplies the route.' },
      },
      required: ['role', 'description', 'prompt'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', const: 'activation' },
          childId: { type: 'string' },
          role: { type: 'string' },
          childPreset: { type: 'string' },
          provider: { type: 'string' },
          model: { type: 'string' },
          effort: { type: 'string' },
          source: { type: 'string' },
        },
        required: ['kind', 'childId', 'role', 'childPreset', 'provider', 'model', 'effort', 'source'],
      },
      render: (_args, value) => textBlocks(
        `started steward subagent ${value.childId} (role ${value.role}, composition ${value.childPreset}; ${value.provider === '' ? 'inherited parent model' : `${value.provider}/${value.model}${value.effort === '' ? '' : ` @ ${value.effort}`}`}${value.source === 'project' ? ' from steward.config.json' : value.source === 'role' || value.source === 'defaults' ? ' from the Steward panel' : ''})`,
      ),
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const parent = exec.agent;
      if (parent === undefined) throw toolError('steward_dispatch requires a calling agent');
      const roleId = String(args?.role ?? '');
      if (!ROLE_IDS.includes(roleId)) throw toolError(`unknown steward role "${roleId}"`);
      const subagents = ctx.get('subagents');
      if (subagents === undefined) throw toolError('the subagents service is unavailable in this profile');
      const provider = subagents.getProvider(SUBAGENT_PROVIDER);
      if (provider === undefined) throw toolError(`the "${SUBAGENT_PROVIDER}" subagent provider is not registered`);
      if (provider.capabilities?.agentPreset !== true) {
        throw toolError(`the "${SUBAGENT_PROVIDER}" subagent provider does not support independent agent preset selection`);
      }
      await assertChildPresetReady(ctx);

      const baseDir = await resolveBaseDirectory(ctx, parent, args);
      const effective = resolveRoute(ctx, config, roleId, baseDir);
      let agentOptions;
      if (effective.provider !== '' && effective.model !== '') {
        const llm = ctx.get('llm');
        if (llm === undefined) throw toolError('the llm service is unavailable; cannot resolve the configured child model');
        const info = await llm.resolveModelInfo(effective.provider, effective.model, exec.signal);
        if (effective.effort !== '') {
          const supported = Array.isArray(info?.reasoning?.efforts) ? info.reasoning.efforts.map((effort) => String(effort.id)) : [];
          if (!supported.includes(effective.effort)) {
            throw toolError(`model ${effective.provider}/${effective.model} does not support reasoning effort "${effective.effort}" (supported: ${supported.join(', ') || 'none'})`);
          }
          agentOptions = { provider: effective.provider, model: effective.model, reasoningEffort: effective.effort };
        } else {
          agentOptions = { provider: effective.provider, model: effective.model };
        }
        if (provider.capabilities?.agentOptions !== true) {
          throw toolError(`subagent provider "${SUBAGENT_PROVIDER}" does not support child agentOptions; clear the role model configuration or switch providers`);
        }
      }

      // DSH ≥ 0.2.1-rc.2 carries the task fields on the spec itself: the old
      // nested `request` object was removed, and shipping it makes
      // `startActivation` fail before the child exists.
      const activation = await subagents.startActivation({
        provider: SUBAGENT_PROVIDER,
        label: String(args?.description ?? roleId),
        prompt: [{ type: 'text', text: dispatchPrompt(roleId, String(args?.prompt ?? '')) }],
        parent,
        agentPreset: CHILD_PRESET,
        ...(typeof args?.cwd === 'string' && args.cwd !== '' ? { cwd: args.cwd } : {}),
        ...(agentOptions === undefined ? {} : { agentOptions }),
        signal: exec.signal,
        delivery: 'parent',
      });
      return {
        kind: 'activation',
        childId: String(activation.childId),
        role: roleId,
        childPreset: CHILD_PRESET,
        provider: effective.provider,
        model: effective.model,
        effort: effective.effort,
        source: effective.source,
      };
    },
  };

  ctx.effect(() => tools.register(dispatchTool), 'steward: steward_dispatch tool');
}

// --- Human command ---------------------------------------------------------------

function renderRoster(topic) {
  const lines = ['Steward 团队（DSH 原生 Skills + 子代理 seam；本插件不注册 Agent Preset）', ''];
  if (topic === 'models' || topic === 'roles' || topic === '') {
    for (const role of ROLES) {
      lines.push(`- ${role.id}（${role.name ?? role.id}）：${role.description ?? ''} → 组合 \`${CHILD_PRESET}\``);
    }
    lines.push('');
  }
  lines.push('路由：项目根 `steward.config.json` 的 `modelRouting.<role>`（形如 `{ "model": "provider/model", "effort": "…" }`）优先；仓库里没写的角色落到 **Steward 面板**（设置 → Steward）里的该角色 / 默认配置；两处都没有就继承主代理。派发结果的括号里会回显本次实际生效的路由与来源。');
  lines.push('派发：主代理调用 `steward_dispatch(role=..., description=..., prompt=...)`；子代理以 DSH 内置 `standard` 组合启动，角色章程由派单正文注入，prompt 必须自包含。');
  lines.push('模式：本插件不注册 Agent Preset——7 个角色不会出现在模式选择器里；Steward 是一套流程（技能 + 工具 + 门禁脚本），不是一个会话模式。');
  return lines.join('\n');
}

function registerCommands(ctx) {
  ctx.inject(['commands'], (sctx) => {
    const definition = {
      name: 'steward',
      description: '显示 Steward 团队名册、子代理组合与路由口径（DSH 原生 Skills；不注册 Agent Preset）',
      input: { hint: '[roles|models|help]' },
      handler: (invocation) => {
        try {
          return { kind: 'success', text: renderRoster(String(invocation?.rawInput ?? '').trim().toLowerCase()) };
        } catch (error) {
          return { kind: 'error', text: `无法读取 Steward 配置：${errorMessage(error)}` };
        }
      },
    };
    sctx.effect(() => sctx.commands.register(definition), 'steward: /steward command');
  });
}

// --- Skills ----------------------------------------------------------------------

function registerSkills(ctx) {
  ctx.inject(['skills'], (sctx) => {
    for (const skill of SKILL_MANIFEST.skills ?? []) {
      let content;
      try {
        content = stripFrontmatter(fs.readFileSync(path.join(HERE, skill.path), 'utf8'));
      } catch {
        continue;
      }
      const registration = {
        name: skill.name,
        description: skill.description,
        content,
        source: 'bundled',
        resourceBase: { kind: 'directory', path: path.join(HERE, skill.dir) },
      };
      try {
        sctx.effect(() => sctx.skills.register(registration), `steward: skill ${skill.name}`);
      } catch (error) {
        // A user skill with the same name must not stop the plugin from loading.
        sctx.logger?.warn?.(`steward: could not register skill "${skill.name}": ${errorMessage(error)}`);
      }
    }
  });
}

// --- Plugin ----------------------------------------------------------------------

export const name = 'dsh-steward';
export const inject = ['tools'];

export function apply(ctx, config) {
  registerSkills(ctx);
  defineStewardTools(ctx, config);
  registerCommands(ctx);
  try {
    ctx.logger?.info?.(`steward: ${SKILL_MANIFEST.skills?.length ?? 0} skills, ${ROLES.length} dispatchable roles (charter-injected, composition ${CHILD_PRESET}); routes: <project>/steward.config.json > panel (${CONFIG_NS}) > parent`);
  } catch {
    // logging is best effort
  }
}
