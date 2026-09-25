import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createPortableMapStudyAdapter,
  STUDY_ARMS as ADAPTER_ARMS
} from "./portable-map-study-adapter.mjs";

const execFileAsync = promisify(execFile);
const COMPATIBILITY_VIEWS = Object.freeze([
  "ARCHITECTURE.md",
  "CONCERNS.md",
  "CONVENTIONS.md",
  "INTEGRATIONS.md",
  "STACK.md",
  "STRUCTURE.md",
  "TESTING.md"
]);
const SOURCE_RESERVED_DIRECTORIES = new Set([".git", ".blueprint", "node_modules"]);
const SHA256 = /^[a-f0-9]{64}$/u;

/** Canonical public workspace arms. */
export const STUDY_ARMS = Object.freeze({
  blueprintLegacy: "blueprint-legacy",
  blueprintCompact: "blueprint-compact",
  blueprintPortable: "blueprint-portable",
  standaloneSource: "standalone-source",
  standalonePortable: "standalone-portable"
});

export const STUDY_TASK_CLASSES = Object.freeze([
  "discussion",
  "research",
  "planning",
  "implementation",
  "review",
  "testing"
]);

/**
 * This model is intentionally a simulated fixture brief. It is sent through
 * the public project_init tool so the runtime owns canonical artifact shape,
 * ids, state, and validation. It is not a participant answer or a project
 * requirement supplied by a real user.
 */
export const SYNTHETIC_BOOTSTRAP_MODEL = Object.freeze({
  vision: "Exercise native Blueprint preparation on a disposable synthetic fixture.",
  audience: ["Development study harness"],
  milestone: "synthetic-native-preparation",
  constraints: [],
  assumptions: [],
  phases: Object.freeze([Object.freeze({
    title: "Native preparation",
    objective: "Prepare source-grounded packets through public Blueprint MCP routes.",
    requirements: ["Return the native preparation packet for the selected task class."],
    successCriteria: ["The selected public route returns its native status and packet."],
    dependsOn: []
  })]),
  deferred: [],
  outOfScope: []
});

export class PortableStudyWorkspaceError extends Error {
  constructor(code, message, details = {}, cause = undefined) {
    super(message, cause === undefined ? undefined : {cause});
    this.name = "PortableStudyWorkspaceError";
    this.code = code;
    this.details = Object.freeze({...details});
    if (cause !== undefined) this.causeError = cause;
  }
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function posix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeRelative(relativePath, label = "relative path") {
  if (typeof relativePath !== "string" || relativePath.length === 0 || relativePath.includes("\0") || relativePath.includes("\\") || path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath) || relativePath.split("/").some(segment => segment === "" || segment === "." || segment === "..")) {
    throw new PortableStudyWorkspaceError("unsafe-path", `${label} must be a safe relative path.`, {relativePath});
  }
  return posix(relativePath);
}

function contained(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function isAllowedTempAlias(resolved, canonical) {
  return (resolved === "/tmp" && canonical === "/private/tmp") ||
    (resolved === "/private/tmp" && canonical === "/tmp") ||
    (resolved.startsWith("/var/") && canonical === `/private${resolved}`) ||
    (canonical.startsWith("/var/") && resolved === `/private${canonical}`);
}

async function assertDirectory(directory, label) {
  let info;
  try {
    info = await lstat(directory);
  } catch (error) {
    throw new PortableStudyWorkspaceError("missing-input", `${label} is unavailable: ${directory}`, {directory}, error);
  }
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new PortableStudyWorkspaceError("unsafe-input", `${label} must be a regular directory without symlink indirection.`, {directory});
  }
  const resolved = path.resolve(directory);
  const canonical = await realpath(resolved);
  if (canonical !== resolved && !isAllowedTempAlias(resolved, canonical)) {
    throw new PortableStudyWorkspaceError("unsafe-input", `${label} has symlinked ancestor indirection.`, {directory: resolved, canonical});
  }
  return resolved;
}

async function assertRegularFile(file, label) {
  let info;
  try {
    info = await lstat(file);
  } catch (error) {
    throw new PortableStudyWorkspaceError("missing-input", `${label} is unavailable: ${file}`, {file}, error);
  }
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new PortableStudyWorkspaceError("unsafe-input", `${label} must be a regular file.`, {file});
  }
  const resolved = path.resolve(file);
  const canonical = await realpath(resolved);
  if (canonical !== resolved && !isAllowedTempAlias(path.dirname(resolved), path.dirname(canonical))) {
    throw new PortableStudyWorkspaceError("unsafe-input", `${label} has symlinked ancestor indirection.`, {file: resolved, canonical});
  }
  return resolved;
}

async function walkRegularFiles(root, current = root, output = []) {
  const entries = await readdir(current, {withFileTypes: true});
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const relative = posix(path.relative(root, path.join(current, entry.name)));
    if (current === root && SOURCE_RESERVED_DIRECTORIES.has(entry.name)) {
      if (entry.isSymbolicLink()) {
        throw new PortableStudyWorkspaceError("symlink", `Reserved source directory is a symlink: ${relative}`, {path: relative});
      }
      continue;
    }
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new PortableStudyWorkspaceError("symlink", `Symlinked input paths are not accepted: ${relative}`, {path: relative});
    }
    if (entry.isDirectory()) await walkRegularFiles(root, absolute, output);
    else if (entry.isFile()) output.push(relative);
    else throw new PortableStudyWorkspaceError("unsafe-input", `Unsupported input path: ${relative}`, {path: relative});
  }
  return output.sort((left, right) => left.localeCompare(right, "en"));
}

async function copyTree(source, destination, options = {}) {
  const skip = options.skip ?? (() => false);
  await mkdir(destination, {recursive: true});
  const entries = await readdir(source, {withFileTypes: true});
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    if (skip(entry.name, entry, source)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isSymbolicLink()) {
      throw new PortableStudyWorkspaceError("symlink", `Symlinked input paths are not accepted: ${from}`, {path: from});
    }
    if (entry.isDirectory()) await copyTree(from, to, options);
    else if (entry.isFile()) await cp(from, to, {preserveTimestamps: true});
    else throw new PortableStudyWorkspaceError("unsafe-input", `Unsupported input path: ${from}`, {path: from});
  }
}

function canonicalManifestEntries(entries) {
  return JSON.stringify(entries.map(entry => Object.fromEntries(
    Object.keys(entry).sort().map(key => [key, entry[key]])
  )));
}

function manifestEntries(value) {
  if (!isRecord(value)) return null;
  const raw = value.files ?? value.entries ?? value.records;
  if (Array.isArray(raw)) return raw;
  const objectEntries = Object.entries(raw ?? {}).filter(([key, item]) => typeof item === "string" || isRecord(item));
  if (objectEntries.length > 0) {
    return objectEntries.map(([filePath, item]) => isRecord(item) ? {path: filePath, ...item} : {path: filePath, sha256: item});
  }
  return null;
}

async function loadManifest(input) {
  if (typeof input === "string") {
    const file = await assertRegularFile(path.resolve(input), "Expected source manifest");
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      throw new PortableStudyWorkspaceError("invalid-manifest", "Expected source manifest is not valid JSON.", {file}, error);
    }
  }
  if (!isRecord(input)) throw new PortableStudyWorkspaceError("invalid-manifest", "expectedManifest must be a JSON object or JSON file path.");
  return input;
}

async function captureSourceManifest(sourceRoot, expectedInput) {
  const expected = await loadManifest(expectedInput);
  const expectedRaw = manifestEntries(expected);
  if (!expectedRaw || expectedRaw.length === 0) {
    throw new PortableStudyWorkspaceError("invalid-manifest", "Expected source manifest must list every frozen source file with its SHA-256 hash.");
  }
  const expectedEntries = [];
  const expectedPaths = new Set();
  for (const item of expectedRaw) {
    if (!isRecord(item)) throw new PortableStudyWorkspaceError("invalid-manifest", "Source manifest entries must be objects.");
    const relativePath = safeRelative(item.path ?? item.relativePath, "source manifest path");
    if (relativePath.startsWith(".git/") || relativePath === ".git" || relativePath.startsWith(".blueprint/") || relativePath === ".blueprint") {
      throw new PortableStudyWorkspaceError("invalid-manifest", "Source manifest cannot include private Git or Blueprint runtime state.", {path: relativePath});
    }
    const sha256 = String(item.sha256 ?? item.hash ?? "").toLowerCase();
    if (!SHA256.test(sha256)) throw new PortableStudyWorkspaceError("invalid-manifest", `Source manifest hash is invalid for ${relativePath}.`, {path: relativePath});
    if (expectedPaths.has(relativePath)) throw new PortableStudyWorkspaceError("invalid-manifest", `Source manifest repeats ${relativePath}.`, {path: relativePath});
    expectedPaths.add(relativePath);
    const gitMode = item.gitMode ?? item.mode;
    if (gitMode !== undefined && gitMode !== "100644" && gitMode !== "100755") {
      throw new PortableStudyWorkspaceError("invalid-manifest", `Source manifest mode is invalid for ${relativePath}.`, {path: relativePath, gitMode});
    }
    expectedEntries.push({path: relativePath, sha256, bytes: item.bytes ?? item.byteSize ?? item.size, ...(gitMode === undefined ? {} : {gitMode})});
  }
  // Preserve the receipt's canonical traversal order. Some frozen manifests
  // use depth-first directory order, so re-sorting would change their digest.
  const actualPaths = await walkRegularFiles(sourceRoot);
  const actualEntries = [];
  const actualSet = new Set(actualPaths);
  const missing = expectedEntries.filter(entry => !actualSet.has(entry.path)).map(entry => entry.path);
  const unexpected = actualPaths.filter(relativePath => !expectedPaths.has(relativePath));
  if (missing.length || unexpected.length) {
    throw new PortableStudyWorkspaceError("source-manifest-mismatch", "Frozen source file set does not match the expected manifest.", {missing, unexpected});
  }
  const mismatches = [];
  for (const entry of expectedEntries) {
    const absolute = path.join(sourceRoot, entry.path);
    const bytes = await readFile(absolute);
    const info = await lstat(absolute);
    const actual = {path: entry.path, bytes: bytes.byteLength, sha256: digest(bytes), ...(entry.gitMode === undefined ? {} : {gitMode: (info.mode & 0o111) === 0 ? "100644" : "100755"})};
    actualEntries.push(actual);
    if (actual.sha256 !== entry.sha256 || (entry.bytes !== undefined && Number(entry.bytes) !== actual.bytes) || (entry.gitMode !== undefined && actual.gitMode !== entry.gitMode)) {
      mismatches.push({path: entry.path, expected: {sha256: entry.sha256, bytes: entry.bytes, ...(entry.gitMode === undefined ? {} : {gitMode: entry.gitMode})}, actual});
    }
  }
  if (mismatches.length) throw new PortableStudyWorkspaceError("source-checksum-mismatch", "Frozen source bytes do not match the expected manifest.", {mismatches});
  const manifestSha256 = digest(canonicalManifestEntries(actualEntries));
  const expectedSha = expected.manifestSha256 ?? expected.treeSha256 ?? expected.sha256;
  if (expectedSha !== undefined && expectedSha !== manifestSha256) {
    throw new PortableStudyWorkspaceError("source-manifest-mismatch", "Expected source manifest checksum does not match its declared entries.", {expected: expectedSha, actual: manifestSha256});
  }
  const declaredSourceSha = expected.sourceManifestSha256;
  if (declaredSourceSha !== undefined && !SHA256.test(String(declaredSourceSha))) {
    throw new PortableStudyWorkspaceError("invalid-manifest", "Expected sourceManifestSha256 must be a lowercase hexadecimal SHA-256 string.");
  }
  if (declaredSourceSha !== undefined && declaredSourceSha !== manifestSha256) {
    throw new PortableStudyWorkspaceError("source-manifest-mismatch", "Expected sourceManifestSha256 does not match the captured source bytes.", {expected: declaredSourceSha, actual: manifestSha256});
  }
  return Object.freeze({
    sha256: manifestSha256,
    sourceManifestSha256: typeof expected.sourceManifestSha256 === "string" ? expected.sourceManifestSha256 : manifestSha256,
    files: actualEntries
  });
}

function parsePortableDescriptor(indexText) {
  const marker = /<!--\s*blueprint:portable-root-descriptor\s+([^>]+?)\s*-->/u.exec(indexText);
  if (!marker) throw new PortableStudyWorkspaceError("invalid-map", "Portable map INDEX.md has no root descriptor.");
  let descriptor;
  try { descriptor = JSON.parse(marker[1]); } catch (error) {
    throw new PortableStudyWorkspaceError("invalid-map", "Portable map INDEX.md has an invalid root descriptor.", {}, error);
  }
  if (!isRecord(descriptor) || descriptor.version !== 1 || typeof descriptor.generationId !== "string") {
    throw new PortableStudyWorkspaceError("invalid-map", "Portable map root descriptor is unsupported.");
  }
  const manifestPath = safeRelative(descriptor.manifest?.path, "portable manifest path");
  const entryPath = safeRelative(descriptor.entry?.path, "portable entry path");
  if (!manifestPath.startsWith(`generations/${descriptor.generationId}/`) || !entryPath.startsWith(`generations/${descriptor.generationId}/`)) {
    throw new PortableStudyWorkspaceError("invalid-map", "Portable map descriptor escapes its referenced generation.");
  }
  if (!SHA256.test(String(descriptor.manifest?.sha256 ?? "")) || !SHA256.test(String(descriptor.entry?.sha256 ?? ""))) {
    throw new PortableStudyWorkspaceError("invalid-map", "Portable map descriptor must contain manifest and entry SHA-256 checksums.");
  }
  return {descriptor, manifestPath, entryPath};
}

async function discoverDescriptor(bundleRoot, indexText) {
  try {
    return parsePortableDescriptor(indexText);
  } catch (error) {
    // The early pilot bundle predates the root marker. It still seals one
    // unambiguous generation in its manifest, so infer only that generation.
    if (!(error instanceof PortableStudyWorkspaceError) || error.code !== "invalid-map" || !error.message.includes("no root descriptor")) throw error;
    const generationsRoot = path.join(bundleRoot, "generations");
    await assertDirectory(generationsRoot, "Portable map generations");
    const generations = (await readdir(generationsRoot, {withFileTypes: true})).filter(entry => entry.isDirectory() && !entry.isSymbolicLink());
    if (generations.length !== 1) throw new PortableStudyWorkspaceError("invalid-map", "Descriptor-less map bundles must contain exactly one generation.");
    const generationId = generations[0].name;
    const manifestPath = `generations/${generationId}/manifest.json`;
    const entryPath = `generations/${generationId}/ENTRY.md`;
    const manifestBytes = await readFile(path.join(bundleRoot, manifestPath));
    const entryBytes = await readFile(path.join(bundleRoot, entryPath));
    return {
      legacyFormat: true,
      descriptor: {
        version: 1,
        generationId,
        manifest: {path: manifestPath, sha256: digest(manifestBytes)},
        entry: {path: entryPath, sha256: digest(entryBytes)}
      },
      manifestPath,
      entryPath
    };
  }
}

async function validateMapBundle(bundleRoot, {requirePortable = true} = {}) {
  const root = await assertDirectory(bundleRoot, "Map bundle");
  const indexPath = await assertRegularFile(path.join(root, "INDEX.md"), "Map bundle INDEX.md");
  const indexBytes = await readFile(indexPath);
  const descriptor = await discoverDescriptor(root, indexBytes.toString("utf8"));
  const manifestPath = path.join(root, descriptor.manifestPath);
  const entryPath = path.join(root, descriptor.entryPath);
  await assertRegularFile(manifestPath, "Map generation manifest");
  await assertRegularFile(entryPath, "Map generation entry");
  const manifestBytes = await readFile(manifestPath);
  const entryBytes = await readFile(entryPath);
  const manifestSha256 = digest(manifestBytes);
  const entrySha256 = digest(entryBytes);
  if (manifestSha256 !== descriptor.descriptor.manifest.sha256 || entrySha256 !== descriptor.descriptor.entry.sha256) {
    throw new PortableStudyWorkspaceError("map-checksum-mismatch", "Portable map INDEX checksums do not match its referenced generation.", {manifestPath: descriptor.manifestPath, entryPath: descriptor.entryPath});
  }
  let manifest;
  try { manifest = JSON.parse(manifestBytes.toString("utf8")); } catch (error) {
    throw new PortableStudyWorkspaceError("invalid-map", "Portable map generation manifest is not valid JSON.", {path: descriptor.manifestPath}, error);
  }
  if (manifest.generationId !== descriptor.descriptor.generationId || manifest.gitCommit !== null && typeof manifest.gitCommit !== "string") {
    throw new PortableStudyWorkspaceError("invalid-map", "Portable map generation metadata does not match its descriptor.");
  }
  const checksums = new Map();
  const addChecksum = (relative, checksum, label) => {
    const previous = checksums.get(relative);
    if (previous !== undefined && previous !== checksum) {
      throw new PortableStudyWorkspaceError("invalid-map", `Portable map has conflicting checksum references for ${relative}.`, {path: relative, previous, checksum, label});
    }
    checksums.set(relative, checksum);
  };
  if (manifest.checksums?.entry) {
    if (!SHA256.test(String(manifest.checksums.entry))) throw new PortableStudyWorkspaceError("invalid-map", "Portable map manifest contains an invalid entry checksum.");
    addChecksum(descriptor.entryPath, manifest.checksums.entry, "entry");
  }
  for (const page of manifest.checksums?.pages ?? []) {
    if (!isRecord(page) || typeof page.path !== "string" || !SHA256.test(String(page.checksum ?? ""))) {
      throw new PortableStudyWorkspaceError("invalid-map", "Portable map manifest contains an invalid page checksum.");
    }
    const relative = safeRelative(page.path, "portable map page path");
    const normalized = relative.startsWith(`generations/${manifest.generationId}/`)
      ? relative
      : `generations/${manifest.generationId}/${relative}`;
    addChecksum(normalized, page.checksum, "page");
  }
  for (const shard of manifest.inventoryShards ?? []) {
    if (!isRecord(shard) || typeof shard.path !== "string" || !SHA256.test(String(shard.checksum ?? ""))) throw new PortableStudyWorkspaceError("invalid-map", "Portable map manifest contains an invalid inventory shard.");
    const relative = safeRelative(shard.path, "portable inventory shard path");
    const normalized = relative.startsWith(`generations/${manifest.generationId}/`)
      ? relative
      : `generations/${manifest.generationId}/${relative}`;
    addChecksum(normalized, shard.checksum, "inventory");
  }
  if (requirePortable && checksums.size < 2) throw new PortableStudyWorkspaceError("invalid-map", "Portable map generation has no complete sealed page set.");
  const generationPrefix = `generations/${manifest.generationId}/`;
  const requiredGenerationFiles = new Set([descriptor.manifestPath, descriptor.entryPath, ...checksums.keys()]);
  try {
    await assertRegularFile(path.join(root, `${generationPrefix}INDEX.md`), "Portable generation INDEX.md");
    requiredGenerationFiles.add(`${generationPrefix}INDEX.md`);
  } catch (error) {
    if (!(error instanceof PortableStudyWorkspaceError) || error.code !== "missing-input") throw error;
  }
  for (const view of COMPATIBILITY_VIEWS) {
    const generationView = `${generationPrefix}compatibility/${view}`;
    try {
      await assertRegularFile(path.join(root, generationView), `Frozen compatibility view ${view}`);
      requiredGenerationFiles.add(generationView);
    } catch (error) {
      if (!(error instanceof PortableStudyWorkspaceError) || error.code !== "missing-input") throw error;
    }
  }
  const files = await walkRegularFiles(root);
  const allowedRootFiles = new Set(["INDEX.md", ...COMPATIBILITY_VIEWS]);
  const allowedFiles = new Set([...allowedRootFiles, ...requiredGenerationFiles]);
  const undeclared = files.filter((relative) => !allowedFiles.has(relative));
  if (undeclared.length > 0) {
    throw new PortableStudyWorkspaceError("unsealed-generation", "Portable map contains files outside its declared sealed allowlist.", {files: undeclared});
  }
  const observed = [];
  for (const relative of files) {
    const bytes = await readFile(path.join(root, relative));
    observed.push({path: relative, bytes: bytes.byteLength, sha256: digest(bytes)});
    const expected = checksums.get(relative);
    if (expected && expected !== observed.at(-1).sha256) throw new PortableStudyWorkspaceError("map-checksum-mismatch", `Portable map page checksum mismatch: ${relative}`, {path: relative});
  }
  for (const [relative] of checksums) {
    await assertRegularFile(path.join(root, relative), "Portable map referenced file");
  }
  const rootViews = COMPATIBILITY_VIEWS.filter(name => files.includes(name));
  const compatibilityHashes = manifest.checksums?.compatibility ?? {};
  if (!descriptor.legacyFormat) {
    for (const view of COMPATIBILITY_VIEWS) {
      const key = view.slice(0, -3).toLowerCase();
      const expected = compatibilityHashes[key];
      if (expected === undefined) continue;
      const bytes = await readFile(path.join(root, view)).catch(() => null);
      if (!bytes || digest(bytes) !== expected) {
        throw new PortableStudyWorkspaceError("map-checksum-mismatch", `Compatibility view checksum mismatch: ${view}`, {path: view});
      }
    }
  }
  return Object.freeze({
    root,
    descriptor: Object.freeze({
      generationId: descriptor.descriptor.generationId,
      manifestPath: descriptor.manifestPath,
      entryPath: descriptor.entryPath,
      manifestSha256,
      entrySha256
    }),
    indexSha256: digest(indexBytes),
    files: observed,
    allowedFiles: [...allowedFiles].sort((left, right) => left.localeCompare(right, "en")),
    compatibilityViews: rootViews
  });
}

async function copyCompatibilityViews(bundleRoot, destination, mapInfo = null) {
  await mkdir(destination, {recursive: true});
  for (const view of COMPATIBILITY_VIEWS) {
    const source = await assertRegularFile(path.join(bundleRoot, view), `Frozen compatibility view ${view}`);
    const snapshot = mapInfo?.files?.find((entry) => entry.path === view);
    if (snapshot) await verifyCapturedFiles(bundleRoot, [snapshot], `Map compatibility source ${view}`);
    await cp(source, path.join(destination, view), {preserveTimestamps: true});
    if (snapshot) await verifyCapturedFiles(destination, [{...snapshot, path: view}], `Map compatibility transfer ${view}`);
  }
  return COMPATIBILITY_VIEWS.map(view => `.blueprint/codebase/${view}`);
}

async function verifyCapturedFiles(root, snapshots, label) {
  const mismatches = [];
  for (const snapshot of snapshots) {
    const file = path.join(root, snapshot.path);
    let bytes;
    try { bytes = await readFile(file); } catch { mismatches.push({path: snapshot.path, reason: "missing"}); continue; }
    const actual = {bytes: bytes.byteLength, sha256: digest(bytes)};
    if (actual.bytes !== snapshot.bytes || actual.sha256 !== snapshot.sha256) mismatches.push({path: snapshot.path, expected: snapshot, actual});
  }
  if (mismatches.length > 0) throw new PortableStudyWorkspaceError("snapshot-mismatch", `${label} changed during workspace materialization.`, {mismatches});
}

async function copyPortableTransfer(bundleRoot, destination, {compatibility = true, mapInfo = null} = {}) {
  await mkdir(destination, {recursive: true});
  const descriptor = mapInfo?.descriptor ?? await discoverDescriptor(bundleRoot, (await readFile(path.join(bundleRoot, "INDEX.md"))).toString("utf8"));
  const snapshots = mapInfo?.files ?? [];
  const allowed = new Set(mapInfo?.allowedFiles ?? ["INDEX.md", descriptor.manifestPath, descriptor.entryPath]);
  for (const relative of allowed) {
    if (relative !== "INDEX.md" && !compatibility && COMPATIBILITY_VIEWS.includes(relative)) continue;
    const source = await assertRegularFile(path.join(bundleRoot, relative), `Frozen portable transfer file ${relative}`);
    const target = path.join(destination, relative);
    await mkdir(path.dirname(target), {recursive: true});
    await cp(source, target, {preserveTimestamps: true});
  }
  if (snapshots.length > 0) await verifyCapturedFiles(bundleRoot, snapshots, "Map source");
  if (snapshots.length > 0) await verifyCapturedFiles(destination, snapshots.filter((snapshot) => allowed.has(snapshot.path) && (compatibility || !COMPATIBILITY_VIEWS.includes(snapshot.path))), "Map transfer");
  return {
    files: await walkRegularFiles(destination),
    descriptor: Object.freeze({generationId: descriptor.descriptor?.generationId ?? descriptor.generationId, manifestPath: descriptor.manifestPath, entryPath: descriptor.entryPath})
  };
}

async function appendPortablePointer(workspaceRoot) {
  const guidanceCandidates = ["AGENTS.md", "README.md"];
  let guidance = null;
  for (const candidate of guidanceCandidates) {
    try { guidance = await assertRegularFile(path.join(workspaceRoot, candidate), `Original ${candidate}`); break; } catch (error) {
      if (!(error instanceof PortableStudyWorkspaceError) || error.code !== "missing-input") throw error;
    }
  }
  if (!guidance) guidance = path.join(workspaceRoot, "AGENTS.md");
  const originalBytes = await readFile(guidance).catch(() => Buffer.alloc(0));
  const newline = originalBytes.includes(Buffer.from("\r\n")) ? "\r\n" : "\n";
  const original = originalBytes.toString("utf8");
  const start = "<!-- blueprint:portable-codebase-index:start -->";
  const end = "<!-- blueprint:portable-codebase-index:end -->";
  const snippet = "When locating code, understanding repository responsibilities or constraints, or finding related tests, read `.blueprint/codebase/INDEX.md` if present and follow its guidance. Reuse it within the task; read an already-known target directly.";
  const block = [start, snippet, end].join(newline);
  if (!original.includes(start) && !original.includes(end)) {
    const separator = original.length > 0 && !original.endsWith("\n") ? newline : "";
    const finalNewline = original.length > 0 ? newline : "";
    await writeFile(guidance, `${original}${separator}${block}${finalNewline}`, "utf8");
  } else if (!original.includes(start) || !original.includes(end) || !original.includes(snippet)) {
    throw new PortableStudyWorkspaceError("guidance-conflict", "Guidance contains conflicting Blueprint managed markers.", {path: guidance});
  }
  return Object.freeze({path: posix(path.relative(workspaceRoot, guidance)), sha256: digest(await readFile(guidance))});
}

async function initializeGit(workspaceRoot) {
  try {
    await execFileAsync("git", ["init", "-b", "main"], {cwd: workspaceRoot});
  } catch {
    await execFileAsync("git", ["init"], {cwd: workspaceRoot});
    await execFileAsync("git", ["checkout", "-b", "main"], {cwd: workspaceRoot});
  }
  await execFileAsync("git", ["config", "user.name", "Blueprint disposable study"] , {cwd: workspaceRoot});
  await execFileAsync("git", ["config", "user.email", "blueprint-disposable-study@example.invalid"], {cwd: workspaceRoot});
  await execFileAsync("git", ["add", "-A"], {cwd: workspaceRoot});
  await execFileAsync("git", ["commit", "-m", "Initialize disposable study workspace", "--no-gpg-sign"], {cwd: workspaceRoot});
}

function adapterArm(arm) {
  if (arm === STUDY_ARMS.blueprintLegacy) return ADAPTER_ARMS.baselineLegacy;
  if (arm === STUDY_ARMS.blueprintCompact) return ADAPTER_ARMS.currentCompactLexical;
  if (arm === STUDY_ARMS.blueprintPortable) return ADAPTER_ARMS.currentPortable;
  return null;
}

function extensionFor(arm, options) {
  if (arm === STUDY_ARMS.blueprintLegacy) return options.originalExtensionPath ?? options.baselineExtensionPath;
  if (arm === STUDY_ARMS.blueprintCompact || arm === STUDY_ARMS.blueprintPortable) return options.currentExtensionPath;
  return null;
}

function canonicalTaskClass(value) {
  if (value === "discuss") return "discussion";
  if (value === "plan") return "planning";
  if (!STUDY_TASK_CLASSES.includes(value)) throw new PortableStudyWorkspaceError("unsupported-class", `Unsupported study task class: ${String(value)}`, {taskClass: value});
  return value;
}

function adapterTaskClass(value) {
  if (value === "discussion") return "discuss";
  if (value === "planning") return "plan";
  return value;
}

function validateOptions(options) {
  if (!isRecord(options)) throw new PortableStudyWorkspaceError("invalid-options", "Workspace options must be an object.");
  const arm = options.arm;
  if (!Object.values(STUDY_ARMS).includes(arm)) throw new PortableStudyWorkspaceError("unsupported-arm", `Unsupported study workspace arm: ${String(arm)}`, {arm});
  const source = options.sourceRoot ?? options.sourceDirectory ?? options.sourceRepo ?? options.sourceRepository;
  if (typeof source !== "string" || source.length === 0) throw new PortableStudyWorkspaceError("invalid-options", "sourceRoot/sourceDirectory is required.");
  if (options.expectedManifest === undefined) throw new PortableStudyWorkspaceError("invalid-options", "expectedManifest is required; source freshness cannot be inferred.");
  if (arm !== STUDY_ARMS.standaloneSource && typeof options.mapBundleDir !== "string" && typeof options.mapBundlePath !== "string" && typeof options.mapBundle !== "string") {
    throw new PortableStudyWorkspaceError("invalid-options", "mapBundleDir is required for mapped Blueprint and standalone-portable arms.");
  }
  if (arm === STUDY_ARMS.blueprintLegacy && !extensionFor(arm, options)) throw new PortableStudyWorkspaceError("invalid-options", "originalExtensionPath is required for blueprint-legacy.");
  if ((arm === STUDY_ARMS.blueprintCompact || arm === STUDY_ARMS.blueprintPortable) && !extensionFor(arm, options)) throw new PortableStudyWorkspaceError("invalid-options", "currentExtensionPath is required for current Blueprint arms.");
  return {arm, source: path.resolve(source), map: options.mapBundleDir ?? options.mapBundlePath ?? options.mapBundle ?? null};
}

class PortableStudyWorkspace {
  #ownedWorkspaceRoot;
  #ownedRuntimeHome;

  constructor(options, normalized, sourceManifest, mapInfo, workspaceRoot, copied, runtimeEnvironment, runtimeHome) {
    this.arm = normalized.arm;
    this.label = String(options.label ?? options.opaqueLabel ?? "development");
    Object.defineProperty(this, "workspaceRoot", {value: workspaceRoot, enumerable: true, writable: false, configurable: false});
    Object.defineProperty(this, "sourceRoot", {value: workspaceRoot, enumerable: true, writable: false, configurable: false});
    this.#ownedWorkspaceRoot = workspaceRoot;
    this.mapRoot = copied.mapRoot;
    this.extensionPath = extensionFor(this.arm, options) ? path.resolve(extensionFor(this.arm, options)) : null;
    this.sourceManifest = sourceManifest;
    this.map = mapInfo;
    this.copied = Object.freeze(copied);
    this._options = options;
    this.#ownedRuntimeHome = runtimeHome;
    Object.defineProperty(this, "runtimeEnvironment", {value: runtimeEnvironment, enumerable: true, writable: false, configurable: false});
    this._bootstrapResult = null;
    this._disposed = false;
  }

  get bootstrapResult() { return this._bootstrapResult; }

  async bootstrap({model = SYNTHETIC_BOOTSTRAP_MODEL, timeoutMs = 30_000} = {}) {
    if (this._disposed) throw new PortableStudyWorkspaceError("disposed", "Workspace has already been disposed.");
    if (this._bootstrapResult) return this._bootstrapResult;
    if (!adapterArm(this.arm)) {
      this._bootstrapResult = Object.freeze({status: "not-applicable", arm: this.arm, reason: "Standalone arms do not use Blueprint MCP setup."});
      return this._bootstrapResult;
    }
    const adapter = createPortableMapStudyAdapter({
      extensionPath: this.extensionPath,
      cwd: this.workspaceRoot,
      ...(this.runtimeEnvironment ? {environment: this.runtimeEnvironment} : {}),
      timeoutMs,
      clientName: "portable-map-study-workspace"
    });
    try {
      await adapter.connect();
      const prepare = await adapter.invoke("blueprint_project_prepare", {cwd: this.workspaceRoot, auto: true});
      const preparedStatus = prepare.payload?.status ?? (prepare.response?.isError ? "blocked" : "ready");
      if (preparedStatus === "blocked" || prepare.response?.isError) {
        this._bootstrapResult = Object.freeze({status: "blocked", prepare, init: null, actions: adapter.getActionProvenance()});
        return this._bootstrapResult;
      }
      const init = await adapter.invoke("blueprint_project_init", {
        cwd: this.workspaceRoot,
        bootstrapMode: "auto",
        bootstrapModel: model,
        savedDefaultsPolicy: "skip"
      });
      const status = init.response?.isError || init.payload?.status === "invalid" ? "blocked" : "prepared";
      this._bootstrapResult = Object.freeze({status, prepare, init, actions: adapter.getActionProvenance()});
      return this._bootstrapResult;
    } finally {
      await adapter.close();
    }
  }

  async prepareNative(options = {}) {
    if (this._disposed) throw new PortableStudyWorkspaceError("disposed", "Workspace has already been disposed.");
    if (!adapterArm(this.arm)) throw new PortableStudyWorkspaceError("standalone-arm", "Standalone arms do not use the Blueprint MCP adapter.", {arm: this.arm});
    const classes = options.taskClass === undefined
      ? [...STUDY_TASK_CLASSES]
      : [canonicalTaskClass(options.taskClass)];
    const bootstrap = options.bootstrap === false ? null : await this.bootstrap({model: options.bootstrapModel ?? SYNTHETIC_BOOTSTRAP_MODEL, timeoutMs: options.timeoutMs});
    if (bootstrap && bootstrap.status === "blocked") return Object.freeze({status: "blocked", bootstrap, preparations: []});
    const adapter = createPortableMapStudyAdapter({extensionPath: this.extensionPath, cwd: this.workspaceRoot, timeoutMs: options.timeoutMs, clientName: "portable-map-study-workspace", ...(this.runtimeEnvironment ? {environment: this.runtimeEnvironment} : {})});
    const preparations = [];
    try {
      await adapter.connect();
      for (const taskClass of classes) {
        const nativeArguments = isRecord(options.nativeArguments) ? {...options.nativeArguments} : {};
        const routeOptions = {
          taskClass: adapterTaskClass(taskClass),
          arm: adapterArm(this.arm),
          cwd: this.workspaceRoot,
          phase: options.phase ?? "1",
          provenance: options.provenance
        };
        const wrapperKeys = new Set(["taskClass", "bootstrap", "bootstrapModel", "timeoutMs", "phase", "provenance", "reviewFiles"]);
        const supportedKeys = new Set(["files", "depth", "includeAuthoringContext", "portableSelections", "evidenceDelivery", "evidencePaths", "expectedRevision", "acknowledgeChangedInputs", "reconcile", "mode", "targetPlanIds", "nativeArguments"]);
        const unknown = Object.keys(options).filter((key) => !wrapperKeys.has(key) && !supportedKeys.has(key)).sort();
        if (unknown.length > 0) throw new PortableStudyWorkspaceError("unknown-option", `Unsupported native preparation option(s): ${unknown.join(", ")}`, {unknown});
        for (const key of supportedKeys) {
          if (options[key] !== undefined) routeOptions[key] = options[key];
        }
        if (taskClass === "review" && options.reviewFiles !== undefined && routeOptions.files === undefined) routeOptions.files = options.reviewFiles;
        if (Object.keys(nativeArguments).length > 0) routeOptions.nativeArguments = nativeArguments;
        preparations.push(Object.freeze({taskClass, result: await adapter.prepare(routeOptions)}));
      }
      return Object.freeze({status: "prepared", bootstrap, preparations, actions: adapter.getActionProvenance()});
    } finally {
      await adapter.close();
    }
  }

  async prepare(options = {}) { return this.prepareNative(options); }
  async setup(options = {}) { return this.bootstrap(options); }

  async dispose() {
    if (this._disposed) return;
    this._disposed = true;
    const ownedRoot = this.#ownedWorkspaceRoot;
    if (ownedRoot && contained(path.dirname(ownedRoot), ownedRoot)) await rm(ownedRoot, {recursive: true, force: true});
    if (this.#ownedRuntimeHome && contained(path.dirname(this.#ownedRuntimeHome), this.#ownedRuntimeHome)) await rm(this.#ownedRuntimeHome, {recursive: true, force: true});
  }
}

/**
 * Materialize one opaque, disposable study workspace from frozen inputs.
 * This function never reads task datasets, gold, outcomes, or participant
 * sessions. By default Blueprint arms run the public synthetic project
 * bootstrap immediately; native class preparation remains an explicit method.
 */
export async function createPortableStudyWorkspace(options = {}) {
  const normalized = validateOptions(options);
  const sourceRoot = await assertDirectory(normalized.source, "Frozen source");
  const sourceManifest = await captureSourceManifest(sourceRoot, options.expectedManifest);
  let mapInfo = null;
  let mapRoot = null;
  if (normalized.map) {
    mapInfo = await validateMapBundle(normalized.map);
  }
  const parent = path.resolve(options.destinationParent ?? options.workspaceParent ?? options.destinationRoot ?? os.tmpdir());
  await assertDirectory(parent, "Workspace destination parent");
  const workspaceRoot = await mkdtemp(path.join(parent, "portable-study-workspace-"));
  const runtimeHome = adapterArm(normalized.arm) ? await mkdtemp(path.join(parent, "portable-study-runtime-")) : null;
  const runtimeEnvironment = runtimeHome ? Object.freeze({BLUEPRINT_GLOBAL_HOME: runtimeHome}) : null;
  try {
    await verifyCapturedFiles(sourceRoot, sourceManifest.files, "Frozen source");
    await copyTree(sourceRoot, workspaceRoot, {skip: (name, entry, current) => current === sourceRoot && SOURCE_RESERVED_DIRECTORIES.has(name)});
    await verifyCapturedFiles(workspaceRoot, sourceManifest.files, "Copied source");
    const copied = {sourceFiles: sourceManifest.files.map(entry => entry.path), mapFiles: []};
    if (normalized.arm === STUDY_ARMS.blueprintLegacy || normalized.arm === STUDY_ARMS.blueprintCompact) {
      mapRoot = path.join(workspaceRoot, ".blueprint", "codebase");
      copied.mapFiles = await copyCompatibilityViews(normalized.map, mapRoot, mapInfo);
    } else if (normalized.arm === STUDY_ARMS.blueprintPortable) {
      mapRoot = path.join(workspaceRoot, ".blueprint", "codebase");
      const transfer = await copyPortableTransfer(normalized.map, mapRoot, {compatibility: true, mapInfo});
      copied.mapFiles = transfer.files.map(file => `.blueprint/codebase/${file}`);
      copied.portablePointer = await appendPortablePointer(workspaceRoot);
    } else if (normalized.arm === STUDY_ARMS.standalonePortable) {
      mapRoot = path.join(workspaceRoot, ".blueprint", "codebase");
      const transfer = await copyPortableTransfer(normalized.map, mapRoot, {compatibility: false, mapInfo});
      copied.mapFiles = transfer.files.map(file => `.blueprint/codebase/${file}`);
      copied.portablePointer = await appendPortablePointer(workspaceRoot);
    }
    await initializeGit(workspaceRoot);
    await verifyCapturedFiles(sourceRoot, sourceManifest.files, "Frozen source");
    const workspace = new PortableStudyWorkspace(options, normalized, sourceManifest, mapInfo, workspaceRoot, {...copied, mapRoot}, runtimeEnvironment, runtimeHome);
    if (options.autoBootstrap !== false && adapterArm(normalized.arm)) await workspace.bootstrap({timeoutMs: options.timeoutMs});
    return workspace;
  } catch (error) {
    await rm(workspaceRoot, {recursive: true, force: true}).catch(() => {});
    if (runtimeHome) await rm(runtimeHome, {recursive: true, force: true}).catch(() => {});
    if (error instanceof PortableStudyWorkspaceError) throw error;
    throw new PortableStudyWorkspaceError("workspace-create-failed", `Unable to create disposable study workspace: ${error instanceof Error ? error.message : String(error)}`, {workspaceRoot}, error);
  }
}

export const createStudyWorkspace = createPortableStudyWorkspace;
