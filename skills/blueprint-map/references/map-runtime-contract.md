# Blueprint Map Runtime Contract

This reference owns evidence selection and useful mapping content. Prepare's
returned schema, example, required keys, and blocking rules are the authoring
contract; do not duplicate or guess them from legacy Markdown templates.

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

Call `mcp_blueprint_blueprint_map_prepare` with those repo-relative `inputs` and
optional `focus` before reading their content or generating documents. Prepare
hashes the selected evidence and target bundle. Its opaque `snapshot` is a
runtime receipt: return it unchanged, never calculate or alter it. Read the exact
selected inputs after prepare. If more evidence is needed, prepare again with the
expanded selection before using the new files to author content. Re-read any
changed evidence and use the latest snapshot.

Never read secret-bearing files such as `.env` contents. Describe authentication
sources or configuration names without credential values. Evidence paths must
refer to selected files; distinguish observed facts, supported inference, and
unknowns. Do not invent a successful test run from a configured test command.

## Authoring And Publication

Use the returned authoring packet to write one `documents` object keyed by
`stack`, `architecture`, `structure`, `conventions`, `testing`, `integrations`,
and `concerns` as needed. Each authored document supplies a substantive `summary`
and `evidencePaths`; `sections` contains optional `{heading, content}` entries.
The runtime renders canonical titles and required headings. Omit irrelevant
sections instead of adding filler. Natural multiline prose, code examples, and
honest unknowns should retain their meaning; obey actual returned blocking rules.

Provide every `requiredDocuments` key. Submit reuses omitted valid existing
documents, so do not regenerate them without a refresh request. A complete valid
prepare result can finish as reuse without submit when no focus or refresh was
requested. A supplied focus authorizes targeted refresh of affected documents;
read their existing canonical contents after prepare (covered by target hashes),
preserve necessary context, and reuse unaffected documents. The user does not manually
edit Blueprint documents: there is no heavily-edited classification or routine
reuse-versus-refresh gate. Explicit refresh/replacement authorizes `overwrite:
true`; ask only if replacement of populated documents is not already authorized.

The parent calls `mcp_blueprint_blueprint_map_submit` once with `snapshot` and
`documents`. All new and reused documents must validate before publication.
Separate scaffold, digest, per-document writes, and post-submit validation are
not part of the normal workflow. Keep all persistence in MCP and only use the
seven canonical codebase artifacts.

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
- Stale evidence or target: prepare again, inspect what changed, and revise only
  affected content. Do not bypass freshness with guessed hashes or overwrite.
- Partial publication: report the incomplete result. Retry the same snapshot and
  identical documents using the owning submit tool so its metadata-only recovery
  marker can reconcile accepted writes. If the original model is unavailable or
  source evidence changed, prepare with `restart:true`, read fresh evidence, and
  submit all seven documents with `overwrite:true`. This replaces the pending
  operation only after the new bundle validates; existing canonical files remain.
  Do not switch to raw writes or invent a
  successful receipt. Recovery metadata contains identity, hashes, paths, and
  stages, never document bodies.
- Readiness block: do not author or mutate around it. Greenfield/scaffold-only
  maps route to `/blu-new-project`; broken partial core state to `/blu-health`.

Completion requires all seven canonical documents to be valid, demonstrated by
prepare's reuse result or submit's successful receipt. Report returned paths and
created/updated/reused outcomes, warnings or blockers, and the implemented-only
next action. A successful map-first repo is `mapped-only` and proceeds to
`/blu-new-project`; an initialized project proceeds to `/blu-progress`.
