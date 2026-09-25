import {cp, mkdtemp, mkdir, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import assert from "node:assert/strict";
import {test} from "node:test";

import {build} from "esbuild";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("bundled parser loader works from an isolated Node process without source or node_modules", async () => {
  const scratch = await mkdtemp(path.join(tmpdir(), "blueprint-parser-installed-"));
  try {
    const mcpDirectory = path.join(scratch, "mcp");
    const emptyCwd = path.join(scratch, "empty-cwd");
    await mkdir(mcpDirectory, {recursive: true});
    await mkdir(emptyCwd);
    await cp(
      path.join(repoRoot, "src", "mcp", "codebase-index", "parser-assets"),
      path.join(mcpDirectory, "parser-assets"),
      {recursive: true}
    );
    await cp(path.join(repoRoot, "src", "mcp", "artifact-contracts", "schemas"), path.join(mcpDirectory, "artifact-contracts", "schemas"), {recursive: true});

    const bundleEntry = path.join(scratch, "bundle-entry.ts");
    await writeFile(bundleEntry, [
      `import {capturePortableSourceFreshness} from ${JSON.stringify(path.join(repoRoot, "src/mcp/codebase-index/extraction.ts"))};`,
      `import {getParserAssetManifest, parseSource} from ${JSON.stringify(path.join(repoRoot, "src/mcp/codebase-index/parser-runtime.ts"))};`,
      "export {capturePortableSourceFreshness, getParserAssetManifest, parseSource};"
    ].join("\n"));
    const bundlePath = path.join(mcpDirectory, "server.js");
    await build({
      entryPoints: [bundleEntry],
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node20",
      outfile: bundlePath,
      logLevel: "silent"
    });

    const launcher = path.join(scratch, "launcher.mjs");
    await writeFile(launcher, `
globalThis.fetch = () => { throw new Error("network access is disabled"); };
const {readFile, writeFile} = await import("node:fs/promises");
const {capturePortableSourceFreshness, getParserAssetManifest, parseSource} = await import(${JSON.stringify(pathToFileURL(bundlePath).href)});
const fixtures = [
  ["javascript", "const x = 1;"],
  ["jsx", "const A = () => <div/>;"],
  ["typescript", "type X = string;"],
  ["tsx", "const A = () => <div/>;"],
  ["python", "def f():\\n    return 1\\n"],
  ["java", "class A {}"]
];
const result = [];
for (const [language, source] of fixtures) {
  const tree = await parseSource(language, source);
  result.push([language, tree.rootNode.type, tree.rootNode.coordinate.start.byte]);
  tree.dispose();
}
await getParserAssetManifest();
const beforeCorruption = await capturePortableSourceFreshness(process.cwd(), false);
const grammarPath = ${JSON.stringify(path.join(mcpDirectory, "parser-assets", "grammars", "tree-sitter-python.wasm"))};
const grammarOriginal = await readFile(grammarPath);
const corruptedGrammar = Buffer.from(grammarOriginal);
corruptedGrammar[0] ^= 0xff;
await writeFile(grammarPath, corruptedGrammar);
let grammarRejected = false;
try { await getParserAssetManifest(); } catch { grammarRejected = true; }
const grammarAfterFresh = await capturePortableSourceFreshness(process.cwd(), false);
await writeFile(grammarPath, grammarOriginal);
const runtimePath = ${JSON.stringify(path.join(mcpDirectory, "parser-assets", "runtime", "web-tree-sitter.wasm"))};
const runtimeOriginal = await readFile(runtimePath);
const corruptedRuntime = Buffer.from(runtimeOriginal);
corruptedRuntime[0] ^= 0xff;
await writeFile(runtimePath, corruptedRuntime);
let runtimeRejected = false;
try { await getParserAssetManifest(); } catch { runtimeRejected = true; }
const runtimeAfterFresh = await capturePortableSourceFreshness(process.cwd(), false);
process.stdout.write(JSON.stringify({result, grammarRejected, runtimeRejected, beforeFresh: beforeCorruption.ok, grammarAfterFresh: grammarAfterFresh.ok, runtimeAfterFresh: runtimeAfterFresh.ok}));
`);
    const result = await execFileAsync(process.execPath, [launcher], {
      cwd: emptyCwd,
      env: {...process.env, NODE_PATH: ""},
      maxBuffer: 1024 * 1024
    });
    assert.deepEqual(JSON.parse(result.stdout), {
      result: [
      ["javascript", "program", 0],
      ["jsx", "program", 0],
      ["typescript", "program", 0],
      ["tsx", "program", 0],
      ["python", "module", 0],
        ["java", "program", 0]
      ],
      grammarRejected: true,
      runtimeRejected: true,
      beforeFresh: true,
      grammarAfterFresh: false,
      runtimeAfterFresh: false
    });
  } finally {
    await rm(scratch, {recursive: true, force: true});
  }
});
