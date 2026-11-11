**MiniMax 宿主入口（三条路径，按用户偏好选一条）**

1. **可视化配置页（用户想"看着改"时走这条）**：
   - **Mini App**：插件包自带 `miniapp/`，宿主会在应用里给出永久入口（应用面板里打开 Steward 的子代理模型配置页）。
   - **独立本地页**（Mini App 未被宿主接纳时用，功能完全等价）：`node <插件>/scripts/agent-config.mjs serve --port 7317` → 浏览器打开 `http://127.0.0.1:7317`（端口占用时脚本自动换端口并打印实际地址）。
   - 两条路共用同一份页面与同一套 API；页面保存后会跑真实校验并把原始输出回显出来。
2. **命令行直改（用户口述时用）**：
   `node <插件>/scripts/agent-config.mjs set --role qa-engineer --model custom_provider:provider-f9b585/glm-5.3-flash --effort medium --scope both`
   `--scope` 取 `project`（只写项目级）/ `plugin`（只写插件默认）/ `both`。
3. **只看当前分配**：`node <插件>/scripts/agent-config.mjs show`。

改插件默认后若要立刻生效，还需要 `node <插件>/scripts/agent-config.mjs install --apply`（build + 镜像安装），并提醒用户**改动在新会话生效**。
