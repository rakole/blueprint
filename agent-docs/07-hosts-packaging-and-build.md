# Hosts, Packaging, And Build

Blueprint ships as a private OpenCode plugin package. `package.json` exports
`./dist/opencode/plugin.js` and exposes the `blueprint-opencode` lifecycle
helper. This is not a registry-publication contract: the package remains
`private: true`, and no registry version is published by this repository.

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
The supported opt-in route is `npm run test:integration:opencode`; it builds,
checks the private package, and runs registration only when the pinned host
environment is supplied.

## Installed Lifecycle Contract

The lifecycle helper owns an installer root beside the selected OpenCode config:
`<config-directory>/.blueprint-install`. It installs each package into an
immutable generation and registers one stable, installer-owned `file://` entry
in the config's singular `plugin` array. A ledger records the active and
previous generations. A transaction journal and directory lock protect
interrupted or concurrent changes.

The command surface is:

```text
blueprint-opencode <install|upgrade|rollback|uninstall|status> \
  --config <absolute-opencode-json> \
  [--package <absolute-tarball|blueprint@exact-semver>] \
  [--cwd <absolute-customer-repo>] \
  [--json]
```

`--config` is always required. `install` and `upgrade` also require both
`--package` and an absolute `--cwd`. Later status, rollback and uninstall calls
may omit `--cwd` and use the recorded customer root. Local tarballs must be
absolute `.tgz` paths. Registry input accepts only the unscoped package name
`blueprint` at an exact semantic version; tags, ranges, other names and scoped
names are rejected. Registry installation is a prepared delivery path, not
currently usable, because Blueprint has not been published.

Config updates use strict JSON parsing and preserve unrelated properties and
plugin entries byte-for-byte where possible. JSON with comments is unsupported;
the helper rejects it without changing the file. Existing Blueprint entries or
installer files whose ownership cannot be proved are conflicts, not candidates
for adoption or deletion.

`rollback` activates the exact recorded previous generation after validating
its package closure and `package.json.blueprint.stateCompatibility` contract,
then retains the displaced generation as the new previous generation. It does
not downgrade, restore or delete project `.blueprint/` data or Blueprint's
global runtime state.
`uninstall` removes only the exact owned config entry and known ledger-owned
installer artifacts. It refuses unknown files. Credentials, unrelated config
and plugins, the customer repository, project `.blueprint/`, and
`BLUEPRINT_GLOBAL_HOME` remain untouched.

Every successful mutating command requires an OpenCode restart. `status` checks
the installed package, stable registration and recorded generation intent. It
returns `action`, `status`, `registration`, `active` and `previous`; generation
records include the version, original package source, immutable generation ID,
package root and state-compatibility token. It cannot prove that an already-running
OpenCode process loaded that generation.
`/blu-update` remains an advisory in-session command; package mutation uses this
out-of-session helper.

The chosen `--config` path must also be the config the host actually loads. For
a non-default file, launch OpenCode with the matching `OPENCODE_CONFIG` value;
editing an arbitrary valid JSON file does not alter host config precedence.

## Build Output

`npm run build` runs `scripts/build.mjs`.

The build:

- Removes and recreates `dist`.
- Emits TypeScript declarations.
- Generates the native asset hash and reference manifest.
- Bundles the OpenCode plugin and MCP server.
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

Hook source lives in `src/hooks`; `hooks/hooks.json` is retained legacy wiring.
These advisory hooks are built but not registered by the OpenCode plugin in this slice.

Hooks are advisory. They may warn before risky edits, but they must not become
the persistence layer.

## Install And Local Testing

Build and verify the local package without calling a model:

```bash
npm ci
npm run generate:commands
npm run test:integration:opencode
```

The actual-host registration test is opt-in through `BLUEPRINT_OPENCODE_BIN`,
pointing to the pinned v1.18.34 executable, and `BLUEPRINT_OPENCODE_SOURCE`,
pointing to the matching source checkout. Without both, the route reports the
host check as skipped. Model-driven permission, interaction and lifecycle scenarios
remain separate qualification gates.

A disposable OpenCode config selects the unpacked package export:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///absolute/disposable/package/dist/opencode/plugin.js"]
}
```

Use the bootstrap fixture in `tests/fixtures/opencode/bootstrap/opencode.json`
for the exact config shape. Keep the customer cwd and HOME/XDG directories
separate from the package. Restart OpenCode after changing the config or built
outputs; successful plugin import alone is not proof of registration.

For the private user-facing bootstrap and ongoing lifecycle commands, see
[Install, Upgrade, And Remove](../user-docs/install-upgrade.md). The helper can
be installed into a disposable npm prefix and invoked independently of the
customer repository. Do not install the package globally merely to obtain the
helper.
