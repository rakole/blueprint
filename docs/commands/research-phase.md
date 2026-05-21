# `/blu-research-phase`
| Field | Value |
|---|---|
| Wave | `1` |
| Family | `Core Lifecycle` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Rich behavior authority: `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- The shared discovery skill should load only the active command's inputs for `/blu-research-phase`; sibling discovery command flows stay out of scope unless this runtime contract explicitly calls for them.

## Purpose

`research-phase` is Blueprint's phase-scoped research command. It gathers
planner-ready implementation guidance from saved Blueprint artifacts, repo
evidence, claim-addressable provenance, and only-when-needed approved external
references, then persists validated `XX-RESEARCH.md` content through MCP-owned
state paths.

## Command Path And Examples

- CLI command path: `/blu-research-phase`
- Root router form: `/blu research-phase`
- Argument hint: `[phase]`
- `/blu-research-phase 3`
- `/blu research-phase`

## Inputs, Project State, And Prerequisite Artifacts

- The target phase must exist.
- Saved `XX-CONTEXT.md` content is required before drafting research.
- Phase context is read-only for this command. If `XX-CONTEXT.md` is missing, invalid, or unusable, route back to `/blu-discuss-phase <phase>`; do not repair, overwrite, synthesize, or mirror context, and never use repo-root `CONTEXT.md` as Blueprint state.
- Saved `XX-SPEC.md` is optional intent and constraint evidence. After usable context is confirmed, read it through `blueprint_phase_artifact_read` with `artifact: "spec"` only when the selected phase exposes `phase.artifacts.spec`; Missing spec is nonblocking and does not change research readiness.
- The effective `research.external_sources` policy controls whether official-doc or other external verification is allowed.

## Outputs

- User-facing result: a concise summary of whether existing research was viewed, reused, created, updated, or checkpointed, plus the next safe action when applicable.
- Repo side effects: writes validated `XX-RESEARCH.md` content when research changes, may refresh the shared phase checkpoint with research-owned continuation state during pauses or inconclusive runs, and updates `.blueprint/STATE.md`.

## Behavior Stages

1. `Resolve`: resolve the target phase and stop early on missing Blueprint prerequisites.
2. `Read`: inspect phase context, the actual saved `XX-CONTEXT.md`, optional saved `XX-SPEC.md` when present, existing `XX-RESEARCH.md`, checkpoint state, effective config, and canonical research contract before drafting.
3. `Decide`: keep valid reuse versus explicit `view` or `update`, invalid-research repair, checkpoint resume posture, `research.external_sources` policy, and any context-versus-spec contradiction route explicit before branching.
4. `Execute`: build an initial assessment, follow the repository evidence ladder, classify non-trivial work into a parent-owned research strand ledger, record per-strand search notes and navigation evidence, research one runnable strand at a time, grounding repo truth first, tying strands to spec requirements and constraints when relevant, evaluating dependency/tool choices when they affect recommendations, accepting or rejecting sidecar packets before synthesis, keeping external evidence distinct when policy allows it, then assigning evidence IDs, claim IDs, lane labels, support classes, and limitations before final synthesis.
5. `Persist`: draft directly from the canonical template, checkpoint only useful continuation state, preserve compact `researchLedger` state for paused, blocked, sidecar-failed, validation-repair, or post-write-routing-failed work, and persist final research through MCP only.
6. `Validate`: normalize the draft to the canonical `phase.research` template and block on placeholders, missing sections, missing evidence, or other MCP-owned structural issues.
7. `Route`: sync `STATE.md`, reload refreshed state, and report only implemented follow-up commands.

## Blueprint And Global State Reads

- `.blueprint/STATE.md`
- Current phase `XX-CONTEXT.md` content through `blueprint_phase_artifact_read`
- Current phase `XX-SPEC.md` content through `blueprint_phase_artifact_read` when `phase.artifacts.spec` is present
- Existing `XX-RESEARCH.md` content, when present

## Blueprint And Global State Writes

- `phase XX-RESEARCH.md`
- Optional shared phase checkpoint JSON owned by `research-phase`
- `.blueprint/STATE.md`

## Required MCP Tools

- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_phase_context` -> `{phase, projectBrief, requirementsGrounding, workflowPosture, codebase, requirements, missingArtifacts, warnings}`
- `blueprint_phase_research_status` -> `{hasContext, hasResearch, hasUiSpec, contextPath, researchPath, uiSpecPath, researchValid, researchIssues, suggestedRepairs, planningReadiness, warnings}`
- `blueprint_phase_artifact_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, content, reason}`
- `blueprint_phase_artifact_write` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, written, created, overwritten, status, validation, warnings}`
- `blueprint_phase_checkpoint_get` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, path, checkpoint, ownerCommand, resumeMode, safeToResume, warnings, reason}`
- `blueprint_phase_checkpoint_put` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, path, updated, warnings}`
- `blueprint_phase_checkpoint_delete` -> `{phaseFound, phaseNumber, phasePrefix, phaseName, phaseDir, path, deleted, reason}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}`
- `blueprint_phase_artifact_scaffold` -> `{phaseNumber, phasePrefix, phaseName, phaseDir, artifact, path, createdFiles, reusedFiles, warnings}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_state_load` -> `{state, blockers, derivedStatus}`
- `blueprint_command_catalog` -> `{commands, waves, aliases}`
- `blueprint_state_update` -> `{updatedFields, statePath, warnings}`

## Research Runtime Anchors

- Read `blueprint_config_get` with `scope: "effective"` before any external verification decision. Treat `config.research.external_sources` as the source of truth and `workflowPosture.research.externalSources` as the mirrored convenience field.
- Read the actual current `XX-CONTEXT.md` content before drafting. If the context read returns `found: false`, stop and route back to `/blu-discuss-phase <phase>` instead of drafting from status-only signals.
- Treat invalid or unusable context the same as missing context: stop and route to `/blu-discuss-phase <phase>` with the precise diagnostics. `/blu-research-phase` owns `XX-RESEARCH.md` only and must not rewrite `XX-CONTEXT.md`.
- After usable context is confirmed, use `blueprint_phase_artifact_read` with `artifact: "spec"` to read phase-local spec only when `phase.artifacts.spec` is present. If that read returns `found: false` or the spec is otherwise unavailable, continue normal research readiness without substituting missing spec intent from external sources. Missing spec is nonblocking.
- If spec and context contradict, stop; when the context is stale relative to spec, route to `/blu-discuss-phase <phase>`, or when the spec is stale or wrong, route to `/blu-spec-phase <phase>`. Do not silently resolve the contradiction inside research.
- When saved research is already valid, default to reuse unless the user chooses `view` or `update`. Choosing `update` is the overwrite gate. Invalid existing research must go through repair or a reported blocker; `view`, default reuse, or unchanged invalid writes are not successful exits for invalid research.
- Read `blueprint_artifact_contract_read` with `artifactId: "phase.research"` before drafting or revising. Draft from `contract.authoringTemplate`, treat `contract.freehandPolicy` as authoritative for extra top-level headings, and use `blueprint_phase_artifact_scaffold` only for a deliberate placeholder the user explicitly wants before final research exists.
- Keep repo evidence distinct from official docs or explicitly supplied external references. The runtime contract may suggest source dates or an explicit unchecked marker for freshness-sensitive `## State Of The Art` claims, but MCP validation does not require either marker; the post-write validator emits a validation warning rather than rejects when those optional freshness cues are absent.
- For planner-critical claims, use claim-addressable provenance: evidence IDs, claim IDs, repo/external/inference lanes, support class, source type, authority tier, support span, retrieval context, limitations, and downstream use. `## Sources` should split into `Repo Evidence`, `External Sources`, and `Inference Notes`. The preferred saved shape includes a Claim Support Ledger for planner-critical claims, a Source Register under `## Sources`, a Recommendation Handoff table under `## Recommendations`, and a Source-Support Self-Check before persistence. MCP validation keeps only a small set of post-write honesty and planner-handoff warnings rather than enforcing every quality nudge after generation.
- Build an investigation trace for non-trivial research: saved artifacts inspected, relevant repo files or symbols, retrieval modes, per-strand search notes, key findings, implementation questions, and confidence.
- Prefer the runtime contract's repository evidence ladder over broad crawls: saved context, existing research, saved codebase summaries, `rg --files` plus path filters, scoped content searches, optional parent-supplied navigation packets, then targeted file/test/contract/runtime reads. Treat remote code-search results as discovery hints until local worktree or saved Blueprint artifacts confirm them.
- Tie relevant research strands to spec requirements and constraints when spec evidence exists.
- Close each non-trivial topic strand with a planning handoff: recommendation, affected files or modules, validation or test implications, unresolved blockers, evidence basis, and confidence.
- When a recommendation adds, adopts, replaces, upgrades, installs, vendors, forks, code-generates, or hand-rolls a package, library, CLI, framework, service, or tool, record a dependency/tool evaluation covering no-new-dependency, existing dependency, standard-library/platform, candidate, and custom options; version, maintenance, vulnerability, license, provenance/signature, transitive-footprint, install-scope, lockfile, update-posture, residual-risk, verification, and supply-chain evidence; cite the spec requirement or spec constraint that makes the choice planner-critical when relevant; include Recommendation Handoff spec path plus requirement labels when they materially shape a recommendation; and mark unavailable live evidence as unchecked under the configured external-source policy.
- `blueprint-researcher` is optional and capability-gated. Use it only when a suitable Blueprint research or code-analysis agent is available and a bounded sidecar pass materially helps; otherwise use the runtime contract's single-agent topic-strand fallback. Any official-doc, external evidence, or semantic/navigation packet must come from the parent command or user, not from the subagent fetching or inventing it on its own. The parent sends one bounded evidence question plus allowed source classes and expects bounded findings with source classes, source roles, paths or URLs, search notes, confidence, failed/noisy/no-hit or limited searches, unanswered questions, and planning handoff fields.
- Use `blueprint_phase_checkpoint_get`, `blueprint_phase_checkpoint_put`, and `blueprint_phase_checkpoint_delete` only as resumability aids for `/blu-research-phase`, respecting checkpoint ownership and mode guards.
- For non-trivial, resumed, blocked, or sidecar-assisted runs, maintain a parent-owned research strand ledger with strand ids, questions, dependencies, source policy, budgets, statuses, accepted evidence ids, rejected or low-quality sources, stopping reasons, draft state, and next action.
- Checkpoint the compact strand ledger and packet references, not child-agent transcripts. Research resumability lives on the shared checkpoint v2 shape itself: `schemaVersion: 2`, `ownerCommand: "/blu-research-phase"`, top-level `mode: "research"`, and a `researchLedger` payload.
- Safe research checkpoints resume by default. Explicit discard uses `blueprint_phase_checkpoint_delete` with `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`; do not start fresh unless deletion succeeds.
- Delete a research-owned checkpoint only after final research write, synced `STATE.md` update, refreshed state load, and implemented-command routing receipt succeed.
- After a successful research write or a valid non-writing reuse path, call `blueprint_state_update` with `base: "synced"` while preserving the already resolved selected phase in `patch.currentPhase` together with `patch.activeCommand`, and then `blueprint_state_load`. Use `blueprint_command_catalog` before recommending `/blu-plan-phase`, `/blu-ui-phase`, or any other follow-up.

## Research Persistence Contract

- Read `blueprint_artifact_contract_read` with `artifactId: "phase.research"` and draft from `contract.authoringTemplate` before persistence.
- Persist final research through `blueprint_phase_artifact_write` with the resolved numeric `phase`, `artifact: "research"`, and full markdown body.
- Bare names such as `RESEARCH`, phase directories, filenames, and absolute paths are invalid tool inputs; the phase-scoped tools own the final repo-relative path.
- Use the returned `path` as authoritative after writes.
- Failed validation requires validation repair/retry before the command can treat research as complete.
- Retry research validation repair at most once for the same draft. If the retry returns identical diagnostics, stop, preserve or refresh the research checkpoint, report the exact diagnostics and next safe action, and do not inspect MCP source as the repair strategy.

## Skills And Subagents

- Primary skill: `blueprint-phase-discovery`
- Runtime reference: `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- Optional subagents:
- `blueprint-researcher` when suitable Blueprint research or code-analysis support is available and useful

## Dependencies

- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/new-project.md`
- `docs/commands/discuss-phase.md`

## External Shell Or Git Dependencies

- External dependencies:
- Official docs or explicitly supplied external references only when `research.external_sources` allows the check and repo evidence cannot settle the claim

## Shell Risk Profile

- Low: writes phase research artifacts when needed, may refresh the resumable research-owned shared checkpoint, and syncs `.blueprint/STATE.md`.

## User Prompts And Confirmation Gates

- Prefer Gemini CLI's built-in `ask_user` dialog only when the user asks to view or update valid research; otherwise valid saved research can reuse by default.
- Choosing `update` is the overwrite gate for valid existing research; no default overwrite path exists.
- Treat missing `XX-CONTEXT.md` as a blocking gate before drafting research.
- Treat invalid existing research as repair-only until it validates again.
- When `research.external_sources` is `ask`, stop for confirmation before any official-doc or other external verification.
- Resume from a saved checkpoint by default when it is safe and the user has not explicitly asked to discard it.

## Checkpoint, Resume, And Completion Receipt

- If no checkpoint exists, start a fresh parent-owned strand ledger.
- If a checkpoint exists and `safeToResume=true`, resume by default and show a compact recap of completed strands, blocked strands, pending gate, warnings, and next action.
- If a checkpoint exists but `safeToResume=false`, do not resume, overwrite, or delete it by default. Report `ownerCommand`, `resumeMode`, warnings, and the next safe implemented action.
- If the user explicitly discards a safe research checkpoint, use the guarded MCP delete path and start fresh only after it succeeds.
- If final research writes successfully but state sync, refreshed state load, or command-catalog routing fails afterward, keep or refresh the checkpoint with the exact failure and report that completion is blocked.
- The final response should name the phase, created/updated/reused/viewed/checkpointed outcome, artifact path when MCP returned one, checkpoint disposition, warnings or blockers, state sync/routing result, and next safe implemented action.

## Edge Cases

- The target phase is omitted or ambiguous while multiple active phases exist.
- Existing research is present but invalid, stale, or inconsistent with the saved context.
- Research needs multiple bounded passes because evidence is broad, contradictory, or blocked on approved external confirmation.
- A partially completed run must preserve resumable state instead of pretending the artifact is final.

## Failure Modes And Recovery

- Explain exactly which phase artifact is missing and which command creates it.
- Surface `blueprint_phase_locate.reason` or recovery guidance when roadmap or phase-directory resolution fails.
- When research remains inconclusive, persist a checkpoint, summarize verified versus unresolved areas, and route to the next safe implemented continuation step instead of fabricating certainty.

## Acceptance Criteria

- Reads and writes only the selected phase scope plus `.blueprint/STATE.md`.
- Reads the actual saved context content before drafting or revising research.
- Stops on missing context until the user repairs or confirms the recovery route.
- Does not create, repair, overwrite, or infer phase context; missing or unusable context routes to `/blu-discuss-phase <phase>`.
- Keeps an explicitly selected earlier phase pinned through the synced `STATE.md` refresh instead of relying on roadmap-derived phase selection.
- Uses `contract.authoringTemplate` as the direct drafting seed and reserves scaffold for deliberate placeholder creation only.
- Honors the effective `research.external_sources` policy before any external verification step.
- Keeps repo truth explicit and distinct from official-doc or user-supplied external evidence.
- Planner-critical claims are traceable through claim-addressable evidence IDs or claim IDs when new research is authored, with repo truth dominating Blueprint runtime claims and inference explicitly labeled.
- Records enough investigation trace for planning: saved artifacts, relevant repo files or symbols, retrieval modes, per-strand search notes, key findings, implementation questions, and confidence.
- Keeps code search scoped by default, records stop/widen rationale for non-trivial strands, and treats remote code-search hits as hints until local repo evidence confirms them.
- Closes non-trivial strands with planning handoffs that name affected files or modules, validation or test implications, unresolved blockers, evidence basis, and confidence.
- Dependency/tool recommendations are backed by a supply-chain-aware evaluation table or explicitly marked as unchecked/deferred when the configured external-source policy prevents live evidence.
- Handles long-running or inconclusive research through checkpointed continuation rather than a single all-or-nothing pass.
- Stores research continuation state as compact strand ledger and packet references, not child-agent transcripts.
- Resumes safe research checkpoints by default, uses guarded discard when asked, and preserves checkpoints on post-write state-sync or route-refresh failure.
- Reports the next safe action from refreshed runtime state instead of assuming `blueprint_state_update` returned it.
- Uses only documented MCP tools for persistent state changes.

## Test Cases

- Single-phase happy path fixture.
- Missing-artifact recovery fixture.
- Direct `research-phase` happy-path fixture.
- Existing research `view`, `skip`, and `update` fixture.
- Existing invalid research repair fixture.
- Missing-context gate fixture.
- Reuse plus `STATE.md` sync fixture.
- Invalid research-content rejection fixture.
- Investigation trace and navigation evidence packet fixture.
- repository evidence ladder fixture with search note fields, role/method source rows, and remote-code-search-as-hint language.
- Bounded `blueprint-researcher` packet contract fixture.
- Strand planning handoff fixture.
- dependency/tool evaluation fixture with no-new-dependency, existing dependency, standard-library/platform, candidate package/tool, custom implementation, setup/update posture, library-vs-custom decision, and supply-chain evidence.
- claim-addressable evidence provenance fixture with Repo Evidence, External Sources, Inference Notes, Evidence ID, Claim ID, support class, source type, authority tier, access date, support span, retrieval context, limitations, and downstream use.
- Honesty-warning fixture for live external wording without dated external evidence.
- Warning fixture for `HIGH` confidence research that also contains `not_enough_evidence`, `contradicted`, `conflicting_sources`, `unchecked`, or `unverified`.
- Repository Runtime Support Rule fixture where a `repo_runtime` claim cites only external evidence and validation returns `research.repo_runtime_claim_missing_repo_evidence` as a warning diagnostic.
- Retrieval Adequacy Rule fixture where a `repo_runtime` claim cites only summary/search evidence and validation returns `research.repo_runtime_claim_retrieval_partial` as a warning diagnostic.
- Recommendation Handoff fixture where a planner-critical recommendation lacks supporting claims, affected surfaces, or tests/checks and validation returns planner-handoff warning diagnostics.
- Source Policy Honesty Rule fixture where `research.external_sources` is effectively `off` and research prose says "current official docs confirm" without allowed external evidence; validation returns `research.live_external_claim_without_evidence`.
- Sidecar External Evidence Boundary fixture where `agents/blueprint-researcher.md` requires `needs-parent-evidence`, parent-supplied external source IDs only, and a prohibition on self-fetched official-doc claims.
- Research strand ledger fixture with `researchLedger.schemaVersion`, strand statuses, stopping reasons, draft state, and next action.
- Checkpoint resume/discard fixture covering safe resume, guarded discard, foreign checkpoint refusal, and post-write route-refresh failure preservation.
- No-transcript checkpoint fixture proving child-agent transcripts are not checkpointed.
- Sidecar failure fixture with `tool-failure` or `budget-exhausted` stopping reason and parent-owned retry/checkpoint behavior.
