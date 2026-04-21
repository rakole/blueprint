import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("help manifest, spec, and runtime reference stay aligned on router profile and waiting-state guidance", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-help.toml"), "utf8");
  const helpDoc = await readFile(path.join(repoRoot, "docs/commands/help.md"), "utf8");
  const runtimeReference = await readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8");
  const manifestTools = [
    ...new Set(
      [...commandFile.matchAll(/mcp_blueprint_blueprint_[a-z0-9_]+/g)].map((match) => match[0])
    )
  ].sort();

  assert.match(commandFile, /Execution profile: router\./);
  assert.match(commandFile, /blueprint-router/);
  assert.deepEqual(manifestTools, [
    "mcp_blueprint_blueprint_command_catalog",
    "mcp_blueprint_blueprint_project_status"
  ]);
  assert.match(commandFile, /implemented: true/);
  assert.match(commandFile, /\/blu-new-project/);
  assert.match(commandFile, /\/blu-health/);
  assert.match(
    commandFile,
    /Return concise routing guidance for the commands that are safe and relevant in the current repo state, including what Blueprint is waiting on and the next safe action\./
  );
  assert.match(
    commandFile,
    /partial repo repair, missing artifact, verification debt, or blocked substrate/
  );
  assert.match(
    commandFile,
    /Explain blocked commands as blocked; do not present them as runnable\./
  );

  assert.match(helpDoc, /\| Execution profile \| `router` \|/);
  assert.match(
    helpDoc,
    /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    helpDoc,
    /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(helpDoc, /aligned to the shared router profile/);
  assert.match(helpDoc, /waiting state/);
  assert.match(helpDoc, /pending gate/i);
  assert.match(helpDoc, /next safe action/);
  assert.match(
    helpDoc,
    /Safe command recommendations must be limited to catalog entries whose `implemented` field is `true`, and blocked or planned commands must be described as not runnable\./
  );
  assert.match(helpDoc, /Keeps the shared router profile visible in the command contract\./);

  assert.match(
    runtimeReference,
    /\| `help` \| `docs\/commands\/help\.md` \| `blueprint-router` \| `blueprint_command_catalog`<br>`blueprint_project_status` \|/
  );
  assert.match(
    runtimeReference,
    /Router profile; report the waiting state from project status, keep the next safe action explicit, and never present planned or blocked commands as runnable\./
  );
});
