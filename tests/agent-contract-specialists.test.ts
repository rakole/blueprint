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

  assert.match(projectResearcher, /## Required Reads/);
  assert.match(projectResearcher, /greenfield`, `scaffold-only`, or `brownfield`/);
  assert.match(projectResearcher, /Confidence:/);
  assert.match(projectResearcher, /\/blu:map-codebase/);
  assert.match(
    projectResearcher,
    /Do not draft or rewrite roadmap, requirements, or `\.blueprint\/` artifacts\s+directly/
  );

  assert.match(roadmapper, /## Required Reads/);
  assert.match(roadmapper, /requirement-to-phase coverage explicit/i);
  assert.match(roadmapper, /success criteria/i);
  assert.match(roadmapper, /group related requirement,\s+integration, or flow gaps/i);
  assert.match(
    roadmapper,
    /return\s+ordered proposals without inventing permanent phase numbers/i
  );
  assert.match(roadmapper, /Do not rewrite `\.blueprint\/ROADMAP\.md`/);
});

test("mapping and discovery specialist agents encode concrete output modes and read boundaries", async () => {
  const mapper = await readAgent("blueprint-mapper");
  const researcher = await readAgent("blueprint-researcher");
  const uiDesigner = await readAgent("blueprint-ui-designer");

  assert.match(mapper, /## Focus Modes/);
  assert.match(
    mapper,
    /STACK\.md`, `ARCHITECTURE\.md`,\s+`STRUCTURE\.md`, `CONVENTIONS\.md`, `TESTING\.md`, `INTEGRATIONS\.md`, and\s+`CONCERNS\.md`/
  );
  assert.match(mapper, /Reuse existing codebase docs by default/i);
  assert.match(mapper, /For every artifact, include concise evidence paths/i);
  assert.match(mapper, /Do not revive omitted commands such as `scan` or `intel`/);

  assert.match(researcher, /## Required Reads/);
  assert.match(researcher, /## Required Output Contract/);
  assert.match(researcher, /## Revision Behavior/);
  assert.match(
    researcher,
    /preserve strong sections and\s+revise only the stale or weak parts/i
  );
  assert.match(researcher, /official docs or upstream references explicitly supplied by the parent/);

  assert.match(uiDesigner, /## Required Reads/);
  assert.match(uiDesigner, /## UI Decision Rules/);
  assert.match(uiDesigner, /UI Contract` or\s+`Skip Rationale/);
  assert.match(uiDesigner, /safety-gate/i);
  assert.match(uiDesigner, /Do not invent a second artifact for skipped UI work/);
});

test("docs specialist agents encode scoped drafting and evidence-backed verification rules", async () => {
  const docWriter = await readAgent("blueprint-doc-writer");
  const docVerifier = await readAgent("blueprint-doc-verifier");

  assert.match(docWriter, /## Required Reads/);
  assert.match(docWriter, /## Output Contract/);
  assert.match(docWriter, /Path: <repo path>/);
  assert.match(docWriter, /Preserve strong existing structure/i);
  assert.match(docWriter, /Do not widen into `\.blueprint\/`, `\.planning\/`, or hidden `\/gsd:\*` behavior/);

  assert.match(docVerifier, /## Verification Rules/);
  assert.match(docVerifier, /PASS`, `GAP`, or `BLOCKED`/);
  assert.match(docVerifier, /## Required Output Contract/);
  assert.match(docVerifier, /Report Draft/);
  assert.match(docVerifier, /Do not downgrade unsupported claims/i);
});
