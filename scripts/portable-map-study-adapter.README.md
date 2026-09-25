# Portable map study adapter

`portable-map-study-adapter.mjs` is a development-only adapter for future
Blueprint evaluation runners. It starts the bundled MCP server through the
public SDK stdio transport, reads the advertised `tools/list` schemas, and
forwards native tool arguments without rewriting payloads or freshness inputs.
It does not start hosted participants, schedule cohorts, inspect task or gold
data, grade outcomes, or provide a standalone consumer runtime.

```js
import { createPortableMapStudyAdapter } from "./portable-map-study-adapter.mjs";

const adapter = createPortableMapStudyAdapter({
  extensionPath: "/path/to/blueprint",
  cwd: "/path/to/study/workspace"
});

await adapter.connect();
try {
  const result = await adapter.prepare({
    taskClass: "research",
    arm: "current-portable",
    cwd: "/path/to/study/workspace",
    phase: "1",
    portableSelections: [{ kind: "file", recordId: "file-123" }],
    evidenceDelivery: { mode: "full" },
    provenance: { participant: "development-only", repeat: 1 }
  });
  console.log(result.payload, result.accounting, result.provenance);
} finally {
  await adapter.close();
}
```

The adapter verifies the selected tool is advertised, validates the complete
preparation option shape, rejects unknown top-level arguments, and validates
the final native argument object before a call. `nativeArguments` can carry an
allowed public-native argument, but it cannot override a top-level argument or
smuggle arm controls into another route. Native Zod/schema validation and
freshness behavior still happen inside the actual bundled server. A returned
`response` is preserved alongside the parsed `payload`; an MCP validation
result with `isError: true` remains a result and is recorded as an observed
error.

Preparation routes are explicit and class-specific:

| Study class | Public route | Reason |
| --- | --- | --- |
| discuss | `blueprint_discuss_prepare` | Native discuss evidence preparation |
| research | `blueprint_research_prepare` | Native research evidence preparation |
| plan | `blueprint_plan_prepare` | Native plan evidence preparation |
| implementation | `blueprint_phase_context` | Public phase context is the available implementation grounding path |
| review | `blueprint_review_scope` | Public review scope resolves review inputs and settings |
| testing | `blueprint_phase_context` | Generic phase context provides source grounding for tasks that add or adjust tests |

The first three classes accept the native `portableSelections` and
`evidenceDelivery` controls when the selected server advertises them. The
current compact lexical arm accepts only native `evidenceDelivery`; the current
portable arm accepts both native controls. The adapter rejects those controls
for legacy arms, preserving the distinction between baseline, retained legacy,
compact lexical, and portable setups. The current portable arm therefore uses
actual current `*_prepare` schemas. The original baseline cannot receive those
controls. Implementation, review, and
testing do not receive invented compact flags or synthetic compatibility view
payloads; they follow their public routes and preserve whatever the runtime
actually returns. The testing study route uses generic `blueprint_phase_context`
because the mixed testing tasks add source tests and do not begin with a
completed verification or UAT report. It accepts only the common `cwd` and
`phase` arguments. The separate
`blueprint_phase_validation_authoring_context` verification/UAT tool remains
available through direct `invoke()` when a workflow has completed execution
summaries; the adapter does not invent an artifact argument or fabricate those
summaries for a testing study preparation.

`measureMcpResponse` reports `logicalPayloadBytes` for one structured payload,
`mirroredPayloadBytes` for the duplicate `content[0].text` copy when the
server mirrors it, and `serializedResultBytes`/`transportResultBytes` for the
serialized MCP result object. These are byte accounting proxies, not model
tokens, billed usage, or complete JSON-RPC wire measurements.

Action provenance is bounded by `maxActions` (256 by default). It records tool,
class, arm, request key names, status, and byte accounting, but not request
values or returned content. Unknown tools, unknown flags, and standalone arms
fail before an MCP action is recorded. Real native errors are recorded as
observed tool calls. Standalone file-only arms must run without this adapter or
MCP; this module is not a required consumer dependency.

The focused development smoke is:

```sh
npx tsx --test tests/portable-map-study-adapter.test.ts
```

It starts the checked-in bundled server, verifies its 114 advertised tools,
exercises phase-context plus the review/testing routes, checks native source
grounding packets, and covers timeout propagation and rejection provenance.
It uses only a labelled temporary Git fixture. Review returns a ready packet
for an explicit fixture file; testing returns the valid native phase-context
packet for the disposable source-test fixture. A separate direct invocation
test preserves the verification/UAT tool's invalid prerequisite packet when no
completed execution summaries exist.
No hosted study or held-out evaluation data is used.

For a parent-specific development comparison, the same test can optionally
smoke two already-shipped extension bundles:

```sh
PORTABLE_MAP_STUDY_BASELINES=/private/tmp/portable-study-baseline-shipped-74reAW:/private/tmp/portable-wave18-shipped-GSG9gG \
  npx tsx --test tests/portable-map-study-adapter.test.ts
```

The paths are optional disposable inputs for development evidence and are not
required by normal CI. The test records the native review `ready` packet and
the testing phase-context packet for each selected bundle; it does not create
summaries, plans, outcomes, or hosted study state.
