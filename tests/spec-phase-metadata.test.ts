import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildBlueprintCommandRuntimeContractResource,
  listBlueprintCommandRuntimeContractCommands
} from "../src/mcp/command-resources.js";
import {
  SPEC_PHASE_RUNTIME_METADATA,
  getRuntimeOwnedCommandMetadata
} from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const specPhaseTools = [
  "blueprint_phase_locate",
  "blueprint_phase_context",
  "blueprint_roadmap_read",
  "blueprint_artifact_list",
  "blueprint_config_get",
  "blueprint_phase_artifact_read",
  "blueprint_phase_artifact_write",
  "blueprint_artifact_contract_read",
  "blueprint_state_load",
  "blueprint_state_update",
  "blueprint_command_catalog"
] as const;

const repoRoot = process.cwd();
const specPhaseManifestTools = specPhaseTools.map((tool) => `mcp_blueprint_${tool}`);

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("spec-phase runtime metadata is exported and discoverable", () => {
  const metadata = getRuntimeOwnedCommandMetadata("spec-phase");

  assert.ok(metadata);
  assert.equal(metadata, SPEC_PHASE_RUNTIME_METADATA);
  assert.equal(metadata.sourceId, "src/mcp/command-runtime-metadata.ts#spec-phase");
  assert.equal(metadata.catalog.wave, 1);
  assert.equal(metadata.catalog.family, "Core Lifecycle");
  assert.equal(metadata.catalog.primarySkill, "blueprint-phase-discovery");
  assert.equal(metadata.catalog.declaredStatus, "implemented");
  assert.match(metadata.catalog.risk, /spec/i);
  assert.doesNotMatch(metadata.catalog.risk, /gains spec support|non-routable|once/i);
});

test("spec-phase runtime metadata is implemented, root-routable, and runtime-owned", () => {
  const metadata = getRuntimeOwnedCommandMetadata("spec-phase");

  assert.ok(metadata);
  assert.deepEqual(metadata.requiredTools, [...specPhaseTools]);
  assert.deepEqual(metadata.optionalAgents, []);
  assert.deepEqual(metadata.requiredInputPaths, [
    "skills/blueprint-phase-discovery/references/spec-phase-runtime-contract.md"
  ]);
  assert.equal(metadata.spec.path, metadata.sourceId);
  assert.equal(metadata.spec.title, "`/blu-spec-phase`");
  assert.equal(metadata.spec.executionProfile, "long-running-mutation");
  assert.equal(metadata.spec.rootRoutable, true);
  assert.deepEqual(metadata.runtimeReference.exactMcpDestination, [...specPhaseTools]);
  assert.deepEqual(metadata.runtimeReference.optionalAgents, []);
  assert.deepEqual(metadata.runtimeReference.hookInvolvement, [
    "read-before-edit",
    ".blueprint write guard"
  ]);
  assert.deepEqual(metadata.runtimeReference.evidenceState, [
    "locked",
    "runtime-owned",
    "needs-behavior-audit"
  ]);
  assert.match(metadata.spec.reads.join("\n"), /existing spec/i);
  assert.match(metadata.spec.writes.join("\n"), /artifact spec/i);
  assert.match(metadata.runtimeReference.contractNotes, /implemented runtime-owned behavior/i);
  assert.match(metadata.runtimeReference.contractNotes, /existing-spec update\/view\/skip gate/i);
  assert.match(metadata.runtimeReference.contractNotes, /six-round Socratic loop/i);
  assert.match(metadata.runtimeReference.contractNotes, /blueprint_command_catalog/i);
  assert.match(
    metadata.runtimeReference.contractNotes,
    /missing spec as nonblocking for normal discuss\/research\/plan lifecycle/i
  );
  assert.doesNotMatch(metadata.runtimeReference.contractNotes, /planned and non-routable/i);
  assert.doesNotMatch(
    metadata.runtimeReference.contractNotes,
    /Keep \/blu-spec-phase declared planned and non-routable/i
  );
});

test("spec-phase runtime contract resource is advertised only after implemented catalog promotion", async () => {
  const catalog = await blueprintCommandCatalog();
  const contract = await buildBlueprintCommandRuntimeContractResource("spec-phase");
  const advertisedCommands = await listBlueprintCommandRuntimeContractCommands();

  assert.equal(catalog.commands["spec-phase"]?.status, "implemented");
  assert.equal(catalog.commands["spec-phase"]?.implemented, true);
  assert.deepEqual(catalog.commands["spec-phase"]?.blockedBy, []);
  assert.ok(advertisedCommands.includes("spec-phase"));
  assert.equal(contract.spec?.path, SPEC_PHASE_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec?.rootRoutable, true);
  assert.equal(contract.runtimeReference?.path, SPEC_PHASE_RUNTIME_METADATA.sourceId);
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    SPEC_PHASE_RUNTIME_METADATA.sourceId
  );
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [...specPhaseTools]);
  assert.deepEqual(contract.skillInputs, {
    skill: "blueprint-phase-discovery",
    shared: [],
    commandSpecific: [
      "skills/blueprint-phase-discovery/references/spec-phase-runtime-contract.md"
    ],
    effective: [
      "skills/blueprint-phase-discovery/references/spec-phase-runtime-contract.md"
    ]
  });
});

test("spec-phase manifest exposes only the allowed Blueprint MCP runtime FQNs", async () => {
  const manifest = await readRepoFile("commands/blu-spec-phase.toml");
  const manifestToolMatches = manifest.match(/mcp_blueprint_[a-z0-9_]+/g) ?? [];
  const manifestTools = [...new Set(manifestToolMatches)].sort();

  assert.deepEqual(manifestTools, [...specPhaseManifestTools].sort());
});
