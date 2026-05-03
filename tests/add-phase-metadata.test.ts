import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { ADD_PHASE_RUNTIME_METADATA } from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

test("add-phase manifest uses runtime skill and MCP identities for roadmap append flow", async () => {
  const commandFile = await fs.readFile(
    path.join(repoRoot, "commands/blu-add-phase.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-roadmap-admin` skill/);
  assert.match(
    commandFile,
    /skills\/blueprint-roadmap-admin\/references\/add-phase-runtime-contract\.md/
  );
  assert.doesNotMatch(commandFile, /skills\/blueprint-roadmap-admin\.md/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_add_phase/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_scaffold/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /exact next integer phase number/i);
  assert.match(commandFile, /preview that computed phase number together with the description/i);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /expectedPhaseNumber/);
  assert.match(commandFile, /do not mutate anything until the computed next phase number has been previewed and confirmed through `ask_user`/i);
  assert.match(commandFile, /phase-number-confirmation/);
  assert.match(commandFile, /stale-phase-number/);
  assert.match(commandFile, /Do not use Gemini CLI's `update_topic`, `write_todos`, or task tracker tools/);
  assert.match(commandFile, /if the tool rejects because the live next phase changed/i);
  assert.match(commandFile, /\/blu-discuss-phase <phase>/);
});

test("add-phase runtime-owned metadata and skill inputs are docless at runtime", async () => {
  const [skillFile, addPhaseContract, catalog, contract] = await Promise.all([
    fs.readFile(path.join(repoRoot, "skills/blueprint-roadmap-admin/SKILL.md"), "utf8"),
    fs.readFile(
      path.join(
        repoRoot,
        "skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md"
      ),
      "utf8"
    ),
    blueprintCommandCatalog(),
    buildBlueprintCommandRuntimeContractResource("add-phase"),
  ]);
  const entry = catalog.commands["add-phase"];

  assert.deepEqual(ADD_PHASE_RUNTIME_METADATA.requiredInputPaths, [
    "skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md"
  ]);
  assert.equal(entry.specPath, "src/mcp/command-runtime-metadata.ts#add-phase");
  assert.equal(contract.spec?.path, "src/mcp/command-runtime-metadata.ts#add-phase");
  assert.equal(contract.runtimeReference?.path, "src/mcp/command-runtime-metadata.ts#add-phase");
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    "src/mcp/command-runtime-metadata.ts#add-phase"
  );
  assert.equal(contract.spec?.wave, 2);
  assert.equal(contract.spec?.family, "Roadmap And Milestone");
  assert.equal(contract.spec?.executionProfile, "interactive-read");
  assert.equal(contract.spec?.rootRoutable, true);
  assert.equal(contract.spec?.primarySkill, "blueprint-roadmap-admin");
  assert.deepEqual(contract.spec?.requiredTools, [
    "blueprint_roadmap_read",
    "blueprint_roadmap_add_phase",
    "blueprint_artifact_scaffold",
    "blueprint_state_update"
  ]);
  assert.deepEqual(contract.spec?.optionalSubagents, []);
  assert.match(contract.spec?.purpose ?? "", /Append a new whole-number phase/i);
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /add-phase-runtime-contract\.md[\s\S]*expectedPhaseNumber[\s\S]*\$\{phaseDir\}\/\$\{phasePrefix\}-CONTEXT\.md/
  );
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md"
  ]);
  assert.deepEqual(contract.skillInputs.effective, [
    "skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.match(
    skillFile,
    /Execution profile for `\/blu-add-phase`, `\/blu-insert-phase`, `\/blu-remove-phase`, `\/blu-plan-milestone-gaps`, `\/blu-audit-milestone`, `\/blu-complete-milestone`, `\/blu-milestone-summary`, and `\/blu-new-milestone`: `interactive-read`/
  );
  assert.match(skillFile, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
  assert.match(skillFile, /add-phase-runtime-contract\.md/);
  assert.doesNotMatch(skillFile, /- `docs\/commands\/add-phase\.md`/);
  assert.match(
    skillFile,
    /Roadmap-admin commands resolve active inputs from the structured `input_bundles` frontmatter/
  );
  assert.match(skillFile, /\$\{phaseDir\}\/\$\{phasePrefix\}-CONTEXT\.md/);
  assert.match(skillFile, /There is no add-phase subagent path/i);
  assert.match(skillFile, /browser, web-search-only, shell-only, or generic agents are not substitutes/i);
  assert.match(addPhaseContract, /## Stage Mapping/);
  assert.match(addPhaseContract, /Resolve[\s\S]*Read[\s\S]*Decide[\s\S]*Execute[\s\S]*Persist[\s\S]*Validate[\s\S]*Route/);
  assert.match(addPhaseContract, /next integer after the highest base phase number/i);
  assert.match(addPhaseContract, /Decimal suffixes are ignored/i);
  assert.match(addPhaseContract, /expectedPhaseNumber/);
  assert.match(addPhaseContract, /\$\{phaseDir\}\/\$\{phasePrefix\}-CONTEXT\.md/);
  assert.match(addPhaseContract, /Scaffold text is starter material only/i);
  assert.match(addPhaseContract, /Do not use browser, web-search-only, shell-only, or generic agents/i);
  assert.match(addPhaseContract, /\/blu-discuss-phase <phase>/);
});

test("add-phase remains implemented from runtime-owned metadata when docs are unavailable", async (t) => {
  const realReadFile = fs.readFile.bind(fs);

  t.mock.method(fs, "readFile", async (filePath, options) => {
    const normalizedPath =
      filePath instanceof URL ? filePath.pathname : path.resolve(String(filePath));

    if (
      normalizedPath.endsWith("/docs/COMMAND-CATALOG.md") ||
      normalizedPath.endsWith("/docs/RUNTIME-REFERENCE.md") ||
      normalizedPath.endsWith("/docs/commands/add-phase.md")
    ) {
      const error = new Error("simulated docs absence") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }

    return realReadFile(
      filePath as Parameters<typeof fs.readFile>[0],
      options as Parameters<typeof fs.readFile>[1]
    );
  });

  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["add-phase"];
  const contract = await buildBlueprintCommandRuntimeContractResource("add-phase");

  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.specPath, "src/mcp/command-runtime-metadata.ts#add-phase");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_roadmap_read",
    "blueprint_roadmap_add_phase",
    "blueprint_artifact_scaffold",
    "blueprint_state_update"
  ]);
  assert.equal(contract.spec?.path, "src/mcp/command-runtime-metadata.ts#add-phase");
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    "src/mcp/command-runtime-metadata.ts#add-phase"
  );
  assert.deepEqual(contract.skillInputs.effective, [
    "skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md"
  ]);
});

test("add-phase is not implemented when its local runtime contract is missing", async (t) => {
  const runtimeContractPath = ADD_PHASE_RUNTIME_METADATA.requiredInputPaths?.[0];
  const originalAccess = fs.access;

  assert.ok(runtimeContractPath);

  fs.access = (async (...args: Parameters<typeof fs.access>) => {
    const normalizedPath =
      args[0] instanceof URL ? args[0].pathname : path.resolve(String(args[0]));

    if (normalizedPath.endsWith(runtimeContractPath)) {
      const error = new Error("ENOENT");
      (error as NodeJS.ErrnoException).code = "ENOENT";
      throw error;
    }

    return originalAccess(...args);
  }) as typeof fs.access;
  t.after(() => {
    fs.access = originalAccess;
  });

  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["add-phase"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "repairing");
  assert.equal(entry.implemented, false);
  assert.equal(entry.specPath, null);
  assert.match(
    entry.blockedBy.join("\n"),
    /Missing runtime input: skills\/blueprint-roadmap-admin\/references\/add-phase-runtime-contract\.md/
  );
});
