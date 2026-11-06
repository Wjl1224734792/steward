# 数据访问规范（ORM 项目必守；以 Drizzle 为参考实现）

> 适用：用 ORM（Drizzle / Prisma / TypeORM / SQLAlchemy…）访问关系库的后端。核心口径两句：**表结构以 ORM schema 为唯一事实来源；数据访问优先查询构建器，SQL 只以参数化形式存在**。ORM 对应 API 按栈替换，纪律不变。
> 本文自 README.md §3.8 外移（编号不变，正文唯一权威在此）；落位与机检依赖 README §3.7（规范进 AGENTS/rules 的通道）。

**A. 表结构权威：schema = 唯一事实来源**

1. 表/列/索引/约束的机读定义只有一份——`src/store/schema.ts`（Drizzle schema）。**禁止手写 DDL 与 schema 平行定义表结构**（两张嘴说话必漂移）；用了 ORM 就必须经 schema 访问，禁止绕过 ORM 直连数据库拼 SQL。
2. 改表结构的唯一路径：改 schema → 生成迁移（`drizzle-kit generate`，diff 必须评审后合入，防意外 drop）→ 应用（`db:migrate`）→ 回填数据模型文档。禁止直连改库、禁止手写 `CREATE TABLE` / `ALTER TABLE` 绕过 schema。
3. schema 表达不了的数据库对象（触发器、跨上下文只读视图、GRANT 授权等）写在迁移脚本里，并在 schema 文件头注释标注指向——它们是 schema 的延伸，**不是第二份表结构权威**。
4. 数据模型文档（`docs/03-契约/`）是人读契约，**从 schema 回填**；两者冲突以 schema 为准回填文档（安全/合规硬口径被破坏则停下讨论，README §5.3 场景速答「文档与代码不一致」）。

**B. 数据访问纪律：ORM 优先，参数化兜底**

5. 一切数据访问经 ORM 查询构建器（`select/insert/update/delete` + `where/join/orderBy`）；ORM 表达不了的复杂查询才写原生 SQL，且必须用**参数化 `sql` 模板**（如 ``sql`... where id = ${id}` ``——值永远走占位符，禁把值插进语句骨架）。
6. **禁止 `sql.raw()`**（无占位符直达拼接，注入面）；**禁止字符串拼接 / 模板字符串拼 SQL**（含把用户输入拼进条件、标识符等任何位置）。
7. 动态表名/列名/排序方向等标识符**必须走白名单**（常量映射表查值，查不到立即报错），入参永远不当标识符用。
8. 复杂 SQL（多表 join、窗口函数、聚合报表）封装在**仓储层（repository）**，service 层禁直接拼查询；仓储函数单一职责、命名表意、返回领域类型（禁把裸 row 一路抛到上层）。
9. 仓储层查询纳入测试：黄金场景 + 边界 + **行级隔离/权限过滤断言**（如 `deleted_at is null`、company_id 过滤必须被断言到）；新查询 EXPLAIN 验证索引命中（与编码规范基线 §2.8 索引条款一致）。

**C. 落位与机检（规范要随层级稳定生效，README §3.7）**

- 条款摘录（≤5 条）进 `backend/AGENTS.md` 红线段，全文进 `.agents/rules/backend.md` 数据访问节；根 AGENTS 只在数据红线处留一行指针。
- 机检优先：lint/本地门禁扫 `sql.raw` 与字符串拼 SQL 模式；本地门禁校验「schema ↔ 已应用迁移 ↔ 数据模型文档实体清单」一致，漂移即红灯（联动表见 README §4）。
- 迁移纪律（时序递增、已合入 main 禁编辑、破坏性变更两段式）不变，仍按 README §4 与层级规范执行。
