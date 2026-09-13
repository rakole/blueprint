# State, Artifacts, And Path Safety

Blueprint-managed runtime state belongs in `.blueprint/` for each project or
workspace. Host-global operational state belongs under the host-specific
Blueprint directory.

## Project State

Common project-local paths:

```text
.blueprint/PROJECT.md
.blueprint/REQUIREMENTS.md
.blueprint/ROADMAP.md
.blueprint/STATE.md
.blueprint/config.json
.blueprint/phases/
.blueprint/reports/
.blueprint/codebase/
.blueprint/impact/
.blueprint/notes/
.blueprint/todos/
.blueprint/backlog/
```

MCP tools own structured writes to these paths. Coding agents should not
hand-edit them to fake command behavior.

## Host-Global State

Host-global state is for cross-project operational data:

- defaults
- workspace registry
- patch registry
- update metadata

It is resolved through runtime host helpers and must be written only through
the owning MCP tools.

## Artifact Contracts

Artifact shape is centralized in `src/mcp/artifact-contracts/index.ts`.
Contracts define:

- id and scope
- owner tool
- path owner
- canonical filename pattern
- freehand policy
- required headings
- locked markers
- placeholder signals
- optional model contract
- scaffold and authoring templates

When changing an artifact:

- Update the contract definition first.
- Update validation, scaffold, and write flows together.
- Add tests for scaffold, validation, and write behavior.
- Keep generated examples from leaking into real authored content.

## Path Safety

Use existing helpers instead of ad hoc path handling.

Do:

- Resolve repo roots before project-local writes.
- Require repo-relative paths where tool contracts expect them.
- Keep `.blueprint/` writes inside the repo's Blueprint root.
- Use safe JSON parsing helpers for model-supplied JSON.
- Normalize phase and artifact identifiers with shared helpers.

Do not:

- Accept absolute paths in repo-relative tool inputs.
- Follow path traversal outside the allowed root.
- Concatenate untrusted strings into write paths.
- Write host-global paths outside runtime host helpers.

## Persistence Writes

Text persistence helpers normalize line endings, run prompt-boundary checks by
default, write through a temporary file, and finish with an atomic rename.
Mutating flows may use `.blueprint/locks/<name>.lock` plus stale-lock cleanup
when concurrent writes would be unsafe.

Do not bypass these helpers for convenience. A direct `fs.writeFile` in a new
tool should be treated as suspicious unless the tool is explicitly outside
Blueprint-owned state and has its own containment story.

## Prompt-Boundary Safety

Some tools inspect prompt-like content for injection markers, unsafe display
markers, encoded payloads, and control characters. Preserve this boundary when
adding model-authored artifacts or reports.

## Discussion Notes And Direct Publication

The discuss tools own phase `XX-DISCUSS-SESSION.json` version 2. Sessions retain
notes, sanitized history, evidence hashes and metadata-only publication journals;
generated models and rendered drafts are never stored. Legacy sessions migrate
through the owning tools, dropping draft payloads. Research and plan candidate
persistence are independent and unchanged.

Prepare supplies selected evidence, sparse authoring schema, grounded defaults,
missing essential fields, records and examples. Record accepts only notes with
CAS and idempotent request IDs. Resolve missing essentials before generating one
model, then pass it directly to finalize. Optional empty fields are valid; only
explicit blocking:true unresolved notes block publication.

Finalize checks freshness, topology, overwrite and revision gates, writes canonical
context and the derived optional log, then syncs selected-phase state and cleans
checkpoints. Its saved/outcome receipt distinguishes rejection, saved context with
incomplete state, and completion. Journals contain hashes, paths and stage metadata.
Before context commits, retry requires the model; afterwards the same request ID
can resume without it after canonical hash verification. Target reconciliation
requires explicit confirmation and reviewed hashes. Mutation failure logging for
discussion and context/log writes retains control metadata and counts only, never
freeform request/result/error prose or content snippets.

## Durable Research Sessions

`blueprint_research_prepare`, `blueprint_research_record`,
`blueprint_research_read`, and `blueprint_research_submit` own version 1
`XX-RESEARCH-SESSION.json` inside the resolved phase directory. JSON-compatible
candidates up to 1 MiB are saved before model/readiness assessment, subject to
the normal input security boundary. Malformed model JSON can be retained as raw
text. Saved drafts are distinct from published, planner-ready research.

The session retains candidates, revision history, notes and request receipts.
Mutations require revision CAS; an uncertain response is retried with the same
request ID and identical arguments. Field set/remove corrections retain the rest
of the candidate. Requests accepted before a crash resume assessment without
creating another revision. Pending publication blocks unrelated candidate writes.

Preparation fingerprints project intent, requirements, roadmap, context, optional
spec, codebase summaries, selected repository evidence and effective configuration,
including absent optional files. Changed inputs need a reviewed refresh with
expectedRevision and acknowledgment. Publication target conflicts require explicit
reconciliation with the observed research hash; neither action discards history.

Submit validates meaningful evidence links and requirement coverage, renders the
existing 17 research sections, and journals artifact, provenance, state, routing
and owned checkpoint cleanup. Canonical Markdown still uses the guarded phase
artifact writer. `XX-RESEARCH-PROVENANCE.json` binds its content hash to the input
basis. Retry verifies completed output bytes before resuming remaining stages.
Final success requires both publication hashes and the input basis to match.

Planning treats stale, malformed or incomplete new provenance as invalid research.
Legacy research without provenance keeps its existing read compatibility, but
explicit reuse requires verified freshness. Reuse retains the original input
basis; preparing again never silently makes stale published evidence fresh.
