#!/usr/bin/env node
/**
 * doc-init.mjs — 为 docTier=3 项目建七阶段文档树骨架（Steward ZCode 侧）。
 *
 * 用法：
 *   node doc-init.mjs <root> [--write] [--tier 3] [--json]
 *
 * 默认 dry-run；--write 才落盘。幂等：已存在的目录/文件一律跳过，绝不覆盖。
 * 退出码：0 = 成功（含跳过）；2 = 用法/根目录错误。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));
const asJson = flags.has('--json');
const write = flags.has('--write');
const tierIdx = args.indexOf('--tier');
const tier = tierIdx >= 0 ? Number(args[tierIdx + 1]) : 3;
const root = resolve(positional[0] ?? process.cwd());

if (!Number.isInteger(tier) || tier < 0 || tier > 3) {
  fail(2, `--tier 必须是 0~3 的整数（收到 ${args[tierIdx + 1] ?? '空'}）`);
}
if (!existsSync(root)) {
  fail(2, `根目录不存在：${root}`);
}

if (tier < 3) {
  const result = { ok: true, skipped: true, reason: `docTier=${tier}<3，不需要深文档树`, root, tier };
  if (asJson) console.log(JSON.stringify(result, null, 2));
  else console.log(`[doc-init] docTier=${tier}<3：不建深文档树。T0/T1 足够，等 L 级/合规/新项目再提升到 3。`);
  process.exit(0);
}

const DIRS = [
  'docs/01-需求',
  'docs/02-架构',
  'docs/03-契约',
  'docs/04-专项',
  'docs/05-页面',
  'docs/06-测试',
  'docs/07-治理',
  '.agents/rules',
  '.agents/designs',
];

const hasProject = existsSync(join(root, 'docs/project'));
const index = `# 文档地图（docTier=3）

> 本文件是 \`docs/01..07\` 的唯一索引；新增/删除/重命名文档必须同步本表 + 根 \`AGENTS.md\` 文档索引。
> 规则：同一主题只一份；T1 \`docs/project/\` 只放摘要与链接，正文进本树，不复制。

| 目录 | 放什么 | 状态 |
|---|---|---|
| [01-需求](01-需求/) | PRD、FRD、业务流程、领域参数 SSOT | 待补 |
| [02-架构](02-架构/) | 架构总纲、{X}工程化、可观测性、部署工程化 | 待补 |
| [03-契约](03-契约/) | 数据模型、API/错误码、外部集成 | 待补 |
| [04-专项](04-专项/) | 算法、AI/Agent、规则引擎等专项 | 待补 |
| [05-页面](05-页面/) | 页面设计、布局稿、页面详设、组件清单 | 待补 |
| [06-测试](06-测试/) | 测试方案、黄金集、NFR 验证映射 | 待补 |
| [07-治理](07-治理/) | ADR、执行步骤、开发顺序、评审记录 | 待补 |

## T1 项目记忆

${hasProject
  ? [
      '- [AGENTS.md](../AGENTS.md)',
      '- [CONSTITUTION](project/CONSTITUTION.md)',
      '- [ARCHITECTURE](project/ARCHITECTURE.md)',
      '- [DECISIONS](project/DECISIONS.md)',
      '- [RUNBOOK](project/RUNBOOK.md)',
      '- [CHANGELOG](project/CHANGELOG.md)',
      '- [HEALTH](project/HEALTH.md)',
    ].join('\n')
  : '尚未生成 T1。先运行插件 `scripts/take-over.mjs <root> --write`（或 `/steward take-over`）生成 `AGENTS.md` + `docs/project/` 六件，再写 T3 文档。'}
`;

const actions = [];
for (const d of DIRS) {
  const full = join(root, d);
  if (existsSync(full)) actions.push({ path: d, action: 'skip', reason: '目录已存在' });
  else actions.push({ path: d, action: write ? 'create-dir' : 'would-create-dir' });
  const keep = join(full, '.gitkeep');
  if (!existsSync(keep)) actions.push({ path: `${d}/.gitkeep`, action: write ? 'create-file' : 'would-create-file' });
}

const indexFile = 'docs/README.md';
const indexFull = join(root, indexFile);
if (existsSync(indexFull)) actions.push({ path: indexFile, action: 'skip', reason: '文件已存在（不覆盖）' });
else actions.push({ path: indexFile, action: write ? 'create-file' : 'would-create-file' });

if (write) {
  for (const d of DIRS) {
    mkdirSync(join(root, d), { recursive: true });
    const keep = join(root, d, '.gitkeep');
    if (!existsSync(keep)) writeFileSync(keep, '', 'utf8');
  }
  if (!existsSync(indexFull)) writeFileSync(indexFull, index, 'utf8');
}

const created = actions.filter((a) => a.action.includes('create')).length;
const skipped = actions.filter((a) => a.action === 'skip').length;
const result = { ok: true, root, tier, write, created, skipped, hasT1: hasProject, actions };
if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[doc-init] ${write ? '已执行' : 'dry-run（加 --write 落盘）'}：${root}`);
  for (const a of actions) {
    const label = a.reason ? `${a.action}（${a.reason}）` : a.action;
    console.log(`  ${label}: ${a.path}`);
  }
  console.log(`[doc-init] ${write ? '新建' : '计划新建'} ${created} 项 / 跳过 ${skipped} 项${hasProject ? '' : '；缺 T1，先跑 take-over.mjs'}`);
  if (!write) console.log('[doc-init] 未写入任何文件。');
}
process.exit(0);

function fail(code, message) {
  if (asJson) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  else console.error(`[doc-init] ${message}`);
  process.exit(code);
}
