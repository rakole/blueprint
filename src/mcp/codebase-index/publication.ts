import {createHash} from "node:crypto";
import {promises as fs} from "node:fs";
import path from "node:path";
import * as z from "zod/v4";

import {
  CODEBASE_DOCUMENT_IDS,
  validateCodebaseContent,
  type CodebaseDocumentId
} from "../codebase-authoring.js";
import {withBlueprintRepoLock} from "../tools/artifacts.js";
import {
  parsePortableRootDescriptor,
  type PortableRenderSuccess
} from "./render.js";
import {
  portableGenerationManifestSchema,
  portablePublicationMarkerSchema,
  portableSha256Schema,
  portableSourceBasisSchema,
  portableTargetHashesSchema,
  type PortablePublicationMarker,
  type PortableSealedGenerationReference,
  type PortableSourceBasis,
  type PortableTargetHashes
} from "./contracts.js";

/** The portable root is deliberately separate from the legacy artifact writer. */
export const PORTABLE_CODEBASE_ROOT = ".blueprint/codebase";
export const PORTABLE_CODEBASE_INDEX = `${PORTABLE_CODEBASE_ROOT}/INDEX.md`;
export const PORTABLE_PUBLICATION_MARKER = `${PORTABLE_CODEBASE_ROOT}/.publication.json`;
export const PORTABLE_PUBLICATION_LOCK = "codebase-publication";
export const PORTABLE_GENERATION_INDEX_NAME = "INDEX.md";

const DOCUMENT_FILE = (id: CodebaseDocumentId): string => `${id.toUpperCase()}.md`;
const digest = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const text = (bytes: Uint8Array): string => new TextDecoder("utf-8", {fatal: true}).decode(bytes);
const encoder = new TextEncoder();

type Identity = {device: number; inode: number; size: number; mtimeMs: number; ctimeMs: number};
type DirectorySnapshot = readonly {path: string; identity: Identity}[];

export type PortablePublicationPhase = "capture" | "before-marker" | "before-index";
export type PortableFreshnessContext = {
  readonly phase: PortablePublicationPhase;
  readonly repositoryRoot: string;
  readonly sourceBasis: PortableSourceBasis;
  readonly operationId: string;
  readonly transactionId: string;
  readonly generationId: string;
  readonly previousIndexHash: string | null;
  readonly previousTargetHashes: PortableTargetHashes;
};
export type PortableFreshnessResult = boolean | {readonly ok: boolean; readonly code?: string};
export type PortableFreshnessCheck = (context: PortableFreshnessContext) => Promise<PortableFreshnessResult> | PortableFreshnessResult;

export type PortablePublicationPreflight = {
  readonly repositoryRoot: string;
  readonly operationId: string;
  readonly transactionId: string;
  readonly generationId: string;
  readonly sourceBasis: PortableSourceBasis;
  readonly rootFingerprint: string;
  readonly previousGenerationId: string | null;
  readonly previousIndexHash: string | null;
  readonly previousTargetHashes: PortableTargetHashes;
  readonly observedMarkerHash: string | null;
  readonly legacyBackup: boolean;
  /** True only when the owning runtime explicitly requested fresh repair. */
  readonly repair: boolean;
};

type PublicationDiagnosticCode =
  | "invalid-input"
  | "unsafe-root"
  | "unsafe-target"
  | "unknown-marker"
  | "publication-conflict"
  | "stale-source"
  | "stale-target"
  | "compatibility-divergence"
  | "invalid-generation"
  | "publication-failed"
  | "recovery-required";

const MESSAGES: Record<PublicationDiagnosticCode, string> = {
  "invalid-input": "The portable publication request is invalid.",
  "unsafe-root": "The portable map root or one of its ancestors changed or is not a literal directory.",
  "unsafe-target": "A portable publication target is not a literal regular file.",
  "unknown-marker": "An unknown portable publication marker blocks recovery.",
  "publication-conflict": "Another portable publication or an external target change won the compare-and-swap.",
  "stale-source": "The prepared source and project basis is no longer fresh.",
  "stale-target": "A publication target changed after preparation.",
  "compatibility-divergence": "The committed portable generation is valid, but one or more compatibility views diverged after commit.",
  "invalid-generation": "The sealed portable generation is incomplete or does not match its checksums.",
  "publication-failed": "The portable publication did not reach its commit point.",
  "recovery-required": "Portable publication recovery is pending and requires a fresh validated retry."
};

export type PortablePublicationDiagnostic = {
  readonly code: PublicationDiagnosticCode;
  readonly message: string;
};

export type PortablePublicationResult = {
  readonly ok: boolean;
  readonly status: "published" | "committed" | "reused" | "recovered" | "partial" | "rejected" | "conflict";
  readonly committed: boolean;
  readonly cleanupPending?: boolean;
  readonly retainedGenerations: number;
  readonly retainedBytes: number;
  readonly diagnostics: readonly PortablePublicationDiagnostic[];
  readonly preflight?: PortablePublicationPreflight;
};

export type CapturePortablePublicationInput = {
  readonly repositoryRoot?: string;
  readonly root?: string;
  readonly operationId: string;
  readonly transactionId?: string;
  readonly generationId: string;
  readonly sourceBasis: PortableSourceBasis;
  readonly verifyFreshness?: PortableFreshnessCheck;
  /**
   * Repair is an explicit authority. It binds the observed INDEX, target, and
   * marker hashes captured by this preflight and permits replacement of a
   * malformed/partial prior publication. Ordinary publication never infers it.
   */
  readonly repair?: {readonly authorized: true};
};

export type PublishPortableMapInput = CapturePortablePublicationInput & {
  readonly rendered: PortableRenderSuccess;
  readonly preflight?: PortablePublicationPreflight;
};

export type RecoverPortableMapInput = {
  readonly repositoryRoot?: string;
  readonly root?: string;
  /** A caller may bind a marker observed before dispatch. The hash is checked under the lock. */
  readonly observedMarker?: PortablePublicationMarker | string;
  readonly verifyFreshness?: PortableFreshnessCheck;
};

type PreparedMutationRoot = {
  readonly directories: DirectorySnapshot;
  readonly lockDirectories: DirectorySnapshot;
};

type State = {
  readonly rootFingerprint: string;
  readonly directories: DirectorySnapshot;
  readonly indexBytes: Uint8Array | null;
  readonly indexHash: string | null;
  readonly indexDescriptor: ReturnType<typeof parsePortableRootDescriptor>;
  readonly targetBytes: Readonly<Record<CodebaseDocumentId, Uint8Array | null>>;
  readonly targetHashes: PortableTargetHashes;
};

type MarkerRead =
  | {readonly kind: "absent"}
  | {readonly kind: "unknown"; readonly hash: string | null}
  | {readonly kind: "recognized"; readonly marker: PortablePublicationMarker; readonly hash: string};

type InternalResult = PortablePublicationResult;

function diagnostic(code: PublicationDiagnosticCode): PortablePublicationDiagnostic {
  return {code, message: MESSAGES[code]};
}

function failure(
  code: PublicationDiagnosticCode,
  status: PortablePublicationResult["status"] = "rejected",
  preflight?: PortablePublicationPreflight
): PortablePublicationResult {
  return {
    ok: false,
    status,
    committed: false,
    retainedGenerations: 0,
    retainedBytes: 0,
    diagnostics: [diagnostic(code)],
    ...(preflight ? {preflight} : {})
  };
}

function resolveRoot(input: {repositoryRoot?: string; root?: string}): string | null {
  const value = input.repositoryRoot ?? input.root;
  if (!value || typeof value !== "string" || value.includes("\0")) return null;
  return path.resolve(value);
}

function identity(stat: {dev: number; ino: number; size: number; mtimeMs: number; ctimeMs: number}): Identity {
  return {device: stat.dev, inode: stat.ino, size: Number(stat.size), mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs};
}

function sameIdentity(left: Identity, right: Identity): boolean {
  return left.device === right.device && left.inode === right.inode && left.size === right.size &&
    left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}

async function literalDirectorySnapshot(root: string): Promise<DirectorySnapshot | null> {
  const absolute = path.resolve(root);
  const parsed = path.parse(absolute);
  const segments = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  const candidates: string[] = [];
  let current = parsed.root;
  candidates.push(current);
  for (const segment of segments) {
    current = path.join(current, segment);
    candidates.push(current);
  }
  const entries: Array<{path: string; identity: Identity}> = [];
  for (const candidate of candidates) {
    const stat = await fs.lstat(candidate).catch(() => null);
    if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) return null;
    entries.push({path: candidate, identity: identity(stat)});
  }
  return entries;
}

async function assertDirectorySnapshot(snapshot: DirectorySnapshot): Promise<boolean> {
  for (const entry of snapshot) {
    const stat = await fs.lstat(entry.path).catch(() => null);
    const current = stat ? identity(stat) : null;
    // Descendant writes legitimately change directory timestamps. Device and
    // inode are the safety identity that detects root/ancestor replacement.
    if (!current || !stat!.isDirectory() || stat!.isSymbolicLink() || current.device !== entry.identity.device || current.inode !== entry.identity.inode) return false;
  }
  return true;
}

function directoryFingerprint(snapshot: DirectorySnapshot): string {
  // Directory mtimes and sizes describe descendant mutations as well as
  // replacement. The snapshot assertion already checks the safety identity
  // (canonical path, device, and inode) for every ancestor, so keep the
  // fingerprint to that identity and leave source/target changes to their
  // inventory and CAS hashes.
  return digest(encoder.encode(JSON.stringify(snapshot.map(entry => ({
    path: entry.path,
    device: entry.identity.device,
    inode: entry.identity.inode
  })) )));
}

async function ensureCodebaseRoot(repositoryRoot: string): Promise<DirectorySnapshot | null> {
  const rootSnapshot = await literalDirectorySnapshot(repositoryRoot);
  if (!rootSnapshot) return null;
  const blueprint = path.join(repositoryRoot, ".blueprint");
  const codebase = path.join(repositoryRoot, PORTABLE_CODEBASE_ROOT);
  // The parent may exist in an ordinary brownfield project; creation remains
  // literal and is followed by a fresh complete snapshot.
  for (const directory of [blueprint, codebase]) {
    const current = await fs.lstat(directory).catch(() => null);
    if (current?.isSymbolicLink() || (current && !current.isDirectory())) return null;
    if (!current) await fs.mkdir(directory);
  }
  return literalDirectorySnapshot(repositoryRoot);
}

/**
 * The shared lock helper creates its lock directory before invoking its
 * callback. Validate that parent chain before entering it; otherwise a
 * pre-existing `.blueprint/locks` symlink could redirect lock metadata.
 */
async function prepareMutationRoot(repositoryRoot: string): Promise<PreparedMutationRoot | null> {
  // Only lock-parent setup happens before lock acquisition. Codebase state is
  // created by ensureCodebaseRoot inside the lock callback below.
  const directories = await literalDirectorySnapshot(repositoryRoot);
  if (!directories) return null;
  const blueprint = path.join(repositoryRoot, ".blueprint");
  const blueprintStat = await fs.lstat(blueprint).catch(() => null);
  if (blueprintStat?.isSymbolicLink() || blueprintStat && !blueprintStat.isDirectory()) return null;
  if (!blueprintStat) await fs.mkdir(blueprint);
  const locks = path.join(repositoryRoot, ".blueprint", "locks");
  const existing = await fs.lstat(locks).catch(() => null);
  if (existing?.isSymbolicLink() || existing && !existing.isDirectory()) return null;
  if (!existing) await fs.mkdir(locks);
  const lockDirectories = await literalDirectorySnapshot(locks);
  if (!lockDirectories) return null;
  return {directories, lockDirectories};
}

function safeRelative(value: string): boolean {
  return value.length > 0 && !value.startsWith("/") && !value.includes("\\") &&
    !/[\0-\u001f\u007f]/.test(value) && !value.split("/").some(segment => !segment || segment === "." || segment === "..");
}

async function readRegular(filePath: string): Promise<Uint8Array | null> {
  const first = await fs.lstat(filePath).catch(error => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  });
  if (!first) return null;
  if (first.isSymbolicLink() || !first.isFile()) throw new Error("unsafe-target");
  const bytes = await fs.readFile(filePath);
  const second = await fs.lstat(filePath);
  if (second.isSymbolicLink() || !second.isFile() || !sameIdentity(identity(first), identity(second))) throw new Error("unsafe-target");
  return bytes;
}

async function exactAtomicWrite(filePath: string, bytes: Uint8Array): Promise<void> {
  const parent = path.dirname(filePath);
  const parentSnapshot = await literalDirectorySnapshot(parent);
  if (!parentSnapshot || !(await assertDirectorySnapshot(parentSnapshot))) throw new Error("unsafe-target");
  const previous = await fs.lstat(filePath).catch(error => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  });
  if (previous?.isSymbolicLink() || previous && !previous.isFile()) throw new Error("unsafe-target");
  const temp = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    await fs.writeFile(temp, bytes);
    if (previous) await fs.chmod(temp, previous.mode & 0o7777);
    const current = await fs.lstat(filePath).catch(error => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    });
    if ((previous && (!current || current.isSymbolicLink() || !sameIdentity(identity(previous), identity(current)))) || (!previous && current)) throw new Error("stale-target");
    if (!(await assertDirectorySnapshot(parentSnapshot))) throw new Error("unsafe-target");
    await fs.rename(temp, filePath);
    const after = await fs.lstat(filePath);
    if (after.isSymbolicLink() || !after.isFile()) throw new Error("unsafe-target");
    if (!(await assertDirectorySnapshot(parentSnapshot))) throw new Error("unsafe-target");
  } finally {
    await fs.rm(temp, {force: true}).catch(() => undefined);
  }
}

function targetPath(root: string, id: CodebaseDocumentId): string {
  return path.join(root, PORTABLE_CODEBASE_ROOT, DOCUMENT_FILE(id));
}

function indexPath(root: string): string {
  return path.join(root, PORTABLE_CODEBASE_ROOT, "INDEX.md");
}

function markerPath(root: string): string {
  return path.join(root, PORTABLE_CODEBASE_ROOT, ".publication.json");
}

function generationAbsolute(root: string, relative: string): string {
  return path.join(root, PORTABLE_CODEBASE_ROOT, relative);
}

type ArtifactParentState = "ok" | "missing" | "unsafe";

/**
 * Publication artifacts have a separate safety boundary from source files.
 * Check every existing parent literally before any read or mkdir so a
 * generations ancestor symlink cannot redirect work outside the repository.
 */
async function artifactParentState(root: string, relative: string): Promise<ArtifactParentState> {
  if (!safeRelative(relative)) return "unsafe";
  const rootSnapshot = await literalDirectorySnapshot(root);
  if (!rootSnapshot) return "unsafe";
  const directory = path.posix.dirname(relative);
  const segments = [".blueprint", "codebase", ...directory.split("/").filter(Boolean)];
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const stat = await fs.lstat(current).catch(() => null);
    if (!stat) return "missing";
    if (stat.isSymbolicLink() || !stat.isDirectory()) return "unsafe";
  }
  return "ok";
}

async function ensureArtifactParents(root: string, relative: string): Promise<void> {
  if (!safeRelative(relative)) throw new Error("invalid-generation");
  const rootSnapshot = await literalDirectorySnapshot(root);
  if (!rootSnapshot || !(await assertDirectorySnapshot(rootSnapshot))) throw new Error("unsafe-root");
  const directory = path.posix.dirname(relative);
  const segments = [".blueprint", "codebase", ...directory.split("/").filter(Boolean)];
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const before = await fs.lstat(current).catch(() => null);
    if (before) {
      if (before.isSymbolicLink() || !before.isDirectory()) throw new Error("unsafe-target");
      continue;
    }
    await fs.mkdir(current);
    const after = await fs.lstat(current).catch(() => null);
    if (!after || after.isSymbolicLink() || !after.isDirectory()) throw new Error("unsafe-target");
  }
}

async function readGeneratedRegular(root: string, relative: string): Promise<Uint8Array | null> {
  const state = await artifactParentState(root, relative);
  if (state === "unsafe") throw new Error("unsafe-target");
  if (state === "missing") return null;
  return readRegular(generationAbsolute(root, relative));
}

async function captureState(root: string, directories: DirectorySnapshot): Promise<State> {
  if (!(await assertDirectorySnapshot(directories))) throw new Error("unsafe-root");
  const idx = await readRegular(indexPath(root));
  const targetEntries = await Promise.all(CODEBASE_DOCUMENT_IDS.map(async id => [id, await readRegular(targetPath(root, id))] as const));
  const targetBytes = Object.fromEntries(targetEntries) as Record<CodebaseDocumentId, Uint8Array | null>;
  const targetHashes = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, targetBytes[id] === null ? null : digest(targetBytes[id]!)])) as PortableTargetHashes;
  let indexDescriptor: State["indexDescriptor"] = null;
  if (idx !== null) {
    try { indexDescriptor = parsePortableRootDescriptor(text(idx)); } catch { indexDescriptor = null; }
  }
  return {
    rootFingerprint: directoryFingerprint(directories),
    directories,
    indexBytes: idx,
    indexHash: idx === null ? null : digest(idx),
    indexDescriptor,
    targetBytes,
    targetHashes
  };
}

async function readMarker(root: string): Promise<MarkerRead> {
  const bytes = await readRegular(markerPath(root));
  if (bytes === null) return {kind: "absent"};
  const markerHash = digest(bytes);
  try {
    const parsed = portablePublicationMarkerSchema.safeParse(JSON.parse(text(bytes)));
    return parsed.success ? {kind: "recognized", marker: parsed.data, hash: markerHash} : {kind: "unknown", hash: markerHash};
  } catch {
    return {kind: "unknown", hash: markerHash};
  }
}

function markerBytes(marker: PortablePublicationMarker): Uint8Array {
  return encoder.encode(`${JSON.stringify(marker)}\n`);
}

function sameBasis(left: PortableSourceBasis, right: PortableSourceBasis): boolean {
  return left.rootHash === right.rootHash && left.inventoryHash === right.inventoryHash && left.evidenceHash === right.evidenceHash;
}

function sameTargetHashes(left: PortableTargetHashes, right: PortableTargetHashes): boolean {
  return CODEBASE_DOCUMENT_IDS.every(id => left[id] === right[id]);
}

function markerIdentityMatches(marker: PortablePublicationMarker, input: {operationId: string; transactionId: string; generationId: string}): boolean {
  return marker.operationId === input.operationId && marker.transactionId === input.transactionId && marker.generationId === input.generationId;
}

async function verifyFreshness(input: PortableFreshnessCheck | undefined, context: PortableFreshnessContext, required = true): Promise<boolean> {
  // Source freshness is a server-owned authority for every pre-commit path.
  // Only post-commit cleanup may deliberately bypass it.
  if (!input) return !required;
  try {
    const result = await input(context);
    return typeof result === "boolean" ? result : result.ok === true;
  } catch {
    return false;
  }
}

function validBasis(value: unknown): value is PortableSourceBasis {
  return portableSourceBasisSchema.safeParse(value).success;
}

function validTargetHashes(value: unknown): value is PortableTargetHashes {
  return portableTargetHashesSchema.safeParse(value).success;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/.test(value) && value.length <= 128;
}

async function generationFilesFromManifest(root: string, sealed: PortableSealedGenerationReference, expectedRootIndexHash?: string): Promise<boolean> {
  if (!safeRelative(sealed.generationId) || sealed.manifest.path !== `generations/${sealed.generationId}/manifest.json` || sealed.entry.path !== `generations/${sealed.generationId}/ENTRY.md`) return false;
  const manifestBytes = await readGeneratedRegular(root, sealed.manifest.path).catch(() => null);
  const entryBytes = await readGeneratedRegular(root, sealed.entry.path).catch(() => null);
  if (!manifestBytes || !entryBytes || digest(manifestBytes) !== sealed.manifest.checksum || digest(entryBytes) !== sealed.entry.checksum) return false;
  let manifest: ReturnType<typeof portableGenerationManifestSchema.parse>;
  try { manifest = portableGenerationManifestSchema.parse(JSON.parse(text(manifestBytes))); } catch { return false; }
  if (manifest.generationId !== sealed.generationId || manifest.checksums.entry !== sealed.entry.checksum) return false;
  for (const page of manifest.checksums.pages) {
    if (!safeRelative(page.path) || !page.path.startsWith(`generations/${sealed.generationId}/`)) return false;
    const bytes = await readGeneratedRegular(root, page.path).catch(() => null);
    if (!bytes || digest(bytes) !== page.checksum) return false;
  }
  for (const id of CODEBASE_DOCUMENT_IDS) {
    const relative = `generations/${sealed.generationId}/compatibility/${DOCUMENT_FILE(id)}`;
    const bytes = await readGeneratedRegular(root, relative).catch(() => null);
    if (!bytes || digest(bytes) !== manifest.checksums.compatibility[id]) return false;
  }
  if (expectedRootIndexHash !== undefined) {
    const stagedIndex = await readGeneratedRegular(root, `generations/${sealed.generationId}/${PORTABLE_GENERATION_INDEX_NAME}`).catch(() => null);
    if (!stagedIndex || digest(stagedIndex) !== expectedRootIndexHash) return false;
  }
  return true;
}

async function renderBundleValid(rendered: PortableRenderSuccess): Promise<boolean> {
  if (!rendered || rendered.ok !== true || !validId(rendered.manifest.generationId) || !portableGenerationManifestSchema.safeParse(rendered.manifest).success) return false;
  const files = rendered.files;
  const paths = Object.keys(files);
  if (!paths.includes("INDEX.md") || !paths.includes(rendered.sealedGeneration.entry.path) || !paths.includes(rendered.sealedGeneration.manifest.path)) return false;
  const generationPrefix = `generations/${rendered.manifest.generationId}/`;
  const allowedRootFiles = new Set(["INDEX.md", ...CODEBASE_DOCUMENT_IDS.map(DOCUMENT_FILE)]);
  if (paths.some(relative => !allowedRootFiles.has(relative) && !relative.startsWith(generationPrefix))) return false;
  if (digest(files["INDEX.md"]!) !== rendered.rootIndexHash || digest(rendered.rootIndexBytes) !== rendered.rootIndexHash) return false;
  if (digest(files[rendered.sealedGeneration.entry.path]!) !== rendered.sealedGeneration.entry.checksum || digest(files[rendered.sealedGeneration.manifest.path]!) !== rendered.sealedGeneration.manifest.checksum) return false;
  if (!portableSha256Schema.safeParse(rendered.rootIndexHash).success) return false;
  for (const [relative, bytes] of Object.entries(files)) {
    if (!safeRelative(relative) || !(bytes instanceof Uint8Array) || rendered.checksums[relative] !== digest(bytes)) return false;
  }
  if (rendered.sealedGeneration.generationId !== rendered.manifest.generationId) return false;
  if (rendered.manifest.checksums.entry !== rendered.sealedGeneration.entry.checksum) return false;
  for (const page of rendered.manifest.checksums.pages) {
    if (!files[page.path] || digest(files[page.path]!) !== page.checksum) return false;
  }
  for (const id of CODEBASE_DOCUMENT_IDS) {
    const rootName = DOCUMENT_FILE(id);
    const generationName = `generations/${rendered.manifest.generationId}/compatibility/${rootName}`;
    const bytes = rendered.rootViewBytes[rootName as keyof typeof rendered.rootViewBytes];
    if (!files[rootName] || !files[generationName] || !bytes || digest(bytes) !== rendered.manifest.checksums.compatibility[id] || digest(files[rootName]!) !== digest(bytes)) return false;
    if (digest(files[generationName]!) !== digest(bytes)) return false;
  }
  try {
    const parsed = JSON.parse(text(files[rendered.sealedGeneration.manifest.path]!));
    if (JSON.stringify(parsed) !== JSON.stringify(rendered.manifest)) return false;
  } catch { return false; }
  return true;
}

function renderedTargetHashes(rendered: PortableRenderSuccess): PortableTargetHashes {
  return Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => {
    const bytes = rendered.rootViewBytes[DOCUMENT_FILE(id) as keyof typeof rendered.rootViewBytes];
    return [id, bytes ? digest(bytes) : null];
  })) as PortableTargetHashes;
}

async function retainedReport(root: string): Promise<{count: number; bytes: number}> {
  const parentState = await artifactParentState(root, "generations");
  if (parentState !== "ok") return {count: 0, bytes: 0};
  const generations = generationAbsolute(root, "generations");
  const names = await fs.readdir(generations, {withFileTypes: true}).catch(() => []);
  let bytes = 0;
  let count = 0;
  const walk = async (filePath: string): Promise<void> => {
    const stat = await fs.lstat(filePath).catch(() => null);
    if (!stat || stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      for (const child of await fs.readdir(filePath)) await walk(path.join(filePath, child));
    } else if (stat.isFile()) bytes += Number(stat.size);
  };
  for (const name of names) if (name.isDirectory()) {count += 1; await walk(path.join(generations, name.name));}
  return {count, bytes};
}

async function writeGeneration(root: string, rendered: PortableRenderSuccess, legacyBackup: Readonly<Record<CodebaseDocumentId, Uint8Array>> | null): Promise<void> {
  const generationPrefix = `generations/${rendered.manifest.generationId}`;
  const entries: Array<[string, Uint8Array]> = Object.entries(rendered.files)
    .filter(([relative]) => relative.startsWith(`${generationPrefix}/`)) as Array<[string, Uint8Array]>;
  entries.push([`${generationPrefix}/${PORTABLE_GENERATION_INDEX_NAME}`, rendered.rootIndexBytes]);
  if (legacyBackup) for (const id of CODEBASE_DOCUMENT_IDS) entries.push([`${generationPrefix}/v1-backup/${DOCUMENT_FILE(id)}`, legacyBackup[id]!]);
  for (const [relative, bytes] of entries) {
    if (!safeRelative(relative)) throw new Error("invalid-generation");
    const absolute = generationAbsolute(root, relative);
    // Validate the complete generated-artifact parent chain before creating
    // anything. In particular, never let recursive mkdir follow generations.
    await ensureArtifactParents(root, relative);
    const existing = await readRegular(absolute).catch(error => {throw error;});
    if (existing && digest(existing) === digest(bytes)) continue;
    if (existing) throw new Error("publication-conflict");
    await exactAtomicWrite(absolute, bytes);
    const after = await readRegular(absolute);
    if (!after || digest(after) !== digest(bytes)) throw new Error("invalid-generation");
  }
  if (!(await generationFilesFromManifest(root, rendered.sealedGeneration, rendered.rootIndexHash))) throw new Error("invalid-generation");
}

async function legacyBackup(root: string, state: State, authorizedRepair = false): Promise<Readonly<Record<CodebaseDocumentId, Uint8Array>> | null> {
  // A deliberate repair may need a rollback basis for a malformed or broken
  // INDEX. Treat those existing seven views as accepted bytes only after the
  // same substantive legacy validation used for a first publication.
  if (state.indexBytes !== null && !authorizedRepair) return null;
  const all = CODEBASE_DOCUMENT_IDS.every(id => state.targetBytes[id] !== null);
  if (!all) return null;
  const backup: Partial<Record<CodebaseDocumentId, Uint8Array>> = {};
  for (const id of CODEBASE_DOCUMENT_IDS) {
    const bytes = state.targetBytes[id]!;
    let body: string;
    try { body = text(bytes); } catch { return null; }
    const validation = validateCodebaseContent(body, `codebase.${id}` as `codebase.${CodebaseDocumentId}`);
    if (!validation.valid) return null;
    backup[id] = bytes;
  }
  return backup as Readonly<Record<CodebaseDocumentId, Uint8Array>>;
}

async function previousGenerationValid(root: string, state: State): Promise<boolean> {
  if (!state.indexBytes) return true;
  if (!state.indexDescriptor) return false;
  // A portable INDEX is the commit authority. An existing malformed or
  // ambiguous INDEX cannot be silently treated as a first publication.
  return generationFilesFromManifest(root, {
    generationId: state.indexDescriptor.generationId,
    manifest: {path: state.indexDescriptor.manifest.path, checksum: state.indexDescriptor.manifest.sha256},
    entry: {path: state.indexDescriptor.entry.path, checksum: state.indexDescriptor.entry.sha256}
  });
}

async function buildPreflight(input: CapturePortablePublicationInput, root: string, directories: DirectorySnapshot, state: State): Promise<PortablePublicationPreflight | PortablePublicationResult> {
  const transactionId = input.transactionId ?? `${input.operationId}-tx`;
  if (!validId(input.operationId) || !validId(transactionId) || !validId(input.generationId) || !validBasis(input.sourceBasis)) return failure("invalid-input");
  const repair = input.repair?.authorized === true;
  if (!repair && !(await previousGenerationValid(root, state))) return failure("invalid-generation");
  const marker = await readMarker(root);
  if (marker.kind === "unknown") return failure("unknown-marker");
  if (marker.kind === "recognized" && !repair && !markerIdentityMatches(marker.marker, {operationId: input.operationId, transactionId, generationId: input.generationId})) return failure("publication-conflict");
  const context: PortableFreshnessContext = {
    phase: "capture", repositoryRoot: root, sourceBasis: input.sourceBasis,
    operationId: input.operationId, transactionId, generationId: input.generationId,
    previousIndexHash: state.indexHash, previousTargetHashes: state.targetHashes
  };
  if (!(await verifyFreshness(input.verifyFreshness, context))) return failure("stale-source");
  if (!(await assertDirectorySnapshot(directories))) return failure("unsafe-root", "conflict");
  return {
    repositoryRoot: root,
    operationId: input.operationId,
    transactionId,
    generationId: input.generationId,
    sourceBasis: input.sourceBasis,
    rootFingerprint: directoryFingerprint(directories),
    previousGenerationId: state.indexDescriptor?.generationId ?? null,
    previousIndexHash: state.indexHash,
    previousTargetHashes: state.targetHashes,
    observedMarkerHash: marker.kind === "recognized" ? marker.hash : null,
    legacyBackup: (state.indexBytes === null || repair) && CODEBASE_DOCUMENT_IDS.every(id => state.targetBytes[id] !== null),
    repair
  };
}

export async function capturePortablePublicationPreflight(input: CapturePortablePublicationInput): Promise<PortablePublicationPreflight | PortablePublicationResult> {
  const root = resolveRoot(input);
  if (!root) return failure("invalid-input");
  const preparedRoot = await prepareMutationRoot(root);
  if (!preparedRoot) return failure("unsafe-root");
  const {directories: rootDirectories, lockDirectories} = preparedRoot;
  return withBlueprintRepoLock(root, PORTABLE_PUBLICATION_LOCK, async () => {
    if (!(await assertDirectorySnapshot(lockDirectories))) return failure("unsafe-root", "conflict");
    try {
      const directories = await ensureCodebaseRoot(root);
      if (!directories || !(await assertDirectorySnapshot(rootDirectories))) return failure("unsafe-root", "conflict");
      const state = await captureState(root, directories);
      return buildPreflight(input, root, directories, state);
    } catch (error) {
      return failure((error as Error).message === "unsafe-root" ? "unsafe-root" : "unsafe-target");
    }
  });
}

export const preparePortablePublication = capturePortablePublicationPreflight;

function markerFor(input: PublishPortableMapInput, preflight: PortablePublicationPreflight, rendered: PortableRenderSuccess, backup: Readonly<Record<CodebaseDocumentId, Uint8Array>> | null): PortablePublicationMarker {
  const nextTargetHashes = renderedTargetHashes(rendered);
  const marker: PortablePublicationMarker = {
    version: 2,
    operationId: preflight.operationId,
    transactionId: preflight.transactionId,
    stage: "publishing",
    generationId: rendered.manifest.generationId,
    previousGenerationId: preflight.previousGenerationId,
    previousIndexHash: preflight.previousIndexHash,
    nextIndexHash: rendered.rootIndexHash,
    sourceBasis: preflight.sourceBasis,
    previousTargetHashes: preflight.previousTargetHashes,
    nextTargetHashes: nextTargetHashes as unknown as PortablePublicationMarker["nextTargetHashes"],
    sealedGeneration: rendered.sealedGeneration,
    v1BackupReference: backup ? {
      version: 1,
      rootPath: `generations/${rendered.manifest.generationId}/v1-backup`,
      generationId: null,
      compatibility: Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, {path: `generations/${rendered.manifest.generationId}/v1-backup/${DOCUMENT_FILE(id)}`, checksum: preflight.previousTargetHashes[id]!}])) as Record<CodebaseDocumentId, {path: string; checksum: string}>
    } : null,
    createdAt: new Date().toISOString()
  };
  return portablePublicationMarkerSchema.parse(marker);
}

async function markerStill(root: string, expected: PortablePublicationMarker): Promise<boolean> {
  const bytes = await readRegular(markerPath(root)).catch(error => {
    if ((error as Error).message === "unsafe-target") throw error;
    return null;
  });
  return bytes !== null && digest(bytes) === digest(markerBytes(expected));
}

async function rootIndexMatches(root: string, hash: string): Promise<boolean> {
  const bytes = await readRegular(indexPath(root)).catch(error => {
    if ((error as Error).message === "unsafe-target") throw error;
    return null;
  });
  return bytes !== null && digest(bytes) === hash;
}

async function readRestoreBytes(root: string, marker: PortablePublicationMarker, id: CodebaseDocumentId): Promise<Uint8Array | null> {
  const previous = marker.previousTargetHashes[id];
  if (previous === null) return null;
  let bytes: Uint8Array | null = null;
  if (marker.v1BackupReference) bytes = await readGeneratedRegular(root, marker.v1BackupReference.compatibility[id].path).catch(() => null);
  if (!bytes && marker.previousGenerationId) bytes = await readGeneratedRegular(root, `generations/${marker.previousGenerationId}/compatibility/${DOCUMENT_FILE(id)}`).catch(() => null);
  if (!bytes || digest(bytes) !== previous) return null;
  return bytes;
}

async function previousGenerationIsRestorable(root: string, marker: PortablePublicationMarker): Promise<boolean> {
  if (marker.v1BackupReference) {
    // A legacy upgrade may restore only after the complete seven-file backup
    // is present and hash-verified. Do this validation before touching any
    // root target so a partial backup cannot produce a partial rollback.
    for (const id of CODEBASE_DOCUMENT_IDS) {
      const reference = marker.v1BackupReference.compatibility[id];
      if (!safeRelative(reference.path)) return false;
      const bytes = await readGeneratedRegular(root, reference.path).catch(() => null);
      if (!bytes || digest(bytes) !== reference.checksum || digest(bytes) !== marker.previousTargetHashes[id]) return false;
    }
  }
  if (!marker.previousGenerationId) return true;
  const manifestBytes = await readGeneratedRegular(root, `generations/${marker.generationId}/manifest.json`).catch(() => null);
  if (!manifestBytes) return false;
  try {
    const manifest = portableGenerationManifestSchema.parse(JSON.parse(text(manifestBytes)));
    const proof = manifest.predecessorPublicationProof;
    if (!proof || proof.generationId !== marker.previousGenerationId || proof.committedIndexHash !== marker.previousIndexHash) return false;
    return generationFilesFromManifest(root, {
      generationId: proof.generationId,
      manifest: {path: proof.manifest.path, checksum: proof.manifest.checksum},
      entry: {path: proof.entry.path, checksum: proof.entry.checksum}
    });
  } catch {
    return false;
  }
}

async function restorePrecommit(root: string, marker: PortablePublicationMarker): Promise<boolean> {
  if (!(await previousGenerationIsRestorable(root, marker))) return false;
  let complete = true;
  for (const id of CODEBASE_DOCUMENT_IDS) {
    const current = await readRegular(targetPath(root, id)).catch(error => {
      if ((error as Error).message === "unsafe-target") throw error;
      return null;
    });
    const currentHash = current === null ? null : digest(current);
    const next = marker.nextTargetHashes[id];
    const previous = marker.previousTargetHashes[id];
    if (currentHash === previous) continue;
    if (currentHash !== next) { complete = false; continue; }
    if (previous === null) {
      await fs.rm(targetPath(root, id), {force: true}).catch(() => {complete = false;});
      const after = await readRegular(targetPath(root, id)).catch(error => {
        if ((error as Error).message === "unsafe-target") throw error;
        return null;
      });
      if (after !== null) complete = false;
      continue;
    }
    const bytes = await readRestoreBytes(root, marker, id);
    if (!bytes) { complete = false; continue; }
    try { await exactAtomicWrite(targetPath(root, id), bytes); } catch { complete = false; continue; }
    const after = await readRegular(targetPath(root, id)).catch(error => {
      if ((error as Error).message === "unsafe-target") throw error;
      return null;
    });
    if (!after || digest(after) !== previous) complete = false;
  }
  if (!complete) return false;
  if (await rootIndexMatches(root, marker.nextIndexHash)) {
    // The index hash is the commit point. A precommit restore must never
    // replace it with guessed content.
    return false;
  }
  if (await markerStill(root, marker)) await fs.rm(markerPath(root), {force: true});
  return true;
}

async function cleanupCommitted(root: string, marker: PortablePublicationMarker): Promise<boolean> {
  if (!(await generationFilesFromManifest(root, marker.sealedGeneration, marker.nextIndexHash))) return false;
  if (!(await rootIndexMatches(root, marker.nextIndexHash))) return false;
  // INDEX is already the commit point, so cleanup must never overwrite a
  // compatibility view that changed after commit. Keep the marker as an
  // explicit cleanup debt receipt until every view still matches the sealed
  // generation's hashes.
  for (const id of CODEBASE_DOCUMENT_IDS) {
    const bytes = await readRegular(targetPath(root, id));
    const currentHash = bytes === null ? null : digest(bytes);
    if (currentHash !== marker.nextTargetHashes[id]) return false;
  }
  const current = await readMarker(root);
  // A committed retry may encounter any publication stage. Match the full
  // transaction identity, then compare the exact current marker bytes before
  // removing it so a concurrent/unknown marker is never reported as cleaned.
  if (current.kind !== "recognized" || !markerIdentityMatches(current.marker, marker)) return false;
  if (!(await markerStill(root, current.marker))) return false;
  await fs.rm(markerPath(root), {force: true});
  return true;
}

async function finalPrecommitValidation(
  root: string,
  directories: DirectorySnapshot,
  marker: PortablePublicationMarker,
  freshnessCheck: PortableFreshnessCheck | undefined,
  freshnessContext: PortableFreshnessContext
): Promise<string | null> {
  if (!(await verifyFreshness(freshnessCheck, freshnessContext))) throw new Error("stale-source");
  if (!(await assertDirectorySnapshot(directories))) throw new Error("unsafe-root");
  for (const id of CODEBASE_DOCUMENT_IDS) {
    const bytes = await readRegular(targetPath(root, id));
    if (!bytes || digest(bytes) !== marker.nextTargetHashes[id]) throw new Error("stale-target");
  }
  if (!(await markerStill(root, marker))) throw new Error("publication-conflict");
  if (!(await assertDirectorySnapshot(directories))) throw new Error("unsafe-root");
  const currentIndex = await readRegular(indexPath(root));
  const currentIndexHash = currentIndex === null ? null : digest(currentIndex);
  if (currentIndexHash !== marker.previousIndexHash && currentIndexHash !== marker.nextIndexHash) throw new Error("stale-target");
  return currentIndexHash;
}

async function resultAfter(root: string, status: PortablePublicationResult["status"], committed: boolean, diagnostics: readonly PortablePublicationDiagnostic[], preflight?: PortablePublicationPreflight, cleanupPending = false): Promise<PortablePublicationResult> {
  const retained = await retainedReport(root);
  return {ok: committed || status === "published" || status === "reused" || status === "recovered", status, committed, cleanupPending: cleanupPending || undefined, retainedGenerations: retained.count, retainedBytes: retained.bytes, diagnostics, ...(preflight ? {preflight} : {})};
}

/** Test seam for real rename crash-window tests; production callers leave it empty. */
export const portablePublicationTestHooks: {
  beforeMarkerWrite?: (marker: PortablePublicationMarker) => Promise<void> | void;
  afterMarkerWrite?: (marker: PortablePublicationMarker) => Promise<void> | void;
  beforeCompatibilityWrite?: (id: CodebaseDocumentId) => Promise<void> | void;
  beforeIndexCommit?: () => Promise<void> | void;
  afterIndexCommit?: () => Promise<void> | void;
  beforeCleanup?: () => Promise<void> | void;
} = {};

async function publishLocked(input: PublishPortableMapInput, root: string, directories: DirectorySnapshot, preflight: PortablePublicationPreflight): Promise<InternalResult> {
  if (!(await renderBundleValid(input.rendered))) return failure("invalid-generation", "rejected", preflight);
  if (input.rendered.manifest.generationId !== preflight.generationId) return failure("publication-conflict", "conflict", preflight);
  if (input.rendered.manifest.predecessorGenerationId !== preflight.previousGenerationId) return failure("publication-conflict", "conflict", preflight);
  if (!(await assertDirectorySnapshot(directories))) return failure("unsafe-root", "conflict", preflight);
  const markerRead = await readMarker(root);
  if (markerRead.kind === "unknown") return failure("unknown-marker", "conflict", preflight);
  let marker: PortablePublicationMarker;
  let resumed = false;
  let legacy: Readonly<Record<CodebaseDocumentId, Uint8Array>> | null = null;
  const state = await captureState(root, directories).catch(() => null);
  if (!state) return failure("unsafe-root", "conflict", preflight);
  if (markerRead.kind === "absent" && !preflight.repair && !(await previousGenerationValid(root, state))) return failure("invalid-generation", "conflict", preflight);
  if (markerRead.kind === "recognized" && !preflight.repair) {
    if (preflight.observedMarkerHash === null) return failure("publication-conflict", "conflict", preflight);
    if (!markerIdentityMatches(markerRead.marker, preflight)) return failure("publication-conflict", "conflict", preflight);
    if (preflight.observedMarkerHash !== null && preflight.observedMarkerHash !== markerRead.hash) {
      return failure("publication-conflict", "conflict", preflight);
    }
    marker = markerRead.marker;
    resumed = true;
    if (marker.nextIndexHash !== input.rendered.rootIndexHash || !sameBasis(marker.sourceBasis, preflight.sourceBasis)) return failure("publication-conflict", "conflict", preflight);
  } else {
    // An explicit repair may replace one recognized marker, but only the
    // exact marker hash observed during this preflight authorizes that action.
    if (markerRead.kind === "recognized" && (!preflight.repair || preflight.observedMarkerHash !== markerRead.hash)) {
      return failure("publication-conflict", "conflict", preflight);
    }
    if (markerRead.kind === "absent" && preflight.observedMarkerHash !== null) return failure("publication-conflict", "conflict", preflight);
    if (state.rootFingerprint !== preflight.rootFingerprint || state.indexHash !== preflight.previousIndexHash || !sameTargetHashes(state.targetHashes, preflight.previousTargetHashes)) return failure("stale-target", "conflict", preflight);
    if (state.indexDescriptor && state.indexDescriptor.generationId !== preflight.previousGenerationId) return failure("publication-conflict", "conflict", preflight);
    if (!(await verifyFreshness(input.verifyFreshness, {
      phase: "before-marker", repositoryRoot: root, sourceBasis: preflight.sourceBasis,
      operationId: preflight.operationId, transactionId: preflight.transactionId, generationId: preflight.generationId,
      previousIndexHash: preflight.previousIndexHash, previousTargetHashes: preflight.previousTargetHashes
    }))) return failure("stale-source", "rejected", preflight);
    if (!(await assertDirectorySnapshot(directories))) return failure("unsafe-root", "conflict", preflight);
    legacy = await legacyBackup(root, state, preflight.repair);
    marker = markerFor(input, preflight, input.rendered, legacy);
    try {
      await writeGeneration(root, input.rendered, legacy);
      await portablePublicationTestHooks.beforeMarkerWrite?.(marker);
      // Staging is asynchronous. Re-read the marker immediately before a
      // repair replacement so an observed marker cannot be silently replaced
      // after it changed (including to an unknown marker).
      const beforeReplace = await readMarker(root);
      if (preflight.repair) {
        if (beforeReplace.kind === "unknown") return failure("unknown-marker", "conflict", preflight);
        if (preflight.observedMarkerHash === null) {
          if (beforeReplace.kind !== "absent") return failure("publication-conflict", "conflict", preflight);
        } else if (beforeReplace.kind !== "recognized" || beforeReplace.hash !== preflight.observedMarkerHash) {
          return failure("publication-conflict", "conflict", preflight);
        }
      } else if (beforeReplace.kind !== "absent") {
        return failure(beforeReplace.kind === "unknown" ? "unknown-marker" : "publication-conflict", "conflict", preflight);
      }
      await exactAtomicWrite(markerPath(root), markerBytes(marker));
      if (!(await markerStill(root, marker))) return failure("publication-failed", "partial", preflight);
      await portablePublicationTestHooks.afterMarkerWrite?.(marker);
    } catch (error) {
      return failure((error as Error).message === "publication-conflict" ? "publication-conflict" : (error as Error).message === "unsafe-target" ? "unsafe-target" : "publication-failed", "partial", preflight);
    }
  }
  // Once INDEX points at the sealed generation, this is cleanup recovery. It
  // must remain idempotent even after the source tree has changed and therefore
  // never asks for a new freshness proof.
  if (resumed && await rootIndexMatches(root, marker.nextIndexHash) && await generationFilesFromManifest(root, marker.sealedGeneration, marker.nextIndexHash)) {
    try {
      await portablePublicationTestHooks.beforeCleanup?.();
      const cleaned = await cleanupCommitted(root, marker);
      return resultAfter(root, "committed", true, cleaned ? [] : [diagnostic("publication-failed")], preflight, !cleaned);
    } catch {
      return resultAfter(root, "committed", true, [diagnostic("publication-failed")], preflight, true);
    }
  }
  try {
    if (!(await generationFilesFromManifest(root, marker.sealedGeneration, marker.nextIndexHash))) throw new Error("invalid-generation");
    for (const id of CODEBASE_DOCUMENT_IDS) {
      const current = await readRegular(targetPath(root, id));
      const currentHash = current === null ? null : digest(current);
      const previous = marker.previousTargetHashes[id];
      const next = marker.nextTargetHashes[id];
      if (currentHash === next) continue;
      if (currentHash !== previous) throw new Error("stale-target");
      await portablePublicationTestHooks.beforeCompatibilityWrite?.(id);
      await exactAtomicWrite(targetPath(root, id), input.rendered.rootViewBytes[DOCUMENT_FILE(id) as keyof typeof input.rendered.rootViewBytes]!);
      const after = await readRegular(targetPath(root, id));
      if (!after || digest(after) !== next) throw new Error("publication-failed");
    }
    if (!(await verifyFreshness(input.verifyFreshness, {
      phase: "before-index", repositoryRoot: root, sourceBasis: marker.sourceBasis,
      operationId: marker.operationId, transactionId: marker.transactionId, generationId: marker.generationId,
      previousIndexHash: marker.previousIndexHash, previousTargetHashes: marker.previousTargetHashes
    }))) throw new Error("stale-source");
    await portablePublicationTestHooks.beforeIndexCommit?.();
    // This is the final source, target, marker, and ancestor CAS immediately
    // before the INDEX commit point. A change after the compatibility loop
    // must never be hidden by a successful root-index swap.
    const currentIndexHash = await finalPrecommitValidation(root, directories, marker, input.verifyFreshness, {
      phase: "before-index", repositoryRoot: root, sourceBasis: marker.sourceBasis,
      operationId: marker.operationId, transactionId: marker.transactionId, generationId: marker.generationId,
      previousIndexHash: marker.previousIndexHash, previousTargetHashes: marker.previousTargetHashes
    });
    if (currentIndexHash !== marker.nextIndexHash) {
      await exactAtomicWrite(indexPath(root), input.rendered.rootIndexBytes);
      await portablePublicationTestHooks.afterIndexCommit?.();
    }
  } catch (error) {
    if (await rootIndexMatches(root, marker.nextIndexHash) && await generationFilesFromManifest(root, marker.sealedGeneration, marker.nextIndexHash)) {
      const committedMarker = {...marker, stage: "index-committed" as const};
      try { if (await markerStill(root, marker)) await exactAtomicWrite(markerPath(root), markerBytes(committedMarker)); } catch { /* recovery can infer the commit from INDEX */ }
      try {
        const cleanupMarker = {...committedMarker, stage: "cleanup" as const};
        if (await markerStill(root, committedMarker)) await exactAtomicWrite(markerPath(root), markerBytes(cleanupMarker));
        await portablePublicationTestHooks.beforeCleanup?.();
        const cleaned = await cleanupCommitted(root, cleanupMarker);
        return resultAfter(root, cleaned ? "committed" : "committed", true, cleaned ? [] : [diagnostic("publication-failed")], preflight, !cleaned);
      } catch { return resultAfter(root, "committed", true, [diagnostic("publication-failed")], preflight, true); }
    }
    const restored = await restorePrecommit(root, marker).catch(() => false);
    return resultAfter(root, restored ? "partial" : "partial", false, [diagnostic(
      (error as Error).message === "stale-source" ? "stale-source" :
      (error as Error).message === "stale-target" ? "stale-target" :
      (error as Error).message === "publication-conflict" ? "publication-conflict" :
      "publication-failed"
    )], preflight, !restored);
  }
  try {
    const committedMarker = {...marker, stage: "index-committed" as const};
    if (await markerStill(root, marker)) await exactAtomicWrite(markerPath(root), markerBytes(committedMarker));
    const cleanupMarker = {...committedMarker, stage: "cleanup" as const};
    if (await markerStill(root, committedMarker)) await exactAtomicWrite(markerPath(root), markerBytes(cleanupMarker));
    await portablePublicationTestHooks.beforeCleanup?.();
    const cleaned = await cleanupCommitted(root, cleanupMarker);
    return resultAfter(root, cleaned ? "published" : "committed", true, cleaned ? [] : [diagnostic("publication-failed")], preflight, !cleaned);
  } catch {
    return resultAfter(root, "committed", true, [diagnostic("publication-failed")], preflight, true);
  }
}

export async function publishPortableMap(input: PublishPortableMapInput): Promise<PortablePublicationResult> {
  const root = resolveRoot(input);
  if (!root || !validBasis(input.sourceBasis) || !validId(input.operationId) || !validId(input.generationId)) return failure("invalid-input");
  const preparedRoot = await prepareMutationRoot(root);
  if (!preparedRoot) return failure("unsafe-root");
  const {directories: rootDirectories, lockDirectories} = preparedRoot;
  return withBlueprintRepoLock(root, PORTABLE_PUBLICATION_LOCK, async () => {
    if (!(await assertDirectorySnapshot(lockDirectories))) return failure("unsafe-root", "conflict");
    try {
      const directories = await ensureCodebaseRoot(root);
      if (!directories || !(await assertDirectorySnapshot(rootDirectories))) return failure("unsafe-root", "conflict");
      const state = await captureState(root, directories);
      const markerRead = await readMarker(root);
      if (markerRead.kind === "unknown") return failure("unknown-marker", "conflict", input.preflight);
      // A retry after a successful commit is idempotent even when cleanup
      // already removed the marker. The INDEX and sealed generation are the
      // commit authority; compatibility divergence is reported separately
      // without writing a marker, touching the views, or asking for freshness.
      if (await renderBundleValid(input.rendered) && state.indexHash === input.rendered.rootIndexHash &&
          state.indexDescriptor?.generationId === input.rendered.manifest.generationId &&
          await generationFilesFromManifest(root, input.rendered.sealedGeneration, input.rendered.rootIndexHash)) {
        if (markerRead.kind === "recognized") {
          const transactionId = input.preflight?.transactionId ?? input.transactionId ?? `${input.operationId}-tx`;
          if (!markerIdentityMatches(markerRead.marker, {operationId: input.operationId, transactionId, generationId: input.generationId})) {
            return failure("publication-conflict", "conflict", input.preflight);
          }
          try {
            await portablePublicationTestHooks.beforeCleanup?.();
            const cleaned = await cleanupCommitted(root, markerRead.marker);
            return resultAfter(root, "committed", true, cleaned ? [] : [diagnostic("publication-failed")], input.preflight, !cleaned);
          } catch {
            return resultAfter(root, "committed", true, [diagnostic("publication-failed")], input.preflight, true);
          }
        }
        if (!sameTargetHashes(state.targetHashes, renderedTargetHashes(input.rendered))) {
          return resultAfter(root, "committed", true, [diagnostic("compatibility-divergence")], input.preflight);
        }
        return resultAfter(root, "reused", true, [], input.preflight);
      }
      const preflightValue = input.preflight ?? await buildPreflight(input, root, directories, state);
      if ("ok" in preflightValue) return preflightValue;
      if (preflightValue.repositoryRoot !== root) return failure("publication-conflict");
      const marker = await readMarker(root);
      const sameOperation = marker.kind === "recognized" && markerIdentityMatches(marker.marker, preflightValue);
      if (!sameOperation && (state.rootFingerprint !== preflightValue.rootFingerprint || state.indexHash !== preflightValue.previousIndexHash || !sameTargetHashes(state.targetHashes, preflightValue.previousTargetHashes))) return failure("stale-target", "conflict", preflightValue);
      return publishLocked(input, root, directories, preflightValue);
    } catch (error) {
      return failure((error as Error).message === "unsafe-root" ? "unsafe-root" : "publication-failed", "partial", input.preflight);
    }
  });
}

export const publishPortableBundle = publishPortableMap;
export const publishPortableCodebaseMap = publishPortableMap;

async function recoverLocked(root: string, observedMarker?: PortablePublicationMarker | string, freshnessCheck?: PortableFreshnessCheck): Promise<PortablePublicationResult> {
  const markerRead = await readMarker(root);
  if (markerRead.kind === "absent") {
    const retained = await retainedReport(root);
    return {ok: true, status: "reused", committed: false, retainedGenerations: retained.count, retainedBytes: retained.bytes, diagnostics: []};
  }
  if (markerRead.kind === "unknown") return failure("unknown-marker", "conflict");
  const marker = markerRead.marker;
  if (observedMarker === undefined) return failure("publication-conflict", "conflict");
  if (observedMarker !== undefined) {
    const bound = typeof observedMarker === "string"
      ? /^[a-f0-9]{64}$/.test(observedMarker) ? observedMarker : digest(encoder.encode(observedMarker))
      : digest(markerBytes(observedMarker));
    if (bound !== markerRead.hash) return failure("publication-conflict", "conflict");
  }
  if (!(await generationFilesFromManifest(root, marker.sealedGeneration, marker.nextIndexHash))) return failure("invalid-generation", "conflict");
  const directories = await literalDirectorySnapshot(root);
  if (!directories) return failure("unsafe-root", "conflict");
  if (await rootIndexMatches(root, marker.nextIndexHash)) {
    try { const cleaned = await cleanupCommitted(root, marker); return resultAfter(root, "recovered", true, cleaned ? [] : [diagnostic("publication-failed")], undefined, !cleaned); } catch { return resultAfter(root, "recovered", true, [diagnostic("publication-failed")], undefined, true); }
  }
  const freshness = await verifyFreshness(freshnessCheck, {
    phase: "before-index", repositoryRoot: root, sourceBasis: marker.sourceBasis,
    operationId: marker.operationId, transactionId: marker.transactionId, generationId: marker.generationId,
    previousIndexHash: marker.previousIndexHash, previousTargetHashes: marker.previousTargetHashes
  });
  if (!freshness) return failure("stale-source", "partial");
  try {
    for (const id of CODEBASE_DOCUMENT_IDS) {
      const current = await readRegular(targetPath(root, id));
      const currentHash = current === null ? null : digest(current);
      if (currentHash === marker.nextTargetHashes[id]) continue;
      if (currentHash !== marker.previousTargetHashes[id]) throw new Error("stale-target");
      const bytes = await readGeneratedRegular(root, `generations/${marker.generationId}/compatibility/${DOCUMENT_FILE(id)}`);
      if (!bytes || digest(bytes) !== marker.nextTargetHashes[id]) throw new Error("invalid-generation");
      await exactAtomicWrite(targetPath(root, id), bytes);
    }
    const stagedIndex = await readGeneratedRegular(root, `generations/${marker.generationId}/${PORTABLE_GENERATION_INDEX_NAME}`);
    if (!stagedIndex || digest(stagedIndex) !== marker.nextIndexHash) throw new Error("invalid-generation");
    const currentIndex = await readRegular(indexPath(root));
    const currentIndexHash = currentIndex === null ? null : digest(currentIndex);
    if (currentIndexHash !== marker.previousIndexHash && currentIndexHash !== marker.nextIndexHash) throw new Error("stale-target");
    await portablePublicationTestHooks.beforeIndexCommit?.();
    const finalIndexHash = await finalPrecommitValidation(root, directories, marker, freshnessCheck, {
      phase: "before-index", repositoryRoot: root, sourceBasis: marker.sourceBasis,
      operationId: marker.operationId, transactionId: marker.transactionId, generationId: marker.generationId,
      previousIndexHash: marker.previousIndexHash, previousTargetHashes: marker.previousTargetHashes
    });
    if (finalIndexHash !== marker.nextIndexHash) await exactAtomicWrite(indexPath(root), stagedIndex);
    if (!(await rootIndexMatches(root, marker.nextIndexHash))) throw new Error("publication-failed");
    const committedMarker = {...marker, stage: "index-committed" as const};
    if (await markerStill(root, marker)) await exactAtomicWrite(markerPath(root), markerBytes(committedMarker));
    const cleanupMarker = {...committedMarker, stage: "cleanup" as const};
    if (await markerStill(root, committedMarker)) await exactAtomicWrite(markerPath(root), markerBytes(cleanupMarker));
    const cleaned = await cleanupCommitted(root, cleanupMarker);
    return resultAfter(root, "recovered", true, cleaned ? [] : [diagnostic("publication-failed")], undefined, !cleaned);
  } catch (error) {
    const committed = await rootIndexMatches(root, marker.nextIndexHash) && await generationFilesFromManifest(root, marker.sealedGeneration, marker.nextIndexHash);
    if (committed) return resultAfter(root, "recovered", true, [diagnostic("publication-failed")], undefined, true);
    const restored = await restorePrecommit(root, marker).catch(() => false);
    return resultAfter(root, "partial", false, [diagnostic(
      (error as Error).message === "stale-source" ? "stale-source" :
      (error as Error).message === "stale-target" ? "stale-target" :
      (error as Error).message === "publication-conflict" ? "publication-conflict" :
      "recovery-required"
    )], undefined, !restored);
  }
}

export async function recoverPortableMap(input: RecoverPortableMapInput): Promise<PortablePublicationResult> {
  const root = resolveRoot(input);
  if (!root) return failure("invalid-input");
  const directories = await literalDirectorySnapshot(root);
  const lockDirectories = await literalDirectorySnapshot(path.join(root, ".blueprint", "locks"));
  if (!directories || !lockDirectories) return failure("unsafe-root");
  return withBlueprintRepoLock(root, PORTABLE_PUBLICATION_LOCK, async () => {
    if (!(await assertDirectorySnapshot(directories)) || !(await assertDirectorySnapshot(lockDirectories))) return failure("unsafe-root", "conflict");
    return recoverLocked(root, input.observedMarker, input.verifyFreshness);
  });
}

export const recoverPortablePublication = recoverPortableMap;
export const repairPortablePublication = recoverPortableMap;
