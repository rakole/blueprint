# Product And Runtime Model

Blueprint is a Gemini and Tabnine CLI extension for structured, artifact-backed
product work inside a repository. It is inspired by a retained workflow, but its
runtime, command contracts, skills, agents, and MCP server are Blueprint-native.

## User Surface

- Root router: `/blu`
- Direct commands: `/blu-<command>`
- Project-local state: `.blueprint/`
- Host-global operational state: `~/.gemini/blueprint/` or
  `~/.tabnine/blueprint/`, depending on host.
- Extension install model: host manifest launches `dist/mcp/server.js`.

Commands are host slash commands. They are not shell commands.

## Layer Ownership

Commands:

- Live in `commands/*.toml`.
- Stay thin and user-facing.
- Name the active skill and allowed MCP tool FQNs.
- Explain visible progress, confirmation gates, and response shape.

Skills:

- Live in `skills/<skill>/SKILL.md`.
- Own orchestration policy, command input bundles, optional agents, and
  command-specific runtime references.
- Are guidance loaded by the host, not callable tools.

Agents:

- Live in `agents/*.md`.
- Own bounded specialist work such as planning, checking, mapping, reviewing,
  debugging, or execution.
- Receive compact packets from the parent command.
- Do not own final persistence, routing, or state updates.

MCP tools:

- Live under `src/mcp`.
- Own deterministic reads and writes for `.blueprint/` and approved host-global
  state.
- Return structured status, paths, warnings, diagnostics, and next actions.

Hooks:

- Source lives in `src/hooks`.
- Registration lives in `hooks/hooks.json`.
- Built hook entrypoints live in `dist/hooks`.
- Hooks are advisory and must not own state transitions.

Build and packaging:

- `gemini-extension.json` and `tabnine-extension.json` launch the built MCP
  server.
- `scripts/build.mjs` creates `dist`.
- Source changes that affect runtime behavior require a build before host
  install checks are meaningful.

## Design Invariants

Do:

- Keep Blueprint Gemini-native.
- Keep commands thin.
- Keep persistence in MCP tools.
- Keep hooks advisory.
- Keep routing inside commands whose live catalog entry is `implemented`.

Do not:

- Reintroduce legacy slash-command surfaces.
- Make scripts the persistence layer.
- Treat a documented or README-listed command as runnable unless the runtime
  catalog says it is implemented.
- Recommend planned, blocked, or repairing commands as executable next steps.
