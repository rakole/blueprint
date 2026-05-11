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

const PRIVATE_RUNTIME_TOOL_IDS = PRIVATE_TOOL_IDS.map((toolId) => `mcp_blueprint_${toolId}`);

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

test("code-review manifest keeps the hidden dispatcher tiny and defers orchestration to the private skill", async () => {
  const manifest = await readRelativePath("commands/blu-code-review.toml");

  assertAppearsBefore(
    manifest,
    "Dispatcher:",
    "Use the `blueprint-review` skill as the primary orchestration contract",
    "code-review manifest"
  );
  assert.match(manifest, /raw invocation contains a standalone `--feels-like-god` flag token/);
  assert.match(manifest, /do not run the normal code-review flow below/i);
  assert.match(manifest, /Follow `skills\/blueprint-god-review\/SKILL\.md` for this invocation only/i);
  assert.match(manifest, /stop if that private skill reaches a terminal outcome/i);
  assert.doesNotMatch(manifest, /Hidden God-Review Activation Guard/i);
  assert.doesNotMatch(manifest, /selection\.status/i);
  assert.doesNotMatch(manifest, /\.god-review-state\.md/i);
  assert.doesNotMatch(manifest, /scopeFingerprint/i);

  for (const toolId of PRIVATE_RUNTIME_TOOL_IDS) {
    assert.doesNotMatch(manifest, new RegExp(toolId));
  }
});

test("code-review-fix manifest keeps the hidden dispatcher tiny and defers orchestration to the private skill", async () => {
  const manifest = await readRelativePath("commands/blu-code-review-fix.toml");

  assertAppearsBefore(
    manifest,
    "Dispatcher:",
    "Use the `blueprint-review` skill as the primary orchestration contract",
    "code-review-fix manifest"
  );
  assert.match(manifest, /raw invocation contains a standalone `--feels-like-god` flag token/);
  assert.match(manifest, /do not run the normal review-fix flow below/i);
  assert.match(manifest, /Follow `skills\/blueprint-god-review\/SKILL\.md` for this invocation only/i);
  assert.match(manifest, /stop if that private skill reaches a terminal outcome/i);
  assert.doesNotMatch(manifest, /Hidden God-Review Activation Guard/i);
  assert.doesNotMatch(manifest, /selection\.status/i);
  assert.doesNotMatch(manifest, /XX-GOD-REVIEW-FIX/i);
  assert.doesNotMatch(manifest, /\.god-review-state\.md/i);

  for (const toolId of PRIVATE_RUNTIME_TOOL_IDS) {
    assert.doesNotMatch(manifest, new RegExp(toolId));
  }
});

test("public blueprint-review skill stays clean of hidden god-review activation details", async () => {
  const skill = await readRelativePath("skills/blueprint-review/SKILL.md");

  assert.doesNotMatch(skill, /--feels-like-god/i);
  assert.doesNotMatch(skill, /Hidden God-Review Activation Guard/i);
  assert.doesNotMatch(skill, /god-review/i);
  assert.doesNotMatch(skill, /\.god-review-state\.md/i);
  assert.doesNotMatch(skill, /XX-GOD-REVIEW-FIX/i);
  assert.doesNotMatch(skill, /This is a mistaken skill invocation, reach out to blueprint admin for help\./);
  assert.doesNotMatch(skill, /No `thunderbolt` today\./);

  for (const toolId of PRIVATE_RUNTIME_TOOL_IDS) {
    assert.doesNotMatch(skill, new RegExp(toolId));
  }
});

test("private blueprint-god-review skill contains the hidden guard, refusal text, and private review flows", async () => {
  const skill = await readRelativePath("skills/blueprint-god-review/SKILL.md");

  assertAppearsBefore(
    skill,
    "Hidden God-Review Activation Guard",
    "mcp_blueprint_blueprint_project_status",
    "blueprint-god-review skill"
  );
  assert.match(skill, /active command\s+is `\/blu-code-review` or `\/blu-code-review-fix`/i);
  assert.match(skill, /raw invocation\s+contains `--feels-like-god` as a standalone flag token/i);
  assert.match(skill, /God mode only wakes during special `occassions`\./);
  assert.match(skill, /This is a mistaken skill invocation, reach out to blueprint admin for help\./);
  assert.match(skill, /No `thunderbolt` today\./);
  assert.match(
    skill,
    /Do not call MCP tools, inspect `\.blueprint\/`, read\s+repo files, use `STATE\.md\.activeCommand`, write files, spawn subagents/i
  );
  assert.match(skill, /mcp_blueprint_blueprint_god_review_start/);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_next/);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_append/);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_load_findings/);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_record_fix/);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_cleanup/);
  assert.match(skill, /Review exactly one returned pending group per invocation/i);
  assert.match(
    skill,
    /Do not call normal `blueprint_review_record`, do not write\s+`XX-REVIEW\.md`/i
  );
  assert.match(skill, /selection\.status/i);
  assert.match(skill, /Fix Eligibility: eligible/);
  assert.match(
    skill,
    /Use `--finding`, `--severity`, and `--all` as the only widening\s+selectors/i
  );
  assert.match(
    skill,
    /Set the record call's `terminal` flag only when the hidden fix pass has\s+reached a terminal result/i
  );
  assert.match(
    skill,
    /Cleanup may delete only the hidden session JSON and\s+`\.god-review-state\.md`/i
  );
  assert.match(skill, /preserve the durable god-review report and\s+remediation log/i);
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
