/**
 * Tests for memory-store.js
 */

const assert = require("assert");
const fs     = require("fs");
const path   = require("path");
const os     = require("os");

const {
  readMemory,
  writeMemory,
  clearMemory,
  isMemoryValid,
  getMemoryStats,
  getMemoryContext,
} = require("../../src/memory-store");

const VALID_MEMORY = {
  version: 1,
  analyzedAt: "2026-06-09T10:00:00.000Z",
  projectName: "test-project",
  projectType: "node-api",
  language: "javascript",
  framework: "express",
  entryPoints: ["src/index.js"],
  techStack: ["Node.js", "Express"],
  keyFiles: [
    { path: "src/index.js", purpose: "Entry point" },
    { path: "src/routes.js", purpose: "API routes" },
  ],
  architecture: "MVC pattern",
  dependencies: { main: ["express"], dev: ["mocha"] },
  patterns: ["REST API"],
  conventions: ["camelCase"],
  testSetup: "Mocha",
  buildSystem: null,
  linting: null,
  summary: "A test project for unit testing.",
};

/** Write a valid memory file into tmpDir/.orchestra/memory.json */
function seedMemory(tmpDir, data) {
  const dir = path.join(tmpDir, ".orchestra");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "memory.json"), JSON.stringify(data, null, 2), "utf-8");
}

describe("readMemory", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestra-mem-"));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  });

  it("should return null when file does not exist", () => {
    assert.strictEqual(readMemory(tmpDir), null);
  });

  it("should return null when file contains invalid JSON", () => {
    const dir = path.join(tmpDir, ".orchestra");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "memory.json"), "{ not valid json }", "utf-8");
    assert.strictEqual(readMemory(tmpDir), null);
  });

  it("should return null when version field is missing", () => {
    const mem = { ...VALID_MEMORY };
    delete mem.version;
    seedMemory(tmpDir, mem);
    assert.strictEqual(readMemory(tmpDir), null);
  });

  it("should return null when version field is wrong", () => {
    seedMemory(tmpDir, { ...VALID_MEMORY, version: 99 });
    assert.strictEqual(readMemory(tmpDir), null);
  });

  it("should return null when analyzedAt field is missing", () => {
    const mem = { ...VALID_MEMORY };
    delete mem.analyzedAt;
    seedMemory(tmpDir, mem);
    assert.strictEqual(readMemory(tmpDir), null);
  });

  it("should return null when projectName field is missing", () => {
    const mem = { ...VALID_MEMORY };
    delete mem.projectName;
    seedMemory(tmpDir, mem);
    assert.strictEqual(readMemory(tmpDir), null);
  });

  it("should return valid memory object when file is correct", () => {
    seedMemory(tmpDir, VALID_MEMORY);
    const result = readMemory(tmpDir);
    assert.ok(result !== null, "should return an object, not null");
    assert.strictEqual(result.version, 1);
    assert.strictEqual(result.projectName, "test-project");
    assert.strictEqual(result.analyzedAt, "2026-06-09T10:00:00.000Z");
  });
});

describe("writeMemory", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestra-mem-"));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  });

  it("should create .orchestra directory if it does not exist", () => {
    const dir = path.join(tmpDir, ".orchestra");
    assert.ok(!fs.existsSync(dir), "precondition: dir should not exist");
    writeMemory(tmpDir, VALID_MEMORY);
    assert.ok(fs.existsSync(dir), ".orchestra dir should now exist");
  });

  it("should write valid JSON to memory.json", () => {
    writeMemory(tmpDir, VALID_MEMORY);
    const file = path.join(tmpDir, ".orchestra", "memory.json");
    assert.ok(fs.existsSync(file), "memory.json should exist");
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    assert.strictEqual(parsed.projectName, "test-project");
    assert.strictEqual(parsed.version, 1);
  });

  it("should overwrite existing memory file", () => {
    seedMemory(tmpDir, VALID_MEMORY);
    const updated = { ...VALID_MEMORY, projectName: "updated-project" };
    writeMemory(tmpDir, updated);
    const result = readMemory(tmpDir);
    assert.strictEqual(result.projectName, "updated-project");
  });

  it("should throw when workspaceRoot is not writable (simulate with invalid path)", () => {
    // Use a regular file as workspaceRoot — mkdirSync will fail inside a file
    const fakeTmpFile = path.join(tmpDir, "not-a-dir.txt");
    fs.writeFileSync(fakeTmpFile, "I am a file", "utf-8");
    assert.throws(
      () => writeMemory(fakeTmpFile, VALID_MEMORY),
      (err) => {
        assert.ok(err instanceof Error, "should throw an Error");
        assert.ok(err.message.startsWith("Memory write failed:"), `unexpected message: ${err.message}`);
        return true;
      }
    );
  });
});

describe("clearMemory", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestra-mem-"));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  });

  it("should return true and delete file when file exists", () => {
    seedMemory(tmpDir, VALID_MEMORY);
    const file = path.join(tmpDir, ".orchestra", "memory.json");
    assert.ok(fs.existsSync(file), "precondition: file should exist");
    const result = clearMemory(tmpDir);
    assert.strictEqual(result, true);
    assert.ok(!fs.existsSync(file), "file should have been deleted");
  });

  it("should return true when file does not exist (idempotent)", () => {
    const result = clearMemory(tmpDir);
    assert.strictEqual(result, true);
  });

  it("should return false on error (simulate by placing a directory at memory.json path)", () => {
    // Create a directory where memory.json should be — unlinkSync on a directory throws
    const orchestraDir = path.join(tmpDir, ".orchestra");
    fs.mkdirSync(orchestraDir, { recursive: true });
    // Place a sub-directory named "memory.json" so existsSync returns true but unlinkSync fails
    const fakeFile = path.join(orchestraDir, "memory.json");
    fs.mkdirSync(fakeFile, { recursive: true });
    const result = clearMemory(tmpDir);
    assert.strictEqual(result, false);
  });
});

describe("isMemoryValid", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestra-mem-"));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  });

  it("should return false when no memory file", () => {
    assert.strictEqual(isMemoryValid(tmpDir), false);
  });

  it("should return true when valid memory exists", () => {
    seedMemory(tmpDir, VALID_MEMORY);
    assert.strictEqual(isMemoryValid(tmpDir), true);
  });
});

describe("getMemoryStats", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestra-mem-"));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  });

  it("should return { hasMemory: false, analyzedAt: null, ... } when no memory", () => {
    const stats = getMemoryStats(tmpDir);
    assert.strictEqual(stats.hasMemory, false);
    assert.strictEqual(stats.analyzedAt, null);
    assert.strictEqual(stats.projectName, null);
    assert.strictEqual(stats.projectType, null);
    assert.strictEqual(stats.fileCount, 0);
    assert.deepStrictEqual(stats.techStack, []);
  });

  it("should return { hasMemory: true, ... } with correct fields when memory exists", () => {
    seedMemory(tmpDir, VALID_MEMORY);
    const stats = getMemoryStats(tmpDir);
    assert.strictEqual(stats.hasMemory, true);
    assert.strictEqual(stats.analyzedAt, "2026-06-09T10:00:00.000Z");
    assert.strictEqual(stats.projectName, "test-project");
    assert.strictEqual(stats.projectType, "node-api");
    assert.strictEqual(stats.fileCount, 2);
    assert.deepStrictEqual(stats.techStack, ["Node.js", "Express"]);
  });

  it("should handle missing optional fields gracefully", () => {
    const minimal = {
      version: 1,
      analyzedAt: "2026-06-09T10:00:00.000Z",
      projectName: "minimal-project",
      // no projectType, keyFiles, or techStack
    };
    seedMemory(tmpDir, minimal);
    const stats = getMemoryStats(tmpDir);
    assert.strictEqual(stats.hasMemory, true);
    assert.strictEqual(stats.projectType, null);
    assert.strictEqual(stats.fileCount, 0);
    assert.deepStrictEqual(stats.techStack, []);
  });
});

describe("getMemoryContext", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestra-mem-"));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  });

  it("should return empty string when no memory", () => {
    assert.strictEqual(getMemoryContext(tmpDir), "");
  });

  it("should return string containing project name", () => {
    seedMemory(tmpDir, VALID_MEMORY);
    const ctx = getMemoryContext(tmpDir);
    assert.ok(ctx.includes("test-project"), "should include project name");
  });

  it("should include === PROJECT MEMORY === header and footer", () => {
    seedMemory(tmpDir, VALID_MEMORY);
    const ctx = getMemoryContext(tmpDir);
    assert.ok(ctx.includes("=== PROJECT MEMORY"), "should have header");
    assert.ok(ctx.includes("=== END PROJECT MEMORY ==="), "should have footer");
  });

  it("should limit keyFiles to 15 entries", () => {
    const manyFiles = Array.from({ length: 25 }, (_, i) => ({
      path: `src/file${i}.js`,
      purpose: `File number ${i}`,
    }));
    seedMemory(tmpDir, { ...VALID_MEMORY, keyFiles: manyFiles });
    const ctx = getMemoryContext(tmpDir);
    // Only first 15 files should appear
    assert.ok(ctx.includes("src/file14.js"), "file14 should be present (index 14)");
    assert.ok(!ctx.includes("src/file15.js"), "file15 should be absent (index 15, beyond limit)");
  });

  it("should truncate summary to 200 characters", () => {
    const longSummary = "A".repeat(300);
    seedMemory(tmpDir, { ...VALID_MEMORY, summary: longSummary });
    const ctx = getMemoryContext(tmpDir);
    // The context line is "Summary: " + up to 200 chars of summary
    const summaryLine = ctx.split("\n").find(l => l.startsWith("Summary:"));
    assert.ok(summaryLine, "should have a Summary line");
    const summaryValue = summaryLine.replace("Summary: ", "");
    assert.strictEqual(summaryValue.length, 200, `summary should be exactly 200 chars, got ${summaryValue.length}`);
  });
});
