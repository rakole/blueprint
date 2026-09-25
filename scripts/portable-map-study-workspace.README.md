# Portable map study workspace factory

`portable-map-study-workspace.mjs` creates one opaque disposable workspace
from a frozen source directory and a sealed map bundle. It is a development
setup helper for future study orchestration. It does not read task datasets,
gold, participant sessions, outputs, or outcomes, and it does not run a model.

The source input and its expected manifest are required. A manifest is either
a JSON file or an object with a `files`/`entries` array. Every entry contains a
repository-relative `path`, a lowercase SHA-256 `sha256`, and optionally
`bytes`. The factory rejects missing, extra, changed, absolute, parent-traversal,
or symlinked source paths. It returns the deterministic hash of the sorted
`{path, bytes, sha256}` list as `sourceManifest.sha256`; an optional
`manifestSha256` or `treeSha256` is checked against that value. Git metadata,
`.blueprint` state, and `node_modules` are not source inputs.

```js
import {
  createPortableStudyWorkspace,
  STUDY_ARMS
} from "./portable-map-study-workspace.mjs";

const workspace = await createPortableStudyWorkspace({
  sourceRoot: "/frozen/corpus",
  expectedManifest: "/frozen/corpus-manifest.json",
  mapBundleDir: "/frozen/maps/python-library/bundle",
  arm: STUDY_ARMS.blueprintPortable,
  originalExtensionPath: "/path/to/original-extension",
  currentExtensionPath: "/path/to/current-extension",
  opaqueLabel: "caller-owned-opaque-id"
});

try {
  // Blueprint arms are bootstrapped through public project_prepare/project_init
  // automatically unless autoBootstrap:false is supplied.
  const native = await workspace.prepareNative({
    taskClass: "research",
    phase: "1",
    evidenceDelivery: {mode: "full"}
  });
  console.log(native.preparations[0].result.payload);
} finally {
  await workspace.dispose();
}
```

The canonical arms are `blueprint-legacy`, `blueprint-compact`,
`blueprint-portable`, `standalone-source`, and `standalone-portable`.

`blueprint-legacy` uses the supplied original086 server and copies the seven
root compatibility views into `.blueprint/codebase/`. `blueprint-compact` uses
the supplied current server with those same seven views. `blueprint-portable`
uses the current server and copies the seven views plus `INDEX.md` and the
complete referenced generation. The adapter arm mapping is kept inside the
factory: original legacy maps to `baseline-legacy`, compact to
`current-compact-lexical`, and portable to `current-portable`.

`standalone-source` copies only the frozen source. `standalone-portable` adds
only `INDEX.md` and the complete referenced generation under
`.blueprint/codebase/`, plus one ordinary guidance pointer to that index. It
does not create a Blueprint project, a session, an adapter receipt, or a
private runtime artifact. Standalone arms reject `prepareNative` with a typed
`standalone-arm` error.

Map bundles must have a regular `INDEX.md` and one complete referenced
generation. The current portable root descriptor is verified, including its
manifest and entry hashes, every sealed inventory/page checksum, generation
identity, and path containment. The early pilot format without a root marker
is accepted only when it contains exactly one generation; its manifest still
supplies the checksums. Compatibility views are required for Blueprint arms
and verified against the generation's compatibility checksums when present.
The descriptor and manifest form an exact sealed allowlist: undeclared
generation files and conflicting duplicate checksum references fail, and only
captured allowlisted bytes are copied and reverified before the factory returns.

Blueprint setup calls the real public MCP server through
`portable-map-study-adapter.mjs`: `blueprint_project_prepare` with explicit
`auto:true`, followed by `blueprint_project_init` with the frozen synthetic
fixture model exported as `SYNTHETIC_BOOTSTRAP_MODEL`. The runtime owns all
canonical `.blueprint` artifacts and validation. A blocked prepare returns a
`status:"blocked"` receipt without forcing initialization. Native preparation
returns the server's actual result, including `invalid`, `blocked`, and error
statuses. Review receives no files unless the caller supplies discovered
`files`/`reviewFiles`; the factory never seeds scope from gold or a hidden
task. Passing `taskClass` prepares one class; omitting it prepares all six
classes sequentially.

The destination is a random `portable-study-workspace-*` directory under the
chosen destination parent. The caller label is returned as metadata but is not
included in the directory name. Existing destination contents, source/map
symlinks, checksum mismatches, and path escapes fail before a workspace is
returned. `workspaceRoot` and `runtimeEnvironment` are read-only public
snapshots. Integrated arms receive a factory-owned disposable
`BLUEPRINT_GLOBAL_HOME` sibling before bootstrap and pass it to the adapter;
standalone arms receive no runtime environment. `dispose()` removes only the
factory-owned workspace and runtime sibling, including setup-failure cleanup.

Both portable arms receive the product's exact managed instruction-link block,
with the original guidance bytes and newline convention preserved. Native
preparation forwards every adapter-supported evidence/freshness/plan control
and rejects unknown wrapper keys instead of silently dropping them.

Focused development verification:

```sh
node --import tsx --test tests/portable-map-study-workspace.test.ts
```

The test uses a synthetic fresh development source fixture and the checked-in
pilot map only as a sealed transfer input. It makes no navigation calls and
does not use held-out task or gold data.
