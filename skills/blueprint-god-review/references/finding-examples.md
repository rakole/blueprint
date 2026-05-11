# God Review Finding Examples

Use these examples only after the hidden activation guard has passed. They are
calibration examples, not a template to copy mechanically. Prefer the repo's
actual contracts, source, tests, command output, and durable hidden report.

## Strong Actionable Finding Template

Title: Review continuation accepts stale session scope
Severity: high
Confidence: high
Disposition: follow-up
Fix Eligibility: eligible
Files/Evidence:
- `src/runtime/session-store.ts:88` recomputes files from the current roadmap.
- `src/runtime/session-store.ts:126` compares only the previous group id.
- `tests/session-continuation.test.ts` has no case where a scoped file changes
  after the session starts.
Impact: a later lane can review files that were not in the frozen session,
making findings unrepeatable and unsafe for fix mode.
Recommendation: compare the saved fingerprint before returning the next group
and return a stale no-edit result when it changes.
Counterexample Checked: caller validation only confirms the run id exists; it
does not compare the frozen file set or file content.

Why this is strong:
- It names a violated invariant.
- It shows the exact reachable path.
- It explains user/state impact.
- It includes a bounded fix and a checked counterexample.

## Weak Finding To Drop

Claim: This helper is complicated and should be refactored.
Evidence offered: the function is long.
Why to drop:
- No behavior, state, security, performance, or maintainability failure is
  shown.
- No duplicate policy, divergent abstraction, or future-change risk is tied to
  a concrete path.
- The claim is taste unless the lane can show a real defect or likely
  regression.

Better outcome: omit it. If there is a real issue, restate it as a precise
failure, such as "two validators accept different path forms for the same
artifact" with evidence from both validators.

## Unsupported Hypothesis To Drop

Claim: This endpoint probably leaks private state when the caller is
unauthenticated.
Evidence offered: the function name contains `public` and returns JSON.
Counterexample checked:
- `src/http/routes.ts:44` attaches `requireSession` before the handler.
- `src/http/serializers.ts:81` strips private fields from the response.
- `tests/routes-auth.test.ts` rejects unauthenticated access for this route.
Correct outcome: drop the finding. The hypothesis was worth checking, but the
counterexample is stronger than the claim.

Why this is not an observation:
- It does not identify a remaining weakness.
- It would waste maintainer attention by preserving a disproven suspicion.
- A later security lane may revisit only if new evidence changes the reachability
  or serialization path.

## Observation Example

Title: Tests cover happy-path report append but not warning text stability
Severity: low
Confidence: medium
Disposition: observation
Fix Eligibility: ineligible
Files/Evidence:
- `tests/report-append.test.ts` asserts status and ids.
- No test asserts the warning emitted for skipped generated files.
Impact: this may make future diagnostics less helpful, but it does not prove a
runtime defect or unsafe state transition.
Recommendation: consider adding a focused warning assertion when touching this
area again.

Why this is an observation:
- It is useful review signal.
- It is not proven to break behavior.
- It should not drive hidden fix mode by default.

## Accepted Risk Example

Title: Private report keeps accepted-risk entries visible after cleanup
Severity: medium
Confidence: high
Disposition: accepted-risk
Fix Eligibility: ineligible
Files/Evidence:
- `docs/decisions/review-retention.md` says private audit reports are retained
  for traceability after temporary state cleanup.
- `src/runtime/cleanup.ts:144` deletes only session JSON and human state.
Impact: retained reports may include internal file paths, but this is the
documented retention policy for private review runs.
Recommendation: preserve the report and cite the decision in terminal output.

Why this is accepted risk:
- The risk is real.
- The provenance is explicit.
- Hidden fix mode should not remove it.

## Duplicate Root Cause Merge Example

Original findings:
- `GOD-COR-002`: phase route points to the wrong next command.
- `GOD-OPS-001`: progress output recommends the same wrong command.

Merge decision:
- Keep the finding with the strongest source-of-truth evidence.
- Merge the second as supporting evidence if both come from the same stale
  route derivation helper and require the same fix.
- Keep separate findings only if one requires a different remediation, such as
  a public-resource trim plus a runtime route fix.

Retained note:
Duplicate root cause: both findings come from `deriveNextAction(...)` using the
old saved command field instead of recomputed gate state.

## Stale No-Edit Fix Example

Selection result: stale
Finding: `GOD-DAT-001`
Files/Evidence:
- Saved finding cites `src/state.ts:42` and snippet `nextAction = saved.next`.
- Current file no longer contains that snippet.
Correct outcome:
- Do not edit source.
- Record a no-edit remediation entry with status `stale`.
- Tell the user to restart hidden review for a fresh scope.

Wrong outcome:
- Guess the new location from current git drift.
- Edit a nearby file anyway.
- Mark the finding fixed without the saved evidence still matching.

## Security/Auth Example

Title: Public resource exposes private tool ids
Severity: high
Confidence: high
Disposition: follow-up
Fix Eligibility: eligible
Files/Evidence:
- `src/resources/runtime-contract.ts:210` serializes all registered tool names.
- The public `code-review` resource includes `private_review_start`.
Impact: hidden implementation details become model-visible public guidance and
may route ordinary review into private flows.
Recommendation: trim private tool ids from public resources while keeping MCP
handler activation checks.
Counterexample Checked: command manifests are not the tested public resource;
the leak is in the runtime-contract payload.

## Data/State Example

Title: Cleanup can delete normal workflow state through a tampered session
Severity: critical
Confidence: high
Disposition: follow-up
Fix Eligibility: eligible
Files/Evidence:
- `src/cleanup.ts:77` deletes `session.humanStatePath` without constraining it.
- A valid session JSON can set `humanStatePath` to `.blueprint/STATE.md`.
Impact: cleanup can destroy normal Blueprint workflow state.
Recommendation: validate session-owned paths against generated private state
paths before deletion.

## Tests Example

Title: Activation tests miss raw-command mismatch
Severity: medium
Confidence: high
Disposition: follow-up
Fix Eligibility: eligible
Files/Evidence:
- `tests/private-activation.test.ts` covers missing flag and wrong active
  command.
- It does not cover `activeCommand` set to the private command while raw text
  starts with another command.
Impact: private handlers can be called with inconsistent invocation context.
Recommendation: reject mismatched raw command and add a regression test.

## Operations/Delivery Example

Title: Runtime source change does not refresh bundled server output
Severity: high
Confidence: high
Disposition: follow-up
Fix Eligibility: eligible
Files/Evidence:
- `src/runtime/private-review.ts` changed handler validation.
- `dist/mcp/server.js` still contains the previous validation branch.
- Built-asset smoke tests launch `dist/mcp/server.js`.
Impact: installed extension behavior differs from source and tests against the
source path can give false confidence.
Recommendation: rebuild tracked runtime assets and run built-assets smoke tests.
