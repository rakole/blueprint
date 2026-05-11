# God Review Lane Rubrics

Use exactly the active group returned by the hidden god-review session. Each
lane below lists what to inspect, acceptable evidence, false-positive traps, and
finding examples.

## COR / correctness-contracts

Inspect:
- Runtime behavior against command manifests, MCP schemas, artifact contracts,
  documented invariants, backwards compatibility, and edge-case inputs.
- Cross-layer parity between source, tests, generated artifacts, and user-facing
  behavior.

Evidence:
- A concrete input or state shape that reaches the wrong branch.
- A contract line, schema field, persisted artifact, or test fixture that the
  implementation violates.

False-positive traps:
- Treating old docs as normative when runtime metadata is the source of truth.
- Ignoring caller-side validation or intentionally accepted compatibility
  behavior.

Finding examples:
- `GOD-COR-001`: Tool accepts a model that the write path later rejects.
- `GOD-COR-002`: Continuation command points to the wrong next step after a
  terminal state.

## SEC / security-privacy-auth

Inspect:
- Authorization checks, path containment, prompt-boundary handling, credential
  exposure, private/public surface separation, and untrusted input parsing.
- Data minimization for public resources, logs, reports, and error messages.

Evidence:
- A reachable path where untrusted input crosses a boundary without validation.
- A public payload that includes private flags, paths, tool ids, secrets, or
  user data beyond its contract.

False-positive traps:
- Reporting theoretical injection without a sink or trust boundary.
- Treating test-only fixtures or private internal reports as public exposure.

Finding examples:
- `GOD-SEC-001`: Public runtime-contract resource leaks a private skill path.
- `GOD-SEC-002`: Write tool allows traversal outside `.blueprint/`.

## DAT / data-state-consistency

Inspect:
- State ownership, session reuse, fingerprint checks, idempotency, append-only
  records, stale detection, concurrency, and durability under partial failure.
- Consistency between Markdown reports, JSON session state, and any parser that
  consumes them later.

Evidence:
- A state transition that loses data, rewrites history, reads the wrong source
  of truth, or treats stale scope as current.
- Parser evidence showing that a written report cannot be consumed by fix mode.

False-positive traps:
- Requiring transactional behavior for intentionally best-effort advisory
  paths.
- Confusing normal Blueprint `STATE.md` with private god-review state.

Finding examples:
- `GOD-DAT-001`: Continuation recomputes scope instead of using frozen session
  files.
- `GOD-DAT-002`: Fix parser drops accepted-risk entries and shifts finding IDs.

## REL / reliability-failure-handling

Inspect:
- Error handling, retry boundaries, blocked states, filesystem failures,
  external command failures, cleanup behavior, and recovery messages.
- Whether no-edit outcomes remain no-edit when selection is stale, invalid, or
  empty.

Evidence:
- A failing command, thrown error, or mocked failure that leaves hidden state
  inconsistent or hides the actionable recovery path.
- A cleanup or terminal path that deletes durable reports or remediation logs.

False-positive traps:
- Demanding automatic recovery when the safer behavior is an explicit stop.
- Treating a deliberate blocked status as a crash.

Finding examples:
- `GOD-REL-001`: Cleanup deletes the durable god-review report after terminal
  fix mode.
- `GOD-REL-002`: Stale selection still permits source edits.

## TST / tests-validation

Inspect:
- Regression tests for activation guard, public leak avoidance, session
  lifecycle, parser behavior, stale detection, severity/disposition defaults,
  and fix evidence recording.
- Verification commands named by the implementation and whether they would fail
  for the defect being reviewed.

Evidence:
- A missing or weak test tied to a realistic regression path.
- A test that asserts only shape while missing behavior, ordering, or
  non-interference.

False-positive traps:
- Asking for broad full-suite coverage when a focused test already locks the
  relevant contract.
- Treating unreachable defensive branches as mandatory coverage.

Finding examples:
- `GOD-TST-001`: Public leak tests do not scan runtime-contract resources.
- `GOD-TST-002`: Fix selection tests omit stale fingerprint behavior.

## ARC / architecture-maintainability

Inspect:
- Boundary clarity, module ownership, abstraction size, duplication,
  readability, naming, maintainability, and whether private god-review logic is
  isolated from normal review lifecycle code.
- Whether long guidance belongs in private references instead of the active
  skill body.

Evidence:
- Two or more code paths implementing the same policy differently.
- A module boundary violation that makes future fixes likely to break public
  review behavior.

False-positive traps:
- Preferring a new abstraction when local duplication is small and safer.
- Calling style differences a defect without maintainability impact.

Finding examples:
- `GOD-ARC-001`: Public review skill owns hidden activation logic.
- `GOD-ARC-002`: Finding ID normalization is duplicated with divergent rules.

## PER / performance-scale-cost

Inspect:
- Scope loading cost, file reads, large diffs, parser complexity, repeated
  command execution, caching, and behavior on large repositories or PRs.
- Whether context selection stops cleanly when input is too large to review
  honestly.

Evidence:
- Complexity analysis, repeated expensive operation in a loop, measured command
  output, or a realistic large-scope scenario.
- A path that loads whole-repo context when a returned scope exists.

False-positive traps:
- Micro-optimizing one-time setup paths.
- Treating bounded private review work as hot production request traffic.

Finding examples:
- `GOD-PER-001`: Every continuation rereads all report history before selecting
  the next group.
- `GOD-PER-002`: Current-diff scope shells out once per file instead of once per
  diff.

## OPS / operations-delivery

Inspect:
- Install/runtime compatibility, generated asset expectations, environment
  assumptions, observability, logs, migration safety, rollback safety,
  documentation boundaries, developer experience, accessibility/localization
  only when the touched surface makes them relevant.
- Whether public surfaces remain implemented-only and private behavior remains
  discoverable only through the hidden activation path.

Evidence:
- A concrete runtime, host, CI, or deployment scenario that fails.
- A missing operational guard that can mutate host-global state, installed
  extension directories, branches, commits, PRs, or normal Blueprint artifacts.

False-positive traps:
- Asking for public documentation of intentionally hidden behavior.
- Reporting absent telemetry for purely local private workflows unless it
  blocks diagnosis or recovery.

Finding examples:
- `GOD-OPS-001`: Hidden fix mode creates a PR without explicit user request.
- `GOD-OPS-002`: Runtime host path assumptions fail under Tabnine extension
  launch.
