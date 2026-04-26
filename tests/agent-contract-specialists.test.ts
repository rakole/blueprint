import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

async function readAgent(agentName: string): Promise<string> {
  return readFile(path.join(repoRoot, "agents", `${agentName}.md`), "utf8");
}

test("bootstrap and roadmap specialist agents encode the repaired bounded contracts", async () => {
  const projectResearcher = await readAgent("blueprint-project-researcher");
  const roadmapper = await readAgent("blueprint-roadmapper");

  assert.match(projectResearcher, /## Parent-Owned Responsibilities/);
  assert.match(projectResearcher, /external-research approval/i);
  assert.match(projectResearcher, /`get_internal_docs` self-correction pass/i);
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
  assert.match(roadmapper, /`get_internal_docs` self-correction pass/i);
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
  assert.match(roadmapper, /Do not invent web research, outside reviewers, or manual persistence paths/i);
  assert.match(roadmapper, /browser, web-search, shell-only, or generic helpers/i);
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

  assert.match(researcher, /## Required Reads/);
  assert.match(researcher, /## Parent-Owned Responsibilities/);
  assert.match(researcher, /external-research approval/i);
  assert.match(researcher, /`get_internal_docs` self-correction pass/i);
  assert.match(researcher, /## External Research And Self-Correction Rules/);
  assert.match(researcher, /Keep repo truth distinct from outside truth/i);
  assert.match(researcher, /## Required Output Contract/);
  assert.match(researcher, /Return content as the populated research body/i);
  assert.match(researcher, /## Revision Behavior/);
  assert.match(
    researcher,
    /preserve strong sections and\s+revise only the stale or weak parts/i
  );
  assert.match(
    researcher,
    /official-doc or external evidence packets|official docs or supplied external references/i
  );
  assert.match(researcher, /Replace every angle-bracket placeholder before returning the draft/i);
  assert.match(
    researcher,
    /Do not invent web research, outside reviewers, shell verification, or manual\s+persistence paths/i
  );

  assert.match(uiDesigner, /## Required Reads/);
  assert.match(uiDesigner, /## Parent-Owned Responsibilities/);
  assert.match(uiDesigner, /external-reference approval/i);
  assert.match(uiDesigner, /`get_internal_docs` self-correction pass/i);
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

test("lifecycle planning specialist agents keep parent-owned orchestration and persistence explicit", async () => {
  const planner = await readAgent("blueprint-planner");
  const checker = await readAgent("blueprint-checker");

  assert.match(planner, /## Parent-Owned Responsibilities/);
  assert.match(planner, /parent command owns orchestration/i);
  assert.match(planner, /visible stage narration/i);
  assert.match(planner, /user\s+checkpoints/i);
  assert.match(planner, /reuse\/revise\/replace or overwrite decision/i);
  assert.match(planner, /artifact scaffolding/i);
  assert.match(planner, /`blueprint_phase_plan_write`/);
  assert.match(planner, /`blueprint_state_update`/);
  assert.match(planner, /MCP-backed persistence step/i);
  assert.match(planner, /ready for\s+`blueprint_phase_plan_write` by the parent command/i);
  assert.match(planner, /Do not own orchestration/i);
  assert.match(planner, /user confirmations/i);
  assert.match(planner, /checkpoints/i);
  assert.match(planner, /MCP validation/i);
  assert.match(planner, /any\s+persistence path/i);
  assert.match(planner, /Do not persist plan files/i);
  assert.match(planner, /update Blueprint state/i);
  assert.match(planner, /accept\/revise\/route decision/i);

  assert.match(checker, /## Parent-Owned Responsibilities/);
  assert.match(checker, /parent command owns when the checker runs/i);
  assert.match(checker, /another\s+revision pass/i);
  assert.match(checker, /user-facing checkpoint or approval prompt/i);
  assert.match(checker, /parent command owns all persistence/i);
  assert.match(checker, /overwrite handling/i);
  assert.match(checker, /follow-up routing after the checker returns a verdict/i);
  assert.match(checker, /findings only/i);
  assert.match(checker, /persist elsewhere if needed/i);
  assert.match(checker, /`ACCEPT` is a review verdict, not a persistence or orchestration decision/);
  assert.match(checker, /Do not own orchestration/i);
  assert.match(checker, /user confirmations/i);
  assert.match(checker, /revision checkpoints/i);
  assert.match(checker, /MCP\s+persistence/i);
  assert.match(checker, /final routing/i);
  assert.match(checker, /Do not persist verdicts/i);
  assert.match(checker, /advance checkpoints/i);
  assert.match(checker, /update Blueprint state/i);
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
  assert.match(reviewer, /Keep the artifact draft bounded to the parent-selected scope and evidence/i);

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
  assert.match(debuggerAgent, /## Investigation Protocol/);
  assert.match(debuggerAgent, /narrowest plausible repro path/i);
  assert.match(debuggerAgent, /confirmed`, `likely`, and `unproven`/);
  assert.match(debuggerAgent, /## Required Output Contract/);
  assert.match(debuggerAgent, /## Recovery Options/);
  assert.match(debuggerAgent, /\.blueprint\/reports\/debug-latest\.md/);
  assert.match(debuggerAgent, /Do not present planned-only commands as runnable/i);
});
