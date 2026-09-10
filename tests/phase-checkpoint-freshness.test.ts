import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm, symlink, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { evaluateCheckpointFreshness } from "../src/mcp/tools/phase-checkpoint-freshness.js";

const checkpoint = (readSet: unknown[]) => ({ ownerCommand: "/blu-discuss-phase", readSet });

test("checkpoint freshness detects changed and deleted evidence with actionable paths", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-freshness-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const hash = createHash("sha256").update("original").digest("hex");
  await writeFile(path.join(root, "input.md"), "original");
  const saved = checkpoint([{ path: "input.md", fingerprint: `sha256:${hash}` }]);
  assert.equal((await evaluateCheckpointFreshness(root, saved)).status, "fresh");
  await writeFile(path.join(root, "input.md"), "changed");
  const stale = await evaluateCheckpointFreshness(root, saved);
  assert.equal(stale.status, "stale");
  assert.deepEqual(stale.stalePaths, ["input.md"]);
  await rm(path.join(root, "input.md"));
  assert.equal((await evaluateCheckpointFreshness(root, saved)).status, "stale");
});

test("checkpoint freshness recognizes timestamp evidence but never guesses legacy or virtual fingerprints", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-freshness-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "input.md"), "original");
  const updatedAt = (await stat(path.join(root, "input.md"))).mtime.toISOString();
  assert.equal((await evaluateCheckpointFreshness(root, checkpoint([{ path: "input.md", updatedAt }]))).status, "fresh");
  for (const entries of [[], ["input.md"], [{ path: "effective-config", fingerprint: "opaque" }], [null]]) {
    const result = await evaluateCheckpointFreshness(root, checkpoint(entries));
    assert.equal(result.status, "unknown");
    assert.ok(result.unknownPaths.length);
  }
  assert.equal((await evaluateCheckpointFreshness(root, { ownerCommand: "/blu-research-phase" })).status, "not-applicable");
});

test("checkpoint freshness does not inspect paths outside the repository", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-freshness-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await symlink(os.tmpdir(), path.join(root, "outside"));
  for (const inputPath of ["../outside.md", "/etc/passwd", "outside/unknown.md"]) {
    const result = await evaluateCheckpointFreshness(root, checkpoint([{ path: inputPath, hash: "a".repeat(64) }]));
    assert.equal(result.status, "unknown");
    assert.deepEqual(result.unknownPaths, [inputPath]);
  }
});
