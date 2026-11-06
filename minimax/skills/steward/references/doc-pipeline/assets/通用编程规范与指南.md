# 通用编程规范与指南

> Steward 适配：本项目默认**不创建 GitHub CI/CD**；文中「CI/CD」一律按「本地门禁脚本 + 可选 git hook」理解，命令以项目 `AGENTS.md` 命令速查为准。

## 🗂️ 快速参考卡

```
┌──────────────────────────────────────────────────────────────────┐
│                    通用编程规范速查                               │
├──────────────┬───────────────────────────────────────────────────┤
│ 嵌套         │ ≤ 4 层，卫语句 + 函数提取                          │
│ 不可变       │ 返回新集合，禁止就地修改                           │
│ 模块化       │ 命名导出，禁止循环依赖                              │
│ 设计原则     │ SOLID + DRY + KISS（OOP 特定项 Go/Rust 除外）       │
│ 条件分支     │ ≥3 用 Map/字典；空值用 ?. / Optional / match       │
│ 异步并发     │ 无依赖必须并行，禁止静默吞错                        │
│ 数据库       │ 禁物理外键；索引须 EXPLAIN 验证；软删须含唯一约束   │
│ 测试         │ 核心逻辑 TDD，每个测试一个行为                      │
│ 前端         │ 禁 @apply / 运行时 CSS-in-JS；颜色键三层架构        │
│ 命名         │ 见名知义，布尔 is/has 前缀，遵循语言惯例            │
│ 错误处理     │ 禁空 catch；记录上下文；外层友好内层详细            │
│ 日志可观测性 │ 结构化单行 JSON；禁 PII/密钥；关键路径带 trace_id   │
│ Karpathy     │ 先想→简单→精准→验证，不画蛇添足                     │
│ 文档维护     │ 代码变→AGENTS.md/README/docs 同步更新              │
│ 临时文件     │ 统一放 tmp/ 目录，及时清理，加入 .gitignore         │
│ 质量门禁     │ Lint → TypeCheck → Test → Build → 关闭旧Dev → 启动Dev  │
│ 前端 UI 调试 │ 浏览器实看 + 全状态验证 + 前后端联调 + UI 合理性   │
│ CI/CD        │ lint + typecheck + test + build 全通过；覆盖率 ≥80% │
└──────────────┴───────────────────────────────────────────────────┘
```

------

## 1. 开发环境配置

| 项目                   | 规范                                                         |
| ---------------------- | ------------------------------------------------------------ |
| **文档/注释/沟通语言** | 强制使用**中文**（代码标识符除外）                           |
| **终端**               | 项目统一指定终端环境；生产环境推荐 Linux，当前开发环境：Powershell |
| **编辑器配置**         | 项目根目录必须包含 `.editorconfig`，统一缩进、换行符、编码   |
| **版本管理**           | 使用 `.gitignore` 模板，禁止提交构建产物、密钥、IDE 配置     |

------

## 2. 代码规范（通用原则）

### 2.1 注释与文档

> **原则**：只写关键逻辑与边界条件，禁止"翻译代码"式注释。

| 要素          | 说明                                          |
| ------------- | --------------------------------------------- |
| 函数/方法文档 | 必须包含：参数说明、返回值说明、异常/错误说明 |
| 行内注释      | 仅解释 **Why**，不解释 What                   |

📋 **各语言文档标准映射**：

| 语言          | 文档格式                       | 工具            |
| ------------- | ------------------------------ | --------------- |
| TypeScript/JS | TSDoc / JSDoc                  | TypeDoc         |
| Python        | Google Style Docstring         | Sphinx / pdoc   |
| Go            | GoDoc 注释（`//` 紧邻声明）    | godoc / pkgsite |
| Java/Kotlin   | Javadoc / KDoc                 | Dokka           |
| C#            | XML 文档注释 `///`             | DocFX           |
| Rust          | `///` doc comments（Markdown） | rustdoc         |
| C/C++         | Doxygen 风格                   | Doxygen         |

------

### 2.2 嵌套层级

> **原则**：最多 **4 层**嵌套，禁止超过。

**优化手段**（语言无关）：

- ✅ **卫语句（Guard Clause）**：提前 `return` / `throw` / `continue`
- ✅ **函数提取**：将深层逻辑抽为独立函数
- ✅ **模式匹配**：用 `match` / `switch` 替代多层 `if-else`（Go 用 `switch`，Rust 用 `match`）

------

### 2.3 数据不可变性

> **原则**：优先使用不可变操作，避免就地修改（mutation）。

❌ **禁止的模式**：直接修改原数组/集合（`push`、`pop`、`sort`、`splice`、`remove`、`append` 等就地操作）

✅ **推荐的模式**：返回新集合的操作

| 语言   | ❌ 就地修改         | ✅ 不可变替代                           |
| ------ | ------------------ | -------------------------------------- |
| TS/JS  | `arr.push(x)`      | `[...arr, x]`                          |
| TS/JS  | `arr.sort()`       | `arr.toSorted()`                       |
| Python | `list.append(x)`   | `list + [x]` 或 `[*list, x]`           |
| Python | `list.sort()`      | `sorted(list)`                         |
| Java   | `list.add(x)`      | `Stream.concat()` / `List.of()`        |
| Go     | `append(slice, x)` | 创建新 slice 后 `append`               |
| Rust   | `vec.push(x)`      | `vec.iter().chain(once(&x)).collect()` |
| C#     | `list.Add(x)`      | `list.Append(x)`（LINQ，返回新序列）   |

> ⚠️ **例外**：性能关键路径（如大规模数据处理、算法实现）允许就地修改，但必须**注释说明原因**并通过团队评审。

------

### 2.4 模块化与依赖管理

> **原则**：高内聚、低耦合，禁止循环依赖。

| 规则     | 说明                                          |
| -------- | --------------------------------------------- |
| 导出方式 | 推荐**命名导出**，避免默认/通配导出           |
| 路径引用 | 使用别名（如 `@/`）或包路径，禁止深层相对路径 |
| 循环依赖 | **绝对禁止**，使用分层架构或事件解耦          |
| 依赖方向 | 上层 → 下层，禁止反向依赖（依赖倒置原则）     |

📋 **各语言模块化映射**：

| 语言   | 模块系统                     | 包管理         | 路径别名                       |
| ------ | ---------------------------- | -------------- | ------------------------------ |
| TS/JS  | ES Modules (`import/export`) | pnpm / npm     | `tsconfig paths`               |
| Python | Package (`__init__.py`)      | Poetry / uv    | `sys.path` 或 `pyproject.toml` |
| Go     | Package（目录即包）          | Go Modules     | `go.mod` replace               |
| Java   | Module（JPMS）/ Package      | Maven / Gradle | 无（包路径即别名）             |
| Rust   | Crate / Module (`mod`)       | Cargo          | `Cargo.toml`                   |
| C#     | Namespace / Project          | NuGet          | `<ProjectReference>`           |

------

### 2.5 设计原则

#### 核心原则：SOLID + DRY + KISS

| 原则             | 一句话                     | 适用场景                           |
| ---------------- | -------------------------- | ---------------------------------- |
| **S** - 单一职责 | 一个模块/类/函数只做一件事 | 通用                               |
| **O** - 开闭原则 | 对扩展开放，对修改关闭     | 通用（Go/Rust 用 interface/trait） |
| **L** - 里氏替换 | 子类必须能替代父类使用     | OOP 语言，Go/Rust 用组合替代       |
| **I** - 接口隔离 | 不强迫依赖不需要的方法     | OOP 语言，Go/Rust 接口天然满足     |
| **D** - 依赖倒置 | 依赖抽象，不依赖具体实现   | 通用                               |
| **DRY**          | 不重复自己，提取公共逻辑   | 通用                               |
| **KISS**         | 保持简单，拒绝过度设计     | 通用                               |

#### 条件优化

| 规则       | ❌ 反面                  | ✅ 正面                                        |
| ---------- | ----------------------- | --------------------------------------------- |
| 多分支映射 | `if/else` 超过 3 个分支 | 用 Map / 字典 / 枚举映射                      |
| 严格相等   | `==`（隐式类型转换）    | `===` / `equals()` / `==`（Go/Rust 天然严格） |
| 空值安全   | 手动 `if (x != null)`   | 空值合并 `??` / `Optional` / `if let` / `?.`  |

📋 **各语言空值安全与多分支映射**：

| 语言   | 空值安全                        | 多分支映射                          |
| ------ | ------------------------------- | ----------------------------------- |
| TS/JS  | `?.` `??`                       | `Map` / 对象字面量                  |
| Python | `getattr(obj, 'x', default)`    | `dict` 映射 / `match-case`（3.10+） |
| Go     | `if v, ok := m[k]; ok`          | `map` + `switch`                    |
| Java   | `Optional<T>`                   | `Map` / `switch` 表达式（14+）      |
| Rust   | `Option<T>` + `?` / `unwrap_or` | `match` / `HashMap`                 |
| C#     | `?.` `??`                       | `Dictionary` / `switch` 表达式      |

#### 异步/并发

| 规则       | 说明                                                         |
| ---------- | ------------------------------------------------------------ |
| 并行执行   | 无依赖的异步操作必须并行执行（如 `Promise.all` / `goroutine` / `asyncio.gather`） |
| 无意义等待 | 避免 `return await`（除非在 `try/catch` 中）                 |
| 错误处理   | 异步操作**必须**处理错误，禁止静默吞错                       |

📋 **各语言并发模型映射**：

| 语言   | 并行执行                          | 错误处理                 |
| ------ | --------------------------------- | ------------------------ |
| TS/JS  | `Promise.all()`                   | `.catch()` / `try/catch` |
| Python | `asyncio.gather()`                | `try/except`             |
| Go     | `goroutine` + `errgroup`          | `error` 返回值           |
| Java   | `CompletableFuture.allOf()`       | `.exceptionally()`       |
| Rust   | `tokio::join!` / `futures::join!` | `Result<T, E>` + `?`     |
| C#     | `Task.WhenAll()`                  | `try/catch`              |

------

### 2.6 DDD（领域驱动设计）

> **适用**：仅复杂业务逻辑（状态流转、多聚合交互）。简单 CRUD 不需要。

| 战术模式     | 说明               | 语言无关规则                   |
| ------------ | ------------------ | ------------------------------ |
| **聚合根**   | 业务边界入口       | 外部只能通过聚合根修改内部状态 |
| **值对象**   | 不可变的描述性对象 | 创建后不可修改，通过相等性比较 |
| **领域服务** | 跨聚合的业务操作   | 不持有状态，只封装业务逻辑     |
| **领域事件** | 业务事件通知       | 解耦聚合间通信                 |

🚫 **禁止**：

- 数据访问逻辑（SQL/HTTP）放入实体
- 应用层（Controller/Handler）编写核心业务规则

------

### 2.7 TDD（测试驱动开发）

> **流程**：🔴 红（失败测试）→ 🟢 绿（最快通过）→ 🔵 重构

| 规则         | 说明                                        |
| ------------ | ------------------------------------------- |
| 核心业务逻辑 | **必须**先写单元测试                        |
| 每个测试     | 只验证**一个行为**                          |
| 测试命名     | `应该_预期行为_当_条件`（中英文均可）       |
| 例外         | UI 快照、集成测试不强制 TDD，但关键流程仍需 |

📋 **各语言测试框架映射**：

| 语言   | 单元测试                 | Mock                            | 断言                                |
| ------ | ------------------------ | ------------------------------- | ----------------------------------- |
| TS/JS  | Vitest / Jest            | `vi.mock()` / `jest.mock()`     | `expect().toBe()`                   |
| Python | `pytest`                 | `unittest.mock` / `pytest-mock` | `assert`                            |
| Go     | `testing` 标准库         | `testify/mock`                  | `assert.Equal()`                    |
| Java   | JUnit 5                  | Mockito                         | `assertThat()` (AssertJ)            |
| Rust   | `#[test]` + `cargo test` | `mockall`                       | `assert_eq!()`                      |
| C#     | xUnit / NUnit            | Moq / NSubstitute               | `Assert.Equal()` / FluentAssertions |

------

### 2.8 数据库规范

| 规则             | 说明                                                         |
| ---------------- | ------------------------------------------------------------ |
| **禁止物理外键** | ORM 逻辑关联，禁数据库级约束（避免锁竞争、级联失控、迁移困难） |
| 迁移管理         | 所有 Schema 变更必须通过迁移文件，禁止手动修改               |

##### 数据访问（ORM 项目）

> 用了 ORM 就必须经 schema 访问，禁止绕过 ORM 直连数据库拼 SQL。

| 规则                  | 说明                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| **schema 唯一事实**   | 表结构以 ORM schema 定义为唯一事实来源；变更 = 改 schema → 生成迁移 → 应用 → 回填文档；禁手写 DDL 与 schema 平行定义 |
| **ORM 优先**          | 数据访问一律经查询构建器；ORM 表达不了的复杂查询才写原生 SQL，且必须参数化（值走占位符）                  |
| **禁拼接 SQL**        | 禁止字符串拼接/模板插值拼 SQL；禁 ORM 的 raw 类 API（如 Drizzle `sql.raw()`）                            |
| **动态标识符白名单**  | 动态表名/列名/排序字段必须经白名单映射，入参禁直接当标识符                                               |
| **复杂 SQL 入仓储层** | 多表 join/窗口/聚合查询封装在仓储层，service 禁直接拼查询；仓储查询纳入测试（含行级隔离/权限过滤断言）   |

##### 索引

> 索引要有据可查，禁止凭直觉建索引。

| 规则             | 说明                                                  |
| ---------------- | ----------------------------------------------------- |
| **WHERE 列优先** | 高频 `WHERE` / `JOIN` 字段必须建索引                  |
| **复合索引顺序** | 等值条件在前，范围在后（如 `(status, created_at)`）   |
| **避免冗余**     | 已有 `(a, b)` 不需单独 `(a)`；`UNIQUE` 已是索引       |
| **避免索引失效** | 禁止隐式类型转换（`varchar_col = 123`）、禁止前置 `%` |
| **EXPLAIN 验证** | 新增查询必须验证命中预期索引                          |
| **定期清理**     | 删除无用/重复索引（监控 `pg_stat_user_indexes` 等）   |

| 数据库        | EXPLAIN 命令                     |
| ------------- | -------------------------------- |
| PostgreSQL    | `EXPLAIN ANALYZE SELECT ...`     |
| MySQL/MariaDB | `EXPLAIN SELECT ...`             |
| SQLite        | `EXPLAIN QUERY PLAN SELECT ...`  |
| SQL Server    | `SET SHOWPLAN_XML ON` / 执行计划 |

##### 软删除

> 推荐软删除，但必须处理唯一约束和查询过滤。

| 规则       | 说明                                                    |
| ---------- | ------------------------------------------------------- |
| 删除字段   | `deleted_at TIMESTAMP NULL`，NULL 表示未删除            |
| 唯一约束   | 唯一索引**必须**包含 `deleted_at`，否则删后重建冲突     |
| 查询过滤   | 所有业务查询 + `WHERE deleted_at IS NULL`，封装避免遗漏 |
| 级联软删除 | 应用层处理——删父记录时同步标记子记录                    |

| ORM             | 自动过滤方式                                                 |
| --------------- | ------------------------------------------------------------ |
| Drizzle ORM     | 封装 `where(eq(table.deleted_at, null))` 为公共条件          |
| Prisma          | `@@filter('notDeleted', deletedAt == null)` 或仓库层封装     |
| TypeORM         | `@DeleteDateColumn()` + 全局订阅者                           |
| SQLAlchemy      | Mixin + `default_filter` 自动追加过滤条件                    |
| GORM            | `gorm.DeletedAt` 字段，默认不查已删除行                      |
| JPA / Hibernate | `@SQLRestriction("deleted_at IS NULL")` + `@MappedSuperclass` |
| EF Core         | Global Query Filter: `builder.HasQueryFilter(e => e.DeletedAt == null)` |

##### 禁用物理外键

| ORM         | 方式                                                         |
| ----------- | ------------------------------------------------------------ |
| TypeORM     | `createForeignKeyConstraints: false`                         |
| Prisma      | 不定义 `@relation` 物理约束（默认不创建 FK）                 |
| Drizzle ORM | 不用 `.references()`，关联查询用 `relations` API             |
| SQLAlchemy  | `use_alter=False` 或不声明 `ForeignKey`                      |
| JPA         | `@JoinColumn(foreignKey = @ForeignKey(ConstraintMode.NO_CONSTRAINT))` |
| GORM        | `Constraint: false` 在 `foreignKey` tag                      |
| EF Core     | 不配置 `.HasOne().WithMany()` 的外键约束                     |

------

### 2.9 前端样式（如适用）

> **原则**：样式与结构分离可控，禁止魔法指令。

| 规则         | 说明                                  |
| ------------ | ------------------------------------- |
| Tailwind CSS | **禁止 `@apply`**，只使用内联类名     |
| CSS-in-JS    | 禁止运行时动态样式（性能陷阱）        |
| 全局样式     | 最小化，使用 CSS Modules / Scoped CSS |

#### 2.9.1 颜色键设计（Design Tokens）

> **原则**：所有颜色必须通过**语义化颜色键（Design Tokens）**引用，禁止在组件中硬编码色值。主题切换通过替换 token 层实现，组件代码零改动。

**三层颜色键架构：**

```
┌──────────────────────────────────────────────────┐
│  第三层：组件级 Token（component）               │
│  --button-primary-bg, --card-border, --input-ring│
│  → 组件直接引用，保证 UI 一致性                  │
├──────────────────────────────────────────────────┤
│  第二层：语义化 Token（semantic）                │
│  --color-bg-primary, --color-text-muted,         │
│  --color-border, --color-accent, --color-danger  │
│  → 描述用途而非色值，主题切换改这一层            │
├──────────────────────────────────────────────────┤
│  第一层：原始色板（primitive）                   │
│  --palette-gray-100: #f3f4f6,                    │
│  --palette-blue-500: #3b82f6, ...                │
│  → 仅被 semantic 层引用，组件禁止直接使用        │
└──────────────────────────────────────────────────┘
```

| 规则                 | 说明                                                         |
| -------------------- | ------------------------------------------------------------ |
| **禁止硬编码色值**   | 组件中禁止出现 `#xxx`、`rgb()`、`hsl()` 等字面色值           |
| **禁止跨层引用**     | 组件只能引用 `component` 层；`primitive` 仅 `semantic` 层引用 |
| **暗色模式**         | 通过 `[data-theme="dark"]` 覆盖 semantic 层 token 实现       |
| **主题色切换**       | 替换 `--color-accent` 等 semantic token 值，组件无需感知     |
| **Token 命名**       | kebab-case，语义优先（`--color-text-error` 而非 `--color-red`） |
| **CSS 变量声明位置** | 统一放在 `:root` / `[data-theme]` 选择器中，禁止散落各处     |

**多层主题实现示例：**

```css
/* 第一层：原始色板（仅被第二层引用） */
:root {
  --palette-gray-50: #f9fafb;
  --palette-gray-300: #d1d5db;
  --palette-gray-600: #4b5563;
  --palette-gray-900: #111827;
  --palette-blue-400: #60a5fa;
  --palette-blue-500: #3b82f6;
  --palette-red-400: #f87171;
  --palette-red-500: #ef4444;
}

/* 第二层：语义化（描述用途，主题切换改这层） */
:root,
[data-theme="light"] {
  --color-bg-primary: var(--palette-gray-50);
  --color-text-primary: var(--palette-gray-900);
  --color-accent: var(--palette-blue-500);
  --color-danger: var(--palette-red-500);
  --color-border: var(--palette-gray-300);
}

/* 暗色主题：只覆盖 semantic 层 token 值 */
[data-theme="dark"] {
  --color-bg-primary: var(--palette-gray-900);
  --color-text-primary: var(--palette-gray-50);
  --color-accent: var(--palette-blue-400);
  --color-danger: var(--palette-red-400);
  --color-border: var(--palette-gray-600);
}

/* 第三层：组件级（组件直接引用，保证 UI 一致性） */
:root {
  --button-primary-bg: var(--color-accent);
  --button-primary-text: #ffffff;
  --card-border: var(--color-border);
  --input-border: var(--color-border);
  --input-ring: var(--color-accent);
}
```

**各框架颜色键落地方式：**

| 框架 / 方案     | Token 定义位置                          | 主题切换方式                        |
| --------------- | --------------------------------------- | ----------------------------------- |
| Tailwind CSS v4 | `@theme` 块中定义 CSS 变量              | `dark:` 变体 或 `data-theme` 选择器 |
| Tailwind CSS v3 | `tailwind.config.ts` → `extend.colors`  | `darkMode: "class"` / `"selector"`  |
| CSS Modules     | 全局 `tokens.css` + `composes`          | `[data-theme]` 选择器               |
| Vanilla Extract | `createTheme()` + `createGlobalTheme()` | `createThemeContract()` 契约式      |
| Panda CSS       | `tokens` 配置 → 自动生成 CSS 变量       | `conditions` 配置暗色模式           |
| shadcn/ui       | CSS 变量（`--background`, `--primary`） | `dark` class → 覆盖变量             |

##### 搭配 UI 框架时

> 使用 UI 框架时，**映射到框架 token，不另起炉灶**。

| 规则                     | 说明                                                         |
| ------------------------ | ------------------------------------------------------------ |
| **复用框架 token**       | 如果框架提供了 `--primary`，就映射到它，不要自建 `--color-accent` |
| **只补缺失层**           | 框架有 semantic token → 只定义 primitive + component；框架全有 → 只定义 component |
| **自定义组件才建 token** | 框架没覆盖的自定义组件（特定业务卡片、图表等）才需要自建 component token |

| UI 框架      | 自带 token 示例                           | 正确做法                                                     |
| ------------ | ----------------------------------------- | ------------------------------------------------------------ |
| shadcn/ui    | `--background` `--primary` `--foreground` | 自定义 color token 映射到 shadcn token 上，别自建 semantic 层 |
| Ant Design   | `--ant-primary-color` `--ant-error-color` | 用 `ConfigProvider.theme.token` 扩展，别用 CSS 变量覆盖      |
| MUI          | JS 主题对象 `createTheme({ palette })`    | 在 `createTheme` 中扩展色板，别混用 CSS 变量                 |
| Radix Themes | `--accent-9` `--gray-1` `--red-9`         | 直接引用框架 token 建 component 层，不自建 primitive         |
| NextUI       | `--nextui-primary` `--nextui-danger`      | 自定义色通过 `extendTheme` 注入，保留框架 token 不变         |

> **简单案例**：用了 shadcn/ui，你只需要在 tailwind.config 中把自定义业务色挂到框架语义 token 名下：
>
> ```css
> :root { --brand-accent: var(--primary); /* shadcn 的 primary 即品牌色 */ }
> ```
>
> 不要另建 `--color-accent` 导致两套系统并存。

> ⚠️ 此条仅适用于前端项目，后端项目可忽略。

------

### 2.10 编码行为准则（Karpathy 指南）

> **来源**：[Andrej Karpathy 对 LLM 编程常见问题的观察](https://x.com/karpathy/status/2015883857489522876)，适用于任何语言/框架。简单任务可灵活判断。

| 原则               | 核心要求                                         | 检验方式                                            |
| ------------------ | ------------------------------------------------ | --------------------------------------------------- |
| **先思考再编码**   | 不假设、不隐藏困惑。有歧义列出选项而非默默选择   | 每个决策都能说出**为什么**                          |
| **简单优先**       | 只做被要求的，不做投机设计。50 行能搞定不写 200  | 自问：「senior 会觉得过度复杂吗？」                 |
| **外科手术式修改** | 只改任务涉及的行，匹配已有风格，不顺手改无关代码 | 每行改动都能**直接追溯**到用户请求                  |
| **目标驱动执行**   | 先定义成功标准（测试），再循环验证直到通过       | 模糊任务 → 可验证目标："修 bug" → "写复现测试→修复" |

> 强劲的成功标准让你独立迭代；薄弱标准（"能跑就行"）需不断确认。


### 2.11 日志与可观测性（通用原则）

> 适用：有服务端 / 定时任务 / 外部依赖 / 运维面的项目必守；纯静态、无运行期的项目可整体豁免。项目落地时按此基线裁剪成 `docs/02-架构/可观测性*工程化.md`（横切域 SSOT），并在对应层级规范写条款。

| 规则         | 说明                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------ |
| 结构化输出   | 单行 JSON（或等价键值）到 stdout；禁止多行拼接与裸文本混排；调试语句不得直接输出                 |
| 关联 ID      | 入口生成 trace/请求 ID，全链路透传（头名 + 格式写进契约）；所有日志与审计/事件记录带同一 ID；后台任务每轮生成一个 |
| 最小字段     | 时间、级别、服务/单元、消息、关联 ID 为必填；事件键用稳定机器码，动态值放字段不放消息文本         |
| 级别语义     | error=需人行动或关键动作未完成；warn=自愈/降级/阈值临近；info=状态变更；debug=排查（生产默认关）；fatal=不可继续 |
| 禁入内容     | PII、凭证/密钥/连接串、完整请求体；**日志不是绕过脱敏与权限的第二数据通道**（查明细走受权限校验的查询） |
| 审计分离     | 合规/财务事实进 append-only 审计存储（长留存）；运行日志短留存可轮转；两者用关联 ID 相连，互不替代 |
| 错误日志     | 必须带上下文（时间、位置、参数摘要、堆栈）；堆栈只进日志，不进对外响应                            |
| 告警         | 关键失败路径必须定义告警三要素（谁收 / 去哪 / 做什么）；「只打日志」不算告警                      |
| 留存有界     | 各环境运行日志留存天数明确并按时清理/归档；禁止无期限保留                                         |

📋 **落地检查**：入口是否生成并透传关联 ID？日志是否可被逐行解析？审计与运行日志是否分开存放且可关联？告警是否有接收人与动作？


## 3. 质量保证

### 3.1 文档维护规范

> **原则**：代码即文档，文档即代码——每次改动必须同步维护项目文档。

| 规则               | 说明                                                         |
| ------------------ | ------------------------------------------------------------ |
| **文档同步更新**   | 代码变更时，必须同步更新 `AGENTS.md`、`README`、`docs/` 中受影响的说明 |
| **新增/删除文件**  | 若新增或删除模块/包/应用，必须检查并更新对应的 AGENTS.md 层级文件，确保架构概览、目录说明、快速开始指南与实际代码一致 |
| **AGENTS.md 层级** | 多仓库/大型仓库中，`AGENTS.md` 按层级组织（根级别 + 各子目录级别），改动子目录时必须同时审核对应的子级别 `AGENTS.md` |
| **README 同步**    | 若改动影响项目启动命令、环境要求、端口映射、依赖列表，必须同步更新 `README`（含多语言的 `README.*.md` 翻译） |
| **docs 目录**      | 若改动影响 API 接口、配置项、数据模型、架构决策，必须更新 `docs/` 中的对应文档 |
| **AGENTS.md 同步** | 若改动改变了工具链、工作流或 Agent 行为，必须同步更新 `AGENTS.md` |

#### 文档级别检查清单

```
□ 新增/删除文件 → AGENTS.md 架构概览仍准确
□ 新增/修改命令 → README 开发命令仍正确
□ 新增/修改 API → docs/ API 文档已更新
□ 新增/修改配置 → docs/ 配置文档已更新
□ 新增/删除目录 → 层级 AGENTS.md 已审核
```

---

### 3.2 临时文件规范

> **原则**：所有临时文件、实验代码、调试输出统一放入 `tmp/` 目录，保持项目根目录整洁。

| 规则         | 说明                                                         |
| ------------ | ------------------------------------------------------------ |
| **统一目录** | 项目根目录下 `tmp/` 作为唯一临时文件存放位置                 |
| **目录结构** | `tmp/` 下可按日期或用途分子目录：`tmp/2026-07-29/`、`tmp/debug/`、`tmp/experiment/` |
| **禁止散落** | 禁止在项目根目录、桌面、下载目录随意创建临时脚本、测试文件、日志输出 |
| **及时清理** | 功能完成并验证通过后，删除 `tmp/` 中不再需要的临时文件；建议 `tmp/` 加入 `.gitignore` |
| **例外**     | 构建产物、缓存目录（`node_modules/`、`target/`、`dist/` 等）不在本规范范围内，按各自构建系统约定存放 |

```
项目根目录
├── tmp/                     ← 所有临时文件在此
│   ├── debug/               ← 调试脚本、日志
│   ├── experiment/          ← 实验性代码
│   └── 2026-07-29/          ← 按日期归档
├── src/
├── docs/
└── .gitignore               ← 含 tmp/
```

---

### 3.3 质量门禁（Quality Gate）

> **原则**：每次改动必须通过完整的质量门禁链——**Lint → Type-Check → Test → Build → Dev**，全部通过后才算完成。不允许"先提交再说"。

| 阶段              | 命令（通用）                 | 说明                                                     |
| ----------------- | ---------------------------- | -------------------------------------------------------- |
| **1. Lint**       | `lint` / `format:check`      | 代码风格与静态分析必须零警告（棘轮模式下警告数不得增加） |
| **2. Type-Check** | `typecheck` / `tsc --noEmit` | 类型系统必须无错误                                       |
| **3. Test**       | `test` / `test:unit`         | 单元测试全部通过，新增核心逻辑必须有覆盖                 |
| **4. Build**      | `build` / `compile`          | 项目可成功构建，无编译/打包错误                          |
| **5. Dev**        | `dev` / `start`              | 先关闭旧 Dev 进程，再启动新服务，确保无运行时错误，避免同一服务重复启动 |

> ⚠️ **顺序不可调换**：必须按 1→2→3→4→5 顺序执行，前一步失败不进入下一步。所有步骤累计不通过不得提交。

```
质量门禁流程：

  Lint ──✅──▶ Type-Check ──✅──▶ Test ──✅──▶ Build ──✅──▶ 关闭旧Dev ──✅──▶ 启动Dev ──✅──▶ 完成
    │            │              │            │               │              │
    ❌            ❌              ❌            ❌               ❌              ❌
    └─ 修复 ─────┴─ 修复 ───────┴─ 修复 ─────┴─ 修复 ────────┴─ 修复 ───────┘
```

> ⚠️ **Dev 阶段必须先杀后启**：执行 `dev` 前必须先用 `kill-port` 关闭旧进程，避免同一端口被多次占用导致多个 dev 实例同时运行。

#### 各语言质量门禁命令映射

| 语言/生态    | Lint                     | Type-Check              | Test             | Build                     | Dev                 |
| ------------ | ------------------------ | ----------------------- | ---------------- | ------------------------- | ------------------- |
| TS/JS (pnpm) | `pnpm lint`              | `pnpm typecheck`        | `pnpm test`      | `pnpm build`              | `npx kill-port <端口> ; pnpm dev`          |
| TS/JS (npm)  | `npm run lint`           | `npm run typecheck`     | `npm test`       | `npm run build`           | `npx kill-port <端口> ; npm run dev`       |
| Python       | `ruff check`             | `mypy`                  | `pytest`         | `pip install -e .`        | `kill-port <端口> ; python -m uvicorn`     |
| Go           | `golangci-lint run`      | `go vet`                | `go test ./...`  | `go build ./...`          | `kill-port <端口> ; go run .`              |
| Rust         | `cargo clippy`           | `cargo check`           | `cargo test`     | `cargo build`             | `kill-port <端口> ; cargo run`             |
| Java         | `./gradlew checkstyle`   | `./gradlew compileJava` | `./gradlew test` | `./gradlew build`         | `kill-port <端口> ; ./gradlew bootRun`     |
| C#           | `dotnet format --verify` | `dotnet build`          | `dotnet test`    | `dotnet build -c Release` | `kill-port <端口> ; dotnet run`            |

---

### 3.4 前端 UI 调试规范

> **原则**：涉及前端 UI 的改动，必须在浏览器中实际查看效果，不允许仅凭代码审查通过。

| 规则              | 说明                                                         |
| ----------------- | ------------------------------------------------------------ |
| **页面调试**      | 改动的每个页面/组件必须在浏览器中打开，检查布局、间距、颜色、响应式表现 |
| **交互验证**      | 点击、表单提交、弹窗、导航、加载状态、空状态、错误状态均须手动验证 |
| **跨场景验证**    | 必须在以下状态均验证：正常数据、空数据、加载中、错误状态、边界情况 |
| **响应式检查**    | 桌面端 + 移动端（或至少两种视口宽度）均须检查                |
| **暗色/亮色模式** | 若项目支持主题切换，两种主题下均须验证                       |
| **前后端联调**    | 若改动涉及前后端接口，必须启动完整前后端环境，确认数据流端到端正常 |
| **UI 合理性判断** | 不仅检查"能跑"，还需判断 UI 是否合理——信息密度、操作便利性、视觉层次、文案准确性 |

#### 前端调试检查清单

```
□ 页面可正常渲染（无白屏/报错）
□ 组件在所有状态均正常显示（正常/空/加载/错误）
□ 表单提交与验证逻辑正常
□ 响应式布局：桌面端 ✅  移动端 ✅
□ 主题切换正常（如适用）：亮色 ✅  暗色 ✅
□ 前后端联调：请求 ✅  响应 ✅  错误处理 ✅
□ UI 合理性：布局合理、文案准确、操作顺手
□ Console 无报错/警告（预期内的除外）
□ 网络请求无 4xx/5xx（预期内的除外）
```

---

### 3.5 例外声明

以下场景可豁免部分规则，但必须**注释说明原因**并**通过团队评审**：

- 算法实现 / 递归逻辑
- 性能关键路径（热循环、大规模数据处理）
- 底层系统编程（内存管理、位操作）

---

### 3.6 强制检查项（Commit 前）

```
□ 嵌套 ≤ 4 层
□ 无循环依赖
□ 多分支用 Map/字典映射，判空用安全运算符，全等比较
□ 异步/并发操作正确处理错误
□ 无物理外键
□ 无 @apply（前端 Tailwind 项目）
□ 质量门禁全通过：Lint ✅  Type-Check ✅  Test ✅  Build ✅  关闭旧Dev ✅  启动Dev ✅
□ 文档已同步更新（AGENTS.md / README / docs / AGENTS.md）
□ 临时文件已归入 tmp/ 目录
□ 涉及前端 UI → 页面调试通过，前后端联调通过，UI 合理性确认
□ 核心业务规则在聚合根/领域服务，不泄露到应用层
□ 新增核心逻辑附带单元测试
□ 无硬编码密钥/凭证
□ 无 console.log / print 调试语句（日志框架除外）
□ 日志结构化、无 PII/密钥；关键路径日志带关联 ID；审计与运行日志分离（§2.11）
```

---

### 3.7 自动化流水线（CI/CD）

| 阶段       | 工具（通用）                                              |
| ---------- | --------------------------------------------------------- |
| 代码格式化 | Prettier / Black / gofmt / rustfmt / dotnet format        |
| 静态分析   | ESLint / Ruff / golangci-lint / Clippy / Roslyn Analyzers |
| 类型检查   | tsc / mypy / go vet / cargo check / dotnet build          |
| 单元测试   | 各语言测试框架（见 2.7）                                  |
| 覆盖率     | ≥80%（核心业务逻辑 ≥90%）                                 |
| 安全扫描   | Trivy / Snyk / Dependabot                                 |

------

## 4. 命名规范

| 类型      | 通用原则                                          | 示例                                   |
| --------- | ------------------------------------------------- | -------------------------------------- |
| 变量/函数 | **见名知义**，禁止单字母（循环变量除外）          | `getUserById` / `get_user_by_id`       |
| 布尔值    | `is`/`has`/`can`/`should` 前缀                    | `isActive` / `has_permission`          |
| 常量      | 全大写 + 下划线（Go: PascalCase；C#: PascalCase） | `MAX_RETRY_COUNT`                      |
| 类/接口   | 名词，首字母大写                                  | `UserService` / `OrderRepository`      |
| 文件      | 与主要导出一致                                    | `user_service.py` / `UserService.java` |

📋 **各语言命名风格映射**：

| 语言   | 变量/函数                          | 类/类型      | 常量          | 文件              |
| ------ | ---------------------------------- | ------------ | ------------- | ----------------- |
| TS/JS  | `camelCase`                        | `PascalCase` | `UPPER_SNAKE` | `kebab-case.ts`   |
| Python | `snake_case`                       | `PascalCase` | `UPPER_SNAKE` | `snake_case.py`   |
| Go     | `camelCase`（导出用 `PascalCase`） | `PascalCase` | `PascalCase`  | `snake_case.go`   |
| Java   | `camelCase`                        | `PascalCase` | `UPPER_SNAKE` | `PascalCase.java` |
| Rust   | `snake_case`                       | `PascalCase` | `UPPER_SNAKE` | `snake_case.rs`   |
| C#     | `camelCase`（私有 `_camelCase`）   | `PascalCase` | `PascalCase`  | `PascalCase.cs`   |

------

## 5. 错误处理

> **原则**：错误必须被处理，禁止静默吞错。

| 规则     | 说明                                   |
| -------- | -------------------------------------- |
| 捕获范围 | 只捕获**预期内的异常**，禁止空 `catch` |
| 错误传播 | 底层抛异常/错误，上层决定如何处理      |
| 日志     | 错误必须记录上下文（时间、位置、参数） |
| 用户提示 | 对外展示友好信息，对内记录详细堆栈     |

📋 **各语言错误处理模式**：

| 语言   | 模式                            | 示例                                     |
| ------ | ------------------------------- | ---------------------------------------- |
| TS/JS  | `try/catch` + 自定义 Error 类   | `throw new BusinessError('...')`         |
| Python | `try/except` + 自定义 Exception | `raise ValidationError('...')`           |
| Go     | `error` 返回值 + `fmt.Errorf`   | `return fmt.Errorf("操作失败: %w", err)` |
| Java   | `throws` + 自定义 Exception     | `throw new BusinessException("...")`     |
| Rust   | `Result<T, E>` + `?` 传播       | `Err(MyError::NotFound)`                 |
| C#     | `try/catch` + 自定义 Exception  | `throw new DomainException("...")`       |

------

## 6. 沟通风格

- 🤝 专业表达，带点幽默，适当使用 Emoji
- 📊 **❌ 错误 vs ✅ 正确** 对比展示
- 📐 **结构化响应**：问题 → 方案 → 实践 → 注意事项
- 📝 Code Review 时给出优缺点，再提出改进

------