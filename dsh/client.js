window.__ModuleLoader__.load({
  id: 'dsh-steward',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    /** Native DSH settings namespace owned by this plugin (the Loader row id). */
    const NS = 'steward';
    /** Right-Sidebar tab type: `id` keys the body/title slots, `kind` is what openTab() names. */
    const TAB_ID = 'dsh-steward';
    const TAB_KIND = 'steward';
    const FIELDS = ['provider', 'model', 'effort'];
    /** Workspace-relative roots a Steward run can live at (skill contract, in this order). */
    const RUN_ROOTS = ['tmp/steward', '.steward'];
    /** Re-read cadence while the panel is mounted; cheap (two listings + one read). */
    const RUN_POLL_MS = 4000;
    const MAX_RUN_DIRS = 3;
    const MAX_ARTIFACTS = 24;
    const MAX_TODO_TASKS = 30;

    const ROLES = [
      { id: 'pm', zh: '需求分析师', en: 'Requirements analyst', zhDesc: '模糊需求 → 可执行、可验收的规格', enDesc: 'Turns a vague request into a testable spec' },
      { id: 'architect', zh: '架构师', en: 'Architect', zhDesc: '规格 → 影响面 + 技术方案 + 任务 DAG', enDesc: 'Maps a spec to impact, a technical plan and a task DAG' },
      { id: 'backend-dev', zh: '后端工程师', en: 'Backend engineer', zhDesc: '按任务单做后端实现（TDD，限文件所有权）', enDesc: 'Implements backend tasks test-first within file ownership' },
      { id: 'frontend-dev', zh: '前端工程师', en: 'Frontend engineer', zhDesc: 'UI 实现 + 可执行的浏览器验收脚本', enDesc: 'Implements UI plus a runnable browser acceptance script' },
      { id: 'qa-engineer', zh: '测试工程师', en: 'QA engineer', zhDesc: '独立复跑质量门禁、补测试、反作弊检查', enDesc: 'Re-runs quality gates independently and extends tests' },
      { id: 'browser-tester', zh: '浏览器验收员', en: 'Browser tester', zhDesc: '真实浏览器黑盒验收 + browser-evidence.json', enDesc: 'Runs black-box browser acceptance and records evidence' },
      { id: 'reviewer', zh: '代码评审员', en: 'Code reviewer', zhDesc: '终审 diff（或在干净上下文做 Plan Critic）', enDesc: 'Final diff review, or Plan Critic in a clean context' },
    ];
    const ROLE_IDS = ROLES.map((role) => role.id);

    const STRINGS = {
      zh: {
        nav: 'Steward',
        tabTitle: 'Steward 看板',
        title: 'Steward 运行看板',
        subtitle: '这个会话的 run 进度：任务 DAG、子代理实时状态、落盘产物。',
        openPanel: '打开 Steward 看板',
        refresh: '刷新',
        sourceBoard: '共享任务板',
        sourceRun: 'run.json',
        sourceTodo: '待办清单',
        sourceNone: '暂无任务来源',
        sourceHint: '任务来源：{source}',
        leadNode: 'Lead（本会话）',
        todoNode: '待办',
        dispatchEdge: '派发',
        tasksSection: '任务',
        tasksEmptyTitle: '还没有任务',
        tasksEmpty: '让 Lead 用 steward_board 把 03-plan.json 建成任务板，或先跑 run-state.mjs init；这里会实时显示 DAG 与状态。',
        tasksTodoHint: '任务来自 todo_write 的待办清单；Steward 建板或生成 run.json 后会自动切到任务板。',
        tasksRunHint: '任务来自本次 run 的 03-plan.json + run.json。',
        tasksBoardHint: '任务来自 Agent Teams 共享任务板。',
        subagentsTitle: '子代理',
        subagentsEmpty: '这个会话还没有派发子代理。',
        subagentsHint: '点一行打开它的子会话（右侧栏）。',
        artifactsTitle: '产物',
        artifactsEmpty: '在 tmp/steward/<run>/ 下还没有找到产物。',
        artifactsHint: '点一行在右侧栏打开文件。',
        artifactsMissing: '宿主没有提供工作区文件服务，读不到产物。',
        artifactsRun: '运行目录',
        emptyTitle: '这个会话还没有 Steward 运行',
        emptyBody: 'Lead 用 steward_dispatch 派一个角色、或用 steward_board 建板之后，这里会自动显示任务图、子代理状态与产物。',
        emptySteps: [
          '让 Lead 用 steward_dispatch(role=..., description=..., prompt=...) 派单。',
          '或用 steward_board 把 03-plan.json 同步成共享任务板。',
          '看板会自动打开；也可以点会话标题栏的 Steward 图标。',
        ],
        statusRunning: '运行中',
        statusInactive: '空闲',
        statePending: '待开始',
        stateReady: '可开始',
        stateProgress: '进行中',
        stateDone: '完成',
        stateBlocked: '阻塞',
        runRunning: '运行中',
        runCompleted: '已完成',
        runStopped: '已停摆',
        attempts: '尝试 {n} 次',
        failed: '失败',
        openSession: '打开会话',
        openHint: '点击打开它的子会话',
        openOwner: '打开负责人会话',
        openFile: '打开文件',
        owner: '负责人',
        deps: '依赖',
        scope: '写入范围',
        overlap: '文件重叠',
        viewDag: '依赖图',
        viewList: '列表',
        viewMatrix: '归属',
        viewGroup: '视图',
        tasksCount: '{tasks} 个任务 · {edges} 条依赖',
        progressAria: '进度：完成 {done}/{total}',
        graphAria: '依赖图：{nodes} 个任务，{edges} 条依赖',
        graphKeys: '键盘：Tab 进入图，方向键在任务之间移动，Enter 看详情，Esc 取消选中。',
        graphEmpty: '还没有任务。',
        graphCycle: '检测到环状依赖（{ids}），已改用列表视图——请修正 dependsOn/blockedBy。',
        matrixEmpty: '任务还没有写入范围（files / writeScopes），无法生成归属矩阵。',
        matrixCaption: '文件 × 代理归属矩阵：每行一个写入路径，每列一个代理。',
        matrixFile: '文件',
        matrixFileUnit: '文件',
        matrixOverlap: '重叠',
        matrixOverlapMark: '重叠',
        matrixUnassigned: '未指派',
        matrixMore: '还有 {n} 个文件未显示',
        detailTitle: '任务详情',
        detailHint: '点任务看详情',
        detailClose: '关闭详情',
        depMissing: '依赖 {ids}（不在板上）',
        sectionFailed: '这一段渲染失败（其余部分仍然可用）',
        configTitle: '子代理模型与思考强度',
        configSub: '设置页按角色指定模型；没配的角色用默认，默认也没配就继承主代理。项目根 steward.config.json 的 modelRouting 对该角色优先。',
        defaultsTitle: '默认（兜底）',
        defaultsSub: '没有单独配置的角色使用这里的模型与档位。',
        rolesTitle: '角色',
        colRole: '角色',
        colSource: '来源',
        inherit: '继承主代理',
        modelDefault: '模型默认',
        pickProvider: '先选提供方',
        save: '保存',
        saving: '保存中…',
        discard: '撤销',
        refreshCatalog: '刷新模型目录',
        saved: '已保存，下一次派发立即生效。',
        unsaved: '有未保存修改',
        synced: '已同步',
        clearRole: '清空',
        sourceRole: '自定义',
        sourceDefaults: '默认',
        sourceInherit: '继承主代理',
        loading: '正在读取原生设置服务…',
        loadFailed: '读取失败',
        retry: '重试',
        notAvailable: '不可用',
        catalogEmpty: '模型目录为空',
        providerLabel: '提供方',
        modelLabel: '模型',
        effortLabel: '思考强度',
        missingSelection: '当前记录的模型不在实时目录中，请重新选择',
        saveFailed: '保存失败',
        unavailableNs: '宿主没有提供 steward 设置命名空间（请确认 Steward 插件行已启用）。',
        readOnly: '本部署的设置为只读。',
        conflict: '设置已在其他位置更新，请撤销后重试。',
        invalidRoute: '每个角色要么同时选提供方与模型，要么两者都留空（继承主代理）。',
        externalUpdate: '设置已在其他位置更新；撤销后会载入新值。',
      },
      en: {
        nav: 'Steward',
        tabTitle: 'Steward board',
        title: 'Steward run board',
        subtitle: 'Progress of this session\'s run: task DAG, live subagents, files on disk.',
        openPanel: 'Open the Steward board',
        refresh: 'Refresh',
        sourceBoard: 'Shared board',
        sourceRun: 'run.json',
        sourceTodo: 'Todo list',
        sourceNone: 'No task source yet',
        sourceHint: 'Task source: {source}',
        leadNode: 'Lead (this session)',
        todoNode: 'Todo',
        dispatchEdge: 'Dispatch',
        tasksSection: 'Tasks',
        tasksEmptyTitle: 'No tasks yet',
        tasksEmpty: 'Have the lead mirror 03-plan.json onto the board with steward_board, or run run-state.mjs init; the DAG and statuses then appear here live.',
        tasksTodoHint: 'Tasks come from the todo_write list; once a board or run.json exists, the panel switches to it.',
        tasksRunHint: 'Tasks come from this run\'s 03-plan.json + run.json.',
        tasksBoardHint: 'Tasks come from the Agent Teams shared board.',
        subagentsTitle: 'Subagents',
        subagentsEmpty: 'No subagent dispatched in this session yet.',
        subagentsHint: 'Click a row to open its child session in the right sidebar.',
        artifactsTitle: 'Artifacts',
        artifactsEmpty: 'No artifacts under tmp/steward/<run>/ yet.',
        artifactsHint: 'Click a row to open the file in the right sidebar.',
        artifactsMissing: 'The host serves no workspace files, so artifacts are unavailable.',
        artifactsRun: 'Run directory',
        emptyTitle: 'No Steward run in this session yet',
        emptyBody: 'Once the lead dispatches a role with steward_dispatch or builds the board with steward_board, the task graph, subagent statuses and artifacts appear here automatically.',
        emptySteps: [
          'Have the lead call steward_dispatch(role=..., description=..., prompt=...).',
          'Or mirror 03-plan.json onto the shared board with steward_board.',
          'The board opens by itself; the Steward icon in the session header opens it too.',
        ],
        statusRunning: 'running',
        statusInactive: 'idle',
        statePending: 'pending',
        stateReady: 'ready',
        stateProgress: 'in progress',
        stateDone: 'done',
        stateBlocked: 'blocked',
        runRunning: 'running',
        runCompleted: 'completed',
        runStopped: 'stopped',
        attempts: '{n} attempt(s)',
        failed: 'failed',
        openSession: 'Open session',
        openHint: 'Click to open the child session',
        openOwner: "Open the owner's session",
        openFile: 'Open file',
        owner: 'Owner',
        deps: 'Depends on',
        scope: 'Write scope',
        overlap: 'File overlap',
        viewDag: 'Graph',
        viewList: 'List',
        viewMatrix: 'Ownership',
        viewGroup: 'View',
        tasksCount: '{tasks} tasks · {edges} dependencies',
        progressAria: 'Progress: {done} of {total} done',
        graphAria: 'Dependency graph: {nodes} tasks, {edges} dependencies',
        graphKeys: 'Keyboard: Tab enters the graph, arrow keys move between tasks, Enter opens the detail, Escape clears the selection.',
        graphEmpty: 'No tasks yet.',
        graphCycle: 'Cyclic dependency detected ({ids}); the list view is shown instead — fix dependsOn/blockedBy.',
        matrixEmpty: 'No write scopes yet (files / writeScopes), so there is nothing to plot.',
        matrixCaption: 'File by agent ownership: one row per write path, one column per agent.',
        matrixFile: 'File',
        matrixFileUnit: 'files',
        matrixOverlap: 'Overlap',
        matrixOverlapMark: 'overlap',
        matrixUnassigned: 'Unassigned',
        matrixMore: '{n} more files not shown',
        detailTitle: 'Task detail',
        detailHint: 'Select a task to see details',
        detailClose: 'Close details',
        depMissing: 'Depends on {ids} (not on the board)',
        sectionFailed: 'This section failed to render (the rest still works)',
        configTitle: 'Subagent models and reasoning effort',
        configSub: 'Pick a model per role in Settings; roles without a selection use the defaults, and without defaults they inherit the parent. A modelRouting entry in the project steward.config.json still wins.',
        defaultsTitle: 'Defaults',
        defaultsSub: 'Roles without their own selection use this model and effort.',
        rolesTitle: 'Roles',
        colRole: 'Role',
        colSource: 'Source',
        inherit: 'Inherit parent',
        modelDefault: 'Model default',
        pickProvider: 'Pick a provider first',
        save: 'Save',
        saving: 'Saving…',
        discard: 'Discard',
        refreshCatalog: 'Refresh catalog',
        saved: 'Saved. The next dispatch uses it.',
        unsaved: 'Unsaved changes',
        synced: 'In sync',
        clearRole: 'Clear',
        sourceRole: 'Custom',
        sourceDefaults: 'Defaults',
        sourceInherit: 'Inherit parent',
        loading: 'Reading the native settings service…',
        loadFailed: 'Load failed',
        retry: 'Retry',
        notAvailable: 'unavailable',
        catalogEmpty: 'The model catalog is empty',
        providerLabel: 'Provider',
        modelLabel: 'Model',
        effortLabel: 'Reasoning effort',
        missingSelection: 'The recorded model is not in the live catalog; pick it again',
        saveFailed: 'Save failed',
        unavailableNs: 'The host does not serve the steward settings namespace (check that the Steward plugin row is enabled).',
        readOnly: 'This deployment stores settings read-only.',
        conflict: 'Settings changed elsewhere. Discard and try again.',
        invalidRoute: 'Each role needs both a provider and a model, or neither (inherit the parent).',
        externalUpdate: 'Settings changed elsewhere; discard to load the new values.',
      },
    };

    function pickLang(ctx) {
      try {
        const snapshot = ctx && ctx.locale && typeof ctx.locale.getLocale === 'function' ? ctx.locale.getLocale() : null;
        const id = snapshot && (snapshot.id || snapshot.locale || snapshot.lang || snapshot.current);
        if (typeof id === 'string' && id !== '') return id.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
      } catch {
        // fall through to the browser language
      }
      const fromBrowser = typeof navigator !== 'undefined' && typeof navigator.language === 'string' ? navigator.language : '';
      return fromBrowser.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
    }

    function fmt(template, values) {
      let out = String(template);
      for (const key of Object.keys(values || {})) out = out.split('{' + key + '}').join(String(values[key]));
      return out;
    }

    function round1(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return 0;
      return Math.round(number * 10) / 10;
    }

    function shortId(value) {
      if (typeof value !== 'string' || value === '') return '—';
      const stripped = value.indexOf('session-') === 0 ? value.slice('session-'.length) : value;
      if (stripped === '') return '—';
      return stripped.length > 12 ? stripped.slice(0, 12) : stripped;
    }

    function initialsOf(name) {
      const value = typeof name === 'string' ? name.trim() : '';
      if (value === '') return '·';
      const parts = value.split(/[-_\s.]+/).filter((part) => part !== '');
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }

    // --- task model ----------------------------------------------------------------

    function taskTitle(task) {
      if (task && typeof task.subject === 'string' && task.subject !== '') return task.subject;
      if (task && typeof task.title === 'string' && task.title !== '') return task.title;
      if (task && task.id !== undefined && task.id !== null) return String(task.id);
      return '';
    }

    function taskKey(task) {
      if (!task) return '';
      if (task.id !== undefined && task.id !== null) return String(task.id);
      return '';
    }

    /** `G1 · 计划批准` → `计划批准`; the id keeps its own chip. */
    function stripIdPrefix(title) {
      const text = typeof title === 'string' ? title : '';
      const match = /^[A-Za-z]*\d+\s*[·:：-]\s*/.exec(text);
      return match ? text.slice(match[0].length) : text;
    }

    const GATE_ID = /^g\d+$/i;

    /** Gates (G1/G2/G3) drive the phase rail; everything else is a work item. */
    function isGateTask(task) {
      if (!task) return false;
      const id = taskKey(task);
      if (GATE_ID.test(id)) return true;
      return /^G\d+\b/.test(taskTitle(task));
    }

    function taskState(task) {
      if (!task) return 'pending';
      if (task.status === 'completed') return 'done';
      if (task.status === 'in_progress') return 'progress';
      if (task.ready === false) return 'blocked';
      if (task.ready === true) return 'ready';
      return 'pending';
    }

    function stateLabel(text, state) {
      if (state === 'done') return text.stateDone;
      if (state === 'progress') return text.stateProgress;
      if (state === 'blocked') return text.stateBlocked;
      if (state === 'ready') return text.stateReady;
      return text.statePending;
    }

    function stateDotTone(state) {
      if (state === 'done') return 'done';
      if (state === 'progress') return 'progress';
      if (state === 'blocked') return 'warn';
      return 'idle';
    }

    function pillToneOf(state) {
      if (state === 'done') return 'done';
      if (state === 'progress') return 'progress';
      if (state === 'blocked') return 'warn';
      return 'idle';
    }

    function dependencyIds(task, known) {
      const blockedBy = task && Array.isArray(task.blockedBy) ? task.blockedBy : [];
      const out = [];
      const seen = new Set();
      for (const raw of blockedBy) {
        const id = String(raw === undefined || raw === null ? '' : raw);
        if (id === '' || seen.has(id)) continue;
        seen.add(id);
        if (known !== undefined && known !== null && typeof known.has === 'function' && !known.has(id)) continue;
        out.push(id);
      }
      return out;
    }

    /** One cycle on the board as an id list, or null when the DAG is acyclic. */
    function cyclePath(tasks) {
      const list = (tasks || []).filter((task) => task && task.id !== undefined && task.id !== null);
      const byId = new Map(list.map((task) => [String(task.id), task]));
      const state = new Map();
      const stack = [];
      let found = null;
      const visit = (id) => {
        if (found !== null) return;
        const mark = state.get(id) || 0;
        if (mark === 1) {
          const start = stack.indexOf(id);
          found = stack.slice(start).concat(id);
          return;
        }
        if (mark === 2) return;
        state.set(id, 1);
        stack.push(id);
        for (const next of dependencyIds(byId.get(id), byId)) visit(next);
        stack.pop();
        state.set(id, 2);
      };
      for (const id of byId.keys()) visit(id);
      return found;
    }

    function textUnits(value) {
      let units = 0;
      for (const character of String(value)) units += isWideChar(character) ? 2 : 1;
      return units;
    }

    function isWideChar(character) {
      const code = typeof character === 'string' ? character.codePointAt(0) : 0;
      return (code >= 0x1100 && code <= 0x115f)
        || (code >= 0x2e80 && code <= 0xa4cf)
        || (code >= 0xac00 && code <= 0xd7a3)
        || (code >= 0xf900 && code <= 0xfaff)
        || (code >= 0xfe30 && code <= 0xfe6f)
        || (code >= 0xff00 && code <= 0xff60)
        || (code >= 0xffe0 && code <= 0xffe6)
        || (code >= 0x1f300 && code <= 0x1faff);
    }

    function wrapSvgText(value, unitsPerLine, maxLines) {
      const text = String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
      const budget = Math.max(2, unitsPerLine);
      const limit = Math.max(1, maxLines);
      const pieces = text.split(/(?<=[ ·\-_/])/).filter((piece) => piece !== '');
      const lines = [];
      let current = '';
      const flush = () => {
        if (current !== '') lines.push(current.trim());
        current = '';
      };
      for (const rawPiece of pieces) {
        const piece = current === '' ? rawPiece.replace(/^\s+/, '') : rawPiece;
        if (textUnits(current + piece) <= budget) {
          current += piece;
          continue;
        }
        if (current !== '') flush();
        let rest = piece.trim();
        while (textUnits(rest) > budget) {
          let cut = '';
          let cutAt = 0;
          for (const character of rest) {
            if (textUnits(cut + character) > budget) break;
            cut += character;
            cutAt += character.length;
          }
          if (cut === '') break;
          lines.push(cut);
          rest = rest.slice(cutAt);
        }
        current = rest;
        if (lines.length >= limit) break;
      }
      if (current !== '' && lines.length < limit) lines.push(current.trim());
      if (lines.length === 0) return [''];
      const kept = lines.slice(0, limit);
      if (lines.length > limit) {
        const last = kept[kept.length - 1];
        kept[kept.length - 1] = last.length > 1 ? last.slice(0, last.length - 1) + '…' : '…';
      }
      return kept;
    }

    /** `T1 · backend-dev · 实现导出` → `实现导出`; the id and the role have their own chips. */
    function taskDisplayTitle(task) {
      const parts = String(taskTitle(task)).split(/\s*·\s*/);
      if (parts.length >= 3 && ROLE_IDS.indexOf(parts[1]) >= 0) return parts.slice(2).join(' · ');
      return stripIdPrefix(taskTitle(task));
    }

    function taskShortLabel(task) {
      const subject = task && typeof task.subject === 'string' ? task.subject : '';
      const match = /^[A-Za-z]{0,3}\d+/.exec(subject);
      if (match) return match[0].toUpperCase();
      const id = task && task.id !== undefined && task.id !== null ? String(task.id) : '';
      return id.length > 6 ? id.slice(0, 6) : id;
    }

    function runStats(tasks) {
      const list = (tasks || []).filter(Boolean);
      const counts = { pending: 0, ready: 0, progress: 0, done: 0, blocked: 0 };
      const gates = [];
      list.forEach((task, index) => {
        const state = taskState(task);
        counts[state] += 1;
        if (isGateTask(task)) gates.push({ id: String(task.id), state, index });
      });
      const total = list.length;
      const done = counts.done;
      return { counts, total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100), gates };
    }

    /** Edge count, dangling dependencies and cycle for the board header and alerts. */
    function graphFacts(tasks) {
      const list = (tasks || []).filter(Boolean);
      const known = new Set(list.map((task) => String(task.id)));
      let edges = 0;
      const unknown = [];
      for (const task of list) {
        for (const raw of Array.isArray(task.blockedBy) ? task.blockedBy : []) {
          const id = String(raw === undefined || raw === null ? '' : raw);
          if (id === '') continue;
          if (!known.has(id)) {
            unknown.push({ taskId: String(task.id), dep: id });
            continue;
          }
          edges += 1;
        }
      }
      return { edges, unknown, cycle: cyclePath(list) };
    }

    /**
     * File × agent ownership grid. Overlap is derived from the tasks themselves
     * (two different owners on one path), not parsed out of localized warning text.
     */
    function buildOwnership(tasks, limit) {
      const list = (tasks || []).filter(Boolean);
      const agents = new Map();
      const touch = (name) => {
        const key = typeof name === 'string' ? name : '';
        if (!agents.has(key)) agents.set(key, { key, name: key, initials: initialsOf(key) });
        return agents.get(key);
      };
      const files = new Map();
      for (const task of list) {
        const owner = typeof task.ownerName === 'string' ? task.ownerName : '';
        touch(owner);
        const scopes = Array.isArray(task.writeScopes) ? task.writeScopes : [];
        for (const raw of scopes) {
          const path = String(raw);
          if (path === '') continue;
          if (!files.has(path)) files.set(path, []);
          files.get(path).push({
            taskId: String(task.id),
            owner,
            label: taskShortLabel(task),
            state: taskState(task),
            title: taskTitle(task),
          });
        }
      }
      const orderedAgents = [...agents.values()].sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
      const rows = [...files.entries()].map(([path, cells]) => {
        const owners = new Set(cells.map((cell) => cell.owner).filter((owner) => owner !== ''));
        return {
          path,
          overlap: owners.size >= 2,
          owners: owners.size,
          cells: orderedAgents.map((agent) => ({ agent, hits: cells.filter((cell) => cell.owner === agent.key) })),
        };
      });
      rows.sort((left, right) => {
        if (left.overlap !== right.overlap) return left.overlap ? -1 : 1;
        if (left.owners !== right.owners) return right.owners - left.owners;
        return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
      });
      const max = Number.isFinite(limit) ? limit : 30;
      return {
        agents: orderedAgents,
        rows: rows.slice(0, max),
        overflow: Math.max(0, rows.length - max),
        total: rows.length,
        overlapCount: rows.filter((row) => row.overlap).length,
      };
    }

    /**
     * The dispatch picture: one Lead node, one node per task, a dispatch edge into
     * every task that has no prerequisite, and a dependency edge for each
     * prerequisite. The same shape serves the shared board, a run.json plan and the
     * todo fallback — the difference is only the labels the nodes carry.
     * @param options - `{ tasks }` in board shape.
     * @returns nodes, edges and the synthetic Lead id.
     */
    function buildGraph(options) {
      const tasks = (options && options.tasks) || [];
      const leadId = '__lead';
      const nodes = [{ id: leadId, kind: 'lead', height: 46 }];
      const edges = [];
      if (tasks.length === 0) return { nodes, edges, leadId };
      const known = new Set(tasks.filter(Boolean).map((task) => String(task.id)));
      for (const task of tasks) {
        if (!task) continue;
        const gate = isGateTask(task);
        nodes.push({ id: String(task.id), kind: gate ? 'gate' : 'task', height: gate ? 44 : 52 });
      }
      for (const task of tasks) {
        if (!task) continue;
        const id = String(task.id);
        const deps = dependencyIds(task, known);
        if (deps.length === 0) edges.push({ from: leadId, to: id, kind: 'dispatch' });
        for (const dep of deps) edges.push({ from: dep, to: id, kind: 'depends' });
      }
      return { nodes, edges, leadId };
    }

    /**
     * Layer a graph left to right and route orthogonal edges between layers.
     * Pure and deterministic: the same nodes and edges always produce the same
     * coordinates. The spare width is distributed between the columns and the whole
     * block is centred, so a wide panel does not leave the graph stranded at the
     * left edge.
     * @param nodes - `{ id, kind, height? }` list.
     * @param edges - `{ from, to, kind? }` list.
     * @param options - sizing knobs (width, nodeW, gaps, padding).
     * @returns positioned nodes, routed edges, canvas size and the cycle (or null).
     */
    function layoutGraph(nodes, edges, options) {
      const settings = options || {};
      const width = Number.isFinite(settings.width) && settings.width > 0 ? settings.width : 420;
      const nodeW = settings.nodeW || 178;
      const gapX = settings.gapX === undefined ? 34 : settings.gapX;
      const gapY = settings.gapY === undefined ? 10 : settings.gapY;
      const padX = settings.padX === undefined ? 8 : settings.padX;
      const padY = settings.padY === undefined ? 10 : settings.padY;

      const list = (nodes || []).filter((node) => node && node.id !== undefined && node.id !== null);
      const byId = new Map(list.map((node) => [String(node.id), node]));
      const ids = [...byId.keys()];
      const heightOf = (id) => {
        const node = byId.get(id);
        if (!node) return 54;
        if (Number.isFinite(node.height) && node.height > 0) return node.height;
        return node.kind === 'lead' ? 46 : 52;
      };

      const preds = new Map(ids.map((id) => [id, []]));
      const succs = new Map(ids.map((id) => [id, []]));
      const unknown = [];
      const seen = new Set();
      for (const edge of edges || []) {
        if (!edge) continue;
        const from = String(edge.from === undefined || edge.from === null ? '' : edge.from);
        const to = String(edge.to === undefined || edge.to === null ? '' : edge.to);
        if (from === '' || to === '' || from === to) continue;
        const key = from + '>' + to;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!byId.has(from) || !byId.has(to)) {
          unknown.push({ from, to });
          continue;
        }
        preds.get(to).push(from);
        succs.get(from).push(to);
      }

      // Longest-path layering over a Kahn order; a cyclic graph keeps its leftovers at level 0.
      const indegree = new Map(ids.map((id) => [id, preds.get(id).length]));
      const queue = ids.filter((id) => indegree.get(id) === 0);
      const order = [];
      while (queue.length > 0) {
        const id = queue.shift();
        order.push(id);
        for (const next of succs.get(id)) {
          indegree.set(next, indegree.get(next) - 1);
          if (indegree.get(next) === 0) queue.push(next);
        }
      }
      const levelOf = new Map(ids.map((id) => [id, 0]));
      for (const id of order) {
        const own = levelOf.get(id);
        for (const next of succs.get(id)) {
          if (levelOf.get(next) < own + 1) levelOf.set(next, own + 1);
        }
      }

      const levels = [];
      for (const id of ids) {
        const level = levelOf.get(id) || 0;
        if (!levels[level]) levels[level] = [];
        levels[level].push(id);
      }
      for (let index = 0; index < levels.length; index += 1) if (!levels[index]) levels[index] = [];

      // Two barycenter sweeps keep crossings down without an external layout library.
      const position = new Map();
      const record = () => {
        for (const column of levels) column.forEach((id, index) => position.set(id, index));
      };
      record();
      const barycenter = (id) => {
        const neighbours = (preds.get(id) || []).concat(succs.get(id) || []);
        if (neighbours.length === 0) return position.get(id) || 0;
        let sum = 0;
        for (const neighbour of neighbours) sum += position.get(neighbour) || 0;
        return sum / neighbours.length;
      };
      for (let sweep = 0; sweep < 2; sweep += 1) {
        for (const column of levels) {
          column.sort((left, right) => {
            const delta = barycenter(left) - barycenter(right);
            if (delta !== 0) return delta;
            return left < right ? -1 : left > right ? 1 : 0;
          });
        }
        record();
      }

      const levelCount = levels.length;
      // Fit the graph to the container when a deep plan would otherwise scroll:
      // shrink the node width (never below `minNodeW`) before allowing overflow.
      let nodeWidth = nodeW;
      let columnGap = gapX;
      if (levelCount > 0) {
        const room = width - padX * 2;
        const ideal = levelCount * nodeW + Math.max(0, levelCount - 1) * gapX;
        if (ideal > room) {
          columnGap = Math.min(gapX, 24);
          const fitted = Math.floor((room - (levelCount - 1) * columnGap) / levelCount);
          nodeWidth = Math.max(settings.minNodeW || 126, Math.min(nodeW, fitted));
        } else if (ideal < room - 120) {
          // A wide panel gives the cards room instead of padding the gaps forever.
          nodeWidth = Math.min(settings.maxNodeW || 238, Math.floor((room - (levelCount - 1) * gapX) / levelCount));
        }
      }
      const required = levelCount === 0 ? padX * 2 : levelCount * nodeWidth + Math.max(0, levelCount - 1) * columnGap + padX * 2;
      const spare = Math.max(0, width - required);
      // A wide panel spreads the columns instead of stranding the graph on the left.
      if (levelCount > 1 && spare > 0) columnGap += Math.min(spare / (levelCount - 1), 96);
      const totalWidth = levelCount === 0 ? padX * 2 : levelCount * nodeWidth + Math.max(0, levelCount - 1) * columnGap + padX * 2;
      const canvasWidth = Math.max(width, totalWidth);
      const left = padX + Math.max(0, (canvasWidth - totalWidth) / 2);

      const columnHeights = levels.map((column) => column.reduce((sum, id, index) => sum + heightOf(id) + (index > 0 ? gapY : 0), 0));
      const tallest = columnHeights.reduce((max, height) => Math.max(max, height), 0);
      const xAt = [];
      let cursor = left;
      for (let index = 0; index < levelCount; index += 1) {
        xAt[index] = cursor;
        cursor += nodeWidth + columnGap;
      }
      const canvasHeight = (levelCount === 0 ? 0 : tallest) + padY * 2;

      const positioned = [];
      const geometry = new Map();
      levels.forEach((column, levelIndex) => {
        let y = padY + Math.max(0, (tallest - columnHeights[levelIndex]) / 2);
        for (const id of column) {
          const height = heightOf(id);
          const node = { ...byId.get(id), id, level: levelIndex, x: xAt[levelIndex], y, w: nodeWidth, h: height };
          positioned.push(node);
          geometry.set(id, node);
          y += height + gapY;
        }
      });

      const routed = [];
      for (const edge of edges || []) {
        if (!edge) continue;
        const fromId = String(edge.from === undefined || edge.from === null ? '' : edge.from);
        const toId = String(edge.to === undefined || edge.to === null ? '' : edge.to);
        const from = geometry.get(fromId);
        const to = geometry.get(toId);
        if (!from || !to) continue;
        const x1 = from.x + from.w;
        const y1 = from.y + from.h / 2;
        const x2 = to.x;
        const y2 = to.y + to.h / 2;
        const mid = x1 + Math.max(8, (x2 - x1) / 2);
        routed.push({
          from: fromId,
          to: toId,
          kind: edge.kind || 'depends',
          path: 'M ' + round1(x1) + ' ' + round1(y1) + ' H ' + round1(mid) + ' V ' + round1(y2) + ' H ' + round1(x2),
        });
      }

      return {
        nodes: positioned,
        edges: routed,
        width: canvasWidth,
        height: canvasHeight,
        cycle: cyclePathFrom(ids, succs),
        unknownDeps: unknown,
      };
    }

    /** One cycle over an explicit successor map, as an id list, or null. */
    function cyclePathFrom(ids, succs) {
      const state = new Map();
      const stack = [];
      let found = null;
      const visit = (id) => {
        if (found !== null) return;
        const mark = state.get(id) || 0;
        if (mark === 1) {
          const start = stack.indexOf(id);
          found = stack.slice(start).concat(id);
          return;
        }
        if (mark === 2) return;
        state.set(id, 1);
        stack.push(id);
        for (const next of succs.get(id) || []) visit(next);
        stack.pop();
        state.set(id, 2);
      };
      for (const id of ids) visit(id);
      return found;
    }

    // --- task sources --------------------------------------------------------------
    // One session can carry three kinds of progress facts, in decreasing authority:
    // the Agent Teams board, the run's plan + run.json on disk, and the todo list.

    /** Tasks from this session's `agentTeam` projection, or null when it holds none. */
    function boardTasks(team) {
      const tasks = team && Array.isArray(team.tasks) ? team.tasks.filter(Boolean) : [];
      if (tasks.length === 0) return null;
      return tasks.map((task) => ({
        id: String(task.id),
        subject: typeof task.subject === 'string' ? task.subject : String(task.id),
        status: task.status,
        ownerName: typeof task.ownerName === 'string' ? task.ownerName : '',
        blockedBy: Array.isArray(task.blockedBy) ? task.blockedBy.slice() : [],
        writeScopes: Array.isArray(task.writeScopes) ? task.writeScopes.slice() : [],
        ready: typeof task.ready === 'boolean' ? task.ready : undefined,
        warnings: Array.isArray(task.writeScopeWarnings) ? task.writeScopeWarnings.slice() : [],
        description: typeof task.description === 'string' ? task.description : '',
      }));
    }

    /** Tasks from this session's `todos` projection (latest todo_write list). */
    function todoTasks(todos) {
      if (!Array.isArray(todos) || todos.length === 0) return null;
      return todos.slice(0, MAX_TODO_TASKS).map((item, index) => {
        const content = item && typeof item.content === 'string' ? item.content : String(item && item.text ? item.text : '');
        const status = item && item.status === 'completed' ? 'completed' : item && item.status === 'in_progress' ? 'in_progress' : 'pending';
        return {
          id: String(index + 1),
          subject: content,
          status,
          ownerName: '',
          blockedBy: [],
          writeScopes: [],
          ready: undefined,
          warnings: [],
          todo: true,
        };
      });
    }

    /** Merge 03-plan.json (ownership) with run.json (status) into board-shaped tasks. */
    function planTasks(run, plan) {
      const runTasks = run && run.tasks && typeof run.tasks === 'object' ? run.tasks : null;
      const list = plan && Array.isArray(plan.tasks) ? plan.tasks.filter(Boolean) : [];
      if (list.length === 0 && (runTasks === null || Object.keys(runTasks).length === 0)) return null;
      const source = list.length > 0 ? list : Object.keys(runTasks || {}).map((id) => ({ id, title: runTasks[id] && runTasks[id].title, role: runTasks[id] && runTasks[id].role }));
      const out = [];
      for (const task of source) {
        const id = String(task.id === undefined || task.id === null ? '' : task.id);
        if (id === '') continue;
        const state = (runTasks && runTasks[id]) || {};
        const role = String(task.role || state.role || '');
        const title = String(task.title || state.title || '');
        const blockedBy = Array.isArray(task.dependsOn) ? task.dependsOn.map(String) : Array.isArray(state.dependsOn) ? state.dependsOn.map(String) : [];
        const files = [];
        if (Array.isArray(task.files)) files.push(...task.files.map(String));
        if (Array.isArray(task.newFiles)) files.push(...task.newFiles.map(String));
        const status = state.status === 'done' ? 'completed' : state.status === 'running' ? 'in_progress' : 'pending';
        out.push({
          id,
          subject: role === '' ? id + ' · ' + title : id + ' · ' + role + ' · ' + title,
          status,
          ownerName: role,
          blockedBy,
          writeScopes: files,
          ready: undefined,
          warnings: [],
          failed: state.status === 'failed',
          attempts: typeof state.attempts === 'number' ? state.attempts : 0,
          lastError: typeof state.lastError === 'string' ? state.lastError : '',
        });
      }
      return out.length > 0 ? out : null;
    }

    // --- subagents ------------------------------------------------------------------

    const SUBAGENT_CHAT_PREFIX = 'dsh-resource://subagentchat/session/';
    const ROLE_LABEL = /^(pm|architect|backend-dev|frontend-dev|qa-engineer|browser-tester|reviewer)\s*·\s*/;

    /** Turn the session's `subagentCatalog` rows into display rows. */
    function subagentRows(catalog) {
      if (!Array.isArray(catalog)) return [];
      const rows = [];
      for (const entry of catalog) {
        if (!entry || typeof entry !== 'object' || entry.id === undefined) continue;
        const label = typeof entry.label === 'string' ? entry.label : typeof entry.name === 'string' ? entry.name : '';
        const match = ROLE_LABEL.exec(label);
        rows.push({
          id: String(entry.id),
          label: label === '' ? shortId(String(entry.id)) : label.replace(ROLE_LABEL, ''),
          role: match ? match[1] : '',
          mode: typeof entry.mode === 'string' ? entry.mode : 'one-shot',
          activity: entry.activity === 'running' ? 'running' : 'inactive',
        });
      }
      return rows;
    }

    function subagentAddressOf(row, parentId) {
      const mode = row.mode === 'continuable' ? 'continuable' : row.mode === 'one-shot' ? 'one-shot' : 'unknown';
      return SUBAGENT_CHAT_PREFIX + encodeURIComponent(row.id) + '?parent=' + encodeURIComponent(parentId) + '&mode=' + mode;
    }

    function fileAddressOf(sessionId, workspacePath) {
      const parts = String(workspacePath).split('/').filter((part) => part !== '');
      return 'dsh-resource://file/session/' + encodeURIComponent(sessionId) + '/' + parts.map(encodeURIComponent).join('/');
    }

    // --- run facts (workspace files) ------------------------------------------------

    /**
     * Read one Steward run off disk through the host's workspace-files Remote.
     * Discovery walks the skill's run roots, prefers the directory whose
     * run.json has the latest updatedAt, then refreshes only that directory on
     * the polling tick so a live run costs one listing plus one read.
     * @param ctx - client root context (for ctx.remote.workspaceFiles).
     * @param sessionId - the Session whose workspace is read.
     * @returns a loader with `load()`.
     */
    function createRunLoader(ctx, sessionId) {
      let dir = '';
      const remoteOf = () => (ctx && ctx.remote ? ctx.remote.workspaceFiles : undefined);

      const call = async (method, ...args) => {
        const remote = remoteOf();
        if (!remote || typeof remote[method] !== 'function') return null;
        try {
          const response = await remote[method](sessionId, ...args);
          return response && response.ok === true ? response.value : null;
        } catch {
          return null;
        }
      };

      const readJson = async (path) => {
        const page = await call('read', path, { offset: 1, limit: 400 });
        if (!page || typeof page.text !== 'string') return null;
        try {
          return JSON.parse(page.text);
        } catch {
          return null;
        }
      };

      const stampOf = (run) => {
        if (!run || typeof run !== 'object') return 0;
        for (const key of ['updatedAt', 'finishedAt', 'createdAt', 'startedAt']) {
          const value = run[key];
          const at = typeof value === 'string' ? Date.parse(value) : NaN;
          if (Number.isFinite(at)) return at;
        }
        return 0;
      };

      const discover = async () => {
        const candidates = [];
        for (const root of RUN_ROOTS) {
          const listing = await call('list', root);
          if (!listing || !Array.isArray(listing.entries)) continue;
          for (const entry of listing.entries) {
            if (entry && entry.type === 'directory' && typeof entry.name === 'string') candidates.push(root + '/' + entry.name);
          }
        }
        // Run directories are `<MMDD-HHmm>-<slug>`: name order is time order inside a
        // month, so read a few of the newest and let run.json's updatedAt decide.
        candidates.sort();
        candidates.reverse();
        let best = null;
        for (const candidate of candidates.slice(0, MAX_RUN_DIRS)) {
          const run = await readJson(candidate + '/run.json');
          const stamp = stampOf(run);
          if (best === null || stamp > best.stamp) best = { dir: candidate, run, stamp };
          if (stamp > 0) break;
        }
        if (best === null) return { dir: '', run: null, plan: null };
        return { dir: best.dir, run: best.run, plan: await readJson(best.dir + '/03-plan.json') };
      };

      const collect = async (target, run, plan) => {
        const artifacts = [];
        const listing = await call('list', target);
        if (listing && Array.isArray(listing.entries)) {
          for (const entry of listing.entries) {
            if (!entry || entry.type !== 'file' || typeof entry.name !== 'string') continue;
            artifacts.push({ path: target + '/' + entry.name, name: entry.name, size: typeof entry.size === 'number' ? entry.size : 0 });
          }
        }
        for (const sub of ['reports', 'evidence']) {
          const nested = await call('list', target + '/' + sub);
          if (!nested || !Array.isArray(nested.entries)) continue;
          for (const entry of nested.entries) {
            if (!entry || entry.type !== 'file' || typeof entry.name !== 'string') continue;
            artifacts.push({ path: target + '/' + sub + '/' + entry.name, name: sub + '/' + entry.name, size: typeof entry.size === 'number' ? entry.size : 0 });
          }
        }
        artifacts.sort((left, right) => {
          const rank = (item) => (item.name === 'run.json' ? 0 : item.name === '03-plan.json' ? 1 : item.name.indexOf('reports/') === 0 ? 2 : 3);
          const delta = rank(left) - rank(right);
          return delta !== 0 ? delta : left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
        });
        return {
          status: 'ready',
          dir: target,
          run,
          plan,
          ref: plan || null,
          artifacts: artifacts.slice(0, MAX_ARTIFACTS),
          truncated: artifacts.length > MAX_ARTIFACTS,
        };
      };

      return {
        dir: () => dir,
        async load() {
          if (remoteOf() === undefined || typeof remoteOf().list !== 'function') {
            return { status: 'unsupported', dir: '', run: null, plan: null, artifacts: [] };
          }
          if (dir === '') {
            const found = await discover();
            dir = found.dir;
            if (dir === '') return { status: 'empty', dir: '', run: null, plan: null, artifacts: [] };
            return collect(dir, found.run, found.plan);
          }
          const run = await readJson(dir + '/run.json');
          const plan = await readJson(dir + '/03-plan.json');
          const facts = await collect(dir, run, plan);
          // The run directory can vanish between ticks (a new run, a clean
          // workspace): forget it and rediscover on the next tick.
          if (run === null && plan === null && facts.artifacts.length === 0) {
            dir = '';
            return { status: 'empty', dir: '', run: null, plan: null, artifacts: [] };
          }
          return facts;
        },
      };
    }

    // --- settings form (shared with the Settings → Steward section) ------------------

    function emptySelection() {
      return { provider: '', model: '', effort: '' };
    }

    function selectionOf(raw) {
      if (raw === null || typeof raw !== 'object') return emptySelection();
      const provider = typeof raw.provider === 'string' ? raw.provider : '';
      const model = typeof raw.model === 'string' ? raw.model : '';
      const effort = typeof raw.effort === 'string' ? raw.effort : '';
      return { provider, model, effort };
    }

    function draftFromValue(value) {
      const roles = {};
      for (const id of ROLE_IDS) roles[id] = selectionOf(value && value.roles ? value.roles[id] : undefined);
      return { defaults: selectionOf(value ? value.defaults : undefined), roles };
    }

    function sameDraft(left, right) {
      if (!left || !right) return false;
      if (FIELDS.some((field) => left.defaults[field] !== right.defaults[field])) return false;
      return ROLE_IDS.every((id) => FIELDS.every((field) => (left.roles[id] || emptySelection())[field] === (right.roles[id] || emptySelection())[field]));
    }

    function useSnapshot(scope) {
      const subscribe = useCallback((notify) => scope.subscribe(notify), [scope]);
      const read = useCallback(() => scope.getSnapshot(), [scope]);
      if (typeof React.useSyncExternalStore === 'function') return React.useSyncExternalStore(subscribe, read, read);
      const [snapshot, setSnapshot] = useState(() => scope.getSnapshot());
      useEffect(() => scope.subscribe(() => setSnapshot(scope.getSnapshot())), [scope]);
      return snapshot;
    }

    function selectionSource(draft, roleId) {
      const own = draft.roles[roleId] || emptySelection();
      if (own.provider !== '' && own.model !== '') return 'role';
      if (draft.defaults.provider !== '' && draft.defaults.model !== '') return 'defaults';
      return 'inherit';
    }

    function partialSelection(selection) {
      const hasProvider = selection.provider !== '';
      const hasModel = selection.model !== '';
      return hasProvider !== hasModel;
    }

    function groupOf(catalog, providerId) {
      const groups = catalog && Array.isArray(catalog.groups) ? catalog.groups : [];
      return groups.find((entry) => entry && entry.id === providerId) || null;
    }

    function modelOf(group, modelId) {
      const models = group && Array.isArray(group.models) ? group.models : [];
      return models.find((entry) => entry && entry.id === modelId) || null;
    }

    function effortsOf(group, modelId) {
      const model = modelOf(group, modelId);
      return model && model.reasoning && Array.isArray(model.reasoning.efforts) ? model.reasoning.efforts : [];
    }

    function sourceOf(text, source) {
      return source === 'role' ? text.sourceRole : source === 'defaults' ? text.sourceDefaults : text.sourceInherit;
    }

    function roleName(role, lang) {
      return lang === 'zh' ? role.zh : role.en;
    }

    function roleDesc(role, lang) {
      return lang === 'zh' ? role.zhDesc : role.enDesc;
    }

    // --- primitives -----------------------------------------------------------------

    function StatusDot({ tone }) {
      return h('span', { className: 'stwd-dot stwd-dot-' + (tone || 'idle'), 'aria-hidden': 'true' });
    }

    function StatusPill({ tone, children }) {
      return h('span', { className: 'stwd-pill stwd-pill-' + (tone || 'idle') }, children);
    }

    function Chip({ children, title, mono }) {
      return h('span', { className: 'stwd-chip' + (mono ? ' stwd-chip-mono' : ''), title: title || undefined }, children);
    }

    function SectionHead({ title, count, actions }) {
      return h('div', { className: 'stwd-section-head' },
        h('h3', { className: 'stwd-section-title' }, title),
        count !== undefined && count !== null && count !== '' ? h('span', { className: 'stwd-section-count' }, String(count)) : null,
        actions ? h('span', { className: 'stwd-section-actions' }, actions) : null,
      );
    }

    function Alert({ tone, children }) {
      return h('p', { className: 'stwd-alert stwd-alert-' + (tone || 'warn') }, children);
    }

    function EmptyState({ title, note, steps }) {
      return h('div', { className: 'stwd-empty' },
        h('p', { className: 'stwd-empty-title' }, title),
        note ? h('p', { className: 'stwd-empty-text' }, note) : null,
        Array.isArray(steps) && steps.length > 0
          ? h('ol', { className: 'stwd-empty-steps' }, steps.map((step, index) => h('li', { key: 'step-' + index }, step)))
          : null,
      );
    }

    function SkeletonRows({ rows }) {
      const count = typeof rows === 'number' && rows > 0 ? rows : 2;
      const items = [];
      for (let index = 0; index < count; index += 1) items.push(h('span', { key: 'sk-' + index, className: 'stwd-skeleton' }));
      return h('div', { className: 'stwd-skeleton-block' }, items);
    }

    function StewardIcon({ size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 16;
      return h('svg', {
        className: 'stwd-icon',
        width: edge,
        height: edge,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': 'true',
        focusable: 'false',
      },
        h('path', {
          d: 'M5 17c0-3.7 3.1-6.6 7-6.6s7 2.9 7 6.6',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
        }),
        h('circle', { cx: 12, cy: 6.4, r: 2.7, fill: 'currentColor' }),
        h('path', { d: 'M8.4 19.4h7.2', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
        h('path', { d: 'M12 12.6v3.2', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }),
      );
    }

    function AgentAvatar({ name, size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 20;
      return h('span', {
        className: 'stwd-avatar',
        style: { width: edge + 'px', height: edge + 'px' },
        'aria-hidden': 'true',
      }, h('span', { className: 'stwd-avatar-text' }, initialsOf(name)));
    }

    function RunDonut({ text, done, total }) {
      const safeTotal = total > 0 ? total : 1;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;
      const radius = 16;
      const circumference = 2 * Math.PI * radius;
      const filled = Math.min(1, done / safeTotal) * circumference;
      return h('div', { className: 'stwd-donut', role: 'img', 'aria-label': fmt(text.progressAria, { done, total }) },
        h('svg', { viewBox: '0 0 40 40', width: 40, height: 40, 'aria-hidden': 'true', focusable: 'false' },
          h('circle', { className: 'stwd-donut-track', cx: 20, cy: 20, r: radius, fill: 'none' }),
          h('circle', {
            className: 'stwd-donut-value',
            cx: 20,
            cy: 20,
            r: radius,
            fill: 'none',
            strokeDasharray: round1(filled) + ' ' + round1(circumference - filled),
            transform: 'rotate(-90 20 20)',
          }),
        ),
        h('span', { className: 'stwd-donut-text' }, percent + '%'),
      );
    }

    /** One segment per task; gate positions get a tick above the bar. */
    function SegmentedProgress({ text, tasks }) {
      const list = (tasks || []).filter(Boolean);
      if (list.length === 0) return null;
      const stats = runStats(list);
      const segments = list.map((task, index) => h('span', {
        key: 'seg-' + String(task.id === undefined ? index : task.id) + '-' + index,
        className: 'stwd-seg stwd-seg-' + taskState(task),
        title: taskTitle(task),
      }));
      const ticks = stats.gates.map((gate) => h('span', {
        key: 'tick-' + gate.id,
        className: 'stwd-seg-tick',
        style: { left: ((gate.index + 0.5) / list.length) * 100 + '%' },
        title: taskTitle(list[gate.index]),
      }));
      return h('div', { className: 'stwd-segwrap' },
        h('div', { className: 'stwd-segbar', role: 'img', 'aria-label': fmt(text.progressAria, { done: stats.done, total: stats.total }) }, segments),
        ticks.length > 0 ? h('div', { className: 'stwd-segticks', 'aria-hidden': 'true' }, ticks) : null,
      );
    }

    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }

      static getDerivedStateFromError(error) {
        return { error };
      }

      componentDidCatch(error) {
        if (typeof console !== 'undefined' && console.error) console.error('steward: panel section crashed', error);
      }

      render() {
        if (this.state.error !== null) {
          return h('div', { className: 'stwd-empty' },
            h('p', { className: 'stwd-empty-title' }, this.props.fallbackTitle || 'Panel section failed'),
            h('p', { className: 'stwd-empty-text' }, String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error)),
          );
        }
        return this.props.children;
      }
    }

    // --- dispatch graph -------------------------------------------------------------

    function edgeIsHot(edge, highlight) {
      if (!highlight || highlight.size === 0) return false;
      return highlight.has(edge.from) && highlight.has(edge.to);
    }

    /**
     * The graph surface: a Lead node, the tasks it dispatched, and the dependency
     * edges between them. Nodes and edges arrive already laid out by `layoutGraph`;
     * this component only draws and routes interaction.
     * @param props - text, the graph model, the task lookup and selection callbacks.
     * @returns the canvas.
     */
    function DagCanvas({ text, graph, tasks, leadTitle, leadSubtitle, selectedId, hoverId, onSelect, onHover }) {
      const wrapRef = useRef(null);
      const nodeRefs = useRef({});
      const [width, setWidth] = useState(0);
      const [focusId, setFocusId] = useState(null);

      useEffect(() => {
        const host = wrapRef.current;
        if (!host || typeof ResizeObserver === 'undefined') return undefined;
        const measure = () => {
          const next = Math.round(host.clientWidth || 0);
          if (next > 0) setWidth((current) => (current === next ? current : next));
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(host);
        return () => observer.disconnect();
      }, []);

      const layout = useMemo(() => layoutGraph(graph.nodes, graph.edges, { width: width > 0 ? width : 420 }), [graph, width]);
      const byId = useMemo(() => {
        const map = new Map();
        for (const task of tasks || []) if (task) map.set(String(task.id), task);
        return map;
      }, [tasks]);
      const adjacency = useMemo(() => {
        const preds = new Map();
        const succs = new Map();
        for (const edge of graph.edges || []) {
          if (!succs.has(edge.from)) succs.set(edge.from, []);
          succs.get(edge.from).push(edge.to);
          if (!preds.has(edge.to)) preds.set(edge.to, []);
          preds.get(edge.to).push(edge.from);
        }
        return { preds, succs };
      }, [graph]);
      const highlight = useMemo(() => {
        const active = selectedId || hoverId;
        if (!active) return null;
        const ids = new Set([active]);
        const walk = (map) => {
          const queue = [active];
          while (queue.length > 0) {
            const current = queue.shift();
            for (const next of map.get(current) || []) {
              if (ids.has(next)) continue;
              ids.add(next);
              queue.push(next);
            }
          }
        };
        walk(adjacency.preds);
        walk(adjacency.succs);
        return ids;
      }, [selectedId, hoverId, adjacency]);

      const moveFocus = useCallback((fromId, direction) => {
        const current = layout.nodes.find((node) => node.id === fromId);
        if (!current) return;
        let best = null;
        let bestScore = Infinity;
        const cx = current.x + current.w / 2;
        const cy = current.y + current.h / 2;
        for (const node of layout.nodes) {
          if (node.id === fromId) continue;
          const dx = node.x + node.w / 2 - cx;
          const dy = node.y + node.h / 2 - cy;
          if (direction === 'right' && dx <= 0) continue;
          if (direction === 'left' && dx >= 0) continue;
          if (direction === 'down' && dy <= 0) continue;
          if (direction === 'up' && dy >= 0) continue;
          const primary = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
          const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
          const score = primary + secondary * 2;
          if (score < bestScore) {
            bestScore = score;
            best = node;
          }
        }
        if (!best) return;
        setFocusId(best.id);
        const element = nodeRefs.current[best.id];
        if (element && typeof element.focus === 'function') element.focus();
      }, [layout]);

      const onNodeKeyDown = useCallback((event, id) => {
        if (!event) return;
        const key = event.key;
        if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
          event.preventDefault();
          onSelect(id);
          return;
        }
        if (key === 'Escape') {
          event.preventDefault();
          onSelect(null);
          return;
        }
        const direction = key === 'ArrowRight' ? 'right' : key === 'ArrowLeft' ? 'left' : key === 'ArrowUp' ? 'up' : key === 'ArrowDown' ? 'down' : null;
        if (!direction) return;
        event.preventDefault();
        moveFocus(id, direction);
      }, [moveFocus, onSelect]);

      const aria = fmt(text.graphAria, { nodes: layout.nodes.length, edges: layout.edges.length });

      return h('div', { className: 'stwd-graph', ref: wrapRef },
        h('p', { className: 'stwd-sr-only' }, text.graphKeys),
        h('svg', {
          className: 'stwd-graph-svg',
          width: layout.width,
          height: layout.height > 0 ? layout.height : 1,
          viewBox: '0 0 ' + layout.width + ' ' + (layout.height > 0 ? layout.height : 1),
          role: 'group',
          'aria-label': aria,
        },
          h('defs', null,
            h('marker', {
              id: 'stwd-arrow',
              viewBox: '0 0 8 8',
              refX: 7,
              refY: 4,
              markerWidth: 7,
              markerHeight: 7,
              orient: 'auto-start-reverse',
            }, h('path', { className: 'stwd-arrow-head', d: 'M0 0.7 L7 4 L0 7.3 Z' })),
            h('marker', {
              id: 'stwd-arrow-dispatch',
              viewBox: '0 0 8 8',
              refX: 7,
              refY: 4,
              markerWidth: 7,
              markerHeight: 7,
              orient: 'auto-start-reverse',
            }, h('path', { className: 'stwd-arrow-head-dispatch', d: 'M0 0.7 L7 4 L0 7.3 Z' })),
          ),
          h('g', { className: 'stwd-edges' }, layout.edges.map((edge) => {
            const hot = edgeIsHot(edge, highlight);
            const dim = highlight !== null && highlight.size > 0 && !hot;
            return h('path', {
              key: edge.from + '>' + edge.to,
              className: 'stwd-edge stwd-edge-' + edge.kind
                + (hot ? ' stwd-edge-hot' : '')
                + (dim ? ' stwd-edge-dim' : ''),
              d: edge.path,
              markerEnd: edge.kind === 'dispatch' ? 'url(#stwd-arrow-dispatch)' : 'url(#stwd-arrow)',
            }, h('title', null, text.dispatchEdge + '：' + edge.from + ' → ' + edge.to));
          })),
          h('g', { className: 'stwd-nodes' }, layout.nodes.map((node) => {
            const task = byId.get(node.id) || null;
            const kind = node.kind || 'task';
            if (kind === 'lead') {
              const selected = selectedId === node.id;
              return h('g', {
                key: node.id,
                ref: (element) => { nodeRefs.current[node.id] = element; },
                className: 'stwd-node stwd-node-lead',
                transform: 'translate(' + round1(node.x) + ',' + round1(node.y) + ')',
                role: 'button',
                tabIndex: 0,
                'aria-pressed': selected ? 'true' : 'false',
                'aria-label': leadTitle + (leadSubtitle === '' ? '' : ' · ' + leadSubtitle),
                onFocus: () => setFocusId(node.id),
                onBlur: () => setFocusId((current) => (current === node.id ? null : current)),
                onClick: () => onSelect(null),
                onKeyDown: (event) => onNodeKeyDown(event, node.id),
              },
                h('rect', { className: 'stwd-node-bg stwd-node-lead-bg', x: 0, y: 0, width: node.w, height: node.h, rx: 10 }),
                h('circle', { className: 'stwd-node-lead-dot', cx: 14, cy: node.h / 2, r: 3.5 }),
                h('text', { className: 'stwd-node-lead-title', x: 26, y: 19 }, leadTitle),
                h('text', { className: 'stwd-node-lead-sub', x: 26, y: 33 }, leadSubtitle),
              );
            }
            const state = taskState(task);
            const selected = selectedId === node.id;
            const dimmed = highlight !== null && highlight.size > 0 && !highlight.has(node.id);
            const owner = task && typeof task.ownerName === 'string' ? task.ownerName : '';
            const scopes = task && Array.isArray(task.writeScopes) ? task.writeScopes : [];
            const gate = kind === 'gate';
            const todo = Boolean(task && task.todo);
            // One unit ≈ 6px at 12px type, so this is the usable width of the card face.
            const titleLines = gate
              ? [stripIdPrefix(taskTitle(task)) || taskShortLabel(task)]
              : wrapSvgText(taskDisplayTitle(task), Math.floor((node.w - 26) / 6), 2);
            const titleStart = gate ? 27 : 19;
            return h('g', {
              key: node.id,
              ref: (element) => { nodeRefs.current[node.id] = element; },
              className: 'stwd-node stwd-node-task'
                + (gate ? ' stwd-node-gate' : '')
                + (todo ? ' stwd-node-todo' : '')
                + ' stwd-node-' + state
                + (selected ? ' stwd-node-selected' : '')
                + (dimmed ? ' stwd-node-dim' : '')
                + (focusId === node.id ? ' stwd-node-focused' : ''),
              transform: 'translate(' + round1(node.x) + ',' + round1(node.y) + ')',
              role: 'button',
              tabIndex: 0,
              'aria-pressed': selected ? 'true' : 'false',
              'aria-label': taskShortLabel(task) + ' ' + taskTitle(task) + ' · ' + stateLabel(text, state) + (owner === '' ? '' : ' · ' + text.owner + ' ' + owner),
              onFocus: () => setFocusId(node.id),
              onBlur: () => setFocusId((current) => (current === node.id ? null : current)),
              onMouseEnter: () => onHover(node.id),
              onMouseLeave: () => onHover(null),
              onClick: () => onSelect(selected ? null : node.id),
              onKeyDown: (event) => onNodeKeyDown(event, node.id),
            },
              h('rect', { className: 'stwd-node-bg', x: 0, y: 0, width: node.w, height: node.h, rx: 8 }),
              h('rect', { className: 'stwd-node-accent', x: 0.75, y: 9, width: 3, height: node.h - 18, rx: 1.5 }),
              selected || focusId === node.id ? h('rect', { className: 'stwd-node-ring', x: -2.5, y: -2.5, width: node.w + 5, height: node.h + 5, rx: 10 }) : null,
              h('text', { className: 'stwd-node-id', x: node.w - 10, y: 15, textAnchor: 'end' }, taskShortLabel(task)),
              h('text', { className: 'stwd-node-title' }, titleLines.map((line, index) => h('tspan', {
                key: 'line-' + index,
                x: 12,
                y: titleStart + index * 14,
              }, line))),
              gate ? null : h('g', { className: 'stwd-node-foot' },
                todo
                  ? h('text', { className: 'stwd-node-owner', x: 12, y: node.h - 8 }, text.todoNode)
                  : h('g', null,
                    h('circle', { className: 'stwd-node-avatar-bg', cx: 18, cy: node.h - 11, r: 6 }),
                    h('text', { className: 'stwd-node-avatar', x: 18, y: node.h - 7.5, textAnchor: 'middle' }, initialsOf(owner)),
                  ),
                todo ? null : h('text', { className: 'stwd-node-owner', x: 28, y: node.h - 8 }, owner === '' ? text.matrixUnassigned : owner),
                h('text', { className: 'stwd-node-count', x: node.w - 10, y: node.h - 8, textAnchor: 'end' }, scopes.length === 0 ? '' : scopes.length + ' ' + text.matrixFileUnit),
              ),
            );
          })),
          layout.nodes.length === 0 ? h('p', { className: 'stwd-note' }, text.graphEmpty) : null,
        ),
      );
    }

    // --- ownership matrix -----------------------------------------------------------

    function OwnershipMatrix({ text, grid, selectedId, onSelect }) {
      if (!grid || grid.total === 0) return h('p', { className: 'stwd-note' }, text.matrixEmpty);
      return h('div', { className: 'stwd-matrix-wrap' },
        h('table', { className: 'stwd-matrix' },
          h('caption', { className: 'stwd-sr-only' }, text.matrixCaption),
          h('thead', null, h('tr', null,
            h('th', { scope: 'col' }, text.matrixFile),
            grid.agents.map((agent) => h('th', { key: 'agent-' + (agent.key || '__none'), scope: 'col' },
              h(AgentAvatar, { name: agent.name, size: 18 }),
              h('span', { className: 'stwd-matrix-agent' }, agent.name === '' ? text.matrixUnassigned : agent.name),
            )),
            h('th', { scope: 'col' }, text.matrixOverlap),
          )),
          h('tbody', null, grid.rows.map((row) => h('tr', {
            key: row.path,
            className: row.overlap ? 'stwd-matrix-row-overlap' : undefined,
          },
            h('th', { scope: 'row', className: 'stwd-matrix-path', title: row.path }, row.path),
            row.cells.map((cell) => h('td', { key: 'cell-' + (cell.agent.key || '__none'), className: 'stwd-matrix-cell' },
              cell.hits.length === 0 ? h('span', { className: 'stwd-matrix-none', 'aria-hidden': 'true' }, '—') : cell.hits.map((hit) => h('button', {
                key: hit.taskId + '-' + hit.label,
                type: 'button',
                className: 'stwd-matrix-chip stwd-matrix-chip-' + hit.state + (selectedId === hit.taskId ? ' stwd-matrix-chip-selected' : ''),
                title: hit.title,
                'aria-pressed': selectedId === hit.taskId ? 'true' : 'false',
                onClick: () => onSelect(selectedId === hit.taskId ? null : hit.taskId),
              }, hit.label)),
            )),
            h('td', { className: 'stwd-matrix-overlap' }, row.overlap ? text.matrixOverlapMark : '—'),
          ))),
          grid.overflow > 0 ? h('tfoot', null, h('tr', null, h('td', { colSpan: grid.agents.length + 2, className: 'stwd-matrix-more' }, fmt(text.matrixMore, { n: grid.overflow })))) : null,
        ),
      );
    }

    // --- task detail + rows ---------------------------------------------------------

    function TaskDetail({ text, task, tasks, onClose, onSelect, onOpenOwner, onHover }) {
      const state = taskState(task);
      const known = new Set((tasks || []).filter(Boolean).map((entry) => String(entry.id)));
      const deps = dependencyIds(task, known);
      const missing = (Array.isArray(task.blockedBy) ? task.blockedBy : []).map(String).filter((id) => !known.has(id));
      const scopes = Array.isArray(task.writeScopes) ? task.writeScopes : [];
      const warnings = Array.isArray(task.warnings) ? task.warnings : [];
      const owner = typeof task.ownerName === 'string' ? task.ownerName : '';
      const meta = [];
      meta.push(h('span', { className: 'stwd-detail-meta-item', key: 'owner' },
        text.owner + ' ',
        owner === '' ? text.matrixUnassigned : h('span', { className: 'stwd-detail-owner' }, owner),
      ));
      if (deps.length > 0) {
        meta.push(h('span', { className: 'stwd-detail-meta-item', key: 'deps' }, text.deps + ' ',
          deps.map((id) => h('button', {
            key: 'dep-' + id,
            type: 'button',
            className: 'stwd-chip stwd-chip-mono stwd-chip-button',
            onClick: () => onSelect(id),
          }, taskShortLabel((tasks || []).find((entry) => entry && String(entry.id) === id) || { id }))),
        ));
      }
      if (missing.length > 0) {
        meta.push(h('span', { className: 'stwd-detail-meta-item stwd-detail-warn', key: 'missing' }, fmt(text.depMissing, { ids: missing.join('、') })));
      }
      if (scopes.length > 0) {
        meta.push(h('span', { className: 'stwd-detail-meta-item', key: 'scopes' }, text.scope + ' ',
          scopes.map((scope) => h('span', { key: 'scope-' + scope, className: 'stwd-chip stwd-chip-mono', title: scope }, String(scope))),
        ));
      }
      if (task.failed) {
        meta.push(h('span', { className: 'stwd-detail-meta-item stwd-detail-warn', key: 'failed' },
          text.failed + (task.attempts ? ' · ' + fmt(text.attempts, { n: task.attempts }) : '') + (task.lastError ? '：' + task.lastError : ''),
        ));
      }
      return h('section', {
        className: 'stwd-detail',
        'aria-label': text.detailTitle,
        onMouseEnter: () => onHover(task.id === undefined ? null : String(task.id)),
        onMouseLeave: () => onHover(null),
      },
        h('div', { className: 'stwd-detail-head' },
          h('span', { className: 'stwd-detail-id' }, taskShortLabel(task)),
          h('h4', { className: 'stwd-detail-title' }, taskTitle(task)),
          h(StatusPill, { tone: pillToneOf(state) }, stateLabel(text, state)),
          h('button', { type: 'button', className: 'stwd-iconbtn', 'aria-label': text.detailClose, title: text.detailClose, onClick: onClose }, '×'),
        ),
        h('div', { className: 'stwd-detail-meta' }, meta),
        warnings.length > 0 ? h('p', { className: 'stwd-detail-warn' }, text.overlap + '：' + warnings.join('；')) : null,
        typeof task.description === 'string' && task.description !== ''
          ? h('p', { className: 'stwd-detail-desc' }, task.description)
          : null,
        typeof onOpenOwner === 'function'
          ? h('div', { className: 'stwd-detail-actions' },
            h('button', { type: 'button', className: 'stwd-btn', onClick: () => onOpenOwner() }, text.openOwner + ' →'),
          )
          : null,
      );
    }

    function TaskListRow({ text, task, tasks, selected, onSelect }) {
      const state = taskState(task);
      const known = new Set((tasks || []).filter(Boolean).map((entry) => String(entry.id)));
      const byId = new Map((tasks || []).filter(Boolean).map((entry) => [String(entry.id), entry]));
      const deps = dependencyIds(task, known);
      const scopes = Array.isArray(task.writeScopes) ? task.writeScopes : [];
      const owner = typeof task.ownerName === 'string' ? task.ownerName : '';
      const meta = [];
      meta.push(h('span', { className: 'stwd-row-meta-group', key: 'owner' }, text.owner + ' ' + (owner === '' ? '—' : owner)));
      if (deps.length > 0) {
        const chips = deps.slice(0, 4).map((id) => h(Chip, { key: 'dep-' + id, mono: true, title: taskTitle(byId.get(id)) }, taskShortLabel(byId.get(id))));
        if (deps.length > 4) chips.push(h(Chip, { key: 'dep-more', mono: true }, '+' + String(deps.length - 4)));
        meta.push(h('span', { className: 'stwd-row-meta-group', key: 'deps' }, text.deps + ' ', chips));
      }
      if (scopes.length > 0) {
        const chips = scopes.slice(0, 2).map((scope, index) => h(Chip, { key: 'scope-' + index, mono: true, title: String(scope) }, String(scope)));
        if (scopes.length > 2) chips.push(h(Chip, { key: 'scope-more', mono: true, title: scopes.join('\n') }, '+' + String(scopes.length - 2)));
        meta.push(h('span', { className: 'stwd-row-meta-group', key: 'scope' }, text.scope + ' ', chips));
      }
      return h('button', {
        type: 'button',
        className: 'stwd-row' + (selected ? ' stwd-row-selected' : ''),
        'aria-pressed': selected ? 'true' : 'false',
        title: text.detailHint,
        onClick: () => onSelect(selected ? null : String(task.id)),
      },
        h(StatusDot, { tone: stateDotTone(state) }),
        h('span', { className: 'stwd-row-body' },
          h('span', { className: 'stwd-row-title', title: taskTitle(task) }, taskTitle(task)),
          h('span', { className: 'stwd-row-meta' }, meta),
        ),
        h(StatusPill, { tone: pillToneOf(state) }, stateLabel(text, state)),
        h('span', { className: 'stwd-row-arrow', 'aria-hidden': 'true' }, selected ? '▸' : ''),
      );
    }

    function SubagentRow({ text, row, running, title, onOpen }) {
      const tone = running ? 'progress' : row.activity === 'running' ? 'progress' : 'idle';
      return h('button', {
        type: 'button',
        className: 'stwd-row stwd-subrow',
        onClick: onOpen,
        title: text.openHint,
        'aria-label': row.label + ' · ' + (row.role === '' ? row.mode : row.role) + ' · ' + (running ? text.statusRunning : text.statusInactive),
      },
        h(AgentAvatar, { name: row.role || row.label, size: 20 }),
        h('span', { className: 'stwd-row-body' },
          h('span', { className: 'stwd-row-title', title: title || row.label }, title || row.label),
          h('span', { className: 'stwd-row-meta' },
            row.role === '' ? null : h(Chip, { mono: true }, row.role),
            h('span', { className: 'stwd-row-meta-group' }, shortId(row.id)),
          ),
        ),
        h(StatusDot, { tone }),
        h(StatusPill, { tone }, running ? text.statusRunning : text.statusInactive),
        h('span', { className: 'stwd-row-arrow', 'aria-hidden': 'true' }, '↗'),
      );
    }

    function ArtifactRow({ text, item, onOpen }) {
      return h('button', {
        type: 'button',
        className: 'stwd-row stwd-artrow',
        onClick: onOpen,
        title: item.path,
        'aria-label': text.openFile + '：' + item.name,
      },
        h('span', { className: 'stwd-artrow-glyph', 'aria-hidden': 'true' }, '▤'),
        h('span', { className: 'stwd-row-body' },
          h('span', { className: 'stwd-row-title stwd-mono' }, item.name),
          h('span', { className: 'stwd-row-meta' }, item.size > 0 ? String(Math.max(1, Math.round(item.size / 1024))) + ' KB' : item.path),
        ),
        h('span', { className: 'stwd-row-arrow', 'aria-hidden': 'true' }, '↗'),
      );
    }

    // --- the per-session board ------------------------------------------------------

    /**
     * The right-Sidebar body: one Session's Steward run as a task graph, the
     * subagents dispatched from it and the files it produced. Everything that
     * changes with the Session is read through the slot's own scope hooks; the
     * filesystem facts arrive through the injected `loadRun` face.
     * @param props - slot props plus the injected face.
     * @returns the board.
     */
    function StewardPanel(props) {
      const text = props.text;
      const lang = props.lang === 'en' ? 'en' : 'zh';
      const project = typeof props.useProjection === 'function' ? props.useProjection : () => undefined;
      const sessions = typeof props.useSessions === 'function' ? props.useSessions : () => undefined;
      const statuses = typeof props.useSessionStatus === 'function' ? props.useSessionStatus : () => undefined;

      const team = project('agentTeam');
      const todos = project('todos');
      const catalog = project('subagentCatalog');
      const sessionRows = sessions((state) => (state && state.byId ? state.byId : undefined));
      const statusState = statuses((state) => state);

      const [facts, setFacts] = useState({ status: 'loading', dir: '', run: null, plan: null, artifacts: [] });
      const [reload, setReload] = useState(0);
      const loadRun = props.loadRun;

      useEffect(() => {
        let live = true;
        const tick = () => {
          if (typeof loadRun !== 'function') {
            if (live) setFacts({ status: 'unsupported', dir: '', run: null, plan: null, artifacts: [] });
            return;
          }
          Promise.resolve()
            .then(() => loadRun())
            .then((next) => { if (live && next) setFacts(next); })
            .catch(() => { if (live) setFacts({ status: 'error', dir: '', run: null, plan: null, artifacts: [] }); });
        };
        tick();
        const timer = typeof setInterval === 'function' ? setInterval(tick, RUN_POLL_MS) : null;
        // Node-style hosts expose unref: the poller must never hold a process open.
        if (timer !== null && typeof timer === 'object' && typeof timer.unref === 'function') timer.unref();
        return () => {
          live = false;
          if (timer !== null) clearInterval(timer);
        };
      }, [loadRun, reload]);

      const board = useMemo(() => boardTasks(team), [team]);
      const runPlan = useMemo(() => planTasks(facts.run, facts.plan), [facts.run, facts.plan]);
      const todo = useMemo(() => todoTasks(todos), [todos]);
      const tasks = board || runPlan || todo || [];
      const source = board ? 'board' : runPlan ? 'run' : todo ? 'todo' : 'none';
      const stats = useMemo(() => runStats(tasks), [tasks]);
      const graph = useMemo(() => graphFacts(tasks), [tasks]);
      const model = useMemo(() => buildGraph({ tasks }), [tasks]);
      const ownership = useMemo(() => buildOwnership(tasks, 24), [tasks]);
      const subagents = useMemo(() => subagentRows(catalog), [catalog]);

      const [view, setView] = useState(() => (tasks.length > 14 ? 'list' : 'graph'));
      const [selectedId, setSelectedId] = useState(null);
      const [hoverId, setHoverId] = useState(null);

      const cyclic = graph.cycle !== null && graph.cycle !== undefined;
      const effectiveView = cyclic && view === 'graph' ? 'list' : view;
      const selected = selectedId === null ? null : tasks.find((task) => String(task.id) === selectedId) || null;

      const runningOf = (id) => {
        if (statusState && typeof statusState.get === 'function') {
          const entry = statusState.get(id);
          if (entry && typeof entry === 'object' && typeof entry.running === 'boolean') return entry.running;
        }
        const row = subagents.find((entry) => entry.id === id);
        return Boolean(row && row.activity === 'running');
      };
      const titleOf = (id) => {
        if (!sessionRows) return '';
        const row = sessionRows[id];
        return row && typeof row.title === 'string' ? row.title : '';
      };
      const openSession = (id, mode) => { if (typeof props.openSession === 'function') props.openSession(id, mode); };
      const ownerAction = (task) => {
        const owner = task && typeof task.ownerName === 'string' ? task.ownerName : '';
        if (owner === '') return undefined;
        const row = subagents.find((entry) => entry.label === owner || entry.role === owner);
        return row === undefined ? undefined : () => openSession(row.id, row.mode);
      };

      const hasAnything = tasks.length > 0 || subagents.length > 0 || facts.artifacts.length > 0 || facts.status === 'ready';
      const runState = facts.run && typeof facts.run.status === 'string' ? facts.run.status : '';
      const runStateLabel = runState === 'running' ? text.runRunning : runState === 'completed' ? text.runCompleted : runState === 'stopped' ? text.runStopped : '';
      const sourceLabel = source === 'board' ? text.sourceBoard : source === 'run' ? text.sourceRun : source === 'todo' ? text.sourceTodo : text.sourceNone;
      const sourceHint = source === 'board' ? text.tasksBoardHint : source === 'run' ? text.tasksRunHint : source === 'todo' ? text.tasksTodoHint : text.tasksEmpty;

      const viewTabs = h('div', { className: 'stwd-viewtabs', role: 'group', 'aria-label': text.viewGroup },
        [['graph', text.viewDag], ['list', text.viewList], ['matrix', text.viewMatrix]].map(([key, label]) => h('button', {
          key,
          type: 'button',
          className: 'stwd-viewtab' + (effectiveView === key ? ' stwd-viewtab-active' : ''),
          'aria-pressed': effectiveView === key ? 'true' : 'false',
          disabled: key === 'graph' && cyclic,
          onClick: () => setView(key),
        }, label)),
      );

      const tasksBody = tasks.length === 0
        ? h(EmptyState, { title: text.tasksEmptyTitle, note: sourceHint, steps: text.emptySteps })
        : h('div', { className: 'stwd-board' },
          cyclic ? h(Alert, { tone: 'warn' }, fmt(text.graphCycle, { ids: graph.cycle.join(' → ') })) : null,
          effectiveView === 'graph' ? h(DagCanvas, {
            text,
            graph: model,
            tasks,
            leadTitle: text.leadNode,
            leadSubtitle: sourceLabel,
            selectedId,
            hoverId,
            onSelect: (id) => setSelectedId(id === null ? null : String(id)),
            onHover: setHoverId,
          }) : null,
          effectiveView === 'list' ? h('div', { className: 'stwd-rows' }, tasks.map((task) => h(TaskListRow, {
            key: String(task.id),
            text,
            task,
            tasks,
            selected: selectedId !== null && String(task.id) === selectedId,
            onSelect: (id) => setSelectedId(id === null ? null : String(id)),
          }))) : null,
          effectiveView === 'matrix' ? h(OwnershipMatrix, {
            text,
            grid: ownership,
            selectedId,
            onSelect: (id) => setSelectedId(id === null ? null : String(id)),
          }) : null,
        );

      return h('div', { className: 'stwd-root stwd-panel' },
        styles(),
        h('header', { className: 'stwd-panel-head' },
          h('div', { className: 'stwd-panel-head-row' },
            h('span', { className: 'stwd-panel-badge', 'aria-hidden': 'true' }, h(StewardIcon, { size: 15 })),
            h('h2', { className: 'stwd-panel-title' }, text.title),
            h('button', {
              type: 'button',
              className: 'stwd-iconbtn stwd-panel-refresh',
              title: text.refresh,
              'aria-label': text.refresh,
              disabled: facts.status === 'loading',
              onClick: () => setReload((current) => current + 1),
            }, facts.status === 'loading' ? '…' : '⟳'),
          ),
          h('p', { className: 'stwd-panel-sub' }, text.subtitle),
          h('div', { className: 'stwd-runcard' },
            h(RunDonut, { text, done: stats.done, total: stats.total }),
            h('div', { className: 'stwd-run-body' },
              h(SegmentedProgress, { text, tasks }),
              h('div', { className: 'stwd-run-line' },
                h('span', { className: 'stwd-run-number' }, stats.done + '/' + stats.total),
                h('span', null, fmt(text.tasksCount, { tasks: stats.total, edges: graph.edges })),
                h('span', { className: 'stwd-run-dot', 'aria-hidden': 'true' }, '·'),
                h('span', null, text.subagentsTitle + ' ' + String(subagents.length)),
                runStateLabel === '' ? null : h(StatusPill, { tone: runState === 'completed' ? 'done' : runState === 'stopped' ? 'warn' : 'progress' }, runStateLabel),
              ),
              facts.dir === '' ? null : h('p', { className: 'stwd-run-dir', title: facts.dir },
                h('span', { className: 'stwd-run-dir-label' }, text.artifactsRun + ' '),
                h('span', { className: 'stwd-mono' }, facts.dir),
              ),
            ),
          ),
        ),
        h('section', { className: 'stwd-section' },
          h(SectionHead, {
            title: text.tasksSection,
            count: fmt(text.tasksCount, { tasks: stats.total, edges: graph.edges }),
            actions: h('span', { className: 'stwd-pill stwd-pill-src-' + source, title: fmt(text.sourceHint, { source: sourceLabel }) }, sourceLabel),
          }),
          h('p', { className: 'stwd-note' }, sourceHint),
          h(ErrorBoundary, { fallbackTitle: text.sectionFailed }, viewTabs),
          h(ErrorBoundary, { fallbackTitle: text.sectionFailed }, tasksBody),
          selected === null ? null : h(ErrorBoundary, { fallbackTitle: text.sectionFailed },
            h(TaskDetail, {
              text,
              task: selected,
              tasks,
              onClose: () => setSelectedId(null),
              onSelect: (id) => setSelectedId(id === null ? null : String(id)),
              onOpenOwner: ownerAction(selected),
              onHover: setHoverId,
            }),
          ),
        ),
        h('section', { className: 'stwd-section' },
          h(SectionHead, { title: text.subagentsTitle, count: String(subagents.length) }),
          subagents.length === 0
            ? h('p', { className: 'stwd-note' }, text.subagentsEmpty)
            : h('div', { className: 'stwd-rows' }, subagents.map((row) => h(SubagentRow, {
              key: row.id,
              text,
              row,
              running: runningOf(row.id),
              title: titleOf(row.id),
              onOpen: () => openSession(row.id, row.mode),
            }))),
          subagents.length === 0 ? null : h('p', { className: 'stwd-note' }, text.subagentsHint),
        ),
        h('section', { className: 'stwd-section' },
          h(SectionHead, { title: text.artifactsTitle, count: String(facts.artifacts.length) }),
          facts.status === 'unsupported' || facts.status === 'error'
            ? h(Alert, { tone: 'warn' }, text.artifactsMissing)
            : facts.artifacts.length === 0
              ? h('p', { className: 'stwd-note' }, text.artifactsEmpty)
              : h('div', { className: 'stwd-rows' }, facts.artifacts.map((item) => h(ArtifactRow, {
                key: item.path,
                text,
                item,
                onOpen: () => { if (typeof props.openFile === 'function') props.openFile(item.path); },
              }))),
          facts.artifacts.length === 0 ? null : h('p', { className: 'stwd-note' }, text.artifactsHint),
        ),
        hasAnything ? null : h('p', { className: 'stwd-note stwd-panel-foot' }, text.emptyBody),
      );
    }

    function TabTitle(props) {
      const text = props.text;
      return h('span', { className: 'stwd-tabtitle' },
        styles(),
        h(StewardIcon, { size: 14 }),
        h('span', { className: 'stwd-tabtitle-text' }, text.tabTitle),
      );
    }

    function HeaderButton(props) {
      const text = props.text;
      return h('span', { className: 'stwd-headwrap' },
        styles(),
        h('button', {
          type: 'button',
          className: 'stwd-headbtn',
          title: text.openPanel,
          'aria-label': text.openPanel,
          onClick: () => { if (typeof props.openPanel === 'function') props.openPanel(); },
        }, h(StewardIcon, { size: 16 })),
      );
    }

    // --- configuration --------------------------------------------------------------

    function selectionCells(options) {
      const text = options.text;
      const catalog = options.catalog;
      const selection = options.selection;
      const onChange = options.onChange;
      const group = groupOf(catalog, selection.provider);
      const modelInstance = modelOf(group, selection.model);
      const efforts = effortsOf(group, selection.model);
      const effortOptions = [{ value: '', label: text.modelDefault }];
      for (const effort of efforts) effortOptions.push({ value: effort.id, label: effort.name });
      if (selection.effort !== '' && !efforts.some((effort) => effort.id === selection.effort)) {
        effortOptions.push({ value: selection.effort, label: text.notAvailable + '：' + selection.effort });
      }
      const providers = (catalog.groups || []).map((entry) => ({ value: entry.id, label: entry.name || entry.id }));
      const models = group ? (group.models || []).map((entry) => ({ value: entry.id, label: entry.name || entry.id })) : [];
      const missing = selection.provider !== '' && group !== null && modelInstance === null;

      return [
        h('label', { className: 'stwd-cell', key: 'provider' },
          h('span', { className: 'stwd-cell-label' }, text.providerLabel),
          h('select', {
            className: 'stwd-select',
            value: selection.provider,
            onChange: (event) => onChange({ provider: event.target.value, model: '', effort: '' }),
          },
            h('option', { value: '' }, text.inherit),
            providers.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
            selection.provider !== '' && group === null ? h('option', { key: '__missing-provider', value: selection.provider }, text.notAvailable + '：' + selection.provider) : null,
          ),
        ),
        h('label', { className: 'stwd-cell', key: 'model' },
          h('span', { className: 'stwd-cell-label' }, text.modelLabel),
          h('select', {
            className: 'stwd-select',
            value: selection.model,
            disabled: selection.provider === '',
            onChange: (event) => onChange({ ...selection, model: event.target.value, effort: '' }),
          },
            h('option', { value: '' }, selection.provider === '' ? text.pickProvider : text.inherit),
            models.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
            selection.model !== '' && modelInstance === null ? h('option', { key: '__missing-model', value: selection.model }, text.notAvailable + '：' + selection.model) : null,
          ),
        ),
        h('label', { className: 'stwd-cell', key: 'effort' },
          h('span', { className: 'stwd-cell-label' }, text.effortLabel),
          h('select', {
            className: 'stwd-select',
            value: selection.effort,
            disabled: selection.provider === '' || selection.model === '' || efforts.length === 0,
            onChange: (event) => onChange({ ...selection, effort: event.target.value }),
          },
            effortOptions.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
          ),
        ),
        h('div', { className: 'stwd-cell stwd-cell-last', key: 'source' },
          h('span', { className: 'stwd-pill stwd-pill-src-' + options.source }, sourceOf(text, options.source)),
          options.clearable
            ? h('button', {
              type: 'button',
              className: 'stwd-iconbtn',
              title: text.clearRole,
              'aria-label': text.clearRole,
              onClick: options.onClear,
            }, '×')
            : h('span', { className: 'stwd-iconbtn-stub', 'aria-hidden': 'true' }),
          missing ? h('span', { className: 'stwd-cell-hint', title: text.missingSelection }, text.missingSelection) : null,
        ),
      ];
    }

    function ConfigSection({ ctx, text, lang, compact }) {
      const scope = useMemo(() => ctx.configForms.get(NS), [ctx]);
      const snapshot = useSnapshot(scope);
      const catalogRef = useRef({ status: 'idle', groups: [], failures: [] });
      const [catalog, setCatalog] = useState(catalogRef.current);
      const [local, setLocal] = useState({ draft: null, revision: null });
      const draft = local.draft;
      const draftRevision = local.revision;
      const [saving, setSaving] = useState(false);
      const [error, setError] = useState('');
      const [notice, setNotice] = useState('');

      const loadCatalog = useCallback(async () => {
        catalogRef.current = { status: 'loading', groups: [], failures: [] };
        setCatalog(catalogRef.current);
        try {
          const response = await ctx.remote.session.modelCatalog();
          if (!response || response.ok !== true) {
            const message = response && response.error && response.error.message ? response.error.message : 'model catalog unavailable';
            catalogRef.current = { status: 'error', groups: [], failures: [], error: message };
          } else {
            catalogRef.current = {
              status: 'ready',
              groups: Array.isArray(response.value.groups) ? response.value.groups : [],
              failures: Array.isArray(response.value.failures) ? response.value.failures : [],
            };
          }
        } catch (failure) {
          catalogRef.current = { status: 'error', groups: [], failures: [], error: (failure && failure.message) || String(failure) };
        }
        setCatalog(catalogRef.current);
      }, [ctx]);

      useEffect(() => {
        void loadCatalog();
      }, [loadCatalog]);

      // Adopt the host value once the namespace is ready. A local draft survives
      // external revisions (the mismatch is surfaced as a conflict instead).
      useEffect(() => {
        if (snapshot.status !== 'ready' || snapshot.value === undefined) return;
        setLocal((current) => {
          const incoming = draftFromValue(snapshot.value);
          if (current.draft === null) return { draft: incoming, revision: snapshot.revision };
          if (sameDraft(current.draft, incoming)) {
            return current.revision === snapshot.revision ? current : { draft: current.draft, revision: snapshot.revision };
          }
          return current;
        });
      }, [snapshot.status, snapshot.revision, snapshot.value]);

      const dirty = draft !== null && snapshot.status === 'ready' && !sameDraft(draft, draftFromValue(snapshot.value));
      const conflicted = dirty && draftRevision !== null && snapshot.revision !== draftRevision;
      const writable = snapshot.writable !== false;
      const invalid = draft !== null && (partialSelection(draft.defaults) || ROLE_IDS.some((id) => partialSelection(draft.roles[id])));

      const update = useCallback((key, selection) => {
        setLocal((current) => {
          if (current.draft === null) return current;
          const next = key === 'defaults'
            ? { ...current.draft, defaults: selection }
            : { ...current.draft, roles: { ...current.draft.roles, [key]: selection } };
          return { draft: next, revision: current.revision };
        });
        setNotice('');
        setError('');
      }, []);

      const discard = useCallback(() => {
        if (snapshot.status === 'ready') {
          setLocal({ draft: draftFromValue(snapshot.value), revision: snapshot.revision });
        }
        setNotice('');
        setError('');
      }, [snapshot.status, snapshot.revision, snapshot.value]);

      const save = useCallback(async () => {
        if (!draft || !dirty || conflicted || invalid || saving) return;
        const ops = [];
        const push = (basePath, selection) => {
          for (const field of FIELDS) ops.push({ op: 'set', path: [...basePath, field], value: selection[field] || '' });
        };
        push(['defaults'], draft.defaults);
        for (const id of ROLE_IDS) push(['roles', id], draft.roles[id]);
        setSaving(true);
        setError('');
        setNotice('');
        try {
          const accepted = await scope.mutate(ops, draftRevision === null ? undefined : draftRevision);
          if (!accepted) {
            setError(text.conflict);
          } else {
            const latest = scope.getSnapshot();
            setLocal({ draft: draftFromValue(latest.value), revision: latest.revision });
            setNotice(text.saved);
          }
        } catch (failure) {
          setError((failure && failure.message) || text.saveFailed);
        } finally {
          setSaving(false);
        }
      }, [draft, dirty, conflicted, invalid, saving, scope, draftRevision, text.conflict, text.saved, text.saveFailed]);

      if (snapshot.status === 'loading') {
        return h('section', { className: 'stwd-section' },
          compact ? null : h(SectionHead, { title: text.configTitle }),
          h(SkeletonRows, { rows: 3 }),
          h('p', { className: 'stwd-note' }, text.loading),
        );
      }
      if (snapshot.status === 'unavailable') {
        return h('section', { className: 'stwd-section' }, h(Alert, { tone: 'error' }, text.unavailableNs));
      }
      if (!draft) {
        return h('section', { className: 'stwd-section' },
          h(Alert, { tone: 'error' }, `${text.loadFailed}${error ? '：' + error : ''}`),
          h('div', { className: 'stwd-toolbar' },
            h('span', { className: 'stwd-spacer' }),
            h('button', { type: 'button', className: 'stwd-btn', onClick: discard }, text.retry),
          ),
        );
      }

      const rows = [];
      rows.push(h('div', { className: 'stwd-tr stwd-tr-head', key: '__head', 'aria-hidden': 'true' },
        h('span', { className: 'stwd-th' }, text.colRole),
        h('span', { className: 'stwd-th' }, text.providerLabel),
        h('span', { className: 'stwd-th' }, text.modelLabel),
        h('span', { className: 'stwd-th' }, text.effortLabel),
        h('span', { className: 'stwd-th stwd-th-last' }, text.colSource),
      ));
      rows.push(h('div', { className: 'stwd-tr stwd-tr-default', key: '__defaults' },
        h('span', { className: 'stwd-cell-role' },
          h('span', { className: 'stwd-role-name' }, text.defaultsTitle),
          h('span', { className: 'stwd-role-sub' }, text.defaultsSub),
        ),
        ...selectionCells({
          text,
          catalog,
          selection: draft.defaults,
          onChange: (selection) => update('defaults', selection),
          onClear: () => update('defaults', emptySelection()),
          clearable: draft.defaults.provider !== '',
          source: draft.defaults.provider === '' ? 'inherit' : 'defaults',
        }),
      ));
      for (const role of ROLES) {
        const selection = draft.roles[role.id] || emptySelection();
        const source = selectionSource(draft, role.id);
        rows.push(h('div', { className: 'stwd-tr', key: role.id },
          h('span', { className: 'stwd-cell-role' },
            h('span', { className: 'stwd-role-name', title: roleDesc(role, lang) }, roleName(role, lang)),
            h('span', { className: 'stwd-role-sub stwd-role-id' }, role.id),
          ),
          ...selectionCells({
            text,
            catalog,
            selection,
            onChange: (next) => update(role.id, next),
            onClear: () => update(role.id, emptySelection()),
            clearable: selection.provider !== '',
            source,
          }),
        ));
      }

      return h('section', { className: 'stwd-section' },
        compact ? h('h3', { className: 'stwd-section-title' }, text.configTitle) : h(SectionHead, { title: text.configTitle, count: text.rolesTitle + ' ' + String(ROLES.length) }),
        h('p', { className: 'stwd-note' }, text.configSub),
        error ? h(Alert, { tone: 'error' }, error) : null,
        notice ? h(Alert, { tone: 'ok' }, notice) : null,
        conflicted ? h(Alert, { tone: 'warn' }, text.externalUpdate) : null,
        invalid ? h(Alert, { tone: 'warn' }, text.invalidRoute) : null,
        !writable ? h(Alert, { tone: 'warn' }, text.readOnly) : null,
        catalog.status === 'error' ? h(Alert, { tone: 'warn' }, `${text.catalogEmpty}：${catalog.error || ''}`) : null,
        catalog.status === 'loading' ? h(SkeletonRows, { rows: 2 }) : null,
        h('div', { className: 'stwd-table', role: 'group', 'aria-label': text.configTitle }, rows),
        h('div', { className: 'stwd-toolbar' },
          h('span', { className: 'stwd-state ' + (dirty ? 'stwd-state-dirty' : 'stwd-state-ok') },
            h(StatusDot, { tone: dirty ? 'warn' : 'done' }),
            dirty ? text.unsaved : text.synced,
          ),
          h('span', { className: 'stwd-spacer' }),
          h('button', { type: 'button', className: 'stwd-btn', disabled: saving, onClick: () => { void loadCatalog(); } }, catalog.status === 'loading' ? text.loading : text.refreshCatalog),
          h('button', { type: 'button', className: 'stwd-btn', disabled: !dirty || saving, onClick: discard }, text.discard),
          h('button', { type: 'button', className: 'stwd-btn stwd-btn-primary', disabled: !dirty || saving || invalid || conflicted || !writable, onClick: () => { void save(); } }, saving ? text.saving : text.save),
        ),
      );
    }

    /** Settings → Steward: models and reasoning effort only. */
    function SettingsSection(props) {
      return h('div', { className: 'stwd-root stwd-root-compact' },
        styles(),
        h(ConfigSection, { ctx: props.ctx, text: props.text, lang: props.lang || 'zh', compact: false }),
      );
    }

    // --- stylesheet -----------------------------------------------------------------
    // Scoped to `.stwd-`, host scale, host theme tokens only: the panel has to read
    // as part of the application, not as a page bolted onto it.

    function styles() {
      return h('style', { key: 'stwd-css' }, STYLESHEET);
    }

    const STYLESHEET = [
      '/* --- shell ------------------------------------------------------------- */',
      '.stwd-root{--stwd-border:var(--dsw-alias-border-l2);--stwd-border-soft:var(--dsw-alias-border-l1);--stwd-border-strong:var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));--stwd-hover:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-1));--stwd-elev:var(--dsw-elevation-panel,0 1px 2px rgb(0 0 0 / 8%));--stwd-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:12.5px;line-height:18px;font-family:inherit}',
      '.stwd-root *{box-sizing:border-box}',
      '.stwd-panel{display:flex;flex-direction:column;gap:14px;height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;padding:12px 12px 20px}',
      '.stwd-panel>style{display:none}',
      '.stwd-root-compact{display:flex;flex-direction:column;gap:8px;min-width:0}',
      '.stwd-sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
      '.stwd-mono{font-family:var(--stwd-mono)}',
      '/* --- head --------------------------------------------------------------- */',
      '.stwd-panel-head{display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.stwd-panel-head-row{display:flex;align-items:center;gap:8px;min-width:0}',
      '.stwd-panel-badge{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;flex:none;border-radius:6px;border:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-brand-primary)}',
      '.stwd-panel-title{margin:0;font-size:14px;line-height:20px;font-weight:500;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-panel-sub{margin:0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-panel-foot{margin:0}',
      '.stwd-icon{display:block;flex:none}',
      '/* --- run card ----------------------------------------------------------- */',
      '.stwd-runcard{display:flex;align-items:center;gap:10px;padding:8px 10px;border:.5px solid var(--stwd-border-soft);border-radius:10px;background:var(--dsw-alias-bg-layer-1);min-width:0}',
      '.stwd-run-body{display:flex;flex-direction:column;gap:5px;min-width:0;flex:1}',
      '.stwd-run-line{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.stwd-run-number{font-size:13px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-primary)}',
      '.stwd-run-dot{opacity:.6}',
      '.stwd-run-dir{margin:0;display:flex;gap:4px;align-items:baseline;font-size:10.5px;line-height:15px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));min-width:0}',
      '.stwd-run-dir .stwd-mono{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-donut{position:relative;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;flex:none}',
      '.stwd-donut-track{stroke:var(--dsw-alias-bg-layer-2);stroke-width:4}',
      '.stwd-donut-value{stroke:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));stroke-width:4;stroke-linecap:round}',
      '.stwd-donut-text{position:absolute;font-size:9.5px;line-height:1;font-weight:500;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.stwd-segwrap{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.stwd-segbar{display:flex;align-items:center;gap:2px;height:5px}',
      '.stwd-seg{flex:1 1 0;min-width:3px;height:5px;border-radius:2px;background:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));opacity:.28}',
      '.stwd-seg-ready{opacity:.45}',
      '.stwd-seg-progress{background:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));opacity:1;animation:stwd-breathe 2s ease-in-out infinite}',
      '.stwd-seg-done{background:var(--dsw-alias-state-success-primary);opacity:1}',
      '.stwd-seg-blocked{background:var(--dsw-alias-state-warn-primary);opacity:1}',
      '.stwd-segticks{position:relative;height:3px}',
      '.stwd-seg-tick{position:absolute;top:0;width:1px;height:3px;background:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));transform:translateX(-50%)}',
      '@keyframes stwd-breathe{0%,100%{opacity:.55}50%{opacity:1}}',
      '/* --- sections ----------------------------------------------------------- */',
      '.stwd-section{display:flex;flex-direction:column;gap:8px;min-width:0}',
      '.stwd-section-head{display:flex;align-items:baseline;gap:8px;min-width:0}',
      '.stwd-section-title{margin:0;font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-primary)}',
      '.stwd-section-count{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-variant-numeric:tabular-nums}',
      '.stwd-section-actions{margin-left:auto;display:inline-flex;align-items:center;gap:6px;min-width:0}',
      '.stwd-note{margin:0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '/* --- pills, dots, chips ------------------------------------------------- */',
      '.stwd-pill{display:inline-flex;align-items:center;gap:4px;flex:none;padding:0 6px;border-radius:999px;border:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:16px;white-space:nowrap}',
      '.stwd-pill-progress{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)) 45%,transparent);color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary))}',
      '.stwd-pill-done{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 45%,transparent);color:var(--dsw-alias-state-success-primary)}',
      '.stwd-pill-warn{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 50%,transparent);color:var(--dsw-alias-state-warn-primary)}',
      '.stwd-pill-error{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 50%,transparent);color:var(--dsw-alias-state-error-primary)}',
      '.stwd-pill-src-board{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,transparent);color:var(--dsw-alias-brand-primary)}',
      '.stwd-pill-src-run{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)) 40%,transparent);color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary))}',
      '.stwd-dot{display:inline-block;width:6px;height:6px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-dot-progress{background:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));animation:stwd-breathe 2s ease-in-out infinite}',
      '.stwd-dot-done{background:var(--dsw-alias-state-success-primary)}',
      '.stwd-dot-warn{background:var(--dsw-alias-state-warn-primary)}',
      '.stwd-dot-error{background:var(--dsw-alias-state-error-primary)}',
      '.stwd-chip{display:inline-flex;align-items:center;max-width:100%;margin:0 3px 0 0;padding:0 5px;border-radius:4px;border:.5px solid var(--stwd-border);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-chip-mono{font-family:var(--stwd-mono)}',
      '.stwd-chip-button{cursor:pointer;font:inherit;font-family:var(--stwd-mono);font-size:10.5px}',
      '.stwd-chip-button:hover{background:var(--stwd-hover)}',
      '/* --- view tabs ---------------------------------------------------------- */',
      '.stwd-viewtabs{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:8px;border:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-1);align-self:flex-start}',
      '.stwd-viewtab{min-height:22px;padding:1px 9px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;line-height:16px;cursor:pointer}',
      '.stwd-viewtab:hover:not(:disabled){background:var(--stwd-hover);color:var(--dsw-alias-label-primary)}',
      '.stwd-viewtab:disabled{opacity:.45;cursor:default}',
      '.stwd-viewtab-active{background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);font-weight:500;box-shadow:var(--stwd-elev)}',
      '/* --- board + graph ------------------------------------------------------ */',
      '.stwd-board{position:relative;border:.5px solid var(--stwd-border-soft);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:6px;min-width:0}',
      '.stwd-graph{width:100%;min-width:0;overflow-x:auto;overflow-y:hidden}',
      '.stwd-graph-svg{display:block;max-width:none}',
      '.stwd-edge{fill:none;stroke:var(--stwd-border);stroke-width:1}',
      '.stwd-edge-dispatch{stroke:color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,var(--dsw-alias-border-l2));stroke-width:1.2}',
      '.stwd-edge-wait{stroke-dasharray:3 3}',
      '.stwd-edge-hot{stroke:var(--dsw-alias-brand-primary);stroke-width:1.5}',
      '.stwd-edge-dim{opacity:.35}',
      '.stwd-arrow-head{fill:var(--stwd-border)}',
      '.stwd-arrow-head-dispatch{fill:var(--dsw-alias-brand-primary)}',
      '.stwd-node{cursor:pointer;outline:none}',
      '.stwd-node-bg{fill:var(--dsw-alias-bg-layer-2);stroke:var(--stwd-border);stroke-width:1}',
      '.stwd-node:hover .stwd-node-bg{stroke:var(--stwd-border-strong)}',
      '.stwd-node-dim{opacity:.45}',
      '.stwd-node-accent{fill:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-node-ready .stwd-node-accent{fill:var(--dsw-alias-state-business-tertiary,var(--dsw-alias-border-l2))}',
      '.stwd-node-progress .stwd-node-accent{fill:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));animation:stwd-breathe 2s ease-in-out infinite}',
      '.stwd-node-done .stwd-node-accent{fill:var(--dsw-alias-state-success-primary)}',
      '.stwd-node-blocked .stwd-node-bg{stroke-dasharray:4 3}',
      '.stwd-node-blocked .stwd-node-accent{fill:var(--dsw-alias-state-warn-primary)}',
      '.stwd-node-selected .stwd-node-bg,.stwd-node-focused .stwd-node-bg{stroke:var(--dsw-alias-brand-primary);stroke-width:1.5}',
      '.stwd-node-ring{fill:none;stroke:var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));stroke-width:2;opacity:.55}',
      '.stwd-node-gate .stwd-node-bg{fill:var(--dsw-alias-bg-layer-1)}',
      '.stwd-node-todo .stwd-node-accent{fill:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-node-lead .stwd-node-lead-bg{fill:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,var(--dsw-alias-bg-layer-1));stroke:color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,transparent);stroke-width:1}',
      '.stwd-node-lead-dot{fill:var(--dsw-alias-brand-primary)}',
      '.stwd-node-lead-title{fill:var(--dsw-alias-label-primary);font-size:12px;font-weight:500}',
      '.stwd-node-lead-sub{fill:var(--dsw-alias-label-secondary);font-size:10px}',
      '.stwd-node-id{fill:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-family:var(--stwd-mono);font-size:10px}',
      '.stwd-node-title{fill:var(--dsw-alias-label-primary);font-size:11.5px}',
      '.stwd-node-owner{fill:var(--dsw-alias-label-secondary);font-family:var(--stwd-mono);font-size:10px}',
      '.stwd-node-count{fill:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:10px}',
      '.stwd-node-avatar-bg{fill:var(--dsw-alias-bg-layer-1);stroke:var(--stwd-border-soft);stroke-width:1}',
      '.stwd-node-avatar{fill:var(--dsw-alias-label-secondary);font-size:8px;font-weight:500}',
      '/* --- ownership matrix --------------------------------------------------- */',
      '.stwd-matrix-wrap{overflow-x:auto;min-width:0}',
      '.stwd-matrix{width:100%;border-collapse:separate;border-spacing:0;font-size:11px;line-height:16px}',
      '.stwd-matrix th,.stwd-matrix td{padding:5px 6px;text-align:left;vertical-align:middle;border-bottom:.5px solid var(--stwd-border-soft)}',
      '.stwd-matrix thead th{font-size:10.5px;line-height:15px;font-weight:400;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));background:var(--dsw-alias-bg-layer-1);position:sticky;top:0;z-index:1}',
      '.stwd-matrix-agent{display:inline-flex;align-items:center;gap:4px;margin-left:4px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-matrix-path{font-family:var(--stwd-mono);font-size:10.5px;line-height:15px;font-weight:400;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}',
      '.stwd-matrix-cell{white-space:nowrap}',
      '.stwd-matrix-none{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-matrix-chip{display:inline-flex;align-items:center;margin:0 3px 0 0;padding:0 5px;border-radius:4px;border:.5px solid var(--stwd-border);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-family:var(--stwd-mono);font-size:10.5px;line-height:16px;cursor:pointer}',
      '.stwd-matrix-chip:hover{border-color:var(--stwd-border-strong);background:var(--stwd-hover)}',
      '.stwd-matrix-chip-progress{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)) 40%,transparent)}',
      '.stwd-matrix-chip-done{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 40%,transparent)}',
      '.stwd-matrix-chip-blocked{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 45%,transparent)}',
      '.stwd-matrix-chip-selected{box-shadow:inset 0 0 0 1.5px var(--dsw-alias-brand-primary)}',
      '.stwd-matrix-row-overlap th,.stwd-matrix-row-overlap td{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 6%,transparent)}',
      '.stwd-matrix-overlap{font-size:10.5px;line-height:15px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));white-space:nowrap}',
      '.stwd-matrix-row-overlap .stwd-matrix-overlap{color:var(--dsw-alias-state-warn-primary);font-weight:500}',
      '.stwd-matrix-more{font-size:10.5px;line-height:15px;color:var(--dsw-alias-label-secondary);text-align:left}',
      '/* --- rows --------------------------------------------------------------- */',
      '.stwd-rows{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.stwd-row{display:flex;align-items:center;gap:7px;width:100%;padding:5px 7px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;min-width:0}',
      '.stwd-row:hover{background:var(--stwd-hover)}',
      '.stwd-row-selected{background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1))}',
      '.stwd-row-body{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}',
      '.stwd-row-title{font-size:12px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-row-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:10.5px;line-height:15px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-row-meta-group{display:inline-flex;align-items:center;gap:3px;min-width:0}',
      '.stwd-row-arrow{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-artrow-glyph{flex:none;width:16px;text-align:center;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '/* --- detail ------------------------------------------------------------- */',
      '.stwd-detail{display:flex;flex-direction:column;gap:6px;padding:9px 10px;border:.5px solid var(--stwd-border);border-radius:10px;background:var(--dsw-alias-bg-layer-2);min-width:0}',
      '.stwd-detail-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-width:0}',
      '.stwd-detail-id{font-family:var(--stwd-mono);font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-secondary);flex:none}',
      '.stwd-detail-title{margin:0;font-size:12px;line-height:18px;font-weight:500;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-detail-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-detail-meta-item{display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;min-width:0}',
      '.stwd-detail-owner{font-family:var(--stwd-mono);color:var(--dsw-alias-label-primary)}',
      '.stwd-detail-warn{font-size:10.5px;line-height:16px;color:var(--dsw-alias-state-warn-primary);margin:0}',
      '.stwd-detail-desc{margin:0;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap}',
      '.stwd-detail-scopes{display:flex;flex-wrap:wrap;gap:2px}',
      '.stwd-detail-actions{display:flex;align-items:center;gap:8px}',
      '/* --- avatars, alerts, empty states -------------------------------------- */',
      '.stwd-avatar{display:inline-flex;align-items:center;justify-content:center;flex:none;border-radius:50%;border:1px solid var(--stwd-border);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}',
      '.stwd-avatar-text{font-size:9px;line-height:1;font-weight:500}',
      '.stwd-alert{display:flex;gap:6px;margin:0;padding:6px 8px;border-radius:8px;border:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-1);font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-alert-warn{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 40%,transparent);color:var(--dsw-alias-state-warn-primary)}',
      '.stwd-alert-error{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 40%,transparent);color:var(--dsw-alias-state-error-primary)}',
      '.stwd-alert-ok{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 40%,transparent);color:var(--dsw-alias-state-success-primary)}',
      '.stwd-empty{display:flex;flex-direction:column;gap:6px;padding:10px;border:.5px dashed var(--stwd-border);border-radius:10px;min-width:0}',
      '.stwd-empty-title{margin:0;font-size:12px;line-height:18px;font-weight:500}',
      '.stwd-empty-text{margin:0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-empty-steps{margin:0;padding-left:16px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-skeleton-block{display:flex;flex-direction:column;gap:6px}',
      '.stwd-skeleton{display:block;height:12px;border-radius:4px;background:var(--dsw-alias-bg-layer-2)}',
      '/* --- controls ----------------------------------------------------------- */',
      '.stwd-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:.5px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:1;cursor:pointer}',
      '.stwd-iconbtn:hover:not(:disabled){background:var(--stwd-hover);color:var(--dsw-alias-label-primary)}',
      '.stwd-iconbtn:disabled{opacity:.5;cursor:default}',
      '.stwd-iconbtn-stub{display:inline-block;width:22px;height:22px}',
      '.stwd-btn{min-height:24px;padding:2px 10px;border:.5px solid var(--stwd-border);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;line-height:18px;cursor:pointer}',
      '.stwd-btn:hover:not(:disabled){background:var(--stwd-hover)}',
      '.stwd-btn:disabled{opacity:.5;cursor:default}',
      '.stwd-btn-primary{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground,var(--dsw-alias-label-primary))}',
      '.stwd-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '.stwd-spacer{flex:1}',
      '.stwd-state{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-state-dirty{color:var(--dsw-alias-state-warn-primary)}',
      '.stwd-select{width:100%;min-height:24px;padding:1px 6px;border:.5px solid var(--stwd-border);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;line-height:18px}',
      '.stwd-select:disabled{opacity:.55}',
      '/* --- configuration table ------------------------------------------------ */',
      '.stwd-table{display:flex;flex-direction:column;border:.5px solid var(--stwd-border-soft);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}',
      '.stwd-tr{display:grid;grid-template-columns:minmax(112px,1.1fr) repeat(3,minmax(96px,1fr)) minmax(84px,.8fr);gap:8px;align-items:center;padding:7px 9px;border-top:.5px solid var(--stwd-border-soft)}',
      '.stwd-tr:first-child{border-top:0}',
      '.stwd-tr-head{padding:5px 9px;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1))}',
      '.stwd-tr-default{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 4%,transparent)}',
      '.stwd-th{font-size:10.5px;line-height:16px;font-weight:400;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-th-last,.stwd-cell-last{display:flex;align-items:center;gap:5px;justify-content:flex-start}',
      '.stwd-cell{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.stwd-cell-label{font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-cell-hint{font-size:10px;line-height:14px;color:var(--dsw-alias-state-warn-primary)}',
      '.stwd-cell-role{display:flex;flex-direction:column;gap:1px;min-width:0}',
      '.stwd-role-name{font-size:12px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-role-sub{font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-role-id{font-family:var(--stwd-mono)}',
      '/* --- host header + tab chip --------------------------------------------- */',
      '.stwd-headbtn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.stwd-headbtn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary)}',
      '.stwd-headwrap{display:inline-flex;align-items:center}',
      '.stwd-headwrap>style,.stwd-tabtitle>style{display:none}',
      '.stwd-tabtitle{display:inline-flex;align-items:center;gap:5px;min-width:0}',
      '.stwd-tabtitle-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '/* --- responsive --------------------------------------------------------- */',
      '@media (max-width:520px){',
      '.stwd-tr{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:stretch}',
      '.stwd-tr-head{display:none}',
      '.stwd-cell-role{grid-column:1 / -1}',
      '.stwd-cell-last{grid-column:1 / -1}',
      '.stwd-cell-label{display:block}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
      '.stwd-root *{animation:none !important;transition:none !important}',
      '}',
    ].join('\n');

    // --- plugin ---------------------------------------------------------------------

    /** Open this Session's board tab; false when the host offers no right Sidebar. */
    function openPanel(ctx) {
      const right = ctx ? ctx.sidebarRight : undefined;
      if (!right || typeof right.openTab !== 'function') return false;
      try {
        right.openTab(TAB_KIND);
        return true;
      } catch {
        return false;
      }
    }

    /** The injected face of one Session's board: filesystem facts and navigation. */
    function makePanelFace(ctx, sessionId, text, lang) {
      const loader = createRunLoader(ctx, sessionId);
      return {
        text,
        lang,
        loadRun: () => loader.load(),
        openSession: (childId, mode) => {
          const right = ctx ? ctx.sidebarRight : undefined;
          if (right && typeof right.openResource === 'function') {
            try {
              right.openResource(subagentAddressOf({ id: childId, mode }, sessionId), { kind: 'subagentchat' });
              return;
            } catch {
              // fall back to the workspace's own session switch
            }
          }
          const workspace = ctx ? ctx.uiWorkspace : undefined;
          if (workspace && typeof workspace.openSession === 'function') {
            try {
              workspace.openSession(childId);
            } catch {
              // nothing else to try
            }
          }
        },
        openFile: (workspacePath) => {
          const right = ctx ? ctx.sidebarRight : undefined;
          if (!right || typeof right.openResource !== 'function') return;
          try {
            right.openResource(fileAddressOf(sessionId, workspacePath));
          } catch {
            // a file the host refuses to open is not worth a broken panel
          }
        },
        openPanel: () => { openPanel(ctx); },
      };
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.session', 'configForms', 'uiWorkspace'],
      apply(ctx) {
        const lang = () => pickLang(ctx);
        const textOf = () => STRINGS[lang()] || STRINGS.zh;

        // Settings → Steward: models and reasoning effort, nothing else. This half
        // needs only the settings namespace, so it survives a profile without the
        // right Sidebar.
        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'steward',
          order: 50,
          locale: NS,
          label: () => textOf().nav,
        }, () => h(SettingsSection, { ctx, text: textOf(), lang: lang() }))), 'steward: settings section');

        // The board is a per-Session right-Sidebar tab: the type (what opens), its
        // body and chip title, the header button, and the rule that opens it when a
        // Steward dispatch starts. All of it needs the Sidebar services, so it is
        // registered on an injected child context instead of gating the whole plugin.
        const withRightbar = (run) => {
          if (typeof ctx.inject === 'function') {
            ctx.inject(['sidebarRight', 'sidebarRightTabs', 'sessions'], run);
            return;
          }
          // No deferral available: only run when the services are truly mounted.
          if (!ctx.sidebarRight || !ctx.sidebarRightTabs) return;
          run(ctx);
        };

        withRightbar((sctx) => {
          sctx.effect(() => sctx.sidebarRightTabs.register({
            id: TAB_ID,
            kind: TAB_KIND,
            title: () => textOf().tabTitle,
            guide: [{
              id: 'steward-board',
              order: 40,
              title: () => textOf().tabTitle,
              description: () => textOf().subtitle,
            }],
          }), 'steward: board tab type');

          sctx.effect(() => sctx.slots.inject('sidebar.right.pane.tab', () => sctx.slots.register({
            name: 'sidebar.right.pane.tab',
            key: TAB_ID,
            locale: NS,
            inject: (sessionId) => makePanelFace(sctx, sessionId, textOf(), lang()),
          }, StewardPanel)), 'steward: board body');

          sctx.effect(() => sctx.slots.inject('sidebar.right.pane.tab.title', () => sctx.slots.register({
            name: 'sidebar.right.pane.tab.title',
            key: TAB_ID,
          }, (props) => h(TabTitle, { text: textOf() }))), 'steward: board title');

          sctx.effect(() => sctx.slots.inject('conversation.session.header.utilities', () => sctx.slots.register({
            name: 'conversation.session.header.utilities',
            id: 'steward-board',
            order: -6,
            locale: NS,
            inject: () => ({ text: textOf(), openPanel: () => { openPanel(sctx); } }),
          }, HeaderButton)), 'steward: header button');

          // Auto-open: the first Steward dispatch in a Session opens the board once,
          // so the user watches the run live without asking for it. Closing the tab
          // afterwards keeps it closed for that Session. A dispatch is recognised by
          // its role-prefixed label; when that is absent (an older host half, or a
          // plain `subagent` call inside a Steward run) the run directory on disk is
          // the evidence, probed once per Session.
          sctx.effect(() => {
            const opened = new Set();
            const probed = new Set();
            const loaders = new Map();
            const list = sctx.sessions ? sctx.sessions.list : undefined;
            if (!list || typeof list.getSnapshot !== 'function' || typeof list.subscribe !== 'function') return undefined;
            const right = sctx.sidebarRight;
            const openOnce = (mounted) => {
              if (opened.has(mounted)) return;
              opened.add(mounted);
              if (!openPanel(sctx)) opened.delete(mounted);
            };
            const loaderOf = (sessionId) => {
              if (!loaders.has(sessionId)) loaders.set(sessionId, createRunLoader(sctx, sessionId));
              return loaders.get(sessionId);
            };
            const tick = () => {
              try {
                const state = list.getSnapshot();
                const mounted = right && right.mounted && typeof right.mounted.getSnapshot === 'function' ? right.mounted.getSnapshot() : undefined;
                if (!mounted || opened.has(mounted)) return;
                const projection = state && state.projectionsBySession ? state.projectionsBySession[mounted] : undefined;
                const catalog = projection && projection.values ? projection.values.subagentCatalog : undefined;
                if (!Array.isArray(catalog) || catalog.length === 0) return;
                const dispatched = catalog.some((entry) => entry && typeof entry.label === 'string' && ROLE_LABEL.test(entry.label));
                if (dispatched) {
                  openOnce(mounted);
                  return;
                }
                if (probed.has(mounted)) return;
                probed.add(mounted);
                Promise.resolve()
                  .then(() => loaderOf(mounted).load())
                  .then((facts) => { if (facts && facts.dir) openOnce(mounted); })
                  .catch(() => {});
              } catch {
                // the board is a convenience; never break the app for it
              }
            };
            const unsubscribe = list.subscribe(tick);
            tick();
            return typeof unsubscribe === 'function' ? unsubscribe : undefined;
          }, 'steward: auto-open the board on a Steward dispatch');
        });
      },
    };
  },
});
