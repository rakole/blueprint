import * as z from "zod/v4";
import type { ValidateFunction } from "ajv";
import { safeJsonParse } from "../../shared/security.js";
import { readArtifactContract } from "../artifact-contracts/index.js";
import type { PhaseArtifactValidationDiagnostic } from "./artifacts.js";
import { asJsonObject, createAjvValidator } from "./phase-json-helpers.js";
import { markdownTableCell } from "./phase-markdown.js";

export const phaseResearchAuthoringSchema = z.fromJSONSchema(
  readArtifactContract("phase.research").modelContract!.jsonSchema as z.core.JSONSchema.JSONSchema,
);

const OPTIONAL_HEADINGS = {
  standardStack: "Standard Stack",
  installationAndSetup: "Installation And Setup",
  alternativesConsidered: "Alternatives Considered",
  architecturePatterns: "Architecture Patterns",
  dontHandRoll: "Don't Hand-Roll",
  antiPatterns: "Anti-Patterns",
  stateOfTheArt: "State Of The Art",
  commonPitfalls: "Common Pitfalls",
  codeExamples: "Code Examples",
} as const;

export type PhaseResearchStructuredModel = {
  summary: string;
  findings: Array<{
    id: string;
    finding: string;
    sourceIds: string[];
    confidence: "LOW" | "MEDIUM" | "HIGH";
    requirementIds: string[];
    status: "supported" | "inferred" | "unsupported";
  }>;
  recommendations: Array<{
    id: string;
    recommendation: string;
    findingIds: string[];
    affectedSurfaces: string[];
    verification: string[];
    requirementIds: string[];
    status: "ready" | "blocked";
  }>;
  openQuestions: Array<{ question: string; blocking: boolean }>;
  sources: Array<{
    id: string;
    lane: "repo" | "external" | "supplied";
    reference: string;
    title?: string;
    accessed?: string;
    excerpt?: string;
    limitations?: string;
  }>;
  sections?: Partial<Record<keyof typeof OPTIONAL_HEADINGS, string | string[]>>;
};

export type PhaseResearchModelValidation = {
  valid: boolean;
  issues: string[];
  warnings: string[];
  diagnostics: PhaseArtifactValidationDiagnostic[];
};

export type PhaseResearchModelValidationContext = {
  knownRequirementIds?: readonly string[];
  requiredRequirementIds?: readonly string[];
};

let researchModelValidator: ValidateFunction | undefined;

/** Validate readiness without throwing or discarding a schema-valid candidate. */
export function validatePhaseResearchModelInput(
  raw: unknown,
  context: PhaseResearchModelValidationContext = {},
): { model: PhaseResearchStructuredModel | null; validation: PhaseResearchModelValidation } {
  const validation: PhaseResearchModelValidation = { valid: true, issues: [], warnings: [], diagnostics: [] };
  const issue = (path: string, code: string, message: string, repair: string, warning = false): void => {
    (warning ? validation.warnings : validation.issues).push(message);
    validation.diagnostics.push({
      path, code, message, repair, severity: warning ? "warning" : "error",
      retryable: true, nextTool: "blueprint_research_submit",
    });
    validation.valid = validation.issues.length === 0;
  };
  let object: Record<string, unknown> | null;
  try {
    object = asJsonObject(typeof raw === "string"
      ? safeJsonParse(raw, { label: "Research candidate", maxBytes: 1024 * 1024 })
      : structuredClone(raw));
  } catch (error) {
    issue("model", "schema.json", error instanceof Error ? error.message : "Research candidate is not JSON.",
      "Correct the saved candidate's JSON syntax and resubmit that revision.");
    return { model: null, validation };
  }
  if (!object) {
    issue("model", "schema.type", "Research candidate must be a JSON object.",
      "Supply the structured research core from phase.research.modelContract.");
    return { model: null, validation };
  }
  if (object.openQuestions === undefined) object.openQuestions = [];
  if (object.sections === undefined) object.sections = {};
  const validate = researchModelValidator ??= createAjvValidator().compile(
    readArtifactContract("phase.research").modelContract!.jsonSchema,
  );
  if (!validate(object)) {
    for (const error of validate.errors ?? []) {
      const property = error.params.missingProperty ?? error.params.additionalProperty;
      const fieldPath = `model${error.instancePath.replace(/\//g, ".")}${typeof property === "string" ? `.${property}` : ""}`;
      issue(fieldPath, `schema.${error.keyword}`, `Research candidate ${fieldPath} ${error.message ?? error.keyword}.`,
        `Correct only ${fieldPath} using phase.research.modelContract; retain the remaining saved candidate.`);
    }
    return { model: null, validation };
  }
  const model = object as unknown as PhaseResearchStructuredModel;
  const ids = new Set<string>();
  for (const field of ["sources", "findings", "recommendations"] as const) {
    model[field].forEach((row, index) => {
      if (ids.has(row.id)) issue(`model.${field}.${index}.id`, "research.duplicate_id",
        `Research id ${row.id} is duplicated.`, "Give each source, finding and recommendation a unique id and update its references.");
      ids.add(row.id);
    });
  }
  const sources = new Map(model.sources.map((source) => [source.id, source]));
  const findings = new Map(model.findings.map((finding) => [finding.id, finding]));
  const known = context.knownRequirementIds === undefined ? null : new Set(context.knownRequirementIds);
  const covered = new Set<string>();
  const checkRequirements = (values: string[], fieldPath: string, providesCoverage: boolean): void => {
    for (const id of values) {
      if (providesCoverage) covered.add(id);
      if (known && !known.has(id)) issue(fieldPath, "research.unknown_requirement",
        `Research references requirement ${id}, which is absent from the prepared input basis.`,
        "Use an existing prepared requirement id or prepare again after an authorized requirements change.");
    }
  };
  model.sources.forEach((source, index) => {
    if (source.lane === "external" && !isExternalReference(source.reference)) issue(
      `model.sources.${index}.reference`, "research.external_reference_invalid",
      `External source ${source.id} needs an HTTP(S) URL or DOI.`,
      "Provide the observed external source URL or DOI; label user-supplied material with the supplied lane.",
    );
    if (source.lane === "external" && !source.accessed) issue(
      `model.sources.${index}.accessed`, "research.external_access_date_missing",
      `External source ${source.id} has no recorded access date.`,
      "Record when this source was accessed if known; do not invent a date.", true,
    );
  });
  model.findings.forEach((finding, index) => {
    const field = `model.findings.${index}`;
    for (const id of finding.sourceIds) {
      if (!sources.has(id)) issue(`${field}.sourceIds`, "research.source_reference_missing",
        `Finding ${finding.id} references missing source ${id}.`, "Add the observed source or correct this finding's sourceIds.");
    }
    if (finding.status !== "unsupported" && finding.sourceIds.length === 0) issue(
      `${field}.sourceIds`, "research.finding_support_missing", `Finding ${finding.id} has no source support.`,
      "Link its observed evidence or mark the finding unsupported until evidence is available.",
    );
    if (finding.confidence === "HIGH" && (finding.status !== "supported" || finding.sourceIds.length === 0)) issue(
      `${field}.confidence`, "research.high_confidence_unsupported", `Finding ${finding.id} cannot claim HIGH confidence without supported evidence.`,
      "Supply source support and supported status, or lower confidence to reflect uncertainty.",
    );
    if (finding.status === "unsupported") issue(`${field}.status`, "research.unsupported_finding",
      `Finding ${finding.id} is explicitly unsupported.`, "Keep it separate from ready recommendations until investigated.", true);
    checkRequirements(finding.requirementIds, `${field}.requirementIds`, finding.status !== "unsupported" && finding.sourceIds.length > 0);
  });
  model.recommendations.forEach((recommendation, index) => {
    const field = `model.recommendations.${index}`;
    for (const id of recommendation.findingIds) {
      if (!findings.has(id)) issue(`${field}.findingIds`, "research.finding_reference_missing",
        `Recommendation ${recommendation.id} references missing finding ${id}.`, "Add the finding or correct this recommendation's findingIds.");
    }
    if (recommendation.status === "blocked") issue(`${field}.status`, "research.recommendation_blocked",
      `Recommendation ${recommendation.id} is blocked.`, "Resolve the implementation blocker and revise this recommendation before publication.");
    if (recommendation.status === "ready") {
      const unsupported = recommendation.findingIds.length === 0 || recommendation.findingIds.some((id) => {
        const finding = findings.get(id);
        return !finding || finding.status === "unsupported" || finding.sourceIds.length === 0 || finding.sourceIds.some((source) => !sources.has(source));
      });
      if (unsupported) issue(`${field}.findingIds`, "research.recommendation_unsupported",
        `Ready recommendation ${recommendation.id} lacks supported findings.`, "Supply evidence-linked findings or mark this recommendation blocked.");
      if (recommendation.affectedSurfaces.length === 0) issue(`${field}.affectedSurfaces`, "research.affected_surfaces_missing",
        `Ready recommendation ${recommendation.id} does not identify affected surfaces.`, "Name the files, modules, contracts, product surfaces or interfaces affected.");
      if (recommendation.verification.length === 0) issue(`${field}.verification`, "research.verification_missing",
        `Ready recommendation ${recommendation.id} lacks a verification approach.`, "Describe a meaningful check of the resulting behavior.");
    }
    checkRequirements(recommendation.requirementIds, `${field}.requirementIds`, recommendation.status === "ready");
  });
  model.openQuestions.forEach((question, index) => {
    if (question.blocking) issue(`model.openQuestions.${index}.blocking`, "research.question_blocking",
      `Research has a blocking question: ${question.question}`, "Resolve this question or explain why it no longer blocks planning and revise its status.");
  });
  for (const id of context.requiredRequirementIds ?? []) {
    if (!covered.has(id)) issue("model.findings", "research.requirement_uncovered",
      `Required research coverage for ${id} is missing.`, "Tie an evidence-backed finding or recommendation to this prepared requirement.");
  }
  return { model, validation };
}

function isExternalReference(reference: string): boolean {
  if (/^(?:doi:\s*)?10\.\d{4,9}\/\S+$/i.test(reference)) return true;
  try {
    const url = new URL(reference);
    return ["http:", "https:"].includes(url.protocol) && url.hostname.length > 0;
  } catch { return false; }
}

function table(headers: string[], rows: string[][]): string {
  return [headers, headers.map(() => "---"), ...rows]
    .map((row) => `| ${row.map(markdownTableCell).join(" | ")} |`).join("\n");
}

/** Preserve code examples while preventing authored prose from replacing canonical sections. */
function prose(value: string): string {
  let fence: { marker: string; length: number } | null = null;
  const lines = value.replace(/\r\n?/g, "\n").trim().split("\n").map((line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence.marker && marker[1].length >= fence.length && marker[2].trim() === "") fence = null;
      return line;
    }
    if (marker && !(marker[1][0] === "`" && marker[2].includes("`"))) {
      fence = { marker: marker[1][0], length: marker[1].length };
      return line;
    }
    return line.replace(/^( {0,3})#{1,2}(?=\s)/, "$1###");
  });
  // An unfinished example must not swallow all subsequent runtime-owned headings.
  if (fence) {
    const unclosed = fence as { marker: string; length: number };
    lines.push(unclosed.marker.repeat(unclosed.length));
  }
  return lines.join("\n");
}

function sectionProse(value: string | string[] | undefined): string {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) return "No section-specific detail was supplied in this research.";
  return (Array.isArray(value) ? value : [value]).map(prose).join("\n\n");
}

function bullets(values: string[] | undefined, fallback: string): string {
  return values?.length ? values.map((value) => `- ${prose(value).replace(/\n/g, "\n  ")}`).join("\n") : fallback;
}

export function renderPhaseResearchModelContent(args: {
  resolved: { phasePrefix: string; phaseName: string };
  model: PhaseResearchStructuredModel;
  researchedAt?: string;
  requirements?: Array<{ id: string; description: string }>;
  lockedDecisions?: string[];
  userConstraints?: string[];
}): string {
  const { model } = args;
  const sourceIdsForFinding = new Map(model.findings.map((finding) => [finding.id, finding.sourceIds]));
  const confidence = model.findings.some((finding) => finding.confidence === "LOW" || finding.status === "unsupported") ? "LOW"
    : model.findings.every((finding) => finding.confidence === "HIGH" && finding.status === "supported") ? "HIGH" : "MEDIUM";
  const requirementIds = [...new Set([...model.findings, ...model.recommendations].flatMap((row) => row.requirementIds))];
  const requirements = args.requirements ?? requirementIds.map((id) => ({ id, description: "Requirement referenced by the research; see prepared phase evidence for its definition." }));
  const requirementRows = requirements.map((requirement) => [requirement.id, requirement.description,
    [...model.findings, ...model.recommendations].filter((row) => row.requirementIds.includes(requirement.id)).map((row) => row.id).join(", ") || "No specific research finding supplied."]);
  if (requirementRows.length === 0) requirementRows.push(["Phase scope", "No numbered requirement grounding was supplied to the renderer.", "See the research summary and prepared phase context."]);
  const optional = (key: keyof typeof OPTIONAL_HEADINGS): string => `## ${OPTIONAL_HEADINGS[key]}\n\n${sectionProse(model.sections?.[key])}`;
  const sections = [
    `# Phase ${args.resolved.phasePrefix.replace(/[\r\n]/g, " ")}: ${args.resolved.phaseName.replace(/[\r\n]/g, " ")} - Research\n\n**Researched:** ${args.researchedAt ?? new Date().toISOString().slice(0, 10)}\n**Confidence:** ${confidence}`,
    `## Phase Requirements\n\n${table(["ID", "Description", "Research Support"], requirementRows)}`,
    `## Summary\n\n${prose(model.summary)}`,
    `## Locked Decisions From Context\n\n${bullets(args.lockedDecisions, "No locked-decision grounding was supplied to the renderer.")}`,
    `## User Constraints\n\n${bullets(args.userConstraints, "No user-constraint grounding was supplied to the renderer.")}`,
    ...Object.keys(OPTIONAL_HEADINGS).filter((key) => key !== "codeExamples").map((key) => optional(key as keyof typeof OPTIONAL_HEADINGS)),
    `## Open Questions\n\n${model.openQuestions.length === 0 ? "- none" : model.openQuestions.map((question) => `- ${question.blocking ? "Blocking" : "Nonblocking"}: ${prose(question.question).replace(/\n/g, "\n  ")}`).join("\n")}`,
    `## Confidence Breakdown\n\n${table(["Finding ID", "Finding", "Support Status", "Confidence", "Source IDs", "Requirement IDs"], model.findings.map((finding) => [finding.id, finding.finding, finding.status, finding.confidence, finding.sourceIds.join(", ") || "No sources supplied", finding.requirementIds.join(", ") || "Phase scope"]))}`,
    optional("codeExamples"),
    `## Recommendations\n\n${table(["Recommendation ID", "Recommendation", "Supporting Claim IDs", "Evidence IDs", "Affected Surfaces", "Tests / Checks", "Requirement IDs", "Status"], model.recommendations.map((row) => [row.id, row.recommendation, row.findingIds.join(", "), [...new Set(row.findingIds.flatMap((id) => sourceIdsForFinding.get(id) ?? []))].join(", "), row.affectedSurfaces.join("; "), row.verification.join("; "), row.requirementIds.join(", ") || "Phase scope", row.status]))}`,
    `## Sources\n\n### Source Register\n\n${model.sources.length ? table(["Source ID", "Lane", "Path Or URL", "Title", "Access Date", "Support Span", "Limitations"], model.sources.map((source) => [source.id, source.lane, source.reference, source.title ?? "Title not supplied", source.accessed ?? "Not recorded", source.excerpt ?? "No excerpt supplied", source.limitations ?? "No limitations recorded"])) : "No source evidence has been supplied."}`,
  ];
  return `${sections.join("\n\n")}\n`;
}
