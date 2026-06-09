/**
 * Tests for analyzer-agent.js (module-level exports only — no SDK required)
 */

const assert = require("assert");
const { ANALYZER_SYSTEM, ANALYZER_PROMPT, runAnalysis } = require("../../src/analyzer-agent");

describe("analyzer-agent module", () => {
  it("should export ANALYZER_SYSTEM as a non-empty string", () => {
    assert.strictEqual(typeof ANALYZER_SYSTEM, "string");
    assert.ok(ANALYZER_SYSTEM.length > 0, "ANALYZER_SYSTEM should not be empty");
  });

  it("should export ANALYZER_PROMPT as a non-empty string", () => {
    assert.strictEqual(typeof ANALYZER_PROMPT, "string");
    assert.ok(ANALYZER_PROMPT.length > 0, "ANALYZER_PROMPT should not be empty");
  });

  it("should export runAnalysis as a function", () => {
    assert.strictEqual(typeof runAnalysis, "function");
  });

  it("ANALYZER_SYSTEM should mention JSON output", () => {
    assert.ok(
      ANALYZER_SYSTEM.toLowerCase().includes("json"),
      "ANALYZER_SYSTEM should mention JSON"
    );
  });

  it("ANALYZER_PROMPT should include version field in schema", () => {
    assert.ok(
      ANALYZER_PROMPT.includes('"version"'),
      'ANALYZER_PROMPT should include "version" field'
    );
  });

  it("ANALYZER_PROMPT should include all required fields (projectName, techStack, keyFiles, etc.)", () => {
    const requiredFields = ["projectName", "techStack", "keyFiles", "analyzedAt", "architecture", "dependencies"];
    for (const field of requiredFields) {
      assert.ok(
        ANALYZER_PROMPT.includes(`"${field}"`),
        `ANALYZER_PROMPT should include field "${field}"`
      );
    }
  });
});
