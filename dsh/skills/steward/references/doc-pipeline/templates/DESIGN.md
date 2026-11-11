<!-- 来源：eng-doc-pipeline templates.md（2026-10-28 快照）；Steward 适配见 ../PROVENANCE.md -->

<!-- 模板：DESIGN.md -->

## DESIGN.md 模板（`.agents/designs/`，视觉唯一权威）

> 触发：有界面的项目必有。token/主题/布局框架只有这一个权威，页面文档与代码**引用不复制**；多主题参考稿放 `.agents/designs/theme/`，与 DESIGN.md 同一批变更改。主权收敛到主题 Provider（如 antd ConfigProvider token），禁全局组件类覆盖、禁第二套色板。

```markdown
# DESIGN.md — <项目> 视觉规范（<主题模型一句话>）
> 头部字段表：文档性质 ｜ 产品 ｜ 版本（主题/布局框架冻结口径标注 + 谁拍板）｜ 位置 ｜ 主题参考稿 ｜ 上游（PRD 设计原则与角色 · 页面设计 IA）｜ 下游（前端实现 · 页面详设 · 前端层级规范条款）｜ 约束（主权 = Provider token；禁全局覆盖；禁第二套色板）

## 1. Objective（一句话产品气质；主题只是皮肤——可读性与语义不随主题变）
## 2. Product Context（What / Who（PRD 角色表锚点）/ Surfaces（各端+特殊人群）/ 相邻气质与 distant brand 反例）
## 3. Visual Foundations
### 3a. 主题模型（几套主题、默认哪套、拍板记录）
### 3b. Color（语义色只表状态；数据面实底；各主题色值速查表）
### 3c. Typography（字号阶梯/行高；金额数字等宽可对账）
### 3d. Spacing / 圆角 / 动效 / 可读性
### 3e. 密度与选中态（冻结口径标注）
### 3f. 特殊人群层（适老化等：字号/控件高/对比度/图形化——有则留）
### 3g. 布局框架 Shell（骨架/滚动主权/标签条/面包屑——**冻结节**，IA 与详设引用不复制）
### 3h. 关联变更（token 改动牵动面）
## 4. Accessibility（对比度/键盘/焦点底线，对应法规或 WCAG 档位）
## 5. Voice & Tone（文案语气；错误文案可操作原则）
## 6. Implementation Practices（6.1 主权与 Provider 落位示意 / 6.2 选型与前端工程化一致 / 6.3 布局实现）
## 7. Anti-Patterns（禁清单：与 Objective/2 的 distant brand 对应）
## 8. Decision-Making（取舍决策树/优先级）
## 9. Workflow（视觉改动流程：提案 → 拍板 → token/主题稿同一批变更改 → 页面文档引用核对）
## 附录：各主题速查 + 文档分工表（DESIGN.md vs 页面设计 vs 详设的边界）+ 变更记录
```
