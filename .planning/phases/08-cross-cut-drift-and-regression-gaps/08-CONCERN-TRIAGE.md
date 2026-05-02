# Phase 8 Concern Triage

Discovery-only artifact. This triage records Phase 8 concern-map evidence without fixing source, tests, docs, manifests, generated assets, runtime state, or git history.

| Concern | Evidence Checked | Impact Class | Disposition | Related Bug Or Note |
|---|---|---|---|---|
| Regex-driven Markdown parsing | `tests/artifact-contracts.test.ts` and `tests/artifact-validate-runtime.test.ts` passed, and no concrete wrong-section parse or unintended mutation was reproduced during the targeted source review. | parser drift risk | non-bug risk note | Keep shared parser hardening on the Phase 9 watchlist |
| Deep-clone via JSON stringify/parse | `src/mcp/tools/phase.ts`, `src/mcp/tools/artifacts.ts`, and `src/mcp/tools/impact.ts` still use JSON cloning helpers, but the current data models and tests stay JSON-shaped and deterministic. | performance and type-loss risk | non-bug risk note | Phase 9 tech-debt follow-up |
| Schema validation configured permissively | `src/mcp/tools/impact.ts` still uses `.passthrough()`, but `tests/impact-tools.test.ts` covers malformed config, structured unknowns, and low-confidence handling. | schema compatibility and warning path | aligned | none |
| Test-only failure injection toggles | `src/mcp/tools/workspace.ts` still honors `BLUEPRINT_TEST_*` env vars in shared runtime code, and `tests/workspace-tools.test.ts` uses them for fixture control. | environment-sensitive workspace mutation | deferred uncertainty | Deliberate `BLUEPRINT_TEST_*` activation remains a low-signal risk note, not a new confirmed user defect |
| Repo-root detection is existence-based only | `src/mcp/tools/artifacts.ts` implements `ensureRepoRoot()` as a `.git`-presence check only, and a disposable probe with a fake `.git` file returned the temp directory as a valid repo root. | repository-boundary contract violation | confirmed bug | BPBUG-005 |
| Path containment TOCTOU/symlink edges | `tests/security-hardening.test.ts` passed, and `ensurePathWithinRootSync()` plus repo-relative path resolution still re-check containment on the current path state. | filesystem race risk | non-bug risk note | Residual TOCTOU risk remains theoretical in current evidence |
| Destructive filesystem operations | Workspace and patch replay have behavior tests plus explicit blockers; cleanup still retains the already-known regression-gap bug. | destructive mutation safety | aligned | BPBUG-002 remains the specific cleanup coverage defect |
| Network access in update checks | `src/mcp/tools/update.ts` keeps lookup best-effort, GitHub-remote-derived, timeout-bounded, and advisory-only. | best-effort remote metadata | aligned | none |
| Prompt-boundary heuristics | `tests/security-hardening.test.ts` covers hidden-control-character stripping and unsafe prompt-boundary rejection before persistence. | prompt-injection containment | aligned | none |
| Impact dependency scanning | `tests/impact-tools.test.ts` covers reverse-dependency unknowns, confidence reductions, and advisory blocking behavior. | performance and confidence risk | non-bug risk note | Keep large-repo tuning in Phase 9 |
| Impact large diff processing | Scope-resolution tests cover diff parsing and low-confidence fallbacks, but no pathological-size performance harness was run in Phase 8. | large-input scaling risk | deferred uncertainty | Phase 9 performance review |
| Large artifact validation regex passes | Artifact-validation suites passed, and no concrete mis-parse was reproduced, but repeated full-document regex passes remain a cost concern. | validation performance risk | non-bug risk note | Phase 9 performance review |

## Decision Coverage

- `D-09` Phase 8 explicitly triaged the major concern-map leads across parser, schema, filesystem, security, and scaling behavior.
- `D-10` Only the repo-root guard crossed the confirmed-bug threshold; the remaining leads stayed as aligned results, non-bug notes, or deferred uncertainty.
- `D-11` Static source review and focused existing tests stayed the primary evidence path, with one disposable probe used only to resolve the repo-root ambiguity.
- `D-12` Security, TOCTOU, and destructive-filesystem concerns stayed below the bug threshold without concrete exploitability or current contract violation evidence.
- `D-17` Phase 8 preserved the earlier evidence bar by requiring exact source, test, or probe evidence for every disposition.
- `D-18` No source, manifest, skill, test, generated-asset, runtime, branch, PR, remote, or host-global fix was applied while triaging these concerns.
- `D-19` The only disposable probe used a temporary directory with a fake `.git` file and was removed immediately after the check.
- `D-20` No planned-only or non-routable Blueprint command is recommended as the fix path for any concern-map outcome.
