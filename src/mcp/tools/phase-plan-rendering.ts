import {
  markdownCell,
  normalizeTextContent,
  renderBulletList
} from "./phase-markdown.js";
import { normalizePlanId } from "./phase-plan-identifiers.js";
import { uniquePreservingOrder } from "./phase-collection-helpers.js";

type PhasePlanRenderResolvedPhase = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
};

export type PhasePlanStructuredModel = {
  title: string;
  wave: number;
  status: "planned";
  objective: string;
  gapClosure?: boolean;
  dependsOn: string[];
  requirements: string[];
  filesModified: string[];
  readFirst: string[];
  autonomous: boolean;
  goal: string;
  scope: string[];
  tasks: Array<{
    id: string;
    title: string;
    readFirst: string[];
    action: string[];
    acceptanceCriteria: string[];
    requirements: string[];
    filesModified: string[];
  }>;
  verification: Array<{
    item: string;
    method: "test" | "grep" | "command" | "file-read" | "artifact-validation";
    evidence: string;
  }>;
  mustHaves: string[];
  requirementCoverage: Array<{
    requirement: string;
    status: "covered" | "deferred" | "irrelevant";
    coveredByTasks: string[];
    evidence: string;
    rationale: string;
  }>;
  evidenceCoverage: Array<{
    artifact: string;
    status: "used" | "deferred" | "irrelevant" | "unavailable";
    rationale: string;
  }>;
  fileSurfaceCoverage: Array<{
    surface: string;
    coveredByTasks: string[];
    verification: string;
    rationale: string;
  }>;
  unknownsAndDeferrals: Array<{
    item: string;
    disposition: "unknown" | "deferred" | "blocked" | "none";
    rationale: string;
    followUp: string;
  }>;
};

function quoteYamlScalar(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function renderYamlList(items: string[]): string {
  return items.map((item) => `  - ${quoteYamlScalar(item)}`).join("\n");
}

function renderMarkdownTableRows(rows: string[][]): string {
  return rows.map((row) => `| ${row.map((cell) => markdownCell(cell)).join(" | ")} |`).join("\n");
}

export function renderPhasePlanModelContent(
  model: PhasePlanStructuredModel,
  resolved: PhasePlanRenderResolvedPhase,
  planId: string
): string {
  const acceptanceCriteria = uniquePreservingOrder(
    model.tasks.flatMap((task) => task.acceptanceCriteria)
  );
  const dependsOn = model.dependsOn.map((dependency) => normalizePlanId(dependency));
  const gapClosureFrontmatter = model.gapClosure === true ? "gap_closure: true\n" : "";
  const taskSections = model.tasks
    .map(
      (task, index) => `### Task ${index + 1}: ${task.id} - ${task.title}

#### Read First

${renderBulletList(task.readFirst)}

#### Action

${renderBulletList(task.action)}

#### Acceptance Criteria

${renderBulletList(task.acceptanceCriteria)}`
    )
    .join("\n\n");
  const verificationItems = model.verification.map(
    (item) => `${item.item} (${item.method}): ${item.evidence}`
  );
  const requirementRows = renderMarkdownTableRows(
    model.requirementCoverage.map((row) => [
      row.requirement,
      row.status,
      row.coveredByTasks.join(", ") || "none",
      row.evidence,
      row.rationale
    ])
  );
  const evidenceRows = renderMarkdownTableRows(
    model.evidenceCoverage.map((row) => [row.artifact, row.status, row.rationale])
  );
  const fileRows = renderMarkdownTableRows(
    model.fileSurfaceCoverage.map((row) => [
      row.surface,
      row.coveredByTasks.join(", "),
      row.verification,
      row.rationale
    ])
  );
  const unknownRows = renderMarkdownTableRows(
    model.unknownsAndDeferrals.map((row) => [
      row.item,
      row.disposition,
      row.rationale,
      row.followUp
    ])
  );

  return normalizeTextContent(`---
phase: ${resolved.phaseNumber}
plan_id: ${quoteYamlScalar(planId)}
title: ${quoteYamlScalar(model.title)}
wave: ${model.wave}
status: ${model.status}
${gapClosureFrontmatter}objective: ${quoteYamlScalar(model.objective)}
depends_on: [${dependsOn.map((dependency) => quoteYamlScalar(dependency)).join(", ")}]
requirements:
${renderYamlList(model.requirements)}
files_modified:
${renderYamlList(model.filesModified)}
read_first:
${renderYamlList(model.readFirst)}
acceptance_criteria:
${renderYamlList(acceptanceCriteria)}
autonomous: ${model.autonomous}
---

# Phase ${resolved.phasePrefix}: ${resolved.phaseName} - Plan ${planId}

## Goal

${model.goal}

## Scope

${renderBulletList(model.scope)}

## Tasks

${taskSections}

## Verification

${renderBulletList(verificationItems)}

## Must Haves

${renderBulletList(model.mustHaves)}

## Requirement Coverage

| Requirement | Status | Covered By Tasks | Evidence | Rationale |
|-------------|--------|------------------|----------|-----------|
${requirementRows}

## Evidence Coverage

| Artifact | Status | Rationale |
|----------|--------|-----------|
${evidenceRows}

## File / Surface Coverage

| Surface | Covered By Tasks | Verification | Rationale |
|---------|------------------|--------------|-----------|
${fileRows}

## Unknowns And Deferrals

| Item | Disposition | Rationale | Follow-Up |
|------|-------------|-----------|-----------|
${unknownRows}
`);
}
