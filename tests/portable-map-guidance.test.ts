import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";

import {MAP_CODEBASE_RUNTIME_METADATA} from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

async function read(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("map-codebase guidance describes portable v1 as explicit opt-in", async () => {
  const [command, skill, reference, agent, foundation] = await Promise.all([
    read("commands/blu-map-codebase.toml"),
    read("skills/blueprint-map/SKILL.md"),
    read("skills/blueprint-map/references/map-runtime-contract.md"),
    read("agents/blueprint-mapper.md"),
    read("agent-docs/commands/foundation.md")
  ]);
  const guidance = [command, skill, reference, agent, foundation].join("\n");

  assert.match(command, /explicit portable v1 opt-in/i);
  assert.match(command, /`--portable`/);
  assert.match(guidance, /formatVersion:\s*1/);
  for (const intent of ["new", "upgrade", "refresh", "repair"]) {
    assert.match(guidance, new RegExp(`\\b${intent}\\b`));
  }
  for (const field of ["operationId", "generationId", "cursor", "previousIndexHash", "targetHashes", "observedMarkerHash"]) {
    assert.match(guidance, new RegExp(`\\b${field}\\b`));
  }
  assert.match(guidance, /complete (?:seven-document|seven document).*semantic/i);
  assert.match(guidance, /48 KiB/i);
  assert.doesNotMatch(guidance, /10k8|14,979/);
  assert.match(guidance, /multipart/i);
  assert.match(guidance, /same two MCP tools|exactly two MCP tools/i);
  assert.match(guidance, /one (?:MCP )?finalizer/i);
  assert.match(guidance, /parent.*submit|parent.*finalizer/i);
  assert.match(guidance, /read-only/i);
  assert.match(guidance, /stale.*reprepare|reprepare.*stale/i);
  assert.match(guidance, /exact (?:original )?(?:operation|operationId).*model/i);
  assert.match(guidance, /unknown marker|unknown-marker/i);
  assert.match(guidance, /compatibility.*separate|separate.*compatibility/i);
  assert.match(guidance, /no root seven|root seven.*independent|not.*independent.*write/i);
  assert.match(guidance, /linkInstructions/);
  assert.match(guidance, /outside.*bytes|bytes outside/i);
  assert.match(guidance, /newline/i);
  assert.match(guidance, /CAS/i);
  assert.match(guidance, /symlink/i);
  assert.match(guidance, /INDEX\.md.*complete immutable generation/i);
  assert.match(guidance, /baseline.*(?:unverified|current tree)/i);
  assert.match(guidance, /cannot detect new files/i);
  assert.match(guidance, /ordinary file read\/search|generic read\/search/i);
  assert.match(guidance, /never regenerat/i);
  assert.match(guidance, /administrative commands.*(?:mandatory|require)/i);
  assert.doesNotMatch(guidance, /Do not add pointers to other consumer skills/i);
  assert.match(guidance, /no performance|No token, latency, quality/i);
  assert.match(agent, /generated `\.blueprint` paths as required installed inputs/i);
  assert.doesNotMatch(JSON.stringify(MAP_CODEBASE_RUNTIME_METADATA.requiredInputPaths), /generated|INDEX|\.blueprint/);
});

test("map-codebase runtime metadata exposes portable outputs without changing routing", () => {
  assert.equal(MAP_CODEBASE_RUNTIME_METADATA.catalog.declaredStatus, "implemented");
  assert.deepEqual(MAP_CODEBASE_RUNTIME_METADATA.requiredTools, [
    "blueprint_map_prepare",
    "blueprint_map_submit"
  ]);
  assert.deepEqual(MAP_CODEBASE_RUNTIME_METADATA.optionalAgents, ["blueprint-mapper"]);
  assert.deepEqual(MAP_CODEBASE_RUNTIME_METADATA.requiredInputPaths, [
    "commands/blu-map-codebase.toml",
    "skills/blueprint-map/references/map-runtime-contract.md"
  ]);
  assert.deepEqual(MAP_CODEBASE_RUNTIME_METADATA.spec.writes, [
    ".blueprint/codebase/INDEX.md and its referenced generations/<generation-id>/",
    ".blueprint/codebase/{STACK,ARCHITECTURE,STRUCTURE,CONVENTIONS,TESTING,INTEGRATIONS,CONCERNS}.md compatibility views when applicable",
    "an explicitly selected existing repository instruction file only when linkInstructions is requested"
  ]);
  assert.match(MAP_CODEBASE_RUNTIME_METADATA.runtimeReference.contractNotes, /formatVersion: 1/);
  assert.match(MAP_CODEBASE_RUNTIME_METADATA.runtimeReference.contractNotes, /No performance or default-adoption claims/);
});
