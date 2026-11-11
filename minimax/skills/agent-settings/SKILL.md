---
name: agent-settings
description: 子代理模型与思考强度配置——读本机模型目录、展示 Steward 7 个子代理当前使用的模型与思考强度、按角色改模型/effort/fallback 并落盘（项目级 steward.config.json 与插件默认 frontmatter+名册表），提供可视化配置页与命令行两种入口。Use when the user asks which model or thinking effort a Steward subagent uses, wants to change a role's model/effort, or wants to open the subagent model configuration page.
---

<!-- 由 zcode/scripts/build.mjs 从 shared/ + host/minimax/ 生成，请勿手改；改源后重跑 build.mjs。 -->

# 子代理模型与思考强度配置

> 目标：让用户**看得见、改得动、验得了** 7 个子代理的模型与思考强度。所有写盘都带备份、校验与回滚；不手改生成物、不凭记忆写模型名。

## 你要做的

1. **先读目录**：跑 `node <插件>/scripts/agent-config.mjs catalog`（或直接读配置页返回的 catalog），拿到本机真实可用的模型，以及每个模型真正支持的档位集合。**不要凭记忆写模型名**——模型不存在会在派发时直接失败 `MODEL_SELECTION_INVALID`，不回退父模型。
2. **展示当前分配**：跑 `node <插件>/scripts/agent-config.mjs show`，输出「角色 / 生效模型 / 档位 / 来源（项目级覆盖 or 插件默认）/ 与插件默认是否不同」。
3. **改**：
   - 用户要「看着改」→ 打开配置页（见下节宿主入口），让用户在页面上选模型与档位并保存；页面会跑真实校验并回显原始输出。
   - 用户口述 → `node <插件>/scripts/agent-config.mjs set --role <role> --model <key> --effort <effort> [--scope project|plugin|both]`；脚本先校验再落盘。
4. **回报真实输出**：写入目标路径、校验命令与 exit code、原始输出。校验非 0 就是失败，不解释掉、不粉饰。

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

## 生效优先级（唯一事实链）

1. **用户当次指定**（这一轮明确说了用哪个模型/档位）——覆盖一切。
2. **项目级** `<项目根>/steward.config.json` 的 `modelRouting`——**下一次派单即生效**（你读 config，并显式传 `model` + `effort`）。
3. **插件默认** `host/minimax/agents/<role>.frontmatter.md` 的 `model` + `effort`——需 build + 安装，**新会话**才生效。

## 纪律

- **model 与 effort 必须成对传**：只传 model 会直接失败（`requires an explicit thinking effort`），不会自动取默认值。
- **effort 必须在该模型支持的档位集合内**：集合以本机模型配置的原文为准；档位名可能不规范（例如 `mediem`、`hign`）——照原文用，**不擅自"纠正"用户配置**，只做提示。
- **模型不可用不回退**：写入前必须校验模型存在，否则派发时才炸。
- **不手改生成物**：`minimax/` 与 `zcode/` 下的 agent/skill 是 build 产物；要改默认，改 `host/` 或 `shared/` 源再跑 build。
- **不绕过护栏手写 JSON**：脚本负责「校验 → 备份 → 写 → 校验 → 失败回滚」，你不要手改配置或 frontmatter。
- **不写密钥**：本机模型配置里有 apiKey/baseURL，只取模型名、档位与 limit，绝不回显凭据。

## 边界

- 本技能只管「模型与思考强度的配置与展示」，不改子代理的职责、提示词或工具集。
- ZCode 宿主没有子代理模型路由（沿用宿主默认模型），该宿主下本技能只做说明与指引。
