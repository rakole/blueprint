# Portable map study analysis

`portable-map-study-analysis.mjs` is a pure, dependency-free reducer for
canonical observed study rows. It performs schema validation, expected-cell
accounting, matched arm comparisons, and descriptive uncertainty. It does not
read study artifacts, start participants, grade output, or persist results.

```js
import { analyzeStudy } from "./portable-map-study-analysis.mjs";

const result = analyzeStudy(observations, {
  study: "pilot",
  expectedTasks: [{ corpus: "typescript", taskId: "task-1", taskClass: "research", knownTarget: false }],
  repeats: 2,
  arms: ["blueprint-legacy", "blueprint-compact", "blueprint-portable", "standalone-source", "standalone-portable"],
  seed: "frozen-wave22",
  bootstrapReplicates: 2_000,
  minimumTokenReduction: 0.20,
  completionNoninferiorityMargin: 0.05,
  rubricNoninferiorityMargin: 0.05,
  navigationEvidence: {
    measured: true,
    firstUsefulImprovement: true,
    mapValueVsCompact: true,
    standaloneBenefit: true
  }
});
```

Each row must contain the v1 fields `runId`, `study`, `corpus`, `taskId`,
`taskClass`, `knownTarget`, `repeat`, `arm`, `status`, `provenance`, `usage`,
and `quality`. Provenance hashes are retained as metadata only. Usage requires
`totalTokens === inputTokens + outputTokens`; cached input and reasoning output
are validated as subsets and are reported separately from total tokens. A null
usage or quality value is visible missing data and is never converted to zero,
success, or a grade.

SHA-named provenance fields must be lowercase hexadecimal SHA-256 values. Rows
must match the expected task class and known-target metadata. Paired inference
also requires equal source-manifest, task-dataset, protocol, and toolchain
provenance; arm-specific runtime, map, guidance, and prompt hashes may differ.

The three comparisons are reported independently: `portableVsLegacy`,
`portableVsCompact`, and `standalonePortableVsSource`. Rows are matched by
`corpus/taskId/repeat`; descriptive bootstrap samples resample
repository-then-task clusters, so repeats do not become independent tasks and
multiple tasks in one repository do not masquerade as independent repositories.
Completion and rubric differences include the one-sided 95% finite bounded
difference interval for values in `[-1, 1]` and a hierarchical repository/task
bootstrap. A zero-discordance bootstrap interval of `[0, 0]` is therefore
accompanied by a non-zero finite bound and cannot by itself establish quality
parity. Rubric parity is reported as supported only when that finite interval
lies inside the preregistered margin.

`overhead.p90Tokens` is the 90th percentile of actual paired-run left-arm minus
right-arm total tokens. A separate task aggregate is exposed for comparison.
It is a descriptive token proxy, not model latency or a billable-token claim.
`accounting.participant` is the deduplicated charged ledger and includes failed,
interrupted, retry, and unexpected observed runs. Inference still uses only
unique, unambiguous expected cells. When any participant usage is missing, complete
`totalTokens` and subset totals are null while `observed*Tokens` subtotals show
the rows that were actually measured; helper, parent, and map scopes remain explicit
`unavailable` values until separately observed.

Each comparison exposes the median paired downstream reduction, its hierarchical
interval, and the aggregate total reduction separately. The legacy gate requires
an observed median at least the preregistered 20% and an interval supporting a
positive reduction. Compact and standalone comparisons use separate positive
median evidence and navigation requirements; they do not reuse the legacy 20%
rule. Navigation evidence is an explicit design prerequisite.

The default `disposition` is `decision-ready` only when every expected cell is
unique and present, all usage and quality values are observed, all three
comparisons are designed, and their preregistered gates pass. Missing,
duplicate, invalid, or unexpected rows produce `incomplete`; uncertain finite
bounds or unmet token reduction produce `inconclusive`. A caller may explicitly
set `allowIncomplete: true` or `allowInconclusive: true` in the design to
request an `*-opt-in` exploratory disposition, while `decisionAllowed` remains
false until the default gate passes.

The analysis is intentionally limited to descriptive observed results and
does not establish causality, production performance, hidden model retention,
or equivalence from a small number of repositories. Synthetic tests cover
invalid usage, missing and duplicate cells, failed participant accounting,
paired positive and negative differences, finite-sample uncertainty, p90
overhead, strata, and the zero-discordance quality case.
