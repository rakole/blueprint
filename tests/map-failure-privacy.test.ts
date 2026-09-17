import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  logRejectedMutationResult,
  logThrownMutationError,
  MCP_WRITE_FAILURE_LOG_PATH,
  scrubLegacyCodebaseFailureLog
} from "../src/mcp/write-failure-log.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

test("mapping rejection and exception logs retain only metadata for every map write surface", async t => {
  const cwd = await createGitRepo("blueprint-map-failure-private-");
  t.after(() => rm(path.dirname(cwd), { recursive: true, force: true }));
  const marker = "UNSAVED_MAP_MODEL_MUST_NOT_PERSIST";
  for (const toolName of ["blueprint_codebase_artifact_write", "blueprint_map_prepare", "blueprint_map_submit"]) {
    const args = { cwd, content: marker, model: { summary: marker }, focusAreas: [marker], expectedRevision: 2 };
    await logRejectedMutationResult(toolName, args, {
      status: "invalid", written: false, reason: marker, draft: marker,
      diagnostics: [{ code: "schema.required", message: marker, path: marker }],
      validation: { valid: false, issues: [marker] }
    });
    await logThrownMutationError(toolName, args, new Error(marker));
  }
  const raw = await readFile(path.join(cwd, MCP_WRITE_FAILURE_LOG_PATH), "utf8");
  assert.equal(raw.includes(marker), false);
  const entries = raw.trim().split("\n").map(line => JSON.parse(line));
  assert.equal(entries.length, 6);
  for (const entry of entries) {
    assert.equal(entry.request.modelSupplied, true);
    assert.equal(entry.request.contentLength, marker.length);
    assert.equal(entry.request.expectedRevision, 2);
    if (entry.failureKind === "rejected") {
      assert.deepEqual(entry.result.diagnosticCodes, ["schema.required"]);
      assert.deepEqual(entry.result.validation, { valid: false, issuesCount: 1 });
    } else {
      assert.deepEqual(entry.error, { name: "MutationError", message: "Content omitted", stack: null });
    }
  }
});

test("legacy map diagnostics are scrubbed idempotently while unrelated rows retain exact bytes", async t => {
  const cwd = await createGitRepo("blueprint-map-failure-migrate-");
  t.after(() => rm(path.dirname(cwd), { recursive: true, force: true }));
  const logPath = path.join(cwd, MCP_WRITE_FAILURE_LOG_PATH);
  await mkdir(path.dirname(logPath), { recursive: true });
  const canonicalPath = path.join(cwd, ".blueprint/codebase/STACK.md");
  await mkdir(path.dirname(canonicalPath), { recursive: true });
  const canonical = "# Stack\r\n\r\nSaved canonical mapping stays intact.\r\n";
  await writeFile(canonicalPath, canonical);
  const marker = "LEGACY_REJECTED_MAPPING_SECRET";
  const unrelated = ' { "toolName" : "blueprint_state_update", "request" : { "content": "preserve exact spacing" } }\r\n';
  const malformedUnrelated = '{"unrelated malformed":\n';
  const legacy = JSON.stringify({
    schemaVersion: 1, timestamp: "2026-09-17T00:00:00.000Z", toolName: "blueprint_codebase_artifact_write",
    failureKind: "exception", cwd, projectRoot: cwd,
    request: { content: { length: marker.length, preview: marker }, model: { text: marker }, overwrite: false },
    result: { status: "invalid", issues: [marker], diagnostics: [{ code: "schema.required", message: marker }] },
    error: { name: marker, message: marker, stack: marker }, unknownDraft: marker
  });
  await writeFile(logPath, `${unrelated}${legacy}\r\n\n${malformedUnrelated}`);
  assert.deepEqual(await scrubLegacyCodebaseFailureLog(cwd), { scrubbedEntries: 1 });
  const once = await readFile(logPath, "utf8");
  assert.equal(once.includes(marker), false);
  assert.equal(once.startsWith(unrelated), true);
  assert.equal(once.endsWith(`\r\n\n${malformedUnrelated}`), true);
  const migrated = JSON.parse(once.split("\n")[1]);
  assert.deepEqual(migrated.result.diagnosticCodes, ["schema.required"]);
  assert.equal(migrated.result.issuesCount, 1);
  assert.deepEqual(await scrubLegacyCodebaseFailureLog(cwd), { scrubbedEntries: 0 });
  assert.equal(await readFile(logPath, "utf8"), once);
  assert.equal(await readFile(canonicalPath, "utf8"), canonical);
});

test("migration and concurrent appends share a lock without dropping log entries", async t => {
  const cwd = await createGitRepo("blueprint-map-failure-concurrent-");
  t.after(() => rm(path.dirname(cwd), { recursive: true, force: true }));
  const logPath = path.join(cwd, MCP_WRITE_FAILURE_LOG_PATH);
  await mkdir(path.dirname(logPath), { recursive: true });
  await writeFile(logPath, `${JSON.stringify({ toolName: "blueprint_codebase_artifact_write", request: { content: "REMOVE_OLD_DRAFT" } })}\n`);
  const appends = Array.from({ length: 12 }, (_, index) => logRejectedMutationResult(
    "blueprint_state_update", { cwd, index }, { status: "invalid", index }
  ));
  const results = await Promise.all([scrubLegacyCodebaseFailureLog(cwd), ...appends]);
  assert.equal(results.slice(1).every(Boolean), true);
  const raw = await readFile(logPath, "utf8");
  assert.equal(raw.includes("REMOVE_OLD_DRAFT"), false);
  const entries = raw.trim().split("\n").map(line => JSON.parse(line));
  assert.equal(entries.length, 13);
  assert.deepEqual(entries.filter(entry => entry.toolName === "blueprint_state_update")
    .map(entry => entry.request.index).sort((a, b) => a - b), Array.from({ length: 12 }, (_, index) => index));
});

test("no-log migration does not create Blueprint state", async t => {
  const cwd = await createGitRepo("blueprint-map-failure-no-log-");
  t.after(() => rm(path.dirname(cwd), { recursive: true, force: true }));
  assert.deepEqual(await scrubLegacyCodebaseFailureLog(cwd), { scrubbedEntries: 0 });
  await assert.rejects(access(path.join(cwd, ".blueprint")), { code: "ENOENT" });
});

test("map log migration and appends refuse symlink targets inside or outside Blueprint", async t => {
  const cwd = await createGitRepo("blueprint-map-failure-symlink-");
  t.after(() => rm(path.dirname(cwd), { recursive: true, force: true }));
  const logPath = path.join(cwd, MCP_WRITE_FAILURE_LOG_PATH);
  await mkdir(path.dirname(logPath), { recursive: true });
  for (const target of [path.join(cwd, ".blueprint/STACK.md"), path.join(path.dirname(cwd), "outside.ndjson")]) {
    const content = `${JSON.stringify({ toolName: "blueprint_codebase_artifact_write", request: { content: "DO_NOT_CHANGE_LINK_TARGET" } })}\n`;
    await writeFile(target, content);
    await symlink(target, logPath);
    await assert.rejects(scrubLegacyCodebaseFailureLog(cwd), /regular file|traversal/);
    assert.equal(await logRejectedMutationResult("blueprint_map_submit", { cwd }, { status: "invalid" }), null);
    assert.equal(await readFile(target, "utf8"), content);
    await rm(logPath);
  }
});
