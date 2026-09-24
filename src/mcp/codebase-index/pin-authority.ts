import {createHash, createHmac, randomBytes, timingSafeEqual} from "node:crypto";
import {constants as fsConstants} from "node:fs";
import {promises as fs} from "node:fs";
import path from "node:path";

import {readHardenedLiteralFile} from "./literal-read.js";

/** Operational state is deliberately outside the portable transfer bundle. */
export const PORTABLE_PIN_AUTHORITY_ROOT = ".blueprint/codebase-operations/pin-authority";
export const PORTABLE_PIN_AUTHORITY_KEY_FILE = "owner.key";
export const PORTABLE_PIN_AUTHORITY_RECEIPTS_ROOT = "receipts";
export const PORTABLE_PIN_RECEIPT_VERSION = 1 as const;

const SHA256 = /^[a-f0-9]{64}$/;
const GENERATION_ID = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/;
const KEY_BYTES = 32;

export type PortablePinAuthorityRootIdentity = {
  readonly path: string;
  readonly realPath: string;
  readonly device: number;
  readonly inode: number;
  readonly ancestors: readonly {
    readonly path: string;
    readonly device: number;
    readonly inode: number;
  }[];
};

export type PortablePinAuthorityPin = {
  readonly generationId: string;
  readonly entry: {readonly path: string; readonly sha256: string};
  readonly manifest: {readonly path: string; readonly sha256: string};
};

export type PortablePinReceipt = {
  readonly version: typeof PORTABLE_PIN_RECEIPT_VERSION;
  readonly root: PortablePinAuthorityRootIdentity;
  readonly pin: PortablePinAuthorityPin;
  readonly issuedAt: string;
  readonly authentication: string;
};

export type PortablePinAuthorityDirectoryIdentity = {
  readonly path: string;
  readonly device: number;
  readonly inode: number;
};

type OwnedLeafIdentity = {readonly device: number; readonly inode: number};
type OpenHandle = Awaited<ReturnType<typeof fs.open>>;

function safeRelative(value: string): boolean {
  return value.length > 0 && !value.startsWith("/") && !value.includes("\\") &&
    !/[\0-\u001f\u007f]/.test(value) && !value.split("/").some(segment => !segment || segment === "." || segment === "..");
}

function sameIdentity(left: PortablePinAuthorityRootIdentity, right: PortablePinAuthorityRootIdentity): boolean {
  return left.path === right.path && left.realPath === right.realPath && left.device === right.device && left.inode === right.inode &&
    left.ancestors.length === right.ancestors.length && left.ancestors.every((item, index) => {
      const other = right.ancestors[index]!;
      return item.path === other.path && item.device === other.device && item.inode === other.inode;
    });
}

async function captureRootIdentity(root: string): Promise<PortablePinAuthorityRootIdentity | null> {
  if (typeof root !== "string" || root.length === 0 || root.includes("\0")) return null;
  const absolute = path.resolve(root);
  const parsed = path.parse(absolute);
  const ancestors: Array<{readonly path: string; readonly device: number; readonly inode: number}> = [];
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = await fs.stat(current).catch(() => null);
    if (!stat || !stat.isDirectory()) return null;
    if (current !== absolute) {
      const canonical = await fs.realpath(current).catch(() => null);
      if (!canonical) return null;
      ancestors.push({path: canonical, device: stat.dev, inode: stat.ino});
    }
  }
  const stat = await fs.lstat(absolute).catch(() => null);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) return null;
  const realPath = await fs.realpath(absolute).catch(() => null);
  if (!realPath) return null;
  return {path: absolute, realPath, device: stat.dev, inode: stat.ino, ancestors};
}

async function ensureLiteralDirectory(root: string, relative: string): Promise<boolean> {
  if (!safeRelative(relative)) return false;
  const identity = await captureRootIdentity(root);
  if (!identity) return false;
  let current = identity.path;
  for (const segment of relative.split("/")) {
    current = path.join(current, segment);
    const before = await fs.lstat(current).catch(() => null);
    if (before) {
      if (before.isSymbolicLink() || !before.isDirectory()) return false;
      continue;
    }
    const parent = path.dirname(current);
    const parentRelative = path.relative(identity.path, parent).split(path.sep).join("/");
    const beforeRoot = await captureRootIdentity(root);
    const beforeParent = await captureOwnedDirectoryChain(root, parentRelative);
    if (!beforeRoot || !beforeParent || !sameIdentity(beforeRoot, identity)) return false;
    let created: PortablePinAuthorityDirectoryIdentity | null = null;
    try {
      await fs.mkdir(current);
      const made = await fs.lstat(current).catch(() => null);
      if (made && !made.isSymbolicLink() && made.isDirectory()) created = {path: current, device: made.dev, inode: made.ino};
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") return false;
    }
    const afterRoot = await captureRootIdentity(root);
    const afterParent = await captureOwnedDirectoryChain(root, parentRelative);
    if (!afterRoot || !afterParent || !sameIdentity(afterRoot, beforeRoot) || !sameOwnedDirectoryChain(afterParent, beforeParent)) {
      if (created) {
        const currentMade = await fs.lstat(current).catch(() => null);
        if (currentMade && !currentMade.isSymbolicLink() && currentMade.isDirectory() && currentMade.dev === created.device && currentMade.ino === created.inode) {
          await fs.rmdir(current).catch(() => undefined);
        }
      }
      return false;
    }
    const after = await fs.lstat(current).catch(() => null);
    if (!after || after.isSymbolicLink() || !after.isDirectory()) return false;
  }
  return true;
}

async function captureOwnedDirectoryChain(root: string, relative: string): Promise<readonly PortablePinAuthorityDirectoryIdentity[] | null> {
  if (relative !== "" && !safeRelative(relative)) return null;
  const identity = await captureRootIdentity(root);
  if (!identity) return null;
  const chain: PortablePinAuthorityDirectoryIdentity[] = [{path: identity.path, device: identity.device, inode: identity.inode}];
  let current = identity.path;
  for (const segment of relative.split("/")) {
    current = path.join(current, segment);
    const stat = await fs.lstat(current).catch(() => null);
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) return null;
    chain.push({path: current, device: stat.dev, inode: stat.ino});
  }
  return chain;
}

function sameOwnedDirectoryChain(left: readonly PortablePinAuthorityDirectoryIdentity[] | null, right: readonly PortablePinAuthorityDirectoryIdentity[] | null): boolean {
  return Boolean(left && right && left.length === right.length && left.every((item, index) => {
    const other = right[index]!;
    return item.path === other.path && item.device === other.device && item.inode === other.inode;
  }));
}

function ownedLeafFromStat(stat: {readonly dev: number; readonly ino: number; readonly isFile: () => boolean; readonly isSymbolicLink: () => boolean}): OwnedLeafIdentity | null {
  return stat.isFile() && !stat.isSymbolicLink() ? {device: stat.dev, inode: stat.ino} : null;
}

async function ownedLeafFromHandle(handle: OpenHandle): Promise<OwnedLeafIdentity | null> {
  const stat = await handle.stat().catch(() => null);
  return stat ? ownedLeafFromStat(stat) : null;
}

/** Unlink only the exact regular leaf created by this call. */
async function unlinkOwnedLeaf(absolute: string, created: OwnedLeafIdentity | null): Promise<void> {
  if (!created) return;
  const current = await fs.lstat(absolute).catch(() => null);
  if (!current || current.isSymbolicLink() || !current.isFile() || current.dev !== created.device || current.ino !== created.inode) return;
  await fs.unlink(absolute).catch(() => undefined);
}

function canonicalPayload(receipt: Omit<PortablePinReceipt, "authentication">): string {
  return JSON.stringify({
    version: receipt.version,
    root: receipt.root,
    pin: receipt.pin,
    issuedAt: receipt.issuedAt
  });
}

function authentication(key: Uint8Array, receipt: Omit<PortablePinReceipt, "authentication">): string {
  return createHmac("sha256", key).update(canonicalPayload(receipt)).digest("hex");
}

function receiptId(receipt: Omit<PortablePinReceipt, "authentication">): string {
  return createHash("sha256").update(canonicalPayload(receipt)).digest("hex");
}

function receiptRelativePath(receipt: Omit<PortablePinReceipt, "authentication">): string {
  return `${PORTABLE_PIN_AUTHORITY_ROOT}/${PORTABLE_PIN_AUTHORITY_RECEIPTS_ROOT}/${receiptId(receipt)}.json`;
}

function freezeReceipt(receipt: PortablePinReceipt): PortablePinReceipt {
  const root = Object.freeze({
    path: receipt.root.path,
    realPath: receipt.root.realPath,
    device: receipt.root.device,
    inode: receipt.root.inode,
    ancestors: Object.freeze(receipt.root.ancestors.map(item => Object.freeze({path: item.path, device: item.device, inode: item.inode})))
  });
  const pin = Object.freeze({
    generationId: receipt.pin.generationId,
    entry: Object.freeze({path: receipt.pin.entry.path, sha256: receipt.pin.entry.sha256}),
    manifest: Object.freeze({path: receipt.pin.manifest.path, sha256: receipt.pin.manifest.sha256})
  });
  return Object.freeze({version: receipt.version, root, pin, issuedAt: receipt.issuedAt, authentication: receipt.authentication});
}

function validPin(pin: PortablePinAuthorityPin): boolean {
  return Boolean(pin && typeof pin === "object" && GENERATION_ID.test(pin.generationId) &&
    pin.entry?.path === `generations/${pin.generationId}/ENTRY.md` && SHA256.test(pin.entry?.sha256 ?? "") &&
    pin.manifest?.path === `generations/${pin.generationId}/manifest.json` && SHA256.test(pin.manifest?.sha256 ?? ""));
}

function validIdentity(value: unknown): value is PortablePinAuthorityRootIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.path !== "string" || typeof candidate.realPath !== "string" ||
      !Number.isSafeInteger(candidate.device) || !Number.isSafeInteger(candidate.inode) ||
      !Array.isArray(candidate.ancestors) || candidate.ancestors.length > 256) return false;
  return candidate.ancestors.every(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const ancestor = item as Record<string, unknown>;
    return typeof ancestor.path === "string" && Number.isSafeInteger(ancestor.device) && Number.isSafeInteger(ancestor.inode);
  });
}

function parseReceipt(value: unknown): PortablePinReceipt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== PORTABLE_PIN_RECEIPT_VERSION || !validIdentity(candidate.root) ||
      !validPin(candidate.pin as PortablePinAuthorityPin) || typeof candidate.issuedAt !== "string" ||
      !SHA256.test(typeof candidate.authentication === "string" ? candidate.authentication : "")) return null;
  const receipt = {
    version: PORTABLE_PIN_RECEIPT_VERSION,
    root: candidate.root as PortablePinAuthorityRootIdentity,
    pin: candidate.pin as PortablePinAuthorityPin,
    issuedAt: candidate.issuedAt,
    authentication: candidate.authentication as string
  } satisfies PortablePinReceipt;
  if (Number.isNaN(Date.parse(receipt.issuedAt))) return null;
  return freezeReceipt(receipt);
}

async function loadOwnerKey(
  root: string,
  provision: boolean,
  expectedIdentity?: PortablePinAuthorityRootIdentity
): Promise<{identity: PortablePinAuthorityRootIdentity; key: Uint8Array} | null> {
  const identity = await captureRootIdentity(root);
  if (!identity || expectedIdentity && !sameIdentity(identity, expectedIdentity)) return null;
  if (provision) {
    if (!(await ensureLiteralDirectory(root, PORTABLE_PIN_AUTHORITY_ROOT)) ||
        !(await ensureLiteralDirectory(root, `${PORTABLE_PIN_AUTHORITY_ROOT}/${PORTABLE_PIN_AUTHORITY_RECEIPTS_ROOT}`))) return null;
  }
  const authorityChain = await captureOwnedDirectoryChain(root, PORTABLE_PIN_AUTHORITY_ROOT);
  const receiptChain = await captureOwnedDirectoryChain(root, `${PORTABLE_PIN_AUTHORITY_ROOT}/${PORTABLE_PIN_AUTHORITY_RECEIPTS_ROOT}`);
  if (!authorityChain || !receiptChain) return null;
  const relative = `${PORTABLE_PIN_AUTHORITY_ROOT}/${PORTABLE_PIN_AUTHORITY_KEY_FILE}`;
  const absolute = path.join(identity.path, relative);
  const existing = await fs.lstat(absolute).catch(() => null);
  if (!existing) {
    if (!provision) return null;
    const beforeRoot = await captureRootIdentity(root);
    const beforeChain = await captureOwnedDirectoryChain(root, PORTABLE_PIN_AUTHORITY_ROOT);
    if (!beforeRoot || !beforeChain) return null;
    let created = false;
    let createdLeaf: OwnedLeafIdentity | null = null;
    try {
      const handle = await fs.open(absolute, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | (fsConstants.O_NOFOLLOW ?? 0), 0o600);
      created = true;
      try {
        createdLeaf = await ownedLeafFromHandle(handle);
        if (!createdLeaf) throw new Error("owner-key-opened-leaf-invalid");
        await handle.writeFile(randomBytes(KEY_BYTES));
      } finally { await handle.close(); }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        await unlinkOwnedLeaf(absolute, createdLeaf);
        return null;
      }
    }
    const afterRoot = await captureRootIdentity(root);
    const afterChain = await captureOwnedDirectoryChain(root, PORTABLE_PIN_AUTHORITY_ROOT);
    if (!afterRoot || !sameIdentity(afterRoot, beforeRoot) || !sameOwnedDirectoryChain(afterChain, beforeChain)) {
      if (created) await unlinkOwnedLeaf(absolute, createdLeaf);
      return null;
    }
  }
  const keyStat = await fs.lstat(absolute).catch(() => null);
  if (!keyStat || keyStat.isSymbolicLink() || !keyStat.isFile() || (keyStat.mode & 0o077) !== 0) return null;
  const read = await readHardenedLiteralFile(root, relative, KEY_BYTES);
  if (!read.ok || read.bytes.byteLength !== KEY_BYTES) return null;
  const afterReadRoot = await captureRootIdentity(root);
  const afterReadChain = await captureOwnedDirectoryChain(root, PORTABLE_PIN_AUTHORITY_ROOT);
  if (!afterReadRoot || !sameIdentity(afterReadRoot, identity) || !sameOwnedDirectoryChain(afterReadChain, authorityChain)) return null;
  return {identity, key: read.bytes};
}

/** Capture the canonical repository identity before a publication proof. */
export async function capturePortablePinAuthorityRoot(root: string): Promise<PortablePinAuthorityRootIdentity | null> {
  return captureRootIdentity(root);
}

/** Create and persist an owner-authenticated receipt after the resolver has proved the pin. */
export async function persistPortablePinReceipt(root: string, pin: PortablePinAuthorityPin, expectedIdentity?: PortablePinAuthorityRootIdentity): Promise<PortablePinReceipt | null> {
  if (!validPin(pin)) return null;
  const owner = await loadOwnerKey(root, true, expectedIdentity);
  if (!owner) return null;
  const unsigned = {
    version: PORTABLE_PIN_RECEIPT_VERSION,
    root: owner.identity,
    pin: {
      generationId: pin.generationId,
      entry: {path: pin.entry.path, sha256: pin.entry.sha256},
      manifest: {path: pin.manifest.path, sha256: pin.manifest.sha256}
    },
    issuedAt: new Date().toISOString()
  } satisfies Omit<PortablePinReceipt, "authentication">;
  const receipt = freezeReceipt({...unsigned, authentication: authentication(owner.key, unsigned)} satisfies PortablePinReceipt);
  const relative = receiptRelativePath(unsigned);
  const absolute = path.join(owner.identity.path, relative);
  const bytes = Buffer.from(`${JSON.stringify(receipt)}\n`, "utf8");
  const beforeRoot = await captureRootIdentity(root);
  const beforeChain = await captureOwnedDirectoryChain(root, `${PORTABLE_PIN_AUTHORITY_ROOT}/${PORTABLE_PIN_AUTHORITY_RECEIPTS_ROOT}`);
  if (!beforeRoot || !sameIdentity(beforeRoot, owner.identity) || !beforeChain) return null;
  let created = false;
  let createdLeaf: OwnedLeafIdentity | null = null;
  try {
    const handle = await fs.open(absolute, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | (fsConstants.O_NOFOLLOW ?? 0), 0o600);
    created = true;
    try {
      createdLeaf = await ownedLeafFromHandle(handle);
      if (!createdLeaf) throw new Error("receipt-opened-leaf-invalid");
      await handle.writeFile(bytes);
    } finally { await handle.close(); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      await unlinkOwnedLeaf(absolute, createdLeaf);
      return null;
    }
  }
  const afterRoot = await captureRootIdentity(root);
  const afterChain = await captureOwnedDirectoryChain(root, `${PORTABLE_PIN_AUTHORITY_ROOT}/${PORTABLE_PIN_AUTHORITY_RECEIPTS_ROOT}`);
  if (!afterRoot || !sameIdentity(afterRoot, owner.identity) || !sameOwnedDirectoryChain(afterChain, beforeChain)) {
    if (created) await unlinkOwnedLeaf(absolute, createdLeaf);
    return null;
  }
  const persisted = await readHardenedLiteralFile(root, relative, 16 * 1024);
  if (!persisted.ok) {
    if (created) await unlinkOwnedLeaf(absolute, createdLeaf);
    return null;
  }
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(persisted.bytes)); } catch {
    if (created) await unlinkOwnedLeaf(absolute, createdLeaf);
    return null;
  }
  const stored = parseReceipt(parsed);
  if (!stored || JSON.stringify(stored) !== JSON.stringify(receipt)) {
    if (created) await unlinkOwnedLeaf(absolute, createdLeaf);
    return null;
  }
  return stored;
}

/** Restore only an authentic receipt persisted by this repository's owner key. */
export async function restorePortablePinReceipt(root: string, value: unknown): Promise<PortablePinReceipt | null> {
  const receipt = parseReceipt(value);
  if (!receipt) return null;
  const owner = await loadOwnerKey(root, false);
  if (!owner || !sameIdentity(owner.identity, receipt.root)) return null;
  const expected = authentication(owner.key, {
    version: receipt.version,
    root: receipt.root,
    pin: receipt.pin,
    issuedAt: receipt.issuedAt
  });
  const expectedBytes = Buffer.from(expected, "utf8");
  const actualBytes = Buffer.from(receipt.authentication, "utf8");
  if (expectedBytes.length !== actualBytes.length || !timingSafeEqual(expectedBytes, actualBytes)) return null;
  const storedRelative = receiptRelativePath({version: receipt.version, root: receipt.root, pin: receipt.pin, issuedAt: receipt.issuedAt});
  const stored = await readHardenedLiteralFile(root, storedRelative, 16 * 1024);
  if (!stored.ok) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(stored.bytes)); } catch { return null; }
  const storedReceipt = parseReceipt(parsed);
  if (!storedReceipt || JSON.stringify(storedReceipt) !== JSON.stringify(receipt)) return null;
  return receipt;
}
