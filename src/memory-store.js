/**
 * Memory Store — project analysis cache at .orchestra/memory.json
 *
 * Stores a structured summary of the workspace so the orchestrator
 * can skip re-reading the project on every run.
 */

const fs   = require("fs");
const path = require("path");

const MEMORY_VERSION = 1;
const MEMORY_FILE    = path.join(".orchestra", "memory.json");

function getMemoryPath(workspaceRoot) {
  return path.join(workspaceRoot, MEMORY_FILE);
}

/**
 * Read memory from .orchestra/memory.json.
 * Returns null if file doesn't exist or is invalid.
 * @param {string} workspaceRoot
 * @returns {object|null}
 */
function readMemory(workspaceRoot) {
  try {
    const file = getMemoryPath(workspaceRoot);
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf-8");
    const data = JSON.parse(raw);
    // Basic structural validation
    if (!data || typeof data !== "object") return null;
    if (data.version !== MEMORY_VERSION)   return null;
    if (!data.analyzedAt || !data.projectName) return null;
    return data;
  } catch (_) {
    return null;
  }
}

/**
 * Write memory to .orchestra/memory.json.
 * @param {string} workspaceRoot
 * @param {object} data - full memory object
 */
function writeMemory(workspaceRoot, data) {
  try {
    const dir  = path.join(workspaceRoot, ".orchestra");
    const file = getMemoryPath(workspaceRoot);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    // Non-fatal; caller decides whether to surface the error
    throw new Error(`Memory write failed: ${err.message}`);
  }
}

/**
 * Delete .orchestra/memory.json.
 * @param {string} workspaceRoot
 * @returns {boolean} success
 */
function clearMemory(workspaceRoot) {
  try {
    const file = getMemoryPath(workspaceRoot);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Returns true if memory exists and has valid content.
 * @param {string} workspaceRoot
 * @returns {boolean}
 */
function isMemoryValid(workspaceRoot) {
  return readMemory(workspaceRoot) !== null;
}

/**
 * Returns a stats object for the UI.
 * @param {string} workspaceRoot
 * @returns {{ hasMemory: boolean, analyzedAt: string|null, projectName: string|null, projectType: string|null, fileCount: number, techStack: string[] }}
 */
function getMemoryStats(workspaceRoot) {
  const mem = readMemory(workspaceRoot);
  if (!mem) {
    return { hasMemory: false, analyzedAt: null, projectName: null, projectType: null, fileCount: 0, techStack: [] };
  }
  return {
    hasMemory:   true,
    analyzedAt:  mem.analyzedAt  || null,
    projectName: mem.projectName || null,
    projectType: mem.projectType || null,
    fileCount:   Array.isArray(mem.keyFiles) ? mem.keyFiles.length : 0,
    techStack:   Array.isArray(mem.techStack) ? mem.techStack : [],
  };
}

/**
 * Returns a compact string summary to inject into LLM prompts.
 * Stays token-efficient: max 15 key files, summary trimmed to 200 chars.
 * @param {string} workspaceRoot
 * @returns {string}
 */
function getMemoryContext(workspaceRoot) {
  const mem = readMemory(workspaceRoot);
  if (!mem) return "";

  const analyzedDate = mem.analyzedAt
    ? new Date(mem.analyzedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "unknown";

  const techStack   = Array.isArray(mem.techStack)  ? mem.techStack.join(", ")  : "unknown";
  const entryPoints = Array.isArray(mem.entryPoints) ? mem.entryPoints.join(", ") : "unknown";

  const keyFilesRaw = Array.isArray(mem.keyFiles) ? mem.keyFiles : [];
  const keyFilesStr = keyFilesRaw
    .slice(0, 15)
    .map(f => `  ${f.path}: ${f.purpose}`)
    .join("\n");

  const patterns = [
    ...(Array.isArray(mem.patterns)     ? mem.patterns     : []),
    ...(Array.isArray(mem.conventions)  ? mem.conventions  : []),
  ].join(", ") || "none";

  const mainDeps = (mem.dependencies?.main ?? []).slice(0, 20).join(", ") || "none";

  const summary = typeof mem.summary === "string"
    ? mem.summary.substring(0, 200)
    : "";

  const lines = [
    `=== PROJECT MEMORY (analyzed: ${analyzedDate}) ===`,
    `Project: ${mem.projectName || "unknown"} (${mem.projectType || "unknown"}) | Language: ${mem.language || "unknown"} | Framework: ${mem.framework || "unknown"}`,
    `Tech stack: ${techStack}`,
    `Entry points: ${entryPoints}`,
    `Architecture: ${mem.architecture || "unknown"}`,
    `Key files:\n${keyFilesStr}`,
    `Patterns & conventions: ${patterns}`,
    `Dependencies: ${mainDeps}`,
    `Test setup: ${mem.testSetup || "unknown"}`,
    `Summary: ${summary}`,
    `=== END PROJECT MEMORY ===`,
  ];

  return lines.join("\n");
}

module.exports = { readMemory, writeMemory, clearMemory, isMemoryValid, getMemoryStats, getMemoryContext };
