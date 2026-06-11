import assert from "node:assert/strict";
import { constants as fsConstants } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { blueprintLightweightPreflight } from "../../src/mcp/tools/lightweight.js";
import { createGitRepo } from "../helpers/git-fixtures.js";
import {
  buildLightweightCommandPacket,
  type LightweightCommandName,
  type LightweightCommandPacket,
} from "./lightweight-command-packet.js";

const repoRoot = process.cwd();
const scenarioFixturePath = path.join(
  repoRoot,
  "tests/fixtures/prompt-eval/lightweight/scenarios.json",
);
const healthFixtureRoot = path.join(
  repoRoot,
  "tests/fixtures/help-progress-health",
);

type ScenarioFixtureRepo = "initialized-repo" | "partial-repo" | "uninitialized-repo";
type ScenarioMode = "fast" | "quick";
type ScenarioRoute =
  | "fast"
  | "quick"
  | "debug"
  | "plan-phase"
  | "health"
  | "new-project"
  | "clarify";
type HealthGate = "pass" | "route-health" | "route-new-project";
type OverwriteGate = "none" | "requires-confirmation" | "force-bypassed";
type ClarityGate = "pass" | "requires-clarification";
type ProjectHealth = "healthy" | "partial" | "uninitialized" | "unhealthy";
type ContractExpectation =
  | "validation-skipped-reason"
  | "research-flag"
  | "validate-flag"
  | "full-flag"
  | "no-subagents-default"
  | "research-subagents-enabled"
  | "full-inline-fallback"
  | "verifier-policy"
  | "session-local-tracker"
  | "no-generic-substitutes";

type ScenarioDefinition = {
  id: string;
  fixture: ScenarioFixtureRepo;
  mode: ScenarioMode;
  taskText: string;
  flags?: string[];
  packet?: LightweightCommandName;
  contractExpectation?: ContractExpectation;
  setup?: {
    existingQuickReport?: boolean;
    workflowSubagents?: boolean;
  };
  expect: {
    route: ScenarioRoute;
    projectHealth: ProjectHealth;
    initialized: boolean;
    gates: {
      healthGate: HealthGate;
      overwriteGate: OverwriteGate;
      clarityGate: ClarityGate;
    };
    requiredGates: string[];
    validationBudget: "none" | "cheap" | "ask" | "route";
    allowedWrites?: {
      includes?: string[];
      excludes?: string[];
    };
    nextSafeAction?: string;
    nextSafeActionImplementedOnly?: boolean;
    workflowSubagents?: boolean;
  };
};

type ScenarioFixtureFile = {
  schemaVersion: string;
  scenarios: ScenarioDefinition[];
};

const CONTRACT_EXPECTATION_CHECKS: Record<ContractExpectation, (packet: LightweightCommandPacket) => void> =
  {
    "validation-skipped-reason": (packet) => {
      assert.match(packet.promptSurfaceText, /validation status/i);
      assert.match(packet.promptSurfaceText, /skipped reason/i);
      assert.match(packet.promptSurfaceText, /repair-attempt outcome/i);
      assert.ok(packet.finalResponseRequirements.some((entry) => /skipped/i.test(entry)));
    },
    "research-flag": (packet) => {
      assert.match(packet.promptSurfaceText, /--research/i);
      assert.match(packet.promptSurfaceText, /pre-authorization/i);
    },
    "validate-flag": (packet) => {
      assert.match(packet.promptSurfaceText, /--validate/i);
      assert.match(packet.promptSurfaceText, /run cheap validation by default/i);
    },
    "full-flag": (packet) => {
      assert.match(packet.promptSurfaceText, /--full/i);
      assert.match(packet.promptSurfaceText, /pre-authorization/i);
    },
    "no-subagents-default": (packet) => {
      assert.match(packet.promptSurfaceText, /Use no subagents by default/i);
      assert.match(
        packet.promptSurfaceText,
        /Keep the run inline unless a Blueprint subagent clearly earns its coordination cost/i,
      );
    },
    "research-subagents-enabled": (packet) => {
      assert.match(
        packet.promptSurfaceText,
        /use `blueprint-researcher` only when `--research` or `--full` is present, the task touches an unfamiliar repo area/i,
      );
      assert.match(packet.promptSurfaceText, /`workflow\.subagents` is enabled/i);
    },
    "full-inline-fallback": (packet) => {
      assert.match(packet.promptSurfaceText, /--full/i);
      assert.match(
        packet.promptSurfaceText,
        /if `workflow\.subagents` is disabled or the Blueprint agents are unavailable, keep the quick run inline/i,
      );
    },
    "verifier-policy": (packet) => {
      assert.match(
        packet.promptSurfaceText,
        /use `blueprint-verifier` only when `--validate` or `--full` is present, touched files are greater than 2, the change is risky, or validation failed once/i,
      );
    },
    "session-local-tracker": (packet) => {
      assert.match(packet.promptSurfaceText, /tracker-eligible/i);
      assert.match(packet.promptSurfaceText, /do not use tracker as a saved plan/i);
      assert.match(packet.promptSurfaceText, /do not use tracker or subagents to widen scope/i);
    },
    "no-generic-substitutes": (packet) => {
      assert.match(
        packet.promptSurfaceText,
        /do not use generic helper agents, browser-only agents, shell-only agents, or web-search-only substitutes/i,
      );
    },
  };

async function readScenarioFixture(): Promise<ScenarioFixtureFile> {
  return JSON.parse(await readFile(scenarioFixturePath, "utf8")) as ScenarioFixtureFile;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyFixtureContents(sourcePath: string, targetPath: string): Promise<void> {
  const entries = await readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const sourceEntry = path.join(sourcePath, entry.name);
    const targetEntry = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      await mkdir(targetEntry, { recursive: true });
      await copyFixtureContents(sourceEntry, targetEntry);
      continue;
    }

    const sourceStats = await stat(sourceEntry);
    await mkdir(path.dirname(targetEntry), { recursive: true });
    await copyFile(sourceEntry, targetEntry);
    await import("node:fs/promises").then(({ chmod }) => chmod(targetEntry, sourceStats.mode));
  }
}

async function createRepoFromFixture(fixtureName: ScenarioFixtureRepo): Promise<string> {
  const repoPath = await createGitRepo("blueprint-lightweight-routing-");
  const sourcePath = path.join(healthFixtureRoot, fixtureName);

  if (await pathExists(sourcePath)) {
    await copyFixtureContents(sourcePath, repoPath);
  }

  return repoPath;
}

async function setWorkflowSubagents(repoPath: string, enabled: boolean): Promise<void> {
  const configPath = path.join(repoPath, ".blueprint/config.json");
  const config = JSON.parse(await readFile(configPath, "utf8")) as {
    workflow?: Record<string, unknown>;
  };

  config.workflow = {
    ...(config.workflow ?? {}),
    subagents: enabled,
  };

  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

async function createExistingQuickReport(repoPath: string): Promise<void> {
  const reportPath = path.join(repoPath, ".blueprint/reports/quick-run-latest.md");
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, "# Quick Run Latest\n", "utf8");
}

async function prepareScenarioRepo(scenario: ScenarioDefinition): Promise<string> {
  const repoPath = await createRepoFromFixture(scenario.fixture);

  if (typeof scenario.setup?.workflowSubagents === "boolean") {
    await setWorkflowSubagents(repoPath, scenario.setup.workflowSubagents);
  }

  if (scenario.setup?.existingQuickReport) {
    await createExistingQuickReport(repoPath);
  }

  return repoPath;
}

function assertNoRawBlueprintWrites(allowedWrites: string[], scenarioId: string): void {
  for (const allowedWrite of allowedWrites) {
    if (!allowedWrite.includes(".blueprint/")) {
      continue;
    }

    assert.match(
      allowedWrite,
      /\bthrough\b/i,
      `${scenarioId} should keep Blueprint persistence behind MCP-owned writes`,
    );
  }
}

function assertAllowedWritesExpectations(
  allowedWrites: string[],
  expected: ScenarioDefinition["expect"]["allowedWrites"],
  scenarioId: string,
): void {
  if (!expected) {
    return;
  }

  for (const allowedWrite of expected.includes ?? []) {
    assert.ok(
      allowedWrites.includes(allowedWrite),
      `${scenarioId} should allow ${allowedWrite}`,
    );
  }

  for (const forbiddenWrite of expected.excludes ?? []) {
    assert.ok(
      !allowedWrites.includes(forbiddenWrite),
      `${scenarioId} should not allow ${forbiddenWrite}`,
    );
  }
}

function assertImplementedOnlyNextAction(
  nextSafeAction: string,
  implementedRoutes: string[],
  scenarioId: string,
): void {
  assert.ok(
    implementedRoutes.includes(nextSafeAction),
    `${scenarioId} nextSafeAction ${nextSafeAction} must stay implemented-only`,
  );
  assert.notEqual(nextSafeAction, "/blu-do");
}

function assertPacketPersistenceBoundaries(
  packet: LightweightCommandPacket,
  scenarioId: string,
): void {
  if (packet.command === "fast") {
    assert.deepEqual(packet.allowedPersistenceTools, ["blueprint_state_update"]);
    assert.ok(packet.requiredTools.includes("blueprint_state_update"));
    assert.ok(!packet.requiredTools.includes("blueprint_artifact_report_write"));
    assert.ok(
      packet.forbiddenPersistencePatterns.some((entry) => /ad hoc Blueprint persistence/i.test(entry)),
      `${scenarioId} should keep raw Blueprint persistence forbidden`,
    );
    return;
  }

  assert.deepEqual(packet.allowedPersistenceTools, [
    "blueprint_artifact_report_write",
    "blueprint_state_update",
  ]);
  assert.ok(packet.requiredTools.includes("blueprint_artifact_report_write"));
  assert.ok(packet.requiredTools.includes("blueprint_state_update"));
  assert.ok(!packet.requiredTools.includes("blueprint_phase_summary_write"));
  assert.ok(!packet.requiredTools.includes("blueprint_phase_plan_write"));
  assert.ok(
    packet.forbiddenPersistencePatterns.some((entry) =>
      /\.blueprint\/reports\/quick-run-latest\.md/.test(entry),
    ),
    `${scenarioId} should forbid hand-addressing the quick report path`,
  );
}

test("lightweight routing scenarios stay deterministic across classifier and preflight boundaries", async (t) => {
  const [{ scenarios, schemaVersion }, fastPacket, quickPacket] = await Promise.all([
    readScenarioFixture(),
    buildLightweightCommandPacket("fast"),
    buildLightweightCommandPacket("quick"),
  ]);
  const packets: Record<LightweightCommandName, LightweightCommandPacket> = {
    fast: fastPacket,
    quick: quickPacket,
  };

  assert.equal(
    schemaVersion,
    "blueprint.prompt-eval.lightweight-routing-scenarios.v1",
  );

  for (const scenario of scenarios) {
    const repoPath = await prepareScenarioRepo(scenario);
    t.after(async () => rm(path.dirname(repoPath), { recursive: true, force: true }));

    const result = await blueprintLightweightPreflight({
      cwd: repoPath,
      mode: scenario.mode,
      taskText: scenario.taskText,
      flags: scenario.flags,
    });

    assert.equal(result.classification.route, scenario.expect.route, scenario.id);
    assert.equal(result.projectStatus.health, scenario.expect.projectHealth, scenario.id);
    assert.equal(result.projectStatus.initialized, scenario.expect.initialized, scenario.id);
    assert.equal(result.gates.healthGate, scenario.expect.gates.healthGate, scenario.id);
    assert.equal(result.gates.overwriteGate, scenario.expect.gates.overwriteGate, scenario.id);
    assert.equal(result.gates.clarityGate, scenario.expect.gates.clarityGate, scenario.id);
    assert.deepEqual(result.classification.requiredGates, scenario.expect.requiredGates, scenario.id);
    assert.equal(
      result.classification.validationBudget,
      scenario.expect.validationBudget,
      scenario.id,
    );

    assertNoRawBlueprintWrites(result.classification.allowedWrites, scenario.id);
    assertAllowedWritesExpectations(
      result.classification.allowedWrites,
      scenario.expect.allowedWrites,
      scenario.id,
    );

    if (scenario.expect.nextSafeAction) {
      assert.equal(result.nextSafeAction, scenario.expect.nextSafeAction, scenario.id);
    }

    assertImplementedOnlyNextAction(result.nextSafeAction, result.implementedRoutes, scenario.id);

    if (scenario.expect.nextSafeActionImplementedOnly) {
      assert.match(result.nextSafeAction, /^\/blu-/, scenario.id);
    }

    if (typeof scenario.expect.workflowSubagents === "boolean") {
      assert.equal(
        result.effectiveConfig?.workflow?.subagents,
        scenario.expect.workflowSubagents,
        scenario.id,
      );
    }

    if (scenario.packet) {
      const packet = packets[scenario.packet];
      assertPacketPersistenceBoundaries(packet, scenario.id);
    }

    if (scenario.contractExpectation) {
      CONTRACT_EXPECTATION_CHECKS[scenario.contractExpectation](quickPacket);
    }
  }
});
