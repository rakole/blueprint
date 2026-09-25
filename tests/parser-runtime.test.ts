import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import {test} from "node:test";

import {
  PARSER_LANGUAGES,
  PARSER_RUNTIME_VERSION,
  getParserAssetManifest,
  parseSource,
  withParsedSource
} from "../src/mcp/codebase-index/parser-runtime.ts";

test("parser manifest pins upstream runtime and every grammar asset", async () => {
  const manifest = await getParserAssetManifest();
  assert.equal(manifest.runtime.package, "web-tree-sitter");
  assert.equal(manifest.runtime.version, PARSER_RUNTIME_VERSION);
  assert.equal(manifest.runtime.languageVersion, 15);
  assert.equal(manifest.runtime.minimumCompatibleVersion, 13);
  assert.equal(manifest.runtime.license, "MIT");
  assert.equal(manifest.grammars.length, 4);
  assert.deepEqual(Object.keys(manifest.languages).sort(), [...PARSER_LANGUAGES].sort());
  assert.equal(manifest.bindingCoordinates.indexUnit, "utf16-code-unit");
  assert.equal(manifest.bindingCoordinates.columnUnit, "utf16-code-unit");
  assert.equal(manifest.bindingCoordinates.outputColumnUnit, "utf8-byte");
  assert.equal(manifest.bindingCoordinates.endExclusive, true);

  const assetPaths = [
    manifest.runtime.module,
    manifest.runtime.wasm,
    ...Object.values(manifest.languages).map(language => language.asset)
  ];
  const uniqueAssetPaths = [...new Set(assetPaths)];
  const sourceFiles = await Promise.all(uniqueAssetPaths.map(asset =>
    readFile(`src/mcp/codebase-index/parser-assets/${asset}`)));
  assert.ok(sourceFiles.every(file => file.byteLength > 0));
  const digests = new Map(uniqueAssetPaths.map((asset, index) => [
    asset,
    createHash("sha256").update(sourceFiles[index]).digest("hex")
  ]));
  assert.equal(digests.get(manifest.runtime.module), manifest.runtime.moduleSha256);
  assert.equal(digests.get(manifest.runtime.wasm), manifest.runtime.wasmSha256);
  for (const language of Object.values(manifest.languages)) {
    assert.equal(digests.get(language.asset), language.sha256);
  }
});

const fixtures: ReadonlyArray<readonly [string, string, string]> = [
  ["javascript", "program", "const f = (x) => x + 1;"],
  ["jsx", "program", "const A = () => <div>ok</div>;"],
  ["typescript", "program", "interface A { x: string };"],
  ["tsx", "program", "const A = () => <div>ok</div>;"],
  ["python", "module", "def f(x: int) -> int:\n    return x + 1\n"],
  ["java", "program", "class A { int f(int x) { return x + 1; } }"]
];

test("loads, links, and parses every pinned grammar", async () => {
  for (const [language, rootType, source] of fixtures) {
    const tree = await parseSource(language as (typeof PARSER_LANGUAGES)[number], source);
    try {
      assert.equal(tree.language, language);
      assert.equal(tree.rootNode.type, rootType);
      assert.equal(tree.rootNode.hasError, false, language);
      assert.ok(tree.rootNode.namedChildCount > 0, language);
      assert.equal("text" in tree.rootNode, false, "source bodies must stay private");
    } finally {
      tree.dispose();
    }
  }
});

test("converts UTF-16 binding positions to exact UTF-8 bytes with BOM, CRLF, and astral text", async () => {
  const source = "\uFEFFconst x = \"😀\";\r\nfunction f() {}";
  await withParsedSource("javascript", new TextEncoder().encode(source), tree => {
    const [declaration, functionNode] = tree.rootNode.namedChildren;
    assert.equal(tree.bindingIndexUnit, "utf16-code-unit");
    assert.equal(tree.outputColumnUnit, "utf8-byte");
    assert.equal(tree.endExclusive, true);
    assert.deepEqual(declaration.coordinate, {
      start: {line: 1, column: 3, byte: 3},
      end: {line: 1, column: 20, byte: 20}
    });
    assert.deepEqual(functionNode.coordinate, {
      start: {line: 2, column: 0, byte: 22},
      end: {line: 2, column: 15, byte: 37}
    });
    assert.deepEqual(tree.rootNode.coordinate, {
      start: {line: 1, column: 3, byte: 3},
      end: {line: 2, column: 15, byte: 37}
    });
  });
});

test("tree lifetime is explicit and concurrent parses use independent trees", async () => {
  const trees = await Promise.all(PARSER_LANGUAGES.map(language =>
    parseSource(language, language === "python" ? "x = 1\n" : language === "java" ? "class A {}" : "const x = 1;")));
  try {
    assert.equal(new Set(trees.map(tree => tree.rootNode)).size, trees.length);
    assert.ok(trees.every(tree => tree.rootNode.coordinate.start.byte === 0));
  } finally {
    for (const tree of trees) tree.dispose();
  }
  assert.throws(() => trees[0].rootNode, /disposed/);

  let disposedTree: Awaited<ReturnType<typeof parseSource>> | undefined;
  await assert.rejects(withParsedSource("javascript", "const x = 1;", tree => {
    disposedTree = tree;
    throw new Error("adapter failed");
  }), /adapter failed/);
  assert.ok(disposedTree);
  assert.throws(() => disposedTree!.rootNode, /disposed/);
});

test("parser views do not expose source through reflection, serialization, or retained nodes", async () => {
  const sentinel = "SENTINEL_PRIVATE_SOURCE_WAVE8";
  const tree = await parseSource("javascript", `const ${sentinel} = 1;`);
  const child = tree.rootNode.namedChildren[0]!;
  const inspect = (value: object) => {
    assert.doesNotMatch(JSON.stringify(value), new RegExp(sentinel));
    assert.doesNotMatch(JSON.stringify(Object.keys(value)), new RegExp(sentinel));
    assert.doesNotMatch(JSON.stringify(Object.getOwnPropertyNames(value)), new RegExp(sentinel));
    assert.doesNotMatch(JSON.stringify({...value}), new RegExp(sentinel));
  };
  inspect(tree);
  inspect(tree.rootNode);
  inspect(child);
  assert.equal("node" in (tree.rootNode as object), false);
  assert.equal("raw" in (tree.rootNode as object), false);

  tree.dispose();
  inspect(tree);
  inspect(child);
  assert.throws(() => child.type, /disposed/);
});
