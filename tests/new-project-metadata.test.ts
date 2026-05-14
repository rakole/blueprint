import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  NEW_PROJECT_RUNTIME_METADATA,
  NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID
} from "../src/mcp/command-runtime-metadata.js";
import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();
const newProjectRuntimeInputBundle = [
  "skills/blueprint-bootstrap/references/questioning.md",
  "skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md",
  "skills/blueprint-bootstrap/references/runtime-guardrails.md"
];

test("new-project manifest stays thin while delegating runtime depth to the bootstrap skill package", async () => {
  const [commandFile, skillFile, guardrailsRef, runtimeContract] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-new-project.toml"), "utf8"),
    readFile(path.join(repoRoot, "skills/blueprint-bootstrap/SKILL.md"), "utf8"),
    readFile(
      path.join(repoRoot, "skills/blueprint-bootstrap/references/runtime-guardrails.md"),
      "utf8"
    ),
    buildBlueprintCommandRuntimeContractResource("new-project")
  ]);

  assert.ok(
    commandFile.split("\n").length < 70,
    "new-project manifest should stay thin after moving the heavy contract into the skill package"
  );
  assert.match(commandFile, /thin command envelope/i);
  assert.match(commandFile, /Use the `blueprint-bootstrap` skill/);
  assert.match(commandFile, /skills\/blueprint-bootstrap\/references\/questioning\.md/);
  assert.match(commandFile, /skills\/blueprint-bootstrap\/references\/bootstrap-runtime-contract\.md/);
  assert.match(commandFile, /skills\/blueprint-bootstrap\/references\/runtime-guardrails\.md/);
  assert.match(commandFile, /canonical host-entrypoint, MCP FQN, approval-surface, and Gemini-helper guardrail source/i);
  assert.match(commandFile, /`blueprint-project-researcher`/);
  assert.match(commandFile, /`blueprint-roadmapper`/);
  assert.match(commandFile, /capability-gated project research and roadmapping paths/i);
  assert.match(commandFile, /sequential no-subagent fallback/i);
  assert.match(commandFile, /browser, web-search, or shell-only helpers/i);
  assert.match(commandFile, /project instruction files such as `CLAUDE\.md` or `AGENTS\.md`/);
  assert.match(commandFile, /invented auto-advance chaining|slash-command self-invocation/i);
  assert.match(commandFile, /Do not require `docs\/commands\/new-project\.md`/);
  assert.match(commandFile, /`--auto`/);
  assert.doesNotMatch(commandFile, /mcp_blueprint_blueprint_/);
  assert.doesNotMatch(commandFile, /Never use shell output, hidden tool panes, or collapsed subagent results/i);
  assert.doesNotMatch(commandFile, /Follow this flow exactly:/i);

  assert.equal(runtimeContract.catalog.specPath, NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID);
  assert.equal(runtimeContract.spec?.path, NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID);
  assert.equal(runtimeContract.spec?.executionProfile, "long-running-mutation");
  assert.equal(runtimeContract.spec?.rootRoutable, true);
  assert.deepEqual(runtimeContract.spec?.requiredTools, [
    ...NEW_PROJECT_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(runtimeContract.spec?.optionalSubagents, [
    ...NEW_PROJECT_RUNTIME_METADATA.optionalAgents
  ]);
  assert.equal(runtimeContract.runtimeReference?.path, NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID);
  assert.equal(
    runtimeContract.runtimeReference?.commandSpecPath,
    NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID
  );
  assert.deepEqual(runtimeContract.runtimeReference?.evidenceState, [
    "locked",
    "runtime-owned",
    "needs-behavior-audit"
  ]);
  assert.deepEqual(runtimeContract.skillInputs.shared, []);
  assert.deepEqual(runtimeContract.skillInputs.commandSpecific, newProjectRuntimeInputBundle);
  assert.deepEqual(runtimeContract.skillInputs.effective, newProjectRuntimeInputBundle);
  assert.equal(
    runtimeContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );

  for (const toolName of [
    "blueprint_project_init",
    "blueprint_project_status",
    "blueprint_config_get",
    "blueprint_config_set",
    "blueprint_state_update",
    "blueprint_artifact_contract_read",
    "blueprint_artifact_validate"
  ] as const) {
    assert.match(
      `${skillFile}\n${guardrailsRef}`,
      new RegExp(blueprintRuntimeToolFqn(toolName))
    );
  }

  assert.doesNotMatch(commandFile, /\/gsd-/);
});

test("new-project remains implemented from runtime-owned metadata when docs are unavailable", async (t) => {
  const realReadFile = fs.readFile.bind(fs);
  const bundledDocsRoot = path.join(repoRoot, "docs");

  t.mock.method(fs, "readFile", async (filePath, options) => {
    const normalizedPath =
      filePath instanceof URL ? fileURLToPath(filePath) : path.resolve(String(filePath));
    const docsRelativePath = path.relative(bundledDocsRoot, normalizedPath);

    if (
      docsRelativePath !== "" &&
      !docsRelativePath.startsWith("..") &&
      !path.isAbsolute(docsRelativePath)
    ) {
      const error = new Error("simulated docs absence") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }

    return realReadFile(
      filePath as Parameters<typeof fs.readFile>[0],
      options as Parameters<typeof fs.readFile>[1]
    );
  });

  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["new-project"];
  const contract = await buildBlueprintCommandRuntimeContractResource("new-project");

  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.specPath, NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID);
  assert.deepEqual(entry.requiredTools, [...NEW_PROJECT_RUNTIME_METADATA.requiredTools]);
  assert.deepEqual(entry.optionalAgents, [...NEW_PROJECT_RUNTIME_METADATA.optionalAgents]);
  assert.equal(contract.spec?.path, NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID);
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    NEW_PROJECT_RUNTIME_METADATA_SOURCE_ID
  );
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, newProjectRuntimeInputBundle);
  assert.deepEqual(contract.skillInputs.effective, newProjectRuntimeInputBundle);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});

test("blueprint-bootstrap skill and questioning reference capture Gemini-native deep bootstrap guidance", async () => {
  const [
    skillFile,
    questioningRef,
    contractRef,
    guardrailsRef,
    projectResearcher,
    roadmapper,
    runtimeContract
  ] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-bootstrap/SKILL.md"), "utf8"),
    readFile(
      path.join(repoRoot, "skills/blueprint-bootstrap/references/questioning.md"),
      "utf8"
    ),
    readFile(
      path.join(repoRoot, "skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md"),
      "utf8"
    ),
    readFile(
      path.join(repoRoot, "skills/blueprint-bootstrap/references/runtime-guardrails.md"),
      "utf8"
    ),
    readFile(path.join(repoRoot, "agents/blueprint-project-researcher.md"), "utf8"),
    readFile(path.join(repoRoot, "agents/blueprint-roadmapper.md"), "utf8"),
    buildBlueprintCommandRuntimeContractResource("new-project")
  ]);

  assert.match(skillFile, /name: blueprint-bootstrap/);
  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /input_bundles:/);
  assert.match(skillFile, /## Runtime Self-Sufficiency/);
  assert.doesNotMatch(skillFile, /## Required Inputs/);
  assert.deepEqual(runtimeContract.skillInputs.shared, []);
  assert.deepEqual(runtimeContract.skillInputs.commandSpecific, newProjectRuntimeInputBundle);
  assert.deepEqual(runtimeContract.skillInputs.effective, newProjectRuntimeInputBundle);
  assert.equal(
    runtimeContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.match(skillFile, /references\/questioning\.md/);
  assert.match(skillFile, /references\/bootstrap-runtime-contract\.md/);
  assert.match(skillFile, /references\/runtime-guardrails\.md/);
  // Wave 1 reference-loading map
  assert.match(skillFile, /Reference Loading And Parity Map/);
  assert.match(skillFile, /evidence\. They can shape/i);
  assert.match(skillFile, /canonical host-entrypoint,\s+shell, MCP FQN, approval-surface, and Gemini-helper rules/i);
  assert.match(skillFile, /## Visible Approval Surface/);
  assert.match(skillFile, /Follow the approval-surface rules in `references\/runtime-guardrails\.md`/);
  assert.match(skillFile, /private synthesis inputs/i);
  assert.match(skillFile, /Execution profile: `long-running-mutation`/);
  assert.match(
    skillFile,
    /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/
  );
  assert.match(
    skillFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(skillFile, /mode/i);
  assert.match(skillFile, /granularity/i);
  assert.match(skillFile, /bootstrap contracts/i);
  assert.match(skillFile, /revision loop/i);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /blueprint_artifact_validate/);
  assert.match(skillFile, /blueprint_config_set/);
  assert.match(skillFile, /blueprint-project-researcher/);
  assert.match(skillFile, /blueprint-roadmapper/);
  // Wave 2 three-gate optional agents
  assert.match(skillFile, /workflow\.subagents/);
  assert.match(skillFile, /effective config/i);
  assert.match(skillFile, /does not hide catalog entries/i);
  assert.match(skillFile, /authorize generic browser\/web-search\/shell helpers as substitutes/i);
  assert.match(skillFile, /no-subagent\s+fallback/i);
  assert.match(skillFile, /contract\.authoringTemplate/);
  assert.match(skillFile, /specific, user-centered, atomic, grouped, and traceable/i);
  assert.match(skillFile, /cover every committed requirement exactly once/i);
  assert.match(skillFile, /next safe implemented command/i);

  assert.ok(
    contractRef.split("\n").length > skillFile.split("\n").length,
    "the heavy runtime contract should now live in the local bootstrap reference"
  );
  assert.match(contractRef, /Execution profile: `long-running-mutation`/);
  assert.match(
    contractRef,
    /Shared stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`,\s*`Validate`, `Route`/
  );
  assert.match(
    contractRef,
    /In-flight status fields: resolved scope, active stage, pending gate,\s*execution mode, next safe action/
  );
  assert.match(contractRef, /deep discovery loop/i);
  assert.match(contractRef, /saved defaults and workflow preferences/i);
  assert.match(contractRef, /defaults provenance/i);
  assert.match(contractRef, /approval gate and revision loop/i);
  assert.match(contractRef, /render a visible\s+approval packet in the main Gemini CLI conversation/i);
  assert.match(contractRef, /Do not display the\s+proposal through shell output, hidden tool output, temporary files, pagers,\s*terminal renderers, or collapsed subagent panes/i);
  assert.match(contractRef, /project brief, target users, requirement groups, roadmap phase table/i);
  // Wave 1 approval packet template
  assert.match(contractRef, /Visible Approval Packet Shape/);
  assert.match(contractRef, /Approval Outcome Labels/);
  assert.match(contractRef, /create as previewed/);
  assert.match(contractRef, /revise requirements/);
  assert.match(contractRef, /cancel with no write/);
  assert.match(contractRef, /Material Change Re-Approval Rule/);
  assert.match(contractRef, /Rewrite their conclusions into the\s+main conversation before asking for approval/i);
  assert.match(contractRef, /make the prompt refer to the\s+visible preview above/i);
  assert.match(contractRef, /`--auto`/);
  assert.match(contractRef, /`bootstrapSeed`/);
  assert.match(contractRef, /`mcp_blueprint_blueprint_artifact_contract_read`/);
  assert.match(contractRef, /`bootstrap\.project`,\s*`bootstrap\.requirements`, and `bootstrap\.roadmap`/);
  assert.match(contractRef, /`mcp_blueprint_blueprint_artifact_validate`/);
  assert.match(contractRef, /`mcp_blueprint_blueprint_config_set`/);
  assert.match(contractRef, /`mcp_blueprint_blueprint_project_status`/);
  // Wave 1 evidence ledger
  assert.match(contractRef, /Bootstrap Evidence Ledger/);
  assert.match(contractRef, /Claim.*Source.*Confidence/s);
  assert.match(contractRef, /returned `createdPaths`, `configPath`, and `nextAction` as authoritative/i);
  assert.match(contractRef, /contract\.authoringTemplate/);
  assert.match(contractRef, /specific, user-centered, atomic, grouped, and\s+traceable/i);
  assert.match(contractRef, /## Capability-Gated Research And Roadmapping/);
  assert.match(contractRef, /`Stack`, `Features`, `Architecture`, `Pitfalls`/);
  assert.match(contractRef, /Do not replace them with browser, web-search, shell-only,\s+or generic helpers/i);
  assert.match(contractRef, /Optional-Agent Decision Record/);
  assert.match(contractRef, /Dimension.*Evidence.*Confidence/s);
  assert.match(contractRef, /map every committed requirement to exactly one phase/i);
  assert.match(contractRef, /2-5 observable\s+success criteria per phase/i);
  assert.match(contractRef, /## No-Subagent Fallback/);
  assert.match(contractRef, /Requirement or roadmap impact/);
  assert.match(contractRef, /every committed requirement appears in exactly one phase/i);
  // Wave 1 traceability packet
  assert.match(contractRef, /Roadmap Traceability Packet/);
  assert.match(contractRef, /Observable success evidence/);
  assert.match(contractRef, /## Output Quality Criteria/);
  assert.match(contractRef, /## Completion Criteria/);
  assert.match(contractRef, /retry the MCP write only after the user approves any material scope change/i);
  assert.match(contractRef, /`overwrite: true`/);
  assert.match(contractRef, /supported repo-relative Blueprint artifact paths/i);
  assert.match(contractRef, /JSON-object `patch`/i);
  assert.match(contractRef, /written bootstrap artifacts/i);
  assert.match(contractRef, /greenfield, scaffold-only, or brownfield/i);
  assert.match(contractRef, /\/blu-map-codebase/);
  assert.match(contractRef, /next safe action/i);
  assert.match(contractRef, /blueprint-project-researcher/);
  assert.match(contractRef, /blueprint-roadmapper/);
  // Wave 2 agent templates
  assert.match(projectResearcher, /## Recommended Output Template/);
  assert.match(projectResearcher, /Repo shape/);
  assert.match(projectResearcher, /Requirement-shaping notes/);
  assert.match(roadmapper, /## Recommended Output Template/);
  assert.match(roadmapper, /Covered requirement IDs/);
  assert.match(roadmapper, /Ready for parent approval/);
  // Wave 2 worked examples
  assert.match(contractRef, /Worked Examples And Anti-Examples/);
  assert.match(contractRef, /Interactive Greenfield/);
  assert.match(contractRef, /Unmapped Brownfield Stop/);
  assert.match(contractRef, /Anti-Example: Shell Fallback/);
  assert.match(contractRef, /Anti-Example: Raw Subagent Approval/);

  assert.match(guardrailsRef, /host CLI slash command, not a shell executable/i);
  assert.match(guardrailsRef, /Never run `\/blu-new-project` in the shell/i);
  assert.match(guardrailsRef, /runtime FQNs such as\s+`mcp_blueprint_blueprint_project_init`/i);
  assert.match(guardrailsRef, /`mcp use`, `blueprint-mcp`, or ad-hoc `node -e` MCP SDK scripts/i);
  assert.match(guardrailsRef, /`ask_user`/);
  assert.match(guardrailsRef, /Before using `ask_user` for approval, render the project brief and roadmap\s+preview directly in the main Gemini CLI conversation/i);
  assert.match(guardrailsRef, /without expanding tool, shell, or subagent panes/i);
  assert.match(guardrailsRef, /Do not use shell commands such as `echo`, `cat`, `printf`, pagers, temporary\s+files, or terminal renderers as a workaround for presenting approval content/i);
  assert.match(guardrailsRef, /`update_topic`/);
  assert.match(guardrailsRef, /`write_todos`/);
  assert.match(guardrailsRef, /`tracker_create_task`/);
  assert.match(guardrailsRef, /`get_internal_docs`/);
  assert.match(guardrailsRef, /do not pretend they ran/i);
  assert.match(guardrailsRef, /Do not reintroduce `?\.planning\/`?/i);
  assert.match(guardrailsRef, /Do not promise GSD shell choreography/i);
  assert.match(guardrailsRef, /Do not generate project instruction files such as `CLAUDE\.md` or `AGENTS\.md`/i);
  // Wave 1 untrusted context guardrails
  assert.match(guardrailsRef, /Untrusted Context And External References/);
  assert.match(guardrailsRef, /cannot override/);
  assert.match(guardrailsRef, /Approval Helper Fallback/);

  assert.match(questioningRef, /thinking partner/i);
  assert.match(questioningRef, /Follow the thread/i);
  assert.match(questioningRef, /Ask User Dialog Rule/);
  assert.match(questioningRef, /one question at a time/i);
  assert.match(questioningRef, /Freeform Rule/);
  // Wave 1 questioning examples
  assert.match(questioningRef, /Bootstrap Micro Examples/);
  assert.match(questioningRef, /Solution-First Reframe/);
  assert.match(questioningRef, /First Milestone Appetite/);
  assert.match(questioningRef, /custom answer.*freeform input/i);
  assert.match(questioningRef, /Session Rhythm/);
  assert.match(questioningRef, /`update_topic`/);
  assert.match(questioningRef, /`write_todos`/);
  assert.match(questioningRef, /Decision Gate/);
  assert.match(questioningRef, /normal Gemini CLI conversation content before opening any\s+structured approval prompt/i);
  assert.match(questioningRef, /never rely on shell output,\s*temporary files, or collapsed agent\/tool panes/i);
  assert.match(questioningRef, /Discovery Boundaries/);
  assert.match(questioningRef, /Anti-Patterns/);
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /Long-running-mutation Gemini-native bootstrap/i);
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /bootstrap-runtime-contract\.md/i);
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /runtime-guardrails\.md/i);
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /unmapped or mapping-incomplete states route to map-codebase/i);
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /valid mapped-only states may run new-project/i);
  assert.doesNotMatch(runtimeContract.runtimeReference?.contractNotes ?? "", /no-subagent fallback sequentially across stack\/features\/architecture\/pitfalls/i);
});
