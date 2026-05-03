import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildBlueprintCommandRuntimeContractResource
} from "../src/mcp/command-resources.js";

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

test("maintenance runtime contract resources keep aborts, approvals, and owned inputs visible", async () => {
  const expectations = [
    ["pr-branch", /clean tree and review-branch confirmation/i, /pr-branch-runtime-contract\.md/],
    ["ship", /local prep, push, and PR creation as separate approved steps/i, /ship-runtime-contract\.md/],
    ["undo", /hard-stop on dirty or unsafe git state/i, /undo-runtime-contract\.md/],
    ["new-workspace", /derive workspace root from config or explicit input/i, /new-workspace-runtime-contract\.md/],
    ["remove-workspace", /resolve a single registry-backed workspace target/i, /remove-workspace-runtime-contract\.md/],
    ["workstreams", /switch\/archive confirmation gates before mutation/i, /workstreams-runtime-contract\.md/],
    ["cleanup", /protect the current phase and active roadmap references/i, /cleanup-runtime-contract\.md/],
    ["update", /update-mode-gate for saved checklist versus manual fallback/i, /update-runtime-contract\.md/],
    ["reapply-patches", /dry-run the exact replay set/i, /reapply-patches-runtime-contract\.md/]
  ] as const;

  for (const [commandName, notesPattern, inputPattern] of expectations) {
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName);
    const notes = contract.runtimeReference?.contractNotes ?? "";

    assert.equal(contract.catalog.primarySkill, "blueprint-maintenance");
    assert.equal(contract.catalog.status, "implemented");
    assert.equal(contract.catalog.implemented, true);
    assert.equal(contract.runtimeReference?.path, contract.catalog.specPath);
    assert.equal(contract.runtimeReference?.commandSpecPath, contract.catalog.specPath);
    assert.deepEqual(
      contract.runtimeReference?.exactMcpDestination,
      contract.catalog.requiredTools
    );
    assert.match(notes, /Docless manifest\+skill-owned runtime/i);
    assert.match(notes, notesPattern);
    assert.match(contract.skillInputs.effective.join("\n"), inputPattern);
    assert.equal(
      contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
      false
    );
  }
});
