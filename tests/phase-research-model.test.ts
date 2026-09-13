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
  assert.deepEqual(contract.requiredHeadings, ["Summary", "Recommendations", "Sources"]);
  assert.ok(contract.modelContract?.renderedHeadings.includes("Findings"));
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
  assert.deepEqual(validatePhaseResearchModelInput(`\`\`\`json\n${JSON.stringify(raw)}\n\`\`\``), parsed);
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

test("blocked recommendations and blocking questions publish on the first attempt but prevent planning", () => {
  const raw = candidate();
  raw.recommendations[0].status = "blocked";
  raw.openQuestions.push({ question: "Which format does the consumer accept?", blocking: true });
  const result = validatePhaseResearchModelInput(raw);
  assert.ok(result.model);
  assert.equal(result.validation.valid, true);
  assert.equal(result.validation.planningReady, false);
  assert.equal(result.validation.planningBlockers.length, 2);
  assert.equal(validateResearchArtifactContent(render(result.model!)).valid, true);
  assert.ok(result.validation.diagnostics.some((entry) => entry.code === "research.recommendation_blocked"));
  assert.ok(result.validation.diagnostics.some((entry) => entry.code === "research.question_blocking"));
  raw.recommendations[0].status = "ready";
  raw.openQuestions[0].blocking = false;
  assert.equal(validatePhaseResearchModelInput(raw).validation.valid, true);
});

test("missing affected surfaces and verification are advice rather than publication gates", () => {
  const raw = candidate();
  raw.recommendations[0].affectedSurfaces = [];
  raw.recommendations[0].verification = [];
  const result = validatePhaseResearchModelInput(raw);
  assert.equal(result.validation.valid, true);
  assert.equal(result.validation.planningReady, true);
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

test("renderer preserves meaningful grounding with a compact first-pass publishable document", () => {
  const content = render(candidate());
  const headings = [...content.matchAll(/^## (.+)$/gm)].map((entry) => entry[1]);
  for (const heading of readArtifactContract("phase.research").requiredHeadings) assert.ok(headings.includes(heading));
  assert.ok(headings.length < 17);
  assert.ok(headings.includes("Findings"));
  assert.ok(content.includes("**Researched:** 2026-09-12"));
  assert.ok(content.includes("MCP tools own runtime-state writes."));
  assert.ok(content.includes("Keep source changes inside the phase research workflow."));
  assert.ok(!content.includes("## Open Questions"));
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
  assert.ok(!content.includes("## Standard Stack"));
  assert.ok(!content.includes("## Alternatives Considered"));
  assert.ok(!content.includes("Not recorded"));
  assert.ok(!content.includes("No section-specific detail"));
  assert.ok(!content.includes("No new dependency required"));
  assert.equal(content, render(raw), "Caller-supplied research timestamp makes rendering deterministic.");
});

test("representative first-pass research inputs publish without formatting or completeness repairs", () => {
  const fixtures = [
    {
      name: "sparse repository research",
      value: {
        summary: "The artifact writer already preserves atomic publication.",
        findings: [{ id: "F1", finding: "The writer renames a temporary file into place.", sourceIds: "S1" }],
        recommendations: [{ id: "R1", recommendation: "Reuse that writer for publication.", findingIds: "F1" }],
        sources: [{ id: "S1", lane: "Repository", reference: "src/mcp/tools/artifacts.ts" }],
      },
    },
    {
      name: "external evidence with enum aliases and no ritual metadata",
      value: {
        summary: "An atomic replacement avoids exposing partial files.",
        findings: [{ id: "F1", finding: "Rename replaces the target directory entry.", sourceIds: ["S1", "S1"], confidence: "medium", status: "Directly Supported" }],
        recommendations: [{ id: "R1", recommendation: "Use rename for the final publication step.", findingIds: "F1", status: "READY" }],
        sources: [{ id: "S1", lane: "EXTERNAL", reference: "https://nodejs.org/api/fs.html#fspromisesrenameoldpath-newpath", title: "", accessed: null }],
        openQuestions: "No open questions.", sections: { codeExamples: "", standardStack: [] },
      },
    },
    {
      name: "named supplied source without a public URL",
      value: {
        summary: "The stakeholder requires preserving an audit trail.",
        findings: [{ id: "F1", finding: "The stakeholder needs a durable audit trail.", sourceIds: ["S1"], status: "supported" }],
        recommendations: [{ id: "R1", recommendation: "Preserve the audit events when storing the final artifact.", findingIds: ["F1"] }],
        sources: [{ id: "S1", lane: "supplied", reference: "Stakeholder interview notes from September 12", excerpt: "Keep the audit trail." }],
      },
    },
    {
      name: "valuable blocked research with an explicit evidence gap",
      value: {
        summary: "The supplied material does not establish the storage consistency guarantee.",
        findings: [{ id: "F1", finding: "The behavior remains unverified.", status: "unsupported", confidence: "low" }],
        recommendations: [{ id: "R1", recommendation: "Determine the consistency guarantee before choosing the cache.", status: "blocked" }],
        sources: [], openQuestions: [{ question: "Does the storage provider guarantee read-after-write consistency?", blocking: true }],
      },
    },
  ];
  for (const fixture of fixtures) {
    const result = validatePhaseResearchModelInput(fixture.value, { requiredRequirementIds: ["REQ-01"] });
    assert.equal(result.validation.valid, true, `${fixture.name}: ${result.validation.issues.join("; ")}`);
    assert.ok(result.model, fixture.name);
    const content = renderPhaseResearchModelContent({ resolved: { phasePrefix: "01", phaseName: "Research" }, model: result.model!, researchedAt: "2026-09-13" });
    const markdown = validateResearchArtifactContent(content);
    assert.equal(markdown.valid, true, `${fixture.name}: ${markdown.issues.join("; ")}`);
    assert.ok(!content.includes("No section-specific detail"), fixture.name);
  }
});

test("missing requirement coverage warns while invented requirement references still fail", () => {
  const result = validatePhaseResearchModelInput(candidate(), { knownRequirementIds: ["RES-01", "RES-02"], requiredRequirementIds: ["RES-01", "RES-02"] });
  assert.equal(result.validation.valid, true);
  assert.equal(result.validation.planningReady, true);
  assert.ok(result.validation.warnings.some((warning) => warning.includes("RES-02")));
  assert.equal(validatePhaseResearchModelInput(candidate(), { knownRequirementIds: [] }).validation.valid, false);
});

test("normalization does not upgrade unsupported findings or hide broken references", () => {
  const model = candidate();
  model.findings[0].status = "unsupported";
  model.findings[0].confidence = "HIGH";
  const result = validatePhaseResearchModelInput(model);
  assert.equal(result.validation.valid, false);
  assert.equal(result.validation.planningReady, false);
  assert.ok(result.validation.issues.some((issue) => issue.includes("HIGH")));
  assert.ok(result.validation.issues.some((issue) => issue.includes("Ready recommendation")));
});

test("typed reference namespaces permit concise local numeric ids without ambiguity", () => {
  const raw = candidate();
  raw.sources[0].id = "1";
  raw.findings[0].id = "1";
  raw.findings[0].sourceIds = ["1"];
  raw.recommendations[0].id = "1";
  raw.recommendations[0].findingIds = ["1"];
  const result = validatePhaseResearchModelInput(raw);
  assert.equal(result.validation.valid, true, result.validation.issues.join("\n"));
  assert.equal(validateResearchArtifactContent(render(result.model!)).valid, true);
});

test("explicit HIGH with source references does not need redundant supported status on the first attempt", () => {
  const raw = candidate();
  delete (raw.findings[0] as Partial<typeof raw.findings[0]>).status;
  const result = validatePhaseResearchModelInput(raw);
  assert.equal(result.validation.valid, true, result.validation.issues.join("\n"));
  assert.equal(result.model!.findings[0].status, "supported");
  assert.equal(result.model!.findings[0].confidence, "HIGH");
  assert.equal(validateResearchArtifactContent(render(result.model!)).valid, true);
  for (const status of ["inferred", "unsupported"] as const) {
    raw.findings[0].status = status;
    assert.equal(validatePhaseResearchModelInput(raw).validation.valid, false, status);
  }
  delete (raw.findings[0] as Partial<typeof raw.findings[0]>).status;
  raw.findings[0].sourceIds = [];
  assert.equal(validatePhaseResearchModelInput(raw).validation.valid, false, "HIGH never invents missing evidence");
});

test("plain Blocking question strings preserve planning blockers during normalization", () => {
  for (const prefix of ["Blocking: ", "blocking: ", "- **Blocking:** ", "**Blocking**: "]) {
    const raw = { ...candidate(), openQuestions: [`${prefix}Which retention policy is required?`] };
    const result = validatePhaseResearchModelInput(raw);
    assert.equal(result.validation.valid, true, prefix);
    assert.equal(result.validation.planningReady, false, prefix);
    assert.equal(result.validation.planningBlockers.length, 1, prefix);
    assert.deepEqual(result.model!.openQuestions, [{ question: "Which retention policy is required?", blocking: true }]);
    assert.ok(render(result.model!).includes("Blocking: Which retention policy is required?"));
  }
});
