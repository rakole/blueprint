import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { blueprintArtifactValidate } from "../src/mcp/tools/artifacts.js";
import {
  blueprintPhaseArtifactWrite,
  blueprintPhaseResearchStatus
} from "../src/mcp/tools/phase.js";
import { validPhaseContextModel } from "./helpers/context-model.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

async function createPhaseRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-context-diagnostics-");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery**
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 3
- Active command: /blu-progress
- Next action: Run /blu-progress
- Last updated: 2026-04-11T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");

  return repoPath;
}

test("phase context write rejects Markdown fallback with actionable diagnostics", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    content: `# Phase 03: Phase Discovery - Context

## Phase Boundary

- Keep discovery scoped to this phase.
`
  });

  assert.equal(invalid.status, "invalid");
  assert.equal(invalid.written, false);
  assert.ok(invalid.diagnostics?.some((diagnostic) => diagnostic.code === "write.model_only"));
  assert.ok(invalid.diagnostics?.every((diagnostic) => diagnostic.retryable));
  assert.match(invalid.diagnostics?.map((diagnostic) => diagnostic.path).join("\n") ?? "", /args\.content/);
  assert.match(invalid.suggestedRepairs?.join("\n") ?? "", /structured phase\.context model/i);
  assert.equal(invalid.retryPlan?.nextTool, "blueprint_phase_artifact_write");
  assert.match(invalid.retryPlan?.steps.join("\n") ?? "", /phase\.context/);
});

test("phase context write accepts structured model and renders canonical context markdown", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model: validPhaseContextModel({ openQuestions: ["none"] })
  });

  assert.equal(written.status, "created", JSON.stringify(written, null, 2));
  const savedContent = await readFile(path.join(repoPath, written.path), "utf8");

  assert.match(savedContent, /## Phase Boundary/);
  assert.match(savedContent, /## Canonical References/);
  assert.match(savedContent, /\| Source \| Relevance \|/);
});

test("phase research status surfaces underlying context validation issues", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
    `# Phase 03: Phase Discovery - Context

## Phase Boundary

- Keep discovery scoped to this phase.
`,
    "utf8"
  );

  const status = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });

  assert.equal(status.hasUsableContext, false);
  assert.ok(status.contextDiagnostics.some((diagnostic) => diagnostic.code === "context.missing_required_section"));
  assert.match(status.planningReadiness.blockers.join("\n"), /Context validation:/);
  assert.ok(
    status.planningReadiness.diagnostics?.some(
      (diagnostic) => diagnostic.code === "context.missing_required_section"
    )
  );
});

test("global artifact validation includes phase context discussion and UI spec artifacts", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
    `# Phase 03: Phase Discovery - Context

## Phase Boundary

- Keep discovery scoped to this phase.
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-DISCUSSION-LOG.md"),
    "# Phase 03: Phase Discovery - Discussion Log\n",
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-UI-SPEC.md"),
    "# Phase 03: Phase Discovery - UI Spec\n",
    "utf8"
  );

  const validation = await blueprintArtifactValidate({ cwd: repoPath });

  assert.equal(validation.valid, false);
  assert.match(validation.issues.join("\n"), /03-CONTEXT\.md/);
  assert.match(validation.issues.join("\n"), /03-DISCUSSION-LOG\.md/);
  assert.match(validation.issues.join("\n"), /03-UI-SPEC\.md/);
  assert.match(validation.suggestedRepairs.join("\n"), /\/blu-discuss-phase/);
  assert.match(validation.suggestedRepairs.join("\n"), /\/blu-ui-phase/);
});
