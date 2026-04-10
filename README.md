# Blueprint

Blueprint is a fresh Gemini CLI extension scaffold for building a structured get-things-done workflow inside Gemini CLI.

This repository currently gives us the extension shell and the major extension packaging surfaces described in the official Gemini CLI docs:

- `gemini-extension.json`
- `GEMINI.md`
- `AGENTS.md` and scoped `AGENTS.md` files for Codex
- namespaced custom commands in `commands/`
- hooks in `hooks/hooks.json`
- agent skills in `skills/`
- subagents in `agents/`
- policy placeholder directory in `policies/`
- a Blueprint planning directory at `.blueprint/plans/`

## Install locally for development

Gemini CLI supports local linking for extension development:

```bash
gemini extensions link /Users/rhishi/dev/repositories/blueprint
```

If you want Gemini CLI to install a copy instead of a symlink:

```bash
gemini extensions install /Users/rhishi/dev/repositories/blueprint --consent --skip-settings
```

Restart Gemini CLI after linking or installing so command changes are picked up.

## Scaffolded commands

- `/blueprint:help`
- `/blueprint:intake`
- `/blueprint:plan`
- `/blueprint:execute`
- `/blueprint:review`
- `/blueprint:status`

## Project scripts

```bash
npm run check
```

Runs a lightweight local validator that checks the manifest and the scaffolded extension files.

## Notes

- The current hook only injects a small Bootstrap message to prove hook wiring works.
- The `mcp/` and `themes/` directories are present as future expansion points; there is no MCP server implementation yet.
- The extension theme is defined inline in `gemini-extension.json`.
- Gemini guidance lives in `GEMINI.md`; Codex guidance lives in the root and scoped `AGENTS.md` files.
