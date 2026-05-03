import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

const reservedKeyAssertions = [
  {
    key: "ux.progress_mode",
    values: ["quiet", "stage", "checklist"]
  },
  {
    key: "ux.structured_confirmations",
    values: ["auto", "required"]
  },
  {
    key: "ux.user_checkpoints",
    values: ["off", "phase", "plan"]
  },
  {
    key: "orchestration.task_tracker",
    values: ["off", "auto"]
  },
  {
    key: "research.external_sources",
    values: ["off", "ask", "auto"]
  }
] as const;

test("settings runtime reference locks effectiveness-spine keys and persistence path", async () => {
  const settingsReference = await readFile(
    path.join(
      repoRoot,
      "skills/blueprint-governance/references/settings-runtime-contract.md"
    ),
    "utf8"
  );

  for (const { key, values } of reservedKeyAssertions) {
    const expectedLine = new RegExp(
      `- \`${key.replace(".", "\\.")}\`: \`${values.join(" \\| ")}\``
    );
    assert.match(settingsReference, expectedLine);
  }

  assert.match(settingsReference, /inherit from saved defaults when present, otherwise from hardcoded defaults/i);
  assert.match(settingsReference, /Keep the common settings pass stable/i);
  assert.match(settingsReference, /do not force these keys into the first settings pass/i);
  assert.match(settingsReference, /normal `mcp_blueprint_blueprint_config_set` JSON-object `patch` path/i);
  assert.match(settingsReference, /Project settings writes go only through `mcp_blueprint_blueprint_config_set` with `scope: "project"`/i);
  assert.match(settingsReference, /Saved defaults writes go only through `mcp_blueprint_blueprint_config_set` with `scope: "defaults"` after explicit opt-in/i);
  assert.match(settingsReference, /Patches must be JSON objects/i);
  assert.match(settingsReference, /Do not write config files directly/i);
});

test("source-owned config behavior keeps effectiveness-spine defaults and enum guards", async () => {
  const configSource = await readFile(
    path.join(repoRoot, "src/mcp/tools/config.ts"),
    "utf8"
  );

  for (const { key, values } of reservedKeyAssertions) {
    const [group, name] = key.split(".");
    assert.match(configSource, new RegExp(`${name}: "${values[0]}"`));
    assert.match(configSource, new RegExp(`fullPath === "${group}\\.${name}"`));
    for (const value of values) {
      assert.match(configSource, new RegExp(`"${value}"`));
    }
  }

  assert.match(configSource, /function getHardCodedConfig\(\)/);
  assert.match(configSource, /export async function blueprintConfigSet\(/);
});
