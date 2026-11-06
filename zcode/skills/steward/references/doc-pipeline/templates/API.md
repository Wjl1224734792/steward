<!-- 来源：eng-doc-pipeline templates.md（2026-10-28 快照）；Steward ZCode 侧适配见 ../PROVENANCE.md -->

<!-- 模板：API.md -->

## API 端点条目模板（`docs/03-契约/API接口与事件协议.md`）

```markdown
### <节号> <功能域中文名>
- `<METHOD> <路径>` → `ok(<data形状>, "<可操作的中文msg>")`
  - 入参：`field`（类型，必填/可选，默认）—— 说明
  - 出参 data：`{ key: 类型, ... }`
  - 错误：`<错误码> <含义>` → HTTP <状态>
  - 权限：凭据解析 user_id + require_perm("<scope>") + 行级过滤
  - 联动：本文档 + manifest（openapi 等）自查
```

错误码号段表（按项目定）：`1xxx 通用 / 2xxx 认证权限 / 3xxx 业务校验（含硬规则拦截）/ 4xxx 任务 / 5xxx 系统`。

**专项接口条目**（AI Agent 项目的 MCP Tool / RPC / 事件消息等，落 `docs/03-契约/` 或 `04-专项/`）：名称、用途、入参、**权限注入方式（凭据解析，不从入参取）**、行级过滤、出参脱敏字段、错误码、联动清单。
