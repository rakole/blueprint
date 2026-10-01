import path from "node:path";
import os from "node:os";
import { access, readdir, readFile, realpath, stat } from "node:fs/promises";

import type { Config, Plugin } from "@opencode-ai/plugin";

import { createBlueprintActivationHooks } from "./activation.js";
import {
  loadBlueprintNativeAssets,
  resolveBlueprintPackageRoot,
  resolveOpenCodeDataRoot,
  type NativeAgent,
  type NativePermission
} from "./assets.js";
import { parseNativeMarkdown } from "../shared/native-frontmatter.js";

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

export function mergePermissionWithCallerRestrictions(
  permission: NativePermission | undefined,
  userPermission: unknown
): NativePermission {
  const userDenials = callerRestrictions(userPermission);
  const merged: Record<string, unknown> = { ...(permission as Record<string, unknown> | undefined) };

  const restrictAllowedActions = (rule: unknown, restriction: "ask" | "deny"): unknown => {
    if (restriction === "deny") return "deny";
    if (rule === "allow") return "ask";
    if (rule === "ask" || rule === "deny") return rule;
    if (!rule || typeof rule !== "object") return rule;
    return Object.fromEntries(
      Object.entries(rule as Record<string, unknown>).map(([pattern, action]) => [
        pattern,
        action === "allow" ? "ask" : action
      ])
    );
  };

  for (const [key, denial] of Object.entries(userDenials)) {
    if (key === "*" && (denial === "ask" || denial === "deny")) {
      if (denial === "deny") {
        delete merged[key];
        merged[key] = "deny";
        continue;
      }
      for (const [permissionName, rule] of Object.entries(merged)) {
        merged[permissionName] = restrictAllowedActions(rule, "ask");
      }
      continue;
    }

    const existing = merged[key];
    const fallback = merged["*"];
    if (denial === "ask") {
      if (existing === undefined && fallback === "deny") continue;
      merged[key] = restrictAllowedActions(existing ?? fallback, "ask");
      continue;
    }
    if (denial === "deny") {
      delete merged[key];
      merged[key] = "deny";
      continue;
    }
    if (
      denial &&
      typeof denial === "object" &&
      (existing === "deny" || (existing === undefined && fallback === "deny"))
    ) {
      continue;
    }
    if (existing && typeof existing === "object" && denial && typeof denial === "object") {
      const restrictions = denial as Record<string, unknown>;
      const hasAsk = Object.values(restrictions).some((action) => action === "ask");
      const ordered = Object.fromEntries(
        Object.entries(existing as Record<string, unknown>).map(([pattern, action]) => [
          pattern,
          hasAsk && action === "allow" ? "ask" : action
        ])
      );
      for (const [pattern, action] of Object.entries(restrictions)) {
        if (action !== "deny") continue;
        delete ordered[pattern];
        ordered[pattern] = action;
      }
      delete merged[key];
      merged[key] = ordered;
      continue;
    }
    if ((existing === "allow" || existing === "ask") && denial && typeof denial === "object") {
      const ordered: Record<string, unknown> = { "*": existing };
      for (const [pattern, action] of Object.entries(denial as Record<string, unknown>)) {
        ordered[pattern] = action;
      }
      merged[key] = ordered;
      continue;
    }
    delete merged[key];
    merged[key] = denial;
  }
  return merged as NativePermission;
}

async function pathExists(candidate: string): Promise<boolean> {
  return access(candidate).then(
    () => true,
    () => false
  );
}

async function discoveredSkillNames(root: string): Promise<Set<string>> {
  const names = new Set<string>();
  if (!(await pathExists(root))) return names;

  const pending = [root];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const directory = pending.pop()!;
    const canonical = await realpath(directory);
    if (visited.has(canonical)) continue;
    visited.add(canonical);

    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      const candidateStat = entry.isSymbolicLink() ? await stat(candidate) : undefined;
      if (entry.isDirectory() || candidateStat?.isDirectory()) {
        pending.push(candidate);
        continue;
      }
      if (entry.name !== "SKILL.md" || (!entry.isFile() && !candidateStat?.isFile())) continue;
      const parsed = parseNativeMarkdown(await readFile(candidate, "utf8"), candidate);
      if (typeof parsed.frontmatter.name === "string") names.add(parsed.frontmatter.name);
    }
  }
  return names;
}

function discoveryRoots(config: MutableOpenCodeConfig, directory: string, worktree: string): string[] {
  const configured = (config.skills?.paths ?? []).map((root) => {
    const expanded = root.startsWith("~/") ? path.join(os.homedir(), root.slice(2)) : root;
    return path.isAbsolute(expanded) ? expanded : path.resolve(directory, expanded);
  });
  const roots = new Set<string>(configured);
  const stop = path.resolve(worktree);
  let current = path.resolve(directory);
  while (true) {
    for (const family of [".opencode", ".agents", ".claude"]) {
      roots.add(path.join(current, family, "skills"));
      roots.add(path.join(current, family, "skill"));
    }
    if (current === stop || current === path.dirname(current)) break;
    current = path.dirname(current);
  }
  const configRoot = process.env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), ".config");
  roots.add(path.join(configRoot, "opencode", "skills"));
  roots.add(path.join(configRoot, "opencode", "skill"));
  const customConfigRoot = process.env.OPENCODE_CONFIG_DIR?.trim();
  if (customConfigRoot) {
    roots.add(path.join(customConfigRoot, "skills"));
    roots.add(path.join(customConfigRoot, "skill"));
  }
  roots.add(path.join(os.homedir(), ".agents", "skills"));
  roots.add(path.join(os.homedir(), ".claude", "skills"));
  return [...roots];
}

async function assertNoForeignSkillCollisions(
  config: MutableOpenCodeConfig,
  assets: Awaited<ReturnType<typeof loadBlueprintNativeAssets>>,
  directory: string,
  worktree: string
): Promise<void> {
  if ((config.skills?.urls?.length ?? 0) > 0) {
    throw new Error(
      "Blueprint plugin cannot verify remote skills.urls for private helper collisions"
    );
  }
  const collisions = new Set<string>();
  for (const root of discoveryRoots(config, directory, worktree)) {
    if (path.resolve(root) === assets.skillRoot) continue;
    for (const name of await discoveredSkillNames(root)) {
      if (assets.skillAliases.has(name)) collisions.add(name);
    }
  }
  if (collisions.size > 0) {
    throw new Error(
      `Blueprint plugin refused foreign skill collisions: ${[...collisions].sort().join(", ")}`
    );
  }
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

export const BlueprintPlugin: Plugin = async ({ directory, worktree }) => {
  const packageRoot = resolveBlueprintPackageRoot();
  const assets = await loadBlueprintNativeAssets(packageRoot);
  const activation = createBlueprintActivationHooks(assets.skillAliases);

  return {
    ...activation,
    config: async (config) => {
      const target = config as unknown as MutableOpenCodeConfig;
      assertNoCollisions(target, assets);
      await assertNoForeignSkillCollisions(target, assets, directory, worktree);
      const agents = Object.fromEntries(
        Object.entries(assets.agent).map(([name, agent]) => [
          name,
          {
            ...agent,
            permission: mergePermissionWithCallerRestrictions(agent.permission, target.permission)
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
