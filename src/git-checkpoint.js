/**
 * Git Checkpoint — creates a safety commit before each run and enables rollback
 */

const { execSync, execFileSync } = require("child_process");
const path = require("path");
const fs   = require("fs");

const ORCHESTRA_BRANCH_PREFIX = "orchestra/run-";

/**
 * Check if the directory is a git repo
 */
function isGitRepo(cwd) {
  try {
    execSync("git rev-parse --git-dir", { cwd, stdio: "pipe" });
    return true;
  } catch (_) { return false; }
}

/**
 * Get current branch name
 */
function getCurrentBranch(cwd) {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
  } catch (_) { return "unknown"; }
}

/**
 * Get current commit hash
 */
function getCurrentCommit(cwd) {
  try {
    return execSync("git rev-parse HEAD", { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
  } catch (_) { return null; }
}

/**
 * Create a checkpoint before running agents.
 * Stages all current changes and creates a WIP commit on a new orchestra branch.
 * Returns checkpoint info for rollback.
 */
function createCheckpoint(cwd, runId, logger) {
  if (!isGitRepo(cwd)) {
    logger("⚠️  Not a git repo — skipping checkpoint (changes won't be rollback-able)");
    return null;
  }

  const originalBranch = getCurrentBranch(cwd);
  const originalCommit = getCurrentCommit(cwd);
  const checkpointBranch = `${ORCHESTRA_BRANCH_PREFIX}${runId}`;

  try {
    // Stage all current changes (if any)
    execSync("git add -A", { cwd, stdio: "pipe" });

    // Check if there's anything to commit
    const status = execSync("git status --porcelain", { cwd, encoding: "utf-8", stdio: "pipe" });
    let preCommit = originalCommit;

    if (status.trim()) {
      // Save current WIP as a pre-orchestra commit
      execSync(`git commit -m "orchestra: checkpoint before run ${runId} [WIP]" --allow-empty`, { cwd, stdio: "pipe" });
      preCommit = getCurrentCommit(cwd);
      logger(`✅ Git checkpoint created: ${preCommit?.substring(0, 7)}`);
    } else {
      logger(`✅ Working tree clean — no checkpoint commit needed`);
    }

    return {
      runId,
      originalBranch,
      originalCommit,
      preRunCommit: preCommit,
      checkpointBranch,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    logger(`⚠️  Git checkpoint failed: ${err.message} — continuing without checkpoint`);
    return null;
  }
}

/**
 * Mark a run as complete with a summary commit
 */
function finalizeCheckpoint(cwd, checkpoint, summary, logger) {
  if (!checkpoint || !isGitRepo(cwd)) return;
  try {
    execSync("git add -A", { cwd, stdio: "pipe" });
    const status = execSync("git status --porcelain", { cwd, encoding: "utf-8", stdio: "pipe" });
    if (status.trim()) {
      execSync(`git commit -m "orchestra: run ${checkpoint.runId} complete\n\n${summary}"`, { cwd, stdio: "pipe" });
      logger(`✅ Changes committed: orchestra run ${checkpoint.runId}`);
    }
  } catch (err) {
    logger(`⚠️  Could not commit orchestra changes: ${err.message}`);
  }
}

/**
 * Rollback to the state before the last orchestra run
 */
function rollback(cwd, checkpoint, logger) {
  if (!checkpoint) {
    logger("❌ No checkpoint available for rollback");
    return false;
  }

  if (!isGitRepo(cwd)) {
    logger("❌ Not a git repo — cannot rollback");
    return false;
  }

  try {
    logger(`⏪ Rolling back to ${checkpoint.preRunCommit?.substring(0, 7)}...`);
    // Hard reset to the pre-run commit
    execSync(`git reset --hard ${checkpoint.preRunCommit}`, { cwd, stdio: "pipe" });
    logger(`✅ Rollback complete — back to state before run ${checkpoint.runId}`);
    return true;
  } catch (err) {
    logger(`❌ Rollback failed: ${err.message}`);
    return false;
  }
}

/**
 * Get git diff for a specific run (for logging/display)
 */
function getDiff(cwd, fromCommit, toCommit) {
  if (!isGitRepo(cwd)) return null;
  try {
    return execSync(`git diff ${fromCommit} ${toCommit} --stat`, {
      cwd, encoding: "utf-8", stdio: "pipe"
    });
  } catch (_) { return null; }
}

module.exports = { createCheckpoint, finalizeCheckpoint, rollback, getDiff, isGitRepo, getCurrentBranch };
