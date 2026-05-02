# Phase 6: Workspace Maintenance Audit - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

## Phase Boundary

Discovery-only audit of Blueprint's workspace, workstream, cleanup, advisory update, and patch-replay maintenance surfaces. Outputs are evidence-backed bug reports in `docs/bugs/*.md`; no source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed-extension, host-global, workspace, patch-registry, git-history, branch, PR, or remote-service fixes are applied in this phase.

Phase 6 should audit the shipped command surfaces listed in the roadmap: `new-workspace`, `remove-workspace`, `workstreams`, `cleanup`, `update`, and `reapply-patches`. The discussion fallback selected all four gray areas: host-global registry atomicity, destructive workspace and cleanup gates, workstream snapshot integrity, and advisory update plus patch-replay boundaries.

## Implementation Decisions

### Host-Global Registry Atomicity
- **D-01:** Phase 6 should treat host-global state as a first-class safety boundary. File a bug when workspace, update, or patch registry behavior can write outside `~/.<host>/blueprint/`, create project-local shadow state, leave stale partial entries, or blur host-specific provenance.
- **D-02:** Workspace registry locking and write atomicity are explicit audit targets. Inspect lock acquisition, lease refresh, stale-lock handling, backup/restore paths, failure injection coverage, and registry/manifest consistency checks before concluding the workspace substrate is safe.
- **D-03:** Update metadata and patch registry writes should be judged by the same persistence standard even when they are less visibly destructive: bounded host-global paths, clear saved-path metadata, honest write-failure reporting, and no silent fallback to ad hoc files.

### Destructive Workspace And Cleanup Gates
- **D-04:** `new-workspace`, `remove-workspace`, and `cleanup` should be audited with a preflight-preview-confirm-mutate-validate posture. File bugs for dirty-tree bypasses, ambiguous workspace targets, registry drift smoothing, incomplete protected-scope previews, missing report-before-mutate behavior, or mutation that can outrun the visible confirmation gate.
- **D-05:** Worktree-backed behavior needs special scrutiny. Official Git worktree behavior refuses unsafe removals unless forced and keeps linked-worktree administrative metadata; Phase 6 should check that Blueprint's worktree creation/removal flows do not overuse `--force`, hide stale metadata risks, or remove the wrong path under registry drift.
- **D-06:** Cleanup should protect current and active-roadmap phase directories strictly. A cleanup defect exists if the command can archive the current phase, archive active roadmap references, treat missing closeout evidence as sufficient, or lose the cleanup report after partial filesystem failure.

### Workstream Snapshot Integrity
- **D-07:** Workstreams are project-local state under `.blueprint/workstreams/`, not host-global registry state. File a bug if the flow reintroduces config toggles, global workstream indexes, `.planning/` ownership, or prompt-only mutation outside `blueprint_workstream_list` and `blueprint_workstream_mutate`.
- **D-08:** Switch, resume, and complete operations should preserve explicit waiting states. Missing snapshots, dirty trees, corrupt indexes, missing workstreams, and archive confirmations must remain visible until resolved instead of being normalized, guessed through, or converted into generic progress output.
- **D-09:** Resume behavior should be audited for bounded state restoration: only the returned `statePatch` should flow into `blueprint_state_update`, `lastUpdated` should remain state-tool owned, and malformed saved snapshots should block rather than partially restoring stale planning state.

### Advisory Update And Patch Replay Boundaries
- **D-10:** `/blu-update` remains advisory. File a bug if it mutates the installed extension directory, implies hot reload/self-update, writes repo-local update artifacts, overstates latest-version certainty when provenance or network lookup is unavailable, or omits restart/manual-fallback guidance.
- **D-11:** `/blu-reapply-patches` should preserve the locked flow `preflight -> preview -> confirm -> replay -> record`. The audit should check that dry-run preview uses the same selected patch ids and target as replay, that conflicts and compatibility mismatches block before mutation, and that replay audits stay under the host-global patch registry.
- **D-12:** Patch replay should use official Git patch-safety expectations as a reference point: `git apply --check`-style preview, default all-or-nothing failure behavior, and path-safety rejection. File bugs when Blueprint's preview/replay path can apply partial changes, unsafe paths, or a broader patch set than the one confirmed.

### Carried-Forward Audit Standards
- **D-13:** Preserve the Phase 2 through Phase 5 evidence bar: prefer confirmed or likely findings with concrete file, command, test, schema, or contract evidence; avoid weak suspected reports unless impact is high and uncertainty is explicit.
- **D-14:** Default evidence approach remains static contract review plus targeted existing tests. Disposable runtime probes are allowed only when they resolve a material ambiguity, must avoid installed-extension and host-global mutation, and must be cleaned up before phase closeout.
- **D-15:** This phase is discovery-only. Audit findings may create or update planning docs and `docs/bugs/*.md`; they must not repair source/runtime behavior, command manifests, skills, tests, generated assets, `.blueprint/` runtime state, installed extension directories, host-global state, workspaces, patch registries, branches, PRs, or git history.

### the agent's Discretion
- The researcher and planner may choose the exact Phase 6 plan slicing, but should make the four discussed areas explicit in the plan set: registry atomicity, destructive workspace/cleanup gates, workstream snapshot integrity, and advisory update/patch replay boundaries.
- The planner may group `new-workspace` and `remove-workspace` together because they share the host-global workspace registry substrate, but should keep `workstreams`, `cleanup`, and `update/reapply-patches` distinct enough that project-local state, destructive archive behavior, and installed-extension boundaries do not get diluted.
- The planner may choose focused test commands per slice from the existing maintenance test suite, favoring targeted metadata/tool tests over broad test runs unless broad runs are needed to resolve a finding.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Guardrails
- `.planning/PROJECT.md` - discovery-only milestone contract, Blueprint-not-GSD boundary, and output target under `docs/bugs/*.md`.
- `.planning/REQUIREMENTS.md` - evidence, classification, workflow coverage, and no-fix requirements, especially `COV-05` and `NFIX-*`.
- `.planning/ROADMAP.md` - Phase 6 goal, suggested surfaces, dependencies, and success criteria.
- `.planning/STATE.md` - current milestone state and active guardrails.
- `.planning/phases/01-bug-taxonomy-and-reporting-harness/01-CONTEXT.md` - bug-reporting harness, evidence standard, and discovery-only decisions carried forward.
- `.planning/phases/03-core-lifecycle-audit/03-CONTEXT.md` - targeted-test posture, lifecycle-state defect threshold, and no-fix boundary decisions carried forward.
- `.planning/phases/04-roadmap-capture-lightweight-audit/04-CONTEXT.md` - preview parity, high-risk confirmation, partial-failure, state-routing, and no-fix decisions carried forward.
- `.planning/phases/05-review-quality-impact-shipping-audit/05-CONTEXT.md` - report-before-mutate posture, high-risk git safety, and evidence-backed mutation standards carried forward.

### Phase 6 Command Specs And Manifests
- `docs/commands/new-workspace.md` and `commands/blu-new-workspace.toml` - workspace creation, registry, manifest, worktree/clone, and confirmation contract.
- `docs/commands/remove-workspace.md` and `commands/blu-remove-workspace.toml` - workspace removal, exact registry verification, drift blockers, dirty-tree blockers, and teardown contract.
- `docs/commands/workstreams.md` and `commands/blu-workstreams.toml` - project-local workstream list/mutate/resume behavior and waiting-state contract.
- `docs/commands/cleanup.md` and `commands/blu-cleanup.toml` - protected phase archival, cleanup report, destination, overwrite, and confirmation contract.
- `docs/commands/update.md` and `commands/blu-update.toml` - advisory update, installed-extension read-only boundary, host-global checklist, and restart guidance contract.
- `docs/commands/reapply-patches.md` and `commands/blu-reapply-patches.toml` - host-global patch registry, preview/replay/audit, compatibility, and confirmation contract.

### Skills And Runtime References
- `skills/blueprint-maintenance/SKILL.md` - shared maintenance orchestration for workspace, workstream, cleanup, update, patch, branch, ship, and undo flows.
- `docs/DECISIONS.md` - global state, update, reapply-patches, workspace, workstreams, and high-risk maintenance decisions.
- `docs/GEMINI-CONSTRAINTS.md` - host-global state, operational update/restart, patch replay, and installed-extension boundaries.
- `docs/COMMAND-CATALOG.md` - declared implemented command status baseline for Phase 6 commands.
- `docs/MCP-TOOLS.md` - authoritative MCP tool surface and model-facing call contracts for workspace, update, patch, artifact, and state tools.
- `docs/RUNTIME-REFERENCE.md` - runtime behavior reference for implemented maintenance commands and known deltas.
- `docs/ARTIFACT-SCHEMA.md` - `.blueprint/` artifact shape, report schemas, and state boundaries.

### Runtime Truth Sources
- `src/mcp/tools/workspace.ts` - workspace registry, lock, create/remove, workstream, patch registry, patch record, and patch replay behavior.
- `src/mcp/tools/update.ts` - update discovery, latest-version lookup, saved checklist planning, and host-global update persistence.
- `src/mcp/runtime-host.ts` - host identity, extension path, and host-global path resolution including `BLUEPRINT_GLOBAL_HOME`.
- `src/mcp/tools/artifacts.ts` - cleanup report authoring, validation, and safe persistence helpers.
- `src/mcp/tools/state.ts` - durable state updates and implemented-command routing after maintenance operations.
- `src/mcp/server.ts` - tool registration and mutation-failure logging wrappers.

### Regression Tests As Evidence Leads
- `tests/new-workspace-metadata.test.ts`
- `tests/remove-workspace-metadata.test.ts`
- `tests/workspace-tools.test.ts`
- `tests/workstreams-metadata.test.ts`
- `tests/workstream-tools.test.ts`
- `tests/cleanup-metadata.test.ts`
- `tests/update-metadata.test.ts`
- `tests/update-tools.test.ts`
- `tests/reapply-patches-metadata.test.ts`
- `tests/patch-tools.test.ts`

### External Behavior References
- `https://git-scm.com/docs/git-worktree.html` - official Git worktree add/remove/list/prune/repair behavior and clean-worktree removal constraints.
- `https://git-scm.com/docs/git-apply/2.19.0` - official Git patch preview, all-or-nothing default application behavior, and unsafe-path rejection details.
- `https://nodejs.org/api/fs.html` - official Node filesystem API reference for sequencing file writes, renames, and removals in persistence code.

## Existing Code Insights

### Reusable Assets
- `src/mcp/tools/workspace.ts` centralizes host-global workspace registry reads/writes, registry locking, workspace create/remove, project-local workstream state, patch registry reads/writes, and patch replay.
- `src/mcp/tools/update.ts` centralizes update discovery, GitHub raw metadata lookup, host-global update checklist persistence, and fallback/manual update guidance.
- `src/mcp/runtime-host.ts` centralizes host/global path resolution and is the key boundary for `~/.<host>/blueprint/` versus project-local `.blueprint/`.
- `src/mcp/tools/artifacts.ts` and `src/mcp/tools/state.ts` provide report and state helpers used by cleanup and follow-up routing.

### Established Patterns
- Commands are thin TOML prompt contracts; skills orchestrate; MCP tools own deterministic persistence, validation, registry writes, and state transitions.
- High-risk maintenance flows should make resolved scope, active stage, pending gate, execution mode, preview/report evidence, and next safe action visible before mutation.
- Host-global operational state is allowed only for cross-project concerns: workspace registry, update metadata, and patch registry.
- Workstream state is explicitly project-local under `.blueprint/workstreams/`, not host-global and not `.planning/`.
- Discovery phases update planning artifacts and bug docs only; source/runtime defects are documented for later repair.

### Integration Points
- Phase 6 should trace each command from `docs/commands/*.md` and `commands/blu-*.toml` into `skills/blueprint-maintenance/SKILL.md`, runtime references, MCP tool handlers, artifact schemas, and focused tests.
- Workspace bugs should cite both registry/manifest contracts and implementation behavior around locking, rollback, path verification, worktree/clone strategy, and dirty-tree checks.
- Workstream bugs should cite list/mutate behavior, waiting states, snapshot reads/writes, and any `STATE.md` patching behavior.
- Update bugs should distinguish advisory/manual fallback defects from real mutation-boundary defects.
- Patch replay bugs should cite registry metadata, dry-run preview, replay behavior, audit writes, compatibility checks, and installed-extension target blocking.

## Specific Ideas

Start Phase 6 with workspace registry atomicity because `new-workspace` and `remove-workspace` share the highest-risk host-global write substrate. Then audit project-local workstreams, cleanup protected-scope behavior, and finally update/patch replay as the operational maintenance slice.

Discussion research notes used to calibrate the audit posture:
- Git worktree documentation supports strict handling of clean versus unclean linked worktrees, stale worktree metadata, and repair/prune behavior.
- Git apply documentation supports preview-first patch replay and treating partial application or unsafe paths as material safety concerns.
- Node filesystem documentation supports careful sequencing around asynchronous writes, renames, and removals in registry/update persistence code.

## Deferred Ideas

None - discussion stayed within phase scope.

---

*Phase: 6-Workspace Maintenance Audit*
*Context gathered: 2026-05-02*
