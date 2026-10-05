import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parseNativeMarkdown } from "../src/shared/native-frontmatter.js";
import { loadBlueprintSkillInputs } from "../src/mcp/skill-metadata.js";

const repoRoot = process.cwd();

async function readRelativePath(relativePath: string): Promise<string | null> {
  try {
    return await readFile(path.join(repoRoot, relativePath), "utf8");
  } catch {
    return null;
  }
}

test("all 17 native skills validate and their active bundle closure exists", async () => {
  const skillNames = (await readdir(path.join(repoRoot, "skills"))).sort();
  assert.equal(skillNames.length, 17);

  for (const skillName of skillNames) {
    const relativePath = `skills/${skillName}/SKILL.md`;
    const raw = await readFile(path.join(repoRoot, relativePath), "utf8");
    const { frontmatter, body } = parseNativeMarkdown(raw, relativePath);
    assert.equal(frontmatter.name, skillName);
    assert.equal(typeof frontmatter.description, "string");
    assert.equal(frontmatter.status, "implemented");
    assert.match(body, /## Native Invocation Guard/);

    const commands = (frontmatter.commands ?? []) as string[];
    for (const command of commands) {
      const inputs = await loadBlueprintSkillInputs(skillName, command, readRelativePath);
      assert.equal(inputs.skill, skillName);
      assert.equal(inputs.effective.some((input) => input.endsWith(".toml")), false);
      assert.equal(inputs.effective.some((input) => input === commandAsset(command)), false);
    }
  }
});

test("the packaged skill tree retains exactly 54 adjacent reference files", async () => {
  let references = 0;
  for (const skillName of await readdir(path.join(repoRoot, "skills"))) {
    const referencesDir = path.join(repoRoot, "skills", skillName, "references");
    try {
      const entries = await readdir(referencesDir, { withFileTypes: true });
      references += entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).length;
    } catch {
      // Skills without adjacent references are valid.
    }
  }
  assert.equal(references, 54);
});

test("private helper keeps its exact command, flag, and trusted plugin gate", async () => {
  const raw = await readFile(
    path.join(repoRoot, "skills/blueprint-god-review/SKILL.md"),
    "utf8",
  );
  assert.match(raw, /trusted plugin dispatch gate/);
  assert.match(raw, /`\/blu-code-review` or `\/blu-code-review-fix`/);
  assert.match(raw, /standalone `--feels-like-god` token/);
  assert.match(raw, /Public help and routing must not advertise/);
});

test("ordinary skills reject synthesized skill aliases before activity", async () => {
  for (const skillName of await readdir(path.join(repoRoot, "skills"))) {
    if (skillName === "blueprint-god-review") continue;
    const raw = await readFile(path.join(repoRoot, "skills", skillName, "SKILL.md"), "utf8");
    assert.match(raw, /synthesized `\/blueprint-\*` alias/);
    assert.match(raw, /stop before tool, MCP, resource, or filesystem activity/);
    assert.match(raw, /direct the user to `\/blu-help`/);
  }
});

function commandAsset(command: string): string {
  return command === "/blu" ? "commands/blu.md" : `commands/${command.slice(1)}.md`;
}
