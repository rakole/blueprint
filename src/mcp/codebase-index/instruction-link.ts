import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  lstat,
  open,
  rename,
  unlink
} from "node:fs/promises";
import path from "node:path";
import {capturePathSnapshot, samePathSnapshot, type PathSnapshot} from "./path-policy.js";

/**
 * The text is intentionally small.  It is a pointer to the generated map,
 * rather than a copy of the map's navigation protocol.
 */
export const CODEBASE_INDEX_INSTRUCTION_SNIPPET =
  "When locating code, understanding repository responsibilities or constraints, or finding related tests, read `.blueprint/codebase/INDEX.md` if present and follow its guidance. Reuse it within the task; read an already-known target directly.";
/** The one prior owned body accepted for an in-place upgrade. */
export const CODEBASE_INDEX_INSTRUCTION_LEGACY_SNIPPET =
  "When locating code, understanding repository responsibilities, or finding related tests, read `.blueprint/codebase/INDEX.md` if present and follow its guidance.";

export const CODEBASE_INDEX_INSTRUCTION_START = "<!-- blueprint:portable-codebase-index:start -->";
export const CODEBASE_INDEX_INSTRUCTION_END = "<!-- blueprint:portable-codebase-index:end -->";

export const SUPPORTED_ROOT_INSTRUCTION_FILES = [
  "AGENTS.md",
  "GEMINI.md",
  "CLAUDE.md",
  "TABNINE.md"
] as const;

export type SupportedRootInstructionFile =
  (typeof SUPPORTED_ROOT_INSTRUCTION_FILES)[number];

export type InstructionLinkPrepareRequest = {
  repositoryRoot: string;
  /** A repository-relative path. Omit to inspect supported root candidates. */
  instructionPath?: string;
};

type InstructionLinkFailureCode =
  | "invalid-root"
  | "unsafe-path"
  | "missing-target"
  | "unsafe-target"
  | "invalid-target"
  | "malformed-block"
  | "read-failed"
  | "write-failed"
  | "hash-conflict";

export type InstructionLinkFailure = {
  status: "failure";
  code: InstructionLinkFailureCode;
  message: string;
  action: string;
  instructionPath?: string;
};

export type InstructionLinkPrepareResult =
  | {
      status: "ready";
      instructionPath: string;
      expectedHash: string;
      currentHash: string;
      currentStatus: "missing-block" | "already-linked";
      proposedBlock: string;
      proposedHash: string;
    }
  | {
      status: "choices";
      choices: readonly string[];
      snippet: string;
      message: string;
      action: string;
    }
  | {
      status: "snippet";
      snippet: string;
      message: string;
      action: string;
    }
  | InstructionLinkFailure;

export type InstructionLinkApplyRequest = {
  repositoryRoot: string;
  instructionPath: string;
  /** The exact hash returned by a prior prepare call. */
  expectedHash: string;
};

/** @internal Deterministic race seam used only by focused filesystem tests. */
export const instructionLinkTestHooks: {
  beforeTempCreate?: (repositoryRoot: string, instructionPath: string) => Promise<void> | void;
  beforeFinalRecheck?: (repositoryRoot: string, instructionPath: string) => Promise<void> | void;
} = {};

export type InstructionLinkApplyResult =
  | {
      status: "applied" | "already-linked";
      instructionPath: string;
      beforeHash: string;
      afterHash: string;
      changed: boolean;
    }
  | InstructionLinkFailure;

type SafeTarget = {
  absolutePath: string;
  relativePath: string;
  mode: number;
  device: number;
  inode: number;
  snapshot: PathSnapshot;
  bytes: Buffer;
  hash: string;
};

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const START_BYTES = Buffer.from(CODEBASE_INDEX_INSTRUCTION_START, "utf8");
const END_BYTES = Buffer.from(CODEBASE_INDEX_INSTRUCTION_END, "utf8");

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function failure(
  code: InstructionLinkFailureCode,
  message: string,
  action: string,
  instructionPath?: string
): InstructionLinkFailure {
  return {
    status: "failure",
    code,
    message,
    action,
    ...(instructionPath === undefined ? {} : { instructionPath })
  };
}

function isUnsafeRelativePath(value: string): boolean {
  return (
    value.length === 0 ||
    CONTROL_CHARACTER_PATTERN.test(value) ||
    value.startsWith("/") ||
    value.startsWith("\\") ||
    WINDOWS_ABSOLUTE_PATH_PATTERN.test(value) ||
    value.includes("\\") ||
    value.split("/").some(segment => segment.length === 0 || segment === "." || segment === "..")
  );
}

function validateRelativePath(value: string): InstructionLinkFailure | null {
  if (typeof value !== "string" || isUnsafeRelativePath(value)) {
    return failure(
      "unsafe-path",
      "The instruction target must be a clean repository-relative path.",
      "Choose an existing file below the repository root without traversal, absolute-path, or symlink components.",
      value
    );
  }
  const segments = value.split("/").map(segment => segment.toLowerCase());
  if (segments.some(segment => segment === ".blueprint" || segment === ".git" || segment === ".gitignore")) {
    return failure(
      "unsafe-target",
      "The instruction target cannot be Blueprint runtime state or version-control metadata.",
      "Choose an existing repository instruction file outside .blueprint and .git.",
      value
    );
  }
  return null;
}

async function inspectRepositoryRoot(repositoryRoot: string): Promise<
  { absolutePath: string } | InstructionLinkFailure
> {
  if (
    typeof repositoryRoot !== "string" ||
    repositoryRoot.length === 0 ||
    CONTROL_CHARACTER_PATTERN.test(repositoryRoot)
  ) {
    return failure(
      "invalid-root",
      "The repository root is invalid.",
      "Provide the repository root as an existing directory."
    );
  }

  const absolutePath = path.resolve(repositoryRoot);
  try {
    const rootStat = await lstat(absolutePath);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      return failure(
        "invalid-root",
        "The repository root must be a real directory.",
        "Use the repository directory itself, rather than a symlink or file."
      );
    }
  } catch {
    return failure(
      "invalid-root",
      "The repository root could not be inspected.",
      "Provide an existing repository directory and retry."
    );
  }
  return { absolutePath };
}

async function inspectSafeTarget(
  repositoryRoot: string,
  instructionPath: string
): Promise<SafeTarget | InstructionLinkFailure> {
  const pathError = validateRelativePath(instructionPath);
  if (pathError) {
    return pathError;
  }

  const rootResult = await inspectRepositoryRoot(repositoryRoot);
  if ("status" in rootResult) {
    return { ...rootResult, instructionPath };
  }

  const absolutePath = path.resolve(rootResult.absolutePath, ...instructionPath.split("/"));
  const relative = path.relative(rootResult.absolutePath, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return failure(
      "unsafe-path",
      "The instruction target escapes the repository root.",
      "Choose an existing repository-relative instruction file.",
      instructionPath
    );
  }

  const segments = instructionPath.split("/");
  let currentPath = rootResult.absolutePath;
  try {
    for (let index = 0; index < segments.length; index += 1) {
      currentPath = path.join(currentPath, segments[index]!);
      const entry = await lstat(currentPath);
      if (entry.isSymbolicLink()) {
        return failure(
          "unsafe-target",
          "The instruction target or one of its parent directories is a symlink.",
          "Use a regular file reached through regular directories inside the repository.",
          instructionPath
        );
      }
      if (index < segments.length - 1 && !entry.isDirectory()) {
        return failure(
          "invalid-target",
          "A parent component of the instruction target is not a directory.",
          "Choose a repository-relative path whose parent components are directories.",
          instructionPath
        );
      }
      if (index === segments.length - 1 && !entry.isFile()) {
        return failure(
          "invalid-target",
          "The instruction target is not a regular file.",
          "Choose an existing regular instruction file.",
          instructionPath
        );
      }
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return failure(
        "missing-target",
        "The requested instruction file does not exist.",
        "Choose an existing repository-relative instruction file. Instruction files are never created by this helper.",
        instructionPath
      );
    }
    return failure(
      "unsafe-target",
      "The instruction target could not be safely inspected.",
      "Check that the target and every parent directory are readable regular paths inside the repository.",
      instructionPath
    );
  }

  try {
    const stat = await lstat(absolutePath);
    const noFollow = fsConstants.O_NOFOLLOW ?? 0;
    const targetHandle = await open(absolutePath, fsConstants.O_RDONLY | noFollow);
    let bytes: Buffer;
    try {
      const openedStat = await targetHandle.stat();
      if (
        !openedStat.isFile() ||
        openedStat.dev !== stat.dev ||
        openedStat.ino !== stat.ino
      ) {
        return failure(
          "unsafe-target",
          "The instruction target changed while it was being inspected.",
          "Retry prepare after the target settles, using a regular file inside the repository.",
          instructionPath
        );
      }
      bytes = await targetHandle.readFile();
    } finally {
      await targetHandle.close();
    }
    const snapshot = await capturePathSnapshot(rootResult.absolutePath, instructionPath);
    if (!snapshot || snapshot.target.device !== stat.dev || snapshot.target.inode !== stat.ino) {
      return failure(
        "unsafe-target",
        "The instruction target or its parent chain changed while it was inspected.",
        "Retry prepare after the target settles, using a regular file inside the repository.",
        instructionPath
      );
    }
    return {
      absolutePath,
      relativePath: instructionPath,
      mode: stat.mode & 0o7777,
      device: stat.dev,
      inode: stat.ino,
      snapshot,
      bytes,
      hash: sha256(bytes)
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      return failure(
        "unsafe-target",
        "The instruction target is a symlink.",
        "Use a regular instruction file instead of a symlink.",
        instructionPath
      );
    }
    return failure(
      "read-failed",
      "The instruction file could not be read.",
      "Check that the existing instruction file is readable and retry.",
      instructionPath
    );
  }
}

function detectNewline(bytes: Buffer): Buffer {
  const crlf = bytes.indexOf(Buffer.from("\r\n", "utf8"));
  const lf = bytes.indexOf(0x0a);
  return crlf >= 0 && (lf < 0 || crlf <= lf)
    ? Buffer.from("\r\n", "utf8")
    : Buffer.from("\n", "utf8");
}

function markerOccurrences(bytes: Buffer, marker: Buffer): number[] {
  const occurrences: number[] = [];
  let from = 0;
  while (true) {
    const index = bytes.indexOf(marker, from);
    if (index < 0) {
      return occurrences;
    }
    occurrences.push(index);
    from = index + marker.length;
  }
}

function markerLineIsExact(bytes: Buffer, marker: Buffer, index: number): boolean {
  const hasBomPreamble = index === 3 && bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
  const atLineStart = index === 0 || bytes[index - 1] === 0x0a || hasBomPreamble;
  if (!atLineStart) {
    return false;
  }
  const after = index + marker.length;
  if (after === bytes.length) {
    return true;
  }
  if (bytes[after] === 0x0a) {
    return true;
  }
  return bytes[after] === 0x0d && bytes[after + 1] === 0x0a;
}

function lineEndingAfterMarker(bytes: Buffer, marker: Buffer, index: number): number {
  const after = index + marker.length;
  if (bytes[after] === 0x0d && bytes[after + 1] === 0x0a) {
    return 2;
  }
  if (bytes[after] === 0x0a) {
    return 1;
  }
  return 0;
}

function managedBlockFor(newline: Buffer): Buffer {
  const snippet = Buffer.from(CODEBASE_INDEX_INSTRUCTION_SNIPPET, "utf8");
  return Buffer.concat([
    START_BYTES,
    newline,
    snippet,
    newline,
    END_BYTES
  ]);
}

type BlockInspection =
  | { kind: "none" }
  | { kind: "malformed"; reason: string }
  | { kind: "valid"; start: number; end: number; current: boolean };

function inspectManagedBlock(bytes: Buffer, newline: Buffer): BlockInspection {
  const starts = markerOccurrences(bytes, START_BYTES);
  const ends = markerOccurrences(bytes, END_BYTES);
  const allMarkers = [...starts, ...ends].sort((left, right) => left - right);
  if (starts.length === 0 && ends.length === 0) {
    return { kind: "none" };
  }
  if (
    starts.length !== 1 ||
    ends.length !== 1 ||
    !markerLineIsExact(bytes, START_BYTES, starts[0]!) ||
    !markerLineIsExact(bytes, END_BYTES, ends[0]!) ||
    starts[0]! >= ends[0]!
  ) {
    return {
      kind: "malformed",
      reason: "managed markers are duplicated, out of order, or not complete marker lines"
    };
  }
  if (allMarkers[0] !== starts[0] || allMarkers[1] !== ends[0]) {
    return { kind: "malformed", reason: "managed markers are not ordered as one block" };
  }
  const startLineEnding = lineEndingAfterMarker(bytes, START_BYTES, starts[0]!);
  if (startLineEnding === 0) {
    return { kind: "malformed", reason: "the managed block has no body line" };
  }
  const bodyStart = starts[0]! + START_BYTES.length + startLineEnding;
  const body = bytes.subarray(bodyStart, ends[0]!);
  const currentBody = Buffer.concat([Buffer.from(CODEBASE_INDEX_INSTRUCTION_SNIPPET, "utf8"), newline]);
  const legacyBody = Buffer.concat([Buffer.from(CODEBASE_INDEX_INSTRUCTION_LEGACY_SNIPPET, "utf8"), newline]);
  if (!body.equals(currentBody) && !body.equals(legacyBody)) {
    return { kind: "malformed", reason: "the managed block body was changed or is incomplete" };
  }
  return {
    kind: "valid",
    start: starts[0]!,
    end: ends[0]! + END_BYTES.length,
    current: body.equals(currentBody)
  };
}

function applyBlock(bytes: Buffer, newline: Buffer): { bytes: Buffer; status: "missing-block" | "already-linked" } {
  const inspection = inspectManagedBlock(bytes, newline);
  const block = managedBlockFor(newline);
  if (inspection.kind === "malformed") {
    throw new Error(inspection.reason);
  }
  if (inspection.kind === "valid") {
    if (inspection.current) return { bytes, status: "already-linked" };
    return {
      bytes: Buffer.concat([bytes.subarray(0, inspection.start), block, bytes.subarray(inspection.end)]),
      status: "missing-block"
    };
  }

  const hasBytes = bytes.length > 0;
  const hasFinalNewline = bytes.length > 0 && bytes[bytes.length - 1] === 0x0a;
  const separator = hasBytes && !hasFinalNewline ? newline : Buffer.alloc(0);
  const finalNewline = hasFinalNewline ? newline : Buffer.alloc(0);
  return {
    bytes: Buffer.concat([bytes, separator, block, finalNewline]),
    status: "missing-block"
  };
}

function safeFailureForBlock(
  error: unknown,
  instructionPath: string
): InstructionLinkFailure {
  return failure(
    "malformed-block",
    `The instruction file has a malformed or conflicting Blueprint managed block (${String(error)}).`,
    "Remove or repair the conflicting managed markers manually, then prepare the link again.",
    instructionPath
  );
}

async function prepareForTarget(
  target: SafeTarget
): Promise<InstructionLinkPrepareResult> {
  const newline = detectNewline(target.bytes);
  let proposed: { bytes: Buffer; status: "missing-block" | "already-linked" };
  try {
    proposed = applyBlock(target.bytes, newline);
  } catch (error) {
    return safeFailureForBlock(error, target.relativePath);
  }
  const proposedHash = sha256(proposed.bytes);
  return {
    status: "ready",
    instructionPath: target.relativePath,
    expectedHash: target.hash,
    currentHash: target.hash,
    currentStatus: proposed.status === "already-linked" ? "already-linked" : "missing-block",
    proposedBlock: managedBlockFor(newline).toString("utf8"),
    proposedHash
  };
}

/** Inspect a target and return a bounded, hash-guarded write proposal. */
export async function prepareInstructionLink(
  request: InstructionLinkPrepareRequest
): Promise<InstructionLinkPrepareResult> {
  const rootResult = await inspectRepositoryRoot(request.repositoryRoot);
  if ("status" in rootResult) {
    return rootResult;
  }

  if (request.instructionPath !== undefined) {
    const pathError = validateRelativePath(request.instructionPath);
    if (pathError) {
      return pathError;
    }
    const target = await inspectSafeTarget(rootResult.absolutePath, request.instructionPath);
    if ("status" in target) {
      return target;
    }
    return prepareForTarget(target);
  }

  const candidates: string[] = [];
  for (const candidate of SUPPORTED_ROOT_INSTRUCTION_FILES) {
    const target = await inspectSafeTarget(rootResult.absolutePath, candidate);
    if ("status" in target) {
      if (target.code === "missing-target") {
        continue;
      }
      // An unsafe candidate should not be silently treated as absent.
      return target;
    }
    candidates.push(candidate);
  }

  if (candidates.length === 0) {
    return {
      status: "snippet",
      snippet: CODEBASE_INDEX_INSTRUCTION_SNIPPET,
      message: "No supported root instruction file exists.",
      action: "If a project already has an instruction file, invoke linking again with its existing repository-relative path. This helper never creates instruction files."
    };
  }
  if (candidates.length > 1) {
    return {
      status: "choices",
      choices: candidates,
      snippet: CODEBASE_INDEX_INSTRUCTION_SNIPPET,
      message: "More than one supported root instruction file exists.",
      action: "Choose one existing file and invoke linking with its repository-relative path."
    };
  }

  const target = await inspectSafeTarget(rootResult.absolutePath, candidates[0]!);
  if ("status" in target) {
    return target;
  }
  return prepareForTarget(target);
}

async function recheckTarget(
  repositoryRoot: string,
  instructionPath: string,
  expectedHash: string
): Promise<SafeTarget | InstructionLinkFailure> {
  const target = await inspectSafeTarget(repositoryRoot, instructionPath);
  if ("status" in target) {
    return target;
  }
  if (target.hash !== expectedHash || !HASH_PATTERN.test(expectedHash)) {
    return failure(
      "hash-conflict",
      "The instruction file changed after prepare, so the pointer was not applied.",
      "Prepare the instruction link again and apply it with the newly captured expected hash.",
      instructionPath
    );
  }
  return target;
}

async function atomicReplace(
  repositoryRoot: string,
  target: SafeTarget,
  bytes: Buffer,
  expectedHash: string
): Promise<InstructionLinkFailure | null> {
  const temporaryPath = `${target.absolutePath}.blueprint-link-${randomUUID()}.tmp`;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    await instructionLinkTestHooks.beforeTempCreate?.(repositoryRoot, target.relativePath);
    const beforeCreate = await recheckTarget(repositoryRoot, target.relativePath, expectedHash);
    if ("status" in beforeCreate) return beforeCreate;
    if (!samePathSnapshot(target.snapshot, beforeCreate.snapshot)) {
      return failure(
        "hash-conflict",
        "The instruction file or its repository ancestry changed while the link was being prepared.",
        "Prepare the instruction link again and apply it with the newly captured expected hash.",
        target.relativePath
      );
    }
    handle = await open(temporaryPath, "wx", target.mode);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await chmod(temporaryPath, target.mode);

    // Recheck immediately before rename.  Hash and inode checks make a
    // concurrent edit or replacement a visible conflict instead of a lost
    // update.  The rename itself remains atomic within the target directory.
    await instructionLinkTestHooks.beforeFinalRecheck?.(repositoryRoot, target.relativePath);
    const current = await inspectSafeTarget(repositoryRoot, target.relativePath);
    if ("status" in current) {
      return current;
    }
    if (
      current.hash !== expectedHash ||
      current.device !== target.device ||
      current.inode !== target.inode ||
      !samePathSnapshot(current.snapshot, target.snapshot)
    ) {
      return failure(
        "hash-conflict",
        "The instruction file changed while the link was being prepared, so the pointer was not applied.",
        "Prepare the instruction link again and apply it with the newly captured expected hash.",
        target.relativePath
      );
    }
    await rename(temporaryPath, target.absolutePath);
    return null;
  } catch {
    return failure(
      "write-failed",
      "The instruction link could not be written atomically.",
      "Check that the existing instruction file and its parent directory are writable, then prepare and apply again.",
      target.relativePath
    );
  } finally {
    if (handle) {
      await handle.close().catch(() => undefined);
    }
    await unlink(temporaryPath).catch(() => undefined);
  }
}

/** Apply only the exact repository-relative target and hash captured by prepare. */
export async function applyInstructionLink(
  request: InstructionLinkApplyRequest
): Promise<InstructionLinkApplyResult> {
  if (!HASH_PATTERN.test(request.expectedHash)) {
    return failure(
      "hash-conflict",
      "The expected target hash is invalid.",
      "Use the expectedHash returned by a successful prepare call.",
      request.instructionPath
    );
  }
  const target = await recheckTarget(
    request.repositoryRoot,
    request.instructionPath,
    request.expectedHash
  );
  if ("status" in target) {
    return target;
  }

  const newline = detectNewline(target.bytes);
  let proposed: { bytes: Buffer; status: "missing-block" | "already-linked" };
  try {
    proposed = applyBlock(target.bytes, newline);
  } catch (error) {
    return safeFailureForBlock(error, target.relativePath);
  }
  if (proposed.status === "already-linked") {
    return {
      status: "already-linked",
      instructionPath: target.relativePath,
      beforeHash: target.hash,
      afterHash: target.hash,
      changed: false
    };
  }

  const writeFailure = await atomicReplace(request.repositoryRoot, target, proposed.bytes, request.expectedHash);
  if (writeFailure) {
    return writeFailure;
  }

  const afterHash = sha256(proposed.bytes);
  return {
    status: "applied",
    instructionPath: target.relativePath,
    beforeHash: target.hash,
    afterHash,
    changed: true
  };
}
