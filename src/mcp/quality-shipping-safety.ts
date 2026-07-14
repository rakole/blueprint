import { execFile } from "node:child_process";
import { createHash } from "node:crypto";

export type QualityShippingOperation = "pr-branch" | "ship" | "undo";

export type QualityShippingProcessResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
};

export type QualityShippingProcessRunner = (
  command: string,
  argv: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv
) => Promise<QualityShippingProcessResult>;

const activeOperationKeys = new Set<string>();

export const qualityShippingProcessRunner: QualityShippingProcessRunner = async (
  command,
  argv,
  cwd,
  env
) =>
  new Promise((resolve) => {
    execFile(
      command,
      [...argv],
      {
        cwd,
        env,
        timeout: 30_000,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        const processError = error as (NodeJS.ErrnoException & {
          code?: string | number;
          killed?: boolean;
          signal?: NodeJS.Signals | null;
        }) | null;
        const timedOut = Boolean(
          processError?.killed && processError.signal === "SIGTERM"
        );
        const numericExitCode =
          typeof processError?.code === "number"
            ? processError.code
            : error
              ? null
              : 0;

        resolve({
          exitCode: numericExitCode,
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
          signal: processError?.signal ?? null,
          timedOut
        });
      }
    );
  });

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, canonicalize(entryValue)])
    );
  }

  return value;
}

export function qualityShippingStableSerialize(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function qualityShippingSha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function qualityShippingFingerprint(value: unknown): string {
  return qualityShippingSha256(qualityShippingStableSerialize(value));
}

export function isCanonicalFullGitHash(value: string): boolean {
  return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value);
}

export function assertUndoRevertArgv(argv: readonly string[]): void {
  const isSimple =
    argv.length === 3 &&
    argv[0] === "revert" &&
    argv[1] === "--no-edit" &&
    isCanonicalFullGitHash(argv[2] ?? "");
  const isMerge =
    argv.length === 5 &&
    argv[0] === "revert" &&
    argv[1] === "--no-edit" &&
    argv[2] === "-m" &&
    /^[1-9][0-9]*$/.test(argv[3] ?? "") &&
    isCanonicalFullGitHash(argv[4] ?? "");

  if (!isSimple && !isMerge) {
    throw new Error(
      "Undo mutation argv must be exactly git revert --no-edit <full-sha> or git revert --no-edit -m <parent> <full-sha>."
    );
  }
}

export function qualityShippingGitEnvironment(
  overrides: NodeJS.ProcessEnv = {}
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    LC_ALL: "C",
    LANG: "C",
    GIT_TERMINAL_PROMPT: "0",
    ...overrides
  };
}

export async function withQualityShippingOperationLock<T>(
  operation: QualityShippingOperation,
  repositoryIdentity: string,
  task: () => Promise<T>
): Promise<T> {
  const key = repositoryIdentity;

  if (activeOperationKeys.has(key)) {
    throw new Error(
      `Another Quality Shipping operation is already active for this repository; ${operation} did not start.`
    );
  }

  activeOperationKeys.add(key);

  try {
    return await task();
  } finally {
    activeOperationKeys.delete(key);
  }
}

export function tryAcquireQualityShippingOperationLock(
  _operation: QualityShippingOperation,
  repositoryIdentity: string
): (() => void) | null {
  const key = repositoryIdentity;

  if (activeOperationKeys.has(key)) {
    return null;
  }

  activeOperationKeys.add(key);
  let released = false;

  return () => {
    if (released) return;
    released = true;
    activeOperationKeys.delete(key);
  };
}
