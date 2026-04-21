# `/blu-<command>`

| Field | Value |
|---|---|
| Wave | `<0-5>` |
| Family | `<family>` |
| Root-routable | `Yes` or `No` |
| Execution profile | `<one of: `router`, `interactive-read`, `long-running-mutation`, `high-risk-maintenance`>` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Record exactly one execution profile for the command, and use the stage/status labels only where the command actually reports them.
- Do not imply richer runtime behavior than the command currently exposes.

## Purpose

One concise paragraph describing what the command should accomplish in Blueprint and the Blueprint-native constraints it must preserve.

## Command Path And Examples

- CLI command path: `/blu-<command>`
- Root router form: `/blu <command>`
- Argument hint: `<args and flags>`
- `<example invocation>`
- `<example invocation>`

## Inputs, Project State, And Prerequisite Artifacts

- required arguments or conversational inputs
- required `.blueprint/` state
- prerequisite artifacts or docs

## Outputs

- user-facing result
- durable artifacts or reports
- external side effects if any

## Blueprint And Global State Reads

- `.blueprint/...`
- `~/.<host>/blueprint/...`

## Blueprint And Global State Writes

- `.blueprint/...`
- `~/.<host>/blueprint/...`

## Required MCP Tools

- `tool_name` -> `{returnShape}`
- `tool_name` -> `{returnShape}`

## Skills And Subagents

- Primary skill: `<skill>`
- Optional subagents: `<none or list>`

## Dependencies

- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/<dependency>.md`

## Related Command Docs

- Add this section for router or orchestration commands that depend on earlier command contracts.

## External Shell Or Git Dependencies

- External dependencies:
- `git`
- `gh`
- `none`

## Shell Risk Profile

- `<Low|Medium|High>: reason>`

## Risk Notes

- Add this section for heavy filesystem, git, workspace, update, or patch flows.

## User Prompts And Confirmation Gates

- explicit confirmations
- irreversible or surprising choices

## Edge Cases

- edge case
- edge case

## Failure Modes And Recovery

- failure mode
- recovery behavior

## Acceptance Criteria

- behavior contract
- safety contract
- artifact contract

## Test Cases

- happy-path fixture
- missing prerequisite fixture
- regression fixture
