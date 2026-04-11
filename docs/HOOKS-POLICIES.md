# Blueprint Hooks And Policies

## Planned Hooks

No hook code ships in the current discovery-repair branch.
This document locks the future hook boundary so Phase 3 runtime work does not accidentally imply shipped hooks that do not exist yet.

Blueprint keeps only advisory hooks in v1 planning.

### 1. Read-before-edit advisory

Purpose:
- remind Gemini to read an existing file before editing it
- reduce edit loops and runtime rejections

Scope:
- existing files inside the repo

Behavior:
- advisory only
- never silently blocks user-approved work

### 2. `.blueprint` write guard

Purpose:
- warn when a write to `.blueprint/` appears to contain prompt-injection patterns or malformed artifact structure

Scope:
- writes and edits targeting `.blueprint/`

Behavior:
- advisory only
- paired with MCP validation rather than raw shell writes

### 3. Workflow advisory

Purpose:
- warn when the model edits repo files directly in a Blueprint project without going through a managed command flow

Scope:
- non-`.blueprint` writes during a Blueprint-managed session

Behavior:
- advisory only
- suggests the right Blueprint command rather than blocking

## Explicitly Omitted Hook Surfaces

- statusline hook
- context-bridge or statusline-fed warning system
- extension self-update hooks
- installer-managed settings rewrites

## Policy Rules

### Destructive shell restrictions

The future extension policy should default to denying direct use of:

- `rm -rf`
- `git reset --hard`
- `git checkout --`
- `git clean -fd`
- writes to the installed extension directory

These actions should happen only through bounded MCP-backed flows where required, such as workspace removal or patch replay.

### Git mutation guidance

- `ship`, `undo`, `pr-branch`, `cleanup`, `new-workspace`, and `remove-workspace` require explicit confirmation gates.
- Commands that change git state must summarize what they intend to mutate before mutation.

### Artifact integrity guidance

- `.blueprint/` mutations should prefer MCP tools over raw shell writes.
- commands that scaffold or rewrite artifacts must validate required fields before returning success.

## Future Hook Implementation Notes

- Hook code should live under `src/hooks/` and be bundled to `hooks/`.
- Hook configuration should be centralized in `hooks/hooks.json`.
- Repo config must not enable or disable hooks; `.blueprint/config.json` is not a second hook-control surface.
- Hook behavior should be testable using stdin/stdout fixtures once hook code lands.
