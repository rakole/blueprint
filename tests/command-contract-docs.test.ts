import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import {
  CODE_REVIEW_RUNTIME_METADATA,
  MAP_CODEBASE_RUNTIME_METADATA,
  NEXT_RUNTIME_METADATA,
  SECURE_PHASE_RUNTIME_METADATA,
  SHIP_RUNTIME_METADATA,
  SPEC_PHASE_RUNTIME_METADATA,
  VERIFY_WORK_RUNTIME_METADATA,
  type RuntimeOwnedCommandMetadata,
  listRuntimeOwnedCommandMetadata
} from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import {
  buildGeneratedCommandSurfaces,
  renderUpdatedReadme
} from "../scripts/generate-command-registry.js";

const repoRoot = process.cwd();

const REPRESENTATIVE_COMMANDS = [
  "new-project",
  "help",
  "map-codebase",
  "spec-phase",
  "plan-phase",
  "run-plan",
  "impact",
  "docs-update",
  "pr-branch",
  "ship",
  "undo",
  "cleanup",
  "update"
] as const;

function isBundledControlPlaneDocPath(value: string): boolean {
  return /^docs\//.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertRuntimeReferenceParity(
  contract: Awaited<ReturnType<typeof buildBlueprintCommandRuntimeContractResource>>,
  metadata: RuntimeOwnedCommandMetadata
): void {
  assert.ok(contract.runtimeReference);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference.path, metadata.sourceId);
  assert.equal(contract.runtimeReference.commandSpecPath, metadata.sourceId);
  assert.equal(contract.runtimeReference.wave, metadata.catalog.wave);
  assert.equal(contract.runtimeReference.waveTitle, metadata.runtimeReference.waveTitle);
  assert.equal(contract.runtimeReference.command, metadata.commandName);
  assert.equal(contract.runtimeReference.primarySkill, metadata.runtimeReference.primarySkill);
  assert.deepEqual(
    contract.runtimeReference.exactMcpDestination,
    [...metadata.runtimeReference.exactMcpDestination]
  );
  assert.deepEqual(contract.runtimeReference.optionalAgents, [
    ...metadata.runtimeReference.optionalAgents
  ]);
  assert.deepEqual(contract.runtimeReference.hookInvolvement, [
    ...metadata.runtimeReference.hookInvolvement
  ]);
  assert.equal(contract.runtimeReference.contractNotes, metadata.runtimeReference.contractNotes);
  assert.deepEqual(contract.runtimeReference.evidenceState, [
    ...metadata.runtimeReference.evidenceState
  ]);
}

test("runtime-owned command metadata keeps command and runtime contract truth source-owned", () => {
  for (const metadata of listRuntimeOwnedCommandMetadata()) {
    assert.equal(metadata.spec.path, metadata.sourceId);
    assert.equal(metadata.runtimeReference.path, metadata.sourceId);
    assert.equal(isBundledControlPlaneDocPath(metadata.spec.path), false);
    assert.equal(isBundledControlPlaneDocPath(metadata.runtimeReference.path), false);
    assert.equal(
      (metadata.requiredInputPaths ?? []).some((input) => isBundledControlPlaneDocPath(input)),
      false
    );
  }
});

test("runtime contract resources stay docs-free when command runtime docs throw during lookup", async () => {
  for (const commandName of REPRESENTATIVE_COMMANDS) {
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName, {
      readRelativePath: async (relativePath) => {
        if (isBundledControlPlaneDocPath(relativePath)) {
          throw new Error(`simulated docs failure: ${relativePath}`);
        }

        return readFile(path.join(repoRoot, relativePath), "utf8");
      }
    });

    assert.equal(contract.command, commandName);
    assert.equal(contract.catalog.command, `/blu-${commandName}`);
    assert.equal(contract.catalog.implemented, true);
    assert.equal(contract.catalog.status, "implemented");
    assert.ok(contract.catalog.specPath);
    assert.ok(contract.spec?.path);
    assert.ok(contract.runtimeReference?.path);
    assert.equal(isBundledControlPlaneDocPath(contract.catalog.specPath), false);
    assert.equal(isBundledControlPlaneDocPath(contract.spec.path), false);
    assert.equal(isBundledControlPlaneDocPath(contract.runtimeReference.path), false);
    assert.equal(
      contract.skillInputs.effective.some((input) => isBundledControlPlaneDocPath(input)),
      false
    );
  }
});

test("runtime catalog exposes source-owned spec paths for metadata-backed commands", async () => {
  const catalog = await blueprintCommandCatalog();

  assert.equal(catalog.commands["map-codebase"].specPath, MAP_CODEBASE_RUNTIME_METADATA.sourceId);
  assert.equal(catalog.commands["spec-phase"].specPath, SPEC_PHASE_RUNTIME_METADATA.sourceId);
  assert.equal(
    isBundledControlPlaneDocPath(catalog.commands["map-codebase"].specPath ?? ""),
    false
  );
  assert.equal(
    isBundledControlPlaneDocPath(catalog.commands["spec-phase"].specPath ?? ""),
    false
  );
});

test("runtime resources keep command-specific inputs anchored to manifests and skill references", async () => {
  const [planPhase, impact, docsUpdate, codeReview, securePhase] = await Promise.all([
    buildBlueprintCommandRuntimeContractResource("plan-phase"),
    buildBlueprintCommandRuntimeContractResource("impact"),
    buildBlueprintCommandRuntimeContractResource("docs-update"),
    buildBlueprintCommandRuntimeContractResource("code-review"),
    buildBlueprintCommandRuntimeContractResource("secure-phase")
  ]);

  assert.deepEqual(planPhase.skillInputs.commandSpecific, [
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
  ]);
  assert.deepEqual(impact.skillInputs.commandSpecific, [
    "commands/blu-impact.toml",
    "skills/blueprint-impact/references/impact-runtime-contract.md"
  ]);
  assert.deepEqual(docsUpdate.skillInputs.commandSpecific, [
    "commands/blu-docs-update.toml",
    "skills/blueprint-docs/references/docs-update-runtime-contract.md"
  ]);
  assert.deepEqual(codeReview.skillInputs.commandSpecific, [
    "commands/blu-code-review.toml",
    "skills/blueprint-review/references/code-review-runtime-contract.md"
  ]);
  assert.deepEqual(securePhase.skillInputs.commandSpecific, [
    "commands/blu-secure-phase.toml",
    "skills/blueprint-review/references/secure-phase-runtime-contract.md"
  ]);
});

test("runtime-owned routing metadata preserves config-gated code-review and secure-phase behavior", async () => {
  const [verifyWork, codeReview, securePhase, ship, next] = await Promise.all([
    buildBlueprintCommandRuntimeContractResource("verify-work"),
    buildBlueprintCommandRuntimeContractResource("code-review"),
    buildBlueprintCommandRuntimeContractResource("secure-phase"),
    buildBlueprintCommandRuntimeContractResource("ship"),
    buildBlueprintCommandRuntimeContractResource("next")
  ]);

  assert.match(
    verifyWork.runtimeReference?.contractNotes ?? "",
    /workflow\.code_review=false means secure-phase is never mandatory regardless of workflow\.secure_phase/i
  );
  assert.match(
    verifyWork.runtimeReference?.contractNotes ?? "",
    /workflow\.code_review=true with workflow\.secure_phase=false can make mandatory code review the next gate but not secure-phase/i
  );
  assert.match(
    verifyWork.runtimeReference?.contractNotes ?? "",
    /workflow\.code_review=true with workflow\.secure_phase=true routes code-review first and only routes secure-phase after review exists/i
  );
  assert.match(
    verifyWork.runtimeReference?.contractNotes ?? "",
    /\/blu-secure-phase remains manually runnable and implemented/i
  );

  assert.match(
    codeReview.runtimeReference?.contractNotes ?? "",
    /workflow\.code_review=false, code-review routing must never make \/blu-secure-phase <phase> mandatory even if workflow\.secure_phase=true/i
  );
  assert.match(
    codeReview.runtimeReference?.contractNotes ?? "",
    /workflow\.code_review=true and workflow\.secure_phase=true and security is still missing, \/blu-secure-phase <phase> is the primary routed next action/i
  );
  assert.match(
    codeReview.runtimeReference?.contractNotes ?? "",
    /\/blu-secure-phase remains manually runnable even when config-gated routing prefers another implemented next step/i
  );

  assert.match(
    securePhase.runtimeReference?.contractNotes ?? "",
    /workflow\.secure_phase defaults false and controls mandatory routing, recommendations, and closeout gates only, not command existence/i
  );
  assert.match(
    securePhase.runtimeReference?.contractNotes ?? "",
    /If workflow\.code_review=false, secure-phase is never mandatory regardless of workflow\.secure_phase/i
  );
  assert.match(
    securePhase.runtimeReference?.contractNotes ?? "",
    /\/blu-secure-phase remains manually runnable and implemented/i
  );

  assert.match(
    ship.runtimeReference?.contractNotes ?? "",
    /workflow\.secure_phase defaults false; when workflow\.code_review=false, security evidence is never mandatory regardless of workflow\.secure_phase/i
  );
  assert.match(
    ship.runtimeReference?.contractNotes ?? "",
    /when workflow\.code_review=true and workflow\.secure_phase=false, review evidence may be mandatory while security evidence is not/i
  );
  assert.match(
    ship.runtimeReference?.contractNotes ?? "",
    /when workflow\.code_review=true and workflow\.secure_phase=true, require code-review evidence first and secure-phase or security evidence before ready shipping/i
  );
  assert.match(
    ship.runtimeReference?.contractNotes ?? "",
    /\/blu-secure-phase remains manually runnable and implemented/i
  );

  assert.match(
    next.runtimeReference?.contractNotes ?? "",
    /when workflow\.code_review=false, never make \/blu-secure-phase <phase> mandatory regardless of workflow\.secure_phase/i
  );
  assert.match(
    next.runtimeReference?.contractNotes ?? "",
    /when workflow\.code_review=true and workflow\.secure_phase=false, route to mandatory code review when review evidence is missing but do not require secure-phase/i
  );
  assert.match(
    next.runtimeReference?.contractNotes ?? "",
    /when workflow\.code_review=true and workflow\.secure_phase=true, route \/blu-code-review <phase> before \/blu-secure-phase <phase>/i
  );
});

test("runtime-owned runtime-reference rows stay aligned for next, verify-work, secure-phase, and ship", async () => {
  const [next, verifyWork, securePhase, ship] = await Promise.all([
    buildBlueprintCommandRuntimeContractResource("next"),
    buildBlueprintCommandRuntimeContractResource("verify-work"),
    buildBlueprintCommandRuntimeContractResource("secure-phase"),
    buildBlueprintCommandRuntimeContractResource("ship")
  ]);

  assertRuntimeReferenceParity(next, NEXT_RUNTIME_METADATA);
  assertRuntimeReferenceParity(verifyWork, VERIFY_WORK_RUNTIME_METADATA);
  assertRuntimeReferenceParity(securePhase, SECURE_PHASE_RUNTIME_METADATA);
  assertRuntimeReferenceParity(ship, SHIP_RUNTIME_METADATA);
  assert.equal(next.skillInputs.effective.some((input) => input.startsWith("docs/")), false);
  assert.equal(
    verifyWork.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.equal(
    securePhase.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.equal(ship.skillInputs.effective.some((input) => input.startsWith("docs/")), false);
});

test("generated command registry keeps README command surfaces in sync without repo-root docs", async () => {
  const surfaces = await buildGeneratedCommandSurfaces();
  const [generatedCatalog, readme] = await Promise.all([
    readFile(path.join(repoRoot, "generated/command-catalog.json"), "utf8"),
    readFile(path.join(repoRoot, "README.md"), "utf8")
  ]);

  assert.equal(generatedCatalog, surfaces.registryJson);
  assert.equal(readme, await renderUpdatedReadme(readme, surfaces));
  assert.doesNotMatch(surfaces.readmeWorkflowBlock, /docs\/COMMAND-CATALOG\.md/);
  assert.doesNotMatch(surfaces.readmeChooserBlock, /docs\/COMMAND-CATALOG\.md/);
  assert.doesNotMatch(surfaces.readmeRuntimeLayoutBlock, /docs\/RUNTIME-REFERENCE\.md/);
  assert.match(
    surfaces.readmeWorkflowBlock,
    /generated\/command-catalog\.json[\s\S]*\/blu-help/
  );

  const chooserText = surfaces.readmeChooserBlock;

  for (const chooserEntry of surfaces.registry.intentChooser) {
    for (const route of chooserEntry.routes) {
      const commandName = route
        .replace(/^\/blu-/, "")
        .replace(/(?:\s+<[^>]+>)+$/u, "");
      const command = surfaces.registry.commands.find((entry) => entry.name === commandName);

      assert.ok(command, `Generated chooser route should map to a command: ${route}`);
      assert.equal(command.implemented, true, `${route} must stay implemented`);
      assert.equal(command.runnable, true, `${route} must stay runnable`);
    }
  }

  for (const command of surfaces.registry.commands.filter((entry) => !entry.implemented)) {
    assert.doesNotMatch(
      chooserText,
      new RegExp(escapeRegExp(command.command)),
      `${command.command} must not appear in runnable chooser text`
    );
  }
});
