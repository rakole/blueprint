# Mental Model

Blueprint is a repo workflow layer. You talk to it with host slash commands; it stores project memory through validated MCP tools.

## Commands

Commands are the entrypoints you run in the host, such as:

```text
/blu-help
```

```text
/blu-plan-phase <phase>
```

Commands should stay thin: they gather the right state, call the right tools, and route to the next safe implemented command.

## Skills

Skills are the command playbooks. They describe how a command should reason, what evidence it should read, when it should ask you questions, and where it should persist results.

You normally do not run skills directly. You run commands; commands use skills.

## Optional Agents

Some workflows can use bounded helper agents for research, planning, execution, review, or verification. Agents are optional and configuration-dependent.

If agents are disabled or unavailable, Blueprint should either use a smaller no-agent path or say clearly what it could not delegate. A missing optional agent should not silently change saved state.

## MCP-Owned Writes

Blueprint uses MCP tools to write structured project artifacts, state, reports, plans, and validation evidence. Those tools know the expected schema and can reject invalid data.

Prefer command-driven writes over manual edits. If an artifact is wrong, use the command that owns that artifact to revise it.

## `.blueprint/`

`.blueprint/` is runtime project state. It can contain roadmap data, phase artifacts, codebase maps, reports, state snapshots, todos, notes, and other durable Blueprint records.

Do not hand-edit `.blueprint/` as a shortcut. Manual edits can bypass validation and leave commands with contradictory state.

## Host-Global State

Blueprint may also use host-global operational state, such as workspace registries or installed extension metadata. Treat that state as operational infrastructure, not project content.

Do not mutate host-global Blueprint state unless a Blueprint command explicitly owns that action.

## Hooks

Hooks are advisory or protective. They can warn about risky edits or guard certain writes, but they are not the source of truth for lifecycle progress.

Use commands such as `/blu-progress`, `/blu-next`, and `/blu-health` to understand current state.

## What Not To Hand-Edit

- `.blueprint/` runtime artifacts.
- Host-global Blueprint state.
- Installed extension directories.
- Generated command catalogs or generated command references.
- Saved phase plans, specs, reviews, or validation evidence when a Blueprint command owns revision.

When in doubt, stop and ask Blueprint to read state before mutating it.
