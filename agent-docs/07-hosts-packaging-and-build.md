# Hosts, Packaging, And Build

Blueprint ships as a CLI extension for Gemini and Tabnine.

## Host Manifests

- `gemini-extension.json`: Gemini extension manifest.
- `tabnine-extension.json`: Tabnine extension manifest.

Both host manifests point at built runtime output, not TypeScript source. Keep
manifest behavior aligned when changing host startup.

## Runtime Host Environment

Runtime host resolution uses:

- `BLUEPRINT_HOST`
- `BLUEPRINT_EXTENSION_PATH`
- `BLUEPRINT_GLOBAL_HOME`

The host defaults to Gemini when no explicit or inferred host is present.

Gemini host state defaults under `~/.gemini/blueprint`. Tabnine host state
defaults under `~/.tabnine/blueprint`.

## Build Output

`npm run build` runs `scripts/build.mjs`.

The build:

- Removes and recreates `dist`.
- Emits TypeScript declarations.
- Bundles the MCP server.
- Bundles advisory hooks.
- Copies schema assets needed by artifact contracts.

## Hooks

Hook source lives in `src/hooks`. Hook registration lives in `hooks/hooks.json`.
Host manifests use built hook files from `dist/hooks`.

Hooks are advisory. They may warn before risky edits, but they must not become
the persistence layer.

## Install And Local Testing

Local host testing usually needs:

```bash
npm ci
npm run build
gemini extensions link .
```

Restart the host CLI after linking or changing built outputs.

Use the clean-home smoke script when changing host startup, install behavior,
manifest wiring, or global-state defaults.
