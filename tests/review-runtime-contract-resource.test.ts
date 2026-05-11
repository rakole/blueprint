import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";

const REVIEW_FAMILY_COMMANDS = [
  "code-review",
  "code-review-fix",
  "audit-fix",
  "secure-phase",
  "review",
  "ui-review"
] as const;

const HIDDEN_GOD_REVIEW_PATTERNS = [
  /--feels-like-god/i,
  /blueprint-god-review/i,
  /skills\/blueprint-god-review\/SKILL\.md/i,
  /blueprint_god_review_start/,
  /blueprint_god_review_next/,
  /blueprint_god_review_append/,
  /blueprint_god_review_load_findings/,
  /blueprint_god_review_record_fix/,
  /blueprint_god_review_cleanup/,
  /skills\/blueprint-god-review\/references\/review-method\.md/i,
  /skills\/blueprint-god-review\/references\/lane-rubrics\.md/i,
  /skills\/blueprint-god-review\/references\/finding-quality\.md/i,
  /skills\/blueprint-god-review\/references\/context-selection\.md/i,
  /skills\/blueprint-god-review\/references\/finding-examples\.md/i,
  /skills\/blueprint-god-review\/references\/final-curation\.md/i,
  /Fresh-Context Loop/i,
  /Terminal Curation Mindset/i,
  /Strong Actionable Finding Template/i,
  /Weak Finding To Drop/i,
  /Unsupported Hypothesis To Drop/i,
  /Duplicate Root Cause Merge/i,
  /Stale No-Edit Fix/i,
  /Dedupe Protocol/i,
  /Severity Reconciliation/i,
  /Weak-Finding Rejection/i,
  /Cross-Lane Synthesis/i,
  /Terminal Response Shape/i,
  /No-Side-Effect Curation/i,
  /Fix Eligibility/i
] as const;

function bundledRelativePath(value: unknown): string | null {
  const pathname = value instanceof URL ? value.pathname : String(value);
  const relativePath = path.relative(process.cwd(), pathname);

  if (relativePath.startsWith("..")) {
    return null;
  }

  return relativePath;
}

function makeBundledDocsUnavailable(t: TestContext): string[] {
  const attemptedDocs: string[] = [];
  const originalReadFile = fs.readFile;

  fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
    const relativePath = bundledRelativePath(args[0]);

    if (
      relativePath === "docs/COMMAND-CATALOG.md" ||
      relativePath === "docs/RUNTIME-REFERENCE.md" ||
      /^docs\/commands\/.+\.md$/.test(relativePath ?? "")
    ) {
      attemptedDocs.push(relativePath);
      const error = new Error("ENOENT");
      (error as NodeJS.ErrnoException).code = "ENOENT";
      throw error;
    }

    return originalReadFile(...args);
  }) as typeof fs.readFile;

  t.after(() => {
    fs.readFile = originalReadFile;
  });

  return attemptedDocs;
}

test("review-family runtime contract resources do not read bundled docs at build time", async (t) => {
  const attemptedDocs = makeBundledDocsUnavailable(t);

  for (const commandName of REVIEW_FAMILY_COMMANDS) {
    const metadata = getRuntimeOwnedCommandMetadata(commandName);
    const contract = await buildBlueprintCommandRuntimeContractResource(commandName);

    assert.ok(metadata, `Missing runtime metadata for ${commandName}`);
    assert.equal(contract.command, commandName);
    assert.equal(contract.catalog.status, "implemented");
    assert.equal(contract.catalog.specPath, metadata.sourceId);
    assert.equal(contract.spec?.path, metadata.sourceId);
    assert.equal(contract.runtimeReference?.path, metadata.sourceId);
    assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
    assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
      ...metadata.requiredTools
    ]);
    assert.deepEqual(contract.skillInputs.effective, [
      `commands/blu-${commandName}.toml`,
      ...(metadata.requiredInputPaths ?? [])
    ]);

    const serialized = JSON.stringify(contract, null, 2);
    for (const pattern of HIDDEN_GOD_REVIEW_PATTERNS) {
      assert.doesNotMatch(serialized, pattern);
    }
  }

  assert.deepEqual(
    attemptedDocs.filter((relativePath) => relativePath !== "docs/COMMAND-CATALOG.md"),
    []
  );
});
