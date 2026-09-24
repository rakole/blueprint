import { createHash } from "node:crypto";

/**
 * Evidence bytes are supplied by a lifecycle owner that has already selected
 * canonical paths. This helper does not read files, resolve virtual paths, or
 * persist a session.
 */
export type EvidenceBytes = string | Uint8Array;
export type EvidenceMode = "full" | "delta" | "register";
export type EvidenceKind = "source" | "page" | "virtual";

export interface EvidenceIdentity {
  path: string;
  hash: string;
  generation: string;
}

export interface CanonicalEvidence {
  /** A repository-relative canonical path or a caller-owned virtual identity. */
  path: string;
  /** The immutable generation that owns this evidence identity. */
  generation: string;
  /** Fresh current bytes are required for every selected identity. */
  bytes?: EvidenceBytes;
  /** Optional asserted hash; it is always checked against supplied bytes. */
  hash?: string;
  /** Exact selected immediate dependencies, expressed by canonical path. */
  dependencies?: readonly string[];
  kind?: EvidenceKind;
}

export interface ReadTimeEvidence {
  /** Ordinary-file read captured by the lifecycle owner at read time. */
  path: string;
  /** Optional bytes from that read. The selected record still must supply current bytes. */
  bytes?: EvidenceBytes;
  /** A hash-only read-time assertion is allowed when the owner retains no old body. */
  hash?: string;
}

export interface PriorEvidenceBinding {
  pinnedGeneration: string;
  identities: readonly EvidenceIdentity[];
  /** SHA-256 of the canonical sorted identities. */
  hash: string;
}

export interface PriorEvidenceDelivery {
  binding: PriorEvidenceBinding;
  /** Hashes actually delivered in the prior session, usually a subset. */
  delivered: readonly EvidenceIdentity[];
}

export interface EvidenceDeliveryLimits {
  /** Counted over the complete selected transitive closure, before mode shaping. */
  maxSourceCount?: number;
  /** Counted over the complete selected transitive closure, before mode shaping. */
  maxReadSetCount?: number;
  /** UTF-8 bytes of the exact JSON packet returned by this helper. */
  maxPacketBytes?: number;
}

export interface EvidenceDeliveryInput {
  /** Opaque immutable generation selected by the lifecycle owner. */
  pinnedGeneration: string;
  mode: EvidenceMode;
  /** Root records from which the exact transitive dependency closure is built. */
  roots: readonly string[];
  /** Complete selected closure. Extra or missing records are rejected. */
  evidence: readonly CanonicalEvidence[];
  /** Moving discovery metadata such as root INDEX. It never enters the binding. */
  discovery?: readonly CanonicalEvidence[];
  prior?: PriorEvidenceDelivery;
  readTimeEvidence?: readonly ReadTimeEvidence[];
  limits?: EvidenceDeliveryLimits;
}

export interface DeliveredEvidence {
  path: string;
  generation: string;
  hash: string;
  dependencies: string[];
  /** UTF-8 body is present only when this mode requires fresh delivery. */
  content?: string;
}

export interface EvidencePacket {
  version: 1;
  mode: EvidenceMode;
  pinnedGeneration: string;
  roots: string[];
  entries: DeliveredEvidence[];
}

export interface EvidenceDeliveryCounts {
  /** All selected records, including pages and virtual records. */
  selectedCount: number;
  /** Alias for selectedCount retained for source/read-set limit reporting. */
  sourceCount: number;
  readSetCount: number;
  dependencyCount: number;
  bodyCount: number;
  bodyBytes: number;
  packetBytes: number;
}

export interface EvidenceLimit {
  limit: "maxSourceCount" | "maxReadSetCount" | "maxPacketBytes";
  actual: number;
  maximum: number;
  scope: "full-selected-transitive-closure" | "serialized-packet";
}

export interface EvidenceDeliverySuccess {
  status: "ok";
  mode: EvidenceMode;
  pinnedGeneration: string;
  packet: EvidencePacket;
  binding: PriorEvidenceBinding;
  counts: EvidenceDeliveryCounts;
  omittedPaths: string[];
  /** Validated discovery identities are reported separately from the basis. */
  discovery: EvidenceIdentity[];
}

export type EvidenceFailureCode =
  | "invalid_input"
  | "invalid_path"
  | "invalid_hash"
  | "hash_mismatch"
  | "conflicting_identity"
  | "generation_mismatch"
  | "missing_dependency"
  | "unselected_record"
  | "invalid_prior_binding"
  | "reread_required";

export interface EvidenceDeliveryFailure {
  status: "invalid" | "evidence_limit" | "reread_required";
  code?: EvidenceFailureCode;
  reason: string;
  /** Metadata only: bodies and serialized evidence packets are never returned. */
  paths: string[];
  limits?: EvidenceLimit[];
  counts?: EvidenceDeliveryCounts;
  scopeReduction?: {
    selectedCount: number;
    suggestedMaxCount?: number;
    omittedBodyCount: number;
    omittedPathCount?: number;
  };
}

export type EvidenceDeliveryResult = EvidenceDeliverySuccess | EvidenceDeliveryFailure;

const SHA256 = /^[a-f0-9]{64}$/;
const MAX_DIAGNOSTIC_PATHS = 32;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function toBytes(value: EvidenceBytes): Uint8Array | null {
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof Uint8Array) return new Uint8Array(value);
  return null;
}

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
}

function comparePath(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareIdentity(a: EvidenceIdentity, b: EvidenceIdentity): number {
  return comparePath(a.path, b.path) || comparePath(a.generation, b.generation) || comparePath(a.hash, b.hash);
}

function canonicalIdentities(identities: readonly EvidenceIdentity[]): EvidenceIdentity[] {
  return identities.map(identity => ({ ...identity })).sort(compareIdentity);
}

function identityKey(identity: EvidenceIdentity): string {
  return JSON.stringify([identity.path, identity.hash, identity.generation]);
}

function identitiesJson(identities: readonly EvidenceIdentity[]): string {
  return JSON.stringify(canonicalIdentities(identities));
}

/** Stable binding hash used by lifecycle sessions without importing a tool module. */
export function evidenceBindingHash(identities: readonly EvidenceIdentity[]): string {
  return sha256(new TextEncoder().encode(identitiesJson(identities)));
}

function validPath(path: string): boolean {
  if (!path || /[\u0000-\u001f\u007f]/.test(path) || path.includes("\\")) return false;
  if (path.startsWith("/") || path.includes("//")) return false;
  if (path.startsWith("@")) return /^@[^/]+(?:\/[^/]+)*$/.test(path) && !path.split("/").some(segment => segment === "." || segment === "..");
  return !path.split("/").some(segment => segment === "" || segment === "." || segment === "..");
}

function validGeneration(generation: string): boolean {
  return typeof generation === "string" && generation.length > 0 && generation.length <= 256 && !/[\0\r\n]/.test(generation);
}

function metadataFailure(
  status: EvidenceDeliveryFailure["status"],
  reason: string,
  paths: readonly string[] = [],
  extra: Partial<EvidenceDeliveryFailure> = {},
): EvidenceDeliveryFailure {
  const safePaths = paths.filter(path => typeof path === "string" && !/[\u0000-\u001f\u007f]/.test(path));
  return { status, reason, paths: [...new Set(safePaths)].sort(comparePath), ...extra };
}

function checkIdentityList(
  identities: readonly EvidenceIdentity[],
  expectedGeneration?: string,
): { ok: true; identities: EvidenceIdentity[] } | { ok: false; paths: string[] } {
  const seen = new Map<string, EvidenceIdentity>();
  for (const identity of identities) {
    if (!validPath(identity.path) || !validGeneration(identity.generation) || !SHA256.test(identity.hash) ||
        (expectedGeneration !== undefined && identity.generation !== expectedGeneration))
      return { ok: false, paths: validPath(identity.path) ? [identity.path] : [] };
    const previous = seen.get(identity.path);
    if (previous && identityKey(previous) !== identityKey(identity))
      return { ok: false, paths: [identity.path] };
    seen.set(identity.path, { ...identity });
  }
  return { ok: true, identities: canonicalIdentities([...seen.values()]) };
}

interface NormalizedEvidence {
  path: string;
  generation: string;
  dependencies: string[];
  kind: EvidenceKind;
  bytes?: Uint8Array;
  assertedHash?: string;
}

function normalizeEvidenceList(
  items: readonly CanonicalEvidence[] | undefined,
  pinnedGeneration: string | undefined,
  requireGeneration: boolean,
): { ok: true; items: NormalizedEvidence[] } | { ok: false; failure: EvidenceDeliveryFailure } {
  if (items !== undefined && !Array.isArray(items))
    return { ok: false, failure: metadataFailure("invalid", "Evidence records must be an array.", [], { code: "invalid_input" }) };
  const byPath = new Map<string, NormalizedEvidence>();
  for (const item of items ?? []) {
    if (!item || typeof item.path !== "string" || !validPath(item.path))
      return { ok: false, failure: metadataFailure("invalid", "Evidence path is not canonical.", typeof item?.path === "string" ? [item.path] : []) };
    if (typeof item.generation !== "string" || !validGeneration(item.generation))
      return { ok: false, failure: metadataFailure("invalid", "Evidence generation is invalid.", [item.path], { code: "invalid_input" }) };
    if (requireGeneration && item.generation !== pinnedGeneration)
      return { ok: false, failure: metadataFailure("invalid", "Selected evidence is outside the pinned generation.", [item.path], { code: "generation_mismatch" }) };
    const bytes = item.bytes === undefined ? undefined : toBytes(item.bytes);
    if (item.bytes !== undefined && !bytes)
      return { ok: false, failure: metadataFailure("invalid", "Evidence bytes are invalid.", [item.path], { code: "invalid_input" }) };
    if (bytes && !isValidUtf8(bytes))
      return { ok: false, failure: metadataFailure("invalid", "Evidence bytes are not valid UTF-8.", [item.path], { code: "invalid_input" }) };
    if (item.hash !== undefined && (typeof item.hash !== "string" || !SHA256.test(item.hash)))
      return { ok: false, failure: metadataFailure("invalid", "Evidence hash is invalid.", [item.path], { code: "invalid_hash" }) };
    if (item.dependencies !== undefined && !Array.isArray(item.dependencies))
      return { ok: false, failure: metadataFailure("invalid", "Evidence dependencies must be an array.", [item.path], { code: "invalid_input" }) };
    const rawDependencies: readonly unknown[] = item.dependencies ?? [];
    if (rawDependencies.some(dependency => typeof dependency !== "string" || !validPath(dependency)))
      return { ok: false, failure: metadataFailure("invalid", "Evidence dependency path is not canonical.", [item.path], { code: "invalid_path" }) };
    const dependencies = [...new Set(rawDependencies as readonly string[])].sort(comparePath);
    if (item.kind !== undefined && !["source", "page", "virtual"].includes(item.kind))
      return { ok: false, failure: metadataFailure("invalid", "Evidence kind is invalid.", [item.path], { code: "invalid_input" }) };
    const actualHash = bytes ? sha256(bytes) : undefined;
    if (item.hash !== undefined && actualHash !== undefined && item.hash !== actualHash)
      return { ok: false, failure: metadataFailure("invalid", "Evidence hash does not match supplied bytes.", [item.path], { code: "hash_mismatch" }) };
    const next: NormalizedEvidence = {
      path: item.path,
      generation: item.generation,
      dependencies,
      kind: item.kind ?? "source",
      ...(bytes ? { bytes } : {}),
      ...(item.hash !== undefined ? { assertedHash: item.hash } : {}),
    };
    const previous = byPath.get(item.path);
    if (!previous) {
      byPath.set(item.path, next);
      continue;
    }
    const previousHash = previous.bytes ? sha256(previous.bytes) : previous.assertedHash;
    const nextHash = next.bytes ? sha256(next.bytes) : next.assertedHash;
    if (previous.generation !== next.generation || (previousHash && nextHash && previousHash !== nextHash) ||
        previous.kind !== next.kind || JSON.stringify(previous.dependencies) !== JSON.stringify(next.dependencies))
      return { ok: false, failure: metadataFailure("invalid", "Duplicate evidence records have conflicting identities.", [item.path], { code: "conflicting_identity" }) };
    if (previous.bytes === undefined && next.bytes !== undefined) previous.bytes = next.bytes;
    if (previous.assertedHash === undefined && next.assertedHash !== undefined) previous.assertedHash = next.assertedHash;
  }
  return { ok: true, items: [...byPath.values()].sort((a, b) => comparePath(a.path, b.path)) };
}

function normalizeReadTimeEvidence(
  items: readonly ReadTimeEvidence[] | undefined,
): { ok: true; items: Map<string, { bytes?: Uint8Array; hash: string }> } | { ok: false; failure: EvidenceDeliveryFailure } {
  if (items !== undefined && !Array.isArray(items))
    return { ok: false, failure: metadataFailure("invalid", "Read-time evidence must be an array.", [], { code: "invalid_input" }) };
  const byPath = new Map<string, { bytes?: Uint8Array; hash: string }>();
  for (const item of items ?? []) {
    if (!item || typeof item.path !== "string" || !validPath(item.path))
      return { ok: false, failure: metadataFailure("invalid", "Read-time evidence path is not canonical.", typeof item?.path === "string" ? [item.path] : [], { code: "invalid_path" }) };
    if (item.bytes === undefined && item.hash === undefined)
      return { ok: false, failure: metadataFailure("invalid", "Read-time evidence requires bytes or a hash.", [item.path], { code: "invalid_input" }) };
    const bytes = item.bytes === undefined ? undefined : toBytes(item.bytes);
    if (item.bytes !== undefined && !bytes)
      return { ok: false, failure: metadataFailure("invalid", "Read-time evidence bytes are invalid.", [item.path], { code: "invalid_input" }) };
    if (bytes && !isValidUtf8(bytes))
      return { ok: false, failure: metadataFailure("invalid", "Read-time evidence bytes are not valid UTF-8.", [item.path], { code: "invalid_input" }) };
    const actual = bytes ? sha256(bytes) : item.hash;
    if (!actual || !SHA256.test(actual))
      return { ok: false, failure: metadataFailure("invalid", "Read-time evidence hash is invalid.", [item.path], { code: "invalid_hash" }) };
    if (item.hash !== undefined && item.hash !== actual)
      return { ok: false, failure: metadataFailure("invalid", "Read-time evidence hash does not match supplied bytes.", [item.path], { code: "hash_mismatch" }) };
    const previous = byPath.get(item.path);
    if (previous && (previous.hash !== actual ||
        (previous.bytes && bytes && Buffer.compare(Buffer.from(previous.bytes), Buffer.from(bytes)) !== 0)))
      return { ok: false, failure: metadataFailure("invalid", "Duplicate read-time evidence has conflicting identities.", [item.path], { code: "conflicting_identity" }) };
    byPath.set(item.path, { ...(bytes ? { bytes } : {}), hash: actual });
  }
  return { ok: true, items: byPath };
}

function packetSerializedBytes(packet: EvidencePacket): number {
  return Buffer.byteLength(JSON.stringify(packet), "utf8");
}

function emptyCounts(selectedCount = 0): EvidenceDeliveryCounts {
  return { selectedCount, sourceCount: selectedCount, readSetCount: selectedCount, dependencyCount: 0, bodyCount: 0, bodyBytes: 0, packetBytes: 0 };
}

/**
 * Select and bound evidence for a lifecycle owner.
 *
 * Caller preconditions: repository paths, virtual identities, publication
 * freshness, revision/topology, and overwrite policy have already been
 * resolved by the owning lifecycle. This function receives bytes only as
 * transient input; it never reads, writes, persists, or mutates lifecycle
 * state. Every selected identity is derived from fresh current bytes. A hash
 * without current bytes is never treated as a fresh read; read-time evidence
 * only verifies those current bytes and can authorize register omission.
 */
export function selectEvidenceDelivery(input: EvidenceDeliveryInput): EvidenceDeliveryResult {
  if (!input || !validGeneration(input.pinnedGeneration) || !["full", "delta", "register"].includes(input.mode))
    return metadataFailure("invalid", "Evidence delivery input is invalid.", [], { code: "invalid_input" });
  if (!Array.isArray(input.roots) || !Array.isArray(input.evidence))
    return metadataFailure("invalid", "Evidence roots and records are required.", [], { code: "invalid_input" });
  const limits = input.limits ?? {};
  if ([limits.maxSourceCount, limits.maxReadSetCount, limits.maxPacketBytes].some(value => value !== undefined && (!Number.isSafeInteger(value) || value < 0)))
    return metadataFailure("invalid", "Evidence delivery limits must be non-negative safe integers.", [], { code: "invalid_input" });

  const roots = [...new Set(input.roots)];
  if (roots.some(path => typeof path !== "string" || !validPath(path)))
    return metadataFailure("invalid", "Evidence root path is not canonical.", roots.filter(path => typeof path === "string"), { code: "invalid_path" });
  roots.sort(comparePath);

  const normalized = normalizeEvidenceList(input.evidence, input.pinnedGeneration, true);
  if (!normalized.ok) return normalized.failure;
  const byPath = new Map(normalized.items.map(item => [item.path, item]));
  const selected = new Set<string>();
  // Walk the exact closure iteratively so a valid long dependency chain cannot
  // exhaust the JavaScript call stack before the caller's limits are applied.
  const pending = [...roots].reverse();
  while (pending.length > 0) {
    const path = pending.pop()!;
    const item = byPath.get(path);
    if (!item) return metadataFailure("invalid", "Selected dependency is missing from the supplied closure.", [path], { code: "missing_dependency" });
    if (selected.has(path)) continue;
    selected.add(path);
    for (let index = item.dependencies.length - 1; index >= 0; index -= 1) {
      pending.push(item.dependencies[index]!);
    }
  }
  const unselected = normalized.items.filter(item => !selected.has(item.path)).map(item => item.path);
  if (unselected.length)
    return metadataFailure("invalid", "Supplied evidence contains records outside the exact selected closure.", unselected, { code: "unselected_record" });

  const readTime = normalizeReadTimeEvidence(input.readTimeEvidence);
  if (!readTime.ok) return readTime.failure;

  const prior = input.prior;
  let priorBinding: EvidenceIdentity[] | null = null;
  let priorBindingHash: string | null = null;
  const priorDelivered = new Map<string, EvidenceIdentity>();
  if (prior) {
    if (!prior.binding || !Array.isArray(prior.binding.identities) || !Array.isArray(prior.delivered) || prior.binding.pinnedGeneration !== input.pinnedGeneration || !SHA256.test(prior.binding.hash))
      return metadataFailure("invalid", "Prior evidence binding is invalid.", [], { code: "invalid_prior_binding" });
    const checkedBinding = checkIdentityList(prior.binding.identities, input.pinnedGeneration);
    const checkedDelivered = checkIdentityList(prior.delivered);
    if (!checkedBinding.ok || !checkedDelivered.ok || prior.binding.hash !== evidenceBindingHash(checkedBinding.identities))
      return metadataFailure("invalid", "Prior evidence binding failed identity verification.", [...(checkedBinding.ok ? [] : checkedBinding.paths), ...(checkedDelivered.ok ? [] : checkedDelivered.paths)], { code: "invalid_prior_binding" });
    priorBinding = checkedBinding.identities;
    priorBindingHash = prior.binding.hash;
    for (const identity of checkedDelivered.identities) {
      const basis = checkedBinding.identities.find(candidate => candidate.path === identity.path);
      if (!basis || identityKey(basis) !== identityKey(identity))
        return metadataFailure("invalid", "Prior delivery is not covered by its binding.", [identity.path], { code: "invalid_prior_binding" });
      priorDelivered.set(identity.path, identity);
    }
  }

  interface ResolvedEvidence extends NormalizedEvidence {
    hash: string;
    body?: Uint8Array;
  }
  const rereadPaths: string[] = [];
  const resolved: ResolvedEvidence[] = [];
  for (const item of normalized.items) {
    const read = readTime.items.get(item.path);
    if (!item.bytes) {
      rereadPaths.push(item.path);
      continue;
    }
    const hash = sha256(item.bytes);
    if (item.assertedHash !== undefined && item.assertedHash !== hash)
      return metadataFailure("invalid", "Evidence hash does not match supplied current bytes.", [item.path], { code: "hash_mismatch" });
    if (read) {
      if (read.hash !== hash || (read.bytes && Buffer.compare(Buffer.from(read.bytes), Buffer.from(item.bytes)) !== 0))
        return metadataFailure("invalid", "Read-time evidence does not match supplied current bytes.", [item.path], { code: "hash_mismatch" });
    }
    resolved.push({ ...item, hash, body: item.bytes });
  }
  if (rereadPaths.length)
    return metadataFailure("reread_required", "Fresh current bytes are required for selected evidence.", rereadPaths, { code: "reread_required" });

  const identities = resolved.map(item => ({ path: item.path, hash: item.hash, generation: item.generation }));
  const bindingHash = evidenceBindingHash(identities);
  const priorBindingStructurallyValid = priorBinding !== null && priorBindingHash === evidenceBindingHash(priorBinding);

  const delivered = new Map<string, EvidenceIdentity>();
  for (const item of resolved) delivered.set(item.path, { path: item.path, hash: item.hash, generation: item.generation });
  const entries: DeliveredEvidence[] = [];
  const omittedPaths: string[] = [];
  for (const item of resolved) {
    const priorIdentity = priorDelivered.get(item.path);
    const priorDeliveryValid = priorBindingStructurallyValid && priorIdentity !== undefined && identityKey(priorIdentity) === identityKey(delivered.get(item.path)!);
    let includeBody = false;
    if (input.mode === "full") {
      includeBody = true;
    } else if (input.mode === "delta") {
      includeBody = !priorDeliveryValid;
    } else {
      // Registration may reuse a valid prior delivery or an explicitly verified
      // read-time hash/byte assertion matched against the current bytes.
      includeBody = !priorDeliveryValid && !readTime.items.has(item.path);
    }
    if (includeBody && !item.body) {
      return metadataFailure("reread_required", "The selected mode requires a returned body for this evidence.", [item.path], { code: "reread_required" });
    }
    const entry: DeliveredEvidence = {
      path: item.path,
      generation: item.generation,
      hash: item.hash,
      dependencies: [...item.dependencies],
      ...(includeBody ? { content: decodeUtf8(item.body!) } : {}),
    };
    if (!includeBody) omittedPaths.push(item.path);
    entries.push(entry);
  }
  entries.sort((a, b) => comparePath(a.path, b.path));
  const packet: EvidencePacket = { version: 1, mode: input.mode, pinnedGeneration: input.pinnedGeneration, roots, entries };
  const packetBytes = packetSerializedBytes(packet);
  const bodyEntries = entries.filter(entry => entry.content !== undefined);
  const counts: EvidenceDeliveryCounts = {
    selectedCount: resolved.length,
    sourceCount: resolved.length,
    readSetCount: resolved.length,
    dependencyCount: Math.max(0, resolved.length - roots.length),
    bodyCount: bodyEntries.length,
    bodyBytes: bodyEntries.reduce((sum, entry) => sum + Buffer.byteLength(entry.content!, "utf8"), 0),
    packetBytes,
  };

  const evidenceLimits: EvidenceLimit[] = [];
  if (limits.maxSourceCount !== undefined && counts.sourceCount > limits.maxSourceCount)
    evidenceLimits.push({ limit: "maxSourceCount", actual: counts.sourceCount, maximum: limits.maxSourceCount, scope: "full-selected-transitive-closure" });
  if (limits.maxReadSetCount !== undefined && counts.readSetCount > limits.maxReadSetCount)
    evidenceLimits.push({ limit: "maxReadSetCount", actual: counts.readSetCount, maximum: limits.maxReadSetCount, scope: "full-selected-transitive-closure" });
  if (limits.maxPacketBytes !== undefined && counts.packetBytes > limits.maxPacketBytes)
    evidenceLimits.push({ limit: "maxPacketBytes", actual: counts.packetBytes, maximum: limits.maxPacketBytes, scope: "serialized-packet" });
  const countLimits = [limits.maxSourceCount, limits.maxReadSetCount].filter((value): value is number => value !== undefined);
  const suggestedMaxCount = countLimits.length ? Math.min(...countLimits) : undefined;
  if (evidenceLimits.length)
    return metadataFailure("evidence_limit", "Selected evidence exceeds the caller-provided limit; reduce scope or request continuation.", resolved.slice(0, MAX_DIAGNOSTIC_PATHS).map(item => item.path), {
      limits: evidenceLimits,
      counts,
      scopeReduction: {
        selectedCount: counts.selectedCount,
        ...(suggestedMaxCount === undefined ? {} : { suggestedMaxCount }),
        omittedBodyCount: omittedPaths.length,
        omittedPathCount: Math.max(0, resolved.length - MAX_DIAGNOSTIC_PATHS)
      },
    });

  const discoveryNormalized = normalizeEvidenceList(input.discovery, undefined, false);
  if (!discoveryNormalized.ok) return discoveryNormalized.failure;
  const discovery: EvidenceIdentity[] = [];
  for (const item of discoveryNormalized.items) {
    if (!item.bytes) return metadataFailure("invalid", "Discovery metadata must include bytes for hash verification.", [item.path], { code: "reread_required" });
    const hash = sha256(item.bytes);
    if (item.assertedHash !== undefined && item.assertedHash !== hash)
      return metadataFailure("invalid", "Discovery metadata hash does not match supplied bytes.", [item.path], { code: "hash_mismatch" });
    discovery.push({ path: item.path, hash, generation: item.generation });
  }
  discovery.sort(compareIdentity);

  return {
    status: "ok",
    mode: input.mode,
    pinnedGeneration: input.pinnedGeneration,
    packet,
    binding: { pinnedGeneration: input.pinnedGeneration, identities: canonicalIdentities(identities), hash: bindingHash },
    counts,
    omittedPaths: omittedPaths.sort(comparePath),
    discovery,
  };
}

/** Exact UTF-8 size used by the packet cap. */
export function serializeEvidencePacket(packet: EvidencePacket): string {
  return JSON.stringify(packet);
}
