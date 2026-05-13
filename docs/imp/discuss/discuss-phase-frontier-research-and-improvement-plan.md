# `/blu-discuss-phase` Frontier Research And Improvement Plan

Date: 2026-05-12

## Scope

This document researches how Blueprint's `/blu-discuss-phase` workflow can become a stronger requirements-discovery, gray-area-analysis, and phase-context-authoring skill without changing runtime code yet. The work is documentation-only: it proposes future edits to the command/skill/runtime-contract text, but it does not modify those files.

## Current Blueprint Workflow Snapshot

Current sources reviewed:

- `commands/blu-discuss-phase.toml`
- `skills/blueprint-phase-discovery/SKILL.md`
- `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md`
- `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`
- `docs/commands/discuss-phase.md`
- `src/mcp/artifact-contracts/index.ts`
- `src/mcp/artifact-contracts/schemas/phase.context.model.schema.json`
- `src/mcp/tools/phase.ts`
- `tests/phase-discovery-discuss.test.ts`
- `tests/context-contract-parity.test.ts`

The current workflow is a long-running mutation command. It resolves the target phase, reads saved Blueprint context and artifact contracts, checks checkpoint state and saved plan inventory, identifies phase-specific gray areas, asks focused questions or runs evidence-backed assumptions mode, checkpoints decisions per area, writes `XX-CONTEXT.md` through the model-only `phase.context` contract, optionally writes `XX-DISCUSSION-LOG.md`, syncs `STATE.md`, reloads state, and reports the refreshed next safe action instead of inferring a direct planning handoff.

Important current strengths:

- Strong MCP ownership: state and artifacts are read and written through declared MCP tools, not direct file edits.
- The context artifact is model-backed and rejects Markdown fallback for `phase.context`.
- The workflow already distinguishes scaffold seed text from final authored context.
- Checkpoints are command-owned and mode-guarded.
- The command explicitly preserves research/UI routing gates after context capture.

Important current risk areas to evaluate:

- The prompt contract is long and dense; agents may comply structurally while still asking generic questions.
- Gray-area identification is conceptually required but not yet expressed as a rigorous decision taxonomy with examples and stop criteria.
- Evidence-backed assumptions mode has useful intent but needs sharper confidence, uncertainty, and contradiction-handling rules.
- The command asks for canonical references, but source quality, recency, and evidence grade are not yet standardized.
- The final context model is rich, but the skill text does not provide a concrete enough filled example or drafting rubric for future agents.

## Research Collection

### R1: Requirements Elicitation And Adaptive Questioning

- Start `/blu-discuss-phase` with a source map, not a generic interview: identify stakeholder classes plus non-person sources such as existing docs, prior versions, defect trackers, interfacing systems, regulations, and operating environment; then ask source-specific questions and mark any unrepresented stakeholder/source class as a named uncertainty ([SWEBOK V4.0a](https://ieeecs-media.computer.org/media/education/swebok/swebok-v4.pdf), [ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html)).
- Replace loose "gray area" wording with a reusable elicitation taxonomy: actor, action/task, object/domain concept, attribute, goal, event, constraint, exception, and external interface. QUARE shows that recurring RE questions can be structured around actor-action-concept abstractions and then extended to goals/events/constraints, so each Blueprint question should state which slot it is resolving ([QUARE](https://link.springer.com/article/10.1007/s10515-023-00386-w)).
- Make the question loop active and problem-seeking: SWEBOK emphasizes that elicitation is not passive because stakeholders omit tacit work and candidate requirements need later analysis; `/blu-discuss-phase` should use "why is this needed?", "what breaks without it?", and "what boundary/exception/security case changes the answer?" probes before accepting a solution-shaped request as the real requirement ([SWEBOK V4.0a](https://ieeecs-media.computer.org/media/education/swebok/swebok-v4.pdf)).
- Add an explicit quality-attribute pass, using ISO/IEC 25010's product-quality model as the checklist for performance, reliability, compatibility, security, maintainability, usability, portability, safety-adjacent constraints, and acceptance measures; otherwise agents will over-capture functional behavior and under-capture testable nonfunctional constraints ([ISO/IEC 25010:2023](https://www.iso.org/ru/standard/78176.html)).
- Rank questions by expected downstream decision value. Active Task Disambiguation frames clarifying questions as information-gain/cost tradeoffs that shrink the viable solution set; Blueprint should ask the question most likely to change plan shape, acceptance tests, safety posture, or artifact content, and stop when remaining answers would not change those outputs ([Active Task Disambiguation with LLMs](https://openreview.net/pdf/df400bd5925a005b64bcb82f4aa4ecd4d4be2002.pdf)).
- Treat ambiguity, inconsistency, and incompleteness as first-class labels. HumanEvalComm shows code models need evaluation on whether they ask good clarifying questions when descriptions have those defects; `/blu-discuss-phase` should label each gray area with the defect type and require either a user answer, a sourced assumption, or a logged unresolved risk before context writing ([HumanEvalComm](https://arxiv.org/abs/2406.00215)).
- Make premature implementation/planning a failure mode in the skill text. ClarifyCoder finds code LLMs often generate despite ambiguous natural-language requirements, while clarification-aware training improves communication and good-question rates; Blueprint should explicitly prefer "ask, evidence-assume, or defer" over inventing a plan-shaped answer ([ClarifyCoder](https://arxiv.org/abs/2504.16331)).
- Use a separate uncertainty scan before authoring `XX-CONTEXT.md`. The 2026 "Ask or Assume?" coding-agent preprint reports gains from decoupling underspecification detection from code execution and conserving questions on simple tasks; Blueprint can mirror this by first listing uncertainty clusters, confidence, and question utility, then entering the interview/assumptions loop ([Ask or Assume?](https://arxiv.org/abs/2603.26233)).
- Add concrete ambiguity subtypes and examples to the skill: lexical, syntactic, semantic, and vagueness. The 2026 Orchid benchmark reports that requirement ambiguity degrades LLM code generation and that models often fail to identify or resolve it autonomously; Blueprint should require a "possible interpretations" mini-table for high-impact ambiguous wording ([Orchid ambiguity benchmark](https://arxiv.org/abs/2604.21505)).
- Keep LLM assistance human-checked and evidence-graded. Recent LLM-for-RE reviews find LLMs useful for elicitation, missing-information detection, drafting, and validation, but call out hallucination, inconsistency, domain-context limits, and the need for hybrid/human-in-the-loop validation; assumptions mode should therefore record source grade, confidence, contradictory evidence, and the checkpoint that accepted the assumption ([Frontiers SLR](https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2025.1519437/full), [LLM4RE SLR](https://arxiv.org/abs/2509.11446)).

Sources: [ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html); [SWEBOK Guide V4.0a](https://ieeecs-media.computer.org/media/education/swebok/swebok-v4.pdf); [ISO/IEC 25010:2023](https://www.iso.org/ru/standard/78176.html); [QUARE](https://link.springer.com/article/10.1007/s10515-023-00386-w); [Active Task Disambiguation with LLMs](https://openreview.net/pdf/df400bd5925a005b64bcb82f4aa4ecd4d4be2002.pdf); [HumanEvalComm](https://arxiv.org/abs/2406.00215); [ClarifyCoder](https://arxiv.org/abs/2504.16331); [Ask or Assume?](https://arxiv.org/abs/2603.26233); [Orchid ambiguity benchmark](https://arxiv.org/abs/2604.21505); [Frontiers LLM-for-RE SLR](https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2025.1519437/full).

### R2: Human-AI Interaction, Mixed-Initiative Dialog, And Clarification

- Make `/blu-discuss-phase` explicitly set expectations before questioning: what artifact it is trying to produce, what it can infer from existing repo context, and where it may be wrong. Microsoft HAX's CHI 2019 guidelines emphasize making clear what an AI system can do, how well it can do it, and why it acted; the workflow implication is an opening "working frame" plus visible assumptions, not a cold interrogation ([Amershi et al., CHI 2019](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf)).
- Treat clarification as a cost/benefit decision, not a reflex. Horvitz's mixed-initiative UI principles argue for dialog when it resolves important uncertainty, while also minimizing interruption cost; OpenAI's current Model Spec similarly says to weigh the cost of a wrong assumption against asking for input. `/blu-discuss-phase` should ask only when ambiguity would materially alter plan/spec output, otherwise proceed with stated, editable assumptions ([Horvitz, CHI 1999](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/chi99horvitz.pdf), [OpenAI Model Spec](https://model-spec.openai.com/2025-04-11.html)).
- Ask one high-leverage question per turn and yield cleanly. Google Conversation Design warns against monopolizing the conversation or bundling many questions after handing the turn to the user; the discuss flow should prefer a sequenced queue with progress markers over 8-question dumps ([Google Conversation Design](https://developers.google.com/assistant/conversation-design/learn-about-conversation)).
- Prefer questions that reveal intent, tradeoffs, constraints, and success criteria over shallow form filling. Recent LLM follow-up-question research found users valued thought-provoking, open-ended, insight-offering questions more than simple information gathering; `/blu-discuss-phase` should generate questions from downstream artifact gaps and explain why each answer matters ([Tix 2024](https://arxiv.org/abs/2407.12017)).
- Ground each question in evidence already available. Mixed-initiative conversational-search work frames clarification as selecting the next question from conversation plus retrieved background; for Blueprint, that means reading existing `.blueprint/` artifacts and repo facts first, then asking only for missing or conflicting human intent ([IBM Research, DialDoc 2022](https://research.ibm.com/publications/conversational-search-with-mixed-initiative-asking-good-clarification-questions-backed-up-by-passage-retrieval)).
- Preserve user control over AI participation. Google PAIR recommends balancing automation with user control and making feedback/questions understandable; IBM's IUI 2025 work on conversational agents found users wanted controls over when, what, and where agents participate. `/blu-discuss-phase` should offer clear controls such as "infer with assumptions", "ask deeper", "skip", "revise answer", and "summarize now" ([Google PAIR Feedback + Control](https://pair.withgoogle.com/guidebook-v2/chapters/feedback-controls/), [IBM Research, IUI 2025](https://research.ibm.com/publications/controlling-ai-agent-participation-in-group-conversations-a-human-centered-approach)).
- Make assumptions and rationale reviewable. IBM Design for AI says users should be able to ask why an AI is doing what it is doing; HAX also calls for efficient correction when the AI is wrong. The discuss artifact should carry an "assumptions and open questions" ledger that users can correct later without restarting the phase ([IBM Design for AI: Explainability](https://www.ibm.com/design/ai/ethics/explainability/), [Microsoft HAX Guidelines](https://www.microsoft.com/en-us/haxtoolkit/?p=105)).
- Build in light cognitive forcing to reduce overreliance. Stanford HAI summarizes evidence that explanations alone often fail unless they shift the user's cost/benefit of scrutinizing AI; `/blu-discuss-phase` should include a short challenge pass that surfaces contradictions, risky assumptions, and "what would change this plan?" prompts before finalizing ([Stanford HAI](https://hai.stanford.edu/news/ai-overreliance-problem-are-explanations-solution)).
- Match conversation memory to phase memory. HAX recommends remembering recent interactions and supporting correction over time; Google notes users often provide extra information anticipating future questions. The flow should avoid re-asking known facts, accept bundled answers, and keep a compact checkpoint summary after each major intent cluster ([Amershi et al., CHI 2019](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf), [Google Conversation Design](https://developers.google.com/assistant/conversation-design/learn-about-conversation)).

Sources verified live on 2026-05-12: [Amershi et al., CHI 2019](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf); [Horvitz, CHI 1999](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/chi99horvitz.pdf); [Microsoft HAX Toolkit](https://www.microsoft.com/en-us/haxtoolkit/?p=105); [Google PAIR Feedback + Control](https://pair.withgoogle.com/guidebook-v2/chapters/feedback-controls/); [Google Conversation Design](https://developers.google.com/assistant/conversation-design/learn-about-conversation); [IBM Research DialDoc 2022](https://research.ibm.com/publications/conversational-search-with-mixed-initiative-asking-good-clarification-questions-backed-up-by-passage-retrieval); [IBM Research IUI 2025](https://research.ibm.com/publications/controlling-ai-agent-participation-in-group-conversations-a-human-centered-approach); [IBM Design for AI: Explainability](https://www.ibm.com/design/ai/ethics/explainability/); [OpenAI Model Spec](https://model-spec.openai.com/2025-04-11.html); [Stanford HAI on overreliance](https://hai.stanford.edu/news/ai-overreliance-problem-are-explanations-solution); [Tix 2024](https://arxiv.org/abs/2407.12017).

### R3: Agent Memory, Checkpointing, Context Compression, And Handoff

- Treat the checkpoint object, not the chat transcript, as `/blu-discuss-phase`'s resume primitive: LangGraph persists graph snapshots by thread and step, and OpenAI sessions make the session the memory object, so each gray-area checkpoint should carry `phaseId`, `areaId`, status, decision, evidence refs, confidence, pending question, and downstream consumers ([LangGraph persistence](https://langchain-5e9cc07a.mintlify.app/oss/python/langgraph/persistence), [OpenAI Agents SDK sessions](https://openai.github.io/openai-agents-python/sessions/)).
- Persist after every gray-area boundary and every user answer, not only at final `CONTEXT.md` write: checkpoint-per-step enables interrupt/resume, human approval, time-travel/debugging, and fault-tolerant execution; for Blueprint this means resume should reload area state and skip or revisit areas deterministically instead of inferring progress from prior prose ([LangGraph checkpointing reference](https://reference.langchain.com/python/langgraph/checkpoints/)).
- Keep explicit memory tiers: stable project/contract rules, active turn context, per-phase decision memory, and archival discussion log. MemGPT's virtual-context design and Claude Code's persistent memory files both argue against relying on a single compressed conversation buffer; Blueprint carry-forward should select facts by tier and purpose ([MemGPT](https://arxiv.org/abs/2310.08560), [Claude Code memory/context docs](https://code.claude.com/docs/en/how-claude-code-works)).
- Make compression structured and provenance-preserving: Claude Code notes that compaction can drop early instructions, while OpenHands keeps recent messages intact and summarizes older history; `/blu-discuss-phase` should keep the raw `DISCUSSION-LOG.md` append-only and write a compact `checkpointSummary` with source anchors, omitted details, contradictions, and "do not infer beyond this" warnings ([Claude Code context window](https://code.claude.com/docs/en/how-claude-code-works), [OpenHands Context Condenser](https://docs.openhands.dev/sdk/guides/context-condenser)).
- Trigger summarization at semantic milestones, not just token pressure: Context-as-a-Tool proposes stable task semantics, condensed long-term memory, and high-fidelity short-term interactions, while Active Context Compression lets the agent decide when to consolidate; Blueprint should compact after each area is resolved/blocked and before handoff to research/UI/plan ([Context as a Tool](https://arxiv.org/abs/2512.22087), [Active Context Compression](https://arxiv.org/abs/2601.07190)).
- Carry forward a filtered handoff packet, not the whole conversation: OpenAI handoffs support typed metadata and input filters, and LangChain handoffs warn that passing full subagent history causes bloat/confusion; Blueprint should hand `plan-phase` only decisions, requirements, rejected options, assumptions, open questions, evidence refs, and routing gates ([OpenAI Agents SDK handoffs](https://openai.github.io/openai-agents-python/handoffs/), [LangChain handoffs](https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs)).
- Model area progress as a small state machine (`unseen`, `questioning`, `assumed`, `decided`, `blocked`, `needs-revisit`) because handoff/state-pattern docs emphasize persistent state variables for sequential constraints; resume should advance from these statuses, not from natural-language "we discussed X" heuristics ([LangChain handoffs](https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs/)).
- Preserve reflective failure memory: Reflexion stores verbal feedback in episodic memory to improve later attempts, so Blueprint should checkpoint why an area was hard, what generic question failed, which assumption was later contradicted, and what must not be repeated on resume or downstream planning ([Reflexion](https://arxiv.org/abs/2303.11366)).
- Prefer artifact references over repeated conversation copying: Anthropic's multi-agent research system saves plans/findings to memory or filesystem and passes lightweight references to avoid "game of telephone"; Blueprint should have discuss/research/UI agents write durable artifacts, then carry forward stable references plus concise conclusions ([Anthropic multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)).
- Verify the design with interrupt/compact/resume fixtures: Anthropic recommends end-state evaluation and discrete checkpoints for multi-turn state mutation, and SWE-agent's history processors show context trimming can affect caching and model input; future Blueprint tests should simulate mid-area interruption, compaction, resume, and downstream handoff, then assert exact `CONTEXT.md` and routing-state preservation ([Anthropic multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system), [SWE-agent history processors](https://swe-agent.com/latest/reference/history_processor_config/)).

Sources: [LangGraph persistence](https://langchain-5e9cc07a.mintlify.app/oss/python/langgraph/persistence); [OpenAI Agents SDK sessions](https://openai.github.io/openai-agents-python/sessions/); [OpenAI Agents SDK handoffs](https://openai.github.io/openai-agents-python/handoffs/); [Anthropic effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents); [Anthropic multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system); [Claude Code context docs](https://code.claude.com/docs/en/how-claude-code-works); [OpenHands Context Condenser](https://docs.openhands.dev/sdk/guides/context-condenser); [SWE-agent history processors](https://swe-agent.com/latest/reference/history_processor_config/); [Context as a Tool](https://arxiv.org/abs/2512.22087); [Active Context Compression](https://arxiv.org/abs/2601.07190); [MemGPT](https://arxiv.org/abs/2310.08560); [Reflexion](https://arxiv.org/abs/2303.11366).

### R4: Evidence Grounding, Source Quality, And Verification Discipline

- Treat current repo evidence as the ground truth for Blueprint behavior: grade live command output/tests and current source above repo docs, and repo docs/manifests/skills above external best-practice material; SWE-bench-style coding evals center real repos/issues/tests, while OpenAI's 2026 SWE-bench Verified retirement warns public coding benchmarks can become contaminated or underspecified.
- Use external evidence to improve method, not to assert Blueprint facts: NIST AI 600-1 defines confabulation as confident false, divergent, or contradictory output and recommends empirically validated capability claims, source/citation review, and grounded provenance; `/blu-discuss-phase` should never let an external paper override observed repository/runtime evidence.
- Require claim-level grounding in the final context model: split important statements into atomic facts and label each as `repo-observed`, `repo-inferred`, `external-primary`, `external-secondary`, `user-stated`, or `unknown`; FActScore and ALCE both show long-form factuality/citation quality needs per-claim support checks, not a section-level "has citations" pass.
- Use a source-quality ladder: canonical repo contracts/runtime files > MCP-produced state/artifacts > direct user answers > official upstream docs/standards/research-lab papers > peer-reviewed or frontier arXiv papers > reputable secondary summaries; blogs/forums/LLM memory should be `low` confidence and never sole support for requirements decisions.
- Make citations verifiable, not decorative: cite exact repo file/line evidence for repo claims and exact URL/section evidence for external claims; generative-search audits found many fluent cited answers still contain unsupported statements or inaccurate citations, and 2026 deep-research-agent work shows link validity/relevance does not guarantee factual support.
- Prefer direct evidence extraction before synthesis: for high-impact context decisions, collect the quote/line/command evidence first, then infer; WebGPT, GopherCite, and Anthropic's citation docs converge on retrieved passage support, while NIST warns fabricated logic or citations can increase misplaced trust.
- Treat uncertainty as a first-class output: use labels like `confirmed`, `likely`, `assumption`, `contradicted`, `unverified`, and `needs-user-decision`, each with a short reason and next verification step; OpenAI's hallucination and SimpleQA work show accuracy-only grading rewards guessing, so abstention and calibrated uncertainty should be explicitly credited.
- Preserve contradictions instead of smoothing them away: when implementation, repo docs, user statements, or external sources disagree, mark `contradicted`, cite both sides, prefer current runtime/source for behavior claims, and route to a focused user question or later bug/decision record.
- Apply freshness rules by evidence type: for dependency/API/security/model-behavior claims, browse current canonical docs and record dates where useful; for Blueprint behavior, prefer the current worktree and command output because external articles decay faster than the checkout.
- In assumptions mode, cap evidence-backed defaults to high-grade evidence with low blast radius; otherwise ask one focused question. NIST's deployment-context warnings and OpenAI's "search/RAG are not panaceas" point against upgrading a searched answer into certainty.

Sources verified live on 2026-05-12: [NIST AI 600-1](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence), [WebGPT](https://arxiv.org/abs/2112.09332), [GopherCite](https://arxiv.org/abs/2203.11147), [SimpleQA](https://arxiv.org/abs/2411.04368), [Why Language Models Hallucinate](https://openai.com/index/why-language-models-hallucinate/), [SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/), [SWE-bench Verified retirement note](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/), [FActScore](https://ai.meta.com/research/publications/factscore-fine-grained-atomic-evaluation-of-factual-precision-in-long-form-text-generation/), [ALCE](https://arxiv.org/abs/2305.14627), [Evaluating Verifiability in Generative Search Engines](https://arxiv.org/abs/2304.09848), [Cited but Not Verified](https://arxiv.org/abs/2605.06635), [Anthropic Citations](https://platform.claude.com/docs/en/build-with-claude/citations).

### R5: Planning-Oriented Requirements Specs And Downstream Consumption

- Treat `CONTEXT.md` as a requirements baseline, not a chat summary: capture stakeholder goal, scope boundary, operating context, functional requirements, non-functional constraints, assumptions, risks, acceptance/verification hooks, and stable requirement IDs so `/blu-research-phase`, `/blu-ui-phase`, and `/blu-plan-phase` can consume a known information item rather than re-eliciting basics ([ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html), [NASA requirements definition](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)).
- Capture every requirement in a testable form: write "shall/should" intent, measurable fit/success criteria, verification method, and unresolved measurement gaps; if the user cannot quantify success, `/blu-discuss-phase` should persist that as an explicit open question for research or planning, not let `/blu-plan-phase` invent acceptance criteria ([INCOSE Guide to Writing Requirements excerpt](https://www.incose.org/docs/default-source/working-groups/requirements-wg/shared_gtwr/gtwr_characteristics_section_4_050423.pdf?sfvrsn=9a7548c7_2), [Volere template](https://www.volere.org/templates/volere-requirements-specification-template/)).
- Preserve provenance and traceability per requirement/assumption: source/owner, confidence, parent goal, dependent decisions, and downstream consumer (`research`, `ui`, `plan`); NASA's traceability guidance implies that untraced "self-derived" items should be flagged for concurrence before they become plan tasks ([NASA requirements management and traceability](https://science.nasa.gov/wp-content/uploads/2023/04/nasa_systems_engineering_handbook_0.pdf)).
- Record quality attributes as scenarios, not adjectives: performance, reliability, security, accessibility, modifiability, and usability should include stimulus/context, expected response, and measure; this gives `/blu-ui-phase` and `/blu-plan-phase` architecture-driving constraints instead of vague "fast/secure/simple" wishes ([SEI quality attribute scenarios](https://www.sei.cmu.edu/library/reasoning-about-software-quality-attributes/)).
- Separate accepted decisions from live decision candidates: for each architecture/product choice, capture context/forces, options considered, status, chosen decision if any, consequences, and supersession links; ADR sources make this the durable "why" that prevents downstream agents from blindly accepting or reversing a choice ([Nygard ADR](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions), [Google Cloud ADR guidance](https://docs.cloud.google.com/architecture/architecture-decision-records), [MADR](https://adr.github.io/madr/)).
- Make `/blu-research-phase` inputs first-class: persist known unknowns, evidence needed, candidate source classes, risk/uncertainty, and stop conditions; ReAct-style agents use external actions to update plans, so the discuss handoff should state what evidence to seek and what decision it will unblock ([ReAct](https://openreview.net/forum?id=WE_vluYUL-X)).
- Make `/blu-ui-phase` applicability explicit: record users, critical user journeys, accessibility/safety/privacy constraints, interaction surfaces, and if no UI is needed, a positive skip rationale tied to project scope; Google ADR guidance's CUJ and functional/non-functional prompts are a useful minimum handoff shape ([Google Cloud ADR guidance](https://docs.cloud.google.com/architecture/architecture-decision-records)).
- Make `/blu-plan-phase` consume a planning problem, not prose: capture initial state, desired end state, preconditions, dependencies, resource/tool constraints, forbidden moves, and validation oracle; PlanBench and LLM-Modulo work both warn that LLMs need explicit problem/preference specifications and external verification rather than self-invented plans ([PlanBench](https://openreview.net/forum?id=wUU-7XTL5XO), [LLM-Modulo planning](https://arxiv.org/abs/2402.01817)).
- Shape handoffs as typed, filtered packets: each downstream phase should receive only relevant requirements, decisions, assumptions, open questions, evidence refs, and routing gates; OpenAI handoffs model delegation as a tool with structured inputs/filters, while Anthropic emphasizes context management and modular agent design ([OpenAI Agents SDK handoffs](https://openai.github.io/openai-agents-js/guides/handoffs/), [Anthropic effective agents](https://resources.anthropic.com/building-effective-ai-agents)).
- Standardize downstream work products before agents run: MetaGPT's ICLR paper ties multi-agent software work to role-specific standardized outputs, and SWE-agent shows interface design affects coding-agent success; `/blu-discuss-phase` should therefore emit stable sections for `researchBrief`, `uiBrief`, `planBrief`, `nonGoals`, `tests`, and `repoConstraints` instead of relying on downstream agents to mine a transcript ([MetaGPT](https://proceedings.iclr.cc/paper_files/paper/2024/hash/6507b115562bb0a305f1958ccc87355a-Abstract-Conference.html), [SWE-agent](https://papers.nips.cc/paper_files/paper/2024/hash/5a7c947568c1b1328ccc5230172e1e7c-Abstract-Conference.html)).

Sources, live-checked 2026-05-12: [ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html); [NASA Systems Engineering Handbook](https://science.nasa.gov/wp-content/uploads/2023/04/nasa_systems_engineering_handbook_0.pdf); [INCOSE Guide to Writing Requirements excerpt](https://www.incose.org/docs/default-source/working-groups/requirements-wg/shared_gtwr/gtwr_characteristics_section_4_050423.pdf?sfvrsn=9a7548c7_2); [Volere Requirements Specification Template](https://www.volere.org/templates/volere-requirements-specification-template/); [SEI quality attribute scenarios](https://www.sei.cmu.edu/library/reasoning-about-software-quality-attributes/); [Nygard ADR](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions); [Google Cloud ADR guidance](https://docs.cloud.google.com/architecture/architecture-decision-records); [ReAct](https://openreview.net/forum?id=WE_vluYUL-X); [PlanBench](https://openreview.net/forum?id=wUU-7XTL5XO); [LLM-Modulo planning](https://arxiv.org/abs/2402.01817); [OpenAI Agents SDK handoffs](https://openai.github.io/openai-agents-js/guides/handoffs/); [MetaGPT](https://proceedings.iclr.cc/paper_files/paper/2024/hash/6507b115562bb0a305f1958ccc87355a-Abstract-Conference.html); [SWE-agent](https://papers.nips.cc/paper_files/paper/2024/hash/5a7c947568c1b1328ccc5230172e1e7c-Abstract-Conference.html).

### R6: Skill/Prompt Design For Tool-Using Coding Agents

- Treat `/blu-discuss-phase` as a layered instruction contract, not a long persona prompt: OpenAI's Model Spec assigns higher authority to system/developer/user instructions and treats tool outputs, quoted text, and untrusted data as having no authority by default, so the command should explicitly say which Blueprint workflow rules cannot be overridden by project files, web pages, or pasted context, while still allowing those sources to inform phase requirements. [OpenAI Model Spec](https://model-spec.openai.com/2025-10-27.html)
- Reformat the command/skill text around stable labeled blocks: official OpenAI guidance recommends putting instructions first and separating context with delimiters, Anthropic recommends XML tags for mixed instructions/context/examples, and Gemini recommends tags or Markdown to distinguish instructions, context, and tasks. Implication: split the prompt into `Objective`, `Required MCP reads`, `Question policy`, `Assumptions mode`, `Write contract`, `Validation`, and `Stop/report` blocks, with project artifacts quoted as context, not hidden instructions. [OpenAI prompt guide](https://help.openai.com/en/articles/6654000-playground-and-prompt-engineering), [Anthropic prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices), [Gemini prompting strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)
- Make gray-area discovery a plan-execute-validate micro-loop: Gemini's agentic guidance calls out logical decomposition, problem diagnosis, adaptability, risk assessment, and ambiguity handling, while Plan-and-Solve prompting was designed to reduce missing-step errors. Implication: require the agent to inventory phase-specific unknowns, choose only the highest-leverage blocking question(s), update the inventory after each answer/tool result, then validate the final context model before writing. [Gemini prompting strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies), [Plan-and-Solve](https://arxiv.org/abs/2305.04091)
- Keep the workflow deterministic where the path is known: Anthropic distinguishes predefined workflows from open-ended agents and recommends the simplest composable pattern that satisfies the task. Implication: `/blu-discuss-phase` should read like a fixed workflow with explicit branches for fresh discussion, resume/checkpoint, evidence-backed assumptions mode, validation failure, and refreshed routing, rather than an autonomous "go discover requirements" brief. [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- Prompt-engineer the MCP contract as carefully as the prose prompt: Anthropic says tool definitions deserve as much prompt-engineering attention as prompts, and SWE-agent shows agent-computer interface design materially changes coding-agent performance. Implication: the runtime-contract text should state exact read/write tool order, read-vs-write risk boundaries, stale-output handling, examples of valid tool arguments, and the required state reload after writes. [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents), [SWE-agent](https://arxiv.org/abs/2405.15793)
- Replace negative guardrails with concrete action thresholds: OpenAI advises saying what to do instead of only what not to do, and Anthropic notes models may suggest rather than act unless tool/action expectations are explicit. Implication: say "read state/artifact contract before asking", "ask at most N blocking questions unless user opts into depth", "write only through the model-backed phase context tool after confidence criteria are met", and "checkpoint unresolved uncertainty instead of inventing filler." [OpenAI prompt guide](https://help.openai.com/en/articles/6654000-playground-and-prompt-engineering), [Anthropic prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- Add few-shot examples for the hard parts, not the obvious path: Anthropic calls examples one of the most reliable ways to steer format and consistency, and OpenAI highlights examples for parseable output. Implication: add one compact filled example of a gray-area inventory and final `phase.context` decision trail, plus one anti-example showing generic questions that fail to bind to roadmap/code evidence. [Anthropic prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices), [OpenAI prompt guide](https://help.openai.com/en/articles/6654000-playground-and-prompt-engineering)
- Keep structured output schema guidance semantic, not merely syntactic: OpenAI Structured Outputs can constrain tool-call arguments to JSON Schema, but Google cautions that syntactically valid structured output still needs semantic validation. Implication: require a final self-check that every required `phase.context` field is evidence-backed or explicitly assumption-backed, no scaffold filler remains, and unresolved questions are represented intentionally. [OpenAI function calling](https://help.openai.com/en/articles/8555517-function-calling-in-the-openai-api), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- Use ReAct-style observation updates without exposing chain-of-thought: ReAct shows interleaving reasoning and actions helps agents update plans and handle exceptions, and Gemini/Anthropic both emphasize reflection/adaptability after tool results. Implication: after every MCP read, validation result, or user answer, the skill should update the gray-area inventory and next-question choice, not march through an initial static questionnaire. [ReAct](https://arxiv.org/abs/2210.03629), [Gemini prompting strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies), [Anthropic prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- Bound persistence, parallelism, and repair loops: Anthropic recommends parallel independent tool calls but warns not to guess missing parameters, while Gemini's agentic template distinguishes transient retries from strategy changes on other failures. Implication: allow parallel independent reads of docs/state/contracts, gate writes sequentially, and on validation failure attempt one targeted repair or checkpoint diagnostics rather than looping indefinitely. [Anthropic prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices), [Gemini prompting strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)

Sources: [OpenAI Model Spec](https://model-spec.openai.com/2025-10-27.html), [OpenAI prompt guide](https://help.openai.com/en/articles/6654000-playground-and-prompt-engineering), [OpenAI function calling](https://help.openai.com/en/articles/8555517-function-calling-in-the-openai-api), [Anthropic prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices), [Anthropic: Building effective agents](https://www.anthropic.com/engineering/building-effective-agents), [Gemini prompting strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies), [Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), [ReAct](https://arxiv.org/abs/2210.03629), [Plan-and-Solve](https://arxiv.org/abs/2305.04091), [SWE-agent](https://arxiv.org/abs/2405.15793).

## Reconciled Research Synthesis

The six research lanes converge on eight improvements for `/blu-discuss-phase`: make discovery more systematic, ask fewer but higher-value questions, keep assumptions visibly provisional, grade evidence at claim level, persist resumable decisions instead of relying on chat memory, author the model-backed context as a planning baseline, hand downstream commands typed briefs, and make the command/skill prompt easier for tool-using agents to execute reliably.

1. **Gray-area discovery needs a taxonomy, not vibes.** The current workflow already requires phase-specific gray-area discovery, but the research suggests making the inventory explicit before questioning. A good inventory should classify each gap by the requirement slot it affects: actor, action/task, object/domain concept, attribute, goal, event, constraint, exception, external interface, quality attribute, or acceptance/verification hook. This follows requirements-engineering guidance in [SWEBOK V4.0a](https://ieeecs-media.computer.org/media/education/swebok/swebok-v4.pdf), [ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html), and QUARE's actor-action-concept framing ([QUARE](https://link.springer.com/article/10.1007/s10515-023-00386-w)). For Blueprint, the behavior change is concrete: after reading state, roadmap, prior context, and the `phase.context` contract, the agent should produce a compact gray-area queue whose entries say what is ambiguous, incomplete, inconsistent, or unverifiable; why it matters to `research`, `ui`, or `plan`; and what would make the area resolved. Newer ambiguity/clarification benchmarks such as [HumanEvalComm](https://arxiv.org/abs/2406.00215), [ClarifyCoder](https://arxiv.org/abs/2504.16331), and the 2026 Orchid/Ask-or-Assume notes are useful supporting signals, but should be treated as lower-confidence method evidence where they are preprints.

2. **The question loop should optimize for decision value.** R1, R2, and R6 all reject generic interviews. Clarifying questions are valuable when they change the solution set, acceptance criteria, safety posture, routing gate, or final context model; otherwise they become interruption cost. That is consistent with mixed-initiative principles from [Horvitz](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/chi99horvitz.pdf), the [OpenAI Model Spec](https://model-spec.openai.com/2025-04-11.html), [Active Task Disambiguation with LLMs](https://openreview.net/pdf/df400bd5925a005b64bcb82f4aa4ecd4d4be2002.pdf), and conversation-design guidance to avoid bundled interrogations ([Google Conversation Design](https://developers.google.com/assistant/conversation-design/learn-about-conversation)). Blueprint should therefore keep the current one-question loop but make the ranking rule explicit: ask the highest-leverage unresolved question, explain the artifact/routing decision it will unblock, accept bundled answers when the user volunteers them, then update the queue before asking again. Stop when remaining unknowns can be safely captured as assumptions, open questions, or research tasks without changing the next safe action.

3. **Assumptions mode should be a controlled fallback, not a silent planning shortcut.** The research agrees that `/blu-discuss-phase` may infer when user input is absent, but only with visible confidence, provenance, and blast-radius limits. Human-AI guidance emphasizes user control and correction ([Google PAIR](https://pair.withgoogle.com/guidebook-v2/chapters/feedback-controls/), [Microsoft HAX](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf)); requirements and citation research warn that fluent generated statements can be unsupported ([NIST AI 600-1](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence), [ALCE](https://arxiv.org/abs/2305.14627), [FActScore](https://ai.meta.com/research/publications/factscore-fine-grained-atomic-evaluation-of-factual-precision-in-long-form-text-generation/)). In Blueprint terms, assumptions mode should only resolve gray areas when evidence is high grade and the downstream risk is low or explicitly accepted. Each assumption should state source, confidence, competing interpretations, contradiction status, owner if known, and whether it is safe for `plan-phase` or must be reopened by `research-phase`, `ui-phase`, or the user.

4. **Evidence grading should be claim-level and repo-first.** The synthesis from R4 is especially important: external research can improve method, but current Blueprint behavior must be grounded in the worktree, MCP results, runtime contracts, tests, command manifests, and direct user answers. The evidence ladder should be canonical repo source/runtime output first, MCP-produced state/artifacts next, user answers next, then official standards/upstream docs, peer-reviewed or lab research, frontier preprints, and finally secondary summaries. This avoids letting a best-practice paper override what the extension actually does. The final `phase.context` model should split important claims into atomic facts tagged as `repo-observed`, `repo-inferred`, `user-stated`, `external-primary`, `external-secondary`, `assumption`, `contradicted`, or `unknown`, with citation anchors where available. Contradictions should be preserved rather than smoothed: prefer runtime/source for Blueprint behavior, cite both sides, and route the conflict into a user question, research brief, or bug/decision record.

5. **Checkpointing and resume should be state-machine based.** R3 makes the strongest case that chat transcript memory is the wrong resume primitive. Systems such as [LangGraph persistence](https://langchain-5e9cc07a.mintlify.app/oss/python/langgraph/persistence) and [OpenAI Agents SDK sessions](https://openai.github.io/openai-agents-python/sessions/) treat snapshots/session records as durable memory; agent handoff systems recommend typed metadata and filters rather than full-history passing ([OpenAI handoffs](https://openai.github.io/openai-agents-python/handoffs/), [LangChain handoffs](https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs)). Blueprint already has command-owned checkpoints, so the future improvement is to make each gray area a small state machine: `unseen`, `questioning`, `assumed`, `decided`, `blocked`, or `needs-revisit`. Persist after every user answer and area boundary, recording `phaseId`, `areaId`, decision, evidence refs, confidence, pending question, downstream consumers, and why an earlier question or assumption failed. Resume should load that structure, avoid re-asking known facts, and continue deterministically.

6. **Context compression must preserve provenance and correction paths.** R2 and R3 both warn that users may provide extra information out of order, while long-running agents may compact or lose earlier context. The safe Blueprint pattern is tiered memory: stable project/contract rules, active turn context, per-phase decision memory, and archival `DISCUSSION-LOG.md`. The raw log can stay append-only, but the checkpoint summary should be structured and source-anchored: decisions, omitted details, contradictions, unresolved risks, and "do not infer beyond this" notes. Research on context management, including [MemGPT](https://arxiv.org/abs/2310.08560), OpenHands context condensation, and lower-confidence frontier work on active/context-as-a-tool compression, supports the method direction. For Blueprint, summarization should happen at semantic milestones such as resolving or blocking a gray area and before downstream handoff, not merely when tokens run low.

7. **Model-backed `phase.context` authoring should produce a requirements baseline.** R5 is the key bridge from conversation to artifact. `XX-CONTEXT.md` should not be a transcript recap; it should be a baseline that downstream commands can consume without re-eliciting basics. That means stable requirement IDs where useful, stakeholder/goal/scope boundaries, functional requirements, quality-attribute scenarios, constraints, assumptions, risks, accepted decisions versus candidate decisions, acceptance/verification hooks, and open measurement gaps. The evidence base here comes from requirements standards and practice sources such as [ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html), the [NASA Systems Engineering Handbook](https://science.nasa.gov/wp-content/uploads/2023/04/nasa_systems_engineering_handbook_0.pdf), [INCOSE requirements guidance](https://www.incose.org/docs/default-source/working-groups/requirements-wg/shared_gtwr/gtwr_characteristics_section_4_050423.pdf?sfvrsn=9a7548c7_2), [Volere](https://www.volere.org/templates/volere-requirements-specification-template/), and SEI quality-attribute scenarios. Because Blueprint's context artifact is model-backed, the skill should provide semantic validation criteria as well as schema compliance: no scaffold filler, no ungrounded certainty, unresolved questions represented intentionally, and each required field backed by user input, repo evidence, or a labeled assumption.

8. **Downstream handoff should be typed, filtered, and routing-aware.** The final discuss-phase output should hand each later command the subset it needs: `researchBrief` with known unknowns, candidate source classes, decision it unblocks, and stop conditions; `uiBrief` with users, critical journeys, interaction surfaces, accessibility/privacy/safety constraints, or an explicit no-UI rationale; and `planBrief` with initial state, desired end state, dependencies, forbidden moves, validation oracle, non-goals, and repo constraints. Planning research such as [PlanBench](https://openreview.net/forum?id=wUU-7XTL5XO) and [LLM-Modulo](https://arxiv.org/abs/2402.01817) supports making planning problems explicit and externally verifiable, while multi-agent/handoff guidance from [OpenAI](https://openai.github.io/openai-agents-js/guides/handoffs/), [Anthropic](https://resources.anthropic.com/building-effective-ai-agents), [MetaGPT](https://proceedings.iclr.cc/paper_files/paper/2024/hash/6507b115562bb0a305f1958ccc87355a-Abstract-Conference.html), and [SWE-agent](https://papers.nips.cc/paper_files/paper/2024/hash/5a7c947568c1b1328ccc5230172e1e7c-Abstract-Conference.html) supports standardized role-specific outputs. For Blueprint, the critical behavior is preserving implemented-only routing: after writing context, reload state and report the refreshed next safe action instead of assuming an automatic `plan-phase` handoff.

## Blueprint-Specific Improvement Analyses

### A1: Phase Resolution And Prior-Context Read

#### Current Behavior

- `/blu-new-project` delegates orchestration to `blueprint-bootstrap`, reads bootstrap artifact contracts before authoring, and treats `mcp_blueprint_blueprint_project_init` as the first persistent bootstrap write. Its runtime contract says returned `createdPaths`, `configPath`, `nextAction`, validation diagnostics, and project status routing are authoritative, not paths reconstructed by the agent (`commands/blu-new-project.toml`, `skills/blueprint-bootstrap/SKILL.md`, `skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md`).
- `blueprintProjectInit` seeds `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, `.blueprint/ROADMAP.md`, `.blueprint/phases/`, `.blueprint/config.json`, `.blueprint/STATE.md`, and the first phase `XX-CONTEXT.md`. That context is explicitly starter-only: it says it was seeded during `/blu-new-project`, cites project/requirements/roadmap as canonical references, instructs `/blu-discuss-phase <phase>` to replace it, and carries both scaffold and bootstrap-starter markers (`src/mcp/tools/project.ts`).
- Bootstrap state sets `currentPhase` to the first roadmap phase, `activeCommand` to `/blu-new-project`, and `nextAction` to `/blu-discuss-phase <phase>` unless brownfield evidence is provisional, in which case it routes to `/blu-map-codebase` before treating the roadmap as durable (`src/mcp/tools/project.ts`).
- The `/blu-discuss-phase` manifest delegates detailed behavior to `blueprint-phase-discovery` and the discuss-phase runtime contract, while locally requiring effective config before sidecar decisions, phase-scoped writes only, numeric phase references for write tools, overwrite confirmation, model-backed `phase.context` writes, and final synced state refresh with the selected phase preserved (`commands/blu-discuss-phase.toml`).
- The shared phase-discovery skill requires `/blu-discuss-phase` to resolve the phase through MCP before write decisions, ground itself in `blueprint_phase_context`, read current context and discussion log, read materially relevant earlier phase contexts, read plan inventory, read canonical artifact contracts, checkpoint per area, and route from refreshed `blueprint_state_load.derivedStatus.nextAction` (`skills/blueprint-phase-discovery/SKILL.md`).
- The command-specific runtime contract defines the pre-question evidence packet as `blueprint_phase_context`, `blueprint_roadmap_read`, `blueprint_artifact_list`, `blueprint_config_get`, `blueprint_phase_artifact_read`, `blueprint_phase_checkpoint_get`, `blueprint_phase_plan_index`, and `blueprint_artifact_contract_read`; it also says saved `.blueprint/codebase/` summaries should be read before broad repo rereads (`skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md`).
- MCP phase resolution is deterministic: `blueprintPhaseLocate` resolves from explicit request, state, or roadmap; verifies `.blueprint/ROADMAP.md`; requires one matching phase directory; and returns `phaseNumber`, `phasePrefix`, `phaseDir`, artifact list, `resolvedFrom`, failure `reason`, and recovery hints (`src/mcp/tools/phase.ts`).
- `blueprintPhaseContext` returns selected phase details and artifact signals, but its `workflowPosture.currentPhase` is sourced from `blueprintStateLoad` when available. That means it can expose ambient routing state that differs from the selected phase resolved by `blueprintPhaseLocate` (`src/mcp/tools/phase.ts`, `src/mcp/tools/state.ts`).
- Runtime state can intentionally diverge from the roadmap when the user selected an earlier phase: `buildSyncedState` accepts `patch.currentPhase`, warns when it preserved the requested phase over the roadmap current phase, and tests assert that a discuss-phase run for Phase 2 does not route to Phase 3 planning (`src/mcp/tools/state.ts`, `tests/phase-discovery-discuss.test.ts`).
- Starter context is detectable in runtime: state sync warns when current context still has the bootstrap starter marker, and phase artifact usability treats bootstrap starter context as present but unusable for downstream planning. However, `blueprint_phase_artifact_read` itself returns raw content or missing status without classifying starter versus authored content (`src/mcp/tools/state.ts`, `src/mcp/tools/phase.ts`).

#### Gaps / Risks

- The bootstrap handoff to discuss-phase is implicit rather than packetized. Agents can infer it from `createdPaths`, seeded state, `nextAction`, and starter `XX-CONTEXT.md`, but no contract requires `/blu-new-project` to name a compact handoff packet or `/blu-discuss-phase` to read that packet before replacing the starter.
- The starter context is intentionally not final context, but the discuss-phase read contract does not require a `starter-context` status. A run can treat a marker-bearing starter as ordinary prior context unless the agent notices the marker text itself.
- The read contract lists the right tools but does not fully specify a stable read order, which fields become the canonical selected-phase register, or which reads may safely run in parallel after `blueprint_phase_locate` succeeds. That leaves room for agents to mix `phase_context.workflowPosture.currentPhase` with the explicitly selected phase.
- `blueprint_phase_context` combines selected-phase data with ambient project workflow state from `blueprintStateLoad`; when those disagree, the prompt contract does not force the agent to label them separately as `selectedPhase` and `stateCurrentPhase`.
- "Materially relevant earlier phase context artifacts" is underspecified. Agents could overread every prior context file, miss reusable prior decisions, or recency-bias toward the current file without checking roadmap requirement overlap, canonical references, deferred ideas, or shared codebase surfaces.
- Existing context and discussion reads return raw content or absence; the prompt contract does not require an explicit status classification such as missing, scaffold/starter-only, authored substantive, unreadable, invalid, or conflicts-with-checkpoint before choosing reuse, repair, or overwrite posture.
- Checkpoint reads are owner/mode guarded at the MCP layer, but the A1 read phase does not state precedence when a safe checkpoint, an existing context artifact, and a discussion log disagree. That ambiguity can produce duplicate questions or accidental overwrite pressure.
- The plan-inventory warning exists, but the read phase does not say how to present it before questioning: saved plans should be treated as stale downstream consumers, not evidence that refreshed context will automatically update planning.
- Tests currently cover registered tool allowlists, selected earlier phase state preservation, checkpoint ownership, scaffold replacement, state-update failure checkpoint retention, and validation behavior, but they mostly assert text and MCP primitives rather than an explicit bootstrap-handoff or resolved-read-packet contract (`tests/phase-discovery-discuss.test.ts`).

#### Specific Improvements

- Add an explicit bootstrap handoff packet to the new-project contract. Future text snippet for `skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md`:

  ```md
  After `mcp_blueprint_blueprint_project_init` succeeds, summarize a bootstrap handoff packet:
  `bootstrapHandoff.initialPhase`, `bootstrapHandoff.phasePrefix`,
  `bootstrapHandoff.phaseDir`, `bootstrapHandoff.starterContextPath`,
  `bootstrapHandoff.bootstrapSources`, `bootstrapHandoff.statePath`,
  `bootstrapHandoff.configPath`, and `bootstrapHandoff.nextAction`.
  Build it only from the MCP result plus the approved bootstrap seed. Do not
  reconstruct paths that the MCP result already returned. Mark the seeded
  `XX-CONTEXT.md` as `starter-context`, not as authored discuss-phase context.
  ```

- Add a matching handoff-read rule to the discuss runtime contract. Future text snippet for `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md`:

  ```md
  If the selected phase has a bootstrap starter `XX-CONTEXT.md`, treat it as the
  `/blu-new-project` handoff packet: read it together with `.blueprint/PROJECT.md`,
  `.blueprint/REQUIREMENTS.md`, `.blueprint/ROADMAP.md`, config, and state routing.
  Reuse its objective, requirement ids, success criteria, and canonical
  references as grounding, but classify the context status as `starter-context`
  and replace it with authored discuss-phase decisions before downstream planning.
  ```

- Add a selected-phase register to the discuss runtime contract immediately after `blueprint_phase_locate`. Future text snippet for `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md`:

  ```md
  After `blueprint_phase_locate` succeeds, create a run-local selected-phase register:
  `selectedPhase = String(result.phaseNumber)`, `selectedPhasePrefix = result.phasePrefix`,
  `selectedPhaseDir = result.phaseDir`, and `selectedPhaseResolvedFrom = result.resolvedFrom`.
  Use `selectedPhase` for every phase-scoped read, checkpoint, scaffold path, artifact write,
  checkpoint cleanup, and final `patch.currentPhase`. Treat any state-derived current phase
  returned by later reads as ambient routing context, not as a replacement for `selectedPhase`.
  If `found: false`, stop before artifact reads or writes and report `reason` plus `recovery`.
  ```

- Make the minimum read order deterministic while still allowing parallel independent reads. Future text snippet:

  ```md
  Read order: (1) `blueprint_phase_locate`; (2) in parallel, `blueprint_phase_context`,
  `blueprint_roadmap_read`, `blueprint_artifact_list`, and `blueprint_config_get`;
  (3) using the selected-phase register, read current context, current discussion log,
  discuss checkpoint with owner/mode guards, plan inventory, and `phase.context` contract;
  (4) read `phase.discussion-log` contract only when a durable discussion log is likely;
  (5) read earlier phase context only when the relevance rule below matches.
  ```

- Add a prior-context relevance rule so "earlier phase" reads are useful and bounded. Future text snippet:

  ```md
  Earlier phase context is materially relevant when it shares roadmap requirement ids,
  canonical references, deferred ideas, codebase surfaces, MCP tool families, command
  lifecycle gates, or explicit dependency language with the selected phase. Prefer the
  nearest prior matching phase plus any phase explicitly referenced by ROADMAP or saved
  context. If no rule matches, say no earlier context was reused instead of doing a broad sweep.
  ```

- Require a compact read-packet summary before the first fresh user question. The packet should include selected phase, phase resolution source, state current phase if different, bootstrap handoff status, config mode (`discuss`, `assumptions`, or `skip_discuss`), context status, discussion-log status, checkpoint status, prior context reused/skipped, codebase-summary status, and plan-inventory warning.
- Add artifact status classification to the contract and skill. Suggested statuses: `missing`, `scaffold-starter`, `authored-substantive`, `validation-suspect`, `unreadable`, `safe-checkpoint`, `foreign-checkpoint`, and `stale-plan-inventory`. The classification should drive the next gate: resume/discard, overwrite confirmation, repair, or fresh discovery.
- Clarify checkpoint precedence. If `blueprint_phase_checkpoint_get` returns `safeToResume: true`, ask resume-versus-discard before using current artifact content as the live thread. If the checkpoint is foreign or unsafe, summarize it as non-resumable evidence only and do not overwrite it from discuss-phase.
- Add an explicit warning rule for saved plans. Future text snippet:

  ```md
  When `blueprint_phase_plan_index` returns saved plans, tell the user before rewriting context:
  "This refresh can improve phase context, but existing PLAN files will not be rewritten.
  Re-run `/blu-plan-phase <selectedPhase>` later if planning should consume the refreshed context."
  ```

- Update `commands/blu-discuss-phase.toml` with one short local guard rather than duplicating the full workflow: "Before any user question or sidecar decision, resolve the phase and build the selected-phase read packet from the runtime contract. Keep selected phase distinct from ambient state phase when they differ."
- Update `skills/blueprint-phase-discovery/SKILL.md` to say the selected-phase register applies to reads as well as writes. Today the strongest wording is around write tools; phase-scoped artifact reads, prior-context reads, checkpoint calls, plan inventory, scaffold paths, and final state patch should be equally pinned to the `blueprint_phase_locate` result.

#### Verification Ideas For Later Implementation

- Add contract tests that `/blu-new-project` names the bootstrap handoff packet and marks seeded `XX-CONTEXT.md` as `starter-context`, while preserving MCP-returned `createdPaths`, `configPath`, `statePath`, and `nextAction` as authoritative.
- Add regex-oriented contract tests in `tests/phase-discovery-discuss.test.ts` for the selected-phase register, the explicit found-false stop rule, the read order, and the prior-context relevance rule.
- Add a fixture with state on Phase 3 and an explicit `/blu-discuss-phase 2` target, then assert the resolved read packet exposes Phase 2 as selected while `stateCurrentPhase` remains separately visible and never replaces selected phase for reads or writes.
- Add a starter-context fixture from `blueprintProjectInit`, then assert the discuss contract requires `starter-context` classification, bootstrap source reads, and replacement through model-backed `phase.context` before downstream planning.
- Add a checkpoint conflict fixture where a safe discuss checkpoint and an existing discussion log disagree; verify the documented prompt contract requires resume-versus-discard before fresh questioning.
- Add a plan-inventory fixture with an existing `XX-PLAN.md` and assert the command/skill/runtime text preserves the stale-plan warning before context rewrite.
- After implementation, run `npm test -- tests/phase-discovery-discuss.test.ts` plus `npm run typecheck`; if only prompt/contracts/docs change, the narrow test file should still be the primary regression signal.

### A2: Gray-Area Discovery And Question Selection

#### Current Behavior

- The command manifest delegates detailed gray-area behavior to the skill/runtime contract, requires effective config before sidecar decisions, and allows a bounded `blueprint-researcher` gray-area memo only when the runtime contract and config permit it (`commands/blu-discuss-phase.toml:5`, `commands/blu-discuss-phase.toml:10`, `commands/blu-discuss-phase.toml:18`).
- The shared skill already requires repo/context grounding before questioning, one-question `ask_user` dialogs for concrete tradeoffs, explicit pending gates, user choice over gray areas, `next area` / `more questions` loops, canonical references, deferred-idea capture, and per-area checkpoints (`skills/blueprint-phase-discovery/SKILL.md:184`, `skills/blueprint-phase-discovery/SKILL.md:188`, `skills/blueprint-phase-discovery/SKILL.md:189`, `skills/blueprint-phase-discovery/SKILL.md:192`).
- The runtime contract says to generate gray areas from the selected phase rather than generic categories; each area should name a decision that would change implementation, with current lenses covering scope, user-visible behavior, interface contracts, reuse, dependencies, risk/failure handling, and methodology (`skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md:61`, `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md:66`).
- The single-agent fallback already models the loop as one selected area at a time: compress carry-forward context, ask one focused question, validate vague or conflicting answers, record options/rationale/evidence/consequences, checkpoint, and then continue or ask whether more questions are needed (`skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md:105`, `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md:110`, `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md:114`, `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md:117`, `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md:120`).
- The saved `phase.context` schema requires implementation decisions, open questions, dependencies, and canonical references, but it does not require typed gray-area metadata; the current tests assert broad contract text and checkpoint behavior, not semantic quality of selected questions (`src/mcp/artifact-contracts/schemas/phase.context.model.schema.json:28`, `src/mcp/artifact-contracts/schemas/phase.context.model.schema.json:56`, `src/mcp/artifact-contracts/schemas/phase.context.model.schema.json:162`, `tests/phase-discovery-discuss.test.ts:368`, `tests/phase-discovery-discuss.test.ts:464`).
- The checkpoint schema is compatible with richer gray-area state but does not require it today: it requires `ownerCommand`, `completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta`, while `.catchall(z.unknown())` permits future metadata; tests exercise per-area refresh, current-question resume, retained checkpoints after failures, and foreign/legacy checkpoint rejection (`src/mcp/tools/phase-checkpoint-records.ts:39`, `src/mcp/tools/phase-checkpoint-records.ts:90`, `src/mcp/tools/phase-checkpoint-records.ts:102`, `tests/phase-discovery-discuss.test.ts:484`, `tests/phase-discovery-discuss.test.ts:697`, `tests/phase-discovery-discuss.test.ts:908`).

#### Gaps And Risks

- The current "useful lenses" are helpful, but they are not a requirements taxonomy. An agent can satisfy the contract with broad categories like "scope" or "risk" while missing actor, action/task, object/domain concept, attribute, goal, event, constraint, exception, external interface, quality attribute, and acceptance/verification gaps.
- The flow says "identify gray areas first" but does not require a visible inventory shape with `areaId`, defect type, evidence source, downstream consumer, decision value, and resolution criterion. That makes it hard to tell whether the agent found the right unknowns or merely produced a plausible interview agenda.
- Question selection is under-specified. The user can choose an area, but when the user defers or the agent must recommend the next area, there is no explicit ranking rule based on whether the answer would change phase boundary, implementation approach, acceptance tests, safety posture, routing, or final context fields.
- Stop criteria are too soft. "Current area is clear" and "more questions" loops do not say when an area is resolved, when an unknown should become an open question, or when it should be handed to `/blu-research-phase`, `/blu-ui-phase`, or `/blu-plan-phase` rather than keeping the interview alive.
- Answer validation focuses on vague, incomplete, or conflicting answers, but the prompt does not explicitly label ambiguity, incompleteness, inconsistency, unverifiability, or competing interpretations. Without labels, downstream context can flatten uncertainty into overconfident implementation decisions.
- One-question control is present as a principle, but not yet as a user-facing control contract. The reconciled R8/R9 research above asks for explicit `answer`, `infer with assumptions`, `skip/defer`, `revise`, `ask deeper`, and `summarize/write now` controls so the human can steer the queue without the agent turning every gray area into another interview turn.
- The queue can disappear between turns because current checkpoint fields are parallel lists and generic decision records. Until a typed checkpoint schema lands, prompt text should name the area fields that must survive in `decisions[*]`, `remainingAreas[*]`, or `resumeMeta` instead of trusting prose memory.
- The schema can render `openQuestions` and supports the exact `none` sentinel, but it cannot by itself distinguish a high-value unresolved decision from generic leftovers. Prompt text must carry that burden until a future checkpoint or context schema grows typed question metadata (`src/mcp/artifact-contracts/schemas/phase.context.model.schema.json:56`, `tests/phase-discovery-discuss.test.ts:387`, `tests/phase-discovery-discuss.test.ts:405`).
- Regression coverage currently protects tool allowlists, routing, checkpoint persistence, validation repair, and sentinel behavior, but it does not detect generic questions like "What should we consider?" or missing taxonomy coverage (`tests/phase-discovery-discuss.test.ts:199`, `tests/phase-discovery-discuss.test.ts:368`, `tests/phase-discovery-discuss.test.ts:557`).

#### Specific Improvements

- Add a required pre-question inventory to the runtime contract under `## Gray Area Identification`:

  ```md
  Before asking the user anything, build a compact `grayAreaQueue` from the evidence packet. This queue is working state/checkpoint context, not a competing artifact schema. Each entry must include:
  - `areaId`: stable kebab-case label
  - `lens`: scope-boundary | user-visible-behavior | interface-contract | reuse | dependency | risk-failure | methodology
  - `slot`: actor | action-task | object-concept | attribute | goal | event | constraint | exception | external-interface | quality-attribute | acceptance-verification
  - `defect`: ambiguous | incomplete | inconsistent | unverifiable | tradeoff
  - `evidence`: repo paths, saved artifacts, MCP results, or user-provided source that exposed the gap
  - `downstreamImpact`: research | ui | plan | validation | routing
  - `decisionValue`: high | medium | low
  - `interruptionCost`: low | medium | high
  - `rankingReason`: why this should be asked, assumed, deferred, or handed off now
  - `resolutionCriterion`: what answer, assumption, or handoff makes the area resolved
  - `candidateQuestion`: the single next question that would resolve or shrink the area
  - `checkpointState`: unseen | questioning | assumed | decided | blocked | needs-revisit | handed-off
  ```

- Replace the current broad "Useful lenses" wording with a taxonomy plus examples while preserving the existing Blueprint-friendly lenses:

  ```md
  Classify every gray area by requirement slot first, then by Blueprint lens. Example: `slot=external-interface`, `lens=interface contract`, `defect=incomplete`, `impact=plan+validation`: "The roadmap says sync to GitHub, but no payload, auth, or failure contract is known."
  ```

- Add a question-selection rule to `## Questioning Rules`:

  ```md
  Ask the highest-decision-value unresolved question next. A question is high value only when the answer can change phase boundary, implementation approach, acceptance/verification hooks, safety/security posture, artifact routing, or required `phase.context` fields. If the answer would only add color, record it as a deferred idea or optional note instead of interrupting.
  Rank ties by downstream blocker first, then evidence conflict, then lower interruption cost. Do not ask a medium- or low-value question while a high-value area is still `questioning`, `blocked`, or `needs-revisit` unless the user explicitly chooses another area.
  ```

- Add a required one-question format for interactive `ask_user` calls:

  ```md
  Question: <one concrete phase-specific decision>
  Why it matters: <which context field, downstream command, or routing gate this unblocks>
  Known evidence: <repo path/MCP result/user source>
  Recommended option: <safe default, only when evidence supports one>
  Other options: <2-3 concrete alternatives plus freeform escape>
  Resolved when: <exact criterion that lets the agent checkpoint or move on>
  ```

- Add a required control set for each surfaced gray-area question:

  ```md
  Controls for this question:
  - Answer now: use my answer as the decision source.
  - Infer with assumptions: choose a repo-grounded default, label confidence and consequence if wrong, then checkpoint it as `assumed`.
  - Skip/defer: move the area to `openQuestions`, `deferredIdeas`, or the downstream handoff named in `resolutionCriterion`.
  - Revise prior answer: reopen the referenced `areaId`, preserve the old decision as superseded, and checkpoint the correction.
  - Ask deeper: ask one narrower follow-up for this same `areaId`; do not branch into a new area.
  - Summarize/write now: stop asking if all high-value areas are resolved or intentionally carried forward.
  ```

- Add explicit anti-generic-question text:

  ```md
  Do not ask checklist or atmosphere questions such as "Any other requirements?", "What should we consider?", or "What are your preferences?" unless the question is tied to a named `grayAreaQueue` entry, cites the evidence gap, and states what downstream decision the answer will change.
  ```

- Add stop criteria to the runtime contract after the single-agent fallback:

  ```md
  An area is resolved when one of these is true:
  1. A user answer or evidence-backed assumption maps to a concrete `implementationDecisions` entry with rationale/evidence.
  2. The unknown is intentionally recorded in `openQuestions` with owner/consumer and no longer blocks the current context write.
  3. The unknown is routed to `research`, `ui`, or later planning with the exact follow-up read or artifact dependency recorded.
  4. The idea is out of scope and captured under `deferredIdeas`.
  Stop asking when all high-decision-value areas are resolved by one of those paths and remaining low-value details would not change the next safe action.
  ```

- Strengthen checkpoint guidance without requiring immediate runtime schema changes:

  ```md
  When checkpointing an area, preserve the taxonomy fields in `decisions[*]`, `remainingAreas[*]`, or `resumeMeta.notes` until a typed checkpoint schema exists. Resume must not re-ask an area whose `resolutionCriterion` was already met unless new evidence contradicts the saved decision.
  ```

- Add prompt-compatible checkpoint fields that fit the current `.catchall` parser before any schema hardening:

  ```json
  {
    "schemaVersion": "discuss-gray-area/v1",
    "activeAreaId": "auth-error-contract",
    "areaQueue": [
      {
        "areaId": "auth-error-contract",
        "lens": "interface-contract",
        "slot": "exception",
        "defect": "incomplete",
        "decisionValue": "high",
        "interruptionCost": "low",
        "checkpointState": "questioning",
        "candidateQuestion": "Should auth failures use the existing generic failure shape or define a machine-readable error code now?",
        "resolutionCriterion": "Chosen error-shape policy is saved in implementationDecisions with validation expectation.",
        "downstreamImpact": ["plan", "validation"],
        "evidenceRefs": [".blueprint/ROADMAP.md", "src/api/errors.ts"]
      }
    ],
    "progress": {
      "decided": 0,
      "assumed": 0,
      "blocked": 0,
      "total": 1,
      "nextAction": "ask auth-error-contract"
    }
  }
  ```

- Add a model-authoring bridge so the inventory does not remain hidden prompt state:

  ```md
  Every resolved high-value area must appear in the final `phase.context` model as either an `implementationDecisions` row, a `dependencies.requiredFollowUpReads` item, an `openQuestions` item, a `deferredIdeas` item, or a `canonicalReferences` source. If none of those fields receives the area, the discussion is not ready to write.
  ```

- Add compact few-shot examples to the runtime contract or skill reference:

  ```md
  Positive gray area example:
  - `areaId`: auth-error-contract
  - `slot`: exception
  - `defect`: incomplete
  - `evidence`: `.blueprint/ROADMAP.md` says "handle auth failures"; no error payload is specified in current context.
  - `downstreamImpact`: plan, validation
  - `decisionValue`: high
  - `candidateQuestion`: "For auth failures, should this phase standardize a machine-readable error code now, reuse the existing generic failure shape, or defer payload shape to a later API-contract phase?"
  - `resolved`: selected generic failure shape; record rationale and validation expectation in `implementationDecisions`.

  Negative gray area example:
  - Bad question: "Any other error-handling requirements?"
  - Why it fails: no `areaId`, no evidence gap, no downstream decision, and no resolution criterion.
  - Better question: "For `areaId=auth-error-contract`, should the implementation reuse the existing generic failure shape or define a machine-readable auth error code in this phase?"
  - Controls: answer now, infer with assumptions, skip/defer to API-contract phase, revise prior auth decision, ask deeper about client behavior, or summarize/write now if this is no longer high value.
  ```

#### Verification Ideas For Later Implementation

- Extend `tests/phase-discovery-discuss.test.ts` to assert the runtime contract contains the taxonomy labels, `grayAreaQueue`, `decisionValue`, `resolutionCriterion`, and the anti-generic-question rule.
- Add a prompt-contract fixture that fails if `Questioning Rules` lacks a decision-value ranking rule or lacks the "Resolved when" one-question format.
- Add a checkpoint fixture with typed area metadata in `completedAreas`, `remainingAreas`, `decisions`, or `resumeMeta.notes`, then verify resume can preserve owner/mode safety while carrying area-specific question state.
- Add a sample `phase.context` model fixture derived from two gray areas: one resolved into `implementationDecisions`, one intentionally left in `openQuestions`; validate that `openQuestions: ["none"]` is used only when every high-value area is resolved elsewhere.
- Add a regression assertion that generic prompt fragments like "Any other requirements?" are absent from the discuss runtime contract unless shown as an explicit anti-example.
- Later, if runtime simulation tests become practical, run a mocked discovery transcript where repo evidence contains one scope conflict and one interface gap, then assert the selected first question targets the high-decision-value gap and records why it matters before checkpointing.

### A3: Assumptions Mode And Evidence-Backed Defaults

#### Current Behavior

- `/blu-discuss-phase` stays command-thin: `commands/blu-discuss-phase.toml` reads effective config, then delegates detailed behavior to `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md`. The command file names assumptions mode, sidecar fallback, checkpointing, validation repair, and final routing, but does not define assumption safety itself.
- The current runtime contract has an `Assumptions Mode` block. It tells agents to prefer evidence-first assumptions when `workflow.discuss_mode="assumptions"`, cite repo paths, saved artifacts, or official supplied references, state the consequence if wrong, label confidence as `Confident`, `Likely`, or `Unclear`, and ask the user only to correct uncertain or high-impact assumptions.
- The shared skill repeats the boundary at a higher level: keep execution mode explicit, allow one bounded `blueprint-researcher` assumptions pass when configured and useful, preserve canonical references behind decisions, and run a blocking pre-save check for placeholders, contradictions, missing canonical references, unsupported mode claims, and dropped deferred ideas.
- `docs/commands/discuss-phase.md` describes assumptions mode as an evidence-first alternative to interview-style discovery and requires rich context authoring: selected assumptions, rationale, repo paths or saved artifacts, consequences if wrong, canonical references, and deferred ideas.
- Canonical references are currently context-level evidence pointers, not claim-linked records. The `phase.context` model requires `canonicalReferences`, and validation requires at least one named source, saved artifact, repo path, or URL, but the schema does not yet prove which assumption, decision, or open question each reference supports.
- Current tests in `tests/phase-discovery-discuss.test.ts` pin the command/skill/runtime contract wiring, the existence of `Assumptions Mode`, the phrase `consequence if the assumption is wrong`, model-only context writes, the exact `Open Questions` `none` sentinel, checkpoint owner/mode safety, and discussion-log validation for dropped follow-ups and unsupported mode claims. They do not yet pin source tiers, confidence criteria, contradiction handling, readiness ledger content, or ask-versus-assume-versus-research thresholds.

#### Gaps And Risks

- There is no assumption readiness ledger before `blueprint_phase_artifact_write`. Agents can jump from plausible default to `Implementation Decisions` without proving source basis, confidence, contradiction status, consequence if wrong, and downstream disposition for each gray area.
- Confidence labels are named but under-specified. `Confident`, `Likely`, and `Unclear` need source-tier thresholds, contradiction gates, consequence-if-wrong limits, and downstream-use rules.
- "High-impact" is undefined. Without a hard ask threshold, an agent may assume through phase scope, public behavior, data or API contracts, security/privacy posture, migration/deletion behavior, acceptance criteria, command routing, or downstream research/UI gates.
- Contradiction handling is too generic. Current text says to detect contradictions before saving, but not how to resolve conflicts among live MCP output, repo source/tests, saved Blueprint artifacts, current user intent, and external references.
- Evidence grading is not claim-level. `canonicalReferences` can list useful sources, but they do not force an assumption to name whether it is `repo-observed`, `repo-inferred`, `saved-artifact`, `user-stated`, `official-external`, `research-secondary`, `assumption`, `contradicted`, or `unknown`.
- There is no explicit route-to-research threshold. Technical feasibility, dependency choice, external correctness, source freshness, and third-party behavior can be neither safe to assume nor efficient to ask the user about; those should become a `/blu-research-phase` handoff item instead of a hidden plan premise.
- `workflow.skip_discuss=true` can shorten the interview, but the contract does not yet say it inherits every assumptions-mode safety rule. That leaves room for skipped discussion to save thin defaults as if they were confirmed.
- Pre-write checks do not yet distinguish "valid markdown shape" from "safe assumptions." The existing validator can reject missing canonical references, placeholder content, unsupported mode claims, and dropped follow-ups, but prompt text still needs to block unsafe assumption promotion before persistence.

#### Specific Improvements

- Add an assumption readiness ledger before context write. This is prompt/runtime-contract behavior first; do not require a schema change in the initial implementation. The ledger can live in checkpoint notes, discussion-log prose, or compact internal working state, but it must be complete before a default is promoted into the `phase.context` model.

  ```md
  ## Assumption Readiness Ledger

  Before writing `phase.context` in assumptions mode or skip-discuss mode, build
  a compact ledger for every high-value gray area:

  | areaId | default or question | source tier | evidence refs | confidence | consequence if wrong | contradiction status | disposition | context destination |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | <stable area id> | <default, question, or handoff item> | <tier label> | <repo paths, saved artifacts, MCP results, user answer, or source ids> | Confident|Likely|Unclear | low|moderate|high - <specific downstream damage> | none|stale-artifact|repo-vs-doc|user-vs-artifact|external-vs-repo|unresolved | plan-safe-assumption|ask-user|route-research|route-ui|keep-open|rejected | Implementation Decisions|Open Questions|Dependencies|Deferred Ideas|discussion-log only |

  Do not write `phase.context` until every high-decision-value area has a
  disposition. Do not place `Unclear`, `contradicted`, or `unknown` defaults in
  `Implementation Decisions` except as rejected/contradicted options with a
  safe follow-up destination.
  ```

- Add source tiers and require every durable assumption to carry one. This gives future skill and runtime-contract edits a stable vocabulary without changing the current `phase.context` schema:

  ```md
  Source tiers for assumptions:
  - `live-mcp`: direct output from Blueprint MCP tools for the current repo and selected phase.
  - `repo-source`: current repo source, tests, manifests, command files, runtime contracts, or docs read directly from the checkout.
  - `saved-blueprint-artifact`: current `.blueprint/` artifacts such as PROJECT, REQUIREMENTS, ROADMAP, prior CONTEXT, DISCUSSION-LOG, RESEARCH, UI-SPEC, PLAN, SUMMARY, validation, or checkpoints.
  - `current-user`: the user's current answer, correction, preference, or explicit approval in this session.
  - `supplied-official-external`: official external reference supplied or allowed for this run, with source identity and access date when applicable.
  - `secondary-external`: non-official or summarized external material; useful for research queues, not plan-safe defaults by itself.
  - `repo-inferred`: pattern inferred from multiple repo observations but not directly stated.
  - `model-inferred`: plausible model default with no concrete source; never plan-safe.
  - `contradicted`: two or more source tiers conflict materially.
  - `unknown`: no adequate source found.

  Prefer `live-mcp`, `repo-source`, and `current-user` for current behavior.
  Use `saved-blueprint-artifact` as prior-decision evidence unless it conflicts
  with live MCP output, repo source, or the current user's answer.
  ```

- Define confidence labels with downstream limits:

  ```md
  Confidence labels:
  - Confident: `live-mcp`, `repo-source`, `current-user`, or directly applicable
    `saved-blueprint-artifact` evidence supports the default; no material
    contradiction was found; and the consequence if wrong is low or easily
    reversible. May become `plan-safe-assumption`.
  - Likely: The default follows from a consistent repo pattern, prior artifact,
    or user preference but lacks direct confirmation, or the consequence if
    wrong is moderate. May be used only when the consequence is named and the
    final context makes the assumption visible to downstream planning.
  - Unclear: Evidence is thin, stale, conflicting, external-only,
    model-inferred, or the consequence if wrong is high. Must not become a
    plan-safe decision; ask the user, route to research/UI, or keep it open.
  ```

- Add one shared ask-versus-assume-versus-research threshold to the runtime contract and the shared skill:

  ```md
  Ask instead of assuming when the answer changes phase scope, user-visible
  behavior, data/API/document contracts, security or privacy posture, migration
  or deletion behavior, acceptance criteria, command routing, overwrite/reuse
  posture, or whether research/UI/plan gates are required.

  Assume only when the default is backed by `live-mcp`, `repo-source`,
  `current-user`, or non-conflicting `saved-blueprint-artifact` evidence; the
  consequence if wrong is low or moderate and named; and the final context can
  label the default as reversible or provisional.

  Route to `/blu-research-phase` when the missing answer depends on external
  correctness, source freshness, dependency/tool choice, ecosystem behavior,
  technical feasibility beyond the current read packet, or multiple plausible
  repo interpretations that need evidence gathering rather than user preference.

  Route to `/blu-ui-phase` when the missing answer is visual hierarchy,
  interaction behavior, accessibility, user journey shape, or an explicit
  no-UI rationale that the UI contract owns.

  Keep open instead of assuming when the issue is high-impact, contradicted,
  owner-dependent, or not needed until a later phase.
  ```

- Add contradiction handling that preserves conflicts instead of smoothing them:

  ```md
  Contradiction handling:
  - Mark `contradiction status` in the readiness ledger whenever two source
    tiers materially disagree.
  - For current Blueprint runtime behavior, prefer `live-mcp` and `repo-source`
    over saved docs, stale context, or inferred patterns.
  - For desired product intent, prefer the current user's explicit answer over
    older artifacts unless the user asks to preserve the older decision.
  - For external correctness, prefer supplied or allowed official external
    references over secondary summaries; if external checking is not allowed,
    route the item to research or mark it `unknown`.
  - If the conflict changes implementation shape, ask the user.
  - If the conflict changes technical feasibility, dependency choice, source
    freshness, or ecosystem behavior, route to `/blu-research-phase`.
  - If the conflict only affects later-phase scope, preserve it in `Deferred
    Ideas` or `Open Questions` rather than forcing closure.
  ```

- Make `consequence if wrong` mandatory and specific:

  ```md
  Consequence if wrong:
  - `low`: reversible wording, naming, ordering, or local implementation detail
    that does not change public behavior, data contracts, routing, or validation.
  - `moderate`: affects implementation order, test strategy, reuse choice, or a
    visible behavior detail, but can be corrected before execution without data
    loss or contract breakage.
  - `high`: affects phase scope, public contract, persisted data, security,
    privacy, destructive behavior, compliance, command routing, or whether a
    downstream research/UI gate is required.

  The ledger entry must name the concrete downstream damage, not just the label.
  ```

- Add pre-write checks for assumptions mode and skip-discuss mode:

  ```md
  Assumptions pre-write check:
  1. Every high-value gray area has a readiness-ledger row.
  2. Every row has source tier, evidence refs, confidence, contradiction status,
     consequence if wrong, disposition, and context destination.
  3. No `Unclear`, `contradicted`, `model-inferred`, `secondary-external`,
     or `unknown` default is promoted to `Implementation Decisions` as plan-safe.
  4. Every `Implementation Decisions` assumption is either `Confident` or a
     visible `Likely` assumption with named consequence and reversible scope.
  5. Every unresolved high-impact item appears in `Open Questions`,
     `Dependencies`, a downstream research/UI handoff, or `Deferred Ideas`.
  6. `Canonical References` contains the exact source refs used by the ledger
     and each reference note says what it supports or controls.
  7. `Open Questions` uses the exact `none` value only when the ledger has no
     `ask-user`, `route-research`, `route-ui`, `keep-open`, or unresolved
     high-impact rows.
  8. Write `XX-DISCUSSION-LOG.md` when assumptions were presented, corrected,
     rejected, contradicted, or routed to research/UI in a way future agents
     must reconstruct.
  ```

- Extend the `blueprint-researcher` sidecar prompt guidance for assumptions mode:

  ```md
  Ask `blueprint-researcher` for one assumptions pass only when configured and
  useful. It must return:
  - defaults grouped by gray area
  - source tier and direct repo paths, saved artifacts, MCP result names, user
    supplied facts, or supplied official references
  - confidence label using the discuss contract definitions
  - contradictions or missing evidence
  - consequence if wrong
  - recommended disposition: plan-safe-assumption, ask-user, route-research,
    route-ui, keep-open, or rejected
  - the smallest question or research item that would change each default

  It must not draft `phase.context`, author `XX-RESEARCH.md`, decide final
  routing, or mark `Unclear` defaults as implementation decisions.
  ```

- Add final context placement rules that fit the current schema:

  ```md
  Context placement for assumptions:
  - Put confirmed user answers and plan-safe assumptions in `Implementation
    Decisions`, with inline evidence and confidence wording when helpful.
  - Put provisional assumptions that planning may use carefully in
    `Implementation Decisions` only when they are `Likely`, reversible, and
    carry a named consequence if wrong.
  - Put research-needed assumptions in `Dependencies` or `Open Questions`, and
    mention that `/blu-research-phase` owns the evidence pass.
  - Put UI-needed assumptions in `Dependencies` or `Open Questions`, and mention
    that `/blu-ui-phase` owns the design/no-UI decision.
  - Put rejected or contradicted defaults in `Deferred Ideas`,
    `Open Questions`, or the discussion log, not as active decisions.
  - Keep `canonicalReferences` claim-supportive by noting what each source
    supports or controls; do not use source lists as decoration.
  ```

- Make `workflow.skip_discuss=true` explicitly inherit the same assumptions safety rules:

  ```md
  `workflow.skip_discuss=true` may reduce or skip interview turns, but it does
  not waive assumption safety. The command must still build the readiness ledger,
  label defaults, preserve source tiers and consequences, ask or stop on
  high-impact unresolved items, and route research/UI-owned unknowns instead of
  silently writing them as plan-safe context.
  ```

- Add a compact discussion-log block for corrections and routed assumptions:

  ```md
  ## Assumptions Reviewed
  - Presented:
  - User correction:
  - Evidence changed:
  - Contradiction status:
  - Consequence if wrong:
  - Final disposition:
  - Downstream impact:
  ```

- Add one positive and one negative few-shot example. The positive example should show a low-risk `live-mcp` or `repo-source` default becoming `plan-safe-assumption`. The negative example should show contradictory roadmap/context/source evidence becoming `ask-user` or `route-research`, not a hidden assumption.

#### Verification Ideas For Later Implementation

- Add contract-text assertions in `tests/phase-discovery-discuss.test.ts` for `Assumption Readiness Ledger`, `source tier`, `consequence if wrong`, `contradiction status`, `plan-safe-assumption`, `ask-user`, `route-research`, `route-ui`, `keep-open`, `Assumptions pre-write check`, and the skip-discuss inheritance rule.
- Add command-doc parity assertions that `docs/commands/discuss-phase.md` preserves the ask-versus-assume-versus-research threshold and does not describe skip-discuss as a validation bypass.
- Add a prompt-contract fixture that feeds contradictory roadmap/context/source evidence into an assumptions pass and verifies the expected output is `ask-user` or `route-research`, not `plan-safe-assumption`.
- Add a fixture for `workflow.skip_discuss=true` that verifies the saved context still includes evidence-backed decisions, canonical references with support notes, and open/routed high-impact unknowns instead of silent defaults.
- Add a fixture where an `Unclear` assumption attempts to enter `Implementation Decisions`; the expected future behavior is to block in the pre-write check first, then later consider schema or validator support if prompt-only enforcement is insufficient.
- Extend future model/schema validation only after the prose contract stabilizes; first pin the behavior in runtime-contract tests, then consider structured `assumptionRecords`, `sourceTier`, `confidence`, `consequenceIfWrong`, and `disposition` fields if downstream commands need machine-readable confidence.

### A4: Checkpointing, Resumption, And Progress Visibility

#### Current Behavior

- `/blu-discuss-phase` is already contractually checkpoint-aware: it reads `blueprint_phase_checkpoint_get` during the prior-context sweep, treats checkpoint-per-area resumability as a retained behavior, and the single-agent fallback says to write or refresh a structured checkpoint with `ownerCommand`, `completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta.mode: "discuss"` (`skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md:24`, `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md:51`, `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md:110`).
- The shared long-running profile defines the visible progress vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`, plus the in-flight fields `resolved scope`, `active stage`, `pending gate`, `execution mode`, and `next safe action`; it also keeps `update_topic` and `write_todos` session-local rather than durable state (`skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md:8`, `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md:26`, `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md:40`).
- The MCP checkpoint schema is real but shallow: `phase-checkpoint-records.ts` requires owner/mode, completed/remaining string arrays, simple decision/deferred/reference records, and `resumeMeta` fields such as `pendingTopics`, `completedTopics`, `currentQuestion`, `notes`, `resumeHint`, and `updatedAt`; `.catchall(z.unknown())` permits richer future fields without rejecting them, but does not require semantic richness today (`src/mcp/tools/phase-checkpoint-records.ts:5`, `src/mcp/tools/phase-checkpoint-records.ts:29`, `src/mcp/tools/phase-checkpoint-records.ts:39`, `src/mcp/tools/phase-checkpoint-records.ts:90`).
- The checkpoint file is a shared phase path, `.blueprint/phases/<phase>/<XX>-DISCUSS-CHECKPOINT.json`; `get` parses and reports `safeToResume`, `put` refuses foreign-owner overwrites, and `delete` refuses unguarded or foreign cleanup (`src/mcp/tools/phase-locations.ts:46`, `src/mcp/tools/phase.ts:9429`, `src/mcp/tools/phase.ts:9506`, `src/mcp/tools/phase.ts:9573`).
- Existing tests cover creation, resumed reads, per-area refresh, cleanup only after context/discussion/state finalization, checkpoint retention when state sync or validation fails, and unsafe foreign or legacy checkpoint reads (`tests/phase-discovery-discuss.test.ts:464`, `tests/phase-discovery-discuss.test.ts:697`, `tests/phase-discovery-discuss.test.ts:778`, `tests/phase-discovery-discuss.test.ts:908`, `tests/phase-discovery-discuss.test.ts:1000`).

#### Gaps And Risks

- Checkpoint schema richness is not yet strong enough for deterministic requirements discovery. `completedAreas`, `remainingAreas`, `pendingTopics`, and `completedTopics` are parallel string lists, not a single area queue with stable IDs, statuses, owners, evidence refs, last question, answer provenance, and downstream consumers.
- `safeToResume` currently means owner/mode compatibility, not semantic resume readiness. A checkpoint can be safe for `/blu-discuss-phase` while still lacking the current area cursor, queue order, question state, stale-read indicators, or the exact last persisted user answer needed to resume without relying on chat memory.
- Compact carry-forward is required in prose, but not represented as a durable checkpoint field. The contract says to compress phase boundary, prior decisions, codebase evidence, canonical refs, completed decisions, deferred ideas, and current unanswered question, but the MCP-required schema does not name a `carryForward`, `omittedDetails`, `contradictions`, or `doNotInferBeyond` packet.
- Progress/status visibility is legible only as prompt guidance. The shared profile names the fields to show, but the checkpoint does not require `activeStage`, `pendingGate`, `areaProgress`, or `nextActionPreview`, so later agents may recap progress inconsistently or lose it after compaction.
- The shared filename suffix `-DISCUSS-CHECKPOINT.json` is now used for both discuss and research owners. Owner/mode guards reduce data loss risk, but the path name can still mislead future prompt authors into treating file location as proof of discuss ownership.
- Checkpoint deletion after successful finalization is correct for cleanup, but it can erase the best structured progress ledger unless the durable `XX-CONTEXT.md` or optional `XX-DISCUSSION-LOG.md` has already copied the final area/carry-forward summary.
- The current prompt says to checkpoint each major area, while the research synthesis argues for persisting after every user answer and every area boundary. Without a sharper rule, an interrupted mid-area session may resume from the previous area and re-ask or drop the latest answer.
- Session-local helpers are correctly optional, but the fallback progress format is underspecified. If `update_topic` and `write_todos` are unavailable, agents need a deterministic one-line status recap pattern rather than improvising narrative progress text.

#### Specific Improvements

- Add a checkpoint `schemaVersion` and area-state machine to the runtime contract. The current Zod shape can tolerate extra fields via catchall, so the future docs can introduce this first and tighten runtime validation later:

```json
{
  "ownerCommand": "/blu-discuss-phase",
  "schemaVersion": 2,
  "phaseKey": "03-phase-discovery",
  "progress": {
    "activeStage": "Execute",
    "pendingGate": "gray-area-question",
    "executionMode": "discuss/resumed",
    "areasDecided": 1,
    "areasTotal": 4,
    "nextActionPreview": "Ask the current UI expectations follow-up"
  },
  "areaQueue": [
    {
      "areaId": "scope-boundary",
      "title": "Scope boundaries",
      "state": "decided",
      "decisionIds": ["D-scope-001"],
      "evidenceRefs": [".blueprint/ROADMAP.md"],
      "downstreamConsumers": ["/blu-research-phase", "/blu-plan-phase"]
    },
    {
      "areaId": "ui-expectations",
      "title": "UI expectations",
      "state": "questioning",
      "currentQuestion": "Does this phase author a real UI surface or only a no-UI rationale?",
      "questionWhyItMatters": "Controls whether /blu-ui-phase should produce UI work or an explicit skip rationale.",
      "lastUserAnswer": null
    }
  ]
}
```

- Add this future text to `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` under the single-agent fallback: `Persist after every user answer and after every gray-area boundary. A checkpoint is resume-ready only when the active area has a stable areaId, state, currentQuestion or blocking reason, evidence refs, and the last accepted user answer or assumption. Do not infer these from the chat transcript.`
- Define state invariants for the gray-area machine so the checkpoint is more than a loose progress blob:

```text
area.state allowed values:
- unseen: discovered but not started; must have title, risk, downstreamConsumers.
- questioning: active user question; must have currentQuestion, questionWhyItMatters, evidenceRefs.
- assumed: resolved by explicit assumption; must have assumption, confidence, consequenceIfWrong.
- decided: resolved by user answer or strong evidence; must have decisionIds and sourceRefs.
- blocked: cannot advance now; must have blocker, resumeHint, nextSafeAction.
- needs-revisit: prior answer or readSet is stale, contradicted, or corrected; must name why.
- handed-off: intentionally left for research/ui/plan; must name target command and packet field.
```

- Add deterministic resume rules before the questioning loop: `On resume, read with expectedOwnerCommand "/blu-discuss-phase" and expectedMode "discuss". If safeToResume is false, ask resume-versus-discard using the warnings. If safeToResume is true, pick the first area with state "questioning", then "blocked", then "needs-revisit", then the first "unseen" area; never reconstruct the queue from completedAreas prose alone.`
- Replace parallel string-list language in the skill with a compatibility rule: `Keep completedAreas, remainingAreas, and resumeMeta.pendingTopics/completedTopics for current runtime compatibility, but derive them from areaQueue when areaQueue exists. The areaQueue is the semantic source of truth; the lists are public compatibility summaries.`
- Add a carry-forward packet requirement to the runtime contract:

```text
Before asking the next question or handing off to a sidecar, build carryForward:
phaseBoundary, activeArea, completedDecisions, openQuestions, deferredIdeas,
canonicalReferences, evidenceRefs, contradictions, omittedDetails, and
doNotInferBeyond. Store the compact carryForward packet in the checkpoint and
copy the final version into XX-DISCUSSION-LOG.md when the session had more than
one area, contradictions, assumptions, or deferred ideas.
```

- Add a fixed fallback status line to the long-running profile for hosts without helper tools:

```text
Progress: phase=<resolved phase> stage=<Resolve|Read|Decide|Execute|Persist|Validate|Route>
gate=<pending gate or none> mode=<discuss|assumptions|skip-discuss>/<fresh|resumed>
areas=<decided>/<total> active=<areaId or none> next=<next safe action or next question>
```

- Clarify that progress visibility is not persistence: `Use update_topic/write_todos only to mirror the checkpoint's current progress fields. The MCP checkpoint remains authoritative; if helper state and checkpoint state disagree, report the checkpoint state and refresh the helper display.`
- Make semantic compaction event-based rather than token-pressure-based: refresh `carryForward` after each accepted answer, assumption, correction, sidecar memo, validation blocker, and state-sync or route-refresh failure. The compact packet should keep source anchors, contradictions, omitted details, and "do not infer beyond this" boundaries, while leaving raw conversational turns in the optional discussion log only when they explain a decision.
- Add stale-input markers so deterministic resume can detect changed context: `readSet` should list the roadmap/context/config/plan-index artifacts used to form the queue, with path plus lightweight fingerprint or `updatedAt` where available. On resume, warn when the read set changed and route the affected area to `needs-revisit` instead of silently continuing.
- Preserve final checkpoint value before deletion: when `blueprint_phase_checkpoint_delete` succeeds after finalization, the final response and optional discussion log should say which areas were decided, which were assumed, which remain open, and where those facts landed in `XX-CONTEXT.md` or `XX-DISCUSSION-LOG.md`.

#### Verification Ideas For Later Implementation

- Extend `tests/phase-discovery-discuss.test.ts` with a v2 checkpoint fixture that includes `areaQueue`, `progress`, `carryForward`, and `readSet`; assert `blueprintPhaseCheckpointPut` preserves those fields and `blueprintPhaseCheckpointGet` returns them intact.
- Add schema-hardening tests, once runtime validation is tightened, for invalid area states, duplicate `areaId` values, missing `currentQuestion` on `questioning`, and owner/mode mismatches that still must be rejected.
- Add a prompt/static-contract test that the discuss runtime contract contains the deterministic resume ordering, the after-every-answer persistence rule, and the fallback `Progress:` status format.
- Simulate an interrupted mid-area flow: write a checkpoint with `state: "questioning"` and a `lastUserAnswer`, compact the test harness context, resume, and assert the next prompt does not re-ask completed facts or skip the pending question.
- Add a finalization fixture where state update or artifact validation fails after a v2 checkpoint exists; assert the richer checkpoint remains, `resumeHint` points at the blocker, and no guarded delete occurs.
- Add an end-of-run fixture where checkpoint deletion succeeds only after the final progress summary has been copied into the discussion log or final context model, preserving a durable audit trail without leaving stale checkpoint state.

### A5: Context Model Authoring, Validation, And Discussion Log

#### Current Behavior

- `phase.context` is schema-backed and model-only: `src/mcp/artifact-contracts/index.ts` attaches `PHASE_CONTEXT_MODEL_CONTRACT` to the contract, while `src/mcp/tools/phase.ts` rejects Markdown `content` fallback for `artifact: "context"` and renders the structured model before persistence.
- The current model schema requires nine content areas: `phaseBoundary`, `discoveryGrounding`, `implementationDecisions`, `specificIdeas`, `existingCodeInsights`, `dependencies`, `openQuestions`, `deferredIdeas`, and `canonicalReferences`; every array has `minItems: 1`, strings are single-line, and extra keys are rejected in `src/mcp/artifact-contracts/schemas/phase.context.model.schema.json`.
- The renderer in `src/mcp/tools/phase-context-model.ts` owns final Markdown shape, including the exact `- none` rendering when the model supplies `openQuestions: ["none"]`; `tests/context-contract-parity.test.ts` checks schema identity, required field parity, rendered-heading parity, and exact Open Questions sentinel metadata.
- Rendered context then passes Markdown/semantic validation in `src/mcp/tools/artifacts.ts`: required headings must be present and substantive, scaffold placeholders are rejected, `Open Questions` accepts only exact `- none` as the empty state, canonical references must include at least one concrete source/path/URL, deferred ideas cannot be dropped, and unsupported discuss-mode claims are blocked.
- `phase.discussion-log` remains a freehand Markdown artifact with `Summary`, `Notes`, and `Follow-Ups` headings in `src/mcp/artifact-contracts/index.ts`; the runtime contract says to write it only when it adds durable value, and `tests/phase-discovery-discuss.test.ts` covers optional log writes plus validation that blocks unsupported mode claims and dropped follow-ups.

#### Gaps/Risks

- Semantic quality is still prompt-mediated: the schema proves shape, but it cannot prove that `specificIdeas`, `existingCodeInsights`, `implementationDecisions`, or `canonicalReferences` are sufficiently grounded, non-generic, or downstream-useful.
- Provenance is centralized in `canonicalReferences`, not claim-linked. A planner can see sources, but cannot reliably tell which decision, code insight, assumption, or open question each source supports.
- The model has no first-class way to distinguish user-stated facts, repo-observed facts, repo-inferred decisions, external references, assumptions, contradictions, or unknowns; agents may bury that distinction inside prose inconsistently.
- Current examples are mostly parity/minimal-valid examples for contract mechanics, not a realistic `/blu-discuss-phase` artifact. The runtime contract tells agents to prefer rich values, but does not show a compact filled model with evidence-tagged decisions and a good `none` empty-state.
- Discussion-log triggers are discretionary. "When it adds durable value" is useful but soft, so agents may over-log simple sessions or under-log assumptions-mode corrections, rejected options, contradictions, or user corrections that explain why the final context looks the way it does.
- Validation self-checks are described in prose and enforced only partly by write validation. There is no context-model dry-run tool analogous to validation render paths, and no explicit readiness ledger that maps required model fields to evidence, confidence, and unresolved risk before the write.
- Discussion logs are not schema-backed and missing required sections are warnings for non-context artifacts, so a minimally populated log can pass even if it is less useful as a durable reconstruction of multi-turn reasoning.

#### Specific Improvements

- Add a "context model readiness ledger" step to the skill/runtime contract before `blueprint_phase_artifact_write`. The ledger should be internal or briefly summarized, but it should force each required model area to be supported by user input, repo evidence, or a labeled assumption:

```text
Before writing phase.context, build a readiness ledger:
field | source basis | confidence | unresolved risk | downstream consumer
Every required field must be either evidence-backed, user-confirmed, or explicitly assumption-backed.
Do not write the model while any field is scaffold-derived, source-free, or contradicted without an Open Questions or Deferred Ideas entry.
```

- Add a field-by-field drafting rubric that maps the current schema to semantic quality, without adding schema fields in the first implementation:

```md
Context model drafting rubric:
- `phaseBoundary`: goal, in/out scope, and success criteria come from ROADMAP, REQUIREMENTS, user answers, or an explicit assumption; no generic "build the feature" wording.
- `discoveryGrounding`: project brief, requirement IDs, workflow posture, and confirmed decisions are inherited from `blueprint_phase_context`, state/config, prior artifacts, and user corrections.
- `implementationDecisions`: every row is an accepted decision with its tradeoff, constraint, rationale, or consequence; candidate options belong in the discussion log or open questions.
- `specificIdeas`: concrete examples, desired behavior, rejected options worth remembering, or user-provided examples; no transcript recap.
- `existingCodeInsights`: repo-observed modules, saved codebase summaries confirmed against live code when planner-critical, or explicit unknowns.
- `dependencies`: prior artifacts, external constraints, required follow-up reads, and gate dependencies such as research/UI/plan inventory.
- `openQuestions`: only unresolved blockers or useful handoff questions; exactly `none` when empty so the renderer emits `- none`.
- `deferredIdeas`: later-phase, scope-creep, or follow-up items with the reason they are not in scope now.
- `canonicalReferences`: source anchors with relevance; avoid source lists disconnected from the claims they support.
```

- Strengthen `Artifact Authoring` text with claim-level provenance guidance that works inside the current schema by prefixing or suffixing values with compact source anchors when useful:

```text
For every durable decision or code insight, include the evidence anchor in the model value itself when the schema has no separate evidence field, for example:
"Keep execution resumability checkpoint-owned because tests/phase-discovery-discuss.test.ts covers checkpoint survival after invalid context writes."
Avoid source lists that are disconnected from the claims they support.
```

- Add a compact current-schema model example to the runtime contract, not as a copyable fixture but as a quality target. Example excerpt:

```json
{
  "implementationDecisions": [
    {
      "decision": "Preserve context finalization as a strict MCP write followed by synced state reload.",
      "tradeoffOrConstraint": "Prevents the command from inferring /blu-plan-phase when research or UI gates still apply; supported by skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md."
    }
  ],
  "existingCodeInsights": [
    "src/mcp/tools/phase.ts renders phase.context from the structured model and rejects Markdown fallback."
  ],
  "openQuestions": ["none"],
  "canonicalReferences": [
    {
      "source": "src/mcp/tools/phase.ts",
      "relevance": "Owns strict phase artifact writes and model-only context rendering."
    }
  ]
}
```

- Add an anti-example that makes generic context visibly invalid from a skill-quality perspective even if it could satisfy the JSON shape:

```text
Weak: "Implementation is straightforward and tests should be added."
Better: "Planning must preserve checkpoint deletion after context write, optional discussion-log write, synced STATE update, and state reload; the runtime contract names this order and tests assert it."
```

- Make discussion-log trigger criteria explicit. Future runtime-contract text:

```text
Write XX-DISCUSSION-LOG.md when any trigger is true:
- more than one gray area was discussed or resumed
- assumptions mode presented defaults that were accepted, corrected, or rejected
- the user changed direction, rejected an option, or supplied rationale not fully represented in phase.context
- a contradiction, plan-inventory warning, compliance/audit concern, or deferred follow-up needs reconstruction later
Skip the log only when one straightforward area was resolved and the final phase.context preserves all decisions, sources, and follow-ups.
```

- Add discussion-log content expectations that complement, not duplicate, `XX-CONTEXT.md`: `Summary` should state the decision arc, `Notes` should preserve user corrections/options rejected/evidence snippets, and `Follow-Ups` should list only concrete later actions or exact rationale that no follow-up remains if future validation supports a sentinel.
- Add a final semantic self-check block to `Validation And Repair`:

```text
Before claiming success, answer yes/no:
1. Does every Implementation Decisions row name a decision and the constraint/tradeoff that makes it durable?
2. Does every Existing Code Insights item cite a file/module, saved artifact, command output, or explicit unknown?
3. Are all deferred or later ideas preserved in Deferred Ideas and, when useful, in the discussion log?
4. Are all open questions either concrete blockers or exactly the model value "none"?
5. Could /blu-research-phase, /blu-ui-phase, or /blu-plan-phase consume this without re-asking basics?
```

- Future schema work, not part of this documentation-only slice: consider optional claim/provenance fields such as `evidenceClaims: [{ id, statement, sourceRefs, evidenceGrade, confidence, status }]`, richer decision rows with `areaId`, `requirementIds`, `sourceRefs`, and `assumptionStatus`, and structured open questions with `question`, `blocks`, `owner`, and `fallbackAssumption`. Keep these clearly versioned because the current schema has `additionalProperties: false`.
- Future schema work for `phase.discussion-log`: consider a model-backed log with `sessionSummary`, `turnNotes`, `optionsConsidered`, `userCorrections`, `assumptionsPresented`, `deferredFollowUps`, and `sourceRefs`, but only after prompt-level trigger rules prove the optional log is consistently useful.

#### Verification Ideas

- Extend `tests/phase-discovery-discuss.test.ts` text-contract assertions so the runtime contract must mention the readiness ledger, concrete discussion-log triggers, claim-linked evidence guidance, and semantic self-check.
- Add fixture tests for high-quality and low-quality current-schema context models: one should render/write with evidence-bearing values and exact `openQuestions: ["none"]`; another should be rejected or at least diagnosed when future validators can detect disconnected canonical references, generic filler, or dropped deferred ideas.
- If future schema fields are added, extend `tests/context-contract-parity.test.ts` to assert schema/version changes, rendered-heading compatibility, `additionalProperties` behavior, minimal examples, and example-leakage signals.
- Add a discussion-log fixture that includes assumptions-mode corrections and rejected options, then assert validation preserves concrete `Follow-Ups` and blocks unsupported mode claims without requiring the log for simple one-area sessions.

### A6: End-Of-Run Routing And Downstream Handoff

**Current behavior**

- The command manifest delegates detailed end-of-run behavior to the runtime contract and requires the final response to include the phase, artifact reuse/replacement, checkpoint behavior, plan-inventory warning, deferred ideas, progress recap, and the next safe action copied from refreshed `blueprint_state_load.derivedStatus.nextAction`; it explicitly forbids inferring a direct `/blu-plan-phase` handoff after successful context capture (`commands/blu-discuss-phase.toml:10`, `commands/blu-discuss-phase.toml:19-20`).
- The skill and command spec both require `blueprint_phase_plan_index` before context refresh, warn that existing plans are not automatically rewritten, and route from refreshed state instead of prompt-local judgment (`skills/blueprint-phase-discovery/SKILL.md:185`, `skills/blueprint-phase-discovery/SKILL.md:198`, `docs/commands/discuss-phase.md:47-53`, `docs/commands/discuss-phase.md:149-150`).
- The runtime contract's finalization sequence is: write the structured `phase.context` model, optionally write the discussion log, call `blueprint_state_update` with `base: "synced"` while preserving `patch.currentPhase` and `patch.activeCommand`, call `blueprint_state_load`, report the refreshed next safe action, and delete the discuss checkpoint only after all of those steps succeed (`skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md:220-237`).
- State routing is already implemented-only by indirection: `src/mcp/tools/state.ts` loads implemented command names from `blueprintCommandCatalog()`, and `deriveNextAction` only emits discuss, research, UI, plan, execution, validation, review, and milestone routes when the corresponding command is implemented (`src/mcp/tools/state.ts:1065-1078`, `src/mcp/tools/state.ts:2047-2128`). The catalog marks a command implemented only when manifest, skill, runtime inputs, and required MCP tools are satisfied (`src/mcp/tools/project.ts:893-987`).
- Regression coverage pins the current route safety contract: docs/skill/manifest must mention `derivedStatus.nextAction` and avoid direct plan handoff, successful discuss context capture routes to `/blu-research-phase` when research is enabled, an explicitly selected earlier phase survives synced refresh and routes to `/blu-ui-phase` instead of a later `/blu-plan-phase`, and checkpoints survive final state-sync failure (`tests/phase-discovery-discuss.test.ts:199-315`, `tests/phase-discovery-discuss.test.ts:584-649`, `tests/phase-discovery-discuss.test.ts:652-776`).

**Gaps and risks**

- The end state is routing-aware but not yet handoff-packet-aware. Current guidance says to write rich context that downstream commands can consume, but it does not require a compact typed packet with separate `researchBrief`, `uiBrief`, `planBrief`, and `routingGates`; later commands may still mine a broad narrative artifact and miss why a gate was active.
- The plan-inventory warning is required but underspecified. `blueprint_phase_plan_index` returns saved plan records, waves, missing dependency plans, gap-closure plans, warnings, and the missing first-plan path when no plans exist (`src/mcp/tools/phase.ts:7560-7647`), yet the contract does not say exactly which of those fields must be preserved in the final context and final response when refreshed discovery makes existing plans stale until `/blu-plan-phase` is rerun.
- Implemented-only routing currently depends on copying refreshed `derivedStatus.nextAction` exactly. Because `/blu-discuss-phase` deliberately does not include `blueprint_command_catalog` in its command-scoped allowlist (`tests/phase-discovery-discuss.test.ts:294-304`), any extra "you could also run..." prose risks bypassing the catalog unless the contract bans alternate route suggestions or explicitly falls back to `/blu-progress`.
- The refreshed-state rule is present, but the handoff text can still become stale if an agent treats the `blueprint_state_update` response as the routing decision, omits `patch.currentPhase` on a selected earlier phase, or deletes the checkpoint before a successful follow-up `blueprint_state_load`.
- Research and UI gates are preserved in state routing, but the final context does not have a required explanation of what the next command needs. For example, when research is enabled and absent, state correctly routes to `/blu-research-phase`; when UI is enabled and no UI spec exists, it routes to `/blu-ui-phase` (`src/mcp/tools/state.ts:2075-2114`). The handoff should say which unknowns, source policies, users, journeys, or no-UI rationale candidates the downstream command must resolve.
- UI work has a later quality-gate distinction that should not be blurred during discuss handoff: a real `UI-SPEC` can later route to `/blu-ui-review`, while an explicit skip rationale must not (`tests/quality-gate-routing.test.ts:996-1080`). Discuss-phase should hand off "UI applicability to decide" rather than claiming a skip rationale is complete.
- Existing tests mostly assert regex-level contract wording and state routes; they do not yet assert a concrete downstream packet shape, required packet fields, plan-inventory preservation, or final-response no-alternate-routes behavior.

**Specific improvements**

- Add a new `## Downstream Handoff Packet` subsection to `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` after `Artifact Authoring` and before `Validation And Repair`. Future text:

```md
## Downstream Handoff Packet

Before final validation and routing, derive a compact handoff packet from the
saved context model, checkpoint decisions, plan index, effective config, and
artifact inventory. Persist its substance inside the existing `phase.context`
model sections; do not create a new artifact or pass the raw conversation
transcript downstream.

Required packet fields:
- `researchBrief`: known unknowns, evidence needed, source policy from effective
  config, decision each research item unblocks, stop condition, evidence refs,
  and unresolved questions that must route to `/blu-research-phase`.
- `uiBrief`: UI applicability, users, critical journeys, interaction surfaces,
  accessibility/privacy/safety constraints, and any no-UI skip-rationale
  candidate. A candidate is not a completed `XX-UI-SPEC.md` skip rationale.
- `planBrief`: initial state, desired end state, dependencies, forbidden moves,
  validation oracle, non-goals, repo constraints, accepted assumptions, rejected
  options, and open planning risks.
- `planInventory`: existing plan IDs and paths, dependency gaps, warnings, and
  whether refreshed discovery leaves saved plans stale until `/blu-plan-phase`
  is rerun.
- `routingGates`: selected phase, workflow research/UI booleans, context path,
  research path/status, UI-spec path/status, refreshed next safe action, and
  fallback action when routing is unavailable.
```

- Tighten the current finalization step in the same runtime contract with an explicit route source block. Future replacement or addition near the existing state-update/state-load steps:

```md
Route only from the post-write `blueprint_state_load` result:
- call `blueprint_state_update({ base: "synced", patch: { currentPhase,
  activeCommand: "/blu-discuss-phase" } })`
- call `blueprint_state_load`
- copy `derivedStatus.nextAction` exactly as the next safe action
- if the loaded action is missing, blocked, or not a Blueprint command, say
  `Run /blu-progress to review the next safe Blueprint action`
- do not list alternate runnable commands unless a future contract explicitly
  adds `blueprint_command_catalog` to this command's allowlist and tests
```

- Add a skill step immediately before the current step 16 in `skills/blueprint-phase-discovery/SKILL.md`. Future text:

```md
16. Before final state sync, derive the downstream handoff packet and fold it
into the saved context model: `researchBrief`, `uiBrief`, `planBrief`,
`planInventory`, and `routingGates`. Keep it filtered and artifact-oriented;
do not carry the full discussion transcript forward.
17. End with the next safe action loaded from
`blueprint_state_load.derivedStatus.nextAction` after a synced
`blueprint_state_update` that preserves the already resolved selected phase in
`patch.currentPhase` together with `patch.activeCommand`.
```

- Make the final response shape deterministic without becoming verbose. Future contract snippet:

```md
Final response shape:
- Saved: context path, optional discussion-log path, reused/replaced status.
- Checkpoint: deleted, retained with reason, or no checkpoint.
- Handoff: one-line summary of `researchBrief`, `uiBrief`, `planBrief`, and
  `planInventory`, including the stale-plan warning when plans already exist.
- Next safe action: exact refreshed `derivedStatus.nextAction` or `/blu-progress`
  fallback. Do not include secondary runnable routes.
```

- Require `planInventory` to be explicit whenever `blueprint_phase_plan_index.plans.length > 0`, even if state routes to research or UI first. The packet should include plan IDs/paths, dependency gaps from `missingPlans`, warnings, and a fixed warning such as: `Existing saved plans were not rewritten by this refreshed discussion; rerun /blu-plan-phase <phase> before trusting plan content that depends on the new context.`
- Give every handoff packet a typed readiness value so downstream commands can filter without parsing narrative: `researchBrief.status = "needed" | "not-needed" | "blocked-by-discuss"`, `uiBrief.applicability = "needs-ui-contract" | "skip-rationale-candidate" | "unknown"`, `planBrief.readiness = "ready-after-gates" | "needs-replan" | "blocked"`, `planInventory.staleness = "none" | "existing-plans-current" | "existing-plans-stale"`, and `routingGates.nextActionSource = "blueprint_state_load.derivedStatus.nextAction" | "progress-fallback"`.
- Give research handoff a concrete stop condition. Example: `researchBrief.stopCondition = "enough evidence to choose between the listed options or confirm that repo evidence is insufficient and an assumption must remain open"`. This keeps `/blu-discuss-phase` from drafting `XX-RESEARCH.md` while still handing `/blu-research-phase` a useful queue.
- Give UI handoff a mode-safe shape: `uiBrief.applicability = "needs-ui-contract" | "skip-rationale-candidate" | "unknown"`, plus supporting users/journeys/surfaces/constraints. If `workflow.ui_phase` is enabled and no saved UI spec exists, the handoff should still route through `/blu-ui-phase`; discuss-phase may document a skip candidate but must not treat it as the completed skip rationale.
- Keep `planBrief` planning-oriented rather than transcript-oriented: include acceptance/verification hooks, dependencies, non-goals, constraints, rejected options, and assumptions safe for planning. Any unresolved high-impact ambiguity should stay in `openQuestions` or `researchBrief`, not silently become a plan premise.
- Preserve state warnings in the final response when they affect routing, especially requested-phase preservation warnings, invalid research warnings, missing plan dependency warnings, and quality-gate debt warnings. This makes the refreshed route auditable without asking downstream agents to re-run all reads.
- Keep the command-scoped MCP allowlist unchanged for the first implementation. If a future improvement wants `/blu-discuss-phase` to call `blueprint_command_catalog` directly, update the manifest, skill required-tool list, runtime contract, and tests together; otherwise, the only implemented-only route authority is the loaded state.

**Verification ideas for later implementation**

- Extend `tests/phase-discovery-discuss.test.ts` to assert the runtime contract and skill contain `Downstream Handoff Packet`, `researchBrief`, `uiBrief`, `planBrief`, `planInventory`, `routingGates`, and the "no secondary runnable routes" rule.
- Add a fixture with existing `*-PLAN.md` artifacts, refreshed context, and research/UI gates still enabled; assert state still routes to research/UI, the plan-inventory warning is required in the proposed handoff text, and no direct `/blu-plan-phase` recommendation appears.
- Add an earlier-selected-phase fixture with saved plans on a later roadmap phase; assert final synced update with `patch.currentPhase` keeps the selected phase and the handoff packet's `routingGates.selectedPhase` matches loaded `derivedStatus.currentPhase`.
- Add a UI applicability fixture that records a `skip-rationale-candidate` in discuss context, then later verifies `/blu-ui-phase` is still the next route until a real `XX-UI-SPEC.md` contract or explicit skip rationale exists.
- Add a route-copy fixture that stubs or constructs a missing/blocked `derivedStatus.nextAction` path and asserts the future final-response contract falls back to `/blu-progress` without inventing alternatives.
- Keep the existing checkpoint-retention tests and add one state-load failure variant: context write succeeds, state update succeeds, state load fails, checkpoint remains and the final handoff is not claimed complete.
- If direct catalog verification is later added, add a paired allowlist test that fails until `blueprint_command_catalog` appears in the manifest, skill command-scoped tools, runtime reference, and required-tool registration checks.

## Detailed Improvement Plan

### Plan Goals And Non-Goals

Goals:

- Upgrade `/blu-discuss-phase` from a dense but loosely executable discovery prompt into a deterministic requirements-discovery workflow that future agents can follow with minimal interpretation.
- Preserve the current architecture boundary: command manifests stay thin, the shared skill owns orchestration, the discuss runtime contract owns command-specific read/question/write/routing behavior, and MCP tools remain the deterministic state and artifact substrate.
- Make phase resolution, prior-context reads, gray-area discovery, question selection, assumptions mode, checkpointing, context authoring, downstream handoff, and final routing explicit enough to test by static contract assertions first.
- Keep near-term changes prompt/documentation-oriented unless a later implementation stage intentionally chooses schema/runtime work. The first future implementation should be able to improve behavior without changing `src/mcp/*` schemas.
- Ensure the final `phase.context` artifact remains model-backed and useful as a requirements baseline for `/blu-research-phase`, `/blu-ui-phase`, and `/blu-plan-phase`, rather than a transcript summary.
- Preserve implemented-only routing guarantees: `/blu-discuss-phase` must continue to report only the refreshed `blueprint_state_load.derivedStatus.nextAction` or a `/blu-progress` fallback.

Non-goals:

- Do not use this plan to change runtime code, schemas, commands, skills, or tests in the current documentation-only slice.
- Do not introduce a new durable artifact for handoff packets in the first implementation. Fold handoff substance into existing `phase.context`, optional `phase.discussion-log`, and checkpoints.
- Do not make `/blu-discuss-phase` call `blueprint_command_catalog` unless a later implementation updates the command manifest, skill required-tool list, runtime contract, and allowlist tests together.
- Do not replace the current `phase.context` schema immediately. Schema/model expansion is optional later work and must be versioned because the current JSON schema rejects additional properties.
- Do not weaken checkpoint owner/mode guards or the model-only context write requirement.
- Do not let external requirements-engineering research override repo/runtime truth. External sources inform method; Blueprint source, MCP output, saved artifacts, and current user answers remain the evidence authority for current behavior.

### Target Files And Intended Changes

- `commands/blu-discuss-phase.toml`
  - Add only a short local guard that points to the selected-phase read packet and warns not to mix selected phase with ambient state phase.
  - Keep the manifest thin. Do not duplicate the full gray-area or handoff workflow here.
  - Keep command-scoped required MCP tools unchanged unless the implementation intentionally expands the allowlist and updates tests.

- `skills/blueprint-phase-discovery/SKILL.md`
  - Add a shared `/blu-discuss-phase` orchestration step for the selected-phase register, read packet, gray-area queue, assumptions safety threshold, context readiness ledger, downstream handoff packet, and route-only-from-refreshed-state rule.
  - Keep the wording reusable with existing discovery commands, but mark discuss-specific behavior where it relies on the discuss runtime contract.
  - Add a short skill-level self-check that maps every high-value gray area to a final `phase.context` field, optional discussion-log entry, or downstream handoff.

- `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md`
  - This is the main implementation target.
  - Add or revise sections for `Selected Phase Read Packet`, `Artifact Status Classification`, `Gray Area Queue`, `Questioning Rules`, `Assumptions Mode`, `Checkpointing And Resume`, `Context Model Readiness`, `Downstream Handoff Packet`, `Validation And Repair`, and `Final Response And Routing`.
  - Include concrete examples and anti-examples because this file is the primary behavior contract agents will read at runtime.

- `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`
  - Add the fixed fallback progress line and clarify that helper state mirrors the MCP checkpoint rather than owning persistence.
  - Keep this generic enough for other long-running discovery commands.

- `docs/commands/discuss-phase.md`
  - Mirror user-facing behavior changes: higher-value questions, assumptions safety, stale plan warning, optional discussion-log triggers, and refreshed-state routing.
  - Avoid over-specifying implementation internals that belong in the runtime contract.

- `tests/phase-discovery-discuss.test.ts`
  - Add static contract assertions for every new prompt/runtime contract block.
  - Add fixture-oriented tests for checkpoint preservation, selected earlier phase routing, plan-inventory warning, assumptions confidence thresholds, and final-response routing text.
  - Keep existing allowlist checks. If `blueprint_command_catalog` is still not a scoped tool, add an assertion that the runtime contract forbids secondary runnable routes.

- `tests/context-contract-parity.test.ts`
  - No required near-term change if the schema remains unchanged.
  - If optional later schema/model fields are added, assert schema/version/rendering parity, minimal examples, `additionalProperties` behavior, exact `openQuestions: ["none"]` rendering, and rendered heading compatibility.

- Optional later runtime/schema targets, only after the prompt contract stabilizes:
  - `src/mcp/tools/phase-checkpoint-records.ts` for typed `areaQueue`, `progress`, `carryForward`, and `readSet` validation.
  - `src/mcp/artifact-contracts/schemas/phase.context.model.schema.json` for claim/provenance fields, richer decisions, structured open questions, or downstream handoff fields.
  - `src/mcp/tools/phase-context-model.ts` for rendering any new model fields.
  - `src/mcp/artifact-contracts/index.ts` for schema contract registration and examples.
  - `docs/MCP-TOOLS.md` only if MCP tool behavior or schema expectations change.
  - `dist/` outputs if runtime-affecting TypeScript or bundled runtime assets change.

### Implementation Order

1. **Create an isolated implementation worktree and install dependencies.**

   The future implementation agent should follow repo rules: create or use a dedicated worktree for even one-line changes, run `npm ci` in that worktree before any `npm run build`, `npm run typecheck`, or `npm test`, and avoid touching unrelated user edits. Before editing, capture `git status --short` and inspect the current contents of the target files listed above.

2. **Add static regression tests before broad prompt edits.**

   Update `tests/phase-discovery-discuss.test.ts` with focused assertions that initially fail against the current prompt/contract text. Start with text-level coverage because the first implementation should be prompt-contract-only. Assertions should check that the discuss runtime contract contains these exact or near-exact anchors:

   - `Selected Phase Read Packet`
   - `selectedPhase`
   - `stateCurrentPhase`
   - `grayAreaQueue`
   - `decisionValue`
   - `resolutionCriterion`
   - `Ask instead of assuming`
   - `Confidence labels`
   - `Contradictions checked`
   - `Persist after every user answer`
   - `Context model readiness ledger`
   - `Downstream Handoff Packet`
   - `researchBrief`
   - `uiBrief`
   - `planBrief`
   - `planInventory`
   - `routingGates`
   - `Route only from the post-write blueprint_state_load result`
   - `Do not include secondary runnable routes`

   Also add assertions that the command manifest and skill still mention `blueprint_state_load.derivedStatus.nextAction`, `patch.currentPhase`, and `patch.activeCommand`, and that `commands/blu-discuss-phase.toml` does not add `blueprint_command_catalog` unless the allowlist is intentionally expanded.

3. **Reorganize the discuss runtime contract into executable blocks.**

   Edit `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` first. Keep existing correct content, but restructure the flow so a tool-using agent can execute it in order:

   1. Objective and authority boundary.
   2. Required MCP read sequence.
   3. Selected phase read packet.
   4. Artifact status classification.
   5. Checkpoint/resume decision.
   6. Gray-area queue and question policy.
   7. Assumptions mode and skip-discuss safety.
   8. Per-answer checkpointing and progress.
   9. Context model readiness and artifact writing.
   10. Downstream handoff packet.
   11. Validation, repair, state sync, state reload, checkpoint deletion, and final response.

   This stage should not change the MCP tool list unless needed. The goal is to turn existing guidance into stable labeled blocks with concrete thresholds and examples.

4. **Add selected-phase read packet and artifact-status rules.**

   The runtime contract should make `blueprint_phase_locate` authoritative for phase-scoped reads and writes. Add this block near the first read sequence:

   ```md
   ## Selected Phase Read Packet

   After `blueprint_phase_locate` succeeds, create a run-local selected-phase register:
   - `selectedPhase`: `String(result.phaseNumber)`
   - `selectedPhasePrefix`: `result.phasePrefix`
   - `selectedPhaseDir`: `result.phaseDir`
   - `selectedPhaseResolvedFrom`: `result.resolvedFrom`

   Use `selectedPhase` for every phase-scoped read, checkpoint read/write/delete,
   scaffold path, artifact write, and final `patch.currentPhase`. Treat any
   state-derived current phase returned by later reads as `stateCurrentPhase`,
   an ambient routing signal, not a replacement for `selectedPhase`.

   If `blueprint_phase_locate.found` is false, stop before artifact reads or
   writes and report `reason` plus `recovery`.

   Minimum read order:
   1. Call `blueprint_phase_locate`.
   2. In parallel, call `blueprint_phase_context`, `blueprint_roadmap_read`,
      `blueprint_artifact_list`, and `blueprint_config_get`.
   3. Using `selectedPhase`, read current `context`, current `discussion-log`,
      the discuss checkpoint with owner/mode guards, plan inventory, and the
      `phase.context` artifact contract.
   4. Read the `phase.discussion-log` contract only when a durable discussion
      log is likely.
   5. Read earlier phase context only when the relevance rule below matches.
   ```

   Add bounded prior-context and artifact-status wording:

   ```md
   Earlier phase context is materially relevant when it shares roadmap
   requirement ids, canonical references, deferred ideas, codebase surfaces,
   MCP tool families, command lifecycle gates, or explicit dependency language
   with the selected phase. Prefer the nearest prior matching phase plus any
   phase explicitly referenced by ROADMAP or saved context. If no rule matches,
   say no earlier context was reused instead of doing a broad sweep.

   Classify current artifacts before questioning:
   - `missing`
   - `scaffold-starter`
   - `authored-substantive`
   - `validation-suspect`
   - `unreadable`
   - `safe-checkpoint`
   - `foreign-checkpoint`
   - `stale-plan-inventory`

   The classification controls the next gate: resume/discard, overwrite
   confirmation, repair, or fresh discovery.
   ```

   Add this concise manifest-level guard to `commands/blu-discuss-phase.toml`:

   ```toml
   # Before any user question or sidecar decision, resolve the phase and build
   # the selected-phase read packet from the discuss runtime contract. Keep the
   # selected phase distinct from ambient state phase when they differ.
   ```

   If the file's TOML structure makes a comment inappropriate inside a prompt string, encode the same text as a short prompt sentence instead of a raw comment.

5. **Implement taxonomy-driven gray-area discovery and question selection in prompt text.**

   Add this contract block under `## Gray Area Identification` or equivalent:

   ```md
   ## Gray Area Queue

   Before asking the user anything, build a compact `grayAreaQueue` from the
   evidence packet. This queue is working state and checkpoint context, not a
   competing artifact schema. Each entry must include:
   - `areaId`: stable kebab-case label
   - `slot`: actor | action-task | object-concept | attribute | goal | event |
     constraint | exception | external-interface | quality-attribute |
     acceptance-verification
   - `defect`: ambiguous | incomplete | inconsistent | unverifiable | tradeoff
   - `lens`: scope | user-visible-behavior | interface-contract | reuse |
     dependency | risk-failure | methodology | routing
   - `evidence`: repo paths, saved artifacts, MCP results, or user-provided
     source that exposed the gap
   - `downstreamImpact`: research | ui | plan | validation | routing
   - `decisionValue`: high | medium | low
   - `resolutionCriterion`: what answer, assumption, or handoff makes the area
     resolved
   - `candidateQuestion`: the single next question that would resolve or shrink
     the area
   ```

   Replace generic interview guidance with a concrete one-question policy:

   ```md
   ## Questioning Rules

   Ask the highest-decision-value unresolved question next. A question is high
   value only when the answer can change phase boundary, implementation
   approach, acceptance/verification hooks, safety/security posture, artifact
   routing, or required `phase.context` fields.

   Use this format for interactive questions:

   Question: <one concrete phase-specific decision>
   Why it matters: <which context field, downstream command, or routing gate this unblocks>
   Known evidence: <repo path/MCP result/user source>
   Recommended option: <safe default, only when evidence supports one>
   Other options: <2-3 concrete alternatives plus freeform escape>
   Resolved when: <exact criterion that lets the agent checkpoint or move on>

   Do not ask checklist or atmosphere questions such as "Any other requirements?",
   "What should we consider?", or "What are your preferences?" unless the
   question is tied to a named `grayAreaQueue` entry, cites the evidence gap,
   and states what downstream decision the answer will change.
   ```

   Add stop criteria so the loop terminates cleanly:

   ```md
   An area is resolved when one of these is true:
   1. A user answer or evidence-backed assumption maps to a concrete
      `implementationDecisions` entry with rationale/evidence.
   2. The unknown is intentionally recorded in `openQuestions` with owner or
      downstream consumer and no longer blocks the current context write.
   3. The unknown is routed to `research`, `ui`, or later planning with the exact
      follow-up read or artifact dependency recorded.
   4. The idea is out of scope and captured under `deferredIdeas`.

   Stop asking when all high-decision-value areas are resolved by one of those
   paths and remaining low-value details would not change the next safe action.
   ```

   Include this few-shot example:

   ```md
   Gray area example:
   - `areaId`: auth-error-contract
   - `slot`: exception
   - `defect`: incomplete
   - `lens`: interface-contract
   - `evidence`: `.blueprint/ROADMAP.md` says "handle auth failures"; current
     context names no error payload.
   - `downstreamImpact`: plan, validation
   - `decisionValue`: high
   - `candidateQuestion`: "For auth failures, should this phase standardize a
     machine-readable error code now, reuse the existing generic failure shape,
     or defer payload shape to a later API-contract phase?"
   - `resolved`: selected generic failure shape; record rationale and validation
     expectation in `implementationDecisions`.
   ```

6. **Strengthen assumptions mode, skip-discuss behavior, and evidence grading.**

   Add a concrete assumption record shape:

   ```md
   ## Assumptions Mode

   Assumption record:
   - Area:
   - Decision default:
   - Evidence:
   - Evidence grade:
   - Confidence: Confident | Likely | Unclear
   - Competing interpretations:
   - Contradictions checked:
   - Consequence if wrong:
   - Ask/reopen rule:
   - Downstream status: plan-safe | research-needed | ui-needed | user-confirmation-needed
   ```

   Define confidence and evidence thresholds:

   ```md
   Confidence labels:
   - Confident: Direct repo/runtime or saved Blueprint evidence supports the
     default, no material contradictory evidence was found, and the consequence
     if wrong is low or easily corrected.
   - Likely: The default follows from a consistent repo pattern or prior artifact
     but lacks direct confirmation, or the consequence if wrong is moderate and
     must be visible to downstream planning.
   - Unclear: Evidence is thin, conflicting, stale, externally inferred, or the
     consequence if wrong is high. Do not lock as plan-safe; ask the user or
     route to research/UI/user confirmation.

   Evidence grades:
   `repo-observed`, `repo-inferred`, `saved-artifact`, `user-stated`,
   `official-external`, `research-secondary`, `assumption`, `contradicted`,
   `unknown`.
   ```

   Add the ask-versus-assume threshold to both the runtime contract and the skill:

   ```md
   Ask instead of assuming when the answer changes phase scope, public behavior,
   data/contracts, security/privacy, migration or deletion behavior, acceptance
   criteria, command routing, or whether a downstream research/UI gate is
   required.

   Assume only when the evidence is repo-grounded, internally consistent, low
   blast-radius, and the final context can label the default as reversible.
   ```

   Add contradiction handling:

   ```md
   When evidence conflicts, preserve the conflict instead of smoothing it. For
   current Blueprint runtime behavior, prefer live MCP output and repo source
   over saved docs. For desired product intent, prefer the user's current answer
   over older artifacts. If the conflict changes implementation shape, ask the
   user; if it changes technical feasibility or external correctness, route to a
   `research-needed` assumption.
   ```

   Add sidecar bounds:

   ```md
   Ask `blueprint-researcher` for one assumptions pass only when configured and
   useful. It must return defaults grouped by gray area, direct repo paths or
   supplied official references, confidence labels using this contract,
   contradictions or missing evidence, and the smallest question that would
   change each default. It must not draft `phase.context` or mark `Unclear`
   defaults as decisions.
   ```

   Make `workflow.skip_discuss=true` use the same safety rules: it may shorten or skip interview turns, but it must still produce evidence-backed context, label defaults, and stop or ask when high-impact assumptions remain unresolved.

7. **Add checkpoint v2 semantics as prompt-compatible metadata first.**

   Do not require a runtime schema change in the first implementation. The current checkpoint parser tolerates extra fields, so prompt text can introduce richer metadata while preserving existing `completedAreas`, `remainingAreas`, `decisions`, `deferredIdeas`, `canonicalReferences`, and `resumeMeta`.

   Add this block:

   ```md
   ## Checkpointing And Resume

   Persist after every user answer and after every gray-area boundary. A
   checkpoint is resume-ready only when the active area has a stable `areaId`,
   state, current question or blocking reason, evidence refs, and the last
   accepted user answer or assumption. Do not infer these from the chat
   transcript.

   Area states:
   `unseen`, `questioning`, `assumed`, `decided`, `blocked`, `needs-revisit`.

   Keep `completedAreas`, `remainingAreas`, and `resumeMeta.pendingTopics` /
   `resumeMeta.completedTopics` for current runtime compatibility, but derive
   them from `areaQueue` when `areaQueue` exists. `areaQueue` is the semantic
   source of truth; the lists are compatibility summaries.
   ```

   Add a sample checkpoint shape:

   ```json
   {
     "ownerCommand": "/blu-discuss-phase",
     "schemaVersion": 2,
     "phaseKey": "03-phase-discovery",
     "progress": {
       "activeStage": "Execute",
       "pendingGate": "gray-area-question",
       "executionMode": "discuss/resumed",
       "areasDecided": 1,
       "areasTotal": 4,
       "nextActionPreview": "Ask the current UI expectations follow-up"
     },
     "areaQueue": [
       {
         "areaId": "scope-boundary",
         "title": "Scope boundaries",
         "state": "decided",
         "decisionIds": ["D-scope-001"],
         "evidenceRefs": [".blueprint/ROADMAP.md"],
         "downstreamConsumers": ["/blu-research-phase", "/blu-plan-phase"]
       },
       {
         "areaId": "ui-expectations",
         "title": "UI expectations",
         "state": "questioning",
         "currentQuestion": "Does this phase author a real UI surface or only a no-UI rationale?",
         "questionWhyItMatters": "Controls whether /blu-ui-phase should produce UI work or an explicit skip rationale.",
         "lastUserAnswer": null
       }
     ],
     "carryForward": {
       "phaseBoundary": [],
       "completedDecisions": [],
       "openQuestions": [],
       "deferredIdeas": [],
       "canonicalReferences": [],
       "contradictions": [],
       "doNotInferBeyond": []
     },
     "readSet": []
   }
   ```

   Add deterministic resume ordering:

   ```md
   On resume, read with `expectedOwnerCommand: "/blu-discuss-phase"` and
   `expectedMode: "discuss"`. If `safeToResume` is false, ask resume-versus-
   discard using the warnings. If `safeToResume` is true, pick the first area
   with state `questioning`, then `blocked`, then `needs-revisit`, then the
   first `unseen` area. Never reconstruct the queue from completedAreas prose
   alone.
   ```

   Update `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md` with this fallback status line:

   ```text
   Progress: phase=<resolved phase> stage=<Resolve|Read|Decide|Execute|Persist|Validate|Route>
   gate=<pending gate or none> mode=<discuss|assumptions|skip-discuss>/<fresh|resumed>
   areas=<decided>/<total> active=<areaId or none> next=<next safe action or next question>
   ```

8. **Add context readiness, discussion-log triggers, and downstream handoff packet.**

   Add the model readiness ledger before artifact writing:

   ```md
   ## Context Model Readiness

   Before writing `phase.context`, build a readiness ledger:

   field | source basis | confidence | unresolved risk | downstream consumer

   Every required field must be evidence-backed, user-confirmed, or explicitly
   assumption-backed. Do not write the model while any field is scaffold-derived,
   source-free, or contradicted without an `openQuestions`, `dependencies`, or
   `deferredIdeas` entry.

   Every resolved high-value gray area must appear in the final `phase.context`
   model as an `implementationDecisions` row, a `dependencies` item, an
   `openQuestions` item, a `deferredIdeas` item, or a `canonicalReferences`
   source. If none of those fields receives the area, the discussion is not
   ready to write.
   ```

   Add claim-linked evidence guidance that fits the current schema:

   ```md
   Because the current `phase.context` schema has no separate per-claim evidence
   object, include evidence anchors inside durable values when useful. Prefer:

   "Keep execution resumability checkpoint-owned because
   tests/phase-discovery-discuss.test.ts covers checkpoint survival after
   invalid context writes."

   Avoid disconnected source lists such as:

   "Implementation is straightforward and tests should be added."
   ```

   Add concrete discussion-log triggers:

   ```md
   Write `XX-DISCUSSION-LOG.md` when any trigger is true:
   - more than one gray area was discussed or resumed
   - assumptions mode presented defaults that were accepted, corrected, or rejected
   - the user changed direction, rejected an option, or supplied rationale not
     fully represented in `phase.context`
   - a contradiction, plan-inventory warning, compliance/audit concern, or
     deferred follow-up needs reconstruction later

   Skip the log only when one straightforward area was resolved and the final
   `phase.context` preserves all decisions, sources, and follow-ups.
   ```

   Add the downstream handoff packet. Persist its substance inside current model fields rather than creating a new artifact:

   ```md
   ## Downstream Handoff Packet

   Before final validation and routing, derive a compact handoff packet from the
   saved context model, checkpoint decisions, plan index, effective config, and
   artifact inventory. Persist its substance inside existing `phase.context`
   model sections; do not create a new artifact or pass the raw conversation
   transcript downstream.

   Required packet fields:
   - `researchBrief`: known unknowns, evidence needed, source policy from
     effective config, decision each research item unblocks, stop condition,
     evidence refs, and unresolved questions that must route to
     `/blu-research-phase`.
   - `uiBrief`: UI applicability, users, critical journeys, interaction
     surfaces, accessibility/privacy/safety constraints, and any no-UI skip-
     rationale candidate. A candidate is not a completed `XX-UI-SPEC.md` skip
     rationale.
   - `planBrief`: initial state, desired end state, dependencies, forbidden
     moves, validation oracle, non-goals, repo constraints, accepted assumptions,
     rejected options, and open planning risks.
   - `planInventory`: existing plan IDs and paths, dependency gaps, warnings,
     and whether refreshed discovery leaves saved plans stale until
     `/blu-plan-phase` is rerun.
   - `routingGates`: selected phase, workflow research/UI booleans, context
     path, research path/status, UI-spec path/status, refreshed next safe
     action, and fallback action when routing is unavailable.
   ```

   Add this fixed stale-plan warning:

   ```md
   Existing saved plans were not rewritten by this refreshed discussion; rerun
   `/blu-plan-phase <selectedPhase>` before trusting plan content that depends
   on the new context.
   ```

9. **Tighten final validation, routing, and final-response shape.**

   Add this route source block near the final state sync and route steps:

   ```md
   ## Final Routing

   Route only from the post-write `blueprint_state_load` result:
   1. Call `blueprint_state_update({ base: "synced", patch: { currentPhase,
      activeCommand: "/blu-discuss-phase" } })`.
   2. Call `blueprint_state_load`.
   3. Copy `derivedStatus.nextAction` exactly as the next safe action.
   4. If the loaded action is missing, blocked, or not a Blueprint command, say:
      `Run /blu-progress to review the next safe Blueprint action`.
   5. Do not list alternate runnable commands unless a future contract explicitly
      adds `blueprint_command_catalog` to this command's allowlist and tests.
   ```

   Add this final response shape:

   ```md
   Final response shape:
   - Saved: context path, optional discussion-log path, reused/replaced status.
   - Checkpoint: deleted, retained with reason, or no checkpoint.
   - Handoff: one-line summary of `researchBrief`, `uiBrief`, `planBrief`, and
     `planInventory`, including the stale-plan warning when plans already exist.
   - Next safe action: exact refreshed `derivedStatus.nextAction` or
     `/blu-progress` fallback. Do not include secondary runnable routes.
   ```

   Add this semantic self-check before success:

   ```md
   Before claiming success, answer yes/no:
   1. Does every `implementationDecisions` row name a decision and the
      constraint/tradeoff that makes it durable?
   2. Does every `existingCodeInsights` item cite a file/module, saved artifact,
      command output, or explicit unknown?
   3. Are all deferred or later ideas preserved in `deferredIdeas` and, when
      useful, in the discussion log?
   4. Are all open questions either concrete blockers or exactly the model value
      `"none"`?
   5. Could `/blu-research-phase`, `/blu-ui-phase`, or `/blu-plan-phase` consume
      this without re-asking basics?
   ```

10. **Only after prompt behavior is pinned, consider optional schema/runtime hardening.**

   This is explicitly later work, not required for the first implementation. Consider it only if prompt-level behavior proves valuable and downstream commands need machine-readable fields.

   Optional checkpoint schema changes:

   - Add typed `schemaVersion`, `areaQueue`, `progress`, `carryForward`, and `readSet` to `src/mcp/tools/phase-checkpoint-records.ts`.
   - Validate duplicate `areaId` values, legal states, required `currentQuestion` for `questioning`, required evidence refs for `decided` and `assumed`, and read-set stale markers.
   - Preserve `.catchall(z.unknown())` or provide a migration path if existing checkpoints may contain extra fields.

   Optional context model changes:

   - Add versioned claim/provenance fields to `src/mcp/artifact-contracts/schemas/phase.context.model.schema.json`, such as `evidenceClaims`, richer `implementationDecisions`, structured `openQuestions`, or structured downstream handoff fields.
   - Update `src/mcp/tools/phase-context-model.ts` rendering and `src/mcp/artifact-contracts/index.ts` examples together.
   - Update `tests/context-contract-parity.test.ts` for schema identity, required field parity, rendered heading parity, minimal examples, and exact `openQuestions: ["none"]` compatibility.

   Optional discussion-log model changes:

   - Consider a model-backed `phase.discussion-log` only after trigger rules prove the optional log is consistently useful.
   - Candidate fields: `sessionSummary`, `turnNotes`, `optionsConsidered`, `userCorrections`, `assumptionsPresented`, `deferredFollowUps`, and `sourceRefs`.

### Exact Test Plan For Future Implementation

Add or extend these tests in `tests/phase-discovery-discuss.test.ts`:

1. `discuss runtime contract defines selected phase read packet`
   - Assert the runtime contract contains `Selected Phase Read Packet`, `selectedPhase`, `stateCurrentPhase`, `selectedPhaseResolvedFrom`, and the found-false stop rule.
   - Assert it mentions the minimum read order and prior-context relevance rule.

2. `discuss command keeps selected phase distinct from ambient state`
   - Assert `commands/blu-discuss-phase.toml` contains selected-phase read packet wording.
   - Use the existing earlier-phase fixture or add a new one where state is Phase 3 and the command targets Phase 2; assert final state sync still preserves `patch.currentPhase`.

3. `discuss runtime contract requires artifact status classification`
   - Assert statuses `missing`, `scaffold-starter`, `authored-substantive`, `validation-suspect`, `safe-checkpoint`, `foreign-checkpoint`, and `stale-plan-inventory` appear.
   - Assert the text maps classification to resume/discard, overwrite confirmation, repair, or fresh discovery.

4. `discuss runtime contract defines gray area queue and anti generic questions`
   - Assert `grayAreaQueue`, all requirement slots, all defect labels, `decisionValue`, `resolutionCriterion`, `candidateQuestion`, and `downstreamImpact` appear.
   - Assert anti-example fragments like `Any other requirements?` are present only in an anti-generic-question warning.

5. `questioning rules require decision value and resolved when format`
   - Assert `Question:`, `Why it matters:`, `Known evidence:`, `Recommended option:`, `Other options:`, and `Resolved when:` appear in the runtime contract.
   - Assert high-value questions are tied to phase boundary, implementation approach, acceptance/verification hooks, safety/security posture, artifact routing, or required context fields.

6. `assumptions mode defines confidence labels and ask threshold`
   - Assert `Assumption record`, `Evidence grade`, `Competing interpretations`, `Contradictions checked`, `Consequence if wrong`, and `Downstream status` appear.
   - Assert `Confident`, `Likely`, and `Unclear` definitions include direct evidence/contradiction/consequence criteria.
   - Assert `Ask instead of assuming` covers scope, public behavior, data/contracts, security/privacy, migration/deletion, acceptance criteria, command routing, and downstream research/UI gates.

7. `skip discuss uses assumptions safety rules`
   - Assert `workflow.skip_discuss=true` is mentioned with evidence-backed context, labeled defaults, and a high-impact stop/ask rule.

8. `checkpoint contract preserves area queue as semantic source`
   - Assert `Persist after every user answer`, `areaQueue`, `schemaVersion`, `carryForward`, `readSet`, and all area states appear.
   - Add a checkpoint round-trip fixture using `blueprintPhaseCheckpointPut` and `blueprintPhaseCheckpointGet` with extra v2 fields; assert the fields are preserved under current catchall behavior.

9. `resume ordering is deterministic`
   - Assert the runtime contract says to read with `expectedOwnerCommand: "/blu-discuss-phase"` and `expectedMode: "discuss"`.
   - Assert the ordering is `questioning`, `blocked`, `needs-revisit`, then `unseen`.
   - Add or extend a fixture so unsafe foreign checkpoints remain non-resumable evidence and are not overwritten.

10. `long running profile has fallback progress line`
   - Assert `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md` contains the fixed `Progress: phase=<resolved phase>` line.
   - Assert helper state is described as mirroring the checkpoint, not owning persistence.

11. `context readiness ledger and discussion log triggers are present`
   - Assert `Context Model Readiness`, `readiness ledger`, `source basis`, `confidence`, `unresolved risk`, and `downstream consumer` appear.
   - Assert discussion-log triggers include multi-area sessions, assumptions corrections, user direction changes, contradictions, plan-inventory warnings, and deferred follow-ups.

12. `downstream handoff packet is required`
   - Assert `Downstream Handoff Packet`, `researchBrief`, `uiBrief`, `planBrief`, `planInventory`, and `routingGates` appear.
   - Assert `uiBrief` distinguishes `skip-rationale candidate` from a completed `XX-UI-SPEC.md` skip rationale.
   - Assert `planInventory` includes existing plan IDs/paths, dependency gaps, warnings, and stale-plan wording.

13. `final routing copies refreshed state and forbids alternate routes`
   - Assert the runtime contract requires `blueprint_state_update` followed by `blueprint_state_load`.
   - Assert it says to copy `derivedStatus.nextAction` exactly.
   - Assert missing/blocked action fallback is `/blu-progress`.
   - Assert `Do not include secondary runnable routes` appears.

14. `allowlist remains stable unless catalog routing is intentionally added`
   - If `blueprint_command_catalog` is not added, assert it remains absent from the discuss command scoped MCP allowlist and the runtime contract does not tell agents to call it.
   - If it is added later, assert the manifest, skill, runtime reference, command docs, and tool registration tests all changed together.

Add or extend these tests in `tests/context-contract-parity.test.ts` only if optional schema/model work is done:

1. `phase context schema version and renderer stay in parity`
   - Assert any new fields exist in schema, renderer, scaffold/authoring examples, and docs.

2. `open questions none sentinel remains exact`
   - Assert `openQuestions: ["none"]` still renders exactly as `- none` and fuzzy variants are rejected.

3. `claim provenance fields render without breaking required headings`
   - Assert rendered Markdown still includes all locked headings and does not leak schema-only scaffolding.

4. `additionalProperties behavior is intentional`
   - If the schema remains strict, assert extra fields are rejected.
   - If versioned extension fields are added, assert only the intended fields are accepted.

Potential additional tests after runtime/schema work:

- `tests/phase-discovery-research.test.ts`: assert research handoff text from discuss can be consumed as known unknowns and stop conditions without asking discuss-phase to author `XX-RESEARCH.md`.
- `tests/quality-gate-routing.test.ts`: assert a discuss-phase `skip-rationale-candidate` does not count as a completed UI skip rationale for `/blu-ui-review` routing.
- `tests/built-assets-smoke.test.ts`: if TypeScript source, schemas, or built runtime assets change, assert built `dist/` output matches source expectations.

### Verification Steps For Future Implementation

For prompt/docs-only implementation:

1. `npm ci`
2. `npm test -- tests/phase-discovery-discuss.test.ts`
3. `npm test -- tests/context-contract-parity.test.ts`
4. `npm run typecheck`
5. `git diff --check`

For runtime/schema implementation:

1. `npm ci`
2. `npm run build`
3. `npm run typecheck`
4. `npm test -- tests/phase-discovery-discuss.test.ts`
5. `npm test -- tests/context-contract-parity.test.ts`
6. `npm test -- tests/built-assets-smoke.test.ts`
7. Run the broader test suite if checkpoint, state routing, artifact contracts, or built assets changed.
8. Confirm tracked `dist/` output is updated when source changes affect extension runtime behavior.

Manual review checklist:

- Confirm no new prompt text suggests planned-only commands.
- Confirm final route language is copied from refreshed state, not inferred from a successful context write.
- Confirm saved-plan warnings do not imply plans were automatically rewritten.
- Confirm assumptions with `Unclear` confidence cannot become plan-safe decisions.
- Confirm UI skip candidates are not described as completed UI skip rationales.
- Confirm checkpoint deletion happens only after context write, optional discussion-log write, synced state update, and state reload all succeed.
- Confirm optional schema/model changes are versioned and documented before being enforced.

### Risks And Mitigations

- Risk: The prompt becomes too long for agents to follow.
  - Mitigation: Use labeled blocks, short examples, and static tests for headings/anchors. Keep detailed examples in the runtime reference, not duplicated in the command manifest.

- Risk: Overly strict question rules make `/blu-discuss-phase` feel bureaucratic.
  - Mitigation: Rank by decision value, stop when remaining details do not change routing or context fields, and allow assumptions mode for low-risk repo-grounded defaults.

- Risk: Rich checkpoint metadata appears authoritative before runtime validation enforces it.
  - Mitigation: Mark v2 checkpoint fields as prompt-compatible metadata first. Keep existing compatibility lists and owner/mode guards until schema hardening is deliberate.

- Risk: Handoff packet language looks like a new artifact contract.
  - Mitigation: State repeatedly that the packet is derived working structure whose substance must land in existing `phase.context`, optional `phase.discussion-log`, and checkpoint fields.

- Risk: Static prompt tests become brittle.
  - Mitigation: Assert stable semantic anchors and required phrases rather than exact paragraph snapshots, except for safety-critical route and stale-plan warning text.

- Risk: Schema expansion breaks existing context artifacts.
  - Mitigation: Defer schema changes until prompt behavior stabilizes, version any new model shape, keep minimal backward-compatible examples, and update parity tests before code changes.

- Risk: Agents bypass implemented-only routing by adding helpful extra route suggestions.
  - Mitigation: Keep `blueprint_command_catalog` absent unless intentionally added, assert no secondary runnable routes, and route only from `blueprint_state_load.derivedStatus.nextAction` or `/blu-progress`.

### Definition Of Done For The Future Implementation

- `commands/blu-discuss-phase.toml`, `skills/blueprint-phase-discovery/SKILL.md`, and `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md` agree on selected-phase handling, question policy, assumptions safety, context authoring, checkpointing, handoff, and final routing.
- `docs/commands/discuss-phase.md` accurately describes the user-visible behavior without becoming the source of truth for runtime ordering.
- `tests/phase-discovery-discuss.test.ts` pins all new prompt-contract anchors and preserves existing routing, checkpoint, and allowlist guarantees.
- `tests/context-contract-parity.test.ts` remains green; if optional schema work is done, it proves schema/render/docs parity.
- The implementation preserves model-only `phase.context` writes, exact `openQuestions: ["none"]` semantics, checkpoint owner/mode safety, and implemented-only route reporting.
- Verification commands appropriate to the scope pass, and any runtime-affecting source changes include rebuilt tracked `dist/` assets.
