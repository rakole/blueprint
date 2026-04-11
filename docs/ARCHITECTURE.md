# Blueprint Architecture

## Goal

Blueprint is a Gemini-native extension that preserves GSD's command-driven methodology while replacing its runtime-specific installer and compatibility layer with a cleaner extension architecture.

## Extension Shape

Current shipped runtime layout, with deferred surfaces called out explicitly:

```text
blueprint/
  gemini-extension.json
  GEMINI.md
  commands/
    blu.toml
    blu/
      *.toml
  skills/
    *.md
  agents/
    *.md
  src/
    mcp/
```

Deferred, not yet shipped in the current repair branch:
- `hooks/`
- `policies/`
- `src/hooks/`
- `src/shared/`
- `dist/`

## Runtime Layers

### 1. Commands

- `/blu` is the root router.
- `/blu:<command>` is the direct entrypoint for each retained command.
- Commands own user-facing UX and routing, but not persistent state mutation.

### 2. Skills

- Skills hold the high-level orchestration instructions for command families.
- Skills replace the "thin markdown command plus deep workflow file" split used by GSD.
- Shipped skills today are `blueprint-router`, `blueprint-bootstrap`, `blueprint-governance`, `blueprint-map`, and `blueprint-phase-discovery`.
- Later skill families stay planned until the commands that need them are actually shipped.

### 3. Subagents

- Subagents handle bounded deep work: research, planning, execution, verification, code review, fixing, debugging, mapping, docs, UI, and security.
- Agents are invoked only for bounded sidecar work or where the command contract explicitly requires them.
- Shipped contract files currently cover `blueprint-project-researcher`, `blueprint-roadmapper`, `blueprint-mapper`, `blueprint-planner`, `blueprint-checker`, `blueprint-executor`, `blueprint-verifier`, `blueprint-researcher`, and `blueprint-ui-designer`.

### 4. MCP Server

- The MCP server is the deterministic state engine.
- It owns `.blueprint/` file creation, config precedence resolution, config normalization, updates, indexing, validation, workspace registry updates, workstream bookkeeping, review metadata, update planning, and patch registry access.
- Commands and skills must call MCP tools for stateful operations rather than embedding raw filesystem mutation logic in prompt prose.

### 5. Hooks

- Hooks are advisory only in v1, and hook code is still deferred in the current repair branch.
- Hooks should improve safety and reduce repeated model mistakes, but they should not become a hidden execution engine or a hidden prerequisite for Phase 3 discovery.

## Command Dispatch Model

### Direct command

- User calls `/blu:plan-phase 3`.
- Gemini loads the command file.
- The command loads the right Blueprint skill or inline contract.
- The skill uses MCP tools and optional subagents to complete the flow.

### Router command

- User calls `/blu`.
- Router inspects intent plus project state via `blueprint_command_catalog` and `blueprint_project_status`.
- Router either:
  - dispatches inline to an `implemented` command contract, or
  - offers the best direct command when user intent is ambiguous.

Blocked commands remain visible as catalog metadata, but they must not be presented as runnable.

## State Boundaries

### Project-local state

Lives in `.blueprint/`:

- core project docs
- phase artifacts
- reports
- notes, todos, backlog
- codebase mapping outputs
- workstream state

### Global state

Lives in `~/.gemini/blueprint/`:

- `defaults.json`
- `workspaces.json`
- `updates/`
- `patches/`

Global state is intentionally narrow. Blueprint should not quietly accumulate project-like data outside the repo, and the only config layer outside the repo is the user-defaults file at `~/.gemini/blueprint/defaults.json`.

## Design Constraints

### 1. Docs-first

The planning pack lands before new command surfaces, and later runtime expansion pauses when drift repair is required.

### 2. Gemini-native, not transliterated

Blueprint is allowed to diverge from GSD where Gemini CLI or extension constraints differ:

- no installer-managed runtime conversion
- no slash-command chaining assumption
- no settings-driven statusline dependency
- no extension self-update from inside the running session

### 3. One command at a time

Implementation order matters more than breadth. Shared primitives are built first, then commands land in dependency order.

### 4. Stable artifact contracts

Artifact names and schemas must be stable before command code lands, because most commands depend on shared artifact discovery.

## Omitted Architecture

These surfaces are intentionally not planned for v1:

- statusline bridge
- extension self-mutation
- hidden internal support commands for omitted user features
- a second brownfield command set beyond `map-codebase`
