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

Load only the active command input bundle; never preload sibling references. The
active runtime contract owns orchestration and its MCP allowlist. Translate any shorthand tool ids like `blueprint_project_status` to runtime FQNs such as
`mcp_blueprint_blueprint_project_status`. Treat Blueprint skills as loaded guidance, not callable tools.
Never run `/blu-*` in the shell.

Persistent state is MCP-owned. Commands stay phase-scoped and never mutate source,
installed extensions or host-global state. Phase context belongs only to
`/blu-discuss-phase`; research, UI and planning read it and route back for repair.
Blueprint never creates or repairs repo-root `CONTEXT.md`.

Reuse supplied evidence and read known targets directly. When discovery is needed, follow
a usable `.blueprint/codebase/INDEX.md` and its `ENTRY.md`; otherwise use bounded source
discovery. Do not regenerate maps or widen scope. Give children only relevant evidence.

For discuss, prepare supplies schema/grounded defaults. Resolve missing essentials,
record resumable notes, generate once and pass model to finalize. Generated or rejected
documents are not stored. Read recovers notes/history; active contract owns config
research, confirmation gates, evidence preservation, receipts and MCP routing.

For research, use prepare → investigate → submit with schema/example/grounding/rejection rules. Load only the research runtime reference, never the sibling contract. Rejected models are not saved.

For spec, UI and assumptions, sibling-only contract retains shared call, schema,
checkpoint, ownership/completion rules; command reference owns them.
Recommend only live implemented routes. Never claim stale/invalid/partial
publication complete.
