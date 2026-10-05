import os from "node:os";
import path from "node:path";

export type BlueprintRuntimeHostId = "opencode";

export type BlueprintRuntimeHost = {
  host: BlueprintRuntimeHostId;
  cliHomeDirName: ".config/opencode";
  contextFileName: "AGENTS.md";
  manifestFileName: "package.json";
  extensionPath: string | null;
  globalBlueprintDir: string;
  defaultsPath: string;
  patchRegistryPath: string;
  workspaceRegistryPath: string;
  updatesDir: string;
};

let cachedRuntimeHost: BlueprintRuntimeHost | null = null;
let cachedRuntimeHostKey: string | null = null;

function normalizeHostId(value: string | undefined): BlueprintRuntimeHostId | null {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized !== "opencode") {
    throw new Error(`Unsupported BLUEPRINT_HOST ${JSON.stringify(value)}; expected opencode.`);
  }
  return "opencode";
}

function trimTrailingSeparators(value: string): string {
  return value.replace(/[\\/]+$/, "");
}

function expandHomePath(value: string): string {
  if (value === "~") {
    return os.homedir();
  }

  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(os.homedir(), value.slice(2));
  }

  if (value.startsWith("~")) {
    throw new Error("BLUEPRINT_GLOBAL_HOME must use ~ or ~/ when using a home-relative path.");
  }

  return value;
}

function inferHostFromExtensionPath(extensionPath: string | undefined): BlueprintRuntimeHostId | null {
  const normalizedPath = extensionPath?.trim();

  if (!normalizedPath) {
    return null;
  }

  return "opencode";
}

function buildDefaultGlobalBlueprintDir(host: BlueprintRuntimeHostId, env: NodeJS.ProcessEnv): string {
  void host;
  const dataRoot = env.XDG_DATA_HOME?.trim() || path.join(os.homedir(), ".local", "share");
  return path.join(dataRoot, "opencode", "blueprint");
}

function normalizeGlobalBlueprintDir(value: string): string {
  return trimTrailingSeparators(path.resolve(expandHomePath(value)));
}

function buildRuntimeHostCacheKey(env: NodeJS.ProcessEnv): string {
  return JSON.stringify({
    host: env.BLUEPRINT_HOST ?? null,
    extensionPath: env.BLUEPRINT_EXTENSION_PATH ?? null,
    globalHome: env.BLUEPRINT_GLOBAL_HOME ?? null,
    xdgDataHome: env.XDG_DATA_HOME ?? null
  });
}

function buildRuntimeHost(
  env: NodeJS.ProcessEnv = process.env
): BlueprintRuntimeHost {
  const explicitHost = normalizeHostId(env.BLUEPRINT_HOST);
  const extensionPath = env.BLUEPRINT_EXTENSION_PATH?.trim() || null;
  const inferredHost = inferHostFromExtensionPath(extensionPath ?? undefined);
  const host = explicitHost ?? inferredHost ?? "opencode";
  const cliHomeDirName = ".config/opencode" as const;
  const contextFileName = "AGENTS.md" as const;
  const manifestFileName = "package.json" as const;
  const globalBlueprintDir = normalizeGlobalBlueprintDir(
    env.BLUEPRINT_GLOBAL_HOME?.trim() || buildDefaultGlobalBlueprintDir(host, env)
  );

  return {
    host,
    cliHomeDirName,
    contextFileName,
    manifestFileName,
    extensionPath,
    globalBlueprintDir,
    defaultsPath: path.join(globalBlueprintDir, "defaults.json"),
    patchRegistryPath: path.join(globalBlueprintDir, "patches"),
    workspaceRegistryPath: path.join(globalBlueprintDir, "workspaces.json"),
    updatesDir: path.join(globalBlueprintDir, "updates")
  };
}

export function resolveBlueprintRuntimeHost(
  env: NodeJS.ProcessEnv = process.env
): BlueprintRuntimeHost {
  return buildRuntimeHost(env);
}

export function getBlueprintRuntimeHost(): BlueprintRuntimeHost {
  const cacheKey = buildRuntimeHostCacheKey(process.env);

  if (cachedRuntimeHost === null || cachedRuntimeHostKey !== cacheKey) {
    cachedRuntimeHost = buildRuntimeHost();
    cachedRuntimeHostKey = cacheKey;
  }

  return cachedRuntimeHost;
}
