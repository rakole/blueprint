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

async function readContainedFile(root, relativePath, displayPath, actions, kind) {
  const absolutePath = await resolveContainedFile(root, relativePath);
  const contents = await readTracked(absolutePath, displayPath, actions, kind);
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
  await copyTree(bundleFixture, path.join(root, ".blueprint", "codebase"));
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

async function readTracked(absolutePath, displayPath, actions, kind) {
  const contents = await readFile(absolutePath);
  actions.push({kind, path: posix(displayPath), bytes: contents.byteLength});
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

function firstUsefulEvidence(evidence) {
  return evidence[0] ?? null;
}

function scoreRecordedSourceReads(actions, query) {
  const goldPaths = new Set(query.gold?.paths ?? []);
  const evidence = actions
    .filter(action => sourceReadKinds.has(action.kind) && goldPaths.has(action.path))
    .map(action => ({path: action.path, range: query.gold?.range ?? null}));
  return {evidence, firstUsefulSourceRead: firstUsefulEvidence(evidence)};
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
  const {evidence, firstUsefulSourceRead} = scoreRecordedSourceReads(actions, query);
  const totals = actionByteTotals(actions);
  return {
    label: "fixture-checks-only",
    mode: "ordinary-lexical",
    queryId: query.id,
    knownTarget: Boolean(query.knownTarget),
    actions,
    usefulSourceEvidence: evidence,
    firstUsefulSourceRead,
    ...totals,
    searchedFiles: sourceFiles,
    fallbackUsed: evidence.length === 0,
    fallbackGuidance: evidence.length === 0
      ? "Use ordinary bounded source discovery; a static map cannot prove absence."
      : null
  };
}

async function readMapFile(repositoryRoot, relativeMapPath, actions, kind) {
  const mapRoot = path.join(repositoryRoot, ".blueprint", "codebase");
  try {
    return await readContainedFile(mapRoot, relativeMapPath, `.blueprint/codebase/${relativeMapPath}`, actions, kind);
  } catch (error) {
    if (error instanceof PortableMapNavigationError) throw error;
    throw new PortableMapNavigationError("malformed-map");
  }
}

async function readSourceFile(repositoryRoot, relativeSourcePath, actions, kind) {
  if (relativeSourcePath === ".blueprint" || relativeSourcePath.startsWith(".blueprint/")) {
    throw new PortableMapNavigationError();
  }
  try {
    return await readContainedFile(repositoryRoot, relativeSourcePath, relativeSourcePath, actions, kind);
  } catch (error) {
    if (error instanceof PortableMapNavigationError) throw error;
    throw new PortableMapNavigationError("unreadable-source");
  }
}

async function searchMap(repositoryRoot, term, actions) {
  const route = await readMapFile(repositoryRoot, "generations/gen-001/routes/search.md", actions, "map-route-read");
  const shardPaths = [...route.contents.matchAll(/\]\((\.\.\/search\/[^)]+\.md)\)/g)]
    .map((match) => match[1].replace("../search/", "search/"));
  const candidates = [];
  let ordinal = 0;
  for (const shardPath of shardPaths) {
    const shard = await readMapFile(repositoryRoot, `generations/gen-001/${shardPath}`, actions, "search-shard-read");
    for (const line of shard.contents.split(/\r?\n/)) {
      if (!line || !lower(line).includes(lower(term))) continue;
      const normalizedTerm = lower(term);
      const exactField = line.split(" | ").some(field => lower(field.trim()) === normalizedTerm);
      candidates.push({
        shard: `generations/gen-001/${shardPath}`,
        line,
        recordTarget: recordLinkFromSearchLine(line),
        score: exactField ? 2 : 1,
        ordinal: ordinal++
      });
    }
  }
  return candidates.sort((left, right) => right.score - left.score || left.ordinal - right.ordinal);
}

async function followRecord(repositoryRoot, recordTarget, actions) {
  if (!recordTarget) return {source: null, record: null};
  const cleanedTarget = cleanLinkTarget(recordTarget);
  if (!cleanedTarget.startsWith("../records/")) throw new PortableMapNavigationError();
  const normalizedTarget = cleanedTarget.replace(/^\.\.\/records\//, "records/");
  const recordPath = `generations/gen-001/${normalizedTarget}`;
  const record = await readMapFile(repositoryRoot, recordPath, actions, "record-read");
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
    await readTracked(source.absolutePath, source.path, actions, "useful-source-read");
  } catch {
    throw new PortableMapNavigationError("unreadable-source");
  }
  return {source, record: recordPath};
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
      await readSourceFile(repositoryRoot, query.targetPath, actions, "known-target-source-read");
      const {evidence, firstUsefulSourceRead} = scoreRecordedSourceReads(actions, query);
      return {
        label: "fixture-checks-only",
        mode: "portable-map",
        queryId: query.id,
        knownTarget: true,
        actions,
        usefulSourceEvidence: evidence,
        firstUsefulSourceRead,
        ...actionByteTotals(actions),
        fallbackUsed: false,
        fallbackGuidance: null,
        freshness
      };
    }

    await readMapFile(repositoryRoot, "INDEX.md", actions, "index-read");
    if (query.kind === "capability") {
      const route = await readMapFile(repositoryRoot, "generations/gen-001/routes/capabilities.md", actions, "capability-route-read");
      const target = [...route.contents.matchAll(/\]\((\.\.\/capabilities\/[^)]+\.md)\)/g)]
        .find((match) => match[1].endsWith(`${query.capability}.md`))?.[1];
      if (target) {
        const capability = await readMapFile(repositoryRoot, `generations/gen-001/${target.replace("../capabilities/", "capabilities/")}`, actions, "capability-read");
        const recordTarget = capability.contents.match(/\]\((\.\.\/records\/[^)#]+\.md#[^)]+)\)/)?.[1];
        if (!recordTarget) throw new PortableMapNavigationError();
        await followRecord(repositoryRoot, recordTarget, actions);
      }
    } else {
      const hits = await searchMap(repositoryRoot, query.searchTerm, actions);
      for (const hit of hits) {
        if (!hit.recordTarget) throw new PortableMapNavigationError();
        await followRecord(repositoryRoot, hit.recordTarget, actions);
      }
    }

    const {evidence, firstUsefulSourceRead} = scoreRecordedSourceReads(actions, query);
    const totals = actionByteTotals(actions);
    return {
      label: "fixture-checks-only",
      mode: "portable-map",
      queryId: query.id,
      knownTarget: false,
      actions,
      usefulSourceEvidence: evidence,
      firstUsefulSourceRead,
      ...totals,
      fallbackUsed: evidence.length === 0,
      fallbackReason: evidence.length === 0 ? "no-matching-evidence" : null,
      fallbackGuidance: evidence.length === 0
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
