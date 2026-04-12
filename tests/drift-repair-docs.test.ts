import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("control-plane docs describe the shipped Phase 3 runtime, Phase 4 execution shipment, and active closeout state", async () => {
  const [agents, readme, gemini, handoff, memory, drift, migration, hooks] =
    await Promise.all([
      readRepoFile("AGENTS.md"),
      readRepoFile("README.md"),
      readRepoFile("GEMINI.md"),
      readRepoFile("docs/HANDOFF.md"),
      readRepoFile("MEMORY.md"),
      readRepoFile("docs/DRIFT.MD"),
      readRepoFile("docs/GSD-RUNTIME-MIGRATION.md"),
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
  assert.match(readme, /Phase 3 discovery commands are also shipped/);
  assert.match(readme, /Phase 3 discovery shipped the same day and remains in parity closeout/i);
  assert.match(readme, /Phase 4 execution now ships through `\/blu:execute-phase`/i);
  assert.match(gemini, /Phase 3 discovery is now the next implementation slice|Phase 4/);
  assert.match(gemini, /\/blu:execute-phase/);
  assert.match(gemini, /\/blu:map-codebase/);
  assert.match(handoff, /Phase 2\.1 drift recovery and Phase 2\.2 future-contract drift repair both completed on 2026-04-11/i);
  assert.match(handoff, /Phase 3 discovery shipped the same day and remains in parity closeout/i);
  assert.match(
    memory,
    /Current milestone: Phase 3 discovery parity closeout .* Phase 4 validation rollout is next|Current milestone: Phase 4 validation rollout is underway/i
  );
  assert.match(drift, /Checkpoint: Phase 2\.2 future-contract drift repair/);
  assert.match(drift, /State: closed on 2026-04-11/);
  assert.match(drift, /repairs discovery parity gaps/i);
  assert.match(migration, /Phase 3 discovery shipped on 2026-04-11 and remains in parity closeout/i);
  assert.match(migration, /`execute-phase` is now implemented in Blueprint on top of the plan and summary MCP substrates/);
  assert.doesNotMatch(hooks, /No hook code ships/);
  assert.match(hooks, /Blueprint now ships three advisory hooks/);
});

test("drift-repair docs capture the status vocabulary and the repaired future-command ownership metadata", async () => {
  const [catalog, artifactSchema, drift, skills] = await Promise.all([
    readRepoFile("docs/COMMAND-CATALOG.md"),
    readRepoFile("docs/ARTIFACT-SCHEMA.md"),
    readRepoFile("docs/DRIFT.MD"),
    readRepoFile("docs/SKILLS-AND-AGENTS.md")
  ]);

  assert.match(catalog, /\| Command \| Wave \| Family \| Primary Skill \| Status \| Key Writes \| Risk \|/);
  assert.match(catalog, /`map-codebase` \| 0 \| `Foundation` \| `blueprint-map` \| `implemented`/);
  assert.match(catalog, /`next` \| 1 \| `Core Lifecycle` \| `blueprint-router` \| `implemented`/);
  assert.match(catalog, /`execute-phase` \| 1 \| `Core Lifecycle` \| `blueprint-phase-execution` \| `implemented`/);
  assert.match(catalog, /`audit-milestone` \| 2 \| `Roadmap And Milestone` \| `blueprint-roadmap-admin` \| `implemented`/);
  assert.match(catalog, /`do` \| 3 \| `Capture And Lightweight Execution` \| `blueprint-router` \| `blocked`/);
  assert.match(catalog, /`pause-work` \| 1 \| `Core Lifecycle` \| `blueprint-governance` \| `implemented`/);
  assert.match(catalog, /`resume-work` \| 1 \| `Core Lifecycle` \| `blueprint-governance` \| `implemented`/);
  assert.match(catalog, /`plan-milestone-gaps` \| 2 \| `Roadmap And Milestone` \| `blueprint-roadmap-admin` \| `planned`/);
  assert.match(catalog, /STRUCTURE\.md/);
  assert.match(artifactSchema, /`STRUCTURE\.md`/);
  assert.match(artifactSchema, /`reports\/pause-work-latest\.md`/);
  assert.match(skills, /`blueprint-router` .* `next`, `do`/);
  assert.match(skills, /`blueprint-governance` .* `pause-work`, `resume-work`/);
  assert.match(skills, /`blueprint-roadmap-admin` .* `plan-milestone-gaps`/);
  assert.match(skills, /`blueprint-roadmap-admin` .* `audit-milestone`/);
  assert.match(skills, /`blueprint-phase-execution` .* `execute-phase`, `quick`, `fast`/);
  assert.match(drift, /`implemented`: manifest, primary skill, and required MCP tools are all present/);
  assert.match(drift, /`DRIFT-01` through `DRIFT-07`/);
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
  assert.match(memory, /implementation bookkeeping for the GSD build-out/);
  assert.match(artifactSchema, /repo-level `hooks\.\*` keys/);
  assert.match(hooks, /Repo config must not enable or disable hooks/);
  assert.match(mcpTools, /Tools must not write into the installed extension directory/);
});
