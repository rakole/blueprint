import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  artifactContractIds,
  listArtifactContracts,
  readArtifactContract,
  renderArtifactAuthoringTemplate,
  renderArtifactScaffoldTemplate
} from "../src/mcp/artifact-contracts/index.js";
import {
  blueprintPhaseArtifactRead,
  blueprintPhaseArtifactWrite,
  blueprintPhaseContext
} from "../src/mcp/tools/phase.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

const SPEC_PATH = ".blueprint/phases/03-phase-discovery/03-SPEC.md";
const AI_SPEC_PATH = ".blueprint/phases/03-phase-discovery/03-AI-SPEC.md";

async function createPhaseRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-spec-phase-");

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
- Last updated: 2026-05-21T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");

  return repoPath;
}

function validSpecContent(): string {
  return `# Phase 03: Phase Discovery - Specification

**Created:** 2026-05-21
**Ambiguity score:** 0.12 (gate: <= 0.20)
**Requirements:** 3 locked

## Goal

Blueprint can persist and reuse a canonical phase spec artifact for /blu-spec-phase without treating a missing spec as a lifecycle blocker.

## Background

The phase artifact substrate already persists context, discussion log, research, and UI spec documents under .blueprint/phases/. This slice adds a Blueprint-native spec artifact so later lifecycle steps can read a locked WHAT and WHY contract from the canonical phase directory.

## Requirements

1. **Canonical spec persistence**: Blueprint writes and reads one canonical phase spec artifact.
   - Current: The phase artifact substrate does not yet expose a canonical XX-SPEC.md artifact.
   - Target: blueprint_phase_artifact_write and blueprint_phase_artifact_read support artifact: "spec" at the phase-scoped canonical path.
   - Acceptance: Writing a valid spec for phase 3 produces .blueprint/phases/03-phase-discovery/03-SPEC.md and reading artifact: "spec" returns that saved Markdown.

2. **Optional missing state**: Missing phase specs remain optional.
   - Current: The runtime can distinguish missing saved artifacts, but spec support should not create a new readiness blocker.
   - Target: A missing spec returns found: false while phase context keeps lifecycle blocking semantics unchanged.
   - Acceptance: A missing spec read returns found: false and phase context does not list 03-SPEC.md in missingArtifacts.

3. **Canonical detection**: Blueprint ignores adjacent AI-specific files when reporting the phase spec.
   - Current: The phase directory may contain multiple spec-like files for nearby workflows.
   - Target: phase.artifacts.spec resolves only XX-SPEC.md and excludes XX-AI-SPEC.md.
   - Acceptance: 03-AI-SPEC.md alone does not populate phase.artifacts.spec, and when both files exist the canonical spec remains 03-SPEC.md.

## Boundaries

**In scope:**
- Canonical XX-SPEC.md read and write support
- Contract-backed scaffold and validation for phase.spec
- Phase context reporting for the canonical spec artifact

**Out of scope:**
- Treating 03-AI-SPEC.md as the canonical phase spec - that file belongs to adjacent AI-specific contract handling
- Adding lifecycle blockers for a missing spec - the thin substrate keeps missing specs optional

## Constraints

- Keep the artifact Blueprint-native and phase-scoped under .blueprint/phases/.
- Reuse existing MCP phase artifact helpers instead of introducing a parallel persistence path.

## Acceptance Criteria

- [ ] blueprint_phase_artifact_write persists a valid spec to the canonical XX-SPEC.md path
- [ ] blueprint_phase_artifact_read returns the saved canonical spec content
- [ ] blueprintPhaseContext reports XX-SPEC.md only when the canonical file is present

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.92 | 0.75 | pass | The artifact behavior is explicit and measurable. |
| Boundary Clarity | 0.88 | 0.70 | pass | Canonical versus adjacent AI-specific files is explicit. |
| Constraint Clarity | 0.84 | 0.65 | pass | The path and persistence constraints are concrete. |
| Acceptance Criteria | 0.90 | 0.70 | pass | Each criterion is a direct pass/fail check. |
| Ambiguity | 0.12 | <= 0.20 | pass | The remaining ambiguity is low. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Runtime owner | Where should the canonical spec live? | Save it beside the other phase artifacts under .blueprint/phases/. |
| 2 | Boundary keeper | Should missing specs block lifecycle progress? | No, the thin substrate keeps missing specs optional. |
| 3 | Contract checker | Which filename wins when AI-SPEC also exists? | XX-SPEC.md is canonical and XX-AI-SPEC.md is excluded. |

---

*Phase: 03-phase-discovery*
*Spec created: 2026-05-21*
*Next step: /blu-spec-phase 3 - refine the saved specification only if ambiguity remains*
`;
}

function invalidSpecContent(): string {
  return `# Phase 03: Phase Discovery - Specification

**Created:** 2026-05-21
**Ambiguity score:** 0.41 (gate: <= 0.20)
**Requirements:** 1 locked

## Goal

Add a spec somehow.
`;
}

function validSpecWithHeadingBoundaries(): string {
  return validSpecContent().replace(
    `**In scope:**
- Canonical XX-SPEC.md read and write support
- Contract-backed scaffold and validation for phase.spec
- Phase context reporting for the canonical spec artifact

**Out of scope:**
- Treating 03-AI-SPEC.md as the canonical phase spec - that file belongs to adjacent AI-specific contract handling
- Adding lifecycle blockers for a missing spec - the thin substrate keeps missing specs optional`,
    `### In scope

- Canonical XX-SPEC.md read and write support
- Contract-backed scaffold and validation for phase.spec
- Phase context reporting for the canonical spec artifact

### Out of scope

- Treating 03-AI-SPEC.md as the canonical phase spec - that file belongs to adjacent AI-specific contract handling
- Adding lifecycle blockers for a missing spec - the thin substrate keeps missing specs optional`
  );
}

function artifactSpecValue(context: Awaited<ReturnType<typeof blueprintPhaseContext>>): unknown {
  return (context.phase?.artifacts as Record<string, unknown> | undefined)?.spec;
}

test("phase spec write stores canonical XX-SPEC.md and read returns the saved Markdown", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const content = validSpecContent();
  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "spec",
    content,
    overwrite: true
  } as Parameters<typeof blueprintPhaseArtifactWrite>[0]);
  const savedContent = await readFile(path.join(repoPath, SPEC_PATH), "utf8");
  const readResult = await blueprintPhaseArtifactRead({
    cwd: repoPath,
    phase: "03",
    artifact: "spec"
  } as Parameters<typeof blueprintPhaseArtifactRead>[0]);

  assert.equal(written.status, "created", JSON.stringify(written, null, 2));
  assert.equal(written.written, true);
  assert.equal(written.path, SPEC_PATH);
  assert.equal(written.validation.valid, true, written.validation.issues.join("\n"));
  assert.equal(savedContent, readResult.content);
  assert.equal(readResult.phaseFound, true);
  assert.equal(readResult.found, true);
  assert.equal(readResult.path, SPEC_PATH);
  assert.match(readResult.content ?? "", /^# Phase 03: Phase Discovery - Specification$/m);
});

test("phase spec validation accepts heading-style boundary subsections", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "spec",
    content: validSpecWithHeadingBoundaries(),
    overwrite: true
  } as Parameters<typeof blueprintPhaseArtifactWrite>[0]);

  assert.equal(written.status, "created", JSON.stringify(written, null, 2));
  assert.equal(written.validation.valid, true, written.validation.issues.join("\n"));
});

test("missing phase spec stays optional: read returns found false and context does not list a blocker path", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const missing = await blueprintPhaseArtifactRead({
    cwd: repoPath,
    phase: "3",
    artifact: "spec"
  } as Parameters<typeof blueprintPhaseArtifactRead>[0]);
  const context = await blueprintPhaseContext({ cwd: repoPath, phase: "3" });

  assert.equal(missing.phaseFound, true);
  assert.equal(missing.found, false);
  assert.equal(missing.path, SPEC_PATH);
  assert.match(missing.reason ?? "", /03-SPEC\.md does not exist yet/i);
  assert.equal(context.missingArtifacts.includes(SPEC_PATH), false);
});

test("phase context reports the canonical spec artifact when XX-SPEC.md is present", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "spec",
    content: validSpecContent(),
    overwrite: true
  } as Parameters<typeof blueprintPhaseArtifactWrite>[0]);

  const context = await blueprintPhaseContext({ cwd: repoPath, phase: "3" });

  assert.ok(context.phase?.artifacts.all.includes(SPEC_PATH));
  assert.equal(artifactSpecValue(context), SPEC_PATH);
});

test("AI-SPEC alone does not populate phase.artifacts.spec", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, AI_SPEC_PATH),
    "# Phase 03: Phase Discovery - AI Spec\n\nThis is an adjacent AI-specific fixture.\n",
    "utf8"
  );

  const context = await blueprintPhaseContext({ cwd: repoPath, phase: "3" });

  assert.ok(context.phase?.artifacts.all.includes(AI_SPEC_PATH));
  assert.equal(artifactSpecValue(context) ?? null, null);
});

test("nested XX-SPEC.md does not populate phase.artifacts.spec", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery/archive"), {
    recursive: true
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/archive/03-SPEC.md"),
    "# Phase 03: Archived Specification\n\nThis nested fixture is not canonical.\n",
    "utf8"
  );

  const context = await blueprintPhaseContext({ cwd: repoPath, phase: "3" });

  assert.ok(context.phase?.artifacts.all.includes(
    ".blueprint/phases/03-phase-discovery/archive/03-SPEC.md"
  ));
  assert.equal(artifactSpecValue(context) ?? null, null);
});

test("canonical XX-SPEC.md wins when both XX-SPEC.md and XX-AI-SPEC.md exist", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "spec",
    content: validSpecContent(),
    overwrite: true
  } as Parameters<typeof blueprintPhaseArtifactWrite>[0]);
  await writeFile(
    path.join(repoPath, AI_SPEC_PATH),
    "# Phase 03: Phase Discovery - AI Spec\n\nThis is an adjacent AI-specific fixture.\n",
    "utf8"
  );

  const context = await blueprintPhaseContext({ cwd: repoPath, phase: "3" });

  assert.ok(context.phase?.artifacts.all.includes(SPEC_PATH));
  assert.ok(context.phase?.artifacts.all.includes(AI_SPEC_PATH));
  assert.equal(artifactSpecValue(context), SPEC_PATH);
});

test("canonical XX-SPEC.md wins when nested XX-SPEC.md also exists", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "spec",
    content: validSpecContent(),
    overwrite: true
  } as Parameters<typeof blueprintPhaseArtifactWrite>[0]);
  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery/archive"), {
    recursive: true
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/archive/03-SPEC.md"),
    "# Phase 03: Archived Specification\n\nThis nested fixture is not canonical.\n",
    "utf8"
  );

  const context = await blueprintPhaseContext({ cwd: repoPath, phase: "3" });

  assert.ok(context.phase?.artifacts.all.includes(SPEC_PATH));
  assert.ok(context.phase?.artifacts.all.includes(
    ".blueprint/phases/03-phase-discovery/archive/03-SPEC.md"
  ));
  assert.equal(artifactSpecValue(context), SPEC_PATH);
});

test("invalid phase spec write fails strict validation with actionable repair guidance", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalid = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "spec",
    content: invalidSpecContent(),
    overwrite: true
  } as Parameters<typeof blueprintPhaseArtifactWrite>[0]);

  assert.equal(invalid.status, "invalid");
  assert.equal(invalid.written, false);
  assert.equal(invalid.validation.valid, false);
  assert.ok((invalid.diagnostics ?? []).length > 0);
  assert.ok((invalid.suggestedRepairs ?? []).length > 0);
  assert.equal(invalid.retryPlan?.nextTool, "blueprint_phase_artifact_write");
  assert.match(
    invalid.validation.issues.join("\n"),
    /Background|Requirements|Boundaries|Acceptance Criteria|Ambiguity Report|Interview Log/i
  );
  assert.ok(
    (invalid.diagnostics ?? []).some(
      (diagnostic) => typeof diagnostic.repair === "string" && diagnostic.repair.length > 0
    )
  );
});

test("phase.spec appears in artifact contract listings and scaffold rendering stays Blueprint-native", () => {
  const listedContractIds = artifactContractIds.map(String);
  const listedContracts = listArtifactContracts().map((contract) => String(contract.id));
  const context = {
    phaseLabel: "Phase 03: Phase Discovery",
    phasePrefix: "03",
    phaseName: "Phase Discovery",
    phaseDir: "03-phase-discovery"
  };
  const contract = readArtifactContract("phase.spec", context);
  const authoringTemplate = renderArtifactAuthoringTemplate("phase.spec", context);
  const scaffoldTemplate = renderArtifactScaffoldTemplate("phase.spec", context);

  assert.ok(listedContractIds.includes("phase.spec"));
  assert.ok(listedContracts.includes("phase.spec"));
  assert.equal(contract.scope, "phase");
  assert.match(contract.canonicalFilePattern, /XX-SPEC\.md/);

  for (const heading of [
    "Goal",
    "Background",
    "Requirements",
    "Boundaries",
    "Constraints",
    "Acceptance Criteria",
    "Ambiguity Report",
    "Interview Log"
  ]) {
    assert.match(authoringTemplate, new RegExp(`## ${heading}`));
    assert.match(scaffoldTemplate, new RegExp(`## ${heading}`));
  }

  assert.match(
    authoringTemplate,
    /Each numbered requirement must include Current, Target, and Acceptance\./
  );
  assert.match(
    authoringTemplate,
    /Boundaries must include explicit In scope and Out of scope subsections\./
  );
  assert.match(authoringTemplate, /Acceptance Criteria must stay as checkbox bullets\./);
  assert.match(
    authoringTemplate,
    /Replace the scaffold metadata and every section below with Blueprint-native phase requirements/i
  );
  assert.match(scaffoldTemplate, /\*Generated by `blueprint_artifact_scaffold`\*/);
  assert.doesNotMatch(authoringTemplate, /\.planning\//);
  assert.doesNotMatch(scaffoldTemplate, /\.planning\//);
  assert.doesNotMatch(authoringTemplate, /\/gsd:|gsd-/i);
  assert.doesNotMatch(scaffoldTemplate, /\/gsd:|gsd-/i);
  assert.doesNotMatch(authoringTemplate, /Claude|Codex/);
  assert.doesNotMatch(scaffoldTemplate, /Claude|Codex/);
});
