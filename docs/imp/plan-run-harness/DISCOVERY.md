# Plan-Run Harness Discovery

Wave: 0
Date: 2026-06-10
Scope: Blueprint Plan-to-PR execution harness

This discovery pass is read-only with respect to runtime behavior. It grounds the
implementation plan in current Blueprint source and identifies the smallest safe
reuse seams before adding PlanRun tools or command manifests.

## Source Files Read

- `README.md`
- `package.json`
- `src/mcp/tool-definitions.ts`
- `src/mcp/tools/workspace.ts`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/review.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/command-runtime-metadata.ts`
- `commands/blu-execute-phase.toml`
- `commands/blu-reapply-patches.toml`
- `tests/patch-tools.test.ts`
- `tests/workspace-tools.test.ts`
- `tests/execute-phase-summary-tools.test.ts`
- `tests/execute-phase-metadata.test.ts`
- `skills/blueprint-phase-execution/SKILL.md`
- `skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md`
- `skills/blueprint-maintenance/references/reapply-patches-runtime-contract.md`

## Discovery Answers

### 1. Existing phase functions that can resolve phase and plan id

- `src/mcp/tools/phase.ts`: `blueprintPhaseLocate` is exported and registered as `blueprint_phase_locate`. It resolves a requested phase through `resolveRequestedPhaseForRoadmap`, returning `phaseNumber`, `phasePrefix`, `phaseName`, `phaseDir`, artifacts, and a `reason` when unresolved.
- `src/mcp/tools/phase-locations.ts`: `resolveRequestedPhase` is exported and reusable. It accepts an optional numeric phase and roadmap phases, then resolves explicit input, state, or roadmap fallback.
- `src/mcp/tools/phase-numbering.ts`: `normalizePhaseNumber`, `normalizeBlueprintInput`, `extractPhaseNumberToken`, and `formatPhasePrefix` are exported and reusable for canonical numeric phase handling.
- `src/mcp/tools/phase-plan-identifiers.ts`: `normalizePlanId` and `planPathFor` are exported and reusable. `normalizePlanId("2")` canonicalizes to the existing two-digit artifact id form used by plan paths, and `planPathFor` builds `<phaseDir>/<phasePrefix>-<planId>-PLAN.md`.

Reuse strategy: use the public exported helpers from `phase-numbering.ts`, `phase-locations.ts`, and `phase-plan-identifiers.ts` for pure path/model helpers. For tool-level preflight, call exported MCP handlers such as `blueprintPhaseLocate`, `blueprintPhasePlanRead`, and `blueprintPhaseExecutionTargets` instead of copying phase parser logic from `phase.ts`.

### 2. Existing function that returns plan metadata

- `src/mcp/tools/phase.ts`: `blueprintPhasePlanRead` is exported and registered as `blueprint_phase_plan_read`. Its `metadata` packet includes `title`, `wave`, `gapClosure`, `status`, `objective`, `dependsOn`, `requirements`, `filesModified`, `readFirst`, `acceptanceCriteria`, `externalServicePrerequisites`, and `autonomous`.
- `src/mcp/tools/phase.ts`: `blueprintPhaseExecutionTargets` is exported and registered as `blueprint_phase_execution_targets`. It returns selected/candidate plans with execution gating, missing dependency plans, existing summary metadata, blocker reasons, overlap/conflict information, and `externalServicePreflight`.
- Not found as one exact function: no single current helper returns `files modified`, `read-first docs`, `verification commands`, `dependencies`, and `external service prerequisites` in exactly the future PlanRun shape. The closest current source of truth is `blueprintPhasePlanRead.metadata` plus `blueprintPhaseExecutionTargets` for execution-time blockers and selected plan state.

Implementation implication: Wave 4 `blueprint_plan_run_prepare` should use `blueprintPhasePlanRead` for saved plan metadata and `blueprintPhaseExecutionTargets` for execution readiness. If later waves need explicit verification commands, add a small extractor over plan content/metadata rather than inventing a new phase parser.

### 3. Exported and reusable functions from `phase.ts`

Exported tool handlers in `src/mcp/tools/phase.ts` include:

- `buildBlueprintPhaseDirectoryPath`
- `blueprintPhaseValidationAuthoringContext`
- `blueprintPhaseValidationValidateModel`
- `blueprintPhaseValidationRender`
- `blueprintRoadmapRead`
- `blueprintRoadmapAddPhase`
- `blueprintRoadmapInsertPhase`
- `blueprintRoadmapRemovePhase`
- `blueprintRoadmapPromoteBacklog`
- `blueprintPhaseLocate`
- `blueprintPhaseContext`
- `blueprintPhaseResearchStatus`
- `blueprintPhaseArtifactRead`
- `blueprintPhaseArtifactScaffold`
- `blueprintPhaseArtifactWrite`
- `blueprintPhaseUiSkipWrite`
- `blueprintPhaseValidationRead`
- `blueprintPhaseValidationWrite`
- `blueprintPhasePlanIndex`
- `blueprintPhasePlanRead`
- `blueprintPhasePlanValidate`
- `blueprintPhasePlanAuthoringContext`
- `blueprintPhasePlanReadiness`
- `blueprintPhasePlanValidateModel`
- `blueprintPhasePlanWrite`
- `blueprintPhaseSummaryIndex`
- `blueprintPhaseSummaryAuthoringContext`
- `blueprintPhaseSummaryValidateModel`
- `blueprintPhaseSummaryRead`
- `blueprintPhaseExecutionTargets`
- `blueprintPhaseSummaryWrite`
- `blueprintPhaseCheckpointGet`
- `blueprintPhaseCheckpointPut`
- `blueprintPhaseCheckpointDelete`
- `phaseToolDefinitions`

Private but relevant functions in `phase.ts` include `resolveRequestedPhaseForRoadmap`, `resolvePhaseRuntimeSnapshot`, `readPhasePlanFromResolved`, `phasePlanAuthoringContextFromData`, and multiple summary authoring helpers. PlanRun work should not import or depend on these until they are deliberately extracted.

### 4. Workspace helpers that are private but needed for worktree creation

Private helpers in `src/mcp/tools/workspace.ts` relevant to PlanRun preparation include:

- `runGit`
- `resolveGitRepoRoot`
- `gitCurrentBranch`
- `gitHeadSha`
- `gitWorkingTreeClean`
- `localBranchExists`
- `remoteBranchExists`
- `resolveDefaultWorkspaceRoot`
- `resolveWorkspacePath`
- `validateWorkspaceBranchName`
- `resolveSourceRepos`
- `ensureWorkspaceTargetIsSafe`
- `ensureWorkspaceTargetDoesNotExist`
- `createWorkspaceMember`
- `withWorkspaceRegistryLock`

These helpers are not exported. Exporting all of them would leak a large internal workspace substrate into another tool family.

### 5. Safer workspace creation strategy

Preferred: call exported `blueprintWorkspaceCreate` from `src/mcp/tools/workspace.ts` for worktree creation. It already validates workspace name and branch, resolves source repos, blocks dirty source repos, rejects installed-extension targets, prevents workspace paths inside source repos, checks registry uniqueness, acquires the host-global workspace registry lock, rolls back partial worktree/branch creation, writes the workspace manifest, and writes the registry.

Fallback: export only one or two small read-only git helpers from a shared module if PlanRun needs source git facts before calling `blueprintWorkspaceCreate`. Do not copy complete workspace creation logic into `plan-run.ts`.

### 6. Exact git commands already wrapped in `workspace.ts`

`src/mcp/tools/workspace.ts` wraps git through private `runGit`. Current wrapped commands include:

- `git rev-parse --show-toplevel`
- `git branch --show-current`
- `git rev-parse HEAD`
- `git status --short`
- `git status --short --untracked-files=all -- . :(exclude).blueprint/workstreams/** :(exclude).blueprint/STATE.md` equivalent pathspec form for workstream transitions
- `git rev-parse --verify --quiet refs/heads/<branch>`
- `git rev-parse --verify --quiet refs/remotes/origin/<branch>`
- `git remote get-url origin`
- `git check-ref-format --branch <branch>`
- `git worktree add <path> <branch>`
- `git worktree add --track -b <branch> <path> origin/<branch>`
- `git worktree add -b <branch> <path> HEAD`
- `git worktree add --detach <path> HEAD`
- `git worktree remove --force <path>`
- `git branch --delete --force <branch>`
- `git clone <source> <path>`
- `git checkout -b <branch>`
- `git checkout -b <branch> --track origin/<branch>`
- `git worktree list --porcelain`
- `git apply --check --verbose <patch...>`
- `git apply --verbose --whitespace=nowarn <patch...>`

PlanRun diff helpers will need additional commands that are not currently public in `workspace.ts`, such as `git diff --name-status`, `git diff --stat`, and bounded `git diff --binary`.

### 7. Patch record provenance and compatibility

`src/mcp/tools/workspace.ts`: `blueprintPatchRecord` is exported and registered as `blueprint_patch_record`.

It computes provenance by resolving the replay target repo with `resolvePatchReplayTarget`, normalizing the patch id with `validateFieldNameSegment`, normalizing tracked files inside the repo root, resolving the active runtime host, reading the host-global patch registry, hashing normalized patch content with SHA-256, resolving `repoRemote` with `git remote get-url origin`, and choosing `sourceVersion` from input or `git rev-parse HEAD`.

It writes:

- `<registry>/<patchId>.patch`
- `<registry>/<patchId>.json`
- `<registry>/index.json` when new
- `<registry>/<patchId>.audit.ndjson`

Compatibility includes active host, repo root name, and remote URL. Existing stored patches can be updated while preserving `createdAt`, prior source metadata when no new patch content is supplied, and audit history.

### 8. Patch reapply clean tree and compatibility enforcement

`src/mcp/tools/workspace.ts`: `blueprintPatchReapply` is exported and registered as `blueprint_patch_reapply`.

It resolves the target repo, rejects installed-extension targets, loads selected or compatible patch ids, checks `git status --short`, and throws before mutation if the working tree is dirty. For each patch, it reads the manifest, loads patch content, and builds compatibility status from host, repo root name, and remote URL. Compatibility mismatch throws before mutation. It then runs `git apply --check --verbose` for the selected patch set; conflicts return as structured `conflicts` and do not mutate. Only non-dry runs after a successful check call `git apply --verbose --whitespace=nowarn`.

### 9. Temporary git repo test strategy

`tests/helpers/git-fixtures.ts` provides reusable temp git helpers:

- `runGit(args, cwd?)`
- `initializeGitRepo(repoPath)` with `git init -b main` fallback to `git init` plus `git checkout -b main`
- `createGitRepo(prefix)`
- `createCommittedGitRepo(prefix)`
- `createCommittedGitWorktree(prefix)`

`tests/patch-tools.test.ts` and `tests/workspace-tools.test.ts` also duplicate the same temp-repo pattern inline with:

- `fs.mkdtemp(path.join(os.tmpdir(), "..."))`
- `git init -b main` with fallback to `git init` plus `git checkout -b main`
- local git user config
- baseline `README.md`
- `git add README.md`
- `git commit -m init`
- `BLUEPRINT_GLOBAL_HOME` overrides for host-global registry isolation

Reuse this fixture style for PlanRun git and workspace tests. Keep cleanup in `t.after(() => fs.rm(tempRoot, { recursive: true, force: true }))`.

### 10. Runtime metadata fields for new commands

`src/mcp/command-runtime-metadata.ts` owns runtime command metadata. Each new command needs a `RuntimeOwnedCommandMetadata` object with:

- `commandName`
- `sourceId`
- `catalog.wave`
- `catalog.family`
- `catalog.primarySkill`
- `catalog.declaredStatus`
- `catalog.risk`
- `requiredTools` typed as `readonly BlueprintInternalToolName[]`
- `optionalAgents` typed as `readonly BlueprintAgentName[]`
- optional `requiredInputPaths`
- `spec.path`
- `spec.title`
- `spec.executionProfile`
- `spec.rootRoutable`
- `spec.purpose`
- `spec.reads`
- `spec.writes`
- `runtimeReference.path`
- `runtimeReference.waveTitle`
- `runtimeReference.command`
- `runtimeReference.primarySkill`
- `runtimeReference.exactMcpDestination`
- `runtimeReference.optionalAgents`
- `runtimeReference.hookInvolvement`
- `runtimeReference.contractNotes`
- `runtimeReference.evidenceState`

The metadata must also be added to `RUNTIME_OWNED_COMMAND_METADATA`, and every optional agent must pass `assertKnownBlueprintOptionalAgents`.

### 11. Generated command assets to refresh

`package.json` defines `npm run generate:commands` as `tsx scripts/generate-command-registry.ts`.

That script refreshes:

- `generated/command-catalog.json`
- generated blocks in `README.md`
- generated blocks in `docs/COMMAND-CATALOG.md`
- generated blocks in `commands/blu.toml`
- generated blocks in `commands/blu-help.toml`
- generated runtime matrix block in `docs/RUNTIME-REFERENCE.md`

Any runtime metadata or command manifest addition must run `npm run generate:commands` and review these generated diffs.

### 12. Existing docs or README sections to mention the new flow

When commands ship, update generated command registry surfaces via `npm run generate:commands` first. Human-authored docs to add or inspect:

- `docs/PLAN-RUN-HARNESS.md` for the full harness overview.
- `docs/commands/run-plan.md`
- `docs/commands/review-diff.md`
- `docs/commands/fix-run-review.md`
- `docs/commands/rollback-plan.md`
- `docs/commands/open-pr.md`
- `README.md` around "Command Chooser", "Running a phase end to end", and "Common Workflows". Generated blocks must be changed by the generator, not by hand.
- `docs/RUNTIME-REFERENCE.md` generated matrix after metadata changes.
- Adjacent command docs to cross-reference only when the new commands become first-class: `docs/commands/root-router.md`, `docs/commands/help.md`, `docs/commands/plan-phase.md`, `docs/commands/execute-phase.md`, `docs/commands/quick.md`, `docs/commands/debug.md`, `docs/commands/pr-branch.md`, and `docs/commands/ship.md`.

## Proposed Reuse Strategy

- Add `src/mcp/tools/plan-run.ts` for PlanRun-owned types, paths, persistence, diff metadata, review records, rollback records, and PR package reports.
- Register `planRunToolDefinitions` in `src/mcp/tool-definitions.ts` only when handlers exist and are safe.
- Reuse `ensureRepoRoot`, `resolveBlueprintPath`, `toRepoRelativePath`, `writeJsonFile`, and `withBlueprintRepoLock` from `src/mcp/tools/artifacts.ts` for project-local PlanRun persistence.
- Reuse `normalizePlanId` and `planPathFor` from `src/mcp/tools/phase-plan-identifiers.ts`.
- Reuse `normalizePhaseNumber` and `formatPhasePrefix` from `src/mcp/tools/phase-numbering.ts`.
- Reuse exported phase tool handlers for phase location, plan read, execution targets, and summary writes instead of importing private `phase.ts` helpers.
- Reuse `blueprintWorkspaceCreate` for worktree creation.
- Reuse `blueprintPatchRecord`, `blueprintPatchList`, and `blueprintPatchReapply` for patch persistence and replay.
- Add local PlanRun git diff helpers in `plan-run.ts` for `rev-parse`, `status`, `diff --name-status`, `diff --stat`, and bounded patch text. Keep them small and PlanRun-specific unless a later shared git helper module becomes justified.

## Proposed Files To Modify By Wave

Wave 1:

- Add `src/mcp/tools/plan-run.ts`
- Add `tests/plan-run-paths.test.ts`
- Modify `src/mcp/tool-definitions.ts` only if harmless read/validation stubs are ready

Wave 2:

- Modify `src/mcp/tools/plan-run.ts`
- Modify `src/mcp/tool-definitions.ts`
- Add `tests/plan-run-record.test.ts`

Wave 3:

- Modify `src/mcp/tools/plan-run.ts`
- Add `tests/plan-run-git.test.ts`

Wave 4:

- Modify `src/mcp/tools/plan-run.ts`
- Modify `src/mcp/tools/workspace.ts` only if a minimal export is proven necessary
- Add `tests/plan-run-prepare.test.ts`

Wave 5 and later:

- Add `commands/blu-run-plan.toml`
- Add `skills/blueprint-plan-run/SKILL.md`
- Add `skills/blueprint-plan-run/references/*.md`
- Modify `src/mcp/command-runtime-metadata.ts`
- Run `npm run generate:commands`
- Add command metadata/runtime tests
- Add docs only after the corresponding command behavior exists

## Explicit Do Not Touch Yet

- Do not change `/blu-execute-phase` behavior in early waves.
- Do not add `/blu-run-plan`, `/blu-review-diff`, `/blu-fix-run-review`, `/blu-rollback-plan`, or `/blu-open-pr` manifests before matching tools and tests exist.
- Do not mark new commands `implemented` before manifest, primary skill, required MCP tools, runtime metadata, generated command catalog, and tests align.
- Do not write command prompts that create raw `.blueprint/` files.
- Do not bypass `blueprint_patch_record`, `blueprint_patch_reapply`, or `blueprint_workspace_create`.
- Do not mutate installed extension directories or host-global `~/.gemini/blueprint/` during tests; use `BLUEPRINT_GLOBAL_HOME` temp overrides.
- Do not add remote PR API calls in v1.
- Do not trust model-provided changed-file lists in git-aware waves.

## Test Fixture Strategy

- Use Node test runner style from existing tests.
- Use temp directories under `os.tmpdir()`, with `t.after` cleanup.
- Prefer `tests/helpers/git-fixtures.ts` for new shared git fixtures. Inline the existing `initializeGitRepo` fallback pattern only when the test file's local style already does that.
- Configure local test git identity before commits.
- Override `BLUEPRINT_GLOBAL_HOME` for host-global workspace and patch registry tests.
- Build minimal `.blueprint/ROADMAP.md` and phase plan fixtures using existing phase artifact paths and saved plan file conventions.
- For Wave 1 path tests, avoid git mutation except temp path construction.
- For Wave 2 persistence tests, use project-local temp roots and assert writes stay under `.blueprint/runs`.
- For Wave 3 git tests, compute changed files from real git diff rather than fixture arrays.
- For Wave 4 worktree tests, call `blueprintWorkspaceCreate` in isolated temp repos and assert dirty source blocks before mutation.

## Open Questions And Risks

- Verification command extraction is not currently exposed as a clean field from `blueprintPhasePlanRead.metadata`. It may need a narrow extractor from plan content or a later extension to plan metadata.
- `blueprintPhaseExecutionTargets` selects pending plan sets, not an arbitrary single `planId`. `blueprint_plan_run_prepare` will need to verify the requested `planId` is known, valid, and not blocked without weakening existing execute-phase ordering rules.
- Workspace creation currently creates a workspace root containing a repo member subdirectory. PlanRun output should clearly return both `workspacePath` and the repo member path that agents should edit.
- PlanRun rollback will need a strict distinction between preview data and actual shell mutation because existing rollback behavior is not a public MCP surface except workspace removal and patch replay.
