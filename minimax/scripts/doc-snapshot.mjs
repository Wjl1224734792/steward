#!/usr/bin/env node
/**
 * doc-snapshot.mjs — 基线文档版本快照（history/ 归档 + manifest 哈希 + 历史索引 + superseded-by，幂等）。
 *
 * 用法：
 *   node scripts/doc-snapshot.mjs <docPath> --next <vX.Z> [--note <摘要>] [--ref <依据>] [--by <拍板人>] [--json]
 *
 * 九步（对应 文档治理实施单 §6.2，实现补充见 §9.2）：
 *   1. 读现版：首个 --- frontmatter（值去引号）+ 头部「> 版本：」行；缺 version 直接报错，不猜版本。
 *   2. 快照版本 = 现版 version；校验 --next（存在、v?X.Y(.Z)?、不等于快照版本）。
 *   3. 目标 = 同域 history/<basename 去扩展>-<快照版本>.md。
 *   4. 快照 = 原文 + frontmatter 注入 status: archived / version / superseded-by + 取代提示行。
 *   5. 现版 bump：frontmatter version、头部版本行、修订表追加一行（缺节/表头则补）。
 *   6. history/README.md 追加索引行（表头缺失先补）。
 *   7. history/manifest.json 记录快照 sha256 / bytes / takenAt（保留已有条目）。
 *   8. 调同目录 docs-gate.mjs <root> fix 重写 docs/README.md 自动索引区块（脚本缺失/失败只提示不崩）。
 *   9. 输出摘要（快照路径、现版新版本、manifest 条目、下一步）。
 *
 * 幂等（Lead 拍板判据）：现版 frontmatter version 已等于 --next，且既有快照的 manifest sha256 与磁盘实际一致
 *   （manifest 缺该条时退化为「快照含 status: archived 且 superseded-by 指向存在文件」）→ 输出 skip、退出 0、不改任何文件。
 * 快照不可变：已存在但校验不通 → 退出 1，提示人工确认后删除重做（禁止手改快照）。
 *
 * 退出码：0 = 完成或幂等 skip；1 = 校验失败/文件冲突（含 --next 缺失/非法/等于现版，见 §6.2 步骤 2）；2 = 用法错误。
 * 约束：纯 Node 内置模块零依赖；读入统一 CRLF→LF 后解析、按 \n 写回；输出路径统一 /；先算全部产物再统一落盘。
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF_DIR = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const GATE_SCRIPT = join(SELF_DIR, 'docs-gate.mjs');

const VERSION_RE = /^v?\d+\.\d+(\.\d+)?$/;
const VERSION_TOKEN_RE = /v?\d+\.\d+(?:\.\d+)?/;
const HEADER_VERSION_RE = /^(>\s*版本\s*[：:]\s*)(.*)$/;
const REVISION_HEADING_RE = /^#{1,6}\s*修订记录\s*$/;
const ANY_HEADING_RE = /^#{1,6}\s+\S/;
const TABLE_LINE_RE = /^\s*\|/;
const REVISION_HEADER = '| 版本 | 日期 | 变更摘要（FR/FP 编号） | 依据（拍板留痕） | 拍板人 | 快照 |';
const REVISION_SEP = '|---|---|---|---|---|---|';
const HISTORY_HEADER = '| 版本 | 日期 | 摘要 | 依据 | 快照 |';
const HISTORY_SEP = '|---|---|---|---|---|';
const IMMUTABLE_HINT = '快照已存在且不可变，勿手改；如需重做请人工确认后删除';

// ---------------------------------------------------------------- CLI

let asJson = false;
let wantHelp = false;
const options = { next: null, note: '-', ref: '-', by: '-' };
const positional = [];
const argv = process.argv.slice(2);

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--json') {
    asJson = true;
    continue;
  }
  if (arg === '--help' || arg === '-h') {
    wantHelp = true;
    continue;
  }
  if (arg === '--next' || arg === '--note' || arg === '--ref' || arg === '--by') {
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) fail(2, `参数 ${arg} 缺少取值。用法见 --help。`);
    options[arg.slice(2)] = value;
    i++;
    continue;
  }
  if (arg.startsWith('-') && arg !== '-') fail(2, `未知参数：${arg}。用法见 --help。`);
  positional.push(arg);
}

if (wantHelp) {
  printUsage();
  process.exit(0);
}
if (positional.length === 0) {
  printUsage();
  fail(2, '缺少 <docPath> 参数。');
}
if (positional.length > 1) {
  fail(2, `只接受一个文档路径，收到多余参数：${positional.slice(1).join('、')}`);
}

// ---------------------------------------------------------------- 步骤 1：读现版
const docAbs = resolve(positional[0]);
if (!existsSync(docAbs)) fail(1, `文档不存在：${display(docAbs)}`);
if (!safeIsFile(docAbs)) fail(1, `不是文件：${display(docAbs)}`);

let docText;
try {
  docText = readText(docAbs);
} catch (err) {
  fail(1, `读取文档失败：${display(docAbs)}（${err.message}）`);
}

const { lines, trailingNL } = splitText(docText);
const fm = parseFrontmatter(lines);
if (!fm.has) {
  fail(1, `${display(docAbs)} 缺 frontmatter（需含 version: vX.Y）。请先补 frontmatter，本脚本不猜版本。`);
}
if (!fm.closed) {
  fail(1, `${display(docAbs)} 的 frontmatter 未闭合（缺结束行 ---），请先修复文档头。`);
}
const currentVersion = fmValue(fm, 'version');
if (!currentVersion) {
  fail(1, `${display(docAbs)} 的 frontmatter 缺 version。请先补 frontmatter（例如 version: v2.0），本脚本不猜版本。`);
}
if (!VERSION_RE.test(currentVersion)) {
  fail(1, `${display(docAbs)} 的 frontmatter version 不合法：${currentVersion}（应形如 v2.0 / 2.0）`);
}

// ---------------------------------------------------------------- 步骤 2：校验 --next
if (!options.next) {
  fail(1, '缺少 --next <vX.Y>。用法：node scripts/doc-snapshot.mjs <docPath> --next v2.1 [--note ...] [--ref ...] [--by ...]');
}
if (!VERSION_RE.test(options.next)) {
  fail(1, `--next 版本号不合法：${options.next}（应形如 v2.1 / 2.1）`);
}

const currentBare = bareVersion(currentVersion);
const nextBare = bareVersion(options.next);
const nextDisplay = `v${nextBare}`;
const snapshotDisplay = `v${currentBare}`;
const docName = basename(docAbs);
const docBase = basename(docAbs, extname(docAbs));
const docDir = dirname(docAbs);
const historyDir = join(docDir, 'history');
const today = todayLocal();
const warnings = [];

// ---------------------------------------------------------------- 幂等：现版 version 已等于 --next
if (currentBare === nextBare) {
  const detection = detectAlreadyApplied({ lines, docAbs, docBase, historyDir, currentBare, nextDisplay });
  if (detection.ok) {
    const message = `skip — 现版 frontmatter version 已是 ${nextDisplay}，快照 ${display(detection.snapshotAbs)} 校验通过（${detection.via === 'manifest' ? 'manifest sha256 与磁盘一致' : 'status: archived + superseded-by 自洽'}），未修改任何文件。`;
    if (asJson) {
      console.log(JSON.stringify({
        ok: true,
        skipped: true,
        reason: message,
        doc: display(docAbs),
        snapshot: display(detection.snapshotAbs),
        snapshotSha256: detection.sha256,
        nextVersion: nextDisplay,
        verifiedVia: detection.via,
      }, null, 2));
    } else {
      console.log(`[doc-snapshot] ${message}`);
    }
    process.exit(0);
  }
  if (detection.checked > 0) {
    fail(1, `${IMMUTABLE_HINT}：${detection.problems.join('；')}`);
  }
  fail(1, `--next (${nextDisplay}) 不能等于现版 frontmatter version (${currentVersion})，且未找到可验证的既有快照；如需快照请指定更高版本。`);
}

// ---------------------------------------------------------------- 步骤 3：目标路径与冲突
const snapshotVersionRaw = currentVersion; // 快照版本 = 现版 version（保留原写法）
const snapshotName = `${docBase}-${snapshotVersionRaw}.md`;
const snapshotAbs = join(historyDir, snapshotName);
if (existsSync(snapshotAbs)) {
  fail(1, `${IMMUTABLE_HINT}：${display(snapshotAbs)}（现版 version=${currentVersion}，--next=${nextDisplay}，bump 尚未生效）`);
}

// ---------------------------------------------------------------- 步骤 4+5+6+7：先算全部产物（预检）
if (existsSync(historyDir) && !safeIsDirectory(historyDir)) {
  fail(1, `${display(historyDir)} 已存在但不是目录，无法创建快照。`);
}

// 步骤 4：快照正文（原文 + frontmatter 注入 + 取代提示行）
const overrides = { status: 'archived', version: snapshotVersionRaw, 'superseded-by': `../${docName}` };
const snapshotFmLines = [];
const overriddenKeys = new Set();
for (const entry of fm.entries) {
  if (entry.key && Object.prototype.hasOwnProperty.call(overrides, entry.key)) {
    snapshotFmLines.push(`${entry.key}: ${overrides[entry.key]}`);
    overriddenKeys.add(entry.key);
  } else {
    snapshotFmLines.push(entry.raw);
  }
}
for (const key of ['status', 'version', 'superseded-by']) {
  if (!overriddenKeys.has(key)) snapshotFmLines.push(`${key}: ${overrides[key]}`);
}
const warningLine = `> ⚠ 已被 ${nextDisplay} 取代 → 现版：../${docName}（本文件为历史快照，不可修改）`;
const snapshotText = joinText(
  ['---', ...snapshotFmLines, '---', warningLine, ...lines.slice(fm.closeIdx + 1)],
  trailingNL,
);
const snapshotSha256 = sha256(snapshotText);
const snapshotBytes = Buffer.byteLength(snapshotText, 'utf8');

// 步骤 5：更新现版（frontmatter version → 头部版本行 → 修订表追加行）
const versionEntryIdx = fm.entries.findIndex((entry) => entry.key === 'version');
if (versionEntryIdx < 0) fail(1, '内部错误：frontmatter version 定位失败，未写入任何文件。');
const currentLines = [...lines];
currentLines[versionEntryIdx + 1] = `version: ${nextDisplay}`;

const headerInfo = findHeaderVersionLine(currentLines, fm.closeIdx + 1);
if (!headerInfo) {
  warnings.push('未找到头部「> 版本：」行，已跳过头部版本同步（docs-gate G7 会因版本三处不一致报错，请人工补一行）。');
} else {
  const token = headerInfo.rest.match(VERSION_TOKEN_RE);
  currentLines[headerInfo.idx] = headerInfo.prefix + (token ? headerInfo.rest.replace(token[0], nextDisplay) : nextDisplay);
}

const revisionRow = `| ${nextDisplay} | ${today} | ${cellValue(options.note)} | ${cellValue(options.ref)} | ${cellValue(options.by)} | [${snapshotDisplay}](history/${snapshotName}) |`;
const revisionResult = addRevisionRow(currentLines, revisionRow, REVISION_HEADER, REVISION_SEP);
const newDocText = joinText(revisionResult.lines, trailingNL);

// 步骤 6：history/README.md 追加索引行
const readmeAbs = join(historyDir, 'README.md');
if (existsSync(readmeAbs) && !safeIsFile(readmeAbs)) fail(1, `${display(readmeAbs)} 不是文件，无法追加索引行。`);
const historyRow = `| ${snapshotDisplay} | ${today} | ${cellValue(options.note)} | ${cellValue(options.ref)} | [快照](${snapshotName}) |`;
const readmeExisted = existsSync(readmeAbs);
let readmeMode = 'new-file';
let newReadmeText;
if (readmeExisted) {
  let readmeOriginal;
  try {
    readmeOriginal = readText(readmeAbs);
  } catch (err) {
    fail(1, `读取 history/README.md 失败：${display(readmeAbs)}（${err.message}）`);
  }
  const readmeSplit = splitText(readmeOriginal);
  const readmeResult = appendIndexRow(readmeSplit.lines, historyRow, HISTORY_HEADER, HISTORY_SEP);
  readmeMode = readmeResult.mode;
  newReadmeText = joinText(readmeResult.lines, readmeSplit.trailingNL);
} else {
  newReadmeText = [
    '# 版本快照索引',
    '',
    '> 本目录保存基线文档的历史快照（不可变，禁止手改）；索引行由 `doc-snapshot.mjs` 追加，完整性由 `docs-gate` 的 G8 校验。',
    '',
    HISTORY_HEADER,
    HISTORY_SEP,
    historyRow,
  ].join('\n') + '\n';
}

// 步骤 7：history/manifest.json（保留已有条目）
const manifestAbs = join(historyDir, 'manifest.json');
if (existsSync(manifestAbs) && !safeIsFile(manifestAbs)) fail(1, `${display(manifestAbs)} 不是文件，无法写入 manifest。`);
const manifestLoad = loadManifest(historyDir);
if (manifestLoad.exists && manifestLoad.error) {
  fail(1, `history/manifest.json 解析失败：${manifestLoad.error}。请先修复该文件（本脚本不覆盖无法解析的 manifest）。`);
}
const manifestValue = manifestLoad.value ?? { version: 1, snapshots: {} };
if (!isPlainObject(manifestValue.snapshots)) manifestValue.snapshots = {};
if (!Number.isInteger(manifestValue.version)) manifestValue.version = 1;
const manifestEntry = { sha256: snapshotSha256, bytes: snapshotBytes, takenAt: today };
manifestValue.snapshots[snapshotName] = manifestEntry;
const newManifestText = JSON.stringify(manifestValue, null, 2) + '\n';

// 完整性预检全部通过，开始统一落盘（写失败回滚已写文件，不留半成品）
const writePlan = [
  { abs: snapshotAbs, text: snapshotText },
  { abs: docAbs, text: newDocText },
  { abs: readmeAbs, text: newReadmeText },
  { abs: manifestAbs, text: newManifestText },
];
const backups = writePlan.map(({ abs }) => {
  const existed = existsSync(abs);
  return { abs, existed, raw: existed ? readFileSync(abs) : null };
});
const written = [];
try {
  mkdirSync(historyDir, { recursive: true });
  for (const item of writePlan) {
    writeFileSync(item.abs, item.text, 'utf8');
    written.push(item.abs);
  }
} catch (err) {
  const failedRollback = [];
  for (const abs of written.reverse()) {
    const backup = backups.find((b) => b.abs === abs);
    try {
      if (backup && backup.existed) writeFileSync(abs, backup.raw);
      else if (existsSync(abs)) unlinkSync(abs);
    } catch {
      failedRollback.push(display(abs));
    }
  }
  fail(1, `写入失败：${err.message}${failedRollback.length > 0 ? `；回滚未完成（${failedRollback.join('、')}），请人工检查` : '；已回滚已写文件，磁盘未留半成品'}`);
}

// ---------------------------------------------------------------- 步骤 8：索引区块同步
const root = findDocsRoot(docAbs);
const indexSync = syncIndexBlock(root);

// ---------------------------------------------------------------- 步骤 9：输出摘要
const nextCheckCommand = root
  ? `node ${display(GATE_SCRIPT)} ${display(root)} check`
  : 'node <插件>/scripts/docs-gate.mjs <root> check';

const result = {
  ok: true,
  skipped: false,
  doc: display(docAbs),
  docNewVersion: nextDisplay,
  snapshot: display(snapshotAbs),
  snapshotVersion: snapshotVersionRaw,
  snapshotSha256,
  snapshotBytes,
  manifest: { file: display(manifestAbs), entry: { [snapshotName]: manifestEntry } },
  historyIndex: display(readmeAbs),
  historyIndexMode: readmeMode,
  revisionMode: revisionResult.mode,
  root: root ? display(root) : null,
  indexSync,
  warnings,
  nextSteps: [nextCheckCommand],
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('[doc-snapshot] 快照完成');
  console.log(`  快照：${result.snapshot}（${snapshotBytes} bytes，sha256 ${snapshotSha256}）`);
  console.log(`  现版：${result.doc} → ${nextDisplay}`);
  console.log(`  manifest：${result.manifest.file} → ${snapshotName}`);
  console.log(`  历史索引：${result.historyIndex}（${readmeMode}）`);
  console.log(`  索引同步：${indexSync.message}`);
  for (const warning of warnings) console.log(`  ⚠ ${warning}`);
  console.log(`  下一步：${nextCheckCommand}`);
}
process.exit(0);

// ---------------------------------------------------------------- 幂等检测

/**
 * 二次执行（现版 version 已 == --next）时定位并校验既有快照。
 * @returns {{ok:boolean, snapshotAbs?:string, via?:string, sha256?:string, checked:number, problems:string[]}}
 */
function detectAlreadyApplied({ lines: docLines, docAbs: docPath, docBase: base, historyDir: hDir, currentBare: curBare, nextDisplay: nextVer }) {
  const candidates = [];
  const seen = new Set();
  const addCandidate = (abs) => {
    const key = toSlash(abs).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(abs);
  };

  // 优先：现版修订表里「版本」列 == --next 那一行的「快照」链接（首次执行时写入的精确线索）
  const linked = findRevisionSnapshotLink(docPath, docLines, hDir, nextVer);
  if (linked) addCandidate(linked);

  // 退化：history/ 下 <base>-<version>.md（排除与现版同版本）
  let names = [];
  if (existsSync(hDir)) {
    try {
      names = readdirSync(hDir);
    } catch {
      names = [];
    }
  }
  const scanned = [];
  for (const name of names) {
    if (!name.endsWith('.md') || !name.startsWith(`${base}-`)) continue;
    const version = name.slice(base.length + 1, -3);
    if (!VERSION_RE.test(version)) continue;
    if (bareVersion(version) === curBare) continue;
    const abs = join(hDir, name);
    if (!existsSync(abs) || !safeIsFile(abs)) continue;
    scanned.push({ abs, version });
  }
  scanned.sort((a, b) => compareVersion(b.version, a.version));
  for (const item of scanned) addCandidate(item.abs);

  if (candidates.length === 0) return { ok: false, checked: 0, problems: [] };

  const manifest = loadManifest(hDir);
  if (manifest.exists && manifest.error) {
    return { ok: false, checked: candidates.length, problems: [`history/manifest.json 解析失败（${manifest.error}）`] };
  }

  const problems = [];
  for (const abs of candidates) {
    const verdict = verifySnapshotCandidate(abs, manifest.value);
    if (verdict.ok) {
      return { ok: true, snapshotAbs: abs, via: verdict.via, sha256: verdict.sha256, checked: candidates.length, problems };
    }
    problems.push(...verdict.problems);
  }
  return { ok: false, checked: candidates.length, problems };
}

/** 在现版正文里找修订表中版本列 == --next 的最新一行，解析其「快照」列链接。 */
function findRevisionSnapshotLink(docPath, docLines, hDir, nextVer) {
  let headingIdx = -1;
  for (let i = 0; i < docLines.length; i++) {
    if (REVISION_HEADING_RE.test(docLines[i].trim())) {
      headingIdx = i;
      break;
    }
  }
  if (headingIdx < 0) return null;

  const rows = [];
  for (let i = headingIdx + 1; i < docLines.length; i++) {
    const line = docLines[i];
    if (ANY_HEADING_RE.test(line)) break;
    if (TABLE_LINE_RE.test(line)) rows.push(line);
    else if (rows.length > 0) break;
  }

  for (let i = rows.length - 1; i >= 0; i--) {
    const cells = splitTableRow(rows[i]);
    if (!cells || cells.length < 2) continue;
    const versionCell = bareVersion(cells[0].replace(/[`*_\s]/g, ''));
    if (versionCell !== bareVersion(nextVer)) continue;
    const lastCell = cells[cells.length - 1];
    const link = lastCell.match(/\[[^\]]*\]\(([^)]+)\)/);
    if (!link) continue;
    let target = link[1].trim();
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
    const abs = resolve(dirname(docPath), target);
    if (!existsSync(abs) || !safeIsFile(abs)) continue;
    if (toSlash(dirname(abs)) !== toSlash(hDir)) continue;
    return abs;
  }
  return null;
}

/** 校验候选快照：manifest 哈希优先；manifest 缺条目时退化为 frontmatter 自洽判断。 */
function verifySnapshotCandidate(abs, manifestValue) {
  let text;
  try {
    text = readText(abs);
  } catch (err) {
    return { ok: false, problems: [`无法读取 ${display(abs)}（${err.message}）`] };
  }
  const name = basename(abs);
  const { lines: snapLines } = splitText(text);
  const snapFm = parseFrontmatter(snapLines);
  const diskHash = sha256(text);

  const snapshotMap = manifestValue && isPlainObject(manifestValue.snapshots) ? manifestValue.snapshots : null;
  const entry = snapshotMap ? snapshotMap[name] : null;
  if (entry && entry.sha256) {
    if (String(entry.sha256).toLowerCase() === diskHash) {
      return { ok: true, via: 'manifest', sha256: diskHash };
    }
    return { ok: false, problems: [`${name} 的 manifest sha256 与磁盘实际内容不一致（快照可能被手改）`] };
  }

  const problems = [];
  const status = snapFm.closed ? String(fmValue(snapFm, 'status') ?? '').toLowerCase() : '';
  const supersededBy = snapFm.closed ? fmValue(snapFm, 'superseded-by') : null;
  if (status !== 'archived') problems.push(`${name} 缺 status: archived`);
  if (!supersededBy) {
    problems.push(`${name} 缺 superseded-by`);
  } else if (!existsSync(resolve(dirname(abs), supersededBy))) {
    problems.push(`${name} 的 superseded-by 指向不存在的文件：${supersededBy}`);
  }
  return { ok: problems.length === 0, via: 'frontmatter', sha256: diskHash, problems };
}

// ---------------------------------------------------------------- 文档结构处理

/** 在「## 修订记录」后第一张表末尾追加一行；缺节则整节补到文末，缺表头则补表头。 */
function addRevisionRow(lines, rowLine, headerLine, sepLine) {
  let headingIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (REVISION_HEADING_RE.test(lines[i].trim())) {
      headingIdx = i;
      break;
    }
  }

  if (headingIdx < 0) {
    const trimmed = trimTrailingBlank(lines);
    return {
      lines: [...trimmed, '', '## 修订记录', headerLine, sepLine, rowLine],
      mode: 'append-section',
    };
  }

  // 标题后的第一张表（遇到下一个标题即视为「没有表」）
  let tableStart = -1;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (ANY_HEADING_RE.test(lines[i])) break;
    if (TABLE_LINE_RE.test(lines[i])) {
      tableStart = i;
      break;
    }
  }

  if (tableStart < 0) {
    let nextLines = insertAfter(lines, headingIdx, [headerLine, sepLine, rowLine]);
    const afterIdx = headingIdx + 1 + 3;
    if (afterIdx < nextLines.length && nextLines[afterIdx].trim() !== '') {
      nextLines = insertAfter(nextLines, afterIdx - 1, ['']);
    }
    return { lines: nextLines, mode: 'insert-table' };
  }

  let tableEnd = tableStart;
  while (tableEnd + 1 < lines.length && TABLE_LINE_RE.test(lines[tableEnd + 1])) tableEnd++;
  return { lines: insertAfter(lines, tableEnd, [rowLine]), mode: 'append-row' };
}

/** 在 history/README.md 的第一张表末尾追加索引行；无表则补表头。 */
function appendIndexRow(lines, rowLine, headerLine, sepLine) {
  let tableStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (TABLE_LINE_RE.test(lines[i])) {
      tableStart = i;
      break;
    }
  }
  if (tableStart >= 0) {
    let tableEnd = tableStart;
    while (tableEnd + 1 < lines.length && TABLE_LINE_RE.test(lines[tableEnd + 1])) tableEnd++;
    return { lines: insertAfter(lines, tableEnd, [rowLine]), mode: 'append-row' };
  }
  const trimmed = trimTrailingBlank(lines);
  const prefix = trimmed.length === 0 ? [] : [''];
  return { lines: [...trimmed, ...prefix, headerLine, sepLine, rowLine], mode: 'new-table' };
}

/** 头部「> 版本：」行定位（正文区第一处）。 */
function findHeaderVersionLine(lines, fromIdx) {
  for (let i = fromIdx; i < lines.length; i++) {
    const match = lines[i].match(HEADER_VERSION_RE);
    if (match) return { idx: i, prefix: match[1], rest: match[2] };
  }
  return null;
}

/** 解析首个 --- frontmatter；entries[k] 对应 lines[k+1]。 */
function parseFrontmatter(lines) {
  if (lines.length === 0 || lines[0].trim() !== '---') {
    return { has: false, closed: false, closeIdx: -1, entries: [] };
  }
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx < 0) return { has: true, closed: false, closeIdx: -1, entries: [] };

  const entries = [];
  for (let i = 1; i < closeIdx; i++) {
    const raw = lines[i];
    if (raw.trim() === '' || /^\s/.test(raw) || raw.trim().startsWith('#')) {
      entries.push({ key: null, raw });
      continue;
    }
    const match = raw.match(/^([A-Za-z0-9_][A-Za-z0-9_.-]*)\s*:\s*(.*)$/);
    if (!match) {
      entries.push({ key: null, raw });
      continue;
    }
    entries.push({ key: match[1], raw, value: unquote(match[2]) });
  }
  return { has: true, closed: true, closeIdx, entries };
}

function fmValue(fm, key) {
  const entry = fm.entries.find((item) => item.key === key);
  if (!entry || entry.value === '') return null;
  return entry.value;
}

function unquote(raw) {
  let value = String(raw ?? '').trim();
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function splitTableRow(line) {
  const text = line.trim();
  if (!text.startsWith('|')) return null;
  const body = text.slice(1, text.endsWith('|') ? -1 : undefined);
  const cells = [];
  let current = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\' && body[i + 1] === '|') {
      current += '|';
      i++;
      continue;
    }
    if (ch === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

// ---------------------------------------------------------------- manifest / 索引同步

function loadManifest(hDir) {
  const manifestPath = join(hDir, 'manifest.json');
  if (!existsSync(manifestPath)) return { exists: false, path: manifestPath, value: null, error: null };
  let raw;
  try {
    raw = readText(manifestPath);
  } catch (err) {
    return { exists: true, path: manifestPath, value: null, error: `读取失败：${err.message}` };
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    return { exists: true, path: manifestPath, value: null, error: `不是合法 JSON（${err.message}）` };
  }
  if (!isPlainObject(value)) return { exists: true, path: manifestPath, value: null, error: '顶层不是 JSON 对象' };
  if (value.snapshots !== undefined && !isPlainObject(value.snapshots)) {
    return { exists: true, path: manifestPath, value: null, error: 'snapshots 字段不是 JSON 对象' };
  }
  return { exists: true, path: manifestPath, value, error: null };
}

/** root = 从现版路径向上找到的第一个「现版位于其 docs/ 下」的祖先；退化到最近含 docs/ 的祖先。 */
function findDocsRoot(docPath) {
  const docNorm = toSlash(docPath);
  let pending = null;
  let dir = dirname(docPath);
  while (true) {
    const docsDir = join(dir, 'docs');
    if (existsSync(docsDir) && safeIsDirectory(docsDir)) {
      const docsNorm = toSlash(docsDir);
      if (docNorm.startsWith(`${docsNorm}/`)) return dir;
      if (pending === null) pending = dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return pending;
}

/** 写完调用同目录 docs-gate.mjs <root> fix；脚本缺失/失败只提示，不伪造成功、不抛崩。 */
function syncIndexBlock(docsRoot) {
  const manual = docsRoot
    ? `node ${display(GATE_SCRIPT)} ${display(docsRoot)} fix`
    : 'node <插件>/scripts/docs-gate.mjs <root> fix';
  if (!docsRoot) {
    return { status: 'skipped-no-root', message: `未找到含 docs/ 的项目根，跳过索引区块同步；请手动跑 ${manual}` };
  }
  const gatePresent = existsSync(GATE_SCRIPT) && safeIsFile(GATE_SCRIPT);
  if (!gatePresent) {
    return { status: 'skipped-no-gate', message: `同目录 docs-gate.mjs 尚不存在，跳过索引区块同步；随后跑 ${manual} 同步索引` };
  }
  let run;
  try {
    run = spawnSync(process.execPath, [GATE_SCRIPT, docsRoot, 'fix'], { stdio: 'pipe', encoding: 'utf8', timeout: 120000 });
  } catch (err) {
    return { status: 'failed', exitCode: null, message: `docs-gate fix 调用失败（${err.message}）；请手动跑 ${manual}` };
  }
  if (run.error) {
    return { status: 'failed', exitCode: null, message: `docs-gate fix 调用失败（${run.error.message}）；请手动跑 ${manual}` };
  }
  if (run.status !== 0) {
    const tail = `${run.stderr ?? ''}\n${run.stdout ?? ''}`.trim().split('\n').filter(Boolean).slice(-3).join(' | ');
    return {
      status: 'failed',
      exitCode: run.status,
      message: `docs-gate fix 退出码 ${run.status}${tail ? `：${tail}` : ''}；请手动跑 ${manual}`,
    };
  }
  return { status: 'ok', exitCode: 0, message: 'docs-gate fix 已执行，docs/README.md 自动索引区块已同步' };
}

// ---------------------------------------------------------------- 通用工具

function readText(abs) {
  let text = readFileSync(abs, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text.replace(/\r\n/g, '\n');
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function splitText(text) {
  const hasTrailingNL = text.endsWith('\n');
  const splitLines = text.split('\n');
  if (hasTrailingNL) splitLines.pop();
  return { lines: splitLines, trailingNL: hasTrailingNL };
}

function joinText(splitLines, hasTrailingNL) {
  return splitLines.join('\n') + (hasTrailingNL ? '\n' : '');
}

function insertAfter(lines, idx, newLines) {
  return [...lines.slice(0, idx + 1), ...newLines, ...lines.slice(idx + 1)];
}

function trimTrailingBlank(lines) {
  const out = [...lines];
  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
  return out;
}

function bareVersion(version) {
  return String(version ?? '').trim().replace(/^[vV]/, '');
}

function compareVersion(a, b) {
  const pa = bareVersion(a).split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = bareVersion(b).split('.').map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function cellValue(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return text === '' ? '-' : text.replace(/\|/g, '\\|');
}

function todayLocal() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeIsFile(abs) {
  try {
    return statSync(abs).isFile();
  } catch {
    return false;
  }
}

function safeIsDirectory(abs) {
  try {
    return statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

function toSlash(p) {
  return String(p).split(sep).join('/').replace(/\\/g, '/');
}

function display(abs) {
  const absolute = resolve(abs);
  const rel = relative(process.cwd(), absolute);
  const usableRel = rel !== '' && !rel.startsWith('..') && !/^[A-Za-z]:/.test(rel);
  return toSlash(usableRel ? rel : absolute);
}

function printUsage() {
  console.log('用法：');
  console.log('  node scripts/doc-snapshot.mjs <docPath> --next <vX.Z> [--note <摘要>] [--ref <依据>] [--by <拍板人>] [--json]');
  console.log('');
  console.log('说明：把 <docPath> 现版内容快照进同域 history/<basename>-<快照版本>.md（注入 status: archived / version /');
  console.log('      superseded-by 与取代提示行），现版 bump 到 --next 并追加修订行，history/README.md 追加索引行，');
  console.log('      history/manifest.json 记录快照 sha256；最后调同目录 docs-gate.mjs <root> fix 同步自动索引区块。');
  console.log('幂等：现版已是 --next 且快照哈希自洽时输出 skip 并退出 0，不改任何文件。');
  console.log('退出码：0 = 完成或幂等 skip；1 = 校验失败/文件冲突；2 = 用法错误。');
}

function fail(code, message) {
  if (asJson) console.log(JSON.stringify({ ok: false, exitCode: code, error: message }, null, 2));
  else console.error(`[doc-snapshot] ${message}`);
  process.exit(code);
}
