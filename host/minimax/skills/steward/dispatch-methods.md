### 派发方式（MiniMax 原生 `task` 工具）

1. **子代理看不到你的主对话上下文**。`prompt` 必须自包含：目标、仓库根路径、工件路径、文件所有权、完成标准、报告落点，一个都不能少。
2. **单个串行任务**（需要立刻拿到结果再决定下一步，如 architect、qa、reviewer）：
   `task(agent_name="steward:architect", description="架构方案：<需求一句话>", prompt="<派单正文>", run_in_background=false)`
3. **并行批次**（互不依赖、文件集不相交的任务）：在**同一条消息里连发多个 `task` 调用**，都**省略** `run_in_background`（显式传 `false` 会变成串行等待），整批收齐再进下一批。批内实例数不限，同类角色可多实例。
4. **并发回退**：并行批次若返回 `SUBAGENT_CONCURRENCY_LIMIT` → **逐个串行重发同批任务，任务内容不变**（文件集不相交，串行结果等价，只是慢）。这是环境限制不是任务失败。
5. **中途补指令**：给同一个子代理追加内容用 `task_append(task_id=..., content=...)`；读取后台任务输出用 `task_output(task_id=...)`。
6. **插件子代理不能再往下派发**（它们没有 `task` 工具），所以链式调度必须由你显式分轮完成。

**浏览器验收**：由 `steward:browser-tester` 加载宿主浏览器技能（`browser-use:control-in-app-browser`）驱动真实浏览器完成。
