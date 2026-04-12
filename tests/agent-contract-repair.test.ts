import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

async function readAgent(agentFile: string): Promise<string> {
  return readFile(path.join(repoRoot, "agents", agentFile), "utf8");
}

test("blueprint-executor encodes bounded per-plan execution, summary output, and partial-run honesty", async () => {
  const executor = await readAgent("blueprint-executor.md");

  assert.match(executor, /## Required Reads/);
  assert.match(executor, /saved `XX-YY-PLAN\.md` artifact/i);
  assert.match(executor, /## Execution Protocol/);
  assert.match(executor, /one plan at a time/i);
  assert.match(executor, /auth-gated systems|auth gate/i);
  assert.match(executor, /STATE\.md/);
  assert.match(executor, /## Summary Contract/);
  assert.match(executor, /`XX-YY-SUMMARY\.md`/);
  assert.match(executor, /## Deviation And Partial-Run Rules/);
  assert.match(executor, /partial runs honest/i);
  assert.match(executor, /Never claim the whole phase is complete/i);
});

test("blueprint-verifier encodes summary-first validation, UAT mode, and gap classification", async () => {
  const verifier = await readAgent("blueprint-verifier.md");

  assert.match(verifier, /## Modes/);
  assert.match(verifier, /Validation mode/i);
  assert.match(verifier, /UAT mode/i);
  assert.match(verifier, /## Required Reads/);
  assert.match(verifier, /saved execution summaries/i);
  assert.match(verifier, /## Verification Rules/);
  assert.match(verifier, /summary-first/i);
  assert.match(verifier, /re-verification/i);
  assert.match(verifier, /override/i);
  assert.match(verifier, /## Gap Classification/);
  assert.match(verifier, /`blocker`/);
  assert.match(verifier, /`follow-up`/);
  assert.match(verifier, /## Required Output Contract/);
  assert.match(verifier, /`XX-VERIFICATION\.md`/);
  assert.match(verifier, /`XX-UAT\.md`/);
  assert.match(verifier, /read-only/i);
});
