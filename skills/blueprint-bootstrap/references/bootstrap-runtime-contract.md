# Blueprint Bootstrap Runtime Contract

This reference is the runtime-heavy contract for `/blu-new-project`.

Use it together with `SKILL.md`, `questioning.md`, and
`runtime-guardrails.md` so the bootstrap flow stays self-sufficient without
relying on top-level docs during execution.

## Shared Runtime Contract

- Execution profile: `long-running-mutation`.
- Shared stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`,
  `Validate`, `Route`.
- In-flight status fields: resolved scope, active stage, pending gate,
  execution mode, next safe action.

Keep the richer bootstrap language grounded in that shared contract:

- resolved scope: target repo root, repo shape, interactive vs `--auto` mode,
  overwrite posture, and whether the result is greenfield-ready or
  brownfield-provisional
- active stage: the current shared stage label behind the richer bootstrap
  narration
- pending gate: overwrite confirmation, missing brief, saved-default choice,
  workflow-preference choice, pre-write approval, revision request, or runtime
  blocker
- execution mode: interactive bootstrap, `--auto`, and whether optional bounded
  research or roadmap synthesis is active
- next safe action: the authoritative follow-up from project status, including
  `/blu-map-codebase` when brownfield mapping is still required and
  `/blu-new-project` when a valid map-only bundle is waiting for bootstrap

Map the bootstrap workflow to the shared stages like this:

1. `Resolve`: confirm repo root, detect `--auto`, classify repo shape, enforce
   brownfield map-first gating, and surface overwrite risk.
2. `Read`: inspect saved defaults, warnings, repo evidence, canonical bootstrap
   artifact contracts, and any needed Gemini host-tool documentation.
3. `Decide`: run discovery, saved-default selection, workflow-preference
   choices, approval gates, and revision-loop decisions.
4. `Execute`: synthesize the bootstrap brief, grouped requirements, roadmap
   shape, and any bounded research or roadmapping support.
5. `Persist`: create or refine `.blueprint/` artifacts only through Blueprint
   MCP tools.
6. `Validate`: run post-write artifact validation and surface warnings or
   provisional confidence honestly.
7. `Route`: end with the authoritative next safe action, especially the
   brownfield route to `/blu-map-codebase` when needed.

## Resolve

1. Confirm the command is running from the target repository root. If not, stop
   with the precise repo-root error instead of guessing.
2. Detect whether the user passed `--auto`; this maps to
   `bootstrapMode: "auto"`. Otherwise pass `bootstrapMode: "interactive"`.
3. Classify the repo as greenfield, scaffold-only, or brownfield before the
   first persistent write.
4. If a brownfield repo has no valid codebase map, stop before any write and
   route to `/blu-map-codebase`.
5. If `.blueprint/` is `mapping-incomplete`, stop before any core bootstrap
   write and route to `/blu-map-codebase`.
6. If `.blueprint/` is `mapped-only`, continue without treating the existing
   `.blueprint/codebase/*.md` bundle as an overwrite conflict.
7. If initialized core `.blueprint/` artifacts already exist, require explicit
   overwrite confirmation before continuing.
8. If repo evidence, product intent, or overwrite risk is fuzzy, use
   `blueprint-project-researcher` for bounded read-only synthesis before the
   first write.

## Read

1. Initialize session-local bootstrap coordination before the workflow gets
   deep when the current host/session exposes those helpers:
   - optionally set the opening stage with `update_topic`
   - optionally create a compact `write_todos` list for preflight, discovery,
     shaping, writing, validation, and routing
   - if the run already looks dependency-heavy and tracker helpers are
     available, seed task-tracker entries before the first branching decisions
   - when these helpers are unavailable, continue with concise conversational
     status notes that keep the same stage labels visible
2. Read `mcp_blueprint_blueprint_config_get` before mutating anything so saved
   defaults, provenance, and effective warnings are visible.
3. Read the canonical bootstrap artifact contracts with
   `mcp_blueprint_blueprint_artifact_contract_read` for `bootstrap.project`,
   `bootstrap.requirements`, and `bootstrap.roadmap` before shaping the first
   authored drafts.
   - Treat each returned `contract.authoringTemplate` as the heading and schema
     authority for the authored content.
   - Do not use scaffold output as the finished artifact when the command has
     enough context to author a substantive bootstrap seed.
4. If any Gemini-native tool detail is unclear while you shape the flow, verify
   it with `get_internal_docs` before relying on it.

## Decide

### Deep Discovery Loop

1. Run a real bootstrap discovery loop before the first write unless `--auto`
   already includes enough project context.
2. Treat `questioning.md` as a background guide, not a script.
3. Ask open, thread-following questions instead of checklist interrogation.
4. Challenge vague answers, make abstract ideas concrete, and surface who this
   is for, why it matters, what "done" looks like, and what belongs in the
   first milestone.
5. If the user clearly wants to explain in freeform, stay in freeform instead
   of forcing rigid option picking.
6. If short options would help, use `ask_user` with one focused question per
   call by default.

### Saved Defaults And Workflow Preferences

1. Offer saved defaults first when they exist and are valid.
2. If `--auto` is present and saved defaults are valid, apply them
   automatically.
3. If defaults are malformed, explain that Blueprint fell back to hardcoded
   defaults and keep the defaults provenance honest.
4. If defaults are not used, capture the repo's intended mode, granularity,
   parallelization posture, planning-doc git preference, and key workflow
   toggles with concise natural-language questions.
5. Use `ask_user` for saved-default selection and workflow-preference choices
   when structured options make the decision clearer.
6. Persist chosen repo-level config through
   `mcp_blueprint_blueprint_config_set` after initialization, and use
   `scope: "defaults"` only when the user explicitly approves a saved-defaults
   update.

### Approval Gate And Revision Loop

1. Turn the discovered context into a bootstrap brief rich enough to drive
   authored artifacts:
   - clear project vision and audience
   - constraints and non-goals
   - first-milestone framing
   - explicit assumptions
   - grouped requirement candidates, including deferred and out-of-scope cuts
2. Before the first persistent write in interactive mode, render a visible
   approval packet in the main Gemini CLI conversation. Do not display the
   proposal through shell output, hidden tool output, temporary files, pagers,
   terminal renderers, or collapsed subagent panes.
3. The approval packet must be structured Markdown, and should include:
   project brief, target users, requirement groups, roadmap phase table,
   assumptions, deferred or out-of-scope items, defaults provenance, and any
   brownfield confidence notes.
4. Treat optional `blueprint-project-researcher` and `blueprint-roadmapper`
   outputs as private synthesis inputs. Rewrite their conclusions into the
   main conversation before asking for approval.
5. After the visible approval packet, get explicit ready-to-create approval.
   Prefer `ask_user` for that approval gate, and make the prompt refer to the
   visible preview above.
6. Draft requirements and roadmap structure before writing, then run a revision
   loop if the user wants adjustments.
7. Interactive mode must call `mcp_blueprint_blueprint_project_init` with a
   sufficient `bootstrapSeed`. If the seed is missing or too thin, keep
   questioning instead of asking the MCP layer to synthesize purpose,
   requirements, roadmap, state, config, or phases.
8. `--auto` skips the extra confirmation loop only when the project brief is
   already strong enough to synthesize a credible `bootstrapSeed`.
9. If `--auto` lacks enough project context, stop and ask for the missing brief
   instead of inventing a product.
10. If `--auto` proceeds, make assumptions explicit in both the final summary and
   the written bootstrap artifacts rather than hiding them only in chat.

## Execute

1. Convert the discovered context into a bootstrap brief with project vision,
   audience, constraints, milestone framing, non-goals, and assumptions.
2. Requirements must be specific, user-centered, atomic, grouped, and
   traceable. Reject vague requirements before persistence:
   - "Handle authentication" must become a testable user capability.
   - "Support sharing" must name what can be shared, by whom, and how it is
     observed.
3. Distinguish committed v1 scope from deferred and explicitly out-of-scope
   work.
4. Use `blueprint-roadmapper` when grouped phase proposals, requirement
   coverage, sequencing, or success-criteria shaping would benefit from bounded
   synthesis.
5. Keep any task-tracker graph honest as research, revision, or roadmap-shape
   decisions change.

### Capability-Gated Research And Roadmapping

Use bounded subagents only when the runtime reports suitable bundled Blueprint
agents as available. Do not replace them with browser, web-search, shell-only,
or generic helpers.

1. Use `blueprint-project-researcher` when the project brief needs repo-shape
   evidence, product-context recovery, or parent-approved outside context before
   requirements are scoped.
2. When project-level research is useful, ask for the GSD-inspired dimensions
   that matter to the current repo instead of creating a mandatory research
   directory: `Stack`, `Features`, `Architecture`, `Pitfalls`.
3. Treat those research results as private synthesis inputs. Fold only
   approved, relevant findings into the visible approval packet and
   `bootstrapSeed`.
4. Use `blueprint-roadmapper` when the roadmap needs requirement clustering,
   dependency ordering, or goal-backward success criteria.
5. Roadmapper output must map every committed requirement to exactly one phase,
   identify duplicates or orphans before persistence, derive 2-5 observable
   success criteria per phase, and flag brownfield uncertainty honestly.

### No-Subagent Fallback

If suitable subagents are unavailable, continue sequentially in the parent
session instead of degrading to shallow synthesis.

1. Classify repo shape and summarize repo evidence first.
2. Handle one research dimension at a time in this order when relevant:
   `Stack`, `Features`, `Architecture`, `Pitfalls`.
3. After each dimension, compress carry-forward context into a short evidence
   summary with confidence and open questions.
4. Scope requirements one group at a time. Keep committed, deferred, and
   out-of-scope items separate.
5. Draft roadmap areas one at a time from the requirement groups, then run a
   final coverage pass:
   - every committed requirement appears in exactly one phase
   - no phase lacks success criteria
   - each success criterion is observable by a user or maintainer
   - brownfield assumptions are marked provisional when mapping evidence is
     missing
6. Show the same visible approval packet and revision loop as the subagent path
   before the first persistent write.

## Persist

1. Use `mcp_blueprint_blueprint_project_init` for the first persistent
   bootstrap write.
   - Pass `bootstrapMode: "interactive"` by default.
   - Pass `bootstrapMode: "auto"` only when the user explicitly requested
     automatic synthesis.
2. Pass the strongest available `bootstrapSeed` so
   `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, and
   `.blueprint/ROADMAP.md` land as authored drafts rather than placeholder
   shells.
   - The seed should carry grouped committed requirements, deferred scope,
     explicit out-of-scope cuts, roadmap phases, requirement IDs, phase
     objectives, and success criteria.
   - If any committed requirement lacks a durable ID, appears in zero or
     multiple roadmap phases, or any phase lacks requirement IDs or success
     criteria, revise before calling the MCP tool.
3. Treat returned `createdPaths`, `configPath`, and `nextAction` as authoritative instead of rebuilding bootstrap paths manually.
4. Require explicit overwrite confirmation before calling
   `mcp_blueprint_blueprint_project_init` with `overwrite: true`.
5. Do not call `mcp_blueprint_blueprint_artifact_scaffold` before initialization. Call it only when you deliberately need additional bootstrap artifacts after `mcp_blueprint_blueprint_project_init`, and pass only supported repo-relative Blueprint artifact paths.
6. Treat scaffold output as seeding, not final authored persistence.
7. After initialization, use `mcp_blueprint_blueprint_config_set` only with a
   JSON-object `patch`, default repo writes to `scope: "project"`, and touch
   saved defaults only when explicitly approved.
8. Use `mcp_blueprint_blueprint_state_update` only when the command needs to
   refine status, active command, or next-step guidance after initialization.

## Validate

1. Call `mcp_blueprint_blueprint_artifact_validate` after initialization to
   confirm the authored bootstrap artifacts satisfy the runtime contract.
2. Do not silently accept a thin scaffold when validation shows missing
   substance, traceability, or contract violations.
3. If validation or the `blueprint_project_init` response reports invalid,
   placeholder, missing-heading, missing-success-criteria, or traceability
   issues, repair the authored `bootstrapSeed` or approval-packet source and
   retry the MCP write only after the user approves any material scope change.
   Do not patch `.blueprint/` files by hand.
4. Surface warnings, defaults provenance, and brownfield-provisional confidence
   honestly.
5. If the user selected repo-level workflow preferences, confirm the persisted
   config reflects them after initialization.

## Output Quality Criteria

- The project brief names the audience, core value, first milestone, non-goals,
  constraints, assumptions, and any evidence limits.
- Requirements are grouped, testable, atomic, and written from the user or
  maintainer perspective.
- The roadmap derives phases from requirement coverage and dependencies rather
  than imposing a generic setup/core/polish template.
- Each committed requirement is covered exactly once in the roadmap.
- Each phase has a concrete objective and 2-5 observable success criteria.
- Deferred and out-of-scope work is visible enough to prevent accidental
  re-entry during later planning.
- Brownfield output distinguishes mapped evidence from provisional assumptions.
- The final response reports whether the artifacts were approved, revised, or
  auto-synthesized.

## Route

1. Call `mcp_blueprint_blueprint_project_status` after initialization so the
   user gets the authoritative next safe action.
2. For brownfield repos, make the next step explicit: if the codebase is not
   mapped yet, route to `/blu-map-codebase` before writing project bootstrap
   artifacts. If a valid codebase-only bundle exists, route through
   `/blu-new-project` and preserve the mapped docs.
3. Close the loop on session-local coordination before finishing:
   - mark the active `write_todos` item completed and leave the checklist
     reflecting the final state
   - update the current topic to the finished stage and next-action stance
   - if you used the task tracker, update remaining task states so the
     dependency graph matches what actually happened

## Response Contract

- Summarize the created `.blueprint/` paths, including `.blueprint/config.json`.
- Summarize the discovered project direction, requirement scope, and roadmap
  stance at a high level rather than calling the result "scaffolded."
- Mention any warnings or defaults provenance when relevant.
- Mention whether config choices came from saved defaults, explicit bootstrap
  questions, or hardcoded fallbacks.
- Explain whether the bootstrap artifacts are greenfield-ready or
  brownfield-provisional.
- State whether the requirements and roadmap were user-approved,
  auto-synthesized, or revised after feedback.
- Preserve requirement and roadmap traceability expectations instead of
  describing the command as bare scaffolding.
- Call out any explicit assumptions that shaped the bootstrap draft.
- End with the next safe action after initialization, using the project status
  response.

## Completion Criteria

Bootstrap is complete only when the repo has passed map-first gating, the
approval or auto-mode sufficiency gate has completed, authored bootstrap content
has been persisted through Blueprint MCP tools, validation has no unrepaired
contract or traceability failures, config provenance is reported, and the final
route comes from `mcp_blueprint_blueprint_project_status`.
