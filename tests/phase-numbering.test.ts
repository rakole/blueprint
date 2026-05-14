import test from "node:test";
import assert from "node:assert/strict";

import type { ParsedRoadmapPhase } from "../src/mcp/tools/phase-roadmap-parser.js";
import { computeNextWholePhaseNumber } from "../src/mcp/tools/phase-numbering.js";

function fixturePhase(phaseNumber: string): ParsedRoadmapPhase {
  return {
    phaseNumber,
    phasePrefix: phaseNumber,
    phaseName: `Phase ${phaseNumber}`,
    completed: false,
    summary: null,
    goal: null,
    successCriteria: null,
    requirements: []
  };
}

test("computeNextWholePhaseNumber advances past the highest whole-number phase", () => {
  assert.equal(
    computeNextWholePhaseNumber(["1", "2", "3"].map(fixturePhase)),
    "4"
  );
});

test("computeNextWholePhaseNumber treats decimal history as part of the same base phase", () => {
  assert.equal(
    computeNextWholePhaseNumber(["1", "2", "2.1", "2.2", "3"].map(fixturePhase)),
    "4"
  );
});

test("computeNextWholePhaseNumber preserves gaps instead of renumbering history", () => {
  assert.equal(
    computeNextWholePhaseNumber(["1", "2", "4"].map(fixturePhase)),
    "5"
  );
});

test("computeNextWholePhaseNumber derives the first whole-number phase from decimal-only history", () => {
  assert.equal(
    computeNextWholePhaseNumber(["1", "2.1", "2.2"].map(fixturePhase)),
    "3"
  );
});

test("computeNextWholePhaseNumber rejects empty history instead of inventing phase 1", () => {
  assert.throws(
    () => computeNextWholePhaseNumber([]),
    /empty roadmap/i
  );
});
