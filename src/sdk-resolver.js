const path    = require("path");
const fs      = require("fs");
const os      = require("os");
const { execSync } = require("child_process");

function resolveSDK(workspaceRoot) {
  const candidates = buildCandidates(workspaceRoot);
  for (const sdkPath of candidates) {
    if (!fs.existsSync(path.join(sdkPath, "package.json"))) continue;
    try {
      const sdk = require(sdkPath);
      if (sdk && sdk.Agent) return { sdk, resolvedPath: sdkPath };
    } catch (_) {}
  }
  return { sdk: null, candidates };
}

function buildCandidates(workspaceRoot) {
  const cands = [];
  if (workspaceRoot) cands.push(path.join(workspaceRoot, "node_modules", "@cursor", "sdk"));
  try {
    const npmRoot = execSync("npm root -g", { encoding: "utf-8", timeout: 5000 }).trim();
    cands.push(path.join(npmRoot, "@cursor", "sdk"));
  } catch (_) {}
  cands.push(path.join(os.homedir(), ".orchestra", "node_modules", "@cursor", "sdk"));
  return cands;
}

function installCommands(workspaceRoot) {
  return {
    inProject: `cd "${workspaceRoot}" && npm install @cursor/sdk`,
    globally:  `npm install -g @cursor/sdk`,
    dedicated: `mkdir -p "${os.homedir()}/.orchestra" && cd "${os.homedir()}/.orchestra" && npm init -y && npm install @cursor/sdk`,
  };
}

module.exports = { resolveSDK, installCommands };
