# Blueprint State Management Defects

Investigation date: 2026-05-22

## Investigation Scope

This audit covered state management, lifecycle state transitions, routing, and effective-config behavior across these workflows:

- `spec-phase`
- `discuss-phase`
- `research-phase`
- `plan-phase`
- `execute-phase`
- `validate-phase`
- `verify-work`
- `code-review`
- `code-review-fix`
- `secure-phase`
- `health`
- `progress`

This was discovery only. No source defects were fixed. The artifact was written from a fresh worktree at `/Users/rhishi/dev/repositories/blueprint-state-management-defects` after `npm ci`.

## Methodology

- Read command manifests in `commands/blu-*.toml`, command docs in `docs/commands/*.md`, runtime contracts in `skills/**/references/*runtime-contract.md`, MCP tools in `src/mcp/tools/*.ts`, command runtime metadata, and focused tests.
- Split read-only investigation across four bounded lanes: discovery/planning, execute/validate/verify, review/security, and health/progress/config.
- Reproduced two cross-cutting issues locally with temporary git repos and `node --import tsx` from the fresh worktree:
  - project config writes materialized inherited defaults, and `blueprint_config_set_profile` succeeded on a `partial` project.
  - `evaluatePhaseQualityGates` returned `gatesSatisfied: true` for malformed review evidence and a security artifact containing an open threat.
- Did not invoke Blueprint or GSD workflows. Did not mutate installed extension directories or host-global `~/.gemini/blueprint` state.

## Config Matrix Coverage

| Config key | Coverage result |
| --- | --- |
| `workflow.research` | Enforced in phase readiness/state routing. Also participates in SM-002 and SM-L02 readiness behavior. |
| `workflow.plan_check` | Present in config/posture, but no state-transition defect found in scoped workflows. |
| `workflow.verifier` | Contract-visible in validation/UAT, but mostly prompt-owned rather than substrate-enforced. See SM-L03. |
| `workflow.nyquist_validation` | Same as `workflow.verifier`. See SM-L03. |
| `workflow.ui_phase` | Enforced in readiness/state routing. Interacts with SM-002 and SM-L02. |
| `workflow.ui_safety_gate` | Exposed but ignored by readiness/state routing. See SM-002. |
| `workflow.no_uat` | Closeout and PASS routing looked correct in focused tests; ruled out as a defect here. |
| `workflow.code_review` | Read by quality-gate and review scope code, but quality gates have content-validation defects. See SM-003, SM-005, SM-L05. |
| `workflow.code_review_depth` | Shapes code-review depth only; no state routing defect found. |
| `workflow.auto_advance` | Inert by documented design; ruled out as a defect. |
| `workflow.research_before_questions` | Exposed in workflow posture; no confirmed state-transition defect found. |
| `workflow.discuss_mode` | Exposed in workflow posture; no confirmed state-transition defect found. |
| `workflow.use_worktrees` | Exposed in workflow posture; no confirmed state-transition defect found. |
| `workflow.subagents` | Command-relevant and schema-backed, but omitted from shared phase posture; unclear if intentional for offline consumers. See SM-U01. |
| `workflow.subagent_timeout` | Schema/default only in this audit; omitted from shared phase posture. See SM-U01. |
| `parallelization.*` | Configured but not materially asserted by execute/validate/verify substrate tests; coverage gap. |
| `git.branching_strategy` | Configured; can be frozen into project config by SM-001. No independent routing defect found. |
| `research.external_sources` | Configured; can be frozen into project config by SM-001. Command-owned otherwise. |
| `safety.always_confirm_external_services` | Present in config and used by execute-phase command context; no state-transition defect found. |

The config schema/default matrix is in `src/mcp/tools/config.ts:46-91` and `src/mcp/tools/config.ts:235-280`.

## Workflow Coverage Checklist

| Workflow | State-management result |
| --- | --- |
| `spec-phase` | No confirmed state defect in write validation. Coverage gap remains for phase-context-first resolution, synced `STATE.md` update, and post-write implemented-only routing. |
| `discuss-phase` | Checkpoint v2 ownership/mode guards appear healthy. Downstream readiness can still be affected by SM-002 and SM-L02. |
| `research-phase` | Research gating is present, but readiness next-action strings are not catalog-filtered. See SM-L01. |
| `plan-phase` | Affected by SM-002, SM-L01, and SM-L02. |
| `execute-phase` | Execute summary routing looked healthy for partial/blocked/stale states. Downstream secure-phase and roadmap sync defects remain. |
| `validate-phase` | `workflow.no_uat` semantics looked healthy. Affected by SM-006 and SM-L03. |
| `verify-work` | Ready-for-UAT and no-UAT behavior looked healthy. Affected by SM-006. |
| `code-review` | Affected by SM-003 and SM-L05. |
| `code-review-fix` | Affected by SM-005. |
| `secure-phase` | Affected by SM-003 and SM-004. |
| `health` | Read-path project status looked healthy, but `set-profile` bypasses partial-project protection. See SM-001. |
| `progress` | Current read-path tests pass, but derived next actions can be wrong when quality gates or roadmap syntax drift. See SM-003, SM-005, SM-006, and SM-L04. |

## Confirmed Defects

### SM-001: Project Profile Mutation Bypasses Project-State Safety And Freezes Inherited Defaults

- Severity: High
- Status: CONFIRMED
- Affected workflows/configs: `health`, `progress`, all effective-config-gated workflows, `workflow.no_uat`, `workflow.subagents`, `research.external_sources`, `git.branching_strategy`, `ux.*`, `model_profile`
- Symptom: `blueprint_config_set_profile` changes more than `model_profile`, succeeds in a `partial` project, and materializes saved-default-derived values into `.blueprint/config.json`.
- Trigger: A repo has `.blueprint/config.json` but is otherwise partial, or has sparse project config plus saved defaults. Running `blueprint_config_set_profile` or an unrelated project-scope config patch serializes the fully merged effective config.
- Expected: `/blu-set-profile` should stop on uninitialized/partial state and should change only `model_profile`. Older sparse project configs should inherit defaults until the project explicitly writes an override.
- Observed: `blueprintConfigSet` reads `scope: "effective"` for project writes, clones that full merged object, applies the patch, and writes the entire object to `.blueprint/config.json`. `blueprintConfigSetProfile` checks only whether project config exists, then delegates to that full project write.
- Evidence:
  - `commands/blu-set-profile.toml:12-16` says load project config and stop if the repository is not initialized or config is missing.
  - `skills/blueprint-governance/references/set-profile-runtime-contract.md:9-12` says stop when the repository is uninitialized, config is missing, or config path cannot be resolved.
  - `docs/commands/set-profile.md:56-58` and `docs/commands/set-profile.md:124-127` say the command is project-local, must not mutate saved defaults, and changes only `model_profile`.
  - `docs/commands/settings.md:63-67` says omitted config keys inherit until explicit override.
  - `src/mcp/tools/config.ts:969-1007` loads effective config and writes `nextConfig` for project-scope patches.
  - `src/mcp/tools/config.ts:1042-1061` accepts any repo with a config file and calls `blueprintConfigSet`.
  - Live repro on 2026-05-22: a temp repo containing only `.blueprint/config.json` returned `blueprintProjectStatus.status: "partial"` with next action `/blu-health`, yet `blueprintConfigSetProfile({ profile: "quality" })` succeeded. The same repro showed inherited `ux.progress_mode`, `research.external_sources`, `workflow.no_uat`, `workflow.subagents`, and `git.branching_strategy` persisted into project config after an unrelated project patch.
- Downstream risk: A harmless profile switch or unrelated settings update can silently convert host/default policy into durable repo-local state. Later `progress`, `health`, validation, UAT, review, and research decisions may use stale locally frozen values rather than updated saved defaults.
- Smallest fix surface: Make `blueprintConfigSetProfile` require initialized project status, and make project-scope config writes preserve project-layer provenance for untouched keys or explicitly document that any project write intentionally materializes inherited defaults. The single-field profile tool should avoid the full effective-config serialization path.
- Focused tests:
  - Add a `partial` repo with only `.blueprint/config.json` case near `tests/settings-profile.test.ts:175`.
  - Add a sparse-project-plus-defaults profile mutation case near `tests/settings-profile.test.ts:128`.
  - Add an unrelated project-scope patch case after defaults precedence coverage at `tests/settings-profile.test.ts:394`.

### SM-002: `workflow.ui_safety_gate` Is Ignored By Planning Readiness And Synced-State Routing

- Severity: Medium
- Status: CONFIRMED
- Affected workflows/configs: `discuss-phase`, `research-phase`, `plan-phase`, `progress`, `workflow.ui_phase`, `workflow.ui_safety_gate`
- Symptom: A backend-only or no-UI phase still hard-routes to `/blu-ui-phase` whenever `workflow.ui_phase=true` and no usable `XX-UI-SPEC.md` exists, even when `workflow.ui_safety_gate=false`.
- Trigger: `workflow.research=false`, `workflow.ui_phase=true`, `workflow.ui_safety_gate=false`, context exists, no UI spec exists, and saved signals indicate UI should be skipped.
- Expected: The explicit skip-rationale requirement is tied to `workflow.ui_safety_gate=true`; with the safety gate disabled, backend-only/no-UI phases should be able to proceed toward plan readiness without forced skip-rationale authoring.
- Observed: The readiness and state routes branch on `workflow.uiPhase` and UI-spec usability, but do not branch on `workflow.uiSafetyGate`.
- Evidence:
  - `commands/blu-ui-phase.toml:29-35` separates `workflow.ui_phase=false` skip mode from `workflow.ui_safety_gate=true` rationale requirements.
  - `docs/commands/ui-phase.md:153-155` says `workflow.ui_phase=false` produces a skip rationale and `workflow.ui_safety_gate=true` requires an explicit rationale when UI is skipped.
  - `skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md:73-76` makes the safety-gate requirement conditional on `workflow.ui_safety_gate=true`.
  - `src/mcp/tools/phase.ts:3521-3553` blocks plan readiness whenever `workflow.uiPhase` is true and `uiSpecStatus` is unusable; it returns `workflowUiSafetyGateEnabled` but does not use it to decide.
  - `src/mcp/tools/state.ts:2575-2596` routes to `/blu-ui-phase` whenever `workflow.uiPhaseEnabled` is true and `hasUiSpec` is false; `ui_safety_gate` is not part of the branch.
- Downstream risk: Non-UI phases can be forced into UI artifact authoring, slowing or blocking `plan-phase` and making `progress` recommendations inconsistent with the configured safety gate.
- Smallest fix surface: Update `buildPhasePlanningReadiness` and `deriveNextAction` UI readiness branches to distinguish real UI-contract requirements from skip-rationale-only safety gates.
- Focused tests:
  - Add `workflow.ui_safety_gate=false` readiness cases near `tests/phase-discovery-tools.test.ts:1146`.
  - Add synced-state route cases in the research/discovery path around `tests/phase-discovery-research.test.ts:2613`.

### SM-003: Review And Security Quality Gates Are Satisfied By Artifact Presence Rather Than Valid Content

- Severity: Critical
- Status: CONFIRMED
- Affected workflows/configs: `code-review`, `secure-phase`, `code-review-fix`, `validate-phase`, `verify-work`, `progress`, `workflow.code_review`, `workflow.no_uat`
- Symptom: Invalid or semantically blocked `XX-REVIEW.md` / `XX-SECURITY.md` artifacts can satisfy quality gates. Open security threats are ignored by repo-wide gate evaluation and ROADMAP closeout.
- Trigger: A phase has completed execution evidence and reviewable files, plus a malformed or stale `XX-REVIEW.md` and any `XX-SECURITY.md` file, including one that says a threat is still open.
- Expected: Invalid review/security artifacts and open threats should block advancement or route to the owning repair workflow.
- Observed: `evaluatePhaseQualityGates` uses artifact existence/declaration to set `hasReview` and `hasSecurity`, and `gatesSatisfied` only checks `missingGate === null` plus nonblocking review next action. It does not validate review/security body shape, security status, threat register state, or pending-open-threat text.
- Evidence:
  - `commands/blu-secure-phase.toml:37-45` says open threats block next-step routing until closed or explicitly accepted.
  - `commands/blu-secure-phase.toml:60-61` says do not emit next-step routing when any threat remains open and do not present planned-only commands.
  - `docs/commands/secure-phase.md:89-90` says no next action is computed until threats are closed or accepted.
  - `src/mcp/tools/quality-gates.ts:923-931` computes review/security presence from file existence or declaration.
  - `src/mcp/tools/quality-gates.ts:960-965` only marks missing review or missing security.
  - `src/mcp/tools/quality-gates.ts:966-997` reads review/fix next actions but does not validate security content.
  - `src/mcp/tools/quality-gates.ts:1004-1015` returns `gatesSatisfied: missingGate === null && !hasBlockingReviewFollowUp`.
  - `src/mcp/tools/phase.ts:2975-3001` trusts `qualityGateEvaluation.gatesSatisfied` for ROADMAP completion.
  - Live repro on 2026-05-22: `evaluatePhaseQualityGates` returned `requiresCodeReview: true`, `hasReview: true`, `hasSecurity: true`, `missingGate: null`, and `gatesSatisfied: true` for a malformed review artifact plus a security artifact containing `T-01 | open | none | still open` and `Next Safe Action: Blocked: pending-open-threat`.
- Downstream risk: `/blu-progress` can advance after skipped review/security or unresolved threats; ROADMAP can be marked complete under `workflow.no_uat=true` or after UAT even though the security lifecycle is blocked.
- Smallest fix surface: Validate saved review/security artifacts in `evaluatePhaseQualityGates` before setting `hasReview`, `hasSecurity`, and `gatesSatisfied`; treat open or unresolved security threats as blocking.
- Focused tests:
  - Add malformed `XX-REVIEW.md`, malformed `XX-SECURITY.md`, and open-threat `XX-SECURITY.md` cases to `tests/quality-gate-routing.test.ts`.
  - Add ROADMAP sync assertions in `tests/help-progress-health.test.ts` or `tests/verify-work-roadmap-sync.test.ts`.

### SM-004: `secure-phase` Can Persist Security Evidence Without Completed Execution Evidence

- Severity: High
- Status: CONFIRMED
- Affected workflows/configs: `secure-phase`, `execute-phase`, `progress`, `workflow.code_review`
- Symptom: Missing completed summaries and pending plans become warnings in security authoring context, but do not hard-block model validation or persistence.
- Trigger: A phase has a plan but no completed execution summary, or has pending plans. `/blu-secure-phase` proceeds through `blueprint_review_authoring_context`, `blueprint_review_validate_model`, and `blueprint_review_record`.
- Expected: Security persistence should stop and route to `/blu-execute-phase <phase>` until completed summaries exist and pending plans are resolved.
- Observed: `buildSecurityAuthoringContext` accumulates completion warnings and sets `allowCompleted=false`, but still returns `status: "ready"`. The task schema removes only `COMPLETED`; `PARTIAL` and `BLOCKED` models can still validate and be recorded.
- Evidence:
  - `commands/blu-secure-phase.toml:22-24` says require completed phase execution evidence and stop before persistence when pending plans remain.
  - `docs/commands/secure-phase.md:79-80` says completed execution summaries and pending-plan blockers are required before persistence.
  - `skills/blueprint-review/references/secure-phase-runtime-contract.md:180-186` says State C and pending-plan state stop without writing and route to `/blu-execute-phase <phase>`.
  - `src/mcp/tools/review.ts:3214-3223` creates warnings for missing completed summaries and pending plans.
  - `src/mcp/tools/review.ts:3316-3324` converts those warnings to `allowCompleted=false`.
  - `src/mcp/tools/review.ts:3340-3341` still returns `status: "ready"`.
  - `src/mcp/tools/review.ts:10034-10046` records security by validating the model; there is no prerequisite hard-stop at record time.
  - Read-only lane live repro: a temp phase with a plan and no completed summary accepted a non-completed security model through validate + record.
- Downstream risk: Security artifacts can certify stale or incomplete execution state, then SM-003 can let those artifacts satisfy quality gates by presence alone.
- Smallest fix surface: Make missing completed summaries, pending plans, or lower-wave execution blockers produce `status: "invalid"` / prerequisite blockers in `buildSecurityAuthoringContext` and recheck the same blockers in `blueprintReviewRecord`.
- Focused tests:
  - Flip the warning-only expectations in `tests/secure-phase-slice.test.ts:1046` so missing summaries and pending plans are true hard stops.
  - Add a record-path regression that cannot persist `review.security` when authoring context prerequisites fail.

### SM-005: Completed Subset `REVIEW-FIX` Can Hide Remaining Saved Review Debt

- Severity: High
- Status: CONFIRMED
- Affected workflows/configs: `code-review`, `code-review-fix`, `progress`, `workflow.code_review`
- Symptom: A completed `XX-REVIEW-FIX.md` for selected finding IDs can override unresolved findings still present in the saved `XX-REVIEW.md`.
- Trigger: `XX-REVIEW.md` has follow-up findings `F-01` and `F-02`; `XX-REVIEW-FIX.md` is completed only for `targetIds=["F-01"]` and routes to `/blu-validate-phase <phase>`.
- Expected: Unresolved saved review debt should keep routing to `/blu-code-review-fix <phase>` until all follow-up findings are addressed or explicitly accepted by the review lifecycle.
- Observed: The review-fix schema intentionally constrains `findingsAddressed` to the selected target IDs. Quality-gate evaluation prefers a completed review-fix next action without reconciling it against all blocking findings in the saved review artifact.
- Evidence:
  - `src/mcp/tools/review.ts:1960-1993` narrows `findingsAddressed` to `selectedTargetIds`.
  - `src/mcp/tools/review.ts:2170-2178` exposes selected target IDs in the runtime schema context.
  - `src/mcp/tools/quality-gates.ts:966-990` chooses `reviewFixNextSafeAction` when the review fix is completed.
  - `src/mcp/tools/quality-gates.ts:998-1012` gates only on the chosen next action being blocking.
  - `src/mcp/tools/state.ts:2645-2656` surfaces the saved review repair action when review and security both exist.
  - Read-only lane live repro: completed fix for `F-01` only caused routing to advance while `F-02` remained unresolved in saved review evidence.
- Downstream risk: `progress` and `next` can advance toward validation or closeout while remediation debt remains.
- Smallest fix surface: Reconcile completed review-fix coverage against unresolved follow-up findings in the saved review artifact before honoring the fix artifact's next action.
- Focused tests:
  - Add a quality-gate routing case beside `tests/quality-gate-routing.test.ts:1151`.
  - Add a review-fix slice regression for "completed subset fix + leftover review debt".

### SM-006: ROADMAP Checklist Syntax Is Inconsistent Across Read, Locate, And Write Paths

- Severity: Medium
- Status: CONFIRMED
- Affected workflows/configs: `execute-phase`, `validate-phase`, `verify-work`, `health`, `progress`
- Symptom: `/blu-progress`-style state sync can read `- [ ] Phase 4 - Validation ...`, but phase mutation/closeout paths fail to locate or update that same phase checklist line.
- Trigger: `.blueprint/ROADMAP.md` uses hyphen-form checklist lines under `## Phases`, for example `- [ ] Phase 4 - Validation ...`.
- Expected: Accepted ROADMAP checklist syntax should be consistent across readers, locators, and close/reopen sync.
- Observed: State read accepts either `:` or `-`, while the shared roadmap parser and completion marker replacement require `:`.
- Evidence:
  - `src/mcp/tools/state.ts:1978-1991` accepts `(?::|-)` when reading roadmap checkbox signals.
  - `src/mcp/tools/phase-roadmap-parser.ts:93-102` accepts only `Phase <n>:` in parsed roadmap phase lines.
  - `src/mcp/tools/phase.ts:2801-2814` replaces completion markers only on `Phase <n>:` checklist lines.
  - Read-only lane live repro: `blueprintPhaseValidationWrite` on a hyphen-form checklist failed with `Phase 4 was not found in .blueprint/ROADMAP.md`.
- Downstream risk: `progress` can infer the active phase from a ROADMAP that validate/verify write paths cannot update, causing lifecycle stalls or split-brain phase state.
- Smallest fix surface: Share one checklist-line parser/updater across `readRoadmapSignals`, `parseRoadmapPhaseLine`, and `replacePhaseLineCompletionMarker`.
- Focused tests:
  - Add hyphen-form checklist cases to `tests/roadmap-tools.test.ts`.
  - Add validation and verify-work ROADMAP sync regressions to `tests/validate-phase-tools.test.ts` and `tests/verify-work-roadmap-sync.test.ts`.

## Likely Defects

### SM-L01: Planning Readiness Next Actions Are Not Catalog-Filtered

- Severity: Medium
- Status: LIKELY
- Affected workflows/configs: `research-phase`, `plan-phase`, `progress`, implemented-only routing
- Symptom: `blueprint_phase_research_status.planningReadiness.nextSafeAction` and `blueprint_phase_plan_readiness.nextSafeAction` can return hardcoded command strings.
- Trigger: A command in the hardcoded readiness path drifts to `blocked`, `repairing`, or otherwise non-implemented while readiness still recommends it.
- Expected: Any next safe action surfaced to command flows should stay inside the implemented surface.
- Observed: Readiness hardcodes `/blu-research-phase`, `/blu-ui-phase`, and `/blu-plan-phase` rather than checking the live command catalog.
- Evidence:
  - `src/mcp/tools/phase.ts:3504-3518` hardcodes `/blu-research-phase`.
  - `src/mcp/tools/phase.ts:3521-3553` hardcodes `/blu-ui-phase` and `/blu-plan-phase`.
  - `src/mcp/tools/phase.ts:10081-10083` re-exports the authoring-context readiness action.
  - The implemented-only catalog source is `src/mcp/tools/project.ts:1488` and is used elsewhere in lifecycle routing.
- Downstream risk: Readiness tools can recommend a command that `/blu`, `/blu-help`, or `/blu-progress` would otherwise suppress.
- Smallest fix surface: Pass implemented-command status into readiness generation or degrade non-implemented readiness actions to `/blu-progress`.
- Focused tests: Add catalog-drift fixtures for `blueprintPhaseResearchStatus` and `blueprintPhasePlanReadiness`.

### SM-L02: `blueprint_phase_context.missingArtifacts` Is Config-Blind `FIXED`

- Severity: Low
- Status: LIKELY
- Affected workflows/configs: `discuss-phase`, `research-phase`, `plan-phase`, `workflow.research`, `workflow.ui_phase`
- Symptom: `phase_context` reports missing research and UI artifacts even when those artifacts are disabled or not relevant under effective config.
- Trigger: `workflow.research=false` or `workflow.ui_phase=false`, with context present but no `XX-RESEARCH.md` or `XX-UI-SPEC.md`.
- Expected: The first selected-phase packet should either omit disabled artifacts from missing lifecycle debt or label them as config-disabled.
- Observed: Phase context always builds `missingArtifacts` from context, research, and UI spec paths; plan readiness later treats research/UI as disabled or not relevant.
- Evidence:
  - `src/mcp/tools/phase.ts:8440-8444` always filters `[contextPath, researchPath, uiSpecPath]` by file presence.
  - `src/mcp/tools/phase.ts:9823-9832` makes research/UI plan-readiness relevance conditional on effective config.
- Downstream risk: Discovery and planning handoffs can over-warn or over-read compared with the actual readiness contract.
- Smallest fix surface: Make `buildPhaseContext` config-aware for missing-artifact reporting, or add explicit disabled-state metadata.
- Focused tests: Add `blueprint_phase_context` assertions under disabled research/UI config.

### SM-L03: `workflow.verifier` And `workflow.nyquist_validation` Are Contract-Visible But Mostly Prompt-Owned

- Severity: Medium
- Status: LIKELY
- Affected workflows/configs: `validate-phase`, `verify-work`, `workflow.verifier`, `workflow.nyquist_validation`
- Symptom: Commands promise to use these flags to decide verifier analysis and gap semantics, but the MCP substrate mostly exposes them as posture instead of enforcing different validation behavior.
- Trigger: Disable `workflow.verifier` or `workflow.nyquist_validation`, then persist validation/UAT artifacts through MCP with models that still make full verifier/Nyquist assumptions.
- Expected: These flags should materially constrain authoring context, model validation, routing, or documented contract claims.
- Observed: The flags appear in config and phase posture, while concrete validation write/routing logic branches primarily on `workflow.no_uat`.
- Evidence:
  - `commands/blu-validate-phase.toml:15-16` requires using both flags to decide verifier analysis and gap language.
  - `commands/blu-verify-work.toml:14-15` repeats the same contract for UAT.
  - `src/mcp/tools/phase.ts:3268-3274` exposes both flags in posture.
  - `src/mcp/tools/phase.ts:6508-6532` shows concrete validation routing rules branch on `workflow.no_uat`; this audit did not find comparable substrate enforcement for verifier/Nyquist flags.
- Downstream risk: Model-authored validation evidence can drift from config without a runtime guard.
- Smallest fix surface: Wire these flags into validation/UAT authoring context and model diagnostics, or narrow the command contract to say they are prompt-owned.
- Focused tests: Add disabled-verifier and disabled-Nyquist model-validation cases to validation and UAT slices.

### SM-L04: Current-Phase Quality-Gate Warning Can Name The Wrong Missing Gate

- Severity: Low
- Status: LIKELY
- Affected workflows/configs: `progress`, `health`, `code-review`, `code-review-fix`, `secure-phase`
- Symptom: When review remediation debt remains after security exists, warning text can say security evidence is missing.
- Trigger: `gatesSatisfied=false`, `missingGate=null`, `hasSecurity=true`, and `reviewNextSafeAction` is blocking.
- Expected: Warning should distinguish missing security from saved review remediation debt.
- Observed: The warning chooses only between `missingGate === "review"` and the else branch "SECURITY evidence is missing".
- Evidence:
  - `src/mcp/tools/state.ts:1919-1922` formats the warning from `missingGate` only.
  - `src/mcp/tools/quality-gates.ts:998-1012` can make gates unsatisfied because of a blocking review follow-up with no missing gate.
- Downstream risk: Users can be sent toward the wrong workflow or misread saved review debt as missing security evidence.
- Smallest fix surface: Add a branch for `reviewNextSafeAction` / blocking follow-up state in current-phase warning text.
- Focused tests: Add a project-status warning assertion for review debt after security exists.

### SM-L05: Stale Saved Review Verdicts Can Slip Past Read-Side Gate Evaluation

- Severity: Medium
- Status: LIKELY
- Affected workflows/configs: `code-review`, `code-review-fix`, `progress`, `workflow.code_review`
- Symptom: A manually edited or legacy `XX-REVIEW.md` that says `FOLLOW_UP` or `BLOCKED` but has a stale `/blu-progress` next action can avoid blocking.
- Trigger: A saved review artifact predates strict write validation or is manually corrupted.
- Expected: Read-side quality-gate evaluation should treat saved `FOLLOW_UP` / `BLOCKED` verdicts as blocking unless normalized to a valid implemented repair action.
- Observed: Current evaluation blocks on next-action shape after normalization, not on verdict truth itself.
- Evidence:
  - `src/mcp/tools/quality-gates.ts:574-594` classifies blocking review state from next-action command shape.
  - `src/mcp/tools/quality-gates.ts:1004-1015` gates completion on that blocking-action decision.
  - Write-time validation is stricter in `src/mcp/tools/review.ts:7203`, but read-time routing does not revalidate old or manually edited artifacts to the same standard.
- Downstream risk: Existing bad artifacts can reopen a skip-ahead class of bug even if new writes are validated.
- Smallest fix surface: Harden read-side review parsing so blocking verdicts block unless the artifact is validly remediated or routes to an implemented fix command.
- Focused tests: Add a quality-gate fixture with `FOLLOW_UP` plus `/blu-progress`.

### SM-L06: Core Fallback Routing Hardcodes Commands Before Implemented-Only Filtering

- Severity: Medium
- Status: LIKELY
- Affected workflows/configs: `health`, `progress`, root routing safety
- Symptom: Bootstrap and partial-project next actions hardcode `/blu-new-project`, `/blu-map-codebase`, `/blu-health`, and `/blu-progress` before the command catalog is consulted.
- Trigger: One of those core commands drifts to non-implemented status while fallback routing still returns it.
- Expected: All user-facing recommendations should honor implemented-only routing.
- Observed: Later lifecycle branches use `getImplementedCommandNames`, while early fallback branches return hardcoded commands first.
- Evidence:
  - `src/mcp/tools/state.ts:2485-2508` returns core fallback commands before `getImplementedCommandNames`.
  - `src/mcp/tools/state.ts:2511-2518` begins implemented-command filtering only after those fallback branches.
- Downstream risk: If core entries drift to `repairing` or `blocked`, `progress`/state can still advertise them as runnable.
- Smallest fix surface: Centralize fallback action selection through catalog-backed helpers.
- Focused tests: Add a stubbed catalog scenario where a core fallback is non-implemented.

## Uncertain / Anomaly Backlog

- SM-U01: `phase_context.workflowPosture.workflow` omits `workflow.no_uat`, `workflow.code_review_depth`, `workflow.subagents`, `workflow.subagent_timeout`, `parallelization.*`, `git.branching_strategy`, `research.external_sources`, and `safety.always_confirm_external_services`. It may be intentional because commands call `config_get` directly, but it weakens offline/debug consumers. Evidence: `src/mcp/tools/phase.ts:3268-3282`.
- SM-U02: UI-review debt is enforced in state routing but was not fully reproduced against ROADMAP close/reopen sync. It may allow ROADMAP completion before required `ui-review` follow-up, but this sits just outside the requested workflow set.
- SM-U03: The generic `/blu-settings` contract has an internal tension: `docs/commands/settings.md:63-64` says sparse configs inherit until explicit override, while `docs/commands/settings.md:140-143` says settings persists normalized full form. SM-001 is confirmed for `/blu-set-profile`; generic settings behavior needs a product decision before classification.

## Non-Defects Ruled Out

- `workflow.no_uat` close/reopen semantics looked solid. `src/mcp/tools/phase.ts:6508-6532` encodes PASS routing to `/blu-progress` when no-UAT is true while leaving `/blu-verify-work` manual, and focused tests cover it.
- Deferred-test validation gaps route to `/blu-add-tests` rather than looping on `/blu-validate-phase`; see `src/mcp/tools/state.ts:2659-2665`.
- Execute/validate routing stayed honest for partial, blocked, stale, and dependency-broken summaries in focused tests.
- Phase validation writes enforce completed summaries and ready verification before UAT; see `src/mcp/tools/phase.ts:9134-9157` and `src/mcp/tools/phase.ts:9209-9237`.
- Validation write paths still reject invalid content/models before persistence; see `src/mcp/tools/phase.ts:9321-9336`.
- Shared discovery checkpoint ownership/mode guards are covered by focused tests and did not show a current defect.
- Runtime-contract exposure for implemented commands is guarded in command resource code; no current exposure drift was found for the reviewed lanes.
- Missing security correctly outranks saved review-fix follow-up in existing quality-gate tests.
- Stale `/blu-secure-phase` follow-up rerouting to `/blu-code-review-fix` appears intentional and covered.
- `workflow.code_review_depth` shapes review depth and is covered in code-review tests; no routing defect found.
- `workflow.auto_advance` being inert is documented intentional behavior, not a state defect.

## Test Coverage Gaps

- No negative quality-gate tests for malformed `XX-REVIEW.md`, malformed `XX-SECURITY.md`, or open-threat security artifacts.
- No ROADMAP locate/write regression for hyphen-form checklist lines under `## Phases`.
- No test covers completed subset `XX-REVIEW-FIX.md` with unresolved review findings left behind.
- No hard-stop test for `/blu-secure-phase` missing completed summaries or pending execution plans; the existing slice codifies warning-only readiness.
- No test covers `workflow.ui_safety_gate=false` in planning readiness or synced state routing.
- No `phase_context` test verifies disabled research/UI artifacts are omitted or marked config-disabled.
- No catalog-drift test exercises readiness actions when a hardcoded target command is non-implemented.
- No tests assert tool-level behavior changes for `workflow.verifier`, `workflow.nyquist_validation`, `parallelization.*`, `workflow.use_worktrees`, `workflow.subagent_timeout`, or `git.branching_strategy`.
- No test covers `/blu-set-profile` on a partial repo that still has `.blueprint/config.json`.
- No sparse-project-plus-defaults test verifies `set-profile` changes only `model_profile`.
- No read-side test covers stale invalid review artifacts with `FOLLOW_UP` / `BLOCKED` plus `/blu-progress`.
- Spec-phase coverage is metadata/artifact heavy but does not directly assert phase-context-first resolution, synced `STATE.md` update, or post-write command-catalog routing.

## Final Residual Risk

This audit was broad but still source- and fixture-oriented. Two defects were reproduced locally by the orchestrator, and several more were reproduced by read-only lanes in temporary fixtures. The remaining likely items need targeted fixture tests before being promoted or discarded. The highest-priority fix batch should start with SM-003, SM-004, and SM-005 because they can let review/security debt disappear from lifecycle routing, then SM-001 and SM-006 because they create cross-cutting state divergence.
