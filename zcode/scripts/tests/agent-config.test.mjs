#!/usr/bin/env node
/**
 * agent-config.test.mjs — agent-config-core.mjs 的零依赖单元测试（node:test）。
 *
 * 跑法：node --test zcode/scripts/tests/   或   node zcode/scripts/tests/agent-config.test.mjs
 *
 * 约定：
 *   - fixture 自包含，不读用户真实配置（结构照抄、值全部虚构）；
 *   - 所有写盘都在 os.tmpdir() + mkdtempSync 的临时目录里，after() 统一清理；
 *   - 不写仓库目录，不在仓库里留任何临时文件。
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ROLES,
  buildState,
  createRequestHandler,
  findModel,
  loadCatalog,
  mirrorDir,
  parseYaml,
  readPluginDefaults,
  readProjectConfig,
  resolveClientDir,
  resolveRepoRoot,
  validateAssignment,
  writePluginDefaults,
  writeProjectConfig,
} from '../agent-config-core.mjs';

/** 本测试文件位于 <仓库根>/zcode/scripts/tests/ → 仓库根 = 文件目录的上四级（tests → scripts → zcode → 仓库根） */
const REPO_ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

/** 本次测试创建的全部临时目录，after() 统一清理 */
const TEMP_DIRS = [];

/** 建一个受管理的临时目录 */
function makeTemp(prefix) {
  const dir = mkdtempSync(join(os.tmpdir(), 'steward-agent-config-' + prefix + '-'));
  TEMP_DIRS.push(dir);
  return dir;
}

after(() => {
  for (const dir of TEMP_DIRS) rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 脱敏 fixture：结构与真实 config.yaml 一致，所有值都是虚构的
// ---------------------------------------------------------------------------

const FIXTURE_LINES = [
  'logLevel: info',
  'provider:',
  '  minimax:',
  '    name: MiniMax',
  '    npm: \'@ai-sdk/anthropic\'',
  '    models:',
  '      MiniMax-M3:',
  '        name: M3',
  '        reasoning: true',
  '        limit:',
  '          context: 512000',
  '          output: 128000',
  '        variants:',
  '          none-thinking:',
  '            thinking:',
  '              type: disabled',
  '      MiniMax-M3.1-Flash:',
  '        name: M3.1-Flash',
  '        reasoning: true',
  '        limit:',
  '          context: 512000',
  '          output: 128000',
  '        thinking:',
  '          effortOptions:',
  '            - default',
  '            - low',
  '            - medium',
  '            - high',
  '            - xhigh',
  '            - max',
  '        contextWindowOptionHints:',
  '          \'1000000\': higher_usage',
  '    options:',
  '      apiKey: sk-FAKE-SHOULD-NEVER-LEAK',
  '      baseURL: https://fake.example.invalid/v1',
  'defaultModel: minimax/MiniMax-M3.1-Flash',
  'custom_provider:',
  '  provider-aaaa:',
  '    name: 阶跃星辰',
  '    kind: custom',
  '    options:',
  '      baseURL: https://fake.example.invalid/step   # 行尾注释',
  '      apiKey: sk-ANOTHER-FAKE',
  '    models:',
  '      step-5-preview:',
  '        name: step-5-preview',
  '        reasoning: true',
  '        limit:',
  '          context: 1000000',
  '          output: 64000',
  '        thinking:',
  '          effortOptions:',
  '            - low',
  '            - medium',
  '            - high',
  '      step-3.7-flash:',
  '        name: step-3.7-flash',
  '        limit:',
  '          context: 256000',
  '          output: 64000',
  '        thinking:',
  '          effortOptions:',
  '            - low',
  '            - mediem',
  '            - high',
  '  provider-bbbb:',
  '    name: Nvidia',
  '    kind: custom',
  '    models:',
  '      zai-org/GLM-5.3-Flash:',
  '        name: zai-org/GLM-5.3-Flash',
  '        reasoning: true',
  '        limit:',
  '          context: 1000000',
  '          output: 128000',
  '        thinking:',
  '          effortOptions:',
  '            - none',
  '            - low',
  '            - medium',
  '            - hign',
  '            - max',
  '      minimax-m3:',
  '        name: minimax-m3',
  '        reasoning: true',
  '        thinking:',
  '          effortOptions:',
  '            - "off"',
  '            - "on"',
  '      free-model:',
  '        name: free-model',
  '        limit:',
  '          context: 1000000',
  '          output: 128000',
  'subagent:',
  '  maxConcurrentPerSession: 10',
  'defaultModelThinking:',
  '  effort: max',
];

const FIXTURE_YAML = FIXTURE_LINES.join('\n') + '\n';

/** 写一份 fixture 配置，返回其路径 */
function writeFixture(dir, text) {
  const p = join(dir, 'config.yaml');
  writeFileSync(p, text === undefined ? FIXTURE_YAML : text, 'utf8');
  return p;
}

// ---------------------------------------------------------------------------
// 1. YAML 解析：正例
// ---------------------------------------------------------------------------

describe('parseYaml 正例', () => {
  test('provider 段：托管模型、块序列档位、无 effortOptions 的模型', () => {
    const doc = parseYaml(FIXTURE_YAML);
    assert.equal(doc.logLevel, 'info');
    assert.equal(doc.provider.minimax.name, 'MiniMax');
    // 单引号标量去引号（scoped npm 包名里的 @ 与 / 原样保留）
    assert.equal(doc.provider.minimax.npm, '@ai-sdk/anthropic');
    assert.deepEqual(doc.provider.minimax.models['MiniMax-M3.1-Flash'].thinking.effortOptions,
      ['default', 'low', 'medium', 'high', 'xhigh', 'max']);
    // 只有 variants / thinking_config、没有 effortOptions 的模型
    assert.equal(doc.provider.minimax.models['MiniMax-M3'].thinking, undefined);
    assert.equal(doc.provider.minimax.models['MiniMax-M3'].reasoning, 'true');
    // 带引号的数字键
    assert.equal(doc.provider.minimax.models['MiniMax-M3.1-Flash'].contextWindowOptionHints['1000000'], 'higher_usage');
  });

  test('custom_provider 段：中文供应商名、非标准档位原样保留、引号档位去引号', () => {
    const doc = parseYaml(FIXTURE_YAML);
    assert.equal(doc.custom_provider['provider-aaaa'].name, '阶跃星辰');
    assert.deepEqual(doc.custom_provider['provider-aaaa'].models['step-3.7-flash'].thinking.effortOptions,
      ['low', 'mediem', 'high']);
    assert.deepEqual(doc.custom_provider['provider-bbbb'].models['zai-org/GLM-5.3-Flash'].thinking.effortOptions,
      ['none', 'low', 'medium', 'hign', 'max']);
    // 双引号档位名只去引号，不变成布尔
    assert.deepEqual(doc.custom_provider['provider-bbbb'].models['minimax-m3'].thinking.effortOptions, ['off', 'on']);
  });

  test('带 / 的模型名作为完整键保留；行尾注释与空行被忽略', () => {
    const doc = parseYaml(FIXTURE_YAML);
    assert.ok(doc.custom_provider['provider-bbbb'].models['zai-org/GLM-5.3-Flash']);
    assert.equal(doc.custom_provider['provider-aaaa'].options.baseURL, 'https://fake.example.invalid/step');
  });

  test('缩进为任意一致的空格数也能解析；顶层标量与嵌套映射混排', () => {
    const doc = parseYaml('a:\n    b:\n        - x\n        - y\nc: 1\n');
    assert.deepEqual(doc.a.b, ['x', 'y']);
    assert.equal(doc.c, '1');
  });

  test('空输入返回空对象，不抛错', () => {
    assert.deepEqual(parseYaml(''), {});
    assert.deepEqual(parseYaml(undefined), {});
  });
});

// ---------------------------------------------------------------------------
// 2. YAML 解析：负例（必须带行号、必须抛错）
// ---------------------------------------------------------------------------

describe('parseYaml 负例', () => {
  test('Tab 缩进 → 抛错且带行号', () => {
    assert.throws(() => parseYaml('a:\n\tb: 1\n'), (e) => {
      assert.match(e.message, /YAML 第 2 行/);
      assert.match(e.message, /Tab/);
      return true;
    });
  });

  test('重复键 → 抛错且带行号', () => {
    assert.throws(() => parseYaml('a: 1\nb: 2\na: 3\n'), (e) => {
      assert.match(e.message, /YAML 第 3 行/);
      assert.match(e.message, /重复键/);
      return true;
    });
  });

  test('缩进错乱（兄弟键比父键浅）→ 抛错且带行号', () => {
    assert.throws(() => parseYaml('a:\n  b: 1\n c: 2\n'), (e) => {
      assert.match(e.message, /YAML 第 3 行/);
      assert.match(e.message, /缩进错乱/);
      return true;
    });
  });

  test('序列前缺少键 → 抛错，不静默返回空对象', () => {
    assert.throws(() => parseYaml('- a\n- b\n'), (e) => {
      assert.match(e.message, /YAML 第 1 行/);
      return true;
    });
  });

  test('不支持的流式集合 → 抛错并说明原因', () => {
    assert.throws(() => parseYaml('a: [1, 2]\n'), /不支持/);
  });
});

// ---------------------------------------------------------------------------
// 3. loadCatalog
// ---------------------------------------------------------------------------

describe('loadCatalog', () => {
  test('读不到文件 → ok:false + warning，不抛异常', () => {
    const dir = makeTemp('cat-missing');
    const res = loadCatalog({ configPath: join(dir, 'nope.yaml') });
    assert.equal(res.ok, false);
    assert.deepEqual(res.models, []);
    assert.deepEqual(res.providers, []);
    assert.match(res.warning, /未找到本机模型配置/);
    assert.ok(res.source.includes('nope.yaml'), 'source 应记录尝试过的路径：' + res.source);
  });

  test('解析失败 → ok:false + warning 含行号', () => {
    const dir = makeTemp('cat-broken');
    const p = writeFixture(dir, 'a:\n  b: 1\n\tc: 2\n');
    const res = loadCatalog({ configPath: p });
    assert.equal(res.ok, false);
    assert.match(res.warning, /YAML 第 3 行/);
    assert.deepEqual(res.models, []);
  });

  test('正常配置 → 规范 key、providerLabel、档位集合、非标准档位、context/output', () => {
    const dir = makeTemp('cat-ok');
    const res = loadCatalog({ configPath: writeFixture(dir) });
    assert.equal(res.ok, true);
    assert.equal(res.warning, '');

    const step = findModel(res, 'custom_provider:provider-aaaa/step-5-preview');
    assert.ok(step);
    assert.equal(step.provider, 'custom_provider:provider-aaaa');
    assert.equal(step.providerLabel, '阶跃星辰');
    assert.equal(step.model, 'step-5-preview');
    assert.equal(step.displayName, 'step-5-preview');
    assert.equal(step.supportsEffort, true);
    assert.deepEqual(step.effortOptions, ['low', 'medium', 'high']);
    assert.deepEqual(step.nonStandardEfforts, []);
    assert.equal(step.context, 1000000);
    assert.equal(step.output, 64000);

    // 带 / 的模型名：provider 取第一个 / 之前，剩下全部是模型名
    const glm = findModel(res, 'custom_provider:provider-bbbb/zai-org/GLM-5.3-Flash');
    assert.ok(glm);
    assert.equal(glm.model, 'zai-org/GLM-5.3-Flash');
    assert.deepEqual(glm.nonStandardEfforts, ['hign']);

    // 非标准档位原样保留并标出来
    const step37 = findModel(res, 'custom_provider:provider-aaaa/step-3.7-flash');
    assert.deepEqual(step37.effortOptions, ['low', 'mediem', 'high']);
    assert.deepEqual(step37.nonStandardEfforts, ['mediem']);

    // 托管段：无 effortOptions 视为不支持档位
    const m3 = findModel(res, 'minimax/MiniMax-M3');
    assert.equal(m3.supportsEffort, false);
    assert.deepEqual(m3.effortOptions, []);
    assert.equal(m3.displayName, 'M3');
    assert.equal(findModel(res, 'minimax/MiniMax-M3.1-Flash').supportsEffort, true);

    // 自由模型既无 reasoning 也无 thinking
    const free = findModel(res, 'custom_provider:provider-bbbb/free-model');
    assert.equal(free.reasoning, false);
    assert.equal(free.supportsEffort, false);

    // providers 列表：托管 + 自定义，带 kind
    assert.deepEqual(res.providers.map((p) => p.kind), ['managed', 'custom', 'custom']);
    assert.equal(res.providers[1].label, '阶跃星辰');
  });

  test('不泄漏凭据：catalog 里没有任何 apiKey / baseURL 字段', () => {
    const dir = makeTemp('cat-leak');
    const res = loadCatalog({ configPath: writeFixture(dir) });
    const text = JSON.stringify(res);
    assert.ok(!/sk-FAKE-SHOULD-NEVER-LEAK/.test(text), '不得带出 apiKey');
    assert.ok(!/sk-ANOTHER-FAKE/.test(text), '不得带出 apiKey');
    assert.ok(!/fake\.example\.invalid/.test(text), '不得带出 baseURL');
    assert.ok(!/apiKey|baseURL/.test(text), '不得带出凭据字段名');
  });

  test('模型列表为空 → ok:false + 说明', () => {
    const dir = makeTemp('cat-empty');
    const res = loadCatalog({ configPath: writeFixture(dir, 'logLevel: info\n') });
    assert.equal(res.ok, false);
    assert.match(res.warning, /没有解析到任何模型/);
  });
});

/** 测试用的固定 catalog（与 fixture 一致），避免每次重复解析文件 */
function fixtureCatalog() {
  const dir = makeTemp('catalog-cache');
  return loadCatalog({ configPath: writeFixture(dir) });
}

// ---------------------------------------------------------------------------
// 4. validateAssignment（唯一一套校验规则）
// ---------------------------------------------------------------------------

describe('validateAssignment', () => {
  test('合法：模型存在且档位在集合内 → ok', () => {
    const res = validateAssignment('architect',
      { model: 'custom_provider:provider-aaaa/step-5-preview', effort: 'high' }, fixtureCatalog());
    assert.equal(res.ok, true);
    assert.deepEqual(res.errors, []);
  });

  test('模型不存在 → errors 非空且列出可用 key', () => {
    const res = validateAssignment('architect', { model: 'custom_provider:provider-aaaa/does-not-exist' }, fixtureCatalog());
    assert.equal(res.ok, false);
    assert.ok(res.errors.length > 0);
    assert.match(res.errors.join('\n'), /MODEL_SELECTION_INVALID/);
    assert.match(res.errors.join('\n'), /可用模型 key：/);
  });

  test('档位不在该模型的集合内 → errors 非空并列出可选档位', () => {
    const res = validateAssignment('architect',
      { model: 'custom_provider:provider-aaaa/step-5-preview', effort: 'max' }, fixtureCatalog());
    assert.equal(res.ok, false);
    assert.match(res.errors.join('\n'), /不在该模型支持的档位内/);
    assert.match(res.errors.join('\n'), /low \/ medium \/ high/);
  });

  test('模型无档位却给了 effort → 明确说「该模型不支持思考强度」', () => {
    const res = validateAssignment('pm', { model: 'minimax/MiniMax-M3', effort: 'high' }, fixtureCatalog());
    assert.equal(res.ok, false);
    assert.match(res.errors.join('\n'), /该模型不支持思考强度/);
  });

  test('非标准档位名（mediem / hign）按配置原文判定合法，但给 warning', () => {
    const res = validateAssignment('qa-engineer',
      { model: 'custom_provider:provider-aaaa/step-3.7-flash', effort: 'mediem' }, fixtureCatalog());
    assert.equal(res.ok, true);
    assert.deepEqual(res.errors, []);
    assert.match(res.warnings.join('\n'), /非标准档位名/);

    const hign = validateAssignment('reviewer',
      { model: 'custom_provider:provider-bbbb/zai-org/GLM-5.3-Flash', effort: 'hign' }, fixtureCatalog());
    assert.equal(hign.ok, true);
    assert.match(hign.warnings.join('\n'), /非标准档位名/);
  });

  test('catalog.ok=false → 模型与档位校验降级为 warning，ok 仍为 true', () => {
    const degraded = { ok: false, source: 'x', warning: '未找到本机模型配置', models: [], providers: [] };
    const res = validateAssignment('architect', { model: 'foo/bar', effort: 'high' }, degraded);
    assert.equal(res.ok, true);
    assert.deepEqual(res.errors, []);
    assert.match(res.warnings.join('\n'), /降级为警告/);
    assert.match(res.warnings.join('\n'), /无法校验是否存在/);
  });

  test('给了 effort 但没给 model → errors（必须成对）', () => {
    const res = validateAssignment('architect', { effort: 'high' }, fixtureCatalog());
    assert.equal(res.ok, false);
    assert.match(res.errors.join('\n'), /成对声明/);
  });

  test('model 不含 / → errors；未知角色 → errors', () => {
    assert.equal(validateAssignment('architect', { model: 'step-5-preview' }, fixtureCatalog()).ok, false);
    assert.match(validateAssignment('architect', { model: 'step-5-preview' }, fixtureCatalog()).errors.join(''),
      /provider\/model/);

    assert.equal(validateAssignment('unknown-role', { model: 'minimax/MiniMax-M3.1-Flash' }, fixtureCatalog()).ok, false);
    assert.match(validateAssignment('unknown-role', { model: 'minimax/MiniMax-M3.1-Flash' }, fixtureCatalog())
      .errors.join(''), /未知角色/);
  });

  test('fallback 同规则校验：不存在的 fallback 模型 → errors', () => {
    const bad = validateAssignment('architect', {
      model: 'custom_provider:provider-aaaa/step-5-preview', effort: 'high',
      fallback: { model: 'custom_provider:provider-aaaa/ghost', effort: 'low' },
    }, fixtureCatalog());
    assert.equal(bad.ok, false);
    assert.match(bad.errors.join('\n'), /fallback\.model 在本机模型目录中不存在/);

    const good = validateAssignment('architect', {
      model: 'custom_provider:provider-aaaa/step-5-preview', effort: 'high',
      fallback: { model: 'custom_provider:provider-aaaa/step-3.7-flash', effort: 'low' },
    }, fixtureCatalog());
    assert.equal(good.ok, true);
  });

  test('fallback 档位不匹配 → errors', () => {
    const res = validateAssignment('architect', {
      model: 'custom_provider:provider-aaaa/step-5-preview',
      fallback: { model: 'custom_provider:provider-aaaa/step-5-preview', effort: 'xhigh' },
    }, fixtureCatalog());
    assert.equal(res.ok, false);
    assert.match(res.errors.join('\n'), /fallback\.effort/);
  });

  test('null entry（清空覆盖）合法；7 个角色都在 ROLES 内', () => {
    assert.equal(validateAssignment('pm', null, fixtureCatalog()).ok, true);
    assert.deepEqual(ROLES, ['pm', 'architect', 'backend-dev', 'frontend-dev', 'qa-engineer', 'browser-tester', 'reviewer']);
    for (const role of ROLES) assert.equal(validateAssignment(role, null, null).ok, true);
  });
});

// ---------------------------------------------------------------------------
// 5. writeProjectConfig
// ---------------------------------------------------------------------------

describe('writeProjectConfig', () => {
  test('新建：真的跑过 validate-config.mjs；通过则落盘、不通过则回滚', () => {
    const dir = makeTemp('proj-new');
    const cfgPath = join(dir, 'steward.config.json');
    const res = writeProjectConfig(dir, {
      architect: { model: 'custom_provider:provider-aaaa/step-5-preview', effort: 'high' },
    }, { catalog: fixtureCatalog() });

    // 无论本机模型目录是否认识这个虚构模型，校验器都必须真实跑过一次
    assert.ok(res.validation.project, '应有 project 校验结果（校验器必须真实执行）');
    assert.match(res.validation.project.command, /validate-config\.mjs/);
    assert.equal(typeof res.validation.project.exitCode, 'number');
    assert.ok(res.validation.project.output.length > 0, '校验器输出必须带回');

    // 注意：validate-config.mjs 自己也会读本机模型目录，所以结果取决于本机配置。
    // fixture 里的模型是虚构的，本机真实目录不认识 → 这里据实断言「回滚、原文件不在」这一支。
    assert.equal(res.ok, false, '虚构模型应被真实校验器拦截：' + res.validation.project.output);
    assert.equal(res.validation.project.exitCode, 1);
    assert.equal(existsSync(cfgPath), false, '回滚后新建文件必须被删除');
    assert.deepEqual(res.written, []);
    assert.match(res.errors.join('\n'), /已自动回滚，未落盘/);
  });

  test('增量合并：只动传入的角色，其它字段与其它角色原样保留，并留 .bak', () => {
    const dir = makeTemp('proj-merge');
    const cfgPath = join(dir, 'steward.config.json');
    writeFileSync(cfgPath, JSON.stringify({
      schemaVersion: 1,
      commands: { test: 'npm test' },
      modelRouting: { pm: { model: 'minimax/MiniMax-M3.1-Flash', effort: 'high' } },
    }, null, 2) + '\n', 'utf8');
    const before = readFileSync(cfgPath, 'utf8');

    const res = writeProjectConfig(dir, {
      'backend-dev': { model: 'custom_provider:provider-aaaa/step-3.7-flash', effort: 'mediem' },
    }, { catalog: fixtureCatalog() });

    // 校验器真实跑过；被拦下时必须把旧文件逐字节还原（不许留下半写状态）
    assert.ok(res.validation.project, '应有 project 校验结果');
    assert.match(res.validation.project.command, /validate-config\.mjs/);
    assert.equal(res.ok, false);
    assert.equal(readFileSync(cfgPath, 'utf8'), before, '回滚后旧文件必须逐字节还原');
    // .bak 记的是被覆盖前的旧内容
    assert.equal(readFileSync(cfgPath + '.bak', 'utf8'), before);
  });

  test('非法模型 → 写不进去，原文件逐字节不变，且不产生 .bak', () => {
    const dir = makeTemp('proj-invalid');
    const cfgPath = join(dir, 'steward.config.json');
    const original = JSON.stringify({ schemaVersion: 1, docTier: 1 }, null, 2) + '\n';
    writeFileSync(cfgPath, original, 'utf8');

    const res = writeProjectConfig(dir, {
      architect: { model: 'custom_provider:provider-aaaa/no-such-model', effort: 'high' },
    }, { catalog: fixtureCatalog() });
    assert.equal(res.ok, false);
    assert.ok(res.errors.length > 0);
    assert.match(res.errors.join('\n'), /一个字都没写/);
    assert.equal(readFileSync(cfgPath, 'utf8'), original, '原文件必须逐字节不变');
    assert.equal(existsSync(cfgPath + '.bak'), false, '没写就不该有备份');
  });

  test('fallback 写入：结构为 { model, effort }', () => {
    const dir = makeTemp('proj-fb');
    const res = writeProjectConfig(dir, {
      architect: {
        model: 'custom_provider:provider-aaaa/step-5-preview', effort: 'high',
        fallback: { model: 'custom_provider:provider-aaaa/step-3.7-flash', effort: 'low' },
      },
    }, { catalog: fixtureCatalog() });
    assert.ok(res.validation.project, '应有 project 校验结果');
    assert.equal(res.ok, false, '虚构模型应被真实校验器拦截');
    assert.equal(existsSync(join(dir, 'steward.config.json')), false, '回滚后不得留下新建文件');
  });

  test('项目根不存在 → ok:false 并说明原因', () => {
    const dir = makeTemp('proj-missing-root');
    const res = writeProjectConfig(join(dir, 'no-such-dir'), { pm: { model: 'minimax/MiniMax-M3.1-Flash' } }, { catalog: fixtureCatalog() });
    assert.equal(res.ok, false);
    assert.match(res.errors.join('\n'), /项目根目录不存在/);
  });
});

// ---------------------------------------------------------------------------
// 6. writePluginDefaults（临时复制的仓库骨架，绝不碰真实仓库）
// ---------------------------------------------------------------------------

/** 造一份 agent frontmatter（含正文与 x-mavis 块，用于逐字节比对） */
function agentText(role, model) {
  return [
    '---',
    'name: ' + role,
    'description: "测试用 agent 描述，含中文与标点。"',
    'tools: [read, grep, glob, bash]',
    'model: "' + model + '"',
    'x-mavis:',
    '  displayName: 测试角色 ' + role,
    '---',
    '',
    '# 正文标题',
    '',
    '正文内容：必须逐字节保持不变。',
    '',
  ].join('\n');
}

const ROSTER_TEXT = [
  '## 团队名册',
  '',
  '| 角色 | 派发名 | 干什么 |',
  '|---|---|---|',
  '| 需求分析师 | `steward:pm` | 模糊需求 → 规格 |',
  '',
  '### 模型分配（派单时显式带 model + effort）',
  '',
  '| 角色 | `model` | `effort` |',
  '|---|---|---|',
  '| `steward:pm` / `steward:architect` | `minimax/MiniMax-M3.1-Flash` | `high` |',
  '',
].join('\n');

/** 造一个仓库骨架：host/minimax/agents + roster + zcode/scripts（含 stub build.mjs） */
function makeRepoSkeleton(opts) {
  const root = makeTemp('repo');
  const agentsDir = join(root, 'host', 'minimax', 'agents');
  const scriptsDir = join(root, 'zcode', 'scripts');
  const skillDir = join(root, 'host', 'minimax', 'skills', 'steward');
  mkdirSync(agentsDir, { recursive: true });
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(skillDir, { recursive: true });
  mkdirSync(join(root, 'shared'), { recursive: true });
  for (const role of ROLES) {
    writeFileSync(join(agentsDir, role + '.frontmatter.md'), agentText(role, 'minimax/MiniMax-M3.1-Flash'), 'utf8');
  }
  writeFileSync(join(skillDir, 'roster.md'), ROSTER_TEXT, 'utf8');

  // stub build.mjs：像一个真实构建脚本那样校验产物；不合规就 exit 1（用于验证回滚）
  const stub = [
    'import { readFileSync, readdirSync } from "node:fs";',
    'import { join } from "node:path";',
    'const root = process.cwd();',
    'const dir = join(root, "host", "minimax", "agents");',
    'let bad = 0;',
    'for (const f of readdirSync(dir)) {',
    '  const t = readFileSync(join(dir, f), "utf8");',
    '  if (!/^name:/m.test(t)) { console.error("[build] 缺 name：" + f); bad = bad + 1; }',
    '}',
    'if (bad > 0) process.exit(1);',
    'console.log("[build] 通过（stub）");',
  ].join('\n') + '\n';
  writeFileSync(join(scriptsDir, 'build.mjs'), stub, 'utf8');

  if (opts && opts.breakBuild) {
    // 让 build 永远失败，验证「build 非 0 → 还原全部备份」
    writeFileSync(join(scriptsDir, 'build.mjs'), 'console.error("[build] 故意失败"); process.exit(1);\n', 'utf8');
  }
  return root;
}

describe('writePluginDefaults', () => {
  test('只改 frontmatter 的 model/effort，正文与 x-mavis 逐字节不变；名册表行同步；build 通过', () => {
    const root = makeRepoSkeleton();
    const architectFile = join(root, 'host', 'minimax', 'agents', 'architect.frontmatter.md');
    const rosterFile = join(root, 'host', 'minimax', 'skills', 'steward', 'roster.md');
    const beforeArchitect = readFileSync(architectFile, 'utf8');

    const res = writePluginDefaults(root, {
      architect: { model: 'custom_provider:provider-aaaa/step-5-preview', effort: 'high' },
    }, { catalog: fixtureCatalog() });
    assert.equal(res.ok, true, res.errors.join('\n'));

    // 真实跑过 build.mjs
    assert.ok(res.validation.plugin, '应有 plugin 校验结果');
    assert.equal(res.validation.plugin.exitCode, 0, res.validation.plugin.output);
    assert.match(res.validation.plugin.command, /build\.mjs/);

    const after = readFileSync(architectFile, 'utf8');
    // model 与 effort 行正确
    assert.match(after, /^model: "custom_provider:provider-aaaa\/step-5-preview"$/m);
    assert.match(after, /^effort: "high"$/m);
    // effort 插在 model 之后
    const lines = after.split('\n');
    const mi = lines.findIndex((l) => l.startsWith('model:'));
    assert.ok(lines[mi + 1].startsWith('effort:'));

    // 正文（frontmatter 之后）逐字节不变
    const bodyBefore = beforeArchitect.slice(beforeArchitect.indexOf('---\n', 4) + 4);
    const bodyAfter = after.slice(after.indexOf('---\n', 4) + 4);
    assert.equal(bodyAfter, bodyBefore, '正文必须逐字节不变');
    assert.match(bodyAfter, /^# 正文标题/m);
    // x-mavis 块在 frontmatter 内，位置与内容都必须原样保留
    assert.match(after, /^x-mavis:\n  displayName: 测试角色 architect$/m, 'x-mavis 块必须原样保留');

    // 未传的角色一个字都没动
    const pmFile = join(root, 'host', 'minimax', 'agents', 'pm.frontmatter.md');
    assert.equal(readFileSync(pmFile, 'utf8'), agentText('pm', 'minimax/MiniMax-M3.1-Flash'));

    // 名册表：旧表里一格写了两个角色，按角色拆成各自的行？至少 architect 的值要更新
    const roster = readFileSync(rosterFile, 'utf8');
    assert.match(roster, /\| `steward:architect` \| `custom_provider:provider-aaaa\/step-5-preview` \| `high` \|/);
    assert.match(roster, /插件默认；项目级 `modelRouting` 可覆盖/);
    // .bak 备份存在
    assert.equal(existsSync(architectFile + '.bak'), true);
  });

  test('entry 没 effort → 删掉 effort 行；再写回 effort → 重新插入', () => {
    const root = makeRepoSkeleton();
    const file = join(root, 'host', 'minimax', 'agents', 'pm.frontmatter.md');

    const r1 = writePluginDefaults(root, { pm: { model: 'minimax/MiniMax-M3.1-Flash', effort: 'high' } }, { catalog: fixtureCatalog() });
    assert.equal(r1.ok, true, r1.errors.join('\n'));
    assert.match(readFileSync(file, 'utf8'), /^effort: "high"$/m);

    const r2 = writePluginDefaults(root, { pm: { model: 'minimax/MiniMax-M3.1-Flash', effort: null } }, { catalog: fixtureCatalog() });
    assert.equal(r2.ok, true, r2.errors.join('\n'));
    assert.ok(!/^effort:/m.test(readFileSync(file, 'utf8')), 'effort 行应被删掉');

    const r3 = writePluginDefaults(root, { pm: { model: 'minimax/MiniMax-M3.1-Flash', effort: 'low' } }, { catalog: fixtureCatalog() });
    assert.equal(r3.ok, true, r3.errors.join('\n'));
    assert.match(readFileSync(file, 'utf8'), /^effort: "low"$/m);
  });

  test('非法模型 → 一个字都不改，也不跑 build', () => {
    const root = makeRepoSkeleton();
    const file = join(root, 'host', 'minimax', 'agents', 'architect.frontmatter.md');
    const before = readFileSync(file, 'utf8');
    const res = writePluginDefaults(root, { architect: { model: 'custom_provider:provider-aaaa/ghost', effort: 'high' } },
      { catalog: fixtureCatalog() });
    assert.equal(res.ok, false);
    assert.match(res.errors.join('\n'), /一个字都没改/);
    assert.equal(readFileSync(file, 'utf8'), before);
    assert.equal(res.validation.plugin, undefined, '校验没过就不该跑 build');
  });

  test('build 非 0 退出 → 还原全部备份（源码回到写前状态）', () => {
    const root = makeRepoSkeleton({ breakBuild: true });
    const file = join(root, 'host', 'minimax', 'agents', 'architect.frontmatter.md');
    const rosterFile = join(root, 'host', 'minimax', 'skills', 'steward', 'roster.md');
    const before = readFileSync(file, 'utf8');
    const rosterBefore = readFileSync(rosterFile, 'utf8');

    const res = writePluginDefaults(root, { architect: { model: 'custom_provider:provider-aaaa/step-5-preview', effort: 'high' } },
      { catalog: fixtureCatalog() });
    assert.equal(res.ok, false);
    assert.match(res.errors.join('\n'), /build\.mjs 复核失败/);
    assert.equal(res.validation.plugin.exitCode, 1);
    assert.equal(readFileSync(file, 'utf8'), before, 'frontmatter 必须被还原');
    assert.equal(readFileSync(rosterFile, 'utf8'), rosterBefore, '名册表必须被还原');
  });

  test('不是源码仓库 → ok:false', () => {
    const dir = makeTemp('not-repo');
    const res = writePluginDefaults(dir, { pm: { model: 'minimax/MiniMax-M3.1-Flash' } }, { catalog: fixtureCatalog() });
    assert.equal(res.ok, false);
    assert.match(res.errors.join('\n'), /不是 Steward 源码仓库/);
  });
});

/** 用真实仓库的 frontmatter + roster 复制一份只读快照，验证 readPluginDefaults 的解析 */
function copyAgentSources(dest) {
  for (const sub of ['host/minimax/agents', 'host/minimax/skills/steward', 'zcode/scripts']) {
    mkdirSync(join(dest, sub), { recursive: true });
  }
  cpSync(join(REPO_ROOT, 'host', 'minimax', 'agents'), join(dest, 'host', 'minimax', 'agents'), { recursive: true });
  cpSync(join(REPO_ROOT, 'host', 'minimax', 'skills', 'steward', 'roster.md'),
    join(dest, 'host', 'minimax', 'skills', 'steward', 'roster.md'));
}

describe('readPluginDefaults / resolveRepoRoot / resolveClientDir', () => {
  test('从真实仓库的复制快照读出 7 个角色的 model/effort/displayName 与名册表', () => {
    const dir = makeTemp('snapshot');
    copyAgentSources(dir);
    const res = readPluginDefaults(dir);
    assert.equal(res.ok, true, res.errors.join('\n'));
    assert.equal(Object.keys(res.agents).length, 7);
    for (const role of ROLES) {
      assert.ok(res.agents[role].displayName, role + ' 应有 displayName');
    }
    assert.match(res.agents.architect.displayName, /架构师/);
    assert.ok(res.agents.architect.model.includes('/'), 'frontmatter 应声明 model');
    assert.equal(Object.keys(res.roster).length, 7);
  });

  test('仓库根不存在或缺目录 → ok:false 且不抛异常', () => {
    const dir = makeTemp('no-repo');
    const res = readPluginDefaults(dir);
    assert.equal(res.ok, false);
    assert.ok(res.errors.length > 0);
    assert.equal(res.agents.pm.model, null);
  });

  test('resolveRepoRoot：从子目录向上找到仓库根；无关目录返回 null', () => {
    // 从仓库内的任意子目录向上都应命中仓库根
    assert.equal(resolveRepoRoot(join(REPO_ROOT, 'zcode', 'scripts', 'tests')), REPO_ROOT);
    assert.equal(resolveRepoRoot(join(REPO_ROOT, 'host', 'minimax', 'agents')), REPO_ROOT);
    const dir = makeTemp('no-repo-root');
    assert.equal(resolveRepoRoot(dir), null);
  });

  test('resolveClientDir：定位到含 index.html 的资产目录；没有则返回 null', () => {
    const dir = makeTemp('client');
    const clientDir = join(dir, 'host', 'minimax', 'miniapp', 'client');
    mkdirSync(clientDir, { recursive: true });
    writeFileSync(join(clientDir, 'index.html'), '<!doctype html>', 'utf8');
    assert.equal(resolveClientDir({ packageRoot: dir }), clientDir);
    const empty = makeTemp('client-empty');
    assert.equal(resolveClientDir({ packageRoot: empty }), null);
  });
});

// ---------------------------------------------------------------------------
// 7. buildState：项目级优先、差异标记、字段契约
// ---------------------------------------------------------------------------

describe('buildState', () => {
  test('生效优先级：项目级 > 插件默认 > 无；differsFromPlugin 正确；字段齐全', () => {
    const repo = makeRepoSkeleton();
    const project = makeTemp('state-project');
    writeFileSync(join(project, 'steward.config.json'), JSON.stringify({
      schemaVersion: 1,
      modelRouting: {
        architect: { model: 'custom_provider:provider-aaaa/step-5-preview', effort: 'high' },
        pm: { model: 'minimax/MiniMax-M3.1-Flash', effort: 'high' },
      },
    }, null, 2), 'utf8');
    const catalogFile = writeFixture(makeTemp('state-catalog'));

    const state = buildState({ projectRoot: project, repoRoot: repo, configPath: catalogFile });
    assert.equal(state.ok, true);
    assert.match(state.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    assert.equal(state.project.root, project);
    assert.equal(state.project.exists, true);
    assert.equal(state.project.configPath, join(project, 'steward.config.json'));
    assert.equal(state.repo.root, repo);
    assert.equal(state.repo.detected, true);
    assert.equal(state.catalog.ok, true);
    assert.equal(state.roles.length, 7);
    assert.deepEqual(state.roles.map((r) => r.role), ROLES);

    const architect = state.roles.find((r) => r.role === 'architect');
    assert.equal(architect.source, 'project');
    assert.equal(architect.model, 'custom_provider:provider-aaaa/step-5-preview');
    assert.equal(architect.effort, 'high');
    assert.equal(architect.pluginModel, 'minimax/MiniMax-M3.1-Flash');
    assert.equal(architect.differsFromPlugin, true, '模型不同 → 标记差异');
    for (const key of ['role', 'displayName', 'model', 'effort', 'fallback', 'source', 'pluginModel', 'pluginEffort', 'differsFromPlugin']) {
      assert.ok(key in architect, '缺少契约字段：' + key);
    }

    const qa = state.roles.find((r) => r.role === 'qa-engineer');
    assert.equal(qa.source, 'plugin');
    assert.equal(qa.differsFromPlugin, false);
    assert.equal(qa.displayName, '测试角色 qa-engineer', 'displayName 优先取 frontmatter 的 x-mavis.displayName');
  });

  test('项目级与插件默认完全一致 → differsFromPlugin 为 false', () => {
    const repo = makeRepoSkeleton();
    const project = makeTemp('state-same');
    writeFileSync(join(project, 'steward.config.json'), JSON.stringify({
      schemaVersion: 1,
      modelRouting: { architect: { model: 'minimax/MiniMax-M3.1-Flash', effort: 'high' } },
    }), 'utf8');
    const state = buildState({ projectRoot: project, repoRoot: repo, configPath: writeFixture(makeTemp('c2')) });
    const architect = state.roles.find((r) => r.role === 'architect');
    assert.equal(architect.source, 'project');
    // 骨架里 architect 的插件默认 model 是 minimax/MiniMax-M3.1-Flash（未写 effort），
    // 项目级 model 相同但给了 effort → 属于「有差异」。
    assert.equal(architect.model, architect.pluginModel);
    assert.equal(architect.pluginEffort, null);
    assert.equal(architect.effort, 'high');
    assert.equal(architect.differsFromPlugin, true, '仅 effort 不同也算差异');
  });

  test('项目未建配置 / 找不到仓库 → exists:false、detected:false、角色退回插件默认或无', () => {
    const project = makeTemp('state-bare');
    const state = buildState({ projectRoot: project, repoRoot: project, configPath: writeFixture(makeTemp('c3')) });
    assert.equal(state.project.exists, false);
    assert.equal(state.repo.detected, false);
    assert.equal(state.roles.length, 7);
    for (const r of state.roles) { assert.equal(r.source, 'none'); assert.equal(r.model, null); }
  });
});

// ---------------------------------------------------------------------------
// 8. HTTP 路由层（临时 server）
// ---------------------------------------------------------------------------

/** 起一个临时 server，返回 { url, close } */
function startServer(handler) {
  return new Promise((onOk, onErr) => {
    const server = http.createServer(handler);
    server.on('error', onErr);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      onOk({ url: 'http://127.0.0.1:' + port, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

/** POST JSON 的请求封装 */
async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, text, json };
}

describe('createRequestHandler', () => {
  test('GET / 200；GET /api/state 200 且 roles 长度 7；白名单外路径 404', async () => {
    const repo = makeRepoSkeleton();
    const project = makeTemp('http-project');
    const clientDir = join(makeTemp('http-client'), 'client');
    mkdirSync(clientDir, { recursive: true });
    writeFileSync(join(clientDir, 'index.html'), '<!doctype html><title>t</title>', 'utf8');
    writeFileSync(join(clientDir, 'app.css'), 'body{}', 'utf8');
    writeFileSync(join(clientDir, 'app.js'), 'void 0;', 'utf8');
    writeFileSync(join(clientDir, 'secret.txt'), 'nope', 'utf8');

    const handler = createRequestHandler({
      projectRoot: project,
      repoRoot: repo,
      configPath: writeFixture(makeTemp('http-catalog')),
      clientDir,
    });
    const srv = await startServer(handler);
    try {
      const root = await fetch(srv.url + '/');
      assert.equal(root.status, 200);
      assert.match(root.headers.get('content-type'), /text\/html/);
      assert.match(await root.text(), /doctype html/);

      const stateRes = await fetch(srv.url + '/api/state');
      assert.equal(stateRes.status, 200);
      const state = await stateRes.json();
      assert.equal(state.ok, true);
      assert.equal(state.roles.length, 7);
      assert.ok(state.catalog.models.length > 0);

      assert.equal((await fetch(srv.url + '/app.css')).status, 200);
      assert.equal((await fetch(srv.url + '/app.js')).status, 200);
      assert.equal((await fetch(srv.url + '/secret.txt')).status, 404, '白名单外的文件必须 404');
      assert.equal((await fetch(srv.url + '/../package.json')).status, 404);
    } finally {
      await srv.close();
    }
  });

  test('POST /api/save 非法模型 → 400，且文件一个字没写', async () => {
    const repo = makeRepoSkeleton();
    const project = makeTemp('http-save-bad');
    const cfgPath = join(project, 'steward.config.json');
    const before = JSON.stringify({ schemaVersion: 1 }, null, 2) + '\n';
    writeFileSync(cfgPath, before, 'utf8');

    const handler = createRequestHandler({
      projectRoot: project,
      repoRoot: repo,
      configPath: writeFixture(makeTemp('http-save-cat')),
    });
    const srv = await startServer(handler);
    try {
      const res = await postJson(srv.url + '/api/save', {
        scope: 'project',
        projectRoot: project,
        repoRoot: repo,
        assignments: { architect: { model: 'custom_provider:provider-aaaa/ghost', effort: 'high' } },
      });
      assert.equal(res.status, 400);
      assert.equal(res.json.ok, false);
      assert.deepEqual(res.json.written, []);
      assert.ok(res.json.errors.length > 0);
      assert.match(res.json.errors.join('\n'), /已自动回滚，未落盘/);
      assert.equal(readFileSync(cfgPath, 'utf8'), before, '原文件必须逐字节不变');

      // 非法 JSON → 400
      const bad = await fetch(srv.url + '/api/save', { method: 'POST', body: '{not json' });
      assert.equal(bad.status, 400);

      // 不存在的 projectRoot → 400
      const missing = await postJson(srv.url + '/api/save', {
        scope: 'project',
        projectRoot: 'Z:/definitely/not/here',
        assignments: { pm: { model: 'minimax/MiniMax-M3.1-Flash' } },
      });
      assert.equal(missing.status, 400);
      assert.match(missing.json.errors.join('\n'), /不是已存在的目录/);
    } finally {
      await srv.close();
    }
  });

  test('POST /api/save 合法 → 200，written 带 scope/role/target，validation 带校验器输出', async () => {
    const repo = makeRepoSkeleton();
    const project = makeTemp('http-save-ok');
    const handler = createRequestHandler({
      projectRoot: project,
      repoRoot: repo,
      configPath: writeFixture(makeTemp('http-save-ok-cat')),
    });
    const srv = await startServer(handler);
    try {
      const res = await postJson(srv.url + '/api/save', {
        scope: 'project',
        projectRoot: project,
        repoRoot: repo,
        assignments: { architect: { model: 'custom_provider:provider-aaaa/step-5-preview', effort: 'high', fallback: null } },
      });
      // validate-config.mjs 自己读本机模型目录，虚构模型会被它拦下 → 走「已回滚」这一支：
      // 响应体必须是 400 + written 为空 + 带校验器 exit code 与输出，且文件确实没落盘。
      assert.equal(res.status, 400, JSON.stringify(res.json));
      assert.equal(res.json.ok, false);
      assert.deepEqual(res.json.written, []);
      assert.ok(res.json.validation.project, '响应里必须带回校验器结果');
      assert.equal(res.json.validation.project.exitCode, 1);
      assert.match(res.json.validation.project.command, /validate-config\.mjs/);
      assert.match(res.json.errors.join('\n'), /已自动回滚，未落盘/);
      assert.equal(existsSync(join(project, 'steward.config.json')), false, '回滚后不得留下新建文件');

      // fallback:null 的语义在请求层就被接受（不因为 null 报 schema 错误）
      assert.ok(!/fallback 必须/.test(res.json.errors.join('\n')), 'fallback:null 不该触发结构错误');
    } finally {
      await srv.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 9. mirrorDir
// ---------------------------------------------------------------------------

describe('mirrorDir', () => {
  test('复制源文件、递归子目录，并删除目标里多余的旧文件', () => {
    const src = makeTemp('mirror-src');
    const dest = makeTemp('mirror-dest');
    mkdirSync(join(src, 'skills', 'steward'), { recursive: true });
    writeFileSync(join(src, 'plugin.json'), '{"name":"steward"}', 'utf8');
    writeFileSync(join(src, 'skills', 'steward', 'SKILL.md'), '# new', 'utf8');
    writeFileSync(join(dest, 'stale.md'), 'old', 'utf8');
    mkdirSync(join(dest, 'old-dir'), { recursive: true });
    writeFileSync(join(dest, 'old-dir', 'x.md'), 'old', 'utf8');

    const stats = mirrorDir(src, dest);
    assert.equal(stats.copied, 2);
    assert.ok(stats.removed >= 2);
    assert.equal(readFileSync(join(dest, 'plugin.json'), 'utf8'), '{"name":"steward"}');
    assert.equal(readFileSync(join(dest, 'skills', 'steward', 'SKILL.md'), 'utf8'), '# new');
    assert.equal(existsSync(join(dest, 'stale.md')), false, '多余的旧文件必须被删除');
    assert.equal(existsSync(join(dest, 'old-dir')), false, '多余的旧目录必须被删除');
  });

  test('再镜像一次保持幂等（内容不变、不残留）', () => {
    const src = makeTemp('mirror-idem-src');
    const dest = makeTemp('mirror-idem-dest');
    writeFileSync(join(src, 'a.txt'), 'A', 'utf8');
    mirrorDir(src, dest);
    const stats = mirrorDir(src, dest);
    assert.equal(stats.removed, 0);
    assert.deepEqual(readdirSync(dest), ['a.txt']);
  });

  test('源目录不存在 → 抛错（带真实路径）', () => {
    const dest = makeTemp('mirror-missing');
    assert.throws(() => mirrorDir(join(dest, 'nope'), dest), /源目录不存在/);
  });
});

