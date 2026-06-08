# 🎯 Orchestra v3 — Professional Multi-Agent Orchestrator

**Production-grade multi-agent orchestration for Cursor. One prompt. Full-stack delivery. Zero risk.**

---

## What's new in v3

| Feature | Description |
|---|---|
| 🔒 **Git checkpoints** | Automatic commit before every run. One-click rollback. |
| 👁 **Plan preview gate** | See and approve the execution plan before agents start. |
| 🔬 **Quality gates** | Runs `npm test`, `lint`, `build` after agents complete. |
| 📊 **Cost tracking** | Token count and estimated cost per agent, in real time. |
| 📋 **Run history** | Full history with status, cost, and git diff. |
| ⚙️ **Custom agents** | Add agents or override prompts via `.orchestra/config.json`. |
| 🧪 **Test suite** | 20+ unit tests covering all core modules. |
| 🎨 **Dashboard** | Professional webview with tabs, agent cards, cost table. |

---

## Installation

### Step 1 — Install the Cursor SDK

```bash
npm install @cursor/sdk        # in your project
# or
npm install -g @cursor/sdk     # globally
```

### Step 2 — Get your Cursor API Key

→ **https://cursor.com/dashboard/integrations** → *User API Keys* → **Generate**

### Step 3 — Install the extension

```
Cmd+Shift+P → Extensions: Install from VSIX…
Select: cursor-orchestra-3.0.0.vsix
Cmd+Shift+P → Developer: Reload Window
```

---

## Usage

### Quick run

**`Cmd+Shift+O`** — Enter your feature request → agents execute automatically.

### Run with plan preview

**`Cmd+Shift+P`** (or click 👁 in the dashboard) — Orchestrator proposes a plan first. You approve or cancel before any code is written.

### Dashboard

Click the Orchestra icon in the activity bar (left sidebar). Three tabs:
- **Run** — input box + quick actions
- **Status** — live agent cards, cost table, quality gate results
- **History** — all past runs with status and cost

### Rollback

After any run, click **↩ Undo** in the dashboard (or `Cmd+Shift+P → Orchestra: Rollback`) to restore your project to its pre-run state. Works via git reset.

---

## Custom agents

Run `Cmd+Shift+P → Orchestra: Configure → Generate config file` to create `.orchestra/config.json`:

```json
{
  "agents": {
    "backend": {
      "description": "Your custom backend agent instructions"
    },
    "devops": {
      "description": "DevOps agent for CI/CD, Docker, and infrastructure",
      "emoji": "🔧",
      "name": "DevOps",
      "color": "#a78bfa"
    }
  }
}
```

Add any new agent name — Orchestra discovers it automatically.

---

## Configuration

| Setting | Default | Description |
|---|---|---|
| `orchestra.cursorApiKey` | — | Cursor API Key (`crsr_…`) |
| `orchestra.orchestratorModel` | `claude-sonnet-4-6` | Planning model |
| `orchestra.agentModel` | `claude-sonnet-4-6` | Implementation agents |
| `orchestra.reviewModel` | `claude-opus-4-7` | Manager review |
| `orchestra.autoCheckpoint` | `true` | Git checkpoint before run |
| `orchestra.requirePlanApproval` | `true` | Show plan before executing |
| `orchestra.runQualityGates` | `true` | Run test/lint/build after |
| `orchestra.autoApplyDiff` | `false` | Skip diff review |

---

## Architecture

```
src/
├── extension.js      # VS Code entry point — commands, lifecycle
├── runner.js         # Orchestration engine — all phases
├── agents.js         # Agent prompts, metadata, custom config loader
├── git-checkpoint.js # Git safety layer — checkpoint + rollback
├── quality-gates.js  # Runs npm test/lint/build
├── cost-tracker.js   # Token + cost tracking per agent
├── run-store.js      # Run history persistence (.orchestra/runs/)
├── dashboard.js      # Webview UI — tabs, cards, history
└── sdk-resolver.js   # Finds @cursor/sdk in multiple locations

test/suite/
├── git-checkpoint.test.js
├── quality-gates.test.js
├── run-store.test.js
└── cost-tracker.test.js
```

---

## Run lifecycle

```
1. Cmd+Shift+O → feature request
2. Git checkpoint (stash + commit on branch orchestra/run-{id})
3. Plan generation (orchestrator proposes tasks)
4. Plan approval gate (you approve or cancel)
5. Agent execution (backend → frontend → test → manager)
6. Quality gates (npm test + lint + build)
7. Final commit with run summary
8. Dashboard shows cost, gate results, run history
```

---

## Token consumption

| Phase | Typical range |
|---|---|
| Orchestrator (plan + exec) | 6–12K |
| Backend agent | 6–10K |
| Frontend agent | 6–10K |
| Test agent | 5–8K |
| Manager review | 4–8K |
| **Total** | **27–48K** |

---

## Development

```bash
git clone https://github.com/your-username/orchestra-plugin
cd orchestra-plugin
npm install
npm test          # run the test suite
npm run package   # build the .vsix
```

---

## License

[MIT](./LICENSE)
