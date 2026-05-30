import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { SECURE_PHASE_RUNTIME_METADATA } from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("security runtime source, hooks, and memory describe the shared hardening model", async () => {
  const [securitySource, writeGuardHook, readBeforeEditHook, maintenanceSkill, memory] =
    await Promise.all([
      readRepoFile("src/shared/security.ts"),
      readRepoFile("src/hooks/blueprint-write-guard.ts"),
      readRepoFile("src/hooks/read-before-edit.ts"),
      readRepoFile("skills/blueprint-maintenance/SKILL.md"),
      readRepoFile("MEMORY.md")
    ]);

  assert.match(securitySource, /ensurePathWithinRootSync/);
  assert.match(securitySource, /safeJsonParseObject/);
  assert.match(securitySource, /prompt-injection/);
  assert.match(securitySource, /unsafe-display/);
  assert.match(writeGuardHook, /analyzePromptBoundaryText/);
  assert.match(
    writeGuardHook,
    /prompt injection, hidden control text, or instruction override text/i
  );
  assert.match(readBeforeEditHook, /read the file before editing it so the existing content stays intact/i);
  assert.match(maintenanceSkill, /Shared rule for all maintenance flows/);
  assert.match(memory, /shared runtime hardening now lives under `src\/shared\/security\.ts`/i);
});

test("maintenance and security runtime assets reflect the tightened hardening guidance", async () => {
  const [maintenanceSkill, reviewSkill, securePhaseManifest, shipReference, cleanupReference] =
    await Promise.all([
      readRepoFile("skills/blueprint-maintenance/SKILL.md"),
      readRepoFile("skills/blueprint-review/SKILL.md"),
      readRepoFile("commands/blu-secure-phase.toml"),
      readRepoFile("skills/blueprint-maintenance/references/ship-runtime-contract.md"),
      readRepoFile("skills/blueprint-maintenance/references/cleanup-runtime-contract.md")
    ]);

  assert.match(maintenanceSkill, /Shared rule for all maintenance flows/);
  assert.match(maintenanceSkill, /resolved target/i);
  assert.match(
    reviewSkill,
    /confirmed mitigations, open threats, accepted risks/i
  );
  assert.match(
    reviewSkill,
    /Repo-wide derived progress\/state may still surface saved[\s\S]*`\/blu-code-review-fix <phase>` after[\s\S]*`\/blu-secure-phase` itself must not emit that action\./
  );
  assert.equal(SECURE_PHASE_RUNTIME_METADATA.sourceId, "src/mcp/command-runtime-metadata.ts#secure-phase");
  assert.match(securePhaseManifest, /parse the saved phase threat model/i);
  assert.match(securePhaseManifest, /build the bounded threat register/i);
  assert.match(securePhaseManifest, /`ask_user`/i);
  assert.match(securePhaseManifest, /verify those threats or explicitly accept them/i);
  assert.match(
    securePhaseManifest,
    /Repo-wide derived progress\/state may still surface saved[\s\S]*`\/blu-code-review-fix <phase>` after[\s\S]*`\/blu-secure-phase` itself must not emit that action\./
  );
  assert.match(securePhaseManifest, /threat-register coverage/i);
  assert.match(securePhaseManifest, /do not emit next-step routing when any threat remains open/i);
  assert.match(shipReference, /source branch, base branch/i);
  assert.match(shipReference, /Persist the approved plan before remote mutation/i);
  assert.match(cleanupReference, /protected exclusions/i);
  assert.match(cleanupReference, /archive destination/i);
});
