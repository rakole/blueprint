import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildGeneratedCommandRegistry } from "../scripts/generate-command-registry.js";

function readerWith(overrides: Record<string, string | null>) {
  return async (relative: string): Promise<string | null> => {
    if (relative in overrides) return overrides[relative];
    return readFile(path.join(process.cwd(), relative), "utf8");
  };
}

test("registry generation rejects an invalid root outside direct catalog rows", async () => {
  await assert.rejects(
    buildGeneratedCommandRegistry(readerWith({ "commands/blu.md": "invalid root" })),
    /Invalid root router assets/
  );
});

test("registry root requires the primary agent and native router skill", async () => {
  await assert.rejects(
    buildGeneratedCommandRegistry(readerWith({ "agents/blueprint.md": null })),
    /Invalid root router assets/
  );
  await assert.rejects(
    buildGeneratedCommandRegistry(readerWith({ "skills/blueprint-router/SKILL.md": null })),
    /Missing required blueprint-router skill/
  );
});

test("registry generation validates root skill metadata rather than presence alone", async () => {
  await assert.rejects(
    buildGeneratedCommandRegistry(readerWith({ "skills/blueprint-router/SKILL.md": "invalid skill" })),
    /expected YAML frontmatter/
  );
});
