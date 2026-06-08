/**
 * Orchestra Dashboard — professional webview with live task tree, cost tracker, history
 */

const { AGENT_META } = require("./agents");

class DashboardProvider {
  constructor(extensionUri, onMessage) {
    this._extensionUri = extensionUri;
    this._onMessage    = onMessage;
    this._view         = null;
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._getHtml();
    webviewView.webview.onDidReceiveMessage(msg => this._onMessage?.(msg));
  }

  post(msg) {
    this._view?.webview.postMessage(msg);
  }

  _getHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--vscode-font-family,system-ui);font-size:12px;color:var(--vscode-foreground);background:transparent;line-height:1.5}
  code{font-family:var(--vscode-editor-font-family,monospace)}

  /* Tabs */
  .tabs{display:flex;border-bottom:1px solid var(--vscode-panel-border);margin-bottom:12px}
  .tab{padding:6px 14px;cursor:pointer;font-size:11px;border-bottom:2px solid transparent;color:var(--vscode-descriptionForeground);user-select:none}
  .tab.active{color:var(--vscode-foreground);border-color:var(--vscode-focusBorder)}
  .tab:hover:not(.active){color:var(--vscode-foreground)}
  .page{display:none;padding:0 2px}
  .page.active{display:block}

  /* Input */
  .input-box{display:flex;gap:6px;margin-bottom:10px}
  .input-box textarea{flex:1;background:var(--vscode-input-background);border:1px solid var(--vscode-input-border,var(--vscode-panel-border));color:var(--vscode-input-foreground);padding:6px 8px;border-radius:4px;font-size:11px;resize:vertical;min-height:52px;font-family:inherit;outline:none}
  .input-box textarea:focus{border-color:var(--vscode-focusBorder)}
  .btn-col{display:flex;flex-direction:column;gap:4px}
  .btn{padding:5px 10px;border:none;border-radius:4px;cursor:pointer;font-size:11px;white-space:nowrap}
  .btn-primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
  .btn-primary:hover{background:var(--vscode-button-hoverBackground)}
  .btn-secondary{background:var(--vscode-button-secondaryBackground,var(--vscode-panel-border));color:var(--vscode-button-secondaryForeground,var(--vscode-foreground))}
  .btn-secondary:hover{opacity:.8}
  .btn-danger{background:rgba(248,113,113,.15);color:#f87171}
  .btn:disabled{opacity:.45;cursor:not-allowed}

  /* Status banner */
  .banner{padding:7px 10px;border-radius:4px;font-size:11px;margin-bottom:10px;display:none}
  .banner.show{display:flex;align-items:center;gap:6px}
  .banner.info{background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.2);color:var(--vscode-editorInfo-foreground,var(--vscode-foreground))}
  .banner.success{background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.2);color:#34d399}
  .banner.error{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.2);color:#f87171}
  .banner.warn{background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.2);color:#fbbf24}

  /* Agent cards */
  .agents{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}
  .agent-card{padding:6px 8px;border-radius:4px;border:1px solid var(--vscode-panel-border);display:flex;align-items:center;gap:6px;transition:border-color .15s}
  .agent-card.running{border-color:var(--vscode-focusBorder);animation:pulse 1.2s ease-in-out infinite}
  .agent-card.done{border-color:rgba(52,211,153,.4)}
  .agent-card.error{border-color:rgba(248,113,113,.4)}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.65}}
  .agent-name{flex:1;font-size:11px}
  .agent-status{font-size:10px;color:var(--vscode-descriptionForeground)}

  /* Cost table */
  .cost-table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:8px}
  .cost-table th{text-align:left;padding:3px 6px;color:var(--vscode-descriptionForeground);border-bottom:1px solid var(--vscode-panel-border)}
  .cost-table td{padding:3px 6px;border-bottom:1px solid var(--vscode-panel-border,rgba(255,255,255,.06))}
  .cost-total{font-weight:600;color:var(--vscode-foreground)}

  /* Quality gate chips */
  .gate-chips{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}
  .chip{padding:2px 8px;border-radius:3px;font-size:10px;font-weight:500}
  .chip.pass{background:rgba(52,211,153,.12);color:#34d399}
  .chip.fail{background:rgba(248,113,113,.12);color:#f87171}
  .chip.skip{background:rgba(136,135,128,.12);color:var(--vscode-descriptionForeground)}

  /* History list */
  .run-list{display:flex;flex-direction:column;gap:4px}
  .run-item{padding:7px 10px;border-radius:4px;border:1px solid var(--vscode-panel-border);cursor:pointer;transition:border-color .15s}
  .run-item:hover{border-color:var(--vscode-focusBorder)}
  .run-header{display:flex;align-items:center;gap:6px;margin-bottom:2px}
  .run-feature{flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .run-time{font-size:10px;color:var(--vscode-descriptionForeground)}
  .run-meta{font-size:10px;color:var(--vscode-descriptionForeground);display:flex;gap:10px}
  .status-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
  .dot-green{background:#34d399}.dot-red{background:#f87171}.dot-amber{background:#fbbf24}.dot-gray{background:#888}

  /* Log */
  .log-box{background:var(--vscode-editor-background,var(--vscode-input-background));border:1px solid var(--vscode-panel-border);border-radius:4px;padding:6px 8px;max-height:180px;overflow-y:auto;font-size:10px;font-family:var(--vscode-editor-font-family,monospace);margin-bottom:8px;white-space:pre-wrap;word-break:break-word}
  .empty-state{text-align:center;padding:32px 16px;color:var(--vscode-descriptionForeground);font-size:11px}
  .section-label{font-size:10px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:var(--vscode-descriptionForeground);margin-bottom:5px}
</style>
</head>
<body>

<div class="tabs">
  <div class="tab active" data-page="run">Run</div>
  <div class="tab" data-page="status">Status</div>
  <div class="tab" data-page="history">History</div>
</div>

<!-- RUN PAGE -->
<div class="page active" id="page-run">
  <div class="input-box">
    <textarea id="featureInput" placeholder="Describe the feature to build…" rows="3"></textarea>
    <div class="btn-col">
      <button class="btn btn-primary" id="btnRun"      onclick="run(false)">▶ Run</button>
      <button class="btn btn-secondary" id="btnPlan"   onclick="run(true)">👁 Plan</button>
      <button class="btn btn-danger"   id="btnAbort"   onclick="abort()" style="display:none">⏹ Abort</button>
      <button class="btn btn-secondary" id="btnRollback" onclick="rollback()" style="display:none">↩ Undo</button>
    </div>
  </div>
  <div class="banner info" id="banner"></div>
</div>

<!-- STATUS PAGE -->
<div class="page" id="page-status">
  <div class="banner info" id="status-banner"></div>

  <div id="agents-section" style="display:none">
    <div class="section-label">Agents</div>
    <div class="agents" id="agent-cards"></div>
  </div>

  <div id="cost-section" style="display:none">
    <div class="section-label">Token cost</div>
    <table class="cost-table">
      <thead><tr><th>Agent</th><th>Tokens</th><th>Est. cost</th><th>Time</th></tr></thead>
      <tbody id="cost-rows"></tbody>
    </table>
  </div>

  <div id="gates-section" style="display:none">
    <div class="section-label">Quality gates</div>
    <div class="gate-chips" id="gate-chips"></div>
  </div>

  <div class="section-label">Log</div>
  <div class="log-box" id="log-box"></div>
</div>

<!-- HISTORY PAGE -->
<div class="page" id="page-history">
  <div id="run-list" class="run-list">
    <div class="empty-state">No runs yet. Start an orchestration to see history.</div>
  </div>
</div>

<script>
const vsc = acquireVsCodeApi();
function post(cmd, data) { vsc.postMessage({ command: cmd, ...data }); }

// ── Tab switching ──────────────────────────────────────
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab,.page').forEach(el => el.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('page-'+t.dataset.page).classList.add('active');
    if (t.dataset.page === 'history') post('load_history');
  });
});

// ── Actions ────────────────────────────────────────────
function run(withPlan) {
  const text = document.getElementById('featureInput').value.trim();
  if (!text) return;
  post('run', { featureRequest: text, withPlan });
}
function abort()    { post('abort'); }
function rollback() { post('rollback'); }

// ── Log ────────────────────────────────────────────────
const logBox = document.getElementById('log-box');
let logText = '';
function appendLog(msg) {
  logText += msg + '\n';
  logBox.textContent = logText;
  logBox.scrollTop = logBox.scrollHeight;
}
function clearLog() { logText = ''; logBox.textContent = ''; }

// ── Agent cards ─────────────────────────────────────────
const agentStates = {};
function renderAgentCards() {
  const container = document.getElementById('agent-cards');
  container.innerHTML = '';
  for (const [name, state] of Object.entries(agentStates)) {
    const div = document.createElement('div');
    div.className = 'agent-card ' + state.status;
    div.innerHTML =
      '<span>' + (state.emoji || '🤖') + '</span>' +
      '<span class="agent-name">' + name + '</span>' +
      '<span class="agent-status">' + statusLabel(state.status) + '</span>';
    container.appendChild(div);
  }
}
function statusLabel(s) {
  return { running:'running…', done:'✓ done', error:'✗ failed', pending:'waiting' }[s] || s;
}

// ── Banner ─────────────────────────────────────────────
function setBanner(id, msg, type) {
  const el = document.getElementById(id);
  el.className = 'banner show ' + type;
  el.textContent = msg;
}
function hideBanner(id) {
  document.getElementById(id).className = 'banner';
}

// ── Message handler ─────────────────────────────────────
window.addEventListener('message', ({ data: msg }) => {
  const p = msg.type;

  if (p === 'log')            appendLog(msg.msg);
  if (p === 'run_started') {
    clearLog();
    Object.assign(agentStates, {});
    document.getElementById('cost-rows').innerHTML = '';
    document.getElementById('gate-chips').innerHTML = '';
    document.getElementById('agents-section').style.display = 'block';
    document.getElementById('cost-section').style.display   = 'none';
    document.getElementById('gates-section').style.display  = 'none';
    document.getElementById('btnAbort').style.display = 'inline-block';
    document.getElementById('btnRun').disabled  = true;
    document.getElementById('btnPlan').disabled = true;
    setBanner('banner', '⏳ Orchestration in progress…', 'info');
    setBanner('status-banner', '🔄 Running…', 'info');
    // Switch to status tab
    document.querySelectorAll('.tab,.page').forEach(el => el.classList.remove('active'));
    document.querySelector('[data-page="status"]').classList.add('active');
    document.getElementById('page-status').classList.add('active');
  }

  if (p === 'plan_ready') {
    const plan = msg.plan;
    setBanner('status-banner', '📋 Plan ready — awaiting approval…', 'warn');
  }

  if (p === 'agent_started') {
    agentStates[msg.agent] = { status: 'running', emoji: msg.meta?.emoji };
    renderAgentCards();
  }

  if (p === 'agent_done') {
    if (agentStates[msg.agent]) agentStates[msg.agent].status = 'done';
    renderAgentCards();
  }

  if (p === 'gates_done') {
    const container = document.getElementById('gate-chips');
    container.innerHTML = '';
    document.getElementById('gates-section').style.display = 'block';
    for (const r of msg.results?.results || []) {
      const chip = document.createElement('span');
      chip.className = 'chip ' + (r.passed ? 'pass' : 'fail');
      chip.textContent = (r.passed ? '✓ ' : '✗ ') + r.name;
      container.appendChild(chip);
    }
    if (!msg.results?.results?.length) {
      const chip = document.createElement('span');
      chip.className = 'chip skip';
      chip.textContent = 'No gates configured';
      container.appendChild(chip);
    }
  }

  if (p === 'run_complete') {
    const run = msg.run;
    document.getElementById('btnAbort').style.display    = 'none';
    document.getElementById('btnRollback').style.display = run?.checkpoint ? 'inline-block' : 'none';
    document.getElementById('btnRun').disabled  = false;
    document.getElementById('btnPlan').disabled = false;
    setBanner('banner', '✅ Complete!', 'success');

    // Cost table
    if (run?.cost?.agents?.length) {
      document.getElementById('cost-section').style.display = 'block';
      const tbody = document.getElementById('cost-rows');
      tbody.innerHTML = '';
      for (const a of run.cost.agents) {
        const tr = document.createElement('tr');
        const dur = a.durationMs ? (a.durationMs/1000).toFixed(1)+'s' : '—';
        tr.innerHTML = '<td>' + a.agent + '</td><td>' + a.totalTokens.toLocaleString() + '</td><td>~$' + a.estimatedCost.toFixed(4) + '</td><td>' + dur + '</td>';
        tbody.appendChild(tr);
      }
      const tot = run.cost.totals;
      const tr = document.createElement('tr');
      tr.className = 'cost-total';
      const dur = run.durationMs ? (run.durationMs/1000).toFixed(1)+'s' : '—';
      tr.innerHTML = '<td>TOTAL</td><td>' + tot.totalTokens.toLocaleString() + '</td><td>~$' + tot.estimatedCost.toFixed(4) + '</td><td>' + dur + '</td>';
      tbody.appendChild(tr);
    }

    setBanner('status-banner', '✅ Orchestration complete', 'success');
    for (const a of Object.keys(agentStates)) {
      if (agentStates[a].status === 'running') agentStates[a].status = 'done';
    }
    renderAgentCards();
  }

  if (p === 'run_failed') {
    document.getElementById('btnAbort').style.display    = 'none';
    document.getElementById('btnRun').disabled  = false;
    document.getElementById('btnPlan').disabled = false;
    setBanner('banner', '❌ Run failed: ' + msg.error, 'error');
    setBanner('status-banner', '❌ Failed', 'error');
  }

  if (p === 'cancelled') {
    document.getElementById('btnAbort').style.display = 'none';
    document.getElementById('btnRun').disabled  = false;
    document.getElementById('btnPlan').disabled = false;
    setBanner('banner', '⏹ Cancelled', 'warn');
    setBanner('status-banner', '⏹ Cancelled', 'warn');
  }

  if (p === 'history') {
    const list = document.getElementById('run-list');
    list.innerHTML = '';
    if (!msg.runs?.length) {
      list.innerHTML = '<div class="empty-state">No runs yet.</div>';
      return;
    }
    for (const run of msg.runs) {
      const el = document.createElement('div');
      el.className = 'run-item';
      const dotClass = run.status === 'completed' ? 'dot-green' : run.status === 'failed' ? 'dot-red' : run.status === 'cancelled' ? 'dot-amber' : 'dot-gray';
      const since = timeSince(run.startedAt);
      const tokens = run.cost?.totals?.totalTokens?.toLocaleString() || '—';
      const cost   = run.cost?.totals?.estimatedCost != null ? '~$'+run.cost.totals.estimatedCost.toFixed(4) : '';
      el.innerHTML =
        '<div class="run-header">' +
          '<span class="status-dot ' + dotClass + '"></span>' +
          '<span class="run-feature">' + escHtml(run.featureRequest) + '</span>' +
          '<span class="run-time">' + since + '</span>' +
        '</div>' +
        '<div class="run-meta">' +
          '<span>' + run.id + '</span>' +
          '<span>' + tokens + ' tokens ' + cost + '</span>' +
          (run.qualityGates ? '<span>QA: ' + (run.qualityGates.passed ? '✅' : '❌') + '</span>' : '') +
        '</div>';
      list.appendChild(el);
    }
  }
});

function timeSince(iso) {
  if (!iso) return '—';
  const sec = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (sec < 60) return sec + 's ago';
  if (sec < 3600) return Math.floor(sec/60) + 'm ago';
  if (sec < 86400) return Math.floor(sec/3600) + 'h ago';
  return Math.floor(sec/86400) + 'd ago';
}
function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
</script>
</body>
</html>`;
  }
}

module.exports = { DashboardProvider };
