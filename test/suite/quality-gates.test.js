/**
 * Tests for quality-gates.js
 */

const assert = require("assert");
const path   = require("path");
const fs     = require("fs");
const os     = require("os");
const { detectCommands, runAllGates } = require("../../src/quality-gates");

describe("quality-gates", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestra-gates-"));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  });

  it("returns no commands if no package.json", () => {
    const { available, hasPackageJson } = detectCommands(tmpDir);
    assert.strictEqual(hasPackageJson, false);
    assert.strictEqual(available.length, 0);
  });

  it("detects test command", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
      scripts: { test: "jest" }
    }));
    const { available } = detectCommands(tmpDir);
    assert.ok(available.some(g => g.name === "test"), "Should detect test");
  });

  it("detects all commands", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
      scripts: { test: "jest", lint: "eslint .", build: "tsc" }
    }));
    const { available } = detectCommands(tmpDir);
    assert.ok(available.some(g => g.name === "test"));
    assert.ok(available.some(g => g.name === "lint"));
    assert.ok(available.some(g => g.name === "build"));
  });

  it("ignores echo-only test scripts", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
      scripts: { test: "echo 'no tests'" }
    }));
    const { available } = detectCommands(tmpDir);
    assert.strictEqual(available.length, 0, "Echo scripts should be ignored");
  });

  it("runs gates and returns results", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
      scripts: { test: "node -e 'process.exit(0)'" }
    }));
    const logs = [];
    const result = runAllGates(tmpDir, (msg) => logs.push(msg));
    assert.ok(result.results.length > 0, "Should have results");
  });

  it("passes when no scripts configured", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({}));
    const logs = [];
    const result = runAllGates(tmpDir, (msg) => logs.push(msg));
    assert.strictEqual(result.passed, true, "Should pass with no scripts");
  });
});
