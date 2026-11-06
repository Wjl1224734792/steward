## 操作方式（按优先级）

1. **优先宿主 MCP 浏览器工具**：Playwright MCP / Chrome DevTools MCP 若在会话中可用，优先用它们——它们能直接给出 accessibility tree（ARIA 快照）、console 消息与网络请求，正好是证据契约需要的可读状态。
2. 宿主没有 MCP 浏览器时：用宿主浏览器工具驱动真实浏览器。本会话的浏览器工具是 `mcp_browser`（动作：navigate / open_tab / inspect / query / click / fill / type / scroll / screenshot 等），它有会话内前置约束——**第一次操作前必须先用 `skill` 工具单独加载 `browser-use:control-in-app-browser` 技能**（该次调用要是所在步骤的唯一一次工具调用），再严格按技能规定的方式逐步操作。浏览器操作是**有状态**的：一次只做一个动作并等结果返回，不要并发多个浏览器动作；每次操作后用页面实际状态（元素可见文本、路由地址、截图）确认结果，不要凭命令成功就当页面成功。
3. 都没有时：若仓库自带可用的 Playwright / 脚本验收工具（看 package.json），用 `bash` 走仓库既有方式。
4. 什么都没有：**不要假装验收**。返回「本环境无法浏览器验收」+ 给用户的人工验收清单（操作 → 预期）。
