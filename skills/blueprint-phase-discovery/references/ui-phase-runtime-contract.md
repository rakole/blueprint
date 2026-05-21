# `/blu-ui-phase` Runtime Contract

This file is the rich behavior contract for `/blu-ui-phase`. The command
manifest stays thin, the skill owns orchestration, and MCP tools own all
deterministic state reads and writes.

## Visible UI Progress

For non-trivial runs, keep progress visible through short boundary updates.
Gemini-native progress helpers are presentation mirrors only. They do not
expand the MCP tool allowlist, persistence authority, designer/checker
authority, contract-versus-skip authority, state-sync authority, routing
authority, or user confirmation authority defined by this contract.

Visible UI stages:

| Step | User-visible wording | Shared stage | Required visibility |
|------|----------------------|--------------|---------------------|
| 1 | resolve UI phase | Resolve | selected phase, research readiness, existing UI-spec posture, and config-driven contract/skip posture |
| 2 | read branch evidence | Read | effective config, existing artifact status, context/research bodies when needed, contract source for UI-contract mode, and current route posture |
| 3 | choose UI outcome | Decide | contract-versus-skip decision, UI-safety rationale gate, overwrite gate, checker gate, and pending gate |
| 4 | draft UI artifact | Execute | skip-rationale or UI-contract mode, designer/checker/fallback mode, six-dimension coverage, and active revision scope |
| 5 | persist single UI spec | Persist | skip-write or artifact-write path, scaffold use only in contract mode, saved path, and single-artifact status |
| 6 | validate UI artifact | Validate | placeholder/rationale/checker validation status, MCP validation repair, and normalized authoring-template status when contract mode applies |
| 7 | sync state and route | Route | state-sync result, refreshed next implemented action, command-catalog proof when needed, and plan-phase/progress handoff |

Progress updates must be short boundary updates. Emit exceptional updates for
phase ambiguity, contract-versus-skip waits, UI-safety rationale waits,
overwrite waits, checker-requested revisions, designer/checker unavailable
fallback, invalid skip rationale, placeholder or validation repair, state-sync
failure, route-refresh failure, and completion.

## Shared Stage Mapping

### Resolve

- Resolve the phase with `mcp_blueprint_blueprint_phase_locate`.
- Keep the resolved scope visible as the selected phase, phase name, current
  research readiness, existing UI-spec posture, and config-driven
  contract-versus-skip mode.
- If the phase cannot be resolved, stop with the exact tool reason and route to
  an implemented recovery action such as `/blu-progress`.

### Read

- Read `mcp_blueprint_blueprint_phase_research_status` to learn whether
  context, research, and UI spec artifacts exist.
- Read `mcp_blueprint_blueprint_state_load` when you need the current
  MCP-derived routing posture before or after persistence; the final next safe
  action must come from refreshed state, not a hand-built guess.
- Read `mcp_blueprint_blueprint_command_catalog` whenever the final route needs
  an explicit implemented-only check beyond the loaded state's derived next
  action.
- Read `mcp_blueprint_blueprint_config_get` with effective scope before
  deciding whether to draft a UI contract or an explicit skip rationale.
- Read the existing `XX-UI-SPEC.md` through
  `mcp_blueprint_blueprint_phase_artifact_read` before proposing replacement.
- Read `mcp_blueprint_blueprint_artifact_contract_read` with
  `artifactId: "phase.ui-spec"` only after you have decided the run is in real
  UI-contract mode. Treat `contract.authoringTemplate` as the heading and
  schema authority only for that branch.
- When research status reports saved context or research, read the actual
  `XX-CONTEXT.md` and `XX-RESEARCH.md` bodies through
  `mcp_blueprint_blueprint_phase_artifact_read` before drafting only when the
  active branch actually needs that evidence. Ground real UI-contract drafts in
  those artifacts, `.blueprint/codebase/*`, roadmap intent, and requirements
  before asking new questions.

### Decide

- If a substantive UI spec already exists, reuse is the default. Replacement
  requires explicit overwrite confirmation.
- If `workflow.ui_phase=false`, author a populated explicit skip rationale in
  the same `XX-UI-SPEC.md` file.
- If `workflow.ui_safety_gate=true` and the phase appears backend-only or
  intentionally skips UI, require a concrete rationale before writing.
- Keep skip mode progressive and branch-local. Do not load the full
  `phase.ui-spec` authoring template, do not scaffold, and do not draft full
  UI-contract headings when the run only needs an explicit skip rationale.
- Keep pending gates visible as phase ambiguity, contract-versus-skip choice,
  UI-safety rationale, overwrite confirmation, checker-requested revision, or
  MCP validation failure.

Use this branch logic literally:

```text
if explicit skip mode:
  read config + existing XX-UI-SPEC.md
  confirm overwrite only if needed
  gather only enough saved evidence to write one good skipRationale
  call mcp_blueprint_blueprint_phase_ui_skip_write
  do not call artifact_contract_read
  do not call artifact_scaffold
  do not call phase_artifact_write
else:
  read artifact_contract_read("phase.ui-spec")
  read saved context/research bodies when present
  scaffold only if needed
  draft the real UI contract
  optionally run blueprint-ui-designer + blueprint-checker
  call mcp_blueprint_blueprint_phase_artifact_write
```

### Execute

- Author one canonical artifact body: either a real UI contract or an explicit
  skip rationale. Do not create a second skip artifact.
- For UI contract mode, fill the canonical headings with planner-grade
  decisions rather than exploratory notes:
  - design-system evidence and repo paths, or a stated absence
  - spacing scale and layout rhythm
  - typography sizes, weights, and line heights
  - color hierarchy with a 60/30/10 role split or a repo-derived equivalent
  - copywriting contract for CTAs, empty states, errors, and destructive actions
  - screens, states, loading, empty, error, success, and responsive behavior
  - component reuse, new component or token justification, and density rules
  - accessibility, content hierarchy, localization, and safety notes
  - registry and design-system safety, including third-party block vetting when
    such blocks are proposed
- For explicit skip mode, include `## Outcome Mode` and a populated
  `## Rationale` that explains why UI work is out of scope, what safety gate was
  considered, and what scope change should trigger a revisit. The skip branch
  uses the dedicated write tool so the model only needs to supply the
  `skipRationale` text, not the full UI-contract scaffold.

## Agent Tool Path

Gemini CLI exposes enabled delegated agents as same-named tools. Do not read,
inline, or load any separate agent source before delegation. Call
`blueprint-ui-designer` with a bounded UI-design task packet only when the
active `/blu-ui-phase` command contract permits it, `workflow.subagents` is
enabled, the same-named tool is available in the current host session, and
deeper phase-scoped UI synthesis would improve the artifact. The designer should
read upstream artifacts, scout the existing UI or design system, and return
markdown that can be normalized into the final `XX-UI-SPEC.md`.

Call `blueprint-checker` with a bounded UI-check task packet after drafting and
before persistence when a UI contract is created or materially revised, only
when the active command contract permits it, `workflow.subagents` is enabled,
and the same-named tool is available. The checker must evaluate the six UI
dimensions: copywriting, visual hierarchy, color, typography, spacing, and
registry/design-system safety. A `BLOCK` or `REVISE` verdict is a pending gate,
not a completed run.

Do not use browser-only, web-search-only, shell-only, or generic agents as
substitutes for Blueprint UI design, codebase, or workflow analysis agents.
External references may support a claim when explicitly supplied or approved,
but they do not replace repo evidence and saved Blueprint artifacts.

## No-Subagent Fallback

When `blueprint-ui-designer` or `blueprint-checker` is unavailable, disabled,
unnecessary, or unsafe, the parent command performs the full workflow
sequentially with the same evidence depth and artifact quality expected from the
designer-plus-checker path. Do not substitute browser-only, web-search-only,
shell-only, or generic helpers for Blueprint UI design, codebase, or workflow
analysis.

1. Compress the phase goal, requirements, saved context, saved research, and
   codebase evidence into a short carry-forward note.
2. Decide contract versus skip mode from config, phase scope, and saved
   evidence.
3. If the run is skip mode, write one concrete `skipRationale` string and send
   it through `mcp_blueprint_blueprint_phase_ui_skip_write`.
4. If the run is real UI-contract mode, draft one section at a time against
   `contract.authoringTemplate`, carrying citations or source notes forward
   before moving to the next section.
5. Self-check the same six dimensions that `blueprint-checker` would review
   only for real UI-contract mode.
6. Compress the completed section back into the carry-forward note with the key
   decision, evidence roots, and any unresolved UI risk before moving on.
7. Repair any blocked dimensions before persistence, or stop with a named
   blocker and next safe implemented action.

## Persist

- Use `mcp_blueprint_blueprint_phase_ui_skip_write` for explicit skip mode. It
  owns the minimal valid `XX-UI-SPEC.md` render and takes only the final
  `skipRationale` text.
- Use `mcp_blueprint_blueprint_artifact_scaffold` only to seed a missing
  repo-relative UI-spec artifact path in real UI-contract mode. A scaffold is
  never finished content.
- Persist real UI-contract markdown through
  `mcp_blueprint_blueprint_phase_artifact_write` with the resolved numeric
  `phase`, `artifact: "ui-spec"`, and the complete artifact body.
- Pass `overwrite: true` only after explicit overwrite confirmation.
- Treat the returned `path`, `status`, `validation`, and `warnings` as
  authoritative.
- Update `STATE.md` through `mcp_blueprint_blueprint_state_update` only after
  the UI artifact is settled or the run stops on an explicit blocker. Use
  `base: "synced"` and preserve the already resolved selected phase in
  `patch.currentPhase` together with `patch.activeCommand`; do not treat the
  update response itself as the final routing answer.

## Validate

- Normalize the final draft to the canonical `authoringTemplate` headings only
  for real UI-contract mode while using this runtime contract as the richness
  and evidence-density authority.
- Reject scaffold placeholders, missing `Outcome Mode`, missing skip rationale,
  vague UI-contract language, and checker-blocked dimensions before write.
- If `mcp_blueprint_blueprint_phase_ui_skip_write` or
  `mcp_blueprint_blueprint_phase_artifact_write` returns `status: "invalid"` or
  validation issues, repair the same branch-local draft using the returned
  issues and retry through MCP once before treating the run as blocked.
- If checker review asks for revisions, update only the affected sections,
  re-normalize to the same `authoringTemplate`, and re-run the checker or the
  no-subagent six-dimension self-check before persistence.

## Route

- End with a concise summary covering phase, mode, config gates, contract read,
  evidence used, artifact status, checker or self-check outcome, warnings, and
  next safe action.
- Reload routing through `mcp_blueprint_blueprint_state_load` after the synced
  update and report the refreshed next safe action from
  `derivedStatus.nextAction`, using
  `mcp_blueprint_blueprint_command_catalog` when an explicit implemented-only
  check is needed. Fall back to `/blu-progress` when refreshed routing is
  missing, blocked, or ambiguous.
- Keep routing inside implemented commands, usually `/blu-plan-phase <phase>`
  when the artifact is settled or `/blu-progress` when a gate remains blocked.
- Do not present planned-only or blocked lifecycle commands as runnable.

## Completion Criteria

- Phase resolution succeeded or stopped with the exact MCP reason.
- Effective config, research status, canonical UI contract, and existing UI spec
  were read before drafting or replacement.
- The final artifact is either a concrete UI contract that satisfies the six UI
  dimensions or a concrete explicit skip rationale.
- Capability-gated agent-tool review or the sequential no-subagent fallback
  completed before persistence.
- Any invalid write or checker failure was repaired through the bounded retry
  path, or the run stopped with a named blocker.
- The saved path came from the write tool response, and the next action came
  from refreshed MCP-owned state and implemented command routing.
