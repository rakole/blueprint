# God Review Finding Quality

## Admission Standard

Admit a finding only when it has all of these:

- A specific violated contract, risk, or behavior.
- Concrete evidence from code, tests, command output, schema, persisted state,
  or public/private surface payloads.
- A credible impact on users, maintainers, security, state integrity, delivery,
  or future safe change.
- A bounded recommendation or remediation handoff.
- Clear uncertainty when the evidence is incomplete.

Do not admit a finding for taste, speculation, generic best practice, or a
missing test that cannot catch a realistic defect.

## Severity

- `critical`: exploitable security loss, data loss, destructive operation, or
  public lifecycle break with immediate high blast radius.
- `high`: likely incorrect behavior, security/privacy leak, state corruption,
  or broken workflow for a supported path.
- `medium`: real defect with bounded blast radius, recoverable failure, or
  maintainability issue likely to cause near-term regressions.
- `low`: minor correctness, clarity, or robustness issue with limited impact.
- `unknown`: plausible issue where impact or reachability cannot be proven from
  available evidence.

## Confidence

- `high`: directly proven by source and contract, test output, reproduction, or
  deterministic payload.
- `medium`: strongly supported by source and surrounding context, but one
  assumption remains.
- `low`: plausible but missing key reachability, ownership, or runtime evidence.

Low-confidence items usually become observations or uncertainties, not
follow-up findings.

## Disposition

- `follow-up`: actionable defect that should be fixed or explicitly accepted.
- `observation`: useful signal, weakness, or test gap that is not proven enough
  to block.
- `blocked`: review could not decide because required context or environment
  was unavailable.
- `accepted-risk`: the risk is real but intentionally tolerated; include the
  reason and provenance.

## Fix Eligibility

Use `Fix Eligibility: eligible` only when:

- The finding is `follow-up`.
- The target files are explicit and still in the frozen scope or selected fix
  target set.
- The remediation is local enough for a bounded fix pass.
- The finding is not stale, duplicate-only, accepted-risk, or blocked.
- Verification can be named without inventing unrelated workflow.

Use `Fix Eligibility: ineligible` for accepted risks, observations, ambiguous
design choices, cross-cutting migrations, missing external context, or fixes
that would require normal review-fix lifecycle side effects.

## Duplicate Handling

- Keep the strongest finding and merge supporting evidence into it.
- Preserve aliases or duplicate IDs only as notes in the durable report.
- Do not create separate findings for the same root cause across lanes unless
  each lane has a distinct actionable remediation.
- If a later lane discovers the same issue with better evidence, reference the
  earlier finding and mark the later item as duplicate or supporting context.

## Accepted Risk, Observation, And Follow-Up

- `accepted-risk` requires a concrete source: existing contract, comment,
  config, user instruction, prior artifact, or explicit maintainer decision.
- `observation` may describe weak evidence, positive signals, test gaps, or
  non-blocking maintainability concerns. It must not be phrased as a required
  fix.
- `follow-up` must include file/line evidence where possible, impact,
  recommendation, severity, confidence, and fix eligibility.

## No-Edit Fix Outcomes

In hidden fix mode, stale, invalid, empty, accepted-risk, duplicate-only, or
ineligible selections must remain no-edit outcomes. Record the reason in the
remediation log and do not stage changes, create commits, create PRs, update
normal review artifacts, or change quality gates.
