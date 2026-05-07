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
  assert.match(configSource, /subagents: true/);
});

test("artifact schema documents workflow.subagents as workflow policy rather than host agent availability", async () => {
  const artifactSchema = await readFile(
    path.join(repoRoot, "docs/ARTIFACT-SCHEMA.md"),
    "utf8"
  );

  assert.match(artifactSchema, /"subagents": true/);
  assert.match(
    artifactSchema,
    /`workflow\.subagents` is the global optional-subagent workflow policy for Blueprint command orchestration/i
  );
  assert.match(
    artifactSchema,
    /it does not install host agents, change agent catalog availability, or widen routing/i
  );
});

test("settings docs describe workflow.subagents as fallback policy rather than visibility or routing control", async () => {
  const [settingsDoc, settingsReference] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/settings.md"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-governance/references/settings-runtime-contract.md"
      ),
      "utf8"
    )
  ]);

  for (const markdown of [settingsDoc, settingsReference]) {
    assert.match(
      markdown,
      /workflow\.subagents.*disables optional Blueprint subagent invocation/i
    );
    assert.match(markdown, /no-subagent fallback/i);
    assert.match(markdown, /does not hide agent entries/i);
    assert.match(markdown, /does not .*change agent catalog visibility/i);
    assert.match(markdown, /does not .*implemented-command routing/i);
  }
});
