# Gemini-First Effectiveness Spine for Blueprint

## Summary

- Standardize one Gemini-native orchestration model across Blueprint so commands do three things consistently: stay grounded, visibly progress, and reliably follow through.
- Keep Blueprint Gemini-first but not Gemini-exclusive: use Gemini CLI features aggressively where they help, while preserving graceful fallback for other hosts.
- Baseline from the current repo: `ask_user` is already widespread, but `write_todos`, `update_topic`, tracker tools, and `get_internal_docs` are effectively concentrated in `new-project`; no Blueprint assets currently use `save_memory`, `google_web_search`, `web_fetch`, `list_mcp_resources`, or `read_mcp_resource`; only `blueprint-executor` currently exposes `run_shell_command`.

## Implementation Changes

- Add one shared authoring contract for commands, skills, agents, docs, and tests:
  - Create a Gemini-tools playbook that defines when Blueprint should use `ask_user`, `write_todos`, `update_topic`, tracker tools, `get_internal_docs`, web tools, MCP resource tools, and shell.
  - Update the command template, skill template, runtime reference, and command-spec docs so every command declares its execution profile: `router`, `interactive-read`, `long-running-mutation`, or `high-risk-maintenance`.
  - Define one shared stage vocabulary for user-visible progress: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`.
- Make user visibility a first-class cross-asset contract:
  - Require `update_topic` plus `write_todos` for long-running commands: `new-project`, `discuss-phase`, `plan-phase`, `execute-phase`, `validate-phase`, `verify-work`, `docs-update`, `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `ui-review`, `review`, `add-tests`, `quick`, `ship`, `undo`, and `cleanup`.
  - Require each of those commands to surface the resolved scope, current stage, pending confirmation, and next safe action while work is in flight.
  - Upgrade `/blu`, `help`, `progress`, and `next` to report not just "what to do next" but also "what Blueprint is currently waiting on": missing artifact, overwrite gate, user approval, verification debt, or blocked substrate.
- Standardize decision capture and confirmation:
  - Make `ask_user` the required path for all structured decisions, overwrite confirmations, destructive gates, and review/skip/stop checkpoints on Gemini.
  - Use one-question-at-a-time prompts by default, with short labeled options and a custom-answer path where freeform input matters.
  - Remove prose-only confirmation language from command prompts and skill docs except where host fallback is explicitly needed.
- Add a follow-through layer for multi-step and branchy workflows:
  - Use Gemini tracker tools for commands with real dependency graphs: `new-project`, `plan-phase`, `execute-phase`, `quick`, `audit-fix`, `add-tests`, and `ship`.
  - Keep trackers session-local and pair them with visible `write_todos`: tracker for internal dependency management, todos for user-facing progress.
  - Tighten parent/subagent contracts so parent commands own orchestration, checkpoints, and persistence, while subagents own only bounded work products.
- Rework subagent usage around tool isolation and intent:
  - Keep read-only agents minimal and evidence-bound.
  - Keep mutating or shell-capable behavior limited to executor, maintenance, and debug paths.
  - Extend research/doc/review-capable agents to use external Gemini tools only when their contract explicitly calls for it.
  - Do not proliferate new agent types unless a new tool boundary is needed; prefer upgrading existing research/planning/review agents first.
- Add a grounded external-research policy:
  - Use `google_web_search` and `web_fetch` only in commands that need external truth: `research-phase`, brownfield `new-project`, `docs-update`, `review`, and targeted review/debug flows involving external libraries or APIs.
  - Require those commands to distinguish repo truth from web truth and persist citations or source URLs in the resulting artifact or report.
  - Never use web tools as a shortcut for facts that should come from local files, Blueprint artifacts, or MCP state.
- Add a Gemini self-correction policy:
  - Expand `get_internal_docs` beyond bootstrap and require it anywhere command or skill behavior depends on Gemini-specific or experimental semantics.
  - Centralize this rule in the shared playbook so command authors stop guessing about host behavior.
- Add an MCP resource strategy for read-heavy Blueprint state:
  - Expose read-only Blueprint MCP resources for command catalog, runtime contracts, phase bundle, codebase bundle, and latest reports.
  - Prefer `list_mcp_resources` and `read_mcp_resource` for router/progress/discovery-style context reads once those resources exist, instead of repeated file crawls and duplicated prompt instructions.
  - Keep writes on the existing MCP tool surface; resources are for discovery and grounding, not persistence.
- Keep state boundaries clean:
  - Do not make `save_memory` part of core Blueprint state or workflow configuration.
  - If used at all, restrict it to explicit user-approved personal interaction preferences surfaced through `/blu-settings`, never project state or Blueprint routing data.
  - Do not move authoritative runtime behavior into custom-command `!{...}` or `@{...}` injection; keep those limited to developer tooling or tests, not core Blueprint runtime logic.
- Use Gemini-only accelerants as opt-in but serious runtime upgrades:
  - Notifications: recommend for long-running Blueprint sessions so users know when approval or review is needed.
  - Model steering: document as the live correction path for long-running Blueprint runs and subagent-heavy commands.
  - Task tracker: treat as the default internal coordination layer for branchy commands on Gemini.
  - Worktrees: treat as the preferred Gemini execution posture for mutation-heavy sessions, but surface as a host capability rather than a required runtime dependency.
  - Checkpointing: recommend for risky file-edit sessions, but explicitly verify whether MCP-backed Blueprint mutations are covered before treating it as a rollback guarantee.
  - Auto Memory: use only as a reviewed skill-harvesting path for recurring Blueprint operator workflows, never as an automatic source of live runtime behavior.
- Keep hooks aligned with locked Blueprint decisions:
  - Do not expand Blueprint's hook surface beyond the current advisory hooks as part of this work.
  - Do not use Gemini model or tool-selection hooks as hidden enforcement or orchestration logic.
  - Use Gemini notifications, todos, tracker, and steering for visibility instead of turning hooks into a second runtime.

## Public Interfaces And Contracts To Add Or Change

- Extend normalized Blueprint config with repo/user-default keys that are host-portable in meaning:
  - `ux.progress_mode`: `quiet | stage | checklist`
  - `ux.structured_confirmations`: `auto | required`
  - `ux.user_checkpoints`: `off | phase | plan`
  - `orchestration.task_tracker`: `off | auto`
  - `research.external_sources`: `off | ask | auto`
- Add read-only Blueprint MCP resource URIs for:
  - runtime command catalog
  - per-command runtime contract
  - phase context bundle
  - codebase mapping bundle
  - latest report index
- Add one shared progress/status contract used in command docs, skill docs, and tests:
  - resolved scope
  - active stage
  - pending gate
  - current execution mode
  - next safe action

## Test Plan

- Add metadata/doc tests that enforce tool guidance by command profile, not one-off command text.
- Add integration tests for `ask_user` branching, `write_todos` updates, `update_topic` stage transitions, and tracker graph behavior.
- Add fallback tests proving commands still behave coherently when Gemini-only or experimental features are unavailable.
- Add MCP resource tests to ensure resource content matches existing command/tool truth and does not drift from docs/runtime reference.
- Add safety tests ensuring:
  - router never advertises non-implemented commands
  - web tools are used only in approved command families
  - `save_memory` is not used for Blueprint state
  - hooks remain advisory
  - shell usage stays isolated to the allowed agents and flows
- Prioritize behavior audits for `quick`, `execute-phase`, `validate-phase`, `verify-work`, `audit-fix`, `ship`, and `undo`, since those combine long-running orchestration, user visibility, and real mutation.

## Assumptions And Defaults

- Default posture: Gemini-first with graceful fallback for other hosts.
- Default risk posture: push experimental Gemini features, but always behind host checks, explicit settings, and non-experimental fallback behavior.
- Keep MCP as the only authoritative persistence layer.
- Keep Blueprint commands thin and user-facing; use skills for orchestration and agents for bounded work.
- Do not produce per-asset recommendations yet; this plan defines the shared Gemini tool strategy that later asset-level changes should inherit.

## References

- [Tools reference](https://geminicli.com/docs/reference/tools/)
- [Ask User](https://geminicli.com/docs/tools/ask-user/)
- [Todo tool](https://geminicli.com/docs/tools/todos/)
- [Hooks reference](https://geminicli.com/docs/hooks/reference/)
- [Plan Mode](https://geminicli.com/docs/cli/plan-mode/)
- [Subagents](https://geminicli.com/docs/core/subagents/)
- [Model steering](https://geminicli.com/docs/cli/model-steering/)
- [MCP resource tools](https://geminicli.com/docs/tools/mcp-resources/)
- [GEMINI.md context](https://geminicli.com/docs/cli/gemini-md/)
- [Custom commands](https://geminicli.com/docs/cli/custom-commands/)
- [Checkpointing](https://geminicli.com/docs/cli/checkpointing/)
- [Git worktrees](https://geminicli.com/docs/cli/git-worktrees/)
- [Notifications](https://geminicli.com/docs/cli/notifications/)
- [Auto Memory](https://geminicli.com/docs/cli/auto-memory/)
- [Extension best practices](https://geminicli.com/docs/extensions/best-practices/)
