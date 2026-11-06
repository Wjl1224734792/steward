# 文档流水线本地脚本（双宿主）

> **双宿主都提供**：本目录由 `build.mjs` 从 `zcode/scripts/doc/` 单向同步到 `minimax/scripts/doc/`，以 `zcode/` 侧为准，勿手工改副本。三个脚本纯 Node 无依赖，本地运行，不做 CI。

## 脚本

| 脚本 | 作用 | 何时跑 |
|---|---|---|
| `doc-init.mjs <root> [--write] [--tier 3]` | 建 `docs/01..07` 七阶段树 + `docs/README.md` 骨架 + `.agents/{rules,designs}`；幂等、不覆盖 | 项目首次提升 docTier=3 |
| `doc-check.mjs <root> [--tier n] [--json]` | T1 存在性、`docs/README.md`、AGENTS/docs 死链、`docs/01..07` 文件是否全部进索引 | 每次改文档后 / 交付前 |
| `guard-naming.mjs <root> [--baseline <file>] [--init] [--force] [--json]` | 代码产物命名守卫：禁波次/工单/优先级/批次编号；存量基线只减不增 | 每次改代码后 / 交付前 |

路径一律用绝对路径或从仓库根起的相对路径；脚本从 `<root>` 解析，不依赖当前工作目录。

## docTier

- `0/1/2`：只维护 T0 `AGENTS.md` + T1 `docs/project/`，**不建**深文档树。
- `3`：L 级 / 合规 / 新项目；建 `docs/01..07`，PRD/FRD/契约/页面/测试/部署/治理全套按需使用。
- 配置在目标仓库根的 `steward.config.json`：`{ "docTier": 3 }`（`validate-config.mjs` 会校验 0~3）。

## 命名守卫基线

默认 `<root>/scripts/file-naming-baseline.txt`，两段：

```text
[FROZEN]
# 已应用迁移目录等不可改名项，永久登记

[BURN-DOWN]
# 待清理存量；只减不增，清理后删行
src/legacy/order-w8s4.test.ts
```

- `--init`：把当前全部违规写成 `[BURN-DOWN]` 基线；基线已存在时拒绝覆盖，需 `--force`。
- 新违规（不在基线）→ exit 1；基线条目已失效（文件改名/删除但没删行）→ exit 1。
- 误伤保护：`web3-client.ts`、`test-s3.ts`、`approval-batch.ts` 不应命中。

## 退出码

| 码 | 含义 |
|---|---|
| 0 | 通过（可有 warning） |
| 1 | 有 error（死链 / 未索引 / 新违规 / 基线失效） |
| 2 | 用法错误（根目录不存在、`--tier` 非法、基线已存在等） |

**exit code 非 0 就是失败，如实上报，不许解释掉。**

## 可选 git hook

不做 CI。需要提交前拦截时，在目标仓库 `.git/hooks/pre-commit` 里跑同一组命令：

```bash
node <插件>/scripts/doc/doc-check.mjs "$(git rev-parse --show-toplevel)"
node <插件>/scripts/doc/guard-naming.mjs "$(git rev-parse --show-toplevel)"
```

hook 是可选的；核心门禁始终是本地脚本本身。

## 示例

```bash
# 首次建树（先 dry-run 看要建什么）
node <插件>/scripts/doc/doc-init.mjs . --tier 3
node <插件>/scripts/doc/doc-init.mjs . --tier 3 --write

# 日常检查
node <插件>/scripts/doc/doc-check.mjs .
node <插件>/scripts/doc/guard-naming.mjs .

# 存量项目接入命名守卫
node <插件>/scripts/doc/guard-naming.mjs . --init
node <插件>/scripts/doc/guard-naming.mjs .
```
