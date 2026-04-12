---
name: blueprint-roadmap-admin
status: implemented
commands:
  - /blu:add-phase
---

# Blueprint Roadmap Admin Skill

## Purpose

Orchestrate Blueprint roadmap mutations so milestone and phase changes stay deterministic, MCP-owned, and aligned with the retained Blueprint planning pack.

## Parity Goal

Carry forward the useful upstream `add-phase` intent while preserving Blueprint deltas:

- require an explicit phase description instead of guessing
- append a new integer phase by using the highest base phase number and ignoring decimal suffixes when choosing the next number
- keep roadmap writes inside `.blueprint/ROADMAP.md`
- scaffold the new `.blueprint/phases/<NN>-<slug>/` directory through MCP-owned artifact scaffolding
- keep the next step inside the shipped Blueprint lifecycle surface

## Required Inputs

- `docs/commands/add-phase.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/GSD-RUNTIME-MIGRATION.md`

## Required MCP Tools

- `blueprint_roadmap_read`
- `blueprint_roadmap_add_phase`
- `blueprint_artifact_scaffold`
- `blueprint_state_update`

## Optional Agents

- none

## Workflow Rules

1. Require a non-empty phase description before any mutation.
2. Read the roadmap first and stop with recovery guidance if the roadmap is missing or malformed.
3. Require explicit confirmation before appending the phase.
4. Choose the next phase number from the highest base phase number already present in the roadmap and ignore decimal suffixes when counting.
5. Persist the roadmap mutation through `blueprint_roadmap_add_phase`; do not rewrite `.blueprint/ROADMAP.md` directly from the command prompt.
6. Scaffold the new phase directory through `blueprint_artifact_scaffold` by seeding the initial `XX-CONTEXT.md` file.
7. Update `STATE.md` through `blueprint_state_update` so the new phase becomes current and the next safe implemented follow-up is `/blu:discuss-phase <phase>`.
8. Keep follow-up routing inside implemented Blueprint commands only.

## Output Style

- Report the new phase number and description plainly.
- Mention the scaffolded phase path and any reuse warnings.
- End with the next safe implemented action.
