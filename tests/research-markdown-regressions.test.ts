import test from "node:test";
import assert from "node:assert/strict";
import { readArtifactContract, renderArtifactAuthoringTemplate } from "../src/mcp/artifact-contracts/index.js";
import {
  canonicalizeResearchHeadingLines,
  canonicalizeResearchRequiredHeadings,
  researchHasPlanningBlockers,
  validateResearchArtifactContent
} from "../src/mcp/tools/artifacts.js";

function research(overrides: Record<string, string> = {}): string {
  const content: Record<string, string> = {
    "Phase Requirements": "| ID | Description | Research Support |\n|---|---|---|\n| REQ-01 | Durable research | Preserve code examples. |",
    "Standard Stack": "- TypeScript",
    "Open Questions": "- none",
    "Sources": "- src/mcp/tools/artifacts.ts: research validation.",
    ...overrides
  };
  return "# Phase 03: Discovery - Research\n\n**Confidence:** MEDIUM\n\n" + [...new Set([...readArtifactContract("phase.research").requiredHeadings, ...Object.keys(content)])]
    .map((heading) => `## ${heading}\n\n${content[heading] ?? "- Preserve the documented repository behavior."}`)
    .join("\n\n") + "\n";
}

test("planning honors explicit Markdown blockers without mistaking examples or nonblocking questions for blockers", () => {
  for (const question of ["- Blocking: Confirm retention.", "* **Blocking:** Confirm retention.", "| Question | Blocking |\n|---|---|\n| Confirm retention. | true |"])
    assert.equal(researchHasPlanningBlockers(research({ "Open Questions": question })), true, question);
  for (const question of ["- Nonblocking: Is a longer timeout useful?", "- None of the sources indicate a blocking concern.", "```markdown\n- Blocking: Example only.\n```"])
    assert.equal(researchHasPlanningBlockers(research({ "Open Questions": question })), false, question);
  assert.equal(researchHasPlanningBlockers(research({ Recommendations: "- **Blocked:** Confirm the storage provider before selecting it." })), true);
  const evidenceGap = research({ Recommendations: "- Blocked pending access to the vendor API documentation.", Sources: "No source evidence is available." });
  assert.equal(validateResearchArtifactContent(evidenceGap).valid, true);
  assert.equal(researchHasPlanningBlockers(evidenceGap), true);
});

test("research accepts precise short content without word-count padding", () => {
  const result = validateResearchArtifactContent(research());
  assert.equal(result.valid, true, result.issues.join("\n"));
});

for (const fence of ["```", "~~~~", "`````", "~~~~~~"]) {
  test(`research ignores literal headings and preserves code within ${fence.length}-character ${fence[0]} fences`, () => {
    const code = [
      `${fence}markdown`,
      "## summary",
      "## installation & setup",
      "### Source Register",
      "- No open questions.",
      "const result = true;",
      ...(fence.length > 3 ? [fence[0].repeat(3), "## state-of-the-art"] : []),
      `${fence}not-a-closing-fence`,
      "## standard-stack",
      fence
    ].join("\n");
    const document = research({ "Code Examples": code });
    const normalized = canonicalizeResearchHeadingLines(document);
    assert.equal(normalized, document);
    assert.deepEqual(canonicalizeResearchRequiredHeadings(document).canonicalizedHeadings, []);
    const result = validateResearchArtifactContent(document);
    assert.equal(result.valid, true, result.issues.join("\n"));
    const missingSummary = document.replace("## Summary\n", "## Incidental Notes\n");
    assert.ok(validateResearchArtifactContent(missingSummary).diagnostics.some((diagnostic) =>
      diagnostic.code === "research.heading_missing" && diagnostic.heading === "Summary"));
  });
}

test("research accepts a longer closing fence and preserves original code line endings", () => {
  const code = "~~~text\r\n## installation & setup\r\n~~~ trailing-text\r\n## summary\r\n~~~~~\r\n";
  const document = `## standard-stack\r\n${code}## state-of-the-art\r\n`;
  assert.equal(canonicalizeResearchHeadingLines(document), `## Standard Stack\r\n${code}## State Of The Art\r\n`);
});

test("a whole fenced research document cannot satisfy structural requirements", () => {
  for (const fence of ["````", "~~~~~"]) {
    const result = validateResearchArtifactContent(`${fence}markdown\n${research()}${fence}\n`);
    assert.equal(result.valid, false);
    for (const code of ["research.title_missing", "research.heading_missing"]) {
      assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === code), code);
    }
  }
});

test("unterminated fences cannot invent remaining research sections", () => {
  const document = research().replace("## Summary", "~~~~markdown\n## Summary");
  const result = validateResearchArtifactContent(document);
  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.heading === "Summary" && diagnostic.code === "research.heading_missing"));
});

test("example-only requirements, recommendations, and sources do not count as published evidence", () => {
  for (const [heading, body, code] of [
    ["Recommendations", "- Keep the existing behavior.", "research.section_non_substantive"],
    ["Sources", "- src/mcp/tools/artifacts.ts: validation.", "research.sources_missing"]
  ]) {
    const result = validateResearchArtifactContent(research({ [heading]: `\`\`\`markdown\n${body}\n\`\`\`` }));
    assert.equal(result.valid, false, heading);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === code), result.diagnostics.map((diagnostic) => diagnostic.code).join(", "));
  }
});

test("research accepts empty-question variants without prescribing a sentinel", () => {
  for (const alias of ["- No open questions.", "None.", "* Nothing", "- N/A", "- none that block this phase"]) {
    const document = research({ "Open Questions": alias });
    assert.equal(canonicalizeResearchHeadingLines(document), document);
    const result = validateResearchArtifactContent(document);
    assert.equal(result.valid, true, result.issues.join("\n"));
  }
  const meaningful = research({ "Open Questions": "- None of the sources establish which timeout is safe." });
  assert.equal(canonicalizeResearchHeadingLines(meaningful), meaningful);
});

test("short placeholders and untouched scaffolds still fail research validation", () => {
  for (const placeholder of ["TODO", "- **TODO**", "- `TBD`", "- null", "- placeholder", "why it matters.", "- <key conclusion>", "| Topic | Notes |\n|---|---|"]) {
    const result = validateResearchArtifactContent(research({ "Summary": placeholder }));
    assert.equal(result.valid, false, placeholder);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.heading === "Summary" && diagnostic.code === "research.section_non_substantive"), placeholder);
  }
  assert.equal(validateResearchArtifactContent(renderArtifactAuthoringTemplate("phase.research")).valid, false);
});

test("compact first-pass prose research needs no tables, exact title suffix, confidence marker or optional headings", () => {
  const document = `# Atomic research publication

## Executive Summary

The existing writer exposes an atomic replacement operation that fits research publication.

## Recommended Approach

Use the writer, then check the published bytes before marking the phase ready for planning.

## References

The implementation is in src/mcp/tools/artifacts.ts under writeTextFile.
`;
  const result = validateResearchArtifactContent(document);
  assert.equal(result.valid, true, result.issues.join("\n"));
});

test("optional research headings may be empty or omitted without meaningless padding", () => {
  const document = research({ "Phase Requirements": "", "Standard Stack": "", "Code Examples": "", "Open Questions": "[]" });
  const result = validateResearchArtifactContent(document);
  assert.equal(result.valid, true, result.issues.join("\n"));
});

test("Markdown evidence checks still reject an explicitly unsupported HIGH claim and ready recommendation", () => {
  const document = research({
    Findings: "| Finding ID | Finding | Support Status | Confidence | Source IDs |\n|---|---|---|---|---|\n| CLM-001 | The API is reliable. | unsupported | HIGH | SRC-001 |",
    Recommendations: "| Recommendation ID | Recommendation | Supporting Claim IDs | Status |\n|---|---|---|---|\n| REC-001 | Depend on this API. | CLM-001 | ready |",
  });
  const result = validateResearchArtifactContent(document);
  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "research.high_confidence_unsupported"));
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "research.recommendation_unsupported"));
});

test("explicit short source references must resolve even when the source register is absent", () => {
  for (const sources of [
    "### Source Register\n\n| Source ID | Lane | Path Or URL |\n|---|---|---|\n| 1 | repo | src/mcp/tools/artifacts.ts |",
    "- src/mcp/tools/artifacts.ts was inspected but no source ID is assigned.",
  ]) {
    const document = research({
      Findings: "| Finding ID | Finding | Support Status | Confidence | Source IDs |\n|---|---|---|---|---|\n| F1 | The writer is atomic. | supported | HIGH | 2 |",
      Sources: sources,
    });
    const result = validateResearchArtifactContent(document);
    assert.equal(result.valid, false);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "research.source_reference_missing" && diagnostic.message.includes("source 2")));
  }
});

test("ready recommendation references cannot bypass validation by omitting the entire findings collection", () => {
  const document = research({
    Recommendations: "| Recommendation ID | Recommendation | Supporting Claim IDs | Status |\n|---|---|---|---|\n| 1 | Reuse the existing writer. | F1 | ready |",
  });
  const result = validateResearchArtifactContent(document);
  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "research.finding_reference_missing" && diagnostic.message.includes("F1")));
});
