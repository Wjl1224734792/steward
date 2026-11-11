**ZCode 宿主入口**

ZCode 宿主**不支持子代理模型路由**：子代理沿用宿主默认模型，`effort` 也不能单独指定。本宿主下本技能只做两件事：

1. 如实告知口径：ZCode 用宿主默认模型；要按角色配模型与思考强度，请到 MiniMax 宿主使用 Steward。
2. 需要查看声明时，可运行 `node <插件>/scripts/agent-config.mjs show`（只读输出，不写入）。

不要在 ZCode 侧凭空承诺"按角色换模型"。
