import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { blueprintArtifactScaffold } from "../src/mcp/tools/artifacts.js";
import {
  blueprintPhaseArtifactRead,
  blueprintPhaseArtifactWrite,
  blueprintPhaseResearchStatus
} from "../src/mcp/tools/phase.js";

const repoRoot = process.cwd();

async function createPhaseRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-research-phase-"));
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
- Last updated: 2026-04-11T00:00:00.000Z

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

**Researched:** 2026-04-11
**Domain:** research-phase parity repair
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-02 | User can run targeted phase research when technical uncertainty exists. | Use validated MCP-owned research writes and bounded agent output. |

## Summary

- ${summary}

## User Constraints

- Keep writes inside .blueprint/ and leave later lifecycle commands blocked until their substrate exists.

## Standard Stack

- TypeScript
- node:test via tsx --test

## Architecture Patterns

- Keep commands thin and move durable writes into MCP tools.

## Don't Hand-Roll

- Reuse phase resolution and artifact validation helpers instead of writing raw files directly.

## Common Pitfalls

- Letting scaffold placeholders masquerade as completed research.

## Code Examples

\`\`\`ts
await blueprintPhaseArtifactWrite({ phase: "3", artifact: "research", content });
\`\`\`

## Recommendations

- Persist only validated research content through \`blueprint_phase_artifact_write\`.

## Sources

- [Gemini CLI hooks reference](https://geminicli.com/docs/hooks/reference/) - confirms advisory hook event payloads.
- \`src/mcp/tools/phase.ts\` - existing phase resolution and recovery substrate.
`;
}

test("research-phase command references only registered tool names and safe routing text", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-research-phase.toml"),
    "utf8"
  );
  const requiredTools = [
    "blueprint_command_catalog",
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_phase_research_status",
    "blueprint_phase_artifact_read",
    "blueprint_phase_artifact_write",
    "blueprint_artifact_scaffold",
    "blueprint_state_load",
    "blueprint_state_update"
  ] as const;

  for (const toolName of requiredTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assert.match(commandFile, /Use the `blueprint-phase-discovery` skill/);
  assert.match(commandFile, /`blueprint-researcher` subagent/);
  assert.match(commandFile, /explicit confirmation/i);
  assert.match(commandFile, /`ask_user`/);
  assert.match(commandFile, /view/);
  assert.match(commandFile, /skip/);
  assert.match(commandFile, /update/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read")));
  assert.match(commandFile, /artifactId: "phase\.research"/);
  assert.match(commandFile, /authoringTemplate/);
  assert.match(commandFile, /\/blu-progress/);
  assert.doesNotMatch(commandFile, /\/blu-plan-phase/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-discovery\.md|agents\/blueprint-researcher\.md/);
});

test("research scaffold seeds the exact research template shape", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-RESEARCH.md"]
  });

  const scaffold = await readFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-RESEARCH.md"),
    "utf8"
  );

  assert.match(scaffold, /^# Phase 03: Phase Discovery - Research$/m);
  assert.match(scaffold, /^\*\*Researched:\*\*\s+<YYYY-MM-DD>$/m);
  assert.match(scaffold, /^\*\*Confidence:\*\*\s+LOW\|MEDIUM\|HIGH$/m);
  assert.match(scaffold, /^\| <requirement-id> \| <phase requirement> \| <evidence-backed guidance> \|$/m);
  assert.match(scaffold, /## Recommendations/);
  assert.match(scaffold, /- <repo path, URL, or cited file reference> - why it matters/);
  assert.match(scaffold, /\*Generated by `blueprint_artifact_scaffold`\*/);
});

test("phase artifact write creates, reuses, updates, and validates research content", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });
  const created = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: validResearchContent("Create a real research artifact instead of a scaffold."),
    overwrite: true
  });
  const afterCreate = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "03" });
  const createdArtifact = await blueprintPhaseArtifactRead({
    cwd: repoPath,
    phase: "03",
    artifact: "research"
  });

  const reused = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: validResearchContent("Create a real research artifact instead of a scaffold.")
  });
  const updated = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: validResearchContent("Update the artifact after an explicit overwrite path."),
    overwrite: true
  });
  const invalid = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: "# Phase 03: Phase Discovery - Research\n\n## Summary\n- Missing required sections.\n",
    overwrite: true
  });
  const researchBody = await readFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-RESEARCH.md"),
    "utf8"
  );

  assert.equal(created.status, "created");
  assert.equal(afterCreate.hasContext, true);
  assert.equal(afterCreate.hasResearch, true);
  assert.equal(afterCreate.researchValid, true);
  assert.deepEqual(afterCreate.researchIssues, []);
  assert.equal(createdArtifact.found, true);
  assert.equal(reused.status, "reused");
  assert.equal(updated.status, "updated");
  assert.equal(invalid.status, "invalid");
  assert.match(invalid.validation.issues.join("\n"), /required section|Confidence|source/i);
  assert.match(researchBody, /Update the artifact after an explicit overwrite path/);
});
