/**
 * SDK Resolver — finds @cursor/sdk across multiple locations
 *
 * The Cursor SDK ships with sqlite3 (a native C++ module) so it
 * cannot be bundled into the .vsix. We look for it in:
 *   1. The open workspace's node_modules
 *   2. The global npm install path
 *   3. A dedicated ~/.orchestra directory
 */

const path  = require("path");
const fs    = require("fs");
const os    = require("os");
const { execSync } = require("child_process");

/**
 * @param {string} workspaceRoot
 * @returns {{ Agent: any, CursorAgentError: any } | null}
 */
function resolveSDK(workspaceRoot) {
  const candidates = buildCandidates(workspaceRoot);

  for (const sdkPath of candidates) {
    const pkgPath = path.join(sdkPath, "package.json");
    if (!fs.existsSync(pkgPath)) continue;

    try {
      const sdk = require(sdkPath);
      if (sdk && sdk.Agent) return { sdk, resolvedPath: sdkPath };
    } catch (_) {
      // try next
    }
  }

  return { sdk: null, candidates };
}

function buildCandidates(workspaceRoot) {
  const candidates = [];

  // 1. Workspace node_modules
  if (workspaceRoot) {
    candidates.push(path.join(workspaceRoot, "node_modules", "@cursor", "sdk"));
  }

  // 2. Global npm root
  try {
    const npmRoot = execSync("npm root -g", { encoding: "utf-8", timeout: 5000 }).trim();
    candidates.push(path.join(npmRoot, "@cursor", "sdk"));
  } catch (_) {}

  // 3. ~/.orchestra dedicated dir
  candidates.push(path.join(os.homedir(), ".orchestra", "node_modules", "@cursor", "sdk"));

  return candidates;
}

/**
 * Returns the shell commands to install the SDK
 * @param {string} workspaceRoot
 * @returns {{ inProject: string, globally: string, dedicated: string }}
 */
function installCommands(workspaceRoot) {
  const home = os.homedir();
  return {
    inProject: `cd "${workspaceRoot}" && npm install @cursor/sdk`,
    globally:  `npm install -g @cursor/sdk`,
    dedicated: `mkdir -p "${home}/.orchestra" && cd "${home}/.orchestra" && npm init -y && npm install @cursor/sdk`,
  };
}

module.exports = { resolveSDK, buildCandidates, installCommands };
