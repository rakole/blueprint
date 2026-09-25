---
name: blueprint-map
description: >
  Map a brownfield repository into generated Blueprint codebase views, with
  explicit portable v1 opt-in, evidence-backed focused deepening, and ordinary
  valid reuse by default.
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
routing. Optional `blueprint-mapper` agents only analyze assigned evidence. The
portable v1 contract is an explicit opt-in on this command; it does not change
ordinary valid-map reuse into an automatic upgrade.

## Runtime Call Rules

Required MCP tools: `blueprint_map_prepare`, `blueprint_map_submit`.
Call their runtime FQNs: `mcp_blueprint_blueprint_map_prepare` and
`mcp_blueprint_blueprint_map_submit`.
Translate any shorthand tool ids like `blueprint_map_prepare` into their runtime FQNs.
Treat Blueprint skills as loaded guidance, not callable tools.
Never run `/blu-*` in the shell.

## Workflow

1. Resolve the repository, optional focus area, refresh/replacement authority, and
   whether the user explicitly requested portable mode. Portable mode sends
   `formatVersion: 1`; absence of that selector keeps the ordinary compatibility
   path. Use targeted inventory to select representative repo-relative evidence.
2. Ordinary mapping calls prepare with `inputs` and optional `focus`. Read selected
   files only after prepare, echo its opaque legacy `snapshot` unchanged at submit,
   and reuse a valid complete map by default. Focus and explicit refresh authorize
   replacement according to the legacy `overwrite` gate; do not ask a routine reuse
   question.
3. Portable mapping calls `blueprint_map_prepare` with `formatVersion: 1` and one
   intent: `new`, `upgrade`, `refresh`, or `repair`. Prepare returns an opaque
   `operationId`, deterministic bounded packets, and an opaque cursor. Continue with
   `{formatVersion: 1, operationId, cursor}` until no cursor remains. For `repair`,
   pass the exact returned basis `{authorized: true, previousIndexHash,
   targetHashes, observedMarkerHash}`; never calculate or invent it. `new` is only
   for an absent portable and legacy map, `upgrade` only for a verified legacy
   bundle, and `refresh` only for a valid current portable generation. Submit the
   same intent that prepare recorded; it is not replacement authority by itself.
4. Read packet-selected live source after portable prepare and author one complete
   model: `formatVersion: 1`, the prepared `generationId`, all seven `documents`,
   and `semantic` `capabilities`, `claims`, and `aliases`, with exact evidence and
   explicit unknowns. The raw authored JSON has a 48 KiB cap. Reduce scope or
   report an unsupported limit when it cannot fit; do not omit records or invent
   multipart tools.
5. Use a single parent authoring pass by default. Optional mapper lanes require a
   suitable code-analysis capability, effective `workflow.subagents=true`, and
   independent work that benefits from delegation. Give each lane exact selected
   paths, requested keys, packet/schema, focus, and stop conditions. The parent
   combines results and calls the one submit/finalizer; agents never persist the bundle.
6. Submit through `mcp_blueprint_blueprint_map_submit` only. Ordinary submission
   echoes the unchanged `snapshot`; portable submission uses the same `formatVersion`,
   `operationId`, `intent`, and complete model. Portable prepare-time source/target
   CAS, provenance, and generation basis are authoritative. Stale or conflicting
   evidence means reprepare; retry an accepted publication with the exact original
   operation/model so the owning tool can finish committed cleanup.
7. Treat returned publication status, compatibility completeness, retained historical
   generations, instruction-link receipt, issues, warnings, and `nextAction` as
   authoritative. Unknown marker/version, malformed generation, invalid cursor, or
   stale repair basis is a hard stop. Portable validity is separate from root seven
   compatibility-view completeness; no root seven view may be independently mutated
   while portable `INDEX.md` is active. Do not regenerate accepted output or retry
   solely because advisory warnings exist.

## Scope And Progress

Ordinary mapping targets the seven `.blueprint/codebase/*.md` compatibility views.
Portable mode additionally publishes `INDEX.md` and a complete immutable generation
containing routes, records, search pages, semantic data, and immutable compatibility
copies. Its portable transfer unit is `INDEX.md` plus that referenced generation;
root seven views are optional. Sessions, receipts, operation state, HMAC keys, and
rejected diagnostics are excluded. Brownfield mapping may be the first Blueprint
write; it does not bootstrap project core state or create repo-root `CONTEXT.md`.

Portable consumption is generic read/search. Read the index only when repository
understanding is needed, follow the smallest capability route or literal search,
then verify selected claims against current live source. The map is generated from
its baseline and cannot detect new files by itself. Consumption never regenerates
the map, and administrative commands do not acquire a mandatory map-read step.

Execution profile: `long-running-mutation`. Use `Resolve`, `Read`, `Decide`,
`Execute`, `Persist`, `Validate`, and `Route` for meaningful progress, combining
stages covered by one call. State resolved scope, active stage, pending gate,
execution mode, and next safe action when the run pauses or spans multiple steps.

## Optional Instruction Integration

Instruction integration is separate and only runs when explicitly requested. Pass
`linkInstructions: true` and, when the user chooses one, an existing clean
repository-relative `instructionPath` to submit. Use the owning tool's returned
snippet, choices, or link receipt. It never creates instruction files, preserves
bytes outside its managed block and existing newline style, and uses expected-hash
CAS plus regular-file, containment, and symlink checks. A link failure is reported
separately from successful map publication.

## Completion Self-Check

- The command and this skill's active local reference were loaded.
- Evidence was selected before prepare, read after its snapshot or operation basis,
  and kept within that basis through submission. Newly discovered evidence triggered
  prepare again before authoring from it.
- Required document keys were supplied; unchanged valid documents were reused.
  Any overwrite was already authorized, and no manual-edit heuristic or needless
  reuse prompt was introduced.
- All persistence stayed inside the parent-owned submit tool. Rejected content
  was not saved, logged, archived, or described as published. Partial publication
  was reported honestly until the exact retry or explicit fresh reprepare completed.
- Completion used prepare's valid reuse result or submit's successful publication
  receipt, with exact paths and relevant warnings. No extra validation ritual.
- Follow-ups are implemented-only: successful `mapped-only` → `/blu-new-project`,
  initialized → `/blu-progress`, greenfield/scaffold-only → `/blu-new-project`,
  broken partial core state → `/blu-health`, subject to returned availability.
