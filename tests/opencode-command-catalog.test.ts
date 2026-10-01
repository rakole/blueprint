import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  validateBlueprintCommandDefinitionContent,
  validateBundledBlueprintCommandDefinition
} from "../src/mcp/command-definition.js";
import { blueprintCommandDefinitionPath } from "../src/mcp/command-paths.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

async function readRelativePath(relativePath: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(repoRoot, relativePath), "utf8");
  } catch {
    return null;
  }
}

function bundledRelativePath(value: unknown): string | null {
  const normalized = value instanceof URL ? value.pathname : path.resolve(String(value));
  const relativePath = path.relative(repoRoot, normalized).split(path.sep).join("/");
  return relativePath.startsWith("../") ? null : relativePath;
}

test("all 56 native command definitions use strict primary routing and one literal argument token", async () => {
  const commandFiles = (await fs.readdir(path.join(repoRoot, "commands")))
    .filter((file) => /^blu(?:-[a-z0-9-]+)?\.md$/.test(file))
    .sort();

  assert.equal(commandFiles.length, 56);
  assert.ok(commandFiles.includes("blu.md"));
  assert.equal(commandFiles.includes("blu-do.md"), false);

  for (const file of commandFiles) {
    const commandName = file === "blu.md" ? "blu" : file.slice(4, -3);
    const validation = await validateBundledBlueprintCommandDefinition(
      commandName,
      readRelativePath
    );
    assert.equal(validation.relativePath, blueprintCommandDefinitionPath(commandName));
    assert.equal(validation.valid, true, validation.issues.join("\n"));
  }
});

test("implemented commands load their primary native skill once without duplicating the active command input", async () => {
  const catalog = await blueprintCommandCatalog();
  for (const [commandName, entry] of Object.entries(catalog.commands)) {
    if (!entry.implemented) continue;
    const content = await readRelativePath(blueprintCommandDefinitionPath(commandName));
    assert.ok(content);
    const phrase = `Load the native \`${entry.primarySkill}\` skill exactly once`;
    assert.equal(content.split(phrase).length - 1, 1, commandName);
  }

  const root = await readRelativePath(blueprintCommandDefinitionPath("blu"));
  assert.ok(root);
  assert.equal(root.split("Load the native `blueprint-router` skill exactly once").length - 1, 1);
});

test("native command semantics preserve task checkpoints, private dispatch, and execute control-plane isolation", async () => {
  const codeReview = await readRelativePath("commands/blu-code-review.md");
  const codeReviewFix = await readRelativePath("commands/blu-code-review-fix.md");
  const help = await readRelativePath("commands/blu-help.md");
  const root = await readRelativePath("commands/blu.md");
  const execute = await readRelativePath("commands/blu-execute-phase.md");
  for (const content of [codeReview, codeReviewFix]) {
    assert.ok(content);
    assert.match(content, /standalone `--feels-like-god` flag token/);
    assert.match(content, /exact `subagent_type`/);
    assert.match(content, /returned `task_id`[\s\S]*evidence is fresh/);
  }
  assert.doesNotMatch(help ?? "", /feels-like-god|god-review/i);
  assert.doesNotMatch(root ?? "", /feels-like-god|god-review/i);
  assert.doesNotMatch(execute ?? "", /blueprint-executor|`task`|task_id/);
  assert.match(execute ?? "", /execution_prepare[\s\S]*execution_apply[\s\S]*execution_verify[\s\S]*execution_finalize/);
});

test("native command validation rejects malformed frontmatter, routing drift, empty bodies, and duplicate arguments", () => {
  const fixtures = [
    "# no frontmatter\n$ARGUMENTS\n",
    "---\ndescription: fixture\nagent: other\nsubtask: false\n---\nBody $ARGUMENTS\n",
    "---\ndescription: fixture\nagent: blueprint\nsubtask: true\n---\nBody $ARGUMENTS\n",
    "---\ndescription: fixture\nagent: blueprint\nsubtask: false\n---\n",
    "---\ndescription: fixture\nagent: blueprint\nsubtask: false\n---\n$ARGUMENTS $ARGUMENTS\n",
    "---\ndescription: fixture\nagent: blueprint\nsubtask: false\nmodel: forced\n---\nBody $ARGUMENTS\n"
  ];

  for (const fixture of fixtures) {
    const validation = validateBlueprintCommandDefinitionContent("help", fixture);
    assert.equal(validation.valid, false, fixture);
  }
});

test("catalog blocks malformed native commands and required primary definitions", async (t) => {
  const realReadFile = fs.readFile.bind(fs);
  t.mock.method(fs, "readFile", async (filePath, options) => {
    const relativePath = bundledRelativePath(filePath);
    if (relativePath === "commands/blu-help.md") {
      return "---\ndescription: broken\nagent: blueprint\nsubtask: true\n---\n$ARGUMENTS\n";
    }
    if (relativePath === "agents/blueprint.md") {
      return "---\ndescription: broken\nmode: subagent\nsteps: 1\npermission:\n  \"*\": deny\n---\nBody\n";
    }
    return realReadFile(
      filePath as Parameters<typeof fs.readFile>[0],
      options as Parameters<typeof fs.readFile>[1]
    );
  });

  const catalog = await blueprintCommandCatalog();
  assert.equal(catalog.commands.help.implemented, false);
  assert.equal(catalog.commands.help.manifestPath, null);
  assert.match(catalog.commands.help.blockedBy.join("\n"), /subtask|Invalid required primary/);
  assert.equal(catalog.commands.progress.implemented, false);
  assert.match(catalog.commands.progress.blockedBy.join("\n"), /Invalid required primary/);
});

test("an invalid optional specialist is omitted without blocking inline command availability", async (t) => {
  const realReadFile = fs.readFile.bind(fs);
  t.mock.method(fs, "readFile", async (filePath, options) => {
    const relativePath = bundledRelativePath(filePath);
    if (relativePath === "agents/blueprint-mapper.md") {
      return "---\ndescription: invalid\nmode: primary\nsteps: 1\npermission:\n  \"*\": deny\n---\nBody\n";
    }
    return realReadFile(
      filePath as Parameters<typeof fs.readFile>[0],
      options as Parameters<typeof fs.readFile>[1]
    );
  });

  const entry = (await blueprintCommandCatalog()).commands["map-codebase"];
  assert.equal(entry.implemented, true);
  assert.deepEqual(entry.optionalAgents, ["blueprint-mapper"]);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);
});
