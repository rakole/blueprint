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

## Portable Codebase Map Transfer

The portable map is repository data, not host packaging state. A deliberate
copy keeps `.blueprint/codebase/INDEX.md` and the complete immutable generation
named by its single root descriptor at
`.blueprint/codebase/generations/<generation-id>/`. Preserve these relative paths
and copy every file in that generation, including its manifest-listed data,
search, route, record, semantic, and compatibility pages. A destination does not
need Blueprint, MCP, an installed extension, or build tools to read the Markdown
and JSON with ordinary file operations.

Projects may copy the small managed pointer block into an existing `AGENTS.md`,
`GEMINI.md`, `CLAUDE.md`, or `TABNINE.md` so a generic agent knows when to read
`INDEX.md`. Keep the surrounding instruction file intact; creating or changing an
instruction file is an explicit repository choice. Seven root compatibility views
are optional for portable-only consumers.

Leave sessions, receipts, journals, operation directories, rejected diagnostics,
HMAC keys, and all other hidden `.blueprint` runtime state behind. No export
service, custom reader runtime, ignore-rule change, or staging mutation is part
of this transfer. The map remains generated evidence: readers verify selected
claims against the destination's live source and fall back to ordinary bounded
source search when the index is absent, malformed, stale, or incomplete.

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
