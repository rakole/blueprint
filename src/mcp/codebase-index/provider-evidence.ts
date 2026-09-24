import {createHash} from "node:crypto";
import * as z from "zod/v4";

import {
  PORTABLE_MAP_MAX_MODEL_PACKET_BYTES,
  portableSha256Schema,
  repositoryRelativePathSchema
} from "./contracts.js";
import {
  hashPortablePinnedMembers,
  isPortablePinHandoff,
  issuePortablePinReceipt,
  restorePortablePinReceipt,
  resolveCodebaseNavigation,
  type PortableDurablePinHandoff,
  type PortableImmutablePin,
  type PortablePinHandoff,
  type PortablePinReceipt,
  type PortablePinnedMemberHash,
  type PortableSelection,
  type ResolveCodebaseNavigationOptions
} from "./resolver.js";
import {
  resolveConsumerEvidence,
  type ConsumerEvidenceBaseline,
  type ConsumerEvidenceFailure,
  type ConsumerReadSetEntry
} from "./consumer-evidence.js";
import {
  evidenceBindingHash,
  selectEvidenceDelivery,
  type CanonicalEvidence,
  type EvidenceDeliveryFailure,
  type EvidenceDeliveryLimits,
  type EvidenceDeliverySuccess,
  type EvidenceIdentity,
  type EvidenceMode,
  type EvidencePacket,
  type PriorEvidenceDelivery,
  type ReadTimeEvidence
} from "../evidence-delivery.js";
import {readHardenedLiteralFile} from "./literal-read.js";

const SHA256 = /^[a-f0-9]{64}$/;
const MAX_DIAGNOSTIC_PATHS = 32;
const PROVIDER_SCHEMA_VERSION = 1 as const;

/** The nested delivery control avoids colliding with a lifecycle's own mode. */
export const portableProviderEvidenceModeSchema = z.enum(["full", "delta", "register"]);
export type PortableProviderEvidenceMode = z.infer<typeof portableProviderEvidenceModeSchema>;

const safeEvidencePathSchema = z.union([
  repositoryRelativePathSchema,
  z.string().regex(/^@[^/]+(?:\/[^/]+)*$/)
]);

export const portableProviderEvidenceIdentitySchema = z.strictObject({
  path: safeEvidencePathSchema,
  generation: z.string().min(1).max(256).refine(value => !/[\u0000-\u001f\u007f]/.test(value)),
  hash: portableSha256Schema
});

const deliveryLimitsSchema = z.strictObject({
  maxSourceCount: z.number().int().nonnegative().optional(),
  maxReadSetCount: z.number().int().nonnegative().optional(),
  maxPacketBytes: z.number().int().nonnegative().optional()
});

/**
 * Metadata that can safely cross a session boundary.  It contains hashes and
 * paths only; source and generated-page bodies are intentionally absent.
 */
export type PortableProviderEvidencePrior = PriorEvidenceDelivery & {
  readonly registered?: readonly EvidenceIdentity[];
};

export type PortableProviderEvidenceDelivery = {
  readonly mode: PortableProviderEvidenceMode;
  readonly prior?: PortableProviderEvidencePrior;
  readonly readTimeEvidence?: readonly ReadTimeEvidence[];
  readonly limits?: EvidenceDeliveryLimits;
  readonly baseline?: ConsumerEvidenceBaseline;
};

export const portableProviderEvidenceDeliverySchema = z.strictObject({
  mode: portableProviderEvidenceModeSchema,
  prior: z.strictObject({
    binding: z.strictObject({
      pinnedGeneration: z.string().min(1),
      identities: z.array(portableProviderEvidenceIdentitySchema),
      hash: portableSha256Schema
    }),
    delivered: z.array(portableProviderEvidenceIdentitySchema),
    registered: z.array(portableProviderEvidenceIdentitySchema).optional()
  }).optional(),
  readTimeEvidence: z.array(z.strictObject({
    path: safeEvidencePathSchema,
    bytes: z.union([z.string(), z.instanceof(Uint8Array)]).optional(),
    hash: portableSha256Schema.optional()
  })).optional(),
  limits: deliveryLimitsSchema.optional(),
  baseline: z.strictObject({
    selectedCount: z.number().int().nonnegative().optional(),
    readSetCount: z.number().int().nonnegative().optional()
  }).optional()
});

export type PortableProviderPinContext = {
  readonly pin: PortableImmutablePin;
  readonly receipt?: PortablePinReceipt;
};

const portableProviderPinSchema = z.strictObject({
  generationId: z.string().min(1).max(128),
  entry: z.strictObject({path: z.string().min(1), sha256: portableSha256Schema}),
  manifest: z.strictObject({path: z.string().min(1), sha256: portableSha256Schema})
});

export const portableProviderPinContextSchema = z.strictObject({
  pin: portableProviderPinSchema,
  // The receipt is intentionally metadata-only. Its authenticated owner
  // identity is checked by restorePortablePinReceipt before use.
  receipt: z.unknown().optional()
});

/** A common metadata-only pin/read-set shape for research-to-plan handoffs. */
export type PortableProviderPinnedMemberSet = {
  readonly pin?: PortableImmutablePin;
  readonly receipt?: PortablePinReceipt;
  /** Request-local owner capability; never persist this field. */
  readonly handoff?: PortablePinHandoff;
  readonly members: readonly string[];
};

export type PortableProviderEvidenceInput = {
  readonly root: string;
  /** Existing one-selection bridge spelling, retained for callers adopting this helper incrementally. */
  readonly selection?: PortableSelection;
  /** Multiple selections are merged into one exact closure. */
  readonly selections?: readonly PortableSelection[];
  readonly evidenceDelivery?: PortableProviderEvidenceDelivery;
  /** Backward-compatible shorthand; new providers should use evidenceDelivery. */
  readonly mode?: PortableProviderEvidenceMode;
  readonly prior?: PortableProviderEvidencePrior;
  readonly readTimeEvidence?: readonly ReadTimeEvidence[];
  readonly limits?: EvidenceDeliveryLimits;
  readonly baseline?: ConsumerEvidenceBaseline;
  readonly generationId?: string;
  readonly pinReceipt?: PortablePinReceipt;
  /** Request-local owner capability; never persist this field. */
  readonly pinHandoff?: PortablePinHandoff;
  readonly resolverOptions?: ResolveCodebaseNavigationOptions;
  /** Additional pinned bases used by a provider's freshness/read-set loop. */
  readonly pinnedMemberSets?: readonly PortableProviderPinnedMemberSet[];
};

export type PortableProviderEvidenceContext = {
  readonly generationId: string;
  readonly entry: EvidenceIdentity;
  readonly pin: PortableImmutablePin;
  readonly trustedPins: readonly PortableProviderPinContext[];
};

export const portableProviderEvidenceContextSchema = z.strictObject({
  generationId: z.string().min(1).max(128),
  entry: portableProviderEvidenceIdentitySchema,
  pin: portableProviderPinSchema,
  trustedPins: z.array(portableProviderPinContextSchema)
});

export type PortableProviderEvidenceReadSet = {
  readonly sourceAndPage: readonly ConsumerReadSetEntry[];
  readonly sealedMembers: readonly PortablePinnedMemberHash[];
};

export type PortableProviderEvidenceNext = {
  readonly schemaVersion: typeof PROVIDER_SCHEMA_VERSION;
  /** Every identity bound to the accepted evidence basis. */
  readonly bound: readonly EvidenceIdentity[];
  readonly bindingHash: string;
  /** Bodies actually present in this response or a prior delivered response. */
  readonly delivered: readonly EvidenceIdentity[];
  /** Current identities omitted only because an actual read-time hash was verified. */
  readonly registered: readonly EvidenceIdentity[];
  readonly readSet: PortableProviderEvidenceReadSet;
};

export type PortableProviderEvidenceBasis = {
  readonly schemaVersion: typeof PROVIDER_SCHEMA_VERSION;
  readonly generationId: string;
  readonly pin: PortableImmutablePin;
  readonly entry: EvidenceIdentity;
  readonly bound: readonly EvidenceIdentity[];
  readonly bindingHash: string;
  readonly readSet: PortableProviderEvidenceReadSet;
  readonly trustedPins: readonly PortableProviderPinContext[];
  readonly pinReceipt?: PortablePinReceipt;
};

export const portableProviderEvidenceNextSchema = z.strictObject({
  schemaVersion: z.literal(PROVIDER_SCHEMA_VERSION),
  bound: z.array(portableProviderEvidenceIdentitySchema),
  bindingHash: portableSha256Schema,
  delivered: z.array(portableProviderEvidenceIdentitySchema),
  registered: z.array(portableProviderEvidenceIdentitySchema),
  readSet: z.strictObject({
    sourceAndPage: z.array(z.unknown()),
    sealedMembers: z.array(z.strictObject({path: z.string().min(1), sha256: portableSha256Schema, generationId: z.string().min(1)}))
  })
});

export const portableProviderEvidenceBasisSchema = z.strictObject({
  schemaVersion: z.literal(PROVIDER_SCHEMA_VERSION),
  generationId: z.string().min(1).max(128),
  pin: portableProviderPinSchema,
  entry: portableProviderEvidenceIdentitySchema,
  bound: z.array(portableProviderEvidenceIdentitySchema),
  bindingHash: portableSha256Schema,
  readSet: z.strictObject({
    sourceAndPage: z.array(z.unknown()),
    sealedMembers: z.array(z.strictObject({path: z.string().min(1), sha256: portableSha256Schema, generationId: z.string().min(1)}))
  }),
  trustedPins: z.array(portableProviderPinContextSchema),
  pinReceipt: z.unknown().optional()
});

export const portableProviderEvidenceInputSchema = z.strictObject({
  root: z.string().min(1),
  selection: z.unknown().optional(),
  selections: z.array(z.unknown()).optional(),
  evidenceDelivery: portableProviderEvidenceDeliverySchema.optional(),
  mode: portableProviderEvidenceModeSchema.optional(),
  prior: z.unknown().optional(),
  readTimeEvidence: z.array(z.unknown()).optional(),
  limits: deliveryLimitsSchema.optional(),
  baseline: z.unknown().optional(),
  generationId: z.string().min(1).optional(),
  pinReceipt: z.unknown().optional(),
  pinHandoff: z.unknown().optional(),
  resolverOptions: z.unknown().optional(),
  pinnedMemberSets: z.array(z.unknown()).optional()
});

export type PortableProviderEvidenceSuccess = {
  readonly status: "ok";
  readonly schemaVersion: typeof PROVIDER_SCHEMA_VERSION;
  readonly mode: PortableProviderEvidenceMode;
  readonly context: PortableProviderEvidenceContext;
  /** Metadata-only accepted basis suitable for a provider session journal. */
  readonly basis: PortableProviderEvidenceBasis;
  /** ENTRY is included exactly once here when its body is delivered. */
  readonly packet: EvidencePacket;
  readonly binding: EvidenceDeliverySuccess["binding"];
  readonly counts: EvidenceDeliverySuccess["counts"];
  readonly next: PortableProviderEvidenceNext;
  /** Metadata only; present when a trusted receipt was supplied or prepared. */
  readonly pinReceipt?: PortablePinReceipt;
};

export type PortableProviderEvidenceFailure = {
  readonly status: "fallback" | "invalid" | "not-found" | "reread_required" | "evidence_limit";
  readonly code: string;
  readonly reason: string;
  readonly paths: readonly string[];
  readonly diagnostics?: readonly unknown[];
  readonly counts?: EvidenceDeliverySuccess["counts"];
  readonly scopeReduction?: EvidenceDeliveryFailure["scopeReduction"];
};

export type PortableProviderEvidenceResult = PortableProviderEvidenceSuccess | PortableProviderEvidenceFailure;

export type PortableProviderPinnedMemberSetsResult =
  | {readonly status: "ok"; readonly members: readonly PortablePinnedMemberHash[]; readonly pins: readonly PortableProviderPinContext[]}
  | PortableProviderEvidenceFailure;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function comparePath(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function safePath(value: string): boolean {
  return safeEvidencePathSchema.safeParse(value).success;
}

function failure(
  status: PortableProviderEvidenceFailure["status"],
  code: string,
  reason: string,
  paths: readonly string[] = [],
  extra: Partial<PortableProviderEvidenceFailure> = {}
): PortableProviderEvidenceFailure {
  return {
    status,
    code,
    reason,
    paths: [...new Set(paths.filter(pathValue => typeof pathValue === "string" && !/[\u0000-\u001f\u007f]/.test(pathValue)))].sort(comparePath).slice(0, MAX_DIAGNOSTIC_PATHS),
    ...extra
  };
}

function deliveryFor(input: PortableProviderEvidenceInput): PortableProviderEvidenceDelivery | null {
  const nested = input.evidenceDelivery;
  const shorthand = input.mode === undefined && input.prior === undefined && input.readTimeEvidence === undefined && input.limits === undefined && input.baseline === undefined
    ? undefined
    : {
      mode: input.mode ?? "full",
      ...(input.prior ? {prior: input.prior} : {}),
      ...(input.readTimeEvidence ? {readTimeEvidence: input.readTimeEvidence} : {}),
      ...(input.limits ? {limits: input.limits} : {}),
      ...(input.baseline ? {baseline: input.baseline} : {})
    } satisfies PortableProviderEvidenceDelivery;
  if (nested && input.mode !== undefined && nested.mode !== input.mode) return null;
  if (nested && input.prior && nested.prior && nested.prior.binding.hash !== input.prior.binding.hash) return null;
  return nested ?? shorthand ?? {mode: "full"};
}

function selectionList(input: PortableProviderEvidenceInput): readonly PortableSelection[] | null {
  if (input.selections !== undefined && !Array.isArray(input.selections)) return null;
  const values = [...(input.selections ?? []), ...(input.selection ? [input.selection] : [])];
  const seen = new Set<string>();
  const result: PortableSelection[] = [];
  for (const value of values) {
    if (!value || typeof value !== "object") return null;
    let key: string;
    try { key = JSON.stringify(value); } catch { return null; }
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

function identityKey(identity: EvidenceIdentity): string {
  return JSON.stringify([identity.path, identity.hash, identity.generation]);
}

function mergeIdentities(values: readonly EvidenceIdentity[]): EvidenceIdentity[] {
  const byKey = new Map<string, EvidenceIdentity>();
  for (const value of values) byKey.set(identityKey(value), {...value});
  return [...byKey.values()].sort((left, right) => comparePath(left.path, right.path) || comparePath(left.generation, right.generation) || comparePath(left.hash, right.hash));
}

function mergeReadSet(values: readonly ConsumerReadSetEntry[]): ConsumerReadSetEntry[] | null {
  const byKey = new Map<string, ConsumerReadSetEntry>();
  for (const value of values) {
    if (!safePath(value.path) || !SHA256.test(value.hash) || !value.generation) return null;
    const key = JSON.stringify([value.kind, value.path, value.generation, value.rangeHash ?? "", value.deliveryPath ?? ""]);
    const prior = byKey.get(key);
    if (prior && (prior.hash !== value.hash || prior.fullFileHash !== value.fullFileHash)) return null;
    byKey.set(key, {...value});
  }
  return [...byKey.values()].sort((left, right) => comparePath(left.path, right.path) || comparePath(left.deliveryPath ?? "", right.deliveryPath ?? ""));
}

function mergeEvidence(
  target: Map<string, CanonicalEvidence>,
  packet: EvidencePacket
): boolean {
  for (const entry of packet.entries) {
    if (entry.content === undefined) return false;
    const bytes = new TextEncoder().encode(entry.content);
    if (sha256(bytes) !== entry.hash || !safePath(entry.path)) return false;
    const kind = entry.path.startsWith("@") ? "virtual" as const : entry.path.startsWith(".blueprint/codebase/") ? "page" as const : "source" as const;
    const candidate: CanonicalEvidence = {
      path: entry.path,
      generation: entry.generation,
      bytes,
      hash: entry.hash,
      dependencies: entry.dependencies,
      kind
    };
    const prior = target.get(entry.path);
    if (!prior) target.set(entry.path, candidate);
    else {
      const priorHash = prior.hash ?? (prior.bytes ? sha256(prior.bytes instanceof Uint8Array ? prior.bytes : new TextEncoder().encode(prior.bytes)) : "");
      if (prior.generation !== candidate.generation || priorHash !== candidate.hash) return false;
      const dependencies = [...new Set([...(prior.dependencies ?? []), ...(candidate.dependencies ?? [])])].sort(comparePath);
      target.set(entry.path, {...prior, dependencies});
    }
  }
  return true;
}

function packetIdentity(entry: {path: string; generation: string; hash: string}): EvidenceIdentity {
  return {path: entry.path, generation: entry.generation, hash: entry.hash};
}

function normalizeDeliveryLimits(limits: EvidenceDeliveryLimits | undefined): EvidenceDeliveryLimits | null {
  if (limits !== undefined && (!limits || typeof limits !== "object" || Array.isArray(limits))) return null;
  const result = {...(limits ?? {})};
  for (const value of Object.values(result)) if (!Number.isSafeInteger(value) || value < 0) return null;
  return {maxPacketBytes: PORTABLE_MAP_MAX_MODEL_PACKET_BYTES, ...result};
}

function providerCounts(
  delivery: EvidenceDeliverySuccess,
  readSet: readonly ConsumerReadSetEntry[],
  sealedMembers: readonly PortablePinnedMemberHash[],
  baseline: ConsumerEvidenceBaseline | undefined
): EvidenceDeliverySuccess["counts"] {
  const selectedCount = delivery.counts.selectedCount + (baseline?.selectedCount ?? 0);
  const readSetCount = new Set([
    ...readSet.map(item => `${item.generation}\u0000${item.path}\u0000${item.deliveryPath ?? ""}`),
    ...sealedMembers.map(item => `${item.generationId}\u0000${item.path}`)
  ]).size + (baseline?.readSetCount ?? 0);
  return {...delivery.counts, sourceCount: selectedCount, selectedCount, readSetCount};
}

function limitFailure(counts: EvidenceDeliverySuccess["counts"], limits: EvidenceDeliveryLimits): PortableProviderEvidenceFailure | null {
  const failures: NonNullable<EvidenceDeliveryFailure["limits"]> = [];
  if (limits.maxSourceCount !== undefined && counts.sourceCount > limits.maxSourceCount) failures.push({limit: "maxSourceCount", actual: counts.sourceCount, maximum: limits.maxSourceCount, scope: "full-selected-transitive-closure"});
  if (limits.maxReadSetCount !== undefined && counts.readSetCount > limits.maxReadSetCount) failures.push({limit: "maxReadSetCount", actual: counts.readSetCount, maximum: limits.maxReadSetCount, scope: "full-selected-transitive-closure"});
  if (!failures.length) return null;
  return failure("evidence_limit", "evidence_limit", "Selected portable evidence exceeds the caller-provided limit; reduce scope or request continuation.", [], {
    counts,
    scopeReduction: {
      selectedCount: counts.selectedCount,
      suggestedMaxCount: Math.min(...failures.map(item => item.maximum)),
      omittedBodyCount: 0,
      omittedPathCount: counts.selectedCount
    }
  });
}

function mapConsumerFailure(result: ConsumerEvidenceFailure): PortableProviderEvidenceFailure {
  return failure(result.status, result.code, result.reason, result.paths, {
    diagnostics: result.diagnostics,
    ...(result.counts ? {counts: result.counts} : {}),
    ...(result.scopeReduction ? {scopeReduction: result.scopeReduction} : {})
  });
}

async function directEntry(
  root: string,
  pin: PortableImmutablePin
): Promise<{ok: true; bytes: Uint8Array} | {ok: false; result: PortableProviderEvidenceFailure}> {
  const relative = `.blueprint/codebase/${pin.entry.path}`;
  const read = await readHardenedLiteralFile(root, relative, 4 * 1024);
  if (!read.ok || sha256(read.bytes) !== pin.entry.sha256) return {ok: false, result: failure("reread_required", "entry_tampered", "The pinned ENTRY could not be freshly verified.", [relative])};
  try { new TextDecoder("utf-8", {fatal: true}).decode(read.bytes); }
  catch { return {ok: false, result: failure("invalid", "entry_unreadable", "The pinned ENTRY is not valid UTF-8 text.", [relative])}; }
  return {ok: true, bytes: read.bytes};
}

async function navigationEntry(
  root: string,
  input: PortableProviderEvidenceInput,
  requestedGenerationId: string | undefined
): Promise<{ok: true; pin: PortableImmutablePin; entryBytes: Uint8Array} | {ok: false; result: PortableProviderEvidenceFailure}> {
  if (input.pinReceipt !== undefined) {
    const restored = await restorePortablePinReceipt(root, input.pinReceipt, input.resolverOptions);
    if (restored.status !== "ok") return {ok: false, result: failure("invalid", "invalid_pin_receipt", restored.reason)};
    if (requestedGenerationId && requestedGenerationId !== restored.handoff.generationId) return {ok: false, result: failure("invalid", "pin_generation_mismatch", "The requested generation does not match the authenticated pin.")};
    const read = await directEntry(root, restored.handoff);
    return read.ok ? {ok: true, pin: restored.handoff, entryBytes: read.bytes} : read;
  }
  if (input.pinHandoff !== undefined && !isPortablePinHandoff(input.pinHandoff)) return {ok: false, result: failure("invalid", "invalid_pin_handoff", "The portable pin handoff is not an owner-issued capability.")};
  if (input.pinHandoff) {
    if (requestedGenerationId && requestedGenerationId !== input.pinHandoff.generationId) return {ok: false, result: failure("invalid", "pin_generation_mismatch", "The requested generation does not match the owner-issued pin.")};
    const read = await directEntry(root, input.pinHandoff);
    return read.ok ? {ok: true, pin: input.pinHandoff, entryBytes: read.bytes} : read;
  }
  const resolved = await resolveCodebaseNavigation(root, {...(input.resolverOptions ?? {}), ...(requestedGenerationId ? {requestedGenerationId} : {})});
  if (resolved.status !== "ok") return {ok: false, result: failure("fallback", "portable_unavailable", resolved.fallback.guidance, [], {diagnostics: resolved.diagnostics})};
  // The navigation result is a compact descriptor. Re-read the immutable
  // entry as bytes so its hash is based on the exact sealed bytes (including
  // BOM/line endings), rather than on a decoded response string.
  const read = await directEntry(root, resolved.pin);
  return read.ok ? {ok: true, pin: resolved.pin, entryBytes: read.bytes} : read;
}

/**
 * Authenticate and hash one or more pinned generation member sets.  This is
 * the common metadata-only freshness primitive for providers that carry a
 * research basis from one generation while preparing against another.
 */
export async function hashPortableProviderMemberSets(
  root: string,
  sets: readonly PortableProviderPinnedMemberSet[],
  options: ResolveCodebaseNavigationOptions = {}
): Promise<PortableProviderPinnedMemberSetsResult> {
  if (!Array.isArray(sets)) return failure("invalid", "invalid_pin_sets", "Pinned member sets must be an array.");
  const all = new Map<string, PortablePinnedMemberHash>();
  const pins = new Map<string, PortableProviderPinContext>();
  for (const set of sets) {
    if (!set || !Array.isArray(set.members)) return failure("invalid", "invalid_pin_set", "A pinned member set is malformed.");
    let handoff: PortableDurablePinHandoff | PortablePinHandoff | undefined;
    let receipt = set.receipt;
    if (receipt) {
      const restored = await restorePortablePinReceipt(root, receipt, options);
      if (restored.status !== "ok") return failure("invalid", "invalid_pin_receipt", restored.reason);
      handoff = restored.handoff;
      receipt = restored.receipt;
    } else if (set.handoff && isPortablePinHandoff(set.handoff)) {
      handoff = set.handoff;
    } else {
      return failure("invalid", "missing_pin_receipt", "A pinned member set requires an owner-authenticated receipt or request-local handoff.");
    }
    if (!handoff || !isPortablePinHandoff(handoff)) return failure("invalid", "invalid_pin_handoff", "Pinned freshness reads require an owner-authenticated handoff.");
    if (set.pin && (set.pin.generationId !== handoff.generationId || set.pin.entry.sha256 !== handoff.entry.sha256 || set.pin.manifest.sha256 !== handoff.manifest.sha256)) {
      return failure("invalid", "pin_mismatch", "Pinned member metadata does not match the authenticated receipt.");
    }
    const result = await hashPortablePinnedMembers(root, handoff, set.members, options);
    if (result.status !== "ok") return failure("invalid", "pinned_member_unavailable", result.reason, result.paths, {diagnostics: result.diagnostics});
    pins.set(handoff.generationId, {pin: {generationId: handoff.generationId, entry: handoff.entry, manifest: handoff.manifest}, ...(receipt ? {receipt} : {})});
    for (const member of result.members) {
      const key = `${member.generationId}\u0000${member.path}`;
      const previous = all.get(key);
      if (previous && previous.sha256 !== member.sha256) return failure("invalid", "conflicting_pin_member", "Pinned member sets contain conflicting hashes.", [member.path]);
      all.set(key, member);
    }
  }
  return {status: "ok", members: [...all.values()].sort((left, right) => left.generationId.localeCompare(right.generationId) || comparePath(left.path, right.path)), pins: [...pins.values()].sort((left, right) => comparePath(left.pin.generationId, right.pin.generationId))};
}

/** Resolve compact ENTRY context plus optional selected portable evidence. */
export async function resolvePortableProviderEvidence(input: PortableProviderEvidenceInput): Promise<PortableProviderEvidenceResult> {
  if (!input || typeof input.root !== "string" || input.root.length === 0) return failure("invalid", "invalid_input", "Portable provider evidence input is invalid.");
  const delivery = deliveryFor(input);
  if (!delivery) return failure("invalid", "ambiguous_delivery", "Evidence delivery controls conflict; use one nested evidenceDelivery mode.");
  if (!portableProviderEvidenceDeliverySchema.safeParse(delivery).success) return failure("invalid", "invalid_delivery", "Evidence delivery metadata is malformed.");
  const limits = normalizeDeliveryLimits(delivery.limits);
  if (!limits) return failure("invalid", "invalid_limits", "Evidence delivery limits must be non-negative safe integers.");
  const selections = selectionList(input);
  if (!selections) return failure("invalid", "invalid_selection", "Portable selections must be canonical objects.");
  if (delivery.baseline && (!Number.isSafeInteger(delivery.baseline.selectedCount ?? 0) || !Number.isSafeInteger(delivery.baseline.readSetCount ?? 0) || (delivery.baseline.selectedCount ?? 0) < 0 || (delivery.baseline.readSetCount ?? 0) < 0)) return failure("invalid", "invalid_baseline", "Evidence baseline counts must be non-negative safe integers.");
  if (input.pinHandoff && !isPortablePinHandoff(input.pinHandoff)) return failure("invalid", "invalid_pin_handoff", "The portable pin handoff is not an owner-issued capability.");

  const receiptGeneration = input.pinReceipt && typeof input.pinReceipt === "object" && input.pinReceipt.pin && typeof input.pinReceipt.pin.generationId === "string"
    ? input.pinReceipt.pin.generationId
    : undefined;
  const requestedGenerationId = input.generationId ?? input.pinHandoff?.generationId ?? receiptGeneration ?? delivery.prior?.binding.pinnedGeneration;
  const evidence = new Map<string, CanonicalEvidence>();
  const roots = new Set<string>();
  const readSets: ConsumerReadSetEntry[] = [];
  const selected = new Map<string, {kind: string; recordId?: string; page: string}>();
  let generationId: string | null = null;
  let pin: PortableImmutablePin | null = null;
  let entryIdentity: EvidenceIdentity | null = null;
  let pinReceipt = input.pinReceipt;

  if (selections.length === 0) {
    const navigation = await navigationEntry(input.root, input, requestedGenerationId);
    if (!navigation.ok) return navigation.result;
    pin = navigation.pin;
    generationId = pin.generationId;
    const entryPath = `.blueprint/codebase/${pin.entry.path}`;
    entryIdentity = {path: entryPath, generation: pin.generationId, hash: pin.entry.sha256};
    evidence.set(entryPath, {path: entryPath, generation: pin.generationId, bytes: navigation.entryBytes, hash: pin.entry.sha256, kind: "page"});
    roots.add(entryPath);
    readSets.push({path: entryPath, generation: pin.generationId, hash: pin.entry.sha256, kind: "page", deliveryPath: entryPath});
  } else {
    for (const selection of selections) {
      const result = await resolveConsumerEvidence({
        root: input.root,
        selection,
        mode: "full",
        generationId: requestedGenerationId,
        pinReceipt,
        pinHandoff: input.pinHandoff,
        resolverOptions: input.resolverOptions
      });
      if (result.status !== "ok") return mapConsumerFailure(result);
      if (!generationId) generationId = result.generationId;
      if (generationId !== result.generationId) return failure("invalid", "mixed_generations", "Portable selections must resolve to one generation per evidence packet.");
      if (!pin) pin = {generationId: result.snapshot.generationId, entry: result.snapshot.entry, manifest: result.snapshot.manifest};
      if (!entryIdentity) entryIdentity = {path: `.blueprint/codebase/${result.snapshot.entry.path}`, generation: result.generationId, hash: result.snapshot.entry.sha256};
      if (!mergeEvidence(evidence, result.packet)) return failure("invalid", "conflicting_evidence", "Selected portable evidence contains conflicting identities.");
      for (const root of result.packet.roots) roots.add(root);
      const merged = mergeReadSet([...readSets, ...result.readSet]);
      if (!merged) return failure("invalid", "conflicting_read_set", "Selected portable evidence contains conflicting read-set identities.");
      readSets.splice(0, readSets.length, ...merged);
      for (const item of result.selected) selected.set(JSON.stringify(item), item);
    }
  }
  if (!pin || !generationId || !entryIdentity) return failure("invalid", "missing_pin", "Portable provider evidence did not establish an immutable generation pin.");

  const memberSets = input.pinnedMemberSets ?? [];
  const pinnedMembers = memberSets.length ? await hashPortableProviderMemberSets(input.root, memberSets, input.resolverOptions) : {status: "ok" as const, members: [], pins: []};
  if (pinnedMembers.status !== "ok") return pinnedMembers;
  const trustedPins = new Map<string, PortableProviderPinContext>();
  trustedPins.set(pin.generationId, {pin, ...(pinReceipt ? {receipt: pinReceipt} : {})});
  for (const trusted of pinnedMembers.pins) trustedPins.set(trusted.pin.generationId, trusted);

  const shaped = selectEvidenceDelivery({
    pinnedGeneration: generationId,
    mode: delivery.mode,
    roots: [...roots].sort(comparePath),
    evidence: [...evidence.values()],
    prior: delivery.prior,
    readTimeEvidence: delivery.readTimeEvidence,
    limits: {maxPacketBytes: limits.maxPacketBytes}
  });
  if (shaped.status !== "ok") {
    const status = shaped.status === "evidence_limit" ? "evidence_limit" : shaped.status === "reread_required" ? "reread_required" : "invalid";
    return failure(status, shaped.code ?? "delivery_failure", shaped.reason, shaped.paths, {counts: shaped.counts, scopeReduction: shaped.scopeReduction});
  }
  const mergedReadSet = mergeReadSet(readSets);
  if (!mergedReadSet) return failure("invalid", "conflicting_read_set", "Portable read-set identities conflict.");
  const counts = providerCounts(shaped, mergedReadSet, pinnedMembers.members, delivery.baseline);
  const limited = limitFailure(counts, limits);
  if (limited) return limited;
  const bound = shaped.binding.identities;
  const priorDelivered = delivery.prior?.delivered ?? [];
  const delivered = mergeIdentities([...priorDelivered, ...shaped.packet.entries.filter(entry => entry.content !== undefined).map(packetIdentity)]).filter(item => bound.some(boundItem => identityKey(boundItem) === identityKey(item)));
  const readTimePaths = new Set((delivery.readTimeEvidence ?? []).map(item => item.path));
  const registered = mergeIdentities(shaped.packet.entries.filter(entry => entry.content === undefined && readTimePaths.has(entry.path)).map(packetIdentity));
  const nextReadSet: PortableProviderEvidenceReadSet = {sourceAndPage: mergedReadSet, sealedMembers: pinnedMembers.members};
  const trustedPinList = [...trustedPins.values()].sort((left, right) => comparePath(left.pin.generationId, right.pin.generationId));
  const bindingHash = evidenceBindingHash(bound);
  const basis: PortableProviderEvidenceBasis = {
    schemaVersion: PROVIDER_SCHEMA_VERSION,
    generationId,
    pin,
    entry: entryIdentity,
    bound,
    bindingHash,
    readSet: nextReadSet,
    trustedPins: trustedPinList,
    ...(pinReceipt ? {pinReceipt} : {})
  };
  return {
    status: "ok",
    schemaVersion: PROVIDER_SCHEMA_VERSION,
    mode: delivery.mode,
    context: {
      generationId,
      entry: entryIdentity,
      pin,
      trustedPins: trustedPinList
    },
    basis,
    packet: shaped.packet,
    binding: shaped.binding,
    counts,
    next: {
      schemaVersion: PROVIDER_SCHEMA_VERSION,
      bound,
      bindingHash,
      delivered,
      registered,
      readSet: nextReadSet
    },
    ...(pinReceipt ? {pinReceipt} : {})
  };
}

/** Owning prepare wrapper.  Navigation/resolution never provisions a receipt. */
export async function preparePortableProviderEvidence(input: PortableProviderEvidenceInput): Promise<PortableProviderEvidenceResult> {
  const result = await resolvePortableProviderEvidence(input);
  if (result.status !== "ok" || result.pinReceipt) return result;
  const issued = await issuePortablePinReceipt(input.root, result.context.pin, input.resolverOptions);
  if (issued.status !== "ok") return failure("invalid", "pin_receipt_failed", issued.reason);
  return {...result, pinReceipt: issued.receipt, basis: {...result.basis, pinReceipt: issued.receipt}};
}

/** Compact aliases for provider owners that call this operation a context read. */
export const resolvePortableProviderContext = resolvePortableProviderEvidence;
export const preparePortableProviderContext = preparePortableProviderEvidence;
