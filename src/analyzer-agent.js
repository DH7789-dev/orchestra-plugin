/**
 * Analyzer Agent — scans the project and creates a structured memory object.
 *
 * This is a standalone agent (no subagents) that reads the project structure
 * and outputs a memory.json-compatible JSON object.
 */

const ANALYZER_SYSTEM = `You are a senior software architect performing a thorough project analysis.

Your task is to read this project's files and produce a structured JSON memory index.

STEPS:
1. Read package.json (or pyproject.toml / go.mod / Cargo.toml / pom.xml — whichever exists)
2. Read README.md if it exists
3. Read the main entry point file(s) identified in package.json/config
4. Read any config files present: tsconfig.json, .eslintrc, .eslintrc.js, .eslintrc.json, jest.config.js, vite.config.js, webpack.config.js, babel.config.js, etc.
5. List and read a representative sample of source files (up to 10-15 key files from src/, lib/, app/ etc.)
6. Identify project type, language, framework, architecture, patterns, conventions

OUTPUT RULES:
- Output ONLY a single valid JSON object wrapped in \`\`\`json ... \`\`\`
- No explanations before or after
- No additional markdown formatting
- Fill every field to the best of your knowledge; use null for truly unknown fields
- Keep keyFiles to max 20 entries (the most architecturally important ones)
- Keep summary to 2-4 sentences describing the project for a new developer
- Keep architecture to 1-3 sentences describing the overall structure`;

const ANALYZER_PROMPT = `Analyze this project thoroughly and create a structured memory index.

Read the following files to understand the project:
1. package.json (or pyproject.toml, go.mod, Cargo.toml, etc.)
2. README.md if it exists
3. The main entry point file
4. Any config files (tsconfig.json, .eslintrc, etc.)
5. A sample of source files (up to 10-15 key files)

Then output a SINGLE valid JSON object (wrapped in \`\`\`json ... \`\`\`) matching this exact structure:
{
  "version": 1,
  "analyzedAt": "<current ISO datetime>",
  "projectName": "...",
  "projectType": "vscode-extension|node-api|react-app|python-api|other",
  "language": "javascript|typescript|python|go|rust|other",
  "framework": "express|react|vue|vscode-extension|none|other",
  "entryPoints": ["..."],
  "techStack": ["..."],
  "keyFiles": [{"path": "...", "purpose": "..."}],
  "architecture": "...",
  "dependencies": {"main": [...], "dev": [...]},
  "patterns": ["..."],
  "conventions": ["..."],
  "testSetup": "...",
  "buildSystem": "...",
  "linting": "...",
  "summary": "..."
}

Output ONLY the JSON. No explanations, no markdown around it except the code block.`;

/**
 * Runs the analyzer as a standalone agent (no subagents).
 *
 * @param {object} opts
 * @param {object} opts.sdk           - resolved @cursor/sdk
 * @param {string} opts.apiKey
 * @param {string} opts.workspaceRoot
 * @param {string} opts.agentModel    - model ID to use
 * @param {function} [opts.onLog]     - optional log callback (msg: string) => void
 * @returns {Promise<object>}         - parsed memory object
 */
async function runAnalysis({ sdk, apiKey, workspaceRoot, agentModel, onLog }) {
  const { Agent } = sdk;
  const log = typeof onLog === "function" ? onLog : () => {};

  log(`🔍  Analyzer: creating agent (model: ${agentModel})...\n`);

  const agent = await Agent.create({
    apiKey,
    name: "OrchestraAnalyzer",
    model: { id: agentModel },
    local: { cwd: workspaceRoot },
    // No subagents — the analyzer works alone
  });

  let responseText = "";

  try {
    log(`🔍  Analyzer: scanning project files...\n`);

    const run = await agent.send(`${ANALYZER_SYSTEM}\n\n${ANALYZER_PROMPT}`);

    for await (const event of run.stream()) {
      if (event.type === "assistant") {
        for (const block of event.message?.content ?? []) {
          if (block.type === "text") {
            responseText += block.text;
            // Stream partial output so the user sees progress
            log(block.text);
          }
        }
      }
    }

    // Drain the run (captures final usage / ensures completion)
    try { await run.wait(); } catch (_) {}
  } finally {
    // Always dispose agent — even on error — to free SDK resources
    try { await agent[Symbol.asyncDispose](); } catch (_) {}
  }

  // ── Parse JSON from the response ──────────────────────
  let memData = null;

  // Try ```json ... ``` block first
  const jsonBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    try {
      memData = JSON.parse(jsonBlockMatch[1]);
    } catch (_) {}
  }

  // Fall back: try parsing the whole response as JSON
  if (!memData) {
    try {
      memData = JSON.parse(responseText.trim());
    } catch (_) {}
  }

  // Last resort: try to extract any {...} block
  if (!memData) {
    const braceMatch = responseText.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        memData = JSON.parse(braceMatch[0]);
      } catch (_) {}
    }
  }

  if (!memData || typeof memData !== "object") {
    throw new Error("Analyzer agent did not return valid JSON. Raw response length: " + responseText.length);
  }

  // ── Enforce required fields ────────────────────────────
  memData.version     = 1;
  memData.analyzedAt  = memData.analyzedAt || new Date().toISOString();
  memData.projectName = memData.projectName || "unknown";

  // Ensure arrays are arrays
  for (const field of ["entryPoints", "techStack", "keyFiles", "patterns", "conventions"]) {
    if (!Array.isArray(memData[field])) memData[field] = [];
  }

  // Ensure dependencies object
  if (!memData.dependencies || typeof memData.dependencies !== "object") {
    memData.dependencies = { main: [], dev: [] };
  }
  if (!Array.isArray(memData.dependencies.main)) memData.dependencies.main = [];
  if (!Array.isArray(memData.dependencies.dev))  memData.dependencies.dev  = [];

  // Trim keyFiles to 20 entries
  if (memData.keyFiles.length > 20) memData.keyFiles = memData.keyFiles.slice(0, 20);

  log(`\n✅  Analyzer complete: ${memData.projectName} (${memData.projectType || "unknown type"}), ${memData.keyFiles.length} key files indexed.\n`);

  return memData;
}

module.exports = { ANALYZER_SYSTEM, ANALYZER_PROMPT, runAnalysis };
