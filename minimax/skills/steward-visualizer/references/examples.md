# Steward Visualizer 示例

三个配方各一个完整示例。示例数据是**代表性的研发团队产物**（虚构仓库与文件），不含任何真实凭据、绝对路径或生产密钥。实际使用时把 `<mavis-data>` 换成从 `03-plan.md` / `reports/*.md` / `HEALTH.md` 解析出的同构数据。

---

## 示例 A：任务 DAG 与并行批次视图（配方 A，kind="diagram"）

对应数据集：`dag`。

```text
<mavis-widget
  version="mavis.widget.v1"
  kind="diagram"
  title="任务 DAG 与并行批次"
  height="560"
  min-height="380"
  max-height="900"
  streaming="html-first"
  capabilities="resize,sendPrompt"
  theme="app"
  token-set="mavis.semantic.v1">
  <mavis-meta type="json">{"summary":"5 个任务的依赖链共 3 个批次，其中第 2 批存在文件所有权冲突无法并行。","dataSource":"Steward 工件 03-plan.md 的任务表（DAG）节","chartType":"table","datasetShape":{"rows":6,"dimensions":["taskId","owner","batch","status"],"measures":["fileCount"]},"interactions":[{"id":"expand-task","label":"展开派单","capability":"sendPrompt"},{"id":"resolve-conflict","label":"重新规划冲突批次","capability":"sendPrompt"}]}</mavis-meta>
  <mavis-style>
body{margin:0;padding:16px;background:var(--mw-bg);color:var(--mw-text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;}
.kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px;}
.kpi{background:var(--mw-surface);border:1px solid var(--mw-border);border-radius:10px;padding:12px 14px;}
.kpi-label{font-size:12px;color:var(--mw-text-muted);}
.kpi-value{font-size:24px;font-weight:700;color:var(--mw-text);margin-top:2px;}
.kpi-note{font-size:12px;color:var(--mw-text-muted);margin-top:2px;}
.kpi-note.danger{color:var(--mw-danger);}
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:var(--mw-text-muted);margin-bottom:12px;}
.legend-item{display:flex;align-items:center;gap:6px;}
.dot{width:10px;height:10px;border-radius:3px;flex:0 0 auto;}
.lanes{display:flex;gap:12px;align-items:flex-start;overflow-x:auto;padding-bottom:4px;}
.lane{flex:0 0 236px;background:var(--mw-surface-muted);border:1px solid var(--mw-border);border-radius:10px;padding:10px;}
.lane-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px;cursor:pointer;}
.lane-title{font-size:13px;font-weight:500;color:var(--mw-text);}
.lane-count{font-size:12px;color:var(--mw-text-muted);}
.card{background:var(--mw-surface);border:1px solid var(--mw-border);border-radius:8px;padding:10px;margin-bottom:8px;cursor:pointer;}
.card:hover{background:var(--mw-surface-muted);}
.card:focus-visible{outline:2px solid var(--mw-accent);outline-offset:-2px;}
.card.sel{outline:2px solid var(--mw-accent);outline-offset:-2px;}
.card.conflict{border-color:var(--mw-danger);}
.card.dim{opacity:0.45;}
.card-top{display:flex;align-items:center;gap:6px;}
.card-id{font-size:12px;font-weight:500;color:var(--mw-text);}
.card-badge{margin-left:auto;font-size:12px;color:var(--mw-text-muted);}
.card-title{font-size:12px;color:var(--mw-text);margin-top:4px;}
.card-meta{font-size:12px;color:var(--mw-text-subtle);margin-top:4px;}
.conflict-flag{display:inline-block;margin-top:6px;padding:0 6px;border:1px solid var(--mw-danger);color:var(--mw-danger);border-radius:6px;font-size:12px;}
.detail{margin-top:14px;background:var(--mw-surface);border:1px solid var(--mw-border);border-radius:10px;padding:14px;}
.detail-title{font-size:14px;font-weight:500;color:var(--mw-text);margin:0 0 8px;}
.kv{display:grid;grid-template-columns:84px 1fr;gap:4px 12px;font-size:12px;margin:0;}
.kv dt{color:var(--mw-text-muted);}
.kv dd{margin:0;color:var(--mw-text);}
.files{margin:6px 0 0;padding-left:18px;font-size:12px;color:var(--mw-text);font-family:'JetBrains Mono',monospace;}
.hint{font-size:12px;color:var(--mw-text-subtle);}
.act{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}
.btn{font:inherit;font-size:12px;padding:6px 12px;border-radius:8px;border:1px solid var(--mw-border);background:var(--mw-surface);color:var(--mw-text);cursor:pointer;}
.btn:hover{background:var(--mw-surface-muted);}
.btn:focus-visible{outline:2px solid var(--mw-accent);outline-offset:2px;}
.btn.primary{background:var(--mw-accent);border-color:var(--mw-accent);color:var(--mw-bg);}
.btn[disabled]{opacity:0.5;cursor:not-allowed;}
.empty{font-size:12px;color:var(--mw-text-subtle);margin:6px 0 0;}
.skeleton{background:var(--mw-surface-muted);border-radius:8px;height:64px;margin-bottom:8px;}
  </mavis-style>
  <mavis-html>
<div class="kpi-row">
  <div class="kpi"><div class="kpi-label">任务总数</div><div class="kpi-value" id="kpi-total">--</div><div class="kpi-note" id="kpi-total-note">解析任务表</div></div>
  <div class="kpi"><div class="kpi-label">最长依赖链</div><div class="kpi-value" id="kpi-depth">--</div><div class="kpi-note">层</div></div>
  <div class="kpi"><div class="kpi-label">可并行批次</div><div class="kpi-value" id="kpi-batch">--</div><div class="kpi-note" id="kpi-conflict">检查文件所有权</div></div>
</div>
<div class="legend" id="owner-legend"></div>
<div class="lanes" id="lanes">
  <div class="lane"><div class="lane-head"><span class="lane-title">第 1 批</span><span class="lane-count">--</span></div><div class="skeleton"></div><div class="skeleton"></div></div>
  <div class="lane"><div class="lane-head"><span class="lane-title">第 2 批</span><span class="lane-count">--</span></div><div class="skeleton"></div></div>
  <div class="lane"><div class="lane-head"><span class="lane-title">第 3 批</span><span class="lane-count">--</span></div><div class="skeleton"></div></div>
</div>
<div class="detail" id="detail">
  <div class="detail-title">任务详情</div>
  <p class="hint">点击任一任务卡查看文件所有权与完成标准。</p>
</div>
<div class="act">
  <button class="btn" id="conflict-btn" data-action="resolve-conflict" disabled>重新规划冲突批次</button>
</div>
  </mavis-html>
  <mavis-data name="dag" type="json">
{"runId":"1028-1530-demo","level":"L","tasks":[{"id":"T1","title":"登录接口与会话签发","owner":"backend-dev","deps":[],"files":["src/modules/auth/session.ts","src/modules/auth/session.test.ts"],"criteria":"会话签发与校验的单元测试通过","status":"done"},{"id":"T2","title":"登录页表单与三语文案","owner":"frontend-dev","deps":["T1"],"files":["src/pages/login/LoginForm.tsx","src/i18n/login.ts","src/router/index.ts"],"criteria":"登录页渲染成功且三语词条齐全","status":"running"},{"id":"T3","title":"验证码发送限流","owner":"backend-dev","deps":[],"files":["src/modules/auth/captcha.ts","src/modules/auth/captcha.test.ts"],"criteria":"同一账号 60 秒内仅可发送一次验证码","status":"done"},{"id":"T4","title":"验证码输入态与禁用态","owner":"frontend-dev","deps":["T3"],"files":["src/pages/login/CaptchaInput.tsx"],"criteria":"验证码输入态渲染并具备禁用态","status":"pending"},{"id":"T5","title":"密码重置页","owner":"frontend-dev","deps":["T1"],"files":["src/pages/reset/ResetForm.tsx","src/router/index.ts"],"criteria":"重置页渲染成功且提交后给出结果提示","status":"pending"},{"id":"T6","title":"登录守卫接入","owner":"frontend-dev","deps":["T2","T5"],"files":["src/router/guard.ts"],"criteria":"未登录访问受保护路由跳转登录页","status":"pending"}],"batches":[{"index":1,"taskIds":["T1","T3"]},{"index":2,"taskIds":["T2","T4","T5"]},{"index":3,"taskIds":["T6"]}],"conflicts":[{"a":"T2","b":"T5","files":["src/router/index.ts"]}]}
  </mavis-data>
  <mavis-script>
(function () {
  var OWNERS = ['backend-dev', 'frontend-dev', 'qa-engineer', 'architect', 'pm'];
  var OWNER_LABEL = { 'backend-dev': '后端', 'frontend-dev': '前端', 'qa-engineer': '测试', 'architect': '架构', 'pm': '需求' };
  var STATUS_LABEL = { pending: '待派发', running: '进行中', done: '已完成', blocked: '阻塞' };
  var data = (window.__mavisData || {})['dag'];
  var el = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function clip(s, n) {
    s = String(s === null || s === undefined ? '' : s);
    return s.length > n ? s.slice(0, n) + '…' : s;
  }
  function ownerColor(owner) {
    var i = OWNERS.indexOf(owner);
    if (i < 0) i = 0;
    return 'var(--mw-chart-' + ((i % 6) + 1) + ')';
  }

  var tasks = (data && data.tasks) || [];
  if (!tasks.length) {
    el('lanes').innerHTML = '<p class="empty">尚未产出 03-plan.md 任务表，无法渲染任务 DAG。</p>';
    el('kpi-total').textContent = '0';
    el('kpi-depth').textContent = '0';
    el('kpi-batch').textContent = '0';
    el('kpi-conflict').textContent = '无任务可比对';
    el('kpi-conflict').className = 'kpi-note';
    return;
  }

  var byId = {};
  tasks.forEach(function (t) { byId[t.id] = t; });

  var depth = {};
  function getDepth(id, seen) {
    if (depth[id] !== undefined) return depth[id];
    seen = seen || {};
    if (seen[id]) return 0;
    seen[id] = true;
    var t = byId[id];
    var deps = (t && t.deps) || [];
    var d = 0;
    deps.forEach(function (dep) { if (byId[dep]) d = Math.max(d, getDepth(dep, seen) + 1); });
    depth[id] = d;
    return d;
  }
  tasks.forEach(function (t) { getDepth(t.id); });

  var maxDepth = 0;
  tasks.forEach(function (t) { maxDepth = Math.max(maxDepth, depth[t.id] || 0); });

  var batches = (data.batches && data.batches.length) ? data.batches : (function () {
    var groups = {};
    tasks.forEach(function (t) {
      var d = depth[t.id] || 0;
      (groups[d] = groups[d] || []).push(t.id);
    });
    return Object.keys(groups).sort(function (a, b) { return a - b; }).map(function (d) {
      return { index: Number(d) + 1, taskIds: groups[d] };
    });
  })();

  var conflicts = (data.conflicts && data.conflicts.length) ? data.conflicts : (function () {
    var out = [];
    for (var i = 0; i < tasks.length; i++) {
      for (var j = i + 1; j < tasks.length; j++) {
        var fa = tasks[i].files || [], fb = tasks[j].files || [];
        var shared = fa.filter(function (f) { return fb.indexOf(f) >= 0; });
        if (shared.length) out.push({ a: tasks[i].id, b: tasks[j].id, files: shared });
      }
    }
    return out;
  })();

  var conflictOf = {};
  conflicts.forEach(function (c) {
    conflictOf[c.a] = conflictOf[c.a] || []; conflictOf[c.a].push(c);
    conflictOf[c.b] = conflictOf[c.b] || []; conflictOf[c.b].push(c);
  });

  el('kpi-total').textContent = String(tasks.length);
  el('kpi-total-note').textContent = '来自 03-plan.md 任务表';
  el('kpi-depth').textContent = String(maxDepth);
  el('kpi-batch').textContent = String(batches.length);
  if (conflicts.length) {
    el('kpi-conflict').textContent = conflicts.length + ' 处文件所有权冲突';
    el('kpi-conflict').className = 'kpi-note danger';
    el('conflict-btn').disabled = false;
  } else {
    el('kpi-conflict').textContent = '无文件所有权冲突';
  }

  var usedOwners = [];
  tasks.forEach(function (t) { if (usedOwners.indexOf(t.owner) < 0) usedOwners.push(t.owner); });
  el('owner-legend').innerHTML = usedOwners.map(function (o) {
    return '<span class="legend-item"><span class="dot" style="background:' + ownerColor(o) + '"></span>' +
      esc(OWNER_LABEL[o] || o) + ' · ' + esc(o) + '</span>';
  }).join('');

  var lanesHtml = batches.map(function (b) {
    var cards = (b.taskIds || []).map(function (id) {
      var t = byId[id];
      if (!t) return '';
      var cf = conflictOf[id] || [];
      var flag = cf.map(function (c) {
        var other = c.a === id ? c.b : c.a;
        return '<span class="conflict-flag">与 ' + esc(other) + ' 争用 ' + (c.files || []).length + ' 个文件</span>';
      }).join('');
      var deps = (t.deps && t.deps.length) ? '依赖 ' + t.deps.join('、') : '无上游';
      return '<div class="card' + (cf.length ? ' conflict' : '') + '" data-task="' + esc(id) + '" tabindex="0" role="button">' +
        '<div class="card-top"><span class="dot" style="background:' + ownerColor(t.owner) + '"></span>' +
        '<span class="card-id">' + esc(t.id) + '</span>' +
        '<span class="card-badge">' + esc(STATUS_LABEL[t.status] || '待派发') + '</span></div>' +
        '<div class="card-title">' + esc(clip(t.title, 16)) + '</div>' +
        '<div class="card-meta">' + esc(deps) + ' · 文件 ' + ((t.files || []).length) + ' 个</div>' + flag + '</div>';
    }).join('');
    return '<div class="lane" data-batch="' + esc(String(b.index)) + '">' +
      '<div class="lane-head" tabindex="0" role="button"><span class="lane-title">第 ' + esc(String(b.index)) + ' 批</span>' +
      '<span class="lane-count">' + ((b.taskIds || []).length) + ' 个任务</span></div>' + cards + '</div>';
  }).join('');
  el('lanes').innerHTML = lanesHtml;

  var selectedId = null;
  function renderDetail(id) {
    var t = byId[id];
    if (!t) return;
    var down = tasks.filter(function (x) { return (x.deps || []).indexOf(id) >= 0; }).map(function (x) { return x.id; });
    var cf = conflictOf[id] || [];
    el('detail').innerHTML = '<div class="detail-title">' + esc(t.id) + ' · ' + esc(clip(t.title, 24)) + '</div>' +
      '<dl class="kv">' +
      '<dt>负责人</dt><dd>' + esc(OWNER_LABEL[t.owner] || '') + '（' + esc(t.owner) + '）</dd>' +
      '<dt>依赖</dt><dd>' + esc((t.deps && t.deps.length) ? t.deps.join('、') : '无上游') + '</dd>' +
      '<dt>下游</dt><dd>' + esc(down.length ? down.join('、') : '无') + '</dd>' +
      '<dt>状态</dt><dd>' + esc(STATUS_LABEL[t.status] || '待派发') + '</dd>' +
      '<dt>完成标准</dt><dd>' + esc(t.criteria || '未登记') + '</dd>' +
      '<dt>文件所有权</dt><dd><ul class="files">' + ((t.files || []).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') || '<li>未登记</li>') + '</ul></dd>' +
      (cf.length ? '<dt>冲突</dt><dd>' + cf.map(function (c) { var o = c.a === id ? c.b : c.a; return '与 ' + esc(o) + ' 争用 ' + esc((c.files || []).join('、')); }).join('；') + '</dd>' : '') +
      '</dl>' +
      '<div class="act"><button class="btn primary" data-action="expand-task" data-task="' + esc(id) + '">展开派单</button></div>';
  }

  el('lanes').addEventListener('click', function (e) {
    var head = e.target.closest ? e.target.closest('.lane-head') : null;
    if (head) {
      var lane = head.parentNode;
      var only = !lane.classList.contains('focused');
      Array.prototype.forEach.call(document.querySelectorAll('.lane'), function (l) { l.classList.remove('focused'); });
      var cards = document.querySelectorAll('.card');
      Array.prototype.forEach.call(cards, function (c) {
        c.classList.toggle('dim', only && c.parentNode !== lane);
      });
      return;
    }
    var card = e.target.closest ? e.target.closest('.card') : null;
    if (!card) return;
    selectedId = card.getAttribute('data-task');
    Array.prototype.forEach.call(document.querySelectorAll('.card'), function (c) { c.classList.toggle('sel', c === card); });
    renderDetail(selectedId);
  });

  el('lanes').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var card = e.target.closest ? e.target.closest('.card') : null;
    if (!card) return;
    e.preventDefault();
    card.click();
  });

  el('detail').addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-action="expand-task"]') : null;
    if (!btn) return;
    var id = btn.getAttribute('data-task');
    var t = byId[id];
    if (!t || !window.mavis || !window.mavis.sendPrompt) return;
    window.mavis.sendPrompt(
      '请为任务 ' + id + '（' + t.title + '，负责人 ' + t.owner + '）展开完整派单：文件所有权白名单、依赖上游产物的工件路径，以及可判定的完成标准。',
      {
        widgetTitle: '任务 DAG 与并行批次',
        action: 'expand-task',
        selectedData: {
          taskId: id,
          owner: t.owner,
          title: t.title,
          deps: t.deps || [],
          fileCount: (t.files || []).length,
          status: t.status || 'pending'
        },
        visibleFilters: { runId: (data && data.runId) || null },
        userIntent: '展开指定任务的完整派单'
      }
    );
  });

  el('conflict-btn').addEventListener('click', function () {
    if (!window.mavis || !window.mavis.sendPrompt) return;
    window.mavis.sendPrompt(
      '任务表存在 ' + conflicts.length + ' 处文件所有权冲突，请给出重新规划方案：拆分共享文件还是把冲突任务改为串行依赖，并说明对批次划分的影响。',
      {
        widgetTitle: '任务 DAG 与并行批次',
        action: 'resolve-conflict',
        selectedData: { conflicts: conflicts, batchCount: batches.length, taskCount: tasks.length },
        visibleFilters: { runId: (data && data.runId) || null },
        userIntent: '重新规划存在文件所有权冲突的并行批次'
      }
    );
  });
})();
  </mavis-script>
  <mavis-fallback>
任务 DAG 共 6 个任务、3 个批次，最长依赖链 2 层。第 1 批 T1、T3 无依赖可并行；第 2 批 T2、T4、T5 中 T2 与 T5 同时拥有 src/router/index.ts，存在 1 处文件所有权冲突需拆分或改串行；第 3 批 T6 依赖 T2 与 T5。
  </mavis-fallback>
</mavis-widget>
```

---

## 示例 B：质量门与缺陷回派看板（配方 B，kind="dashboard"）

对应数据集：`findings`。

```text
<mavis-widget
  version="mavis.widget.v1"
  kind="dashboard"
  title="质量门与缺陷回派"
  height="620"
  min-height="420"
  max-height="900"
  streaming="html-first"
  capabilities="resize,sendPrompt"
  theme="app"
  token-set="mavis.semantic.v1">
  <mavis-meta type="json">{"summary":"QA、浏览器验收与终审共 4 条发现，其中 2 条 blocking 尚未修复，修复循环已用 1 轮（上限 2）。","dataSource":"Steward 工件 reports/qa.md、reports/browser.md、reports/review.md","chartType":"table","datasetShape":{"rows":4,"dimensions":["findingId","stage","severity","owner","status"],"measures":["count"]},"interactions":[{"id":"reroute-finding","label":"按归属回派","capability":"sendPrompt"},{"id":"batch-reroute","label":"汇总回派建议","capability":"sendPrompt"}]}</mavis-meta>
  <mavis-style>
body{margin:0;padding:16px;background:var(--mw-bg);color:var(--mw-text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px;}
.kpi{background:var(--mw-surface);border:1px solid var(--mw-border);border-radius:10px;padding:12px 14px;}
.kpi-label{font-size:12px;color:var(--mw-text-muted);}
.kpi-value{font-size:24px;font-weight:700;color:var(--mw-text);margin-top:2px;}
.kpi-note{font-size:12px;color:var(--mw-text-subtle);margin-top:2px;}
.kpi-value.danger{color:var(--mw-danger);}
.kpi-value.warning{color:var(--mw-warning);}
.panel{background:var(--mw-surface);border:1px solid var(--mw-border);border-radius:10px;padding:14px;margin-bottom:12px;}
.panel-title{font-size:14px;font-weight:500;color:var(--mw-text);margin-bottom:10px;}
.bench{display:grid;grid-template-columns:96px 1fr 44px;gap:12px;align-items:center;padding:4px 0;}
.bench-label{font-size:12px;color:var(--mw-text-muted);}
.bench-track{height:16px;background:var(--mw-surface-muted);border-radius:5px;overflow:hidden;}
.bench-fill{height:100%;border-radius:5px;}
.bench-val{font-size:12px;color:var(--mw-text);text-align:right;font-variant-numeric:tabular-nums;}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}
.chip{font:inherit;font-size:12px;padding:4px 10px;border-radius:8px;border:1px solid var(--mw-border);background:var(--mw-surface);color:var(--mw-text-muted);cursor:pointer;}
.chip:hover{background:var(--mw-surface-muted);}
.chip:focus-visible{outline:2px solid var(--mw-accent);outline-offset:2px;}
.chip.on{border-color:var(--mw-accent);color:var(--mw-accent);background:var(--mw-surface-muted);}
.chip[disabled]{opacity:0.5;cursor:not-allowed;}
.tbl{width:100%;border-collapse:collapse;}
.tbl th{padding:8px 10px;text-align:left;font-size:12px;font-weight:500;color:var(--mw-text-muted);background:var(--mw-surface-muted);border-bottom:1px solid var(--mw-border);}
.tbl td{padding:9px 10px;border-bottom:1px solid var(--mw-border);font-size:12px;color:var(--mw-text);vertical-align:top;}
.tbl tr:last-child td{border-bottom:none;}
.sev{display:inline-block;padding:0 6px;border-radius:6px;font-size:12px;}
.sev-blocking{border:1px solid var(--mw-danger);color:var(--mw-danger);}
.sev-non-blocking{border:1px solid var(--mw-warning);color:var(--mw-warning);}
.sev-suggestion{border:1px solid var(--mw-border);color:var(--mw-text-muted);}
.loc{font-family:'JetBrains Mono',monospace;}
.btn{font:inherit;font-size:12px;padding:5px 10px;border-radius:8px;border:1px solid var(--mw-border);background:var(--mw-surface);color:var(--mw-text);cursor:pointer;}
.btn:hover{background:var(--mw-surface-muted);}
.btn:focus-visible{outline:2px solid var(--mw-accent);outline-offset:2px;}
.act{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--mw-text-muted);margin-bottom:8px;}
.empty{font-size:12px;color:var(--mw-text-subtle);margin:8px 0 0;}
  </mavis-style>
  <mavis-html>
<div class="kpi-row">
  <div class="kpi"><div class="kpi-label">阻断项</div><div class="kpi-value" id="kpi-blocking">--</div><div class="kpi-note">blocking</div></div>
  <div class="kpi"><div class="kpi-label">未修复</div><div class="kpi-value" id="kpi-open">--</div><div class="kpi-note">含所有级别</div></div>
  <div class="kpi"><div class="kpi-label">已回派待复跑</div><div class="kpi-value" id="kpi-rerouted">--</div><div class="kpi-note">rerouted</div></div>
  <div class="kpi"><div class="kpi-label">修复轮次</div><div class="kpi-value" id="kpi-rounds">--</div><div class="kpi-note">上限 2 轮</div></div>
</div>
<div class="panel">
  <div class="panel-title">严重度分布</div>
  <div class="bench"><span class="bench-label">blocking</span><div class="bench-track"><div class="bench-fill" id="bar-blocking" style="width:0%;background:var(--mw-danger)"></div></div><span class="bench-val" id="val-blocking">--</span></div>
  <div class="bench"><span class="bench-label">non-blocking</span><div class="bench-track"><div class="bench-fill" id="bar-non-blocking" style="width:0%;background:var(--mw-warning)"></div></div><span class="bench-val" id="val-non-blocking">--</span></div>
  <div class="bench"><span class="bench-label">suggestion</span><div class="bench-track"><div class="bench-fill" id="bar-suggestion" style="width:0%;background:var(--mw-chart-1)"></div></div><span class="bench-val" id="val-suggestion">--</span></div>
</div>
<div class="panel">
  <div class="panel-title">缺陷明细</div>
  <div class="chips">
    <button class="chip on" data-stage="all">全部</button>
    <button class="chip" data-stage="qa">QA</button>
    <button class="chip" data-stage="browser">浏览器</button>
    <button class="chip" data-stage="review">终审</button>
    <button class="chip" data-flag="open">只看未修复</button>
  </div>
  <div class="legend">
    <span class="legend-item">blocking = 必须修复后才可交付</span>
    <span class="legend-item">non-blocking = 应修，可另行跟进</span>
    <span class="legend-item">suggestion = 可选优化</span>
  </div>
  <table class="tbl">
    <thead><tr><th>级别</th><th>阶段</th><th>位置</th><th>问题</th><th>归属</th><th>状态</th><th></th></tr></thead>
    <tbody id="rows"></tbody>
  </table>
  <p class="empty" id="empty-note" hidden>QA、浏览器验收、终审三类门禁均无发现。</p>
</div>
<div class="act">
  <button class="btn" data-action="batch-reroute">按归属汇总回派</button>
</div>
  </mavis-html>
  <mavis-data name="findings" type="json">
{"runId":"1028-1530-demo","gates":[{"check":"pnpm test","stage":"qa","result":"fail","summary":"12 passed / 2 failed"},{"check":"pnpm lint","stage":"qa","result":"pass","summary":"0 problems"},{"check":"pnpm typecheck","stage":"qa","result":"pass","summary":"0 errors"}],"rounds":{"qa":1,"browser":1,"review":0},"findings":[{"id":"F1","stage":"qa","severity":"blocking","location":"src/modules/auth/session.ts:42","summary":"会话过期后仍可继续调用受保护接口","owner":"backend-dev","repro":"pnpm test src/modules/auth/session.test.ts","status":"open"},{"id":"F2","stage":"qa","severity":"blocking","location":"src/modules/auth/captcha.ts:18","summary":"限流计数未在进程重启后复位","owner":"backend-dev","repro":"pnpm test src/modules/auth/captcha.test.ts","status":"rerouted"},{"id":"F3","stage":"browser","severity":"non-blocking","location":"/login","summary":"验证码输入框在窄屏下被遮挡","owner":"frontend-dev","repro":"打开 /login，窗口宽度设为 360px","status":"open"},{"id":"F4","stage":"review","severity":"suggestion","location":"src/pages/login/LoginForm.tsx:88","summary":"登录失败提示可复用统一的错误文案常量","owner":"frontend-dev","repro":"阅读该文件","status":"open"}]}
  </mavis-data>
  <mavis-script>
(function () {
  var SEV = { blocking: 'blocking', 'non-blocking': 'non-blocking', suggestion: 'suggestion' };
  var SEV_LABEL = { blocking: 'blocking', 'non-blocking': 'non-blocking', suggestion: 'suggestion' };
  var STAGE_LABEL = { qa: 'QA', browser: '浏览器', review: '终审' };
  var STATUS_LABEL = { open: '待回派', rerouted: '已回派', fixed: '已修复', waived: '已豁免' };
  var RANK = { blocking: 0, 'non-blocking': 1, suggestion: 2 };
  var data = (window.__mavisData || {})['findings'];
  var el = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var findings = ((data && data.findings) || []).slice().sort(function (a, b) {
    var d = (RANK[a.severity] === undefined ? 3 : RANK[a.severity]) - (RANK[b.severity] === undefined ? 3 : RANK[b.severity]);
    if (d) return d;
    return String(a.id).localeCompare(String(b.id));
  });
  var rounds = (data && data.rounds) || {};
  var usedRounds = 0;
  Object.keys(rounds).forEach(function (k) { usedRounds = Math.max(usedRounds, Number(rounds[k]) || 0); });

  var stage = 'all';
  var onlyOpen = false;

  function visible() {
    return findings.filter(function (f) {
      if (stage !== 'all' && f.stage !== stage) return false;
      if (onlyOpen && f.status === 'fixed') return false;
      return true;
    });
  }

  function render() {
    var rows = visible();
    var counts = { blocking: 0, 'non-blocking': 0, suggestion: 0 };
    rows.forEach(function (f) { if (counts[f.severity] !== undefined) counts[f.severity] += 1; });
    var max = Math.max(counts.blocking, counts['non-blocking'], counts.suggestion, 1);
    Object.keys(counts).forEach(function (k) {
      el('bar-' + k).style.width = Math.round((counts[k] / max) * 100) + '%';
      el('val-' + k).textContent = String(counts[k]);
    });

    var all = findings;
    el('kpi-blocking').textContent = String(all.filter(function (f) { return f.severity === 'blocking'; }).length);
    el('kpi-blocking').className = 'kpi-value' + (all.some(function (f) { return f.severity === 'blocking' && f.status !== 'fixed'; }) ? ' danger' : '');
    el('kpi-open').textContent = String(all.filter(function (f) { return f.status !== 'fixed'; }).length);
    el('kpi-rerouted').textContent = String(all.filter(function (f) { return f.status === 'rerouted'; }).length);
    el('kpi-rounds').textContent = String(usedRounds) + ' / 2';
    el('kpi-rounds').className = 'kpi-value' + (usedRounds >= 2 ? ' warning' : '');

    el('rows').innerHTML = rows.map(function (f) {
      return '<tr>' +
        '<td><span class="sev sev-' + esc(f.severity) + '">' + esc(SEV_LABEL[f.severity] || f.severity) + '</span></td>' +
        '<td>' + esc(STAGE_LABEL[f.stage] || f.stage) + '</td>' +
        '<td class="loc">' + esc(f.location) + '</td>' +
        '<td>' + esc(f.summary) + '</td>' +
        '<td>' + esc(f.owner) + '</td>' +
        '<td>' + esc(STATUS_LABEL[f.status] || f.status) + '</td>' +
        '<td><button class="btn" data-action="reroute-finding" data-finding="' + esc(f.id) + '">回派</button></td>' +
        '</tr>';
    }).join('');
    el('empty-note').hidden = rows.length !== 0;
  }

  Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (chip) {
    chip.addEventListener('click', function () {
      if (chip.getAttribute('data-flag')) {
        onlyOpen = !onlyOpen;
        chip.classList.toggle('on', onlyOpen);
      } else {
        stage = chip.getAttribute('data-stage');
        Array.prototype.forEach.call(document.querySelectorAll('.chip[data-stage]'), function (c) {
          c.classList.toggle('on', c === chip);
        });
      }
      render();
    });
  });

  document.body.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-action]') : null;
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    if (action === 'reroute-finding') {
      var id = btn.getAttribute('data-finding');
      var f = null;
      findings.forEach(function (x) { if (x.id === id) f = x; });
      if (!f || !window.mavis || !window.mavis.sendPrompt) return;
      window.mavis.sendPrompt(
        '请按缺陷 ' + f.id + '（' + f.severity + '，归属 ' + f.owner + '，' + f.location + '）回派给 ' + f.owner + ' 修复，附上复现方式「' + f.repro + '」与真实失败输出；修复后必须复跑对应质量门。',
        {
          widgetTitle: '质量门与缺陷回派',
          action: 'reroute-finding',
          selectedData: {
            findingId: f.id, stage: f.stage, severity: f.severity, owner: f.owner,
            location: f.location, summary: f.summary, repro: f.repro, status: f.status
          },
          visibleFilters: { stage: stage, onlyOpen: onlyOpen, runId: (data && data.runId) || null },
          userIntent: '按缺陷归属回派给对应开发并要求复跑质量门'
        }
      );
    } else if (action === 'batch-reroute') {
      var rows = visible();
      var byOwner = {};
      rows.forEach(function (f) { (byOwner[f.owner] = byOwner[f.owner] || []).push(f.id); });
      if (!window.mavis || !window.mavis.sendPrompt) return;
      window.mavis.sendPrompt(
        '请汇总当前未修复缺陷，按归属角色给出分派与复跑顺序建议，并标明哪些属于必须修复后才能交付的阻断项。',
        {
          widgetTitle: '质量门与缺陷回派',
          action: 'batch-reroute',
          selectedData: { byOwner: byOwner, total: rows.length, blocking: rows.filter(function (f) { return f.severity === 'blocking'; }).length },
          visibleFilters: { stage: stage, onlyOpen: onlyOpen, runId: (data && data.runId) || null },
          userIntent: '汇总未修复缺陷并给出分派与复跑顺序建议'
        }
      );
    }
  });

  render();
})();
  </mavis-script>
  <mavis-fallback>
质量门与缺陷回派看板：共 4 条发现，blocking 2 条、non-blocking 1 条、suggestion 1 条；未修复 4 条，已回派待复跑 1 条，修复循环已用 1 轮（上限 2 轮）。阻断项 F1（src/modules/auth/session.ts:42，归属 backend-dev，待回派）与 F2（src/modules/auth/captcha.ts:18，归属 backend-dev，已回派）必须修复后才可交付。
  </mavis-fallback>
</mavis-widget>
```

---

## 示例 C：维护健康看板（配方 C，kind="dashboard"）

对应数据集：`maintenance`。示例数据是**代表性的维护扫描产物**（虚构仓库计数），不是真实扫描日志；实际使用时把 `<mavis-data>` 换成从 `reports/maintenance-*.md` 与 `HEALTH.md` 解析出的同构数据。

```text
<mavis-widget
  version="mavis.widget.v1"
  kind="dashboard"
  title="维护健康看板"
  height="1140"
  min-height="620"
  max-height="1200"
  streaming="html-first"
  capabilities="resize,sendPrompt"
  theme="app"
  token-set="mavis.semantic.v1">
  <mavis-meta type="json">{"summary":"健康分 13.0（待治理），7 项处置项中 5 项待处理；重复类扫描计数 836 为最大来源，优先处理 M1。","dataSource":"Steward 工件 reports/maintenance-20261106.md 与 docs/project/HEALTH.md","chartType":"dashboard","datasetShape":{"rows":7,"dimensions":["backlogId","category","status"],"measures":["score","cost"]},"interactions":[{"id":"plan-backlog-item","label":"生成修复计划","capability":"sendPrompt"},{"id":"summarize-maintenance","label":"按类别汇总维护计划","capability":"sendPrompt"},{"id":"explain-health-score","label":"健康分怎么算","capability":"sendPrompt"}]}</mavis-meta>
  <mavis-style>
body{margin:0;padding:16px;background:var(--mw-bg);color:var(--mw-text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;}
.board{display:flex;flex-direction:column;gap:12px;}
.head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.head-title{font-size:18px;font-weight:500;color:var(--mw-text);}
.head-sub{font-size:12px;color:var(--mw-text-muted);display:flex;gap:6px;align-items:center;margin-top:2px;}
.sep{color:var(--mw-text-subtle);}
.grade{font-size:12px;padding:3px 10px;border-radius:6px;border:1px solid var(--mw-border);color:var(--mw-text-muted);white-space:nowrap;}
.grade.success{color:var(--mw-success);border-color:var(--mw-success);}
.grade.warning{color:var(--mw-warning);border-color:var(--mw-warning);}
.grade.danger{color:var(--mw-danger);border-color:var(--mw-danger);}
.hero{display:grid;grid-template-columns:minmax(240px,0.9fr) minmax(0,1.6fr);gap:12px;}
.hero-score,.hero-side{background:var(--mw-surface);border:1px solid var(--mw-border);border-radius:12px;padding:16px;}
.hero-score{display:flex;flex-direction:column;}
.score{font-size:40px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums;color:var(--mw-text);}
.score-label{font-size:12px;color:var(--mw-text-muted);margin-top:4px;}
.muted{color:var(--mw-text-muted);}
.score-meta{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;color:var(--mw-text-muted);flex-wrap:wrap;}
.delta{font-size:12px;font-weight:500;}
.delta.up{color:var(--mw-success);}
.delta.down{color:var(--mw-danger);}
.delta.flat{color:var(--mw-text-muted);}
.spark{margin-top:12px;}
.spark svg{display:block;width:100%;height:48px;}
.spark-area{fill:var(--mw-accent);fill-opacity:0.12;stroke:none;}
.spark-line{fill:none;stroke:var(--mw-accent);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;}
.spark-range{display:flex;justify-content:space-between;font-size:12px;color:var(--mw-text-muted);margin-top:4px;}
.hero-side{display:flex;flex-direction:column;gap:12px;}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.kpi{background:var(--mw-surface-muted);border-radius:8px;padding:10px 12px;}
.kpi-label{font-size:12px;color:var(--mw-text-muted);}
.kpi-value{font-size:24px;font-weight:700;line-height:1.2;font-variant-numeric:tabular-nums;margin-top:2px;}
.kpi-note{font-size:12px;color:var(--mw-text-subtle);margin-top:2px;}
.status-head{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;color:var(--mw-text-muted);margin-bottom:6px;}
.status-track{display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--mw-surface-muted);}
.seg{height:100%;width:0;}
.seg-open{background:var(--mw-warning);}
.seg-fixed{background:var(--mw-success);}
.seg-deferred{background:var(--mw-text-subtle);}
.seg-escalated{background:var(--mw-danger);}
.status-legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;font-size:12px;color:var(--mw-text-muted);}
.legend-item{display:flex;align-items:center;gap:5px;}
.legend-count{color:var(--mw-text);font-weight:500;font-variant-numeric:tabular-nums;}
.dot{width:7px;height:7px;border-radius:2px;}
.dot-open{background:var(--mw-warning);}
.dot-fixed{background:var(--mw-success);}
.dot-deferred{background:var(--mw-text-subtle);}
.dot-escalated{background:var(--mw-danger);}
.panel{background:var(--mw-surface);border:1px solid var(--mw-border);border-radius:12px;padding:14px 16px;}
.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.section-title{font-size:14px;font-weight:500;color:var(--mw-text);}
.count{font-size:12px;color:var(--mw-text-subtle);font-weight:400;}
.section-note{font-size:12px;color:var(--mw-text-muted);}
.cat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px;}
.cat{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:9px 10px;border:1px solid var(--mw-border);border-radius:8px;background:var(--mw-surface);color:inherit;font:inherit;text-align:left;cursor:pointer;position:relative;}
.cat:hover{background:var(--mw-surface-muted);}
.cat:focus-visible{outline:2px solid var(--mw-accent);outline-offset:2px;}
.cat.on{border-color:var(--mw-accent);background:var(--mw-surface-muted);}
.cat.zero{color:var(--mw-text-subtle);}
.cat-name{font-size:12px;color:inherit;}
.cat-count{font-size:20px;font-weight:700;line-height:1.2;font-variant-numeric:tabular-nums;color:var(--mw-text);}
.cat.zero .cat-count{color:var(--mw-text-subtle);}
.cat-top{position:absolute;top:6px;right:6px;font-size:12px;color:var(--mw-accent);}
.tools{display:flex;gap:6px;flex-wrap:wrap;}
.chip{font:inherit;font-size:12px;padding:4px 10px;border-radius:8px;border:1px solid var(--mw-border);background:var(--mw-surface);color:var(--mw-text-muted);cursor:pointer;}
.chip:hover{background:var(--mw-surface-muted);}
.chip:focus-visible{outline:2px solid var(--mw-accent);outline-offset:2px;}
.chip.on{border-color:var(--mw-accent);color:var(--mw-accent);background:var(--mw-surface-muted);}
.list-note{font-size:12px;color:var(--mw-text-muted);margin:8px 0 4px;}
.rows{display:flex;flex-direction:column;}
.row{border-top:1px solid var(--mw-border);}
.row:first-child{border-top:none;}
.row-head{display:grid;grid-template-columns:28px minmax(0,1fr) 96px 132px 62px 76px 20px;gap:10px;align-items:center;padding:10px 4px;cursor:pointer;border-radius:8px;}
.row-head:hover{background:var(--mw-surface-muted);}
.row-head:focus-visible{outline:2px solid var(--mw-accent);outline-offset:-2px;}
.row.open .row-head{background:var(--mw-surface-muted);}
.rank{font-size:12px;color:var(--mw-text-subtle);font-variant-numeric:tabular-nums;}
.row-main{min-width:0;display:block;}
.row-title{display:block;font-size:14px;font-weight:500;color:var(--mw-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.row-evidence{display:block;font-size:12px;color:var(--mw-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;font-family:'JetBrains Mono',monospace;}
.row-cat{font-size:12px;color:var(--mw-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.meter{display:flex;align-items:center;gap:8px;}
.meter-track{flex:1;height:4px;border-radius:2px;background:var(--mw-border);overflow:hidden;}
.meter-fill{display:block;height:100%;width:0;background:var(--mw-accent);border-radius:2px;}
.meter-val{font-size:12px;font-weight:500;color:var(--mw-text);font-variant-numeric:tabular-nums;min-width:28px;text-align:right;}
.cost{display:flex;align-items:center;gap:3px;}
.cost-dot{width:5px;height:5px;border-radius:50%;background:var(--mw-border);}
.cost-dot.on{background:var(--mw-text-muted);}
.badge{font-size:12px;padding:1px 7px;border-radius:6px;border:1px solid var(--mw-border);color:var(--mw-text-muted);white-space:nowrap;text-align:center;}
.badge.open{border-color:var(--mw-warning);color:var(--mw-warning);}
.badge.fixed{border-color:var(--mw-success);color:var(--mw-success);}
.badge.deferred{border-color:var(--mw-border);color:var(--mw-text-muted);}
.badge.escalated{border-color:var(--mw-danger);color:var(--mw-danger);}
.badge.missing{border-color:var(--mw-danger);color:var(--mw-danger);}
.chev{width:7px;height:7px;border-right:1.5px solid var(--mw-text-subtle);border-bottom:1.5px solid var(--mw-text-subtle);transform:rotate(45deg);justify-self:end;margin-right:4px;}
.row.open .chev{transform:rotate(-135deg);}
.detail{display:none;padding:0 4px 12px 38px;}
.row.open .detail{display:block;}
.detail-box{background:var(--mw-surface-muted);border-radius:8px;padding:12px;}
.detail-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 12px;font-size:12px;}
.detail-k{color:var(--mw-text-muted);}
.detail-v{color:var(--mw-text);margin-top:1px;font-variant-numeric:tabular-nums;}
.detail-missing{font-size:12px;color:var(--mw-danger);margin-top:8px;}
.detail-evidence{margin-top:10px;padding-top:10px;border-top:1px solid var(--mw-border);font-size:12px;color:var(--mw-text);font-family:'JetBrains Mono',monospace;word-break:break-word;}
.detail-act{display:flex;justify-content:flex-end;margin-top:10px;}
.btn{font:inherit;font-size:12px;padding:6px 12px;border-radius:8px;border:1px solid var(--mw-border);background:var(--mw-surface);color:var(--mw-text);cursor:pointer;}
.btn:hover{background:var(--mw-surface-muted);}
.btn:focus-visible{outline:2px solid var(--mw-accent);outline-offset:2px;}
.btn.primary{background:var(--mw-accent);border-color:var(--mw-accent);color:var(--mw-bg);}
.btn.primary:hover{opacity:0.9;}
.btn[disabled]{opacity:0.5;cursor:not-allowed;}
.empty,.error{font-size:12px;color:var(--mw-text-muted);padding:18px 0;text-align:center;margin:0;}
.error{color:var(--mw-danger);text-align:left;padding:8px 0 0;}
.act{display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between;align-items:center;}
.skeleton{background:var(--mw-surface-muted);border-radius:8px;height:56px;margin-top:8px;}
@media (max-width:760px){
  .hero{grid-template-columns:1fr;}
  .cat-grid{grid-template-columns:repeat(2,1fr);}
  .row-head{grid-template-columns:24px minmax(0,1fr) 76px 58px 18px;gap:8px;}
  .row-cat,.cost{display:none;}
  .detail{padding-left:4px;}
  .detail-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
}
  </mavis-style>
  <mavis-html>
<div class="board">
  <header class="head">
    <div>
      <div class="head-title">维护健康</div>
      <div class="head-sub"><span id="scan-date">--</span><span class="sep">·</span><span>maintain.mjs</span></div>
    </div>
    <span class="grade" id="grade">--</span>
  </header>
  <section class="hero">
    <div class="hero-score">
      <div class="score" id="score">--</div>
      <div class="score-label">健康分<span class="muted">（越低越好）</span></div>
      <div class="score-meta"><span class="delta" id="delta" hidden></span><span>按未修复条目数分级</span></div>
      <div class="spark" id="spark" hidden>
        <svg id="spark-svg" viewBox="0 0 240 48" preserveAspectRatio="none" aria-hidden="true">
          <path id="spark-area" class="spark-area" d=""></path>
          <polyline id="spark-line" class="spark-line" points=""></polyline>
        </svg>
        <div class="spark-range"><span id="spark-from"></span><span id="spark-to"></span></div>
      </div>
    </div>
    <div class="hero-side">
      <div class="kpis">
        <div class="kpi"><div class="kpi-label">待处理</div><div class="kpi-value" id="kpi-open">--</div><div class="kpi-note">open</div></div>
        <div class="kpi"><div class="kpi-label">已修复</div><div class="kpi-value" id="kpi-fixed">--</div><div class="kpi-note">fixed</div></div>
        <div class="kpi"><div class="kpi-label">最高得分</div><div class="kpi-value" id="kpi-max">--</div><div class="kpi-note">优先处理</div></div>
      </div>
      <div class="status">
        <div class="status-head"><span>状态分布</span><span id="status-total">-- 项</span></div>
        <div class="status-track" id="status-track">
          <span class="seg seg-open" id="seg-open"></span>
          <span class="seg seg-fixed" id="seg-fixed"></span>
          <span class="seg seg-deferred" id="seg-deferred"></span>
          <span class="seg seg-escalated" id="seg-escalated"></span>
        </div>
        <div class="status-legend" id="status-legend"></div>
      </div>
    </div>
  </section>
  <section class="panel">
    <div class="section-head"><div class="section-title">类别分布</div><div class="section-note">扫描计数</div></div>
    <div class="cat-grid" id="cat-grid">
      <div class="cat"><span class="cat-name">依赖</span><span class="cat-count">--</span></div>
      <div class="cat"><span class="cat-name">安全</span><span class="cat-count">--</span></div>
      <div class="cat"><span class="cat-name">重复</span><span class="cat-count">--</span></div>
      <div class="cat"><span class="cat-name">变更频率</span><span class="cat-count">--</span></div>
      <div class="cat"><span class="cat-name">文档漂移</span><span class="cat-count">--</span></div>
      <div class="cat"><span class="cat-name">架构漂移</span><span class="cat-count">--</span></div>
      <div class="cat"><span class="cat-name">不稳定测试</span><span class="cat-count">--</span></div>
      <div class="cat"><span class="cat-name">TODO</span><span class="cat-count">--</span></div>
    </div>
  </section>
  <section class="panel">
    <div class="section-head">
      <div class="section-title">优先处理 <span class="count" id="list-count">--</span></div>
      <div class="tools">
        <button class="chip" id="hide-fixed" type="button" aria-pressed="false">隐藏已修复</button>
        <button class="chip on" id="sort-score" type="button" aria-pressed="true">按得分</button>
        <button class="chip" id="sort-cost" type="button" aria-pressed="false">按成本</button>
        <button class="chip on" id="filter-all" type="button" aria-pressed="true">全部</button>
      </div>
    </div>
    <div class="list-note">得分 = 权重 × 影响面 ÷ 成本，得分越高越先处理；成本用 1–3 个点表示（3 最贵）。显示 <span id="shown">--</span> / <span id="total">--</span></div>
    <div class="rows" id="rows"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>
    <p class="empty" id="empty" hidden>本次扫描没有需要处理的维护项，保持现状。</p>
    <p class="error" id="error" hidden></p>
  </section>
  <footer class="act">
    <button class="btn primary" id="summary-btn" type="button">按类别汇总维护计划</button>
    <button class="btn" id="method-btn" type="button">健康分怎么算</button>
  </footer>
</div>
  </mavis-html>
  <mavis-data name="maintenance" type="json">
{"runId":"20261106-1530","date":"2026-11-06","score":13.0,"categories":{"dependencies":0,"security":0,"duplication":836,"churn":3,"docDrift":2,"architectureDrift":0,"flaky":0,"todo":16},"history":[{"date":"2026-10-09","score":18.0},{"date":"2026-10-16","score":16.0},{"date":"2026-10-23","score":15.0},{"date":"2026-10-30","score":14.0},{"date":"2026-11-06","score":13.0}],"backlog":[{"id":"M1","category":"duplication","score":8.0,"title":"跨文件重复代码窗口（≥6 行）","evidence":"zcode/scripts/verify.mjs ↔ minimax/scripts/verify.mjs：312 个窗口","cost":3,"status":"open"},{"id":"M2","category":"todo","score":4.5,"title":"扫描到 16 处 TODO/FIXME","evidence":"zcode/scripts/*.mjs 与 host/*/skills/*：16 处","cost":1,"status":"open"},{"id":"M3","category":"docDrift","score":3.5,"title":"仓库根缺 AGENTS.md，项目记忆未落地","evidence":"docs/project/ 七件套齐全，但仓库根没有 AGENTS.md","cost":2,"status":"open"},{"id":"M4","category":"duplication","score":2.5,"title":"构建脚本与模板存在重复清单","evidence":"zcode/scripts/build.mjs 与 minimax/scripts/build.mjs 同步块重复","cost":2,"status":"open"},{"id":"M5","category":"churn","score":2.0,"title":"构建脚本近 30 天改动频率偏高","evidence":"git log --since=30.days -- zcode/scripts/build.mjs：11 次提交","cost":1,"status":"open"},{"id":"M6","category":"docDrift","score":1.5,"title":"README 版本号与 plugin.json 不一致","evidence":"README.md 版本引用落后于 zcode/.zcode-plugin/plugin.json","cost":1,"status":"fixed"},{"id":"M7","category":"todo","score":1.0,"title":"verify.mjs 中保留两处待确认注释","evidence":"zcode/scripts/verify.mjs：2 处 TODO","cost":1,"status":"deferred"}]}
  </mavis-data>
  <mavis-script>
(function () {
  var CATS = [
    ['dependencies', '依赖'], ['security', '安全'], ['duplication', '重复'], ['churn', '变更频率'],
    ['docDrift', '文档漂移'], ['architectureDrift', '架构漂移'], ['flaky', '不稳定测试'], ['todo', 'TODO']
  ];
  var STATUS = { open: '待处理', fixed: '已修复', deferred: '已推迟', escalated: '已升级' };
  var GRADE = { success: '健康', warning: '需关注', danger: '待治理' };
  var data = (window.__mavisData || {})['maintenance'];
  var state = { cat: null, hideFixed: false, sort: 'score', openKey: null };
  var items = (data && Array.isArray(data.backlog)) ? data.backlog.slice() : [];
  var cats = (data && data.categories) || {};
  var counts = { open: 0, fixed: 0, deferred: 0, escalated: 0 };
  var openCount = 0;
  var maxScore = 0;
  var lastRows = [];
  var el = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(v, d) {
    var n = Number(v);
    return isFinite(n) ? n : (d === undefined ? 0 : d);
  }
  function fixed1(v) { return num(v).toFixed(1); }
  function statusOf(item) {
    var s = item && item.status ? item.status : 'open';
    return STATUS[s] ? s : 'open';
  }
  function catLabel(code) {
    for (var i = 0; i < CATS.length; i++) { if (CATS[i][0] === code) return CATS[i][1]; }
    return code || '未分类';
  }
  function missing(item) {
    var out = [];
    if (!item || typeof item !== 'object') return ['item'];
    if (!item.id) out.push('id');
    if (!item.category) out.push('category');
    if (item.score === undefined || item.score === null || item.score === '' || !isFinite(Number(item.score))) out.push('score');
    if (!item.title) out.push('title');
    if (!item.evidence) out.push('evidence');
    if (item.cost === undefined || item.cost === null || !isFinite(Number(item.cost))) out.push('cost');
    if (item.status && !STATUS[item.status]) out.push('status');
    return out;
  }
  function costDots(n) {
    var out = '';
    for (var i = 1; i <= 3; i++) out += '<span class="cost-dot' + (i <= n ? ' on' : '') + '"></span>';
    return out;
  }
  function openLabel(n) {
    return n === 0 ? '健康' : (n <= 4 ? '需关注' : '待治理');
  }
  function gradeKey(n) {
    return n === 0 ? 'success' : (n <= 4 ? 'warning' : 'danger');
  }

  function renderCats() {
    var topCat = null, topVal = 0;
    CATS.forEach(function (c) {
      var v = num(cats[c[0]], 0);
      if (v > topVal) { topVal = v; topCat = c[0]; }
    });
    el('cat-grid').innerHTML = CATS.map(function (c) {
      var v = num(cats[c[0]], 0);
      var on = state.cat === c[0];
      var top = topCat === c[0] && topVal > 0;
      return '<button type="button" class="cat' + (v === 0 ? ' zero' : '') + (on ? ' on' : '') + '" data-cat="' + c[0] + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc(c[1]) + ' ' + v + ' 项' + (top ? '，最多' : '') + '">' +
        (top ? '<span class="cat-top">最多</span>' : '') +
        '<span class="cat-name">' + esc(c[1]) + '</span><span class="cat-count">' + v + '</span></button>';
    }).join('');
  }

  function renderStatus() {
    var total = items.length;
    ['open', 'fixed', 'deferred', 'escalated'].forEach(function (k) {
      el('seg-' + k).style.width = total ? (counts[k] / total * 100).toFixed(1) + '%' : '0%';
    });
    el('status-total').textContent = total + ' 项';
    el('status-legend').innerHTML = ['open', 'fixed', 'deferred', 'escalated'].map(function (k) {
      return '<span class="legend-item"><span class="dot dot-' + k + '"></span>' + STATUS[k] + ' <span class="legend-count">' + counts[k] + '</span></span>';
    }).join('');
  }

  function renderSpark() {
    var history = (data && Array.isArray(data.history)) ? data.history.filter(function (h) {
      return h && h.date && isFinite(Number(h.score));
    }).slice(-12) : [];
    history.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    if (history.length < 2) return;
    var scores = history.map(function (h) { return num(h.score); });
    var min = Math.min.apply(null, scores), max = Math.max.apply(null, scores);
    var span = max - min || 1;
    var pts = history.map(function (h, i) {
      var x = (i / (history.length - 1)) * 240;
      var y = 44 - ((num(h.score) - min) / span) * 40;
      return [x, y];
    });
    el('spark-line').setAttribute('points', pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '));
    el('spark-area').setAttribute('d', 'M0,48 L' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L') + ' L240,48 Z');
    el('spark-from').textContent = history[0].date;
    el('spark-to').textContent = history[history.length - 1].date;
    el('spark').hidden = false;
    var d = num(history[history.length - 1].score) - num(history[history.length - 2].score);
    var delta = el('delta');
    delta.hidden = false;
    delta.className = 'delta ' + (d < 0 ? 'up' : (d > 0 ? 'down' : 'flat'));
    delta.textContent = d === 0 ? '较上次 持平' : '较上次 ' + (d < 0 ? '−' : '+') + fixed1(Math.abs(d));
  }

  function sorted() {
    var arr = items.slice();
    arr.sort(function (a, b) {
      if (state.sort === 'cost') {
        var dc = num(a.cost, 3) - num(b.cost, 3);
        if (dc) return dc;
        return num(b.score) - num(a.score) || String(a.id || '').localeCompare(String(b.id || ''));
      }
      var ds = num(b.score) - num(a.score);
      if (ds) return ds;
      var dc2 = num(a.cost, 3) - num(b.cost, 3);
      if (dc2) return dc2;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    return arr;
  }

  function renderRows() {
    var rows = sorted().filter(function (x) {
      if (state.cat && x.category !== state.cat) return false;
      if (state.hideFixed && statusOf(x) === 'fixed') return false;
      return true;
    });
    lastRows = rows;
    el('rows').innerHTML = rows.map(function (x, i) {
      var s = statusOf(x);
      var miss = missing(x);
      var score = num(x.score, 0);
      var pct = maxScore > 0 ? Math.round(score / maxScore * 100) : 0;
      var key = x.id ? 'id:' + x.id : 'idx:' + i;
      var open = state.openKey === key;
      return '<div class="row' + (open ? ' open' : '') + '" data-key="' + esc(key) + '">' +
        '<div class="row-head" role="button" tabindex="0" aria-expanded="' + (open ? 'true' : 'false') + '">' +
          '<span class="rank">' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</span>' +
          '<span class="row-main"><span class="row-title">' + esc(x.title || '未登记标题') + (miss.length ? ' <span class="badge missing">待补全</span>' : '') + '</span>' +
          '<span class="row-evidence">' + esc(x.evidence || '未登记证据') + '</span></span>' +
          '<span class="row-cat">' + esc(catLabel(x.category)) + '</span>' +
          '<span class="meter" title="得分 ' + fixed1(score) + ' / 最高 ' + fixed1(maxScore) + '"><span class="meter-track"><span class="meter-fill" style="width:' + pct + '%"></span></span><span class="meter-val">' + fixed1(score) + '</span></span>' +
          '<span class="cost" title="修复成本 ' + num(x.cost, 0) + '（1–3，3 最贵）">' + costDots(num(x.cost, 0)) + '</span>' +
          '<span class="badge ' + s + '">' + esc(STATUS[s] || '待补全') + '</span>' +
          '<span class="chev"></span>' +
        '</div>' +
        '<div class="detail"><div class="detail-box">' +
          '<div class="detail-grid">' +
            '<div><div class="detail-k">类别</div><div class="detail-v">' + esc(catLabel(x.category)) + ' <span class="muted">' + esc(x.category || '--') + '</span></div></div>' +
            '<div><div class="detail-k">得分</div><div class="detail-v">' + fixed1(score) + '</div></div>' +
            '<div><div class="detail-k">成本</div><div class="detail-v">' + costDots(num(x.cost, 0)) + ' ' + num(x.cost, 0) + '</div></div>' +
            '<div><div class="detail-k">状态</div><div class="detail-v">' + esc(STATUS[s] || s) + '</div></div>' +
          '</div>' +
          (miss.length ? '<div class="detail-missing">缺失字段：' + esc(miss.join('、')) + '</div>' : '') +
          '<div class="detail-evidence">' + esc(x.evidence || '未登记证据') + '</div>' +
          '<div class="detail-act"><button class="btn" type="button" data-prompt="' + esc(x.id || '') + '"' + (x.id ? '' : ' disabled') + '>生成修复计划</button></div>' +
        '</div></div></div>';
    }).join('');
    el('list-count').textContent = String(items.length);
    el('total').textContent = String(items.length);
    el('shown').textContent = String(rows.length);
    var empty = el('empty');
    if (!items.length) {
      empty.hidden = false;
      empty.textContent = '本次扫描没有需要处理的维护项，保持现状。';
    } else if (!rows.length) {
      empty.hidden = false;
      empty.textContent = '当前筛选没有匹配的维护项。';
    } else {
      empty.hidden = true;
    }
  }

  function renderChips() {
    el('hide-fixed').classList.toggle('on', state.hideFixed);
    el('hide-fixed').setAttribute('aria-pressed', String(state.hideFixed));
    el('sort-score').classList.toggle('on', state.sort === 'score');
    el('sort-score').setAttribute('aria-pressed', String(state.sort === 'score'));
    el('sort-cost').classList.toggle('on', state.sort === 'cost');
    el('sort-cost').setAttribute('aria-pressed', String(state.sort === 'cost'));
    el('filter-all').classList.toggle('on', !state.cat);
    el('filter-all').setAttribute('aria-pressed', String(!state.cat));
  }

  function render() {
    renderCats();
    renderStatus();
    renderChips();
    renderRows();
  }

  function promptItem(id) {
    var item = null;
    items.forEach(function (x) { if (String(x.id) === String(id)) item = x; });
    if (!item || !window.mavis || !window.mavis.sendPrompt) return;
    window.mavis.sendPrompt(
      '请为维护项 ' + item.id + '（' + (item.category || '未分类') + '，得分 ' + fixed1(num(item.score, 0)) + '，成本 ' + num(item.cost, 0) + '）生成修复计划：先核对证据范围，再给出最小改动步骤、验证命令与回滚方式；不要顺手重构无关代码。',
      {
        widgetTitle: '维护健康看板',
        action: 'plan-backlog-item',
        selectedData: {
          backlogId: item.id, category: item.category || null, score: num(item.score, 0),
          cost: num(item.cost, 0), status: statusOf(item), evidence: item.evidence || null
        },
        visibleFilters: { category: state.cat, hideFixed: state.hideFixed, sort: state.sort },
        userIntent: '为指定维护项生成修复计划'
      }
    );
  }

  el('cat-grid').addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-cat]') : null;
    if (!btn) return;
    var c = btn.getAttribute('data-cat');
    state.cat = state.cat === c ? null : c;
    render();
  });

  el('rows').addEventListener('click', function (e) {
    var promptBtn = e.target.closest ? e.target.closest('[data-prompt]') : null;
    if (promptBtn) { promptItem(promptBtn.getAttribute('data-prompt')); return; }
    var head = e.target.closest ? e.target.closest('.row-head') : null;
    if (!head) return;
    var row = head.parentNode;
    var key = row.getAttribute('data-key');
    var willOpen = !row.classList.contains('open');
    Array.prototype.forEach.call(document.querySelectorAll('.row'), function (r) {
      r.classList.remove('open');
      var h = r.querySelector('.row-head');
      if (h) h.setAttribute('aria-expanded', 'false');
    });
    if (willOpen) {
      row.classList.add('open');
      head.setAttribute('aria-expanded', 'true');
      state.openKey = key;
    } else {
      state.openKey = null;
    }
  });

  el('rows').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var head = e.target.closest ? e.target.closest('.row-head') : null;
    if (!head) return;
    e.preventDefault();
    head.click();
  });

  el('hide-fixed').addEventListener('click', function () {
    state.hideFixed = !state.hideFixed;
    render();
  });
  el('sort-score').addEventListener('click', function () {
    state.sort = 'score';
    render();
  });
  el('sort-cost').addEventListener('click', function () {
    state.sort = 'cost';
    render();
  });
  el('filter-all').addEventListener('click', function () {
    state.cat = null;
    render();
  });

  el('summary-btn').addEventListener('click', function () {
    if (!window.mavis || !window.mavis.sendPrompt) return;
    var byCategory = {};
    lastRows.forEach(function (x) {
      var c = x.category || 'unknown';
      (byCategory[c] = byCategory[c] || []).push(x.id || '--');
    });
    window.mavis.sendPrompt(
      '请按当前维护 backlog 汇总一份分派计划：按类别说明先做什么、每项的最小验证命令与预计成本，并标出哪些需要你拍板。',
      {
        widgetTitle: '维护健康看板',
        action: 'summarize-maintenance',
        selectedData: { byCategory: byCategory, openCount: openCount, visibleCount: lastRows.length, totalCount: items.length },
        visibleFilters: { category: state.cat, hideFixed: state.hideFixed, sort: state.sort },
        userIntent: '按类别汇总维护计划'
      }
    );
  });

  el('method-btn').addEventListener('click', function () {
    if (!window.mavis || !window.mavis.sendPrompt) return;
    window.mavis.sendPrompt(
      '请解释维护健康分的计算口径：权重、影响面、成本分别怎么取，以及分数变化说明什么；不要重新扫描。',
      {
        widgetTitle: '维护健康看板',
        action: 'explain-health-score',
        selectedData: { score: num(data && data.score, 0), openCount: openCount, categories: cats },
        visibleFilters: {},
        userIntent: '解释维护健康分口径'
      }
    );
  });

  if (!data) {
    el('error').hidden = false;
    el('error').textContent = '未找到维护扫描结果（maintenance 数据为空），无法渲染看板。请先运行 /steward maintain。';
    ['hide-fixed', 'sort-score', 'sort-cost', 'filter-all'].forEach(function (id) { el(id).disabled = true; });
    return;
  }

  el('scan-date').textContent = data.date || '日期未登记';
  if (!data.date || data.score === undefined || !Array.isArray(data.backlog)) {
    var missTop = [];
    if (!data.date) missTop.push('date');
    if (data.score === undefined) missTop.push('score');
    if (!Array.isArray(data.backlog)) missTop.push('backlog');
    el('error').hidden = false;
    el('error').textContent = '部分字段缺失：' + missTop.join('、') + '；以下只展示可用部分。';
  }

  items.forEach(function (x) {
    var s = statusOf(x);
    counts[s] += 1;
  });
  openCount = counts.open;
  items.forEach(function (x) { maxScore = Math.max(maxScore, num(x.score, 0)); });

  el('score').textContent = data.score === undefined ? '--' : fixed1(data.score);
  el('grade').textContent = GRADE[gradeKey(openCount)];
  el('grade').className = 'grade ' + gradeKey(openCount);
  el('kpi-open').textContent = String(openCount);
  el('kpi-fixed').textContent = String(counts.fixed);
  el('kpi-max').textContent = maxScore > 0 ? fixed1(maxScore) : '--';
  renderSpark();
  render();
})();
  </mavis-script>
  <mavis-fallback>
维护健康分 13.0（越低越好），分级「待治理」：7 项处置项中 5 项待处理、1 项已修复、1 项已推迟；重复类扫描计数 836 为最大来源。优先处理 M1（重复，得分 8.0，成本 3，证据：zcode/scripts/verify.mjs ↔ minimax/scripts/verify.mjs：312 个窗口）。
  </mavis-fallback>
</mavis-widget>
```

---

## 三点校验提醒

- 示例 A、B、C 都不调用 `new Chart(...)`：A 的节点是任务实体（无连续量纲），B 的严重度分布只有 3 个桶，C 的 8 类用 KPI 格而非柱状图、状态分布只有 4 段，均在「≤5 个可比数据点用 CSS/SVG」的判定之内。若后续要加柱状图，先确认样本量 ≥6 且 `kind` 为 `chart` / `dashboard`。
- 示例 C 的分级（健康 / 需关注 / 待治理）是**展示口径**，按未修复条目数计算，不是扫描结果；健康分本身仍以 maintain.mjs 为准，不要在文字里把分级写成脚本输出。
- 三个示例的 `sendPrompt` 的 `text` 与 `userIntent` 均为中文，与中文会话一致；若宿主会话语言为英文，二者都要改成英文。
