import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  selectEvidenceDelivery,
  type CanonicalEvidence,
  type EvidenceDeliverySuccess,
  type PriorEvidenceDelivery,
} from "../src/mcp/evidence-delivery.ts";

const generation = "g1";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function evidence(path: string, content: string, dependencies: string[] = [], extra: Partial<CanonicalEvidence> = {}): CanonicalEvidence {
  return { path, generation, bytes: content, hash: digest(content), dependencies, ...extra };
}

function priorFrom(result: EvidenceDeliverySuccess): PriorEvidenceDelivery {
  return { binding: result.binding, delivered: result.binding.identities };
}

test("full delivery deduplicates the selected closure and delta sends changed bodies only", () => {
  const full = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "full",
    roots: ["records/a.md"],
    evidence: [
      evidence("records/a.md", "A v1", ["records/b.md"]),
      evidence("records/b.md", "B v1"),
      // This is the same canonical record and must not duplicate its body.
      evidence("records/b.md", "B v1"),
    ],
  });
  assert.equal(full.status, "ok");
  if (full.status !== "ok") return;
  assert.deepEqual(full.packet.entries.map(entry => entry.path), ["records/a.md", "records/b.md"]);
  assert.equal(full.counts.selectedCount, 2);
  assert.equal(full.counts.bodyCount, 2);

  const delta = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "delta",
    roots: ["records/a.md"],
    evidence: [
      evidence("records/a.md", "A v2", ["records/b.md"]),
      evidence("records/b.md", "B v1"),
    ],
    prior: priorFrom(full),
  });
  assert.equal(delta.status, "ok");
  if (delta.status !== "ok") return;
  const changed = delta.packet.entries.find(entry => entry.path === "records/a.md");
  const unchanged = delta.packet.entries.find(entry => entry.path === "records/b.md");
  assert.equal(changed?.content, "A v2");
  assert.equal(unchanged?.content, undefined);
  assert.deepEqual(delta.omittedPaths, ["records/b.md"]);
  assert.notEqual(delta.binding.hash, full.binding.hash, "a changed, so the current binding changes");
});

test("delta with unchanged hashes omits every previously delivered body", () => {
  const input = {
    pinnedGeneration: generation,
    roots: ["records/a.md"],
    evidence: [evidence("records/a.md", "same")],
  } as const;
  const full = selectEvidenceDelivery({ ...input, mode: "full" });
  assert.equal(full.status, "ok");
  if (full.status !== "ok") return;
  const delta = selectEvidenceDelivery({ ...input, mode: "delta", prior: priorFrom(full) });
  assert.equal(delta.status, "ok");
  if (delta.status !== "ok") return;
  assert.equal(delta.counts.bodyCount, 0);
  assert.deepEqual(delta.omittedPaths, ["records/a.md"]);
});

test("register accepts a new body-free record only with verified read-time bytes", () => {
  const content = "ordinary file read";
  const result = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "register",
    roots: ["src/new.ts"],
    evidence: [{ path: "src/new.ts", generation, bytes: content, hash: digest(content) }],
    readTimeEvidence: [{ path: "src/new.ts", bytes: content, hash: digest(content) }],
  });
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.packet.entries[0]?.content, undefined);
  assert.deepEqual(result.omittedPaths, ["src/new.ts"]);
  assert.equal(result.counts.bodyCount, 0);
});

test("prior bindings never substitute for a fresh current read", () => {
  const full = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "full",
    roots: ["src/current.ts"],
    evidence: [evidence("src/current.ts", "old")],
  });
  assert.equal(full.status, "ok");
  if (full.status !== "ok") return;

  const missingCurrent = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "delta",
    roots: ["src/current.ts"],
    evidence: [{ path: "src/current.ts", generation, hash: digest("old") }],
    prior: priorFrom(full),
  });
  assert.equal(missingCurrent.status, "reread_required");
  assert.deepEqual(missingCurrent.paths, ["src/current.ts"]);
});

test("current bytes are checked against optional read-time hashes and bodies", () => {
  const content = "current";
  const omitted = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "register",
    roots: ["src/current.ts"],
    evidence: [{ path: "src/current.ts", generation, bytes: content, hash: digest(content) }],
    readTimeEvidence: [{ path: "src/current.ts", hash: digest(content) }],
  });
  assert.equal(omitted.status, "ok");
  if (omitted.status === "ok") assert.equal(omitted.packet.entries[0]?.content, undefined);

  const wrongHash = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "register",
    roots: ["src/current.ts"],
    evidence: [{ path: "src/current.ts", generation, bytes: content, hash: digest(content) }],
    readTimeEvidence: [{ path: "src/current.ts", hash: digest("changed") }],
  });
  assert.equal(wrongHash.status, "invalid");
  assert.equal(wrongHash.code, "hash_mismatch");

  const noProof = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "register",
    roots: ["src/current.ts"],
    evidence: [{ path: "src/current.ts", generation, bytes: content, hash: digest(content) }],
  });
  assert.equal(noProof.status, "ok");
  if (noProof.status === "ok") assert.equal(noProof.packet.entries[0]?.content, content);
});

test("missing and incorrect read-time bases require reread or fail metadata-only", () => {
  const missing = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "register",
    roots: ["src/unknown.ts"],
    evidence: [{ path: "src/unknown.ts", generation, hash: digest("unobserved") }],
  });
  assert.equal(missing.status, "reread_required");
  assert.deepEqual(missing.paths, ["src/unknown.ts"]);

  const incorrect = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "register",
    roots: ["src/known.ts"],
    evidence: [{ path: "src/known.ts", generation, hash: digest("actual") }],
    readTimeEvidence: [{ path: "src/known.ts", bytes: "actual", hash: digest("wrong") }],
  });
  assert.equal(incorrect.status, "invalid");
  assert.equal(incorrect.code, "hash_mismatch");
});

test("moving root discovery metadata does not invalidate an unchanged pinned basis", () => {
  const make = (index: string) => ({
    pinnedGeneration: generation,
    mode: "full" as const,
    roots: [".blueprint/codebase/generations/g1/ENTRY.md"],
    evidence: [evidence(".blueprint/codebase/generations/g1/ENTRY.md", "immutable entry")],
    discovery: [{ path: ".blueprint/codebase/INDEX.md", generation: "root", bytes: index, hash: digest(index) }],
  });
  const first = selectEvidenceDelivery(make("points to g1"));
  assert.equal(first.status, "ok");
  if (first.status !== "ok") return;
  const second = selectEvidenceDelivery({
    ...make("points to g2"),
    mode: "register",
    prior: priorFrom(first),
  });
  assert.equal(second.status, "ok");
  if (second.status !== "ok") return;
  assert.equal(second.binding.hash, first.binding.hash);
  assert.notEqual(second.discovery[0]?.hash, first.discovery[0]?.hash);
  assert.deepEqual(second.omittedPaths, [".blueprint/codebase/generations/g1/ENTRY.md"]);
});

test("conflicting identities are rejected while exact duplicate identities are deduplicated", () => {
  const duplicate = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "full",
    roots: ["src/a.ts"],
    evidence: [evidence("src/a.ts", "same"), evidence("src/a.ts", "same")],
  });
  assert.equal(duplicate.status, "ok");
  if (duplicate.status === "ok") assert.equal(duplicate.counts.selectedCount, 1);

  const conflicting = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "full",
    roots: ["src/a.ts"],
    evidence: [evidence("src/a.ts", "one"), evidence("src/a.ts", "two")],
  });
  assert.equal(conflicting.status, "invalid");
  assert.equal(conflicting.code, "conflicting_identity");

  const contradictoryAssertion = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "full",
    roots: ["src/a.ts"],
    evidence: [
      evidence("src/a.ts", "same"),
      { path: "src/a.ts", generation, bytes: "same", hash: digest("different") },
    ],
  });
  assert.equal(contradictoryAssertion.status, "invalid");
  assert.equal(contradictoryAssertion.code, "hash_mismatch");

  const discoveryContradiction = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "full",
    roots: ["src/a.ts"],
    evidence: [evidence("src/a.ts", "same")],
    discovery: [
      { path: "INDEX.md", generation: "root", bytes: "index", hash: digest("index") },
      { path: "INDEX.md", generation: "root", bytes: "index", hash: digest("different") },
    ],
  });
  assert.equal(discoveryContradiction.status, "invalid");
  assert.equal(discoveryContradiction.code, "hash_mismatch");
});

test("malformed UTF-8 is rejected while valid BOM and Unicode bodies preserve their digest", () => {
  const malformed = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "full",
    roots: ["src/binary.ts"],
    evidence: [{ path: "src/binary.ts", generation, bytes: new Uint8Array([0x80]) }],
  });
  assert.equal(malformed.status, "invalid");
  assert.equal(malformed.code, "invalid_input");

  const bytes = new TextEncoder().encode("\uFEFFé🚀");
  const valid = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "full",
    roots: ["src/unicode.ts"],
    evidence: [{ path: "src/unicode.ts", generation, bytes, hash: digest("\uFEFFé🚀") }],
  });
  assert.equal(valid.status, "ok");
  if (valid.status !== "ok") return;
  const content = valid.packet.entries[0]?.content;
  assert.equal(content, "\uFEFFé🚀");
  assert.equal(digest(content ?? ""), valid.packet.entries[0]?.hash);
});

test("control-bearing paths are rejected without echoing controls", () => {
  for (const control of ["\n", "\t", "\u001b", "\u007f"]) {
    const path = `src/bad${control}name.ts`;
    const result = selectEvidenceDelivery({
      pinnedGeneration: generation,
      mode: "full",
      roots: [path],
      evidence: [{ path, generation, bytes: "x" }],
    });
    assert.equal(result.status, "invalid");
    assert.equal(result.paths.length, 0);
    assert.equal(JSON.stringify(result).includes(control), false);
  }
  const virtual = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "full",
    roots: ["@codebase/ENTRY.md"],
    evidence: [{ path: "@codebase/ENTRY.md", generation, bytes: "entry" }],
  });
  assert.equal(virtual.status, "ok");
});

test("transitive closure is counted before source/read-set limits and never silently dropped", () => {
  const result = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "delta",
    roots: ["src/a.ts"],
    evidence: [
      evidence("src/a.ts", "a", ["src/b.ts"]),
      evidence("src/b.ts", "b", ["src/c.ts"]),
      evidence("src/c.ts", "c"),
    ],
    limits: { maxSourceCount: 2, maxReadSetCount: 2 },
  });
  assert.equal(result.status, "evidence_limit");
  assert.equal(result.counts?.selectedCount, 3);
  assert.deepEqual(result.limits?.map(limit => limit.limit), ["maxSourceCount", "maxReadSetCount"]);
  assert.equal((result as { packet?: unknown }).packet, undefined);
  assert.equal(JSON.stringify(result).includes("a"), true, "path metadata is allowed");
  assert.equal(JSON.stringify(result).includes('"content"'), false);
});

test("deep closures use iterative traversal and bounded limit diagnostics", () => {
  const deepEvidence = Array.from({length: 10_000}, (_, index) => {
    const path = `src/p${index}.ts`;
    const dependencies = index === 9_999 ? [] : [`src/p${index + 1}.ts`];
    return evidence(path, "x", dependencies);
  });
  const result = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "delta",
    roots: ["src/p0.ts"],
    evidence: deepEvidence,
    limits: { maxSourceCount: 500, maxReadSetCount: 300 },
  });
  assert.equal(result.status, "evidence_limit");
  assert.equal(result.counts?.selectedCount, 10_000);
  assert.equal(result.counts?.readSetCount, 10_000);
  assert.equal(result.scopeReduction?.suggestedMaxCount, 300);
  assert.equal(result.scopeReduction?.omittedPathCount, 10_000 - 32);
  assert.ok(result.paths.length <= 32);
  assert.equal((result as {packet?: unknown}).packet, undefined);
  assert.equal(JSON.stringify(result).includes('"content"'), false);
  assert.ok(JSON.stringify(result).length < 8_000);
});

test("packet cap is measured in serialized UTF-8 bytes", () => {
  const base = {
    pinnedGeneration: generation,
    mode: "full" as const,
    roots: ["src/unicode.ts"],
    evidence: [evidence("src/unicode.ts", "é🚀")],
  };
  const accepted = selectEvidenceDelivery(base);
  assert.equal(accepted.status, "ok");
  if (accepted.status !== "ok") return;
  assert.equal(accepted.counts.bodyBytes, Buffer.byteLength("é🚀", "utf8"));
  const limited = selectEvidenceDelivery({ ...base, limits: { maxPacketBytes: accepted.counts.packetBytes - 1 } });
  assert.equal(limited.status, "evidence_limit");
  assert.equal(limited.limits?.[0]?.limit, "maxPacketBytes");
  assert.equal(limited.limits?.[0]?.actual, accepted.counts.packetBytes);
});

test("hash mismatch and malformed closure failures never retain rejected evidence content", () => {
  const secret = "super-secret-evidence-body";
  const result = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "full",
    roots: ["src/secret.ts"],
    evidence: [{ path: "src/secret.ts", generation, bytes: secret, hash: digest("different") }],
  });
  assert.equal(result.status, "invalid");
  assert.equal(result.code, "hash_mismatch");
  assert.equal(JSON.stringify(result).includes(secret), false);

  const extra = selectEvidenceDelivery({
    pinnedGeneration: generation,
    mode: "full",
    roots: ["src/a.ts"],
    evidence: [evidence("src/a.ts", "a"), evidence("src/unselected.ts", secret)],
  });
  assert.equal(extra.status, "invalid");
  assert.equal(extra.code, "unselected_record");
  assert.equal(JSON.stringify(extra).includes(secret), false);
});
