# 🎯 Orchestra — Multi-Agent Orchestrator for Cursor

> **One prompt → 4 specialized AI agents → full-stack feature delivered.**

Orchestra is a Cursor extension that decomposes your feature request and runs four specialized AI agents in coordination — backend, frontend, test, and manager. It uses your **existing Cursor subscription** (Pro or Business). No Anthropic API key needed.

---

## How it works

```
You: "Add a real-time notification system"
              │
              ▼
   🎯 Orchestrator  →  scans project, decomposes feature, creates subagents
              │
      ┌───────┼───────┐
      ▼               ▼
 ⚙️ Backend      🎨 Frontend       ← run in parallel
 API + DB         UI components
      │               │
      └───────┬───────┘
              ▼
         🧪 Test           ← unit + integration + E2E
              │
              ▼
         📋 Manager         ← code review + security + docs
              │
              ▼
   ✅ Files written to your project
```

All agents run with full filesystem access. They can read existing code, create new files, and communicate context (like API contracts) through the orchestrator.

---

## Installation

### Step 1 — Install the Cursor SDK

The SDK ships with native binaries, so it must be installed separately:

```bash
# In your project (recommended)
npm install @cursor/sdk

# Or globally
npm install -g @cursor/sdk
```

### Step 2 — Get your Cursor API Key

Go to **https://cursor.com/dashboard/integrations** → *User API Keys* → **Generate**

Copy the `crsr_…` key. This uses your existing Cursor subscription — no extra cost.

### Step 3 — Install the extension

**Option A — From the pre-built .vsix:**

1. Download `cursor-orchestra-2.0.0.vsix` from [Releases](https://github.com/your-username/orchestra-plugin/releases)
2. In Cursor: `Cmd+Shift+P` → *Extensions: Install from VSIX…*
3. Select the file
4. Reload: `Cmd+Shift+P` → *Developer: Reload Window*

**Option B — Build from source:**

```bash
git clone https://github.com/your-username/orchestra-plugin
cd orchestra-plugin
npm install
npm run package
# Then install the generated .vsix in Cursor
```

---

## Usage

### Run

Press **`Cmd+Shift+O`** (Mac) or **`Ctrl+Shift+O`** (Windows/Linux).

On first run, you'll be prompted for your Cursor API Key. It's saved globally — you won't be asked again.

Then describe your feature in natural language:

```
User auth with OAuth Google, profile page with avatar upload, and full test coverage
```

Watch the Output panel — each agent streams its work in real time.

### Configure

`Cmd+Shift+P` → *Orchestra: Configure*

| Setting | Default | Description |
|---|---|---|
| `orchestra.cursorApiKey` | — | Your `crsr_…` API key |
| `orchestra.orchestratorModel` | `claude-sonnet-4-6` | Model for planning |
| `orchestra.agentModel` | `claude-sonnet-4-6` | Model for backend/frontend/test |
| `orchestra.reviewModel` | `claude-opus-4-7` | Model for code review |
| `orchestra.enabledAgents` | all enabled | Toggle individual agents |

### Abort

`Cmd+Shift+P` → *Orchestra: Abort Current Run*

---

## Agents

| Agent | Model (default) | Responsibilities |
|---|---|---|
| 🎯 Orchestrator | Sonnet 4.6 | Analyzes project, decomposes feature, delegates tasks |
| ⚙️ Backend | Sonnet 4.6 | API endpoints, DB models, services, auth, middleware |
| 🎨 Frontend | Sonnet 4.6 | Components, pages, routing, state, styling, forms |
| 🧪 Test | Sonnet 4.6 | Unit (70%), integration (20%), E2E (10%) tests |
| 📋 Manager | Opus 4.7 | Code review, security audit, docs, consistency |

---

## Token consumption

| Phase | Tokens (approx) |
|---|---|
| Orchestrator (plan) | ~4–6K |
| Backend agent | ~6–10K |
| Frontend agent | ~6–10K |
| Test agent | ~5–8K |
| Manager review | ~4–8K |
| **Total per feature** | **~25–42K** |

---

## Troubleshooting

**`@cursor/sdk not found`**
The extension will offer to install it for you. Click *Install in project* or *Install globally*. After the terminal finishes, run Orchestra again.

**`authentication_error`**
Your API key is invalid or expired. Run *Orchestra: Configure* to update it.

**`rate_limit_error`**
You've hit your Cursor plan's token limit. Wait a few minutes, or switch agents to `composer-2` (cheaper).

**Extension not visible**
After installing the `.vsix`, reload Cursor: `Cmd+Shift+P` → *Developer: Reload Window*.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

[MIT](./LICENSE)
