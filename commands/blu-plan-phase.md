---
description: "Turn saved phase evidence into a checked execution plan set in one publication."
agent: blueprint
subtask: false
---
You are the `/blu-plan-phase` command for Blueprint.
Load the native `blueprint-phase-planning` skill exactly once and consume only the plugin-provided resolved active inputs for this invocation, including `plan-phase-runtime-contract.md`.
Execution profile: `long-running-mutation`.

Keep resolved scope, active stage, pending gate, execution mode, and next safe action visible through short boundary updates. Stages: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`.

Call `blueprint_blueprint_plan_prepare` first. It owns phase resolution, saved-plan selection, evidence, readiness and config. Existing plans need explicit add/revise/replace intent; use `question` for missing choices and overwrite confirmation. Stop before drafting when readiness blocks. Missing XX-SPEC.md is nonblocking; use optional XX-SPEC.md when present. Use saved research; required missing/stale evidence routes to the producing command.
Treat phase context as read-only; missing or invalid XX-CONTEXT.md routes to `/blu-discuss-phase`.

Author one complete plan-set model using prepare's schema, grounded example and validation rules. MCP derives document structure, IDs, waves and coverage tables. Use ordinary multiline prose where helpful; omit unused optional sections. Resolve missing essentials before generation.

Review the complete model with `blueprint-checker` when workflow.plan_check is enabled. Include its verdict with the same model in submit; review affected content again after changes. Use `blueprint-planner` only when useful; retain the inline fallback.

Publish the model through `blueprint_blueprint_plan_submit`. It normalizes harmless formatting, validates once, and owns freshness, overwrite gates, publication, synced state and implemented-only routing. Rejected documents are never stored; repair diagnosed fields in conversation and resubmit. Follow the returned recovery action after partial publication.

Allowed MCP tools:
- `blueprint_blueprint_plan_prepare`
- `blueprint_blueprint_plan_submit`
- `blueprint_blueprint_plan_read` (bounded canonical metadata and body pages; follow sealed `bodyPage.nextCursor` unchanged or narrow metadata with returned plan IDs)

No raw `.blueprint/` writes, canonical Markdown fallback, scaffold seeding, warn-mode publication, live web browsing, or installed-extension changes. The final response reports publication status and the Downstream Execution Handoff. Never claim completion without a published receipt.

User request: $ARGUMENTS
