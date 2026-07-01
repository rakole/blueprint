import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { executeToolHandlerWithFailureLogging } from "../src/mcp/server.js";
import { blueprintPhaseArtifactWrite } from "../src/mcp/tools/phase.js";
import { MCP_WRITE_FAILURE_LOG_PATH } from "../src/mcp/write-failure-log.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

async function createPhaseRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-write-failure-log-");

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
- Last updated: 2026-04-17T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");

  return repoPath;
}

function validResearchContent(summary: string): string {
  return `# Phase 03: Phase Discovery - Research

**Researched:** 2026-04-17
**Domain:** failure logging
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-LOG | Capture MCP write failures before they reach the model. | Keep logging inside the MCP server wrapper and preserve validation evidence. |

## Summary

- ${summary}

## Locked Decisions From Context

- Mutating MCP tools must log rejected writes before surfacing the failure.

## User Constraints

- Keep the log inside .blueprint/.

## Standard Stack

- TypeScript on Node.js

## Installation And Setup

- Run the mutation failure tests against the local MCP write-failure log fixture.

## Alternatives Considered

- Silent rejection without an append-only failure log was rejected as too opaque.

## Architecture Patterns

- Capture failures centrally in MCP instead of duplicating logging in commands.

## Don't Hand-Roll

- Reuse existing phase artifact validation.

## Anti-Patterns

- Dropping the failing tool context when the write is rejected.

## State Of The Art

- Not externally checked; this failure-logging fixture validates local MCP behavior only.
- Blueprint keeps best-effort mutation diagnostics in .blueprint/mcp-write-failures.ndjson.

## Common Pitfalls

- Returning schema rejections without preserving the rejected payload details anywhere durable.

## Open Questions

- Should the failure log record more derived validation metadata for research writes?

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| Failure logging | HIGH | The test fixture verifies the write-failure log behavior directly. |

## Code Examples

\`\`\`ts
await blueprintPhaseArtifactWrite({ phase: "3", artifact: "research", content });
\`\`\`

## Recommendations

- Append structured failure entries before surfacing a rejection to the model.

## Sources

- \`src/mcp/server.ts\` - wraps registered Blueprint MCP tools.
`;
}

async function readFailureLogEntries(repoPath: string): Promise<Record<string, unknown>[]> {
  const raw = await readFile(path.join(repoPath, MCP_WRITE_FAILURE_LOG_PATH), "utf8");

  return raw
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

test("structured write rejections are logged before the invalid result is returned", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await executeToolHandlerWithFailureLogging(
    {
      name: "blueprint_phase_artifact_write",
      description: "fixture",
      handler: async (args: Record<string, unknown>) =>
        blueprintPhaseArtifactWrite(args as {
          cwd?: string;
          phase?: string;
          artifact: "research";
          content: string;
          overwrite?: boolean;
        })
    },
    {
      cwd: repoPath,
      phase: "3",
      artifact: "research",
      content: "# Phase 03: Phase Discovery - Research\n\n## Summary\n- Missing required sections.\n",
      overwrite: true
    }
  );

  assert.equal(result.status, "invalid");

  const [entry] = await readFailureLogEntries(repoPath);

  assert.equal(entry.toolName, "blueprint_phase_artifact_write");
  assert.equal(entry.failureKind, "rejected");
  assert.equal(
    (entry.result as Record<string, unknown>).status,
    "invalid"
  );
  assert.match(
    JSON.stringify((entry.result as Record<string, unknown>).validation),
    /Confidence|required section|source/i
  );
  assert.deepEqual((entry.request as Record<string, unknown>).artifact, "research");
  assert.equal(
    typeof ((entry.request as Record<string, unknown>).content as Record<string, unknown>)
      .length,
    "number"
  );
  assert.match(
    ((entry.request as Record<string, unknown>).content as Record<string, unknown>)
      .preview as string,
    /Missing required sections/
  );
});

test("thrown write failures are logged before the exception escapes MCP", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: validResearchContent("Seed a valid research artifact so the next write hits overwrite protection."),
    overwrite: true
  });

  await assert.rejects(
    executeToolHandlerWithFailureLogging(
      {
        name: "blueprint_phase_artifact_write",
        description: "fixture",
        handler: async (args: Record<string, unknown>) =>
          blueprintPhaseArtifactWrite(args as {
            cwd?: string;
            phase?: string;
            artifact: "research";
            content: string;
            overwrite?: boolean;
          })
      },
      {
        cwd: repoPath,
        phase: "3",
        artifact: "research",
        content: validResearchContent("Trigger overwrite protection without setting overwrite."),
        overwrite: false
      }
    ),
    /already exists/
  );

  const [entry] = await readFailureLogEntries(repoPath);

  assert.equal(entry.toolName, "blueprint_phase_artifact_write");
  assert.equal(entry.failureKind, "exception");
  assert.match(
    (entry.error as Record<string, unknown>).message as string,
    /already exists/
  );
  assert.match(
    (entry.error as Record<string, unknown>).stack as string,
    /src\/mcp\/tools\/phase\.ts|executeToolHandlerWithFailureLogging/
  );
});

test("non-standard mutation failure result shapes are logged durably", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const cases = [
    {
      toolName: "blueprint_patch_reapply",
      result: {
        status: "blocked",
        appliedPatches: [],
        skippedPatches: ["conflict"],
        conflicts: [{ patchId: "conflict", message: "patch does not apply" }],
        preview: false,
        targetHead: "abc123"
      }
    },
    {
      toolName: "blueprint_update_plan",
      result: {
        status: "created",
        persistenceStatus: "not_saved",
        path: null,
        intendedPath: "/Users/example/.gemini/blueprint/updates/update-plan-latest.json",
        warnings: ["Unable to persist Blueprint update artifacts."]
      }
    },
    {
      toolName: "blueprint_cleanup_archive",
      result: {
        status: "archived",
        mode: "commit",
        reportPath: ".blueprint/reports/cleanup-latest.md",
        reportWritten: false,
        archivedPhaseDirs: [".blueprint/phases/01-finished"],
        failedPhaseDirs: [],
        skippedPhaseDirs: [],
        keptPhaseDirs: [],
        issues: ["cleanup-latest could not be written"],
        reason: "Cleanup archive archived, but cleanup-latest could not be written."
      }
    }
  ];

  for (const entry of cases) {
    await executeToolHandlerWithFailureLogging(
      {
        name: entry.toolName,
        description: "fixture",
        handler: async () => entry.result
      },
      {
        cwd: repoPath,
        source: entry.toolName
      }
    );
  }

  const entries = await readFailureLogEntries(repoPath);

  assert.equal(entries.length, cases.length);
  assert.deepEqual(
    entries.map((entry) => entry.toolName),
    cases.map((entry) => entry.toolName)
  );

  for (const [index, entry] of entries.entries()) {
    assert.equal(entry.failureKind, "rejected");
    assert.equal((entry.request as Record<string, unknown>).source, cases[index]?.toolName);
  }

  assert.equal(
    ((entries[0]?.result as Record<string, unknown>).conflicts as unknown[]).length,
    1
  );
  assert.equal(
    (entries[1]?.result as Record<string, unknown>).persistenceStatus,
    "not_saved"
  );
  assert.equal(
    (entries[2]?.result as Record<string, unknown>).reportWritten,
    false
  );
});

test("phase ui skip write rejections are logged by the central mutation wrapper", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = {
    status: "invalid",
    written: false,
    artifact: "ui-spec",
    path: ".blueprint/phases/03-phase-discovery/03-UI-SPEC.md",
    validation: {
      valid: false,
      issues: ["UI skip artifact is missing the explicit skip rationale."],
      warnings: [],
      diagnostics: [
        {
          severity: "error",
          message: "UI skip artifact is missing the explicit skip rationale."
        }
      ]
    },
    warnings: []
  };

  await executeToolHandlerWithFailureLogging(
    {
      name: "blueprint_phase_ui_skip_write",
      description: "fixture",
      handler: async () => result
    },
    {
      cwd: repoPath,
      phase: "3",
      skipRationale: ""
    }
  );

  const [entry] = await readFailureLogEntries(repoPath);

  assert.equal(entry.toolName, "blueprint_phase_ui_skip_write");
  assert.equal(entry.failureKind, "rejected");
  assert.equal((entry.result as Record<string, unknown>).status, "invalid");
  assert.equal((entry.result as Record<string, unknown>).written, false);
  assert.match(
    JSON.stringify((entry.result as Record<string, unknown>).validation),
    /skip rationale/i
  );
});

test("god review stale and refused mutation results are logged durably", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const cases = [
    {
      toolName: "blueprint_god_review_record_fix",
      result: {
        status: "stale",
        written: false,
        staleReasons: ["Frozen scope changed since god-review started."],
        issues: ["Re-run god-review before recording hidden fix edits."],
        diagnostics: [
          {
            severity: "error",
            message: "Frozen scope changed since god-review started."
          }
        ]
      }
    },
    {
      toolName: "blueprint_god_review_start",
      result: {
        status: "refused",
        written: false,
        reason: "Hidden god-review mutator refused activation outside its owning workflow.",
        issues: ["Activation was denied before any side effects."]
      }
    }
  ];

  for (const entry of cases) {
    await executeToolHandlerWithFailureLogging(
      {
        name: entry.toolName,
        description: "fixture",
        handler: async () => entry.result
      },
      {
        cwd: repoPath,
        source: entry.toolName
      }
    );
  }

  const entries = await readFailureLogEntries(repoPath);

  assert.equal(entries.length, cases.length);
  assert.deepEqual(
    entries.map((entry) => entry.toolName),
    cases.map((entry) => entry.toolName)
  );

  for (const [index, entry] of entries.entries()) {
    assert.equal(entry.failureKind, "rejected");
    assert.equal((entry.result as Record<string, unknown>).status, cases[index]?.result.status);
  }
});
