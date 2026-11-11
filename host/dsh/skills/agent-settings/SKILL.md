---
name: agent-settings
description: Steward 子代理模型与思考强度配置（DSH）。读宿主实时模型目录，展示 7 个角色当前使用的模型与思考强度及生效来源，按角色改模型/档位或设默认配置；提供「设置 → Steward」可视化配置页与 steward_config 工具两种入口。Use when the user asks which model or thinking effort a Steward subagent uses, wants to change a role's model/effort, or wants to open the subagent model configuration page.
---

# 子代理模型与思考强度配置（DSH）

> 目标：让用户**看得见、改得动、验得了** 7 个子代理的模型与思考强度。写入前先校验（模型存在、档位受支持），保存后**下一次派单即生效**，无需重启。

## 你要做的

1. **先看当前分配**：调用 `steward_config(action="list")`，拿到「角色 / 生效模型 / 思考强度 / 来源（角色配置 / 默认配置 / 继承主代理）」与本机可用模型目录。**不要凭记忆写模型名**——模型不存在或档位不受支持会在保存时被拒，派发时也会失败。
2. **展示**：把表格原样给用户（模型 + 档位 + 来源），不要美化或省略「继承主代理」。
3. **改**：
   - 用户要「看着改」→ 告诉用户打开 **设置 → Steward**（原生 Settings 页），在页面上选模型与档位并保存；页面会做真实校验并回显结果。
   - 用户口述 → 用 `steward_config(action="set", role="qa-engineer", provider="ctaigw", model="glm-5.3", effort="high")`；要设所有未单独配置角色的默认值就省略 `role`（写 `defaults`）。清空某角色用 `steward_config(action="reset", role="...")`。
4. **回报真实结果**：写入路径、校验错误原文、`steward_config` 返回的生效值。失败就是失败，不解释掉。

## 生效优先级（唯一事实链）

1. **用户当次指定**（本轮明确说用哪个模型/档位）——覆盖一切；派发时按用户指令，并提示这会覆盖配置。
2. **项目级** `<项目根>/steward.config.json` 的 `modelRouting.<role>`（`model: "provider/model"` + `effort`）——`steward_dispatch` 会自动读取并**下一次派单即生效**。
3. **角色配置**：DSH 原生 Settings 命名空间 `steward` 的 `roles.<role>`（设置页写入 profile 的 `cordis.patch.yml` 中 `- id: steward` 的 config；也可用 `steward_config` 写）——下一次派单即生效（`steward_dispatch` 自动套用）。
4. **默认配置** 同命名空间的 `defaults`——角色未单独配置时套用。
5. **继承主代理** 以上都没有时，子代理沿用主代理当前模型与档位。

## 纪律

- **provider / model 必须成对**：要么都填，要么都空（空 = 继承）；档位只在该模型真实支持的集合内选，留空表示用模型默认档位。
- **模型不可用不回退**：保存前必须用实时目录校验；未知模型直接拒绝。
- **不手改配置**：走原生设置页或 `steward_config`；不要手写 profile 的 `cordis.patch.yml`，也不要再找旧的 `~/.dsh/steward/subagent-config.json`（0.2.0 起已废弃）。
- **不写密钥**：只取模型名与档位，绝不回显任何 API key / baseURL。
- **作用域**：原生设置是 profile 级、跨项目生效；项目级覆盖走 `steward.config.json` 的 `modelRouting`（主技能「模型路由与预算」节）。

## 边界

- 本技能只管「模型与思考强度的配置与展示」，不改子代理的职责、提示词或工具集——角色的提示词与工具集属于 Agent Preset（`steward-<role>`）。
- DSH 的 `subagent` 内置工具仍可用；Steward 角色的模型配置只作用于 `steward_dispatch`。
