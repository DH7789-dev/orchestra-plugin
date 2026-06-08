# Changelog

All notable changes to Orchestra will be documented here.

## [2.0.0] — 2026-06-08

### Added
- Switched from raw Anthropic API to official **Cursor SDK** (`@cursor/sdk`)
- Native **subagents** support — orchestrator delegates via the SDK `Agent` tool
- Smart SDK resolver — searches workspace, global npm, and `~/.orchestra`
- Auto-install prompt when SDK is missing (opens terminal with the right command)
- Configurable model per agent role (orchestrator / agents / reviewer)
- Abort command to cancel a running orchestration
- GitHub Actions CI workflow — packages `.vsix` on every push

### Changed
- No longer requires an Anthropic API key — uses your Cursor subscription
- Modular source split into `extension.js`, `runner.js`, `agents.js`, `sdk-resolver.js`

### Removed
- Direct `https` calls to `api.anthropic.com`
- Dashboard webview (replaced by Output channel stream)

## [1.0.0] — 2026-05-21

### Added
- Initial release
- 4 agents: backend, frontend, test, manager
- Cursor rules (`.mdc`) files for each agent
- CLI orchestrator script (`orchestrate.mjs`)
