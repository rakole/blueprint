# 2026-04-12 Extension Repair Closeout

## Scope

This note closes the drift-repair round defined in
`docs/drift-fixes/2026-04-12-parallel-extension-repair-plan.md`.

- No new feature work was added during closeout.
- Implemented-only routing guarantees remain unchanged.
- Command status semantics remain unchanged.
- Persistent Blueprint runtime state remains MCP-owned.

## Final Verification

The final regression sweep passed on `2026-04-12` with:

- `npm test`
- `npm run smoke:gemini-clean-home`
- `npm run test:integration:extension`

## Closeout Findings

- The live clean-home smoke passed with Gemini CLI `0.37.1`.
- `gemini extensions link <repo> --consent` still prints a noisy
  `projects.json` temp-file rename warning in a clean temp home, but the link
  succeeds and the extension is listed correctly afterward.
- `gemini extensions list --output-format json` still requires a TTY-backed
  execution path for reliable JSON capture in local smoke runs, which is why
  the repo harness prefers `script -q /dev/null ...` when stdin is a TTY.
- The containerized staged-install smoke passed in both `link` and `install`
  modes. The optional live interactive help assertion remained skipped because
  `GEMINI_API_KEY` was not set.

## Outcome

The repair round is closed with no remaining open `P0` or `P1` tasks in the
parallel repair plan. The extension validates, links, lists, and exposes the
expected built runtime surface from shipped assets.
