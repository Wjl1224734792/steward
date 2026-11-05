# Steward · ZCode 插件

角色化研发团队插件：主对话代理担任 **Tech Lead**，把需求拆成任务 DAG，按「依赖 + 文件所有权」串行/并行派发子智能体。当前版本覆盖功能交付；Bug 修复、维护循环、接手存量项目见 [路线图](../docs/ROADMAP.md)。

> A role-based engineering team plugin for ZCode. The current release covers feature delivery; bug fixing, maintenance, and takeover are on the roadmap.

## 团队名册（7 角色 + 外援）

| 角色 | 派发名 | 职责 |
|---|---|---|
| 需求分析师 | `steward:pm` | 模糊需求 → 可测规格（02-spec.md） |
| 方案设计师 | `steward:architect` | 规格 → 技术方案 + 任务 DAG（文件所有权 / 依赖） |
| 后端工程师 | `steward:backend-dev` | 按任务单 TDD 实施，只动白名单文件 |
| 前端工程师 | `steward:frontend-dev` | 实施 UI + 产出浏览器验收脚本 |
| 测试工程师 | `steward:qa-engineer` | 测试 / lint / typecheck 质量门，回派产品缺陷 |
| 浏览器验收员 | `steward:browser-tester` | 真实浏览器 GUI 黑盒验收，逐条判定 + 证据 |
| 代码评审员 | `steward:reviewer` | 交付前终审 diff，blocking / non-blocking / suggestion |
| （外援）Explore | 内置 `Explore` | L 级需求开工前的仓库勘察（00-context.md 共享地图） |

## 核心机制

- **六阶段流程**：受理定级（S/M/L）→（勘察）→ 方案 → 实施 → QA 质量门 → 浏览器验收 → 终审汇报。
- **串行/并行调度**：派发单位是任务不是角色名额，同类角色可多实例；并行条件 = 无依赖 且 文件所有权不相交；并行批撞并发上限自动回退串行。
- **检索工具栈**：全员继承宿主 tavily（搜索/深度研究）与 Context7（库文档查证），缺省退回 WebSearch。
- **工件交接**：`tmp/steward/<run-id>/` 下 00-context / 01-requirement / 02-spec / 03-plan / reports / final-report。
- **修复回派**：QA / 浏览器 / 评审发现的缺陷按归属回派原开发，循环上限 2 轮。

## 安装（本地目录方式）

1. 克隆仓库到任意目录（例如 `steward/`；本插件包位于仓库的 `zcode/` 子目录）。
2. 在**同级目录**建 `marketplace.json`（示例）：

   ```json
   {
     "name": "my-local-plugins",
     "plugins": [
       {
         "name": "steward",
         "source": "./steward/zcode",
         "version": "0.4.3",
         "displayName": "Steward · 长期维护型研发团队",
         "category": "developer-tools"
       }
     ]
   }
   ```

3. ZCode → 插件市场 → 添加 → 添加插件市场，粘贴 `marketplace.json` 所在目录。
4. 个人 → 你的市场名 → Steward → 安装。
5. 新建任务试用：`/steward <需求描述>`。

## 使用

```text
/steward 给 tmp/demo 写一个金额汇总脚本，带单测并跑绿
```

## English

Steward is a role-based engineering team plugin for ZCode. The lead agent acts as Tech Lead, decomposes work into a task DAG with file ownership, and dispatches PM / architect / backend & frontend devs / QA / browser tester / reviewer subagents. The current release covers feature delivery; bug fixing, maintenance, and takeover are on the roadmap.

Roster: `steward:pm`, `steward:architect`, `steward:backend-dev`, `steward:frontend-dev`, `steward:qa-engineer`, `steward:browser-tester`, `steward:reviewer`.

Usage:

```text
/steward Write a money-summary script in tmp/demo, with unit tests and a green run.
```

Version: 0.4.3 · License: MIT
