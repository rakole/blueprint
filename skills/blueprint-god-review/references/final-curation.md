# God Review Final Curation

Use this file only after the hidden activation guard in
`skills/blueprint-god-review/SKILL.md` has passed and review mode has reached
terminal review status. Terminal review status means the hidden MCP state says
there is no pending group because every group is complete or blocked.

Do not use this file for ordinary lane passes, hidden fix selection, or public
review mode.

## Terminal Review Preflight

- Read the durable hidden god-review report if the current invocation does not
  already contain every group result needed for terminal curation.
- Confirm the terminal basis before curating: every expected hidden group is
  recorded as complete or blocked, or the session itself is terminal-blocked.
- Never invent missing groups, assumed lane results, findings, counts, or
  remediation status. If a group is missing from the durable report, name it as
  blocked or omitted evidence instead of filling it in.
- If the terminal state is blocked, explain the blocking condition, the groups
  already reviewed, the groups not reviewed, and the safest continuation or
  stop action returned by hidden state.
- Treat hidden MCP state, durable report entries, and persisted lane evidence as
  the only authority. Do not widen from normal review artifacts, chat memory,
  current git drift, or ordinary Blueprint state.

## Dedupe Protocol

- Merge duplicate findings that share the same root cause, affected contract,
  and practical remediation, even when different lanes discovered them.
- Keep the strongest evidence chain: exact files, line references, command
  output, schema mismatch, persisted payload, or runtime contract proof.
- Preserve useful duplicate IDs as aliases or supporting notes, not as separate
  actionable findings.
- Do not create new findings during curation unless a lane already recorded
  concrete evidence for that finding. Curation may clarify, merge, drop, or
  reclassify lane findings; it may not invent a new issue from synthesis alone.
- When two findings overlap but require different fixes, keep them separate and
  state why they are not duplicates.

## Severity Reconciliation

- Choose final severity by demonstrated impact: user-visible behavior,
  security/privacy exposure, data loss or state corruption, lifecycle breakage,
  operational blast radius, and realistic reachability.
- Downgrade claims whose impact, reachability, or affected contract is not
  proven by lane evidence.
- Upgrade only when evidence shows broader impact than the originating lane
  recognized, such as a local bug crossing into public routing, private data
  exposure, or durable state corruption.
- Keep confidence separate from severity. A high-impact but unproven concern is
  not automatically high severity; it may be `unknown`, `blocked`, or an
  observation with low or medium confidence.
- Do not let lane identity decide severity. Security, tests, architecture, and
  operations findings all use the same impact and reachability standard.

## Weak-Finding Rejection

- Drop speculation that lacks a reachable path, violated contract, concrete
  evidence, or credible user/security/state/delivery impact.
- Reclassify pure taste, style preference, naming preference, or local
  refactor desire as no finding unless it has concrete maintainability impact.
- Reject unsupported missing-test claims unless the missing test would catch a
  realistic regression tied to specific behavior.
- Collapse duplicate-only items into the retained finding's supporting notes.
- Reclassify non-actionable style notes, vague concerns, and broad best-practice
  statements as observations only when they are useful; otherwise omit them.
- Keep accepted risks separate from rejected weak findings when a real risk has
  an explicit source or maintainer decision.

## Cross-Lane Synthesis

- Summarize cross-lane themes only after dedupe and weak-finding rejection, so
  the theme list reflects accepted risks and observations rather than noise.
- Name the shared failure mode, affected area, and representative evidence
  rather than repeating every lane's wording.
- Highlight patterns that change the next safest human action, such as "fix one
  shared parser before addressing three downstream test failures."
- Include positive signals only when they materially reduce review uncertainty
  or prevent wasted follow-up.
- Do not update normal `STATE.md`, normal review quality gates, normal
  `XX-REVIEW.md`, normal `XX-REVIEW-FIX.md`, or public docs as part of
  synthesis.

## Terminal Response Shape

Return a concise terminal hidden review response with these sections:

- `Terminal Status`: hidden run id or session id when available, terminal basis,
  reviewed groups, blocked groups, and omitted groups if any.
- `Finding Counts`: counts by final severity and disposition after dedupe,
  rejection, accepted-risk handling, and observation handling.
- `Top Risks`: the highest-severity actionable follow-ups, each with final
  severity, confidence, retained finding id, strongest evidence, and fix
  eligibility.
- `Accepted Risks And Observations`: accepted risks and useful observations that
  should not be treated as required fixes.
- `Blocked Or Omitted Evidence`: unavailable groups, missing durable evidence,
  skipped files, failed commands, oversize context, or uncertainty that limits
  confidence.
- `Cross-Lane Themes`: short themes that connect accepted findings across
  lanes and explain why they matter.
- `Next Hidden Action`: the exact hidden continuation, hidden fix, or stop
  command when applicable. If no follow-up findings are eligible, say that the
  hidden review is terminal and no hidden fix command is applicable.

Keep terminal output useful for a maintainer: fewer repeated findings, clear
priorities, explicit uncertainty, and exact next action.

## No-Side-Effect Curation

- Final curation is prompt-level only. It may read private hidden state and the
  durable hidden report, then produce terminal output.
- It may not rewrite normal review artifacts, create or modify
  `XX-REVIEW.md`, create or modify `XX-REVIEW-FIX.md`, update normal
  `STATE.md`, update quality gates, or mutate public command/docs surfaces.
- It may not create commits, branches, PRs, staged changes, worktrees, tags,
  releases, or host-global state.
- It may not call normal review record or review-fix record tools.
- It may not broaden hidden fix eligibility beyond the persisted findings and
  hidden fix selection rules.
