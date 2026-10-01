import test from "node:test";
import assert from "node:assert/strict";
import { lstat, readFile, readdir, readlink } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const promptRoots = ["agents", "commands", "skills"];

async function collectPromptFiles(relativeDir: string): Promise<string[]> {
  const files: string[] = [];

  for (const entry of await readdir(path.join(repoRoot, relativeDir), { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectPromptFiles(relativePath));
    } else if (entry.isFile() && path.extname(entry.name) === ".md") {
      files.push(relativePath);
    }
  }

  return files;
}

test("OpenCode prompt surfaces use the migrated tool vocabulary", async () => {
  const files = (await Promise.all(promptRoots.map(collectPromptFiles))).flat();
  const preservedModes = new Map([
    ["commands/blu-update.md", 'mode = "ask_user"'],
    ["skills/blueprint-maintenance/references/update-runtime-contract.md", 'mode = "ask_user"']
  ]);

  for (const relativePath of files) {
    let content = await readFile(path.join(repoRoot, relativePath), "utf8");
    const preservedMode = preservedModes.get(relativePath);

    if (preservedMode) {
      assert.equal(content.split(preservedMode).length - 1, 1, `${relativePath} preserves one backend mode`);
      content = content.replace(preservedMode, "");
    }

    assert.doesNotMatch(content, /mcp_blueprint_/i, relativePath);
    assert.doesNotMatch(
      content,
      /\b(list_directory|read_file|write_file|grep_search|run_shell_command|write_todos|update_topic|ask_user)\b/,
      relativePath
    );
    assert.doesNotMatch(content, /`type:\s*"choice"`|Type your own answer/, relativePath);
  }
});

test("OpenCode root guidance preserves the TABNINE symlink", async () => {
  const tabninePath = path.join(repoRoot, "TABNINE.md");

  assert.equal((await lstat(tabninePath)).isSymbolicLink(), true);
  assert.equal(await readlink(tabninePath), "GEMINI.md");
});

test("all three mutating call sites carry the pinned model-conditioned editing rule", async () => {
  const callSites = [
    "agents/blueprint-executor.md",
    "skills/blueprint-phase-execution/references/fast-runtime-contract.md",
    "skills/blueprint-phase-execution/references/quick-runtime-contract.md"
  ];

  for (const relativePath of callSites) {
    const content = await readFile(path.join(repoRoot, relativePath), "utf8");

    assert.match(content, /current executing model ID/i, relativePath);
    assert.match(content, /includes `gpt-` and contains neither `oss` nor `gpt-4`/, relativePath);
    assert.match(content, /use `apply_patch` for file creation and modification/, relativePath);
    assert.match(content, /otherwise use `edit` for targeted replacement and `write`/, relativePath);
    assert.match(content, /Do not inspect or discover the exposed tool set/, relativePath);
  }
});
