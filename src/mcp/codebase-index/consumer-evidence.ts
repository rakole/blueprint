import {createHash} from "node:crypto";

import {
  PORTABLE_MAP_MAX_MODEL_PACKET_BYTES,
  portableSourceCoordinateSchema,
  repositoryRelativePathSchema,
  type PortableSourceCoordinate
} from "./contracts.js";
import {
  type PortableResolverDiagnostic,
  type PortableSelection,
  type PortableSelectionResult,
  PORTABLE_PIN_HANDOFF_PREDECESSOR_DEPTH,
  isPortablePinHandoff,
  isPortableDurablePinHandoff,
  restorePortablePinReceipt,
  resolveSelectedCodebaseEvidenceWithPortablePin,
  type PortableDurablePinHandoff,
  type PortablePinHandoff,
  type PortablePinReceipt,
  type PortableSourceBinding,
  type ResolveCodebaseNavigationOptions,
  resolveSelectedCodebaseEvidence
} from "./resolver.js";
import {
  selectEvidenceDelivery,
  type CanonicalEvidence,
  type EvidenceDeliveryFailure,
  type EvidenceDeliveryLimits,
  type EvidenceDeliverySuccess,
  type EvidenceMode,
  type EvidencePacket,
  type PriorEvidenceBinding,
  type PriorEvidenceDelivery,
  type ReadTimeEvidence
} from "../evidence-delivery.js";
import {inspectContentBoundaries} from "./content-boundary.js";
import {readHardenedLiteralFile} from "./literal-read.js";
import {sourcePathExclusionReason} from "./path-policy.js";

const SHA256 = /^[a-f0-9]{64}$/;
const MAX_DIAGNOSTIC_PATHS = 32;
const MAX_LITERAL_PAGE_BYTES = 32 * 1024 * 1024;
const MAX_LITERAL_SOURCE_BYTES = 128 * 1024 * 1024;
const CODEBASE_ROOT = ".blueprint/codebase";

/** A source correctness read, separate from a model-delivery identity. */
export type ConsumerReadSetEntry = {
  readonly path: string;
  readonly generation: string;
  readonly hash: string;
  readonly kind: "page" | "source";
  readonly fullFileHash?: string;
  readonly rangeHash?: string;
  readonly coordinate?: PortableSourceCoordinate;
  /** Present for a bounded source range whose delivered bytes are virtual. */
  readonly deliveryPath?: string;
};

export type ConsumerEvidenceBaseline = {
  /** Existing provider-selected evidence already in the lifecycle read set. */
  readonly selectedCount?: number;
  /** Existing provider read-set identities, including any source reads. */
  readonly readSetCount?: number;
};

export type ConsumerEvidenceInput = {
  readonly root: string;
  readonly selection: PortableSelection;
  readonly mode: EvidenceMode;
  /** Optional explicit generation target; this is proved by the resolver. */
  readonly generationId?: string;
  /** Non-serializable owner capability returned by verifyPortablePinHandoff. */
  readonly pinHandoff?: PortablePinHandoff;
  /** Serialized owner receipt restored through the repository-owned pin store. */
  readonly pinReceipt?: PortablePinReceipt;
  /** A prior binding is evidence input, never a trust grant. */
  readonly prior?: PriorEvidenceDelivery;
  readonly readTimeEvidence?: readonly ReadTimeEvidence[];
  readonly limits?: EvidenceDeliveryLimits;
  readonly baseline?: ConsumerEvidenceBaseline;
  readonly resolverOptions?: ResolveCodebaseNavigationOptions;
};

export type ConsumerEvidenceCounts = EvidenceDeliverySuccess["counts"];

export type ConsumerEvidenceSuccess = {
  readonly status: "ok";
  readonly mode: EvidenceMode;
  readonly generationId: string;
  readonly packet: EvidencePacket;
  readonly binding: PriorEvidenceBinding;
  readonly counts: ConsumerEvidenceCounts;
  /** Source and page identities actually re-read for this request. */
  readonly readSet: readonly ConsumerReadSetEntry[];
  /** The resolver proof that was created in this request and consumed here. */
  readonly snapshot: PortableSelectionResult["snapshot"];
  readonly selected: PortableSelectionResult["selected"];
  readonly diagnostics: readonly PortableResolverDiagnostic[];
};

export type ConsumerEvidenceFailureCode =
  | "invalid_input"
  | "discovery_only"
  | "resolver_failure"
  | "page_tampered"
  | "entry_tampered"
  | "source_tampered"
  | "unsafe_content"
  | "source_unreadable"
  | "invalid_range"
  | "evidence_limit"
  | "delivery_failure";

export type ConsumerEvidenceFailure = {
  readonly status: "fallback" | "invalid" | "not-found" | "reread_required" | "evidence_limit";
  readonly code: ConsumerEvidenceFailureCode;
  readonly reason: string;
  readonly paths: readonly string[];
  readonly diagnostics: readonly PortableResolverDiagnostic[];
  readonly delivery?: EvidenceDeliveryFailure;
  readonly counts?: ConsumerEvidenceCounts;
  readonly scopeReduction?: {
    readonly selectedCount: number;
    readonly suggestedMaxCount?: number;
    readonly omittedBodyCount: number;
    readonly omittedPathCount?: number;
  };
};

export type ConsumerEvidenceResult = ConsumerEvidenceSuccess | ConsumerEvidenceFailure;

type LiteralRead =
  | {readonly ok: true; readonly bytes: Uint8Array}
  | {readonly ok: false; readonly reason: "missing" | "unsafe" | "too-large" | "unreadable" | "changed"};

type RangeDelivery = {
  readonly binding: PortableSourceBinding;
  readonly deliveryPath: string;
  readonly bytes: Uint8Array;
  readonly hash: string;
};

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function safePath(value: string): boolean {
  return repositoryRelativePathSchema.safeParse(value).success;
}

function comparePath(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function readLiteral(root: string, relativePath: string, maxBytes: number): Promise<LiteralRead> {
  if (!safePath(relativePath)) return {ok: false, reason: "unsafe"};
  const result = await readHardenedLiteralFile(root, relativePath, maxBytes);
  if (result.ok) return result;
  return {ok: false, reason: result.reason === "unsafe" ? "unsafe" : result.reason};
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(bytes);
  } catch {
    return null;
  }
}

function positionAt(bytes: Uint8Array, offset: number): {line: number; column: number} {
  let line = 1;
  let column = 0;
  for (let index = 0; index < offset; index += 1) {
    if (bytes[index] === 0x0a) {
      line += 1;
      column = 0;
    } else {
      column += 1;
    }
  }
  return {line, column};
}

function validRange(bytes: Uint8Array, coordinate: unknown, expectedHash: string): coordinate is PortableSourceCoordinate {
  const parsed = portableSourceCoordinateSchema.safeParse(coordinate);
  if (!parsed.success || !SHA256.test(expectedHash)) return false;
  const value = parsed.data;
  if (value.start.byte > bytes.byteLength || value.end.byte > bytes.byteLength || value.start.byte > value.end.byte) return false;
  const start = positionAt(bytes, value.start.byte);
  const end = positionAt(bytes, value.end.byte);
  if (start.line !== value.start.line || start.column !== value.start.column ||
      end.line !== value.end.line || end.column !== value.end.column) return false;
  const selected = bytes.slice(value.start.byte, value.end.byte);
  return decodeUtf8(selected) !== null && sha256(selected) === expectedHash;
}

function rangeIdentity(generation: string, binding: PortableSourceBinding): string {
  const value = JSON.stringify([binding.path, binding.fullFileHash, binding.rangeHash, binding.coordinate]);
  return `@codebase/source-range/${generation}/${sha256(new TextEncoder().encode(value))}`;
}

function failure(
  status: ConsumerEvidenceFailure["status"],
  code: ConsumerEvidenceFailureCode,
  reason: string,
  paths: readonly string[] = [],
  diagnostics: readonly PortableResolverDiagnostic[] = [],
  extra: Partial<ConsumerEvidenceFailure> = {}
): ConsumerEvidenceFailure {
  return {
    status,
    code,
    reason,
    paths: [...new Set(paths.filter(item => safePath(item) || item.startsWith("@codebase/")))].sort(comparePath).slice(0, MAX_DIAGNOSTIC_PATHS),
    diagnostics,
    ...extra
  };
}

function mapResolverFailure(result: Exclude<Awaited<ReturnType<typeof resolveSelectedCodebaseEvidence>>, PortableSelectionResult>): ConsumerEvidenceFailure {
  const status = result.status === "fallback" ? "fallback" : result.status === "not-found" ? "not-found" : "invalid";
  return failure(status, "resolver_failure", "The selected portable map evidence could not be proved.", [], result.diagnostics);
}

function mapReadFailure(
  kind: "page" | "entry" | "source",
  relativePath: string,
  result: Exclude<LiteralRead, {ok: true}>,
): ConsumerEvidenceFailure {
  const code = kind === "entry" ? "entry_tampered" : kind === "page" ? "page_tampered" : result.reason === "changed" ? "source_tampered" : "source_unreadable";
  const status: ConsumerEvidenceFailure["status"] = result.reason === "missing" || result.reason === "changed" ? "reread_required" : "invalid";
  const reason = kind === "entry"
    ? "The immutable ENTRY could not be freshly verified."
    : kind === "page"
      ? "A selected generated page could not be freshly verified."
      : result.reason === "too-large"
        ? "The selected source is too large for bounded verification."
        : "A selected source could not be freshly verified.";
  return failure(status, code, reason, [relativePath]);
}

function pagePath(relativePath: string): string {
  return `${CODEBASE_ROOT}/${relativePath}`;
}

function normalizeLimits(limits: EvidenceDeliveryLimits | undefined): EvidenceDeliveryLimits | null {
  if (limits !== undefined && (!limits || typeof limits !== "object" || Array.isArray(limits))) return null;
  const hasPacketLimit = limits !== undefined && Object.hasOwn(limits, "maxPacketBytes");
  const normalized: EvidenceDeliveryLimits = {
    ...(limits ?? {}),
    maxPacketBytes: hasPacketLimit ? limits?.maxPacketBytes : PORTABLE_MAP_MAX_MODEL_PACKET_BYTES
  };
  for (const key of ["maxSourceCount", "maxReadSetCount", "maxPacketBytes"] as const) {
    const explicit = limits !== undefined && Object.hasOwn(limits, key);
    const value = normalized[key];
    if (explicit && (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)) return null;
  }
  return normalized;
}

function limitsFailure(
  delivery: EvidenceDeliverySuccess,
  limits: EvidenceDeliveryLimits,
  counts: ConsumerEvidenceCounts,
  readSet: readonly ConsumerReadSetEntry[]
): ConsumerEvidenceFailure | null {
  const evidenceLimits = [] as NonNullable<EvidenceDeliveryFailure["limits"]>;
  if (limits.maxSourceCount !== undefined && counts.sourceCount > limits.maxSourceCount) {
    evidenceLimits.push({limit: "maxSourceCount", actual: counts.sourceCount, maximum: limits.maxSourceCount, scope: "full-selected-transitive-closure"});
  }
  if (limits.maxReadSetCount !== undefined && counts.readSetCount > limits.maxReadSetCount) {
    evidenceLimits.push({limit: "maxReadSetCount", actual: counts.readSetCount, maximum: limits.maxReadSetCount, scope: "full-selected-transitive-closure"});
  }
  if (evidenceLimits.length === 0) return null;
  const suggested = Math.min(...evidenceLimits.map(item => item.maximum));
  return failure("evidence_limit", "evidence_limit", "Selected evidence exceeds the caller-provided limit; reduce scope or request continuation.", readSet.map(item => item.path), [], {
    counts,
    scopeReduction: {
      selectedCount: counts.selectedCount,
      suggestedMaxCount: suggested,
      omittedBodyCount: delivery.omittedPaths.length,
      omittedPathCount: Math.max(0, readSet.length - MAX_DIAGNOSTIC_PATHS)
    }
  } as Partial<ConsumerEvidenceFailure>);
}

/**
 * Resolve one consumer selection, re-read every selected page/source literally,
 * and shape the verified bytes through the pure full/delta/register helper.
 * This function has no session or persistence side effects.  In particular,
 * it never accepts a caller-provided resolver snapshot or pin as authority.
 */
export async function resolveConsumerEvidence(input: ConsumerEvidenceInput): Promise<ConsumerEvidenceResult> {
  if (!input || typeof input.root !== "string" || !input.selection || !["full", "delta", "register"].includes(input.mode)) {
    return failure("invalid", "invalid_input", "Consumer evidence input is invalid.");
  }
  if (input.selection.kind === "page") {
    return failure("invalid", "discovery_only", "Navigation and search pages are discovery-only evidence.");
  }

  if (input.pinHandoff !== undefined && !isPortablePinHandoff(input.pinHandoff)) {
    return failure("invalid", "invalid_input", "The portable pin handoff is not an owner-issued capability.");
  }

  let restoredHandoff: PortableDurablePinHandoff | undefined;
  if (input.pinReceipt !== undefined) {
    const restored = await restorePortablePinReceipt(input.root, input.pinReceipt, input.resolverOptions);
    if (restored.status !== "ok") return failure("invalid", "invalid_input", restored.reason);
    restoredHandoff = restored.handoff;
    if (input.pinHandoff && input.pinHandoff.generationId !== restoredHandoff.generationId) {
      return failure("invalid", "invalid_input", "The handoff and durable pin receipt identify different generations.");
    }
  }

  // A prior binding may select an immutable generation only after this fresh
  // resolver call proves its sealed lineage.  It is never passed as a trust
  // snapshot and cannot admit staged or unpublished bytes.
  const handoff = restoredHandoff ?? input.pinHandoff;
  if (handoff && input.generationId !== undefined && input.generationId !== handoff.generationId) {
    return failure("invalid", "invalid_input", "The requested generation does not match the owner-issued pin handoff.");
  }
  if (handoff && input.prior?.binding?.pinnedGeneration !== undefined && input.prior.binding.pinnedGeneration !== handoff.generationId) {
    return failure("invalid", "invalid_input", "The prior evidence binding does not match the owner-issued pin handoff.");
  }
  const requestedGenerationId = input.generationId ?? handoff?.generationId ?? input.prior?.binding?.pinnedGeneration;
  const resolverLimits = handoff && isPortableDurablePinHandoff(handoff)
    ? input.resolverOptions?.limits
    : handoff
      ? {...(input.resolverOptions?.limits ?? {}), predecessorDepth: handoff.predecessorDepth}
      : requestedGenerationId
      ? {...(input.resolverOptions?.limits ?? {}), predecessorDepth: input.resolverOptions?.limits?.predecessorDepth ?? PORTABLE_PIN_HANDOFF_PREDECESSOR_DEPTH}
      : input.resolverOptions?.limits;
  const resolverOptions: ResolveCodebaseNavigationOptions = {
    ...(input.resolverOptions ?? {}),
    ...(resolverLimits ? {limits: resolverLimits} : {}),
    ...(requestedGenerationId ? {requestedGenerationId} : {})
  };
  const selected = restoredHandoff
    ? await resolveSelectedCodebaseEvidenceWithPortablePin(input.root, input.selection, restoredHandoff, resolverOptions)
    : await resolveSelectedCodebaseEvidence(input.root, input.selection, resolverOptions);
  if (selected.status !== "ok") return mapResolverFailure(selected);
  if (selected.mode !== "implementation") return failure("invalid", "discovery_only", "Navigation and search pages are discovery-only evidence.", [], selected.diagnostics);
  if (handoff && (selected.snapshot.generationId !== handoff.generationId ||
      selected.snapshot.entry.path !== handoff.entry.path || selected.snapshot.entry.sha256 !== handoff.entry.sha256 ||
      selected.snapshot.manifest.path !== handoff.manifest.path || selected.snapshot.manifest.sha256 !== handoff.manifest.sha256)) {
    return failure("reread_required", "resolver_failure", "The owner-issued pin handoff no longer matches the freshly verified generation.", [], selected.diagnostics);
  }

  const snapshot = selected.snapshot;
  const expectedPages = new Map(snapshot.pages.map(page => [page.path, page.sha256]));
  const evidence = new Map<string, CanonicalEvidence>();
  const readSet = new Map<string, ConsumerReadSetEntry>();
  const rangeDeliveries: RangeDelivery[] = [];
  const sourceDeliveryByPath = new Map<string, string[]>();
  const sourceBytesByPath = new Map<string, Uint8Array>();
  const bindingsByKey = new Map<string, PortableSourceBinding>();

  const addReadSet = (item: ConsumerReadSetEntry): void => {
    const key = `${item.kind}\u0000${item.path}\u0000${item.rangeHash ?? ""}\u0000${item.deliveryPath ?? ""}`;
    readSet.set(key, item);
  };
  const addEvidence = (item: CanonicalEvidence): void => {
    const prior = evidence.get(item.path);
    if (!prior) evidence.set(item.path, item);
    else if (JSON.stringify({generation: prior.generation, hash: prior.hash, dependencies: prior.dependencies}) !== JSON.stringify({generation: item.generation, hash: item.hash, dependencies: item.dependencies})) {
      // This is an internal contradiction, never a model-visible body.
      throw new Error("conflicting consumer evidence identity");
    }
  };

  const immutableEntryPath = pagePath(snapshot.entry.path);
  const entryRead = await readLiteral(input.root, immutableEntryPath, MAX_LITERAL_PAGE_BYTES);
  if (!entryRead.ok) return mapReadFailure("entry", immutableEntryPath, entryRead);
  if (sha256(entryRead.bytes) !== snapshot.entry.sha256 || decodeUtf8(entryRead.bytes) === null) return failure("reread_required", "entry_tampered", "The immutable ENTRY changed after resolver verification.", [immutableEntryPath]);
  addEvidence({path: immutableEntryPath, generation: snapshot.generationId, kind: "page", bytes: entryRead.bytes, hash: snapshot.entry.sha256});
  addReadSet({path: immutableEntryPath, generation: snapshot.generationId, hash: snapshot.entry.sha256, kind: "page", deliveryPath: immutableEntryPath});

  for (const item of selected.entries) {
    const expectedHash = expectedPages.get(item.path);
    if (!expectedHash || expectedHash !== item.hash) return failure("invalid", "page_tampered", "The selected page proof is inconsistent with the request-local resolver snapshot.", [item.path]);
    const canonical = pagePath(item.path);
    const read = await readLiteral(input.root, canonical, MAX_LITERAL_PAGE_BYTES);
    if (!read.ok) return mapReadFailure("page", canonical, read);
    if (sha256(read.bytes) !== expectedHash || decodeUtf8(read.bytes) === null) return failure("reread_required", "page_tampered", "A selected generated page changed after resolver verification.", [canonical]);
    addReadSet({path: canonical, generation: snapshot.generationId, hash: expectedHash, kind: "page", deliveryPath: canonical});
    addEvidence({path: canonical, generation: snapshot.generationId, kind: "page", bytes: read.bytes, hash: expectedHash});
  }

  for (const binding of selected.sourceBindings) {
    const key = `${binding.path}\u0000${binding.fullFileHash}\u0000${binding.rangeHash ?? ""}\u0000${JSON.stringify(binding.coordinate ?? null)}`;
    if (bindingsByKey.has(key)) continue;
    bindingsByKey.set(key, binding);
    if (!safePath(binding.path) || !SHA256.test(binding.fullFileHash) || (binding.rangeHash !== undefined && !SHA256.test(binding.rangeHash))) {
      return failure("invalid", "invalid_input", "The selected source binding is not canonical.", [binding.path]);
    }
    if (sourcePathExclusionReason(binding.path)) {
      return failure("invalid", "source_unreadable", "The selected source path is excluded from transient evidence delivery.", [binding.path]);
    }
    let sourceBytes = sourceBytesByPath.get(binding.path);
    if (!sourceBytes) {
      const sourceRead = await readLiteral(input.root, binding.path, MAX_LITERAL_SOURCE_BYTES);
      if (!sourceRead.ok) return mapReadFailure("source", binding.path, sourceRead);
      if (sha256(sourceRead.bytes) !== binding.fullFileHash) return failure("reread_required", "source_tampered", "A selected source changed after map generation.", [binding.path]);
      sourceBytes = sourceRead.bytes;
      sourceBytesByPath.set(binding.path, sourceBytes);
    }
    const sourceText = decodeUtf8(sourceBytes);
    if (sourceText === null) return failure("invalid", "source_unreadable", "A selected source was not valid UTF-8 text.", [binding.path]);
    if (!inspectContentBoundaries(sourceText).safe) {
      // Apply the same deterministic boundary policy used during extraction.
      // The source bytes never enter evidence, diagnostics, or lifecycle state.
      return failure("invalid", "unsafe_content", "A selected source crossed a content boundary and was omitted.", [binding.path]);
    }
    if (binding.rangeHash !== undefined || binding.coordinate !== undefined) {
      if (binding.rangeHash === undefined || !validRange(sourceBytes, binding.coordinate, binding.rangeHash)) {
        return failure("invalid", "invalid_range", "A selected source range is not byte-accurate for the current source.", [binding.path]);
      }
      const coordinate = binding.coordinate as PortableSourceCoordinate;
      const rangeBytes = sourceBytes.slice(coordinate.start.byte, coordinate.end.byte);
      const deliveryPath = rangeIdentity(snapshot.generationId, binding);
      rangeDeliveries.push({binding, deliveryPath, bytes: rangeBytes, hash: binding.rangeHash});
      const paths = sourceDeliveryByPath.get(binding.path) ?? [];
      paths.push(deliveryPath);
      sourceDeliveryByPath.set(binding.path, paths);
      addReadSet({path: binding.path, generation: snapshot.generationId, hash: binding.fullFileHash, kind: "source", fullFileHash: binding.fullFileHash, rangeHash: binding.rangeHash, coordinate, deliveryPath});
    } else {
      addEvidence({path: binding.path, generation: snapshot.generationId, kind: "source", bytes: sourceBytes, hash: binding.fullFileHash});
      addReadSet({path: binding.path, generation: snapshot.generationId, hash: binding.fullFileHash, kind: "source", fullFileHash: binding.fullFileHash, deliveryPath: binding.path});
    }
  }

  for (const delivery of rangeDeliveries) {
    addEvidence({path: delivery.deliveryPath, generation: snapshot.generationId, kind: "virtual", bytes: delivery.bytes, hash: delivery.hash});
  }

  // Bind page-to-source edges to the bounded range identity when a semantic
  // page selected a source coordinate.  The full source hash remains in the
  // readSet above, while the packet carries only the selected range bytes.
  for (const item of selected.entries) {
    const canonical = pagePath(item.path);
    const current = evidence.get(canonical);
    if (!current) continue;
    const dependencies = item.dependencies.flatMap(dependency => sourceDeliveryByPath.get(dependency) ?? [dependency]).filter(dependency => evidence.has(dependency));
    evidence.set(canonical, {...current, dependencies: [...new Set(dependencies)].sort(comparePath)});
  }

  const roots = [immutableEntryPath, ...selected.entries.map(item => pagePath(item.path)), ...rangeDeliveries.map(item => item.deliveryPath), ...selected.sourceBindings.filter(item => item.rangeHash === undefined && item.coordinate === undefined).map(item => item.path)]
    .filter((item, index, all) => all.indexOf(item) === index)
    .sort(comparePath);
  const callerReadTime = input.readTimeEvidence ?? [];
  const readTimeByPath = new Map(callerReadTime.map(item => [item.path, item]));
  const deliveryReadTime: ReadTimeEvidence[] = [...callerReadTime];
  for (const range of rangeDeliveries) {
    const sourceRead = readTimeByPath.get(range.binding.path);
    if (sourceRead) {
      const sourceHash = sourceRead.bytes ? sha256(typeof sourceRead.bytes === "string" ? new TextEncoder().encode(sourceRead.bytes) : sourceRead.bytes) : sourceRead.hash;
      if (sourceHash === range.binding.fullFileHash) deliveryReadTime.push({path: range.deliveryPath, hash: range.hash});
    }
  }

  const deliveryLimits = normalizeLimits(input.limits);
  if (!deliveryLimits) return failure("invalid", "invalid_input", "Evidence delivery limits must be positive safe integers.");
  let delivered: ReturnType<typeof selectEvidenceDelivery>;
  try {
    delivered = selectEvidenceDelivery({
      pinnedGeneration: snapshot.generationId,
      mode: input.mode,
      roots,
      evidence: [...evidence.values()],
      prior: input.prior,
      readTimeEvidence: deliveryReadTime,
      limits: {maxPacketBytes: deliveryLimits.maxPacketBytes}
    });
  } catch {
    return failure("invalid", "delivery_failure", "Evidence delivery failed before any lifecycle state was changed.");
  }
  if (delivered.status !== "ok") {
    const status: ConsumerEvidenceFailure["status"] = delivered.status === "evidence_limit" ? "evidence_limit" : delivered.status === "reread_required" ? "reread_required" : "invalid";
    return failure(status, "delivery_failure", "Evidence delivery rejected the selected closure.", delivered.paths, [], {delivery: delivered});
  }

  const baselineSelected = input.baseline?.selectedCount ?? 0;
  const baselineReadSet = input.baseline?.readSetCount ?? 0;
  if (![baselineSelected, baselineReadSet].every(value => Number.isSafeInteger(value) && value >= 0)) {
    return failure("invalid", "invalid_input", "Evidence baseline counts must be non-negative safe integers.");
  }
  const counts: ConsumerEvidenceCounts = {
    ...delivered.counts,
    sourceCount: delivered.counts.selectedCount + baselineSelected,
    readSetCount: readSet.size + baselineReadSet
  };
  const limited = limitsFailure(delivered, deliveryLimits, counts, [...readSet.values()]);
  if (limited) return limited;

  return {
    status: "ok",
    mode: input.mode,
    generationId: snapshot.generationId,
    packet: delivered.packet,
    binding: delivered.binding,
    counts,
    readSet: [...readSet.values()].sort((left, right) => comparePath(left.path, right.path) || comparePath(left.deliveryPath ?? "", right.deliveryPath ?? "")),
    snapshot,
    selected: selected.selected,
    diagnostics: selected.diagnostics
  };
}

export const prepareConsumerEvidence = resolveConsumerEvidence;
export const resolvePortableConsumerEvidence = resolveConsumerEvidence;
