# `/blu-do`
| Field | Value |
|---|---|
| Wave | `3` |
| Family | `Capture And Lightweight Execution` |
| Execution profile | `router` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `do` uses the shared router posture to classify a freeform ask into the safest retained Blueprint command or to recommend the safest implemented follow-up when the request is ambiguous, risky, oversized, or not yet supported.
- `do` is the future direct freeform router. It does not invent its own persistence path, long-running progress layer, or hidden maintenance behavior.

## Purpose


`do` is Blueprint's command for routing freeform text to the right Blueprint command. In Blueprint it should stay host-native, delegate persistence to documented MCP tools, and keep the repo-side contract explicit enough that this command can be implemented in isolation later without inventing new routing rules.


## Command Path And Examples

- CLI command path: `/blu-do`
- Root router form: `/blu do`
- Argument hint: `<description of what you want to do>`
- `/blu-do set-up-roadmap-for-notifications`
- `/blu do`

## Inputs, Project State, And Prerequisite Artifacts


- None, though project context improves routing quality.
- Uninitialized repos should degrade to `/blu-new-project`.
- Partial repos should degrade to `/blu-health`.


## Outputs


- User-facing result: a concise completion summary plus the selected direct command or safest implemented next action when applicable.
- Repo side effects: No durable artifact writes are planned.
- Routed guidance must stay inside the implemented Blueprint surface until `/blu-do` itself is shipped.


## Blueprint And Global State Reads


- retained command catalog metadata
- repo readiness via project status
- the current next safe action when repo state materially narrows routing


## Blueprint And Global State Writes


- none


## Required MCP Tools


- `blueprint_command_catalog` -> `{commands, waves, aliases}`
- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`

## Routing Intent Taxonomy

- Repo or status guidance routes to `help`, `progress`, or `next`.
- Lightweight capture routes to `note`, `add-todo`, `add-backlog`, or `review-backlog`.
- Idea shaping routes to `explore`.
- Small execution routes to `fast`.
- Bounded execution routes to `quick`.
- Planning or lifecycle escalation routes to `discuss-phase` or `plan-phase`.
- Ambiguous, oversized, risky, or unsupported asks should trigger clarification or a recommendation for the safest implemented direct command instead of speculative routing.

## Routing Boundaries

- Route only to retained Blueprint commands.
- Never write artifacts directly from `/blu-do`; the selected command owns any persistence.
- Never widen routing to planned, blocked, or repairing commands.
- Never hide high-risk maintenance, git, workspace, shipping, cleanup, undo, or patch behavior behind vague freeform intent. Recommend the explicit direct command instead.


## Skills And Subagents


- Primary skill: `blueprint-router`
- Optional subagents: none


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/help.md`
- `docs/commands/progress.md`


## Related Command Docs


- `docs/commands/root-router.md`
- `docs/commands/help.md`
- `docs/commands/progress.md`
- `docs/commands/next.md`
- `docs/commands/explore.md`
- `docs/commands/note.md`
- `docs/commands/add-todo.md`
- `docs/commands/add-backlog.md`
- `docs/commands/review-backlog.md`
- `docs/commands/fast.md`
- `docs/commands/quick.md`
- `docs/commands/discuss-phase.md`
- `docs/commands/plan-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: routing only.

## User Prompts And Confirmation Gates


- Ask for clarification only when multiple retained commands fit and their side effects differ materially.
- Recommend an explicit direct command instead of implicit routing for high-risk maintenance or destructive asks.


## Edge Cases


- The input is too vague to classify cleanly into note, todo, backlog, or execution work.
- The target item already exists or has already been promoted, completed, or archived.
- The user asks for high-risk maintenance, git, or workspace behavior through vague freeform prose.
- The repo is uninitialized or partial, so the safest answer is a recovery or bootstrap command.


## Failure Modes And Recovery


- If Blueprint is uninitialized, prefer `/blu-new-project`.
- If Blueprint is partial, prefer `/blu-health`.
- If the best-fit target command is not implemented, explain that waiting state and recommend the nearest implemented prerequisite instead.
- Route oversized execution asks to `quick` or `plan-phase` instead of bluffing.
- Recommend explicit maintenance commands instead of hiding risky behavior behind freeform routing.


## Acceptance Criteria


- Returns guidance, assumptions, or routing output without mutating project artifacts by default.
- Uses only documented read-oriented MCP queries for inspection and routing.
- Makes the routing taxonomy explicit enough that later implementation does not need to invent it.
- Keeps `/blu-do` read-only and command-selecting; it never becomes a hidden write path.
- Never routes to omitted commands or hides destructive behavior behind an implicit step.
- Never routes to planned, blocked, or repairing commands.


## Test Cases


- Repo or status guidance fixture.
- Capture classification fixture.
- Small execution fixture.
- Planning escalation fixture.
- No-project graceful degradation fixture.
- Ambiguous or high-risk clarification fixture.
- Direct `do` happy-path fixture.

