import test from "node:test";
import assert from "node:assert/strict";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  checkBundleFreshness,
  materializeFixture,
  navigatePortableMap,
  runLexicalBaseline,
  runPilotReport,
  fixtureRoot
} from "../scripts/portable-map-pilot.mjs";

const heldOutPath = path.join(fixtureRoot, "evaluation", "held-out-queries.json");

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function filesUnder(directory: string): Promise<string[]> {
  const result: string[] = [];
  async function visit(current: string): Promise<void> {
    for (const entry of await readdir(current, {withFileTypes: true})) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) result.push(absolute);
    }
  }
  await visit(directory);
  return result.sort((left, right) => left.localeCompare(right, "en"));
}

async function makeMaterialized(t: {after: (fn: () => Promise<void>) => void}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "portable-map-pilot-test-"));
  t.after(async () => rm(root, {recursive: true, force: true}));
  await materializeFixture(root);
  return root;
}

test("materializes only the repository and portable transfer unit", async (t) => {
  const root = await makeMaterialized(t);
  const pointer = await readFile(path.join(root, "AGENTS.md"), "utf8");
  assert.match(pointer, /read `\.blueprint\/codebase\/INDEX\.md` if present/);
  assert.match(pointer, /blueprint:portable-codebase-index:start/);
  assert.equal(await exists(path.join(root, "evaluation")), false);
  assert.equal(await exists(path.join(root, "tests", "fixtures")), false);
  assert.deepEqual(await readdir(path.join(root, ".blueprint")), ["codebase"]);
  assert.equal(await exists(path.join(root, ".blueprint", "codebase", "INDEX.md")), true);
  const generation = await lstat(path.join(root, ".blueprint", "codebase", "generations", "gen-001"));
  assert.equal(generation.isDirectory(), true);
  assert.equal(generation.isSymbolicLink(), false);
});

test("portable links and pages satisfy the bounded transfer contract", async (t) => {
  const root = await makeMaterialized(t);
  const mapRoot = path.join(root, ".blueprint", "codebase");
  const markdownFiles = (await filesUnder(mapRoot)).filter((filePath) => filePath.endsWith(".md"));
  for (const filePath of markdownFiles) {
    const markdown = await readFile(filePath, "utf8");
    for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^(?:[a-z]+:|#)/i.test(target)) continue;
      const targetPath = path.resolve(path.dirname(filePath), target.split("#", 1)[0]);
      assert.equal(
        await exists(targetPath),
        true,
        `${path.relative(root, filePath)} has an unresolved link to ${target}`
      );
    }
  }

  const indexBytes = (await readFile(path.join(mapRoot, "INDEX.md"))).byteLength;
  const entryBytes = (await readFile(path.join(mapRoot, "generations", "gen-001", "ENTRY.md"))).byteLength;
  assert.ok(indexBytes <= 4096, `INDEX.md is ${indexBytes} bytes`);
  assert.ok(entryBytes <= 4096, `ENTRY.md is ${entryBytes} bytes`);

  for (const routeName of ["capabilities.md", "records.md", "search.md"]) {
    const route = path.join(mapRoot, "generations", "gen-001", "routes", routeName);
    const contents = await readFile(route, "utf8");
    assert.ok(Buffer.byteLength(contents) <= 8192, `${routeName} exceeds the route page limit`);
    assert.ok(contents.split(/\r?\n/).filter((line) => line.startsWith("- ")).length <= 24);
  }
  for (const pageName of ["checkout.md", "shipping.md"]) {
    const page = path.join(mapRoot, "generations", "gen-001", "capabilities", pageName);
    assert.ok((await readFile(page)).byteLength <= 12 * 1024);
  }
  for (const pageName of ["checkout.md", "shipping.md", "unsupported.md"]) {
    const page = path.join(mapRoot, "generations", "gen-001", "records", pageName);
    assert.ok((await readFile(page)).byteLength <= 12 * 1024);
  }
  for (const pageName of ["files.md", "symbols.md", "aliases.md"]) {
    const page = path.join(mapRoot, "generations", "gen-001", "search", pageName);
    const lines = (await readFile(page, "utf8")).split(/\r?\n/).filter(Boolean);
    assert.ok((await readFile(page)).byteLength <= 32 * 1024);
    for (const line of lines) {
      assert.ok(Buffer.byteLength(line) <= 2 * 1024, `${pageName} has an oversized search hit`);
      assert.match(line, /\| source:|\| coverage:/);
      assert.match(line, /\| record: \.\.\/records\/[^ |]+/);
    }
  }

  const manifest = JSON.parse(await readFile(path.join(mapRoot, "generations", "gen-001", "manifest.json"), "utf8"));
  assert.equal(manifest.formatVersion, 1);
  assert.equal(manifest.protocolVersion, 1);
  assert.equal(manifest.generationId, "gen-001");
  assert.equal(manifest.structuralCoverage.filesWithFileCoverage, 1);
});

test("lexical baseline and map navigation record deterministic fixture checks", async (t) => {
  const root = await makeMaterialized(t);
  const queries = JSON.parse(await readFile(heldOutPath, "utf8")).queries;
  const report = await runPilotReport(root, queries);
  const secondReport = await runPilotReport(root, queries);
  assert.deepEqual(report, secondReport);
  assert.equal(report.label, "fixture-checks-only");
  assert.equal(report.hostedPerformanceEvidence, false);
  assert.equal(report.releaseTokenAndQualityGates, "not evaluated");
  assert.equal(report.results.length, 10);

  const byId = new Map(report.results.map((result) => [result.queryId, result]));
  const known = byId.get("known-cart-path")!;
  assert.equal(known.knownTarget, true);
  assert.equal(known.portableMap.firstUsefulSourceRead?.path, "src/checkout/cart.ts");
  assert.deepEqual(known.portableMap.actions.map((action) => action.kind), ["known-target-source-read"]);

  const symbol = byId.get("cart-total-symbol")!;
  assert.equal(symbol.knownTarget, false);
  assert.equal(symbol.portableMap.firstUsefulSourceRead?.path, "src/checkout/cart.ts");
  assert.equal(symbol.portableMap.usefulSourceEvidence[0].range?.join("-"), "9-18");
  assert.ok(symbol.portableMap.actions.some((action) => action.kind === "record-read"));
  assert.equal(symbol.lexical.firstUsefulSourceRead?.path, "src/checkout/cart.ts");
  assert.ok(symbol.lexical.searchBytesRead > 0);
  assert.equal(symbol.lexical.sourceBytesRead, 556 + 219);

  const alias = byId.get("basket-alias")!;
  assert.equal(alias.portableMap.firstUsefulSourceRead?.path, "src/checkout/cart.ts");
  assert.equal(alias.lexical.firstUsefulSourceRead, null);
  assert.ok(alias.portableMap.actions.some((action) => action.kind === "search-shard-read"));

  assert.equal(byId.get("python-rate-symbol")!.portableMap.firstUsefulSourceRead?.path, "python/rates.py");
  assert.equal(
    byId.get("java-plan-alias")!.portableMap.firstUsefulSourceRead?.path,
    "java/com/acme/fulfillment/ShipmentPlanner.java"
  );

  const ambiguous = byId.get("ambiguous-checkout-receipt")!;
  assert.deepEqual(
    ambiguous.lexical.actions.filter((action) => action.kind === "useful-source-read").map((action) => action.path),
    ["src/checkout/cart.ts", "tests/checkout/cart.test.ts", "src/checkout/receipt.js"]
  );
  assert.equal(ambiguous.lexical.firstUsefulSourceRead?.path, "src/checkout/receipt.js");
  assert.ok(ambiguous.lexical.searchBytesRead > 0);
  assert.equal(ambiguous.lexical.sourceBytesRead, 556 + 219 + 98);
  assert.equal(ambiguous.portableMap.firstUsefulSourceRead?.path, "src/checkout/receipt.js");
  assert.ok(ambiguous.portableMap.actions.some((action) => action.path === "src/checkout/cart.ts" && action.kind === "useful-source-read"));
  assert.ok(ambiguous.portableMap.actions.some((action) => action.path === "src/checkout/receipt.js" && action.kind === "useful-source-read"));
  assert.ok(ambiguous.portableMap.searchBytesRead > 0);
  assert.ok(ambiguous.portableMap.sourceBytesRead > 98);
  const changedGold = {
    ...JSON.parse(JSON.stringify(JSON.parse(await readFile(heldOutPath, "utf8")).queries.find((candidate: {id: string}) => candidate.id === "ambiguous-checkout-receipt"))),
    gold: {paths: ["src/checkout/cart.ts"], range: [9, 18]}
  };
  const changedBaseline = await runLexicalBaseline(root, changedGold);
  const changedMap = await navigatePortableMap(root, changedGold);
  assert.deepEqual(changedBaseline.actions, ambiguous.lexical.actions);
  assert.deepEqual(changedMap.actions, ambiguous.portableMap.actions);
  assert.equal(changedBaseline.firstUsefulSourceRead?.path, "src/checkout/cart.ts");
  assert.equal(changedMap.firstUsefulSourceRead?.path, "src/checkout/cart.ts");

  const capability = byId.get("checkout-capability")!;
  assert.deepEqual(capability.portableMap.actions.map((action) => action.kind), [
    "index-read",
    "capability-route-read",
    "capability-read",
    "record-read",
    "useful-source-read"
  ]);
  assert.equal(capability.portableMap.firstUsefulSourceRead?.path, "src/checkout/cart.ts");

  const unsupported = byId.get("unsupported-sql-path")!;
  assert.equal(unsupported.portableMap.firstUsefulSourceRead?.path, "db/migrations/001_orders.sql");
  const searchFiles = await readFile(path.join(root, ".blueprint", "codebase", "generations", "gen-001", "search", "files.md"), "utf8");
  assert.match(searchFiles, /db\/migrations\/001_orders\.sql[^\n]+file-only unsupported/);

  for (const queryId of ["stale-old-checkout", "unknown-coupon-feature"]) {
    const result = byId.get(queryId)!;
    assert.equal(result.portableMap.fallbackUsed, true);
    assert.match(result.portableMap.fallbackGuidance ?? "", /ordinary bounded source discovery/);
    assert.equal(result.portableMap.firstUsefulSourceRead, null);
  }

  const mapText = (await Promise.all((await filesUnder(path.join(root, ".blueprint", "codebase")))
    .filter((filePath) => filePath.endsWith(".md"))
    .map((filePath) => readFile(filePath, "utf8")))).join("\n");
  assert.doesNotMatch(mapText, /old checkout|coupon blacklist/);
});

test("freshness drift selects the documented stale-map fallback", async (t) => {
  const root = await makeMaterialized(t);
  const sourcePath = path.join(root, "src", "checkout", "cart.ts");
  await writeFile(sourcePath, `${await readFile(sourcePath, "utf8")}\n// fixture-only source drift\n`, "utf8");
  const freshness = await checkBundleFreshness(root);
  assert.equal(freshness.status, "stale");
  assert.deepEqual(freshness.stalePaths, ["src/checkout/cart.ts"]);

  const query = JSON.parse(await readFile(heldOutPath, "utf8")).queries.find(
    (candidate: {id: string}) => candidate.id === "stale-old-checkout"
  );
  const navigation = await navigatePortableMap(root, query);
  assert.equal(navigation.fallbackUsed, true);
  assert.equal(navigation.freshness.status, "stale");
  assert.ok(navigation.actions.some((action) => action.kind === "fallback-guidance"));
  assert.match(navigation.fallbackGuidance ?? "", /ordinary bounded source discovery/);
});

test("deleted and unreadable sources produce bounded freshness statuses", async (t) => {
  const deletedRoot = await makeMaterialized(t);
  const deletedPath = path.join(deletedRoot, "src", "checkout", "cart.ts");
  await rm(deletedPath);
  const deleted = await checkBundleFreshness(deletedRoot);
  assert.equal(deleted.status, "stale");
  assert.deepEqual(deleted.stalePaths, ["src/checkout/cart.ts"]);
  assert.deepEqual(deleted.unreadablePaths, []);

  const unreadableRoot = await makeMaterialized(t);
  const unreadablePath = path.join(unreadableRoot, "src", "checkout", "cart.ts");
  await rm(unreadablePath);
  await mkdir(unreadablePath);
  const unreadable = await checkBundleFreshness(unreadableRoot);
  assert.equal(unreadable.status, "unknown");
  assert.deepEqual(unreadable.unreadablePaths, ["src/checkout/cart.ts"]);
  assert.match(unreadable.guidance, /newly added files/);
});

test("known targets and malformed maps fall back without reading outside the roots", async (t) => {
  const root = await makeMaterialized(t);
  const knownQuery = JSON.parse(await readFile(heldOutPath, "utf8")).queries.find(
    (candidate: {id: string}) => candidate.id === "known-cart-path"
  );
  await rm(path.join(root, "src", "checkout", "cart.ts"));
  const missingKnown = await navigatePortableMap(root, knownQuery);
  assert.equal(missingKnown.fallbackUsed, true);
  assert.equal(missingKnown.fallbackReason, "missing-source");
  assert.deepEqual(missingKnown.actions.map((action) => action.kind), ["fallback-guidance"]);

  const malformedRoot = await makeMaterialized(t);
  const searchPath = path.join(malformedRoot, ".blueprint", "codebase", "generations", "gen-001", "search", "files.md");
  const search = await readFile(searchPath, "utf8");
  await writeFile(searchPath, `${search}\nfile | malicious | source: /tmp/outside-secret.ts | record: ../records/../../outside.md\n`, "utf8");
  const malformed = await navigatePortableMap(malformedRoot, {
    id: "malicious-route",
    kind: "search",
    knownTarget: false,
    searchTerm: "malicious",
    gold: {paths: []}
  });
  assert.equal(malformed.fallbackUsed, true);
  assert.equal(malformed.fallbackReason, "malformed-map");
  assert.equal(malformed.actions.some((action) => action.path === "/tmp/outside-secret.ts"), false);

  const routeRoot = await makeMaterialized(t);
  const capabilitiesRoutePath = path.join(routeRoot, ".blueprint", "codebase", "generations", "gen-001", "routes", "capabilities.md");
  await writeFile(capabilitiesRoutePath, `${await readFile(capabilitiesRoutePath, "utf8")}\n- [Malicious](../capabilities/../../outside.md)\n`, "utf8");
  const routeResult = await navigatePortableMap(routeRoot, {
    id: "malicious-route-target",
    kind: "capability",
    knownTarget: false,
    capability: "outside",
    searchTerm: "outside",
    gold: {paths: []}
  });
  assert.equal(routeResult.fallbackUsed, true);
  assert.equal(routeResult.fallbackReason, "malformed-map");

  const sourceLinkRoot = await makeMaterialized(t);
  const checkoutRecordPath = path.join(sourceLinkRoot, ".blueprint", "codebase", "generations", "gen-001", "records", "checkout.md");
  await writeFile(checkoutRecordPath, `${await readFile(checkoutRecordPath, "utf8")}\n## File: \`malicious\` {#file-malicious}\n\n- Source: [secret.ts](/tmp/outside-secret.ts#L1)\n`, "utf8");
  const sourceSearchPath = path.join(sourceLinkRoot, ".blueprint", "codebase", "generations", "gen-001", "search", "files.md");
  await writeFile(sourceSearchPath, `${await readFile(sourceSearchPath, "utf8")}\nfile | source-link-malicious | source: /tmp/outside-secret.ts | record: ../records/checkout.md#file-malicious\n`, "utf8");
  const sourceLinkResult = await navigatePortableMap(sourceLinkRoot, {
    id: "malicious-source-link",
    kind: "search",
    knownTarget: false,
    searchTerm: "source-link-malicious",
    gold: {paths: []}
  });
  assert.equal(sourceLinkResult.fallbackUsed, true);
  assert.equal(sourceLinkResult.fallbackReason, "malformed-map");
  assert.equal(sourceLinkResult.actions.some((action) => action.path === "/tmp/outside-secret.ts"), false);

  const symlinkRoot = await makeMaterialized(t);
  const linkedRecord = path.join(symlinkRoot, ".blueprint", "codebase", "generations", "gen-001", "records", "linked.md");
  await symlink(path.join(symlinkRoot, ".blueprint", "codebase", "generations", "gen-001", "records", "checkout.md"), linkedRecord);
  const linkedSearchPath = path.join(symlinkRoot, ".blueprint", "codebase", "generations", "gen-001", "search", "files.md");
  const linkedSearch = await readFile(linkedSearchPath, "utf8");
  await writeFile(linkedSearchPath, `${linkedSearch}\nfile | symlink-candidate | source: src/checkout/cart.ts | record: ../records/linked.md\n`, "utf8");
  const symlinkResult = await navigatePortableMap(symlinkRoot, {
    id: "symlink-record",
    kind: "search",
    knownTarget: false,
    searchTerm: "symlink-candidate",
    gold: {paths: []}
  });
  assert.equal(symlinkResult.fallbackUsed, true);
  assert.equal(symlinkResult.fallbackReason, "malformed-map");
});

test("baseline results expose ordered actions, useful evidence, bytes, and task mode", async (t) => {
  const root = await makeMaterialized(t);
  const queries = JSON.parse(await readFile(heldOutPath, "utf8")).queries;
  const result = await runLexicalBaseline(root, queries[0]);
  assert.equal(result.label, "fixture-checks-only");
  assert.equal(result.knownTarget, true);
  assert.ok(result.actions.length > 0);
  assert.ok(result.bytesRead > 0);
  assert.ok(result.sourceBytesRead > 0);
  assert.equal(result.firstUsefulSourceRead?.path, "src/checkout/cart.ts");
  assert.equal(result.actions[0].kind, "known-target-read");

  const discovery = await runLexicalBaseline(root, queries[1]);
  assert.equal(discovery.knownTarget, false);
  assert.equal(discovery.actions[0].kind, "source-inventory");
  assert.ok(discovery.searchedFiles.length >= 5);
  assert.equal(discovery.firstUsefulSourceRead?.path, "src/checkout/cart.ts");
});
