import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("wave 2 closeout memory and drift script keep the anti-drift workflow source-owned", async () => {
  const [memoryFile, scriptFile] = await Promise.all([
    readRepoFile("MEMORY.md"),
    readRepoFile("scripts/drift-fix-memory.mjs")
  ]);

  assert.match(
    memoryFile,
    /`AGENTS\.md`, `agent-docs\/08-change-recipes\.md`, `agent-docs\/09-verification-guide\.md`, and `scripts\/drift-fix-memory\.mjs` now define the anti-drift closeout workflow for the next 1-to-3-agent cycles/
  );
  assert.doesNotMatch(memoryFile, /docs\/build\//);
  assert.match(scriptFile, /const DEFAULT_NAMESPACE = "wave-2-closeout"/);
  assert.match(scriptFile, /const DEFAULT_PLAN_DOC =\s*"MEMORY\.md"/);
  assert.match(scriptFile, /node scripts\/drift-fix-memory\.mjs init/);
  assert.match(scriptFile, /node scripts\/drift-fix-memory\.mjs status/);
  assert.match(scriptFile, /node scripts\/drift-fix-memory\.mjs register-agent/);
  assert.match(scriptFile, /node scripts\/drift-fix-memory\.mjs claim/);
  assert.match(scriptFile, /node scripts\/drift-fix-memory\.mjs note/);
  assert.match(scriptFile, /node scripts\/drift-fix-memory\.mjs complete/);
  assert.match(scriptFile, /node scripts\/drift-fix-memory\.mjs block/);
  assert.match(scriptFile, /node scripts\/drift-fix-memory\.mjs cleanup/);
});

test("wave 2 drift memory script encodes task closeout evidence and regression-only completion gates", async () => {
  const scriptFile = await readRepoFile("scripts/drift-fix-memory.mjs");

  assert.match(scriptFile, /function collectCompletionEvidence/);
  assert.match(scriptFile, /function validateCompletionFiles/);
  assert.match(
    scriptFile,
    /Completion requires --files with changed repo paths or --no-files-reason for an explicit no-op closeout\./
  );
  assert.match(scriptFile, /--tests/);
  assert.match(scriptFile, /--files/);
  assert.match(scriptFile, /--no-files-reason/);
  assert.match(scriptFile, /verifiedFiles/);
  assert.match(scriptFile, /No change evidence found/);
});

test("wave 2 drift memory script preserves blocker and handoff note protocols for parallel closeout loops", async () => {
  const scriptFile = await readRepoFile("scripts/drift-fix-memory.mjs");

  assert.match(scriptFile, /block --agent ID --task ID --reason TEXT/);
  assert.match(scriptFile, /note --agent ID \[--task ID\] --title TEXT/);
  assert.match(scriptFile, /--body TEXT \| --body-file PATH/);
  assert.match(scriptFile, /claims/);
  assert.match(scriptFile, /completed/);
  assert.match(scriptFile, /blocked/);
  assert.match(scriptFile, /notes", "shared/);
  assert.match(scriptFile, /notes", "tasks/);
});
