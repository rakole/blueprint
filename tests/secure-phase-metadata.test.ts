import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

test("secure-phase runtime metadata is source-owned and docs-free", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("secure-phase");
  const catalog = await blueprintCommandCatalog();
  const contract = await buildBlueprintCommandRuntimeContractResource("secure-phase");

  assert.ok(metadata);
  assert.equal(metadata.sourceId, "src/mcp/command-runtime-metadata.ts#secure-phase");
  assert.equal(metadata.spec.path, metadata.sourceId);
  assert.equal(metadata.runtimeReference.path, metadata.sourceId);
  assert.deepEqual(metadata.requiredInputPaths, [
    "skills/blueprint-review/references/secure-phase-runtime-contract.md"
  ]);

  assert.equal(catalog.commands["secure-phase"].specPath, metadata.sourceId);
  assert.deepEqual(catalog.commands["secure-phase"].requiredTools, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(catalog.commands["secure-phase"].optionalAgents, [
    ...metadata.optionalAgents
  ]);
  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(contract.runtimeReference?.optionalAgents, [
    ...metadata.optionalAgents
  ]);
  assert.deepEqual(contract.skillInputs, {
    skill: "blueprint-review",
    shared: [],
    commandSpecific: [
      "commands/blu-secure-phase.toml",
      "skills/blueprint-review/references/secure-phase-runtime-contract.md"
    ],
    effective: [
      "commands/blu-secure-phase.toml",
      "skills/blueprint-review/references/secure-phase-runtime-contract.md"
    ]
  });
  assert.doesNotMatch(JSON.stringify(contract), /docs\//);
});

test("secure-phase manifest references the review tools, agent, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-secure-phase.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-review` skill/);
  assert.match(
    commandFile,
    /skills\/blueprint-review\/references\/secure-phase-runtime-contract\.md/
  );
  assert.match(commandFile, /same-named Gemini CLI agent tool `blueprint-security-auditor`/);
  assert.match(commandFile, /bounded threat-mitigation task packet/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(
    commandFile,
    /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(commandFile, /`update_topic` tool/);
  assert.match(commandFile, /`write_todos`/);
  assert.match(commandFile, /session-local progress tools only/i);
  assert.match(commandFile, /`ask_user`/);
  assert.match(commandFile, /one focused question per `ask_user` call/i);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_list")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_execution_targets")));
  assert.match(
    commandFile,
    new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read"))
  );
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_authoring_context")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_validate_model")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_record")));
  assert.match(commandFile, /XX-SECURITY\.md/);
  assert.match(commandFile, /phase_plan_index/i);
  assert.match(commandFile, /phase_plan_read/i);
  assert.match(commandFile, /artifact_contract_read/i);
  assert.match(commandFile, /build the bounded threat register/i);
  assert.match(commandFile, /threat-model-bounded behavior explicit/i);
  assert.match(commandFile, /saved plan evidence only/i);
  assert.match(commandFile, /verify (?:those )?threats or explicitly accept them/i);
  assert.match(commandFile, /Report in-flight progress/i);
  assert.match(
    commandFile,
    /pending gate \(`none`, overwrite confirmation, verify-versus-accept decision, or `pending-open-threat`\)/i
  );
  assert.match(commandFile, /execution mode \(`inline` versus `security-auditor-assisted`\)/i);
  assert.match(commandFile, /threat-register coverage/i);
  assert.match(commandFile, /Threat Register` should represent every declared saved-plan threat exactly once/i);
  assert.match(commandFile, /no-subagent fallback/i);
  assert.match(commandFile, /final threat-count consistency pass/i);
  assert.match(commandFile, /repair once against the canonical `review\.security` contract/i);
  assert.match(
    commandFile,
    /pending-open-threat status \(`none`, `verifying`, `accepted`, or `still-open`\)/i
  );
  assert.match(commandFile, /waiting state explicit as `pending-open-threat`/i);
  assert.match(commandFile, /do not emit next-step routing when any threat remains open/i);
  assert.match(commandFile, /\/blu-validate-phase/);
  assert.match(commandFile, /\/blu-verify-work/);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(
    commandFile,
    /Repo-wide derived progress\/state may still surface saved review remediation debt such as `\/blu-code-review-fix <phase>` after security exists, but `\/blu-secure-phase` itself must not emit that action\./
  );
  assert.doesNotMatch(commandFile, /skills\/blueprint-review\.md|agents\/blueprint-security-auditor\.md/);
});

test("secure-phase review skill captures MCP-owned security audit rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-review/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-secure-phase/);
  assert.match(skillFile, /blueprint-security-auditor/);
  assert.match(
    skillFile,
    /skills\/blueprint-review\/references\/secure-phase-runtime-contract\.md/
  );
  assert.match(skillFile, /Execution profile for `secure-phase`: `long-running-mutation`/);
  assert.match(
    skillFile,
    /Each command-local runtime contract owns the detailed stage vocabulary, in-flight status fields, and waiting-state semantics/
  );
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /blueprint_phase_plan_index/);
  assert.match(skillFile, /blueprint_phase_plan_read/);
  assert.match(skillFile, /blueprint_phase_summary_index/);
  assert.match(skillFile, /blueprint_phase_summary_read/);
  assert.match(skillFile, /blueprint_phase_execution_targets/);
  assert.match(skillFile, /blueprint_review_authoring_context/);
  assert.match(skillFile, /blueprint_review_validate_model/);
  assert.match(skillFile, /blueprint_review_record/);
  assert.match(skillFile, /XX-SECURITY\.md/);
  assert.match(skillFile, /blueprint_phase_plan_index/);
  assert.match(skillFile, /blueprint_phase_plan_read/);
  assert.match(skillFile, /build a threat\s+register/i);
  assert.match(skillFile, /summary threat-flag\s+incorporation/i);
  assert.match(skillFile, /saved plan\s+evidence only/i);
  assert.match(skillFile, /update_topic plus `write_todos`/i);
  assert.match(skillFile, /verify open threats or explicitly accept\s+them/i);
  assert.match(skillFile, /pending-open-threat\s+status/i);
  assert.match(skillFile, /verify-versus-accept decision/i);
  assert.match(skillFile, /inline versus\s+`blueprint-security-auditor`-assisted review/i);
  assert.match(skillFile, /pending-open-threat/i);
  assert.match(skillFile, /block\s+advancement when any threat remains open/i);
  assert.match(skillFile, /final threat-count consistency pass/i);
  assert.match(skillFile, /repair against the `review\.security` model contract, narrowed task\s+schema, and diagnostics, then retry once/i);
  assert.match(skillFile, /do not emit next-step\s+routing while threats remain open/i);
  assert.match(skillFile, /\/blu-validate-phase/);
  assert.match(skillFile, /\/blu-progress/);
  assert.match(
    skillFile,
    /Repo-wide derived progress\/state may still surface saved[\s\S]*`\/blu-code-review-fix <phase>` after[\s\S]*`\/blu-secure-phase` itself must not emit that action\./
  );
});

test("secure-phase manifest and runtime resource describe the long-running security spine", async () => {
  const [commandFile, contract, referenceFile] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-secure-phase.toml"), "utf8"),
    buildBlueprintCommandRuntimeContractResource("secure-phase"),
    readFile(
      path.join(repoRoot, "skills/blueprint-review/references/secure-phase-runtime-contract.md"),
      "utf8"
    )
  ]);

  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(
    commandFile,
    /stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(commandFile, /saved phase threat model/i);
  assert.match(commandFile, /saved plan evidence only/i);
  assert.match(commandFile, /`update_topic` tool/);
  assert.match(commandFile, /`write_todos`/i);
  assert.match(commandFile, /session-local progress tools only/i);
  assert.match(commandFile, /`pending-open-threat`/i);
  assert.match(commandFile, /pending-open-threat status/i);
  assert.match(commandFile, /do not emit next-step routing when any threat remains open/i);

  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /Long-running-mutation profile for bounded threat verification/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /persist review\.security through review MCP tools/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /open threats are closed or accepted/i
  );
  assert.match(
    contract.skillInputs.effective.join("\n"),
    /skills\/blueprint-review\/references\/secure-phase-runtime-contract\.md/i
  );
  assert.match(referenceFile, /## Visible Security Progress/);
  assert.match(
    referenceFile,
    /resolve security phase[\s\S]*load saved threat evidence[\s\S]*build threat gate[\s\S]*verify declared threats[\s\S]*persist security model[\s\S]*validate threat register[\s\S]*route after threat closure/i
  );
  assert.match(
    referenceFile,
    /Gemini-native progress helpers are presentation mirrors only[\s\S]*do not\s+expand the MCP tool allowlist, persistence authority, auditor authority,\s+threat-register authority, risk-acceptance authority, validation authority, or\s+routing authority/i
  );
  assert.match(
    referenceFile,
    /Emit exceptional updates for missing summaries, pending plans, missing\s+or weak threat model evidence, overwrite waits/i
  );
});

test("secure-phase local runtime contract locks retained threat verification behavior", async () => {
  const runtimeContract = await readFile(
    path.join(repoRoot, "skills/blueprint-review/references/secure-phase-runtime-contract.md"),
    "utf8"
  );

  for (const stage of ["Resolve", "Read", "Decide", "Execute", "Persist", "Validate", "Route"]) {
    assert.match(runtimeContract, new RegExp(`### ${stage}`));
  }

  assert.match(
    runtimeContract,
    /Repo-wide derived progress\/state may still surface saved[\s\S]*`\/blu-code-review-fix <phase>` after[\s\S]*`\/blu-secure-phase` itself must not emit that action\./
  );

  for (const tool of [
    "mcp_blueprint_blueprint_phase_locate",
    "mcp_blueprint_blueprint_artifact_list",
    "mcp_blueprint_blueprint_phase_plan_index",
    "mcp_blueprint_blueprint_phase_plan_read",
    "mcp_blueprint_blueprint_phase_summary_index",
    "mcp_blueprint_blueprint_phase_summary_read",
    "mcp_blueprint_blueprint_phase_execution_targets",
    "mcp_blueprint_blueprint_artifact_contract_read",
    "mcp_blueprint_blueprint_review_authoring_context",
    "mcp_blueprint_blueprint_review_validate_model",
    "mcp_blueprint_blueprint_review_record"
  ]) {
    assert.match(runtimeContract, new RegExp(tool));
  }

  assert.match(runtimeContract, /State A: existing `XX-SECURITY\.md` exists/i);
  assert.match(runtimeContract, /State B: no security artifact exists, but plans and summaries exist/i);
  assert.match(runtimeContract, /State C: execution summaries are missing/i);
  assert.match(runtimeContract, /Parse the saved threat model from plan evidence/i);
  assert.match(runtimeContract, /`## Threat Flags`/);
  assert.match(runtimeContract, /Build a bounded threat register from saved plan threats only/i);
  assert.match(runtimeContract, /threat id, category, component, disposition, mitigation, current status,\s+and evidence/i);
  assert.match(runtimeContract, /same-named\s+`blueprint-security-auditor` tool/i);
  assert.match(runtimeContract, /bounded\s+mitigation-verification task packet/i);
  assert.match(runtimeContract, /SECURED/);
  assert.match(runtimeContract, /OPEN_THREATS/);
  assert.match(runtimeContract, /ESCALATE/);
  assert.match(runtimeContract, /## No-Subagent Fallback/);
  assert.match(runtimeContract, /Verify one declared threat at a time/i);
  assert.match(runtimeContract, /Run a final threat-count consistency pass before persistence/i);
  assert.match(runtimeContract, /repair once against `review\.security`, the narrowed task schema, and\s+returned diagnostics/i);
  assert.match(runtimeContract, /Persistence happens only through `blueprint_review_record`/i);
});
