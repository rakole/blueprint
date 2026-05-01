# Blueprint Defect Discovery Milestone

## What This Is

Blueprint is a Gemini CLI extension, built from scratch, that exposes `/blu` commands and an MCP server for deterministic document CRUD, workflow state management, and advisory automation. This milestone is a read-only defect discovery pass over the existing Blueprint implementation. It must systematically find, classify, and document current defects in `docs/bugs/*.md` without implementing fixes.

Blueprint may resemble GSD in workflow shape, but it is not GSD. All analysis must treat Blueprint as a Gemini-native extension with Blueprint-specific commands, skills, agents, MCP tools, `.blueprint/` runtime state, and Gemini CLI host constraints.

## Core Value

Every meaningful current Blueprint defect is captured as a detailed, evidence-backed bug document that can later drive safe, prioritized fixes.

## Requirements

### Validated

- Existing codebase map is available in `.planning/codebase/` and can ground the audit slices.
- Blueprint runtime contracts, command catalog, command specs, MCP tool docs, host constraints, and memory documents already describe the intended behavior baseline.
- The repository currently has shipped command surfaces across Wave 0 through Wave 5 plus the additive `/blu-impact` command.

### Active

- [ ] Audit Blueprint as its own product, not as GSD or a legacy slash-command port.
- [ ] Split the investigation into small workflow-level or more granular slices.
- [ ] Inspect runtime behavior, docs, command manifests, skills, MCP tools, hooks, tests, packaging, and generated `dist` assets where relevant.
- [ ] Record every confirmed or strongly suspected defect in a dedicated `docs/bugs/*.md` file.
- [ ] Classify each bug by severity, affected surface, confidence, evidence, reproduction path, likely cause, impact, and suggested fix direction.
- [ ] Maintain a bug index so later repair work can choose fixes without rereading the full audit.
- [ ] Stop at discovery and documentation. Do not implement any source fixes in this milestone.

### Out of Scope

- Fixing defects during this milestone - repair work is intentionally deferred until the user chooses follow-up priorities.
- Re-planning Blueprint's command surface - the audit can identify command-surface defects, but it must not silently add, remove, or reroute commands.
- Treating Blueprint as GSD - GSD can provide workflow structure only; product/runtime assumptions must come from Blueprint docs and code.
- Mutating installed extension directories or host-global state - the audit should inspect repo artifacts and tests, not alter user installations.
- Creating new Blueprint runtime features - only bug discovery and documentation belong in this milestone.

## Context

Blueprint is a TypeScript/Node ESM Gemini CLI and Tabnine CLI extension. It is installed from GitHub, launches an MCP server from `dist/mcp/server.js`, exposes command manifests in `commands/*.toml`, orchestrates through `skills/*/SKILL.md`, and persists project state under `.blueprint/` through MCP tools in `src/mcp/tools/*.ts`.

The repository includes rich control-plane documentation:

- `docs/DECISIONS.md` locks product and architecture decisions.
- `docs/ARCHITECTURE.md` describes the extension, command, skill, agent, MCP, and state layers.
- `docs/ARTIFACT-SCHEMA.md` defines `.blueprint/` artifacts and readiness states.
- `docs/MCP-TOOLS.md` lists the live MCP tool surface and model-facing call contracts.
- `docs/GEMINI-CONSTRAINTS.md` captures host-specific and shared host constraints.
- `docs/PHASE-LIFECYCLE.md` defines expected phase artifact flow.
- `docs/SKILLS-AND-AGENTS.md`, `docs/COMMAND-CATALOG.md`, and `docs/RUNTIME-REFERENCE.md` bind command availability, skills, agents, and runtime contracts.

The existing codebase map identifies likely audit pressure points: large MCP tool modules, regex-driven Markdown parsing, permissive schema validation edges, path containment and filesystem race considerations, multi-step roadmap/phase mutations, workspace registry locking, impact-analysis scaling, and cross-platform filesystem behavior.

The output of this milestone should be practical for repair planning. Each bug document should be self-contained enough that a later fixer can understand the defect, reproduce or verify it, judge severity, identify affected files, and choose a safe repair path.

## Constraints

- **Product boundary**: Blueprint is Gemini-native and must not be analyzed as GSD internals or legacy slash-command infrastructure.
- **State boundary**: Runtime state is `.blueprint/`; `.planning/` is local implementation bookkeeping for this audit only.
- **Read-only milestone**: The audit may create or update planning docs and `docs/bugs/*.md`, but must not fix source defects.
- **Evidence standard**: Bug docs must cite concrete files, commands, tests, outputs, or runtime contract mismatches. Uncertainty must be explicit.
- **Routing safety**: `/blu`, `/blu-help`, `/blu-progress`, and `/blu-next` must continue to surface implemented-only commands; any defect around this must be documented, not silently repaired.
- **Host safety**: Do not mutate installed extension directories, user-level `~/.gemini/blueprint/` state, or remote services during bug discovery.
- **Granularity**: Prefer small audit slices that can independently produce bug docs and be reviewed later.
- **Compatibility**: Treat missing optional metadata, optional agents, and optional host tools as normal degradation paths unless evidence shows the runtime violates its documented fallback contract.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| First milestone is discovery-only | The user wants a complete defect map before choosing fixes. | - Pending |
| Output bug reports live under `docs/bugs/*.md` | Keeps defects reviewable outside `.blueprint/` runtime state and separate from implementation planning. | - Pending |
| Use fine-grained audit slices | Blueprint has many shipped command families, so workflow-level slices reduce missed surfaces and make review easier. | - Pending |
| Classify uncertainty instead of overstating certainty | Advisory/read-only discovery must remain honest when evidence is partial. | - Pending |
| Keep Blueprint distinct from GSD | The repo may look workflow-similar, but Blueprint's runtime, state model, and host constraints are different. | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition**:
1. Requirements invalidated? -> Move to Out of Scope with reason.
2. Requirements validated? -> Move to Validated with phase reference.
3. New requirements emerged? -> Add to Active.
4. Decisions to log? -> Add to Key Decisions.
5. "What This Is" still accurate? -> Update if drifted.

**After each milestone**:
1. Full review of all sections.
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state.

---
*Last updated: 2026-05-01 after initialization*
