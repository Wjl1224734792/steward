/**
 * dsh-steward — Host half.
 *
 * Responsibilities:
 *  1. Register the Steward skills shipped in ./skills (generated from shared/ + host/dsh/).
 *  2. Own the per-role subagent model / reasoning-effort configuration
 *     (~/.dsh/steward/subagent-config.json) and expose it to the agent through
 *     `steward_config` / `steward_dispatch`.
 *  3. Serve the Settings → Steward page through /api/dsh-steward/*.
 *
 * Only Node builtins are imported: the bundle is installed as a local link, so
 * external packages would not resolve from the linked package path.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROLES_DIR = path.join(HERE, 'roles');
const SKILLS_DIR = path.join(HERE, 'skills');
const CONFIG_VERSION = 1;
const BRIDGE_PREFIX = '/api/dsh-steward';
const MAX_BODY_BYTES = 256 * 1024;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

const ROLE_MANIFEST = readJson(path.join(ROLES_DIR, 'manifest.json'), { roles: [] });
const SKILL_MANIFEST = readJson(path.join(SKILLS_DIR, 'manifest.json'), { skills: [] });
const ROLES = Array.isArray(ROLE_MANIFEST.roles) ? ROLE_MANIFEST.roles : [];
const ROLE_IDS = ROLES.map((role) => role.id);
const ROLE_BY_ID = new Map(ROLES.map((role) => [role.id, role]));

function dshHome() {
  const fromEnv = process.env.DSH_HOME;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return path.resolve(fromEnv);
  return path.join(os.homedir(), '.dsh');
}

function configPath() {
  return path.join(dshHome(), 'steward', 'subagent-config.json');
}

function emptySelection() {
  return { provider: '', model: '', effort: '' };
}

function emptyConfig() {
  return { version: CONFIG_VERSION, updatedAt: null, defaults: emptySelection(), roles: {} };
}

function normalizeSelection(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return emptySelection();
  const provider = typeof raw.provider === 'string' ? raw.provider.trim() : '';
  const model = typeof raw.model === 'string' ? raw.model.trim() : '';
  const effort = typeof raw.effort === 'string' ? raw.effort.trim() : '';
  // A route is provider+model together; a partial route is dropped instead of
  // being half-applied later.
  if (provider === '' || model === '') return emptySelection();
  return { provider, model, effort };
}

function normalizeConfig(raw) {
  const base = emptyConfig();
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return base;
  base.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : null;
  base.defaults = normalizeSelection(raw.defaults);
  const roles = raw.roles !== null && typeof raw.roles === 'object' && !Array.isArray(raw.roles) ? raw.roles : {};
  for (const id of ROLE_IDS) {
    const selection = normalizeSelection(roles[id]);
    if (selection.provider !== '') base.roles[id] = selection;
  }
  return base;
}

function loadConfig() {
  return normalizeConfig(readJson(configPath(), null));
}

function saveConfig(config) {
  const file = configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = JSON.stringify(
    { version: CONFIG_VERSION, updatedAt: new Date().toISOString(), defaults: config.defaults, roles: config.roles },
    null,
    2,
  );
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, payload, 'utf8');
  fs.renameSync(tmp, file);
  return normalizeConfig(JSON.parse(payload));
}

function effectiveFor(config, roleId) {
  const own = config.roles[roleId];
  if (own !== undefined && own.provider !== '' && own.model !== '') {
    return { provider: own.provider, model: own.model, effort: own.effort, source: 'role' };
  }
  if (config.defaults.provider !== '' && config.defaults.model !== '') {
    return { provider: config.defaults.provider, model: config.defaults.model, effort: config.defaults.effort, source: 'defaults' };
  }
  return { provider: '', model: '', effort: '', source: 'inherit' };
}

function stripFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').replace(/^\n+/, '');
}

/**
 * Project-level override: `<root>/steward.config.json` modelRouting.<role>.
 * Mirrors the ZCode/MiniMax precedence (project routing above plugin defaults,
 * below an explicit instruction from the user). Malformed entries are ignored:
 * validate-config.mjs owns reporting them.
 */
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

const rolePrompts = new Map();
function rolePrompt(roleId) {
  if (rolePrompts.has(roleId)) return rolePrompts.get(roleId);
  const role = ROLE_BY_ID.get(roleId);
  let text = '';
  if (role !== undefined) {
    try {
      text = stripFrontmatter(fs.readFileSync(path.join(HERE, role.path), 'utf8')).trim();
    } catch {
      text = '';
    }
  }
  rolePrompts.set(roleId, text);
  return text;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

const CATALOG_TTL_MS = 5 * 60 * 1000;
const catalogCache = { at: 0, value: null, building: null };

async function buildCatalog(llm) {
  const providers = [];
  let listed = [];
  try {
    listed = llm.listProviders();
  } catch (error) {
    throw new Error(`cannot list model providers: ${error instanceof Error ? error.message : String(error)}`);
  }
  await Promise.all(listed.map(async (provider) => {
    let models = [];
    try {
      models = await withTimeout(llm.listModels(provider.id), 2500);
    } catch {
      models = [];
    }
    if (!Array.isArray(models) || models.length === 0) return;
    const entries = await Promise.all(models.slice(0, 80).map(async (model) => {
      let info = null;
      try {
        info = await withTimeout(llm.resolveModelInfo(provider.id, model.id), 2000);
      } catch {
        info = null;
      }
      const efforts = Array.isArray(info?.reasoning?.efforts)
        ? info.reasoning.efforts.map((effort) => ({ id: String(effort.id), name: String(effort.name ?? effort.id) }))
        : [];
      const defaultEffort = info?.reasoning?.defaultEffort === undefined ? '' : String(info.reasoning.defaultEffort);
      return { id: String(model.id), name: String(model.name ?? model.id), efforts, defaultEffort };
    }));
    providers.push({ id: String(provider.id), name: String(provider.name ?? provider.id), models: entries });
  }));
  providers.sort((a, b) => a.name.localeCompare(b.name));
  return providers;
}

async function getCatalog(llm, refresh) {
  if (!refresh && catalogCache.value !== null && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.value;
  if (catalogCache.building !== null) return catalogCache.building;
  catalogCache.building = buildCatalog(llm)
    .then((providers) => {
      catalogCache.value = providers;
      catalogCache.at = Date.now();
      return providers;
    })
    .finally(() => { catalogCache.building = null; });
  return catalogCache.building;
}

function findModel(providers, providerId, modelId) {
  const provider = providers.find((entry) => entry.id === providerId);
  if (provider === undefined) return null;
  return provider.models.find((entry) => entry.id === modelId) ?? null;
}

/** Validate a full configuration against the live catalog; returns an error string or null. */
function validateConfig(config, providers) {
  const check = (label, selection) => {
    if (selection.provider === '' && selection.model === '') {
      if (selection.effort !== '') return `${label}：模型为空时不能单独设置思考强度`;
      return null;
    }
    const model = findModel(providers, selection.provider, selection.model);
    if (model === null) return `${label}：模型 ${selection.provider}/${selection.model} 不在当前模型目录中`;
    if (selection.effort !== '' && !model.efforts.some((effort) => effort.id === selection.effort)) {
      return `${label}：模型 ${selection.provider}/${selection.model} 不支持思考强度 "${selection.effort}"（支持：${model.efforts.map((effort) => effort.id).join(', ') || '无'}）`;
    }
    return null;
  };
  const defaultsError = check('默认配置', config.defaults);
  if (defaultsError !== null) return defaultsError;
  for (const id of ROLE_IDS) {
    const selection = config.roles[id];
    if (selection === undefined) continue;
    const error = check(`角色 ${id}`, selection);
    if (error !== null) return error;
  }
  return null;
}

function roleState(config, providers) {
  return ROLES.map((role) => {
    const effective = effectiveFor(config, role.id);
    return {
      id: role.id,
      name: role.name ?? role.id,
      description: role.description ?? '',
      provider: effective.provider,
      model: effective.model,
      effort: effective.effort,
      source: effective.source,
    };
  });
}

function publicState(config, providers, childProvider) {
  return {
    version: CONFIG_VERSION,
    configPath: configPath(),
    updatedAt: config.updatedAt,
    config: {
      defaults: { ...config.defaults },
      roles: Object.fromEntries(Object.entries(config.roles).map(([id, selection]) => [id, { ...selection }])),
    },
    defaults: { ...config.defaults },
    roles: roleState(config, providers),
    providers,
    childProvider,
  };
}

async function resolveChildProvider(ctx) {
  const subagents = ctx.get('subagents');
  if (subagents === undefined) return { name: 'spawn', available: false, agentOptions: false };
  const provider = subagents.getProvider('spawn');
  if (provider === undefined) {
    const names = typeof subagents.list === 'function' ? subagents.list() : [];
    return { name: 'spawn', available: false, agentOptions: false, providers: names };
  }
  return {
    name: provider.name,
    available: true,
    agentOptions: Boolean(provider.capabilities?.agentOptions),
    continuable: typeof provider.prepareContinuable === 'function',
  };
}

function jsonSchemaString(description) {
  return { type: 'string', description };
}

function roleEnum() {
  return ROLE_IDS.slice();
}

function toolError(message) {
  return new Error(message);
}

function textBlocks(text) {
  return [{ type: 'text', text }];
}

function summarizeRoles(config, providers) {
  return roleState(config, providers).map((role) => {
    const route = role.source === 'inherit' ? '继承主代理' : `${role.provider}/${role.model}${role.effort === '' ? '' : ` @ ${role.effort}`}`;
    return `- ${role.id}（${role.name}）：${route}（来源：${role.source === 'role' ? '角色配置' : role.source === 'defaults' ? '默认配置' : '继承主代理'}）`;
  }).join('\n');
}

function defineStewardTools(ctx) {
  const tools = ctx.get('tools');
  if (tools === undefined) return;

  const configTool = {
    name: 'steward_config',
    description: 'Read or change the Steward subagent model configuration (per-role provider/model/reasoning effort). Use action="list" to show the current roster and the live model catalog, action="set" to change one role or the defaults, action="reset" to clear one role or everything. The same state is edited by the Settings → Steward page; changes apply to the next steward_dispatch call.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['list', 'set', 'reset'], description: 'Operation to perform.' },
        role: { type: 'string', enum: roleEnum(), description: 'Role id for set/reset. Omit to edit the defaults (set) or reset everything (reset).' },
        provider: jsonSchemaString('LLM provider id (with model). Empty string clears the selection.'),
        model: jsonSchemaString('Model id within the provider (with provider).'),
        effort: jsonSchemaString('Reasoning effort id supported by the model; empty string uses the model default.'),
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string' },
          configPath: { type: 'string' },
          defaults: {
            type: 'object',
            additionalProperties: false,
            properties: { provider: { type: 'string' }, model: { type: 'string' }, effort: { type: 'string' } },
            required: ['provider', 'model', 'effort'],
          },
          roles: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                provider: { type: 'string' },
                model: { type: 'string' },
                effort: { type: 'string' },
                source: { type: 'string' },
              },
              required: ['id', 'name', 'provider', 'model', 'effort', 'source'],
            },
          },
          providers: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                models: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      efforts: { type: 'array', items: { type: 'string' } },
                      defaultEffort: { type: 'string' },
                    },
                    required: ['id', 'name', 'efforts', 'defaultEffort'],
                  },
                },
              },
              required: ['id', 'name', 'models'],
            },
          },
        },
        required: ['action', 'configPath', 'defaults', 'roles', 'providers'],
      },
      render: (_args, value) => textBlocks(
        `${value.action === 'list' ? '当前 Steward 子代理配置' : value.action === 'set' ? '已更新 Steward 子代理配置' : '已重置 Steward 子代理配置'}（${value.configPath}）\n` +
        value.roles.map((role) => `- ${role.id}：${role.provider === '' ? '继承主代理' : `${role.provider}/${role.model}${role.effort === '' ? '' : ` @ ${role.effort}`}`}（${role.source}）`).join('\n'),
      ),
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const action = String(args?.action ?? '');
      const llm = ctx.get('llm');
      if (llm === undefined) throw toolError('cannot read or validate the model catalog: the llm service is unavailable');
      const providers = await getCatalog(llm, args?.refresh === true);
      let config = loadConfig();
      if (action === 'list') {
        return {
          action: 'list',
          configPath: configPath(),
          defaults: config.defaults,
          roles: roleState(config, providers).map(({ id, name, provider, model, effort, source }) => ({ id, name, provider, model, effort, source })),
          providers: providers.map((provider) => ({
            id: provider.id,
            name: provider.name,
            models: provider.models.map((model) => ({ id: model.id, name: model.name, efforts: model.efforts.map((effort) => effort.id), defaultEffort: model.defaultEffort })),
          })),
        };
      }
      if (action === 'set') {
        const rawProvider = String(args?.provider ?? '').trim();
        const rawModel = String(args?.model ?? '').trim();
        const rawEffort = String(args?.effort ?? '').trim();
        const selection = normalizeSelection({ provider: rawProvider, model: rawModel, effort: rawEffort });
        if (selection.provider === '' && (rawProvider !== '' || rawModel !== '')) {
          throw toolError('provider and model must be supplied together (or both empty to inherit)');
        }
        if (selection.provider === '' && rawEffort !== '') {
          throw toolError('reasoning effort requires a provider and model; clear the effort or supply the route');
        }
        if (args?.role !== undefined) {
          if (!ROLE_IDS.includes(args.role)) throw toolError(`unknown role "${args.role}"`);
          if (selection.provider === '') delete config.roles[args.role];
          else config.roles[args.role] = selection;
        } else {
          config.defaults = selection;
        }
        const invalid = validateConfig(config, providers);
        if (invalid !== null) throw toolError(invalid);
        config = saveConfig(config);
      } else if (action === 'reset') {
        if (args?.role !== undefined) {
          if (!ROLE_IDS.includes(args.role)) throw toolError(`unknown role "${args.role}"`);
          delete config.roles[args.role];
        } else {
          config = emptyConfig();
        }
        config = saveConfig(config);
      } else {
        throw toolError(`unknown action "${action}" (expected list/set/reset)`);
      }
      return {
        action: action === 'reset' ? 'reset' : 'set',
        configPath: configPath(),
        defaults: config.defaults,
        roles: roleState(config, providers).map(({ id, name, provider, model, effort, source }) => ({ id, name, provider, model, effort, source })),
        providers: providers.map((provider) => ({
          id: provider.id,
          name: provider.name,
          models: provider.models.map((model) => ({ id: model.id, name: model.name, efforts: model.efforts.map((effort) => effort.id), defaultEffort: model.defaultEffort })),
        })),
      };
    },
  };

  ctx.effect(() => tools.register(configTool), 'steward: steward_config tool');

  const dispatchTool = {
    name: 'steward_dispatch',
    description: 'Dispatch one Steward specialist subagent by role (pm, architect, backend-dev, frontend-dev, qa-engineer, browser-tester, reviewer). The child uses the model and reasoning effort configured for that role (Settings → Steward), falling back to the Steward defaults and then to the parent route; a project `steward.config.json` modelRouting entry for the role overrides the settings page. Returns the child session id immediately; the child sends its final result back as a completion notice. The prompt must be self-contained — the child does not see this conversation. Use one call per task, and start independent tasks in the same message.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        role: { type: 'string', enum: roleEnum(), description: 'Steward role to dispatch.' },
        description: { type: 'string', description: 'A short (3-5 word) description of the delegated task, for display.' },
        prompt: { type: 'string', description: 'The complete, self-contained task: goal, repository root, artifact paths, file ownership, acceptance criteria and report destination.' },
        cwd: { type: 'string', description: 'Initial child working directory; relative paths resolve against the current directory. Omit to inherit.' },
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
          provider: { type: 'string' },
          model: { type: 'string' },
          effort: { type: 'string' },
          source: { type: 'string' },
        },
        required: ['kind', 'childId', 'role', 'provider', 'model', 'effort', 'source'],
      },
      render: (_args, value) => textBlocks(
        `started steward subagent ${value.childId} (role ${value.role}; ${value.provider === '' ? 'inherited parent model' : `${value.provider}/${value.model}${value.effort === '' ? '' : ` @ ${value.effort}`}`})`,
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
      const providerName = 'spawn';
      const provider = subagents.getProvider(providerName);
      if (provider === undefined) throw toolError(`the "${providerName}" subagent provider is not registered`);

      const config = loadConfig();
      const baseDir = await resolveBaseDirectory(ctx, parent, args);
      const projectRoute = projectRouteFor(roleId, baseDir);
      const effective = projectRoute === null ? effectiveFor(config, roleId) : projectRoute;
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
          throw toolError(`subagent provider "${providerName}" does not support child agentOptions; clear the role model configuration or switch providers`);
        }
      }

      const roleText = rolePrompt(roleId);
      const promptText = roleText === ''
        ? `## 任务（来自 Tech Lead）\n\n${String(args.prompt)}`
        : `${roleText}\n\n---\n\n## 任务（来自 Tech Lead）\n\n${String(args.prompt)}`;
      const request = {
        prompt: [{ type: 'text', text: promptText }],
        parent,
        ...(typeof args?.cwd === 'string' && args.cwd !== '' ? { cwd: args.cwd } : {}),
        ...(agentOptions === undefined ? {} : { agentOptions }),
      };
      const activation = await subagents.startActivation({
        provider: providerName,
        label: String(args?.description ?? roleId),
        request,
        signal: exec.signal,
        delivery: 'parent',
      });
      return {
        kind: 'activation',
        childId: String(activation.childId),
        role: roleId,
        provider: effective.provider,
        model: effective.model,
        effort: effective.effort,
        source: effective.source,
      };
    },
  };

  ctx.effect(() => tools.register(dispatchTool), 'steward: steward_dispatch tool');
}

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
        sctx.logger?.warn?.(`steward: could not register skill "${skill.name}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });
}

function isSameOrigin(request) {
  if (request.headers['sec-fetch-site'] === 'cross-site') return false;
  const host = request.headers.host;
  if (typeof host !== 'string' || host === '') return false;
  const origin = request.headers.origin;
  if (typeof origin === 'string' && origin !== '') {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return true;
}

function readJsonBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve({ ok: false, message: 'request body too large' });
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve({ ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
      } catch {
        resolve({ ok: false, message: 'malformed JSON body' });
      }
    });
    request.on('error', (error) => resolve({ ok: false, message: error instanceof Error ? error.message : String(error) }));
  });
}

function writeJson(response, status, body) {
  if (response.writableEnded) return;
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
  response.end(JSON.stringify(body));
}

function registerBridge(ctx) {
  ctx.inject(['webServer', 'llm'], (sctx) => {
    const llm = sctx.llm;
    const state = async (request, response) => {
      if (!isSameOrigin(request)) return writeJson(response, 403, { ok: false, code: 'forbidden', message: 'same-origin requests only' });
      if (request.method !== 'GET') return writeJson(response, 405, { ok: false, code: 'method-not-allowed', message: 'GET only' });
      try {
        const url = new URL(request.url ?? '/', 'http://localhost');
        const refresh = url.searchParams.get('refresh') === '1';
        const providers = await getCatalog(llm, refresh);
        const config = loadConfig();
        const childProvider = await resolveChildProvider(sctx);
        return writeJson(response, 200, { ok: true, value: publicState(config, providers, childProvider) });
      } catch (error) {
        return writeJson(response, 500, { ok: false, code: 'state-failed', message: error instanceof Error ? error.message : String(error) });
      }
    };
    const save = async (request, response) => {
      if (!isSameOrigin(request)) return writeJson(response, 403, { ok: false, code: 'forbidden', message: 'same-origin requests only' });
      if (request.method !== 'POST') return writeJson(response, 405, { ok: false, code: 'method-not-allowed', message: 'POST only' });
      const body = await readJsonBody(request);
      if (!body.ok) return writeJson(response, 400, { ok: false, code: 'bad-request', message: body.message });
      try {
        const providers = await getCatalog(llm, false);
        const incoming = body.value?.config ?? body.value;
        const candidate = normalizeConfig(incoming);
        const invalid = validateConfig(candidate, providers);
        if (invalid !== null) return writeJson(response, 200, { ok: false, code: 'invalid-config', message: invalid });
        const config = saveConfig(candidate);
        const childProvider = await resolveChildProvider(sctx);
        return writeJson(response, 200, { ok: true, value: publicState(config, providers, childProvider) });
      } catch (error) {
        return writeJson(response, 500, { ok: false, code: 'save-failed', message: error instanceof Error ? error.message : String(error) });
      }
    };
    const reset = async (request, response) => {
      if (!isSameOrigin(request)) return writeJson(response, 403, { ok: false, code: 'forbidden', message: 'same-origin requests only' });
      if (request.method !== 'POST') return writeJson(response, 405, { ok: false, code: 'method-not-allowed', message: 'POST only' });
      const body = await readJsonBody(request);
      if (!body.ok) return writeJson(response, 400, { ok: false, code: 'bad-request', message: body.message });
      try {
        const role = body.value?.role;
        let config = loadConfig();
        if (typeof role === 'string' && role !== '') {
          if (!ROLE_IDS.includes(role)) return writeJson(response, 400, { ok: false, code: 'unknown-role', message: `unknown role "${role}"` });
          delete config.roles[role];
        } else {
          config = emptyConfig();
        }
        config = saveConfig(config);
        const providers = await getCatalog(llm, false);
        const childProvider = await resolveChildProvider(sctx);
        return writeJson(response, 200, { ok: true, value: publicState(config, providers, childProvider) });
      } catch (error) {
        return writeJson(response, 500, { ok: false, code: 'reset-failed', message: error instanceof Error ? error.message : String(error) });
      }
    };
    const routes = [
      [`${BRIDGE_PREFIX}/state`, state],
      [`${BRIDGE_PREFIX}/config`, save],
      [`${BRIDGE_PREFIX}/reset`, reset],
    ];
    for (const [routePath, handler] of routes) {
      try {
        sctx.effect(() => sctx.webServer.register({ kind: 'exact', path: routePath, handler }), `steward: route ${routePath}`);
      } catch (error) {
        sctx.logger?.warn?.(`steward: could not register ${routePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });
}

export const name = 'dsh-steward';
export const inject = ['tools'];

export function apply(ctx) {
  registerSkills(ctx);
  defineStewardTools(ctx);
  registerBridge(ctx);
  try {
    ctx.logger?.info?.(`steward: ${SKILL_MANIFEST.skills?.length ?? 0} skills, ${ROLES.length} roles, config at ${configPath()}`);
  } catch {
    // logging is best effort
  }
}
