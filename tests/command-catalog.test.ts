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
  "cleanup"
] as const;

const BLOCKED_COMMANDS = ["do"] as const;
const LIST_PHASE_ASSUMPTIONS_MANIFEST = "commands/blu-list-phase-assumptions.toml";

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
    "blueprint_artifact_list",
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
  assert.deepEqual(catalog.commands["ui-phase"].availableOptionalAgents, [
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

test("blocked lifecycle and roadmap commands stay unroutable until substrate exists", async () => {
  const catalog = await blueprintCommandCatalog();

  for (const command of BLOCKED_COMMANDS) {
    const entry = catalog.commands[command];

    assert.equal(entry.implemented, false);
    assert.notEqual(entry.status, "implemented");
    assert.ok(entry.blockedBy.length > 0);
  }
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
    "blueprint_artifact_list",
    "blueprint_phase_locate",
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
    "blueprint_artifact_list",
    "blueprint_phase_locate",
    "blueprint_review_record",
    "blueprint_review_scope"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-reviewer"]);
  assert.deepEqual(entry.blockedBy, []);
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
    "blueprint_phase_plan_index",
    "blueprint_phase_plan_read",
    "blueprint_review_record"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
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
    "blueprint_phase_locate",
    "blueprint_review_load_findings",
    "blueprint_review_record",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-reviewer"]);
  assert.deepEqual(entry.blockedBy, []);
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
    "blueprint_artifact_list",
    "blueprint_artifact_report_write",
    "blueprint_artifact_summary_digest",
    "blueprint_roadmap_read",
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
