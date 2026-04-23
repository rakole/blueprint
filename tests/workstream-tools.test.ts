import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { BLUEPRINT_MUTATION_TOOL_NAMES, blueprintToolNames, blueprintToolRegistry } from "../src/mcp/server.js";
import { blueprintStateUpdate } from "../src/mcp/tools/state.js";
import {
  blueprintWorkstreamList,
  blueprintWorkstreamMutate
} from "../src/mcp/tools/workspace.js";

const execFileAsync = promisify(execFile);

async function runGit(args: string[], cwd?: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

async function initializeGitRepo(repoPath: string): Promise<void> {
  try {
    await runGit(["init", "-b", "main"], repoPath);
  } catch {
    await runGit(["init"], repoPath);
    await runGit(["checkout", "-b", "main"], repoPath);
  }
}

async function createBlueprintRepo(tempRoot: string, name: string): Promise<string> {
  const repoPath = path.join(tempRoot, name);

  await fs.mkdir(repoPath, { recursive: true });
  await initializeGitRepo(repoPath);
  await runGit(["config", "user.name", "Blueprint Tests"], repoPath);
  await runGit(["config", "user.email", "blueprint-tests@example.com"], repoPath);
  await fs.writeFile(path.join(repoPath, "README.md"), `# ${name}\n`, "utf8");
  await runGit(["add", "README.md"], repoPath);
  await runGit(["commit", "-m", "init"], repoPath);
  await fs.mkdir(path.join(repoPath, ".blueprint"), { recursive: true });
  await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      projectStatus: "active",
      currentMilestone: "v1",
      currentPhase: "1",
      activeCommand: "/blu-plan-phase",
      nextAction: "Run /blu-execute-phase 1"
    }
  });

  return repoPath;
}

test("workstream tools register in the MCP server and mark mutate as a mutation tool", () => {
  assert.ok(blueprintToolNames.includes("blueprint_workstream_list"));
  assert.ok(blueprintToolNames.includes("blueprint_workstream_mutate"));
  assert.equal(
    blueprintToolRegistry.blueprint_workstream_mutate.inputSchema.operation.safeParse("create")
      .success,
    true
  );
  assert.equal(
    blueprintToolRegistry.blueprint_workstream_mutate.inputSchema.operation.safeParse("resume")
      .success,
    true
  );
  assert.ok(BLUEPRINT_MUTATION_TOOL_NAMES.has("blueprint_workstream_mutate"));
});

test("blueprint_workstream_list returns an empty project-local registry when no workstreams exist yet", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workstreams-empty-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");
  const result = await blueprintWorkstreamList({ cwd: repoPath });

  assert.equal(result.status, "ready");
  assert.equal(result.indexPath, ".blueprint/workstreams/WORKSTREAMS.md");
  assert.equal(result.summary.total, 0);
  assert.equal(result.active, null);
  assert.deepEqual(result.workstreams, []);
  assert.match(result.summary.nextAction ?? "", /create <name>/);
});

test("workstream mutate supports create, switch, resume, and complete while keeping state project-local", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workstreams-happy-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");

  const createdAlpha = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Alpha Stream"
  });
  const createdBeta = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Beta Stream"
  });
  const switched = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "switch",
    workstream: "beta-stream"
  });

  await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      currentPhase: "2",
      activeCommand: "/blu-execute-phase",
      nextAction: "Run /blu-verify-work 2"
    }
  });

  const resumed = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "resume",
    workstream: "alpha-stream"
  });
  const completed = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "complete",
    workstream: "alpha-stream"
  });
  const listed = await blueprintWorkstreamList({ cwd: repoPath });

  assert.equal(createdAlpha.status, "updated");
  assert.equal(createdAlpha.active?.slug, "alpha-stream");
  assert.match(createdAlpha.affectedPaths.join("\n"), /\.blueprint\/workstreams\/alpha-stream\/state\.json/);

  assert.equal(createdBeta.status, "updated");
  assert.equal(createdBeta.active?.slug, "alpha-stream");
  assert.equal(
    createdBeta.workstreams.find((entry) => entry.slug === "beta-stream")?.status,
    "paused"
  );

  assert.equal(switched.status, "updated");
  assert.equal(switched.active?.slug, "beta-stream");
  assert.equal(
    switched.workstreams.find((entry) => entry.slug === "alpha-stream")?.status,
    "paused"
  );

  assert.equal(resumed.status, "updated");
  assert.equal(resumed.active?.slug, "alpha-stream");
  assert.equal(resumed.statePatch?.currentPhase, "1");
  assert.equal(resumed.statePatch?.activeCommand, "/blu-plan-phase");

  assert.equal(completed.status, "updated");
  assert.equal(completed.active, null);
  assert.equal(
    completed.workstreams.find((entry) => entry.slug === "alpha-stream")?.status,
    "completed"
  );
  assert.equal(
    completed.workstreams.find((entry) => entry.slug === "beta-stream")?.status,
    "paused"
  );

  assert.equal(listed.status, "ready");
  assert.equal(listed.summary.total, 2);
  assert.equal(listed.summary.active, 0);
  assert.equal(listed.summary.paused, 1);
  assert.equal(listed.summary.completed, 1);
  assert.equal(
    listed.workstreams.find((entry) => entry.slug === "beta-stream")?.stateSnapshot?.currentPhase,
    "2"
  );

  const alphaState = JSON.parse(
    await fs.readFile(
      path.join(repoPath, ".blueprint/workstreams/alpha-stream/state.json"),
      "utf8"
    )
  ) as { status: string; completedAt: string | null };
  const indexContent = await fs.readFile(
    path.join(repoPath, ".blueprint/workstreams/WORKSTREAMS.md"),
    "utf8"
  );

  assert.equal(alphaState.status, "completed");
  assert.ok(alphaState.completedAt);
  assert.match(indexContent, /`alpha-stream`/);
  assert.match(indexContent, /`beta-stream`/);
});

test("switching the active workstream blocks on dirty non-Blueprint repo changes", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workstreams-dirty-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Alpha Stream"
  });
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Beta Stream"
  });
  await fs.writeFile(path.join(repoPath, "feature.txt"), "dirty\n", "utf8");

  const blocked = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "switch",
    workstream: "beta-stream"
  });

  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.waitingState, "dirty-working-tree");
  assert.equal(blocked.active?.slug, "alpha-stream");
  assert.match(blocked.nextAction ?? "", /Clean or stash the working tree/i);
});

test("workstream list reports corrupt-workstream-index when WORKSTREAMS.md drifts from canonical state", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workstreams-corrupt-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Alpha Stream"
  });
  await fs.writeFile(
    path.join(repoPath, ".blueprint/workstreams/WORKSTREAMS.md"),
    "# Corrupt Index\n",
    "utf8"
  );

  const listed = await blueprintWorkstreamList({ cwd: repoPath });

  assert.equal(listed.status, "invalid");
  assert.equal(listed.waitingState, "corrupt-workstream-index");
  assert.match(listed.reason ?? "", /stale|corrupt/i);
});

test("workstream list reports corrupt-workstream-index when canonical state.json has malformed timestamps", async (t) => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "blueprint-workstreams-corrupt-timestamps-")
  );
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Alpha Stream"
  });

  const statePath = path.join(repoPath, ".blueprint/workstreams/alpha-stream/state.json");
  const stateDocument = JSON.parse(await fs.readFile(statePath, "utf8")) as Record<string, unknown>;
  stateDocument.completedAt = 123;
  await fs.writeFile(statePath, `${JSON.stringify(stateDocument, null, 2)}\n`, "utf8");

  const listed = await blueprintWorkstreamList({ cwd: repoPath });

  assert.equal(listed.status, "invalid");
  assert.equal(listed.waitingState, "corrupt-workstream-index");
  assert.match(listed.reason ?? "", /malformed timestamps|stale|corrupt/i);
});

test("failed workstream writes roll back newly created directories before the store is reloaded", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workstreams-rollback-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");
  const mutableFs = fs as typeof fs & {
    rename: typeof fs.rename;
  };
  const originalRename = mutableFs.rename;

  mutableFs.rename = async (oldPath, newPath) => {
    if (String(newPath).endsWith(path.join("alpha-stream", "state.json"))) {
      throw new Error("simulated state rename failure");
    }

    return originalRename(oldPath, newPath);
  };

  t.after(() => {
    mutableFs.rename = originalRename;
  });

  await assert.rejects(
    blueprintWorkstreamMutate({
      cwd: repoPath,
      operation: "create",
      workstream: "Alpha Stream"
    }),
    /simulated state rename failure/
  );

  const slugPath = path.join(repoPath, ".blueprint/workstreams/alpha-stream");
  const slugExists = await fs
    .stat(slugPath)
    .then(() => true)
    .catch(() => false);
  const listed = await blueprintWorkstreamList({ cwd: repoPath });

  assert.equal(slugExists, false);
  assert.equal(listed.status, "ready");
  assert.equal(listed.summary.total, 0);
  assert.deepEqual(listed.workstreams, []);
});

test("switching away from an active workstream blocks when the current STATE.md snapshot is missing", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workstreams-missing-state-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Alpha Stream"
  });
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Beta Stream"
  });
  await fs.rm(path.join(repoPath, ".blueprint/STATE.md"), { force: true });

  const blocked = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "switch",
    workstream: "beta-stream"
  });
  const listed = await blueprintWorkstreamList({ cwd: repoPath });

  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.waitingState, "missing-resume-snapshot");
  assert.equal(blocked.active?.slug, "alpha-stream");
  assert.match(blocked.reason ?? "", /STATE\.md is missing/i);
  assert.match(blocked.nextAction ?? "", /blu-progress/i);
  assert.equal(listed.active?.slug, "alpha-stream");
  assert.equal(
    listed.workstreams.find((entry) => entry.slug === "alpha-stream")?.status,
    "active"
  );
  assert.equal(
    listed.workstreams.find((entry) => entry.slug === "beta-stream")?.status,
    "paused"
  );
});

test("creating the first active workstream blocks cleanly when STATE.md is truncated", async (t) => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "blueprint-workstreams-create-truncated-state-")
  );
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");
  await fs.writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    "# Blueprint State\n\n- Project status: active\n",
    "utf8"
  );

  const blocked = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Alpha Stream"
  });
  const listed = await blueprintWorkstreamList({ cwd: repoPath });

  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.waitingState, "missing-resume-snapshot");
  assert.equal(blocked.active, null);
  assert.match(blocked.reason ?? "", /missing required field "Current milestone"/i);
  assert.match(blocked.nextAction ?? "", /blu-progress/i);
  assert.equal(listed.active, null);
  assert.equal(listed.summary.total, 0);
  assert.deepEqual(listed.workstreams, []);
});

test("creating a paused workstream skips STATE.md capture when another workstream is already active", async (t) => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "blueprint-workstreams-create-paused-state-")
  );
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Alpha Stream"
  });

  const mutableFs = fs as typeof fs & {
    readFile: typeof fs.readFile;
  };
  const originalReadFile = mutableFs.readFile;

  mutableFs.readFile = (async (...args: Parameters<typeof originalReadFile>) => {
    if (String(args[0]).endsWith(path.join(".blueprint", "STATE.md"))) {
      const error = new Error("permission denied") as Error & { code?: string };
      error.code = "EACCES";
      throw error;
    }

    return originalReadFile(...args);
  }) as typeof fs.readFile;

  t.after(() => {
    mutableFs.readFile = originalReadFile;
  });

  const created = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Beta Stream"
  });

  mutableFs.readFile = originalReadFile;

  const listed = await blueprintWorkstreamList({ cwd: repoPath });

  assert.equal(created.status, "updated");
  assert.equal(created.active?.slug, "alpha-stream");
  assert.equal(listed.active?.slug, "alpha-stream");
  assert.equal(listed.summary.total, 2);
  assert.equal(
    listed.workstreams.find((entry) => entry.slug === "alpha-stream")?.status,
    "active"
  );
  assert.equal(
    listed.workstreams.find((entry) => entry.slug === "beta-stream")?.status,
    "paused"
  );
});

test("switching away from an active workstream blocks when the current STATE.md snapshot is truncated", async (t) => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "blueprint-workstreams-truncated-state-")
  );
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Alpha Stream"
  });
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Beta Stream"
  });
  await fs.writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    "# Blueprint State\n\n- Project status: active\n",
    "utf8"
  );

  const blocked = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "switch",
    workstream: "beta-stream"
  });
  const listed = await blueprintWorkstreamList({ cwd: repoPath });

  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.waitingState, "missing-resume-snapshot");
  assert.equal(blocked.active?.slug, "alpha-stream");
  assert.match(blocked.reason ?? "", /missing required field "Current milestone"/i);
  assert.match(blocked.nextAction ?? "", /blu-progress/i);
  assert.equal(listed.active?.slug, "alpha-stream");
  assert.equal(
    listed.workstreams.find((entry) => entry.slug === "alpha-stream")?.status,
    "active"
  );
  assert.equal(
    listed.workstreams.find((entry) => entry.slug === "beta-stream")?.status,
    "paused"
  );
});

test("completing the active workstream blocks cleanly when the current STATE.md snapshot cannot be read", async (t) => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "blueprint-workstreams-complete-state-read-")
  );
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Alpha Stream"
  });
  const mutableFs = fs as typeof fs & {
    readFile: typeof fs.readFile;
  };
  const originalReadFile = mutableFs.readFile;

  mutableFs.readFile = (async (...args: Parameters<typeof originalReadFile>) => {
    if (String(args[0]).endsWith(path.join(".blueprint", "STATE.md"))) {
      const error = new Error("permission denied") as Error & { code?: string };
      error.code = "EACCES";
      throw error;
    }

    return originalReadFile(...args);
  }) as typeof fs.readFile;

  t.after(() => {
    mutableFs.readFile = originalReadFile;
  });

  const blocked = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "complete",
    workstream: "alpha-stream"
  });

  mutableFs.readFile = originalReadFile;

  const listed = await blueprintWorkstreamList({ cwd: repoPath });

  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.waitingState, "missing-resume-snapshot");
  assert.equal(blocked.active?.slug, "alpha-stream");
  assert.match(blocked.reason ?? "", /could not be read: permission denied/i);
  assert.match(blocked.nextAction ?? "", /blu-progress/i);
  assert.equal(listed.active?.slug, "alpha-stream");
  assert.equal(
    listed.workstreams.find((entry) => entry.slug === "alpha-stream")?.status,
    "active"
  );
});
