/**
 * Tests for cost-tracker.js
 */

const assert = require("assert");
const { createTracker } = require("../../src/cost-tracker");

describe("cost-tracker", () => {
  it("tracks tokens per agent", () => {
    const t = createTracker();
    t.startAgent("backend", "claude-sonnet-4-6");
    t.recordTokens("backend", 1000, 500);
    const stats = t.getAgentStats("backend");
    assert.strictEqual(stats.inputTokens, 1000);
    assert.strictEqual(stats.outputTokens, 500);
    assert.strictEqual(stats.totalTokens, 1500);
  });

  it("accumulates tokens across multiple calls", () => {
    const t = createTracker();
    t.startAgent("frontend", "claude-sonnet-4-6");
    t.recordTokens("frontend", 500, 200);
    t.recordTokens("frontend", 300, 100);
    const stats = t.getAgentStats("frontend");
    assert.strictEqual(stats.inputTokens, 800);
    assert.strictEqual(stats.outputTokens, 300);
  });

  it("calculates estimated cost", () => {
    const t = createTracker();
    t.startAgent("test", "claude-sonnet-4-6");
    t.recordTokens("test", 1_000_000, 0);  // 1M input tokens = $3
    const stats = t.getAgentStats("test");
    assert.ok(Math.abs(stats.estimatedCost - 3.0) < 0.001, "Should be ~$3");
  });

  it("totals across all agents", () => {
    const t = createTracker();
    t.startAgent("a", "claude-sonnet-4-6");
    t.recordTokens("a", 1000, 500);
    t.startAgent("b", "claude-sonnet-4-6");
    t.recordTokens("b", 2000, 1000);
    const summary = t.getSummary();
    assert.strictEqual(summary.totals.totalTokens, 4500);
    assert.strictEqual(summary.agents.length, 2);
  });

  it("returns null for unknown agent", () => {
    const t = createTracker();
    assert.strictEqual(t.getAgentStats("nonexistent"), null);
  });

  it("tracks duration", (done) => {
    const t = createTracker();
    t.startAgent("timed", "claude-sonnet-4-6");
    setTimeout(() => {
      t.finishAgent("timed");
      const stats = t.getAgentStats("timed");
      assert.ok(stats.durationMs >= 50, `Duration should be >= 50ms, got ${stats.durationMs}`);
      done();
    }, 60);
  });

  it("formats summary string", () => {
    const t = createTracker();
    t.startAgent("manager", "claude-opus-4-7");
    t.recordTokens("manager", 5000, 2000);
    const formatted = t.formatSummary();
    assert.ok(formatted.includes("Token Usage"), "Should include header");
    assert.ok(formatted.includes("manager"), "Should include agent name");
    assert.ok(formatted.includes("TOTAL"), "Should include total line");
  });
});
