# `/blu-secure-phase`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Runtime contract reference: `skills/blueprint-review/references/secure-phase-runtime-contract.md` owns the State A/B/C input model, saved threat-model parsing, summary threat-flag handling, bounded auditor path, no-subagent fallback, retry/repair behavior, and threat-count consistency pass.
- `secure-phase` uses the shared long-running-mutation posture: resolve the target phase, read saved execution plus plan evidence, decide the overwrite or open-threat gate, execute a threat-model-bounded audit, persist the durable security artifact through MCP, validate the saved result against the security contract, and route to the next safe implemented follow-up only when threats no longer remain open.
- Keep the threat-review posture explicit throughout the run: resolved scope must stay tied to the saved plan evidence and declared threat register, pending gates stay limited to overwrite confirmation, the verify-versus-accept decision, or the visible `pending-open-threat` waiting state, execution mode should reflect inline versus `blueprint-security-auditor`-assisted review, and next safe action must stay blocked until every threat is closed or explicitly accepted.


## Purpose


`secure-phase` is Blueprint's command for retroactively verify threat mitigations for a completed phase. Blueprint ships it as a host-native threat-verification command: it reads saved phase evidence, loads the canonical review.security JSON model contract before drafting, uses the phase plan index, plan reader, summary index/read tools, execution-targets helper, and review authoring context to parse the saved threat model and pending-plan state, builds a threat register, validates the structured model, and keeps the audit bounded to the declared threats and mitigations instead of running a generic security scan.

The detailed behavior lives in `skills/blueprint-review/references/secure-phase-runtime-contract.md`. The command manifest should stay thin enough to point at the `blueprint-review` skill and this local reference while still naming the required MCP tools and visible gates.


## Command Path And Examples

- CLI command path: `/blu-secure-phase`
- Root router form: `/blu secure-phase`
- Argument hint: `[phase number]`
- `/blu-secure-phase 3`
- `/blu secure-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must already have executed artifacts.


## Outputs


- User-facing result: a concise completion summary, then either a verification-or-acceptance decision for open threats or a blocked advancement result when threats remain open.
- Repo side effects: Writes only the declared phase-scoped security artifact for this command.
- In-flight secure-phase work should keep the resolved scope, active stage, plan coverage, threat-register coverage, pending gate, execution mode, security artifact reuse or revision status, pending-open-threat status, and next safe action legible while the run is still live. When threats remain open, next-step guidance stays blocked.


## Blueprint And Global State Reads


- Phase resolution, artifact inventory, phase plan index/read, summary index/read, execution-target state, the narrowed review authoring context, and the saved phase threat model plus related phase evidence through the documented phase and artifact MCP tools


## Blueprint And Global State Writes


- `phase XX-SECURITY.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_phase_plan_index` -> `{plans, waves, missingPlans}`
- `blueprint_phase_plan_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}`
- `blueprint_phase_summary_index` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, summaries, completedPlans, pendingPlans, warnings}`
- `blueprint_phase_summary_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}`
- `blueprint_phase_execution_targets` -> `{pendingPlanIds, candidatePlanIds, selectedPlanIds, lowerWavePendingPlans, overwriteCandidatePlanIds, overlapPlanIds, blockers, conflicts, warnings}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract, template, requiredHeadings, modelContract}`
- `blueprint_review_authoring_context` -> `{status, phase, artifact, authoringContext, reason, warnings}`
- `blueprint_review_validate_model` -> `{status, diagnostics, diagnosticCounts, normalizedModel, renderPreview, taskSchema}`
- `blueprint_review_record` -> `{reportPath, counts, followUps}`

## Security Artifact Contract

- Read the canonical `review.security` contract through `blueprint_artifact_contract_read` before drafting or revising security evidence, and use `contract.modelContract.schemaPath`, `contract.modelContract.jsonSchema`, and the secure-phase task schema as the model-authoring authority instead of a copied prompt-local Markdown template.
- Use `blueprint_phase_plan_index` and `blueprint_phase_plan_read` to parse the saved phase threat model from the executed plan evidence before building the threat register.
- Use `blueprint_phase_summary_index`, `blueprint_phase_summary_read`, and `blueprint_phase_execution_targets` to require completed execution summaries, block pending plans before persistence, and cite current completed-summary evidence rather than stale self-citations.
- Use `blueprint_review_authoring_context` before drafting so missing required upstream context blocks authoring early, incomplete threat context can narrow status/action choices to `PARTIAL` or `BLOCKED`, and explicit no-threat plan evidence can still produce a completed review.
- Keep the threat-model-bounded behavior explicit: use saved plan evidence only to define the declared threats and mitigations, then audit against that register instead of widening into a generic security scan.
- Incorporate execution-summary `## Threat Flags` when present. Map them to declared threats when possible, and record unregistered flags separately instead of converting them into invented plan threats.
- Keep one authored threat-register row per declared saved-plan threat using only `threatId`, `status`, `evidence`, and `verifierNote`. MCP renders source-plan provenance plus saved threat metadata in the final Markdown table.
- Author only the structured `review.security` model fields: `status`, `readiness`, `completionState`, `securitySummary`, `evidenceCoverage`, `threatRegister`, `acceptedRisks`, `findings`, `manualOrDeferredWork`, `gapRoutes`, `followUps`, `auditTrail`, and `nextSafeAction`. `auditTrail` is an object.
- Use lowercase threat statuses such as `closed`, `accepted`, `open`, and `none`. When a section has no entries, prefer empty arrays and let MCP render `none` rows or bullets instead of hand-authoring sentinels.
- Validate the authored JSON through `blueprint_review_validate_model` before persistence. Repair all schema, truth-table, and residual diagnostics together; rely on the returned diagnostics to identify stale evidence keys, stale threat ids, uncovered threat flags, or invalid routing states. Do not switch to Markdown fallback.
- Persist the durable security audit through `blueprint_review_record` with `artifact: "security"` and the same structured `model`; treat the returned `reportPath` as authoritative instead of hand-building `XX-SECURITY.md`. Markdown `content` is invalid for `review.security`.
- Markdown content fallback is not supported for `/blu-secure-phase`; rejected JSON must be repaired against the schema instead of hand-written as `XX-SECURITY.md`.
- Do not compute a next action until all threats are closed or explicitly accepted.


## Skills And Subagents


- Primary skill: `blueprint-review`
- Optional subagents:
- `blueprint-security-auditor`

## Subagent And Fallback Contract

- Use `blueprint-security-auditor` only for bounded mitigation verification over the declared threat register. It may compare saved plans, summaries, prior security evidence, and implicated repo files, but it must remain read-only and cannot persist artifacts, mutate repo files, invent threats, or route the user.
- If the auditor is unavailable or unnecessary, use the sequential fallback from `skills/blueprint-review/references/secure-phase-runtime-contract.md`: read saved plans, summaries, prior security artifact if any, and implicated repo files; verify one declared threat at a time; compress carry-forward context to remaining threat ids and unresolved evidence; then run a final threat-count consistency pass.
- The fallback must still distinguish confirmed mitigations, open threats, accepted risks, suspicious artifact content, unregistered summary threat flags, and follow-up hardening work.


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/execute-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: audit artifact only.

## User Prompts And Confirmation Gates


- Use Gemini CLI's `ask_user` tool for overwrite confirmation before replacing an existing `XX-SECURITY.md`.
- Use Gemini CLI's `ask_user` tool for the structured verify-versus-accept decision when open threats remain.
- Present the user with the choice to verify open threats or explicitly accept them. If threats remain open, block advancement and do not emit a next-step route.
- Accepted risks require an explicit user decision and a saved accepted-risk row; do not infer acceptance from silence.


## In-Flight Progress Contract


- For non-trivial secure-phase runs, keep the active stage visible with Gemini CLI's internal `update_topic` tool and keep a compact threat-review checklist with `write_todos`.
- Keep that visible progress aligned to the resolved scope, active stage, saved-plan coverage, threat-register coverage, pending gate, execution mode, whether the existing `XX-SECURITY.md` artifact is being reused or revised, current pending-open-threat status, and next safe action as the run moves from target resolution through saved-plan review, threat verification, persistence, validation, and routing.
- Treat `update_topic` and `write_todos` as session-local visibility only; when the host lacks them, report the same progress in prose instead of inventing a second persistence path.
- When open threats remain, keep the waiting state explicit as `pending-open-threat` and do not emit next-step routing until that gate is cleared.
- Closing summary must include whether the security artifact was created, reused, or revised, plus the blocked-versus-cleared status for the threat register and the final pending-open-threat status.


## Edge Cases


- The command scope does not match the currently changed files, branch, or phase artifacts.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve generated security artifacts when the audit needs revision or external context is incomplete.
- Fall back to explicit evidence gaps and the safest implemented next step instead of guessing missing mitigations.
- Keep prompt-boundary or suspicious-content concerns explicit in the saved artifact instead of silently trusting compromised evidence.
- If `blueprint_review_validate_model` or `blueprint_review_record` rejects the model, repair once against the canonical `review.security` schema, narrowed task schema, and returned diagnostics, then retry through MCP. If the retry fails, stop with the MCP reason and do not write `XX-SECURITY.md` by hand.


## Acceptance Criteria


- Produces a durable artifact for review, security, UI, or shipping work.
- Non-trivial secure-phase runs use the shared long-running-mutation posture with visible stage and status fields.
- Keeps pending gates explicit for overwrite confirmation and pending-open-threat / verify-versus-accept decisions.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Validates the model-only `review.security` JSON before `blueprint_review_record` and never uses Markdown fallback.
- Uses Gemini-native `ask_user` confirmation for overwrite and verify-versus-accept decision paths.
- Leaves unrelated repo files untouched.
- Distinguishes confirmed mitigations, open threats, accepted risks, suspicious artifact content, and explicit hardening follow-ups inside the saved security evidence.
- Parses the saved phase threat model, builds a threat register, and keeps the audit bounded to declared threats and mitigations from saved plan evidence only.
- Blocks advancement while any threat remains open.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `secure-phase` happy-path fixture.
