# Phase 3: Phase Discovery - Research

**Researched:** 2026-04-11
**Domain:** Blueprint Wave 1 discovery command implementation (`discuss-phase`, `research-phase`, `ui-phase`)
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-01 | User can capture phase context and discussion decisions as durable phase artifacts. | Implement `blueprint_phase_locate`, `blueprint_phase_context`, and `blueprint_roadmap_read` as deterministic MCP tools; ship `/blu:discuss-phase` with explicit overwrite confirmation and writes for `XX-CONTEXT.md` plus optional `XX-DISCUSSION-LOG.md`. |
| LIFE-02 | User can run targeted phase research when technical uncertainty exists. | Reuse phase-location/context tools, add `blueprint_phase_research_status`, and ship `/blu:research-phase` for deterministic `XX-RESEARCH.md` generation with state updates and replacement confirmation. |
| LIFE-03 | User can generate a UI spec or explicit UI-skip rationale for frontend-heavy phases. | Ship `/blu:ui-phase` with UI-indicator checks, config-aware gating (`workflow.ui_phase`, `workflow.ui_safety_gate`), and deterministic `XX-UI-SPEC.md` or explicit skip-rationale recording. |

</phase_requirements>

## Summary

Phase 3 should be delivered as a strict Wave 1 substrate slice: introduce missing phase MCP tools first, then ship each discovery command with explicit command contracts, deterministic artifact writes, and regression tests that keep router exposure aligned with runtime truth.

Current runtime blockers are concrete and already visible in `blueprint_command_catalog`: missing command manifests, missing `blueprint-phase-discovery` skill, and missing phase tool family (`blueprint_phase_locate`, `blueprint_phase_context`, `blueprint_roadmap_read`, `blueprint_phase_research_status`). Contract-completeness blockers also remain: the bounded-agent files for `blueprint-researcher` and `blueprint-ui-designer` are still absent, and the Phase 3 plans should not treat those as optional paperwork after Phase 3 implementation has already begun.

The key implementation pattern is to keep commands thin and put all durable state behavior in MCP tools. For this phase, that means adding a dedicated `src/mcp/tools/phase.ts` family and extending artifact scaffolding for phase artifacts instead of embedding direct file writes in command prompts.

## Existing Constraints That Must Stay True

- Preserve Blueprint's implemented-only router policy (`/blu`, `/blu:help`, `/blu:progress` recommend only runtime-implemented commands).
- Keep `.blueprint/` as runtime source of truth and avoid introducing `.planning/` semantics into product runtime.
- Keep command contracts aligned across `docs/COMMAND-CATALOG.md`, `docs/SKILLS-AND-AGENTS.md`, and per-command specs as each command moves from planned to implemented.
- Keep Phase 4+ commands blocked after this phase; only Phase 3 discovery commands should become implemented in this slice.
- Keep `XX-UI-SPEC.md` as the single locked phase-scoped UI artifact; a skipped UI path should write rationale there rather than inventing a second artifact.

## Recommended Delivery Shape

1. Shared substrate first:
- Add phase tools (`locate`, `context`, `roadmap_read`, `research_status`) plus tests.
- Register phase tools in MCP server.
- Expand artifact scaffolding for `XX-CONTEXT.md`, `XX-DISCUSSION-LOG.md`, `XX-RESEARCH.md`, `XX-UI-SPEC.md` templates.

2. Command-by-command shipping:
- Plan `03-01`: `discuss-phase` + phase substrate + command-catalog rollout update for `discuss-phase`.
- Plan `03-02`: `research-phase` orchestration + bounded researcher agent contract + command-catalog rollout update for `research-phase`.
- Plan `03-03`: `ui-phase` orchestration + bounded UI agent contract + final discovery-skill/documentation rollout updates.

3. Regression lock:
- Add focused tests for phase tools and each command manifest contract.
- Update command-catalog regression expected implemented set as each discovery command becomes real.
- Flip the shared `blueprint-phase-discovery` skill-family status only after the shared skill file and the three core discovery commands are all present.

## Architecture Patterns

### Pattern 1: Phase Resolution Through MCP

Use one deterministic phase resolver shared by discovery commands:
- input: phase reference (explicit arg or inferred from active state)
- output: `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- enforce root path safety and roadmap-backed resolution

### Pattern 2: Artifact-First Discovery Flow

Each command should scaffold/validate before orchestration:
- `discuss-phase` -> `XX-CONTEXT.md`, optional `XX-DISCUSSION-LOG.md`
- `research-phase` -> `XX-RESEARCH.md`
- `ui-phase` -> `XX-UI-SPEC.md` or explicit skip rationale

### Pattern 3: Config-Aware UI Gate

`ui-phase` behavior should respect normalized config:
- `workflow.ui_phase=false` -> skip generation with explicit reason
- `workflow.ui_safety_gate=true` -> require explicit UI-skip rationale when no UI work is detected
- defaults and precedence come from `blueprint_config_get` effective scope
- the explicit skip rationale lives in `XX-UI-SPEC.md`, preserving the locked artifact schema

## Anti-Patterns To Avoid

- Writing phase artifacts directly from command prompt text without MCP ownership.
- Marking command catalog rows implemented without manifest + skill + required tool substrate.
- Deferring command-catalog rollout updates until the end of Phase 3 after individual commands have already become runtime-implemented.
- Letting Phase 3 command shipping silently expose other blocked Wave 1 commands (`plan-phase`, `execute-phase`, `validate-phase`, `verify-work`, `next`, `pause-work`, `resume-work`).
- Inventing a separate UI-skip artifact instead of using the locked `XX-UI-SPEC.md` surface.
- Reusing generic artifact scaffolding templates that omit phase-numbered filenames or required sections.

## Validation Architecture

### Test Infrastructure

- Framework: `node:test` via `tsx --test`
- Build prerequisite: `npm run build --silent`
- Quick suite:
  - `tsx --test tests/phase-discovery-tools.test.ts tests/phase-discovery-discuss.test.ts tests/phase-discovery-research.test.ts tests/phase-discovery-ui.test.ts tests/command-catalog.test.ts`
- Full suite:
  - `npm test`

### Validation Gate Strategy

- After each task-level command/tool change: run the most local phase-discovery test file.
- After each plan: run phase-discovery tests plus `tests/command-catalog.test.ts`.
- Before phase completion: run full `npm test`.

### Required Assertions

- Phase tools return stable typed shapes and reject invalid phase references safely.
- Each shipped command manifest references only registered MCP tools.
- Catalog marks exactly the shipped discovery commands as implemented, with no accidental elevation of later commands.
- Router/help/progress behavior remains implemented-only.

## Canonical References

- `AGENTS.md`
- `docs/DECISIONS.md`
- `docs/DRIFT.MD`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/PHASE-LIFECYCLE.md`
- `docs/IMPLEMENTATION-ORDER.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/commands/discuss-phase.md`
- `docs/commands/research-phase.md`
- `docs/commands/ui-phase.md`
- `src/mcp/server.ts`
- `src/mcp/tools/project.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/state.ts`
- `tests/command-catalog.test.ts`
