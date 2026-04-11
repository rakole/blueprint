# New-Project Parity Audit And Parallel Repair Plan

## Scope

- Audit date: 2026-04-11
- Target command: `/blu:new-project`
- Goal: measure how close Blueprint's shipped `new-project` runtime is to the inspected GSD `new-project` workflow, identify the highest-risk drifts, and define a parallelizable repair plan for later implementation.

## Evidence Base

### Blueprint runtime and contract sources

- `docs/commands/new-project.md`
- `commands/blu/new-project.toml`
- `skills/blueprint-bootstrap.md`
- `agents/blueprint-project-researcher.md`
- `agents/blueprint-roadmapper.md`
- `src/mcp/tools/project.ts`
- `src/mcp/tools/config.ts`
- `src/mcp/tools/artifacts.ts`
- `docs/GSD-RUNTIME-MIGRATION.md`
- `docs/HOOKS-POLICIES.md`
- `tests/new-project.test.ts`

### Inspected GSD baseline

- `/Users/rhishi/.codex/skills/gsd-new-project/SKILL.md`
- `/Users/rhishi/.codex/get-shit-done/workflows/new-project.md`
- supporting init and config helpers under `/Users/rhishi/.codex/get-shit-done/bin/lib/`

## Executive Assessment

Blueprint's shipped `new-project` slice is much stronger as a deterministic bootstrap substrate than as a GSD-equivalent project-initialization workflow.

Today it is best described as:

- real MCP-backed project scaffold creation
- normalized config seeding with defaults provenance
- partial overwrite safety
- basic post-init status guidance

It is not yet close to GSD's full bootstrap value, which includes:

- brownfield detection and routing
- deep questioning
- config capture and defaults selection UX
- optional project-level research fan-out
- requirements synthesis
- roadmap creation and approval
- richer next-step routing based on what the bootstrap discovered

## Parity Scorecard

Estimated parity below is source-audit based, not measured from live user cohorts.

| Dimension | Relative parity to GSD | Assessment |
|---|---:|---|
| Performance | 60% | Blueprint likely completes faster in wall-clock time, but mostly because it does far less work than GSD. |
| Usefulness | 35% | It creates a usable `.blueprint/` root, but the resulting planning artifacts are still mostly placeholders rather than trustworthy bootstrap outputs. |
| Workflow coverage | 25% | The highest-value GSD stages after scaffold creation are still missing from the shipped runtime. |
| Determinism and safety | 70% | MCP-owned writes, config normalization, path safety, and rerun protection are meaningful strengths. |
| Output quality | 30% | Placeholder artifacts and thin orchestration produce much weaker bootstrap results than GSD. |
| Overall user-value parity | 35% | Good architecture base, weak behavioral parity. |

## What Blueprint Already Does Well

1. Persistent state changes are MCP-owned, which aligns with Blueprint's core architecture and is cleaner than prompt-owned filesystem mutation.
2. Config handling is materially strong. `blueprint_config_get`, `seedProjectConfig`, saved-default fallback, and removal of repo-level hook keys already provide a solid normalized config story.
3. Safety around reruns is real. `blueprint_project_init` stops on existing `.blueprint/` state unless overwrite is explicit.
4. The command is routable and tested. The current suite verifies tool registration, install-path alignment, config provenance, and core bootstrap artifact creation.
5. The current implementation respects locked Blueprint deltas: `.blueprint/`, Gemini-native command routing, and no installer-style runtime mutation.

These are important strengths. They are also why the command is worth repairing instead of replacing.

## Blueprint vs GSD Comparison

### Current Blueprint behavior

- `commands/blu/new-project.toml` orchestrates a short flow around `blueprint_config_get`, `blueprint_project_init`, optional config/state updates, and `blueprint_project_status`.
- `skills/blueprint-bootstrap.md` states parity goals like brownfield detection and clarifying questions, but does not encode the deeper workflow needed to guarantee them.
- `src/mcp/tools/project.ts` creates `.blueprint/PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, and `.blueprint/phases/`.
- `src/mcp/tools/artifacts.ts` seeds generic starter content for `PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md`.
- `tests/new-project.test.ts` validates file creation, defaults provenance, malformed-default fallback, partial-tree overwrite protection, and basic status reporting.

### Inspected GSD behavior

The inspected GSD workflow does much more than initialization:

- setup checks through `init new-project`
- git init when missing
- brownfield detection and optional `/gsd-map-codebase` routing
- `--auto` document requirements and auto-config handling
- interactive workflow preferences and defaults selection
- deep questioning before `PROJECT.md`
- optional project-level research with multiple parallel researchers plus synthesis
- requirement extraction and validation
- roadmapper-driven roadmap creation, requirement traceability, and state initialization
- approval loops and revision paths before committing roadmap outputs

This is the core reason Blueprint feels much narrower today even though `new-project` is marked `implemented`.

## Drift Matrix

| Drift area | Current Blueprint state | Drift from GSD or Blueprint intent | Impact |
|---|---|---|---|
| Command and spec drift | `docs/commands/new-project.md` promises higher-level bootstrap intent, but `commands/blu/new-project.toml` still drives a short scaffold-first flow | The shipped command does not yet match the depth implied by the spec and migration notes | `implemented` overstates parity |
| Skill drift | `skills/blueprint-bootstrap.md` names the right goals but is only a thin checklist | The skill is not decision-complete enough to reliably reproduce GSD-like bootstrap behavior | Output quality depends on improvisation |
| Agent-contract drift | `blueprint-project-researcher` and `blueprint-roadmapper` are generic stubs | They are far less bounded than the GSD researcher and roadmapper roles they are standing in for | Parallel implementation later would be under-specified |
| MCP capability drift | `blueprint_project_init` scaffolds files and seeds config/state, but there are no dedicated MCP tools yet for rich project capture, bootstrap research, requirements authoring, or roadmap traceability | Blueprint says tools own persistence, but the tool layer cannot yet own the deeper bootstrap artifacts | Parity work risks leaking back into prompt-owned writes |
| Hook and runtime drift | Hook involvement is documented in migration docs and hook policy docs, but `src/hooks/` and `hooks/hooks.json` are still absent | The command claims advisory hook participation in docs only | Safety and artifact-quality protections are weaker than advertised |
| Test and acceptance drift | Tests prove wiring and deterministic scaffold behavior, not behavioral parity | There is no coverage for questioning, brownfield routing, research fan-out, requirements quality, or roadmap generation | Current green tests can create false confidence |

## Primary Gaps

### 1. The shipped command is scaffold-grade, not bootstrap-grade

`src/mcp/tools/project.ts` performs deterministic initialization, but it still stops at starter documents and a generic next action. GSD treats `new-project` as the highest-leverage discovery and scoping workflow in the system, not just directory setup.

### 2. Placeholder artifacts are the biggest quality gap

`src/mcp/tools/artifacts.ts` currently seeds:

- a generic `PROJECT.md` with prompts like "Describe the product outcome"
- a one-row placeholder `REQUIREMENTS.md`
- a starter `ROADMAP.md` with "Phase 1: Discovery and definition"

This is acceptable as bootstrapping substrate, but not as parity with GSD's project initialization value.

### 3. Brownfield handling is too thin

The Blueprint skill says to recommend `/blu:map-codebase` when the repo is clearly brownfield, but there is no deterministic brownfield branch in the current tool flow comparable to GSD's explicit brownfield offer and stop-or-continue path.

### 4. The optional agents are declarative, not operational

The command catalog and docs correctly name `blueprint-project-researcher` and `blueprint-roadmapper`, but the shipped runtime does not truly depend on them for project-level bootstrap quality yet.

### 5. `implemented` status currently means substrate existence, not parity

`blueprint_command_catalog` derives `implemented` from manifest presence, skill presence, and required tool registration. That is enough for runtime exposure discipline, but not enough to communicate behavioral completeness for `new-project`.

### 6. Hook claims are ahead of hook implementation

`docs/HOOKS-POLICIES.md` defines the right hook surfaces, but there is still no shipped hook code or hook config. That makes the runtime safer on paper than in practice.

## Pitfalls

### False confidence from green tests

The existing suite makes the command look stronger than it is because it verifies deterministic scaffold behavior very well. That is useful, but it is not the same as proving parity with GSD bootstrap quality.

### Placeholder artifact poisoning

Later lifecycle commands can inherit low-signal `PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md` content if `new-project` is treated as fully complete after scaffold creation.

### Brownfield repos can be initialized too shallowly

Without a strong brownfield gate, users can initialize a non-trivial repo and end up with generic planning artifacts instead of a trustworthy "map first" or "bootstrap with explicit brownfield assumptions" path.

### Weak next-step routing

Current next-step guidance is too generic for the amount of context the command is supposed to establish. The result is safe, but not especially helpful.

### Parallel implementation collision risk

If later repair work is not split cleanly, command/spec/skill edits, MCP persistence changes, agent contracts, and tests will all overlap in the same files and create avoidable merge friction.

## Recommended Target State

Blueprint should not port GSD file-for-file. It should, however, reach a Blueprint-native equivalent of the same user outcome:

1. Detect fresh vs brownfield repo shape deterministically.
2. Offer defaults and collect meaningful workflow preferences in a structured way.
3. Produce a real `PROJECT.md`, not a prompt shell.
4. Optionally run bounded project-level research through dedicated researcher modes and a synthesizer.
5. Generate scoped `REQUIREMENTS.md` content with durable traceability expectations.
6. Generate a real `ROADMAP.md` and initialize `STATE.md` from that roadmap.
7. End with the next safe implemented command, based on what the bootstrap actually established.

## Parallel Repair Plan

### Workstream A: Command, spec, and skill contract repair

Ownership:

- `docs/commands/new-project.md`
- `commands/blu/new-project.toml`
- `skills/blueprint-bootstrap.md`
- `docs/GSD-RUNTIME-MIGRATION.md` if new bounded deltas must be recorded

Tasks:

- Rewrite the command flow into explicit stages: setup, brownfield gate, defaults/config UX, project capture, optional research, requirements, roadmap, and next-step routing.
- Keep the command thin, but make the orchestration contract decision-complete.
- Clarify what `--auto` must require and what it is allowed to skip.

### Workstream B: Bootstrap MCP and artifact-writing tools

Ownership:

- `src/mcp/tools/project.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/config.ts`
- any new bootstrap-specific MCP tool module if needed

Tasks:

- Keep `blueprint_project_init` as the safe initial bootstrap write.
- Add deterministic MCP-owned persistence for richer project context, bootstrap research artifacts, requirements content, and roadmap/state traceability.
- Upgrade the starter artifact renderers so fallback content is less misleading even before full parity lands.
- Strengthen brownfield signals and next-action derivation in project status.

### Workstream C: Research and roadmap agent contracts

Ownership:

- `agents/blueprint-project-researcher.md`
- `agents/blueprint-roadmapper.md`
- add `agents/blueprint-research-synthesizer.md` if Blueprint chooses to mirror the GSD synthesis stage explicitly

Tasks:

- Split researcher responsibilities into bounded modes such as stack, features, architecture, and pitfalls.
- Define required inputs, output schema, evidence rules, and downstream consumer expectations.
- Expand the roadmapper contract so it owns requirement-to-phase coverage, milestone structure, and `STATE.md` initialization expectations.

### Workstream D: Hooks and packaging

Ownership:

- `src/hooks/`
- `hooks/`
- `hooks/hooks.json`
- hook-related packaging docs and tests

Tasks:

- Implement the documented advisory hook substrate, starting with `read-before-edit` and `.blueprint` write guard.
- Keep hooks advisory only.
- Add packaging and fixture coverage so hook docs stop drifting ahead of runtime.

### Workstream E: Integration and regression tests

Ownership:

- `tests/new-project.test.ts`
- `tests/command-catalog.test.ts`
- new bootstrap-parity tests as needed

Tasks:

- Add behavior tests for brownfield routing, richer status guidance, and `--auto` guardrails.
- Add acceptance tests that validate non-placeholder artifact generation once richer MCP persistence lands.
- Add tests that prove command-catalog truthfulness if `implemented` semantics or capability reporting change.

## Acceptance Criteria For The Later Repair Slice

- `new-project` no longer leaves default placeholder planning artifacts as the primary happy path.
- Brownfield repos get a deterministic and user-visible branch instead of an implied recommendation only.
- Rich bootstrap artifacts are written through MCP tools, not raw command prose.
- Optional agents become bounded, testable contracts rather than generic placeholders.
- Hook documentation matches shipped runtime surfaces.
- Tests cover behavior parity, not just scaffold presence.

## Notes On Verification

This report is based on source inspection plus targeted local verification of the current Blueprint repo.

The existing docs-only slice should keep scope narrow:

- add this report
- do not expand into runtime changes
- do not mix in unrelated control-plane drift repair unless it directly blocks landing the report

## Bottom Line

Blueprint `new-project` is already a solid deterministic bootstrap substrate, but it is still far from GSD in usefulness, coverage, and output quality.

The highest-value next move is not to patch the command prompt alone. It is to repair the whole `new-project` slice across:

- command/spec/skill contract
- MCP persistence surface
- project-level research and roadmap agent contracts
- hook implementation
- parity-focused regression coverage

That gives Blueprint the best chance of reaching GSD-like bootstrap value without violating its locked Gemini-native architecture.
