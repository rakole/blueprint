# R3 Plan: Tool And Dependency Selection For `/blu-research-phase`

**Status:** approval draft
**Scope:** R3 only from `docs/imp/research/research-phase-frontier-research-and-improvement-plan.md`
**Planner:** Codex
**Created:** 2026-05-12

## Source Grounding

Read before writing this plan:

- `docs/imp/research/research-phase-frontier-research-and-improvement-plan.md`
- `commands/blu-research-phase.toml`
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- `skills/blueprint-phase-discovery/SKILL.md`
- `agents/blueprint-project-researcher.md`
- `agents/blueprint-researcher.md`

Extra repo surfaces inspected because R3 changes the research artifact shape, validation guidance, metadata, docs, and tests:

- `src/mcp/artifact-contracts/index.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/command-runtime-metadata.ts`
- `docs/commands/research-phase.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/RUNTIME-REFERENCE.md`
- `tests/phase-discovery-research.test.ts`
- `tests/artifact-contracts.test.ts`
- `tests/mcp-contract-audit-metadata.test.ts`
- `tests/agent-contract-specialists.test.ts`

## R3 Interpretation

R3 is the `Tool And Dependency Selection Research` section, not the I3 checkpoint section.

The R3 behavior to add is:

- Treat package, CLI, framework, service, code-generation, library, and tooling choices as a first-class research lane when they affect a phase.
- Before recommending a new dependency or tool, require the research artifact to consider:
  - no new dependency
  - existing dependency
  - standard library or platform API
  - candidate package/tool
- Record supply-chain evidence for the exact candidate/version where the run can obtain it:
  - official source or repo evidence
  - package ecosystem and install scope
  - current/wanted/latest or version evidence
  - maintenance signal
  - vulnerability signal
  - license
  - provenance/signature signal
  - transitive footprint
  - update posture
  - residual risk and mitigation
- Preserve the current `research.external_sources=off|ask|auto` boundary. R3 must not make live package registry, audit, OSV, SLSA, Scorecard, GitHub, or npm access mandatory.
- Warn, do not hard-fail, when dependency/tool recommendations lack R3 evaluation in the first implementation.

## Scope Locks

Do not implement anything outside R3.

Do not change:

- command status, command catalog semantics, root routing, help routing, progress routing, or next routing
- the MCP required tool list for `research-phase`
- `research.external_sources` enum values or defaults
- `phase.research.requiredHeadings`
- `phase.research.freehandPolicy`
- `blueprint-researcher` tool allowlist
- `blueprint-project-researcher.md`
- project dependencies in `package.json`
- installed extension directories or host-global `~/.gemini/blueprint/`

R1 and R2 are already present in current `main`. Preserve their investigation trace, repository evidence ladder, scoped-search, remote-code-search-hint, source-role, and bounded sidecar behavior.

## High-Level Implementation Shape

Implement R3 as one focused runtime-contract/template/validation/test PR:

1. Add R3 guidance to the command manifest, research runtime contract, shared discovery skill, researcher agent, runtime metadata, and docs.
2. Enrich the `phase.research` authoring template with dependency/tool evaluation tables under existing required headings.
3. Add warning-only validation diagnostics for dependency/tool recommendations that omit R3 evidence.
4. Extend parity and artifact tests.
5. Rebuild `dist/` because `src/mcp/artifact-contracts/index.ts`, `src/mcp/tools/artifacts.ts`, and `src/mcp/command-runtime-metadata.ts` are runtime-affecting.

## File Change Matrix

| File | Action | Why |
|------|--------|-----|
| `commands/blu-research-phase.toml` | Add one thin command-local R3 gate | Keep manifest concise but make dependency/tool evaluation visible |
| `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md` | Add full R3 behavior section and quality criteria | This is the rich behavior authority |
| `skills/blueprint-phase-discovery/SKILL.md` | Add concise R3 references in `/blu-research-phase` workflow rules | Keep shared skill aligned without duplicating the full spec |
| `agents/blueprint-researcher.md` | Add sidecar expectations for dependency/tool evidence | Sidecars must return bounded evidence, not broad package advice |
| `agents/blueprint-project-researcher.md` | No change | Bootstrap/new-project specialist is outside research-phase R3 scope |
| `src/mcp/artifact-contracts/index.ts` | Enrich `renderResearchTemplate`, placeholder signals, and notes | Make R3 tables part of the canonical authoring template |
| `src/mcp/tools/artifacts.ts` | Add warning-only R3 validation helpers | Keep compatibility while nudging planner-grade evidence |
| `src/mcp/command-runtime-metadata.ts` | Add concise R3 terms to `contractNotes` | Keep runtime contract resources source-owned |
| `docs/commands/research-phase.md` | Add user-facing R3 behavior and test case bullets | Keep command docs aligned |
| `docs/ARTIFACT-SCHEMA.md` | Mirror canonical template shape | Keep artifact docs aligned with runtime template |
| `docs/MCP-TOOLS.md` | Add concise R3 runtime note | Keep MCP tool docs aligned |
| `docs/RUNTIME-REFERENCE.md` | Add concise R3 runtime row language | Keep public runtime reference aligned |
| `tests/phase-discovery-research.test.ts` | Add parity, scaffold, valid fixture, and warning fixture assertions | Primary R3 regression guard |
| `tests/artifact-contracts.test.ts` | Add template and validation coverage | Registry-level guard |
| `tests/mcp-contract-audit-metadata.test.ts` | Add cross-surface R3 parity assertions | Prevent docs/runtime drift |
| `tests/agent-contract-specialists.test.ts` | Add `blueprint-researcher` R3 assertions | Prevent sidecar package-advice drift |

## Exact Change Plan

### 1. `commands/blu-research-phase.toml`

In `Command-local gates`, add this bullet immediately after the existing bullet that closes each non-trivial topic strand with a planning handoff:

```text
- When a strand recommends adding, adopting, replacing, or hand-rolling a package, library, CLI, framework, service, code generator, package-manager behavior, or other tool, record a dependency/tool evaluation: no-new-dependency, existing dependency, and standard-library/platform alternatives; exact candidate identity and version evidence; maintenance, vulnerability, license, provenance/signature, transitive-footprint, install-scope, lockfile, update-posture, residual-risk, and verification signals. Keep unavailable live upstream evidence explicit under the current `research.external_sources` policy instead of treating missing data as approval.
```

Do not add the full table schema to the command manifest. The manifest stays thin.

### 2. `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`

Add this bullet to `Parity Target` after the current bullet about per-strand planning handoff:

```md
- dependency/tool decisions treated as first-class research when a phase may add, adopt, replace, or hand-roll a package, library, CLI, framework, service, code generator, package-manager behavior, or other tool
```

Add this bullet to `Shared Stage Mapping` under `Execute`, replacing only the current `Execute` bullet with the version below:

```md
- `Execute`: build the initial assessment, follow the repository evidence
  ladder, record per-strand search notes and navigation evidence, research one
  topic strand at a time, evaluate dependency/tool choices when they affect a
  recommendation, close each strand with a planning handoff, and keep evidence
  provenance visible.
```

Add this new section after `## Investigation Trace And Navigation Evidence` and before `## Capability-Gated Subagent Path`:

````md
## Tool And Dependency Selection

Treat dependency/tool choice as a first-class research strand whenever the phase
may add, adopt, replace, upgrade, globally install, locally install, vendor,
fork, code-generate, or hand-roll any package, library, CLI, framework, service,
package-manager behavior, parser, protocol client, security-sensitive helper,
or other implementation tool.

The default answer is not "add a package." First evaluate:

1. no new dependency
2. existing repo dependency
3. standard library or platform API
4. candidate package, CLI, service, framework, or code generator
5. custom implementation

Record the result in the existing research artifact headings instead of adding a
new top-level required heading:

- `## Standard Stack`: dependency/tool evaluation table for current and
  candidate stack choices.
- `## Installation And Setup`: reproducible setup, manifest and lockfile
  impact, install scope, side effects, verification, and update posture.
- `## Alternatives Considered`: no-new-dependency, existing dependency,
  standard-library/platform, candidate, and custom alternatives.
- `## Don't Hand-Roll`: library-versus-custom decision rule for standardized,
  security-sensitive, adversarial, protocol, parser, package/version,
  vulnerability/license/provenance, AST/indexing, or edge-case-heavy behavior.
- `## Recommendations`: cite the dependency/tool evaluation row when a
  recommendation adds, adopts, rejects, defers, upgrades, or hand-rolls a tool.
- `## Sources`: cite repo, official, supplied, or unchecked evidence for each
  planner-critical dependency/tool claim.

Use this `## Standard Stack` table shape when a dependency/tool decision exists:

```md
### Dependency / Tool Evaluation

| Decision ID | Need | Candidate | Decision | Official Source Or Repo Evidence | Package Ecosystem | Install Scope | Current / Wanted / Latest Evidence | Maintenance Signal | Vulnerability Signal | License | Provenance / Signature Signal | Transitive Footprint | Existing / Standard-Library Alternative | Update Posture | Residual Risk And Mitigation |
|-------------|------|-----------|----------|----------------------------------|-------------------|---------------|------------------------------------|--------------------|----------------------|---------|-------------------------------|---------------------|------------------------------------------|----------------|-------------------------------|
| DEP-001 | <capability needed> | <package, tool, repo helper, platform API, or custom> | already_in_repo|use_existing|add_candidate|defer|reject|custom | <repo path, official URL, supplied source, or unchecked> | <npm, stdlib, platform, repo-local, service, or none> | runtime|dev|global|none | <current/wanted/latest, observed version, or unchecked> | <release/maintainer/CI/security-policy signal or unchecked> | <audit/OSV/advisory result or unchecked> | <SPDX/license signal or unchecked> | <provenance/SLSA/signature/scope identity signal or unchecked> | <none, small, moderate, large, or unchecked> | <no-new-dependency, existing dependency, standard library, or platform API option> | <Dependabot/Renovate/audit/OSV/release-note/changelog/manual review posture> | <risk and mitigation> |
```

Use this `## Installation And Setup` table shape when setup changes:

```md
### Setup And Update Posture

| Decision ID | Manifest / Lockfile Impact | Install Command Or Path | Install Scope | Side Effects | Verification Command | Update / Monitoring Plan | Manual Review Required |
|-------------|----------------------------|-------------------------|---------------|--------------|----------------------|--------------------------|------------------------|
| DEP-001 | <package.json/package-lock or none> | <repo-local command/path or none> | runtime|dev|global|none | <transitive deps, lifecycle scripts, native binaries, peers, engines, or none> | <test/build/check or manual verification> | <Dependabot/Renovate/dependency review/OSV/npm audit/release notes/changelog/manual> | yes|no - <reason> |
```

Use this `## Alternatives Considered` table shape when a dependency/tool decision
exists:

```md
### Dependency Alternatives

| Decision ID | Need | No New Dependency | Existing Dependency | Standard Library / Platform API | Candidate Package / Tool | Custom Implementation | Decision | Rationale |
|-------------|------|-------------------|---------------------|---------------------------------|--------------------------|----------------------|----------|-----------|
| DEP-001 | <capability needed> | <viable/rejected and why> | <viable/rejected and why> | <viable/rejected and why> | <candidate and evidence> | <allowed/rejected and tests needed> | use_existing|add_candidate|defer|reject|custom | <actionable rationale> |
```

Use this `## Don't Hand-Roll` table shape when custom code is recommended or a
library should be preferred:

```md
### Library Vs Custom Decision

| Decision ID | Capability | Domain Risk | Proven Library / Existing Option | Custom Path Allowed? | Rationale | Required Tests / Validation | Maintenance / Update Owner |
|-------------|------------|-------------|----------------------------------|----------------------|-----------|-----------------------------|----------------------------|
| DEP-001 | <capability> | security-sensitive|standardized|protocol|parser|package-resolution|low-risk-project-specific | <option or none> | yes|no | <why package/library/custom is safer> | <tests/checks required> | <owner or update path> |
```

Selection rules:

- A new package/tool recommendation should not be `HIGH` confidence unless the
  research artifact records version, maintenance, vulnerability, license,
  provenance/signature, transitive-footprint, install-scope, update-posture, and
  residual-risk evidence or explicitly explains which signals are unavailable.
- `latest` is not the same as `wanted` for npm-style package managers. When
  version freshness matters, record observed `current`, `wanted`, and `latest`
  evidence when available, and mark the nuance as unchecked when external
  package metadata was not gathered.
- Treat package identity as evidence: project website, registry package,
  repository, namespace/scope, official docs, and package provenance should
  point to the same artifact lineage before the package is recommended.
- Missing maintenance, vulnerability, license, provenance, or transitive data is
  uncertainty, not approval.
- Do not present `npm audit fix`, OSV guided remediation, dependency-update PRs,
  or package-manager install side effects as automatically safe. Recommend
  manifest and lockfile review, release-note or changelog review, focused tests,
  and human review for risky major updates or remediation.
- Avoid global installs for project runtime dependencies when a repo-local
  runtime or dev dependency works. If a global install is recommended, justify it
  from official or supplied evidence and record the install/update risk.
- Avoid vendoring, copying snippets, or forking as a casual compromise. If
  unavoidable, record source/version provenance, license retention,
  vulnerability-monitoring ownership, and an update plan.

Hand-rolling is allowed only when the capability is narrow, project-specific,
easy to test exhaustively, not security-sensitive, not a standards
implementation, and smaller than the dependency risk it avoids. The artifact
must name the tests or validation that make the custom path safe.
````

Add these bullets to `Artifact Authoring Rules`:

```md
- `## Standard Stack` includes a `Dependency / Tool Evaluation` table when the
  research recommends adding, adopting, replacing, upgrading, globally
  installing, locally installing, vendoring, forking, code-generating, or
  hand-rolling a package, library, CLI, framework, service, or tool.
- `## Installation And Setup` names manifest and lockfile impact, install scope,
  side effects, verification commands, and update posture when a dependency/tool
  decision affects setup.
- `## Alternatives Considered` compares no-new-dependency, existing dependency,
  standard-library/platform API, candidate package/tool, and custom
  implementation before recommending a new dependency/tool.
- `## Don't Hand-Roll` explains library-versus-custom reasoning for standardized,
  security-sensitive, adversarial, parser, protocol, package/version,
  vulnerability/license/provenance, AST/indexing, or edge-case-heavy behavior.
```

Add this paragraph to `Capability-Gated Subagent Path`, after the bullet list of what to pass the agent:

```md
For dependency/tool strands, pass the exact bounded need and ask for a
dependency/tool evidence packet, not a broad package recommendation. The packet
must compare no-new-dependency, existing dependency, standard-library/platform,
candidate package/tool, and custom options, and must label unavailable version,
maintenance, vulnerability, license, provenance, transitive, install, lockfile,
and update-posture evidence under the current external-source policy.
```

Add these bullets to `Output Quality Criteria`:

```md
- dependency/tool recommendations include a decision row that compares
  no-new-dependency, existing dependency, standard-library/platform, candidate,
  and custom options
- supply-chain evidence for accepted package/tool choices records version,
  maintenance, vulnerability, license, provenance/signature, transitive
  footprint, install scope, lockfile impact, update posture, residual risk, and
  verification signals, or explicitly marks unavailable signals as unchecked
- custom-code recommendations in areas with mature packages include a
  library-versus-custom rationale and named tests/validation that make the custom
  path safe
```

### 3. `skills/blueprint-phase-discovery/SKILL.md`

In the `/blu-research-phase` workflow rules, update rule 6 by appending this sentence:

```md
When a strand touches package, dependency, CLI, framework, service, code-generation, install/update, or hand-rolled tooling choices, use the runtime contract's dependency/tool evaluation lane before turning it into a recommendation.
```

In rule 7, after "expected handoff fields", append this sentence:

```md
For dependency/tool strands, require the sidecar to compare no-new-dependency, existing dependency, standard-library/platform, candidate, and custom options, and to mark version, maintenance, vulnerability, license, provenance, transitive, install, lockfile, and update-posture evidence as supplied, repo-confirmed, or unchecked.
```

In rule 9, append this sentence:

```md
Do not let single-agent fallback skip the dependency/tool evaluation lane when the final recommendation would add, adopt, replace, upgrade, globally install, vendor, fork, code-generate, or hand-roll a tool.
```

### 4. `agents/blueprint-researcher.md`

In `## Required Reads`, add this bullet after the parent-supplied official-doc/external evidence packet bullet:

```md
- parent-supplied package, registry, release-note, security-advisory, license,
  provenance, dependency-review, audit, or update-policy evidence when a bounded
  strand asks for dependency/tool selection
```

In `## Investigation Trace Rules`, after the current evidence ladder, add:

```md
For dependency/tool strands, answer the bounded need by comparing:

1. no new dependency
2. existing repo dependency
3. standard library or platform API
4. candidate package, CLI, service, framework, or code generator
5. custom implementation

Return version, maintenance, vulnerability, license, provenance/signature,
transitive-footprint, install-scope, lockfile, update-posture, residual-risk,
and verification signals only from repo evidence or parent-supplied evidence.
Mark missing supply-chain data as `unchecked`; do not treat missing data as
approval.
```

In `## Required Output Contract`, add these bullets after `Planning Handoff`:

```md
- Include `Dependency / Tool Evaluation` when the strand recommends adding,
  adopting, replacing, upgrading, globally installing, locally installing,
  vendoring, forking, code-generating, or hand-rolling a package, library, CLI,
  framework, service, package-manager behavior, or tool.
- In that evaluation, include no-new-dependency, existing dependency,
  standard-library/platform, candidate package/tool, and custom options; exact
  candidate identity and version evidence; maintenance, vulnerability, license,
  provenance/signature, transitive-footprint, install-scope, lockfile,
  update-posture, residual-risk, and verification signals.
- If the parent did not supply live package, registry, audit, OSV, Scorecard,
  SLSA, license, or provenance evidence, mark the relevant field as
  `unchecked` instead of implying fresh supply-chain verification.
```

In `## Output Quality Expectations`, add:

```md
- For tool/dependency recommendations, make the supply-chain decision
  planner-usable: say why no-new-dependency, existing dependency,
  standard-library/platform, candidate package/tool, or custom implementation
  won, and name the tests, manifest/lockfile checks, release-note/changelog
  review, audit/OSV/dependency-review posture, and update plan the parent should
  carry into `/blu-plan-phase`.
```

Do not edit `tools:` or frontmatter.

### 5. `agents/blueprint-project-researcher.md`

No change.

Reason: this agent is a bootstrap/new-project researcher. R3 is explicitly about existing `/blu-research-phase`. Adding supply-chain tables here would broaden scope and risk changing `/blu-new-project` behavior.

### 6. `src/mcp/artifact-contracts/index.ts`

In `renderResearchTemplate`, replace the current simple `## Standard Stack`, `## Installation And Setup`, `## Alternatives Considered`, and `## Don't Hand-Roll` blocks with the exact richer blocks below.

Replace:

```md
## Standard Stack

- <runtime, library, or shared repo pattern>

## Installation And Setup

- <installation or setup guidance>

## Alternatives Considered

- <alternative considered and tradeoff>
```

with:

```md
## Standard Stack

- <runtime, library, or shared repo pattern>

### Dependency / Tool Evaluation

| Decision ID | Need | Candidate | Decision | Official Source Or Repo Evidence | Package Ecosystem | Install Scope | Current / Wanted / Latest Evidence | Maintenance Signal | Vulnerability Signal | License | Provenance / Signature Signal | Transitive Footprint | Existing / Standard-Library Alternative | Update Posture | Residual Risk And Mitigation |
|-------------|------|-----------|----------|----------------------------------|-------------------|---------------|------------------------------------|--------------------|----------------------|---------|-------------------------------|---------------------|------------------------------------------|----------------|-------------------------------|
| DEP-001 | <capability needed> | <package, tool, repo helper, platform API, or custom> | already_in_repo|use_existing|add_candidate|defer|reject|custom | <repo path, official URL, supplied source, or unchecked> | <npm, stdlib, platform, repo-local, service, or none> | runtime|dev|global|none | <current/wanted/latest, observed version, or unchecked> | <release/maintainer/CI/security-policy signal or unchecked> | <audit/OSV/advisory result or unchecked> | <SPDX/license signal or unchecked> | <provenance/SLSA/signature/scope identity signal or unchecked> | <none, small, moderate, large, or unchecked> | <no-new-dependency, existing dependency, standard library, or platform API option> | <Dependabot/Renovate/audit/OSV/release-note/changelog/manual review posture> | <risk and mitigation> |

## Installation And Setup

- <installation or setup guidance>

### Setup And Update Posture

| Decision ID | Manifest / Lockfile Impact | Install Command Or Path | Install Scope | Side Effects | Verification Command | Update / Monitoring Plan | Manual Review Required |
|-------------|----------------------------|-------------------------|---------------|--------------|----------------------|--------------------------|------------------------|
| DEP-001 | <package.json/package-lock or none> | <repo-local command/path or none> | runtime|dev|global|none | <transitive deps, lifecycle scripts, native binaries, peers, engines, or none> | <test/build/check or manual verification> | <Dependabot/Renovate/dependency review/OSV/npm audit/release notes/changelog/manual> | yes|no - <reason> |

## Alternatives Considered

- <alternative considered and tradeoff>

### Dependency Alternatives

| Decision ID | Need | No New Dependency | Existing Dependency | Standard Library / Platform API | Candidate Package / Tool | Custom Implementation | Decision | Rationale |
|-------------|------|-------------------|---------------------|---------------------------------|--------------------------|----------------------|----------|-----------|
| DEP-001 | <capability needed> | <viable/rejected and why> | <viable/rejected and why> | <viable/rejected and why> | <candidate and evidence> | <allowed/rejected and tests needed> | use_existing|add_candidate|defer|reject|custom | <actionable rationale> |
```

Replace:

```md
## Don't Hand-Roll

- <existing tool, helper, or platform feature>
```

with:

```md
## Don't Hand-Roll

- <existing tool, helper, or platform feature>

### Library Vs Custom Decision

| Decision ID | Capability | Domain Risk | Proven Library / Existing Option | Custom Path Allowed? | Rationale | Required Tests / Validation | Maintenance / Update Owner |
|-------------|------------|-------------|----------------------------------|----------------------|-----------|-----------------------------|----------------------------|
| DEP-001 | <capability> | security-sensitive|standardized|protocol|parser|package-resolution|low-risk-project-specific | <option or none> | yes|no | <why package/library/custom is safer> | <tests/checks required> | <owner or update path> |
```

Replace the current recommendation placeholder:

```md
- <prescriptive recommendation with tradeoffs>
```

with:

```md
- <prescriptive recommendation with tradeoffs; cite DEP-001 when this adds, adopts, rejects, defers, upgrades, or hand-rolls a dependency/tool>
```

Under `## Sources`, after `### External References` and its placeholder bullet, add:

```md

### Supply Chain Evidence

- Supply-chain evidence: <source title or command>, <URL or repo path>, accessed/observed <YYYY-MM-DD>, signal=<version|maintenance|vulnerability|license|provenance|transitive|update>, supports=DEP-001; source policy=<off|ask-approved|auto|supplied|unchecked>.
```

Add these placeholder signals to the `"phase.research"` `placeholderSignals` array. Add them after the existing `"<runtime, library, or shared repo pattern>"` signal and before `"<installation or setup guidance>"`, unless already present:

```ts
      "<capability needed>",
      "<package, tool, repo helper, platform API, or custom>",
      "<repo path, official URL, supplied source, or unchecked>",
      "<npm, stdlib, platform, repo-local, service, or none>",
      "<current/wanted/latest, observed version, or unchecked>",
      "<release/maintainer/CI/security-policy signal or unchecked>",
      "<audit/OSV/advisory result or unchecked>",
      "<SPDX/license signal or unchecked>",
      "<provenance/SLSA/signature/scope identity signal or unchecked>",
      "<none, small, moderate, large, or unchecked>",
      "<no-new-dependency, existing dependency, standard library, or platform API option>",
      "<Dependabot/Renovate/audit/OSV/release-note/changelog/manual review posture>",
      "<risk and mitigation>",
      "<package.json/package-lock or none>",
      "<repo-local command/path or none>",
      "<transitive deps, lifecycle scripts, native binaries, peers, engines, or none>",
      "<test/build/check or manual verification>",
      "<Dependabot/Renovate/dependency review/OSV/npm audit/release notes/changelog/manual>",
      "<viable/rejected and why>",
      "<candidate and evidence>",
      "<allowed/rejected and tests needed>",
      "<actionable rationale>",
      "<capability>",
      "<option or none>",
      "<why package/library/custom is safer>",
      "<tests/checks required>",
      "<owner or update path>",
```

Also add these placeholder signals near the existing source placeholders:

```ts
      "<prescriptive recommendation with tradeoffs; cite DEP-001 when this adds, adopts, rejects, defers, upgrades, or hand-rolls a dependency/tool>",
      "<source title or command>",
      "<URL or repo path>",
      "<version|maintenance|vulnerability|license|provenance|transitive|update>",
      "<off|ask-approved|auto|supplied|unchecked>"
```

Update `notes` for `phase.research` by adding this note after the current final note:

```ts
      "When a phase recommendation depends on adding, adopting, replacing, upgrading, installing, vendoring, forking, code-generating, or hand-rolling a dependency/tool, research should include the dependency/tool evaluation, setup/update posture, alternatives, library-vs-custom decision, and supply-chain evidence rows in the existing required headings."
```

Do not change `requiredHeadings`.

### 7. `src/mcp/tools/artifacts.ts`

Add warning-only helpers near the existing research helpers, immediately after `containsSourceEvidence`.

```ts
const RESEARCH_DEPENDENCY_CHOICE_PATTERN =
  /\b(?:add|adopt|introduce|install|select|choose|recommend|replace|upgrade|vendor|fork|hand-roll|hand roll|code-generate|code generate)\b[\s\S]{0,160}\b(?:package|dependency|library|framework|cli|service|code generator|code-generation|tool|package-manager|parser|protocol client)\b/i;
const RESEARCH_INSTALL_COMMAND_PATTERN =
  /\b(?:npm install|npm add|pnpm add|yarn add|bun add|pip install|cargo add|go get|brew install)\b/i;

function researchDependencyChoiceText(content: string): string {
  return [
    extractMarkdownSection(content, "Standard Stack"),
    extractMarkdownSection(content, "Installation And Setup"),
    extractMarkdownSection(content, "Alternatives Considered"),
    extractMarkdownSection(content, "Don't Hand-Roll"),
    extractMarkdownSection(content, "Recommendations")
  ].join("\n");
}

function mentionsDependencyOrToolChoice(content: string): boolean {
  const candidateText = researchDependencyChoiceText(content);

  return (
    RESEARCH_DEPENDENCY_CHOICE_PATTERN.test(candidateText) ||
    RESEARCH_INSTALL_COMMAND_PATTERN.test(candidateText)
  );
}

function hasDependencyToolEvaluationTable(content: string): boolean {
  const standardStack = extractMarkdownSection(content, "Standard Stack");

  return (
    /Dependency \/ Tool Evaluation/i.test(standardStack) &&
    /\|\s*Decision ID\s*\|\s*Need\s*\|\s*Candidate\s*\|\s*Decision\s*\|/i.test(standardStack) &&
    /Current \/ Wanted \/ Latest Evidence/i.test(standardStack) &&
    /Maintenance Signal/i.test(standardStack) &&
    /Vulnerability Signal/i.test(standardStack) &&
    /\|\s*License\s*\|/i.test(standardStack) &&
    /Provenance \/ Signature Signal/i.test(standardStack) &&
    /Transitive Footprint/i.test(standardStack) &&
    /Existing \/ Standard-Library Alternative/i.test(standardStack) &&
    /Update Posture/i.test(standardStack) &&
    /Residual Risk And Mitigation/i.test(standardStack) &&
    /\bDEP-\d{3}\b/.test(standardStack)
  );
}

function hasDependencyAlternativesCoverage(content: string): boolean {
  const alternatives = extractMarkdownSection(content, "Alternatives Considered");

  return (
    /Dependency Alternatives/i.test(alternatives) &&
    /No New Dependency/i.test(alternatives) &&
    /Existing Dependency/i.test(alternatives) &&
    /Standard Library \/ Platform API/i.test(alternatives) &&
    /Candidate Package \/ Tool/i.test(alternatives) &&
    /Custom Implementation/i.test(alternatives)
  );
}

function hasDependencySetupAndUpdatePosture(content: string): boolean {
  const setup = extractMarkdownSection(content, "Installation And Setup");

  return (
    /Setup And Update Posture/i.test(setup) &&
    /Manifest \/ Lockfile Impact/i.test(setup) &&
    /Install Scope/i.test(setup) &&
    /Side Effects/i.test(setup) &&
    /Verification Command/i.test(setup) &&
    /Update \/ Monitoring Plan/i.test(setup) &&
    /Manual Review Required/i.test(setup)
  );
}

function hasLibraryVsCustomDecision(content: string): boolean {
  const dontHandRoll = extractMarkdownSection(content, "Don't Hand-Roll");

  return (
    /Library Vs Custom Decision/i.test(dontHandRoll) &&
    /Domain Risk/i.test(dontHandRoll) &&
    /Proven Library \/ Existing Option/i.test(dontHandRoll) &&
    /Custom Path Allowed\?/i.test(dontHandRoll) &&
    /Required Tests \/ Validation/i.test(dontHandRoll)
  );
}

function hasSupplyChainEvidenceSource(content: string): boolean {
  const sources = extractMarkdownSection(content, "Sources");

  return (
    /Supply Chain Evidence/i.test(sources) &&
    /signal=<version\|maintenance\|vulnerability\|license\|provenance\|transitive\|update>/.test(sources) === false &&
    /\bsignal=(?:version|maintenance|vulnerability|license|provenance|transitive|update)\b/i.test(sources)
  );
}

function mentionsUnsafeAutomaticDependencyRemediation(content: string): boolean {
  const candidateText = [
    extractMarkdownSection(content, "Installation And Setup"),
    extractMarkdownSection(content, "Recommendations")
  ].join("\n");

  return (
    /\b(?:npm audit fix|OSV guided remediation|dependency-update PRs?)\b/i.test(candidateText) &&
    !/\b(?:not automatically safe|manual review|review manifest and lockfile diffs|inspect release notes|inspect changelog|run tests)\b/i.test(candidateText)
  );
}
```

Then, inside `validateResearchArtifactContent`, after the existing source-evidence check and before the code examples warning, add:

```ts
  if (mentionsDependencyOrToolChoice(content)) {
    if (!hasDependencyToolEvaluationTable(content)) {
      warnings.push(
        "Research artifact recommends or discusses a dependency/tool choice but does not include a complete Dependency / Tool Evaluation table with version, maintenance, vulnerability, license, provenance/signature, transitive-footprint, update-posture, and DEP-* evidence."
      );
    }

    if (!hasDependencyAlternativesCoverage(content)) {
      warnings.push(
        "Research artifact dependency/tool choice should compare no-new-dependency, existing dependency, standard-library/platform API, candidate package/tool, and custom implementation alternatives."
      );
    }

    if (!hasDependencySetupAndUpdatePosture(content)) {
      warnings.push(
        "Research artifact dependency/tool choice should record setup and update posture, including manifest or lockfile impact, install scope, side effects, verification command, monitoring/update plan, and manual-review posture."
      );
    }

    if (!hasLibraryVsCustomDecision(content)) {
      warnings.push(
        "Research artifact dependency/tool choice should include a Library Vs Custom Decision when a recommendation could add, adopt, reject, or hand-roll a tool."
      );
    }

    if (!hasSupplyChainEvidenceSource(content)) {
      warnings.push(
        "Research artifact dependency/tool choice should cite Supply Chain Evidence rows or explicitly mark supply-chain evidence as unchecked under the configured external-source policy."
      );
    }
  }

  if (mentionsUnsafeAutomaticDependencyRemediation(content)) {
    warnings.push(
      "Research artifact should not present npm audit fix, OSV guided remediation, or dependency-update PRs as automatically safe; require manifest/lockfile review, release-note or changelog review, and tests."
    );
  }
```

Important:

- These are warnings only. Do not add issues.
- Do not add diagnostics for these warnings in this R3 pass because current `validateResearchArtifactContent` diagnostics are issue-derived.
- Old valid research should remain valid.

### 8. `src/mcp/command-runtime-metadata.ts`

In `RESEARCH_PHASE_RUNTIME_METADATA.runtimeReference.contractNotes`, add this sentence after the sentence that closes non-trivial strands with a planning handoff:

```text
Treat dependency/tool selection as a first-class strand when recommendations add, adopt, replace, upgrade, install, vendor, fork, code-generate, or hand-roll a package, library, CLI, framework, service, or tool: compare no-new-dependency, existing dependency, standard-library/platform, candidate, and custom options, record version, maintenance, vulnerability, license, provenance/signature, transitive-footprint, install-scope, lockfile, update-posture, residual-risk, and verification evidence, and mark unavailable live supply-chain data as unchecked under the current research.external_sources policy.
```

Keep this concise. Do not paste the full table schema into metadata.

### 9. `docs/commands/research-phase.md`

In `Behavior Stages`, replace the current `Execute` line with:

```md
4. `Execute`: build an initial assessment, follow the repository evidence ladder, record per-strand search notes and navigation evidence, then research one topic strand at a time, grounding repo truth first, evaluating dependency/tool choices when they affect recommendations, and keeping external evidence distinct when policy allows it.
```

In `Research Runtime Anchors`, add this bullet after the current planning handoff bullet:

```md
- When a recommendation adds, adopts, replaces, upgrades, installs, vendors, forks, code-generates, or hand-rolls a package, library, CLI, framework, service, or tool, record a dependency/tool evaluation covering no-new-dependency, existing dependency, standard-library/platform, candidate, and custom options; version, maintenance, vulnerability, license, provenance/signature, transitive-footprint, install-scope, lockfile, update-posture, residual-risk, verification, and supply-chain evidence; and mark unavailable live evidence as unchecked under the configured external-source policy.
```

In `Acceptance Criteria`, add:

```md
- Dependency/tool recommendations are backed by a supply-chain-aware evaluation table or explicitly marked as unchecked/deferred when the configured external-source policy prevents live evidence.
```

In `Test Cases`, add:

```md
- R3 dependency/tool evaluation fixture with no-new-dependency, existing dependency, standard-library/platform, candidate package/tool, custom implementation, setup/update posture, library-vs-custom decision, and supply-chain evidence.
- Warning fixture for a dependency/tool recommendation that omits R3 evaluation rows.
```

### 10. `docs/ARTIFACT-SCHEMA.md`

In the `XX-RESEARCH.md` canonical template structure list, expand these bullets:

```md
- `## Standard Stack` with optional dependency/tool evaluation table
- `## Installation And Setup` with optional setup and update posture table
- `## Alternatives Considered` with optional dependency alternatives table
- `## Don't Hand-Roll` with optional library-vs-custom decision table
- `## Sources` with optional supply-chain evidence rows
```

In validation expectations, add:

```md
- dependency/tool recommendations should compare no-new-dependency, existing dependency, standard-library/platform API, candidate package/tool, and custom implementation before recommending a new package or custom code
- supply-chain evidence should record version, maintenance, vulnerability, license, provenance/signature, transitive footprint, install scope, lockfile impact, update posture, residual risk, and verification signals where available; missing live upstream evidence should be labeled unchecked, not treated as approval
```

In the exact persistence template, mirror the same table blocks from `src/mcp/artifact-contracts/index.ts`. Do not invent a different shape.

### 11. `docs/MCP-TOOLS.md`

In the `research-phase` bullet in the command-runtime notes, add this concise phrase after "close non-trivial strands with planning handoffs":

```text
, evaluate dependency/tool choices with no-new-dependency, existing dependency, standard-library/platform, candidate, and custom alternatives plus supply-chain evidence before recommending new packages or hand-rolled tooling
```

Do not add a new MCP tool.

### 12. `docs/RUNTIME-REFERENCE.md`

In the `research-phase` runtime row, add this concise phrase after "planning handoff fields":

```text
, and require dependency/tool strands to compare no-new-dependency, existing dependency, standard-library/platform, candidate, and custom options with version, maintenance, vulnerability, license, provenance, transitive-footprint, install, lockfile, update, residual-risk, verification, and unchecked-evidence signals
```

Do not paste the full table schema into the runtime reference row.

### 13. `tests/phase-discovery-research.test.ts`

In `validResearchContent`, update these sections so the base fixture remains R3-aware without being huge.

Replace the current `## Standard Stack` section body:

```md
- TypeScript
- node:test via tsx --test
```

with:

```md
- TypeScript
- node:test via tsx --test

### Dependency / Tool Evaluation

| Decision ID | Need | Candidate | Decision | Official Source Or Repo Evidence | Package Ecosystem | Install Scope | Current / Wanted / Latest Evidence | Maintenance Signal | Vulnerability Signal | License | Provenance / Signature Signal | Transitive Footprint | Existing / Standard-Library Alternative | Update Posture | Residual Risk And Mitigation |
|-------------|------|-----------|----------|----------------------------------|-------------------|---------------|------------------------------------|--------------------|----------------------|---------|-------------------------------|---------------------|------------------------------------------|----------------|-------------------------------|
| DEP-001 | Research artifact validation | Existing MCP artifact validator | use_existing | src/mcp/tools/artifacts.ts | repo-local | none | local source observed | maintained in repo tests | unchecked - repo-only fixture | repository license context | unchecked - repo-only fixture | none | existing dependency and repo validator | focused tests plus normal build | Low risk; keep validation fixture coverage. |
```

Replace the current `## Installation And Setup` body with:

```md
- Run the repo build and focused tests before accepting a research-contract change.

### Setup And Update Posture

| Decision ID | Manifest / Lockfile Impact | Install Command Or Path | Install Scope | Side Effects | Verification Command | Update / Monitoring Plan | Manual Review Required |
|-------------|----------------------------|-------------------------|---------------|--------------|----------------------|--------------------------|------------------------|
| DEP-001 | none | none | none | none | npx tsx --test tests/phase-discovery-research.test.ts | normal repo dependency maintenance | no - existing repo validator only |
```

Replace the current `## Alternatives Considered` body with:

```md
- A prompt-local research outline was rejected because it drifts from the canonical MCP template.

### Dependency Alternatives

| Decision ID | Need | No New Dependency | Existing Dependency | Standard Library / Platform API | Candidate Package / Tool | Custom Implementation | Decision | Rationale |
|-------------|------|-------------------|---------------------|---------------------------------|--------------------------|----------------------|----------|-----------|
| DEP-001 | Research artifact validation | viable - keep existing validator | viable - current MCP validator exists | insufficient alone - markdown semantics are project-specific | rejected - no new package needed | rejected - duplicate validation logic would drift | use_existing | Existing validator already owns the phase.research contract. |
```

Replace the current `## Don't Hand-Roll` body with:

```md
- Reuse phase resolution and artifact validation helpers instead of writing raw files directly.

### Library Vs Custom Decision

| Decision ID | Capability | Domain Risk | Proven Library / Existing Option | Custom Path Allowed? | Rationale | Required Tests / Validation | Maintenance / Update Owner |
|-------------|------------|-------------|----------------------------------|----------------------|-----------|-----------------------------|----------------------------|
| DEP-001 | Research artifact validation | low-risk-project-specific | Existing MCP validator | no | A second custom path would drift from MCP-owned validation. | phase discovery research tests | Blueprint runtime maintainers |
```

Under `## Sources`, add:

```md

### Supply Chain Evidence

- Supply-chain evidence: repo-local validator, `src/mcp/tools/artifacts.ts`, accessed/observed 2026-04-11, signal=version, supports=DEP-001; source policy=off.
```

In the main parity test, add assertions:

```ts
  assert.match(commandFile, /dependency\/tool evaluation/i);
  assert.match(commandFile, /no-new-dependency/i);
  assert.match(commandFile, /standard-library\/platform/i);
  assert.match(commandFile, /transitive-footprint/i);
  assert.match(commandFile, /external-source policy/i);

  assert.match(docFile, /dependency\/tool evaluation/i);
  assert.match(docFile, /supply-chain-aware/i);
  assert.match(docFile, /unchecked\/deferred|unchecked/i);

  assert.match(runtimeReference, /dependency\/tool strands/i);
  assert.match(runtimeReference, /version, maintenance, vulnerability, license, provenance/i);

  assert.match(mcpToolsDoc, /dependency\/tool choices/i);
  assert.match(mcpToolsDoc, /supply-chain evidence/i);

  assert.match(skillFile, /dependency\/tool evaluation lane/i);
  assert.match(skillFile, /lockfile/i);

  assert.match(researcherAgent, /Dependency \/ Tool Evaluation/i);
  assert.match(researcherAgent, /no-new-dependency/i);
  assert.match(researcherAgent, /provenance\/signature/i);
  assert.match(researcherAgent, /unchecked/i);
```

In `research scaffold seeds the exact research template shape`, add:

```ts
  assert.match(scaffold, /### Dependency \/ Tool Evaluation/);
  assert.match(scaffold, /Current \/ Wanted \/ Latest Evidence/);
  assert.match(scaffold, /Maintenance Signal/);
  assert.match(scaffold, /Vulnerability Signal/);
  assert.match(scaffold, /Provenance \/ Signature Signal/);
  assert.match(scaffold, /Transitive Footprint/);
  assert.match(scaffold, /Existing \/ Standard-Library Alternative/);
  assert.match(scaffold, /### Setup And Update Posture/);
  assert.match(scaffold, /Manifest \/ Lockfile Impact/);
  assert.match(scaffold, /Update \/ Monitoring Plan/);
  assert.match(scaffold, /### Dependency Alternatives/);
  assert.match(scaffold, /No New Dependency/);
  assert.match(scaffold, /Standard Library \/ Platform API/);
  assert.match(scaffold, /### Library Vs Custom Decision/);
  assert.match(scaffold, /### Supply Chain Evidence/);
```

Add a new test after `research template accepts R2 search notes and role-method repo evidence`:

```ts
test("research template warns when dependency recommendations omit R3 evaluation", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research with a dependency recommendation that lacks R3 evaluation."
  )
    .replace(/### Dependency \/ Tool Evaluation[\s\S]*?\n## Installation And Setup/, "## Installation And Setup")
    .replace(/### Setup And Update Posture[\s\S]*?\n## Alternatives Considered/, "## Alternatives Considered")
    .replace(/### Dependency Alternatives[\s\S]*?\n## Architecture Patterns/, "## Architecture Patterns")
    .replace(/### Library Vs Custom Decision[\s\S]*?\n## Anti-Patterns/, "## Anti-Patterns")
    .replace(/### Supply Chain Evidence[\s\S]*$/, "")
    .replace(
      "- Persist only validated research content through `blueprint_phase_artifact_write`.",
      "- Add a package dependency to perform research artifact validation."
    );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.status, "created");
  assert.equal(written.validation.valid, true, written.validation.issues.join("\n"));
  assert.match(written.validation.warnings.join("\n"), /Dependency \/ Tool Evaluation/i);
  assert.match(written.validation.warnings.join("\n"), /no-new-dependency/i);
  assert.match(written.validation.warnings.join("\n"), /Setup And Update Posture/i);
  assert.match(written.validation.warnings.join("\n"), /Library Vs Custom Decision/i);
  assert.match(written.validation.warnings.join("\n"), /Supply Chain Evidence/i);
});
```

### 14. `tests/artifact-contracts.test.ts`

Update `canonicalResearchContent` the same way as `validResearchContent`: add the four R3 tables and the supply-chain evidence source row. Use the same fixture values from the previous section.

In `artifact contract registry exposes canonical contract ids and templates`, add:

```ts
  assert.match(researchContract.authoringTemplate, /### Dependency \/ Tool Evaluation/);
  assert.match(researchContract.authoringTemplate, /Current \/ Wanted \/ Latest Evidence/);
  assert.match(researchContract.authoringTemplate, /### Setup And Update Posture/);
  assert.match(researchContract.authoringTemplate, /### Dependency Alternatives/);
  assert.match(researchContract.authoringTemplate, /### Library Vs Custom Decision/);
  assert.match(researchContract.authoringTemplate, /### Supply Chain Evidence/);
```

Add a new validation test after `research contract allows intentional placeholder token prose`:

```ts
test("research contract emits R3 dependency/tool warnings without invalidating the artifact", () => {
  const research = canonicalResearchContent(
    "Add a package dependency for artifact validation without enough supply-chain detail.",
    "| LIFE-01 | Keep endpoint research grounded. | Add a package dependency for validation. |"
  )
    .replace(/### Dependency \/ Tool Evaluation[\s\S]*?\n## Installation And Setup/, "## Installation And Setup")
    .replace(/### Setup And Update Posture[\s\S]*?\n## Alternatives Considered/, "## Alternatives Considered")
    .replace(/### Dependency Alternatives[\s\S]*?\n## Architecture Patterns/, "## Architecture Patterns")
    .replace(/### Library Vs Custom Decision[\s\S]*?\n## Anti-Patterns/, "## Anti-Patterns")
    .replace(/### Supply Chain Evidence[\s\S]*?\n## Additional Context/, "## Additional Context");

  const validation = validateResearchArtifactContent(research);

  assert.equal(validation.valid, true, validation.issues.join("\n"));
  assert.match(validation.warnings.join("\n"), /Dependency \/ Tool Evaluation/i);
  assert.match(validation.warnings.join("\n"), /no-new-dependency/i);
});
```

### 15. `tests/mcp-contract-audit-metadata.test.ts`

In the research assertions around the existing R2 assertions, add:

```ts
  assert.match(researchCommand, /dependency\/tool evaluation/i);
  assert.match(researchCommand, /no-new-dependency/i);
  assert.match(researchRuntimeContract, /Tool And Dependency Selection/i);
  assert.match(researchRuntimeContract, /Current \/ Wanted \/ Latest Evidence/i);
  assert.match(researchRuntimeContract, /Supply Chain Evidence/i);
  assert.match(researchRuntimeContract, /npm audit fix/i);
  assert.match(researchDoc, /supply-chain-aware/i);
  assert.match(mcpToolsDoc, /dependency\/tool choices/i);
```

### 16. `tests/agent-contract-specialists.test.ts`

In the `blueprint-researcher` assertions, add:

```ts
  assert.match(researcher, /Dependency \/ Tool Evaluation/i);
  assert.match(researcher, /no new dependency/i);
  assert.match(researcher, /standard library or platform API/i);
  assert.match(researcher, /version, maintenance, vulnerability, license/i);
  assert.match(researcher, /provenance\/signature/i);
  assert.match(researcher, /transitive-footprint/i);
  assert.match(researcher, /lockfile/i);
  assert.match(researcher, /unchecked/i);
```

## Verification Plan For Implementor

Because R3 touches TypeScript runtime/template code, rebuild tracked `dist/`.

From the implementation worktree:

```bash
npm ci
npx tsx --test tests/phase-discovery-research.test.ts tests/artifact-contracts.test.ts tests/mcp-contract-audit-metadata.test.ts tests/agent-contract-specialists.test.ts
npm run typecheck
npm run build
git diff --check
git status --short
```

If any generated `dist/` file changes after `npm run build`, include it.

## Acceptance Checklist

- `phase.research.requiredHeadings` unchanged.
- `/blu-research-phase` required MCP tool list unchanged.
- `blueprint-researcher` remains read-only and non-fetching.
- `blueprint-project-researcher.md` unchanged.
- R3 tables appear in the canonical `phase.research` authoring and scaffold templates.
- Dependency/tool recommendations without R3 evaluation produce warnings, not invalid research.
- Repo-only valid research remains valid.
- Docs and runtime metadata mention R3 in concise terms.
- Tests cover command manifest, runtime contract, skill, agent, docs, artifact template, and validation warnings.
- `dist/` rebuilt after runtime changes.
