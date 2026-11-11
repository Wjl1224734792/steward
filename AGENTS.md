# Steward 仓库开发约定：宿主侧隔离

本仓库同时产出两个宿主包：`zcode/`（ZCode）与 `minimax/`（MiniMax）。**宿主侧改动必须隔离**：ZCode 侧任务只改 ZCode 侧，MiniMax 侧任务只改 MiniMax 侧；各自开发、各自测试、各自安装/更新，不互相代劳。

## 目录归属

| 范围 | 归属 | 规则 |
|---|---|---|
| `zcode/`、`host/zcode/`、`zcode/commands/` | ZCode 侧 | ZCode 任务只动这里 |
| `minimax/`、`host/minimax/` | MiniMax 侧 | MiniMax 任务只动这里；`minimax/` 是生成物，不手改 |
| `shared/` | 双宿主共享源 | 只有明确要同时影响两宿主时才改；改完必须双侧验证，并在提交信息里写明「跨宿主」 |
| `zcode/scripts/` | 共享工具/构建器 | 会被 `build.mjs` 同步到 `minimax/scripts/`；改动按跨宿主改动处理 |

## 开发与测试

- **ZCode 侧**：`node zcode/scripts/build.mjs --check` → `node --test zcode/scripts/tests/` → `zcode commands list` 确认命令注册。只更新 ZCode：`zcode plugins update steward@<marketplace>`。
- **MiniMax 侧**：`node zcode/scripts/build.mjs` → `node zcode/scripts/agent-config.mjs install`（演练）或 `install --apply`（镜像）。只更新 MiniMax，不跑 ZCode 插件更新。
- **共享源改动**：双侧都要验证（构建 + 测试 + 双侧安装资产核对），提交信息注明「跨宿主」。

## 禁止

- ZCode 侧任务修改 `host/minimax/`、`minimax/`，或执行 `agent-config.mjs install --apply` 去更新 MiniMax。
- MiniMax 侧任务修改 `host/zcode/`、`zcode/commands/`，或执行 `zcode plugins update` 去更新 ZCode。
- 在单宿主任务里把另一侧当成「顺手同步」对象；确实需要同步时单独立项，按跨宿主改动处理。
- 手改 `zcode/` 或 `minimax/` 下的生成物；正文只改 `shared/` 或 `host/<宿主>/`，再跑 `build.mjs`。
