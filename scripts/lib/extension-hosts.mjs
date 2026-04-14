import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";

export const KNOWN_EXTENSION_HOSTS = Object.freeze([
  Object.freeze({
    id: "gemini",
    displayName: "Gemini CLI",
    binaryName: "gemini",
    manifestFile: "gemini-extension.json",
    contextFile: "GEMINI.md",
    homeDirName: ".gemini",
    globalBlueprintRoot: "~/.gemini/blueprint",
    installMetadataFiles: [".gemini-extension-install.json"]
  }),
  Object.freeze({
    id: "tabnine",
    displayName: "Tabnine CLI",
    binaryName: "tabnine",
    manifestFile: "tabnine-extension.json",
    contextFile: "TABNINE.md",
    homeDirName: ".tabnine",
    globalBlueprintRoot: "~/.tabnine/blueprint",
    installMetadataFiles: [
      ".tabnine-extension-install.json",
      ".gemini-extension-install.json"
    ]
  })
]);

export function getExtensionHost(hostId = "gemini") {
  const normalizedHostId = String(hostId).trim().toLowerCase();
  const host = KNOWN_EXTENSION_HOSTS.find((candidate) => {
    return candidate.id === normalizedHostId;
  });

  if (!host) {
    throw new Error(
      `Unsupported Blueprint extension host "${hostId}". Expected one of: ${KNOWN_EXTENSION_HOSTS.map((candidate) => candidate.id).join(", ")}.`
    );
  }

  return host;
}

export function extensionHostPath(homeRoot, host, ...segments) {
  return path.join(homeRoot, host.homeDirName, ...segments);
}

export async function pathExists(targetPath) {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function discoverExtensionHosts(repoRoot) {
  const discoveredHosts = [];

  for (const host of KNOWN_EXTENSION_HOSTS) {
    const manifestPath = path.join(repoRoot, host.manifestFile);
    const contextPath = path.join(repoRoot, host.contextFile);
    const hasManifest = await pathExists(manifestPath);
    const hasContext = await pathExists(contextPath);

    if (!hasManifest && !hasContext) {
      continue;
    }

    discoveredHosts.push({
      ...host,
      hasManifest,
      hasContext
    });
  }

  return discoveredHosts;
}
