#!/usr/bin/env node
/**
 * docs-gate.mjs — Steward 文档治理门禁（DSH 宿主，docTier 增量层；纯 Node 内置模块，零依赖）。
 *
 * 用法：
 *   node scripts/docs-gate.mjs <root> [check] [--tier <0-3>] [--json] [--strict] [--baseline-write]
 *   node scripts/docs-gate.mjs <root> init   [--json]
 *   node scripts/docs-gate.mjs <root> fix    [--json]
 *   node scripts/docs-gate.mjs --help
 *
 * check（默认）：只报不改，跑 G1–G11：
 *   G1  活文档体积预算（AGENTS / 根 README / docs 地图 / T1 / 单册 / hub；有基线时只报「比基线增长」）
 *   G2  frontmatter 合法性（read 枚举、read: dir 必带 scope、status 枚举、version 形状、archived 落位、superseded-by 存在）
 *   G3  AGENTS.md 不得带 frontmatter（根与任意子目录）
 *   G4  docs/07-治理/ 分层白名单、评审记录-*.md 落位、adr/ 文件名 ADR-NNNN-*.md
 *   G5  docs/README.md 自动索引区块（<!-- docs-gate:index:begin/end -->）与磁盘逐字一致
 *   G6  ADR 双向：adr/ 每份进 ADR-索引.md、索引路径存在、索引状态与文件头 `> 状态：` 一致
 *   G7  版本三处一致：frontmatter version / 头部 `> 版本：` / 修订表末行首列
 *   G8  快照完整性：history/README.md 索引、manifest.json sha256、status: archived、superseded-by
 *   G9  现版版本不得与同域 history/ 快照版本重复
 *   G10 修订表「依据」列（第 4 列）非空且可解析到现存文件（warning；--strict 时空值升 error）
 *   G11 03-plan.json 每个 task 的 docsRead 为字符串数组且路径存在（docTier=3 时不得为空）
 *
 * init：建 docs/07-治理/{adr,评审记录}/、四个活文档骨架、docs/01..06/history/ 骨架、
 *       docs/README.md（含自动区块标记）与空基线。幂等：已存在一律 skip，绝不覆盖既有内容。
 * fix ：重写 docs/README.md 自动索引区块、补齐 history/manifest.json 缺项（已有哈希不覆盖，不动文档正文）。
 * 退出码：0 = 通过（允许 warning）/ 1 = 有 error / 2 = 用法或根目录错误。
 *
 * 约定
 *   - 输出路径统一 `/`；内部比较前一律 replace(/\\/g,'/')，不硬编码分隔符。
 *   - 行数：\r\n → \n 之后再按 \n 切分，并去掉末尾空行（末尾换行不算一行）。
 *   - frontmatter 可选但格式从严：只解析文件首个 `---` 块；无 frontmatter 不报错，有但未闭合 → G2 error。
 *   - 配置读项目根 steward.config.json：docTier 与 docsGovernance.{budgets,baseline,strict}；
 *     配置缺失/损坏按 docTier=1 处理（G2/G3/G4 等与 tier 无关的检查照跑），--tier 覆盖配置。
 *   - tier < 3 跳过 G11，且不要求 docs/01..07 存在（干净的非 T3 项目应当退出 0）。
 *   - 有 --json 时 stdout 只有 JSON；人读模式下 warning 走 stdout、error 走 stderr。
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

// --- 常量 -------------------------------------------------------------------

const USAGE = `用法：
  node scripts/docs-gate.mjs <root> [check] [--tier <0-3>] [--json] [--strict] [--baseline-write]
  node scripts/docs-gate.mjs <root> init  [--json]
  node scripts/docs-gate.mjs <root> fix   [--json]
  node scripts/docs-gate.mjs --help

命令：
  check  默认。只报不改，跑 G1–G11 文档治理检查。
  init   建 07-治理 内部分层 + 各域 history/ + 索引骨架（幂等，已存在一律 skip 不覆盖）。
  fix    重写 docs/README.md 自动索引区块、补齐 history/manifest.json 缺项（不动文档正文）。

选项：
  --tier <0-3>      覆盖 steward.config.json 的 docTier
  --json            机读输出 { ok, root, tier, checked, errors, warnings }
  --strict          把 G10（修订依据）的空值 warning 升为 error
  --baseline-write  把当前超限与缺依据项写进基线文件后 exit 0（存量项目记基线）
  --help            打印本帮助（exit 0）

退出码：0 = 通过（允许 warning）/ 1 = 有 error / 2 = 用法或根目录错误`;

const INDEX_BEGIN = '<!-- docs-gate:index:begin -->';
const INDEX_END = '<!-- docs-gate:index:end -->';
const INDEX_TITLE = '### 归档与快照索引（脚本维护，勿手写）';
const INDEX_TABLE_HEAD = ['| 文件 | 类别 | 状态 |', '|---|---|---|'];

const EXCLUDE_SEGMENTS = new Set([
  '.git',
  '.steward',
  '.zcode',
  '.minimax',
  'node_modules',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  'tmp',
]);

const DEFAULT_BUDGETS = { agents: 100, readme: 120, docsIndex: 150, t1: 120, doc: 400, hub: 150 };
const DEFAULT_BASELINE = 'docs/governance-baseline.json';

const GOV_DIR = 'docs/07-治理'; // 仓库根相对
const GOV_IN_DOCS = '07-治理'; // docs 相对
const DEEP_STAGES = ['01-需求', '02-架构', '03-契约', '04-专项', '05-页面', '06-测试', '07-治理'];
const HISTORY_STAGES = DEEP_STAGES.slice(0, 6);
const STAGE_NOTES = {
  '01-需求': 'PRD、FRD、业务流程、领域参数 SSOT',
  '02-架构': '架构总纲、工程化、可观测性、部署',
  '03-契约': '数据模型、API/错误码、外部集成',
  '04-专项': '算法、AI/Agent、规则引擎等专项',
  '05-页面': '页面设计、布局稿、组件清单',
  '06-测试': '测试方案、黄金集、NFR 验证映射',
  '07-治理': 'ADR、执行步骤、开发顺序、评审记录',
};

const GOV_ALLOWED_FILES = new Set(['执行步骤.md', '开发顺序.md', '评审状态.md', 'ADR-索引.md']);
const GOV_ALLOWED_DIRS = new Set(['adr', '评审记录']);
const ADR_FILE_RE = /^ADR-\d{4}-.+\.md$/;
const READ_VALUES = new Set(['always', 'dir', 'task', 'on-demand']);
const STATUS_VALUES = new Set(['active', 'archived']);
const VERSION_RE = /^v?\d+\.\d+(\.\d+)?$/;
const VERSION_IN_TEXT_RE = /(v?\d+\.\d+(?:\.\d+)?)/i;
const ADR_STATUSES = ['提议', '接受', '拒绝', '已落地', '已废弃'];

const REVISION_HEADING_RE = /^#{2,6}\s*修订记录/;
const SEPARATOR_ROW_RE = /^\|?[\s:|-]+\|?$/;

// --- 入口 -------------------------------------------------------------------

let asJson = false;

function main() {
  const opts = parseArgs(process.argv.slice(2));
  asJson = opts.json;

  if (opts.help) {
    console.log(USAGE);
    return 0;
  }
  if (opts.unknown.length > 0) {
    fail(2, `未知选项：${opts.unknown.join(' ')}（--help 看用法）`);
  }
  if (opts.rest.length === 0) {
    fail(2, '缺 <root> 参数（--help 看用法）');
  }
  if (opts.rest.length > 2) {
    fail(2, `参数过多：${opts.rest.slice(2).join(' ')}（<root> [check|init|fix]）`);
  }

  const root = resolve(opts.rest[0]);
  const command = opts.rest[1] ?? 'check';
  if (!['check', 'init', 'fix'].includes(command)) {
    fail(2, `未知命令：${command}（只支持 check / init / fix）`);
  }
  if (!existsSync(root)) {
    fail(2, `根目录不存在：${root}`);
  }

  const config = readConfig(root);
  const cfgTier = config && Number.isInteger(config.docTier) ? config.docTier : null;
  let tier;
  let tierSource;
  if (opts.tier !== null) {
    const n = Number(opts.tier);
    if (!Number.isInteger(n) || n < 0 || n > 3) {
      fail(2, `--tier 必须是 0~3 的整数（收到 ${opts.tier === '' ? '空' : opts.tier}）`);
    }
    tier = n;
    tierSource = '--tier';
  } else if (cfgTier !== null) {
    tier = cfgTier;
    tierSource = 'steward.config.json';
  } else {
    tier = 1;
    tierSource = config ? 'steward.config.json 无 docTier · 按 1' : '默认档位 1 · 无 steward.config.json';
  }

  const gov = config && typeof config.docsGovernance === 'object' && config.docsGovernance
    ? config.docsGovernance
    : {};
  const budgets = { ...DEFAULT_BUDGETS };
  if (gov.budgets && typeof gov.budgets === 'object') {
    for (const [key, value] of Object.entries(gov.budgets)) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) budgets[key] = Math.floor(n);
    }
  }
  const baselineRel = typeof gov.baseline === 'string' && gov.baseline.trim() !== ''
    ? normalizePath(gov.baseline.trim())
    : DEFAULT_BASELINE;
  const strict = opts.strict || gov.strict === true;

  if (command === 'init') {
    return runInit(root, tier);
  }
  if (command === 'fix') {
    return runFix(root, tier);
  }
  if (opts.baselineWrite) {
    return runBaselineWrite(root, tier, budgets, baselineRel);
  }
  return runCheck(root, tier, tierSource, budgets, baselineRel, strict);
}

// --- check ------------------------------------------------------------------

function runCheck(root, tier, tierSource, budgets, baselineRel, strict) {
  const errors = [];
  const warnings = [];
  const add = (level, id, message, extra = {}) => {
    const item = { id, file: extra.file ?? null, line: extra.line ?? null, message };
    if (level === 'error') errors.push(item);
    else warnings.push(item);
  };

  const allMd = walkMdFiles(root).map((abs) => ({ abs, rel: relFrom(root, abs) }));
  const docsRoot = join(root, 'docs');
  const historyDirs = listDirsNamed(docsRoot, 'history');
  const adrFiles = walkMdFiles(join(root, GOV_DIR, 'adr')).map((abs) => ({
    abs,
    rel: relFrom(root, abs),
    base: basenameOf(abs),
  }));
  const baseline = readBaseline(root, baselineRel);
  const fmCache = new Map();
  const fmOf = (abs) => {
    if (!fmCache.has(abs)) fmCache.set(abs, parseFrontmatter(readText(abs)));
    return fmCache.get(abs);
  };
  const stats = { docs: allMd.length, snapshots: 0, adrs: adrFiles.length, plans: 0 };

  const isDocTree = (rel) => rel.startsWith('docs/');
  const isRootLevel = (rel) => !rel.includes('/');
  const isRules = (rel) => rel.startsWith('.agents/');

  // ---- G1 活文档体积 ------------------------------------------------------
  for (const f of allMd) {
    const info = budgetFor(f.rel, budgets, fmOf(f.abs).data);
    if (!info) continue;
    const lines = countLines(readText(f.abs));
    const recorded = baseline.oversized[f.rel];
    if (recorded !== undefined) {
      // 基线棘轮：只报「比基线增长」，未超预算不报。
      if (lines > recorded) {
        add('error', 'G1', `比基线增长：现 ${lines} 行 > 基线 ${recorded} 行（基线只减不增；先拆册再改基线）`, { file: f.rel });
      }
      continue;
    }
    if (lines > info.budget) {
      add(
        'error',
        'G1',
        `超过预算：现 ${lines} 行 > ${info.budget} 行（${info.label}）；拆册见 docs-governance §2，存量项目可 --baseline-write 记基线`,
        { file: f.rel },
      );
    }
  }

  // ---- G2 frontmatter 合法性 ----------------------------------------------
  for (const f of allMd) {
    if (!(isDocTree(f.rel) || isRootLevel(f.rel) || isRules(f.rel))) continue;
    const fm = fmOf(f.abs);
    if (!fm.present) continue;
    if (!fm.closed) {
      add('error', 'G2', 'frontmatter 未闭合（文件首个 --- 块没有结束行）', { file: f.rel, line: 1 });
      continue;
    }
    const data = fm.data;
    const read = data.read;
    if (read !== undefined) {
      if (!READ_VALUES.has(read)) {
        add('error', 'G2', `frontmatter read 非法：${read}（只允许 always|dir|task|on-demand）`, { file: f.rel, line: 1 });
      } else if (read === 'dir' && !String(data.scope ?? '').trim()) {
        add('error', 'G2', 'frontmatter read: dir 必须带非空 scope（生效目录）', { file: f.rel, line: 1 });
      }
    }
    if (data.status !== undefined && !STATUS_VALUES.has(data.status)) {
      add('error', 'G2', `frontmatter status 非法：${data.status}（只允许 active|archived）`, { file: f.rel, line: 1 });
    }
    if (data.version !== undefined && !VERSION_RE.test(String(data.version).trim())) {
      add('error', 'G2', `frontmatter version 非法：${data.version}（应形如 v2.1 / 2.1 / 2.1.3）`, { file: f.rel, line: 1 });
    }
    if (data.status === 'archived' && !isArchivedLocation(f.rel)) {
      add('error', 'G2', 'frontmatter status: archived 的文件必须位于 history/ 或 archive/ 下', { file: f.rel, line: 1 });
    }
    if (data['superseded-by'] !== undefined) {
      const target = String(data['superseded-by']).replace(/^[<`"']+|[>`"']+$/g, '').trim();
      if (target === '') {
        add('error', 'G2', 'frontmatter superseded-by 为空（历史快照必须指回现版）', { file: f.rel, line: 1 });
      } else if (!existsSync(resolve(dirname(f.abs), target))) {
        add('error', 'G2', `frontmatter superseded-by 指向的文件不存在：${target}`, { file: f.rel, line: 1 });
      }
    }
  }

  // ---- G3 AGENTS.md 不得带 frontmatter ------------------------------------
  for (const f of allMd) {
    if (basenameOf(f.abs) !== 'AGENTS.md') continue;
    const first = normalizeNewlines(stripBom(readText(f.abs))).split('\n')[0] ?? '';
    if (first.trim() === '---') {
      add('error', 'G3', 'AGENTS.md 不得带 frontmatter（宿主原样注入，必须是纯 markdown）', { file: f.rel, line: 1 });
    }
  }

  // ---- G4 07 分层 ---------------------------------------------------------
  const govAbs = join(root, GOV_DIR);
  if (existsSync(govAbs)) {
    for (const entry of safeReaddir(govAbs)) {
      if (entry.name.startsWith('.')) continue; // 忽略点开头项（.gitkeep 等）
      const rel = `${GOV_DIR}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!GOV_ALLOWED_DIRS.has(entry.name)) {
          add('error', 'G4', `07-治理/ 根下不允许子目录：${entry.name}/（只允许 adr/、评审记录/）`, { file: rel });
        }
        continue;
      }
      if (GOV_ALLOWED_FILES.has(entry.name)) continue;
      if (/^评审记录-.*\.md$/.test(entry.name)) {
        add('error', 'G4', `评审记录必须放 评审记录/ 子目录，不得落在 07-治理/ 根：${entry.name}`, { file: rel });
      } else {
        add('error', 'G4', `07-治理/ 根下只允许活文档（执行步骤.md / 开发顺序.md / 评审状态.md / ADR-索引.md）：${entry.name}`, { file: rel });
      }
    }
    for (const adr of adrFiles) {
      if (ADR_FILE_RE.test(adr.base)) continue;
      if (/^评审记录-.*\.md$/.test(adr.base)) {
        add('error', 'G4', `评审记录不得落在 adr/：${adr.base}（应放 07-治理/评审记录/）`, { file: adr.rel });
      } else {
        add('error', 'G4', `adr/ 下文件名必须匹配 ADR-NNNN-<标题>.md：${adr.base}`, { file: adr.rel });
      }
    }
  }

  // ---- G5 自动索引区块 ----------------------------------------------------
  const readmeRel = 'docs/README.md';
  const readmeAbs = join(docsRoot, 'README.md');
  const expectedBlock = generateIndexBlockLines(root);
  if (existsSync(readmeAbs)) {
    const actual = extractIndexBlockLines(readText(readmeAbs));
    if (!actual) {
      add('error', 'G5', `缺自动索引区块标记（${INDEX_BEGIN} / ${INDEX_END}）；跑 docs-gate <root> init 或 fix`, { file: readmeRel });
    } else if (actual.join('\n') !== expectedBlock.join('\n')) {
      add('error', 'G5', describeIndexDiff(actual, expectedBlock), { file: readmeRel });
    }
  } else {
    const indexable = collectIndexEntries(root).length;
    if (indexable > 0 || tier >= 3) {
      add('error', 'G5', '缺 docs/README.md 文档地图（含自动索引区块）；跑 docs-gate <root> init 或 fix', { file: readmeRel });
    }
  }

  // ---- G6 ADR 双向 --------------------------------------------------------
  const adrIndexAbs = join(govAbs, 'ADR-索引.md');
  const adrIndexRel = `${GOV_DIR}/ADR-索引.md`;
  if (existsSync(join(govAbs, 'adr'))) {
    if (adrFiles.length > 0 && !existsSync(adrIndexAbs)) {
      add('error', 'G6', '缺 ADR-索引.md（adr/ 已有 ADR 却没有索引）', { file: adrIndexRel });
    } else if (existsSync(adrIndexAbs)) {
      const indexLines = normalizeNewlines(readText(adrIndexAbs)).split('\n');
      const indexRefs = []; // { name(docs 相对 adr/), line, lineNo, cells }
      for (let i = 0; i < indexLines.length; i++) {
        const line = indexLines[i];
        for (const m of line.matchAll(/adr\/([^\s)\]|>]+?\.md)/g)) {
          indexRefs.push({ name: m[1], line, lineNo: i + 1, cells: splitTableRow(line) });
        }
      }
      const refNames = new Set(indexRefs.map((r) => r.name));
      for (const adr of adrFiles) {
        const nameFromAdr = relFrom(join(govAbs, 'adr'), adr.abs);
        if (!refNames.has(nameFromAdr)) {
          add('error', 'G6', `ADR 未进 ADR-索引.md：adr/${nameFromAdr}`, { file: adr.rel });
          continue;
        }
        const fileStatus = adrHeadStatus(readText(adr.abs));
        if (!fileStatus) {
          add('error', 'G6', `ADR 文件缺头部「> 状态：」行：adr/${nameFromAdr}`, { file: adr.rel });
          continue;
        }
        const row = indexRefs.find((r) => r.name === nameFromAdr);
        const statusCell = row ? pickStatusCell(row.cells) : null;
        if (!statusCell) {
          add('error', 'G6', `ADR 索引行缺状态列（${fileStatus}）：adr/${nameFromAdr}`, { file: adrIndexRel, line: row ? row.lineNo : null });
        } else if (statusCell !== fileStatus) {
          add('error', 'G6', `ADR 索引状态与文件头不一致：索引「${statusCell}」≠ 文件「${fileStatus}」（adr/${nameFromAdr}）`, {
            file: adrIndexRel,
            line: row.lineNo,
          });
        }
      }
      for (const ref of indexRefs) {
        if (!existsSync(join(govAbs, 'adr', ref.name))) {
          add('error', 'G6', `ADR 索引条目指向的文件不存在：adr/${ref.name}`, { file: adrIndexRel, line: ref.lineNo });
        }
      }
    }
  }

  // ---- G7 版本三处一致 ----------------------------------------------------
  for (const f of allMd) {
    const fm = fmOf(f.abs);
    if (!fm.present || !fm.closed) continue;
    const version = fm.data.version;
    if (version === undefined || String(version).trim() === '') continue;
    const lines = normalizeNewlines(readText(f.abs)).split('\n');
    const mask = fencedMask(lines);
    const start = fm.endLine + 1;
    const headerVersion = findHeaderVersion(lines, start, mask);
    if (!headerVersion) {
      add('error', 'G7', `缺头部「> 版本：vX.Y」行（frontmatter 有 version 时必须三处一致）`, { file: f.rel });
      continue;
    }
    const table = findRevisionTable(lines, start, mask);
    if (!table || table.rows.length === 0) {
      add('error', 'G7', '缺修订表（「## 修订记录」后的第一张表）', { file: f.rel });
      continue;
    }
    const lastRow = table.rows[table.rows.length - 1];
    const tableVersion = versionFromCell(lastRow.cells[0]);
    if (!tableVersion) {
      add('error', 'G7', '修订表末行首列不是版本号（应为 vX.Y）', { file: f.rel, line: lastRow.lineNo });
      continue;
    }
    const a = normVersion(version);
    const b = normVersion(headerVersion);
    const c = normVersion(tableVersion);
    if (a !== b || a !== c) {
      add('error', 'G7', `版本三处不一致：frontmatter ${version} / 头部 ${headerVersion} / 修订表末行 ${tableVersion}`, {
        file: f.rel,
        line: lastRow.lineNo,
      });
    }
  }

  // ---- G8 快照完整性 ------------------------------------------------------
  for (const hdir of historyDirs) {
    const hRel = relFrom(root, hdir);
    const hReadmeAbs = join(hdir, 'README.md');
    const hReadmeText = existsSync(hReadmeAbs) ? readText(hReadmeAbs) : null;
    const manifestAbs = join(hdir, 'manifest.json');
    const manifestRel = `${hRel}/manifest.json`;
    let manifest = null;
    let manifestBroken = false;
    if (existsSync(manifestAbs)) {
      try {
        const parsed = parseJsonText(readText(manifestAbs));
        manifest = parsed && typeof parsed === 'object' ? parsed : null;
        if (!manifest) manifestBroken = true;
      } catch {
        manifestBroken = true;
      }
    }
    const snapshots = safeReaddir(hdir).filter(
      (e) => e.isFile() && !e.isSymbolicLink() && e.name.toLowerCase().endsWith('.md') && e.name !== 'README.md',
    );
    // 目录级问题只报一次，逐文件问题逐条报（避免同一缺失刷屏）
    if (snapshots.length > 0 && hReadmeText === null) {
      add('error', 'G8', `缺 ${hRel}/README.md 版本索引（跑 docs-gate <root> fix 或 init）`, { file: `${hRel}/README.md` });
    }
    if (snapshots.length > 0 && manifestBroken) {
      add('error', 'G8', `${manifestRel} 解析失败（JSON 非法）`, { file: manifestRel });
    } else if (snapshots.length > 0 && !manifest) {
      add('error', 'G8', `缺 ${manifestRel} 快照清单（跑 docs-gate <root> fix）`, { file: manifestRel });
    }
    for (const entry of snapshots) {
      stats.snapshots += 1;
      const abs = join(hdir, entry.name);
      const snapRel = `${hRel}/${entry.name}`;
      if (hReadmeText !== null && !hReadmeText.includes(entry.name)) {
        add('error', 'G8', `快照未进 history/README.md 索引：${entry.name}`, { file: snapRel });
      }
      if (manifest && !manifestBroken) {
        const recorded = findManifestEntry(manifest, entry.name);
        if (!recorded) {
          add('error', 'G8', `manifest.json 缺快照条目：${entry.name}（跑 docs-gate <root> fix）`, { file: manifestRel });
        } else if (typeof recorded.sha256 !== 'string' || recorded.sha256.trim() === '') {
          add('error', 'G8', `manifest.json 条目缺 sha256：${entry.name}（跑 docs-gate <root> fix）`, { file: manifestRel });
        } else if (!snapshotHashMatches(abs, recorded.sha256)) {
          add('error', 'G8', `快照哈希不符（快照不可变，禁止手改）：${entry.name}`, { file: snapRel });
        }
      }
      const snapFm = fmOf(abs);
      if (!snapFm.present || !snapFm.closed || snapFm.data.status !== 'archived') {
        add('error', 'G8', `快照缺 frontmatter「status: archived」：${entry.name}`, { file: snapRel });
      }
      if (!snapFm.present || !snapFm.closed || String(snapFm.data['superseded-by'] ?? '').trim() === '') {
        add('error', 'G8', `快照缺 frontmatter「superseded-by」：${entry.name}`, { file: snapRel });
      }
    }
  }

  // ---- G9 现版不重复入历史 ------------------------------------------------
  for (const f of allMd) {
    const fm = fmOf(f.abs);
    if (!fm.present || !fm.closed) continue;
    const version = fm.data.version;
    if (version === undefined || String(version).trim() === '') continue;
    if (isRecordPath(f.rel)) continue; // 记录/归档不是「现版」
    const hdir = join(dirname(f.abs), 'history');
    if (!existsSync(hdir)) continue;
    const current = normVersion(version);
    for (const entry of safeReaddir(hdir)) {
      if (!entry.isFile() || entry.isSymbolicLink()) continue;
      if (!entry.name.toLowerCase().endsWith('.md') || entry.name === 'README.md') continue;
      const snapFm = fmOf(join(hdir, entry.name));
      if (!snapFm.present || !snapFm.closed) continue;
      const snapVersion = snapFm.data.version;
      if (snapVersion === undefined) continue;
      if (normVersion(snapVersion) === current) {
        add('error', 'G9', `现版版本 ${version} 与历史快照 ${entry.name} 重复（现版路径不带版本号，快照版本必须低于现版）`, {
          file: f.rel,
        });
      }
    }
  }

  // ---- G10 修订行依据 -----------------------------------------------------
  const docsBasenames = allMd.filter((f) => isDocTree(f.rel)).map((f) => basenameOf(f.abs));
  for (const f of allMd) {
    const fm = fmOf(f.abs);
    const lines = normalizeNewlines(readText(f.abs)).split('\n');
    const start = fm.present && fm.closed ? fm.endLine + 1 : 0;
    const table = findRevisionTable(lines, start, fencedMask(lines));
    if (!table) continue;
    for (const row of table.rows) {
      const evidence = String(row.cells[3] ?? '').trim();
      const rowVersion = versionFromCell(row.cells[0]);
      const label = rowVersion ? `（版本 ${rowVersion}）` : '';
      if (evidence === '' || evidence === '-' || evidence === '—' || evidence === '–') {
        const message = `修订记录「依据」列为空${label}：修订必须挂 ADR / 评审记录 / 01-approval.md`;
        add(strict ? 'error' : 'warning', 'G10', message, { file: f.rel, line: row.lineNo });
        continue;
      }
      if (!resolveEvidence(root, f.abs, evidence, docsBasenames)) {
        add('warning', 'G10', `修订记录「依据」未能解析到现存文件${label}：${evidence}`, { file: f.rel, line: row.lineNo });
      }
    }
  }

  // ---- G11 计划 docsRead --------------------------------------------------
  const planAbs = join(root, '03-plan.json');
  if (tier >= 3 && existsSync(planAbs)) {
    let plan = null;
    try {
      plan = parseJsonText(readText(planAbs));
    } catch {
      add('error', 'G11', '03-plan.json 解析失败（JSON 非法）', { file: '03-plan.json' });
    }
    if (plan && typeof plan === 'object') {
      const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
      stats.plans = tasks.length;
      for (const task of tasks) {
        const id = task && typeof task === 'object' ? String(task.id ?? task.subject ?? task.name ?? '?') : '?';
        const docsRead = task && typeof task === 'object' ? task.docsRead : undefined;
        if (!Array.isArray(docsRead)) {
          add('error', 'G11', `任务 ${id} 缺 docsRead（docTier=3 计划每个任务必须带字符串数组）`, { file: '03-plan.json' });
          continue;
        }
        if (!docsRead.every((p) => typeof p === 'string' && p.trim() !== '')) {
          add('error', 'G11', `任务 ${id} 的 docsRead 含非字符串或空项`, { file: '03-plan.json' });
          continue;
        }
        if (docsRead.length === 0) {
          add('error', 'G11', `任务 ${id} 的 docsRead 为空（docTier=3 时不得为空）`, { file: '03-plan.json' });
          continue;
        }
        for (const p of docsRead) {
          if (!planPathExists(root, p)) {
            add('error', 'G11', `任务 ${id} 的 docsRead 路径不存在：${p}`, { file: '03-plan.json' });
          }
        }
      }
    }
  }

  // ---- 输出 ---------------------------------------------------------------
  const ok = errors.length === 0;
  if (asJson) {
    console.log(JSON.stringify({ ok, root, tier, checked: stats, errors, warnings }, null, 2));
  } else {
    for (const w of warnings) console.log(formatLine('⚠', w));
    for (const e of errors) console.error(formatLine('✗', e));
    console.log(
      `[docs-gate] ${ok ? 'PASS' : 'FAIL'} — tier=${tier}（${tierSource}）${strict ? '，strict' : ''}；` +
        `检查 ${stats.docs} 份文档 / 快照 ${stats.snapshots} / ADR ${stats.adrs} / 计划任务 ${stats.plans}；` +
        `error ${errors.length} / warning ${warnings.length}`,
    );
  }
  return ok ? 0 : 1;
}

function formatLine(symbol, item) {
  const loc = item.file ? `${item.file}${item.line ? `:${item.line}` : ''}` : '';
  return `  ${symbol} ${item.id} ${loc}${loc ? ' — ' : ''}${item.message}`;
}

// --- init -------------------------------------------------------------------

function runInit(root, tier) {
  const actions = [];
  const record = (path, action, reason) => actions.push({ path, action, ...(reason ? { reason } : {}) });

  const dirs = [
    `${GOV_DIR}/adr`,
    `${GOV_DIR}/评审记录`,
    ...HISTORY_STAGES.map((stage) => `docs/${stage}/history`),
  ];
  for (const rel of dirs) {
    const abs = join(root, rel);
    if (existsSync(abs)) {
      record(rel, 'skip', '目录已存在');
    } else {
      mkdirSync(abs, { recursive: true });
      record(rel, 'create');
    }
  }

  // 点开头占位文件（G4 明确忽略点开头项）
  for (const rel of [`${GOV_DIR}/adr/.gitkeep`, `${GOV_DIR}/评审记录/.gitkeep`]) {
    const abs = join(root, rel);
    if (existsSync(abs)) {
      record(rel, 'skip', '文件已存在');
    } else {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, '', 'utf8');
      record(rel, 'create');
    }
  }

  const files = [
    [`${GOV_DIR}/执行步骤.md`, SKELETON_STEPS],
    [`${GOV_DIR}/开发顺序.md`, SKELETON_ORDER],
    [`${GOV_DIR}/评审状态.md`, SKELETON_REVIEW_STATUS],
    [`${GOV_DIR}/ADR-索引.md`, SKELETON_ADR_INDEX],
    [`${GOV_DIR}/评审记录/README.md`, SKELETON_REVIEW_README],
    ...HISTORY_STAGES.flatMap((stage) => [
      [`docs/${stage}/history/README.md`, SKELETON_HISTORY_README],
      [`docs/${stage}/history/manifest.json`, SKELETON_MANIFEST],
    ]),
    [normalizePath(DEFAULT_BASELINE), baselineText()],
  ];
  for (const [rel, content] of files) {
    const abs = join(root, rel);
    if (existsSync(abs)) {
      record(rel, 'skip', '文件已存在');
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
    record(rel, 'create');
  }

  // docs/README.md 最后写：区块内容依赖上面刚落盘的骨架
  const indexAction = ensureIndexBlock(root);
  record(indexAction.path, indexAction.action === 'unchanged' ? 'skip' : indexAction.action, indexAction.action === 'unchanged' ? '内容已一致' : undefined);

  return report('init', root, tier, actions);
}

// --- fix --------------------------------------------------------------------

function runFix(root, tier) {
  const actions = [];
  const indexAction = ensureIndexBlock(root);
  actions.push({ path: indexAction.path, action: indexAction.action === 'unchanged' ? 'unchanged' : indexAction.action });

  for (const hdir of listDirsNamed(join(root, 'docs'), 'history')) {
    const hRel = relFrom(root, hdir);
    const manifestAbs = join(hdir, 'manifest.json');
    const snapshots = safeReaddir(hdir).filter(
      (e) => e.isFile() && !e.isSymbolicLink() && e.name.toLowerCase().endsWith('.md') && e.name !== 'README.md',
    );
    if (snapshots.length === 0 && !existsSync(manifestAbs)) continue;

    const hadManifest = existsSync(manifestAbs);
    let manifest = null;
    if (hadManifest) {
      try {
        const parsed = parseJsonText(readText(manifestAbs));
        if (parsed && typeof parsed === 'object') manifest = parsed;
      } catch {
        manifest = null;
      }
    }
    if (!manifest) manifest = { version: 1, snapshots: {} };
    if (!Number.isInteger(manifest.version)) manifest.version = 1;
    if (!manifest.snapshots || typeof manifest.snapshots !== 'object') manifest.snapshots = {};

    let patched = 0;
    for (const entry of snapshots) {
      const abs = join(hdir, entry.name);
      const buf = readFileSync(abs);
      const existing = findManifestEntry(manifest, entry.name);
      if (existing && typeof existing.sha256 === 'string' && existing.sha256.trim() !== '') continue; // 已有哈希不覆盖
      const sha256 = createHash('sha256').update(buf).digest('hex');
      if (existing) {
        existing.sha256 = sha256;
        if (!Number.isInteger(existing.bytes)) existing.bytes = buf.length;
        if (typeof existing.takenAt !== 'string' || existing.takenAt.trim() === '') existing.takenAt = today();
      } else {
        manifest.snapshots[entry.name] = { sha256, bytes: buf.length, takenAt: today() };
      }
      patched += 1;
    }

    if (!hadManifest || patched > 0) {
      writeFileSync(manifestAbs, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      actions.push({
        path: `${hRel}/manifest.json`,
        action: hadManifest ? 'update' : 'create',
        reason: `补齐 ${patched} 条`,
      });
    } else {
      actions.push({ path: `${hRel}/manifest.json`, action: 'unchanged' });
    }
  }

  return report('fix', root, tier, actions);
}

// --- --baseline-write -------------------------------------------------------

function runBaselineWrite(root, tier, budgets, baselineRel) {
  const allMd = walkMdFiles(root).map((abs) => ({ abs, rel: relFrom(root, abs) }));
  const fmCache = new Map();
  const fmOf = (abs) => {
    if (!fmCache.has(abs)) fmCache.set(abs, parseFrontmatter(readText(abs)));
    return fmCache.get(abs);
  };

  const oversized = {};
  for (const f of allMd) {
    const info = budgetFor(f.rel, budgets, fmOf(f.abs).data);
    if (!info) continue;
    const lines = countLines(readText(f.abs));
    if (lines > info.budget) oversized[f.rel] = lines;
  }
  const sortedOversized = {};
  for (const key of Object.keys(oversized).sort((a, b) => a.localeCompare(b))) sortedOversized[key] = oversized[key];

  const missingRef = [];
  for (const f of allMd) {
    const fm = fmOf(f.abs);
    const lines = normalizeNewlines(readText(f.abs)).split('\n');
    const start = fm.present && fm.closed ? fm.endLine + 1 : 0;
    const table = findRevisionTable(lines, start, fencedMask(lines));
    if (!table) continue;
    for (const row of table.rows) {
      const evidence = String(row.cells[3] ?? '').trim();
      if (evidence !== '' && evidence !== '-' && evidence !== '—' && evidence !== '–') continue;
      const v = versionFromCell(row.cells[0]);
      missingRef.push(`${f.rel}#${v ?? row.lineNo}`);
    }
  }

  const baselineAbs = join(root, baselineRel);
  mkdirSync(dirname(baselineAbs), { recursive: true });
  const payload = { version: 1, generatedAt: today(), oversized: sortedOversized, missingRef };
  writeFileSync(baselineAbs, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const total = Object.keys(sortedOversized).length;
  if (asJson) {
    console.log(JSON.stringify({ ok: true, root, tier, command: 'baseline-write', baseline: baselineRel, oversized: sortedOversized, missingRef }, null, 2));
  } else {
    console.log(`[docs-gate] baseline 已写入 ${baselineRel}（tier=${tier}）`);
    for (const [rel, lines] of Object.entries(sortedOversized)) console.log(`  · 超限 ${rel} — ${lines} 行`);
    for (const ref of missingRef) console.log(`  · 缺依据 ${ref}`);
    console.log(`[docs-gate] baseline 完成 — 超限 ${total} 项 / 缺依据 ${missingRef.length} 项（之后只减不增）`);
  }
  return 0;
}

// --- 报告输出 ---------------------------------------------------------------

function report(command, root, tier, actions) {
  const changed = actions.filter((a) => a.action !== 'skip' && a.action !== 'unchanged').length;
  const skipped = actions.filter((a) => a.action === 'skip').length;
  const unchanged = actions.filter((a) => a.action === 'unchanged').length;
  if (asJson) {
    console.log(JSON.stringify({ ok: true, root, tier, command, changed, skipped, unchanged, actions }, null, 2));
  } else {
    console.log(`[docs-gate] ${command} — ${root}（tier=${tier}）`);
    for (const a of actions) {
      const note = a.reason ? `（${a.reason}）` : '';
      console.log(`  ${a.action.padEnd(9)} ${a.path}${note}`);
    }
    const parts = [`改动 ${changed} 项`];
    if (skipped > 0) parts.push(`跳过 ${skipped} 项`);
    if (unchanged > 0) parts.push(`未变 ${unchanged} 项`);
    console.log(`[docs-gate] ${command} 完成 — ${parts.join(' / ')}；下一步跑 docs-gate <root> check`);
  }
  return 0;
}

// --- 索引区块 ---------------------------------------------------------------

/** 自动索引区块的完整行（含起止标记），区间内容完全由磁盘决定。 */
function generateIndexBlockLines(root) {
  return [INDEX_BEGIN, INDEX_TITLE, ...INDEX_TABLE_HEAD, ...collectIndexEntries(root), INDEX_END];
}

/** 需要进自动区块的条目（全部递归）：07-治理 下的 adr 与 评审记录，以及 docs 下任意 history 目录。 */
function collectIndexEntries(root) {
  const docsDir = join(root, 'docs');
  const seen = new Map();
  const push = (abs) => {
    const rel = relFrom(docsDir, abs);
    if (rel.startsWith('..') || seen.has(rel)) return;
    seen.set(rel, indexRow(rel));
  };
  for (const abs of walkMdFiles(join(root, GOV_DIR, 'adr'))) push(abs);
  for (const abs of walkMdFiles(join(root, GOV_DIR, '评审记录'))) push(abs);
  for (const hdir of listDirsNamed(docsDir, 'history')) {
    for (const abs of walkMdFiles(hdir)) push(abs);
  }
  const rels = [...seen.keys()].sort((a, b) => a.localeCompare(b));
  return rels.map((rel) => seen.get(rel));
}

function indexRow(relFromDocs) {
  const base = relFromDocs.split('/').pop() ?? '';
  const inHistory = /(^|\/)history\//.test(relFromDocs);
  const inArchive = /(^|\/)archive\//.test(relFromDocs);
  let category = '版本快照';
  if (relFromDocs.startsWith(`${GOV_IN_DOCS}/adr/`)) category = 'ADR';
  else if (relFromDocs.startsWith(`${GOV_IN_DOCS}/评审记录/`)) category = '评审记录';
  const archived = inArchive || (inHistory && base !== 'README.md');
  const status = archived ? '归档' : '现行';
  return `| [${relFromDocs}](${relFromDocs}) | ${category} | ${status} |`;
}

function extractIndexBlockLines(text) {
  const lines = normalizeNewlines(text).split('\n');
  const begin = lines.findIndex((line) => line.includes(INDEX_BEGIN));
  const end = lines.findIndex((line) => line.includes(INDEX_END));
  if (begin < 0 || end < 0 || end < begin) return null;
  return lines.slice(begin, end + 1);
}

function replaceIndexBlockText(text, blockLines) {
  const lines = normalizeNewlines(text).split('\n');
  const begin = lines.findIndex((line) => line.includes(INDEX_BEGIN));
  const end = lines.findIndex((line) => line.includes(INDEX_END));
  if (begin >= 0 && end > begin) {
    const next = [...lines.slice(0, begin), ...blockLines, ...lines.slice(end + 1)];
    return { text: next.join('\n'), action: 'update' };
  }
  let kept = lines.slice();
  if (begin >= 0) kept = kept.slice(0, begin);
  else if (end >= 0) kept = kept.filter((line) => !line.includes(INDEX_END));
  while (kept.length > 0 && kept[kept.length - 1].trim() === '') kept.pop();
  const next = kept.length > 0 ? [...kept, '', ...blockLines] : [...blockLines];
  return { text: `${next.join('\n')}\n`, action: begin >= 0 || end >= 0 ? 'update' : 'append' };
}

/** 创建或重写 docs/README.md 的自动区块；不改动标记之外的正文。 */
function ensureIndexBlock(root) {
  const docsDir = join(root, 'docs');
  const readmeAbs = join(docsDir, 'README.md');
  const blockLines = generateIndexBlockLines(root);
  if (!existsSync(readmeAbs)) {
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(readmeAbs, `${docsReadmeHead(root)}\n\n${blockLines.join('\n')}\n`, 'utf8');
    return { path: 'docs/README.md', action: 'create' };
  }
  const before = readText(readmeAbs);
  const next = replaceIndexBlockText(before, blockLines);
  if (next.text === normalizeNewlines(before)) return { path: 'docs/README.md', action: 'unchanged' };
  writeFileSync(readmeAbs, next.text, 'utf8');
  return { path: 'docs/README.md', action: 'update' };
}

function docsReadmeHead(root) {
  const rows = [];
  for (const stage of DEEP_STAGES) {
    if (!existsSync(join(root, 'docs', stage))) continue;
    rows.push(`| [${stage}](${stage}/) | ${STAGE_NOTES[stage] ?? '—'} | 待补 |`);
  }
  if (existsSync(join(root, 'docs', 'project'))) {
    rows.push('| [project](project/) | T1 薄记忆（摘要 + 链接，每件 ≤120 行） | 待补 |');
  }
  const table = rows.length > 0 ? ['| 目录 | 放什么 | 状态 |', '|---|---|---|', ...rows].join('\n') : '';
  return [
    '# 文档地图',
    '',
    '> 目录级索引：同一主题只一份；T1 `docs/project/` 只放摘要与链接，正文进本树。',
    '> 「归档与快照索引」区块由脚本维护（勿手写）；跑 `docs-gate <root> fix` 重建。',
    '> 新增/删除/重命名文档必须同步本表与根 `AGENTS.md`。',
    '',
    table,
  ].join('\n');
}

function describeIndexDiff(actualLines, expectedLines) {
  const rowsOf = (lines) => lines.filter((line) => line.startsWith('| ['));
  const actualSet = new Set(rowsOf(actualLines));
  const expectedSet = new Set(rowsOf(expectedLines));
  const missing = [...expectedSet].filter((row) => !actualSet.has(row)).map(rowLabel);
  const extra = [...actualSet].filter((row) => !expectedSet.has(row)).map(rowLabel);
  const parts = [];
  if (missing.length > 0) parts.push(`缺 ${missing.length} 条（${sampleList(missing)}）`);
  if (extra.length > 0) parts.push(`多 ${extra.length} 条（${sampleList(extra)}）`);
  if (parts.length === 0) parts.push('条目顺序或行内容与生成结果不一致');
  return `自动索引区块与磁盘不一致：${parts.join('；')}（跑 docs-gate <root> fix 重写；该区块勿手写）`;
}

function rowLabel(row) {
  const withTarget = /\| \[[^\]]*\]\(([^)]+)\)/.exec(row);
  if (withTarget) return withTarget[1];
  const m = /\| \[([^\]]+)\]/.exec(row);
  return m ? m[1] : row;
}

function sampleList(items) {
  const head = items.slice(0, 3).join('、');
  return items.length > 3 ? `${head} 等` : head;
}

// --- 预算 -------------------------------------------------------------------

/** 记录文档（快照/归档/ADR/评审记录）不计入活文档体积预算。 */
function isRecordPath(rel) {
  if (/(^|\/)history\//.test(rel)) return true;
  if (/(^|\/)archive\//.test(rel)) return true;
  if (rel.startsWith(`${GOV_DIR}/adr/`)) return true;
  if (rel.startsWith(`${GOV_DIR}/评审记录/`)) return true;
  return false;
}

function budgetFor(rel, budgets, fmData) {
  const base = rel.split('/').pop() ?? '';
  if (base === 'AGENTS.md') return { budget: budgets.agents, label: 'AGENTS 预算' };
  if (rel === 'README.md') return { budget: budgets.readme, label: '根 README 预算' };
  if (rel === 'docs/README.md') return { budget: budgets.docsIndex, label: 'docs 地图预算' };
  if (isRecordPath(rel)) return null;
  const explicit = Number(fmData && fmData.budget);
  if (Number.isFinite(explicit) && explicit > 0) return { budget: explicit, label: 'frontmatter budget' };
  if (String(fmData && fmData.hub).toLowerCase() === 'true') return { budget: budgets.hub, label: 'hub 预算' };
  const t1Prefix = 'docs/project/';
  if (rel.startsWith(t1Prefix) && !rel.slice(t1Prefix.length).includes('/')) {
    return { budget: budgets.t1, label: 'T1 预算' };
  }
  if (/^docs\/0[1-7]-[^/]+\//.test(rel)) return { budget: budgets.doc, label: '单册预算' };
  return null;
}

// --- 配置 / 基线 -------------------------------------------------------------

function readConfig(root) {
  const candidates = [join(root, 'steward.config.json'), join(root, '.steward', 'steward.config.json')];
  for (const abs of candidates) {
    if (!existsSync(abs)) continue;
    try {
      const parsed = parseJsonText(readText(abs));
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      return null; // 配置损坏：按 docTier=1 处理，其余检查照跑
    }
  }
  return null;
}

function readBaseline(root, baselineRel) {
  const abs = join(root, baselineRel);
  const empty = { oversized: {}, missingRef: [] };
  if (!existsSync(abs)) return empty;
  try {
    const parsed = parseJsonText(readText(abs));
    if (!parsed || typeof parsed !== 'object') return empty;
    const oversized = {};
    if (parsed.oversized && typeof parsed.oversized === 'object') {
      for (const [key, value] of Object.entries(parsed.oversized)) {
        const n = Number(value);
        if (Number.isFinite(n)) oversized[normalizePath(key).replace(/^\.\//, '')] = n;
      }
    }
    const missingRef = Array.isArray(parsed.missingRef) ? parsed.missingRef.filter((x) => typeof x === 'string') : [];
    return { oversized, missingRef };
  } catch {
    return empty;
  }
}

function baselineText() {
  return `${JSON.stringify({ version: 1, generatedAt: today(), oversized: {}, missingRef: [] }, null, 2)}\n`;
}

// --- 快照 / ADR / 依据 -------------------------------------------------------

function findManifestEntry(manifest, fileName) {
  const snapshots = manifest && typeof manifest === 'object' ? manifest.snapshots : null;
  if (!snapshots || typeof snapshots !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(snapshots, fileName)) return snapshots[fileName];
  for (const [key, value] of Object.entries(snapshots)) {
    if (basenameOf(key) === fileName) return value;
  }
  return null;
}

/** 同时接受「原始字节 sha256」与「CRLF→LF 归一化后 sha256」，避免跨平台误报。 */
function snapshotHashMatches(abs, expected) {
  const want = String(expected).trim().toLowerCase();
  if (want === '') return false;
  const buf = readFileSync(abs);
  const raw = createHash('sha256').update(buf).digest('hex');
  if (raw === want) return true;
  const normalized = createHash('sha256').update(normalizeNewlines(buf.toString('utf8')), 'utf8').digest('hex');
  return normalized === want;
}

function adrHeadStatus(text) {
  const lines = normalizeNewlines(text).split('\n');
  const mask = fencedMask(lines);
  for (let i = 0; i < lines.length; i += 1) {
    if (mask[i]) continue;
    const line = lines[i].trim();
    const known = /^>\s*状态\s*[：:]\s*(提议|接受|拒绝|已落地|已废弃)/.exec(line);
    if (known) return known[1];
    const generic = /^>\s*状态\s*[：:]\s*(\S+)/.exec(line);
    if (generic) return stripMarkdown(generic[1]);
  }
  return null;
}

function pickStatusCell(cells) {
  if (!Array.isArray(cells)) return null;
  for (const cell of cells) {
    const text = stripMarkdown(cell);
    if (ADR_STATUSES.includes(text)) return text;
  }
  for (const cell of cells) {
    const text = stripMarkdown(cell);
    const hit = ADR_STATUSES.find((status) => text.includes(status));
    if (hit) return hit;
  }
  return null;
}

function resolveEvidence(root, docAbs, evidence, docsBasenames) {
  const docDir = dirname(docAbs);
  const docsDir = join(root, 'docs');
  const govDir = join(root, GOV_DIR);
  const tokens = evidenceTokens(evidence);
  for (const token of tokens) {
    const t = token.replace(/^\.\//, '').trim();
    if (t === '') continue;
    if (/\.md$/i.test(t)) {
      const candidates = [resolve(docDir, t), resolve(root, t), resolve(docsDir, t), resolve(govDir, t)];
      if (candidates.some((abs) => existsSync(abs))) return true;
      // 同域引用：history/ 快照里的依据常写成相对现版的同域文件名（如 01-approval.md），
      // 逐级向上找祖先目录，避免快照一律报「依据未解析」。
      for (let dir = docDir; dir.length > root.length; dir = dirname(dir)) {
        if (existsSync(resolve(dir, t))) return true;
      }
      continue;
    }
    // 无扩展名标识（ADR-0012 / 评审记录-20261110）：按 docs 下文件名前缀匹配
    if (docsBasenames.some((name) => name.startsWith(t))) return true;
  }
  return false;
}

function evidenceTokens(evidence) {
  const tokens = new Set();
  for (const m of evidence.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) tokens.add(m[1].trim());
  for (const m of evidence.matchAll(/`([^`]+)`/g)) tokens.add(m[1].trim());
  for (const m of evidence.matchAll(/([A-Za-z0-9_\-.\u4e00-\u9fa5]+\.md)/g)) tokens.add(m[1]);
  for (const m of evidence.matchAll(/(ADR-\d{3,4})/g)) tokens.add(m[1]);
  for (const m of evidence.matchAll(/(评审记录-\d{4,8}(?:-[^\s，,；;+]+)?)/g)) tokens.add(m[1]);
  return [...tokens];
}

function planPathExists(root, relPath) {
  const cleaned = normalizePath(String(relPath).trim());
  if (cleaned === '') return false;
  return existsSync(resolve(root, cleaned)) || existsSync(resolve(root, 'docs', cleaned));
}

// --- frontmatter / 表格 ------------------------------------------------------

function parseFrontmatter(raw) {
  const text = normalizeNewlines(stripBom(raw));
  const lines = text.split('\n');
  if (lines.length === 0 || (lines[0] ?? '').trim() !== '---') {
    return { present: false, closed: true, data: {}, endLine: -1, lines };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (trimmed === '---' || trimmed === '...') {
      end = i;
      break;
    }
  }
  if (end < 0) return { present: true, closed: false, data: {}, endLine: -1, lines };
  const data = {};
  for (let i = 1; i < end; i += 1) {
    const m = /^([A-Za-z0-9_.\-]+)\s*:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    data[m[1]] = unquote(m[2].trim());
  }
  return { present: true, closed: true, data, endLine: end, lines };
}

function unquote(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) return value.slice(1, -1);
  }
  return value;
}

function findHeaderVersion(lines, startIdx, mask) {
  for (let i = Math.max(0, startIdx); i < lines.length; i += 1) {
    if (mask && mask[i]) continue;
    const m = /^>\s*\**\s*版本\s*\**\s*[：:]\s*(v?\d+\.\d+(?:\.\d+)?)/.exec(lines[i].trim());
    if (m) return m[1];
  }
  return null;
}

function findRevisionTable(lines, startIdx, mask) {
  let heading = -1;
  for (let i = Math.max(0, startIdx); i < lines.length; i += 1) {
    if (mask && mask[i]) continue;
    if (REVISION_HEADING_RE.test(lines[i].trim())) {
      heading = i;
      break;
    }
  }
  if (heading < 0) return null;
  let start = -1;
  for (let i = heading + 1; i < lines.length; i += 1) {
    if (mask && mask[i]) continue;
    const trimmed = lines[i].trim();
    if (trimmed === '') continue;
    if (/^#{2,6}\s/.test(trimmed)) break;
    if (trimmed.startsWith('|')) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  const raw = [];
  let i = start;
  while (i < lines.length && !(mask && mask[i]) && lines[i].trim().startsWith('|')) {
    raw.push({ text: lines[i].trim(), lineNo: i + 1 });
    i += 1;
  }
  if (raw.length === 0) return null;
  let body = raw.slice(1);
  if (body.length > 0 && isSeparatorRow(body[0].text)) body = body.slice(1);
  return { rows: body.map((row) => ({ cells: splitTableRow(row.text), lineNo: row.lineNo })), startLine: raw[0].lineNo };
}

/** 标记代码围栏内的行：围栏里的示例表格/示例版本行不参与机检，避免文档示例被误判。 */
function fencedMask(lines) {
  const mask = new Array(lines.length).fill(false);
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (/^(```|~~~)/.test(trimmed)) {
      mask[i] = true;
      inFence = !inFence;
      continue;
    }
    mask[i] = inFence;
  }
  return mask;
}

function splitTableRow(line) {
  let s = String(line).trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((cell) => cell.trim());
}

function isSeparatorRow(line) {
  const s = String(line).trim();
  return SEPARATOR_ROW_RE.test(s) && s.includes('-');
}

function versionFromCell(cell) {
  const m = VERSION_IN_TEXT_RE.exec(String(cell ?? '').trim());
  return m ? m[1] : null;
}

function normVersion(value) {
  return String(value ?? '').trim().toLowerCase().replace(/^v/, '');
}

function stripMarkdown(value) {
  return String(value ?? '').replace(/[*`_\[\]]/g, '').trim();
}

// --- 通用工具 ---------------------------------------------------------------

function parseArgs(argv) {
  const out = { json: false, strict: false, baselineWrite: false, help: false, tier: null, rest: [], unknown: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--strict') out.strict = true;
    else if (arg === '--baseline-write') out.baselineWrite = true;
    else if (arg === '--tier') {
      out.tier = argv[i + 1] ?? '';
      i += 1;
    } else if (arg.startsWith('--tier=')) out.tier = arg.slice('--tier='.length);
    else if (arg.startsWith('-')) out.unknown.push(arg);
    else out.rest.push(arg);
  }
  return out;
}

function readText(abs) {
  try {
    return readFileSync(abs, 'utf8');
  } catch {
    return '';
  }
}

/** JSON 读取统一入口：Windows 上 PowerShell/编辑器可能写 BOM，必须剥掉再 parse。 */
function parseJsonText(text) {
  return JSON.parse(stripBom(normalizeNewlines(text)));
}

function safeReaddir(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function walkMdFiles(dir, out = []) {
  for (const entry of safeReaddir(dir)) {
    if (EXCLUDE_SEGMENTS.has(entry.name)) continue;
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkMdFiles(full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) out.push(full);
  }
  return out;
}

function listDirsNamed(baseDir, name, out = []) {
  for (const entry of safeReaddir(baseDir)) {
    if (EXCLUDE_SEGMENTS.has(entry.name)) continue;
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const full = join(baseDir, entry.name);
    if (entry.name === name) out.push(full);
    listDirsNamed(full, name, out);
  }
  return out;
}

function basenameOf(path) {
  const parts = normalizePath(path).split('/');
  return parts[parts.length - 1] ?? '';
}

function relFrom(base, abs) {
  return normalizePath(relative(base, abs));
}

function normalizePath(value) {
  return String(value ?? '').replace(/\\/g, '/');
}

function normalizeNewlines(text) {
  return String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stripBom(text) {
  return String(text ?? '').replace(/^\uFEFF/, '');
}

function countLines(text) {
  const lines = normalizeNewlines(text).split('\n');
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.length;
}

function isArchivedLocation(rel) {
  return /(^|\/)history\//.test(rel) || /(^|\/)archive\//.test(rel);
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fail(code, message) {
  if (asJson) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  else console.error(`[docs-gate] ${message}`);
  process.exit(code);
}

// --- init 骨架内容 -----------------------------------------------------------

const SKELETON_STEPS = `# 执行步骤

> 进度 SSOT：剩余工序、开放项台账。只记当前状态与结论，历史留痕进 \`评审记录/\` 与 \`adr/\`。
`;

const SKELETON_ORDER = `# 开发顺序

> 开工 SSOT：波次、并行、估算。口径变更走 ADR，不在此改写历史。
`;

const SKELETON_REVIEW_STATUS = `# 评审状态（各阶段最新门禁结论）

> 只记一行结论 + 证据链接；正文进对应评审记录，不在此复制。

| 阶段 | 最新结论 | 日期 | 评审记录 |
|---|---|---|---|
`;

const SKELETON_ADR_INDEX = `# ADR 索引

> 每条一行；状态必须与 ADR 文件头 \`> 状态：\` 一致（docs-gate G6 双向核对）。
> 新增 ADR 后在表末追加一行，再跑 \`docs-gate <root> check\`。

| 编号 | 日期 | 主题 | 状态 | 文件 |
|---|---|---|---|---|
`;

const SKELETON_REVIEW_README = `# 评审记录索引

> 活索引：每篇一行；归档轮转后跑 \`docs-gate <root> fix\` 重建 docs 自动区块。
> 只有阶段门禁评审进本目录；run 级报告（QA / 终审 / 浏览器证据）留 \`tmp/steward/<run>/reports/\`。

| 日期 | 主题 | 结论 | 文件 |
|---|---|---|---|
`;

const SKELETON_HISTORY_README = `# 版本快照索引

> 基线冻结（major bump）时由脚本追加一行；快照文件不可变，禁止手改（\`manifest.json\` 哈希会报 G8）。
> 实现任务禁读本目录：历史基线不是现行口径。

| 版本 | 日期 | 摘要 | 依据 | 快照 |
|---|---|---|---|---|
`;

const SKELETON_MANIFEST = '{ "version": 1, "snapshots": {} }\n';

process.exit(main());
