import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runGit(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

export async function initializeGitRepo(repoPath: string): Promise<void> {
  try {
    await runGit(["init", "-b", "main"], repoPath);
  } catch {
    await runGit(["init"], repoPath);
    await runGit(["checkout", "-b", "main"], repoPath);
  }
}

export async function createGitRepo(prefix: string): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(repoPath, { recursive: true });
  await initializeGitRepo(repoPath);

  return repoPath;
}

export async function createCommittedGitRepo(prefix: string): Promise<string> {
  const repoPath = await createGitRepo(prefix);
  await runGit(["config", "user.name", "Blueprint Tests"], repoPath);
  await runGit(["config", "user.email", "blueprint-tests@example.com"], repoPath);
  await writeFile(path.join(repoPath, "README.md"), "# Blueprint Test Repo\n", "utf8");
  await runGit(["add", "README.md"], repoPath);
  await runGit(["commit", "-m", "init"], repoPath);

  return repoPath;
}

export async function createCommittedGitWorktree(prefix: string): Promise<{
  repoPath: string;
  worktreePath: string;
}> {
  const repoPath = await createCommittedGitRepo(prefix);
  const tempRoot = path.dirname(repoPath);
  const worktreePath = path.join(tempRoot, "worktrees", "feature-root");

  await mkdir(path.dirname(worktreePath), { recursive: true });
  await runGit(["worktree", "add", "-b", "feature-root", worktreePath], repoPath);

  return {
    repoPath,
    worktreePath
  };
}
