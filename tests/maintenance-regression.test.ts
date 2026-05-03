import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("maintenance manifests keep dirty-tree stops, advisory mode gates, and report-before-mutate gates explicit", async () => {
  const [newWorkspace, removeWorkspace, workstreams, updateCommand, prBranch, ship, undo, cleanup, reapplyPatches] = await Promise.all([
    readRepoFile("commands/blu-new-workspace.toml"),
    readRepoFile("commands/blu-remove-workspace.toml"),
    readRepoFile("commands/blu-workstreams.toml"),
    readRepoFile("commands/blu-update.toml"),
    readRepoFile("commands/blu-pr-branch.toml"),
    readRepoFile("commands/blu-ship.toml"),
    readRepoFile("commands/blu-undo.toml"),
    readRepoFile("commands/blu-cleanup.toml"),
    readRepoFile("commands/blu-reapply-patches.toml")
  ]);

  assert.match(newWorkspace, /maintenance\.workspace_root/);
  assert.match(newWorkspace, /~\/blueprint-workspaces/);
  assert.match(newWorkspace, /workspace name, resolved workspace path, repo list, strategy, branch/i);
  assert.match(newWorkspace, /registry mutation plan/i);
  assert.match(newWorkspace, /new-workspace-confirmation/);
  assert.match(newWorkspace, /do not silently switch to `clone`/i);
  assert.match(newWorkspace, /next safe action/i);

  assert.match(removeWorkspace, /mcp_blueprint_blueprint_workspace_registry_get/);
  assert.match(removeWorkspace, /mcp_blueprint_blueprint_workspace_remove/);
  assert.match(removeWorkspace, /workspace-not-found/);
  assert.match(removeWorkspace, /workspace-path-ambiguity/);
  assert.match(removeWorkspace, /registry-drift/);
  assert.match(removeWorkspace, /remove-workspace-confirmation/);
  assert.match(removeWorkspace, /repo members with their strategies/i);
  assert.match(removeWorkspace, /next safe action/i);

  assert.match(workstreams, /mcp_blueprint_blueprint_workstream_list/);
  assert.match(workstreams, /mcp_blueprint_blueprint_workstream_mutate/);
  assert.match(workstreams, /mcp_blueprint_blueprint_state_update/);
  assert.match(workstreams, /ask_user/);
  assert.match(workstreams, /workstream-switch-confirmation/);
  assert.match(workstreams, /workstream-archive-confirmation/);
  assert.match(workstreams, /missing-resume-snapshot/);
  assert.match(workstreams, /dirty-working-tree/);
  assert.match(workstreams, /corrupt-workstream-index/);
  assert.match(workstreams, /next safe action/i);

  assert.match(updateCommand, /mcp_blueprint_blueprint_update_check/);
  assert.match(updateCommand, /mcp_blueprint_blueprint_update_plan/);
  assert.match(updateCommand, /update-mode-gate/);
  assert.match(updateCommand, /manual fallback/i);
  assert.match(updateCommand, /~\/.<host>\/blueprint\/updates\//);
  assert.match(updateCommand, /Never write into the installed extension directory/i);
  assert.match(updateCommand, /restart guidance/i);

  assert.match(prBranch, /If the repo has uncommitted changes, stop/i);
  assert.match(prBranch, /pending gate `clean-working-tree`/);
  assert.match(prBranch, /pr-branch-runtime-contract\.md/);
  assert.match(prBranch, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(prBranch, /commit classification ledger/i);
  assert.match(prBranch, /Summarize the target base branch, current source branch, source `HEAD`, candidate review branch name/i);
  assert.match(prBranch, /Require explicit confirmation before any branch creation or replay step/i);
  assert.match(prBranch, /retained file count, retained commit count/i);
  assert.match(prBranch, /If that report already exists.*require explicit overwrite confirmation before replacing it/i);
  assert.match(prBranch, /next safe action/i);

  assert.match(ship, /A dirty working tree or missing base branch is a hard stop for shipping/i);
  assert.match(ship, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(ship, /contract\.authoringTemplate/);
  assert.match(ship, /Summarize the exact shipping plan before any mutation/i);
  assert.match(ship, /Require explicit confirmation before any push or PR creation/i);
  assert.match(ship, /require explicit overwrite confirmation before replacing an existing `ship-latest` report/i);
  assert.match(ship, /After the approved push or PR attempt finishes, explicitly overwrite `ship-latest`/i);
  assert.match(ship, /next safe action/i);

  assert.match(undo, /A dirty working tree, detached HEAD, merge in progress, or missing revert target is a hard stop for undo/i);
  assert.match(undo, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(undo, /contract\.authoringTemplate/);
  assert.match(undo, /keep the destructive approval gate visible as `undo-confirmation`/i);
  assert.match(undo, /keep the report-overwrite waiting state visible as `report-overwrite-confirmation`/i);
  assert.match(undo, /approved undo plan[\s\S]*before git mutation begins/i);
  assert.match(undo, /After the revert attempt finishes, explicitly overwrite `undo-latest`/i);
  assert.match(undo, /next safe action/i);

  assert.match(cleanup, /A dirty working tree, missing phase directory root, or obviously inconsistent phase layout is a hard stop for cleanup/i);
  assert.match(cleanup, /Use Gemini-native `ask_user` for the destructive cleanup confirmation/i);
  assert.match(cleanup, /use Gemini-native `ask_user` for that approval when available/i);
  assert.match(cleanup, /If `ask_user` is unavailable for either confirmation, stop honestly with the named pending gate still visible/i);
  assert.match(cleanup, /Keep the destructive approval gate visible as `cleanup-confirmation`/i);
  assert.match(cleanup, /keep the waiting state visible as `archive-destination-confirmation`/i);
  assert.match(cleanup, /keep the report-overwrite waiting state visible as `report-overwrite-confirmation`/i);
  assert.match(cleanup, /require explicit overwrite confirmation through Gemini-native `ask_user`/i);
  assert.match(cleanup, /If `ask_user` is unavailable, stop honestly with `report-overwrite-confirmation` still visible/i);
  assert.match(cleanup, /approved cleanup (plan|scope)[\s\S]*before filesystem mutation begins/i);
  assert.match(cleanup, /next safe action/i);

  assert.match(reapplyPatches, /mcp_blueprint_blueprint_patch_list/);
  assert.match(reapplyPatches, /mcp_blueprint_blueprint_patch_reapply/);
  assert.match(reapplyPatches, /mcp_blueprint_blueprint_patch_record/);
  assert.match(reapplyPatches, /dirty working tree, malformed patch registry, missing patch target, compatibility mismatch, or installed-extension target is a hard stop/i);
  assert.match(reapplyPatches, /reapply-patches-confirmation/);
  assert.match(reapplyPatches, /preflight -> preview -> confirm -> replay -> record/i);
  assert.match(reapplyPatches, /next safe action/i);
});

test("maintenance skill keeps family-wide preflight, pending-gate, and report-before-mutate boundaries aligned", async () => {
  const skill = await readRepoFile("skills/blueprint-maintenance/SKILL.md");

  assert.match(skill, /confirm the resolved target, stop on dirty or drifted state, verify the intended evidence scope, and prefer a report-before-mutate flow/i);
  assert.match(skill, /`blueprint_workspace_registry_get`/);
  assert.match(skill, /`blueprint_workspace_create`/);
  assert.match(skill, /`blueprint_workspace_remove`/);
  assert.match(skill, /`blueprint_update_check`/);
  assert.match(skill, /`blueprint_update_plan`/);
  assert.match(skill, /`blueprint_workstream_list`/);
  assert.match(skill, /`blueprint_workstream_mutate`/);
  assert.match(skill, /`new-workspace-confirmation`/);
  assert.match(skill, /`remove-workspace-confirmation`/);
  assert.match(skill, /`workspace-not-found`, `workspace-path-ambiguity`, `dirty-working-tree`, `registry-drift`, `malformed-workspace-registry`, or `ask-user-unavailable`/);
  assert.match(skill, /`update-mode-gate`/);
  assert.match(skill, /manual fallback/i);
  assert.match(skill, /`workstream-switch-confirmation`/);
  assert.match(skill, /`workstream-archive-confirmation`/);
  assert.match(skill, /`missing-resume-snapshot`/);
  assert.match(skill, /`corrupt-workstream-index`/);
  assert.match(skill, /dirty working tree/i);
  assert.match(skill, /pending gate `clean-working-tree`/);
  assert.match(skill, /`review-branch-confirmation`/);
  assert.match(skill, /pr-branch-runtime-contract\.md/);
  assert.match(skill, /commit classification/i);
  assert.match(skill, /canonical authoring template/i);
  assert.match(skill, /`update_topic` tool and keep a compact shipping checklist with `write_todos`/i);
  assert.match(skill, /tracker-eligible only for session-local coordination/i);
  assert.match(skill, /overwrite `ship-latest`[\s\S]*actual outcomes, fallback notes, and post-mutation evidence/i);
  assert.match(skill, /`dirty-working-tree`, `detached-head`, `merge-in-progress`, or `missing-revert-target`/);
  assert.match(skill, /Keep `undo-confirmation` and `report-overwrite-confirmation` visible/i);
  assert.match(skill, /overwrite `undo-latest`[\s\S]*actual outcome, blockers, and stale-evidence fallout/i);
  assert.match(skill, /Keep the protected scope explicit throughout the run/i);
  assert.match(skill, /`cleanup-confirmation`/);
  assert.match(skill, /`archive-destination-confirmation`/);
  assert.match(skill, /Use Gemini-native `ask_user` for the destructive cleanup confirmation and archive-destination creation approval/i);
  assert.match(skill, /if `ask_user` is unavailable stop honestly with the named pending gate still visible/i);
  assert.match(skill, /require explicit overwrite confirmation through Gemini-native `ask_user`/i);
  assert.match(skill, /stop honestly with that named pending gate still visible when `ask_user` is unavailable/i);
  assert.match(skill, /before filesystem mutation begins/i);
  assert.match(skill, /\/blu-reapply-patches/);
  assert.match(skill, /`dirty-working-tree`, `malformed-patch-registry`, `missing-patch-target`, `compatibility-mismatch`, or `installed-extension-target`/);
  assert.match(skill, /`reapply-patches-confirmation`/);
  assert.match(skill, /`preflight -> preview -> confirm -> replay -> record`/);
  assert.match(skill, /next safe action/i);
});

test("maintenance runtime reference rows keep dirty-tree aborts, pending approvals, and next safe action visible", async () => {
  const runtimeReference = await readRepoFile("docs/RUNTIME-REFERENCE.md");

  assert.match(runtimeReference, /`pr-branch`[\s\S]*High-risk-maintenance profile for clean review-branch preparation/i);
  assert.match(runtimeReference, /`pr-branch`[\s\S]*blueprint_artifact_contract_read/i);
  assert.match(runtimeReference, /`pr-branch`[\s\S]*pr-branch-runtime-contract\.md/i);
  assert.match(runtimeReference, /`pr-branch`[\s\S]*classify commits into `code-only`, `blueprint-only`, `mixed`, and `empty-after-filter`/i);
  assert.match(runtimeReference, /`pr-branch`[\s\S]*`clean-working-tree`, `review-branch-confirmation`, or report overwrite approval/i);
  assert.match(runtimeReference, /`pr-branch`[\s\S]*report-backed pre-mutation posture reviewable/i);
  assert.match(runtimeReference, /`pr-branch`[\s\S]*next safe action explicit/i);

  assert.match(runtimeReference, /`ship`[\s\S]*High-risk-maintenance profile for branchy shipping flows/i);
  assert.match(runtimeReference, /`ship`[\s\S]*resolved scope, active stage, pending gate, execution mode, and next safe action visible/i);
  assert.match(runtimeReference, /`ship`[\s\S]*local prep plus optional push plus optional PR creation explicit/i);
  assert.match(runtimeReference, /`ship`[\s\S]*read `blueprint_artifact_contract_read` for the canonical `report\.ship` contract/i);
  assert.match(runtimeReference, /`ship`[\s\S]*persist `ship-latest`/i);
  assert.match(runtimeReference, /`ship`[\s\S]*overwrite `ship-latest` after push or PR attempts/i);

  assert.match(runtimeReference, /`undo`[\s\S]*High-risk-maintenance profile for confirmation-gated revert flow/i);
  assert.match(runtimeReference, /`undo`[\s\S]*`dirty-working-tree`, `detached-head`, `merge-in-progress`, or `missing-revert-target`/i);
  assert.match(runtimeReference, /`undo`[\s\S]*`undo-confirmation` and `report-overwrite-confirmation` visible/i);
  assert.match(runtimeReference, /`undo`[\s\S]*read `blueprint_artifact_contract_read` for the canonical `report\.undo` contract/i);
  assert.match(runtimeReference, /`undo`[\s\S]*persist `undo-latest` before git mutation/i);
  assert.match(runtimeReference, /`undo`[\s\S]*overwrite `undo-latest` after the revert attempt/i);

  assert.match(runtimeReference, /`new-workspace`[\s\S]*High-risk-maintenance profile for confirmation-gated workspace creation/i);
  assert.match(runtimeReference, /`new-workspace`[\s\S]*resolved scope, active stage, pending gate, execution mode, and next safe action visible/i);
  assert.match(runtimeReference, /`new-workspace`[\s\S]*workspace name, path, repo members, strategy, branch, manifest path, and registry mutation plan/i);
  assert.match(runtimeReference, /`new-workspace`[\s\S]*transactional/i);

  assert.match(runtimeReference, /`remove-workspace`[\s\S]*High-risk-maintenance profile for confirmation-gated workspace teardown/i);
  assert.match(runtimeReference, /`remove-workspace`[\s\S]*`workspace-not-found`, `workspace-path-ambiguity`, `dirty-working-tree`, `registry-drift`, `malformed-workspace-registry`, `ask-user-unavailable`, and `remove-workspace-confirmation` explicit/i);
  assert.match(runtimeReference, /`remove-workspace`[\s\S]*workspace manifest, workspace root, and matching host-global registry entry/i);
  assert.match(runtimeReference, /`remove-workspace`[\s\S]*next safe action visible/i);

  assert.match(runtimeReference, /`update`[\s\S]*Interactive-read advisory profile/i);
  assert.match(
    runtimeReference,
    /`update`[\s\S]*(`ask_user` only for the saved-checklist versus manual-fallback mode gate|update-mode-gate)/i
  );
  assert.match(runtimeReference, /`update`[\s\S]*~\/.<host>\/blueprint\/updates\//i);
  assert.match(runtimeReference, /`update`[\s\S]*restart guidance/i);

  assert.match(runtimeReference, /`workstreams`[\s\S]*Interactive-read profile for project-local workstream switching/i);
  assert.match(runtimeReference, /`workstreams`[\s\S]*Gemini-native `ask_user`/i);
  assert.match(runtimeReference, /`workstreams`[\s\S]*`workstream-switch-confirmation`, `workstream-archive-confirmation`, `missing-workstream`, `missing-resume-snapshot`, and `corrupt-workstream-index`/i);
  assert.match(runtimeReference, /`workstreams`[\s\S]*blueprint_state_update` only for the final routing patch or returned resume snapshot/i);

  assert.match(runtimeReference, /`cleanup`[\s\S]*High-risk-maintenance profile for protected-scope phase-directory archival/i);
  assert.match(runtimeReference, /`cleanup`[\s\S]*`dirty-working-tree`, `missing-phase-root`, or `inconsistent-phase-layout`/i);
  assert.match(runtimeReference, /`cleanup`[\s\S]*`cleanup-confirmation`, `archive-destination-confirmation`, and `report-overwrite-confirmation` visible/i);
  assert.match(runtimeReference, /`cleanup`[\s\S]*next safe action visible/i);

  assert.match(runtimeReference, /`reapply-patches`[\s\S]*High-risk-maintenance profile for confirmation-gated patch replay/i);
  assert.match(runtimeReference, /`reapply-patches`[\s\S]*`dirty-working-tree`, `malformed-patch-registry`, `missing-patch-target`, `compatibility-mismatch`, or `installed-extension-target`/i);
  assert.match(runtimeReference, /`reapply-patches`[\s\S]*`preflight -> preview -> confirm -> replay -> record`/i);
  assert.match(runtimeReference, /`reapply-patches`[\s\S]*next safe action visible/i);
});
