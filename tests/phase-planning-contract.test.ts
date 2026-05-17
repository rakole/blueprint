import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeContractPath =
  "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md";
const skillPath = "skills/blueprint-phase-planning/SKILL.md";
const manifestPath = "commands/blu-plan-phase.toml";
const commandSpecPath = "docs/commands/plan-phase.md";
const plannerAgentPath = "agents/blueprint-planner.md";
const checkerAgentPath = "agents/blueprint-checker.md";

function readRepoText(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludesAll(content: string, expectedParts: readonly string[]) {
  for (const part of expectedParts) {
    assert.ok(content.includes(part), `expected content to include "${part}"`);
  }
}

function assertOrdered(content: string, orderedParts: readonly string[]) {
  let previousIndex = -1;

  for (const [index, part] of orderedParts.entries()) {
    const currentIndex = content.indexOf(part);

    assert.ok(currentIndex >= 0, `expected content to include "${part}"`);
    if (index === 0) {
      assert.ok(currentIndex >= 0, `expected "${part}" to appear in order`);
    } else {
      assert.ok(
        currentIndex > previousIndex,
        `expected "${part}" to appear after "${orderedParts[index - 1]}"`
      );
    }
    previousIndex = currentIndex;
  }
}

function extractTopLevelSection(content: string, heading: string): string {
  const startIndex = content.indexOf(heading);
  assert.ok(startIndex >= 0, `expected content to include "${heading}"`);

  const remainingContent = content.slice(startIndex + heading.length);
  const nextTopLevelOffset = remainingContent.search(/\n##\s+/);

  if (nextTopLevelOffset < 0) {
    return content.slice(startIndex);
  }

  return content.slice(startIndex, startIndex + heading.length + nextTopLevelOffset);
}

function normalizeWhitespace(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

test("planning contract defines investigation trace", () => {
  const runtimeContract = readRepoText(runtimeContractPath);

  assertIncludesAll(runtimeContract, [
    "Planning Investigation Trace",
    "Evidence Inventory",
    "Planning Signals",
    "Compact Summary",
    "present-usable",
    "present-scaffold",
    "present-invalid",
    "missing",
    "disabled-by-config"
  ]);
});

test("planning contract defines pre-draft readiness", () => {
  const runtimeContract = readRepoText(runtimeContractPath);

  assertIncludesAll(runtimeContract, [
    "Pre-Draft Readiness Assessment",
    "Phase goal clarity",
    "Evidence sufficiency"
  ]);
});

test("planning contract defines semantic self-check", () => {
  const runtimeContract = readRepoText(runtimeContractPath);

  assertIncludesAll(runtimeContract, [
    "Post-Draft Semantic Self-Check",
    "Does every task `Action` name concrete target state",
    "Does every task `Read First` cite the actual files being modified",
    "Does every `Acceptance Criteria` item specify a mechanically checkable",
    "Does `requirementCoverage` account for every known phase requirement exactly",
    "Does `evidenceCoverage` match the latest runtime-narrowed inventory",
    "Could `/blu-execute-phase` implement each task without asking",
    "Are deferred items, assumptions, and evidence gaps named in"
  ]);
});

test("planning contract has worked examples", () => {
  const runtimeContract = readRepoText(runtimeContractPath);

  assertIncludesAll(runtimeContract, [
    "Worked Examples And Anti-Examples",
    "Single-Plan Phase",
    "Multi-Plan Phase",
    "Reuse Gate",
    "Anti-Example: Markdown Fallback"
  ]);
});

test("planning contract preserves existing completion criteria", () => {
  const runtimeContract = readRepoText(runtimeContractPath);

  assertIncludesAll(runtimeContract, [
    "## Completion Criteria",
    "A valid `phase.plan` contract was read before authoring.",
    "All enabled config gates were honored or explicitly routed.",
    "Final plan bodies were persisted through",
    ".blueprint/STATE.md` was refreshed through synced state update only after",
    "The final response names the phase, gates, plan ids",
    "the Downstream Execution Handoff"
  ]);
});

test("planning contract keeps stage hierarchy and Wave 1 section ordering", () => {
  const runtimeContract = readRepoText(runtimeContractPath);
  const stageMappingSection = extractTopLevelSection(runtimeContract, "## Stage Mapping");
  const normalizedStageMappingSection = normalizeWhitespace(stageMappingSection);

  assertOrdered(stageMappingSection, [
    "### Resolve",
    "### Read",
    "### Decide",
    "### Execute",
    "### Persist",
    "### Validate",
    "### Route"
  ]);

  assert.ok(
    normalizedStageMappingSection.includes(
      "The full section is defined below, after Stage Mapping, to preserve the stage hierarchy."
    ),
    "expected Stage Mapping Read section to point to the full Planning Investigation Trace section"
  );

  assertOrdered(runtimeContract, [
    "### Route",
    "## Planning Investigation Trace",
    "## Artifact Authoring Rules"
  ]);
});

test("planning contract defines decision record", () => {
  const runtimeContract = readRepoText(runtimeContractPath);

  assertIncludesAll(runtimeContract, [
    "Planning Decision Record",
    "revision-stable",
    "Carry-Forward Between Revision Passes"
  ]);
});

test("planning contract defines split framework", () => {
  const runtimeContract = readRepoText(runtimeContractPath);

  assertIncludesAll(runtimeContract, [
    "Plan Complexity And Split Framework",
    "Split Axes",
    "Minimum Viable Plan"
  ]);

  assertOrdered(runtimeContract, [
    "## Planning Investigation Trace",
    "## Planning Decision Record",
    "## Artifact Authoring Rules",
    "## Plan Complexity And Split Framework",
    "## Subagent Path"
  ]);
});

test("planner agent defines handoff packet", () => {
  const plannerAgent = readRepoText(plannerAgentPath);

  assertIncludesAll(plannerAgent, [
    "Expected Handoff Packet From Parent",
    "investigationTrace",
    "decisionRecord"
  ]);
});

test("checker agent defines revision tracking", () => {
  const checkerAgent = readRepoText(checkerAgentPath);

  assertIncludesAll(checkerAgent, [
    "Expected Handoff Packet From Parent",
    "investigationTrace",
    "priorFindings",
    "Revision Tracking",
    "resolved",
    "recurring",
    "new",
    "regressed",
    "convergence status"
  ]);
});

test("planning contract defines Wave 3 staleness and downstream handoff", () => {
  const runtimeContract = readRepoText(runtimeContractPath);

  assertIncludesAll(runtimeContract, [
    "#### Read-Set Staleness Check",
    "## Downstream Execution Handoff",
    "Any saved plan bodies or excerpts from",
    "that were relied on during `add`,",
    "pass the recorded readiness `readSet` as",
    "`expectedReadSet` to `mcp_blueprint_blueprint_phase_plan_write`",
    "`verificationPriorities`",
  ]);
});

test("planning contract strengthens no-subagent fallback", () => {
  const runtimeContract = readRepoText(runtimeContractPath);

  assertIncludesAll(runtimeContract, [
    "## No-Subagent Fallback",
    "Build the Planning Investigation Trace from the read context",
    "Build the Pre-Draft Readiness Assessment",
    "Compress the completed plan into the carry-forward note",
    "Run the Post-Draft Semantic Self-Check before claiming completion",
    "If any",
    "answer is `no`, repair the plan before persistence or final completion",
  ]);

  assertOrdered(runtimeContract, [
    "1. Build the Planning Investigation Trace from the read context",
    "2. Build the Pre-Draft Readiness Assessment.",
    "3. Draft one structured plan model at a time",
    "4. Run the inline quality checklist with priority ordering:",
    "5. Compress the completed plan into the carry-forward note",
    "6. Persist only after the current plan passes the inline checklist with no",
    "7. Move to the next dependency wave only after summarizing what was written",
    "8. If the inline checklist finds a blocker, repair the affected plan before",
    "9. Run the Post-Draft Semantic Self-Check before claiming completion.",
  ]);
});

test("runtime contract owns Wave 3 planning checks while prompt surfaces stay thin", () => {
  const skill = readRepoText(skillPath);
  const manifest = readRepoText(manifestPath);
  const commandSpec = readRepoText(commandSpecPath);
  const runtimeContract = readRepoText(runtimeContractPath);

  assertIncludesAll(runtimeContract, [
    "Planning Investigation Trace",
    "Planning Decision Record",
    "Post-Draft Semantic Self-Check",
    "the Downstream Execution Handoff",
  ]);

  assertIncludesAll(manifest, [
    "plan-phase-runtime-contract.md",
    "Keep this manifest thin",
    "Downstream Execution Handoff",
  ]);

  assertIncludesAll(skill, [
    "plan-phase-runtime-contract.md",
    "Completion Criteria",
    "Downstream Execution Handoff",
  ]);

  assertIncludesAll(commandSpec, [
    "user-facing documentation",
    "Downstream Execution Handoff",
    "expectedReadSet",
    "Final\ncompletion still depends on `blueprint_phase_plan_validate`",
  ]);

  assert.ok(manifest.length < 9000, `expected thin command manifest, got ${manifest.length} bytes`);
  assert.ok(skill.length < 9000, `expected compact primary skill, got ${skill.length} bytes`);
  assert.ok(
    manifest.length + skill.length < runtimeContract.length,
    "expected command plus skill to stay smaller than the runtime contract"
  );
});
