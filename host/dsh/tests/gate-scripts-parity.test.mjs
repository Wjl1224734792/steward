/**
 * 门禁脚本单一源一致性测试（T4 新增）。
 *
 * 背景（v1.1.0）：`shared/scripts/` 是 6 个门禁脚本 + `templates/` + `doc/` 的**唯一正文源**，
 * `zcode/scripts/`、`minimax/scripts/`、`dsh/scripts/` 里的同名文件全部是**生成物**。
 * 本文件锁两件事：
 *
 *  1) 内容一致性：shared/scripts 下的每个文件，在三个宿主包内的同名文件内容一致；
 *  2) 源码级解耦：`host/dsh/build.mjs` 不再从 `zcode/scripts` 读取任何脚本/模板，
 *     它的 scripts 读取源只能是 `shared/scripts`（否则解耦只是巧合，回归无人发现）。
 *
 * 比较口径沿用 `zcode/scripts/build.mjs` 的 `sameContent`（CRLF 归一）——本仓库 LF/CRLF 混存，
 * 裸字节比较会误报。
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SHARED_SCRIPTS = join(ROOT, 'shared', 'scripts');
const HOSTS = [
  { name: 'zcode', dir: join(ROOT, 'zcode', 'scripts') },
  { name: 'minimax', dir: join(ROOT, 'minimax', 'scripts') },
  { name: 'dsh', dir: join(ROOT, 'dsh', 'scripts') },
];

/** v1.1.0 的共享门禁脚本清单——用来防「shared/scripts 被清空后本文件空转通过」。 */
const EXPECTED_SHARED_SCRIPTS = [
  'maintain.mjs',
  'run-state.mjs',
  'take-over.mjs',
  'validate-config.mjs',
  'validate-plan.mjs',
  'verify.mjs',
];

/** sameContent 口径（照抄 zcode/scripts/build.mjs:79）：CRLF 归一后逐字符比较。 */
const sameContent = (a, b) => a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');

/**
 * 递归列出目录下的全部文件（相对路径用 POSIX 分隔符）。
 * @param {string} dir absolute directory.
 * @param {string} [base] base for relative paths.
 * @returns {string[]} relative file paths.
 */
function listFiles(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(relative(base, full).split(sep).join('/'));
  }
  return out;
}

/**
 * 找出源码里所有 `join(<dir>, 'scripts'` 形式的读取点（忽略行号，只看内容模式）。
 * @param {string} src source text.
 * @returns {Array<{line: number, dir: string, text: string}>} read sites.
 */
function findScriptReads(src) {
  const lines = src.split(/\r\n|\n/);
  const out = [];
  const re = /join\(\s*([A-Za-z_$][\w$]*)\s*,\s*['"]scripts['"]/g;
  lines.forEach((text, i) => {
    for (const m of text.matchAll(re)) out.push({ line: i + 1, dir: m[1], text: text.trim() });
  });
  return out;
}

/**
 * 找出源码里匹配 `re` 的行。
 * @param {string} src source text.
 * @param {RegExp} re pattern (non-global).
 * @returns {Array<{line: number, text: string}>} matched lines.
 */
function findLines(src, re) {
  const out = [];
  src.split(/\r\n|\n/).forEach((text, i) => {
    if (re.test(text)) out.push({ line: i + 1, text: text.trim() });
  });
  return out;
}

const sharedScripts = readdirSync(SHARED_SCRIPTS).filter((f) => f.endsWith('.mjs')).sort();
const sharedTemplates = listFiles(join(SHARED_SCRIPTS, 'templates')).sort();
const sharedDoc = listFiles(join(SHARED_SCRIPTS, 'doc')).sort();

const DSH_BUILD = readFileSync(join(ROOT, 'host', 'dsh', 'build.mjs'), 'utf8');
const ZCODE_BUILD = readFileSync(join(ROOT, 'zcode', 'scripts', 'build.mjs'), 'utf8');

// --- (a) 内容一致性 ---------------------------------------------------------------

test('[parity] shared/scripts 仍持有 6 个共享门禁脚本（防空转）', () => {
  assert.deepEqual(
    sharedScripts,
    EXPECTED_SHARED_SCRIPTS,
    'shared/scripts 下的共享门禁脚本清单与 v1.1.0 单一源定义不符——'
    + '若这里为空或缺项，本文件的一致性断言会变成空转（永远通过）。',
  );
});

test('[parity] shared/scripts 的 templates/ 与 doc/ 非空（防空转）', () => {
  assert.ok(sharedTemplates.length > 0, 'shared/scripts/templates/ 没有文件——一致性断言会空转');
  assert.ok(sharedDoc.length > 0, 'shared/scripts/doc/ 没有文件——一致性断言会空转');
  assert.ok(
    sharedTemplates.includes('AGENTS.md') && sharedTemplates.includes('t3/PRD.md'),
    `shared/scripts/templates/ 缺少已知文件，实际：${sharedTemplates.join(', ')}`,
  );
  assert.ok(
    sharedDoc.includes('README.md') && sharedDoc.includes('doc-check.mjs'),
    `shared/scripts/doc/ 缺少已知文件，实际：${sharedDoc.join(', ')}`,
  );
});

/**
 * 为「源文件 → 三宿主包同名文件」登记一组一致性用例。
 * @param {string} group group label.
 * @param {string} subdir sub directory under each host's scripts/ ('' = 顶层 .mjs).
 * @param {string[]} files relative file names inside the group.
 */
function registerParityTests(group, subdir, files) {
  for (const rel of files) {
    test(`[parity] ${group}/${rel} 在 zcode/minimax/dsh 三侧与 shared/scripts 同源`, () => {
      const srcPath = join(SHARED_SCRIPTS, subdir, rel);
      assert.ok(existsSync(srcPath), `源文件不存在：${srcPath}`);
      const srcText = readFileSync(srcPath, 'utf8');
      const problems = [];
      for (const host of HOSTS) {
        const relHost = `scripts/${subdir ? subdir + '/' : ''}${rel}`;
        const dstPath = join(host.dir, subdir, rel);
        if (!existsSync(dstPath)) {
          problems.push(`${host.name}/${relHost} 缺失（宿主包没同步到）`);
          continue;
        }
        const dstText = readFileSync(dstPath, 'utf8');
        if (!sameContent(srcText, dstText)) {
          problems.push(
            `${host.name}/${relHost} 与 shared/scripts/${subdir ? subdir + '/' : ''}${rel} 内容不一致`
            + `（CRLF 归一后仍不同：源 ${srcText.length} 字符 / 目标 ${dstText.length} 字符）`,
          );
        }
      }
      assert.deepEqual(
        problems,
        [],
        `门禁脚本单一源被破坏：\n  - ${problems.join('\n  - ')}\n`
        + '  修法：只改 shared/scripts/ 正文源，再跑 node zcode/scripts/build.mjs 与 node host/dsh/build.mjs 重新生成；'
        + '不要手改 zcode/minimax/dsh 包内的生成物。',
      );
    });
  }
}

registerParityTests('scripts', '', sharedScripts);
registerParityTests('templates', 'templates', sharedTemplates);
registerParityTests('doc', 'doc', sharedDoc);

// --- (b) 源码级解耦断言 ------------------------------------------------------------

test('[decouple] host/dsh/build.mjs 不再从 zcode/scripts 读取门禁脚本', () => {
  const offenders = findLines(DSH_BUILD, /join\(\s*zc\s*,\s*['"]scripts['"]/);
  assert.deepEqual(
    offenders.map((o) => `第 ${o.line} 行：${o.text}`),
    [],
    'DSH 构建器仍在从 zcode/scripts 读取脚本/模板——T2 的解耦目标（DSH 不依赖 ZCode 目录）已被回退。'
    + '修法：把读取源改回 shared/scripts/，别把 zcode/scripts/ 当生成物源。',
  );
});

test('[decouple] host/dsh/build.mjs 的 scripts 路径只落在 shared / host 自有 / 输出包三处', () => {
  const reads = findScriptReads(DSH_BUILD);
  assert.ok(
    reads.length >= 3,
    `host/dsh/build.mjs 里的 scripts 路径只有 ${reads.length} 处（预期至少 3 处：6 脚本同步 / templates / doc）——`
    + '源码被改动到认不出读取源，请同步更新本断言。',
  );
  // 允许的目录标识：shared = 共享单一源；hostDir = DSH 自有脚本（host/dsh/scripts）；
  // outDir = 输出包 dsh/（落地目标）。出现别的标识（尤其 zc）即解耦回退。
  const ALLOWED = new Set(['shared', 'hostDir', 'outDir']);
  const offenders = reads.filter((r) => !ALLOWED.has(r.dir));
  assert.deepEqual(
    offenders.map((o) => `第 ${o.line} 行用到 ${o.dir}：${o.text}`),
    [],
    'host/dsh/build.mjs 的 scripts 路径只允许落在 shared（共享单一源）、hostDir（DSH 自有脚本）、outDir（输出包）——'
    + '出现 zcode/scripts 等外部目录即解耦回退。',
  );
  assert.ok(
    reads.some((r) => r.dir === 'shared'),
    'host/dsh/build.mjs 里没有任何 join(shared, \'scripts\'…) 路径——共享单一源没被读到。',
  );
});

test('[decouple] host/dsh/build.mjs 的三处读取源分别指向 shared/scripts、templates、doc', () => {
  const scriptReads = findLines(DSH_BUILD, /syncFile\(\s*join\(\s*shared\s*,\s*['"]scripts['"]\s*,/);
  const templateReads = findLines(DSH_BUILD, /join\(\s*shared\s*,\s*['"]scripts['"]\s*,\s*['"]templates['"]/);
  const docReads = findLines(DSH_BUILD, /join\(\s*shared\s*,\s*['"]scripts['"]\s*,\s*['"]doc['"]/);
  assert.ok(
    scriptReads.length >= 1,
    'host/dsh/build.mjs 里找不到「从 shared/scripts 同步 .mjs 脚本」的读取点'
    + '（应形如 syncFile(join(shared, \'scripts\', f), …)）。',
  );
  assert.ok(
    templateReads.length >= 1,
    'host/dsh/build.mjs 里找不到「从 shared/scripts/templates 同步」的读取点。',
  );
  assert.ok(
    docReads.length >= 1,
    'host/dsh/build.mjs 里找不到「从 shared/scripts/doc 同步」的读取点。',
  );
});

test('[decouple] zcode/scripts/build.mjs 的共享脚本读取源是 shared/scripts（不是 zcode/scripts）', () => {
  // zcode 侧仍合法地从 zcode/scripts 读 4 个宿主专有脚本（build/agent-config*/trigger），
  // 因此这里只断言「共享脚本的读源是 shared」这一条链，不禁止 zc。
  const sharedDir = findLines(ZCODE_BUILD, /join\(\s*shared\s*,\s*['"]scripts['"]/);
  assert.ok(
    sharedDir.length >= 1,
    'zcode/scripts/build.mjs 里找不到 shared/scripts 目录定义（应形如 const sharedScripts = join(shared, \'scripts\')）'
    + '——共享脚本的读源丢了，zcode/scripts 里的同名文件会变成「没有源的手改件」。',
  );
  const sharedLoop = findLines(ZCODE_BUILD, /join\(\s*sharedScripts\s*,\s*[A-Za-z_$][\w$]*\s*\)/);
  assert.ok(
    sharedLoop.length >= 1,
    'zcode/scripts/build.mjs 里找不到从 sharedScripts 读脚本的取用点（应形如 join(sharedScripts, f)）。',
  );
  const sharedSub = findLines(ZCODE_BUILD, /join\(\s*sharedScripts\s*,\s*['"](templates|doc)['"]/);
  assert.ok(
    sharedSub.length >= 2,
    `zcode/scripts/build.mjs 里只找到 ${sharedSub.length} 处 sharedScripts/templates|doc 取用点`
    + '（预期 ≥2：templates 与 doc 各一）——templates/doc 的读源可能已偏离 shared。',
  );
});
