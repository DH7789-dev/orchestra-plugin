# Contributing to Orchestra

## Setup

```bash
git clone https://github.com/your-username/orchestra-plugin
cd orchestra-plugin
npm install
```

## Project structure

```
src/
├── extension.js     # Entry point — commands, status bar, error handling
├── runner.js        # Core orchestration logic — creates agents, streams events
├── agents.js        # Agent prompts, metadata, model assignments
└── sdk-resolver.js  # Finds @cursor/sdk across multiple install locations
```

## Add a new agent

1. Add its description in `src/agents.js` under `AGENT_DESCRIPTIONS`
2. Add its metadata (emoji, name, color) in `AGENT_META`
3. Add a setting in `package.json` → `contributes.configuration.properties`
4. Reference it in the orchestrator system prompt in `ORCHESTRATOR_SYSTEM`

## Build & test locally

```bash
# Build the .vsix
npm run package

# Install in Cursor
cursor --install-extension cursor-orchestra-2.0.0.vsix
```

## Pull requests

- Keep PRs focused on one change
- Update CHANGELOG.md
- Test the extension manually before submitting
