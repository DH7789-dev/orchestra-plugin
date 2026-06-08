/**
 * Run Store — persists run history to .orchestra/runs/
 */

const fs   = require("fs");
const path = require("path");

function getRunsDir(workspaceRoot) {
  return path.join(workspaceRoot, ".orchestra", "runs");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Save a run record
 */
function saveRun(workspaceRoot, run) {
  const dir = getRunsDir(workspaceRoot);
  ensureDir(dir);
  const file = path.join(dir, `${run.id}.json`);
  fs.writeFileSync(file, JSON.stringify(run, null, 2));
  pruneOldRuns(workspaceRoot, 50);
}

/**
 * Load all runs, newest first
 */
function loadRuns(workspaceRoot, limit = 50) {
  const dir = getRunsDir(workspaceRoot);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")); }
      catch (_) { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    .slice(0, limit);
}

/**
 * Load a specific run by ID
 */
function loadRun(workspaceRoot, runId) {
  const file = path.join(getRunsDir(workspaceRoot), `${runId}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, "utf-8")); }
  catch (_) { return null; }
}

/**
 * Remove old runs beyond the limit
 */
function pruneOldRuns(workspaceRoot, limit) {
  const dir = getRunsDir(workspaceRoot);
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => ({ file: f, mtime: fs.statSync(path.join(dir, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const { file } of files.slice(limit)) {
    try { fs.unlinkSync(path.join(dir, file)); } catch (_) {}
  }
}

/**
 * Update an existing run (partial update)
 */
function updateRun(workspaceRoot, runId, updates) {
  const run = loadRun(workspaceRoot, runId);
  if (!run) return;
  saveRun(workspaceRoot, { ...run, ...updates });
}

/**
 * Generate a short run ID
 */
function generateRunId() {
  const now = new Date();
  const date = now.toISOString().replace(/[-:T]/g, "").substring(0, 12);
  const rand = Math.random().toString(36).substring(2, 6);
  return `${date}-${rand}`;
}

module.exports = { saveRun, loadRuns, loadRun, updateRun, generateRunId };
