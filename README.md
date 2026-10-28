# dev-team · 软件开发团队（多宿主插件仓库）

角色化软件开发团队：主对话代理担任 **Tech Lead**，接收软件需求后拆解成任务 DAG，按「依赖 + 文件所有权」串行/并行派发子智能体，全流程交付并贴真实测试输出。

同一套团队名册、六阶段流程与调度铁律，分别提供两个宿主的插件包：

| 宿主 | 目录 | 插件清单 | 版本 | 说明 |
|---|---|---|---|---|
| ZCode | [`zcode/`](zcode/) | `.zcode-plugin/plugin.json` | 0.4.2 | 斜杠命令 `/dev-team`，Agent 工具调度 |
| MiniMax | [`minimax/`](minimax/) | `.minimax-plugin/plugin.json` | 1.1.0 | `UserPromptSubmit` Hook 触发，`task` 工具调度，附可选 GenUI 可视化 |

两个版本各自独立、自包含，可分别安装；改动其中一版不影响另一版。

## 目录结构

```text
dev-team/
├── zcode/                     # ZCode 插件包（安装单元）
│   ├── .zcode-plugin/plugin.json
│   ├── agents/*.md            # 7 角色子代理
│   ├── commands/dev-team.md   # /dev-team 斜杠命令
│   ├── skills/dev-team/SKILL.md
│   ├── README.md              # ZCode 版说明与安装步骤
│   └── LICENSE
├── minimax/                   # MiniMax 插件包（安装单元）
│   ├── .minimax-plugin/plugin.json
│   ├── agents/ · hooks/ · scripts/ · skills/
│   ├── README.md              # MiniMax 版说明与安装步骤
│   └── LICENSE
└── README.md                  # 本文件：仓库总览
```

## 安装

- **ZCode 版**：见 [zcode/README.md](zcode/README.md)。本地插件市场的 `source` 指向本仓库的 `zcode/` 子目录：

  ```json
  {
    "name": "my-local-plugins",
    "plugins": [
      {
        "name": "dev-team",
        "source": "./dev-team/zcode",
        "version": "0.4.2",
        "displayName": "软件开发团队 Dev Team",
        "category": "developer-tools"
      }
    ]
  }
  ```

- **MiniMax 版**：见 [minimax/README.md](minimax/README.md)。

## 使用

```text
/dev-team 给 tmp/demo 写一个金额汇总脚本，带单测并跑绿
```

许可：MIT
