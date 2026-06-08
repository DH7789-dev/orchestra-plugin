/**
 * Orchestra Dashboard — professional webview with live task tree, cost tracker, history
 */

class DashboardProvider {
  constructor(extensionUri, onMessage) {
    this._extensionUri = extensionUri;
    this._onMessage    = onMessage;
    this._view         = null;
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtml();
    webviewView.webview.onDidReceiveMessage(msg => this._onMessage?.(msg));
    this._onMessage?.({ command: 'get_config' });
  }

  post(msg) {
    this._view?.webview.postMessage(msg);
  }

  _getHtml() {
    const crypto = require('crypto');
    const nonce = crypto.randomBytes(16).toString('base64');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
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

  /* Config tab */
  .config-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .config-label{flex:1;font-size:11px;color:var(--vscode-foreground)}
  .config-select{background:var(--vscode-input-background);border:1px solid var(--vscode-input-border,var(--vscode-panel-border));color:var(--vscode-input-foreground);padding:3px 6px;border-radius:3px;font-size:11px;cursor:pointer}
  .config-input{background:var(--vscode-input-background);border:1px solid var(--vscode-input-border,var(--vscode-panel-border));color:var(--vscode-input-foreground);padding:4px 6px;border-radius:3px;font-size:11px;width:100%;margin-bottom:4px}
  .config-textarea{background:var(--vscode-input-background);border:1px solid var(--vscode-input-border,var(--vscode-panel-border));color:var(--vscode-input-foreground);padding:4px 6px;border-radius:3px;font-size:11px;width:100%;resize:vertical;margin-bottom:4px;font-family:inherit}
  .add-agent-form{display:flex;flex-direction:column;gap:0}
  .toggle-row{display:flex;align-items:center;gap:8px;margin-bottom:5px;cursor:pointer}
  .toggle-label{flex:1;font-size:11px}
  .toggle-btn{width:32px;height:17px;border-radius:9px;border:none;cursor:pointer;position:relative;transition:background .15s;flex-shrink:0}
  .toggle-btn.on{background:var(--vscode-button-background)}
  .toggle-btn.off{background:var(--vscode-panel-border)}
  .toggle-btn::after{content:'';position:absolute;width:13px;height:13px;border-radius:50%;background:#fff;top:2px;transition:left .15s}
  .toggle-btn.on::after{left:17px}
  .toggle-btn.off::after{left:2px}
  .agent-entry{display:flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid var(--vscode-panel-border);border-radius:4px;margin-bottom:4px;font-size:11px}
  .agent-entry-info{flex:1}
  .agent-entry-name{font-weight:600}
  .agent-entry-desc{color:var(--vscode-descriptionForeground);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px}
  .btn-xs{padding:2px 7px;font-size:10px;border:none;border-radius:3px;cursor:pointer}
  .btn-edit{background:rgba(96,165,250,.12);color:#60a5fa}
  .btn-delete{background:rgba(248,113,113,.12);color:#f87171}
</style>
</head>
<body>

<div class="tabs">
  <div class="tab active" data-page="run">Run</div>
  <div class="tab" data-page="status">Status</div>
  <div class="tab" data-page="history">History</div>
  <div class="tab" data-page="config">Config</div>
</div>

<!-- RUN PAGE -->
<div class="page active" id="page-run">
  <div class="input-box">
    <textarea id="featureInput" placeholder="Describe the feature to build…" rows="3"></textarea>
    <div class="btn-col">
      <button class="btn btn-primary" id="btnRun">▶ Run</button>
      <button class="btn btn-secondary" id="btnPlan">👁 Plan</button>
      <button class="btn btn-danger"   id="btnAbort"    style="display:none">⏹ Abort</button>
      <button class="btn btn-secondary" id="btnRollback" style="display:none">↩ Undo</button>
    </div>
  </div>
  <div class="banner info" id="banner"></div>
</div>

<!-- STATUS PAGE -->
<div class="page" id="page-status">
  <div class="empty-state" id="status-empty">No active run. Start an orchestration from the Run tab.</div>
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

<!-- CONFIG PAGE -->
<div class="page" id="page-config">
  <div class="empty-state" id="config-loading">Loading configuration…</div>
  <div class="section-label">Global Models</div>
  <div class="config-row">
    <span class="config-label">Orchestrator</span>
    <select class="config-select" id="select-orchestratorModel">
      <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
      <option value="claude-opus-4-7">claude-opus-4-7</option>
      <option value="composer-2">composer-2</option>
      <option value="gpt-5.5">gpt-5.5</option>
    </select>
  </div>
  <div class="config-row">
    <span class="config-label">Agent (backend/front/test)</span>
    <select class="config-select" id="select-agentModel">
      <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
      <option value="claude-opus-4-7">claude-opus-4-7</option>
      <option value="composer-2">composer-2</option>
      <option value="gpt-5.5">gpt-5.5</option>
    </select>
  </div>
  <div class="config-row">
    <span class="config-label">Manager (review)</span>
    <select class="config-select" id="select-reviewModel">
      <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
      <option value="claude-opus-4-7">claude-opus-4-7</option>
      <option value="composer-2">composer-2</option>
      <option value="gpt-5.5">gpt-5.5</option>
    </select>
  </div>

  <div class="section-label" style="margin-top:12px">Per-Agent Model Overrides</div>
  <div id="per-agent-models"></div>

  <div class="section-label" style="margin-top:12px">Custom Agents</div>
  <div id="custom-agents-list"></div>

  <div class="section-label" style="margin-top:12px">Add / Edit Agent</div>
  <div class="add-agent-form">
    <input id="agent-name" placeholder="agent-id (e.g. devops)" class="config-input" />
    <input id="agent-displayname" placeholder="Display Name (e.g. DevOps)" class="config-input" />
    <div style="display:flex;gap:4px;margin-bottom:4px">
      <input id="agent-emoji" placeholder="Emoji" class="config-input" style="width:64px;margin-bottom:0" />
      <input id="agent-color" type="color" class="config-input" value="#888888" style="width:44px;padding:2px;margin-bottom:0;flex-shrink:0" />
      <select id="agent-model" class="config-select" style="flex:1">
        <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
        <option value="claude-opus-4-7">claude-opus-4-7</option>
        <option value="composer-2">composer-2</option>
        <option value="gpt-5.5">gpt-5.5</option>
      </select>
    </div>
    <textarea id="agent-description" placeholder="Agent instructions/description…" class="config-textarea" rows="3"></textarea>
    <button class="btn btn-primary" id="btnSaveAgent">Save Agent</button>
  </div>

  <div class="section-label" style="margin-top:12px">Settings</div>
  <div id="settings-toggles"></div>
</div>

<script nonce="${nonce}">
const vsc = acquireVsCodeApi();
function post(cmd, data) { vsc.postMessage({ command: cmd, ...data }); }

// ── Tab switching ──────────────────────────────────────
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab,.page').forEach(el => el.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('page-'+t.dataset.page).classList.add('active');
    if (t.dataset.page === 'history') post('load_history');
    if (t.dataset.page === 'config') post('get_config');
  });
});

// ── Static button listeners ─────────────────────────────
document.getElementById('btnRun').addEventListener('click', () => run(false));
document.getElementById('btnPlan').addEventListener('click', () => run(true));
document.getElementById('btnAbort').addEventListener('click', () => abort());
document.getElementById('btnRollback').addEventListener('click', () => rollback());
document.getElementById('btnSaveAgent').addEventListener('click', saveAgent);

// ── Static model select listeners ──────────────────────
['orchestratorModel', 'agentModel', 'reviewModel'].forEach(s => {
  document.getElementById('select-' + s).addEventListener('change', e => updateModel(s, e.target.value));
});

// ── Config event delegation ─────────────────────────────
document.getElementById('per-agent-models').addEventListener('change', e => {
  const sel = e.target.closest('select[data-agent-name]');
  if (sel) updateModel(null, sel.value, sel.dataset.agentName);
});
document.getElementById('custom-agents-list').addEventListener('click', e => {
  const editBtn = e.target.closest('.btn-edit[data-agent-name]');
  const delBtn  = e.target.closest('.btn-delete[data-agent-name]');
  if (editBtn) editAgent(editBtn.dataset.agentName);
  if (delBtn)  deleteAgent(delBtn.dataset.agentName);
});
document.getElementById('settings-toggles').addEventListener('click', e => {
  const btn = e.target.closest('.toggle-btn[data-key]');
  if (btn) toggleCfg(btn.dataset.key, btn.dataset.val === 'true');
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
  logText += msg;
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
    Object.keys(agentStates).forEach(k => delete agentStates[k]);
    document.getElementById('cost-rows').innerHTML = '';
    document.getElementById('gate-chips').innerHTML = '';
    document.getElementById('agents-section').style.display = 'block';
    document.getElementById('cost-section').style.display   = 'none';
    document.getElementById('gates-section').style.display  = 'none';
    document.getElementById('btnAbort').style.display = 'inline-block';
    document.getElementById('btnRun').disabled  = true;
    document.getElementById('btnPlan').disabled = true;
    document.getElementById('status-empty').style.display = 'none';
    setBanner('banner', '⏳ Orchestration in progress…', 'info');
    setBanner('status-banner', '🔄 Running…', 'info');
    // Switch to status tab
    document.querySelectorAll('.tab,.page').forEach(el => el.classList.remove('active'));
    document.querySelector('[data-page="status"]').classList.add('active');
    document.getElementById('page-status').classList.add('active');
  }

  if (p === 'plan_ready') {
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

    document.getElementById('status-empty').style.display = '';
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
    document.getElementById('status-empty').style.display = '';
    setBanner('banner', '❌ Run failed: ' + msg.error, 'error');
    setBanner('status-banner', '❌ Failed', 'error');
  }

  if (p === 'cancelled') {
    document.getElementById('btnAbort').style.display = 'none';
    document.getElementById('btnRun').disabled  = false;
    document.getElementById('btnPlan').disabled = false;
    document.getElementById('status-empty').style.display = '';
    setBanner('banner', '⏹ Cancelled', 'warn');
    setBanner('status-banner', '⏹ Cancelled', 'warn');
  }

  if (p === 'config') {
    renderConfig(msg);
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

// ── Config ─────────────────────────────────────────────
const MODELS = ["claude-sonnet-4-6", "claude-opus-4-7", "composer-2", "gpt-5.5"];
const BUILTIN_AGENTS = {
  backend:  { emoji: "⚙️",  name: "Backend",  color: "#2dd4bf" },
  frontend: { emoji: "🎨",  name: "Frontend", color: "#f87171" },
  test:     { emoji: "🧪",  name: "Test",     color: "#60a5fa" },
  manager:  { emoji: "📋",  name: "Manager",  color: "#fbbf24" },
};

let currentConfig = null;

function updateModel(setting, model, agentName) {
  if (setting) {
    post('update_model', { setting, model });
  } else {
    post('update_model', { agentName, model });
  }
}

function saveAgent() {
  const name = document.getElementById('agent-name').value.trim().toLowerCase().replace(/\\s+/g, '-');
  if (!name) return;
  post('save_agent', {
    name,
    displayName: document.getElementById('agent-displayname').value.trim() || name,
    emoji:       document.getElementById('agent-emoji').value.trim() || '🤖',
    color:       document.getElementById('agent-color').value,
    model:       document.getElementById('agent-model').value,
    description: document.getElementById('agent-description').value.trim(),
  });
  ['agent-name','agent-displayname','agent-emoji','agent-description'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

function deleteAgent(name) {
  if (!confirm('Delete agent "' + name + '"?')) return;
  post('delete_agent', { name });
}

function editAgent(name) {
  const agent = currentConfig?.customAgents?.[name];
  if (!agent) return;
  document.getElementById('agent-name').value        = name;
  document.getElementById('agent-displayname').value = agent.name || name;
  document.getElementById('agent-emoji').value       = agent.emoji || '🤖';
  document.getElementById('agent-color').value       = agent.color || '#888888';
  document.getElementById('agent-description').value = agent.description || '';
  if (agent.model) document.getElementById('agent-model').value = agent.model;
  document.getElementById('agent-name').focus();
}

function toggleCfg(setting, currentValue) {
  post('update_model', { setting, model: !currentValue });
  post('get_config');
}

function renderConfig(cfg) {
  currentConfig = cfg;
  document.getElementById('config-loading').style.display = 'none';

  ['orchestratorModel', 'agentModel', 'reviewModel'].forEach(s => {
    const el = document.getElementById('select-' + s);
    if (el && cfg[s]) el.value = cfg[s];
  });

  // Per-agent model overrides
  const perAgentDiv = document.getElementById('per-agent-models');
  perAgentDiv.innerHTML = '';
  const allAgents = { ...BUILTIN_AGENTS };
  for (const [n, a] of Object.entries(cfg.customAgents || {})) {
    allAgents[n] = { emoji: a.emoji || '🤖', name: a.name || n, color: a.color || '#888' };
  }
  for (const [name, meta] of Object.entries(allAgents)) {
    const currentModel = cfg.perAgentModels?.[name] || '';
    const row = document.createElement('div');
    row.className = 'config-row';
    const opts = '<option value="">— global default —</option>' +
      MODELS.map(m => '<option value="' + m + '"' + (currentModel === m ? ' selected' : '') + '>' + m + '</option>').join('');
    row.innerHTML =
      '<span class="config-label">' + escHtml((meta.emoji || '') + ' ' + (meta.name || name)) + '</span>' +
      '<select class="config-select" data-agent-name="' + escHtml(name) + '">' + opts + '</select>';
    perAgentDiv.appendChild(row);
  }

  // Custom agents list
  const customList = document.getElementById('custom-agents-list');
  customList.innerHTML = '';
  const entries = Object.entries(cfg.customAgents || {});
  if (!entries.length) {
    customList.innerHTML = '<div style="color:var(--vscode-descriptionForeground);font-size:11px;padding:4px 0">No custom agents yet.</div>';
  } else {
    for (const [name, agent] of entries) {
      const el = document.createElement('div');
      el.className = 'agent-entry';
      el.innerHTML =
        '<span>' + escHtml(agent.emoji || '🤖') + '</span>' +
        '<div class="agent-entry-info">' +
          '<div class="agent-entry-name">' + escHtml(agent.name || name) + '</div>' +
          '<div class="agent-entry-desc">' + escHtml(agent.description || '') + '</div>' +
        '</div>' +
        '<button class="btn btn-xs btn-edit" data-agent-name="' + escHtml(name) + '">Edit</button>' +
        '<button class="btn btn-xs btn-delete" data-agent-name="' + escHtml(name) + '">Del</button>';
      customList.appendChild(el);
    }
  }

  // Settings toggles
  const togglesDiv = document.getElementById('settings-toggles');
  togglesDiv.innerHTML = '';
  const settings = [
    { key: 'autoCheckpoint',      label: 'Git checkpoint before run' },
    { key: 'requirePlanApproval', label: 'Require plan approval' },
    { key: 'runQualityGates',     label: 'Run quality gates (test/lint)' },
  ];
  for (const s of settings) {
    const val = cfg[s.key] ?? true;
    const row = document.createElement('div');
    row.className = 'toggle-row';
    const btn = document.createElement('button');
    btn.className = 'toggle-btn ' + (val ? 'on' : 'off');
    btn.dataset.key = s.key;
    btn.dataset.val = String(val);
    const label = document.createElement('span');
    label.className = 'toggle-label';
    label.textContent = s.label;
    row.appendChild(label);
    row.appendChild(btn);
    togglesDiv.appendChild(row);
  }
}

function timeSince(iso) {
  if (!iso) return '—';
  const sec = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (sec < 60) return sec + 's ago';
  if (sec < 3600) return Math.floor(sec/60) + 'm ago';
  if (sec < 86400) return Math.floor(sec/3600) + 'h ago';
  return Math.floor(sec/86400) + 'd ago';
}
function escHtml(s) {
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
</script>
</body>
</html>`;
  }
}

module.exports = { DashboardProvider };
