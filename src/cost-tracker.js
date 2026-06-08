/**
 * Cost Tracker — tracks token consumption and estimated cost per agent
 * Based on Cursor's approximate pricing (same rates as Anthropic)
 */

// Approximate cost per 1M tokens (USD) — update as pricing changes
const PRICING = {
  "claude-sonnet-4-6": { input: 3.00,  output: 15.00 },
  "claude-opus-4-7":   { input: 15.00, output: 75.00 },
  "composer-2":        { input: 0.50,  output: 1.50  },
  "gpt-5.5":           { input: 10.00, output: 30.00 },
};

function createTracker() {
  const sessions = {};  // agentName → { inputTokens, outputTokens, model }
  const timings  = {};  // agentName → { start, end }

  return {
    startAgent(agentName, model) {
      sessions[agentName] = { inputTokens: 0, outputTokens: 0, model };
      timings[agentName]  = { start: Date.now(), end: null };
    },

    recordTokens(agentName, inputTokens = 0, outputTokens = 0) {
      if (!sessions[agentName]) return;
      sessions[agentName].inputTokens  += inputTokens;
      sessions[agentName].outputTokens += outputTokens;
    },

    finishAgent(agentName) {
      if (timings[agentName]) timings[agentName].end = Date.now();
    },

    getAgentStats(agentName) {
      const s = sessions[agentName];
      const t = timings[agentName];
      if (!s) return null;

      const pricing = PRICING[s.model] || PRICING["claude-sonnet-4-6"];
      const cost = (s.inputTokens / 1_000_000) * pricing.input
                 + (s.outputTokens / 1_000_000) * pricing.output;

      return {
        agent:        agentName,
        model:        s.model,
        inputTokens:  s.inputTokens,
        outputTokens: s.outputTokens,
        totalTokens:  s.inputTokens + s.outputTokens,
        estimatedCost: cost,
        durationMs:   t?.end && t?.start ? t.end - t.start : null,
      };
    },

    getSummary() {
      const agentNames = Object.keys(sessions);
      const stats = agentNames.map(n => this.getAgentStats(n)).filter(Boolean);

      const totals = stats.reduce((acc, s) => ({
        inputTokens:   acc.inputTokens  + s.inputTokens,
        outputTokens:  acc.outputTokens + s.outputTokens,
        totalTokens:   acc.totalTokens  + s.totalTokens,
        estimatedCost: acc.estimatedCost + s.estimatedCost,
      }), { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 });

      return { agents: stats, totals };
    },

    formatSummary() {
      const { agents, totals } = this.getSummary();
      const lines = ["\n📊 Token Usage Summary:"];
      for (const a of agents) {
        const dur = a.durationMs ? ` (${(a.durationMs / 1000).toFixed(1)}s)` : "";
        lines.push(`   ${a.agent.padEnd(14)} ${String(a.totalTokens).padStart(6)} tokens  ~$${a.estimatedCost.toFixed(4)}${dur}`);
      }
      lines.push(`   ${"TOTAL".padEnd(14)} ${String(totals.totalTokens).padStart(6)} tokens  ~$${totals.estimatedCost.toFixed(4)}`);
      return lines.join("\n");
    }
  };
}

module.exports = { createTracker };
