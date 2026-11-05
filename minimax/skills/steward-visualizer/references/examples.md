# Steward Visualizer 示例

两个配方各一个完整示例。示例数据是**代表性的研发团队产物**（虚构仓库与文件），不含任何真实凭据、绝对路径或生产密钥。实际使用时把 `<mavis-data>` 换成从 `03-plan.md` / `reports/*.md` 解析出的同构数据。

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
.kpi-note{font-size:12px;color:var(--mw-text-subtle);margin-top:2px;}
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

## 两点校验提醒

- 示例 A、B 都不调用 `new Chart(...)`：A 的节点是任务实体（无连续量纲），B 的严重度分布只有 3 个桶，均在「≤5 个可比数据点用 CSS/SVG」的判定之内。若后续要加柱状图，先确认样本量 ≥6 且 `kind` 为 `chart` / `dashboard`。
- 两个示例的 `sendPrompt` 的 `text` 与 `userIntent` 均为中文，与中文会话一致；若宿主会话语言为英文，二者都要改成英文。
