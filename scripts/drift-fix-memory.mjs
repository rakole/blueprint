#!/usr/bin/env node

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const DEFAULT_NAMESPACE = "wave-2-closeout";
const DEFAULT_PLAN_DOC =
  "docs/build/WAVE-2-PARALLEL-CLOSEOUT-PLAN.md";
const DEFAULT_ROOT =
  process.env.BLUEPRINT_DRIFT_MEMORY_ROOT ??
  path.join(
    os.homedir(),
    ".gemini",
    "blueprint",
    "agent-memory",
    DEFAULT_NAMESPACE
  );

function usage(exitCode = 0) {
  const text = `
Usage:
  node scripts/drift-fix-memory.mjs init [--root PATH] [--plan PATH] [--branch NAME]
  node scripts/drift-fix-memory.mjs where [--root PATH]
  node scripts/drift-fix-memory.mjs status [--root PATH]
  node scripts/drift-fix-memory.mjs register-agent --agent ID [--worktree PATH] [--branch NAME] [--note TEXT] [--root PATH]
  node scripts/drift-fix-memory.mjs claim --agent ID --task ID [--summary TEXT] [--worktree PATH] [--branch NAME] [--root PATH]
  node scripts/drift-fix-memory.mjs release --agent ID --task ID [--reason TEXT] [--root PATH]
  node scripts/drift-fix-memory.mjs complete --agent ID --task ID [--summary TEXT] [--tests TEXT] [--files CSV] [--no-files-reason TEXT] [--root PATH]
  node scripts/drift-fix-memory.mjs block --agent ID --task ID --reason TEXT [--root PATH]
  node scripts/drift-fix-memory.mjs note --agent ID [--task ID] --title TEXT (--body TEXT | --body-file PATH) [--kind KIND] [--root PATH]
  node scripts/drift-fix-memory.mjs cleanup [--root PATH]
`;

  const stream = exitCode === 0 ? process.stdout : process.stderr;

  stream.write(`${text.trim()}\n`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    usage(0);
  }

  const args = { _: [] };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = rest[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return { command, args };
}

function requireArg(args, key) {
  const value = args[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required argument: --${key}`);
  }

  return value.trim();
}

function nowIso() {
  return new Date().toISOString();
}

function timestampForFile() {
  return nowIso().replaceAll(":", "-");
}

function safeSegment(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function csvToList(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return [];
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeRepoFile(filePath, worktree) {
  const trimmed = filePath.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const relative = path.isAbsolute(trimmed)
    ? path.relative(worktree, trimmed)
    : trimmed.replace(/^[.][/\\]/, "");

  if (
    relative.length === 0 ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `File ${trimmed} must stay inside the claimed worktree ${worktree}.`
    );
  }

  return relative.split(path.sep).join("/");
}

function runGit(worktree, args) {
  return spawnSync("git", args, {
    cwd: worktree,
    encoding: "utf8"
  });
}

function readGitFileList(worktree, args) {
  const result = runGit(worktree, args);

  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(path.sep).join("/"));
}

function resolveGitBaseRef(worktree) {
  const upstream = runGit(worktree, [
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{upstream}"
  ]);

  if (upstream.status === 0) {
    return upstream.stdout.trim();
  }

  for (const candidate of ["origin/main", "main"]) {
    const probe = runGit(worktree, ["rev-parse", "--verify", candidate]);

    if (probe.status === 0) {
      return candidate;
    }
  }

  return null;
}

function collectCompletionEvidence(worktree, files) {
  const insideGit = runGit(worktree, ["rev-parse", "--show-toplevel"]);

  if (insideGit.status !== 0) {
    throw new Error(`Claimed worktree is not a git repository: ${worktree}`);
  }

  const changedFiles = new Set();
  const fileArgs = ["--", ...files];

  for (const line of readGitFileList(worktree, [
    "diff",
    "--name-only",
    "--relative",
    ...fileArgs
  ])) {
    changedFiles.add(line);
  }

  for (const line of readGitFileList(worktree, [
    "diff",
    "--cached",
    "--name-only",
    "--relative",
    ...fileArgs
  ])) {
    changedFiles.add(line);
  }

  for (const line of readGitFileList(worktree, [
    "ls-files",
    "--others",
    "--exclude-standard",
    ...fileArgs
  ])) {
    changedFiles.add(line);
  }

  const baseRef = resolveGitBaseRef(worktree);

  if (baseRef) {
    for (const line of readGitFileList(worktree, [
      "diff",
      "--name-only",
      `${baseRef}...HEAD`,
      "--",
      ...files
    ])) {
      changedFiles.add(line);
    }
  }

  return Array.from(changedFiles).sort();
}

function validateCompletionFiles(claim, rawFiles, noFilesReason) {
  if (typeof noFilesReason === "string" && noFilesReason.trim().length > 0) {
    return {
      files: [],
      noFilesReason: noFilesReason.trim(),
      verifiedFiles: []
    };
  }

  if (rawFiles.length === 0) {
    throw new Error(
      "Completion requires --files with changed repo paths or --no-files-reason for an explicit no-op closeout."
    );
  }

  const worktree =
    typeof claim.worktree === "string" && claim.worktree.trim().length > 0
      ? path.resolve(claim.worktree)
      : process.cwd();
  const files = rawFiles
    .map((file) => normalizeRepoFile(file, worktree))
    .filter(Boolean);

  if (files.length === 0) {
    throw new Error(
      "Completion requires at least one repo-relative file path in --files."
    );
  }

  const changedFiles = collectCompletionEvidence(worktree, files);
  const changedSet = new Set(changedFiles);
  const missingEvidence = files.filter((file) => !changedSet.has(file));

  if (missingEvidence.length > 0) {
    throw new Error(
      `Completion for ${claim.taskId} requires verifiable file changes. No change evidence found for: ${missingEvidence.join(", ")}`
    );
  }

  return {
    files,
    noFilesReason: null,
    verifiedFiles: changedFiles
  };
}

function resolveRoot(args) {
  const root = typeof args.root === "string" && args.root.trim().length > 0
    ? args.root.trim()
    : DEFAULT_ROOT;

  return path.resolve(root);
}

function buildPaths(root) {
  return {
    root,
    manifest: path.join(root, "manifest.json"),
    readme: path.join(root, "README.md"),
    claims: path.join(root, "claims"),
    completed: path.join(root, "completed"),
    blocked: path.join(root, "blocked"),
    agents: path.join(root, "agents"),
    notesShared: path.join(root, "notes", "shared"),
    notesTasks: path.join(root, "notes", "tasks"),
    scratch: path.join(root, "scratch")
  };
}

async function ensureLayout(paths) {
  await fs.mkdir(paths.claims, { recursive: true });
  await fs.mkdir(paths.completed, { recursive: true });
  await fs.mkdir(paths.blocked, { recursive: true });
  await fs.mkdir(paths.agents, { recursive: true });
  await fs.mkdir(paths.notesShared, { recursive: true });
  await fs.mkdir(paths.notesTasks, { recursive: true });
  await fs.mkdir(paths.scratch, { recursive: true });
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readDirJson(dirPath) {
  if (!existsSync(dirPath)) {
    return [];
  }

  const entries = await fs.readdir(dirPath);
  const files = entries.filter((entry) => entry.endsWith(".json")).sort();

  return Promise.all(files.map((entry) => readJson(path.join(dirPath, entry))));
}

async function readManifest(paths) {
  if (!existsSync(paths.manifest)) {
    throw new Error(
      `Shared drift memory is not initialized at ${paths.root}. Run init first.`
    );
  }

  return readJson(paths.manifest);
}

async function writeManifest(paths, patch) {
  const existing = existsSync(paths.manifest)
    ? await readJson(paths.manifest)
    : {};
  const nextManifest = {
    namespace: DEFAULT_NAMESPACE,
    repo: "blueprint",
    planDoc: DEFAULT_PLAN_DOC,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...existing,
    ...patch
  };

  await writeJson(paths.manifest, nextManifest);
  return nextManifest;
}

function renderReadme(root, manifest) {
  return `# Temporary Drift-Fix Memory

This directory is shared across Blueprint worktrees during the current drift-fix
repair round. It is intentionally outside git so multiple agents can coordinate
without colliding on repo files.

- Namespace: \`${manifest.namespace}\`
- Repo: \`${manifest.repo}\`
- Plan doc: \`${manifest.planDoc}\`
- Initialized from: \`${manifest.initializedFrom}\`
- Active branch when initialized: \`${manifest.initialBranch ?? "unknown"}\`

## Commands

\`\`\`bash
node scripts/drift-fix-memory.mjs status
node scripts/drift-fix-memory.mjs register-agent --agent AGENT_ID --worktree "$PWD" --branch "$(git branch --show-current)"
node scripts/drift-fix-memory.mjs claim --agent AGENT_ID --task DF-001
node scripts/drift-fix-memory.mjs note --agent AGENT_ID --task DF-001 --title "Finding" --body "Short note"
node scripts/drift-fix-memory.mjs complete --agent AGENT_ID --task DF-001 --summary "Done" --tests "npm test -- --test-name-pattern=..." --files "path/to/file.ts"
\`\`\`

## Directory Layout

- \`claims/\`: active task claims. Presence means a task is in progress.
- \`completed/\`: one JSON record per completed task.
- \`blocked/\`: blocked-task records that describe why progress stopped.
- \`agents/\`: latest registration data per agent or worktree.
- \`notes/shared/\`: shared discoveries for all agents.
- \`notes/tasks/<TASK>/\`: task-scoped notes, handoffs, and test findings.
- \`scratch/\`: ad hoc local artifacts that help agents coordinate.

## Cleanup

Delete \`${root}\` after the repair round closes, or run:

\`\`\`bash
node scripts/drift-fix-memory.mjs cleanup
\`\`\`
`;
}

async function initCommand(args) {
  const root = resolveRoot(args);
  const paths = buildPaths(root);

  await ensureLayout(paths);

  const manifest = await writeManifest(paths, {
    planDoc:
      typeof args.plan === "string" && args.plan.trim().length > 0
        ? args.plan.trim()
        : DEFAULT_PLAN_DOC,
    initializedFrom: process.cwd(),
    initialBranch:
      typeof args.branch === "string" && args.branch.trim().length > 0
        ? args.branch.trim()
        : null
  });

  await fs.writeFile(paths.readme, renderReadme(root, manifest), "utf8");
  process.stdout.write(`${root}\n`);
}

async function whereCommand(args) {
  process.stdout.write(`${resolveRoot(args)}\n`);
}

async function registerAgentCommand(args) {
  const root = resolveRoot(args);
  const paths = buildPaths(root);
  const agentId = requireArg(args, "agent");

  await ensureLayout(paths);
  const manifest = await readManifest(paths);
  const record = {
    agentId,
    worktree:
      typeof args.worktree === "string" && args.worktree.trim().length > 0
        ? path.resolve(args.worktree.trim())
        : process.cwd(),
    branch:
      typeof args.branch === "string" && args.branch.trim().length > 0
        ? args.branch.trim()
        : null,
    note:
      typeof args.note === "string" && args.note.trim().length > 0
        ? args.note.trim()
        : null,
    updatedAt: nowIso(),
    namespace: manifest.namespace
  };

  await writeJson(path.join(paths.agents, `${safeSegment(agentId)}.json`), record);
  process.stdout.write(`registered ${agentId}\n`);
}

async function claimCommand(args) {
  const root = resolveRoot(args);
  const paths = buildPaths(root);
  const agentId = requireArg(args, "agent");
  const taskId = requireArg(args, "task");
  const claimPath = path.join(paths.claims, `${taskId}.json`);
  const completedPath = path.join(paths.completed, `${taskId}.json`);

  await ensureLayout(paths);
  await readManifest(paths);

  if (existsSync(completedPath)) {
    throw new Error(`Task ${taskId} is already completed.`);
  }

  const claim = {
    taskId,
    agentId,
    summary:
      typeof args.summary === "string" && args.summary.trim().length > 0
        ? args.summary.trim()
        : null,
    worktree:
      typeof args.worktree === "string" && args.worktree.trim().length > 0
        ? path.resolve(args.worktree.trim())
        : process.cwd(),
    branch:
      typeof args.branch === "string" && args.branch.trim().length > 0
        ? args.branch.trim()
        : null,
    claimedAt: nowIso()
  };

  try {
    await fs.writeFile(claimPath, `${JSON.stringify(claim, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx"
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      const activeClaim = await readJson(claimPath);
      throw new Error(
        `Task ${taskId} is already claimed by ${activeClaim.agentId} since ${activeClaim.claimedAt}.`
      );
    }

    throw error;
  }

  process.stdout.write(`claimed ${taskId}\n`);
}

async function releaseCommand(args) {
  const root = resolveRoot(args);
  const paths = buildPaths(root);
  const agentId = requireArg(args, "agent");
  const taskId = requireArg(args, "task");
  const claimPath = path.join(paths.claims, `${taskId}.json`);

  await readManifest(paths);

  if (!existsSync(claimPath)) {
    throw new Error(`Task ${taskId} is not currently claimed.`);
  }

  const claim = await readJson(claimPath);

  if (claim.agentId !== agentId) {
    throw new Error(`Task ${taskId} is claimed by ${claim.agentId}, not ${agentId}.`);
  }

  await fs.unlink(claimPath);

  if (typeof args.reason === "string" && args.reason.trim().length > 0) {
    const noteArgs = {
      root,
      agent: agentId,
      task: taskId,
      title: "Claim released",
      body: args.reason.trim(),
      kind: "handoff"
    };

    await noteCommand(noteArgs);
  }

  process.stdout.write(`released ${taskId}\n`);
}

async function completeCommand(args) {
  const root = resolveRoot(args);
  const paths = buildPaths(root);
  const agentId = requireArg(args, "agent");
  const taskId = requireArg(args, "task");
  const claimPath = path.join(paths.claims, `${taskId}.json`);
  const completedPath = path.join(paths.completed, `${taskId}.json`);

  await readManifest(paths);

  if (!existsSync(claimPath)) {
    throw new Error(`Task ${taskId} is not currently claimed.`);
  }

  const claim = await readJson(claimPath);

  if (claim.agentId !== agentId) {
    throw new Error(`Task ${taskId} is claimed by ${claim.agentId}, not ${agentId}.`);
  }

  const fileValidation = validateCompletionFiles(
    claim,
    csvToList(args.files),
    typeof args["no-files-reason"] === "string" ? args["no-files-reason"] : null
  );

  const completion = {
    ...claim,
    completedAt: nowIso(),
    summary:
      typeof args.summary === "string" && args.summary.trim().length > 0
        ? args.summary.trim()
        : claim.summary,
    tests:
      typeof args.tests === "string" && args.tests.trim().length > 0
        ? args.tests.trim()
        : null,
    files: fileValidation.files,
    noFilesReason: fileValidation.noFilesReason,
    verifiedFiles: fileValidation.verifiedFiles
  };

  await writeJson(completedPath, completion);
  await fs.unlink(claimPath);
  process.stdout.write(`completed ${taskId}\n`);
}

async function blockCommand(args) {
  const root = resolveRoot(args);
  const paths = buildPaths(root);
  const agentId = requireArg(args, "agent");
  const taskId = requireArg(args, "task");
  const reason = requireArg(args, "reason");
  const claimPath = path.join(paths.claims, `${taskId}.json`);

  await readManifest(paths);

  const blocked = {
    taskId,
    agentId,
    reason,
    blockedAt: nowIso()
  };

  if (existsSync(claimPath)) {
    const claim = await readJson(claimPath);

    if (claim.agentId !== agentId) {
      throw new Error(`Task ${taskId} is claimed by ${claim.agentId}, not ${agentId}.`);
    }

    blocked.claim = claim;
    await fs.unlink(claimPath);
  }

  const fileName = `${taskId}-${timestampForFile()}-${safeSegment(agentId)}.json`;
  await writeJson(path.join(paths.blocked, fileName), blocked);
  process.stdout.write(`blocked ${taskId}\n`);
}

async function noteCommand(args) {
  const root = resolveRoot(args);
  const paths = buildPaths(root);
  const agentId = requireArg(args, "agent");
  const title = requireArg(args, "title");

  await ensureLayout(paths);
  await readManifest(paths);

  let body = null;

  if (typeof args.body === "string" && args.body.trim().length > 0) {
    body = args.body.trim();
  }

  if (!body && typeof args["body-file"] === "string") {
    body = (await fs.readFile(path.resolve(args["body-file"]), "utf8")).trim();
  }

  if (!body) {
    throw new Error("Provide either --body or --body-file.");
  }

  const taskId =
    typeof args.task === "string" && args.task.trim().length > 0 ? args.task.trim() : null;
  const kind =
    typeof args.kind === "string" && args.kind.trim().length > 0 ? args.kind.trim() : "note";
  const directory = taskId
    ? path.join(paths.notesTasks, taskId)
    : paths.notesShared;

  await fs.mkdir(directory, { recursive: true });

  const fileName = `${timestampForFile()}-${safeSegment(agentId)}-${safeSegment(title) || "note"}.md`;
  const content = `# ${title}

- Agent: \`${agentId}\`
- Kind: \`${kind}\`
- Created: \`${nowIso()}\`
${taskId ? `- Task: \`${taskId}\`\n` : ""}\

${body}
`;

  await fs.writeFile(path.join(directory, fileName), content, "utf8");
  process.stdout.write(`noted ${title}\n`);
}

async function statusCommand(args) {
  const root = resolveRoot(args);
  const paths = buildPaths(root);
  const manifest = await readManifest(paths);
  const claims = await readDirJson(paths.claims);
  const completed = await readDirJson(paths.completed);
  const blocked = await readDirJson(paths.blocked);
  const agents = await readDirJson(paths.agents);

  process.stdout.write(`memoryRoot: ${root}\n`);
  process.stdout.write(`planDoc: ${manifest.planDoc}\n`);
  process.stdout.write(`activeClaims: ${claims.length}\n`);

  for (const claim of claims) {
    process.stdout.write(
      `- ${claim.taskId}: ${claim.agentId} @ ${claim.claimedAt}${
        claim.branch ? ` [${claim.branch}]` : ""
      }\n`
    );
  }

  process.stdout.write(`completed: ${completed.length}\n`);
  process.stdout.write(`blockedRecords: ${blocked.length}\n`);
  process.stdout.write(`registeredAgents: ${agents.length}\n`);
}

async function cleanupCommand(args) {
  const root = resolveRoot(args);

  if (root === "/" || root.length < 10) {
    throw new Error(`Refusing to remove suspicious root: ${root}`);
  }

  if (!existsSync(root)) {
    process.stdout.write(`nothing to clean: ${root}\n`);
    return;
  }

  await fs.rm(root, { recursive: true, force: true });
  process.stdout.write(`removed ${root}\n`);
}

async function main() {
  const { command, args } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "init":
      await initCommand(args);
      return;
    case "where":
      await whereCommand(args);
      return;
    case "status":
      await statusCommand(args);
      return;
    case "register-agent":
      await registerAgentCommand(args);
      return;
    case "claim":
      await claimCommand(args);
      return;
    case "release":
      await releaseCommand(args);
      return;
    case "complete":
      await completeCommand(args);
      return;
    case "block":
      await blockCommand(args);
      return;
    case "note":
      await noteCommand(args);
      return;
    case "cleanup":
      await cleanupCommand(args);
      return;
    default:
      usage(1);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
