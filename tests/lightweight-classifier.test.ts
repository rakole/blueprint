import assert from "node:assert/strict";
import test from "node:test";

import { classifyLightweightScope } from "../src/mcp/lightweight-classifier.js";

test("blank task routes to clarify", () => {
  const result = classifyLightweightScope({
    mode: "quick",
    taskText: "",
  });

  assert.equal(result.route, "clarify");
  assert.equal(result.validationBudget, "ask");
  assert.deepEqual(result.allowedWrites, []);
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.requiredGates, ["task-clarity"]);
  assert.match(result.reasons.join(" "), /blank/i);
});

test("fast mode keeps tiny README typo work on fast", () => {
  const result = classifyLightweightScope({
    mode: "fast",
    taskText: "fix typo in README",
  });

  assert.equal(result.route, "fast");
  assert.equal(result.validationBudget, "none");
  assert.deepEqual(result.allowedWrites, [
    "repo files",
    ".blueprint/STATE.md through blueprint_state_update",
  ]);
  assert.equal(result.confidence, "high");
  assert.match(result.reasons.join(" "), /trivial text or docs edit/i);
});

test("fast mode reroutes bounded multi-file work to quick", () => {
  const result = classifyLightweightScope({
    mode: "fast",
    taskText: "rename env var and update focused tests",
  });

  assert.equal(result.route, "quick");
  assert.equal(result.validationBudget, "cheap");
  assert.deepEqual(result.allowedWrites, [
    "repo files",
    "quick-run-latest through blueprint_artifact_report_write",
    ".blueprint/STATE.md through blueprint_state_update",
  ]);
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.requiredGates, ["cheap-validation"]);
  assert.match(result.reasons.join(" "), /reroute bounded non-trivial work to quick/i);
});

test("fast mode flag disqualifiers reroute tiny tasks away from fast", () => {
  for (const flagName of ["discuss", "research", "full"] as const) {
    const result = classifyLightweightScope({
      mode: "fast",
      taskText: "fix typo in README",
      flags: { [flagName]: true },
    });

    assert.equal(result.route, "quick");
    assert.equal(result.validationBudget, "cheap");
    assert.deepEqual(result.allowedWrites, [
      "repo files",
      "quick-run-latest through blueprint_artifact_report_write",
      ".blueprint/STATE.md through blueprint_state_update",
    ]);
    assert.equal(result.confidence, "high");
    assert.deepEqual(result.requiredGates, []);
  }
});

test("investigation work routes to debug", () => {
  const result = classifyLightweightScope({
    mode: "quick",
    taskText: "investigate failing auth test",
  });

  assert.equal(result.route, "debug");
  assert.equal(result.validationBudget, "ask");
  assert.deepEqual(result.allowedWrites, []);
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.requiredGates, ["issue-statement"]);
  assert.match(result.reasons.join(" "), /investigation-oriented/i);
});

test("architecture refactors route to plan-phase", () => {
  const result = classifyLightweightScope({
    mode: "quick",
    taskText: "refactor checkout architecture",
  });

  assert.equal(result.route, "plan-phase");
  assert.equal(result.validationBudget, "route");
  assert.deepEqual(result.allowedWrites, []);
  assert.equal(result.confidence, "high");
  assert.match(result.reasons.join(" "), /architectural/i);
});

test("broad migration work routes to plan-phase", () => {
  const result = classifyLightweightScope({
    mode: "quick",
    taskText: "migrate all commands to new schema",
  });

  assert.equal(result.route, "plan-phase");
  assert.equal(result.validationBudget, "route");
  assert.deepEqual(result.allowedWrites, []);
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.requiredGates, ["scope-review"]);
  assert.match(result.reasons.join(" "), /migration-oriented/i);
});

test("cross-surface quick requests route to plan-phase", () => {
  const result = classifyLightweightScope({
    mode: "quick",
    taskText: "update auth flow across frontend and backend",
  });

  assert.equal(result.route, "plan-phase");
  assert.equal(result.validationBudget, "route");
  assert.deepEqual(result.allowedWrites, []);
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.requiredGates, ["scope-review"]);
  assert.match(result.reasons.join(" "), /broad, architectural, or migration-oriented/i);
});

test("explicit health work routes to health", () => {
  const result = classifyLightweightScope({
    mode: "quick",
    taskText: "run a Blueprint health check for this repo",
  });

  assert.equal(result.route, "health");
  assert.equal(result.validationBudget, "route");
  assert.deepEqual(result.allowedWrites, []);
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.requiredGates, ["project-health"]);
  assert.match(result.reasons.join(" "), /health recovery/i);
});

test("explicit bootstrap work routes to new-project", () => {
  const result = classifyLightweightScope({
    mode: "quick",
    taskText: "initialize a new project for this repo",
  });

  assert.equal(result.route, "new-project");
  assert.equal(result.validationBudget, "route");
  assert.deepEqual(result.allowedWrites, [".blueprint/ bootstrap artifacts through MCP"]);
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.requiredGates, ["bootstrap-intent"]);
  assert.match(result.reasons.join(" "), /bootstrap or initialization/i);
});

test("non-project bootstrap work stays off new-project", () => {
  const result = classifyLightweightScope({
    mode: "quick",
    taskText: "bootstrap Tailwind config",
  });

  assert.notEqual(result.route, "new-project");
  assert.equal(result.route, "quick");
});

test("non-project initialize work stays off new-project", () => {
  const result = classifyLightweightScope({
    mode: "quick",
    taskText: "initialize test fixture helper",
  });

  assert.notEqual(result.route, "new-project");
  assert.equal(result.route, "quick");
});

test("explicit project bootstrap still routes to new-project", () => {
  const result = classifyLightweightScope({
    mode: "quick",
    taskText: "bootstrap the Blueprint workspace for this repo",
  });

  assert.equal(result.route, "new-project");
  assert.deepEqual(result.requiredGates, ["bootstrap-intent"]);
});

test("explicit saved-plan execution work routes to execute-phase", () => {
  const result = classifyLightweightScope({
    mode: "quick",
    taskText: "execute phase for the saved rollout plan",
  });

  assert.equal(result.route, "execute-phase");
  assert.equal(result.validationBudget, "route");
  assert.deepEqual(result.allowedWrites, ["phase execution summaries through MCP"]);
  assert.equal(result.confidence, "high");
  assert.deepEqual(result.requiredGates, ["saved-plan"]);
  assert.match(result.reasons.join(" "), /saved-plan or rollout execution/i);
});

test("unmatched lightweight task falls back to low-confidence clarify", () => {
  const result = classifyLightweightScope({
    mode: "quick",
    taskText: "synchronize nuance carefully",
  });

  assert.equal(result.route, "clarify");
  assert.equal(result.validationBudget, "ask");
  assert.deepEqual(result.allowedWrites, []);
  assert.equal(result.confidence, "low");
  assert.deepEqual(result.requiredGates, ["task-clarity"]);
  assert.match(result.reasons.join(" "), /does not match a safe deterministic lightweight route/i);
});
