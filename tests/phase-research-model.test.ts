import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readArtifactContract } from "../src/mcp/artifact-contracts/index.js";
import { validateResearchArtifactContent } from "../src/mcp/tools/artifacts.js";
import {
  phaseResearchAuthoringSchema,
  renderPhaseResearchModelContent,
  validatePhaseResearchModelInput,
  type PhaseResearchStructuredModel,
} from "../src/mcp/tools/phase-research-model.js";

function candidate(): PhaseResearchStructuredModel {
  return {
    summary: "Keep research persistence in the existing MCP artifact layer.",
    findings: [{
      id: "CLM-001", finding: "The phase artifact layer owns research publication.",
      sourceIds: ["SRC-001"], confidence: "HIGH", requirementIds: ["RES-01"], status: "supported",
    }],
    recommendations: [{
      id: "REC-001", recommendation: "Reuse the MCP artifact writer to publish rendered research.",
      findingIds: ["CLM-001"], affectedSurfaces: ["src/mcp/tools/phase-artifacts.ts"],
      verification: ["Verify that an interrupted publish resumes without losing the draft."],
      requirementIds: ["RES-01"], status: "ready",
    }],
    openQuestions: [],
    sources: [{ id: "SRC-001", lane: "repo", reference: "src/mcp/tools/phase-artifacts.ts", excerpt: "blueprintPhaseArtifactWrite owns research writes." }],
  };
}

function render(model: PhaseResearchStructuredModel): string {
  return renderPhaseResearchModelContent({
    resolved: { phasePrefix: "03", phaseName: "Durable research" }, model,
    researchedAt: "2026-09-12",
    requirements: [{ id: "RES-01", description: "Preserve the complete research candidate before readiness checks." }],
    lockedDecisions: ["MCP tools own runtime-state writes."],
    userConstraints: ["Keep source changes inside the phase research workflow."],
  });
}

test("research registry exposes its source-owned compact model and keeps legacy authoring", async () => {
  const contract = readArtifactContract("phase.research");
  const schema = JSON.parse(await readFile(new URL("../src/mcp/artifact-contracts/schemas/phase.research.model.schema.json", import.meta.url), "utf8"));
  assert.deepEqual(contract.modelContract?.jsonSchema, schema);
  assert.deepEqual(contract.modelContract?.renderedHeadings, contract.requiredHeadings);
  assert.equal(contract.requiredHeadings.length, 17);
  assert.ok("authoringTemplate" in contract);
  assert.equal(validatePhaseResearchModelInput(contract.modelContract?.minimalValidExample).validation.valid, true);
  assert.equal(phaseResearchAuthoringSchema.safeParse(candidate()).success, true);
});

test("JSON and typed inputs produce the same model; optional fields default without mutating raw input", () => {
  const raw = candidate() as Partial<PhaseResearchStructuredModel>;
  delete raw.openQuestions;
  const parsed = validatePhaseResearchModelInput(raw);
  assert.equal(parsed.validation.valid, true);
  assert.deepEqual(parsed.model?.openQuestions, []);
  assert.deepEqual(parsed.model?.sections, {});
  assert.equal(raw.openQuestions, undefined);
  assert.deepEqual(validatePhaseResearchModelInput(JSON.stringify(raw)), parsed);
});

test("malformed JSON, nonobjects, whitespace and unexpected identity fields are field-addressable errors", () => {
  assert.equal(validatePhaseResearchModelInput('{"summary":').model, null);
  for (const value of [null, [], 3]) assert.equal(validatePhaseResearchModelInput(value).validation.valid, false);
  const parsed = validatePhaseResearchModelInput({ ...candidate(), summary: " \n ", path: "../elsewhere" });
  assert.equal(parsed.model, null);
  assert.ok(parsed.validation.diagnostics.some((entry) => entry.path === "model.path"));
  assert.ok(parsed.validation.diagnostics.some((entry) => entry.path === "model.summary"));
});

test("duplicate ids and dangling source/finding references cannot publish", () => {
  const raw = candidate();
  raw.sources.push({ ...raw.sources[0] });
  raw.findings[0].sourceIds.push("SRC-404");
  raw.recommendations[0].findingIds.push("CLM-404");
  const parsed = validatePhaseResearchModelInput(raw);
  assert.ok(parsed.model, "Retain the complete schema-valid draft for correction.");
  for (const code of ["research.duplicate_id", "research.source_reference_missing", "research.finding_reference_missing", "research.recommendation_unsupported"]) {
    assert.ok(parsed.validation.diagnostics.some((entry) => entry.code === code), code);
  }
});

test("explicit inference is allowed at MEDIUM confidence but never silently upgraded to HIGH", () => {
  const raw = candidate();
  raw.findings[0].status = "inferred";
  raw.findings[0].confidence = "MEDIUM";
  assert.equal(validatePhaseResearchModelInput(raw).validation.valid, true);
  raw.findings[0].confidence = "HIGH";
  assert.ok(validatePhaseResearchModelInput(raw).validation.diagnostics.some((entry) => entry.code === "research.high_confidence_unsupported"));
});

test("a ready recommendation cannot depend on unsupported or unreferenced findings", () => {
  for (const mode of ["unsupported", "emptySources", "emptyFindings"] as const) {
    const raw = candidate();
    if (mode === "unsupported") raw.findings[0].status = "unsupported";
    if (mode === "emptySources") raw.findings[0].sourceIds = [];
    if (mode === "emptyFindings") raw.recommendations[0].findingIds = [];
    assert.ok(validatePhaseResearchModelInput(raw).validation.diagnostics.some((entry) => entry.code === "research.recommendation_unsupported"), mode);
  }
});

test("blocked recommendations and blocking questions remain durable but unready", () => {
  const raw = candidate();
  raw.recommendations[0].status = "blocked";
  raw.openQuestions.push({ question: "Which format does the consumer accept?", blocking: true });
  const result = validatePhaseResearchModelInput(raw);
  assert.ok(result.model);
  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.diagnostics.some((entry) => entry.code === "research.recommendation_blocked"));
  assert.ok(result.validation.diagnostics.some((entry) => entry.code === "research.question_blocking"));
  raw.recommendations[0].status = "ready";
  raw.openQuestions[0].blocking = false;
  assert.equal(validatePhaseResearchModelInput(raw).validation.valid, true);
});

test("ready recommendations need concrete affected surfaces and verification", () => {
  const raw = candidate();
  raw.recommendations[0].affectedSurfaces = [];
  raw.recommendations[0].verification = [];
  const result = validatePhaseResearchModelInput(raw);
  assert.ok(result.validation.diagnostics.some((entry) => entry.code === "research.affected_surfaces_missing"));
  assert.ok(result.validation.diagnostics.some((entry) => entry.code === "research.verification_missing"));
});

test("known requirement ids and required coverage are checked against prepared evidence", () => {
  const result = validatePhaseResearchModelInput(candidate(), { knownRequirementIds: ["RES-02"], requiredRequirementIds: ["RES-02"] });
  assert.ok(result.validation.diagnostics.some((entry) => entry.code === "research.unknown_requirement"));
  assert.ok(result.validation.diagnostics.some((entry) => entry.code === "research.requirement_uncovered"));
  assert.equal(validatePhaseResearchModelInput(candidate(), { knownRequirementIds: ["RES-01"], requiredRequirementIds: ["RES-01"] }).validation.valid, true);
});

test("external sources require usable URL or DOI and preserve missing-date uncertainty", () => {
  const raw = candidate();
  raw.sources[0] = { id: "SRC-001", lane: "external", reference: "Vendor documentation" };
  assert.equal(validatePhaseResearchModelInput(raw).validation.valid, false);
  raw.sources[0].reference = "https://example.org/official-docs";
  const result = validatePhaseResearchModelInput(raw);
  assert.equal(result.validation.valid, true);
  assert.ok(result.validation.warnings.some((entry) => entry.includes("access date")));
  raw.sources[0].reference = "doi:10.1234/research.2026";
  assert.equal(validatePhaseResearchModelInput(raw).validation.valid, true);
  raw.sources[0].reference = "javascript:alert(1)";
  assert.equal(validatePhaseResearchModelInput(raw).validation.valid, false);
});

test("renderer preserves all canonical headings, grounded constraints and ordinary legacy validity", () => {
  const content = render(candidate());
  const headings = [...content.matchAll(/^## (.+)$/gm)].map((entry) => entry[1]);
  assert.deepEqual(headings, readArtifactContract("phase.research").requiredHeadings);
  assert.ok(content.includes("**Researched:** 2026-09-12"));
  assert.ok(content.includes("MCP tools own runtime-state writes."));
  assert.ok(content.includes("Keep source changes inside the phase research workflow."));
  assert.ok(content.includes("## Open Questions\n\n- none"));
  assert.equal(validateResearchArtifactContent(content).valid, true, JSON.stringify(validateResearchArtifactContent(content).issues));
});

test("renderer escapes table pipes and flattens row newlines without losing source/recommendation links", () => {
  const raw = candidate();
  raw.findings[0].finding = "Call A | B\nthen preserve the entire result.";
  raw.sources[0].excerpt = "The owner accepts x | y.";
  const content = render(raw);
  assert.ok(content.includes("Call A \\| B then preserve the entire result."));
  assert.ok(content.includes("The owner accepts x \\| y."));
  assert.ok(content.includes("| REC-001 | Reuse the MCP artifact writer to publish rendered research. | CLM-001 | SRC-001 |"));
});

test("renderer leaves fenced examples literal and demotes prose headings that could replace canonical sections", () => {
  const raw = candidate();
  raw.summary += "\n\n## Summary\nNested authored discussion.";
  raw.sections = { codeExamples: "````markdown\n## Summary\n```ts\nconst x = 1;\n```\n````" };
  const content = render(raw);
  assert.ok(content.includes("### Summary\nNested authored discussion."));
  assert.ok(content.includes(raw.sections.codeExamples as string));
  assert.ok(content.includes("````\n\n## Recommendations"));
});

test("an unfinished code example cannot swallow downstream canonical sections", () => {
  const raw = candidate();
  raw.sections = { codeExamples: "~~~markdown\n## Summary\nA literal unfinished example." };
  const content = render(raw);
  assert.ok(content.includes("A literal unfinished example.\n~~~\n\n## Recommendations"));
});

test("omitted optional sections report omission without inventing a stack, setup or evidence", () => {
  const raw = candidate();
  raw.sections = { alternativesConsidered: [] };
  const content = render(raw);
  assert.ok(content.includes("## Standard Stack\n\nNo section-specific detail was supplied in this research."));
  assert.ok(content.includes("## Alternatives Considered\n\nNo section-specific detail was supplied in this research."));
  assert.ok(content.includes("Not recorded"));
  assert.ok(!content.includes("No new dependency required"));
  assert.equal(content, render(raw), "Caller-supplied research timestamp makes rendering deterministic.");
});
