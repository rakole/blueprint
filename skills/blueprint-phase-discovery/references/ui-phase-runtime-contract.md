# `/blu-ui-phase` Runtime Contract

This file is the rich behavior contract for `/blu-ui-phase`. The command
manifest stays thin, the skill owns orchestration, and MCP tools own all
deterministic state reads and writes.

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
- Read `mcp_blueprint_blueprint_config_get` with effective scope before
  deciding whether to draft a UI contract or an explicit skip rationale.
- Read `mcp_blueprint_blueprint_artifact_contract_read` with
  `artifactId: "phase.ui-spec"` before any scaffold, draft, revision, or write.
  Treat `contract.authoringTemplate` as the heading and schema authority.
- Read the existing `XX-UI-SPEC.md` through
  `mcp_blueprint_blueprint_phase_artifact_read` before proposing replacement.
- When research status reports saved context or research, read the actual
  `XX-CONTEXT.md` and `XX-RESEARCH.md` bodies through
  `mcp_blueprint_blueprint_phase_artifact_read` before drafting. Ground the
  draft in those artifacts, `.blueprint/codebase/*`, roadmap intent, and
  requirements before asking new questions.

### Decide

- If a substantive UI spec already exists, reuse is the default. Replacement
  requires explicit overwrite confirmation.
- If `workflow.ui_phase=false`, author a populated explicit skip rationale in
  the same `XX-UI-SPEC.md` file.
- If `workflow.ui_safety_gate=true` and the phase appears backend-only or
  intentionally skips UI, require a concrete rationale before writing.
- Keep pending gates visible as phase ambiguity, contract-versus-skip choice,
  UI-safety rationale, overwrite confirmation, checker-requested revision, or
  MCP validation failure.

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
  considered, and what scope change should trigger a revisit.

## Subagent Path

Use `blueprint-ui-designer` only when suitable UI design or code-analysis
subagents are available and deeper phase-scoped UI synthesis would improve the
artifact. The designer should read upstream artifacts, scout the existing UI or
design system, and return markdown that can be normalized into the final
`XX-UI-SPEC.md`.

Run `blueprint-checker` after drafting and before persistence when a UI
contract is created or materially revised. The checker must evaluate the six UI
dimensions: copywriting, visual hierarchy, color, typography, spacing, and
registry/design-system safety. A `BLOCK` or `REVISE` verdict is a pending gate,
not a completed run.

Do not use browser-only, web-search-only, shell-only, or generic agents as
substitutes for Blueprint UI design, codebase, or workflow analysis agents.
External references may support a claim when explicitly supplied or approved,
but they do not replace repo evidence and saved Blueprint artifacts.

## No-Subagent Fallback

When suitable subagents are unavailable or unsafe, the parent command performs
the full workflow sequentially without reducing output quality:

1. Compress the phase goal, requirements, saved context, saved research, and
   codebase evidence into a short carry-forward note.
2. Decide contract versus skip mode from config, phase scope, and saved
   evidence.
3. Draft one section at a time against `contract.authoringTemplate`, carrying
   citations or source notes forward before moving to the next section.
4. Self-check the same six dimensions that `blueprint-checker` would review.
5. Repair any blocked dimensions before persistence, or stop with a named
   blocker and next safe implemented action.

## Persist

- Use `mcp_blueprint_blueprint_artifact_scaffold` only to seed a missing
  repo-relative UI-spec artifact path. A scaffold is never finished content.
- Persist only the final markdown through
  `mcp_blueprint_blueprint_phase_artifact_write` with the resolved numeric
  `phase`, `artifact: "ui-spec"`, and the complete artifact body.
- Pass `overwrite: true` only after explicit overwrite confirmation.
- Treat the returned `path`, `status`, `validation`, and `warnings` as
  authoritative.
- Update `STATE.md` through `mcp_blueprint_blueprint_state_update` only after
  the UI artifact is settled or the run stops on an explicit blocker.

## Validate

- Normalize the final draft to the canonical `authoringTemplate` headings while
  using this runtime contract as the richness and evidence-density authority.
- Reject scaffold placeholders, missing `Outcome Mode`, missing skip rationale,
  vague UI-contract language, and checker-blocked dimensions before write.
- If `mcp_blueprint_blueprint_phase_artifact_write` returns
  `status: "invalid"` or validation issues, repair the same normalized draft
  using the returned issues and retry through MCP once before treating the run
  as blocked.
- If checker review asks for revisions, update only the affected sections,
  re-normalize to the same `authoringTemplate`, and re-run the checker or the
  no-subagent six-dimension self-check before persistence.

## Route

- End with a concise summary covering phase, mode, config gates, contract read,
  evidence used, artifact status, checker or self-check outcome, warnings, and
  next safe action.
- Keep routing inside implemented commands, usually `/blu-plan-phase <phase>`
  when the artifact is settled or `/blu-progress` when a gate remains blocked.
- Do not present planned-only or blocked lifecycle commands as runnable.

## Completion Criteria

- Phase resolution succeeded or stopped with the exact MCP reason.
- Effective config, research status, canonical UI contract, and existing UI spec
  were read before drafting or replacement.
- The final artifact is either a concrete UI contract that satisfies the six UI
  dimensions or a concrete explicit skip rationale.
- Capability-gated subagent review or the sequential no-subagent fallback
  completed before persistence.
- Any invalid write or checker failure was repaired through the bounded retry
  path, or the run stopped with a named blocker.
- The saved path and next action came from MCP-owned state and implemented
  command routing.
