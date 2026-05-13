# `/blu-new-milestone` Frontier Research And Improvement Plan

Status: working research document.

Branch/worktree: `codex/new-milestone-frontier-plan` in `/Users/rhishi/dev/repositories/blueprint-new-milestone-frontier`.

Doc boundary: this document is the only planned repository change for this run. It is an implementation plan for future work, not a source, test, manifest, command, skill, agent, or `.blueprint/` mutation.

## Scope

This document researches and plans future improvements to the `/blu-new-milestone` workflow. It treats Blueprint as a Gemini-native extension with MCP-owned state, not as GSD internals or a legacy port.

The final plan must stay documentation-only and should be detailed enough that a later implementor can make exact prompt/contract/test changes without deciphering vague advice.

## Current Blueprint Workflow Snapshot

Grounding files read before the research loop:

- `commands/blu-new-milestone.toml`
- `docs/commands/new-milestone.md`
- `skills/blueprint-roadmap-admin/SKILL.md`
- `agents/blueprint-roadmapper.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/state.ts`
- `src/mcp/tools/artifacts.ts`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/RUNTIME-REFERENCE.md`
- `tests/new-milestone-metadata.test.ts`
- `tests/command-catalog.test.ts`
- `tests/command-contract-docs.test.ts`

Current behavior summary:

- `/blu-new-milestone` uses the `blueprint-roadmap-admin` skill and `interactive-read` execution profile.
- It reads the current roadmap, effective config, `report.milestone-summary`, and `phase.context` contracts before writing.
- It defaults to carry-forward from the saved milestone summary and only switches to fresh reset after explicit user intent.
- It uses `blueprint_artifact_summary_digest` with explicit repo-relative inputs and treats `inputsUsed` as the authoritative digest scope.
- It may use `blueprint-roadmapper` only for bounded next-milestone grouping when the command contract and effective config allow subagents.
- It derives the first new phase number as the next integer after the highest base phase number in the roadmap.
- It preserves historical phase directories and numbering history.
- It uses `blueprint_artifact_scaffold` to seed `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, `.blueprint/ROADMAP.md`, `.blueprint/phases/`, and the first new `NN-CONTEXT.md`.
- It does not treat scaffold text as final authored milestone content.
- It updates `STATE.md` with `base: "synced"`, records `/blu-new-milestone` as active, sets the new milestone and first new phase, and routes to `/blu-discuss-phase <first phase>`.
- It keeps explicit blocked/waiting states: `missing-milestone-summary`, `carry-forward-confirmation`, and `starter-doc-overwrite-confirmation`.
- It must not use `update_topic`, `write_todos`, or task tracker tools.

Current improvement hypothesis:

The shipped workflow has a good safety boundary but is still mostly prompt-contract guidance. The highest leverage future work is likely in making carry-forward quality more structured, making confirmation gates less ambiguous, making roadmapper handoff packets more typed, making phase continuity/traceability easier to verify, and making the downstream `/blu-discuss-phase` handoff richer without turning `new-milestone` into a long-running workflow.

## Research Collection

Each research lane should cite authoritative sources from the web and then translate the finding into implications for `/blu-new-milestone`.

### R1 Context Carry-Forward And Memory Compression

Owner: R1.

Status: complete.

#### Source URLs

- OpenAI Agents SDK sessions: https://openai.github.io/openai-agents-python/sessions/ and https://openai.github.io/openai-agents-js/guides/sessions/
- OpenAI conversation state guide: https://developers.openai.com/api/docs/guides/conversation-state
- OpenAI Responses compaction API: https://developers.openai.com/api/reference/resources/responses/methods/compact
- OpenAI context-engineering cookbook for session memory: https://developers.openai.com/cookbook/examples/agents_sdk/session_memory
- OpenAI agent-loop compaction note: https://openai.com/index/equip-responses-api-computer-environment/
- Anthropic context management announcement: https://claude.com/blog/context-management
- Anthropic context editing docs: https://platform.claude.com/docs/en/build-with-claude/context-editing
- Anthropic memory tool docs: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- Claude Code Agent SDK sessions: https://code.claude.com/docs/en/agent-sdk/sessions
- W3C PROV-DM provenance standard: https://www.w3.org/TR/prov-dm/
- W3C Trace Context standard: https://www.w3.org/TR/trace-context/
- NIST AI RMF 1.0: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10
- MemGPT: Towards LLMs as Operating Systems: https://arxiv.org/abs/2310.08560
- Generative Agents: Interactive Simulacra of Human Behavior: https://arxiv.org/abs/2304.03442
- Reflexion: Language Agents with Verbal Reinforcement Learning: https://arxiv.org/abs/2303.11366
- ACON: Optimizing Context Compression for Long-horizon LLM Agents: https://arxiv.org/abs/2510.00615
- PROV-AGENT: Unified Provenance for Tracking AI Agent Interactions in Agentic Workflows: https://arxiv.org/abs/2508.02866

#### Key Findings

- Current agent platforms separate continuity into layers: active prompt context, session or conversation history, explicit compaction, and longer-term memory. OpenAI sessions/conversations preserve turn history, while compaction shrinks long-running context; Anthropic's context editing clears stale tool results while pairing with memory files for durable facts. The shared direction is not "keep everything in context"; it is "keep current context small, keep durable memory structured, and retrieve source detail when needed."
- Compression is useful but risky. OpenAI's cookbook frames trimming as deterministic but forgetful, and summarization as long-range but vulnerable to loss, bias, and context poisoning. Anthropic's docs similarly distinguish clearing stale tool results from saving important information to memory before it disappears from active context. For Blueprint, the milestone summary and digest should be treated as a lossy carry-forward artifact unless they include evidence references and uncertainty markers.
- Frontier memory architectures use hierarchy and retrieval. MemGPT treats context as a managed memory hierarchy, moving information between fast active context and slower external stores. Anthropic's memory tool describes just-in-time retrieval from persisted files instead of preloading everything. Generative Agents uses memory streams plus relevance, recency, importance, reflection, and planning; Reflexion stores verbal feedback as episodic memory; ACON compresses observations and interaction histories for long-horizon agents. The pattern is structured selection, not blind summarization.
- Evidence-preserving continuity needs provenance. W3C PROV-DM models entities, activities, derivations, and responsible agents so a derived artifact can be assessed for quality and trustworthiness. W3C Trace Context gives the analogous runtime lesson: continuity across boundaries works best when stable identifiers propagate. For Blueprint, `inputsUsed` is the right seed, but it is too thin by itself to explain which claims came from which source sections.
- Session resume and fork semantics matter. Claude Code sessions distinguish continue, resume, and fork, and warn that sessions preserve conversation state, not filesystem state. This maps directly to `/blu-new-milestone`: carry-forward, fresh reset, and optional roadmapper exploration are different continuity modes and should be visibly named before starter docs are overwritten.
- Governance sources favor documentation and traceability. NIST AI RMF is not an agent-memory design document, but it reinforces the need for trustworthy AI workflows to be documented, operationalized, and inspectable. For Blueprint, a carry-forward digest that cannot explain its source evidence is a governance and debugging weakness.

#### Blueprint Implications

- The existing `/blu-new-milestone` contract is directionally strong: it defaults to the saved milestone summary, digests explicit repo-relative inputs, treats `inputsUsed` as authoritative evidence scope, and routes to `/blu-discuss-phase <first phase>` instead of pretending starter scaffolds are final authored docs.
- The current carry-forward model is still mostly prose-level continuity. It can preserve the "shape" of the previous milestone while losing the difference between validated outcomes, durable decisions, unresolved risks, deferred ideas, stale assumptions, and discarded details.
- `inputsUsed` should remain the authoritative evidence boundary, but the next frontier improvement is to add a claim-level evidence ledger inside the digest or seed, so downstream starter docs can say why a carry-forward item exists without re-reading the entire old milestone.
- Compression should happen once from durable source artifacts, not repeatedly from prior compressed summaries. Re-compressing a milestone summary into a digest and then into starter docs creates drift risk unless each derived item keeps a path back to the source artifact and section.
- The optional `blueprint-roadmapper` pass should receive a compact, typed carry-forward packet plus evidence references, not a raw pile of old roadmap/report text. That keeps the parent command as write owner while giving the subagent enough context to group next-milestone candidates safely.

#### Concrete Improvement Ideas

- Define a structured carry-forward digest shape for `/blu-new-milestone`, either as command-contract guidance or future MCP output metadata: `validatedOutcomes`, `retainedDecisions`, `openRisks`, `deferredIdeas`, `candidateNextMilestoneThemes`, `nonCarryForwardItems`, `staleOrAmbiguousClaims`, and `evidenceLedger`.
- Make `evidenceLedger` claim-oriented. Each row should carry at least `claimId`, `sourcePath`, `sourceSection` or heading, `derivedFromInput` from `inputsUsed`, `confidence`, and `usedBy` target such as `PROJECT`, `REQUIREMENTS`, `ROADMAP`, or first `phase.context` seed.
- Add an explicit compression-quality note to the new-milestone confirmation gate: source inputs used, any omitted or truncated material, high-confidence carry-forward items, low-confidence assumptions, and reset consequences. This would make the carry-forward versus reset decision concrete without turning the command into a long progress workflow.
- Seed the first `XX-CONTEXT.md` with a small handoff packet for `/blu-discuss-phase <first phase>`: next milestone theme, retained decisions, open questions, risk watchlist, and evidence references. Keep the scaffold clearly marked as starter context, not completed phase context.
- Preserve a "do not carry forward" lane. Compression systems often over-retain old context; Blueprint should explicitly list stale assumptions, closed risks, and intentionally dropped milestone details so old work does not silently steer the new milestone.
- Add future tests around digest fidelity rather than exact prose: missing summary blocks the command, `inputsUsed` is surfaced, reset/carry-forward mode is visible, unsupported sources are not cited, and the first-phase handoff packet preserves evidence references without inventing new sources.
- Keep token and scope budgets explicit. The digest should prefer compact bullets and evidence pointers over long excerpts, and should warn when source artifacts are too large, malformed, or only partially digested.

#### Risks And Open Questions

- Summary drift: compressed carry-forward text can become more authoritative than the source artifacts. Mitigation: every durable claim should point back to a source path and section, and low-confidence claims should be labeled.
- Context poisoning: an incorrect milestone summary could poison the next milestone. Mitigation: surface source scope and uncertainty in the confirmation gate, and make fresh reset an explicit, visible alternative.
- Over-retention: carrying forward too much can make the next milestone a continuation of old noise. Mitigation: require `nonCarryForwardItems` and stale-assumption handling in the digest.
- Overengineering: a full provenance graph would make a bounded roadmap-admin command feel too heavy. Mitigation: use a small claim ledger and source pointers, not a general graph database.
- Privacy and host safety: memory guidance warns about sensitive data, path traversal, and oversized memory files. Blueprint should keep carry-forward inside `.blueprint/`, avoid host-global state, and avoid embedding secrets or raw large logs into starter docs.
- Staleness between digest and write: if `.blueprint/ROADMAP.md` or the milestone summary changes after confirmation, the scaffold could be based on stale evidence. Mitigation: future runtime work could compare `inputsUsed` plus lightweight source metadata immediately before scaffold writes.

### R2 Milestone Planning, Roadmapping, And Outcome Slicing

Owner: Codex R2 research lane.

Status: complete.

#### Source URLs

- GOV.UK Service Manual, "Planning in agile": https://www.gov.uk/service-manual/agile-delivery/planning-agile
- GOV.UK Service Manual, "Developing a roadmap": https://www.gov.uk/service-manual/agile-delivery/developing-a-roadmap
- GOV.UK Service Manual, "Measuring and reporting progress": https://www.gov.uk/service-manual/agile-delivery/measuring-reporting-progress
- Scrum Guide 2020, Scrum Guides: https://scrumguides.org/scrum-guide.html
- Scrum.org Evidence-Based Management overview and guide landing page: https://www.scrum.org/resources/evidence-based-management and https://www.scrum.org/resources/evidence-based-management-guide
- Product Talk, Teresa Torres, "Why This Opportunity Solution Tree is Changing the Way Product Teams Work": https://www.producttalk.org/opportunity-solution-tree-origin/
- IDRC, "Outcome Mapping: Building Learning and Reflection into Development Programs": https://idrc-crdi.ca/en/books/outcome-mapping-building-learning-and-reflection-development-programs
- PMI, Gregory D. Githens, "Manage innovation programs with a rolling wave": https://www.pmi.org/learning/library/manage-innovation-programs-rolling-wave-3515
- NASA Systems Engineering Handbook, "6.1 Technical Planning": https://www.nasa.gov/reference/6-1-technical-planning/
- NASA Lessons Learned: https://www.nasa.gov/nasa-lessons-learned/

#### Key Findings

- Agile planning guidance favors progressive detail: keep distant work high-level, make near-term work more detailed, and update plans as teams learn more about users. GOV.UK frames the plan around vision, objectives, measurable results, and a roadmap rather than a fully specified execution backlog.
- Product roadmap guidance distinguishes roadmaps from backlogs. GOV.UK says roadmaps should express value, priority, objective, timeboxed iteration, and intent while staying easy to change. This is directly relevant to `/blu-new-milestone`: the command should seed a coherent next milestone, not author a full backlog or execution plan.
- GOV.UK progress reporting warns that extra reporting becomes counterproductive and specifically calls out phase transitions as moments where momentum can be lost. This supports the current Blueprint constraint that `/blu-new-milestone` must stay a short bounded restart flow and must not adopt visible todos, tracker state, or long-running progress narration.
- The Scrum Guide provides a useful shape for phase slicing: one larger product goal anchors ordered work; near-term slices should have a clear goal, selected work, and a plan; review and retrospective learning should adapt what comes next. The transferable point is not "make Blueprint Scrum," but "make every first next phase explain why this slice exists, what it contains, and how progress will be inspectable."
- Scrum.org Evidence-Based Management separates current value, unrealized value, time to market, and ability to innovate as lenses for outcome decisions. For Blueprint, next-milestone seeds should preserve both value gaps and delivery-capability gaps, not only feature leftovers.
- Teresa Torres' Opportunity Solution Tree is a frontier product-discovery pattern for connecting desired outcomes to opportunities, solutions, and experiments. It warns against jumping from a backlog of ideas to a favored solution and against orphaned solutions that do not connect to an opportunity or outcome.
- IDRC Outcome Mapping emphasizes learning, actors, behavior/relationship/action changes, strategies, and the limits of claiming broad impact. For Blueprint, carry-forward should state "what changed or still needs to change for users/operators of the workflow" rather than overclaim that a milestone delivered all intended impact.
- PMI rolling-wave planning fits uncertain product work: plan a little, do a little, replan at defined horizons, capture learning for feed-forward use, and manage phase transitions by asking whether there is enough information to move to the next gate, whether the vision still holds, and what work structure must change.
- NASA technical planning guidance treats plans as iterative, synchronized to life-cycle gates, updated when constraints or expectations change, and explicitly fed by prior phase plans, current issues, risk assessment, and lessons learned. NASA's lessons-learned system also models reviewed lessons as retrievable recommendations that feed continual improvement.

#### Blueprint Implications

- `/blu-new-milestone` should keep its present bounded contract: read the saved milestone summary and roadmap, optionally ask `blueprint-roadmapper` for grouping, scaffold the starter docs and first new phase, update state, and route to `/blu-discuss-phase <first phase>`. The research does not support expanding it into a long-running planning tracker.
- The carry-forward seed should be outcome-shaped before it is phase-shaped. A future improvement could require the seed to name the next milestone's intended outcome, 3 to 5 measurable signals, the top unresolved value gaps, and the delivery-capability constraints inherited from the previous milestone.
- The first new phase should be a "nearest useful learning slice," not merely the first leftover task. It should preserve the current next whole-number phase rule, but derive the phase objective from a clear problem/opportunity and the smallest inspectable next step that enables `/blu-discuss-phase`.
- `blueprint-roadmapper` is best positioned as a bounded grouping and sequencing reviewer: cluster carry-forward items by outcome/opportunity, detect orphaned solution ideas, identify dependency or risk order, and propose one ordered first-phase candidate plus deferred candidates. The parent command must still own final numbering, confirmations, scaffolding, and `.blueprint/` writes.
- The milestone summary digest's `inputsUsed` should remain the authoritative evidence scope. R2's sources argue for making the seed explain what evidence produced the chosen phase order, including any uncertainty, so downstream planning can distinguish "known carry-forward" from "assumption to discuss."
- Historical phase preservation is aligned with roadmap/lessons-learned guidance. Prior phase directories are the as-built history; `/blu-new-milestone` should carry forward lessons and decisions, not clean or renumber the old evidence trail.

#### Concrete Improvement Ideas

- Add a `Next Milestone Outcome Frame` to the command/skill contract for the carry-forward seed:
  - `targetOutcome`: one sentence naming the desired next milestone result.
  - `measurableSignals`: 3 to 5 concise signals, allowing "unknown" only with an explicit reason.
  - `currentValueCarriedForward`: what already works or must be preserved.
  - `unrealizedValueOrGaps`: user/workflow gaps still worth pursuing.
  - `deliveryCapabilityConstraints`: technical debt, validation limits, automation gaps, or process constraints that affect sequencing.
- Add a `Phase Slice Candidate` shape for the first new phase scaffold:
  - `phaseNumber`: the next whole-number phase derived from roadmap state.
  - `phaseObjective`: problem or opportunity to resolve.
  - `whyFirst`: dependency, risk reduction, value unlock, or learning rationale.
  - `inspectableProgress`: what `/blu-discuss-phase` should clarify or verify next.
  - `deferredNotDoingNow`: 2 to 4 important items intentionally not in the first phase.
- Add roadmapper prompt guidance to classify carry-forward items as `outcome`, `opportunity`, `solution`, `experimentOrValidation`, `dependency`, `risk`, or `lesson`. Require it to flag orphaned solutions and over-broad slices instead of silently turning them into phases.
- Add a compact rolling-wave handoff note to the starter roadmap seed: near-term phase is detailed enough for discuss-phase; later candidate phases stay high-level and assumption-labeled. This preserves adaptability without losing continuity.
- Add a carry-forward learning ledger subsection with `keep`, `change`, `avoid`, and `openQuestion` bullets sourced from the milestone summary. Keep it short enough to fit the bounded command and make the later `/blu-discuss-phase` responsible for elaboration.
- Add wording to command docs that the roadmap scaffold captures intent, priority, and first inspectable slice, not final implementation commitments. This mirrors GOV.UK's roadmap/backlog distinction and reduces the risk of users treating generated starter docs as final plans.
- Add future tests around generated prompt/contract text, not runtime behavior yet: verify the docs/skill/metadata mention outcome frame, first-slice rationale, deferred items, and no tracker expansion while preserving next whole-number phase and historical directory rules.

#### Risks And Open Questions

- Risk: adding outcome frames could make `/blu-new-milestone` feel like `/blu-plan-phase`. Mitigation: cap the frame to summary-level fields and route detailed elaboration to `/blu-discuss-phase`.
- Risk: measurable signals may be unknown at milestone start. Mitigation: allow explicit unknowns with a reason and make discuss-phase responsible for refining them.
- Risk: roadmapper grouping could overfit to product-management language and invent evidence. Mitigation: require every grouping note to cite digest inputs or mark inference/uncertainty.
- Risk: a carry-forward learning ledger could duplicate `milestone-summary`. Mitigation: keep only decision-useful lessons for the next milestone seed and preserve `inputsUsed` as the evidence boundary.
- Risk: phase sequencing can become too rigid. Mitigation: represent later phases as high-level candidates and keep only the first phase as the actionable scaffold target.
- Open question: should these seed fields live only in command/skill prompt contracts, or should `blueprint_artifact_scaffold` eventually accept a typed carry-forward seed object so tests can assert the shape deterministically?

### R3 Human Confirmation Gates And High-Risk Workflow UX

Owner: R3 research lane.

Status: complete.

#### Source URLs

- NIST AI RMF Appendix C, AI Risk Management and Human-AI Interaction: https://airc.nist.gov/airmf-resources/airmf/appendices/app-c-ai-risk-management-and-human-ai-interaction/
- NIST AI RMF Generative AI Profile: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- EU AI Act Article 14, Human Oversight: https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-14
- ISO/IEC 42001:2023 AI management systems: https://www.iso.org/standard/42001
- ISO/IEC 23894:2023 AI risk management guidance: https://www.iso.org/standard/77304.html
- Microsoft HAX Guidelines overview: https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/
- Microsoft HAX Design Library: https://www.microsoft.com/en-us/haxtoolkit/library/
- Microsoft Research CHI 2019 paper, "Guidelines for Human-AI Interaction": https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/
- Google PAIR Guidebook, Explainability and Trust: https://pair.withgoogle.com/guidebook-v2/chapter/explainability-trust/
- Google PAIR Guidebook, Feedback and Control: https://pair.withgoogle.com/guidebook-v2/chapters/feedback-controls/
- Google PAIR Guidebook, Errors and Graceful Failure: https://pair.withgoogle.com/guidebook-v2/chapter/errors-failing/
- OWASP GenAI LLM06:2025 Excessive Agency: https://genai.owasp.org/llmrisk/llm062025-excessive-agency/
- Microsoft Learn UX Guide, Confirmations: https://learn.microsoft.com/en-us/windows/win32/uxguide/mess-confirm
- Lyell and Coiera, "Automation bias and verification complexity: a systematic review": https://pubmed.ncbi.nlm.nih.gov/27516495/
- Zhang, Liao, and Bellamy, "Effect of Confidence and Explanation on Accuracy and Trust Calibration in AI-Assisted Decision Making": https://arxiv.org/abs/2001.02114

#### Key Findings

- Human oversight needs to be a real control, not a ceremonial "human in the loop" label. NIST emphasizes clearly defined and differentiated human roles across autonomous, manual, and AI-advised configurations; the EU AI Act frames oversight as proportionate to risk, autonomy, and context of use.
- AI risk standards push confirmation gates toward governance and traceability. ISO/IEC 42001 treats AI management as an ongoing system for risk, transparency, and responsible use; ISO/IEC 23894 frames AI risk management as a context-specific process that should be integrated into normal organizational activities.
- OWASP's excessive-agency guidance is directly relevant to persistent workflow tools: keep least privilege, execute actions in the user's security context, and require human approval before high-impact actions. For Blueprint, replacing starter docs and choosing a fresh reset are high-impact because they shape future state, even if they are not externally visible.
- Microsoft HAX and the original CHI 2019 guidelines emphasize making capabilities and limits clear, supporting efficient dismissal/correction, scoping services when user intent is uncertain, explaining why the AI acted, conveying consequences of user actions, and providing global controls.
- Google PAIR's trust guidance argues for calibrated trust rather than maximum trust. Users should know when to rely on the system, when to double-check, what data sources are in scope, what can be reset or removed, and why high-stakes or less frequent actions deserve extra explanation.
- Google PAIR's control guidance says people usually prefer to retain control when stakes are high, when they feel personally responsible for the outcome, or when preferences are hard to communicate. Starting a new milestone has all three traits: it sets project direction, assigns accountability, and compresses ambiguous prior context.
- Error and waiting states are part of trust calibration. PAIR frames AI errors as moments that shape mental models; good recovery gives users a path forward and, for high-risk outcomes, can shift from automation to manual control.
- Confirmation UX research warns against confirmation fatigue. Microsoft UX guidance says confirmations are valuable when the user must make a distinct choice with significant, non-obvious, hard-to-undo, or security-relevant consequences; frequent generic confirmations train users to dismiss prompts without reading.
- Effective confirmations should be specific. A gate should name the action, affected artifacts, consequence, reversibility, safe alternative, and decision options. Generic "OK/Cancel" or "Are you sure?" text is weaker than explicit choices like `Carry forward from milestone summary`, `Start fresh reset`, `Overwrite listed starter docs`, or `Stop without writing`.
- Automation-bias research adds a subtle risk: the human reviewer can become a rubber stamp when verification is cognitively expensive. Confirmation gates should reduce verification load with side-by-side evidence and concise previews, not just ask for approval after dense prose.
- Trust-calibration experiments suggest confidence/explanation alone is insufficient. Users need structured checks and enough domain evidence to make a good decision; for `/blu-new-milestone`, that means showing digest provenance, current starter-doc state, and exactly what will change.

#### Blueprint Implications

- The current blocked/waiting states are the right risk boundary: `missing-milestone-summary`, `carry-forward-confirmation`, and `starter-doc-overwrite-confirmation` should remain explicit stops rather than soft warnings hidden in prose.
- Fresh reset should remain opt-in. It should require explicit user intent because it chooses not to use the normal carry-forward memory path; the prompt should state that historical phase directories and numbering history are preserved while starter planning context begins from a clean milestone seed.
- Carry-forward confirmation should be evidence-backed. The command should show the milestone summary source, `inputsUsed`, missing/skipped inputs, carry-forward candidates, discarded or uncertain items, and the proposed first new phase before asking the user to proceed.
- Starter-doc overwrite confirmation should be path-specific. The user should see the exact starter artifacts that already exist, whether each would be created, reused, overwritten, or skipped, and why replacement is needed.
- The safe default should be "do not write yet" whenever intent is ambiguous, summary evidence is missing, or existing starter docs would be replaced. This matches both UX confirmation guidance and the product's current waiting-state model.
- Confirmation copy should calibrate trust by saying what Blueprint knows and does not know. For example: "Using saved milestone summary and these inputs" is better than "I know what should carry forward"; "starter scaffold is not final authored content" should remain visible near overwrite and reset decisions.
- The workflow should avoid adding new low-value confirmations. Extra gates should map to distinct risk classes: missing carry-forward evidence, fresh reset, and overwriting existing starter docs. Routine reads, route previews, and scaffold creations into missing files can be acknowledged without asking.
- Human approval should be tied to structured receipts in future implementation. A later source change can record `gateId`, `decision`, `approvedMode`, `approvedPaths`, `inputsUsed`, `safeDefault`, and `nextRoute` so docs/tests can verify that the gate was not bypassed.
- Waiting states should provide manual-control fallbacks: run or regenerate milestone summary, choose carry-forward with listed caveats, choose fresh reset explicitly, overwrite only named starter docs, or stop without mutation.

#### Concrete Improvement Ideas

- Add a confirmation-gate table to the future `/blu-new-milestone` contract with columns for `gateId`, `trigger`, `risk`, `requiredUserIntent`, `safeDefault`, `mustShowEvidence`, `allowedChoices`, and `postConfirmationReceipt`.
- Define three durable gate IDs: `missing-milestone-summary`, `carry-forward-confirmation`, and `starter-doc-overwrite-confirmation`. Do not introduce generic `confirm` or `are-you-sure` states.
- For `carry-forward-confirmation`, require a compact preview that includes source milestone summary path, digest `inputsUsed`, proposed milestone name, proposed first phase number, carry-forward bullets, uncertainty bullets, and the safe alternative.
- For `fresh reset`, require the user to choose an explicit action label such as `Start fresh milestone reset`; do not infer reset intent from vague dissatisfaction with the previous milestone.
- For `starter-doc-overwrite-confirmation`, require a per-path operation list before the write: `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, `.blueprint/ROADMAP.md`, `.blueprint/phases/`, and first `NN-CONTEXT.md`.
- Use stronger friction only for non-empty starter-doc replacement. A future CLI prompt could ask the user to name the affected paths or reply with a specific phrase such as `overwrite starter docs`; avoid type-to-confirm friction for ordinary missing-file scaffolds.
- Add a short approval receipt to the user-visible completion output: selected mode, approved overwrite paths, summary inputs used, first phase route, and confirmation gates satisfied.
- Add negative-path tests for confirmation fatigue and bypass risk: ambiguous reset request does not reset, missing summary does not silently carry forward, existing starter docs are not overwritten without path-specific approval, and unrelated confirmations are not introduced.
- Keep confirmation language neutral and action-specific. Avoid blame, alarmist wording, or compliance theater; the gate should help the user make the right choice, not scare them into a default.

#### Risks And Open Questions

- Confirmation fatigue risk: adding more prompts than the current three risk gates would weaken safety by training users to approve mechanically.
- Under-confirmation risk: treating fresh reset or overwrite as ordinary scaffold behavior could erase useful context or replace hand-authored starter docs without meaningful intent.
- Rubber-stamp risk: if the preview is too long, the user may approve without verification. The preview must reduce cognitive load by showing only decision-critical evidence with optional detail below it.
- Schema churn risk: approval receipts are valuable, but adding durable fields affects runtime docs, tests, and MCP result contracts. Future implementation should land docs, runtime metadata, and tests together.
- Compliance overreach risk: EU high-risk AI obligations are useful design analogies, not a claim that `/blu-new-milestone` is legally high-risk. Keep the implication to human oversight patterns and risk-proportionate controls.
- Manual-control risk: shifting too much responsibility to the user can make the workflow feel less helpful. The command should present a recommended safe path while preserving explicit alternatives.

### R4 Requirements Traceability And Evidence Ledgers

Owner: R4.

Status: researched.

#### Source URLs

- ISO/IEC/IEEE 29148:2018 requirements engineering standard landing page: https://www.iso.org/standard/72089.html
- INCOSE Guide to Writing Requirements V4 summary sheet: https://www.incose.org/docs/default-source/working-groups/requirements-wg/guidetowritingrequirements/incose_rwg_gtwr_v4_summary_sheet.pdf?sfvrsn=73644bc7_2
- NASA Systems Engineering Handbook, 6.2 Requirements Management: https://www.nasa.gov/reference/6-2-requirements-management/
- NASA Software Engineering Handbook, SWE-047 Traceability Data: https://swehb.nasa.gov/spaces/7150/pages/16449982/SWE-047%2B-%2BTraceability%2BData
- NASA Software Engineering Handbook, SWE-053 Manage Requirements Changes: https://swehb.nasa.gov/pages/viewpage.action?pageId=43057826
- NASA Systems Engineering Handbook, 6.5 Configuration Management: https://www.nasa.gov/reference/6-5-configuration-management/
- NASA SMA, Identifying Objective Evidence Improves Requirement Implementation: https://sma.nasa.gov/news/articles/newsitem/2026/03/25/identifying-objective-evidence-improves-requirement-implementation
- W3C PROV-DM Recommendation: https://www.w3.org/TR/prov-dm/
- SLSA Provenance v1.1: https://slsa.dev/spec/v1.1/provenance
- NIST SP 800-218 SSDF project page: https://csrc.nist.gov/projects/ssdf
- NIST SP 800-218 PDF: https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=934124
- NIST SP 800-53 Rev. 5 landing page: https://csrc.nist.gov/Pubs/sp/800/53/r5/upd1/Final
- Gotel and Finkelstein, "An Analysis of the Requirements Traceability Problem": https://discovery.ucl.ac.uk/id/eprint/749/
- "Grand Challenges of Traceability: The Next Ten Years": https://arxiv.org/abs/1710.03129
- SEBoK Configuration Baselines: https://sebokwiki.org/wiki/Configuration_Baselines

#### Key Findings

- Authoritative requirements guidance treats traceability as lifecycle-wide, bidirectional, and baseline-aware. NASA requires links from stakeholder expectations through technical requirements, design, and test plans/procedures; SWE-047 extends this to higher-level requirements, design, code, and test procedures. INCOSE's public summary names minimum requirement attributes such as rationale, trace to parent, trace to source, unique identifier, owner, verification status, implementation status, priority, criticality, and risk. ISO/IEC/IEEE 29148 is the governing standard family for requirements processes and required information items; the public page confirms scope, but the detailed clauses are not fully visible without the paid standard.
- Traceability is not just "what documents were read." NASA guidance asks reviewers to find holes, missing parents, unsupported functionality, stale traces, and impact of changes. For Blueprint, `inputsUsed` is a useful evidence scope for the digest, but it does not by itself prove that every carried, modified, deferred, or retired requirement is linked to a specific source and decision.
- Requirement changes and deferrals should behave like configuration-managed change items. NASA SWE-053 says requirement changes should be collected, analyzed for cost/technical/schedule impact, versioned, and tied to who changed what, when, and why. NASA CM guidance adds status accounting for proposed changes, deviations, waivers, discrepancies, actions, rationale, audit results, and historical traceability. A deferred requirement is therefore not "not copied"; it needs disposition, rationale, revisit trigger, and risk/evidence.
- Evidence should be objective and inspectable. NASA SMA examples include verification artifacts, traceability matrices, review logs, risk logs, resolution reports, meeting follow-ups, metrics, and checklists. The practical lesson for `/blu-new-milestone` is that carry-forward output should preserve references to concrete artifacts and decision evidence, not only natural-language milestone summaries.
- Provenance specs provide a good mental model for milestone transition metadata. W3C PROV distinguishes entities, activities, agents, generation, usage, derivation, attribution, and bundles. Blueprint can use this vocabulary without serializing full PROV: old artifacts and requirements are entities, `/blu-new-milestone` is the activity, the user/agent/tool are agents, new PROJECT/REQUIREMENTS/ROADMAP/context are generated entities, and each carried or deferred requirement is derived from explicit sources.
- SLSA and NIST SSDF show a modern software-provenance pattern: archive supporting data for releases, protect provenance integrity, make provenance available in standards-based formats where practical, and update provenance when components change. A Blueprint milestone boundary is not a software supply-chain build, but the analogy is strong: the new milestone should have a compact, verifiable provenance receipt for the planning artifacts it regenerated.
- Traceability research warns against over-focusing on downstream links. Gotel and Finkelstein separate pre-requirements-specification traceability from post-specification traceability and identify missing source/rationale capture as a hard problem. The "Grand Challenges" paper argues traceability should be built into engineering practice and become low-friction. For Blueprint, the transition moment is the cheapest point to capture source/rationale before context is compressed away.

#### Blueprint Implications

- The current `/blu-new-milestone` behavior already has an important source-boundary primitive: `blueprint_artifact_summary_digest.inputsUsed` records which files fed the carry-forward seed. Future work should keep that as the top-level evidence scope and add requirement-level trace rows under it.
- Regenerating `.blueprint/REQUIREMENTS.md` is the highest-risk traceability surface. If old requirement text is copied, modified, summarized, deferred, or retired without a row-level transition decision, later phases cannot reliably tell whether a requirement was intentionally changed or accidentally lost.
- Preserving historical phase artifacts is necessary but insufficient. The new milestone should be able to point back to old phase contexts, plans, summaries, validations, reviews, and milestone reports as evidence references, without moving or rewriting those historical artifacts.
- First-phase context should receive a compact handoff from the transition ledger. `/blu-discuss-phase <first phase>` should know which carried requirements are active now, which are deferred, which were retired, and where the evidence lives.
- A self-derived or newly introduced requirement should be explicit. NASA guidance treats unsupported child requirements as potential gold plating unless they have acceptable self-derived rationale and concurrence; Blueprint should make "new/self-derived" a visible decision, not a silent addition during regeneration.

#### Concrete Improvement Ideas

- Add a future "Milestone Requirements Transition Ledger" to the `/blu-new-milestone` contract. It can live in the regenerated REQUIREMENTS artifact or in a linked report section, but it should be generated from the same digest scope. Suggested columns: `previousRequirementId`, `previousTextDigest`, `transitionDecision` (`carried`, `modified`, `deferred`, `retired`, `new`, `self-derived`), `newRequirementId`, `sourceRefs`, `evidenceRefs`, `rationale`, `ownerOrAgent`, `verificationStatus`, `riskOrCriticality`, `deferredUntilOrExitCriterion`, and `uncertainty`.
- Add a "Deferred Requirements Ledger" subsection for requirements not entering the active milestone. Minimum fields: stable requirement ID or source text digest, defer reason, target milestone/phase or revisit trigger, blocking dependency, risk of deferral, evidence source, and confirmation status. This prevents deferred items from evaporating across milestone boundaries.
- Treat `inputsUsed` as a provenance header, not the whole ledger. Each transition row should reference at least one source within `inputsUsed`; rows with evidence outside the digest should be flagged because the digest no longer represents the full evidence scope.
- Add future validation checks for orphaned transitions: carried requirement with no source, modified requirement with no rationale, retired requirement with no disposition reason, deferred requirement with no revisit trigger, new/self-derived requirement with no rationale, active requirement with no verification strategy/status, and source artifact referenced by a row but absent from `inputsUsed`.
- Add a compact completion receipt after regeneration: counts for carried/modified/deferred/retired/new requirements, count of rows with missing evidence, digest input count, and next action for the first phase. This mirrors audit/status-accounting guidance while staying lightweight for the user.
- Use provenance-style names in internal metadata and docs only where they clarify behavior: `usedSources`, `generatedArtifacts`, `derivedFrom`, `attributedTo`, `decisionActivity`, and `evidenceBundle`. Avoid requiring full W3C PROV serialization unless a later implementation plan finds a concrete consumer.
- Preserve stable IDs when semantics are unchanged; create a new ID and legacy link when semantics materially change. This avoids false continuity while still preserving audit history.
- When optional roadmapper assistance is used, require its handoff to output candidate transition decisions with confidence/uncertainty, but keep final transition decisions in the deterministic command/tool-owned artifact path.

#### Risks And Open Questions

- A transition ledger can become too heavy for ordinary projects. The future design should start with a compact minimum row set and allow richer fields only when evidence exists.
- Automated trace suggestions can be confidently wrong. Any model-generated carry/modify/defer decision should expose uncertainty and require user-visible confirmation for ambiguous or high-impact decisions.
- Requirement IDs can create false precision if regenerated text changes meaning. The plan should distinguish "same ID, unchanged semantics" from "new ID derived from old ID."
- Digest scope can be over-trusted. `inputsUsed` proves which inputs were summarized; it does not prove row-level coverage, correctness, or completeness.
- Historical artifact references may become noisy or brittle if they rely on line numbers in mutable files. Prefer stable artifact paths plus requirement IDs, section anchors, text digests, or explicit evidence labels where available.
- Adding ledger sections to REQUIREMENTS, ROADMAP, or phase context will touch artifact contracts and tests in a later implementation pass. This research section only proposes the future direction; it does not authorize source, schema, command, skill, or `.blueprint` changes in this docs-only run.

### R5 Structured Tool Contracts, MCP, And Typed State Transitions

Owner: R5 research lane.

Status: complete.

#### Source URLs

- Model Context Protocol, latest spec overview: https://modelcontextprotocol.io/specification/2025-11-25/basic
- Model Context Protocol, latest tools spec: https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- Model Context Protocol, latest resources spec: https://modelcontextprotocol.io/specification/2025-11-25/server/resources
- Model Context Protocol, lifecycle and capability negotiation: https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle
- OpenAI API structured outputs guide: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI API function calling guide: https://developers.openai.com/api/docs/guides/function-calling
- Anthropic Claude tool definition docs: https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
- Anthropic Claude fine-grained tool streaming docs: https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming
- Google Gemini API function calling docs: https://ai.google.dev/gemini-api/docs/function-calling
- Google Gemini API structured output docs: https://ai.google.dev/gemini-api/docs/structured-output
- JSON Schema 2020-12 core: https://json-schema.org/draft/2020-12/json-schema-core
- JSON Schema 2020-12 validation: https://json-schema.org/draft/2020-12/json-schema-validation
- OpenAPI Specification 3.1.1: https://spec.openapis.org/oas/v3.1.1.html

#### Key Findings

- MCP's current spec separates concerns cleanly: the base protocol is JSON-RPC, lifecycle handles capability negotiation and session state, server features expose resources/tools/prompts, and optional capabilities are negotiated rather than assumed. For `/blu-new-milestone`, that supports the existing rule that command text should stay thin while MCP tools own structured reads and writes.
- MCP tools are model-invocable actions with `inputSchema` and optional `outputSchema`; structured results live in `structuredContent`, while `content` may carry human-readable or compatibility text. The latest tools spec says servers with an output schema must return structured results conforming to that schema and clients should validate those results. This is directly relevant to `roadmap_read`, `artifact_contract_read`, `artifact_summary_digest`, `config_get`, `artifact_scaffold`, and `state_update`.
- MCP resources are for exposing contextual data by URI, not for asking the model to mutate state. This reinforces the boundary that command/runtime-contract resources can explain the workflow, while persistence stays in explicit tools.
- MCP error handling distinguishes protocol errors from tool execution errors. Business-rule failures such as missing milestone summary, carry-forward confirmation, starter overwrite confirmation, or invalid state transition should be visible as structured tool results or typed blocked statuses rather than buried in prose.
- OpenAI's tool/function guidance and Gemini's function-calling guidance both treat schema-backed function calls as the right pattern when the model needs the application to perform an action. OpenAI additionally recommends strict mode for reliable schema adherence and notes that parallel tool calls can weaken strictness in some cases.
- Gemini's structured-output docs separate final response formatting from function calling: structured outputs are for final formatted answers, function calling is for actions. Since `/blu-new-milestone` is a persistent-state workflow, its future improvements should favor MCP tool contracts over asking the model to emit free-form JSON for later parsing.
- Anthropic's tool docs emphasize detailed tool descriptions, schema-backed inputs, validated examples, high-signal stable identifiers, and compact tool responses. This maps well to Blueprint's need for predictable milestone/phase IDs, digest provenance, and scaffold/state-update receipts.
- Anthropic's fine-grained streaming docs warn that streamed tool parameters can be partial or invalid JSON until fully accumulated. Blueprint should not rely on partial model-emitted structures for persistence decisions; state-changing calls should execute only after complete validated arguments are available.
- JSON Schema 2020-12 is the common contract language across MCP and modern tool-calling APIs, but provider support is often a subset. OpenAPI 3.1 aligns its Schema Object with JSON Schema vocabulary concepts, while Gemini explicitly says only a subset of JSON Schema is supported for structured output. Blueprint should keep schemas simple, object-rooted, and runtime-validated rather than relying on every provider to enforce every keyword.

#### Blueprint Implications

- The current tool set is directionally right: `/blu-new-milestone` should keep all persistent mutations inside `artifact_scaffold` and `state_update`, and all durable read/context inputs inside `roadmap_read`, `artifact_contract_read`, `artifact_summary_digest`, and `config_get`.
- The weak spot is not the high-level boundary; it is contract granularity. Today the command can tell the model what to do, but future work should make each persistence step return a typed receipt that downstream prompts, docs, and tests can assert against.
- `state_update` should be treated as a typed state transition API, not a generic markdown write helper. Its inputs and outputs should make the allowed transition explicit: previous active command/state, new active command, milestone name, first phase number, route target, and blocked/waiting reason when no transition happened.
- `artifact_scaffold` should return a deterministic scaffold receipt with created/reused/overwritten flags per path, starter-doc overwrite gate results, and the exact first phase context path. The command should not infer those facts from text.
- `artifact_summary_digest` should be the authoritative carry-forward input boundary. Its receipt should preserve `inputsUsed`, missing/skipped inputs, digest length/shape metadata, and warnings so the model can explain gaps without inventing historical continuity.
- `artifact_contract_read` should remain read-only and should be used to constrain authoring shape, not as a persistence path. If a future contract adds milestone starter-doc schemas, the scaffold/write tools still need to own creation and validation.
- A future implementation should keep `content` and `structuredContent` aligned for MCP-facing responses. Human-readable summaries are useful, but tests and follow-on command behavior should depend on `structuredContent` fields.

#### Concrete Improvement Ideas

- Add a documented `NewMilestoneStateTransition` shape for `/blu-new-milestone` planning, covering `mode` (`carry-forward` or `fresh-reset`), `fromMilestone`, `toMilestone`, `firstPhaseNumber`, `routeTarget`, `status`, `blockedReason`, and `confirmationRequired`.
- Extend the `state_update` runtime contract for this command with a milestone-start receipt: `previousState`, `nextState`, `activeCommand`, `activePhase`, `activeMilestone`, `routeNext`, `blockedReason`, and `warnings`.
- Extend the `artifact_scaffold` receipt contract in docs/tests to include per-artifact operations for `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, phase directory creation, and first `NN-CONTEXT.md`, using stable statuses such as `created`, `reused`, `overwritten`, `skipped`, and `blocked`.
- Define a small carry-forward digest receipt table in the command/spec docs: `inputsUsed`, `inputsMissing`, `inputsSkipped`, `summaryFound`, `contextContractsFound`, `digestWarnings`, and `authoringImplications`.
- Add a no-freeform-persistence rule to the `/blu-new-milestone` contract: model-authored prose may propose milestone content, but only schema-backed MCP tool calls can create scaffold files or update `STATE.md`.
- Add tests that assert machine-readable receipts, not just prose: one carry-forward success, one missing milestone-summary blocked result, one starter-doc overwrite confirmation block, and one fresh-reset success.
- Keep tool schema complexity intentionally boring: object roots, explicit required fields, enums for modes/statuses, `additionalProperties: false` where supported by local validation, and application-side validation even if a provider claims schema adherence.
- If future MCP resources are added for `/blu-new-milestone`, use them only for read-only runtime-contract or artifact-contract discovery. Do not move roadmap/state mutation into resources.

#### Risks And Open Questions

- Schema portability risk: MCP defaults to JSON Schema 2020-12, OpenAPI 3.1 aligns with JSON Schema concepts, and model providers support different subsets. Blueprint should validate locally with its TypeScript/Zod/runtime validators and keep schemas conservative.
- Contract drift risk: adding richer receipts without updating command docs, runtime metadata, and tests together would create a new mismatch surface. Future implementation should treat manifest, skill, docs, MCP tool docs, and tests as one contract set.
- Over-typing risk: if every internal authoring detail becomes a schema field, `/blu-new-milestone` could become harder to evolve. Prefer stable workflow facts and receipts over modeling the full prose content of starter docs.
- Resource/tool boundary risk: exposing mutable-looking resources or asking the model to treat resource text as state can blur ownership. Keep resources descriptive/read-only and tools authoritative for mutation.
- Parallel/concurrent call risk: providers document parallel or streamed tool-call behaviors that can weaken strict guarantees or produce partial inputs. Blueprint should keep persistent state updates sequenced and validated after complete tool arguments are available.
- User-confirmation risk: structured receipts should not bypass human confirmation. The typed state should preserve confirmation-required statuses rather than treating them as recoverable model errors.

### R6 Agent Handoff, Subagent Boundaries, And Delegation Quality

Owner: R6 research lane.

Status: complete.

#### Source URLs

- OpenAI Agents SDK handoffs: https://openai.github.io/openai-agents-python/handoffs/
- OpenAI Agents SDK multi-agent patterns: https://openai.github.io/openai-agents-python/agents/#multi-agent-system-design-patterns
- OpenAI practical guide to building agents: https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
- Anthropic, Building Effective Agents: https://www.anthropic.com/engineering/building-effective-agents
- Anthropic, How We Built Our Multi-Agent Research System: https://www.anthropic.com/engineering/multi-agent-research-system
- Anthropic, Demystifying Evals For AI Agents: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- Google Agent Development Kit multi-agent systems: https://adk.dev/agents/multi-agents/
- Google Gemini API structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
- LangChain handoffs documentation: https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs
- Microsoft AutoGen Swarm handoffs: https://microsoft.github.io/autogen/0.7.3/user-guide/agentchat-user-guide/swarm.html
- AutoGen paper: https://arxiv.org/abs/2308.08155
- MetaGPT paper: https://arxiv.org/abs/2308.00352
- Intention propagation for multi-agent coordination: https://arxiv.org/abs/2407.12532

#### Key Findings

- Frontier agent frameworks split delegation into two different patterns: manager/worker, where the parent invokes specialists as tools and keeps control, and true handoff, where a peer specialist takes over the conversation. OpenAI's docs name both patterns explicitly, and its practical guide says the manager pattern fits workflows where one agent should keep workflow control and user access.
- OpenAI's handoff primitive treats handoffs as tools and supports structured handoff metadata through `input_type`, callbacks, enabled gates, and input filters. The useful lesson for Blueprint is not to transfer control, but to make delegation packets typed, small, and auditable.
- LangChain's handoff docs emphasize state-driven transitions and warn that multi-agent subgraphs require explicit context engineering because the designer must decide which messages cross the boundary. This maps directly to `/blu-new-milestone`: the roadmapper should receive a curated digest and constraints, not the entire command conversation.
- Anthropic's agent-pattern guidance favors simple, composable workflows and recommends orchestrator-workers only when subtasks are not known in advance. Their multi-agent research writeup says subagents need an objective, output format, tool/source guidance, and clear task boundaries; vague instructions caused duplicated work and gaps.
- Anthropic also reports that multi-agent research systems can perform well on breadth-first, parallel research, but can use much more token budget and are a poor fit for domains with high dependency coupling or shared-context requirements. `/blu-new-milestone` is therefore a selective optional-agent use case, not a default multi-agent workflow.
- Google ADK frames multi-agent systems as hierarchy plus workflow agents, with parent-child scope and structured control flow. That supports Blueprint's current boundary: `blueprint-roadmapper` may propose grouped phase structure, but the parent command remains the supervisor and owns final phase numbers, confirmation gates, and MCP writes.
- Gemini structured outputs now support JSON Schema style response shaping for agentic workflows and tool/API inputs, while still requiring application-side validation for semantic correctness. A future roadmapper packet should be conservative and locally validated rather than trusting prompt prose or provider schema claims alone.
- AutoGen and AutoGen's Swarm docs show both programmable multi-agent conversations and capability-based peer handoffs. MetaGPT and intention-propagation research point in the same direction: coordination improves when roles, SOPs, goals, and intended subtasks are explicit, and degrades when agent messages are loose role-play.
- Anthropic's agent-eval guidance is important for no-subagent parity: evaluate both final outcomes and traces/tool calls. For Blueprint, parity is not "the prose sounds similar"; it is whether the inline fallback used the same evidence scope, reached the same confirmation posture, preserved the same write boundary, and produced equivalent starter-scope decisions.

#### Blueprint Implications

- Keep `/blu-new-milestone` terminology closer to "bounded roadmapper pass" or "manager/worker delegation" than "handoff." A true handoff would imply the specialist can own the next turn or user interaction, which conflicts with the current rule that the parent owns final phase numbers and the MCP write path.
- Treat the roadmapper invocation as a typed packet from parent to worker. Minimum packet fields should include current milestone, proposed next milestone name or naming constraints, digest `inputsUsed`, summarized carry-forward facts, next whole-number phase preview, hard boundaries, allowed reads, forbidden actions, expected output shape, and stop conditions.
- Require the roadmapper to return provisional ordered phase proposals without permanent phase numbers, plus objective, covered requirement or gap set, dependency notes, 2-5 success criteria, blockers, warnings, unresolved assumptions, and confidence. The parent command then maps these proposals onto the confirmed next phase number and scaffold paths.
- Preserve the existing no-subagent fallback as a first-class execution mode. The fallback should run the same packet contract inline, one carry-forward unit at a time, and compress after each unit into retained intent, starter-scope decisions, unresolved assumptions, and evidence scope.
- Make the config gate visible in the command contract: roadmapper use requires both the runtime contract and effective `workflow.subagents=true`. If disabled or unnecessary, the command should say the roadmapper pass was skipped and continue with the parity fallback instead of substituting browser, web search, shell-only, or generic helpers.
- Keep all durable state authority on MCP tools. The worker can shape recommendations; it cannot decide overwrite confirmation, mutate `.blueprint/`, call scaffold/state tools, browse for replacement evidence, or silently reset carry-forward mode.
- Use the returned `inputsUsed` from `blueprint_artifact_summary_digest` as the evidence boundary for both subagent and inline modes. This prevents the worker from smuggling in untracked context and gives later tests a concrete parity anchor.

#### Concrete Improvement Ideas

- Add a `Roadmapper Delegation Packet` subsection to the future `/blu-new-milestone` command and roadmap-admin skill text. Make it copy-paste concrete: `mode`, `currentMilestone`, `candidateMilestoneName`, `digestInputsUsed`, `carryForwardSummary`, `nextPhaseNumberPreview`, `mustPreserve`, `forbiddenActions`, `expectedOutput`, and `stopIf`.
- Add a matching `Roadmapper Response Contract` to `agents/blueprint-roadmapper.md`: ordered proposals only, no permanent phase numbers, no direct writes, no browser/web-search/shell substitutes, blockers before warnings, assumptions explicitly labeled, and coverage notes that the parent can turn into starter scaffold seed text.
- Add a short parent-side checklist before any optional roadmapper pass: config read completed, milestone-summary digest completed, phase number preview computed, overwrite/reset confirmation state known, and no pending user gate that the worker would be tempted to answer itself.
- Add a no-subagent parity checklist beside the existing fallback rule: process one synthesis unit, record retained intent, starter-scope decision, evidence scope, assumptions, and warnings, then continue until the same response contract can be filled without the worker.
- Add targeted future tests that assert: `workflow.subagents=false` still follows the no-subagent fallback, roadmapper instructions forbid final phase numbering and MCP writes, command text keeps `blueprint_config_get` before roadmapper use, and docs/tests reject browser-only, web-search-only, shell-only, or generic helper substitutions.
- Add a completion receipt field in command-facing prose or runtime metadata for `roadmapperMode`: `used`, `skipped-disabled`, `skipped-unnecessary`, or `unavailable-fallback`. This would make support/debugging clearer without turning the command into a long-running progress flow.

#### Risks And Open Questions

- Wording risk: calling the worker interaction a "handoff" may mislead future implementors into transferring control. Prefer "delegation packet" or "bounded roadmapper pass" in production-facing text.
- Over-orchestration risk: adding too much roadmapper ceremony could make `/blu-new-milestone` feel like a long-running planning command. Keep it to one optional bounded pass or the inline parity fallback.
- Context-bloat risk: passing full roadmap, reports, and command history can reduce quality and blur authority. Pass the digest, `inputsUsed`, constraints, and only the roadmap facts needed for grouping.
- Prompt-only schema risk: structured packet language in prompts is useful, but without tests or runtime validation it can drift. Future implementation should pair prompt contract changes with metadata/doc/test parity.
- Fallback drift risk: the subagent path may become richer than the inline path over time. Tests should verify behavior classes and evidence boundaries, not only that the fallback paragraph exists.
- External-context risk: frontier sources praise research agents and web exploration, but Blueprint's roadmapper must not invent outside context during `/blu-new-milestone`. Outside material belongs only in future planning docs or parent-approved briefs, not runtime carry-forward truth.

### R7 Milestone Retrospectives, Carry-Forward Reports, And Learning Loops

Owner: Codex R7 research lane.

Status: complete.

#### Source URLs

- Scrum Guide 2020, Sprint Retrospective: https://scrumguides.org/scrum-guide.html
- Agile Alliance, Heartbeat Retrospective: https://agilealliance.org/glossary/heartbeat-retrospective/
- Agile Alliance, Milestone Retrospective: https://agilealliance.org/glossary/milestone-retrospective/
- PMI and Agile Alliance, Agile Practice Guide: https://www.agilealliance.org/wp-content/uploads/2021/02/AgilePracticeGuide.pdf
- Google SRE Book, Postmortem Culture: https://sre.google/sre-book/postmortem-culture/
- Google SRE Workbook, Postmortem Culture: https://sre.google/workbook/postmortem-culture/
- Google SRE Incident Management Guide: https://sre.google/resources/practices-and-processes/incident-management-guide/
- Google SRE Workbook, Results of Postmortem Analysis: https://sre.google/workbook/postmortem-analysis/
- DORA, Learning Culture capability: https://dora.dev/capabilities/learning-culture/
- Google Cloud, 2025 DORA State of AI-assisted Software Development report landing page: https://cloud.google.com/resources/content/2025-dora-ai-assisted-software-development-report
- NASA Lessons Learned: https://www.nasa.gov/nasa-lessons-learned/
- NIST SP 800-61 Rev. 3, Incident Response Recommendations and Considerations: https://csrc.nist.gov/pubs/sp/800/61/r3/final

#### Key Findings

- Scrum treats retrospectives as the closing inspect-and-adapt step: inspect people, interactions, processes, tools, quality practices, and assumptions; identify the most helpful improvements; and address the most impactful changes as soon as possible. For Blueprint, the relevant pattern is not Scrum ceremony, but a clear transition from "what happened" to "what should change next."
- Agile Alliance distinguishes heartbeat retrospectives from milestone retrospectives. Milestone retrospectives are broader and more strategic: they may examine project viability, working relationships, and governance concerns, not just local iteration tactics. This maps well to `/blu-new-milestone`, which is a boundary-crossing workflow rather than a normal phase-planning command.
- The PMI/Agile Alliance Agile Practice Guide says teams can retrospect at release, stuck-flow, elapsed-time, or milestone moments; it also emphasizes qualitative and quantitative data, root causes, countermeasures, action plans, limited action-item capacity, and measuring whether selected improvements worked in the next period.
- Google SRE postmortem guidance is explicit that learning needs a written record, review, broad sharing, and follow-up. Good postmortems include impact, mitigation, root causes, contributing factors, action items, ownership, priority, and tracking. Unreviewed or untracked postmortems become dead documents.
- Google SRE also pushes trend analysis across many postmortems: consistent metadata enables teams to identify repeated triggers and systemic root-cause categories. This is a frontier lesson for Blueprint carry-forward: the milestone summary is necessary, but a small structured learning ledger would make recurring workflow problems visible across milestones.
- DORA frames learning culture as a performance capability: organizations improve when learning is treated as strategic, failure is safe to examine, blameless postmortems are normal, and there are regular spaces for sharing knowledge. The transferable point is that carry-forward should preserve learning in a non-punitive way, not turn the previous milestone into an audit of individual mistakes.
- NASA's Lessons Learned system models durable institutional memory: reviewed lessons are indexed for retrieval, include the driving event and recommendations, and feed continual improvement through training, best practices, policies, and procedures. Blueprint should preserve historical evidence while extracting only decision-useful next-cycle recommendations.
- NIST SP 800-61 Rev. 3 modernizes incident learning from a single post-incident phase into continuous improvement across the lifecycle. Lessons should often be shared as soon as they are identified, then analyzed, prioritized, and used to adjust policies, processes, and practices. For Blueprint, this argues against waiting for `/blu-new-milestone` to discover all lessons from scratch.
- Current `/blu-new-milestone` scope is directionally aligned with the sources: it consumes the saved milestone summary after audit, completion, and summary reports exist; uses that as the default carry-forward input; starts the next milestone; and does not delete historical evidence.

#### Blueprint Implications

- `/blu-new-milestone` should treat the milestone summary as the default carry-forward report, not as a generic memory dump. It should extract the few lessons that matter for next-cycle decisions while preserving old phase directories, audit reports, completion evidence, and summary reports as the historical record.
- The future carry-forward preview should separate four categories: `validatedLessons`, `improvementActions`, `deferredOrOpenQuestions`, and `doNotCarryForward`. That distinction keeps durable learning from being mixed with unresolved guesses or stale noise.
- A retrospective/carry-forward section should stay blameless and system-focused. For Blueprint, "why did this milestone hurt?" should become "which workflow contract, validation gate, documentation surface, or handoff shape needs adjustment?" rather than blame on a prior agent or user choice.
- Improvement actions should be small enough to fit the next planning cycle. The sources warn that too many action items weaken follow-through; `/blu-new-milestone` should seed a small, prioritized learning backlog rather than dump every retrospective observation into `REQUIREMENTS.md`.
- Lessons should be evidence-backed. Each carry-forward lesson should point back to the milestone summary and, when available, the audit, completion, or validation artifact that made the lesson credible. `inputsUsed` remains the top-level source boundary, but lesson-level source pointers would make downstream discussion safer.
- Carry-forward reports should include outcome checks, not only facts. The next milestone seed should ask whether the previous improvement actually worked, how the team will know if a new improvement succeeds, and where the result should be revisited during `/blu-discuss-phase`.
- Broad sharing maps to Blueprint as discoverability inside `.blueprint/`, not host-global state. The learning should be present in starter docs or metadata that the next command reads, while raw evidence stays in project-local historical artifacts.

#### Concrete Improvement Ideas

- Add a compact `Milestone Learning Loop` block to the future carry-forward seed:
  - `validatedLessons`: 3 to 5 lessons that are backed by milestone-summary evidence.
  - `systemImprovements`: 1 to 3 changes worth considering in the next milestone.
  - `evidencePointers`: source artifact paths or headings for each lesson.
  - `successSignals`: how the next cycle can tell whether the improvement helped.
  - `deferredLearning`: useful observations that should not steer the first phase yet.
  - `doNotCarryForward`: stale assumptions, closed risks, or superseded decisions.
- Add a `retrospectiveAction` shape for candidate improvements: `action`, `why`, `source`, `ownerSurface` such as command, skill, MCP tool, docs, tests, or user workflow, `priority`, `nextReviewPoint`, and `doneOrLearningSignal`.
- Extend the carry-forward confirmation preview with a learning summary: top lessons kept, top actions proposed, dropped/stale items, and uncertain lessons. This should remain a preview, not a new confirmation gate.
- Ask `blueprint-roadmapper`, when used, to group learning actions separately from product/workflow deliverables. It may propose sequencing, but the parent command should decide what becomes starter roadmap text.
- Add prompt-contract wording that retrospective lessons are system-level and evidence-scoped. Avoid wording like "the team failed to"; prefer "the workflow allowed", "the artifact did not show", or "the handoff lost".
- Add future tests or doc-contract checks that `/blu-new-milestone` preserves historical evidence, defaults to milestone-summary carry-forward, surfaces `inputsUsed`, includes a small learning loop when evidence exists, and does not invent lessons when summary evidence is absent.
- Consider a later milestone-summary enhancement that emits structured lesson metadata during `/blu-milestone-summary`, so `/blu-new-milestone` consumes already-reviewed lessons instead of re-inferencing them at transition time.

#### Risks And Open Questions

- Risk: retrospective structure could turn a bounded new-milestone command into a long postmortem workflow. Mitigation: make `/blu-milestone-summary` own deep synthesis and let `/blu-new-milestone` only carry forward a compact reviewed subset.
- Risk: action-item overload could pollute the starter roadmap. Mitigation: cap proposed learning actions and defer the rest to evidence pointers or later discuss-phase refinement.
- Risk: blameless language could become vague and avoid real causes. Mitigation: require system-level causes and concrete artifact or workflow evidence while avoiding personal blame.
- Risk: treating incident postmortem practices as a direct fit could overemphasize failures. Mitigation: translate SRE/NIST guidance by analogy: milestones need learning loops for successes, surprises, deferred risks, and process improvements, not only incidents.
- Risk: lesson ledgers could duplicate `milestone-summary`. Mitigation: store only next-cycle decision inputs in the seed and preserve source paths for full context.
- Risk: structured learning fields could imply runtime guarantees before implementation exists. Mitigation: keep this as future contract guidance until command docs, runtime metadata, and tests are changed together.
- Open question: should structured learning be generated by `/blu-milestone-summary` as reviewed source material, by `/blu-new-milestone` during carry-forward, or by both with clear ownership boundaries?

### R8 Failure Recovery, Idempotency, And Partial-Write Safety

Owner: R8 research lane.

Status: complete.

#### Source URLs

- AWS Builders' Library, "Making retries safe with idempotent APIs": https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
- AWS Builders' Library, "Timeouts, retries, and backoff with jitter": https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/
- AWS Durable Execution SDK, "Idempotency and retries": https://docs.aws.amazon.com/durable-execution/patterns/best-practices/idempotency/
- AWS Lambda durable functions idempotency: https://docs.aws.amazon.com/lambda/latest/dg/durable-execution-idempotency.html
- Microsoft Azure Architecture Center, Saga pattern: https://learn.microsoft.com/en-us/azure/architecture/patterns/saga
- Microsoft Azure Architecture Center, Compensating Transaction pattern: https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction
- Google Cloud Storage retry strategy: https://cloud.google.com/storage/docs/retry-strategy
- Google Cloud Storage request preconditions: https://cloud.google.com/storage/docs/request-preconditions
- Stripe API idempotent requests: https://docs.stripe.com/api/idempotent_requests
- RFC 9110, HTTP Semantics, idempotent methods: https://www.rfc-editor.org/rfc/rfc9110#section-9.2.2
- Node.js file system documentation: https://nodejs.org/api/fs.html
- POSIX `rename`, Open Group Base Specifications Issue 8: https://pubs.opengroup.org/onlinepubs/9799919799/functions/rename.html
- Garcia-Molina and Salem, "SAGAS" technical report landing page: https://www.cs.princeton.edu/research/techreps/598

#### Key Findings

- Retry safety depends on operation semantics, not optimism. AWS and RFC 9110 both emphasize that a timeout or dropped response does not prove side effects did not happen; automatic retries are safe only for idempotent operations or when the client can prove the failed request was not applied. AWS also warns that retries can amplify overload unless bounded with backoff and jitter.
- Strong idempotency contracts include a caller-provided stable key, stored request parameters, and a deterministic duplicate response. AWS and Stripe both treat "same key, different parameters" as a misuse/error case, not a retry. AWS further notes that recording the idempotency token and performing the mutation must be atomic, otherwise the system can create the resource without recording the dedupe key or record the key without completing the resource.
- Durable workflow platforms distinguish replay from retry. AWS Durable Execution and Lambda durable functions checkpoint completed steps, but interrupted steps can still run more than once. Their guidance is to make at-least-once steps idempotent, use at-most-once/no-retry semantics for dangerous side effects, and generate idempotency tokens inside the durable step so replay does not create a new key.
- Saga literature fits a multi-step scaffold-plus-state workflow. The original Garcia-Molina/Salem saga model breaks long-lived transactions into local transactions, with compensating transactions used to amend partial execution. Azure's modern saga guidance adds useful concepts for Blueprint: compensable steps, a pivot point, retryable idempotent steps after the pivot, monitoring, and explicit handling for partial updates.
- Compensation is not just "delete whatever was written." Azure's compensating transaction guidance says recovery logic is application-specific, should record enough progress to resume, should make compensation steps idempotent, and sometimes must ask a human to decide. For Blueprint, a recovery path that deletes starter docs or phase directories would be unsafe if the user or another command edited them after the failed step.
- Conditional writes are the storage analogue of idempotency keys. Google Cloud Storage retries conditionally idempotent operations only when generation, metageneration, or ETag preconditions are supplied. Its `ifGenerationMatch=0` create-only behavior maps directly to starter scaffolding that should create missing files without overwriting user content unless the command has explicit confirmation.
- Filesystem APIs require explicit scaffolding discipline. Node documents `fs.rename` as overwriting an existing destination, `fs.open` flags such as `wx` as exclusive create, and `fsync`/`filehandle.sync()` as flush requests. POSIX `rename` provides atomic replacement within its constraints, but that is a single-path guarantee, not an all-or-nothing transaction across PROJECT, REQUIREMENTS, ROADMAP, phase directories, and STATE.
- Safe recovery requires machine-readable receipts. Provider docs converge on the same pattern: record stable intent, preconditions, step progress, and duplicate/retry outcomes. A prose-only "I wrote the scaffold" answer is not enough to distinguish complete success, partial scaffold, state-update failure, duplicate retry, missing-summary wait, or confirmation blocker.

#### Blueprint Implications

- `/blu-new-milestone` should be treated as a small durable workflow: read/digest/confirm has no durable side effects, scaffold is the first durable mutation, and `STATE.md` update is the visible workflow commit that routes to `/blu-discuss-phase <first phase>`.
- The current ordering, scaffold first and state update second, is sensible for avoiding a state that points at missing starter artifacts. Its risk is the opposite partial failure: scaffold succeeds but state update fails. A future implementation should detect that condition and resume or reconcile instead of re-running overwrite-capable scaffold blindly.
- `blueprint_artifact_scaffold` should eventually be idempotent by design. A repeated call with the same milestone-start intent and same parameters should return the same per-path receipt or safely finish missing steps. A repeated call with the same idempotency key but changed mode, milestone name, first phase number, digest inputs, or overwrite confirmation should block as a different intent.
- Missing milestone summary, carry-forward confirmation, and starter overwrite confirmation are not transient failures. They should surface as typed waiting/blocker statuses with `safeRetry=false` until the missing user input or source artifact exists. Backoff and retry belong to transient filesystem/contention errors, not to human-decision gates.
- Historical artifacts must constrain compensation. Recovery should preserve existing phase directories and prior milestone evidence. Cleanup can remove same-run temporary files or same-run created starter files only when the receipt proves they are unchanged and not historical; otherwise the tool should block with a manual recovery receipt.
- The "no direct file edits by prompt" boundary is part of failure recovery. If a scaffold or state tool returns a partial/blocker result, the model should not repair by editing `.blueprint/PROJECT.md`, `.blueprint/ROADMAP.md`, or `STATE.md` directly. It should surface the typed recovery option or ask the user for the missing confirmation.
- `inputsUsed`, confirmation state, and scaffold path hashes should travel together. If `.blueprint/ROADMAP.md` or starter docs change between preview/confirmation and commit, the command should treat the precondition as failed and re-confirm instead of assuming the old confirmation still applies.

#### Concrete Improvement Ideas

- Define a future `newMilestoneRunId` or `milestoneStartToken` for the command contract. Seed it from repo identity, previous milestone, target milestone, mode, first phase number, digest `inputsUsed` hash, scaffold plan hash, and confirmation version. Store the full parameter fingerprint in the receipt so same-token/different-parameter retries become explicit blockers.
- Extend the future `artifact_scaffold` receipt with per-path operations: `path`, `artifactKind`, `intendedOperation` (`create`, `reuse`, `overwrite`, `skip`, `mkdir`), `status`, `beforeHash`, `afterHash`, `precondition`, `confirmationUsed`, `temporaryPath`, `warning`, and `recoveryAction`.
- Add a dry-run/commit split or equivalent preview receipt. The preview should report which starter docs would be overwritten, which phase directories would be created, which historical artifacts are preserved, and which confirmations are required. The commit should require the preview hash or confirmation token so stale previews cannot overwrite changed files.
- Use conditional filesystem writes in the future implementation: exclusive create for new starter files and phase context, same-directory temporary files plus flush plus atomic rename for confirmed replacement, post-write hash verification, and create-only directory operations for historical phase paths.
- Add a recovery matrix to command/runtime-contract docs:
  - no scaffold receipt and no state update: safe to start after normal blockers pass.
  - scaffold receipt complete and state update missing: verify hashes, then complete only the state update.
  - scaffold receipt partial and paths unchanged: resume remaining scaffold operations, then update state.
  - scaffold receipt partial and paths changed: block with `manual-recovery-required`.
  - state updated but scaffold missing or inconsistent: block with diagnostics; do not silently recreate historical paths.
  - confirmation missing or source summary missing: wait, no retry.
- Add retry policy language: retry only transient file/lock/contention errors with bounded exponential backoff and jitter; never retry confirmation blockers, validation errors, path-containment failures, hash/precondition failures, or same-token/different-parameter mismatches.
- Add a compact completion/recovery receipt to user-facing output: `status`, `newMilestoneRunId`, `scaffoldStatus`, `stateUpdateStatus`, `pathsCreated`, `pathsReused`, `pathsOverwritten`, `pathsBlocked`, `safeRetry`, `nextAction`, and `routeNext`.
- Add future regression coverage for duplicate run id returning a reused receipt, same token with changed inputs blocking, confirmed overwrite blocked after file hash drift, scaffold success plus injected state-update failure resuming without rewriting, partial temp-file cleanup, missing-summary wait, starter-overwrite wait, and direct-write prohibition after tool blockers.

#### Risks And Open Questions

- Complexity risk: a full workflow engine would be too much for `/blu-new-milestone`. Keep the future design to a small run token, path receipt, preconditions, and a recovery matrix.
- False-idempotency risk: poorly seeded run tokens can collapse different user intent into one retry lane. The parameter fingerprint and same-token/different-parameter blocker are mandatory if this is implemented.
- Compensation risk: deleting or reverting files can destroy user work or historical evidence. Prefer forward recovery and explicit manual blockers over automatic rollback, except for same-run temp files proven safe to remove.
- Durability portability risk: filesystem flush and rename semantics differ by platform and storage layer. Tests should verify Blueprint's contract at the application level, not assume POSIX behavior alone covers all failure modes.
- Receipt drift risk: if a scaffold receipt becomes a second source of truth, it can disagree with `.blueprint/` artifacts. Receipts should be recovery evidence; current files plus state remain authoritative after recovery completes.
- Retry-storm risk: concurrent agents or users could repeatedly hit the same overwrite gate or lock. Backoff, jitter, and typed blockers should keep retries from becoming load amplification.
- UX risk: exposing too much recovery machinery could scare users during an ordinary milestone start. The command should show a compact receipt by default and reserve the detailed path ledger for diagnostics.

## Reconciled Research Synthesis

Status: complete.

### Synthesis Thesis

The frontier pattern is consistent across the eight lanes: `/blu-new-milestone` should stay a short, bounded milestone-transition command, but its future contract should become more structured at the exact points where compressed history, human intent, generated starter artifacts, optional delegation, and persistent state can drift. The best improvement direction is not more prose or a larger planning workflow; it is a compact transition packet with source-scoped evidence, explicit user gates, typed MCP receipts, a bounded roadmapper option, and recovery-aware scaffold/state semantics.

### Deduplicated Themes

1. **Carry-forward must be source-scoped, not memory-shaped.**

   Representative sources: OpenAI sessions and conversation state (`https://openai.github.io/openai-agents-python/sessions/`, `https://developers.openai.com/api/docs/guides/conversation-state`), OpenAI compaction (`https://developers.openai.com/api/reference/resources/responses/methods/compact`), Anthropic context editing and memory (`https://platform.claude.com/docs/en/build-with-claude/context-editing`, `https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool`), MemGPT (`https://arxiv.org/abs/2310.08560`), W3C PROV-DM (`https://www.w3.org/TR/prov-dm/`).

   R1, R4, R5, and R7 converge on the same lesson: compressed context is useful only when it carries source boundaries and uncertainty. `inputsUsed` is already the right top-level evidence boundary, but it is too coarse to explain which next-milestone claim came from which prior artifact. Future `/blu-new-milestone` improvements should turn the milestone-summary digest into a small carry-forward packet with categories such as validated outcomes, retained decisions, open risks, deferred ideas, stale or dropped items, and claim-level evidence pointers.

2. **The next milestone should be outcome-framed before it is phase-framed.**

   Representative sources: GOV.UK agile planning and roadmapping (`https://www.gov.uk/service-manual/agile-delivery/planning-agile`, `https://www.gov.uk/service-manual/agile-delivery/developing-a-roadmap`), Scrum Guide (`https://scrumguides.org/scrum-guide.html`), Scrum.org Evidence-Based Management (`https://www.scrum.org/resources/evidence-based-management`), Product Talk opportunity solution tree (`https://www.producttalk.org/opportunity-solution-tree-origin/`), IDRC Outcome Mapping (`https://idrc-crdi.ca/en/books/outcome-mapping-building-learning-and-reflection-development-programs`), PMI rolling-wave planning (`https://www.pmi.org/learning/library/manage-innovation-programs-rolling-wave-3515`), NASA technical planning (`https://www.nasa.gov/reference/6-1-technical-planning/`).

   R2 argues that a milestone boundary should preserve intent, value, priority, and learning horizon without becoming a backlog. The first new phase should be the nearest useful learning slice, not simply the first leftover task. Blueprint should keep deriving the next whole-number phase from roadmap history, but the seed should explain the target outcome, measurable or explicitly unknown signals, unresolved value gaps, delivery constraints, why the first phase is first, and what is intentionally deferred.

3. **Human confirmation gates should calibrate trust and reduce verification load.**

   Representative sources: NIST AI RMF human-AI interaction (`https://airc.nist.gov/airmf-resources/airmf/appendices/app-c-ai-risk-management-and-human-ai-interaction/`), EU AI Act Article 14 (`https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-14`), Microsoft HAX guidelines (`https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/`), Google PAIR explainability/trust and feedback/control (`https://pair.withgoogle.com/guidebook-v2/chapter/explainability-trust/`, `https://pair.withgoogle.com/guidebook-v2/chapters/feedback-controls/`), OWASP Excessive Agency (`https://genai.owasp.org/llmrisk/llm062025-excessive-agency/`), Microsoft confirmation UX (`https://learn.microsoft.com/en-us/windows/win32/uxguide/mess-confirm`).

   R3 supports the current three waiting states: missing milestone summary, carry-forward confirmation, and starter-doc overwrite confirmation. Future work should keep those as distinct risk gates and resist generic confirmations. Each gate should show the action, affected artifacts, evidence scope, consequence, reversibility, safe default, and allowed choices. The safe default remains "do not write yet" when source evidence is missing, reset intent is ambiguous, or existing starter docs would be overwritten.

4. **Requirements need transition decisions, not silent copying or silent loss.**

   Representative sources: ISO/IEC/IEEE 29148 (`https://www.iso.org/standard/72089.html`), INCOSE requirements guidance summary (`https://www.incose.org/docs/default-source/working-groups/requirements-wg/guidetowritingrequirements/incose_rwg_gtwr_v4_summary_sheet.pdf?sfvrsn=73644bc7_2`), NASA requirements management and traceability (`https://www.nasa.gov/reference/6-2-requirements-management/`, `https://swehb.nasa.gov/spaces/7150/pages/16449982/SWE-047%2B-%2BTraceability%2BData`), NASA requirements change management (`https://swehb.nasa.gov/pages/viewpage.action?pageId=43057826`), Gotel and Finkelstein traceability (`https://discovery.ucl.ac.uk/id/eprint/749/`).

   R4 sharpens the highest-risk artifact surface: regenerated `REQUIREMENTS.md`. Future carry-forward should be able to say whether each important prior requirement was carried unchanged, modified, deferred, retired, newly introduced, or self-derived. This does not require a heavyweight traceability system, but it does require a compact transition ledger with source refs, rationale, uncertainty, verification status or strategy, and revisit triggers for deferred work.

5. **Persistent behavior should depend on typed MCP contracts and receipts, not prose inference.**

   Representative sources: MCP tools/resources/lifecycle specs (`https://modelcontextprotocol.io/specification/2025-11-25/server/tools`, `https://modelcontextprotocol.io/specification/2025-11-25/server/resources`, `https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle`), OpenAI structured outputs and function calling (`https://developers.openai.com/api/docs/guides/structured-outputs`, `https://developers.openai.com/api/docs/guides/function-calling`), Gemini function calling and structured output (`https://ai.google.dev/gemini-api/docs/function-calling`, `https://ai.google.dev/gemini-api/docs/structured-output`), JSON Schema 2020-12 (`https://json-schema.org/draft/2020-12/json-schema-core`).

   R5 reinforces Blueprint's existing architecture: commands and skills should orchestrate; MCP tools should own state reads and writes. The future improvement is receipt granularity. `artifact_summary_digest`, `artifact_scaffold`, and `state_update` should expose stable machine-readable facts such as digest inputs, blocked reasons, per-path scaffold operation, confirmation used, first phase path, route target, and warnings. Human-readable `content` can summarize, but downstream behavior and tests should use structured fields.

6. **Roadmapper assistance should be a bounded manager/worker pass, not a control handoff.**

   Representative sources: OpenAI handoffs and multi-agent patterns (`https://openai.github.io/openai-agents-python/handoffs/`, `https://openai.github.io/openai-agents-python/agents/#multi-agent-system-design-patterns`), OpenAI practical guide to agents (`https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf`), Anthropic effective agents and multi-agent research (`https://www.anthropic.com/engineering/building-effective-agents`, `https://www.anthropic.com/engineering/multi-agent-research-system`), Google ADK multi-agent systems (`https://adk.dev/agents/multi-agents/`), LangChain handoffs (`https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs`).

   R6 argues against treating `blueprint-roadmapper` as an authority transfer. The parent command must keep user interaction, phase numbering, confirmation gates, and MCP writes. The worker, when enabled by config and useful, should receive a typed delegation packet with digest scope, constraints, next-phase preview, forbidden actions, expected output, and stop conditions. The no-subagent fallback should follow the same packet and response shape inline so disabled subagents do not create a weaker workflow.

7. **Learning loops should feed the next milestone without turning transition into a retrospective ceremony.**

   Representative sources: Scrum retrospective guidance (`https://scrumguides.org/scrum-guide.html`), Agile Alliance milestone retrospective (`https://agilealliance.org/glossary/milestone-retrospective/`), PMI/Agile Alliance Agile Practice Guide (`https://www.agilealliance.org/wp-content/uploads/2021/02/AgilePracticeGuide.pdf`), Google SRE postmortem culture and analysis (`https://sre.google/sre-book/postmortem-culture/`, `https://sre.google/workbook/postmortem-analysis/`), DORA learning culture (`https://dora.dev/capabilities/learning-culture/`), NASA lessons learned (`https://www.nasa.gov/nasa-lessons-learned/`).

   R7 separates durable learning from raw historical memory. `/blu-new-milestone` should consume the milestone summary as the reviewed carry-forward report, extract only decision-useful lessons, and leave deep retrospective work to `/blu-milestone-summary`. A compact learning loop can carry validated lessons, system improvements, evidence pointers, success signals, deferred learning, and do-not-carry-forward items into the next milestone seed.

8. **Scaffold and state updates need idempotency, preconditions, and recovery receipts.**

   Representative sources: AWS idempotent APIs and retry guidance (`https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/`, `https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/`), AWS durable execution idempotency (`https://docs.aws.amazon.com/durable-execution/patterns/best-practices/idempotency/`), Azure Saga and compensating transactions (`https://learn.microsoft.com/en-us/azure/architecture/patterns/saga`, `https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction`), Google Cloud request preconditions (`https://cloud.google.com/storage/docs/request-preconditions`), Stripe idempotent requests (`https://docs.stripe.com/api/idempotent_requests`), POSIX rename (`https://pubs.opengroup.org/onlinepubs/9799919799/functions/rename.html`).

   R8 frames `/blu-new-milestone` as a small durable workflow: read, digest, preview, confirm, scaffold, update state, route. The current scaffold-before-state ordering is sensible, but partial failure needs a typed recovery path. Future receipts should include a stable run token or milestone-start token, parameter fingerprint, per-path status, preconditions, hashes where useful, and `safeRetry`. Same-token/different-parameter retries should block; scaffold-success/state-update-failure should resume without rewriting starter docs.

9. **Historical preservation is a non-negotiable constraint across every improvement.**

   Representative sources: NASA configuration management (`https://www.nasa.gov/reference/6-5-configuration-management/`), NASA lessons learned (`https://www.nasa.gov/nasa-lessons-learned/`), W3C PROV-DM (`https://www.w3.org/TR/prov-dm/`), SLSA provenance (`https://slsa.dev/spec/v1.1/provenance`), Google SRE postmortem analysis (`https://sre.google/workbook/postmortem-analysis/`).

   R2, R4, R7, and R8 all reject cleanup-by-transition. Prior phase directories, milestone reports, audit evidence, and roadmap history are the as-built record. `/blu-new-milestone` should preserve them and derive new starter artifacts from them with references, not move, renumber, delete, or reinterpret them as mutable scratch. Compensation should prefer forward recovery and manual blockers over automatic deletion of user-visible artifacts.

10. **Contract parity and verification must land with any future runtime change.**

    Representative sources: MCP tool output schemas (`https://modelcontextprotocol.io/specification/2025-11-25/server/tools`), Anthropic tool definition and eval guidance (`https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools`, `https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents`), OpenAPI 3.1 (`https://spec.openapis.org/oas/v3.1.1.html`), NIST SSDF (`https://csrc.nist.gov/projects/ssdf`).

    The lanes repeatedly warn about drift: richer receipts, ledgers, gates, roadmapper packets, and recovery semantics are only useful if command docs, manifests, skills, agent text, runtime metadata, MCP tool docs, and tests describe the same behavior. The later detailed implementation plan should avoid isolated wording edits. Each runtime-facing improvement should include parity checks and tests that assert behavior classes rather than exact prose.

### Concrete Implications For Blueprint

- Keep `/blu-new-milestone` a bounded transition command. It should start the next milestone and route to `/blu-discuss-phase <first phase>`, not become a progress tracker, retrospective workshop, backlog manager, or phase planner.
- Define a compact future `New Milestone Transition Packet` as the shared concept across docs, command text, skill guidance, optional roadmapper input, and tests. It should include source scope, carry-forward digest, outcome frame, first phase preview, confirmation state, learning loop, requirement transition summary, scaffold plan, and route target.
- Treat `inputsUsed` as the top-level source boundary and add smaller evidence rows under it. The future shape should answer "which source caused this claim or transition?" without forcing the user or agent to reread all historical artifacts.
- Make the first phase seed explain `whyFirst`, `inspectableProgress`, and `deferredNotDoingNow`. This gives `/blu-discuss-phase <first phase>` a stronger handoff while preserving that starter docs are not final authored plans.
- Preserve the current explicit gates, but make their previews sharper: carry-forward versus fresh reset, path-specific starter overwrite, and missing milestone-summary recovery should each have named choices and typed receipts.
- Keep all `.blueprint/` mutations inside MCP tools. Prose may propose starter content; `artifact_scaffold` and `state_update` should create or update durable files and return receipts.
- Make optional roadmapper work evidence-bounded. It should group and sequence candidates, flag uncertainty, and return provisional proposals; it must not assign final phase numbers, bypass confirmations, write files, browse for replacement truth, or mutate state.
- Add future recovery semantics around scaffold/state ordering. A partial scaffold should be resumable or block with diagnostics, not invite a model to manually repair `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, phase context, or `STATE.md`.
- Add tests around behavioral invariants: missing summary blocks, ambiguous reset does not reset, existing starter docs do not overwrite without named approval, disabled subagents use parity fallback, receipts align with structured content, and historical phase artifacts remain preserved.

### Conflicts, Tradeoffs, And Risks

- **Structure versus command size:** More ledgers and receipts improve trust, but `/blu-new-milestone` must stay short. The compromise is compact summaries, counts, and source pointers, with deeper detail left to existing artifacts.
- **Safety gates versus confirmation fatigue:** Reset and overwrite require real approval; routine reads and missing-file scaffold creation should not gain extra prompts. The command should keep only risk-distinct gates.
- **Evidence precision versus model uncertainty:** A model can suggest carry/modify/defer decisions confidently but incorrectly. Future contracts should expose confidence and uncertainty, and user-facing gates should show ambiguous or high-impact transitions.
- **Outcome framing versus premature planning:** Outcome frames and success signals are useful, but detailed phase planning belongs in `/blu-discuss-phase` and later lifecycle commands. Unknown signals should be allowed when labeled.
- **Roadmapper quality versus context bloat:** Optional delegation can improve grouping, but full raw history can degrade quality and blur authority. The packet should be curated and source-scoped.
- **Idempotency versus implementation complexity:** A full workflow engine would be too much. A stable run token, parameter fingerprint, per-path receipt, precondition checks, and a recovery matrix are enough for the next design level.
- **Traceability versus artifact noise:** Requirement transition rows can become heavy. Start with minimum useful fields and counts, and expand only when source evidence exists.
- **Analogy versus overclaiming:** AI governance, incident response, SRE, and supply-chain provenance sources are useful design analogies. The future plan should not imply that `/blu-new-milestone` is legally high-risk AI, an incident system, or a supply-chain build.
- **Receipt usefulness versus second-source-of-truth drift:** Receipts should document transition/recovery facts. After completion, `.blueprint/` artifacts and state remain authoritative.

### Recommended Design Principles For The Detailed Improvement Plan

1. **Bound the command:** new milestone transition only; no tracker expansion, no full retrospective, no final phase planning.
2. **Source every durable claim:** preserve `inputsUsed` and add claim-, lesson-, and requirement-level source pointers where they change downstream behavior.
3. **Prefer typed receipts over prose promises:** scaffold, state update, digest, confirmation, roadmapper mode, and recovery facts should be machine-readable.
4. **Make safe defaults explicit:** no summary, ambiguous reset, stale preview, changed files, or overwrite risk means stop or wait, not best-effort mutation.
5. **Keep history immutable in practice:** preserve old phase directories, milestone summaries, audit evidence, and numbering history; generate new starter artifacts with references instead of rewriting the past.
6. **Use roadmapper as a bounded worker:** parent command owns user gates, final numbering, route target, and MCP writes; worker returns provisional grouping under the digest evidence boundary.
7. **Shape the first phase as a learning slice:** record target outcome, why this phase is first, inspectable progress, and important deferred work.
8. **Separate starter scaffolds from authored plans:** generated PROJECT, REQUIREMENTS, ROADMAP, and first context are launch scaffolds for `/blu-discuss-phase`, not final commitments.
9. **Keep ledgers small and decision-useful:** transition ledgers and learning loops should carry only what affects the next milestone, with counts and evidence pointers for the rest.
10. **Land changes as contract sets:** future implementation should update command docs, manifests, skill text, agent contract, runtime metadata, MCP tool docs/results, and tests together so routing and behavior do not drift.

## Blueprint-Specific Improvement Analyses

### A1 Carry-Forward Input And Digest Quality

Owner: A1.

Status: complete.

#### Current Behavior

- The command manifest already makes carry-forward the default path. `commands/blu-new-milestone.toml` resolves roadmap state first, reads the `report.milestone-summary` contract before seed generation, stops when the summary is missing, and then calls `mcp_blueprint_blueprint_artifact_summary_digest` with repo-relative `artifactPaths` that include `.blueprint/ROADMAP.md` plus the matching milestone summary report. The manifest also says `inputsUsed` is the authoritative digest scope and that starter docs are regenerated from an explicit carry-forward bootstrap seed rather than treated as final authored content.
- The command spec mirrors that contract. `docs/commands/new-milestone.md` names the saved `milestone-summary-<milestone>.md` report as the durable carry-forward input, lists `blueprint_artifact_summary_digest -> {digest, inputsUsed}` as a required read, and has a dedicated `## Carry-Forward Contract` section requiring repo-relative digest paths, canonical report and phase context contracts, scaffold-only starter output, and preserved next phase numbering.
- The roadmap-admin skill keeps runtime input ownership docless and command-local. `skills/blueprint-roadmap-admin/SKILL.md` loads only `commands/blu-new-milestone.toml` for this command, treats `blueprint_artifact_summary_digest.inputsUsed` as authoritative, and says the no-subagent fallback should compress one roadmap or milestone synthesis unit at a time into retained intent, starter-scope decisions, and unresolved assumptions before scaffolding.
- Runtime metadata is aligned at the tool-list level. `src/mcp/command-runtime-metadata.ts` declares `blueprint_roadmap_read`, `blueprint_artifact_contract_read`, `blueprint_artifact_summary_digest`, `blueprint_config_get`, `blueprint_artifact_scaffold`, and `blueprint_state_update` as the required tool set, and its runtime notes describe the saved milestone summary as the durable carry-forward input.
- The generic MCP docs intentionally expose a thin digest contract. `docs/MCP-TOOLS.md` documents `blueprint_artifact_summary_digest` as returning `{digest, inputsUsed}` and says `inputsUsed` is the scope actually summarized. That matches the current server-level public contract, where tests assert that the structured response only contains `digest` and `inputsUsed`.
- `docs/ARTIFACT-SCHEMA.md` says `reports/milestone-summary-<milestone>.md` is the carry-forward input for `/blu-new-milestone` and that its minimum locked sections include recommended carry-forward context. It does not yet spell out carry-forward categories or claim-level evidence requirements in the docs surface.
- `tests/new-milestone-metadata.test.ts` verifies that the manifest, skill, and runtime metadata mention the carry-forward digest, default carry-forward mode, waiting states, roadmapper option, and `/blu-discuss-phase <first phase>` routing. The tests are useful parity guards, but they are mostly prose-presence checks rather than digest-quality checks.

#### Gaps

- `inputsUsed` is a source boundary, not a quality ledger. The current contract can prove which files were summarized, but it cannot prove which starter-doc claim came from which source section, which evidence was weak, or which old milestone details were intentionally dropped.
- The digest has no command-specific packet shape. The command says "carry-forward context" and "carry-forward bootstrap seed", while the research synthesis recommends a `New Milestone Transition Packet`; today there is no shared field list for `validatedOutcomes`, `retainedDecisions`, `openRisks`, `deferredIdeas`, `candidateNextMilestoneThemes`, `nonCarryForwardItems`, `staleOrAmbiguousClaims`, or evidence rows.
- The report schema docs understate the evidence contract. `report.milestone-summary` is supposed to be the reviewed source for the next milestone, but the docs only require a broad "recommended carry-forward context" section. They do not require compact source-scoped carry-forward bullets, dropped/stale items, or confidence/uncertainty labels.
- The manifest does not require the carry-forward confirmation preview to show digest quality. It asks for `ask_user` when the mode is ambiguous, but it does not say the preview must show `inputsUsed`, missing/skipped inputs, uncertain claims, non-carried-forward items, or why the digest is good enough to seed starter docs.
- The no-subagent fallback has weaker shape than the desired roadmapper packet. It says to compress units into retained intent and unresolved assumptions, but not that the inline fallback must emit the same packet fields and evidence rows that an optional roadmapper would receive.
- Tests do not pin the minimum evidence packet. They do not assert the exact expected digest inputs, source-scope preview language, evidence ledger fields, omitted/stale item handling, or that every carry-forward claim must reference an input inside `inputsUsed`.

#### Proposed Improvements

- Introduce a compact `New Milestone Transition Packet` as the carry-forward concept shared by the manifest, command doc, roadmap-admin skill, runtime metadata, and tests. For A1, this should be a contract/prompt packet first; do not change the generic `blueprint_artifact_summary_digest` return shape unless a later implementation deliberately broadens the MCP output schema.
- Keep `inputsUsed` as the top-level evidence boundary and add claim-level rows under it. Minimum row fields: `claimId`, `category`, `claim`, `sourcePath`, `sourceHeading`, `decision`, `confidence`, `usedBy`, and `uncertainty`. `sourcePath` must be one of the returned `inputsUsed` entries unless the row is explicitly labeled `outside-digest-scope` and blocked from starter-doc use.
- Require the packet to separate retained context from stale context. Minimum packet fields: `sourceScope`, `validatedOutcomes`, `retainedDecisions`, `openRisks`, `deferredIdeas`, `candidateNextMilestoneThemes`, `nonCarryForwardItems`, `staleOrAmbiguousClaims`, `evidenceLedger`, `digestWarnings`, and `starterAuthoringImplications`.
- Make carry-forward confirmation evidence-backed. The preview should show source milestone, summary report path, `inputsUsed`, missing/skipped/truncated inputs if known, high-confidence carry-forward bullets, uncertain bullets, dropped/stale bullets, and the proposed first starter-doc usage before any scaffold write.
- Keep the packet bounded. Each category should prefer 3 to 7 bullets plus source pointers over long quoted history. The command should not become a retrospective or final phase planner; the packet only decides what seed context is safe to carry into `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, and first `phase.context`.
- Make the no-subagent fallback use the same packet schema inline. If `blueprint-roadmapper` is disabled or unnecessary, the parent command still produces the same fields one unit at a time; the only difference is execution mode, not evidence quality.

#### Exact Future Edit Targets

- `commands/blu-new-milestone.toml`, flow step 4: replace the plain digest instruction with a packet-building rule after `mcp_blueprint_blueprint_artifact_summary_digest`. Anchor on the sentence that currently says `Treat the returned inputsUsed list as the authoritative digest scope`.
- `commands/blu-new-milestone.toml`, flow steps 5 to 6: require the carry-forward or reset confirmation preview to include packet quality fields before asking the user to proceed.
- `commands/blu-new-milestone.toml`, flow step 11: say the scaffold seed is derived from the confirmed `New Milestone Transition Packet`, not from an unstructured digest summary.
- `docs/commands/new-milestone.md`, `## Carry-Forward Contract`: add the packet fields, evidence-row rules, and the rule that every starter-doc claim must point to `inputsUsed` or be omitted/flagged.
- `docs/commands/new-milestone.md`, `## User Prompts And Confirmation Gates`: add the exact carry-forward preview checklist so the reset/carry-forward decision is grounded in digest quality.
- `docs/commands/new-milestone.md`, `## Acceptance Criteria` and `## Test Cases`: add acceptance bullets for source-scoped packet creation, non-carry-forward item handling, and evidence-backed starter seed generation.
- `skills/blueprint-roadmap-admin/SKILL.md`, `## Shared MCP Contracts`: extend the `blueprint_artifact_summary_digest` bullet to say roadmap-admin commands may wrap `{digest, inputsUsed}` into command-specific packets, but `inputsUsed` remains the evidence boundary.
- `skills/blueprint-roadmap-admin/SKILL.md`, `### new-milestone`: add a step after the digest read requiring the packet and requiring subagent and no-subagent modes to preserve the same packet shape.
- `skills/blueprint-roadmap-admin/SKILL.md`, `## Output Style`: make `/blu-new-milestone` report the digest inputs used, digest warnings, and high-level uncertain or dropped carry-forward items alongside the new milestone and first phase.
- `src/mcp/command-runtime-metadata.ts`, `NEW_MILESTONE_RUNTIME_METADATA.spec.reads`: update the digest read text from `{digest, inputsUsed}` to a note that the command derives a source-scoped transition packet from those fields.
- `src/mcp/command-runtime-metadata.ts`, `NEW_MILESTONE_RUNTIME_METADATA.runtimeReference.contractNotes`: add the packet, evidence rows, and digest-quality confirmation preview.
- `docs/MCP-TOOLS.md`, artifact management table and `### Digests And Reports`: keep the generic tool return as `{digest, inputsUsed}` for the first implementation, but add a note that command contracts can require command-specific packets built from the digest without changing MCP persistence ownership.
- `docs/MCP-TOOLS.md`, roadmap-admin command list entry for `new-milestone`: mention the source-scoped transition packet and evidence-backed carry-forward confirmation.
- `docs/ARTIFACT-SCHEMA.md`, `reports/milestone-summary-<milestone>.md`: expand minimum locked sections or contract notes so recommended carry-forward context includes categories, source pointers, uncertainty, and do-not-carry-forward items.
- `tests/new-milestone-metadata.test.ts`: strengthen the manifest, skill, and runtime metadata tests to assert packet field names, `inputsUsed` preview language, evidence ledger rules, and no-subagent parity language.

#### Paste-Ready Contract Text

```md
Build a `New Milestone Transition Packet` immediately after `blueprint_artifact_summary_digest` and before any carry-forward confirmation or scaffold write.

Minimum packet fields:
- `sourceScope`: previous milestone, target milestone proposal, milestone summary report path, expected artifact paths, returned `inputsUsed`, and any missing, skipped, malformed, or truncated inputs known to the command.
- `carryForwardDigest`: compact bullets grouped as `validatedOutcomes`, `retainedDecisions`, `openRisks`, `deferredIdeas`, `candidateNextMilestoneThemes`, `nonCarryForwardItems`, and `staleOrAmbiguousClaims`.
- `evidenceLedger`: rows with `claimId`, `category`, `claim`, `sourcePath`, `sourceHeading`, `decision`, `confidence`, `usedBy`, and `uncertainty`.
- `starterAuthoringImplications`: which packet items may seed `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, the first `phase.context`, and the confirmation preview.

Rules:
- `inputsUsed` remains the authoritative source boundary.
- Every packet claim used in starter docs must cite a `sourcePath` from `inputsUsed`; claims outside that boundary must be marked `outside-digest-scope` and omitted from starter writes unless the command reruns the digest with that source included.
- Include `nonCarryForwardItems` so stale assumptions, closed risks, and discarded milestone details do not silently steer the next milestone.
- Keep the packet compact: use evidence pointers and confidence labels, not copied historical prose.
- Use the same packet shape for optional `blueprint-roadmapper` mode and the inline no-subagent fallback. The parent command still owns confirmations, final phase numbering, scaffold writes, and state update.
```

#### Tests To Add Or Update

- Update `tests/new-milestone-metadata.test.ts` manifest test to assert `New Milestone Transition Packet`, `sourceScope`, `carryForwardDigest`, `evidenceLedger`, `nonCarryForwardItems`, `staleOrAmbiguousClaims`, `starterAuthoringImplications`, and the rule that starter-doc claims must cite `inputsUsed`.
- Update the skill test in the same file to assert that `new-milestone` requires the same packet shape for optional roadmapper and inline no-subagent fallback modes.
- Update the runtime metadata test to assert the contract notes mention packet creation after `blueprint_artifact_summary_digest`, source-scoped evidence rows, and digest-quality preview before scaffold writes.
- Add a docs parity assertion, either in this file or the existing command-doc tests, that `docs/commands/new-milestone.md`, `docs/MCP-TOOLS.md`, and `docs/ARTIFACT-SCHEMA.md` all mention the packet or its fields without widening persistent state outside MCP tools.
- Only if the implementation changes `blueprint_artifact_summary_digest` structured output, update the server summary tests that currently assert the public response keys are exactly `digest` and `inputsUsed`. The lower-risk first pass should avoid that output-schema change.

#### Risks

- Over-structuring could turn a short transition command into a retrospective or planning workflow. Keep category counts small and push deep synthesis back to `/blu-milestone-summary` and `/blu-discuss-phase`.
- Evidence rows can look more certain than they are. Require `confidence` and `uncertainty`, and treat missing source rows as blockers for starter-doc use.
- A prompt-only packet can drift from real MCP output. Mitigate with metadata/docs/tests parity now, then consider typed MCP receipt fields only after the packet stabilizes.
- The generic digest tool is shared by many commands. Changing its output shape would have wider blast radius and should be a separate implementation slice with server compatibility tests.
- Milestone summaries may already be compressed or incomplete. The confirmation preview should make source scope and limitations visible instead of laundering weak summaries into authoritative starter docs.

#### Dependency Notes

- A1 depends on A2 for the exact confirmation gate copy, but A1 should define what digest-quality facts the gate must display.
- A1 depends on A4 for roadmapper handoff details; the roadmapper packet should reuse this transition packet rather than define a second schema.
- A1 depends on A5 and A6 for which packet fields seed starter docs and the first `/blu-discuss-phase <first phase>` context.
- A1 depends on A7 for parity enforcement across command manifest, command docs, skill text, runtime metadata, MCP docs, artifact schema docs, and tests.
- Requirement-level transition rows overlap with the R4/A5 surface; A1 should define the evidence-row primitive, while later artifact-quality work decides how much of it lands in regenerated `REQUIREMENTS.md`.

### A2 New Milestone Naming, Reset-Versus-Carry-Forward, And Overwrite Gates

Owner: A2.

Status: complete.

#### Current Behavior

- `commands/blu-new-milestone.toml` already makes carry-forward the default mode, allows fresh reset only after explicit user intent, and says to use `ask_user` when the choice is not explicit. It also derives a milestone-name proposal when the user did not provide one and requires that proposal to appear in a confirmation gate before any write.
- The command manifest requires explicit overwrite confirmation before replacing `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, or `.blueprint/ROADMAP.md`; it separately lists `.blueprint/phases/` and the first `NN-CONTEXT.md` as scaffold outputs.
- The command manifest and command docs agree on the three current blocked/waiting states: `missing-milestone-summary`, `carry-forward-confirmation`, and `starter-doc-overwrite-confirmation`.
- `docs/commands/new-milestone.md` documents the same behavior at a higher level: matching milestone summary required, carry-forward default, fresh reset only after explicit confirmation, existing starter-doc replacement requires explicit confirmation, and `ask_user` is preferred for reset/carry-forward plus overwrite gates.
- `skills/blueprint-roadmap-admin/SKILL.md` keeps the parent command in control: it reads the roadmap and summary digest, uses `blueprint-roadmapper` only for optional grouping, treats carry-forward as default, regenerates starter docs only through `blueprint_artifact_scaffold`, preserves historical phase directories, starts the first new whole-number phase, and routes to `/blu-discuss-phase <first phase>`.
- `src/mcp/command-runtime-metadata.ts` exposes `new-milestone` as implemented, `interactive-read`, medium risk, with required tools `blueprint_roadmap_read`, `blueprint_artifact_contract_read`, `blueprint_artifact_summary_digest`, `blueprint_config_get`, `blueprint_artifact_scaffold`, and `blueprint_state_update`. Its runtime contract notes name the reset/carry-forward and overwrite confirmations but do not define their payload.
- `tests/new-milestone-metadata.test.ts` currently checks for broad contract parity: carry-forward default, `ask_user`, the three waiting states, next whole-number phase language, historical preservation, scaffold path shape, `/blu-discuss-phase <first phase>` routing, skill input ownership, and runtime metadata notes. It does not assert exact confirmation wording, gate fields, allowed choices, per-path overwrite plans, or approval receipts.

#### Ambiguity And Gap Analysis

- **Naming proposal is underspecified.** The command says to derive a concise proposal from the current milestone plus carry-forward summary, but it does not define the proposal packet: source milestone, proposed milestone name, naming rationale, slug constraints, collision handling, or what happens when the user supplies a vague name such as "next one" or "fresh start".
- **Carry-forward default and `ask_user` trigger are not fully reconciled.** The manifest says carry-forward is the default and to use `ask_user` when the choice is not explicit; the docs say explicit confirmation is required only when the user wants a fresh reset. Future wording should make this operational: if the user supplied a clear milestone name and did not request reset, carry-forward can remain the default path, but the command must enter `carry-forward-confirmation` when the name is derived, reset language is ambiguous, digest evidence has material caveats, or the user is choosing between carry-forward and fresh reset.
- **Fresh reset intent is too easy to infer.** "Let's start over", "clean slate", "new milestone", or dissatisfaction with prior work should not silently mean fresh reset. Reset must require a named choice because it deliberately discards carry-forward seed text while preserving historical artifacts.
- **Overwrite confirmation is path-specific in intent but prose-only in contract.** The manifest names top-level starter docs, while the scaffold plan also touches `.blueprint/phases/` and the first `NN-CONTEXT.md`. Future wording should distinguish destructive replacement of existing starter docs from create/reuse operations and from first-phase context conflicts.
- **Confirmation evidence is not fixed.** The current surfaces do not require the prompt to show `inputsUsed`, missing/skipped inputs, proposed milestone name, first phase preview, source summary path, carry-forward highlights, uncertainty, reset consequence, or affected paths. That makes approval hard to audit.
- **Waiting states are named but not typed.** The three states should remain the only A2 gate IDs, but each needs trigger, safe default, no-write guarantee, allowed choices, and receipt fields so later tests can verify that the command waited for the right reason.
- **Tests are presence checks, not gate checks.** Current tests can pass if the words `ask_user` and `starter-doc-overwrite-confirmation` appear while the actual future prompt remains generic or bypassable.

#### Exact Confirmation Packet Design

Add a compact future concept named `New Milestone Confirmation Packet` to command, docs, skill, runtime metadata, and tests. The packet should be generated after roadmap, contract, config, and digest reads, and before any scaffold or state write.

Minimum fields:

| Field | Required Meaning |
|---|---|
| `gateId` | One of `missing-milestone-summary`, `carry-forward-confirmation`, or `starter-doc-overwrite-confirmation`. |
| `fromMilestone` | Current milestone from `blueprint_roadmap_read`. |
| `proposedToMilestone` | User-supplied or derived next milestone name. |
| `milestoneNameSource` | `user-supplied`, `derived-from-summary`, or `needs-user-input`. |
| `mode` | Proposed `carry-forward` or `fresh-reset`. |
| `modeSource` | `defaulted`, `user-explicit`, or `ambiguous-user-intent`. |
| `summarySource` | Expected or found `.blueprint/reports/milestone-summary-<milestone>.md` path. |
| `inputsUsed` | Exact digest `inputsUsed` list; empty only for explicit fresh reset. |
| `inputsMissingOrSkipped` | Missing, malformed, skipped, or truncated inputs, with warnings. |
| `carryForwardPreview` | Short bullets for retained outcomes, decisions, open risks, deferred items, and stale/dropped items. |
| `resetConsequence` | Explicit statement that starter planning context starts clean while historical reports, phase directories, and phase numbers are preserved. |
| `firstPhasePreview` | Next whole-number phase, provisional phase slug/name if known, first context path, and route target `/blu-discuss-phase <first phase>`. |
| `scaffoldPlan` | Per-path operation list for `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, `.blueprint/ROADMAP.md`, `.blueprint/phases/`, and the first `NN-CONTEXT.md`. |
| `safeDefault` | Always `stop-without-writing` for A2 gates. |
| `allowedChoices` | Gate-specific labels, not generic `OK` or `Cancel`. |
| `approvalReceipt` | On approval: `gateId`, selected choice, approved mode, approved milestone name, approved overwrite paths, `inputsUsed` hash or list, scaffold-plan hash or version, and route target. |

Per-path `scaffoldPlan` rows should include:

| Field | Values |
|---|---|
| `path` | Repo-relative `.blueprint/...` path. |
| `artifactKind` | `project`, `requirements`, `roadmap`, `phase-directory`, or `phase-context`. |
| `currentState` | `missing`, `exists-empty`, `exists-nonempty`, `exists-conflict`, or `unknown`. |
| `intendedOperation` | `create`, `reuse`, `overwrite`, `mkdir`, `skip`, or `block`. |
| `requiresConfirmation` | `true` only for destructive replacement or conflict handling. |
| `confirmationReason` | Human-readable reason tied to the operation. |

Starter-doc overwrite confirmation should approve only paths listed with `requiresConfirmation: true`. Missing file creation and directory creation should be previewed but should not add a confirmation gate by themselves.

#### Waiting States

| Waiting State | Trigger | Safe Default | User-Facing Recovery | No-Write Rule |
|---|---|---|---|---|
| `missing-milestone-summary` | The matching `.blueprint/reports/milestone-summary-<milestone>.md` cannot be found or cannot be used before carry-forward digesting. | Stop. | Run `/blu-milestone-summary <milestone>` first, then retry `/blu-new-milestone`. | Do not scaffold, do not update state, do not infer carry-forward from chat. |
| `carry-forward-confirmation` | The next milestone name is derived, reset language is ambiguous, user must choose carry-forward versus fresh reset, or digest warnings materially affect the seed. | Stop unless the user chooses a named action. | Choose carry-forward as proposed, choose explicit fresh reset, provide a different milestone name, or stop. | Do not scaffold or update state until the selected mode and milestone name are recorded. |
| `starter-doc-overwrite-confirmation` | Any existing starter artifact would be overwritten or a first phase context path conflicts with the scaffold plan. | Stop unless the user approves the listed paths. | Approve the listed overwrite paths, approve a subset by path, switch mode/name and rebuild the preview, or stop. | Do not call `blueprint_artifact_scaffold` for overwrite-capable writes until approved paths match the current scaffold plan. |

Do not add a fourth generic confirmation state for A2. Stale previews, changed source inputs, or changed starter docs should re-enter the relevant existing gate with an updated packet, not fall through as a prose warning.

#### Paste-Ready `ask_user` Prompt Wording

Carry-forward/name/reset gate:

```text
ask_user header: New milestone

Question:
I found the current milestone `{fromMilestone}` and the saved summary `{summarySource}`.
Proposed next milestone: `{proposedToMilestone}`.
Mode: carry forward from the saved milestone summary.

Evidence used:
- `{inputsUsed[0]}`
- `{inputsUsed[1]}`
- ...

Carry-forward preview:
- Keep: {topRetainedOutcome}
- Watch: {topOpenRiskOrUncertainty}
- Drop/defer: {topDroppedOrDeferredItem}

First phase preview: `{firstPhaseNumber}` -> `/blu-discuss-phase {firstPhaseNumber}`.
Starter scaffolds are launch material, not final authored milestone content.

Choose how to continue before Blueprint writes starter docs.

Options:
1. Carry forward as proposed
   Use the saved summary and listed inputs to seed the next milestone.
2. Start fresh reset
   Start clean starter docs for `{proposedToMilestone}` while preserving historical phase directories, reports, and phase numbers.
3. Stop without writing
   Leave `.blueprint/` unchanged.

Other:
Provide a different milestone name or a more specific instruction.
```

Fresh-reset explicit friction:

```text
ask_user header: Fresh reset

Question:
You asked for a fresh reset for `{proposedToMilestone}`.
This will not use the saved milestone summary as starter seed text.
Blueprint will still preserve historical phase directories, reports, and phase numbering, and the first new phase remains `{firstPhaseNumber}`.

Choose one explicit action.

Options:
1. Start fresh milestone reset
   Create clean starter scaffolds for the next milestone without carry-forward seed text.
2. Carry forward instead
   Use the saved milestone summary and listed inputs as the starter seed.
3. Stop without writing
   Leave `.blueprint/` unchanged.
```

Starter-doc overwrite gate:

```text
ask_user header: Overwrite docs

Question:
Starting `{proposedToMilestone}` would replace existing starter artifacts.

Paths requiring approval:
- `.blueprint/PROJECT.md` -> overwrite because {reason}
- `.blueprint/REQUIREMENTS.md` -> overwrite because {reason}
- `.blueprint/ROADMAP.md` -> overwrite because {reason}

Preview only, no destructive approval needed:
- `.blueprint/phases/` -> {mkdirOrReuse}
- `.blueprint/phases/{phaseSlug}/{phasePrefix}-CONTEXT.md` -> {createReuseOrBlock}

Approved mode: `{mode}`.
Evidence scope: `{inputsUsedSummary}`.
Next route after successful scaffold and state update: `/blu-discuss-phase {firstPhaseNumber}`.

Choose what Blueprint may do.

Options:
1. Overwrite listed starter docs
   Replace only the listed starter docs after the current preview is rechecked.
2. Create or reuse only
   Continue only for missing/reusable paths and block any overwrite.
3. Stop without writing
   Leave `.blueprint/` unchanged.

Other:
List exact paths to approve if you want a smaller overwrite set.
```

Missing summary wait copy:

```text
Waiting state: missing-milestone-summary

Blueprint cannot start a carry-forward milestone because the matching milestone summary was not found or could not be used:
`{expectedSummaryPath}`.

No starter docs were written and `STATE.md` was not updated.
Run `/blu-milestone-summary {fromMilestone}` first, then rerun `/blu-new-milestone`.
```

#### Future Edit Targets

- `commands/blu-new-milestone.toml`
  - Lines 13-14: replace the loose reset/name guidance with the `New Milestone Confirmation Packet`, the explicit `milestoneNameSource` rule, and the exact `carry-forward-confirmation` trigger list.
  - Line 18: replace generic overwrite wording with path-specific `scaffoldPlan` confirmation semantics.
  - Lines 21 and 28-29: require the completion summary to include the approval receipt, and require the three named waiting states to expose the packet fields rather than prose-only blockers.
- `docs/commands/new-milestone.md`
  - Lines 31-38: add precise reset-vs-carry-forward input semantics and state that reset preserves history while omitting carry-forward seed text.
  - Lines 76-82: add the confirmation packet as the bridge between digest evidence, proposed name, first phase preview, and scaffold plan.
  - Lines 117-123: replace the short prompt section with a confirmation-gate table using `gateId`, `trigger`, `safeDefault`, `mustShowEvidence`, `allowedChoices`, and `postConfirmationReceipt`.
  - Lines 142-162: add acceptance criteria and test cases for ambiguous reset, derived name approval, missing summary wait, and path-specific overwrite blocking.
- `skills/blueprint-roadmap-admin/SKILL.md`
  - Lines 219-231: add the same packet and gate rules to the `new-milestone` subsection, while preserving the parent-command write boundary.
  - Line 230: make overwrite confirmation explicitly path-specific and limit it to current preview paths.
  - Line 249: expand output style to name approved mode, approved milestone name, approved overwrite paths, evidence inputs, and route target.
  - Lines 259-260: update completion self-check so confirmation blockers are not treated as repairable errors or bypassed by direct file edits.
- `src/mcp/command-runtime-metadata.ts`
  - Lines 1077-1121: update `NEW_MILESTONE_RUNTIME_METADATA` contract notes so runtime resources expose the packet concept, three gate IDs, path-specific overwrite receipt, and no generic confirmation state.
  - Lines 354-361 should not need new required tools for A2 if the packet is prompt/metadata-only. If later A5/A7 work adds structured preview or receipt outputs to existing MCP tools, keep the tool list stable unless a new MCP tool is deliberately introduced.
- `tests/new-milestone-metadata.test.ts`
  - Lines 11-42: extend manifest assertions from keyword presence to exact gate IDs, packet name, approved choice labels, path-specific overwrite language, and no generic `Are you sure?` prompt.
  - Lines 44-61: extend skill assertions for `milestoneNameSource`, `modeSource`, explicit fresh reset wording, and path-specific overwrite approval.
  - Lines 63-84: assert runtime contract notes include the packet, `approvalReceipt`, the three gate IDs in order, and no docs-backed skill inputs.

#### Tests To Add Or Update

- Update the manifest test to assert that `commands/blu-new-milestone.toml` contains `New Milestone Confirmation Packet`, `Carry forward as proposed`, `Start fresh milestone reset`, `Overwrite listed starter docs`, `Create or reuse only`, and `Stop without writing`.
- Add a negative static assertion that the manifest and docs do not use generic confirmation labels such as `Are you sure?`, `OK`, or `Cancel` as the only user choices for these gates.
- Update the docs contract test coverage, if available in this checkout, to require the command doc gate table fields: `gateId`, `trigger`, `safeDefault`, `mustShowEvidence`, `allowedChoices`, and `postConfirmationReceipt`.
- Add static assertions that fresh reset copy includes both halves of the decision: no carry-forward seed text, but historical phase directories, reports, and phase numbering are preserved.
- Add static assertions that overwrite approval is path-specific and names `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, `.blueprint/ROADMAP.md`, `.blueprint/phases/`, and first `NN-CONTEXT.md` in the scaffold preview.
- Future runtime behavior tests should cover: missing summary blocks before scaffold, ambiguous reset does not reset, derived milestone name requires approval, starter docs are not overwritten without listed-path approval, and a changed scaffold preview invalidates prior overwrite approval. Those tests likely belong with the future MCP receipt/scaffold implementation rather than only `tests/new-milestone-metadata.test.ts`.

#### Risks

- Over-confirmation can make users approve mechanically. Keep A2 to the three existing gate IDs and do not prompt for routine reads, missing-file creation, or harmless route previews.
- Under-confirmation can replace hand-authored starter docs or silently drop carry-forward context. Fresh reset and overwrite must remain named choices.
- A derived milestone name can look authoritative when it is only a proposal. The packet should show `milestoneNameSource` and invite a different name before writing.
- A stale preview can make a previously valid approval unsafe. The future implementation should bind approval to the current `inputsUsed` and scaffold plan, then re-enter the relevant gate if source files or planned operations change.
- First phase context conflicts overlap with A3/A5. A2 should preview the path and block or re-confirm destructive handling, but detailed directory safety and scaffold content quality belong to those sections.
- Static tests can become brittle if they overfit the exact prompt prose. Assert stable gate IDs, packet fields, and choice labels, while allowing explanatory copy to evolve.

#### Dependency Notes

- Depends on A1 for the richer carry-forward digest fields that populate `carryForwardPreview`, `inputsMissingOrSkipped`, and uncertainty bullets.
- Depends on A3 for final rules around phase number, phase slug, first context path collision, and historical directory preservation.
- Depends on A5 for scaffold receipt details and per-path operation status once `blueprint_artifact_scaffold` grows structured preview or receipt fields.
- Depends on A6 for the exact `/blu-discuss-phase <first phase>` handoff payload; A2 should only preview the route target and first phase identity.
- Depends on A7 to land command manifest, command doc, skill text, runtime metadata, and tests as one parity set.
- R8 recovery/idempotency work should own stale preview hashes, run tokens, same-token/different-parameter blockers, and partial scaffold/state recovery. A2 only defines the user approval packet those receipts should bind to.

### A3 Phase Number Continuity, Historical Preservation, And Directory Safety

Owner: A3.

Status: complete.

#### Current Behavior

- `commands/blu-new-milestone.toml:15-20` is the strongest current command contract: derive the first new phase as the next integer after the highest base phase number in `blueprint_roadmap_read`, preserve historical phase directories, read the `phase.context` contract before scaffolding, scaffold a first context file under `.blueprint/phases/`, and update `STATE.md` to route to `/blu-discuss-phase <first phase>`.
- `docs/commands/new-milestone.md:20` says the command preserves historical phase artifacts and starts at the next whole-number phase instead of renumbering prior work. `docs/commands/new-milestone.md:76-83`, `125-150`, and `156-162` repeat the carry-forward, path, edge-case, acceptance, and test intent.
- `skills/blueprint-roadmap-admin/SKILL.md:219-232` keeps the same orchestration boundary: read roadmap first, default to carry-forward, scaffold through `blueprint_artifact_scaffold`, preserve historical phase directories, start at the next whole-number phase, and route to `/blu-discuss-phase <first phase>`.
- `src/mcp/command-runtime-metadata.ts:1077-1122` marks `new-milestone` implemented and runtime-owned, but its required tools are only `blueprint_roadmap_read`, `blueprint_artifact_contract_read`, `blueprint_artifact_summary_digest`, `blueprint_config_get`, `blueprint_artifact_scaffold`, and `blueprint_state_update` (`src/mcp/command-runtime-metadata.ts:354-361`). There is no dedicated committed-number receipt for `new-milestone`.
- Current docs and metadata contain a path placeholder typo: `commands/blu-new-milestone.toml:19`, `docs/commands/new-milestone.md:63`, and `src/mcp/command-runtime-metadata.ts:1107` use forms like `.blueprint/phases/<NN>-<slug>/<NN-CONTEXT.md>` or `.blueprint/phases/<next-phase-slug>/<NN-CONTEXT.md>`. The actual scaffold parser expects canonical paths like `.blueprint/phases/03-auth/03-CONTEXT.md`.
- `docs/ARTIFACT-SCHEMA.md:122-126` explicitly allows `new-milestone` to rewrite `ROADMAP.md` for the next milestone while preserving historical phase artifacts and continuing at the next whole-number phase. `docs/ARTIFACT-SCHEMA.md:297-309` makes the first `XX-CONTEXT.md` starter-only until `/blu-discuss-phase` authors the final context.
- `docs/MCP-TOOLS.md:220-225` says numeric phase references and returned `phaseNumber`, `phasePrefix`, `phaseDir`, and `path` fields are authoritative. `docs/MCP-TOOLS.md:241-250` says scaffolding accepts only repo-relative Blueprint paths and phase context stays under `.blueprint/phases/<phase>/<XX>-CONTEXT.md`. `docs/MCP-TOOLS.md:252-258` gives add/insert phase stronger tool-owned path rules, but `docs/MCP-TOOLS.md:193` only summarizes `new-milestone`.
- The parser and add-phase substrate already know the intended numbering semantics. `src/mcp/tools/phase-roadmap-parser.ts:254-338` parses whole and decimal phase numbers from ROADMAP. `src/mcp/tools/phase.ts:1471-1483` computes the next integer by taking the max base number after dropping decimal suffixes. `src/mcp/tools/phase.ts:5544-5741` uses that computation plus `expectedPhaseNumber` to reject stale add-phase confirmations and create `.blueprint/phases/<NN>-<slug>`.
- `blueprint_artifact_scaffold` is path-safe but not new-milestone-aware. `src/mcp/tools/artifacts.ts:98-101` accepts only canonical phase artifact paths; `src/mcp/tools/artifacts.ts:2223-2259` verifies that the directory prefix and file prefix match; `src/mcp/tools/artifacts.ts:8783-8868` creates or reuses requested artifacts and returns only `createdFiles`, `reusedFiles`, and `warnings`. It does not verify that a supplied first phase path is the next whole-number phase from ROADMAP.
- `blueprint_state_update` has a partial safety net, not a full new-milestone commit guard. `src/mcp/tools/state.ts:847-857` can check whether a phase directory exists. `src/mcp/tools/state.ts:2480-2533` warns when a requested phase does not have a matching directory, and `src/mcp/tools/state.ts:2129-2139` routes to `/blu-discuss-phase` when the current phase has a directory but no authored context. However, state update does not know the intended first context path or historical-preservation contract for `new-milestone`.
- Current coverage is mostly metadata and regex coverage. `tests/new-milestone-metadata.test.ts:11-42` locks the manifest wording, including the malformed path placeholder. `tests/new-milestone-metadata.test.ts:63-84` checks runtime contract metadata. `tests/command-catalog.test.ts:1954-1975` checks tool availability. `tests/command-contract-docs.test.ts:1327-1339` checks the command doc mentions carry-forward, next whole-number phase, historical directories, and discuss-phase routing. Behavior-level path/number/state tests exist for `add-phase` in `tests/roadmap-tools.test.ts:572-725`, but not for `new-milestone`.

#### Edge Cases To Preserve Or Block

- Decimal history: if ROADMAP contains `1`, `2.1`, and `2.2`, the first new milestone phase is `3`, not `2.3`.
- Gapped whole-number history: if ROADMAP contains `1`, `2`, and `4`, the first new milestone phase is `5`; `new-milestone` must not fill historical gaps because gaps may represent removed, archived, or intentionally skipped history.
- Empty or malformed ROADMAP: the command should block before any write unless the future runtime explicitly defines a safe "no prior phases means Phase 1" transition. Today `nextIntegerPhaseNumber` would return `1` for an empty parsed list, but `new-milestone` should not silently turn malformed history into a fresh Phase 1.
- Existing exact first-phase directory: reuse is safe only when the path exactly matches the computed phase prefix and slug and the context file is missing or still a scaffold starter. If it contains user-authored context, block or route through the same path-specific overwrite gate owned by A2.
- Existing conflicting first-phase directory: any existing `.blueprint/phases/<NN>-*` directory for the computed first phase number that is not the planned directory must block as `phase-directory-conflict`; do not rename, merge, delete, or pick one by slug preference.
- Multiple matching directories: if more than one directory matches the computed `NN` prefix, block as `ambiguous-first-phase-directory`.
- Stale preview: if another command or collaborator adds a higher base phase after preview/confirmation, the commit must block as `stale-first-phase-number` and re-run the roadmap read.
- Top-level starter overwrite: `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, and `.blueprint/ROADMAP.md` replacement remains A2's confirmation gate, but A3 requires the same commit receipt to show that no historical phase directory was deleted or renumbered while those top-level docs changed.
- State mismatch: `STATE.md` must not point to `/blu-discuss-phase <first phase>` unless the exact computed first phase directory exists and the exact first context path was created or safely reused.

#### Exact Path And Numbering Guard Design

Future implementation should make the first-phase preview and commit receipt explicit:

1. Read `blueprint_roadmap_read`.
2. Normalize every parsed `phase.phaseNumber`.
3. Compute `highestBasePhaseNumber` as the max integer portion before any decimal suffix.
4. Set `firstPhaseNumber = highestBasePhaseNumber + 1`.
5. Set `firstPhasePrefix = formatBlueprintPhasePrefix(firstPhaseNumber)`.
6. Slug the confirmed first phase title with the same slugging behavior used by phase directory builders.
7. Build `firstPhaseDir = .blueprint/phases/<firstPhasePrefix>-<slug>`.
8. Build `firstContextPath = <firstPhaseDir>/<firstPhasePrefix>-CONTEXT.md`.
9. Before commit, re-read ROADMAP and recompute the same fields. If any differ from the confirmed preview, return `stale-first-phase-number` with `written: false`.
10. Inspect `.blueprint/phases/` for directories whose leading numeric token normalizes to `firstPhaseNumber`. If the set is empty, create the computed directory. If the set contains only the computed directory, reuse it subject to starter-context overwrite rules. If it contains any other directory, block without mutation.
11. Call scaffold only for the confirmed top-level starter docs, `.blueprint/phases/`, and the exact `firstContextPath`. Do not use a prompt-built variant after the tool has returned a canonical path.
12. Update state only after the scaffold receipt confirms the exact context path as `created` or safe `reused`. Treat any warning about ignored `currentPhase`, missing phase directory, or path mismatch as incomplete transition, not success.

The future result shape should include these fields, whether they are added to `blueprint_artifact_scaffold` for milestone-start mode or to a narrower dedicated milestone-start tool:

```ts
type NewMilestonePhaseContinuityReceipt = {
  status: "ready" | "written" | "blocked";
  blockedReason?:
    | "missing-roadmap"
    | "malformed-roadmap"
    | "stale-first-phase-number"
    | "phase-directory-conflict"
    | "ambiguous-first-phase-directory"
    | "first-context-overwrite-confirmation"
    | "starter-doc-overwrite-confirmation";
  previousMilestone: string | null;
  nextMilestone: string;
  sourcePhaseNumbers: string[];
  highestBasePhaseNumber: string | null;
  firstPhaseNumber: string;
  firstPhasePrefix: string;
  firstPhaseSlug: string;
  firstPhaseDir: string;
  firstContextPath: string;
  historicalPhaseDirectoriesPreserved: true;
  deletedPhaseDirectories: [];
  renamedPhaseDirectories: [];
  scaffoldedPaths: {
    created: string[];
    reused: string[];
    overwritten: string[];
    blocked: string[];
  };
  stateUpdate?: {
    currentMilestone: string;
    currentPhase: string;
    nextAction: string;
  };
  warnings: string[];
};
```

#### Future Edit Targets And Anchors

- `commands/blu-new-milestone.toml:15-20`: replace the malformed path placeholder with `.blueprint/phases/<NN>-<slug>/<NN>-CONTEXT.md`; require a preview/commit guard for `highestBasePhaseNumber`, `firstPhaseNumber`, `firstPhasePrefix`, `firstPhaseDir`, and `firstContextPath`; explicitly name stale-number and directory-conflict blockers.
- `commands/blu-new-milestone.toml:23-33`: add response requirements that the completion summary must include the continuity receipt and must report `deletedPhaseDirectories: []` and `renamedPhaseDirectories: []` or equivalent wording.
- `docs/commands/new-milestone.md:57-83`: fix the write path placeholder and add the first-phase continuity receipt to the carry-forward contract.
- `docs/commands/new-milestone.md:125-150`: expand edge cases and acceptance criteria for decimal history, gapped whole-number history, stale preview, conflicting directory, ambiguous directory, and exact first context path.
- `skills/blueprint-roadmap-admin/SKILL.md:219-232`: add the same first-phase guard checklist to the `new-milestone` subsection, and say that `blueprint-roadmapper` may propose grouping but must not assign the committed phase number or path.
- `skills/blueprint-roadmap-admin/SKILL.md:251-263`: add self-check bullets for "no phase directory deleted or renamed" and "state was updated only after exact first context path scaffold succeeded."
- `src/mcp/command-runtime-metadata.ts:354-361`: if runtime work adds a dedicated milestone-start tool or extends scaffold with a guard, update `NEW_MILESTONE_REQUIRED_TOOLS` in the same change.
- `src/mcp/command-runtime-metadata.ts:1077-1122`: fix the writes placeholder, contract notes, and risk text so runtime-contract resources expose the exact path and continuity guard.
- `docs/ARTIFACT-SCHEMA.md:122-126`: add the exact first context path rule and the "no renumber/delete cleanup" invariant next to the existing `new-milestone` ROADMAP note.
- `docs/MCP-TOOLS.md:51-54`, `87`, `193`, and `220-258`: document the `new-milestone` exception clearly. Either add the new receipt fields to `blueprint_artifact_scaffold` or document the new dedicated milestone-start tool. Keep the add/insert rule that returned path metadata is authoritative.
- `src/mcp/tools/phase.ts:1471-1483`: reuse or export the highest-base whole-number helper instead of duplicating prompt-only logic.
- `src/mcp/tools/artifacts.ts:2223-2259` and `8783-8868`: if `blueprint_artifact_scaffold` remains the commit tool, add milestone-start guard validation before writing any requested first context path.
- `src/mcp/tools/state.ts:2480-2533` and `2901-2980`: ensure `new-milestone` state updates cannot record a first phase or next action that points at a missing, ambiguous, or conflicting phase directory.
- `tests/new-milestone-metadata.test.ts:11-42`: replace regexes that lock the malformed placeholder with exact canonical `.blueprint/phases/<NN>-<slug>/<NN>-CONTEXT.md` wording and new blocker names.
- `tests/command-contract-docs.test.ts:1327-1339`: extend the docs test to assert stale preview, directory conflict, no renumber/delete cleanup, and exact first context path language.
- `tests/command-catalog.test.ts:1954-1975`: update required tool assertions if a dedicated milestone-start tool or scaffold guard tool is introduced.
- Add behavior coverage in either `tests/new-milestone-tools.test.ts` or `tests/roadmap-tools.test.ts` after source implementation exists. Do not rely only on manifest regex tests for this safety property.

#### Paste-Ready Contract Text

Use this wording in the future command, skill, runtime metadata, and docs surfaces after the runtime receipt exists:

```md
Before any `/blu-new-milestone` write, compute the first new phase from the live ROADMAP as the next whole-number phase after the highest base phase number. Decimal phases count only toward their integer base, so `2.1` and `2.2` make the next whole-number phase `3`; gaps are preserved, so `1`, `2`, and `4` make the next phase `5`.

Preview and commit the exact first phase target:

- `highestBasePhaseNumber`
- `firstPhaseNumber`
- `firstPhasePrefix`
- `firstPhaseDir`
- `firstContextPath`

The canonical first context path is `.blueprint/phases/<NN>-<slug>/<NN>-CONTEXT.md`.

Re-read ROADMAP immediately before the scaffold commit. If the recomputed first phase number or path differs from the confirmed preview, stop with `stale-first-phase-number` and make no writes.

Preserve historical phase directories and numbering history. `/blu-new-milestone` must not call cleanup behavior, remove-phase behavior, filesystem delete, filesystem rename, or any renumbering pass for prior milestone artifacts. Existing prior phase directories remain the historical evidence trail.

If a directory already exists for the computed first phase number, reuse only the exact computed directory and only when the first context path is missing or still starter scaffold material. If a different directory matches the computed phase number, or multiple matching directories exist, stop with `phase-directory-conflict` or `ambiguous-first-phase-directory` and make no writes.

Update `STATE.md` only after the scaffold receipt confirms the exact first context path was created or safely reused. The next action must be `/blu-discuss-phase <first phase>`, and it must point to the same numeric phase recorded in `currentPhase`.
```

#### Tests To Add Or Update

- Update `tests/new-milestone-metadata.test.ts` to assert the canonical path placeholder `.blueprint/phases/<NN>-<slug>/<NN>-CONTEXT.md`, the named blockers, and the no delete/rename invariant.
- Update `tests/command-contract-docs.test.ts` so the command doc must mention decimal history, gapped history, stale preview, directory conflicts, exact first context path, and state-after-scaffold ordering.
- Add a behavior test for decimal history: ROADMAP phases `1`, `2.1`, `2.2` produce first phase `3`, prefix `03`, and context path `.blueprint/phases/03-<slug>/03-CONTEXT.md`.
- Add a behavior test for gapped history: ROADMAP phases `1`, `2`, `4` produce first phase `5` and do not rename or delete any existing phase directories.
- Add a stale-preview test: preview expects `5`; a concurrent ROADMAP change makes live next phase `6`; commit returns `stale-first-phase-number` with no scaffold or state write.
- Add a directory-conflict test: `.blueprint/phases/05-old-slug/` exists while the computed path is `.blueprint/phases/05-new-slug/`; commit blocks and leaves both ROADMAP and `STATE.md` unchanged.
- Add an ambiguous-directory test: two `.blueprint/phases/05-*` directories exist; commit blocks and does not choose one.
- Add an exact-path reuse test: exact computed directory exists with no context, or only starter context, and commit safely reuses it while reporting the reuse.
- Add a user-authored context protection test: exact computed `NN-CONTEXT.md` exists without the scaffold marker; commit blocks or requires the path-specific overwrite gate from A2.
- Add a state ordering test: injected scaffold failure means `STATE.md` remains on the prior milestone/phase and does not route to `/blu-discuss-phase <first phase>`.
- Add a state consistency test: if `blueprint_state_update` reports that the requested phase was ignored because the directory is missing, `/blu-new-milestone` treats the run as incomplete.
- Add a negative test that no future new-milestone path calls `blueprint_roadmap_remove_phase`, cleanup, phase renumber helpers, `fs.rm` for historical phase directories, or `fs.rename` for prior phase directories.

#### Risks

- Prompt-only continuity is too easy to drift. The model can compute the right number in prose, but the actual write path currently accepts any canonical phase artifact path that the prompt supplies.
- The malformed placeholder is already test-locked. Fixing it later will require coordinated updates to command, docs, metadata, and tests.
- Adding the guard only to docs would improve instructions but not runtime safety. The safety-critical pieces are stale-number detection, directory conflict detection, and state-after-scaffold ordering.
- Reusing an existing exact first-phase directory is useful for retry recovery, but it can accidentally bless user-authored content as starter context unless the receipt distinguishes missing, scaffold-only, and authored files.
- A dedicated milestone-start tool would be cleaner but broader. Extending `blueprint_artifact_scaffold` is smaller but risks making a generic scaffold tool too command-aware.

#### Dependency Notes

- Depends on A2 for overwrite-gate copy and user-choice semantics, especially when an exact `NN-CONTEXT.md` already exists.
- Feeds A5 because starter PROJECT/REQUIREMENTS/ROADMAP and first phase context scaffolds must all share the same confirmed first-phase target.
- Feeds A6 because `/blu-discuss-phase <first phase>` routing is only safe if the context path exists and matches `STATE.md`.
- Feeds A7 because any runtime receipt must be reflected in command docs, manifest text, runtime metadata, MCP docs, and tests in one change set.
- Independent of optional roadmapper design in A4: roadmapper can propose grouping and titles, but the parent command/tool-owned guard must own the final phase number, path, and historical-preservation receipt.

### A4 Roadmapper Optional-Agent Contract And No-Subagent Fallback

Owner: A4.

Status: complete.

#### Current Behavior

- `/blu-new-milestone` is allowed to use `blueprint-roadmapper`, but only after `mcp_blueprint_blueprint_config_get` with `scope: "effective"` confirms `workflow.subagents=true` and only when the carry-forward summary needs a second pass for next-milestone grouping. The command still owns final phase numbers and all writes (`commands/blu-new-milestone.toml:5`, `commands/blu-new-milestone.toml:9`, `commands/blu-new-milestone.toml:17`).
- The parent command first reads roadmap state, the `report.milestone-summary` contract, the carry-forward digest, and the `phase.context` contract, then gates reset-versus-carry-forward and starter-doc overwrite decisions before scaffolding and state update (`commands/blu-new-milestone.toml:9-21`).
- `blueprint-roadmap-admin` lists `blueprint-roadmapper` as an optional agent and has a shared no-subagent parity rule, but the `new-milestone` subsection only says to use the roadmapper when grouped synthesis helps and otherwise process one synthesis unit at a time (`skills/blueprint-roadmap-admin/SKILL.md:95-109`, `skills/blueprint-roadmap-admin/SKILL.md:219-232`).
- `blueprint-roadmapper` already has the right generic boundaries: parent owns user gates, routing, and `.blueprint/` persistence; roadmapper is read-only by default; it returns ordered proposals without permanent phase numbers when the parent or MCP owns numbering; it must separate blockers from warnings and reject browser/web-search/shell-only substitutes (`agents/blueprint-roadmapper.md:26-35`, `agents/blueprint-roadmapper.md:60-116`).
- Runtime-owned metadata exposes `blueprint-roadmapper` as the optional agent and includes `blueprint_config_get` in `NEW_MILESTONE_REQUIRED_TOOLS`, but the current runtime note is too compact to describe packet shape, roadmapper mode, or fallback quality (`src/mcp/command-runtime-metadata.ts:354-361`, `src/mcp/command-runtime-metadata.ts:1077-1121`).
- `docs/RUNTIME-REFERENCE.md` lists `blueprint-roadmapper` for `new-milestone`, but its exact MCP destination omits `blueprint_config_get` even though the manifest and runtime-owned metadata require the effective config gate (`docs/RUNTIME-REFERENCE.md:109`, `commands/blu-new-milestone.toml:5`, `src/mcp/command-runtime-metadata.ts:354-361`).
- Current tests assert that the manifest references the roadmapper, the runtime contract exposes the optional agent, and runtime-owned metadata stays docs-free, but they do not assert packet fields, forbidden roadmapper actions, roadmapper-mode receipts, config-gate parity in docs, or no-subagent fallback equivalence (`tests/new-milestone-metadata.test.ts:11-85`).

#### Gaps To Close

- The optional-agent trigger is underspecified. Future text should say the roadmapper is used only when the digest has more than one plausible next-milestone theme, conflicting/dependent carry-forward items, orphaned solutions, unclear first-phase sequencing, or enough retained lessons/deferred ideas that inline grouping would hide uncertainty.
- The current contract has no typed handoff packet. That makes it easy for an implementor to pass raw report text, chat history, or broad repo context to the roadmapper instead of a curated digest.
- The current roadmapper output contract is generic. It does not name `new-milestone`-specific fields such as `roadmapperMode`, provisional first-phase recommendation, carry-forward coverage, learning-action split, requirement transition hints, or evidence scope.
- Parent ownership is present but not operationalized as an acceptance checklist. The parent should reject any roadmapper response that assigns final phase numbers, answers user confirmation gates, writes/scaffolds state, invents outside evidence, or omits uncertainty.
- The no-subagent fallback says "same evidence depth" but not what equal quality means. For `new-milestone`, parity should mean the parent fills the same response contract inline from the same packet, not merely writes a prose summary.
- Runtime/reference parity needs a small future sweep: `blueprint_config_get` appears in command/runtime metadata but not the `new-milestone` row in `docs/RUNTIME-REFERENCE.md` or the tool list in `docs/commands/new-milestone.md`.

#### Exact Roadmapper Packet Shape

Future contract text should define the parent-to-roadmapper packet as the only allowed input shape for a `new-milestone` roadmapper pass:

```ts
type NewMilestoneRoadmapperPacket = {
  packetVersion: "new-milestone-roadmapper/v1";
  command: "/blu-new-milestone";
  roadmapperMode: "requested";
  invocationReason:
    | "multiple-candidate-themes"
    | "dependency-order-unclear"
    | "orphaned-solutions-present"
    | "learning-actions-need-separation"
    | "first-phase-choice-unclear";
  effectiveConfig: {
    workflowSubagents: true;
    source: "mcp_blueprint_blueprint_config_get(scope=effective)";
  };
  currentMilestone: {
    name: string;
    roadmapPath: ".blueprint/ROADMAP.md";
    highestBasePhaseNumber: number;
  };
  candidateNextMilestone: {
    suppliedByUser: boolean;
    proposedName: string | null;
    namingConstraints: string[];
  };
  digestScope: {
    inputsUsed: string[];
    digestSummary: string;
    omittedOrTruncatedInputs: string[];
  };
  carryForwardFacts: {
    validatedOutcomes: string[];
    retainedDecisions: string[];
    openRisks: string[];
    deferredIdeas: string[];
    learningActions: string[];
    staleOrAmbiguousClaims: string[];
    nonCarryForwardItems: string[];
  };
  requirementTransitionHints: Array<{
    sourceRef: string;
    priorRequirementId?: string;
    decisionHint: "carry" | "modify" | "defer" | "retire" | "new" | "uncertain";
    rationale: string;
    uncertainty: "low" | "medium" | "high";
  }>;
  nextPhasePreview: {
    firstPhaseNumberPreview: number;
    phaseContextContractRead: boolean;
    routeTarget: "/blu-discuss-phase <first phase>";
  };
  parentOwned: [
    "user confirmation gates",
    "final milestone name",
    "final phase numbers and slugs",
    "artifact_scaffold calls",
    "state_update call",
    "final response and routing"
  ];
  forbiddenActions: [
    "write files",
    "call MCP mutation tools",
    "assign permanent phase numbers",
    "answer ask_user gates",
    "browse or use web search as replacement truth",
    "invent requirements or evidence outside digestScope"
  ];
  expectedReturn: "NewMilestoneRoadmapperResult";
  stopIf: string[];
};
```

`stopIf` should include missing or empty `inputsUsed`, `workflowSubagents` not true, absent milestone-summary digest, absent `phase.context` contract read, pending reset/overwrite confirmation that the parent has not resolved, or digest contradictions that require user clarification before grouping.

#### Exact Return Contract

The roadmapper should return proposals only. It should not return a finished roadmap, final phase numbers, file paths to create, or MCP arguments for writes.

```ts
type NewMilestoneRoadmapperResult = {
  packetVersion: "new-milestone-roadmapper-result/v1";
  status: "ready" | "blocked" | "provisional";
  invocationReason: NewMilestoneRoadmapperPacket["invocationReason"];
  sourceScope: {
    inputsUsed: string[];
    outsideContextUsed: [];
  };
  recommendedMilestoneFrame: {
    nameSuggestion: string | null;
    objective: string;
    rationale: string;
    confidence: "low" | "medium" | "high";
  };
  orderedProposals: Array<{
    order: number;
    provisionalTitle: string;
    objective: string;
    coveredRequirementsOrGaps: string[];
    carryForwardItems: string[];
    learningActions: string[];
    dependencyNotes: string[];
    successCriteria: string[];
    evidenceRefs: string[];
    uncertainty: "low" | "medium" | "high";
  }>;
  firstPhaseRecommendation: {
    proposalOrder: number | null;
    reason: string;
    blockers: string[];
  };
  coverageSummary: {
    mappedCarryForwardCount: number;
    unmappedCarryForwardItems: string[];
    orphanedSolutions: string[];
    duplicateOrOverlappingThemes: string[];
    readyForParentConfirmation: boolean;
  };
  blockers: string[];
  warnings: string[];
  unresolvedAssumptions: string[];
  parentAcceptanceChecklist: {
    noFinalPhaseNumbers: true;
    noWritesOrMcpMutations: true;
    noUserGateDecisions: true;
    evidenceBoundedToInputsUsed: true;
    blockersBeforeWarnings: true;
  };
};
```

Quality gates for the parent before accepting the result:

- `successCriteria` must have 2-5 observable outcomes for every proposal.
- `sourceScope.inputsUsed` must match the parent digest scope exactly.
- `outsideContextUsed` must be empty unless the parent explicitly supplied an outside brief.
- `orderedProposals` must avoid permanent phase numbers; `order` is only relative order.
- `blockers` must be empty before any scaffold write. Warnings can remain, but they must be surfaced in the confirmation/receipt.
- `coverageSummary.readyForParentConfirmation` must be true before the parent uses the result to seed starter docs.

#### Paste-Ready Future Contract Text

For `commands/blu-new-milestone.toml`, add a short subsection after the carry-forward digest step and before any roadmapper invocation:

```md
Before using `blueprint-roadmapper`, build a `NewMilestoneRoadmapperPacket` from the confirmed roadmap read, effective config, milestone-summary digest, `inputsUsed`, carry-forward facts, requirement transition hints, next whole-number phase preview, and parent-owned boundaries. Use the roadmapper only when grouped carry-forward synthesis materially improves the next milestone frame, such as multiple candidate themes, unclear dependency order, orphaned solution ideas, learning actions that need separation, or an unclear first-phase choice. The roadmapper returns `NewMilestoneRoadmapperResult` only: provisional ordered proposals, coverage notes, blockers, warnings, assumptions, confidence, and a first-phase recommendation by relative order. It must not assign final phase numbers, write files, call MCP mutation tools, decide user gates, browse for replacement truth, or invent evidence outside `inputsUsed`. If no roadmapper is used, fill the same result shape inline from the same packet and mark `roadmapperMode` as `skipped-disabled`, `skipped-unnecessary`, or `unavailable-fallback`.
```

For `skills/blueprint-roadmap-admin/SKILL.md`, replace the current `new-milestone` roadmapper and fallback bullets with:

```md
4. Use `blueprint-roadmapper` only after `blueprint_config_get(scope=effective)` confirms `workflow.subagents=true` and only when a bounded grouping pass materially improves the carry-forward starter scope. Send a `NewMilestoneRoadmapperPacket`, not raw transcripts or unrestricted files.
5. The roadmapper may return only `NewMilestoneRoadmapperResult`: provisional ordered proposals, coverage notes, blockers, warnings, unresolved assumptions, confidence, and a relative first-phase recommendation. The parent command owns final milestone naming, phase numbers, scaffold paths, confirmation gates, MCP writes, state update, final response, and routing.
6. If `blueprint-roadmapper` is disabled, unavailable, or unnecessary, keep parity by filling the same result shape inline from the same packet: process one carry-forward synthesis unit at a time, record retained intent, starter-scope decision, evidence refs, assumptions, warnings, and coverage status, then continue only when the parent can satisfy the same acceptance checklist.
```

For `agents/blueprint-roadmapper.md`, add a command-specific subsection under `## Required Output Contract`:

```md
### `/blu-new-milestone` Result Contract

When the parent sends `NewMilestoneRoadmapperPacket`, return `NewMilestoneRoadmapperResult`. Use only the supplied digest scope and parent-approved reads. Return provisional ordered proposals without permanent phase numbers, plus objective, covered requirement or gap set, carry-forward items, learning actions, dependency notes, 2-5 observable success criteria, evidence refs, blockers, warnings, unresolved assumptions, confidence, and a relative first-phase recommendation. Do not write files, call MCP mutation tools, decide confirmation gates, browse for replacement truth, or invent evidence outside `inputsUsed`.
```

For `src/mcp/command-runtime-metadata.ts`, expand the `NEW_MILESTONE_RUNTIME_METADATA.runtimeReference.contractNotes` string to mention: effective config gate, typed roadmapper packet, roadmapper result, parent-owned writes/numbering/gates, no-subagent same-shape fallback, and a `roadmapperMode` receipt (`used`, `skipped-disabled`, `skipped-unnecessary`, `unavailable-fallback`).

For `docs/RUNTIME-REFERENCE.md`, align the `new-milestone` row with runtime-owned metadata by adding `blueprint_config_get` to the exact MCP destination and adding one concise phrase about the typed roadmapper packet and same-shape inline fallback.

#### Future Edit Targets

- `commands/blu-new-milestone.toml:5-21`: add the packet/result rules near the existing config gate and optional-roadmapper step; keep the command bounded and avoid adding stage narration or todos.
- `skills/blueprint-roadmap-admin/SKILL.md:219-232`: replace the current high-level `new-milestone` roadmapper/fallback bullets with the paste-ready packet, parent ownership, and same-shape fallback text.
- `agents/blueprint-roadmapper.md:91-106`: add the `/blu-new-milestone` result contract under `## Required Output Contract`.
- `src/mcp/command-runtime-metadata.ts:354-361`: keep `blueprint_config_get` in `NEW_MILESTONE_REQUIRED_TOOLS`; use this as the source of truth when repairing docs/reference parity.
- `src/mcp/command-runtime-metadata.ts:1119-1121`: expand the runtime contract note to preserve the roadmapper packet and fallback contract in runtime-owned metadata.
- `docs/RUNTIME-REFERENCE.md:109`: add `blueprint_config_get` to the `new-milestone` exact MCP destination and summarize the roadmapper packet/fallback contract.
- `docs/commands/new-milestone.md:49-74` and `docs/commands/new-milestone.md:85-91`: if future scope includes command docs, add `blueprint_config_get` to reads/tools and replace the flat optional-agent list with the same gate/packet/fallback language.
- `tests/new-milestone-metadata.test.ts:11-85`: add direct assertions for packet/result wording, config gate parity, roadmapper-mode receipt, forbidden substitutions, and no-subagent same-shape fallback.
- `tests/agent-contract-specialists.test.ts:42-68`: add assertions that `blueprint-roadmapper` names the `NewMilestoneRoadmapperResult` contract, forbids final phase numbers/writes/user gates for `new-milestone`, and requires evidence bounded to `inputsUsed`.
- `tests/command-catalog.test.ts:1954-1974`: keep the existing optional-agent and required-tool coverage; add no new catalog semantics unless implementation changes runtime availability.

#### Tests To Add Or Update

- In `tests/new-milestone-metadata.test.ts`, extend the manifest test to assert:
  - `workflow.subagents` and `scope: "effective"` appear before roadmapper use.
  - `NewMilestoneRoadmapperPacket` or equivalent packet language appears.
  - roadmapper use is limited to grouped carry-forward synthesis triggers.
  - final phase numbers, writes, MCP mutations, and user-gate decisions remain parent-owned.
  - fallback fills the same result shape inline.
- In the same file, extend the skill test to assert:
  - the no-subagent fallback names retained intent, starter-scope decision, evidence refs, assumptions, warnings, and coverage status.
  - browser/web-search/shell-only/generic helpers remain forbidden substitutes.
- In the runtime metadata test, assert:
  - `contract.runtimeReference?.contractNotes` includes `roadmapperMode`.
  - `contract.runtimeReference?.contractNotes` includes same-shape fallback wording.
  - `contract.spec?.reads` or runtime reference includes `blueprint_config_get` if the resource projection starts exposing config reads.
- In `tests/agent-contract-specialists.test.ts`, assert the roadmapper agent includes the `/blu-new-milestone` command-specific result contract and the no-final-phase-number/no-write/no-user-gate/evidence-bounded requirements.
- Add or update a docs/reference parity assertion, likely in the metadata or command-contract docs tests, that `docs/RUNTIME-REFERENCE.md` lists `blueprint_config_get` for `new-milestone` whenever `NEW_MILESTONE_REQUIRED_TOOLS` does.

#### Risks

- Over-specifying the packet could make `new-milestone` feel like a long-running planning workflow. Keep the packet compact, single-pass, and parent-owned.
- A roadmapper result can look authoritative even when it is evidence-light. Parent acceptance must require exact `inputsUsed` scope, uncertainty, and blockers-before-warnings.
- The phrase "handoff" can imply control transfer. Production-facing text should prefer "bounded roadmapper pass" or "delegation packet".
- Adding `roadmapperMode` to prose only is useful for support but not machine-checkable. If later implementation needs runtime behavior, make it part of a structured receipt or state/report field rather than only final-response wording.
- If docs/reference parity is fixed without updating tests, the same `blueprint_config_get` drift can return.

#### Dependency Notes

- Depends on A1 for the final carry-forward digest categories and evidence refs.
- Depends on A2 for the confirmed milestone name and reset-versus-carry-forward gate state.
- Depends on A3 for highest-base-phase and first-phase-number preview semantics.
- Depends on A4-owned changes only for the optional-agent packet, result contract, parent acceptance checklist, and inline parity fallback.
- Feeds A5 by producing starter-scope seed material for PROJECT, REQUIREMENTS, ROADMAP, and first `phase.context` scaffolds.
- Feeds A6 by identifying the relative first-phase recommendation and route target for `/blu-discuss-phase <first phase>`.
- Feeds A7 with concrete runtime metadata, docs/reference, and test parity requirements.

### A5 Starter Scaffold Quality For PROJECT, REQUIREMENTS, ROADMAP, And Phase Context

Owner: A5.

Status: complete.

#### Current Behavior

- The command contract says `/blu-new-milestone` builds carry-forward context from `blueprint_artifact_summary_digest`, treats `inputsUsed` as the authoritative evidence scope, reads `phase.context`, and then calls `blueprint_artifact_scaffold` with a "carry-forward bootstrap seed" for `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, `.blueprint/ROADMAP.md`, `.blueprint/phases/`, and the first `NN-CONTEXT.md` (`commands/blu-new-milestone.toml:10-20`).
- The command docs and roadmap-admin skill preserve the same high-level boundary: scaffold output is starter material, not final authored milestone content, and the follow-up must route to `/blu-discuss-phase <first phase>` (`docs/commands/new-milestone.md:76-82`, `skills/blueprint-roadmap-admin/SKILL.md:221-231`).
- Runtime support is more generic than the command wording implies. `ArtifactScaffoldArgs.bootstrapSeed` currently supports the older bootstrap shape only: `vision`, `audience`, `constraints`, `currentMilestone`, `nonGoals`, `requirements`, `roadmapPhases`, `brownfieldMode`, and `assumptions` (`src/mcp/tools/artifacts.ts:130-143`, `src/mcp/tools/artifacts.ts:176-182`). There is no new-milestone-specific seed object for carry-forward source scope, transition decisions, first-phase rationale, or starter-vs-final posture.
- `PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md` render from that bootstrap seed. The renderer can produce substantive, validation-passing docs, but its defaults still describe first bootstrap posture, not a milestone transition from prior saved evidence (`src/mcp/tools/artifacts.ts:1544-1718`, `src/mcp/tools/artifacts.ts:1721-1944`).
- The first phase context path is parsed from the requested artifact path and rendered through the generic `phase.context` scaffold template (`src/mcp/tools/artifacts.ts:2252-2277`). The bootstrap seed does not feed this context renderer, so current first `NN-CONTEXT.md` content is mostly canonical placeholder labels plus the scaffold footer, not a source-scoped handoff.
- The artifact registry keeps the important distinction explicit for phase context: scaffold rendering contains placeholder labels and a footer marker; authoring rendering is final-write-safe; final validation requires removal of scaffold placeholders (`src/mcp/artifact-contracts/index.ts:4001-4059`). The distinction is weaker for bootstrap top-level docs because scaffold and authoring templates point to the same renderers for `bootstrap.project`, `bootstrap.requirements`, and `bootstrap.roadmap` (`src/mcp/artifact-contracts/index.ts:3704-3807`).
- `blueprint_artifact_scaffold` returns only `createdFiles`, `reusedFiles`, and `warnings` (`src/mcp/tools/artifacts.ts:225-229`, `docs/MCP-TOOLS.md:83-88`). It does not return which seed fields were consumed, whether starter-only markers were preserved, or whether the top-level docs are semantically transition-shaped rather than merely structurally valid.

#### Content-Quality Gaps

- **Undefined carry-forward seed quality:** "carry-forward bootstrap seed" is not specified enough for an implementor or model to know what belongs in each starter artifact. The command can satisfy the prompt with generic bootstrap fields while losing digest provenance, uncertainty, and transition rationale.
- **PROJECT.md can validate while under-explaining the transition:** current headings support milestone framing, but no required or recommended section names the transition mode, source summary, `inputsUsed`, target outcome, retained decisions, do-not-carry-forward items, or reset rationale.
- **REQUIREMENTS.md lacks transition decisions:** the existing requirement row shape can carry IDs, scope, group, status, and notes, but it cannot distinguish carried, modified, deferred, retired, new, or self-derived requirements as first-class transition decisions. A regenerated requirements table can silently copy, rewrite, or omit old requirements without making the disposition inspectable.
- **ROADMAP.md lacks first-slice rationale:** the roadmap model requires phases, requirement IDs, objective, status, dependencies, and 2-5 success criteria, but the new-milestone workflow needs extra starter quality: why the first phase is first, which outcome or gap it serves, which later candidates are deliberately deferred, and what evidence produced the ordering.
- **First `NN-CONTEXT.md` is a weak handoff:** the current phase context scaffold is aligned with the canonical headings, but it does not carry the next milestone theme, first-phase objective, requirement transition summary, open questions, risk watchlist, or evidence references into `/blu-discuss-phase`.
- **Starter-versus-final boundary can blur in both directions:** if the seed is too generic, downstream users get valid-looking but low-value starter docs; if it is too rich and lacks a starter marker, downstream commands may mistake transition seed material for final authored phase context. The future design needs richer starter content while still making `/blu-discuss-phase` the owner of final `phase.context`.

#### Proposed Seed Model And Sections

Use a future `NewMilestoneStarterSeed` concept as the shared input model behind command text, skill guidance, optional roadmapper output, and scaffold/runtime tests. It may be implemented by extending `bootstrapSeed`, adding a sibling `newMilestoneSeed`, or adding a command-owned adapter that converts the transition packet into the existing bootstrap seed. The important contract is the shape, not the exact TypeScript name.

Minimum seed groups:

- `transition`: mode (`carry-forward` or `fresh-reset`), previous milestone, target milestone, first phase number, starter-only flag, confirmation state, and reset rationale when applicable.
- `sourceScope`: milestone summary path, `.blueprint/ROADMAP.md`, returned `inputsUsed`, missing or skipped inputs, digest warnings, and any explicitly low-confidence carry-forward claims.
- `outcomeFrame`: target outcome, measurable or explicitly unknown signals, unresolved value gaps, delivery constraints, retained strengths, and do-not-carry-forward items.
- `requirementTransitions`: rows for carried, modified, deferred, retired, new, and self-derived requirements, each with source refs, rationale, uncertainty, and new requirement ID when active.
- `roadmapSlice`: first-phase title/objective, `whyFirst`, requirement IDs, 2-5 success criteria, dependencies, inspectable progress, deferred-not-now items, and later candidate phases at lower detail.
- `firstContextHandoff`: phase boundary starter, discovery grounding, confirmed transition decisions, specific ideas, existing code or artifact insights when known, dependencies, open questions, deferred ideas, and canonical references.
- `starterDocPlan`: exact artifact paths, intended operation per path, and the statement that generated scaffold text is starter material until refined by the owning follow-up command.

Artifact section mapping:

- `PROJECT.md`: keep existing required headings. Populate `Current Milestone`, `Scope Posture`, and `Assumptions` from the transition and outcome frame. Add an optional `## Milestone Transition` section under the existing freehand policy to show mode, source scope, target outcome, retained decisions, reset/carry-forward note, and do-not-carry-forward summary.
- `REQUIREMENTS.md`: keep `Requirements Table`, `Scope Summary`, committed/deferred/out-of-scope sections, `Traceability Notes`, and `Open Questions`. Add an optional `## Milestone Requirements Transition Ledger` with compact disposition rows. Active rows must preserve durable IDs when semantics are unchanged; materially changed rows should get a new ID plus a legacy/source reference.
- `ROADMAP.md`: keep the schema-owned rendered headings. The first phase should be the next whole-number phase and should include requirement IDs, objective, and 2-5 success criteria. Add optional phase detail or notes fields for `whyFirst`, `inspectableProgress`, `deferredNotDoingNow`, `sourceRefs`, and uncertainty while preserving the existing roadmap model vocabulary.
- First `NN-CONTEXT.md`: render a richer starter handoff under canonical `phase.context` headings, but keep a visible starter marker and scaffold footer so it remains a launch scaffold for `/blu-discuss-phase`, not a completed discuss-phase context. The handoff should say what to refine, what evidence to read first, and what decisions are already confirmed by the transition gate.

#### Paste-Ready Scaffold-Seed Expectations

Future command and skill text can use this exact expectation block before calling `blueprint_artifact_scaffold`:

```text
Before scaffold writes, build a New Milestone Starter Seed.

Required:
- schemaVersion: new-milestone-starter-seed/v1
- mode: carry-forward or fresh-reset
- starterOnly: true
- previousMilestone and targetMilestone
- firstPhaseNumber, firstPhaseTitle, and firstPhasePath
- sourceScope.inputsUsed exactly from blueprint_artifact_summary_digest
- sourceScope.summaryPath and sourceScope.roadmapPath
- sourceScope.missingOrSkippedInputs, or an explicit empty list
- outcomeFrame.targetOutcome
- outcomeFrame.measurableSignals, allowing "unknown: <reason>"
- outcomeFrame.valueGaps and deliveryConstraints
- requirementTransitions with decision, sourceRefs, rationale, and uncertainty
- roadmapSlice.whyFirst, requirementIds, objective, and 2-5 successCriteria
- firstContextHandoff.openQuestions, deferredIdeas, requiredFollowUpReads, and canonicalReferences

Quality rules:
- Every durable carry-forward claim must cite a source in inputsUsed or be labeled as inference.
- Every active roadmap requirement ID must exist in the generated REQUIREMENTS.md rows.
- Deferred or retired requirements must have a revisit trigger, exit criterion, or rationale.
- The first phase context must keep a starter marker and must route to /blu-discuss-phase <first phase>.
- Do not copy placeholder labels, generic none rows, old milestone slogans, or final-authored phase context language into starter docs.
- Do not use scaffold output as final authored content; it remains starter material until owner review or a future approved authoring path refines top-level docs, and discuss-phase owns final phase.context.
```

#### Exact Future Edit Targets

- `commands/blu-new-milestone.toml:12-19`: expand the digest and scaffold steps to require a named transition starter seed with `sourceScope`, `outcomeFrame`, `requirementTransitions`, `roadmapSlice`, and `firstContextHandoff`; keep the overwrite and reset gates before the scaffold call.
- `commands/blu-new-milestone.toml:23-33`: add a response requirement that the completion summary identifies starter-only artifacts and the route to `/blu-discuss-phase <first phase>`; do not imply final authorship.
- `docs/commands/new-milestone.md:31-38`: add starter-seed prerequisites: milestone summary path, `inputsUsed`, confirmed mode, and first-phase preview.
- `docs/commands/new-milestone.md:76-82`: replace the broad carry-forward bullets with the paste-ready seed expectation block or a concise reference to it.
- `docs/commands/new-milestone.md:142-162`: add acceptance criteria and test cases for source-scoped seed content, requirement transition ledger, first-slice rationale, starter-only phase context, and absence of final-authored wording.
- `skills/blueprint-roadmap-admin/SKILL.md:221-231`: add the same seed-building checklist to the `new-milestone` lane, including the inline no-subagent fallback shape for filling the seed one unit at a time.
- `src/mcp/tools/artifacts.ts:130-143` and `src/mcp/tools/artifacts.ts:176-182`: add the future seed type or adapter input. Keep backward compatibility for existing `bootstrapSeed` callers.
- `src/mcp/tools/artifacts.ts:1990-2020`: extend Zod validation for the new seed or add a dedicated schema that rejects missing `sourceScope.inputsUsed`, missing first-phase details, orphan requirement IDs, and unlabeled inference.
- `src/mcp/tools/artifacts.ts:1721-1944`: update PROJECT/REQUIREMENTS/ROADMAP renderers to consume transition seed fields without breaking current bootstrap output.
- `src/mcp/tools/artifacts.ts:2252-2277`: let phase context scaffolding consume the first-context starter handoff while preserving the starter marker and canonical headings.
- `src/mcp/artifact-contracts/index.ts:3704-3807`: add contract notes for new-milestone transition scaffolding on bootstrap artifacts, or introduce a separate transition-specific contract if overloading bootstrap contracts becomes misleading.
- `src/mcp/artifact-contracts/index.ts:4001-4059`: add notes that a new-milestone context scaffold may include seed handoff content but remains non-final until `/blu-discuss-phase` rewrites it.
- `docs/ARTIFACT-SCHEMA.md:72-125` and `docs/ARTIFACT-SCHEMA.md:273-307`: document which starter sections are allowed for new-milestone transition scaffolds and preserve the scaffold-vs-final distinction.
- `docs/MCP-TOOLS.md:83-88`, `docs/MCP-TOOLS.md:190-193`, and `docs/MCP-TOOLS.md:241-250`: document the richer seed input and clarify that `createdFiles`/`reusedFiles` are touch receipts, not content-quality proof. If R8 recovery work adds per-path receipts first, align with that result instead of inventing a second receipt vocabulary here.
- `src/mcp/command-runtime-metadata.ts:1078-1124`: after docs/runtime behavior changes are approved, update runtime metadata contract notes so `blueprint://commands/new-milestone/runtime-contract` reflects the same seed shape.

#### Tests To Add Or Update

- Update `tests/new-milestone-metadata.test.ts:11-85` so manifest, skill, and runtime-contract text assert the seed shape: `sourceScope.inputsUsed`, `outcomeFrame`, `requirementTransitions`, `whyFirst`, `starterOnly`, and `/blu-discuss-phase <first phase>`.
- Add a scaffold behavior test, preferably in a new `tests/new-milestone-scaffold.test.ts`, that calls `blueprintArtifactScaffold` with a representative transition seed and asserts:
  - PROJECT includes target milestone, source scope, transition mode, target outcome, and starter-only language.
  - REQUIREMENTS includes durable IDs plus carried/modified/deferred/retired/new disposition notes.
  - ROADMAP starts at the supplied next whole-number phase, maps only declared requirement IDs, includes `whyFirst` or equivalent notes, and keeps 2-5 success criteria.
  - The first context contains the starter handoff and canonical references, but also retains a starter marker so phase readiness still routes to `/blu-discuss-phase`.
- Add negative seed-validation tests for missing `inputsUsed`, requirement transitions that cite sources outside `inputsUsed`, active roadmap IDs absent from REQUIREMENTS, first phase without success criteria, and first context that omits starter-only posture.
- Update `tests/new-project.test.ts:382-492` only if shared renderers change. Existing new-project assertions should keep passing for normal bootstrap seeds; new-milestone transition fields must not leak into ordinary `/blu-new-project` output.
- Update `tests/artifact-contracts.test.ts:1042-1069` or add a sibling parity test for `new-milestone` starter notes in `docs/ARTIFACT-SCHEMA.md` and `docs/MCP-TOOLS.md`.
- Add a focused phase-readiness test near the existing scaffold tests (`tests/phase-discovery-research.test.ts:812-866` or a new test file) proving that a seeded new-milestone `NN-CONTEXT.md` is helpful but still not considered final usable phase context.

#### Risks

- Overloading `bootstrap.*` contracts could make `PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md` sound like they are still owned only by `/blu-new-project`; if the transition semantics grow, a separate new-milestone transition seed or contract note is cleaner.
- Rich first-context seeding can accidentally bypass `/blu-discuss-phase` if it removes scaffold markers or looks like final model-authored context. Preserve starter markers and test readiness behavior explicitly.
- Too many ledger fields could make a bounded milestone restart feel like `/blu-plan-phase`. Keep top-level docs compact, with source pointers and counts rather than exhaustive history.
- Requirement transition rows can create false precision if a model invents carry/modify/defer decisions without evidence. Require uncertainty labels and source refs, and push ambiguous decisions into confirmation or discuss-phase.
- If content-quality assertions depend on exact prose, future refactors will be brittle. Tests should assert semantic markers, section presence, IDs, source refs, and route posture instead of long wording.

#### Dependency Notes

- Depends on A1 for the digest/source-scope shape and any future claim-level evidence ledger coming from `blueprint_artifact_summary_digest`.
- Depends on A2 for reset-versus-carry-forward and overwrite confirmation receipts; the seed should record confirmed mode but should not own the gate.
- Depends on A3 for the authoritative first phase number and historical directory preservation rules.
- Depends on A4 for optional `blueprint-roadmapper` output parity; roadmapper should return provisional seed inputs, not final artifact prose.
- Feeds A6 by defining what the first `NN-CONTEXT.md` handoff should contain before `/blu-discuss-phase <first phase>` takes over.
- Depends on A7 for contract parity across manifest, command docs, skill text, runtime metadata, MCP docs, and tests.
- Should align with R8 recovery work if per-path scaffold receipts or run tokens land first; content-quality seed fields and recovery receipts should be complementary, not two competing sources of truth.

### A6 Downstream `/blu-discuss-phase <first phase>` Handoff

Owner: Codex A6 analysis lane.

Status: complete.

#### Current Behavior

- `/blu-new-milestone` already reads the `phase.context` contract before first context scaffolding, then calls `blueprint_artifact_scaffold` for `.blueprint/phases/<NN>-<slug>/<NN-CONTEXT.md>` and routes state to `/blu-discuss-phase <first phase>` (`commands/blu-new-milestone.toml` lines 16, 19-21, 33).
- The command docs say the first context scaffold exists so discuss-phase has a valid target, but they do not describe what useful transition facts should be present in that scaffold (`docs/commands/new-milestone.md` lines 76-82, 145-150).
- `blueprint-roadmap-admin` tells `new-milestone` to compress carry-forward into retained intent, starter-scope decisions, and unresolved assumptions before scaffolding, but it stops short of naming a downstream packet shape for discuss-phase (`skills/blueprint-roadmap-admin/SKILL.md` lines 221-231).
- `/blu-discuss-phase` has the stronger receiving contract: read existing phase context/logs, treat scaffolds as disposable seed, build a structured `phase.context` model, preserve evidence, deferred ideas, assumptions, and canonical references, then route from refreshed state rather than assuming `/blu-plan-phase` (`commands/blu-discuss-phase.toml` lines 14-20, 28-30; `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` lines 166-196, 206-231, 244-249).
- The live `phase.context` schema is strict and model-owned. It has no `handoff` field; future implementation must either map the packet into existing model sections or intentionally update the schema/renderer/tests together (`src/mcp/artifact-contracts/schemas/phase.context.model.schema.json` lines 5-18, 56-79, 130-178).
- Current `blueprint_artifact_scaffold` accepts a `bootstrapSeed` for top-level starter docs and phase path scaffolding, but there is no typed `firstPhaseHandoff` input for the context renderer (`src/mcp/tools/artifacts.ts` lines 1960-2020). The existing `phase.context` scaffold intentionally includes placeholder labels and a scaffold footer so discuss-phase can recognize starter material (`src/mcp/artifact-contracts/index.ts` lines 4001-4059).

#### Downstream Contract Gaps

- The transition currently promises a valid target directory, not a useful discuss-phase starting point. The first `XX-CONTEXT.md` can be present while still containing only generic scaffold text.
- There is no explicit bridge from `artifact_summary_digest.inputsUsed` to first-phase `Canonical References`, so discuss-phase can lose provenance unless it rereads broad prior artifacts.
- Deferred assumptions, deferred requirements, stale risks, and "not doing now" decisions can be compressed into top-level starter docs while never becoming discuss-phase gray areas.
- Route text is still partly imprecise. `docs/commands/new-milestone.md` line 20 says "route to requirements", while the runtime contract routes to `/blu-discuss-phase <first phase>`. User-visible completion text should use the resolved phase number, for example `/blu-discuss-phase 7`, not the placeholder token.
- There is no receiver-side rule that says "when this phase was created by `/blu-new-milestone`, read the transition packet first, treat it as seed evidence, and ask only the missing or high-impact questions."
- There is no test that proves a first-phase seed preserves deferred risks and assumptions through discuss-phase validation instead of dropping them or preserving the scaffold verbatim.

#### Exact Handoff Packet Proposal

Add a future starter-only `New Milestone First-Phase Handoff Packet` concept. It should be compact, source-scoped, and explicitly disposable: `/blu-new-milestone` may seed it, but `/blu-discuss-phase` must replace it with authored `phase.context` model output.

Recommended packet fields:

| Field | Required | Purpose |
|---|---:|---|
| `mode` | yes | `carry-forward` or `fresh-reset`; prevents discuss-phase from assuming historical continuity after an explicit reset. |
| `fromMilestone` / `toMilestone` | yes | Names the transition boundary. |
| `firstPhase` | yes | Resolved phase number, title or slug, objective, requirement IDs, success criteria, `whyFirst`, and `inspectableProgress`. |
| `digestInputsUsed` | yes for carry-forward | Exact repo-relative source paths returned by `blueprint_artifact_summary_digest.inputsUsed`; fresh reset should say `none - fresh reset confirmed`. |
| `retainedDecisions` | optional | Prior decisions that are still allowed to shape the new phase, each with evidence refs and confidence. |
| `activeRequirementTransitions` | optional | Carried, modified, new, deferred, or retired requirement notes relevant to the first phase. |
| `openForDiscuss` | yes | Questions or gray areas discuss-phase should ask about first, with evidence refs, confidence, and consequence if wrong. |
| `riskWatchlist` | optional | Risks, stale assumptions, or dependency concerns that are not decisions yet. |
| `deferredNotDoingNow` | yes | Important carry-forward items intentionally outside the first phase, with reason and revisit trigger. |
| `canonicalReferences` | yes | Source paths plus relevance; every source should be in `digestInputsUsed` or explicitly marked `new-milestone inference`. |
| `routeReceipt` | yes | Exact next action using the resolved phase number, for example `/blu-discuss-phase 7`. |

Over-authoring guardrails:

- Cap the packet to roughly 12-18 bullets total. It should help discuss-phase ask better questions, not pre-answer the phase.
- Do not write final implementation decisions for unresolved first-phase gray areas. Use `openForDiscuss` with confidence and consequence instead.
- Do not infer codebase facts that were not in the digest or refreshed repo evidence. Mark unverified claims as assumptions.
- Preserve deferred material as `deferredNotDoingNow`, `riskWatchlist`, or `openForDiscuss`; do not collapse it into "none".
- Map packet content into existing `phase.context` model sections unless a later implementation deliberately extends the schema:
  - `firstPhase` -> `phaseBoundary`
  - `mode`, milestone transition, retained decisions -> `discoveryGrounding`
  - confirmed carry-forward decisions only -> `implementationDecisions`
  - user/source examples -> `specificIdeas`
  - known reusable/gap evidence -> `existingCodeInsights`
  - `digestInputsUsed`, required follow-up reads -> `dependencies`
  - `openForDiscuss` -> `openQuestions`
  - `deferredNotDoingNow` and unresolved risks -> `deferredIdeas`
  - `canonicalReferences` -> `canonicalReferences`

#### Paste-Ready Prompt / Contract Text

Future `/blu-new-milestone` command or skill text:

```text
Before scaffolding the first new phase context, build a compact New Milestone First-Phase Handoff Packet from the carry-forward digest and confirmed transition mode. Include: mode, fromMilestone, toMilestone, firstPhase {phaseNumber, title, objective, requirementIds, successCriteria, whyFirst, inspectableProgress}, digestInputsUsed, retainedDecisions, activeRequirementTransitions, openForDiscuss, riskWatchlist, deferredNotDoingNow, canonicalReferences, and routeReceipt.

Treat the packet as starter-only seed material for /blu-discuss-phase, not as authored phase context. Keep it source-scoped to blueprint_artifact_summary_digest.inputsUsed unless a row is explicitly labeled new-milestone inference. Preserve deferred assumptions, risks, and not-now items as downstream questions or deferred ideas instead of dropping them. Do not fill final implementation decisions that belong to /blu-discuss-phase.

In the completion response, name the scaffolded context path and the exact next action using the resolved phase number, for example /blu-discuss-phase 7. Do not use the placeholder <first phase> in user-visible route text once the phase number is known.
```

Future `/blu-discuss-phase` receiving text:

```text
When the selected phase was just scaffolded by /blu-new-milestone, read the first-phase handoff packet as seed evidence before asking questions. Treat it as disposable starter material: carry forward its source refs, deferred risks, and open gray areas into the structured phase.context model, but do not preserve the packet heading, scaffold footer, placeholder labels, or unsupported claims in the final XX-CONTEXT.md.

Ask only for missing, contradictory, uncertain, or high-impact details. If the packet marks an assumption or risk with a consequence-if-wrong, either confirm it with the user, convert it into an implementation decision with evidence, or keep it in Open Questions/Deferred Ideas. After writing context, report the refreshed derivedStatus.nextAction exactly; do not infer /blu-plan-phase from context completion.
```

#### Future Edit Targets

- `commands/blu-new-milestone.toml` lines 16 and 19-21: add the packet-build requirement between contract-read and scaffold/state update; make final route text resolved-phase-specific.
- `docs/commands/new-milestone.md` line 20: replace "route to requirements" with "seed starter milestone docs and route to `/blu-discuss-phase <first phase>`"; lines 76-82 and 145-150 should mention the starter-only packet and exact route receipt.
- `skills/blueprint-roadmap-admin/SKILL.md` lines 221-231: add the packet fields and no-over-authoring guardrails under `new-milestone`; line 249 should require exact resolved route text in output.
- `src/mcp/command-runtime-metadata.ts` lines 1097-1120: update purpose/contract notes only after command docs and skill text change, keeping metadata parity with prompt behavior.
- `src/mcp/tools/artifacts.ts` lines 1960-2020 and `src/mcp/artifact-contracts/index.ts` lines 4001-4059: if implementation wants deterministic seeded context content, extend the scaffold input/rendering path with a typed `firstPhaseHandoff` or equivalent. Do not add prompt-only expectations without a renderer/test path.
- `skills/blueprint-phase-discovery/SKILL.md` lines 183-199 and `commands/blu-discuss-phase.toml` lines 14-20, 28-30: add receiver-side rules for reading the packet as seed evidence, preserving deferred material, and replacing scaffold text with model-rendered context.
- `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` lines 110-142 and 166-196: add the receiving/mapping rules near single-agent fallback, assumptions mode, and artifact authoring.
- `src/mcp/artifact-contracts/schemas/phase.context.model.schema.json` lines 5-18, 56-79, 130-178: avoid schema changes unless the packet cannot map into existing sections. If a new model field is added, update renderer, schema asset tests, model validation tests, and built schema assets together.

#### Tests To Add Or Update Later

- Extend `tests/new-milestone-metadata.test.ts` lines 11-42 and 44-61 to assert command and skill text mention `New Milestone First-Phase Handoff Packet`, `digestInputsUsed`, `openForDiscuss`, `riskWatchlist`, `deferredNotDoingNow`, and resolved-phase route text.
- Extend `tests/command-contract-docs.test.ts` lines 1327-1339 so docs reject the stale "route to requirements" wording and require the starter-only handoff packet plus `/blu-discuss-phase <first phase>` contract.
- Add or extend a behavior test near `tests/phase-discovery-discuss.test.ts` lines 464-535: seed a first-phase handoff, run the context write path, and assert final context preserves canonical references, open questions, and deferred ideas while removing scaffold packet text.
- Extend the anti-pattern coverage near `tests/phase-discovery-discuss.test.ts` lines 778-842 to block final context that drops packet-marked deferred risks or preserves the packet verbatim.
- If `blueprint_artifact_scaffold` gets a typed packet input, add tool-level tests beside existing scaffold coverage to assert per-path created/reused behavior, no overwrite without confirmation, and deterministic rendering of the packet into starter-only context.
- If the `phase.context` schema changes, update `tests/context-diagnostics.test.ts`, `tests/artifact-contracts.test.ts`, `tests/built-schema-assets.test.ts`, and any model helper fixtures so the model-only context write remains the single final persistence path.

#### Risks

- Over-authoring risk: if the packet contains too many "decisions", `/blu-new-milestone` becomes a hidden discuss-phase. Keep unresolved work as questions, assumptions, risks, or deferred ideas.
- Under-handoff risk: if the scaffold remains generic, discuss-phase repeats previous milestone synthesis and may lose deferred risks. The packet should carry just enough evidence and uncertainty to avoid starting cold.
- Schema drift risk: adding a dedicated handoff field to `phase.context` would affect schema, renderer, validation, docs, and tests. Prefer mapping to existing fields unless a concrete consumer requires the new field.
- Provenance risk: references outside `inputsUsed` can make the digest boundary meaningless. Require explicit `new-milestone inference` labeling for anything not sourced from the digest.
- Route drift risk: using `<first phase>` in final user text after resolution can confuse users and tests. Runtime-facing templates may keep the placeholder; completion receipts should use the actual phase number.
- Fresh-reset risk: a reset packet can accidentally imply carry-forward continuity. In reset mode, use explicit empty source scope and ask discuss-phase to build context from current starter docs and user answers.

#### Dependency Notes

- A6 depends on A1/R1 digest quality for `inputsUsed` and evidence rows, A2/R3 confirmation gates for mode/overwrite certainty, A4/R6 optional roadmapper output quality, and A5 scaffold mechanics.
- This proposal is compatible with the current discuss-phase ownership boundary: `/blu-discuss-phase` remains the only command that authors or repairs final phase context.
- Implementation should land as a contract set: new-milestone manifest, roadmap-admin skill, discuss-phase manifest/skill/runtime reference, docs, runtime metadata, scaffold/schema code only if needed, and tests in the same future slice.

### A7 Runtime Metadata, Docs, And Test Coverage Parity

Owner: Codex A7 analysis lane.

Status: complete.

#### Current Parity Surfaces

- `src/mcp/command-runtime-metadata.ts` is the live runtime-owned truth for `/blu-new-milestone`. `NEW_MILESTONE_REQUIRED_TOOLS` currently includes `blueprint_roadmap_read`, `blueprint_artifact_contract_read`, `blueprint_artifact_summary_digest`, `blueprint_config_get`, `blueprint_artifact_scaffold`, and `blueprint_state_update` (lines 354-361). `NEW_MILESTONE_RUNTIME_METADATA` declares the command implemented, `interactive-read`, root-routable, optional `blueprint-roadmapper`, manifest-only skill input, `.blueprint/` write set, waiting states, historical preservation, and `/blu-discuss-phase <first phase>` routing (lines 1077-1123).
- `commands/blu-new-milestone.toml` is the active model-facing prompt loaded by the roadmap-admin skill. It already calls `mcp_blueprint_blueprint_config_get` before any optional roadmapper pass, reads `report.milestone-summary`, digests explicit repo-relative inputs, treats carry-forward as default, gates fresh reset and starter-doc overwrite, reads `phase.context`, scaffolds starter docs through MCP, updates state, and forbids progress/todo/tracker expansion (lines 5-33).
- `skills/blueprint-roadmap-admin/SKILL.md` keeps roadmap-admin command inputs docless through `input_bundles`, with `/blu-new-milestone` loading only `commands/blu-new-milestone.toml` (lines 17-35, 64-77). Its generic required-tool list and `new-milestone` checklist carry the digest, contract-read, scaffold, historical-preservation, and route boundaries (lines 79-94, 219-232), while output and completion self-check language preserve path/receipt/warning discipline (lines 240-263).
- `docs/commands/new-milestone.md` is the human-facing command spec. It documents the shared contract, required reads and writes, carry-forward contract, optional roadmapper, confirmation gates, failure modes, acceptance criteria, and high-level test cases (lines 9-162).
- `docs/RUNTIME-REFERENCE.md` is the control-plane runtime reference. Its Wave 2 row for `new-milestone` lists the command spec, primary skill, exact MCP destination, optional roadmapper, hooks, waiting states, historical preservation, and route target (line 109). The general reference warns that future metadata changes must stay aligned across catalog, skill inventory, runtime reference, and per-command specs (line 30).
- `docs/MCP-TOOLS.md` owns shared MCP public documentation. It documents the generic `blueprint_artifact_scaffold` and `blueprint_artifact_summary_digest` return shapes (lines 83-94), the read-only command resource contract (lines 145-164), scaffold rules and receipt boundaries (lines 241-250), and the current roadmap-admin command tool summary for `new-milestone` (line 193).
- `docs/COMMAND-CATALOG.md` keeps the declared control-plane row for `new-milestone`: Wave 2, `blueprint-roadmap-admin`, implemented, starter-doc plus first-context plus state writes, and medium carry-forward scaffold risk (line 32). It is not the live availability authority, but catalog tests keep it aligned enough for docs users.
- Current tests cover different slices instead of one full parity oracle: `tests/new-milestone-metadata.test.ts` checks manifest, skill, and runtime-contract resource text (lines 11-85); `tests/command-catalog.test.ts` keeps implemented status, required tools, optional agents, and optional-agent config gating locked (lines 993-1005 and 1954-1975); `tests/command-contract-docs.test.ts` checks command docs at a shallow behavior level (lines 1327-1339); `tests/roadmap-admin-runtime-contract-resource.test.ts` proves roadmap-admin runtime contracts stay docs-free when `docs/` is unavailable (lines 11-87); `tests/extension-runtime-contracts.test.ts` verifies shipped manifests reference every required MCP tool by runtime FQN and every optional agent by runtime name (lines 273-340).

#### Likely Drift Points

- `blueprint_config_get` is already runtime-required because `new-milestone` exposes optional `blueprint-roadmapper`, and the manifest already calls its FQN. Several doc-facing inventories still omit it: `src/mcp/command-runtime-metadata.ts` `spec.reads` lines 1098-1102, `docs/commands/new-milestone.md` reads/tools lines 49-74, `docs/RUNTIME-REFERENCE.md` line 109, `docs/MCP-TOOLS.md` line 193, and `skills/blueprint-roadmap-admin/SKILL.md` required-tool list lines 79-94. Future work should treat this as the first parity repair before adding richer packet fields.
- Runtime-contract truth is split by design. The live `blueprint://commands/new-milestone/runtime-contract` path uses runtime metadata plus manifest-derived skill inputs, while `docs/RUNTIME-REFERENCE.md` remains a control-plane reference row. A future implementor can accidentally update the docs row and leave `NEW_MILESTONE_RUNTIME_METADATA` stale, or update metadata and leave docs/tests asserting the old row.
- The planned `New Milestone Transition Packet`, confirmation receipts, roadmapper packet, first-phase handoff packet, and recovery receipts will touch overlapping wording surfaces. If these terms land in only the manifest or only command docs, the roadmap-admin skill, runtime metadata, MCP docs, runtime-contract resource, and tests will disagree about whether they are prompt-only guidance or structured MCP-owned behavior.
- `blueprint_artifact_summary_digest` and `blueprint_artifact_scaffold` currently have generic return contracts. Adding command-specific packet, evidence, or per-path receipt expectations to `docs/MCP-TOOLS.md` without changing tool behavior would make the public MCP docs overpromise. If the packet is model-built from `{digest, inputsUsed}`, say that; if a tool returns it, update source, docs, tests, and built assets together.
- The roadmap-admin skill is intentionally docless at runtime. Adding a new `docs/commands/new-milestone.md` dependency to `input_bundles` would break the docs-unavailable runtime-contract test. If a richer command-local runtime reference is needed, prefer a skill-local reference file and update the expected input bundle deliberately.
- `docs/COMMAND-CATALOG.md` should not become a place to route behavior. It can update key writes/risk if future source changes alter durable write surfaces, but implemented status should continue to derive from manifest, skill, and required MCP tool availability through the live catalog.
- Route wording still has one stale docs symptom: `docs/commands/new-milestone.md` line 20 says "route to requirements", while the active command route is `/blu-discuss-phase <first phase>`. This should be fixed when the docs parity slice lands.
- Tests currently assert broad prose presence more than behavior classes. Future packet/receipt work should avoid brittle full-sentence regexes and instead assert stable field names, required tools, source ownership, no-docs runtime inputs, implemented-only routing, and forbidden regressions.

#### Exact Future Edit Targets

- `src/mcp/command-runtime-metadata.ts` lines 354-361: keep `NEW_MILESTONE_REQUIRED_TOOLS` synchronized with any new MCP behavior. If optional roadmapper remains available, `blueprint_config_get` must stay required. Add any new runtime tool here before adding it to docs or command text.
- `src/mcp/command-runtime-metadata.ts` lines 1077-1123: update `purpose`, `spec.reads`, `spec.writes`, and `runtimeReference.contractNotes` in the same patch as manifest/docs changes. Minimum near-term repair: add `blueprint_config_get -> effective config` to `spec.reads`, and mention any future transition packet, gate receipt, first-phase handoff, or recovery receipt only at the level actually supported by the command/tool implementation.
- `commands/blu-new-milestone.toml` lines 5-21 and 23-33: keep runtime FQNs, required flow order, waiting states, write boundary, and final route synchronized with metadata. Add packet/receipt language near the digest, confirmation, scaffold, state update, and response steps instead of appending disconnected guidance.
- `skills/blueprint-roadmap-admin/SKILL.md` lines 17-35 and 64-77: keep `/blu-new-milestone` runtime inputs manifest-only unless a deliberate skill-local runtime reference is introduced. If a new reference file is introduced, update these lines and the docs-unavailable test in the same slice.
- `skills/blueprint-roadmap-admin/SKILL.md` lines 79-94: add `blueprint_config_get` to the generic required-tool inventory so the skill matches runtime metadata and optional-subagent gating. Lines 100-109, 219-232, 240-249, and 251-263 should then gain the same packet, no-subagent same-shape fallback, receipt, and output language as the manifest.
- `docs/commands/new-milestone.md` line 20: replace stale "route to requirements" wording with the actual starter-doc plus `/blu-discuss-phase <first phase>` route. Lines 31-38, 49-74, 76-82, 117-122, 133-139, and 142-162 should add `blueprint_config_get`, packet fields, confirmation receipt fields, scaffold/state receipt expectations, and route wording in the same future docs pass.
- `docs/RUNTIME-REFERENCE.md` line 109: add `blueprint_config_get` to the exact MCP destination and summarize the approved packet/receipt semantics. If live runtime-contract metadata remains source-owned, consider changing the row's command spec path/evidence tag to mirror the source-owned pattern used by other runtime-owned rows, but only with matching tests.
- `docs/MCP-TOOLS.md` lines 83-94, 145-164, 186-193, and 241-250: add `blueprint_config_get` to the `new-milestone` summary and document packet/receipt details only where MCP behavior supports them. Keep `blueprint_artifact_summary_digest` as `{digest, inputsUsed}` unless the tool itself changes.
- `docs/COMMAND-CATALOG.md` line 32: update only if future work changes key writes, risk, or declared status. Do not use this row to express packet internals or runtime tool order.
- `tests/new-milestone-metadata.test.ts` lines 11-85: strengthen the manifest, skill, and runtime metadata assertions for `blueprint_config_get`, `spec.reads`, `New Milestone Transition Packet`, `inputsUsed`, evidence/requirement/learning ledgers, named confirmation gates, same-shape no-subagent fallback, first-phase handoff, and receipt/route fields.
- `tests/command-catalog.test.ts` lines 993-1005 and 1954-1975: keep the optional-agent config invariant and required-tool set locked. Add a focused assertion that the `new-milestone` runtime-contract resource exact MCP destination equals `NEW_MILESTONE_REQUIRED_TOOLS` and includes `blueprint_config_get`.
- `tests/command-contract-docs.test.ts` lines 1327-1339 and 1355-1411: update command-doc assertions so `new-milestone` docs mention `blueprint_config_get`, do not say "route to requirements", and stay aligned with the runtime reference row for optional-subagent tool inventories.
- `tests/roadmap-admin-runtime-contract-resource.test.ts` lines 11-87: preserve the docs-unavailable guarantee. If a new skill-local runtime reference replaces manifest-only input, change `ROADMAP_ADMIN_COMMAND_INPUTS["new-milestone"]` and assert the new path is not under `docs/`.
- `tests/extension-runtime-contracts.test.ts` lines 273-340: no special assertion is needed for packet prose, but any new required MCP tool or optional agent must be present in the command manifest by runtime FQN/name or this suite should fail.

#### Tests To Add Or Update Later

- Update `tests/new-milestone-metadata.test.ts` to include three focused groups: manifest flow contract, roadmap-admin skill contract, and runtime-owned metadata/resource contract. Each group should assert stable identifiers and fields rather than long prose: `blueprint_config_get`, `New Milestone Transition Packet`, `sourceScope`, `inputsUsed`, `evidenceLedger`, `requirementTransitions`, `learningLoop`, `confirmationReceipt`, `approvedMode`, `approvedPaths`, `firstPhaseHandoff`, `routeTarget`, and `safeRetry` only if that field is actually implemented.
- Add a docs parity assertion in `tests/command-contract-docs.test.ts` that `docs/commands/new-milestone.md`, `docs/RUNTIME-REFERENCE.md`, and `docs/MCP-TOOLS.md` all list the same required MCP tools for `new-milestone`, including `blueprint_config_get`.
- Extend `tests/command-catalog.test.ts` to assert the `new-milestone` catalog entry, runtime metadata, and runtime-contract resource agree on `requiredTools`, `optionalAgents`, `specPath`, and `runtimeReference.exactMcpDestination`.
- Keep or extend `tests/roadmap-admin-runtime-contract-resource.test.ts` to simulate docs absence and prove the `new-milestone` runtime contract still builds from runtime metadata plus allowed skill inputs. Add a regression that `contract.skillInputs.effective` never contains `docs/`.
- Keep `tests/extension-runtime-contracts.test.ts` as the broad shipped-manifest guard. If future source changes add a required tool such as a dedicated scaffold receipt or transition-state tool, this suite should force the manifest to name the corresponding `mcp_blueprint_blueprint_*` FQN.
- If A5 scaffold work or R8 recovery work adds structured scaffold or recovery receipts, add behavior tests near the owning tool tests rather than only metadata tests. Metadata tests should prove contract exposure; tool tests should prove actual `{createdFiles, reusedFiles, warnings}` expansion, per-path status, stale confirmation blocking, or safe retry semantics.

#### Verification Commands

For this documentation-only A7 section, the lightweight validation is enough:

```bash
rg -n "^### A7 Runtime Metadata, Docs, And Test Coverage Parity|^## Detailed Improvement Plan" docs/imp/new-milestone-frontier-research-and-improvement-plan.md
rg -n "^(<{7}|>{7})" docs/imp/new-milestone-frontier-research-and-improvement-plan.md
git diff --check
```

For the future implementation slice that touches manifests, skills, source metadata, docs, or tests, use the normal fresh-worktree install-before-verify order:

```bash
npm ci
npm run typecheck
npm run build
npx tsx --test tests/new-milestone-metadata.test.ts tests/command-catalog.test.ts tests/command-contract-docs.test.ts tests/roadmap-admin-runtime-contract-resource.test.ts tests/extension-runtime-contracts.test.ts
git diff --check
```

If `src/mcp/command-runtime-metadata.ts`, `src/mcp/command-resources.ts`, or MCP tool behavior changes, inspect generated `dist/` output after `npm run build` and include tracked build artifacts required by the repository's extension-install contract.

#### Risks

- Parity churn risk: a future packet field can appear in five prompt/doc surfaces but not in MCP behavior. Mitigate by deciding first whether the field is model-built guidance or structured tool output.
- Runtime-input regression risk: adding docs paths to `blueprint-roadmap-admin` inputs would break the docless runtime-contract guarantee and make installed extensions depend on repository docs at runtime.
- Over-broad docs risk: `docs/MCP-TOOLS.md` can accidentally turn command-specific expectations into generic tool promises. Keep generic tool returns generic unless source behavior changes.
- Routing risk: changing catalog status, root routability, or runtime reference wording without catalog/resource tests can leak unimplemented or stale commands into `/blu`, `/blu-help`, `/blu-progress`, or `/blu-next` guidance.
- Brittle-test risk: exact prose regexes will make future refinements painful. Prefer assertions on command names, tool ids, field ids, waiting-state ids, source paths, and route targets.
- Build drift risk: runtime metadata changes are source changes. Future implementors must run build/typecheck/test after `npm ci`; docs-only A7 work does not touch `dist/`.

#### Dependency Notes

- Depends on A1/R1 and A4/R4 for the final packet/evidence-ledger vocabulary; A7 should not invent competing field names.
- Depends on A2/R3 for confirmation-gate ids and receipt fields, especially `carry-forward-confirmation` and `starter-doc-overwrite-confirmation`.
- Depends on A4/R6 for roadmapper packet and same-shape no-subagent fallback wording.
- Depends on A5/A6 for first-phase scaffold and handoff fields, including whether the packet maps into existing `phase.context` sections or needs schema/tool changes.
- Depends on R8 and the future Wave 7 recovery slice for idempotency, precondition, per-path scaffold, state-update, and `safeRetry` receipt semantics.
- Future implementation should land as one parity set: command manifest, roadmap-admin skill, runtime metadata, command docs, runtime reference, MCP docs, focused tests, and built assets when source changes require them.

## Detailed Improvement Plan

Status: complete future implementation plan.

This section is still documentation-only. It describes a future implementation sequence for `/blu-new-milestone`; it does not authorize this research run to edit production source, tests, command manifests, skills, agents, `.blueprint/`, or built assets.

### Goals

- Keep `/blu-new-milestone` a bounded milestone-transition command: read reviewed milestone evidence, decide carry-forward versus explicit reset, scaffold starter artifacts, update state, and route to `/blu-discuss-phase <first phase>`.
- Make carry-forward source-scoped and auditable through a compact `New Milestone Transition Packet` built from `blueprint_artifact_summary_digest.digest` and `inputsUsed`.
- Make human gates concrete through a `New Milestone Confirmation Packet` with named choices, safe defaults, evidence scope, approved paths, and an approval receipt.
- Preserve historical phase directories, reports, phase numbers, and prior evidence. The command must never clean, renumber, delete, or reinterpret prior milestone artifacts.
- Make optional `blueprint-roadmapper` use a typed packet/result contract and keep an equal-quality inline fallback when subagents are disabled, unavailable, or unnecessary.
- Improve starter scaffold quality for `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, `.blueprint/ROADMAP.md`, and the first `NN-CONTEXT.md` without treating scaffold text as final authored milestone or phase content.
- Give `/blu-discuss-phase <first phase>` a compact starter-only handoff packet with source refs, open questions, risks, and deferred-not-now material.
- Add runtime/docs/test parity for every future behavior change, starting with the known `blueprint_config_get` parity gap.
- Add path, numbering, precondition, receipt, and recovery semantics where prompt-only guidance is not enough.

### Non-Goals

- Do not use GSD internals, legacy slash-command behavior, `.planning/`, or tracker-style commands to implement this work.
- Do not make `/blu-new-milestone` a retrospective workshop, backlog manager, plan-phase replacement, progress monitor, or long-running visible tracker.
- Do not mutate `.blueprint/` directly from prompts. Future persistent state changes must stay inside MCP tools, except test fixtures in temporary repos.
- Do not add planned-only commands to `/blu`, `/blu-help`, `/blu-progress`, or `/blu-next` routing. Keep implemented-only routing semantics unchanged.
- Do not change `blueprint_artifact_summary_digest` output shape in the first slice. Treat `{digest, inputsUsed}` as the generic MCP return and build command-specific packets above it unless a later source slice explicitly expands the tool contract.
- Do not add host-global state or mutate installed extension directories.
- Do not add a new durable receipt directory under `.blueprint/` unless a later implementation slice explicitly updates artifact/schema/docs/tests for that write surface.

### Implementation Rules For Future Work

- Start future implementation in a fresh worktree and run `npm ci` before any `npm run build`, `npm run typecheck`, or test command.
- Land changes as small waves. Do not bundle prompt, runtime source, renderer, schema, tests, and recovery semantics into one giant patch.
- For every wave that touches `src/`, run `npm run typecheck`, `npm run build`, focused `tsx --test ...`, and `git diff --check`. Include tracked `dist/` changes when the repository build produces them.
- Keep line numbers below as current anchors from this worktree. If they drift, anchor by the named symbol, section heading, or test name rather than guessing.
- Prefer stable field names and behavior-class tests over brittle full-sentence prose regexes.
- If a future implementor finds that a planned source change would require broad architecture work, stop after the contract/test wave and write a smaller follow-up plan instead of improvising.

### Target Files And Anchors

| Surface | Current anchors | Future purpose |
|---|---:|---|
| `commands/blu-new-milestone.toml` | lines 5-21, 23-33 | Active model-facing flow, packets, gates, scaffold/state order, final route, no tracker posture. |
| `docs/commands/new-milestone.md` | lines 20, 31-38, 49-74, 76-82, 117-123, 125-162 | Human command spec, stale route wording, tool inventory, carry-forward, gates, edge cases, tests. |
| `skills/blueprint-roadmap-admin/SKILL.md` | lines 17-35, 79-118, 100-109, 219-232, 240-263 | Runtime input bundle, required tools, digest/config parity, no-subagent fallback, command checklist, output/self-check. |
| `agents/blueprint-roadmapper.md` | lines 26-35, 60-80, 91-116 | Parent ownership, roadmapper proposal rules, `/blu-new-milestone` packet/result contract. |
| `src/mcp/command-runtime-metadata.ts` | lines 354-361, 1077-1123 | Required tools, `spec.reads`, write path text, contract notes, runtime resource projection. |
| `docs/RUNTIME-REFERENCE.md` | line 109 | Control-plane row for `new-milestone`, exact MCP destination, optional agent gate, contract summary. |
| `docs/MCP-TOOLS.md` | lines 83-94, 180-193, 220-250 | Generic scaffold/digest docs, roadmap-admin command summary, numeric/path/scaffold rules. |
| `docs/ARTIFACT-SCHEMA.md` | lines 72-125, 270-309 | Top-level starter sections, ROADMAP numbering note, phase context starter-vs-final rule. |
| `docs/COMMAND-CATALOG.md` | line 32 | Declared writes/risk only if future write surface changes; do not encode packet internals here. |
| `src/mcp/tools/artifacts.ts` | lines 130-143, 176-182, 1960-2020, 2223-2277, 8783-8868 | Seed type/schema, phase path parsing/rendering, scaffold path guard, richer receipt. |
| `src/mcp/tools/phase-numbering.ts` | lines 19-50, 89-97 | Shared phase normalization, base phase, prefix, slug helpers; add next-whole-number helper here. |
| `src/mcp/tools/phase.ts` | lines 1471-1483, 5544-5741 | Existing add-phase next-integer logic; refactor to shared helper and keep stale-number behavior consistent. |
| `src/mcp/tools/state.ts` | lines 847-857, 2480-2533, 2901-2980 | Phase-directory existence checks, ignored phase warning, state update consistency guard. |
| `commands/blu-discuss-phase.toml` | lines 12-30 | Receiver-side handoff rules and final route discipline. |
| `skills/blueprint-phase-discovery/SKILL.md` | lines 179-199 | Discuss-phase receiving behavior, anti-placeholder and deferred-idea preservation. |
| `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` | lines 105-127, 164-235 | Single-agent fallback, artifact authoring, validation/repair, next-action refresh. |
| `src/mcp/artifact-contracts/schemas/phase.context.model.schema.json` | lines 5-18, 56-79, 130-178 | Existing `phase.context` fields; prefer mapping handoff data into these fields before schema expansion. |
| `tests/new-milestone-metadata.test.ts` | lines 11-85 | Manifest, skill, runtime metadata/resource contract assertions. |
| `tests/command-catalog.test.ts` | lines 993-1005, 1954-1975 | Optional-agent config invariant, required tools, optional agents, implemented status. |
| `tests/command-contract-docs.test.ts` | lines 1327-1339, 1355-1411 | Command doc behavior assertions and docs-facing optional-subagent tool inventory parity. |
| `tests/roadmap-admin-runtime-contract-resource.test.ts` | lines 11-87 | Docless runtime-contract resource guarantee for roadmap-admin commands. |
| `tests/extension-runtime-contracts.test.ts` | lines 273-340 | Manifest runtime FQN and optional-agent name coverage. |
| `tests/agent-contract-specialists.test.ts` | lines 42-68 | Roadmapper agent output/boundary assertions. |

### Shared Future Vocabulary

Use these names consistently across the command manifest, command docs, skill text, runtime metadata, MCP docs, agent contract, and tests. If a field is only prompt-built in an early wave, describe it as prompt-built. If a field is returned by an MCP tool, update source, docs, tests, and built assets together.

```ts
type NewMilestoneTransitionPacket = {
  packetVersion: "new-milestone-transition/v1";
  sourceScope: {
    previousMilestone: string;
    targetMilestoneProposal: string | null;
    summaryPath: string;
    roadmapPath: ".blueprint/ROADMAP.md";
    inputsUsed: string[];
    missingOrSkippedInputs: string[];
    digestWarnings: string[];
  };
  carryForwardDigest: {
    validatedOutcomes: string[];
    retainedDecisions: string[];
    openRisks: string[];
    deferredIdeas: string[];
    candidateNextMilestoneThemes: string[];
    nonCarryForwardItems: string[];
    staleOrAmbiguousClaims: string[];
  };
  evidenceLedger: Array<{
    claimId: string;
    category: string;
    claim: string;
    sourcePath: string;
    sourceHeading: string;
    decision: "carry" | "modify" | "defer" | "retire" | "new" | "drop" | "uncertain";
    confidence: "low" | "medium" | "high";
    usedBy: Array<"PROJECT" | "REQUIREMENTS" | "ROADMAP" | "phase.context" | "confirmation-preview">;
    uncertainty: string;
  }>;
  starterAuthoringImplications: string[];
};
```

```ts
type NewMilestoneConfirmationPacket = {
  gateId:
    | "missing-milestone-summary"
    | "carry-forward-confirmation"
    | "starter-doc-overwrite-confirmation";
  fromMilestone: string;
  proposedToMilestone: string;
  milestoneNameSource: "user-supplied" | "derived-from-summary" | "needs-user-input";
  mode: "carry-forward" | "fresh-reset";
  modeSource: "defaulted" | "user-explicit" | "ambiguous-user-intent";
  summarySource: string;
  inputsUsed: string[];
  inputsMissingOrSkipped: string[];
  carryForwardPreview: string[];
  resetConsequence: string;
  firstPhasePreview: {
    firstPhaseNumber: string;
    firstPhasePrefix: string;
    firstPhaseDir: string;
    firstContextPath: string;
    routeTarget: string;
  };
  scaffoldPlan: Array<{
    path: string;
    artifactKind: "project" | "requirements" | "roadmap" | "phase-directory" | "phase-context";
    currentState: "missing" | "exists-empty" | "exists-nonempty" | "exists-conflict" | "unknown";
    intendedOperation: "create" | "reuse" | "overwrite" | "mkdir" | "skip" | "block";
    requiresConfirmation: boolean;
    confirmationReason: string;
  }>;
  safeDefault: "stop-without-writing";
  allowedChoices: string[];
  approvalReceipt?: {
    gateId: NewMilestoneConfirmationPacket["gateId"];
    selectedChoice: string;
    approvedMode: "carry-forward" | "fresh-reset";
    approvedMilestoneName: string;
    approvedOverwritePaths: string[];
    inputsUsed: string[];
    scaffoldPlanVersion: string;
    routeTarget: string;
  };
};
```

```ts
type NewMilestoneStarterSeed = {
  schemaVersion: "new-milestone-starter-seed/v1";
  mode: "carry-forward" | "fresh-reset";
  starterOnly: true;
  previousMilestone: string;
  targetMilestone: string;
  firstPhaseNumber: string;
  firstPhaseTitle: string;
  firstPhasePath: string;
  sourceScope: NewMilestoneTransitionPacket["sourceScope"];
  outcomeFrame: {
    targetOutcome: string;
    measurableSignals: string[];
    valueGaps: string[];
    deliveryConstraints: string[];
    doNotCarryForwardItems: string[];
  };
  requirementTransitions: Array<{
    priorRequirementId?: string;
    newRequirementId?: string;
    decision: "carry" | "modify" | "defer" | "retire" | "new" | "self-derived" | "uncertain";
    sourceRefs: string[];
    rationale: string;
    uncertainty: "low" | "medium" | "high";
  }>;
  roadmapSlice: {
    whyFirst: string;
    requirementIds: string[];
    objective: string;
    successCriteria: string[];
    inspectableProgress: string;
    deferredNotDoingNow: string[];
  };
  firstContextHandoff: NewMilestoneFirstPhaseHandoffPacket;
};
```

```ts
type NewMilestoneFirstPhaseHandoffPacket = {
  packetVersion: "new-milestone-first-phase-handoff/v1";
  mode: "carry-forward" | "fresh-reset";
  fromMilestone: string;
  toMilestone: string;
  firstPhase: {
    phaseNumber: string;
    title: string;
    objective: string;
    requirementIds: string[];
    successCriteria: string[];
    whyFirst: string;
    inspectableProgress: string;
  };
  digestInputsUsed: string[];
  retainedDecisions: string[];
  activeRequirementTransitions: string[];
  openForDiscuss: string[];
  riskWatchlist: string[];
  deferredNotDoingNow: string[];
  canonicalReferences: Array<{ path: string; relevance: string }>;
  routeReceipt: string;
};
```

```ts
type NewMilestoneCompletionReceipt = {
  status: "written" | "blocked" | "partial" | "reused";
  mode: "carry-forward" | "fresh-reset";
  roadmapperMode: "used" | "skipped-disabled" | "skipped-unnecessary" | "unavailable-fallback";
  firstPhaseNumber: string;
  firstPhasePrefix: string;
  firstPhaseDir: string;
  firstContextPath: string;
  inputsUsed: string[];
  createdFiles: string[];
  reusedFiles: string[];
  overwrittenFiles: string[];
  blockedFiles: string[];
  deletedPhaseDirectories: [];
  renamedPhaseDirectories: [];
  stateUpdated: boolean;
  safeRetry: boolean;
  nextAction: string;
  warnings: string[];
};
```

### Wave 0 - Future Implementation Preflight

Objective: make the future implementation run safe before any production edit.

Tasks:

1. **Sequential - create the isolated worktree and install dependencies.**
   - Dependency: none.
   - Use the repository rule: create a fresh worktree/branch for implementation work, then run `npm ci` before build, typecheck, or tests.
   - Read current versions of the target files above, because this plan's line numbers may drift.
   - Do not edit `.blueprint/`, installed extension directories, host-global state, or runtime-generated reports.

2. **Sequential - classify the first slice before editing.**
   - Dependency: task 1.
   - If the requested slice is docs/prompt/static tests only, keep source behavior unchanged and do not broaden into runtime receipts.
   - If the requested slice touches `src/`, plan the required `dist/` update and behavior tests in the same branch.

3. **Parallel-safe - run search preflight.**
   - Dependency: task 1.
   - Commands:

```bash
rg -n "new-milestone|blueprint_config_get|route to requirements|<NN-CONTEXT|New Milestone" commands docs skills agents src tests
rg -n "new-milestone" docs/RUNTIME-REFERENCE.md docs/MCP-TOOLS.md docs/COMMAND-CATALOG.md src/mcp/command-runtime-metadata.ts
git status --short --branch
```

Exit criteria:

- Future implementor knows whether the slice is prompt/docs/test only or runtime behavior.
- No production file is edited before the scope is explicit.

### Wave 1 - Required-Tool Parity And Static Hygiene

Objective: repair the known `blueprint_config_get` parity gap and remove stale route/path wording before adding richer contracts.

Tasks:

1. **Sequential - fix `blueprint_config_get` parity first.**
   - Dependencies: Wave 0 complete.
   - Files and exact changes:
     - `src/mcp/command-runtime-metadata.ts:1098-1102`: add `blueprint_config_get -> effective config for optional roadmapper gating` to `NEW_MILESTONE_RUNTIME_METADATA.spec.reads`. Keep `NEW_MILESTONE_REQUIRED_TOOLS` at lines 354-361 unchanged unless a later wave adds a new MCP tool.
     - `docs/commands/new-milestone.md:49-74`: add `blueprint_config_get -> effective config` to reads and required MCP tools.
     - `docs/RUNTIME-REFERENCE.md:109`: add `blueprint_config_get` to the exact MCP destination for `new-milestone`.
     - `docs/MCP-TOOLS.md:193`: add `blueprint_config_get` to the `new-milestone` roadmap-admin summary.
     - `skills/blueprint-roadmap-admin/SKILL.md:79-94`: add `blueprint_config_get` to the required MCP tool inventory because `new-milestone` exposes an optional subagent.
   - Tests:
     - `tests/new-milestone-metadata.test.ts:63-85`: assert `contract.spec?.reads` includes `blueprint_config_get`.
     - `tests/command-contract-docs.test.ts:1355-1411`: add `newMilestoneDoc` to the optional-subagent docs parity test and assert docs/runtime/MCP surfaces include `blueprint_config_get`.
     - `tests/command-catalog.test.ts:993-1005` already guards runtime metadata; keep it passing.

2. **Parallel-safe after task 1 - fix stale route wording.**
   - Dependencies: task 1 can land first; this task can be reviewed with task 3.
   - Files and exact changes:
     - `docs/commands/new-milestone.md:20`: replace "route to requirements" with "seed starter milestone docs and route to `/blu-discuss-phase <first phase>`".
     - `commands/blu-new-milestone.toml:20,33`, `skills/blueprint-roadmap-admin/SKILL.md:231,249`, and `src/mcp/command-runtime-metadata.ts:1120`: keep placeholder route text only in runtime-facing templates; user-visible completion copy later should use resolved phase number.
   - Tests:
     - `tests/command-contract-docs.test.ts:1327-1339`: assert docs do not contain `route to requirements` and do contain `/blu-discuss-phase <first phase>`.

3. **Parallel-safe after task 1 - fix malformed path placeholders.**
   - Dependencies: task 1 can land first.
   - Files and exact changes:
     - `commands/blu-new-milestone.toml:19`: replace `.blueprint/phases/<NN>-<slug>/<NN-CONTEXT.md>` with `.blueprint/phases/<NN>-<slug>/<NN>-CONTEXT.md`.
     - `docs/commands/new-milestone.md:63`: replace `.blueprint/phases/<next-phase-slug>/<NN-CONTEXT.md>` with `.blueprint/phases/<NN>-<slug>/<NN>-CONTEXT.md`.
     - `src/mcp/command-runtime-metadata.ts:1107`: replace the same malformed placeholder.
     - `docs/COMMAND-CATALOG.md:32`: update the write surface only if this docs row is still intentionally tracking write paths.
   - Tests:
     - `tests/new-milestone-metadata.test.ts:40`: update the regex to `.blueprint/phases/<NN>-<slug>/<NN>-CONTEXT.md`.
     - `tests/command-contract-docs.test.ts:1327-1339`: assert canonical path wording.

4. **Sequential - verify Wave 1 as a parity patch.**
   - Dependencies: tasks 1-3.
   - Commands:

```bash
npx tsx --test tests/new-milestone-metadata.test.ts tests/command-catalog.test.ts tests/command-contract-docs.test.ts tests/roadmap-admin-runtime-contract-resource.test.ts tests/extension-runtime-contracts.test.ts
npm run typecheck
npm run build
git diff --check
```

Exit criteria:

- `blueprint_config_get` appears everywhere `new-milestone` tool inventories are documented or projected.
- The stale route and malformed path placeholders are gone.
- Runtime-contract resource remains docless for roadmap-admin commands.

### Wave 2 - Transition Packet And Confirmation Gates

Objective: add prompt/docs/metadata/test contract for evidence-scoped carry-forward and typed user gates without changing generic MCP tool outputs yet.

Tasks:

1. **Sequential - add the `New Milestone Transition Packet` to active command flow.**
   - Dependencies: Wave 1.
   - Files and exact changes:
     - `commands/blu-new-milestone.toml:12-14`: after `blueprint_artifact_summary_digest`, require building `New Milestone Transition Packet` with `sourceScope`, `carryForwardDigest`, `evidenceLedger`, and `starterAuthoringImplications`.
     - `commands/blu-new-milestone.toml:19`: say the scaffold seed is derived from the confirmed transition packet, not unstructured digest prose.
     - `docs/commands/new-milestone.md:76-82`: add packet fields and the rule that every starter-doc claim cites a `sourcePath` from `inputsUsed` or is omitted/flagged.
     - `skills/blueprint-roadmap-admin/SKILL.md:111-118`: update the digest bullet to say commands may wrap `{digest, inputsUsed}` into command-specific packets while `inputsUsed` remains the evidence boundary.
     - `skills/blueprint-roadmap-admin/SKILL.md:219-232`: add a new step after the digest read requiring the transition packet.
     - `src/mcp/command-runtime-metadata.ts:1098-1102,1119-1120`: mention prompt-built transition packet derived from digest and `inputsUsed`.
     - `docs/MCP-TOOLS.md:83-94,193`: keep `blueprint_artifact_summary_digest` generic and note that `new-milestone` builds a command-specific transition packet from its output.
     - `docs/ARTIFACT-SCHEMA.md:122-125`: add that `milestone-summary` carry-forward context should include source pointers, uncertainty, and do-not-carry-forward items.
   - Paste-ready command text:

```md
Build a `New Milestone Transition Packet` immediately after `blueprint_artifact_summary_digest` and before any confirmation or scaffold write. `inputsUsed` remains the authoritative source boundary. Every packet claim used in starter docs must cite a `sourcePath` from `inputsUsed`; claims outside that boundary must be marked `outside-digest-scope` and omitted from starter writes unless the digest is rerun with that source included. Keep the packet compact and include `nonCarryForwardItems` so stale assumptions, closed risks, and discarded milestone details do not silently steer the next milestone.
```

2. **Sequential after task 1 - add `New Milestone Confirmation Packet` and gate semantics.**
   - Dependencies: task 1 because gates show transition packet evidence.
   - Files and exact changes:
     - `commands/blu-new-milestone.toml:13-18`: replace loose reset/name/overwrite guidance with the confirmation packet trigger list and path-specific `scaffoldPlan`.
     - `commands/blu-new-milestone.toml:23-33`: require final response or blocked response to include `gateId`, selected choice or safe default, approved mode, approved milestone name, approved paths, `inputsUsed`, first phase preview, and route target.
     - `docs/commands/new-milestone.md:31-38`: clarify that fresh reset omits carry-forward seed text while preserving historical phase directories, reports, and numbering.
     - `docs/commands/new-milestone.md:117-123`: replace the short prompt section with a gate table: `gateId`, `trigger`, `safeDefault`, `mustShowEvidence`, `allowedChoices`, `postConfirmationReceipt`.
     - `skills/blueprint-roadmap-admin/SKILL.md:223,230,259-260`: add explicit reset friction, path-specific overwrite approval, and the self-check that blockers are not bypassed by direct file edits.
     - `src/mcp/command-runtime-metadata.ts:1119-1120`: name the three gate IDs and no generic fourth A2 gate.
   - Paste-ready `ask_user` choice labels:

```text
Carry-forward gate options:
1. Carry forward as proposed
2. Start fresh milestone reset
3. Stop without writing

Overwrite gate options:
1. Overwrite listed starter docs
2. Create or reuse only
3. Stop without writing
```

3. **Parallel-safe after task 2 - strengthen static tests.**
   - Dependencies: task 2.
   - Files and exact changes:
     - `tests/new-milestone-metadata.test.ts:11-42`: assert `New Milestone Transition Packet`, `sourceScope`, `carryForwardDigest`, `evidenceLedger`, `nonCarryForwardItems`, `staleOrAmbiguousClaims`, `starterAuthoringImplications`, `New Milestone Confirmation Packet`, `approvalReceipt`, and the named choice labels.
     - `tests/new-milestone-metadata.test.ts:44-61`: assert the skill names `milestoneNameSource`, `modeSource`, path-specific overwrite approval, and same packet shape for fallback.
     - `tests/new-milestone-metadata.test.ts:63-85`: assert runtime contract notes include packet and gate IDs while `skillInputs.effective` remains `["commands/blu-new-milestone.toml"]`.
     - `tests/command-contract-docs.test.ts:1327-1339`: assert docs include packet and gate table fields.
   - Add a negative assertion that these gate surfaces do not rely only on generic labels such as `OK`, `Cancel`, or `Are you sure?`.

4. **Sequential - verify Wave 2.**
   - Dependencies: tasks 1-3.
   - Commands:

```bash
npx tsx --test tests/new-milestone-metadata.test.ts tests/command-contract-docs.test.ts tests/roadmap-admin-runtime-contract-resource.test.ts tests/extension-runtime-contracts.test.ts
npm run typecheck
npm run build
git diff --check
```

Exit criteria:

- The packet and gate vocabulary is consistent across manifest, docs, skill, runtime metadata, and tests.
- Generic MCP docs still do not overpromise a wider `blueprint_artifact_summary_digest` return shape.

### Wave 3 - Roadmapper Packet And Same-Shape Inline Fallback

Objective: make optional `blueprint-roadmapper` use bounded manager/worker semantics, and make disabled/no-subagent mode produce the same result shape inline.

Tasks:

1. **Sequential - add roadmapper trigger, packet, result, and parent acceptance rules.**
   - Dependencies: Wave 2 transition packet.
   - Files and exact changes:
     - `commands/blu-new-milestone.toml:5,9,17`: add the allowed invocation triggers: `multiple-candidate-themes`, `dependency-order-unclear`, `orphaned-solutions-present`, `learning-actions-need-separation`, `first-phase-choice-unclear`.
     - `commands/blu-new-milestone.toml:17`: require `NewMilestoneRoadmapperPacket` and `NewMilestoneRoadmapperResult`; forbid raw transcript or unrestricted file dumps.
     - `skills/blueprint-roadmap-admin/SKILL.md:100-109`: make no-subagent parity mean filling the same result shape inline, not a weaker prose summary.
     - `skills/blueprint-roadmap-admin/SKILL.md:224-225`: replace current broad roadmapper/fallback bullets with packet/result/fallback wording.
     - `src/mcp/command-runtime-metadata.ts:1119-1120`: mention `roadmapperMode` values: `used`, `skipped-disabled`, `skipped-unnecessary`, `unavailable-fallback`.
     - `docs/RUNTIME-REFERENCE.md:109`: summarize typed packet/result and same-shape inline fallback.
   - Paste-ready command/skill text:

```md
Before using `blueprint-roadmapper`, build a `NewMilestoneRoadmapperPacket` from the confirmed roadmap read, effective config, milestone-summary digest, `inputsUsed`, carry-forward facts, requirement transition hints, next whole-number phase preview, and parent-owned boundaries. Use the roadmapper only when grouped carry-forward synthesis materially improves the next milestone frame. The roadmapper returns `NewMilestoneRoadmapperResult` only: provisional ordered proposals, coverage notes, blockers, warnings, assumptions, confidence, and a first-phase recommendation by relative order. It must not assign final phase numbers, write files, call MCP mutation tools, decide user gates, browse for replacement truth, or invent evidence outside `inputsUsed`. If no roadmapper is used, fill the same result shape inline and mark `roadmapperMode` as `skipped-disabled`, `skipped-unnecessary`, or `unavailable-fallback`.
```

2. **Parallel-safe after task 1 - add roadmapper agent subsection.**
   - Dependencies: task 1.
   - Files and exact changes:
     - `agents/blueprint-roadmapper.md:91-106`: add `### /blu-new-milestone Result Contract`.
     - Preserve existing parent ownership and read-only boundaries at lines 26-35 and 107-116.
   - Paste-ready agent text:

```md
### `/blu-new-milestone` Result Contract

When the parent sends `NewMilestoneRoadmapperPacket`, return `NewMilestoneRoadmapperResult`. Use only the supplied digest scope and parent-approved reads. Return provisional ordered proposals without permanent phase numbers, plus objective, covered requirement or gap set, carry-forward items, learning actions, dependency notes, 2-5 observable success criteria, evidence refs, blockers, warnings, unresolved assumptions, confidence, and a relative first-phase recommendation. Do not write files, call MCP mutation tools, decide confirmation gates, browse for replacement truth, or invent evidence outside `inputsUsed`.
```

3. **Parallel-safe after task 1 - add tests.**
   - Dependencies: task 1.
   - Files and exact changes:
     - `tests/new-milestone-metadata.test.ts:11-85`: assert roadmapper packet/result names, trigger list, `roadmapperMode`, no final phase numbers, no writes/MCP mutations, no user-gate decisions, and same-shape fallback.
     - `tests/agent-contract-specialists.test.ts:42-68`: assert the agent names `NewMilestoneRoadmapperResult`, forbids final phase numbers/writes/user gates, and requires evidence bounded to `inputsUsed`.
     - `tests/command-contract-docs.test.ts:1355-1411`: keep docs/runtime reference config parity with `blueprint_config_get`.
   - Do not change catalog status semantics.

4. **Sequential - verify Wave 3.**
   - Dependencies: tasks 1-3.
   - Commands:

```bash
npx tsx --test tests/new-milestone-metadata.test.ts tests/agent-contract-specialists.test.ts tests/command-contract-docs.test.ts tests/command-catalog.test.ts tests/extension-runtime-contracts.test.ts
npm run typecheck
npm run build
git diff --check
```

Exit criteria:

- Roadmapper is a bounded proposal pass, not a control handoff.
- No-subagent fallback has equal field shape and evidence boundary.

### Wave 4 - Starter Seed And Scaffold Content Quality

Objective: make starter artifacts transition-shaped and useful while preserving scaffold-only posture.

Preferred implementation choice: add an optional sibling `newMilestoneSeed` to `blueprint_artifact_scaffold` rather than widening the generic `bootstrapSeed` shape indefinitely. Keep backward compatibility for `bootstrapSeed` callers.

Tasks:

1. **Sequential - add TypeScript and Zod seed shape.**
   - Dependencies: Waves 1-3.
   - Files and exact changes:
     - `src/mcp/tools/artifacts.ts:130-143`: add `NewMilestoneStarterSeed`, `NewMilestoneRequirementTransition`, `NewMilestoneFirstPhaseHandoffPacket`, and related types near `BootstrapSeed`.
     - `src/mcp/tools/artifacts.ts:176-182`: add `newMilestoneSeed?: NewMilestoneStarterSeed` to `ArtifactScaffoldArgs`.
     - `src/mcp/tools/artifacts.ts:1960-2020`: add Zod validation for `newMilestoneSeed`, including:
       - `schemaVersion: "new-milestone-starter-seed/v1"`
       - `starterOnly: true`
       - non-empty `sourceScope.inputsUsed` for carry-forward mode
       - `mode: "fresh-reset"` allows empty `inputsUsed` only with explicit reset rationale
       - `roadmapSlice.successCriteria` length 2-5
       - active roadmap requirement IDs must be present in `requirementTransitions` or existing generated requirements
       - source refs outside `inputsUsed` must be labeled inference and blocked from durable carry-forward use
   - Tests:
     - Add negative tests for missing `inputsUsed`, orphan requirement IDs, first phase without 2-5 success criteria, and unlabeled outside-digest claims.

2. **Sequential after task 1 - render top-level starter docs from seed.**
   - Dependencies: task 1.
   - Files and exact changes:
     - `src/mcp/tools/artifacts.ts:1544-1944`: update PROJECT/REQUIREMENTS/ROADMAP renderers or add adapter helpers so `newMilestoneSeed` populates:
       - `PROJECT.md`: transition mode, source scope, target outcome, retained decisions, reset/carry-forward note, do-not-carry-forward summary.
       - `REQUIREMENTS.md`: `Milestone Requirements Transition Ledger` with carried/modified/deferred/retired/new/self-derived rows.
       - `ROADMAP.md`: first phase as next whole-number phase, objective, requirement IDs, 2-5 success criteria, `whyFirst`, `inspectableProgress`, `deferredNotDoingNow`, source refs, uncertainty.
     - Preserve existing bootstrap output for `/blu-new-project`; do not let transition-only text leak into normal bootstrap.
     - `docs/ARTIFACT-SCHEMA.md:72-125`: document optional new-milestone transition sections while preserving required headings.
   - Tests:
     - Add `tests/new-milestone-scaffold.test.ts`.
     - Update `tests/new-project.test.ts:382-492` only if shared renderers change.

3. **Sequential after task 1 - render first context starter handoff.**
   - Dependencies: task 1; coordinate with Wave 6 receiver-side text.
   - Files and exact changes:
     - `src/mcp/tools/artifacts.ts:2223-2277`: pass `newMilestoneSeed.firstContextHandoff` into phase context rendering when the requested artifact equals the seed's first context path.
     - `src/mcp/artifact-contracts/index.ts:4001-4059`: add contract notes that new-milestone context scaffold may include handoff content but remains starter-only.
     - `docs/ARTIFACT-SCHEMA.md:297-309`: document that a seeded first context is useful starter material and must be replaced by `/blu-discuss-phase` final model output.
   - Tests:
     - `tests/new-milestone-scaffold.test.ts`: assert first context includes `openForDiscuss`, `riskWatchlist`, `deferredNotDoingNow`, `canonicalReferences`, and a starter marker/scaffold footer.
     - Add or update phase-readiness tests so seeded context is not mistaken for final authored context.

4. **Parallel-safe after task 2 - update prompt/docs/runtime contract for seed.**
   - Dependencies: task 2, or write the docs in the same source patch.
   - Files and exact changes:
     - `commands/blu-new-milestone.toml:12-19`: require `New Milestone Starter Seed` before scaffold writes.
     - `docs/commands/new-milestone.md:76-82,142-162`: add seed expectations and acceptance criteria.
     - `skills/blueprint-roadmap-admin/SKILL.md:221-231,249`: add seed checklist and output summary.
     - `docs/MCP-TOOLS.md:83-88,190-193,241-250`: document `newMilestoneSeed` input and clarify that `createdFiles`/`reusedFiles` are touch receipts, not content-quality proof.
     - `src/mcp/command-runtime-metadata.ts:1119-1120`: mention seed fields only after source behavior supports them.
   - Paste-ready scaffold seed block:

```text
Before scaffold writes, build a New Milestone Starter Seed.

Required:
- schemaVersion: new-milestone-starter-seed/v1
- mode: carry-forward or fresh-reset
- starterOnly: true
- previousMilestone and targetMilestone
- firstPhaseNumber, firstPhaseTitle, and firstPhasePath
- sourceScope.inputsUsed exactly from blueprint_artifact_summary_digest
- sourceScope.summaryPath and sourceScope.roadmapPath
- outcomeFrame.targetOutcome
- outcomeFrame.measurableSignals, allowing "unknown: <reason>"
- requirementTransitions with decision, sourceRefs, rationale, and uncertainty
- roadmapSlice.whyFirst, requirementIds, objective, and 2-5 successCriteria
- firstContextHandoff.openForDiscuss, deferredNotDoingNow, requiredFollowUpReads, and canonicalReferences

Do not use scaffold output as final authored content. It remains starter material until owner review or a future approved authoring path refines top-level docs, and /blu-discuss-phase owns final phase.context.
```

5. **Sequential - verify Wave 4.**
   - Dependencies: tasks 1-4.
   - Commands:

```bash
npm run typecheck
npm run build
npx tsx --test tests/new-milestone-scaffold.test.ts tests/new-milestone-metadata.test.ts tests/artifact-contracts.test.ts tests/command-contract-docs.test.ts
npx tsx --test tests/new-project.test.ts
git diff --check
```

Exit criteria:

- Starter docs are transition-shaped but still marked as starter material.
- Existing bootstrap behavior remains compatible.
- Generic scaffold docs describe new optional seed behavior without implying final authoring.

### Wave 5 - Phase Numbering, Path Safety, And State Consistency

Objective: move the safety-critical first-phase continuity rules out of prose and into runtime checks.

Tasks:

1. **Sequential - add shared next-whole-number helper.**
   - Dependencies: Waves 1-4 if scaffold seed path is implemented; can be done earlier as an isolated source refactor if needed.
   - Files and exact changes:
     - `src/mcp/tools/phase-numbering.ts:19-50`: add `nextWholeNumberPhase(phases: Array<{ phaseNumber: string }>): string` and `highestBasePhaseNumber(...)`.
     - `src/mcp/tools/phase-numbering.ts:89-97`: reuse existing `slugifyPhaseName`.
     - `src/mcp/tools/phase.ts:1471-1483`: replace local `nextIntegerPhaseNumber` logic with the shared helper or keep a wrapper that delegates to it.
     - `src/mcp/tools/phase.ts:5544-5741`: keep add-phase behavior unchanged; tests should prove the helper did not change add-phase stale-number semantics.
   - Tests:
     - Existing `tests/roadmap-tools.test.ts` add-phase cases must keep passing.
     - Add helper-level tests if there is a local pattern for pure helper tests; otherwise cover through new-milestone behavior tests.

2. **Sequential after task 1 - add new-milestone scaffold guard.**
   - Dependencies: task 1 and Wave 4 seed type.
   - Files and exact changes:
     - `src/mcp/tools/artifacts.ts:8783-8868`: when `args.newMilestoneSeed` is present, require the requested artifacts to match `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, `.blueprint/ROADMAP.md`, `.blueprint/phases/`, and the exact computed first context path.
     - Re-read `.blueprint/ROADMAP.md` immediately before writes. If `firstPhaseNumber`, `firstPhasePrefix`, `firstPhaseDir`, or `firstContextPath` differ from the confirmed seed/preview, return or throw `stale-first-phase-number` before writing.
     - Inspect `.blueprint/phases/` for directories with the computed numeric prefix:
       - none: create computed directory.
       - exact computed directory only: reuse subject to first-context overwrite rules.
       - any different match: block as `phase-directory-conflict`.
       - multiple matches: block as `ambiguous-first-phase-directory`.
     - Do not delete, rename, merge, or renumber historical phase directories.
   - Return shape:
     - Extend `ArtifactScaffoldResult` with optional `newMilestoneReceipt?: NewMilestoneCompletionReceipt`.
     - Keep existing `createdFiles`, `reusedFiles`, and `warnings` for compatibility.
   - Tests:
     - New `tests/new-milestone-tools.test.ts` or `tests/new-milestone-scaffold.test.ts` cases for decimal history, gapped history, stale preview, directory conflict, ambiguous directory, exact reuse, user-authored context protection, and no delete/rename.

3. **Sequential after task 2 - add state update consistency guard.**
   - Dependencies: task 2 because state should trust scaffold receipt/path.
   - Files and exact changes:
     - `src/mcp/tools/state.ts:847-857`: if needed, expose enough directory detail to distinguish exact directory from any matching numeric prefix.
     - `src/mcp/tools/state.ts:2480-2533`: keep the ignored requested phase warning, but future `/blu-new-milestone` command flow must treat this warning as incomplete transition.
     - `src/mcp/tools/state.ts:2901-2980`: when `patch.activeCommand` identifies `/blu-new-milestone` or `new-milestone`, and `patch.currentPhase` plus `patch.nextAction` route to discuss-phase, reject or warn hard if the exact phase directory/context path from the receipt is missing, ambiguous, or conflicting.
   - If the state tool cannot safely know the intended context path without overloading generic state update, keep the hard check in the scaffold guard and make the command manifest require treating any state warning about missing phase directory as failure.
   - Tests:
     - State ordering test: injected scaffold failure leaves `STATE.md` unchanged.
     - State consistency test: missing phase directory warning makes `/blu-new-milestone` incomplete, not successful.

4. **Parallel-safe after task 2 - update contracts/tests for phase continuity.**
   - Dependencies: task 2.
   - Files and exact changes:
     - `commands/blu-new-milestone.toml:15-20`: add preview/commit guard fields and blockers.
     - `commands/blu-new-milestone.toml:23-33`: require completion receipt to include `deletedPhaseDirectories: []` and `renamedPhaseDirectories: []`.
     - `docs/commands/new-milestone.md:125-150`: add decimal history, gapped history, stale preview, conflicting directory, ambiguous directory, exact first context path, and state-after-scaffold order.
     - `skills/blueprint-roadmap-admin/SKILL.md:219-232,251-263`: add guard checklist and self-check bullets.
     - `docs/MCP-TOOLS.md:220-258`: document new-milestone exception while preserving returned path metadata authority.
     - `src/mcp/command-runtime-metadata.ts:1077-1123`: expose exact path and continuity guard.
   - Paste-ready contract text:

```md
Before any `/blu-new-milestone` write, compute the first new phase from the live ROADMAP as the next whole-number phase after the highest base phase number. Decimal phases count only toward their integer base, so `2.1` and `2.2` make the next whole-number phase `3`; gaps are preserved, so `1`, `2`, and `4` make the next phase `5`.

The canonical first context path is `.blueprint/phases/<NN>-<slug>/<NN>-CONTEXT.md`.

Re-read ROADMAP immediately before the scaffold commit. If the recomputed first phase number or path differs from the confirmed preview, stop with `stale-first-phase-number` and make no writes.

Preserve historical phase directories and numbering history. `/blu-new-milestone` must not call cleanup behavior, remove-phase behavior, filesystem delete, filesystem rename, or any renumbering pass for prior milestone artifacts.

Update `STATE.md` only after the scaffold receipt confirms the exact first context path was created or safely reused.
```

5. **Sequential - verify Wave 5.**
   - Dependencies: tasks 1-4.
   - Commands:

```bash
npm run typecheck
npm run build
npx tsx --test tests/new-milestone-tools.test.ts tests/new-milestone-scaffold.test.ts tests/new-milestone-metadata.test.ts tests/roadmap-tools.test.ts tests/command-contract-docs.test.ts tests/command-catalog.test.ts
git diff --check
```

Exit criteria:

- Runtime refuses stale first-phase previews and conflicting phase directories.
- Prompt/model text no longer carries safety-critical path logic alone.
- Existing add/insert phase behavior remains intact.

### Wave 6 - Downstream Discuss-Phase Handoff

Objective: seed the first phase with useful transition context while keeping `/blu-discuss-phase` the sole owner of final `phase.context` authoring.

Tasks:

1. **Sequential - add first-phase handoff packet to new-milestone surfaces.**
   - Dependencies: Wave 4 starter seed; Wave 5 path guard for exact route/path.
   - Files and exact changes:
     - `commands/blu-new-milestone.toml:16,19-21`: build `New Milestone First-Phase Handoff Packet` before scaffold/state update and require final route text to use resolved phase number when known.
     - `docs/commands/new-milestone.md:76-82,145-150`: describe starter-only packet and route receipt.
     - `skills/blueprint-roadmap-admin/SKILL.md:221-231,249`: add packet fields and output requirement.
     - `src/mcp/command-runtime-metadata.ts:1097-1120`: mention handoff only after source/scaffold support exists.
   - Paste-ready text:

```text
Before scaffolding the first new phase context, build a compact New Milestone First-Phase Handoff Packet from the carry-forward digest and confirmed transition mode. Include: mode, fromMilestone, toMilestone, firstPhase {phaseNumber, title, objective, requirementIds, successCriteria, whyFirst, inspectableProgress}, digestInputsUsed, retainedDecisions, activeRequirementTransitions, openForDiscuss, riskWatchlist, deferredNotDoingNow, canonicalReferences, and routeReceipt.

Treat the packet as starter-only seed material for /blu-discuss-phase, not as authored phase context. Keep it source-scoped to blueprint_artifact_summary_digest.inputsUsed unless a row is explicitly labeled new-milestone inference. Preserve deferred assumptions, risks, and not-now items as downstream questions or deferred ideas instead of dropping them. Do not fill final implementation decisions that belong to /blu-discuss-phase.
```

2. **Sequential after task 1 - add discuss-phase receiver rules.**
   - Dependencies: task 1.
   - Files and exact changes:
     - `commands/blu-discuss-phase.toml:12-20,28-30`: say when selected phase was scaffolded by `/blu-new-milestone`, read the handoff as seed evidence, preserve source refs/deferred items/open gray areas, and replace scaffold text in final model output.
     - `skills/blueprint-phase-discovery/SKILL.md:183-199`: add receiver-side rule near grounding, anti-pattern, and deferred idea preservation.
     - `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md:105-127`: mention handoff packet as a carry-forward context source for single-agent fallback.
     - `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md:164-235`: map packet content into existing `phase.context` fields and keep final `XX-CONTEXT.md` model-rendered.
     - Avoid schema changes unless mapping into current fields is impossible.
   - Paste-ready receiver text:

```text
When the selected phase was just scaffolded by /blu-new-milestone, read the first-phase handoff packet as seed evidence before asking questions. Treat it as disposable starter material: carry forward its source refs, deferred risks, and open gray areas into the structured phase.context model, but do not preserve the packet heading, scaffold footer, placeholder labels, or unsupported claims in the final XX-CONTEXT.md.

Ask only for missing, contradictory, uncertain, or high-impact details. If the packet marks an assumption or risk with a consequence-if-wrong, either confirm it with the user, convert it into an implementation decision with evidence, or keep it in Open Questions/Deferred Ideas. After writing context, report the refreshed derivedStatus.nextAction exactly.
```

3. **Parallel-safe after task 2 - add tests.**
   - Dependencies: task 2.
   - Files and exact changes:
     - `tests/new-milestone-metadata.test.ts:11-61`: assert `New Milestone First-Phase Handoff Packet`, `digestInputsUsed`, `openForDiscuss`, `riskWatchlist`, `deferredNotDoingNow`, and resolved-phase route text.
     - `tests/command-contract-docs.test.ts:1327-1339`: reject stale route wording and require starter-only handoff language.
     - `tests/phase-discovery-discuss.test.ts:464-535`: seed a first-phase handoff, run context write path, assert final context preserves canonical references/open questions/deferred ideas.
     - `tests/phase-discovery-discuss.test.ts:778-842`: reject final context that drops packet-marked deferred risks or preserves packet/scaffold text verbatim.
     - If schema changes are made, update `tests/context-diagnostics.test.ts`, `tests/artifact-contracts.test.ts`, `tests/built-schema-assets.test.ts`, and fixtures together.

4. **Sequential - verify Wave 6.**
   - Dependencies: tasks 1-3.
   - Commands:

```bash
npm run typecheck
npm run build
npx tsx --test tests/new-milestone-metadata.test.ts tests/command-contract-docs.test.ts tests/phase-discovery-discuss.test.ts tests/context-diagnostics.test.ts tests/artifact-contracts.test.ts tests/built-schema-assets.test.ts
git diff --check
```

Exit criteria:

- First context is useful starter material, not final authored context.
- Discuss-phase preserves deferred material and source refs without preserving scaffold/prompt literals.

### Wave 7 - Receipts, Idempotency, And Recovery

Objective: make partial scaffold/state failure diagnosable and retry-safe enough for a bounded transition command without adding a full workflow engine.

Tasks:

1. **Sequential - add response receipt fields first, no new durable receipt store.**
   - Dependencies: Waves 4-5.
   - Files and exact changes:
     - `src/mcp/tools/artifacts.ts:225-229` or the local result type definition: extend scaffold result with optional `newMilestoneReceipt` only when `newMilestoneSeed` is present.
     - `src/mcp/tools/artifacts.ts:8783-8868`: populate `status`, `mode`, `firstPhaseNumber`, `firstPhaseDir`, `firstContextPath`, `inputsUsed`, `createdFiles`, `reusedFiles`, `overwrittenFiles`, `blockedFiles`, `deletedPhaseDirectories: []`, `renamedPhaseDirectories: []`, `safeRetry`, and `warnings`.
     - `docs/MCP-TOOLS.md:83-88,241-250`: document optional new-milestone receipt fields as command-specific scaffold metadata.
     - `commands/blu-new-milestone.toml:20-21,23-33`: require final response to report receipt facts and to stop on partial/blocker status.
   - Do not add `.blueprint/runs/`, `.blueprint/receipts/`, or host-global receipt files in this first recovery wave.

2. **Sequential after task 1 - add retry/precondition matrix.**
   - Dependencies: task 1.
   - Files and exact changes:
     - `docs/commands/new-milestone.md:133-139`: expand failure modes and recovery.
     - `skills/blueprint-roadmap-admin/SKILL.md:251-263`: add self-check items for `safeRetry`, partial scaffold, state-update warning, and no direct file repair.
     - `src/mcp/command-runtime-metadata.ts:1119-1120`: mention compact completion/recovery receipt.
   - Required recovery matrix:
     - no scaffold receipt and no state update: safe to start after blockers pass.
     - scaffold receipt complete and state update missing: verify hashes/path existence, then complete only state update.
     - scaffold receipt partial and paths unchanged: resume remaining scaffold operations, then update state.
     - scaffold receipt partial and paths changed: block with `manual-recovery-required`.
     - state updated but scaffold missing or inconsistent: block with diagnostics; do not silently recreate historical paths.
     - confirmation missing or source summary missing: wait, no retry.
   - Retry policy:
     - Retry only transient file/lock/contention errors with bounded backoff.
     - Never retry confirmation blockers, validation errors, path-containment failures, hash/precondition failures, or same-token/different-parameter mismatches.

3. **Parallel-safe after task 1 - add tests.**
   - Dependencies: task 1.
   - Tests to add:
     - duplicate same seed/path returns reused receipt without rewriting.
     - same route but changed `inputsUsed` or first phase preview blocks as stale/precondition failure.
     - confirmed overwrite blocked after file hash drift when hash support exists.
     - injected state-update failure after scaffold can be resumed without rewriting existing starter docs.
     - partial scaffold with user-edited file blocks as `manual-recovery-required`.
     - missing-summary wait returns `safeRetry=false`.
     - starter-overwrite wait returns `safeRetry=false`.
     - no command text recommends direct edits to `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, `.blueprint/ROADMAP.md`, first context, or `STATE.md` after tool blockers.

4. **Sequential - decide whether a later durable receipt store is warranted.**
   - Dependencies: task 1 and at least one real partial-failure use case.
   - If needed later, plan a separate artifact-schema wave for a project-local receipt path. Do not add it opportunistically.
   - Any durable receipt path must document:
     - exact `.blueprint/...` location
     - cleanup/retention behavior
     - relation to `.blueprint/mcp-write-failures.ndjson`
     - why it is recovery evidence, not a second source of truth
     - tests proving completed current files/state remain authoritative

5. **Sequential - verify Wave 7.**
   - Dependencies: tasks 1-3.
   - Commands:

```bash
npm run typecheck
npm run build
npx tsx --test tests/new-milestone-tools.test.ts tests/new-milestone-scaffold.test.ts tests/new-milestone-metadata.test.ts tests/command-contract-docs.test.ts
git diff --check
```

Exit criteria:

- Ordinary success output stays compact.
- Partial/blocker results are typed and do not invite manual `.blueprint/` repair.
- Recovery semantics remain bounded; no full workflow engine is introduced.

### Wave 8 - Final Parity, Built Assets, And End-To-End Verification

Objective: prove future changes are aligned across command, skill, agent, runtime metadata, docs, MCP behavior, and tests.

Tasks:

1. **Parallel-safe - run wording and boundary sweeps.**
   - Dependencies: all implementation waves in the branch.
   - Commands:

```bash
rg -n "route to requirements|<NN-CONTEXT|Are you sure\\?|\\bOK\\b|\\bCancel\\b|update_topic|write_todos|task tracker" commands docs skills agents src tests
rg -n "new-milestone" commands docs skills agents src tests
rg -n "blueprint_config_get" commands/blu-new-milestone.toml docs/commands/new-milestone.md docs/RUNTIME-REFERENCE.md docs/MCP-TOOLS.md skills/blueprint-roadmap-admin/SKILL.md src/mcp/command-runtime-metadata.ts tests
```

2. **Sequential - run full focused verification.**
   - Dependencies: task 1.
   - Commands:

```bash
npm run typecheck
npm run build
npx tsx --test tests/new-milestone-metadata.test.ts tests/new-milestone-scaffold.test.ts tests/new-milestone-tools.test.ts tests/command-catalog.test.ts tests/command-contract-docs.test.ts tests/roadmap-admin-runtime-contract-resource.test.ts tests/extension-runtime-contracts.test.ts tests/agent-contract-specialists.test.ts tests/phase-discovery-discuss.test.ts tests/artifact-contracts.test.ts tests/built-schema-assets.test.ts
git diff --check
```

3. **Sequential - inspect built assets after source changes.**
   - Dependencies: task 2 and `npm run build`.
   - If `src/mcp/command-runtime-metadata.ts`, `src/mcp/tools/artifacts.ts`, `src/mcp/tools/state.ts`, schema assets, or command resources changed, inspect the `dist/` diff and include tracked built output required by the extension-install contract.
   - Do not touch `dist/` for docs-only or manifest-only slices unless build output is intentionally part of that future branch.

4. **Sequential - final behavior checklist.**
   - Dependencies: tasks 1-3.
   - Confirm:
     - `new-milestone` remains `implemented` only because manifest, primary skill, and required MCP tools exist.
     - `/blu`, `/blu-help`, `/blu-progress`, and `/blu-next` still recommend implemented-only commands.
     - Runtime contract resource still builds without `docs/` for roadmap-admin command inputs.
     - Optional roadmapper remains gated by `blueprint_config_get(scope=effective)`.
     - No prompt text instructs direct `.blueprint/` mutation.
     - No command text introduces a tracker, visible todo layer, or stage-by-stage long-running posture for `new-milestone`.

### Future Implementor Prompt

Use this prompt for a future code implementation run after this docs-only plan is approved:

```text
You are implementing the approved `/blu-new-milestone` improvement plan in Blueprint.

Do not use GSD or Blueprint slash workflow to do your work. Use Codex tools only.
Create a fresh worktree/branch before editing. Run `npm ci` before any build, typecheck, or tests.

Read first:
- docs/imp/new-milestone-frontier-research-and-improvement-plan.md, especially `## Detailed Improvement Plan`
- commands/blu-new-milestone.toml
- docs/commands/new-milestone.md
- skills/blueprint-roadmap-admin/SKILL.md
- agents/blueprint-roadmapper.md
- src/mcp/command-runtime-metadata.ts
- docs/RUNTIME-REFERENCE.md
- docs/MCP-TOOLS.md
- docs/ARTIFACT-SCHEMA.md
- tests/new-milestone-metadata.test.ts
- tests/command-contract-docs.test.ts
- tests/command-catalog.test.ts
- tests/roadmap-admin-runtime-contract-resource.test.ts

Implement only one approved wave at a time. Start with Wave 1 unless the user explicitly names another wave.
Keep `.blueprint/` persistence MCP-owned. Do not hand-edit `.blueprint/` except inside isolated test fixtures.
Keep `/blu-new-milestone` bounded: no tracker tools, no long-running progress posture, no final phase planning, no cleanup/renumber/delete of historical phase directories.
If adding source behavior, update docs/tests/runtime metadata and run build/typecheck/focused tests in the same branch. Include tracked `dist/` output when required by the build.

Stop and ask if current code conflicts with the plan in a way that would require changing routing semantics, adding host-global state, adding a new `.blueprint/` write surface, or widening beyond the named wave.
```

### Risk And Rollback Plan

- **Scope drift risk:** future work can easily turn a transition command into a planner or tracker. Rollback by reverting the wave that added tracker/stage/todo language; tests should search for `update_topic`, `write_todos`, and tracker wording in `new-milestone` surfaces.
- **Parity drift risk:** packet fields can appear in prompt text but not runtime metadata or tests. Rollback by reverting the last wave and restoring Wave 1 parity; do not leave half-landed contract names in only one surface.
- **MCP overpromise risk:** `docs/MCP-TOOLS.md` can imply a tool returns fields not yet implemented. Rollback docs first or implement the source behavior before merging.
- **Runtime-input regression risk:** adding docs paths to `blueprint-roadmap-admin` active inputs would break docless installed-extension runtime contracts. Keep `tests/roadmap-admin-runtime-contract-resource.test.ts` as a required gate.
- **Path safety risk:** prompt-only first-phase computation can still supply the wrong canonical path. Runtime guard work must block stale previews and directory conflicts before scaffold writes.
- **Historical evidence risk:** any implementation that deletes, renames, or renumbers prior phase directories violates the core boundary. Add negative tests around `fs.rm`, `fs.rename`, cleanup, remove-phase, and renumber helper usage before merging runtime guard work.
- **Recovery complexity risk:** durable receipt storage can become a second source of truth. Start with response receipts and live file/state verification; add persistent receipt artifacts only in a separate approved wave.
- **Rollback mechanics:** revert one wave at a time. For source waves, revert matching source, docs, tests, and `dist/` together. Never repair a failed rollout by manually rewriting project `.blueprint/` artifacts in the repository checkout.
