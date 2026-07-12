import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { BLUEPRINT_MUTATION_TOOL_NAMES, blueprintToolNames, blueprintToolRegistry } from "../src/mcp/server.js";
import { PHASE_TOPOLOGY_LOCK_NAME } from "../src/mcp/tools/phase-topology-lock.js";
import { blueprintRoadmapRemovePhase } from "../src/mcp/tools/phase.js";
import { blueprintStateUpdate, loadBlueprintState } from "../src/mcp/tools/state.js";
import {
  blueprintWorkstreamList,
  blueprintWorkstreamMutate,
  workspaceToolTestHooks
} from "../src/mcp/tools/workspace.js";

const execFileAsync = promisify(execFile);

type Deferred<T = void> = {
  promise: Promise<T>;
  resolve(value: T | PromiseLike<T>): void;
  reject(error: unknown): void;
};

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

async function waitFor<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${label}.`));
    }, 5000);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function fsPathForMock(value: unknown): string {
  return typeof value === "string" ? value : path.resolve(String(value));
}

function phaseTopologyLockPath(repoPath: string): string {
  return path.join(repoPath, ".blueprint/locks", `${PHASE_TOPOLOGY_LOCK_NAME}.lock`);
}

function pauseFirstMkdirToPath(
  t: TestContext,
  targetPath: string
): {
  paused: Promise<void>;
  resume(): void;
} {
  const realMkdir = fs.mkdir.bind(fs);
  const paused = deferred<void>();
  const resume = deferred<void>();
  let hasPaused = false;

  t.mock.method(fs, "mkdir", async (target, options) => {
    if (!hasPaused && path.resolve(fsPathForMock(target)) === path.resolve(targetPath)) {
      hasPaused = true;
      paused.resolve();
      await resume.promise;
    }

    return realMkdir(
      target as Parameters<typeof fs.mkdir>[0],
      options as Parameters<typeof fs.mkdir>[1]
    );
  });

  t.after(() => {
    resume.resolve();
  });

  return {
    paused: paused.promise,
    resume: () => resume.resolve()
  };
}

async function withEnvironment<T>(
  overrides: Record<string, string | undefined>,
  callback: () => Promise<T>
): Promise<T> {
  const previousValues = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previousValues.set(key, process.env[key]);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of previousValues.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

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
  const phaseDir = path.join(repoPath, ".blueprint/phases/01-workstream-bootstrap");
  const phaseTwoDir = path.join(repoPath, ".blueprint/phases/02-workstream-handoff");

  await fs.mkdir(repoPath, { recursive: true });
  await initializeGitRepo(repoPath);
  await runGit(["config", "user.name", "Blueprint Tests"], repoPath);
  await runGit(["config", "user.email", "blueprint-tests@example.com"], repoPath);
  await fs.writeFile(path.join(repoPath, "README.md"), `# ${name}\n`, "utf8");
  await runGit(["add", "README.md"], repoPath);
  await runGit(["commit", "-m", "init"], repoPath);
  await fs.mkdir(path.join(repoPath, ".blueprint"), { recursive: true });
  await fs.mkdir(phaseDir, { recursive: true });
  await fs.mkdir(phaseTwoDir, { recursive: true });
  await fs.writeFile(
    path.join(phaseDir, "01-CONTEXT.md"),
    `# Phase 01: Workstream Bootstrap - Context

## Decisions

- Seed the repo with a valid current-phase context before exercising workstream state transitions.
`,
    "utf8"
  );
  await fs.writeFile(
    path.join(phaseTwoDir, "02-CONTEXT.md"),
    `# Phase 02: Workstream Handoff - Context

## Decisions

- Allow tests to advance the saved state to Phase 2 without production code changes.
`,
    "utf8"
  );
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
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "baseline fixture"], repoPath);

  return repoPath;
}

async function addResumeTopologyRoadmap(repoPath: string): Promise<void> {
  const removableDir = path.join(repoPath, ".blueprint/phases/02.1-removable");
  const resumeDir = path.join(repoPath, ".blueprint/phases/02.2-resume-target");

  await fs.mkdir(removableDir, { recursive: true });
  await fs.mkdir(resumeDir, { recursive: true });
  await fs.writeFile(
    path.join(removableDir, "02.1-CONTEXT.md"),
    "# Phase 02.1: Removable - Context\n\n## Decisions\n\n- Fixture phase for renumbering.\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(resumeDir, "02.2-CONTEXT.md"),
    "# Phase 02.2: Resume Target - Context\n\n## Decisions\n\n- Fixture phase for stale resume detection.\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Workstream Resume

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 1: Workstream Bootstrap** - Current active work
- [ ] **Phase 2.1: Removable** - Remove to renumber the resume target
- [ ] **Phase 2.2: Resume Target** - Saved workstream target

## Phase Details

### Phase 1: Workstream Bootstrap
**Goal**: Current active work.
**Requirements**: WS-01

### Phase 2.1: Removable
**Goal**: Remove to renumber the resume target.
**Requirements**: WS-01

### Phase 2.2: Resume Target
**Goal**: Saved workstream target before resume.
**Requirements**: WS-02
`,
    "utf8"
  );
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
    workstream: "beta-stream",
    confirmed: true,
    expectedActiveWorkstream: "alpha-stream"
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
  const resumedState = await loadBlueprintState(repoPath);
  const completed = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "complete",
    workstream: "alpha-stream",
    confirmed: true,
    expectedActiveWorkstream: "alpha-stream"
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
  assert.match(resumed.affectedPaths.join("\n"), /\.blueprint\/STATE\.md/);
  assert.doesNotMatch(resumed.nextAction ?? "", /blueprint_state_update/);
  assert.equal(resumedState.currentPhase, "1");
  assert.equal(resumedState.activeCommand, "/blu-plan-phase");
  assert.equal(resumedState.nextAction, "Run /blu-execute-phase 1");

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

test("workstream mutation preserves the mode of an existing atomic index file", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workstreams-mode-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Private Stream"
  });
  const indexPath = path.join(repoPath, ".blueprint/workstreams/WORKSTREAMS.md");
  await fs.chmod(indexPath, 0o600);

  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "create",
    workstream: "Second Stream"
  });

  assert.equal((await fs.stat(indexPath)).mode & 0o777, 0o600);
});

test("workstream switch requires runtime confirmation before mutating active state", async (t) => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "blueprint-workstreams-switch-confirmation-")
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

  const blocked = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "switch",
    workstream: "beta-stream"
  });
  const listed = await blueprintWorkstreamList({ cwd: repoPath });

  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.waitingState, "workstream-switch-confirmation");
  assert.deepEqual(blocked.affectedPaths, []);
  assert.equal(blocked.active?.slug, "alpha-stream");
  assert.match(blocked.reason ?? "", /requires explicit confirmation/i);
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

test("confirmed workstream switch rejects stale active context before mutating", async (t) => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "blueprint-workstreams-switch-stale-active-")
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

  const blocked = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "switch",
    workstream: "beta-stream",
    confirmed: true,
    expectedActiveWorkstream: "gamma-stream"
  });
  const listed = await blueprintWorkstreamList({ cwd: repoPath });

  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.waitingState, "workstream-switch-confirmation");
  assert.deepEqual(blocked.affectedPaths, []);
  assert.match(blocked.reason ?? "", /Active workstream changed/i);
  assert.equal(listed.active?.slug, "alpha-stream");
  assert.equal(
    listed.workstreams.find((entry) => entry.slug === "beta-stream")?.status,
    "paused"
  );
});

test("completing the active workstream requires runtime archive confirmation before mutating", async (t) => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "blueprint-workstreams-complete-confirmation-")
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

  const blocked = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "complete",
    workstream: "alpha-stream"
  });
  const listed = await blueprintWorkstreamList({ cwd: repoPath });
  const alphaState = JSON.parse(
    await fs.readFile(
      path.join(repoPath, ".blueprint/workstreams/alpha-stream/state.json"),
      "utf8"
    )
  ) as { status: string; completedAt: string | null };

  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.waitingState, "workstream-archive-confirmation");
  assert.deepEqual(blocked.affectedPaths, []);
  assert.equal(blocked.active?.slug, "alpha-stream");
  assert.match(blocked.reason ?? "", /requires explicit archive confirmation/i);
  assert.equal(listed.active?.slug, "alpha-stream");
  assert.equal(alphaState.status, "active");
  assert.equal(alphaState.completedAt, null);
});

test("workstream snapshots and resumes frontmatter-bearing STATE.md documents", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workstreams-frontmatter-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");
  const stateDocument = await fs.readFile(path.join(repoPath, ".blueprint/STATE.md"), "utf8");

  assert.match(stateDocument, /^---\nblueprint_state_version: 1\.0/m);

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
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "switch",
    workstream: "beta-stream",
    confirmed: true
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
  const resumedState = await loadBlueprintState(repoPath);
  const alphaState = JSON.parse(
    await fs.readFile(
      path.join(repoPath, ".blueprint/workstreams/alpha-stream/state.json"),
      "utf8"
    )
  ) as {
    stateSnapshot: {
      currentPhase: string;
      activeCommand: string;
      nextAction: string;
    } | null;
  };

  assert.equal(resumed.status, "updated");
  assert.equal(resumed.statePatch?.currentPhase, "1");
  assert.equal(resumed.statePatch?.activeCommand, "/blu-plan-phase");
  assert.equal(resumedState.currentPhase, "1");
  assert.equal(resumedState.activeCommand, "/blu-plan-phase");
  assert.equal(resumedState.nextAction, "Run /blu-execute-phase 1");
  assert.equal(alphaState.stateSnapshot?.currentPhase, "1");
  assert.equal(alphaState.stateSnapshot?.activeCommand, "/blu-plan-phase");
  assert.equal(alphaState.stateSnapshot?.nextAction, "Run /blu-execute-phase 1");
});

test("resuming a workstream blocks malformed saved snapshots before active state changes", async (t) => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "blueprint-workstreams-malformed-resume-")
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
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "switch",
    workstream: "beta-stream",
    confirmed: true
  });
  await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      currentPhase: "2",
      activeCommand: "/blu-execute-phase",
      nextAction: "Run /blu-verify-work 2"
    }
  });

  const alphaStatePath = path.join(repoPath, ".blueprint/workstreams/alpha-stream/state.json");
  const alphaState = JSON.parse(await fs.readFile(alphaStatePath, "utf8")) as {
    stateSnapshot: { nextAction: string };
  };
  alphaState.stateSnapshot.nextAction = "Run /blu-made-up 1";
  await fs.writeFile(alphaStatePath, `${JSON.stringify(alphaState, null, 2)}\n`, "utf8");

  const blocked = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "resume",
    workstream: "alpha-stream"
  });
  const listed = await blueprintWorkstreamList({ cwd: repoPath });
  const storedState = await loadBlueprintState(repoPath);

  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.waitingState, "missing-resume-snapshot");
  assert.match(blocked.reason ?? "", /cannot be restored/i);
  assert.match(blocked.reason ?? "", /not an implemented Blueprint command/i);
  assert.equal(blocked.active?.slug, "beta-stream");
  assert.equal(listed.active?.slug, "beta-stream");
  assert.equal(
    listed.workstreams.find((entry) => entry.slug === "alpha-stream")?.status,
    "paused"
  );
  assert.equal(storedState.currentPhase, "2");
  assert.equal(storedState.activeCommand, "/blu-execute-phase");
  assert.equal(storedState.nextAction, "Run /blu-verify-work 2");
});

test("resume rolls back active workstream state when STATE.md restoration fails", async (t) => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "blueprint-workstreams-resume-state-rollback-")
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
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "switch",
    workstream: "beta-stream",
    confirmed: true
  });
  await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      currentPhase: "2",
      activeCommand: "/blu-execute-phase",
      nextAction: "Run /blu-verify-work 2"
    }
  });

  const mutableFs = fs as typeof fs & {
    rename: typeof fs.rename;
  };
  const originalRename = mutableFs.rename;

  mutableFs.rename = async (oldPath, newPath) => {
    if (String(newPath).endsWith(path.join(".blueprint", "STATE.md"))) {
      throw new Error("simulated STATE.md write failure");
    }

    return originalRename(oldPath, newPath);
  };

  t.after(() => {
    mutableFs.rename = originalRename;
  });

  await assert.rejects(
    blueprintWorkstreamMutate({
      cwd: repoPath,
      operation: "resume",
      workstream: "alpha-stream"
    }),
    /simulated STATE\.md write failure/
  );

  mutableFs.rename = originalRename;

  const listed = await blueprintWorkstreamList({ cwd: repoPath });
  const storedState = await loadBlueprintState(repoPath);
  const indexContent = await fs.readFile(
    path.join(repoPath, ".blueprint/workstreams/WORKSTREAMS.md"),
    "utf8"
  );

  assert.equal(listed.status, "ready");
  assert.equal(listed.active?.slug, "beta-stream");
  assert.equal(
    listed.workstreams.find((entry) => entry.slug === "alpha-stream")?.status,
    "paused"
  );
  assert.match(indexContent, /Active workstream: `Beta Stream`/);
  assert.equal(storedState.currentPhase, "2");
  assert.equal(storedState.activeCommand, "/blu-execute-phase");
  assert.equal(storedState.nextAction, "Run /blu-verify-work 2");
});

test("resume rejects stale prepared STATE.md after topology renumber and rolls back active workstream", async (t) => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "blueprint-workstreams-resume-topology-stale-")
  );
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");
  await addResumeTopologyRoadmap(repoPath);
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "add resume topology fixture"], repoPath);
  await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      currentPhase: "2.2",
      activeCommand: "/blu-execute-phase",
      nextAction: "Run /blu-validate-phase 2.2"
    }
  });
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
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "switch",
    workstream: "beta-stream",
    confirmed: true
  });
  await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      currentPhase: "1",
      activeCommand: "/blu-plan-phase",
      nextAction: "Run /blu-execute-phase 1"
    }
  });

  const pause = pauseFirstMkdirToPath(t, phaseTopologyLockPath(repoPath));
  const resume = blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "resume",
    workstream: "alpha-stream"
  });

  await waitFor(pause.paused, "resume prepared STATE.md topology lock attempt");
  await blueprintRoadmapRemovePhase({
    cwd: repoPath,
    phase: "2.1",
    confirmed: true
  });
  pause.resume();
  await assert.rejects(resume, /stale phase topology|Prepared STATE\.md update/i);

  const listed = await blueprintWorkstreamList({ cwd: repoPath });
  const storedState = await loadBlueprintState(repoPath);
  const indexContent = await fs.readFile(
    path.join(repoPath, ".blueprint/workstreams/WORKSTREAMS.md"),
    "utf8"
  );
  const alphaStatePath = path.join(repoPath, ".blueprint/workstreams/alpha-stream/state.json");
  const restoredAlphaState = JSON.parse(await fs.readFile(alphaStatePath, "utf8")) as {
    status: string;
    stateSnapshot: { currentPhase: string };
  };
  const roadmap = await fs.readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

  assert.equal(listed.status, "ready");
  assert.equal(listed.active?.slug, "beta-stream");
  assert.equal(
    listed.workstreams.find((entry) => entry.slug === "alpha-stream")?.status,
    "paused"
  );
  assert.equal(restoredAlphaState.status, "paused");
  assert.equal(restoredAlphaState.stateSnapshot.currentPhase, "2.2");
  assert.match(indexContent, /Active workstream: `Beta Stream`/);
  assert.equal(storedState.currentPhase, "1");
  assert.equal(storedState.activeCommand, "/blu-plan-phase");
  assert.equal(storedState.nextAction, "Run /blu-execute-phase 1");
  assert.match(roadmap, /Phase 2\.1: Resume Target/);
  assert.doesNotMatch(roadmap, /Phase 2\.2: Resume Target/);
});

test("resume rejects stale prepared STATE.md after a concurrent state update and rolls back active workstream", async (t) => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "blueprint-workstreams-resume-state-stale-")
  );
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");
  await addResumeTopologyRoadmap(repoPath);
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "add resume state fixture"], repoPath);
  await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      currentPhase: "2.2",
      activeCommand: "/blu-execute-phase",
      nextAction: "Run /blu-validate-phase 2.2"
    }
  });
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
  await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "switch",
    workstream: "beta-stream",
    confirmed: true
  });
  await blueprintStateUpdate({
    cwd: repoPath,
    patch: {
      currentPhase: "1",
      activeCommand: "/blu-plan-phase",
      nextAction: "Run /blu-execute-phase 1"
    }
  });

  const pause = pauseFirstMkdirToPath(t, phaseTopologyLockPath(repoPath));
  const resume = blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "resume",
    workstream: "alpha-stream"
  });

  await waitFor(pause.paused, "resume prepared STATE.md topology lock attempt");
  await blueprintStateUpdate({
    cwd: repoPath,
    patch: { roadmapEvolutionNotes: ["Concurrent state update must survive."] }
  });
  pause.resume();
  await assert.rejects(resume, /stale STATE\.md content/i);

  const listed = await blueprintWorkstreamList({ cwd: repoPath });
  const storedState = await loadBlueprintState(repoPath);
  const indexContent = await fs.readFile(
    path.join(repoPath, ".blueprint/workstreams/WORKSTREAMS.md"),
    "utf8"
  );
  const restoredAlphaState = JSON.parse(
    await fs.readFile(
      path.join(repoPath, ".blueprint/workstreams/alpha-stream/state.json"),
      "utf8"
    )
  ) as { status: string };

  assert.equal(listed.active?.slug, "beta-stream");
  assert.equal(restoredAlphaState.status, "paused");
  assert.match(indexContent, /Active workstream: `Beta Stream`/);
  assert.equal(storedState.currentPhase, "1");
  assert.deepEqual(storedState.roadmapEvolutionNotes, [
    "Concurrent state update must survive."
  ]);
});

test("concurrent workstream creates serialize without losing index entries", async (t) => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "blueprint-workstreams-concurrent-create-")
  );
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");

  const [alpha, beta] = await Promise.all([
    blueprintWorkstreamMutate({
      cwd: repoPath,
      operation: "create",
      workstream: "Alpha Stream"
    }),
    blueprintWorkstreamMutate({
      cwd: repoPath,
      operation: "create",
      workstream: "Beta Stream"
    })
  ]);
  const listed = await blueprintWorkstreamList({ cwd: repoPath });
  const indexContent = await fs.readFile(
    path.join(repoPath, ".blueprint/workstreams/WORKSTREAMS.md"),
    "utf8"
  );

  assert.equal(alpha.status, "updated");
  assert.equal(beta.status, "updated");
  assert.equal(listed.status, "ready");
  assert.equal(listed.summary.total, 2);
  assert.equal(listed.summary.active, 1);
  assert.equal(listed.summary.paused, 1);
  assert.ok(listed.workstreams.some((entry) => entry.slug === "alpha-stream"));
  assert.ok(listed.workstreams.some((entry) => entry.slug === "beta-stream"));
  assert.match(indexContent, /`alpha-stream`/);
  assert.match(indexContent, /`beta-stream`/);
});

test("workstream transition stale recovery preserves a replacement lock held by another waiter", async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-workstreams-stale-lock-"));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const repoPath = await createBlueprintRepo(tempRoot, "repo");
  const workstreamLockPath = path.join(repoPath, ".blueprint/locks/workstreams.lock");
  const firstObservedStale = deferred<void>();
  const releaseFirstObserverRecovery = deferred<void>();
  const replacementStateDirectory = path.join(
    repoPath,
    ".blueprint/workstreams/replacement-owner"
  );
  const replacementPause = pauseFirstMkdirToPath(t, replacementStateDirectory);
  let staleRecoveryAttempts = 0;

  await fs.mkdir(workstreamLockPath, { recursive: true });
  await fs.writeFile(path.join(workstreamLockPath, "owner"), "abandoned-owner\n", "utf8");
  await fs.writeFile(path.join(workstreamLockPath, "lease"), "abandoned-owner\n", "utf8");
  await sleep(80);

  const restoreHooks = workspaceToolTestHooks.setWorkspaceRegistryLockRecoveryHooksForTest({
    beforeStaleRecoveryClaim: async (observedLockPath) => {
      assert.equal(observedLockPath, workstreamLockPath);
      staleRecoveryAttempts += 1;

      if (staleRecoveryAttempts === 1) {
        firstObservedStale.resolve();
        await releaseFirstObserverRecovery.promise;
      }
    }
  });
  t.after(() => {
    restoreHooks();
    releaseFirstObserverRecovery.resolve();
    replacementPause.resume();
  });

  await withEnvironment(
    {
      BLUEPRINT_TEST_WORKSPACE_REGISTRY_LOCK_RETRY_MS: "5",
      BLUEPRINT_TEST_WORKSPACE_REGISTRY_LOCK_STALE_MS: "40",
      BLUEPRINT_TEST_WORKSPACE_REGISTRY_LOCK_HEARTBEAT_MS: "10"
    },
    async () => {
      const firstObserver = blueprintWorkstreamMutate({
        cwd: repoPath,
        operation: "create",
        workstream: "First Observer"
      });

      await waitFor(firstObservedStale.promise, "first workstream stale observer");

      const replacement = blueprintWorkstreamMutate({
        cwd: repoPath,
        operation: "create",
        workstream: "Replacement Owner"
      });

      await waitFor(replacementPause.paused, "replacement workstream lock holder");
      const replacementOwner = await fs.readFile(path.join(workstreamLockPath, "owner"), "utf8");

      releaseFirstObserverRecovery.resolve();
      await sleep(90);

      assert.equal(await fs.readFile(path.join(workstreamLockPath, "owner"), "utf8"), replacementOwner);
      await assert.rejects(
        fs.access(path.join(repoPath, ".blueprint/workstreams/first-observer"))
      );

      replacementPause.resume();
      await Promise.all([replacement, firstObserver]);
    }
  );

  const listed = await blueprintWorkstreamList({ cwd: repoPath });
  assert.equal(listed.status, "ready");
  assert.deepEqual(
    listed.workstreams.map((workstream) => workstream.slug).sort(),
    ["first-observer", "replacement-owner"]
  );
  assert.equal(staleRecoveryAttempts, 2);
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
    workstream: "beta-stream",
    confirmed: true
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
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "snapshot workstreams"], repoPath);
  await fs.rm(path.join(repoPath, ".blueprint/STATE.md"), { force: true });

  const blocked = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "switch",
    workstream: "beta-stream",
    confirmed: true
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
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "snapshot workstreams"], repoPath);
  await fs.writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    "# Blueprint State\n\n- Project status: active\n",
    "utf8"
  );

  const blocked = await blueprintWorkstreamMutate({
    cwd: repoPath,
    operation: "switch",
    workstream: "beta-stream",
    confirmed: true
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
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "snapshot alpha workstream"], repoPath);
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
    workstream: "alpha-stream",
    confirmed: true
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
