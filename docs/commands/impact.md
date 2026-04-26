# `/blu-impact`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes after implementation. The root `/blu` router may dispatch here only when the live command catalog marks `impact` as `implemented`. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `impact` uses the shared long-running-mutation posture because it may persist a bounded report bundle under `.blueprint/impact/<impact-id>/`.
- Until the manifest, primary skill, registered MCP tools, docs, tests, and built assets align, `/blu-impact` remains planned metadata only and must not be recommended as runnable by `/blu`, `/blu-help`, `/blu-progress`, or `/blu-next`.

## Purpose

`impact` computes an evidence-backed blast-radius report for proposed or actual changes before implementation, merge, or release. V1 is advisory and read-mostly: deterministic MCP tools resolve the change scope, load Blueprint and repo context, classify impacted surfaces, separate risk from confidence, call out unknowns instead of inventing certainty, and optionally persist a bounded report bundle without mutating source files, roadmap state, PR state, deployment state, command catalog state, or the installed extension directory.

## Command Path And Examples

- CLI command path: `/blu-impact`
- Root router form: `/blu impact`
- Argument hint: `[description] [--staged|--working-tree|--range <base..head>|--base <ref> --head <ref>|--files <paths...>|--diff-file <path>|--phase <phase>|--roadmap-item <id>|--seed-file <path>|--meta key=value|--ci|--fail-on=block|--no-write|--output=human|json|markdown|pr-comment|summary]`
- `/blu-impact --staged`
- `/blu-impact "Add checkout payment retry support"`
- `/blu-impact --range main..HEAD --meta service=checkout --meta compliance=PCI`

## Inputs, Project State, And Prerequisite Artifacts

- Optional description, explicit file paths, seed file, diff file, git scope flags, phase number, roadmap item, metadata flags, output mode, and CI policy flags. Phase and roadmap item inputs select Blueprint context targets; they do not prove changed-file scope on their own.
- A git repository is preferred for high-confidence scope resolution, but description-only advisory planning runs are allowed at low confidence.
- `.blueprint/` project state, roadmap, requested phase artifacts, command catalog metadata, command assets, artifact contracts, package metadata, configured CODEOWNERS candidates, optional impact ownership metadata, optional dependency graph metadata, and optional impact configuration improve confidence when present.
- Missing ownership, dependency graph, compliance map, or test map metadata must become explicit unknowns or warnings, not false proof of limited impact.
- Phase 6 context loading supports `includeRuntime`, `includeCatalog`, and `includeArtifacts`; setting one to `false` omits that optional section with a deterministic warning and does not by itself make context `partial`.
- Requested `phase` and `roadmapItem` targets resolve independently. `roadmapItem` can match phase number, phase name, or roadmap requirement id; duplicate phase numbers are deduped and sorted, while unresolved requested targets make context `partial`.

## Outputs

- User-facing result: concise impact status, confidence, top impacted areas, required reviewers, required tests, blocking findings, warnings, unknowns, and next actions.
- Durable artifacts when writing is enabled:
  - `.blueprint/impact/<impact-id>/IMPACT.md`
  - `.blueprint/impact/<impact-id>/impact.json`
  - `.blueprint/impact/<impact-id>/summary.json`
  - optional `.blueprint/impact/<impact-id>/evidence.jsonl`
  - optional `.blueprint/impact/<impact-id>/review-checklist.md`
  - optional `.blueprint/impact/<impact-id>/QUESTIONS.md`
- Repo side effects: no source-file, roadmap, phase-state, PR, deployment, command-catalog, or installed-extension mutation.
- Advisory statuses are `PASS`, `WARN`, and `BLOCK`; local runs complete with exit `0` when analysis succeeds, while CI may opt into policy failure through `--ci` or `--fail-on`.

## Blueprint And Global State Reads

- `.blueprint/config.json`
- `.blueprint/impact/config.json`
- `.blueprint/impact/ownership.json`
- `.blueprint/impact/dependency-graph.json`
- `.blueprint/impact/seeds/*.json`
- `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, `.blueprint/ROADMAP.md`, `.blueprint/STATE.md`
- `.blueprint/phases/**`
- `.blueprint/codebase/**`
- `.blueprint/workstreams/**` when relevant to current state
- `~/.<host>/blueprint/impact.defaults.json`
- command catalog, command specs, manifests, skills, agents, MCP tool registry metadata, and artifact contracts
- repo files needed for path-level surface classification, package/test/doc hints, ownership metadata, and dependency graph construction

## Blueprint And Global State Writes

- `.blueprint/impact/<impact-id>/IMPACT.md`
- `.blueprint/impact/<impact-id>/impact.json`
- `.blueprint/impact/<impact-id>/summary.json`
- optional `.blueprint/impact/<impact-id>/evidence.jsonl`
- optional `.blueprint/impact/<impact-id>/review-checklist.md`
- optional `.blueprint/impact/<impact-id>/QUESTIONS.md`

## Required MCP Tools

- `blueprint_impact_config_get` -> `{config, provenance, warnings, errors, configHash}`
- `blueprint_impact_scope_resolve` -> `{scope, changedFiles, git, diffStats, patchHash, scopeFingerprint, confidence, warnings}`
- `blueprint_impact_context_load` -> `{status, project, config, roadmap, phases, catalog?, commandAssets?, artifactContracts?, runtime?, repoHints, warnings}`
- `blueprint_impact_analyze` -> `{phaseStatus, impactId, status, impactStatus, risk, confidence, surfaces, areaSummary, surfaceSummary, ownership, dependencyGraph, findings, obligations, unknowns, evidence, report}`
- `blueprint_impact_report_write` -> `{status, impactId, impactDir, paths, written, warnings}`
- `blueprint_impact_output_render` -> `{phaseStatus, mode, status, impactStatus, content, impactId, warnings}`

## Scope Resolution Contract

- Prefer staged changes, then dirty working tree, then branch diff against configured or detected default branch, then CI PR refs, then `HEAD^..HEAD` in CI, then description-only low-confidence advisory scope.
- Honor explicit `--range`, `--base` and `--head`, `--files`, `--diff-file`, and `--seed-file` inputs before defaults when resolving file scope.
- Treat `--phase` and `--roadmap-item` as Blueprint context targets resolved by `blueprint_impact_context_load`; they remain low-confidence/advisory for impact unless paired with file, git, diff, or seed scope evidence.
- Enforce repo-relative path containment for explicit files, seed files, diff files, and config inputs.
- Secret values must not be read or printed. Secret-sensitive reporting is limited to path, key, and provenance.
- Description-only scope must return low confidence, include `scope not proven`, and cannot produce a high-confidence `PASS`.

## Analysis Contract

- Phase 6 normalizes file scope from top-level `changedFiles`, top-level `files`, nested `scope.files`, and nested `scope.changedFiles`; mismatches produce a deterministic union warning.
- Phase 6 detects Blueprint runtime surfaces such as command manifests, command docs, command catalog, MCP server and tool modules, artifact contracts, command resources, skills, agents, extension manifests, hooks, tests, docs, and `dist/**`.
- Phase 6 detects generic package runtime, build config, repo config, environment config, secret-sensitive, docs, generated, source, repo-root, and unknown surfaces with deterministic priority ordering.
- Phase 6 resolves effective impact config from built-ins plus invocation `config`, then honors `ownership.sources`, `ownership.fallbackReviewers`, `dependencyGraph.sources`, and `dependencyGraph.customGraphFiles`. Configured source paths must stay repo-contained; path escapes fail hard.
- Ownership analysis checks configured CODEOWNERS candidates in configured order, selects the first existing configured CODEOWNERS file, applies last-match-wins within that file, augments those rules with optional `blueprint.impact.ownership.v1` metadata, and applies fallback reviewers only when no specific owner matched. Malformed optional ownership metadata yields a warning and structured unknown, not a crash.
- Missing owner coverage becomes structured unknowns. Sensitive paths or sensitive ownership rules with missing owner produce an advisory `BLOCK` finding when `risk.blockOnSensitiveUnknownOwner` is enabled.
- Dependency analysis honors configured package-json, package-lock, bounded TS/JS import scan, and optional `blueprint.impact.dependency-graph.v1` graph sources. It reports sources used, nodes, edges, reverse dependents by path, coverage status, and coverage gaps. Malformed optional graph metadata yields a warning and structured unknown; graph source path escapes fail hard.
- Missing or partial reverse dependency coverage for package runtime, contract-like Blueprint runtime, secret/security-sensitive, source, or package changes becomes structured `unknown.reverseDependencies.*`; absent graph data must never be phrased as proof of limited impact.
- Mixed generated/source changes keep source as an impact driver and add a dependency coverage unknown rather than treating the scope as generated-only.
- Phase 6 consumes provided `context.catalog`, `context.commandAssets`, `context.runtime`, and `context.artifactContracts` when present, or loads live read-only catalog/runtime/artifact context when context is omitted. Missing or malformed catalog/runtime/artifact context for contract-like surfaces becomes explicit warnings, unknowns, and evidence rather than a contract-safety claim.
- Phase 6 blocks when a catalog entry declared `implemented` is missing its command spec, manifest, primary skill, or required MCP tools according to catalog/runtime substrate evidence. Planned `/blu-impact` missing its manifest or skill remains expected and does not itself block.
- Phase 6 conservatively blocks router/help/progress/next surfaces for planned-command exposure review only when those surfaces changed and catalog context contains non-implemented commands; benign guardrail text in non-router docs does not create that finding by itself.
- Phase 6 creates typed obligations for command, MCP, artifact-contract, skill, agent, extension manifest, hook, package/build, environment, secret-sensitive, generated, and dist/build surfaces. Obligations include deterministic ids, category, severity, status, impacted files, source surfaces, required actions, and non-empty evidence references.
- Phase 6 checks dist/build readiness: missing `dist/mcp/server.js` blocks extension/runtime source readiness, runtime or extension changes without changed `dist/**` coverage produce a build/dist warning and unknown, and generated-only `dist/**` changes produce provenance warnings and obligations without claiming stale content.
- Phase 7 full scoring remains deferred. Phase 6 risk/confidence stays simple while reflecting deterministic ownership, contract, build, and obligation signals.
- Finding generation keeps stable ids, non-empty evidence references, deterministic sorting, separate severity/status/risk/confidence, and required actions.
- Agents may help narrative synthesis only when a future skill enables them; MCP tools own deterministic scope, findings, risk, confidence, status, and output paths.

## Skills And Subagents

- Primary skill: `blueprint-impact`
- Optional subagents: none

## Dependencies

- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/COMMAND-BASELINE.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- `docs/RUNTIME-REFERENCE.md`
- Related command docs:
- `docs/commands/code-review.md`
- `docs/commands/docs-update.md`
- `docs/commands/pr-branch.md`
- `docs/commands/ship.md`

## Related Command Docs

- `docs/commands/root-router.md`
- `docs/commands/help.md`
- `docs/commands/progress.md`
- `docs/commands/next.md`
- `docs/commands/code-review.md`
- `docs/commands/add-tests.md`
- `docs/commands/pr-branch.md`
- `docs/commands/ship.md`

## External Shell Or Git Dependencies

- External dependencies:
- `git`
- none for provider-specific PR APIs in V1

## Shell Risk Profile

- Low: local git inspection and bounded `.blueprint/impact/` report writes only.

## Risk Notes

- `BLOCK` is an advisory impact status, not an implicit repo mutation or approval action.
- In CI, `--ci` should default to `--fail-on=block`; local advisory use should not fail automatically on `BLOCK`.
- V1 must not post PR comments, mutate PR metadata, create todos, create roadmap phases, deploy, or change source files.

## User Prompts And Confirmation Gates

- Ask for a scope clarification when multiple explicit scope flags conflict or no resolvable scope and no description are present.
- Ask before overwriting an existing impact bundle unless a future config explicitly permits reuse or overwrite.
- Do not require high-risk mutation confirmation because V1 has no high-risk mutation path.

## Edge Cases

- Clean repo with no description or seed.
- Description-only planning request with no provable diff.
- Missing git binary or non-git directory.
- Invalid seed/config JSON or unsupported schema version.
- Explicit paths outside the repo root.
- Sensitive paths excluded by ignore rules.
- Missing ownership, compliance, dependency, or test metadata.
- Generated-only changes versus generated plus source changes.
- Declared implemented command missing manifest, primary skill, or required MCP tool.
- Planned command accidentally exposed by router/help/progress surfaces.

## Failure Modes And Recovery

- If scope cannot be resolved at all, stop with a scope failure and guidance for `--staged`, `--working-tree`, `--range`, `--files`, `--diff-file`, or a description.
- If config or seed validation fails, return a tool/runtime error without writing partial report artifacts.
- If report validation fails, repair the report model against the impact contract and retry once through MCP before stopping.
- If optional metadata is missing, continue with explicit unknowns unless the configured policy blocks sensitive unknowns.
- If git inspection fails for a selected mode, report the failed mode and suggest a supported explicit scope instead of falling back silently.

## Acceptance Criteria

- Remains non-routable until its manifest, primary skill, required MCP tools, docs, tests, and built assets align and the live catalog marks `impact` as `implemented`.
- Produces evidence-backed impact status, risk, confidence, findings, obligations, unknowns, and next actions.
- Writes only the declared `.blueprint/impact/<impact-id>/` report bundle when writing is enabled.
- Does not mutate source files, roadmap state, phase state, command catalog state, PR state, deployment state, or the installed extension directory.
- Keeps missing metadata visible as unknowns rather than false certainty.
- Keeps `/blu`, `/blu-help`, `/blu-progress`, and `/blu-next` limited to implemented commands.

## Test Cases

- Staged diff scope.
- Working tree diff scope.
- Commit range and base/head scope.
- Explicit files scope.
- Diff file scope.
- Description-only low-confidence scope.
- Invalid path and invalid config fixtures.
- Command manifest, command doc, MCP tool, artifact contract, skill, agent, extension manifest, hook, package/config, generated, docs-only, and sensitive-path changes.
- Missing ownership and missing dependency graph fixtures.
- Implemented command missing manifest, primary skill, or required MCP tool from injected catalog context.
- Planned `/blu-impact` missing manifest/skill remains expected and non-blocking while declared `planned`.
- Missing or malformed catalog/runtime/artifact context for contract-like surfaces produces explicit unknowns and warnings.
- Router/help/progress/next planned-command exposure review blocks while benign non-router guardrail docs do not.
- Command, MCP, artifact, skill/agent, extension, hook, package/build, env, secret, runtime source, generated-only, and mixed source/generated scopes produce deterministic obligations.
- Missing `dist/mcp/server.js`, runtime source without dist coverage, and generated-only dist provenance are reported distinctly.
- Planned command remains non-routable until runtime substrate exists.
