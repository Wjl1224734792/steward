# dev-team · 软件开发团队（ZCode 插件）

一个角色化的软件开发团队插件：主对话代理担任 **Tech Lead**，接收软件需求后拆解成任务 DAG，按「依赖 + 文件所有权」串行/并行派发子智能体，全流程交付并贴真实测试输出。

## 团队名册（7 角色 + 外援）

| 角色 | 派发名 | 职责 |
|---|---|---|
| 需求分析师 | `dev-team:pm` | 模糊需求 → 可测规格（02-spec.md） |
| 方案设计师 | `dev-team:architect` | 规格 → 技术方案 + 任务 DAG（文件所有权 / 依赖） |
| 后端工程师 | `dev-team:backend-dev` | 按任务单 TDD 实施，只动白名单文件 |
| 前端工程师 | `dev-team:frontend-dev` | 实施 UI + 产出浏览器验收脚本 |
| 测试工程师 | `dev-team:qa-engineer` | 测试 / lint / typecheck 质量门，回派产品缺陷 |
| 浏览器验收员 | `dev-team:browser-tester` | 真实浏览器 GUI 黑盒验收，逐条判定 + 证据 |
| 代码评审员 | `dev-team:reviewer` | 交付前终审 diff，blocking / non-blocking / suggestion |
| （外援）Explore | 内置 `Explore` | L 级需求开工前的仓库勘察（00-context.md 共享地图） |

## 核心机制

- **六阶段流程**：受理定级（S/M/L）→（勘察）→ 方案 → 实施 → QA 质量门 → 浏览器验收 → 终审汇报。
- **串行/并行调度**：派发单位是任务不是角色名额，同类角色可多实例；并行条件 = 无依赖 且 文件所有权不相交；并行批撞并发上限自动回退串行（结果等价）。
- **检索工具栈**：全员继承宿主 tavily（搜索/深度研究）与 Context7（库文档查证，防凭记忆臆造 API），缺省退回 WebSearch。
- **工件交接**：`tmp/dev-team/<run-id>/` 下 00-context / 01-requirement / 02-spec / 03-plan / reports / final-report。
- **修复回派**：QA / 浏览器 / 评审发现的缺陷按归属回派原开发，循环上限 2 轮。

## 安装（本地目录方式）

1. 克隆本仓库到任意目录，例如 `E:\plugins\dev-team`。
2. 在**同级目录**建 `marketplace.json`（示例）：

   ```json
   {
     "name": "my-local-plugins",
     "plugins": [
       {
         "name": "dev-team",
         "source": "./dev-team",
         "version": "0.4.0",
         "displayName": "软件开发团队 Dev Team",
         "category": "developer-tools"
       }
     ]
   }
   ```

3. ZCode → 插件市场 → 添加 → 添加插件市场，粘贴 `marketplace.json` 所在目录。
4. 个人 → 你的市场名 → 软件开发团队 Dev Team → 安装。
5. 新建任务试用：「用软件开发团队完成：<需求描述>」或 `/dev-team <需求描述>`。

## 使用

```text
/dev-team 给 tmp/demo 写一个金额汇总脚本，带单测并跑绿
```

版本：0.4.0 · 许可：MIT
