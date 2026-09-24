import {constants} from "node:fs";
import {open} from "node:fs/promises";
import {createHash} from "node:crypto";

import {
  resolveLiteralRegularFile,
  type SafeSourceFailureReason
} from "./content-boundary.js";
import {
  capturePathSnapshot,
  samePathIdentity,
  samePathSnapshot,
  type PathIdentity
} from "./path-policy.js";

/** The largest complete source file this private parser reader will retain. */
export const DEFAULT_PARSER_SOURCE_MAX_BYTES = 1 * 1024 * 1024;
export const PARSER_SOURCE_READ_CHUNK_BYTES = 64 * 1024;

export type ParserSourceBasis = {
  /** Canonical repository-relative path from the source inventory. */
  readonly path: string;
  /** Complete file byte size captured by the source inventory. */
  readonly byteSize: number;
  /** Lowercase SHA-256 of the complete file captured by the source inventory. */
  readonly contentHash: string;
};

export type ParserSourceOptions = {
  /** Optional lower byte cap. It may not raise the fixed default ceiling. */
  readonly maxBytes?: number;
};

export type ParserSourceMetadata = {
  readonly path: string;
  readonly byteSize: number;
  readonly contentHash: string;
};

export type ParserSourceFailureReason =
  | "invalid-metadata"
  | "unsafe-path"
  | "symlink"
  | "missing"
  | "not-a-regular-file"
  | "unreadable"
  | "too-large"
  | "size-mismatch"
  | "changed-during-read"
  | "hash-mismatch"
  | "binary"
  | "invalid-utf8"
  | "callback-failed";

export type ParserSourceFailure = {
  readonly ok: false;
  readonly status: "rejected";
  readonly diagnostic: {
    readonly reason: ParserSourceFailureReason;
    readonly message: string;
  };
};

export type ParserSourceSuccess<T> = {
  readonly ok: true;
  readonly status: "accepted";
  /** Only the callback result escapes; the source bytes are never returned. */
  readonly result: T;
  readonly metadata: ParserSourceMetadata;
};

export type ParserSourceResult<T> = ParserSourceSuccess<T> | ParserSourceFailure;

const FAILURE_MESSAGES: Record<ParserSourceFailureReason, string> = {
  "invalid-metadata": "The parser source basis or byte cap is invalid.",
  "unsafe-path": "The parser source path is not eligible.",
  symlink: "Symlinked parser source paths are not accepted.",
  missing: "The parser source file is unavailable.",
  "not-a-regular-file": "The parser source path is not a regular file.",
  unreadable: "The parser source file could not be read.",
  "too-large": "The parser source exceeds the transient read limit.",
  "size-mismatch": "The parser source no longer matches its expected size.",
  "changed-during-read": "The parser source changed while it was being read.",
  "hash-mismatch": "The parser source no longer matches its expected content hash.",
  binary: "Binary parser input is not eligible.",
  "invalid-utf8": "The parser source is not valid UTF-8.",
  "callback-failed": "The parser extraction callback failed."
};

function failure(reason: ParserSourceFailureReason): ParserSourceFailure {
  return {
    ok: false,
    status: "rejected",
    diagnostic: {reason, message: FAILURE_MESSAGES[reason]}
  };
}

function identity(stat: {
  dev: number;
  ino: number;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
}): PathIdentity {
  return {
    device: stat.dev,
    inode: stat.ino,
    size: Number(stat.size),
    mtimeMs: stat.mtimeMs,
    ctimeMs: stat.ctimeMs
  };
}

function mapResolutionFailure(reason: SafeSourceFailureReason): ParserSourceFailureReason {
  switch (reason) {
    case "unsafe-path":
      return "unsafe-path";
    case "symlink":
      return "symlink";
    case "missing":
      return "missing";
    case "not-a-regular-file":
      return "not-a-regular-file";
    case "unreadable":
      return "unreadable";
    default:
      return "changed-during-read";
  }
}

function isBasis(value: unknown): value is ParserSourceBasis {
  if (!value || typeof value !== "object") return false;
  const basis = value as Record<string, unknown>;
  return typeof basis.path === "string" &&
    Number.isSafeInteger(basis.byteSize) &&
    (basis.byteSize as number) >= 0 &&
    typeof basis.contentHash === "string" &&
    /^[a-f0-9]{64}$/.test(basis.contentHash);
}

function validMaxBytes(value: unknown): value is number {
  return value === undefined || (
    Number.isSafeInteger(value) &&
    (value as number) > 0 &&
    (value as number) <= DEFAULT_PARSER_SOURCE_MAX_BYTES
  );
}

/** @internal Deterministic filesystem-race seam used only by focused tests. */
export const parserSourceTestHooks: {
  afterChunk?: (absolutePath: string, chunkIndex: number) => Promise<void> | void;
} = {};

/**
 * Read one inventory-backed source file only for the duration of an extraction
 * callback. The inventory basis is a captured read basis, not a lock: the
 * final root/ancestor/target snapshot and full-file hash are checked before
 * the callback receives bytes. The callback owns any accepted structural
 * result and the later coordinator owns the final source CAS lifecycle.
 */
export async function withParserSource<T>(
  repositoryRoot: string,
  basis: ParserSourceBasis,
  callback: (source: Uint8Array) => T | Promise<T>,
  options: ParserSourceOptions = {}
): Promise<ParserSourceResult<T>> {
  const maxBytes = options?.maxBytes ?? DEFAULT_PARSER_SOURCE_MAX_BYTES;
  if (!isBasis(basis) || !validMaxBytes(options?.maxBytes) || typeof callback !== "function") {
    return failure("invalid-metadata");
  }
  if (basis.byteSize > maxBytes) return failure("too-large");

  const resolved = await resolveLiteralRegularFile(repositoryRoot, basis.path);
  if (!resolved.ok) return failure(mapResolutionFailure(resolved.diagnostic.reason));
  if (Number(resolved.stat.size) !== basis.byteSize) return failure("size-mismatch");

  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let source: Buffer | undefined;
  try {
    try {
      handle = await open(resolved.absolutePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    } catch {
      return failure("unreadable");
    }

    const opened = await handle.stat().catch(() => null);
    if (!opened || !opened.isFile() || !samePathIdentity(resolved.snapshot.target, identity(opened))) {
      return failure("changed-during-read");
    }
    if (Number(opened.size) !== basis.byteSize) return failure("size-mismatch");

    source = Buffer.allocUnsafe(basis.byteSize);
    const digest = createHash("sha256");
    let offset = 0;
    let chunkIndex = 0;
    while (offset < source.byteLength) {
      const requested = Math.min(PARSER_SOURCE_READ_CHUNK_BYTES, source.byteLength - offset);
      let read;
      try {
        read = await handle.read(source, offset, requested, offset);
      } catch {
        return failure("unreadable");
      }
      if (read.bytesRead === 0) return failure("changed-during-read");
      digest.update(source.subarray(offset, offset + read.bytesRead));
      offset += read.bytesRead;
      await parserSourceTestHooks.afterChunk?.(resolved.absolutePath, chunkIndex);
      chunkIndex += 1;
    }

    const after = await handle.stat().catch(() => null);
    if (!after || !after.isFile() || !samePathIdentity(resolved.snapshot.target, identity(after))) {
      return failure("changed-during-read");
    }
    if (Number(after.size) !== basis.byteSize) return failure("size-mismatch");

    const finalSnapshot = await capturePathSnapshot(repositoryRoot, basis.path);
    if (!finalSnapshot || !samePathSnapshot(resolved.snapshot, finalSnapshot)) {
      return failure("changed-during-read");
    }

    if (digest.digest("hex") !== basis.contentHash) return failure("hash-mismatch");
    if (source.includes(0)) return failure("binary");
    try {
      new TextDecoder("utf-8", {fatal: true}).decode(source);
    } catch {
      return failure("invalid-utf8");
    }

    let result: T;
    try {
      result = await callback(source);
    } catch {
      return failure("callback-failed");
    }
    return {
      ok: true,
      status: "accepted",
      result,
      metadata: {
        path: basis.path,
        byteSize: basis.byteSize,
        contentHash: basis.contentHash
      }
    };
  } finally {
    if (source) source.fill(0);
    source = undefined;
    if (handle) await handle.close().catch(() => undefined);
    handle = undefined;
  }
}
