#!/usr/bin/env node
/**
 * dev-team · UserPromptSubmit 触发器
 *
 * 作用：用户输入里出现「开发团队 / 开发小组 / dev-team」意图时，向主代理注入
 * 「加载 dev-team 技能并按 Tech Lead 手册执行」的上下文，等价于 zcode 版插件的
 * `/dev-team <需求>` 斜杠命令。
 *
 * 契约：
 *  - 只在 UserPromptSubmit 事件生效；
 *  - 命中时输出一个 JSON 对象（hookSpecificOutput.additionalContext）；
 *  - 未命中时静默退出 0；
 *  - 任何异常都 fail open（退出 0、无 stdout），绝不阻断用户输入。
 */

const TRIGGERS = [/开发团队/, /开发小组/, /dev[\s_-]*team/i];

const CONTEXT = [
  '【开发团队模式已触发】用户本轮输入包含「开发团队」意图。',
  '请加载 `dev-team:dev-team` 技能（软件开发团队 · Tech Lead 手册）并严格按其执行：',
  '受理与定级 →（需求模糊时 pm）→ architect 出任务 DAG → 按依赖与文件所有权串行/并行派发',
  '`dev-team:*` 子智能体实施 → QA 质量门 →（有 UI 时）浏览器验收 → 评审员终审 → 汇报。',
  '',
  '若 `dev-team:*` 派发名不可用（插件未安装或被禁用），提示用户先安装 dev-team 插件。',
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

  const hit = TRIGGERS.some((pattern) => pattern.test(prompt));
  if (!hit) {
    process.exit(0);
  }

  emit({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: CONTEXT,
    },
  });
}

main().catch(() => {
  process.exit(0);
});
