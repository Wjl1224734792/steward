# Steward 仓库开发约定：宿主侧隔离

本仓库同时产出三个宿主包：`zcode/`（ZCode）、`minimax/`（MiniMax）与 `dsh/`（DeepSeek Harness）。**宿主侧改动必须隔离**：ZCode 侧任务只改 ZCode 侧，MiniMax 侧任务只改 MiniMax 侧，DSH 侧任务只改 DSH 侧；各自开发、各自测试、各自安装/更新，不互相代劳。

## 目录归属

| 范围 | 归属 | 规则 |
|---|---|---|
| `zcode/`、`host/zcode/`、`zcode/commands/` | ZCode 侧 | ZCode 任务只动这里 |
| `minimax/`、`host/minimax/`、`minimax/scripts/` | MiniMax 侧 | MiniMax 任务只动这里；`minimax/` 是生成物，不手改 |
| `dsh/`、`host/dsh/` | DSH 侧 | DSH 任务只动这里；`dsh/` 是 `host/dsh/build.mjs` 的生成物，不手改 |
| `shared/` | 三宿主共享源 | 技能 / agent 共享正文（含 `@@SLOT@@` 宿主槽位）的单一来源，DSH 同样只读消费；只有明确要同时影响共享宿主时才改，改完必须验证 ZCode/MiniMax（构建 + 测试）并重跑 `node host/dsh/build.mjs` 刷新 DSH 生成物，提交信息写明「跨宿主」 |
| `shared/scripts/` | 三宿主共享（门禁脚本单一源，v1.1.0 起） | 6 个门禁脚本（`maintain` / `run-state` / `take-over` / `validate-config` / `validate-plan` / `verify`）+ `templates/` + `doc/` 的**唯一正文源**；由构建器回写/同步进 `zcode/scripts/`、`minimax/scripts/`、`dsh/scripts/`——三处同名文件都是生成物，不手改。改动按跨宿主处理：构建 + 测试三宿主都要跑 |
| `zcode/scripts/` | ZCode / MiniMax 专有工具 + 生成物 | 仅剩 4 个专有脚本（`build.mjs`、`agent-config.mjs`、`agent-config-core.mjs`、`trigger.mjs`，正文源，同步到 `minimax/scripts/`）与 `hooks/`、`docs-gov/`、`tests/`；六个门禁脚本与 `templates/`、`doc/` 已迁 `shared/scripts/`，此处同名文件是回写生成物，不手改。**DSH 自 v1.1.0 起不再读取本目录** |
| `host/<宿主>/scripts/` | 宿主侧 | 宿主自有门禁脚本的正文源（如 `host/dsh/scripts/`、`host/minimax/scripts/`）；**不进** `shared/scripts/` 共享源，由各宿主构建器同步进自己的包（`minimax/scripts/` 等）。与 `shared/scripts/` 同名冲突会让构建器判失败 |

## 开发与测试

- **ZCode 侧**：`node zcode/scripts/build.mjs --check` → `node --test zcode/scripts/tests/` → `zcode commands list` 确认命令注册。只更新 ZCode：`zcode plugins update steward@<marketplace>`。
- **MiniMax 侧**：`node zcode/scripts/build.mjs` → `node --test zcode/scripts/tests/` → `node --test host/minimax/tests/` → `node zcode/scripts/agent-config.mjs install`（演练）或 `install --apply`（镜像）。只更新 MiniMax，不跑 ZCode 插件更新。
- **DSH 侧（独立构建，不写其他目录）**：`node host/dsh/build.mjs`（或 `--check`）→ `node --test host/dsh/tests/` → 用插件管理器 `install_bundle` 指向 `dsh/` 安装/更新；装完在 **Steward 团队面板**（侧栏「Steward 团队」或「设置 → Steward」分区）核对 7 个角色的模型/档位与 `steward_dispatch` / `steward_board` 工具。DSH 构建器只读 `shared/`（含 `shared/scripts/`）、`zcode/skills/steward/references/` 参考库、`host/dsh/`，只写 `dsh/`；自 v1.1.0 起不再读取 `zcode/scripts/`。
- **共享源改动**：`shared/`（含 `shared/scripts/`）变更要验证 ZCode/MiniMax（构建 + 测试），并重跑 `node host/dsh/build.mjs` 刷新 DSH 生成物；提交信息注明「跨宿主」。

## 禁止

- ZCode 侧任务修改 `host/minimax/`、`minimax/`、`host/dsh/`、`dsh/`，或执行 `agent-config.mjs install --apply` 去更新 MiniMax。
- MiniMax 侧任务修改 `host/zcode/`、`zcode/commands/`、`host/dsh/`、`dsh/`，或执行 `zcode plugins update` 去更新 ZCode。
- DSH 侧任务修改 `host/zcode/`、`zcode/`、`host/minimax/`、`minimax/`、`shared/`、`zcode/scripts/`；DSH 构建器只读引用其中 `shared/`（含 `shared/scripts/`）与 `zcode/skills/` 参考库，自 v1.1.0 起不再读取 `zcode/scripts/`。DSH 需要的宿主差异一律放 `host/dsh/`，在 `host/dsh/build.mjs` 里做渲染/行替换。
- 在单宿主任务里把另一侧当成「顺手同步」对象；确实需要同步时单独立项，按跨宿主改动处理。
- 手改 `zcode/`、`minimax/` 或 `dsh/` 下的生成物（含三侧包内 `scripts/` 下的门禁脚本与 `templates/`、`doc/`——单一正文源在 `shared/scripts/`）；正文只改 `shared/`（共享侧）或 `host/<宿主>/`，再跑对应构建器。
