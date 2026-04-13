# Blueprint Gemini Constraints

## Purpose

This file captures the Gemini CLI and extension constraints that materially shaped the Blueprint architecture. It exists so future implementation sessions do not accidentally drift back toward upstream GSD assumptions that only made sense in a different host environment.

## Locked Runtime Constraints

- Blueprint is installed as a Gemini CLI extension from GitHub, not through a custom installer flow.
- Project-specific state belongs in `.blueprint/`; mutable global state belongs only in `~/.gemini/blueprint/`.
- User-level Blueprint defaults, when supported, live only in `~/.gemini/blueprint/defaults.json`.
- Stateful mutations should happen through an extension-bundled MCP server rather than prompt-only logic.
- Blueprint slash commands are Gemini entrypoints, not shell executables, and callable Blueprint MCP instructions should use runtime FQNs such as `mcp__blueprint__...` instead of bare internal tool ids.
- Hooks are advisory in v1. Blueprint should not depend on statusline injection, hidden settings mutation, or extension self-modification.
- Repo config should not control hook activation; hook configuration belongs to extension-owned `hooks/hooks.json`.
- `/blu-update` is advisory because Gemini extension installation and update flows happen outside the current interactive session.
- `/blu-reapply-patches` must target the global patch registry instead of patching the installed extension copy directly.
- Review, shipping, and peer-CLI orchestration must degrade gracefully when optional external tools are missing.

## Consequences For Implementation

- Bundle runtime code into `dist/` before release so `gemini extensions install https://github.com/<repo>` works without post-install setup.
- Keep commands thin and deterministic by routing filesystem changes through MCP tools with explicit return shapes.
- Prefer direct command specs and shared contracts over hidden runtime conventions.
- Separate project-local artifacts from maintenance-only global registries to keep `.blueprint/` portable across repos.
- Treat config precedence, migration, and defaults loading as MCP-owned behavior rather than per-command prompt logic.
- Treat install, update, restart, and patch replay as operational workflows, not normal in-session slash-command mutations.

## What Future Sessions Should Avoid

- Reintroducing `.planning/`, `/gsd:*`, or installer-managed runtime state.
- Adding omitted upstream commands as hidden aliases without revisiting the retained-command contract.
- Letting high-risk commands skip confirmation gates because another command already checked something earlier.
- Writing extension-owned runtime state into the installed extension directory.
