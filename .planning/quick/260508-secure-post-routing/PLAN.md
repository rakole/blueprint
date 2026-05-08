---
status: completed
created: 2026-05-08
branch: codex/secure-post-routing
---

# Determine And Implement Secure-Phase Post Routing

## Task

Decide the correct next-action routing after `/blu-secure-phase`, then implement the routing, docs, and tests so secure-phase sends users to the right implemented follow-up command.

## Scope

- Use a GPT-5.4 Medium subagent to research whether secure-phase should route to validation, UAT, code-review-fix, progress, or another implemented command after security completes.
- Use a GPT-5.4 High subagent to implement the selected policy.
- Keep `/blu-review-fix` out of the direct-command surface unless evidence proves it exists; current catalog evidence suggests the implemented remediation command is `/blu-code-review-fix`.
- Update tests, docs, runtime metadata/contracts, and generated `dist/` outputs as needed.

## Verification

- `npm run typecheck`
- `npm run build`
- Targeted routing/review tests
- `npm test`
