import { asJsonObject } from "./phase-json-helpers.js";
import { markdownCell, renderBulletList } from "./phase-markdown.js";

type PhaseSummaryRenderResolvedPhase = {
  phasePrefix: string;
  phaseName: string;
};

type PhaseSummaryStatus = "COMPLETED" | "PARTIAL" | "BLOCKED";
type PhaseSummaryReadiness = "ready-for-validation" | "not-ready-for-validation" | "blocked";
type PhaseSummaryCompletionState = "complete" | "pending" | "blocked";
type PhaseSummaryVerificationResult = "pass" | "fail" | "blocked" | "not-run";
type PhaseSummaryManualStatus = "MANUAL" | "DEFERRED" | "NONE";
type PhaseSummaryGapStatus = "OPEN" | "BLOCKED" | "NONE";
type PhaseSummaryEvidenceKind = "artifact" | "repo-path" | "command" | "test" | "other";

export type PhaseSummaryStructuredModel = {
  status: PhaseSummaryStatus;
  readiness: PhaseSummaryReadiness;
  completionState: PhaseSummaryCompletionState;
  outcome: string[];
  changesMade: string[];
  targetedVerification: Array<{
    check: string;
    command: string;
    result: PhaseSummaryVerificationResult;
    evidence: string;
    notes: string;
  }>;
  dependencyPlans: Array<{
    planId: string;
    path: string;
    status: "satisfied";
    evidence: string;
  }>;
  manualOrDeferredWork: Array<{
    item: string;
    reason: string;
    followUp: string;
    status: PhaseSummaryManualStatus;
  }>;
  gapRoutes: Array<{
    gap: string;
    evidence: string;
    repair: string;
    status: PhaseSummaryGapStatus;
  }>;
  followUps: string[];
  evidence: Array<{
    kind: PhaseSummaryEvidenceKind;
    source: string;
    summary: string;
  }>;
  nextSafeAction: string;
};

function normalizeModelStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return null;
  }

  return value.map((item) => item.trim());
}

export function normalizePhaseSummaryModel(
  model: Record<string, unknown>
): PhaseSummaryStructuredModel | null {
  const outcome = normalizeModelStringArray(model.outcome);
  const changesMade = normalizeModelStringArray(model.changesMade);
  const followUps = normalizeModelStringArray(model.followUps);
  const targetedVerification = Array.isArray(model.targetedVerification)
    ? model.targetedVerification
    : null;
  const dependencyPlans = Array.isArray(model.dependencyPlans) ? model.dependencyPlans : null;
  const manualOrDeferredWork = Array.isArray(model.manualOrDeferredWork)
    ? model.manualOrDeferredWork
    : null;
  const gapRoutes = Array.isArray(model.gapRoutes) ? model.gapRoutes : null;
  const evidence = Array.isArray(model.evidence) ? model.evidence : null;

  if (
    typeof model.status !== "string" ||
    typeof model.readiness !== "string" ||
    typeof model.completionState !== "string" ||
    outcome === null ||
    changesMade === null ||
    targetedVerification === null ||
    dependencyPlans === null ||
    manualOrDeferredWork === null ||
    gapRoutes === null ||
    followUps === null ||
    evidence === null ||
    typeof model.nextSafeAction !== "string"
  ) {
    return null;
  }

  const normalizedVerification = targetedVerification.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.check === "string" &&
      typeof rowObject.command === "string" &&
      typeof rowObject.result === "string" &&
      typeof rowObject.evidence === "string" &&
      typeof rowObject.notes === "string"
      ? {
          check: rowObject.check.trim(),
          command: rowObject.command.trim(),
          result: rowObject.result as PhaseSummaryVerificationResult,
          evidence: rowObject.evidence.trim(),
          notes: rowObject.notes.trim()
        }
      : null;
  });
  const normalizedDependencies = dependencyPlans.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.planId === "string" &&
      typeof rowObject.path === "string" &&
      typeof rowObject.status === "string" &&
      typeof rowObject.evidence === "string"
      ? {
          planId: rowObject.planId.trim(),
          path: rowObject.path.trim(),
          status: rowObject.status as "satisfied",
          evidence: rowObject.evidence.trim()
        }
      : null;
  });
  const normalizedManual = manualOrDeferredWork.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.item === "string" &&
      typeof rowObject.reason === "string" &&
      typeof rowObject.followUp === "string" &&
      typeof rowObject.status === "string"
      ? {
          item: rowObject.item.trim(),
          reason: rowObject.reason.trim(),
          followUp: rowObject.followUp.trim(),
          status: rowObject.status as PhaseSummaryManualStatus
        }
      : null;
  });
  const normalizedGaps = gapRoutes.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.gap === "string" &&
      typeof rowObject.evidence === "string" &&
      typeof rowObject.repair === "string" &&
      typeof rowObject.status === "string"
      ? {
          gap: rowObject.gap.trim(),
          evidence: rowObject.evidence.trim(),
          repair: rowObject.repair.trim(),
          status: rowObject.status as PhaseSummaryGapStatus
        }
      : null;
  });
  const normalizedEvidence = evidence.map((row) => {
    const rowObject = asJsonObject(row);

    return rowObject &&
      typeof rowObject.kind === "string" &&
      typeof rowObject.source === "string" &&
      typeof rowObject.summary === "string"
      ? {
          kind: rowObject.kind as PhaseSummaryEvidenceKind,
          source: rowObject.source.trim(),
          summary: rowObject.summary.trim()
        }
      : null;
  });

  if (
    normalizedVerification.some((row) => row === null) ||
    normalizedDependencies.some((row) => row === null) ||
    normalizedManual.some((row) => row === null) ||
    normalizedGaps.some((row) => row === null) ||
    normalizedEvidence.some((row) => row === null)
  ) {
    return null;
  }

  return {
    status: model.status as PhaseSummaryStatus,
    readiness: model.readiness as PhaseSummaryReadiness,
    completionState: model.completionState as PhaseSummaryCompletionState,
    outcome,
    changesMade,
    targetedVerification: normalizedVerification as PhaseSummaryStructuredModel["targetedVerification"],
    dependencyPlans: normalizedDependencies as PhaseSummaryStructuredModel["dependencyPlans"],
    manualOrDeferredWork: normalizedManual as PhaseSummaryStructuredModel["manualOrDeferredWork"],
    gapRoutes: normalizedGaps as PhaseSummaryStructuredModel["gapRoutes"],
    followUps,
    evidence: normalizedEvidence as PhaseSummaryStructuredModel["evidence"],
    nextSafeAction: model.nextSafeAction.trim()
  };
}

function renderSummaryTable(headers: string[], rows: string[][]): string {
  const separator = headers.map(() => "---");
  const renderedRows = rows.length > 0 ? rows : [headers.map(() => "none")];

  return [headers, separator, ...renderedRows]
    .map((row) => `| ${row.map(markdownCell).join(" | ")} |`)
    .join("\n");
}

export function renderPhaseSummaryModelContent(args: {
  model: PhaseSummaryStructuredModel;
  resolved: PhaseSummaryRenderResolvedPhase;
  planId: string;
  linkedPlanPath: string;
  summaryPath: string;
}): string {
  const dependencyRows =
    args.model.dependencyPlans.length > 0
      ? args.model.dependencyPlans.map((row) => [
          `${row.planId} (${row.path})`,
          row.status,
          row.evidence
        ])
      : [["none", "none", "none"]];
  const evidenceRows = [
    ["artifact", args.linkedPlanPath, "Linked plan path supplied by MCP."],
    ["artifact", args.summaryPath, "Canonical summary path supplied by MCP."],
    ...args.model.evidence.map((row) => [row.kind, row.source, row.summary])
  ];

  return `# Phase ${args.resolved.phasePrefix}: ${args.resolved.phaseName} - Summary ${args.planId}

**Plan:** \`${args.linkedPlanPath}\`
**Status:** ${args.model.status}
**Readiness:** ${args.model.readiness}
**Completion State:** ${args.model.completionState}
**Next Safe Action:** ${args.model.nextSafeAction}

## Outcome

${renderBulletList(args.model.outcome)}

## Changes Made

${renderBulletList(args.model.changesMade)}

## Verification

${renderSummaryTable(
  ["Check", "Command", "Result", "Evidence", "Notes"],
  args.model.targetedVerification.map((row) => [
    row.check,
    row.command,
    row.result,
    row.evidence,
    row.notes
  ])
)}

## Dependency Plans

${renderSummaryTable(["Plan", "Status", "Evidence"], dependencyRows)}

## Manual / Deferred Work

${renderSummaryTable(
  ["Item", "Reason", "Follow-Up", "Status"],
  args.model.manualOrDeferredWork.map((row) => [
    row.item,
    row.reason,
    row.followUp,
    row.status
  ])
)}

## Gap / Repair Routes

${renderSummaryTable(
  ["Gap", "Evidence", "Repair", "Status"],
  args.model.gapRoutes.map((row) => [row.gap, row.evidence, row.repair, row.status])
)}

## Follow-Ups

${renderBulletList(args.model.followUps)}

## Evidence

${renderSummaryTable(["Kind", "Source", "Summary"], evidenceRows)}
`;
}
