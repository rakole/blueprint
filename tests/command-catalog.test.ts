import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

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
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
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
const RUNTIME_CONTRACT_EXCLUDED_COMMANDS = new Set(["review"]);

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

  const listPhaseAssumptions = catalog.commands["list-phase-assumptions"];

  assert.equal(listPhaseAssumptions.primarySkill, "blueprint-phase-discovery");
  assert.equal(listPhaseAssumptions.requiredToolsSatisfied, true);
  assert.deepEqual(listPhaseAssumptions.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_roadmap_read",
    "blueprint_project_status"
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
    assert.equal(listPhaseAssumptions.specPath, "docs/commands/list-phase-assumptions.md");
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
    assert.equal(listPhaseAssumptions.specPath, "docs/commands/list-phase-assumptions.md");
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
        entry.implemented === true &&
        !RUNTIME_CONTRACT_EXCLUDED_COMMANDS.has(commandName)
    )
    .map(([commandName]) => commandName)
    .sort();
  const contract = await buildBlueprintCommandRuntimeContractResource("help");
  const entry = catalog.commands.help;

  assert.deepEqual(advertisedCommands, expectedAdvertisedCommands);
  assert.ok(advertisedCommands.includes("help"));
  assert.ok(advertisedCommands.includes("impact"));
  assert.ok(!advertisedCommands.includes("do"));
  assert.ok(!advertisedCommands.includes("review"));

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
  assert.equal(contract.spec.path, "docs/commands/help.md");
  assert.equal(contract.spec.wave, 0);
  assert.equal(contract.spec.family, "Foundation");
  assert.equal(contract.spec.executionProfile, "router");
  assert.equal(contract.spec.rootRoutable, true);
  assert.equal(contract.spec.primarySkill, "blueprint-router");
  assert.deepEqual(contract.spec.requiredTools, entry.requiredTools);
  assert.deepEqual(contract.spec.optionalSubagents, []);
  assert.match(contract.spec.purpose ?? "", /showing available Blueprint commands/i);
  assert.deepEqual(contract.spec.writes, []);
  assert.deepEqual(contract.skillInputs, {
    skill: "blueprint-router",
    shared: [
      "docs/commands/root-router.md",
      "docs/commands/help.md",
      "docs/commands/progress.md",
      "docs/commands/next.md",
      "docs/commands/do.md",
      "docs/RUNTIME-REFERENCE.md"
    ],
    commandSpecific: [],
    effective: [
      "docs/commands/root-router.md",
      "docs/commands/help.md",
      "docs/commands/progress.md",
      "docs/commands/next.md",
      "docs/commands/do.md",
      "docs/RUNTIME-REFERENCE.md"
    ]
  });

  assert.ok(contract.runtimeReference);
  assert.equal(contract.runtimeReference.path, "docs/RUNTIME-REFERENCE.md");
  assert.equal(contract.runtimeReference.wave, 0);
  assert.equal(contract.runtimeReference.waveTitle, "Foundation");
  assert.equal(contract.runtimeReference.command, "help");
  assert.equal(contract.runtimeReference.commandSpecPath, "docs/commands/help.md");
  assert.equal(contract.runtimeReference.primarySkill, "blueprint-router");
  assert.deepEqual(contract.runtimeReference.exactMcpDestination, entry.requiredTools);
  assert.deepEqual(contract.runtimeReference.optionalAgents, []);
  assert.deepEqual(contract.runtimeReference.hookInvolvement, []);
  assert.match(contract.runtimeReference.contractNotes ?? "", /never present planned or blocked commands as runnable/i);
  assert.deepEqual(contract.runtimeReference.evidenceState, [
    "locked",
    "docs-aligned",
    "needs-behavior-audit"
  ]);

  await assert.rejects(
    buildBlueprintCommandRuntimeContractResource("review"),
    /Blueprint runtime-contract resources intentionally exclude this command today: review/
  );

  await assert.rejects(
    buildBlueprintCommandRuntimeContractResource("do"),
    /Blueprint runtime-contract resources are available only for implemented commands: do/
  );
});

test("discovery runtime contracts expose command-scoped effective skill inputs", async () => {
  const sharedInputs = ["docs/ARTIFACT-SCHEMA.md", "docs/MCP-TOOLS.md"];
  const expectations = [
    {
      command: "discuss-phase",
      ownDoc: "docs/commands/discuss-phase.md",
      extraInputs: [
        "skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md"
      ],
      siblingDocs: [
        "docs/commands/research-phase.md",
        "docs/commands/ui-phase.md",
        "docs/commands/list-phase-assumptions.md"
      ]
    },
    {
      command: "research-phase",
      ownDoc: "docs/commands/research-phase.md",
      extraInputs: [
        "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md"
      ],
      siblingDocs: [
        "docs/commands/discuss-phase.md",
        "docs/commands/ui-phase.md",
        "docs/commands/list-phase-assumptions.md"
      ]
    },
    {
      command: "ui-phase",
      ownDoc: "docs/commands/ui-phase.md",
      extraInputs: [
        "skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md"
      ],
      siblingDocs: [
        "docs/commands/discuss-phase.md",
        "docs/commands/research-phase.md",
        "docs/commands/list-phase-assumptions.md"
      ]
    },
    {
      command: "list-phase-assumptions",
      ownDoc: "docs/commands/list-phase-assumptions.md",
      extraInputs: [],
      siblingDocs: [
        "docs/commands/discuss-phase.md",
        "docs/commands/research-phase.md",
        "docs/commands/ui-phase.md"
      ]
    }
  ] as const;

  for (const expectation of expectations) {
    const contract = await buildBlueprintCommandRuntimeContractResource(expectation.command);

    assert.deepEqual(contract.skillInputs.shared, sharedInputs);
    assert.deepEqual(contract.skillInputs.commandSpecific, [
      expectation.ownDoc,
      ...expectation.extraInputs
    ]);
    assert.deepEqual(contract.skillInputs.effective, [
      ...sharedInputs,
      expectation.ownDoc,
      ...expectation.extraInputs
    ]);

    for (const siblingDoc of expectation.siblingDocs) {
      assert.equal(contract.skillInputs.effective.includes(siblingDoc), false);
    }
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
  assert.ok(entry.specPath);
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

test("map-codebase is implemented once the brownfield mapping contract and tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["map-codebase"];
  const commandDoc = await readRelativePath("docs/commands/map-codebase.md");

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu-map-codebase.toml");
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_contract_read",
    "blueprint_artifact_list",
    "blueprint_artifact_scaffold",
    "blueprint_artifact_summary_digest",
    "blueprint_artifact_validate",
    "blueprint_codebase_artifact_write",
    "blueprint_project_status"
  ].sort());
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-mapper"]);
  assert.deepEqual(entry.blockedBy, []);
  assert.match(commandDoc ?? "", /\| Execution profile \| `long-running-mutation` \|/);
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

test("impact is implemented once its additive command substrate is complete", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands.impact;

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-impact.toml");
  assert.equal(entry.skillPath, "skills/blueprint-impact/SKILL.md");
  assert.equal(entry.specPath, "docs/commands/impact.md");
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.deepEqual(entry.requiredTools, [
    "blueprint_impact_config_get",
    "blueprint_impact_scope_resolve",
    "blueprint_impact_context_load",
    "blueprint_impact_analyze",
    "blueprint_impact_report_write",
    "blueprint_impact_output_render"
  ]);
  assert.deepEqual(entry.blockedBy, []);
  assert.doesNotMatch(entry.blockedBy.join("\n"), /Missing required MCP tool: blueprint_impact_/);
});

test("plan-phase is implemented once manifest, skill, and plan MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["plan-phase"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual(entry.availableOptionalAgents.sort(), [
    "blueprint-checker",
    "blueprint-planner"
  ]);
  assert.deepEqual(entry.blockedBy, []);
});

test("execute-phase is implemented once manifest, skill, and execution summary MCP tools exist", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["execute-phase"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.ok(entry.manifestPath);
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
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
    "blueprint_phase_locate",
    "blueprint_phase_plan_index",
    "blueprint_phase_plan_read",
    "blueprint_review_record"
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
    "blueprint_phase_locate",
    "blueprint_review_record"
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
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_contract_read",
    "blueprint_artifact_list",
    "blueprint_config_get",
    "blueprint_phase_locate",
    "blueprint_review_record",
    "blueprint_review_scope"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-reviewer"]);
  assert.deepEqual(entry.blockedBy, []);
});

test("code-review runtime reference keeps the long-running review posture explicit", async () => {
  const runtimeReference = await readRelativePath("docs/RUNTIME-REFERENCE.md");

  assert.ok(runtimeReference);
  assert.match(
    runtimeReference,
    /\| `code-review` \| `docs\/commands\/code-review\.md` \| `blueprint-review` \| `blueprint_config_get`<br>`blueprint_phase_locate`<br>`blueprint_artifact_list`<br>`blueprint_artifact_contract_read`<br>`blueprint_review_scope`<br>`blueprint_review_record` \| `blueprint-reviewer` \|/
  );
  assert.match(runtimeReference, /Long-running-mutation profile for deterministic phase-scoped review/i);
  assert.match(
    runtimeReference,
    /Resolve\/Read\/Decide\/Execute\/Persist\/Validate\/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible/i
  );
  assert.match(runtimeReference, /use Gemini-native `update_topic` and `write_todos` for non-trivial review runs/i);
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
    "blueprint_phase_plan_index",
    "blueprint_phase_plan_read",
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
    "blueprint_artifact_contract_read",
    "blueprint_phase_locate",
    "blueprint_review_load_findings",
    "blueprint_review_record",
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
    /### `XX-REVIEW-FIX\.md`[\s\S]*\*\*Status:\*\* APPLIED\|PARTIAL\|SKIPPED[\s\S]*## Findings Addressed[\s\S]*## Changes Made[\s\S]*## Verification[\s\S]*## Follow-Ups[\s\S]*## Next Safe Action/
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
    /\| `code-review-fix` \| `docs\/commands\/code-review-fix\.md` \| `blueprint-review` \| `blueprint_phase_locate`<br>`blueprint_review_load_findings`<br>`blueprint_artifact_contract_read`<br>`blueprint_review_record`<br>`blueprint_state_update` \| `blueprint-reviewer` \|/
  );
  assert.match(
    runtimeReference,
    /No auto-fixer behavior, implicit commits or branches, or hidden iterative re-review loops are shipped\./
  );
  assert.match(
    runtimeReference,
    /\| `audit-fix` \| `docs\/commands\/audit-fix\.md` \| `blueprint-review` \| `blueprint_phase_locate`<br>`blueprint_artifact_list`<br>`blueprint_review_scope`<br>`blueprint_artifact_report_write`<br>`blueprint_artifact_mutate_index`<br>`blueprint_state_update` \| `blueprint-reviewer`<br>`blueprint-verifier` \|/
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
    migrationDoc,
    /`code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `review`, `ui-review`, `docs-update`, `add-tests`, `pr-branch`, `ship`, and `undo` are currently shipped in this wave\./
  );
  assert.match(
    migrationDoc,
    /\| `code-review-fix` \| `commands\/gsd\/code-review-fix\.md` \| GSD has an upstream workflow file \| `docs\/commands\/code-review-fix\.md` \| `blueprint-review` \| `blueprint_phase_locate`<br>`blueprint_review_load_findings`<br>`blueprint_review_record`<br>`blueprint_state_update` \| `blueprint-reviewer` \|/
  );
  assert.match(
    migrationDoc,
    /do not claim the planned `blueprint-fixer`, per-fix commits, or an implicit auto re-review loop as shipped Blueprint behavior\./
  );
  assert.match(
    migrationDoc,
    /\| `audit-fix` \| `commands\/gsd\/audit-fix\.md` \| GSD has an upstream workflow file \| `docs\/commands\/audit-fix\.md` \| `blueprint-review` \| `blueprint_phase_locate`<br>`blueprint_artifact_list`<br>`blueprint_review_scope`<br>`blueprint_artifact_report_write`<br>`blueprint_artifact_mutate_index`<br>`blueprint_state_update` \| `blueprint-reviewer`<br>`blueprint-verifier` \|/
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
    "blueprint_artifact_list",
    "blueprint_artifact_mutate_index",
    "blueprint_artifact_report_write",
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
    "blueprint_artifact_contract_read",
    "blueprint_phase_validation_write",
    "blueprint_artifact_list",
    "blueprint_artifact_validate",
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
    "blueprint_project_status"
  ]);
  assert.deepEqual(entry.availableOptionalAgents.sort(), [
    "blueprint-doc-verifier",
    "blueprint-doc-writer"
  ]);
  assert.deepEqual(entry.blockedBy, []);
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

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, blueprintPrimaryManifestPath("quick"));
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_report_write",
    "blueprint_command_catalog",
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

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, blueprintPrimaryManifestPath("fast"));
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
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

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, blueprintPrimaryManifestPath("debug"));
  assert.ok(entry.skillPath);
  assert.ok(entry.specPath);
  assert.deepEqual([...entry.requiredTools].sort(), [
    "blueprint_artifact_mutate_index",
    "blueprint_artifact_report_write",
    "blueprint_project_status",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-debugger"]);
  assert.deepEqual(entry.blockedBy, []);
});
