# 代码产物命名守卫（禁阶段 / 工单编号 · 存量棘轮）

> 口径出处：README §0.3「代码产物禁阶段编号」。本文是可直接落地的一次性资产：规则判定 → 脚本模板 → 基线语义 → 接入门禁 → 存量 burn-down。
> 核心一句话：**文件名编码 What（做什么），不编码 When（第几批）**。波次、子批、工单、优先级是项目进度元数据，归属 `执行步骤.md` 与评审记录；写进文件名后，波次一关它就变成读者看不懂、下一批还要继续叠的噪声。

## 1. 管什么、不管什么

| 管（代码产物） | 不管（保持原约定） |
|---|---|
| 源码 / 测试 / 迁移目录 / 种子 / 脚本 / 夹具 / E2E / 性能脚本的**文件名与目录名** | 文档名：ADR 编号、`评审记录-YYYYMMDD.md`、`GT-xx` 覆盖对照等文档标识（它们本身就是跨文档引用的 ID） |
| 新建 / 改名的文件 | commit message（`fix(w8-s4-op142c): ...` 是历史坐标，合理） |
| — | 编号本身是**业务标识符**的：报表 `R1~R8`、状态机枚举、`S3` 对象存储、`k6` 压测、`h5` 端、`v1`——不得误伤 |

## 2. 判定标记

要求标识符前是行首或分隔符（`._-\s`），避免 `web3` / `row1` / `k6` 这类业务词误伤。

| ID | 正则（示意） | 命中示例 |
|---|---|---|
| WAVE | `(?:^\|[._\-\s])w\d{1,2}(?:[._\-]?\d{1,2})?(?:[._\-]?s\d{1,2})?(?:[._\-]\|$)` | `w7.2`、`w8s3`、`seed-w6.ts`、`permissions.w8.test.ts` |
| ISSUE | `(?:^\|[._\-\s])op[-_]?\d{2,}(?:[._\-]\|$)` | `op142`、`op-133` |
| PRIORITY | `(?:^\|[._\-\s])p\d{1,2}(?:[._\-]\|$)` | `p1`、`p2` |
| BATCH | `(?:^\|[._\-\s])(?:phase\|stage\|wave)[._\-]?\d{1,2}(?:[._\-]\|$)` | `phase2`、`stage3` |
| BATCH_ZH | `篇[一二三四五六七八九十百零\d]+` / `第[…]+批` | `篇二十七`、`第3批` |

**不要**单独用 `s\d`：会误伤对象存储 `test-s3.ts`；**不要**把 `batch` 当禁用词：`approval-batch` 是业务概念（批量审批）。子批编号只在紧跟波次时（`w8s4`）由 WAVE 一并命中。

## 3. 脚本模板（`scripts/guard-naming.mjs`）

> 实际脚本：插件 `scripts/doc/guard-naming.mjs`（CLI `<root>` + `--baseline` / `--init` / `--force` / `--json`）。下面保留项目内独立版参考实现；两者语义一致，改动以插件脚本为准。

```js
#!/usr/bin/env node
/**
 * guard-naming —— 代码产物命名守卫（本地门禁与手工运行同一脚本）
 * 规则：文件名编码「做什么」，不编码「第几批」（README §0.3）。
 * 存量登记 scripts/file-naming-baseline.txt，只减不增（棘轮）。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASELINE_FILE = join(ROOT, 'scripts/file-naming-baseline.txt');

const EXCLUDE_SEGMENTS = new Set([
  '.git', '.zcode', 'docs', 'tmp', 'node_modules', 'dist', 'coverage',
  'playwright-report', 'test-results', 'generated', '.umi', '.umi-production', '.umi-test',
]);
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|sql|prisma|css|scss|less|json)$/;

const MARKERS = [
  { id: 'WAVE', pattern: /(?:^|[._\-\s])w\d{1,2}(?:[._\-]?\d{1,2})?(?:[._\-]?s\d{1,2})?(?:[._\-]|$)/i, hint: '波次 / 子批编号（W1、W7.2、W8S3）' },
  { id: 'ISSUE', pattern: /(?:^|[._\-\s])op[-_]?\d{2,}(?:[._\-]|$)/i, hint: '开放项编号（OP-142）' },
  { id: 'PRIORITY', pattern: /(?:^|[._\-\s])p\d{1,2}(?:[._\-]|$)/i, hint: '优先级 / 子批编号（P1、P2）' },
  { id: 'BATCH', pattern: /(?:^|[._\-\s])(?:phase|stage|wave)[._\-]?\d{1,2}(?:[._\-]|$)/i, hint: '批量 / 阶段英文词（phase2、stage3）' },
  { id: 'BATCH_ZH', pattern: /(?:篇[一二三四五六七八九十百零\d]+|第[一二三四五六七八九十百零\d]+批)/, hint: '批次中文标记（篇二十七、第三批）' },
];

const loadBaseline = () => {
  const result = { frozen: new Set(), burnDown: new Set() };
  if (!existsSync(BASELINE_FILE)) return result;
  let section = 'burnDown';
  for (const raw of readFileSync(BASELINE_FILE, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) {
      if (line.includes('[FROZEN]')) section = 'frozen';
      else if (line.includes('[BURN-DOWN]')) section = 'burnDown';
      continue;
    }
    result[section].add(line);
  }
  return result;
};

const hitMarkers = (name) => MARKERS.filter((m) => m.pattern.test(name));

function walk(dir, violations) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_SEGMENTS.has(name)) continue;
    const full = join(dir, name);
    const rel = relative(ROOT, full).split(sep).join('/');
    if (statSync(full).isDirectory()) {
      const hits = hitMarkers(name); // 迁移目录名同样受约束
      if (hits.length > 0) violations.push({ path: `${rel}/`, hits });
      walk(full, violations);
    } else if (CODE_EXT.test(name)) {
      const stem = name.replace(CODE_EXT, '');
      const hits = hitMarkers(stem);
      if (hits.length > 0) violations.push({ path: rel, hits });
    }
  }
}

const violations = [];
walk(ROOT, violations);
const baseline = loadBaseline();
const known = new Set([...baseline.frozen, ...baseline.burnDown]);
const current = new Set(violations.map((v) => v.path));
const fresh = violations.filter((v) => !known.has(v.path));
const stale = [...known].filter((entry) => !current.has(entry));

if (fresh.length > 0) {
  console.error(`guard:naming 失败 —— ${fresh.length} 个新文件 / 目录带阶段编号命名\n`);
  for (const v of fresh) {
    console.error(`  ${v.path}`);
    console.error(`    命中：${v.hits.map((h) => h.hint).join(' / ')}`);
  }
  console.error('\n  文件名说「做什么」，不说「第几批」；阶段归属写执行步骤与评审记录。\n');
}
if (stale.length > 0) {
  console.error(`guard:naming 失败 —— 基线有 ${stale.length} 条已失效（已改名 / 删除）\n`);
  for (const entry of stale) console.error(`  ${entry}`);
  console.error('\n  基线只减不增：请从 scripts/file-naming-baseline.txt 删除对应行。\n');
}
if (fresh.length > 0 || stale.length > 0) process.exit(1);

console.log(
  `guard:naming 通过（待清理 ${baseline.burnDown.size} 条 / 历史冻结 ${baseline.frozen.size} 条 / 新违规 0）`,
);
```

## 4. 基线语义（棘轮，不是豁免）

`scripts/file-naming-baseline.txt`：一行一个仓库相对路径（目录带结尾 `/`），`#` 开头为注释；用段标题切两类。

| 段 | 含义 | 语义 |
|---|---|---|
| `[FROZEN]` | **历史不可变**：已应用的迁移目录名（ORM 在迁移表里记录目录名，改名会让已有库出现迁移漂移） | 永久登记，不改名；新迁移必须按规则命名 |
| `[BURN-DOWN]` | 待清理的存量文件 | **只减不增**：新文件必须直接合规，禁止追加；清理后删行；条目失效未删 → 守卫报「基线失效」 |

- 守卫输出两个计数（待清理 / 历史冻结），burn-down 进度一眼可见。
- `[BURN-DOWN]` 归零后删掉该段；基线只剩 `[FROZEN]` 时仍保留文件，守卫退化为「新文件零容忍」。
- 清理任务登记为开放项（`执行步骤.md` OP-xx），按目录 / 波次分批，每批一次变更（改名 + 删基线行 + 更新引用；用户要求提交时再 commit）。

## 5. 接入门禁

```jsonc
// package.json
"guard:naming": "node scripts/guard-naming.mjs"
```

门禁链：`lint → typecheck → guard:code → guard:naming → guard:hardcode → test → build`。
在根 `AGENTS.md` 命令速查与层级 `rules` 的「测试 / 文件命名」各留一行指针（条款只写一处，其余引用）。

## 6. 存量迁移 SOP

1. **先写规范条款**（全局 rules 命名节 + 根 AGENTS 一条），明确禁什么、允许什么、机检命令。
2. **上守卫**：跑一遍收集全部存量 → 写入基线（已应用迁移进 `[FROZEN]`，其余进 `[BURN-DOWN]`）→ 门禁立即绿（此时零改名，风险最低）。
3. **登记清理任务**：开放项写清「N 个待清理文件 / 分几批 / 完成标准 = `[BURN-DOWN]` 归零」。迁移类条目不算内。
4. **分批 burn-down**：按目录或业务域改名（`git mv` 保历史）→ 同步删基线行 → 更新引用（import / 门禁 glob / 文档列举）→ 跑门禁。
5. **收尾**：`[BURN-DOWN]` 归零后删该段（`[FROZEN]` 与迁移史共存）+ 守卫报告「待清理 0 条」+ 在执行步骤销项。

**改名注意**：测试文件名被 `vitest` / `playwright` glob 与文档「覆盖对照表」引用；迁移目录名被 Prisma 迁移表 `_prisma_migrations` 记录——**已应用的迁移目录不要改名**（会导致历史记录对不上），只对未应用的迁移或新迁移执行规范；已应用的历史迁移在基线中登记，随该表重建 / 归档时再处理。

## 7. 与其它守卫的边界

| 守卫 | 管什么 |
|---|---|
| `guard:code` | 代码内容红线（禁 raw SQL、禁 disable 注释、禁直引图表库） |
| `guard:naming` | 代码产物**名字**（本文件） |
| `guard:hardcode` | 领域层数字字面量 |
| `docs:guard` | 文档索引链接 / 路由表 ⊆ 页面设计 / 权限码注册表双向 |

同一份「必须遵守」约定只放进一个守卫；名字与内容不要混检。
