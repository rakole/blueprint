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
