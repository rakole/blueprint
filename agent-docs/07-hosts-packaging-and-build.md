# Hosts, Packaging, And Build

Blueprint ships as a private OpenCode plugin package. `package.json` exports
`./dist/opencode/plugin.js`; this is not a registry-publication contract.

The installed package root is separate from the customer repository `cwd`.
OpenCode uses `$XDG_DATA_HOME/opencode` or its platform default, and the plugin
projects `$BLUEPRINT_GLOBAL_HOME` beneath that root unless explicitly overridden.
The primary can read installed guidance only through validated, narrow
`<absolute-dir>/*` allowances for skill and effective-reference directories;
caller restrictions may remove them and specialists remain denied.

## Legacy Host Manifests

- `gemini-extension.json`: Gemini extension manifest.
- `tabnine-extension.json`: Tabnine extension manifest.

These manifests are retained legacy surfaces and are not the OpenCode bootstrap.

## Runtime Host Environment

Runtime host resolution uses:

- `BLUEPRINT_HOST`
- `BLUEPRINT_EXTENSION_PATH`
- `BLUEPRINT_GLOBAL_HOME`

Legacy Gemini state defaults under `~/.gemini/blueprint`; legacy Tabnine state
defaults under `~/.tabnine/blueprint`.

Those legacy host rules do not apply to the OpenCode profile; it never falls
through to Gemini or Tabnine state paths.

## Native Package Contract

`npm run generate:opencode-assets` records sorted SHA-256 hashes, command skill
and effective-input mappings, all 16 agent paths, 17 skill aliases, and the full
reference closure. Required corruption blocks loading; optional specialist
corruption excludes only that specialist with diagnostics. Static catalog and
manifest validity do not prove host readiness.

For qualification, build and pack the exact checkout, install the tarball into
a disposable private prefix, resolve its exported entry to a `file://` URL, and
place that URL in an isolated OpenCode config. Isolate HOME, XDG roots, customer
project, config, and `BLUEPRINT_GLOBAL_HOME`. Do not publish or install globally.

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
