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
    /`S8\.2` adds runtime normalization, defaults precedence, and persistence through the existing config MCP path/i
  );
});

test("artifact schema documents the effectiveness-spine config additions as current runtime behavior", async () => {
  const schemaDoc = await readFile(
    path.join(repoRoot, "docs/ARTIFACT-SCHEMA.md"),
    "utf8"
  );

  assert.match(schemaDoc, /"ux": \{/);
  assert.match(schemaDoc, /"orchestration": \{/);
  assert.match(schemaDoc, /"research": \{/);
  assert.match(schemaDoc, /`S8\.2` adds runtime normalization and persistence through the existing config MCP tools/i);
  assert.match(schemaDoc, /Older project configs that omit these keys still inherit them from saved defaults or hardcoded defaults/i);

  for (const { key, values } of reservedKeyAssertions) {
    assert.match(schemaDoc, new RegExp(`\`${key.replace(".", "\\.")}\``));
    for (const value of values) {
      assert.match(schemaDoc, new RegExp(`\`${value}\``));
    }
  }
});

test("settings docs keep the effectiveness-spine keys on the normal config path without forcing them into the common pass", async () => {
  const settingsDoc = await readFile(
    path.join(repoRoot, "docs/commands/settings.md"),
    "utf8"
  );

  for (const { key } of reservedKeyAssertions) {
    assert.match(settingsDoc, new RegExp(key.replace(".", "\\.")));
  }

  assert.match(settingsDoc, /now normalize and persist through the same config MCP path as other settings/i);
  assert.match(settingsDoc, /effective config should still inherit them from saved defaults or hardcoded defaults/i);
  assert.match(settingsDoc, /Keep the common settings pass stable; do not force the effectiveness-spine keys into that first pass/i);
  assert.match(settingsDoc, /write them through the documented config MCP path instead of inventing a separate persistence flow/i);
});
