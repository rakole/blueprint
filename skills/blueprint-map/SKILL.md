---
name: blueprint-map
description: >
  Map a brownfield repository into the seven-document Blueprint codebase bundle.
  Use for evidence-backed repository analysis, focused deepening, and an
  explicitly requested refresh. Reuse a valid existing map by default.
status: implemented
commands:
  - /blu-map-codebase
input_bundles:
  shared: []
  commands:
    /blu-map-codebase:
      - commands/blu-map-codebase.toml
      - skills/blueprint-map/references/map-runtime-contract.md
---

# Blueprint Map Skill

## Ownership

This skill and its local `references/map-runtime-contract.md` are the active
orchestration contract. MCP prepares context, compiles authored content, validates
the complete bundle, and owns canonical writes. The parent owns submission and
routing. Optional `blueprint-mapper` agents only analyze assigned evidence.

## Runtime Call Rules

Required MCP tools: `blueprint_map_prepare`, `blueprint_map_submit`.
Call their runtime FQNs: `mcp_blueprint_blueprint_map_prepare` and
`mcp_blueprint_blueprint_map_submit`.
Translate any shorthand tool ids like `blueprint_map_prepare` into their runtime FQNs.
Treat Blueprint skills as loaded guidance, not callable tools.
Never run `/blu-*` in the shell.

## Workflow

1. Resolve the repository, optional focus area, and whether refresh/replacement
   was explicitly requested. Use targeted file inventory to select representative
   repo-relative evidence files; the reference explains selection and usefulness.
2. Call prepare with `inputs` and optional `focus`. It owns project readiness,
   effective config, existing bundle status, authoring schema/example, required
   document keys, and the opaque evidence/target `snapshot`. Stop on its blockers.
3. A supplied focus authorizes targeted refresh of affected documents. Read those
   existing canonical documents after prepare; its target hashes cover these reads.
   Preserve useful context and reuse unaffected documents. Without a focus or
   refresh request, reuse a complete valid bundle by default: report prepare's reuse result and
   next action without generation or submit. Do not ask a routine reuse question.
   If the user explicitly requested refresh/replacement, that request authorizes
   `overwrite: true`; no second confirmation is needed. Otherwise obtain approval
   through `ask_user` before replacing populated documents.
4. Read the selected evidence files after prepare. Author every key in
   `requiredDocuments`, plus any existing documents whose refresh is authorized.
   Omit valid unchanged documents so submit can reuse them. Follow the returned
   schema and example; do not reconstruct Markdown templates or calculate hashes.
5. Use a single parent authoring pass by default. Optional mapper lanes require
   a suitable code-analysis capability, effective `workflow.subagents=true`, and
   independent work that benefits from delegation. Give each lane exact selected
   paths, requested document keys, schema, focus, and stop conditions. The parent
   combines the results into one submission; agents never persist the bundle.
6. Call submit with the unchanged `snapshot`, authored `documents`, and authorized
   `overwrite` when needed. It validates all new and reused documents before any
   write. There is no separate scaffold, digest, per-document write, or final
   validation call in the normal path.
7. Treat returned publication status, artifact outcomes, issues, warnings, and
   `nextAction` as authoritative. Fix blocking authoring issues in conversation;
   follow the local reference for stale evidence and partial publication. Do not
   regenerate accepted output or retry solely because advisory warnings exist.

## Scope And Progress

The target remains the same seven `.blueprint/codebase/*.md` files. Focus deepens
relevant content in that bundle. Brownfield mapping may be the first Blueprint
write; it does not bootstrap project core state or create repo-root `CONTEXT.md`.

Execution profile: `long-running-mutation`. Use `Resolve`, `Read`, `Decide`,
`Execute`, `Persist`, `Validate`, and `Route` for meaningful progress, combining
stages covered by one call. State resolved scope, active stage, pending gate,
execution mode, and next safe action when the run pauses or spans multiple steps.

## Completion Self-Check

- The command and this skill's active local reference were loaded.
- Evidence was selected before prepare, read after snapshot capture, and kept
  within that snapshot through submission. Newly discovered evidence triggered
  prepare again before authoring from it.
- Required document keys were supplied; unchanged valid documents were reused.
  Any overwrite was already authorized, and no manual-edit heuristic or needless
  reuse prompt was introduced.
- All persistence stayed inside the parent-owned submit tool. Rejected content
  was not saved, logged, archived, or described as published. Partial publication
  was reported honestly until retry completed.
- Completion used prepare's valid reuse result or submit's successful publication
  receipt, with exact paths and relevant warnings. No extra validation ritual.
- Follow-ups are implemented-only: successful `mapped-only` → `/blu-new-project`,
  initialized → `/blu-progress`, greenfield/scaffold-only → `/blu-new-project`,
  broken partial core state → `/blu-health`, subject to returned availability.
