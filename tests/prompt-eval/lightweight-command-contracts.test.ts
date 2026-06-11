import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildLightweightCommandPacket,
  LIGHTWEIGHT_COMMANDS,
  type LightweightCommandGolden
} from "./lightweight-command-packet.js";
import { blueprintCommandCatalog } from "../../src/mcp/tools/project.js";

const repoRoot = process.cwd();
const fixtureRoot = path.join(
  repoRoot,
  "tests/fixtures/prompt-eval/lightweight"
);

const MANIFEST_BUDGETS = {
  fast: { maxLines: 40, maxBytes: 4500 },
  quick: { maxLines: 60, maxBytes: 14000 }
} as const;

async function readGolden(command: "fast" | "quick"): Promise<LightweightCommandGolden> {
  return JSON.parse(
    await readFile(path.join(fixtureRoot, `golden-${command}.json`), "utf8")
  ) as LightweightCommandGolden;
}

async function readSkillText(packet: {
  command: "fast" | "quick";
  skillPath: string | null;
}): Promise<string> {
  assert.ok(packet.skillPath, `${packet.command} should expose a primary skill path`);
  return readFile(path.join(repoRoot, packet.skillPath), "utf8");
}

function extractMarkdownChildSection(
  content: string,
  parentHeading: string,
  childHeading: string
): string {
  const parentIndex = content.indexOf(`## ${parentHeading}`);
  assert.notEqual(parentIndex, -1, `Missing parent heading ${parentHeading}`);
  const afterParent = content.slice(parentIndex);
  const nextParentIndex = afterParent.slice(1).search(/\n## /);
  const parentSection =
    nextParentIndex === -1
      ? afterParent
      : afterParent.slice(0, nextParentIndex + 1);
  const childIndex = parentSection.indexOf(`### ${childHeading}`);
  assert.notEqual(
    childIndex,
    -1,
    `Missing child heading ${childHeading} under ${parentHeading}`
  );
  const afterChild = parentSection.slice(childIndex);
  const nextChildIndex = afterChild.slice(1).search(/\n### /);

  return (
    nextChildIndex === -1
      ? afterChild
      : afterChild.slice(0, nextChildIndex + 1)
  ).trim();
}

test("lightweight prompt-eval packets stay structurally stable for fast and quick", async () => {
  for (const command of LIGHTWEIGHT_COMMANDS) {
    const packet = await buildLightweightCommandPacket(command);
    const expectedGolden = await readGolden(command);

    assert.deepEqual(packet.golden, expectedGolden);
    assert.deepEqual(packet.requiredTools, packet.runtimeMetadata.requiredTools);
    assert.deepEqual(
      packet.requiredTools,
      packet.runtimeContractResource.spec?.requiredTools ?? []
    );
    assert.deepEqual(
      packet.optionalAgents,
      packet.runtimeContractResource.runtimeReference?.optionalAgents ?? []
    );
    assert.deepEqual(packet.inputBundlePaths, packet.skillInputBundles.effective);
    assert.ok(
      packet.inputBundlePaths.includes(packet.manifestPath),
      `${command} packet should include its manifest`
    );
    assert.equal(packet.siblingCommandInputLeaks.length, 0);
  }
});

test("lightweight prompt-eval packets only load active command inputs and never sibling contracts", async () => {
  for (const command of LIGHTWEIGHT_COMMANDS) {
    const packet = await buildLightweightCommandPacket(command);
    const siblingManifest =
      command === "fast" ? "commands/blu-quick.toml" : "commands/blu-fast.toml";
    const siblingRuntimeContract =
      command === "fast"
        ? "skills/blueprint-phase-execution/references/quick-runtime-contract.md"
        : "skills/blueprint-phase-execution/references/fast-runtime-contract.md";

    assert.equal(packet.skillInputBundles.shared.length, 0);
    assert.equal(packet.skillInputBundles.commandSpecific.length > 0, true);
    assert.equal(
      packet.inputBundlePaths.includes("commands/blu-execute-phase.toml"),
      false
    );
    assert.equal(
      packet.inputBundlePaths.includes(
        "skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md"
      ),
      false
    );
    assert.equal(packet.inputBundlePaths.includes(siblingManifest), false);
    assert.equal(packet.inputBundlePaths.includes(siblingRuntimeContract), false);
  }
});

test("fast prompt-eval packet enforces the trivial no-tracker contract", async () => {
  const packet = await buildLightweightCommandPacket("fast");
  const promptText = packet.promptSurfaceText;

  assert.equal(packet.executionProfile, "interactive-read");
  assert.equal(packet.allowedPersistenceTools.includes("blueprint_state_update"), true);
  assert.equal(
    packet.allowedPersistenceTools.includes("blueprint_artifact_report_write"),
    false
  );
  assert.equal(packet.commandSpecificRuntimeReferencePath, packet.inputBundlePaths[1] ?? null);
  assert.doesNotMatch(promptText, /quick-run-latest/i);
  assert.doesNotMatch(promptText, /tracker-eligible/i);
  assert.doesNotMatch(
    promptText,
    /blueprint-(researcher|planner|executor|verifier)/i
  );
  assert.doesNotMatch(
    promptText,
    /`update_topic` tool to keep the active stage visible and `write_todos`/i
  );
  assert.match(promptText, /Do not create quick-run reports/i);
  assert.match(promptText, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
  assert.match(promptText, /Common path tool budget:[\s\S]*lightweight_preflight[\s\S]*state_update/i);
  assert.match(promptText, /Final response budget: max 8 lines/i);
  assert.match(promptText, /Do not use subagents/i);
});

test("quick prompt-eval packet enforces durable quick-run structure without phase-plan leakage", async () => {
  const packet = await buildLightweightCommandPacket("quick");
  const promptText = packet.promptSurfaceText;

  assert.equal(packet.executionProfile, "long-running-mutation");
  assert.deepEqual(packet.allowedPersistenceTools, [
    "blueprint_artifact_report_write",
    "blueprint_state_update"
  ]);
  assert.match(promptText, /quick-run-latest/i);
  assert.match(promptText, /Use no subagents by default/i);
  assert.match(
    promptText,
    /Keep the run inline unless a Blueprint subagent clearly earns its coordination cost/i
  );
  assert.match(promptText, /Show progress only at meaningful stage or gate transitions/i);
  assert.match(promptText, /Do not spam stage narration or emit in-flight updates between transitions/i);
  assert.match(promptText, /report\.quick-run` model/i);
  assert.match(promptText, /Do not pass Markdown `content`/i);
  assert.match(promptText, /run cheap validation by default/i);
  assert.match(
    promptText,
    /For `\/blu-quick`, treat\s+the shared `Validate` stage as pre-report verification[\s\S]*before `mcp_blueprint_blueprint_artifact_report_write`/i
  );
  assert.doesNotMatch(promptText, /post-write checks/i);
  assert.match(promptText, /administrativeToolCalls\?: number/i);
  assert.match(promptText, /subagentCount\?: number/i);
  assert.match(promptText, /validationCommandCount\?: number/i);
  assert.match(promptText, /finalSummaryBudget\?: "short" \| "normal"/i);
  assert.match(promptText, /overwrite confirmation/i);
  assert.match(
    promptText,
    /report overwrite(?: confirmation)? unless `?--force`? is present/i
  );
  assert.match(promptText, /Common path tool budget:[\s\S]*lightweight_preflight[\s\S]*validation shell or test commands[\s\S]*artifact_report_write[\s\S]*state_update/i);
  assert.match(promptText, /Do not add redundant primitive MCP reads on the common path/i);
  assert.match(promptText, /saved phase plan,\s*multi-wave execution/i);
  assert.match(
    promptText,
    /do not let it impersonate a saved phase plan or broad lifecycle execution/i
  );
  assert.match(
    promptText,
    /Do not substitute browser-only, web-search-only, shell-only, or generic\s+helper agents/i
  );
  assert.match(promptText, /do not use generic helper agents, browser-only agents, shell-only agents, or web-search-only substitutes/i);
  assert.match(promptText, /do not use tracker as a saved plan, and do not use subagents to widen scope/i);
  assert.match(
    promptText,
    /if `workflow\.subagents` is disabled or the Blueprint agents are unavailable,[\s\S]*keep the quick run inline/i
  );
  assert.match(promptText, /use `blueprint-researcher` only when `--research` or `--full` is present, the task touches an unfamiliar repo area/i);
  assert.match(promptText, /use `blueprint-planner` only when the task needs a short bounded checklist/i);
  assert.match(promptText, /use `blueprint-verifier` only when `--validate` or `--full` is present, touched files are greater than 2/i);
  assert.match(promptText, /Never claim helper calls were made when they were unavailable/i);
  assert.match(promptText, /"quickTask": ""/);
  assert.match(promptText, /"scopeHandled": \[\]/);
  assert.match(promptText, /do not hand-address `\.blueprint\/reports\/quick-run-latest\.md`/i);
  assert.match(promptText, /Final response budget: max 12 lines by default/i);
  assert.match(promptText, /Keep detailed evidence, file lists, validation logs/i);
  assert.match(
    promptText,
    /(?:tracker state session-local only|keep it session-local).*?(?:do not replace Blueprint MCP persistence|do not let it impersonate a saved phase plan)/is
  );
});

test("lightweight manifests stay cache-friendly and fence-free", async () => {
  for (const command of LIGHTWEIGHT_COMMANDS) {
    const packet = await buildLightweightCommandPacket(command);
    const manifestBytes = Buffer.byteLength(packet.manifestPrompt, "utf8");
    const manifestLines = packet.manifestPrompt.split("\n").length;
    const budget = MANIFEST_BUDGETS[command];

    assert.doesNotMatch(
      packet.manifestPrompt,
      /```|~~~/
    );
    assert.ok(
      manifestLines <= budget.maxLines,
      `${command} manifest prompt should stay within ${budget.maxLines} lines, got ${manifestLines}`
    );
    assert.ok(
      manifestBytes <= budget.maxBytes,
      `${command} manifest prompt should stay within ${budget.maxBytes} bytes, got ${manifestBytes}`
    );
    assert.match(packet.manifestPrompt, /Preserve a cache-friendly prompt layout/i);
    assert.match(
      packet.manifestPrompt,
      /Keep detailed behavior in the skill reference and command-specific input bundle|command-specific runtime reference/i
    );
  }
});

test("shared phase-execution skill keeps fast and quick command sections structurally isolated", async () => {
  const [fastPacket, quickPacket] = await Promise.all([
    buildLightweightCommandPacket("fast"),
    buildLightweightCommandPacket("quick")
  ]);
  const skillText = await readSkillText(fastPacket);

  assert.equal(fastPacket.skillPath, quickPacket.skillPath);

  const fastToolsSection = extractMarkdownChildSection(
    skillText,
    "Command-Scoped Required MCP Tools",
    "`/blu-fast`"
  );
  const quickToolsSection = extractMarkdownChildSection(
    skillText,
    "Command-Scoped Required MCP Tools",
    "`/blu-quick`"
  );
  const fastSummarySection = extractMarkdownChildSection(
    skillText,
    "Command Summaries",
    "`/blu-fast`"
  );
  const quickSummarySection = extractMarkdownChildSection(
    skillText,
    "Command Summaries",
    "`/blu-quick`"
  );

  assert.match(fastToolsSection, /blueprint_lightweight_preflight/i);
  assert.match(fastToolsSection, /blueprint_state_update/i);
  assert.doesNotMatch(fastToolsSection, /blueprint_artifact_report_write/i);
  assert.doesNotMatch(fastToolsSection, /blueprint_phase_summary_write/i);
  assert.doesNotMatch(fastToolsSection, /blueprint_phase_execution_targets/i);

  assert.match(fastSummarySection, /no quick-run report persistence/i);
  assert.match(fastSummarySection, /no subagents/i);
  assert.doesNotMatch(fastSummarySection, /quick-run-latest/i);
  assert.doesNotMatch(fastSummarySection, /report-backed/i);
  assert.doesNotMatch(fastSummarySection, /blueprint-(researcher|planner|executor|verifier)/i);
  assert.doesNotMatch(fastSummarySection, /saved plans as the execution scope authority/i);
  assert.doesNotMatch(fastSummarySection, /summary-backed carry-forward evidence/i);

  assert.match(quickToolsSection, /blueprint_artifact_report_write/i);
  assert.match(quickToolsSection, /blueprint_state_update/i);
  assert.doesNotMatch(quickToolsSection, /blueprint_phase_summary_write/i);
  assert.doesNotMatch(quickToolsSection, /blueprint_phase_execution_targets/i);

  assert.match(quickSummarySection, /tracker-eligible branch handling/i);
  assert.match(quickSummarySection, /quick-run-latest/i);
  assert.match(
    quickSummarySection,
    /routing that refuses to impersonate saved planning or\s+multi-wave execution/i
  );
  assert.doesNotMatch(quickSummarySection, /summary-backed carry-forward evidence/i);
  assert.doesNotMatch(quickSummarySection, /selected plans/i);
  assert.doesNotMatch(quickSummarySection, /lower-wave/i);
  assert.doesNotMatch(quickSummarySection, /\/blu-validate-phase/i);
  assert.doesNotMatch(quickSummarySection, /phase summaries/i);
});

test("lightweight prompt-eval packets keep follow-up routing inside the implemented command surface", async () => {
  const catalog = await blueprintCommandCatalog();

  for (const command of LIGHTWEIGHT_COMMANDS) {
    const packet = await buildLightweightCommandPacket(command);
    const routedCommands = [...packet.promptSurfaceText.matchAll(/\/blu-([a-z0-9-]+)/g)].map(
      (match) => match[1]
    );

    for (const routedCommand of routedCommands) {
      const entry = catalog.commands[routedCommand];
      assert.ok(entry, `${command} references unknown command ${routedCommand}`);
      assert.equal(
        entry.status,
        "implemented",
        `${command} should not recommend planned-only command ${routedCommand}`
      );
      assert.equal(
        entry.implemented,
        true,
        `${command} should only recommend runnable follow-up ${routedCommand}`
      );
    }
  }
});
