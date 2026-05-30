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
  const [settingsCommand, settingsReference] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-settings.toml"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-governance/references/settings-runtime-contract.md"
      ),
      "utf8"
    )
  ]);

  assert.match(settingsCommand, /`workflow\.subagents`/);
  assert.match(
    settingsReference,
    /`workflow\.subagents` persists at `workflow\.subagents` in `\.blueprint\/config\.json`[\s\S]*defaults\.json/i
  );
  assert.match(
    settingsReference,
    /does not hide agent entries, change agent catalog visibility, or change implemented-command routing/i
  );
});

test("artifact schema documents workflow.no_uat as UAT optionality rather than command removal", async () => {
  const [settingsCommand, settingsReference] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-settings.toml"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-governance/references/settings-runtime-contract.md"
      ),
      "utf8"
    )
  ]);

  assert.match(settingsCommand, /`workflow\.no_uat`/);
  assert.match(settingsReference, /`workflow\.no_uat` defaults to `false`/);
  assert.match(settingsReference, /Setting it to `true` makes missing UAT evidence optional for lifecycle routing and phase closeout after PASS verification/i);
  assert.match(settingsReference, /`\/blu-verify-work` remains explicitly runnable/i);
  assert.match(settingsReference, /quality gates still block completion/i);
});

test("settings docs describe workflow.subagents as fallback policy rather than visibility or routing control", async () => {
  const [settingsCommand, settingsReference] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-settings.toml"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-governance/references/settings-runtime-contract.md"
      ),
      "utf8"
    )
  ]);

  assert.match(settingsCommand, /`workflow\.subagents`/);
  assert.match(
    settingsReference,
    /workflow\.subagents.*disables optional Blueprint subagent invocation/i
  );
  assert.match(settingsReference, /no-subagent fallback/i);
  assert.match(settingsReference, /does not hide agent entries/i);
  assert.match(settingsReference, /does not .*change agent catalog visibility/i);
  assert.match(settingsReference, /does not .*implemented-command routing/i);
});

test("settings docs describe workflow.no_uat as lifecycle optionality with manual UAT preserved", async () => {
  const [settingsCommand, settingsReference] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-settings.toml"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-governance/references/settings-runtime-contract.md"
      ),
      "utf8"
    )
  ]);

  assert.match(settingsCommand, /`workflow\.no_uat`/);
  assert.match(settingsReference, /workflow\.no_uat.*defaults to `false`/i);
  assert.match(settingsReference, /missing UAT evidence optional/i);
  assert.match(
    settingsReference,
    /\/blu-verify-work.*explicitly runnable|\/blu-verify-work.*manually runnable/i
  );
  assert.match(settingsReference, /quality gates still block completion/i);
});
