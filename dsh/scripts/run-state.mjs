#!/usr/bin/env node
/**
 * run-state.mjs — Steward run.json 状态机：DAG 派发进度、断点恢复、同错误 2 次即停。
 *
 * 子命令：
 *   init   --dir <run目录> --plan <03-plan.json>      由计划建 run.json（任务全 pending）
 *   status --dir <run目录>                            打印任务状态表
 *   next   --dir <run目录>                            列出就绪任务（依赖全部完成），无则 exit 1
 *   start  --dir <run目录> --task T1                  标记开始（未就绪则报错）
 *   done   --dir <run目录> --task T1 [--report 路径]  标记完成（依赖未完成则报错）
 *   fail   --dir <run目录> --task T1 --error "消息"   记录失败；同一任务同一错误签名连续 2 次 → run 置 stopped，exit 2
 *   resume --dir <run目录>                            中断后续跑：running 回收为 pending，输出就绪队列与停摆原因
 *
 * 退出码：0 = 正常；1 = 用法/状态冲突；2 = 触发同错误 2 次即停（死循环被拦住）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const MAX_SAME_ERROR = 2;

function die(code, msg) { console.error(`[run-state] ${msg}`); process.exit(code); }

function parseArgs(rest) {
  const out = { _: [] };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) out[rest[i].slice(2)] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
    else out._.push(rest[i]);
  }
  return out;
}

function loadRun(dir) {
  const p = join(dir, 'run.json');
  if (!existsSync(p)) die(1, `run.json 不存在：${p}（先执行 init）`);
  try {
    return { path: p, run: JSON.parse(readFileSync(p, 'utf8')) };
  } catch (e) {
    die(2, `run.json 损坏（${e.message}）：${p}`);
  }
}

function saveRun(path, run) {
  run.updatedAt = new Date().toISOString();
  writeFileSync(path, JSON.stringify(run, null, 2) + '\n', 'utf8');
}

// 归一化错误消息：数字/路径/引号差异视为同一错误，避免"每次消息略不同"绕过停机。
function errorSignature(msg) {
  const norm = String(msg)
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/[a-z]:[\\/][^\s"']+/g, '<path>')
    .replace(/\s+/g, ' ')
    .trim();
  return createHash('sha1').update(norm).digest('hex').slice(0, 12);
}

function depsSatisfied(run, task) {
  return (task.dependsOn ?? []).every((d) => run.tasks[d]?.status === 'done');
}

// --- dispatch table ---
const [cmd, ...rest] = process.argv.slice(2);
const a = parseArgs(rest);
const dir = a.dir ? resolve(a.dir) : null;
if (!cmd) die(1, '缺少子命令（init/status/next/start/done/fail/resume）');
if (cmd !== 'help' && !dir) die(1, '缺少 --dir <run目录>');
if (dir && !existsSync(dir) && cmd !== 'init') die(1, `目录不存在：${dir}`);

switch (cmd) {
  case 'init': {
    if (!a.plan) die(1, 'init 需要 --plan <03-plan.json>');
    const planPath = resolve(a.plan);
    if (!existsSync(planPath)) die(2, `计划文件不存在：${planPath}`);
    const plan = JSON.parse(readFileSync(planPath, 'utf8'));
    if (!Array.isArray(plan.tasks) || !plan.tasks.length) die(1, '计划中没有 tasks');
    const budgetAttempts = parseInt(a['budget-attempts'] ?? a['budgetAttempts'], 10);
    const tasks = {};
    for (const t of plan.tasks) {
      tasks[t.id] = {
        title: t.title ?? '',
        role: t.role ?? '',
        dependsOn: t.dependsOn ?? [],
        status: 'pending',
        attempts: 0,
        lastError: null,
        lastErrorSignature: null,
        report: null,
        startedAt: null,
        finishedAt: null,
      };
    }
    const run = {
      schemaVersion: 1,
      runId: dir.split(/[\\/]/).filter(Boolean).pop(),
      plan: resolve(a.plan),
      createdAt: new Date().toISOString(),
      status: 'running',
      stopReason: null,
      budget: Number.isInteger(budgetAttempts) && budgetAttempts > 0 ? { maxTotalAttempts: budgetAttempts, consumed: 0 } : null,
      tasks,
    };
    mkdirSync(dir, { recursive: true });
    const p = join(dir, 'run.json');
    if (existsSync(p)) die(1, `run.json 已存在，不覆盖：${p}（续跑用 resume）`);
    saveRun(p, run);
    console.log(`[run-state] run.json 已创建：${p}（${Object.keys(tasks).length} 个任务）`);
    break;
  }

  case 'status': {
    const { path, run } = loadRun(dir);
    console.log(`run ${run.runId} 状态=${run.status}${run.stopReason ? `（${run.stopReason}）` : ''}`);
    for (const [id, t] of Object.entries(run.tasks)) {
      const deps = (t.dependsOn ?? []).join(',') || '-';
      console.log(`  ${id.padEnd(6)} ${t.status.padEnd(8)} attempts=${t.attempts} deps=[${deps}] ${t.title}`);
    }
    saveRun(path, run); // 顺带刷新 updatedAt，无副作用
    break;
  }

  case 'next': {
    const { run } = loadRun(dir);
    if (run.status === 'stopped') die(1, `run 已停摆（${run.stopReason}），先处理原因再 resume`);
    const ready = Object.entries(run.tasks).filter(([id, t]) => t.status === 'pending' && depsSatisfied(run, t));
    if (!ready.length) {
      const pending = Object.entries(run.tasks).filter(([, t]) => t.status === 'pending').map(([id]) => id);
      if (!pending.length && Object.values(run.tasks).every((t) => t.status === 'done')) {
        console.log('[run-state] 所有任务已完成'); break;
      }
      console.error(`[run-state] 无就绪任务；未完成：${pending.join(', ') || '(无 pending)'}（依赖未满足或已失败）`);
      process.exit(1);
    }
    console.log(ready.map(([id]) => id).join(' '));
    break;
  }

  case 'start': {
    const { path, run } = loadRun(dir);
    const t = run.tasks[a.task];
    if (!t) die(1, `任务不存在：${a.task}`);
    if (run.status === 'stopped') die(1, `run 已停摆（${run.stopReason}），不能开始新任务`);
    if (t.status !== 'pending') die(1, `任务 ${a.task} 状态是 ${t.status}，只有 pending 可 start`);
    if (!depsSatisfied(run, t)) die(1, `任务 ${a.task} 依赖未完成：${(t.dependsOn ?? []).filter((d) => run.tasks[d]?.status !== 'done').join(', ')}`);
    t.status = 'running';
    t.startedAt = new Date().toISOString();
    saveRun(path, run);
    console.log(`[run-state] ${a.task} → running`);
    break;
  }

  case 'done': {
    const { path, run } = loadRun(dir);
    const t = run.tasks[a.task];
    if (!t) die(1, `任务不存在：${a.task}`);
    if (!depsSatisfied(run, t)) die(1, `任务 ${a.task} 依赖未完成，不能标记 done`);
    t.status = 'done';
    t.finishedAt = new Date().toISOString();
    if (a.report) t.report = resolve(a.report);
    const allDone = Object.values(run.tasks).every((x) => x.status === 'done');
    if (allDone) run.status = 'completed';
    saveRun(path, run);
    console.log(`[run-state] ${a.task} → done${allDone ? '（run 完成）' : ''}`);
    break;
  }

  case 'fail': {
    const { path, run } = loadRun(dir);
    const t = run.tasks[a.task];
    if (!t) die(1, `任务不存在：${a.task}`);
    if (!a.error) die(1, 'fail 需要 --error "<失败消息>"');
    const sig = errorSignature(a.error);
    t.attempts += 1;
    t.lastError = String(a.error).slice(0, 500);
    t.lastErrorSignature = sig;
    t.status = 'pending'; // 失败后回到 pending，等 Tech Lead 决定重试或改派
    if (a.report) t.report = resolve(a.report);
    // 连续同一错误：与上一次失败的签名比较（prevSignature）
    const stopped = t.prevSignature === sig && t.attempts >= MAX_SAME_ERROR;
    t.prevSignature = sig;
    if (stopped) {
      run.status = 'stopped';
      run.stopReason = `same-error-twice:${a.task}（签名 ${sig}，已连续失败 ${t.attempts} 次）`;
      saveRun(path, run);
      console.error(`[run-state] ✋ 同一错误连续 ${t.attempts} 次（任务 ${a.task}，签名 ${sig}）→ run 停摆，停止重试。`);
      console.error(`[run-state]   最近错误：${t.lastError}`);
      console.error('[run-state]   按纪律：停下向用户报告卡点与已试方案，不无限重试、不带病闯关。');
      process.exit(2);
    }
    if (run.budget) {
      run.budget.consumed += 1;
      if (run.budget.consumed >= run.budget.maxTotalAttempts) {
        run.status = 'stopped';
        run.stopReason = `budget-exhausted（失败重试 ${run.budget.consumed}/${run.budget.maxTotalAttempts} 次预算用尽）`;
        saveRun(path, run);
        console.error(`[run-state] ✋ 预算用尽（${run.budget.consumed}/${run.budget.maxTotalAttempts}）→ run 停摆。`);
        console.error('[run-state]   如实向用户报告花费与卡点；继续需显式提高预算或改方案。');
        process.exit(2);
      }
    }
    saveRun(path, run);
    console.log(`[run-state] ${a.task} 记录失败（第 ${t.attempts} 次，签名 ${sig}${run.budget ? `，预算 ${run.budget.consumed}/${run.budget.maxTotalAttempts}` : ''}），状态回 pending。同一签名连续 ${MAX_SAME_ERROR} 次将停摆。`);
    break;
  }

  case 'resume': {
    const { path, run } = loadRun(dir);
    if (run.status === 'completed') { console.log('[run-state] run 已完成，无需恢复'); break; }
    const recovered = [];
    for (const t of Object.values(run.tasks)) {
      if (t.status === 'running') { t.status = 'pending'; recovered.push(t); }
    }
    if (run.status === 'stopped') {
      console.log(`[run-state] 注意：run 曾停摆（${run.stopReason}）。恢复前必须先解决停摆原因（换方案/换派单），否则会在同一点再停。`);
      run.status = 'running';
      run.stopReason = null;
    }
    const ready = Object.entries(run.tasks).filter(([id, t]) => t.status === 'pending' && depsSatisfied(run, t)).map(([id]) => id);
    const failed = Object.entries(run.tasks).filter(([, t]) => t.attempts > 0 && t.status !== 'done').map(([id, t]) => `${id}(${t.attempts}次失败)`);
    saveRun(path, run);
    console.log(`[run-state] resume：回收 running→pending ${recovered.length} 个；就绪队列：${ready.join(' ') || '(空)'}`);
    if (failed.length) console.log(`[run-state] 有失败历史的任务：${failed.join(', ')}（重派时附上 lastError）`);
    break;
  }

  default:
    die(1, `未知子命令：${cmd}（可用：init/status/next/start/done/fail/resume）`);
}
