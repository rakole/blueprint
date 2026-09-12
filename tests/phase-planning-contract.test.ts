import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
const root = process.cwd();
const contract = readFileSync(path.join(root, "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"), "utf8").replace(/\s+/g, " ");
const recovery = readFileSync(path.join(root, "skills/blueprint-phase-planning/references/plan-phase-recovery.md"), "utf8").replace(/\s+/g, " ");

test("planning lifecycle preserves its functional gates and useful execution handoff", () => {
  for (const phrase of [
    "Planning Investigation Trace", "locked constraints", "evidence gaps",
    "add, revise or replace", "Preserve unselected plans",
    "explicit overwrite authorization", "missing XX-SPEC.md as nonblocking",
    "Honor all effective config gates", "workflow.plan_check",
    "mechanically checkable acceptance criteria", "vertical slices",
    "Preserve locked decisions at full fidelity", "external services",
    "no-subagent fallback", "Downstream Execution Handoff",
    "plan IDs, wave order and task summary", "verification priorities", "implemented next action"
  ]) assert.ok(contract.includes(phrase), phrase);
});

test("candidate preservation precedes semantic review and publication", () => {
  assert.match(contract, /Submit the entire candidate[\s\S]*before semantic review/);
  assert.match(contract, /saves the exact original before parsing\/validation/);
  assert.match(contract, /Raw JSON text and incomplete objects are recoverable/);
  assert.match(contract, /Field corrections create a new revision/);
  assert.match(contract, /retry identical arguments with the same requestId/);
  assert.match(contract, /Any candidate edit invalidates the prior verdict/);
  assert.match(contract, /revision and candidateHash, verdict and concrete summary/);
  assert.match(contract, /existing accepted plans remain intact/);
  assert.match(contract, /pending publication marker blocks readers\/execution/);
  assert.match(contract, /Candidate saved\/valid is insufficient/);
});

test("normal planning uses one compact schema and deterministic compilation", () => {
  assert.match(contract, /do not repeat primitive MCP reads/);
  assert.match(contract, /MCP derives numeric plan slots, dependency waves, aggregate file lists and coverage ledgers/);
  assert.match(contract, /unreferenced inventory must not acquire invented usage/);
  assert.match(contract, /Reading excluded code and documenting deferrals are not scope breaches/);
  assert.match(contract, /Prefer one review and one targeted repair/);
  assert.match(contract, /perform an explicit inline review and report that fallback honestly/);
  assert.doesNotMatch(contract, /returnNextAuthoringContext|blueprint_phase_plan_write|blueprint_phase_plan_validate_model/);
});

test("recovery guidance is on-demand and retains freshness and publication gates", () => {
  assert.match(contract, /See .plan-phase-recovery\.md. only when/);
  assert.match(contract, /Changed evidence must be acknowledged and reconciled/);
  assert.match(recovery, /expectedRevision/);
  assert.match(recovery, /requestId/);
  assert.match(recovery, /overwrite/);
  assert.match(recovery, /partial/i);
});
