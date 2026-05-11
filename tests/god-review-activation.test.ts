import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";

const repoRoot = process.cwd();

const PRIVATE_TOOL_IDS = [
  "blueprint_god_review_start",
  "blueprint_god_review_next",
  "blueprint_god_review_append",
  "blueprint_god_review_load_findings",
  "blueprint_god_review_record_fix",
  "blueprint_god_review_cleanup"
] as const;

const PRIVATE_RUNTIME_TOOL_IDS = PRIVATE_TOOL_IDS.map((toolId) => `mcp_blueprint_${toolId}`);
const PRIVATE_LANE_REFERENCE_PATHS = [
  "skills/blueprint-god-review/references/review-method.md",
  "skills/blueprint-god-review/references/lane-rubrics.md",
  "skills/blueprint-god-review/references/finding-quality.md",
  "skills/blueprint-god-review/references/context-selection.md",
  "skills/blueprint-god-review/references/finding-examples.md"
] as const;
const PRIVATE_TERMINAL_REFERENCE_PATH =
  "skills/blueprint-god-review/references/final-curation.md";
const PRIVATE_REFERENCE_PATHS = [
  ...PRIVATE_LANE_REFERENCE_PATHS,
  PRIVATE_TERMINAL_REFERENCE_PATH
] as const;

async function readRelativePath(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertAppearsBefore(text: string, first: string, second: string, label: string): void {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);

  assert.notEqual(firstIndex, -1, `${label} is missing ${first}`);
  assert.notEqual(secondIndex, -1, `${label} is missing ${second}`);
  assert.ok(firstIndex < secondIndex, `${label} should mention ${first} before ${second}`);
}

test("code-review manifest keeps the hidden dispatcher tiny and defers orchestration to the private skill", async () => {
  const manifest = await readRelativePath("commands/blu-code-review.toml");

  assertAppearsBefore(
    manifest,
    "Dispatcher:",
    "Use the `blueprint-review` skill as the primary orchestration contract",
    "code-review manifest"
  );
  assert.match(manifest, /raw invocation contains a standalone `--feels-like-god` flag token/);
  assert.match(manifest, /do not run the normal code-review flow below/i);
  assert.match(manifest, /Follow `skills\/blueprint-god-review\/SKILL\.md` for this invocation only/i);
  assert.match(manifest, /stop if that private skill reaches a terminal outcome/i);
  assert.doesNotMatch(manifest, /Hidden God-Review Activation Guard/i);
  assert.doesNotMatch(manifest, /selection\.status/i);
  assert.doesNotMatch(manifest, /\.god-review-state\.md/i);
  assert.doesNotMatch(manifest, /scopeFingerprint/i);

  for (const toolId of PRIVATE_RUNTIME_TOOL_IDS) {
    assert.doesNotMatch(manifest, new RegExp(toolId));
  }
});

test("code-review-fix manifest keeps the hidden dispatcher tiny and defers orchestration to the private skill", async () => {
  const manifest = await readRelativePath("commands/blu-code-review-fix.toml");

  assertAppearsBefore(
    manifest,
    "Dispatcher:",
    "Use the `blueprint-review` skill as the primary orchestration contract",
    "code-review-fix manifest"
  );
  assert.match(manifest, /raw invocation contains a standalone `--feels-like-god` flag token/);
  assert.match(manifest, /do not run the normal review-fix flow below/i);
  assert.match(manifest, /Follow `skills\/blueprint-god-review\/SKILL\.md` for this invocation only/i);
  assert.match(manifest, /stop if that private skill reaches a terminal outcome/i);
  assert.doesNotMatch(manifest, /Hidden God-Review Activation Guard/i);
  assert.doesNotMatch(manifest, /selection\.status/i);
  assert.doesNotMatch(manifest, /XX-GOD-REVIEW-FIX/i);
  assert.doesNotMatch(manifest, /\.god-review-state\.md/i);

  for (const toolId of PRIVATE_RUNTIME_TOOL_IDS) {
    assert.doesNotMatch(manifest, new RegExp(toolId));
  }
});

test("public blueprint-review skill stays clean of hidden god-review activation details", async () => {
  const skill = await readRelativePath("skills/blueprint-review/SKILL.md");

  assert.doesNotMatch(skill, /--feels-like-god/i);
  assert.doesNotMatch(skill, /Hidden God-Review Activation Guard/i);
  assert.doesNotMatch(skill, /god-review/i);
  assert.doesNotMatch(skill, /\.god-review-state\.md/i);
  assert.doesNotMatch(skill, /XX-GOD-REVIEW-FIX/i);
  assert.doesNotMatch(skill, /This is a mistaken skill invocation, reach out to blueprint admin for help\./);
  assert.doesNotMatch(skill, /No `thunderbolt` today\./);

  for (const toolId of PRIVATE_RUNTIME_TOOL_IDS) {
    assert.doesNotMatch(skill, new RegExp(toolId));
  }
});

test("private blueprint-god-review skill contains the hidden guard, refusal text, and private review flows", async () => {
  const skill = await readRelativePath("skills/blueprint-god-review/SKILL.md");

  assertAppearsBefore(
    skill,
    "Hidden God-Review Activation Guard",
    "mcp_blueprint_blueprint_project_status",
    "blueprint-god-review skill"
  );
  assert.match(skill, /active command\s+is `\/blu-code-review` or `\/blu-code-review-fix`/i);
  assert.match(skill, /raw invocation\s+contains `--feels-like-god` as a standalone flag token/i);
  assert.match(skill, /God mode only wakes during special `occassions`\./);
  assert.match(skill, /This is a mistaken skill invocation, reach out to blueprint admin for help\./);
  assert.match(skill, /No `thunderbolt` today\./);
  assert.match(
    skill,
    /Do not call MCP tools, inspect `\.blueprint\/`, read\s+repo files, use `STATE\.md\.activeCommand`, write files, spawn subagents/i
  );
  assertAppearsBefore(
    skill,
    "Hidden God-Review Activation Guard",
    "skills/blueprint-god-review/references/review-method.md",
    "blueprint-god-review private reference loading"
  );
  assertAppearsBefore(
    skill,
    "skills/blueprint-god-review/references/context-selection.md",
    "skills/blueprint-god-review/references/finding-examples.md",
    "blueprint-god-review private example reference loading"
  );
  assertAppearsBefore(
    skill,
    "skills/blueprint-god-review/references/finding-examples.md",
    "Hidden `/blu-code-review --feels-like-god` orchestration",
    "blueprint-god-review private reference loading"
  );
  for (const referencePath of PRIVATE_LANE_REFERENCE_PATHS) {
    assert.match(skill, new RegExp(referencePath.replaceAll("/", "\\/")));
  }
  assertAppearsBefore(
    skill,
    "Hidden God-Review Activation Guard",
    PRIVATE_TERMINAL_REFERENCE_PATH,
    "blueprint-god-review terminal curation loading"
  );
  assert.match(skill, /Do not load `skills\/blueprint-god-review\/references\/final-curation\.md` for\s+ordinary lane passes/i);
  assert.match(
    skill,
    /Load `skills\/blueprint-god-review\/references\/final-curation\.md` only after a\s+hidden review invocation reaches terminal review status/i
  );
  assert.match(
    skill,
    /never required before the activation guard, before the\s+hidden MCP state reports terminal review status, or during per-lane review/i
  );
  assert.match(
    skill,
    /load\s+`finding-examples\.md` only when classifying duplicate, weak, or no-edit\s+outcomes/i
  );
  assert.match(skill, /mcp_blueprint_blueprint_god_review_start/);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_next/);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_append/);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_load_findings/);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_record_fix/);
  assert.match(skill, /mcp_blueprint_blueprint_god_review_cleanup/);
  assert.match(skill, /Review exactly one returned pending group per invocation/i);
  assert.match(
    skill,
    /Do not call normal `blueprint_review_record`, do not write\s+`XX-REVIEW\.md`/i
  );
  assert.match(skill, /selection\.status/i);
  assert.match(skill, /Fix Eligibility: eligible/);
  assert.match(
    skill,
    /Use `--finding`, `--severity`, and `--all` as the only widening\s+selectors/i
  );
  assert.match(
    skill,
    /Set the record call's `terminal` flag only when the hidden fix pass has\s+reached a terminal result/i
  );
  assert.match(
    skill,
    /Cleanup may delete only the hidden session JSON and\s+`\.god-review-state\.md`/i
  );
  assert.match(skill, /preserve the durable god-review report and\s+remediation log/i);
});

test("private blueprint-god-review references are present and carry operational anchors", async () => {
  const [
    reviewMethod,
    laneRubrics,
    findingQuality,
    contextSelection,
    findingExamples
  ] = await Promise.all(
    PRIVATE_LANE_REFERENCE_PATHS.map((referencePath) => readRelativePath(referencePath))
  );
  const finalCuration = await readRelativePath(PRIVATE_TERMINAL_REFERENCE_PATH);

  assert.match(reviewMethod, /Fresh-Context Loop/);
  assert.match(reviewMethod, /Broad Scan, Then Focused Read/);
  assert.match(reviewMethod, /Skeptical Hypothesis Loop/);
  assert.match(reviewMethod, /One-Group Discipline/);
  assert.match(reviewMethod, /Terminal Curation Mindset/);

  for (const laneAnchor of [
    "COR / correctness-contracts",
    "SEC / security-privacy-auth",
    "DAT / data-state-consistency",
    "REL / reliability-failure-handling",
    "TST / tests-validation",
    "ARC / architecture-maintainability",
    "PER / performance-scale-cost",
    "OPS / operations-delivery"
  ]) {
    assert.match(laneRubrics, new RegExp(laneAnchor.replaceAll("/", "\\/")));
  }
  for (const section of ["Inspect:", "Evidence:", "False-positive traps:", "Finding examples:"]) {
    assert.match(laneRubrics, new RegExp(section));
  }

  assert.match(findingQuality, /Admission Standard/);
  assert.match(findingQuality, /Severity/);
  assert.match(findingQuality, /Confidence/);
  assert.match(findingQuality, /Disposition/);
  assert.match(findingQuality, /Fix Eligibility/);
  assert.match(findingQuality, /Duplicate Handling/);
  assert.match(findingQuality, /accepted-risk/i);
  assert.match(findingQuality, /observation/i);
  assert.match(findingQuality, /follow-up/i);

  for (const scopeAnchor of ["Phase Scope", "PR Scope", "Current-Diff Scope", "Explicit-Files Scope"]) {
    assert.match(contextSelection, new RegExp(scopeAnchor));
  }
  assert.match(contextSelection, /Diff-first, not diff-only/);
  assert.match(contextSelection, /Surrounding context:/);
  assert.match(contextSelection, /Avoid:/);
  assert.match(contextSelection, /What To Skip Or Omit/);

  assert.match(findingExamples, /Strong Actionable Finding Template/);
  assert.match(findingExamples, /Weak Finding To Drop/);
  assert.match(findingExamples, /Unsupported Hypothesis To Drop/);
  assert.match(findingExamples, /Observation Example/);
  assert.match(findingExamples, /Accepted Risk Example/);
  assert.match(findingExamples, /Duplicate Root Cause Merge Example/);
  assert.match(findingExamples, /Stale No-Edit Fix Example/);
  assert.match(findingExamples, /Security\/Auth Example/);
  assert.match(findingExamples, /Data\/State Example/);
  assert.match(findingExamples, /Tests Example/);
  assert.match(findingExamples, /Operations\/Delivery Example/);

  assert.match(finalCuration, /Terminal Review Preflight/);
  assert.match(finalCuration, /Dedupe Protocol/);
  assert.match(finalCuration, /Severity Reconciliation/);
  assert.match(finalCuration, /Weak-Finding Rejection/);
  assert.match(finalCuration, /Cross-Lane Synthesis/);
  assert.match(finalCuration, /Terminal Response Shape/);
  assert.match(finalCuration, /No-Side-Effect Curation/);
  assert.match(finalCuration, /never invent missing groups/i);
  assert.match(finalCuration, /Do not create new findings during curation unless a lane already recorded/i);
  assert.match(finalCuration, /Keep confidence separate from severity/i);
  assert.match(finalCuration, /Reject unsupported missing-test claims/i);
  assert.match(finalCuration, /Do not update normal `STATE\.md`/);
  assert.match(finalCuration, /Final curation is prompt-level only/i);
});

test("public runtime-contract resources still hide hidden branch text", async () => {
  const codeReview = await buildBlueprintCommandRuntimeContractResource("code-review");
  const codeReviewFix = await buildBlueprintCommandRuntimeContractResource("code-review-fix");

  for (const payload of [codeReview, codeReviewFix]) {
    const serialized = JSON.stringify(payload, null, 2);

    assert.doesNotMatch(serialized, /--feels-like-god/i);
    assert.doesNotMatch(serialized, /Hidden god-review/i);
    assert.doesNotMatch(serialized, /Hidden God-Review Activation Guard/i);

    for (const referencePath of PRIVATE_REFERENCE_PATHS) {
      assert.doesNotMatch(serialized, new RegExp(referencePath));
    }
    assert.doesNotMatch(serialized, /Fresh-Context Loop/i);
    assert.doesNotMatch(serialized, /Terminal Curation Mindset/i);
    assert.doesNotMatch(serialized, /Strong Actionable Finding Template/i);
    assert.doesNotMatch(serialized, /Weak Finding To Drop/i);
    assert.doesNotMatch(serialized, /Unsupported Hypothesis To Drop/i);
    assert.doesNotMatch(serialized, /Duplicate Root Cause Merge/i);
    assert.doesNotMatch(serialized, /Stale No-Edit Fix/i);
    assert.doesNotMatch(serialized, /Dedupe Protocol/i);
    assert.doesNotMatch(serialized, /Severity Reconciliation/i);
    assert.doesNotMatch(serialized, /Weak-Finding Rejection/i);
    assert.doesNotMatch(serialized, /Cross-Lane Synthesis/i);
    assert.doesNotMatch(serialized, /Terminal Response Shape/i);
    assert.doesNotMatch(serialized, /No-Side-Effect Curation/i);
    assert.doesNotMatch(serialized, /Fix Eligibility/i);

    for (const toolId of PRIVATE_TOOL_IDS) {
      assert.doesNotMatch(serialized, new RegExp(toolId));
    }
  }
});
