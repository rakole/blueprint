---
name: blueprint-phase-discovery
description: >
  Pre-planning discovery and requirements shaping for Blueprint lifecycle
  work. Use this skill to orchestrate discuss, spec, research,
  UI-contract, and assumptions-review flows while keeping persistent state
  MCP-owned and phase-scoped.
status: implemented
commands:
  - /blu-discuss-phase
  - /blu-spec-phase
  - /blu-research-phase
  - /blu-ui-phase
  - /blu-list-phase-assumptions
input_bundles:
  shared: []
  commands:
    "/blu-discuss-phase":
      - skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md
    "/blu-spec-phase":
      - skills/blueprint-phase-discovery/references/discovery-sibling-contracts.md
      - skills/blueprint-phase-discovery/references/spec-phase-runtime-contract.md
    "/blu-research-phase":
      - skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md
    "/blu-ui-phase":
      - skills/blueprint-phase-discovery/references/discovery-sibling-contracts.md
      - skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md
    "/blu-list-phase-assumptions":
      - skills/blueprint-phase-discovery/references/discovery-sibling-contracts.md
      - skills/blueprint-phase-discovery/references/list-phase-assumptions-runtime-contract.md
---

# Blueprint Phase Discovery

## Runtime Call Rules

Load only the active command input bundle. Never preload sibling references.
The active runtime contract owns orchestration and its MCP allowlist.
Translate any shorthand tool ids like `blueprint_project_status` to runtime FQNs
such as `mcp_blueprint_blueprint_project_status`.
Treat Blueprint skills as loaded guidance, not callable tools.
Never run `/blu-*` in the shell.

Persistent state is MCP-owned. Commands stay phase-scoped and never mutate source
files, installed extensions, or host-global state. Phase context belongs only to
`/blu-discuss-phase`; research, UI and planning read it and route back for repair.
Blueprint never creates or repairs repo-root `CONTEXT.md`.

For discuss, use prepare → record → finalize; read is recovery/view only. Its
record tool exposes the canonical typed context schema and raw candidate salvage.
Effective config in prepare controls optional bounded researcher use. Require
explicit substantive-overwrite and target-reconciliation gates, preserve evidence
and deferred ideas, report durable receipts and exact MCP-derived routing.

For research, use prepare → investigate → submit. MCP preserves candidates before
assessment, renders research, and owns publication/state/routing recovery. Record
is optional for longer investigations and narrow corrections; read is recovery or
view only. Load only the research runtime reference, never the sibling contract.

For spec, UI and assumptions, the sibling-only contract retains their shared call,
schema, checkpoint, ownership and completion rules; the command reference owns details.
Recommend only live implemented routes. Never claim stale, invalid or partial
publication complete.
