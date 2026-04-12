#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { build } from "esbuild";

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, "dist");
const tscEntrypoint = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

function runTscEmitDeclarations() {
  const result = spawnSync(
    process.execPath,
    [tscEntrypoint, "-p", "tsconfig.json", "--emitDeclarationOnly"],
    {
      cwd: repoRoot,
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

await rm(distDir, { recursive: true, force: true });

runTscEmitDeclarations();

await build({
  bundle: true,
  entryPoints: {
    "hooks/blueprint-write-guard": "src/hooks/blueprint-write-guard.ts",
    "hooks/read-before-edit": "src/hooks/read-before-edit.ts",
    "hooks/workflow-advisory": "src/hooks/workflow-advisory.ts",
    "mcp/server": "src/mcp/server.ts"
  },
  format: "esm",
  logLevel: "info",
  outdir: "dist",
  platform: "node",
  sourcemap: true,
  target: "node20"
});
