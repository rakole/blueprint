import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { executeToolHandlerWithFailureLogging } from "../src/mcp/server.js";
import { blueprintPhaseArtifactWrite } from "../src/mcp/tools/phase.js";
import { MCP_WRITE_FAILURE_LOG_PATH } from "../src/mcp/write-failure-log.js";

async function createPhaseRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-write-failure-log-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
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
    /blueprintPhaseArtifactWrite/
  );
});
