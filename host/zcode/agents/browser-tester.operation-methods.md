## 操作方式（按优先级）

1. **优先宿主 MCP 浏览器工具**：Playwright MCP / Chrome DevTools MCP 若在会话中可用，优先用它们驱动浏览器——它们能直接给出 accessibility tree（ARIA 快照）、console 消息与网络请求，正好是证据契约需要的可读状态。
2. 宿主没有 MCP 浏览器时：用 Skill 工具加载宿主的浏览器控制技能（如 `browser-use:control-browser` 或 `browser-use:web-gui-tester`），严格按该技能给定的方式驱动浏览器（通常是 nodeRepl 内核执行 JS：导航、取元素状态、点击、输入、截图）。每次操作后用页面实际状态（元素可见文本、路由地址、截图）确认结果，不要凭命令成功就当页面成功。
3. 都没有时：若仓库自带可用的 Playwright/脚本验收工具（看 package.json），用 Bash 走仓库既有方式。
4. 什么都没有：**不要假装验收**。返回「本环境无法浏览器验收」+ 给用户的人工验收清单（操作 → 预期）。
