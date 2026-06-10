import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import {
  NEXT_RUNTIME_METADATA,
  SHIP_RUNTIME_METADATA,
  VERIFY_WORK_RUNTIME_METADATA,
  MAP_CODEBASE_RUNTIME_METADATA,
  SECURE_PHASE_RUNTIME_METADATA,
  SPEC_PHASE_RUNTIME_METADATA,
  listRuntimeOwnedCommandMetadata
} from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import {
  buildGeneratedCommandSurfaces,
  renderUpdatedPrompt,
  renderUpdatedReadme,
  renderUpdatedRuntimeReference
} from "../scripts/generate-command-registry.js";

const repoRoot = process.cwd();

const REPRESENTATIVE_COMMANDS = [
  "new-project",
  "help",
  "map-codebase",
  "spec-phase",
  "plan-phase",
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

test("generated command registry keeps public command docs and help surfaces in sync", async () => {
  const surfaces = await buildGeneratedCommandSurfaces();
  const [
    generatedCatalog,
    commandCatalogDoc,
    readme,
    rootRouter,
    helpCommand,
    runtimeReference
  ] = await Promise.all([
    readFile(path.join(repoRoot, "generated/command-catalog.json"), "utf8"),
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    readFile(path.join(repoRoot, "README.md"), "utf8"),
    readFile(path.join(repoRoot, "commands/blu.toml"), "utf8"),
    readFile(path.join(repoRoot, "commands/blu-help.toml"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.equal(generatedCatalog, surfaces.registryJson);
  assert.equal(commandCatalogDoc, surfaces.commandCatalogMarkdown);
  assert.equal(readme, await renderUpdatedReadme(readme, surfaces));
  assert.equal(
    rootRouter,
    await renderUpdatedPrompt(rootRouter, surfaces, "Blueprint rules:\n")
  );
  assert.equal(
    helpCommand,
    await renderUpdatedPrompt(helpCommand, surfaces, "Execution profile: router.\n")
  );
  assert.equal(
    runtimeReference,
    await renderUpdatedRuntimeReference(runtimeReference, surfaces)
  );

  const chooserText = [
    surfaces.readmeChooserBlock,
    surfaces.promptChooserBlock
  ].join("\n");

  for (const chooserEntry of surfaces.registry.intentChooser) {
    for (const route of chooserEntry.routes) {
      const commandName = route
        .replace(/^\/blu-/, "")
        .replace(/\s+<[^>]+>$/u, "");
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

test("code-review and secure-phase runtime contracts lock the Wave 4 config-gated routing semantics", async () => {
  const [codeReview, securePhase, settingsDoc] = await Promise.all([
    buildBlueprintCommandRuntimeContractResource("code-review"),
    buildBlueprintCommandRuntimeContractResource("secure-phase"),
    readFile(path.join(repoRoot, "docs/commands/settings.md"), "utf8")
  ]);

  assert.match(
    codeReview.runtimeReference?.contractNotes ?? "",
    /workflow\.code_review=false/i
  );
  assert.match(
    codeReview.runtimeReference?.contractNotes ?? "",
    /must never make \/blu-secure-phase <phase> mandatory/i
  );
  assert.match(
    codeReview.runtimeReference?.contractNotes ?? "",
    /workflow\.secure_phase=true/i
  );
  assert.match(
    codeReview.runtimeReference?.contractNotes ?? "",
    /security is still missing/i
  );
  assert.match(
    codeReview.runtimeReference?.contractNotes ?? "",
    /\/blu-secure-phase <phase>/i
  );
  assert.match(
    codeReview.runtimeReference?.contractNotes ?? "",
    /workflow\.secure_phase=false/i
  );
  assert.match(
    codeReview.runtimeReference?.contractNotes ?? "",
    /code-review-fix/i
  );
  assert.match(
    codeReview.runtimeReference?.contractNotes ?? "",
    /\/blu-secure-phase remains manually runnable even when config-gated routing prefers another implemented next step\./i
  );
  assert.equal(securePhase.catalog.command, "/blu-secure-phase");
  assert.equal(securePhase.catalog.implemented, true);
  assert.equal(securePhase.catalog.status, "implemented");
  assert.match(
    settingsDoc,
    /required workflow-routing and lifecycle-gate step only when `workflow\.code_review` is `true`/i
  );
});

test("runtime reference rows mirror secure-phase workflow routing metadata", async () => {
  const runtimeReference = await readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8");

  const expectedRows = [
    {
      command: "next",
      metadata: NEXT_RUNTIME_METADATA,
      required: [
        /blueprint_project_status/,
        /blueprint_config_get/,
        /blueprint_state_load/,
        /blueprint_artifact_list/,
        /blueprint_command_catalog/,
        /workflow\.code_review=false[\s\S]*never make `?\/blu-secure-phase <phase>`? mandatory/i,
        /workflow\.code_review=true[\s\S]*workflow\.secure_phase=false[\s\S]*do not require secure-phase/i,
        /workflow\.code_review=true[\s\S]*workflow\.secure_phase=true[\s\S]*\/blu-code-review <phase>[\s\S]*\/blu-secure-phase <phase>/i
      ]
    },
    {
      command: "verify-work",
      metadata: VERIFY_WORK_RUNTIME_METADATA,
      required: [
        /workflow\.code_review=false[\s\S]*secure-phase is never mandatory/i,
        /workflow\.code_review=true[\s\S]*workflow\.secure_phase=false[\s\S]*not secure-phase/i,
        /workflow\.code_review=true[\s\S]*workflow\.secure_phase=true[\s\S]*code-review first[\s\S]*secure-phase after review exists/i,
        /\/blu-secure-phase`? remains manually runnable and implemented/i
      ]
    },
    {
      command: "secure-phase",
      metadata: SECURE_PHASE_RUNTIME_METADATA,
      required: [
        /src\/mcp\/command-runtime-metadata\.ts#secure-phase/,
        /bounded threat verification/i,
        /manually runnable and implemented/i,
        /workflow\.secure_phase`? defaults false/i,
        /workflow\.code_review=false[\s\S]*secure-phase is never mandatory/i
      ]
    },
    {
      command: "ship",
      metadata: SHIP_RUNTIME_METADATA,
      required: [
        /workflow\.secure_phase`? defaults false/i,
        /workflow\.code_review=false`?[\s\S]*security evidence is never mandatory/i,
        /workflow\.code_review=true`?[\s\S]*workflow\.secure_phase=false`?[\s\S]*review evidence may be mandatory while security evidence is not/i,
        /workflow\.code_review=true`?[\s\S]*workflow\.secure_phase=true`?[\s\S]*code-review evidence first/i,
        /\/blu-secure-phase`? remains manually runnable and implemented/i,
        /runtime-owned/
      ]
    }
  ];

  for (const { command, metadata, required } of expectedRows) {
    const row = runtimeReference
      .split("\n")
      .find((line) => line.startsWith(`| \`${command}\``));

    assert.ok(row, `Missing runtime reference row for ${command}`);
    const cells = row
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const hookCell = cells[5]?.replace(/`/g, "");
    const expectedHooks = metadata.runtimeReference.hookInvolvement.length > 0
      ? metadata.runtimeReference.hookInvolvement.join("; ")
      : "none";

    assert.match(row, new RegExp(metadata.sourceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(hookCell, expectedHooks, `${command} hook involvement should match metadata`);

    for (const tool of metadata.requiredTools) {
      assert.match(row, new RegExp(tool));
    }

    for (const pattern of required) {
      assert.match(row, pattern);
    }

    for (const state of metadata.runtimeReference.evidenceState) {
      assert.match(row, new RegExp(state));
    }
  }
});
