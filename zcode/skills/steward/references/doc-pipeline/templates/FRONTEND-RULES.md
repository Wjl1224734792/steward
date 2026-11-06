<!-- 来源：eng-doc-pipeline templates.md（2026-10-28 快照）；Steward ZCode 侧适配见 ../PROVENANCE.md -->

<!-- 模板：FRONTEND-RULES.md -->

## 前端层级规范模板（`.agents/rules/frontend.md`，骨架；素材与四步见 `../frontend-standards.md`）

> 定位：每端一份前端正文（frontmatter 声明作用域），红线摘录另进 `frontend/AGENTS.md`（≤5 条）。判级入口与实看规程见 `../frontend-standards.md`；视觉值一律引用 `DESIGN.md` 不复制。

```markdown
---
description: 前端（<端>）编码与交付规范
globs: frontend/**
---

# 前端规范（<端>）

> 上游：`docs/02-架构/前端工程化.md`（分层与选型）+ `docs/05-页面/`（页面 / 布局 / 详设）+ `.agents/designs/DESIGN.md`（token）
> 判级入口：任何影响用户所见的改动先按「增 / 查 / 改 / 删」定级（`frontend-standards.md` §1），再按该行联动文档与验证

## 1. 分层与依赖
<目录约定；容器 / 业务组件 / shared 边界；禁止反向依赖与跨域直引>

## 2. 状态与数据
<局部态 / 共享态 / 服务端数据的归属；请求落在 hook 或 query 层，组件禁直接 fetch；列表态（筛选 / 分页 / 排序 / tab）进 URL query>

## 3. 四态与错误呈现
<loading / empty（区分「暂无数据」与「筛选无结果」）/ error / 无权限；错误码原文 + 可操作文案，SSOT 在详设 §2；组件不自编文案>

## 4. 样式与 token
<主题走 Provider token；禁全局类覆盖 / 第二套色板 / 魔法数；代码里的色值必须能反查 DESIGN.md，反查不到先补文档>

## 5. 内置浏览器实看（红线）
<影响所见的改动必须实看：四态 × 视口 × 主题 × 数据形态 × 权限；证据四项（入口 / 观察 / 截图 / 对照基准 + 所用工具）；降级路径与「全不可用就停下报告未验证项」>

## 6. 性能与可访问性
<长列表虚拟化阈值 / 首屏预算 / 键盘与焦点 / 对比度档位 / 表单 label——数字引用 NFR 与 DESIGN §4，不写「差不多」>

## 7. 门禁与机检
<lint / typecheck / 单测 / E2E / 孤儿路由双向核对 / 组件清单核对；命令以 README 与前端工程化 §5 为准>

## 8. 维护
<规范与代码冲突以代码为准回填；大差异走 ADR + 棘轮；UI 框架 / token / 门禁版本 bump 时复核>
```
