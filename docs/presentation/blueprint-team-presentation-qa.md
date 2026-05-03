# Blueprint Team Presentation Q&A

This is a compact speaker-prep list for presenting Blueprint to a mixed team: people new to agentic coding, experienced agentic-coding users, engineers, security reviewers, and managers.

Grounded in `README.md`, `PROGRESS.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/MCP-TOOLS.md`, `docs/ARTIFACT-SCHEMA.md`, `docs/SKILLS-AND-AGENTS.md`, `docs/GEMINI-CONSTRAINTS.md`, `docs/RUNTIME-REFERENCE.md`, `docs/COMMAND-CATALOG.md`, `docs/commands/impact.md`, `src/mcp/server.ts`, `src/mcp/tools/project.ts`, `src/mcp/tools/impact.ts`, `src/shared/security.ts`, and the test suite.

## Product And Value

- **Q: What is Blueprint in one sentence?**  
  **A:** Blueprint is a Gemini and Tabnine CLI extension that turns agentic coding into a structured, artifact-backed repo workflow.

- **Q: What problem does Blueprint solve?**  
  **A:** It prevents planning, execution evidence, validation, and next steps from being trapped in transient chat context.

- **Q: Why should a normal engineering team care?**  
  **A:** It makes scope, decisions, blockers, evidence, and review follow-up visible and durable inside the repository.

- **Q: What is the core value proposition?**  
  **A:** Every meaningful change can be planned, executed, validated, reviewed, and resumed with repo-backed evidence.

- **Q: Is Blueprint mainly a planning tool or coding tool?**  
  **A:** Both, but its distinguishing feature is the lifecycle glue between planning, implementation, validation, review, and shipping.

- **Q: How is it different from asking ChatGPT or Gemini for a plan?**  
  **A:** Blueprint persists state and artifacts, validates writes through MCP tools, and routes only through implemented command contracts.

- **Q: How is it different from project management software?**  
  **A:** It lives directly in the repo and connects roadmap intent to code, tests, validation, and review evidence.

- **Q: How is it different from CI?**  
  **A:** CI checks known assertions; Blueprint helps decide what scope, owners, tests, docs, and validation should exist in the first place.

- **Q: How is it different from code review?**  
  **A:** Code review evaluates a patch; Blueprint also prepares the context, evidence, risk surface, and follow-up workflow around that patch.

- **Q: What is the simplest mental model for beginners?**  
  **A:** Treat it as a structured copilot with checkpoints, not a self-driving engineer.

- **Q: What is the simplest mental model for advanced users?**  
  **A:** Treat it as a command-driven state machine where the LLM orchestrates and MCP tools enforce persistence contracts.

- **Q: What is the most important design choice?**  
  **A:** `.blueprint/` is the project source of truth, not chat memory.

- **Q: What is the strongest demo moment?**  
  **A:** Show a diff or proposed change producing impact, owners, required tests, unknowns, and next actions before review starts.

- **Q: What is the current standout command?**  
  **A:** `/blu-impact`, because it gives a blast-radius report without mutating source, roadmap, PR, deployment, or extension state.

- **Q: Is Blueprint a literal port of older tooling?**  
  **A:** No. It is a Gemini-native and Tabnine-compatible redesign built around commands, skills, agents, MCP tools, and advisory hooks.

- **Q: What is the installation model?**  
  **A:** Install as a CLI extension from GitHub, then restart the host CLI and use `/blu-help`.

- **Q: What does Blueprint write by default?**  
  **A:** Project artifacts under `.blueprint/`, plus limited host-global operational files under `~/.<host>/blueprint/` for defaults, updates, workspaces, and patches.

- **Q: Is `.blueprint/` meant to be committed?**  
  **A:** Yes, the default posture is version-controlled workflow evidence unless a repo intentionally chooses otherwise later.

- **Q: Who is the primary audience?**  
  **A:** Engineering teams that want agentic coding to be repeatable, reviewable, and recoverable across sessions.

- **Q: What is the main risk Blueprint is trying to reduce?**  
  **A:** Untracked agent decisions and incomplete change understanding, especially as AI-assisted coding speeds up implementation.

## Manager And Executive Questions

- **Q: What business value does this create?**  
  **A:** Faster alignment, fewer missed dependencies, better review routing, and a reusable audit trail for meaningful changes.

- **Q: Where does ROI come from?**  
  **A:** Reduced rework from unclear scope, fewer late review surprises, and less manual reconstruction of project state.

- **Q: Does this replace engineers?**  
  **A:** No. It standardizes evidence and workflow; humans still decide priorities, scope, approval, and quality bars.

- **Q: Does it increase process overhead?**  
  **A:** It adds structure, but the goal is to replace ad hoc coordination overhead with explicit artifacts and safer next actions.

- **Q: How should we measure success?**  
  **A:** Track review-routing time, missed-impact incidents, late dependency discoveries, rework rate, and confidence on high-risk changes.

- **Q: What teams benefit most first?**  
  **A:** Teams with large repos, regulated flows, high review complexity, frequent context switching, or many AI-assisted changes.

- **Q: Can we adopt it gradually?**  
  **A:** Yes. Start with read-oriented commands like `/blu-help`, `/blu-progress`, `/blu-map-codebase`, and `/blu-impact --staged`.

- **Q: Does every developer need to learn the whole command surface?**  
  **A:** No. Most users can start with `/blu`, `/blu-help`, `/blu-progress`, and direct commands for their current workflow stage.

- **Q: Does it lock us into one vendor?**  
  **A:** The runtime is packaged for Gemini and Tabnine hosts, while project artifacts are plain Markdown and JSON in the repo.

- **Q: Is it safe enough for regulated or high-assurance repos?**  
  **A:** It is designed to expose uncertainty, ownership gaps, and sensitive-surface risk rather than hide them.

- **Q: Can managers read the output?**  
  **A:** Yes. Reports and roadmap artifacts are Markdown-first and designed to be reviewable without inspecting internal prompts.

- **Q: Can this help onboarding?**  
  **A:** Yes. `.blueprint/codebase/`, milestone summaries, phase artifacts, and reports capture context new teammates usually have to rediscover.

- **Q: What is the biggest adoption risk?**  
  **A:** Treating advisory output as proof. The countermeasure is to keep confidence, unknowns, and human gates visible.

- **Q: What if our CODEOWNERS or dependency metadata is poor?**  
  **A:** Blueprint still runs, but it lowers confidence and tells you what metadata is missing.

- **Q: Can it be used in CI later?**  
  **A:** Yes, especially `/blu-impact` with `--ci` or `--fail-on`, but local usage is advisory by default.

- **Q: Does Blueprint make teams slower?**  
  **A:** It can slow the first step slightly, but it is meant to prevent slower rework, misreview, and late release surprises.

- **Q: What is the presentation caveat to be honest about?**  
  **A:** `/blu-impact` is strongly behavior-audited; some broader command contracts still carry `needs-behavior-audit` in runtime docs.

- **Q: What is the current maturity snapshot?**  
  **A:** `PROGRESS.md` lists 53 completed retained commands plus implemented `/blu-impact`; `/blu-do` is the lone planned holdout.

- **Q: What is a good pilot plan?**  
  **A:** Run `/blu-impact --staged` and `/blu-code-review` on real changes for a few weeks before considering any CI gate.

- **Q: How do we prevent command sprawl from confusing users?**  
  **A:** `/blu`, `/blu-help`, and `/blu-progress` surface only live implemented commands and recommend next safe actions from state.

## Agentic Coding Concepts

- **Q: What does "agentic coding" mean here?**  
  **A:** The model can decompose work, call tools, use bounded specialists, persist evidence, and route the next step.

- **Q: Is Blueprint an autonomous coding bot?**  
  **A:** No. It can orchestrate work, but approvals, durable state, and high-risk actions stay explicit.

- **Q: What is a Blueprint command?**  
  **A:** A user-facing slash-command entrypoint such as `/blu-plan-phase` or `/blu-impact`.

- **Q: What is a Blueprint skill?**  
  **A:** A host-discoverable orchestration bundle that tells a command what to read, what gates to respect, and which MCP tools to use.

- **Q: What is a Blueprint agent?**  
  **A:** A bounded specialist such as planner, researcher, verifier, reviewer, security auditor, UI auditor, or doc writer.

- **Q: Why have both skills and agents?**  
  **A:** Skills define the workflow contract; agents do focused deep work inside that contract.

- **Q: Are agents required for correctness?**  
  **A:** No. Agents are optional helpers; MCP tools and saved artifacts remain the durable correctness boundary.

- **Q: Can agents roam freely across the repo?**  
  **A:** No. Agent contracts are scoped and should receive bounded tasks from the parent workflow.

- **Q: What happens if a subagent is unavailable?**  
  **A:** Commands should use their documented no-subagent fallback instead of inventing a generic substitute.

- **Q: Why not use one big general-purpose agent?**  
  **A:** Smaller bounded roles make scope, evidence, failure modes, and review responsibility easier to inspect.

- **Q: Does Blueprint store hidden chain-of-thought as project state?**  
  **A:** No. The durable project layer is named artifacts, reports, checkpoints, config, and state files.

- **Q: Where does the human step in?**  
  **A:** Scope choice, overwrite decisions, destructive actions, ambiguous classifications, UAT, and approval gates.

- **Q: Is prompt engineering required?**  
  **A:** No. The command names and runtime contracts carry most of the structure users would otherwise prompt manually.

- **Q: Why do commands expose stage vocabulary?**  
  **A:** Stages like Resolve, Read, Decide, Execute, Persist, Validate, and Route make long-running agentic work observable.

- **Q: What should skeptics watch in a demo?**  
  **A:** Whether Blueprint names scope, pending gates, authoritative tool results, unknowns, and next safe action.

- **Q: Is this still "just prompting"?**  
  **A:** The orchestration is LLM-driven, but persistence, validation, path safety, and routing availability are tool-enforced.

- **Q: How does Blueprint avoid polished nonsense?**  
  **A:** It requires saved evidence, validation contracts, warnings, blockers, and explicit unknowns instead of relying on fluent prose.

- **Q: Is it too heavy for small tasks?**  
  **A:** Sometimes, so Blueprint also has lighter paths like `/blu-fast`, `/blu-quick`, `/blu-note`, and `/blu-add-todo`.

## Architecture, MCP, And Runtime

- **Q: What is Blueprint at runtime?**  
  **A:** A CLI extension whose command layer delegates deterministic state reads and writes to a local MCP server over stdio.

- **Q: Why use MCP?**  
  **A:** MCP puts persistence, validation, return shapes, and path safety in code instead of prompt-only behavior.

- **Q: What owns what?**  
  **A:** Commands own UX, skills own orchestration, agents own bounded deep work, MCP tools own persistence, and hooks advise.

- **Q: Where does the MCP server start?**  
  **A:** Both host manifests launch `node ${extensionPath}/dist/mcp/server.js`.

- **Q: What MCP tool families are live?**  
  **A:** Project/catalog, config, state, phase/roadmap, artifacts, review, impact, workspace/workstream/patch, and update.

- **Q: What happens if required baseline tools are missing?**  
  **A:** Server startup hard-fails for missing required config, read-path, or mapping tool registrations.

- **Q: What is the hard safety boundary?**  
  **A:** Shared security primitives below MCP tools: path containment, safe JSON parsing, prompt-boundary checks, and identifier validation.

- **Q: Are MCP resources a write layer?**  
  **A:** No. Resources are read-only projections; writes stay on MCP tools.

- **Q: Which MCP resource URIs are live?**  
  **A:** `blueprint://commands/catalog` and `blueprint://commands/{command}/runtime-contract`.

- **Q: Are all planned resource URIs live?**  
  **A:** No. Phase, codebase, and report bundle resources are documented but not registered yet.

- **Q: What is inside a runtime-contract resource?**  
  **A:** Catalog metadata, parsed command spec, runtime-reference row, and resolved skill-input bundle.

- **Q: Is `review` exposed through runtime-contract resources?**
  **A:** Yes. Implemented commands, including `review`, are exposed through `blueprint://commands/{command}/runtime-contract`.

- **Q: Why derive resources instead of storing extra JSON?**  
  **A:** Derived resources avoid creating a second state channel that can drift from live runtime truth.

- **Q: How does a command become implemented?**  
  **A:** Its docs row, command manifest, primary skill, and required MCP tools must all line up.

- **Q: What is `declaredStatus` versus live `status`?**  
  **A:** `declaredStatus` is docs intent; live `status` is runtime truth after checking manifest, skill, and tools.

- **Q: What does `repairing` mean?**  
  **A:** Some substrate exists, but the command is not complete enough to be safely routable.

- **Q: What does `blocked` mean?**  
  **A:** Required runtime pieces are missing badly enough that the command cannot be presented as runnable.

- **Q: Do missing optional agents block routing?**  
  **A:** No. Optional-agent availability is reported separately and affects capability, not command availability.

- **Q: What happens if the command catalog cannot be read?**  
  **A:** Runtime falls back to a minimal safe catalog centered on `new-project`.

- **Q: How does Blueprint detect Gemini versus Tabnine?**  
  **A:** It uses `BLUEPRINT_HOST` or infers from the extension path, with Gemini as fallback.

- **Q: What host-specific paths change?**  
  **A:** Context file, manifest file, and host-global root: `~/.gemini/blueprint/` or `~/.tabnine/blueprint/`.

- **Q: Can operators override global state location?**  
  **A:** Yes, through `BLUEPRINT_GLOBAL_HOME`.

## State, Artifacts, And Data Boundaries

- **Q: Where is project state stored?**  
  **A:** In `.blueprint/` inside the repo or workspace.

- **Q: What lives in `.blueprint/`?**  
  **A:** Project docs, requirements, roadmap, state, config, phase artifacts, reports, impact reports, codebase maps, notes, todos, backlog, and workstreams.

- **Q: What lives under `~/.<host>/blueprint/`?**  
  **A:** User defaults, workspace registry, update metadata, and patch registry.

- **Q: Why split project-local and host-global state?**  
  **A:** Project truth travels with the repo; cross-project operational data stays narrow and global.

- **Q: Is `.planning/` runtime state?**  
  **A:** No. It can exist as implementation bookkeeping, but Blueprint runtime state is `.blueprint/`.

- **Q: Is `.blueprint/config.json` sparse?**  
  **A:** No. Repo config is persisted as a normalized full object.

- **Q: What is config precedence?**  
  **A:** Hardcoded defaults, host-global defaults, project config, then command flags or invocation overrides.

- **Q: Can repo config control hooks?**  
  **A:** No. Hook activation belongs to extension-owned `hooks/hooks.json`.

- **Q: What does `STATE.md` do?**  
  **A:** It records current status, active phase, blockers, last command, and next safe action across sessions.

- **Q: What is `mcp-write-failures.ndjson`?**  
  **A:** A best-effort operational log of rejected or thrown mutating MCP calls with sanitized request data.

- **Q: Does a lone failure log make a repo "partial"?**  
  **A:** No. Operational-only `.blueprint/` files keep bootstrap retryable.

- **Q: What are the readiness states?**  
  **A:** `uninitialized`, `mapping-incomplete`, `mapped-only`, `partial`, and `initialized`.

- **Q: What does `mapped-only` mean?**  
  **A:** The seven codebase docs exist and validate, but core project bootstrap artifacts have not been created.

- **Q: What does `mapping-incomplete` mean?**  
  **A:** A codebase mapping exists but is interrupted or invalid, so the safe next step is `/blu-map-codebase`.

- **Q: What does `partial` mean?**  
  **A:** Core Blueprint artifacts are present but incomplete or malformed, so `/blu-health` is the recovery path.

## Commands, UX, And Workflow

- **Q: What is `/blu`?**  
  **A:** The root router that reads project state and chooses or recommends the safest implemented command.

- **Q: What is `/blu-<command>`?**  
  **A:** A direct entrypoint for a known action, such as `/blu-plan-phase` or `/blu-impact`.

- **Q: When should I use `/blu` instead of a direct command?**  
  **A:** Use `/blu` when you want guidance or are unsure; use direct commands when you know the exact operation.

- **Q: Is `/blu help` the same as `/blu-help`?**  
  **A:** Yes. One is router form and one is direct command form.

- **Q: Can commands chain slash commands internally?**  
  **A:** No. Blueprint uses host-native command contracts rather than hidden slash-command chaining.

- **Q: What does implemented-only routing mean?**  
  **A:** `/blu`, `/blu-help`, `/blu-progress`, and `/blu-next` must recommend only commands whose live catalog entry is implemented.

- **Q: What is `/blu-help` for?**  
  **A:** It shows the currently shipped surface and routing guidance.

- **Q: What is `/blu-progress` for?**  
  **A:** It summarizes project status, blockers, config warnings, and next action from saved state and artifacts.

- **Q: What is `/blu-next` for?**  
  **A:** It chooses the shortest safe next step from current project evidence.

- **Q: Why can docs mention a command that is not runnable?**  
  **A:** Docs can describe future contracts; runtime availability still depends on manifest, skill, and MCP tools.

- **Q: What command is still not shipped?**  
  **A:** `/blu-do` remains planned or repairing until its dedicated manifest/runtime substrate lands.

- **Q: What is the happy path for a phase?**  
  **A:** `discuss-phase`, optional `research-phase`, optional `ui-phase`, `plan-phase`, `execute-phase`, `validate-phase`, then `verify-work`.

- **Q: Is `execute-phase` enough to close a phase?**  
  **A:** No. Saved execution summaries still need validation and UAT evidence.

- **Q: What does `/blu-discuss-phase` produce?**  
  **A:** Phase context and optionally discussion logs or checkpoints.

- **Q: What does `/blu-research-phase` produce?**  
  **A:** A bounded phase research artifact grounded in repo context and configured external-source policy.

- **Q: What does `/blu-ui-phase` produce?**  
  **A:** A UI spec or explicit UI-skip rationale.

- **Q: What does `/blu-plan-phase` produce?**  
  **A:** One or more executable plan artifacts with validation against roadmap and dependencies.

- **Q: What does `/blu-execute-phase` produce?**  
  **A:** Real repo changes plus execution summary artifacts for completed, partial, or blocked plans.

- **Q: What does `/blu-validate-phase` produce?**  
  **A:** Verification evidence grounded in saved execution summaries.

- **Q: What does `/blu-verify-work` produce?**  
  **A:** UAT evidence and completion or follow-up routing.

- **Q: What do `/blu-pause-work` and `/blu-resume-work` do?**  
  **A:** They write and restore a resumable handoff from saved state and phase artifacts.

- **Q: What does `/blu-list-phase-assumptions` do?**  
  **A:** It reads current context and surfaces planning assumptions before a plan is written.

- **Q: What is a phase versus a milestone?**  
  **A:** A phase is a unit of planned work; a milestone is a larger grouping that can be audited, closed, summarized, and carried forward.

- **Q: What does `/blu-add-phase` do?**  
  **A:** It appends the next whole-number phase to the current milestone.

- **Q: What does `/blu-insert-phase` do?**  
  **A:** It inserts the next decimal phase after an integer anchor without renumbering later phases.

- **Q: What does `/blu-remove-phase` do?**  
  **A:** It removes a future phase and renumbers later roadmap references and phase artifacts after confirmation.

- **Q: Can `/blu-remove-phase` remove current or completed phases?**  
  **A:** No. It is guarded for future phases, with extra caution around any execution evidence.

- **Q: What does `/blu-audit-milestone` do?**  
  **A:** It compares milestone intent to saved evidence and writes an audit report before closeout.

- **Q: What does `/blu-plan-milestone-gaps` do?**  
  **A:** It converts audit-backed gaps into coherent follow-up phases.

- **Q: What does `/blu-complete-milestone` require?**  
  **A:** A saved audit that is ready to close with no open actionable gaps.

- **Q: What does `/blu-new-milestone` do?**  
  **A:** It carries forward context into a new milestone without deleting historical phase artifacts.

## `/blu-impact` And Blast Radius

- **Q: What is `/blu-impact`?**  
  **A:** An advisory blast-radius command for proposed or actual changes before implementation, merge, or release.

- **Q: Why was `/blu-impact` added?**  
  **A:** To help teams see affected surfaces, owners, tests, unknowns, and risk before a change ships.

- **Q: Is `/blu-impact` part of the original retained baseline?**  
  **A:** No. It is an intentional additive Wave 4 command and is currently implemented.

- **Q: What does `/blu-impact` write?**  
  **A:** Only a bounded report bundle under `.blueprint/impact/<impact-id>/`, unless `--no-write` is used.

- **Q: Does `/blu-impact` modify source code?**  
  **A:** No.

- **Q: Does `/blu-impact` change roadmap or phase state?**  
  **A:** No.

- **Q: Does `/blu-impact` post PR comments?**  
  **A:** No. It can render PR-comment text, but V1 does not mutate PR state.

- **Q: Does `/blu-impact` deploy or change release state?**  
  **A:** No.

- **Q: What inputs can `/blu-impact` use?**  
  **A:** Staged diff, working tree, range, base/head, explicit files, diff file, seed file, CI refs, roadmap context, or description.

- **Q: Can it run before code exists?**  
  **A:** Yes, with a description-only scope, but that stays low confidence and cannot produce a high-confidence pass.

- **Q: What are the statuses?**  
  **A:** `PASS`, `WARN`, and `BLOCK`.

- **Q: What does `BLOCK` mean?**  
  **A:** An advisory stop signal that review or merge should pause until the finding or unknown is handled.

- **Q: Does local `BLOCK` fail automatically?**  
  **A:** No. CI failure is opt-in through `--ci` or `--fail-on`.

- **Q: What does the report include?**  
  **A:** Status, risk, confidence, impacted areas, reviewers, tests, actions, findings, obligations, unknowns, evidence, and warnings.

- **Q: Why separate risk from confidence?**  
  **A:** A change can be high risk and low confidence at the same time; low confidence is not evidence of safety.

- **Q: How does it avoid false certainty?**  
  **A:** Missing ownership, dependency, compliance, or test metadata becomes explicit unknowns and lowers confidence.

- **Q: How does it find reviewers?**  
  **A:** CODEOWNERS, optional impact ownership metadata, and fallback reviewers when specific ownership is missing.

- **Q: How does it handle missing owners on sensitive paths?**  
  **A:** It can emit CRITICAL or BLOCK findings when configured sensitive ownership policy applies.

- **Q: How does it reason about dependencies?**  
  **A:** It uses package metadata, lockfiles, bounded TS/JS import scanning, and optional dependency-graph metadata.

- **Q: Is it a complete semantic dependency engine?**  
  **A:** No. V1 is conservative and explicit about dependency coverage gaps.

- **Q: What surfaces can it classify?**  
  **A:** Commands, docs, MCP server/tools/resources, artifact contracts, skills, agents, hooks, manifests, tests, package/build config, generated files, secrets, and source.

- **Q: Can it catch Blueprint runtime contract drift?**  
  **A:** Yes. It blocks when implemented command substrate is missing or router surfaces risk planned-command exposure.

- **Q: How does it treat `dist/**` changes?**  
  **A:** Runtime source changes without matching dist coverage warn; generated-only dist changes get provenance obligations.

- **Q: Does it read secret values?**  
  **A:** No. It reports paths, categories, hashes, and metadata, not secret contents.

- **Q: What if multiple scope inputs conflict?**  
  **A:** It normalizes a deterministic union and emits warnings rather than silently choosing one.

- **Q: Is output stable?**  
  **A:** For the same scope, config, and repo state, ids and ordering are designed to be deterministic.

- **Q: What files are always written when report writing is enabled?**  
  **A:** `IMPACT.md`, `impact.json`, and `summary.json`.

- **Q: What optional files can be written?**  
  **A:** `evidence.jsonl`, `review-checklist.md`, and `QUESTIONS.md` when evidence, obligations, or unknowns exist.

- **Q: Are report overwrites silent?**  
  **A:** No. Identical bundles are reused; different existing bundles require explicit overwrite.

- **Q: What is the best first demo command?**  
  **A:** `/blu-impact --staged` on a real diff with both code and contract-like surfaces.

## Security, Safety, And Governance

- **Q: Are hooks the enforcement layer?**  
  **A:** No. Hooks warn; MCP tools and shared security enforce hard boundaries.

- **Q: What advisory hooks ship?**  
  **A:** Read-before-edit, `.blueprint` write guard, and workflow advisory.

- **Q: When do advisory hooks run?**  
  **A:** On host `BeforeTool` events for file write or replace operations.

- **Q: Can hooks block edits?**  
  **A:** They are advisory by design and should warn rather than own state transitions.

- **Q: What does `src/shared/security.ts` defend against?**  
  **A:** Path escapes, null bytes, oversized or malformed JSON, unsafe identifiers, and prompt-boundary risks.

- **Q: How are path escapes blocked?**  
  **A:** Paths are resolved through realpath-aware containment checks and repo-relative validation.

- **Q: How is prompt injection handled before persistence?**  
  **A:** Strong instruction-override language and suspicious high-entropy payloads are rejected; role markers and prompt-context text warn.

- **Q: Are invisible characters sanitized?**  
  **A:** Yes. Control and invisible characters are stripped before persistence, with warnings.

- **Q: Can unsafe report content be written anyway?**  
  **A:** Tests cover rejection of unsafe prompt-boundary content before artifact persistence.

- **Q: Do failure logs leak full content?**  
  **A:** They are sanitized, truncated, and previewed rather than dumping full large bodies.

- **Q: What happens when a mutating MCP tool fails?**  
  **A:** The server best-effort appends a sanitized failure record to `.blueprint/mcp-write-failures.ndjson`.

- **Q: Are destructive operations gated?**  
  **A:** Yes. `undo`, `ship`, `new-workspace`, `remove-workspace`, `cleanup`, `reapply-patches`, and overwrites require explicit gates.

- **Q: Does `/blu-update` mutate the installed extension?**  
  **A:** No. It is advisory and writes only host-global update metadata and checklist files.

- **Q: Can Blueprint mutate the installed extension directory?**  
  **A:** No. Update, workspace, and patch flows guard against installed-extension targets.

- **Q: How conservative is `/blu-undo`?**  
  **A:** It is report-before-mutate, confirmation-gated, and uses safe revert-style steps instead of destructive resets.

- **Q: How conservative is `/blu-cleanup`?**  
  **A:** It protects current phases, active roadmap references, and evidence-incomplete phase directories.

- **Q: How safe is patch replay?**  
  **A:** It follows preflight, preview, confirm, replay, record, and blocks dirty trees or compatibility mismatches.

- **Q: Can repo config disable hook policy?**  
  **A:** No. Hook configuration remains extension-owned.

- **Q: Is `ask_user` a persistence layer?**  
  **A:** No. `ask_user`, progress, and tracker helpers are session UX; durable state remains in MCP and artifacts.

- **Q: What is the compliance story?**  
  **A:** Blueprint surfaces evidence, obligations, missing metadata, and uncertainty in durable reports rather than hiding gaps.

## Docs, Status, And Drift

- **Q: If a command has a doc page, is it shipped?**  
  **A:** No. Docs can describe future contracts; live command catalog status decides routability.

- **Q: Which status source should we trust most?**  
  **A:** The live `blueprint_command_catalog` result, then human summaries like `COMMAND-CATALOG.md`, `PROGRESS.md`, and `README.md`.

- **Q: Why can docs and runtime disagree?**  
  **A:** Docs express declared intent; runtime downgrades availability if manifests, skills, or tools are missing.

- **Q: What is docs-first development?**  
  **A:** Command specs and contracts are written before runtime expansion, then code lands one command at a time.

- **Q: Why keep planned commands documented?**  
  **A:** To preserve design intent without falsely exposing them as runnable.

- **Q: What command remains planned?**  
  **A:** `/blu-do`.

- **Q: Is `/blu-impact` shipped or planned?**  
  **A:** Shipped and implemented.

- **Q: What is `docs/RUNTIME-REFERENCE.md` for?**  
  **A:** It is the canonical Blueprint-only runtime reference for commands, skills, agents, tools, and hook coverage.

- **Q: Why do command TOML files look thin?**  
  **A:** They are host entrypoints; richer behavior lives in skills, reference docs, and MCP tool definitions.

- **Q: Why mention `needs-behavior-audit`?**  
  **A:** It separates contract alignment from full live behavior closure, which is useful honest maturity signaling.

## Build, Tests, Install, And Operations

- **Q: What runtime does Blueprint target?**  
  **A:** Node.js 20 or newer.

- **Q: What does `npm run build` do?**  
  **A:** It removes `dist/`, emits declarations, and bundles the MCP server plus hooks with esbuild.

- **Q: Is `dist/` required for install?**  
  **A:** Yes. Git-installed extensions are expected to launch built assets, not build on install.

- **Q: What does `npm test` do?**  
  **A:** It runs the build, then executes `tsx --test tests/**/*.test.ts`.

- **Q: Is typechecking separate?**  
  **A:** Yes, via `npm run typecheck`.

- **Q: How large is the test surface?**  
  **A:** The repo has over 100 test files plus a separate extension-install integration suite.

- **Q: Are built artifacts tested?**  
  **A:** Yes. Built hooks and the built MCP server are smoke-tested from `dist/`.

- **Q: Is extension install tested?**  
  **A:** Yes. Integration tests validate staged bundles, link/install behavior, command resolution, and host discovery in containers.

- **Q: Is live-host smoke possible?**  
  **A:** Yes for Gemini when the environment has `GEMINI_API_KEY`; Tabnine smoke depends on host command availability.

- **Q: What ships in the extension bundle?**  
  **A:** Manifests, host context files, commands, skills, agents, hooks, built `dist/`, and package metadata.

- **Q: What is excluded from the install bundle?**  
  **A:** Source, `node_modules`, `.planning`, and `.git` are excluded by the integration staging logic.

- **Q: What happens if a worktree lacks dependencies?**  
  **A:** The build script errors clearly and tells you to run `npm ci`.

- **Q: Does Blueprint support both Gemini and Tabnine?**  
  **A:** Yes, using host-specific manifests and context files over the same built MCP runtime.

- **Q: Does `/blu-update` self-update the extension?**  
  **A:** No. It produces advisory guidance and restart-oriented checklist artifacts.

- **Q: Where does workspace state live?**  
  **A:** Workspace manifests live in each workspace; the authoritative registry is host-global `workspaces.json`.

- **Q: Are workspace operations transactional?**  
  **A:** Tests cover registry rollback, dirty-member blocking, missing-manifest blocking, and lock/lease coordination.

- **Q: Where do patch registries live?**  
  **A:** Host-global under `~/.<host>/blueprint/patches/`.

- **Q: Is there visible CI configuration in the reviewed slice?**  
  **A:** The repo exposes package scripts and tests; no workflow YAML was part of the inspected surface.

## Adoption And Demo Strategy

- **Q: What is the lowest-risk way to introduce Blueprint?**  
  **A:** Start advisory-only with `/blu-impact --staged`, `/blu-map-codebase`, `/blu-progress`, and review reports.

- **Q: What should the first pilot measure?**  
  **A:** Whether impact reports catch reviewers, tests, docs, or dependency concerns before humans do.

- **Q: What metadata should we improve first?**  
  **A:** CODEOWNERS, ownership metadata, dependency graph hints, and test maps.

- **Q: Should we gate CI immediately?**  
  **A:** No. Start local and advisory; add CI failure only after the reports earn trust.

- **Q: What should a short live demo show?**  
  **A:** Install/load check, `/blu-help`, `/blu-progress`, then `/blu-impact --staged` on a meaningful diff.

- **Q: What should a deeper demo show?**  
  **A:** A brownfield map, phase lifecycle, execution summary, validation, and impact/report artifacts in `.blueprint/`.

- **Q: What is the best beginner-friendly phrasing?**  
  **A:** "Blueprint makes AI coding work visible, resumable, and reviewable."

- **Q: What is the best expert-friendly phrasing?**  
  **A:** "Blueprint separates orchestration from deterministic persistence and gates runtime availability through manifest, skill, and MCP substrate checks."

- **Q: What will managers probably ask first?**  
  **A:** Whether it saves review time, reduces release risk, and avoids replacing human accountability.

- **Q: What will senior engineers probably ask first?**  
  **A:** Whether state is deterministic, whether commands can hallucinate capability, and how missing metadata is handled.

- **Q: What will security reviewers probably ask first?**  
  **A:** What it can mutate, whether secrets are read, and where enforcement lives.

- **Q: What should we avoid overclaiming?**  
  **A:** That it proves safety, replaces CI, replaces review, or fully understands every cross-service dependency.

- **Q: What is the honest strongest claim?**  
  **A:** Blueprint makes agentic work more structured, reviewable, and recoverable than raw chat.

- **Q: What is the honest current limitation?**  
  **A:** Some command behavior audits remain queued, and impact quality depends on available repo metadata.

## Hard Questions

- **Q: What stops the model from hallucinating a command?**  
  **A:** `/blu`, help, progress, and next are constrained to live catalog entries marked implemented after substrate checks.

- **Q: What stops the model from writing arbitrary `.blueprint/` files?**  
  **A:** Correct command flows use MCP write tools with schema, path, overwrite, and prompt-boundary validation.

- **Q: What if someone bypasses Blueprint and edits files directly?**  
  **A:** Advisory hooks may warn, and later Blueprint health/progress can surface drift, but the hooks are not a hard permission system.

- **Q: What if a report is wrong?**  
  **A:** It is advisory evidence, not approval. Unknowns, confidence, and source evidence help humans challenge it.

- **Q: What if metadata is missing and the report passes?**  
  **A:** Description-only or metadata-light scopes should not high-confidence pass; missing metadata lowers confidence or creates unknowns.

- **Q: What if CODEOWNERS is wrong?**  
  **A:** Blueprint can only use available truth; the report still exposes provenance so teams can correct metadata.

- **Q: What if the LLM makes a bad implementation during `execute-phase`?**  
  **A:** Execution is followed by summaries, validation, UAT, code review, security/UI review, add-tests, and undo paths.

- **Q: Does Blueprint eliminate the need for code review?**  
  **A:** No. It gives reviewers better context and routing; it does not replace reviewer judgment.

- **Q: Does Blueprint eliminate the need for tests?**  
  **A:** No. It helps identify and create relevant tests, but tests remain a separate verification signal.

- **Q: Can Blueprint safely handle destructive actions?**  
  **A:** It uses report-before-mutate and confirmation gates, but destructive commands should still be treated with human care.

- **Q: Why not just build this as scripts?**  
  **A:** Scripts would become the persistence layer; Blueprint uses MCP tools as the structured runtime and keeps commands user-facing.

- **Q: Why not keep everything global?**  
  **A:** Project state belongs with the repo so it can be versioned, reviewed, branched, and resumed by teammates.

- **Q: Why not keep everything project-local?**  
  **A:** Some operational state, like workspace registry and update metadata, is cross-project by nature.

- **Q: What is the biggest architectural bet?**  
  **A:** Artifact-backed orchestration is more reliable than relying on the LLM's transient chat memory.

- **Q: What is the biggest product bet?**  
  **A:** Teams will accept a little more structure to get safer, faster AI-assisted delivery.

- **Q: What is the biggest technical risk?**  
  **A:** Drift between docs, command manifests, skills, tools, tests, and built assets.

- **Q: How is drift controlled?**  
  **A:** Runtime catalog checks, command-contract docs tests, metadata tests, built-asset smoke tests, and explicit drift-repair docs.

- **Q: What is the biggest security risk?**  
  **A:** Treating advisory artifacts as authority. Blueprint mitigates that by keeping humans and explicit gates in the loop.

- **Q: What should we say if someone asks "Is this production-ready?"**  
  **A:** The shipped surface is broad and tested, `/blu-impact` is behavior-audited, and broader lifecycle maturity should be described per command.

- **Q: What should we say if someone asks "Why now?"**  
  **A:** AI coding is making change faster; Blueprint makes the surrounding evidence, review, and risk model keep up.
