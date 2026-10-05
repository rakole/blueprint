# Install, Upgrade, And Remove

Blueprint currently ships as a private package. Install it from an exact local
tarball with the packaged `blueprint-opencode` helper. Node.js 20 or newer is
required. Current host evidence covers OpenCode v1.18.34 on Darwin arm64;
Linux and Windows have not yet been qualified.

Choose the absolute OpenCode JSON config you intend to change and the absolute
customer repository that Blueprint will inspect. `install` and `upgrade`
require that repository as an absolute `--cwd`; later lifecycle commands can
use the recorded value. The helper has no implicit config path. Make sure
OpenCode actually reads that same file. If you select a non-default file,
launch the host with the matching path, for example:

```bash
OPENCODE_CONFIG="/absolute/path/to/opencode.json" opencode
```

A successful edit to a different JSON file does not override the host's normal
config precedence, and a `.jsonc` sibling may still be the file OpenCode uses.

## Build A Private Installer

From the Blueprint checkout:

```bash
npm ci
npm run build
BLUEPRINT_BOOTSTRAP="$(mktemp -d)"
BLUEPRINT_VERSION="$(node -p "require('./package.json').version")"
BLUEPRINT_TARBALL="$BLUEPRINT_BOOTSTRAP/blueprint-$BLUEPRINT_VERSION.tgz"
npm pack --ignore-scripts --pack-destination "$BLUEPRINT_BOOTSTRAP"
npm install --prefix "$BLUEPRINT_BOOTSTRAP/helper" \
  --omit=dev --ignore-scripts \
  "$BLUEPRINT_TARBALL"
```

The helper lives at:

```text
$BLUEPRINT_BOOTSTRAP/helper/node_modules/.bin/blueprint-opencode
```

The examples below assume the same shell so these variables remain defined.
Keep this disposable prefix for the lifecycle operations below, or rebuild it
from a trusted exact tarball before a later operation. The customer repository
is supplied explicitly with `--cwd`; it does not need to contain the helper or
tarball. This bootstrap prefix is separate tooling outside the owned lifecycle
installer root. Lifecycle `uninstall` leaves it in place; remove the disposable
prefix yourself when you no longer need the helper.

## Install

Replace the example paths with absolute paths:

```bash
"$BLUEPRINT_BOOTSTRAP/helper/node_modules/.bin/blueprint-opencode" install \
  --package "$BLUEPRINT_TARBALL" \
  --config "/Users/you/.config/opencode/opencode.json" \
  --cwd "/Users/you/work/customer-repo"
```

The helper creates `.blueprint-install` beside that config, installs an
immutable package generation, and adds one stable owned `file://` entry to the
config's `plugin` array. It preserves unrelated config and plugins. Restart
OpenCode after the command succeeds.

## Check Status

```bash
"$BLUEPRINT_BOOTSTRAP/helper/node_modules/.bin/blueprint-opencode" status \
  --config "/Users/you/.config/opencode/opencode.json" \
  --cwd "/Users/you/work/customer-repo"
```

Add `--json` for structured output. Status reports whether the owned
registration and recorded active and previous generations are valid. Verify
`active.version`, `active.sourceSpec` and `active.generationId` against the
package you intended to install; `previous` identifies the retained rollback
generation when one exists. Status does not inspect or reload an already-running
OpenCode process. Restart first, then run `/blu-help` in the customer repository
to check the loaded command surface.

## Upgrade

Build or obtain another exact Blueprint tarball, then use the same helper and
config:

```bash
"$BLUEPRINT_BOOTSTRAP/helper/node_modules/.bin/blueprint-opencode" upgrade \
  --package "/absolute/path/to/new-blueprint.tgz" \
  --config "/Users/you/.config/opencode/opencode.json" \
  --cwd "/Users/you/work/customer-repo"
```

The active generation becomes the recorded previous generation only after the
new package and compatibility contract pass validation. Restart OpenCode after
success. Blueprint is not published today. The public helper rejects
`blueprint@<exact-semver>` before invoking npm; that syntax is reserved for a
future release after the published package identity and lifecycle path are
qualified.

`/blu-update` is advisory. It can report update guidance but does not install or
replace the package inside an OpenCode session.

## Roll Back

```bash
"$BLUEPRINT_BOOTSTRAP/helper/node_modules/.bin/blueprint-opencode" rollback \
  --config "/Users/you/.config/opencode/opencode.json" \
  --cwd "/Users/you/work/customer-repo"
```

Rollback validates and activates the exact recorded previous generation. It
keeps the displaced generation available as the new previous generation. It
does not rewrite project `.blueprint/` data or Blueprint global runtime state.
Restart OpenCode after success.

If rollback reports incompatible state, keep or return to the currently active
compatible package. Treat project/global-state migration or backup restoration
as a separate, explicit recovery operation. The helper will not hide the
incompatibility by downgrading runtime state.

## Uninstall

```bash
"$BLUEPRINT_BOOTSTRAP/helper/node_modules/.bin/blueprint-opencode" uninstall \
  --config "/Users/you/.config/opencode/opencode.json" \
  --cwd "/Users/you/work/customer-repo"
```

Uninstall removes the exact installer-owned config entry and known owned
package artifacts. It preserves unrelated plugins and config, credentials, the
customer repository, project `.blueprint/`, and `BLUEPRINT_GLOBAL_HOME`. It
refuses to remove unknown files from the installer root. Restart OpenCode after
success.

The transaction remains recoverable across the cleanup phase. An interruption
before uninstall commits restores the prior active installation. Once config
deactivation and the cleanup ledger are committed, a later `status` or lifecycle
command resumes the exact remaining owned deletions to completion; it does not
claim that a partly deleted generation was restored.

## When The Helper Refuses

The helper stops without adopting or deleting ambiguous state. Common causes
include a relative config or tarball path, JSON with comments, a package tag or
version range, an existing conflicting Blueprint plugin entry, a concurrent
operation, or unknown files in the owned installer root.

Do not edit `.blueprint-install` to force recovery. Keep the error and the
config intact. With `--json`, failures have a machine-readable `code` and
`message`, use `LIFECYCLE_ERROR` as the current failure code, and exit nonzero.
