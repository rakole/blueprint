import test from "node:test";
import assert from "node:assert/strict";

import {
  formatRoadmapPhaseDetailHeading,
  formatRoadmapPhaseListLine,
  parseRoadmapDocument,
  parseRoadmapPhaseDetailHeading,
  parseRoadmapPhaseListLine,
  splitRoadmapPhaseDetailBlocks,
  splitRoadmapPhaseListBlocks
} from "../src/mcp/tools/phase-roadmap-parser.js";

test("parseRoadmapPhaseListLine accepts canonical checklist forms", () => {
  assert.deepEqual(
    parseRoadmapPhaseListLine("- [ ] Phase 1: Discovery (Requirements: REQ-01, REQ-02)"),
    {
      completed: false,
      phaseNumber: "1",
      phaseName: "Discovery",
      requirements: ["REQ-01", "REQ-02"]
    }
  );

  assert.deepEqual(parseRoadmapPhaseListLine("- [x] Phase 2: Delivery"), {
    completed: true,
    phaseNumber: "2",
    phaseName: "Delivery",
    requirements: []
  });
});

test("formatRoadmapPhaseListLine emits canonical checklist forms", () => {
  assert.equal(
    formatRoadmapPhaseListLine({
      completed: false,
      phaseNumber: "2.1",
      phaseName: "API Stabilization",
      requirementIds: ["REQ-03"]
    }),
    "- [ ] Phase 2.1: API Stabilization (Requirements: REQ-03)"
  );

  assert.equal(
    formatRoadmapPhaseListLine({
      completed: true,
      phaseNumber: "4",
      phaseName: "Validation",
      requirementIds: []
    }),
    "- [x] Phase 4: Validation"
  );
});

test("parseRoadmapPhaseListLine rejects legacy noncanonical forms", () => {
  assert.equal(parseRoadmapPhaseListLine("- [X] Phase 1: Discovery"), null);
  assert.equal(parseRoadmapPhaseListLine("- [ ]  Phase 1: Discovery"), null);
  assert.equal(parseRoadmapPhaseListLine("- [ ] **Phase 1: Discovery**"), null);
  assert.equal(parseRoadmapPhaseListLine("- [ ] Phase 1 - Discovery"), null);
});

test("parseRoadmapPhaseDetailHeading accepts and formats canonical headings", () => {
  assert.deepEqual(parseRoadmapPhaseDetailHeading("### Phase 2.1: API Stabilization"), {
    phaseNumber: "2.1",
    phaseName: "API Stabilization"
  });

  assert.equal(
    formatRoadmapPhaseDetailHeading({
      phaseNumber: "4",
      phaseName: "Validation"
    }),
    "### Phase 4: Validation"
  );
});

test("parseRoadmapPhaseDetailHeading rejects legacy noncanonical forms", () => {
  assert.equal(parseRoadmapPhaseDetailHeading("### Phase 4 - Validation"), null);
  assert.equal(parseRoadmapPhaseDetailHeading("### **Phase 4: Validation**"), null);
});

test("splitRoadmapPhaseListBlocks returns canonical checklist blocks", () => {
  const blocks = splitRoadmapPhaseListBlocks(`## Phases

- [ ] Phase 1: Discovery (Requirements: REQ-01)
  - Objective: Keep list-only goal support.
- [x] Phase 3: Validation
  - Success Criteria:
    - Verification evidence exists.
`);

  assert.deepEqual(blocks, [
    `- [ ] Phase 1: Discovery (Requirements: REQ-01)
  - Objective: Keep list-only goal support.`,
    `- [x] Phase 3: Validation
  - Success Criteria:
    - Verification evidence exists.`
  ]);
});

test("splitRoadmapPhaseListBlocks rejects mixed noncanonical checklist lines", () => {
  assert.throws(
    () =>
      splitRoadmapPhaseListBlocks(`## Phases

- [ ] Phase 1: Discovery (Requirements: REQ-01)
  - Objective: Keep list-only goal support.
- [ ] **Phase 2: Legacy Bold**
`),
    /Non-canonical ROADMAP phase checklist line/
  );
});

test("splitRoadmapPhaseDetailBlocks returns canonical detail blocks", () => {
  const blocks = splitRoadmapPhaseDetailBlocks(`## Phase Details

### Phase 1: Discovery
**Goal**: Keep canonical detail parsing.

### Phase 3: Validation
**Goal**: Preserve completion evidence.
`);

  assert.deepEqual(blocks, [
    `### Phase 1: Discovery
**Goal**: Keep canonical detail parsing.`,
    `### Phase 3: Validation
**Goal**: Preserve completion evidence.`
  ]);
});

test("splitRoadmapPhaseDetailBlocks rejects mixed noncanonical detail headings", () => {
  assert.throws(
    () =>
      splitRoadmapPhaseDetailBlocks(`## Phase Details

### Phase 1: Discovery
**Goal**: Keep canonical detail parsing.

### Phase 2 - Legacy Dash
**Goal**: This legacy heading must be rejected.
`),
    /Non-canonical ROADMAP Phase Details heading/
  );
});

test("parseRoadmapDocument keeps goal sources but only trusts list requirement clauses", () => {
  const parsed = parseRoadmapDocument(`# Roadmap: Fixture

## Milestone

- Active milestone: v3

## Overview

| Phase | Requirements |
|-------|--------------|
| 1 | TABLE-01 |
| 2 | TABLE-02 |

## Phases

- [ ] Phase 1: Discovery (Requirements: REQ-01, REQ-02)
  - Objective: Keep child-bullet goal support.
  - Success Criteria:
    - Planner sees the canonical list clause.
    - Parser ignores overview-table requirements.
- [x] Phase 2: Validation

## Phase Details

### Phase 2: Validation
**Goal**: Preserve detail-body goals.
**Success Criteria**: Verification and UAT evidence are both present.
**Requirements**: DETAIL-02
`);

  assert.equal(parsed.milestone, "v3");
  assert.deepEqual(parsed.phases, [
    {
      phaseNumber: "1",
      phasePrefix: "01",
      phaseName: "Discovery",
      completed: false,
      summary: null,
      goal: "Keep child-bullet goal support.",
      successCriteria:
        "Planner sees the canonical list clause.; Parser ignores overview-table requirements.",
      requirements: ["REQ-01", "REQ-02"]
    },
    {
      phaseNumber: "2",
      phasePrefix: "02",
      phaseName: "Validation",
      completed: true,
      summary: null,
      goal: "Preserve detail-body goals.",
      successCriteria: "Verification and UAT evidence are both present.",
      requirements: []
    }
  ]);
});
