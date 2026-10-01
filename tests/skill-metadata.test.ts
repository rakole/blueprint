import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  loadBlueprintSkillInputs,
  resolveBlueprintSkillInputsFromContent,
} from "../src/mcp/skill-metadata.js";

const repoRoot = process.cwd();

async function readRelativePath(relativePath: string): Promise<string | null> {
  try {
    return await readFile(path.join(repoRoot, relativePath), "utf8");
  } catch {
    return null;
  }
}

test("native skill metadata returns only active references and skips the supplied command", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-review",
    "/blu-code-review",
    readRelativePath,
  );

  assert.deepEqual(inputs.shared, []);
  assert.deepEqual(inputs.commandSpecific, [
    "commands/blu-code-review.md",
    "skills/blueprint-review/references/code-review-runtime-contract.md",
  ]);
  assert.deepEqual(inputs.effective, [
    "skills/blueprint-review/references/code-review-runtime-contract.md",
  ]);
  assert.equal(inputs.effective.some((input) => input.includes("code-review-fix")), false);
});

test("manifest-only bundles do not reread the active native command", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-router",
    "/blu-help",
    readRelativePath,
  );

  assert.deepEqual(inputs.commandSpecific, ["commands/blu-help.md"]);
  assert.deepEqual(inputs.effective, []);
});

test("unknown command keys do not preload sibling or recovery references", async () => {
  const raw = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-discovery/SKILL.md"),
    "utf8",
  );
  const inputs = resolveBlueprintSkillInputsFromContent(
    "blueprint-phase-discovery",
    "/blu-unknown-discovery-command",
    raw,
  );

  assert.deepEqual(inputs.shared, []);
  assert.deepEqual(inputs.commandSpecific, []);
  assert.deepEqual(inputs.effective, []);
});

test("private god-review has no public active input bundle", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-god-review",
    "/blu-code-review",
    readRelativePath,
  );

  assert.deepEqual(inputs, {
    skill: "blueprint-god-review",
    shared: [],
    commandSpecific: [],
    effective: [],
  });
});

test("native parser rejects duplicate YAML keys", () => {
  assert.throws(
    () => resolveBlueprintSkillInputsFromContent(
      "blueprint-test",
      "/blu-test",
      "---\nname: blueprint-test\nname: duplicate\ndescription: test\n---\nbody\n",
    ),
    /keys must be unique/i,
  );
});

test("skill metadata rejects unsupported keys, wrong types, and unrecognized bundle commands", () => {
  assert.throws(
    () => resolveBlueprintSkillInputsFromContent(
      "blueprint-test",
      "/blu-test",
      "---\nname: blueprint-test\ndescription: test\nextra: nope\n---\n",
    ),
    /unsupported frontmatter key/,
  );
  assert.throws(
    () => resolveBlueprintSkillInputsFromContent(
      "blueprint-test",
      "/blu-test",
      "---\nname: blueprint-test\ndescription: test\ncommands: /blu-test\n---\n",
    ),
    /commands must be an array of strings/,
  );
  assert.throws(
    () => resolveBlueprintSkillInputsFromContent(
      "blueprint-test",
      "/blu-test",
      "---\nname: blueprint-test\ndescription: test\ncommands: [/blu-test]\ninput_bundles:\n  shared: []\n  commands:\n    /blu-other: []\n---\n",
    ),
    /unrecognized command key/,
  );
});

test("skill metadata rejects duplicate input values and package traversal", () => {
  assert.throws(
    () => resolveBlueprintSkillInputsFromContent(
      "blueprint-test",
      "/blu-test",
      "---\nname: blueprint-test\ndescription: test\ncommands: [/blu-test]\ninput_bundles:\n  shared: [skills/a.md, skills/a.md]\n  commands: {}\n---\n",
    ),
    /must not contain duplicates/,
  );
  assert.throws(
    () => resolveBlueprintSkillInputsFromContent(
      "blueprint-test",
      "/blu-test",
      "---\nname: blueprint-test\ndescription: test\ncommands: [/blu-test]\ninput_bundles:\n  shared: [skills/../secret.md]\n  commands: {}\n---\n",
    ),
    /must stay within packaged/,
  );
});

test("loader rejects missing declared bundle paths", async () => {
  const skill = "---\nname: blueprint-test\ndescription: test\ncommands: [/blu-test]\ninput_bundles:\n  shared: []\n  commands:\n    /blu-test: [skills/blueprint-test/references/missing.md]\n---\n";
  await assert.rejects(
    loadBlueprintSkillInputs(
      "blueprint-test",
      "/blu-test",
      async (relativePath) => relativePath === "skills/blueprint-test/SKILL.md" ? skill : null,
    ),
    /input bundle path is missing/,
  );
});

test("loader uses one canonical skill file and has no legacy single-file fallback", async () => {
  const reads: string[] = [];
  const result = await loadBlueprintSkillInputs(
    "blueprint-router",
    "/blu",
    async (relativePath) => {
      reads.push(relativePath);
      return null;
    },
  );

  assert.deepEqual(reads, ["skills/blueprint-router/SKILL.md"]);
  assert.deepEqual(result.effective, []);
});

test("preferred native path remains supported", async () => {
  const raw = await readFile(
    path.join(repoRoot, "skills/blueprint-router/SKILL.md"),
    "utf8",
  );
  const reads: string[] = [];
  const result = await loadBlueprintSkillInputs(
    "blueprint-router",
    "/blu",
    async (relativePath) => {
      reads.push(relativePath);
      if (relativePath === "skills/blueprint-router/custom.md") return raw;
      if (relativePath === "commands/blu.md") return "present";
      return null;
    },
    "skills/blueprint-router/custom.md",
  );

  assert.deepEqual(reads, ["skills/blueprint-router/custom.md", "commands/blu.md"]);
  assert.deepEqual(result.effective, []);
});
