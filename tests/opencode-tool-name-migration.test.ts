import test from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const promptRoots = ["agents", "commands", "skills"];

async function collectPromptFiles(relativeDir: string): Promise<string[]> {
  const files: string[] = [];

  for (const entry of await readdir(path.join(repoRoot, relativeDir), { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectPromptFiles(relativePath));
    } else if (entry.isFile() && [".md", ".toml"].includes(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }

  return files;
}

function run(cwd: string, command: string, args: string[]) {
  return spawnSync(command, args, { cwd, encoding: "utf8" });
}

async function createMigrationFixture(
  t: TestContext,
  promptFiles: Record<string, string>,
  preservedAskUserLiterals: Record<string, string[]> = {}
) {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-opencode-migration-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));

  await mkdir(path.join(fixtureRoot, "scripts"), { recursive: true });
  for (const [relativePath, content] of Object.entries(promptFiles)) {
    const absolutePath = path.join(fixtureRoot, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
  }
  await copyFile(
    path.join(repoRoot, "scripts/migrate-opencode-tool-names.mjs"),
    path.join(fixtureRoot, "scripts/migrate-opencode-tool-names.mjs")
  );

  assert.equal(run(fixtureRoot, "git", ["init", "-q"]).status, 0);
  assert.equal(run(fixtureRoot, "git", ["config", "user.name", "Blueprint Test"]).status, 0);
  assert.equal(run(fixtureRoot, "git", ["config", "user.email", "blueprint@example.invalid"]).status, 0);
  assert.equal(run(fixtureRoot, "git", ["checkout", "-q", "-b", "codex/open-code-tool-names"]).status, 0);
  assert.equal(run(fixtureRoot, "git", ["add", "commands", "scripts/migrate-opencode-tool-names.mjs"]).status, 0);
  assert.equal(run(fixtureRoot, "git", ["commit", "-q", "-m", "fixture base"]).status, 0);

  const baseSha = run(fixtureRoot, "git", ["rev-parse", "HEAD"]).stdout.trim();
  assert.match(baseSha, /^[a-f0-9]{40}$/);
  assert.equal(
    run(fixtureRoot, "git", ["update-ref", "refs/remotes/origin/open_code", baseSha]).status,
    0
  );

  await writeFile(
    path.join(fixtureRoot, "scripts/migrate-opencode-tool-names.config.json"),
    JSON.stringify({
      expectedBranch: "codex/open-code-tool-names",
      expectedBaseRef: "origin/open_code",
      expectedBaseSha: baseSha,
      promptRoots: ["commands"],
      promptExtensions: [".toml"],
      fixedFiles: [],
      preservedAskUserLiterals,
      pairedFamilyTests: [],
      questionSchemaSentence: "unused fixture schema",
      modelEditingInstruction: "unused fixture model instruction"
    })
  );

  return fixtureRoot;
}

test("OpenCode prompt surfaces use the migrated tool vocabulary", async () => {
  const files = (await Promise.all(promptRoots.map(collectPromptFiles))).flat();
  const preservedModes = new Map([
    ["commands/blu-update.toml", 'mode = "ask_user"'],
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

test("migration rejection leaves earlier and later targets byte-identical", async (t) => {
  const initial = {
    "commands/a-valid.toml": "Call `mcp_blueprint_blueprint_status`.\n",
    "commands/z-invalid.toml": "Use `type: \"choice\"` without the OpenCode questions schema.\n"
  };
  const fixtureRoot = await createMigrationFixture(t, initial);
  const result = run(fixtureRoot, process.execPath, [
    "scripts/migrate-opencode-tool-names.mjs",
    "--apply"
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /preflight rejected without writes/);
  for (const [relativePath, content] of Object.entries(initial)) {
    assert.equal(await readFile(path.join(fixtureRoot, relativePath), "utf8"), content);
  }
});

test("migration dry-run, apply, repeat apply, and enum preservation are deterministic", async (t) => {
  const relativePath = "commands/blu-update.toml";
  const initial = [
    "Call `mcp_blueprint_blueprint_update_plan`.",
    "Use `ask_user` for the UI gate.",
    'Pass mode = "ask_user" to preserve the backend enum.',
    ""
  ].join("\n");
  const fixtureRoot = await createMigrationFixture(
    t,
    { [relativePath]: initial },
    { [relativePath]: ['mode = "ask_user"'] }
  );
  const absolutePath = path.join(fixtureRoot, relativePath);

  const dryRun = run(fixtureRoot, process.execPath, ["scripts/migrate-opencode-tool-names.mjs"]);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /DRY-RUN: 1 file\(s\) require migration/);
  assert.equal(await readFile(absolutePath, "utf8"), initial);

  const apply = run(fixtureRoot, process.execPath, [
    "scripts/migrate-opencode-tool-names.mjs",
    "--apply"
  ]);
  assert.equal(apply.status, 0, apply.stderr);
  const migrated = await readFile(absolutePath, "utf8");
  assert.match(migrated, /`blueprint_blueprint_update_plan`/);
  assert.match(migrated, /Use `question` for the UI gate/);
  assert.match(migrated, /mode = "ask_user"/);

  const repeatApply = run(fixtureRoot, process.execPath, [
    "scripts/migrate-opencode-tool-names.mjs",
    "--apply"
  ]);
  assert.equal(repeatApply.status, 0, repeatApply.stderr);
  assert.match(repeatApply.stdout, /APPLY: 0 file\(s\) require migration/);
  assert.equal(await readFile(absolutePath, "utf8"), migrated);
});
