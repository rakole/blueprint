import path from "node:path";

export type BlueprintRuntimeHostId = "gemini" | "tabnine";

export type BlueprintRuntimeHost = {
  host: BlueprintRuntimeHostId;
  cliHomeDirName: ".gemini" | ".tabnine";
  contextFileName: "GEMINI.md" | "TABNINE.md";
  manifestFileName: "gemini-extension.json" | "tabnine-extension.json";
  extensionPath: string | null;
  globalBlueprintDir: string;
  defaultsPath: string;
  patchRegistryPath: string;
  workspaceRegistryPath: string;
  updatesDir: string;
};

const BLUEPRINT_HOST_IDS = ["gemini", "tabnine"] as const satisfies readonly BlueprintRuntimeHostId[];

let cachedRuntimeHost: BlueprintRuntimeHost | null = null;

function normalizeHostId(value: string | undefined): BlueprintRuntimeHostId | null {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return BLUEPRINT_HOST_IDS.includes(normalized as BlueprintRuntimeHostId)
    ? (normalized as BlueprintRuntimeHostId)
    : null;
}

function trimTrailingSeparators(value: string): string {
  return value.replace(/[\\/]+$/, "");
}

function inferHostFromExtensionPath(extensionPath: string | undefined): BlueprintRuntimeHostId | null {
  const normalizedPath = extensionPath?.trim();

  if (!normalizedPath) {
    return null;
  }

  if (normalizedPath.includes(`${path.sep}.tabnine${path.sep}`)) {
    return "tabnine";
  }

  if (normalizedPath.includes(`${path.sep}.gemini${path.sep}`)) {
    return "gemini";
  }

  const slashNormalizedPath = normalizedPath.replaceAll("\\", "/");

  if (slashNormalizedPath.includes("/.tabnine/")) {
    return "tabnine";
  }

  if (slashNormalizedPath.includes("/.gemini/")) {
    return "gemini";
  }

  return null;
}

function buildDefaultGlobalBlueprintDir(host: BlueprintRuntimeHostId): string {
  const cliHomeDirName = host === "tabnine" ? ".tabnine" : ".gemini";
  return `~/${cliHomeDirName}/blueprint`;
}

function buildRuntimeHost(
  env: NodeJS.ProcessEnv = process.env
): BlueprintRuntimeHost {
  const explicitHost = normalizeHostId(env.BLUEPRINT_HOST);
  const extensionPath = env.BLUEPRINT_EXTENSION_PATH?.trim() || null;
  const inferredHost = inferHostFromExtensionPath(extensionPath ?? undefined);
  const host = explicitHost ?? inferredHost ?? "gemini";
  const cliHomeDirName = host === "tabnine" ? ".tabnine" : ".gemini";
  const contextFileName = host === "tabnine" ? "TABNINE.md" : "GEMINI.md";
  const manifestFileName =
    host === "tabnine" ? "tabnine-extension.json" : "gemini-extension.json";
  const globalBlueprintDir = trimTrailingSeparators(
    env.BLUEPRINT_GLOBAL_HOME?.trim() || buildDefaultGlobalBlueprintDir(host)
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
  cachedRuntimeHost ??= buildRuntimeHost();
  return cachedRuntimeHost;
}
