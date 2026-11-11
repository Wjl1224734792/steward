/* Steward · 子代理模型与思考强度 —— 页面逻辑
 * 纯原生 ES2019 级别语法，无构建、无依赖。
 * 所有请求走同源相对路径（Mini App 与本地独立页共用同一份资产）。
 */
(function () {
  'use strict';

  // 角色顺序固定，避免后端顺序变化导致跳动
  var ROLE_ORDER = ['pm', 'architect', 'backend-dev', 'frontend-dev', 'qa-engineer', 'browser-tester', 'reviewer'];

  var STATE = {
    loading: false,
    saving: false,
    /** 最近一次 GET /api/state 的原始数据 */
    data: null,
    /** 用户改过的角色草稿：{ role: { model, effort, fallback } } */
    drafts: Object.create(null)
  };

  var el = {};

  // ---------- 工具 ----------

  function $(id) {
    return document.getElementById(id);
  }

  function create(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }

  /** 显式维护 option 的 value（不依赖浏览器对 select.value 的回写） */
  function setOptionValue(option, value) {
    option.value = value;
    option.setAttribute('value', value);
  }

  function selectedValue(select) {
    if (select.selectedOptions && select.selectedOptions.length) {
      return select.selectedOptions[0].value;
    }
    var opts = select.options || [];
    for (var i = 0; i < opts.length; i += 1) {
      if (opts[i].selected) { return opts[i].value; }
    }
    return select.value;
  }

  function roleLabel(role) {
    var list = (STATE.data && STATE.data.roles) || [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].role === role && list[i].displayName) { return list[i].displayName; }
    }
    return role;
  }

  function models() {
    var cat = STATE.data && STATE.data.catalog;
    return cat && Array.isArray(cat.models) ? cat.models : [];
  }

  function findModel(modelKey) {
    if (!modelKey) { return null; }
    var list = models();
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].key === modelKey) { return list[i]; }
    }
    return null;
  }

  function modelLabel(modelKey) {
    var m = findModel(modelKey);
    if (!m) { return modelKey || ''; }
    return (m.providerLabel || m.provider || '') + ' · ' + (m.displayName || m.model);
  }

  /** 该模型可用的档位；catalog 不可用时返回空数组（降级为「跟随模型默认」） */
  function effortOptionsOf(modelKey) {
    var cat = STATE.data && STATE.data.catalog;
    if (!cat || cat.ok === false) { return []; }
    var m = findModel(modelKey);
    if (!m || !Array.isArray(m.effortOptions)) { return []; }
    return m.effortOptions.slice();
  }

  function isNonStandard(modelKey, effort) {
    var m = findModel(modelKey);
    if (!m || !Array.isArray(m.nonStandardEfforts)) { return false; }
    return m.nonStandardEfforts.indexOf(effort) !== -1;
  }

  function effortText(modelKey, effort) {
    if (effort === null || effort === undefined || effort === '') { return '（跟随模型默认）'; }
    return isNonStandard(modelKey, effort) ? effort + '（非标准档位名）' : effort;
  }

  function findRole(role) {
    var list = (STATE.data && STATE.data.roles) || [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].role === role) { return list[i]; }
    }
    return null;
  }

  /** 角色的当前值：有草稿用草稿，否则用后端返回值 */
  function currentValue(role) {
    if (STATE.drafts[role]) { return STATE.drafts[role]; }
    var r = findRole(role);
    return {
      model: r ? r.model : null,
      effort: r ? r.effort : null,
      fallback: r && r.fallback ? { model: r.fallback.model, effort: r.fallback.effort } : null
    };
  }

  function sameValue(a, b) {
    var am = a && a.model ? a.model : null;
    var bm = b && b.model ? b.model : null;
    var ae = a && a.effort !== undefined && a.effort !== null && a.effort !== '' ? a.effort : null;
    var be = b && b.effort !== undefined && b.effort !== null && b.effort !== '' ? b.effort : null;
    return am === bm && ae === be;
  }

  function isDirty(role) {
    if (!STATE.drafts[role]) { return false; }
    var r = findRole(role);
    var base = {
      model: r ? r.model : null,
      effort: r ? r.effort : null,
      fallback: r && r.fallback ? { model: r.fallback.model, effort: r.fallback.effort } : null
    };
    return !sameValue(STATE.drafts[role], base);
  }

  function dirtyRoles() {
    return ROLE_ORDER.filter(isDirty);
  }

  // ---------- 告警 ----------

  function clearAlerts() {
    el.alerts.textContent = '';
  }

  function addAlert(kind, title, message, options) {
    var box = create('div', 'alert alert-' + (kind || 'info'));
    box.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    var text = create('div', 'alert-text');
    if (title) { text.appendChild(create('span', 'alert-title', title)); }
    text.appendChild(create('span', null, message || ''));
    box.appendChild(text);

    var closable = !options || options.closable !== false;
    if (closable) {
      var btn = create('button', 'alert-close', '关闭');
      btn.type = 'button';
      btn.setAttribute('aria-label', '关闭提示');
      btn.addEventListener('click', function () {
        box.textContent = '';
        box.className = 'alert alert-' + (kind || 'info') + ' alert-collapsed';
        box.removeAttribute('role');
        box.appendChild(create('span', 'alert-text', '（已隐藏提示）' + (title ? title + '：' : '') + (message || '')));
      });
      box.appendChild(btn);
    }
    el.alerts.appendChild(box);
    return box;
  }

  function renderAlerts() {
    clearAlerts();
    var data = STATE.data;
    if (!data) { return; }
    var cat = data.catalog || {};

    if (cat.ok === false) {
      addAlert('error', '模型目录不可用', '思考强度已降级为「跟随模型默认」。原因：' + (cat.warning || '未说明'));
    } else if (cat.warning) {
      addAlert('warn', '模型目录告警', cat.warning);
    }

    if (data.project && data.project.exists === false) {
      addAlert('info', '项目级配置尚未创建', '项目根：' + (data.project.root || '未知') + '；保存「只写项目级」时将创建 steward.config.json。');
    }

    if (data.repo && data.repo.detected === false) {
      addAlert('warn', '未找到 Steward 源码仓库', '「只写插件默认」与「两者都写」已禁用；仓库根：' + (data.repo.root || '未知'));
    }
  }

  // ---------- 渲染 ----------

  function renderMeta() {
    var data = STATE.data || {};
    var cat = data.catalog || {};
    var parts = [];
    if (data.project && data.project.root) {
      parts.push('项目：' + data.project.root + (data.project.exists === false ? '（未创建配置）' : ''));
    }
    if (data.repo && data.repo.root) {
      parts.push('仓库：' + data.repo.root + (data.repo.detected === false ? '（未识别）' : ''));
    }
    // 首次读取后回填目标路径输入框；用户改过的不覆盖。
    if (el.projectRootInput && !el.projectRootInput.value && data.project && data.project.root) {
      el.projectRootInput.value = data.project.root;
    }
    if (el.repoRootInput && !el.repoRootInput.value && data.repo && data.repo.root) {
      el.repoRootInput.value = data.repo.root;
    }
    if (data.generatedAt) { parts.push('读取于 ' + data.generatedAt); }
    el.metaLine.textContent = parts.join('　|　') || '';

    var catParts = [];
    if (cat.source) { catParts.push('模型目录：' + cat.source); }
    catParts.push('模型数：' + models().length);
    if (cat.ok === false) { catParts.push('目录不可用，档位降级'); }
    el.catalogMeta.textContent = catParts.join('　|　');
  }

  /** 构建模型下拉（按 providerLabel 分组） */
  function buildModelSelect(select, selectedKey, placeholder) {
    select.textContent = '';
    var list = models();

    if (placeholder) {
      var ph = create('option', null, placeholder);
      setOptionValue(ph, '');
      select.appendChild(ph);
    }

    var groups = [];
    var byLabel = Object.create(null);
    for (var i = 0; i < list.length; i += 1) {
      var m = list[i];
      var label = m.providerLabel || m.provider || '未知提供方';
      if (!byLabel[label]) {
        byLabel[label] = [];
        groups.push({ label: label, items: [] });
      }
      byLabel[label].push(m);
    }
    // 分组按 providerLabel 排序，组内按 displayName 排序，便于查找
    groups.sort(function (a, b) { return a.label.localeCompare(b.label, 'zh-Hans-CN'); });
    for (var g = 0; g < groups.length; g += 1) {
      groups[g].items = byLabel[groups[g].label].slice().sort(function (a, b) {
        return String(a.displayName || a.model).localeCompare(String(b.displayName || b.model), 'en');
      });
    }

    var found = !selectedKey;
    for (var gi = 0; gi < groups.length; gi += 1) {
      var optgroup = document.createElement('optgroup');
      optgroup.label = groups[gi].label;
      var items = groups[gi].items;
      for (var mi = 0; mi < items.length; mi += 1) {
        var item = items[mi];
        var opt = create('option', null, (item.providerLabel || item.provider) + ' · ' + (item.displayName || item.model));
        setOptionValue(opt, item.key);
        if (item.key === selectedKey) { found = true; }
        optgroup.appendChild(opt);
      }
      select.appendChild(optgroup);
    }

    // 后端返回的值不在目录里：保留为单独选项，避免静默丢失
    if (selectedKey && !found) {
      var unknown = create('option', null, selectedKey + '（不在本机模型目录中）');
      setOptionValue(unknown, selectedKey);
      select.appendChild(unknown);
    }
    select.value = selectedKey || '';
    return select;
  }

  /** 构建档位下拉，随模型联动 */
  function buildEffortSelect(select, modelKey, selectedEffort, hasFallbackModel) {
    select.textContent = '';
    var cat = STATE.data && STATE.data.catalog;
    var options = effortOptionsOf(modelKey);
    var degraded = !cat || cat.ok === false;

    if (!modelKey && hasFallbackModel) {
      // fallback 未选模型
      var none = create('option', null, '—');
      setOptionValue(none, '');
      select.appendChild(none);
      select.disabled = true;
      select.title = '请先选择 fallback 模型';
      return select;
    }

    if (degraded) {
      var def = create('option', null, '跟随模型默认');
      setOptionValue(def, '');
      select.appendChild(def);
      select.value = '';
      select.disabled = true;
      select.title = '模型目录不可用，已降级为跟随模型默认';
      return select;
    }

    var m = findModel(modelKey);
    if (options.length === 0) {
      var noneOpt = create('option', null, m && m.supportsEffort === false ? '该模型不支持档位' : '跟随模型默认');
      setOptionValue(noneOpt, '');
      select.appendChild(noneOpt);
      select.value = '';
      select.disabled = true;
      select.title = '该模型不支持档位';
      return select;
    }

    select.disabled = false;
    select.removeAttribute('title');
    var stillValid = false;
    for (var i = 0; i < options.length; i += 1) {
      var eff = options[i];
      var text = isNonStandard(modelKey, eff) ? eff + '（非标准档位名）' : eff;
      var opt = create('option', null, text);
      setOptionValue(opt, eff);
      if (eff === selectedEffort) { stillValid = true; }
      select.appendChild(opt);
    }

    if (selectedEffort && !stillValid) {
      // 当前值不在该模型档位内（例如模型换了）：保留可见但标记，避免静默丢值
      var keep = create('option', null, selectedEffort + '（当前值，不在该模型档位内）');
      setOptionValue(keep, selectedEffort);
      select.appendChild(keep);
      // 按规格：当前值不在新模型集合内 → 回落到该模型第一个档位
      select.value = options[0];
      return select;
    }

    // 没有已选值（未配置 / 新模型）时落到第一个档位，保证控件始终有有效值
    select.value = selectedEffort || options[0];
    return select;
  }

  function sourceBadge(info) {
    var wrap = create('span', 'stack');
    var source = info && info.source;
    if (source === 'project') {
      wrap.appendChild(create('span', 'tag tag-project', '项目级覆盖'));
    } else if (source === 'plugin') {
      wrap.appendChild(create('span', 'tag tag-plugin', '插件默认'));
    } else {
      wrap.appendChild(create('span', 'tag tag-none', '未配置'));
    }
    if (info && info.differsFromPlugin) {
      wrap.appendChild(create('span', 'tag tag-diff', '与插件默认不同'));
    }
    return wrap;
  }

  function statusCell(info, role) {
    var wrap = create('span', 'stack');
    if (isDirty(role)) { wrap.appendChild(create('span', 'tag tag-dirty', '待保存')); }
    var cur = currentValue(role);
    if (cur.model && !findModel(cur.model)) {
      wrap.appendChild(create('span', 'tag tag-warn', '模型不在本机目录'));
    }
    var opts = effortOptionsOf(cur.model);
    if (cur.effort && cur.model && opts.length && opts.indexOf(cur.effort) === -1) {
      wrap.appendChild(create('span', 'tag tag-warn', '档位不在该模型支持范围'));
    }
    if (cur.effort && isNonStandard(cur.model, cur.effort)) {
      wrap.appendChild(create('span', 'tag tag-warn', '非标准档位名'));
    }
    if (!cur.model) {
      wrap.appendChild(create('span', 'tag tag-warn', '未指定模型'));
    }
    if (!wrap.childNodes.length) { wrap.appendChild(create('span', 'hint', '正常')); }
    return wrap;
  }

  function setDraftField(role, key, value, extra) {
    var r = findRole(role);
    if (!STATE.drafts[role]) {
      STATE.drafts[role] = {
        model: r ? r.model : null,
        effort: r ? r.effort : null,
        fallback: r && r.fallback ? { model: r.fallback.model, effort: r.fallback.effort } : null
      };
    }
    if (key === 'fallbackModel') {
      STATE.drafts[role].fallback = value ? { model: value, effort: (extra && extra.effort) || null } : null;
    } else if (key === 'fallbackEffort') {
      if (STATE.drafts[role].fallback) { STATE.drafts[role].fallback.effort = value || null; }
    } else {
      STATE.drafts[role][key] = value;
    }
  }

  function renderRow(info) {
    var role = info.role;
    var cur = currentValue(role);
    var tr = document.createElement('tr');
    tr.setAttribute('data-role', role);

    // 角色
    var tdRole = document.createElement('td');
    tdRole.appendChild(create('span', 'role-name', info.displayName || roleLabel(role)));
    tdRole.appendChild(create('span', 'role-id', role));
    tr.appendChild(tdRole);

    // 模型
    var tdModel = document.createElement('td');
    var modelSelectId = 'model-' + role;
    var modelField = create('div', 'field');
    var modelLabelEl = create('label', 'sr-only', (info.displayName || role) + ' 模型');
    modelLabelEl.setAttribute('for', modelSelectId);
    var modelSelect = document.createElement('select');
    modelSelect.id = modelSelectId;
    if (models().length === 0) {
      var emptyOpt = create('option', null, '（模型目录不可用）');
      emptyOpt.value = '';
      modelSelect.appendChild(emptyOpt);
      modelSelect.disabled = true;
    } else {
      buildModelSelect(modelSelect, cur.model, '（未指定模型）');
    }
    modelField.appendChild(modelLabelEl);
    modelField.appendChild(modelSelect);
    if (cur.model) {
      modelField.appendChild(create('span', 'field-sub', modelLabel(cur.model)));
    }
    tdModel.appendChild(modelField);
    tr.appendChild(tdModel);

    // 思考强度
    var tdEffort = document.createElement('td');
    var effortSelectId = 'effort-' + role;
    var effortField = create('div', 'field');
    var effortLabelEl = create('label', 'sr-only', (info.displayName || role) + ' 思考强度');
    effortLabelEl.setAttribute('for', effortSelectId);
    var effortSelect = document.createElement('select');
    effortSelect.id = effortSelectId;
    buildEffortSelect(effortSelect, cur.model, cur.effort, false);
    effortField.appendChild(effortLabelEl);
    effortField.appendChild(effortSelect);
    tdEffort.appendChild(effortField);
    tr.appendChild(tdEffort);

    // fallback
    var tdFb = document.createElement('td');
    var fbField = create('div', 'field');
    var fbModelId = 'fb-model-' + role;
    var fbEffortId = 'fb-effort-' + role;
    var fbModelLabel = create('label', 'sr-only', (info.displayName || role) + ' fallback 模型');
    fbModelLabel.setAttribute('for', fbModelId);
    var fbModelSelect = document.createElement('select');
    fbModelSelect.id = fbModelId;
    if (models().length === 0) {
      var fbEmpty = create('option', null, '（模型目录不可用）');
      fbEmpty.value = '';
      fbModelSelect.appendChild(fbEmpty);
      fbModelSelect.disabled = true;
    } else {
      buildModelSelect(fbModelSelect, cur.fallback ? cur.fallback.model : '', '（不设 fallback）');
    }
    var fbEffortLabel = create('label', 'sr-only', (info.displayName || role) + ' fallback 思考强度');
    fbEffortLabel.setAttribute('for', fbEffortId);
    var fbEffortSelect = document.createElement('select');
    fbEffortSelect.id = fbEffortId;
    buildEffortSelect(fbEffortSelect, cur.fallback ? cur.fallback.model : '', cur.fallback ? cur.fallback.effort : '', true);

    fbField.appendChild(fbModelLabel);
    fbField.appendChild(fbModelSelect);
    fbField.appendChild(fbEffortLabel);
    fbField.appendChild(fbEffortSelect);
    tdFb.appendChild(fbField);
    tr.appendChild(tdFb);

    // 来源
    var tdSource = document.createElement('td');
    tdSource.appendChild(sourceBadge(info));
    tr.appendChild(tdSource);

    // 状态
    var tdStatus = document.createElement('td');
    tdStatus.className = 'js-status';
    tdStatus.appendChild(statusCell(info, role));
    tr.appendChild(tdStatus);

    // ---- 事件：模型变更 → 档位联动 ----
    modelSelect.addEventListener('change', function () {
      var newModel = selectedValue(modelSelect);
      var opts = effortOptionsOf(newModel);
      var prevEffort = currentValue(role).effort;
      var nextEffort = prevEffort;
      var notice = '';
      if (!opts.length) {
        nextEffort = null;
      } else if (!prevEffort || opts.indexOf(prevEffort) === -1) {
        nextEffort = opts[0];
        notice = '已重置档位为 ' + nextEffort;
      }
      setDraftField(role, 'model', newModel || null);
      setDraftField(role, 'effort', nextEffort);
      render();
      if (notice && role) {
        el.saveState.textContent = (info.displayName || role) + '：' + notice;
        el.saveState.className = 'save-state';
      }
    });

    effortSelect.addEventListener('change', function () {
      setDraftField(role, 'effort', selectedValue(effortSelect) || null);
      render();
    });

    fbModelSelect.addEventListener('change', function () {
      var newModel = selectedValue(fbModelSelect);
      if (!newModel) {
        setDraftField(role, 'fallbackModel', null);
      } else {
        var opts = effortOptionsOf(newModel);
        var prev = currentValue(role).fallback;
        var nextEffort = null;
        if (opts.length) {
          nextEffort = prev && prev.effort && opts.indexOf(prev.effort) !== -1 ? prev.effort : opts[0];
        }
        setDraftField(role, 'fallbackModel', newModel, { effort: nextEffort });
      }
      render();
    });

    fbEffortSelect.addEventListener('change', function () {
      setDraftField(role, 'fallbackEffort', selectedValue(fbEffortSelect) || null);
      render();
    });

    return tr;
  }

  function renderRoles() {
    el.rolesBody.textContent = '';
    var list = (STATE.data && STATE.data.roles) || [];
    var byRole = Object.create(null);
    for (var i = 0; i < list.length; i += 1) { byRole[list[i].role] = list[i]; }

    // 先按固定顺序输出已知角色，再补后端多出来的角色
    for (var j = 0; j < ROLE_ORDER.length; j += 1) {
      var role = ROLE_ORDER[j];
      var info = byRole[role] || { role: role, displayName: role, model: null, effort: null, fallback: null, source: 'none', differsFromPlugin: false };
      el.rolesBody.appendChild(renderRow(info));
    }
    for (var k = 0; k < list.length; k += 1) {
      if (ROLE_ORDER.indexOf(list[k].role) === -1) {
        el.rolesBody.appendChild(renderRow(list[k]));
      }
    }
  }

  /** 目标路径输入框的值（用户可改；留空表示沿用后端探测值） */
  function projectRootValue() {
    return el.projectRootInput ? el.projectRootInput.value.trim() : '';
  }

  function repoRootValue() {
    return el.repoRootInput ? el.repoRootInput.value.trim() : '';
  }

  function renderScope() {
    var repo = STATE.data && STATE.data.repo;
    // 用户手填了仓库路径就允许写插件默认（由后端校验路径合法性）；否则看后端探测结果。
    var repoMissing = !repoRootValue() && (!repo || repo.detected === false);
    var radios = el.scopeGroup.querySelectorAll('input[name="scope"]');
    for (var i = 0; i < radios.length; i += 1) {
      var needsRepo = radios[i].value === 'plugin' || radios[i].value === 'both';
      radios[i].disabled = needsRepo && repoMissing;
      var wrapper = radios[i].closest('.radio');
      if (wrapper) { wrapper.classList.toggle('is-disabled', radios[i].disabled); }
      if (radios[i].disabled && radios[i].checked) {
        // 当前选中被禁用 → 回落到「只写项目级」
        var fallbackRadio = document.querySelector('input[name="scope"][value="project"]');
        if (fallbackRadio) { fallbackRadio.checked = true; }
      }
    }
    if (repoMissing) {
      el.scopeBlocked.hidden = false;
      el.scopeBlocked.textContent = '未找到 Steward 源码仓库，已禁用「只写插件默认」与「两者都写」。' +
        (repo && repo.root ? '仓库根：' + repo.root : '');
    } else {
      el.scopeBlocked.hidden = true;
      el.scopeBlocked.textContent = '';
    }
  }

  function getScope() {
    var radios = el.scopeGroup.querySelectorAll('input[name="scope"]');
    for (var i = 0; i < radios.length; i += 1) {
      if (radios[i].checked && !radios[i].disabled) { return radios[i].value; }
    }
    var checked = el.scopeGroup.querySelector('input[name="scope"]:checked');
    return checked && !checked.disabled ? checked.value : 'project';
  }

  function render() {
    renderMeta();
    renderAlerts();
    renderRoles();
    renderScope();
    updateSaveButton();
  }

  function updateSaveButton() {
    var dirty = dirtyRoles();
    // 没有改动时直接禁用，避免误点后拿到空提交的服务端报错
    el.saveBtn.disabled = STATE.saving || STATE.loading || dirty.length === 0;
    el.saveBtn.title = dirty.length === 0 ? '没有改动需要保存' : '';
    if (STATE.saving) {
      el.saveBtn.textContent = '保存中…';
    } else if (dirty.length) {
      el.saveBtn.textContent = '保存（' + dirty.length + ' 项改动）';
    } else {
      el.saveBtn.textContent = '保存';
    }
  }

  // ---------- 网络 ----------

  function fetchJson(url, options) {
    return fetch(url, options || {}).then(function (res) {
      return res.text().then(function (text) {
        var body = null;
        try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
        return { status: res.status, ok: res.ok, text: text, body: body };
      });
    });
  }

  function showFatal(title, message, raw) {
    el.main.hidden = true;
    el.loadingBox.hidden = true;
    el.fatalBox.hidden = false;
    el.fatalTitle.textContent = title;
    el.fatalMessage.textContent = message;
    if (raw) {
      el.fatalRaw.hidden = false;
      el.fatalRaw.textContent = raw;
    } else {
      el.fatalRaw.hidden = true;
      el.fatalRaw.textContent = '';
    }
    el.metaLine.textContent = '读取失败';
  }

  function loadState() {
    STATE.loading = true;
    el.fatalBox.hidden = true;
    el.loadingBox.hidden = false;
    el.main.hidden = true;
    updateSaveButton();

    fetchJson('/api/state', { method: 'GET', headers: { Accept: 'application/json' } })
      .then(function (res) {
        STATE.loading = false;
        el.loadingBox.hidden = true;
        if (!res.ok || !res.body || res.body.ok !== true) {
          var msg = res.body && Array.isArray(res.body.errors) && res.body.errors.length
            ? res.body.errors.join('；')
            : 'GET /api/state 返回 HTTP ' + res.status;
          showFatal('无法读取后端状态', msg, res.text);
          return;
        }
        STATE.data = res.body;
        STATE.drafts = Object.create(null);
        el.main.hidden = false;
        render();
      })
      .catch(function (err) {
        STATE.loading = false;
        el.loadingBox.hidden = true;
        showFatal(
          '无法连接本地服务',
          '请求 /api/state 失败：' + (err && err.message ? err.message : String(err)),
          null
        );
        updateSaveButton();
      });
  }

  function buildPayload() {
    var dirty = dirtyRoles();
    var assignments = {};
    for (var i = 0; i < dirty.length; i += 1) {
      var role = dirty[i];
      var cur = STATE.drafts[role];
      var item = { model: cur.model };
      // effort 只在模型支持档位且已选时提交（model 不支持档位时契约要求不传）
      var opts = effortOptionsOf(cur.model);
      if (cur.effort && opts.length > 0) {
        item.effort = cur.effort;
      }
      if (cur.fallback && cur.fallback.model) {
        var fb = { model: cur.fallback.model };
        var fbOpts = effortOptionsOf(cur.fallback.model);
        if (cur.fallback.effort && fbOpts.length > 0) { fb.effort = cur.fallback.effort; }
        item.fallback = fb;
      } else {
        item.fallback = null;
      }
      assignments[role] = item;
    }
    var project = STATE.data.project || {};
    var repo = STATE.data.repo || {};
    return {
      scope: getScope(),
      projectRoot: projectRootValue() || project.root || null,
      repoRoot: repoRootValue() || repo.root || null,
      assignments: assignments
    };
  }

  function renderResult(res) {
    el.resultCard.hidden = false;
    el.resultBody.textContent = '';
    var ok = !!(res.body && res.body.ok === true);

    el.resultTitle.textContent = ok ? '保存成功' : '保存失败';
    el.resultTitle.className = ok ? 'badge-ok' : 'badge-err';

    var body = res.body || {};

    // written
    var secWritten = create('div', 'result-section');
    secWritten.appendChild(create('h3', null, '已写入（written）'));
    if (Array.isArray(body.written) && body.written.length) {
      var ul = document.createElement('ul');
      for (var i = 0; i < body.written.length; i += 1) {
        var w = body.written[i];
        var li = document.createElement('li');
        li.textContent = '[' + (w.scope || '?') + '] ' + (w.role || '?') + ' → ' + (w.target || '?') +
          (w.message ? '：' + w.message : '');
        ul.appendChild(li);
      }
      secWritten.appendChild(ul);
    } else {
      secWritten.appendChild(create('p', 'hint', '无'));
    }
    el.resultBody.appendChild(secWritten);

    // errors
    var errs = Array.isArray(body.errors) ? body.errors : [];
    var secErr = create('div', 'result-section');
    secErr.appendChild(create('h3', null, '错误（errors）'));
    if (errs.length) {
      var ulErr = document.createElement('ul');
      ulErr.className = 'badge-err';
      for (var e = 0; e < errs.length; e += 1) {
        ulErr.appendChild(create('li', null, String(errs[e])));
      }
      secErr.appendChild(ulErr);
      secErr.appendChild(create('p', 'hint', '后端已自动回滚，未落盘。'));
    } else if (ok) {
      secErr.appendChild(create('p', 'hint', '无'));
    } else {
      secErr.appendChild(create('p', 'badge-err', 'HTTP ' + res.status + (res.text ? '：' + res.text : '')));
    }
    el.resultBody.appendChild(secErr);

    // warnings
    var warns = Array.isArray(body.warnings) ? body.warnings : [];
    if (warns.length) {
      var secWarn = create('div', 'result-section');
      secWarn.appendChild(create('h3', null, '告警（warnings）'));
      var ulWarn = document.createElement('ul');
      for (var wi = 0; wi < warns.length; wi += 1) {
        ulWarn.appendChild(create('li', null, String(warns[wi])));
      }
      secWarn.appendChild(ulWarn);
      el.resultBody.appendChild(secWarn);
    }

    // validation：原样 <pre>
    var validation = body.validation || {};
    var keys = Object.keys(validation);
    var secVal = create('div', 'result-section');
    secVal.appendChild(create('h3', null, '校验（validation，原始输出）'));
    if (!keys.length) {
      secVal.appendChild(create('p', 'hint', '本次未执行校验'));
    } else {
      for (var ki = 0; ki < keys.length; ki += 1) {
        var scopeKey = keys[ki];
        var v = validation[scopeKey] || {};
        var line = create('p');
        line.appendChild(create('strong', null, scopeKey + '：'));
        line.appendChild(document.createTextNode(' exitCode = '));
        line.appendChild(create('strong', (v.exitCode === 0 ? 'badge-ok' : 'badge-err'), String(v.exitCode)));
        secVal.appendChild(line);
        if (v.command) {
          secVal.appendChild(create('p', 'hint', '命令：' + v.command));
        }
        var pre = create('pre', 'raw', v.output !== undefined && v.output !== null ? String(v.output) : '（无输出）');
        secVal.appendChild(pre);
      }
    }
    el.resultBody.appendChild(secVal);
  }

  function save() {
    var dirty = dirtyRoles();
    if (!dirty.length) {
      el.saveState.textContent = '没有改动需要保存';
      el.saveState.className = 'save-state';
      return;
    }
    var payload = buildPayload();
    STATE.saving = true;
    el.saveState.textContent = '保存中…';
    el.saveState.className = 'save-state';
    updateSaveButton();
    el.saveBtn.textContent = '保存中…';

    fetchJson('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        STATE.saving = false;
        renderResult(res);
        var ok = !!(res.body && res.body.ok === true);
        if (ok) {
          el.saveState.textContent = '已保存';
          el.saveState.className = 'save-state is-ok';
          loadState();
        } else {
          el.saveState.textContent = '保存失败，见下方结果';
          el.saveState.className = 'save-state is-err';
          updateSaveButton();
        }
        el.resultCard.scrollIntoView({ block: 'nearest' });
      })
      .catch(function (err) {
        STATE.saving = false;
        el.saveState.textContent = '保存请求失败：' + (err && err.message ? err.message : String(err));
        el.saveState.className = 'save-state is-err';
        renderResult({ status: 0, ok: false, text: String(err && err.message ? err.message : err), body: null });
        updateSaveButton();
      });
  }

  // ---------- 启动 ----------

  function init() {
    el.metaLine = $('meta-line');
    el.alerts = $('alerts');
    el.loadingBox = $('loading-box');
    el.fatalBox = $('fatal-box');
    el.fatalTitle = $('fatal-title');
    el.fatalMessage = $('fatal-message');
    el.fatalRaw = $('fatal-raw');
    el.main = $('main');
    el.rolesBody = $('roles-body');
    el.catalogMeta = $('catalog-meta');
    el.scopeGroup = $('scope-group');
    el.scopeBlocked = $('scope-blocked');
    el.projectRootInput = $('project-root-input');
    el.repoRootInput = $('repo-root-input');
    el.saveBtn = $('save-btn');
    el.saveState = $('save-state');
    el.resultCard = $('result-card');
    el.resultTitle = $('result-title');
    el.resultBody = $('result-body');

    el.saveBtn.addEventListener('click', save);
    $('reload-btn').addEventListener('click', loadState);
    $('retry-btn').addEventListener('click', loadState);
    el.scopeGroup.addEventListener('change', function () {
      el.saveState.textContent = '';
      el.saveState.className = 'save-state';
    });
    el.repoRootInput.addEventListener('input', function () {
      renderScope();
      updateSaveButton();
    });

    loadState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
