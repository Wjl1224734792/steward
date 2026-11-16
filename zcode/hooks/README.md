# Steward 宿主守卫 hooks（可选）

四道 PreToolUse 守卫，`scripts/hooks/guard.mjs` 实现，fail-open（解析失败不阻塞），随插件分发：

| 守卫 | 触发工具 | 行为 |
|---|---|---|
| `secret` | Write / Edit | 内容疑似密钥（sk-、ghp_、AKIA、PEM 私钥、硬编码凭据）→ 阻断 |
| `ownership` | Write / Edit | 目标文件不在 `.steward/ownership.json` 白名单内 → 阻断（无该文件时不启用） |
| `dangerous` | Bash | `rm -rf`、`git push --force`、`git reset --hard`、`git clean -f`、破坏性 SQL、`mkfs`/`dd`、fork bomb → 阻断 |
| `docs` | Agent / Task | docTier=3 项目派 `backend-dev` / `frontend-dev` 时，校验 `.steward/docs-state.json` 收据与文档哈希——缺失、机检不过、评审未 approved、哈希过期 → 阻断（1.2.0 对齐 DSH 1.3.0 文档就绪硬门；判据与 `scripts/docs-gov/docs-ready.mjs` 同源） |

## 契约

- 输入：宿主把事件 JSON 写到 stdin（`tool_name` / `tool_input.file_path|command|content`；docs 模式另读 `tool_input.subagent_type` 与 `cwd`）。
- 输出：**stdout 保持空**（宿主按严格 JSON 校验 stdout，未知键会判失败）；阻断原因写 stderr。
- 退出码：`0` 放行；`2` 阻断（PreToolUse deny）；其他非 0 视为 hook 失败。
- 自检：`node scripts/hooks/selftest.mjs`（阻断/放行/fail-open/stdout 为空）。

## docs 模式（文档就绪硬门）

- 只拦 `Agent` / `Task` 派发里 `subagent_type` 为 `backend-dev` / `frontend-dev`（含 `steward:` 前缀）的调用；其他角色与普通 Agent 调用一律放行。
- 项目根从事件 `cwd` 向上找 `steward.config.json`（最多 6 层）；`docTier` 不是 3 → 直接放行。回滚 = 把 `docTier` 改回 1/2。
- 收据缺失 / `checkReadiness` 有 error / `ok !== true` / 评审未 `approved` → exit 2，stderr 给缺漏码与修复命令（与 `scripts/docs-gov/docs-ready.mjs` 同一判据）。
- 判据库 `scripts/docs-gov/lib/docs-state.mjs` 动态加载：缺失或异常 fail-open 放行，不影响其余守卫。

## 激活方式

**A. 插件级（推荐，随插件生效）**：本目录 `hooks.json` 已按宿主格式声明三道守卫（`${CLAUDE_PLUGIN_ROOT}` 由宿主展开）。宿主发现插件 hooks 后会自动启用 hook runner；本文件不依赖用户额外配置。

**B. 工作区 / 用户配置（插件级未被发现时）**：把下面片段并入 `~/.zcode/cli/config.json` 或工作区 `<repo>/.zcode/config.json`（配置文件 hooks 默认关闭，必须 `enabled: true`；命令用插件绝对路径）：

```json
{
  "hooks": {
    "enabled": true,
    "events": {
      "PreToolUse": [
        { "matcher": "Write|Edit", "hooks": [
          { "type": "command", "command": "node \"<插件绝对路径>/scripts/hooks/guard.mjs\" secret" },
          { "type": "command", "command": "node \"<插件绝对路径>/scripts/hooks/guard.mjs\" ownership" }
        ]},
        { "matcher": "Bash", "hooks": [
          { "type": "command", "command": "node \"<插件绝对路径>/scripts/hooks/guard.mjs\" dangerous" }
        ]}
      ]
    }
  }
}
```

> 注意：hook 配置在会话启动时加载，修改后需新开会话生效；可在 ZCode 日志中查看 hook 执行记录（来源/匹配/结果/耗时）。

## 关闭 / 调整

- 删除或重命名 `zcode/hooks/hooks.json`（或配置中的对应事件）即可关闭。
- 所有权守卫必须由 Tech Lead 在派发时生成 `.steward/ownership.json`（`{ "root": "<仓库根>", "tasks": { "T1": ["src/a.mjs"] } }`），否则不生效——这是有意设计，避免全局误拦。
