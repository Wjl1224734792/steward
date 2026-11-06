<!-- T2 变更包模板：证据索引（Steward 双宿主） -->

# 04 · 证据索引

> 目的：让「已完成」有可复核的出口。每条证据写清命令、exit code、输出路径；没有真实输出的结论不写。

## 1. 门禁复跑

| # | 命令 | exit code | 耗时 | 输出文件 / 摘要 |
|---|---|---|---|---|
| 1 | `node <plugin>/scripts/verify.mjs run --out <run>/verify-result.json` |  |  |  |

- `--repeat`（如用）：`N` 次，是否 flaky：
- 失败即失败，原样贴输出；不许用「应该过了」代替。

## 2. 基线与越界

| 项 | 结果 |
|---|---|
| `verify.mjs baseline record --out <run>/baseline.json` | HEAD / 脏文件 hash： |
| `verify.mjs baseline check --root <repo> --baseline <run>/baseline.json` | exit code： |
| 所有权外 diff | 无 / 清单： |
| 测试文件 diff 未声明理由 | 无 / 清单： |

## 3. 浏览器证据（有 UI 时）

- `browser-evidence.json` 路径：
- 驱动方式（Playwright MCP / Chrome DevTools MCP / 内置浏览器兜底）：
- `fallbackUsed`：
- `visual`：`unverified` / 已人工确认（说明依据）
- 未验证项（布局/颜色/溢出/动效）：

## 4. 其他人工核对

| 项 | 证据 |
|---|---|
| 文档死链 / 索引 | `doc-check.mjs` 输出： |
| 命名守卫 | `guard-naming.mjs` 输出： |
| 迁移/回滚演练 |  |
| 用户拍板记录 |  |
