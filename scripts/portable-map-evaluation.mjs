import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Deterministic, development-only navigation measurement.
 *
 * This module deliberately has no model, hosted-agent, tokenizer, or patch
 * selection dependency.  A route is selected from the task text, the live
 * repository and the selected map arm.  Gold is consumed only by scoreResult.
 */

export const ARMS = Object.freeze({
  lexical: "ordinary-lexical",
  compatibility: "compatibility-seven",
  structural: "structural-only",
  semantic: "semantic-portable-map"
});

export const ARM_NAMES = Object.freeze(Object.values(ARMS));
export const BUDGETS = Object.freeze([4 * 1024, 8 * 1024, 12 * 1024]);
const COMPATIBILITY_VIEWS = Object.freeze([
  "ARCHITECTURE.md", "CONCERNS.md", "CONVENTIONS.md", "INTEGRATIONS.md",
  "STACK.md", "STRUCTURE.md", "TESTING.md"
]);
const SOURCE_EXTENSIONS = new Set([
  ".c", ".cc", ".cpp", ".css", ".go", ".h", ".hpp", ".java", ".js", ".jsx",
  ".json", ".md", ".mjs", ".py", ".rs", ".sql", ".toml", ".ts", ".tsx", ".xml", ".yaml", ".yml"
]);
const SOURCE_READ_KINDS = new Set(["known-target-source-read", "source-read", "fallback-source-read"]);
const MAP_READ_KINDS = new Set([
  "map-index-read", "compatibility-view-read", "map-search-page-read", "structural-record-read", "semantic-record-read"
]);

export class PortableEvaluationError extends Error {
  constructor(reason = "malformed-map") {
    super(reason);
    this.name = "PortableEvaluationError";
    this.reason = reason;
  }
}

function posix(value) {
  return value.split(path.sep).join("/");
}

function lower(value) {
  return String(value ?? "").toLocaleLowerCase("en");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isContained(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function assertSafeRelative(relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || relativePath.includes("\0") ||
      relativePath.includes("\\") || path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
    throw new PortableEvaluationError("unsafe-path");
  }
  const segments = relativePath.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new PortableEvaluationError("unsafe-path");
  }
}

/** Resolve a regular file while rejecting symlinks at every path component. */
export async function resolveContainedFile(root, relativePath) {
  assertSafeRelative(relativePath);
  const absoluteRoot = path.resolve(root);
  let rootStats;
  try {
    rootStats = await lstat(absoluteRoot);
  } catch (error) {
    throw new PortableEvaluationError(error?.code === "ENOENT" ? "missing-source" : "unreadable-source");
  }
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) throw new PortableEvaluationError("unsafe-path");
  const absolutePath = path.resolve(absoluteRoot, relativePath);
  if (!isContained(absoluteRoot, absolutePath)) throw new PortableEvaluationError("unsafe-path");
  let current = absoluteRoot;
  for (const segment of relativePath.split("/")) {
    current = path.join(current, segment);
    let stats;
    try {
      stats = await lstat(current);
    } catch (error) {
      throw new PortableEvaluationError(error?.code === "ENOENT" ? "missing-source" : "unreadable-source");
    }
    if (stats.isSymbolicLink()) throw new PortableEvaluationError("unsafe-path");
    if (current === absolutePath ? !stats.isFile() : !stats.isDirectory()) {
      throw new PortableEvaluationError("unreadable-source");
    }
  }
  return absolutePath;
}

async function walkFiles(root, current = root, output = []) {
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch {
    return output;
  }
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    if ([".blueprint", ".git", "node_modules"].includes(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) await walkFiles(root, absolute, output);
    else if (entry.isFile()) output.push(posix(path.relative(root, absolute)));
  }
  return output.sort((left, right) => left.localeCompare(right, "en"));
}

export async function discoverFiles(repositoryRoot) {
  return walkFiles(path.resolve(repositoryRoot));
}

function lineBounds(text, startLine = 1) {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  const lineCount = lines.length - (text.endsWith("\n") ? 1 : 0);
  const endLine = startLine + Math.max(1, lineCount) - 1;
  return { startLine, endLine: Math.max(startLine, endLine) };
}

/** Return a prefix that ends on a UTF-8 code-point boundary. */
function utf8Prefix(raw, requestedBytes) {
  let end = Math.max(0, Math.min(raw.byteLength, requestedBytes));
  while (end > 0) {
    const text = raw.subarray(0, end).toString("utf8");
    if (Buffer.byteLength(text, "utf8") === end) return raw.subarray(0, end);
    end -= 1;
  }
  return raw.subarray(0, 0);
}

function completeLineRange(text, startLine, requestedRange, truncated) {
  if (!text) return null;
  if (!truncated) {
    const lines = text.split(/\r?\n/);
    const lineCount = lines.length - (text.endsWith("\n") ? 1 : 0);
    const endLine = startLine + Math.max(1, lineCount) - 1;
    return { startLine, endLine: Math.max(startLine, endLine) };
  }
  const completeLines = (text.match(/\n/g) ?? []).length;
  return completeLines > 0
    ? { startLine, endLine: startLine + completeLines - 1 }
    : null;
}

function normalizeRange(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const startLine = Number(value[0]);
    const endLine = Number(value[1]);
    return Number.isFinite(startLine) && Number.isFinite(endLine)
      ? { startLine, endLine: Math.max(startLine, endLine) } : null;
  }
  if (!value || typeof value !== "object") return null;
  const startLine = Number(value.startLine ?? value.start?.line ?? value.line);
  const endLine = Number(value.endLine ?? value.end?.line ?? value.line ?? startLine);
  return Number.isFinite(startLine) && Number.isFinite(endLine)
    ? { startLine, endLine: Math.max(startLine, endLine) } : null;
}

function sourceRangeFromCoordinate(value) {
  return normalizeRange(value?.coordinate ?? value?.range ?? value);
}

class BudgetLedger {
  constructor(budgetBytes) {
    this.budgetBytes = Number.isFinite(budgetBytes) && budgetBytes >= 0 ? budgetBytes : BUDGETS[2];
    this.bytesUsed = 0;
    this.actions = [];
    this.backendBytes = 0;
  }

  get remaining() {
    return Math.max(0, this.budgetBytes - this.bytesUsed);
  }

  scan(bytes) {
    this.backendBytes += Number.isFinite(bytes) ? bytes : 0;
  }

  deliver(kind, displayPath, bytes, metadata = {}) {
    const raw = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes ?? ""), "utf8");
    const available = Math.min(raw.byteLength, this.remaining);
    const delivered = utf8Prefix(raw, available);
    this.bytesUsed += delivered.byteLength;
    const action = {
      kind,
      path: posix(displayPath),
      bytes: delivered.byteLength,
      requestedBytes: raw.byteLength,
      truncated: delivered.byteLength < raw.byteLength,
      ...metadata
    };
    this.actions.push(action);
    return { bytes: delivered, action };
  }

  event(kind, displayPath = ".", metadata = {}) {
    const action = { kind, path: posix(displayPath), bytes: 0, ...metadata };
    this.actions.push(action);
    return action;
  }
}

async function readVisible(root, relativePath, ledger, kind, metadata = {}) {
  const absolutePath = await resolveContainedFile(root, relativePath);
  const raw = await readFile(absolutePath);
  const delivered = ledger.deliver(kind, relativePath, raw, metadata);
  return { absolutePath, raw, text: delivered.bytes.toString("utf8"), action: delivered.action };
}

async function readMapVisible(mapRoot, relativePath, ledger, kind) {
  return readVisible(mapRoot, relativePath, ledger, kind);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readRaw(root, relativePath) {
  return readFile(await resolveContainedFile(root, relativePath));
}

function descriptorFromIndex(text) {
  const lines = text.split("\n").map(line => line.endsWith("\r") ? line.slice(0, -1) : line);
  const markerLines = lines.filter(line => line.includes("blueprint:portable-root-descriptor"));
  if (markerLines.length !== 1) return null;
  const marker = markerLines[0];
  const prefix = "<!-- blueprint:portable-root-descriptor ";
  if (marker !== marker.trim() || !marker.startsWith(prefix) || !marker.endsWith(" -->")) return null;
  try {
    const value = JSON.parse(marker.slice(prefix.length, -4));
    if (!value || value.version !== 1 || typeof value.generationId !== "string" ||
        !value.manifest || !value.entry || typeof value.manifest.path !== "string" ||
        typeof value.entry.path !== "string" || typeof value.manifest.sha256 !== "string" ||
        typeof value.entry.sha256 !== "string") return null;
    const generationPrefix = `generations/${value.generationId}/`;
    if (value.manifest.path !== `${generationPrefix}manifest.json` || value.entry.path !== `${generationPrefix}ENTRY.md`) return null;
    assertSafeRelative(value.manifest.path);
    assertSafeRelative(value.entry.path);
    if (!/^[a-f0-9]{64}$/u.test(value.manifest.sha256) || !/^[a-f0-9]{64}$/u.test(value.entry.sha256)) return null;
    return value;
  } catch {
    return null;
  }
}

function manifestPageMap(manifest) {
  const pages = new Map();
  for (const page of asArray(manifest?.checksums?.pages)) {
    if (!page || typeof page.path !== "string" || typeof page.checksum !== "string") continue;
    pages.set(page.path, page.checksum);
  }
  return pages;
}

function verifySealedPage(state, relativePath, raw) {
  const expected = state.pages?.get(relativePath);
  if (!expected || sha256(raw) !== expected) throw new PortableEvaluationError("tampered-map-page");
}

/** Validate the source-owned sealed descriptor without selecting an orphan generation. */
async function portableBundleState(mapRoot, ledger) {
  let index;
  try {
    index = await readMapVisible(mapRoot, "INDEX.md", ledger, "map-index-read");
  } catch (error) {
    throw new PortableEvaluationError(error?.reason ?? "missing-map-index");
  }
  const descriptor = descriptorFromIndex(index.text);
  if (!descriptor || index.action.truncated) throw new PortableEvaluationError("malformed-map-descriptor");
  let manifestBytes;
  let entryBytes;
  try {
    manifestBytes = await readRaw(mapRoot, descriptor.manifest.path);
    entryBytes = await readRaw(mapRoot, descriptor.entry.path);
  } catch (error) {
    throw new PortableEvaluationError(error?.reason ?? "missing-map-seal");
  }
  ledger.scan(manifestBytes.byteLength + entryBytes.byteLength);
  if (sha256(manifestBytes) !== descriptor.manifest.sha256 || sha256(entryBytes) !== descriptor.entry.sha256) {
    throw new PortableEvaluationError("tampered-map-seal");
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    throw new PortableEvaluationError("malformed-map-manifest");
  }
  if (!manifest || manifest.formatVersion !== 1 || manifest.protocolVersion !== 1 ||
      manifest.generationId !== descriptor.generationId || !Array.isArray(manifest.inventoryShards) ||
      !manifest.checksums || manifest.checksums.entry !== descriptor.entry.sha256 ||
      !Array.isArray(manifest.checksums.pages)) {
    throw new PortableEvaluationError("incomplete-map-manifest");
  }
  const pages = manifestPageMap(manifest);
  const generationPrefix = `generations/${descriptor.generationId}/`;
  const shards = [];
  for (const shard of manifest.inventoryShards) {
    if (!shard || typeof shard.path !== "string" || typeof shard.shardId !== "string" ||
        typeof shard.recordKind !== "string" || typeof shard.checksum !== "string" ||
        !shard.path.startsWith(`${generationPrefix}data/`) || !/^[a-f0-9]{64}$/u.test(shard.checksum) ||
        pages.get(shard.path) !== shard.checksum) throw new PortableEvaluationError("incomplete-map-inventory");
    assertSafeRelative(shard.path);
    try { await resolveContainedFile(mapRoot, shard.path); } catch { throw new PortableEvaluationError("missing-map-inventory"); }
    shards.push(shard);
  }
  const generationPages = [...pages.keys()].filter(page => page.startsWith(generationPrefix));
  if (generationPages.some(page => { try { assertSafeRelative(page); return false; } catch { return true; } })) {
    throw new PortableEvaluationError("unsafe-map-page");
  }
  return { descriptor, manifest, pages, generationPrefix, shards, legacy: false };
}

async function checkCandidateFreshness(repositoryRoot, mapState, candidates, ledger) {
  const paths = [...new Set(candidates.map((candidate) => candidate.path).filter(Boolean))];
  const stalePaths = [];
  for (const relativePath of paths) {
    const expected = await mapState.fileHash(relativePath, ledger);
    if (!expected) {
      stalePaths.push(relativePath);
      continue;
    }
    try {
      const raw = await readRaw(repositoryRoot, relativePath);
      ledger.scan(raw.byteLength);
      if (sha256(raw) !== expected) stalePaths.push(relativePath);
    } catch {
      stalePaths.push(relativePath);
    }
  }
  return { status: stalePaths.length > 0 ? "stale" : "fresh", stalePaths };
}

async function readSourceVisible(repositoryRoot, candidate, ledger, kind = "source-read") {
  const relativePath = candidate.path;
  let absolutePath;
  try {
    absolutePath = await resolveContainedFile(repositoryRoot, relativePath);
  } catch (error) {
    if (error instanceof PortableEvaluationError) {
      // Keep rejected traversal attempts out of the recorded path namespace.
      ledger.event("source-read-rejected", ".", { reason: error.reason });
      return null;
    }
    throw error;
  }
  const raw = await readFile(absolutePath);
  const source = raw.toString("utf8");
  const requested = normalizeRange(candidate.range);
  // Keep the source's original line separators so delivered bytes are the
  // bytes that a bounded source read would actually return.
  const lines = source.split(/(?<=\n)/u);
  const startLine = requested ? Math.max(1, requested.startLine) : 1;
  const endLine = requested ? Math.min(lines.length, requested.endLine) : lines.length;
  const selected = lines.slice(startLine - 1, endLine).join("");
  const delivered = ledger.deliver(kind, relativePath, Buffer.from(selected, "utf8"), {
    role: candidate.role,
    symbol: candidate.symbol,
    requestedRange: requested ?? null
  });
  const deliveredText = delivered.bytes.toString("utf8");
  const actualRange = deliveredText.length > 0 ? lineBounds(deliveredText, startLine) : null;
  const completeRange = completeLineRange(deliveredText, startLine, requested, delivered.action.truncated);
  Object.assign(delivered.action, { range: actualRange, completeRange });
  return {
    path: relativePath,
    text: deliveredText,
    range: actualRange,
    completeRange,
    action: delivered.action,
    rawBytes: raw.byteLength
  };
}

function queryTerm(query) {
  return String(query.searchTerm ?? query.term ?? query.text ?? query.intent ?? "").trim();
}

function queryTokens(query) {
  const rawTerm = queryTerm(query);
  const tokens = rawTerm.split(/[^a-zA-Z0-9_$./-]+/u).map((token) => token.trim()).filter(Boolean).map(lower);
  for (const token of [...rawTerm.split(/[^a-zA-Z0-9_$./-]+/u).map((value) => value.trim()).filter(Boolean)]) {
    const camelParts = token.replace(/([a-z])([A-Z])/g, "$1 $2").split(/\s+/u).filter(Boolean).map(lower);
    if (camelParts.length > 1) tokens.push(...camelParts);
  }
  return [...new Set(tokens)];
}

function semanticQueryTokens(query) {
  return [...new Set(queryTerm(query).split(/[^a-zA-Z0-9_$./-]+/u).map((token) =>
    token.replace(/([a-z])([A-Z])/g, "$1 $2").split(/\s+/u).filter(Boolean).map(lower)
  ).flat())];
}

function candidateScore(pathName, content, query) {
  const haystack = `${lower(pathName)}\n${lower(content)}`;
  const tokens = queryTokens(query);
  const exact = lower(pathName) === lower(queryTerm(query));
  const hits = tokens.reduce((count, token) => count + (haystack.includes(token) ? 1 : 0), 0);
  return (exact ? 100 : 0) + hits;
}

function sortCandidates(candidates) {
  return candidates
    .filter((candidate) => candidate?.path)
    .sort((left, right) => Number(right.score ?? 0) - Number(left.score ?? 0) ||
      String(left.path).localeCompare(String(right.path), "en") ||
      String(left.symbol ?? "").localeCompare(String(right.symbol ?? ""), "en"));
}

function candidatesFromSearchOutput(candidates, ledger, pathName = ".search") {
  const encodedLines = candidates.map((candidate) => [candidate.path, candidate.symbol ?? "", candidate.score ?? 0].join(" | "));
  const encoded = Buffer.from(encodedLines.join("\n"), "utf8");
  const delivered = ledger.deliver("search-output", pathName, encoded, { candidateCount: candidates.length });
  const text = delivered.bytes.toString("utf8");
  const lines = text.length === 0 ? [] : text.split("\n");
  // A partial final line was never delivered as a complete candidate hit.
  const count = text.length === 0 ? 0 : delivered.action.truncated
    ? (text.endsWith("\n") ? lines.length - 1 : Math.max(0, lines.length - 1))
    : lines.filter((line) => line.length > 0).length;
  return candidates.slice(0, count);
}

async function lexicalCandidates(repositoryRoot, query, ledger) {
  const files = await discoverFiles(repositoryRoot);
  const matches = [];
  for (const relativePath of files) {
    let raw;
    try {
      raw = await readFile(await resolveContainedFile(repositoryRoot, relativePath));
    } catch {
      continue;
    }
    ledger.scan(raw.byteLength);
    const text = raw.toString("utf8");
    if (candidateScore(relativePath, text, query) > 0) {
      matches.push({ path: relativePath, score: candidateScore(relativePath, text, query) });
    }
  }
  return sortCandidates(candidatesFromSearchOutput(sortCandidates(matches), ledger, ".lexical-search"));
}

async function readCandidates(repositoryRoot, candidates, ledger, kind = "source-read") {
  const readPaths = new Set();
  let rejectedCount = 0;
  let readCount = 0;
  for (const candidate of candidates) {
    const key = `${candidate.path}|${JSON.stringify(normalizeRange(candidate.range))}`;
    if (readPaths.has(key)) continue;
    readPaths.add(key);
    const result = await readSourceVisible(repositoryRoot, candidate, ledger, kind);
    if (result) readCount += 1;
    else rejectedCount += 1;
    if (result && result.action.bytes === 0 && ledger.remaining === 0) break;
  }
  return { rejectedCount, readCount };
}

async function lexicalRoute(repositoryRoot, query, ledger, sourceKind = "source-read") {
  const candidates = await lexicalCandidates(repositoryRoot, query, ledger);
  await readCandidates(repositoryRoot, candidates, ledger, sourceKind);
  return { candidateCount: candidates.length };
}

function findPathReferences(text) {
  const paths = new Set();
  const pattern = /(?:^|[`\s(\[])([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+\.[A-Za-z0-9_-]+)(?=[`\s)\],:;]|$)/g;
  for (const match of text.matchAll(pattern)) {
    if (match[1]) paths.add(match[1]);
  }
  return [...paths];
}

async function compatibilityRoot(mapRoot) {
  const direct = [];
  for (const view of COMPATIBILITY_VIEWS) {
    try {
      await resolveContainedFile(mapRoot, view);
      direct.push(view);
    } catch {
      // Try the generated compatibility directory below.
    }
  }
  return direct;
}

async function compatibilityRoute(repositoryRoot, mapRoot, query, ledger) {
  let rootEntries = [];
  try { rootEntries = await readdir(mapRoot, { withFileTypes: true }); } catch { throw new PortableEvaluationError("missing-map"); }
  const directViews = await compatibilityRoot(mapRoot);
  const hasPortableState = rootEntries.some(entry => entry.isFile() && entry.name === "INDEX.md") ||
    rootEntries.some(entry => entry.isDirectory() && entry.name === "generations") ||
    rootEntries.some(entry => entry.isFile() && ["structural.json", "semantic.json"].includes(entry.name));
  const directOnly = directViews.length > 0 && !hasPortableState;
  const state = directOnly ? { legacy: true, directOnly: true, pages: new Map() } : await mapState(mapRoot, ledger);
  const candidates = [];
  const mapPaths = state.legacy
    ? (directOnly ? directViews : await compatibilityRoot(mapRoot))
    : [...state.pages.keys()].filter(page => /\/compatibility\/(?:ARCHITECTURE|CONCERNS|CONVENTIONS|INTEGRATIONS|STACK|STRUCTURE|TESTING)\.md$/u.test(`/${page}`)).sort((a, b) => a.localeCompare(b, "en"));
  for (const mapPath of mapPaths) {
    let page;
    try {
      if (state.legacy) page = await readMapVisible(mapRoot, mapPath, ledger, "compatibility-view-read");
      else {
        const raw = await readRaw(mapRoot, mapPath);
        verifySealedPage(state, mapPath, raw);
        ledger.scan(raw.byteLength);
        const text = raw.toString("utf8");
        const pageMatches = candidateScore(mapPath, text, query) > 0;
        if (!pageMatches && queryTokens(query).length > 0) continue;
        const delivered = ledger.deliver("compatibility-view-read", mapPath, raw);
        if (delivered.action.truncated) continue;
        page = { text: delivered.bytes.toString("utf8"), raw: delivered.bytes, action: delivered.action };
      }
    } catch {
      ledger.event("map-read-rejected", mapPath, { reason: "missing-view" });
      continue;
    }
    if (!state.legacy && queryTokens(query).length > 0 && candidateScore(mapPath, page.text, query) === 0) continue;
    ledger.scan(page.raw.byteLength);
    const pageMatches = candidateScore(mapPath, page.text, query) > 0;
    if (!pageMatches && queryTokens(query).length > 0) continue;
    for (const sourcePath of findPathReferences(page.text)) {
      candidates.push({ path: sourcePath, score: candidateScore(sourcePath, page.text, query) });
    }
  }
  const selected = candidatesFromSearchOutput(sortCandidates(candidates), ledger, ".compatibility-search");
  if (!directOnly) {
    const freshness = await checkCandidateFreshness(repositoryRoot, state, selected, ledger);
    if (freshness.status === "stale") return { candidateCount: 0, fallbackReason: "stale-map", stalePaths: freshness.stalePaths };
  }
  const reads = await readCandidates(repositoryRoot, selected, ledger, "source-read");
  return reads.rejectedCount > 0
    ? { candidateCount: 0, fallbackReason: "missing-source", viewCount: mapPaths.length }
    : { candidateCount: selected.length, viewCount: mapPaths.length };
}

function normalizeStructuralRecord(record) {
  const pathName = record.path ?? record.filePath;
  if (!pathName) return null;
  return {
    path: pathName,
    symbol: record.qualifiedName ?? record.name ?? record.symbol,
    range: sourceRangeFromCoordinate(record),
    contentHash: record.contentHash ?? null,
    scoreText: JSON.stringify(record)
  };
}

async function loadJsonMap(mapRoot, relativePath, ledger, kind) {
  try {
    const file = await readMapVisible(mapRoot, relativePath, ledger, kind);
    if (file.action.truncated) return null;
    try {
      return JSON.parse(file.text);
    } catch {
      ledger.event("map-parse-failed", relativePath, { reason: "truncated-or-invalid" });
      return null;
    }
  } catch (error) {
    if (error instanceof PortableEvaluationError) ledger.event("map-read-rejected", relativePath, { reason: error.reason });
    return null;
  }
}

async function readScannedJson(mapRoot, relativePath, ledger, reason = "map-scan") {
  try {
    const raw = await readRaw(mapRoot, relativePath);
    ledger.scan(raw.byteLength);
    return JSON.parse(raw.toString("utf8"));
  } catch {
    ledger.event("map-scan-rejected", relativePath, { reason });
    return null;
  }
}

async function legacyMapState(mapRoot, ledger) {
  const hashes = await loadJsonMap(mapRoot, "sourceHashes.json", ledger, "map-index-read");
  const sourceHashes = hashes && typeof hashes === "object" ? hashes : {};
  const fileCache = new Map();
  return {
    legacy: true,
    fileHash: async (relativePath) => {
      if (fileCache.has(relativePath)) return fileCache.get(relativePath);
      const value = typeof sourceHashes[relativePath] === "string" ? sourceHashes[relativePath] : null;
      fileCache.set(relativePath, value);
      return value;
    },
    pages: new Map()
  };
}

async function mapState(mapRoot, ledger) {
  let entries = [];
  try { entries = await readdir(mapRoot, { withFileTypes: true }); } catch { throw new PortableEvaluationError("missing-map"); }
  const hasGenerationDirectory = entries.some(entry => entry.isDirectory() && entry.name === "generations");
  if (!hasGenerationDirectory && entries.some(entry => entry.isFile() && ["structural.json", "semantic.json"].includes(entry.name))) {
    return legacyMapState(mapRoot, ledger);
  }
  const state = await portableBundleState(mapRoot, ledger);
  const fileCache = new Map();
  state.fileHash = async (relativePath) => {
    if (fileCache.has(relativePath)) return fileCache.get(relativePath);
    const fileShards = state.shards.filter(shard => shard.recordKind === "files").sort((a, b) => a.path.localeCompare(b.path, "en"));
    let value = null;
    for (const shard of fileShards) {
      let raw;
      try { raw = await readRaw(mapRoot, shard.path); } catch { throw new PortableEvaluationError("missing-map-inventory"); }
      ledger.scan(raw.byteLength);
      verifySealedPage(state, shard.path, raw);
      let document;
      try { document = JSON.parse(raw.toString("utf8")); } catch { document = null; }
      if (!document) continue;
      const record = asArray(document.records).find(item => item?.path === relativePath);
      if (record) { value = typeof record.contentHash === "string" ? record.contentHash : null; break; }
    }
    fileCache.set(relativePath, value);
    return value;
  };
  const symbolCache = new Map();
  state.symbolById = async (symbolId) => {
    if (symbolCache.has(symbolId)) return symbolCache.get(symbolId);
    let value = null;
    for (const shard of state.shards.filter(item => item.recordKind === "symbols").sort((a, b) => a.path.localeCompare(b.path, "en"))) {
      const raw = await readRaw(mapRoot, shard.path);
      ledger.scan(raw.byteLength);
      verifySealedPage(state, shard.path, raw);
      let document;
      try { document = JSON.parse(raw.toString("utf8")); } catch { continue; }
      value = asArray(document.records).find(item => item?.id === symbolId) ?? null;
      if (value) break;
    }
    symbolCache.set(symbolId, value);
    return value;
  };
  return state;
}

async function structuralRecords(mapRoot, ledger) {
  const custom = await loadJsonMap(mapRoot, "structural.json", ledger, "structural-record-read");
  if (custom) return [...asArray(custom.files), ...asArray(custom.symbols)].map(normalizeStructuralRecord).filter(Boolean);
  return [];
}

function searchLineCandidates(text, surface) {
  const records = [];
  for (const line of text.split(/\r?\n/)) {
    if (surface === "symbols") {
      const match = line.match(/^symbol \| (.*?) \| (.*?) \| .*?source: ([^:|]+):(\d+)(?:-(\d+))?/u);
      if (match) records.push({path: match[3], symbol: match[1], range: {startLine: Number(match[4]), endLine: Number(match[5] ?? match[4])}, scoreText: line});
    } else {
      const match = line.match(/^file \| (.*?) \| .*?source: ([^:|]+)(?::(\d+)(?:-(\d+))?)?/u);
      if (match) records.push({path: match[2], symbol: null, range: match[3] ? {startLine: Number(match[3]), endLine: Number(match[4] ?? match[3])} : null, scoreText: line});
    }
  }
  return records;
}

async function portableSearchCandidates(mapRoot, state, query, ledger, surface) {
  const pattern = surface === "symbols" ? /\/search\/symbols-\d+\.md$/u : /\/search\/files-\d+\.md$/u;
  const pages = [...state.pages.keys()].filter(page => pattern.test(`/${page}`)).sort((a, b) => a.localeCompare(b, "en"));
  const tokens = queryTokens(query);
  for (const page of pages) {
    let raw;
    try { raw = await readRaw(mapRoot, page); } catch { throw new PortableEvaluationError("missing-map-search"); }
    verifySealedPage(state, page, raw);
    ledger.scan(raw.byteLength);
    const text = raw.toString("utf8");
    const candidates = searchLineCandidates(text, surface).filter(candidate => {
      const haystack = lower(`${candidate.path} ${candidate.symbol ?? ""} ${candidate.scoreText}`);
      return tokens.length === 0 || tokens.some(token => haystack.includes(token));
    });
    if (candidates.length === 0) continue;
    const delivered = ledger.deliver("map-search-page-read", page, raw);
    if (delivered.action.truncated) return [];
    const selected = searchLineCandidates(delivered.bytes.toString("utf8"), surface).filter(candidate => {
      const haystack = lower(`${candidate.path} ${candidate.symbol ?? ""} ${candidate.scoreText}`);
      return tokens.length === 0 || tokens.some(token => haystack.includes(token));
    });
    return selected;
  }
  return [];
}

async function structuralRoute(repositoryRoot, mapRoot, query, ledger) {
  const state = await mapState(mapRoot, ledger);
  let records;
  if (state.legacy) records = await structuralRecords(mapRoot, ledger);
  else {
    records = await portableSearchCandidates(mapRoot, state, query, ledger, "symbols");
    if (records.length === 0) records = await portableSearchCandidates(mapRoot, state, query, ledger, "files");
  }
  const term = lower(queryTerm(query));
  const candidates = records
    .filter((record) => lower(`${record.path} ${record.symbol ?? ""} ${record.scoreText}`).includes(term) || queryTokens(query).some((token) => lower(`${record.path} ${record.symbol ?? ""}`).includes(token)))
    .map((record) => ({ ...record, score: candidateScore(record.path, record.scoreText, query) + (record.symbol ? 2 : 0) }));
  const selected = candidatesFromSearchOutput(sortCandidates(candidates), ledger, ".structural-search");
  const freshness = await checkCandidateFreshness(repositoryRoot, state, selected, ledger);
  if (freshness.status === "stale") return { candidateCount: 0, fallbackReason: "stale-map", stalePaths: freshness.stalePaths, semanticCapabilitiesConsumed: false };
  const reads = await readCandidates(repositoryRoot, selected, ledger, "source-read");
  return reads.rejectedCount > 0
    ? { candidateCount: 0, fallbackReason: "missing-source", semanticCapabilitiesConsumed: false }
    : { candidateCount: selected.length, semanticCapabilitiesConsumed: false };
}

function normalizeSemanticRecord(record) {
  const payload = record.record ?? record;
  const evidence = asArray(payload.evidence).map((item) => ({
    path: item.path,
    range: sourceRangeFromCoordinate(item),
    symbol: item.symbol ?? item.qualifiedName,
    contentHash: item.contentHash ?? null,
    role: item.role ?? "semantic evidence",
    kind: item.kind ?? null
  })).filter((item) => item.path);
  return {
    id: payload.id ?? record.recordId,
    name: payload.name ?? payload.statement ?? payload.id ?? record.recordId,
    aliases: typeof payload.alias === "string" ? [payload.alias] : asArray(payload.aliases),
    summary: payload.summary ?? payload.statement ?? "",
    targetKind: payload.targetKind ?? null,
    targetId: payload.targetId ?? null,
    claimIds: asArray(payload.claimIds),
    kind: record.kind ?? null,
    evidenceStart: Number(record.evidenceStart ?? 0),
    partIndex: Number(record.partIndex ?? 0),
    partCount: Number(record.partCount ?? 1),
    continuation: record.continuation ?? { previous: null, next: null },
    evidence
  };
}

async function semanticRecords(mapRoot, ledger) {
  const custom = await loadJsonMap(mapRoot, "semantic.json", ledger, "semantic-record-read");
  if (custom) return asArray(custom.entries ?? custom.records).map(normalizeSemanticRecord);
  return [];
}

async function portableSemanticRecords(mapRoot, state, query, ledger) {
  const pages = [...state.pages.keys()].filter(page => /\/data\/semantic-\d+\.json$/u.test(`/${page}`)).sort((a, b) => a.localeCompare(b, "en"));
  const tokens = semanticQueryTokens(query);
  const pageCache = new Map();
  const recordIndex = new Map();
  const keyOf = record => `${record.kind}\u0000${record.id}`;
  const loadPage = async (page, deliver = false) => {
    let cached = pageCache.get(page);
    if (!cached) {
      let raw;
      try { raw = await readRaw(mapRoot, page); } catch { throw new PortableEvaluationError("missing-map-semantic"); }
      verifySealedPage(state, page, raw);
      ledger.scan(raw.byteLength);
      let document;
      try { document = JSON.parse(raw.toString("utf8")); } catch { throw new PortableEvaluationError("malformed-map-semantic"); }
      const records = asArray(document.records).map(normalizeSemanticRecord);
      cached = {raw, records, delivered: false, deliveryFailed: false};
      pageCache.set(page, cached);
      for (const record of records) {
        const entries = recordIndex.get(keyOf(record)) ?? [];
        entries.push({page, record});
        recordIndex.set(keyOf(record), entries);
      }
    }
    if (deliver && !cached.delivered) {
      if (cached.deliveryFailed) return null;
      const visible = ledger.deliver("semantic-record-read", page, cached.raw);
      if (visible.action.truncated) {
        cached.deliveryFailed = true;
        return null;
      }
      cached.delivered = true;
    }
    return cached;
  };
  const selected = [];
  const selectedParts = new Map();
  const addFragment = (record, targetMatched = false) => {
    const key = `${keyOf(record)}\u0000${record.partIndex}`;
    const existing = selectedParts.get(key);
    if (existing) {
      if (targetMatched) existing.targetMatched = true;
      return existing;
    }
    const selectedRecord = {...record, targetMatched: Boolean(targetMatched)};
    selected.push(selectedRecord);
    selectedParts.set(key, selectedRecord);
    return selectedRecord;
  };
  const followContinuations = async (record, targetMatched) => {
    let current = record;
    const followedPaths = new Set();
    while (current.continuation?.next && !followedPaths.has(current.continuation.next)) {
      const nextPath = current.continuation.next;
      followedPaths.add(nextPath);
      const page = await loadPage(nextPath, true);
      if (!page) return false;
      const nextPart = page.records
        .filter(candidate => keyOf(candidate) === keyOf(record))
        .sort((left, right) => left.partIndex - right.partIndex)
        .find(candidate => candidate.partIndex > current.partIndex) ?? null;
      if (!nextPart) break;
      addFragment(nextPart, targetMatched);
      current = nextPart;
    }
    return true;
  };
  const pendingTargets = [];
  const queuedTargets = new Set();
  const enqueueTarget = (kind, id) => {
    if (!kind || !id || kind === "symbol") return;
    const key = `${kind}\u0000${id}`;
    if (queuedTargets.has(key)) return;
    queuedTargets.add(key);
    pendingTargets.push(key);
  };
  const enqueueDependencies = record => {
    if (record.targetKind && record.targetId) enqueueTarget(record.targetKind, record.targetId);
    if (record.kind === "capability") for (const claimId of record.claimIds) enqueueTarget("claim", claimId);
  };
  let matchPage = null;
  for (const page of pages) {
    const loaded = await loadPage(page, false);
    const records = loaded.records;
    const matches = records.filter(record => {
      const searchText = lower(`${record.id} ${record.name} ${record.summary} ${record.aliases.join(" ")}`);
      return tokens.length === 0 || tokens.some(token => searchText.includes(token));
    });
    if (matches.length > 0) {
      matchPage = page;
      break;
    }
  }
  if (!matchPage) return [];
  if (!(await loadPage(matchPage, true))) return [];
  const matchRecords = pageCache.get(matchPage).records.filter(record => {
    const searchText = lower(`${record.id} ${record.name} ${record.summary} ${record.aliases.join(" ")}`);
    return tokens.length === 0 || tokens.some(token => searchText.includes(token));
  });
  for (const record of matchRecords) {
    addFragment(record);
    enqueueDependencies(record);
    if (!(await followContinuations(record, false))) return [];
  }
  // Expand only selected semantic dependencies. The cache lets a capability
  // discovered after an earlier page add its claim from that already-scanned
  // page without recharging or returning the page a second time.
  const expandedTargets = new Set();
  while (pendingTargets.length > 0) {
    const targetKey = pendingTargets.shift();
    if (expandedTargets.has(targetKey)) continue;
    expandedTargets.add(targetKey);
    let entries = recordIndex.get(targetKey) ?? [];
    if (entries.length === 0) {
      for (const page of pages) {
        await loadPage(page, false);
        entries = recordIndex.get(targetKey) ?? [];
        if (entries.length > 0) break;
      }
    }
    if (entries.length === 0) continue;
    const start = [...entries].sort((left, right) => left.record.partIndex - right.record.partIndex ||
      pages.indexOf(left.page) - pages.indexOf(right.page))[0];
    if (!(await loadPage(start.page, true))) return [];
    const startPageRecords = pageCache.get(start.page).records
      .filter(record => keyOf(record) === targetKey)
      .sort((left, right) => left.partIndex - right.partIndex);
    const first = startPageRecords[0] ?? start.record;
    for (const record of startPageRecords) {
      addFragment(record, true);
      enqueueDependencies(record);
    }
    if (!(await followContinuations(first, true))) return [];
  }
  const merged = new Map();
  for (const fragment of [...selected].sort((left, right) => keyOf(left).localeCompare(keyOf(right), "en") ||
    left.evidenceStart - right.evidenceStart || left.partIndex - right.partIndex)) {
    const key = `${fragment.kind}\u0000${fragment.id}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {...fragment, evidence: [...fragment.evidence]});
      continue;
    }
    current.evidence.push(...fragment.evidence);
    current.evidenceStart = Math.min(current.evidenceStart, fragment.evidenceStart);
    current.partCount = Math.max(current.partCount, fragment.partCount);
    current.targetMatched = Boolean(current.targetMatched || fragment.targetMatched);
  }
  return [...merged.values()].map(record => ({
    ...record,
    evidence: [...record.evidence]
  }));
}

async function semanticRoute(repositoryRoot, mapRoot, query, ledger) {
  const state = await mapState(mapRoot, ledger);
  const records = state.legacy ? await semanticRecords(mapRoot, ledger) : await portableSemanticRecords(mapRoot, state, query, ledger);
  const term = lower(queryTerm(query));
  const tokens = semanticQueryTokens(query);
  const candidates = [];
  for (const record of records) {
    const searchText = lower(`${record.id} ${record.name} ${record.summary} ${record.aliases.join(" ")}`);
    const matchesQuery = state.legacy
      ? tokens.every((token) => searchText.includes(token))
      : tokens.some((token) => searchText.includes(token));
    if (record.targetMatched || !term || matchesQuery) {
      if (!state.legacy && record.kind === "alias" && record.targetKind === "symbol" && state.symbolById) {
        const target = await state.symbolById(record.targetId);
        if (target?.path) candidates.push({
          path: target.path,
          range: sourceRangeFromCoordinate(target),
          symbol: target.qualifiedName,
          contentHash: target.contentHash,
          score: candidateScore(`${record.name} ${target.qualifiedName} ${target.path}`, searchText, query) + 4,
          semanticId: record.id
        });
      } else {
        for (const evidence of record.evidence) {
          candidates.push({ ...evidence, score: candidateScore(`${record.name} ${evidence.path}`, searchText, query) + 3, semanticId: record.id });
        }
      }
    }
  }
  const selected = candidatesFromSearchOutput(sortCandidates(candidates), ledger, ".semantic-search");
  const freshness = await checkCandidateFreshness(repositoryRoot, state, selected, ledger);
  if (freshness.status === "stale") return { candidateCount: 0, fallbackReason: "stale-map", stalePaths: freshness.stalePaths, semanticCapabilitiesConsumed: true };
  const reads = await readCandidates(repositoryRoot, selected, ledger, "source-read");
  return reads.rejectedCount > 0
    ? { candidateCount: 0, fallbackReason: "missing-source", semanticCapabilitiesConsumed: true }
    : { candidateCount: selected.length, semanticCapabilitiesConsumed: true };
}

async function runFallback(repositoryRoot, query, ledger, reason) {
  ledger.event("bounded-live-fallback", ".", { reason, absenceProven: false });
  const result = await lexicalRoute(repositoryRoot, query, ledger, "fallback-source-read");
  return { ...result, fallbackUsed: true, fallbackReason: reason, absenceProven: false };
}

async function runKnownTarget(repositoryRoot, query, ledger) {
  const targetPath = String(query.targetPath ?? "");
  const result = await readSourceVisible(repositoryRoot, { path: targetPath, role: "known target" }, ledger, "known-target-source-read");
  if (!result) return runFallback(repositoryRoot, query, ledger, "missing-known-target");
  return { candidateCount: 1, fallbackUsed: false, fallbackReason: null, absenceProven: false };
}

/** Execute one arm at one visible text budget. Gold is never consulted here. */
export async function runNavigation({ repositoryRoot, mapRoot, query, arm, budgetBytes = BUDGETS[2] }) {
  if (!ARM_NAMES.includes(arm)) throw new PortableEvaluationError("unknown-arm");
  const ledger = new BudgetLedger(budgetBytes);
  let route = { candidateCount: 0, fallbackUsed: false, fallbackReason: null, absenceProven: false };
  if (query?.knownTarget && query?.targetPath) {
    route = await runKnownTarget(repositoryRoot, query, ledger);
  } else if (arm === ARMS.lexical) {
    route = await lexicalRoute(repositoryRoot, query, ledger);
  } else {
    try {
      if (arm === ARMS.compatibility) route = await compatibilityRoute(repositoryRoot, mapRoot, query, ledger);
      else if (arm === ARMS.structural) route = await structuralRoute(repositoryRoot, mapRoot, query, ledger);
      else route = await semanticRoute(repositoryRoot, mapRoot, query, ledger);
      if (route.candidateCount === 0) route = await runFallback(repositoryRoot, query, ledger, route.fallbackReason ?? "no-map-candidate");
    } catch (error) {
      const reason = error instanceof PortableEvaluationError ? error.reason : "map-route-failed";
      route = await runFallback(repositoryRoot, query, ledger, reason);
    }
  }
  const sourceReads = ledger.actions.filter((action) => SOURCE_READ_KINDS.has(action.kind));
  return {
    label: "deterministic-development-evaluator",
    arm,
    budgetBytes,
    actions: ledger.actions,
    sourceReads,
    bytesUsed: ledger.bytesUsed,
    searchOutputBytes: ledger.actions.filter((action) => action.kind === "search-output").reduce((sum, action) => sum + action.bytes, 0),
    mapOutputBytes: ledger.actions.filter((action) => MAP_READ_KINDS.has(action.kind)).reduce((sum, action) => sum + action.bytes, 0),
    sourceBytes: sourceReads.reduce((sum, action) => sum + action.bytes, 0),
    backendScanBytes: ledger.backendBytes,
    budgetExhausted: ledger.remaining === 0,
    fallbackUsed: Boolean(route.fallbackUsed),
    fallbackReason: route.fallbackReason ?? null,
    absenceProven: Boolean(route.absenceProven),
    semanticCapabilitiesConsumed: Boolean(route.semanticCapabilitiesConsumed),
    queryId: query?.id ?? null,
    knownTarget: Boolean(query?.knownTarget)
  };
}

function evidenceItem(item, role) {
  if (typeof item === "string") return { path: item, role, range: null, symbol: null, negative: false };
  return {
    path: item?.path,
    role: item?.role ?? role,
    range: normalizeRange(item?.range ?? item?.coordinate ?? item?.line),
    symbol: item?.symbol ?? item?.qualifiedName ?? null,
    negative: Boolean(item?.negative)
  };
}

function evidencePlan(query) {
  const declared = query?.evidence ?? query?.gold ?? {};
  const required = asArray(declared.required ?? declared.paths).map((item) => evidenceItem(item, "required")).filter(item => !item.negative);
  const supporting = asArray(declared.supporting).map((item) => evidenceItem(item, "supporting")).filter(item => !item.negative);
  const alternatives = asArray(declared.alternatives).map((group) => asArray(group).map((item) => evidenceItem(item, "alternative")).filter(item => !item.negative)).filter(group => group.length > 0);
  const negative = Boolean(query?.negative || query?.expectedAbsent || declared.negative || declared.expectedAbsent);
  return { required, supporting, alternatives, negative };
}

function observedCompleteRange(action) {
  // Synthetic scorer fixtures predate completeRange and are already complete
  // observations; runtime reads always set completeRange explicitly.
  return Object.prototype.hasOwnProperty.call(action ?? {}, "completeRange") ? action.completeRange : action?.range;
}

function rangesIntersect(left, right) {
  if (!left || !right) return true;
  return left.startLine <= right.endLine && right.startLine <= left.endLine;
}

function rangeCovered(observedRanges, expectedRange) {
  if (!expectedRange) return observedRanges.length > 0;
  const ranges = observedRanges.filter(Boolean).sort((left, right) => left.startLine - right.startLine || left.endLine - right.endLine);
  let cursor = expectedRange.startLine;
  for (const range of ranges) {
    if (range.endLine < cursor) continue;
    if (range.startLine > cursor) return false;
    cursor = Math.max(cursor, range.endLine + 1);
    if (cursor > expectedRange.endLine) return true;
  }
  return false;
}

function mergeObservedRanges(ranges) {
  const ordered = ranges.filter(Boolean)
    .map(range => ({...range}))
    .sort((left, right) => left.startLine - right.startLine || left.endLine - right.endLine);
  const merged = [];
  for (const range of ordered) {
    const previous = merged.at(-1);
    if (previous && range.startLine <= previous.endLine + 1) {
      previous.endLine = Math.max(previous.endLine, range.endLine);
    } else {
      merged.push(range);
    }
  }
  return merged;
}

function actionOverlaps(action, item) {
  const range = observedCompleteRange(action);
  if (!item?.path || action.path !== item.path || !range || action.bytes <= 0) return false;
  // A symbol label is required when the gold item has no coordinate. When a
  // declaration coordinate is present, a complete returned source span is
  // direct observation even for lexical/known-target reads that carry no map
  // symbol metadata.
  if (item.symbol && action.symbol && action.symbol !== item.symbol) return false;
  if (item.symbol && !action.symbol && !item.range) return false;
  return rangesIntersect(range, item.range);
}

function itemCovered(sourceReads, item) {
  if (!item?.path) return false;
  const matching = sourceReads.filter(action => action.path === item.path && action.bytes > 0 && actionOverlaps(action, item));
  if (matching.length === 0) return false;
  return rangeCovered(matching.map(observedCompleteRange).filter(Boolean), item.range);
}

function uniqueActionKey(action) {
  const range = observedCompleteRange(action);
  return `${action.path}|${range?.startLine ?? ""}-${range?.endLine ?? ""}|${action.symbol ?? ""}`;
}

function fraction(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

/** Score recorded events against required/supporting/alternative evidence. */
export function scoreNavigation(navigation, query) {
  const plan = evidencePlan(query);
  const expected = [...plan.required, ...plan.supporting, ...plan.alternatives.flat()];
  const sourceReads = asArray(navigation?.actions).filter((action) => SOURCE_READ_KINDS.has(action.kind));
  const uniqueSourceReads = new Set(sourceReads.map(uniqueActionKey));
  const evidenceFilePaths = [...new Set(expected.map((item) => item.path).filter(Boolean))];
  const symbolEvidence = [...plan.required, ...plan.supporting, ...plan.alternatives.flat()].filter((item) => item.range || item.symbol);
  const allActions = asArray(navigation?.actions);
  const prefixState = (sourceLimit) => {
    const prefix = sourceReads.slice(0, sourceLimit);
    const matched = expected.filter(item => itemCovered(prefix, item));
    const requiredEvidence = plan.required.filter(item => matched.includes(item));
    const supportingEvidence = plan.supporting.filter(item => matched.includes(item));
    const alternativeEvidence = plan.alternatives.find(group => group.every(item => matched.includes(item))) ?? [];
    const sufficient = requiredEvidence.length === plan.required.length && plan.required.length > 0 || alternativeEvidence.length > 0;
    return { prefix, matched, requiredEvidence, supportingEvidence, alternativeEvidence, sufficient };
  };
  let firstUseful = null;
  for (let index = 0; index < sourceReads.length; index += 1) {
    if (expected.some(item => actionOverlaps(sourceReads[index], item))) {
      firstUseful = { action: sourceReads[index], actionIndex: index };
      break;
    }
  }
  let sufficientIndex = null;
  let sufficientState = prefixState(0);
  for (let index = 1; index <= sourceReads.length; index += 1) {
    const state = prefixState(index);
    if (state.sufficient) { sufficientIndex = index - 1; sufficientState = state; break; }
  }
  const finalState = prefixState(sourceReads.length);
  const retained = [];
  for (const item of expected) {
    if (!finalState.matched.includes(item)) continue;
    const matchingActions = sourceReads.filter(candidate => actionOverlaps(candidate, item));
    const action = matchingActions[0];
    const ranges = mergeObservedRanges(matchingActions.map(observedCompleteRange));
    const symbols = [...new Set(matchingActions.map(candidate => candidate.symbol).filter(Boolean))];
    retained.push({
      path: item.path,
      range: ranges.length === 1 ? ranges[0] : null,
      ranges,
      symbol: symbols[0] ?? null,
      symbols,
      role: item.role,
      actionIndex: action ? sourceReads.indexOf(action) : null,
      bytes: matchingActions.reduce((sum, candidate) => sum + Number(candidate.bytes ?? 0), 0)
    });
  }
  const pathHit = (limit) => sourceReads.slice(0, limit).some(action => action.bytes > 0 && evidenceFilePaths.includes(action.path));
  const hit = (limit, mode) => sourceReads.slice(0, limit).some(action => expected.some(item => {
    if (mode === "symbol" && !item.symbol) return false;
    return actionOverlaps(action, item);
  }));
  const bytesThrough = (sourceIndex) => {
    if (sourceIndex === null || sourceIndex === undefined) return null;
    const actionPosition = allActions.indexOf(sourceReads[sourceIndex]);
    return allActions.slice(0, actionPosition + 1).reduce((sum, action) => sum + Number(action.bytes ?? 0), 0);
  };
  return {
    requiredEvidence: finalState.requiredEvidence,
    supportingEvidence: finalState.supportingEvidence,
    alternativeEvidence: finalState.alternativeEvidence,
    sufficientContext: finalState.sufficient || (plan.negative && Boolean(navigation?.absenceProven)),
    firstUsefulSourceRead: firstUseful ? {
      path: firstUseful.action.path,
      range: observedCompleteRange(firstUseful.action),
      actionIndex: firstUseful.actionIndex
    } : null,
    fileHitAt: { 1: evidenceFilePaths.length > 0 ? pathHit(1) : null, 3: evidenceFilePaths.length > 0 ? pathHit(3) : null, 5: evidenceFilePaths.length > 0 ? pathHit(5) : null },
    symbolHitAt: { 1: symbolEvidence.length > 0 ? hit(1, "symbol") : null, 3: symbolEvidence.length > 0 ? hit(3, "symbol") : null, 5: symbolEvidence.length > 0 ? hit(5, "symbol") : null },
    actionsToUseful: firstUseful ? allActions.indexOf(firstUseful.action) + 1 : null,
    bytesToUseful: bytesThrough(firstUseful ? sourceReads.indexOf(firstUseful.action) : null),
    actionsToSufficient: sufficientIndex === null ? null : allActions.indexOf(sourceReads[sufficientIndex]) + 1,
    bytesToSufficient: bytesThrough(sufficientIndex),
    precision: expected.length > 0 ? fraction(new Set(sourceReads.filter(action => expected.some(item => actionOverlaps(action, item))).map(uniqueActionKey)).size, uniqueSourceReads.size) : null,
    recall: expected.length > 0 ? fraction(finalState.matched.length, expected.length) : null,
    requiredRecall: plan.required.length > 0 ? fraction(finalState.requiredEvidence.length, plan.required.length) : null,
    supportingRecall: plan.supporting.length > 0 ? fraction(finalState.supportingEvidence.length, plan.supporting.length) : null,
    redundancy: sourceReads.length > 0 ? fraction(sourceReads.length - uniqueSourceReads.size, sourceReads.length) : null,
    retainedEvidence: retained,
    actions: allActions.length,
    bytes: Number(navigation?.bytesUsed ?? allActions.reduce((sum, action) => sum + Number(action.bytes ?? 0), 0)),
    tokens: null,
    tokenizer: "unavailable",
    bytesAreTokens: false,
    expectedEvidenceAvailable: expected.length > 0,
    absenceProven: Boolean(navigation?.absenceProven),
    limitations: ["deterministic fixture measurement only", "bytes are not tokens", "no hosted-agent quality or savings claim"]
  };
}

export async function evaluateQuery({ repositoryRoot, mapRoot, query, budgets = BUDGETS, arms = ARM_NAMES }) {
  const results = [];
  for (const arm of arms) {
    for (const budgetBytes of budgets) {
      const navigation = await runNavigation({ repositoryRoot, mapRoot, query, arm, budgetBytes });
      results.push({ navigation, score: scoreNavigation(navigation, query) });
    }
  }
  return { queryId: query?.id ?? null, results, label: "deterministic-development-evaluator" };
}

export async function evaluateQueries(options) {
  const queries = asArray(options?.queries);
  const reports = [];
  for (const query of queries) reports.push(await evaluateQuery({ ...options, query }));
  return { label: "deterministic-development-evaluator", hostedPerformanceEvidence: false, reports };
}

// Descriptive aliases keep the public surface convenient for focused tests and
// later adapter lanes without adding another route implementation.
export const runEvaluator = runNavigation;
export const scoreEvidence = scoreNavigation;

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(args) {
  if (args.includes("--help") || args.length === 0) {
    process.stdout.write("Usage: node scripts/portable-map-evaluation.mjs --root REPOSITORY --map MAP_ROOT --queries QUERY_JSON [--arm ARM] [--budget BYTES]\n");
    return;
  }
  const repositoryRoot = path.resolve(argumentValue(args, "--root") ?? ".");
  const mapRoot = path.resolve(argumentValue(args, "--map") ?? path.join(repositoryRoot, ".blueprint", "codebase"));
  const queryPath = argumentValue(args, "--queries");
  if (!queryPath) throw new Error("--queries is required");
  const queryDocument = JSON.parse(await readFile(path.resolve(queryPath), "utf8"));
  const arm = argumentValue(args, "--arm");
  const budget = argumentValue(args, "--budget");
  const report = await evaluateQueries({
    repositoryRoot,
    mapRoot,
    queries: asArray(queryDocument.queries ?? queryDocument),
    arms: arm ? [arm] : ARM_NAMES,
    budgets: budget ? [Number(budget)] : BUDGETS
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
