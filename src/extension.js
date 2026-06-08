/**
 * Orchestra v3 — Professional Multi-Agent Orchestrator for Cursor
 * Entry point: registers commands, dashboard, handles lifecycle.
 */

const vscode = require("vscode");
const path   = require("path");
const fs     = require("fs");

const { resolveSDK, installCommands }        = require("./sdk-resolver");
const { runOrchestration }                   = require("./runner");
const { DashboardProvider }                  = require("./dashboard");
const { rollback: gitRollback }              = require("./git-checkpoint");
const { loadRuns, loadRun }                  = require("./run-store");
const { EXAMPLE_CONFIG }                     = require("./agents");

let activeRunPromise  = null;
let activeRunResolve  = null;
let lastCheckpoint    = null;
let output            = null;
let statusBar         = null;
let dashboard         = null;

// ─────────────────────────────────────────────────────────
function activate(context) {
  output = vscode.window.createOutputChannel("Orchestra");

  // ── Dashboard sidebar ──
  dashboard = new DashboardProvider(context.extensionUri, handleDashboardMessage);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("orchestra.dashboard", dashboard, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // ── Status bar ──
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = "orchestra.showDashboard";
  statusBar.text    = "$(play) Orchestra";
  statusBar.tooltip = "Open Orchestra dashboard  (Cmd+Shift+O to run)";
  statusBar.show();
  context.subscriptions.push(statusBar);

  // ── Commands ─────────────────────────────────────────
  reg(context, "orchestra.run",           ()   => startRun(false));
  reg(context, "orchestra.runWithPlan",   ()   => startRun(true));
  reg(context, "orchestra.abort",         ()   => doAbort());
  reg(context, "orchestra.rollback",      ()   => doRollback());
  reg(context, "orchestra.configure",     ()   => doConfigure());
  reg(context, "orchestra.showDashboard", ()   => doShowDashboard());
  reg(context, "orchestra.showHistory",   ()   => doShowHistory());
}

function reg(context, id, fn) {
  context.subscriptions.push(vscode.commands.registerCommand(id, fn));
}

// ─────────────────────────────────────────────────────────
async function startRun(withPlan) {
  if (activeRunPromise) {
    vscode.window.showWarningMessage("Orchestra is already running. Use 'Orchestra: Abort' to cancel.");
    return;
  }

  // ── API key ──
  const config = vscode.workspace.getConfiguration("orchestra");
  let apiKey   = config.get("cursorApiKey", "");

  if (!apiKey) {
    apiKey = await vscode.window.showInputBox({
      prompt: "Enter your Cursor API Key (cursor.com/dashboard/integrations)",
      placeHolder: "crsr_…",
      password: true,
      ignoreFocusOut: true,
    });
    if (!apiKey) return;
    await config.update("cursorApiKey", apiKey, vscode.ConfigurationTarget.Global);
  }

  // ── Feature request (from input box if not triggered from dashboard) ──
  let featureRequest = null;

  // Check if user typed in the dashboard — if triggered from input box, show vscode prompt
  featureRequest = await vscode.window.showInputBox({
    prompt: "🎯 Describe the feature to build",
    placeHolder: "e.g. User authentication with OAuth Google, profile page, and full test coverage",
    ignoreFocusOut: true,
  });
  if (!featureRequest?.trim()) return;

  // ── Workspace ──
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage("Orchestra: Please open a folder first.");
    return;
  }

  // ── SDK ──
  const { sdk, candidates } = resolveSDK(workspaceRoot);
  if (!sdk) {
    await handleMissingSDK(workspaceRoot, candidates);
    return;
  }

  // ── Run ──
  output.show(true);
  doShowDashboard();

  statusBar.text = "$(loading~spin) Orchestra: Running…";

  const onEvent = (event) => {
    // Forward to dashboard
    dashboard.post(event);

    // Also log to output channel
    if (event.type === "log") {
      output.append(event.msg);
    }

    // Update status bar
    if (event.type === "agent_started") {
      const meta = event.meta;
      statusBar.text = `$(loading~spin) ${meta?.emoji || "🤖"} ${meta?.name || event.agent}…`;
    }
    if (event.type === "run_complete") {
      statusBar.text = "$(check) Orchestra: Done!";
      lastCheckpoint = event.run?.checkpoint || null;
      setTimeout(() => { statusBar.text = "$(play) Orchestra"; }, 8000);
      vscode.window.showInformationMessage(
        `Orchestra: Complete! ${event.run?.cost?.totals?.totalTokens?.toLocaleString() || "?"} tokens used.`,
        "Show Output"
      ).then(c => { if (c) output.show(); });
    }
    if (event.type === "run_failed") {
      statusBar.text = "$(error) Orchestra: Failed";
      setTimeout(() => { statusBar.text = "$(play) Orchestra"; }, 5000);
    }
    if (event.type === "cancelled") {
      statusBar.text = "$(play) Orchestra";
    }
  };

  activeRunPromise = runOrchestration({
    sdk,
    apiKey,
    featureRequest: featureRequest.trim(),
    workspaceRoot,
    config,
    vscode,
    onEvent,
    requirePlan: withPlan,
  }).then((result) => {
    if (result?.run?.checkpoint) lastCheckpoint = result.run.checkpoint;
  }).catch((err) => {
    handleRunError(err, sdk);
  }).finally(() => {
    activeRunPromise = null;
  });
}

async function handleDashboardMessage(msg) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  switch (msg.command) {
    case "run":
      if (msg.featureRequest) {
        // Triggered from dashboard input
        const config = vscode.workspace.getConfiguration("orchestra");
        let apiKey = config.get("cursorApiKey", "");
        if (!apiKey) {
          apiKey = await vscode.window.showInputBox({
            prompt: "Cursor API Key",
            placeHolder: "crsr_…",
            password: true,
          });
          if (!apiKey) return;
          await config.update("cursorApiKey", apiKey, vscode.ConfigurationTarget.Global);
        }
        if (!workspaceRoot) { vscode.window.showErrorMessage("Open a folder first."); return; }
        const { sdk, candidates } = resolveSDK(workspaceRoot);
        if (!sdk) { await handleMissingSDK(workspaceRoot, candidates); return; }

        output.show(true);
        statusBar.text = "$(loading~spin) Orchestra: Running…";

        const onEvent = (event) => {
          dashboard.post(event);
          if (event.type === "log") output.append(event.msg);
          if (event.type === "agent_started") {
            statusBar.text = `$(loading~spin) ${event.meta?.emoji || "🤖"} ${event.meta?.name || event.agent}…`;
          }
          if (event.type === "run_complete") {
            statusBar.text = "$(check) Orchestra: Done!";
            lastCheckpoint = event.run?.checkpoint;
            setTimeout(() => { statusBar.text = "$(play) Orchestra"; }, 8000);
          }
          if (event.type === "run_failed" || event.type === "cancelled") {
            statusBar.text = "$(play) Orchestra";
          }
        };

        const config2 = vscode.workspace.getConfiguration("orchestra");
        activeRunPromise = runOrchestration({
          sdk, apiKey, featureRequest: msg.featureRequest, workspaceRoot,
          config: config2, vscode, onEvent, requirePlan: msg.withPlan,
        }).catch(err => handleRunError(err, sdk)).finally(() => { activeRunPromise = null; });
      }
      break;

    case "abort":
      doAbort();
      break;

    case "rollback":
      doRollback();
      break;

    case "load_history":
      if (workspaceRoot) {
        const runs = loadRuns(workspaceRoot);
        dashboard.post({ type: "history", runs });
      }
      break;
  }
}

async function doAbort() {
  if (!activeRunPromise) {
    vscode.window.showInformationMessage("Orchestra: No run in progress.");
    return;
  }
  // Note: we can't cancel a Promise directly; we signal via the activeRunPromise reference
  activeRunPromise = null;
  statusBar.text = "$(play) Orchestra";
  output.appendLine("\n⏹  Aborted by user.");
  dashboard.post({ type: "cancelled", reason: "User aborted" });
  vscode.window.showInformationMessage("Orchestra: Aborted.");
}

async function doRollback() {
  if (!lastCheckpoint) {
    vscode.window.showWarningMessage("Orchestra: No checkpoint available. Run Orchestra first to enable rollback.");
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return;

  const confirm = await vscode.window.showWarningMessage(
    `Roll back to before run ${lastCheckpoint.runId}? This will undo all agent file changes.`,
    { modal: true },
    "Rollback",
    "Cancel"
  );

  if (confirm !== "Rollback") return;

  const log = (msg) => { output.appendLine(msg); dashboard.post({ type: "log", msg }); };
  const success = gitRollback(workspaceRoot, lastCheckpoint, log);

  if (success) {
    lastCheckpoint = null;
    vscode.window.showInformationMessage("Orchestra: Rollback complete. Files restored.");
    dashboard.post({ type: "log", msg: "\n✅ Rollback complete." });
  } else {
    vscode.window.showErrorMessage("Orchestra: Rollback failed. Check Output panel.");
  }
}

async function doConfigure() {
  const config  = vscode.workspace.getConfiguration("orchestra");
  const models  = ["claude-sonnet-4-6", "claude-opus-4-7", "composer-2", "gpt-5.5"];

  const items = [
    { label: "🔑 Cursor API Key",               detail: config.get("cursorApiKey") ? "Configured ✓" : "Not set ❌", value: "key" },
    { label: "🎯 Orchestrator model",            detail: config.get("orchestratorModel"),  value: "orch" },
    { label: "⚙️  Agent model (backend/front/test)", detail: config.get("agentModel"),    value: "agent" },
    { label: "📋 Review model (manager)",        detail: config.get("reviewModel"),        value: "review" },
    { label: "🔒 Git checkpoint",                detail: config.get("autoCheckpoint") ? "ON" : "OFF",       value: "checkpoint" },
    { label: "👁  Plan preview gate",             detail: config.get("requirePlanApproval") ? "ON" : "OFF",  value: "plan" },
    { label: "🔬 Quality gates (test/lint/build)", detail: config.get("runQualityGates") ? "ON" : "OFF",    value: "gates" },
    { label: "📁 Generate config file",          detail: "Create .orchestra/config.json", value: "genconfig" },
  ];

  const choice = await vscode.window.showQuickPick(items, { placeHolder: "Orchestra Configuration" });
  if (!choice) return;

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  switch (choice.value) {
    case "key": {
      const k = await vscode.window.showInputBox({ prompt: "Cursor API Key", placeHolder: "crsr_…", password: true });
      if (k) await config.update("cursorApiKey", k, vscode.ConfigurationTarget.Global);
      break;
    }
    case "orch":
    case "agent":
    case "review": {
      const field = { orch: "orchestratorModel", agent: "agentModel", review: "reviewModel" }[choice.value];
      const m = await vscode.window.showQuickPick(models, { placeHolder: `Current: ${config.get(field)}` });
      if (m) await config.update(field, m, vscode.ConfigurationTarget.Global);
      break;
    }
    case "checkpoint":
    case "plan":
    case "gates": {
      const field = { checkpoint: "autoCheckpoint", plan: "requirePlanApproval", gates: "runQualityGates" }[choice.value];
      await config.update(field, !config.get(field), vscode.ConfigurationTarget.Global);
      break;
    }
    case "genconfig": {
      if (!workspaceRoot) { vscode.window.showErrorMessage("Open a folder first."); break; }
      const cfgDir = path.join(workspaceRoot, ".orchestra");
      if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });
      const cfgFile = path.join(cfgDir, "config.json");
      if (!fs.existsSync(cfgFile)) {
        fs.writeFileSync(cfgFile, EXAMPLE_CONFIG, "utf-8");
        vscode.workspace.openTextDocument(cfgFile).then(doc => vscode.window.showTextDocument(doc));
      } else {
        vscode.workspace.openTextDocument(cfgFile).then(doc => vscode.window.showTextDocument(doc));
      }
      break;
    }
  }
}

function doShowDashboard() {
  vscode.commands.executeCommand("orchestra.dashboard.focus");
}

async function doShowHistory() {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) { vscode.window.showErrorMessage("Open a folder first."); return; }

  const runs = loadRuns(workspaceRoot);
  if (!runs.length) {
    vscode.window.showInformationMessage("Orchestra: No run history yet.");
    return;
  }

  const items = runs.map(r => ({
    label: `$(circle-filled) ${r.featureRequest}`.substring(0, 80),
    description: r.id,
    detail: `${r.status} · ${r.cost?.totals?.totalTokens?.toLocaleString() || "?"} tokens · ${new Date(r.startedAt).toLocaleString()}`,
    runId: r.id,
  }));

  const pick = await vscode.window.showQuickPick(items, { placeHolder: "Select a run to inspect" });
  if (!pick) return;

  const run  = loadRun(workspaceRoot, pick.runId);
  const doc  = await vscode.workspace.openTextDocument({
    content: JSON.stringify(run, null, 2),
    language: "json",
  });
  vscode.window.showTextDocument(doc);
}

// ─────────────────────────────────────────────────────────
async function handleMissingSDK(workspaceRoot, candidates) {
  output.show(true);
  output.appendLine("\n❌  @cursor/sdk not found. Searched:");
  for (const c of candidates) output.appendLine(`   - ${c}`);

  const cmds   = installCommands(workspaceRoot);
  const choice = await vscode.window.showErrorMessage(
    "Orchestra: @cursor/sdk not installed.",
    "Install in project", "Install globally", "Open docs"
  );

  if (choice === "Open docs") {
    vscode.env.openExternal(vscode.Uri.parse("https://cursor.com/docs/sdk"));
    return;
  }
  if (choice === "Install in project" || choice === "Install globally") {
    const terminal = vscode.window.createTerminal("Orchestra — SDK Setup");
    terminal.show();
    terminal.sendText(choice === "Install globally" ? cmds.globally : cmds.inProject);
    terminal.sendText('echo "\\n✅ Done! Run Orchestra again with Cmd+Shift+O."');
  }
}

function handleRunError(err, sdk) {
  const code = err?.code ?? "unknown";
  const msg  = err?.message ?? String(err);
  output.appendLine(`\n❌  [${code}] ${msg}`);

  if (code === "authentication_error") {
    output.appendLine("    → Verify your Cursor API Key: cursor.com/dashboard/integrations");
    vscode.window.showErrorMessage("Orchestra: Invalid API key.", "Configure").then(c => {
      if (c) doConfigure();
    });
  } else if (code === "rate_limit_error") {
    output.appendLine("    → Rate limit hit. Wait a moment.");
    vscode.window.showErrorMessage("Orchestra: Rate limit. Try again soon.");
  } else {
    vscode.window.showErrorMessage(`Orchestra: ${msg}`);
  }
  statusBar.text = "$(error) Orchestra: Failed";
  setTimeout(() => { statusBar.text = "$(play) Orchestra"; }, 6000);
}

// ─────────────────────────────────────────────────────────
function deactivate() {
  try { activeRunPromise = null; } catch (_) {}
}

module.exports = { activate, deactivate };
