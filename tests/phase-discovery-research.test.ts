import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import {
  blueprintArtifactContractRead,
  blueprintArtifactScaffold
} from "../src/mcp/tools/artifacts.js";
import {
  blueprintPhaseArtifactRead,
  blueprintPhaseArtifactWrite,
  blueprintPhaseContext,
  blueprintPhaseResearchStatus
} from "../src/mcp/tools/phase.js";
import {
  blueprintStateLoad,
  blueprintStateUpdate
} from "../src/mcp/tools/state.js";

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

## Locked Decisions From Context

- Keep Blueprint state writes inside MCP tools and preserve implemented-only routing.

## User Constraints

- Keep writes inside .blueprint/ and leave later lifecycle commands blocked until their substrate exists.

## Standard Stack

- TypeScript
- node:test via tsx --test

## Installation And Setup

- Run the repo build and focused tests before accepting a research-contract change.

## Alternatives Considered

- A prompt-local research outline was rejected because it drifts from the canonical MCP template.

## Architecture Patterns

- Keep commands thin and move durable writes into MCP tools.

## Don't Hand-Roll

- Reuse phase resolution and artifact validation helpers instead of writing raw files directly.

## Anti-Patterns

- Letting the subagent invent or trim headings outside the canonical contract.

## State Of The Art

- Repo-local guidance is current as of 2026-04-11; external currency not externally checked.

## Common Pitfalls

- Letting scaffold placeholders masquerade as completed research.

## Open Questions

- Should the research flow require multiple sources for critical external claims?

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| Research artifact writes | HIGH | The repo already routes persistence through validated MCP tools. |

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
  const docFile = await readFile(
    path.join(repoRoot, "docs/commands/research-phase.md"),
    "utf8"
  );
  const runtimeReference = await readFile(
    path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"),
    "utf8"
  );
  const mcpToolsDoc = await readFile(path.join(repoRoot, "docs/MCP-TOOLS.md"), "utf8");
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-discovery/SKILL.md"),
    "utf8"
  );
  const researcherAgent = await readFile(
    path.join(repoRoot, "agents/blueprint-researcher.md"),
    "utf8"
  );
  const runtimeContract = await readFile(
    path.join(
      repoRoot,
      "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md"
    ),
    "utf8"
  );
  const requiredTools = [
    "blueprint_command_catalog",
    "blueprint_config_get",
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_phase_research_status",
    "blueprint_phase_artifact_read",
    "blueprint_phase_artifact_write",
    "blueprint_phase_checkpoint_get",
    "blueprint_phase_checkpoint_put",
    "blueprint_phase_checkpoint_delete",
    "blueprint_artifact_scaffold",
    "blueprint_state_load",
    "blueprint_state_update"
  ] as const;

  for (const toolName of requiredTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assert.match(commandFile, /Use the `blueprint-phase-discovery` skill/);
  assert.match(commandFile, /research-phase-runtime-contract\.md/);
  assert.match(commandFile, /`blueprint-researcher` subagent/);
  assert.match(commandFile, /explicit confirmation/i);
  assert.match(commandFile, /`ask_user`/);
  assert.match(commandFile, /view/);
  assert.match(commandFile, /skip/);
  assert.match(commandFile, /update/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read")));
  assert.match(commandFile, /artifactId: "phase\.research"/);
  assert.match(commandFile, /contract\.authoringTemplate/);
  assert.match(commandFile, /artifact_read` for the current `context` artifact before drafting|actual current context content/i);
  assert.match(commandFile, /If the current `context` artifact read reports `found: false`/i);
  assert.match(commandFile, /do not draft research until saved context exists/i);
  assert.match(commandFile, /do not offer `skip`, `view`, or default reuse as a successful exit/i);
  assert.match(commandFile, /valid `view`\/`skip`\/`reuse` exit, call .*state_update.*base: "synced"/is);
  assert.match(commandFile, /Draft directly from `contract\.authoringTemplate`/i);
  assert.match(commandFile, /phase_checkpoint_get/i);
  assert.match(commandFile, /phase_checkpoint_put/i);
  assert.match(commandFile, /phase_checkpoint_delete/i);
  assert.match(commandFile, /expectedOwnerCommand: "\/blu-research-phase"/);
  assert.match(commandFile, /expectedMode: "research"/);
  assert.match(
    commandFile,
    /phase_checkpoint_delete[\s\S]*expectedOwnerCommand: "\/blu-research-phase"[\s\S]*expectedMode: "research"/i
  );
  assert.match(commandFile, /topic-sized strands/i);
  assert.match(commandFile, /long-running-mutation/);
  assert.match(commandFile, /update_topic/);
  assert.match(commandFile, /write_todos/);
  assert.match(commandFile, /inconclusive/i);
  assert.match(commandFile, /Keep repo truth explicit/i);
  assert.match(commandFile, /Honor the effective `research\.external_sources` policy/i);
  assert.match(commandFile, /`off` means do not perform external lookup and mark freshness-sensitive claims as not externally checked/i);
  assert.match(commandFile, /`ask` means stop for confirmation before any external check/i);
  assert.match(commandFile, /`auto` allows official-doc or external verification/i);
  assert.match(commandFile, /official docs or explicitly supplied external references/i);
  assert.match(commandFile, /distinct from repo-derived evidence/i);
  assert.match(commandFile, /source title, date, URL, excerpt, claim, and evidence class/i);
  assert.match(commandFile, /must not imply it fetched official docs itself/i);
  assert.match(commandFile, /`## State Of The Art` freshness claims explicit/i);
  assert.match(commandFile, /not externally checked/i);
  assert.match(commandFile, /single-agent fallback/i);
  assert.match(commandFile, /browser-only, web-search-only, shell-only, or generic agents/i);
  assert.match(commandFile, /PROJECT\.md/);
  assert.match(commandFile, /REQUIREMENTS\.md/);
  assert.match(commandFile, /STATE\.md/);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(commandFile, /\/blu-plan-phase/);
  assert.match(commandFile, /\/blu-discuss-phase/);
  assert.match(commandFile, /Do not treat its response as a routing decision/i);
  assert.match(commandFile, /blueprint_state_load.+reported next safe action comes from the refreshed state/i);
  assert.match(commandFile, /refreshed safe action is `\/blu-plan-phase`/i);
  assert.doesNotMatch(commandFile, /state_update[^\n]+set the next safe action/i);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-discovery\.md|agents\/blueprint-researcher\.md/);
  assert.ok(docFile.includes("`blueprint_artifact_contract_read` -> `{artifactId, contract}`"));
  assert.ok(docFile.includes("contract.authoringTemplate"));
  assert.ok(docFile.includes("contract.freehandPolicy"));
  assert.ok(docFile.includes("additional-top-level-headings"));
  assert.match(docFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(docFile, /topic-strand phase research/i);
  assert.match(docFile, /update_topic/);
  assert.match(docFile, /write_todos/);
  assert.match(docFile, /repo truth/i);
  assert.match(docFile, /research\.external_sources/i);
  assert.match(docFile, /workflowPosture\.research\.externalSources/i);
  assert.match(docFile, /source title, source date, URL, excerpt, claim/i);
  assert.match(docFile, /not externally checked/i);
  assert.match(docFile, /official docs or explicitly supplied external references/i);
  assert.match(docFile, /Missing `XX-CONTEXT\.md` is a visible gate/i);
  assert.match(docFile, /invalid existing research as repair-only/i);
  assert.match(docFile, /reserves scaffold for deliberate placeholder creation only/i);
  assert.match(docFile, /refresh `STATE\.md` on valid non-writing exits/i);

  assert.match(runtimeReference, /\| `research-phase` \|[\s\S]*?blueprint_phase_checkpoint_get[\s\S]*?blueprint_phase_checkpoint_put[\s\S]*?blueprint_phase_checkpoint_delete/);
  assert.match(runtimeReference, /Long-running-mutation profile for topic-strand phase research/i);
  assert.match(runtimeReference, /update_topic/);
  assert.match(runtimeReference, /write_todos/);
  assert.match(runtimeReference, /blueprint_config_get/);
  assert.match(runtimeReference, /research\.external_sources/);
  assert.match(runtimeReference, /not externally checked/i);
  assert.match(runtimeReference, /repo truth/i);
  assert.match(runtimeReference, /external truth/i);
  assert.match(runtimeReference, /stop on missing `XX-CONTEXT\.md`/i);
  assert.match(runtimeReference, /reserve `blueprint_artifact_scaffold` for deliberate placeholder creation only/i);
  assert.match(runtimeReference, /force repair when existing research is invalid/i);
  assert.match(runtimeReference, /sync `STATE\.md` even on valid non-writing reuse paths/i);
  assert.match(
    mcpToolsDoc,
    /`research-phase` uses phase location\/context, research status, discovery artifact read and write tools, research checkpoint tools, `blueprint_artifact_contract_read`, optional deliberate scaffolding, `blueprint_config_get`, `blueprint_state_load`, `blueprint_command_catalog`, and `blueprint_state_update`/i
  );
  assert.match(mcpToolsDoc, /research-phase-runtime-contract\.md/);
  assert.match(mcpToolsDoc, /workflowPosture\.research\.externalSources/);
  assert.match(mcpToolsDoc, /off`\/`ask`\/`auto`/i);
  assert.match(mcpToolsDoc, /not externally checked/i);
  assert.match(mcpToolsDoc, /single-agent topic-strand fallback/i);
  assert.match(mcpToolsDoc, /reject browser\/web-search\/shell-only or generic agents/i);
  assert.match(mcpToolsDoc, /stop on missing `XX-CONTEXT\.md`/i);
  assert.match(mcpToolsDoc, /force repair when existing research is invalid/i);
  assert.match(mcpToolsDoc, /sync `STATE\.md` even on valid non-writing reuse paths/i);

  assert.match(skillFile, /Execution profile for `\/blu-research-phase`: `long-running-mutation`/);
  assert.match(skillFile, /research-phase-runtime-contract\.md/);
  assert.match(skillFile, /update_topic/);
  assert.match(skillFile, /write_todos/);
  assert.match(skillFile, /blueprint_config_get/);
  assert.match(skillFile, /research\.external_sources/);
  assert.match(skillFile, /official docs or explicitly supplied external references/i);
  assert.match(skillFile, /repo-derived evidence distinct from external or web-derived evidence/i);
  assert.match(skillFile, /source title, date, URL, excerpt, claim/i);
  assert.match(skillFile, /not externally checked/i);
  assert.match(skillFile, /single-agent fallback/i);
  assert.match(skillFile, /browser-only, web-search-only, shell-only, or generic agents/i);
  assert.match(skillFile, /repair the same normalized draft/i);
  assert.match(skillFile, /If that read reports `found: false`, stop and route back to `\/blu-discuss-phase <phase>`/i);
  assert.match(skillFile, /Force repair when saved research is invalid/i);
  assert.match(skillFile, /Draft directly from `contract\.authoringTemplate`/i);
  assert.match(skillFile, /valid `view`\/`skip`\/`reuse` exit, call `blueprint_state_update` with `base: "synced"`/i);
  const contract = await buildBlueprintCommandRuntimeContractResource("research-phase");

  assert.deepEqual(contract.skillInputs.shared, [
    "docs/ARTIFACT-SCHEMA.md",
    "docs/MCP-TOOLS.md"
  ]);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "docs/commands/research-phase.md",
    "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md"
  ]);
  assert.deepEqual(contract.skillInputs.effective, [
    "docs/ARTIFACT-SCHEMA.md",
    "docs/MCP-TOOLS.md",
    "docs/commands/research-phase.md",
    "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md"
  ]);
  assert.equal(
    contract.skillInputs.effective.includes("docs/commands/discuss-phase.md"),
    false
  );
  assert.equal(contract.skillInputs.effective.includes("docs/commands/ui-phase.md"), false);
  assert.equal(
    contract.skillInputs.effective.includes("docs/commands/list-phase-assumptions.md"),
    false
  );

  assert.match(researcherAgent, /comparing repo evidence against official docs with clear provenance/i);
  assert.match(researcherAgent, /parent-supplied official-doc evidence/i);
  assert.match(researcherAgent, /repo-root `AGENTS\.md`/i);
  assert.match(
    researcherAgent,
    /official-doc or explicitly supplied external references|official docs or supplied external references/i
  );
  assert.match(researcherAgent, /provenance\s+captured at the claim level/i);
  assert.match(
    researcherAgent,
    /comparison\s+notes when official-doc or external evidence packets are part of the evidence set/i
  );
  assert.match(researcherAgent, /does not fetch official docs itself/i);
  assert.match(researcherAgent, /return the claim as unverified/i);
  assert.match(researcherAgent, /source title, date, URL,[\s\S]*excerpt, and claim/i);
  assert.match(researcherAgent, /not externally checked/i);
  assert.match(researcherAgent, /Keep citations, provenance, and repo-path evidence in `## Sources`/i);
  assert.match(researcherAgent, /Output Quality Expectations/);
  assert.match(researcherAgent, /what does `\/blu-plan-phase` need to know/i);
  assert.match(researcherAgent, /Repo evidence/);
  assert.match(researcherAgent, /Official\s+reference/);
  assert.match(researcherAgent, /Inference/);
  assert.match(researcherAgent, /Do not substitute browser-only, web-search-only, shell-only, or generic-agent/i);
  assert.match(runtimeContract, /Shared Stage Mapping/);
  assert.match(runtimeContract, /Required MCP Calls/);
  assert.match(runtimeContract, /Artifact Authoring Rules/);
  assert.match(runtimeContract, /Capability-Gated Subagent Path/);
  assert.match(runtimeContract, /No-Subagent Fallback/);
  assert.match(runtimeContract, /Retry And Repair Behavior/);
  assert.match(runtimeContract, /Output Quality Criteria/);
  assert.match(runtimeContract, /Completion Criteria/);
  assert.match(runtimeContract, /contract\.authoringTemplate/);
  assert.match(runtimeContract, /blueprint_config_get/);
  assert.match(runtimeContract, /workflowPosture\.research\.externalSources/);
  assert.match(runtimeContract, /`off` means no live external lookup/i);
  assert.match(runtimeContract, /`ask` means confirm[\s\S]*first/i);
  assert.match(runtimeContract, /explicit source dates/i);
  assert.match(runtimeContract, /not externally checked|external currency was not checked/i);
  assert.match(runtimeContract, /stop and route back to\s+`\/blu-discuss-phase <phase>`/i);
  assert.match(runtimeContract, /Default drafting should start from\s+`contract\.authoringTemplate`/i);
  assert.match(runtimeContract, /do not allow skip, default reuse, or an\s+unchanged invalid write result/i);
  assert.match(runtimeContract, /sync `STATE\.md` through `blueprint_state_update` with `base: "synced"`/i);
  assert.match(runtimeContract, /blueprint_phase_artifact_write` returns `status: "invalid"`/);
  assert.match(runtimeContract, /repair[\s\S]*same normalized draft/i);
  assert.match(runtimeContract, /browser-only, web-search-only, shell-only, or\s+generic agents/i);
});

test("phase context surfaces the effective external-source policy for research", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify(
      {
        version: 2,
        research: {
          external_sources: "ask"
        }
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  const context = await blueprintPhaseContext({ cwd: repoPath, phase: "3" });

  assert.equal(context.workflowPosture.research.externalSources, "ask");
  assert.match(context.workflowPosture.summary, /external sources: ask/);
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
  assert.match(scaffold, /## Locked Decisions From Context/);
  assert.match(scaffold, /## Installation And Setup/);
  assert.match(scaffold, /## Alternatives Considered/);
  assert.match(scaffold, /## Anti-Patterns/);
  assert.match(scaffold, /## State Of The Art/);
  assert.match(
    scaffold,
    /current ecosystem or repo update with source date YYYY-MM-DD, or say not externally checked/
  );
  assert.match(scaffold, /## Open Questions/);
  assert.match(scaffold, /## Confidence Breakdown/);
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
  const contract = await blueprintArtifactContractRead({ artifactId: "phase.research" });
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
  assert.equal(contract.artifactId, "phase.research");
  assert.match(contract.contract.authoringTemplate, /# Phase XX: <Phase Name> - Research/);
  assert.equal(contract.contract.freehandPolicy, "additional-top-level-headings");
  assert.match(contract.contract.notes.join("\n"), /planner-grade evidence density/i);
  assert.match(contract.contract.notes.join("\n"), /repo-versus-external provenance/i);
  assert.equal(reused.status, "reused");
  assert.equal(updated.status, "updated");
  assert.equal(invalid.status, "invalid");
  assert.match(invalid.validation.issues.join("\n"), /required section|Confidence|source/i);
  assert.match(researchBody, /Update the artifact after an explicit overwrite path/);
});

test("research scaffold can be replaced by substantive content without explicit overwrite", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-RESEARCH.md"]
  });

  const scaffoldStatus = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });
  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: validResearchContent("Replace the scaffold with substantive research content.")
  });
  const finalStatus = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });

  assert.equal(scaffoldStatus.hasResearch, true);
  assert.equal(scaffoldStatus.researchValid, false);
  assert.match(scaffoldStatus.researchIssues.join("\n"), /scaffold placeholder text/i);
  assert.equal(written.status, "updated");
  assert.equal(written.written, true);
  assert.equal(written.overwritten, true);
  assert.match(written.warnings.join("\n"), /Replacing the existing scaffold research artifact/i);
  assert.equal(finalStatus.researchValid, true);
});

test("invalid existing research must be repaired instead of being treated as reused", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const researchPath = path.join(
    repoPath,
    ".blueprint/phases/03-phase-discovery/03-RESEARCH.md"
  );
  const invalidContent = "# Phase 03: Phase Discovery - Research\n\n## Summary\n- Missing required sections.\n";

  await writeFile(researchPath, invalidContent, "utf8");

  const statusBefore = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });
  const unchanged = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: invalidContent
  });
  await assert.rejects(
    () =>
      blueprintPhaseArtifactWrite({
        cwd: repoPath,
        phase: "3",
        artifact: "research",
        content: validResearchContent("Repair the invalid research artifact in place.")
      }),
    /already exists/
  );
  const repaired = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: validResearchContent("Repair the invalid research artifact in place."),
    overwrite: true
  });
  const statusAfter = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });

  assert.equal(statusBefore.hasResearch, true);
  assert.equal(statusBefore.researchValid, false);
  assert.match(statusBefore.suggestedRepairs.join("\n"), /Update the phase research through \/blu-research-phase/i);
  assert.equal(unchanged.status, "invalid");
  assert.equal(unchanged.written, false);
  assert.match(unchanged.validation?.issues.join("\n") ?? "", /required section|Confidence|source/i);
  assert.equal(repaired.status, "updated");
  assert.equal(repaired.written, true);
  assert.equal(statusAfter.researchValid, true);
});

test("research validation requires dated freshness claims or an explicit unchecked marker", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const invalid = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: validResearchContent(
      "Create research that forgets to date the State Of The Art section."
    ).replace(
      "- Repo-local guidance is current as of 2026-04-11; external currency not externally checked.",
      "- Template-driven research generation keeps drafting aligned with the MCP-owned schema."
    ),
    overwrite: true
  });

  assert.equal(invalid.status, "invalid");
  assert.match(
    invalid.validation.issues.join("\n"),
    /State Of The Art must include an explicit source date|not externally checked/i
  );
});

test("missing context keeps research routing pointed at discuss-phase", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const missingContext = await blueprintPhaseArtifactRead({
    cwd: repoPath,
    phase: "3",
    artifact: "context"
  });
  const researchStatus = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });
  const stateUpdate = await blueprintStateUpdate({
    cwd: repoPath,
    base: "synced",
    patch: {
      activeCommand: "/blu-research-phase",
      lastUpdated: "2026-04-12T00:00:00.000Z"
    }
  });
  const loadedState = await blueprintStateLoad({ cwd: repoPath });
  const stateBody = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");

  assert.equal(missingContext.found, false);
  assert.match(missingContext.reason ?? "", /03-CONTEXT\.md does not exist yet/i);
  assert.equal(researchStatus.hasContext, false);
  assert.deepEqual(stateUpdate.updatedFields.sort(), ["activeCommand", "lastUpdated"].sort());
  assert.match(loadedState.derivedStatus.nextAction, /\/blu-discuss-phase 3/);
  assert.match(stateBody, /Run \/blu-discuss-phase 3 to rebuild the current phase context/);
});

test("valid existing research can sync STATE without mutating the research artifact", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });
  await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: validResearchContent("Keep the research artifact unchanged while routing state forward."),
    overwrite: true
  });

  const researchPath = path.join(
    repoPath,
    ".blueprint/phases/03-phase-discovery/03-RESEARCH.md"
  );
  const researchBefore = await readFile(researchPath, "utf8");
  const reused = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: researchBefore
  });
  const stateUpdate = await blueprintStateUpdate({
    cwd: repoPath,
    base: "synced",
    patch: {
      activeCommand: "/blu-research-phase",
      lastUpdated: "2026-04-12T00:00:00.000Z"
    }
  });
  const loadedState = await blueprintStateLoad({ cwd: repoPath });
  const researchAfter = await readFile(researchPath, "utf8");
  const stateBody = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");

  assert.equal(reused.status, "reused");
  assert.equal(reused.written, false);
  assert.equal(researchAfter, researchBefore);
  assert.deepEqual(stateUpdate.updatedFields.sort(), ["activeCommand", "lastUpdated"].sort());
  assert.doesNotMatch(loadedState.derivedStatus.nextAction, /\/blu-research-phase 3/);
  assert.match(loadedState.derivedStatus.nextAction, /\/blu-(ui-phase|plan-phase) 3/);
  assert.match(stateBody, /Run \/blu-(ui-phase|plan-phase) 3/);
});
