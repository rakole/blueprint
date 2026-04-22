import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("docs-update manifest references the docs skill, evidence posture, and visible progress contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-docs-update.toml"), "utf8");

  assert.match(commandFile, /`blueprint-docs` skill/);
  assert.match(commandFile, /`blueprint-doc-writer` and `blueprint-doc-verifier` subagents/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(
    commandFile,
    /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/
  );
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, /session-local progress tools only/i);
  assert.doesNotMatch(commandFile, /skills\/blueprint-docs\.md/);
  assert.doesNotMatch(commandFile, /agents\/blueprint-doc-writer\.md/);
  assert.doesNotMatch(commandFile, /agents\/blueprint-doc-verifier\.md/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_project_status")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_list")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_summary_digest")));
  assert.match(commandFile, /artifactPaths/);
  assert.match(commandFile, /docFiles/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_report_write")));
  assert.match(commandFile, /docs-update-latest/);
  assert.match(commandFile, /`--verify-only`/);
  assert.match(commandFile, /`--force`/);
  assert.match(commandFile, /repo truth/i);
  assert.match(commandFile, /external truth/i);
  assert.match(commandFile, /cited external truth/i);
  assert.match(commandFile, /broad-scope confirmation/i);
  assert.match(commandFile, /doc overwrite confirmation/i);
  assert.match(commandFile, /report overwrite confirmation/i);
  assert.match(commandFile, /\/blu-map-codebase/);
  assert.match(commandFile, /\/blu-progress/);
});

test("docs skill captures the long-running docs-update contract", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-docs/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-docs-update/);
  assert.match(skillFile, /Execution profile for `docs-update`: `long-running-mutation`/);
  assert.match(
    skillFile,
    /Stage vocabulary for visible docs-update posture: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    skillFile,
    /In-flight status fields for `docs-update`: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(skillFile, /### `docs-update`/);
  assert.match(skillFile, /blueprint_artifact_summary_digest/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /update_topic plus `write_todos`/i);
  assert.match(skillFile, /`--verify-only` as read-only/i);
  assert.match(skillFile, /docs-update-latest/);
  assert.match(skillFile, /repo truth/i);
  assert.match(skillFile, /external truth/i);
  assert.match(skillFile, /broad repo-doc refreshes confirmation-gated/i);
  assert.match(skillFile, /\/blu-map-codebase/);
  assert.match(skillFile, /\/blu-progress/);
  assert.match(skillFile, /Do not rewrite broad internal doc sets/i);
});

test("docs-update docs and runtime reference describe the docs spine", async () => {
  const [docFile, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/docs-update.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(docFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(
    docFile,
    /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    docFile,
    /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(docFile, /shared long-running-mutation posture/i);
  assert.match(docFile, /repo truth must stay distinct from cited external truth/i);
  assert.match(docFile, /`update_topic` tool and keep a compact docs-update checklist with `write_todos`/i);
  assert.match(docFile, /session-local visibility only/i);
  assert.match(docFile, /broad refresh is blocked because the `\.blueprint\/codebase\/` bundle is missing/i);

  assert.match(
    runtimeReference,
    /`docs-update`[\s\S]*Long-running-mutation profile for scoped repo-doc refresh or verification/i
  );
  assert.match(
    runtimeReference,
    /`docs-update`[\s\S]*resolved scope, active stage, pending gate, execution mode, and next safe action visible/i
  );
  assert.match(
    runtimeReference,
    /`docs-update`[\s\S]*`update_topic` and `write_todos` for non-trivial docs-update runs/i
  );
  assert.match(
    runtimeReference,
    /`docs-update`[\s\S]*selected repo docs, source files, tests, and digest-backed Blueprint artifacts explicit as repo truth/i
  );
  assert.match(
    runtimeReference,
    /`docs-update`[\s\S]*cited external truth separate and optional/i
  );
  assert.match(
    runtimeReference,
    /`docs-update`[\s\S]*route evidence-light broad refreshes to `\/blu-map-codebase`/i
  );
});
