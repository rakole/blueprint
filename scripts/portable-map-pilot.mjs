import {cp, lstat, mkdir, readFile, readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
export const fixtureRoot = path.resolve(scriptDirectory, "../tests/fixtures/portable-map-pilot");
export const repositoryFixture = path.join(fixtureRoot, "repository");
export const bundleFixture = path.join(fixtureRoot, "bundle");
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".sql"]);

function posix(value) {
  return value.split(path.sep).join("/");
}

function relativePath(root, absolutePath) {
  return posix(path.relative(root, absolutePath));
}

const sourceReadKinds = new Set(["known-target-read", "known-target-source-read", "useful-source-read"]);
const mapReadKinds = new Set([
  "index-read", "map-route-read", "search-shard-read", "record-read", "capability-route-read",
  "capability-read", "freshness-manifest-read", "freshness-source-read"
]);

class PortableMapNavigationError extends Error {
  constructor(reason = "malformed-map") {
    super(reason);
    this.name = "PortableMapNavigationError";
    this.reason = reason;
  }
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function assertSafeRelative(relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || relativePath.includes("\0") || relativePath.includes("\\") || path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
    throw new PortableMapNavigationError();
  }
  const segments = relativePath.split("/");
  if (segments.some(segment => segment === "" || segment === "." || segment === "..")) {
    throw new PortableMapNavigationError();
  }
}

/** Resolve only a regular file whose every ancestor is inside the pinned root. */
async function resolveContainedFile(root, relativePath) {
  assertSafeRelative(relativePath);
  const absoluteRoot = path.resolve(root);
  try {
    if ((await lstat(absoluteRoot)).isSymbolicLink()) throw new PortableMapNavigationError();
  } catch (error) {
    if (error instanceof PortableMapNavigationError) throw error;
    throw new PortableMapNavigationError("unreadable-source");
  }
  const absolutePath = path.resolve(absoluteRoot, relativePath);
  if (!isContained(absoluteRoot, absolutePath)) throw new PortableMapNavigationError();

  let current = absoluteRoot;
  for (const segment of relativePath.split("/")) {
    current = path.join(current, segment);
    let stats;
    try {
      stats = await lstat(current);
    } catch (error) {
      throw new PortableMapNavigationError(error?.code === "ENOENT" ? "missing-source" : "unreadable-source");
    }
    if (stats.isSymbolicLink()) throw new PortableMapNavigationError();
    if (current !== absolutePath && !stats.isDirectory()) throw new PortableMapNavigationError();
    if (current === absolutePath && !stats.isFile()) throw new PortableMapNavigationError("unreadable-source");
  }
  return absolutePath;
}

async function readContainedFile(root, relativePath, displayPath, actions, kind, metadata = {}) {
  const absolutePath = await resolveContainedFile(root, relativePath);
  const contents = await readTracked(absolutePath, displayPath, actions, kind, metadata);
  return {absolutePath, contents};
}

function actionByteTotals(actions) {
  const bytesRead = actions.reduce((total, action) => total + (action.bytes ?? 0), 0);
  const sourceBytesRead = actions
    .filter(action => sourceReadKinds.has(action.kind))
    .reduce((total, action) => total + (action.bytes ?? 0), 0);
  const searchBytesRead = actions
    .filter(action => !sourceReadKinds.has(action.kind))
    .reduce((total, action) => total + (action.bytes ?? 0), 0);
  return {bytesRead, sourceBytesRead, searchBytesRead};
}

async function copyTree(source, destination) {
  await mkdir(destination, {recursive: true});
  for (const entry of await readdir(source, {withFileTypes: true})) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyTree(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      await cp(sourcePath, destinationPath);
    }
  }
}

async function ensureEmptyDirectory(directory) {
  try {
    const entries = await readdir(directory);
    if (entries.length > 0) {
      throw new Error(`Refusing to materialize into a non-empty directory: ${directory}`);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await mkdir(directory, {recursive: true});
  }
}

/** Copy the source fixture and only the portable transfer unit. */
export async function materializeFixture(destination = undefined) {
  const root = destination ?? await fsTempDirectory();
  await ensureEmptyDirectory(root);
  await copyTree(repositoryFixture, root);
  const transferRoot = path.join(root, ".blueprint", "codebase");
  await mkdir(transferRoot, {recursive: true});
  await cp(path.join(bundleFixture, "INDEX.md"), path.join(transferRoot, "INDEX.md"));
  await copyTree(path.join(bundleFixture, "generations"), path.join(transferRoot, "generations"));
  return root;
}

async function fsTempDirectory() {
  const {mkdtemp} = await import("node:fs/promises");
  return mkdtemp(path.join(os.tmpdir(), "portable-map-pilot-"));
}

async function walk(directory, root, output = []) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if ([".blueprint", ".git", "node_modules"].includes(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolutePath, root, output);
    } else if (entry.isFile()) {
      output.push(relativePath(root, absolutePath));
    }
  }
  return output.sort((left, right) => left.localeCompare(right, "en"));
}

export async function discoverSourceFiles(repositoryRoot) {
  const files = await walk(repositoryRoot, repositoryRoot);
  return files.filter((filePath) => sourceExtensions.has(path.extname(filePath).toLowerCase()));
}

async function readTracked(absolutePath, displayPath, actions, kind, metadata = {}) {
  const contents = await readFile(absolutePath);
  actions.push({kind, path: posix(displayPath), bytes: contents.byteLength, ...metadata});
  return contents.toString("utf8");
}

function lineRangeFromHash(target) {
  const match = target.match(/#L(\d+)(?:-L(\d+))?$/);
  return match ? [Number(match[1]), Number(match[2] ?? match[1])] : null;
}

function cleanLinkTarget(target) {
  return target.split("#", 1)[0];
}

function markdownLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
}

async function sourceLinkFromMarkdown(markdown, markdownPath, repositoryRoot) {
  for (const target of markdownLinks(markdown)) {
    const targetPath = cleanLinkTarget(target);
    if (!sourceExtensions.has(path.extname(targetPath).toLowerCase())) continue;
    const markdownRoot = path.resolve(path.dirname(markdownPath));
    const candidate = path.resolve(markdownRoot, targetPath);
    if (!isContained(path.resolve(repositoryRoot), candidate)) throw new PortableMapNavigationError();
    const relative = relativePath(repositoryRoot, candidate);
    if (relative.startsWith(".blueprint/") || !sourceExtensions.has(path.extname(relative).toLowerCase())) {
      throw new PortableMapNavigationError();
    }
    const absolutePath = await resolveContainedFile(repositoryRoot, relative);
    return {absolutePath, path: relative, range: lineRangeFromHash(target)};
  }
  return null;
}

function recordLinkFromSearchLine(line) {
  const match = line.match(/(?:^| \| )record: ([^ |]+)/);
  return match?.[1] ?? null;
}

function sourceTargetFromSearchLine(line) {
  const match = line.match(/(?:^| \| )source: ([^ |]+)/);
  return match?.[1] ?? null;
}

function lineRangeFromValue(value) {
  const match = String(value ?? "").match(/^(\d+)(?:-(\d+))?$/);
  return match ? [Number(match[1]), Number(match[2] ?? match[1])] : null;
}

function firstUsefulEvidence(evidence) {
  return evidence[0] ?? null;
}

function evidenceItems(query) {
  const declared = query.evidence ?? {};
  const normalize = (items, defaultRole) => (items ?? []).map(item => {
    if (typeof item === "string") return {path: item, role: defaultRole};
    return {path: item.path, range: item.range ?? null, role: item.role ?? defaultRole};
  });
  const required = normalize(declared.required, "required source");
  const supporting = normalize(declared.supporting, "supporting source");
  const alternatives = (declared.alternatives ?? []).map(alternative =>
    normalize(alternative, "alternative source")
  );
  if (required.length === 0 && supporting.length === 0 && alternatives.length === 0) {
    return {
      required: normalize(query.gold?.paths ?? [], "required source"),
      supporting: [],
      alternatives: []
    };
  }
  return {required, supporting, alternatives};
}

function scoreRecordedSourceReads(actions, query) {
  const expected = evidenceItems(query);
  const readable = actions.filter(action => sourceReadKinds.has(action.kind));
  const allExpected = [...expected.required, ...expected.supporting, ...expected.alternatives.flat()];
  const evidence = [];
  const matchedKeys = new Set();
  for (const action of readable) {
    const match = allExpected.find(item => item.path === action.path);
    if (!match) continue;
    const key = `${match.path}|${match.role}`;
    if (matchedKeys.has(key)) continue;
    matchedKeys.add(key);
    evidence.push({
      path: action.path,
      range: action.range ?? match.range ?? query.gold?.range ?? null,
      role: action.role ?? match.role
    });
  }
  const hasPath = (item) => evidence.some(found => found.path === item.path);
  const requiredEvidence = expected.required.filter(hasPath);
  const supportingEvidence = expected.supporting.filter(hasPath);
  const alternativeEvidence = expected.alternatives.find(alternative => alternative.every(hasPath)) ?? [];
  const sufficient = expected.required.length > 0
    ? requiredEvidence.length === expected.required.length || alternativeEvidence.length > 0
    : expected.alternatives.length > 0
      ? alternativeEvidence.length > 0
      : evidence.length > 0;
  return {
    evidence,
    firstUsefulSourceRead: firstUsefulEvidence(evidence),
    requiredEvidence,
    supportingEvidence,
    alternativeEvidence,
    sufficientEvidence: sufficient,
    sufficientContext: sufficient
  };
}

function lower(value) {
  return String(value).toLocaleLowerCase("en");
}

/** Run a deterministic source-only search with no map or runtime dependency. */
export async function runLexicalBaseline(repositoryRoot, query) {
  const actions = [];
  const sourceFiles = await discoverSourceFiles(repositoryRoot);
  const searchTerm = lower(query.searchTerm ?? "");
  const candidates = [];

  if (query.knownTarget && query.targetPath) {
    const contents = await readContainedFile(repositoryRoot, query.targetPath, query.targetPath, actions, "known-target-read");
    candidates.push({path: query.targetPath, contents: contents.contents});
  } else {
    actions.push({kind: "source-inventory", path: ".", files: sourceFiles.length, bytes: 0});
    for (const sourcePath of sourceFiles) {
      const contents = await readContainedFile(repositoryRoot, sourcePath, sourcePath, actions, "lexical-search");
      const text = contents.contents;
      const pathMatch = lower(sourcePath).includes(searchTerm);
      const contentMatch = lower(text).includes(searchTerm);
      if (pathMatch || contentMatch) {
        // Candidate ordering is derived only from the search result itself.
        // Gold is applied later, when the recorded reads are scored.
        const score = (pathMatch ? 2 : 0) + (lower(sourcePath) === searchTerm ? 2 : 0) + (contentMatch ? 1 : 0);
        candidates.push({path: sourcePath, contents: text, score});
      }
    }
  }

  if (!query.knownTarget) {
    candidates
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path, "en"));
    for (const candidate of candidates) {
      await readContainedFile(repositoryRoot, candidate.path, candidate.path, actions, "useful-source-read");
    }
  }
  const scored = scoreRecordedSourceReads(actions, query);
  const totals = actionByteTotals(actions);
  return {
    label: "fixture-checks-only",
    mode: "ordinary-lexical",
    queryId: query.id,
    knownTarget: Boolean(query.knownTarget),
    actions,
    usefulSourceEvidence: scored.evidence,
    firstUsefulSourceRead: scored.firstUsefulSourceRead,
    requiredEvidence: scored.requiredEvidence,
    supportingEvidence: scored.supportingEvidence,
    alternativeEvidence: scored.alternativeEvidence,
    sufficientEvidence: scored.sufficientEvidence,
    sufficientContext: scored.sufficientContext,
    ...totals,
    searchedFiles: sourceFiles,
    fallbackUsed: !scored.sufficientEvidence,
    fallbackGuidance: !scored.sufficientEvidence
      ? "Use ordinary bounded source discovery; a static map cannot prove absence."
      : null
  };
}

async function readMapFile(repositoryRoot, relativeMapPath, actions, kind, cache = undefined) {
  if (cache?.has(relativeMapPath)) return cache.get(relativeMapPath);
  const mapRoot = path.join(repositoryRoot, ".blueprint", "codebase");
  try {
    const result = await readContainedFile(mapRoot, relativeMapPath, `.blueprint/codebase/${relativeMapPath}`, actions, kind);
    cache?.set(relativeMapPath, result);
    return result;
  } catch (error) {
    if (error instanceof PortableMapNavigationError) throw error;
    throw new PortableMapNavigationError("malformed-map");
  }
}

async function readSourceFile(repositoryRoot, relativeSourcePath, actions, kind, cache = undefined, role = undefined, range = undefined) {
  if (relativeSourcePath === ".blueprint" || relativeSourcePath.startsWith(".blueprint/")) {
    throw new PortableMapNavigationError();
  }
  if (cache?.has(relativeSourcePath)) return cache.get(relativeSourcePath);
  try {
    const result = await readContainedFile(
      repositoryRoot,
      relativeSourcePath,
      relativeSourcePath,
      actions,
      kind,
      {role, range}
    );
    cache?.set(relativeSourcePath, result);
    return result;
  } catch (error) {
    if (error instanceof PortableMapNavigationError) throw error;
    throw new PortableMapNavigationError("unreadable-source");
  }
}

function selectSearchShard(query) {
  if (["files", "symbols", "aliases"].includes(query.searchShard)) return query.searchShard;
  const term = String(query.searchTerm ?? "").trim();
  if (term.includes("/") || sourceExtensions.has(path.extname(term).toLowerCase())) return "files";
  if (/\s/.test(term)) return "aliases";
  if (/^[a-z][a-z0-9_-]*$/.test(term)) return "files";
  return "symbols";
}

function sourceLinkFromSearchLine(line, shardAbsolutePath, repositoryRoot) {
  const target = sourceTargetFromSearchLine(line);
  if (!target) return null;
  const fields = line.split(" | ");
  const sourcePath = target.match(/^\d+(?:-\d+)?$/) ? fields[1] : null;
  const sourceTarget = sourcePath
    ? `../../../../../${sourcePath}#L${target.replace("-", "-L")}`
    : target;
  const source = sourceLinkFromMarkdown(`[source](${sourceTarget})`, shardAbsolutePath, repositoryRoot);
  return source.then(result => {
    if (!result) return null;
    if (!result.range && sourcePath) result.range = lineRangeFromValue(target);
    return result;
  });
}

async function searchMap(repositoryRoot, query, actions, cache) {
  const route = await readMapFile(repositoryRoot, "generations/gen-001/routes/search.md", actions, "map-route-read", cache);
  const shardPaths = [...route.contents.matchAll(/\]\((\.\.\/search\/[^)]+\.md)\)/g)]
    .map((match) => match[1].replace("../search/", "search/"));
  const selectedShard = selectSearchShard(query);
  const shardPath = shardPaths.find(candidate => candidate === `search/${selectedShard}.md`);
  if (!shardPath) throw new PortableMapNavigationError();
  const candidates = [];
  let ordinal = 0;
  const shard = await readMapFile(repositoryRoot, `generations/gen-001/${shardPath}`, actions, "search-shard-read", cache);
  const seen = new Set();
  for (const line of shard.contents.split(/\r?\n/)) {
    if (!line || !lower(line).includes(lower(query.searchTerm ?? ""))) continue;
    const normalizedTerm = lower(query.searchTerm ?? "");
    const exactField = line.split(" | ").some(field => lower(field.trim()) === normalizedTerm);
    const source = await sourceLinkFromSearchLine(line, shard.absolutePath, repositoryRoot);
    if (!source) throw new PortableMapNavigationError();
    const canonical = `${source.path}#${source.range?.join("-") ?? ""}`;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    candidates.push({
      shard: `generations/gen-001/${shardPath}`,
      line,
      source,
      recordTarget: recordLinkFromSearchLine(line),
      score: exactField ? 2 : 1,
      ordinal: ordinal++
    });
  }
  return candidates.sort((left, right) => right.score - left.score || left.ordinal - right.ordinal);
}

async function followRecord(repositoryRoot, recordTarget, actions, mapCache, sourceCache, role = "production relationship") {
  if (!recordTarget) return {source: null, record: null};
  const cleanedTarget = cleanLinkTarget(recordTarget);
  if (!cleanedTarget.startsWith("../records/")) throw new PortableMapNavigationError();
  const normalizedTarget = cleanedTarget.replace(/^\.\.\/records\//, "records/");
  const recordPath = `generations/gen-001/${normalizedTarget}`;
  const record = await readMapFile(repositoryRoot, recordPath, actions, "record-read", mapCache);
  const fragment = recordTarget.split("#", 2)[1];
  let recordSection = record.contents;
  if (fragment) {
    const anchorIndex = record.contents.indexOf(`{#${fragment}}`);
    if (anchorIndex >= 0) {
      const fileStart = record.contents.lastIndexOf("\n## File:", anchorIndex);
      const nextFile = record.contents.indexOf("\n## File:", anchorIndex + 1);
      recordSection = record.contents.slice(fileStart >= 0 ? fileStart : 0, nextFile >= 0 ? nextFile : undefined);
    }
  }
  const source = await sourceLinkFromMarkdown(recordSection, record.absolutePath, repositoryRoot);
  if (!source) return {source: null, record: recordPath};
  try {
    await readSourceFile(repositoryRoot, source.path, actions, "useful-source-read", sourceCache, role, source.range);
  } catch (error) {
    if (error instanceof PortableMapNavigationError) throw error;
    throw new PortableMapNavigationError("unreadable-source");
  }
  return {source, record: recordPath};
}

function markdownSection(markdown, heading) {
  const start = markdown.indexOf(`## ${heading}`);
  if (start < 0) return "";
  const after = markdown.slice(start + heading.length + 3);
  const next = after.search(/\n## /);
  return after.slice(0, next >= 0 ? next : undefined);
}

async function followCapabilityEvidence(repositoryRoot, capability, actions, mapCache, sourceCache) {
  const required = markdownSection(capability.contents, "Required live evidence");
  const supporting = markdownSection(capability.contents, "Supporting evidence");
  const recordTargets = (markdown) => markdownLinks(markdown)
    .filter(target => target.startsWith("../records/") && target.includes("#"));
  for (const target of recordTargets(required)) {
    await followRecord(repositoryRoot, target, actions, mapCache, sourceCache, "production relationship");
  }
  for (const target of recordTargets(supporting)) {
    await followRecord(repositoryRoot, target, actions, mapCache, sourceCache, "supporting source");
  }
  const roleForEvidenceLine = (line, fallbackRole) => {
    const normalized = lower(line);
    if (normalized.includes("direct test")) return "direct test";
    if (normalized.includes("candidate related test")) return "candidate related test";
    if (normalized.includes("production relationship")) return "production relationship";
    return fallbackRole;
  };
  const directSources = async (markdown, fallbackRole) => {
    for (const target of markdownLinks(markdown)) {
      if (!sourceExtensions.has(path.extname(cleanLinkTarget(target)).toLowerCase())) continue;
      const line = markdown.split(/\r?\n/).find(candidate => candidate.includes(target)) ?? "";
      const source = await sourceLinkFromMarkdown(
        `[source](${target})`,
        capability.absolutePath,
        repositoryRoot
      );
      if (!source) throw new PortableMapNavigationError();
      await readSourceFile(
        repositoryRoot,
        source.path,
        actions,
        "useful-source-read",
        sourceCache,
        roleForEvidenceLine(line, fallbackRole),
        source.range
      );
    }
  };
  await directSources(required, "production relationship");
  await directSources(supporting, "supporting source");
}

async function checkFreshnessInternal(repositoryRoot, actions = undefined) {
  const manifest = JSON.parse((await readMapFile(repositoryRoot, "generations/gen-001/manifest.json", actions ?? [], "freshness-manifest-read")).contents);
  const sourceManifest = await readMapFile(repositoryRoot, "generations/gen-001/data/files.json", actions ?? [], "freshness-manifest-read");
  const inventory = JSON.parse(sourceManifest.contents);
  const stalePaths = [];
  const unreadablePaths = [];
  for (const file of inventory.files ?? []) {
    try {
      const absolutePath = await resolveContainedFile(repositoryRoot, file.path);
      const contents = await readFile(absolutePath);
      actions?.push({kind: "freshness-source-read", path: file.path, bytes: contents.byteLength});
      const digest = createHash("sha256").update(contents).digest("hex");
      if (digest !== file.contentHash || contents.byteLength !== file.byteSize) stalePaths.push(file.path);
    } catch (error) {
      if (error instanceof PortableMapNavigationError && error.reason === "missing-source") stalePaths.push(file.path);
      else unreadablePaths.push(file.path);
    }
  }
  return {
    status: unreadablePaths.length > 0 ? "unknown" : stalePaths.length === 0 ? "fresh-for-fixture-baseline" : "stale",
    stalePaths,
    unreadablePaths,
    guidance: "A static index cannot detect newly added files without a live inventory comparison."
  };
}

export async function checkBundleFreshness(repositoryRoot) {
  try {
    return await checkFreshnessInternal(repositoryRoot);
  } catch {
    return {
      status: "unknown",
      stalePaths: [],
      unreadablePaths: [],
      guidance: "Map freshness could not be verified; use ordinary bounded source discovery."
    };
  }
}

function navigationFallback(query, actions, freshness, reason) {
  const totals = actionByteTotals(actions);
  return {
    label: "fixture-checks-only",
    mode: "portable-map",
    queryId: query.id,
    knownTarget: Boolean(query.knownTarget),
    actions,
    usefulSourceEvidence: [],
    firstUsefulSourceRead: null,
    requiredEvidence: [],
    supportingEvidence: [],
    alternativeEvidence: [],
    sufficientEvidence: false,
    sufficientContext: false,
    ...totals,
    fallbackUsed: true,
    fallbackReason: reason,
    freshness,
    fallbackGuidance: "Use ordinary bounded source discovery; the map is unavailable or cannot establish absence."
  };
}

/** Navigate the manually-authored map through only the selected routes/pages. */
export async function navigatePortableMap(repositoryRoot, query) {
  const actions = [];
  let freshness = null;
  const mapCache = new Map();
  const sourceCache = new Map();
  try {
    if (query.verifyFreshness) {
      freshness = await checkFreshnessInternal(repositoryRoot, actions);
      if (freshness.status !== "fresh-for-fixture-baseline") {
        actions.push({kind: "fallback-guidance", reason: freshness.status === "unknown" ? "unreadable-source" : "stale-map"});
        return navigationFallback(query, actions, freshness, freshness.status === "unknown" ? "unreadable-source" : "stale-map");
      }
    }

    // A known target is already the smallest safe navigation unit.  Loading
    // INDEX is reserved for map-derived discovery or an explicit freshness
    // check above.
    if (query.knownTarget && query.targetPath) {
      await readSourceFile(repositoryRoot, query.targetPath, actions, "known-target-source-read", sourceCache, "known target");
      const scored = scoreRecordedSourceReads(actions, query);
      return {
        label: "fixture-checks-only",
        mode: "portable-map",
        queryId: query.id,
        knownTarget: true,
        actions,
        usefulSourceEvidence: scored.evidence,
        firstUsefulSourceRead: scored.firstUsefulSourceRead,
        requiredEvidence: scored.requiredEvidence,
        supportingEvidence: scored.supportingEvidence,
        alternativeEvidence: scored.alternativeEvidence,
        sufficientEvidence: scored.sufficientEvidence,
        sufficientContext: scored.sufficientContext,
        ...actionByteTotals(actions),
        fallbackUsed: false,
        fallbackGuidance: null,
        freshness
      };
    }

    await readMapFile(repositoryRoot, "INDEX.md", actions, "index-read", mapCache);
    if (query.kind === "capability") {
      const route = await readMapFile(repositoryRoot, "generations/gen-001/routes/capabilities.md", actions, "capability-route-read", mapCache);
      const target = [...route.contents.matchAll(/\]\((\.\.\/capabilities\/[^)]+\.md)\)/g)]
        .find((match) => match[1].endsWith(`${query.capability}.md`))?.[1];
      if (target) {
        const capability = await readMapFile(repositoryRoot, `generations/gen-001/${target.replace("../capabilities/", "capabilities/")}`, actions, "capability-read", mapCache);
        await followCapabilityEvidence(repositoryRoot, capability, actions, mapCache, sourceCache);
      } else {
        throw new PortableMapNavigationError("no-matching-evidence");
      }
    } else {
      const hits = await searchMap(repositoryRoot, query, actions, mapCache);
      for (const hit of hits) {
        await readSourceFile(
          repositoryRoot,
          hit.source.path,
          actions,
          "useful-source-read",
          sourceCache,
          "direct source",
          hit.source.range
        );
        if (query.needsRecord) {
          if (!hit.recordTarget) throw new PortableMapNavigationError();
          await followRecord(repositoryRoot, hit.recordTarget, actions, mapCache, sourceCache, "production relationship");
        }
      }
    }

    const scored = scoreRecordedSourceReads(actions, query);
    const totals = actionByteTotals(actions);
    return {
      label: "fixture-checks-only",
      mode: "portable-map",
      queryId: query.id,
      knownTarget: false,
      actions,
      usefulSourceEvidence: scored.evidence,
      firstUsefulSourceRead: scored.firstUsefulSourceRead,
      requiredEvidence: scored.requiredEvidence,
      supportingEvidence: scored.supportingEvidence,
      alternativeEvidence: scored.alternativeEvidence,
      sufficientEvidence: scored.sufficientEvidence,
      sufficientContext: scored.sufficientContext,
      ...totals,
      fallbackUsed: !scored.sufficientEvidence,
      fallbackReason: !scored.sufficientEvidence ? (scored.evidence.length === 0 ? "no-matching-evidence" : "insufficient-evidence") : null,
      fallbackGuidance: !scored.sufficientEvidence
        ? "Use ordinary bounded source discovery; a static map cannot prove absence."
        : null,
      freshness
    };
  } catch (error) {
    const reason = error instanceof PortableMapNavigationError ? error.reason : "malformed-map";
    actions.push({kind: "fallback-guidance", reason});
    return navigationFallback(query, actions, freshness, reason);
  }
}

export async function readQueryFile(queryPath) {
  return JSON.parse(await readFile(queryPath, "utf8"));
}

export async function runPilotReport(repositoryRoot, queries) {
  const results = [];
  for (const query of queries) {
    results.push({
      queryId: query.id,
      knownTarget: Boolean(query.knownTarget),
      lexical: await runLexicalBaseline(repositoryRoot, query),
      portableMap: await navigatePortableMap(repositoryRoot, query)
    });
  }
  return {
    label: "fixture-checks-only",
    hostedPerformanceEvidence: false,
    releaseTokenAndQualityGates: "not evaluated",
    results
  };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(args) {
  if (args[0] === "--materialize") {
    const root = await materializeFixture(argumentValue(args, "--materialize"));
    process.stdout.write(`${JSON.stringify({label: "fixture-checks-only", root, evaluationTransferred: false}, null, 2)}\n`);
    return;
  }
  if (args[0] === "--report") {
    const root = argumentValue(args, "--report");
    const queryArgument = argumentValue(args, "--queries");
    if (!root || !queryArgument) throw new Error("Usage: --report REPOSITORY --queries QUERY_FILE");
    const queriesPath = path.resolve(queryArgument);
    const outside = path.relative(path.resolve(root), queriesPath);
    if (outside === "" || (!outside.startsWith(`..${path.sep}`) && outside !== "..")) {
      throw new Error("Query metadata must remain outside the transferred repository.");
    }
    const queryDocument = await readQueryFile(queriesPath);
    process.stdout.write(`${JSON.stringify(await runPilotReport(root, queryDocument.queries), null, 2)}\n`);
    return;
  }
  throw new Error("Usage: --materialize DESTINATION or --report REPOSITORY --queries QUERY_FILE");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
