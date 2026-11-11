#!/usr/bin/env node
/**
 * Steward · UserPromptSubmit 触发器
 *
 * 作用（两类意图，按优先级判断）：
 *  1. 子代理模型/思考强度配置：用户输入里同时出现「子代理/子智能体/subagent/agent」与
 *     「模型/思考强度/档位/effort」时，注入「加载 steward:agent-settings 技能」的上下文。
 *     这一类**优先**于主技能触发——命中时只注入 agent-settings 上下文，不再注入主技能上下文。
 *  2. 开发团队：用户输入里出现「开发团队 / 开发小组 / Steward」时，向主代理注入
 *     「加载 Steward 技能并按 Tech Lead 手册执行」的上下文，等价于 zcode 版插件的
 *     `/steward <需求>` 斜杠命令。
 *
 * 契约：
 *  - 只在 UserPromptSubmit 事件生效；
 *  - 命中时输出一个 JSON 对象（hookSpecificOutput.additionalContext）；
 *  - 未命中时静默退出 0；
 *  - 任何异常都 fail open（退出 0、无 stdout），绝不阻断用户输入。
 */

/** 主技能触发：开发团队 / 开发小组 / Steward。 */
const MAIN_TRIGGERS = [/开发团队/, /开发小组/, /steward/i];

/**
 * 模型配置意图触发（v0.9.0）：需要「子代理词」与「模型/档位词」同时出现，
 * 避免把「这个功能要改哪个模型字段」「前端页面的模型切换」这类普通需求误判为配置意图。
 */
// 角色名也算「子代理词」：口语里常直接说「把 QA 的思考强度调高」而不带「子代理」三个字。
// 注意：工程师角色必须写全（后端工程师 / 前端工程师），裸「前端 / 后端」不算——
// 否则「前端页面的模型切换」这类普通前端需求会被误判成模型配置意图。
const AGENT_WORDS = [/子代理/, /子智能体/, /subagent/i, /\bagent\b/i, /QA|测试工程师/i, /评审员|架构师|需求分析师|浏览器验收/, /后端工程师|前端工程师/];
const MODEL_WORDS = [/模型/, /思考强度/, /档位/, /effort/i];

const AGENT_SETTINGS_CONTEXT = [
  '【子代理模型配置】用户本轮在问子代理的模型/思考强度。',
  '请加载 `steward:agent-settings` 技能（子代理模型与思考强度配置）并按其执行：',
  '读本机模型目录 → 展示当前分配与来源 → 需要可视化时打开配置页 → 校验后落盘 → 如实回报真实输出。',
].join('\n');

const MAIN_CONTEXT = [
  '【Steward 模式已触发】用户本轮输入包含「开发团队」意图。',
  '请加载 `steward:steward` 技能（Steward · Tech Lead 手册）并严格按其执行：',
  '受理与定级 →（需求模糊时 pm）→ architect 出任务 DAG → 按依赖与文件所有权串行/并行派发',
  '`steward:*` 子智能体实施 → QA 质量门 →（有 UI 时）浏览器验收 → 评审员终审 → 汇报。',
  '',
  '若用户本轮明确要求主代理直接执行 / 不派子代理，按主技能「执行模式」节判断 inline 是否允许（仅 S / B3 / 维护小修；M 需显式要求；L 与 B0/B1/B2 禁止）。',
  '若 `steward:*` 派发名不可用（插件未安装或被禁用），提示用户先安装 Steward 插件。',
  '若用户本轮意图明确不是要走开发团队流程，则忽略本提示，按常规处理即可。',
].join('\n');

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let data = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    // 兜底超时：宿主异常时不挂死。
    const timer = setTimeout(() => finish(data), 2000);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      finish(data);
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      finish(data);
    });
  });
}

function emit(payload) {
  const body = JSON.stringify(payload);
  process.stdout.write(body, () => process.exit(0));
}

/** 判定本轮输入应注入哪段上下文：模型配置优先，其次主技能；都不命中返回 null。 */
function pickContext(prompt) {
  const settingsHit =
    AGENT_WORDS.some((pattern) => pattern.test(prompt)) &&
    MODEL_WORDS.some((pattern) => pattern.test(prompt));
  if (settingsHit) return AGENT_SETTINGS_CONTEXT;
  if (MAIN_TRIGGERS.some((pattern) => pattern.test(prompt))) return MAIN_CONTEXT;
  return null;
}

async function main() {
  const raw = await readStdin();
  // 部分宿主/管道会给 stdin 加 UTF-8 BOM，解析前必须剥掉，否则 JSON.parse 直接失败。
  const text = raw.replace(/^\uFEFF+/, '').trim();
  if (!text) {
    process.exit(0);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    process.exit(0);
  }

  if (!payload || typeof payload !== 'object') {
    process.exit(0);
  }

  const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
  if (!prompt) {
    process.exit(0);
  }

  const context = pickContext(prompt);
  if (!context) {
    process.exit(0);
  }

  emit({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: context,
    },
  });
}

main().catch(() => {
  process.exit(0);
});
