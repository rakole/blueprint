import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

function extractBacktickedValues(
  markdown: string,
  pattern: RegExp,
  label: string
): string[] {
  const match = markdown.match(pattern);
  assert.ok(match, `Missing shared contract line for ${label}`);

  const normalizedLine = match[1]
    .replace(/^`<one of:\s*/, "")
    .replace(/>`$/, "");
  const values = [...normalizedLine.matchAll(/`([^`]+)`/g)].map((entry) => entry[1]);
  assert.ok(values.length > 0, `Missing shared contract values for ${label}`);

  return values;
}

function extractCommaSeparatedValues(
  markdown: string,
  pattern: RegExp,
  label: string
): string[] {
  const match = markdown.match(pattern);
  assert.ok(match, `Missing shared contract line for ${label}`);

  const values = match[1]
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  assert.ok(values.length > 0, `Missing shared contract values for ${label}`);

  return values;
}

const executionProfileValues = [
  "router",
  "interactive-read",
  "long-running-mutation",
  "high-risk-maintenance"
];
const stageValues = ["Resolve", "Read", "Decide", "Execute", "Persist", "Validate", "Route"];
test("shared effectiveness-spine metadata stays aligned between the template and runtime reference", async () => {
  const [templateDoc, runtimeRefDoc] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/_template.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  const templateProfiles = extractBacktickedValues(
    templateDoc,
    /^\| Execution profile \| (.+) \|$/m,
    "command template execution profile"
  );
  const runtimeProfiles = extractBacktickedValues(
    runtimeRefDoc,
    /^- Execution profiles: (.+)$/m,
    "runtime reference execution profiles"
  );
  assert.deepEqual(templateProfiles, runtimeProfiles, "Execution profile vocabulary drifted");

  const templateStages = extractBacktickedValues(
    templateDoc,
    /^- Stage vocabulary: (.+)$/m,
    "command template stage vocabulary"
  );
  const runtimeStages = extractBacktickedValues(
    runtimeRefDoc,
    /^- Stage vocabulary: (.+)$/m,
    "runtime reference stage vocabulary"
  );
  assert.deepEqual(templateStages, runtimeStages, "Stage vocabulary drifted");

  const templateStatusFields = extractCommaSeparatedValues(
    templateDoc,
    /^- In-flight status fields: (.+)$/m,
    "command template in-flight status fields"
  );
  const runtimeStatusFields = extractCommaSeparatedValues(
    runtimeRefDoc,
    /^- In-flight status fields: (.+)$/m,
    "runtime reference in-flight status fields"
  );
  assert.deepEqual(
    templateStatusFields,
    runtimeStatusFields,
    "In-flight status fields drifted"
  );

  assert.deepEqual(templateProfiles, [
    "router",
    "interactive-read",
    "long-running-mutation",
    "high-risk-maintenance"
  ]);
  assert.deepEqual(templateStages, [
    "Resolve",
    "Read",
    "Decide",
    "Execute",
    "Persist",
    "Validate",
    "Route"
  ]);
  assert.deepEqual(templateStatusFields, [
    "resolved scope",
    "active stage",
    "pending gate",
    "execution mode",
    "next safe action"
  ]);
});
