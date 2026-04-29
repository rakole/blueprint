#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, "dist");
const tscEntrypoint = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

async function loadEsbuild() {
  try {
    return await import("esbuild");
  } catch (error) {
    console.error("Missing local devDependencies (esbuild).");
    console.error("Run `npm ci` in this worktree, then rerun `npm run build`.");
    console.error(error);
    process.exit(1);
  }
}

function runTscEmitDeclarations() {
  if (!existsSync(tscEntrypoint)) {
    console.error("Missing local devDependencies (typescript/tsc).");
    console.error("Run `npm ci` in this worktree, then rerun `npm run build`.");
    process.exit(1);
  }

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

const { build } = await loadEsbuild();

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

await cp(
  path.join(repoRoot, "src", "mcp", "artifact-contracts", "schemas"),
  path.join(distDir, "mcp", "artifact-contracts", "schemas"),
  { recursive: true }
);
