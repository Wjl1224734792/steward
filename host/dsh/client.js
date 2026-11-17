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
    /** Artifact re-read cadence: agents are live projections, only the run directory is polled. */
    const RUN_POLL_MS = 15000;
    const MAX_RUN_DIRS = 3;
    const MAX_ARTIFACTS = 24;

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
        tabTitle: 'Steward 团队',
        title: 'Steward 团队',
        subtitle: '角色 · 模型 · 任务 · 状态',
        openPanel: '打开 Steward 团队面板',
        refresh: '刷新',
        viewGroup: '视图',
        viewGraph: '图',
        viewList: '列表',
        taskProgress: '任务进度',
        taskProgressAria: '任务进度：完成 {done}/{total}',
        taskSourceTeam: 'Agent Teams 任务板',
        taskSourceTodo: '会话任务列表',
        taskDone: '完成',
        taskRunning: '进行中',
        taskBlocked: '被阻塞',
        taskEmpty: '原生任务列表为空',
        roster: '智能体',
        lead: 'Lead · 本会话',
        leadRole: '主代理',
        leadHere: '本会话',
        subagentRole: '子代理',
        laneWaiting: '等待输入',
        laneRunning: '运行中',
        lanePending: '待开始',
        laneDone: '已完成',
        laneIdle: '空闲',
        stateWaiting: '等待输入',
        stateRunning: '运行中',
        statePending: '待开始',
        stateDone: '已完成',
        stateIdle: '空闲',
        stateWaitingHint: '这个智能体在等你确认或回答，去它的会话里处理。',
        modelPending: '模型待定',
        tokensShort: 'tok',
        noDescription: '（没有任务描述）',
        detailTitle: '智能体详情',
        detailClose: '关闭详情',
        detailTask: '任务',
        detailModel: '模型',
        detailProvider: '提供方',
        detailEffort: '思考强度',
        detailEffortDefault: '默认',
        detailState: '状态',
        detailElapsed: '用时',
        detailTurns: '轮次',
        detailSteps: '步骤',
        detailMode: '模式',
        detailSession: '子会话',
        detailTokens: '用量',
        tokenInput: '输入',
        tokenOutput: '输出',
        tokenCacheRead: '缓存读',
        tokenCacheWrite: '缓存写',
        modeOneShot: '一次性',
        modeContinuable: '可继续',
        modeUnknown: '未知',
        openSession: '打开会话',
        detailToggle: '详情',
        canvasHint: '拖节点移动 · 拖空白平移 · Ctrl+滚轮缩放 · 双击复位',
        graphCanvasAria: '智能体图画布，{nodes} 个智能体；可拖拽平移、缩放',
        stageSpec: '需求',
        stageArchitect: '架构',
        stageImpl: '实施',
        stageQuality: '质量',
        stageAccept: '验收',
        stageReview: '评审',
        stageOther: '其他',
        zoomFit: '适应窗口',
        zoomGroup: '缩放',
        relayout: '重新布局',
        filterGroup: '过滤',
        filterAll: '全部',
        filterHideDone: '隐藏已完成',
        filterActive: '只看活跃',
        filterHidden: '已隐藏 {count} 个',
        collapseStage: '折叠 {stage}',
        expandStage: '展开 {stage}',
        emptyFiltered: '当前过滤下没有智能体',
        emptyFilteredHint: '换个过滤条件，或恢复「全部」。',
        zoomIn: '放大',
        zoomOut: '缩小',
        zoomReset: '复位视图',
        nativeListNote: '任务进度取自 DSH 自带的任务列表；这里不重复展示任务。',
        emptyTitle: '这个会话还没有派发智能体',
        emptyBody: 'Lead 用 steward_dispatch 派一个角色后，这里会画出它的角色、模型、任务与状态。',
        emptySteps: [
          '让 Lead 调 steward_dispatch(role=..., description=..., prompt=...)。',
          '节点出现后点它就能进入子会话。',
          '任务进度看原生任务列表（共享任务板 / 会话任务列表）。',
        ],
        artifactsTitle: '产物',
        artifactsEmpty: '在 tmp/steward/<run>/ 下还没有找到产物。',
        artifactsMissing: '宿主没有提供工作区文件服务，读不到产物。',
        artifactsRun: '运行目录',
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
        tabTitle: 'Steward team',
        title: 'Steward team',
        subtitle: 'Role · model · task · state',
        openPanel: 'Open the Steward team panel',
        refresh: 'Refresh',
        viewGroup: 'View',
        viewGraph: 'Graph',
        viewList: 'List',
        taskProgress: 'Task progress',
        taskProgressAria: 'Task progress: {done} of {total} done',
        taskSourceTeam: 'Agent Teams board',
        taskSourceTodo: 'Session task list',
        taskDone: 'done',
        taskRunning: 'in progress',
        taskBlocked: 'blocked',
        taskEmpty: 'The native task list is empty',
        roster: 'Agents',
        lead: 'Lead · this session',
        leadRole: 'Lead',
        leadHere: 'this session',
        subagentRole: 'Subagent',
        laneWaiting: 'Waiting on you',
        laneRunning: 'Running',
        lanePending: 'Not started',
        laneDone: 'Completed',
        laneIdle: 'Idle',
        stateWaiting: 'waiting',
        stateRunning: 'running',
        statePending: 'not started',
        stateDone: 'completed',
        stateIdle: 'idle',
        stateWaitingHint: 'This agent is waiting for your answer or approval — open its session to respond.',
        modelPending: 'model pending',
        tokensShort: 'tok',
        noDescription: '(no task description)',
        detailTitle: 'Agent details',
        detailClose: 'Close details',
        detailTask: 'Task',
        detailModel: 'Model',
        detailProvider: 'Provider',
        detailEffort: 'Reasoning effort',
        detailEffortDefault: 'default',
        detailState: 'State',
        detailElapsed: 'Elapsed',
        detailTurns: 'Turns',
        detailSteps: 'Steps',
        detailMode: 'Mode',
        detailSession: 'Child session',
        detailTokens: 'Usage',
        tokenInput: 'input',
        tokenOutput: 'output',
        tokenCacheRead: 'cache read',
        tokenCacheWrite: 'cache write',
        modeOneShot: 'one-shot',
        modeContinuable: 'continuable',
        modeUnknown: 'unknown',
        openSession: 'Open session',
        detailToggle: 'Details',
        canvasHint: 'Drag a card to move it · drag empty space to pan · Ctrl+wheel to zoom · double-click to reset',
        graphCanvasAria: 'Agent graph canvas, {nodes} agents; drag to pan and scroll to zoom',
        stageSpec: 'Spec',
        stageArchitect: 'Architecture',
        stageImpl: 'Implementation',
        stageQuality: 'Quality',
        stageAccept: 'Acceptance',
        stageReview: 'Review',
        stageOther: 'Other',
        zoomFit: 'Fit to view',
        zoomGroup: 'Zoom',
        relayout: 'Re-layout',
        filterGroup: 'Filter',
        filterAll: 'All',
        filterHideDone: 'Hide done',
        filterActive: 'Active only',
        filterHidden: '{count} hidden',
        collapseStage: 'Collapse {stage}',
        expandStage: 'Expand {stage}',
        emptyFiltered: 'No agent under this filter',
        emptyFilteredHint: 'Change the filter, or switch back to All.',
        zoomIn: 'Zoom in',
        zoomOut: 'Zoom out',
        zoomReset: 'Reset view',
        nativeListNote: 'Task progress is counted from the task list DSH itself keeps; the tasks are not repeated here.',
        emptyTitle: 'No agent dispatched in this session yet',
        emptyBody: 'Once the lead calls steward_dispatch, its role, model, task and state are drawn here.',
        emptySteps: [
          'Have the lead call steward_dispatch(role=..., description=..., prompt=...).',
          'Click a node to open that child session.',
          'Read task progress from the native task list (shared board or session tasks).',
        ],
        artifactsTitle: 'Artifacts',
        artifactsEmpty: 'No artifacts under tmp/steward/<run>/ yet.',
        artifactsMissing: 'The host serves no workspace files, so artifacts are unavailable.',
        artifactsRun: 'Run directory',
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

    // --- display formatting ---------------------------------------------------------

    function pad2(value) {
      return String(value).padStart(2, '0');
    }

    /** 930 → `15m 30s`; 9300 → `2h 35m`; a sub-minute span keeps seconds. */
    function fmtDuration(ms) {
      const value = Number(ms);
      if (!Number.isFinite(value) || value <= 0) return '0s';
      const total = Math.max(0, Math.round(value / 1000));
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const seconds = total % 60;
      if (hours > 0) return hours + 'h ' + pad2(minutes) + 'm';
      if (minutes > 0) return minutes + 'm ' + pad2(seconds) + 's';
      return seconds + 's';
    }

    /** 850 → `850`, 8420 → `8.4k`, 23400 → `23k`; absent usage is an em dash, never a fake zero. */
    function fmtTokens(value) {
      const number = Number(value);
      if (!Number.isFinite(number) || number <= 0) return '—';
      if (number < 1000) return String(Math.round(number));
      if (number < 10000) return round1(number / 1000) + 'k';
      return String(Math.round(number / 1000)) + 'k';
    }

    /** The four disjoint provider buckets a token usage projection reports. */
    const TOKEN_FIELDS = ['uncachedInputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'];

    /** Sum the usage buckets; null when the Session reported none at all. */
    function tokenTotals(usage) {
      if (usage === null || typeof usage !== 'object') return null;
      const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
      let seen = false;
      for (const field of TOKEN_FIELDS) {
        const value = Number(usage[field]);
        if (!Number.isFinite(value)) continue;
        seen = true;
        if (field === 'uncachedInputTokens') totals.input += value;
        else if (field === 'outputTokens') totals.output += value;
        else if (field === 'cacheReadTokens') totals.cacheRead += value;
        else totals.cacheWrite += value;
      }
      if (!seen) return null;
      totals.total = totals.input + totals.output + totals.cacheRead + totals.cacheWrite;
      return totals;
    }

    // --- agents ---------------------------------------------------------------------
    // A dispatched Steward child is the unit of this panel: one catalog row, its Session
    // summary, its projections and its live status become one drawable agent. Nothing
    // here reads a task file — tasks stay in the host's native task list.

    /** Dispatch labels are `<role> · <description>`; the prefix names the specialist. */
    const ROLE_LABEL = /^(pm|architect|backend-dev|frontend-dev|qa-engineer|browser-tester|reviewer)\s*·\s*/;
    const ROLE_GLYPH = {
      pm: '需',
      architect: '架',
      'backend-dev': '后',
      'frontend-dev': '前',
      'qa-engineer': '测',
      'browser-tester': '验',
      reviewer: '审',
    };
    /** Lane order: whoever needs a human first, then who works, then history. */
    const AGENT_STATES = ['waiting', 'running', 'pending', 'done', 'idle'];
    const STATE_LABEL_KEY = {
      waiting: 'stateWaiting',
      running: 'stateRunning',
      pending: 'statePending',
      done: 'stateDone',
      idle: 'stateIdle',
    };

    function roleOf(label) {
      const match = ROLE_LABEL.exec(typeof label === 'string' ? label : '');
      return match ? match[1] : '';
    }

    function roleNameOf(roleId, lang) {
      const entry = ROLES.find((role) => role.id === roleId);
      return entry === undefined ? roleId : roleName(entry, lang);
    }

    function glyphOf(roleId) {
      if (ROLE_GLYPH[roleId] !== undefined) return ROLE_GLYPH[roleId];
      return roleId === '' ? '·' : initialsOf(roleId);
    }

    function stateLabelOf(state, text) {
      const key = STATE_LABEL_KEY[state];
      return text[key] || text.stateIdle;
    }

    function stateTone(state) {
      if (state === 'waiting') return 'warn';
      if (state === 'running') return 'progress';
      if (state === 'done') return 'done';
      return 'idle';
    }

    /** The model a Session actually ran with, else the one its next step will use. */
    function modelOfValues(values) {
      const selection = values && values.modelSelection ? values.modelSelection : null;
      const pick = selection === null ? null : selection.lastUsed || selection.next;
      if (!pick || typeof pick.model !== 'string' || pick.model === '') return null;
      return {
        provider: typeof pick.provider === 'string' ? pick.provider : '',
        model: pick.model,
        effort: typeof pick.reasoningEffort === 'string' ? pick.reasoningEffort : '',
      };
    }

    /** `provider/model @ effort`, or null while nothing has run yet. */
    function modelLabelOf(row, text) {
      if (!row || row.model === null) return text.modelPending;
      const effort = row.model.effort === '' ? '' : ' @ ' + row.model.effort;
      return row.model.model + effort;
    }

    function elapsedOf(timing, running, now) {
      const settled = timing && Number.isFinite(Number(timing.settledMs)) ? Number(timing.settledMs) : 0;
      const active = timing ? timing.active : null;
      if (running && active && Number.isFinite(Number(active.since))) {
        return settled + Math.max(0, now - Number(active.since));
      }
      return settled;
    }

    function stateOf(input) {
      if (input.running) return input.waiting ? 'waiting' : 'running';
      const timing = input.timing;
      if (timing && timing.lastTurnCompleted === true) return 'done';
      if (input.tokens !== null && input.tokens.total > 0) return 'idle';
      return 'pending';
    }

    /**
     * One drawable dispatcher row from the native facts of one child Session.
     * @param options - catalog entry, Session summary, projection values, status, clock, copy.
     * @returns the row the graph and the list render.
     */
    function agentRow(options) {
      const entry = options.entry;
      const summary = options.summary || null;
      const values = options.values || {};
      const status = options.status || null;
      const text = options.text;
      const now = Number.isFinite(Number(options.now)) ? Number(options.now) : 0;
      const label = typeof entry.label === 'string' && entry.label !== ''
        ? entry.label
        : typeof entry.name === 'string' ? entry.name : '';
      const role = roleOf(label);
      const stripped = label.replace(ROLE_LABEL, '').trim();
      const title = summary && typeof summary.title === 'string' ? summary.title : '';
      const displayTitle = summary && typeof summary.displayTitle === 'string' ? summary.displayTitle : '';
      const model = modelOfValues(values);
      const tokens = tokenTotals(values.tokenUsage);
      const timing = values.subagentTiming || null;
      const stats = values.sessionStats || null;
      const running = status && typeof status.running === 'boolean'
        ? status.running
        : Boolean(summary && summary.running);
      const waiting = Boolean(status && status.pendingInteraction !== undefined && status.pendingInteraction !== null);
      return {
        id: String(entry.id),
        lead: false,
        role,
        roleName: role === '' ? '' : roleNameOf(role, options.lang),
        glyph: glyphOf(role),
        description: stripped !== '' ? stripped : displayTitle,
        title,
        mode: entry.mode === 'continuable' ? 'continuable' : entry.mode === 'one-shot' ? 'one-shot' : 'unknown',
        state: stateOf({ running, waiting, timing, tokens }),
        running,
        waiting,
        model,
        tokens,
        turns: stats && Number.isFinite(Number(stats.turns)) ? Number(stats.turns) : null,
        steps: stats && Number.isFinite(Number(stats.steps)) ? Number(stats.steps) : null,
        createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : 0,
        elapsedMs: elapsedOf(timing, running, now),
        text,
      };
    }

    /** The Session the panel is docked in: it dispatched the roster. */
    function leadRowOf(options) {
      const summary = options.summary || null;
      const values = options.values || {};
      const status = options.status || null;
      const text = options.text;
      const model = modelOfValues(values);
      const tokens = tokenTotals(values.tokenUsage);
      const stats = values.sessionStats || null;
      const running = status && typeof status.running === 'boolean'
        ? status.running
        : Boolean(summary && summary.running);
      const waiting = Boolean(status && status.pendingInteraction !== undefined && status.pendingInteraction !== null);
      const title = summary && typeof summary.displayTitle === 'string' ? summary.displayTitle : '';
      return {
        id: String(options.sessionId),
        lead: true,
        role: '',
        roleName: text.leadRole,
        glyph: 'L',
        description: title,
        title,
        mode: 'continuable',
        state: stateOf({ running, waiting, timing: null, tokens }),
        running,
        waiting,
        model,
        tokens,
        turns: stats && Number.isFinite(Number(stats.turns)) ? Number(stats.turns) : null,
        steps: stats && Number.isFinite(Number(stats.steps)) ? Number(stats.steps) : null,
        createdAt: 0,
        elapsedMs: 0,
        text,
      };
    }

    /** Roster counts and the two sums the header reports. */
    function fleetFacts(rows) {
      const list = (rows || []).filter(Boolean);
      const counts = { waiting: 0, running: 0, pending: 0, done: 0, idle: 0 };
      let tokens = 0;
      let elapsed = 0;
      for (const row of list) {
        if (counts[row.state] === undefined) counts[row.state] = 0;
        counts[row.state] += 1;
        if (row.tokens !== null) tokens += row.tokens.total;
        if (Number.isFinite(row.elapsedMs)) elapsed += row.elapsedMs;
      }
      return {
        total: list.length,
        counts,
        tokens,
        elapsed,
        active: counts.running > 0 || counts.waiting > 0,
      };
    }

    // --- native task progress -------------------------------------------------------
    // The panel shows how far the native task list got, never the tasks themselves.

    function summarizeProgress(source, segments) {
      const counts = { done: 0, running: 0, pending: 0, blocked: 0 };
      for (const state of segments) counts[state] += 1;
      return {
        source,
        segments,
        total: segments.length,
        done: counts.done,
        running: counts.running,
        pending: counts.pending,
        blocked: counts.blocked,
      };
    }

    /**
     * Counts from the host's own task systems, in authority order: the Agent Teams
     * shared board (what `steward_board` syncs into) first, then the Session's own
     * `todo_write` list. An empty source falls through; no tasks at all means no bar.
     * @param team - the Session's `agentTeam` projection.
     * @param todos - the Session's `todos` projection.
     * @returns counts plus one segment state per native task, or null.
     */
    function taskProgressOf(team, todos) {
      const teamTasks = team && team.enabled === true && Array.isArray(team.tasks)
        ? team.tasks.filter((task) => task && task.status !== 'deleted')
        : [];
      if (teamTasks.length > 0) {
        return summarizeProgress('team', teamTasks.map((task) => {
          if (task.status === 'completed') return 'done';
          if (task.status === 'in_progress') return 'running';
          return task.ready === false ? 'blocked' : 'pending';
        }));
      }
      const list = Array.isArray(todos) ? todos.filter(Boolean) : [];
      if (list.length > 0) {
        return summarizeProgress('todo', list.map((item) => {
          if (item.status === 'completed') return 'done';
          if (item.status === 'in_progress') return 'running';
          return 'pending';
        }));
      }
      return null;
    }

    // --- team graph layout ----------------------------------------------------------
    // A tree, not a list and not a page of rows: the Lead is the root on the left, a
    // vertical trunk chains the stage hubs (spec → architecture → implementation →
    // quality → acceptance → review), and every hub branches to the right into that
    // stage's agent cards. One edge per parent-child pair, no crossings.

    const ZOOM_MIN = 0.6;
    const ZOOM_MAX = 1.8;

    function clampZoom(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return 1;
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(number * 100) / 100));
    }

    /** The Steward delivery pipeline, in flow order; each role belongs to one stage. */
    const STAGES = [
      { key: 'spec', labelKey: 'stageSpec', roles: ['pm'] },
      { key: 'architect', labelKey: 'stageArchitect', roles: ['architect'] },
      { key: 'impl', labelKey: 'stageImpl', roles: ['backend-dev', 'frontend-dev'] },
      { key: 'quality', labelKey: 'stageQuality', roles: ['qa-engineer'] },
      { key: 'accept', labelKey: 'stageAccept', roles: ['browser-tester'] },
      { key: 'review', labelKey: 'stageReview', roles: ['reviewer'] },
      { key: 'other', labelKey: 'stageOther', roles: [] },
    ];
    const OTHER_STAGE = STAGES.length - 1;

    function stageIndexOf(roleId) {
      for (let index = 0; index < OTHER_STAGE; index += 1) {
        if (STAGES[index].roles.indexOf(roleId) >= 0) return index;
      }
      return OTHER_STAGE;
    }

    /** One group per present pipeline stage; inside a stage, whoever needs you comes first. */
    function agentStages(rows, text) {
      const list = (rows || []).filter(Boolean).slice().sort((left, right) => {
        const rank = AGENT_STATES.indexOf(left.state) - AGENT_STATES.indexOf(right.state);
        if (rank !== 0) return rank;
        if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
      });
      return STAGES.map((stage, index) => ({
        key: stage.key,
        label: text[stage.labelKey] || stage.key,
        rows: list.filter((row) => stageIndexOf(row.role) === index),
      })).filter((stage) => stage.rows.length > 0);
    }

    // --- graph filters --------------------------------------------------------------
    // Three honest views of the same roster; the choice survives a reload.

    const FILTER_KEY = 'dsh-steward.panel.filters';
    const PANEL_FILTERS = ['all', 'hide-done', 'active'];

    function filterAgentRows(rows, filter) {
      const list = (rows || []).filter(Boolean);
      if (filter === 'hide-done') return list.filter((row) => row.state !== 'done');
      if (filter === 'active') return list.filter((row) => row.state === 'waiting' || row.state === 'running');
      return list;
    }

    function readPanelPrefs() {
      const fallback = { filter: 'all', collapsed: {} };
      try {
        const storage = typeof window !== 'undefined' && window && window.localStorage ? window.localStorage : null;
        if (!storage || typeof storage.getItem !== 'function') return fallback;
        const raw = storage.getItem(FILTER_KEY);
        if (typeof raw !== 'string' || raw === '') return fallback;
        const parsed = JSON.parse(raw);
        const filter = parsed && PANEL_FILTERS.indexOf(parsed.filter) >= 0 ? parsed.filter : 'all';
        const collapsed = parsed && parsed.collapsed && typeof parsed.collapsed === 'object' && !Array.isArray(parsed.collapsed)
          ? parsed.collapsed
          : {};
        return { filter, collapsed };
      } catch {
        return fallback;
      }
    }

    function writePanelPrefs(value) {
      try {
        const storage = typeof window !== 'undefined' && window && window.localStorage ? window.localStorage : null;
        if (!storage || typeof storage.setItem !== 'function') return;
        storage.setItem(FILTER_KEY, JSON.stringify({ filter: value.filter, collapsed: value.collapsed }));
      } catch {
        // private mode or a hostile storage: the panel keeps working, prefs just stay session-only
      }
    }

    /**
     * Lay the team out as a left-rooted tree: a trunk of stage hubs, and each hub
     * branching right into a grid of its cards. Cards wrap into up to three columns so a
     * wide panel shows a canopy instead of one long column; every card keeps exactly one
     * parent edge, and the elbows run above the cards or in the column gaps, never
     * across a card.
     * @param options - available width, card height, the ordered groups and their collapsed state.
     * @returns geometry for the Lead, the hubs, the cards and every tree edge.
     */
    function treeLayout(options) {
      const input = options || {};
      const width = Math.max(300, Math.round(Number(input.width) || 380));
      const nodeHeight = Number(input.nodeHeight) > 0 ? Number(input.nodeHeight) : 74;
      const rowGap = 10;
      const columnGap = 10;
      const leadWidth = Math.min(232, Math.max(168, Math.round(width * 0.45)));
      const leadHeight = nodeHeight;
      const memberX = leadWidth + 40;
      const memberArea = Math.max(150, width - memberX - 6);
      const columns = Math.max(1, Math.min(3, Math.floor((memberArea + columnGap) / (150 + columnGap))));
      const memberWidth = Math.max(150, Math.min(244, Math.floor((memberArea - columnGap * (columns - 1)) / columns)));
      const trunkX = Math.round(leadWidth / 2);
      const hubWidth = Math.min(132, Math.max(96, leadWidth - 40));
      const hubHeight = 40;
      const hubX = Math.max(0, trunkX - Math.round(hubWidth / 2));
      const lead = { id: '__lead__', x: 0, y: 0, w: leadWidth, h: leadHeight };
      const hubs = [];
      const blocks = [];
      const nodes = [];
      const links = [];
      let y = leadHeight + 30;
      for (const group of Array.isArray(input.groups) ? input.groups : []) {
        const rows = group && Array.isArray(group.rows) ? group.rows : [];
        if (rows.length === 0) continue;
        const collapsed = Boolean(group.collapsed);
        const lineCount = collapsed ? 0 : Math.ceil(rows.length / columns);
        const bodyHeight = collapsed ? 0 : lineCount * nodeHeight + (lineCount - 1) * rowGap;
        const blockHeight = Math.max(hubHeight, bodyHeight);
        const blockTop = y;
        const hub = {
          key: group.key,
          label: group.label,
          count: rows.length,
          waiting: rows.filter((row) => row.state === 'waiting').length,
          collapsed,
          x: hubX,
          y: blockTop + Math.round((blockHeight - hubHeight) / 2),
          w: hubWidth,
          h: hubHeight,
        };
        hubs.push(hub);
        blocks.push({ hub, top: blockTop, bottom: blockTop + blockHeight });
        if (!collapsed) {
          rows.forEach((row, index) => {
            const column = index % columns;
            const line = Math.floor(index / columns);
            nodes.push({
              id: row.id,
              state: row.state,
              stage: group.key,
              column,
              x: memberX + column * (memberWidth + columnGap),
              y: blockTop + line * (nodeHeight + rowGap),
              w: memberWidth,
              h: nodeHeight,
            });
          });
        }
        y = blockTop + blockHeight + 30;
      }
      const height = Math.max(leadHeight + 40, y - 30 + 4);
      const edge = (id, kind, d, active) => ({ id, kind, d, active: Boolean(active) });
      if (hubs.length > 0) {
        const first = hubs[0];
        links.push(edge('lead', 'trunk', 'M' + trunkX + ' ' + leadHeight + ' V' + Math.max(leadHeight + 2, first.y - 2), first.waiting > 0));
        for (let index = 1; index < hubs.length; index += 1) {
          const from = hubs[index - 1];
          const to = hubs[index];
          links.push(edge(from.key + '>' + to.key, 'trunk', 'M' + trunkX + ' ' + (from.y + from.h) + ' V' + Math.max(from.y + from.h + 2, to.y - 2), to.waiting > 0));
        }
        for (const block of blocks) {
          const hub = block.hub;
          if (hub.collapsed) continue;
          const hubY = hub.y + Math.round(hub.h / 2);
          const top = block.top - 10;
          const hubRight = hub.x + hub.w;
          for (const member of nodes.filter((node) => node.stage === hub.key)) {
            const targetY = member.y + Math.round(member.h / 2);
            const active = member.state === 'waiting';
            if (member.column === 0) {
              links.push(edge(hub.key + '>' + member.id, 'branch',
                'M' + hubRight + ' ' + hubY
                + ' C' + (hubRight + 25) + ' ' + hubY
                + ' ' + (member.x - 25) + ' ' + targetY
                + ' ' + member.x + ' ' + targetY, active));
            } else {
              const corridorX = member.x - Math.round(columnGap / 2);
              links.push(edge(hub.key + '>' + member.id, 'branch',
                'M' + hubRight + ' ' + hubY
                + ' V' + top
                + ' H' + corridorX
                + ' V' + targetY
                + ' H' + member.x, active));
            }
          }
        }
      }
      return { width: memberX + columns * memberWidth + (columns - 1) * columnGap + 4, height, lead, hubs, nodes, links, trunkX, memberX, memberWidth };
    }

    // --- subagents ------------------------------------------------------------------

    const SUBAGENT_CHAT_PREFIX = 'dsh-resource://subagentchat/session/';

    function subagentAddressOf(row, parentId) {
      const mode = row.mode === 'continuable' ? 'continuable' : row.mode === 'one-shot' ? 'one-shot' : 'unknown';
      return SUBAGENT_CHAT_PREFIX + encodeURIComponent(row.id) + '?parent=' + encodeURIComponent(parentId) + '&mode=' + mode;
    }

    function fileAddressOf(sessionId, workspacePath) {
      const parts = String(workspacePath).split('/').filter((part) => part !== '');
      return 'dsh-resource://file/session/' + encodeURIComponent(sessionId) + '/' + parts.map(encodeURIComponent).join('/');
    }

    // --- run artifacts --------------------------------------------------------------
    // Only the run directory and its files are read off disk. Task state comes from the
    // native projections above, so a stale 03-plan.json can no longer mislead the panel.

    /**
     * Read one Steward run's artifacts through the host's workspace-files Remote.
     * Discovery walks the skill's run roots, prefers the directory whose run.json has
     * the latest updatedAt, then refreshes only that directory on the polling tick.
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
        if (best === null) return { dir: '', run: null };
        return { dir: best.dir, run: best.run };
      };

      const collect = async (target) => {
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
          artifacts: artifacts.slice(0, MAX_ARTIFACTS),
          truncated: artifacts.length > MAX_ARTIFACTS,
        };
      };

      return {
        dir: () => dir,
        async load() {
          if (remoteOf() === undefined || typeof remoteOf().list !== 'function') {
            return { status: 'unsupported', dir: '', artifacts: [] };
          }
          if (dir === '') {
            const found = await discover();
            dir = found.dir;
            if (dir === '') return { status: 'empty', dir: '', artifacts: [] };
            return collect(dir);
          }
          const facts = await collect(dir);
          // The run directory can vanish between ticks (a new run, a clean workspace):
          // forget it and rediscover on the next tick.
          if (facts.artifacts.length === 0 && (await readJson(dir + '/run.json')) === null) {
            dir = '';
            return { status: 'empty', dir: '', artifacts: [] };
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

    // --- task progress --------------------------------------------------------------

    /**
     * The host's own task list as one bar: counts and one segment per native task.
     * No task name ever reaches the panel — the native list stays the place to read them.
     * @param props - copy plus the summarized progress (null when the list is empty).
     * @returns the progress section.
     */
    function TaskProgress({ text, progress }) {
      if (progress === null) {
        return h('section', { className: 'stwd-tasks stwd-tasks-empty', 'aria-label': text.taskProgress },
          h('span', { className: 'stwd-tasks-label' }, text.taskProgress),
          h('span', { className: 'stwd-tasks-note' }, text.taskEmpty),
        );
      }
      const source = progress.source === 'team' ? text.taskSourceTeam : text.taskSourceTodo;
      const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
      return h('section', { className: 'stwd-tasks', 'aria-label': text.taskProgress },
        h('div', { className: 'stwd-tasks-head' },
          h('span', { className: 'stwd-tasks-label' }, text.taskProgress),
          h('span', { className: 'stwd-tasks-count' }, progress.done + '/' + progress.total),
          h('span', { className: 'stwd-tasks-source', title: source }, source),
        ),
        h('div', {
          className: 'stwd-tasks-bar',
          role: 'img',
          'aria-label': fmt(text.taskProgressAria, { done: progress.done, total: progress.total }),
        }, progress.segments.map((state, index) => h('span', {
          key: 'task-seg-' + index,
          className: 'stwd-tseg stwd-tseg-' + state,
        }))),
        h('div', { className: 'stwd-tasks-meta' },
          h('span', { className: 'stwd-tasks-meta-item' }, text.taskDone + ' ' + progress.done),
          progress.running > 0 ? h('span', { className: 'stwd-tasks-meta-item stwd-tone-progress' }, text.taskRunning + ' ' + progress.running) : null,
          progress.blocked > 0 ? h('span', { className: 'stwd-tasks-meta-item stwd-tone-warn' }, text.taskBlocked + ' ' + progress.blocked) : null,
          h('span', { className: 'stwd-tasks-percent' }, percent + '%'),
        ),
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

    // --- team graph -----------------------------------------------------------------

    /** The Session the panel is docked in: it heads the tree. */
    function LeadNode({ text, row, geo }) {
      return h('div', {
        className: 'stwd-leadnode stwd-leadnode-' + row.state,
        style: { left: geo.x + 'px', top: geo.y + 'px', width: geo.w + 'px', height: geo.h + 'px' },
      },
        h('span', { className: 'stwd-leadnode-avatar', 'aria-hidden': 'true' }, row.glyph),
        h('span', { className: 'stwd-leadnode-body' },
          h('span', { className: 'stwd-leadnode-row' },
            h('span', { className: 'stwd-leadnode-title' }, text.lead),
            h(StatusDot, { tone: stateTone(row.state) }),
            h('span', { className: 'stwd-leadnode-state' }, stateLabelOf(row.state, text)),
          ),
          h('span', { className: 'stwd-leadnode-meta' },
            h('span', { className: 'stwd-leadnode-model stwd-mono' }, modelLabelOf(row, text)),
          ),
          h('span', { className: 'stwd-leadnode-task' }, row.description === '' ? text.leadHere : row.description),
          h('span', { className: 'stwd-leadnode-metrics' }, fmtTokens(row.tokens === null ? 0 : row.tokens.total) + ' ' + text.tokensShort),
        ),
      );
    }

    /** One dispatched agent: role, model, task, state, and two real buttons. */
    function AgentNode({ text, row, geo, selected, onOpen, onToggle }) {
      let aria = (row.roleName === '' ? text.subagentRole : row.roleName)
        + (row.role === '' ? '' : ' ' + row.role)
        + ' · ' + stateLabelOf(row.state, text)
        + ' · ' + modelLabelOf(row, text);
      if (row.description !== '') aria += ' · ' + row.description;
      return h('div', {
        className: 'stwd-gnode stwd-gnode-' + row.state + (selected ? ' stwd-gnode-selected' : ''),
        style: { left: geo.x + 'px', top: geo.y + 'px', width: geo.w + 'px', height: geo.h + 'px' },
      },
        h('button', {
          type: 'button',
          className: 'stwd-gnode-main',
          'aria-label': aria,
          title: aria,
          onClick: () => onOpen(row),
        },
          h('span', { className: 'stwd-gnode-top' },
            h('span', { className: 'stwd-gnode-avatar', 'aria-hidden': 'true' }, row.glyph),
            h('span', { className: 'stwd-gnode-role' }, row.roleName === '' ? text.subagentRole : row.roleName),
            h('span', { className: 'stwd-gnode-state' }, h(StatusDot, { tone: stateTone(row.state) }), stateLabelOf(row.state, text)),
          ),
          h('span', { className: 'stwd-gnode-model stwd-mono' }, modelLabelOf(row, text)),
          h('span', { className: 'stwd-gnode-task' }, row.description === '' ? text.noDescription : row.description),
          h('span', { className: 'stwd-gnode-metrics' }, fmtDuration(row.elapsedMs) + ' · ' + fmtTokens(row.tokens === null ? 0 : row.tokens.total) + ' ' + text.tokensShort),
        ),
        h('button', {
          type: 'button',
          className: 'stwd-gnode-more',
          'aria-expanded': selected ? 'true' : 'false',
          'aria-label': text.detailToggle,
          title: text.detailToggle,
          onClick: () => onToggle(row.id),
        }, selected ? '⌃' : '⌄'),
      );
    }

    let ARROW_SEQ = 0;

    /**
     * The team as a tree canvas: the Lead is the root, a trunk chains the stage hubs,
     * every hub branches into its cards. Cards can be dragged anywhere, the viewport
     * pans and zooms, and filters / collapsed hubs are remembered across reloads.
     * A click on a card still opens its child session; a drag moves the card and
     * swallows that click.
     * @param props - copy, rows, the Lead row, selection and the two node actions.
     * @returns the graph surface.
     */
    function TeamGraph(props) {
      const text = props.text;
      const prefs = useMemo(() => readPanelPrefs(), []);
      const wrapRef = useRef(null);
      const viewRef = useRef(null);
      const dragRef = useRef(null);
      const suppressRef = useRef(0);
      const markerRef = useRef(null);
      const dimsRef = useRef({ width: 340, height: 480, contentWidth: 340, contentHeight: 480 });
      const [width, setWidth] = useState(340);
      const [view, setViewState] = useState({ zoom: 1, x: 0, y: 0 });
      const [moving, setMoving] = useState(false);
      const [offsets, setOffsets] = useState({});
      const [filter, setFilter] = useState(prefs.filter);
      const [collapsed, setCollapsed] = useState(prefs.collapsed);
      if (markerRef.current === null) {
        ARROW_SEQ += 1;
        markerRef.current = 'stwd-tree-arrow-' + ARROW_SEQ;
      }

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

      useEffect(() => {
        writePanelPrefs({ filter, collapsed });
      }, [filter, collapsed]);

      const totalRows = (props.rows || []).filter(Boolean).length;
      const visibleRows = useMemo(() => filterAgentRows(props.rows, filter), [props.rows, filter]);
      const hiddenCount = totalRows - visibleRows.length;
      const groups = useMemo(() => agentStages(visibleRows, text).map((group) => ({
        ...group,
        collapsed: collapsed[group.key] === true,
      })), [visibleRows, text, collapsed]);
      const layout = useMemo(() => treeLayout({
        width,
        nodeHeight: 74,
        groups,
      }), [groups, width]);
      const rowsById = useMemo(() => {
        const map = new Map();
        for (const row of props.rows || []) map.set(row.id, row);
        return map;
      }, [props.rows]);
      const placed = useMemo(() => layout.nodes.map((node) => {
        const offset = offsets[node.id];
        return offset ? { ...node, x: node.x + offset.dx, y: node.y + offset.dy } : node;
      }), [layout.nodes, offsets]);

      // The canvas is as tall as the tree (the panel scrolls, like any diagram); only a
      // pathological run is capped, and zooming in brings panning into play.
      const minimumView = totalRows === 0 ? 110 : 220;
      const viewHeight = Math.min(Math.max(layout.height + 10, minimumView), 2200);
      const viewWidth = Math.max(120, width);
      dimsRef.current = {
        width: viewWidth,
        height: viewHeight,
        contentWidth: layout.width,
        contentHeight: layout.height,
      };

      /** Keep the content covering the viewport (top-left anchored when it fits). */
      const clampToDims = (next) => {
        const dims = dimsRef.current;
        const zoom = clampZoom(next.zoom);
        const scaledWidth = dims.contentWidth * zoom;
        const scaledHeight = dims.contentHeight * zoom;
        return {
          zoom,
          x: Math.round(Math.min(0, Math.max(dims.width - scaledWidth, Number(next.x) || 0))),
          y: Math.round(Math.min(0, Math.max(dims.height - scaledHeight, Number(next.y) || 0))),
        };
      };

      // A filter or a collapsed hub changes the content size: snap the view back in.
      useEffect(() => {
        setViewState((current) => clampToDims(current));
      }, [layout.width, layout.height]);

      const resetView = () => setViewState(clampToDims({ zoom: 1, x: 0, y: 0 }));

      const fitView = () => {
        setViewState(() => {
          const dims = dimsRef.current;
          const zoom = clampZoom(Math.min(
            dims.width / Math.max(1, dims.contentWidth),
            dims.height / Math.max(1, dims.contentHeight),
          ));
          return clampToDims({ zoom, x: 0, y: 0 });
        });
      };

      const relayout = () => setOffsets({});

      const zoomAt = (factor, originX, originY) => {
        setViewState((current) => {
          const zoom = clampZoom(current.zoom * factor);
          if (zoom === current.zoom) return current;
          const ratio = zoom / current.zoom;
          return clampToDims({
            zoom,
            x: originX - (originX - current.x) * ratio,
            y: originY - (originY - current.y) * ratio,
          });
        });
      };

      // Wheel zoom needs a non-passive listener; a plain wheel keeps scrolling the panel.
      useEffect(() => {
        const host = viewRef.current;
        if (!host || typeof host.addEventListener !== 'function') return undefined;
        const onWheel = (event) => {
          if (!event.ctrlKey && !event.metaKey) return;
          event.preventDefault();
          const rect = typeof host.getBoundingClientRect === 'function' ? host.getBoundingClientRect() : { left: 0, top: 0 };
          const originX = (Number(event.clientX) || 0) - (Number(rect.left) || 0);
          const originY = (Number(event.clientY) || 0) - (Number(rect.top) || 0);
          zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, originX, originY);
        };
        host.addEventListener('wheel', onWheel, { passive: false });
        return () => host.removeEventListener('wheel', onWheel);
      }, []);

      const capturePointer = (event) => {
        const host = viewRef.current;
        if (!host || typeof host.setPointerCapture !== 'function') return;
        if (!event || event.pointerId === undefined) return;
        try {
          host.setPointerCapture(event.pointerId);
        } catch {
          // a pointer that already went away needs no capture
        }
      };

      const releasePointer = (event) => {
        const host = viewRef.current;
        if (!host || typeof host.releasePointerCapture !== 'function') return;
        if (!event || event.pointerId === undefined) return;
        try {
          host.releasePointerCapture(event.pointerId);
        } catch {
          // already released
        }
      };

      /** Which card (if any) is under this pointer, in layout units. */
      const nodeAt = (event) => {
        if (!event) return '';
        const host = viewRef.current;
        const rect = host && typeof host.getBoundingClientRect === 'function' ? host.getBoundingClientRect() : { left: 0, top: 0 };
        const localX = ((Number(event.clientX) || 0) - (Number(rect.left) || 0) - view.x) / view.zoom;
        const localY = ((Number(event.clientY) || 0) - (Number(rect.top) || 0) - view.y) / view.zoom;
        for (const node of placed) {
          if (localX >= node.x && localX <= node.x + node.w && localY >= node.y && localY <= node.y + node.h) return node.id;
        }
        return '';
      };

      const interactiveTarget = (target) => Boolean(target && typeof target.closest === 'function'
        && target.closest('.stwd-gnode, .stwd-leadnode, .stwd-hub-head, .stwd-graph-tools, .stwd-graph-filters'));

      const onPointerDown = (event) => {
        if (!event || (event.button !== undefined && event.button !== 0)) return;
        const target = event.target;
        if (target && typeof target.closest === 'function'
          && target.closest('.stwd-graph-tools, .stwd-graph-filters, .stwd-hub-head')) return;
        const nodeId = nodeAt(event);
        dragRef.current = {
          x: Number(event.clientX) || 0,
          y: Number(event.clientY) || 0,
          view,
          nodeId,
          startOffset: nodeId === '' ? null : { ...(offsets[nodeId] || { dx: 0, dy: 0 }) },
          moved: false,
        };
        if (nodeId === '') {
          setMoving(true);
          capturePointer(event);
        }
      };

      const onPointerMove = (event) => {
        const start = dragRef.current;
        if (!start || !event) return;
        const dx = (Number(event.clientX) || 0) - start.x;
        const dy = (Number(event.clientY) || 0) - start.y;
        if (!start.moved) {
          if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
          start.moved = true;
          if (start.nodeId === '') setMoving(true);
          else suppressRef.current = Date.now() + 400;
          capturePointer(event);
        }
        if (start.nodeId !== '') {
          const zoom = Math.max(0.1, Number(start.view.zoom) || 1);
          const base = start.startOffset || { dx: 0, dy: 0 };
          const next = { dx: base.dx + dx / zoom, dy: base.dy + dy / zoom };
          setOffsets((current) => ({ ...current, [start.nodeId]: next }));
          return;
        }
        setViewState(() => clampToDims({ zoom: start.view.zoom, x: start.view.x + dx, y: start.view.y + dy }));
      };

      const endDrag = (event) => {
        if (!dragRef.current) return;
        dragRef.current = null;
        setMoving(false);
        releasePointer(event);
      };

      /** A drag swallows the click it would otherwise turn into a session jump. */
      const onClickCapture = (event) => {
        if (suppressRef.current === 0 || suppressRef.current < Date.now()) return;
        suppressRef.current = 0;
        event.preventDefault();
        event.stopPropagation();
      };

      const onDoubleClick = (event) => {
        if (interactiveTarget(event && event.target)) return;
        resetView();
      };

      const onKeyDown = (event) => {
        if (!event) return;
        const key = event.key;
        if (key === '+' || key === '=') {
          event.preventDefault();
          zoomAt(1.12, viewWidth / 2, viewHeight / 2);
          return;
        }
        if (key === '-' || key === '_') {
          event.preventDefault();
          zoomAt(1 / 1.12, viewWidth / 2, viewHeight / 2);
          return;
        }
        if (key === '0') {
          event.preventDefault();
          resetView();
          return;
        }
        if (key === 'f' || key === 'F') {
          event.preventDefault();
          fitView();
          return;
        }
        if (key === 'r' || key === 'R') {
          event.preventDefault();
          relayout();
          return;
        }
        const steps = { ArrowLeft: [32, 0], ArrowRight: [-32, 0], ArrowUp: [0, 32], ArrowDown: [0, -32] };
        if (steps[key] === undefined) return;
        event.preventDefault();
        const [dx, dy] = steps[key];
        setViewState((current) => clampToDims({ zoom: current.zoom, x: current.x + dx, y: current.y + dy }));
      };

      const toggleStage = (key) => setCollapsed((current) => {
        const next = { ...current };
        if (next[key] === true) delete next[key];
        else next[key] = true;
        return next;
      });

      const zoomPercent = Math.round(view.zoom * 100) + '%';
      const stageStyle = {
        width: layout.width + 'px',
        height: layout.height + 'px',
        transform: 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.zoom + ')',
      };
      const filterButtons = [
        { key: 'all', label: text.filterAll },
        { key: 'hide-done', label: text.filterHideDone },
        { key: 'active', label: text.filterActive },
      ];

      const canvas = totalRows > 0 && visibleRows.length === 0
        ? h('div', { className: 'stwd-graph-empty' },
          h('p', { className: 'stwd-graph-empty-title' }, text.emptyFiltered),
          h('p', { className: 'stwd-graph-empty-hint' }, text.emptyFilteredHint),
          h('button', {
            type: 'button',
            className: 'stwd-graph-reset',
            onClick: () => setFilter('all'),
          }, text.filterAll),
        )
        : h('div', {
          className: 'stwd-graph-view' + (moving ? ' stwd-graph-view-moving' : ''),
          ref: viewRef,
          style: { height: viewHeight + 'px' },
          role: 'group',
          tabIndex: 0,
          'aria-label': fmt(text.graphCanvasAria, { nodes: visibleRows.length }),
          onPointerDown,
          onPointerMove,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
          onClickCapture,
          onDoubleClick,
          onKeyDown,
        },
          h('div', { className: 'stwd-graph-stage', style: stageStyle },
            h('svg', {
              className: 'stwd-graph-links',
              width: layout.width,
              height: layout.height,
              viewBox: '0 0 ' + layout.width + ' ' + layout.height,
              'aria-hidden': 'true',
              focusable: 'false',
            },
              h('defs', null,
                h('marker', {
                  id: markerRef.current,
                  viewBox: '0 0 8 8',
                  refX: 6,
                  refY: 4,
                  markerWidth: 7,
                  markerHeight: 7,
                  orient: 'auto',
                }, h('path', { className: 'stwd-link-head', d: 'M0 0 L8 4 L0 8 Z' })),
              ),
              layout.links.map((link) => h('path', {
                key: 'link-' + link.id,
                className: 'stwd-link stwd-link-' + link.kind + (link.active ? ' stwd-link-active' : ''),
                d: link.d,
                'marker-end': 'url(#' + markerRef.current + ')',
              })),
            ),
            h('div', { className: 'stwd-graph-canvas', style: { height: layout.height + 'px' } },
              h(LeadNode, { text, row: props.lead, geo: layout.lead }),
              layout.hubs.map((hub) => h('div', {
                key: 'hub-' + hub.key,
                className: 'stwd-hub' + (hub.collapsed ? ' stwd-hub-collapsed' : '') + (hub.waiting > 0 ? ' stwd-hub-waiting' : ''),
                style: { left: hub.x + 'px', top: hub.y + 'px', width: hub.w + 'px', height: hub.h + 'px' },
              },
                h('button', {
                  type: 'button',
                  className: 'stwd-hub-head',
                  'aria-expanded': hub.collapsed ? 'false' : 'true',
                  'aria-label': fmt(hub.collapsed ? text.expandStage : text.collapseStage, { stage: hub.label }),
                  onClick: () => toggleStage(hub.key),
                },
                  h('span', { className: 'stwd-hub-title' }, hub.label),
                  h('span', { className: 'stwd-hub-count' }, String(hub.count)),
                  hub.waiting > 0 ? h('span', { className: 'stwd-hub-waiting-dot', title: text.stateWaiting }) : null,
                  h('span', { className: 'stwd-hub-caret' }, hub.collapsed ? '▸' : '▾'),
                ),
              )),
              placed.map((node) => {
                const row = rowsById.get(node.id);
                if (row === undefined) return null;
                return h(AgentNode, {
                  key: 'node-' + node.id,
                  text,
                  row,
                  geo: node,
                  selected: props.selectedId === node.id,
                  onOpen: props.onOpen,
                  onToggle: props.onToggle,
                });
              }),
            ),
          ),
        );

      return h('div', { className: 'stwd-graph', ref: wrapRef },
        h('div', { className: 'stwd-graph-bar' },
          h('div', { className: 'stwd-graph-bar-row' },
            h('span', { className: 'stwd-graph-hint' }, text.canvasHint),
            h('div', { className: 'stwd-graph-tools', role: 'group', 'aria-label': text.zoomGroup },
              h('button', {
                type: 'button',
                className: 'stwd-graph-tool',
                'aria-label': text.zoomOut,
                title: text.zoomOut,
                onClick: () => zoomAt(1 / 1.12, viewWidth / 2, viewHeight / 2),
              }, '−'),
              h('button', {
                type: 'button',
                className: 'stwd-graph-tool stwd-graph-zoom',
                'aria-label': text.zoomReset,
                title: text.zoomReset,
                onClick: resetView,
              }, zoomPercent),
              h('button', {
                type: 'button',
                className: 'stwd-graph-tool',
                'aria-label': text.zoomIn,
                title: text.zoomIn,
                onClick: () => zoomAt(1.12, viewWidth / 2, viewHeight / 2),
              }, '+'),
              h('button', {
                type: 'button',
                className: 'stwd-graph-tool',
                'aria-label': text.zoomFit,
                title: text.zoomFit,
                onClick: fitView,
              }, '⤢'),
              h('button', {
                type: 'button',
                className: 'stwd-graph-tool',
                'aria-label': text.relayout,
                title: text.relayout,
                onClick: relayout,
              }, '⟲'),
            ),
          ),
          h('div', { className: 'stwd-graph-bar-row stwd-graph-filters' },
            h('div', { className: 'stwd-filters', role: 'group', 'aria-label': text.filterGroup },
              filterButtons.map((item) => h('button', {
                key: 'filter-' + item.key,
                type: 'button',
                className: 'stwd-filter' + (filter === item.key ? ' stwd-filter-on' : ''),
                'aria-pressed': filter === item.key ? 'true' : 'false',
                onClick: () => setFilter(item.key),
              }, item.label)),
            ),
            hiddenCount > 0 ? h('span', { className: 'stwd-graph-hidden' }, fmt(text.filterHidden, { count: hiddenCount })) : null,
          ),
        ),
        canvas,
      );
    }

    /** The same agent as one compact row for the list view. */
    function AgentRow({ text, row, selected, onOpen, onToggle }) {
      return h('div', {
        className: 'stwd-arow stwd-arow-' + row.state + (selected ? ' stwd-arow-selected' : ''),
      },
        h('button', {
          type: 'button',
          className: 'stwd-arow-main',
          title: row.description,
          onClick: () => onOpen(row),
        },
          h('span', { className: 'stwd-arow-top' },
            h('span', { className: 'stwd-arow-avatar', 'aria-hidden': 'true' }, row.glyph),
            h('span', { className: 'stwd-arow-role' }, row.roleName === '' ? text.subagentRole : row.roleName),
            row.role === '' ? null : h('span', { className: 'stwd-arow-roleid' }, row.role),
            h('span', { className: 'stwd-arow-state' }, h(StatusDot, { tone: stateTone(row.state) }), stateLabelOf(row.state, text)),
          ),
          h('span', { className: 'stwd-arow-line' },
            h('span', { className: 'stwd-arow-model stwd-mono' }, modelLabelOf(row, text)),
            h('span', { className: 'stwd-arow-meta' }, fmtDuration(row.elapsedMs) + ' · ' + fmtTokens(row.tokens === null ? 0 : row.tokens.total) + ' ' + text.tokensShort),
          ),
          h('span', { className: 'stwd-arow-task' }, row.description === '' ? text.noDescription : row.description),
        ),
        h('button', {
          type: 'button',
          className: 'stwd-arow-more',
          'aria-expanded': selected ? 'true' : 'false',
          'aria-label': text.detailToggle,
          title: text.detailToggle,
          onClick: () => onToggle(row.id),
        }, selected ? '⌃' : '⌄'),
      );
    }

    /** Everything the graph node cannot fit: provider, effort, buckets, turns, mode. */
    function AgentDetail({ text, row, onClose, onOpen }) {
      const facts = [
        [text.detailTask, row.description === '' ? '—' : row.description],
        [text.detailModel, row.model === null ? text.modelPending : row.model.model],
        [text.detailProvider, row.model === null ? '—' : row.model.provider],
        [text.detailEffort, row.model !== null && row.model.effort !== '' ? row.model.effort : text.detailEffortDefault],
        [text.detailState, stateLabelOf(row.state, text)],
        [text.detailElapsed, fmtDuration(row.elapsedMs)],
        [text.detailTurns, row.turns === null ? '—' : String(row.turns)],
        [text.detailSteps, row.steps === null ? '—' : String(row.steps)],
        [text.detailMode, row.mode === 'continuable' ? text.modeContinuable : row.mode === 'one-shot' ? text.modeOneShot : text.modeUnknown],
        [text.detailSession, shortId(row.id)],
      ];
      const tokens = row.tokens;
      return h('section', { className: 'stwd-gdetail', 'aria-label': text.detailTitle },
        h('div', { className: 'stwd-gdetail-head' },
          h('span', { className: 'stwd-gdetail-title' }, text.detailTitle),
          h('span', { className: 'stwd-gdetail-role stwd-mono' }, row.role === '' ? row.roleName : row.role),
          h('button', {
            type: 'button',
            className: 'stwd-iconbtn stwd-gdetail-close',
            'aria-label': text.detailClose,
            title: text.detailClose,
            onClick: onClose,
          }, '×'),
        ),
        row.waiting ? h('p', { className: 'stwd-gdetail-hint' }, text.stateWaitingHint) : null,
        h('dl', { className: 'stwd-gdetail-grid' }, facts.map(([label, value]) => [
          h('dt', { key: 'dt-' + label }, label),
          h('dd', { key: 'dd-' + label }, value),
        ])),
        tokens === null ? null : h('p', { className: 'stwd-gdetail-tokens' },
          text.detailTokens + ' ',
          h('span', null, text.tokenInput + ' ' + String(tokens.input) + ' · '),
          h('span', null, text.tokenOutput + ' ' + String(tokens.output) + ' · '),
          h('span', null, text.tokenCacheRead + ' ' + String(tokens.cacheRead) + ' · '),
          h('span', null, text.tokenCacheWrite + ' ' + String(tokens.cacheWrite)),
        ),
        h('button', {
          type: 'button',
          className: 'stwd-btn',
          onClick: () => onOpen(row),
        }, text.openSession),
      );
    }

    // --- artifacts ------------------------------------------------------------------

    /** The run directory on disk, collapsed until asked for. */
    function Artifacts({ text, facts, open, onToggle, onOpen }) {
      const items = Array.isArray(facts.artifacts) ? facts.artifacts : [];
      const broken = facts.status === 'unsupported' || facts.status === 'error';
      return h('section', { className: 'stwd-artifacts' },
        h('button', {
          type: 'button',
          className: 'stwd-artifacts-head',
          'aria-expanded': open ? 'true' : 'false',
          onClick: onToggle,
        },
          h('span', { className: 'stwd-artifacts-title' }, text.artifactsTitle),
          h('span', { className: 'stwd-artifacts-count' }, String(items.length)),
          h('span', { className: 'stwd-artifacts-caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
        ),
        open ? h('div', { className: 'stwd-rows' },
          items.map((item) => h('button', {
            key: item.path,
            type: 'button',
            className: 'stwd-row stwd-artrow',
            title: item.path,
            onClick: () => onOpen(item.path),
          },
            h('span', { className: 'stwd-artrow-glyph', 'aria-hidden': 'true' }, '▤'),
            h('span', { className: 'stwd-row-body' },
              h('span', { className: 'stwd-row-title' }, item.name),
            ),
          )),
        ) : null,
        open && items.length === 0
          ? h('p', { className: 'stwd-note' }, broken ? text.artifactsMissing : text.artifactsEmpty)
          : null,
        facts.dir === '' ? null : h('p', { className: 'stwd-artifacts-dir', title: facts.dir },
          h('span', { className: 'stwd-artifacts-dir-label' }, text.artifactsRun + ' '),
          h('span', { className: 'stwd-mono' }, facts.dir),
        ),
      );
    }

    // --- the per-session board ------------------------------------------------------

    /**
     * The right-Sidebar body: this Session's dispatched team as a tree graph. Every
     * agent fact is read from host projections and Session status; only the run's
     * artifacts come from disk. Task progress is counted, never listed.
     * @param props - slot props plus the injected face.
     * @returns the board.
     */
    function StewardPanel(props) {
      const text = props.text;
      const lang = props.lang === 'en' ? 'en' : 'zh';
      const project = typeof props.useProjection === 'function' ? props.useProjection : () => undefined;
      const sessions = typeof props.useSessions === 'function' ? props.useSessions : () => undefined;
      const statuses = typeof props.useSessionStatus === 'function' ? props.useSessionStatus : () => undefined;
      const sessionId = String(props.sessionId === undefined || props.sessionId === null ? '' : props.sessionId);
      const nowOf = typeof props.now === 'function' ? props.now : () => Date.now();
      const refreshChild = typeof props.refreshChild === 'function' ? props.refreshChild : null;
      const loadRun = props.loadRun;

      const catalog = project('subagentCatalog');
      const team = project('agentTeam');
      const todos = project('todos');
      const leadModelSelection = project('modelSelection');
      const leadUsage = project('tokenUsage');
      const leadStats = project('sessionStats');
      const summaries = sessions((state) => (state && state.byId ? state.byId : undefined));
      const projections = sessions((state) => (state && state.projectionsBySession ? state.projectionsBySession : undefined));
      const statusState = statuses((state) => state);

      const [facts, setFacts] = useState({ status: 'loading', dir: '', artifacts: [] });
      const [reload, setReload] = useState(0);
      const [tick, setTick] = useState(0);
      const [view, setView] = useState('graph');
      const [selectedId, setSelectedId] = useState(null);
      const [artifactsOpen, setArtifactsOpen] = useState(false);
      const refreshed = useRef({});

      useEffect(() => {
        let live = true;
        const run = () => {
          if (typeof loadRun !== 'function') {
            if (live) setFacts({ status: 'unsupported', dir: '', artifacts: [] });
            return;
          }
          Promise.resolve()
            .then(() => loadRun())
            .then((next) => { if (live && next) setFacts(next); })
            .catch(() => { if (live) setFacts({ status: 'error', dir: '', artifacts: [] }); });
        };
        run();
        const timer = typeof setInterval === 'function' ? setInterval(run, RUN_POLL_MS) : null;
        if (timer !== null && typeof timer === 'object' && typeof timer.unref === 'function') timer.unref();
        return () => {
          live = false;
          if (timer !== null) clearInterval(timer);
        };
      }, [loadRun, reload]);

      const children = useMemo(
        () => (Array.isArray(catalog) ? catalog.filter((entry) => entry && entry.mode !== 'external') : []),
        [catalog],
      );

      // A child's summary carries only the summary keys; fetch the full projection set
      // once per child so model, timing and turn/step facts arrive even for cold rows.
      useEffect(() => {
        if (refreshChild === null) return undefined;
        for (const entry of children) {
          const id = String(entry.id);
          if (refreshed.current[id] === true) continue;
          refreshed.current[id] = true;
          Promise.resolve().then(() => refreshChild(id)).catch(() => {});
        }
        return undefined;
      }, [children, refreshChild]);

      const valuesOf = (id) => {
        const summary = summaries ? summaries[id] : undefined;
        const snapshot = projections ? projections[id] : undefined;
        const base = summary && summary.projectionValues ? summary.projectionValues : null;
        const full = snapshot && snapshot.values ? snapshot.values : null;
        if (base === null && full === null) return {};
        if (base === null) return full;
        if (full === null) return base;
        return { ...base, ...full };
      };

      const sampled = nowOf();
      const now = Number.isFinite(Number(sampled)) ? Number(sampled) : Date.now();

      const rows = useMemo(() => children.map((entry) => agentRow({
        entry,
        summary: summaries ? summaries[String(entry.id)] : null,
        values: valuesOf(String(entry.id)),
        status: statusState && typeof statusState.get === 'function' ? statusState.get(String(entry.id)) : null,
        now,
        text,
        lang,
      })), [children, summaries, projections, statusState, now, lang, text, tick]);

      const lead = useMemo(() => leadRowOf({
        sessionId,
        summary: summaries ? summaries[sessionId] : null,
        values: { modelSelection: leadModelSelection, tokenUsage: leadUsage, sessionStats: leadStats },
        status: statusState && typeof statusState.get === 'function' ? statusState.get(sessionId) : null,
        text,
        lang,
      }), [sessionId, summaries, statusState, leadModelSelection, leadUsage, leadStats, text, lang, tick]);

      const fleet = useMemo(() => fleetFacts(rows), [rows]);
      const progress = useMemo(() => taskProgressOf(team, todos), [team, todos]);
      const selected = selectedId === null ? null : rows.find((row) => row.id === selectedId) || null;

      const active = rows.some((row) => row.running || row.waiting);
      useEffect(() => {
        if (!active) return undefined;
        const timer = typeof setInterval === 'function' ? setInterval(() => setTick((current) => current + 1), 1000) : null;
        if (timer !== null && typeof timer === 'object' && typeof timer.unref === 'function') timer.unref();
        return () => {
          if (timer !== null) clearInterval(timer);
        };
      }, [active]);

      const openAgent = (row) => {
        if (typeof props.openSession === 'function') props.openSession(row.id, row.mode);
      };
      const toggleAgent = (id) => setSelectedId((current) => (current === id ? null : id));
      const refreshAll = () => {
        setReload((current) => current + 1);
        if (refreshChild === null) return;
        for (const entry of children) {
          const id = String(entry.id);
          Promise.resolve().then(() => refreshChild(id)).catch(() => {});
        }
      };

      const viewTabs = h('div', { className: 'stwd-viewtabs', role: 'group', 'aria-label': text.viewGroup },
        [['graph', text.viewGraph], ['list', text.viewList]].map(([key, label]) => h('button', {
          key,
          type: 'button',
          className: 'stwd-viewtab' + (view === key ? ' stwd-viewtab-active' : ''),
          'aria-pressed': view === key ? 'true' : 'false',
          onClick: () => setView(key),
        }, label)),
      );

      const rosterActions = h('span', { className: 'stwd-roster-meta' },
        fleet.counts.running > 0 ? h(StatusPill, { tone: 'progress' }, text.laneRunning + ' ' + fleet.counts.running) : null,
        fleet.counts.waiting > 0 ? h(StatusPill, { tone: 'warn' }, text.laneWaiting + ' ' + fleet.counts.waiting) : null,
        fleet.counts.done > 0 ? h(StatusPill, { tone: 'done' }, text.laneDone + ' ' + fleet.counts.done) : null,
      );

      const rosterBody = view === 'list'
        ? (children.length === 0
          ? h(EmptyState, { title: text.emptyTitle, note: text.emptyBody, steps: text.emptySteps })
          : h('div', { className: 'stwd-rows' }, rows.map((row) => h(AgentRow, {
            key: row.id,
            text,
            row,
            selected: selectedId === row.id,
            onOpen: openAgent,
            onToggle: toggleAgent,
          }))))
        : h('div', { className: 'stwd-roster' },
          h(TeamGraph, {
            text,
            lead,
            rows,
            selectedId,
            onOpen: openAgent,
            onToggle: toggleAgent,
          }),
          children.length === 0
            ? h(EmptyState, { title: text.emptyTitle, note: text.emptyBody, steps: text.emptySteps })
            : null,
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
              onClick: refreshAll,
            }, facts.status === 'loading' ? '…' : '⟳'),
          ),
          h('div', { className: 'stwd-panel-subrow' },
            h('p', { className: 'stwd-panel-sub' }, text.subtitle),
            viewTabs,
          ),
        ),
        h(ErrorBoundary, { fallbackTitle: text.sectionFailed }, h(TaskProgress, { text, progress })),
        h('section', { className: 'stwd-section' },
          h(SectionHead, {
            title: text.roster,
            count: fleet.total === 0 ? '' : String(fleet.total),
            actions: rosterActions,
          }),
          h(ErrorBoundary, { fallbackTitle: text.sectionFailed }, rosterBody),
          selected === null ? null : h(ErrorBoundary, { fallbackTitle: text.sectionFailed },
            h(AgentDetail, {
              text,
              row: selected,
              onClose: () => setSelectedId(null),
              onOpen: openAgent,
            }),
          ),
          h('p', { className: 'stwd-note stwd-native-note' }, text.nativeListNote),
        ),
        h(ErrorBoundary, { fallbackTitle: text.sectionFailed }, h(Artifacts, {
          text,
          facts,
          open: artifactsOpen,
          onToggle: () => setArtifactsOpen((current) => !current),
          onOpen: (path) => { if (typeof props.openFile === 'function') props.openFile(path); },
        })),
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
      '.stwd-root{--stwd-border:var(--dsw-alias-border-l2);--stwd-border-soft:var(--dsw-alias-border-l1);--stwd-border-strong:var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));--stwd-hover:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));--stwd-live:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));--stwd-muted:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));--stwd-elev:var(--dsw-elevation-panel,0 1px 2px rgb(0 0 0 / 8%));--stwd-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:12.5px;line-height:18px;font-family:inherit}',
      '.stwd-root *{box-sizing:border-box}',
      '.stwd-panel{display:flex;flex-direction:column;gap:12px;height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;padding:12px 12px 20px}',
      '.stwd-panel>style{display:none}',
      '.stwd-mono{font-family:var(--stwd-mono)}',
      '.stwd-note{margin:0;font-size:11px;line-height:16px;color:var(--stwd-muted)}',
      '.stwd-icon{display:block;flex:none}',
      '/* --- head --------------------------------------------------------------- */',
      '.stwd-panel-head{display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.stwd-panel-head-row{display:flex;align-items:center;gap:8px;min-width:0}',
      '.stwd-panel-badge{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;flex:none;border-radius:6px;border:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-brand-primary)}',
      '.stwd-panel-title{margin:0;font-size:14px;line-height:20px;font-weight:500;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-panel-subrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}',
      '.stwd-panel-sub{margin:0;flex:1 1 140px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '/* --- view tabs ---------------------------------------------------------- */',
      '.stwd-viewtabs{display:inline-flex;align-items:center;gap:2px;padding:2px;flex:none;border-radius:8px;border:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-1)}',
      '.stwd-viewtab{min-height:20px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:16px;cursor:pointer}',
      '.stwd-viewtab:hover{background:var(--stwd-hover);color:var(--dsw-alias-label-primary)}',
      '.stwd-viewtab-active{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:500;box-shadow:var(--stwd-elev)}',
      '/* --- native task progress ---------------------------------------------- */',
      '.stwd-tasks{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border:.5px solid var(--stwd-border-soft);border-radius:10px;background:var(--dsw-alias-bg-layer-1);min-width:0}',
      '.stwd-tasks-empty{flex-direction:row;align-items:baseline;gap:8px}',
      '.stwd-tasks-head{display:flex;align-items:baseline;gap:6px;min-width:0}',
      '.stwd-tasks-label{font-size:11px;line-height:16px;color:var(--stwd-muted)}',
      '.stwd-tasks-count{font-size:13px;line-height:18px;font-weight:500;font-variant-numeric:tabular-nums}',
      '.stwd-tasks-source{margin-left:auto;font-size:10.5px;line-height:16px;color:var(--stwd-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-tasks-note{font-size:11px;line-height:16px;color:var(--stwd-muted)}',
      '.stwd-tasks-bar{display:flex;align-items:center;gap:2px;height:5px}',
      '.stwd-tseg{flex:1 1 0;min-width:3px;height:5px;border-radius:2px;background:var(--stwd-muted);opacity:.25}',
      '.stwd-tseg-done{background:var(--dsw-alias-state-success-primary);opacity:1}',
      '.stwd-tseg-running{background:var(--stwd-live);opacity:1;animation:stwd-breathe 2s ease-in-out infinite}',
      '.stwd-tseg-blocked{background:var(--dsw-alias-state-warn-primary);opacity:1}',
      '.stwd-tasks-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:10.5px;line-height:15px;color:var(--stwd-muted);font-variant-numeric:tabular-nums}',
      '.stwd-tasks-meta-item{white-space:nowrap}',
      '.stwd-tasks-percent{margin-left:auto;font-variant-numeric:tabular-nums}',
      '.stwd-tone-progress{color:var(--stwd-live)}',
      '.stwd-tone-warn{color:var(--dsw-alias-state-warn-primary)}',
      '/* --- sections ----------------------------------------------------------- */',
      '.stwd-section{display:flex;flex-direction:column;gap:8px;min-width:0}',
      '.stwd-section-head{display:flex;align-items:center;gap:8px;min-width:0}',
      '.stwd-section-title{margin:0;font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-primary)}',
      '.stwd-section-count{font-size:11px;line-height:16px;color:var(--stwd-muted);font-variant-numeric:tabular-nums}',
      '.stwd-section-actions{margin-left:auto;display:inline-flex;align-items:center;gap:6px;min-width:0}',
      '.stwd-roster-meta{display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end}',
      '/* --- pills, dots, chips ------------------------------------------------- */',
      '.stwd-pill{display:inline-flex;align-items:center;gap:4px;flex:none;padding:0 6px;border-radius:999px;border:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:16px;white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.stwd-pill-progress{border-color:color-mix(in srgb,var(--stwd-live) 45%,transparent);color:var(--stwd-live)}',
      '.stwd-pill-done{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 45%,transparent);color:var(--dsw-alias-state-success-primary)}',
      '.stwd-pill-warn{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 50%,transparent);color:var(--dsw-alias-state-warn-primary)}',
      '.stwd-dot{display:inline-block;width:6px;height:6px;flex:none;border-radius:50%;background:var(--stwd-muted)}',
      '.stwd-dot-progress{background:var(--stwd-live);animation:stwd-breathe 2s ease-in-out infinite}',
      '.stwd-dot-done{background:var(--dsw-alias-state-success-primary)}',
      '.stwd-dot-warn{background:var(--dsw-alias-state-warn-primary);animation:stwd-breathe 2s ease-in-out infinite}',
      '.stwd-dot-idle{background:var(--dsw-alias-state-idle-primary,var(--stwd-muted))}',
      '/* --- team graph --------------------------------------------------------- */',
      '.stwd-graph{position:relative;min-width:0;width:100%}',
      '.stwd-graph-view{position:relative;overflow:hidden;border-radius:10px;border:.5px solid var(--stwd-border-soft);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 55%,transparent);touch-action:none;cursor:grab;min-width:0}',
      '.stwd-graph-view-moving{cursor:grabbing}',
      '.stwd-graph-view:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}',
      '.stwd-graph-stage{position:relative;transform-origin:0 0;will-change:transform}',
      '.stwd-graph-edges{position:absolute;top:0;left:0;pointer-events:none;overflow:visible}',
      '.stwd-graph-canvas{position:relative;width:100%;min-width:0}',
      '.stwd-graph-bar{display:flex;flex-direction:column;gap:4px;min-width:0;margin-bottom:4px}',
      '.stwd-graph-bar-row{display:flex;align-items:center;gap:8px;min-height:22px;min-width:0}',
      '.stwd-graph-hint{flex:1;margin:0;font-size:10.5px;line-height:15px;color:var(--stwd-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.stwd-graph-tools{display:flex;align-items:center;gap:2px;flex:none;padding:2px;border-radius:7px;border:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-1)}',
      '.stwd-graph-tool{min-width:20px;height:20px;padding:0 4px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:1;cursor:pointer}',
      '.stwd-graph-tool:hover{background:var(--stwd-hover);color:var(--dsw-alias-label-primary)}',
      '.stwd-graph-zoom{min-width:38px;font-variant-numeric:tabular-nums}',
      '.stwd-graph-filters{flex-wrap:wrap;gap:6px}',
      '.stwd-filters{display:inline-flex;align-items:center;gap:2px;flex:none;padding:2px;border-radius:7px;border:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-1)}',
      '.stwd-filter{height:20px;padding:0 8px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;line-height:1;cursor:pointer;white-space:nowrap}',
      '.stwd-filter:hover{background:var(--stwd-hover);color:var(--dsw-alias-label-primary)}',
      '.stwd-filter-on{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:500}',
      '.stwd-graph-hidden{font-size:10px;line-height:14px;color:var(--stwd-muted);white-space:nowrap}',
      '.stwd-graph-links{position:absolute;top:0;left:0;pointer-events:none;overflow:visible}',
      '.stwd-link{fill:none;stroke:color-mix(in srgb,var(--stwd-muted) 75%,var(--stwd-border-strong));stroke-width:1.3;stroke-linejoin:round}',
      '.stwd-link-trunk{stroke:color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,var(--stwd-border-strong))}',
      '.stwd-link-branch{stroke:var(--stwd-border-strong)}',
      '.stwd-link-active{stroke:var(--dsw-alias-state-warn-primary);stroke-dasharray:4 3}',
      '.stwd-link-head{fill:var(--stwd-border-strong);stroke:none}',
      '.stwd-hub{position:absolute;border-radius:9px;border:.5px solid var(--stwd-border-soft);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 60%,transparent)}',
      '.stwd-hub:hover{border-color:var(--stwd-border-strong)}',
      '.stwd-hub-waiting{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 50%,transparent)}',
      '.stwd-hub-collapsed{background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 82%,transparent)}',
      '.stwd-hub-head{display:flex;align-items:center;gap:5px;width:100%;height:100%;margin:0;padding:0 8px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;line-height:1;text-align:left;cursor:pointer;white-space:nowrap}',
      '.stwd-hub-head:hover{color:var(--dsw-alias-label-primary)}',
      '.stwd-hub-title{letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis}',
      '.stwd-hub-count{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);flex:none}',
      '.stwd-hub-waiting-dot{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-state-warn-primary);flex:none}',
      '.stwd-hub-caret{margin-left:auto;font-size:10px;line-height:1;flex:none}',
      '.stwd-graph-empty{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:18px 14px;border-radius:10px;border:.5px dashed var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-1)}',
      '.stwd-graph-empty-title{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary)}',
      '.stwd-graph-empty-hint{margin:0;font-size:11px;line-height:16px;color:var(--stwd-muted)}',
      '.stwd-graph-reset{margin-top:4px;height:24px;padding:0 10px;border:.5px solid var(--stwd-border-strong);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;cursor:pointer}',
      '.stwd-leadnode{position:absolute;display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:10px;border:.5px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 6%,var(--dsw-alias-bg-layer-1));overflow:hidden}',
      '.stwd-leadnode-avatar{margin-top:1px;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;flex:none;border-radius:50%;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary);font-size:10px;font-weight:500}',
      '.stwd-leadnode-body{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}',
      '.stwd-leadnode-row{display:flex;align-items:center;gap:5px;min-width:0}',
      '.stwd-leadnode-title{font-size:11.5px;line-height:15px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-leadnode-state{margin-left:auto;font-size:9.5px;line-height:13px;color:var(--stwd-muted);white-space:nowrap;flex:none}',
      '.stwd-leadnode-meta{display:flex;align-items:baseline;gap:6px;min-width:0;font-size:9.5px;line-height:13px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-leadnode-model{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '.stwd-leadnode-metrics{margin-top:auto;font-size:9px;line-height:12px;color:var(--stwd-muted);white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.stwd-leadnode-task{font-size:10.5px;line-height:14px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-gnode{position:absolute;display:flex;flex-direction:column;border-radius:10px;border:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-1);min-width:0}',
      '.stwd-gnode-running{box-shadow:inset 2px 0 0 var(--stwd-live);border-color:color-mix(in srgb,var(--stwd-live) 40%,var(--stwd-border-soft))}',
      '.stwd-gnode-waiting{box-shadow:inset 2px 0 0 var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 55%,transparent)}',
      '.stwd-gnode-done{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 35%,transparent)}',
      '.stwd-gnode-pending{border-style:dashed}',
      '.stwd-gnode-selected{box-shadow:inset 0 0 0 1.5px var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary))}',
      '.stwd-gnode-main{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;padding:5px 8px 6px;border:0;border-radius:9px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;overflow:hidden}',
      '.stwd-gnode-main:hover{background:var(--stwd-hover)}',
      '.stwd-gnode-top{display:flex;align-items:center;gap:5px;min-width:0}',
      '.stwd-gnode-avatar{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;flex:none;border-radius:50%;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:9.5px;line-height:1;font-weight:500}',
      '.stwd-gnode-role{font-size:11.5px;line-height:16px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-gnode-state{margin-left:auto;display:inline-flex;align-items:center;gap:4px;flex:none;font-size:9.5px;line-height:14px;color:var(--stwd-muted);white-space:nowrap}',
      '.stwd-gnode-model{font-size:9.5px;line-height:14px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '.stwd-gnode-metrics{margin-top:auto;padding-right:20px;font-size:9px;line-height:13px;color:var(--stwd-muted);white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.stwd-gnode-task{font-size:10.5px;line-height:15px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-gnode-more{position:absolute;right:2px;bottom:2px;width:20px;height:18px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--stwd-muted);font:inherit;font-size:11px;line-height:1;cursor:pointer}',
      '.stwd-gnode-more:hover{background:var(--stwd-hover);color:var(--dsw-alias-label-primary)}',
      '/* --- agent rows --------------------------------------------------------- */',
      '.stwd-rows{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.stwd-row{display:flex;align-items:center;gap:7px;width:100%;padding:5px 7px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;min-width:0}',
      '.stwd-row:hover{background:var(--stwd-hover)}',
      '.stwd-row-body{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}',
      '.stwd-row-title{font-size:12px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-arow{position:relative;display:flex;border-radius:8px;min-width:0}',
      '.stwd-arow-running{box-shadow:inset 2px 0 0 var(--stwd-live)}',
      '.stwd-arow-waiting{box-shadow:inset 2px 0 0 var(--dsw-alias-state-warn-primary)}',
      '.stwd-arow-selected{background:var(--dsw-alias-bg-layer-2)}',
      '.stwd-arow-main{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;padding:6px 26px 6px 8px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}',
      '.stwd-arow-main:hover{background:var(--stwd-hover)}',
      '.stwd-arow-top{display:flex;align-items:center;gap:5px;min-width:0;font-size:11.5px;line-height:16px}',
      '.stwd-arow-avatar{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;flex:none;border-radius:50%;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:9.5px;line-height:1;font-weight:500}',
      '.stwd-arow-role{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-arow-roleid{font-family:var(--stwd-mono);font-size:9.5px;line-height:14px;color:var(--stwd-muted);white-space:nowrap}',
      '.stwd-arow-state{margin-left:auto;display:inline-flex;align-items:center;gap:4px;flex:none;font-size:9.5px;line-height:14px;color:var(--stwd-muted);white-space:nowrap}',
      '.stwd-arow-model{font-size:10px;line-height:15px;color:var(--stwd-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}',
      '.stwd-arow-line{display:flex;align-items:baseline;gap:6px;min-width:0}',
      '.stwd-arow-task{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-arow-meta{font-size:9.5px;line-height:14px;color:var(--stwd-muted);font-variant-numeric:tabular-nums;white-space:nowrap;flex:none}',
      '.stwd-arow-more{position:absolute;right:2px;bottom:2px;width:20px;height:18px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--stwd-muted);font:inherit;font-size:11px;line-height:1;cursor:pointer}',
      '.stwd-arow-more:hover{background:var(--stwd-hover);color:var(--dsw-alias-label-primary)}',
      '.stwd-artrow-glyph{flex:none;width:16px;text-align:center;color:var(--stwd-muted)}',
      '/* --- agent detail ------------------------------------------------------- */',
      '.stwd-gdetail{display:flex;flex-direction:column;gap:7px;padding:9px 10px;border:.5px solid var(--stwd-border);border-radius:10px;background:var(--dsw-alias-bg-layer-2);min-width:0}',
      '.stwd-gdetail-head{display:flex;align-items:center;gap:6px;min-width:0}',
      '.stwd-gdetail-title{font-size:12px;line-height:18px;font-weight:500}',
      '.stwd-gdetail-role{font-size:10.5px;line-height:16px;color:var(--stwd-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
      '.stwd-gdetail-close{margin-left:auto;flex:none}',
      '.stwd-gdetail-hint{margin:0;font-size:10.5px;line-height:15px;color:var(--dsw-alias-state-warn-primary)}',
      '.stwd-gdetail-grid{display:grid;grid-template-columns:minmax(52px,auto) minmax(0,1fr);gap:3px 8px;margin:0;min-width:0}',
      '.stwd-gdetail-grid dt{font-size:10.5px;line-height:15px;color:var(--stwd-muted);white-space:nowrap}',
      '.stwd-gdetail-grid dd{margin:0;font-size:11px;line-height:15px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;min-width:0}',
      '.stwd-gdetail-tokens{margin:0;font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
      '/* --- artifacts ---------------------------------------------------------- */',
      '.stwd-artifacts{display:flex;flex-direction:column;gap:6px;padding-top:8px;border-top:.5px solid var(--stwd-border-soft);min-width:0}',
      '.stwd-artifacts-head{display:flex;align-items:center;gap:6px;min-height:22px;padding:0;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;text-align:left;min-width:0}',
      '.stwd-artifacts-head:hover .stwd-artifacts-title{color:var(--dsw-alias-brand-primary)}',
      '.stwd-artifacts-title{font-size:12px;line-height:18px;font-weight:500}',
      '.stwd-artifacts-count{font-size:11px;line-height:16px;color:var(--stwd-muted);font-variant-numeric:tabular-nums}',
      '.stwd-artifacts-caret{margin-left:auto;font-size:10px;line-height:16px;color:var(--stwd-muted)}',
      '.stwd-artifacts-dir{display:flex;gap:4px;align-items:baseline;margin:0;font-size:10.5px;line-height:15px;color:var(--stwd-muted);min-width:0}',
      '.stwd-artifacts-dir-label{flex:none}',
      '.stwd-artifacts-dir .stwd-mono{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '/* --- alerts, empty states, skeletons ------------------------------------ */',
      '.stwd-alert{display:flex;gap:6px;margin:0;padding:6px 8px;border-radius:8px;border:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-1);font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-empty{display:flex;flex-direction:column;gap:6px;padding:10px;border:.5px dashed var(--stwd-border);border-radius:10px;min-width:0}',
      '.stwd-empty-title{margin:0;font-size:12px;line-height:18px;font-weight:500}',
      '.stwd-empty-text{margin:0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-empty-steps{margin:0;padding-left:16px;font-size:11px;line-height:16px;color:var(--stwd-muted)}',
      '.stwd-skeleton-block{display:flex;flex-direction:column;gap:6px}',
      '.stwd-skeleton{display:block;height:12px;border-radius:4px;background:var(--dsw-alias-bg-layer-2)}',
      '/* --- controls ----------------------------------------------------------- */',
      '.stwd-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:.5px solid transparent;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:1;cursor:pointer}',
      '.stwd-iconbtn:hover:not(:disabled){background:var(--stwd-hover);color:var(--dsw-alias-label-primary)}',
      '.stwd-iconbtn:disabled{opacity:.5;cursor:default}',
      '.stwd-panel-refresh{margin-left:auto}',
      '.stwd-btn{min-height:24px;padding:2px 10px;border:.5px solid var(--stwd-border);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;line-height:18px;cursor:pointer;align-self:flex-start}',
      '.stwd-btn:hover:not(:disabled){background:var(--stwd-hover)}',
      '.stwd-btn:disabled{opacity:.5;cursor:default}',
      '.stwd-state{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-state-dirty{color:var(--dsw-alias-state-warn-primary)}',
      '.stwd-select{width:100%;min-height:24px;padding:1px 6px;border:.5px solid var(--stwd-border);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11.5px;line-height:18px}',
      '.stwd-select:disabled{opacity:.55}',
      '.stwd-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '.stwd-spacer{flex:1}',
      '/* --- configuration table ------------------------------------------------ */',
      '.stwd-table{display:flex;flex-direction:column;border:.5px solid var(--stwd-border-soft);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}',
      '.stwd-tr{display:grid;grid-template-columns:minmax(112px,1.1fr) repeat(3,minmax(96px,1fr)) minmax(84px,.8fr);gap:8px;align-items:center;padding:7px 9px;border-top:.5px solid var(--stwd-border-soft)}',
      '.stwd-tr:first-child{border-top:0}',
      '.stwd-tr-head{padding:5px 9px;background:var(--dsw-alias-bg-layer-2)}',
      '.stwd-tr-default{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 4%,transparent)}',
      '.stwd-th{font-size:10.5px;line-height:16px;font-weight:400;color:var(--stwd-muted)}',
      '.stwd-th-last,.stwd-cell-last{display:flex;align-items:center;gap:5px;justify-content:flex-start}',
      '.stwd-cell{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.stwd-cell-label{font-size:10px;line-height:14px;color:var(--stwd-muted)}',
      '.stwd-cell-hint{font-size:10px;line-height:14px;color:var(--dsw-alias-state-warn-primary)}',
      '.stwd-cell-role{display:flex;flex-direction:column;gap:1px;min-width:0}',
      '.stwd-role-name{font-size:12px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-role-sub{font-size:10px;line-height:14px;color:var(--stwd-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-role-id{font-family:var(--stwd-mono)}',
      '/* --- host header + tab chip --------------------------------------------- */',
      '.stwd-headbtn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.stwd-headbtn:hover{background:var(--stwd-hover);color:var(--dsw-alias-label-primary)}',
      '.stwd-headwrap{display:inline-flex;align-items:center}',
      '.stwd-headwrap>style,.stwd-tabtitle>style{display:none}',
      '.stwd-tabtitle{display:inline-flex;align-items:center;gap:5px;min-width:0}',
      '.stwd-tabtitle-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '/* --- motion + responsive ------------------------------------------------ */',
      '@keyframes stwd-breathe{0%,100%{opacity:.5}50%{opacity:1}}',
      '@keyframes stwd-flow{to{stroke-dashoffset:-14}}',
      '@media (max-width:420px){',
      '.stwd-arow-roleid{display:none}',
      '.stwd-gnode-model{font-size:9.5px}',
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

    /** The injected face of one Session's board: artifacts, clock, projections and navigation. */
    function makePanelFace(ctx, sessionId, text, lang) {
      const loader = createRunLoader(ctx, sessionId);
      return {
        text,
        lang,
        now: () => Date.now(),
        loadRun: () => loader.load(),
        refreshChild: (childId) => {
          const sessions = ctx ? ctx.sessions : undefined;
          if (!sessions || typeof sessions.refreshProjections !== 'function') return Promise.resolve();
          try {
            return Promise.resolve(sessions.refreshProjections(childId)).catch(() => {});
          } catch {
            return Promise.resolve();
          }
        },
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
