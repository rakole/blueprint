import { markdownCell, normalizeTextContent, renderBulletList } from "./phase-markdown.js";
import { type NumericInput } from "./phase-numbering.js";

type PhaseValidationRenderLookupArgs = {
  cwd?: string;
  phase?: NumericInput;
  phaseNumber?: NumericInput;
  phaseName?: string;
};

type PhaseValidationRenderResolvedPhase = {
  phasePrefix: string;
  phaseName: string;
};

export type VerificationRenderCoverageRow = {
  requirement?: string;
  taskOrCheck?: string;
  evidence?: string;
  coverageState?: string;
  notes?: string;
};

export type VerificationManualCoverageRow = {
  item?: string;
  whyManualOrDeferred?: string;
  followUp?: string;
  status?: string;
};

export type VerificationGapClassificationRow = {
  gapClass?: string;
  scope?: string;
  evidence?: string;
  repair?: string;
};

export type VerificationCoverageState =
  | "PASS"
  | "COVERED"
  | "MANUAL"
  | "DEFERRED"
  | "BLOCKED";

export type VerificationTestMatrixRow = {
  number?: string;
  test?: string;
  expectedBehavior?: string;
  evidence?: string;
  result?: "pending" | "pass" | "issue" | "skipped" | "blocked";
  notes?: string;
};

export type VerificationResultSummary = {
  total?: number;
  passed?: number;
  issues?: number;
  pending?: number;
  skipped?: number;
  blocked?: number;
};

export type VerificationStructuredGapRow = {
  test?: string;
  truth?: string;
  status?: "failed" | "partial" | "blocked" | "none";
  severity?: "blocker" | "major" | "minor" | "cosmetic" | "none";
  reason?: string;
  followUp?: string;
};

export type VerificationRenderArgs = PhaseValidationRenderLookupArgs & {
  artifact: "verification";
  coverageSummary?: string;
  status?: string;
  gateState?: string;
  signOff?: string;
  validationSummary?: string | string[];
  requirementCoverage?: VerificationRenderCoverageRow[];
  evidenceReviewedSummaryPaths?: string[];
  evidenceMetadata?: string[];
  manualOrDeferredCoverage?: VerificationManualCoverageRow[];
  gapClassification?: VerificationGapClassificationRow[];
  gapsFound?: string[];
  suggestedRepairs?: string[];
  sessionState?: string[];
  checkpoint?: string;
  testMatrix?: VerificationTestMatrixRow[];
  resultSummary?: VerificationResultSummary;
  observedBehavior?: string[];
  unresolvedGaps?: string[];
  structuredGaps?: VerificationStructuredGapRow[];
  followUpFixes?: string[];
  nextSafeAction?: string;
};

export type PhaseVerificationStructuredModel = {
  coverageSummary: string;
  status: "PASS" | "PARTIAL" | "BLOCKED";
  gateState: "PASS" | "PARTIAL" | "BLOCKED";
  signOff: string;
  validationSummary: string | string[];
  requirementCoverage: Array<{
    requirement: string;
    taskOrCheck: string;
    evidence: string;
    coverageState: VerificationCoverageState | "covered";
    notes: string;
  }>;
  evidenceReviewedSummaryPaths: string[];
  evidenceMetadata: string[];
  manualOrDeferredCoverage: Array<{
    item: string;
    whyManualOrDeferred: string;
    followUp: string;
    status: "MANUAL" | "DEFERRED" | "NONE";
  }>;
  gapClassification: Array<{
    gapClass:
      | "missing-evidence"
      | "partial-coverage"
      | "manual-only"
      | "deferred-test"
      | "contradiction"
      | "none";
    scope: string;
    evidence: string;
    repair: string;
  }>;
  gapsFound: string[];
  suggestedRepairs: string[];
  sessionState?: string[];
  checkpoint?: string;
  testMatrix?: Array<Required<VerificationTestMatrixRow>>;
  resultSummary?: Required<VerificationResultSummary>;
  observedBehavior?: string[];
  unresolvedGaps?: string[];
  structuredGaps?: Array<Required<VerificationStructuredGapRow>>;
  followUpFixes?: string[];
  nextSafeAction: string;
};

export type PhaseUatStructuredModel = {
  status: "PASS" | "FAIL" | "PARTIAL";
  resumeState: "RESUMED" | "NEW" | "CONTINUED";
  checkpoint: string;
  uatSummary: string[];
  sessionState: string[];
  currentTest: {
    number: string;
    name: string;
    expected: string;
    awaiting: string;
  };
  testMatrix: Array<{
    number: string;
    test: string;
    expectedBehavior: string;
    evidence: string;
    result: "pending" | "pass" | "issue" | "skipped" | "blocked";
    notes: string;
  }>;
  resultSummary: {
    total: number;
    passed: number;
    issues: number;
    pending: number;
    skipped: number;
    blocked: number;
  };
  questionsAsked: string[];
  observedBehavior: string[];
  unresolvedGaps: string[];
  structuredGaps: Array<{
    test: string;
    truth: string;
    status: "failed" | "partial" | "blocked" | "none";
    severity: "blocker" | "major" | "minor" | "cosmetic" | "none";
    reason: string;
    followUp: string;
  }>;
  followUpFixes: string[];
  nextSafeAction: string;
};

type UatRenderCurrentTest = {
  number?: string;
  name?: string;
  expected?: string;
  awaiting?: string;
};

type UatRenderTestMatrixRow = {
  number?: string;
  test?: string;
  expectedBehavior?: string;
  evidence?: string;
  result?: string;
  notes?: string;
};

type UatRenderResultSummary = {
  total?: number;
  passed?: number;
  issues?: number;
  pending?: number;
  skipped?: number;
  blocked?: number;
};

type UatRenderStructuredGapRow = {
  test?: string;
  truth?: string;
  status?: string;
  severity?: string;
  reason?: string;
  followUp?: string;
};

export type UatRenderArgs = PhaseValidationRenderLookupArgs & {
  artifact: "uat";
  status?: string;
  resumeState?: string;
  checkpoint?: string;
  uatSummary?: string[];
  sessionState?: string[];
  currentTest?: UatRenderCurrentTest;
  testMatrix?: UatRenderTestMatrixRow[];
  resultSummary?: UatRenderResultSummary;
  questionsAsked?: string[];
  observedBehavior?: string[];
  unresolvedGaps?: string[];
  structuredGaps?: UatRenderStructuredGapRow[];
  followUpFixes?: string[];
  nextSafeAction?: string;
};

export type PhaseValidationRenderArgs = VerificationRenderArgs | UatRenderArgs;

function normalizeRenderList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined ? [] : [value];
}

function normalizeVerificationCoverageState(value: unknown): string {
  const normalized = String(value ?? "").trim();

  return normalized.toLowerCase() === "covered" ? "COVERED" : normalized;
}

export function normalizeVerificationStructuredModel(
  model: PhaseVerificationStructuredModel
): PhaseVerificationStructuredModel {
  return {
    ...model,
    validationSummary: normalizeRenderList(model.validationSummary),
    requirementCoverage: model.requirementCoverage.map((row) => ({
      ...row,
      coverageState: normalizeVerificationCoverageState(row.coverageState) as
        | VerificationCoverageState
        | "covered"
    }))
  };
}

function renderVerificationOptionalSections(args: VerificationRenderArgs): string {
  const sections: string[] = [];

  if ((args.sessionState ?? []).length > 0) {
    sections.push(`## Session State\n\n${renderBulletList(args.sessionState)}`);
  }

  if (args.checkpoint?.trim()) {
    sections.push(`## Checkpoint\n\n- ${args.checkpoint.trim()}`);
  }

  if ((args.testMatrix ?? []).length > 0) {
    const testRows = (args.testMatrix ?? [])
      .map((row, index) =>
        `| ${markdownCell(row.number ?? String(index + 1))} | ${markdownCell(row.test)} | ${markdownCell(row.expectedBehavior)} | ${markdownCell(row.evidence)} | ${markdownCell(row.result)} | ${markdownCell(row.notes)} |`
      )
      .join("\n");

    sections.push(`## Validation Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
${testRows}`);
  }

  if (args.resultSummary) {
    sections.push(`## Result Summary

- Total: ${args.resultSummary.total ?? ""}
- Passed: ${args.resultSummary.passed ?? ""}
- Issues: ${args.resultSummary.issues ?? ""}
- Pending: ${args.resultSummary.pending ?? ""}
- Skipped: ${args.resultSummary.skipped ?? ""}
- Blocked: ${args.resultSummary.blocked ?? ""}`);
  }

  if ((args.observedBehavior ?? []).length > 0) {
    sections.push(`## Observed Behavior\n\n${renderBulletList(args.observedBehavior)}`);
  }

  if ((args.unresolvedGaps ?? []).length > 0) {
    sections.push(`## Unresolved Gaps\n\n${renderBulletList(args.unresolvedGaps)}`);
  }

  if ((args.structuredGaps ?? []).length > 0) {
    const structuredGapRows = (args.structuredGaps ?? [])
      .map((row) =>
        `| ${markdownCell(row.test)} | ${markdownCell(row.truth)} | ${markdownCell(row.status)} | ${markdownCell(row.severity)} | ${markdownCell(row.reason)} | ${markdownCell(row.followUp)} |`
      )
      .join("\n");

    sections.push(`## Structured Gaps

| Test | Truth | Status | Severity | Reason | Follow-Up |
|------|-------|--------|----------|--------|-----------|
${structuredGapRows}`);
  }

  if ((args.followUpFixes ?? []).length > 0) {
    sections.push(`## Follow-Up Fixes\n\n${renderBulletList(args.followUpFixes)}`);
  }

  return sections.length > 0 ? `\n\n${sections.join("\n\n")}` : "";
}

export function renderVerificationContent(
  args: VerificationRenderArgs,
  resolved: PhaseValidationRenderResolvedPhase,
  summaryPaths: string[],
  readinessByGate: Record<string, string>
): string {
  const evidenceReviewedSummaryPaths = args.evidenceReviewedSummaryPaths ?? summaryPaths;
  const requirementRows = (args.requirementCoverage ?? [])
    .map(
      (row) =>
        `| ${markdownCell(row.requirement)} | ${markdownCell(row.taskOrCheck)} | ${markdownCell(row.evidence)} | ${markdownCell(normalizeVerificationCoverageState(row.coverageState))} | ${markdownCell(row.notes)} |`
    )
    .join("\n");
  const manualRows =
    (args.manualOrDeferredCoverage ?? []).length > 0
      ? (args.manualOrDeferredCoverage ?? [])
          .map(
            (row) =>
              `| ${markdownCell(row.item)} | ${markdownCell(row.whyManualOrDeferred)} | ${markdownCell(row.followUp)} | ${markdownCell(row.status)} |`
          )
          .join("\n")
      : "| none | none | none | NONE |";
  const gapRows =
    (args.gapClassification ?? []).length > 0
      ? (args.gapClassification ?? [])
          .map(
            (row) =>
              `| ${markdownCell(row.gapClass)} | ${markdownCell(row.scope)} | ${markdownCell(row.evidence)} | ${markdownCell(row.repair)} |`
          )
          .join("\n")
      : "| none | none | none | none |";

  return normalizeTextContent(`# Phase ${resolved.phasePrefix}: ${resolved.phaseName} - Verification

**Coverage:** ${args.coverageSummary ?? ""}
**Gate State:** ${args.gateState ?? ""}
**Sign-off:** ${args.signOff ?? ""}

## Validation Summary

${renderBulletList(normalizeRenderList(args.validationSummary))}

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
${requirementRows}

## Evidence Reviewed

${renderBulletList(evidenceReviewedSummaryPaths)}

## Test Infrastructure / Evidence Metadata

${renderBulletList(args.evidenceMetadata)}

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
${manualRows}

## Gate State

- Gate: ${args.gateState ?? ""}
- Sign-off: ${args.signOff ?? ""}
- Readiness: ${readinessByGate[args.gateState ?? ""] ?? ""}

## Gap Classification

| Gap class | Scope | Evidence | Repair |
|-----------|-------|----------|--------|
${gapRows}

## Gaps Found

${renderBulletList(args.gapsFound)}

## Suggested Repairs

${renderBulletList(args.suggestedRepairs)}${renderVerificationOptionalSections(args)}

## Next Safe Action

- ${args.nextSafeAction ?? ""}
`);
}

export function renderUatContent(
  args: UatRenderArgs,
  resolved: PhaseValidationRenderResolvedPhase
): string {
  const currentTest = args.currentTest ?? {};
  const resultSummary = args.resultSummary ?? {};
  const testRows =
    (args.testMatrix ?? []).length > 0
      ? (args.testMatrix ?? [])
          .map(
            (row, index) =>
              `| ${markdownCell(row.number ?? String(index + 1))} | ${markdownCell(row.test)} | ${markdownCell(row.expectedBehavior)} | ${markdownCell(row.evidence)} | ${markdownCell(row.result)} | ${markdownCell(row.notes)} |`
          )
          .join("\n")
      : "";
  const structuredGapRows =
    (args.structuredGaps ?? []).length > 0
      ? (args.structuredGaps ?? [])
          .map(
            (row) =>
              `| ${markdownCell(row.test)} | ${markdownCell(row.truth)} | ${markdownCell(row.status)} | ${markdownCell(row.severity)} | ${markdownCell(row.reason)} | ${markdownCell(row.followUp)} |`
          )
          .join("\n")
      : "| none | none | none | none | none | none |";

  return normalizeTextContent(`# Phase ${resolved.phasePrefix}: ${resolved.phaseName} - UAT

**Status:** ${args.status ?? ""}
**Resume State:** ${args.resumeState ?? ""}
**Checkpoint:** ${args.checkpoint ?? ""}

## UAT Summary

${renderBulletList(args.uatSummary)}

## Session State

${renderBulletList(args.sessionState)}

## Current Test

- Number: ${currentTest.number ?? ""}
- Name: ${currentTest.name ?? ""}
- Expected: ${currentTest.expected ?? ""}
- Awaiting: ${currentTest.awaiting ?? ""}

## Test Matrix

| # | Test | Expected Behavior | Evidence | Result | Notes |
|---|------|-------------------|----------|--------|-------|
${testRows}

## Result Summary

- Total: ${resultSummary.total ?? ""}
- Passed: ${resultSummary.passed ?? ""}
- Issues: ${resultSummary.issues ?? ""}
- Pending: ${resultSummary.pending ?? ""}
- Skipped: ${resultSummary.skipped ?? ""}
- Blocked: ${resultSummary.blocked ?? ""}

## Questions Asked

${renderBulletList(args.questionsAsked)}

## Observed Behavior

${renderBulletList(args.observedBehavior)}

## Unresolved Gaps

${renderBulletList(args.unresolvedGaps)}

## Structured Gaps

| Test | Truth | Status | Severity | Reason | Follow-Up |
|------|-------|--------|----------|--------|-----------|
${structuredGapRows}

## Follow-Up Fixes

${renderBulletList(args.followUpFixes)}

## Next Safe Action

- ${args.nextSafeAction ?? ""}
`);
}

export function verificationPayloadIssues(args: VerificationRenderArgs): string[] {
  const issues: string[] = [];

  if (!args.coverageSummary?.trim()) {
    issues.push("Verification render payload must include coverageSummary.");
  }
  if (!args.gateState?.trim()) {
    issues.push("Verification render payload must include gateState.");
  }
  if (!args.signOff?.trim()) {
    issues.push("Verification render payload must include signOff.");
  }
  if (normalizeRenderList(args.validationSummary).filter((item) => item.trim().length > 0).length === 0) {
    issues.push("Verification render payload must include validationSummary.");
  }
  if ((args.requirementCoverage ?? []).length === 0) {
    issues.push("Verification render payload must include at least one requirementCoverage row.");
  }
  if ((args.evidenceMetadata ?? []).filter((item) => item.trim().length > 0).length === 0) {
    issues.push("Verification render payload must include evidenceMetadata.");
  }
  if (!args.nextSafeAction?.trim()) {
    issues.push("Verification render payload must include nextSafeAction.");
  }

  return issues;
}

export function uatPayloadIssues(args: UatRenderArgs): string[] {
  const issues: string[] = [];

  if (!args.status?.trim()) {
    issues.push("UAT render payload must include status.");
  }
  if (!args.resumeState?.trim()) {
    issues.push("UAT render payload must include resumeState.");
  }
  if (!args.checkpoint?.trim()) {
    issues.push("UAT render payload must include checkpoint.");
  }
  if (args.status === "PASS" && args.checkpoint?.trim().toLowerCase() !== "none") {
    issues.push("UAT render payload must use checkpoint none when status is PASS.");
  }
  if (
    (args.status === "FAIL" || args.status === "PARTIAL") &&
    args.checkpoint?.trim().toLowerCase() === "none"
  ) {
    issues.push("UAT render payload must keep a non-empty checkpoint label until status is PASS.");
  }
  if ((args.uatSummary ?? []).filter((item) => item.trim().length > 0).length === 0) {
    issues.push("UAT render payload must include uatSummary.");
  }
  if ((args.testMatrix ?? []).length === 0) {
    issues.push("UAT render payload must include at least one testMatrix row.");
  }
  if (!args.resultSummary) {
    issues.push("UAT render payload must include resultSummary.");
  }
  if (!args.nextSafeAction?.trim()) {
    issues.push("UAT render payload must include nextSafeAction.");
  }

  return issues;
}
