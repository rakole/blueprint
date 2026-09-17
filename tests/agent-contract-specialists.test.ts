import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

async function readAgent(agentName: string): Promise<string> {
  return readFile(path.join(repoRoot, "agents", `${agentName}.md`), "utf8");
}

const ownedSpecialistAgents = [
  "blueprint-roadmapper",
  "blueprint-checker",
  "blueprint-executor",
  "blueprint-planner",
  "blueprint-project-researcher",
  "blueprint-researcher",
  "blueprint-ui-designer",
] as const;

const forbiddenControlPlaneAuthorityPatterns = [
  /`get_internal_docs`/i,
  /locked Blueprint docs/i,
  /canonical-doc/i,
  /docs\/[A-Z0-9][A-Z0-9.-]*\.md/i,
  /current Blueprint decisions,\s*drift constraints/i,
] as const;

test("bootstrap and roadmap specialist agents encode the repaired bounded contracts", async () => {
  const projectResearcher = await readAgent("blueprint-project-researcher");
  const roadmapper = await readAgent("blueprint-roadmapper");

  assert.match(projectResearcher, /## Parent-Owned Responsibilities/);
  assert.match(projectResearcher, /external-research approval/i);
  assert.match(projectResearcher, /host\/tool semantics clarification packet/i);
  assert.match(projectResearcher, /runtime-owned metadata\/resource\s+fact/i);
  assert.match(projectResearcher, /## External Research And Self-Correction Rules/);
  assert.match(
    projectResearcher,
    /outside references only when the parent explicitly supplied or approved\s+them/i
  );
  assert.match(projectResearcher, /Keep repo truth distinct from any parent-approved external context/i);
  assert.match(projectResearcher, /## Required Reads/);
  assert.match(projectResearcher, /greenfield`, `scaffold-only`, or `brownfield`/);
  assert.match(projectResearcher, /Confidence:/);
  assert.match(projectResearcher, /\/blu-map-codebase/);
  assert.match(projectResearcher, /requirement-shaping signals/i);
  assert.match(projectResearcher, /`Stack`, `Features`, `Architecture`, and `Pitfalls`/);
  assert.match(projectResearcher, /table-stakes versus\s+differentiator features/i);
  assert.match(projectResearcher, /pitfalls\s+with warning signs and prevention strategies/i);
  assert.match(projectResearcher, /Attach confidence to each research dimension/i);
  assert.match(projectResearcher, /biggest uncertainty still worth asking the user/i);
  assert.match(projectResearcher, /browser, web-search, or shell-only substitute/i);
  assert.match(projectResearcher, /Do not invent web research, outside reviewers, or manual persistence paths/i);
  assert.match(
    projectResearcher,
    /Do not draft or rewrite roadmap, requirements, or `\.blueprint\/` artifacts\s+directly/
  );

  assert.match(roadmapper, /## Parent-Owned Responsibilities/);
  assert.match(roadmapper, /external-research approval/i);
  assert.match(roadmapper, /host\/tool semantics clarification packet/i);
  assert.match(roadmapper, /runtime-owned metadata\/resource\s+fact/i);
  assert.match(roadmapper, /## Typed Input Contract/);
  assert.match(roadmapper, /Roadmapper Packet/i);
  assert.match(roadmapper, /digestScope/i);
  assert.match(roadmapper, /carryForwardFacts/i);
  assert.match(roadmapper, /requirementTransitionHints/i);
  assert.match(roadmapper, /firstPhasePreview/i);
  assert.match(roadmapper, /parentOwnedResponsibilities/i);
  assert.match(roadmapper, /forbiddenActions/i);
  assert.match(roadmapper, /stopConditions/i);
  assert.match(roadmapper, /## External Research And Self-Correction Rules/);
  assert.match(
    roadmapper,
    /Use external references only when the parent explicitly supplied or approved\s+them/i
  );
  assert.match(roadmapper, /Keep repo truth and approved outside context distinct/i);
  assert.match(roadmapper, /## Required Reads/);
  assert.match(roadmapper, /requirement-to-phase coverage explicit/i);
  assert.match(roadmapper, /Every committed requirement must map to exactly one proposed phase/i);
  assert.match(roadmapper, /orphaned or duplicate mappings as blockers/i);
  assert.match(roadmapper, /success criteria/i);
  assert.match(roadmapper, /2-5 concrete, observable success criteria/i);
  assert.match(roadmapper, /coverage summary that states mapped count/i);
  assert.match(roadmapper, /observable truths from a user or maintainer\s+perspective/i);
  assert.match(roadmapper, /group related requirement,\s+integration, or flow gaps/i);
  assert.match(roadmapper, /preserve unaffected phases/i);
  assert.match(roadmapper, /exactly what changed/i);
  assert.match(
    roadmapper,
    /return\s+ordered proposals without inventing permanent phase numbers/i
  );
  assert.match(roadmapper, /provisionalOrderedProposals/i);
  assert.match(roadmapper, /coverageNotes/i);
  assert.match(roadmapper, /blockers/i);
  assert.match(roadmapper, /warnings/i);
  assert.match(roadmapper, /assumptions/i);
  assert.match(roadmapper, /confidence/i);
  assert.match(roadmapper, /relativeFirstPhaseRecommendation/i);
  assert.match(roadmapper, /Do not invent web research, outside reviewers, or manual persistence paths/i);
  assert.match(roadmapper, /browser, web-search, shell-only, or generic helpers/i);
  assert.match(roadmapper, /Do not call MCP write tools/i);
  assert.match(roadmapper, /hand-edit `?\.blueprint\/`?/i);
  assert.match(roadmapper, /final\s+`?phase\.context`?\s+authoring/i);
  assert.match(roadmapper, /override parent confirmation gates/i);
  assert.match(roadmapper, /Do not rewrite `\.blueprint\/ROADMAP\.md`/);
});

test("mapping and discovery specialist agents encode concrete output modes and read boundaries", async () => {
  const mapper = await readAgent("blueprint-mapper");
  const researcher = await readAgent("blueprint-researcher");
  const uiDesigner = await readAgent("blueprint-ui-designer");
  const checker = await readAgent("blueprint-checker");

  assert.match(mapper, /## Focus Modes/);
  assert.match(
    mapper,
    /STACK\.md`, `ARCHITECTURE\.md`,\s+`STRUCTURE\.md`, `CONVENTIONS\.md`, `TESTING\.md`, `INTEGRATIONS\.md`, and\s+`CONCERNS\.md`/
  );
  assert.match(mapper, /Reuse existing codebase docs by default/i);
  assert.match(mapper, /For every artifact, include concise evidence paths/i);
  assert.match(mapper, /Do not revive omitted commands such as `scan` or `intel`/);

  for (const pattern of [
    /## Read And Investigate/,
    /Answer one bounded question/,
    /parent-supplied context, requirement mapping/,
    /parent-supplied locked constraints/,
    /parent-supplied runtime contract excerpts/,
    /scoped file discovery and search/,
    /Confirm summaries against live code/,
    /Stop when evidence supports a decision/,
    /files actually read|paths actually read/i,
    /Never claim tests, shell verification, semantic navigation/,
    /## External Evidence/,
    /parent owns external-source approval and fetching/i,
    /does not fetch\s+official docs itself/,
    /parent-supplied or user-supplied external evidence/,
    /source title, date\/access date, supporting excerpt\/summary/,
    /do not invent source access dates/i,
    /not_enough_evidence/,
    /runtime contract or\s+parent-supplied host\/tool semantics clarification packets/,
    /Repo evidence establishes observed implementation/,
    /Never present training knowledge as current upstream verification/,
    /## Artifact-Grade Findings/,
    /directly_supported/, /partially_supported/, /inferred_from_supported/,
    /contradicted/, /conflicting_sources/, /out_of_scope/,
    /Planning Handoff/, /requirement\/constraint links/,
    /files\/modules, tests\/checks, alternatives, relevant risks and open blockers/,
    /Retrieval Notes/,
    /Do not present a sidecar packet as final persisted research/,
    /prepare's schema\/example to synthesize the final model and publish/,
    /Report honest unknowns; omit irrelevant fields and never invent evidence/,
    /Do not\s+return a full artifact, transcript, hidden chain of thought or raw search dump/,
    /no new dependency/, /platform\/standard-library API/,
    /version, maintenance, vulnerability\/license, footprint, install\/update posture/,
    /unchecked/,
    /## Gray-Area Memo/,
    /exactly one gray area or assumptions pass/,
    /options, tradeoffs, complexity\/impact, recommendation rationale/,
    /ask_user/, /phase.context/,
    /## Boundaries And Revisions/,
    /Keep strong existing findings and revise stale or weak claims only/,
    /Do not write files or mutate/,
    /parent owns user-visible decisions and closes this\s+agent/i
  ]) assert.match(researcher, pattern);

  assert.match(uiDesigner, /## Required Reads/);
  assert.match(uiDesigner, /## Parent-Owned Responsibilities/);
  assert.match(uiDesigner, /external-reference approval/i);
  assert.match(uiDesigner, /host\/tool semantics clarification packet/i);
  assert.match(uiDesigner, /runtime-owned metadata\/resource\s+fact/i);
  assert.match(uiDesigner, /## External Research And Self-Correction Rules/);
  assert.match(uiDesigner, /## UI Decision Rules/);
  assert.match(uiDesigner, /UI Contract` or\s+`Explicit skip rationale/);
  assert.match(uiDesigner, /safety-gate/i);
  assert.match(uiDesigner, /Keep repo truth distinct from any approved outside references/i);
  assert.match(
    uiDesigner,
    /Do not invent web research, outside reviewers, shell-driven validation, or\s+manual\s+persistence paths/i
  );
  assert.match(uiDesigner, /Do not invent a second artifact for skipped UI work/);

  assert.match(checker, /## Purpose/);
  assert.match(checker, /phase UI spec goal-backward/i);
  assert.match(checker, /XX-UI-SPEC\.md/);
  assert.match(checker, /phase\.ui-spec/);
  assert.match(checker, /bounded/i);
  assert.match(checker, /## Review Modes/);
  assert.match(checker, /Do not apply\s+the UI-specific six-dimension gate to ordinary plan reviews/i);
  assert.match(checker, /re-run\s+the checker/i);
});

test("owned specialist agents rely on parent-supplied constraint authority instead of repo-root docs truth", async () => {
  const authorityExpectations = [
    {
      agentName: "blueprint-roadmapper",
      required: [
        /parent-supplied locked\s+constraints/i,
        /parent-supplied runtime contract\s+excerpts/i,
        /runtime-owned metadata\/resource facts/i,
        /parent-approved host\/tool semantics clarification packet/i,
        /not_enough_evidence/i,
      ],
    },
    {
      agentName: "blueprint-checker",
      required: [
        /parent-supplied locked\s+constraints/i,
        /parent-supplied runtime contract\s+excerpts/i,
      ],
    },
    {
      agentName: "blueprint-executor",
      required: [
        /parent-supplied locked\s+constraints/i,
        /parent-supplied runtime contract\s+excerpts/i,
      ],
    },
    {
      agentName: "blueprint-planner",
      required: [
        /parent-supplied locked\s+constraints/i,
        /parent-supplied runtime contract\s+excerpts/i,
      ],
    },
    {
      agentName: "blueprint-project-researcher",
      required: [
        /parent-supplied locked\s+constraints/i,
        /runtime-owned metadata\/resource facts/i,
        /parent-approved host\/tool semantics clarification packet/i,
        /not_enough_evidence/i,
      ],
    },
    {
      agentName: "blueprint-researcher",
      required: [
        /parent-supplied locked\s+constraints/i,
        /parent-supplied runtime contract\s+excerpts/i,
        /parent-supplied host\/tool semantics clarification packets/i,
        /not_enough_evidence/i,
      ],
    },
    {
      agentName: "blueprint-ui-designer",
      required: [
        /parent-supplied locked\s+constraints/i,
        /runtime-owned metadata\/resource facts/i,
        /parent-approved host\/tool semantics clarification packet/i,
        /not_enough_evidence/i,
      ],
    },
  ] as const;

  for (const { agentName, required } of authorityExpectations) {
    const agent = await readAgent(agentName);

    for (const pattern of forbiddenControlPlaneAuthorityPatterns) {
      assert.doesNotMatch(agent, pattern);
    }

    for (const pattern of required) {
      assert.match(agent, pattern);
    }
  }
});

test("owned specialist agents avoid repo-root control-plane docs and internal-doc authority paths", async () => {
  for (const agentName of ownedSpecialistAgents) {
    const agent = await readAgent(agentName);

    for (const pattern of forbiddenControlPlaneAuthorityPatterns) {
      assert.doesNotMatch(
        agent,
        pattern,
        `${agentName} should not rely on repo-root control-plane docs or internal-doc authority`
      );
    }
  }
});

test("lifecycle planning specialist agents keep parent-owned orchestration and persistence explicit", async () => {
  const planner = await readAgent("blueprint-planner");
  const checker = await readAgent("blueprint-checker");
  for (const content of [planner, checker]) {
    assert.match(content, /Parent-Owned Responsibilities/);
    assert.match(content, /parent command owns/i);
    assert.match(content, /MCP\s+(?:validation|persistence)/);
    assert.match(content, /update Blueprint state/);
    assert.match(content, /read-only `read_file`/);
  }
  assert.match(planner, /ready for `blueprint_plan_submit` by the parent/);
  assert.match(planner, /Do not persist plan files/);
  assert.match(planner, /full locked scope/);
  assert.match(checker, /Do not persist verdicts/);
  assert.match(checker, /submits the reviewed model and verdict together/);
  assert.match(checker, /`ACCEPT` is a review verdict, not a persistence or orchestration decision/);
});

test("docs specialist agents encode scoped drafting and evidence-backed verification rules", async () => {
  const docWriter = await readAgent("blueprint-doc-writer");
  const docVerifier = await readAgent("blueprint-doc-verifier");

  assert.match(docWriter, /## Parent-Owned Responsibilities/);
  assert.match(docWriter, /`update_topic`, `write_todos`, and `ask_user`/);
  assert.match(docWriter, /doc-scope selection/i);
  assert.match(docWriter, /external-verification decision/i);
  assert.match(docWriter, /## Required Reads/);
  assert.match(docWriter, /## Output Contract/);
  assert.match(docWriter, /Path: <repo path>/);
  assert.match(docWriter, /repo truth distinct from optional external truth/i);
  assert.match(
    docWriter,
    /Do not introduce outside-source claims unless the parent explicitly supplied\s+or approved them/i
  );
  assert.match(docWriter, /Do not invent shell steps, external reviewers, or persistence paths/i);
  assert.match(docWriter, /Preserve strong existing structure/i);
  assert.match(
    docWriter,
    /Do not widen beyond the parent-selected doc files, digest scope, or approved\s+external sources/i
  );
  assert.match(docWriter, /Do not widen into `\.blueprint\/`, `\.planning\/`, or hidden legacy slash-command behavior/);

  assert.match(docVerifier, /## Parent-Owned Responsibilities/);
  assert.match(docVerifier, /`update_topic`, `write_todos`, and `ask_user`/);
  assert.match(docVerifier, /external-verification decision/i);
  assert.match(docVerifier, /## Verification Rules/);
  assert.match(docVerifier, /PASS`, `GAP`, or `BLOCKED`/);
  assert.match(docVerifier, /repo truth distinct from optional external truth/i);
  assert.match(
    docVerifier,
    /Do not invent shell verification steps, outside reviewers, or a new\s+persistence path/i
  );
  assert.match(docVerifier, /## Required Output Contract/);
  assert.match(docVerifier, /Report Draft/);
  assert.match(
    docVerifier,
    /bounded to the parent-selected\s+docs scope, digest scope, and any explicitly approved external sources/i
  );
  assert.match(docVerifier, /Do not downgrade unsupported claims/i);
});

test("review-family specialist agents encode parent-owned orchestration and bounded evidence contracts", async () => {
  const reviewer = await readAgent("blueprint-reviewer");
  const verifier = await readAgent("blueprint-verifier");
  const securityAuditor = await readAgent("blueprint-security-auditor");
  const uiAuditor = await readAgent("blueprint-ui-auditor");

  assert.match(reviewer, /## Parent-Owned Responsibilities/);
  assert.match(reviewer, /`update_topic`, `write_todos`, and `ask_user`/);
  assert.match(reviewer, /`blueprint_review_scope`/);
  assert.match(
    reviewer,
    /Do not invent shell commands, external reviewers, web research, or manual\s+persistence paths/i
  );
  assert.match(reviewer, /Keep the JSON model bounded to the parent-selected scope and evidence/i);

  assert.match(verifier, /## Parent-Owned Responsibilities/);
  assert.match(verifier, /follow-up fix capture gates/i);
  assert.match(
    verifier,
    /Do not invent external reviewers, shell verification steps, web truth, or\s+persistence paths/i
  );
  assert.match(verifier, /Keep the draft bounded to the parent-selected validation or UAT scope/i);

  assert.match(securityAuditor, /## Parent-Owned Responsibilities/);
  assert.match(securityAuditor, /verify-versus-accept decision/i);
  assert.match(securityAuditor, /declared threat model and mitigation register/i);
  assert.match(
    securityAuditor,
    /do not expand into a generic security scan, shell-heavy\s+investigation, outside reviewers, or web truth gathering/i
  );
  assert.match(
    securityAuditor,
    /Do not invent shell commands, external reviewers, web research, or manual\s+persistence paths/i
  );

  assert.match(uiAuditor, /## Parent-Owned Responsibilities/);
  assert.match(uiAuditor, /overwrite\s+confirmation/i);
  assert.match(
    uiAuditor,
    /do not invent screenshots, shell-driven visual checks, outside\s+reviewers, or web truth/i
  );
  assert.match(
    uiAuditor,
    /Do not invent shell commands, external reviewers, web research, or manual\s+persistence paths/i
  );
});

test("debug specialist agent encodes bounded investigation and report-ready diagnosis", async () => {
  const debuggerAgent = await readAgent("blueprint-debugger");

  assert.match(debuggerAgent, /## Required Reads/);
  assert.match(debuggerAgent, /debug-latest\.md/);
  assert.match(debuggerAgent, /`\/blu-debug` command manifest/i);
  assert.match(debuggerAgent, /skill-local runtime contract/i);
  assert.match(debuggerAgent, /live MCP or\s+runtime-contract inputs/i);
  assert.match(debuggerAgent, /parent-provided command constraints/i);
  assert.doesNotMatch(debuggerAgent, /locked Blueprint docs/i);
  assert.match(debuggerAgent, /## Investigation Protocol/);
  assert.match(debuggerAgent, /narrowest plausible repro path/i);
  assert.match(debuggerAgent, /confirmed`, `likely`, and `unproven`/);
  assert.match(debuggerAgent, /## Required Output Contract/);
  assert.match(debuggerAgent, /## Recovery Options/);
  assert.match(debuggerAgent, /\.blueprint\/reports\/debug-latest\.md/);
  assert.match(debuggerAgent, /Do not present planned-only commands as runnable/i);
});
