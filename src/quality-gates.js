/**
 * Quality Gates — runs npm test, lint, build after agents complete
 */

const { execSync, spawnSync } = require("child_process");
const fs   = require("fs");
const path = require("path");

/**
 * Detect available quality gate commands from package.json
 */
function detectCommands(workspaceRoot) {
  const pkgPath = path.join(workspaceRoot, "package.json");
  if (!fs.existsSync(pkgPath)) return { available: [], hasPackageJson: false };

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const scripts = pkg.scripts || {};
    const available = [];

    if (scripts.test  && !scripts.test.startsWith("echo")) available.push({ name: "test",  cmd: "npm", args: ["test",  "--", "--passWithNoTests"] });
    if (scripts.lint)                                        available.push({ name: "lint",  cmd: "npm", args: ["run",  "lint"] });
    if (scripts.build)                                       available.push({ name: "build", cmd: "npm", args: ["run",  "build"] });
    if (scripts["type-check"])                               available.push({ name: "types", cmd: "npm", args: ["run",  "type-check"] });

    return { available, hasPackageJson: true };
  } catch (_) {
    return { available: [], hasPackageJson: false };
  }
}

/**
 * Run a single quality gate command
 * @returns {{ name, passed, output, duration }}
 */
function runGate(gate, workspaceRoot, logger) {
  logger(`▶ Running ${gate.name}...`);
  const start = Date.now();

  const result = spawnSync(gate.cmd, gate.args, {
    cwd: workspaceRoot,
    encoding: "utf-8",
    timeout: 120_000,        // 2 min max per gate
    env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
  });

  const duration = Date.now() - start;
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  const passed = result.status === 0;

  logger(passed
    ? `✅ ${gate.name} passed (${(duration / 1000).toFixed(1)}s)`
    : `❌ ${gate.name} failed (${(duration / 1000).toFixed(1)}s)\n${output.substring(0, 1000)}`
  );

  return { name: gate.name, passed, output, duration };
}

/**
 * Run all available quality gates
 * @returns {{ passed: boolean, results: Array, summary: string }}
 */
function runAllGates(workspaceRoot, logger) {
  const { available, hasPackageJson } = detectCommands(workspaceRoot);

  if (!hasPackageJson) {
    logger("ℹ️  No package.json found — skipping quality gates");
    return { passed: true, results: [], summary: "No package.json" };
  }

  if (available.length === 0) {
    logger("ℹ️  No test/lint/build scripts found in package.json — skipping quality gates");
    return { passed: true, results: [], summary: "No scripts configured" };
  }

  logger(`\n🔬 Running ${available.length} quality gate(s): ${available.map(g => g.name).join(", ")}`);

  const results = [];
  for (const gate of available) {
    results.push(runGate(gate, workspaceRoot, logger));
  }

  const failed  = results.filter(r => !r.passed);
  const passed  = failed.length === 0;
  const summary = passed
    ? `All ${results.length} quality gates passed`
    : `${failed.length}/${results.length} gates failed: ${failed.map(r => r.name).join(", ")}`;

  logger(passed ? `\n✅ ${summary}` : `\n❌ ${summary}`);
  return { passed, results, summary };
}

module.exports = { runAllGates, detectCommands };
