import test from "node:test";
import assert from "node:assert/strict";
import { readArtifactContract, renderArtifactAuthoringTemplate } from "../src/mcp/artifact-contracts/index.js";
import {
  canonicalizeResearchHeadingLines,
  canonicalizeResearchRequiredHeadings,
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
  return "# Phase 03: Discovery - Research\n\n**Confidence:** MEDIUM\n\n" + readArtifactContract("phase.research").requiredHeadings
    .map((heading) => `## ${heading}\n\n${content[heading] ?? "- Preserve the documented repository behavior."}`)
    .join("\n\n") + "\n";
}

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
    const missingSummary = document.replace("## Summary\n", "## Overview\n");
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
    for (const code of ["research.title_missing", "research.confidence_missing", "research.heading_missing"]) {
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
    ["Phase Requirements", "| ID | Description | Research Support |\n|---|---|---|\n| REQ-01 | Durable research | Preserve code examples. |", "research.phase_requirements_rows_missing"],
    ["Recommendations", "- Keep the existing behavior.", "research.recommendations_missing"],
    ["Sources", "- src/mcp/tools/artifacts.ts: validation.", "research.sources_missing"]
  ]) {
    const result = validateResearchArtifactContent(research({ [heading]: `\`\`\`markdown\n${body}\n\`\`\`` }));
    assert.equal(result.valid, false, heading);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === code), result.diagnostics.map((diagnostic) => diagnostic.code).join(", "));
  }
});

test("research normalizes only complete empty-question aliases outside examples", () => {
  for (const alias of ["- No open questions.", "None.", "* Nothing", "- N/A", "- none that block this phase"]) {
    const document = research({ "Open Questions": alias });
    assert.match(canonicalizeResearchHeadingLines(document), /## Open Questions\n\n- none\n/);
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
