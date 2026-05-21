import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import {
  blueprintArtifactContractRead,
  blueprintArtifactScaffold
} from "../src/mcp/tools/artifacts.js";
import {
  blueprintPhaseArtifactRead,
  blueprintPhaseArtifactScaffold,
  blueprintPhaseArtifactWrite,
  blueprintPhaseCheckpointDelete,
  blueprintPhaseCheckpointGet,
  blueprintPhaseCheckpointPut,
  blueprintPhaseContext,
  blueprintPhaseResearchStatus
} from "../src/mcp/tools/phase.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import {
  blueprintStateLoad,
  blueprintStateUpdate
} from "../src/mcp/tools/state.js";
import { validPhaseContextModel } from "./helpers/context-model.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

const repoRoot = process.cwd();

type ResearchSurfaceSizes = {
  active: Record<string, number>;
  inventoryOnly: Record<string, number>;
};

const RESEARCH_PHASE_ACTIVE_SURFACE_BASELINE_BYTES = {
  // Captured 2026-05-17 before speed-killer prompt slimming.
  "commands/blu-research-phase.toml": 11679,
  "skills/blueprint-phase-discovery/SKILL.md": 26276,
  "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md": 69743,
  "src/mcp/command-runtime-metadata.ts#RESEARCH_PHASE_RUNTIME_METADATA.contractNotes": 4770
} as const;

const RESEARCH_PHASE_INVENTORY_SURFACE_BASELINE_BYTES = {
  // Inventory-only surfaces are not part of the effective research skill bundle.
  "agents/blueprint-researcher.md": 21770,
  "docs/commands/research-phase.md": 21721,
  "docs/MCP-TOOLS.md": 92831,
  "docs/RUNTIME-REFERENCE.md": 84570
} as const;

function byteLength(content: string): number {
  return Buffer.byteLength(content, "utf8");
}

function assertAllMatch(
  surfaceName: string,
  content: string,
  patterns: readonly RegExp[]
): void {
  for (const pattern of patterns) {
    assert.match(content, pattern, `${surfaceName} should match ${pattern}`);
  }
}

function assertTextOrder(surfaceName: string, content: string, orderedNeedles: readonly string[]): void {
  let previousIndex = -1;
  for (const needle of orderedNeedles) {
    const nextIndex = content.indexOf(needle);
    assert.ok(nextIndex >= 0, `${surfaceName} should include ${needle}`);
    assert.ok(
      nextIndex > previousIndex,
      `${surfaceName} should place ${needle} after ${orderedNeedles[Math.max(0, orderedNeedles.indexOf(needle) - 1)]}`
    );
    previousIndex = nextIndex;
  }
}

async function readResearchSurfaceSizes(): Promise<ResearchSurfaceSizes> {
  const active: Record<string, number> = {};
  for (const filePath of [
    "commands/blu-research-phase.toml",
    "skills/blueprint-phase-discovery/SKILL.md",
    "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md"
  ]) {
    active[filePath] = byteLength(await readFile(path.join(repoRoot, filePath), "utf8"));
  }
  const metadata = getRuntimeOwnedCommandMetadata("research-phase");
  assert.ok(metadata);
  active[
    "src/mcp/command-runtime-metadata.ts#RESEARCH_PHASE_RUNTIME_METADATA.contractNotes"
  ] = byteLength(metadata.runtimeReference.contractNotes);

  const inventoryOnly: Record<string, number> = {};
  for (const filePath of [
    "agents/blueprint-researcher.md",
    "docs/commands/research-phase.md",
    "docs/MCP-TOOLS.md",
    "docs/RUNTIME-REFERENCE.md"
  ]) {
    inventoryOnly[filePath] = byteLength(
      await readFile(path.join(repoRoot, filePath), "utf8")
    );
  }

  return { active, inventoryOnly };
}

async function createPhaseRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-research-phase-");

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

async function createEarlierSelectedResearchPhaseRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-research-earlier-phase-");

  await mkdir(path.join(repoPath, ".blueprint/phases/02-earlier-discovery"), {
    recursive: true
  });
  await mkdir(path.join(repoPath, ".blueprint/phases/03-later-delivery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Explicit Earlier Research Fixture

## Milestone

- Active milestone: v1

## Phases

- [x] **Phase 2: Earlier Discovery**
- [ ] **Phase 3: Later Delivery**
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
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify(
      {
        version: 2,
        workflow: {
          ui_phase: true
        }
      },
      null,
      2
    ),
    "utf8"
  );

  return repoPath;
}

function validContextContent(phaseNumber: string, phaseName: string): string {
  const prefix = phaseNumber.padStart(2, "0");
  return `# Phase ${prefix}: ${phaseName} - Context

## Phase Boundary
- Phase goal - keep selected-phase routing pinned through synced state refresh.
- Included work - persist discovery outputs for the explicitly selected phase only.
- Excluded work - letting later roadmap phases override selected-phase routing.
- Success target - downstream commands continue on the same selected phase.

## Discovery Grounding
- Product brief - Blueprint persists phase discovery state under .blueprint/phases/.
- Requirements trace - downstream research and UI work must stay phase-scoped.
- Workflow stance - synced state refresh should preserve an explicit earlier-phase selection.
- Locked decisions - MCP-owned state writes are the only persistence path.

## Implementation Decisions
- Decision: preserve the resolved selected phase during synced state refresh.
- Tradeoff or constraint: roadmap-derived current phase alone is not enough when the user selected an earlier phase.

## Specific Ideas
- Specific idea 1: keep the phase selection explicit in the final sync patch.
- Specific idea 2: make regression coverage assert earlier-phase routing.

## Existing Code Insights
- Existing code insight 1: state sync recomputes routing from artifacts and the current phase.
- Reusable pattern: patch currentPhase during synced updates when a command resolved a different selected phase.
- Known gap or caution: roadmap-only sync can drift to a later phase.

## Dependencies
- Prior phase artifacts: selected phase context and research stay under the same phase directory.
- External constraints: no host-global state writes.
- Required follow-up reads: src/mcp/tools/state.ts

## Open Questions
- none

## Deferred Ideas
- Scope creep or later follow-up: generalize this regression shape for later lifecycle commands if needed.

## Canonical References
- Source 1: src/mcp/tools/state.ts`;
}

function backendOnlyNoUiContextContent(phaseNumber: string, phaseName: string): string {
  const prefix = phaseNumber.padStart(2, "0");
  return `# Phase ${prefix}: ${phaseName} - Context

## Phase Boundary
- Backend-only API phase with no user-facing work in scope.
- Included work - persist discovery outputs for the explicitly selected phase only.
- Excluded work - letting later roadmap phases override selected-phase routing.
- Success target - downstream commands continue on the same selected phase.

## Discovery Grounding
- Project brief - This phase is purely backend and not user-facing.
- Requirements grounding - downstream research and planning work must stay phase-scoped.
- Workflow posture - synced state refresh should preserve an explicit earlier-phase selection.
- Locked decisions - MCP-owned state writes are the only persistence path.

## Implementation Decisions
- Decision: preserve the resolved selected phase during synced state refresh.
- Tradeoff or constraint: roadmap-derived current phase alone is not enough when the user selected an earlier phase.

## Specific Ideas
- Specific idea 1: keep the phase selection explicit in the final sync patch.
- Specific idea 2: make regression coverage assert earlier-phase routing.

## Existing Code Insights
- Existing code insight 1: state sync recomputes routing from artifacts and the current phase.
- Reusable pattern: patch currentPhase during synced updates when a command resolved a different selected phase.
- Known gap or caution: roadmap-only sync can drift to a later phase.

## Dependencies
- Prior phase artifacts: selected phase context and research stay under the same phase directory.
- External constraints: no host-global state writes.
- Required follow-up reads: src/mcp/tools/state.ts

## Open Questions
- none

## Deferred Ideas
- Scope creep or later follow-up: generalize this regression shape for later lifecycle commands if needed.

## Canonical References
- Source 1: src/mcp/tools/state.ts`;
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

## Claim Support Ledger

| Claim ID | Claim | Claim Type | Evidence IDs | Support Status | Confidence | Plan Impact |
|----------|-------|------------|--------------|----------------|------------|-------------|
| CLM-001 | Research persistence is MCP-owned and validated before write completion. | repo_runtime | EVID-001 | directly_supported | HIGH | REC-001 |
| CLM-002 | No live external lookup is required for this repo-only fixture. | open_question | EVID-002 | out_of_scope | LOW | do not use as support |

## Locked Decisions From Context

- Keep Blueprint state writes inside MCP tools and preserve implemented-only routing.

## User Constraints

- Keep writes inside .blueprint/ and leave later lifecycle commands blocked until their substrate exists.

## Standard Stack

- TypeScript
- node:test via tsx --test

### Dependency / Tool Evaluation

| Decision ID | Need | Candidate | Decision | Official Source Or Repo Evidence | Package Ecosystem | Install Scope | Current / Wanted / Latest Evidence | Maintenance Signal | Vulnerability Signal | License | Provenance / Signature Signal | Transitive Footprint | Existing / Standard-Library Alternative | Update Posture | Residual Risk And Mitigation |
|-------------|------|-----------|----------|----------------------------------|-------------------|---------------|------------------------------------|--------------------|----------------------|---------|-------------------------------|---------------------|------------------------------------------|----------------|-------------------------------|
| DEP-001 | Research artifact validation | Existing MCP artifact validator | use_existing | src/mcp/tools/artifacts.ts | repo-local | none | local source observed | maintained in repo tests | unchecked - repo-only fixture | repository license context | unchecked - repo-only fixture | none | existing dependency and repo validator | focused tests plus normal build | Low risk; keep validation fixture coverage. |

## Installation And Setup

- Run the repo build and focused tests before accepting a research-contract change.

### Setup And Update Posture

| Decision ID | Manifest / Lockfile Impact | Install Command Or Path | Install Scope | Side Effects | Verification Command | Update / Monitoring Plan | Manual Review Required |
|-------------|----------------------------|-------------------------|---------------|--------------|----------------------|--------------------------|------------------------|
| DEP-001 | none | none | none | none | npx tsx --test tests/phase-discovery-research.test.ts | normal repo dependency maintenance | no - existing repo validator only |

## Alternatives Considered

- A prompt-local research outline was rejected because it drifts from the canonical MCP template.

### Dependency Alternatives

| Decision ID | Need | No New Dependency | Existing Dependency | Standard Library / Platform API | Candidate Package / Tool | Custom Implementation | Decision | Rationale |
|-------------|------|-------------------|---------------------|---------------------------------|--------------------------|----------------------|----------|-----------|
| DEP-001 | Research artifact validation | viable - keep existing validator | viable - current MCP validator exists | insufficient alone - markdown semantics are project-specific | rejected - no new package needed | rejected - duplicate validation logic would drift | use_existing | Existing validator already owns the phase.research contract. |

## Architecture Patterns

- Keep commands thin and move durable writes into MCP tools.

## Don't Hand-Roll

- Reuse phase resolution and artifact validation helpers instead of writing raw files directly.

### Library Vs Custom Decision

| Decision ID | Capability | Domain Risk | Proven Library / Existing Option | Custom Path Allowed? | Rationale | Required Tests / Validation | Maintenance / Update Owner |
|-------------|------------|-------------|----------------------------------|----------------------|-----------|-----------------------------|----------------------------|
| DEP-001 | Research artifact validation | low-risk-project-specific | Existing MCP validator | no | A second custom path would drift from MCP-owned validation. | phase discovery research tests | Blueprint runtime maintainers |

## Anti-Patterns

- Letting the subagent invent or trim headings outside the canonical contract.

## State Of The Art

- Repo-local guidance stays anchored in saved Blueprint contracts and command metadata.

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

### Recommendation Handoff

| Recommendation ID | Recommendation | Supporting Claim IDs | Evidence IDs | Affected Surfaces | Tests / Checks | Status |
|-------------------|----------------|----------------------|--------------|-------------------|----------------|--------|
| REC-001 | Persist only validated research content through \`blueprint_phase_artifact_write\`. | CLM-001 | EVID-001 | src/mcp/tools/phase.ts, src/mcp/tools/artifacts.ts, tests/phase-discovery-research.test.ts | npx tsx --test tests/phase-discovery-research.test.ts | ready |

## Sources

### Source Register

| Source ID | Lane | Path Or URL | Accessed | Repo Line Or Symbol | Source Type | Used For Claims | Limitations |
|-----------|------|-------------|----------|---------------------|-------------|-----------------|-------------|
| SRC-001 | repo | src/mcp/tools/phase.ts | observed 2026-04-11 | blueprintPhaseArtifactWrite | repo_file | CLM-001 | local fixture evidence |
| SRC-002 | external | supplied-none | supplied-unchecked | n/a | supplied_reference | background | no live external lookup used |

### Repo Evidence

- Repo evidence: \`src/mcp/tools/phase.ts:1\`, symbol/heading=blueprintPhaseArtifactWrite, role=runtime, method=manual-read, supports=CLM-001.

| Evidence ID | Claim ID | Source Ref | Role | Retrieval Context | Support Span | Claim Class | Downstream Use | Limitations |
|-------------|----------|------------|------|-------------------|--------------|-------------|----------------|-------------|
| EVID-001 | CLM-001 | SRC-001 | mcp-handler | manual-read; MCP handler | phase artifact writes route through MCP-owned tooling | directly_supported | REC-001 | local checkout only |

### External Sources

| Evidence ID | Claim ID | Source Type | Authority Tier | Source Title | Source Ref | Accessed | Support Span | Claim Class | Retrieval Context | Limitations | Downstream Use |
|-------------|----------|-------------|----------------|--------------|------------|----------|--------------|-------------|-------------------|-------------|----------------|
| EVID-002 | CLM-002 | supplied_reference | unknown | Repo-only fixture | SRC-002 | supplied-unchecked | no external lookup used | out_of_scope | source policy off | repo-only fixture | do not use as external support |

### Inference Notes

| Evidence ID | Claim ID | Derived From | Claim Class | Derivation / Attribution | Limitations | Downstream Use |
|-------------|----------|--------------|-------------|--------------------------|-------------|----------------|
| EVID-003 | CLM-003 | EVID-001 | inferred_from_supported | MCP-owned write path implies command should not hand-write research files. | verify in focused tests | Persist through blueprint_phase_artifact_write. |

### Supply Chain Evidence

- Supply-chain evidence: repo-local validator, \`src/mcp/tools/artifacts.ts\`, accessed/observed 2026-04-11, signal=version, supports=DEP-001; source policy=off.
`;
}

test("research-phase instruction surfaces expose measured active and inventory budgets", async () => {
  const sizes = await readResearchSurfaceSizes();

  assert.deepEqual(
    Object.keys(sizes.active).sort(),
    Object.keys(RESEARCH_PHASE_ACTIVE_SURFACE_BASELINE_BYTES).sort()
  );
  assert.deepEqual(
    Object.keys(sizes.inventoryOnly).sort(),
    Object.keys(RESEARCH_PHASE_INVENTORY_SURFACE_BASELINE_BYTES).sort()
  );
  assert.ok(Object.values(sizes.active).every((size) => size > 0));
  assert.ok(Object.values(sizes.inventoryOnly).every((size) => size > 0));

  const activeTotal = Object.values(sizes.active).reduce((total, size) => total + size, 0);
  const activeBaselineTotal = Object.values(
    RESEARCH_PHASE_ACTIVE_SURFACE_BASELINE_BYTES
  ).reduce((total, size) => total + size, 0);
  assert.ok(
    activeTotal < activeBaselineTotal,
    `active research bundle should shrink below ${activeBaselineTotal} bytes; got ${activeTotal}`
  );
  assert.ok(
    sizes.active["commands/blu-research-phase.toml"] < 5000,
    `research manifest should stay under 5 KB; got ${sizes.active["commands/blu-research-phase.toml"]}`
  );
  assert.ok(
    sizes.active["skills/blueprint-phase-discovery/SKILL.md"] <
      RESEARCH_PHASE_ACTIVE_SURFACE_BASELINE_BYTES[
        "skills/blueprint-phase-discovery/SKILL.md"
      ],
    "shared discovery skill should shrink after research subsection deflation"
  );
  assert.ok(
    sizes.active[
      "src/mcp/command-runtime-metadata.ts#RESEARCH_PHASE_RUNTIME_METADATA.contractNotes"
    ] < 1200,
    "runtime metadata notes should stay pointer-level, not repeat the runtime contract"
  );
  assert.ok(
    sizes.inventoryOnly["agents/blueprint-researcher.md"] < 17000,
    `researcher sidecar contract should stay compact after Wave 3; got ${
      sizes.inventoryOnly["agents/blueprint-researcher.md"]
    }`
  );
});

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
    "blueprint_phase_artifact_scaffold",
    "blueprint_phase_artifact_write",
    "blueprint_phase_checkpoint_get",
    "blueprint_phase_checkpoint_put",
    "blueprint_phase_checkpoint_delete",
    "blueprint_state_load",
    "blueprint_state_update"
  ] as const;

  for (const toolName of requiredTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assertAllMatch("command manifest", commandFile, [
    /Use `blueprint-phase-discovery`/,
    /research-phase-runtime-contract\.md/,
    /same-named Gemini CLI agent tool `blueprint-researcher`/i,
    /bounded research task packet/i,
    /long-running-mutation/,
    /`mcp_blueprint_blueprint_phase_context` as the first selected-phase read/i,
    /phase_context\.phaseSelection[\s\S]*phase_context\.phase[\s\S]*authority[\s\S]*number[\s\S]*prefix[\s\S]*name[\s\S]*directory[\s\S]*phase\.artifacts/i,
    /fallback-only `mcp_blueprint_blueprint_phase_locate` recovery/i,
    /independent read-only MCP calls[\s\S]*same model response\/tool-call turn/i,
    /Do not batch confirmation prompts[\s\S]*validation repair[\s\S]*state update[\s\S]*post-write state load[\s\S]*checkpoint deletion/i,
    /context body before drafting[\s\S]*research body only for view\/update\/repair[\s\S]*artifact contract before drafting\/revising/i,
    /current `context` artifact or `XX-CONTEXT\.md` is missing/i,
    /route back to `\/blu-discuss-phase <phase>`/i,
    /research\.external_sources/i,
    /`off`, `ask`, or `auto`/i,
    /view/,
    /skip/,
    /update/,
    /`update` is the overwrite gate/i,
    /artifactId: "phase\.research"/,
    /contract\.authoringTemplate/,
    /repair or update is the only successful path/i,
    /state_update` with `base: "synced"`/i,
    /patch\.currentPhase/i,
    /state_load/i,
    /command_catalog/i,
    /checkpoint/i,
    /checkpoint_delete/i,
    /STATE\.md/
  ]);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read")));
  assert.doesNotMatch(commandFile, /Follow this flow exactly/i);
  assert.doesNotMatch(commandFile, /update_topic|write_todos/);
  assert.doesNotMatch(commandFile, /Source-Support Self-Check|Claim Support Ledger|Source Register|Recommendation Handoff/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-discovery\.md|agents\/blueprint-researcher\.md/);
  assert.ok(docFile.includes("`blueprint_artifact_contract_read` -> `{artifactId, contract}`"));
  assert.ok(docFile.includes("contract.authoringTemplate"));
  assert.ok(docFile.includes("contract.freehandPolicy"));
  assert.match(docFile, /extra top-level headings/i);
  assert.match(docFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(docFile, /active command's inputs/i);
  assert.match(docFile, /research\.external_sources/i);
  assert.match(docFile, /workflowPosture\.research\.externalSources/i);
  assert.match(docFile, /Choosing `update` is the overwrite gate/i);
  assert.match(docFile, /MCP validation does not require either marker/i);
  assert.match(docFile, /official docs or explicitly supplied external references/i);
  assert.match(docFile, /investigation trace/i);
  assert.match(docFile, /navigation evidence packet/i);
  assert.match(docFile, /repository evidence ladder/i);
  assert.match(docFile, /per-strand search notes/i);
  assert.match(docFile, /remote code-search results as discovery hints/i);
  assert.match(docFile, /planning handoff/i);
  assert.match(docFile, /parent-owned research strand ledger/i);
  assert.match(docFile, /researchLedger/i);
  assert.match(docFile, /not child-agent transcripts/i);
  assert.match(docFile, /safe research checkpoints resume by default/i);
  assert.match(docFile, /guarded MCP delete path|guarded delete/i);
  assert.match(docFile, /state sync, refreshed state load, or command-catalog routing fails/i);
  assert.match(docFile, /dependency\/tool evaluation/i);
  assert.match(docFile, /supply-chain-aware/i);
  assert.match(docFile, /unchecked\/deferred|unchecked/i);
  assert.match(docFile, /failed\/noisy\/no-hit or limited searches|failed or limited searches/i);
  assert.match(docFile, /If the context read returns `found: false`, stop and route back to `\/blu-discuss-phase <phase>`/i);
  assert.match(docFile, /Invalid existing research must go through repair/i);
  assert.match(docFile, /use the runtime contract's single-agent topic-strand fallback/i);
  assert.match(
    docFile,
    /call `blueprint_state_update` with `base: "synced"`[\s\S]*`blueprint_state_load`/i
  );
  assert.match(docFile, /patch\.currentPhase/i);
  assert.doesNotMatch(docFile, /update_topic|write_todos/);

  assert.match(runtimeReference, /\| `research-phase` \|[\s\S]*?blueprint_phase_checkpoint_get[\s\S]*?blueprint_phase_checkpoint_put[\s\S]*?blueprint_phase_checkpoint_delete/);
  assertAllMatch("runtime reference row", runtimeReference, [
    /research-phase-runtime-contract\.md/i,
    /blueprint_phase_context\.phaseSelection[\s\S]*phase_context\.phase/i,
    /blueprint_phase_locate` is fallback-only recovery/i,
    /Independent read-only calls[\s\S]*one tool-call turn/i,
    /phase\.research|contract\.authoringTemplate/i,
    /implemented-command routing/i,
    /checkpoint/i,
    /parent/i,
    /sidecar/i
  ]);
  assert.match(
    mcpToolsDoc,
    /`research-phase` uses `blueprint_phase_context` as the first selected-phase read[\s\S]*fallback-only recovery[\s\S]*research status, discovery artifact read\/scaffold\/write tools/i
  );
  assert.match(
    mcpToolsDoc,
    /Independent read-only calls[\s\S]*same model response\/tool-call turn[\s\S]*user confirmations, writes, validation repair, state update, post-write refreshed state load, command-catalog proof, and checkpoint deletion stay sequenced/i
  );
  assert.match(mcpToolsDoc, /research-phase-runtime-contract\.md/);
  assert.match(mcpToolsDoc, /workflowPosture\.research\.externalSources/);
  assert.match(mcpToolsDoc, /off`\/`ask`\/`auto`/i);
  assert.match(mcpToolsDoc, /runtime-contract guidance rather than an MCP validation gate/i);
  assert.match(mcpToolsDoc, /initial assessment/i);
  assert.match(mcpToolsDoc, /navigation evidence packet/i);
  assert.match(mcpToolsDoc, /planning handoffs/i);
  assert.match(mcpToolsDoc, /parent-owned research strand ledger/i);
  assert.match(mcpToolsDoc, /researchLedger/i);
  assert.match(mcpToolsDoc, /child-agent transcripts/i);
  assert.match(mcpToolsDoc, /guarded delete/i);
  assert.match(mcpToolsDoc, /dependency\/tool choices/i);
  assert.match(mcpToolsDoc, /supply-chain evidence/i);
  assert.match(mcpToolsDoc, /repository search discipline/i);
  assert.match(mcpToolsDoc, /bounded `blueprint-researcher` findings/i);
  assert.match(mcpToolsDoc, /single-agent topic-strand fallback/i);
  assert.match(mcpToolsDoc, /reject browser\/web-search\/shell-only or generic agents/i);
  assert.match(mcpToolsDoc, /stop on missing `XX-CONTEXT\.md`/i);
  assert.match(mcpToolsDoc, /force repair when existing research is invalid/i);
  assert.match(mcpToolsDoc, /sync `STATE\.md` even on valid non-writing reuse paths/i);

  assertAllMatch("shared discovery skill", skillFile, [
    /Execution profile for `\/blu-research-phase`: `long-running-mutation`/,
    /Load only the active command's `input_bundles\.commands\[\.\.\.\]` inputs/i,
    /Repository docs are not active runtime inputs/i,
    /active command's\s+skill-local runtime reference/i,
    /research-phase-runtime-contract\.md/,
    /Phase Context Ownership/,
    /\/blu-research-phase` and `\/blu-ui-phase` read phase context and route back/i,
    /Command-Scoped Required MCP Tools/,
    /blueprint_phase_checkpoint_get/,
    /blueprint_phase_checkpoint_put/,
    /blueprint_phase_checkpoint_delete/,
    /blueprint_state_update/,
    /blueprint_state_load/
  ]);
  assert.doesNotMatch(skillFile, /Source-Support Self-Check|Claim Support Ledger|Source Register|Recommendation Handoff|researchLedger|rg --files|semantic navigation/);
  assert.doesNotMatch(skillFile, /Require explicit overwrite confirmation before replacing existing research/i);
  const contract = await buildBlueprintCommandRuntimeContractResource("research-phase");
  const metadata = getRuntimeOwnedCommandMetadata("research-phase");

  assert.ok(metadata);
  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md"
  ]);
  assert.deepEqual(contract.skillInputs.effective, [
    "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md"
  ]);
  assert.equal(contract.skillInputs.effective.some((input) => input.startsWith("docs/")), false);
  assert.equal(
    contract.skillInputs.effective.includes("docs/commands/discuss-phase.md"),
    false
  );
  assert.equal(contract.skillInputs.effective.includes("docs/commands/ui-phase.md"), false);
  assert.equal(
    contract.skillInputs.effective.includes("docs/commands/list-phase-assumptions.md"),
    false
  );
  assert.match(
    contract.spec?.reads?.join(" ") ?? "",
    /Phase selection starts with blueprint_phase_context\.phaseSelection[\s\S]*number[\s\S]*prefix[\s\S]*name[\s\S]*directory[\s\S]*phase_context\.phase\.artifacts inventory[\s\S]*blueprint_phase_locate stays fallback-only recovery/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /Selected-phase resolution starts with blueprint_phase_context\.phaseSelection[\s\S]*number[\s\S]*prefix[\s\S]*name[\s\S]*directory[\s\S]*phase_context\.phase\.artifacts inventory[\s\S]*blueprint_phase_locate is fallback-only recovery/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /Independent read-only calls with known args may share one tool-call turn[\s\S]*checkpoint deletion stay sequenced/i
  );
  assert.match(
    runtimeContract,
    /`blueprint_phase_context`: call this first as the selected-phase read[\s\S]*selected-phase authority/i
  );
  assert.match(
    runtimeContract,
    /`blueprint_phase_locate`: fallback-only recovery[\s\S]*phase_context\.phaseSelection\.found[\s\S]*phase_context\.phase[\s\S]*number[\s\S]*prefix[\s\S]*name[\s\S]*directory[\s\S]*phase_context\.phase\.artifacts[\s\S]*locate-level recovery evidence/i
  );
  assert.match(runtimeContract, /### Same-Turn Read Batching/);
  assert.match(
    runtimeContract,
    /independent read-only MCP calls[\s\S]*same model response\/tool-call turn/i
  );
  assert.match(
    runtimeContract,
    /Dependent reads stay sequenced[\s\S]*context artifact body before drafting[\s\S]*existing research body only for view\/update\/repair[\s\S]*artifact contract before drafting or revising/i
  );
  assert.match(
    runtimeContract,
    /Do not batch user confirmations[\s\S]*state update[\s\S]*post-write refreshed state load[\s\S]*checkpoint deletion/i
  );
  assert.match(
    runtimeContract,
    /`artifact: "research"`[\s\S]*only for view, update, or repair branches[\s\S]*valid[\s\S]*skip path uses `blueprint_phase_research_status`/i
  );
  assert.match(
    runtimeContract,
    /pre-write[\s\S]*state load[\s\S]*post-write refreshed state load/i
  );

  assert.match(researcherAgent, /parent-supplied official-doc evidence/i);
  assert.match(researcherAgent, /repo-root `AGENTS\.md`/i);
  assert.match(
    researcherAgent,
    /official-doc or explicitly supplied external references|official docs or supplied external references/i
  );
  assert.match(researcherAgent, /provenance\s+captured at the claim level/i);
  assert.match(
    researcherAgent,
    /comparison\s+notes when official-doc or external evidence packets are part of the evidence\s+set/i
  );
  assert.match(researcherAgent, /does not fetch official docs itself/i);
  assert.match(researcherAgent, /return the\s+claim as `not_enough_evidence`/i);
  assert.match(researcherAgent, /Evidence Packet Rows/i);
  assert.match(researcherAgent, /Claim Support Ledger Rows/i);
  assert.match(researcherAgent, /Source Register Rows/i);
  assert.match(researcherAgent, /Recommendation Handoff Rows/i);
  assert.match(researcherAgent, /Do not invent Source Register rows/i);
  assert.match(researcherAgent, /authority tier/i);
  assert.match(researcherAgent, /source title, date or access date,[\s\S]*URL or source ref/i);
  assert.match(researcherAgent, /avoid implying that current upstream guidance was confirmed/i);
  assert.match(researcherAgent, /Investigation Trace Rules/);
  assert.match(researcherAgent, /bounded evidence question/i);
  assert.match(researcherAgent, /Query or navigation method|query or navigation method/i);
  assert.match(researcherAgent, /remote code-search hits as\s+discovery hints/i);
  assert.match(researcherAgent, /Retrieval Notes/i);
  assert.match(researcherAgent, /failed or limited search/i);
  assert.match(researcherAgent, /Planning Handoff/i);
  assert.match(researcherAgent, /Dependency \/ Tool Evaluation/i);
  assert.match(researcherAgent, /no-new-dependency/i);
  assert.match(researcherAgent, /provenance\/signature/i);
  assert.match(researcherAgent, /unchecked/i);
  assert.match(researcherAgent, /Do not present a sidecar packet as final persisted research/i);
  assert.match(researcherAgent, /Research Sidecar Packet Semantics/i);
  assert.match(researcherAgent, /packetVersion: research-sidecar\.v1/i);
  assert.match(researcherAgent, /terminationReason/i);
  assert.match(researcherAgent, /failedSearches/i);
  assert.match(researcherAgent, /do not return a conversation transcript/i);
  assert.match(researcherAgent, /parent to copy into `## Sources`/i);
  assert.match(researcherAgent, /Output Quality Expectations/);
  assert.match(researcherAgent, /what does `\/blu-plan-phase` need to know/i);
  assert.match(researcherAgent, /repo evidence/i);
  assert.match(researcherAgent, /official-doc|External Sources/i);
  assert.match(researcherAgent, /Inference/);
  assert.match(researcherAgent, /Do not substitute browser-only, web-search-only, shell-only, or generic-agent/i);
  assert.match(runtimeContract, /Shared Stage Mapping/);
  assert.match(runtimeContract, /Branch Classification And Fast Path/);
  assert.match(runtimeContract, /Required MCP Calls/);
  assert.match(runtimeContract, /Artifact Authoring Rules/);
  assert.match(runtimeContract, /Capability-Gated Subagent Path/);
  assert.match(runtimeContract, /No-Subagent Fallback/);
  assert.match(runtimeContract, /Retry And Repair Behavior/);
  assert.match(runtimeContract, /Output Quality Criteria/);
  assert.match(runtimeContract, /Completion Criteria/);
  assert.match(runtimeContract, /Evidence Quality, Citations, And Provenance/i);
  assert.match(runtimeContract, /Source-Support Self-Check/i);
  assert.match(runtimeContract, /Claim Support Ledger/i);
  assert.match(runtimeContract, /Source Register/i);
  assert.match(runtimeContract, /Recommendation Handoff/i);
  assert.match(runtimeContract, /repo_runtime/i);
  assert.match(runtimeContract, /Warning diagnostic codes introduced by this slice/i);
  assert.match(runtimeContract, /directly_supported/);
  assert.match(runtimeContract, /not_enough_evidence/);
  assert.match(runtimeContract, /Investigation Trace And Navigation Evidence/);
  assert.match(runtimeContract, /repository evidence ladder/i);
  assert.match(runtimeContract, /Navigation Evidence Packet/i);
  assert.match(runtimeContract, /per-strand search notes/i);
  assert.match(runtimeContract, /rg --files/i);
  assert.match(runtimeContract, /remote code-search hits are discovery hints/i);
  assert.match(runtimeContract, /source type, authority tier, support span/i);
  assert.match(runtimeContract, /Strand Planning Handoff/i);
  assert.match(runtimeContract, /Research Strand Ledger And Checkpoint Semantics/i);
  assert.match(runtimeContract, /classify the run as `simple` or `non-trivial`/i);
  assert.match(runtimeContract, /Simple runs may skip the formal strand ledger and research checkpoint/i);
  assert.match(runtimeContract, /`planner-critical` claim or recommendation/i);
  assert.match(runtimeContract, /sidecar material help/i);
  assert.match(runtimeContract, /context-lock/i);
  assert.match(runtimeContract, /repo-map/i);
  assert.match(runtimeContract, /planner-handoff/i);
  assert.match(runtimeContract, /researchLedger\.schemaVersion/i);
  assert.match(runtimeContract, /research-ledger\/v1/i);
  assert.match(runtimeContract, /stopping reasons/i);
  assert.match(runtimeContract, /child transcripts/i);
  assert.match(runtimeContract, /safeToResume=true/i);
  assert.match(runtimeContract, /Parent synthesis should build this internal matrix/i);
  assert.match(runtimeContract, /tool-failure/i);
  assert.match(runtimeContract, /budget-exhausted/i);
  assert.match(runtimeContract, /state-sync or route-refresh failure/i);
  assert.match(runtimeContract, /targeted full-file, test, manifest, command, skill, runtime-contract,[\s\S]*artifact-contract,[\s\S]*MCP-handler,[\s\S]*built-entrypoint reads/i);
  assert.match(runtimeContract, /Load it\s+on demand for research runs/i);
  assert.match(runtimeContract, /contract\.authoringTemplate/);
  assert.match(runtimeContract, /blueprint_config_get/);
  assert.match(runtimeContract, /workflowPosture\.research\.externalSources/);
  assert.match(runtimeContract, /`off` means no live external lookup/i);
  assert.match(runtimeContract, /`ask` means confirm[\s\S]*first/i);
  assert.match(runtimeContract, /explicit source dates/i);
  assert.match(runtimeContract, /live external checking did not happen|absence of a date or unchecked marker/i);
  assert.match(
    runtimeContract,
    /no unresolved downstream question[\s\S]*remains[\s\S]*use exactly `- none`[\s\S]*do not write `null`, `\[\]`, or prose variants/i
  );
  assert.match(runtimeContract, /stop and route back to\s+`\/blu-discuss-phase <phase>`/i);
  assert.match(runtimeContract, /Default drafting should start from\s+`contract\.authoringTemplate`/i);
  assert.match(runtimeContract, /do not allow skip, default reuse, or an\s+unchanged invalid write result/i);
  assert.match(runtimeContract, /explicit `update` selection as the overwrite gate/i);
  assert.match(runtimeContract, /sync `STATE\.md` through `blueprint_state_update` with `base: "synced"`/i);
  assert.match(runtimeContract, /patch\.currentPhase/i);
  assert.match(runtimeContract, /blueprint_phase_artifact_write` returns `status: "invalid"`/);
  assert.match(runtimeContract, /repair[\s\S]*same normalized draft/i);
  assert.match(runtimeContract, /browser-only, web-search-only, shell-only, or\s+generic agents/i);
});

test("research runtime contract defines branch thresholds without diluting fast-path obligations", async () => {
  const runtimeContract = await readFile(
    path.join(
      repoRoot,
      "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md"
    ),
    "utf8"
  );
  const branchSection = runtimeContract.match(
    /## Branch Classification And Fast Path[\s\S]*?## Visible Research Progress/
  )?.[0];

  assert.ok(branchSection);
  assertTextOrder("research branch classification", branchSection, [
    "Use the `simple` path only when all of these are true:",
    "Simple runs may skip the formal strand ledger and research checkpoint.",
    "Use the `non-trivial` path when any of these are true:",
    "A `planner-critical` claim or recommendation",
    "Use `sidecar material help` only when"
  ]);
  assertAllMatch("simple fast path criteria", branchSection, [
    /one coherent research question/i,
    /repo-only evidence is enough/i,
    /no saved research is invalid/i,
    /no research checkpoint exists, whether safe, unsafe, foreign-owned, legacy, or\s+invalid/i,
    /no external-source confirmation gate is pending/i,
    /no dependency\/tool decision[\s\S]*affects planning/i,
    /no validation repair is required/i,
    /no contradictory or missing planner-critical evidence/i
  ]);
  assertAllMatch("simple fast path obligations", branchSection, [
    /read actual saved `XX-CONTEXT\.md` content/i,
    /honor the effective\s+external-source policy/i,
    /draft or revise from `contract\.authoringTemplate`/i,
    /Source-Support Self-Check/i,
    /`blueprint_phase_artifact_write` in strict mode/i,
    /sync route state/i,
    /prove the next\s+implemented command/i,
    /produce every required `phase\.research` section/i,
    /planner-critical claims[\s\S]*source\/provenance\s+rows/i
  ]);
  assertAllMatch("non-trivial branch triggers", branchSection, [
    /multiple independent research questions/i,
    /evidence is contradictory/i,
    /dependency\/tool decision/i,
    /external-source policy blocks or gates/i,
    /sidecar is dispatched/i,
    /research checkpoint exists/i,
    /existing research is invalid/i,
    /validation repair is required/i,
    /post-write state sync or route proof fails/i,
    /planner-critical uncertainty changes implementation scope/i
  ]);
  assertAllMatch("planner-critical and sidecar thresholds", branchSection, [
    /changes implementation\s+files/i,
    /dependency\/tool choices/i,
    /validation strategy/i,
    /lifecycle routing/i,
    /state\/schema behavior/i,
    /security posture/i,
    /user-facing product behavior/i,
    /parallel bounded reading reduces total\s+time without widening scope/i,
    /dependency\/tool comparison that needs a separate\s+evidence packet/i,
    /disjoint evidence packets/i,
    /do not load\s+or inspect the agent contract solely to decide that no sidecar is needed/i
  ]);
});

test("research-phase surface responsibility matrix preserves no-dilution owners", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-research-phase.toml"),
    "utf8"
  );
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-discovery/SKILL.md"),
    "utf8"
  );
  const runtimeContract = await readFile(
    path.join(
      repoRoot,
      "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md"
    ),
    "utf8"
  );
  const researcherAgent = await readFile(
    path.join(repoRoot, "agents/blueprint-researcher.md"),
    "utf8"
  );
  const artifactContract = await blueprintArtifactContractRead({
    cwd: repoRoot,
    artifactId: "phase.research"
  });

  assertAllMatch("manifest owns command-local gates", commandFile, [
    /Execution profile: `long-running-mutation`/,
    /Use only these Blueprint MCP tools/i,
    /first selected-phase read/i,
    /fallback-only `mcp_blueprint_blueprint_phase_locate` recovery/i,
    /context` artifact or `XX-CONTEXT\.md` is missing/i,
    /research\.external_sources/i,
    /If saved research is invalid/i,
    /state_update` with `base: "synced"`/i,
    /implemented-command routing proof/i
  ]);
  assert.doesNotMatch(commandFile, /update_topic|write_todos/);
  assert.doesNotMatch(commandFile, /Source-Support Self-Check/);

  assertAllMatch("shared skill owns input and MCP boundaries", skillFile, [
    /input_bundles:/,
    /"\/blu-research-phase":/,
    /research-phase-runtime-contract\.md/,
    /Repository docs are not active runtime inputs/i,
    /Use only the MCP tools allowed by the active command contract/i,
    /Phase Context Ownership/
  ]);
  assert.doesNotMatch(skillFile, /Source-Support Self-Check/);

  assertAllMatch("runtime contract owns research behavior", runtimeContract, [
    /phase validation before research/i,
    /explicit reuse, view, or update handling/i,
    /research\.external_sources/,
    /Source-Support Self-Check/i,
    /dependency\/tool decisions/i,
    /Research Strand Ledger And Checkpoint Semantics/i,
    /Capability-Gated Subagent Path/i,
    /parent-owned synthesis/i,
    /blueprint_state_update` with `base: "synced"`/i,
    /blueprint_command_catalog/i,
    /blueprint_phase_checkpoint_delete/i
  ]);
  assert.equal(
    [commandFile, skillFile, runtimeContract].filter((surface) =>
      /Source-Support Self-Check/.test(surface)
    ).length,
    1
  );

  assertAllMatch("artifact contract owns table shapes", artifactContract.contract.authoringTemplate, [
    /## Claim Support Ledger/,
    /### Recommendation Handoff/,
    /### Source Register/,
    /### Repo Evidence/,
    /### External Sources/,
    /### Inference Notes/,
    /### Dependency \/ Tool Evaluation/,
    /### Dependency Alternatives/,
    /### Library Vs Custom Decision/
  ]);

  assertAllMatch("sidecar agent owns sidecar packet detail", researcherAgent, [
    /Research Sidecar Packet Semantics/i,
    /packetVersion: research-sidecar\.v1/i,
    /Do not present a sidecar packet as final persisted research/i,
    /does not fetch official docs itself/i,
    /Do not substitute browser-only, web-search-only, shell-only, or generic-agent/i
  ]);
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
  assert.match(scaffold, /## Investigation Trace/);
  assert.match(scaffold, /### Initial Assessment/);
  assert.match(scaffold, /### Navigation Evidence Packet/);
  assert.match(scaffold, /### Strand Planning Handoff/);
  assert.match(scaffold, /Saved artifacts inspected/);
  assert.match(scaffold, /Retrieval Mode/);
  assert.match(scaffold, /Query Or Navigation Method/);
  assert.match(scaffold, /Scope Filter/);
  assert.match(scaffold, /Candidate Files Or Symbols/);
  assert.match(scaffold, /Files Read/);
  assert.match(scaffold, /remote-code-search-hint/);
  assert.match(scaffold, /Stop Or Widen Reason/);
  assert.match(scaffold, /Validation Or Test Implications/);
  assert.match(scaffold, /## Locked Decisions From Context/);
  assert.match(scaffold, /## Installation And Setup/);
  assert.match(scaffold, /## Alternatives Considered/);
  assert.match(scaffold, /### Dependency \/ Tool Evaluation/);
  assert.match(scaffold, /Current \/ Wanted \/ Latest Evidence/);
  assert.match(scaffold, /Maintenance Signal/);
  assert.match(scaffold, /Vulnerability Signal/);
  assert.match(scaffold, /Provenance \/ Signature Signal/);
  assert.match(scaffold, /Transitive Footprint/);
  assert.match(scaffold, /Existing \/ Standard-Library Alternative/);
  assert.match(scaffold, /### Setup And Update Posture/);
  assert.match(scaffold, /Manifest \/ Lockfile Impact/);
  assert.match(scaffold, /Update \/ Monitoring Plan/);
  assert.match(scaffold, /### Dependency Alternatives/);
  assert.match(scaffold, /No New Dependency/);
  assert.match(scaffold, /Standard Library \/ Platform API/);
  assert.match(scaffold, /### Library Vs Custom Decision/);
  assert.match(scaffold, /### Supply Chain Evidence/);
  assert.match(scaffold, /## Anti-Patterns/);
  assert.match(scaffold, /## State Of The Art/);
  assert.match(
    scaffold,
    /current ecosystem or repo update relevant to this phase/
  );
  assert.match(scaffold, /## Open Questions/);
  assert.match(scaffold, /## Confidence Breakdown/);
  assert.match(scaffold, /## Recommendations/);
  assert.match(scaffold, /## Claim Support Ledger/);
  assert.match(scaffold, /Claim Type/);
  assert.match(scaffold, /Support Status/);
  assert.match(scaffold, /Plan Impact/);
  assert.match(scaffold, /### Recommendation Handoff/);
  assert.match(scaffold, /Supporting Claim IDs/);
  assert.match(scaffold, /Affected Surfaces/);
  assert.match(scaffold, /Tests \/ Checks/);
  assert.match(scaffold, /### Source Register/);
  assert.match(scaffold, /Source ID/);
  assert.match(scaffold, /Path Or URL/);
  assert.match(scaffold, /Repo Line Or Symbol/);
  assert.match(scaffold, /Used For Claims/);
  assert.match(scaffold, /### Repo Evidence/);
  assert.match(scaffold, /### External Sources/);
  assert.match(scaffold, /### Inference Notes/);
  assert.match(scaffold, /Evidence ID/);
  assert.match(scaffold, /Claim ID/);
  assert.match(scaffold, /Claim Class/);
  assert.match(scaffold, /Source Type/);
  assert.match(scaffold, /Authority Tier/);
  assert.match(scaffold, /Support Span/);
  assert.match(scaffold, /Retrieval Context/);
  assert.match(scaffold, /Downstream Use/);
  assert.match(scaffold, /directly_supported\|partially_supported\|inferred_from_supported/);
  assert.match(scaffold, /\*Generated by `blueprint_artifact_scaffold`\*/);
});

test("research phase scaffold resolves numeric phase to the canonical research artifact path", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const scaffoldResult = await blueprintPhaseArtifactScaffold({
    cwd: repoPath,
    phase: "3",
    artifact: "research"
  });
  const readResult = await blueprintPhaseArtifactRead({
    cwd: repoPath,
    phase: "3",
    artifact: "research"
  });

  assert.equal(scaffoldResult.path, ".blueprint/phases/03-phase-discovery/03-RESEARCH.md");
  assert.deepEqual(scaffoldResult.createdFiles, [
    ".blueprint/phases/03-phase-discovery/03-RESEARCH.md"
  ]);
  assert.deepEqual(scaffoldResult.reusedFiles, []);
  assert.equal(readResult.found, true);
  assert.equal(readResult.path, ".blueprint/phases/03-phase-discovery/03-RESEARCH.md");
  assert.match(readResult.content ?? "", /^# Phase 03: Phase Discovery - Research$/m);
});

test("path-based scaffold rejects accidental phase and artifact fields instead of bootstrapping", async (t) => {
  const repoPath = await createGitRepo("blueprint-research-scaffold-bad-shape-");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    blueprintArtifactScaffold({
      cwd: repoPath,
      phase: "3",
      artifact: "research"
    } as never),
    /blueprint_artifact_scaffold accepts repo-relative artifact paths only.*blueprint_phase_artifact_scaffold/i
  );

  await assert.rejects(
    readFile(path.join(repoPath, ".blueprint/PROJECT.md"), "utf8"),
    /ENOENT/
  );
});

test("research template accepts search notes and role-method repo evidence", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research with repository search notes and role-method source evidence."
  ).replace(
    "## Locked Decisions From Context",
    `## Investigation Trace

### Initial Assessment

| Field | Notes |
|-------|-------|
| Saved artifacts inspected | .blueprint/phases/03-phase-discovery/03-CONTEXT.md |
| Relevant repo files or symbols | blueprintPhaseArtifactWrite, validateResearchArtifactContent |
| Retrieval modes used | saved-context, rg-files, scoped-rg, targeted-read |
| Key findings | Research writes already flow through MCP-owned artifact validation. |
| Implementation questions | Whether source evidence should stay guidance-only for compatibility. |
| Confidence | HIGH - supported by local repo paths and tests. |

### Navigation Evidence Packet

| Evidence ID | Strand | Query Or Navigation Method | Scope Filter | Retrieval Mode | Candidate Files Or Symbols | Files Read | Source Class | Path / Symbol / URL | Role | Finding | Limits | Stop Or Widen Reason |
|-------------|--------|----------------------------|--------------|----------------|----------------------------|------------|--------------|---------------------|------|---------|--------|----------------------|
| NAV-001 | artifact-write | rg "blueprintPhaseArtifactWrite" src/mcp tests | src/mcp, tests | scoped-rg | src/mcp/tools/phase.ts, tests/phase-discovery-research.test.ts | src/mcp/tools/phase.ts, tests/phase-discovery-research.test.ts | mcp-handler | src/mcp/tools/phase.ts | runtime | Research persistence is MCP-owned. | none | Handler and focused test were enough. |

### Strand Planning Handoff

| Strand | Recommendation | Affected Files Or Modules | Validation Or Test Implications | Unresolved Blockers | Evidence Basis | Confidence |
|--------|----------------|---------------------------|---------------------------------|---------------------|----------------|------------|
| artifact-write | Keep source-shape changes in prompt/template guidance. | src/mcp/artifact-contracts/index.ts, tests/phase-discovery-research.test.ts | Focused research artifact tests should keep passing. | none | NAV-001 | HIGH - local handler and test evidence agree. |

## Locked Decisions From Context`
  ).replace(
    /## Sources[\s\S]*$/,
    `## Sources

### Repo Evidence

- Repo evidence: \`src/mcp/tools/phase.ts:1\`, symbol/heading=blueprintPhaseArtifactWrite, role=runtime, method=scoped-rg, supports=artifact-write recommendation.
- Repo evidence: \`tests/phase-discovery-research.test.ts:1\`, symbol/heading=phase artifact write creates, reuses, updates, and validates research content, role=test, method=manual-read, supports=validation recommendation.

### External References

- External reference: not used, none, accessed 2026-04-11, supports=repo-only run; source policy=off.
`
  );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.status, "created");
  assert.equal(written.validation.valid, true, written.validation.issues.join("\n"));
});

test("research template accepts claim-addressable provenance", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: validResearchContent(
      "Create research with claim-addressable provenance and split source lanes."
    ),
    overwrite: true
  });

  assert.equal(written.status, "created");
  assert.equal(written.validation.valid, true, written.validation.issues.join("\n"));
  assert.doesNotMatch(
    written.validation.warnings.join("\n"),
    /split ## Sources|claim-addressable evidence|External Sources row with an access date|Source Register rows should include|Recommendation Handoff rows should cite|repo_runtime claims should cite|HIGH confidence/i
  );
});

test("research validation warns when live external wording lacks dated evidence", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Current official docs confirm the external source row omits an access date."
  ).replace(
    "| EVID-002 | CLM-002 | supplied_reference | unknown | Repo-only fixture | SRC-002 | supplied-unchecked | no external lookup used | out_of_scope | source policy off | repo-only fixture | do not use as external support |",
    "| EVID-002 | CLM-002 | official_product_doc | official_vendor_doc | Example docs | SRC-002; https://example.com/docs | unchecked | current behavior | directly_supported | parent-approved external check | may drift | REC-001 |"
  );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.validation.valid, true, written.validation.issues.join("\n"));
  assert.match(
    written.validation.warnings.join("\n"),
    /uses current external verification wording without an External Sources or Source Register row with an access date/i
  );
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.live_external_claim_without_evidence" && diagnostic.severity === "warning"
    )
  );
});

test("research validation warns on HIGH confidence with unsupported claims", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research that keeps unsupported claim-addressable evidence visible for validation warnings."
  ).replace(
    "| CLM-001 | Research persistence is MCP-owned and validated before write completion. | repo_runtime | EVID-001 | directly_supported | HIGH | REC-001 |",
    "| CLM-001 | Research persistence is MCP-owned and validated before write completion. | repo_runtime | EVID-001 | not_enough_evidence | HIGH | REC-001 |"
  );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.validation.valid, true, written.validation.issues.join("\n"));
  assert.match(
    written.validation.warnings.join("\n"),
    /uses HIGH confidence while planner-critical claims are contradicted, conflicting, unchecked, unverified, or not enough evidence/i
  );
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.high_confidence_unsupported" && diagnostic.severity === "warning"
    )
  );
});

test("research validation ignores unsupported rows marked do not use as support", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research that keeps unsupported background rows out of planner-facing HIGH-confidence warnings."
  ).replace(
    "| CLM-002 | No live external lookup is required for this repo-only fixture. | open_question | EVID-002 | out_of_scope | LOW | do not use as support |",
    "| CLM-002 | No live external lookup is required for this repo-only fixture. | open_question | EVID-002 | not_enough_evidence | LOW | do not use as support |"
  );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.validation.valid, true, written.validation.issues.join("\n"));
  assert.ok(
    !written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.high_confidence_unsupported"
    )
  );
});

test("research validation warns on HIGH confidence with planner-relevant unsupported evidence rows", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research that warns when planner-relevant evidence remains unsupported even without claim ledger rows."
  )
    .replace(
      /## Claim Support Ledger[\s\S]*?\n## Locked Decisions From Context/,
      `## Claim Support Ledger

- Claim support ledger deferred; rely on evidence rows for this validation fixture.

## Locked Decisions From Context`
    )
    .replace(
      "| EVID-001 | CLM-001 | SRC-001 | mcp-handler | manual-read; MCP handler | phase artifact writes route through MCP-owned tooling | directly_supported | REC-001 | local checkout only |",
      "| EVID-001 | CLM-001 | SRC-001 | mcp-handler | manual-read; MCP handler | phase artifact writes route through MCP-owned tooling | not_enough_evidence | REC-001 | local checkout only |"
    );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.validation.valid, true, written.validation.issues.join("\n"));
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.high_confidence_unsupported" && diagnostic.severity === "warning"
    )
  );
});

test("research validation returns warning diagnostics for repo-runtime claims without repo evidence", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research with a repo-runtime claim supported only by external evidence."
  )
    .replace("EVID-001 | directly_supported", "EVID-002 | directly_supported")
    .replace("| SRC-002 | external | supplied-none | supplied-unchecked | n/a | supplied_reference | background | no live external lookup used |", "| SRC-002 | external | https://example.com/docs | 2026-04-11 | n/a | official_product_doc | CLM-001 | fixture only |")
    .replace("| EVID-002 | CLM-002 | supplied_reference | unknown | Repo-only fixture | SRC-002 | supplied-unchecked | no external lookup used | out_of_scope | source policy off | repo-only fixture | do not use as external support |", "| EVID-002 | CLM-001 | official_product_doc | official_vendor_doc | Example docs | SRC-002 | 2026-04-11 | docs describe an adjacent practice | directly_supported | parent-approved external check | fixture only | REC-001 |");

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.validation?.valid, true);
  assert.match(
    written.validation?.warnings.join("\n") ?? "",
    /repo_runtime claims should cite at least one repo-lane Source Register row/i
  );
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.repo_runtime_claim_missing_repo_evidence" && diagnostic.severity === "warning"
    )
  );
});

test("research validation returns warning diagnostics for partial repo-runtime retrieval", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research with repo evidence that is not runtime-adequate for a repo-runtime claim."
  )
    .replace("| SRC-001 | repo | src/mcp/tools/phase.ts | observed 2026-04-11 | blueprintPhaseArtifactWrite | repo_file | CLM-001 | local fixture evidence |", "| SRC-001 | repo | .blueprint/codebase/STACK.md | observed 2026-04-11 | n/a | repo_file | CLM-001 | summary-only evidence |")
    .replace("| EVID-001 | CLM-001 | SRC-001 | mcp-handler | manual-read; MCP handler | phase artifact writes route through MCP-owned tooling | directly_supported | REC-001 | local checkout only |", "| EVID-001 | CLM-001 | SRC-001 | background | codebase-summary | summary says validation exists | partially_supported | REC-001 | summary-only fixture |");

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.validation?.valid, true);
  assert.match(
    written.validation?.warnings.join("\n") ?? "",
    /repo_runtime claims should cite runtime-adequate evidence/i
  );
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.repo_runtime_claim_retrieval_partial" && diagnostic.severity === "warning"
    )
  );
});

test("research validation returns warning diagnostics for weak recommendation handoff rows", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research with a recommendation that lacks planner-ready support."
  ).replace(
    "| REC-001 | Persist only validated research content through `blueprint_phase_artifact_write`. | CLM-001 | EVID-001 | src/mcp/tools/phase.ts, src/mcp/tools/artifacts.ts, tests/phase-discovery-research.test.ts | npx tsx --test tests/phase-discovery-research.test.ts | ready |",
    "| REC-001 | Persist only validated research content through `blueprint_phase_artifact_write`. |  |  |  |  | ready |"
  );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.validation?.valid, true);
  assert.match(
    written.validation?.warnings.join("\n") ?? "",
    /Recommendation Handoff rows should cite supporting claim IDs or evidence IDs/i
  );
  assert.match(
    written.validation?.warnings.join("\n") ?? "",
    /Recommendation Handoff rows should name tests\/checks or validation signals/i
  );
  assert.match(
    written.validation?.warnings.join("\n") ?? "",
    /Recommendation Handoff rows should name affected files, commands, contracts, docs, or modules/i
  );
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.recommendation_missing_evidence" && diagnostic.severity === "warning"
    )
  );
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.recommendation_missing_affected_surfaces" && diagnostic.severity === "warning"
    )
  );
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.recommendation_missing_validation_signal" && diagnostic.severity === "warning"
    )
  );
});

test("research validation warns when repo-only output claims current official docs confirmed", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Current official docs confirm that research artifact validation should stay MCP-owned."
  );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.validation?.valid, true);
  assert.match(
    written.validation?.warnings.join("\n") ?? "",
    /uses current external verification wording without an External Sources or Source Register row with an access date/i
  );
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.live_external_claim_without_evidence" && diagnostic.severity === "warning"
    )
  );
});

test("research validation accepts External Sources Accessed date as live external evidence", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Current official docs confirm that research artifact validation should stay MCP-owned."
  ).replace(
    "| EVID-002 | CLM-002 | supplied_reference | unknown | Repo-only fixture | SRC-002 | supplied-unchecked | no external lookup used | out_of_scope | source policy off | repo-only fixture | do not use as external support |",
    "| EVID-002 | CLM-002 | official_product_doc | official_vendor_doc | Example docs | SRC-002; https://example.com/docs | 2026-05-13 | current behavior | directly_supported | parent-approved external check | may drift | REC-001 |"
  );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  const warnings = written.validation?.warnings.join("\n") ?? "";
  const diagnostics = written.validation?.diagnostics ?? [];

  assert.equal(written.validation?.valid, true, written.validation?.issues.join("\n"));
  assert.doesNotMatch(
    warnings,
    /uses current external verification wording without an External Sources or Source Register row with an access date/i
  );
  assert.equal(
    diagnostics.some((diagnostic) => diagnostic.code === "research.live_external_claim_without_evidence"),
    false
  );
});

test("research validation accepts legacy structurally valid research without warning-only shape nudges", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent("Create legacy-shaped research that remains structurally valid.")
    .replace(/## Claim Support Ledger[\s\S]*?\n## Locked Decisions From Context/, "## Locked Decisions From Context")
    .replace(/### Recommendation Handoff[\s\S]*?\n## Sources/, "- Persist only validated research content through `blueprint_phase_artifact_write`.\n\n## Sources")
    .replace(/### Source Register[\s\S]*?\n### Repo Evidence/, "### Repo Evidence");

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.status, "created");
  assert.equal(written.validation?.valid, true, written.validation?.issues.join("\n"));
  assert.equal(written.validation?.warnings.length ?? 0, 0);
});

test("research validation accepts table-only structured source evidence", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research whose source evidence is carried entirely by populated claim-addressable tables."
  )
    .replace(/\n- Repo evidence:[^\n]+\n\n\| Evidence ID \|/m, "\n\n| Evidence ID |")
    .replace(/\n### Supply Chain Evidence[\s\S]*$/, "");

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.status, "created");
  assert.equal(written.validation?.valid, true, written.validation?.issues.join("\n"));
});

test("research validation rejects structured source tables without concrete evidence", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research whose structured source tables contain only placeholders and generic non-source rows."
  ).replace(
    /## Sources[\s\S]*$/,
    `## Sources

### Source Register

| Source ID | Lane | Path Or URL | Accessed | Repo Line Or Symbol | Source Type | Used For Claims | Limitations |
|-----------|------|-------------|----------|---------------------|-------------|-----------------|-------------|
| SRC-001 | repo | placeholder | none | n/a | command_output | CLM-001 | placeholder only |

### Repo Evidence

| Evidence ID | Claim ID | Source Ref | Role | Retrieval Context | Support Span | Claim Class | Downstream Use | Limitations |
|-------------|----------|------------|------|-------------------|--------------|-------------|----------------|-------------|
| EVID-001 | CLM-001 | SRC-001 | mcp-handler | observed behavior | command output only | directly_supported | REC-001 | placeholder only |

### External Sources

| Evidence ID | Claim ID | Source Type | Authority Tier | Source Title | Source Ref | Accessed | Support Span | Claim Class | Retrieval Context | Limitations | Downstream Use |
|-------------|----------|-------------|----------------|--------------|------------|----------|--------------|-------------|-------------------|-------------|----------------|
| EVID-002 | CLM-002 | note | unknown | Placeholder row | SRC-001 | none | generic note | out_of_scope | background only | placeholder only | do not use as support |

### Inference Notes

| Evidence ID | Claim ID | Derived From | Claim Class | Derivation / Attribution | Limitations | Downstream Use |
|-------------|----------|--------------|-------------|--------------------------|-------------|----------------|
| EVID-003 | CLM-003 | EVID-001 | inferred_from_supported | generic inference note | placeholder only | REC-001 |
`
  );

  const invalid = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(invalid.status, "invalid");
  assert.match(
    invalid.validation.issues.join("\n"),
    /source bullet with a URL, repo path, or cited file, or a structured source row with concrete evidence/i
  );
});

test("research template leaves dependency/tool completeness guidance to authoring instructions", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research with a dependency recommendation that lacks dependency/tool evaluation."
  )
    .replace(/### Dependency \/ Tool Evaluation[\s\S]*?\n## Installation And Setup/, "## Installation And Setup")
    .replace(/### Setup And Update Posture[\s\S]*?\n## Alternatives Considered/, "## Alternatives Considered")
    .replace(/### Dependency Alternatives[\s\S]*?\n## Architecture Patterns/, "## Architecture Patterns")
    .replace(/### Library Vs Custom Decision[\s\S]*?\n## Anti-Patterns/, "## Anti-Patterns")
    .replace(/### Supply Chain Evidence[\s\S]*$/, "")
    .replace(
      "- Persist only validated research content through `blueprint_phase_artifact_write`.",
      "- Add a package dependency to perform research artifact validation."
    );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.status, "created");
  assert.equal(written.validation.valid, true, written.validation.issues.join("\n"));
  assert.equal(written.validation.warnings.length, 0);
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
  assert.match(contract.contract.authoringTemplate, /## Investigation Trace/);
  assert.match(contract.contract.authoringTemplate, /Navigation Evidence Packet/);
  assert.match(contract.contract.authoringTemplate, /Query Or Navigation Method/);
  assert.match(contract.contract.authoringTemplate, /Scope Filter/);
  assert.match(contract.contract.authoringTemplate, /Candidate Files Or Symbols/);
  assert.match(contract.contract.authoringTemplate, /Files Read/);
  assert.match(contract.contract.authoringTemplate, /### Repo Evidence/);
  assert.match(contract.contract.authoringTemplate, /### External Sources/);
  assert.match(contract.contract.authoringTemplate, /### Inference Notes/);
  assert.match(contract.contract.authoringTemplate, /## Claim Support Ledger/);
  assert.match(contract.contract.authoringTemplate, /### Recommendation Handoff/);
  assert.match(contract.contract.authoringTemplate, /### Source Register/);
  assert.match(contract.contract.authoringTemplate, /Evidence ID/);
  assert.match(contract.contract.authoringTemplate, /Claim ID/);
  assert.match(
    contract.contract.authoringTemplate,
    /use exactly `- none` under `## Open Questions`; do not write `null`, `\[\]`, or prose variants/i
  );
  assert.equal(contract.contract.sectionValidations?.["Open Questions"]?.exactEmptySentinel, "- none");
  assert.equal(contract.contract.freehandPolicy, "additional-top-level-headings");
  assert.match(contract.contract.notes.join("\n"), /Investigation Trace/i);
  assert.match(contract.contract.notes.join("\n"), /planner-grade evidence density/i);
  assert.match(contract.contract.notes.join("\n"), /search notes/i);
  assert.match(contract.contract.notes.join("\n"), /retrieval methods/i);
  assert.match(contract.contract.notes.join("\n"), /repo-versus-external provenance/i);
  assert.match(contract.contract.notes.join("\n"), /warning-grade evidence diagnostics/i);
  assert.match(contract.contract.notes.join("\n"), /Open Questions may use the exact `- none` sentinel/i);
  assert.equal(reused.status, "reused");
  assert.equal(updated.status, "updated");
  assert.equal(invalid.status, "invalid");
  assert.match(invalid.validation.issues.join("\n"), /required section|Confidence|source/i);
  assert.match(researchBody, /Update the artifact after an explicit overwrite path/);
});

test("phase artifact write canonicalizes near-miss research headings before save", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const variantHeadingContent = validResearchContent(
    "Rewrite near-miss legacy headings to the canonical research contract."
  )
    .replace("## Installation And Setup", "## Installation & Setup")
    .replace("## Don't Hand-Roll", "## Dont Hand Roll")
    .replace("## Anti-Patterns", "## Anti Patterns")
    .replace("## State Of The Art", "## State of the Art");

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: variantHeadingContent,
    overwrite: true
  });
  const saved = await readFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-RESEARCH.md"),
    "utf8"
  );

  assert.equal(written.status, "created");
  assert.equal(written.validation?.valid, true, written.validation?.issues.join("\n"));
  assert.match(saved, /^## Installation And Setup$/m);
  assert.match(saved, /^## Don't Hand-Roll$/m);
  assert.match(saved, /^## Anti-Patterns$/m);
  assert.match(saved, /^## State Of The Art$/m);
  assert.doesNotMatch(saved, /^## Installation & Setup$/m);
  assert.doesNotMatch(saved, /^## Dont Hand Roll$/m);
  assert.doesNotMatch(saved, /^## Anti Patterns$/m);
  assert.doesNotMatch(saved, /^## State of the Art$/m);
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
  assert.match(statusBefore.suggestedRepairs.join("\n"), /## Phase Requirements|## Sources|## Locked Decisions From Context/i);
  assert.equal(unchanged.status, "invalid");
  assert.equal(unchanged.written, false);
  assert.match(unchanged.validation?.issues.join("\n") ?? "", /required section|Confidence|source/i);
  assert.match(unchanged.suggestedRepairs?.join("\n") ?? "", /## Phase Requirements|## Sources/i);
  assert.match(unchanged.retryPlan?.steps.join("\n") ?? "", /## Phase Requirements|## Sources/i);
  assert.equal(repaired.status, "updated");
  assert.equal(repaired.written, true);
  assert.equal(statusAfter.researchValid, true);
});

test("research validation allows State Of The Art without freshness marker", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: validResearchContent(
      "Create research whose State Of The Art section omits freshness markers."
    ).replace(
      "- Repo-local guidance stays anchored in saved Blueprint contracts and command metadata.",
      "- Template-driven research generation keeps drafting aligned with the MCP-owned schema."
    ),
    overwrite: true
  });

  assert.equal(written.status, "created");
  assert.equal(written.validation.valid, true, written.validation.issues.join("\n"));
});

test("research validation rejects generic code spans as source evidence", async (t) => {
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
      "Create research whose source list uses a generic code span instead of real evidence."
    ).replace(
      /## Sources[\s\S]*$/,
      "## Sources\n\n- `not a path` - fabricated non-source citation.\n"
    ),
    overwrite: true
  });

  assert.equal(invalid.status, "invalid");
  assert.match(
    invalid.validation.issues.join("\n"),
    /source bullet with a URL, repo path, or cited file/i
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
  await assert.rejects(
    blueprintStateUpdate({
      cwd: repoPath,
      base: "synced",
      patch: {
        activeCommand: "/blu-research-phase",
        lastUpdated: "2026-04-12T00:00:00.000Z"
      }
    }),
    /CONTEXT\.md is missing/i
  );
  const loadedState = await blueprintStateLoad({ cwd: repoPath });
  const stateBody = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");

  assert.equal(missingContext.found, false);
  assert.match(missingContext.reason ?? "", /03-CONTEXT\.md does not exist yet/i);
  assert.equal(researchStatus.hasContext, false);
  assert.match(loadedState.derivedStatus.nextAction, /\/blu-discuss-phase 3/);
  assert.match(stateBody, /Run \/blu-progress/);
  assert.doesNotMatch(stateBody, /\/blu-research-phase/);
});

test("research finalization writes, syncs, proves route, then deletes checkpoint last", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-research-phase.toml"),
    "utf8"
  );
  const runtimeContract = await readFile(
    path.join(
      repoRoot,
      "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md"
    ),
    "utf8"
  );
  const finalizationOrder = runtimeContract.match(
    /Finalization order stays separate and guarded:[\s\S]*?blueprint_phase_checkpoint_delete[\s\S]*?expectedMode: "research"/
  )?.[0];

  assert.match(
    commandFile,
    /Delete[\s\S]*only after[\s\S]*final research write or valid reuse[\s\S]*synced state update[\s\S]*refreshed state load[\s\S]*implemented-command routing proof/i
  );
  assert.ok(finalizationOrder);
  assertTextOrder("runtime contract finalization order", finalizationOrder, [
    "blueprint_phase_artifact_write",
    "blueprint_state_update",
    "blueprint_state_load",
    "blueprint_command_catalog",
    "blueprint_phase_checkpoint_delete"
  ]);

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });
  await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: "3",
    checkpoint: {
      schemaVersion: 2,
      ownerCommand: "/blu-research-phase",
      mode: "research",
      researchLedger: {
        schemaVersion: "research-ledger/v1",
        strands: [
          {
            id: "S1",
            type: "planner-handoff",
            status: "complete",
            stoppingReason: "evidence-sufficient",
            nextAction: "route"
          }
        ],
        nextAction: {
          stage: "Route",
          pendingGate: "none",
          safeCommand: "/blu-plan-phase 3"
        }
      }
    }
  });

  const checkpointBefore = await blueprintPhaseCheckpointGet({
    cwd: repoPath,
    phase: "3",
    expectedOwnerCommand: "/blu-research-phase",
    expectedMode: "research"
  });
  const finalizationSteps: string[] = [];

  const researchWrite = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: validResearchContent(
      "Finalize research only after preserving the route-proof and checkpoint-delete order."
    ),
    overwrite: true
  });
  finalizationSteps.push("research_write");

  const stateUpdate = await blueprintStateUpdate({
    cwd: repoPath,
    base: "synced",
    patch: {
      activeCommand: "/blu-research-phase",
      currentPhase: "3",
      lastUpdated: "2026-04-12T00:00:00.000Z"
    }
  });
  finalizationSteps.push("state_update");

  const loadedState = await blueprintStateLoad({ cwd: repoPath });
  finalizationSteps.push("state_load");

  const catalog = await blueprintCommandCatalog();
  finalizationSteps.push("command_catalog");
  const nextCommand = loadedState.derivedStatus.nextAction.match(/\/blu-([a-z-]+)/)?.[1];
  assert.ok(nextCommand, loadedState.derivedStatus.nextAction);
  assert.equal(catalog.commands[nextCommand]?.implemented, true);

  const checkpointDelete = await blueprintPhaseCheckpointDelete({
    cwd: repoPath,
    phase: "3",
    expectedOwnerCommand: "/blu-research-phase",
    expectedMode: "research"
  });
  finalizationSteps.push("checkpoint_delete");
  const checkpointAfter = await blueprintPhaseCheckpointGet({
    cwd: repoPath,
    phase: "3",
    expectedOwnerCommand: "/blu-research-phase",
    expectedMode: "research"
  });

  assert.equal(checkpointBefore.safeToResume, true);
  assert.equal(researchWrite.status, "created");
  assert.equal(researchWrite.validation.valid, true, researchWrite.validation.issues.join("\n"));
  assert.deepEqual(stateUpdate.updatedFields.sort(), [
    "activeCommand",
    "lastUpdated"
  ].sort());
  assert.equal(loadedState.derivedStatus.currentPhase, "3");
  assert.doesNotMatch(loadedState.derivedStatus.nextAction, /\/blu-research-phase 3/);
  assert.equal(checkpointDelete.deleted, true);
  assert.equal(checkpointAfter.found, false);
  assert.deepEqual(finalizationSteps, [
    "research_write",
    "state_update",
    "state_load",
    "command_catalog",
    "checkpoint_delete"
  ]);
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

test("research-phase synced state update stays on an explicitly selected earlier phase", async (t) => {
  const repoPath = await createEarlierSelectedResearchPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const contextWrite = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "2",
    artifact: "context",
    model: validPhaseContextModel({
      phaseLabel: "phase 2",
      openQuestions: ["none"]
    }),
    overwrite: true
  });
  const researchWrite = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "2",
    artifact: "research",
    content: validResearchContent(
      "Keep research routing pinned to the explicitly selected earlier phase."
    ).replaceAll("Phase 03: Phase Discovery", "Phase 02: Earlier Discovery"),
    overwrite: true
  });
  const stateUpdate = await blueprintStateUpdate({
    cwd: repoPath,
    base: "synced",
    patch: {
      activeCommand: "/blu-research-phase",
      currentPhase: "2",
      lastUpdated: "2026-04-12T00:00:00.000Z"
    }
  });
  const loadedState = await blueprintStateLoad({ cwd: repoPath });
  const stateBody = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");

  assert.equal(contextWrite.written, true);
  assert.equal(researchWrite.written, true);
  assert.ok(stateUpdate.updatedFields.includes("activeCommand"));
  assert.equal(stateUpdate.statePath, ".blueprint/STATE.md");
  assert.match(
    stateUpdate.warnings.join("\n"),
    /requested phase 2 instead of the roadmap current phase 3/i
  );
  assert.equal(loadedState.state.activeCommand, "/blu-research-phase");
  assert.equal(loadedState.derivedStatus.currentPhase, "2");
  assert.match(loadedState.derivedStatus.nextAction, /\/blu-ui-phase 2/);
  assert.doesNotMatch(loadedState.derivedStatus.nextAction, /\/blu-ui-phase 3|\/blu-plan-phase 3/);
  assert.match(stateBody, /- Current phase: 2/);
  assert.match(stateBody, /Run \/blu-ui-phase 2 to draft the phase UI contract/);
  assert.doesNotMatch(stateBody, /Run \/blu-ui-phase 3|Run \/blu-plan-phase 3/);
});

test("research-phase synced state update skips ui-phase for explicit backend-only earlier phase", async (t) => {
  const repoPath = await createEarlierSelectedResearchPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/02-earlier-discovery/02-CONTEXT.md"),
    backendOnlyNoUiContextContent("2", "Earlier Discovery"),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/02-earlier-discovery/02-RESEARCH.md"),
    validResearchContent(
      "Keep research routing pinned to the explicitly selected earlier backend-only phase."
    ).replaceAll("Phase 03: Phase Discovery", "Phase 02: Earlier Discovery"),
    "utf8"
  );

  const stateUpdate = await blueprintStateUpdate({
    cwd: repoPath,
    base: "synced",
    patch: {
      activeCommand: "/blu-research-phase",
      currentPhase: "2",
      lastUpdated: "2026-04-12T00:00:00.000Z"
    }
  });
  const loadedState = await blueprintStateLoad({ cwd: repoPath });
  const stateBody = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");

  assert.ok(stateUpdate.updatedFields.includes("activeCommand"));
  assert.equal(loadedState.state.activeCommand, "/blu-research-phase");
  assert.equal(loadedState.derivedStatus.currentPhase, "2");
  assert.match(loadedState.derivedStatus.nextAction, /\/blu-ui-phase 2/);
  assert.match(loadedState.derivedStatus.nextAction, /explicit UI skip rationale/);
  assert.doesNotMatch(loadedState.derivedStatus.nextAction, /\/blu-plan-phase 2/);
  assert.match(stateBody, /Run \/blu-ui-phase 2 to record the explicit UI skip rationale/);
  assert.doesNotMatch(stateBody, /Run \/blu-plan-phase 2 to create execution-ready phase plans/);
});

test("research-phase synced state update still routes to ui-phase when a saved ui-spec is invalid", async (t) => {
  const repoPath = await createEarlierSelectedResearchPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(repoPath, ".blueprint/phases/02-earlier-discovery/02-CONTEXT.md"),
    backendOnlyNoUiContextContent("2", "Earlier Discovery"),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/02-earlier-discovery/02-RESEARCH.md"),
    validResearchContent(
      "Keep research routing pinned to the explicitly selected earlier backend-only phase."
    ).replaceAll("Phase 03: Phase Discovery", "Phase 02: Earlier Discovery"),
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/phases/02-earlier-discovery/02-UI-SPEC.md"),
    `# Phase 02 UI Spec

## Outcome Mode
- Choose one: UI contract or explicit skip rationale.
`,
    "utf8"
  );

  const stateUpdate = await blueprintStateUpdate({
    cwd: repoPath,
    base: "synced",
    patch: {
      activeCommand: "/blu-research-phase",
      currentPhase: "2",
      lastUpdated: "2026-04-12T00:00:00.000Z"
    }
  });
  const loadedState = await blueprintStateLoad({ cwd: repoPath });
  const stateBody = await readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");

  assert.ok(stateUpdate.updatedFields.includes("activeCommand"));
  assert.equal(loadedState.state.activeCommand, "/blu-research-phase");
  assert.equal(loadedState.derivedStatus.currentPhase, "2");
  assert.match(loadedState.derivedStatus.nextAction, /\/blu-ui-phase 2/);
  assert.doesNotMatch(loadedState.derivedStatus.nextAction, /\/blu-plan-phase 2/);
  assert.match(stateBody, /Run \/blu-ui-phase 2 to repair the phase UI contract/);
  assert.doesNotMatch(stateBody, /Run \/blu-plan-phase 2 to create execution-ready phase plans/);
});
