# `/blu-reapply-patches`
| Field | Value |
|---|---|
| Wave | `5` |
| Family | `Workspace And Maintenance` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `high-risk-maintenance` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Keep the patch-replay posture explicit throughout the run: resolved scope must stay tied to the selected patch ids, tracked files, compatibility notes, registry path, and replay audit destination; pending gates stay limited to visible preflight blockers such as `dirty-working-tree`, `malformed-patch-registry`, `missing-patch-target`, `compatibility-mismatch`, or `installed-extension-target`, plus the destructive approval gate `reapply-patches-confirmation`; execution mode should reflect preview-only versus confirmed replay; and the next safe action should stay visible while the command is waiting on cleanup, confirmation, or conflict remediation.

## Purpose

`reapply-patches` is Blueprint's confirmation-gated maintenance command for replaying a recorded patch set after an update or other safe maintenance event. In Blueprint it now ships as a host-global patch-registry flow: it keeps patch state under `~/.<host>/blueprint/patches/`, previews compatibility and conflicts before mutation, blocks unsafe targets, and records replay audits without inventing project-local `.blueprint/` runtime ownership for patch state.

## Command Path And Examples

- CLI command path: `/blu-reapply-patches`
- Root router form: `/blu reapply-patches`
- Argument hint: `[--patch <id>] [--patch <id2>]`
- `/blu-reapply-patches --patch theme-fix`
- `/blu-reapply-patches --patch theme-fix --patch lint-cleanup`
- `/blu reapply-patches`

## Inputs, Project State, And Prerequisite Artifacts

- A recorded patch manifest must already exist in the host-global patch registry.
- The replay target must already be a valid git repo.
- Patch replay must stop when the target repo has uncommitted changes.
- Patch replay must stop when the selected patch set is incompatible with the current host or repo, the registry is malformed, the patch payload is missing, or the resolved target is the installed extension directory.

## Outputs

- User-facing result: a concise completion summary plus any active waiting state or next safe action when applicable.
- Repo side effects: may mutate repo files when the approved patch set applies cleanly.
- Global side effects: appends replay audit metadata under `~/.<host>/blueprint/patches/`.
- In-flight replay work should keep the resolved scope, active stage, pending gate, execution mode, preview result, and next safe action legible while the run is still live.

## Blueprint And Global State Reads

- `~/.<host>/blueprint/patches/index.json`
- selected patch manifests and patch payloads under `~/.<host>/blueprint/patches/`
- git status and current HEAD for the replay target

## Blueprint And Global State Writes

- replay audit log at `~/.<host>/blueprint/patches/<patch-id>.audit.ndjson`
- refreshed patch manifest metadata under `~/.<host>/blueprint/patches/`
- repo file changes when replay succeeds

## Required MCP Tools

- `blueprint_patch_list` -> `{registryPath, patches}`
- `blueprint_patch_reapply` -> `{registryPath, appliedPatches, skippedPatches, conflicts, preview, targetHead}`
- `blueprint_patch_record` -> `{patchId, registryPath, manifestPath, patchPath, auditPath, trackedFiles, updated}`

## Registry And Audit Contract

- Treat `blueprint_patch_list` as the authoritative host-global registry read; do not invent a project-local patch index under `.blueprint/`.
- Treat the returned registry path, manifest paths, patch paths, tracked files, compatibility notes, and audit paths as authoritative patch metadata.
- Persist replay audits only through `blueprint_patch_record`; append audit entries under `~/.<host>/blueprint/patches/` instead of creating `.blueprint/reports/` state for this command.
- Treat `blueprint_patch_reapply` with `dryRun: true` as the authoritative preview and conflict check before replay confirmation.

## In-Flight Progress Contract

- Keep the shared stage vocabulary visible only for the stages the replay run actually reaches.
- Keep the waiting state explicit whenever replay is blocked before mutation: preflight blockers should surface as `dirty-working-tree`, `malformed-patch-registry`, `missing-patch-target`, `compatibility-mismatch`, or `installed-extension-target`; destructive approval should stay visible as `reapply-patches-confirmation`; and reported conflicts should keep the replay blocked until the user chooses a next step.
- Keep that visible progress aligned to the selected patch ids, tracked files, compatibility notes, registry path, execution mode, preview result, and next safe action while the run moves from preview through confirmation, replay, audit recording, validation, and routing.
- Execution mode should distinguish preview-only versus confirmed replay.

## Skills And Subagents

- Primary skill: `blueprint-maintenance`
- Optional subagents: none

## Dependencies

- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/update.md`

## External Shell Or Git Dependencies

- External dependencies:
- git

## Shell Risk Profile

- High: confirmation-gated repo patch replay.

## Risk Notes

- Patch replay must target the host-global patch registry in `~/.<host>/blueprint/patches/`, not ad hoc files in the repo and not the installed extension copy.
- Conflict reporting matters more than partial progress; if preview detects conflicts, the command should stop cleanly before mutation.
- Compatibility must stay auditable by patch id, repo identity, and host before replay begins.
- The command should show the exact patch set, tracked files, compatibility notes, preview result, and audit destination before replay confirmation.

## User Prompts And Confirmation Gates

- Always preview the selected patch ids, tracked files, compatibility notes, registry path, and replay outcome before mutation.
- Require explicit confirmation before replaying patches, and keep the destructive approval gate visible as `reapply-patches-confirmation` until the user approves.
- Do not smooth past a reported conflict; surface the conflict details and name the next safe action instead.

## Edge Cases

- The selected patch ids exist in the registry, but one manifest or patch payload is missing or malformed.
- A saved patch was recorded for a different host or repo and must not be replayed here.
- The target repo is clean but has drifted enough that patch preview reports conflicts.
- The resolved target is the installed extension directory, which must never be mutated from inside the running host session.

## Failure Modes And Recovery

- Stop on dirty trees, malformed patch registry state, missing patch payloads, compatibility mismatches, installed-extension targets, or preview conflicts with a specific remediation checklist.
- Do not mutate the installed extension directory.
- Leave repo files untouched when preflight or preview fails.
- Keep the host-global patch registry authoritative even when replay is blocked; do not invent a second audit surface.

## Acceptance Criteria

- Mutates only the approved patch set against the intended repo target.
- Records replay audit state only under `~/.<host>/blueprint/patches/`.
- Creates or updates only the declared host-global artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Never executes git, workspace, patch, or cleanup mutation without an explicit confirmation gate.
- Hard-stops before mutation on dirty trees, malformed patch registry state, missing patch targets, compatibility mismatches, or installed-extension targets.
- Preserves the flow `preflight -> preview -> confirm -> replay -> record`.

## Test Cases

- Clean replay fixture with recorded manifest and replay audit.
- Dirty-tree stop fixture.
- Malformed-registry fixture.
- Compatibility-mismatch fixture.
- Conflict-reporting fixture.
