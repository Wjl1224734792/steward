window.__ModuleLoader__.load({
  id: 'dsh-steward',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useState } = React;

    const BRIDGE = '/api/dsh-steward';

    const STRINGS = {
      zh: {
        nav: 'Steward 子代理',
        title: 'Steward 子代理模型',
        subtitle: '为 7 个角色分别指定模型与思考强度；未指定的角色继承主代理。保存后下一次派发立即生效；项目 steward.config.json 的 modelRouting 优先于本页。',
        defaultsTitle: '默认配置',
        defaultsSub: '没有单独配置的角色使用这里的模型与档位。',
        rolesTitle: '角色',
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
        loading: '正在读取宿主模型目录…（首次可能需要几秒）',
        loadFailed: '读取失败',
        retry: '重试',
        pathLabel: '配置文件',
        childLabel: '派发后端',
        notAvailable: '不可用',
        catalogEmpty: '模型目录为空',
        providerLabel: '提供方',
        modelLabel: '模型',
        effortLabel: '思考强度',
        noEfforts: '该模型不暴露思考强度',
        missingSelection: '当前记录的模型不在实时目录中，请重新选择',
        saveFailed: '保存失败',
        roleFallback: '角色',
      },
      en: {
        nav: 'Steward subagents',
        title: 'Steward subagent models',
        subtitle: 'Pick a model and reasoning effort for each of the 7 roles. Unconfigured roles inherit the parent agent. Saved changes apply to the next dispatch; a project steward.config.json modelRouting entry overrides this page.',
        defaultsTitle: 'Defaults',
        defaultsSub: 'Roles without their own selection use this model and effort.',
        rolesTitle: 'Roles',
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
        loading: 'Reading the host model catalog… (the first load can take a few seconds)',
        loadFailed: 'Load failed',
        retry: 'Retry',
        pathLabel: 'Config file',
        childLabel: 'Dispatch backend',
        notAvailable: 'unavailable',
        catalogEmpty: 'The model catalog is empty',
        providerLabel: 'Provider',
        modelLabel: 'Model',
        effortLabel: 'Reasoning effort',
        noEfforts: 'This model exposes no reasoning effort',
        missingSelection: 'The recorded model is not in the live catalog; pick it again',
        saveFailed: 'Save failed',
        roleFallback: 'Role',
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

    function draftFromState(state) {
      if (!state) return null;
      const config = state.config || {};
      const roles = {};
      for (const role of state.roles || []) {
        const own = config.roles && config.roles[role.id] ? config.roles[role.id] : null;
        roles[role.id] = own ? { provider: own.provider || '', model: own.model || '', effort: own.effort || '' } : emptySelection();
      }
      const defaults = config.defaults ? { ...emptySelection(), ...config.defaults } : emptySelection();
      return { defaults, roles };
    }

    function providerOf(state, providerId) {
      if (!state || !Array.isArray(state.providers)) return null;
      return state.providers.find((provider) => provider.id === providerId) || null;
    }

    function modelOf(state, providerId, modelId) {
      const provider = providerOf(state, providerId);
      if (!provider) return null;
      return provider.models.find((model) => model.id === modelId) || null;
    }

    function JsonBridgeError(payload, fallback) {
      return payload && typeof payload.message === 'string' && payload.message !== '' ? payload.message : fallback;
    }

    async function requestState(refresh) {
      const response = await fetch(BRIDGE + '/state' + (refresh ? '?refresh=1' : ''), {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error(JsonBridgeError(payload, 'HTTP ' + response.status));
      }
      return payload.value;
    }

    async function saveState(draft) {
      const response = await fetch(BRIDGE + '/config', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ config: draft }),
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error(JsonBridgeError(payload, 'HTTP ' + response.status));
      }
      return payload.value;
    }

    function Select(props) {
      return h(
        'select',
        {
          className: 'stwd-select',
          value: props.value,
          disabled: props.disabled === true,
          onChange: (event) => props.onChange(event.target.value),
          'aria-label': props.ariaLabel,
          title: props.title,
        },
        props.children,
      );
    }

    function SourcePill(props) {
      const tone = props.source === 'role' ? 'role' : props.source === 'defaults' ? 'defaults' : 'inherit';
      return h('span', { className: 'stwd-pill stwd-pill-' + tone }, props.text);
    }

    function SelectionRow(props) {
      const { text, state, selection, onChange, onClear, clearable } = props;
      const provider = providerOf(state, selection.provider);
      const model = modelOf(state, selection.provider, selection.model);
      const efforts = model ? model.efforts : [];
      const providerMissing = selection.provider !== '' && provider === null;
      const modelMissing = selection.provider !== '' && selection.model !== '' && model === null;
      const emptyCatalog = selection.provider !== '' && provider !== null && provider.models.length === 0;

      return h(
        'div',
        { className: 'stwd-controls' },
        h(
          'label',
          { className: 'stwd-field' },
          h('span', { className: 'stwd-field-label' }, text.providerLabel),
          h(
            Select,
            {
              value: selection.provider,
              ariaLabel: text.providerLabel,
              onChange: (value) => onChange({ provider: value, model: '', effort: '' }),
            },
            h('option', { value: '' }, text.inherit),
            (state.providers || []).map((entry) => h('option', { key: entry.id, value: entry.id }, entry.name + ' · ' + entry.id)),
            providerMissing ? h('option', { value: selection.provider }, selection.provider + ' (missing)') : null,
          ),
        ),
        h(
          'label',
          { className: 'stwd-field' },
          h('span', { className: 'stwd-field-label' }, text.modelLabel),
          h(
            Select,
            {
              value: selection.model,
              disabled: selection.provider === '',
              ariaLabel: text.modelLabel,
              onChange: (value) => {
                const nextModel = modelOf(state, selection.provider, value);
                const keepEffort = nextModel && nextModel.efforts.some((effort) => effort.id === selection.effort) ? selection.effort : '';
                onChange({ ...selection, model: value, effort: keepEffort });
              },
            },
            h('option', { value: '' }, selection.provider === '' ? text.pickProvider : text.inherit),
            provider ? provider.models.map((entry) => h('option', { key: entry.id, value: entry.id }, entry.name + ' · ' + entry.id)) : null,
            modelMissing ? h('option', { value: selection.model }, selection.model + ' (missing)') : null,
          ),
        ),
        h(
          'label',
          { className: 'stwd-field' },
          h('span', { className: 'stwd-field-label' }, text.effortLabel),
          h(
            Select,
            {
              value: selection.effort,
              disabled: selection.model === '',
              ariaLabel: text.effortLabel,
              title: efforts.length === 0 ? text.noEfforts : undefined,
              onChange: (value) => onChange({ ...selection, effort: value }),
            },
            h('option', { value: '' }, text.modelDefault + (model && model.defaultEffort ? ' (' + model.defaultEffort + ')' : '')),
            efforts.map((effort) => h('option', { key: effort.id, value: effort.id }, effort.name + ' · ' + effort.id)),
          ),
        ),
        clearable
          ? h(
              'button',
              {
                type: 'button',
                className: 'stwd-btn stwd-btn-ghost',
                onClick: () => onClear(),
                title: text.clearRole,
              },
              text.clearRole,
            )
          : null,
        modelMissing ? h('div', { className: 'stwd-hint stwd-hint-warn' }, text.missingSelection) : null,
        emptyCatalog ? h('div', { className: 'stwd-hint stwd-hint-warn' }, text.catalogEmpty) : null,
      );
    }

    function StewardPage(props) {
      const text = STRINGS[props.lang] || STRINGS.zh;
      const [state, setState] = useState(null);
      const [draft, setDraft] = useState(null);
      const [loading, setLoading] = useState(true);
      const [refreshing, setRefreshing] = useState(false);
      const [saving, setSaving] = useState(false);
      const [error, setError] = useState('');
      const [notice, setNotice] = useState('');

      const adopt = useCallback((value) => {
        setState(value);
        setDraft(draftFromState(value));
      }, []);

      const load = useCallback(
        async (refresh) => {
          if (refresh) setRefreshing(true);
          else setLoading(true);
          setError('');
          try {
            const value = await requestState(refresh === true);
            adopt(value);
          } catch (failure) {
            setError((failure && failure.message) || text.loadFailed);
          } finally {
            setLoading(false);
            setRefreshing(false);
          }
        },
        [adopt, text.loadFailed],
      );

      useEffect(() => {
        void load(false);
      }, [load]);

      const initial = useMemo(() => (state ? JSON.stringify(draftFromState(state)) : ''), [state]);
      const dirty = draft !== null && JSON.stringify(draft) !== initial;

      const updateSelection = useCallback((key, selection) => {
        setDraft((current) => {
          if (!current) return current;
          if (key === 'defaults') return { ...current, defaults: selection };
          return { ...current, roles: { ...current.roles, [key]: selection } };
        });
        setNotice('');
      }, []);

      const discard = useCallback(() => {
        if (state) setDraft(draftFromState(state));
        setNotice('');
        setError('');
      }, [state]);

      const save = useCallback(async () => {
        if (!draft) return;
        setSaving(true);
        setError('');
        setNotice('');
        try {
          const value = await saveState(draft);
          adopt(value);
          setNotice(text.saved);
        } catch (failure) {
          setError((failure && failure.message) || text.saveFailed);
        } finally {
          setSaving(false);
        }
      }, [adopt, draft, text.saveFailed, text.saved]);

      if (loading) {
        return h(
          'div',
          { className: 'stwd-root' },
          styles(),
          h('div', { className: 'stwd-loading' }, h('span', { className: 'stwd-spinner', 'aria-hidden': true }), text.loading),
        );
      }

      if (!state || !draft) {
        return h(
          'div',
          { className: 'stwd-root' },
          styles(),
          h(
            'div',
            { className: 'stwd-error-box' },
            h('div', { className: 'stwd-error-title' }, text.loadFailed),
            h('div', { className: 'stwd-error-detail' }, error || ''),
            h('button', { type: 'button', className: 'stwd-btn', onClick: () => void load(false) }, text.retry),
          ),
        );
      }

      const roles = state.roles || [];
      const sourceOf = (roleId) => {
        const own = draft.roles[roleId];
        if (own && own.provider !== '' && own.model !== '') return 'role';
        if (draft.defaults.provider !== '' && draft.defaults.model !== '') return 'defaults';
        return 'inherit';
      };
      const sourceText = (source) => (source === 'role' ? text.sourceRole : source === 'defaults' ? text.sourceDefaults : text.sourceInherit);

      return h(
        'div',
        { className: 'stwd-root' },
        styles(),
        h(
          'header',
          { className: 'stwd-head' },
          h('div', { className: 'stwd-head-main' },
            h('h2', { className: 'stwd-title' }, text.title),
            h('p', { className: 'stwd-subtitle' }, text.subtitle),
          ),
          h('div', { className: 'stwd-meta' },
            h('span', { className: 'stwd-meta-item' }, text.pathLabel + '：', h('code', null, state.configPath || '')),
            state.childProvider
              ? h('span', { className: 'stwd-meta-item' }, text.childLabel + '：', h('code', null, state.childProvider.name + (state.childProvider.available ? '' : ' (' + text.notAvailable + ')')))
              : null,
          ),
        ),
        error ? h('div', { className: 'stwd-banner stwd-banner-error', role: 'alert' }, error) : null,
        notice ? h('div', { className: 'stwd-banner stwd-banner-ok', role: 'status' }, notice) : null,
        (state.providers || []).length === 0 ? h('div', { className: 'stwd-banner stwd-banner-error', role: 'alert' }, text.catalogEmpty) : null,
        h(
          'section',
          { className: 'stwd-card' },
          h('div', { className: 'stwd-card-main' },
            h('div', { className: 'stwd-card-title' }, text.defaultsTitle, h(SourcePill, { source: draft.defaults.provider === '' ? 'inherit' : 'defaults', text: sourceText(draft.defaults.provider === '' ? 'inherit' : 'defaults') })),
            h('div', { className: 'stwd-card-sub' }, text.defaultsSub),
          ),
          h(SelectionRow, {
            text,
            state,
            selection: draft.defaults,
            onChange: (selection) => updateSelection('defaults', selection),
          }),
        ),
        h('h3', { className: 'stwd-section-title' }, text.rolesTitle),
        roles.map((role) =>
          h(
            'section',
            { className: 'stwd-card', key: role.id },
            h(
              'div',
              { className: 'stwd-card-main' },
              h(
                'div',
                { className: 'stwd-card-title' },
                role.name || role.id,
                h('code', { className: 'stwd-code' }, role.id),
                h(SourcePill, { source: sourceOf(role.id), text: sourceText(sourceOf(role.id)) }),
              ),
              h('div', { className: 'stwd-card-sub' }, role.description || ''),
            ),
            h(SelectionRow, {
              text,
              state,
              selection: draft.roles[role.id] || emptySelection(),
              onChange: (selection) => updateSelection(role.id, selection),
              onClear: () => updateSelection(role.id, emptySelection()),
              clearable: (draft.roles[role.id] || emptySelection()).provider !== '',
            }),
          ),
        ),
        h(
          'footer',
          { className: 'stwd-foot' },
          h('span', { className: 'stwd-state ' + (dirty ? 'stwd-state-dirty' : 'stwd-state-ok') }, dirty ? text.unsaved : text.synced),
          h('span', { className: 'stwd-foot-spacer' }),
          h('button', { type: 'button', className: 'stwd-btn', disabled: refreshing || saving, onClick: () => void load(true) }, refreshing ? text.refreshing : text.refresh),
          h('button', { type: 'button', className: 'stwd-btn', disabled: !dirty || saving, onClick: discard }, text.discard),
          h('button', { type: 'button', className: 'stwd-btn stwd-btn-primary', disabled: !dirty || saving, onClick: () => void save() }, saving ? text.saving : text.save),
        ),
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
        '.stwd-spinner{width:12px;height:12px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);animation:stwd-spin .8s linear infinite;display:inline-block}',
        '@keyframes stwd-spin{to{transform:rotate(360deg)}}',
        '.stwd-error-box{display:flex;flex-direction:column;gap:8px;padding:16px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
        '.stwd-error-title{font-weight:600}', '.stwd-error-detail{color:var(--dsw-alias-state-error-primary);font-size:12px}',
      ].join('\n'));
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const render = (slotProps) => {
          if (slotProps && slotProps.view === 'summary') return 'Steward · 子代理模型 / subagent models';
          return h(StewardPage, { lang: pickLang(ctx), view: slotProps ? slotProps.view : undefined });
        };
        const register = (slotName, options) => {
          try {
            ctx.slots.inject(slotName, () => ctx.slots.register({ name: slotName, ...options }, render));
          } catch {
            // The optional Plugin Manager seats are absent in some shells; the Settings page still works.
          }
        };
        register('settings.section', { id: 'steward', order: 50, label: () => (STRINGS[pickLang(ctx)] || STRINGS.zh).nav });
        register('plugins.bundle.config', { key: 'dsh-steward' });
        register('plugins.row.config', { key: 'dsh-steward#steward' });
      },
    };
  },
});
