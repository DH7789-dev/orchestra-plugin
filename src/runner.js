/**
 * Runner — core orchestration logic
 * Creates the Agent with subagents via @cursor/sdk and streams events
 */

// vscode is injected at runtime by the extension host — do not require() it here.
// It is passed in via opts.vscode instead.

const { AGENT_META, AGENT_DESCRIPTIONS, ORCHESTRATOR_SYSTEM } = require("./agents");

/**
 * Run a full orchestration pass.
 *
 * @param {object}   opts
 * @param {object}   opts.sdk            - resolved @cursor/sdk ({ Agent, CursorAgentError })
 * @param {string}   opts.apiKey
 * @param {string}   opts.featureRequest
 * @param {string}   opts.workspaceRoot
 * @param {object}   opts.config         - VS Code workspace config
 * @param {object}   opts.outputChannel
 * @param {object}   opts.statusBarItem
 * @returns {Promise<{ run: any, agent: any }>}  so caller can abort
 */
async function runOrchestration({
  sdk,
  apiKey,
  featureRequest,
  workspaceRoot,
  config,
  outputChannel,
  statusBarItem,
  vscode,
}) {
  const { Agent, CursorAgentError } = sdk;

  const orchModel   = config.get("orchestratorModel", "claude-sonnet-4-6");
  const agentModel  = config.get("agentModel",        "claude-sonnet-4-6");
  const reviewModel = config.get("reviewModel",       "claude-opus-4-7");
  const enabled     = config.get("enabledAgents",     { backend: true, frontend: true, test: true, manager: true });

  log(outputChannel, "");
  log(outputChannel, "═".repeat(62));
  log(outputChannel, "🎯  ORCHESTRA — Multi-Agent Orchestration");
  log(outputChannel, "═".repeat(62));
  log(outputChannel, `📋  Feature : ${featureRequest}`);
  log(outputChannel, `🤖  Models  : orchestrator=${orchModel} | agents=${agentModel} | review=${reviewModel}`);
  log(outputChannel, "");

  statusBarItem.text = "$(loading~spin) Orchestra: Creating agents…";

  // Build subagent definitions from enabled list
  const agentDefs = {};
  for (const [name, desc] of Object.entries(AGENT_DESCRIPTIONS)) {
    if (enabled[name] !== false) {
      agentDefs[name] = {
        model: { id: name === "manager" ? reviewModel : agentModel },
        description: desc,
      };
    }
  }

  log(outputChannel, `⏳  Creating orchestrator + ${Object.keys(agentDefs).length} subagents…`);

  const agent = await Agent.create({
    apiKey,
    name: "Orchestra",
    model: { id: orchModel },
    local: { cwd: workspaceRoot },
    agents: agentDefs,
  });

  log(outputChannel, `✅  Ready — delegating to: ${Object.keys(agentDefs).join(", ")}\n`);
  statusBarItem.text = "$(loading~spin) Orchestra: Orchestrating…";

  const prompt = `${ORCHESTRATOR_SYSTEM}\n\nFEATURE REQUEST:\n${featureRequest}\n\nStart by reading the project structure, then begin delegation.`;

  const run = await agent.send(prompt);

  // ── Stream ──
  let activeAgent = "orchestrator";

  for await (const event of run.stream()) {
    switch (event.type) {
      case "assistant":
        for (const block of (event.message?.content ?? [])) {
          if (block.type === "text") outputChannel.append(block.text);
        }
        break;

      case "tool_call": {
        const input = event.message?.input ?? {};
        const agentName = input.agent ?? input.name;
        if (agentName && agentName !== activeAgent) {
          activeAgent = agentName;
          const meta = AGENT_META[agentName] ?? { emoji: "🤖", name: agentName };
          log(outputChannel, "");
          log(outputChannel, "─".repeat(50));
          log(outputChannel, `${meta.emoji}  Delegating to ${meta.name} agent…`);
          log(outputChannel, "─".repeat(50));
          log(outputChannel, "");
          statusBarItem.text = `$(loading~spin) ${meta.emoji} ${meta.name}…`;
          vscode.window.setStatusBarMessage(`Orchestra: ${meta.emoji} ${meta.name} agent working…`, 6000);
        }
        break;
      }
    }
  }

  const result = await run.wait();

  log(outputChannel, "");
  log(outputChannel, "═".repeat(62));
  log(outputChannel, `✅  ORCHESTRATION COMPLETE`);
  log(outputChannel, `    Status   : ${result.status}`);
  if (result.durationMs) {
    log(outputChannel, `    Duration : ${(result.durationMs / 1000).toFixed(1)}s`);
  }
  log(outputChannel, "═".repeat(62));

  // Cleanup
  try { await agent[Symbol.asyncDispose](); } catch (_) {}

  return result;
}

function log(channel, line) {
  channel.appendLine(line);
}

module.exports = { runOrchestration };
