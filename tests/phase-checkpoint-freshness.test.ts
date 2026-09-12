import test from "node:test";
import { promises as fs } from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm, symlink, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { evaluateCheckpointFreshness } from "../src/mcp/tools/phase-checkpoint-freshness.js";
import { blueprintPhaseCheckpointGet, blueprintPhaseCheckpointPut } from "../src/mcp/tools/phase-checkpoints.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

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
  assert.equal((await evaluateCheckpointFreshness(root, { ownerCommand: "/blu-research-phase" })).status, "unknown");
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


test("timestamp comparison uses serialized Date precision and hashes remain authoritative", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-freshness-precision-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = path.join(root, "input.md");
  await writeFile(input, "original");
  const observed = await stat(input);
  const timestamp = new Date("2026-09-10T00:00:00.001Z");
  // Node/filesystems can expose fractional mtimeMs whose truncation differs
  // from the Date used to serialize the checkpoint's updatedAt field.
  t.mock.method(fs, "stat", async () => Object.assign(Object.create(observed), {
    mtime: timestamp,
    mtimeMs: timestamp.getTime() - 0.25,
  }));
  const updatedAt = timestamp.toISOString();
  assert.equal((await evaluateCheckpointFreshness(root, checkpoint([{ path: "input.md", updatedAt }]))).status, "fresh");
  const older = new Date(timestamp.getTime() - 1).toISOString();
  assert.equal((await evaluateCheckpointFreshness(root, checkpoint([{ path: "input.md", updatedAt: older }]))).status, "stale");
  const hash = createHash("sha256").update("original").digest("hex");
  assert.equal((await evaluateCheckpointFreshness(root, checkpoint([{ path: "input.md", hash, updatedAt: older }]))).status, "fresh");
  await writeFile(input, "changed");
  assert.equal((await evaluateCheckpointFreshness(root, checkpoint([{ path: "input.md", hash, updatedAt }]))).status, "stale");
});


test("research checkpoint freshness verifies explicit top-level and ledger read sets", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-research-freshness-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const original = "observed research evidence";
  const hash = createHash("sha256").update(original).digest("hex");
  const readSet = [{ path: "input.md", hash }];
  const checkpoints = [
    { ownerCommand: "/blu-research-phase", readSet },
    { ownerCommand: "/blu-research-phase", researchLedger: { readSet, strands: [{ status: "complete" }] } }
  ];
  await writeFile(path.join(root, "input.md"), original);
  for (const saved of checkpoints) assert.equal((await evaluateCheckpointFreshness(root, saved)).status, "fresh");
  await writeFile(path.join(root, "input.md"), "changed");
  for (const saved of checkpoints) {
    const stale = await evaluateCheckpointFreshness(root, saved);
    assert.equal(stale.status, "stale");
    assert.deepEqual(stale.stalePaths, ["input.md"]);
  }
  await rm(path.join(root, "input.md"));
  for (const saved of checkpoints) assert.equal((await evaluateCheckpointFreshness(root, saved)).status, "stale");
});

test("research checkpoints never infer provenance from completed strands or legacy evidence", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-research-freshness-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const saved of [
    { researchLedger: { strands: [{ status: "complete", evidence: ["missing.md"] }] } },
    { readSet: ["missing.md"] },
    { readSet: [{ path: "missing.md" }] },
    { readSet: [], researchLedger: { readSet: [{ path: "input.md", hash: null }] } }
  ]) {
    const result = await evaluateCheckpointFreshness(root, { ownerCommand: "/blu-research-phase", ...saved });
    assert.equal(result.status, "unknown");
    assert.ok(result.warnings.length > 0);
  }
});

test("research fingerprints preserve observed optional absence while discuss semantics remain unchanged", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-research-absence-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const entry of [{ path: "optional.md", hash: null }, { path: "optional.md", fingerprint: null }]) {
    const saved = { ownerCommand: "/blu-research-phase", readSet: [entry] };
    assert.equal((await evaluateCheckpointFreshness(root, saved)).status, "fresh");
    assert.equal((await evaluateCheckpointFreshness(root, checkpoint([entry]))).status, "unknown");
    await writeFile(path.join(root, "optional.md"), "new input");
    assert.equal((await evaluateCheckpointFreshness(root, saved)).status, "stale");
    await rm(path.join(root, "optional.md"));
  }
});


test("research checkpoint tool refuses automatic resume after evidence changes or without provenance", async (t) => {
  const root = await createGitRepo("blueprint-research-checkpoint-resume-");
  t.after(() => rm(path.dirname(root), { recursive: true, force: true }));
  await fs.mkdir(path.join(root, ".blueprint/phases/03-discovery"), { recursive: true });
  await writeFile(path.join(root, ".blueprint/ROADMAP.md"), "# Roadmap\n\n## Phases\n\n- [ ] **Phase 3: Discovery**\n");
  await writeFile(path.join(root, "input.md"), "original");
  const hash = createHash("sha256").update("original").digest("hex");
  const options = { cwd: root, phase: "3", expectedOwnerCommand: "/blu-research-phase" as const, expectedMode: "research" as const };
  const base = { schemaVersion: 2, ownerCommand: "/blu-research-phase", mode: "research", researchLedger: { schemaVersion: "research-ledger/v1", strands: [{ status: "complete" }] } };
  await blueprintPhaseCheckpointPut({ cwd: root, phase: "3", checkpoint: base });
  const legacy = await blueprintPhaseCheckpointGet(options);
  assert.equal(legacy.freshness?.status, "unknown");
  assert.equal(legacy.safeToResume, false);
  await blueprintPhaseCheckpointPut({ ...options, checkpoint: { ...base, readSet: [{ path: "input.md", hash }] } });
  assert.equal((await blueprintPhaseCheckpointGet(options)).safeToResume, true);
  await writeFile(path.join(root, "input.md"), "changed");
  const changed = await blueprintPhaseCheckpointGet(options);
  assert.equal(changed.freshness?.status, "stale");
  assert.equal(changed.safeToResume, false);
});
