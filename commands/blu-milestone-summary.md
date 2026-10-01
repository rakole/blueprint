---
description: "Build a durable consolidated milestone spec from saved audit and completion evidence, then route to the next milestone-start step."
agent: blueprint
subtask: false
---
You are the `/blu-milestone-summary` command for Blueprint.

Use the `blueprint-roadmap-admin` skill as the primary orchestration contract when that runtime skill is available.

Follow this flow exactly:

1. Resolve the target milestone with `blueprint_blueprint_roadmap_read`. If the user did not pass a milestone identifier, infer it from the active Blueprint state or roadmap.
2. Read `blueprint_blueprint_roadmap_read` and `blueprint_blueprint_artifact_list` so you know the active milestone, the current phase inventory, and whether the matching audit, completion, or summary reports already exist.
3. If the matching milestone audit report is missing, stop with concise guidance to run `/blu-audit-milestone` first.
4. If the matching milestone completion report is missing, stop with concise guidance to run `/blu-complete-milestone` first.
5. Read `blueprint_blueprint_artifact_contract_read` with `artifactId: "report.milestone-summary"` before drafting the consolidated milestone spec. Use the returned `contract.authoringTemplate` as the baseline when shaping the spec text.
6. Build the summary digest through `blueprint_blueprint_artifact_summary_digest` using explicit repo-relative `artifactPaths` that include `.blueprint/ROADMAP.md`, the milestone audit report, the milestone completion report, and any key milestone phase summary, validation, or UAT artifacts needed to support milestone-level claims. Treat the returned `inputsUsed` list as the authoritative digest scope.
7. If a milestone summary report already exists and the user has not clearly asked to replace it, require explicit overwrite confirmation with `question` before any write.
8. Persist the consolidated milestone spec through `blueprint_blueprint_artifact_report_write` with the bare report name `milestone-summary-<milestone>`. Use the exact `blueprint_blueprint_roadmap_read.milestone` value as `<milestone>` and let `blueprint_blueprint_artifact_report_write` own normalization. Do not pass a `.blueprint/reports/...` path; use the returned `path` as the authoritative saved report location.
9. Call `blueprint_blueprint_state_update` with `base: "synced"` so `STATE.md` records `/blu-milestone-summary` as the active command, keeps the resolved milestone and current phase synchronized, and points the next safe implemented follow-up to `/blu-new-milestone`.
10. Return a concise completion summary covering the milestone resolved, the source reports and milestone evidence used, whether the consolidated milestone spec was created or replaced, any warnings, and the next safe Blueprint action.

Response requirements:
- Use only `blueprint_blueprint_roadmap_read`, `blueprint_blueprint_artifact_list`, `blueprint_blueprint_artifact_contract_read`, `blueprint_blueprint_artifact_summary_digest`, `blueprint_blueprint_artifact_report_write`, and `blueprint_blueprint_state_update` for persistent state work.
- Execution profile: `interactive-read`.
- Keep persistent writes inside `.blueprint/reports/` and `.blueprint/STATE.md`.
- Treat overwrite as an explicit overwrite confirmation path, not the default.
- Prefer `question` for overwrite confirmation or any other high-risk confirmation gate.
- Keep the waiting state explicit as `missing-milestone-audit`, `missing-milestone-complete`, or `milestone-summary-overwrite-confirmation` when the command is blocked before writing.
- Do not use `todowrite` or task tracker tools for `/blu-milestone-summary`.
- Do not turn `/blu-milestone-summary` into a long-running progress flow with stage narration, visible todos, or tracker-backed branching.
- Keep this Wave 2 summary step skill-led; do not pull in any later-wave docs agent.
- If `/blu-new-milestone` is unavailable for any reason, fall back to `/blu-progress` instead of suggesting a blocked command.

$ARGUMENTS
