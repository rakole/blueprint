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

test("concurrent phase context creates require overwrite after the first canonical write wins", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const results = await Promise.allSettled([
    blueprintPhaseArtifactWrite({
      cwd: repoPath,
      phase: "3",
      artifact: "context",
      model: validPhaseContextModel({ openQuestions: ["Which source writes first?"] })
    }),
    blueprintPhaseArtifactWrite({
      cwd: repoPath,
      phase: "3",
      artifact: "context",
      model: validPhaseContextModel({ openQuestions: ["Which source writes second?"] })
    })
  ]);
  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof blueprintPhaseArtifactWrite>>> =>
      result.status === "fulfilled"
  );
  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected"
  );
  const savedContent = await readFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
    "utf8"
  );

  assert.equal(fulfilled.length, 1, JSON.stringify(results, null, 2));
  assert.equal(rejected.length, 1, JSON.stringify(results, null, 2));
  assert.equal(fulfilled[0]?.value.status, "created");
  assert.match(String(rejected[0]?.reason), /already exists.*explicit overwrite/i);
  assert.match(savedContent, /Which source writes (first|second)\?/);
});

test("phase context write renders honest empty model arrays as none sentinels", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model: validPhaseContextModel({
      openQuestions: [],
      deferredIdeas: [],
      priorPhaseArtifacts: [],
      externalConstraints: []
    })
  });

  assert.equal(written.status, "created", JSON.stringify(written, null, 2));
  const savedContent = await readFile(path.join(repoPath, written.path), "utf8");

  assert.match(
    savedContent,
    /- Prior phase artifacts:\n- none\n- External constraints:\n- none\n- Required follow-up reads:/m
  );
  assert.match(savedContent, /## Open Questions\n\n- none/);
  assert.match(savedContent, /## Deferred Ideas\n\n- none/);
});

test("phase context model diagnostics include field-aware repair guidance", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const model = validPhaseContextModel();

  (model as { specificIdeas: unknown }).specificIdeas = "none";
  delete (model as { phaseBoundary?: unknown }).phaseBoundary;

  const invalid = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model
  });

  assert.equal(invalid.status, "invalid");
  assert.ok(invalid.diagnostics?.some((diagnostic) => diagnostic.path === "model.specificIdeas"));
  assert.match(invalid.suggestedRepairs?.join("\n") ?? "", /Set model\.specificIdeas to the type required/i);
});

test("phase context model diagnostics reject scalar openQuestions none", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const model = validPhaseContextModel() as Record<string, unknown>;

  model.openQuestions = "none";

  const invalid = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model
  });

  assert.equal(invalid.status, "invalid");
  assert.ok(invalid.diagnostics?.some((diagnostic) => diagnostic.path === "model.openQuestions"));
  assert.match(
    invalid.suggestedRepairs?.join("\n") ?? "",
    /Use openQuestions: \[\] when no open questions remain/i
  );
  assert.doesNotMatch(invalid.suggestedRepairs?.join("\n") ?? "", /scalar openQuestions: "none"/i);
});

test("phase context model diagnostics keep nested type repair paths intact", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const model = validPhaseContextModel();

  (model.dependencies as { priorPhaseArtifacts: unknown }).priorPhaseArtifacts = 7;

  const invalid = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model
  });

  assert.equal(invalid.status, "invalid");
  assert.ok(
    invalid.diagnostics?.some(
      (diagnostic) => diagnostic.path === "model.dependencies.priorPhaseArtifacts"
    )
  );
  assert.match(
    invalid.suggestedRepairs?.join("\n") ?? "",
    /Set model\.dependencies\.priorPhaseArtifacts/i
  );
  assert.doesNotMatch(
    invalid.suggestedRepairs?.join("\n") ?? "",
    /Add model\.priorPhaseArtifacts/i
  );
});

test("phase context write normalizes none alias outside openQuestions", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    model: validPhaseContextModel({
      deferredIdeas: ["none"]
    })
  });

  assert.equal(invalid.status, "created");
  assert.equal(invalid.written, true);
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
  assert.ok(
    validation.diagnostics.some(
      (diagnostic) =>
        diagnostic.artifactId === "phase.context" &&
        diagnostic.path === "content.sections.Discovery Grounding" &&
        diagnostic.code === "context.missing_required_section"
    )
  );
  assert.match(validation.suggestedRepairs.join("\n"), /\/blu-discuss-phase/);
  assert.match(validation.suggestedRepairs.join("\n"), /\/blu-ui-phase/);
});

test("sparse context models normalize defaults, optional aliases, and safe multiline prose", async (t) => {
  const { validatePhaseContextModelInput, renderPhaseContextModelContent, phaseContextAuthoringSchema } = await import("../src/mcp/tools/phase-context-model.js");
  const { validatePhaseArtifactContent } = await import("../src/mcp/tools/artifacts.js");
  const defaults = { phaseBoundary: { goal: "Ship exports", inScope: ["CSV"], successCriteria: ["Exports open"] } };
  const cases = [
    {},
    { specificIdeas: null, deferredIdeas: ["none"], dependencies: { externalConstraints: ["N/A"] } },
    { implementationDecisions: [{ decision: "Use CSV" }], canonicalReferences: [{ source: "Customer interview" }] },
    { specificIdeas: ["Nothing should be dropped.", "None of the exporters support XML.", "Batch mode is supported."] },
    { phaseBoundary: { goal: "Ship exports\n## Fake heading" }, implementationDecisions: [{ decision: "CSV | TSV\n## Fake row" }] },
  ];
  const z = await import("zod/v4");
  const transport = z.object({ model: phaseContextAuthoringSchema });
  for (const candidate of cases) {
    assert.equal(transport.safeParse({ model: candidate }).success, true, JSON.stringify(candidate));
    const result = validatePhaseContextModelInput(candidate, defaults);
    assert.ok(result.model, JSON.stringify(result.validation));
    const content = renderPhaseContextModelContent({ resolved: { phasePrefix: "03", phaseName: "Exports" }, model: result.model });
    assert.equal(validatePhaseArtifactContent(content, "context").valid, true, content);
    assert.equal(content.split("\n").filter((line) => line.startsWith("## ")).length, 9);
    assert.doesNotMatch(content, /^## Fake/m);
  }
  const normalized = validatePhaseContextModelInput(cases[1], defaults).model!;
  assert.deepEqual(normalized.specificIdeas, []);
  assert.deepEqual(normalized.deferredIdeas, []);
  assert.deepEqual(normalized.dependencies.externalConstraints, []);
  assert.deepEqual(validatePhaseContextModelInput(cases[3], defaults).model!.specificIdeas, cases[3].specificIdeas);

  const repoPath = await createPhaseRepo();
  t.after(() => rm(path.dirname(repoPath), { recursive: true, force: true }));
  const saved = await blueprintPhaseArtifactWrite({ cwd: repoPath, phase: "3", artifact: "context", model: defaults });
  assert.equal(saved.written, true, JSON.stringify(saved.validation));
  const status = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });
  assert.doesNotMatch(JSON.stringify(status), /context\.missing_required_section|context\.non_substantive/);
});

test("context authoring retains essential intent, type, and unsafe-input validation", async () => {
  const { validatePhaseContextModelInput } = await import("../src/mcp/tools/phase-context-model.js");
  const boundary = { goal: "Ship", inScope: ["CSV"], successCriteria: ["Works"] };
  for (const candidate of [
    {}, { phaseBoundary: { ...boundary, goal: "none" } },
    { phaseBoundary: { ...boundary, inScope: [] } },
    { phaseBoundary: { ...boundary, successCriteria: null } },
    { phaseBoundary: boundary, dependencies: 7 },
    { phaseBoundary: boundary, implementationDecisions: [{}] },
    { phaseBoundary: boundary, canonicalReferences: [{ relevance: "Useful" }] },
    { phaseBoundary: boundary, specificIdeas: "none" },
    { phaseBoundary: boundary, specificIdeas: ["unsafe\u0000text"] },
    JSON.parse(JSON.stringify({ phaseBoundary: boundary }).replace('"phaseBoundary":', '"__proto__":{},"phaseBoundary":')),
  ]) assert.equal(validatePhaseContextModelInput(candidate).model, null, JSON.stringify(candidate));
});
