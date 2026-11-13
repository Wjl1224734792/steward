# AGENTS.md — {{PROJECT_NAME}}

> 面向 AI 代理的项目速查（T0，目标 ≤100 行）。由 `take-over` 扫描生成初稿，**占位符 `{{...}}` 表示脚本未能探测到，需要人工确认后替换**；删除已确认的占位符行。

## 定位

<!-- 2~3 句：这是什么项目、给谁用、核心价值。禁止编造，写不出就留 TODO。 -->
{{PROJECT_PURPOSE}}

## 命令速查

| 用途 | 命令 |
|---|---|
| 安装 | {{INSTALL_CMD}} |
| 本地运行 | {{DEV_CMD}} |
| 测试 | {{TEST_CMD}} |
| Lint | {{LINT_CMD}} |
| 类型检查 | {{TYPECHECK_CMD}} |
| 构建 | {{BUILD_CMD}} |

## 红线（每条一行，违反即 blocking）

- 不关闭、不弱化已有测试来让门禁变绿。
- 不提交密钥/凭据；发现密钥立即报告。
- 只改任务单授权的文件；越界先报告。
- {{PROJECT_RED_LINES}}

## 文档索引（T1）

| 文档 | 内容 |
|---|---|
| [docs/project/CONSTITUTION.md](docs/project/CONSTITUTION.md) | 质量/安全/架构红线，不可协商项 |
| [docs/project/ARCHITECTURE.md](docs/project/ARCHITECTURE.md) | 模块地图、依赖方向、不变量 |
| [docs/project/DECISIONS.md](docs/project/DECISIONS.md) | ADR 决策日志（追加式） |
| [docs/project/RUNBOOK.md](docs/project/RUNBOOK.md) | 安装/启动/测试/排障 |
| [docs/project/CHANGELOG.md](docs/project/CHANGELOG.md) | 用户可见变更 |
| [docs/project/HEALTH.md](docs/project/HEALTH.md) | 债务、风险、维护 backlog |

## 完成定义（DoD）

- 测试 / lint / typecheck 门禁全绿（真实输出，不接受「应该通过」）。
- 行为/契约变化已同步对应文档与 ADR。
- UI 改动附浏览器证据；Bug 修复附回归测试。
