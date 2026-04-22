# Blueprint Gemini-First Effectiveness Spine Slice Plan

## Summary

- Rollout posture: implemented-first, hybrid pilot. Start with a tiny shared contract layer, prove it on router + lifecycle flows, then fan out family by family.
- Small-slice rule: one slice may touch at most one command family, one owning skill file, one agent contract file, one runtime doc cluster, and one focused test cluster. Add runtime code only when that slice truly needs it.
- Standard command-slice asset bundle: `commands/blu-<command>.toml`, `docs/commands/<command>.md`, the owning `skills/.../SKILL.md` section, the matching `docs/RUNTIME-REFERENCE.md` row, and the narrowest metadata/fixture tests. Agent slices update exactly one `agents/*.md` file plus its tests. Infra slices update one runtime module plus schema/docs/tests.

## Public Interfaces To Add Or Change

- Shared execution profile on command-facing assets: `router`, `interactive-read`, `long-running-mutation`, `high-risk-maintenance`.
- Shared stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`.
- Shared in-flight status contract: resolved scope, active stage, pending gate, execution mode, next safe action.
- Later infra slices add config keys `ux.progress_mode`, `ux.structured_confirmations`, `ux.user_checkpoints`, `orchestration.task_tracker`, `research.external_sources`.
- Later infra slices add read-only MCP resource URIs for command catalog, per-command contract, phase bundle, codebase bundle, and latest reports.

## Slice Map

1. `S0` Shared contract foundation
- `S0.1` Add a Gemini-tools playbook doc with allowed uses for `ask_user`, `write_todos`, `update_topic`, tracker tools, `get_internal_docs`, web tools, MCP resources, and shell.
- `S0.2` Update `docs/commands/_template.md` and `docs/RUNTIME-REFERENCE.md` to require execution profile, stage vocabulary, and in-flight status fields.
- `S0.3` Add metadata tests that enforce those new fields across command docs/runtime reference.
- `S0.4` Align `GEMINI.md`, `docs/GEMINI-CONSTRAINTS.md`, and `docs/TEST-STRATEGY.md` to the new spine.

2. `S1` Router pilot
- `S1.1` `/blu` manifest + `skills/blueprint-router/SKILL.md`: add "what Blueprint is waiting on" contract.
- `S1.2` `help` manifest/doc/runtime-ref row.
- `S1.3` `progress` manifest/doc/runtime-ref row.
- `S1.4` `next` manifest/doc/runtime-ref row.
- `S1.5` Router tests for implemented-only exposure plus waiting-state reporting.

3. `S2` Lifecycle pilot
- `S2.1` `plan-phase`: manifest/doc/skill profile, stage narration, structured reuse/revise/replace gate.
- `S2.2` `blueprint-planner` and `blueprint-checker`: parent owns orchestration/checkpoints/persistence; agents stay bounded.
- `S2.3` `execute-phase`: manifest/doc/skill add `update_topic` + `write_todos` contract.
- `S2.4` `blueprint-executor`: progress checkpoints, summary-ready output, shell isolation.
- `S2.5` `validate-phase`: visible verification stages and pending-gate language.
- `S2.6` `verify-work`: UAT checkpoint and review/skip/stop gate language.
- `S2.7` `add-tests`: bounded mutation plus verification-status contract.
- `S2.8` Integration tests for `plan -> execute -> validate -> verify -> add-tests`.

4. `S3` Lightweight execution
- `S3.1` `quick`: manifest/doc/skill + optional-agent coordination + tracker eligibility.
- `S3.2` `debug`: manifest/doc/skill + debugger contract + explicit todo-capture gate.
- `S3.3` `fast`: doc/profile alignment only; explicitly no tracker, no long-running progress layer.
- `S3.4` Focused tests proving trivial-flow exclusions vs long-running visibility rules.

5. `S4` Review and docs family
- `S4.1` `code-review`.
- `S4.2` `code-review-fix`.
- `S4.3` `audit-fix`.
- `S4.4` `secure-phase`.
- `S4.5` `review`.
- `S4.6` `ui-review`.
- `S4.7` `docs-update`.
- `S4.8` Agent-contract slices for `blueprint-reviewer`, `blueprint-verifier`, `blueprint-security-auditor`, `blueprint-ui-auditor`, `blueprint-doc-writer`, `blueprint-doc-verifier`.
- `S4.9` Safety tests for overwrite gates, scope confirmation, bounded remediation, and approved external-tool families.
- Rule for every `S4.x` command slice: one command at a time, updating manifest + spec + owning skill + runtime-ref row + focused tests only.

6. `S5` Maintenance family
- `S5.1` `pr-branch`: report-before-mutate waiting-state language.
- `S5.2` `ship`: tracker/todos contract for branchy shipping flow.
- `S5.3` `undo`: destructive-gate contract and visible pending approval.
- `S5.4` `cleanup`: destructive-gate contract and protected-scope visibility.
- `S5.5` Maintenance tests for dirty-tree aborts, report-before-mutate, pending approval, and next safe action.

7. `S6` Discovery/bootstrap/read-heavy family
- `S6.1` `new-project`: normalize existing rich Gemini behavior into the shared profile/stage contract without removing current tracker/todos/topic/docs behavior.
- `S6.2` `map-codebase`.
- `S6.3` `discuss-phase`.
- `S6.4` `research-phase`.
- `S6.5` `ui-phase`.
- `S6.6` `list-phase-assumptions`: profile/doc alignment only.
- `S6.7` Agent slices for `blueprint-project-researcher`, `blueprint-roadmapper`, `blueprint-researcher`, `blueprint-ui-designer` to codify external-research and self-correction rules.

8. `S7` Roadmap-admin and capture family
- `S7.1` `note`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, `explore`: profile alignment and confirmation-language cleanup; no progress infra unless a command is actually long-running.
- `S7.2` `add-phase`, `insert-phase`, `remove-phase`, `plan-milestone-gaps`, `audit-milestone`, `complete-milestone`, `milestone-summary`, `new-milestone`: one command per slice, mainly `ask_user` standardization plus waiting-gate language where it helps.
- `S7.3` Shared capture/roadmap tests for confirmation style and implemented-only routing.

9. `S8` Shared runtime infra, only after the pilots prove the contract
- `S8.1` Config docs/schema/tests for `ux.*`, `orchestration.task_tracker`, `research.external_sources`.
- `S8.2` Implement those config keys in [config.ts](/Users/rhishi/dev/repositories/blueprint/src/mcp/tools/config.ts) plus `settings` docs/tests.
- `S8.3` MCP resource contract docs/tests in `docs/MCP-TOOLS.md`, `docs/ARTIFACT-SCHEMA.md`, and `docs/RUNTIME-REFERENCE.md`.
- `S8.4` Resource implementation: command catalog + per-command contract.
- `S8.5` Resource implementation: phase bundle + codebase bundle. Blocked as of 2026-04-22 until the resource contract can carry repo/workspace scope for project-local bundle reads and keep bundle warnings strictly read-only.
- `S8.6` Resource implementation: latest reports index.
- `S8.7` Router/progress/discovery adoption of resources with fallback coverage.

Blocked slice note:

- `S8.5` should not resume from the abandoned implementation attempt.
- The blocker is contract-level, not just code-level: `blueprint://phases/<phase>/bundle` and `blueprint://codebase/bundle` currently lack an explicit project selector, so reads can resolve against the server process `cwd` instead of the intended Blueprint repo.
- The blocked attempt also leaked write-oriented inventory language into the codebase bundle, so the next pass must preserve the locked read-only resource posture at the payload level, not only in docs.
- `S8.7` remains downstream of a fixed `S8.5` because router/progress/discovery adoption cannot safely consume incorrectly scoped bundle resources.

## Test Plan

- Every command slice updates one metadata test, one command-doc/runtime-ref consistency test, and only the narrowest fixture/integration test for the changed behavior.
- Every agent slice updates agent schema/specialist tests plus one behavior-contract test.
- Every infra slice adds fallback tests proving non-Gemini hosts still behave coherently when Gemini-only tools or resources are unavailable.
- Highest-priority behavior audits: `execute-phase`, `quick`, `validate-phase`, `verify-work`, `audit-fix`, `ship`, `undo`.

## Subagent Pattern Per Slice

- Implementation subagent: exact write set for the slice only.
- Verification subagent: no writes; runs targeted tests/checks against the slice acceptance criteria.
- Review subagent: no writes; reviews only the diff for drift, scope creep, missing tests, and contract mismatch.
- Main agent: integrates only minimal follow-up changes, reruns the same targeted checks, and closes the slice.

## Prompt To Run One Slice

```text
Implement Blueprint slice <SLICE-ID>: <SLICE-NAME>.

Read first:
- AGENTS.md
- docs/future-looking/gemini-cli-tooling/blueprint-gemini-first-effectiveness-spine.md
- docs/future-looking/gemini-cli-tooling/blueprint-gemini-first-effectiveness-spine-slice-plan.md
- docs/future-looking/gemini-cli-tooling/blueprint-gemini-first-effectiveness-spine-slice-execution-pattern.md
- the exact slice section or row from docs/future-looking/gemini-cli-tooling/blueprint-gemini-first-effectiveness-spine-slice-index.md
- any locked Blueprint reference docs directly named by this slice
- only the exact files in this write set: <FILES>

Hard scope:
- do not widen beyond this slice
- do not touch planned-command routing
- preserve implemented-only exposure
- keep MCP as the only persistence layer
- keep hooks advisory
- if this is a doc-only slice, do not change runtime code

Execution pattern:
1. Create a fresh worktree/branch for this slice.
2. Do a short grounding pass on the listed files and current targeted tests.
3. Spawn one implementation subagent with the exact write set above.
4. After implementation returns, spawn one verification subagent to run only the targeted checks for this slice.
5. After verification returns, spawn one review subagent to do a code-review pass on the diff only.
6. Apply only the minimum fixes needed from verifier/reviewer feedback.
7. Re-run the same targeted checks and report completion against the slice acceptance criteria.

Required output:
- files changed
- tests/checks run
- acceptance criteria met / not met
- residual risks
- exact next slice recommended

Default stance:
- prefer tiny edits
- prefer existing repo patterns
- keep manifest, command doc, owning skill, runtime reference row, and tests aligned when they are in scope
```

## Assumptions And Defaults

- Coverage is implemented-first; planned commands remain extension points, not scheduled rollout work.
- Rollout is hybrid: minimal shared contract first, then router + lifecycle pilots, then family-by-family fan-out.
- `new-project` stays the reference implementation early and is normalized later, after the shared contract is proven on smaller flows.
