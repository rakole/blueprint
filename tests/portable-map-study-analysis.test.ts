import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeStudy,
  bootstrapMean,
  finiteBound,
  quantile,
  validateDesign,
  validateObservation
} from "../scripts/portable-map-study-analysis.mjs";

const arms = [
  "blueprint-legacy",
  "blueprint-compact",
  "blueprint-portable",
  "standalone-source",
  "standalone-portable"
];

const provenance = {
  sourceManifestSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  mapManifestSha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  taskDatasetSha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  runtimeServerSha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  adapterSha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  evaluatorSha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  protocolSha256: "1111111111111111111111111111111111111111111111111111111111111111",
  promptSha256: "2222222222222222222222222222222222222222222222222222222222222222",
  guidanceSha256: "3333333333333333333333333333333333333333333333333333333333333333",
  toolchain: "synthetic"
};

function design(overrides: Record<string, unknown> = {}) {
  return {
    study: "pilot",
    expectedTasks: [
      { corpus: "typescript", taskId: "t1", taskClass: "research", knownTarget: false },
      { corpus: "python", taskId: "t2", taskClass: "implementation", knownTarget: true },
      { corpus: "java", taskId: "t3", taskClass: "review", knownTarget: false },
      { corpus: "typescript", taskId: "t4", taskClass: "testing", knownTarget: true }
    ],
    repeats: 2,
    arms,
    seed: "synthetic-wave22",
    bootstrapReplicates: 250,
    minimumTokenReduction: 0.2,
    completionNoninferiorityMargin: 0.05,
    rubricNoninferiorityMargin: 0.05,
    ...overrides
  };
}

function row(task, repeat, arm, overrides: Record<string, unknown> = {}) {
  return {
    runId: `${task.taskId}-${repeat}-${arm}`,
    study: "pilot",
    corpus: task.corpus,
    taskId: task.taskId,
    taskClass: task.taskClass,
    knownTarget: task.knownTarget,
    repeat,
    arm,
    status: "completed",
    provenance: { ...provenance },
    usage: {
      inputTokens: 100,
      cachedInputTokens: 20,
      outputTokens: 40,
      reasoningOutputTokens: 10,
      totalTokens: 140,
      monetaryCost: null
    },
    quality: {
      status: "graded",
      complete: true,
      rubricScore: 0.8,
      criteria: [1],
      criticalFailures: []
    },
    ...overrides
  };
}

function fullRows(studyDesign = design()) {
  return studyDesign.expectedTasks.flatMap((task) => Array.from({ length: studyDesign.repeats }, (_, repeatIndex) =>
    studyDesign.arms.map((arm) => row(task, repeatIndex + 1, arm))
  )).flat();
}

test("strict row and design validation rejects malformed usage, unknown fields, and duplicate tasks", () => {
  const malformed = row(design().expectedTasks[0], 1, arms[0], {
    extra: true,
    usage: {
      inputTokens: 2,
      cachedInputTokens: 3,
      outputTokens: 4,
      reasoningOutputTokens: 5,
      totalTokens: 99,
      monetaryCost: null
    }
  });
  const rowResult = validateObservation(malformed);
  assert.equal(rowResult.valid, false);
  assert.ok(rowResult.errors.some((item) => item.code === "unknown-field"));
  assert.ok(rowResult.errors.some((item) => item.code === "invalid-usage"));
  const designResult = validateDesign(design({
    expectedTasks: [design().expectedTasks[0], design().expectedTasks[0]]
  }));
  assert.equal(designResult.valid, false);
  assert.ok(designResult.errors.some((item) => item.code === "duplicate-design-task"));
});

test("missing, duplicate, and unexpected cells block the default gate and remain explicit", () => {
  const d = design({ repeats: 1 });
  const rows = fullRows(d);
  rows.pop();
  rows.push(rows[0]);
  rows.push(row(d.expectedTasks[0], 1, "blueprint-portable", { runId: "duplicate-portable" }));
  rows.push(row(d.expectedTasks[0], 99, "blueprint-portable", { runId: "unexpected-repeat" }));
  const result = analyzeStudy(rows, d);
  assert.equal(result.valid, false);
  assert.equal(result.status, "incomplete");
  assert.equal(result.disposition, "incomplete");
  assert.ok(result.diagnostics.duplicateCells.length >= 1);
  assert.ok(result.diagnostics.missingCells.length >= 1);
  assert.ok(result.diagnostics.unexpectedCells.length >= 1);
  assert.equal(result.decisionAllowed, false);
});

test("charged participant accounting keeps distinct retries while excluding ambiguous cells from inference", () => {
  const d = design({ repeats: 1 });
  const rows = fullRows(d);
  const original = rows[0];
  const retry = row(d.expectedTasks[0], 1, original.arm, {
    runId: "synthetic-paid-retry",
    usage: {...original.usage, inputTokens: 60, totalTokens: 100}
  });
  const exactDuplicate = {...original};
  const result = analyzeStudy([...rows, retry, exactDuplicate], d);
  assert.equal(result.accounting.participant.observedTotalTokens, rows.length * 140 + 100);
  assert.equal(result.accounting.chargedObserved.observedTotalTokens, rows.length * 140 + 100);
  assert.equal(result.accounting.observedCostLedger.chargedRetryRunIds.includes("synthetic-paid-retry"), true);
  assert.equal(result.accounting.observedCostLedger.chargedRetryRunIds.includes(original.runId), false);
  assert.equal(result.accounting.observedCostLedger.distinctRunIds, rows.length + 1);
  assert.equal(result.comparisons.portableVsLegacy.pairedRows, 3);
  assert.equal(result.diagnostics.duplicateCells.length, 1);
  assert.equal(result.diagnostics.duplicateRunIds.length, 1);
});

test("explicit incomplete opt-in changes disposition while retaining missing cost and grade evidence", () => {
  const d = design({ repeats: 1, allowIncomplete: true });
  const rows = fullRows(d);
  rows[0].usage = null;
  rows[1].quality = null;
  const result = analyzeStudy(rows, d);
  assert.equal(result.status, "incomplete");
  assert.equal(result.disposition, "incomplete-opt-in");
  assert.equal(result.decisionAllowed, false);
  assert.equal(result.exploratoryAllowed, true);
  assert.equal(result.diagnostics.missingUsage.length, 1);
  assert.equal(result.diagnostics.missingQuality.length, 1);
  assert.equal(result.accounting.participant.totalTokens, null);
  assert.equal(result.accounting.participant.observedTotalTokens, 140 * (rows.length - 1));
});

test("paired synthetic positive portable differences expose reductions and separate token subsets", () => {
  const d = design({ repeats: 1 });
  const rows = fullRows(d);
  for (const item of rows) {
    if (item.arm === "blueprint-portable" || item.arm === "standalone-portable") {
      item.usage.inputTokens = 50;
      item.usage.cachedInputTokens = 10;
      item.usage.outputTokens = 20;
      item.usage.reasoningOutputTokens = 4;
      item.usage.totalTokens = 70;
      item.quality.rubricScore = 0.8;
    } else {
      item.usage.inputTokens = 100;
      item.usage.cachedInputTokens = 20;
      item.usage.outputTokens = 40;
      item.usage.reasoningOutputTokens = 10;
      item.usage.totalTokens = 140;
      item.quality.rubricScore = 0.8;
    }
  }
  const result = analyzeStudy(rows, d);
  const comparison = result.comparisons.portableVsLegacy;
  assert.equal(comparison.tokens.totalTokenReduction, 0.5);
  assert.equal(comparison.tokens.left.totalTokens, 280);
  assert.equal(comparison.tokens.right.totalTokens, 560);
  assert.equal(comparison.tokens.left.cachedInputTokens, 40);
  assert.equal(comparison.tokens.left.reasoningOutputTokens, 16);
  assert.ok(comparison.overhead.p90Tokens < 0);
  assert.ok(comparison.strata.language.some((item) => item.value === "typescript"));
});

test("negative completion and quality differences cannot pass conservative noninferiority", () => {
  const d = design({ repeats: 3, bootstrapReplicates: 100 });
  const rows = fullRows(d);
  for (const item of rows) {
    if (item.arm === "blueprint-portable") {
      item.status = "failed";
      item.quality.complete = false;
      item.usage.inputTokens = 150;
      item.usage.totalTokens = 190;
    }
    if (item.arm === "standalone-portable") {
      item.status = "failed";
      item.quality = null;
    }
  }
  const result = analyzeStudy(rows, d);
  assert.equal(result.comparisons.portableVsLegacy.completion.nonInferiority.status, "incomplete");
  assert.equal(result.comparisons.portableVsLegacy.quality.nonInferiority.status, "incomplete");
  assert.ok(result.gate.reasons.includes("missing-quality"));
});

test("all-zero-discordance does not imply rubric parity because the finite bound remains non-zero", () => {
  const d = design({ repeats: 1, bootstrapReplicates: 100 });
  const result = analyzeStudy(fullRows(d), d);
  const quality = result.comparisons.portableVsLegacy.quality;
  assert.equal(quality.observedDifference, 0);
  assert.equal(quality.bootstrap.lower, 0);
  assert.equal(quality.bootstrap.upper, 0);
  assert.ok(quality.finiteSample.radius > 0);
  assert.equal(quality.parity.status, "inconclusive");
  assert.equal(quality.parity.zeroDiscordanceIsNotProof, true);
});

test("failed and interrupted rows stay in participant token accounting instead of becoming zero", () => {
  const d = design({ repeats: 1 });
  const rows = fullRows(d);
  rows[0].status = "failed";
  rows[1].status = "interrupted";
  const result = analyzeStudy(rows, d);
  assert.equal(result.accounting.participant.participantRows, rows.length);
  assert.equal(result.accounting.participant.rowsWithUsage, rows.length);
  assert.equal(result.accounting.participant.totalTokens, rows.length * 140);
  assert.equal(result.accounting.helper.totalTokens, null);
  assert.equal(result.accounting.parent.totalTokens, null);
  assert.equal(result.accounting.map.totalTokens, null);
  assert.equal(result.diagnostics.nonCompletedRows.length, 2);
  assert.ok(result.gate.reasons.includes("non-completed-rows"));
});

test("non-completed participants with complete grades cannot satisfy the release gate", () => {
  const expectedTasks = Array.from({length: 2400}, (_, index) => ({
    corpus: `corpus-${index}`,
    taskId: `task-${index}`,
    taskClass: "research",
    knownTarget: false
  }));
  const d = design({
    expectedTasks,
    repeats: 1,
    bootstrapReplicates: 1,
    navigationEvidence: {measured: true, firstUsefulImprovement: true, mapValueVsCompact: true, standaloneBenefit: true}
  });
  const rows = fullRows(d);
  for (const item of rows) {
    if (item.arm === "blueprint-portable" || item.arm === "standalone-portable") {
      item.usage.inputTokens = 60;
      item.usage.cachedInputTokens = 10;
      item.usage.outputTokens = 20;
      item.usage.reasoningOutputTokens = 5;
      item.usage.totalTokens = 80;
    }
  }
  const baseline = analyzeStudy(rows, d);
  assert.equal(baseline.decisionAllowed, true, JSON.stringify(baseline.gate));
  rows.find((item) => item.arm === "blueprint-portable" && item.taskId === "task-0")!.status = "failed";
  rows.find((item) => item.arm === "blueprint-legacy" && item.taskId === "task-1")!.status = "interrupted";
  const result = analyzeStudy(rows, d);
  assert.equal(result.status, "incomplete");
  assert.equal(result.decisionAllowed, false);
  assert.equal(result.diagnostics.nonCompletedRows.length, 2);
  assert.ok(result.gate.reasons.includes("non-completed-rows"));
  assert.equal(result.comparisons.portableVsLegacy.completion.pairedRows, 2398);
  assert.equal(result.comparisons.portableVsLegacy.quality.pairedRows, 2398);
  assert.equal(result.accounting.participant.participantRows, rows.length);
});

test("completion estimates require a valid quality pair in the same repeat", () => {
  const base = design();
  const d = design({
    expectedTasks: [base.expectedTasks[0]],
    arms: ["blueprint-legacy", "blueprint-portable"],
    repeats: 2
  });
  const rows = fullRows(d);
  rows.find((item) => item.arm === "blueprint-legacy" && item.repeat === 1)!.quality = null;
  rows.find((item) => item.arm === "blueprint-portable" && item.repeat === 2)!.quality = null;
  const comparison = analyzeStudy(rows, d).comparisons.portableVsLegacy;
  assert.equal(comparison.completion.observedDifference, null);
  assert.equal(comparison.completion.independentClusters, 0);
  assert.equal(comparison.completion.pairedRows, 0);
  assert.equal(comparison.quality.pairedRows, 0);
});

test("known critical failures remain descriptive when a failed row is excluded from paired quality", () => {
  const d = design({repeats: 1});
  const rows = fullRows(d);
  const portable = rows.find((item) => item.arm === "blueprint-portable" && item.taskId === "t1")!;
  portable.status = "failed";
  portable.quality.criticalFailures = ["known observed failure"];
  const comparison = analyzeStudy(rows, d).comparisons.portableVsLegacy;
  assert.equal(comparison.quality.pairedRows, d.expectedTasks.length - 1);
  assert.equal(comparison.quality.criticalFailures.left.rowsWithCriticalFailures, 1);
});

test("navigation gates distinguish missing measurement from measured lack of improvement", () => {
  const rows = fullRows(design({repeats: 1}));
  const unmeasured = analyzeStudy(rows, design({repeats: 1, navigationEvidence: {measured: false}}));
  assert.ok(unmeasured.gate.reasons.includes("navigation-evidence-unmeasured"));
  assert.equal(unmeasured.gate.reasons.includes("navigation-first-useful-not-improved"), false);
  const measuredNoImprovement = analyzeStudy(rows, design({repeats: 1, navigationEvidence: {measured: true, firstUsefulImprovement: false}}));
  assert.ok(measuredNoImprovement.gate.reasons.includes("navigation-first-useful-not-improved"));
  assert.equal(measuredNoImprovement.gate.reasons.includes("navigation-evidence-unmeasured"), false);
});

test("p90 overhead is descriptive and unavailable when either paired usage is missing", () => {
  const d = design({ repeats: 1 });
  const rows = fullRows(d);
  const portable = rows.find((item) => item.arm === "blueprint-portable" && item.taskId === "t1");
  portable.usage = null;
  const result = analyzeStudy(rows, d);
  const overhead = result.comparisons.portableVsLegacy.overhead;
  assert.equal(overhead.samples, 3);
  assert.equal(overhead.p90Tokens, 0);
  assert.equal(result.comparisons.portableVsLegacy.tokens.left.totalTokens, null);
  assert.equal(result.comparisons.portableVsLegacy.tokens.totalTokenReduction, 0);
  assert.equal(overhead.unavailableWhenUsageMissing, true);
  assert.ok(result.limitations.some((item) => item.includes("Participant usage")));
});

test("bootstrapMean is deterministic and clusters are represented by sample count", () => {
  const first = bootstrapMean([0, 1, 1], 50, "seed");
  const second = bootstrapMean([0, 1, 1], 50, "seed");
  assert.deepEqual(first, second);
  assert.equal(first.samples, 3);
  assert.equal(quantile([1, 3, 5], 0.5), 3);
  assert.equal(quantile([], 0.5), null);
});

test("unavailable comparisons stay separate when an arm is omitted from the explicit design", () => {
  const d = design({ arms: ["blueprint-legacy", "blueprint-portable"] , repeats: 1 });
  const rows = fullRows(d);
  const result = analyzeStudy(rows, d);
  assert.equal(result.comparisons.portableVsLegacy.available, true);
  assert.equal(result.comparisons.portableVsCompact.available, false);
  assert.equal(result.comparisons.standalonePortableVsSource.available, false);
  assert.ok(result.gate.reasons.includes("portable-vs-compact-not-designed"));
});

test("quality completion and critical failures block default adoption while opt-in stays exploratory", () => {
  const d = design({repeats: 1, allowIncomplete: true});
  const rows = fullRows(d);
  for (const item of rows) {
    item.quality.complete = false;
    if (item.arm === "blueprint-portable") item.quality.criticalFailures = ["map-attributable fixture failure"];
  }
  const result = analyzeStudy(rows, d);
  assert.equal(result.gate.defaultPass, false);
  assert.equal(result.decisionAllowed, false);
  assert.equal(result.exploratoryAllowed, true);
  assert.ok(result.gate.reasons.includes("portable-vs-legacy-critical-failure-left"));
  assert.equal(result.comparisons.portableVsLegacy.completion.leftRate, 0);
});

test("expected task metadata and shared provenance are required for paired inference", () => {
  const d = design({repeats: 1});
  const rows = fullRows(d);
  rows[0].taskClass = "testing";
  rows.find((item) => item.arm === "blueprint-legacy" && item.taskId === "t2").provenance.taskDatasetSha256 = "4444444444444444444444444444444444444444444444444444444444444444";
  const result = analyzeStudy(rows, d);
  assert.ok(result.diagnostics.metadataMismatches.length > 0);
  assert.ok(result.diagnostics.provenanceMismatches.length > 0);
  assert.ok(result.gate.reasons.includes("shared-provenance-mismatch"));
  assert.equal(result.comparisons.portableVsLegacy.pairedRows < d.expectedTasks.length, true);
});

test("finite bounded difference uses the full width two range", () => {
  const bound = finiteBound([1, -1]);
  assert.equal(bound.range[0], -1);
  assert.equal(bound.range[1], 1);
  assert.ok(bound.radius > 1);
});

test("aggregate reduction cannot replace median paired reduction with interval support", () => {
  const d = design({repeats: 2});
  const rows = fullRows(d);
  rows.filter((item) => item.arm === "blueprint-portable").slice(0, 2).forEach((item) => {
    if (item.arm === "blueprint-portable") {
      item.usage.inputTokens = 0;
      item.usage.outputTokens = 0;
      item.usage.cachedInputTokens = 0;
      item.usage.reasoningOutputTokens = 0;
      item.usage.totalTokens = 0;
    }
  });
  const result = analyzeStudy(rows, d);
  const tokens = result.comparisons.portableVsLegacy.tokens;
  assert.ok(tokens.totalTokenReduction >= 0.2);
  assert.equal(tokens.pairedReductionMedian, 0);
  assert.equal(tokens.reductionMeetsMinimum, false);
});

test("token interval resamples repeat vectors as task blocks and uses the pooled paired median estimand", () => {
  const d = design({repeats: 2, bootstrapReplicates: 100});
  const rows = fullRows(d);
  for (const item of rows) {
    if (item.arm === "blueprint-portable") {
      const reduction = item.repeat === 1 && item.taskId === "t1" ? 0.9 : 0;
      const total = Math.round(140 * (1 - reduction));
      item.usage.inputTokens = total - 40;
      item.usage.outputTokens = 40;
      item.usage.cachedInputTokens = 10;
      item.usage.reasoningOutputTokens = 5;
      item.usage.totalTokens = total;
    }
  }
  const result = analyzeStudy(rows, d);
  const interval = result.comparisons.portableVsLegacy.tokens.pairedReduction.medianInterval;
  assert.ok(interval.samples > 0);
  assert.ok(interval.samples <= result.comparisons.portableVsLegacy.tokens.pairedRowsWithUsage);
  assert.match(interval.method, /pooled paired-repeat median/u);
});
