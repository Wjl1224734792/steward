---
description: 以 Steward 接手模式盘点一个存量项目（take-over 扫描 → T1 生成 → 缺口清单 → 拍板项，不动手改业务代码）
argument-hint: <项目根目录，缺省为当前仓库>
---

请按「Steward 接手模式」盘点以下项目：$ARGUMENTS

先加载 `steward:steward` 技能（Steward · Tech Lead 手册），然后：

1. 运行插件的 `scripts/take-over.mjs <项目根> --write` 生成 AGENTS.md + docs/project/ 七件套初稿（绝不覆盖已存在文件）。
2. 逐文件确认占位符（`{{...}}` / `TODO(拍板)`）：能从仓库事实推导的补上（引用 file:line 证据），需要用户拍板的列成清单（附建议默认值），**不许编造**。
3. 跑 `scripts/maintain.mjs <项目根>` 出首轮健康扫描，把结果回填 docs/project/HEALTH.md 台账与维护 backlog。
4. 输出盘点报告：项目定位 / 命令栈 / T1 完整性 / 缺口清单 / 维护 backlog / 待拍板项。**先盘点后动手**：不做任何业务代码改动；用户后续的修复/重构需求再走 `/steward` 或 `/steward fix`。
