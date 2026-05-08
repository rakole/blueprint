import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import {
  blueprintPhaseArtifactRead,
  blueprintPhaseArtifactWrite,
  blueprintPhaseResearchStatus
} from "../src/mcp/tools/phase.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

const repoRoot = process.cwd();

async function createPhaseRepo(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-ui-phase-");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery**
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 3
- Active command: /blu-progress
- Next action: Run /blu-progress
- Last updated: 2026-04-11T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");

  return repoPath;
}

test("ui-phase command references registered tools and single-artifact UI handling", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-ui-phase.toml"), "utf8");
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-discovery/SKILL.md"),
    "utf8"
  );
  const docFile = await readFile(path.join(repoRoot, "docs/commands/ui-phase.md"), "utf8");
  const runtimeReference = await readFile(
    path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"),
    "utf8"
  );
  const runtimeContract = await readFile(
    path.join(
      repoRoot,
      "skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md"
    ),
    "utf8"
  );
  const designerAgent = await readFile(
    path.join(repoRoot, "agents/blueprint-ui-designer.md"),
    "utf8"
  );
  const checkerAgent = await readFile(
    path.join(repoRoot, "agents/blueprint-checker.md"),
    "utf8"
  );
  const requiredTools = [
    "blueprint_phase_locate",
    "blueprint_phase_research_status",
    "blueprint_config_get",
    "blueprint_artifact_contract_read",
    "blueprint_phase_artifact_read",
    "blueprint_phase_artifact_write",
    "blueprint_artifact_scaffold",
    "blueprint_state_update"
  ] as const;

  for (const toolName of requiredTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assert.match(commandFile, /Use the `blueprint-phase-discovery` skill/);
  assert.match(commandFile, /`blueprint-ui-designer` subagent/);
  assert.match(commandFile, /`blueprint-checker` subagent/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`\./);
  assert.match(
    commandFile,
    /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/
  );
  assert.match(commandFile, /`ask_user`/);
  assert.match(commandFile, /artifactId: "phase\.ui-spec"/);
  assert.match(commandFile, /authoringTemplate/);
  assert.match(commandFile, /ui-phase-runtime-contract\.md/);
  assert.match(commandFile, /six-dimension UI quality criteria/i);
  assert.match(commandFile, /artifact: "context"/);
  assert.match(commandFile, /artifact: "research"/);
  assert.match(commandFile, /no-subagent fallback/i);
  assert.match(commandFile, /browser-only, web-search-only, shell-only, or generic agents/i);
  assert.match(commandFile, /workflow\.ui_phase/);
  assert.match(commandFile, /workflow\.ui_safety_gate/);
  assert.match(commandFile, /contract-versus-skip posture/i);
  assert.match(commandFile, /checker-requested revision/i);
  assert.match(commandFile, /\/blu-plan-phase <phase>/);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(commandFile, /XX-UI-SPEC\.md/);
  assert.doesNotMatch(commandFile, /UI-SKIP/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-discovery\.md|agents\/blueprint-ui-designer\.md/);

  assert.match(skillFile, /Execution profile for `\/blu-ui-phase`: `long-running-mutation`\./);
  assert.match(skillFile, /ui-phase-runtime-contract\.md/);
  assert.match(skillFile, /saved context or research/i);
  assert.match(
    skillFile,
    /shared stage vocabulary explicit during non-trivial `\/blu-ui-phase` runs/i
  );
  assert.match(
    skillFile,
    /resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(skillFile, /contract-versus-skip choice/i);
  assert.match(skillFile, /`workflow\.ui_safety_gate` rationale confirmation/);
  assert.match(skillFile, /## Optional Agents[\s\S]*`blueprint-checker`/);
  assert.match(skillFile, /checker-requested revision/i);
  assert.match(skillFile, /six UI dimensions/i);
  assert.match(skillFile, /no-subagent fallback/i);
  assert.match(skillFile, /browser-only, web-search-only, shell-only, or generic agents/i);
  assert.match(skillFile, /repair the same normalized draft/i);
  assert.match(skillFile, /\/blu-plan-phase <phase>/);
  assert.match(skillFile, /\/blu-progress/);
  const contract = await buildBlueprintCommandRuntimeContractResource("ui-phase");
  const metadata = getRuntimeOwnedCommandMetadata("ui-phase");

  assert.ok(metadata);
  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md"
  ]);
  assert.deepEqual(contract.skillInputs.effective, [
    "skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md"
  ]);
  assert.equal(contract.skillInputs.effective.some((input) => input.startsWith("docs/")), false);
  assert.equal(
    contract.skillInputs.effective.includes("docs/commands/discuss-phase.md"),
    false
  );
  assert.equal(
    contract.skillInputs.effective.includes("docs/commands/research-phase.md"),
    false
  );
  assert.equal(
    contract.skillInputs.effective.includes("docs/commands/list-phase-assumptions.md"),
    false
  );

  assert.match(docFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(
    docFile,
    /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    docFile,
    /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(docFile, /## Behavior Stages/);
  assert.match(docFile, /ui-phase-runtime-contract\.md/);
  assert.match(docFile, /contract-versus-skip posture/i);
  assert.match(docFile, /`workflow\.ui_safety_gate` rationale requirements/i);
  assert.match(docFile, /checker revision gate/i);
  assert.match(docFile, /## UI Quality Contract/);
  assert.match(docFile, /saved context or research/i);
  assert.match(docFile, /six dimensions/i);
  assert.match(docFile, /no-subagent fallback/i);
  assert.match(docFile, /browser-only, web-search-only, shell-only, or generic agents/i);
  assert.match(docFile, /retry through MCP once/i);
  assert.match(docFile, /\/blu-plan-phase <phase>/);
  assert.match(docFile, /\/blu-progress/);

  const uiRuntimeRow = runtimeReference
    .split("\n")
    .find((line) => line.startsWith("| `ui-phase` |"));
  assert.ok(uiRuntimeRow, "runtime reference should include the ui-phase row");
  assert.match(uiRuntimeRow, /Long-running-mutation profile for bounded UI-contract drafting/i);
  assert.match(uiRuntimeRow, /resolved scope, active stage, pending gate, execution mode, and next safe action visible/i);
  assert.match(uiRuntimeRow, /contract-versus-skip posture/i);
  assert.match(uiRuntimeRow, /`workflow\.ui_safety_gate` rationale confirmation/);
  assert.match(uiRuntimeRow, /checker-requested revision/i);
  assert.match(uiRuntimeRow, /ui-phase-runtime-contract\.md/i);
  assert.match(uiRuntimeRow, /read actual saved context and research bodies/i);
  assert.match(uiRuntimeRow, /no-subagent section-by-section fallback/i);
  assert.match(uiRuntimeRow, /browser\/web-search\/shell-only or generic substitute agents/i);
  assert.match(uiRuntimeRow, /repair invalid writes/i);
  assert.match(runtimeContract, /## Shared Stage Mapping/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_phase_locate/);
  assert.match(runtimeContract, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(runtimeContract, /contract\.authoringTemplate/);
  assert.match(runtimeContract, /XX-CONTEXT\.md/);
  assert.match(runtimeContract, /XX-RESEARCH\.md/);
  assert.match(runtimeContract, /six UI\s+dimensions/i);
  assert.match(runtimeContract, /## No-Subagent Fallback/);
  assert.match(runtimeContract, /browser-only, web-search-only, shell-only, or generic agents/i);
  assert.match(runtimeContract, /status: "invalid"/);
  assert.match(runtimeContract, /retry through MCP once/i);
  assert.match(designerAgent, /spacing scale and layout rhythm/i);
  assert.match(designerAgent, /typography sizes\/weights\/line heights/i);
  assert.match(designerAgent, /copywriting for CTAs\/empty\/error and\s+destructive states/i);
  assert.match(checkerAgent, /## UI-Spec Six-Dimension Gate/);
  assert.match(checkerAgent, /Copywriting: CTA labels/i);
  assert.match(checkerAgent, /Registry and design-system safety/i);
});

test("ui-phase keeps UI output in a single reusable file for either contract or skip rationale", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const first = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "ui-spec",
    content: `# Phase 03 UI Spec

## Outcome Mode
- UI contract

## User Experience Goals
- Keep the UI guidance phase-scoped.

## Visual Design Decisions
- Spacing and layout: preserve the current dashboard rhythm.
- Typography: reuse the app heading and body scales.
- Color and contrast: stick with the shipped semantic palette.
- Motion and feedback: limit motion to status transitions.
- Copy and content: keep labels concise and task-oriented.

## Screens And States
- Screen/state 1: dashboard overview.
- Loading, empty, error, and success states: specify all four states.
- Responsive behavior: preserve a single-column mobile fallback.

## Components And Constraints
- Component 1: dashboard shell.
- Existing design-system or registry primitives to reuse: existing panel and button primitives.
- New component or token justification: none.
- Density and interaction constraints: keep table density unchanged.

## Accessibility And Content
- Accessibility note 1: preserve keyboard navigation and visible focus.
- Content hierarchy and empty-state guidance: empty states should point users to the next safe action.
- Localization or content safety notes: avoid hard-coded status jargon.

## Registry And Design-System Safety
- Registry and design-system safety: do not fork the current component registry.
- Token and theming compatibility: keep existing tokens untouched.
- Revisit trigger if the scope changes: revisit only if the phase adds a net-new surface.

## Next Safe Action
- /blu-plan-phase 3
`
  });
  const second = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "03",
    artifact: "ui-spec",
    content: `# Phase 03 UI Spec

## Outcome Mode
- UI contract

## User Experience Goals
- Keep the UI guidance phase-scoped.

## Visual Design Decisions
- Spacing and layout: preserve the current dashboard rhythm.
- Typography: reuse the app heading and body scales.
- Color and contrast: stick with the shipped semantic palette.
- Motion and feedback: limit motion to status transitions.
- Copy and content: keep labels concise and task-oriented.

## Screens And States
- Screen/state 1: dashboard overview.
- Loading, empty, error, and success states: specify all four states.
- Responsive behavior: preserve a single-column mobile fallback.

## Components And Constraints
- Component 1: dashboard shell.
- Existing design-system or registry primitives to reuse: existing panel and button primitives.
- New component or token justification: none.
- Density and interaction constraints: keep table density unchanged.

## Accessibility And Content
- Accessibility note 1: preserve keyboard navigation and visible focus.
- Content hierarchy and empty-state guidance: empty states should point users to the next safe action.
- Localization or content safety notes: avoid hard-coded status jargon.

## Registry And Design-System Safety
- Registry and design-system safety: do not fork the current component registry.
- Token and theming compatibility: keep existing tokens untouched.
- Revisit trigger if the scope changes: revisit only if the phase adds a net-new surface.

## Next Safe Action
- /blu-plan-phase 3
`
  });
  const replaced = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "ui-spec",
    content: `# Phase 03 UI Spec

## Outcome Mode
- Explicit skip rationale

## Rationale
- No frontend surface changes are in scope for this phase.
`,
    overwrite: true
  });
  const status = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });
  const body = await blueprintPhaseArtifactRead({
    cwd: repoPath,
    phase: "03",
    artifact: "ui-spec"
  });

  assert.equal(first.written, true);
  assert.equal(first.path, ".blueprint/phases/03-phase-discovery/03-UI-SPEC.md");
  assert.equal(second.written, false);
  assert.match(second.warnings.join("\n"), /content was unchanged/i);
  assert.equal(replaced.overwritten, true);
  assert.equal(status.hasUiSpec, true);
  assert.equal(body.found, true);
  assert.match(body.content ?? "", /Outcome Mode/);
  assert.match(body.content ?? "", /Explicit skip rationale/i);
});

test("phase artifact writes validate context, discussion-log, and ui-spec content", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const invalidContext = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: 3,
    artifact: "context",
    content: `# Phase 03 Context

## Decisions
- Capture durable discuss-phase decisions in the phase artifact.
`
  });
  const invalidDiscussion = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: 3,
    artifact: "discussion-log",
    content: `# Phase 03 Discussion Log

## Summary
- Record the major discussion outcomes and unresolved questions here.
`
  });
  const invalidContextScaffoldLiterals = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: 3,
    artifact: "context",
    content: `# Phase 03 Context

## Phase Boundary

- Goal: keep the saved context grounded.
- In scope: preserve the durable discovery record.
- Out of scope: execution planning.
- Success criteria: later planning can reuse the artifact directly.

## Discovery Grounding

- Project brief: retain the actual brief.
- Requirements grounding: preserve the current requirement grounding.
- Workflow posture: keep discovery adaptive.
- Confirmed decisions: capture durable decisions.

## Implementation Decisions

- Implementation decision 1: preserve the current overwrite boundary.
- Tradeoffs or constraints: the artifact write stays phase-scoped.

## Specific Ideas

- Specific idea 1: carry the confirmed boundary into planning.
- Specific idea 2: reuse the saved checkpoint state in later prompts.
- Later follow-up: revisit optional refinements after planning.

## Existing Code Insights

- Existing code insight 1: the phase artifacts already carry reusable grounding.
- Reusable pattern: keep the same H1 and sectioned bullet format.
- Known gap or caution: avoid mixing execution summary language into the context record.

## Dependencies

- Prior phase artifacts: reuse the saved phase artifacts.
- External constraints: respect repository constraints.
- Required follow-up reads: read the roadmap before planning.

## Open Questions

- Question 1: what remains unresolved?

## Deferred Ideas

- Scope creep or later follow-up: defer anything that does not block planning.
- Ideas to revisit after this phase: keep the next pass grounded in saved artifacts.

## Canonical References

- Source 1: roadmap and context artifacts.
`,
    overwrite: true
  });
  const invalidContextLeadingText = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: 3,
    artifact: "context",
    content: `intro
# Phase 03 Context

## Phase Boundary
- Goal: keep the saved context grounded.

## Discovery Grounding
- Project brief: retain the actual brief.
- Requirements grounding: preserve the current requirement grounding.
- Workflow posture: keep discovery adaptive.
- Confirmed decisions: capture durable decisions.

## Dependencies
- Prior phase artifacts: reuse the saved phase artifacts.
- External constraints: respect repository constraints.
- Required follow-up reads: read the roadmap before planning.

## Open Questions
- Question 1: what remains unresolved?

## Deferred Ideas
- Later follow-up: defer anything that does not block planning.
- Reusable references: keep the next pass grounded in saved artifacts.

## Canonical References
- Roadmap and context artifacts.
`,
    overwrite: true
  });
  const invalidUiSpec = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: 3,
    artifact: "ui-spec",
    content: `# Phase 03 UI Spec

## Outcome Mode
`
  });
  const invalidUiContractMissingSections = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: 3,
    artifact: "ui-spec",
    content: `# Phase 03 UI Spec

## Outcome Mode
- UI contract

## User Experience Goals
- Keep the UI guidance phase-scoped.
`
  });
  const invalidUiSpecPlaceholder = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: 3,
    artifact: "ui-spec",
    content: `# Phase 03 UI Spec

## Outcome Mode
- Choose one: UI contract or explicit skip rationale.
`
  });
  const invalidLegacySkipWithoutRationale = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: 3,
    artifact: "ui-spec",
    content: `# Phase 03 UI Spec

## Outcome Mode
- Skip Rationale
`
  });
  const validContext = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: 3,
    artifact: "context",
    content: `# Phase 03 Context

## Phase Boundary
- Capture durable discuss-phase context for the phase.
- Confirm the phase boundary, grounding, and open issues.
- Exclude execution planning and summary writing.
- Downstream tools can reuse the discovery record without re-eliciting basics.

## Discovery Grounding
- Project brief - the phase needs a durable discovery record.
- Requirements grounding - retain the saved requirements context.
- Workflow posture - keep question asking adaptive and evidence-backed.
- Confirmed decisions - discovery should persist the choices that matter for later planning.

## Implementation Decisions
- Decision 1 - keep the discovery record phase-scoped and resumable.
- Tradeoffs or constraints - preserve explicit overwrite boundaries and the current router contract.

## Specific Ideas
- Specific idea 1 - carry the confirmed boundary into the next planning phase.
- Specific idea 2 - reuse the saved checkpoint state as the starting point for later prompts.
- Follow-up idea - turn the discovered boundary into a concrete plan stub if scope remains stable.

## Existing Code Insights
- Existing code insight 1 - the phase artifacts already provide reusable grounding for planning.
- Reusable pattern - keep the same H1 and sectioned bullet format so the MCP writer can validate it cleanly.
- Known gap or caution - avoid mixing execution summary language into the context record.

## Dependencies
- Prior phase artifacts - saved research and any earlier context.
- External constraints - repo-level safety and roadmap scope.
- Required follow-up reads - the roadmap, requirements, and saved phase artifacts.

## Open Questions
- Which unresolved gray areas still need user input?

## Deferred Ideas
- Later follow-up - revisit anything that does not block the next planning step.
- Reusable references: keep canonical source notes handy for the next pass.

## Canonical References
- Roadmap and requirement notes that shaped the discussion.
`,
    overwrite: true
  });
  const validDiscussion = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: 3,
    artifact: "discussion-log",
    content: `# Phase 03 Discussion Log

## Notes
- 2026-04-19: Confirmed resumability stays phase-scoped.
`,
    overwrite: true
  });
  const validUiSpec = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: 3,
    artifact: "ui-spec",
    content: `# Phase 03 UI Spec

## Outcome Mode
- Skip Rationale

## Rationale
- No frontend surface changes are in scope for this phase.
`,
    overwrite: true
  });

  assert.equal(invalidContext.status, "invalid");
  assert.match(
    invalidContext.validation?.issues.join("\n") ?? "",
    /missing required contract sections/i
  );
  assert.equal(invalidDiscussion.status, "invalid");
  assert.match(invalidDiscussion.validation?.issues.join("\n") ?? "", /placeholder scaffold text/i);
  assert.equal(invalidContextScaffoldLiterals.status, "invalid");
  assert.match(
    invalidContextScaffoldLiterals.validation?.issues.join("\n") ?? "",
    /placeholder scaffold text: Project brief:/i
  );
  assert.match(
    invalidContextScaffoldLiterals.validation?.issues.join("\n") ?? "",
    /placeholder scaffold text: Requirements grounding:/i
  );
  assert.equal(invalidContextLeadingText.status, "invalid");
  assert.match(
    invalidContextLeadingText.validation?.issues.join("\n") ?? "",
    /must start with a markdown H1 title/i
  );
  assert.equal(invalidUiSpec.status, "invalid");
  assert.match(invalidUiSpec.validation?.issues.join("\n") ?? "", /Outcome Mode must not be empty/i);
  assert.equal(invalidUiContractMissingSections.status, "invalid");
  assert.match(
    invalidUiContractMissingSections.validation?.issues.join("\n") ?? "",
    /missing required contract sections/i
  );
  assert.equal(invalidUiSpecPlaceholder.status, "invalid");
  assert.match(
    invalidUiSpecPlaceholder.validation?.issues.join("\n") ?? "",
    /placeholder scaffold text/i
  );
  assert.equal(invalidLegacySkipWithoutRationale.status, "invalid");
  assert.match(
    invalidLegacySkipWithoutRationale.validation?.issues.join("\n") ?? "",
    /must include a non-empty Rationale section/i
  );
  assert.equal(validContext.status, "created");
  assert.equal(validDiscussion.status, "created");
  assert.equal(validUiSpec.status, "created");
});
