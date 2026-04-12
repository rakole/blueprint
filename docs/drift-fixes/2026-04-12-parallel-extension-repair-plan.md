# Parallel Extension Repair Plan

## Purpose

This is the single execution plan for closing all open issues surfaced by:

- `docs/drift-fixes/2026-04-12-custom-agent-audit-and-fix-plan.md`
- `docs/drift-fixes/2026-04-12-gemini-cli-extension-gap-analysis-and-rescue-plan.md`

No new feature development should start until every `P0` and `P1` task in this
plan is complete, the extension runtime smoke passes, and the final regression
sweep is green.

## Current Truth Snapshot

The two source reports describe different repo moments. This plan treats the
live repo as the source of truth as of `2026-04-12`.

Already repaired:

- Gemini subagent frontmatter now exists in all shipped `agents/*.md`.
- Agent `description`, `kind`, `tools`, `max_turns`, and `timeout_mins` now
  exist in the shipped agent files.

Still open and must be closed in this repair round:

- skills are still flat `skills/*.md` files instead of Gemini-discoverable
  `skills/<name>/SKILL.md`
- command prompts still reference repo file paths like `skills/...` and
  `agents/...md`
- command prompts and many tests still speak in raw internal tool names instead
  of the chosen runtime naming contract
- `src/mcp/tools/project.ts` still models skill paths as `skills/<name>.md`
- `availableOptionalAgents` is still based on file presence rather than agent
  validity
- most agent behavior contracts are still too thin for reliable bounded work
- docs still blur skills and agents in a few places
- extension verification is still too source-oriented and too shallow
- release/discoverability hardening is still incomplete

## Rules

- Do not treat this plan doc as live task state.
- Do not mark task status in git-tracked files during parallel work.
- Use the shared memory CLI below for claiming, notes, handoffs, block reasons,
  and completion records.
- Keep tasks small. If a task starts widening, split it in shared memory and
  only continue after the split is documented.
- Every completed task must leave:
  - a claim record
  - a completion record
  - at least one note when findings would help the next agent
  - targeted tests plus one broader regression pass when practical

## Shared Memory

Use the committed helper:

```bash
node scripts/drift-fix-memory.mjs init --branch "$(git branch --show-current)"
node scripts/drift-fix-memory.mjs status
```

Default shared-memory root:

```text
~/.gemini/blueprint/agent-memory/2026-04-12-extension-and-agent-repair/
```

Override with `BLUEPRINT_DRIFT_MEMORY_ROOT` only if the whole repair swarm is
using the same override.

Use the memory for:

- active task claims
- shared discoveries such as Gemini CLI testing notes
- task-scoped handoffs
- completion records with tests run

Do not use the memory for:

- long-term Blueprint runtime state
- feature planning outside this repair round
- storing secrets

## Working Protocol

1. Open this plan doc and identify the first unblocked task whose dependencies
   are done and whose write scope does not overlap with an active claim.
2. Register the current worktree:
   `node scripts/drift-fix-memory.mjs register-agent --agent AGENT_ID --worktree "$PWD" --branch "$(git branch --show-current)"`
3. Claim the task:
   `node scripts/drift-fix-memory.mjs claim --agent AGENT_ID --task TASK_ID --summary "short scope"`
4. Do only the claimed write scope.
5. Add notes when you discover reusable information:
   `node scripts/drift-fix-memory.mjs note --agent AGENT_ID --task TASK_ID --title "Finding" --body "..."`.
6. If blocked, record it and release the task through:
   `node scripts/drift-fix-memory.mjs block --agent AGENT_ID --task TASK_ID --reason "..."`.
7. On completion, record tests and touched files:
   `node scripts/drift-fix-memory.mjs complete --agent AGENT_ID --task TASK_ID --summary "..." --tests "..." --files "a,b,c"`.

## Recommended Parallel Batches

For `3` agents at a time:

1. Batch A: `DF-005`, `DF-006`, `DF-007`
2. Batch B: `DF-001`, `DF-002`, `DF-003`
3. Batch C: `DF-008`, `DF-009`, `DF-010`
4. Batch D: `DF-011`, `DF-012`, `DF-013`
5. Batch E: `DF-014`, `DF-015`, `DF-016`
6. Batch F: `DF-017`

For `5` agents at a time:

1. Start with `DF-001`, `DF-002`, `DF-003`, `DF-005`, `DF-006`
2. Then run `DF-007`, `DF-008`, `DF-009`, `DF-010`, `DF-011`
3. Finish with `DF-012`, `DF-013`, `DF-014`, `DF-015`, `DF-016`
4. Keep `DF-017` as the final closeout task

## Task Queue

### `DF-001` Runtime Vocabulary Contract

- Priority: `P0`
- Depends on: none
- Write scope:
  - `src/mcp/tools/project.ts`
  - new shared helper if needed under `src/` or `tests/`
- Goal:
  - define one canonical contract for skill paths, agent names, internal tool
    names, and runtime MCP FQNs
  - stop path/name guessing in code and tests
- Done when:
  - runtime vocabulary is derived from one source of truth
  - `skillPath` no longer assumes `skills/<name>.md`
  - the chosen runtime naming contract is explicit in code
- Required verification:
  - targeted catalog/runtime-name tests

### `DF-002` Skill Packaging Conversion: Foundation Skills

- Priority: `P0`
- Depends on: `DF-001`
- Write scope:
  - `skills/blueprint-router/`
  - `skills/blueprint-bootstrap/`
  - `skills/blueprint-governance/`
  - `skills/blueprint-map/`
- Goal:
  - convert these flat skills into Gemini-discoverable `SKILL.md` directories
  - add routing-friendly `description` frontmatter
- Done when:
  - the old flat files are removed or replaced safely
  - each migrated skill has valid `name` and `description`
- Required verification:
  - targeted skill discovery/schema tests

### `DF-003` Skill Packaging Conversion: Lifecycle And Roadmap Skills

- Priority: `P0`
- Depends on: `DF-001`
- Write scope:
  - `skills/blueprint-phase-discovery/`
  - `skills/blueprint-phase-planning/`
  - `skills/blueprint-phase-execution/`
  - `skills/blueprint-phase-validation/`
  - `skills/blueprint-roadmap-admin/`
- Goal:
  - same as `DF-002`, but for the remaining shipped skills
- Done when:
  - all shipped skills live at `skills/<name>/SKILL.md`
  - every skill has metadata Gemini can preload
- Required verification:
  - targeted skill discovery/schema tests

### `DF-004` Optional-Agent Validity Guardrails

- Priority: `P0`
- Depends on: `DF-001`
- Write scope:
  - `src/mcp/tools/project.ts`
  - `tests/command-catalog.test.ts`
  - new agent-validity tests
- Goal:
  - keep command status semantics unchanged while stopping invalid agent files
    from being reported as available
- Done when:
  - `availableOptionalAgents` requires metadata validity, not just file presence
  - invalid test fixtures can prove the guardrail works
- Required verification:
  - targeted command catalog tests
  - new agent schema/metadata test

### `DF-005` Agent Contract Repair: Planner And Checker

- Priority: `P0`
- Depends on: none
- Write scope:
  - `agents/blueprint-planner.md`
  - `agents/blueprint-checker.md`
- Goal:
  - restore real plan-synthesis and plan-review contracts
- Done when:
  - planner encodes plan schema, dependency waves, must-haves, task fields, and
    revision behavior
  - checker encodes goal-backward review dimensions plus blocker/warning output
- Required verification:
  - targeted agent contract test or fixture
  - targeted `plan-phase` regression pass

### `DF-006` Agent Contract Repair: Executor And Verifier

- Priority: `P0`
- Depends on: none
- Write scope:
  - `agents/blueprint-executor.md`
  - `agents/blueprint-verifier.md`
- Goal:
  - restore real execution-summary and validation/UAT contracts
- Done when:
  - executor encodes per-plan execution, deviation handling, and summary shape
  - verifier encodes summary-first validation, UAT mode, and gap classification
- Required verification:
  - targeted agent contract test or fixture
  - targeted `execute-phase` and validation regression pass

### `DF-007` Agent Contract Repair: Bootstrap, Discovery, UI, Roadmap, Mapping

- Priority: `P1`
- Depends on: none
- Write scope:
  - `agents/blueprint-project-researcher.md`
  - `agents/blueprint-roadmapper.md`
  - `agents/blueprint-mapper.md`
  - `agents/blueprint-researcher.md`
  - `agents/blueprint-ui-designer.md`
- Goal:
  - strengthen the remaining bounded specialists without reintroducing GSD
    persistence ownership
- Done when:
  - each agent has explicit context reads, output contract, write boundary, and
    non-goals
  - `blueprint-researcher` preserves its stronger section contract
- Required verification:
  - targeted discovery/map/new-project regression pass

### `DF-008` Command Prompt Rewrite: Foundation And Governance

- Priority: `P0`
- Depends on: `DF-001`, `DF-002`
- Write scope:
  - `commands/blu.toml`
  - `commands/blu/help.toml`
  - `commands/blu/progress.toml`
  - `commands/blu/next.toml`
  - `commands/blu/new-project.toml`
  - `commands/blu/settings.toml`
  - `commands/blu/set-profile.toml`
  - `commands/blu/health.toml`
  - `commands/blu/pause-work.toml`
  - `commands/blu/resume-work.toml`
- Goal:
  - remove repo file-path activation language and switch to runtime identities
- Done when:
  - no prompt in this batch references `skills/...` or `agents/...md`
  - tool references follow the chosen runtime naming contract
- Required verification:
  - targeted prompt-contract tests

### `DF-009` Command Prompt Rewrite: Discovery And Lifecycle

- Priority: `P0`
- Depends on: `DF-001`, `DF-003`, `DF-005`, `DF-006`, `DF-007`
- Write scope:
  - `commands/blu/discuss-phase.toml`
  - `commands/blu/research-phase.toml`
  - `commands/blu/ui-phase.toml`
  - `commands/blu/list-phase-assumptions.toml`
  - `commands/blu/plan-phase.toml`
  - `commands/blu/execute-phase.toml`
  - `commands/blu/validate-phase.toml`
  - `commands/blu/verify-work.toml`
- Goal:
  - align lifecycle prompts with runtime skill/subagent/tool identities and the
    repaired agent contracts
- Done when:
  - path-oriented prompt wording is gone
  - lifecycle prompts remain self-sufficient without hidden skill magic
- Required verification:
  - targeted lifecycle metadata tests

### `DF-010` Command Prompt Rewrite: Roadmap Slice

- Priority: `P0`
- Depends on: `DF-001`, `DF-003`, `DF-007`
- Write scope:
  - `commands/blu/add-phase.toml`
  - `commands/blu/remove-phase.toml`
  - `commands/blu/plan-milestone-gaps.toml`
  - `commands/blu/audit-milestone.toml`
- Goal:
  - align roadmap prompts with runtime identities and remove stale agent/skill
    path references
- Done when:
  - the roadmap-admin batch is path-free and contract-consistent
- Required verification:
  - targeted roadmap metadata tests

### `DF-011` Documentation Truth Sync

- Priority: `P1`
- Depends on: `DF-002`, `DF-003`, `DF-005`, `DF-006`, `DF-007`, `DF-008`, `DF-009`, `DF-010`, `DF-016`
- Write scope:
  - `docs/ARCHITECTURE.md`
  - `docs/SKILLS-AND-AGENTS.md`
  - `docs/GSD-RUNTIME-MIGRATION.md`
  - `docs/DRIFT.MD`
  - any command spec whose wording still mismatches repaired runtime behavior
- Goal:
  - make the docs reflect the repaired extension surface exactly
- Done when:
  - skill-vs-agent mislabels are gone
  - skill layout docs match `skills/<name>/SKILL.md`
  - migration docs do not describe stale prompt/file-path behavior
- Required verification:
  - targeted docs and command-contract tests

### `DF-012` Catalog And Metadata Tests Over Discoverable Skills

- Priority: `P0`
- Depends on: `DF-002`, `DF-003`, `DF-004`
- Write scope:
  - `tests/command-catalog.test.ts`
  - command metadata tests that still assert `skills/*.md`
- Goal:
  - rebuild the catalog assertions around actual extension discoverability
- Done when:
  - tests stop hard-coding flat skill paths
  - tests fail if a shipped skill becomes undiscoverable again
- Required verification:
  - targeted command catalog test pass

### `DF-013` Extension Discovery And Runtime Contract Tests

- Priority: `P0`
- Depends on: `DF-001`, `DF-002`, `DF-003`, `DF-004`, `DF-008`, `DF-009`, `DF-010`
- Write scope:
  - new tests for:
    - extension discovery
    - skill schema
    - runtime tool contract
    - command prompt runtime contracts
- Goal:
  - make extension-surface drift impossible to miss in PRs
- Done when:
  - tests fail on `skills/*.md`
  - tests fail on `agents/...md`
  - tests fail on stale tool-name contracts
- Required verification:
  - run the new targeted test files

### `DF-014` Built Asset Smoke Tests

- Priority: `P1`
- Depends on: `DF-013`
- Write scope:
  - new smoke tests for:
    - `dist/hooks/*.js`
    - `dist/mcp/server.js`
- Goal:
  - test what Gemini actually loads, not just `src/`
- Done when:
  - built hooks execute successfully
  - built MCP output starts and exposes the expected tool set
- Required verification:
  - targeted built-asset smoke tests

### `DF-015` Clean-Home Gemini CLI Smoke And Shared Notes

- Priority: `P1`
- Depends on: `DF-013`
- Write scope:
  - test or script harness for temporary-home smoke
  - shared notes in drift memory documenting local Gemini CLI behavior
- Goal:
  - prove the local extension can be validated and linked in a clean Gemini home
- Done when:
  - the repo has a repeatable smoke path for:
    - `gemini extensions validate . --debug`
    - `gemini extensions link .`
    - `gemini extensions list`
  - findings are written into shared memory for later agents
- Required verification:
  - actual local smoke run if environment permits
  - if blocked, a precise blocked note with evidence

### `DF-016` Manifest And Release Hardening

- Priority: `P1`
- Depends on: none
- Write scope:
  - `gemini-extension.json`
  - `README.md`
  - release or operator docs if needed
- Goal:
  - close the medium-severity extension-product gaps
- Done when:
  - manifest has a real extension `description`
  - release guidance includes build, test, validate, and clean-home smoke
  - `excludeTools` is either adopted or explicitly documented as deferred
- Required verification:
  - targeted manifest/docs checks

### `DF-017` Final Regression Sweep And Closeout

- Priority: `P0`
- Depends on: `DF-004`, `DF-011`, `DF-012`, `DF-013`, `DF-014`, `DF-015`, `DF-016`
- Write scope:
  - no broad refactors
  - final repair notes in `docs/drift-fixes/` only if a closeout note is needed
- Goal:
  - verify the repair round is actually closed
- Done when:
  - `npm test` passes
  - extension validation smoke passes
  - shared memory shows no active claims for open `P0` or `P1` tasks
  - any blocked items are either fixed or explicitly accepted as deferred
- Required verification:
  - full test suite
  - final smoke commands

## Definition Of Done For Every Task

- keep the write scope narrow
- leave tests that prove the change
- do not revert unrelated user changes
- do not widen command exposure or alter implemented-status semantics
- do not reintroduce `.planning/` or `/gsd:*`
- add a shared-memory note when you learn something the next agent can reuse

## Copy-Paste Agent Prompt

```text
You are working on Blueprint drift-repair only. Do not start any feature work.

Primary source of truth:
- docs/drift-fixes/2026-04-12-parallel-extension-repair-plan.md

Coordination rules:
1. Read the plan doc first.
2. Use the shared memory CLI instead of editing the plan doc for status:
   - node scripts/drift-fix-memory.mjs status
   - node scripts/drift-fix-memory.mjs register-agent --agent AGENT_ID --worktree "$PWD" --branch "$(git branch --show-current)"
3. Pick the next available task with no unmet dependencies and no active claim on an overlapping write scope.
4. Claim it before editing:
   - node scripts/drift-fix-memory.mjs claim --agent AGENT_ID --task TASK_ID --summary "short scope"
5. Keep the task narrow. If the scope is too large, stop and leave a note proposing a split.
6. Before changing files, read the relevant command spec, skill, agent, and test files in your task scope.
7. Preserve Blueprint rules:
   - implemented-only routing stays unchanged
   - command status semantics stay unchanged
   - persistent Blueprint runtime state remains MCP-owned
   - do not reintroduce .planning or /gsd commands
8. When you discover something useful for other agents, write it to shared memory:
   - shared note: node scripts/drift-fix-memory.mjs note --agent AGENT_ID --title "Finding" --body "..."
   - task note:   node scripts/drift-fix-memory.mjs note --agent AGENT_ID --task TASK_ID --title "Finding" --body "..."
9. Run targeted tests for your scope and at least one broader regression pass when practical.
10. On success, record completion:
   - node scripts/drift-fix-memory.mjs complete --agent AGENT_ID --task TASK_ID --summary "what changed" --tests "commands run" --files "file1,file2"
11. If blocked, record the blocker instead of guessing:
   - node scripts/drift-fix-memory.mjs block --agent AGENT_ID --task TASK_ID --reason "exact blocker"
12. Create a new worktree for yourself to work on, once work is completed push the worktree to remote, raise PR to main, merge it. Once merged, cleanup the branches and update local main.
Execution style:
- Work from the plan doc, not from memory.
- Keep outputs concrete and repo-specific.
- Use subagents only when they can own a disjoint sub-scope inside your claimed task.
- Do not silently fix unrelated issues.
- Do not leave undocumented follow-up drift in your area.
```
