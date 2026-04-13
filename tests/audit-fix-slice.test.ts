import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import { blueprintToolNames } from "../src/mcp/server.js";

const repoRoot = process.cwd();

test("audit-fix docs and catalog metadata promote the remediation slice to implemented", async () => {
  const [catalogMarkdown, implementationOrder] = await Promise.all([
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/IMPLEMENTATION-ORDER.md"), "utf8")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `audit-fix` \| 4 \| `Quality And Shipping` \| `blueprint-review` \| `implemented` \| `\.blueprint\/reports\/audit-fix-<phase>\.md; optional \.blueprint\/todos\/TODO\.md; repo code changes when not dry-running; \.blueprint\/STATE\.md` \| `High: bounded remediation plus report\/state updates\.` \|/
  );
  assert.match(
    implementationOrder,
    /Shipped in this wave: `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `docs-update`, `add-tests`, `pr-branch`, and `ship`\./
  );
});

test("audit-fix is exposed as an implemented remediation command with the registered tools", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["audit-fix"];

  assert.ok(blueprintToolNames.includes("blueprint_review_scope"));
  assert.ok(blueprintToolNames.includes("blueprint_artifact_report_write"));
  assert.ok(blueprintToolNames.includes("blueprint_artifact_mutate_index"));
  assert.ok(blueprintToolNames.includes("blueprint_state_update"));
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-audit-fix.toml");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_artifact_list",
    "blueprint_review_scope",
    "blueprint_artifact_report_write",
    "blueprint_artifact_mutate_index",
    "blueprint_state_update"
  ]);
  assert.deepEqual(entry.availableOptionalAgents.sort(), [
    "blueprint-reviewer",
    "blueprint-verifier"
  ]);
});
