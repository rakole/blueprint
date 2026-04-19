import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("security planning docs describe the shared MCP-first hardening model", async () => {
  const [research, decisions, architecture, mcpTools, hooks, implementationOrder, memory] =
    await Promise.all([
      readRepoFile("docs/research/bring-security-to-blueprint.md"),
      readRepoFile("docs/DECISIONS.md"),
      readRepoFile("docs/ARCHITECTURE.md"),
      readRepoFile("docs/MCP-TOOLS.md"),
      readRepoFile("docs/HOOKS-POLICIES.md"),
      readRepoFile("docs/IMPLEMENTATION-ORDER.md"),
      readRepoFile("MEMORY.md")
    ]);

  assert.match(research, /active implementation roadmap/i);
  assert.match(research, /src\/shared\/security\.ts/);
  assert.doesNotMatch(research, /that command is still `planned`|that command is still planned/i);
  assert.match(decisions, /`BP-030` Shared security boundary/);
  assert.match(decisions, /`BP-033` Maintenance integrity preflights/);
  assert.match(architecture, /shared security layer/i);
  assert.match(mcpTools, /absolute-path misuse.*symlink escapes/i);
  assert.match(hooks, /shared prompt-boundary detectors/i);
  assert.match(implementationOrder, /## Security Hardening Overlay/);
  assert.match(memory, /shared runtime hardening now lives under `src\/shared\/security\.ts`/i);
});

test("maintenance and security review docs reflect the tightened hardening guidance", async () => {
  const [maintenanceSkill, reviewSkill, securePhaseDoc, shipDoc, cleanupDoc] =
    await Promise.all([
      readRepoFile("skills/blueprint-maintenance/SKILL.md"),
      readRepoFile("skills/blueprint-review/SKILL.md"),
      readRepoFile("docs/commands/secure-phase.md"),
      readRepoFile("docs/commands/ship.md"),
      readRepoFile("docs/commands/cleanup.md")
    ]);

  assert.match(maintenanceSkill, /Shared rule for all maintenance flows/);
  assert.match(maintenanceSkill, /resolved target/i);
  assert.match(
    reviewSkill,
    /confirmed mitigations, open threats, accepted risks/i
  );
  assert.match(securePhaseDoc, /parses? the saved phase threat model/i);
  assert.match(securePhaseDoc, /builds? a threat register/i);
  assert.match(securePhaseDoc, /verify open threats or explicitly accept them/i);
  assert.match(securePhaseDoc, /blocks? advancement while any threat remains open/i);
  assert.match(securePhaseDoc, /bounded to the declared threats and mitigations/i);
  assert.match(securePhaseDoc, /suspicious artifact content/i);
  assert.match(shipDoc, /resolved scope, source branch, base branch, and report-before-mutate path/i);
  assert.match(cleanupDoc, /resolved phase-directory set, protected exclusions, and final archive destination/i);
});
