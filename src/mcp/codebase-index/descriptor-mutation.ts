import {createHash, randomBytes} from "node:crypto";
import {spawn} from "node:child_process";
import {constants as fsConstants} from "node:fs";
import {promises as fs} from "node:fs";
import path from "node:path";

type DirectoryIdentity = {readonly device: number; readonly inode: number};
type DirectoryHandle = Awaited<ReturnType<typeof fs.open>>;

export type DescriptorMutationHooks = {
  readonly beforeWrite?: () => Promise<void> | void;
  /** Runs after the parent descriptor is held and before creating a leaf. */
  readonly beforeCreate?: () => Promise<void> | void;
  readonly afterTempCreate?: () => Promise<void> | void;
};

export type DescriptorWriteExpectation = {
  readonly device?: number;
  readonly inode?: number;
  readonly sha256?: string;
};

function safeLeaf(value: string): boolean {
  return value.length > 0 && value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\") && !/[\0-\x1f\x7f]/.test(value);
}

function safeRelative(value: string): boolean {
  return value.length > 0 && !value.startsWith("/") && !value.includes("\\") && !/[\0-\x1f\x7f]/.test(value) && value.split("/").every(safeLeaf);
}

function directoryFlags(): number | null {
  const noFollow = fsConstants.O_NOFOLLOW;
  const directory = fsConstants.O_DIRECTORY;
  return typeof noFollow === "number" && typeof directory === "number"
    ? fsConstants.O_RDONLY | noFollow | directory
    : null;
}

async function openVerifiedDirectory(absolute: string, expected?: DirectoryIdentity): Promise<DirectoryHandle | null> {
  const flags = directoryFlags();
  if (flags === null) return null;
  if (!(await literalDirectoryPath(absolute))) return null;
  const before = await fs.lstat(absolute).catch(() => null);
  if (!before || before.isSymbolicLink() || !before.isDirectory()) return null;
  if (expected && (before.dev !== expected.device || before.ino !== expected.inode)) return null;
  const handle = await fs.open(absolute, flags).catch(() => null);
  if (!handle) return null;
  const opened = await handle.stat().catch(() => null);
  if (!opened || !opened.isDirectory() || opened.isSymbolicLink() || opened.dev !== before.dev || opened.ino !== before.ino) {
    await handle.close().catch(() => undefined);
    return null;
  }
  return handle;
}

/** Verify each lexical ancestor before using it only to obtain a descriptor. */
async function literalDirectoryPath(absolute: string): Promise<boolean> {
  const resolved = path.resolve(absolute);
  const parsed = path.parse(resolved);
  let current = parsed.root;
  const root = await fs.lstat(current).catch(() => null);
  if (!root || root.isSymbolicLink() || !root.isDirectory()) return false;
  for (const segment of resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = await fs.lstat(current).catch(() => null);
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) return false;
  }
  return true;
}

type HeldRoot = {readonly path: string; readonly handle: DirectoryHandle};

/**
 * Pin the caller's root identity before resolving an outer alias, then descend
 * from the filesystem root through held descriptors. A realpath result alone
 * is not an authority: an ancestor may have been exchanged while resolving it.
 */
async function openCanonicalLiteralRoot(root: string): Promise<HeldRoot | null> {
  const absolute = path.resolve(root);
  const direct = await fs.lstat(absolute).catch(() => null);
  if (!direct || direct.isSymbolicLink() || !direct.isDirectory()) return null;
  const canonical = await fs.realpath(absolute).catch(() => null);
  if (!canonical) return null;
  const parsed = path.parse(canonical);
  const segments = canonical.slice(parsed.root.length).split(path.sep).filter(Boolean).join("/");
  if (process.platform !== "linux") {
    const filesystemRoot = await openVerifiedDirectory(parsed.root);
    if (!filesystemRoot) return null;
    try {
      const verified = await descriptorChild(parsed.root, filesystemRoot, "verify-directory", "root", {parentRelative: segments});
      if (!verified.ok || verified.device !== direct.dev || verified.inode !== direct.ino) return null;
    } finally {
      await filesystemRoot.close().catch(() => undefined);
    }
    const handle = await openVerifiedDirectory(canonical, {device: direct.dev, inode: direct.ino});
    return handle ? {path: canonical, handle} : null;
  }
  let currentPath = parsed.root;
  let current = await openVerifiedDirectory(currentPath);
  if (!current) return null;
  let transferred = false;
  try {
    for (const segment of segments === "" ? [] : segments.split("/")) {
      const next = await openAnchoredChild(current, currentPath, segment);
      if (!next) return null;
      await current.close().catch(() => undefined);
      current = next;
      currentPath = path.join(currentPath, segment);
    }
    const identity = await handleIdentity(current);
    if (!identity || identity.device !== direct.dev || identity.inode !== direct.ino) return null;
    transferred = true;
    return {path: currentPath, handle: current};
  } catch {
    return null;
  } finally {
    // Ownership transfers only on the successful return above.
    if (!transferred) await current.close().catch(() => undefined);
  }
}

async function handleIdentity(handle: DirectoryHandle): Promise<DirectoryIdentity | null> {
  const stat = await handle.stat().catch(() => null);
  return stat && stat.isDirectory() && !stat.isSymbolicLink() ? {device: stat.dev, inode: stat.ino} : null;
}

async function directoryPathStillMatches(absolute: string, handle: DirectoryHandle): Promise<boolean> {
  const held = await handleIdentity(handle);
  const current = await fs.lstat(absolute).catch(() => null);
  return Boolean(held && current && current.isDirectory() && !current.isSymbolicLink() && current.dev === held.device && current.ino === held.inode);
}

/**
 * This child only receives a trusted directory descriptor at fd 3. It never
 * receives a filesystem path for mutation: cwd is checked against that fd
 * before every effect and every leaf is a single validated filename.
 */
const DESCRIPTOR_CHILD = String.raw`
"use strict";
const fs = require("node:fs");
const crypto = require("node:crypto");
const [action, leaf, expectedDevRaw, expectedInoRaw, modeRaw, overwriteRaw, expectedLeafDevRaw, expectedLeafInoRaw, expectedHash, preserveModeRaw, parentRelative] = process.argv.slice(1);
const expectedDev = Number(expectedDevRaw), expectedIno = Number(expectedInoRaw), mode = Number(modeRaw);
const expectedLeafDev = expectedLeafDevRaw === "" ? null : Number(expectedLeafDevRaw), expectedLeafIno = expectedLeafInoRaw === "" ? null : Number(expectedLeafInoRaw);
const noFollow = fs.constants.O_NOFOLLOW, directory = fs.constants.O_DIRECTORY;
const safeLeaf = value => typeof value === "string" && value.length > 0 && value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\") && !/[\0-\x1f\x7f]/.test(value);
const safeRelative = value => value === "" || typeof value === "string" && !value.startsWith("/") && !value.includes("\\") && !/[\0-\x1f\x7f]/.test(value) && value.split("/").every(safeLeaf);
const report = value => process.stdout.write(JSON.stringify(value));
const fail = value => { report(value); process.exitCode = 2; };
const same = (stat, dev, ino) => stat && stat.dev === dev && stat.ino === ino;
const safeDirectory = stat => stat && stat.isDirectory() && !stat.isSymbolicLink();
const safeFile = stat => stat && stat.isFile() && !stat.isSymbolicLink();
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const parentIdentity = () => { const stat = fs.statSync("."); return {parentDevice:stat.dev, parentInode:stat.ino}; };
function checkParent() {
  if (typeof noFollow !== "number" || typeof directory !== "number" || !safeLeaf(leaf)) throw new Error("invalid");
  const held = fs.fstatSync(3), cwd = fs.statSync(".");
  if (!safeDirectory(held) || !safeDirectory(cwd) || !same(held, expectedDev, expectedIno) || !same(cwd, expectedDev, expectedIno)) throw new Error("unsafe");
}
function optionalTarget() {
  try { return fs.lstatSync(leaf); } catch (error) { if (error && error.code === "ENOENT") return null; throw error; }
}
function optionalEntry(name) {
  try { return fs.lstatSync(name); } catch (error) { if (error && error.code === "ENOENT") return null; throw error; }
}
function descendVerified(relative) {
  if (!safeRelative(relative)) throw new Error("invalid");
  for (const segment of relative === "" ? [] : relative.split("/")) {
    const target = optionalEntry(segment);
    if (!safeDirectory(target)) throw new Error("unsafe");
    process.chdir(segment);
    const current = fs.statSync(".");
    if (!safeDirectory(current) || !same(current, target.dev, target.ino)) throw new Error("unsafe");
  }
}
function ensureDescended(relative) {
  if (!safeRelative(relative)) throw new Error("invalid");
  for (const segment of relative === "" ? [] : relative.split("/")) {
    let target = optionalEntry(segment);
    if (target === null) {
      try { fs.mkdirSync(segment, {mode:0o700}); } catch (error) { if (!error || error.code !== "EEXIST") throw error; }
      target = optionalEntry(segment);
    }
    if (!safeDirectory(target)) throw new Error("unsafe");
    process.chdir(segment);
    const current = fs.statSync(".");
    if (!safeDirectory(current) || !same(current, target.dev, target.ino)) throw new Error("unsafe");
  }
}
function verifyExpected(target) {
  if (expectedLeafDev === null && expectedLeafIno === null && !expectedHash) return true;
  if (!safeFile(target)) return false;
  if ((expectedLeafDev !== null && target.dev !== expectedLeafDev) || (expectedLeafIno !== null && target.ino !== expectedLeafIno)) return false;
  const fd = fs.openSync(leaf, fs.constants.O_RDONLY | noFollow);
  try {
    const opened = fs.fstatSync(fd);
    if (!safeFile(opened) || !same(opened, target.dev, target.ino)) return false;
    if (!expectedHash) return true;
    const actual = digest(fs.readFileSync(fd));
    return actual === expectedHash;
  } finally { fs.closeSync(fd); }
}
async function bytesFromStdin() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.from(chunk); size += bytes.length;
    if (size > 64 * 1024 * 1024) throw new Error("too-large");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}
function waitForContinue() {
  return new Promise(resolve => process.once("message", message => resolve(Boolean(message && message.continue))));
}
async function main() {
  let mutationParent = false;
  try {
    checkParent();
    if (action === "ensure-directory-path") {
      ensureDescended(parentRelative);
      const target = fs.statSync(".");
      report({ok:true, device:target.dev, inode:target.ino}); return;
    }
    if (action === "verify-directory") {
      descendVerified(parentRelative);
      const target = fs.statSync(".");
      report({ok:true, device:target.dev, inode:target.ino}); return;
    }
    descendVerified(parentRelative);
    mutationParent = true;
    if (action === "ensure-directory") {
      let target = optionalTarget();
      if (target === null) {
        try { fs.mkdirSync(leaf, {mode:0o700}); } catch (error) { if (!error || error.code !== "EEXIST") throw error; }
        target = optionalTarget();
      }
      if (!safeDirectory(target)) throw new Error("unsafe");
      report({ok:true, device:target.dev, inode:target.ino}); return;
    }
    if (action === "inspect-directory") {
      const target = optionalTarget();
      if (!safeDirectory(target)) throw new Error("unsafe");
      report({ok:true, device:target.dev, inode:target.ino}); return;
    }
    if (action === "create-exclusive") {
      const bytes = await bytesFromStdin();
      let fd, owned = null;
      try { fd = fs.openSync(leaf, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | noFollow, mode); }
      catch (error) { if (error && error.code === "EEXIST") { report({ok:true, created:false, ...parentIdentity()}); return; } throw error; }
      try { const stat = fs.fstatSync(fd); if (!safeFile(stat)) throw new Error("unsafe"); owned = {dev:stat.dev, ino:stat.ino}; fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); }
      catch (error) {
        try { fs.closeSync(fd); } catch {}
        try { const current = optionalTarget(); if (owned && safeFile(current) && same(current, owned.dev, owned.ino)) fs.unlinkSync(leaf); } catch {}
        throw error;
      }
      fs.closeSync(fd);
      const after = optionalTarget();
      if (!safeFile(after)) throw new Error("unsafe");
      report({ok:true, created:true, device:after.dev, inode:after.ino, ...parentIdentity()}); return;
    }
    if (action === "unlink-expected") {
      const before = optionalTarget();
      if (!verifyExpected(before)) throw new Error("conflict");
      fs.unlinkSync(leaf);
      if (optionalTarget() !== null) throw new Error("integrity");
      report({ok:true, ...parentIdentity()}); return;
    }
    if (action !== "atomic-write") throw new Error("invalid");
    const before = optionalTarget();
    if (before !== null && !safeFile(before)) throw new Error("unsafe");
    if ((expectedLeafDev !== null || expectedLeafIno !== null || expectedHash) && !verifyExpected(before)) throw new Error("conflict");
    if (before !== null && overwriteRaw !== "true") throw new Error("exists");
    const bytes = await bytesFromStdin();
    const temporary = "." + leaf + ".blueprint-tmp-" + process.pid + "-" + crypto.randomBytes(12).toString("hex");
    let temporaryCreated = false, temporaryIdentity = null;
    try {
      const fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | noFollow, mode);
      temporaryCreated = true;
      try { const stat = fs.fstatSync(fd); if (!safeFile(stat)) throw new Error("unsafe"); temporaryIdentity = {dev:stat.dev, ino:stat.ino}; if (preserveModeRaw === "true") fs.fchmodSync(fd, mode); fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
      if (!safeFile(fs.lstatSync(temporary))) throw new Error("unsafe");
      if (process.send) { process.send({stage:"temp"}); if (!(await waitForContinue())) throw new Error("interrupted"); }
      const currentTemporary = fs.lstatSync(temporary);
      if (!temporaryIdentity || !safeFile(currentTemporary) || !same(currentTemporary, temporaryIdentity.dev, temporaryIdentity.ino)) throw new Error("unsafe");
      const current = optionalTarget();
      if (before === null ? current !== null : !safeFile(current) || !same(current, before.dev, before.ino)) throw new Error("conflict");
      if ((expectedLeafDev !== null || expectedLeafIno !== null || expectedHash) && !verifyExpected(current)) throw new Error("conflict");
      if (overwriteRaw === "true") fs.renameSync(temporary, leaf);
      else { fs.linkSync(temporary, leaf); fs.unlinkSync(temporary); }
      temporaryCreated = false;
      const after = optionalTarget();
      if (!safeFile(after) || digest(fs.readFileSync(leaf)) !== digest(bytes)) throw new Error("integrity");
      report({ok:true, created:before === null, ...parentIdentity()});
    } finally { if (temporaryCreated && temporaryIdentity) { try { const current = fs.lstatSync(temporary); if (safeFile(current) && same(current, temporaryIdentity.dev, temporaryIdentity.ino)) fs.unlinkSync(temporary); } catch {} } }
  } catch (error) {
    const result = {ok:false, code:error && error.message === "conflict" ? "conflict" : error && error.message === "exists" ? "exists" : error && error.message === "invalid" ? "invalid" : error && error.message === "interrupted" ? "interrupted" : "unsafe"};
    if (mutationParent) { try { Object.assign(result, parentIdentity()); } catch {} }
    fail(result);
  }
}
main();`;

type ChildResult = {
  readonly ok: boolean;
  readonly code?: string;
  readonly created?: boolean;
  readonly device?: number;
  readonly inode?: number;
  readonly parentDevice?: number;
  readonly parentInode?: number;
};

async function descriptorChild(
  parentPath: string,
  parent: DirectoryHandle,
  action: "ensure-directory" | "ensure-directory-path" | "inspect-directory" | "verify-directory" | "create-exclusive" | "atomic-write" | "unlink-expected",
  leaf: string,
  options: {
    readonly mode?: number;
    readonly overwrite?: boolean;
    readonly preserveMode?: boolean;
    readonly expected?: DescriptorWriteExpectation;
    readonly bytes?: Uint8Array;
    readonly parentRelative?: string;
    readonly afterTempCreate?: () => Promise<void> | void;
  }
): Promise<ChildResult> {
  const identity = await handleIdentity(parent);
  const parentRelative = options.parentRelative ?? "";
  if (!identity || !safeLeaf(leaf) || (parentRelative !== "" && !safeRelative(parentRelative))) return {ok: false, code: "unsafe"};
  const args = ["--no-warnings", "-e", DESCRIPTOR_CHILD, action, leaf, String(identity.device), String(identity.inode), String(options.mode ?? 0o600), String(options.overwrite === true), options.expected?.device === undefined ? "" : String(options.expected.device), options.expected?.inode === undefined ? "" : String(options.expected.inode), options.expected?.sha256 ?? "", String(options.preserveMode === true), parentRelative];
  return new Promise(resolve => {
    let output = "";
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    let graceTimer: NodeJS.Timeout | undefined;
    let forced: ChildResult | undefined;
    const finish = (value: ChildResult) => {
      if (!settled) {
        settled = true;
        if (timer) clearTimeout(timer);
        if (graceTimer) clearTimeout(graceTimer);
        resolve(value);
      }
    };
    let child;
    try {
      child = spawn(process.execPath, args, {
        cwd: parentPath,
        env: {PATH: process.env.PATH ?? "/usr/bin:/bin", LANG: "C"},
        stdio: ["pipe", "pipe", "ignore", parent.fd, "ipc"]
      });
    } catch { finish({ok: false, code: "unsafe"}); return; }
    const stopAfterReap = () => {
      if (settled || forced) return;
      forced = {ok: false, code: "unsafe"};
      try { child.kill("SIGTERM"); } catch { /* close still reaps an already-exited child */ }
      graceTimer = setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* child already exited */ } }, 1_000);
    };
    child.stdout!.on("data", chunk => { if (output.length <= 2048) output += String(chunk).slice(0, 2049 - output.length); });
    child.stdin!.on("error", () => undefined);
    child.on("message", async message => {
      if ((message as {stage?: unknown})?.stage !== "temp") return;
      try {
        await options.afterTempCreate?.();
        if (settled || forced || !child.connected) { stopAfterReap(); return; }
        child.send({continue: true}, (error: Error | null) => { if (error) stopAfterReap(); });
      } catch { stopAfterReap(); }
    });
    child.on("error", () => stopAfterReap());
    child.on("close", () => {
      if (forced) { finish(forced); return; }
      try {
        const value = JSON.parse(output) as ChildResult;
        finish(value && typeof value.ok === "boolean" ? value : {ok: false, code: "unsafe"});
      } catch { finish({ok: false, code: "unsafe"}); }
    });
    timer = setTimeout(stopAfterReap, 30_000);
    if (options.bytes) child.stdin!.end(options.bytes);
    else child.stdin!.end();
  });
}

async function openLiteralDirectory(root: string, relative: string): Promise<{handle: DirectoryHandle; path: string} | null> {
  if (relative !== "" && !safeRelative(relative)) return null;
  const heldRoot = await openCanonicalLiteralRoot(root);
  if (!heldRoot) return null;
  let currentPath = heldRoot.path;
  let current = heldRoot.handle;
  for (const segment of relative === "" ? [] : relative.split("/")) {
    const next = await openAnchoredChild(current, currentPath, segment);
    if (!next) { await current.close().catch(() => undefined); return null; }
    await current.close().catch(() => undefined);
    current = next;
    currentPath = path.join(currentPath, segment);
  }
  return {handle: current, path: currentPath};
}

type MutationParent = {readonly handle: DirectoryHandle; readonly path: string; readonly parentRelative: string};

async function openMutationParent(root: string, parentRelative: string): Promise<MutationParent | null> {
  if (parentRelative !== "" && !safeRelative(parentRelative)) return null;
  if (process.platform === "linux") {
    const parent = await openLiteralDirectory(root, parentRelative);
    return parent ? {...parent, parentRelative: ""} : null;
  }
  const heldRoot = await openCanonicalLiteralRoot(root);
  return heldRoot ? {...heldRoot, parentRelative} : null;
}

async function mutationParentStillMatches(parent: MutationParent, result: ChildResult): Promise<boolean> {
  if (process.platform === "linux") return directoryPathStillMatches(parent.path, parent.handle);
  if (!Number.isSafeInteger(result.parentDevice) || !Number.isSafeInteger(result.parentInode)) return false;
  const current = await fs.lstat(parent.parentRelative === "" ? parent.path : path.join(parent.path, parent.parentRelative)).catch(() => null);
  return Boolean(current && current.isDirectory() && !current.isSymbolicLink() &&
    current.dev === result.parentDevice && current.ino === result.parentInode &&
    await directoryPathStillMatches(parent.path, parent.handle));
}

async function inspectAnchoredChild(parent: DirectoryHandle, parentPath: string, leaf: string): Promise<DirectoryIdentity | null> {
  if (!safeLeaf(leaf)) return null;
  if (process.platform === "linux") {
    const stat = await fs.lstat(`/proc/self/fd/${parent.fd}/${leaf}`).catch(() => null);
    return stat && stat.isDirectory() && !stat.isSymbolicLink() ? {device: stat.dev, inode: stat.ino} : null;
  }
  const result = await descriptorChild(parentPath, parent, "inspect-directory", leaf, {});
  return result.ok && Number.isSafeInteger(result.device) && Number.isSafeInteger(result.inode)
    ? {device: result.device!, inode: result.inode!}
    : null;
}

/** Inspect relative to the held descriptor before any lexical open. */
async function openAnchoredChild(parent: DirectoryHandle, parentPath: string, leaf: string): Promise<DirectoryHandle | null> {
  const expected = await inspectAnchoredChild(parent, parentPath, leaf);
  return expected ? openVerifiedDirectory(path.join(parentPath, leaf), expected) : null;
}

/** Create each literal segment through an anchored descriptor child. */
export async function ensureDescriptorDirectory(root: string, relative: string): Promise<boolean> {
  if (!safeRelative(relative)) return false;
  const heldRoot = await openCanonicalLiteralRoot(root);
  if (!heldRoot) return false;
  if (process.platform !== "linux") {
    try {
      const result = await descriptorChild(heldRoot.path, heldRoot.handle, "ensure-directory-path", "root", {parentRelative: relative});
      return result.ok && await directoryPathStillMatches(heldRoot.path, heldRoot.handle);
    } finally {
      await heldRoot.handle.close().catch(() => undefined);
    }
  }
  let currentPath = heldRoot.path;
  let current = heldRoot.handle;
  try {
    for (const segment of relative.split("/")) {
      const existing = await openAnchoredChild(current, currentPath, segment);
      let next = existing;
      if (!next) {
        const created = process.platform === "linux"
          ? await linuxEnsureDirectory(current, segment)
          : await descriptorChild(currentPath, current, "ensure-directory", segment, {});
        if (!created.ok || !Number.isSafeInteger(created.device) || !Number.isSafeInteger(created.inode)) return false;
        next = await openVerifiedDirectory(path.join(currentPath, segment), {device: created.device!, inode: created.inode!});
      }
      if (!next) return false;
      await current.close().catch(() => undefined);
      current = next;
      currentPath = path.join(currentPath, segment);
    }
    return await directoryPathStillMatches(currentPath, current);
  } finally { await current.close().catch(() => undefined); }
}

async function linuxEnsureDirectory(parent: DirectoryHandle, leaf: string): Promise<ChildResult> {
  if (!safeLeaf(leaf)) return {ok: false};
  const target = `/proc/self/fd/${parent.fd}/${leaf}`;
  try {
    const before = await fs.lstat(target).catch(error => (error as NodeJS.ErrnoException).code === "ENOENT" ? null : Promise.reject(error));
    if (!before) await fs.mkdir(target, {mode: 0o700}).catch(error => { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; });
    const after = await fs.lstat(target);
    return after.isDirectory() && !after.isSymbolicLink() ? {ok: true, device: after.dev, inode: after.ino} : {ok: false};
  } catch { return {ok: false}; }
}

export async function createDescriptorLeaf(
  root: string,
  relative: string,
  bytes: Uint8Array,
  mode = 0o600,
  hooks?: Pick<DescriptorMutationHooks, "beforeCreate">
): Promise<"created" | "exists" | "unsafe"> {
  if (!safeRelative(relative)) return "unsafe";
  const parentRelative = path.posix.dirname(relative) === "." ? "" : path.posix.dirname(relative);
  const parent = await openMutationParent(root, parentRelative);
  if (!parent) return "unsafe";
  try {
    await hooks?.beforeCreate?.();
    if (!(await directoryPathStillMatches(parent.path, parent.handle))) return "unsafe";
    const result = process.platform === "linux"
      ? await linuxCreate(parent.handle, path.posix.basename(relative), bytes, mode)
      : await descriptorChild(parent.path, parent.handle, "create-exclusive", path.posix.basename(relative), {bytes, mode, parentRelative: parent.parentRelative});
    if (!(await mutationParentStillMatches(parent, result))) return "unsafe";
    return result.ok ? result.created ? "created" : "exists" : "unsafe";
  } finally { await parent.handle.close().catch(() => undefined); }
}

async function linuxCreate(parent: DirectoryHandle, leaf: string, bytes: Uint8Array, mode: number): Promise<ChildResult> {
  const noFollow = fsConstants.O_NOFOLLOW;
  if (typeof noFollow !== "number" || !safeLeaf(leaf)) return {ok: false};
  const target = `/proc/self/fd/${parent.fd}/${leaf}`;
  let handle: Awaited<ReturnType<typeof fs.open>> | null = null;
  let owned: DirectoryIdentity | null = null;
  let complete = false;
  try {
    handle = await fs.open(target, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | noFollow, mode);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.isSymbolicLink()) return {ok: false};
    owned = {device: stat.dev, inode: stat.ino};
    await handle.writeFile(bytes); await handle.sync();
    complete = true;
    return {ok: true, created: true};
  } catch (error) { return (error as NodeJS.ErrnoException).code === "EEXIST" ? {ok: true, created: false} : {ok: false}; }
  finally {
    await handle?.close().catch(() => undefined);
    if (!complete && owned) {
      const current = await fs.lstat(target).catch(() => null);
      if (current && current.isFile() && !current.isSymbolicLink() && current.dev === owned.device && current.ino === owned.inode) await fs.unlink(target).catch(() => undefined);
    }
  }
}

/** Remove only a descriptor-relative regular leaf whose current bytes match. */
export async function unlinkDescriptorLeaf(
  root: string,
  relative: string,
  expected: Pick<DescriptorWriteExpectation, "sha256">
): Promise<"removed" | "conflict" | "unsafe"> {
  if (!safeRelative(relative) || !expected.sha256) return "unsafe";
  const parentRelative = path.posix.dirname(relative) === "." ? "" : path.posix.dirname(relative);
  const parent = await openMutationParent(root, parentRelative);
  if (!parent) return "unsafe";
  try {
    const leaf = path.posix.basename(relative);
    const result = process.platform === "linux"
      ? await linuxUnlink(parent.handle, leaf, expected.sha256)
      : await descriptorChild(parent.path, parent.handle, "unlink-expected", leaf, {expected, parentRelative: parent.parentRelative});
    if (!(await mutationParentStillMatches(parent, result))) return "unsafe";
    return result.ok ? "removed" : result.code === "conflict" || result.code === "exists" ? "conflict" : "unsafe";
  } finally {
    await parent.handle.close().catch(() => undefined);
  }
}

async function linuxUnlink(parent: DirectoryHandle, leaf: string, expectedHash: string): Promise<ChildResult> {
  const noFollow = fsConstants.O_NOFOLLOW;
  if (typeof noFollow !== "number" || !safeLeaf(leaf)) return {ok: false};
  const target = `/proc/self/fd/${parent.fd}/${leaf}`;
  try {
    const before = await fs.lstat(target);
    if (!before.isFile() || before.isSymbolicLink()) return {ok: false};
    const handle = await fs.open(target, fsConstants.O_RDONLY | noFollow);
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.isSymbolicLink() || opened.dev !== before.dev || opened.ino !== before.ino ||
          createHashBytes(await handle.readFile()) !== expectedHash) return {ok: false, code: "conflict"};
    } finally { await handle.close().catch(() => undefined); }
    await fs.unlink(target);
    const after = await fs.lstat(target).catch(error => (error as NodeJS.ErrnoException).code === "ENOENT" ? null : Promise.reject(error));
    return after === null ? {ok: true} : {ok: false};
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT" ? {ok: false, code: "conflict"} : {ok: false};
  }
}

/**
 * Atomic descriptor-relative writer. New leaves use link+unlink, never
 * rename-overwrite. Existing replacements are cooperative-lock CAS: an
 * external process that ignores the caller's lock can exchange the pathname
 * after validation, although it cannot redirect through an ancestor.
 */
export async function atomicDescriptorWrite(input: {
  readonly root: string;
  readonly relative: string;
  readonly bytes: Uint8Array;
  readonly overwrite: boolean;
  readonly mode?: number;
  /** Preserve an existing target's explicit mode after the temp-file rename. */
  readonly preserveMode?: boolean;
  readonly expected?: DescriptorWriteExpectation;
  readonly hooks?: DescriptorMutationHooks;
}): Promise<"written" | "conflict" | "unsafe"> {
  if (!safeRelative(input.relative)) return "unsafe";
  const parentRelative = path.posix.dirname(input.relative) === "." ? "" : path.posix.dirname(input.relative);
  const parent = await openMutationParent(input.root, parentRelative);
  if (!parent) return "unsafe";
  try {
    await input.hooks?.beforeWrite?.();
    if (!(await directoryPathStillMatches(parent.path, parent.handle))) return "unsafe";
    const leaf = path.posix.basename(input.relative);
    const result = process.platform === "linux"
      ? await linuxAtomic(parent.handle, leaf, input.bytes, input.overwrite, input.mode ?? 0o666, input.preserveMode === true, input.expected, input.hooks?.afterTempCreate)
      : await descriptorChild(parent.path, parent.handle, "atomic-write", leaf, {bytes: input.bytes, overwrite: input.overwrite, mode: input.mode ?? 0o666, preserveMode: input.preserveMode, expected: input.expected, parentRelative: parent.parentRelative, afterTempCreate: input.hooks?.afterTempCreate});
    if (!(await mutationParentStillMatches(parent, result))) return "unsafe";
    return result.ok ? "written" : result.code === "conflict" || result.code === "exists" ? "conflict" : "unsafe";
  } finally { await parent.handle.close().catch(() => undefined); }
}

async function linuxAtomic(parent: DirectoryHandle, leaf: string, bytes: Uint8Array, overwrite: boolean, mode: number, preserveMode: boolean, expected?: DescriptorWriteExpectation, afterTempCreate?: () => Promise<void> | void): Promise<ChildResult> {
  const noFollow = fsConstants.O_NOFOLLOW;
  if (typeof noFollow !== "number" || !safeLeaf(leaf)) return {ok: false};
  const anchored = (name: string) => `/proc/self/fd/${parent.fd}/${name}`;
  const target = anchored(leaf);
  const previous = await fs.lstat(target).catch(error => (error as NodeJS.ErrnoException).code === "ENOENT" ? null : Promise.reject(error));
  if (previous && (previous.isSymbolicLink() || !previous.isFile())) return {ok: false};
  if (expected && (!previous ||
      (expected.device !== undefined && previous.dev !== expected.device) ||
      (expected.inode !== undefined && previous.ino !== expected.inode) ||
      (expected.sha256 !== undefined && createHashBytes(await fs.readFile(target)) !== expected.sha256))) return {ok: false, code: "conflict"};
  if (previous && !overwrite) return {ok: false, code: "exists"};
  const temporary = `.${leaf}.blueprint-tmp-${process.pid}-${randomBytes(12).toString("hex")}`;
  const temp = anchored(temporary);
  let created = false;
  let owned: DirectoryIdentity | null = null;
  try {
    const handle = await fs.open(temp, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | noFollow, mode);
    created = true;
    try { const stat = await handle.stat(); if (!stat.isFile() || stat.isSymbolicLink()) return {ok: false}; owned = {device: stat.dev, inode: stat.ino}; if (preserveMode) await handle.chmod(mode); await handle.writeFile(bytes); await handle.sync(); }
    finally { await handle.close().catch(() => undefined); }
    await afterTempCreate?.();
    const currentTemp = await fs.lstat(temp);
    if (!owned || !currentTemp.isFile() || currentTemp.isSymbolicLink() || currentTemp.dev !== owned.device || currentTemp.ino !== owned.inode) return {ok: false};
    const current = await fs.lstat(target).catch(error => (error as NodeJS.ErrnoException).code === "ENOENT" ? null : Promise.reject(error));
    if (previous === null ? current !== null : !current || current.isSymbolicLink() || !current.isFile() || current.dev !== previous.dev || current.ino !== previous.ino) return {ok: false, code: "conflict"};
    if (expected?.sha256 && (!current || createHashBytes(await fs.readFile(target)) !== expected.sha256)) return {ok: false, code: "conflict"};
    if (overwrite) await fs.rename(temp, target); else { await fs.link(temp, target); await fs.unlink(temp); }
    created = false;
    const after = await fs.lstat(target);
    if (after.isSymbolicLink() || !after.isFile() || createHashBytes(await fs.readFile(target)) !== createHashBytes(bytes)) return {ok: false};
    return {ok: true};
  } catch (error) { return (error as NodeJS.ErrnoException).code === "EEXIST" ? {ok: false, code: "conflict"} : {ok: false}; }
  finally {
    if (created && owned) {
      const current = await fs.lstat(temp).catch(() => null);
      if (current && current.isFile() && !current.isSymbolicLink() && current.dev === owned.device && current.ino === owned.inode) await fs.unlink(temp).catch(() => undefined);
    }
  }
}

function createHashBytes(bytes: Uint8Array): string {
  // Keep the parent process dependency surface tiny; this only verifies bytes
  // that are already in memory and never emits them.
  return createHash("sha256").update(bytes).digest("hex");
}
