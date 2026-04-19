import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintArtifactList } from "../src/mcp/tools/artifacts.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import { blueprintReviewLoadFindings, blueprintReviewRecord } from "../src/mcp/tools/review.js";

const repoRoot = process.cwd();

async function createSecurePhaseRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-secure-phase-"));
  const repoPath = path.join(tempRoot, "repo");
  const phaseDir = path.join(repoPath, ".blueprint/phases/05-security-audit");

  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Secure Phase Fixture

## Milestone

- Active milestone: v3

## Phases

- [x] **Phase 4: Delivery** - Completed implementation
- [ ] **Phase 5: Security Audit** - Review threat mitigations for the delivered phase

## Phase Details

### Phase 5: Security Audit
**Goal**: Capture a durable security audit for the completed phase.
**Requirements**: SEC-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v3
- Current phase: 5
- Active command: /blu-execute-phase
- Next action: Run /blu-validate-phase 5
- Last updated: 2026-04-12T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");
  await writeFile(
    path.join(phaseDir, "05-01-SUMMARY.md"),
    `# Phase 05: Security Audit - Summary 01

## Result

- Added the runtime review substrate and secure-phase command surface.
`,
    "utf8"
  );

  return repoPath;
}

test("secure-phase docs and catalog metadata promote the first review slice to implemented", async () => {
  const [catalogMarkdown, skillsMarkdown] = await Promise.all([
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/SKILLS-AND-AGENTS.md"), "utf8")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `secure-phase` \| 4 \| `Quality And Shipping` \| `blueprint-review` \| `implemented` \| `phase XX-SECURITY\.md` \| `Low: audit artifact only\.` \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-review` \| `implemented` \| Reviews, bounded remediation, security, UI, peer review \| `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `ui-review`, `review` \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-security-auditor` \| `implemented` \| Verify threat mitigations and security coverage \|/
  );
});

test("blueprint_review_record writes a phase-scoped security artifact with follow-up counts", async (t) => {
  const repoPath = await createSecurePhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const content = `# Phase 05: Security Audit - Security Review

**Posture:** FOLLOW_UP

## Security Summary

- The phase introduced the review substrate cleanly, but follow-up hardening is still visible.

## Evidence Reviewed

- .blueprint/phases/05-security-audit/05-01-SUMMARY.md

## Threat Register

| Threat ID | Disposition | Status | Evidence / Note |
|-----------|-------------|--------|-----------------|
| T-01 | mitigate | closed | Phase execution evidence shows the review substrate is persisted through MCP. |

## Accepted Risks

- none

## Findings

- The review path is MCP-owned and phase-scoped.

## Follow-Ups

- Add findings-load support before shipping the rest of the review family.

## Next Safe Action

- Run /blu-validate-phase 5 if verification is still pending.

## Security Audit Trail

- 2026-04-19: recorded the security audit against the completed phase evidence.
`;

  const written = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    content
  });

  assert.equal(written.status, "created");
  assert.equal(written.reportPath, ".blueprint/phases/05-security-audit/05-SECURITY.md");
  assert.equal(written.counts.findings, 1);
  assert.equal(written.counts.followUps, 1);
  assert.deepEqual(written.followUps, [
    "Add findings-load support before shipping the rest of the review family."
  ]);

  const saved = await readFile(path.join(repoPath, written.reportPath), "utf8");
  assert.match(saved, /\*\*Posture:\*\* FOLLOW_UP/);

  await assert.rejects(
    () =>
      blueprintReviewRecord({
        cwd: repoPath,
        phase: "5",
        artifact: "security",
        content: content.replace("FOLLOW_UP", "PASS")
      }),
    /explicit overwrite confirmation/
  );

  const artifactList = await blueprintArtifactList({ cwd: repoPath });
  assert.ok(
    artifactList.artifacts.phases.includes(".blueprint/phases/05-security-audit/05-SECURITY.md")
  );
});

test("blueprint_review_record counts open threat-register rows as security findings", async (t) => {
  const repoPath = await createSecurePhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const content = `# Phase 05: Security Audit - Security Review

**Posture:** FOLLOW_UP

## Security Summary

- The phase still has one open threat to resolve.

## Evidence Reviewed

- .blueprint/phases/05-security-audit/05-01-SUMMARY.md

## Threat Register

| Threat ID | Disposition | Status | Evidence / Note |
|-----------|-------------|--------|-----------------|
| T-01 | mitigate | open | Missing saved plan-read evidence for threat parsing. |

## Accepted Risks

- none

## Findings

- none

## Follow-Ups

- Re-read the executed plan before closing the phase.

## Security Audit Trail

- 2026-04-19: counted the open threat register row as a security finding.

## Next Safe Action

- /blu-validate-phase 5
`;

  const written = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    content
  });

  assert.equal(written.status, "created");
  assert.equal(written.counts.findings, 1);
  assert.equal(written.counts.followUps, 1);
  assert.deepEqual(written.followUps, [
    "Re-read the executed plan before closing the phase."
  ]);

  const loaded = await blueprintReviewLoadFindings({
    cwd: repoPath,
    phase: "5",
    artifact: "security"
  });

  assert.equal(loaded.found, true);
  assert.equal(loaded.findings.length, 1);
  assert.deepEqual(
    loaded.findings.map((finding) => [finding.id, finding.severity, finding.summary]),
    [["F-01", "unknown", "Open threat T-01: Missing saved plan-read evidence for threat parsing."]]
  );
  assert.deepEqual(loaded.severityCounts, {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    unknown: 1
  });
});

test("blueprint_review_record ignores placeholder none items in security review counts", async (t) => {
  const repoPath = await createSecurePhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const content = `# Phase 05: Security Audit - Security Review

**Posture:** PASS

## Security Summary

- The saved phase evidence shows the audit surface is in place.

## Evidence Reviewed

- .blueprint/phases/05-security-audit/05-01-SUMMARY.md

## Threat Register

| Threat ID | Disposition | Status | Evidence / Note |
|-----------|-------------|--------|-----------------|
| T-01 | mitigate | closed | The threat register has no open entries. |

## Accepted Risks

- none

## Findings

- none

## Follow-Ups

- none

## Security Audit Trail

- 2026-04-19: placeholder none items were ignored as empty entries.

## Next Safe Action

- /blu-progress
`;

  const written = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "5",
    artifact: "security",
    content
  });

  assert.equal(written.status, "created");
  assert.equal(written.counts.findings, 0);
  assert.equal(written.counts.followUps, 0);
  assert.deepEqual(written.followUps, []);
});

test("secure-phase is exposed as an implemented review command with the registered review tool", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["secure-phase"];

  assert.ok(blueprintToolNames.includes("blueprint_review_record"));
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-secure-phase.toml");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_artifact_list",
    "blueprint_phase_plan_index",
    "blueprint_phase_plan_read",
    "blueprint_artifact_contract_read",
    "blueprint_review_record"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-security-auditor"]);
});
