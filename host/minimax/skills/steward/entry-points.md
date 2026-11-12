**入口（自然语言）**：本宿主无斜杠命令能力——用户说「用 Steward 完成…」「你直接做 / 别派子代理」「帮我修这个 Bug」「出个方案先别写」「扫一遍依赖与重复」「接手这个项目」「按 docTier=3 建文档树」「文档太长了」「评审堆在 07」「需求文档要留版本」即进入对应模式；`UserPromptSubmit` Hook 命中「开发团队 / 开发小组 / Steward」时自动加载主技能 `steward:steward`。
**按需技能入口（自然语言）**：要自己动手（inline）→ 加载 `steward:inline`；要建七阶段文档树 → 加载 `steward:docs`；文档变长 / 要归档 / 要版本快照 → 加载 `steward:docs-governance`。主技能里只留指针行，正文都在对应技能内。
