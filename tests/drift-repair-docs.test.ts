import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("control-plane docs describe the shipped lifecycle runtime and active closeout state", async () => {
  const [agents, readme, gemini, handoff, memory, runtimeReference, hooks] =
    await Promise.all([
      readRepoFile("AGENTS.md"),
      readRepoFile("README.md"),
      readRepoFile("GEMINI.md"),
      readRepoFile("docs/HANDOFF.md"),
      readRepoFile("MEMORY.md"),
      readRepoFile("docs/RUNTIME-REFERENCE.md"),
      readRepoFile("docs/HOOKS-POLICIES.md")
    ]);

  assert.doesNotMatch(agents, /No Gemini extension runtime has been implemented yet/);
  assert.doesNotMatch(handoff, /No runtime code or Gemini extension scaffolding has been created yet/);
  assert.match(agents, /Phase 2\.1 drift recovery and Phase 2\.2 future-contract drift repair both completed on 2026-04-11/);
  assert.match(agents, /Phase 3 discovery shipped on 2026-04-11 and is under active repair/);
  assert.match(
    agents,
    /`execute-phase` are now implemented on top of the plan and summary MCP substrates|`plan-phase` and `execute-phase` are now implemented|`plan-phase`, `execute-phase`, and `validate-phase` are now implemented/
  );
  assert.match(readme, /Wave 0 shipped commands/);
  assert.match(readme, /Phase 3 discovery commands are shipped/);
  assert.match(readme, /Phase 3 discovery shipped the same day and remains in parity closeout/i);
  assert.match(readme, /shipped lifecycle slice also includes `\/blu-plan-phase`, `\/blu-execute-phase`, `\/blu-validate-phase`, `\/blu-verify-work`, and the read-only next-step router `\/blu-next`/i);
  assert.match(
    gemini,
    /The live runtime now includes `\/blu-plan-phase`, `\/blu-execute-phase`, `\/blu-validate-phase`, `\/blu-verify-work`/i
  );
  assert.match(gemini, /\/blu-execute-phase/);
  assert.match(gemini, /\/blu-map-codebase/);
  assert.match(handoff, /Phase 2\.1 drift recovery and Phase 2\.2 future-contract drift repair both completed on 2026-04-11/i);
  assert.match(handoff, /Phase 3 discovery shipped the same day and remains in parity closeout/i);
  assert.match(
    memory,
    /Current milestone: post-shipment lifecycle and roadmap-admin closeout/i
  );
  assert.match(runtimeReference, /Checkpoint: Phase 2\.2 future-contract drift repair/);
  assert.match(runtimeReference, /State: closed on 2026-04-11/);
  assert.match(runtimeReference, /repairs discovery parity gaps/i);
  assert.match(
    runtimeReference,
    /Wave 2 roadmap administration, Wave 3 capture plus lightweight execution, Wave 4 docs and review, and the shipped Wave 5 maintenance surfaces including `new-workspace`, `cleanup`, and `update` all remain locked to their documented command contracts/i
  );
  assert.match(
    runtimeReference,
    /The implemented Blueprint runtime now uses dedicated plan index\/read\/write MCP tools/i
  );
  assert.match(
    runtimeReference,
    /Execution now honors normalized parallelization, worktree, and branching config through dedicated plan read and summary persistence tools/i
  );
  assert.doesNotMatch(hooks, /No hook code ships/);
  assert.match(hooks, /Blueprint now ships three advisory hooks/);
});

test("drift-repair docs capture the status vocabulary and the repaired future-command ownership metadata", async () => {
  const [agents, catalog, artifactSchema, drift, skills, progress, readme, bluCommand, bluHelp] = await Promise.all([
    readRepoFile("AGENTS.md"),
    readRepoFile("docs/COMMAND-CATALOG.md"),
    readRepoFile("docs/ARTIFACT-SCHEMA.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md"),
    readRepoFile("docs/SKILLS-AND-AGENTS.md"),
    readRepoFile("PROGRESS.md"),
    readRepoFile("README.md"),
    readRepoFile("commands/blu.toml"),
    readRepoFile("commands/blu-help.toml")
  ]);

  assert.match(catalog, /\| Command \| Wave \| Family \| Primary Skill \| Status \| Key Writes \| Risk \|/);
  assert.match(catalog, /`map-codebase` \| 0 \| `Foundation` \| `blueprint-map` \| `implemented`/);
  assert.match(catalog, /`next` \| 1 \| `Core Lifecycle` \| `blueprint-router` \| `implemented`/);
  assert.match(catalog, /`execute-phase` \| 1 \| `Core Lifecycle` \| `blueprint-phase-execution` \| `implemented`/);
  assert.match(catalog, /`insert-phase` \| 2 \| `Roadmap And Milestone` \| `blueprint-roadmap-admin` \| `implemented`/);
  assert.match(catalog, /`remove-phase` \| 2 \| `Roadmap And Milestone` \| `blueprint-roadmap-admin` \| `implemented`/);
  assert.match(catalog, /`audit-milestone` \| 2 \| `Roadmap And Milestone` \| `blueprint-roadmap-admin` \| `implemented`/);
  assert.match(catalog, /`complete-milestone` \| 2 \| `Roadmap And Milestone` \| `blueprint-roadmap-admin` \| `implemented`/);
  assert.match(catalog, /`milestone-summary` \| 2 \| `Roadmap And Milestone` \| `blueprint-roadmap-admin` \| `implemented`/);
  assert.match(catalog, /`new-milestone` \| 2 \| `Roadmap And Milestone` \| `blueprint-roadmap-admin` \| `implemented`/);
  assert.match(catalog, /`do` \| 3 \| `Capture And Lightweight Execution` \| `blueprint-router` \| `planned`/);
  assert.match(catalog, /`pause-work` \| 1 \| `Core Lifecycle` \| `blueprint-governance` \| `implemented`/);
  assert.match(catalog, /`resume-work` \| 1 \| `Core Lifecycle` \| `blueprint-governance` \| `implemented`/);
  assert.match(catalog, /`plan-milestone-gaps` \| 2 \| `Roadmap And Milestone` \| `blueprint-roadmap-admin` \| `implemented`/);
  assert.match(progress, /\| 1 \| `do` \| .* \| `planned` \| 3 \| `Capture And Lightweight Execution` \| Low \|/);
  assert.match(
    progress,
    /docs keep its control-plane status at `planned`, while the live runtime remains `repairing` until the dedicated manifest lands/i
  );
  assert.match(readme, /## Commands Not Public Yet/);
  assert.match(readme, /\/blu-do/);
  assert.match(
    readme,
    /control-plane docs keep it `planned`, but the live runtime keeps it non-routable until the dedicated manifest is shipped/i
  );
  assert.match(
    readme,
    /The active implementation lives in the repo runtime surfaces below\. This list is representative rather than exhaustive:/i
  );
  assert.match(readme, /\/blu-workstreams/);
  assert.match(readme, /\/blu-update/);
  assert.doesNotMatch(readme, /## Commands Not Public Yet[\s\S]*\/blu-workstreams/);
  assert.doesNotMatch(readme, /## Commands Not Public Yet[\s\S]*\/blu-update/);
  assert.match(catalog, /STRUCTURE\.md/);
  assert.match(artifactSchema, /`STRUCTURE\.md`/);
  assert.match(artifactSchema, /`reports\/milestone-complete-<version>\.md`/);
  assert.match(artifactSchema, /`reports\/milestone-summary-<version>\.md`/);
  assert.match(artifactSchema, /`reports\/pause-work-latest\.md`/);
  assert.match(skills, /`blueprint-router` .* `next`, `do`/);
  assert.match(skills, /`blueprint-governance` .* `pause-work`, `resume-work`/);
  assert.match(skills, /`blueprint-roadmap-admin` .* `insert-phase`/);
  assert.match(skills, /`blueprint-roadmap-admin` .* `plan-milestone-gaps`/);
  assert.match(skills, /`blueprint-roadmap-admin` .* `audit-milestone`/);
  assert.match(skills, /`blueprint-roadmap-admin` .* `complete-milestone`/);
  assert.match(skills, /`blueprint-roadmap-admin` .* `milestone-summary`/);
  assert.match(skills, /`blueprint-roadmap-admin` .* `new-milestone`/);
  assert.match(skills, /`blueprint-phase-execution` .* `execute-phase`, `quick`, `fast`/);
  assert.match(drift, /`implemented`: manifest, primary skill, and required MCP tools are all present/);
  assert.match(
    agents,
    /Control-plane docs such as `docs\/COMMAND-CATALOG\.md`, `PROGRESS\.md`, and[\s\S]*command specs record the declared status/i
  );
  assert.match(
    agents,
    /`new-workspace`, `remove-workspace`, `workstreams`, `update`, `cleanup`, and `reapply-patches`/
  );
  assert.match(
    agents,
    /`\/blu-new-workspace`, `\/blu-remove-workspace`, `\/blu-workstreams`, `\/blu-update`, `\/blu-cleanup`, and `\/blu-reapply-patches`/
  );
  assert.match(
    drift,
    /A future command can therefore stay declared `planned` in docs while the[\s\S]*runtime remains `repairing` or `blocked`/i
  );
  assert.match(
    bluCommand,
    /If the user asks for a blocked command, explain the missing substrate using `status` and `blockedBy`\./
  );
  assert.match(
    bluHelp,
    /Explain blocked commands as blocked; do not present them as runnable\./
  );
  assert.match(
    drift,
    /Control-plane docs may keep a future command declared `planned` while `blueprint_command_catalog` still derives a non-routable runtime status such as `repairing` or `blocked`/i
  );
});

test("runtime docs keep .planning and hook control out of Blueprint runtime ownership", async () => {
  const [agents, memory, artifactSchema, hooks, mcpTools] = await Promise.all([
    readRepoFile("AGENTS.md"),
    readRepoFile("MEMORY.md"),
    readRepoFile("docs/ARTIFACT-SCHEMA.md"),
    readRepoFile("docs/HOOKS-POLICIES.md"),
    readRepoFile("docs/MCP-TOOLS.md")
  ]);

  assert.match(agents, /it is not Blueprint runtime state/);
  assert.match(memory, /implementation bookkeeping for the Blueprint build-out/);
  assert.match(artifactSchema, /repo-level `hooks\.\*` keys/);
  assert.match(hooks, /Repo config must not enable or disable hooks/);
  assert.match(mcpTools, /Tools must not write into the installed extension directory/);
});
