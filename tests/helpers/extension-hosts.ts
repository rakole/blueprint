import path from "node:path";

import {
  KNOWN_EXTENSION_HOSTS,
  extensionHostPath,
  pathExists as rawPathExists
} from "../../scripts/lib/extension-hosts.mjs";

export type ExtensionHost = {
  id: "gemini" | "tabnine";
  displayName: string;
  binaryName: string;
  manifestFile: string;
  contextFile: string;
  homeDirName: ".gemini" | ".tabnine";
  globalBlueprintRoot: string;
  installMetadataFiles: string[];
};

export const extensionHosts = KNOWN_EXTENSION_HOSTS as ExtensionHost[];

export async function pathExists(targetPath: string): Promise<boolean> {
  return rawPathExists(targetPath);
}

export async function shippedExtensionHosts(repoRoot: string): Promise<ExtensionHost[]> {
  const hosts: ExtensionHost[] = [];

  for (const host of extensionHosts) {
    const hasManifest = await pathExists(path.join(repoRoot, host.manifestFile));
    const hasContext = await pathExists(path.join(repoRoot, host.contextFile));

    if (hasManifest || hasContext) {
      hosts.push(host);
    }
  }

  return hosts;
}

export function extensionHomePath(
  homeRoot: string,
  host: ExtensionHost,
  ...segments: string[]
): string {
  return extensionHostPath(homeRoot, host, ...segments);
}
