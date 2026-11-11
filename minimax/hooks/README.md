# Steward 宿主守卫 hooks（可选）

三道 PreToolUse 守卫，`scripts/hooks/guard.mjs` 实现，fail-open（解析失败不阻塞），随插件分发。

| 守卫 | 触发工具（MiniMax 原生名） | 行为 |
|---|---|---|
| `secret` | write / edit | 内容疑似密钥（sk-、ghp_、AKIA、PEM 私钥、硬编码凭据）→ 阻断 |
| `ownership` | write / edit | 目标文件不在 `.steward/ownership.json` 白名单内 → 阻断（无该文件时不启用） |
| `dangerous` | bash | `rm -rf`、`git push --force`、`git reset --hard`、`git clean -f`、破坏性 SQL、`mkfs`/`dd`、fork bomb → 阻断 |

## 契约

- 输入：宿主把事件 JSON 写到 stdin（MiniMax 字段 `tool_name` / `tool_input.path|file_path|command|content|new_string`）。
- 输出：**stdout 保持空**，阻断原因写 stderr。
- 退出码：`0` 放行；`2` 阻断（MiniMax `PreToolUse` 的 deny 信号，stderr 即给 Agent 看的理由）。
- 自检：`node scripts/hooks/selftest.mjs`（含 ZCode 与 MiniMax 两种原生事件载荷）。

## 激活方式

**A. 插件级（默认）**：本目录 `hooks.json` 已按宿主格式声明三道守卫（`${PLUGIN_ROOT}` 由宿主展开，Windows 走 `commandWindows`），并在 `.minimax-plugin/plugin.json` 的 `hooks` 数组中登记。宿主发现插件后自动启用 hook runner，**不需要用户额外配置**。

**B. 关闭 / 调整**：删除或重命名 `minimax/hooks/hooks.json`（或其中的 `PreToolUse` 段）即可关闭。

> 所有权守卫必须由 Tech Lead 在派发时生成 `.steward/ownership.json`（`{ "root": "<仓库根>", "tasks": { "T1": ["src/a.mjs"] } }`），否则不启用——这是有意设计，避免全局误拦。
