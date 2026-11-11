/**
 * dsh-steward — Host half, built on DSH-native extension points.
 *
 *  - Roles are declared as **Agent Presets** (`ctx.agentPresets`), each a real
 *    Cordis composition: persona + native tool plugins. A dispatched child is
 *    started with `agentPreset`, so its system prompt and tool set come from
 *    the preset rather than injected prose.
 *  - Per-role model routes live in this plugin's **Config** (`export const
 *    Config`), whose editable fields are `.volatile()`: they are served by the
 *    native Settings service (`settings` namespace `steward`), persist through
 *    the profile's config editor, and update in place without a restart.
 *  - `steward_dispatch` is a thin delegation tool over `ctx.subagents`: it
 *    resolves the role's preset + route and calls `startActivation`.
 *  - `steward_config` reads and writes the same native settings section.
 *  - `/steward` is registered on the native human-command registry.
 *  - Skills are registered on the native `ctx.skills` registry.
 *
 * The package is installed as a local link, so `@deepseek-ai/schemastery` is
 * resolved from the active profile's hoisted node_modules (see
 * `resolveSchemastery`); nothing else outside Node builtins is imported.
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
/** Agent preset ids are `<prefix><role id>`. */
const PRESET_PREFIX = 'steward-';
/** DSH in-process subagent backend that supports independent preset selection. */
const SUBAGENT_PROVIDER = 'spawn';

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

const ROLE_MANIFEST = readJson(path.join(ROLES_DIR, 'manifest.json'), { roles: [] });
const SKILL_MANIFEST = readJson(path.join(SKILLS_DIR, 'manifest.json'), { skills: [] });
const ROLES = Array.isArray(ROLE_MANIFEST.roles) ? ROLE_MANIFEST.roles : [];
const ROLE_IDS = ROLES.map((role) => role.id);
const ROLE_BY_ID = new Map(ROLES.map((role) => [role.id, role]));

// --- Config: native DSH settings -------------------------------------------------

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
}).description('Steward 子代理的模型与思考强度（DSH 原生设置：设置 → Steward，保存后下一次派发立即生效）');

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

function effectiveFor(config, roleId) {
  const own = config.roles[roleId];
  if (own !== undefined && own.provider !== '' && own.model !== '') return { ...own, source: 'role' };
  if (config.defaults.provider !== '' && config.defaults.model !== '') return { ...config.defaults, source: 'defaults' };
  return { ...emptySelection(), source: 'inherit' };
}

async function saveConfig(ctx, patch) {
  const settings = ctx.get('settings');
  if (settings === undefined || typeof settings.update !== 'function') {
    throw new Error('the native settings service is unavailable in this profile; cannot persist the Steward configuration');
  }
  await settings.update(CONFIG_NS, patch);
}

// --- Roles → Agent Presets -------------------------------------------------------

const rolePersonas = new Map();

function rolePersona(roleId) {
  if (rolePersonas.has(roleId)) return rolePersonas.get(roleId);
  const role = ROLE_BY_ID.get(roleId);
  let text = '';
  if (role !== undefined) {
    try {
      text = stripFrontmatter(fs.readFileSync(path.join(HERE, role.path), 'utf8')).replace(BANNER, '').trim();
    } catch {
      text = '';
    }
  }
  rolePersonas.set(roleId, text);
  return text;
}

function presetIdFor(roleId) {
  return `${PRESET_PREFIX}${roleId}`;
}

function shellToolEntry() {
  return process.platform === 'win32'
    ? { id: 'tool-pwsh', name: '@deepseek-ai/dsh-tool-pwsh' }
    : { id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash' };
}

/** The native plugin list every Steward specialist preset composes. */
function presetPlugins(persona) {
  return [
    { id: 'persona', name: '@deepseek-ai/dsh-persona', config: { prefix: persona } },
    { id: 'agent-instructions', name: '@deepseek-ai/dsh-agent-instructions', config: { maxBytes: 65536 } },
    { id: 'time-context', name: '@deepseek-ai/dsh-time-context' },
    shellToolEntry(),
    { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs', config: { applyPatch: false } },
    { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } },
    { id: 'tool-todo', name: '@deepseek-ai/dsh-tool-todo', config: { allowParallelInProgress: true } },
    { id: 'tool-web', name: '@deepseek-ai/dsh-tool-web', config: { fetch: true, searchTimeoutMs: 60000 } },
    { id: 'skill-filesystem', name: '@deepseek-ai/dsh-skill-filesystem' },
    { id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill' },
    { id: 'present', name: '@deepseek-ai/dsh-tool-present' },
    {
      id: 'compaction',
      name: 'cordis:group',
      group: true,
      isolate: { compaction: true, toolResultPruner: true },
      config: [
        { id: 'compaction-basic', name: '@deepseek-ai/dsh-compaction-basic' },
        { id: 'command-compact', name: '@deepseek-ai/dsh-command-compact' },
        { id: 'tool-result-pruner', name: '@deepseek-ai/dsh-compaction-tool-result-pruner', config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 } },
      ],
    },
  ];
}

function buildPreset(role, index) {
  return {
    id: presetIdFor(role.id),
    name: `Steward · ${role.name ?? role.id}`,
    description: `Steward ${role.name ?? role.id}（${role.id}）：${role.description ?? ''}`.trim(),
    order: 100 + index,
    plugins: presetPlugins(rolePersona(role.id)),
  };
}

function registerPresets(ctx) {
  ctx.inject(['agentPresets'], (sctx) => {
    for (const [index, role] of ROLES.entries()) {
      const definition = buildPreset(role, index);
      let cancelled = false;
      let dispose = null;
      sctx.effect(() => {
        Promise.resolve(sctx.agentPresets.register(definition)).then((disposer) => {
          if (cancelled) {
            Promise.resolve(disposer()).catch(() => {});
            return;
          }
          dispose = disposer;
        }).catch((error) => {
          sctx.logger?.warn?.(`steward: could not register agent preset ${definition.id}: ${errorMessage(error)}`);
        });
        return async () => {
          cancelled = true;
          const disposer = dispose;
          dispose = null;
          if (typeof disposer === 'function') {
            try {
              await disposer();
            } catch {
              // preset disposal is best effort
            }
          }
        };
      }, `steward: preset ${definition.id}`);
    }
  });
}

async function assertPresetReady(ctx, presetId) {
  const presets = ctx.get('agentPresets');
  if (presets === undefined || typeof presets.resolve !== 'function') return;
  let preset;
  try {
    preset = await presets.resolve(presetId);
  } catch (error) {
    throw new Error(`Steward role preset ${presetId} is not available: ${errorMessage(error)}`);
  }
  if (preset === undefined || preset === null) {
    throw new Error(`Steward role preset ${presetId} is not registered (the plugin may still be loading)`);
  }
  if (typeof preset.broken === 'string' && preset.broken !== '') {
    throw new Error(`Steward role preset ${presetId} failed to activate: ${preset.broken}`);
  }
}

// --- Subagent model catalog ------------------------------------------------------

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
    throw new Error(`cannot list model providers: ${errorMessage(error)}`);
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

/** Validate every configured route against the live catalog; returns an error string or null. */
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
    const error = check(`角色 ${id}`, config.roles[id] ?? emptySelection());
    if (error !== null) return error;
  }
  return null;
}

function publicProviders(providers) {
  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    models: provider.models.map((model) => ({
      id: model.id,
      name: model.name,
      efforts: model.efforts.map((effort) => effort.id),
      defaultEffort: model.defaultEffort,
    })),
  }));
}

function roleState(config) {
  return ROLES.map((role) => {
    const effective = effectiveFor(config, role.id);
    return {
      id: role.id,
      name: role.name ?? role.id,
      description: role.description ?? '',
      preset: presetIdFor(role.id),
      provider: effective.provider,
      model: effective.model,
      effort: effective.effort,
      source: effective.source,
    };
  });
}

function routeText(role) {
  return role.provider === '' ? '继承主代理' : `${role.provider}/${role.model}${role.effort === '' ? '' : ` @ ${role.effort}`}`;
}

function sourceText(source) {
  if (source === 'role') return '角色配置';
  if (source === 'defaults') return '默认配置';
  return '继承主代理';
}

// --- Project-level routing override ---------------------------------------------

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

// --- Tools -----------------------------------------------------------------------

function toolError(message) {
  return new Error(message);
}

function textBlocks(text) {
  return [{ type: 'text', text }];
}

function identifierSchema(description) {
  return { type: 'string', description };
}

function defineStewardTools(ctx, config) {
  const tools = ctx.get('tools');
  if (tools === undefined) return;

  const configTool = {
    name: 'steward_config',
    description: 'Read or change the Steward subagent model routes (per-role provider/model/reasoning effort) and inspect the live model catalog. This is the same DSH-native settings section (`steward`) edited on the Settings → Steward page; changes apply to the next steward_dispatch call. Use action="list" to show the roster, action="set" to change one role or the defaults, action="reset" to clear one role or everything.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { type: 'string', enum: ['list', 'set', 'reset'], description: 'Operation to perform.' },
        role: { type: 'string', enum: ROLE_IDS.slice(), description: 'Role id for set/reset. Omit to edit the defaults (set) or reset everything (reset).' },
        provider: identifierSchema('LLM provider id (with model). Empty string clears the selection.'),
        model: identifierSchema('Model id within the provider (with provider).'),
        effort: identifierSchema('Reasoning effort id supported by the model; empty string uses the model default.'),
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string' },
          namespace: { type: 'string' },
          documentPath: { type: 'string' },
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
                description: { type: 'string' },
                preset: { type: 'string' },
                provider: { type: 'string' },
                model: { type: 'string' },
                effort: { type: 'string' },
                source: { type: 'string' },
              },
              required: ['id', 'name', 'description', 'preset', 'provider', 'model', 'effort', 'source'],
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
        required: ['action', 'namespace', 'documentPath', 'defaults', 'roles', 'providers'],
      },
      render: (_args, value) => textBlocks(
        `${value.action === 'list' ? '当前 Steward 子代理路由' : value.action === 'set' ? '已更新 Steward 子代理路由' : '已重置 Steward 子代理路由'}（DSH 设置命名空间：${value.namespace}${value.documentPath === '' ? '' : `，${value.documentPath}`}）\n`
        + value.roles.map((role) => `- ${role.id}（${role.name}）：${role.provider === '' ? '继承主代理' : `${role.provider}/${role.model}${role.effort === '' ? '' : ` @ ${role.effort}`}`}（${role.source === 'inherit' ? '' : `${sourceText(role.source)}；`}preset ${role.preset}）`).join('\n'),
      ),
    },
    isConcurrencySafe: () => false,
    async execute(args) {
      const action = String(args?.action ?? '');
      const llm = ctx.get('llm');
      if (llm === undefined) throw toolError('cannot read or validate the model catalog: the llm service is unavailable');
      const providers = await getCatalog(llm, args?.refresh === true);
      let snapshot = normalizeConfig(currentConfig(ctx, config));
      if (action === 'list') {
        // read-only
      } else if (action === 'set') {
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
          snapshot.roles[args.role] = selection;
        } else {
          snapshot.defaults = selection;
        }
        const invalid = validateConfig(snapshot, providers);
        if (invalid !== null) throw toolError(invalid);
        await saveConfig(ctx, args?.role === undefined ? { defaults: selection } : { roles: { [args.role]: selection } });
        snapshot = normalizeConfig(currentConfig(ctx, config));
      } else if (action === 'reset') {
        if (args?.role !== undefined && !ROLE_IDS.includes(args.role)) throw toolError(`unknown role "${args.role}"`);
        const empty = emptySelection();
        if (args?.role !== undefined) {
          snapshot.roles[args.role] = empty;
          await saveConfig(ctx, { roles: { [args.role]: empty } });
        } else {
          snapshot = normalizeConfig({ defaults: empty, roles: Object.fromEntries(ROLE_IDS.map((id) => [id, empty])) });
          await saveConfig(ctx, { defaults: empty, roles: snapshot.roles });
        }
        snapshot = normalizeConfig(currentConfig(ctx, config));
      } else {
        throw toolError(`unknown action "${action}" (expected list/set/reset)`);
      }
      return {
        action: action === 'reset' ? 'reset' : action === 'set' ? 'set' : 'list',
        namespace: CONFIG_NS,
        documentPath: settingsDocumentPath(ctx),
        defaults: snapshot.defaults,
        roles: roleState(snapshot),
        providers: publicProviders(providers),
      };
    },
  };

  ctx.effect(() => tools.register(configTool), 'steward: steward_config tool');

  const dispatchTool = {
    name: 'steward_dispatch',
    description: 'Dispatch one Steward specialist subagent by role (pm, architect, backend-dev, frontend-dev, qa-engineer, browser-tester, reviewer). The child runs the DSH agent preset `steward-<role>` (its persona and tool composition), with the model and reasoning effort configured for that role on Settings → Steward, falling back to the Steward defaults and then to the parent route; a project `steward.config.json` modelRouting entry overrides the settings page. Returns the child session id immediately; the child sends its final result back as a completion notice. The prompt must be self-contained because the child does not see this conversation. Use one call per task.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        role: { type: 'string', enum: ROLE_IDS.slice(), description: 'Steward role to dispatch.' },
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
          preset: { type: 'string' },
          provider: { type: 'string' },
          model: { type: 'string' },
          effort: { type: 'string' },
          source: { type: 'string' },
        },
        required: ['kind', 'childId', 'role', 'preset', 'provider', 'model', 'effort', 'source'],
      },
      render: (_args, value) => textBlocks(
        `started steward subagent ${value.childId} (role ${value.role}, preset ${value.preset}; ${value.provider === '' ? 'inherited parent model' : `${value.provider}/${value.model}${value.effort === '' ? '' : ` @ ${value.effort}`}`})`,
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
      const presetId = presetIdFor(roleId);
      await assertPresetReady(ctx, presetId);

      const snapshot = normalizeConfig(currentConfig(ctx, config));
      const baseDir = await resolveBaseDirectory(ctx, parent, args);
      const projectRoute = projectRouteFor(roleId, baseDir);
      const effective = projectRoute === null ? effectiveFor(snapshot, roleId) : projectRoute;
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

      const activation = await subagents.startActivation({
        provider: SUBAGENT_PROVIDER,
        label: String(args?.description ?? roleId),
        request: {
          prompt: [{ type: 'text', text: String(args?.prompt) }],
          parent,
          agentPreset: presetId,
          ...(typeof args?.cwd === 'string' && args.cwd !== '' ? { cwd: args.cwd } : {}),
          ...(agentOptions === undefined ? {} : { agentOptions }),
        },
        signal: exec.signal,
        delivery: 'parent',
      });
      return {
        kind: 'activation',
        childId: String(activation.childId),
        role: roleId,
        preset: presetId,
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

function renderRoster(ctx, config, topic) {
  const snapshot = normalizeConfig(currentConfig(ctx, config));
  const routes = roleState(snapshot);
  const header = 'Steward 团队（DSH 原生 Agent Presets + 原生 Settings）';
  const lines = [header, ''];
  if (topic === 'models' || topic === 'roles' || topic === '') {
    for (const role of routes) {
      const source = role.source === 'inherit' ? '' : ` · ${sourceText(role.source)}`;
      lines.push(`- ${role.id}（${role.name}）→ preset \`${role.preset}\` · ${routeText(role)}${source}`);
    }
    lines.push('');
  }
  lines.push(`模型路由：设置 → Steward（命名空间 \`${CONFIG_NS}\`${settingsDocumentPath(ctx) === '' ? '' : `，${settingsDocumentPath(ctx)}`}）或 \`steward_config\` 工具`);
  lines.push('派发：主代理调用 `steward_dispatch(role=..., description=..., prompt=...)`；子代理以对应 preset 启动，prompt 必须自包含。');
  return lines.join('\n');
}

function registerCommands(ctx, config) {
  ctx.inject(['commands'], (sctx) => {
    const definition = {
      name: 'steward',
      description: '显示 Steward 团队名册、角色预设与子代理模型路由（DSH 原生 Settings / Agent Presets）',
      input: { hint: '[roles|models|help]' },
      handler: (invocation) => {
        try {
          return { kind: 'success', text: renderRoster(ctx, config, String(invocation?.rawInput ?? '').trim().toLowerCase()) };
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
  registerPresets(ctx);
  defineStewardTools(ctx, config);
  registerCommands(ctx, config);
  try {
    ctx.logger?.info?.(`steward: ${SKILL_MANIFEST.skills?.length ?? 0} skills, ${ROLES.length} role presets, settings namespace ${CONFIG_NS}`);
  } catch {
    // logging is best effort
  }
}
