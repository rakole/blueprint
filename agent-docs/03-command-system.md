# Command System

Blueprint command availability is runtime-derived. A command is routable only
when its live catalog entry has:

```text
status: implemented
implemented: true
```

Declared status alone is not enough.

## Status Vocabulary

- `planned`: documented or known, but not shipped.
- `implemented`: manifest, primary skill, required runtime inputs, and required
  MCP tools are present.
- `blocked`: unsafe to expose because required runtime pieces are missing.
- `repairing`: partially shipped or drifted, not safe as a routable command.

Routers may explain unavailable commands, but must not recommend them as
runnable next steps.

## Contract Chain

For a shipped command, inspect and keep aligned:

- Manifest: `commands/blu-<command>.toml`
- Primary skill: `skills/<skill>/SKILL.md`
- Skill input bundle: active command entry in the skill frontmatter
- Optional runtime reference: `skills/<skill>/references/*.md`
- Runtime metadata: `src/mcp/command-runtime-metadata.ts` when source-owned
- Catalog assembly: `src/mcp/tools/project.ts`
- Required tool registration: `src/mcp/tool-definitions.ts`
- Optional agent allowlist: `src/mcp/agent-metadata.ts`
- Tests: focused metadata, catalog, runtime-resource, and behavior tests

## Command Manifests

Manifests should stay thin.

Do:

- State purpose, execution profile, active stages, visible progress, hard
  invariants, allowed MCP FQNs, and response requirements.
- Use MCP runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Refer to the primary skill and command-specific runtime reference when one
  exists.

Do not:

- Put large duplicated behavior tables into the manifest when a skill reference
  owns them.
- Call skills tools. Skills are guidance.
- Tell agents to run `/blu-*` in the shell.

## Runtime Metadata

Runtime-owned metadata records command family, wave, primary skill, declared
status, risk, required tools, optional agents, reads, writes, execution profile,
root-routable flag, hook involvement, and evidence state.

When changing metadata:

- Keep required tool names as internal names like `blueprint_state_update`.
- Keep command prompts using FQNs like `mcp_blueprint_blueprint_state_update`.
- Keep optional agents inside the known Blueprint agent allowlist.
- Add or update tests that prove the command remains implemented only when its
  substrate exists.

## Implemented-Only Routing

The root router, help, progress, and next-step guidance must recommend only
commands that the catalog says are implemented. This includes follow-up routing
inside command responses.

Do:

- Re-read or rely on catalog output before naming executable follow-ups.
- Fall back to `/blu-progress` when the specific next command is unclear.
- State blockers and missing prerequisites plainly.

Do not:

- Route to a command because it appears in README text.
- Route to a command because a command spec exists.
- Treat planned, blocked, or repairing commands as runnable.

## Command Authoring Checklist

For a new or repaired command, fill in every item before declaring it
implemented:

```text
Command:
Manifest:
Primary skill:
Skill input bundle:
Runtime reference:
Runtime metadata:
Required MCP tools:
Optional agents:
Reads:
Writes:
Execution profile:
Root-routable:
High-risk gates:
Next safe implemented routes:
Tests locking behavior:
```
