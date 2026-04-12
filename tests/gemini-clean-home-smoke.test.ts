import test from "node:test";
import assert from "node:assert/strict";
import {
  chmod,
  mkdtemp,
  mkdir,
  realpath,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "scripts", "gemini-clean-home-smoke.mjs");

async function withTempRoot(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-gemini-smoke-test-"));

  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writeExecutable(filePath: string, contents: string) {
  await writeFile(filePath, contents, "utf8");
  await chmod(filePath, 0o755);
}

function execSmoke(args: string[], env: Record<string, string> = {}) {
  return spawnSync("node", [scriptPath, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env
    },
    encoding: "utf8"
  });
}

test("clean-home smoke runs validate, consented link, and PTY-backed list against one temp home", async () => {
  await withTempRoot(async (root) => {
    const fakeRepo = path.join(root, "repo");
    const fakeGemini = path.join(root, "fake-gemini.mjs");
    const logPath = path.join(root, "gemini-log.jsonl");

    await mkdir(path.join(fakeRepo, "dist", "mcp"), { recursive: true });
    await writeFile(path.join(fakeRepo, "gemini-extension.json"), "{\n}\n", "utf8");
    await writeFile(path.join(fakeRepo, "dist", "mcp", "server.js"), "// built\n", "utf8");

    await writeExecutable(
      fakeGemini,
      `#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const logPath = process.env.BLUEPRINT_FAKE_GEMINI_LOG;
const entry = {
  args: process.argv.slice(2),
  cwd: process.cwd(),
  home: process.env.HOME,
  xdgConfigHome: process.env.XDG_CONFIG_HOME,
  xdgCacheHome: process.env.XDG_CACHE_HOME,
  xdgStateHome: process.env.XDG_STATE_HOME
};

fs.appendFileSync(logPath, JSON.stringify(entry) + "\\n");

if (process.argv[2] === "extensions" && process.argv[3] === "link") {
  const linkedRepoPath = process.argv[4];
  fs.mkdirSync(
    path.join(process.env.HOME, ".gemini", "extensions", "blueprint"),
    { recursive: true }
  );
  fs.writeFileSync(
    path.join(process.env.HOME, ".gemini", "linked-blueprint-path.txt"),
    linkedRepoPath
  );
  process.stdout.write("linked\\n");
  process.exit(0);
}

if (process.argv[2] === "extensions" && process.argv[3] === "list") {
  const linkedRepoPath = fs.readFileSync(
    path.join(process.env.HOME, ".gemini", "linked-blueprint-path.txt"),
    "utf8"
  );
  process.stdout.write(JSON.stringify([
    {
      name: "blueprint",
      path: linkedRepoPath
    }
  ], null, 2));
  process.exit(0);
}

process.stdout.write("ok\\n");
`
    );

    const result = execSmoke(["--repo", fakeRepo, "--gemini", fakeGemini], {
      BLUEPRINT_FAKE_GEMINI_LOG: logPath
    });

    assert.equal(result.status, 0, result.stderr);

    const entries = (await readFile(logPath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line)) as Array<{
        args: string[];
        cwd: string;
        home: string;
        xdgConfigHome: string;
        xdgCacheHome: string;
        xdgStateHome: string;
      }>;
    const realRepo = await realpath(fakeRepo);

    assert.deepEqual(entries.map((entry) => entry.args), [
      ["extensions", "validate", fakeRepo, "--debug"],
      ["extensions", "link", fakeRepo, "--consent"],
      ["extensions", "list", "--output-format", "json"]
    ]);
    assert.equal(await realpath(entries[0].cwd), realRepo);
    assert.equal(await realpath(entries[1].cwd), realRepo);
    assert.equal(await realpath(entries[2].cwd), realRepo);
    assert.notEqual(entries[0].home, entries[1].home);
    assert.equal(entries[1].home, entries[2].home);
    assert.equal(entries[1].xdgConfigHome, path.join(entries[1].home, ".config"));
    assert.equal(entries[1].xdgCacheHome, path.join(entries[1].home, ".cache"));
    assert.equal(entries[1].xdgStateHome, path.join(entries[1].home, ".local", "state"));
    assert.match(result.stdout, /Blueprint clean-home smoke passed/);
  });
});

test("clean-home smoke fails clearly when list output does not include blueprint", async () => {
  await withTempRoot(async (root) => {
    const fakeRepo = path.join(root, "repo");
    const fakeGemini = path.join(root, "fake-gemini.mjs");

    await mkdir(path.join(fakeRepo, "dist", "mcp"), { recursive: true });
    await writeFile(path.join(fakeRepo, "gemini-extension.json"), "{\n}\n", "utf8");
    await writeFile(path.join(fakeRepo, "dist", "mcp", "server.js"), "// built\n", "utf8");

    await writeExecutable(
      fakeGemini,
      `#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

if (process.argv[2] === "extensions" && process.argv[3] === "link") {
  fs.mkdirSync(
    path.join(process.env.HOME, ".gemini", "extensions", "blueprint"),
    { recursive: true }
  );
  process.stdout.write("linked\\n");
  process.exit(0);
}

if (process.argv[2] === "extensions" && process.argv[3] === "list") {
  process.stdout.write("[]");
  process.exit(0);
}

process.stdout.write("ok\\n");
`
    );

    const result = execSmoke(["--repo", fakeRepo, "--gemini", fakeGemini]);

    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /did not report blueprint/
    );
    assert.match(result.stderr, /Smoke home preserved at/);
  });
});
