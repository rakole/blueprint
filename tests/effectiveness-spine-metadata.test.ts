import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

function extractBacktickedValues(
  markdown: string,
  pattern: RegExp,
  label: string
): string[] {
  const match = markdown.match(pattern);
  assert.ok(match, `Missing shared contract line for ${label}`);

  const normalizedLine = match[1]
    .replace(/^`<one of:\s*/, "")
    .replace(/>`$/, "");
  const values = [...normalizedLine.matchAll(/`([^`]+)`/g)].map((entry) => entry[1]);
  assert.ok(values.length > 0, `Missing shared contract values for ${label}`);

  return values;
}

function extractCommaSeparatedValues(
  markdown: string,
  pattern: RegExp,
  label: string
): string[] {
  const match = markdown.match(pattern);
  assert.ok(match, `Missing shared contract line for ${label}`);

  const values = match[1]
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  assert.ok(values.length > 0, `Missing shared contract values for ${label}`);

  return values;
}

const executionProfileValues = [
  "router",
  "interactive-read",
  "long-running-mutation",
  "high-risk-maintenance"
];
const stageValues = ["Resolve", "Read", "Decide", "Execute", "Persist", "Validate", "Route"];

type RoutedCommandFixture = {
  command: string;
  manifestPath: string;
};

const routedCommandFixtures: RoutedCommandFixture[] = [
  { command: "note", manifestPath: "commands/blu-note.toml" },
  { command: "add-todo", manifestPath: "commands/blu-add-todo.toml" },
  { command: "check-todos", manifestPath: "commands/blu-check-todos.toml" },
  { command: "add-backlog", manifestPath: "commands/blu-add-backlog.toml" },
  { command: "review-backlog", manifestPath: "commands/blu-review-backlog.toml" },
  { command: "explore", manifestPath: "commands/blu-explore.toml" },
  { command: "add-phase", manifestPath: "commands/blu-add-phase.toml" },
  { command: "insert-phase", manifestPath: "commands/blu-insert-phase.toml" },
  { command: "remove-phase", manifestPath: "commands/blu-remove-phase.toml" },
  {
    command: "plan-milestone-gaps",
    manifestPath: "commands/blu-plan-milestone-gaps.toml"
  },
  { command: "audit-milestone", manifestPath: "commands/blu-audit-milestone.toml" },
  { command: "complete-milestone", manifestPath: "commands/blu-complete-milestone.toml" },
  {
    command: "milestone-summary",
    manifestPath: "commands/blu-milestone-summary.toml"
  },
  { command: "new-milestone", manifestPath: "commands/blu-new-milestone.toml" }
];

function extractDistinctFollowUpCommands(markdown: string, command: string): string[] {
  const selfRoute = `/blu-${command}`;
  const referencedCommands = [
    ...new Set(
      [...markdown.matchAll(/\/blu-([a-z0-9-]+)/g)].map((entry) => entry[1])
    )
  ];

  return referencedCommands.filter((entry) => `/blu-${entry}` !== selfRoute);
}

test("shared effectiveness-spine metadata stays aligned across runtime-owned command surfaces", async () => {
  const [
    nextContract,
    fastContract,
    quickContract,
    cleanupContract,
    discoveryProfile,
    executeManifest
  ] = await Promise.all([
    buildBlueprintCommandRuntimeContractResource("next"),
    buildBlueprintCommandRuntimeContractResource("fast"),
    buildBlueprintCommandRuntimeContractResource("quick"),
    buildBlueprintCommandRuntimeContractResource("cleanup"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md"
      ),
      "utf8"
    ),
    readFile(path.join(repoRoot, "commands/blu-execute-phase.toml"), "utf8")
  ]);

  const runtimeProfiles = [
    nextContract.spec?.executionProfile,
    fastContract.spec?.executionProfile,
    quickContract.spec?.executionProfile,
    cleanupContract.spec?.executionProfile
  ];
  assert.deepEqual(runtimeProfiles, executionProfileValues, "Execution profile vocabulary drifted");

  const executeStages = extractBacktickedValues(
    executeManifest,
    /(`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`)/,
    "execute-phase stage vocabulary"
  );
  assert.deepEqual(executeStages, stageValues, "Stage vocabulary drifted");
  for (const stage of stageValues) {
    assert.match(discoveryProfile, new RegExp(`\`${stage}\``));
  }

  const executeStatusFields = extractCommaSeparatedValues(
    executeManifest,
    /(resolved scope, active stage, pending gate, execution mode, and next safe action)/i,
    "execute-phase in-flight status fields"
  ).map((value) => value.replace(/^and\s+/, ""));
  assert.deepEqual(executeStatusFields, [
    "resolved scope",
    "active stage",
    "pending gate",
    "execution mode",
    "next safe action"
  ]);
  for (const field of executeStatusFields) {
    assert.match(discoveryProfile, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

});

test("capture confirmation gates stay explicit across the shipped capture family", async () => {
  const [checkTodos, addBacklog, reviewBacklog, explore] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-check-todos.toml"), "utf8"),
    readFile(path.join(repoRoot, "commands/blu-add-backlog.toml"), "utf8"),
    readFile(path.join(repoRoot, "commands/blu-review-backlog.toml"), "utf8"),
    readFile(path.join(repoRoot, "commands/blu-explore.toml"), "utf8")
  ]);

  assert.match(
    checkTodos,
    /Prefer\s+`ask_user` tool for status-change confirmation/i
  );
  assert.match(
    addBacklog,
    /Prefer\s+`ask_user` tool for immediate stub-reservation confirmation/i
  );
  assert.match(addBacklog, /require explicit confirmation before writing anything/i);
  assert.match(
    reviewBacklog,
    /Prefer\s+`ask_user` tool for structured promote or remove decisions/i
  );
  assert.match(reviewBacklog, /keep as the default safe path/i);
  assert.match(
    explore,
    /Prefer Gemini CLI's built-in `ask_user` tool for the final routing confirmation/i
  );
  assert.match(explore, /require explicit confirmation before writing anything/i);
});

test("capture and roadmap follow-up routes stay implemented-only and distinct from self-routing", async () => {
  const [catalog, ...manifestFiles] = await Promise.all([
    blueprintCommandCatalog(),
    ...routedCommandFixtures.map(({ manifestPath }) =>
      readFile(path.join(repoRoot, manifestPath), "utf8")
    )
  ]);

  for (const [index, fixture] of routedCommandFixtures.entries()) {
    const followUpCommands = extractDistinctFollowUpCommands(
      manifestFiles[index],
      fixture.command
    );

    assert.ok(
      followUpCommands.length > 0,
      `${fixture.command} should reference at least one distinct follow-up command`
    );

    for (const followUpCommand of followUpCommands) {
      const entry = catalog.commands[followUpCommand];
      assert.ok(entry, `${fixture.command} follow-up ${followUpCommand} should exist in the catalog`);
      assert.equal(
        entry.declaredStatus,
        "implemented",
        `${fixture.command} follow-up ${followUpCommand} should stay declared implemented`
      );
      assert.equal(
        entry.status,
        "implemented",
        `${fixture.command} follow-up ${followUpCommand} should stay implemented at runtime`
      );
      assert.equal(
        entry.implemented,
        true,
        `${fixture.command} follow-up ${followUpCommand} should stay runnable`
      );
    }
  }
});
