import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildBlueprintCommandRuntimeContractResource,
  listBlueprintCommandRuntimeContractCommands
} from "../src/mcp/command-resources.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

const HIDDEN_GOD_REVIEW_PATTERNS = [
  /--feels-like-god/i,
  /feels-like-god/i,
  /god-mode/i,
  /god review/i,
  /god-review/i,
  /blueprint-god-review/i,
  /\.god-review/i,
  /GOD-REVIEW/,
  /XX-GOD-REVIEW-FIX/,
  /blueprint_god_review_start/,
  /blueprint_god_review_next/,
  /blueprint_god_review_append/,
  /blueprint_god_review_load_findings/,
  /blueprint_god_review_record_fix/,
  /blueprint_god_review_cleanup/,
  /skills\/blueprint-god-review\/SKILL\.md/i
] as const;

const PUBLIC_DOCUMENT_PATHS = [
  "docs/commands/code-review.md",
  "docs/commands/code-review-fix.md",
  "docs/COMMAND-CATALOG.md",
  "docs/RUNTIME-REFERENCE.md"
] as const;

const PUBLIC_ROUTER_GUIDANCE_PATHS = [
  "commands/blu.toml",
  "commands/blu-help.toml",
  "commands/blu-progress.toml",
  "commands/blu-next.toml"
] as const;

async function readRelativePath(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertNoHiddenGodReviewLeak(label: string, text: string): void {
  for (const pattern of HIDDEN_GOD_REVIEW_PATTERNS) {
    assert.doesNotMatch(text, pattern, `${label} leaked hidden god-review token ${pattern}`);
  }
}

test("public code-review docs and router guidance do not expose hidden god-review mode", async () => {
  for (const relativePath of [
    ...PUBLIC_DOCUMENT_PATHS,
    ...PUBLIC_ROUTER_GUIDANCE_PATHS
  ]) {
    assertNoHiddenGodReviewLeak(relativePath, await readRelativePath(relativePath));
  }
});

test("runtime command catalog stays free of hidden god-review support details", async () => {
  const catalog = await blueprintCommandCatalog();

  assertNoHiddenGodReviewLeak("blueprint_command_catalog", JSON.stringify(catalog, null, 2));
  assert.equal(catalog.commands["code-review"].implemented, true);
  assert.equal(catalog.commands["code-review-fix"].implemented, true);
  assert.ok(!("god-review" in catalog.commands));
});

test("public runtime-contract resources do not expose hidden god-review details", async () => {
  const commands = await listBlueprintCommandRuntimeContractCommands();
  const payloads = await Promise.all(
    commands.map((command) => buildBlueprintCommandRuntimeContractResource(command))
  );

  assert.ok(commands.includes("code-review"));
  assert.ok(commands.includes("code-review-fix"));

  for (const payload of payloads) {
    assertNoHiddenGodReviewLeak(
      `blueprint://commands/${payload.command}/runtime-contract`,
      JSON.stringify(payload, null, 2)
    );
  }
});
