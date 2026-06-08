/**
 * Tests for agents.js
 */
const assert = require("assert");
const path   = require("path");
const fs     = require("fs");
const os     = require("os");
const { loadCustomAgents, AGENT_DESCRIPTIONS, AGENT_META } = require("../../src/agents");

describe("agents", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestra-agents-"));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  });

  it("returns empty agentModels when no config file", () => {
    const cfgPath = path.join(tmpDir, "config.json");
    const result = loadCustomAgents(cfgPath, fs, path);
    assert.deepStrictEqual(result.agentModels, {});
  });

  it("loads per-agent model from agents entry", () => {
    const cfgPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(cfgPath, JSON.stringify({
      agents: {
        backend: { description: "custom backend", emoji: "⚙️", model: "claude-opus-4-7" }
      }
    }));
    const result = loadCustomAgents(cfgPath, fs, path);
    assert.strictEqual(result.agentModels.backend, "claude-opus-4-7");
  });

  it("loads agentModels from top-level section", () => {
    const cfgPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(cfgPath, JSON.stringify({
      agentModels: {
        orchestrator: "claude-sonnet-4-6",
        manager: "claude-opus-4-7"
      }
    }));
    const result = loadCustomAgents(cfgPath, fs, path);
    assert.strictEqual(result.agentModels.orchestrator, "claude-sonnet-4-6");
    assert.strictEqual(result.agentModels.manager, "claude-opus-4-7");
  });

  it("merges per-agent models from both sources", () => {
    const cfgPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(cfgPath, JSON.stringify({
      agents: {
        backend: { model: "composer-2" }
      },
      agentModels: {
        frontend: "claude-opus-4-7"
      }
    }));
    const result = loadCustomAgents(cfgPath, fs, path);
    assert.strictEqual(result.agentModels.backend, "composer-2");
    assert.strictEqual(result.agentModels.frontend, "claude-opus-4-7");
  });

  it("loads custom agent description", () => {
    const cfgPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(cfgPath, JSON.stringify({
      agents: {
        devops: { description: "DevOps specialist", emoji: "🔧", name: "DevOps", color: "#a78bfa" }
      }
    }));
    loadCustomAgents(cfgPath, fs, path);
    assert.ok(AGENT_DESCRIPTIONS.devops, "Should add devops to AGENT_DESCRIPTIONS");
    assert.strictEqual(AGENT_DESCRIPTIONS.devops, "DevOps specialist");
  });

  it("handles missing config file gracefully", () => {
    const cfgPath = path.join(tmpDir, "nonexistent.json");
    assert.doesNotThrow(() => loadCustomAgents(cfgPath, fs, path));
  });

  it("handles malformed config gracefully", () => {
    const cfgPath = path.join(tmpDir, "config.json");
    fs.writeFileSync(cfgPath, "{ not valid json }");
    assert.doesNotThrow(() => {
      const result = loadCustomAgents(cfgPath, fs, path);
      assert.deepStrictEqual(result.agentModels, {});
    });
  });
});
