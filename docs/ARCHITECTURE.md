# Blueprint Architecture

## Goal

Blueprint is a Gemini-native extension that keeps GSD's command-driven methodology where it is useful, but re-implements runtime ownership around Gemini commands, skills, advisory hooks, and MCP tools instead of installer-managed scripts.

The live runtime currently ships:

- Wave 0 foundation
- the lifecycle slice from `discuss-phase` through `verify-work`
- the validation follow-up command `add-tests`
- governance handoff/resume
- the current roadmap-admin slice
- the shipped Wave 3 capture commands, `note`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, and `explore`
- the shipped Wave 3 lightweight execution commands, `fast` and `quick`
- the shipped Wave 3 debug command, `debug`
- the shipped Wave 4 review commands, `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, and `ui-review`
- the shipped Wave 4 docs command, `docs-update`
- the shipped Wave 4 review-branch command, `pr-branch`
- the shipped Wave 5 maintenance command, `cleanup`

Planned commands stay documented, but they are not routable until their manifest, primary skill, and required MCP tools all exist.

## Source Layout

Current source tree:

```text
blueprint/
  gemini-extension.json
  GEMINI.md
  commands/
    blu.toml
    blu/
      *.toml
  skills/
    <skill>.md
    <skill>/
      SKILL.md
  agents/
    *.md
  hooks/
    hooks.json
  src/
    hooks/
    mcp/
      server.ts
      tools/
  tests/
```

Generated at build and release time:

- `dist/mcp/*.js`
- `dist/hooks/*.js`

Planned later runtime surfaces, not registered today:

- extra MCP families for review, workspace, update, and patch flows
- extra skill families for planned-only commands
- extra agent contracts for review, docs, debugging, UI audit, and security audit

## Runtime Layers

### 1. Commands

- `/blu` is the root router.
- `/blu-<command>` is the direct entrypoint for each retained command.
- Commands own user-facing UX, routing, confirmations, and recovery language.
- Commands do not own durable state mutation.

### 2. Skills

- Skills hold orchestration rules for command families.
- Gemini discovers shipped skills from `skills/<name>/SKILL.md`.
- Legacy flat `skills/*.md` mirrors may remain in the repo during repair, but they are not runtime handles and must not be referenced as activation paths.
- The currently shipped skill files are `blueprint-router`, `blueprint-bootstrap`, `blueprint-governance`, `blueprint-map`, `blueprint-capture`, `blueprint-phase-discovery`, `blueprint-phase-planning`, `blueprint-phase-execution`, `blueprint-phase-validation`, `blueprint-debug`, `blueprint-docs`, `blueprint-review`, `blueprint-roadmap-admin`, and `blueprint-maintenance`.
- Planned skill families stay documented but non-routable until their commands actually ship.

### 3. Agents

- Agents handle bounded deep work: project bootstrap research, codebase mapping, phase research, UI design, planning, execution, and verification.
- They are optional bounded helpers, not an alternate persistence layer.
- Gemini loads shipped agent contracts from `agents/*.md`, keyed by agent frontmatter metadata rather than repo file paths mentioned in prompts.
- The currently shipped contract files cover `blueprint-project-researcher`, `blueprint-roadmapper`, `blueprint-mapper`, `blueprint-researcher`, `blueprint-ui-designer`, `blueprint-planner`, `blueprint-checker`, `blueprint-executor`, and `blueprint-verifier`.

### 4. MCP Server

- The MCP server is the deterministic state engine.
- It currently registers project/catalog, config, state/pause-handoff, phase/roadmap including backlog promotion, capture-index, and artifact tool families.
- It owns `.blueprint/` reads and writes, config normalization, capture index persistence, phase artifact persistence, summary and validation persistence, milestone audit report writes, and state synchronization.
- It also owns the hard security boundary for persistence through the shared security layer in `src/shared/security.ts`, including shared path containment, safe parsing, prompt-boundary checks, and identifier validation.
- Planned tool families for review, workspace, update, and patch behavior remain future contracts until they are registered.

### 5. Hooks

- Blueprint ships three advisory hooks: `read-before-edit`, `.blueprint` write guard, and `workflow advisory`.
- Hook source lives under `src/hooks/`; Gemini consumes the built commands listed in `hooks/hooks.json`.
- Hooks are advisory only. They may reuse the shared security detectors for consistency, but they do not become a hidden state engine or permission system.

## Command Dispatch Model

### Direct command

- User calls `/blu-plan-phase 3`.
- Gemini loads the command file.
- The command invokes the matching Blueprint skill by canonical skill name and documented MCP tools.
- Optional bounded agents are used only where the command contract calls for them.

### Router command

- User calls `/blu`.
- Router inspects user intent together with `blueprint_command_catalog`, `blueprint_project_status`, and effective config when needed.
- Router either:
  - dispatches inline to an implemented command contract, or
  - recommends the safest direct command when intent is ambiguous or risky.

Blocked and planned commands remain visible as metadata, but they must not be presented as runnable.

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

## Routing And Exposure Rules

- `blueprint_command_catalog` is the source of routable-command truth.
- `/blu`, `/blu-help`, and `/blu-progress` may inspect the full retained command catalog, but they must only recommend commands whose entry is `implemented`.
- Documentation alone does not make a command runnable.
- A command becomes routable only when its manifest, primary skill, and required MCP tools are all present.

## Design Constraints

### 1. Docs-first

The planning pack lands before new command surfaces, and runtime expansion pauses when drift repair is required.

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

### 5. Shared security first

Shared security primitives land below commands and skills. They harden MCP validation, artifact persistence, and high-risk maintenance preflights before they change the public command surface.

## Omitted Architecture

These surfaces remain intentionally out of scope for Blueprint v1:

- statusline bridge
- extension self-mutation
- hidden internal support commands for omitted user features
- a second brownfield command set beyond `map-codebase`
