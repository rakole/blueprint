# `/blu-research-phase` Frontier Research And Improvement Plan

**Status:** research in progress
**Created:** 2026-05-12
**Scope:** discovery-only documentation for improving `/blu-research-phase`; no command, skill, MCP, schema, source, or test behavior is changed by this document.

## Repo Workflow Baseline

`/blu-research-phase` is a Blueprint long-running mutation command that produces planner-grade, phase-scoped `XX-RESEARCH.md` content through MCP-owned state paths. The current workflow is defined by these runtime sources:

- `commands/blu-research-phase.toml`
- `skills/blueprint-phase-discovery/SKILL.md`
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- `docs/commands/research-phase.md`
- `agents/blueprint-researcher.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/artifact-contracts/index.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/phase.ts`
- `tests/phase-discovery-research.test.ts`
- `tests/mcp-contract-audit-metadata.test.ts`

The command currently:

1. Resolves a phase and refuses to draft without usable `XX-CONTEXT.md`.
2. Reads actual saved context, existing research, checkpoint state, effective config, refreshed state, command catalog, and the canonical `phase.research` artifact contract.
3. Honors `research.external_sources` as `off`, `ask`, or `auto` before any external verification.
4. Separates repo evidence, official or supplied external references, and inference in final research.
5. Uses topic strands, checkpoints inconclusive work, and deletes only research-owned checkpoint state after success.
6. Drafts from `contract.authoringTemplate`, writes only through `blueprint_phase_artifact_write`, repairs one invalid write attempt, then syncs `STATE.md` and routes from refreshed MCP state.
7. Uses `blueprint-researcher` only as a capability-gated, bounded Blueprint research or code-analysis sidecar; the parent command owns external evidence packets, synthesis, persistence, checkpointing, state update, and routing.

## Research Questions

- What do current official docs and authoritative papers recommend for codebase research, dependency/tool selection, source-backed agentic investigation, and evidence synthesis?
- Where does the current `/blu-research-phase` contract already match those practices?
- Which improvements would make the command more reliable and planner-useful without violating Blueprint boundaries: MCP-owned persistence, repo truth first, context read-only, implemented-only routing, and capability-gated agents?

## Agent Research Contributions

Each research agent owns exactly one section below. Preserve other sections.

### R1. Agentic Codebase Investigation Systems

<!-- AGENT:R1:START -->
#### Sources Checked

All sources below were accessed on 2026-05-12. Only official product or protocol documentation, project-author pages, and arXiv papers were used.

- Anthropic Claude Code docs, "Common workflows" and "Best practices for Claude Code": https://code.claude.com/docs/en/common-workflows and https://code.claude.com/docs/en/best-practices
- GitHub Docs, "About GitHub Copilot cloud agent" and "Model Context Protocol (MCP) and GitHub Copilot cloud agent": https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent and https://docs.github.com/en/copilot/concepts/agents/cloud-agent/mcp-and-cloud-agent
- Devin Docs, "Interactive Planning": https://docs.devin.ai/work-with-devin/interactive-planning
- Gemini CLI docs, "Provide Context with GEMINI.md Files" and "MCP servers with Gemini CLI": https://google-gemini.github.io/gemini-cli/docs/cli/gemini-md.html and https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md
- Model Context Protocol spec, "Tools" (`2025-06-18`): https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- OpenAI, "Unrolling the Codex agent loop": https://openai.com/index/unrolling-the-codex-agent-loop/
- OpenAI Codex use cases, especially "Understand large codebases": https://developers.openai.com/codex/use-cases
- Sourcegraph Cody docs, "Cody Context": https://sourcegraph.com/docs/cody/core-concepts/context
- Aider docs, "Repository map": https://aider.chat/docs/repomap.html
- SWE-bench project page and paper: https://www.swebench.com/original.html and https://arxiv.org/abs/2310.06770
- SWE-agent paper: https://arxiv.org/abs/2405.15793
- RepoGraph paper: https://arxiv.org/abs/2410.14684
- CodeCompass paper: https://arxiv.org/abs/2602.20048
- SWE Context Bench paper: https://arxiv.org/abs/2602.08316
- Evaluating `AGENTS.md` paper: https://arxiv.org/abs/2602.11988
- SWE-Skills-Bench paper: https://arxiv.org/abs/2603.15401
- MCP-Bench paper: https://arxiv.org/abs/2508.20453

#### Key Findings

- Frontier coding-agent workflows consistently separate exploration from execution. Claude Code explicitly recommends "explore first, then plan, then code"; Devin's Interactive Planning starts with an initial assessment of relevant files, key findings, and implementation questions; OpenAI Codex positions large-codebase work as tracing flows, mapping unfamiliar modules, and finding the right files before edits.
- Effective codebase investigation is not "read more files"; it is guided context acquisition. Sourcegraph Cody combines keyword search, code search, and code graph context. Aider sends a concise repo map of important classes, functions, types, signatures, and defining lines with each change request. RepoGraph and CodeCompass both argue that repository-level structure and graph navigation improve code-agent performance, especially when important dependencies are not discoverable through lexical search alone.
- Tool and interface design materially change agent behavior. SWE-agent attributes gains to an agent-computer interface designed for repository navigation, editing, and running programs. MCP-Bench similarly evaluates agents on tool schema understanding, multi-step planning, grounding in tool outputs, and cross-tool orchestration rather than isolated API calls.
- Context files and skills help only when minimal, current, and task-fit. Gemini CLI and Codex both load hierarchical repo instructions, but the `AGENTS.md` evaluation paper found broad context files can reduce task success and increase cost when they add unnecessary requirements. SWE-Skills-Bench found most tested skills had no pass-rate improvement and some degraded performance through version-mismatched guidance.
- Product systems increasingly constrain autonomous investigation with scoped environments and permissions. GitHub Copilot cloud agent works in an ephemeral GitHub Actions environment where it can explore, plan, test, and open PRs; its default GitHub MCP token is read-only for the current repository, and Playwright MCP is localhost-scoped by default. Codex notes that MCP-provided tools are outside Codex's shell sandbox and must enforce their own guardrails.
- Reusable experience is valuable only when accurately selected and summarized. SWE Context Bench reports that correctly retrieved summaries of prior related work can improve accuracy and reduce runtime/token cost, while unfiltered or incorrectly selected context can be neutral or harmful.

#### Relevance To Current Blueprint Baseline

- Strong alignment: `/blu-research-phase` already encodes the main frontier pattern by making research a separate pre-planning command, requiring saved `XX-CONTEXT.md`, preserving `XX-CONTEXT.md` as read-only, drafting from the `phase.research` contract, and routing through refreshed MCP state instead of jumping directly to implementation.
- Strong alignment: the current topic-strand fallback and research-owned checkpoint model match the broader guidance to avoid infinite exploration, preserve resumable state, and keep the parent context clean when bounded sidecar investigation is useful.
- Strong alignment: Blueprint's parent-owned external evidence packet is safer than letting arbitrary sidecars browse. It fits the Codex/GitHub/MCP lesson that host or MCP tools must own real guardrails, not rely on the model to remember policy.
- Partial gap: current research quality rules ask for repo evidence and sources, but they do not require a visible "investigation trace" shape such as relevant files checked, retrieval mode used, key findings, open implementation questions, and why each topic strand is complete enough for planning.
- Partial gap: current repo-truth-first guidance is mostly file/content oriented. Frontier systems increasingly use compact maps, symbol graphs, code graph/dependency navigation, and previous-experience summaries to avoid both blind lexical search and context flooding.
- Partial gap: Blueprint uses a capability-gated `blueprint-researcher`, but the contract could be clearer that subagents should answer bounded evidence questions and return structured findings, not broad plans or unsourced recommendations.

#### Improvement Opportunities

- Add an explicit research "initial assessment" subsection to `XX-RESEARCH.md` or to the runtime drafting guidance: relevant repo files/artifacts inspected, major findings, implementation questions, and confidence. This mirrors Devin's initial assessment while staying Blueprint-owned and planner-facing.
- Introduce a compact "navigation evidence packet" before deep strand work: saved codebase summaries, relevant source paths, symbol/function names, dependency edges when available, and retrieval mode (`repo artifact`, `rg`, `codebase summary`, `official reference`, `inference`). This would operationalize Sourcegraph/Aider/RepoGraph/CodeCompass patterns without adding a new persistence owner.
- Require each topic strand to close with a small planning handoff: recommendation, affected files/modules, validation/test implications, and unresolved blockers. This ties research to SWE-bench-style executable verification and makes `/blu-plan-phase` less likely to re-research.
- Tighten subagent output expectations: a `blueprint-researcher` sidecar should return bounded findings with source classes, paths/URLs, confidence, and unanswered questions; it should not produce final persisted research or claim external fetches it did not perform.
- Treat context files, skills, and saved summaries as high-value but potentially stale inputs. Research should cite them as repo evidence, then check whether the live repository still agrees before using them as planner-grade truth.
- Consider future MCP/tool metadata improvements for research tools: annotate read-only versus mutating tools where supported, expose resource links or structured source packets for large evidence, and keep external/open-world evidence clearly labeled.
- Add evaluation fixtures or golden samples for "research usefulness", not only structural validity: a good artifact should identify the right files, map recommendations to requirements, name verification paths, and distinguish official external claims from repo inference.

#### Risks And Uncertainties

- Some strongest 2026 findings are from recent arXiv papers, not mature production standards; they are useful directionally but should not be treated as settled law.
- Graph/navigation systems can help hidden-dependency discovery, but adding one prematurely could expand Blueprint's surface area. A smaller first step is to require the research artifact to record how it found relevant files and where lexical search may be insufficient.
- More context can hurt. The `AGENTS.md`, SWE Context Bench, and SWE-Skills-Bench results all warn that broad, stale, or misselected context increases cost and can reduce success. Blueprint should improve retrieval quality and source labeling before increasing research volume.
- External official docs remain freshness-sensitive. The current `research.external_sources` gate is correct; any improvement should preserve `off`/`ask`/`auto` behavior and avoid implying live verification when the run was repo-only.
<!-- AGENT:R1:END -->

### R2. Repository Mapping And Code Search Research

<!-- AGENT:R2:START -->
#### Sources Checked

- GitHub Docs, "Understanding GitHub Code Search syntax," https://docs.github.com/en/search-github/github-code-search/understanding-github-code-search-syntax, accessed 2026-05-12. Official syntax for exact strings, boolean operators, `repo:`, `language:`, `path:`, `content:`, and `symbol:` qualifiers; notes that symbol search is definition-oriented and Tree-sitter-based.
- GitHub Docs, "About GitHub Code Search," https://docs.github.com/en/search-github/github-code-search/about-github-code-search, accessed 2026-05-12. Official scope and limitation statement: scalable code-aware search, code navigation, indexed-code limits, generated or vendored exclusions, non-exhaustive result limits.
- Sourcegraph Docs, "Search Query Syntax," https://sourcegraph.com/docs/code-search/queries, accessed 2026-05-12. Official query model: a search pattern plus filters that scope repositories, languages, files, revisions, and boolean groups.
- Sourcegraph Docs, "Code Search Capabilities," https://sourcegraph.com/docs/code-search/features, accessed 2026-05-12. Official code-search feature notes for scoped freshness, diff/commit search, symbol search, and file filtering.
- Sourcegraph Docs, "Precise Code Navigation," https://sourcegraph.com/docs/code-navigation/precise-code-navigation, accessed 2026-05-12. Official guidance that precise navigation depends on language-specific indexes and falls back to search-based navigation when indexes are absent.
- Sourcegraph Docs, "Writing an Indexer," https://sourcegraph.com/docs/code-navigation/writing-an-indexer, accessed 2026-05-12. Official SCIP indexing workflow: emit documents, occurrences, symbols, semantic roles, diagnostics, and deterministic snapshot tests.
- SCIP Code Intelligence Protocol, `scip.proto`, https://github.com/scip-code/scip/blob/main/scip.proto, accessed 2026-05-12. Official schema for project-rooted documents, relative paths, occurrences, symbol metadata, relationships, and symbol roles such as definition, import, write, read, generated, and test.
- Language Server Protocol, overview, https://microsoft.github.io/language-server-protocol/, accessed 2026-05-12. Official protocol goal: reusable language servers provide autocomplete, go to definition, hover, and references across tools.
- Language Server Protocol 3.17 Specification, https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/, accessed 2026-05-12. Official request semantics for project-wide references, workspace symbols, semantic tokens, partial results, and lazy symbol resolution.
- Tree-sitter Docs, "Query Syntax," https://tree-sitter.github.io/tree-sitter/using-parsers/queries/1-syntax.html, accessed 2026-05-12, and "Operators," https://tree-sitter.github.io/tree-sitter/using-parsers/queries/2-operators.html, accessed 2026-05-12. Official syntax-tree query model for matching nodes and captures; useful for lightweight local symbol extraction when compiler-backed navigation is unavailable.
- Universal Ctags Docs, `ctags(1)`, https://docs.ctags.io/en/latest/man/ctags.1.html, accessed 2026-05-12, and "Changes to the tags file format," https://docs.ctags.io/en/latest/output-tags.html, accessed 2026-05-12. Official tag and cross-reference model for locating definitions, with limited reference-tag support.
- ripgrep User Guide, https://ripgrep.dev/docs/guide/, accessed 2026-05-12. Official recursive-search behavior, default ignore handling, hidden/binary filtering, path globs, file-type filters, and `rg --files` discovery.
- Aider Docs, "Repository map," https://aider.chat/docs/repomap.html, accessed 2026-05-12. Official repo-map approach: send key files, symbols, and critical definition lines, then rank the most relevant map portions under a token budget.
- Zhang et al., "RepoCoder: Repository-Level Code Completion Through Iterative Retrieval and Generation," arXiv:2303.12570, https://arxiv.org/abs/2303.12570, accessed 2026-05-12. EMNLP 2023 paper from the project authors showing repository-level context benefits from iterative retrieval rather than in-file context alone.
- Wu et al., "Repoformer: Selective Retrieval for Repository-Level Code Completion," arXiv:2403.10059, https://arxiv.org/abs/2403.10059, accessed 2026-05-12. ICML 2024 paper from the project authors finding always-on retrieval can be inefficient and sometimes harmful because retrieved context is often unhelpful or noisy.
- Husain et al., "CodeSearchNet Challenge: Evaluating the State of Semantic Code Search," arXiv:1909.09436, https://arxiv.org/abs/1909.09436, accessed 2026-05-12. Project-author paper defining semantic code search as bridging natural-language intent and code vocabulary, with expert relevance judgments rather than assuming lexical hits are enough.

#### Key Findings

- Start with an evidence map, not a crawl. Aider's repo-map design and Sourcegraph/SCIP indexing both converge on a compact inventory of files, symbols, definitions, and references before reading full source files. For `/blu-research-phase`, the repo-read order should be: saved `XX-CONTEXT.md` and requirement mapping, saved `.blueprint/codebase/` summaries when present, a compact repo map or symbol inventory, scoped search queries for named anchors, semantic navigation for definitions/references when available, then targeted full-file/test reads.
- Prefer scoped search over broad recursive sweeps. GitHub and Sourcegraph both make scoping a first-class part of code search through repository, path, language, content, symbol, and boolean filters. ripgrep's defaults already skip ignored, hidden, and binary files, and its glob/file-type filters give a local equivalent. Phase research should avoid unqualified `rg <term> .`, `rg -uu`, or file-by-file browsing unless the research strand explicitly justifies widening scope.
- Separate lexical search, syntactic symbol search, and semantic navigation. GitHub `symbol:` and Tree-sitter queries can find definitions without full build integration, but GitHub documents that symbol search is definition-only and not complete for every language. LSP, SCIP, Sourcegraph precise navigation, and ctags-style tags add stronger definition/reference relationships, but each depends on language support, indexing freshness, and workspace setup.
- Retrieval should be selective and iterative. RepoCoder supports iterative retrieval-generation for repository-level context, while Repoformer warns that unconditional retrieval often injects unhelpful or harmful context. Planner-grade research should run short topic strands: form a claim, retrieve the smallest relevant symbol/files, read and cite evidence, update the claim, and stop when evidence is sufficient.
- Citations need to preserve role and provenance, not only path names. SCIP's schema distinguishes project-rooted relative paths, source ranges, symbol metadata, symbol relationships, and occurrence roles such as definition, read, write, generated, and test. A research artifact should cite repo evidence as `path:line` plus the symbol or section, evidence role, and why it supports the claim.
- External code-search results are not local truth. GitHub documents index limits, generated/vendored exclusions, default-branch-only search, result caps, and non-exhaustive behavior. Sourcegraph scoped repo searches are fresher than unscoped large searches, but still depend on index state. `/blu-research-phase` should treat remote code-search hits as discovery hints unless the local worktree or saved Blueprint artifacts confirm them.

#### Relevance To Current Blueprint Baseline

- The baseline already matches several authoritative practices: it reads actual saved phase context before drafting, reuses `blueprint_phase_context.codebase` when present, distinguishes repo evidence from official/supplied external references, works in topic strands, checkpoints inconclusive work, and persists through the canonical `phase.research` contract.
- The current `phase.research` template has planner-facing sections that can absorb this guidance without schema changes: `Architecture Patterns`, `Don't Hand-Roll`, `Anti-Patterns`, `State Of The Art`, `Common Pitfalls`, `Code Examples`, `Recommendations`, and especially `Sources`.
- The gap is that the runtime contract says "read only the repo files or saved Blueprint artifacts needed for that strand" but does not define a repo evidence ladder. It does not yet say whether a run should prefer `.blueprint/codebase/` summaries, map files/symbols first, use scoped search qualifiers, or record failed/noisy queries before reading broad surfaces.
- The `blueprint-researcher` sidecar is intentionally read-only and limited to directory listing, file reading, globbing, and grep search. That boundary is safe, but it means semantic navigation, if available, must be parent-owned or documented as an optional evidence input rather than assumed inside the agent.
- The current source expectations require citations and provenance in `## Sources`, but they do not require enough metadata to tell a planner whether evidence came from a definition, reference, test, generated output, config, or inference. That can leave later planning with path names but weak confidence about what the path proves.

#### Improvement Opportunities

- Add a "repository evidence ladder" to the research runtime contract and researcher prompt: read saved context and requirement mapping first; reuse saved `.blueprint/codebase/` summaries; create or consume a compact file/symbol map; run scoped searches by path/language/symbol; use semantic definition/reference navigation when available; read target files and tests; widen only when the current strand remains unresolved.
- Require each research strand to record a small search note: query or navigation method, scope filter, candidate files, files actually read, and why the search was stopped or widened. This would make later checkpoints resumable and prevent repeated broad searches.
- Strengthen `## Sources` guidance with a repo-evidence citation shape such as: `Repo evidence: path/to/file.ts:123, symbol/function/heading, role=definition|reference|test|config|contract, method=repo-map|rg|LSP|SCIP|ctags|manual-read, supports=<claim>`. External references should keep URL and access date separately.
- Make "no broad noisy crawls" explicit in the single-agent fallback. Examples: prefer `rg --files` plus path filters before content search, keep ripgrep default ignore behavior unless a topic requires hidden/generated/vendor files, and treat `rg -uu` or whole-repo file reading as a last resort with rationale.
- Where host capabilities allow it, let the parent command provide optional semantic packets to `blueprint-researcher`: workspace symbols, definitions, references, call hierarchy, SCIP/ctags entries, or Tree-sitter captures. The subagent should consume those packets but not invent that it performed semantic navigation.
- In planner-grade research, tie recommendations to evidence roles: API usage should cite definitions and references; regression risk should cite tests or validation paths; runtime behavior should cite command manifests, MCP tool handlers, and built/runtime entrypoints when relevant.

#### Risks And Uncertainties

- Semantic navigation is capability-dependent. LSP, SCIP, ctags, Tree-sitter, GitHub symbol search, and Sourcegraph precise navigation all have different setup and language support, so `/blu-research-phase` should present them as optional evidence sources with fallbacks, not as mandatory runtime tools.
- Symbol indexes can be stale or incomplete. Remote search can miss generated, vendored, large, non-UTF-8, or non-default-branch files; local tags can miss dynamic language relationships; Tree-sitter captures are syntactic, not always semantic. Research confidence should drop when navigation is heuristic or partial.
- Repo maps can overemphasize central symbols and miss leaf behavior, configuration, tests, or generated runtime artifacts. The map should guide the first read, not replace targeted file/test inspection.
- More citation metadata can bloat `XX-RESEARCH.md`. The workflow should require concise evidence rows for planner-critical claims rather than exhaustive provenance for every observation.
- The current Blueprint implementation may not have a first-class repo-map or symbol-graph MCP substrate. Near-term improvements should be prompt/runtime-contract guidance and tests around evidence discipline; a new deterministic mapping tool would need separate planning.
<!-- AGENT:R2:END -->

### R3. Tool And Dependency Selection Research

<!-- AGENT:R3:START -->
#### Research Summary

Authoritative dependency-selection guidance converges on a simple rule: a planner should not recommend a package or tool until it has checked both the "can we avoid adding it?" question and the supply-chain evidence for the exact candidate/version. OpenSSF's evaluation guide explicitly asks whether an existing dependency or the standard library can satisfy the need, whether the candidate is the intended project rather than a fork or typosquat, whether it is maintained, whether it has security evidence, whether it is easy to use securely, whether it has vulnerability-reporting instructions, whether its license matches the intended use, and what happens when it is added in an isolated test. OpenSSF's update guidance adds the balancing rule Blueprint should encode: every dependency adds maintenance and attack surface, but reinventing the wheel also creates likely bugs and vulnerabilities; a well-maintained, widely used library is often safer than custom code for non-trivial behavior.

For `/blu-research-phase`, the practical improvement is to make tool/dependency choice a first-class research strand with structured evidence, not prose preference. The output should distinguish "selected because it is already in the repo", "selected because the ecosystem-standard package is safer than hand-rolling", "deferred because evidence is insufficient", and "rejected because of freshness, maintenance, license, vulnerability, provenance, or transitive-dependency risk".

#### Standard Stack Improvements

- Add a dependency/tool evaluation table whenever research proposes a package, CLI, framework, service, or code-generation tool. Suggested columns: `need`, `candidate`, `official source`, `package ecosystem`, `install scope`, `current/latest/wanted version evidence`, `maintenance signal`, `known vulnerability signal`, `license`, `provenance/signature signal`, `transitive footprint`, `existing dependency or standard-library alternative`, `recommendation`, and `evidence URLs`.
- Treat version freshness as evidence, not a vibe. For npm specifically, `npm outdated` distinguishes `wanted` from `latest`, and npm notes that the `latest` dist-tag may not be the newest published version depending on package maintainer tagging. Research should record that nuance instead of blindly saying "latest".
- Require maintenance signals from primary sources before recommending a dependency: recent releases or commits, more than one maintainer where relevant, active issue/security handling, CI/tests, published package channel, and explicit security policy. OpenSSF Scorecard maps many of these to machine-checkable signals such as `Maintained`, `Dependency-Update-Tool`, `Vulnerabilities`, `License`, `Pinned-Dependencies`, `Packaging`, `Signed-Releases`, `SBOM`, `Security-Policy`, `CI-Tests`, and `Code-Review`.
- Require security and license signals for the exact package/version where tooling supports it: OSV/OSV-Scanner or npm audit for known vulnerabilities, GitHub Dependency Review for PR-introduced vulnerability/license deltas, SPDX identifiers for license normalization, and npm provenance or SLSA provenance when available. Missing data should be marked as uncertainty, not treated as approval.
- Include supply-chain identity checks for package choice. SLSA names package selection and recursive dependency threats, including typosquatting and dependencies' own supply chains. Blueprint research should verify the project website, registry package, repository, package manager namespace/scope, and official docs all point to the same artifact lineage.

#### Installation And Setup Improvements

- Installation guidance should be reproducible and lockfile-aware. For npm projects, research should prefer repo-local manifest changes plus committed lockfile changes for applications, and should call out that package locks make the dependency tree reproducible and reviewable. Verification instructions should use the project's package manager and lockfile behavior, for example `npm ci` for clean installs when a lockfile is present.
- Do not present `npm audit fix`, OSV guided remediation, or dependency-update PRs as automatically safe. npm documents that `npm audit fix` runs a full install and that some vulnerabilities require manual review; OSV-Scanner warns that guided remediation on untrusted projects may execute package-manager behavior. Blueprint should recommend "review manifest and lockfile diffs, run tests, inspect release notes/changelog, then merge" as the setup pattern.
- Capture installation side effects: new direct dependencies, new transitive dependencies, lifecycle scripts, native binaries, optional peer dependencies, engines/runtime requirements, package-manager version assumptions, and whether the package requires global install or can be repo-local. Global installs should be justified by official docs and avoided for project runtime dependencies when a local/dev dependency works.
- Pair setup instructions with update posture. If a package is selected, the research artifact should say how it will stay fresh: Dependabot/Renovate config, GitHub dependency review, OSV-Scanner or npm audit in CI, and whether major-version updates require planned work instead of automatic grouping.

#### Alternatives Considered Improvements

- Always include "no new dependency", "existing dependency", and "standard library/platform API" as alternatives before adding a new package. OpenSSF explicitly recommends checking these first because every new dependency adds support burden and supply-chain attack surface.
- Compare at least one proven library option against hand-rolled implementation for standardized, security-sensitive, or complex behavior. The comparison should include API fit, maturity, release cadence, vulnerability history, license, transitive footprint, maintenance model, provenance, test burden, and migration cost.
- Use rejection reasons that are actionable: unmaintained, unclear official source, unstable pre-1.0 API for production use, unresolved known vulnerabilities, incompatible license, excessive transitive dependency growth, insecure defaults, no security-reporting path, no clear install/update story, or functionality already exists in the repo.
- For accepted alternatives, record the residual risk and mitigation. Example: "Accept package X despite large transitive tree because it is the ecosystem-standard parser; mitigate with lockfile review, OSV scan, Dependabot updates, and parser-specific regression tests."

#### Don't Hand-Roll Improvements

- Strengthen the "Don't Hand-Roll" section into a decision rule: use proven libraries for standardized or security-sensitive domains such as cryptography, authentication/session handling, parsers, protocol clients, package/version resolution, vulnerability/license scanning, provenance/SBOM handling, AST/code indexing, and anything with well-known edge cases or adversarial inputs.
- Permit hand-rolling only when the capability is narrow, project-specific, easy to test exhaustively, not security-sensitive, not a standards implementation, and smaller than the dependency risk it avoids. The rationale should name the tests or validation that make the custom path safe.
- Require a short "library vs custom" rationale whenever the research recommends custom code in an area where mature packages exist. The rationale should state why existing packages were rejected and how Blueprint will cover compatibility, security, and maintenance risk.
- Avoid vendoring, copying snippets, or forking as a casual middle ground. OpenSSF warns that cloned or downstream-modified code can hide vulnerable origins and make updates harder. If vendoring/forking is unavoidable, research should require version/source provenance, license retention, vulnerability-monitoring ownership, and an update plan.

#### Sources

- OpenSSF Best Practices Working Group, "Concise Guide for Evaluating Open Source Software", https://best.openssf.org/Concise-Guide-for-Evaluating-Open-Source-Software, accessed 2026-05-12.
- OpenSSF Best Practices Working Group, "Simplifying Software Component Updates", https://best.openssf.org/Simplifying-Software-Component-Updates, accessed 2026-05-12.
- OpenSSF Scorecard, "Check Documentation", https://github.com/ossf/scorecard/blob/main/docs/checks.md, accessed 2026-05-12.
- OpenSSF Scorecard overview, https://scorecard.dev/, accessed 2026-05-12.
- SLSA specification v1.2, https://slsa.dev/spec/v1.2/, accessed 2026-05-12.
- SLSA v1.2, "Supply chain threats", https://slsa.dev/spec/v1.2/threats-overview, accessed 2026-05-12.
- SLSA v1.2, "Build: Requirements for producing artifacts", https://slsa.dev/spec/v1.2/build-requirements, accessed 2026-05-12.
- SLSA v1.2, "Build: Verifying artifacts", https://slsa.dev/spec/v1.2/verifying-artifacts, accessed 2026-05-12.
- OSV, "A distributed vulnerability database for Open Source", https://osv.dev/, accessed 2026-05-12.
- OSV.dev docs, "Data sources", https://google.github.io/osv.dev/data/, accessed 2026-05-12.
- OSV-Scanner docs, "Usage", https://google.github.io/osv-scanner/usage/, accessed 2026-05-12.
- OSV-Scanner docs, "Project Source Scanning", https://google.github.io/osv-scanner/usage/scan-source, accessed 2026-05-12.
- GitHub Docs, "About Dependabot alerts", https://docs.github.com/en/code-security/concepts/supply-chain-security/about-dependabot-alerts, accessed 2026-05-12.
- GitHub Docs, "About Dependabot version updates", https://docs.github.com/en/code-security/concepts/supply-chain-security/about-dependabot-version-updates, accessed 2026-05-12.
- GitHub Docs, "About dependency review", https://docs.github.com/en/code-security/concepts/supply-chain-security/about-dependency-review, accessed 2026-05-12.
- GitHub Docs, "Configuring the dependency review action", https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/configuring-the-dependency-review-action, accessed 2026-05-12.
- GitHub Docs, "Dependabot options reference", https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference, accessed 2026-05-12.
- npm Docs, "Searching for and choosing packages to download", https://docs.npmjs.com/searching-for-and-choosing-packages-to-download/, accessed 2026-05-12.
- npm Docs, "`npm outdated`", https://docs.npmjs.com/cli/v11/commands/npm-outdated/, accessed 2026-05-12.
- npm Docs, "`npm audit`", https://docs.npmjs.com/cli/v11/commands/npm-audit/, accessed 2026-05-12.
- npm Docs, "package-locks", https://docs.npmjs.com/cli/v6/configuring-npm/package-locks/, accessed 2026-05-12.
- npm Docs, "Generating provenance statements", https://docs.npmjs.com/generating-provenance-statements/, accessed 2026-05-12.
- npm Docs, "Viewing package provenance", https://docs.npmjs.com/viewing-package-provenance/, accessed 2026-05-12.
- SPDX License List, https://spdx.org/licenses/, accessed 2026-05-12.
<!-- AGENT:R3:END -->

### R4. Evidence Quality, Citations, And Provenance

<!-- AGENT:R4:START -->
#### Authoritative Practice Synthesis

Evidence in `/blu-research-phase` should be treated as a provenance-bearing claim graph, not as a prose bibliography appended after synthesis. W3C PROV defines provenance as records of the people, institutions, entities, and activities involved in producing, influencing, or delivering data or a thing, and explicitly frames provenance as support for trust judgments when sources are contradictory or questionable. Its core model is a useful fit for research evidence packets: `entity` maps to source artifacts and cited spans, `activity` maps to retrieval, reading, extraction, verification, and synthesis steps, `agent` maps to parent command, user-supplied source, subagent, or model/tool, and derivation/attribution relations map a final claim back to the evidence that produced it.

NIST AI RMF 1.0 and the NIST Generative AI Profile both point in the same direction for planner-grade research artifacts: document knowledge limits, data origin, upstream dependencies, TEVV methods, fact-checking techniques, and risk controls rather than relying on opaque model confidence. NIST AI 600-1 is especially direct for generative systems: avoid extrapolating from narrow anecdotal checks, review and verify sources and citations during pre-deployment and ongoing monitoring, verify provenance for RAG/fine-tuning data, establish assumptions and practices for data origin and content lineage, document upstream data sources, and deploy fact-checking techniques when generated information comes from multiple or unknown sources.

The citation literature adds a stricter sentence/claim-level requirement. AIS asks whether model output about the external world is attributable to identified sources verified against independent provided sources. ALCE evaluates citation generation across fluency, correctness, and citation quality, and reports that even strong systems often lack complete citation support, which argues against trusting citation-looking output without a support map. The generative-search verifiability paper separates citation recall, where all statements need full citation support, from citation precision, where every citation must actually support its associated statement. FEVER and AVeriTeC provide useful verdict vocabulary: supported, refuted, not enough evidence/info, and conflicting evidence/cherry-picking.

Model and platform docs reinforce that trustworthy citations are structured metadata, not just text. Gemini Grounding returns `webSearchQueries`, `groundingChunks`, and `groundingSupports` that link response text segments to source chunks; Gemini File Search can expose page numbers and custom source metadata; OpenAI File Search emits file citation annotations but requires an explicit include option to return retrieved search results; Anthropic Citations distinguishes citable document `source` content from metadata such as `title` and `context`, while returning document/page/character indices. `/blu-research-phase` should imitate the structured-support pattern even when it is not using those hosted tools directly.

#### Implications For `/blu-research-phase`

- Evidence packets should be written before final synthesis and should be the only allowed support surface for external claims. A final paragraph should cite packet IDs or source IDs already present in the packet, never invent new citations while writing the final answer.
- Separate evidence lanes are essential: `repo` for local files, commands, tests, manifests, contracts, and git-visible state; `external` for official docs, standards, papers, supplied URLs, package docs, or web search results; `inference` for synthesis that follows from evidence but is not directly stated by a source.
- Repo evidence should dominate Blueprint runtime claims. External sources can inform practices or dependency/tool choices, but they should not override observed repo contracts without an explicit conflict note.
- Each evidence item should record the smallest supportable span: file path plus line when repo-local, URL plus title plus accessed date for web, paper DOI or canonical page when available, and page/section/quote or extracted span when feasible.
- Claim classification should happen before prose finalization. Recommended labels: `directly_supported`, `partially_supported`, `inferred_from_supported`, `contradicted`, `conflicting_sources`, `not_enough_evidence`, and `out_of_scope`.
- Inference should be explicit and bounded. A downstream planner should be able to tell the difference between "the repo does X", "NIST recommends Y", and "therefore Blueprint could improve Z".
- Evidence quality should be recorded as operational metadata, not vibes: authority tier, freshness/stability, retrieval method, access date, quoted/extracted support, whether source content was fully read or only a search result/abstract, and known limitations.
- Final Sources should not be a flat mixed bibliography. Split sources into `Repo Evidence`, `External Sources`, and `Inference Notes`; only the first two contain citations, while `Inference Notes` references the evidence IDs it combines.
- Conflicts and absence matter. If evidence is missing, stale, contradictory, or based on an inaccessible/private artifact, the research output should say so instead of smoothing over the uncertainty.

#### Recommended Evidence Packet Shape

```text
evidence_id: E-R4-001
lane: repo | external | inference
claim_id: C-R4-001
claim_text: concise atomic claim
claim_class: directly_supported | partially_supported | inferred_from_supported | contradicted | conflicting_sources | not_enough_evidence | out_of_scope
source_type: repo_file | command_output | test_output | official_standard | official_product_doc | peer_reviewed_paper | preprint | supplied_reference | web_page | inference
authority_tier: repo_runtime | official_standard | official_vendor_doc | peer_reviewed | maintained_project_doc | preprint | secondary | unknown
source_ref: path:line, command, URL, DOI, or source packet IDs
source_title: exact title when external
accessed: 2026-05-12 for external sources
support_span: quoted span, line range, page/section, or extracted fact
retrieval_context: search query, tool/API used, local command, or user-supplied source
provenance: collected_by, collected_at, activity, and derivation/attribution notes
limitations: missing lines, inaccessible full text, stale version risk, partial support, ambiguity, or conflict
downstream_use: planner-safe conclusion or "do not use as support"
```

#### Recommended Final Sources Structure

```text
Sources

Repo Evidence
- [R1] path:line-line - what this proves.
- [R2] command/test output - what this proves.

External Sources
- [S1] Title. URL. Accessed 2026-05-12. Source type/tier. What this supports.
- [S2] Title. DOI/URL. Accessed 2026-05-12. Source type/tier. What this supports.

Inference Notes
- [I1] Derived from [R1], [S1], and [S2]; classify as inferred_from_supported.
- [I2] Competing evidence between [R2] and [S3]; classify as conflicting_sources.
```

#### Source Notes

- W3C PROV Overview and PROV-DM, W3C Recommendations. https://www.w3.org/TR/prov-overview/ and https://www.w3.org/TR/2013/REC-prov-dm-20130430/. Accessed 2026-05-12. Supports modeling evidence as entities, activities, agents, derivations, attribution, bundles, and interoperable provenance.
- NIST AI RMF 1.0, NIST AI 100-1. https://doi.org/10.6028/NIST.AI.100-1. Accessed 2026-05-12. Supports transparency, knowledge-limit documentation, documented TEVV, third-party risk mapping, and provenance as accountability infrastructure.
- NIST Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile, NIST AI 600-1. https://doi.org/10.6028/NIST.AI.600-1. Accessed 2026-05-12. Supports citation verification, grounded RAG data, lineage assumptions, upstream source documentation, fact-checking for multiple/unknown sources, and content provenance metadata.
- Google AI for Developers, Grounding with Google Search. https://ai.google.dev/gemini-api/docs/google-search. Accessed 2026-05-12. Supports `groundingMetadata`, `webSearchQueries`, `groundingChunks`, and `groundingSupports` as structured citation support.
- Google AI for Developers, Gemini File Search. https://ai.google.dev/gemini-api/docs/file-search. Accessed 2026-05-12. Supports citations with retrieved context, page numbers, media IDs, and custom metadata for source traceability.
- OpenAI API Docs, File Search. https://platform.openai.com/docs/guides/tools-file-search/. Accessed 2026-05-12. Supports separating output citation annotations from retriever result evidence and explicitly including retrieved results when needed.
- Anthropic Claude API Docs, Citations. https://docs.anthropic.com/en/docs/build-with-claude/citations. Accessed 2026-05-12. Supports citable source content, document/page/character indices, and distinguishing metadata from cited content.
- Rashkin et al., "Measuring Attribution in Natural Language Generation Models", Computational Linguistics 49(4), 2023. https://aclanthology.org/2023.cl-4.2/. Accessed 2026-05-12. Supports the AIS standard that generated external-world claims should be verified against identified independent sources.
- Gao et al., "Enabling Large Language Models to Generate Text with Citations", EMNLP 2023. https://aclanthology.org/2023.emnlp-main.398/. Accessed 2026-05-12. Supports end-to-end retrieval plus citation generation, and evaluating citation quality separately from answer fluency/correctness.
- Liu, Zhang, and Liang, "Evaluating Verifiability in Generative Search Engines", Findings of EMNLP 2023. https://arxiv.org/abs/2304.09848. Accessed 2026-05-12. Supports citation recall and precision as separate requirements for trustable generated research.
- Thorne et al., "FEVER: a Large-scale Dataset for Fact Extraction and VERification", NAACL 2018. https://aclanthology.org/N18-1074/. Accessed 2026-05-12. Supports claim verdict labels and evidence sentence requirements.
- AVeriTeC Dataset, FEVER workshop resources. https://fever.ai/dataset/averitec.html. Accessed 2026-05-12. Supports conflict/cherry-picking classification, online evidence metadata, question-answer evidence, and source medium tracking.
<!-- AGENT:R4:END -->

### R5. Agent Orchestration, Checkpointing, And Handoffs

<!-- AGENT:R5:START -->
#### Sources Reviewed

All sources below were accessed on 2026-05-12.

- Anthropic, "Building effective agents" (2024-12-19): https://www.anthropic.com/engineering/building-effective-agents
- Anthropic, "How we built our multi-agent research system" (2025-06-13): https://www.anthropic.com/engineering/multi-agent-research-system
- OpenAI, "A practical guide to building agents": https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/
- OpenAI Agents SDK, Agents: https://openai.github.io/openai-agents-python/agents/
- OpenAI Agents SDK, Agent orchestration: https://openai.github.io/openai-agents-python/multi_agent/
- OpenAI Agents SDK, Handoffs: https://openai.github.io/openai-agents-python/handoffs/
- OpenAI Agents SDK, Results and resumable state: https://openai.github.io/openai-agents-python/results/
- OpenAI Agents SDK, Human-in-the-loop approvals: https://openai.github.io/openai-agents-python/human_in_the_loop/
- OpenAI Agents SDK, tracing docs: https://github.com/openai/openai-agents-python/blob/main/docs/tracing.md
- LangGraph, Persistence: https://docs.langchain.com/oss/python/langgraph/persistence
- LangChain/LangGraph, multi-agent handoffs: https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs
- AutoGen, Teams: https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/teams.html
- AutoGen, SelectorGroupChat: https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/selector-group-chat.html
- AutoGen, Termination: https://microsoft.github.io/autogen/0.4.8/user-guide/agentchat-user-guide/tutorial/termination.html
- AutoGen, Swarm handoffs: https://microsoft.github.io/autogen/0.7.3/user-guide/agentchat-user-guide/swarm.html
- Microsoft Research, "Magentic-One: A Generalist Multi-Agent System for Solving Complex Tasks" (2024-11-04): https://www.microsoft.com/en-us/research/articles/magentic-one-a-generalist-multi-agent-system-for-solving-complex-tasks/
- Temporal documentation: https://docs.temporal.io/
- MCP tools specification: https://modelcontextprotocol.io/specification/draft/server/tools
- MCP resources specification: https://modelcontextprotocol.io/specification/draft/server/resources

#### Practice Synthesis

The strongest consensus is that research-style multi-agent work should use a manager or orchestrator-worker pattern when one final artifact must be coherent. Anthropic's research system uses a lead agent that plans, creates specialized subagents for different aspects, receives findings, decides whether more work is needed, and then sends the gathered material to a citation-focused step. OpenAI describes the same design as "manager, agents as tools": the manager keeps control of the interaction, calls specialist agents for bounded work, and synthesizes the result. LangGraph's supervisor pattern and Microsoft Magentic-One similarly keep a lead orchestrator responsible for planning, progress tracking, re-planning, and delegation.

This maps cleanly to Blueprint's current parent-owned `/blu-research-phase` contract. The parent command should remain the only actor that resolves the phase, reads canonical context, applies source policy, chooses topic strands, writes checkpoints, writes `XX-RESEARCH.md`, repairs invalid writes, syncs state, and routes next actions. A `blueprint-researcher` subagent should behave like an agent-as-tool or sidecar, not like a peer that can take over the workflow. OpenAI's handoff docs distinguish this boundary sharply: a handoff transfers active control to another agent, while an agent-as-tool keeps the manager in control. For Blueprint, decentralized handoffs are the wrong default because they would blur who owns synthesis, who enforces `research.external_sources`, and who is allowed to mutate `.blueprint/`.

The second consensus is that task decomposition must be explicit, bounded, and evidence-shaped. Anthropic notes that subagents need a concrete objective, output format, tool/source guidance, and task boundaries; otherwise they duplicate work, leave gaps, or drift. AutoGen's team docs make the same operational point through participant descriptions, selector prompts, and termination conditions. LangGraph handoffs also emphasize that payloads and message history must be deliberately engineered, or agents receive malformed or bloated context.

Concrete Blueprint implication: topic strands should be treated as a small parent-owned research ledger, not just prose. Each strand should have an id, question, repo anchors, allowed source classes, external-source policy, expected packet shape, budget, dependency notes, and completion criteria. The parent should launch subagents only for strands that are substantially independent. If a strand depends on the result of another strand, parent-driven sequential research is safer than nested child delegation.

The durable-state literature is equally aligned. LangGraph checkpoints graph state at every step inside a thread so work can resume, inspect state, support human review, and debug time travel. OpenAI Agents SDK exposes run items, handoff boundaries, approval boundaries, interruptions, and `to_state()` as the resumable surface. Temporal's core framing is that long-running workflows must be able to resume where they left off after crashes or failures. Anthropic's production research writeup says long-running agents cannot simply restart after failures; they need retry logic, regular checkpoints, and enough durable context to continue.

For Blueprint, a research checkpoint should therefore be more than "summary so far." It should be a durable, machine-readable parent ledger containing: phase id/name, command/runtime version if available, artifact contract id/version, source policy, parent plan, active strands, strand statuses, source packets already accepted, rejected/low-quality sources, tool errors, unresolved uncertainties, budget exhaustion, next action, and whether a final artifact write was attempted. Checkpoints should be updated before launching a wave of sidecars, after each returned packet is accepted or rejected, when a blocker appears, when a budget or stopping condition fires, and before/after any invalid write repair attempt. OpenAI's approval-state docs also suggest storing version markers for long-lived pending work; Blueprint should apply that idea to checkpoint compatibility so resumed research can identify stale prompt/tool/contract assumptions.

The best handoff artifact is a packet, not a transcript. OpenAI's results docs recommend using rich run items when agent, tool, handoff, and approval metadata matter; Anthropic recommends preserving direct subagent outputs or references to reduce information loss; MCP resources distinguish application-driven contextual resources from model-controlled tools. Blueprint should adapt these ideas by requiring each subagent to return a structured packet with: strand id, concise answer, claims, repo evidence, external URLs with access dates, source-quality notes, uncertainty labels, attempted-but-failed searches, and recommended follow-ups. The parent can then synthesize from packets and cite sources without copying an entire child conversation into the final artifact.

Subagent filesystem output is a useful pattern in Anthropic's research system, but Blueprint should not adopt it literally for `.blueprint/` writes. MCP's tool spec treats tools as model-controlled and recommends human-visible control for operations; Blueprint's own boundary is stricter: MCP-owned persistence is the source of truth. Therefore sidecars should not write final `XX-RESEARCH.md`, delete checkpoints, sync `STATE.md`, route next commands, or mutate host-global state. If future work allows sidecar-created scratch artifacts, they should be explicitly research-owned, referenced by the parent, and persisted through a Blueprint MCP tool rather than ad hoc file writes.

Finally, multi-agent systems need explicit stopping and observability. Anthropic reports that research agents can over-spawn, search endlessly, or choose poor sources without clear heuristics and tracing. AutoGen documents max-message, timeout, token-usage, handoff, source-match, and external termination conditions. OpenAI tracing records LLM generations, tool calls, handoffs, guardrails, and custom events. Blueprint does not need a heavyweight tracing product for this command, but it should preserve the same information at artifact/checkpoint level: why a strand was spawned, which sidecar handled it, what budget applied, why it stopped, which evidence was accepted, and which gaps remain. "Inconclusive with evidence and next search direction" is a valid terminal state for a strand; endless research is not.

#### Blueprint-Specific Improvement Pressure

- Keep `/blu-research-phase` as parent-owned synthesis with subagents as bounded helpers. Do not let child agents own routing, state sync, checkpoint deletion, source-policy decisions, or final artifact writes.
- Make topic strands structured enough to survive resume and audit: id, scope, dependencies, source policy, expected packet, budget, status, evidence, uncertainty, and next action.
- Convert subagent handoff from conversational context sharing into structured return packets. This keeps context lean and prevents a child from implicitly changing the final research narrative.
- Treat checkpoints as a durable workflow ledger, not a prose memory aid. A valid checkpoint should let the parent resume without replaying child conversations or redoing accepted research.
- Add explicit termination semantics for each strand and sidecar wave: evidence sufficient, no authoritative source found, blocked by source policy, budget exhausted, tool failure, or parent escalation required.
- Preserve access dates and source-quality labels at packet time, because later synthesis should not have to infer provenance after the fact.
- If sidecar scratch outputs are introduced, route them through MCP-owned research persistence and parent references; do not give subagents direct authority over `.blueprint/` or host-global state.
<!-- AGENT:R5:END -->

### R6. Planning-Grade Technical Research Artifacts

<!-- AGENT:R6:START -->
#### Source Base

All URLs in this R6 section were accessed on 2026-05-12. The most relevant primary sources are:

| Source | URL | Planning-artifact practice to carry forward |
|--------|-----|---------------------------------------------|
| ADR GitHub organization | https://adr.github.io/ | Treat important design choices as a decision log: one significant decision plus rationale, tradeoffs, and consequences. |
| MADR 4.x documentation and template | https://adr.github.io/madr/ | Capture context/problem, decision drivers, considered options, decision outcome, consequences, confirmation, option pros/cons, and more information. |
| AWS Prescriptive Guidance ADR process | https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html | Scope ADRs to architecturally significant choices, use lifecycle states, preserve accepted decisions as immutable history, and use ADRs during code/design review. |
| Gerrit design docs | https://gerrit-review.googlesource.com/Documentation/dev-design-docs.html | Split planning discussion into use cases, acceptance criteria, background, possible solutions with pros/cons, and conclusion; establish use-case agreement before solution debate. |
| Google documentation best practices | https://google.github.io/styleguide/docguide/best_practices.html | Keep docs short, useful, fresh, and linked from code; design docs should collect feedback on proposed implementation and then become decision archives after implementation. |
| Google engineering review guidance | https://google.github.io/eng-practices/review/developer/small-cls.html and https://google.github.io/eng-practices/review/developer/cl-descriptions.html | Plan work as self-contained changes with related tests; give reviewers context, shortcomings, supporting links, and enough information to understand the change later. |
| Rust RFC template | https://github.com/rust-lang/rfcs/blob/master/0000-template.md | Use summary, motivation, guide-level explanation, reference-level details, drawbacks, rationale/alternatives, prior art, unresolved questions, and future possibilities. |
| Kubernetes KEP template | https://github.com/kubernetes/enhancements/blob/master/keps/NNNN-kep-template/README.md | Include goals/non-goals, user stories, constraints/caveats, risks/mitigations, design details, test plan, graduation criteria, rollout/rollback, monitoring, dependencies, scalability, and troubleshooting. |
| Python PEP 1 | https://peps.python.org/pep-0001/ | Require focused proposals, motivation, specification, rationale, compatibility, security implications, teaching/adoption notes, reference implementation expectations, rejected ideas, open issues, and change history. |
| RFC 7322 style guide | https://www.rfc-editor.org/rfc/rfc7322 | Prefer readable, clear, consistent, self-contained documents with abstract/introduction, requirement language, security considerations, and normative vs informative references. |
| ISO/IEC/IEEE 42010:2022 abstract | https://www.iso.org/standard/74393.html | Architecture descriptions should explicitly structure architecture information for software/systems and support viewpoints, model kinds, stakeholder concerns, and traceability without mandating one file format. |

#### Converged Practice

Authoritative technical planning artifacts converge on a small set of repeatable properties:

- They start with a brief, self-contained summary of the problem and proposed posture, then preserve enough context for a future reader who did not attend the discussion.
- They keep scope narrow. PEP 1 explicitly favors one key proposal; ADR sources focus on one architecturally significant decision; Google review guidance favors self-contained slices.
- They separate problem, constraints, options, decision, and consequences. MADR, Gerrit design docs, Rust RFCs, and PEPs all make alternatives and rejected ideas first-class rather than burying them in prose.
- They map design to verification. MADR has confirmation, Gerrit requires acceptance criteria, KEPs require test plans and graduation criteria, and PEPs require reference implementation, tests, and documentation before finality.
- They label unresolved work. Rust RFCs and PEPs distinguish unresolved questions, future possibilities, and open issues; KEPs separate risks, caveats, rollback, monitoring, dependencies, and troubleshooting.
- They preserve provenance. RFCs distinguish normative and informative references, Google CL guidance warns that links may decay or be inaccessible, and ADR/PEP workflows record status, authorship, review, and resolution history.

#### Current `phase.research` Fit

The existing `/blu-research-phase` template already has useful planner-grade ingredients:

- `Phase Requirements` maps research guidance to requirements.
- `Locked Decisions From Context` and `User Constraints` protect context decisions from being flattened during planning.
- `Standard Stack`, `Don't Hand-Roll`, `Anti-Patterns`, and `Common Pitfalls` push against needless reinvention.
- `Alternatives Considered`, `Open Questions`, `Confidence Breakdown`, `Recommendations`, and `Sources` match the source-backed decision style recommended by ADR/RFC/PEP practice.
- The contract note that research should preserve "mapped requirements, prescriptive recommendations, repo-versus-external provenance, confidence by topic, and explicit open questions" is directionally right for `/blu-plan-phase`.

The gap is not that the template lacks sections; it is that several sections are prose buckets rather than plan-input ledgers. `/blu-plan-phase` needs coverage, read-first surfaces, acceptance signals, dependencies, and unresolved blockers in a shape that can be copied into plan model fields without re-inferring intent.

#### Recommended Section Improvements

| Current section | Improvement for `/blu-plan-phase` consumption | Source rationale |
|-----------------|-----------------------------------------------|------------------|
| Header metadata | Add `Research Status: COMPLETE|PARTIAL|BLOCKED`, `Planning Readiness: READY|NEEDS_DECISION|BLOCKED`, and `Access Date: YYYY-MM-DD` near `Researched` and `Confidence`. | ADR/PEP/KEP lifecycle status and RFC self-contained status make downstream readers know whether planning can proceed. |
| `Phase Requirements` | Convert to a coverage ledger: `Requirement ID`, `Research Topic`, `Recommendation IDs`, `Plan Implication`, `Blocking Unknowns`, `Evidence`. | KEP goals/non-goals and plan coverage rules need exact requirement accounting, not only narrative support. |
| `Summary` | Rename or supplement with `Planner Abstract`: 3-5 bullets stating the recommended planning posture, the safest implementation slice shape, and what should not be planned yet. | Google CL descriptions and RFC abstracts optimize for future readers who need the whole change context quickly. |
| `Locked Decisions From Context` | Add `Decision Drivers And Stakeholder Concerns` while preserving the locked decisions as quoted or path-cited inputs. | MADR decision drivers and ISO 42010 stakeholder concerns make the reason for a choice explicit before option analysis. |
| `User Constraints` | Add `Scope Boundary And Non-Goals`, separating hard constraints, user preferences, non-goals, and inferred constraints. | KEP and Rust RFC templates prevent solution creep by explicitly naming non-goals and future possibilities. |
| `Alternatives Considered` | Replace the single-bullet style with an option matrix: `Option`, `Pros`, `Cons`, `Rejected/Recommended`, `Decision Driver`, `Evidence`, `Plan Impact`. | MADR, Gerrit, Rust RFC, and PEP 1 all require fair treatment of alternatives and rejected ideas. |
| `Architecture Patterns` | Add `Target Surfaces` rows with repo-relative paths, existing helpers/APIs, owning runtime layer, and expected plan slot. | `/blu-plan-phase` requires exact `read_first` and file/surface coverage; Google review guidance favors small, understandable slices. |
| `Don't Hand-Roll` and `Anti-Patterns` | Keep both, but require a source-backed `Use Instead` column and a `Plan Guardrail` column. | MADR consequences and Google code-health guidance need the "why" behind avoided paths, not just prohibitions. |
| `State Of The Art` | Rename to `External Evidence And Currency` or require each item to include source type, access date, version/date observed, and whether it is normative, official guidance, empirical, or example-only. | RFC references and Google link-retention guidance both make provenance and freshness part of document quality. |
| `Common Pitfalls` | Expand to `Risks, Mitigations, And Compatibility`: include compatibility impact, security/privacy impact, rollout/rollback concern, monitoring/debugging signal, and test implication when applicable. | KEPs and PEP 1 make compatibility, security, rollout, and tests explicit before implementation starts. |
| `Open Questions` | Classify every question as `blocks plan`, `defer to plan`, `defer to execution`, or `out of scope`; include the exact decision or evidence needed. | Rust RFC unresolved questions and PEP open issues prevent vague uncertainty from leaking into implementation plans. |
| `Confidence Breakdown` | Add `Evidence Grade` fields: repo evidence count, official source count, contradictions, stale-source risk, and inferred-only notes. | RFC/ADR provenance practice and Blueprint's current confidence marker both benefit from source-backed confidence, not a single global label. |
| `Code Examples` | Limit examples to plan-relevant patterns and annotate with `Use For`, `Do Not Copy Blindly`, and source path/URL. | Rust guide/reference split encourages examples that teach the design while reference details explain implementation boundaries. |
| `Recommendations` | Replace freeform bullets with a `Plan Input Queue` table described below. | This is the direct bridge from research to `phase.plan` model fields. |
| `Sources` | Use a source register: `ID`, `URL/path`, `source type`, `access date`, `version/date observed`, `used for`, `normative/informative/example`, `risk if stale`. | RFC reference discipline and PEP/ADR histories make citations durable and reviewable. |

#### Minimum Plan Input Queue

Add this table, either under `Recommendations` or as an allowed extra top-level heading. It should be the main payload `/blu-plan-phase` consumes:

| Rec ID | Covers Requirements | Recommended Approach | Read First | Target Surfaces | Acceptance Signals | Tests / Checks | Dependencies | Risks / Mitigations | Confidence | Blocking Unknowns |
|--------|---------------------|----------------------|------------|-----------------|--------------------|----------------|--------------|---------------------|------------|-------------------|
| R-001 | `<requirement ids>` | `<planner-ready implementation direction>` | `<repo paths and docs>` | `<files, modules, commands, APIs, schemas>` | `<grep/test/CLI/file-read-verifiable outcomes>` | `<test files or commands to add/run>` | `<prior recs or decisions>` | `<risk and mitigation>` | LOW/MEDIUM/HIGH | `<none or exact blocker>` |

This table should not become a plan. It should stay at the research layer by naming recommended direction, evidence, constraints, and verification signals. `/blu-plan-phase` can then convert rows into one or more execution-ready `phase.plan` artifacts with `requirements`, `read_first`, `files_modified`, task actions, acceptance criteria, dependencies, and unknowns without guessing.

#### Planner-Ready Quality Bar

A saved `XX-RESEARCH.md` should be considered planner-ready only when:

- Every phase requirement is either supported by at least one recommendation, explicitly marked irrelevant with evidence, or blocked by a named open question.
- Every recommendation has a stable ID, concrete target surfaces, at least one evidence citation, a confidence label, and a verification signal.
- Every recommended library/tool/platform choice includes alternatives considered, why the selected option fits the phase constraints, and what not to hand-roll.
- Every external source records URL, access date `2026-05-12` or later, source type, and whether it is official/normative or example-only.
- Every open question has a downstream handling class: block planning, ask user before planning, create a plan-time investigation task, defer to execution, or out of scope.
- Compatibility, security, rollout/rollback, observability, and test implications are either addressed or explicitly marked not applicable with rationale.

The narrowest high-value improvement is to keep all existing required headings for compatibility, but strengthen `Phase Requirements`, `Alternatives Considered`, `Open Questions`, `Confidence Breakdown`, `Recommendations`, and `Sources` into parseable ledgers. That preserves the current contract while making `/blu-plan-phase` consume the research artifact as structured planning evidence instead of re-synthesizing a design doc from prose.
<!-- AGENT:R6:END -->

### R7. Evaluation, Validation, And Anti-Hallucination

<!-- AGENT:R7:START -->
#### Sources Checked

All sources below were accessed on 2026-05-12. I used primary papers, official benchmark/project pages, and official product or standards documentation.

- NIST, "Artificial Intelligence Risk Management Framework (AI RMF 1.0)," https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10. Establishes lifecycle risk management, measurement, documentation, and evaluation as core trust practices.
- NIST, "Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile" (NIST AI 600-1), https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf. Recommends documenting RAG adaptation, source origins, content provenance, feedback loops, monitoring, and trustworthiness deviations.
- Rashkin et al., "Measuring Attribution in Natural Language Generation Models," Computational Linguistics 2023 / AIS, https://aclanthology.org/2023.cl-4.2/ and https://arxiv.org/abs/2112.12870. Defines attribution to identified sources for generated claims about the external world.
- Min et al., "FActScore: Fine-grained Atomic Evaluation of Factual Precision in Long Form Text Generation," EMNLP 2023, https://arxiv.org/abs/2305.14251. Evaluates long-form factuality by decomposing output into atomic facts and checking support from reliable sources.
- Gao et al., "Enabling Large Language Models to Generate Text with Citations" / ALCE, EMNLP 2023, https://arxiv.org/abs/2305.14627 and https://aclanthology.org/2023.emnlp-main.398/. Evaluates retrieval plus citation generation across fluency, correctness, and citation quality.
- Liu, Zhang, and Liang, "Evaluating Verifiability in Generative Search Engines," Findings of EMNLP 2023, https://arxiv.org/abs/2304.09848. Separates citation recall, where statements need citation support, from citation precision, where citations must actually support their statements.
- Es et al., "RAGAS: Automated Evaluation of Retrieval Augmented Generation," EACL 2024 demo, https://arxiv.org/abs/2309.15217. Frames RAG evaluation around retrieval relevance/focus, faithful use of context, and generation quality.
- Saad-Falcon et al., "ARES: An Automated Evaluation Framework for Retrieval-Augmented Generation Systems," NAACL 2024, https://arxiv.org/abs/2311.09476. Evaluates RAG components along context relevance, answer faithfulness, and answer relevance.
- SWE-bench project page and paper, "Can Language Models Resolve Real-World GitHub Issues?", https://www.swebench.com/original.html and https://arxiv.org/abs/2310.06770. Uses real issue/PR pairs and fail-to-pass tests as the primary evaluation signal.
- Liu, Xu, and McAuley, "RepoBench: Benchmarking Repository-Level Code Auto-Completion Systems," ICLR 2024, https://arxiv.org/abs/2306.03091. Evaluates repository-level retrieval, code completion, and combined retrieval-generation pipeline behavior.
- OpenAI, "Working with evals," https://developers.openai.com/api/docs/guides/evals, and "Evaluation best practices," https://developers.openai.com/api/docs/guides/evaluation-best-practices. Official guidance for task-specific evals, test data, graders, human review, and regression testing.
- OpenAI, "Graders," https://developers.openai.com/api/docs/guides/graders. Defines string, similarity, model, code-execution, and combined graders for scoring outputs against criteria.
- OpenAI, "Why language models hallucinate," https://openai.com/index/why-language-models-hallucinate/. Argues that evals should penalize confident errors more than uncertainty and should reward appropriate abstention.
- Anthropic, "Define success criteria and build evaluations," https://docs.anthropic.com/en/docs/test-and-evaluate/develop-tests. Recommends task-specific evals, edge cases, automation where possible, and using the fastest reliable grader.
- Anthropic, "Citations," https://docs.anthropic.com/en/docs/build-with-claude/citations. Shows citation reliability depends on structured pointers to provided documents, not prompt-only bibliography text.
- Google Cloud Vertex AI, "Details for managed rubric-based metrics," https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/rubric-metric-details. Defines grounding as factuality and consistency against provided context, with claim labels and explanations.
- Google Cloud Vertex AI, `projects.locations:corroborateContent`, https://docs.cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1/projects.locations/corroborateContent. Extracts claims, supporting facts, and corroboration scores from generated text.
- Google Cloud Vertex AI, "Evaluate Gen AI agents," https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/evaluation-agents. Separates final response evaluation from trajectory/tool-use evaluation.

#### Key Findings

- Validation has to be claim-level, not document-level. AIS, FActScore, ALCE, and the generative-search verifiability work all converge on the same failure mode: fluent long-form output can look sourced while individual statements are unsupported, overclaimed, or attached to citations that do not support them.
- Citation quality has two independent axes. `/blu-research-phase` should care about citation recall, meaning planner-critical claims have evidence, and citation precision, meaning every cited path or URL actually supports the nearby claim. A flat `## Sources` list is necessary but insufficient.
- RAG-style evaluation separates retrieval quality from synthesis quality. RAGAS and ARES both evaluate whether the system retrieved relevant context and whether the answer faithfully used that context. For Blueprint, the equivalent split is: did research inspect the right repo artifacts/sources, and did the final recommendations stay within what those artifacts support?
- Repository-level evidence should look more like SWE-bench and RepoBench than generic web QA. SWE-bench's useful lesson is executable or checkable validation against a real repo state; RepoBench's useful lesson is that cross-file retrieval is itself an evaluated capability. Research quality should therefore be judged by whether it finds the right files, maps cross-file evidence, and names tests/checks that would prove the recommendation.
- Good evals are task-specific and regression-oriented. OpenAI and Anthropic both recommend evals that mirror the real task distribution, include edge cases, automate where the signal is reliable, and reserve human/model judgment for nuanced criteria. For `/blu-research-phase`, structural Markdown validation should be paired with fixture research artifacts that encode common hallucination regressions.
- Model graders can help, but deterministic gates should come first. Official grader docs support string checks, similarity checks, code execution, and model graders; Anthropic explicitly ranks code-based grading as fastest and most reliable when it applies. Blueprint should prefer deterministic Markdown/contract/source-shape checks before optional LLM-as-judge review.
- Anti-hallucination scoring should not reward confident guessing. OpenAI's hallucination analysis is directly applicable to research: "HIGH confidence" unsupported claims should be worse than explicit "not enough evidence" open questions. A good artifact may be partial or blocked if the source policy or available repo evidence cannot settle the claim.
- Agent validation should include trajectory, not just final prose. Vertex agent evaluation distinguishes final-response quality from the path of tool calls. Blueprint already has command-contract tests for required MCP tools; the next quality step is to validate research-stage behavior such as source-policy gating before external lookup, checkpointing incomplete evidence, and not letting subagents invent external verification.

#### Current Blueprint Fit

- Strong baseline: `phase.research` already requires planner-grade sections, the locked `**Confidence:**` marker, source bullets, mapped requirements, recommendations, and separation of repo evidence, official/supplied references, and inference.
- Strong baseline: `tests/phase-discovery-research.test.ts` already catches several contract regressions: registered MCP tools, external-source policy text, authoring-template usage, scaffold replacement, invalid existing research repair, generic code spans masquerading as sources, and selected-phase routing after state sync.
- Gap: current validation appears to check source shape, not source support. A URL or repo path can make the artifact structurally valid even when a nearby recommendation is not actually supported by that source.
- Gap: the artifact does not require stable claim IDs, evidence IDs, access dates for external claims, source class labels per claim, or a support verdict such as `directly_supported`, `inferred_from_supported`, or `not_enough_evidence`.
- Gap: research confidence is human-readable prose. There is no deterministic regression signal for "HIGH confidence despite missing evidence", "official-doc claim with no official source", or "repo runtime claim with only external/web evidence".
- Gap: planner readiness is not yet validated as an evidence property. A recommendation can be present without a checkable test, affected surface, or acceptance signal, which weakens the handoff to `/blu-plan-phase`.

#### Validation Improvements For `/blu-research-phase`

- Add a claim/evidence ledger to the runtime contract and preferably to `XX-RESEARCH.md` guidance. Minimum fields: `claim_id`, `claim_text`, `claim_type` (`repo_runtime`, `external_practice`, `dependency_tool`, `inference`, `open_question`), `evidence_ids`, `support_status`, `confidence`, and `plan_impact`.
- Convert `## Sources` into a source register while preserving the existing heading. Minimum fields: `source_id`, `lane` (`repo`, `external`, `supplied`, `inference`), `path_or_url`, `accessed` for external URLs, `repo_line_or_symbol` when available, `source_type`, `used_for_claims`, and `limitations`.
- Require planner-critical recommendations to cite evidence IDs, not only prose bullets. A recommendation should be valid only when it has at least one supporting claim, affected repo surfaces, and a test/check signal, or is explicitly marked blocked by a named open question.
- Treat unsupported or partially supported claims as first-class output. If evidence is missing, source policy is `off`, external access was not allowed, or repo evidence conflicts with an external source, the artifact should lower confidence and route the issue to `## Open Questions` instead of smoothing it into a recommendation.
- Add a source-support self-check before `blueprint_phase_artifact_write`: every non-repo factual claim has a nearby source ID; every source ID is used by at least one claim or is labeled background; every external URL has an access date; every repo-runtime claim prefers repo evidence over external evidence.
- Add a "retrieval adequacy" check for codebase claims. Runtime claims should cite the actual command manifest, skill/reference doc, MCP tool, artifact contract, test, or built entrypoint that supports them. If only search results or summaries were inspected, the claim should be marked partial.
- Add an uncertainty-aware confidence rule. `**Confidence:** HIGH` should require no unsupported planner-critical claims, no unresolved blockers that affect recommendations, and at least one direct repo or official source for each high-impact recommendation.
- Keep LLM-as-judge optional and advisory. A model grader could score citation precision, planner usefulness, and open-question handling after deterministic validation passes, but it should not replace schema/source gates.

#### Regression Tests That Would Catch Hallucination Drift

- Extend `tests/phase-discovery-research.test.ts` with a valid fixture that uses a source register and claim/evidence IDs, then assert `blueprintPhaseArtifactWrite` accepts it without weakening the existing required headings.
- Add an invalid fixture where `## Recommendations` contains an official-doc claim but `## Sources` has no external source with `accessed 2026-05-12`; assert validation fails or emits a dedicated `research.external_source_missing_access_date` diagnostic, depending on whether this starts as strict or warning-only.
- Add an invalid fixture where a recommendation cites `SRC-1`, but `SRC-1` is absent or unused in the source register; assert a deterministic orphan/missing source diagnostic.
- Add an invalid fixture where a repo-runtime claim cites only an external URL and no repo path; assert the repair guidance asks for repo evidence or a lower-confidence inference label.
- Add an invalid fixture where `**Confidence:** HIGH` appears while a planner-critical claim is `not_enough_evidence`; assert validation rejects or downgrades through a warning that tests can snapshot.
- Add a valid repo-only fixture for `research.external_sources: "off"` that explicitly says live external checking did not happen and uses only repo evidence; assert it remains valid so anti-hallucination gates do not force web access.
- Add a negative fixture where `research.external_sources: "off"` output claims "current official docs confirm" without an external evidence packet; assert the command/runtime-contract test catches that wording as policy drift.
- Add contract tests that require `research-phase-runtime-contract.md`, `agents/blueprint-researcher.md`, and `commands/blu-research-phase.toml` to mention claim-level evidence, access dates, source-policy honoring, and explicit uncertainty rather than broad "cite sources" wording.
- Add a "citation precision" golden Markdown fixture: one source supports claim A but not claim B. A lightweight deterministic checker can catch missing IDs and source classes; an optional model-graded eval can score whether claim B is over-attributed.
- Add a "retrieval recall" golden fixture using a tiny fake repo with a command manifest, MCP handler, and test file. The expected research must cite all three for a runtime behavior recommendation; omitting the test or handler should fail planner-readiness scoring.
- Add a planner-handoff fixture where every recommendation row must include `Evidence`, `Target Surfaces`, and `Tests / Checks`. This catches regressions where research stays fluent but stops being usable by `/blu-plan-phase`.
- Add a subagent packet fixture where a child claims it fetched official docs. The parent-side validation should require a parent-supplied external evidence packet or mark the claim unverified, preserving the current boundary that sidecars do not own external verification.

#### Narrowest Practical Change

The smallest useful improvement is not a new research engine. It is a stricter, test-backed evidence contract layered on the existing `phase.research` artifact: keep all current headings, add optional-but-preferred claim/source IDs in the authoring guidance, then introduce focused validator diagnostics for external access dates, missing source IDs, unsupported high-confidence claims, and recommendations without tests/checks. That would move `/blu-research-phase` from "valid Markdown with sources" toward "planner-grade research whose important claims can be audited."

#### Risks And Uncertainties

- Fully automatic citation-support validation is hard. Deterministic checks can verify source shape, IDs, access dates, repo path existence, and required recommendation fields, but deciding whether a paragraph is actually supported may require an optional model or human review.
- More structure can make research artifacts noisy. The right default is a concise ledger for planner-critical claims and recommendations, not atomizing every sentence.
- Strict access-date rules should preserve repo-only mode. When `research.external_sources` is `off`, the artifact should not be forced to browse; it should simply avoid current external claims or label them unverified.
- Some source-support checks may belong in warnings before strict validation. A staged rollout would avoid blocking existing valid research artifacts while still giving tests a place to pin the intended future behavior.
<!-- AGENT:R7:END -->

### R8. Gemini And CLI Extension Research UX

<!-- AGENT:R8:START -->
#### Sources Checked

All sources below were accessed on 2026-05-12. I prioritized official Gemini CLI, MCP, and CLI-agent documentation.

- Gemini CLI Extensions, https://google-gemini.github.io/gemini-cli/docs/extensions/, accessed 2026-05-12.
- Gemini CLI Custom Commands, https://google-gemini.github.io/gemini-cli/docs/cli/custom-commands.html, accessed 2026-05-12.
- Gemini CLI MCP servers, https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html, accessed 2026-05-12.
- Gemini CLI file system tools, https://google-gemini.github.io/gemini-cli/docs/tools/file-system.html, accessed 2026-05-12.
- Gemini CLI configuration, https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html, accessed 2026-05-12.
- MCP Tools specification, protocol revision 2025-06-18, https://modelcontextprotocol.io/specification/2025-06-18/server/tools, accessed 2026-05-12.
- MCP Schema reference, protocol revision 2025-06-18, https://modelcontextprotocol.io/specification/2025-06-18/schema, accessed 2026-05-12.
- MCP Elicitation draft specification, https://modelcontextprotocol.io/specification/draft/client/elicitation, accessed 2026-05-12.
- Claude Code Agent SDK, "Handle approvals and user input", https://code.claude.com/docs/en/agent-sdk/user-input, accessed 2026-05-12.
- GitHub Docs, "Tracking GitHub Copilot's sessions", https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/track-copilot-sessions, accessed 2026-05-12.

#### Authoritative UX Findings

- Gemini CLI extension UX is command-first and visibility-sensitive. Official extension docs describe extensions as packaging prompts, MCP servers, and custom commands into an installable and shareable format, while custom commands rely on clear `description` text for `/help` display and deterministic command naming. For `/blu-research-phase`, the command should feel like one visible CLI workflow with stable stages, not like an opaque prompt that silently performs many hidden reads.
- Gemini CLI's MCP docs make tool discovery, confirmation, execution, and user-friendly result display explicit. The same docs expose `/mcp` status states such as `DISCONNECTED`, `CONNECTING`, `CONNECTED`, `NOT_STARTED`, `IN_PROGRESS`, and `COMPLETED`. A long-running research command should borrow that state-language style: short stage lines, clear connection/capability status, and actionable fallback text when an optional capability is unavailable.
- Gemini CLI confirmation behavior is already a core UX pattern. Custom shell command injection prompts before execution, file writes show diffs and ask approval, MCP tools present confirmation dialogs unless trusted, and configuration supports approval modes and allowed-tool bypasses. `/blu-research-phase` should therefore make `research.external_sources=ask` an explicit confirmation moment rather than burying it in final prose.
- MCP supports structured, model-usable tool results and progress metadata. The Tools spec says structured content should be paired with serialized text content for compatibility, and output schemas help clients and models parse tool results. The 2025-06-18 schema also defines `notifications/progress` with `progress`, optional `total`, and optional `message` for long-running requests. Even if Gemini CLI does not expose every progress primitive through extension prompts today, Blueprint can still imitate the pattern with stage narration and structured final MCP results.
- MCP Elicitation is the closest official pattern to an `ask_user` gate. It defines structured user-input requests, preserves client control over user interaction, and distinguishes `accept`, `decline`, and `cancel`. That maps cleanly onto external-source confirmation: accept external verification, decline and continue repo-only, or cancel/checkpoint the research run.
- Claude Code's `AskUserQuestion` guidance reinforces that ask-user gates are not normal final-response turns. They pause execution until the application returns a choice, and restricted toolsets must include the question tool if clarification is expected. For Blueprint, this argues that external-source approval should happen at the point of need and that no-subagent or restricted-capability modes must still leave the parent command able to ask the user or choose a deterministic fallback.
- GitHub Copilot coding-agent docs treat progress visibility as a product surface: users can inspect session status, live logs, progress, token usage, session count, session length, and start/finish notifications. `/blu-research-phase` does not need that much telemetry, but it should expose enough status that a user can tell whether it is resolving phase scope, reading repo evidence, waiting on approval, using or skipping a sidecar, drafting, validating, repairing, checkpointing, or syncing state.

#### Improvements For Visible Stage Narration

- Add a required visible stage script to the `/blu-research-phase` command contract. Suggested stages: `resolve phase`, `load saved context and state`, `inspect existing research/checkpoint`, `classify research strands`, `confirm external-source policy`, `collect repo evidence`, `collect approved external evidence`, `synthesize recommendations`, `write/validate artifact`, `sync state`, and `summarize result`.
- Keep progress updates short and boundary-based. A good update is one line that names the stage, the evidence lane, and the next blocking action, for example: `Research stage 4/10: external sources are set to ask; requesting confirmation before network-backed verification.` Avoid per-file chatter unless the command is stuck or broadening scope.
- Make stage narration capability-aware. If MCP progress notifications are available in a future host path, emit progress values and messages. If not, print plain text stage updates in the command response stream and keep the durable artifact as the full evidence record.
- Include fallback stages explicitly: `subagent unavailable, continuing parent-only`, `external sources declined, continuing repo-only`, `external source unavailable, marking uncertainty`, and `write invalid, attempting one contract repair`. These reduce user anxiety during long-running research without changing persistence ownership.
- Record the final stage outcome in the research artifact's confidence/open-question sections, not only in chat. Visible narration helps the current user; artifact notes help `/blu-plan-phase` avoid re-discovering why evidence is partial.

#### Improvements For External-Source Confirmation

- Treat `research.external_sources=ask` as a first-class ask-user gate with three outcomes: `accept` means use official or supplied external sources; `decline` means continue repo-only and mark external claims as unverified or out of scope; `cancel` means stop safely, preserve any research-owned checkpoint, and avoid writing a final `XX-RESEARCH.md` unless the existing contract already allows an incomplete artifact.
- The confirmation prompt should state why external access is needed, what source classes will be used, and what will not happen. Example content: official Gemini/MCP/package docs only, URLs or domains when already known, no mutation of host-global state, no installed-extension changes, and no source-code fixes.
- Do not repeatedly ask for the same evidence class. Ask once per run for the planned external-source envelope; ask again only if the command needs a materially different class of source, such as moving from official docs to live package registry or issue tracker evidence.
- Persist the decision as research metadata: `external_sources_mode`, `user_decision`, source classes allowed, declined source classes, and uncertainty introduced by any declined or unavailable source. This preserves the line between repo evidence, official external claims, and inference.
- In `auto` mode, still narrate the source envelope before fetching: `External sources are auto-enabled; using official docs for standards and current product behavior.` In `off` mode, narrate the constraint once and avoid implying live verification in the final response.

#### Improvements For No-Subagent Fallback

- Make the optional sidecar decision visible before dispatch: `Checking research sidecar availability and workflow.subagents policy.` If disabled, missing, or unsupported, say so once and continue parent-only with the same topic-strand workflow.
- The parent command must remain complete without `blueprint-researcher`: it should resolve scope, collect repo evidence, ask external-source questions, synthesize, write through MCP, validate, checkpoint, sync state, and produce the concise final response. Subagents should improve depth or parallelism, not be required for correctness.
- When falling back, narrow the research loop instead of expanding silently. Use fewer simultaneous strands, prefer scoped repo searches, and checkpoint open strands that would have benefited from a sidecar. Mark those as planning blockers only when evidence is actually insufficient.
- If a sidecar is used, keep its UX bounded: announce the exact question sent, require source-classified findings back, and make clear that the parent command owns synthesis and persistence. If the sidecar fails or times out, summarize the failure and continue or checkpoint rather than abandoning the whole command.
- Do not make final chat dwell on subagent absence unless it affects output quality. The durable artifact should contain the detailed uncertainty; the final response should only mention fallback when it changed confidence, left blockers, or required checkpointing.

#### Improvements For Concise Final Response

- The final CLI response should be a compact completion receipt, not a duplicate of `XX-RESEARCH.md`. Suggested shape: saved artifact path, external-source mode and decision, strand/recommendation count, blockers or `none`, state sync result, and next safe command.
- Keep detailed citations, evidence packets, alternatives, confidence, and open questions in the artifact. The final response should point to them rather than restating them.
- Use explicit incomplete states. If research was checkpointed or external evidence was declined, say: `Research checkpointed; no final artifact written` or `Research saved with external sources declined; see Confidence Breakdown for unverified claims.`
- Keep the response compatible with MCP clients that primarily inspect text: mirror the essential structured result fields in concise text, while the structured result carries full machine-readable detail.
- Avoid celebratory or vague endings. The user should leave knowing exactly what changed, where to read the evidence, whether any source class was skipped, and what command is safe to run next.

#### Risks And Uncertainties

- MCP Elicitation is currently a draft client feature, so it should guide Blueprint's ask-user semantics without being treated as a required runtime dependency.
- Gemini CLI extension prompts may not expose host-native progress notifications for Blueprint's current command surface. Near-term improvements should therefore use deterministic text stage narration and artifact metadata, while keeping room for future MCP progress integration.
- Too much live narration can become noise. The right default is stage-boundary updates plus exceptional updates for approval waits, fallback, repair, checkpointing, and completion.
- External-source confirmation must not become a loophole around the existing `off`/`ask`/`auto` policy. The improvement is clearer UX and metadata, not broader fetching authority.
<!-- AGENT:R8:END -->

## Reconciled Frontier Synthesis

<!-- RECONCILED:START -->
### Source Families Covered

The eight research sections draw from complementary source families rather than eight unrelated argument threads:

- Agentic codebase investigation and coding-agent products: Claude Code workflows and best practices (`https://code.claude.com/docs/en/common-workflows`, `https://code.claude.com/docs/en/best-practices`), GitHub Copilot coding agent docs (`https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent`, `https://docs.github.com/en/copilot/concepts/agents/cloud-agent/mcp-and-cloud-agent`), Devin Interactive Planning (`https://docs.devin.ai/work-with-devin/interactive-planning`), OpenAI Codex loop and use cases (`https://openai.com/index/unrolling-the-codex-agent-loop/`, `https://developers.openai.com/codex/use-cases`), Gemini CLI context and MCP docs (`https://google-gemini.github.io/gemini-cli/docs/cli/gemini-md.html`, `https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md`), MCP Tools (`https://modelcontextprotocol.io/specification/2025-06-18/server/tools`), Sourcegraph Cody (`https://sourcegraph.com/docs/cody/core-concepts/context`), Aider repo maps (`https://aider.chat/docs/repomap.html`), SWE-bench/SWE-agent/RepoGraph/CodeCompass/SWE Context Bench/SWE-Skills-Bench/MCP-Bench papers and project pages (`https://www.swebench.com/original.html`, `https://arxiv.org/abs/2310.06770`, `https://arxiv.org/abs/2405.15793`, `https://arxiv.org/abs/2410.14684`, `https://arxiv.org/abs/2602.20048`, `https://arxiv.org/abs/2602.08316`, `https://arxiv.org/abs/2603.15401`, `https://arxiv.org/abs/2508.20453`).
- Repository mapping and code search: GitHub Code Search (`https://docs.github.com/en/search-github/github-code-search/understanding-github-code-search-syntax`, `https://docs.github.com/en/search-github/github-code-search/about-github-code-search`), Sourcegraph search and navigation (`https://sourcegraph.com/docs/code-search/queries`, `https://sourcegraph.com/docs/code-search/features`, `https://sourcegraph.com/docs/code-navigation/precise-code-navigation`, `https://sourcegraph.com/docs/code-navigation/writing-an-indexer`), SCIP (`https://github.com/scip-code/scip/blob/main/scip.proto`), LSP (`https://microsoft.github.io/language-server-protocol/`, `https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/`), Tree-sitter (`https://tree-sitter.github.io/tree-sitter/using-parsers/queries/1-syntax.html`, `https://tree-sitter.github.io/tree-sitter/using-parsers/queries/2-operators.html`), ctags (`https://docs.ctags.io/en/latest/man/ctags.1.html`, `https://docs.ctags.io/en/latest/output-tags.html`), ripgrep (`https://ripgrep.dev/docs/guide/`), RepoCoder/Repoformer/CodeSearchNet (`https://arxiv.org/abs/2303.12570`, `https://arxiv.org/abs/2403.10059`, `https://arxiv.org/abs/1909.09436`).
- Dependency and supply-chain selection: OpenSSF guidance and Scorecard (`https://best.openssf.org/Concise-Guide-for-Evaluating-Open-Source-Software`, `https://best.openssf.org/Simplifying-Software-Component-Updates`, `https://github.com/ossf/scorecard/blob/main/docs/checks.md`, `https://scorecard.dev/`), SLSA (`https://slsa.dev/spec/v1.2/`, `https://slsa.dev/spec/v1.2/threats-overview`, `https://slsa.dev/spec/v1.2/build-requirements`, `https://slsa.dev/spec/v1.2/verifying-artifacts`), OSV and OSV-Scanner (`https://osv.dev/`, `https://google.github.io/osv.dev/data/`, `https://google.github.io/osv-scanner/usage/`, `https://google.github.io/osv-scanner/usage/scan-source`), GitHub Dependabot and dependency review docs (`https://docs.github.com/en/code-security/concepts/supply-chain-security/about-dependabot-alerts`, `https://docs.github.com/en/code-security/concepts/supply-chain-security/about-dependency-review`), npm package/provenance/audit/outdated/package-lock docs (`https://docs.npmjs.com/searching-for-and-choosing-packages-to-download/`, `https://docs.npmjs.com/cli/v11/commands/npm-outdated/`, `https://docs.npmjs.com/cli/v11/commands/npm-audit/`, `https://docs.npmjs.com/cli/v6/configuring-npm/package-locks/`, `https://docs.npmjs.com/generating-provenance-statements/`), and SPDX (`https://spdx.org/licenses/`).
- Evidence, provenance, grounding, and citation quality: W3C PROV (`https://www.w3.org/TR/prov-overview/`, `https://www.w3.org/TR/2013/REC-prov-dm-20130430/`), NIST AI RMF and Generative AI Profile (`https://doi.org/10.6028/NIST.AI.100-1`, `https://doi.org/10.6028/NIST.AI.600-1`), Gemini grounding/File Search (`https://ai.google.dev/gemini-api/docs/google-search`, `https://ai.google.dev/gemini-api/docs/file-search`), OpenAI File Search (`https://platform.openai.com/docs/guides/tools-file-search/`), Anthropic Citations (`https://docs.anthropic.com/en/docs/build-with-claude/citations`), AIS/ALCE/verifiability/FEVER/AVeriTeC sources (`https://aclanthology.org/2023.cl-4.2/`, `https://aclanthology.org/2023.emnlp-main.398/`, `https://arxiv.org/abs/2304.09848`, `https://aclanthology.org/N18-1074/`, `https://fever.ai/dataset/averitec.html`).
- Agent orchestration, checkpointing, and handoffs: Anthropic agent engineering and multi-agent research (`https://www.anthropic.com/engineering/building-effective-agents`, `https://www.anthropic.com/engineering/multi-agent-research-system`), OpenAI agent and orchestration docs (`https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/`, `https://openai.github.io/openai-agents-python/agents/`, `https://openai.github.io/openai-agents-python/multi_agent/`, `https://openai.github.io/openai-agents-python/handoffs/`, `https://openai.github.io/openai-agents-python/results/`, `https://openai.github.io/openai-agents-python/human_in_the_loop/`), LangGraph/LangChain persistence and handoffs (`https://docs.langchain.com/oss/python/langgraph/persistence`, `https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs`), AutoGen team/selector/termination/swarm docs (`https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/teams.html`, `https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/selector-group-chat.html`, `https://microsoft.github.io/autogen/0.4.8/user-guide/agentchat-user-guide/tutorial/termination.html`, `https://microsoft.github.io/autogen/0.7.3/user-guide/agentchat-user-guide/swarm.html`), Magentic-One (`https://www.microsoft.com/en-us/research/articles/magentic-one-a-generalist-multi-agent-system-for-solving-complex-tasks/`), Temporal (`https://docs.temporal.io/`), and MCP tools/resources.
- Planning-grade artifact patterns: ADR/MADR/AWS ADR (`https://adr.github.io/`, `https://adr.github.io/madr/`, `https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html`), Gerrit design docs, Google doc and code-review guidance, Rust RFCs, Kubernetes KEPs, Python PEP 1, RFC 7322, and ISO/IEC/IEEE 42010 (`https://gerrit-review.googlesource.com/Documentation/dev-design-docs.html`, `https://google.github.io/styleguide/docguide/best_practices.html`, `https://google.github.io/eng-practices/review/developer/small-cls.html`, `https://google.github.io/eng-practices/review/developer/cl-descriptions.html`, `https://github.com/rust-lang/rfcs/blob/master/0000-template.md`, `https://github.com/kubernetes/enhancements/blob/master/keps/NNNN-kep-template/README.md`, `https://peps.python.org/pep-0001/`, `https://www.rfc-editor.org/rfc/rfc7322`, `https://www.iso.org/standard/74393.html`).
- Evaluation, validation, and anti-hallucination: FActScore/RAGAS/ARES/RepoBench plus OpenAI, Anthropic, and Vertex evaluation docs (`https://arxiv.org/abs/2305.14251`, `https://arxiv.org/abs/2309.15217`, `https://arxiv.org/abs/2311.09476`, `https://arxiv.org/abs/2306.03091`, `https://developers.openai.com/api/docs/guides/evals`, `https://developers.openai.com/api/docs/guides/evaluation-best-practices`, `https://developers.openai.com/api/docs/guides/graders`, `https://openai.com/index/why-language-models-hallucinate/`, `https://docs.anthropic.com/en/docs/test-and-evaluate/develop-tests`, `https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/rubric-metric-details`, `https://docs.cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1/projects.locations/corroborateContent`, `https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/evaluation-agents`).
- Gemini and CLI extension UX: Gemini extension, custom command, MCP, file-system, and configuration docs (`https://google-gemini.github.io/gemini-cli/docs/extensions/`, `https://google-gemini.github.io/gemini-cli/docs/cli/custom-commands.html`, `https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html`, `https://google-gemini.github.io/gemini-cli/docs/tools/file-system.html`, `https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html`), MCP schema/progress/elicitation (`https://modelcontextprotocol.io/specification/2025-06-18/schema`, `https://modelcontextprotocol.io/specification/draft/client/elicitation`), Claude Code user-input docs (`https://code.claude.com/docs/en/agent-sdk/user-input`), and Copilot session status docs (`https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/track-copilot-sessions`).

### Consolidated Principles

1. Research is a bounded pre-planning evidence workflow, not a general "read everything" activity. The strongest common pattern is explore, map, retrieve selectively, synthesize, validate, then hand off. That matches Blueprint's separate `/blu-research-phase`, but the artifact should expose the investigation path clearly enough that `/blu-plan-phase` does not need to repeat it.
2. Repo truth comes first for Blueprint runtime claims. External sources are valuable for standards, product behavior, current package/tool evidence, and frontier practices, but they should not override local command manifests, skills, artifact contracts, MCP tools, tests, or built/runtime entrypoints without an explicit conflict note.
3. Evidence should be lane-separated and claim-addressable. R4 and R7 converge on the same requirement: a flat `## Sources` list is not enough. Planner-critical recommendations need claim/source IDs, evidence lanes (`repo`, `external`, `supplied`, `inference`), source roles, support status, access dates for external sources, and known limitations.
4. Retrieval quality matters more than retrieval volume. R1 and R2 agree on a repo evidence ladder: saved context and requirement mapping, saved codebase summaries, compact file/symbol map, scoped `rg` or code-search queries, optional semantic navigation, then targeted full-file/test reads. Broad crawls, stale context, and unconditional retrieval are recurring failure modes across the cited agent and repository-retrieval work.
5. The parent command remains the orchestrator. R5 and R8 reinforce the current Blueprint boundary: `blueprint-researcher` may help with bounded read-only investigation, but the parent owns phase resolution, external-source policy, topic-strand selection, evidence acceptance, synthesis, checkpointing, MCP writes, state sync, and routing.
6. Checkpoints and handoffs should be packets, not transcripts. A resumable research run needs strand IDs, evidence packets, accepted/rejected sources, uncertainty, tool errors, stopping reasons, and next action. Subagents should return source-classified findings packets that the parent can audit and cite.
7. The artifact should be planner-ready. R6 reframes `XX-RESEARCH.md` as input to `/blu-plan-phase`: requirements coverage, recommendation IDs, read-first paths, target surfaces, acceptance signals, tests/checks, dependencies, risks, confidence, and blocking unknowns should be structured enough for planning agents to consume directly.
8. Tool and dependency recommendations need their own evidence bar. R3's supply-chain guidance should be treated as a specific research lane whenever a phase may add packages, CLIs, services, code generators, or non-trivial libraries: compare no-new-dependency, existing dependency, platform API, and candidate packages before recommending a new tool.
9. UX is part of correctness for a long-running CLI command. R8's stage narration, external-source confirmation, no-subagent fallback, and concise final receipt are not cosmetic; they make source-policy boundaries, incomplete states, and safe next actions visible to the user.
10. Validation should start deterministic and become stricter in stages. R7 supports source-shape, access-date, source-ID, confidence, planner-readiness, and source-policy fixtures first; optional model graders can help later with true citation-support precision, but should not replace deterministic contract checks.

### Current-Fit Assessment Against `/blu-research-phase`

Strong fits already present in the baseline:

- The command is correctly separated from planning and execution; it requires usable `XX-CONTEXT.md`, preserves context read-only, drafts from the canonical `phase.research` contract, writes only through `blueprint_phase_artifact_write`, repairs one invalid write, syncs state, and routes from refreshed MCP state.
- The current contract already names the main evidence lanes: repo evidence, official/supplied external references, and inference. It also honors `research.external_sources` as `off`, `ask`, or `auto`.
- Topic strands, inconclusive-work checkpointing, and parent-owned deletion of research checkpoints after success align with the frontier guidance on bounded exploration and resumability.
- `blueprint-researcher` is already capability-gated and treated as a bounded sidecar, while the parent command owns persistence and routing.
- Existing tests already cover important contract drift: required MCP tools, external-source policy text, authoring-template use, scaffold replacement, invalid research repair, generic code spans masquerading as sources, and selected-phase routing after state sync.

Main gaps to address before calling the research artifact planner-grade:

- The investigation trace is implicit. The command says to read needed repo files and saved artifacts, but it does not define or require a repo evidence ladder, scoped search notes, semantic-navigation fallbacks, or stopping/widening rationale per strand.
- Source shape is stronger than source support. A path or URL can satisfy structural source requirements without proving that the nearby recommendation is actually supported.
- Evidence lacks stable IDs and roles. Current guidance does not require claim IDs, source IDs, `definition|reference|test|config|contract` roles, source method, support status, or external access dates per planner-critical claim.
- Recommendations are still too prose-shaped for `/blu-plan-phase`. They may not consistently name requirement coverage, target surfaces, read-first files, acceptance signals, tests/checks, dependencies, and blockers.
- Checkpoints appear conceptually right but under-specified as durable workflow ledgers. Resume should not depend on replaying a child transcript or redoing accepted evidence.
- The sidecar contract needs sharper output rules: bounded question, allowed source classes, evidence packet fields, confidence/uncertainty, failed searches, and no claims of external verification unless parent-supplied evidence supports it.
- External-source `ask` is policy-correct but needs a visible user-decision moment and durable metadata for accept/decline/cancel outcomes.
- Dependency/tool selection currently fits existing sections like `Standard Stack`, `Don't Hand-Roll`, and `Alternatives Considered`, but it lacks a required supply-chain evaluation table when a recommendation proposes adding or adopting a tool.

### Prioritized Improvement Themes

1. Evidence and source register first. Keep existing required headings, but add claim/source IDs, evidence lanes, source roles, support status, access dates, limitations, and a concise source register under `## Sources`. This is the highest-leverage foundation for I2, I5, and I6 because it improves external-source safety, validation, and planner consumption without creating a new engine.
2. Repository evidence ladder and investigation trace. Add runtime-contract guidance for context-first research, saved codebase summaries, compact file/symbol mapping when available, scoped searches, optional semantic packets, targeted file/test reads, and explicit stopping or widening notes per strand. This gives I1 and I3 a narrow path that avoids both blind crawling and premature new infrastructure.
3. Planner-ready recommendation ledger. Convert or supplement `## Recommendations` with a Plan Input Queue: recommendation ID, covered requirements, recommended approach, read-first paths, target surfaces, acceptance signals, tests/checks, dependencies, risks/mitigations, confidence, and blocking unknowns. This is the direct bridge from research to `/blu-plan-phase`.
4. Parent-owned strand and checkpoint ledger. Define topic strands as durable units with ID, question, anchors, source policy, dependencies, expected packet shape, budget, status, evidence, uncertainty, stopping reason, and next action. Checkpoints should preserve this ledger before sidecar waves, after packet acceptance/rejection, on blockers, on budget limits, and around invalid-write repair.
5. `blueprint-researcher` packet contract. Tighten the sidecar from "research broadly" to "answer this bounded strand and return structured findings." Its return packet should include strand ID, concise answer, claims, repo paths, external URLs only when parent-approved/supplied, access dates, source-quality notes, failed searches, uncertainty, and follow-ups. It must not write final research, mutate `.blueprint/`, sync state, route commands, or broaden external-source authority.
6. External-source confirmation UX and metadata. Treat `research.external_sources=ask` as a first-class gate with `accept`, `decline`, and `cancel` outcomes. Narrate the source envelope once, preserve the decision in research metadata, and make repo-only or declined-external runs explicitly avoid "current official docs confirm" claims.
7. Dependency/tool selection lane. Add a structured evaluation table when research recommends a dependency, CLI, service, framework, package, or code generator. Require no-new-dependency and existing/platform alternatives, exact package identity/version evidence, maintenance, vulnerability, license, provenance, transitive footprint, install/update posture, and residual risk.
8. Deterministic validation and regression fixtures. Start with warning-capable or compatibility-preserving diagnostics for missing source IDs, external URLs without access dates, repo-runtime claims without repo evidence, `HIGH` confidence with unresolved planner-critical evidence, recommendations without tests/checks, and sidecar claims of unsupported external verification. Add stricter gates only after fixtures prove existing valid artifacts are not broken accidentally.
9. Visible stage narration and concise completion receipt. Add stable stage lines for phase resolution, context/state loading, checkpoint inspection, strand classification, source-policy confirmation, repo evidence, external evidence, synthesis, write/validation/repair, state sync, and summary. Final chat output should be a receipt: artifact path, source mode/decision, strand/recommendation count, blockers, state sync result, and next safe command.

### Disagreements, Tensions, And Uncertainties

- More context versus better context: R1, R2, and R5 support maps, summaries, and packets, but the `AGENTS.md`, SWE Context Bench, SWE-Skills-Bench, Repoformer, and related findings warn that stale or irrelevant context can harm success. The reconciled stance is selective retrieval plus explicit provenance, not larger default context.
- Semantic navigation is desirable but not guaranteed. LSP, SCIP, ctags, Tree-sitter, Sourcegraph, and GitHub symbol search have different coverage and freshness limits. Near-term Blueprint guidance should treat semantic evidence as optional and labeled, with `rg`/manual-read fallbacks.
- Claim-level validation is needed, but full citation-support judgment is hard. Deterministic validation can check IDs, lanes, access dates, path existence, source usage, confidence contradictions, and planner-readiness fields. Whether a source truly supports a nuanced claim may remain optional model/human review.
- Structure can become noise. The source register, claim ledger, and Plan Input Queue should cover planner-critical claims and recommendations, not atomize every sentence of `XX-RESEARCH.md`.
- Some evidence is freshness-sensitive. External docs, package versions, vulnerability status, and host UX behavior may drift. The artifact should record access dates and lower confidence when external verification is disabled, declined, stale, or unavailable.
- New repository-mapping or source-support tools may be valuable later, but the current consensus does not require a new MCP substrate as the first improvement. Prompt/runtime-contract guidance and tests are the narrowest first move.
- MCP Elicitation is a useful model for the `ask` gate, but it is still a draft client capability. Blueprint should encode the semantics now without making draft protocol support a hard runtime dependency.
- Strict validation may break older valid research documents if introduced abruptly. Prefer staged diagnostics, compatibility fixtures, and clear repair guidance before turning warnings into hard failures.

### Non-Goals And Risks For The Next Improvement Wave

- Do not change `/blu-research-phase` into a source-code fixing command, planning command, or dependency installer. It should remain discovery and synthesis for downstream planning.
- Do not loosen `research.external_sources=off|ask|auto`; clearer UX and metadata must not become broader fetching authority.
- Do not let subagents mutate `.blueprint/`, write final `XX-RESEARCH.md`, delete checkpoints, sync `STATE.md`, route next commands, or claim external verification the parent did not authorize.
- Do not make remote code search, package registries, or official docs override local repo evidence for Blueprint runtime behavior. Treat remote code search as a discovery hint until local worktree evidence confirms it.
- Do not require web access in repo-only runs. A valid `off` or declined-external artifact should remain possible if it labels external uncertainty and avoids current external claims.
- Do not require a heavyweight graph/index/search system in the first wave. Optional semantic packets can be useful, but new deterministic mapping infrastructure needs separate design.
- Do not overfit to recent arXiv results as if they were settled production standards. Use them directionally and preserve uncertainty where evidence is young.
- Do not make validation purely LLM-judged. Deterministic schema/source/metadata checks should be the baseline; model review can be advisory for citation precision and usefulness.
- Do not duplicate `XX-RESEARCH.md` in final CLI output. Keep the final response short and machine/user-readable, with detailed evidence stored in the artifact.
- Biggest rollout risks: artifact bloat, backward-incompatible validation, noisy progress updates, stale external evidence, supply-chain checks that depend on unavailable tools, and sidecar packet requirements that become so heavy the parent-only path stops being ergonomic.
<!-- RECONCILED:END -->

## Narrow Workflow Improvement Findings

Each improvement agent owns exactly one section below. Preserve other sections.

### I1. Phase Readiness And Scope Resolution

<!-- IMPROVEMENT:I1:START -->
#### Current Source Findings

- The command, docs, shared discovery skill, and research runtime contract already encode the important safety boundary: resolve the phase first, require usable saved `XX-CONTEXT.md`, treat context as read-only, read actual context content before drafting, use `contract.authoringTemplate`, sync state after success, and preserve `patch.currentPhase` during synced state refresh.
- The MCP status surface is currently plan-handoff oriented. `blueprint_phase_research_status.planningReadiness` is correctly useful for `/blu-plan-phase`, but it reports missing or invalid research as a blocker. `/blu-research-phase` should not treat that as a pre-draft blocker, because creating or repairing `XX-RESEARCH.md` is the command's job. Its true pre-draft gate is: phase resolved, selected phase directory unambiguous, and saved phase context is present, readable, valid, and not the bootstrap starter.
- Invalid or unusable context is exposed by `blueprint_phase_research_status.contextValid`, `hasUsableContext`, `contextIssues`, and `contextDiagnostics`, not by `blueprint_phase_artifact_read`. Current prose sometimes says the artifact read may report invalid/unusable context, but the read tool only returns raw content or missing state.
- `blueprint_phase_artifact_read` handles missing files, but the implementation reads after `pathExists` without a local read-error return path. A stale symlink, directory-at-file-path, or permission/read failure can throw instead of returning the "precise tool reason" promised by the command contract.
- Phase scope can be subtly ambiguous. `blueprint_phase_locate` returns the selected phase and `resolvedFrom`, while `blueprint_phase_context.workflowPosture.currentPhase` comes from refreshed state. When the user explicitly selects an earlier phase, the selected scope should win. When no phase is explicit and raw `STATE.md`, refreshed state, and `ROADMAP.md` disagree, the command should not silently research whichever source happened to win.

#### Narrow Improvements

1. Add a research-specific readiness gate beside the existing plan gate.

   Targets: `src/mcp/tools/phase.ts`, `docs/MCP-TOOLS.md`, `docs/commands/research-phase.md`, `commands/blu-research-phase.toml`, `skills/blueprint-phase-discovery/SKILL.md`, `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`, `tests/phase-discovery-tools.test.ts`, `tests/phase-discovery-research.test.ts`.

   Keep `planningReadiness` unchanged for `/blu-plan-phase`, and add an additive field such as:

   ```ts
   type PhaseResearchReadiness = {
     readyForResearch: boolean;
     selectedPhase: string | null;
     nextSafeAction: string;
     blockers: string[];
     diagnostics?: PhaseArtifactValidationDiagnostic[];
   };

   function buildPhaseResearchReadiness(args): PhaseResearchReadiness {
     if (!args.context.phase?.phaseNumber) {
       return {
         readyForResearch: false,
         selectedPhase: null,
         nextSafeAction: "Run /blu-progress to review the next safe Blueprint action",
         blockers: ["Phase research readiness could not be resolved because the phase was not found."],
       };
     }

     if (!args.contextStatus.usable) {
       return {
         readyForResearch: false,
         selectedPhase: args.context.phase.phaseNumber,
         nextSafeAction: `Run /blu-discuss-phase ${args.context.phase.phaseNumber} to rebuild the current phase context`,
         blockers: [
           args.contextStatus.present
             ? "Saved phase context exists but is not usable for research."
             : "Phase research requires a usable XX-CONTEXT.md artifact.",
           ...args.contextStatus.issues.map((issue) => `Context validation: ${issue}`),
         ],
         diagnostics: args.contextStatus.diagnostics,
       };
     }

     return {
       readyForResearch: true,
       selectedPhase: args.context.phase.phaseNumber,
       nextSafeAction: `Continue /blu-research-phase ${args.context.phase.phaseNumber}`,
       blockers: [],
     };
   }
   ```

   Command wording to add: "Use `phase_research_status.researchReadiness` to decide whether `/blu-research-phase` may draft, repair, or reuse research. Reserve `planningReadiness` for the post-research `/blu-plan-phase` handoff."

2. Make the read/status order explicit and testable.

   Targets: same command/doc/skill/runtime files plus `tests/phase-discovery-research.test.ts`.

   Proposed runtime order:

   ```text
   Resolve:
     locate = blueprint_phase_locate(raw phase argument)
     stop on !locate.found using locate.reason/recovery
     selectedPhase = locate.phaseNumber

   Read:
     context = blueprint_phase_context({ phase: selectedPhase })
     status = blueprint_phase_research_status({ phase: selectedPhase })
     stop on !status.researchReadiness.readyForResearch
     contextRead = blueprint_phase_artifact_read({ phase: selectedPhase, artifact: "context" })
     stop on !contextRead.found using contextRead.reason and route to /blu-discuss-phase selectedPhase
     config = blueprint_config_get({ scope: "effective" }) before external verification
     existingResearch = blueprint_phase_artifact_read({ phase: selectedPhase, artifact: "research" }) when status.hasResearch
     checkpoint = blueprint_phase_checkpoint_get(...)
     contract = blueprint_artifact_contract_read({ artifactId: "phase.research" })
   ```

   This aligns with the reconciled evidence-ladder theme: context/status first, then targeted content reads, then source-policy decisions, then drafting. It also removes the impossible instruction that `artifact_read` itself can validate context.

3. Pin selected phase identity through the whole command.

   Targets: `commands/blu-research-phase.toml`, `docs/commands/research-phase.md`, `skills/blueprint-phase-discovery/SKILL.md`, `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`, `tests/phase-discovery-research.test.ts`.

   Proposed wording:

   ```text
   Store `selectedPhase = blueprint_phase_locate.phaseNumber` once during Resolve.
   Every later phase-scoped MCP call, including the final
   `blueprint_state_update({ base: "synced", patch: { activeCommand, currentPhase } })`,
   must use that numeric `selectedPhase`. Do not substitute
   `state_load.derivedStatus.currentPhase`, `workflowPosture.currentPhase`,
   a phase directory, a slug, or a roadmap-derived later phase after Resolve.
   ```

   Existing tests already cover the successful earlier-phase preservation path. Add a contract assertion that the manifest/runtime contract names `phase_locate.phaseNumber` as the source for `patch.currentPhase`, not just generic `patch.currentPhase` text.

4. Treat roadmap/current-phase disagreement as an explicit scope gate.

   Targets: `src/mcp/tools/phase.ts`, `docs/commands/research-phase.md`, `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`, `tests/phase-discovery-research.test.ts`.

   Add an additive warning or `scopeResolution` object to `blueprint_phase_context`, for example:

   ```ts
   scopeResolution: {
     selectedPhase: located.phaseNumber,
     resolvedFrom: located.resolvedFrom,
     refreshedCurrentPhase: state.derivedStatus.currentPhase,
     ambiguous:
       located.resolvedFrom !== "explicit" &&
       located.phaseNumber !== null &&
       state.derivedStatus.currentPhase !== null &&
       located.phaseNumber !== state.derivedStatus.currentPhase,
   }
   ```

   Command behavior:

   - If `resolvedFrom === "explicit"`, continue on `selectedPhase` and report any mismatch as informational.
   - If `resolvedFrom !== "explicit"` and `ambiguous === true`, stop before reading/writing research and ask the user to rerun with an explicit numeric phase or confirm one concrete phase. Do not pick between stale `STATE.md` and refreshed roadmap state silently.

5. Harden artifact read failures so the contract can keep its promised recovery path.

   Target: `src/mcp/tools/phase.ts` in `blueprintPhaseArtifactRead`, with coverage in `tests/phase-discovery-tools.test.ts` or `tests/phase-discovery-research.test.ts`.

   Pseudocode:

   ```ts
   try {
     const content = await fs.readFile(absolutePath, "utf8");
     return { phaseFound: true, found: true, path: artifactPath, content, reason: null, ...resolved };
   } catch (error) {
     const reason = error instanceof Error ? error.message : String(error);
     return {
       phaseFound: true,
       found: false,
       path: artifactPath,
       content: null,
       reason: `${artifactPath} could not be read: ${reason}.`,
       ...resolved,
     };
   }
   ```

   Keep this backward-compatible by preserving the existing result shape. A future additive `readable: false` field is useful but not required for the first fix.

#### Test Ideas

- Add `researchReadiness` tests: missing context, bootstrap starter context, invalid context, unreadable context, valid context with missing research, valid context with invalid research, and valid context with valid research. Only the context failures should set `readyForResearch=false`.
- Add an artifact-read failure fixture where `03-CONTEXT.md` is a dangling symlink or directory. Assert `blueprint_phase_artifact_read({artifact: "context"})` returns `found:false` with a reason instead of throwing, and the command docs route to `/blu-discuss-phase 3`.
- Add an omitted-phase ambiguity fixture: raw `STATE.md` points to Phase 2, refreshed state or roadmap points to Phase 3, and no explicit phase was supplied. Assert the proposed `scopeResolution.ambiguous` or warning is present and command contract text requires an explicit confirmation/rerun before writing.
- Extend the existing earlier-selected-phase regression to assert that command metadata/docs specifically say `patch.currentPhase` comes from `blueprint_phase_locate.phaseNumber`.
- Add metadata assertions that `/blu-research-phase` uses `researchReadiness` for research start and `planningReadiness` only for final handoff/status, so future wording does not collapse the two gates again.

#### Risks And Rollout Notes

- Do not change `planningReadiness` semantics in place; `/blu-plan-phase` already depends on that gate. Add `researchReadiness` instead.
- Be careful changing `resolveRequestedPhase`; it is shared by many phase commands. The safest first move is additive ambiguity reporting plus command-level confirmation when the phase was not explicit.
- If `scopeResolution` or `researchReadiness` is added to MCP responses, update response-sanitizer/public-response tests only as needed and preserve `content`/`structuredContent` parity.
- Stricter scope confirmation can add a prompt in projects with stale `STATE.md`, but that is preferable to silently writing `XX-RESEARCH.md` for the wrong phase.
- Artifact-read catch behavior should preserve existing missing-file results and only convert unexpected read failures into structured recovery results.
<!-- IMPROVEMENT:I1:END -->

### I2. External Source Policy And Evidence Packets

<!-- IMPROVEMENT:I2:START -->
#### Current Baseline

The existing `/blu-research-phase` contract is already pointed in the right direction:

- `commands/blu-research-phase.toml` requires `blueprint_config_get` with `scope: "effective"` before external verification, honors `research.external_sources` as `off`, `ask`, or `auto`, keeps repo evidence distinct from official or supplied external references, and explicitly says not to imply live verification when it did not happen.
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md` defines the real orchestration policy: repo truth first, external checks only when config allows them, `## Sources` separated into repo evidence, official or supplied external references, and inference, and `blueprint-researcher` receives parent-gathered evidence packets instead of fetching official docs itself.
- `agents/blueprint-researcher.md` says the sidecar does not fetch official docs, must mark unsupported official-doc comparisons as unverified, and should cite repo evidence, official references, supplied references, or inference.
- `docs/commands/research-phase.md`, `docs/RUNTIME-REFERENCE.md`, `docs/MCP-TOOLS.md`, and `src/mcp/command-runtime-metadata.ts` mirror the same high-level rule.
- `src/mcp/tools/config.ts` already has the right normalized enum and default: `research.external_sources` is `off | ask | auto`, with hardcoded default `off`; `blueprint_phase_context` mirrors the effective value at `workflowPosture.research.externalSources`.
- `src/mcp/artifact-contracts/index.ts` and `src/mcp/tools/artifacts.ts` currently require `## Sources` and at least one URL, repo path, or cited file, but do not require source IDs, access dates, support status, or a link between individual claims and sources.

The improvement should therefore tighten the contract and tests before adding new runtime machinery. Do not change config names or defaults, do not give subagents live-browsing authority, and do not make web access mandatory for valid repo-only research.

#### Proposed External Source Semantics

Primary target: `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`. Mirror concise versions in `commands/blu-research-phase.toml`, `docs/commands/research-phase.md`, `docs/MCP-TOOLS.md`, `docs/RUNTIME-REFERENCE.md`, and `src/mcp/command-runtime-metadata.ts`.

Add a command-local "External Source Decision" rule:

```text
Read `blueprint_config_get` with `scope: "effective"` before any official-doc,
package-registry, security-advisory, release-note, remote-code-search, or other
external verification step. Treat `workflowPosture.research.externalSources` as
a convenience mirror only.

Modes:
- `off`: do not perform live external lookup. Use repo evidence, saved Blueprint
  artifacts, and explicitly supplied source excerpts only as supplied evidence.
  Mark any freshness-sensitive external claim as unchecked in this run, lower
  confidence when it affects a recommendation, and add an Open Question when
  downstream planning would need live upstream confirmation.
- `ask`: before gathering any live external packet, use `ask_user` with a
  single decision that names the source classes, reason, and non-actions.
  Outcomes are `accept`, `decline`, and `cancel`.
  - `accept`: gather only the named source classes and record the decision.
  - `decline`: continue repo-only or supplied-only; do not write "official docs
    confirm" or "latest" claims; record the declined source classes.
  - `cancel`: stop safely, preserve or refresh the research checkpoint, and do
    not write final `XX-RESEARCH.md` unless it is already complete without the
    blocked external claim.
- `auto`: the parent may gather external packets when repo evidence cannot
  settle a planner-critical claim, but `auto` is not a general web crawl. Record
  source classes, URLs/domains, access date, retrieval method, and limitations.
```

Suggested `ask_user` prompt text for `ask` mode:

```text
This research strand needs external verification because <claim/reason>. I can
check only these source classes: official docs, standards/specs, package
registry metadata, release notes, security advisories, or user-supplied URLs.
I will not mutate source files, installed extensions, host-global Blueprint
state, credentials, packages, or external services.

Choices:
- accept: gather the named external evidence and cite it in the research packet
- decline: continue repo-only and mark affected claims as unchecked
- cancel: stop and preserve a research checkpoint
```

#### Parent-Gathered Evidence Packet

Primary targets: `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md` and `agents/blueprint-researcher.md`. Secondary targets: `src/mcp/artifact-contracts/index.ts` authoring template and `docs/commands/research-phase.md`.

The parent command should pass only structured, parent-gathered packets to `blueprint-researcher`; the agent may compare against them but must not create them. Use this shape as prompt/template wording first, then consider validation warnings later:

```ts
type ResearchSourceLane = "repo" | "blueprint" | "external" | "supplied" | "inference";
type ResearchSourceClass =
  | "repo_file"
  | "repo_test"
  | "repo_config"
  | "blueprint_artifact"
  | "runtime_contract"
  | "official_doc"
  | "standard_spec"
  | "package_registry"
  | "release_notes"
  | "security_advisory"
  | "user_supplied_reference"
  | "remote_code_search_hint"
  | "inference_note";
type SupportStatus = "supports" | "partial" | "conflicts" | "not_enough_evidence" | "unchecked";

type ResearchEvidencePacket = {
  packetId: string;              // EP-001
  strandId: string;              // STR-001, or "global"
  externalSourcesMode: "off" | "ask" | "auto";
  userDecision: "not_required" | "accepted" | "declined" | "cancelled" | "not_applicable";
  gatheredBy: "parent" | "user";
  gatheredAt: string | null;     // ISO timestamp for live checks, null for repo-only
  allowedSourceClasses: ResearchSourceClass[];
  declinedSourceClasses: ResearchSourceClass[];
  sources: Array<{
    sourceId: string;            // SRC-REPO-001, SRC-EXT-001
    lane: ResearchSourceLane;
    class: ResearchSourceClass;
    citation: string;            // repo path[:line], URL, or supplied-title
    title: string;
    accessDate: string | null;   // required for external live sources
    observedVersionOrDate: string | null;
    excerptOrSummary: string;
    limitations: string[];
  }>;
  claims: Array<{
    claimId: string;             // CLM-001
    claim: string;
    sourceIds: string[];
    supportStatus: SupportStatus;
    confidence: "LOW" | "MEDIUM" | "HIGH";
    placement: string;           // section heading or recommendation id
    nonRepoClaim: boolean;
  }>;
  unresolved: Array<{
    question: string;
    neededSourceClass: ResearchSourceClass;
    reason: string;
  }>;
};
```

Packet rules:

- Official or external claims require `sourceId`, `accessDate`, `supportStatus`, and a short excerpt or summary. A bare URL is not enough.
- `remote_code_search_hint` can help discover a path or pattern, but it must not be treated as local repo truth until the local worktree or saved Blueprint artifacts confirm it.
- User-supplied links or excerpts are `supplied` unless the parent actually fetches or verifies the URL under an allowed mode.
- Inference rows are allowed, but they must cite the repo or external source IDs being combined. They cannot be the only support for a non-repo factual claim stated as current fact.
- A packet with `externalSourcesMode: "off"` or `userDecision: "declined"` may contain repo and inference support, but no claim may say "official docs confirm", "latest", "current upstream", or equivalent live-verification language unless a user-supplied excerpt is explicitly labeled as supplied and unchecked.

#### Source Register And Citation Placement

Primary target: `src/mcp/artifact-contracts/index.ts` for the `phase.research` authoring template. Keep the required top-level `## Sources` heading, and add nested structure there instead of introducing a new required top-level schema on the first pass.

Proposed replacement for the current one-bullet `## Sources` placeholder:

```markdown
## Sources

### External Source Decision

- Mode: off|ask|auto
- User decision: not_required|accepted|declined|cancelled|not_applicable
- Live external checks performed: yes|no
- Source classes allowed: repo_file, blueprint_artifact, official_doc, ...
- Source classes declined or unavailable: none|...

### Source Register

| Source ID | Lane | Class | Citation | Accessed / Observed | Used For | Limits |
|-----------|------|-------|----------|---------------------|----------|--------|
| SRC-REPO-001 | repo | repo_file | src/example.ts:42 | observed in worktree | CLM-001 | local checkout only |
| SRC-EXT-001 | external | official_doc | https://example.com/docs | accessed 2026-05-12 | CLM-002 | may drift |

### Claim Support

| Claim ID | Claim | Support | Source IDs | Placement | Confidence |
|----------|-------|---------|------------|-----------|------------|
| CLM-001 | <repo claim> | supports | SRC-REPO-001 | Recommendations REC-001 | HIGH |
| CLM-002 | <external claim> | unchecked | none | State Of The Art | LOW |

### Inference Notes

- INF-001 combines SRC-REPO-001 and SRC-EXT-001; confidence is MEDIUM because <limit>.
```

Placement rules for authoring guidance:

- In `## State Of The Art`, `## Standard Stack`, `## Don't Hand-Roll`, `## Alternatives Considered`, and `## Recommendations`, planner-critical non-repo claims should include a nearby claim/source pointer such as `(CLM-002, SRC-EXT-001)` rather than relying only on the final source list.
- Repo-runtime claims should cite repo paths, tests, runtime contracts, or saved Blueprint artifacts, not external docs.
- External claims should cite packet IDs/source IDs and include access dates in `## Sources`.
- Unsupported or unchecked claims should move to `## Open Questions`, `## Confidence Breakdown`, or an explicit `unchecked` claim row rather than being written as confident recommendations.

#### File-Targeted Changes

1. `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
   - Add the mode semantics above under Required MCP Calls or Retry And Repair Behavior.
   - Add the evidence-packet shape under Capability-Gated Subagent Path.
   - Add the Source Register and Claim Support requirements under Artifact Authoring Rules and Output Quality Criteria.
   - Add "no fake live verification" language: if no parent packet exists, the draft must say "not externally checked in this run" or lower confidence instead of implying a current official check.

2. `commands/blu-research-phase.toml`
   - Keep the manifest thin. Add one gate sentence: `ask` has `accept|decline|cancel`; `auto` still records packets; `off` forbids live lookup and live-verification wording.
   - Do not inline the full schema here.

3. `docs/commands/research-phase.md`
   - Update Research Runtime Anchors, User Prompts And Confirmation Gates, Acceptance Criteria, and Test Cases with the three `ask` outcomes, packet metadata, and source-register requirement.

4. `agents/blueprint-researcher.md`
   - Add a "Required Packet Input" subsection that names `packetId`, `strandId`, `sourceId`, `claimId`, `source class`, `accessDate`, `excerptOrSummary`, `supportStatus`, and `limitations`.
   - Change artifact-grade output expectations from "populated `XX-RESEARCH.md` body" to "populated body plus a compact claim-support packet or warnings" when parent evidence is supplied.
   - Keep the hard boundary that the agent does not fetch official docs or claim it performed live verification.

5. `src/mcp/artifact-contracts/index.ts`
   - Expand only the `phase.research` authoring template's `## Sources` placeholder with the nested source register above.
   - Consider adding placeholder signals for the new placeholder tokens so scaffold content cannot pass as final research.

6. `src/mcp/tools/artifacts.ts`
   - First pass: add warnings, not hard failures, for external URL rows without access dates, `Official reference` claims without source IDs, and `State Of The Art` wording like "latest/current official docs confirm" without an external source row.
   - Later pass: after fixtures stabilize, promote only the safest checks to strict validation.

7. `src/mcp/command-runtime-metadata.ts`, `docs/RUNTIME-REFERENCE.md`, and `docs/MCP-TOOLS.md`
   - Mirror the concise runtime contract so public runtime resources say the parent gathers evidence packets, `ask` has three outcomes, and repo-only runs must not fake live verification.

8. `src/mcp/tools/config.ts`
   - No schema/default change is recommended. Keep default `off` and keep `workflowPosture.research.externalSources` as a mirror of effective config.

#### Test Ideas

- Extend `tests/phase-discovery-research.test.ts` to assert the command manifest, runtime contract, command doc, MCP tools doc, runtime metadata, and researcher agent mention:
  - `ask` outcomes `accept`, `decline`, and `cancel`
  - parent-gathered evidence packets
  - source classes and claim/source IDs
  - no live-verification wording when `off` or declined
- Add a fixture in `tests/phase-discovery-research.test.ts` that writes valid research with the new `## Sources` nested tables and verifies strict validation still passes.
- Add warning-focused validation tests in `tests/phase-discovery-research.test.ts` or a new narrow research validation test:
  - URL source without access date produces a warning first.
  - "latest official docs confirm" with no external packet/source row produces a warning.
  - `Inference` as the only support for a current external factual claim produces a warning.
  - Repo-only research with `Mode: off` and no external URL remains valid when it labels external uncertainty honestly.
- Extend `tests/agent-contract-specialists.test.ts` so `blueprint-researcher` requires packet fields and still rejects self-fetched official-doc claims.
- Add table coverage around `blueprintPhaseContext` effective config mirroring for `off`, `ask`, and `auto`; keep existing invalid-value normalization tests in `tests/mcp-server-summary.test.ts` aligned with the enum.
- If `src/mcp/artifact-contracts/index.ts` changes, update scaffold/template tests that assert `phase.research` shape and rebuild tracked `dist/` in an implementation wave.

#### Risks And Mitigations

- Artifact bloat: require claim/source rows only for planner-critical claims and recommendations, not every sentence.
- Backward compatibility: start with template guidance and warnings before strict validation. Existing valid research should not suddenly fail solely because it lacks packet IDs.
- False precision: deterministic checks can prove source shape, not true semantic support. Keep support-status validation structural and reserve deeper support judgment for optional model/human review.
- `auto` overreach: define allowed source classes and require packet rows so `auto` does not become an unbounded web crawl.
- User-supplied stale links: label them as `supplied` unless fetched under an allowed mode, and record limitations.
- Duplicate contract drift: keep the full schema in the runtime contract and template, with only concise mirrors in manifest, command docs, MCP tools docs, and runtime metadata.
- Sidecar boundary drift: every test that adds packet fields should also assert `blueprint-researcher` still cannot fetch official docs, mutate `.blueprint/`, persist research, or claim live verification on its own.
<!-- IMPROVEMENT:I2:END -->

### I3. Topic Strand Decomposition And Checkpoint Semantics

<!-- IMPROVEMENT:I3:START -->
#### Current Fit

The current `/blu-research-phase` sources already name the right concepts, but
they do not yet make them operational enough for consistent long-running runs.

- `commands/blu-research-phase.toml` says to use checkpoints only as resumable
  research state, delete only research-owned checkpoint state after a successful
  final write, keep the shared long-running stages visible, and keep final
  responses concise.
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
  says to research "one topic strand at a time", checkpoint paused or
  inconclusive work, resume checkpoints by default unless explicitly discarded,
  and use a single-agent fallback when no suitable `blueprint-researcher`
  sidecar is available.
- `skills/blueprint-phase-discovery/SKILL.md` locks the command-scoped tool
  allowlist and the generic checkpoint write shape:
  `ownerCommand`, `completedAreas`, `remainingAreas`, `decisions`,
  `deferredIdeas`, `canonicalReferences`, and `resumeMeta`.
- `src/mcp/tools/phase-checkpoint-records.ts` and
  `src/mcp/tools/phase.ts` enforce only generic ownership/mode safety. The
  checkpoint schema uses `.catchall(z.unknown())`, so a richer research ledger
  can be added inside the current JSON object before any hard schema migration.
- `tests/phase-discovery-tools.test.ts` and
  `tests/phase-discovery-discuss.test.ts` cover shared checkpoint persistence,
  owner/mode mismatch protection, guarded delete behavior, and legacy reads, but
  they do not yet cover a research-specific checkpoint ledger or the timing of
  research checkpoints.
- `src/mcp/command-runtime-metadata.ts`, `docs/commands/research-phase.md`,
  `docs/MCP-TOOLS.md`, and `docs/RUNTIME-REFERENCE.md` mirror the broad behavior
  but still use terms like "topic-strand" and "inconclusive" without a concrete
  taxonomy, payload, or resume transcript.

The reconciled synthesis points to the missing center: keep the parent command
as the orchestrator, make strands durable units, checkpoint packets rather than
transcripts, and preserve enough state to resume without repeating accepted
research.

#### Recommended Strand Taxonomy

Add a "Research Strand Ledger" subsection to
`skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
and mirror the short form in `docs/commands/research-phase.md`,
`docs/MCP-TOOLS.md`, and `src/mcp/command-runtime-metadata.ts`.

Proposed taxonomy:

1. `context-lock`: saved `XX-CONTEXT.md`, requirement mapping, user constraints,
   prior phase artifacts, and current workflow gates.
2. `repo-map`: saved `.blueprint/codebase/` summaries, relevant files, symbols,
   tests, commands, and contract anchors.
3. `stack-and-dependencies`: current repo stack, existing dependencies,
   candidate libraries/tools, versions, setup, license/security/maintenance
   cautions, and "do not hand-roll" calls.
4. `architecture-integration`: implementation patterns, ownership boundaries,
   state/data flow, MCP/tool contracts, and affected modules.
5. `validation-and-tests`: expected verification surfaces, test harnesses,
   fixtures, commands, and failure modes planning must cover.
6. `risks-and-pitfalls`: anti-patterns, contradictory evidence, operational
   hazards, migration concerns, and blocked assumptions.
7. `external-delta`: official or supplied external sources only when
   `research.external_sources` allows them and repo evidence cannot settle the
   claim.
8. `planner-handoff`: parent-owned synthesis across completed strands into
   recommendations, open questions, confidence, and planning handoff notes.

Suggested runtime-contract wording:

```md
## Research Strand Ledger

Treat topic strands as a parent-owned ledger, not as ad hoc prose. A simple run
may collapse strands, but every non-trivial run should classify work into the
smallest useful set from: context-lock, repo-map, stack-and-dependencies,
architecture-integration, validation-and-tests, risks-and-pitfalls,
external-delta, and planner-handoff.

For each strand, track: id, type, question, requirementIds, repoAnchors,
sourcePolicy, dependencies, expectedPacket, budget, status, evidenceIds,
acceptedClaims, rejectedOrLowQualitySources, searchNotes, uncertainty,
stoppingReason, and nextAction. "Inconclusive with evidence and next search
direction" is a valid terminal strand state; endless research is not.
```

Keep `commands/blu-research-phase.toml` thin. If it changes, add only one
sentence under command-local gates:

```toml
- For non-trivial research, classify work into parent-owned topic strands and checkpoint the strand ledger rather than child-agent transcripts.
```

#### When To Checkpoint

Add checkpoint timing rules to the runtime contract and the shared discovery
skill's `/blu-research-phase` section. Suggested wording:

```md
Checkpoint research state with `blueprint_phase_checkpoint_put` only when there
is useful continuation state. Update the checkpoint:

- after `blueprint_phase_checkpoint_get` returns a safe resumable checkpoint and
  the parent accepts or defaults to resume, if the parent changes the active
  strand or next action;
- before launching any sidecar wave, with strand ids, questions, budgets, and
  expected packet shape already recorded;
- after each parent-accepted or parent-rejected sidecar packet;
- after each parent-completed inline strand when the remaining strands still
  matter and the run is long enough to resume later;
- before waiting on `research.external_sources=ask` when the run cannot continue
  repo-only without losing context;
- when a source-policy decline, tool failure, budget limit, timeout, or
  contradictory evidence leaves a strand inconclusive;
- before a final artifact write retry when validation diagnostics require repair;
- after a failed or identical validation repair attempt, preserving the draft
  status and exact diagnostics;
- before stopping due to state-sync or route-refresh failure after a final write
  attempt.

Do not checkpoint after a straightforward successful final write except as a
temporary pre-delete state. Delete only after the final research write, state
sync, refreshed state load, and implemented-command routing receipt are known.
```

Pseudocode for the parent command:

```ts
const checkpoint = await blueprint_phase_checkpoint_get({
  phase,
  expectedOwnerCommand: "/blu-research-phase",
  expectedMode: "research",
});

const ledger = decideResumeOrFreshLedger(checkpoint, userIntent);
classifyStrands(ledger, context, researchStatus, config, contract);

for (const strand of nextRunnableStrands(ledger)) {
  setProgress("Execute", strand);

  if (shouldUseSidecar(strand, config)) {
    await putCheckpoint(ledger.markDispatching(strand));
    const packet = await runResearcherSidecar(strand);
    ledger.acceptOrRejectPacket(strand.id, packet);
    await putCheckpoint(ledger);
  } else {
    const packet = await parentInlineResearch(strand);
    ledger.acceptOrRejectPacket(strand.id, packet);
    if (ledger.hasRemainingCriticalWork()) {
      await putCheckpoint(ledger);
    }
  }

  if (strand.isBlockedOrInconclusive()) {
    await putCheckpoint(ledger);
    stopWithCheckpointReceipt(ledger);
  }
}

const draft = synthesizeResearchFromParentLedger(ledger, contract.authoringTemplate);
const write = await blueprint_phase_artifact_write({ phase, artifact: "research", content: draft });
if (write.status === "invalid") {
  await putCheckpoint(ledger.recordValidationAttempt(write.validation));
  const repaired = repairSameDraft(draft, write.validation);
  const retry = await blueprint_phase_artifact_write({ phase, artifact: "research", content: repaired, overwrite: true });
  if (retry.status === "invalid") {
    await putCheckpoint(ledger.recordRepeatedValidationFailure(retry.validation));
    stopWithCheckpointReceipt(ledger);
  }
}

await blueprint_state_update({ base: "synced", patch: { currentPhase: phase, activeCommand: "/blu-research-phase" } });
await blueprint_state_load({ phase });
await blueprint_command_catalog({});
await blueprint_phase_checkpoint_delete({
  phase,
  expectedOwnerCommand: "/blu-research-phase",
  expectedMode: "research",
});
```

#### Checkpoint Payload Shape

Keep the existing required checkpoint fields for compatibility. Add a
research-specific nested payload rather than replacing the generic schema at
first. This fits the current `.catchall(z.unknown())` implementation while
leaving room for a later explicit schema in
`src/mcp/tools/phase-checkpoint-records.ts`.

Recommended checkpoint JSON example:

```json
{
  "ownerCommand": "/blu-research-phase",
  "completedAreas": ["S1 context-lock", "S2 repo-map"],
  "remainingAreas": ["S3 stack-and-dependencies", "S4 validation-and-tests"],
  "decisions": [
    {
      "topic": "S2 repo-map",
      "decision": "Use saved codebase summaries before broad repo reads.",
      "rationale": "The phase context reported a reusable codebase bundle."
    }
  ],
  "deferredIdeas": [
    {
      "idea": "Compare against official dependency docs",
      "reason": "External sources are set to ask and no user approval has been received.",
      "revisitWhen": "After external-source confirmation"
    }
  ],
  "canonicalReferences": [
    {
      "label": "Research runtime contract",
      "target": "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md",
      "note": "Behavior authority"
    },
    {
      "label": "Phase context",
      "target": ".blueprint/phases/03-phase-discovery/03-CONTEXT.md",
      "note": "Saved scope boundary"
    }
  ],
  "resumeMeta": {
    "mode": "research",
    "pendingTopics": ["S3 stack-and-dependencies", "S4 validation-and-tests"],
    "completedTopics": ["S1 context-lock", "S2 repo-map"],
    "currentQuestion": "Which dependency or repo pattern should planning rely on?",
    "notes": [
      "Repo evidence accepted through packet P2.",
      "External verification is pending user confirmation."
    ],
    "resumeHint": "Resume at S3, confirm external-source policy before official-doc lookup.",
    "updatedAt": "2026-05-12T00:00:00.000Z"
  },
  "researchLedger": {
    "schemaVersion": "research-ledger/v1",
    "phase": {
      "number": "3",
      "prefix": "03",
      "name": "Phase Discovery",
      "dir": ".blueprint/phases/03-phase-discovery"
    },
    "runtime": {
      "ownerCommand": "/blu-research-phase",
      "runtimeContract": "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md",
      "artifactId": "phase.research",
      "externalSources": {
        "effective": "ask",
        "decision": "pending",
        "reason": "Repo evidence cannot settle upstream API behavior."
      }
    },
    "strands": [
      {
        "id": "S1",
        "type": "context-lock",
        "question": "What saved context decisions constrain this research?",
        "requirementIds": ["LIFE-02"],
        "repoAnchors": [
          ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"
        ],
        "sourcePolicy": "repo-only",
        "dependencies": [],
        "budget": {
          "maxFiles": 3,
          "maxSidecars": 0
        },
        "status": "complete",
        "evidenceIds": ["E1"],
        "acceptedClaims": ["Context requires MCP-owned persistence."],
        "rejectedOrLowQualitySources": [],
        "searchNotes": [
          {
            "method": "MCP artifact read",
            "scope": "phase context",
            "filesRead": [
              ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"
            ],
            "stopReason": "Saved context directly answered the strand."
          }
        ],
        "uncertainty": "none",
        "stoppingReason": "evidence-sufficient",
        "nextAction": "feed planner-handoff"
      },
      {
        "id": "S3",
        "type": "stack-and-dependencies",
        "question": "Which existing repo dependencies or official guidance should planning use?",
        "requirementIds": ["LIFE-02"],
        "repoAnchors": ["package.json", "src/mcp/tools/phase.ts"],
        "sourcePolicy": "repo-first-external-ask",
        "dependencies": ["S1", "S2"],
        "budget": {
          "maxFiles": 8,
          "maxSidecars": 1
        },
        "status": "blocked",
        "evidenceIds": ["E2"],
        "acceptedClaims": ["Repo already uses zod for checkpoint input validation."],
        "rejectedOrLowQualitySources": [],
        "searchNotes": [
          {
            "method": "rg",
            "scope": "src/mcp tools and tests",
            "query": "resumeMeta|ownerCommand|checkpoint",
            "candidateFiles": [
              "src/mcp/tools/phase-checkpoint-records.ts",
              "tests/phase-discovery-tools.test.ts"
            ],
            "filesRead": [
              "src/mcp/tools/phase-checkpoint-records.ts"
            ],
            "stopReason": "External freshness check requires approval."
          }
        ],
        "uncertainty": "Official guidance not checked because external_sources=ask is pending.",
        "stoppingReason": "blocked-by-source-policy",
        "nextAction": "ask user whether to allow official-doc verification"
      }
    ],
    "evidencePackets": [
      {
        "id": "E2",
        "class": "repo",
        "strandId": "S3",
        "source": "src/mcp/tools/phase-checkpoint-records.ts",
        "claim": "Checkpoint writes require generic fields and allow extra research-ledger fields.",
        "confidence": "high"
      }
    ],
    "sidecars": [
      {
        "strandId": "S3",
        "status": "not-used",
        "reason": "Parent can inspect local checkpoint code directly."
      }
    ],
    "draftState": {
      "hasDraft": false,
      "sectionsTouched": [],
      "validationAttempted": false,
      "validationIssues": [],
      "finalWriteAttempted": false,
      "lastKnownPath": null
    },
    "nextAction": {
      "stage": "Decide",
      "pendingGate": "external-source confirmation",
      "safeCommand": "/blu-research-phase 3"
    }
  }
}
```

Initial implementation should not require every optional field for every simple
run. Require the generic MCP checkpoint fields plus
`researchLedger.schemaVersion`, `researchLedger.strands`, and
`researchLedger.nextAction` in prompt/runtime tests. Later, if the payload proves
stable, move the nested `researchLedger` shape into
`phase-checkpoint-records.ts` as a discriminated optional schema for
`ownerCommand: "/blu-research-phase"`.

#### Resume, Discard, And Default Behavior

Add precise branch rules to `research-phase-runtime-contract.md` and
`docs/commands/research-phase.md`:

```md
Checkpoint resume behavior:

- If no checkpoint exists, start a fresh parent-owned strand ledger.
- If a checkpoint exists and `safeToResume=true`, resume by default. Show a
  compact recap of completed strands, blocked strands, pending gate, and next
  action before doing more work.
- If the user explicitly asks to discard a safe research checkpoint, call
  `blueprint_phase_checkpoint_delete` with
  `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`;
  then start fresh only if deletion succeeds.
- If a checkpoint exists but `safeToResume=false`, do not resume, overwrite, or
  delete it by default. Report `ownerCommand`, `resumeMode`, warnings, and the
  next safe implemented action.
- If a legacy checkpoint is mode-compatible but missing `ownerCommand`, treat it
  as resumable only when `safeToResume=true`, but include the warning in the
  progress recap and refresh it into the richer research ledger before the next
  pause.
- If final research is successfully written and routing is synced, delete the
  research-owned checkpoint. If state sync, state load, or command-catalog
  routing fails afterward, keep or refresh the checkpoint with the exact failure
  and do not claim the run fully completed.
```

This keeps the current default from the runtime contract, but removes ambiguity
around foreign checkpoints, legacy mode-only checkpoints, and discard requests.

#### Progress Recaps And Helper Fallback

`research-phase` currently relies on runtime metadata and the shared skill for
`update_topic`/`write_todos`; the command manifest intentionally avoids naming
those helpers. Preserve that boundary.

Update `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`
with research-specific pending gates:

```md
For `/blu-research-phase`, useful pending gates include checkpoint
resume-versus-discard, valid-research view/skip/update, external-source
confirmation, sidecar availability, strand blocker, validation repair, and
state-sync or route-refresh failure.
```

Add runtime-contract wording:

```md
When `update_topic` and `write_todos` are available, use them only as a
session-local mirror of the strand ledger: topic = current stage plus active
strand, todos = strand ids and statuses. They are never persistence and never
replace `blueprint_phase_checkpoint_put`.

When those helpers are unavailable, emit compact progress recaps at stage
boundaries and exceptional events:

`Stage: Execute | Scope: Phase 3 Phase Discovery | Mode: parent-only |
Completed: S1 context-lock, S2 repo-map | Active: S3 stack-and-dependencies |
Pending gate: external-source confirmation | Next safe action: checkpoint or
resume /blu-research-phase 3`

Do not narrate every file read. Recap after Read, after strand classification,
after each completed or blocked strand, before checkpointing, before validation
repair, and after Route.
```

Long-running helper fallback should be tied to output quality:

- If helpers are unavailable, the parent still runs the same ledger and
  checkpoint loop.
- If `blueprint-researcher` is unavailable or disabled, the parent narrows to
  one runnable strand at a time, uses scoped repo searches, and checkpoints
  blocked strands instead of expanding silently.
- If a sidecar fails or times out, the parent records a sidecar packet with
  `status: "failed"`, retries inline only if the strand budget and source policy
  allow it, otherwise checkpoints with `stoppingReason: "tool-failure"` or
  `"budget-exhausted"`.

#### Parent-Owned Synthesis

Strengthen the existing parent-owned boundary without moving I4's sidecar packet
details into this section.

Add this to `research-phase-runtime-contract.md`:

```md
Before writing final research, the parent command must run a synthesis pass over
the accepted strand ledger. The final `XX-RESEARCH.md` may cite child packets or
repo/external evidence, but it must not paste a child transcript or let a sidecar
decide final confidence, open questions, routing, checkpoint deletion, or state
sync.

Parent synthesis should build this internal matrix before drafting:

| Strand id | Artifact sections affected | Accepted evidence ids | Recommendation | Test or validation implication | Unresolved blocker |
|---|---|---|---|---|---|

Only recommendations that map to accepted evidence or clearly labeled inference
should enter `## Recommendations`. Any strand that remains blocked should appear
in `## Open Questions` or cause a checkpointed no-final-write exit when it blocks
planner-grade output.
```

This aligns with the synthesis: sidecars can gather bounded evidence, but the
parent owns strand selection, evidence acceptance, final artifact authoring,
checkpointing, persistence, state sync, and routing.

#### Exact File Targets

Primary contract and docs:

- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`:
  add the strand ledger, checkpoint timing, resume/discard/default, progress
  recap, sidecar failure fallback, and parent synthesis wording.
- `skills/blueprint-phase-discovery/SKILL.md`: in the `/blu-research-phase`
  workflow rules, reference the runtime contract's strand ledger and checkpoint
  timing without duplicating the full shape.
- `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`:
  add research-specific pending gates and helper fallback recap shape.
- `docs/commands/research-phase.md`: document user-visible resume/discard
  behavior, checkpoint fields at a high level, and completion receipt wording.
- `docs/MCP-TOOLS.md`: expand the checkpoint notes to mention the optional
  research ledger nested payload and timing, while keeping the generic MCP shape
  authoritative.
- `docs/RUNTIME-REFERENCE.md` and `src/mcp/command-runtime-metadata.ts`: update
  the runtime notes so generated runtime-contract resources mention the ledger,
  parent synthesis, and helper fallback.
- `commands/blu-research-phase.toml`: optionally add one thin sentence about
  parent-owned strand ledgers; avoid copying the JSON shape or helper details
  into the manifest.

Potential later code target:

- `src/mcp/tools/phase-checkpoint-records.ts`: only after prompt/runtime behavior
  is stable, add an optional `researchLedger` schema for
  `/blu-research-phase`. Do not make this the first step unless tests show prompt
  guidance is insufficient.

#### Test Ideas

Add focused tests without changing runtime behavior first:

- `tests/phase-discovery-research.test.ts`: assert the command doc, skill,
  runtime contract, agent boundary, and runtime metadata mention `strand ledger`,
  parent-owned synthesis, resume-by-default, guarded discard, sidecar failure
  fallback, and concise progress recaps.
- `tests/phase-discovery-tools.test.ts`: round-trip a checkpoint containing the
  nested `researchLedger` example through `blueprintPhaseCheckpointPut` and
  `blueprintPhaseCheckpointGet`, proving the current catchall shape preserves
  research-specific state.
- `tests/phase-discovery-tools.test.ts`: assert a research-owned checkpoint with
  `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`
  can be deleted after success, while the existing foreign-owner tests remain
  unchanged.
- `tests/phase-discovery-research.test.ts`: add metadata assertions that
  `buildBlueprintCommandRuntimeContractResource("research-phase")` exposes the
  updated contract notes and still has only
  `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
  as the effective skill input.
- `tests/skill-metadata.test.ts` or `tests/extension-runtime-contracts.test.ts`:
  keep guarding that the command manifest uses runtime FQNs and does not become
  the bulky source of truth for helper or checkpoint internals.

If the optional code schema is added later:

- Add a `phase-checkpoint-records` unit path that rejects
  `researchLedger.schemaVersion` mismatches only when `researchLedger` is present
  and preserves legacy checkpoints for reads.
- Add a size-oriented fixture because `blueprint_phase_checkpoint_get` reads
  checkpoint JSON with a 256 KiB limit; the ledger must stay compact and packet
  based, not transcript based.

#### Risks And Mitigations

- Risk: the taxonomy makes simple research feel too heavy. Mitigation: allow
  small runs to collapse strands and require only meaningful ledger fields when
  the run is non-trivial, paused, blocked, or sidecar-assisted.
- Risk: the checkpoint grows into a transcript dump. Mitigation: store packet
  ids, claims, source references, status, and next action only; explicitly reject
  full child conversations in the runtime contract.
- Risk: checkpoint schema changes break legacy resumes. Mitigation: start with a
  nested `researchLedger` field under the existing catchall schema, then migrate
  to stricter validation only after compatibility tests exist.
- Risk: parent-owned synthesis overlaps with I2 evidence-packet and I4 subagent
  work. Mitigation: I3 should define ledger orchestration and checkpoint timing;
  I2 owns detailed source/evidence fields, I4 owns child packet wording, and I5
  owns final artifact validation.
- Risk: checkpoint deletion happens too early. Mitigation: document and test
  deletion only after final write, synced `STATE.md`, refreshed state load, and
  implemented-command routing complete.
- Risk: helper fallback becomes noisy. Mitigation: require stage-boundary and
  exceptional-event recaps only, with a stable one-line receipt format.
<!-- IMPROVEMENT:I3:END -->

### I4. `blueprint-researcher` Subagent Contract

<!-- IMPROVEMENT:I4:START -->
#### Current Contract Read

The current `blueprint-researcher` boundary is directionally safe but still too
prose-shaped for the reconciled research principles above.

- `agents/blueprint-researcher.md` is read-only at the tool layer
  (`list_directory`, `read_file`, `glob`, `grep_search`) and already says the
  parent owns external approval, `ask_user` gates, persistence, checkpoints,
  state updates, and routing. Keep that.
- The agent already has the right non-fetching external evidence rule: it must
  not fetch official docs itself, and parent-supplied external packets need
  title, date, URL, excerpt, and claim. Keep that, but make the returned
  warning machine-shaped instead of prose-only.
- The weak point is the handoff: `agents/blueprint-researcher.md` currently
  allows "a populated `XX-RESEARCH.md` body" and the runtime contract asks for
  "populated research content or a bounded section draft with warnings." That
  lets a sidecar act like a near-owner of the final artifact, while the
  reconciled plan says subagent handoffs should be packets, not transcripts or
  whole-artifact drafts by default.
- `commands/blu-research-phase.toml`, `skills/blueprint-phase-discovery/SKILL.md`,
  `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`,
  and `docs/commands/research-phase.md` consistently preserve the parent-owned
  path and `workflow.subagents` gate, but none of them names a bounded input
  packet or output schema.
- Current tests verify tool allowlists, optional-agent discoverability, broad
  parent-owned wording, non-fetching external evidence text, and command catalog
  metadata. They do not yet prevent regressions where the sidecar returns
  unsupported external citations, omits failed searches, drops claim confidence,
  or treats full-artifact drafting as the normal mode.

#### Recommended Contract Shape

Make `blueprint-researcher` an agent-as-tool with explicit packet IO. The parent
still chooses strands, gathers or approves external evidence, accepts or rejects
packets, normalizes final Markdown, writes through MCP, checkpoints, syncs state,
and routes. The subagent answers one bounded question from the supplied context
and local repo reads.

Suggested input packet wording for
`skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
and `agents/blueprint-researcher.md`:

```ts
type ResearchSidecarInputV1 = {
  packetVersion: "research-sidecar.v1";
  parentCommand: "/blu-research-phase" | "/blu-discuss-phase" | "/blu-list-phase-assumptions";
  mode: "strand-findings" | "section-draft" | "full-artifact-draft" | "gray-area-memo";
  phase: {
    number: number;
    name: string;
    goal: string;
    successCriteria: string[];
    requirementIds: string[];
  };
  strand: {
    id: string;
    question: string;
    allowedSourceClasses: Array<"repo" | "locked-blueprint-doc" | "parent-supplied-external" | "inference">;
    repoAnchors: string[];
    expectedOutput: "claims-packet" | "named-section-markdown" | "complete-research-body" | "memo";
    maxReadScope?: string;
    completionCriteria: string[];
  };
  context: {
    contextPath: string;
    contextContent: string;
    existingResearchPath?: string;
    existingResearchContent?: string;
    codebaseSummaryPaths?: string[];
  };
  contract?: {
    artifactId: "phase.research";
    authoringTemplate?: string;
    requiredHeadings?: string[];
    targetHeadings?: string[];
  };
  repoEvidencePacket?: Array<{
    sourceId: string;
    path: string;
    role: "contract" | "runtime" | "test" | "doc" | "config" | "example" | "unknown";
    excerpt?: string;
    locator?: string;
  }>;
  externalEvidencePacket?: Array<{
    sourceId: string;
    title: string;
    url: string;
    accessedAt: string;
    evidenceClass: "official-reference" | "supplied-reference";
    excerpt: string;
    claim: string;
    suppliedBy: "parent" | "user";
  }>;
  forbiddenActions: Array<
    "fetch-external-sources" |
    "write-files" |
    "mutate-blueprint-state" |
    "ask-user" |
    "route-command" |
    "expand-phase-scope"
  >;
};
```

Suggested bounded return packet:

```ts
type ResearchSidecarPacketV1 = {
  packetVersion: "research-sidecar.v1";
  status: "answered" | "partial" | "blocked" | "needs-parent-evidence";
  mode: ResearchSidecarInputV1["mode"];
  strandId: string;
  conciseAnswer: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  claims: Array<{
    claimId: string;
    text: string;
    support: "supported" | "partially-supported" | "conflict" | "unverified" | "inference";
    confidence: "LOW" | "MEDIUM" | "HIGH";
    sourceIds: string[];
    plannerImpact: string;
  }>;
  repoSources: Array<{
    sourceId: string;
    path: string;
    role: "contract" | "runtime" | "test" | "doc" | "config" | "example" | "unknown";
    locator?: string;
    whyItMatters: string;
  }>;
  externalSources: Array<{
    sourceId: string;
    title: string;
    url: string;
    accessedAt: string;
    evidenceClass: "official-reference" | "supplied-reference";
    suppliedBy: "parent" | "user";
    whyItMatters: string;
  }>;
  failedSearches: Array<{
    queryOrPath: string;
    scope: string;
    result: "no-hit" | "too-broad" | "unreadable" | "not-allowed";
    impact: string;
  }>;
  draftSections?: Array<{
    heading: string;
    markdown: string;
    sourceIds: string[];
  }>;
  fullArtifactDraft?: {
    markdown: string;
    sourceIds: string[];
    useOnlyWhenParentRequestedFullArtifactMode: true;
  };
  warnings: Array<{
    code:
      | "external-evidence-missing"
      | "repo-evidence-thin"
      | "conflicting-sources"
      | "scope-limit-reached"
      | "inference-used"
      | "mode-limit";
    severity: "info" | "warning" | "blocker";
    message: string;
    requiredParentAction?: string;
  }>;
  followUps: Array<{
    owner: "parent" | "user" | "plan-phase";
    action: string;
    reason: string;
  }>;
};
```

Mode rules to add:

- `strand-findings` should be the default `/blu-research-phase` subagent mode.
  It returns claims, sources, uncertainty, failed searches, and follow-ups, not
  final artifact prose.
- `section-draft` is allowed only when the parent names target headings from
  `contract.authoringTemplate`. The child may return `draftSections`, but the
  parent still merges, normalizes, validates, and persists.
- `full-artifact-draft` should be rare and explicit. Require the parent to pass
  the full authoring template, existing research posture, all known strand
  packets or accepted evidence, and a sentence saying why a full draft is safer
  than section synthesis. The child still returns a packet; the parent remains
  the only writer and validator.
- `gray-area-memo` stays for discuss/list-assumption use and must not include
  `phase.research` headings unless the parent explicitly requested
  `/blu-research-phase` artifact mode.

#### Exact File Targets

1. `agents/blueprint-researcher.md`

   Replace the current "Outputs", "Output Mode Selection", and "Required Output
   Contract" shape with "Sidecar Input Packet", "Output Modes", and "Sidecar
   Output Packet" sections. Keep the read-only tool allowlist and
   parent-owned/external rules. Remove the duplicated artifact-grade sentence in
   the Purpose section while editing.

   Proposed wording:

   > Default to `strand-findings`. Return `ResearchSidecarPacketV1`, not a
   > final saved artifact. `section-draft` may include only the target headings
   > named by the parent. `full-artifact-draft` is allowed only when the parent
   > explicitly asks for that mode and supplies the full `phase.research`
   > authoring template plus accepted evidence. In every mode, the parent command
   > owns synthesis, MCP writes, checkpoint mutation, state sync, routing, and
   > user-visible decisions.

   Add the non-fetching rule in stricter terms:

   > This agent must not fetch, browse, web-search, shell-query, package-query,
   > or imply fresh external verification. Use only `externalEvidencePacket`
   > entries supplied by the parent or user. If an external claim lacks a packet,
   > return `status: "needs-parent-evidence"` or mark the claim
   > `support: "unverified"` with warning code `external-evidence-missing`.

2. `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`

   Replace the current subagent pass-list with the `ResearchSidecarInputV1`
   fields above, and replace "Ask the agent for populated research content or a
   bounded section draft with warnings" with:

   > Ask `blueprint-researcher` for `ResearchSidecarPacketV1`. The parent accepts
   > or rejects each packet before synthesis. Packets may include
   > `draftSections` only in `section-draft` mode and `fullArtifactDraft` only in
   > explicit `full-artifact-draft` mode. Unsupported external claims remain
   > unverified and must not be promoted into `## State Of The Art`,
   > `## Recommendations`, or `## Sources` as confirmed external truth.

3. `skills/blueprint-phase-discovery/SKILL.md`

   Keep the current command-scoped MCP allowlist and `workflow.subagents` gate.
   In the `/blu-research-phase` workflow rule 6, add that the parent sends a
   structured sidecar input packet, receives a structured sidecar packet, and
   must treat packet warnings as parent-owned synthesis inputs rather than final
   artifact status.

4. `commands/blu-research-phase.toml`

   Add one compact command-local gate after the existing subagent sentence:

   > When using `blueprint-researcher`, pass a bounded sidecar input packet and
   > require a structured packet response. Do not ask the sidecar to fetch
   > external sources, make user decisions, persist artifacts, checkpoint, sync
   > state, or route follow-up commands.

5. `docs/commands/research-phase.md`

   Under "Research Runtime Anchors" or "Skills And Subagents", document the
   packet names and the section/full-artifact mode distinction so the public
   command contract matches the runtime contract.

6. `src/mcp/command-runtime-metadata.ts`

   Update the `research-phase` `contractNotes` string only if the resource
   should surface the packet terminology. Do not change optional-agent routing
   semantics or required MCP tools for this improvement.

7. Leave `src/mcp/agent-metadata.ts` and the tool allowlist unchanged. The
   improvement is a contract/output-shape change, not a reason to grant shell,
   write, browser, web-search, or MCP mutation tools to `blueprint-researcher`.

#### Test Ideas

- `tests/agent-contract-specialists.test.ts`: extend the researcher assertions
  to require `ResearchSidecarInputV1`, `ResearchSidecarPacketV1`,
  `strand-findings`, `section-draft`, `full-artifact-draft`,
  `needs-parent-evidence`, `external-evidence-missing`, `failedSearches`, and
  explicit parent-owned synthesis/persistence/routing text.
- `tests/phase-discovery-research.test.ts`: update the contract drift test so
  command manifest, discovery skill, runtime contract, command docs, runtime
  metadata, and agent file all mention structured sidecar packets, the
  non-fetching external evidence rule, and the default `strand-findings` mode.
- Add a negative text assertion that no research runtime contract says the
  parent should "ask the agent for populated research content" without packet
  qualification. This prevents sliding back into full-artifact sidecar ownership.
- Keep `tests/agent-tool-allowlist.test.ts` as the guard that
  `blueprint-researcher` remains read-only and does not reference ungranted
  browser, shell, write, or MCP tools in its body.
- `tests/agent-schema.test.ts` should not need new frontmatter expectations
  unless the team decides to add a declarative `output_schema` field later. For
  this pass, body-contract tests are enough.
- `tests/command-catalog.test.ts` likely needs no behavior changes; it already
  checks optional agents point at valid Gemini subagent files. Only add coverage
  there if the runtime contract resource must expose packet terminology.

#### Risks And Rollout Notes

- Too much schema can make a small sidecar slower than the parent-only fallback.
  Keep `strand-findings` compact and reserve `full-artifact-draft` for explicit
  parent requests.
- JSON-shaped packets inside a Markdown agent response are still model-generated
  text unless a future MCP parser validates them. Treat this first wave as
  contract/test hardening; add parser-backed validation only if packet drift
  remains a real failure mode.
- `full-artifact-draft` can blur ownership if it is easy to invoke. The mode
  should be documented as exceptional, and tests should protect the default
  `strand-findings` path.
- External evidence packets can become stale. Require `accessedAt` and
  `suppliedBy`, and lower confidence when the parent supplied old or incomplete
  evidence.
- Backward compatibility risk is mostly prompt/test churn, not runtime data
  migration, because no `.blueprint/` schema needs to change for this wave.
<!-- IMPROVEMENT:I4:END -->

### I5. Artifact Template, Validation, And Planner Consumption

<!-- IMPROVEMENT:I5:START -->
#### Current Inspection

The current `phase.research` contract is a good compatibility base but not yet a planner-grade interface. In `src/mcp/artifact-contracts/index.ts`, `renderResearchTemplate(...)` emits required headings, a three-column `Phase Requirements` table, freeform bullets for most research sections, a simple `Confidence Breakdown` table, one fenced `Code Examples` block, freeform `Recommendations`, and a flat bullet list under `Sources`. The contract entry keeps `freehandPolicy: "additional-top-level-headings"`, which is useful because richer ledgers can be introduced without adding new required headings immediately.

The current validator in `src/mcp/tools/artifacts.ts` checks structure rather than support. `validateResearchArtifactContent(...)` verifies the H1, scaffold placeholders, the locked `**Confidence:** LOW|MEDIUM|HIGH` marker, presence and substance for every required heading, at least one populated `Phase Requirements` row, at least one recommendation bullet, and at least one source bullet with a URL, repo path, or cited root file. It only warns when `Code Examples` lacks a fenced block. All research failures currently collapse into `research.invalid`, so downstream repair text cannot distinguish missing source IDs, unsupported high confidence, missing access dates, or weak plan handoff.

The planner path already requires the right reads, but it does not define how to consume the research body. `blueprint_phase_research_status` only gates on `researchValid === true` before planning; `blueprint_phase_plan_authoring_context` narrows `knownEvidenceArtifacts` to saved artifact paths, not recommendation rows or claims inside `XX-RESEARCH.md`; and `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md` plus `docs/commands/plan-phase.md` tell the planner to read actual research content but not how to map research sections into `phase.plan` fields such as `readFirst`, `requirements`, `filesModified`, `verification`, `requirementCoverage`, `evidenceCoverage`, and `unknownsAndDeferrals`.

#### Narrow Recommendation

Keep every existing required heading and the `**Confidence:**` marker. Improve the authoring template and prompt contracts first, then add deterministic diagnostics as warnings, then graduate the highest-signal checks to strict validation after fixtures prove old valid research is not broken accidentally.

The first implementation slice should touch these files:

- `src/mcp/artifact-contracts/index.ts`: enrich `renderResearchTemplate(...)`, `phase.research.notes`, and placeholder signals.
- `src/mcp/tools/artifacts.ts`: add optional ledger parsers and warning-grade research diagnostics inside `validateResearchArtifactContent(...)`.
- `src/mcp/tools/phase.ts`: make research repair suggestions include the new diagnostic repair hints instead of the generic source/section message.
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`: explain that the new ledgers are planner-critical but compatibility-preserving.
- `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md` and `skills/blueprint-phase-planning/SKILL.md`: define the research-to-plan mapping rule.
- `docs/commands/plan-phase.md`: add the user-facing handoff contract so planning does not browse live docs when a Plan Input Queue row says research is partial.
- Tests listed below.

#### Template Changes

Do not add new required headings in the first slice. Instead, replace the weak placeholder shapes inside existing sections, and allow one optional extra top-level heading named `## Claim Support Table`. The optional heading uses the existing `additional-top-level-headings` policy, so older artifacts stay compatible.

Proposed `Phase Requirements` replacement in `renderResearchTemplate(...)`:

```markdown
## Phase Requirements

| Requirement ID | Research Topic | Recommendation IDs | Plan Implication | Blocking Unknowns | Evidence IDs |
|----------------|----------------|--------------------|------------------|-------------------|--------------|
| <requirement-id> | <topic or decision area> | REC-001 | <what the plan should do or avoid> | <none or OQ-001> | SRC-001, CLM-001 |
```

Proposed `Recommendations` replacement with the Plan Input Queue:

```markdown
## Recommendations

| Rec ID | Disposition | Covers Requirements | Recommended Approach | Read First | Target Surfaces | Evidence IDs | Acceptance Signals | Tests / Checks | Dependencies | Risks / Mitigations | Confidence | Blocking Unknowns |
|--------|-------------|---------------------|----------------------|------------|-----------------|--------------|--------------------|----------------|--------------|---------------------|------------|-------------------|
| REC-001 | plan_now | <requirement ids> | <planner-ready implementation direction> | <repo paths/docs> | <files, modules, commands, APIs, schemas> | SRC-001, CLM-001 | <observable target state> | <test, grep, file-read, or command checks> | <none or REC-000> | <risk and mitigation> | LOW|MEDIUM|HIGH | <none or OQ-001> |
```

Recommended `Disposition` values:

- `plan_now`: `/blu-plan-phase` may convert the row into one or more `phase.plan` tasks.
- `defer`: preserve in `unknownsAndDeferrals` or future scope.
- `block`: stop planning until the named open question is answered.
- `reject`: record a researched option that should not become a plan task.

Proposed optional claim-support table:

```markdown
## Claim Support Table

| Claim ID | Claim | Claim Class | Support Status | Source IDs | Source Classes | Planner Impact |
|----------|-------|-------------|----------------|------------|----------------|----------------|
| CLM-001 | <specific factual or design claim> | repo_runtime | directly_supported | SRC-001 | repo_code, repo_test | supports REC-001 |
```

Recommended `Claim Class` values: `repo_runtime`, `repo_contract`, `external_practice`, `dependency_tool`, `security_or_privacy`, `inference`, `open_question`.

Recommended `Support Status` values: `directly_supported`, `inferred_from_supported`, `conflicting_evidence`, `not_enough_evidence`, `background_only`.

Proposed `Sources` replacement as a source register while preserving the heading:

```markdown
## Sources

| Source ID | Source Class | Path / URL | Role | Accessed / Version | Supports Claims | Limitations |
|-----------|--------------|------------|------|--------------------|-----------------|-------------|
| SRC-001 | repo_code | src/mcp/tools/artifacts.ts | validator | local worktree | CLM-001 | Line numbers may drift; verify before implementation. |
```

Recommended `Source Class` values:

- `saved_blueprint_artifact`
- `repo_code`
- `repo_test`
- `repo_doc`
- `command_manifest`
- `skill_contract`
- `mcp_contract`
- `official_external`
- `supplied_external`
- `package_registry`
- `vulnerability_database`
- `standard_or_paper`
- `inference`

Proposed `Confidence Breakdown` replacement:

```markdown
## Confidence Breakdown

| Topic | Confidence | Evidence Grade | Direct Repo Evidence | External Evidence | Contradictions / Gaps | Planning Effect |
|-------|------------|----------------|----------------------|-------------------|-----------------------|-----------------|
| <topic> | LOW|MEDIUM|HIGH | direct|mixed|inferred|insufficient | <SRC ids or none> | <SRC ids, declined, off, or none> | <none or exact gap> | plan_now|defer|block |
```

This keeps the global `**Confidence:**` marker but makes it auditable. A global `HIGH` should mean no `plan_now` recommendation depends on `not_enough_evidence`, no blocking open question is unresolved, and every high-impact recommendation has direct repo or approved official evidence.

Proposed `Code Examples` shape:

````markdown
## Code Examples

- Example ID: EX-001
- Use For: <the exact planning pattern this illustrates>
- Do Not Copy Blindly: <portability or context caveat>
- Sources: SRC-001

```text
<short code, config, command, or pseudocode example>
```
````

This preserves the fenced-code validator expectation while preventing examples from becoming uncited snippets.

#### Validation Diagnostics

Add helpers in `src/mcp/tools/artifacts.ts` rather than making the parser global on day one:

- `parseResearchMarkdownTable(section, requiredHeaders)` returns normalized row objects and ignores prose fallback.
- `collectResearchSourceRegister(content)` parses `## Sources` when it is a table and falls back to current bullet behavior.
- `collectResearchClaimRows(content)` parses optional `## Claim Support Table`.
- `collectResearchPlanInputRows(content)` parses `## Recommendations` as a Plan Input Queue when table headers are present.

Start with warnings for richer checks so existing valid artifacts do not become invalid immediately. Candidate diagnostics:

- `research.source_register_missing_ids`: `## Sources` has a table but rows lack stable `SRC-*` IDs.
- `research.external_source_missing_access_date`: `official_external`, `supplied_external`, `package_registry`, `vulnerability_database`, or `standard_or_paper` source lacks `Accessed / Version`.
- `research.claim_missing_source`: a claim row names a `Source ID` absent from the source register.
- `research.claim_unsupported_plan_now`: a `plan_now` recommendation cites only claims with `not_enough_evidence` or `background_only`.
- `research.recommendation_missing_plan_fields`: a Plan Input Queue row lacks `Read First`, `Target Surfaces`, `Evidence IDs`, `Acceptance Signals`, or `Tests / Checks`.
- `research.high_confidence_with_blocker`: top-level `**Confidence:** HIGH` appears while `Confidence Breakdown` or the Plan Input Queue has `block`, `not_enough_evidence`, or a non-`none` blocking unknown.
- `research.repo_runtime_without_repo_source`: a `repo_runtime` or `repo_contract` claim cites only external or inference sources.

Validation pseudocode:

```ts
const sourceRegister = collectResearchSourceRegister(content);
const claimRows = collectResearchClaimRows(content);
const planRows = collectResearchPlanInputRows(content);

if (sourceRegister.tablePresent) {
  warnRowsWithoutIds(sourceRegister.rows, "research.source_register_missing_ids");
  warnExternalRowsWithoutAccessDate(sourceRegister.rows, "research.external_source_missing_access_date");
}

for (const claim of claimRows) {
  if (!claim.sourceIds.every((id) => sourceRegister.ids.has(id))) {
    warn("research.claim_missing_source", claim.id, "Add the missing source row or remove the unsupported source id.");
  }
  if (isRepoRuntimeClaim(claim) && !claim.sourceIds.some((id) => sourceRegister.isRepoSource(id))) {
    warn("research.repo_runtime_without_repo_source", claim.id, "Cite repo code, tests, manifests, skills, contracts, or saved Blueprint artifacts.");
  }
}

for (const rec of planRows) {
  if (rec.disposition === "plan_now" && missingPlannerFields(rec)) {
    warn("research.recommendation_missing_plan_fields", rec.id, "Populate Read First, Target Surfaces, Evidence IDs, Acceptance Signals, and Tests / Checks.");
  }
  if (rec.disposition === "plan_now" && !hasSupportedClaimOrSource(rec, claimRows, sourceRegister)) {
    warn("research.claim_unsupported_plan_now", rec.id, "Cite a directly supported claim or downgrade the recommendation.");
  }
}

if (topLevelConfidence === "HIGH" && hasBlockingOrUnsupportedPlannerCriticalEvidence(planRows, claimRows)) {
  warn("research.high_confidence_with_blocker", "content", "Lower confidence or move the unsupported item to Open Questions.");
}
```

Once fixtures stabilize, the strict promotion order should be: missing Plan Input Queue fields for `plan_now`, missing source IDs, external access dates for external classes, repo-runtime claims without repo evidence, then high-confidence contradictions. True citation precision should stay advisory or model-reviewed because deterministic parsing can prove linkage shape, not semantic support.

#### Plan-Phase Handoff

Update `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md` so `/blu-plan-phase` consumes research in this order:

1. Read `XX-RESEARCH.md` through `blueprint_phase_artifact_read`.
2. If `## Recommendations` contains a Plan Input Queue, use it as the primary planning queue.
3. Convert only `Disposition=plan_now` rows into plan model candidates.
4. Map `Covers Requirements` to `requirements` and `requirementCoverage`.
5. Map `Read First` to top-level and task `readFirst`.
6. Map `Target Surfaces` to `filesModified` and `fileSurfaceCoverage`.
7. Map `Acceptance Signals` and `Tests / Checks` to task `acceptanceCriteria` and `verification`.
8. Map `Evidence IDs` and the saved `XX-RESEARCH.md` path to `evidenceCoverage`; the current task schema still requires the artifact path row, while the IDs explain the internal evidence used.
9. Map `Blocking Unknowns`, `Disposition=block`, and unresolved confidence gaps to `unknownsAndDeferrals` or stop before writing if they block safe planning.
10. If the queue is absent but research is valid, fall back to current prose synthesis and add an explicit no-queue warning in the plan/checker input.

Add matching concise language to `skills/blueprint-phase-planning/SKILL.md` and `docs/commands/plan-phase.md`: "Saved research is planner input, not background prose. Prefer the Plan Input Queue when present; do not browse live docs to fill missing external evidence; route to `/blu-research-phase` when a blocker row says the evidence is insufficient."

No new MCP read tool is required for the first slice because `blueprint_phase_artifact_read` already returns the full research body and `blueprint_phase_plan_authoring_context` already forces the saved research artifact into `evidenceCoverage`. A later improvement could add a read-only `blueprint_phase_research_digest` helper, but that should wait until the markdown table shape proves useful.

#### Test Ideas

- `tests/artifact-contracts.test.ts`: assert the `phase.research` authoring template includes the Plan Input Queue headers, source register headers, confidence evidence-grade headers, and code-example metadata while `requiredHeadings` remains unchanged.
- `tests/phase-discovery-research.test.ts`: update the scaffold/template shape assertions and add a valid table-rich research fixture accepted by `blueprintPhaseArtifactWrite`.
- `tests/phase-discovery-research.test.ts`: add warning fixtures for external source without access date, missing `SRC-*` reference, `repo_runtime` claim with only external evidence, and `HIGH` confidence plus a blocking unknown.
- `tests/phase-discovery-research.test.ts`: keep the existing "State Of The Art without freshness marker" fixture valid for repo-only prose, proving access-date checks apply only to declared external source classes or current external claims.
- `tests/phase-discovery-research.test.ts`: add an invalid-or-warning fixture where `Disposition=plan_now` lacks `Tests / Checks` or `Target Surfaces`, depending on the rollout stage.
- `tests/plan-phase-metadata.test.ts`: require the planning skill, runtime contract, and command doc to mention Plan Input Queue mapping to `requirements`, `readFirst`, `filesModified`, `verification`, `evidenceCoverage`, and `unknownsAndDeferrals`.
- `tests/phase-planning-tools.test.ts`: seed a table-rich `03-RESEARCH.md` and assert `blueprint_phase_plan_authoring_context.knownEvidenceArtifacts` still includes the research artifact path. This guards the current artifact-level handoff while prompt contracts handle row-level consumption.
- Optional later fixture: a tiny phase with two recommendation rows, one `plan_now` and one `block`, run a planner-contract text test that rejects any guidance telling `/blu-plan-phase` to plan the blocked row.

#### Risks

- Backward compatibility is the main risk. The current tests expect a simple three-column requirement table and bullet recommendations; keep required headings stable and roll richer ledger checks out as warnings first.
- Artifact bloat is real. The ledgers should cover planner-critical claims and recommendations, not every sentence in the research artifact.
- Markdown table parsing can be brittle with pipes inside paths or prose. Reuse existing table cell parsing helpers where possible and document escaping expectations in the template.
- Access-date diagnostics must not force web access. Repo-only or declined-external research remains valid when it avoids current external claims or labels them unverified.
- Planner over-dependence on row IDs could make prose fallback worse. Keep a fallback path for older valid research, but make the lack of a Plan Input Queue visible to planner/checker prompts.
- Full source-support precision cannot be deterministic. The first wave should validate IDs, source classes, access dates, path/source presence, and planner fields; semantic citation support can remain an advisory review later.
<!-- IMPROVEMENT:I5:END -->

### I6. Runtime Metadata, Command Docs, And Tests

<!-- IMPROVEMENT:I6:START -->
#### Current Parity Snapshot

- `src/mcp/command-runtime-metadata.ts` is the live source for `/blu-research-phase` catalog/resource metadata: `RESEARCH_PHASE_REQUIRED_TOOLS`, `RESEARCH_PHASE_SPEC_PATH`, and `RESEARCH_PHASE_RUNTIME_METADATA` define the implemented status, docs-free skill input path, exact MCP tool list, optional `blueprint-researcher`, write surfaces, and long `contractNotes`.
- `commands/blu-research-phase.toml` is intentionally concise and command-local. It covers the phase/context gate, `research.external_sources`, valid-research `view`/`skip`/`update`, invalid-research repair, `phase.research` contract reads, strict MCP writes, checkpoint ownership, synced state refresh, and implemented-only follow-up routing.
- `docs/commands/research-phase.md` largely mirrors the command manifest while adding operator-facing details: stage vocabulary, required MCP output shapes, runtime anchors, persistence contract, confirmation gates, edge cases, acceptance criteria, and test cases.
- `docs/RUNTIME-REFERENCE.md` has a dense `research-phase` row that mirrors the metadata `contractNotes`, including topic-strand posture, `update_topic`/`write_todos` as session-local helpers, repo-first evidence, external-source policy, parent-owned external evidence packets, checkpointing, invalid-write repair, state sync, and implemented-only routing.
- `tests/phase-discovery-research.test.ts` is the strongest parity guard. It audits command/docs/runtime-reference/MCP-tools/skill/agent text, verifies the runtime contract resource is anchored to `src/mcp/command-runtime-metadata.ts#research-phase`, validates the scaffold and write behavior, rejects fake source evidence, covers missing-context routing, non-mutating valid-research reuse, and the earlier-phase synced-state regression.
- `tests/mcp-contract-audit-metadata.test.ts` adds cross-discovery parity, but its research assertions are currently lighter than `phase-discovery-research.test.ts`.
- `tests/command-catalog.test.ts` verifies implementation status, required tools, optional agents, docs-free runtime-owned skill inputs, and runtime-contract resource/catalog anchoring for `research-phase`.

#### Concrete Improvement Targets

- Treat `src/mcp/command-runtime-metadata.ts` as the first file to update when the runtime contract changes. Any new deterministic tool dependency, optional agent, write surface, skill input, or contract-note guarantee must land in `RESEARCH_PHASE_RUNTIME_METADATA` before docs copy it.
- Keep `RESEARCH_PHASE_REQUIRED_TOOLS` exact. If future implementation adds deterministic validation, source-packet, code-map, or evidence-rendering MCP tools, add them there and then update `commands/blu-research-phase.toml`, `docs/commands/research-phase.md`, `docs/RUNTIME-REFERENCE.md`, and `tests/command-catalog.test.ts` in the same change.
- Resolve the source-status mismatch deliberately: the live runtime resource is source-owned through `src/mcp/command-runtime-metadata.ts#research-phase`, while the human runtime-reference row still presents `docs/commands/research-phase.md` and `docs-aligned`. Either keep that as a documented human-row convention or change the row labels, but add a test so future editors do not infer two competing authorities.
- Preserve the current surface split around Gemini helpers. `src/mcp/command-runtime-metadata.ts` and `docs/RUNTIME-REFERENCE.md` mention `update_topic`/`write_todos`; `commands/blu-research-phase.toml` and `docs/commands/research-phase.md` intentionally do not, and tests assert that absence. If that policy changes, update all three tests in one commit.
- When adopting the reconciled improvements, add only concise command-manifest gates and put richer detail in `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md` plus `docs/commands/research-phase.md`. Good metadata phrases to add: source register, evidence lanes, source-policy decision, planner-ready recommendation ledger, research-owned strand/checkpoint ledger, and parent-owned subagent evidence packets.
- Keep `docs/RUNTIME-REFERENCE.md` as a summary, not a second full spec. It should name new guarantees and point at the runtime contract; avoid copying large template tables into the row.

#### Test Additions

- In `tests/phase-discovery-research.test.ts`, extend the existing parity audit to assert any new command/docs/runtime keywords introduced for source register, evidence lanes, ask-decision outcomes, strand checkpoint ledger, Plan Input Queue, and parent-owned sidecar evidence packets.
- In `tests/phase-discovery-research.test.ts`, add a positive fixture for the upgraded `phase.research` template once it changes: a valid artifact with repo evidence, external/source-date evidence when applicable, inference notes, recommendation IDs, tests/checks, and unresolved blockers should pass `blueprint_phase_artifact_write`.
- In `tests/phase-discovery-research.test.ts`, add negative or warning-mode fixtures before hard gates: external URL without access date, high-confidence recommendation with unresolved planner-critical evidence, recommendation without tests/checks, sidecar claim of external verification without parent-supplied packet, and repo-runtime claim without repo evidence.
- In `tests/phase-discovery-research.test.ts`, add checkpoint round-trip coverage for research-owned strand state if the checkpoint shape becomes stricter: `ownerCommand`, `resumeMeta.mode: "research"`, pending/completed strands, current question, source-policy decision, and safe resume/delete behavior.
- In `tests/mcp-contract-audit-metadata.test.ts`, strengthen the discovery parity test so research gets the same level of cross-surface coverage as discuss: command manifest, command doc, runtime contract, runtime reference, `docs/MCP-TOOLS.md`, `skills/blueprint-phase-discovery/SKILL.md`, and `agents/blueprint-researcher.md` should all agree on the new evidence/checkpoint/subagent terms.
- In `tests/command-catalog.test.ts`, keep the `research-phase is implemented once...` tool list exact and extend the runtime-owned discovery expectations only when `RESEARCH_PHASE_RUNTIME_METADATA.requiredInputPaths` or optional agents actually change.
- If a new built-runtime smoke assertion is added for research metadata, place it with existing build/dist smoke coverage rather than duplicating catalog logic in three places.

#### Docs Sync List

- Primary runtime docs: `src/mcp/command-runtime-metadata.ts`, `docs/RUNTIME-REFERENCE.md`, `docs/commands/research-phase.md`, `commands/blu-research-phase.toml`.
- Rich behavior docs that must move with any non-trivial research-flow change: `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`, `skills/blueprint-phase-discovery/SKILL.md`, and `agents/blueprint-researcher.md`.
- Artifact/template docs when output shape changes: `src/mcp/artifact-contracts/index.ts`, `docs/ARTIFACT-SCHEMA.md`, and the scaffold/write fixtures in `tests/phase-discovery-research.test.ts`.
- Tool-surface docs when MCP calls or returned fields change: `docs/MCP-TOOLS.md`, `tests/mcp-contract-audit-metadata.test.ts`, and `tests/command-catalog.test.ts`.
- Command-catalog docs only if declared status, family, risk, or routability changes: `docs/COMMAND-CATALOG.md` plus catalog tests. Do not touch status semantics for this improvement unless a real runtime substrate changes.

#### Build, Dist, And Verification Reminders

- In a fresh Blueprint worktree, run `npm ci` before any npm build, typecheck, or test command.
- For docs-only changes, targeted verification can stay to text inspection and the relevant `npx tsx --test ...` files if assertions changed.
- For TypeScript runtime metadata, artifact contract, command asset, skill, or agent changes, run `npm run typecheck`, `npm run build`, and targeted tests: `npx tsx --test tests/phase-discovery-research.test.ts tests/mcp-contract-audit-metadata.test.ts tests/command-catalog.test.ts`.
- Because `dist/` is tracked, rebuild after runtime-affecting changes and review the generated `dist/` diff before PR. Stale built metadata can make Gemini launch old behavior even when source and docs look correct.
- Avoid `npm test -- <file>` as a focused shortcut here; this repo's npm test behavior can broaden unexpectedly. Use `npx tsx --test <files>` for targeted loops, then run the broader suite when preparing to merge.

#### Risks

- Over-tightening validation around citations or planner-readiness can invalidate existing useful research artifacts. Stage new checks as warnings or compatibility fixtures before making them hard failures.
- String-based docs tests are useful but brittle. Keep assertions focused on contract-critical phrases, not exact prose paragraphs.
- Adding new evidence structure only to docs will create a false sense of runtime support. Pair template/validation changes with artifact-contract tests and, where needed, MCP result-shape tests.
- Adding a new required MCP tool without updating runtime metadata will make `/blu-research-phase` appear implemented incorrectly or hide the new dependency from runtime-contract resources.
- Copying `update_topic`/`write_todos` into the command manifest or command doc will currently break tests and may blur the intended session-local-versus-persistence boundary.
- External-source behavior is freshness-sensitive and policy-sensitive. Tests should verify the configured `off`/`ask`/`auto` gates and metadata wording without requiring live web access.
- Other agents may be editing adjacent improvement sections in this worktree. Future edits should patch only the intended marker block and re-read the block before applying changes.
<!-- IMPROVEMENT:I6:END -->

## Exhaustive Improvement Plan

<!-- PLAN:START -->
### Planning Premise

This plan is for a future implementation wave. It intentionally does not fix the command in this branch. The implementation should preserve the current Blueprint product boundaries:

- `/blu-research-phase` remains a pre-planning discovery command, not a planner, fixer, dependency installer, or generic browsing workflow.
- Persistent writes still go only through Blueprint MCP tools.
- `XX-CONTEXT.md` stays read-only for `/blu-research-phase`; missing, invalid, bootstrap-starter, contradictory, or unreadable context routes to `/blu-discuss-phase <phase>`.
- `research.external_sources=off|ask|auto` remains the authority for external verification.
- `blueprint-researcher` remains read-only and bounded; it does not fetch external sources, make user decisions, write artifacts, checkpoint, sync state, or route.
- Root/help/progress/next routing must continue to recommend implemented commands only.
- Validation should become stricter in stages so existing useful research artifacts are not broken abruptly.

The most important conceptual change is to make research evidence auditable and planner-consumable:

1. Resolve and pin one selected phase.
2. Prove research readiness separately from plan readiness.
3. Run topic strands against a parent-owned ledger.
4. Capture external-source decisions and evidence packets explicitly.
5. Accept or reject sidecar packets before synthesis.
6. Draft `XX-RESEARCH.md` with source IDs, claim IDs, and a Plan Input Queue.
7. Validate structure deterministically, with warning-first rollout for richer checks.
8. Teach `/blu-plan-phase` to consume the queue when present.

### Execution Order

#### Wave 1. Contract And Docs Skeleton

Purpose: establish the behavior contract before changing runtime shape.

Files:

- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- `commands/blu-research-phase.toml`
- `docs/commands/research-phase.md`
- `skills/blueprint-phase-discovery/SKILL.md`
- `agents/blueprint-researcher.md`
- `src/mcp/command-runtime-metadata.ts`
- `docs/RUNTIME-REFERENCE.md`
- `docs/MCP-TOOLS.md`

Implementation notes:

1. Add a short "Research Readiness Versus Planning Readiness" section to the runtime contract:

```md
## Research Readiness Versus Planning Readiness

`blueprint_phase_research_status.planningReadiness` is the handoff gate for
`/blu-plan-phase`; it is not the pre-draft gate for `/blu-research-phase`.
`/blu-research-phase` may create or repair `XX-RESEARCH.md`, so missing or
invalid research is not itself a reason to stop research.

The pre-draft research gate is:

- the phase resolves through `blueprint_phase_locate`
- the selected phase is unambiguous or explicitly chosen
- saved phase context is present, readable, valid, usable, and not a bootstrap
  starter
- `blueprint_phase_artifact_read({ artifact: "context" })` returns the actual
  current context content
```

2. Add a "Selected Phase Pinning" rule:

```md
Store `selectedPhase = blueprint_phase_locate.phaseNumber` during Resolve.
Every later phase-scoped MCP call, including
`blueprint_state_update({ base: "synced", patch: { currentPhase } })`, uses
that numeric selected phase. Do not replace it with a directory, slug,
filename, roadmap-derived phase, or `state_load.derivedStatus.currentPhase`
after Resolve.
```

3. Add the thin manifest gate only to `commands/blu-research-phase.toml`:

```text
- Pin the selected phase from `blueprint_phase_locate.phaseNumber` and use it
  for all later phase-scoped calls, including synced `STATE.md` refresh.
- For non-trivial research, classify work into parent-owned topic strands and
  checkpoint the strand ledger rather than sidecar transcripts.
- When using `blueprint-researcher`, pass a bounded sidecar input packet and
  require a structured packet response; do not ask it to fetch external sources,
  persist artifacts, checkpoint, sync state, or route follow-up commands.
```

4. Add concise `contractNotes` terms to `src/mcp/command-runtime-metadata.ts`:

```text
research-specific readiness gate, selected phase pinning from
blueprint_phase_locate.phaseNumber, parent-owned strand ledger, source register,
claim support, Plan Input Queue, parent-gathered external evidence packets, and
structured blueprint-researcher sidecar packets
```

5. Mirror the concise version in `docs/RUNTIME-REFERENCE.md`; keep the full spec in the runtime contract.

Tests:

- Extend `tests/phase-discovery-research.test.ts` to assert the manifest, command doc, runtime contract, runtime metadata, runtime reference, and discovery skill mention the new contract-critical terms.
- Extend `tests/mcp-contract-audit-metadata.test.ts` to include research parity for those same terms.

#### Wave 2. Runtime Readiness And Artifact Read Hardening

Purpose: add additive MCP result fields and structured read failure behavior.

Files:

- `src/mcp/tools/phase.ts`
- `src/mcp/tools/state.ts` only if current-phase ambiguity needs derived-state support
- `docs/MCP-TOOLS.md`
- `docs/commands/research-phase.md`
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- `tests/phase-discovery-research.test.ts`
- `tests/phase-discovery-tools.test.ts`

Add a research-specific readiness result to `blueprintPhaseResearchStatus`. Do not mutate `planningReadiness`.

Suggested type:

```ts
type PhaseResearchReadinessResult = {
  readyForResearch: boolean;
  selectedPhase: string | null;
  nextSafeAction: string;
  blockers: string[];
  diagnostics: PhaseArtifactValidationDiagnostic[];
};
```

Suggested builder:

```ts
function buildPhaseResearchReadiness(args: {
  context: PhaseContextResult;
  contextStatus: PhaseArtifactUsabilityResult;
}): PhaseResearchReadinessResult {
  const selectedPhase = args.context.phase?.phaseNumber ?? null;

  if (!selectedPhase) {
    return {
      readyForResearch: false,
      selectedPhase: null,
      nextSafeAction: "Run /blu-progress to review the next safe Blueprint action",
      blockers: ["Phase could not be resolved for research."],
      diagnostics: [],
    };
  }

  if (!args.contextStatus.usable) {
    return {
      readyForResearch: false,
      selectedPhase,
      nextSafeAction: `Run /blu-discuss-phase ${selectedPhase} to rebuild the current phase context`,
      blockers: [
        args.contextStatus.present
          ? "Saved phase context exists but is not usable for research."
          : "Phase research requires a usable XX-CONTEXT.md artifact.",
        ...args.contextStatus.issues,
      ],
      diagnostics: args.contextStatus.diagnostics,
    };
  }

  return {
    readyForResearch: true,
    selectedPhase,
    nextSafeAction: `Continue /blu-research-phase ${selectedPhase}`,
    blockers: [],
    diagnostics: [],
  };
}
```

Return it additively:

```ts
return {
  ...
  researchReadiness: buildPhaseResearchReadiness({ context, contextStatus }),
};
```

Harden `blueprintPhaseArtifactRead` so unexpected read failures return a structured result:

```ts
try {
  const content = await fs.readFile(absolutePath, "utf8");
  return {
    phaseFound: true,
    found: true,
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName: located.phaseName,
    phaseDir: located.phaseDir,
    artifact,
    path: artifactPath,
    content,
    reason: null,
  };
} catch (error) {
  const reason = error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "unknown read failure";

  return {
    phaseFound: true,
    found: false,
    phaseNumber: located.phaseNumber,
    phasePrefix: located.phasePrefix,
    phaseName: located.phaseName,
    phaseDir: located.phaseDir,
    artifact,
    path: artifactPath,
    content: null,
    reason: `${artifactPath} could not be read: ${reason}.`,
  };
}
```

Optional additive scope-resolution object:

```ts
type PhaseScopeResolution = {
  selectedPhase: string | null;
  resolvedFrom: string | null;
  refreshedCurrentPhase: string | null;
  ambiguous: boolean;
};
```

Command behavior:

- Explicit phase argument wins, with a warning if it differs from refreshed current phase.
- Omitted phase plus disagreement between state and roadmap becomes a scope gate before writing.
- The final state update uses `currentPhase: selectedPhase`.

Tests:

- `researchReadiness.readyForResearch=false` for missing context, bootstrap starter context, invalid context, and unreadable context.
- `researchReadiness.readyForResearch=true` for valid context even when research is missing or invalid.
- `blueprint_phase_artifact_read` returns `found:false` with a reason for a directory-at-file-path or dangling symlink fixture.
- Existing earlier-selected-phase test also asserts docs/runtime contract say `currentPhase` comes from `blueprint_phase_locate.phaseNumber`.

#### Wave 3. External Source Decision And Evidence Packet Contract

Purpose: make external evidence auditable without broadening web authority.

Files:

- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- `agents/blueprint-researcher.md`
- `commands/blu-research-phase.toml`
- `docs/commands/research-phase.md`
- `src/mcp/command-runtime-metadata.ts`
- `docs/RUNTIME-REFERENCE.md`
- `docs/MCP-TOOLS.md`
- `tests/phase-discovery-research.test.ts`
- `tests/agent-contract-specialists.test.ts`

Add this source-policy block to the runtime contract:

```md
## External Source Decision

Read `blueprint_config_get` with `scope: "effective"` before any official-doc,
package-registry, security-advisory, release-note, remote-code-search, or other
external verification step. Treat `workflowPosture.research.externalSources`
as a mirror only.

- `off`: no live external lookup. Use repo evidence, saved Blueprint artifacts,
  and explicitly supplied excerpts only. Do not write "latest", "current
  official docs confirm", or equivalent live-verification language. Mark
  freshness-sensitive external claims unchecked and lower confidence.
- `ask`: stop for one user decision before gathering live external evidence.
  Outcomes are `accept`, `decline`, and `cancel`.
- `auto`: the parent may gather bounded external evidence only when repo
  evidence cannot settle a planner-critical claim. `auto` is not general web
  browsing.
```

Add this `ask` prompt text:

```text
This research strand needs external verification because <reason>.
Allowed source classes: <official docs / standards / package registry /
security advisory / release notes / supplied URLs>.

I will not mutate source files, installed extensions, host-global Blueprint
state, credentials, packages, or external services.

Choose:
- accept: gather the named external evidence and cite it
- decline: continue repo-only and mark affected claims unchecked
- cancel: stop and preserve a research checkpoint
```

Add a parent-gathered evidence packet contract:

```ts
type ResearchEvidencePacket = {
  packetId: string;
  strandId: string;
  externalSourcesMode: "off" | "ask" | "auto";
  userDecision: "not_required" | "accepted" | "declined" | "cancelled" | "not_applicable";
  gatheredBy: "parent" | "user";
  gatheredAt: string | null;
  allowedSourceClasses: string[];
  declinedSourceClasses: string[];
  sources: Array<{
    sourceId: string;
    lane: "repo" | "blueprint" | "external" | "supplied" | "inference";
    class: string;
    citation: string;
    title: string;
    accessDate: string | null;
    observedVersionOrDate: string | null;
    excerptOrSummary: string;
    limitations: string[];
  }>;
  claims: Array<{
    claimId: string;
    claim: string;
    sourceIds: string[];
    supportStatus: "supports" | "partial" | "conflicts" | "not_enough_evidence" | "unchecked";
    confidence: "LOW" | "MEDIUM" | "HIGH";
    placement: string;
    nonRepoClaim: boolean;
  }>;
  unresolved: Array<{
    question: string;
    neededSourceClass: string;
    reason: string;
  }>;
};
```

Add these hard wording rules:

- Official or external claims require a source ID, access date, support status, and excerpt or summary.
- Remote code search is a discovery hint only until local repo evidence confirms it.
- User-supplied URLs are `supplied` unless fetched under an allowed mode.
- Inference can support a recommendation only when clearly labeled and tied to concrete sources.
- `off` or declined `ask` forbids live-verification language.

Tests:

- Text parity assertions for `accept|decline|cancel`.
- Text parity assertions that the parent gathers packets and `blueprint-researcher` must not fetch external evidence.
- A valid repo-only research fixture remains valid with mode `off`.
- Warning fixture: external URL without access date.
- Warning fixture: "latest official docs confirm" without an external source row.
- Agent contract fixture: unsupported external comparison returns `needs-parent-evidence` or an unverified warning.

#### Wave 4. `blueprint-researcher` Sidecar Packet Contract

Purpose: make sidecar output auditable and stop full-artifact ownership drift.

Files:

- `agents/blueprint-researcher.md`
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- `skills/blueprint-phase-discovery/SKILL.md`
- `commands/blu-research-phase.toml`
- `docs/commands/research-phase.md`
- `src/mcp/command-runtime-metadata.ts`
- `tests/agent-contract-specialists.test.ts`
- `tests/phase-discovery-research.test.ts`

Default mode should be `strand-findings`.

Add this packet to `agents/blueprint-researcher.md`:

```ts
type ResearchSidecarInputV1 = {
  packetVersion: "research-sidecar.v1";
  parentCommand: "/blu-research-phase" | "/blu-discuss-phase" | "/blu-list-phase-assumptions";
  mode: "strand-findings" | "section-draft" | "full-artifact-draft" | "gray-area-memo";
  phase: {
    number: number;
    name: string;
    goal: string;
    successCriteria: string[];
    requirementIds: string[];
  };
  strand: {
    id: string;
    question: string;
    allowedSourceClasses: Array<"repo" | "locked-blueprint-doc" | "parent-supplied-external" | "inference">;
    repoAnchors: string[];
    expectedOutput: "claims-packet" | "named-section-markdown" | "complete-research-body" | "memo";
    maxReadScope?: string;
    completionCriteria: string[];
  };
  context: {
    contextPath: string;
    contextContent: string;
    existingResearchPath?: string;
    existingResearchContent?: string;
    codebaseSummaryPaths?: string[];
  };
  contract?: {
    artifactId: "phase.research";
    authoringTemplate?: string;
    requiredHeadings?: string[];
    targetHeadings?: string[];
  };
  repoEvidencePacket?: Array<{
    sourceId: string;
    path: string;
    role: "contract" | "runtime" | "test" | "doc" | "config" | "example" | "unknown";
    excerpt?: string;
    locator?: string;
  }>;
  externalEvidencePacket?: Array<{
    sourceId: string;
    title: string;
    url: string;
    accessedAt: string;
    evidenceClass: "official-reference" | "supplied-reference";
    excerpt: string;
    claim: string;
    suppliedBy: "parent" | "user";
  }>;
  forbiddenActions: Array<
    "fetch-external-sources" |
    "write-files" |
    "mutate-blueprint-state" |
    "ask-user" |
    "route-command" |
    "expand-phase-scope"
  >;
};
```

Add this output packet:

```ts
type ResearchSidecarPacketV1 = {
  packetVersion: "research-sidecar.v1";
  status: "answered" | "partial" | "blocked" | "needs-parent-evidence";
  mode: ResearchSidecarInputV1["mode"];
  strandId: string;
  conciseAnswer: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  claims: Array<{
    claimId: string;
    text: string;
    support: "supported" | "partially-supported" | "conflict" | "unverified" | "inference";
    confidence: "LOW" | "MEDIUM" | "HIGH";
    sourceIds: string[];
    plannerImpact: string;
  }>;
  repoSources: Array<{
    sourceId: string;
    path: string;
    role: "contract" | "runtime" | "test" | "doc" | "config" | "example" | "unknown";
    locator?: string;
    whyItMatters: string;
  }>;
  externalSources: Array<{
    sourceId: string;
    title: string;
    url: string;
    accessedAt: string;
    evidenceClass: "official-reference" | "supplied-reference";
    suppliedBy: "parent" | "user";
    whyItMatters: string;
  }>;
  failedSearches: Array<{
    queryOrPath: string;
    scope: string;
    result: "no-hit" | "too-broad" | "unreadable" | "not-allowed";
    impact: string;
  }>;
  draftSections?: Array<{
    heading: string;
    markdown: string;
    sourceIds: string[];
  }>;
  fullArtifactDraft?: {
    markdown: string;
    sourceIds: string[];
    useOnlyWhenParentRequestedFullArtifactMode: true;
  };
  warnings: Array<{
    code:
      | "external-evidence-missing"
      | "repo-evidence-thin"
      | "conflicting-sources"
      | "scope-limit-reached"
      | "inference-used"
      | "mode-limit";
    severity: "info" | "warning" | "blocker";
    message: string;
    requiredParentAction?: string;
  }>;
  followUps: Array<{
    owner: "parent" | "user" | "plan-phase";
    action: string;
    reason: string;
  }>;
};
```

Mode rules:

- `strand-findings`: default; no final artifact prose.
- `section-draft`: allowed only when parent names target headings.
- `full-artifact-draft`: exceptional; parent must pass full template and accepted evidence.
- `gray-area-memo`: not a `phase.research` draft.

Tests:

- `tests/agent-contract-specialists.test.ts` asserts packet type names, modes, failed searches, warnings, `needs-parent-evidence`, parent-owned synthesis, and no external fetching.
- `tests/phase-discovery-research.test.ts` asserts command/runtime/docs mention structured sidecar packets and default `strand-findings`.
- Negative text assertion: no unqualified "ask the agent for populated research content" remains.

#### Wave 5. Strand Ledger And Checkpoint Semantics

Purpose: make long-running research resumable without transcript replay.

Files:

- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- `skills/blueprint-phase-discovery/SKILL.md`
- `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`
- `docs/commands/research-phase.md`
- `docs/MCP-TOOLS.md`
- `docs/RUNTIME-REFERENCE.md`
- `src/mcp/command-runtime-metadata.ts`
- `tests/phase-discovery-tools.test.ts`
- `tests/phase-discovery-research.test.ts`

Add strand taxonomy:

```text
context-lock
repo-map
stack-and-dependencies
architecture-integration
validation-and-tests
risks-and-pitfalls
external-delta
planner-handoff
```

Add checkpoint timing rules:

- After accepting/resuming a checkpoint if the parent changes active strand.
- Before launching sidecar work.
- After each accepted/rejected sidecar packet.
- After each completed parent-only strand when remaining work matters.
- Before waiting on `research.external_sources=ask`.
- On source-policy decline, tool failure, budget limit, timeout, contradictory evidence, or blocked strand.
- Before validation repair retry.
- After repeated validation failure.
- Before stopping after state-sync or route-refresh failure.
- Delete only after final research write, state sync, state reload, and implemented-command routing receipt succeed.

Nested checkpoint payload, keeping existing generic fields:

```json
{
  "ownerCommand": "/blu-research-phase",
  "completedAreas": ["S1 context-lock"],
  "remainingAreas": ["S2 repo-map"],
  "decisions": [],
  "deferredIdeas": [],
  "canonicalReferences": [],
  "resumeMeta": {
    "mode": "research",
    "pendingTopics": ["S2 repo-map"],
    "completedTopics": ["S1 context-lock"],
    "currentQuestion": "Which repo surfaces constrain this phase?",
    "notes": [],
    "resumeHint": "Resume at S2.",
    "updatedAt": "2026-05-12T00:00:00.000Z"
  },
  "researchLedger": {
    "schemaVersion": "research-ledger/v1",
    "phase": {
      "number": "3",
      "prefix": "03",
      "name": "Phase Discovery",
      "dir": ".blueprint/phases/03-phase-discovery"
    },
    "runtime": {
      "ownerCommand": "/blu-research-phase",
      "artifactId": "phase.research",
      "externalSources": {
        "effective": "ask",
        "decision": "pending",
        "reason": "Repo evidence cannot settle upstream behavior."
      }
    },
    "strands": [
      {
        "id": "S1",
        "type": "context-lock",
        "question": "What saved context decisions constrain this research?",
        "requirementIds": ["REQ-001"],
        "repoAnchors": [".blueprint/phases/03-example/03-CONTEXT.md"],
        "sourcePolicy": "repo-only",
        "dependencies": [],
        "status": "complete",
        "evidenceIds": ["SRC-001"],
        "acceptedClaims": ["Context requires MCP-owned persistence."],
        "rejectedOrLowQualitySources": [],
        "searchNotes": [],
        "uncertainty": "none",
        "stoppingReason": "evidence-sufficient",
        "nextAction": "feed planner-handoff"
      }
    ],
    "sidecars": [],
    "draftState": {
      "hasDraft": false,
      "sectionsTouched": [],
      "validationAttempted": false,
      "validationIssues": [],
      "finalWriteAttempted": false,
      "lastKnownPath": null
    },
    "nextAction": {
      "stage": "Execute",
      "pendingGate": "none",
      "safeCommand": "/blu-research-phase 3"
    }
  }
}
```

Initial code should not require this schema. It can ride through the current catchall checkpoint shape. Add stricter schema later only after compatibility tests.

Progress recap format:

```text
Stage: Execute | Scope: Phase 3 Phase Discovery | Mode: parent-only |
Completed: S1 context-lock, S2 repo-map | Active: S3 stack-and-dependencies |
Pending gate: external-source confirmation | Next safe action: checkpoint or
resume /blu-research-phase 3
```

Tests:

- Round-trip a checkpoint with `researchLedger` through put/get.
- Assert guarded delete still protects foreign owners and modes.
- Assert runtime docs mention resume-by-default, guarded discard, and no transcript checkpoints.
- If a schema is later added, test legacy checkpoint compatibility and size limits.

#### Wave 6. Artifact Template, Source Register, Claim Support, And Plan Input Queue

Purpose: make `XX-RESEARCH.md` useful as direct `/blu-plan-phase` input.

Files:

- `src/mcp/artifact-contracts/index.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/phase.ts`
- `docs/ARTIFACT-SCHEMA.md`
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- `tests/phase-discovery-research.test.ts`
- `tests/artifact-contracts.test.ts` if present; otherwise add to existing contract tests

Do not change required top-level headings in the first pass.

Replace the weak placeholders in `renderResearchTemplate(...)` with richer tables.

`## Phase Requirements`:

```markdown
| Requirement ID | Research Topic | Recommendation IDs | Plan Implication | Blocking Unknowns | Evidence IDs |
|----------------|----------------|--------------------|------------------|-------------------|--------------|
| <requirement-id> | <topic or decision area> | REC-001 | <what the plan should do or avoid> | <none or OQ-001> | SRC-001, CLM-001 |
```

`## Recommendations`:

```markdown
| Rec ID | Disposition | Covers Requirements | Recommended Approach | Read First | Target Surfaces | Evidence IDs | Acceptance Signals | Tests / Checks | Dependencies | Risks / Mitigations | Confidence | Blocking Unknowns |
|--------|-------------|---------------------|----------------------|------------|-----------------|--------------|--------------------|----------------|--------------|---------------------|------------|-------------------|
| REC-001 | plan_now | <requirement ids> | <planner-ready implementation direction> | <repo paths/docs> | <files, modules, commands, APIs, schemas> | SRC-001, CLM-001 | <observable target state> | <test, grep, file-read, or command checks> | <none or REC-000> | <risk and mitigation> | LOW|MEDIUM|HIGH | <none or OQ-001> |
```

`## Sources`:

```markdown
### External Source Decision

- Mode: off|ask|auto
- User decision: not_required|accepted|declined|cancelled|not_applicable
- Live external checks performed: yes|no
- Source classes allowed: <classes>
- Source classes declined or unavailable: <classes or none>

### Source Register

| Source ID | Source Class | Path / URL | Role | Accessed / Version | Supports Claims | Limitations |
|-----------|--------------|------------|------|--------------------|-----------------|-------------|
| SRC-001 | repo_code | src/example.ts | runtime | local worktree | CLM-001 | line numbers may drift |

### Claim Support

| Claim ID | Claim | Support | Source IDs | Placement | Confidence |
|----------|-------|---------|------------|-----------|------------|
| CLM-001 | <repo claim> | supports | SRC-001 | REC-001 | HIGH |
```

Optional `## Claim Support Table` may be allowed by freehand policy; if added, keep `## Sources` as the canonical source-register location.

Add warning-first parsing helpers:

```ts
function collectResearchSourceRegister(content: string): ResearchSourceRegister {
  const sources = extractMarkdownSection(content, "Sources");
  return parseResearchMarkdownTable(sources, [
    "Source ID",
    "Source Class",
    "Path / URL",
    "Role",
    "Accessed / Version",
    "Supports Claims",
    "Limitations",
  ]);
}

function collectResearchPlanInputRows(content: string): ResearchPlanInputRow[] {
  const recommendations = extractMarkdownSection(content, "Recommendations");
  return parseResearchMarkdownTable(recommendations, [
    "Rec ID",
    "Disposition",
    "Covers Requirements",
    "Recommended Approach",
    "Read First",
    "Target Surfaces",
    "Evidence IDs",
    "Acceptance Signals",
    "Tests / Checks",
    "Dependencies",
    "Risks / Mitigations",
    "Confidence",
    "Blocking Unknowns",
  ]);
}
```

Add warning diagnostics:

- `research.source_register_missing_ids`
- `research.external_source_missing_access_date`
- `research.claim_missing_source`
- `research.claim_unsupported_plan_now`
- `research.recommendation_missing_plan_fields`
- `research.high_confidence_with_blocker`
- `research.repo_runtime_without_repo_source`

Suggested staged strictness:

1. Warning only: all new table/claim/source diagnostics.
2. Strict: scaffold placeholders in new tables, missing recommendation `Tests / Checks` for `plan_now`, missing source IDs in table rows.
3. Strict later: external source access dates for external classes, repo-runtime claims without repo sources, high confidence with blockers.
4. Never purely deterministic: semantic citation support precision; keep that for advisory review.

Tests:

- Template includes Plan Input Queue, Source Register, Claim Support, and richer Confidence Breakdown headers.
- Required headings remain unchanged.
- A table-rich valid research fixture passes.
- Old valid repo-only fixture still passes.
- Warning fixtures cover each new diagnostic.
- Existing "generic code span as source evidence" rejection still works.

#### Wave 7. Plan-Phase Handoff

Purpose: make `/blu-plan-phase` use the research queue when present.

Files:

- `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md`
- `skills/blueprint-phase-planning/SKILL.md`
- `docs/commands/plan-phase.md`
- `tests/plan-phase-metadata.test.ts`
- `tests/phase-planning-tools.test.ts`

Add mapping rules:

```md
When saved `XX-RESEARCH.md` contains a Plan Input Queue under
`## Recommendations`, `/blu-plan-phase` treats it as the primary planning queue.

- `Disposition=plan_now` rows become candidate plan tasks.
- `Covers Requirements` maps to `requirements` and `requirementCoverage`.
- `Read First` maps to top-level and task `readFirst`.
- `Target Surfaces` maps to `filesModified` and file-surface coverage.
- `Acceptance Signals` plus `Tests / Checks` maps to task
  `acceptanceCriteria` and `verification`.
- `Evidence IDs` plus the saved research artifact path maps to
  `evidenceCoverage`.
- `Blocking Unknowns`, `Disposition=block`, and insufficient evidence rows map
  to `unknownsAndDeferrals` or stop planning before write when they block a safe
  plan.
- `Disposition=defer` rows stay out of current tasks unless the user explicitly
  expands scope.
- `Disposition=reject` rows should be preserved as avoided alternatives, not
  converted into tasks.
```

Keep this prompt-level first. Do not add a new MCP digest tool unless table parsing in the plan command becomes repetitive or brittle.

Tests:

- Text tests require the mapping terms in planning skill/doc/runtime.
- Seed table-rich research and assert `blueprint_phase_plan_authoring_context.knownEvidenceArtifacts` still includes the research artifact path.
- Add a metadata test that planning should route back to `/blu-research-phase` instead of browsing live docs when queue rows are blocked by missing external evidence.

#### Wave 8. Runtime Metadata, Dist, And Verification

Purpose: keep shipped runtime and docs aligned.

Files:

- `src/mcp/command-runtime-metadata.ts`
- `docs/RUNTIME-REFERENCE.md`
- `docs/MCP-TOOLS.md`
- `docs/ARTIFACT-SCHEMA.md`
- `dist/`
- Tests named above

Verification sequence in a fresh worktree:

```bash
npm ci
npx tsx --test tests/phase-discovery-research.test.ts tests/mcp-contract-audit-metadata.test.ts tests/command-catalog.test.ts
npx tsx --test tests/phase-discovery-tools.test.ts tests/plan-phase-metadata.test.ts tests/phase-planning-tools.test.ts
npm run typecheck
npm run build
git status --short
```

If runtime-affecting code changes are made, include tracked `dist/` changes. Gemini launches `dist/mcp/server.js`; source-only changes can leave the installed/runtime behavior stale.

Do not use `npm test -- <file>` as the focused shortcut here. Prefer `npx tsx --test <files>` for targeted loops.

### Implementation Checklist By File

#### `commands/blu-research-phase.toml`

- Add selected-phase pinning.
- Add parent-owned strand ledger sentence.
- Add sidecar packet sentence.
- Keep full details out of the manifest.
- Keep MCP tool allowlist unchanged unless a new deterministic tool is actually added.

#### `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`

Add or update sections:

- Research Readiness Versus Planning Readiness
- Selected Phase Pinning
- External Source Decision
- Research Evidence Packet
- Research Strand Ledger
- Checkpoint Timing
- Resume, Discard, And Default Behavior
- Sidecar Packet Contract
- Parent-Owned Synthesis
- Source Register And Claim Support
- Plan Input Queue Output Quality

This file should be the fullest behavior authority.

#### `skills/blueprint-phase-discovery/SKILL.md`

- Keep the MCP allowlist exact.
- Reference the runtime contract's readiness, evidence packet, strand ledger, and sidecar packet rules.
- Avoid duplicating large tables.

#### `agents/blueprint-researcher.md`

- Replace prose-first outputs with `ResearchSidecarInputV1` and `ResearchSidecarPacketV1`.
- Default to `strand-findings`.
- Make `full-artifact-draft` exceptional.
- Preserve read-only tools.
- Preserve no external fetching.
- Require failed searches and warnings in output packets.

#### `src/mcp/tools/phase.ts`

- Add `researchReadiness` to `blueprintPhaseResearchStatus`.
- Harden `blueprintPhaseArtifactRead` read failures.
- Consider additive `scopeResolution` if omitted-phase ambiguity is locally available.
- Preserve `planningReadiness`.

#### `src/mcp/artifact-contracts/index.ts`

- Enrich `renderResearchTemplate`.
- Keep `requiredHeadings` stable initially.
- Add placeholder signals for new table placeholders.
- Update `phase.research.notes`.

#### `src/mcp/tools/artifacts.ts`

- Add table parsing helpers.
- Add warning diagnostics for source register, claim support, Plan Input Queue, access dates, confidence contradictions, and unsupported repo-runtime claims.
- Keep old valid artifacts passing in the first implementation slice.

#### `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md`

- Add Plan Input Queue mapping rules.
- Preserve the no-live-docs-during-planning rule.
- Route back to `/blu-research-phase` when research rows say evidence is blocked.

#### `docs/*`

- `docs/commands/research-phase.md`: user-facing behavior and gates.
- `docs/commands/plan-phase.md`: Plan Input Queue consumption.
- `docs/MCP-TOOLS.md`: returned fields, checkpoint notes, and tool contracts.
- `docs/ARTIFACT-SCHEMA.md`: research artifact shape.
- `docs/RUNTIME-REFERENCE.md`: concise runtime row.

#### Tests

Primary:

- `tests/phase-discovery-research.test.ts`
- `tests/phase-discovery-tools.test.ts`
- `tests/mcp-contract-audit-metadata.test.ts`
- `tests/command-catalog.test.ts`
- `tests/plan-phase-metadata.test.ts`
- `tests/phase-planning-tools.test.ts`
- `tests/agent-contract-specialists.test.ts`

Add tests before or with each implementation slice; do not rely on manual doc review for contract-critical behavior.

### Rollout Risks And Guards

- Backward compatibility: keep new validation warnings first.
- Artifact bloat: require IDs and table rows for planner-critical claims and recommendations, not every sentence.
- Source precision: deterministic checks prove structure, not semantic truth; avoid claiming otherwise.
- External drift: require access dates and confidence lowering when external evidence is disabled, declined, stale, or supplied-only.
- Sidecar ownership drift: keep tests that prevent subagents from fetching, writing, checkpointing, syncing, or routing.
- Checkpoint size: checkpoint packets, not transcripts; respect existing checkpoint JSON size limits.
- Docs drift: update runtime metadata first, then mirror concise docs, then rebuild `dist/` when runtime code/assets change.
- Routing safety: final next action must still come from refreshed MCP state and runtime-implemented command catalog.

### Recommended First Implementation PR

The safest first PR should be small:

1. Add `researchReadiness` and artifact-read failure hardening.
2. Add contract/docs text for selected-phase pinning and research readiness.
3. Add parity tests and read-failure tests.
4. Do not change `phase.research` template or validation yet.
5. Rebuild if runtime source changes.

The second PR should add evidence packets and sidecar packet contracts.

The third PR should update the artifact template and warning diagnostics.

The fourth PR should teach `/blu-plan-phase` to consume the Plan Input Queue.

This ordering keeps the highest-risk template/validation changes behind the lower-risk readiness and contract hardening.
<!-- PLAN:END -->
