import test from "node:test";
import assert from "node:assert/strict";

import {
  createToolResponseContent,
  summarizeToolResult
} from "../src/mcp/server.js";

test("artifact read summaries keep the transcript concise", () => {
  const result = {
    phaseFound: true,
    found: true,
    phaseNumber: "1",
    phasePrefix: "01",
    phaseName: "Core Game (Requirements: R-01, R-02, R-03)",
    phaseDir: ".blueprint/phases/01-core-game",
    artifact: "context",
    path: ".blueprint/phases/01-core-game/01-CONTEXT.md",
    content: "# Phase 1 Context\n\n## Objective\nShip the playable game.\n",
    reason: null
  };

  const summary = summarizeToolResult("blueprint_phase_artifact_read", result);

  assert.equal(
    summary,
    "Loaded Phase 1 context at `.blueprint/phases/01-core-game/01-CONTEXT.md` (56 B)."
  );
  assert.doesNotMatch(summary, /Ship the playable game/);
  assert.doesNotMatch(summary, /\"phaseFound\"/);
});

test("tool response content returns the compact summary instead of pretty JSON", () => {
  const content = createToolResponseContent("blueprint_phase_artifact_read", {
    phaseFound: true,
    found: true,
    phaseNumber: "1",
    artifact: "context",
    path: ".blueprint/phases/01-core-game/01-CONTEXT.md",
    content: "# Phase 1 Context\n"
  });

  assert.deepEqual(content, [
    {
      type: "text",
      text: "Loaded Phase 1 context at `.blueprint/phases/01-core-game/01-CONTEXT.md` (18 B)."
    }
  ]);
});

test("missing reads surface the reason without dumping the result object", () => {
  const summary = summarizeToolResult("blueprint_phase_artifact_read", {
    phaseFound: true,
    found: false,
    phaseNumber: "7",
    artifact: "research",
    reason: "Artifact file does not exist yet."
  });

  assert.equal(summary, "No Phase 7 research found: Artifact file does not exist yet.");
});

test("invalid write results do not claim an artifact was saved", () => {
  const summary = summarizeToolResult("blueprint_phase_validation_write", {
    phaseNumber: "3",
    artifact: "verification",
    path: ".blueprint/phases/03-validation-engine/03-VERIFICATION.md",
    summaryPaths: [".blueprint/phases/03-validation-engine/03-01-SUMMARY.md"],
    written: false,
    created: false,
    overwritten: false,
    status: "invalid",
    issues: ["Missing required sections."],
    warnings: ["Validation contract mismatch."]
  });

  assert.equal(
    summary,
    "Did not save Phase 3 verification at `.blueprint/phases/03-validation-engine/03-VERIFICATION.md` status: invalid (1 summary links, 1 warnings)."
  );
});

test("reused write results report preservation instead of a fresh save", () => {
  const summary = summarizeToolResult("blueprint_phase_validation_write", {
    phaseNumber: "3",
    artifact: "verification",
    path: ".blueprint/phases/03-validation-engine/03-VERIFICATION.md",
    summaryPaths: [".blueprint/phases/03-validation-engine/03-01-SUMMARY.md"],
    written: false,
    created: false,
    overwritten: false,
    status: "reused",
    issues: [],
    warnings: ["Preserved existing verification artifact because the content was unchanged."]
  });

  assert.equal(
    summary,
    "Reused existing Phase 3 verification at `.blueprint/phases/03-validation-engine/03-VERIFICATION.md` status: reused (1 summary links, 1 warnings)."
  );
});
