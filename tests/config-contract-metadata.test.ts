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

test("config baseline locks the reserved effectiveness-spine keys and enum values", async () => {
  const baselineDoc = await readFile(
    path.join(repoRoot, "docs/COMMAND-BASELINE.md"),
    "utf8"
  );

  for (const { key, values } of reservedKeyAssertions) {
    const expectedLine = new RegExp(`- \`${key.replace(".", "\\.")}\`: \`${values.join(" \\| ")}\``);
    assert.match(baselineDoc, expectedLine);
  }

  assert.match(
    baselineDoc,
    /must not surface them as writable or persisted until the dedicated runtime slice lands/i
  );
});

test("artifact schema documents the reserved config additions without claiming current runtime support", async () => {
  const schemaDoc = await readFile(
    path.join(repoRoot, "docs/ARTIFACT-SCHEMA.md"),
    "utf8"
  );

  assert.match(schemaDoc, /Reserved config contract additions for the effectiveness spine/i);
  assert.match(schemaDoc, /current runtime does not read or persist them yet/i);
  assert.match(schemaDoc, /Until `S8\.2` lands, they should not appear in normalized config output/i);

  for (const { key, values } of reservedKeyAssertions) {
    assert.match(schemaDoc, new RegExp(`\`${key.replace(".", "\\.")}\``));
    for (const value of values) {
      assert.match(schemaDoc, new RegExp(`\`${value}\``));
    }
  }
});

test("settings docs keep the reserved config keys documented but unavailable before runtime support", async () => {
  const settingsDoc = await readFile(
    path.join(repoRoot, "docs/commands/settings.md"),
    "utf8"
  );

  for (const { key } of reservedKeyAssertions) {
    assert.match(settingsDoc, new RegExp(key.replace(".", "\\.")));
  }

  assert.match(settingsDoc, /documented contract-only in `S8\.1`/i);
  assert.match(settingsDoc, /do not offer or persist them through `\/blu-settings` until runtime support lands/i);
  assert.match(settingsDoc, /config contract is documented but the runtime write path is not shipped/i);
  assert.match(settingsDoc, /documented but not yet writable instead of fabricating persistence/i);
});
