/**
 * Tests for run-store.js
 */

const assert = require("assert");
const path   = require("path");
const fs     = require("fs");
const os     = require("os");
const { saveRun, loadRuns, loadRun, updateRun, generateRunId } = require("../../src/run-store");

describe("run-store", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestra-store-"));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  });

  it("generates unique run IDs", () => {
    const id1 = generateRunId();
    const id2 = generateRunId();
    assert.ok(id1.length > 8, "ID should be non-trivial");
    assert.notStrictEqual(id1, id2, "IDs should be unique");
  });

  it("saves and loads a run", () => {
    const run = { id: "test-001", featureRequest: "Test feature", startedAt: new Date().toISOString(), status: "completed" };
    saveRun(tmpDir, run);
    const loaded = loadRun(tmpDir, "test-001");
    assert.deepStrictEqual(loaded, run);
  });

  it("loads all runs sorted by date", () => {
    const run1 = { id: "a-001", featureRequest: "A", startedAt: new Date(Date.now() - 10000).toISOString(), status: "completed" };
    const run2 = { id: "b-002", featureRequest: "B", startedAt: new Date().toISOString(), status: "completed" };
    saveRun(tmpDir, run1);
    saveRun(tmpDir, run2);
    const runs = loadRuns(tmpDir);
    assert.strictEqual(runs[0].id, "b-002", "Newest should be first");
    assert.strictEqual(runs[1].id, "a-001");
  });

  it("updates a run", () => {
    const run = { id: "u-001", featureRequest: "Update test", startedAt: new Date().toISOString(), status: "running" };
    saveRun(tmpDir, run);
    updateRun(tmpDir, "u-001", { status: "completed" });
    const updated = loadRun(tmpDir, "u-001");
    assert.strictEqual(updated.status, "completed");
    assert.strictEqual(updated.featureRequest, "Update test", "Should preserve other fields");
  });

  it("returns null for non-existent run", () => {
    const result = loadRun(tmpDir, "nonexistent-999");
    assert.strictEqual(result, null);
  });

  it("returns empty array for no runs", () => {
    const runs = loadRuns(tmpDir);
    assert.deepStrictEqual(runs, []);
  });
});
