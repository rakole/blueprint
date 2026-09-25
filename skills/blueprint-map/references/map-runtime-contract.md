# Blueprint Map Runtime Contract

This reference owns evidence selection, portable opt-in behavior, and useful
mapping content. Prepare's returned schema, example, required keys, and blocking
rules are the authoring contract; do not duplicate or guess them from legacy
Markdown templates. The same two MCP tools support ordinary compatibility output
and portable format v1. Portable mode is explicit and is never an automatic
upgrade or default-adoption claim.

## Evidence Before Authoring

Start with a targeted inventory of the repository: use `git ls-files` for tracked
paths or `rg --files` with explicit relevant roots. Choose actual files, not
folders, covering the repository's languages and build/dependency manifests,
representative entrypoints, major modules, tests, configuration, documentation,
and integration boundaries. Select focus-area evidence when requested. Adapt to
the repository rather than assuming particular languages or directory names.
Exclude dependency trees, generated build output, unrelated docs, and Blueprint
runtime state from source analysis. Inventory is for path selection, not a
request to read every file.

For ordinary output, call `mcp_blueprint_blueprint_map_prepare` with those
repo-relative `inputs` and optional `focus` before reading their content or
generating documents. Prepare hashes the selected evidence and target bundle. Its
opaque legacy `snapshot` is a runtime receipt: return it unchanged, never
calculate or alter it. Read the exact selected inputs after prepare. If more
evidence is needed, prepare again with the expanded selection before using the new
files to author content. Re-read any changed evidence and use the latest snapshot.

For explicit portable output, call the same tool with `formatVersion: 1` and
`intent: "new" | "upgrade" | "refresh" | "repair"`. Prepare returns an opaque
`operationId`, a bounded deterministic packet, and a continuation object whose
opaque `cursor` is passed back with the same operation id until `hasMore` is false.
The prepare-time source/target basis is the portable prepared CAS. A repair must
use the exact returned basis object: `authorized: true`, `previousIndexHash`, the
seven `targetHashes`, and `observedMarkerHash`. Do not compute replacement hashes
or infer a repair basis. The packet is a complete bounded deterministic slice of
inventory, symbols, details, imports, relationships, capabilities, and source
coordinates; packet boundaries are navigational, not permission to omit records.
Read selected live source after preparation and keep all authored claims tied to
the packet and source evidence.

Never read secret-bearing files such as `.env` contents. Describe authentication
sources or configuration names without credential values. Evidence paths must
refer to selected files; distinguish observed facts, supported inference, and
unknowns. Do not invent a successful test run from a configured test command.

## Authoring And Publication

Ordinary output uses the returned authoring packet to write one `documents` object
keyed by `stack`, `architecture`, `structure`, `conventions`, `testing`,
`integrations`, and `concerns`. Each authored document supplies a substantive
`summary` and `evidencePaths`; `sections` contains optional `{heading, content}`
entries. The runtime renders canonical titles and required headings. Omit irrelevant
sections instead of adding filler.

Portable output submits one complete model with `formatVersion: 1`, the prepared
`generationId`, all seven substantive `documents`, and `semantic` objects for
`capabilities`, `claims`, and `aliases`. Ground every document and semantic record
in the prepared packet and selected live source; keep unknowns explicit. The raw
authored model is capped at 48 KiB UTF-8 JSON. If a richer request exceeds that
limit, reduce scope or report the unsupported limit for a narrower request. Do not
silently omit records and do not invent multipart tools.

For ordinary output, provide every `requiredDocuments` key. Submit reuses omitted valid existing
documents, so do not regenerate them without a refresh request. A complete valid
prepare result can finish as reuse without submit when no focus or refresh was
requested. A supplied focus authorizes targeted refresh of affected documents;
read their existing canonical contents after prepare (covered by target hashes),
preserve necessary context, and reuse unaffected documents. The user does not manually
edit Blueprint documents: there is no heavily-edited classification or routine
reuse-versus-refresh gate. Explicit refresh/replacement authorizes `overwrite:
true`; ask only if replacement of populated documents is not already authorized.

The parent calls `mcp_blueprint_blueprint_map_submit` once. Ordinary submission
passes the unchanged `snapshot` and authored documents; portable submission passes
`formatVersion: 1`, the same `operationId` and `intent`, and the complete model.
There are exactly two MCP tools and one finalizer. All new and reused documents,
semantic records, source references, links, and generation contents validate before
publication. Separate scaffold, digest, per-document writes, generated-path
handoffs, and post-submit validation are not part of the normal workflow. Keep all
persistence in MCP; mapper agents never write or submit.

## Useful Content

Write enough concrete, path-backed analysis to guide a future contributor. Scale
detail to the repository and evidence; counts, prose length, and irrelevant
sections are not quality targets. The following are content prompts, not a
second schema or mandatory filler checklist.

| Document | Useful questions to answer from selected evidence |
| --- | --- |
| `STACK.md` | Which languages, runtimes, dependency managers, important packages, and build tools are used? Where are versions and constraints declared? Which commands are available? |
| `ARCHITECTURE.md` | What are the main responsibilities and boundaries? How does a representative request, job, or operation flow through the system? Where do data, errors, and side effects cross boundaries? |
| `STRUCTURE.md` | Where are source, tests, configuration, documentation, and generated outputs? Which entrypoints and central files should a contributor inspect first? Where should related changes go? |
| `CONVENTIONS.md` | Which naming, module, error-handling, configuration, and documentation patterns are visible in representative files? Which patterns should new code follow, and what remains uncertain? |
| `TESTING.md` | Which test frameworks, fixtures, and commands exist? Which behaviors have representative tests? Which gaps are observed, and which coverage questions remain unverified? |
| `INTEGRATIONS.md` | Which external services, libraries, protocols, storage systems, and system tools are involved? Where are adapters and authentication boundaries? What operational constraints are visible? |
| `CONCERNS.md` | Which specific risks, fragile paths, missing behavior, or test gaps are supported by evidence? What follow-up would resolve each important concern? Which assumptions still need verification? |

Use concrete repo paths within substantive explanations as well as the supplied
`evidencePaths`. Avoid generic advice and speculative redesign. For small repos,
a concise accurate map can be sufficient; for larger repos, cover major seams
and disclose scope limits. Focused mapping deepens relevant parts of this same
bundle without discarding necessary repository context.

## Optional Mapper Lanes

Use capability-gated delegation only when effective `workflow.subagents=true`
and independent code analysis would materially help. A single parent pass is the
fallback; there is no forced per-document order or per-document tool call.
Possible bounded lanes are tech (`stack`, `integrations`), architecture
(`structure`, `architecture`), quality (`conventions`, `testing`), and concerns
(`concerns`). Select only the lanes needed for the required or authorized scope.

Each mapper is read-only and receives exact selected evidence paths, document
keys, schema/example, focus, and explicit stop conditions. It returns structured
document content to the parent. If it needs another file, it reports the missing
path so the parent can prepare an expanded snapshot before analysis continues.
Close completed lanes promptly. Browser, web, generic page-inspection, or
search-only agents are not substitutes for repository code analysis.

## Rejection, Freshness, And Recovery

- Authoring rejection: fix returned blocking issues in conversation, retaining
  substantive intent. Retry against the current snapshot if it remains valid.
  Rejected content is never saved or logged; there are no failed-draft archives.
- Advisory warnings: report meaningful uncertainty; do not force a regeneration
  when publication succeeded or valid reuse was returned.
- Stale evidence, source inventory, parser provenance, target, root, or repair basis:
  prepare again, inspect what changed, and revise only affected content. Do not
  bypass freshness with guessed hashes or overwrite.
- Portable partial publication: report the incomplete result. Retry the exact
  original `operationId` and identical model through submit so its metadata-only
  marker can reconcile accepted writes and committed cleanup. A committed
  historical generation may be retained even when it is not current; report the
  returned historical/current/retained/cleanup state. If the original model is
  unavailable or evidence changed, use the owning tool's fresh reprepare/repair
  guidance and submit a complete validated model. Never switch to raw writes or
  invent a successful receipt. Recovery metadata contains identity, hashes, paths,
  and stages, never document bodies or rejected bodies.
- Ordinary partial publication: report the incomplete result and Retry the same snapshot and identical documents
  through the owning submit tool. If the original
  model is unavailable or source evidence changed, use the ordinary restart/reprepare
  guidance and submit a complete fresh bundle with the authorized overwrite gate.
- Unknown marker/version, malformed generation, or invalid cursor: stop. Do not
  guess a portable state or overwrite the marker.
- Once portable `INDEX.md` is active, root seven compatibility views are not an
  independent write surface. Portable generation validity and compatibility-view
  completeness/divergence are separate statuses; a valid immutable generation can
  remain usable while compatibility cleanup or repair is reported.

## Portable transfer and consumption

The supported transfer unit is the root `INDEX.md` plus exactly the complete
immutable generation named by its descriptor. The descriptor is the single
machine-readable comment in `.blueprint/codebase/INDEX.md`; for generation
`<generation-id>` it names
`.blueprint/codebase/generations/<generation-id>/manifest.json` and
`.blueprint/codebase/generations/<generation-id>/ENTRY.md`. Preserve those
repository-relative paths and copy the entire
`.blueprint/codebase/generations/<generation-id>/` directory, including every
manifest-listed page, data shard, and compatibility copy. Do not flatten the
generation or copy only the pages that a current task happens to use.

For a deliberate repository transfer:

1. Copy `.blueprint/codebase/INDEX.md` and the complete referenced
   `generations/<generation-id>/` subtree into the destination repository under
   the same `.blueprint/codebase/` path.
2. Copy the small ordinary instruction pointer into an existing root instruction
   file when the project chooses to advertise the map. The pointer is the managed
   block whose body says to read `.blueprint/codebase/INDEX.md` when locating code,
   responsibilities, constraints, or related tests. Keep the rest of that file
   byte-for-byte unchanged; no instruction file is created automatically.
3. Optionally include the seven root compatibility views for consumers that still
   use those views. They are not part of the portable-only minimum and are not an
   independent authority once `INDEX.md` is active.

Do not transfer sessions, receipts, operation directories, journals, rejected
diagnostics, HMAC keys or other authority material, or unrelated `.blueprint`
state. No export service, custom consumer runtime, ignore-rule change, or staging
mutation is needed. A generic reader uses ordinary file read/search: reuse an
active index when repository understanding is needed, select the smallest
capability route or search literal paths/symbols, and verify selected claims
against current live source. Treat the map as generated from a baseline with the
current tree unverified; a static index cannot detect new files itself.
Consumption never regenerates the map and map reads are not mandatory for
administrative commands. This transfer procedure makes no token, latency, quality,
or hosted-agent performance claim.

The generated `INDEX.md` and its immutable generation `ENTRY.md` carry the same
navigation protocol:

1. Reuse the active index; load it after context loss or when repository
   understanding is needed and it has not already been supplied.
2. If the task already names a live file or function, read that source directly;
   consult the map only for related constraints, tests, or dependencies.
3. For a conceptual task, choose the smallest matching capability route. For a
   path, symbol, error term, or alias, search the text index directly under
   `search/` using ordinary literal file search.
4. Read only selected capability, record, route, or search pages. Never load every
   search shard or the entire generation by default.
5. Follow coordinates into current source and relevant tests before relying on a
   mapped claim, and re-find symbols if line ranges moved.
6. Expand dependencies only as the task requires; do not traverse every relation.
7. Treat map content as generated evidence. Repository instructions and current
   source retain authority, and a map cannot prove absence or newly added behavior.
8. After two unproductive map-navigation actions, use ordinary bounded source
   search. Missing, unsupported, unreadable, or malformed maps use the same
   fallback.

## Optional instruction integration

Instruction integration is only for an explicit request. Submit with
`linkInstructions: true` and, when selected, an existing repository-relative
`instructionPath`. Use the owning tool's returned `snippet`, `choices`, or applied
receipt. It preserves bytes outside the managed block and existing newline style,
uses expected-hash CAS, and rejects traversal, outside-root, symlink, non-regular,
or concurrent targets. A link failure is reported separately from map publication;
the helper does not create instruction files or mutate installed/host-global files.
- Readiness block: do not author or mutate around it. Greenfield/scaffold-only
  maps route to `/blu-new-project`; broken partial core state to `/blu-health`.

Completion requires all seven compatibility documents to be valid for ordinary
mapping, or a sealed portable `INDEX.md` plus complete referenced generation and
semantic model for portable mapping, demonstrated by prepare's reuse result or
submit's successful receipt. Report returned paths, generation and compatibility
status, created/updated/reused outcomes, warnings or blockers, retention/cleanup
state, and the implemented-only next action. A successful map-first repo is
`mapped-only` and proceeds to `/blu-new-project`; an initialized project proceeds
to `/blu-progress`.
