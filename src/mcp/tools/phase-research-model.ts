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
  planningReady: boolean;
  planningBlockers: string[];
  issues: string[];
  warnings: string[];
  diagnostics: PhaseArtifactValidationDiagnostic[];
};

export type PhaseResearchModelValidationContext = {
  knownRequirementIds?: readonly string[];
  requiredRequirementIds?: readonly string[];
};

let researchModelValidator: ValidateFunction | undefined;

const EMPTY_LIST_ALIAS = /^(?:[-*+]\s*)?(?:none|no(?:ne)?\s+(?:open\s+)?questions?|no\s+recommendations?|n\/?a|null|\[\])[.!]?$/i;

/** Normalize presentation choices only; never create evidence or increase confidence. */
function normalizeResearchModel(object: Record<string, unknown>): void {
  const list = (value: unknown): unknown => {
    if (value == null || (typeof value === "string" && (!value.trim() || EMPTY_LIST_ALIAS.test(value.trim())))) return [];
    if (typeof value === "string") return [value.trim()];
    if (Array.isArray(value)) return [...new Set(value.map((item) => typeof item === "string" ? item.trim() : item))];
    return value;
  };
  const enumValue = (value: unknown, aliases: Record<string, string>): unknown =>
    typeof value === "string" ? aliases[value.trim().toLowerCase().replace(/[ -]+/g, "_")] ?? value.trim() : value;
  if (typeof object.summary === "string") object.summary = object.summary.trim();
  object.openQuestions = list(object.openQuestions);
  if (Array.isArray(object.openQuestions)) object.openQuestions = object.openQuestions.map((value) => {
    if (typeof value === "string") {
      const blockingPrefix = value.match(/^(?:[-*+]\s*)?(?:\*\*)?blocking(?:\*\*)?\s*:\s*(?:\*\*)?\s*/i);
      return { question: blockingPrefix ? value.slice(blockingPrefix[0].length) : value, blocking: Boolean(blockingPrefix) };
    }
    const question = asJsonObject(value);
    if (question && question.blocking === undefined) question.blocking = false;
    if (question && typeof question.blocking === "string" && /^(?:true|false)$/i.test(question.blocking.trim())) question.blocking = question.blocking.trim().toLowerCase() === "true";
    return value;
  });
  if (object.sections == null) object.sections = {};
  const sections = asJsonObject(object.sections);
  if (sections) for (const [key, value] of Object.entries(sections)) {
    if (value == null || (typeof value === "string" && (!value.trim() || EMPTY_LIST_ALIAS.test(value.trim())))) delete sections[key];
    else if (Array.isArray(value)) sections[key] = value.filter((item) => typeof item !== "string" || (item.trim() && !EMPTY_LIST_ALIAS.test(item.trim())));
  }
  for (const field of ["sources", "findings", "recommendations"] as const) {
    if (!Array.isArray(object[field])) continue;
    for (const value of object[field]) {
      const row = asJsonObject(value);
      if (!row) continue;
      for (const [key, entry] of Object.entries(row)) if (typeof entry === "string") row[key] = entry.trim();
      if (field === "sources") {
        row.lane = enumValue(row.lane, { repo: "repo", repository: "repo", external: "external", web: "external", supplied: "supplied", user_supplied: "supplied" });
        for (const optional of ["title", "accessed", "excerpt", "limitations"]) if (row[optional] == null || row[optional] === "") delete row[optional];
        continue;
      }
      row.requirementIds = list(row.requirementIds);
      if (field === "findings") {
        row.sourceIds = list(row.sourceIds);
        row.confidence = enumValue(row.confidence ?? "MEDIUM", { low: "LOW", medium: "MEDIUM", moderate: "MEDIUM", high: "HIGH" });
        const defaultStatus = row.confidence === "HIGH" && Array.isArray(row.sourceIds) && row.sourceIds.length > 0 ? "supported" : "inferred";
        row.status = enumValue(row.status ?? defaultStatus, {
          supported: "supported", directly_supported: "supported", inferred: "inferred",
          inferred_from_supported: "inferred", partially_supported: "inferred",
          unsupported: "unsupported", not_enough_evidence: "unsupported",
        });
      } else {
        row.findingIds = list(row.findingIds);
        row.affectedSurfaces = list(row.affectedSurfaces);
        row.verification = list(row.verification);
        row.status = enumValue(row.status ?? "ready", { ready: "ready", planning_ready: "ready", blocked: "blocked", needs_research: "blocked" });
      }
    }
  }
}

/** Publication validity is separate from whether this research resolves planning blockers. */
export function validatePhaseResearchModelInput(
  raw: unknown,
  context: PhaseResearchModelValidationContext = {},
): { model: PhaseResearchStructuredModel | null; validation: PhaseResearchModelValidation } {
  const validation: PhaseResearchModelValidation = { valid: true, planningReady: true, planningBlockers: [], issues: [], warnings: [], diagnostics: [] };
  const issue = (path: string, code: string, message: string, repair: string, warning = false): void => {
    (warning ? validation.warnings : validation.issues).push(message);
    validation.diagnostics.push({
      path, code, message, repair, severity: warning ? "warning" : "error",
      retryable: true, nextTool: "blueprint_research_submit",
    });
    validation.valid = validation.issues.length === 0;
    validation.planningReady = validation.valid && validation.planningBlockers.length === 0;
  };
  const planningBlocker = (path: string, code: string, message: string, repair: string): void => {
    validation.planningBlockers.push(message);
    issue(path, code, message, repair, true);
  };
  let object: Record<string, unknown> | null;
  try {
    const text = typeof raw === "string" ? raw.trim() : null;
    const fencedJson = text?.match(/^(`{3,}|~{3,})(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n\1$/i);
    object = asJsonObject(typeof raw === "string"
      ? safeJsonParse(fencedJson?.[2] ?? text!, { label: "Research model", maxBytes: 1024 * 1024 })
      : structuredClone(raw));
  } catch (error) {
    issue("model", "schema.json", error instanceof Error ? error.message : "Research candidate is not JSON.",
      "Correct the JSON syntax and submit the research model.");
    return { model: null, validation };
  }
  if (!object) {
    issue("model", "schema.type", "Research candidate must be a JSON object.",
      "Supply the structured research core from phase.research.modelContract.");
    return { model: null, validation };
  }
  normalizeResearchModel(object);
  const validate = researchModelValidator ??= createAjvValidator().compile(
    readArtifactContract("phase.research").modelContract!.jsonSchema,
  );
  if (!validate(object)) {
    for (const error of validate.errors ?? []) {
      const property = error.params.missingProperty ?? error.params.additionalProperty;
      const fieldPath = `model${error.instancePath.replace(/\//g, ".")}${typeof property === "string" ? `.${property}` : ""}`;
      issue(fieldPath, `schema.${error.keyword}`, `Research candidate ${fieldPath} ${error.message ?? error.keyword}.`,
        `Correct ${fieldPath} using phase.research.modelContract.`);
    }
    return { model: null, validation };
  }
  const model = object as unknown as PhaseResearchStructuredModel;
  for (const field of ["sources", "findings", "recommendations"] as const) {
    const ids = new Set<string>();
    model[field].forEach((row, index) => {
      if (ids.has(row.id)) issue(`model.${field}.${index}.id`, "research.duplicate_id",
        `Research ${field} id ${row.id} is duplicated.`, "Give each row within this collection a unique id and update its references.");
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
    if (recommendation.status === "blocked") planningBlocker(`${field}.status`, "research.recommendation_blocked",
      `Recommendation ${recommendation.id} is blocked.`, "Preserve this finding in RESEARCH.md; resolve the implementation blocker before planning relies on the recommendation.");
    if (recommendation.status === "ready") {
      const unsupported = recommendation.findingIds.length === 0 || recommendation.findingIds.some((id) => {
        const finding = findings.get(id);
        return !finding || finding.status === "unsupported" || finding.sourceIds.length === 0 || finding.sourceIds.some((source) => !sources.has(source));
      });
      if (unsupported) issue(`${field}.findingIds`, "research.recommendation_unsupported",
        `Ready recommendation ${recommendation.id} lacks supported findings.`, "Supply evidence-linked findings or mark this recommendation blocked.");
      if (recommendation.affectedSurfaces.length === 0) issue(`${field}.affectedSurfaces`, "research.affected_surfaces_missing",
        `Recommendation ${recommendation.id} does not identify affected surfaces.`, "Planning can identify affected files, modules or interfaces when needed.", true);
      if (recommendation.verification.length === 0) issue(`${field}.verification`, "research.verification_missing",
        `Recommendation ${recommendation.id} does not specify a verification approach.`, "Planning can choose a meaningful behavioral check.", true);
    }
    checkRequirements(recommendation.requirementIds, `${field}.requirementIds`, recommendation.status === "ready");
  });
  model.openQuestions.forEach((question, index) => {
    if (question.blocking) planningBlocker(`model.openQuestions.${index}.blocking`, "research.question_blocking",
      `Research has a blocking question: ${question.question}`, "Resolve this question or explain why it no longer blocks planning and revise its status.");
  });
  for (const id of context.requiredRequirementIds ?? []) {
    if (!covered.has(id)) issue("model.findings", "research.requirement_uncovered",
      `No research finding is mapped to ${id}.`, "Investigate this requirement only if an unresolved decision affects implementation; do not add generic filler.", true);
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
  if (value === undefined) return "";
  return (Array.isArray(value) ? value : [value]).filter((item) => item.trim()).map(prose).join("\n\n");
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
  const requirements = args.requirements ?? requirementIds.map((id) => ({ id, description: "" }));
  const requirementRows = requirements.map((requirement) => [requirement.id, requirement.description,
    [...model.findings, ...model.recommendations].filter((row) => row.requirementIds.includes(requirement.id)).map((row) => row.id).join(", ")]);
  const optional = (key: keyof typeof OPTIONAL_HEADINGS): string => {
    const detail = sectionProse(model.sections?.[key]);
    return detail ? `## ${OPTIONAL_HEADINGS[key]}\n\n${detail}` : "";
  };
  const recommendationColumns = [
    { heading: "Recommendation ID", value: (row: PhaseResearchStructuredModel["recommendations"][number]) => row.id },
    { heading: "Recommendation", value: (row: PhaseResearchStructuredModel["recommendations"][number]) => row.recommendation },
    { heading: "Supporting Claim IDs", value: (row: PhaseResearchStructuredModel["recommendations"][number]) => row.findingIds.join(", ") },
    { heading: "Evidence IDs", value: (row: PhaseResearchStructuredModel["recommendations"][number]) => [...new Set(row.findingIds.flatMap((id) => sourceIdsForFinding.get(id) ?? []))].join(", ") },
    { heading: "Affected Surfaces", value: (row: PhaseResearchStructuredModel["recommendations"][number]) => row.affectedSurfaces.join("; ") },
    { heading: "Tests / Checks", value: (row: PhaseResearchStructuredModel["recommendations"][number]) => row.verification.join("; ") },
    { heading: "Requirement IDs", value: (row: PhaseResearchStructuredModel["recommendations"][number]) => row.requirementIds.join(", ") },
    { heading: "Status", value: (row: PhaseResearchStructuredModel["recommendations"][number]) => row.status },
  ].filter((column) => model.recommendations.some((row) => column.value(row)));
  const sourceColumns = [
    { heading: "Source ID", key: "id" }, { heading: "Lane", key: "lane" },
    { heading: "Path Or URL", key: "reference" }, { heading: "Title", key: "title" },
    { heading: "Access Date", key: "accessed" }, { heading: "Support Span", key: "excerpt" },
    { heading: "Limitations", key: "limitations" },
  ].filter((column) => model.sources.some((source) => source[column.key as keyof typeof source]));
  const sections = [
    `# Phase ${args.resolved.phasePrefix.replace(/[\r\n]/g, " ")}: ${args.resolved.phaseName.replace(/[\r\n]/g, " ")} - Research\n\n**Researched:** ${args.researchedAt ?? new Date().toISOString().slice(0, 10)}\n**Confidence:** ${confidence}`,
    `## Summary\n\n${prose(model.summary)}`,
    requirementRows.length ? `## Phase Requirements\n\n${table(["ID", "Description", "Research Support"], requirementRows)}` : "",
    args.lockedDecisions?.length ? `## Locked Decisions From Context\n\n${bullets(args.lockedDecisions, "")}` : "",
    args.userConstraints?.length ? `## User Constraints\n\n${bullets(args.userConstraints, "")}` : "",
    ...Object.keys(OPTIONAL_HEADINGS).filter((key) => key !== "codeExamples").map((key) => optional(key as keyof typeof OPTIONAL_HEADINGS)),
    model.openQuestions.length ? `## Open Questions\n\n${model.openQuestions.map((question) => `- ${question.blocking ? "Blocking" : "Nonblocking"}: ${prose(question.question).replace(/\n/g, "\n  ")}`).join("\n")}` : "",
    `## Findings\n\n${table(["Finding ID", "Finding", "Support Status", "Confidence", "Source IDs"], model.findings.map((finding) => [finding.id, finding.finding, finding.status, finding.confidence, finding.sourceIds.join(", ")]))}`,
    optional("codeExamples"),
    `## Recommendations\n\n${table(recommendationColumns.map((column) => column.heading), model.recommendations.map((row) => recommendationColumns.map((column) => column.value(row))))}`,
    `## Sources\n\n${model.sources.length ? `### Source Register\n\n${table(sourceColumns.map((column) => column.heading), model.sources.map((source) => sourceColumns.map((column) => source[column.key as keyof typeof source] ?? "")))}` : "No source evidence is available; the recommendations remain blocked."}`,
  ];
  return `${sections.filter(Boolean).join("\n\n")}\n`;
}
