/**
 * Tests for git-checkpoint.js
 */

const assert = require("assert");
const path   = require("path");
const fs     = require("fs");
const os     = require("os");
const { execSync } = require("child_process");
const { createCheckpoint, rollback, isGitRepo } = require("../../src/git-checkpoint");

describe("git-checkpoint", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestra-test-"));
    execSync("git init", { cwd: tmpDir, stdio: "pipe" });
    execSync("git config user.email 'test@test.com'", { cwd: tmpDir, stdio: "pipe" });
    execSync("git config user.name 'Test'", { cwd: tmpDir, stdio: "pipe" });
    // Initial commit
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Test");
    execSync("git add -A", { cwd: tmpDir, stdio: "pipe" });
    execSync("git commit -m 'initial'", { cwd: tmpDir, stdio: "pipe" });
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  });

  it("detects git repos correctly", () => {
    assert.strictEqual(isGitRepo(tmpDir), true);
    assert.strictEqual(isGitRepo(os.tmpdir()), false);
  });

  it("creates checkpoint on clean tree", () => {
    const logs = [];
    const cp = createCheckpoint(tmpDir, "test-001", (msg) => logs.push(msg));
    assert.ok(cp, "Should return checkpoint");
    assert.strictEqual(cp.runId, "test-001");
    assert.ok(cp.originalCommit, "Should have original commit");
  });

  it("creates checkpoint with uncommitted changes", () => {
    fs.writeFileSync(path.join(tmpDir, "new-file.ts"), "const x = 1;");
    const logs = [];
    const cp = createCheckpoint(tmpDir, "test-002", (msg) => logs.push(msg));
    assert.ok(cp, "Should return checkpoint");
    assert.ok(logs.some(l => l.includes("checkpoint created") || l.includes("checkpoint")));
  });

  it("rolls back to pre-run state", () => {
    // Create a checkpoint
    const logs = [];
    const cp = createCheckpoint(tmpDir, "test-003", (msg) => logs.push(msg));
    assert.ok(cp);

    // Simulate agent writing files
    fs.writeFileSync(path.join(tmpDir, "agent-output.ts"), "// created by agent");
    execSync("git add -A", { cwd: tmpDir, stdio: "pipe" });
    execSync("git commit -m 'agent output'", { cwd: tmpDir, stdio: "pipe" });

    // Rollback
    const rollbackLogs = [];
    const success = rollback(tmpDir, cp, (msg) => rollbackLogs.push(msg));
    assert.strictEqual(success, true);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, "agent-output.ts")), false, "Agent file should be removed after rollback");
  });

  it("returns null checkpoint for non-git dirs", () => {
    const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "no-git-"));
    try {
      const logs = [];
      const cp = createCheckpoint(nonGitDir, "test-004", (msg) => logs.push(msg));
      assert.strictEqual(cp, null, "Should return null for non-git dir");
    } finally {
      fs.rmSync(nonGitDir, { recursive: true });
    }
  });
});
