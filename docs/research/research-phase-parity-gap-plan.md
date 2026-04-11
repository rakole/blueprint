# Research-Phase Parity Audit And Parallel Repair Plan

## Scope

- Target command: `/blu:research-phase`
- Shared surfaces in scope:
  - `commands/blu/research-phase.toml`
  - `skills/blueprint-phase-discovery.md`
  - `agents/blueprint-researcher.md`
  - `src/mcp/tools/phase.ts`
  - `src/mcp/tools/artifacts.ts`
  - `src/mcp/tools/state.ts`
  - advisory hook surfaces for `.blueprint/` writes
  - phase-discovery tests and control-plane docs that describe this command
- Upstream comparison baseline:
  - `/Users/rhishi/.codex/get-shit-done/workflows/research-phase.md`
  - `/Users/rhishi/.codex/skills/gsd-research-phase/SKILL.md`
  - `/Users/rhishi/.codex/agents/gsd-phase-researcher.md`

## Executive Assessment

This shipped Blueprint slice is much closer to "deterministic phase-scoped research artifact scaffolding" than to GSD's full standalone research workflow.

Estimated parity below is inferred from source audit, not benchmarked from live user runs.

| Dimension | Relative parity to GSD | Assessment |
|---|---:|---|
| Performance | 70% | Blueprint is lightweight and likely faster to complete, but that is mostly because it does far less work. |
| Usefulness | 35% | The command can create or preserve `XX-RESEARCH.md`, but it does not reliably produce high-value research on its own. |
| Workflow coverage | 30% | Core GSD behaviors like update/view/skip, continuation, deeper research, and planner-shaped output are missing. |
| Output quality | 20% | Current research output is a blank template unless the model improvises; there is no enforced citation, confidence, or section contract. |
| Operational quality | 45% | MCP scoping and path safety are good, but failure handling, overwrite semantics, and hook coverage are thin. |
| Overall user-value parity | 35% | Good architectural substrate, weak behavioral parity. |

## What Blueprint Already Does Well

1. Phase scope is deterministic. `blueprint_phase_locate`, `blueprint_phase_context`, and `blueprint_phase_research_status` give the command a stable phase boundary.
2. Artifact placement is safe. Phase artifact names and directories are canonicalized and path traversal is blocked.
3. Runtime exposure is disciplined. `research-phase` is only surfaced because manifest, skill, and required MCP tools exist.
4. The command is architecturally aligned with Blueprint decisions. It stays thin and delegates durable writes to MCP tools.
5. There is some regression coverage. Tool registration, artifact permutations, and catalog status are tested.

These are real strengths. They are also the reason this command is salvageable without rewriting the Phase 3 substrate.

## Primary Gaps And Drifts

### 1. The command ships scaffolding, not research

Current behavior:
- `commands/blu/research-phase.toml` resolves the phase, checks status, scaffolds `XX-RESEARCH.md`, updates `STATE.md`, and stops.
- `src/mcp/tools/artifacts.ts` renders a generic research template with placeholder headings only.

Drift from GSD:
- GSD explicitly spawns a dedicated `gsd-phase-researcher`, passes phase context files, and expects a researched artifact back.
- Blueprint marks the command `implemented`, but the shipped value is far narrower than the upstream intent.

Impact:
- The command is fast but often low-value.
- "Implemented" overstates user-facing parity.

### 2. The researcher agent contract is a stub

Current behavior:
- `agents/blueprint-researcher.md` only defines purpose, outputs, and a few boundaries.

Drift from GSD:
- GSD's researcher has mandatory initial reads, source hierarchy, claim provenance rules, confidence reporting, required section names, checkpoint handling, and explicit downstream planner expectations.
- Blueprint's agent does not define what "good research" looks like.

Impact:
- Output quality depends on model improvisation.
- Parallel implementation later will have no durable contract to test against.

### 3. The research artifact schema is not planner-shaped

Current behavior:
- Blueprint scaffolds:
  - `## Question`
  - `## Findings`
  - `## Recommendations`
  - `## Sources`

Drift from GSD:
- GSD research expects sections like:
  - `## User Constraints`
  - `## Standard Stack`
  - `## Architecture Patterns`
  - `## Don't Hand-Roll`
  - `## Common Pitfalls`
  - `## Code Examples`
- Existing `.planning/*-RESEARCH.md` files in this repo already use those richer sections.

Impact:
- Future `plan-phase` work risks inheriting a weak research contract.
- The shipped runtime artifact format is behind both upstream GSD and this repo's own internal planning research format.

### 4. There is no MCP-owned content write path for real research

Current behavior:
- The only exposed persistence primitive here is `blueprint_artifact_scaffold`.
- It can create or replace a file, but it cannot persist structured researched content with validation.

Drift from Blueprint architecture:
- Blueprint says tools own persistence, yet the moment we want real research text instead of a placeholder template, the current MCP surface runs out.

Impact:
- The next parity step cannot stay cleanly inside the current MCP contract.
- If implemented naively, the model will start writing raw file content outside the intended state boundary.

### 5. Overwrite protection lives in prompt prose, not tool semantics

Current behavior:
- The command prompt says overwrite requires explicit confirmation.
- The tool surface only has `overwrite?: boolean`.

Drift:
- There is no stronger MCP-level replace guard, no compare token, no "view/update/skip" structure, and no artifact revision awareness.

Impact:
- Safety depends too much on prompt obedience.
- This is weaker than both GSD's interactive update/view/skip path and Blueprint's own deterministic state goals.

### 6. Missing-artifact recovery is weaker than the docs claim

Current behavior:
- `readRoadmap()` in `src/mcp/tools/phase.ts` reads `.blueprint/ROADMAP.md` directly and throws if it is missing.
- The command docs promise precise missing-artifact recovery guidance.

Drift:
- The tool layer does not always degrade into structured "missing prerequisite" responses.

Impact:
- Partial repos can fail as raw tool errors instead of guided recovery.
- This weakens the command exactly in the scenario where users most need help.

### 7. Next-step routing is underpowered

Current behavior:
- The command prompt says to mention `/blu:ui-phase` when it is available, else prefer `/blu:progress`.
- The command does not read `blueprint_command_catalog`.

Drift:
- Runtime-aware routing is a locked Blueprint rule, but this command cannot verify availability itself.

Impact:
- It currently works only because `ui-phase` is shipped today.
- The contract is brittle and less deterministic than the rest of Blueprint's routing surfaces.

### 8. Hook coverage is documented but not implemented

Current behavior:
- `docs/HOOKS-POLICIES.md` and `docs/GSD-RUNTIME-MIGRATION.md` define three advisory hooks.
- There is no `src/hooks/`, no `hooks/`, and no `hooks/hooks.json`.

Drift:
- Research-phase writes `.blueprint/` artifacts, but the promised `.blueprint` write guard and read-before-edit advisories do not exist.

Impact:
- No advisory protection against malformed research artifacts or prompt-injection markers.
- No test coverage for research-phase-adjacent hook behavior.

### 9. Tests prove wiring, not parity

Current behavior:
- Current tests check:
  - command prompt references the registered tools
  - artifact presence booleans
  - scaffold reuse behavior
  - catalog status

Missing coverage:
- populated research content
- citation/provenance rules
- confidence annotations
- existing-research update/view/skip flow
- missing-roadmap and missing-phase-dir recovery
- next-action state updates
- hook advisories
- parity with upstream GSD workflow milestones

Impact:
- The current suite gives good confidence in the scaffold, but weak confidence in the user experience.

### 10. There is adjacent control-plane drift around the shipped Phase 3 surface

Observed during verification:
- `README.md` still lists only Wave 0 runtime files in its "Current Runtime Layout" section.
- A targeted test run surfaced one pre-existing stale expectation in `tests/drift-repair-docs.test.ts` that still expects a Phase 2.2/Phase 3-era state message.

Impact:
- This is not the core research-phase bug, but it increases confusion around what is actually shipped.

## Important Non-Drifts To Preserve

These should remain intact while fixing parity gaps:

1. `.blueprint/` stays the runtime source of truth.
2. Commands stay thin and user-facing.
3. MCP tools continue to own durable writes.
4. Hooks stay advisory rather than state-owning.
5. `/blu`, `/blu:help`, and `/blu:progress` keep implemented-only routing.
6. Blueprint should not become a file-for-file port of GSD internals.

## Recommended Target State

`/blu:research-phase` should become a thin Blueprint-native orchestrator with these properties:

1. It resolves a phase deterministically and fails with structured recovery messages.
2. It offers an explicit existing-research path: view, update, or skip.
3. It passes phase context, requirements, state, and repo constraints into `blueprint-researcher`.
4. It persists real research content through MCP, not raw prompt-side file writes.
5. It writes a planner-friendly `XX-RESEARCH.md` schema with citations, confidence, recommendations, and pitfalls.
6. It updates `STATE.md` with a deterministic next safe action based on runtime command availability.
7. It gains advisory hook coverage for `.blueprint/` artifact writes, without making hooks state-owning.

## Proposed Fixes

### Fix A: Lock the runtime research contract before Phase 4 planning work

Update docs so the runtime contract is explicit and stable:

- `docs/commands/research-phase.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/GSD-RUNTIME-MIGRATION.md`

Define:
- the required research sections
- citation and confidence expectations
- existing-research decision paths
- which Blueprint config fields influence research behavior
- which routing decisions must consult runtime availability

Why first:
- `plan-phase` depends on `research-phase`.
- If we do not lock this now, Phase 4 will build on a weak artifact contract.

### Fix B: Add a real MCP persistence primitive for phase research content

Recommended direction:
- add a content-bearing phase artifact write tool rather than overloading `blueprint_artifact_scaffold` forever

Suggested shape:
- `blueprint_phase_artifact_write`
  - inputs: `phase`, `artifactKind`, `content`, `overwrite`, optional validation mode
  - outputs: `path`, `created|updated|reused`, `warnings`

Minimum requirements:
- phase-scoped only
- schema-aware validation for `RESEARCH`
- reject accidental cross-phase writes
- reject replacement unless explicitly requested

Why:
- this is the missing substrate that separates "placeholder scaffolding" from "real MCP-owned research persistence"

### Fix C: Upgrade `blueprint-researcher` into a real bounded contract

Bring over the useful GSD patterns, but keep Blueprint deltas:

Retain from GSD:
- mandatory initial context reads
- project-constraint awareness
- source hierarchy and provenance tags
- confidence reporting
- prescriptive recommendations
- structured completion markers for the parent command

Keep Blueprint-specific deltas:
- `.blueprint/` paths
- MCP-owned persistence
- no hidden shell workflow as the primary state mechanism

### Fix D: Make the command/skill orchestration genuinely research-oriented

Upgrade:
- `commands/blu/research-phase.toml`
- `skills/blueprint-phase-discovery.md`

So the runtime flow becomes:

1. resolve phase
2. load context, requirements, state, and research status
3. inspect existing research
4. choose view/update/skip
5. run bounded researcher when research is needed
6. persist returned content through MCP
7. update state with a deterministic next safe action

### Fix E: Strengthen phase MCP recovery behavior

Improve:
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/state.ts`

Targets:
- structured errors for missing roadmap / missing phase directory / ambiguous phase
- readiness warnings for stale or incomplete discovery artifacts
- deterministic next-action calculation that can use runtime command availability

### Fix F: Implement the advisory hook layer that this command already depends on in docs

Add:
- `src/hooks/`
- `hooks/hooks.json`
- hook tests

Minimum useful research-phase hook coverage:
- read-before-edit advisory for existing `XX-RESEARCH.md`
- `.blueprint` write guard for malformed or suspicious research writes
- workflow advisory for off-contract repo edits during discovery flows

### Fix G: Replace wiring-only tests with behavior-oriented coverage

Add or expand tests for:
- existing research view/update/skip
- populated `RESEARCH.md` validation
- citation / confidence section presence
- missing-roadmap recovery
- next-action state changes
- hook advisory behavior
- parity-sensitive agent contract markers

## Parallel Implementation Plan

This split is designed to minimize merge conflicts and let several workers move at once after the contract freeze.

### Phase 0: Contract Freeze

Single owner first:
- Worker 0

Files:
- `docs/commands/research-phase.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/GSD-RUNTIME-MIGRATION.md`

Exit condition:
- research artifact schema, MCP write shape, and routing rules are agreed

### Parallel Track 1: MCP Substrate

Owner:
- Worker 1

Files:
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/state.ts`
- `src/mcp/server.ts`

Deliverables:
- content-bearing artifact write path
- structured recovery returns
- next-step substrate improvements

### Parallel Track 2: Command / Skill / Runtime Agent

Owner:
- Worker 2

Files:
- `commands/blu/research-phase.toml`
- `skills/blueprint-phase-discovery.md`
- `agents/blueprint-researcher.md`

Deliverables:
- GSD-like flow with Blueprint deltas
- existing-research handling
- stronger agent contract

### Parallel Track 3: Hooks

Owner:
- Worker 3

Files:
- `src/hooks/*`
- `hooks/hooks.json`
- new hook fixture tests

Deliverables:
- advisory hook implementations that support research-phase safety without owning state

### Parallel Track 4: Tests And Fixtures

Owner:
- Worker 4

Files:
- `tests/phase-discovery-research.test.ts`
- `tests/phase-discovery-tools.test.ts`
- new hook and integration tests
- any golden fixture files needed for research outputs

Deliverables:
- parity-sensitive regression suite

### Parallel Track 5: Control-Plane Sync

Owner:
- Worker 5

Files:
- `README.md`
- `MEMORY.md`
- `docs/HANDOFF.md`
- `tests/drift-repair-docs.test.ts`

Deliverables:
- docs and drift tests that stop misreporting the shipped research-phase surface

## Recommended Ownership Boundaries

To avoid overlap:

1. Worker 0 owns contract docs only.
2. Worker 1 owns only `src/mcp/tools/*` and `src/mcp/server.ts`.
3. Worker 2 owns only command, skill, and runtime agent files.
4. Worker 3 owns only hooks and hook tests.
5. Worker 4 owns behavior tests that touch no production docs or command files.
6. Worker 5 owns control docs and drift tests only.

## Acceptance Criteria For The Repair Slice

The repair is complete when all of the following are true:

1. `/blu:research-phase` can produce a populated, cited, confidence-tagged `XX-RESEARCH.md`, not just a placeholder template.
2. Existing research is handled through an explicit view/update/skip path.
3. Real research content is persisted through MCP, not raw prompt-side file writes.
4. Missing-roadmap and partial-phase failures return structured recovery guidance.
5. Next-step routing is runtime-aware and does not recommend blocked commands.
6. Advisory hooks exist for the documented research-phase safety surfaces.
7. Tests cover the main user behaviors and failure modes, not just wiring.
8. The contract is strong enough that `plan-phase` can safely consume `XX-RESEARCH.md` later.

## Suggested Verification Suite

Minimum targeted suite after implementation:

```bash
npm run build --silent
tsx --test \
  tests/phase-discovery-tools.test.ts \
  tests/phase-discovery-research.test.ts \
  tests/command-catalog.test.ts
```

Add new targeted suites for:
- hook fixtures
- integration from context -> research -> state update
- control-plane truth for shipped Phase 3 runtime files

Then run:

```bash
npm test
```

## Recommendation

Do this repair before starting `plan-phase`.

Reason:
- `plan-phase` is the first downstream consumer that will force the runtime research contract to matter.
- If we let Phase 4 proceed on the current scaffold-only `research-phase`, we will encode drift into the planner and have to unwind it later.
