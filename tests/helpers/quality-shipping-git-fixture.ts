import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  QualityShippingProcessResult,
  QualityShippingProcessRunner
} from "../../src/mcp/quality-shipping-safety.js";

export type QualityShippingGitFixture = {
  root: string;
  repoPath: string;
  homePath: string;
  env: NodeJS.ProcessEnv;
  runner: QualityShippingProcessRunner;
  runGit(argv: readonly string[], cwd?: string): Promise<QualityShippingProcessResult>;
  commitFile(relativePath: string, content: string, message: string): Promise<string>;
  cleanup(): Promise<void>;
};

function exactExecFile(
  command: string,
  argv: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<QualityShippingProcessResult> {
  return new Promise((resolve) => {
    execFile(command, [...argv], { cwd, env, windowsHide: true }, (error, stdout, stderr) => {
      const processError = error as (NodeJS.ErrnoException & {
        code?: string | number;
        killed?: boolean;
        signal?: NodeJS.Signals | null;
      }) | null;
      resolve({
        exitCode:
          typeof processError?.code === "number"
            ? processError.code
            : error
              ? null
              : 0,
        stdout: String(stdout ?? ""),
        stderr: String(stderr ?? ""),
        signal: processError?.signal ?? null,
        timedOut: Boolean(processError?.killed && processError.signal === "SIGTERM")
      });
    });
  });
}

async function requireSuccess(
  result: QualityShippingProcessResult,
  label: string
): Promise<string> {
  if (result.exitCode !== 0 || result.signal || result.timedOut) {
    throw new Error(`${label} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

export async function createQualityShippingGitFixture(
  prefix = "blueprint quality shipping "
): Promise<QualityShippingGitFixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  const repoPath = path.join(root, "repo with spaces");
  const homePath = path.join(root, "isolated home");
  const globalConfigPath = path.join(homePath, "git global config");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: homePath,
    XDG_CONFIG_HOME: path.join(homePath, "xdg"),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: globalConfigPath,
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
    LANG: "C"
  };
  const runner: QualityShippingProcessRunner = exactExecFile;

  await mkdir(repoPath, { recursive: true });
  await mkdir(homePath, { recursive: true });
  const runGit = (argv: readonly string[], cwd = repoPath) => runner("git", argv, cwd, env);
  let init = await runGit(["init", "-b", "main"]);
  if (init.exitCode !== 0) {
    init = await runGit(["init"]);
    await requireSuccess(init, "git init");
    await requireSuccess(await runGit(["checkout", "-b", "main"]), "git checkout main");
  }
  await requireSuccess(await runGit(["config", "user.name", "Blueprint Tests"]), "git config user.name");
  await requireSuccess(
    await runGit(["config", "user.email", "blueprint-tests@example.com"]),
    "git config user.email"
  );

  const commitFile = async (
    relativePath: string,
    content: string,
    message: string
  ): Promise<string> => {
    const absolutePath = path.join(repoPath, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
    await requireSuccess(await runGit(["add", "--", relativePath]), `git add ${relativePath}`);
    await requireSuccess(await runGit(["commit", "-m", message]), `git commit ${message}`);
    return requireSuccess(await runGit(["rev-parse", "HEAD"]), "git rev-parse HEAD");
  };

  await commitFile(
    ".gitignore",
    ".blueprint/reports/\n.blueprint/locks/\n.blueprint/mcp-write-failures.ndjson\n",
    "test: isolate blueprint runtime reports"
  );
  await commitFile("README.md", "# Fixture\n", "test: initialize fixture");
  await commitFile(".blueprint/PROJECT.md", "# Project\n", "test: initialize project");
  await commitFile(".blueprint/REQUIREMENTS.md", "# Requirements\n", "test: initialize requirements");
  await commitFile(
    ".blueprint/ROADMAP.md",
    "# Roadmap\n\n## Milestone\n\n- Active milestone: test\n\n## Phases\n\n- [ ] **Phase 1: Test** - Test phase\n",
    "test: initialize roadmap"
  );
  await commitFile(
    ".blueprint/STATE.md",
    "# Blueprint State\n\n- Project status: initialized\n- Current milestone: test\n- Current phase: 1\n- Active command: /blu-undo\n- Next action: Run /blu-progress\n- Last updated: 2026-07-14T00:00:00.000Z\n\n## Blockers\n\n- none\n",
    "test: initialize state"
  );
  await commitFile(".blueprint/config.json", "{\n  \"version\": 2\n}\n", "test: initialize config");

  return {
    root,
    repoPath,
    homePath,
    env,
    runner,
    runGit,
    commitFile,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}
