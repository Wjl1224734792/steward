window.__ModuleLoader__.load({
  id: 'dsh-steward',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    /** Native DSH settings namespace owned by this plugin (the Loader row id). */
    const NS = 'steward';
    const FIELDS = ['provider', 'model', 'effort'];

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
        nav: 'Steward 子代理',
        title: 'Steward 子代理模型',
        subtitle: '为 7 个角色分别指定模型与思考强度。角色本身是 DSH Agent Preset（steward-<role>），这里的路由只决定它们启动时用哪个模型；未指定的角色继承主代理。保存后下一次派发立即生效。',
        defaultsTitle: '默认配置',
        defaultsSub: '没有单独配置的角色使用这里的模型与档位。',
        rolesTitle: '角色（Agent Presets）',
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
        pathLabel: '设置命名空间',
        presetLabel: '预设',
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
        dirtyConflict: '检测到外部更新',
        externalUpdate: '设置已在其他位置更新；撤销后会载入新值。',
      },
      en: {
        nav: 'Steward subagents',
        title: 'Steward subagent models',
        subtitle: 'Pick a model and reasoning effort for each of the 7 roles. Roles are DSH Agent Presets (steward-<role>); these routes only choose the model they start with. Unconfigured roles inherit the parent agent. Saved changes apply to the next dispatch.',
        defaultsTitle: 'Defaults',
        defaultsSub: 'Roles without their own selection use this model and effort.',
        rolesTitle: 'Roles (Agent Presets)',
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
        pathLabel: 'Settings namespace',
        presetLabel: 'Preset',
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
        dirtyConflict: 'External update detected',
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

    function StewardPage({ ctx, lang, compact }) {
      const text = STRINGS[lang] || STRINGS.zh;
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
        return h('div', { className: 'stwd-root' }, styles(), h('div', { className: 'stwd-loading' }, text.loading));
      }
      if (snapshot.status === 'unavailable') {
        return h('div', { className: 'stwd-root' }, styles(), h('div', { className: 'stwd-banner stwd-banner-error', role: 'alert' }, text.unavailableNs));
      }
      if (!draft) {
        return h(
          'div',
          { className: 'stwd-root' },
          styles(),
          h(
            'div',
            { className: 'stwd-error-box' },
            h('div', { className: 'stwd-error-title' }, text.loadFailed),
            h('div', { className: 'stwd-error-detail' }, error || ''),
            h('button', { type: 'button', className: 'stwd-btn', onClick: discard }, text.retry),
          ),
        );
      }

      const roleRows = ROLES.map((role) => ({
        id: role.id,
        name: lang === 'zh' ? role.zh : role.en,
        description: lang === 'zh' ? role.zhDesc : role.enDesc,
        preset: `steward-${role.id}`,
      }));

      return h(
        'div',
        { className: 'stwd-root' },
        styles(),
        h(
          'header',
          { className: 'stwd-head' },
          h('div', { className: 'stwd-head-main' },
            h('h2', { className: 'stwd-title' }, text.title),
            compact ? null : h('p', { className: 'stwd-subtitle' }, text.subtitle),
          ),
          h('div', { className: 'stwd-meta' },
            h('span', { className: 'stwd-meta-item' }, text.pathLabel + '：', h('code', null, NS)),
            h('span', { className: 'stwd-meta-item' }, 'Agent Presets：', h('code', null, `steward-*（${ROLE_IDS.length}）`)),
          ),
        ),
        error ? h('div', { className: 'stwd-banner stwd-banner-error', role: 'alert' }, error) : null,
        notice ? h('div', { className: 'stwd-banner stwd-banner-ok', role: 'status' }, notice) : null,
        conflicted ? h('div', { className: 'stwd-banner stwd-banner-warn', role: 'status' }, text.externalUpdate) : null,
        invalid ? h('div', { className: 'stwd-banner stwd-banner-warn', role: 'status' }, text.invalidRoute) : null,
        !writable ? h('div', { className: 'stwd-banner stwd-banner-warn', role: 'status' }, text.readOnly) : null,
        catalog.status === 'error' ? h('div', { className: 'stwd-banner stwd-banner-warn' }, text.catalogEmpty + '：' + (catalog.error || '')) : null,
        (catalog.groups || []).length === 0 && catalog.status === 'ready' ? h('div', { className: 'stwd-banner stwd-banner-warn' }, text.catalogEmpty) : null,
        catalog.status === 'loading' ? h('div', { className: 'stwd-meta' }, text.loading) : null,
        h(
          'section',
          { className: 'stwd-card' },
          h('div', { className: 'stwd-card-main' },
            h('div', { className: 'stwd-card-title' }, text.defaultsTitle, h(SourcePill, { source: draft.defaults.provider === '' ? 'inherit' : 'defaults', text: draft.defaults.provider === '' ? text.sourceInherit : text.sourceDefaults })),
            h('div', { className: 'stwd-card-sub' }, text.defaultsSub),
          ),
          h(SelectionRow, {
            text,
            catalog,
            selection: draft.defaults,
            onChange: (selection) => update('defaults', selection),
          }),
        ),
        h('h3', { className: 'stwd-section-title' }, text.rolesTitle),
        roleRows.map((role) => {
          const selection = draft.roles[role.id] || emptySelection();
          return h(
            'section',
            { className: 'stwd-card', key: role.id },
            h(
              'div',
              { className: 'stwd-card-main' },
              h(
                'div',
                { className: 'stwd-card-title' },
                role.name,
                h('code', { className: 'stwd-code' }, role.id),
                h('code', { className: 'stwd-code' }, role.preset),
                h(SourcePill, { source: selectionSource(draft, role.id), text: sourceOf(text, selectionSource(draft, role.id)) }),
              ),
              h('div', { className: 'stwd-card-sub' }, role.description),
            ),
            h(SelectionRow, {
              text,
              catalog,
              selection,
              onChange: (next) => update(role.id, next),
              onClear: () => update(role.id, emptySelection()),
              clearable: selection.provider !== '',
            }),
          );
        }),
        h(
          'footer',
          { className: 'stwd-foot' },
          h('span', { className: 'stwd-state ' + (dirty ? 'stwd-state-dirty' : 'stwd-state-ok') }, dirty ? text.unsaved : text.synced),
          h('span', { className: 'stwd-foot-spacer' }),
          h('button', { type: 'button', className: 'stwd-btn', disabled: catalog.status === 'loading', onClick: () => void loadCatalog() }, catalog.status === 'loading' ? text.refreshing : text.refresh),
          h('button', { type: 'button', className: 'stwd-btn', disabled: !dirty || saving, onClick: discard }, text.discard),
          h('button', { type: 'button', className: 'stwd-btn stwd-btn-primary', disabled: !dirty || saving || conflicted || invalid || !writable, onClick: () => void save() }, saving ? text.saving : text.save),
        ),
      );
    }

    function sourceOf(text, source) {
      return source === 'role' ? text.sourceRole : source === 'defaults' ? text.sourceDefaults : text.sourceInherit;
    }

    function SourcePill({ source, text }) {
      return h('span', { className: 'stwd-pill stwd-pill-' + source }, text);
    }

    function SelectionRow({ text, catalog, selection, onChange, onClear, clearable }) {
      const group = groupOf(catalog, selection.provider);
      const model = modelOf(group, selection.model);
      const efforts = effortsOf(group, selection.model);
      const effortOptions = (() => {
        const options = [{ value: '', label: text.modelDefault }];
        for (const effort of efforts) options.push({ value: effort.id, label: effort.name });
        if (selection.effort !== '' && !efforts.some((effort) => effort.id === selection.effort)) {
          options.push({ value: selection.effort, label: text.notAvailable + '：' + selection.effort });
        }
        return options;
      })();
      const providers = (catalog.groups || []).map((entry) => ({ value: entry.id, label: entry.name || entry.id }));
      const models = group ? (group.models || []).map((entry) => ({ value: entry.id, label: entry.name || entry.id })) : [];
      const missing = selection.provider !== '' && group !== null && model === null;

      return h(
        'div',
        { className: 'stwd-controls' },
        h('label', { className: 'stwd-field' },
          h('span', { className: 'stwd-field-label' }, text.providerLabel),
          h('select', {
            className: 'stwd-select',
            value: selection.provider,
            onChange: (event) => onChange({ provider: event.target.value, model: '', effort: '' }),
          },
          h('option', { value: '' }, text.inherit),
          providers.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
          selection.provider !== '' && group === null ? h('option', { value: selection.provider }, text.notAvailable + '：' + selection.provider) : null,
          ),
        ),
        h('label', { className: 'stwd-field' },
          h('span', { className: 'stwd-field-label' }, text.modelLabel),
          h('select', {
            className: 'stwd-select',
            value: selection.model,
            disabled: selection.provider === '',
            onChange: (event) => onChange({ ...selection, model: event.target.value, effort: '' }),
          },
          h('option', { value: '' }, selection.provider === '' ? text.pickProvider : text.inherit),
          models.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
          selection.model !== '' && model === null ? h('option', { value: selection.model }, text.notAvailable + '：' + selection.model) : null,
          ),
        ),
        h('label', { className: 'stwd-field' },
          h('span', { className: 'stwd-field-label' }, text.effortLabel),
          h('select', {
            className: 'stwd-select',
            value: selection.effort,
            disabled: selection.provider === '' || selection.model === '' || efforts.length === 0,
            onChange: (event) => onChange({ ...selection, effort: event.target.value }),
          },
          effortOptions.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
          ),
          selection.provider !== '' && selection.model !== '' && efforts.length === 0 ? h('span', { className: 'stwd-hint' }, text.noEfforts) : null,
        ),
        clearable ? h('button', { type: 'button', className: 'stwd-btn stwd-btn-ghost', onClick: onClear }, text.clearRole) : null,
        missing ? h('span', { className: 'stwd-hint' }, text.missingSelection) : null,
      );
    }

    function styles() {
      return h('style', { key: 'stwd-css' }, [
        '.stwd-root{display:flex;flex-direction:column;gap:12px;max-width:920px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.55}',
        '.stwd-head{display:flex;flex-direction:column;gap:6px}',
        '.stwd-title{margin:0;font-size:16px;font-weight:600;letter-spacing:.01em}',
        '.stwd-subtitle{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px}',
        '.stwd-meta{display:flex;flex-wrap:wrap;gap:12px;color:var(--dsw-alias-label-secondary);font-size:12px}',
        '.stwd-meta code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:1px 5px}',
        '.stwd-banner{border-radius:8px;padding:8px 12px;font-size:13px;border:1px solid transparent}',
        '.stwd-banner-error{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-bg-layer-1)}',
        '.stwd-banner-ok{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-bg-layer-1)}',
        '.stwd-banner-warn{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary);background:var(--dsw-alias-bg-layer-1)}',
        '.stwd-section-title{margin:6px 0 0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary)}',
        '.stwd-card{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
        '.stwd-card-main{display:flex;flex-direction:column;gap:3px}',
        '.stwd-card-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:600;font-size:13px}',
        '.stwd-code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;font-weight:400;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:1px 5px}',
        '.stwd-card-sub{color:var(--dsw-alias-label-secondary);font-size:12px}',
        '.stwd-controls{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px}',
        '.stwd-field{display:flex;flex-direction:column;gap:4px;min-width:170px;flex:1 1 170px}',
        '.stwd-field-label{font-size:11px;color:var(--dsw-alias-label-secondary)}',
        '.stwd-select{appearance:auto;min-height:30px;padding:4px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:12px;max-width:260px}',
        '.stwd-select:disabled{opacity:.55}',
        '.stwd-select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
        '.stwd-pill{font-size:11px;font-weight:500;border-radius:999px;padding:1px 8px;border:1px solid currentColor}',
        '.stwd-pill-role{color:var(--dsw-alias-brand-primary)}',
        '.stwd-pill-defaults{color:var(--dsw-alias-state-warn-primary)}',
        '.stwd-pill-inherit{color:var(--dsw-alias-state-idle-primary)}',
        '.stwd-hint{font-size:11px;color:var(--dsw-alias-state-warn-primary);flex-basis:100%}',
        '.stwd-btn{min-height:30px;padding:4px 12px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}',
        '.stwd-btn:hover:not(:disabled){background:var(--dsw-alias-bg-overlay)}',
        '.stwd-btn:disabled{opacity:.5;cursor:default}',
        '.stwd-btn-primary{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:#fff}',
        '.stwd-btn-primary:hover:not(:disabled){filter:brightness(1.05)}',
        '.stwd-btn-ghost{border-color:transparent;background:transparent;color:var(--dsw-alias-label-secondary)}',
        '.stwd-btn-ghost:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
        '.stwd-foot{display:flex;align-items:center;gap:8px;position:sticky;bottom:0;padding:10px 0 2px;background:var(--dsw-alias-bg-base)}',
        '.stwd-foot-spacer{flex:1}',
        '.stwd-state{font-size:12px;color:var(--dsw-alias-label-secondary)}',
        '.stwd-state-dirty{color:var(--dsw-alias-state-warn-primary)}',
        '.stwd-state-ok{color:var(--dsw-alias-state-success-primary)}',
        '.stwd-loading{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary);padding:18px 0}',
        '.stwd-error-box{display:flex;flex-direction:column;gap:8px;padding:16px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
        '.stwd-error-title{font-weight:600}',
        '.stwd-error-detail{color:var(--dsw-alias-state-error-primary);font-size:12px}',
      ].join('\n'));
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.session', 'configForms'],
      apply(ctx) {
        const render = (slotProps) => {
          const lang = pickLang(ctx);
          if (slotProps && slotProps.view === 'summary') return 'Steward · 子代理模型 / subagent models';
          return h(StewardPage, { ctx, lang, compact: false });
        };
        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'steward',
          order: 50,
          label: () => (STRINGS[pickLang(ctx)] || STRINGS.zh).nav,
        }, render)), 'steward: settings page');
      },
    };
  },
});
