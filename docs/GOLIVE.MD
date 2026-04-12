# Blueprint Go-Live

## Purpose

This document defines what is still pending before Blueprint should be treated as a public Gemini CLI extension.

It separates two kinds of pending work:

- functional product work
- installability and release work

Priority uses a simple MoSCoW split:

- `Must have`: required for a credible v1 public release
- `Good to have`: materially improves usability or release quality, but should not block the first public release
- `Could have`: valuable later expansion, parity, or hardening work

## Current Snapshot

As of 2026-04-12, the repo has a real extension runtime, not just planning docs:

- `gemini-extension.json`, `GEMINI.md`, `commands/`, `skills/`, `agents/`, and `hooks/hooks.json` all exist
- the MCP server and hooks build into `dist/`
- `npm test` passes with 125 passing tests
- the runtime command catalog currently reports 53 retained commands:
  - 22 `implemented`
  - 8 `repairing`
  - 23 `blocked`

What is already live:

- all Wave 0 foundation commands
- all Wave 1 core lifecycle commands
- most of Wave 2 roadmap-admin commands

What remains closest on the roadmap:

- `complete-milestone`
- `milestone-summary`
- `new-milestone`

## Must Have

### Functional

- Finish the remaining Wave 2 milestone closeout flow:
  - `complete-milestone`
  - `milestone-summary`
  - `new-milestone`
- Keep `insert-phase` explicitly non-routable unless its manifest and MCP substrate actually ship.
- Freeze the v1 public promise around the real shipped surface instead of the full retained command catalog.
  - Recommended v1 bar: Wave 0 + Wave 1 + Wave 2 milestone closeout.
  - Wave 3, Wave 4, and Wave 5 commands should stay documented as future work until they are actually implemented.
- Preserve the current implemented-only routing guarantees in `/blu`, `/blu:help`, and `/blu:progress`.
  - This already exists and should remain a release gate.

### Installability

- Make GitHub install repeatable from a clean checkout.
  - Release flow must always run `npm ci`, `npm run build`, and verify that `dist/mcp/*` and `dist/hooks/*` are current.
  - Blueprint's own Gemini constraints already require bundled `dist/` output before release.
- Add a real install smoke test in addition to the current repo-local tests.
  - Minimum path: install the extension, restart Gemini CLI, confirm `/blu` and `/blu:help` load, and execute at least one MCP-backed command successfully.
- Add release automation or a release checklist that enforces build, test, and artifact verification before a tag is published.
  - There is currently no `.github/` release workflow in this repo.
- Add `description` to `gemini-extension.json`.
  - Gemini CLI's extension reference uses this as the short listing text on `geminicli.com/extensions`.
- Publish from a public GitHub repository and tag releases from the canonical install source.
  - This is required for the intended install model: `gemini extensions install https://github.com/rakole/blueprint`.

## Good To Have

### Functional

- Finish the remaining Wave 2 ergonomic gap: `insert-phase`.
- Ship the near-adjacent lightweight execution surfaces that are useful without requiring the full later platform:
  - `fast`
  - `quick`
  - `do`
  - `add-tests`
- Start the capture layer once Wave 2 closes:
  - `note`
  - `add-todo`
  - `check-todos`
  - `add-backlog`
  - `review-backlog`
  - `explore`
  - `debug`

### Installability

- Add GitHub Releases packaging for faster installs than a full repository clone.
- Define an explicit release-channel model.
  - Recommended default: stable on the default branch, optional `dev` branch for preview installs via `--ref`.
- Expand README release/operator guidance:
  - install
  - update
  - restart requirement after install or update
  - command-conflict troubleshooting
  - MCP server startup troubleshooting
- Validate that agent-assisted flows degrade safely on the current Gemini CLI stable channel.
  - Blueprint ships `agents/`, while Gemini CLI still describes sub-agents as a preview surface.

## Could Have

### Functional

- Ship the rest of Wave 4 quality and shipping:
  - `code-review`
  - `code-review-fix`
  - `audit-fix`
  - `secure-phase`
  - `docs-update`
  - `ui-review`
  - `review`
  - `pr-branch`
  - `ship`
  - `undo`
- Ship the full Wave 5 workspace and maintenance layer:
  - `new-workspace`
  - `remove-workspace`
  - `workstreams`
  - `cleanup`
  - `update`
  - `reapply-patches`

These commands matter for parity and power-user workflows, but they are not required for a credible first public release.

### Installability

- Add manifest-level hardening after validating command compatibility:
  - targeted `excludeTools` restrictions for destructive shell patterns
- Add optional extension policy-engine rules if we want stronger enforcement than advisory hooks alone.
- Add gallery/discoverability polish:
  - GitHub topic `gemini-cli-extension`
  - tagged releases on a predictable cadence
  - migration plan using `migratedTo` if the repo ever moves

## Recommended V1 Go-Live Bar

Blueprint should not wait for all 53 retained commands before going public.

A practical v1 go-live bar is:

1. Ship the Wave 2 milestone closeout trio.
2. Keep the current implemented-only routing guarantees intact.
3. Add an explicit release process for build, install smoke, and tagged publication.
4. Publish only the commands that are actually implemented, while keeping later commands clearly marked as planned.

That yields a public extension with a complete end-to-end project lifecycle:

- bootstrap
- mapping
- discovery
- planning
- execution
- validation and UAT
- pause and resume
- roadmap edits
- milestone audit and closeout

## References

- Repo contracts:
  - `docs/COMMAND-CATALOG.md`
  - `docs/IMPLEMENTATION-ORDER.md`
  - `docs/GEMINI-CONSTRAINTS.md`
  - `docs/TEST-STRATEGY.md`
- Gemini CLI docs:
  - `https://geminicli.com/docs/extensions/reference/`
  - `https://geminicli.com/docs/extensions/best-practices/`
  - `https://geminicli.com/docs/extensions/releasing/`
