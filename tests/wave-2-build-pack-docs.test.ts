import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

async function readBuildDoc(fileName: string): Promise<string> {
  return readFile(path.join(repoRoot, "docs/build", fileName), "utf8");
}

test("wave 2 workflow doc locks scope, packaging checks, and shared-memory protocol", async () => {
  const workflow = await readBuildDoc("WAVE-2-AGENT-WORKFLOW.md");

  assert.match(workflow, /complete-milestone/);
  assert.match(workflow, /milestone-summary/);
  assert.match(workflow, /new-milestone/);
  assert.match(workflow, /insert-phase[\s\S]*blocked/i);
  assert.match(workflow, /https:\/\/geminicli\.com\/docs\/extensions\/reference\//);
  assert.match(workflow, /https:\/\/geminicli\.com\/docs\/extensions\/best-practices\//);
  assert.match(workflow, /https:\/\/geminicli\.com\/docs\/core\/subagents\//);
  assert.match(workflow, /\$\{extensionPath\}/);
  assert.match(workflow, /commands\/\*\*\/\.?toml|commands\/\*\*\/\.toml|commands\/\*\*\/toml|commands\/\*\*\/\*\.toml/);
  assert.match(workflow, /scripts\/drift-fix-memory\.mjs/);
  assert.match(workflow, /Do not reintroduce `?\.planning\/`?/);
  assert.match(workflow, /Do not reintroduce `?\/gsd:\*`?/);
});

test("wave 2 parallel closeout plan enumerates tasks, batches, and final regression gate", async () => {
  const plan = await readBuildDoc("WAVE-2-PARALLEL-CLOSEOUT-PLAN.md");

  for (const taskId of [
    "W2-01",
    "W2-02",
    "W2-03",
    "W2-04",
    "W2-05",
    "W2-06",
    "W2-07",
    "W2-08"
  ]) {
    assert.match(plan, new RegExp(taskId));
  }

  assert.match(plan, /Batch A/);
  assert.match(plan, /Batch B/);
  assert.match(plan, /Batch C/);
  assert.match(plan, /Batch D/);
  assert.match(plan, /tests\/command-catalog\.test\.ts/);
  assert.match(plan, /tests\/help-progress-health\.test\.ts/);
  assert.match(plan, /tests\/hooks\.test\.ts/);
  assert.match(plan, /full `npm test`/);
});

test("wave 2 auto-agent meta prompt references the workflow, plan, and blocker protocol", async () => {
  const prompt = await readBuildDoc("WAVE-2-AUTO-AGENT-META-PROMPT.md");

  assert.match(prompt, /AGENTS\.md/);
  assert.match(prompt, /WAVE-2-AGENT-WORKFLOW\.md/);
  assert.match(prompt, /WAVE-2-PARALLEL-CLOSEOUT-PLAN\.md/);
  assert.match(prompt, /scripts\/drift-fix-memory\.mjs/);
  assert.match(prompt, /new MCP tool/);
  assert.match(prompt, /new hook or policy file/);
  assert.match(prompt, /later-wave agent/);
  assert.match(prompt, /files changed/);
  assert.match(prompt, /tests run/);
  assert.match(prompt, /next recommended task ID/);
});
