/**
 * Orchestra — Multi-Agent Orchestrator for Cursor
 * Entry point: registers commands, status bar, and output channel.
 */

const vscode = require("vscode");
const { resolveSDK, installCommands } = require("./sdk-resolver");
const { runOrchestration } = require("./runner");

/** @type {any}  current run (for abort) */
let activeRun  = null;
/** @type {any}  output channel */
let output     = null;
/** @type {any}  status bar item */
let statusBar  = null;

// ─────────────────────────────────────────────────────────
function activate(context) {
  output = vscode.window.createOutputChannel("Orchestra");

  // ── Status bar ──
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = "orchestra.run";
  statusBar.text    = "$(play) Orchestra";
  statusBar.tooltip = "Run multi-agent orchestration  (Cmd+Shift+O)";
  statusBar.show();
  context.subscriptions.push(statusBar);

  // ── Command: Run ──────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("orchestra.run", async () => {
      if (activeRun) {
        vscode.window.showWarningMessage("Orchestra is already running. Use 'Orchestra: Abort' to cancel.");
        return;
      }

      const config = vscode.workspace.getConfiguration("orchestra");

      // 1. API key
      let apiKey = config.get("cursorApiKey", "");
      if (!apiKey) {
        apiKey = await vscode.window.showInputBox({
          prompt:       "Enter your Cursor API Key",
          placeHolder:  "crsr_…",
          password:     true,
          ignoreFocusOut: true,
        });
        if (!apiKey) return;
        await config.update("cursorApiKey", apiKey, vscode.ConfigurationTarget.Global);
      }

      // 2. Feature request
      const featureRequest = await vscode.window.showInputBox({
        prompt:       "🎯 Describe the feature to build",
        placeHolder:  "e.g. User auth with OAuth Google, profile page, and tests",
        ignoreFocusOut: true,
      });
      if (!featureRequest?.trim()) return;

      // 3. Workspace
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        vscode.window.showErrorMessage("Orchestra: Please open a folder first.");
        return;
      }

      // 4. Resolve SDK
      const { sdk, candidates } = resolveSDK(workspaceRoot);
      if (!sdk) {
        await handleMissingSDK(workspaceRoot, candidates, output);
        return;
      }

      // 5. Run
      output.show(true);
      statusBar.text = "$(loading~spin) Orchestra: Starting…";

      try {
        const run = runOrchestration({
          sdk,
          apiKey,
          featureRequest: featureRequest.trim(),
          workspaceRoot,
          config,
          outputChannel: output,
          statusBarItem: statusBar,
          vscode,
        });

        activeRun = run;
        await run;

        statusBar.text = "$(check) Orchestra: Done!";
        vscode.window.showInformationMessage("Orchestra: Completed! Check the Output panel.");
        setTimeout(() => { statusBar.text = "$(play) Orchestra"; }, 8000);

      } catch (err) {
        handleError(err, sdk, output, statusBar);
      } finally {
        activeRun = null;
      }
    })
  );

  // ── Command: Configure ────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("orchestra.configure", async () => {
      const config  = vscode.workspace.getConfiguration("orchestra");
      const models  = ["claude-sonnet-4-6", "claude-opus-4-7", "composer-2", "gpt-5.5"];

      const choice = await vscode.window.showQuickPick([
        { label: "🔑 Cursor API Key",                  detail: config.get("cursorApiKey") ? "Configured ✓" : "Not set",         value: "key"    },
        { label: "🎯 Orchestrator model",              detail: config.get("orchestratorModel"),                                   value: "orch"   },
        { label: "⚙️  Agent model (backend/front/test)", detail: config.get("agentModel"),                                        value: "agent"  },
        { label: "📋 Review model (manager)",          detail: config.get("reviewModel"),                                        value: "review" },
      ], { placeHolder: "Orchestra — Settings" });

      if (!choice) return;

      if (choice.value === "key") {
        const k = await vscode.window.showInputBox({ prompt: "Cursor API Key", placeHolder: "crsr_…", password: true });
        if (k) await config.update("cursorApiKey", k, vscode.ConfigurationTarget.Global);
        return;
      }

      const field = { orch: "orchestratorModel", agent: "agentModel", review: "reviewModel" }[choice.value];
      const m = await vscode.window.showQuickPick(models, { placeHolder: `Current: ${config.get(field)}` });
      if (m) await config.update(field, m, vscode.ConfigurationTarget.Global);
    })
  );

  // ── Command: Abort ────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("orchestra.abort", async () => {
      if (!activeRun) {
        vscode.window.showInformationMessage("Orchestra: No run in progress.");
        return;
      }
      try {
        if (typeof activeRun?.cancel === "function") await activeRun.cancel();
      } catch (_) {}
      activeRun = null;
      statusBar.text = "$(play) Orchestra";
      output.appendLine("\n⏹  Aborted by user.");
      vscode.window.showInformationMessage("Orchestra: Run aborted.");
    })
  );
}

// ─────────────────────────────────────────────────────────
function deactivate() {
  if (activeRun) {
    try { activeRun?.cancel?.(); } catch (_) {}
  }
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

async function handleMissingSDK(workspaceRoot, candidates, out) {
  out.show(true);
  out.appendLine("\n❌  @cursor/sdk not found.");
  out.appendLine("    Searched in:");
  for (const c of candidates) out.appendLine(`      - ${c}`);
  out.appendLine("");
  out.appendLine("    Install it with one of the options below, then run Orchestra again.");

  const cmds = installCommands(workspaceRoot);
  const choice = await vscode.window.showErrorMessage(
    "Orchestra: @cursor/sdk not installed.",
    "Install in project",
    "Install globally",
    "How to install"
  );

  if (!choice) return;

  if (choice === "How to install") {
    vscode.env.openExternal(vscode.Uri.parse("https://cursor.com/docs/sdk"));
    return;
  }

  const terminal = vscode.window.createTerminal("Orchestra — SDK Setup");
  terminal.show();
  terminal.sendText(choice === "Install globally" ? cmds.globally : cmds.inProject);
  terminal.sendText('echo "\\n✅ SDK installed! Run Orchestra again with Cmd+Shift+O."');
}

function handleError(err, sdk, out, bar) {
  const code = err?.code ?? "unknown";
  const msg  = err?.message ?? String(err);

  out.appendLine(`\n❌  [${code}] ${msg}`);

  if (code === "authentication_error") {
    out.appendLine("    → Check your Cursor API Key at https://cursor.com/dashboard/integrations");
    vscode.window.showErrorMessage("Orchestra: Invalid API key.", "Open Settings").then(c => {
      if (c) vscode.commands.executeCommand("orchestra.configure");
    });
  } else if (code === "rate_limit_error") {
    out.appendLine("    → Rate limit hit. Wait a moment and try again.");
    vscode.window.showErrorMessage("Orchestra: Rate limit exceeded. Try again soon.");
  } else {
    vscode.window.showErrorMessage(`Orchestra: ${msg}`);
  }

  bar.text = "$(error) Orchestra: Failed";
  setTimeout(() => { bar.text = "$(play) Orchestra"; }, 6000);
}

module.exports = { activate, deactivate };
