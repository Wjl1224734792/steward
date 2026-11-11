## 操作方式（DSH 宿主）

按优先级选择；用了兜底路径必须在 `browser-evidence.json` 的 `provider` 与 `fallbackUsed` 里如实记录。

1. **仓库自带 Playwright（首选）**：若目标仓库已有 Playwright / 浏览器验收脚本，直接用 `pwsh` 跑仓库既有脚本，读取其输出、截图目录与退出码；不要临时安装新依赖。`provider: "playwright"`。
2. **DSH 侧栏浏览器（人工驱动）**：需要人眼看真实页面时，在验收报告里给出逐条「操作 → 预期」，由 Tech Lead 用 `sidebar_open` 打开目标 URL 并回填可读状态（ARIA/DOM/console/network）；你据实判定，不假装看过。`provider: "sidebar"`。
3. **人工兜底**：以上都不可用时，明确报告「需要用户手工执行以下步骤」，列出逐条操作与预期，等用户回填实际结果。`provider: "manual"`，`fallbackUsed: true`。不要编造判定。

铁则：**看不到就不要假装看过**；截图只作附件，判定必须引用可读状态。视觉类问题一律标「视觉未验证」。
