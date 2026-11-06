<!-- 来源：eng-doc-pipeline templates.md（2026-10-28 快照）；Steward ZCode 侧适配见 ../PROVENANCE.md -->

<!-- 模板：DATA-MODEL.md -->

## 数据表条目模板（`docs/03-契约/数据模型与存储设计.md`）

```sql
create table <表名>(
  id uuid primary key,
  <隔离字段> uuid not null,        -- 行级隔离（tenant_id / project_id），禁物理外键
  <业务字段> <类型> <约束>,         -- PII 字段注明脱敏策略
  deleted_at timestamptz null,     -- 软删；唯一约束必须包含 deleted_at
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on <表名>(<隔离字段>, <高频查询字段>);  -- 等值在前范围在后；EXPLAIN 验证
-- 口径注释：可用 = ...；审计表只追加不改；幂等键 = ...
```

**一致性**：多份文档含实体清单（ER/领域拆分/数据架构）时，改一处查全部。
