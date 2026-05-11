import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";

const repoRoot = process.cwd();

const PRIVATE_TOOL_IDS = [
  "blueprint_god_review_start",
  "blueprint_god_review_next",
  "blueprint_god_review_append",
  "blueprint_god_review_load_findings",
  "blueprint_god_review_record_fix",
  "blueprint_god_review_cleanup"
] as const;

async function readRelativePath(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertAppearsBefore(text: string, first: string, second: string, label: string): void {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);

  assert.notEqual(firstIndex, -1, `${label} is missing ${first}`);
  assert.notEqual(secondIndex, -1, `${label} is missing ${second}`);
  assert.ok(firstIndex < secondIndex, `${label} should mention ${first} before ${second}`);
}

test("code-review hidden activation branch runs before normal MCP-backed review flow", async () => {
  const manifest = await readRelativePath("commands/blu-code-review.toml");

  assertAppearsBefore(
    manifest,
    "Hidden god-review branch:",
    "mcp_blueprint_blueprint_config_get",
    "code-review manifest"
  );
  assert.match(manifest, /raw invocation includes `--feels-like-god`/);
  assert.match(manifest, /active `\/blu-code-review` invocation/);
  assert.match(manifest, /do not run the normal code-review flow below/i);
  assert.match(manifest, /apply the `blueprint-review` skill's Hidden God-Review Activation Guard first/);
  assert.match(manifest, /do not write `XX-REVIEW\.md`, `XX-REVIEW-FIX\.md`, normal `STATE\.md`, quality-gate state/i);
  assert.match(manifest, /Do not fall through into normal review persistence/i);
  assert.match(manifest, /mcp_blueprint_blueprint_god_review_start/);
  assert.match(manifest, /mcp_blueprint_blueprint_god_review_next/);
  assert.match(manifest, /mcp_blueprint_blueprint_god_review_append/);
  assert.doesNotMatch(manifest, /mcp_blueprint_blueprint_god_review_load_findings/);
  assert.doesNotMatch(manifest, /mcp_blueprint_blueprint_god_review_record_fix/);
  assert.doesNotMatch(manifest, /mcp_blueprint_blueprint_god_review_cleanup/);
});

test("code-review-fix hidden activation branch runs before normal MCP-backed remediation flow", async () => {
  const manifest = await readRelativePath("commands/blu-code-review-fix.toml");

  assertAppearsBefore(
    manifest,
    "Hidden god-review-fix branch:",
    "mcp_blueprint_blueprint_config_get",
    "code-review-fix manifest"
  );
  assert.match(manifest, /raw invocation includes `--feels-like-god`/);
  assert.match(manifest, /active `\/blu-code-review-fix` invocation/);
  assert.match(manifest, /do not run the normal review-fix flow below/i);
  assert.match(manifest, /apply the `blueprint-review` skill's Hidden God-Review Activation Guard first/);
  assert.match(manifest, /do not write `XX-REVIEW\.md`, `XX-REVIEW-FIX\.md`, `XX-GOD-REVIEW-FIX\.md`, normal `STATE\.md`/i);
  assert.match(manifest, /mcp_blueprint_blueprint_god_review_load_findings/);
  assert.match(manifest, /mcp_blueprint_blueprint_god_review_record_fix/);
  assert.match(manifest, /mcp_blueprint_blueprint_god_review_cleanup/);
  assert.match(manifest, /selection\.status/);
  assert.match(manifest, /Do not fall through into normal review-fix persistence or source edits/i);

  for (const toolId of PRIVATE_TOOL_IDS.filter(
    (privateToolId) =>
      privateToolId !== "blueprint_god_review_load_findings" &&
      privateToolId !== "blueprint_god_review_record_fix" &&
      privateToolId !== "blueprint_god_review_cleanup"
  )) {
    assert.doesNotMatch(manifest, new RegExp(toolId));
  }
});

test("blueprint-review skill refuses accidental hidden activation before MCP or repo reads", async () => {
  const skill = await readRelativePath("skills/blueprint-review/SKILL.md");

  assertAppearsBefore(
    skill,
    "Hidden God-Review Activation Guard",
    "mcp_blueprint_blueprint_project_status",
    "blueprint-review skill"
  );
  assert.match(skill, /active command\s+is `\/blu-code-review` or `\/blu-code-review-fix`/i);
  assert.match(skill, /raw invocation\s+contains `--feels-like-god`/i);
  assert.match(skill, /God mode only wakes during special `occassions`\./);
  assert.match(skill, /This is a mistaken skill invocation, reach out to blueprint admin for help\./);
  assert.match(skill, /No `thunderbolt` today\./);
  assert.match(skill, /Do not call MCP tools, inspect `\.blueprint\/`, read repo\s+files, use `STATE\.md\.activeCommand`, write files, spawn subagents/i);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_start/);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_next/);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_append/);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_load_findings/);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_record_fix/);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_cleanup/);
});

test("public runtime-contract resources still hide hidden branch text", async () => {
  const codeReview = await buildBlueprintCommandRuntimeContractResource("code-review");
  const codeReviewFix = await buildBlueprintCommandRuntimeContractResource("code-review-fix");

  for (const payload of [codeReview, codeReviewFix]) {
    const serialized = JSON.stringify(payload, null, 2);

    assert.doesNotMatch(serialized, /--feels-like-god/i);
    assert.doesNotMatch(serialized, /Hidden god-review/i);
    assert.doesNotMatch(serialized, /Hidden God-Review Activation Guard/i);

    for (const toolId of PRIVATE_TOOL_IDS) {
      assert.doesNotMatch(serialized, new RegExp(toolId));
    }
  }
});
