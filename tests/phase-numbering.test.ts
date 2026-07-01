import test from "node:test";
import assert from "node:assert/strict";

import {
  parseRoadmapDocument,
  type ParsedRoadmapPhase
} from "../src/mcp/tools/phase-roadmap-parser.js";
import {
  computeNextWholePhaseNumber,
  extractPhaseNumberToken,
  formatPhasePrefix,
  normalizePhaseNumber
} from "../src/mcp/tools/phase-numbering.js";

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

test("phase numbering rejects multi-segment phase refs instead of truncating them", () => {
  assert.throws(
    () => normalizePhaseNumber("1.2.3"),
    /one decimal insertion level/i
  );
  assert.throws(
    () => extractPhaseNumberToken("Phase 1.2.3"),
    /one decimal insertion level/i
  );
  assert.throws(
    () => formatPhasePrefix("1.2.3"),
    /one decimal insertion level/i
  );
});

test("roadmap parser rejects multi-segment phase list entries explicitly", () => {
  assert.throws(
    () =>
      parseRoadmapDocument(`# Roadmap

- Active milestone: v1

## Phases

- [ ] Phase 1.2.3: Nested Unsupported Phase
`),
    /one decimal insertion level/i
  );
});

test("roadmap parser rejects multi-segment phase detail headings explicitly", () => {
  assert.throws(
    () =>
      parseRoadmapDocument(`# Roadmap

- Active milestone: v1

## Phases

- [ ] Phase 1.2: Supported Decimal Phase

## Phase Details

### Phase 1.2.3: Nested Unsupported Phase

**Goal**: This should be rejected rather than silently ignored.
`),
    /one decimal insertion level/i
  );
});
