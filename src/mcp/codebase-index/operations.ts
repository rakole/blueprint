import {createHash, createHmac, randomBytes} from "node:crypto";
import {constants as fsConstants} from "node:fs";
import {promises as fs} from "node:fs";
import path from "node:path";
import * as z from "zod/v4";

import {CODEBASE_DOCUMENT_IDS} from "../codebase-authoring.js";
import {withBlueprintRepoLock} from "../tools/artifacts.js";
import {
  PORTABLE_MAP_MAX_MODEL_PACKET_BYTES,
  PORTABLE_MAP_OPERATION_METADATA_VERSION,
  generationLocalIdSchema,
  portableModelPacketSchema,
  portableSha256Schema,
  portableSourceBasisSchema,
  portableStructuralInventorySchema,
  portableTargetHashesSchema,
  serializedUtf8ByteLength,
  type PortableModelPacket,
  type PortableOperationMetadata,
  type PortableSourceBasis
} from "./contracts.js";
import {portableAuthoritativeSourceBasisSchema} from "./model-validation.js";
import {
  extractPortableRepository,
  capturePortableSourceFreshness,
  packetizePortableModelEvidence,
  type ExtractionRootIdentity,
  type ModelPacketResult,
  type PortableExtractionSuccess
} from "./extraction.js";
import {
  capturePortablePublicationPreflight,
  type PortablePublicationPreflight
} from "./publication.js";

/** Operational state intentionally lives beside, but outside, the portable bundle. */
export const PORTABLE_OPERATIONS_ROOT = ".blueprint/codebase-operations";
export const PORTABLE_OPERATION_METADATA_FILE = "metadata.json";
export const PORTABLE_OPERATION_MARKER_FILE = "operation.json";
export const PORTABLE_OPERATION_STRUCTURAL_FILE = "structural.json";
export const PORTABLE_OPERATION_AUTHORITY_FILE = "authority.json";
export const PORTABLE_OPERATION_PROVENANCE_FILE = "provenance.json";
export const PORTABLE_OPERATION_PACKETS_FILE = "packets.json";
export const PORTABLE_OPERATION_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;
/** Reserve deterministic server-owned room for the complete public receipt envelope. */
export const PORTABLE_OPERATION_RECEIPT_ENVELOPE_RESERVE_BYTES = 4 * 1024;
export const PORTABLE_OPERATION_PACKET_BUDGET_BYTES = PORTABLE_MAP_MAX_MODEL_PACKET_BYTES - PORTABLE_OPERATION_RECEIPT_ENVELOPE_RESERVE_BYTES;

/** Fixture-only seam for exercising the post-bind filesystem recheck. */
export const portableOperationTestHooks: {
  beforeAtomicWrite?: (relativePath: string) => Promise<void> | void;
  afterTempWrite?: (relativePath: string) => Promise<void> | void;
} = {};

const safeNonNegativeInteger = z.number().int().nonnegative().refine(Number.isSafeInteger, "Expected a safe integer.");
const safePositiveInteger = safeNonNegativeInteger.positive();
const boundedPath = z.string().min(1).max(4096).refine(value => !/[\0]/.test(value), "Path contains a NUL byte.");
const opaqueSecret = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime({offset: true});
const digest = portableSha256Schema;

const identitySchema = z.strictObject({
  path: boundedPath,
  realPath: boundedPath,
  device: safeNonNegativeInteger,
  inode: safeNonNegativeInteger,
  ancestors: z.array(z.strictObject({
    path: boundedPath,
    device: safeNonNegativeInteger,
    inode: safeNonNegativeInteger
  })).max(256)
});
type RootIdentity = z.infer<typeof identitySchema>;

const provenanceSchema = z.strictObject({
  runtime: z.strictObject({
    package: z.string().min(1).max(256), version: z.string().min(1).max(128), packageSha256: digest,
    module: z.string().min(1).max(256), moduleSha256: digest, wasm: z.string().min(1).max(256), wasmSha256: digest,
    languageVersion: safeNonNegativeInteger, minimumCompatibleVersion: safeNonNegativeInteger
  }),
  grammars: z.array(z.strictObject({
    package: z.string().min(1).max(256), version: z.string().min(1).max(128), packageSha256: digest,
    asset: z.string().min(1).max(256), sha256: digest, abiVersion: safeNonNegativeInteger
  })).max(128),
  adapters: z.array(z.strictObject({
    name: z.enum(["javascript", "python", "java"]), ruleVersion: z.string().min(1).max(128)
  })).max(16)
});

const coverageSchema = z.strictObject({
  candidateCount: safeNonNegativeInteger,
  includedCount: safeNonNegativeInteger,
  excludedCount: safeNonNegativeInteger,
  exclusions: z.array(z.strictObject({reason: z.string().min(1).max(64), count: safeNonNegativeInteger})).max(128),
  structural: z.strictObject({
    filesInventoried: safeNonNegativeInteger,
    filesWithFullCoverage: safeNonNegativeInteger,
    filesWithFileCoverage: safeNonNegativeInteger,
    symbolsExtracted: safeNonNegativeInteger,
    importsExtracted: safeNonNegativeInteger,
    relationshipsExtracted: safeNonNegativeInteger
  })
});

const fileRefSchema = z.strictObject({
  path: z.enum([
    PORTABLE_OPERATION_STRUCTURAL_FILE,
    PORTABLE_OPERATION_AUTHORITY_FILE,
    PORTABLE_OPERATION_PROVENANCE_FILE,
    PORTABLE_OPERATION_PACKETS_FILE
  ]),
  checksum: digest,
  byteSize: safeNonNegativeInteger
});

const publicationSchema = z.strictObject({
  repositoryRoot: boundedPath,
  operationId: generationLocalIdSchema,
  transactionId: generationLocalIdSchema,
  generationId: generationLocalIdSchema,
  sourceBasis: portableSourceBasisSchema,
  rootFingerprint: digest,
  previousGenerationId: generationLocalIdSchema.nullable(),
  previousIndexHash: digest.nullable(),
  previousTargetHashes: portableTargetHashesSchema,
  observedMarkerHash: digest.nullable(),
  legacyBackup: z.boolean(),
  repair: z.union([
    z.literal(false),
    z.strictObject({
      authorized: z.literal(true),
      previousIndexHash: digest.nullable(),
      targetHashes: portableTargetHashesSchema,
      observedMarkerHash: digest.nullable()
    })
  ])
});
type StoredPublicationBasis = z.infer<typeof publicationSchema>;

const metadataSchema = z.strictObject({
  version: z.literal(PORTABLE_MAP_OPERATION_METADATA_VERSION),
  operationId: generationLocalIdSchema,
  stage: z.literal("prepared"),
  generationId: generationLocalIdSchema,
  transactionId: generationLocalIdSchema,
  previousGenerationId: generationLocalIdSchema.nullable(),
  previousIndexHash: digest.nullable(),
  rootFingerprint: digest,
  observedMarkerHash: digest.nullable(),
  packetBudgetBytes: safePositiveInteger,
  repair: publicationSchema.shape.repair,
  sourceBasis: portableSourceBasisSchema,
  targetHashes: portableTargetHashesSchema,
  createdAt: timestamp,
  lastActivityAt: timestamp,
  expiresAt: timestamp,
  revision: safePositiveInteger,
  rootIdentity: identitySchema,
  inventoryFingerprint: digest,
  coverage: coverageSchema,
  provenanceHash: digest,
  publication: publicationSchema,
  files: z.strictObject({
    structural: fileRefSchema,
    authority: fileRefSchema,
    provenance: fileRefSchema,
    packets: fileRefSchema
  }),
  cursor: z.strictObject({basisHash: digest, secret: opaqueSecret})
});
export type PortablePreparedOperationMetadata = z.infer<typeof metadataSchema>;

const structuralStoreSchema = z.strictObject({
  version: z.literal(1), operationId: generationLocalIdSchema, generationId: generationLocalIdSchema,
  shards: z.array(portableStructuralInventorySchema).min(1).max(100_000)
});
const authorityStoreSchema = z.strictObject({
  version: z.literal(1), operationId: generationLocalIdSchema, generationId: generationLocalIdSchema,
  sourceBasis: portableAuthoritativeSourceBasisSchema
});
const provenanceStoreSchema = z.strictObject({
  version: z.literal(1), operationId: generationLocalIdSchema, generationId: generationLocalIdSchema,
  root: identitySchema, inventoryFingerprint: digest, coverage: coverageSchema, provenance: provenanceSchema
});
const packetStoreSchema = z.strictObject({
  version: z.literal(1), operationId: generationLocalIdSchema, generationId: generationLocalIdSchema,
  packetBudgetBytes: safePositiveInteger,
  packets: z.array(portableModelPacketSchema).min(1).max(1_000_000)
});

const operationMarkerSchema = z.strictObject({
  version: z.literal(PORTABLE_MAP_OPERATION_METADATA_VERSION),
  operationId: generationLocalIdSchema, stage: z.literal("prepared"), generationId: generationLocalIdSchema,
  transactionId: generationLocalIdSchema,
  previousGenerationId: generationLocalIdSchema.nullable(), previousIndexHash: digest.nullable(),
  rootFingerprint: digest, observedMarkerHash: digest.nullable(), packetBudgetBytes: safePositiveInteger, repair: publicationSchema.shape.repair,
  sourceBasis: portableSourceBasisSchema, targetHashes: portableTargetHashesSchema, createdAt: timestamp
});

const cursorSchema = generationLocalIdSchema;
const operationIdSchema = generationLocalIdSchema;

export type PortableOperationDiagnosticCode =
  | "invalid-input" | "not-found" | "unsafe-root" | "invalid-state" | "integrity-failure"
  | "stale-root" | "stale-source" | "stale-target" | "stale-provenance" | "expired"
  | "invalid-cursor" | "packet-too-large" | "publication-conflict";

export type PortableOperationDiagnostic = {
  readonly code: PortableOperationDiagnosticCode;
  readonly message: string;
};

const DIAGNOSTICS: Record<PortableOperationDiagnosticCode, string> = {
  "invalid-input": "The prepared operation request is invalid.",
  "not-found": "The prepared operation is unavailable.",
  "unsafe-root": "The repository root or operation path is unsafe.",
  "invalid-state": "The prepared operation state is invalid.",
  "integrity-failure": "The prepared operation state failed integrity checks.",
  "stale-root": "The repository root identity changed after preparation.",
  "stale-source": "The source inventory or source basis changed after preparation.",
  "stale-target": "A publication target or observed marker changed after preparation.",
  "stale-provenance": "Parser or extraction provenance changed after preparation.",
  "expired": "The prepared operation is expired for new authoring.",
  "invalid-cursor": "The continuation cursor is invalid for this operation.",
  "packet-too-large": "The selected evidence packet exceeds its fixed byte bound.",
  "publication-conflict": "The publication preflight no longer matches the prepared operation."
};

function diagnostic(code: PortableOperationDiagnosticCode): PortableOperationDiagnostic {
  return {code, message: DIAGNOSTICS[code]};
}

type OperationFailure = {
  readonly ok: false;
  readonly status: "invalid" | "not-found" | "unsafe" | "invalid-state" | "stale" | "expired" | "conflict";
  readonly diagnostics: readonly PortableOperationDiagnostic[];
  readonly operationId?: string;
  readonly generationId?: string;
};

export type PortableOperationReceipt = {
  readonly ok: boolean;
  readonly status: "ready" | "stale" | "expired" | "invalid" | "not-found" | "unsafe" | "conflict";
  readonly operationId: string;
  readonly generationId: string;
  readonly packet?: PortableModelPacket;
  readonly packetBytes?: number;
  readonly continuation: {readonly cursor: string | null; readonly hasMore: boolean} | null;
  readonly diagnostics: readonly PortableOperationDiagnostic[];
};

export type PortableOperationLoad = {
  readonly ok: true;
  readonly metadata: PortablePreparedOperationMetadata;
  readonly extraction: PortableExtractionSuccess;
  readonly packets: readonly PortableModelPacket[];
};

export type PortableOperationRevalidation =
  | ({readonly ok: true; readonly status: "fresh"; readonly metadata: PortablePreparedOperationMetadata; readonly extraction: PortableExtractionSuccess})
  | OperationFailure;

export type PortablePrepareOperationResult =
  | ({readonly ok: true; readonly status: "ready"; readonly operationId: string; readonly generationId: string; readonly metadata: PortablePreparedOperationMetadata; readonly receipt: PortableOperationReceipt})
  | OperationFailure;

export type PortableOperationRepairInput = {
  readonly authorized: true;
  readonly previousIndexHash: string | null;
  readonly targetHashes: z.infer<typeof portableTargetHashesSchema>;
  readonly observedMarkerHash: string | null;
};
type RepositoryInput = {readonly repositoryRoot?: string; readonly root?: string};
type NowInput = {readonly now?: Date | string};

function fixedFailure(
  status: OperationFailure["status"],
  code: PortableOperationDiagnosticCode,
  operationId?: string,
  generationId?: string
): OperationFailure {
  return {ok: false, status, diagnostics: [diagnostic(code)], ...(operationId ? {operationId} : {}), ...(generationId ? {generationId} : {})};
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

function nowDate(input?: Date | string): Date {
  if (input instanceof Date) return new Date(input.getTime());
  if (typeof input === "string") {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function validNow(input?: Date | string): string {
  return nowDate(input).toISOString();
}

function resolveRepositoryRoot(input: RepositoryInput): string | null {
  const value = input.repositoryRoot ?? input.root;
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) return null;
  return path.resolve(value);
}

function generatedOpaqueId(prefix: "op" | "gen" | "tx"): string {
  return `${prefix}-${randomBytes(18).toString("hex")}`;
}

function sameRoot(left: RootIdentity, right: RootIdentity): boolean {
  return left.path === right.path && left.realPath === right.realPath && left.device === right.device && left.inode === right.inode &&
    left.ancestors.length === right.ancestors.length && left.ancestors.every((entry, index) => {
      const other = right.ancestors[index]!;
      return entry.path === other.path && entry.device === other.device && entry.inode === other.inode;
    });
}

type DirectoryIdentity = {readonly path: string; readonly device: number; readonly inode: number};

async function captureDirectoryChain(repositoryRoot: string, relativeDirectory: string): Promise<readonly DirectoryIdentity[] | null> {
  if (!relativeDirectory || relativeDirectory.startsWith("/") || relativeDirectory.split("/").some(segment => !segment || segment === "." || segment === "..")) return null;
  const absoluteRoot = path.resolve(repositoryRoot);
  const parsed = path.parse(absoluteRoot);
  let current = parsed.root;
  const chain: DirectoryIdentity[] = [];
  for (const segment of absoluteRoot.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const info = await fs.lstat(current).catch(() => null);
    if (!info || info.isSymbolicLink() || !info.isDirectory()) return null;
    chain.push({path: current, device: info.dev, inode: info.ino});
  }
  for (const segment of relativeDirectory.split("/")) {
    current = path.join(current, segment);
    const info = await fs.lstat(current).catch(() => null);
    if (!info || info.isSymbolicLink() || !info.isDirectory()) return null;
    chain.push({path: current, device: info.dev, inode: info.ino});
  }
  return chain;
}

function sameDirectoryChain(left: readonly DirectoryIdentity[] | null, right: readonly DirectoryIdentity[] | null): boolean {
  return Boolean(left && right && left.length === right.length && left.every((item, index) => {
    const other = right[index]!;
    return item.path === other.path && item.device === other.device && item.inode === other.inode;
  }));
}

function rootBasisHash(root: RootIdentity): string {
  return sha256(JSON.stringify({path: root.path, realPath: root.realPath, device: root.device, inode: root.inode, ancestors: root.ancestors}));
}

function basisHash(metadata: Pick<PortablePreparedOperationMetadata, "sourceBasis" | "generationId" | "inventoryFingerprint">): string {
  return sha256(JSON.stringify({generationId: metadata.generationId, inventoryFingerprint: metadata.inventoryFingerprint, sourceBasis: metadata.sourceBasis}));
}

function rootFromExtraction(root: ExtractionRootIdentity, ancestors: RootIdentity["ancestors"]): RootIdentity {
  return identitySchema.parse({path: root.path, realPath: root.realPath, device: root.device, inode: root.inode, ancestors});
}

async function captureLiteralRoot(repositoryRoot: string): Promise<RootIdentity | null> {
  const absolute = path.resolve(repositoryRoot);
  const parsed = path.parse(absolute);
  const segments = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  const ancestors: RootIdentity["ancestors"] = [];
  for (const segment of segments) {
    current = path.join(current, segment);
    const info = await fs.lstat(current).catch(() => null);
    if (!info || info.isSymbolicLink() || !info.isDirectory()) return null;
    if (current !== absolute) ancestors.push({path: current, device: info.dev, inode: info.ino});
  }
  const rootStat = await fs.lstat(absolute).catch(() => null);
  if (!rootStat || rootStat.isSymbolicLink() || !rootStat.isDirectory()) return null;
  const realPath = await fs.realpath(absolute).catch(() => null);
  if (!realPath) return null;
  return {path: absolute, realPath, device: rootStat.dev, inode: rootStat.ino, ancestors};
}

async function ensureLiteralDirectory(repositoryRoot: string, relative: string): Promise<boolean> {
  const root = await captureLiteralRoot(repositoryRoot);
  if (!root) return false;
  let current = repositoryRoot;
  for (const segment of relative.split("/")) {
    if (!segment || segment === "." || segment === ".." || segment.includes("\0")) return false;
    current = path.join(current, segment);
    const before = await fs.lstat(current).catch(() => null);
    if (before) {
      if (before.isSymbolicLink() || !before.isDirectory()) return false;
      continue;
    }
    await fs.mkdir(current).catch(() => undefined);
    const after = await fs.lstat(current).catch(() => null);
    if (!after || after.isSymbolicLink() || !after.isDirectory()) return false;
  }
  return sameRoot(root, (await captureLiteralRoot(repositoryRoot))!);
}

async function assertLiteralRelativePath(repositoryRoot: string, relative: string, allowMissingLeaf = false): Promise<boolean> {
  if (!relative || relative.startsWith("/") || relative.includes("\\") || /[\0-\u001f\u007f]/.test(relative) ||
      relative.split("/").some(segment => !segment || segment === "." || segment === "..")) return false;
  const root = await captureLiteralRoot(repositoryRoot);
  if (!root) return false;
  let current = repositoryRoot;
  const segments = relative.split("/");
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const info = await fs.lstat(current).catch(() => null);
    if (!info) return allowMissingLeaf && index === segments.length - 1;
    if (info.isSymbolicLink()) return false;
    if (index < segments.length - 1 && !info.isDirectory()) return false;
  }
  return true;
}

function fileIdentity(info: {dev: number; ino: number; size: number; mtimeMs: number; ctimeMs: number}) {
  return {device: info.dev, inode: info.ino, size: Number(info.size), mtimeMs: info.mtimeMs, ctimeMs: info.ctimeMs};
}

function sameFileIdentity(left: ReturnType<typeof fileIdentity>, right: ReturnType<typeof fileIdentity>): boolean {
  return left.device === right.device && left.inode === right.inode && left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}

async function readLiteralFile(repositoryRoot: string, relative: string): Promise<Uint8Array | null> {
  if (!(await assertLiteralRelativePath(repositoryRoot, relative))) throw new Error("unsafe");
  const absolute = path.join(repositoryRoot, relative);
  const parent = path.posix.dirname(relative);
  const beforeChain = await captureDirectoryChain(repositoryRoot, parent);
  if (!beforeChain) throw new Error("unsafe");
  const first = await fs.lstat(absolute).catch(error => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  });
  if (!first) return null;
  if (first.isSymbolicLink() || !first.isFile()) throw new Error("unsafe");
  const handle = await fs.open(absolute, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)).catch(() => null);
  if (!handle) throw new Error("unsafe");
  let bytes: Uint8Array;
  try {
    const opened = await handle.stat();
    if (opened.isSymbolicLink() || !opened.isFile() || !sameFileIdentity(fileIdentity(first), fileIdentity(opened))) throw new Error("unsafe");
    bytes = new Uint8Array(await handle.readFile());
    const second = await handle.stat();
    if (second.isSymbolicLink() || !second.isFile() || !sameFileIdentity(fileIdentity(first), fileIdentity(second))) throw new Error("unsafe");
  } finally {
    await handle.close().catch(() => undefined);
  }
  if (!sameDirectoryChain(beforeChain, await captureDirectoryChain(repositoryRoot, parent))) throw new Error("unsafe");
  return bytes;
}

async function atomicWriteLiteral(repositoryRoot: string, relative: string, bytes: Uint8Array, overwrite: boolean): Promise<void> {
  if (!(await assertLiteralRelativePath(repositoryRoot, path.posix.dirname(relative), false))) throw new Error("unsafe");
  if (!(await assertLiteralRelativePath(repositoryRoot, relative, true))) throw new Error("unsafe");
  const absolute = path.join(repositoryRoot, relative);
  const parent = path.dirname(absolute);
  const parentRelative = path.posix.dirname(relative);
  const chain = await captureDirectoryChain(repositoryRoot, parentRelative);
  if (!chain) throw new Error("unsafe");
  const parentStat = await fs.lstat(parent);
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) throw new Error("unsafe");
  const parentHandle = await fs.open(parent, fsConstants.O_RDONLY | (fsConstants.O_DIRECTORY ?? 0) | (fsConstants.O_NOFOLLOW ?? 0)).catch(() => null);
  if (!parentHandle) throw new Error("unsafe");
  const anchored = (name: string): string => process.platform === "linux" ? `/proc/self/fd/${parentHandle.fd}/${name}` : path.join(parent, name);
  const before = await fs.lstat(anchored(path.basename(relative))).catch(error => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  });
  if (before?.isSymbolicLink() || before && !before.isFile()) throw new Error("unsafe");
  if (before && !overwrite) throw new Error("conflict");
  const tempName = `.${path.basename(relative)}.tmp-${process.pid}-${randomBytes(8).toString("hex")}`;
  const temp = anchored(tempName);
  let ownedTemp: ReturnType<typeof fileIdentity> | null = null;
  try {
    await portableOperationTestHooks.beforeAtomicWrite?.(relative);
    if (!sameDirectoryChain(chain, await captureDirectoryChain(repositoryRoot, parentRelative))) throw new Error("unsafe");
    await fs.writeFile(temp, bytes, {flag: "wx"});
    const created = await fs.lstat(temp);
    if (created.isSymbolicLink() || !created.isFile()) throw new Error("unsafe");
    ownedTemp = fileIdentity(created);
    await portableOperationTestHooks.afterTempWrite?.(relative);
    if (!sameDirectoryChain(chain, await captureDirectoryChain(repositoryRoot, parentRelative))) throw new Error("unsafe");
    const current = await fs.lstat(anchored(path.basename(relative))).catch(error => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    });
    if (before && (!current || !sameFileIdentity(fileIdentity(before), fileIdentity(current)))) throw new Error("conflict");
    if (!before && current) throw new Error("conflict");
    if (!sameDirectoryChain(chain, await captureDirectoryChain(repositoryRoot, parentRelative))) throw new Error("unsafe");
    await fs.rename(temp, anchored(path.basename(relative)));
    if (!sameDirectoryChain(chain, await captureDirectoryChain(repositoryRoot, parentRelative))) throw new Error("unsafe");
    const after = await fs.lstat(anchored(path.basename(relative)));
    if (after.isSymbolicLink() || !after.isFile()) throw new Error("unsafe");
    if (sha256(await fs.readFile(anchored(path.basename(relative)))) !== sha256(bytes)) throw new Error("integrity");
  } finally {
    if (ownedTemp) {
      const currentTemp = await fs.lstat(temp).catch(() => null);
      if (currentTemp && currentTemp.isFile() && !currentTemp.isSymbolicLink() && sameFileIdentity(ownedTemp, fileIdentity(currentTemp))) {
        await fs.rm(temp, {force: true}).catch(() => undefined);
      }
    }
    await parentHandle.close().catch(() => undefined);
  }
}

function refFor(file: string, bytes: Uint8Array) {
  return {path: file, checksum: sha256(bytes), byteSize: bytes.byteLength};
}

function parseStoredJson<T>(bytes: Uint8Array, schema: z.ZodType<T>): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function extractionFromStored(
  metadata: PortablePreparedOperationMetadata,
  structural: z.infer<typeof structuralStoreSchema>,
  authority: z.infer<typeof authorityStoreSchema>,
  provenance: z.infer<typeof provenanceStoreSchema>
): PortableExtractionSuccess | null {
  if (structural.operationId !== metadata.operationId || structural.generationId !== metadata.generationId ||
      authority.operationId !== metadata.operationId || authority.generationId !== metadata.generationId ||
      provenance.operationId !== metadata.operationId || provenance.generationId !== metadata.generationId) return null;
  if (authority.sourceBasis.generationId !== metadata.generationId ||
      provenance.inventoryFingerprint !== metadata.inventoryFingerprint || !sameRoot(provenance.root, metadata.rootIdentity) ||
      sha256(canonicalJson(provenance.provenance)) !== metadata.provenanceHash) return null;
  return {
    ok: true,
    generationId: metadata.generationId,
    root: {path: provenance.root.path, realPath: provenance.root.realPath, device: provenance.root.device, inode: provenance.root.inode},
    inventoryFingerprint: provenance.inventoryFingerprint,
    structuralShards: structural.shards,
    sourceBasis: authority.sourceBasis,
    coverage: provenance.coverage,
    provenance: provenance.provenance
  };
}

async function loadPortableOperationUnlocked(repositoryRoot: string, operationId: string): Promise<PortableOperationLoad | OperationFailure> {
  if (!operationIdSchema.safeParse(operationId).success) return fixedFailure("invalid", "invalid-input");
  const operationDirectory = `${PORTABLE_OPERATIONS_ROOT}/${operationId}`;
  if (!(await assertLiteralRelativePath(repositoryRoot, operationDirectory))) return fixedFailure("not-found", "not-found", operationId);
  const metadataBytes = await readLiteralFile(repositoryRoot, `${operationDirectory}/${PORTABLE_OPERATION_METADATA_FILE}`).catch(() => null);
  if (!metadataBytes) return fixedFailure("not-found", "not-found", operationId);
  const metadata = parseStoredJson(metadataBytes, metadataSchema);
  if (!metadata || metadata.operationId !== operationId) return fixedFailure("invalid-state", "integrity-failure", operationId);
  const markerBytes = await readLiteralFile(repositoryRoot, `${operationDirectory}/${PORTABLE_OPERATION_MARKER_FILE}`).catch(() => null);
  const marker = markerBytes ? parseStoredJson(markerBytes, operationMarkerSchema) : null;
  if (!marker || marker.operationId !== operationId || marker.generationId !== metadata.generationId ||
      marker.transactionId !== metadata.transactionId || marker.rootFingerprint !== metadata.rootFingerprint ||
      marker.packetBudgetBytes !== metadata.packetBudgetBytes ||
      marker.observedMarkerHash !== metadata.observedMarkerHash || JSON.stringify(marker.repair) !== JSON.stringify(metadata.repair) ||
      JSON.stringify(marker.sourceBasis) !== JSON.stringify(metadata.sourceBasis) ||
      JSON.stringify(marker.targetHashes) !== JSON.stringify(metadata.targetHashes) || marker.previousGenerationId !== metadata.previousGenerationId ||
      marker.previousIndexHash !== metadata.previousIndexHash) return fixedFailure("invalid-state", "integrity-failure", operationId, metadata.generationId);
  const publication = metadata.publication;
  if (publication.repositoryRoot !== metadata.rootIdentity.path || publication.operationId !== metadata.operationId ||
      publication.transactionId !== metadata.transactionId || publication.generationId !== metadata.generationId ||
      JSON.stringify(publication.sourceBasis) !== JSON.stringify(metadata.sourceBasis) ||
      publication.rootFingerprint !== metadata.rootFingerprint || publication.previousGenerationId !== metadata.previousGenerationId ||
      publication.previousIndexHash !== metadata.previousIndexHash ||
      JSON.stringify(publication.previousTargetHashes) !== JSON.stringify(metadata.targetHashes) ||
      publication.observedMarkerHash !== metadata.observedMarkerHash || JSON.stringify(publication.repair) !== JSON.stringify(metadata.repair)) {
    return fixedFailure("invalid-state", "integrity-failure", operationId, metadata.generationId);
  }

  const storedFiles: Array<[keyof PortablePreparedOperationMetadata["files"], z.ZodTypeAny]> = [
    ["structural", structuralStoreSchema], ["authority", authorityStoreSchema], ["provenance", provenanceStoreSchema], ["packets", packetStoreSchema]
  ];
  const parsed: Record<string, unknown> = {};
  for (const [kind, schema] of storedFiles) {
    const reference = metadata.files[kind];
    if (reference.path !== ({structural: PORTABLE_OPERATION_STRUCTURAL_FILE, authority: PORTABLE_OPERATION_AUTHORITY_FILE, provenance: PORTABLE_OPERATION_PROVENANCE_FILE, packets: PORTABLE_OPERATION_PACKETS_FILE} as const)[kind]) {
      return fixedFailure("invalid-state", "integrity-failure", operationId, metadata.generationId);
    }
    const bytes = await readLiteralFile(repositoryRoot, `${operationDirectory}/${reference.path}`).catch(() => null);
    if (!bytes || bytes.byteLength !== reference.byteSize || sha256(bytes) !== reference.checksum) return fixedFailure("invalid-state", "integrity-failure", operationId, metadata.generationId);
    const value = parseStoredJson(bytes, schema);
    if (!value) return fixedFailure("invalid-state", "integrity-failure", operationId, metadata.generationId);
    parsed[kind] = value;
  }
  const extraction = extractionFromStored(
    metadata,
    parsed.structural as z.infer<typeof structuralStoreSchema>,
    parsed.authority as z.infer<typeof authorityStoreSchema>,
    parsed.provenance as z.infer<typeof provenanceStoreSchema>
  );
  if (!extraction) return fixedFailure("invalid-state", "integrity-failure", operationId, metadata.generationId);
  if (metadata.cursor.basisHash !== basisHash(metadata)) return fixedFailure("invalid-state", "integrity-failure", operationId, metadata.generationId);
  const packets = parsed.packets as z.infer<typeof packetStoreSchema>;
  if (packets.operationId !== metadata.operationId || packets.generationId !== metadata.generationId || packets.packetBudgetBytes !== metadata.packetBudgetBytes) return fixedFailure("invalid-state", "integrity-failure", operationId, metadata.generationId);
  return {ok: true, metadata, extraction, packets: packets.packets as readonly PortableModelPacket[]};
}

async function withOperationLock<T>(repositoryRoot: string, operationId: string, task: () => Promise<T>): Promise<T | OperationFailure> {
  const root = await captureLiteralRoot(repositoryRoot);
  if (!root) return fixedFailure("unsafe", "unsafe-root", operationId);
  const lockParent = await assertLiteralRelativePath(repositoryRoot, ".blueprint/locks");
  if (!lockParent) return fixedFailure("unsafe", "unsafe-root", operationId);
  try {
    return await withBlueprintRepoLock(repositoryRoot, `codebase-operation-${operationId}`, async () => {
      const inside = await captureLiteralRoot(repositoryRoot);
      if (!inside || !sameRoot(root, inside)) return fixedFailure("unsafe", "unsafe-root", operationId);
      return task();
    });
  } catch {
    return fixedFailure("unsafe", "unsafe-root", operationId);
  }
}

function publicationBasisFromPreflight(value: PortablePublicationPreflight, repair: PortableOperationRepairInput | undefined = undefined): StoredPublicationBasis {
  return publicationSchema.parse({
    repositoryRoot: value.repositoryRoot,
    operationId: value.operationId,
    transactionId: value.transactionId,
    generationId: value.generationId,
    sourceBasis: value.sourceBasis,
    rootFingerprint: value.rootFingerprint,
    previousGenerationId: value.previousGenerationId,
    previousIndexHash: value.previousIndexHash,
    previousTargetHashes: value.previousTargetHashes,
    observedMarkerHash: value.observedMarkerHash,
    legacyBackup: value.legacyBackup,
    repair: repair ? {
      authorized: true,
      previousIndexHash: repair.previousIndexHash,
      targetHashes: repair.targetHashes,
      observedMarkerHash: repair.observedMarkerHash
    } : false
  });
}

function sourceBasisFor(extraction: PortableExtractionSuccess, root: RootIdentity): PortableSourceBasis {
  return portableSourceBasisSchema.parse({
    rootHash: rootBasisHash(root),
    inventoryHash: extraction.inventoryFingerprint,
    evidenceHash: sha256(canonicalJson(extraction.sourceBasis))
  });
}

function operationMarker(metadata: PortablePreparedOperationMetadata): PortableOperationMetadata {
  return {
    version: PORTABLE_MAP_OPERATION_METADATA_VERSION,
    operationId: metadata.operationId,
    stage: "prepared",
    generationId: metadata.generationId,
    transactionId: metadata.transactionId,
    previousGenerationId: metadata.previousGenerationId,
    previousIndexHash: metadata.previousIndexHash,
    sourceBasis: metadata.sourceBasis,
    targetHashes: metadata.targetHashes,
    rootFingerprint: metadata.rootFingerprint,
    observedMarkerHash: metadata.observedMarkerHash,
    packetBudgetBytes: metadata.packetBudgetBytes,
    repair: metadata.repair,
    createdAt: metadata.createdAt
  };
}

async function writePreparedOperation(repositoryRoot: string, metadata: PortablePreparedOperationMetadata, extraction: PortableExtractionSuccess, packetBytes: Uint8Array): Promise<void> {
  const operationDirectory = `${PORTABLE_OPERATIONS_ROOT}/${metadata.operationId}`;
  if (!(await ensureLiteralDirectory(repositoryRoot, `${PORTABLE_OPERATIONS_ROOT}/${metadata.operationId}`))) throw new Error("unsafe");
  const structuralBytes = new TextEncoder().encode(canonicalJson({version: 1, operationId: metadata.operationId, generationId: metadata.generationId, shards: extraction.structuralShards}));
  const authorityBytes = new TextEncoder().encode(canonicalJson({version: 1, operationId: metadata.operationId, generationId: metadata.generationId, sourceBasis: extraction.sourceBasis}));
  const provenanceBytes = new TextEncoder().encode(canonicalJson({version: 1, operationId: metadata.operationId, generationId: metadata.generationId, root: metadata.rootIdentity, inventoryFingerprint: extraction.inventoryFingerprint, coverage: extraction.coverage, provenance: extraction.provenance}));
  const packets = parseStoredJson(packetBytes, packetStoreSchema);
  if (!packets) throw new Error("invalid packets");
  await atomicWriteLiteral(repositoryRoot, `${operationDirectory}/${PORTABLE_OPERATION_STRUCTURAL_FILE}`, structuralBytes, false);
  await atomicWriteLiteral(repositoryRoot, `${operationDirectory}/${PORTABLE_OPERATION_AUTHORITY_FILE}`, authorityBytes, false);
  await atomicWriteLiteral(repositoryRoot, `${operationDirectory}/${PORTABLE_OPERATION_PROVENANCE_FILE}`, provenanceBytes, false);
  await atomicWriteLiteral(repositoryRoot, `${operationDirectory}/${PORTABLE_OPERATION_PACKETS_FILE}`, packetBytes, false);
  await atomicWriteLiteral(repositoryRoot, `${operationDirectory}/${PORTABLE_OPERATION_MARKER_FILE}`, new TextEncoder().encode(canonicalJson(operationMarker(metadata))), false);
  await atomicWriteLiteral(repositoryRoot, `${operationDirectory}/${PORTABLE_OPERATION_METADATA_FILE}`, new TextEncoder().encode(canonicalJson(metadata)), false);
}

function isExpired(metadata: PortablePreparedOperationMetadata, now?: Date | string): boolean {
  return nowDate(now).getTime() >= new Date(metadata.expiresAt).getTime();
}

function hmacCursor(metadata: PortablePreparedOperationMetadata, index: number): string {
  return createHmac("sha256", metadata.cursor.secret).update(`${metadata.operationId}|${metadata.generationId}|${metadata.cursor.basisHash}|${index}`).digest("hex").slice(0, 48);
}

function makeCursor(metadata: PortablePreparedOperationMetadata, index: number): string {
  return `c-${index.toString(36)}-${hmacCursor(metadata, index)}`;
}

function cursorIndex(metadata: PortablePreparedOperationMetadata, cursor: string): number | null {
  if (!cursorSchema.safeParse(cursor).success) return null;
  const match = /^c-([0-9a-z]+)-([a-f0-9]{48})$/.exec(cursor);
  if (!match) return null;
  const index = Number.parseInt(match[1]!, 36);
  if (!Number.isSafeInteger(index) || index < 0 || hmacCursor(metadata, index) !== match[2]) return null;
  return index;
}

function packetResult(metadata: PortablePreparedOperationMetadata, extraction: PortableExtractionSuccess): ModelPacketResult {
  return packetizePortableModelEvidence(extraction, metadata.operationId, {
    maxSerializedBytes: metadata.packetBudgetBytes,
    continuationFor: (index, hasMore) => hasMore ? {cursor: makeCursor(metadata, index + 1), hasMore: true} : undefined
  });
}

function boundedReceipt(
  metadata: PortablePreparedOperationMetadata,
  packets: readonly PortableModelPacket[],
  cursor: string | undefined
): PortableOperationReceipt {
  const index = cursor === undefined ? 0 : cursorIndex(metadata, cursor);
  if (index === null || index >= packets.length) return {ok: false, status: "invalid", operationId: metadata.operationId, generationId: metadata.generationId, continuation: null, diagnostics: [diagnostic("invalid-cursor")]};
  const packet = packets[index]!;
  if (packet.operationId !== metadata.operationId || packet.generationId !== metadata.generationId) return {ok: false, status: "invalid", operationId: metadata.operationId, generationId: metadata.generationId, continuation: null, diagnostics: [diagnostic("integrity-failure")]};
  const bytes = serializedUtf8ByteLength(packet);
  if (bytes > metadata.packetBudgetBytes || !portableModelPacketSchema.safeParse(packet).success) return {ok: false, status: "invalid", operationId: metadata.operationId, generationId: metadata.generationId, continuation: null, diagnostics: [diagnostic("packet-too-large")]};
  const continuation = packet.continuation ?? null;
  const hasMore = continuation?.hasMore ?? false;
  const nextCursor = continuation?.cursor ?? null;
  return {ok: true, status: "ready", operationId: metadata.operationId, generationId: metadata.generationId, packet, packetBytes: bytes, continuation: {cursor: nextCursor, hasMore}, diagnostics: []};
}

function comparePublication(left: StoredPublicationBasis, right: StoredPublicationBasis): PortableOperationDiagnosticCode | null {
  if (left.repositoryRoot !== right.repositoryRoot || left.operationId !== right.operationId || left.transactionId !== right.transactionId ||
      left.generationId !== right.generationId || JSON.stringify(left.sourceBasis) !== JSON.stringify(right.sourceBasis) ||
      left.rootFingerprint !== right.rootFingerprint) return "stale-root";
  if (left.previousIndexHash !== right.previousIndexHash || left.previousGenerationId !== right.previousGenerationId ||
      left.observedMarkerHash !== right.observedMarkerHash ||
      JSON.stringify(left.repair) !== JSON.stringify(right.repair) ||
      CODEBASE_DOCUMENT_IDS.some(id => left.previousTargetHashes[id] !== right.previousTargetHashes[id])) return "stale-target";
  return null;
}

async function revalidateLoaded(repositoryRoot: string, loaded: PortableOperationLoad, now?: Date | string): Promise<PortableOperationRevalidation> {
  if (isExpired(loaded.metadata, now)) return fixedFailure("expired", "expired", loaded.metadata.operationId, loaded.metadata.generationId);
  const currentRoot = await captureLiteralRoot(repositoryRoot);
  if (!currentRoot || !sameRoot(currentRoot, loaded.metadata.rootIdentity)) return fixedFailure("stale", currentRoot ? "stale-root" : "unsafe-root", loaded.metadata.operationId, loaded.metadata.generationId);
  const fresh = await capturePortableSourceFreshness(repositoryRoot);
  if (!fresh.ok) return fixedFailure("stale", fresh.diagnostics[0]?.code === "root-unavailable" || fresh.diagnostics[0]?.code === "root-changed" ? "stale-root" : "stale-source", loaded.metadata.operationId, loaded.metadata.generationId);
  const freshRoot = rootFromExtraction(fresh.root, loaded.metadata.rootIdentity.ancestors);
  if (!sameRoot(freshRoot, loaded.metadata.rootIdentity)) return fixedFailure("stale", "stale-root", loaded.metadata.operationId, loaded.metadata.generationId);
  const currentBasis = portableSourceBasisSchema.parse({
    rootHash: rootBasisHash(currentRoot),
    inventoryHash: fresh.inventoryFingerprint,
    evidenceHash: loaded.metadata.sourceBasis.evidenceHash
  });
  if (currentBasis.inventoryHash !== loaded.metadata.sourceBasis.inventoryHash || currentBasis.rootHash !== loaded.metadata.sourceBasis.rootHash || fresh.inventoryFingerprint !== loaded.metadata.inventoryFingerprint) {
    return fixedFailure("stale", "stale-source", loaded.metadata.operationId, loaded.metadata.generationId);
  }
  if (sha256(canonicalJson(fresh.provenance)) !== loaded.metadata.provenanceHash) return fixedFailure("stale", "stale-provenance", loaded.metadata.operationId, loaded.metadata.generationId);
  const repairBasis = loaded.metadata.repair === false ? undefined : loaded.metadata.repair;
  const target = await capturePortablePublicationPreflight({
    repositoryRoot,
    operationId: loaded.metadata.operationId,
    transactionId: loaded.metadata.publication.transactionId,
    generationId: loaded.metadata.generationId,
    sourceBasis: loaded.metadata.sourceBasis,
    verifyFreshness: () => true,
    ...(repairBasis ? {repair: {authorized: true}} : {})
  });
  if (!("operationId" in target)) return fixedFailure(target.status === "conflict" ? "conflict" : "stale", target.status === "conflict" ? "publication-conflict" : "stale-target", loaded.metadata.operationId, loaded.metadata.generationId);
  const currentPublication = publicationBasisFromPreflight(target, repairBasis);
  const difference = comparePublication(loaded.metadata.publication, currentPublication);
  if (difference) return fixedFailure("stale", difference, loaded.metadata.operationId, loaded.metadata.generationId);
  return {ok: true, status: "fresh", metadata: loaded.metadata, extraction: loaded.extraction};
}

async function touchMetadata(repositoryRoot: string, metadata: PortablePreparedOperationMetadata, now?: Date | string): Promise<PortablePreparedOperationMetadata | OperationFailure> {
  const requested = nowDate(now);
  const previous = new Date(metadata.lastActivityAt);
  const activity = requested.getTime() > previous.getTime() ? requested : previous;
  const updated = metadataSchema.parse({
    ...metadata,
    lastActivityAt: activity.toISOString(),
    expiresAt: new Date(activity.getTime() + PORTABLE_OPERATION_INACTIVITY_MS).toISOString(),
    revision: metadata.revision + 1
  });
  try {
    await atomicWriteLiteral(repositoryRoot, `${PORTABLE_OPERATIONS_ROOT}/${metadata.operationId}/${PORTABLE_OPERATION_METADATA_FILE}`, new TextEncoder().encode(canonicalJson(updated)), true);
    return updated;
  } catch {
    return fixedFailure("invalid-state", "integrity-failure", metadata.operationId, metadata.generationId);
  }
}

export async function preparePortableOperation(input: RepositoryInput & NowInput & {readonly repair?: PortableOperationRepairInput} = {}): Promise<PortablePrepareOperationResult> {
  const repositoryRoot = resolveRepositoryRoot(input);
  if (!repositoryRoot) return fixedFailure("invalid", "invalid-input");
  const initialRoot = await captureLiteralRoot(repositoryRoot);
  if (!initialRoot) return fixedFailure("unsafe", "unsafe-root");
  const operationId = generatedOpaqueId("op");
  const generationId = generatedOpaqueId("gen");
  const transactionId = generatedOpaqueId("tx");
  const extraction = await extractPortableRepository({repositoryRoot, generationId});
  if (!extraction.ok) return fixedFailure("stale", "stale-source", operationId, generationId);
  const root = rootFromExtraction(extraction.root, initialRoot.ancestors);
  if (!sameRoot(initialRoot, root)) return fixedFailure("stale", "stale-root", operationId, generationId);
  const sourceBasis = sourceBasisFor(extraction, root);
  // The reviewed publication preflight creates its shared lock parent before
  // acquiring the publication lock. Make that parent literal and race-safe
  // here so concurrent prepared operations cannot both call mkdir blindly.
  if (!(await ensureLiteralDirectory(repositoryRoot, ".blueprint/locks"))) return fixedFailure("unsafe", "unsafe-root", operationId, generationId);
  const preflight = await capturePortablePublicationPreflight({
    repositoryRoot,
    operationId,
    transactionId,
    generationId,
    sourceBasis,
    verifyFreshness: () => true,
    ...(input.repair ? {repair: {authorized: true}} : {})
  });
  if (!("operationId" in preflight)) {
    const code = preflight.status === "conflict" ? "publication-conflict" : preflight.status === "rejected" ? "invalid-state" : "unsafe-root";
    return fixedFailure(preflight.status === "conflict" ? "conflict" : "invalid-state", code, operationId, generationId);
  }
  if (input.repair && (preflight.previousIndexHash !== input.repair.previousIndexHash ||
      preflight.observedMarkerHash !== input.repair.observedMarkerHash ||
      CODEBASE_DOCUMENT_IDS.some(id => preflight.previousTargetHashes[id] !== input.repair!.targetHashes[id]))) {
    return fixedFailure("conflict", "publication-conflict", operationId, generationId);
  }
  const publication = publicationBasisFromPreflight(preflight, input.repair);
  const createdAt = validNow(input.now);
  const metadata = metadataSchema.parse({
    version: PORTABLE_MAP_OPERATION_METADATA_VERSION,
    operationId, stage: "prepared", generationId,
    transactionId,
    previousGenerationId: preflight.previousGenerationId,
    previousIndexHash: preflight.previousIndexHash,
    rootFingerprint: preflight.rootFingerprint,
    observedMarkerHash: preflight.observedMarkerHash,
    packetBudgetBytes: PORTABLE_OPERATION_PACKET_BUDGET_BYTES,
    repair: publication.repair,
    sourceBasis,
    targetHashes: preflight.previousTargetHashes,
    createdAt,
    lastActivityAt: createdAt,
    expiresAt: new Date(new Date(createdAt).getTime() + PORTABLE_OPERATION_INACTIVITY_MS).toISOString(),
    revision: 1,
    rootIdentity: root,
    inventoryFingerprint: extraction.inventoryFingerprint,
    coverage: extraction.coverage,
    provenanceHash: sha256(canonicalJson(extraction.provenance)),
    publication,
    files: {
      structural: refFor(PORTABLE_OPERATION_STRUCTURAL_FILE, new TextEncoder().encode(canonicalJson({version: 1, operationId, generationId, shards: extraction.structuralShards}))),
      authority: refFor(PORTABLE_OPERATION_AUTHORITY_FILE, new TextEncoder().encode(canonicalJson({version: 1, operationId, generationId, sourceBasis: extraction.sourceBasis}))),
      provenance: refFor(PORTABLE_OPERATION_PROVENANCE_FILE, new TextEncoder().encode(canonicalJson({version: 1, operationId, generationId, root, inventoryFingerprint: extraction.inventoryFingerprint, coverage: extraction.coverage, provenance: extraction.provenance}))),
      packets: refFor(PORTABLE_OPERATION_PACKETS_FILE, new Uint8Array())
    },
    cursor: {basisHash: basisHash({sourceBasis, generationId, inventoryFingerprint: extraction.inventoryFingerprint}), secret: randomBytes(32).toString("hex")}
  });
  const initialPackets = packetResult(metadata, extraction);
  if (!initialPackets.ok) return fixedFailure("invalid-state", initialPackets.diagnostics[0]?.code === "packet-too-large" ? "packet-too-large" : "invalid-state", operationId, generationId);
  const packetBytes = new TextEncoder().encode(canonicalJson({version: 1, operationId, generationId, packetBudgetBytes: metadata.packetBudgetBytes, packets: initialPackets.packets}));
  const preparedMetadata = metadataSchema.parse({
    ...metadata,
    files: {...metadata.files, packets: refFor(PORTABLE_OPERATION_PACKETS_FILE, packetBytes)}
  });
  const written = await withOperationLock(repositoryRoot, operationId, async () => {
    const inside = await captureLiteralRoot(repositoryRoot);
    if (!inside || !sameRoot(inside, root)) return fixedFailure("stale", "stale-root", operationId, generationId);
    if (!(await ensureLiteralDirectory(repositoryRoot, PORTABLE_OPERATIONS_ROOT))) return fixedFailure("unsafe", "unsafe-root", operationId, generationId);
    await writePreparedOperation(repositoryRoot, preparedMetadata, extraction, packetBytes);
    return null;
  });
  if (written) return written;
  const receipt = boundedReceipt(preparedMetadata, initialPackets.packets as unknown as readonly PortableModelPacket[], undefined);
  if (!receipt.ok) return fixedFailure("invalid-state", receipt.diagnostics[0]?.code ?? "invalid-state", operationId, generationId);
  return {ok: true, status: "ready", operationId, generationId, metadata: preparedMetadata, receipt};
}

export const preparePortableMapOperation = preparePortableOperation;
export const prepareCodebaseOperation = preparePortableOperation;

export async function loadPortableOperation(input: RepositoryInput & {readonly operationId: string}): Promise<PortableOperationLoad | OperationFailure> {
  const repositoryRoot = resolveRepositoryRoot(input);
  if (!repositoryRoot || !operationIdSchema.safeParse(input.operationId).success) return fixedFailure("invalid", "invalid-input");
  const result = await withOperationLock(repositoryRoot, input.operationId, () => loadPortableOperationUnlocked(repositoryRoot, input.operationId));
  return result as PortableOperationLoad | OperationFailure;
}

export async function readPortableOperationMetadata(input: RepositoryInput & {readonly operationId: string; readonly now?: Date | string}) {
  const loaded = await loadPortableOperation(input);
  if (!loaded.ok) return loaded;
  return {ok: true as const, status: isExpired(loaded.metadata, input.now) ? "expired" as const : "ready" as const, metadata: loaded.metadata, expired: isExpired(loaded.metadata, input.now), diagnostics: [] as const};
}

export async function readPortableOperationExtraction(input: RepositoryInput & {readonly operationId: string}) {
  const loaded = await loadPortableOperation(input);
  if (!loaded.ok) return loaded;
  return {ok: true as const, status: "available" as const, metadata: loaded.metadata, extraction: loaded.extraction, diagnostics: [] as const};
}

export async function revalidatePortableOperation(input: RepositoryInput & {readonly operationId: string; readonly now?: Date | string}): Promise<PortableOperationRevalidation> {
  const repositoryRoot = resolveRepositoryRoot(input);
  if (!repositoryRoot || !operationIdSchema.safeParse(input.operationId).success) return fixedFailure("invalid", "invalid-input");
  const result = await withOperationLock(repositoryRoot, input.operationId, async () => {
    const loaded = await loadPortableOperationUnlocked(repositoryRoot, input.operationId);
    return loaded.ok ? revalidateLoaded(repositoryRoot, loaded, input.now) : loaded;
  });
  return result as PortableOperationRevalidation;
}

export async function readPortableOperationReceipt(input: RepositoryInput & {readonly operationId: string; readonly cursor?: string; readonly now?: Date | string}): Promise<PortableOperationReceipt | OperationFailure> {
  const repositoryRoot = resolveRepositoryRoot(input);
  if (!repositoryRoot || !operationIdSchema.safeParse(input.operationId).success) return fixedFailure("invalid", "invalid-input");
  const result = await withOperationLock(repositoryRoot, input.operationId, async () => {
    const loaded = await loadPortableOperationUnlocked(repositoryRoot, input.operationId);
    if (!loaded.ok) return loaded;
    const fresh = await revalidateLoaded(repositoryRoot, loaded, input.now);
    if (!fresh.ok) {
      return {ok: false, status: fresh.status === "expired" ? "expired" : fresh.status === "conflict" ? "conflict" : "stale", operationId: loaded.metadata.operationId, generationId: loaded.metadata.generationId, continuation: null, diagnostics: fresh.diagnostics} satisfies PortableOperationReceipt;
    }
    const validated = boundedReceipt(loaded.metadata, loaded.packets, input.cursor);
    if (!validated.ok) return validated;
    const touched = await touchMetadata(repositoryRoot, loaded.metadata, input.now);
    if ("ok" in touched) return {ok: false, status: "invalid", operationId: loaded.metadata.operationId, generationId: loaded.metadata.generationId, continuation: null, diagnostics: touched.diagnostics};
    return boundedReceipt(touched, loaded.packets, input.cursor);
  });
  return result as PortableOperationReceipt | OperationFailure;
}

export const continuePortableOperation = readPortableOperationReceipt;
export const readPortableOperation = readPortableOperationReceipt;
export const readPortableMapOperation = readPortableOperationReceipt;
