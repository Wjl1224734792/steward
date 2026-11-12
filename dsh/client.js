window.__ModuleLoader__.load({
  id: 'dsh-steward',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    /** Native DSH settings namespace owned by this plugin (the Loader row id). */
    const NS = 'steward';
    /** Sidebar entry id / `main` slot key of the Steward page. */
    const PANEL_ID = 'steward';
    const FIELDS = ['provider', 'model', 'effort'];
    /** Remembers which team tab is expanded; storage is optional and never fatal. */
    const TEAM_STORAGE_KEY = 'dsh-steward:team';
    /** Solo dispatch list: first page size and the increment of "show more". */
    const SOLO_PAGE = 6;
    const SOLO_STEP = 12;

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
        nav: 'Steward 团队',
        title: 'Steward 团队',
        subtitle: '看清每个子代理在干什么；点卡片直接进它的会话。',
        teamsTitle: '团队',
        lead: 'Lead',
        members: '成员',
        tasks: '共享任务板',
        soloTitle: '子代理（steward_dispatch）',
        soloShort: '单人派发',
        soloParent: '来自',
        soloEmpty: '还没有派过的子代理',
        rosterEmpty: '这个团队还没有成员。',
        statusRunning: '运行中',
        statusInactive: '空闲',
        statusProvisioning: '创建中',
        statusFailed: '失败',
        statePending: '待开始',
        stateReady: '可开始',
        stateProgress: '进行中',
        stateDone: '完成',
        stateBlocked: '阻塞',
        openSession: '打开会话',
        openHint: '点击卡片打开它的会话',
        currentTask: '当前任务',
        noTask: '无',
        inherited: '继承主代理',
        configTitle: '子代理模型与思考强度',
        configSub: '按角色指定；没配的角色用默认，默认也没配就继承主代理。项目根 steward.config.json 的 modelRouting 对该角色优先。',
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
        refresh: '刷新模型目录',
        refreshing: '刷新中…',
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
        noEfforts: '该模型不暴露思考强度',
        missingSelection: '当前记录的模型不在实时目录中，请重新选择',
        saveFailed: '保存失败',
        unavailableNs: '宿主没有提供 steward 设置命名空间（请确认 Steward 插件行已启用）。',
        readOnly: '本部署的设置为只读。',
        conflict: '设置已在其他位置更新，请撤销后重试。',
        invalidRoute: '每个角色要么同时选提供方与模型，要么两者都留空（继承主代理）。',
        externalUpdate: '设置已在其他位置更新；撤销后会载入新值。',
        owner: '负责人',
        deps: '依赖',
        scope: '写入范围',
        overlap: '文件重叠',
        sectionFailed: '这一段渲染失败（其余部分仍然可用）',
        tasksEmpty: '任务板为空（Lead 还没有用 steward_board 建板）',
        buildTitle: '还没有共享任务板',
        buildHint: '启用「智能体团队」后，让 Lead 用 steward_board 把 03-plan.json 建成任务板：G1 计划批准 → 工作单 → G2 QA → G3 终审。之后这张面板与原生 Team 面板同步显示进度。',
        viewDag: '依赖图',
        viewMatrix: '归属矩阵',
        viewList: '列表',
        viewGroup: '视图',
        tasksCount: '{tasks} 个任务 · {edges} 条依赖',
        progressAria: '进度：完成 {done}/{total}',
        graphAria: '依赖图：{nodes} 个任务，{edges} 条依赖',
        graphKeys: '键盘：Tab 进入图，方向键在任务之间移动，Enter 看详情，Esc 取消选中。',
        graphEmpty: '任务板还没有任务。',
        graphCycle: '检测到环状依赖（{ids}），已改用列表视图——请修正 blockedBy。',
        boardTooMany: '任务超过 {n} 个，默认用列表显示；图视图仍可在上方切换。',
        matrixEmpty: '任务还没有写入范围（writeScopes），无法生成归属矩阵。',
        matrixCaption: '文件 × 代理归属矩阵：每行一个写入路径，每列一个代理。',
        matrixFile: '文件',
        matrixFileUnit: '文件',
        matrixOverlap: '重叠',
        matrixOverlapMark: '重叠',
        matrixUnassigned: '未指派',
        matrixMore: '还有 {n} 个文件未显示',
        detailTitle: '任务详情',
        detailHint: '点任务看详情',
        detailEmpty: '点图里的节点、矩阵格子或列表行，这里显示任务详情。',
        detailClose: '关闭详情',
        openOwner: '打开负责人会话',
        depMissing: '依赖 {ids}（不在板上）',
        railAlerts: '需要你知道',
        railAlertsNone: '没有需要处理的问题。',
        alertOverlap: '{n} 个文件被多个代理同时写入',
        alertUnknown: '{n} 条依赖指向不在板上的任务',
        footerPanes: '面板',
        soloMore: '显示更多（还有 {n} 个）',
        soloCollapse: '收起',
        soloShown: '已显示 {shown}/{total}',
        buildSteps: [
          '在会话里启用「智能体团队」（Agent Teams）。',
          '让 Lead 跑 steward_board(action="sync", plan=...) 把 03-plan.json 建成任务板。',
          '回到这里看进度；点成员卡直接进它的子会话。',
        ],
        copyHint: '复制建板指令',
        copied: '已复制',
        buildHintValue: '用 steward_board 把本次 run 的 03-plan.json 建成 Agent Teams 共享任务板：steward_board(action="sync", plan="<工件目录>/03-plan.json", level="M")，然后按 DAG 顺序派活，进度我在 Steward 面板里看。',
      },
      en: {
        nav: 'Steward team',
        title: 'Steward team',
        subtitle: 'See what every subagent is doing; click a card to open its session.',
        teamsTitle: 'Team',
        lead: 'Lead',
        members: 'Members',
        tasks: 'Shared task board',
        soloTitle: 'Subagents (steward_dispatch)',
        soloShort: 'Solo dispatch',
        soloParent: 'from',
        soloEmpty: 'No subagent dispatched yet',
        rosterEmpty: 'This team has no members yet.',
        statusRunning: 'running',
        statusInactive: 'idle',
        statusProvisioning: 'provisioning',
        statusFailed: 'failed',
        statePending: 'pending',
        stateReady: 'ready',
        stateProgress: 'in progress',
        stateDone: 'done',
        stateBlocked: 'blocked',
        openSession: 'Open session',
        openHint: 'Click a card to open its session',
        currentTask: 'Current task',
        noTask: 'none',
        inherited: 'Inherit parent',
        configTitle: 'Subagent models and reasoning effort',
        configSub: 'Pick per role; roles without a selection use the defaults, and without defaults they inherit the parent agent. A modelRouting entry in the project steward.config.json still wins.',
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
        refresh: 'Refresh catalog',
        refreshing: 'Refreshing…',
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
        noEfforts: 'This model exposes no reasoning effort',
        missingSelection: 'The recorded model is not in the live catalog; pick it again',
        saveFailed: 'Save failed',
        unavailableNs: 'The host does not serve the steward settings namespace (check that the Steward plugin row is enabled).',
        readOnly: 'This deployment stores settings read-only.',
        conflict: 'Settings changed elsewhere. Discard and try again.',
        invalidRoute: 'Each role needs both a provider and a model, or neither (inherit the parent).',
        externalUpdate: 'Settings changed elsewhere; discard to load the new values.',
        owner: 'Owner',
        deps: 'Depends on',
        scope: 'Write scope',
        overlap: 'File overlap',
        sectionFailed: 'This section failed to render (the rest still works)',
        tasksEmpty: 'The board is empty (the lead has not run steward_board yet)',
        buildTitle: 'No shared task board yet',
        buildHint: 'With Agent Teams enabled, have the lead build the board from 03-plan.json via steward_board: G1 plan approval → work items → G2 QA → G3 final review. This panel then mirrors the native Team panel.',
        viewDag: 'Graph',
        viewMatrix: 'Ownership',
        viewList: 'List',
        viewGroup: 'View',
        tasksCount: '{tasks} tasks · {edges} dependencies',
        progressAria: 'Progress: {done} of {total} done',
        graphAria: 'Dependency graph: {nodes} tasks, {edges} dependencies',
        graphKeys: 'Keyboard: Tab enters the graph, arrow keys move between tasks, Enter opens the detail, Escape clears the selection.',
        graphEmpty: 'The board has no tasks yet.',
        graphCycle: 'Cyclic dependency detected ({ids}); the list view is shown instead — fix blockedBy.',
        boardTooMany: 'More than {n} tasks: the list is shown by default; the graph is still available above.',
        matrixEmpty: 'No write scopes yet, so there is nothing to plot.',
        matrixCaption: 'File by agent ownership: one row per write path, one column per agent.',
        matrixFile: 'File',
        matrixFileUnit: 'files',
        matrixOverlap: 'Overlap',
        matrixOverlapMark: 'overlap',
        matrixUnassigned: 'Unassigned',
        matrixMore: '{n} more files not shown',
        detailTitle: 'Task detail',
        detailHint: 'Select a task to see details',
        detailEmpty: 'Select a node in the graph, a cell in the matrix or a row in the list to see details here.',
        detailClose: 'Close details',
        openOwner: "Open the owner's session",
        depMissing: 'Depends on {ids} (not on the board)',
        railAlerts: 'Needs attention',
        railAlertsNone: 'Nothing needs your attention.',
        alertOverlap: '{n} files are written by more than one agent',
        alertUnknown: '{n} dependencies point at tasks that are not on the board',
        footerPanes: 'Panel',
        soloMore: 'Show more ({n} left)',
        soloCollapse: 'Collapse',
        soloShown: 'Showing {shown} of {total}',
        buildSteps: [
          'Enable Agent Teams in the session.',
          'Have the lead run steward_board(action="sync", plan=...) over 03-plan.json.',
          'Come back here for progress; click a member card to open its session.',
        ],
        copyHint: 'Copy the board request',
        copied: 'Copied',
        buildHintValue: 'Build the Agent Teams shared board from this run\'s 03-plan.json: steward_board(action="sync", plan="<run>/03-plan.json", level="M"), then dispatch in DAG order; I will watch the Steward panel.',
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

    function emptySelection() {
      return { provider: '', model: '', effort: '' };
    }

    function selectionOf(raw) {
      if (!raw || typeof raw !== 'object') return emptySelection();
      return {
        provider: typeof raw.provider === 'string' ? raw.provider : '',
        model: typeof raw.model === 'string' ? raw.model : '',
        effort: typeof raw.effort === 'string' ? raw.effort : '',
      };
    }

    function draftFromValue(value) {
      const roles = {};
      for (const id of ROLE_IDS) roles[id] = selectionOf(value && value.roles ? value.roles[id] : null);
      return { defaults: selectionOf(value ? value.defaults : null), roles };
    }

    function sameDraft(left, right) {
      return JSON.stringify(left) === JSON.stringify(right);
    }

    function useSnapshot(scope) {
      const [snapshot, setSnapshot] = useState(() => scope.getSnapshot());
      useEffect(() => {
        setSnapshot(scope.getSnapshot());
        return scope.subscribe(() => setSnapshot(scope.getSnapshot()));
      }, [scope]);
      return snapshot;
    }

    function selectionSource(draft, roleId) {
      const own = draft.roles[roleId];
      if (own.provider !== '' && own.model !== '') return 'role';
      if (draft.defaults.provider !== '' && draft.defaults.model !== '') return 'defaults';
      return 'inherit';
    }

    /** A route is provider+model together; one half alone is invalid. */
    function partialSelection(selection) {
      return (selection.provider !== '' || selection.model !== '') && (selection.provider === '' || selection.model === '');
    }

    function groupOf(catalog, providerId) {
      return (catalog.groups || []).find((group) => group.id === providerId) || null;
    }

    function modelOf(group, modelId) {
      if (!group) return null;
      return (group.models || []).find((model) => model.id === modelId) || null;
    }

    function effortsOf(group, modelId) {
      const model = modelOf(group, modelId);
      const efforts = model && model.reasoning && Array.isArray(model.reasoning.efforts) ? model.reasoning.efforts : [];
      return efforts.map((effort) => ({ id: String(effort.id), name: String(effort.name || effort.id) }));
    }

    // --- projection helpers -------------------------------------------------------

    /**
     * A session id is not a label: `session-<rest>` sliced from 0 yields `session-`.
     * Strip the prefix, then keep the readable tail instead of cutting mid-word.
     */
    function shortId(value) {
      if (typeof value !== 'string' || value === '') return '—';
      const stripped = value.indexOf('session-') === 0 ? value.slice('session-'.length) : value;
      if (stripped === '') return '—';
      return stripped.length > 12 ? stripped.slice(0, 12) : stripped;
    }

    function taskTitle(task) {
      if (task && typeof task.subject === 'string' && task.subject !== '') return task.subject;
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
      const title = taskTitle(task);
      return /^G\d+\b/.test(title);
    }

    function gateRank(task) {
      const id = taskKey(task);
      const fromId = /(\d+)/.exec(id);
      if (fromId) return Number(fromId[1]);
      const fromTitle = /^G(\d+)/i.exec(taskTitle(task));
      return fromTitle ? Number(fromTitle[1]) : Number.MAX_SAFE_INTEGER;
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

    /** Dot tone: pending/ready stay neutral so the rail is not a traffic light. */
    function stateDotTone(state) {
      if (state === 'done') return 'done';
      if (state === 'progress') return 'progress';
      if (state === 'blocked') return 'warn';
      return 'idle';
    }

    function memberTone(member, running) {
      if (!member) return 'idle';
      if (member.phase === 'failed') return 'error';
      if (member.phase === 'provisioning') return 'warn';
      return running ? 'progress' : 'idle';
    }

    function memberStatusText(text, member, running) {
      if (!member) return text.statusInactive;
      if (member.phase === 'failed') return text.statusFailed;
      if (member.phase === 'provisioning') return text.statusProvisioning;
      return running ? text.statusRunning : text.statusInactive;
    }

    function memberName(member) {
      if (!member) return '—';
      if (typeof member.name === 'string' && member.name !== '') return member.name;
      return shortId(member.id);
    }

    function readStoredTeam() {
      try {
        if (typeof localStorage === 'undefined') return null;
        const value = localStorage.getItem(TEAM_STORAGE_KEY);
        return typeof value === 'string' && value !== '' ? value : null;
      } catch {
        return null;
      }
    }

    function writeStoredTeam(sessionId) {
      try {
        if (typeof localStorage === 'undefined' || typeof sessionId !== 'string' || sessionId === '') return;
        localStorage.setItem(TEAM_STORAGE_KEY, sessionId);
      } catch {
        // storage is a convenience; losing it only costs the remembered tab
      }
    }

    function teamMeta(sessionId, team) {
      const members = Array.isArray(team && team.members) ? team.members.filter((member) => member && typeof member.id === 'string') : [];
      const tasks = Array.isArray(team && team.tasks) ? team.tasks.filter((task) => task && (task.id !== undefined || typeof task.subject === 'string')) : [];
      const done = tasks.filter((task) => task.status === 'completed').length;
      const blocked = tasks.filter((task) => taskState(task) === 'blocked').length;
      return {
        sessionId,
        label: shortId(sessionId),
        members,
        tasks,
        gates: tasks.filter(isGateTask).sort((left, right) => gateRank(left) - gateRank(right)),
        work: tasks.filter((task) => !isGateTask(task)),
        done,
        total: tasks.length,
        blocked,
      };
    }

    function compareTeams(left, right) {
      const leftRatio = left.total === 0 ? 0 : left.done / left.total;
      const rightRatio = right.total === 0 ? 0 : right.done / right.total;
      if (leftRatio !== rightRatio) return rightRatio - leftRatio;
      return left.label < right.label ? -1 : left.label > right.label ? 1 : 0;
    }

    function pickActiveTeam(teams, remembered) {
      if (teams.length === 0) return null;
      if (typeof remembered === 'string') {
        const match = teams.find((team) => team.sessionId === remembered);
        if (match) return match;
      }
      return teams[0];
    }

    // --- presentational primitives ------------------------------------------------

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
        h('h2', { className: 'stwd-section-title' }, title),
        count === null || count === undefined || count === '' ? null : h('span', { className: 'stwd-section-count' }, count),
        actions ? h('div', { className: 'stwd-section-actions' }, actions) : null,
      );
    }

    function Alert({ tone, children }) {
      return h('div', { className: 'stwd-alert stwd-alert-' + (tone || 'info'), role: tone === 'error' ? 'alert' : 'status' }, children);
    }

    function EmptyState({ title, note, steps, action }) {
      return h('div', { className: 'stwd-empty' },
        h('span', { className: 'stwd-empty-title' }, title),
        note ? h('p', { className: 'stwd-empty-text' }, note) : null,
        steps && steps.length ? h('ol', { className: 'stwd-steps' }, steps.map((step, index) => h('li', { key: index }, step))) : null,
        action || null,
      );
    }

    function SkeletonRows({ rows }) {
      const count = typeof rows === 'number' && rows > 0 ? rows : 3;
      const items = [];
      for (let index = 0; index < count; index += 1) items.push(h('div', { key: index, className: 'stwd-skeleton' }));
      return h('div', { className: 'stwd-skeleton-rows', 'aria-hidden': 'true' }, items);
    }

    /** Sidebar mark: a lead node over two member nodes, drawn from the host icon grid. */
    function StewardIcon({ size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 16;
      return h('svg', {
        width: edge,
        height: edge,
        viewBox: '0 0 16 16',
        fill: 'none',
        'aria-hidden': 'true',
        focusable: 'false',
        style: { display: 'block' },
      },
        h('circle', { cx: '8', cy: '3.4', r: '1.8', fill: 'currentColor' }),
        h('circle', { cx: '3.4', cy: '12.4', r: '1.6', fill: 'currentColor' }),
        h('circle', { cx: '12.6', cy: '12.4', r: '1.6', fill: 'currentColor' }),
        h('path', { d: 'M8 5.4v2.9M8 8.3 3.9 10.9M8 8.3l4.1 2.6', stroke: 'currentColor', strokeWidth: '1.15', strokeLinecap: 'round' }),
      );
    }

    // --- pure derivations (no React; the whole board renders from these) ------------

    function round1(value) {
      return Math.round(value * 10) / 10;
    }

    /** Wide glyphs (CJK, fullwidth punctuation) cost two units; everything else one. */
    function isWideChar(character) {
      const code = character.codePointAt(0);
      return (code >= 0x2e80 && code <= 0x9fff)
        || (code >= 0x3000 && code <= 0x303f)
        || (code >= 0xac00 && code <= 0xd7af)
        || (code >= 0xf900 && code <= 0xfaff)
        || (code >= 0xff00 && code <= 0xff60);
    }

    function textUnits(value) {
      let units = 0;
      for (const character of String(value === undefined || value === null ? '' : value)) units += isWideChar(character) ? 2 : 1;
      return units;
    }

    /**
     * Break a label into at most `maxLines` SVG text lines of `unitsPerLine` units.
     * Words stay whole where they fit; a single long token is split by width.
     */
    function wrapSvgText(value, unitsPerLine, maxLines) {
      const text = String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
      const budget = Math.max(2, unitsPerLine);
      const limit = Math.max(1, maxLines);
      if (text === '') return [''];
      const pieces = text.split(/(?<=[ ·\-_/])/).filter((piece) => piece !== '');
      const lines = [];
      let current = '';
      let dropped = false;
      const flush = () => {
        lines.push(current.trim());
        current = '';
      };
      for (const rawPiece of pieces) {
        if (lines.length >= limit) {
          dropped = true;
          break;
        }
        const piece = current === '' ? rawPiece.replace(/^\s+/, '') : rawPiece;
        if (current !== '' && textUnits(current) + textUnits(piece) > budget) {
          flush();
          if (lines.length >= limit) {
            dropped = true;
            break;
          }
        }
        if (textUnits(current) + textUnits(piece) <= budget) {
          current += piece;
        } else {
          for (const character of [...piece]) {
            const width = isWideChar(character) ? 2 : 1;
            if (current !== '' && textUnits(current) + width > budget) {
              flush();
              if (lines.length >= limit) {
                dropped = true;
                break;
              }
            }
            current += character;
          }
        }
        if (dropped) break;
      }
      if (dropped) {
        if (current !== '') flush();
      } else if (current !== '') {
        lines.push(current.trim());
      }
      if (lines.length === 0) lines.push('');
      if (dropped) {
        const last = lines[lines.length - 1];
        lines[lines.length - 1] = (last.length > 1 ? last.slice(0, -1) : '') + '…';
      }
      return lines;
    }

    /**
     * A board node already shows the plan id and the owner, so the role token in
     * `T1 · backend-dev · 实现导出` is redundant on the card face.
     */
    function taskDisplayTitle(task) {
      const title = taskTitle(task);
      const parts = title.split(/\s*·\s*/);
      if (parts.length < 2) return title;
      const rest = parts.slice(1).join(' · ');
      const tokens = rest.split(/\s*·\s*/);
      if (tokens.length > 1) return tokens.slice(1).join(' · ');
      return rest;
    }

    /** `T1 · backend-dev · …` → `T1`; a bare `task-3` id becomes `#3`. */
    function taskShortLabel(task) {
      if (!task) return '';
      const subject = typeof task.subject === 'string' ? task.subject : '';
      const match = /^[A-Za-z]{0,3}\d+/.exec(subject);
      if (match) return match[0].toUpperCase();
      const id = task.id === undefined || task.id === null ? '' : String(task.id);
      return id === '' ? '' : id.replace(/^task-?/i, '#').toUpperCase();
    }

    /** `backend-dev-t1` → `BD`, `审查员` → `审`. */
    function initialsOf(name) {
      const value = typeof name === 'string' ? name.trim() : '';
      if (value === '') return '—';
      const parts = value.split(/[-_\s.]+/).filter((part) => part !== '');
      if (parts.length === 0) return value.slice(0, 1).toUpperCase();
      if (isWideChar(parts[0].charAt(0))) return parts[0].slice(0, 1);
      return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
    }

    function taskIds(tasks) {
      return (tasks || []).filter(Boolean).map((task) => String(task.id === undefined || task.id === null ? '' : task.id)).filter((id) => id !== '');
    }

    function dependencyIds(task, known) {
      const blockedBy = task && Array.isArray(task.blockedBy) ? task.blockedBy : [];
      const out = [];
      const seen = new Set();
      for (const raw of blockedBy) {
        const id = String(raw === undefined || raw === null ? '' : raw);
        if (id === '') continue;
        if (known && !known.has(id)) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(id);
      }
      return out;
    }

    /** Depth-first search for one dependency cycle; returns ids from the entry back to itself. */
    function cyclePath(tasks) {
      const list = (tasks || []).filter((task) => task && task.id !== undefined && task.id !== null);
      const byId = new Map(list.map((task) => [String(task.id), task]));
      const state = new Map();
      const stack = [];
      let found = null;
      const visit = (id) => {
        if (found !== null) return;
        const mark = state.get(id) || 0;
        if (mark === 2) return;
        if (mark === 1) {
          const start = stack.indexOf(id);
          found = stack.slice(start).concat(id);
          return;
        }
        state.set(id, 1);
        stack.push(id);
        for (const dependency of dependencyIds(byId.get(id), byId)) visit(dependency);
        stack.pop();
        state.set(id, 2);
      };
      for (const id of byId.keys()) visit(id);
      return found;
    }

    /**
     * Layer the task graph left to right and route orthogonal edges between layers.
     * Pure and deterministic: the same tasks always produce the same coordinates.
     */
    function layoutDag(tasks, options) {
      const settings = options || {};
      const width = Number.isFinite(settings.width) && settings.width > 0 ? settings.width : 960;
      const nodeW = settings.nodeW || 176;
      const nodeH = settings.nodeH || 54;
      const gateH = settings.gateH || 44;
      const gapX = settings.gapX === undefined ? 44 : settings.gapX;
      const gapY = settings.gapY === undefined ? 12 : settings.gapY;
      const padX = settings.padX === undefined ? 10 : settings.padX;
      const padY = settings.padY === undefined ? 12 : settings.padY;

      const list = (tasks || []).filter((task) => task && task.id !== undefined && task.id !== null);
      const byId = new Map(list.map((task) => [String(task.id), task]));
      const ids = [...byId.keys()];
      const preds = new Map(ids.map((id) => [id, []]));
      const succs = new Map(ids.map((id) => [id, []]));
      const unknownDeps = [];

      for (const id of ids) {
        const task = byId.get(id);
        const blockedBy = task && Array.isArray(task.blockedBy) ? task.blockedBy : [];
        const seen = new Set();
        for (const raw of blockedBy) {
          const dependency = String(raw === undefined || raw === null ? '' : raw);
          if (dependency === '' || dependency === id || seen.has(dependency)) continue;
          seen.add(dependency);
          if (!byId.has(dependency)) {
            unknownDeps.push({ taskId: id, dep: dependency });
            continue;
          }
          preds.get(id).push(dependency);
          succs.get(dependency).push(id);
        }
      }

      // Longest-path layering over a Kahn order; a cyclic board keeps its leftovers at level 0.
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

      const heightOf = (id) => (isGateTask(byId.get(id)) ? gateH : nodeH);
      const levelCount = levels.length;
      // Fit the graph to the container when a deep plan would otherwise scroll:
      // shrink the node width (never below `minNodeW`) before allowing overflow.
      let nodeWidth = nodeW;
      let columnGap = gapX;
      if (levelCount > 0) {
        const room = width - padX * 2;
        const ideal = levelCount * nodeW + Math.max(0, levelCount - 1) * gapX;
        if (ideal > room) {
          columnGap = Math.min(gapX, 28);
          const fitted = Math.floor((room - (levelCount - 1) * columnGap) / levelCount);
          nodeWidth = Math.max(settings.minNodeW || 148, Math.min(nodeW, fitted));
        }
      }
      const columnHeights = levels.map((column) => column.reduce((sum, id, index) => sum + heightOf(id) + (index > 0 ? gapY : 0), 0));
      const tallest = columnHeights.reduce((max, height) => Math.max(max, height), 0);
      const xAt = [];
      let cursor = padX;
      for (let index = 0; index < levelCount; index += 1) {
        xAt[index] = cursor;
        cursor += nodeWidth + columnGap;
      }
      const requiredWidth = levelCount === 0 ? padX * 2 : cursor - columnGap + padX;
      const canvasWidth = Math.max(width, requiredWidth);
      const canvasHeight = (levelCount === 0 ? 0 : tallest) + padY * 2;

      const nodes = [];
      const geometry = new Map();
      levels.forEach((column, levelIndex) => {
        let y = padY + Math.max(0, (tallest - columnHeights[levelIndex]) / 2);
        for (const id of column) {
          const height = heightOf(id);
          const node = { id, level: levelIndex, x: xAt[levelIndex], y, w: nodeWidth, h: height, gate: isGateTask(byId.get(id)) };
          nodes.push(node);
          geometry.set(id, node);
          y += height + gapY;
        }
      });

      const edges = [];
      for (const id of ids) {
        for (const dependency of preds.get(id) || []) {
          const from = geometry.get(dependency);
          const to = geometry.get(id);
          if (!from || !to) continue;
          const x1 = from.x + from.w;
          const y1 = from.y + from.h / 2;
          const x2 = to.x;
          const y2 = to.y + to.h / 2;
          const mid = x1 + Math.max(10, (x2 - x1) / 2);
          edges.push({
            from: dependency,
            to: id,
            dashed: taskState(byId.get(id)) === 'blocked',
            path: 'M ' + round1(x1) + ' ' + round1(y1) + ' H ' + round1(mid) + ' V ' + round1(y2) + ' H ' + round1(x2),
          });
        }
      }

      return {
        nodes,
        edges,
        width: canvasWidth,
        height: canvasHeight,
        requiredWidth,
        cycle: cyclePath(list),
        unknownDeps,
      };
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

    /** Ancestors and descendants of one task, used for hover path highlighting. */
    function pathSets(tasks, id) {
      const list = (tasks || []).filter(Boolean);
      const byId = new Map(list.map((task) => [String(task.id), task]));
      const start = String(id === undefined || id === null ? '' : id);
      const parentsOf = (taskId) => dependencyIds(byId.get(taskId), byId);
      const childrenOf = (taskId) => list
        .filter((task) => dependencyIds(task, byId).indexOf(taskId) >= 0)
        .map((task) => String(task.id));
      const walk = (next) => {
        const seen = new Set();
        const queue = [start];
        while (queue.length > 0) {
          const current = queue.shift();
          for (const neighbour of next(current)) {
            if (neighbour === start || seen.has(neighbour)) continue;
            seen.add(neighbour);
            queue.push(neighbour);
          }
        }
        return seen;
      };
      return { self: start, ancestors: walk(parentsOf), descendants: walk(childrenOf) };
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

    /**
     * File × agent ownership grid. Overlap is derived from the tasks themselves
     * (two different owners on one path), not parsed out of localized warning text.
     */
    function buildOwnership(tasks, limit) {
      const list = (tasks || []).filter(Boolean);
      const agents = new Map();
      const touch = (name) => {
        const key = typeof name === 'string' ? name : '';
        if (!agents.has(key)) agents.set(key, { key, name: key, initials: initialsOf(key), tone: key === '' ? 'idle' : 'member' });
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

    // --- config form (shared by the panel page and the settings section) ------------

    function roleName(role, lang) {
      return lang === 'zh' ? role.zh : role.en;
    }

    function roleDesc(role, lang) {
      return lang === 'zh' ? role.zhDesc : role.enDesc;
    }

    function sourceOf(text, source) {
      return source === 'role' ? text.sourceRole : source === 'defaults' ? text.sourceDefaults : text.sourceInherit;
    }

    function SourcePill({ source, text }) {
      return h('span', { className: 'stwd-pill stwd-pill-src-' + source }, text);
    }

    /**
     * The three route selects plus the source cell for one table row.
     * Returned as an array so callers can spread it into a grid row.
     */
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
          h(SourcePill, { source: options.source, text: sourceOf(text, options.source) }),
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
        compact
          ? null
          : h(SectionHead, { title: text.configTitle, count: text.rolesTitle + ' ' + String(ROLES.length) }),
        compact ? null : h('p', { className: 'stwd-note' }, text.configSub),
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
          h('button', { type: 'button', className: 'stwd-btn', disabled: catalog.status === 'loading', onClick: () => void loadCatalog() }, catalog.status === 'loading' ? text.refreshing : text.refresh),
          h('button', { type: 'button', className: 'stwd-btn', disabled: !dirty || saving, onClick: discard }, text.discard),
          h('button', { type: 'button', className: 'stwd-btn stwd-btn-primary', disabled: !dirty || saving || conflicted || invalid || !writable, onClick: () => void save() }, saving ? text.saving : text.save),
        ),
      );
    }

    // --- dashboard -----------------------------------------------------------------

    /**
     * A panel section must never blank the whole slot: any render error inside
     * the dashboard degrades to a readable card instead of unmounting the page.
     */
    class PanelBoundary extends React.Component {
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
            h('div', { className: 'stwd-empty-title' }, this.props.fallbackTitle || 'Panel section failed'),
            h('p', { className: 'stwd-empty-text' }, String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error)),
          );
        }
        return this.props.children;
      }
    }

    /** The member's model label, or null when the projection has no usable route. */
    function memberModelLabel(useSessionsSafe, memberId) {
      const label = useSessionsSafe((state) => {
        try {
          const projection = state && state.projectionsBySession ? state.projectionsBySession[memberId] : undefined;
          const selection = projection && projection.values ? projection.values.modelSelection : undefined;
          const next = selection ? selection.next : undefined;
          if (!next || typeof next !== 'object') return null;
          const providerId = typeof next.provider === 'string' ? next.provider : next.provider && next.provider.id;
          const modelId = typeof next.model === 'string' ? next.model : next.model && next.model.id;
          if (!providerId && !modelId) return null;
          return `${providerId || ''}/${modelId || ''}`;
        } catch {
          return null;
        }
      });
      return typeof label === 'string' && label !== '' && label !== '/' ? label : null;
    }

    // --- board primitives ---------------------------------------------------------

    function AgentAvatar({ name, tone, size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 20;
      return h('span', {
        className: 'stwd-avatar stwd-avatar-' + (tone || 'idle'),
        style: { width: edge + 'px', height: edge + 'px' },
        'aria-hidden': 'true',
      }, h('span', { className: 'stwd-avatar-text' }, initialsOf(name)));
    }

    function Legend({ text }) {
      const items = [
        { tone: 'idle', label: text.statePending },
        { tone: 'progress', label: text.stateProgress },
        { tone: 'done', label: text.stateDone },
        { tone: 'warn', label: text.stateBlocked },
      ];
      return h('div', { className: 'stwd-legend' }, items.map((item) => h('span', { className: 'stwd-legend-item', key: item.tone },
        h(StatusDot, { tone: item.tone }),
        h('span', null, item.label),
      )));
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
      const aria = text.progressAria.replace('{done}', String(stats.done)).replace('{total}', String(stats.total));
      return h('div', { className: 'stwd-segwrap' },
        h('div', { className: 'stwd-segbar', role: 'img', 'aria-label': aria }, segments),
        ticks.length > 0 ? h('div', { className: 'stwd-segticks', 'aria-hidden': 'true' }, ticks) : null,
      );
    }

    /** Completion ring for the run card. */
    function RunDonut({ text, done, total }) {
      const safeTotal = total > 0 ? total : 1;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;
      const radius = 18;
      const circumference = 2 * Math.PI * radius;
      const filled = Math.min(1, done / safeTotal) * circumference;
      const aria = text.progressAria.replace('{done}', String(done)).replace('{total}', String(total));
      return h('div', { className: 'stwd-donut', role: 'img', 'aria-label': aria },
        h('svg', { viewBox: '0 0 44 44', width: 44, height: 44, 'aria-hidden': 'true', focusable: 'false' },
          h('circle', { className: 'stwd-donut-track', cx: 22, cy: 22, r: radius, fill: 'none' }),
          h('circle', {
            className: 'stwd-donut-value',
            cx: 22,
            cy: 22,
            r: radius,
            fill: 'none',
            strokeDasharray: round1(filled) + ' ' + round1(circumference - filled),
            transform: 'rotate(-90 22 22)',
          }),
        ),
        h('span', { className: 'stwd-donut-text' }, percent + '%'),
      );
    }

    function RailMemberRow({ text, member, tasks, useSessionsSafe, useSessionStatusSafe, onOpen, onHoverOwner }) {
      const modelLabel = memberModelLabel(useSessionsSafe, member.id);
      const running = useSessionStatusSafe((state) => {
        const entry = state && typeof state.get === 'function' ? state.get(member.id) : undefined;
        return Boolean(entry && entry.running);
      });
      const tone = memberTone(member, running);
      const task = (tasks || []).find((entry) => entry && entry.ownerName === member.name) || null;
      return h('button',
        {
          type: 'button',
          className: 'stwd-rail-member',
          onClick: () => onOpen(member),
          onMouseEnter: () => onHoverOwner(member.name || ''),
          onMouseLeave: () => onHoverOwner(''),
          title: text.openHint,
          'aria-label': memberName(member) + ' · ' + memberStatusText(text, member, running) + ' · ' + text.openSession,
        },
        h(AgentAvatar, { name: memberName(member), tone }),
        h('span', { className: 'stwd-rail-body' },
          h('span', { className: 'stwd-rail-top' },
            h('span', { className: 'stwd-rail-name' }, memberName(member)),
            h('span', { className: 'stwd-rail-status' }, memberStatusText(text, member, running)),
          ),
          h('span', { className: 'stwd-rail-route', title: modelLabel === null ? undefined : modelLabel }, modelLabel === null ? text.inherited : modelLabel),
          member.phase === 'failed' && member.error
            ? h('span', { className: 'stwd-rail-error' }, String(member.error))
            : h('span', { className: 'stwd-rail-task' }, task ? taskShortLabel(task) + ' · ' + taskTitle(task) : text.noTask),
        ),
      );
    }

    function RailLeadRow({ text, sessionId, label, useSessionsSafe, useSessionStatusSafe, onOpen }) {
      const routeLabel = memberModelLabel(useSessionsSafe, sessionId);
      const running = useSessionStatusSafe((state) => {
        const entry = state && typeof state.get === 'function' ? state.get(sessionId) : undefined;
        return Boolean(entry && entry.running);
      });
      return h('button', { type: 'button', className: 'stwd-rail-lead', onClick: onOpen, title: text.openHint },
        h('span', { className: 'stwd-rail-lead-badge', 'aria-hidden': 'true' }, 'L'),
        h('span', { className: 'stwd-rail-body' },
          h('span', { className: 'stwd-rail-top' },
            h('span', { className: 'stwd-rail-name' }, text.lead),
            h('span', { className: 'stwd-rail-status' }, running ? text.statusRunning : text.statusInactive),
          ),
          h('span', { className: 'stwd-rail-route' }, routeLabel === null ? label : label + ' · ' + routeLabel),
        ),
      );
    }

    // --- dependency graph ---------------------------------------------------------

    function edgeIsHot(edge, highlight) {
      if (!highlight || highlight.size === 0) return false;
      return highlight.has(edge.from) && highlight.has(edge.to);
    }

    function DagCanvas({ text, tasks, members, selectedId, hoverId, focusOwner, onSelect, onHover }) {
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

      const layout = useMemo(() => layoutDag(tasks, { width: width > 0 ? width : 960 }), [tasks, width]);
      const byId = useMemo(() => {
        const map = new Map();
        for (const task of tasks || []) if (task) map.set(String(task.id), task);
        return map;
      }, [tasks]);
      const ownerIds = useMemo(() => {
        if (!focusOwner) return [];
        return (tasks || []).filter((task) => task && task.ownerName === focusOwner).map((task) => String(task.id));
      }, [tasks, focusOwner]);
      const highlight = useMemo(() => {
        if (!selectedId && !hoverId && ownerIds.length === 0) return null;
        const ids = new Set();
        if (selectedId && byId.has(selectedId)) {
          const sets = pathSets(tasks, selectedId);
          ids.add(selectedId);
          sets.ancestors.forEach((id) => ids.add(id));
          sets.descendants.forEach((id) => ids.add(id));
        }
        if (hoverId && byId.has(hoverId)) {
          const sets = pathSets(tasks, hoverId);
          ids.add(hoverId);
          sets.ancestors.forEach((id) => ids.add(id));
          sets.descendants.forEach((id) => ids.add(id));
        }
        if (!selectedId && !hoverId) ownerIds.forEach((id) => ids.add(id));
        return ids;
      }, [selectedId, hoverId, ownerIds, byId, tasks]);

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

      const aria = text.graphAria.replace('{nodes}', String(layout.nodes.length)).replace('{edges}', String(layout.edges.length));

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
          h('defs', null, h('marker', {
            id: 'stwd-arrow',
            viewBox: '0 0 8 8',
            refX: 7,
            refY: 4,
            markerWidth: 7,
            markerHeight: 7,
            orient: 'auto-start-reverse',
          }, h('path', { className: 'stwd-arrow-head', d: 'M0 0.7 L7 4 L0 7.3 Z' }))),
          h('g', { className: 'stwd-edges' }, layout.edges.map((edge) => h('path', {
            key: edge.from + '>' + edge.to,
            className: 'stwd-edge'
              + (edge.dashed ? ' stwd-edge-wait' : '')
              + (edgeIsHot(edge, highlight) ? ' stwd-edge-hot' : '')
              + (highlight && !edgeIsHot(edge, highlight) ? ' stwd-edge-dim' : ''),
            d: edge.path,
            markerEnd: 'url(#stwd-arrow)',
          }))),
          h('g', { className: 'stwd-nodes' }, layout.nodes.map((node) => {
            const task = byId.get(node.id);
            const state = taskState(task);
            const selected = selectedId === node.id;
            const dimmed = highlight !== null && highlight.size > 0 && !highlight.has(node.id);
            const owner = task && typeof task.ownerName === 'string' ? task.ownerName : '';
            const scopes = task && Array.isArray(task.writeScopes) ? task.writeScopes : [];
            // One unit ≈ 6px at 12px type, so this is the usable width of the card face.
            const titleLines = node.gate
              ? [stripIdPrefix(taskTitle(task)) || taskShortLabel(task)]
              : wrapSvgText(taskDisplayTitle(task), Math.floor((node.w - 26) / 6), 2);
            const titleStart = node.gate ? 32 : 19;
            return h('g', {
              key: node.id,
              ref: (element) => { nodeRefs.current[node.id] = element; },
              className: 'stwd-node'
                + (node.gate ? ' stwd-node-gate' : '')
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
              node.gate ? null : h('g', { className: 'stwd-node-foot' },
                h('circle', { className: 'stwd-node-avatar-bg', cx: 18, cy: node.h - 11, r: 6 }),
                h('text', { className: 'stwd-node-avatar', x: 18, y: node.h - 7.5, textAnchor: 'middle' }, initialsOf(owner)),
                h('text', { className: 'stwd-node-owner', x: 28, y: node.h - 7 }, owner === '' ? text.matrixUnassigned : owner),
                h('text', { className: 'stwd-node-count', x: node.w - 10, y: node.h - 7, textAnchor: 'end' }, scopes.length === 0 ? '' : scopes.length + ' ' + text.matrixFileUnit),
              ),
            );
          })),
        ),
        layout.nodes.length === 0 ? h('p', { className: 'stwd-note' }, text.graphEmpty) : null,
      );
    }

    // --- ownership matrix ---------------------------------------------------------

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
        grid.overflow > 0 ? h('tfoot', null, h('tr', null, h('td', { colSpan: grid.agents.length + 2, className: 'stwd-matrix-more' }, text.matrixMore.replace('{n}', String(grid.overflow))))) : null,
        ),
      );
    }

    // --- selection detail ---------------------------------------------------------

    function TaskDetail({ text, task, tasks, onClose, onSelect, onOpenOwner, onHover }) {
      const state = taskState(task);
      const known = new Set((tasks || []).filter(Boolean).map((entry) => String(entry.id)));
      const deps = dependencyIds(task, known);
      const missing = (Array.isArray(task.blockedBy) ? task.blockedBy : []).map(String).filter((id) => !known.has(id));
      const scopes = Array.isArray(task.writeScopes) ? task.writeScopes : [];
      const warnings = Array.isArray(task.writeScopeWarnings) ? task.writeScopeWarnings : [];
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
        meta.push(h('span', { className: 'stwd-detail-meta-item stwd-detail-warn', key: 'missing' },
          text.depMissing.replace('{ids}', missing.join('、')),
        ));
      }
      if (scopes.length > 0) {
        meta.push(h('span', { className: 'stwd-detail-meta-item', key: 'scopes' }, text.scope + ' ',
          scopes.map((scope) => h('span', { key: 'scope-' + scope, className: 'stwd-chip stwd-chip-mono', title: scope }, String(scope))),
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
          h('h3', { className: 'stwd-detail-title' }, taskTitle(task)),
          h(StatusPill, { tone: state === 'done' ? 'done' : state === 'progress' ? 'progress' : state === 'blocked' ? 'warn' : 'idle' }, stateLabel(text, state)),
          h('button', { type: 'button', className: 'stwd-iconbtn', 'aria-label': text.detailClose, title: text.detailClose, onClick: onClose }, '×'),
        ),
        h('div', { className: 'stwd-detail-meta' }, meta),
        warnings.length > 0 ? h('p', { className: 'stwd-detail-warn' }, text.overlap + '：' + warnings.join('；')) : null,
        task.description ? h('p', { className: 'stwd-detail-desc' }, String(task.description)) : null,
        owner === '' ? null : h('div', { className: 'stwd-detail-actions' },
          h('button', { type: 'button', className: 'stwd-btn', onClick: () => onOpenOwner(owner) }, text.openOwner + ' →'),
        ),
      );
    }

    function TaskListRow({ text, task, tasks, selected, onSelect }) {
      const state = taskState(task);
      const known = new Set((tasks || []).filter(Boolean).map((entry) => String(entry.id)));
      const byId = new Map((tasks || []).filter(Boolean).map((entry) => [String(entry.id), entry]));
      const deps = dependencyIds(task, known);
      const scopes = Array.isArray(task.writeScopes) ? task.writeScopes : [];
      const warnings = Array.isArray(task.writeScopeWarnings) ? task.writeScopeWarnings : [];
      const owner = typeof task.ownerName === 'string' ? task.ownerName : '';
      const meta = [];
      meta.push(h('span', { className: 'stwd-row-meta-group', key: 'owner' }, text.owner + ' ' + (owner === '' ? '—' : owner)));
      if (deps.length > 0) {
        const chips = deps.slice(0, 4).map((id) => h(Chip, {
          key: 'dep-' + id,
          mono: true,
          title: taskTitle(byId.get(id)),
        }, taskShortLabel(byId.get(id))));
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
          warnings.length > 0 ? h('span', { className: 'stwd-row-warn' }, text.overlap + '：' + warnings.join('；')) : null,
        ),
        h(StatusPill, { tone: state === 'done' ? 'done' : state === 'progress' ? 'progress' : state === 'blocked' ? 'warn' : 'idle' }, stateLabel(text, state)),
        h('span', { className: 'stwd-row-arrow', 'aria-hidden': 'true' }, selected ? '▸' : ''),
      );
    }

    function SoloRow({ text, entry, onOpen }) {
      const running = entry.activity === 'running';
      const name = typeof entry.name === 'string' && entry.name !== '' ? entry.name : String(entry.id).slice(0, 8);
      return h('button', { type: 'button', className: 'stwd-row', onClick: () => onOpen(entry), title: text.openHint },
        h(StatusDot, { tone: running ? 'progress' : 'idle' }),
        h('span', { className: 'stwd-row-body' },
          h('span', { className: 'stwd-row-title' }, name),
          h('span', { className: 'stwd-row-meta' },
            h(Chip, { mono: true }, String(entry.mode || 'spawn')),
            h('span', { className: 'stwd-row-meta-group' }, `${text.soloParent} ${shortId(entry.parentSessionId)}`),
          ),
        ),
        h(StatusPill, { tone: running ? 'progress' : 'idle' }, running ? text.statusRunning : text.statusInactive),
        h('span', { className: 'stwd-row-arrow', 'aria-hidden': 'true' }, '↗'),
      );
    }

    function collectTeams(projections) {
      const teams = [];
      for (const sessionId of Object.keys(projections)) {
        const entry = projections[sessionId];
        const team = entry && entry.values ? entry.values.agentTeam : undefined;
        if (!team || !Array.isArray(team.members)) continue;
        teams.push(teamMeta(sessionId, team));
      }
      return teams.sort(compareTeams);
    }

    function collectSoloAgents(projections) {
      const agents = [];
      for (const parentSessionId of Object.keys(projections)) {
        const entry = projections[parentSessionId];
        const catalog = entry && entry.values ? entry.values.subagentCatalog : undefined;
        if (!Array.isArray(catalog)) continue;
        for (const item of catalog) {
          if (!item || typeof item !== 'object' || typeof item.id !== 'string') continue;
          agents.push({ ...item, parentSessionId });
        }
      }
      return agents;
    }

    function StewardPage({ ctx, text, lang, panelProps }) {
      const useSessionsSafe = panelProps && typeof panelProps.useSessions === 'function' ? panelProps.useSessions : () => undefined;
      const useSessionStatusSafe = panelProps && typeof panelProps.useSessionStatus === 'function' ? panelProps.useSessionStatus : () => undefined;
      const projections = useSessionsSafe((state) => state.projectionsBySession) || {};
      const openSession = useCallback((target) => {
        try {
          const workspace = ctx.uiWorkspace;
          if (workspace === undefined || typeof workspace.openSession !== 'function') return;
          workspace.openSession(target);
        } catch {
          // navigation is best effort: the session list still works
        }
      }, [ctx]);

      const teams = useMemo(() => collectTeams(projections), [projections]);
      const soloAgents = useMemo(() => collectSoloAgents(projections), [projections]);
      const [rememberedTeam, setRememberedTeam] = useState(() => readStoredTeam());
      const [copied, setCopied] = useState(false);
      const [view, setView] = useState('dag');
      const [footerTab, setFooterTab] = useState('config');
      const [soloVisible, setSoloVisible] = useState(SOLO_PAGE);
      const [selectedTaskId, setSelectedTaskId] = useState(null);
      const [hoverTaskId, setHoverTaskId] = useState(null);
      const [focusOwner, setFocusOwner] = useState('');

      // The projections arrive already ranked by compareTeams; membership status of
      // one session is subscribed inside the row that shows it, never in a loop here
      // (a hook called per item would break the hook order when the team changes).
      const active = pickActiveTeam(teams, rememberedTeam);
      const activeMembers = useMemo(() => (active ? active.members : []), [active]);
      const activeTasks = useMemo(() => (active ? active.tasks : []), [active]);
      const stats = useMemo(() => runStats(activeTasks), [activeTasks]);
      const facts = useMemo(() => graphFacts(activeTasks), [activeTasks]);
      const ownership = useMemo(() => buildOwnership(activeTasks, 30), [activeTasks]);
      const tooMany = activeTasks.length > 40;
      const effectiveView = view === 'dag' && (facts.cycle !== null || tooMany) ? 'list' : view;

      // A stale selection must not survive a team switch, and a cyclic board cannot
      // be drawn as layers at all.
      useEffect(() => {
        setSelectedTaskId((current) => {
          if (current === null) return null;
          return activeTasks.some((task) => String(task.id) === current) ? current : null;
        });
      }, [activeTasks]);
      useEffect(() => {
        if (facts.cycle !== null) setView((current) => (current === 'dag' ? 'list' : current));
      }, [facts.cycle]);

      const selectedTask = useMemo(() => {
        if (selectedTaskId === null) return null;
        return activeTasks.find((task) => String(task.id) === selectedTaskId) || null;
      }, [activeTasks, selectedTaskId]);

      const openMember = useCallback((member) => {
        if (!active || !member) return;
        if (member.id === active.sessionId) {
          openSession(active.sessionId);
          return;
        }
        openSession({ parentSessionId: active.sessionId, childSessionId: member.id, mode: 'continuable' });
      }, [active, openSession]);

      const openOwnerByName = useCallback((name) => {
        if (!active || typeof name !== 'string' || name === '') return;
        const member = activeMembers.find((entry) => entry && entry.name === name);
        if (member) openMember(member);
      }, [active, activeMembers, openMember]);

      const selectTeam = useCallback((sessionId) => {
        setRememberedTeam(sessionId);
        writeStoredTeam(sessionId);
      }, []);

      const selectTask = useCallback((taskId) => {
        setSelectedTaskId(taskId === undefined || taskId === null ? null : String(taskId));
      }, []);

      const hoverTask = useCallback((taskId) => {
        setHoverTaskId(taskId === undefined || taskId === null ? null : String(taskId));
      }, []);

      const hoverOwner = useCallback((name) => {
        setFocusOwner(typeof name === 'string' ? name : '');
      }, []);

      const onTabKeyDown = useCallback((event) => {
        if (!event || teams.length === 0) return;
        const key = event.key;
        if (key !== 'ArrowRight' && key !== 'ArrowLeft') return;
        const index = teams.findIndex((team) => active && team.sessionId === active.sessionId);
        const from = index < 0 ? 0 : index;
        const next = key === 'ArrowRight' ? (from + 1) % teams.length : (from - 1 + teams.length) % teams.length;
        event.preventDefault();
        const target = teams[next];
        selectTeam(target.sessionId);
        try {
          if (event.currentTarget && typeof event.currentTarget.querySelector === 'function') {
            const node = event.currentTarget.querySelector('[data-team-id="' + target.sessionId + '"]');
            if (node && typeof node.focus === 'function') node.focus();
          }
        } catch {
          // focus movement is an enhancement only
        }
      }, [teams, active, selectTeam]);

      const onFooterTabKeyDown = useCallback((event) => {
        if (!event) return;
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const next = footerTab === 'config' ? 'solo' : 'config';
        setFooterTab(next);
        try {
          if (event.currentTarget && typeof event.currentTarget.querySelector === 'function') {
            const node = event.currentTarget.querySelector('#stwd-tab-' + next);
            if (node && typeof node.focus === 'function') node.focus();
          }
        } catch {
          // focus movement is an enhancement only
        }
      }, [footerTab]);

      const copyBuildHint = useCallback(() => {
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard) void navigator.clipboard.writeText(text.buildHintValue);
        } catch {
          // clipboard may be denied; the hint text above is still readable
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }, [text]);

      const copyButton = h('button', { type: 'button', className: 'stwd-btn', onClick: copyBuildHint }, copied ? text.copied : text.copyHint);

      const alerts = [];
      for (const member of activeMembers) {
        if (member && member.phase === 'failed') {
          alerts.push({ tone: 'error', text: memberName(member) + '：' + (member.error ? String(member.error) : text.statusFailed) });
        }
      }
      if (ownership.overlapCount > 0) alerts.push({ tone: 'warn', text: text.alertOverlap.replace('{n}', String(ownership.overlapCount)) });
      if (facts.unknown.length > 0) alerts.push({ tone: 'warn', text: text.alertUnknown.replace('{n}', String(facts.unknown.length)) });
      if (facts.cycle !== null) alerts.push({ tone: 'error', text: text.graphCycle.replace('{ids}', facts.cycle.join(' → ')) });

      const head = h('header', { className: 'stwd-head' },
        h('div', { className: 'stwd-head-main' },
          h('h1', { className: 'stwd-title' }, text.title),
          h('p', { className: 'stwd-subtitle', title: text.subtitle }, text.subtitle),
        ),
        active
          ? h('div', { className: 'stwd-run' },
            h(RunDonut, { text, done: stats.done, total: stats.total }),
            h('div', { className: 'stwd-run-body' },
              h('div', { className: 'stwd-run-line' },
                h('span', { className: 'stwd-run-number' }, stats.done + '/' + stats.total),
                h('span', { className: 'stwd-run-item' }, text.members + ' ' + activeMembers.length),
                h('span', { className: 'stwd-run-item' }, text.stateProgress + ' ' + stats.counts.progress),
                h('span', { className: 'stwd-run-item' }, text.stateBlocked + ' ' + stats.counts.blocked),
              ),
              h(SegmentedProgress, { text, tasks: activeTasks }),
            ),
          )
          : h('div', { className: 'stwd-run stwd-run-quiet' }, h('span', { className: 'stwd-run-item' }, text.soloShort + ' ' + soloAgents.length)),
      );

      const tabs = teams.length > 1
        ? h('div', { className: 'stwd-tabs', role: 'tablist', 'aria-label': text.teamsTitle, onKeyDown: onTabKeyDown },
          teams.map((team) => h('button', {
            type: 'button',
            key: team.sessionId,
            className: 'stwd-tab',
            role: 'tab',
            'data-team-id': team.sessionId,
            'aria-selected': active && team.sessionId === active.sessionId ? 'true' : 'false',
            title: text.teamsTitle + ' ' + team.label + ' · ' + text.stateDone + ' ' + team.done + '/' + team.total,
            onClick: () => selectTeam(team.sessionId),
          },
            h(StatusDot, { tone: team.blocked > 0 ? 'warn' : 'idle' }),
            h('span', { className: 'stwd-tab-label' }, team.label),
            h('span', { className: 'stwd-tab-count' }, team.done + '/' + team.total),
          )),
        )
        : null;

      const viewOptions = [
        { id: 'dag', label: text.viewDag },
        { id: 'matrix', label: text.viewMatrix },
        { id: 'list', label: text.viewList },
      ];
      const viewbar = active
        ? h('div', { className: 'stwd-viewbar' },
          h('div', { className: 'stwd-viewtabs', role: 'group', 'aria-label': text.viewGroup },
            viewOptions.map((option) => h('button', {
              type: 'button',
              key: option.id,
              className: 'stwd-viewtab' + (effectiveView === option.id ? ' stwd-viewtab-active' : ''),
              'aria-pressed': effectiveView === option.id ? 'true' : 'false',
              onClick: () => setView(option.id),
            }, option.label)),
          ),
          h('span', { className: 'stwd-viewcount' }, text.tasksCount.replace('{tasks}', String(stats.total)).replace('{edges}', String(facts.edges))),
          h(Legend, { text }),
        )
        : null;

      const boardBody = !active
        ? null
        : stats.total === 0
          ? h(EmptyState, { title: text.buildTitle, note: text.buildHint, steps: text.buildSteps, action: copyButton })
          : stats.total > 40 && effectiveView === 'list' && view === 'dag'
            ? h('div', { className: 'stwd-board-note' }, h('p', { className: 'stwd-note' }, text.boardTooMany.replace('{n}', String(stats.total))))
            : effectiveView === 'matrix'
              ? h(OwnershipMatrix, { text, grid: ownership, selectedId: selectedTaskId, onSelect: selectTask })
              : effectiveView === 'list'
                ? h('div', { className: 'stwd-table stwd-table-rows' },
                  activeTasks.map((task) => h(TaskListRow, {
                    key: 'task-' + String(task.id),
                    text,
                    task,
                    tasks: activeTasks,
                    selected: selectedTaskId === String(task.id),
                    onSelect: selectTask,
                  })),
                )
                : h(DagCanvas, {
                  text,
                  tasks: activeTasks,
                  members: activeMembers,
                  selectedId: selectedTaskId,
                  hoverId: hoverTaskId,
                  focusOwner,
                  onSelect: selectTask,
                  onHover: hoverTask,
                });

      const boardSection = active
        ? h('div', { className: 'stwd-stage' },
          viewbar,
          h('section', { className: 'stwd-board', 'aria-label': text.tasks },
            facts.cycle !== null ? h(Alert, { tone: 'error' }, text.graphCycle.replace('{ids}', facts.cycle.join(' → '))) : null,
            boardBody,
          ),
        )
        : null;

      const detail = selectedTask
        ? h(TaskDetail, {
          text,
          task: selectedTask,
          tasks: activeTasks,
          onClose: () => selectTask(null),
          onSelect: selectTask,
          onOpenOwner: openOwnerByName,
          onHover: hoverTask,
        })
        : h('div', { className: 'stwd-detail-empty' },
          h('span', { className: 'stwd-detail-hint' }, text.detailEmpty),
        );

      const rail = active
        ? h('aside', { className: 'stwd-rail', 'aria-label': text.teamsTitle },
          h('div', { className: 'stwd-rail-card' },
            h('div', { className: 'stwd-rail-head' },
              h('h2', { className: 'stwd-rail-title' }, text.teamsTitle),
              h('span', { className: 'stwd-rail-count' }, text.members + ' ' + activeMembers.length),
            ),
            h(RailLeadRow, {
              text,
              sessionId: active.sessionId,
              label: active.label,
              useSessionsSafe,
              useSessionStatusSafe,
              onOpen: () => openSession(active.sessionId),
            }),
            activeMembers.length === 0
              ? h('p', { className: 'stwd-note' }, text.rosterEmpty)
              : activeMembers.map((member) => h(RailMemberRow, {
                key: 'member-' + member.id,
                text,
                member,
                tasks: activeTasks,
                useSessionsSafe,
                useSessionStatusSafe,
                onOpen: openMember,
                onHoverOwner: hoverOwner,
              })),
          ),
          h('div', { className: 'stwd-rail-card' },
            h('div', { className: 'stwd-rail-head' },
              h('h2', { className: 'stwd-rail-title' }, text.railAlerts),
              alerts.length > 0 ? h('span', { className: 'stwd-rail-count' }, String(alerts.length)) : null,
            ),
            alerts.length === 0
              ? h('p', { className: 'stwd-note' }, text.railAlertsNone)
              : alerts.slice(0, 5).map((alert, index) => h('p', { key: 'alert-' + index, className: 'stwd-rail-alert stwd-rail-alert-' + alert.tone },
                h(StatusDot, { tone: alert.tone === 'error' ? 'error' : 'warn' }),
                h('span', null, alert.text),
              )),
          ),
        )
        : null;

      const lower = active ? h('div', { className: 'stwd-lower' }, detail, rail) : null;

      const onboarding = teams.length === 0
        ? h('div', { className: 'stwd-stage' },
          h(EmptyState, {
            title: text.buildTitle,
            note: text.buildHint,
            steps: text.buildSteps,
            action: copyButton,
          }),
        )
        : null;

      // Configuration and the solo dispatch list share one tabbed strip: the model
      // table is the default pane, and the solo list never grows the page without a
      // deliberate "show more". Both panes stay mounted so an unsaved draft survives
      // a tab switch; the inactive one is hidden from layout and the a11y tree.
      const soloShown = Math.min(soloAgents.length, soloVisible);
      const soloMore = soloAgents.length - soloShown;
      const soloPanel = h('div', {
        className: 'stwd-tabpanel',
        role: 'tabpanel',
        id: 'stwd-pane-solo',
        'aria-labelledby': 'stwd-tab-solo',
        hidden: footerTab !== 'solo',
      },
        h(SectionHead, { title: text.soloTitle, count: soloAgents.length === 0 ? '' : `${soloShown}/${soloAgents.length}` }),
        soloAgents.length === 0
          ? h('p', { className: 'stwd-note' }, text.soloEmpty)
          : h('div', { className: 'stwd-table stwd-table-rows' },
            soloAgents.slice(0, soloShown).map((entry) => h(SoloRow, {
              key: entry.parentSessionId + ':' + entry.id,
              text,
              entry,
              onOpen: () => openSession({ parentSessionId: entry.parentSessionId, childSessionId: entry.id, mode: 'continuable' }),
            })),
          ),
        soloMore === 0 && soloShown <= SOLO_PAGE
          ? null
          : h('div', { className: 'stwd-listfoot' },
            soloMore > 0
              ? h('button', {
                type: 'button',
                className: 'stwd-btn',
                onClick: () => setSoloVisible((current) => Math.min(soloAgents.length, current + SOLO_STEP)),
              }, text.soloMore.replace('{n}', String(soloMore)))
              : null,
            soloShown > SOLO_PAGE
              ? h('button', {
                type: 'button',
                className: 'stwd-btn stwd-btn-ghost',
                onClick: () => setSoloVisible(SOLO_PAGE),
              }, text.soloCollapse)
              : null,
            h('span', { className: 'stwd-listfoot-count' }, text.soloShown
              .replace('{shown}', String(soloShown))
              .replace('{total}', String(soloAgents.length))),
          ),
      );
      const configPanel = h('div', {
        className: 'stwd-tabpanel',
        role: 'tabpanel',
        id: 'stwd-pane-config',
        'aria-labelledby': 'stwd-tab-config',
        hidden: footerTab !== 'config',
      }, h(ConfigSection, { ctx, text, lang, compact: false }));

      const footerPanes = [
        { id: 'config', label: text.configTitle, pane: configPanel },
        { id: 'solo', label: text.soloTitle, pane: soloPanel },
      ];
      const footer = h('section', { className: 'stwd-footer', 'aria-label': text.footerPanes },
        h('div', {
          className: 'stwd-ftabs',
          role: 'tablist',
          'aria-label': text.footerPanes,
          onKeyDown: onFooterTabKeyDown,
        },
          footerPanes.map((entry) => h('button', {
            type: 'button',
            key: entry.id,
            id: 'stwd-tab-' + entry.id,
            role: 'tab',
            'aria-selected': footerTab === entry.id ? 'true' : 'false',
            'aria-controls': 'stwd-pane-' + entry.id,
            className: 'stwd-ftab',
            onClick: () => setFooterTab(entry.id),
          },
            h('span', null, entry.label),
            entry.id === 'solo' && soloAgents.length > 0 ? h('span', { className: 'stwd-tab-count' }, String(soloAgents.length)) : null,
          )),
        ),
        configPanel,
        soloPanel,
      );

      const sections = [];
      if (tabs) sections.push(h('div', { key: 'tabs', className: 'stwd-tabs-wrap' }, tabs));
      if (onboarding) sections.push(h('div', { key: 'onboarding' }, onboarding));
      if (boardSection) sections.push(h('div', { key: 'board', className: 'stwd-band' }, boardSection));
      if (lower) sections.push(h('div', { key: 'lower', className: 'stwd-band' }, lower));
      sections.push(h('div', { key: 'footer', className: 'stwd-band' }, footer));

      return h('div', { className: 'stwd-root stwd-page' },
        styles(),
        head,
        h(PanelBoundary, { fallbackTitle: text.sectionFailed }, sections),
      );
    }

    // --- settings section (compact: configuration only) ----------------------------

    function SettingsSection({ ctx, text, lang }) {
      return h('div', { className: 'stwd-root stwd-root-compact' },
        styles(),
        h(PanelBoundary, { fallbackTitle: text.sectionFailed }, h(ConfigSection, { ctx, text, lang, compact: true })),
      );
    }

    // --- stylesheet ---------------------------------------------------------------
    //
    // Scale, surfaces and states are copied from the host's own pages (the Agent
    // Teams panel and the Plugin Manager page) so this panel reads as part of the
    // same application: 20px/500 page title, 14px/500 section titles, .5px
    // hairlines, 8/12px radii, 11-13px body, tokens for every color.

    function styles() {
      return h('style', { key: 'stwd-css' }, STYLESHEET);
    }

    const STYLESHEET = [
      '/* --- shell ------------------------------------------------------------- */',
      '.stwd-root{--stwd-border:var(--dsw-alias-border-l2);--stwd-border-soft:var(--dsw-alias-border-l1);--stwd-border-strong:var(--dsw-alias-border-l3,var(--dsw-alias-border-l2));--stwd-hover:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-1));--stwd-elev:var(--dsw-elevation-panel,0 1px 2px rgb(0 0 0 / 8%));--stwd-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;font-family:inherit}',
      '.stwd-page{display:flex;flex-direction:column;align-items:center;height:100%;min-height:0;overflow-y:auto;overflow-x:hidden;padding:0 clamp(24px,4vw,48px) 48px}',
      '.stwd-page>*{width:100%;max-width:960px;flex:none}',
      '.stwd-page>style{display:none}',
      '.stwd-root-compact{display:flex;flex-direction:column;gap:8px;max-width:960px}',
      '.stwd-root-compact .stwd-section{margin-top:0}',
      '/* --- page head --------------------------------------------------------- */',
      '.stwd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-top:28px}',
      '.stwd-head-main{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.stwd-title{margin:0;font-size:20px;line-height:28px;font-weight:500}',
      '.stwd-subtitle{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;max-width:64ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
      '/* --- run card (donut + segmented progress) ------------------------------- */',
      '.stwd-run{display:flex;align-items:center;gap:10px;padding-top:4px}',
      '.stwd-run-quiet{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-run-body{display:flex;flex-direction:column;gap:6px;min-width:0;width:184px}',
      '.stwd-run-line{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.stwd-run-number{font-size:15px;line-height:20px;font-weight:500;color:var(--dsw-alias-label-primary)}',
      '.stwd-run-item{display:inline-flex;align-items:center;gap:4px}',
      '.stwd-donut{position:relative;display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;flex:none}',
      '.stwd-donut-track{stroke:var(--dsw-alias-bg-layer-2);stroke-width:5}',
      '.stwd-donut-value{stroke:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));stroke-width:5;stroke-linecap:round}',
      '.stwd-donut-text{position:absolute;font-size:10px;line-height:1;font-weight:500;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.stwd-segwrap{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.stwd-segbar{display:flex;align-items:center;gap:2px;height:6px}',
      '.stwd-seg{flex:1 1 0;min-width:4px;height:6px;border-radius:2px;background:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));opacity:.28}',
      '.stwd-seg-ready{opacity:.45}',
      '.stwd-seg-progress{background:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));opacity:1;animation:stwd-breathe 2s ease-in-out infinite}',
      '.stwd-seg-done{background:var(--dsw-alias-state-success-primary);opacity:1}',
      '.stwd-seg-blocked{background:var(--dsw-alias-state-warn-primary);opacity:1}',
      '.stwd-segticks{position:relative;height:3px}',
      '.stwd-seg-tick{position:absolute;top:0;width:1px;height:3px;background:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));transform:translateX(-50%)}',
      '@keyframes stwd-breathe{0%,100%{opacity:.55}50%{opacity:1}}',
      '/* --- view bar + legend --------------------------------------------------- */',
      '.stwd-stage{display:flex;flex-direction:column;gap:8px;margin-top:28px;min-width:0}',
      '.stwd-band{width:100%}',
      '.stwd-viewbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}',
      '.stwd-viewtabs{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:8px;border:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-1)}',
      '.stwd-viewtab{min-height:24px;padding:1px 9px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer}',
      '.stwd-viewtab:hover{background:var(--stwd-hover);color:var(--dsw-alias-label-primary)}',
      '.stwd-viewtab-active{background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);font-weight:500;box-shadow:var(--stwd-elev)}',
      '.stwd-viewcount{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.stwd-legend{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-left:auto;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-legend-item{display:inline-flex;align-items:center;gap:4px}',
      '/* --- board surface ------------------------------------------------------- */',
      '.stwd-board{position:relative;border:.5px solid var(--stwd-border-soft);border-radius:12px;background:var(--dsw-alias-bg-layer-1);padding:10px;overflow:hidden;min-width:0}',
      '.stwd-board>.stwd-alert{margin-bottom:8px}',
      '.stwd-board-note{padding:4px 2px}',
      '/* --- dependency graph ---------------------------------------------------- */',
      '.stwd-graph{width:100%;min-width:0;overflow-x:auto;overflow-y:hidden}',
      '.stwd-graph-svg{display:block;max-width:none}',
      '.stwd-edge{fill:none;stroke:var(--stwd-border);stroke-width:1}',
      '.stwd-edge-wait{stroke-dasharray:3 3}',
      '.stwd-edge-hot{stroke:var(--dsw-alias-brand-primary);stroke-width:1.5}',
      '.stwd-edge-dim{opacity:.35}',
      '.stwd-arrow-head{fill:var(--stwd-border)}',
      '.stwd-node{cursor:pointer;outline:none}',
      '.stwd-node-bg{fill:var(--dsw-alias-bg-layer-2);stroke:var(--stwd-border);stroke-width:1}',
      '.stwd-node:hover .stwd-node-bg{stroke:var(--stwd-border-strong)}',
      '.stwd-node-dim{opacity:.45}',
      '.stwd-node-accent{fill:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-node-ready .stwd-node-accent{fill:var(--dsw-alias-state-business-tertiary,var(--dsw-alias-border-l2))}',
      '.stwd-node-progress .stwd-node-accent{fill:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));animation:stwd-breathe 2s ease-in-out infinite}',
      '.stwd-node-done .stwd-node-accent{fill:var(--dsw-alias-state-success-primary)}',
      '.stwd-node-blocked .stwd-node-accent{fill:var(--dsw-alias-state-warn-primary)}',
      '.stwd-node-blocked .stwd-node-bg{stroke-dasharray:4 3}',
      '.stwd-node-selected .stwd-node-bg,.stwd-node-focused .stwd-node-bg{stroke:var(--dsw-alias-brand-primary);stroke-width:1.5}',
      '.stwd-node-ring{fill:none;stroke:var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));stroke-width:2;opacity:.55}',
      '.stwd-node-gate .stwd-node-bg{fill:var(--dsw-alias-bg-layer-1)}',
      '.stwd-node-id{fill:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-family:var(--stwd-mono);font-size:10px}',
      '.stwd-node-title{fill:var(--dsw-alias-label-primary);font-size:12px}',
      '.stwd-node-owner{fill:var(--dsw-alias-label-secondary);font-family:var(--stwd-mono);font-size:10.5px}',
      '.stwd-node-count{fill:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:10px}',
      '.stwd-node-avatar-bg{fill:var(--dsw-alias-bg-layer-1);stroke:var(--stwd-border-soft);stroke-width:1}',
      '.stwd-node-avatar{fill:var(--dsw-alias-label-secondary);font-size:8.5px;font-weight:500}',
      '/* --- ownership matrix ---------------------------------------------------- */',
      '.stwd-matrix-wrap{overflow-x:auto;min-width:0}',
      '.stwd-matrix{width:100%;border-collapse:separate;border-spacing:0;font-size:12px;line-height:18px}',
      '.stwd-matrix th,.stwd-matrix td{padding:6px 8px;text-align:left;vertical-align:middle;border-bottom:.5px solid var(--stwd-border-soft)}',
      '.stwd-matrix thead th{font-size:11px;line-height:16px;font-weight:400;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));background:var(--dsw-alias-bg-layer-1);position:sticky;top:0;z-index:1}',
      '.stwd-matrix-agent{display:inline-flex;align-items:center;gap:4px;margin-left:4px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-matrix-path{font-family:var(--stwd-mono);font-size:11px;line-height:16px;font-weight:400;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}',
      '.stwd-matrix-cell{white-space:nowrap}',
      '.stwd-matrix-none{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-matrix-chip{display:inline-flex;align-items:center;margin:0 3px 0 0;padding:0 5px;border-radius:4px;border:.5px solid var(--stwd-border);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-family:var(--stwd-mono);font-size:11px;line-height:16px;cursor:pointer}',
      '.stwd-matrix-chip:hover{border-color:var(--stwd-border-strong);background:var(--stwd-hover)}',
      '.stwd-matrix-chip-progress{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)) 40%,transparent)}',
      '.stwd-matrix-chip-done{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 40%,transparent)}',
      '.stwd-matrix-chip-blocked{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 45%,transparent)}',
      '.stwd-matrix-chip-selected{box-shadow:inset 0 0 0 1.5px var(--dsw-alias-brand-primary)}',
      '.stwd-matrix-row-overlap th,.stwd-matrix-row-overlap td{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 6%,transparent)}',
      '.stwd-matrix-overlap{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));white-space:nowrap}',
      '.stwd-matrix-row-overlap .stwd-matrix-overlap{color:var(--dsw-alias-state-warn-primary);font-weight:500}',
      '.stwd-matrix-more{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);text-align:left}',
      '/* --- selection detail ---------------------------------------------------- */',
      '.stwd-lower{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;margin-top:14px;align-items:start}',
      '.stwd-detail{display:flex;flex-direction:column;gap:8px;padding:12px;border:.5px solid var(--stwd-border);border-radius:12px;background:var(--dsw-alias-bg-layer-2);min-width:0}',
      '.stwd-detail-empty{display:flex;align-items:center;min-height:64px;padding:12px;border:.5px dashed var(--stwd-border);border-radius:12px}',
      '.stwd-detail-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-detail-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}',
      '.stwd-detail-id{font-family:var(--stwd-mono);font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);flex:none}',
      '.stwd-detail-title{margin:0;font-size:13px;line-height:20px;font-weight:500;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-detail-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-detail-meta-item{display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;min-width:0}',
      '.stwd-detail-owner{font-family:var(--stwd-mono);color:var(--dsw-alias-label-primary)}',
      '.stwd-detail-warn{font-size:11px;line-height:16px;color:var(--dsw-alias-state-warn-primary);margin:0}',
      '.stwd-detail-desc{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}',
      '.stwd-detail-actions{display:flex;align-items:center;gap:8px}',
      '.stwd-chip-button{border-color:var(--stwd-border);background:var(--dsw-alias-bg-layer-1);cursor:pointer}',
      '.stwd-chip-button:hover{background:var(--stwd-hover)}',
      '/* --- team rail ----------------------------------------------------------- */',
      '.stwd-rail{display:flex;flex-direction:column;gap:10px;min-width:0}',
      '.stwd-rail-card{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:.5px solid var(--stwd-border-soft);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}',
      '.stwd-rail-head{display:flex;align-items:baseline;gap:8px}',
      '.stwd-rail-title{margin:0;font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-secondary)}',
      '.stwd-rail-count{margin-left:auto;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-variant-numeric:tabular-nums}',
      '.stwd-rail-lead{display:flex;align-items:center;gap:8px;width:100%;padding:5px 6px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}',
      '.stwd-rail-lead:hover{background:var(--stwd-hover)}',
      '.stwd-rail-lead-badge{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;flex:none;border-radius:6px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-brand-primary);font-size:10px;line-height:1;font-weight:600}',
      '.stwd-rail-member{display:flex;align-items:flex-start;gap:8px;width:100%;padding:5px 6px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;min-width:0}',
      '.stwd-rail-member:hover{background:var(--stwd-hover)}',
      '.stwd-rail-body{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}',
      '.stwd-rail-top{display:flex;align-items:center;gap:6px;min-width:0}',
      '.stwd-rail-name{font-size:12px;line-height:18px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-rail-status{margin-left:auto;flex:none;font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-rail-route{font-family:var(--stwd-mono);font-size:10.5px;line-height:15px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-rail-task{font-size:10.5px;line-height:15px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-rail-error{font-size:10.5px;line-height:15px;color:var(--dsw-alias-state-error-primary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.stwd-rail-alert{display:flex;align-items:flex-start;gap:6px;margin:0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-rail-alert-error{color:var(--dsw-alias-state-error-primary)}',
      '.stwd-rail-alert-warn{color:var(--dsw-alias-state-warn-primary)}',
      '.stwd-rail-alert .stwd-dot{margin-top:5px}',
      '/* --- avatars ------------------------------------------------------------- */',
      '.stwd-avatar{display:inline-flex;align-items:center;justify-content:center;flex:none;border-radius:50%;border:1px solid var(--stwd-border);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}',
      '.stwd-avatar-text{font-size:9.5px;line-height:1;font-weight:500}',
      '.stwd-avatar-progress{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)) 55%,transparent);color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)) 16%,transparent)}',
      '.stwd-avatar-done{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 55%,transparent);color:var(--dsw-alias-state-success-primary)}',
      '.stwd-avatar-warn{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 55%,transparent);color:var(--dsw-alias-state-warn-primary)}',
      '.stwd-avatar-error{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 60%,transparent);color:var(--dsw-alias-state-error-primary)}',
      '/* --- footer panes (models + solo dispatch) -------------------------------- */',
      '.stwd-footer{display:flex;flex-direction:column;gap:10px;margin-top:32px;min-width:0}',
      '.stwd-ftabs{display:inline-flex;align-items:center;gap:2px;padding:3px;border-radius:9px;border:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-1);width:fit-content;max-width:100%;overflow-x:auto}',
      '.stwd-ftab{display:inline-flex;align-items:center;gap:6px;flex:none;min-height:26px;padding:2px 10px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;white-space:nowrap}',
      '.stwd-ftab:hover{background:var(--stwd-hover);color:var(--dsw-alias-label-primary)}',
      '.stwd-ftab[aria-selected="true"]{background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);font-weight:500;box-shadow:var(--stwd-elev)}',
      '.stwd-tabpanel{display:flex;flex-direction:column;gap:10px;min-width:0}',
      '.stwd-tabpanel[hidden]{display:none}',
      '.stwd-listfoot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:2px}',
      '.stwd-listfoot-count{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-variant-numeric:tabular-nums}',
      '/* --- team tabs --------------------------------------------------------- */',
      '.stwd-tabs-wrap{margin-top:16px;min-width:0}',
      '.stwd-tabs{display:flex;align-items:center;gap:2px;padding:3px;border-radius:9px;border:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-1);width:fit-content;max-width:100%;overflow-x:auto}',
      '.stwd-tab{display:inline-flex;align-items:center;gap:6px;flex:none;min-height:26px;padding:2px 10px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;white-space:nowrap}',
      '.stwd-tab:hover{background:var(--stwd-hover);color:var(--dsw-alias-label-primary)}',
      '.stwd-tab[aria-selected="true"]{background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);font-weight:500;box-shadow:var(--stwd-elev)}',
      '.stwd-tab-label{font-family:var(--stwd-mono);font-size:11px;letter-spacing:0}',
      '.stwd-tab-count{font-size:11px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-variant-numeric:tabular-nums}',
      '.stwd-tab[aria-selected="true"] .stwd-tab-count{color:var(--dsw-alias-label-secondary)}',
      '/* --- sections ---------------------------------------------------------- */',
      '.stwd-section{display:flex;flex-direction:column;gap:10px;margin-top:32px}',
      '.stwd-section-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;min-width:0}',
      '.stwd-section-title{margin:0;font-size:14px;line-height:20px;font-weight:500}',
      '.stwd-section-count{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.stwd-section-actions{margin-left:auto;display:flex;align-items:center;gap:6px}',
      '.stwd-note{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-panel{display:flex;flex-direction:column;gap:8px;padding:12px;border:.5px solid var(--stwd-border-soft);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}',
      '.stwd-spacer{flex:1}',
      '/* --- rows -------------------------------------------------------------- */',
      '.stwd-table{border:.5px solid var(--stwd-border-soft);border-radius:8px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}',
      '.stwd-table-rows{display:flex;flex-direction:column}',
      '.stwd-row{display:grid;grid-template-columns:14px minmax(0,1fr) auto 14px;align-items:start;gap:8px;width:100%;min-height:40px;padding:8px 12px;border:0;border-top:.5px solid var(--stwd-border-soft);background:transparent;color:inherit;font:inherit;text-align:left}',
      '.stwd-row:first-child{border-top:0}',
      'button.stwd-row{cursor:pointer}',
      'button.stwd-row:hover{background:var(--stwd-hover)}',
      '.stwd-row>.stwd-dot{margin-top:7px}',
      '.stwd-row-body{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.stwd-row-title{font-size:13px;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-row-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));min-width:0}',
      '.stwd-row-meta-group{display:inline-flex;align-items:center;gap:4px;min-width:0;overflow:hidden}',
      '.stwd-row-warn{font-size:11px;line-height:16px;color:var(--dsw-alias-state-warn-primary)}',
      '.stwd-row-arrow{font-size:12px;line-height:20px;color:var(--dsw-alias-brand-primary);text-align:center;opacity:.7}',
      '.stwd-row-note{grid-template-columns:minmax(0,1fr);padding:12px}',
      '.stwd-row-selected{box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary);background:var(--stwd-hover)}',
      '/* --- chips, pills, dots ------------------------------------------------ */',
      '.stwd-chip{display:inline-flex;align-items:center;max-width:180px;padding:0 4px;border-radius:4px;border:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-chip-mono{font-family:var(--stwd-mono)}',
      '.stwd-dot{display:inline-block;width:6px;height:6px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-dot-progress{background:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)) 18%,transparent)}',
      '.stwd-dot-done{background:var(--dsw-alias-state-success-primary)}',
      '.stwd-dot-warn{background:var(--dsw-alias-state-warn-primary)}',
      '.stwd-dot-error{background:var(--dsw-alias-state-error-primary)}',
      '.stwd-dot-idle{background:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-pill{display:inline-flex;align-items:center;gap:4px;flex:none;padding:0 7px;border-radius:999px;border:.5px solid transparent;font-size:11px;line-height:16px;font-weight:500;white-space:nowrap}',
      '.stwd-pill-idle{color:var(--dsw-alias-label-secondary);border-color:var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base))}',
      '.stwd-pill-progress{color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)) 10%,transparent)}',
      '.stwd-pill-done{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent)}',
      '.stwd-pill-warn{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 10%,transparent)}',
      '.stwd-pill-src-role{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 26%,transparent);background:transparent}',
      '.stwd-pill-src-defaults{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 26%,transparent);background:transparent}',
      '.stwd-pill-src-inherit{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));border-color:var(--stwd-border-soft);background:transparent}',
      '/* --- buttons ----------------------------------------------------------- */',
      '.stwd-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:28px;padding:3px 10px;border-radius:6px;border:.5px solid var(--stwd-border);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;font-weight:500;cursor:pointer;white-space:nowrap}',
      '.stwd-btn:hover:not(:disabled){background:var(--stwd-hover)}',
      '.stwd-btn:disabled{opacity:.5;cursor:default}',
      '.stwd-btn-primary{border-color:transparent;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));color:var(--dsw-alias-label-primary-foreground,#fff)}',
      '.stwd-btn-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));filter:brightness(1.06)}',
      '.stwd-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;flex:none;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font:inherit;font-size:14px;line-height:1;cursor:pointer}',
      '.stwd-iconbtn:hover{background:var(--stwd-hover);color:var(--dsw-alias-label-primary)}',
      '.stwd-iconbtn-stub{display:inline-block;width:22px;height:22px;flex:none}',
      '.stwd-root button:focus-visible,.stwd-root select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.stwd-state{display:inline-flex;align-items:center;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-state-dirty{color:var(--dsw-alias-state-warn-primary)}',
      '.stwd-state-ok{color:var(--dsw-alias-label-secondary)}',
      '/* --- config table ------------------------------------------------------ */',
      '.stwd-tr{display:grid;grid-template-columns:minmax(150px,1.15fr) minmax(130px,.95fr) minmax(150px,1.05fr) minmax(110px,.75fr) minmax(88px,auto);align-items:center;gap:8px;padding:6px 12px;border-top:.5px solid var(--stwd-border-soft)}',
      '.stwd-tr:first-child{border-top:0}',
      '.stwd-tr-head{padding-top:8px;padding-bottom:8px;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base))}',
      '.stwd-tr-default{background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base))}',
      '.stwd-th{font-size:11px;line-height:16px;font-weight:400;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-th-last{text-align:right}',
      '.stwd-cell{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.stwd-cell-role{display:flex;flex-direction:column;gap:1px;min-width:0}',
      '.stwd-role-name{font-size:13px;line-height:18px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-role-sub{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.stwd-role-id{font-family:var(--stwd-mono)}',
      '.stwd-cell-label{display:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
      '.stwd-cell-last{display:flex;flex-direction:row;align-items:center;justify-content:flex-end;gap:4px;min-width:0;flex-wrap:wrap}',
      '.stwd-cell-hint{flex-basis:100%;text-align:right;font-size:11px;line-height:16px;color:var(--dsw-alias-state-warn-primary)}',
      '.stwd-select{appearance:auto;width:100%;max-width:100%;min-height:28px;padding:2px 6px;border-radius:6px;border:.5px solid var(--stwd-border);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px}',
      '.stwd-select:disabled{opacity:.55}',
      '.stwd-toolbar{position:sticky;bottom:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 0 2px;border-top:.5px solid var(--stwd-border-soft);background:var(--dsw-alias-bg-base)}',
      '/* --- alerts, empty states, skeletons ---------------------------------- */',
      '.stwd-alert{display:flex;align-items:flex-start;padding:7px 10px;border-radius:8px;border:.5px solid transparent;font-size:12px;line-height:18px}',
      '.stwd-alert-error{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent)}',
      '.stwd-alert-ok{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 8%,transparent)}',
      '.stwd-alert-warn{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 8%,transparent)}',
      '.stwd-alert-info{color:var(--dsw-alias-label-secondary);border-color:var(--stwd-border-soft);background:var(--dsw-alias-bg-layer-1)}',
      '.stwd-empty{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:18px;border:.5px dashed var(--stwd-border);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}',
      '.stwd-empty-title{font-size:13px;line-height:18px;font-weight:500}',
      '.stwd-empty-text{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-steps{margin:0;padding-left:18px;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary)}',
      '.stwd-skeleton-rows{display:flex;flex-direction:column;gap:8px;padding:12px;border:.5px solid var(--stwd-border-soft);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}',
      '.stwd-skeleton{height:14px;border-radius:4px;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base));animation:stwd-pulse 1.4s ease-in-out infinite}',
      '@keyframes stwd-pulse{0%,100%{opacity:.45}50%{opacity:.9}}',
      '/* --- responsive -------------------------------------------------------- */',
      '@media (min-width:1180px){',
      '.stwd-lower{grid-template-columns:minmax(0,1fr) 300px}',
      '}',
      '@media (min-width:1400px){',
      '.stwd-page{padding-left:40px;padding-right:40px}',
      '}',
      '@media (max-width:760px){',
      '.stwd-page{padding-left:16px;padding-right:16px}',
      '.stwd-subtitle{white-space:normal}',
      '.stwd-run{width:100%}',
      '.stwd-run-body{width:100%}',
      '.stwd-legend{margin-left:0}',
      '.stwd-board{padding:6px}',
      '.stwd-tr{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:stretch;padding:10px 12px}',
      '.stwd-tr-head{display:none}',
      '.stwd-cell-role{grid-column:1 / -1}',
      '.stwd-cell-last{grid-column:1 / -1;justify-content:flex-start}',
      '.stwd-cell-hint{text-align:left}',
      '.stwd-cell-label{display:block}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
      '.stwd-root *{animation:none !important;transition:none !important}',
      '}',
    ].join('\n');

    return {
      inject: ['slots', 'locale', 'remote', 'remote.session', 'configForms', 'uiWorkspace'],
      apply(ctx) {
        const lang = () => pickLang(ctx);
        const textOf = () => STRINGS[lang()] || STRINGS.zh;

        // Full page + its sidebar entry (the native way to add a page).
        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register(
          { name: 'main', key: PANEL_ID, locale: NS },
          (props) => h(StewardPage, { ctx, text: textOf(), lang: lang(), panelProps: props }),
        )), 'steward: main page');

        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 60,
            locale: NS,
            label: () => (STRINGS[lang()] || STRINGS.zh).nav,
          },
          (props) => h(StewardIcon, { size: props && props.size }),
        )), 'steward: sidebar entry');

        // The same configuration form stays reachable from Settings → Steward.
        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'steward',
          order: 50,
          label: () => (STRINGS[lang()] || STRINGS.zh).nav,
        }, () => h(SettingsSection, { ctx, text: textOf(), lang: lang() }))), 'steward: settings section');
      },
    };
  },
});
