import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import {
  BLUEPRINT_MUTATION_TOOL_NAMES,
  blueprintToolNames,
  createToolResponseContent
} from "../src/mcp/server.js";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertMatchesAll(content: string, patterns: RegExp[]): void {
  for (const pattern of patterns) {
    assert.match(content, pattern);
  }
}

test("execute-phase manifest stays thin while keeping the core execution invariants explicit", async () => {
  const commandFile = await readRepoFile("commands/blu-execute-phase.toml");

  assert.match(commandFile, /Use the `blueprint-phase-execution` skill/);
  assert.match(commandFile, /long-running stages/);
  assert.match(commandFile, /`Resolve`[\s\S]*`Read`[\s\S]*`Route`/);
  assert.match(commandFile, /session id, selected\/current plan, apply and verification attempt/i);
  assert.match(commandFile, /no optional executor|Do not delegate write ownership/i);

  const requiredTools = [
    "blueprint_phase_execution_prepare",
    "blueprint_phase_execution_apply",
    "blueprint_phase_execution_verify",
    "blueprint_phase_execution_finalize"
  ];

  for (const tool of requiredTools) {
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(tool)));
  }

  assertMatchesAll(commandFile, [
    /previewFingerprint/,
    /CLAIM BLUEPRINT PHASE EXECUTION/,
    /overwriteConfirmedPlanIds/,
    /exact claimed or latest receipted preimage/i,
    /at most one bounded repair/i,
    /receipt-derived `BLOCKED` summary/i,
    /mode: "resume"/,
    /never persist execute-phase reports/i,
    /does not complete the phase/i,
    /\/blu-validate-phase/,
    /\/blu-progress/
  ]);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-execution\.md|agents\/blueprint-executor\.md/);
});

test("execute-phase control tools are registered, mutation-logged, and public-response safe", () => {
  const requiredTools = [
    "blueprint_phase_execution_prepare",
    "blueprint_phase_execution_apply",
    "blueprint_phase_execution_verify",
    "blueprint_phase_execution_finalize"
  ];
  for (const toolName of requiredTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.ok(
      BLUEPRINT_MUTATION_TOOL_NAMES.has(toolName),
      `${toolName} should use durable mutation-failure logging`
    );
  }

  const publicResult = JSON.parse(createToolResponseContent(
    "blueprint_phase_execution_prepare",
    {
      status: "stale",
      ready: false,
      sessionId: "session-01",
      fingerprint: "a".repeat(64),
      blockers: ["authority drifted"]
    }
  )[0]!.text) as Record<string, unknown>;
  assert.equal(publicResult.status, "stale");
  assert.equal(publicResult.sessionId, "session-01");
  assert.deepEqual(publicResult.blockers, ["authority drifted"]);
});

test("execute-phase skill bundle points the command at execute-specific references instead of quick or fast detail", async () => {
  const skillFile = await readRepoFile("skills/blueprint-phase-execution/SKILL.md");

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /input_bundles:/);
  assert.match(skillFile, /"\/blu-execute-phase":/);
  assert.match(
    skillFile,
    /skills\/blueprint-phase-execution\/references\/execute-phase-runtime-contract\.md/
  );
  assert.match(
    skillFile,
    /skills\/blueprint-phase-execution\/references\/long-running-execution-profile\.md/
  );
  assert.match(
    skillFile,
    /not inline[\s\S]*`\/blu-quick`[\s\S]*`\/blu-fast`[\s\S]*`\/blu-execute-phase` context/i
  );
  assert.match(skillFile, /four execute-phase control\s+tools/i);
  assert.match(skillFile, /no optional write agent/i);
  assert.match(skillFile, /one mandatory second verification/i);
});

test("execute-phase runtime-owned sources keep the important invariants concise", async () => {
  const [runtimeContract, contractResource] = await Promise.all([
    readRepoFile("skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md"),
    buildBlueprintCommandRuntimeContractResource("execute-phase")
  ]);

  assert.equal(contractResource.spec?.executionProfile, "long-running-mutation");
  assert.equal(
    contractResource.skillInputs.commandSpecific.includes(
      "skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md"
    ),
    true
  );
  assert.match(runtimeContract, /blueprint_phase_execution_prepare/i);
  assert.match(runtimeContract, /immutable\s+selection\/authority packet/i);
  assert.match(runtimeContract, /CLAIM BLUEPRINT PHASE EXECUTION/);
  assert.match(runtimeContract, /never persist an execute-phase report/i);
  assert.match(runtimeContract, /blueprint_phase_execution_apply/i);
  assert.match(runtimeContract, /blueprint_phase_execution_verify/i);
  assert.match(runtimeContract, /blueprint_phase_execution_finalize/i);
});

test("execute-phase runtime contract carries the rich execution sequencing and carry-forward rules", async () => {
  const runtimeContract = await readRepoFile(
    "skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md"
  );

  assertMatchesAll(runtimeContract, [
    /behavior authority for `\/blu-execute-phase`/i,
    /## Control Plane/,
    /phase_execution_prepare[\s\S]*phase_execution_apply[\s\S]*phase_execution_verify[\s\S]*phase_execution_finalize/i,
    /exact preview fingerprint/i,
    /lower-wave pending work[\s\S]*absolute blockers/i,
    /sequentially and in order/i,
    /no optional executor/i,
    /pinned workers retain the original parent directory identity/i,
    /one repair/i,
    /verification attempt[\s\S]*interrupted/i,
    /receipt-derived/i,
    /summary index[\s\S]*artifact validation[\s\S]*STATE/i,
    /Every boundary is checkpointed/i,
    /## Resume/,
    /mixed interruption state/i,
    /never persist an execute-phase report/i,
    /external service/i,
    /pending plan debt[\s\S]*\/blu-execute-phase <phase>/i,
    /no remaining execution debt[\s\S]*\/blu-validate-phase <phase>/i,
    /\/blu-validate-phase/,
    /\/blu-progress/
  ]);
});

test("execute-phase runtime contract resource is owned by runtime metadata, not docs", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("execute-phase");

  assert.ok(metadata);

  const contract = await buildBlueprintCommandRuntimeContractResource("execute-phase");

  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec.path, metadata.sourceId);
  assert.equal(contract.runtimeReference.path, metadata.sourceId);
  assert.equal(contract.runtimeReference.commandSpecPath, metadata.sourceId);
  assert.equal(contract.spec.primarySkill, "blueprint-phase-execution");
  assert.deepEqual(contract.spec.requiredTools, [...metadata.requiredTools]);
  assert.deepEqual(contract.runtimeReference.exactMcpDestination, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(contract.spec.optionalSubagents, []);
  assert.deepEqual(contract.runtimeReference.optionalAgents, []);
  assert.deepEqual(contract.runtimeReference.evidenceState, [
    "locked",
    "runtime-owned",
    "behavior-audited"
  ]);
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "commands/blu-execute-phase.toml",
    "skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md",
    "skills/blueprint-phase-execution/references/long-running-execution-profile.md"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /blueprint_phase_execution_prepare is the sole preview, claim, selection, approval, freshness, and resume authority/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /route every repo write through blueprint_phase_execution_apply/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /run only packet-bound verification through blueprint_phase_execution_verify/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /persist receipt-derived COMPLETED or BLOCKED summaries only through blueprint_phase_execution_finalize/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /summary write, summary index, artifact validation, synced state/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /next-plan advancement as an idempotent stage machine/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /never persist execute-phase reports/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /claim phase completion before validation and verification evidence exists/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /skills\/blueprint-phase-execution\/references\/execute-phase-runtime-contract\.md/i
  );
});
