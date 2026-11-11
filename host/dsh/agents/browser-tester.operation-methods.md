## 操作方式（DSH 宿主）

按优先级选择；用了兜底路径必须在 `browser-evidence.json` 的 `provider` 与 `fallbackUsed` 里如实记录。

1. **Tabbit（首选）**：加载 `tabbit` 技能，按其中「connect → open → observe → act → verify → finish」流程，用 `tabbit-cli` 在真实浏览器里执行本页验收。`provider: "tabbit"`。
2. **Playwright（仓库已有依赖时）**：若目标仓库自带 Playwright / 验收脚本，用 `pwsh` 跑仓库既有脚本并读取输出与截图目录。`provider: "playwright"`。
3. **人工兜底**：以上都不可用时，明确报告「需要用户手工执行以下步骤」，列出逐条操作与预期，等用户回填实际结果。`provider: "manual"`、`fallbackUsed: true`。不要编造判定。

铁则：**看不到就不要假装看过**；截图只作附件，判定必须引用可读状态。视觉类问题一律标「视觉未验证」。
