/**
 * Orchestra Runner — production-grade orchestration engine
 *
 * Features:
 * - Git checkpoint before run
 * - Plan preview and approval gate
 * - Cost tracking per agent
 * - Quality gates (test/lint/build) after agents
 * - Structured event emission for dashboard
 * - Run persistence
 */

const { AGENT_META, AGENT_DESCRIPTIONS, ORCHESTRATOR_SYSTEM, loadCustomAgents } = require("./agents");
const { createCheckpoint, finalizeCheckpoint } = require("./git-checkpoint");
const { runAllGates } = require("./quality-gates");
const { createTracker } = require("./cost-tracker");
const { saveRun, updateRun, generateRunId } = require("./run-store");
const path = require("path");
const fs   = require("fs");

/**
 * Main orchestration function.
 *
 * @param {object} opts
 * @param {object} opts.sdk              - resolved @cursor/sdk
 * @param {string} opts.apiKey
 * @param {string} opts.featureRequest
 * @param {string} opts.workspaceRoot
 * @param {object} opts.config           - VS Code config
 * @param {object} opts.vscode           - VS Code API
 * @param {function} opts.onEvent        - event callback for dashboard
 * @param {boolean} [opts.requirePlan]   - override: require plan approval
 * @returns {Promise<RunResult>}
 */
async function runOrchestration(opts) {
  const { sdk, apiKey, featureRequest, workspaceRoot, config, vscode, onEvent, requirePlan } = opts;
  const { Agent, CursorAgentError } = sdk;

  const runId  = generateRunId();
  const emit   = (type, data) => onEvent?.({ type, runId, ...data, ts: Date.now() });
  const tracker = createTracker();
  const log     = (msg) => emit("log", { msg });

  // ── Load custom config ──────────────────────────────
  const configFile = path.join(workspaceRoot, config.get("configFile", ".orchestra/config.json"));
  loadCustomAgents(configFile, fs, path);

  // ── Determine settings ──────────────────────────────
  const orchModel   = config.get("orchestratorModel", "claude-sonnet-4-6");
  const agentModel  = config.get("agentModel",        "claude-sonnet-4-6");
  const reviewModel = config.get("reviewModel",       "claude-opus-4-7");
  const doCheckpoint = config.get("autoCheckpoint",     true);
  const doPlanGate   = requirePlan ?? config.get("requirePlanApproval", true);
  const doGates      = config.get("runQualityGates",    true);

  // ── Initialize run record ───────────────────────────
  const run = {
    id: runId,
    featureRequest,
    startedAt: new Date().toISOString(),
    status: "running",
    checkpoint: null,
    plan: null,
    agents: {},
    qualityGates: null,
    cost: null,
    error: null,
    completedAt: null,
  };

  emit("run_started", { run });
  log(`\n${"═".repeat(62)}`);
  log(`🎯  ORCHESTRA v3 — Run ${runId}`);
  log(`${"═".repeat(62)}`);
  log(`📋  Feature  : ${featureRequest}`);
  log(`🤖  Models   : orch=${orchModel} | agent=${agentModel} | review=${reviewModel}`);
  log(`🔒  Checkpoint: ${doCheckpoint ? "enabled" : "disabled"}`);
  log(`👁   Plan gate : ${doPlanGate ? "enabled" : "disabled"}`);
  log(`🔬  Quality   : ${doGates ? "enabled" : "disabled"}`);
  log("");

  try {
    // ── Phase 1: Git checkpoint ─────────────────────────
    if (doCheckpoint) {
      emit("phase", { phase: "checkpoint", msg: "Creating git checkpoint..." });
      run.checkpoint = createCheckpoint(workspaceRoot, runId, log);
      if (run.checkpoint) saveRun(workspaceRoot, run);
    }

    // ── Phase 2: Build agent definitions ───────────────
    emit("phase", { phase: "setup", msg: "Setting up agents..." });
    const agentDefs = {};
    for (const [name, desc] of Object.entries(AGENT_DESCRIPTIONS)) {
      agentDefs[name] = {
        model: { id: name === "manager" ? reviewModel : agentModel },
        description: desc,
      };
    }

    log(`⏳  Creating orchestrator + ${Object.keys(agentDefs).length} subagents...`);
    tracker.startAgent("orchestrator", orchModel);

    const agent = await Agent.create({
      apiKey,
      name: "Orchestra",
      model: { id: orchModel },
      local: { cwd: workspaceRoot },
      agents: agentDefs,
    });

    log(`✅  Orchestrator ready\n`);
    emit("agents_ready", { agents: Object.keys(agentDefs) });

    // ── Phase 3: Plan preview gate ──────────────────────
    if (doPlanGate) {
      emit("phase", { phase: "planning", msg: "Generating execution plan..." });
      log(`⏳  Requesting execution plan...`);

      const planPrompt = `${ORCHESTRATOR_SYSTEM}

FEATURE REQUEST:
${featureRequest}

IMPORTANT: Before executing ANYTHING, first output a structured execution plan in this exact JSON format:

\`\`\`json
{
  "analysis": "Brief technical analysis of what needs to be built",
  "tasks": [
    {
      "agent": "backend|frontend|test|manager",
      "title": "Short task title",
      "description": "What this agent will do",
      "files": ["expected/output/files"]
    }
  ],
  "estimated_total_tokens": 30000,
  "risks": ["any technical risks or ambiguities"]
}
\`\`\`

Output ONLY the JSON plan first. Do not begin executing. Wait.`;

      const planRun = await agent.send(planPrompt);
      let planText = "";

      for await (const event of planRun.stream()) {
        if (event.type === "assistant") {
          for (const block of event.message?.content ?? []) {
            if (block.type === "text") planText += block.text;
          }
        }
      }
      await planRun.wait();

      // Parse the plan
      let parsedPlan = null;
      const jsonMatch = planText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try { parsedPlan = JSON.parse(jsonMatch[1]); } catch (_) {}
      }
      if (!parsedPlan) {
        try { parsedPlan = JSON.parse(planText.trim()); } catch (_) {}
      }

      run.plan = parsedPlan || { analysis: "Plan could not be parsed", tasks: [], raw: planText };
      saveRun(workspaceRoot, run);

      emit("plan_ready", { plan: run.plan, rawPlan: planText });
      log(`\n📋 Execution plan:`);
      log(`   Analysis: ${run.plan.analysis || "—"}`);
      if (run.plan.tasks?.length) {
        for (const t of run.plan.tasks) {
          log(`   ${AGENT_META[t.agent]?.emoji || "🤖"} ${t.agent}: ${t.title}`);
        }
      }
      log(`   Est. tokens: ~${run.plan.estimated_total_tokens?.toLocaleString() || "unknown"}`);

      // Wait for user approval
      const choice = await vscode.window.showInformationMessage(
        `Orchestra plan ready: ${run.plan.tasks?.length || "?"} tasks across ${new Set(run.plan.tasks?.map(t => t.agent) || []).size} agents.\n\nProceed with execution?`,
        { modal: true },
        "Execute",
        "Cancel"
      );

      if (choice !== "Execute") {
        run.status = "cancelled";
        run.completedAt = new Date().toISOString();
        saveRun(workspaceRoot, run);
        emit("cancelled", { reason: "User cancelled after plan review" });
        return { run, cancelled: true };
      }

      emit("plan_approved", {});
    }

    // ── Phase 4: Execute agents ─────────────────────────
    emit("phase", { phase: "executing", msg: "Executing agents..." });

    const execPrompt = `${ORCHESTRATOR_SYSTEM}

FEATURE REQUEST:
${featureRequest}

${run.plan ? `APPROVED PLAN:\n${JSON.stringify(run.plan, null, 2)}\n\nNow execute this plan exactly.` : "Begin execution now."}

Track carefully:
1. After each agent completes, note ALL files they created/modified
2. Pass this file list to the next agent for context
3. Give the test agent every file created by backend and frontend
4. Give the manager agent EVERY file from ALL previous agents`;

    let activeAgent = "orchestrator";

    const execRun = await agent.send(execPrompt);

    for await (const event of execRun.stream()) {
      switch (event.type) {
        case "assistant":
          for (const block of event.message?.content ?? []) {
            if (block.type === "text") log(block.text);
          }
          break;

        case "tool_call": {
          const input = event.message?.input ?? {};
          const agentName = input.agent ?? input.name;

          if (agentName && agentName !== activeAgent) {
            activeAgent = agentName;
            const meta = AGENT_META[agentName] ?? { emoji: "🤖", name: agentName };
            tracker.finishAgent(activeAgent);
            tracker.startAgent(agentName, agentName === "manager" ? reviewModel : agentModel);

            log(`\n${"─".repeat(50)}`);
            log(`${meta.emoji}  Delegating to ${meta.name} agent...`);
            log(`${"─".repeat(50)}`);

            run.agents[agentName] = { status: "running", startedAt: new Date().toISOString() };
            emit("agent_started", { agent: agentName, meta });
            updateRun(workspaceRoot, runId, { agents: run.agents });
          }
          break;
        }

        case "tool_result": {
          if (activeAgent && activeAgent !== "orchestrator") {
            tracker.finishAgent(activeAgent);
            run.agents[activeAgent] = {
              ...run.agents[activeAgent],
              status: "done",
              completedAt: new Date().toISOString(),
            };
            emit("agent_done", { agent: activeAgent });
            updateRun(workspaceRoot, runId, { agents: run.agents });
          }
          break;
        }
      }
    }

    const execResult = await execRun.wait();
    tracker.finishAgent("orchestrator");

    // ── Phase 5: Quality gates ──────────────────────────
    if (doGates) {
      emit("phase", { phase: "gates", msg: "Running quality gates..." });
      const gateResults = runAllGates(workspaceRoot, log);
      run.qualityGates = gateResults;
      updateRun(workspaceRoot, runId, { qualityGates: gateResults });
      emit("gates_done", { results: gateResults });
    }

    // ── Phase 6: Finalize ───────────────────────────────
    const costSummary = tracker.getSummary();
    run.cost = costSummary;
    run.status = "completed";
    run.completedAt = new Date().toISOString();
    run.durationMs = Date.now() - new Date(run.startedAt).getTime();
    saveRun(workspaceRoot, run);

    // Commit changes
    if (run.checkpoint) {
      finalizeCheckpoint(workspaceRoot, run.checkpoint,
        `Feature: ${featureRequest}\nRun: ${runId}\n${costSummary.totals.totalTokens} tokens`,
        log
      );
    }

    log(tracker.formatSummary());
    log(`\n${"═".repeat(62)}`);
    log(`✅  RUN COMPLETE — ${runId}`);
    log(`    Duration : ${(run.durationMs / 1000).toFixed(1)}s`);
    log(`    Tokens   : ${costSummary.totals.totalTokens.toLocaleString()}`);
    log(`    Est. cost: ~$${costSummary.totals.estimatedCost.toFixed(4)}`);
    if (run.qualityGates) {
      log(`    QA gates : ${run.qualityGates.passed ? "✅ all passed" : "❌ " + run.qualityGates.summary}`);
    }
    log(`${"═".repeat(62)}`);

    emit("run_complete", { run });

    try { await agent[Symbol.asyncDispose](); } catch (_) {}

    return { run };

  } catch (err) {
    run.status = "failed";
    run.error   = err.message;
    run.completedAt = new Date().toISOString();
    saveRun(workspaceRoot, run);
    emit("run_failed", { run, error: err.message });
    throw err;
  }
}

module.exports = { runOrchestration };
