import path from "node:path";

import type { Config, Plugin } from "@opencode-ai/plugin";

import { createBlueprintActivationHooks } from "./activation.js";
import {
  loadBlueprintNativeAssets,
  resolveBlueprintPackageRoot,
  resolveOpenCodeDataRoot,
  type NativeAgent,
  type NativePermission
} from "./assets.js";

type MutableOpenCodeConfig = {
  command?: Record<string, unknown>;
  agent?: Record<string, NativeAgent | undefined>;
  skills?: { paths?: string[]; urls?: string[] };
  mcp?: Record<string, unknown>;
  permission?: unknown;
};

function callerRestrictions(permission: unknown): Record<string, unknown> {
  if (permission === "deny" || permission === "ask") return { "*": permission };
  if (!permission || typeof permission !== "object") return {};
  const result: Record<string, unknown> = {};
  for (const [key, rule] of Object.entries(permission)) {
    if (rule === "deny" || rule === "ask") {
      result[key] = rule;
      continue;
    }
    if (!rule || typeof rule !== "object") continue;
    const restrictive = Object.fromEntries(
      Object.entries(rule).filter(([, action]) => action === "deny" || action === "ask")
    );
    if (Object.keys(restrictive).length > 0) result[key] = restrictive;
  }
  return result;
}

function mergePermissionWithUserDenials(
  permission: NativePermission | undefined,
  userPermission: unknown
): NativePermission {
  const userDenials = callerRestrictions(userPermission);
  const merged: Record<string, unknown> = { ...(permission as Record<string, unknown> | undefined) };
  for (const [key, denial] of Object.entries(userDenials)) {
    const existing = merged[key];
    merged[key] =
      existing && typeof existing === "object" && denial && typeof denial === "object"
        ? { ...(existing as Record<string, unknown>), ...(denial as Record<string, unknown>) }
        : denial;
  }
  return merged as NativePermission;
}

function assertNoCollisions(
  config: MutableOpenCodeConfig,
  assets: Awaited<ReturnType<typeof loadBlueprintNativeAssets>>
): void {
  const commandCollisions = Object.keys(assets.command).filter((name) => config.command?.[name] !== undefined);
  const agentCollisions = Object.keys(assets.agent).filter((name) => config.agent?.[name] !== undefined);
  if (config.mcp?.blueprint !== undefined) {
    throw new Error("Blueprint plugin refused to overwrite existing mcp.blueprint configuration");
  }
  if (commandCollisions.length > 0 || agentCollisions.length > 0) {
    throw new Error(
      `Blueprint plugin namespace collision: ${[
        ...commandCollisions.map((name) => `command.${name}`),
        ...agentCollisions.map((name) => `agent.${name}`)
      ].join(", ")}`
    );
  }
}

export const BlueprintPlugin: Plugin = async ({ directory }) => {
  const packageRoot = resolveBlueprintPackageRoot();
  const assets = await loadBlueprintNativeAssets(packageRoot);
  const activation = createBlueprintActivationHooks(assets.skillAliases);

  return {
    ...activation,
    config: async (config) => {
      const target = config as unknown as MutableOpenCodeConfig;
      assertNoCollisions(target, assets);
      const agents = Object.fromEntries(
        Object.entries(assets.agent).map(([name, agent]) => [
          name,
          {
            ...agent,
            permission: mergePermissionWithUserDenials(agent.permission, target.permission)
          }
        ])
      );
      const stateRoot = path.join(resolveOpenCodeDataRoot(), "blueprint");

      target.command = { ...(target.command ?? {}), ...assets.command };
      target.agent = { ...(target.agent ?? {}), ...agents };
      target.skills = {
        ...(target.skills ?? {}),
        paths: [...new Set([...(target.skills?.paths ?? []), assets.skillRoot])]
      };
      target.mcp = {
        ...(target.mcp ?? {}),
        blueprint: {
          type: "local",
          command: [process.env.BLUEPRINT_NODE_EXECUTABLE?.trim() || "node", assets.mcpServerEntry],
          cwd: directory,
          enabled: true,
          environment: {
            BLUEPRINT_EXTENSION_PATH: assets.packageRoot,
            BLUEPRINT_GLOBAL_HOME: stateRoot,
            BLUEPRINT_HOST: "opencode"
          }
        }
      };
    }
  };
};

export default BlueprintPlugin;
