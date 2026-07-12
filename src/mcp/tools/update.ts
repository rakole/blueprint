import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import * as z from "zod/v4";

import { writeJsonFile, writeTextFile } from "./artifacts.js";
import {
  type DirectoryLockRecoveryHooksForTest,
  type DirectoryLockTiming,
  withDirectoryLock
} from "../directory-lock.js";
import { resolveBlueprintRuntimeHost, type BlueprintRuntimeHost } from "../runtime-host.js";
import {
  assertNoNullBytes,
  safeJsonParseObject
} from "../../shared/security.js";

const execFileAsync = promisify(execFile);
const UPDATE_PLAN_FILE = "update-plan-latest.json";
const UPDATE_CHECKLIST_FILE = "update-plan-latest.md";
const UPDATE_ARTIFACT_TEMP_SUFFIX = ".tmp";
const UPDATE_ARTIFACT_BACKUP_SUFFIX = ".bak";
const UPDATE_PLAN_LOCK_DIR = "update-plan-latest.lock";
const UPDATE_PLAN_LOCK_RETRY_MS = 50;
const UPDATE_PLAN_LOCK_STALE_MS = 60_000;
const GIT_COMMAND_TIMEOUT_MS = 5_000;
const HTTP_LOOKUP_TIMEOUT_MS = 5_000;
const UPDATE_STAGE_ORDER = [
  "Resolve",
  "Read",
  "Decide",
  "Execute",
  "Persist",
  "Validate",
  "Route"
] as const;
const UPDATE_PLAN_MODES = ["ask_user", "manual"] as const;

type UpdateStage = (typeof UPDATE_STAGE_ORDER)[number];
type UpdatePlanMode = (typeof UPDATE_PLAN_MODES)[number];
type InstallProvenanceKind =
  | "github-remote"
  | "git-remote"
  | "local-path"
  | "extension-path-only"
  | "unknown";
type LatestVersionLookupStatus =
  | "available"
  | "manual_only"
  | "lookup_failed"
  | "not_installed";

type UpdateCheckArgs = {
  cwd?: string;
};

type UpdatePlanArgs = {
  cwd?: string;
  mode?: UpdatePlanMode;
};

type InstallProvenance = {
  kind: InstallProvenanceKind;
  source: string | null;
  branch: string | null;
  head: string | null;
};

type UpdateChecklistStep = {
  stage: UpdateStage;
  title: string;
  detail: string;
};

type UpdateCheckResult = {
  host: BlueprintRuntimeHost["host"];
  extensionPath: string | null;
  extensionManifestPath: string | null;
  installedVersion: string | null;
  installProvenance: InstallProvenance;
  latestVersionLookupStatus: LatestVersionLookupStatus;
  latestVersion: string | null;
  latestVersionSource: string | null;
  updateAvailable: boolean | null;
  warnings: string[];
};

type UpdatePlanResult = UpdateCheckResult & {
  mode: UpdatePlanMode;
  steps: UpdateChecklistStep[];
  notes: string[];
  requiresRestart: boolean;
  savedPaths: {
    updatesDir: string;
    metadataPath: string;
    checklistPath: string;
  };
  intendedPath: string;
  path: string | null;
  status: "created" | "updated";
  persistenceStatus: "saved" | "not_saved";
};

type UpdatePlanLockTimingForTest = {
  retryMs?: number;
  staleMs?: number;
  heartbeatMs?: number;
};

type UpdatePlanLockCallbackObserverForTest = (
  event: "enter" | "exit",
  lockPath: string
) => Promise<void> | void;

type GitMetadata = {
  branch: string | null;
  head: string | null;
  remoteUrl: string | null;
};

type ExtensionPathState = "not_configured" | "missing" | "present";

type GithubRemote = {
  owner: string;
  repo: string;
  remoteUrl: string;
};

const updateCheckInputSchema = {
  cwd: z.string().optional()
};

const updatePlanInputSchema = {
  cwd: z.string().optional(),
  mode: z.enum(UPDATE_PLAN_MODES).optional()
};

let updatePlanLockTimingForTest: UpdatePlanLockTimingForTest | null = null;
let updatePlanLockRecoveryHooksForTest: DirectoryLockRecoveryHooksForTest | null = null;
let updatePlanLockCallbackObserverForTest: UpdatePlanLockCallbackObserverForTest | null = null;

function positiveTimingOverride(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

function updatePlanLockTiming(): DirectoryLockTiming {
  const staleMs = positiveTimingOverride(
    updatePlanLockTimingForTest?.staleMs,
    UPDATE_PLAN_LOCK_STALE_MS
  );

  return {
    retryMs: positiveTimingOverride(
      updatePlanLockTimingForTest?.retryMs,
      UPDATE_PLAN_LOCK_RETRY_MS
    ),
    staleMs,
    heartbeatMs: positiveTimingOverride(
      updatePlanLockTimingForTest?.heartbeatMs,
      Math.max(25, Math.floor(staleMs / 4))
    )
  };
}

export const updateToolTestHooks: {
  setUpdatePlanLockTimingForTest(timing: UpdatePlanLockTimingForTest): () => void;
  setUpdatePlanLockRecoveryHooksForTest(hooks: DirectoryLockRecoveryHooksForTest): () => void;
  setUpdatePlanLockCallbackObserverForTest(
    observer: UpdatePlanLockCallbackObserverForTest
  ): () => void;
} = {
  setUpdatePlanLockTimingForTest(timing) {
    const previous = updatePlanLockTimingForTest;
    updatePlanLockTimingForTest = { ...timing };

    return () => {
      updatePlanLockTimingForTest = previous;
    };
  },
  setUpdatePlanLockRecoveryHooksForTest(hooks) {
    const previous = updatePlanLockRecoveryHooksForTest;
    updatePlanLockRecoveryHooksForTest = { ...hooks };

    return () => {
      updatePlanLockRecoveryHooksForTest = previous;
    };
  },
  setUpdatePlanLockCallbackObserverForTest(observer) {
    const previous = updatePlanLockCallbackObserverForTest;
    updatePlanLockCallbackObserverForTest = observer;

    return () => {
      updatePlanLockCallbackObserverForTest = previous;
    };
  }
};

function defaultUpdatePlanMode(host: BlueprintRuntimeHost["host"]): UpdatePlanMode {
  return host === "gemini" ? "ask_user" : "manual";
}

function expandHomePath(value: string): string {
  const trimmed = value.trim();

  if (trimmed === "~") {
    return os.homedir();
  }

  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return path.join(os.homedir(), trimmed.slice(2));
  }

  return trimmed;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeOptionalString(value: unknown): string | null {
  return isNonEmptyString(value) ? value.trim() : null;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function runGit(
  args: string[],
  options: { cwd?: string; allowFailure?: boolean; timeoutMs?: number } = {}
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  const timeoutMs = options.timeoutMs ?? GIT_COMMAND_TIMEOUT_MS;

  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd: options.cwd,
      timeout: timeoutMs,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0"
      }
    });

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      success: true
    };
  } catch (error) {
    if (options.allowFailure) {
      const stdout =
        error && typeof error === "object" && "stdout" in error
          ? String((error as { stdout?: string }).stdout ?? "")
          : "";
      let stderr =
        error && typeof error === "object" && "stderr" in error
          ? String((error as { stderr?: string }).stderr ?? "")
          : error instanceof Error
            ? error.message
            : "git command failed";
      const timeoutError =
        error &&
        typeof error === "object" &&
        (("killed" in error && Boolean((error as { killed?: boolean }).killed)) ||
          ("signal" in error && (error as { signal?: string | null }).signal === "SIGTERM"));

      if (timeoutError) {
        stderr = `git command timed out after ${timeoutMs}ms`;
      }

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: false
      };
    }

    throw error;
  }
}

async function readJsonObject(filePath: string): Promise<{
  value: Record<string, unknown> | null;
  warning: string | null;
}> {
  if (!(await pathExists(filePath))) {
    return {
      value: null,
      warning: null
    };
  }

  try {
    const raw = await fs.readFile(filePath, "utf8");
    return {
      value: safeJsonParseObject(raw, { label: filePath }),
      warning: null
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown parse error";
    return {
      value: null,
      warning: `Unable to read Blueprint metadata from ${filePath}: ${reason}`
    };
  }
}

async function resolveInstalledVersion(
  extensionPath: string | null,
  manifestFileName: string
): Promise<{
  extensionPathState: ExtensionPathState;
  extensionManifestPath: string | null;
  installedVersion: string | null;
  warnings: string[];
}> {
  const warnings: string[] = [];

  if (!extensionPath) {
    warnings.push("Blueprint runtime did not expose an extension path for update inspection.");
    return {
      extensionPathState: "not_configured",
      extensionManifestPath: null,
      installedVersion: null,
      warnings
    };
  }

  const normalizedExtensionPath = path.resolve(extensionPath);

  if (!(await pathExists(normalizedExtensionPath))) {
    warnings.push(`Configured extension path does not exist: ${normalizedExtensionPath}`);
    return {
      extensionPathState: "missing",
      extensionManifestPath: path.join(normalizedExtensionPath, manifestFileName),
      installedVersion: null,
      warnings
    };
  }

  const extensionManifestPath = path.join(normalizedExtensionPath, manifestFileName);
  const manifestResult = await readJsonObject(extensionManifestPath);
  const packageJsonResult = await readJsonObject(path.join(normalizedExtensionPath, "package.json"));
  const manifest = manifestResult.value;
  const packageJson = packageJsonResult.value;

  if (manifestResult.warning) {
    warnings.push(manifestResult.warning);
  }

  if (packageJsonResult.warning) {
    warnings.push(packageJsonResult.warning);
  }

  const installedVersion =
    normalizeOptionalString(manifest?.version) ??
    normalizeOptionalString(packageJson?.version) ??
    null;

  if (!installedVersion) {
    warnings.push(
      "Unable to determine the installed Blueprint version from the extension manifest or package.json."
    );
  }

  return {
    extensionPathState: "present",
    extensionManifestPath,
    installedVersion,
    warnings
  };
}

async function resolveGitMetadata(extensionPath: string | null): Promise<GitMetadata> {
  if (!extensionPath) {
    return {
      branch: null,
      head: null,
      remoteUrl: null
    };
  }

  const branchResult = await runGit(["-C", extensionPath, "branch", "--show-current"], {
    allowFailure: true
  });
  const headResult = await runGit(["-C", extensionPath, "rev-parse", "HEAD"], {
    allowFailure: true
  });
  const remoteResult = await runGit(["-C", extensionPath, "config", "--get", "remote.origin.url"], {
    allowFailure: true
  });

  return {
    branch: branchResult.success && branchResult.stdout ? branchResult.stdout : null,
    head: headResult.success && headResult.stdout ? headResult.stdout : null,
    remoteUrl: remoteResult.success && remoteResult.stdout ? remoteResult.stdout : null
  };
}

function parseGithubRemote(remoteUrl: string | null): GithubRemote | null {
  if (!remoteUrl) {
    return null;
  }

  const normalized = remoteUrl.trim();
  const sshMatch = normalized.match(/^git@github\.com:(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/u);

  if (sshMatch?.groups?.owner && sshMatch.groups.repo) {
    return {
      owner: sshMatch.groups.owner,
      repo: sshMatch.groups.repo,
      remoteUrl: normalized
    };
  }

  const httpsMatch = normalized.match(
    /^https?:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?(?:\/)?$/u
  );

  if (httpsMatch?.groups?.owner && httpsMatch.groups.repo) {
    return {
      owner: httpsMatch.groups.owner,
      repo: httpsMatch.groups.repo,
      remoteUrl: normalized
    };
  }

  return null;
}

function detectInstallProvenance(
  extensionPath: string | null,
  extensionPathState: ExtensionPathState,
  gitMetadata: GitMetadata
): InstallProvenance {
  if (extensionPathState !== "present") {
    return {
      kind: "unknown",
      source: null,
      branch: null,
      head: null
    };
  }

  const githubRemote = parseGithubRemote(gitMetadata.remoteUrl);

  if (githubRemote) {
    return {
      kind: "github-remote",
      source: githubRemote.remoteUrl,
      branch: gitMetadata.branch,
      head: gitMetadata.head
    };
  }

  if (gitMetadata.remoteUrl) {
    return {
      kind: "git-remote",
      source: gitMetadata.remoteUrl,
      branch: gitMetadata.branch,
      head: gitMetadata.head
    };
  }

  if (extensionPath && (gitMetadata.branch || gitMetadata.head)) {
    return {
      kind: "local-path",
      source: extensionPath,
      branch: gitMetadata.branch,
      head: gitMetadata.head
    };
  }

  if (extensionPath) {
    return {
      kind: "extension-path-only",
      source: extensionPath,
      branch: null,
      head: null
    };
  }

  return {
    kind: "unknown",
    source: null,
    branch: null,
    head: null
  };
}

async function resolveGithubDefaultBranch(remoteUrl: string): Promise<{
  branch: string | null;
  warning: string | null;
}> {
  const result = await runGit(["ls-remote", "--symref", remoteUrl, "HEAD"], {
    allowFailure: true
  });

  if (!result.success || !result.stdout) {
    const reason = result.stderr || "unknown git lookup failure";
    return {
      branch: null,
      warning:
        `Unable to resolve the remote default branch quickly; falling back to \`main\` for latest-version lookup (${reason}).`
    };
  }

  const match = result.stdout.match(/^ref:\s+refs\/heads\/(?<branch>[^\s]+)\s+HEAD$/mu);
  return {
    branch: match?.groups?.branch ?? null,
    warning: null
  };
}

async function fetchWithTimeout(
  url: string
): Promise<{
  response: Response | null;
  warning: string | null;
}> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, HTTP_LOOKUP_TIMEOUT_MS);

  try {
    return {
      response: await fetch(url, {
        signal: controller.signal
      }),
      warning: null
    };
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || /abort/i.test(error.message));

    if (aborted) {
      return {
        response: null,
        warning:
          `Latest version lookup timed out after ${HTTP_LOOKUP_TIMEOUT_MS}ms; use the manual update checklist.`
      };
    }

    return {
      response: null,
      warning:
        error instanceof Error
          ? `Latest version lookup failed: ${error.message}`
          : "Latest version lookup failed."
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function lookupLatestVersionFromGithub(
  remote: GithubRemote
): Promise<{
  status: LatestVersionLookupStatus;
  latestVersion: string | null;
  source: string | null;
  warning: string | null;
}> {
  const defaultBranchResult = await resolveGithubDefaultBranch(remote.remoteUrl);
  const defaultBranch = defaultBranchResult.branch ?? "main";
  const source = `https://raw.githubusercontent.com/${remote.owner}/${remote.repo}/${defaultBranch}/package.json`;
  const warnings: string[] = [];

  if (defaultBranchResult.warning) {
    warnings.push(defaultBranchResult.warning);
  }

  try {
    const fetchResult = await fetchWithTimeout(source);

    if (fetchResult.warning || !fetchResult.response) {
      warnings.push(fetchResult.warning ?? "Latest version lookup failed.");
      return {
        status: "manual_only",
        latestVersion: null,
        source,
        warning: warnings.join(" ")
      };
    }

    const response = fetchResult.response;

    if (!response.ok) {
      return {
        status: "lookup_failed",
        latestVersion: null,
        source,
        warning: [
          ...warnings,
          `Latest version lookup failed with HTTP ${response.status}.`
        ].join(" ")
      };
    }

    const payload = (await response.json()) as { version?: unknown };
    const latestVersion = normalizeOptionalString(payload.version);

    if (!latestVersion) {
      return {
        status: "lookup_failed",
        latestVersion: null,
        source,
        warning: [
          ...warnings,
          "Latest version lookup did not return a usable version field."
        ].join(" ")
      };
    }

    return {
      status: "available",
      latestVersion,
      source,
      warning: warnings.length > 0 ? warnings.join(" ") : null
    };
  } catch (error) {
    return {
      status: "manual_only",
      latestVersion: null,
      source,
      warning: [
        ...warnings,
        error instanceof Error
          ? `Latest version lookup failed: ${error.message}`
          : "Latest version lookup failed."
      ].join(" ")
    };
  }
}

function parseSemverParts(version: string): number[] | null {
  const match = version.trim().match(/^v?(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/u);

  if (!match?.groups) {
    return null;
  }

  return [
    Number.parseInt(match.groups.major, 10),
    Number.parseInt(match.groups.minor, 10),
    Number.parseInt(match.groups.patch, 10)
  ];
}

function compareSemver(left: string, right: string): number | null {
  const leftParts = parseSemverParts(left);
  const rightParts = parseSemverParts(right);

  if (!leftParts || !rightParts) {
    return null;
  }

  for (let index = 0; index < leftParts.length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart > rightPart) {
      return 1;
    }

    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

async function resolveUpdateCheck(
  args: UpdateCheckArgs = {},
  env: NodeJS.ProcessEnv = process.env
): Promise<UpdateCheckResult> {
  const cwd = normalizeOptionalString(args.cwd) ?? process.cwd();
  const runtimeHost = resolveBlueprintRuntimeHost(env);
  const extensionPath = runtimeHost.extensionPath
    ? path.resolve(expandHomePath(runtimeHost.extensionPath))
    : null;
  const warnings: string[] = [];

  if (extensionPath) {
    assertNoNullBytes(extensionPath, "Blueprint extension path");
  }

  if (cwd) {
    assertNoNullBytes(cwd, "Blueprint update cwd");
  }

  const { extensionPathState, extensionManifestPath, installedVersion, warnings: versionWarnings } =
    await resolveInstalledVersion(extensionPath, runtimeHost.manifestFileName);
  warnings.push(...versionWarnings);

  const gitMetadata = await resolveGitMetadata(
    extensionPathState === "present" ? extensionPath : null
  );
  const installProvenance = detectInstallProvenance(extensionPath, extensionPathState, gitMetadata);

  if (installProvenance.kind === "extension-path-only") {
    warnings.push(
      "Blueprint update inspection could not confirm install provenance; using the extension path only."
    );
  }

  let latestVersionLookupStatus: LatestVersionLookupStatus = extensionPathState === "present"
    ? "manual_only"
    : "not_installed";
  let latestVersion: string | null = null;
  let latestVersionSource: string | null = null;

  const githubRemote = parseGithubRemote(gitMetadata.remoteUrl);

  if (githubRemote) {
    const lookup = await lookupLatestVersionFromGithub(githubRemote);
    latestVersionLookupStatus = lookup.status;
    latestVersion = lookup.latestVersion;
    latestVersionSource = lookup.source;

    if (lookup.warning) {
      warnings.push(lookup.warning);
    }
  } else if (extensionPathState !== "present") {
    warnings.push(
      "Blueprint update inspection cannot resolve a latest version because no installed extension was found at the configured path."
    );
  } else if (!gitMetadata.remoteUrl) {
    warnings.push(
      "Blueprint update inspection could not find a git remote for the installed extension; use the manual update checklist."
    );
  } else {
    warnings.push(
      "Blueprint update inspection found a non-GitHub remote; use the manual update checklist for the latest version."
    );
  }

  let updateAvailable: boolean | null = null;

  if (installedVersion && latestVersion) {
    const comparison = compareSemver(installedVersion, latestVersion);
    updateAvailable = comparison === null ? null : comparison < 0;

    if (comparison === null) {
      warnings.push(
        "Blueprint update inspection could not compare installed and latest versions because one of them is not semver-shaped."
      );
    }
  }

  return {
    host: runtimeHost.host,
    extensionPath,
    extensionManifestPath,
    installedVersion,
    installProvenance,
    latestVersionLookupStatus,
    latestVersion,
    latestVersionSource,
    updateAvailable,
    warnings
  };
}

function buildProvenanceSummary(provenance: InstallProvenance): {
  label: string;
  detail: string;
} {
  switch (provenance.kind) {
    case "github-remote":
      return {
        label: "GitHub remote",
        detail:
          `Use the GitHub install source ${provenance.source ?? "unknown source"}` +
          `${provenance.branch ? ` on branch ${provenance.branch}` : ""}` +
          `${provenance.head ? ` at ${provenance.head}` : ""}.`
      };
    case "git-remote":
      return {
        label: "Git remote",
        detail:
          `Use the git remote ${provenance.source ?? "unknown source"}` +
          `${provenance.branch ? ` on branch ${provenance.branch}` : ""}` +
          `${provenance.head ? ` at ${provenance.head}` : ""}.`
      };
    case "local-path":
      return {
        label: "Local path",
        detail:
          `Refresh Blueprint from the local path ${provenance.source ?? "unknown path"}` +
          `${provenance.branch ? ` on branch ${provenance.branch}` : ""}` +
          `${provenance.head ? ` at ${provenance.head}` : ""}.`
      };
    case "extension-path-only":
      return {
        label: "Extension path only",
        detail:
          `The runtime only confirmed the installed extension path ${provenance.source ?? "unknown path"}; verify the real source manually before updating.`
      };
    case "unknown":
    default:
      return {
        label: "Unknown",
        detail: "Confirm the install source manually before running the out-of-band update."
      };
  }
}

function buildUpdateSteps(
  check: UpdateCheckResult,
  mode: UpdatePlanMode,
  savedPaths: UpdatePlanResult["savedPaths"]
): UpdateChecklistStep[] {
  const modeDetail =
    mode === "ask_user"
      ? "Use Gemini CLI `ask_user` to choose whether the user wants a saved checklist or the manual fallback view."
      : "Keep the same decision boundary explicit in plain language because structured `ask_user` is unavailable or not desired.";
  const sourceDetail =
    check.latestVersionLookupStatus === "available" && check.latestVersion
      ? `Compare installed version ${check.installedVersion ?? "unknown"} with latest version ${check.latestVersion} from ${check.latestVersionSource ?? "the resolved source"}.`
      : "Read the installed version and install provenance, then surface the manual fallback because the latest version lookup is unavailable.";
  const provenanceSummary = buildProvenanceSummary(check.installProvenance);

  return [
    {
      stage: "Resolve",
      title: "Resolve host and install target",
      detail: `Resolve the active host as ${check.host} and treat ${check.extensionPath ?? "the missing extension path"} as read-only install state.`
    },
    {
      stage: "Read",
      title: "Read version and provenance",
      detail: sourceDetail
    },
    {
      stage: "Decide",
      title: "Choose checklist mode",
      detail: modeDetail
    },
    {
      stage: "Execute",
      title: "Run the out-of-band update",
      detail:
        `${provenanceSummary.detail} Never write into the installed extension directory from inside \`/blu-update\`.`
    },
    {
      stage: "Persist",
      title: "Persist advisory metadata",
      detail: `Save the advisory update metadata to ${savedPaths.metadataPath} and the checklist view to ${savedPaths.checklistPath}.`
    },
    {
      stage: "Validate",
      title: "Re-check the installed version",
      detail:
        "After the manual update completes, rerun `/blu-update` or `blueprint_update_check` to verify the installed version and any remaining warnings."
    },
    {
      stage: "Route",
      title: "Restart the host session",
      detail:
        "Restart Gemini CLI or Tabnine CLI after the out-of-band update so the new extension bundle loads before more Blueprint work continues."
    }
  ];
}

function buildUpdateNotes(check: UpdateCheckResult, mode: UpdatePlanMode): string[] {
  const provenanceSummary = buildProvenanceSummary(check.installProvenance);
  const notes = [
    "Blueprint update remains advisory. It prepares a safe checklist and metadata, but it does not self-update the installed extension in-session.",
    "Keep all persistent update state under `~/.<host>/blueprint/updates/`; do not write project-local update artifacts for this command.",
    "A host restart is required after the manual update because the running session will not hot-reload the extension bundle.",
    `Install provenance: ${provenanceSummary.label}. ${provenanceSummary.detail}`
  ];

  if (mode === "ask_user") {
    notes.push(
      "When Gemini CLI `ask_user` is available, use it for the saved-checklist versus manual-fallback decision instead of simulating a questionnaire in plain text."
    );
  } else {
    notes.push(
      "When structured `ask_user` is unavailable, keep the same saved-checklist versus manual-fallback decision explicit in prose."
    );
  }

  if (check.latestVersionLookupStatus !== "available") {
    notes.push(
      "Latest version lookup was unavailable, so the manual fallback path should point the user at the install source or repository changelog directly."
    );
  }

  return notes;
}

function renderProvenanceMarkdown(provenance: InstallProvenance): string[] {
  return [
    `- Install provenance: ${provenance.kind}`,
    `- Install source: ${provenance.source ?? "unknown"}`,
    `- Install branch: ${provenance.branch ?? "unknown"}`,
    `- Install head: ${provenance.head ?? "unknown"}`
  ];
}

function renderChecklistMarkdown(
  generatedAt: string,
  plan: UpdatePlanResult
): string {
  const lines = [
    "# Blueprint Update Plan",
    "",
    `- Generated: ${generatedAt}`,
    `- Host: ${plan.host}`,
    `- Installed version: ${plan.installedVersion ?? "unknown"}`,
    `- Latest version: ${plan.latestVersion ?? "unavailable"}`,
    `- Latest version lookup: ${plan.latestVersionLookupStatus}`,
    `- Update available: ${
      plan.updateAvailable === null ? "unknown" : plan.updateAvailable ? "yes" : "no"
    }`,
    `- Mode gate: ${plan.mode}`,
    `- Requires restart: ${plan.requiresRestart ? "yes" : "no"}`,
    ...renderProvenanceMarkdown(plan.installProvenance),
    "",
    "## Steps",
    ""
  ];

  for (const [index, step] of plan.steps.entries()) {
    lines.push(`${index + 1}. **${step.stage}: ${step.title}**`);
    lines.push(`   ${step.detail}`);
  }

  lines.push("", "## Notes", "");

  for (const note of plan.notes) {
    lines.push(`- ${note}`);
  }

  if (plan.warnings.length > 0) {
    lines.push("", "## Warnings", "");

    for (const warning of plan.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function serializeUpdatePlan(
  generatedAt: string,
  plan: UpdatePlanResult
): Record<string, unknown> {
  return {
    generatedAt,
    ...plan
  } as unknown as Record<string, unknown>;
}

async function removeIfExists(targetPath: string): Promise<void> {
  await fs.rm(targetPath, { force: true });
}

async function removeIfExistsSafely(
  targetPath: string,
  label: string
): Promise<string | null> {
  try {
    await removeIfExists(targetPath);
    return null;
  } catch (error) {
    return error instanceof Error
      ? `Failed to remove ${label} ${targetPath}: ${error.message}`
      : `Failed to remove ${label} ${targetPath}.`;
  }
}

function createUpdatePlanNonce(): string {
  return `${process.pid}-${Date.now()}-${randomUUID()}`;
}

async function withUpdatePlanLock<T>(
  updatesDir: string,
  callback: () => Promise<T>
): Promise<T> {
  const lockPath = path.join(updatesDir, UPDATE_PLAN_LOCK_DIR);
  const lockOptions = {
    lockPath,
    timing: updatePlanLockTiming()
  };
  const runObservedCallback = async () => {
    await updatePlanLockCallbackObserverForTest?.("enter", lockPath);

    try {
      return await callback();
    } finally {
      await updatePlanLockCallbackObserverForTest?.("exit", lockPath);
    }
  };

  if (updatePlanLockRecoveryHooksForTest) {
    return withDirectoryLock(
      { ...lockOptions, recoveryHooks: updatePlanLockRecoveryHooksForTest },
      runObservedCallback
    );
  }

  return withDirectoryLock(lockOptions, runObservedCallback);
}

async function restoreFromBackup(
  backupPath: string,
  targetPath: string
): Promise<{ backupExisted: boolean; restored: boolean; warning: string | null }> {
  if (!(await pathExists(backupPath))) {
    return {
      backupExisted: false,
      restored: false,
      warning: null
    };
  }

  try {
    await removeIfExists(targetPath);
    await fs.rename(backupPath, targetPath);
    return {
      backupExisted: true,
      restored: true,
      warning: null
    };
  } catch (error) {
    const warning = error instanceof Error
      ? `Failed to restore ${targetPath} from backup ${backupPath}: ${error.message}. Backup left in place for manual recovery.`
      : `Failed to restore ${targetPath} from backup ${backupPath}. Backup left in place for manual recovery.`;

    return {
      backupExisted: true,
      restored: false,
      warning
    };
  }
}

async function determineUpdatePlanStatus(
  metadataPath: string,
  checklistPath: string
): Promise<UpdatePlanResult["status"]> {
  const created = !((await pathExists(metadataPath)) || (await pathExists(checklistPath)));

  return created ? "created" : "updated";
}

async function persistUpdatePlanArtifacts(
  generatedAt: string,
  plan: UpdatePlanResult
): Promise<{ persistenceStatus: UpdatePlanResult["persistenceStatus"]; warnings: string[] }> {
  const warnings: string[] = [];
  const serializedPlan = serializeUpdatePlan(generatedAt, plan);
  const checklistMarkdown = renderChecklistMarkdown(generatedAt, plan);
  const nonce = createUpdatePlanNonce();
  const metadataTmpPath = `${plan.savedPaths.metadataPath}${UPDATE_ARTIFACT_TEMP_SUFFIX}-${nonce}`;
  const checklistTmpPath = `${plan.savedPaths.checklistPath}${UPDATE_ARTIFACT_TEMP_SUFFIX}-${nonce}`;
  const metadataBackupPath = `${plan.savedPaths.metadataPath}${UPDATE_ARTIFACT_BACKUP_SUFFIX}-${nonce}`;
  const checklistBackupPath = `${plan.savedPaths.checklistPath}${UPDATE_ARTIFACT_BACKUP_SUFFIX}-${nonce}`;
  let metadataBackupCreated = false;
  let checklistBackupCreated = false;
  let metadataPromoted = false;
  let checklistPromoted = false;

  try {
    const existingModes = await Promise.all(
      [plan.savedPaths.metadataPath, plan.savedPaths.checklistPath].map(async (targetPath) => {
        try {
          const stats = await fs.lstat(targetPath);
          if (!stats.isFile()) {
            throw new Error(`Update artifact target must be a regular file: ${targetPath}`);
          }
          return stats.mode & 0o7777;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return null;
          }
          throw error;
        }
      })
    );

    await writeJsonFile(metadataTmpPath, serializedPlan);
    await writeTextFile(checklistTmpPath, checklistMarkdown, {
      enforcePromptBoundary: false,
      label: path.basename(plan.savedPaths.checklistPath)
    });
    if (existingModes[0] !== null) {
      await fs.chmod(metadataTmpPath, existingModes[0]);
    }
    if (existingModes[1] !== null) {
      await fs.chmod(checklistTmpPath, existingModes[1]);
    }

    const promotionModes = await Promise.all(
      [plan.savedPaths.metadataPath, plan.savedPaths.checklistPath].map(async (targetPath) => {
        try {
          const stats = await fs.lstat(targetPath);
          if (!stats.isFile()) {
            throw new Error(`Update artifact target must be a regular file: ${targetPath}`);
          }
          return stats.mode & 0o7777;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw error;
        }
      })
    );
    if (promotionModes[0] !== null) {
      await fs.rename(plan.savedPaths.metadataPath, metadataBackupPath);
      metadataBackupCreated = true;
    }

    if (promotionModes[1] !== null) {
      await fs.rename(plan.savedPaths.checklistPath, checklistBackupPath);
      checklistBackupCreated = true;
    }

    await fs.rename(metadataTmpPath, plan.savedPaths.metadataPath);
    metadataPromoted = true;
    await fs.rename(checklistTmpPath, plan.savedPaths.checklistPath);
    checklistPromoted = true;

    for (const [backupPath, label] of [
      [metadataBackupPath, "update metadata backup"],
      [checklistBackupPath, "update checklist backup"]
    ] as const) {
      const cleanupWarning = await removeIfExistsSafely(backupPath, label);

      if (cleanupWarning) {
        warnings.push(cleanupWarning);
      }
    }

    return {
      persistenceStatus: "saved",
      warnings
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown write failure";

    warnings.push(
      `Unable to persist Blueprint update artifacts under ${plan.savedPaths.updatesDir}: ${reason}. Returning manual steps without saved files.`
    );

    for (const [tempPath, label] of [
      [metadataTmpPath, "update metadata temp file"],
      [checklistTmpPath, "update checklist temp file"]
    ] as const) {
      const cleanupWarning = await removeIfExistsSafely(tempPath, label);

      if (cleanupWarning) {
        warnings.push(cleanupWarning);
      }
    }

    if (metadataPromoted && !metadataBackupCreated) {
      const cleanupWarning = await removeIfExistsSafely(
        plan.savedPaths.metadataPath,
        "partially promoted update metadata"
      );

      if (cleanupWarning) {
        warnings.push(cleanupWarning);
      }
    }

    if (checklistPromoted && !checklistBackupCreated) {
      const cleanupWarning = await removeIfExistsSafely(
        plan.savedPaths.checklistPath,
        "partially promoted update checklist"
      );

      if (cleanupWarning) {
        warnings.push(cleanupWarning);
      }
    }

    const metadataRestore = await restoreFromBackup(
      metadataBackupPath,
      plan.savedPaths.metadataPath
    );
    const checklistRestore = await restoreFromBackup(
      checklistBackupPath,
      plan.savedPaths.checklistPath
    );

    if (metadataRestore.warning) {
      warnings.push(metadataRestore.warning);
    }

    if (checklistRestore.warning) {
      warnings.push(checklistRestore.warning);
    }

    for (const [backupPath, label, restore] of [
      [metadataBackupPath, "update metadata backup", metadataRestore],
      [checklistBackupPath, "update checklist backup", checklistRestore]
    ] as const) {
      if (restore.warning) {
        continue;
      }

      const cleanupWarning = await removeIfExistsSafely(backupPath, label);

      if (cleanupWarning) {
        warnings.push(cleanupWarning);
      }
    }

    return {
      persistenceStatus: "not_saved",
      warnings
    };
  }
}

export async function blueprintUpdateCheck(
  args: UpdateCheckArgs = {},
  env: NodeJS.ProcessEnv = process.env
): Promise<UpdateCheckResult> {
  return resolveUpdateCheck(args, env);
}

export async function blueprintUpdatePlan(
  args: UpdatePlanArgs = {},
  env: NodeJS.ProcessEnv = process.env
): Promise<UpdatePlanResult> {
  const runtimeHost = resolveBlueprintRuntimeHost(env);
  const mode = args.mode ?? defaultUpdatePlanMode(runtimeHost.host);
  const check = await resolveUpdateCheck(args, env);
  const updatesDir = path.resolve(expandHomePath(runtimeHost.updatesDir));
  const metadataPath = path.join(updatesDir, UPDATE_PLAN_FILE);
  const checklistPath = path.join(updatesDir, UPDATE_CHECKLIST_FILE);
  const savedPaths = {
    updatesDir,
    metadataPath,
    checklistPath
  };
  const steps = buildUpdateSteps(check, mode, savedPaths);
  const notes = buildUpdateNotes(check, mode);

  const buildPlan = (status: UpdatePlanResult["status"]): UpdatePlanResult => ({
    ...check,
    warnings: [...check.warnings],
    mode,
    steps,
    notes,
    requiresRestart: true,
    savedPaths,
    intendedPath: metadataPath,
    path: metadataPath,
    status,
    persistenceStatus: "saved"
  });

  try {
    return await withUpdatePlanLock(updatesDir, async () => {
      const generatedAt = new Date().toISOString();
      const plan = buildPlan(await determineUpdatePlanStatus(metadataPath, checklistPath));
      const persistenceResult = await persistUpdatePlanArtifacts(generatedAt, plan);
      plan.persistenceStatus = persistenceResult.persistenceStatus;

      if (persistenceResult.persistenceStatus === "not_saved") {
        plan.path = null;
      }

      plan.warnings.push(...persistenceResult.warnings);

      return plan;
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown persistence failure";
    const plan = buildPlan(await determineUpdatePlanStatus(metadataPath, checklistPath));

    plan.persistenceStatus = "not_saved";
    plan.path = null;
    plan.warnings.push(
      `Unable to persist Blueprint update artifacts under ${updatesDir}: ${reason}. Returning manual steps without saved files.`
    );

    return plan;
  }
}

export const updateToolDefinitions = [
  {
    name: "blueprint_update_check",
    description:
      "Inspect the installed Blueprint extension, install provenance, latest-version lookup status, and update availability without mutating the install.",
    inputSchema: updateCheckInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintUpdateCheck(args as UpdateCheckArgs)
  },
  {
    name: "blueprint_update_plan",
    description:
      "Build and persist an advisory Blueprint update checklist under the host-global updates directory without writing into the installed extension.",
    inputSchema: updatePlanInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintUpdatePlan(args as UpdatePlanArgs)
  }
] as const;
