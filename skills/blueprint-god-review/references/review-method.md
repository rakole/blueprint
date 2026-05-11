# God Review Method

Use this file only after the hidden activation guard in
`skills/blueprint-god-review/SKILL.md` has passed.

## Fresh-Context Loop

- Treat each invocation as a fresh review pass for exactly one returned group.
- Start from the MCP-returned session, scope, files, `nextGroupId`, and
  `scopeFingerprint`; do not widen from memory, normal review artifacts, or
  current git drift.
- Reconstruct intent from the smallest durable inputs: scope metadata, relevant
  command contract, changed files, adjacent tests, and the files named by the
  session.
- Record uncertainty explicitly. Do not convert a hunch into a finding because
  an earlier pass hinted at it.

## Broad Scan, Then Focused Read

- First scan the whole returned file set, file names, test names, imports,
  public APIs, and obvious boundary files. Build a short map of likely risk
  areas for the active group.
- Then read the high-risk files deeply, including callers, callees, schemas,
  persistence helpers, tests, and docs only when they are needed to prove or
  disprove a concrete hypothesis.
- Read tests early when behavior is unclear; tests often reveal intended
  contracts faster than implementation prose.
- If a file is in scope but not useful for the active group, mark it skipped
  with a reason instead of pretending it was reviewed.

## Skeptical Hypothesis Loop

- Form one hypothesis at a time: "This path violates contract X under input Y."
- Look for counterexamples before writing the finding: validation, caller
  guarantees, feature flags, defaults, retries, test fixtures, and migration
  paths.
- Prefer execution-shaped evidence: exact branch, input shape, state transition,
  line reference, existing test gap, or failing command.
- Drop the issue when the counterexample is stronger than the claim. Downgrade
  to an observation when the risk is plausible but not proven.

## One-Group Discipline

- Review only the returned group. Do not opportunistically file security,
  testing, performance, or architecture findings during another lane unless the
  issue is required evidence for the active lane.
- Use the active lane prefix for every finding ID. Numbering starts at `001` per
  prefix in the durable report.
- End the invocation after persisting that group. Do not continue into the next
  group even when context remains.

## Terminal Curation Mindset

- The final report should be useful to a maintainer who was not present for the
  review. Keep findings few, concrete, and actionable.
- Prefer one strong finding over several overlapping weak ones.
- Preserve positive signals and uncertainties when they prevent future
  re-review churn.
- Make omissions visible: skipped generated files, missing tests, missing
  credentials, unavailable PR metadata, or oversize files should appear in the
  group notes.
