# Blueprint Handoff

## Current State

The repository now contains a docs-first planning pack. No runtime code or Gemini extension scaffolding has been created yet.

## What Future Sessions Already Have

- locked command set
- locked omit list
- locked state locations
- locked MCP boundary
- locked hook and policy boundaries
- dependency-ordered implementation queue
- one spec file per retained command
- command catalog and phase lifecycle references for quick lookup
- Gemini-specific constraint notes to keep implementation aligned with the host CLI

## Recommended Next Session

Start Wave 0 implementation with:

1. `gemini-extension.json`
2. `GEMINI.md`
3. `commands/blu.toml`
4. `commands/blu/new-project.toml`
5. MCP server skeleton with project, config, state, roadmap, and artifact tool stubs
6. normalized config loader covering hardcoded defaults, `~/.gemini/blueprint/defaults.json`, repo config, and migration to schema v2

## First Implementation Slice

Target these files first:

- `gemini-extension.json`
- `GEMINI.md`
- `commands/blu.toml`
- `commands/blu/new-project.toml`
- `src/mcp/server.ts`
- `src/mcp/tools/project.ts`
- `src/mcp/tools/config.ts`
- `src/mcp/tools/state.ts`
- `src/mcp/tools/artifacts.ts`
- initial tests for `new-project`
- config precedence, normalization, and repair fixtures

## Shared Risks To Watch

- Gemini command routing may tempt inline duplication instead of reusing skills and MCP tools.
- `update` must remain advisory; do not let implementation drift toward self-updating the extension.
- workspace removal, patch replay, and undo need especially strict mutation boundaries.
- keep `.blueprint/` artifacts stable while adding command code; later commands depend on early schema choices.
- keep hook enablement in `hooks/hooks.json`; do not reintroduce repo-level hook toggles while building config support.

## Documentation Order To Reuse

When implementing a command, consult in this order:

1. `docs/DECISIONS.md`
2. `docs/ARCHITECTURE.md`
3. `docs/ARTIFACT-SCHEMA.md`
4. `docs/MCP-TOOLS.md`
5. `docs/GEMINI-CONSTRAINTS.md`
6. `docs/PHASE-LIFECYCLE.md`
7. `docs/SKILLS-AND-AGENTS.md`
8. `docs/IMPLEMENTATION-ORDER.md`
9. `docs/COMMAND-CATALOG.md`
10. `docs/commands/<command>.md`

## Success Marker For The Next Milestone

The next milestone is successful when Wave 0 is executable end-to-end with deterministic `.blueprint/` output and passing fixture tests.
