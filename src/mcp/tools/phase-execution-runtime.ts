import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

const MAX_MUTATION_BYTES = 8 * 1024 * 1024;
const MAX_VERIFICATION_COMMANDS = 32;
const MAX_VERIFICATION_COMMAND_BYTES = 8 * 1024;
const MAX_RECEIPT_OUTPUT_BYTES = 64 * 1024;
const MAX_PROCESS_OUTPUT_BUFFER_BYTES = 16 * 1024 * 1024;
const DEFAULT_VERIFICATION_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_PINNED_WORKER_TIMEOUT_MS = 30_000;
const DEFAULT_PINNED_WORKER_CLOSE_TIMEOUT_MS = 5_000;
const MIN_PINNED_WORKER_READY_TIMEOUT_MS = 1_000;

const PINNED_MUTATION_WORKER_SOURCE = String.raw`
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { createInterface } from "node:readline";

const entries = new Map();
let finalized = false;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const safeName = (value) => {
  if (!value || value === "." || value === ".." || value.includes("/") || value.includes("\\") || value.includes("\0")) {
    throw new Error("Pinned mutation worker received an unsafe basename.");
  }
  return value;
};
const readTarget = async (name) => {
  try {
    const stats = await fs.lstat(name);
    if (stats.isSymbolicLink() || !stats.isFile()) throw new Error("Mutation target must be a regular file.");
    const content = await fs.readFile(name);
    return { content, hash: hash(content), mode: stats.mode & 0o7777 };
  } catch (error) {
    if (error?.code === "ENOENT") return { content: null, hash: null, mode: null };
    throw error;
  }
};
const rollback = async () => {
  const failures = [];
  const cleanupPaths = [];
  for (const entry of [...entries.values()].reverse()) {
    try {
      let quarantined = false;
      if (entry.committed) {
        try {
          await fs.lstat(entry.name);
          await fs.rename(entry.name, entry.quarantine);
          quarantined = true;
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      }
      if (entry.backupCreated) {
        await fs.rename(entry.backup, entry.name);
        entry.backupCreated = false;
      }
      if (quarantined) {
        let removeQuarantine = false;
        try {
          const stats = await fs.lstat(entry.quarantine);
          if (stats.isFile() && !stats.isSymbolicLink()) {
            const content = await fs.readFile(entry.quarantine);
            const expected = entry.operation === "write" ? hash(entry.content) : null;
            removeQuarantine = hash(content) === expected;
          }
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
        if (removeQuarantine) await fs.rm(entry.quarantine, { force: true });
        else cleanupPaths.push(entry.quarantine);
      }
      if (entry.staged) {
        await fs.rm(entry.staged, { force: true });
        entry.staged = null;
      }
      entry.committed = false;
    } catch (error) {
      failures.push(entry.name + ": " + (error instanceof Error ? error.message : String(error)));
      for (const candidate of [entry.backupCreated ? entry.backup : null, entry.staged, entry.quarantine]) {
        if (candidate) cleanupPaths.push(candidate);
      }
    }
  }
  return { failures, cleanupPaths: [...new Set(cleanupPaths)] };
};
const handle = async (request) => {
  if (request.action === "prepare") {
    for (const mutation of request.mutations) {
      const name = safeName(mutation.name);
      if (entries.has(name)) throw new Error("Duplicate pinned mutation basename.");
      const current = await readTarget(name);
      if (current.hash !== mutation.expectedHash) throw new Error("Mutation preimage is stale for " + name + ".");
      if (mutation.operation === "delete" && current.content === null) throw new Error("Delete target does not exist: " + name + ".");
      const staged = mutation.operation === "write" ? mutation.staged : null;
      if (staged) {
        safeName(staged);
        await fs.writeFile(staged, mutation.content, { encoding: "utf8", flag: "wx" });
        if (current.mode !== null) await fs.chmod(staged, current.mode);
      }
      entries.set(name, {
        ...mutation,
        name,
        staged,
        backup: safeName(mutation.backup),
        quarantine: safeName(mutation.quarantine),
        beforeHash: current.hash,
        beforeMode: current.mode,
        beforeBytes: current.content?.byteLength ?? 0,
        backupCreated: false,
        committed: false
      });
    }
    return { status: "prepared" };
  }
  if (request.action === "commit") {
    try {
      for (const entry of entries.values()) {
        const current = await readTarget(entry.name);
        if (current.hash !== entry.beforeHash) throw new Error("Mutation preimage changed before commit: " + entry.name + ".");
        if (entry.beforeHash !== null) {
          await fs.rename(entry.name, entry.backup);
          entry.backupCreated = true;
        }
        if (entry.operation === "write") {
          await fs.rename(entry.staged, entry.name);
          entry.staged = null;
        }
        entry.committed = true;
        const observed = await readTarget(entry.name);
        const expected = entry.operation === "write" ? hash(entry.content) : null;
        if (observed.hash !== expected) throw new Error("Mutation postimage mismatch: " + entry.name + ".");
      }
      if (request.crashAfterCommit) process.kill(process.pid, "SIGKILL");
      if (request.stopAfterCommit) process.kill(process.pid, "SIGSTOP");
      return { status: "committed" };
    } catch (error) {
      const rollbackResult = await rollback();
      return {
        status: rollbackResult.failures.length ? "rollback-failed" : "rejected",
        failure: error instanceof Error ? error.message : String(error),
        rollbackFailures: rollbackResult.failures,
        cleanupPaths: rollbackResult.cleanupPaths
      };
    }
  }
  if (request.action === "rollback") {
    const rollbackResult = await rollback();
    return {
      status: rollbackResult.failures.length ? "rollback-failed" : "rolled-back",
      rollbackFailures: rollbackResult.failures,
      cleanupPaths: rollbackResult.cleanupPaths
    };
  }
  if (request.action === "observe") {
    const receipts = [];
    for (const entry of entries.values()) {
      const observed = await readTarget(entry.name);
      receipts.push({
        path: entry.path,
        operation: entry.operation,
        beforeHash: entry.beforeHash,
        beforeMode: entry.beforeMode,
        afterHash: observed.hash,
        afterMode: observed.mode,
        bytesWritten: observed.content?.byteLength ?? 0
      });
    }
    return { status: "observed", receipts };
  }
  if (request.action === "seal") {
    finalized = true;
    return { status: "sealed" };
  }
  if (request.action === "cleanup") {
    if (!finalized) throw new Error("Pinned mutation cleanup requires a sealed commit.");
    if (request.crashDuringCleanup) process.kill(process.pid, "SIGKILL");
    if (request.stopDuringCleanup) process.kill(process.pid, "SIGSTOP");
    const cleanupPaths = [];
    for (const entry of entries.values()) {
      for (const candidate of [entry.backupCreated ? entry.backup : null, entry.staged]) {
        if (!candidate) continue;
        try {
          await fs.rm(candidate, { force: true });
        } catch {
          cleanupPaths.push(candidate);
        }
      }
    }
    return { status: cleanupPaths.length ? "cleanup-required" : "clean", cleanupPaths };
  }
  throw new Error("Unknown pinned mutation worker action.");
};

const parentStats = await fs.stat(".");
if (String(parentStats.dev) !== process.env.BLUEPRINT_PARENT_DEV || String(parentStats.ino) !== process.env.BLUEPRINT_PARENT_INO) {
  throw new Error("Pinned mutation parent identity changed before worker startup.");
}
process.stdout.write(JSON.stringify({ id: 0, ok: true, result: { status: "ready" } }) + "\n");
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  let request;
  try {
    request = JSON.parse(line);
    const result = await handle(request);
    process.stdout.write(JSON.stringify({ id: request.id, ok: true, result }) + "\n");
  } catch (error) {
    process.stdout.write(JSON.stringify({
      id: request?.id ?? -1,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }) + "\n");
  }
}
if (!finalized) await rollback();
`;

export type PhaseExecutionFileMutation = {
  path: string;
  operation: "write" | "delete";
  content?: string;
  expectedHash: string | null;
};

export type PhaseExecutionMutationReceipt = {
  path: string;
  operation: "write" | "delete";
  beforeHash: string | null;
  beforeMode: number | null;
  afterHash: string | null;
  afterMode: number | null;
  bytesWritten: number;
};

export type PhaseExecutionMutationResult = {
  status:
    | "committed"
    | "committed-cleanup-required"
    | "postimage-diverged"
    | "rolled-back"
    | "rollback-failed";
  receipts: PhaseExecutionMutationReceipt[];
  cleanupPaths: string[];
  failure: string | null;
  rollbackFailures: string[];
};

export type PhaseExecutionProcessResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  outputLimitExceeded?: boolean;
};

export type PhaseExecutionProcessRunner = (
  command: string,
  argv: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number
) => Promise<PhaseExecutionProcessResult>;

export type PhaseExecutionVerificationReceipt = {
  command: string;
  argv: ["-c", string];
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  passed: boolean;
  stdout: string;
  stdoutBytes: number;
  stdoutHash: string;
  stdoutTruncated: boolean;
  stderr: string;
  stderrBytes: number;
  stderrHash: string;
  stderrTruncated: boolean;
};

export type PhaseExecutionGitObservation = {
  head: string;
  changedPaths: string[];
  unauthorizedChangedPaths: string[];
};

type PhaseExecutionMutationFileSystem = Pick<
  typeof fs,
  | "access"
  | "chmod"
  | "lstat"
  | "mkdir"
  | "readFile"
  | "realpath"
  | "rename"
  | "rm"
  | "writeFile"
>;

type PreparedMutation = {
  mutation: PhaseExecutionFileMutation;
  absolutePath: string;
  beforeHash: string | null;
  beforeMode: number | null;
  stagedPath: string | null;
  backupPath: string;
  backupCreated: boolean;
  committed: boolean;
  observedAfterHash: string | null;
  observedAfterBytes: number;
  observedAfterMode: number | null;
};

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isMissingPathError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}

function normalizeRepoRelativePath(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.includes("\0")) {
    throw new Error(`${label} must be a non-empty repo-relative path without NUL bytes.`);
  }

  const normalized = value.trim();

  if (
    normalized.includes("\\") ||
    path.posix.isAbsolute(normalized) ||
    normalized === "." ||
    normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`${label} must be a canonical repo-relative path.`);
  }

  const firstSegment = normalized.split("/")[0]?.toLowerCase();

  if (firstSegment === ".git" || firstSegment === ".blueprint") {
    throw new Error(`${label} must not target Git or Blueprint-owned state.`);
  }

  return normalized;
}

function normalizeObservedRepoPath(value: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0") ||
    value.includes("\\") ||
    path.posix.isAbsolute(value) ||
    value.split("/").some((segment) => segment === "" || segment === "." || segment === "..") ||
    value === ".git" ||
    value.startsWith(".git/")
  ) {
    throw new Error("git.changedPath must be a canonical repo-relative path.");
  }
  return value;
}

function normalizeAuthorizedPath(value: string): { path: string; directory: boolean } {
  const directory = value.endsWith("/");
  const normalized = normalizeRepoRelativePath(
    directory ? value.slice(0, -1) : value,
    "authorizedFiles"
  );

  return { path: normalized, directory };
}

function isAuthorizedPath(
  filePath: string,
  authorized: readonly { path: string; directory: boolean }[]
): boolean {
  return authorized.some((entry) =>
    entry.directory
      ? filePath === entry.path || filePath.startsWith(`${entry.path}/`)
      : filePath === entry.path
  );
}

async function assertNoSymlinkTraversal(
  root: string,
  relativePath: string,
  fileSystem: PhaseExecutionMutationFileSystem
): Promise<void> {
  const segments = relativePath.split("/");
  let current = root;

  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index] ?? "");

    try {
      const stats = await fileSystem.lstat(current);

      if (stats.isSymbolicLink()) {
        throw new Error(`Mutation path traverses a symbolic link: ${relativePath}`);
      }

      if (index < segments.length - 1 && !stats.isDirectory()) {
        throw new Error(`Mutation path parent is not a directory: ${relativePath}`);
      }

      if (index === segments.length - 1 && !stats.isFile()) {
        throw new Error(`Mutation target is not a regular file: ${relativePath}`);
      }
    } catch (error) {
      if (isMissingPathError(error)) {
        return;
      }
      throw error;
    }
  }
}

async function assertMutationParentContained(
  root: string,
  absolutePath: string,
  relativePath: string,
  fileSystem: PhaseExecutionMutationFileSystem
): Promise<void> {
  const realParent = await fileSystem.realpath(path.dirname(absolutePath));

  if (realParent !== root && !realParent.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Mutation parent escapes the canonical repository: ${relativePath}`);
  }
}

async function readExistingFile(
  filePath: string,
  fileSystem: PhaseExecutionMutationFileSystem
): Promise<{ content: Buffer | null; mode: number | null }> {
  try {
    const stats = await fileSystem.lstat(filePath);

    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error(`Mutation target must be a regular file: ${filePath}`);
    }

    return {
      content: await fileSystem.readFile(filePath),
      mode: stats.mode & 0o7777
    };
  } catch (error) {
    if (isMissingPathError(error)) {
      return { content: null, mode: null };
    }
    throw error;
  }
}

function tempSibling(filePath: string, kind: "staged" | "backup"): string {
  return path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.blueprint-execute-${kind}-${process.pid}-${randomUUID()}`
  );
}

type PinnedWorkerResponse = {
  status: string;
  failure?: string;
  rollbackFailures?: string[];
  cleanupPaths?: string[];
  receipts?: PhaseExecutionMutationReceipt[];
};

class PinnedMutationWorker {
  readonly parentPath: string;
  readonly parentRelativePath: string;
  readonly expectedDev: string;
  readonly expectedIno: string;
  private readonly child: ReturnType<typeof spawn>;
  private readonly pending = new Map<number, {
    resolve: (value: PinnedWorkerResponse) => void;
    reject: (error: Error) => void;
  }>();
  private nextId = 1;
  private stderr = "";
  private readonly readyPromise: Promise<void>;
  private readonly readyTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly closeTimeoutMs: number;
  private readonly withholdCloseExitSignal: boolean;

  constructor(args: {
    parentPath: string;
    parentRelativePath: string;
    dev: string;
    ino: string;
    requestTimeoutMs: number;
    readyTimeoutMs: number;
    closeTimeoutMs: number;
    withholdCloseExitSignal: boolean;
  }) {
    this.parentPath = args.parentPath;
    this.parentRelativePath = args.parentRelativePath;
    this.expectedDev = args.dev;
    this.expectedIno = args.ino;
    this.requestTimeoutMs = args.requestTimeoutMs;
    this.readyTimeoutMs = args.readyTimeoutMs;
    this.closeTimeoutMs = args.closeTimeoutMs;
    this.withholdCloseExitSignal = args.withholdCloseExitSignal;
    this.child = spawn(
      process.execPath,
      ["--input-type=module", "-e", PINNED_MUTATION_WORKER_SOURCE],
      {
        cwd: args.parentPath,
        env: {
          ...process.env,
          BLUEPRINT_PARENT_DEV: args.dev,
          BLUEPRINT_PARENT_INO: args.ino
        },
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true
      }
    );
    this.readyPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(0);
        this.child.kill("SIGKILL");
        reject(new Error(`Pinned mutation worker readiness timed out after ${this.readyTimeoutMs}ms.`));
      }, this.readyTimeoutMs);
      timer.unref();
      this.pending.set(0, {
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        }
      });
    });
    const lines = createInterface({ input: this.child.stdout!, crlfDelay: Infinity });
    lines.on("line", (line) => {
      try {
        const message = JSON.parse(line) as {
          id: number;
          ok: boolean;
          result?: PinnedWorkerResponse;
          error?: string;
        };
        const waiter = this.pending.get(message.id);
        if (!waiter) return;
        this.pending.delete(message.id);
        if (message.ok && message.result) waiter.resolve(message.result);
        else waiter.reject(new Error(message.error ?? "Pinned mutation worker failed."));
      } catch (error) {
        this.rejectAll(error instanceof Error ? error : new Error(String(error)));
      }
    });
    this.child.stderr!.on("data", (chunk: Buffer | string) => {
      if (this.stderr.length < 16_384) this.stderr += String(chunk).slice(0, 16_384);
    });
    this.child.on("error", (error) => this.rejectAll(error));
    this.child.on("exit", (code, signal) => {
      if (this.pending.size > 0) {
        this.rejectAll(new Error(
          `Pinned mutation worker exited unexpectedly (${code ?? signal ?? "unknown"}): ${this.stderr}`
        ));
      }
    });
  }

  private rejectAll(error: Error): void {
    for (const waiter of this.pending.values()) waiter.reject(error);
    this.pending.clear();
  }

  async ready(): Promise<void> {
    await this.readyPromise;
  }

  request(payload: Record<string, unknown>): Promise<PinnedWorkerResponse> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.child.kill("SIGKILL");
        reject(new Error(
          `Pinned mutation worker request ${String(payload.action ?? "unknown")} timed out after ${this.requestTimeoutMs}ms.`
        ));
      }, this.requestTimeoutMs);
      timer.unref();
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        }
      });
      this.child.stdin!.write(`${JSON.stringify({ id, ...payload })}\n`, (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  async close(): Promise<void> {
    this.child.stdin!.end();
    if (this.child.exitCode === null && this.child.signalCode === null) {
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const timer = setTimeout(() => {
          this.child.kill("SIGKILL");
          this.child.stdin?.destroy();
          this.child.stdout?.destroy();
          this.child.stderr?.destroy();
          this.child.unref();
          finish();
        }, this.closeTimeoutMs);
        timer.unref();
        this.child.once("exit", () => {
          if (!this.withholdCloseExitSignal) {
            clearTimeout(timer);
            finish();
          }
        });
      });
    }
  }
}

async function applyPinnedPhaseExecutionMutations(args: {
  projectRoot: string;
  authorizedFiles: readonly string[];
  mutations: readonly PhaseExecutionFileMutation[];
  runtimeHooks?: {
    afterParentsPinned?: () => Promise<void> | void;
    beforeFinalObservation?: () => Promise<void> | void;
    crashWorkerAfterCommit?: boolean;
    crashWorkerDuringCleanup?: boolean;
    stopWorkerAfterCommit?: boolean;
    stopWorkerDuringCleanup?: boolean;
    pinnedWorkerTimeoutMs?: number;
    withholdCloseExitSignalForTest?: boolean;
  };
}): Promise<PhaseExecutionMutationResult> {
  const realRoot = await fs.realpath(path.resolve(args.projectRoot));
  const authorized = args.authorizedFiles.map(normalizeAuthorizedPath);
  if (authorized.length === 0) throw new Error("At least one authorized file or directory is required.");
  if (args.mutations.length === 0) throw new Error("At least one file mutation is required.");
  const normalizedMutations = args.mutations.map((mutation, index) => ({
    ...mutation,
    path: normalizeRepoRelativePath(mutation.path, `mutations[${index}].path`)
  }));
  const duplicatePaths = normalizedMutations
    .map((mutation) => mutation.path)
    .filter((filePath, index, all) => all.indexOf(filePath) !== index);
  if (duplicatePaths.length > 0) {
    throw new Error(`Duplicate mutation paths are not allowed: ${uniqueSorted(duplicatePaths).join(", ")}`);
  }

  const groups = new Map<string, {
    parentPath: string;
    parentRelativePath: string;
    dev: string;
    ino: string;
    mutations: Array<Record<string, unknown>>;
  }>();
  for (const mutation of normalizedMutations) {
    if (!isAuthorizedPath(mutation.path, authorized)) {
      throw new Error(`Mutation path is outside the selected plan ownership: ${mutation.path}`);
    }
    if (mutation.operation === "write") {
      if (typeof mutation.content !== "string" || mutation.content.includes("\0")) {
        throw new Error(`Write mutation requires NUL-free string content: ${mutation.path}`);
      }
      if (Buffer.byteLength(mutation.content) > MAX_MUTATION_BYTES) {
        throw new Error(`Write mutation exceeds ${MAX_MUTATION_BYTES} bytes: ${mutation.path}`);
      }
    } else if (mutation.content !== undefined) {
      throw new Error(`Delete mutation must not include content: ${mutation.path}`);
    }
    const absolutePath = path.resolve(realRoot, ...mutation.path.split("/"));
    if (!absolutePath.startsWith(`${realRoot}${path.sep}`)) {
      throw new Error(`Mutation path escapes the repository: ${mutation.path}`);
    }
    await assertNoSymlinkTraversal(realRoot, mutation.path, fs);
    const parentPath = path.dirname(absolutePath);
    const [parentLstat, realParent, parentStats] = await Promise.all([
      fs.lstat(parentPath),
      fs.realpath(parentPath),
      fs.stat(parentPath)
    ]);
    if (
      parentLstat.isSymbolicLink() ||
      !parentLstat.isDirectory() ||
      (realParent !== realRoot && !realParent.startsWith(`${realRoot}${path.sep}`))
    ) {
      throw new Error(`Mutation parent is not a contained real directory: ${mutation.path}`);
    }
    const parentRelativePath = path.relative(realRoot, realParent).replaceAll(path.sep, "/");
    const key = `${parentStats.dev}:${parentStats.ino}`;
    const group = groups.get(key) ?? {
      parentPath: realParent,
      parentRelativePath,
      dev: String(parentStats.dev),
      ino: String(parentStats.ino),
      mutations: []
    };
    const basename = path.basename(absolutePath);
    const nonce = `${process.pid}-${randomUUID()}`;
    group.mutations.push({
      path: mutation.path,
      name: basename,
      operation: mutation.operation,
      content: mutation.content,
      expectedHash: mutation.expectedHash,
      staged: `.${basename}.blueprint-execute-staged-${nonce}`,
      backup: `.${basename}.blueprint-execute-backup-${nonce}`,
      quarantine: `.${basename}.blueprint-execute-quarantine-${nonce}`
    });
    groups.set(key, group);
  }

  const requestTimeoutMs = args.runtimeHooks?.pinnedWorkerTimeoutMs ?? DEFAULT_PINNED_WORKER_TIMEOUT_MS;
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 25 || requestTimeoutMs > 120_000) {
    throw new Error("Pinned mutation worker timeout must be an integer between 25 and 120000ms.");
  }
  const workers = [...groups.values()].map((group) => ({
    group,
    worker: new PinnedMutationWorker({
      ...group,
      requestTimeoutMs,
      readyTimeoutMs: Math.max(MIN_PINNED_WORKER_READY_TIMEOUT_MS, requestTimeoutMs),
      closeTimeoutMs: Math.min(DEFAULT_PINNED_WORKER_CLOSE_TIMEOUT_MS, requestTimeoutMs),
      withholdCloseExitSignal: args.runtimeHooks?.withholdCloseExitSignalForTest === true
    })
  }));
  const committed: typeof workers = [];
  const recoveryCandidates = (item: (typeof workers)[number]): string[] =>
    uniqueSorted(item.group.mutations.flatMap((mutation) =>
      [mutation.backup, mutation.staged, mutation.quarantine]
        .filter((value): value is string => typeof value === "string")
        .map((fileName) => path.join(item.group.parentPath, fileName))
    ));
  const rollbackCommitted = async (failure: string): Promise<PhaseExecutionMutationResult> => {
    const rollbackFailures: string[] = [];
    const cleanupPaths: string[] = [];
    for (const item of [...committed].reverse()) {
      try {
        const rollback = await item.worker.request({ action: "rollback" });
        rollbackFailures.push(...(rollback.rollbackFailures ?? []));
        cleanupPaths.push(...(rollback.cleanupPaths ?? []).map((fileName) =>
          path.join(item.group.parentPath, fileName)
        ));
      } catch (error) {
        rollbackFailures.push(
          `${item.group.parentRelativePath || "."}: rollback worker failed: ${error instanceof Error ? error.message : String(error)}`
        );
        cleanupPaths.push(...recoveryCandidates(item));
      }
    }
    return {
      status: rollbackFailures.length > 0 ? "rollback-failed" : "rolled-back",
      receipts: [],
      cleanupPaths: uniqueSorted(cleanupPaths),
      failure,
      rollbackFailures
    };
  };
  try {
    await Promise.all(workers.map(({ worker }) => worker.ready()));
    await args.runtimeHooks?.afterParentsPinned?.();
    await Promise.all(workers.map(({ worker, group }) =>
      worker.request({ action: "prepare", mutations: group.mutations })
    ));

    for (const item of workers) {
      let result: PinnedWorkerResponse;
      try {
        result = await item.worker.request({
          action: "commit",
          crashAfterCommit: args.runtimeHooks?.crashWorkerAfterCommit === true,
          stopAfterCommit: args.runtimeHooks?.stopWorkerAfterCommit === true
        });
      } catch (error) {
        const previousRollback = await rollbackCommitted(
          `Pinned mutation commit worker failed: ${error instanceof Error ? error.message : String(error)}`
        );
        return {
          ...previousRollback,
          status: "rollback-failed",
          cleanupPaths: uniqueSorted([
            ...previousRollback.cleanupPaths,
            ...recoveryCandidates(item)
          ]),
          rollbackFailures: [
            ...previousRollback.rollbackFailures,
            `${item.group.parentRelativePath || "."}: commit outcome is unknown after worker failure.`
          ]
        };
      }
      if (result.status !== "committed") {
        const previousRollback = await rollbackCommitted(
          result.failure ?? "Pinned mutation commit failed."
        );
        const currentCleanup = (result.cleanupPaths ?? []).map((fileName) =>
          path.join(item.group.parentPath, fileName)
        );
        return {
          ...previousRollback,
          status:
            previousRollback.rollbackFailures.length > 0 || (result.rollbackFailures?.length ?? 0) > 0
              ? "rollback-failed"
              : "rolled-back",
          cleanupPaths: uniqueSorted([...previousRollback.cleanupPaths, ...currentCleanup]),
          rollbackFailures: [
            ...previousRollback.rollbackFailures,
            ...(result.rollbackFailures ?? [])
          ]
        };
      }
      committed.push(item);
    }

    let containmentFailure: string | null = null;
    for (const { group } of workers) {
      try {
        const [stats, realParent] = await Promise.all([
          fs.stat(group.parentPath),
          fs.realpath(group.parentPath)
        ]);
        if (
          String(stats.dev) !== group.dev ||
          String(stats.ino) !== group.ino ||
          realParent !== group.parentPath
        ) {
          containmentFailure = `Mutation parent identity changed during commit: ${group.parentRelativePath}.`;
          break;
        }
      } catch (error) {
        containmentFailure = `Mutation parent became unavailable during commit: ${error instanceof Error ? error.message : String(error)}`;
        break;
      }
    }
    if (containmentFailure) {
      return rollbackCommitted(containmentFailure);
    }

    await args.runtimeHooks?.beforeFinalObservation?.();
    let observations: PinnedWorkerResponse[];
    try {
      observations = await Promise.all(workers.map(({ worker }) =>
        worker.request({ action: "observe" })
      ));
    } catch (error) {
      return rollbackCommitted(
        `Mutation postimage could not be observed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    const receipts = observations.flatMap((result) => result.receipts ?? []);
    let divergence: string | null = null;
    for (const receipt of receipts) {
      const mutation = normalizedMutations.find((candidate) => candidate.path === receipt.path)!;
      const expectedHash = mutation.operation === "write" ? sha256(mutation.content ?? "") : null;
      if (receipt.afterHash !== expectedHash) {
        divergence = `Mutation postimage diverged before receipt persistence for ${receipt.path}.`;
        break;
      }
    }
    if (divergence) return rollbackCommitted(divergence);
    const sealFailures: string[] = [];
    await Promise.all(workers.map(async (item) => {
      try {
        const sealed = await item.worker.request({ action: "seal" });
        if (sealed.status !== "sealed") throw new Error(`unexpected status ${sealed.status}`);
      } catch (error) {
        sealFailures.push(
          `${item.group.parentRelativePath || "."}: commit seal failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }));
    if (sealFailures.length > 0) {
      return {
        status: "rollback-failed",
        receipts,
        cleanupPaths: uniqueSorted(workers.flatMap(recoveryCandidates)),
        failure: "Pinned mutation commit could not be sealed before worker shutdown.",
        rollbackFailures: sealFailures
      };
    }

    const cleanups = await Promise.all(workers.map(async (item) => {
      try {
        return await item.worker.request({
          action: "cleanup",
          crashDuringCleanup: args.runtimeHooks?.crashWorkerDuringCleanup === true,
          stopDuringCleanup: args.runtimeHooks?.stopWorkerDuringCleanup === true
        });
      } catch (error) {
        return {
          status: "cleanup-required",
          cleanupPaths: item.group.mutations.flatMap((mutation) =>
            [mutation.backup, mutation.staged, mutation.quarantine]
              .filter((value): value is string => typeof value === "string")
          ),
          failure: `Pinned mutation cleanup worker failed: ${error instanceof Error ? error.message : String(error)}`
        } satisfies PinnedWorkerResponse;
      }
    }));
    const cleanupPaths = cleanups.flatMap((result, index) =>
      (result.cleanupPaths ?? []).map((fileName) => path.join(workers[index]!.group.parentPath, fileName))
    );
    const cleanupFailures = cleanups.flatMap((result) => result.failure ? [result.failure] : []);
    return {
      status: divergence
        ? "postimage-diverged"
        : cleanupPaths.length > 0
          ? "committed-cleanup-required"
          : "committed",
      receipts: normalizedMutations.map((mutation) =>
        receipts.find((receipt) => receipt.path === mutation.path)!
      ),
      cleanupPaths,
      failure: cleanupFailures.length > 0 ? cleanupFailures.join("; ") : divergence,
      rollbackFailures: []
    };
  } finally {
    await Promise.all(workers.map(({ worker }) => worker.close().catch(() => undefined)));
  }
}

export async function applyPhaseExecutionMutations(args: {
  projectRoot: string;
  authorizedFiles: readonly string[];
  mutations: readonly PhaseExecutionFileMutation[];
  fileSystem?: PhaseExecutionMutationFileSystem;
  runtimeHooks?: {
    afterParentsPinned?: () => Promise<void> | void;
    beforeFinalObservation?: () => Promise<void> | void;
    crashWorkerAfterCommit?: boolean;
    crashWorkerDuringCleanup?: boolean;
    stopWorkerAfterCommit?: boolean;
    stopWorkerDuringCleanup?: boolean;
    pinnedWorkerTimeoutMs?: number;
    withholdCloseExitSignalForTest?: boolean;
  };
}): Promise<PhaseExecutionMutationResult> {
  if (args.fileSystem === undefined) {
    return applyPinnedPhaseExecutionMutations(args);
  }
  const fileSystem = args.fileSystem ?? fs;
  const realRoot = await fileSystem.realpath(path.resolve(args.projectRoot));
  const authorized = args.authorizedFiles.map(normalizeAuthorizedPath);

  if (authorized.length === 0) {
    throw new Error("At least one authorized file or directory is required.");
  }

  if (args.mutations.length === 0) {
    throw new Error("At least one file mutation is required.");
  }

  const normalizedMutations = args.mutations.map((mutation, index) => ({
    ...mutation,
    path: normalizeRepoRelativePath(mutation.path, `mutations[${index}].path`)
  }));
  const duplicatePaths = normalizedMutations
    .map((mutation) => mutation.path)
    .filter((filePath, index, all) => all.indexOf(filePath) !== index);

  if (duplicatePaths.length > 0) {
    throw new Error(`Duplicate mutation paths are not allowed: ${uniqueSorted(duplicatePaths).join(", ")}`);
  }

  const prepared: PreparedMutation[] = [];

  try {
    for (const mutation of normalizedMutations) {
      if (!isAuthorizedPath(mutation.path, authorized)) {
        throw new Error(`Mutation path is outside the selected plan ownership: ${mutation.path}`);
      }

      if (mutation.operation === "write") {
        if (typeof mutation.content !== "string") {
          throw new Error(`Write mutation requires string content: ${mutation.path}`);
        }
        if (mutation.content.includes("\0")) {
          throw new Error(`Write mutation content must not contain NUL bytes: ${mutation.path}`);
        }
        if (Buffer.byteLength(mutation.content) > MAX_MUTATION_BYTES) {
          throw new Error(`Write mutation exceeds ${MAX_MUTATION_BYTES} bytes: ${mutation.path}`);
        }
      } else if (mutation.content !== undefined) {
        throw new Error(`Delete mutation must not include content: ${mutation.path}`);
      }

      const absolutePath = path.resolve(realRoot, ...mutation.path.split("/"));

      if (!absolutePath.startsWith(`${realRoot}${path.sep}`)) {
        throw new Error(`Mutation path escapes the repository: ${mutation.path}`);
      }

      await assertNoSymlinkTraversal(realRoot, mutation.path, fileSystem);
      const existing = await readExistingFile(absolutePath, fileSystem);
      const beforeHash = existing.content === null ? null : sha256(existing.content);

      if (beforeHash !== mutation.expectedHash) {
        throw new Error(
          `Mutation preimage is stale for ${mutation.path}: expected ${mutation.expectedHash ?? "missing"}, observed ${beforeHash ?? "missing"}.`
        );
      }

      if (mutation.operation === "delete" && existing.content === null) {
        throw new Error(`Delete mutation target does not exist: ${mutation.path}`);
      }

      await fileSystem.mkdir(path.dirname(absolutePath), { recursive: true });
      await assertMutationParentContained(realRoot, absolutePath, mutation.path, fileSystem);
      const stagedPath = mutation.operation === "write" ? tempSibling(absolutePath, "staged") : null;

      if (stagedPath && mutation.content !== undefined) {
        try {
          await fileSystem.writeFile(stagedPath, mutation.content, "utf8");
          if (existing.mode !== null) {
            await fileSystem.chmod(stagedPath, existing.mode);
          }
        } catch (error) {
          await fileSystem.rm(stagedPath, { force: true }).catch(() => undefined);
          throw error;
        }
      }

      prepared.push({
        mutation,
        absolutePath,
        beforeHash,
        beforeMode: existing.mode,
        stagedPath,
        backupPath: tempSibling(absolutePath, "backup"),
        backupCreated: false,
        committed: false,
        observedAfterHash: beforeHash,
        observedAfterBytes: existing.content?.byteLength ?? 0,
        observedAfterMode: existing.mode
      });
    }

    for (const entry of prepared) {
      await assertMutationParentContained(
        realRoot,
        entry.absolutePath,
        entry.mutation.path,
        fileSystem
      );
      await assertNoSymlinkTraversal(realRoot, entry.mutation.path, fileSystem);

      if (entry.beforeHash !== null) {
        await fileSystem.rename(entry.absolutePath, entry.backupPath);
        entry.backupCreated = true;
      }

      if (entry.mutation.operation === "write" && entry.stagedPath) {
        await fileSystem.rename(entry.stagedPath, entry.absolutePath);
        entry.stagedPath = null;
      }

      entry.committed = true;

      if (entry.mutation.operation === "write") {
        await assertMutationParentContained(
          realRoot,
          entry.absolutePath,
          entry.mutation.path,
          fileSystem
        );
        await assertNoSymlinkTraversal(realRoot, entry.mutation.path, fileSystem);
        const observed = await readExistingFile(entry.absolutePath, fileSystem);
        const observedHash = observed.content === null ? null : sha256(observed.content);
        const requestedHash = sha256(entry.mutation.content ?? "");

        if (observedHash !== requestedHash) {
          throw new Error(
            `Mutation postimage mismatch for ${entry.mutation.path}: expected ${requestedHash}, observed ${observedHash ?? "missing"}.`
          );
        }
        entry.observedAfterHash = observedHash;
        entry.observedAfterBytes = observed.content?.byteLength ?? 0;
        entry.observedAfterMode = observed.mode;
      } else {
        const observed = await readExistingFile(entry.absolutePath, fileSystem);
        if (observed.content !== null) {
          throw new Error(
            `Delete mutation postimage mismatch for ${entry.mutation.path}: target still exists.`
          );
        }
        entry.observedAfterHash = null;
        entry.observedAfterBytes = 0;
        entry.observedAfterMode = null;
      }
    }
  } catch (error) {
    const rollbackFailures: string[] = [];

    for (const entry of [...prepared].reverse()) {
      if (entry.committed && entry.mutation.operation === "write") {
        try {
          await fileSystem.rm(entry.absolutePath, { force: true });
        } catch (rollbackError) {
          rollbackFailures.push(
            `${entry.mutation.path}: remove committed postimage failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
          );
        }
      }

      if (entry.backupCreated) {
        try {
          await fileSystem.rename(entry.backupPath, entry.absolutePath);
          entry.backupCreated = false;
        } catch (rollbackError) {
          rollbackFailures.push(
            `${entry.mutation.path}: restore preimage failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
          );
        }
      }

      if (entry.stagedPath) {
        try {
          await fileSystem.rm(entry.stagedPath, { force: true });
          entry.stagedPath = null;
        } catch (rollbackError) {
          rollbackFailures.push(
            `${entry.mutation.path}: staged-file cleanup failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
          );
        }
      }
    }

    if (rollbackFailures.length > 0) {
      const receipts = await Promise.all(prepared.map(async (entry) => {
        const observed = await readExistingFile(entry.absolutePath, fileSystem).catch(() => ({
          content: null,
          mode: null
        }));

        return {
          path: entry.mutation.path,
          operation: entry.mutation.operation,
          beforeHash: entry.beforeHash,
          beforeMode: entry.beforeMode,
          afterHash: observed.content === null ? null : sha256(observed.content),
          afterMode: observed.mode,
          bytesWritten: observed.content?.byteLength ?? 0
        } satisfies PhaseExecutionMutationReceipt;
      }));

      return {
        status: "rollback-failed",
        receipts,
        cleanupPaths: prepared.flatMap((entry) => [
          ...(entry.backupCreated ? [entry.backupPath] : []),
          ...(entry.stagedPath ? [entry.stagedPath] : [])
        ]),
        failure: error instanceof Error ? error.message : String(error),
        rollbackFailures
      };
    }

    throw error;
  }

  const cleanupPaths: string[] = [];

  for (const entry of prepared) {
    if (entry.backupCreated) {
      try {
        await fileSystem.rm(entry.backupPath, { force: true });
        entry.backupCreated = false;
      } catch {
        cleanupPaths.push(entry.backupPath);
      }
    }
  }

  let finalObservationFailure: string | null = null;
  const receipts = await Promise.all(prepared.map(async (entry) => {
    try {
      const observed = await readExistingFile(entry.absolutePath, fileSystem);
      const afterHash = observed.content === null ? null : sha256(observed.content);
      const expectedHash = entry.mutation.operation === "write"
        ? sha256(entry.mutation.content ?? "")
        : null;
      if (afterHash !== expectedHash) {
        finalObservationFailure ??=
          `Mutation postimage diverged before receipt persistence for ${entry.mutation.path}.`;
      }
      return {
        path: entry.mutation.path,
        operation: entry.mutation.operation,
        beforeHash: entry.beforeHash,
        beforeMode: entry.beforeMode,
        afterHash,
        afterMode: observed.mode,
        bytesWritten: observed.content?.byteLength ?? 0
      } satisfies PhaseExecutionMutationReceipt;
    } catch (error) {
      finalObservationFailure ??=
        `Mutation postimage could not be observed for ${entry.mutation.path}: ${error instanceof Error ? error.message : String(error)}`;
      return {
        path: entry.mutation.path,
        operation: entry.mutation.operation,
        beforeHash: entry.beforeHash,
        beforeMode: entry.beforeMode,
        afterHash: entry.observedAfterHash,
        afterMode: entry.observedAfterMode,
        bytesWritten: entry.observedAfterBytes
      } satisfies PhaseExecutionMutationReceipt;
    }
  }));

  return {
    status: finalObservationFailure
      ? "postimage-diverged"
      : cleanupPaths.length > 0
        ? "committed-cleanup-required"
        : "committed",
    receipts,
    cleanupPaths,
    failure: finalObservationFailure,
    rollbackFailures: []
  };
}

export const phaseExecutionProcessRunner: PhaseExecutionProcessRunner = async (
  command,
  argv,
  cwd,
  env,
  timeoutMs
) => new Promise((resolve) => {
  const child = spawn(command, [...argv], {
    cwd,
    env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let timedOut = false;
  let outputLimitExceeded = false;
  let spawnError: Error | null = null;
  let killTimer: NodeJS.Timeout | null = null;
  let groupPoll: NodeJS.Timeout | null = null;
  let escalationComplete = false;
  let closeResult: { exitCode: number | null; signal: NodeJS.Signals | null } | null = null;
  let resolved = false;
  const killGroup = (signal: NodeJS.Signals): void => {
    if (child.pid && process.platform !== "win32") {
      try {
        process.kill(-child.pid, signal);
        return;
      } catch {
        // Fall through to the direct child kill when the process group is already gone.
      }
    }
    child.kill(signal);
  };
  const processGroupAlive = (): boolean => {
    if (!child.pid || process.platform === "win32") return false;
    try {
      process.kill(-child.pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const finish = (): void => {
    if (
      resolved ||
      closeResult === null ||
      ((timedOut || outputLimitExceeded) && !escalationComplete)
    ) {
      return;
    }
    resolved = true;
    clearTimeout(timeout);
    if (groupPoll) clearInterval(groupPoll);
    resolve({
      exitCode: spawnError ? null : closeResult.exitCode,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: `${Buffer.concat(stderr).toString("utf8")}${spawnError ? spawnError.message : ""}`,
      signal: closeResult.signal,
      timedOut,
      outputLimitExceeded
    });
  };
  const requestTermination = (): void => {
    if (killTimer || escalationComplete) return;
    killGroup("SIGTERM");
    killTimer = setTimeout(() => {
      killGroup("SIGKILL");
      killTimer = null;
      setTimeout(() => {
        escalationComplete = true;
        finish();
      }, 25).unref?.();
    }, 250);
    killTimer.unref?.();
  };
  const timeout = setTimeout(() => {
    timedOut = true;
    requestTermination();
  }, timeoutMs);
  timeout.unref?.();

  const appendOutput = (target: Buffer[], chunk: Buffer | string, channel: "stdout" | "stderr"): void => {
    const buffer = Buffer.from(chunk);
    const currentBytes = channel === "stdout" ? stdoutBytes : stderrBytes;
    const remaining = Math.max(0, MAX_PROCESS_OUTPUT_BUFFER_BYTES - currentBytes);
    if (remaining > 0) target.push(buffer.subarray(0, remaining));
    if (channel === "stdout") stdoutBytes += Math.min(buffer.byteLength, remaining);
    else stderrBytes += Math.min(buffer.byteLength, remaining);
    if (buffer.byteLength > remaining) {
      outputLimitExceeded = true;
      requestTermination();
    }
  };
  child.stdout.on("data", (chunk: Buffer | string) => appendOutput(stdout, chunk, "stdout"));
  child.stderr.on("data", (chunk: Buffer | string) => appendOutput(stderr, chunk, "stderr"));
  child.on("error", (error) => {
    spawnError = error;
  });
  child.on("close", (exitCode, signal) => {
    closeResult = { exitCode, signal };
    if (!timedOut && !outputLimitExceeded && processGroupAlive()) {
      groupPoll = setInterval(() => {
        if (!processGroupAlive()) finish();
      }, 25);
      groupPoll.unref?.();
      return;
    }
    finish();
  });
});

function receiptOutput(value: string): {
  text: string;
  bytes: number;
  hash: string;
  truncated: boolean;
} {
  const bytes = Buffer.byteLength(value);
  const buffer = Buffer.from(value);
  const truncated = bytes > MAX_RECEIPT_OUTPUT_BYTES;

  return {
    text: truncated ? buffer.subarray(0, MAX_RECEIPT_OUTPUT_BYTES).toString("utf8") : value,
    bytes,
    hash: sha256(buffer),
    truncated
  };
}

export async function runPhaseExecutionVerification(args: {
  projectRoot: string;
  commands: readonly string[];
  processRunner?: PhaseExecutionProcessRunner;
  timeoutMs?: number;
}): Promise<PhaseExecutionVerificationReceipt[]> {
  if (args.commands.length === 0 || args.commands.length > MAX_VERIFICATION_COMMANDS) {
    throw new Error(
      `Verification requires between 1 and ${MAX_VERIFICATION_COMMANDS} bound commands.`
    );
  }

  const timeoutMs = args.timeoutMs ?? DEFAULT_VERIFICATION_TIMEOUT_MS;

  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error("Verification timeout must be a positive integer.");
  }

  const runner = args.processRunner ?? phaseExecutionProcessRunner;
  const receipts: PhaseExecutionVerificationReceipt[] = [];

  for (const rawCommand of args.commands) {
    const command = rawCommand.trim();

    if (
      command.length === 0 ||
      command.includes("\0") ||
      Buffer.byteLength(command) > MAX_VERIFICATION_COMMAND_BYTES
    ) {
      throw new Error("Each bound verification command must be non-empty, NUL-free, and within the command size limit.");
    }

    const argv: ["-c", string] = ["-c", command];
    const result = await runner(
      "/bin/sh",
      argv,
      args.projectRoot,
      {
        ...process.env,
        LC_ALL: "C",
        LANG: "C",
        GIT_TERMINAL_PROMPT: "0"
      },
      timeoutMs
    );
    const stdout = receiptOutput(result.stdout);
    const stderr = receiptOutput(result.stderr);
    const outputLimitExceeded = result.outputLimitExceeded === true;
    const passed =
      result.exitCode === 0 &&
      result.signal === null &&
      !result.timedOut &&
      !outputLimitExceeded;

    receipts.push({
      command,
      argv,
      exitCode: result.exitCode,
      signal: result.signal,
      timedOut: result.timedOut,
      outputLimitExceeded,
      passed,
      stdout: stdout.text,
      stdoutBytes: stdout.bytes,
      stdoutHash: stdout.hash,
      stdoutTruncated: stdout.truncated,
      stderr: stderr.text,
      stderrBytes: stderr.bytes,
      stderrHash: stderr.hash,
      stderrTruncated: stderr.truncated
    });

    if (!passed) {
      break;
    }
  }

  return receipts;
}

async function runGitObservationCommand(
  projectRoot: string,
  argv: readonly string[],
  processRunner: PhaseExecutionProcessRunner
): Promise<PhaseExecutionProcessResult> {
  const result = await processRunner(
    "git",
    argv,
    projectRoot,
    {
      ...process.env,
      LC_ALL: "C",
      LANG: "C",
      GIT_TERMINAL_PROMPT: "0"
    },
    30_000
  );

  if (result.exitCode !== 0 || result.signal !== null || result.timedOut) {
    throw new Error(
      `Git observation failed for git ${argv.join(" ")}: ${result.stderr || "no stderr"}`
    );
  }

  return result;
}

function parseNullSeparatedPaths(value: string): string[] {
  return value.split("\0").filter(Boolean);
}

function parseGitNameStatusPaths(value: string): string[] {
  const fields = value.split("\0").filter(Boolean);
  const paths: string[] = [];

  for (let index = 0; index < fields.length;) {
    const status = fields[index++] ?? "";
    const firstPath = fields[index++];

    if (!firstPath || !/^[ACDMRTUXB][0-9]*$/.test(status)) {
      throw new Error("Git name-status observation returned an invalid NUL-delimited record.");
    }

    paths.push(firstPath);

    if (status.startsWith("R") || status.startsWith("C")) {
      const secondPath = fields[index++];

      if (!secondPath) {
        throw new Error("Git rename/copy observation omitted one path endpoint.");
      }

      paths.push(secondPath);
    }
  }

  return paths;
}

function isIgnoredExecutionRuntimePath(filePath: string): boolean {
  return (
    filePath === ".blueprint/locks" ||
    filePath.startsWith(".blueprint/locks/") ||
    filePath === ".blueprint/executions/execute-phase" ||
    filePath.startsWith(".blueprint/executions/execute-phase/")
  );
}

export async function observePhaseExecutionGitState(args: {
  projectRoot: string;
  authorizedFiles: readonly string[];
  baselineChangedPaths?: readonly string[];
  processRunner?: PhaseExecutionProcessRunner;
}): Promise<PhaseExecutionGitObservation> {
  const runner = args.processRunner ?? phaseExecutionProcessRunner;
  const [headResult, trackedResult, untrackedResult] = await Promise.all([
    runGitObservationCommand(args.projectRoot, ["rev-parse", "HEAD"], runner),
    runGitObservationCommand(
      args.projectRoot,
      ["diff", "--name-status", "--no-renames", "-z", "HEAD", "--"],
      runner
    ),
    runGitObservationCommand(
      args.projectRoot,
      ["ls-files", "--others", "--exclude-standard", "-z", "--"],
      runner
    )
  ]);
  const head = headResult.stdout.trim();

  if (!/^[0-9a-f]{40,64}$/.test(head)) {
    throw new Error("Git observation did not return a canonical full HEAD hash.");
  }

  const authorized = args.authorizedFiles.map(normalizeAuthorizedPath);
  const baseline = new Set((args.baselineChangedPaths ?? []).map(normalizeObservedRepoPath));
  const changedPaths = uniqueSorted(
    [...parseGitNameStatusPaths(trackedResult.stdout), ...parseNullSeparatedPaths(untrackedResult.stdout)]
      .filter((filePath) => !isIgnoredExecutionRuntimePath(filePath))
  );

  for (const filePath of changedPaths) {
    normalizeObservedRepoPath(filePath);
  }

  return {
    head,
    changedPaths,
    unauthorizedChangedPaths: changedPaths.filter(
      (filePath) => !baseline.has(filePath) && !isAuthorizedPath(filePath, authorized)
    )
  };
}
