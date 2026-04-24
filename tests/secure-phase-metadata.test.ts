import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("secure-phase manifest references the review tools, agent, and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-secure-phase.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-review` skill/);
  assert.match(
    commandFile,
    /skills\/blueprint-review\/references\/secure-phase-runtime-contract\.md/
  );
  assert.match(commandFile, /`blueprint-security-auditor` subagent/);
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
  assert.match(
    commandFile,
    new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read"))
  );
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
    /In-flight status fields for `secure-phase`: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /blueprint_phase_plan_index/);
  assert.match(skillFile, /blueprint_phase_plan_read/);
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
  assert.match(skillFile, /repair against the `review\.security` authoring template\s+and retry once/i);
  assert.match(skillFile, /do not emit next-step\s+routing while threats remain open/i);
  assert.match(skillFile, /\/blu-validate-phase/);
  assert.match(skillFile, /\/blu-progress/);
});

test("secure-phase docs and runtime reference describe the long-running security spine", async () => {
  const [docFile, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/secure-phase.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(docFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(
    docFile,
    /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    docFile,
    /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(docFile, /shared long-running-mutation posture/i);
  assert.match(docFile, /saved plan evidence only/i);
  assert.match(docFile, /`update_topic` tool and keep a compact threat-review checklist with `write_todos`/i);
  assert.match(docFile, /session-local visibility only/i);
  assert.match(docFile, /`pending-open-threat` waiting state/i);
  assert.match(docFile, /pending-open-threat status/i);
  assert.match(docFile, /do not emit next-step routing until that gate is cleared/i);

  assert.match(
    runtimeReference,
    /`secure-phase`[\s\S]*Long-running-mutation profile for phase-scoped threat verification/i
  );
  assert.match(
    runtimeReference,
    /`secure-phase`[\s\S]*resolved scope, active stage, pending gate, execution mode, and next safe action visible/i
  );
  assert.match(
    runtimeReference,
    /`secure-phase`[\s\S]*`update_topic` and `write_todos` for non-trivial secure-phase runs/i
  );
  assert.match(runtimeReference, /`secure-phase`[\s\S]*saved-plan threat model only/i);
  assert.match(
    runtimeReference,
    /`secure-phase`[\s\S]*verify-versus-accept decisions, or a visible `pending-open-threat` waiting state/i
  );
  assert.match(
    runtimeReference,
    /`secure-phase`[\s\S]*inline versus security-auditor-assisted verification/i
  );
  assert.match(
    runtimeReference,
    /`secure-phase`[\s\S]*pending-open-threat status explicit/i
  );
  assert.match(
    runtimeReference,
    /`secure-phase`[\s\S]*block next-step routing while threats remain open/i
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

  for (const tool of [
    "mcp_blueprint_blueprint_phase_locate",
    "mcp_blueprint_blueprint_artifact_list",
    "mcp_blueprint_blueprint_phase_plan_index",
    "mcp_blueprint_blueprint_phase_plan_read",
    "mcp_blueprint_blueprint_artifact_contract_read",
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
  assert.match(runtimeContract, /Use `blueprint-security-auditor` only as a bounded read-only mitigation\s+verifier/i);
  assert.match(runtimeContract, /SECURED/);
  assert.match(runtimeContract, /OPEN_THREATS/);
  assert.match(runtimeContract, /ESCALATE/);
  assert.match(runtimeContract, /## No-Subagent Fallback/);
  assert.match(runtimeContract, /Verify one declared threat at a time/i);
  assert.match(runtimeContract, /Run a final threat-count consistency pass before persistence/i);
  assert.match(runtimeContract, /repair once against `review\.security` headings/i);
  assert.match(runtimeContract, /Persistence happens only through `blueprint_review_record`/i);
});
