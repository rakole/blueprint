# `/blu-new-milestone`
| Field | Value |
|---|---|
| Wave | `2` |
| Family | `Roadmap And Milestone` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `interactive-read` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `new-milestone` uses the shared interactive-read classification only to keep the command metadata aligned; it performs one bounded carry-forward or reset decision plus scaffold write, keeps persistence on MCP-owned Blueprint artifacts, and does not adopt tracker-backed branching or the long-running progress layer used by mutation-heavy commands.
- Shared phase-admin spine: read roadmap state first, preview the exact carry-forward source scope plus first-phase target plus starter-doc write scope, require a named confirmation gate before any mutation, persist only through MCP tools, treat the scaffolded first context as starter material only, update `STATE.md` only after scaffold succeeds, route to `/blu-discuss-phase <first phase>`, and never widen into tracker tools, long-running progress posture, or planned-only shortcuts.
- Keep the waiting state explicit as `missing-milestone-summary`, `carry-forward-confirmation`, or `starter-doc-overwrite-confirmation` when the command is blocked before writing.


## Purpose


`new-milestone` is Blueprint's command for starting a new milestone cycle. In Blueprint it stays host-native, defaults to carry-forward from the saved milestone summary, rewrites the starter milestone docs through the existing scaffold flow, preserves historical phase artifacts, seeds the first starter context, and routes to `/blu-discuss-phase <first phase>` instead of any planned-only follow-up.


## Command Path And Examples

- CLI command path: `/blu-new-milestone`
- Root router form: `/blu new-milestone`
- Argument hint: `[milestone name, e.g., 'v1.1 Notifications']`
- `/blu-new-milestone v1.1-Platform`
- `/blu new-milestone`

## Inputs, Project State, And Prerequisite Artifacts


- A Blueprint project must already exist.
- A matching `milestone-summary-<milestone>.md` report should already exist in `.blueprint/reports/`.
- Carry-forward is the default. A fresh reset is allowed only after explicit confirmation.
- Replacing the existing top-level milestone starter docs requires explicit overwrite confirmation.
- Preview the exact carry-forward evidence scope before mutation as a structured packet: resolved milestone summary path, digest `inputsUsed`, carry-forward or reset mode, any warnings, the proposed new milestone name, the first whole-number phase target that will receive the starter context scaffold, the affected starter-doc paths, overwrite risk, and `Safe default: stop without writing`.
- Read the canonical `report.milestone-summary` contract before building carry-forward seed text, and read `phase.context` before scaffolding the first context artifact for the next milestone.


## Outputs


- User-facing result: a concise completion summary plus the next safe implemented action when applicable.
- Repo side effects: Rewrites the starter milestone docs in `.blueprint/`, scaffolds the first carried-forward phase context artifact, and updates `.blueprint/STATE.md`.
- In-flight posture: none beyond a concise inline summary or confirmation gate; `new-milestone` does not expose the long-running progress layer.


## Blueprint And Global State Reads


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract, authoringTemplate, validation, warnings}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}` with `scope: "effective"` before any optional roadmapper pass


## Blueprint And Global State Writes


- `.blueprint/PROJECT.md`
- `.blueprint/REQUIREMENTS.md`
- `.blueprint/ROADMAP.md`
- `.blueprint/phases/<next-phase-slug>/<NN-CONTEXT.md>`
- `.blueprint/STATE.md`


## Required MCP Tools


- `blueprint_roadmap_read` -> `{roadmap, milestone, phases}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract, authoringTemplate, validation, warnings}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_config_get` -> `{scope, config, provenance, sourcePath, warnings}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_state_update` -> `{updatedFields, statePath}`

## Carry-Forward Contract

- Read `report.milestone-summary` through `blueprint_artifact_contract_read` before deriving carry-forward seed text, and normalize any summary-derived seed text to the returned `authoringTemplate` when the contract provides one.
- Read `blueprint_config_get` with `scope: "effective"` before any optional `blueprint-roadmapper` decision so roadmapper use stays config-gated.
- Treat the confirmation review as a named in-flight receipt. `carry-forward-confirmation` binds the approved summary path, `inputsUsed`, mode, proposed milestone name, first phase preview, and starter-doc scope to the later scaffold and state-update arguments. `starter-doc-overwrite-confirmation` binds the approved overwrite set and overwrite risk to the later scaffold call.
- Build `requirementTransitions` only as starter-seed evidence for the next milestone. The carry-forward packet may include rows with `decision` values `carry`, `modify`, `defer`, `retire`, `new`, `self-derived`, or `uncertain`, but those rows do not become a competing `.blueprint/REQUIREMENTS.md` write path on their own.
- Each `requirementTransitions` row must cite `sourceRefs` plus `rationale`. If the disposition is inferred, partial, or not yet proven, label that uncertainty explicitly instead of hiding it inside a confident-looking transition row.
- Read `phase.context` through `blueprint_artifact_contract_read` before scaffolding the first phase context artifact so the seeded `XX-CONTEXT.md` stays aligned with the canonical contract.
- Pass only repo-relative `artifactPaths` into `blueprint_artifact_summary_digest`, and treat returned `inputsUsed` as the authoritative carry-forward evidence scope.
- Use `blueprint_artifact_scaffold` only to seed the next milestone starter docs and first context file. Do not treat scaffold text as the final authored milestone content.
- Treat returned scaffold receipt fields as authoritative for the first carried-forward phase: `highestBasePhaseNumber`, `firstPhaseNumber`, `firstPhasePrefix`, `firstPhaseDir`, `firstContextPath`, `deletedPhaseDirectories`, and `renamedPhaseDirectories`. Stale previews, conflicting first-phase directories, ambiguous first-phase directories, and missing first context paths block instead of triggering prompt-side recomputation.
- Update `STATE.md` only after scaffold succeeds so the active phase never points at a missing starter context path.
- Preserve the confirmed next phase number when building the first context path; do not invent or renumber historical phase directories manually.


## Skills And Subagents


- Primary skill: `blueprint-roadmap-admin`
- Optional subagents:
- `blueprint-roadmapper`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/milestone-summary.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Medium: rewrites carried-forward milestone starter docs and advances the active milestone.

## User Prompts And Confirmation Gates


- Carry-forward is the default path. Require explicit confirmation only when the user wants a fresh reset instead.
- Show the exact evidence scope, first-phase target, and overwrite set in the confirmation preview before any mutation.
- The preview packet should name the summary source path, `inputsUsed`, carry-forward or reset mode, proposed milestone name, first phase preview, affected starter paths, overwrite risk, and `Safe default: stop without writing`.
- Require explicit overwrite confirmation before replacing the existing milestone starter docs.
- Prefer Gemini CLI `ask_user` for the reset-vs-carry-forward and overwrite confirmation gates.
- If the user declines, stop without writing. When a safe route is needed, point to `/blu-progress`.


## Edge Cases


- Missing milestone summary report for the resolved milestone.
- Fresh reset instead of the default carry-forward path.
- Continuing phase numbering without deleting historical phase directories.


## Failure Modes And Recovery


- Show roadmap and report drift before mutation.
- If the milestone summary report is missing, stop with concise guidance to run `/blu-milestone-summary` first.
- Preserve historical phase directories; do not delete or renumber prior milestones as part of this command.
- Return the nearest valid phase or milestone candidates when the target does not exist.


## Acceptance Criteria


- Defaults to carry-forward from the saved milestone summary and requires an explicit user choice to reset from scratch.
- Uses the saved `milestone-summary-<milestone>.md` report as the durable carry-forward input for the next milestone start.
- Uses named confirmation receipts that bind the approved preview packet to later scaffold and state-update arguments instead of relying on prose-only approval.
- Uses the `blueprint_artifact_scaffold` first-phase receipt for `highestBasePhaseNumber`, `firstPhaseNumber`, `firstPhasePrefix`, `firstPhaseDir`, `firstContextPath`, `deletedPhaseDirectories`, and `renamedPhaseDirectories`.
- Treats `requirementTransitions` as starter-seed evidence only: rows carry `sourceRefs`, `rationale`, and explicit uncertainty labeling when needed, but they do not replace the canonical `.blueprint/REQUIREMENTS.md` authoring path.
- Rewrites starter docs through `blueprint_artifact_scaffold` using an explicit carry-forward seed rather than ad hoc file edits.
- Preserves historical phase directories and starts the new milestone at the next whole-number phase.
- Scaffolds the first new phase context artifact so `/blu-discuss-phase <first phase>` has a valid phase directory to target.
- Returns `/blu-discuss-phase <first phase>` as the next safe implemented follow-up.
- Stops without writing when the user declines the preview or overwrite confirmation.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.


## Test Cases


- Missing-summary rejection fixture.
- Carry-forward default fixture.
- Phase-number continuity fixture.
- Direct `new-milestone` happy-path fixture.
