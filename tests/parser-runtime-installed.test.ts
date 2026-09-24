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

    const bundleEntry = path.join(scratch, "bundle-entry.ts");
    await writeFile(bundleEntry, [
      `import {parseSource} from ${JSON.stringify(path.join(repoRoot, "src/mcp/codebase-index/parser-runtime.ts"))};`,
      "export {parseSource};"
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
const {parseSource} = await import(${JSON.stringify(pathToFileURL(bundlePath).href)});
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
process.stdout.write(JSON.stringify(result));
`);
    const result = await execFileAsync(process.execPath, [launcher], {
      cwd: emptyCwd,
      env: {...process.env, NODE_PATH: ""},
      maxBuffer: 1024 * 1024
    });
    assert.deepEqual(JSON.parse(result.stdout), [
      ["javascript", "program", 0],
      ["jsx", "program", 0],
      ["typescript", "program", 0],
      ["tsx", "program", 0],
      ["python", "module", 0],
      ["java", "program", 0]
    ]);
  } finally {
    await rm(scratch, {recursive: true, force: true});
  }
});
