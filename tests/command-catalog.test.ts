import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { validateBundledBlueprintAgentDefinition } from "../src/mcp/agent-definition.js";
import {
  blueprintDirectCommand,
  blueprintDirectCommandAliases,
  blueprintPrimaryManifestPath,
  blueprintRouterCommand
} from "../src/mcp/command-paths.js";
import {
  buildBlueprintCommandRuntimeContractResource,
  listBlueprintCommandRuntimeContractCommands
} from "../src/mcp/command-resources.js";
import {
  CODE_REVIEW_RUNTIME_METADATA,
  CLEANUP_RUNTIME_METADATA,
  DEBUG_RUNTIME_METADATA,
  DOCS_UPDATE_RUNTIME_METADATA,
  IMPACT_RUNTIME_METADATA,
  getRuntimeOwnedCommandMetadata,
  HELP_RUNTIME_METADATA,
  listRuntimeOwnedCommandMetadata,
  MAP_CODEBASE_RUNTIME_METADATA,
  NEXT_RUNTIME_METADATA,
  NEW_PROJECT_RUNTIME_METADATA,
  NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID,
  NEW_WORKSPACE_RUNTIME_METADATA,
  PLAN_PHASE_RUNTIME_METADATA,
  PROGRESS_RUNTIME_METADATA,
  PR_BRANCH_RUNTIME_METADATA,
  REAPPLY_PATCHES_RUNTIME_METADATA,
  REMOVE_WORKSPACE_RUNTIME_METADATA,
  SHIP_RUNTIME_METADATA,
  UNDO_RUNTIME_METADATA,
  UPDATE_RUNTIME_METADATA,
  WORKSTREAMS_RUNTIME_METADATA
} from "../src/mcp/command-runtime-metadata.js";
import {
  blueprintCommandCatalog,
  blueprintRuntimeOwnedCommandCatalog
} from "../src/mcp/tools/project.js";
import {
  blueprintDiscoverableSkillPath,
  resolveBlueprintSkillPath
} from "../src/mcp/runtime-vocabulary.js";

const IMPLEMENTED_COMMANDS = [
  "new-project",
  "settings",
  "set-profile",
  "help",
  "progress",
  "health",
  "map-codebase",
  "discuss-phase",
  "research-phase",
  "ui-phase",
  "next",
  "add-phase",
  "note",
  "insert-phase",
  "add-todo",
  "check-todos",
  "add-backlog",
  "review-backlog",
  "explore",
  "review",
  "code-review",
  "code-review-fix",
  "audit-fix",
  "impact",
  "ui-review",
  "remove-phase",
  "plan-phase",
  "execute-phase",
  "fast",
  "quick",
  "debug",
  "validate-phase",
  "verify-work",
  "add-tests",
  "pause-work",
  "resume-work",
  "secure-phase",
  "plan-milestone-gaps",
  "audit-milestone",
  "complete-milestone",
  "milestone-summary",
  "new-milestone",
  "docs-update",
  "pr-branch",
  "ship",
  "undo",
  "new-workspace",
  "remove-workspace",
  "workstreams",
  "cleanup",
  "reapply-patches",
  "update"
] as const;

const PLANNED_COMMANDS = ["do"] as const;
const LIST_PHASE_ASSUMPTIONS_MANIFEST = "commands/blu-list-phase-assumptions.toml";
const CAPTURE_RUNTIME_METADATA_COMMANDS = [
  "note",
  "add-todo",
  "check-todos",
  "add-backlog",
  "review-backlog",
  "explore"
] as const;
const REVIEW_RUNTIME_METADATA_COMMANDS = [
  "code-review",
  "code-review-fix",
  "audit-fix",
  "secure-phase",
  "review",
  "ui-review"
] as const;
const MAINTENANCE_RUNTIME_METADATA = [
  PR_BRANCH_RUNTIME_METADATA,
  SHIP_RUNTIME_METADATA,
  UNDO_RUNTIME_METADATA,
  NEW_WORKSPACE_RUNTIME_METADATA,
  REMOVE_WORKSPACE_RUNTIME_METADATA,
  WORKSTREAMS_RUNTIME_METADATA,
  CLEANUP_RUNTIME_METADATA,
  UPDATE_RUNTIME_METADATA,
  REAPPLY_PATCHES_RUNTIME_METADATA
] as const;

async function pathExists(relativePath: string): Promise<boolean> {
  try {
    await access(relativePath);
    return true;
  } catch {
    return false;
  }
}

async function expectedDiscoverableSkillPath(skillName: string): Promise<string> {
  const resolution = await resolveBlueprintSkillPath(skillName, pathExists);

  assert.equal(
    resolution.resolution,
    "discoverable",
    `${skillName} should resolve through skills/${skillName}/SKILL.md`
  );
  assert.equal(resolution.resolvedPath, resolution.canonicalPath);

  return blueprintDiscoverableSkillPath(skillName);
}

async function readRelativePath(relativePath: string): Promise<string | null> {
  try {
    return await readFile(relativePath, "utf8");
  } catch {
    return null;
  }
}

function isBundledPath(value: unknown, relativePath: string): boolean {
  if (value instanceof URL) {
    return value.pathname.endsWith(`/${relativePath}`);
  }

  return typeof value === "string" && value.endsWith(relativePath);
}

function catalogDocsPath(value: unknown): string | null {
  const normalized =
    value instanceof URL ? value.pathname : path.resolve(String(value));
  const relativePath = path.relative(process.cwd(), normalized).split(path.sep).join("/");

  return relativePath === "docs/COMMAND-CATALOG.md" ||
    relativePath === "docs/RUNTIME-REFERENCE.md" ||
    relativePath.startsWith("docs/commands/")
    ? relativePath
    : null;
}

test("runtime command catalog marks shipped commands as implemented once manifest, skill, and tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const listPhaseAssumptionsManifestExists = await pathExists(
    LIST_PHASE_ASSUMPTIONS_MANIFEST
  );
  const implemented = Object.entries(catalog.commands)
    .filter(([, entry]) => entry.implemented)
    .map(([command]) => command)
    .sort();
  const expectedImplementedCommands = listPhaseAssumptionsManifestExists
    ? [...IMPLEMENTED_COMMANDS, "list-phase-assumptions"]
    : [...IMPLEMENTED_COMMANDS];

  assert.deepEqual(implemented, [...expectedImplementedCommands].sort());

  for (const command of expectedImplementedCommands) {
    const entry = catalog.commands[command];

    assert.equal(entry.command, blueprintDirectCommand(command));
    assert.equal(entry.route, blueprintRouterCommand(command));
    assert.equal(entry.status, "implemented");
    assert.equal(entry.declaredStatus, "implemented");
    assert.equal(entry.requiredToolsSatisfied, true);
    assert.ok(entry.manifestPath);
    assert.equal(entry.manifestPath, blueprintPrimaryManifestPath(command));
    assert.equal(entry.skillPath, await expectedDiscoverableSkillPath(entry.primarySkill));
    assert.ok(entry.specPath);
    assert.deepEqual(entry.blockedBy, []);
    assert.deepEqual(catalog.aliases[command], blueprintDirectCommandAliases(command));
  }

  assert.equal(catalog.commands["new-project"].specPath, NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID);
  assert.deepEqual(catalog.commands["new-project"].requiredTools, [
    ...NEW_PROJECT_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(catalog.commands["new-project"].optionalAgents, [
    ...NEW_PROJECT_RUNTIME_METADATA.optionalAgents
  ]);
  assert.equal(catalog.commands["new-project"].risk, NEW_PROJECT_RUNTIME_METADATA.catalog.risk);
  assert.equal(catalog.commands["map-codebase"].specPath, MAP_CODEBASE_RUNTIME_METADATA.sourceId);
  assert.deepEqual(catalog.commands["map-codebase"].requiredTools, [
    ...MAP_CODEBASE_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(catalog.commands["map-codebase"].optionalAgents, [
    ...MAP_CODEBASE_RUNTIME_METADATA.optionalAgents
  ]);
  assert.equal(catalog.commands["map-codebase"].risk, MAP_CODEBASE_RUNTIME_METADATA.catalog.risk);
  assert.equal(catalog.commands.help.specPath, HELP_RUNTIME_METADATA.sourceId);

  const listPhaseAssumptions = catalog.commands["list-phase-assumptions"];

  assert.equal(listPhaseAssumptions.primarySkill, "blueprint-phase-discovery");
  assert.equal(listPhaseAssumptions.requiredToolsSatisfied, true);
  assert.deepEqual(listPhaseAssumptions.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_roadmap_read",
    "blueprint_project_status",
    "blueprint_config_get"
  ]);
  assert.deepEqual(listPhaseAssumptions.availableOptionalAgents, [
    "blueprint-researcher"
  ]);

  if (listPhaseAssumptionsManifestExists) {
    assert.equal(listPhaseAssumptions.declaredStatus, "implemented");
    assert.equal(listPhaseAssumptions.status, "implemented");
    assert.equal(listPhaseAssumptions.implemented, true);
    assert.equal(
      listPhaseAssumptions.manifestPath,
      LIST_PHASE_ASSUMPTIONS_MANIFEST
    );
    assert.equal(
      listPhaseAssumptions.skillPath,
      await expectedDiscoverableSkillPath("blueprint-phase-discovery")
    );
    assert.equal(
      listPhaseAssumptions.specPath,
      "src/mcp/command-runtime-metadata.ts#list-phase-assumptions"
    );
    assert.deepEqual(listPhaseAssumptions.blockedBy, []);
  } else {
    assert.equal(listPhaseAssumptions.declaredStatus, "planned");
    assert.equal(listPhaseAssumptions.status, "planned");
    assert.equal(listPhaseAssumptions.implemented, false);
    assert.equal(listPhaseAssumptions.manifestPath, null);
    assert.equal(
      listPhaseAssumptions.skillPath,
      await expectedDiscoverableSkillPath("blueprint-phase-discovery")
    );
    assert.equal(
      listPhaseAssumptions.specPath,
      "src/mcp/command-runtime-metadata.ts#list-phase-assumptions"
    );
    assert.match(
      listPhaseAssumptions.blockedBy.join("\n"),
      /Missing command manifest: commands\/blu-list-phase-assumptions\.toml/
    );
  }
});

test("command runtime contract resource stays anchored to live catalog, command spec, and runtime reference truth", async () => {
  const catalog = await blueprintCommandCatalog();
  const advertisedCommands = await listBlueprintCommandRuntimeContractCommands();
  const expectedAdvertisedCommands = Object.entries(catalog.commands)
    .filter(
      ([commandName, entry]) =>
        entry.status === "implemented" &&
        entry.implemented === true
    )
    .map(([commandName]) => commandName)
    .sort();
  const contract = await buildBlueprintCommandRuntimeContractResource("help");
  const entry = catalog.commands.help;

  assert.deepEqual(advertisedCommands, expectedAdvertisedCommands);
  assert.ok(advertisedCommands.includes("help"));
  assert.ok(advertisedCommands.includes("impact"));
  assert.ok(advertisedCommands.includes("add-phase"));
  assert.ok(advertisedCommands.includes("review"));
  assert.ok(!advertisedCommands.includes("do"));

  for (const commandName of advertisedCommands) {
    const advertisedContract = await buildBlueprintCommandRuntimeContractResource(
      commandName
    );
    const advertisedEntry = catalog.commands[commandName];

    assert.equal(advertisedEntry.status, "implemented");
    assert.equal(advertisedEntry.implemented, true);
    assert.deepEqual(advertisedContract.catalog, advertisedEntry);
    assert.equal(advertisedContract.catalog.status, "implemented");
    assert.equal(advertisedContract.catalog.implemented, true);
    assert.ok(advertisedContract.spec);
    assert.equal(advertisedContract.spec.path, advertisedEntry.specPath);
    assert.ok(advertisedContract.runtimeReference);
    assert.equal(advertisedContract.runtimeReference.command, commandName);
    assert.equal(
      advertisedContract.runtimeReference.commandSpecPath,
      advertisedEntry.specPath
    );
  }

  assert.equal(contract.command, "help");
  assert.equal(contract.uri, "blueprint://commands/help/runtime-contract");
  assert.deepEqual(contract.catalog, entry);
  assert.equal(contract.catalog.status, "implemented");
  assert.equal(contract.catalog.implemented, true);

  assert.ok(contract.spec);
  assert.equal(contract.spec.path, HELP_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec.wave, 0);
  assert.equal(contract.spec.family, "Foundation");
  assert.equal(contract.spec.executionProfile, "router");
  assert.equal(contract.spec.rootRoutable, true);
  assert.equal(contract.spec.primarySkill, "blueprint-router");
  assert.deepEqual(contract.spec.requiredTools, entry.requiredTools);
  assert.deepEqual(contract.spec.optionalSubagents, []);
  assert.match(contract.spec.purpose ?? "", /safe Blueprint router guidance/i);
  assert.deepEqual(contract.spec.writes, []);
  assert.deepEqual(contract.skillInputs, {
    skill: "blueprint-router",
    shared: [],
    commandSpecific: ["commands/blu-help.toml"],
    effective: ["commands/blu-help.toml"]
  });
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );

  assert.ok(contract.runtimeReference);
  assert.equal(contract.runtimeReference.path, HELP_RUNTIME_METADATA.sourceId);
  assert.equal(contract.runtimeReference.wave, 0);
  assert.equal(contract.runtimeReference.waveTitle, "Foundation");
  assert.equal(contract.runtimeReference.command, "help");
  assert.equal(contract.runtimeReference.commandSpecPath, HELP_RUNTIME_METADATA.sourceId);
  assert.equal(contract.runtimeReference.primarySkill, "blueprint-router");
  assert.deepEqual(contract.runtimeReference.exactMcpDestination, entry.requiredTools);
  assert.deepEqual(contract.runtimeReference.optionalAgents, []);
  assert.deepEqual(contract.runtimeReference.hookInvolvement, []);
  assert.match(contract.runtimeReference.contractNotes ?? "", /never present planned or blocked commands as runnable/i);
  assert.deepEqual(contract.runtimeReference.evidenceState, [
    "locked",
    "source-owned",
    "needs-behavior-audit"
  ]);

  await assert.rejects(
    buildBlueprintCommandRuntimeContractResource("do"),
    /Blueprint runtime-contract resources are available only for implemented commands: do/
  );

  const addPhaseContract = await buildBlueprintCommandRuntimeContractResource("add-phase");

  assert.equal(addPhaseContract.spec?.path, "src/mcp/command-runtime-metadata.ts#add-phase");
  assert.equal(
    addPhaseContract.runtimeReference?.path,
    "src/mcp/command-runtime-metadata.ts#add-phase"
  );
  assert.equal(
    addPhaseContract.runtimeReference?.commandSpecPath,
    "src/mcp/command-runtime-metadata.ts#add-phase"
  );
  assert.deepEqual(addPhaseContract.skillInputs.effective, [
    "skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md"
  ]);
  assert.equal(
    addPhaseContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});

test("router commands resolve catalog and runtime contract truth from runtime metadata", async () => {
  const catalog = await blueprintCommandCatalog();

  for (const metadata of [
    HELP_RUNTIME_METADATA,
    PROGRESS_RUNTIME_METADATA,
    NEXT_RUNTIME_METADATA
  ] as const) {
    const commandName = metadata.commandName;
    const entry = catalog.commands[commandName];
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName);

    assert.equal(entry.specPath, metadata.sourceId);
    assert.deepEqual(entry.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(entry.optionalAgents, []);
    assert.deepEqual(entry.availableOptionalAgents, []);
    assert.deepEqual(contract.catalog.requiredTools, [...metadata.requiredTools]);
    assert.equal(contract.spec?.path, metadata.sourceId);
    assert.deepEqual(contract.spec?.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(contract.spec?.optionalSubagents, []);
    assert.deepEqual(contract.spec?.writes, []);
    assert.equal(contract.runtimeReference?.path, metadata.sourceId);
    assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
    assert.deepEqual(contract.runtimeReference?.evidenceState, [
      "locked",
      "source-owned",
      "needs-behavior-audit"
    ]);
    assert.deepEqual(contract.skillInputs.shared, []);
    assert.deepEqual(contract.skillInputs.commandSpecific, [
      blueprintPrimaryManifestPath(commandName)
    ]);
    assert.deepEqual(contract.skillInputs.effective, [
      blueprintPrimaryManifestPath(commandName)
    ]);
    assert.equal(
      contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
      false
    );
    assert.match(
      contract.runtimeReference?.contractNotes ?? "",
      /map-codebase/i
    );
    assert.match(
      contract.runtimeReference?.contractNotes ?? "",
      /mapped-only.*new-project|new-project.*mapped-only/i
    );
    assert.match(
      contract.runtimeReference?.contractNotes ?? "",
      /planned or blocked commands are not runnable|never present planned or blocked commands as runnable/i
    );
  }
});

test("review commands resolve catalog and runtime contract truth from runtime metadata", async () => {
  const catalog = await blueprintCommandCatalog();

  for (const commandName of REVIEW_RUNTIME_METADATA_COMMANDS) {
    const metadata = getRuntimeOwnedCommandMetadata(commandName);
    const entry = catalog.commands[commandName];
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName);
    const manifestPath = blueprintPrimaryManifestPath(commandName);
    const runtimeContractPath = metadata?.requiredInputPaths?.[0];

    assert.ok(metadata, `${commandName} should have runtime-owned metadata`);
    assert.ok(runtimeContractPath, `${commandName} should require a local runtime contract`);
    assert.equal(entry.specPath, `src/mcp/command-runtime-metadata.ts#${commandName}`);
    assert.equal(entry.specPath, metadata.sourceId);
    assert.deepEqual(entry.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(entry.optionalAgents, [...metadata.optionalAgents]);
    assert.deepEqual(entry.availableOptionalAgents, [...metadata.optionalAgents]);
    assert.deepEqual(contract.catalog.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(contract.catalog.optionalAgents, [...metadata.optionalAgents]);
    assert.equal(contract.spec?.path, metadata.sourceId);
    assert.deepEqual(contract.spec?.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(contract.spec?.optionalSubagents, [...metadata.optionalAgents]);
    assert.equal(contract.runtimeReference?.path, metadata.sourceId);
    assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
    assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
      ...metadata.requiredTools
    ]);
    assert.deepEqual(contract.runtimeReference?.optionalAgents, [
      ...metadata.optionalAgents
    ]);
    assert.deepEqual(contract.skillInputs.shared, []);
    assert.deepEqual(contract.skillInputs.commandSpecific, [
      manifestPath,
      runtimeContractPath
    ]);
    assert.deepEqual(contract.skillInputs.effective, [manifestPath, runtimeContractPath]);
    assert.equal(
      contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
      false
    );
    assert.doesNotMatch(JSON.stringify(contract), /docs\//);
  }
});

test("maintenance commands resolve catalog and runtime contract truth from runtime metadata", async () => {
  const catalog = await blueprintCommandCatalog();

  for (const metadata of MAINTENANCE_RUNTIME_METADATA) {
    const commandName = metadata.commandName;
    const lookedUpMetadata = getRuntimeOwnedCommandMetadata(commandName);
    const entry = catalog.commands[commandName];
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName);
    const manifestPath = blueprintPrimaryManifestPath(commandName);
    const runtimeContractPath = metadata.requiredInputPaths?.[0];

    assert.ok(lookedUpMetadata, `${commandName} should have runtime-owned metadata`);
    assert.equal(lookedUpMetadata, metadata);
    assert.ok(runtimeContractPath, `${commandName} should require a local runtime contract`);
    assert.equal(entry.specPath, metadata.sourceId);
    assert.deepEqual(entry.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(entry.optionalAgents, [...metadata.optionalAgents]);
    assert.deepEqual(entry.availableOptionalAgents, [...metadata.optionalAgents]);
    assert.deepEqual(contract.catalog.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(contract.catalog.optionalAgents, [...metadata.optionalAgents]);
    assert.equal(contract.spec?.path, metadata.sourceId);
    assert.deepEqual(contract.spec?.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(contract.spec?.optionalSubagents, [...metadata.optionalAgents]);
    assert.equal(contract.runtimeReference?.path, metadata.sourceId);
    assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
    assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
      ...metadata.requiredTools
    ]);
    assert.deepEqual(contract.runtimeReference?.optionalAgents, [
      ...metadata.optionalAgents
    ]);
    assert.deepEqual(contract.skillInputs.shared, []);
    assert.deepEqual(contract.skillInputs.commandSpecific, [
      manifestPath,
      runtimeContractPath
    ]);
    assert.deepEqual(contract.skillInputs.effective, [manifestPath, runtimeContractPath]);
    assert.equal(
      contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
      false
    );
    assert.doesNotMatch(JSON.stringify(contract), /docs\//);
  }
});

test("capture commands resolve catalog and runtime contract truth from runtime metadata", async () => {
  const catalog = await blueprintCommandCatalog();

  for (const commandName of CAPTURE_RUNTIME_METADATA_COMMANDS) {
    const metadata = getRuntimeOwnedCommandMetadata(commandName);
    const entry = catalog.commands[commandName];
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName);

    assert.ok(metadata, `${commandName} should have runtime-owned metadata`);
    assert.equal(entry.specPath, `src/mcp/command-runtime-metadata.ts#${commandName}`);
    assert.equal(entry.specPath, metadata.sourceId);
    assert.deepEqual(entry.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(entry.optionalAgents, [...metadata.optionalAgents]);
    assert.deepEqual(contract.catalog.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(contract.catalog.optionalAgents, [...metadata.optionalAgents]);
    assert.equal(contract.spec?.path, metadata.sourceId);
    assert.deepEqual(contract.spec?.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(contract.spec?.optionalSubagents, [...metadata.optionalAgents]);
    assert.equal(contract.runtimeReference?.path, metadata.sourceId);
    assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
    assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
      ...metadata.requiredTools
    ]);
    assert.deepEqual(contract.runtimeReference?.optionalAgents, [
      ...metadata.optionalAgents
    ]);
    assert.deepEqual(contract.skillInputs.shared, []);
    assert.deepEqual(contract.skillInputs.commandSpecific, [
      blueprintPrimaryManifestPath(commandName)
    ]);
    assert.deepEqual(contract.skillInputs.effective, [
      blueprintPrimaryManifestPath(commandName)
    ]);
    assert.equal(
      contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
      false
    );
  }
});

test("discovery runtime contracts expose runtime-owned metadata and docs-free skill inputs", async () => {
  const expectations = [
    {
      command: "discuss-phase",
      inputs: [
        "skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md",
        "skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md"
      ]
    },
    {
      command: "research-phase",
      inputs: [
        "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md"
      ]
    },
    {
      command: "ui-phase",
      inputs: [
        "skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md"
      ]
    },
    {
      command: "list-phase-assumptions",
      inputs: [
        "skills/blueprint-phase-discovery/references/list-phase-assumptions-runtime-contract.md"
      ]
    }
  ] as const;
  const catalog = await blueprintCommandCatalog();

  for (const expectation of expectations) {
    const metadata = getRuntimeOwnedCommandMetadata(expectation.command);
    const entry = catalog.commands[expectation.command];
    const contract = await buildBlueprintCommandRuntimeContractResource(expectation.command);

    assert.ok(metadata, `${expectation.command} should have runtime-owned metadata`);
    assert.equal(entry.specPath, `src/mcp/command-runtime-metadata.ts#${expectation.command}`);
    assert.equal(entry.specPath, metadata.sourceId);
    assert.deepEqual(entry.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(entry.optionalAgents, [...metadata.optionalAgents]);
    assert.deepEqual(entry.availableOptionalAgents, [...metadata.optionalAgents]);
    assert.equal(contract.catalog.specPath, metadata.sourceId);
    assert.deepEqual(contract.catalog.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(contract.catalog.optionalAgents, [...metadata.optionalAgents]);
    assert.equal(contract.spec?.path, metadata.sourceId);
    assert.deepEqual(contract.spec?.requiredTools, [...metadata.requiredTools]);
    assert.deepEqual(contract.spec?.optionalSubagents, [...metadata.optionalAgents]);
    assert.equal(contract.runtimeReference?.path, metadata.sourceId);
    assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
    assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
      ...metadata.requiredTools
    ]);
    assert.deepEqual(contract.runtimeReference?.optionalAgents, [
      ...metadata.optionalAgents
    ]);
    assert.deepEqual(contract.skillInputs.shared, []);
    assert.deepEqual(contract.skillInputs.commandSpecific, [...expectation.inputs]);
    assert.deepEqual(contract.skillInputs.effective, [...expectation.inputs]);
    assert.equal(
      contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
      false
    );
  }
});

test("command path helpers centralize canonical, alias, and manifest forms", () => {
  assert.equal(blueprintDirectCommand("help"), "/blu-help");
  assert.equal(blueprintRouterCommand("help"), "/blu help");
  assert.deepEqual(blueprintDirectCommandAliases("help"), ["/blu help"]);
  assert.equal(blueprintPrimaryManifestPath("help"), "commands/blu-help.toml");
});

test("implemented direct commands expose only router-style aliases", async () => {
  const catalog = await blueprintCommandCatalog();

  for (const command of IMPLEMENTED_COMMANDS) {
    assert.deepEqual(catalog.aliases[command], blueprintDirectCommandAliases(command));
  }
});

test("add-phase is implemented once manifest, skill, and roadmap MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["add-phase"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.equal(entry.specPath, "src/mcp/command-runtime-metadata.ts#add-phase");
  assert.ok(catalog.waves["2"].includes("add-phase"));
  assert.equal(catalog.waves["2"].indexOf("add-phase"), 0);
  assert.ok(
    catalog.waves["2"].indexOf("add-phase") <
      catalog.waves["2"].indexOf("insert-phase")
  );
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_scaffold",
    "blueprint_roadmap_add_phase",
    "blueprint_roadmap_read",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("insert-phase is implemented once manifest, skill, and roadmap insertion MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["insert-phase"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_scaffold",
    "blueprint_roadmap_insert_phase",
    "blueprint_roadmap_read",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("add-backlog is implemented once manifest, skill, and capture MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["add-backlog"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_mutate_index",
    "blueprint_artifact_scaffold"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("new-workspace is implemented once manifest, skill, and workspace MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["new-workspace"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_config_get",
    "blueprint_workspace_create",
    "blueprint_workspace_registry_get"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("workstreams is implemented once manifest, skill, and project-local workstream MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands.workstreams;

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, blueprintPrimaryManifestPath("workstreams"));
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_state_update",
    "blueprint_workstream_list",
    "blueprint_workstream_mutate"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("remove-workspace is implemented once manifest, skill, and workspace removal MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["remove-workspace"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, blueprintPrimaryManifestPath("remove-workspace"));
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_workspace_registry_get",
    "blueprint_workspace_remove"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("update is implemented once manifest, skill, and advisory MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands.update;

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_update_check",
    "blueprint_update_plan"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("review-backlog is implemented once manifest, skill, and backlog-promotion MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["review-backlog"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_mutate_index",
    "blueprint_roadmap_promote_backlog",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("note is implemented once manifest, skill, and capture MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["note"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_mutate_index"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("add-todo is implemented once manifest, skill, and capture MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["add-todo"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_mutate_index"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("check-todos is implemented once manifest, skill, and capture MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["check-todos"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_mutate_index",
    "blueprint_project_status"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("explore is implemented once manifest, skill, and ideation-routing MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["explore"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_mutate_index",
    "blueprint_artifact_scaffold",
    "blueprint_config_get",
    "blueprint_project_status",
    "blueprint_roadmap_add_phase"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-researcher"]);
  assert.deepEqual(entry.blockedBy, []);
});

test("remove-phase is implemented once manifest, skill, and roadmap removal MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["remove-phase"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_phase_locate",
    "blueprint_roadmap_read",
    "blueprint_roadmap_remove_phase",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("implemented commands expose their declared optional agent contracts when shipped", async () => {
  const catalog = await blueprintCommandCatalog();

  assert.deepEqual(catalog.commands["new-project"].availableOptionalAgents.sort(), [
    "blueprint-project-researcher",
    "blueprint-roadmapper"
  ]);
  assert.deepEqual(catalog.commands["map-codebase"].availableOptionalAgents, [
    "blueprint-mapper"
  ]);
  assert.deepEqual(catalog.commands["discuss-phase"].availableOptionalAgents, [
    "blueprint-researcher"
  ]);
  assert.deepEqual(catalog.commands["research-phase"].availableOptionalAgents, [
    "blueprint-researcher"
  ]);
  assert.deepEqual(catalog.commands["explore"].availableOptionalAgents, [
    "blueprint-researcher"
  ]);
  assert.deepEqual(catalog.commands["ui-phase"].availableOptionalAgents.sort(), [
    "blueprint-checker",
    "blueprint-ui-designer"
  ]);
  assert.deepEqual(catalog.commands["validate-phase"].availableOptionalAgents, [
    "blueprint-verifier"
  ]);
  assert.deepEqual(catalog.commands["verify-work"].availableOptionalAgents, [
    "blueprint-verifier"
  ]);
  assert.deepEqual(catalog.commands["quick"].availableOptionalAgents.sort(), [
    "blueprint-executor",
    "blueprint-planner",
    "blueprint-researcher",
    "blueprint-verifier"
  ]);
  assert.deepEqual(catalog.commands["debug"].availableOptionalAgents, [
    "blueprint-debugger"
  ]);
  assert.deepEqual(catalog.commands["code-review"].availableOptionalAgents, [
    "blueprint-reviewer"
  ]);
  assert.deepEqual(catalog.commands["code-review-fix"].availableOptionalAgents, [
    "blueprint-reviewer"
  ]);
  assert.deepEqual(catalog.commands["audit-fix"].availableOptionalAgents.sort(), [
    "blueprint-reviewer",
    "blueprint-verifier"
  ]);
  assert.deepEqual(catalog.commands["secure-phase"].availableOptionalAgents, [
    "blueprint-security-auditor"
  ]);
  assert.deepEqual(catalog.commands["ui-review"].availableOptionalAgents, [
    "blueprint-ui-auditor"
  ]);
  assert.deepEqual(catalog.commands["review"].availableOptionalAgents, [
    "blueprint-reviewer"
  ]);
  assert.deepEqual(catalog.commands["plan-milestone-gaps"].availableOptionalAgents, [
    "blueprint-roadmapper"
  ]);
  assert.deepEqual(catalog.commands["complete-milestone"].availableOptionalAgents, []);
  assert.deepEqual(catalog.commands["milestone-summary"].availableOptionalAgents, []);
  assert.deepEqual(catalog.commands["new-milestone"].availableOptionalAgents, [
    "blueprint-roadmapper"
  ]);
  assert.deepEqual(catalog.commands["docs-update"].availableOptionalAgents.sort(), [
    "blueprint-doc-verifier",
    "blueprint-doc-writer"
  ]);
});

test("runtime metadata requires blueprint_config_get for every optional-subagent command", () => {
  for (const metadata of listRuntimeOwnedCommandMetadata()) {
    if (metadata.optionalAgents.length === 0) {
      continue;
    }

    assert.equal(
      metadata.requiredTools.includes("blueprint_config_get"),
      true,
      `${metadata.commandName} should require blueprint_config_get when optional subagents are exposed`
    );
  }
});

test("map-codebase is implemented once the brownfield mapping contract and tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["map-codebase"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu-map-codebase.toml");
  assert.ok(entry.skillPath);
  assert.equal(entry.specPath, MAP_CODEBASE_RUNTIME_METADATA.sourceId);
  assert.deepEqual(entry.requiredTools, [...MAP_CODEBASE_RUNTIME_METADATA.requiredTools]);
  assert.deepEqual(entry.optionalAgents, [...MAP_CODEBASE_RUNTIME_METADATA.optionalAgents]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-mapper"]);
  assert.deepEqual(entry.blockedBy, []);
});

test("map-codebase runtime contract builds from metadata when docs are unavailable", async (t) => {
  const realReadFile = fs.readFile.bind(fs);

  t.mock.method(fs, "readFile", async (filePath, options) => {
    const normalizedPath =
      filePath instanceof URL ? filePath.pathname : path.resolve(String(filePath));

    if (
      normalizedPath.endsWith("/docs/COMMAND-CATALOG.md") ||
      normalizedPath.endsWith("/docs/RUNTIME-REFERENCE.md") ||
      normalizedPath.includes("/docs/commands/")
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

  const contract = await buildBlueprintCommandRuntimeContractResource("map-codebase");

  assert.equal(contract.catalog.status, "implemented");
  assert.equal(contract.catalog.specPath, MAP_CODEBASE_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec?.path, MAP_CODEBASE_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec?.executionProfile, "long-running-mutation");
  assert.deepEqual(contract.spec?.reads, []);
  assert.deepEqual(contract.spec?.writes, [...MAP_CODEBASE_RUNTIME_METADATA.spec.writes]);
  assert.equal(contract.runtimeReference?.path, MAP_CODEBASE_RUNTIME_METADATA.sourceId);
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    MAP_CODEBASE_RUNTIME_METADATA.sourceId
  );
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    ...MAP_CODEBASE_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.runtimeReference?.optionalAgents, ["blueprint-mapper"]);
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "commands/blu-map-codebase.toml",
    "skills/blueprint-map/references/map-runtime-contract.md"
  ]);
  assert.deepEqual(contract.skillInputs.effective, [
    "commands/blu-map-codebase.toml",
    "skills/blueprint-map/references/map-runtime-contract.md"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.doesNotMatch(JSON.stringify(contract.skillInputs), /docs\//);
  assert.match(contract.runtimeReference?.contractNotes ?? "", /reuse as the default/i);
  assert.match(contract.runtimeReference?.contractNotes ?? "", /ask_user confirmation/i);
  assert.match(contract.runtimeReference?.contractNotes ?? "", /\/blu-new-project/i);
});

test("research-phase is implemented once manifest, skill, and external-policy-aware tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["research-phase"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu-research-phase.toml");
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_phase_research_status",
    "blueprint_phase_artifact_read",
    "blueprint_phase_artifact_scaffold",
    "blueprint_phase_artifact_write",
    "blueprint_phase_checkpoint_get",
    "blueprint_phase_checkpoint_put",
    "blueprint_phase_checkpoint_delete",
    "blueprint_artifact_contract_read",
    "blueprint_config_get",
    "blueprint_state_load",
    "blueprint_command_catalog",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-researcher"]);
  assert.deepEqual(entry.blockedBy, []);
});

test("runtime command catalog only advertises metadata-valid optional agents", async () => {
  const catalog = await blueprintCommandCatalog();
  const availableAgents = new Set(
    Object.values(catalog.commands).flatMap((entry) => entry.availableOptionalAgents)
  );

  for (const agentName of availableAgents) {
    const validation = await validateBundledBlueprintAgentDefinition(
      agentName,
      readRelativePath
    );

    assert.equal(validation.valid, true, validation.issues.join("\n"));
  }
});

test("planned commands stay non-routable until their dedicated manifest exists", async () => {
  const catalog = await blueprintCommandCatalog();

  for (const command of PLANNED_COMMANDS) {
    const entry = catalog.commands[command];

    assert.equal(entry.declaredStatus, "planned");
    assert.equal(entry.implemented, false);
    assert.equal(entry.status, "repairing");
    assert.equal(entry.manifestPath, null);
    assert.ok(entry.blockedBy.length > 0);
    assert.match(
      entry.blockedBy.join("\n"),
      /Missing command manifest: commands\/blu-do\.toml/
    );
  }
});

test("docless fallback preserves planned do without exposing a runtime contract", async (t) => {
  const realAccess = fs.access.bind(fs);
  const realReadFile = fs.readFile.bind(fs);
  const docsTouches: string[] = [];

  t.mock.method(fs, "access", async (filePath, mode) => {
    const docsPath = catalogDocsPath(filePath);

    if (docsPath) {
      docsTouches.push(`access:${docsPath}`);
      const error = new Error("simulated docs absence") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }

    return realAccess(
      filePath as Parameters<typeof fs.access>[0],
      mode as Parameters<typeof fs.access>[1]
    );
  });

  t.mock.method(fs, "readFile", async (filePath, options) => {
    const docsPath = catalogDocsPath(filePath);

    if (docsPath) {
      docsTouches.push(`readFile:${docsPath}`);
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
  const entry = catalog.commands.do;

  assert.ok(entry);
  assert.equal(getRuntimeOwnedCommandMetadata("do"), null);
  assert.equal(entry.declaredStatus, "planned");
  assert.equal(entry.status, "repairing");
  assert.equal(entry.implemented, false);
  assert.equal(entry.manifestPath, null);
  assert.equal(entry.specPath, null);
  assert.match(
    entry.blockedBy.join("\n"),
    /Missing command manifest: commands\/blu-do\.toml/
  );
  assert.doesNotMatch(entry.blockedBy.join("\n"), /docs\/commands\/do\.md/);
  assert.deepEqual(
    docsTouches.filter((touch) => touch.endsWith("docs/commands/do.md")),
    []
  );
  assert.deepEqual(catalog.aliases.do, blueprintDirectCommandAliases("do"));
  assert.ok(catalog.waves["3"].includes("do"));

  const advertisedCommands = await listBlueprintCommandRuntimeContractCommands();

  assert.equal(advertisedCommands.includes("do"), false);
  await assert.rejects(
    buildBlueprintCommandRuntimeContractResource("do"),
    /Blueprint runtime-contract resources are available only for implemented commands: do/
  );
});

test("runtime-owned command catalog projection does not touch command docs", async (t) => {
  const realAccess = fs.access.bind(fs);
  const realReadFile = fs.readFile.bind(fs);
  const docsTouches: string[] = [];

  t.mock.method(fs, "access", async (filePath, mode) => {
    const docsPath = catalogDocsPath(filePath);

    if (docsPath) {
      docsTouches.push(`access:${docsPath}`);
    }

    return realAccess(
      filePath as Parameters<typeof fs.access>[0],
      mode as Parameters<typeof fs.access>[1]
    );
  });

  t.mock.method(fs, "readFile", async (filePath, options) => {
    const docsPath = catalogDocsPath(filePath);

    if (docsPath) {
      docsTouches.push(`readFile:${docsPath}`);
    }

    return realReadFile(
      filePath as Parameters<typeof fs.readFile>[0],
      options as Parameters<typeof fs.readFile>[1]
    );
  });

  const catalog = await blueprintRuntimeOwnedCommandCatalog();
  const impactEntry = catalog.commands.impact;
  const doEntry = catalog.commands.do;

  assert.deepEqual(docsTouches, []);
  assert.ok(impactEntry);
  assert.equal(impactEntry.declaredStatus, "implemented");
  assert.equal(impactEntry.status, "implemented");
  assert.equal(impactEntry.implemented, true);
  assert.equal(impactEntry.specPath, IMPACT_RUNTIME_METADATA.sourceId);
  assert.ok(doEntry);
  assert.equal(doEntry.declaredStatus, "planned");
  assert.notEqual(doEntry.status, "implemented");
  assert.equal(doEntry.implemented, false);
  assert.equal(doEntry.specPath, null);
  assert.equal(catalog.waves[String(impactEntry.wave)].includes("impact"), true);
  assert.equal(catalog.waves[String(doEntry.wave)].includes("do"), true);
});

test("impact is implemented once its additive command substrate is complete", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands.impact;
  const metadata = getRuntimeOwnedCommandMetadata("impact");

  assert.equal(metadata, IMPACT_RUNTIME_METADATA);

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-impact.toml");
  assert.equal(entry.skillPath, "skills/blueprint-impact/SKILL.md");
  assert.equal(entry.specPath, IMPACT_RUNTIME_METADATA.sourceId);
  assert.equal(entry.risk, IMPACT_RUNTIME_METADATA.catalog.risk);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.deepEqual(entry.requiredTools, [...IMPACT_RUNTIME_METADATA.requiredTools]);
  assert.deepEqual(entry.optionalAgents, [...IMPACT_RUNTIME_METADATA.optionalAgents]);
  assert.deepEqual(entry.availableOptionalAgents, [
    ...IMPACT_RUNTIME_METADATA.optionalAgents
  ]);
  assert.deepEqual(entry.blockedBy, []);
  assert.doesNotMatch(entry.blockedBy.join("\n"), /Missing required MCP tool: blueprint_impact_/);
});

test("impact runtime contract resource survives missing command docs", async () => {
  const contract = await buildBlueprintCommandRuntimeContractResource("impact", {
    readRelativePath: async (relativePath) => {
      if (relativePath.startsWith("docs/")) {
        return null;
      }

      return readRelativePath(relativePath);
    }
  });

  assert.equal(contract.catalog.specPath, IMPACT_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec?.path, IMPACT_RUNTIME_METADATA.sourceId);
  assert.deepEqual(contract.spec?.requiredTools, [
    ...IMPACT_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.spec?.optionalSubagents, [
    ...IMPACT_RUNTIME_METADATA.optionalAgents
  ]);
  assert.equal(contract.runtimeReference?.path, IMPACT_RUNTIME_METADATA.sourceId);
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    IMPACT_RUNTIME_METADATA.sourceId
  );
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    ...IMPACT_RUNTIME_METADATA.runtimeReference.exactMcpDestination
  ]);
  assert.deepEqual(contract.runtimeReference?.optionalAgents, [
    ...IMPACT_RUNTIME_METADATA.optionalAgents
  ]);
});

test("plan-phase is implemented once manifest, skill, and plan MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["plan-phase"];
  const expectedRequiredTools = [
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_phase_research_status",
    "blueprint_phase_artifact_read",
    "blueprint_phase_validation_read",
    "blueprint_review_load_findings",
    "blueprint_artifact_contract_read",
    "blueprint_phase_plan_index",
    "blueprint_phase_plan_read",
    "blueprint_phase_plan_authoring_context",
    "blueprint_phase_plan_validate_model",
    "blueprint_phase_plan_write",
    "blueprint_phase_plan_validate",
    "blueprint_config_get",
    "blueprint_state_load",
    "blueprint_state_update"
  ];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu-plan-phase.toml");
  assert.equal(entry.skillPath, "skills/blueprint-phase-planning/SKILL.md");
  assert.equal(entry.specPath, "src/mcp/command-runtime-metadata.ts#plan-phase");
  assert.equal(entry.specPath, PLAN_PHASE_RUNTIME_METADATA.sourceId);
  assert.deepEqual(entry.requiredTools, expectedRequiredTools);
  assert.deepEqual(entry.requiredTools, [
    ...PLAN_PHASE_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(entry.optionalAgents, [
    "blueprint-planner",
    "blueprint-checker"
  ]);
  assert.deepEqual(entry.availableOptionalAgents.sort(), [
    "blueprint-checker",
    "blueprint-planner"
  ]);
  assert.deepEqual(entry.optionalAgents, [
    ...PLAN_PHASE_RUNTIME_METADATA.optionalAgents
  ]);
  assert.deepEqual(entry.blockedBy, []);
});

test("plan-phase runtime contract resource survives missing command docs", async () => {
  const readWithPlanPhaseDocsUnavailable = async (
    relativePath: string
  ): Promise<string | null> => {
    if (
      relativePath === "docs/commands/plan-phase.md" ||
      relativePath === "docs/RUNTIME-REFERENCE.md"
    ) {
      return null;
    }

    return readRelativePath(relativePath);
  };
  const contract = await buildBlueprintCommandRuntimeContractResource("plan-phase", {
    readRelativePath: readWithPlanPhaseDocsUnavailable
  });

  assert.equal(contract.catalog.specPath, PLAN_PHASE_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec?.path, PLAN_PHASE_RUNTIME_METADATA.sourceId);
  assert.deepEqual(contract.spec?.requiredTools, [
    ...PLAN_PHASE_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.spec?.optionalSubagents, [
    ...PLAN_PHASE_RUNTIME_METADATA.optionalAgents
  ]);
  assert.equal(
    contract.runtimeReference?.path,
    PLAN_PHASE_RUNTIME_METADATA.sourceId
  );
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    PLAN_PHASE_RUNTIME_METADATA.sourceId
  );
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    ...PLAN_PHASE_RUNTIME_METADATA.runtimeReference.exactMcpDestination
  ]);
  assert.deepEqual(contract.runtimeReference?.optionalAgents, [
    ...PLAN_PHASE_RUNTIME_METADATA.optionalAgents
  ]);
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
  ]);
  assert.deepEqual(contract.skillInputs.effective, [
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});

test("execute-phase is implemented once manifest, skill, and execution summary MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["execute-phase"];
  const metadata = getRuntimeOwnedCommandMetadata("execute-phase");

  assert.ok(metadata);

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.equal(entry.specPath, metadata.sourceId);
  assert.deepEqual(entry.availableOptionalAgents.sort(), ["blueprint-executor"]);
  assert.deepEqual(entry.blockedBy, []);
});

test("validation slice commands are implemented once manifests, shared skill, and MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();

  for (const command of ["validate-phase", "verify-work"] as const) {
    const entry = catalog.commands[command];

    assert.equal(entry.declaredStatus, "implemented");
    assert.equal(entry.status, "implemented");
    assert.equal(entry.implemented, true);
    assert.equal(entry.requiredToolsSatisfied, true);
    assert.ok(entry.manifestPath);
    assert.ok(entry.skillPath);
    assert.ok(entry.specPath);
    assert.deepEqual(entry.availableOptionalAgents, ["blueprint-verifier"]);
    assert.deepEqual(entry.blockedBy, []);
  }
});

test("resume-work is implemented once the governance manifest and handoff MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["resume-work"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu-resume-work.toml");
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("secure-phase is implemented once manifest, review skill, and review MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["secure-phase"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu-secure-phase.toml");
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_contract_read",
    "blueprint_artifact_list",
    "blueprint_config_get",
    "blueprint_phase_execution_targets",
    "blueprint_phase_locate",
    "blueprint_phase_plan_index",
    "blueprint_phase_plan_read",
    "blueprint_phase_summary_index",
    "blueprint_phase_summary_read",
    "blueprint_review_authoring_context",
    "blueprint_review_record",
    "blueprint_review_validate_model"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-security-auditor"]);
  assert.deepEqual(entry.blockedBy, []);
});

test("ui-review is implemented once manifest, review skill, and review MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["ui-review"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu-ui-review.toml");
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_contract_read",
    "blueprint_artifact_list",
    "blueprint_config_get",
    "blueprint_phase_locate",
    "blueprint_review_authoring_context",
    "blueprint_review_record",
    "blueprint_review_validate_model"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-ui-auditor"]);
  assert.deepEqual(entry.blockedBy, []);
});

test("code-review is implemented once manifest, review skill, and review MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["code-review"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu-code-review.toml");
  assert.ok(entry.skillPath);
  assert.equal(
    entry.specPath,
    CODE_REVIEW_RUNTIME_METADATA.sourceId
  );
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_contract_read",
    "blueprint_config_get",
    "blueprint_phase_locate",
    "blueprint_review_load_findings",
    "blueprint_review_record",
    "blueprint_review_scope",
    "blueprint_review_validate_model"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-reviewer"]);
  assert.deepEqual(entry.blockedBy, []);
});

test("runtime-owned code-review is repairing when its local runtime contract is missing", async (t) => {
  const metadata = getRuntimeOwnedCommandMetadata("code-review");

  assert.ok(metadata);

  const originalAccess = fs.access;
  fs.access = (async (...args: Parameters<typeof fs.access>) => {
    if (isBundledPath(args[0], metadata.requiredInputPaths?.[0] ?? "")) {
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
  const entry = catalog.commands["code-review"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "repairing");
  assert.equal(entry.implemented, false);
  assert.equal(entry.specPath, null);
  assert.match(
    entry.blockedBy.join("\n"),
    /Missing runtime input: skills\/blueprint-review\/references\/code-review-runtime-contract\.md/
  );
});

test("code-review runtime reference keeps the long-running review posture explicit", async () => {
  const contract = await buildBlueprintCommandRuntimeContractResource("code-review");
  const runtimeReference = contract.runtimeReference;

  assert.ok(runtimeReference);
  assert.equal(runtimeReference.path, CODE_REVIEW_RUNTIME_METADATA.sourceId);
  assert.equal(
    runtimeReference.commandSpecPath,
    CODE_REVIEW_RUNTIME_METADATA.sourceId
  );
  assert.equal(runtimeReference.primarySkill, "blueprint-review");
  assert.deepEqual(runtimeReference.exactMcpDestination, [
    "blueprint_phase_locate",
    "blueprint_config_get",
    "blueprint_artifact_contract_read",
    "blueprint_review_scope",
    "blueprint_review_load_findings",
    "blueprint_review_validate_model",
    "blueprint_review_record"
  ]);
  assert.deepEqual(runtimeReference.optionalAgents, ["blueprint-reviewer"]);
  assert.match(
    runtimeReference.contractNotes ?? "",
    /Long-running-mutation profile for deterministic phase-scoped review/i
  );
  assert.match(
    runtimeReference.contractNotes ?? "",
    /Resolve\/Read\/Decide\/Execute\/Validate\/Persist\/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible/i
  );
  assert.match(
    runtimeReference.contractNotes ?? "",
    /use Gemini-native update_topic and write_todos for non-trivial review runs/i
  );
});

test("review is implemented once manifest, review skill, and plan-backed peer-review tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["review"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu-review.toml");
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_artifact_list",
    "blueprint_artifact_contract_read",
    "blueprint_config_get",
    "blueprint_phase_plan_index",
    "blueprint_phase_plan_read",
    "blueprint_phase_summary_index",
    "blueprint_phase_summary_read",
    "blueprint_phase_execution_targets",
    "blueprint_review_authoring_context",
    "blueprint_review_validate_model",
    "blueprint_review_record"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-reviewer"]);
  assert.deepEqual(entry.blockedBy, []);
});

test("code-review-fix is implemented once manifest, review skill, and findings tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["code-review-fix"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu-code-review-fix.toml");
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_config_get",
    "blueprint_phase_locate",
    "blueprint_review_authoring_context",
    "blueprint_review_load_findings",
    "blueprint_review_record",
    "blueprint_review_validate_model",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-reviewer"]);
  assert.deepEqual(entry.blockedBy, []);
});

test("review-fix inventory docs stay aligned with the shipped Blueprint runtime", async () => {
  const [
    artifactSchema,
    skillsAndAgents,
    runtimeReference,
    commandCatalogDoc,
    migrationDoc
  ] = await Promise.all([
    readRelativePath("docs/ARTIFACT-SCHEMA.md"),
    readRelativePath("docs/SKILLS-AND-AGENTS.md"),
    readRelativePath("docs/RUNTIME-REFERENCE.md"),
    readRelativePath("docs/COMMAND-CATALOG.md"),
    readRelativePath("docs/GSD-RUNTIME-MIGRATION.md")
  ]);

  assert.ok(artifactSchema);
  assert.ok(skillsAndAgents);
  assert.ok(runtimeReference);
  assert.ok(commandCatalogDoc);
  assert.ok(migrationDoc);

  assert.match(
    artifactSchema,
    /### `XX-REVIEW-FIX\.md`[\s\S]*\*\*Status:\*\* COMPLETED\|PARTIAL\|BLOCKED[\s\S]*\*\*Readiness:\*\* ready-for-validation\|not-ready-for-validation\|blocked[\s\S]*\*\*Completion State:\*\* complete\|pending\|blocked[\s\S]*## Remediation Summary[\s\S]*## Findings Addressed[\s\S]*## Changes Made[\s\S]*## Verification[\s\S]*## Dependency Plans[\s\S]*## Manual \/ Deferred Work[\s\S]*## Gap \/ Repair Routes[\s\S]*## Follow-Ups[\s\S]*## Evidence[\s\S]*## Next Safe Action/
  );
  assert.match(
    artifactSchema,
    /`## Findings Addressed` is the locked heading for remediation scope/
  );
  assert.match(
    artifactSchema,
    /### `reports\/audit-fix-<phase>\.md`[\s\S]*## Evidence Used[\s\S]*## Fix Scope[\s\S]*## Changes Applied[\s\S]*## Remaining Gaps[\s\S]*## Next Safe Action/
  );
  assert.match(
    artifactSchema,
    /do not route through `blueprint_review_record`/
  );

  assert.match(
    skillsAndAgents,
    /\| `blueprint-fixer` \| `planned` \| Apply targeted fixes from review output \|/
  );
  assert.match(
    skillsAndAgents,
    /The planned `blueprint-fixer` remains future inventory only\./
  );
  assert.match(
    skillsAndAgents,
    /`code-review-fix` may use `blueprint-reviewer`\./
  );
  assert.match(
    skillsAndAgents,
    /`audit-fix` may use `blueprint-reviewer` for read-only saved-evidence classification and `blueprint-verifier` for bounded post-fix verification/
  );
  assert.match(
    skillsAndAgents,
    /single-agent fallback from `skills\/blueprint-review\/references\/audit-fix-runtime-contract\.md`/
  );
  assert.match(
    skillsAndAgents,
    /browser\/web-search\/shell-only or generic agents are not substitutes, and planned-only `blueprint-fixer` remains non-routable/
  );
  assert.doesNotMatch(
    skillsAndAgents,
    /`code-review-fix` and `audit-fix` use `blueprint-fixer`\./
  );

  assert.match(
    commandCatalogDoc,
    /\| `code-review-fix` \| 4 \| `Quality And Shipping` \| `blueprint-review` \| `implemented` \| `phase XX-REVIEW-FIX\.md; code changes for selected findings; \.blueprint\/STATE\.md` \| `High: selected findings can trigger bounded repo remediation plus review-fix\/state updates\.` \|/
  );
  assert.doesNotMatch(commandCatalogDoc, /optional iteration loop/);

  assert.match(
    runtimeReference,
    /\| `code-review-fix` \| `src\/mcp\/command-runtime-metadata\.ts#code-review-fix` \| `blueprint-review` \| `blueprint_phase_locate`<br>`blueprint_config_get`<br>`blueprint_review_load_findings`<br>`blueprint_review_authoring_context`<br>`blueprint_review_validate_model`<br>`blueprint_review_record`<br>`blueprint_state_update` \| `blueprint-reviewer` \|/
  );
  assert.match(runtimeReference, /author only the schema's camelCase JSON fields/);
  assert.match(runtimeReference, /forbid rendered-heading or locked-marker JSON keys/);
  assert.match(
    runtimeReference,
    /No auto-fixer behavior, implicit commits or branches, or hidden iterative re-review loops are shipped\./
  );
  assert.match(
    runtimeReference,
    /\| `audit-fix` \| `docs\/commands\/audit-fix\.md` \| `blueprint-review` \| `blueprint_phase_locate`<br>`blueprint_artifact_list`<br>`blueprint_review_scope`<br>`blueprint_artifact_contract_read`<br>`blueprint_config_get`<br>`blueprint_artifact_report_authoring_context`<br>`blueprint_artifact_report_validate_model`<br>`blueprint_artifact_report_write`<br>`blueprint_artifact_mutate_index`<br>`blueprint_state_update` \| `blueprint-reviewer`<br>`blueprint-verifier` \|/
  );
  assert.match(
    runtimeReference,
    /The planned `blueprint-fixer` remains unshipped and is not an active required runtime path\./
  );
  assert.match(
    runtimeReference,
    /`audit-fix`[\s\S]*load `skills\/blueprint-review\/references\/audit-fix-runtime-contract\.md`/
  );
  assert.match(
    runtimeReference,
    /`audit-fix`[\s\S]*classify from saved evidence selected by `--source` into `auto-fixable`, `manual-only`, and `skip` rows before mutation/
  );
  assert.match(
    runtimeReference,
    /`audit-fix`[\s\S]*auditFixContext \{source, severity, maxAttempts, dryRun, scopeFiles\}/
  );

  assert.match(
    migrationDoc,
    /`code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `review`, `ui-review`, `docs-update`, `add-tests`, `pr-branch`, `ship`, and `undo` are currently shipped in this wave\./
  );
  assert.match(
    migrationDoc,
    /\| `code-review-fix` \| `commands\/gsd\/code-review-fix\.md` \| GSD has an upstream workflow file \| `docs\/commands\/code-review-fix\.md` \| `blueprint-review` \| `blueprint_phase_locate`<br>`blueprint_config_get`<br>`blueprint_review_load_findings`<br>`blueprint_review_authoring_context`<br>`blueprint_review_validate_model`<br>`blueprint_review_record`<br>`blueprint_state_update` \| `blueprint-reviewer` \|/
  );
  assert.match(
    migrationDoc,
    /do not claim the planned `blueprint-fixer`, per-fix commits, or an implicit auto re-review loop as shipped Blueprint behavior\./
  );
  assert.match(
    migrationDoc,
    /\| `audit-fix` \| `commands\/gsd\/audit-fix\.md` \| GSD has an upstream workflow file \| `docs\/commands\/audit-fix\.md` \| `blueprint-review` \| `blueprint_phase_locate`<br>`blueprint_artifact_list`<br>`blueprint_review_scope`<br>`blueprint_artifact_contract_read`<br>`blueprint_config_get`<br>`blueprint_artifact_report_authoring_context`<br>`blueprint_artifact_report_validate_model`<br>`blueprint_artifact_report_write`<br>`blueprint_artifact_mutate_index`<br>`blueprint_state_update` \| `blueprint-reviewer`<br>`blueprint-verifier` \|/
  );
  assert.match(
    migrationDoc,
    /Do not claim the planned `blueprint-fixer` as an implemented runtime path or active dependency\./
  );
  assert.doesNotMatch(
    migrationDoc,
    /High-risk planned flows such as `quick`, `code-review-fix`, `audit-fix`, `ship`, `undo`/
  );
});

test("audit-fix is implemented once manifest, review skill, and remediation MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["audit-fix"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu-audit-fix.toml");
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_contract_read",
    "blueprint_artifact_list",
    "blueprint_artifact_mutate_index",
    "blueprint_artifact_report_authoring_context",
    "blueprint_artifact_report_validate_model",
    "blueprint_artifact_report_write",
    "blueprint_config_get",
    "blueprint_phase_locate",
    "blueprint_review_scope",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents.sort(), [
    "blueprint-reviewer",
    "blueprint-verifier"
  ]);
  assert.deepEqual(entry.blockedBy, []);
});

test("add-tests is implemented once manifest, validation skill, and test-generation MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["add-tests"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu-add-tests.toml");
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_phase_summary_index",
    "blueprint_phase_summary_read",
    "blueprint_phase_validation_read",
    "blueprint_phase_validation_authoring_context",
    "blueprint_phase_validation_render",
    "blueprint_artifact_contract_read",
    "blueprint_config_get",
    "blueprint_phase_validation_write",
    "blueprint_artifact_list",
    "blueprint_artifact_validate",
    "blueprint_artifact_report_authoring_context",
    "blueprint_artifact_report_validate_model",
    "blueprint_artifact_report_write",
    "blueprint_state_load",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents.sort(), [
    "blueprint-executor",
    "blueprint-verifier"
  ]);
  assert.deepEqual(entry.blockedBy, []);
});

test("audit-milestone is implemented once manifest, skill, and milestone audit MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["audit-milestone"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-verifier"]);
  assert.deepEqual(entry.blockedBy, []);
});

test("plan-milestone-gaps is implemented once manifest, skill, and gap-planning MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["plan-milestone-gaps"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_list",
    "blueprint_artifact_summary_digest",
    "blueprint_config_get",
    "blueprint_roadmap_add_phase",
    "blueprint_roadmap_read",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-roadmapper"]);
  assert.deepEqual(entry.blockedBy, []);
});

test("complete-milestone is implemented once manifest, skill, and closeout report MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["complete-milestone"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_contract_read",
    "blueprint_artifact_list",
    "blueprint_artifact_report_write",
    "blueprint_artifact_summary_digest",
    "blueprint_roadmap_read",
    "blueprint_state_load",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("milestone-summary is implemented once manifest, skill, and summary report MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["milestone-summary"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_contract_read",
    "blueprint_artifact_list",
    "blueprint_artifact_report_write",
    "blueprint_artifact_summary_digest",
    "blueprint_roadmap_read",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("new-milestone is implemented once manifest, skill, and carry-forward scaffold MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["new-milestone"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_contract_read",
    "blueprint_artifact_scaffold",
    "blueprint_artifact_summary_digest",
    "blueprint_config_get",
    "blueprint_roadmap_read",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-roadmapper"]);
  assert.deepEqual(entry.blockedBy, []);
});

test("docs-update is implemented once manifest, skill, and docs-report MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["docs-update"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_list",
    "blueprint_artifact_report_write",
    "blueprint_artifact_summary_digest",
    "blueprint_config_get",
    "blueprint_project_status"
  ]);
  assert.deepEqual(entry.availableOptionalAgents.sort(), [
    "blueprint-doc-verifier",
    "blueprint-doc-writer"
  ]);
  assert.deepEqual(entry.blockedBy, []);
});

test("docs-update runtime contract builds from metadata and local skill inputs when docs are unavailable", async (t) => {
  const realReadFile = fs.readFile.bind(fs);

  t.mock.method(fs, "readFile", async (filePath, options) => {
    const normalizedPath =
      filePath instanceof URL ? filePath.pathname : path.resolve(String(filePath));

    if (
      normalizedPath.endsWith("/docs/COMMAND-CATALOG.md") ||
      normalizedPath.endsWith("/docs/RUNTIME-REFERENCE.md") ||
      normalizedPath.includes("/docs/commands/")
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

  const contract = await buildBlueprintCommandRuntimeContractResource("docs-update");

  assert.equal(contract.catalog.status, "implemented");
  assert.equal(contract.catalog.specPath, DOCS_UPDATE_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec?.path, DOCS_UPDATE_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec?.executionProfile, "long-running-mutation");
  assert.deepEqual(contract.spec?.requiredTools, [
    ...DOCS_UPDATE_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.spec?.writes, [...DOCS_UPDATE_RUNTIME_METADATA.spec.writes]);
  assert.equal(contract.runtimeReference?.path, DOCS_UPDATE_RUNTIME_METADATA.sourceId);
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    DOCS_UPDATE_RUNTIME_METADATA.sourceId
  );
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    ...DOCS_UPDATE_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.runtimeReference?.optionalAgents.sort(), [
    "blueprint-doc-verifier",
    "blueprint-doc-writer"
  ]);
  assert.deepEqual(contract.runtimeReference?.evidenceState, [
    "locked",
    "runtime-owned",
    "needs-behavior-audit"
  ]);
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "commands/blu-docs-update.toml",
    "skills/blueprint-docs/references/docs-update-runtime-contract.md"
  ]);
  assert.deepEqual(contract.skillInputs.effective, [
    "commands/blu-docs-update.toml",
    "skills/blueprint-docs/references/docs-update-runtime-contract.md"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.match(contract.runtimeReference?.contractNotes ?? "", /digest inputsUsed/i);
  assert.match(contract.runtimeReference?.contractNotes ?? "", /bare reportName docs-update-latest/i);
  assert.match(contract.runtimeReference?.contractNotes ?? "", /implemented follow-ups/i);
});

test("pr-branch is implemented once manifest, skill, and review-branch report MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["pr-branch"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, blueprintPrimaryManifestPath("pr-branch"));
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_contract_read",
    "blueprint_artifact_report_write",
    "blueprint_artifact_summary_digest",
    "blueprint_config_get",
    "blueprint_project_status"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("ship is implemented once manifest, skill, and report-backed shipping MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["ship"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, blueprintPrimaryManifestPath("ship"));
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_contract_read",
    "blueprint_artifact_list",
    "blueprint_artifact_report_write",
    "blueprint_artifact_summary_digest",
    "blueprint_config_get",
    "blueprint_phase_locate",
    "blueprint_project_status",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("cleanup is implemented once manifest, skill, and archival report MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["cleanup"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, blueprintPrimaryManifestPath("cleanup"));
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_list",
    "blueprint_artifact_report_write",
    "blueprint_artifact_summary_digest",
    "blueprint_project_status",
    "blueprint_roadmap_read",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("undo is implemented once manifest, skill, and report-backed revert MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["undo"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, blueprintPrimaryManifestPath("undo"));
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_contract_read",
    "blueprint_artifact_list",
    "blueprint_artifact_report_write",
    "blueprint_artifact_summary_digest",
    "blueprint_phase_locate",
    "blueprint_project_status",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("reapply-patches is implemented once manifest, skill, and patch replay MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["reapply-patches"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, blueprintPrimaryManifestPath("reapply-patches"));
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_patch_list",
    "blueprint_patch_reapply",
    "blueprint_patch_record"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("quick is implemented once manifest, skill, and report-backed quick-run MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["quick"];
  const metadata = getRuntimeOwnedCommandMetadata("quick");

  assert.ok(metadata);

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, blueprintPrimaryManifestPath("quick"));
  assert.ok(entry.skillPath);
  assert.equal(entry.specPath, metadata.sourceId);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_report_write",
    "blueprint_command_catalog",
    "blueprint_config_get",
    "blueprint_project_status",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents.sort(), [
    "blueprint-executor",
    "blueprint-planner",
    "blueprint-researcher",
    "blueprint-verifier"
  ]);
  assert.deepEqual(entry.blockedBy, []);
});

test("fast is implemented once manifest, skill, and trivial inline MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["fast"];
  const metadata = getRuntimeOwnedCommandMetadata("fast");

  assert.ok(metadata);

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, blueprintPrimaryManifestPath("fast"));
  assert.ok(entry.skillPath);
  assert.equal(entry.specPath, metadata.sourceId);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_project_status",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});

test("debug is implemented once manifest, skill, and report-backed debug MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["debug"];
  const metadata = getRuntimeOwnedCommandMetadata("debug");

  assert.equal(metadata, DEBUG_RUNTIME_METADATA);

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, blueprintPrimaryManifestPath("debug"));
  assert.ok(entry.skillPath);
  assert.equal(entry.specPath, DEBUG_RUNTIME_METADATA.sourceId);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_mutate_index",
    "blueprint_artifact_report_write",
    "blueprint_config_get",
    "blueprint_project_status",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-debugger"]);
  assert.deepEqual(entry.blockedBy, []);

  const contract = await buildBlueprintCommandRuntimeContractResource("debug");

  assert.equal(contract.spec.path, DEBUG_RUNTIME_METADATA.sourceId);
  assert.equal(contract.runtimeReference.path, DEBUG_RUNTIME_METADATA.sourceId);
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "commands/blu-debug.toml",
    "skills/blueprint-debug/references/debug-runtime-contract.md"
  ]);
  assert.deepEqual(contract.skillInputs.effective, [
    "commands/blu-debug.toml",
    "skills/blueprint-debug/references/debug-runtime-contract.md"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.doesNotMatch(JSON.stringify(contract), /docs\/commands\/debug\.md/);
  assert.doesNotMatch(JSON.stringify(contract), /docs\/RUNTIME-REFERENCE\.md/);
});

test("debug runtime contract resource survives missing repository docs", async () => {
  const contract = await buildBlueprintCommandRuntimeContractResource("debug", {
    readRelativePath: async (relativePath) => {
      if (relativePath.startsWith("docs/")) {
        return null;
      }

      return readRelativePath(relativePath);
    }
  });

  assert.equal(contract.catalog.specPath, DEBUG_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec.path, DEBUG_RUNTIME_METADATA.sourceId);
  assert.equal(contract.runtimeReference.path, DEBUG_RUNTIME_METADATA.sourceId);
  assert.equal(
    contract.runtimeReference.commandSpecPath,
    DEBUG_RUNTIME_METADATA.sourceId
  );
  assert.deepEqual(contract.spec.requiredTools, [
    ...DEBUG_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.runtimeReference.exactMcpDestination, [
    ...DEBUG_RUNTIME_METADATA.runtimeReference.exactMcpDestination
  ]);
  assert.deepEqual(contract.skillInputs.effective, [
    "commands/blu-debug.toml",
    "skills/blueprint-debug/references/debug-runtime-contract.md"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});
