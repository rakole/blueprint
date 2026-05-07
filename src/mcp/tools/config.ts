import * as z from "zod/v4";

import {
  BLUEPRINT_CONFIG_PATH,
  ensureRepoRoot,
  readJsonIfPresent,
  resolveBlueprintPath,
  toRepoRelativePath,
  writeJsonFile
} from "./artifacts.js";
import { getBlueprintRuntimeHost } from "../runtime-host.js";
import { validateFieldNameSegment } from "../../shared/security.js";

type ConfigScope = "project" | "defaults" | "effective";
type ModelProfile = "quality" | "balanced" | "budget" | "inherit";
type ProgressMode = "quiet" | "stage" | "checklist";
type StructuredConfirmationsMode = "auto" | "required";
type UserCheckpointMode = "off" | "phase" | "plan";
type TaskTrackerMode = "off" | "auto";
type ExternalSourcesMode = "off" | "ask" | "auto";

type BlueprintConfig = {
  version: number;
  mode: string;
  granularity: string;
  model_profile: ModelProfile;
  project_code: string | null;
  phase_naming: string;
  response_language: string | null;
  planning: {
    commit_docs: boolean;
    search_gitignored: boolean;
  };
  ux: {
    progress_mode: ProgressMode;
    structured_confirmations: StructuredConfirmationsMode;
    user_checkpoints: UserCheckpointMode;
  };
  orchestration: {
    task_tracker: TaskTrackerMode;
  };
  research: {
    external_sources: ExternalSourcesMode;
  };
  workflow: {
    research: boolean;
    plan_check: boolean;
    verifier: boolean;
    nyquist_validation: boolean;
    ui_phase: boolean;
    ui_safety_gate: boolean;
    code_review: boolean;
    code_review_depth: string;
    auto_advance: boolean;
    research_before_questions: boolean;
    discuss_mode: string;
    skip_discuss: boolean;
    use_worktrees: boolean;
    subagents: boolean;
    subagent_timeout: number;
  };
  parallelization: {
    enabled: boolean;
    plan_level: boolean;
    task_level: boolean;
    skip_checkpoints: boolean;
    max_concurrent_agents: number;
    min_plans_for_parallel: number;
  };
  git: {
    branching_strategy: string;
    base_branch: string | null;
    phase_branch_template: string;
    milestone_branch_template: string;
    quick_branch_template: string | null;
  };
  gates: {
    confirm_project: boolean;
    confirm_phases: boolean;
    confirm_roadmap: boolean;
    confirm_breakdown: boolean;
    confirm_plan: boolean;
    execute_next_plan: boolean;
    issues_review: boolean;
    confirm_transition: boolean;
  };
  safety: {
    always_confirm_destructive: boolean;
    always_confirm_external_services: boolean;
  };
  maintenance: {
    patch_registry: string;
    workspace_root: string;
  };
  agent_skills: Record<string, unknown>;
};

type ConfigProvenance = {
  layersApplied: string[];
  defaultsPath: string | null;
  projectPath: string | null;
  defaultsApplied: boolean;
  projectApplied: boolean;
};

type ConfigGetArgs = {
  scope?: ConfigScope;
  cwd?: string;
  defaultsPath?: string;
};

type ConfigSetArgs = {
  scope?: Exclude<ConfigScope, "effective">;
  cwd?: string;
  defaultsPath?: string;
  patch?: Record<string, unknown>;
};

type ConfigSetProfileArgs = {
  cwd?: string;
  defaultsPath?: string;
  profile: ModelProfile;
};

type SeedProjectConfigArgs = {
  cwd?: string;
  defaultsPath?: string;
};

type ConfigGetResult = {
  scope: ConfigScope;
  config: BlueprintConfig;
  provenance: ConfigProvenance;
  sourcePath: string | null;
  warnings: string[];
};

type ConfigSetResult = {
  scope: Exclude<ConfigScope, "effective">;
  updatedKeys: string[];
  config: BlueprintConfig;
  provenance: ConfigProvenance;
  configPath: string;
  warnings: string[];
};

type ConfigSetProfileResult = {
  profile: ModelProfile;
  updatedKeys: ["model_profile"];
  configPath: string;
};

type SeedProjectConfigResult = {
  config: BlueprintConfig;
  configPath: string;
  provenance: ConfigProvenance;
  warnings: string[];
};

const MODEL_PROFILES = ["quality", "balanced", "budget", "inherit"] as const;
const PROGRESS_MODES = ["quiet", "stage", "checklist"] as const;
const STRUCTURED_CONFIRMATION_MODES = ["auto", "required"] as const;
const USER_CHECKPOINT_MODES = ["off", "phase", "plan"] as const;
const TASK_TRACKER_MODES = ["off", "auto"] as const;
const EXTERNAL_SOURCE_MODES = ["off", "ask", "auto"] as const;
const HARD_CODED_CONFIG_VERSION = 2;
const HOST_DEFAULT_PATCH_REGISTRIES = {
  gemini: "~/.gemini/blueprint/patches",
  tabnine: "~/.tabnine/blueprint/patches"
} as const;

const configGetInputSchema = {
  scope: z.enum(["project", "defaults", "effective"]).optional(),
  cwd: z.string().optional(),
  defaultsPath: z.string().optional()
};

const configSetInputSchema = {
  scope: z.enum(["project", "defaults"]).optional(),
  cwd: z.string().optional(),
  defaultsPath: z.string().optional(),
  patch: z.record(z.string(), z.unknown()).optional()
};

const configSetProfileInputSchema = {
  cwd: z.string().optional(),
  defaultsPath: z.string().optional(),
  profile: z.enum(MODEL_PROFILES)
};

function cloneConfig(config: BlueprintConfig): BlueprintConfig {
  return JSON.parse(JSON.stringify(config)) as BlueprintConfig;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDefaultUserConfigPath(defaultsPath?: string): string {
  return defaultsPath ?? getBlueprintRuntimeHost().defaultsPath;
}

function getHardCodedConfig(): BlueprintConfig {
  return {
    version: HARD_CODED_CONFIG_VERSION,
    mode: "interactive",
    granularity: "standard",
    model_profile: "balanced",
    project_code: null,
    phase_naming: "sequential",
    response_language: null,
    planning: {
      commit_docs: true,
      search_gitignored: false
    },
    ux: {
      progress_mode: "quiet",
      structured_confirmations: "auto",
      user_checkpoints: "off"
    },
    orchestration: {
      task_tracker: "off"
    },
    research: {
      external_sources: "off"
    },
    workflow: {
      research: true,
      plan_check: true,
      verifier: true,
      nyquist_validation: true,
      ui_phase: true,
      ui_safety_gate: true,
      code_review: true,
      code_review_depth: "standard",
      auto_advance: false,
      research_before_questions: false,
      discuss_mode: "discuss",
      skip_discuss: false,
      use_worktrees: true,
      subagents: true,
      subagent_timeout: 300000
    },
    parallelization: {
      enabled: true,
      plan_level: true,
      task_level: false,
      skip_checkpoints: true,
      max_concurrent_agents: 3,
      min_plans_for_parallel: 2
    },
    git: {
      branching_strategy: "none",
      base_branch: null,
      phase_branch_template: "blu/phase-{phase}-{slug}",
      milestone_branch_template: "blu/{milestone}-{slug}",
      quick_branch_template: null
    },
    gates: {
      confirm_project: true,
      confirm_phases: true,
      confirm_roadmap: true,
      confirm_breakdown: true,
      confirm_plan: true,
      execute_next_plan: true,
      issues_review: true,
      confirm_transition: true
    },
    safety: {
      always_confirm_destructive: true,
      always_confirm_external_services: true
    },
    maintenance: {
      patch_registry: getBlueprintRuntimeHost().patchRegistryPath,
      workspace_root: "~/blueprint-workspaces"
    },
    agent_skills: {}
  };
}

function alignHostSpecificMaintenanceDefaults(
  config: BlueprintConfig,
  warnings: string[]
): void {
  const runtimeHost = getBlueprintRuntimeHost();
  const activeHostPatchRegistry = runtimeHost.patchRegistryPath;
  const inactiveHostPatchRegistry =
    runtimeHost.host === "gemini"
      ? HOST_DEFAULT_PATCH_REGISTRIES.tabnine
      : HOST_DEFAULT_PATCH_REGISTRIES.gemini;

  if (config.maintenance.patch_registry === inactiveHostPatchRegistry) {
    config.maintenance.patch_registry = activeHostPatchRegistry;
    warnings.push(
      `Aligned maintenance.patch_registry to the active ${runtimeHost.host} host default.`
    );
  }
}

function deepCloneObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function setNestedValue(
  target: Record<string, unknown>,
  pathSegments: string[],
  value: unknown
): void {
  let current = target;

  for (const segment of pathSegments.slice(0, -1)) {
    validateFieldNameSegment(segment);
    const next = current[segment];

    if (!isPlainObject(next)) {
      current[segment] = {};
    }

    current = current[segment] as Record<string, unknown>;
  }

  const finalSegment = pathSegments[pathSegments.length - 1];
  validateFieldNameSegment(finalSegment);
  current[finalSegment] = value;
}

function coerceLegacyConfigCandidate(
  candidate: Record<string, unknown>,
  warnings: string[]
): Record<string, unknown> {
  const nextCandidate = deepCloneObject(candidate);
  const legacyTopLevelMappings = {
    commit_docs: ["planning", "commit_docs"],
    search_gitignored: ["planning", "search_gitignored"]
  } as const;

  for (const [legacyKey, targetPath] of Object.entries(legacyTopLevelMappings)) {
    if (!(legacyKey in nextCandidate)) {
      continue;
    }

    const legacyValue = nextCandidate[legacyKey];
    delete nextCandidate[legacyKey];

    if (typeof legacyValue !== "boolean") {
      warnings.push(`Ignored invalid legacy config value for ${legacyKey}`);
      continue;
    }

    setNestedValue(nextCandidate, [...targetPath], legacyValue);
    warnings.push(`Migrated legacy config key ${legacyKey} to ${targetPath.join(".")}`);
  }

  if (typeof nextCandidate.parallelization === "boolean") {
    nextCandidate.parallelization = {
      enabled: nextCandidate.parallelization
    };
    warnings.push(
      "Migrated legacy config key parallelization to parallelization.enabled"
    );
  }

  return nextCandidate;
}

function isReservedKey(scope: Exclude<ConfigScope, "effective">, fullPath: string): boolean {
  return (
    fullPath === "hooks" ||
    fullPath.startsWith("hooks.") ||
    (scope === "project" &&
      (fullPath === "workflow.use_workspaces" ||
        fullPath === "workflow.use_workstreams"))
  );
}

function applyConfigLayer(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  scope: Exclude<ConfigScope, "effective">,
  warnings: string[],
  pathPrefix: string[] = [],
  appliedPaths?: Set<string>
): void {
  for (const [key, value] of Object.entries(source)) {
    try {
      validateFieldNameSegment(key, "Config key");
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : `Ignored unsafe config key: ${key}`);
      continue;
    }

    const fullPath = [...pathPrefix, key].join(".");

    if (isReservedKey(scope, fullPath)) {
      warnings.push(`Ignored disallowed config key: ${fullPath}`);
      continue;
    }

    if (!(key in target)) {
      warnings.push(`Ignored unknown config key: ${fullPath}`);
      continue;
    }

    const currentValue = target[key];

    if (fullPath === "version") {
      if (value === HARD_CODED_CONFIG_VERSION) {
        target[key] = value;
        appliedPaths?.add(fullPath);
      } else {
        warnings.push(
          `Ignored unsupported config version ${String(value)}; using version ${HARD_CODED_CONFIG_VERSION}`
        );
      }
      continue;
    }

    if (fullPath === "model_profile") {
      if (typeof value === "string" && MODEL_PROFILES.includes(value as ModelProfile)) {
        target[key] = value;
        appliedPaths?.add(fullPath);
      } else {
        warnings.push(`Ignored invalid config value for ${fullPath}`);
      }
      continue;
    }

    if (fullPath === "ux.progress_mode") {
      if (typeof value === "string" && PROGRESS_MODES.includes(value as ProgressMode)) {
        target[key] = value;
        appliedPaths?.add(fullPath);
      } else {
        warnings.push(`Ignored invalid config value for ${fullPath}`);
      }
      continue;
    }

    if (fullPath === "ux.structured_confirmations") {
      if (
        typeof value === "string" &&
        STRUCTURED_CONFIRMATION_MODES.includes(value as StructuredConfirmationsMode)
      ) {
        target[key] = value;
        appliedPaths?.add(fullPath);
      } else {
        warnings.push(`Ignored invalid config value for ${fullPath}`);
      }
      continue;
    }

    if (fullPath === "ux.user_checkpoints") {
      if (typeof value === "string" && USER_CHECKPOINT_MODES.includes(value as UserCheckpointMode)) {
        target[key] = value;
        appliedPaths?.add(fullPath);
      } else {
        warnings.push(`Ignored invalid config value for ${fullPath}`);
      }
      continue;
    }

    if (fullPath === "orchestration.task_tracker") {
      if (typeof value === "string" && TASK_TRACKER_MODES.includes(value as TaskTrackerMode)) {
        target[key] = value;
        appliedPaths?.add(fullPath);
      } else {
        warnings.push(`Ignored invalid config value for ${fullPath}`);
      }
      continue;
    }

    if (fullPath === "research.external_sources") {
      if (typeof value === "string" && EXTERNAL_SOURCE_MODES.includes(value as ExternalSourcesMode)) {
        target[key] = value;
        appliedPaths?.add(fullPath);
      } else {
        warnings.push(`Ignored invalid config value for ${fullPath}`);
      }
      continue;
    }

    if (fullPath === "agent_skills") {
      if (isPlainObject(value)) {
        target[key] = value;
        appliedPaths?.add(fullPath);
      } else {
        warnings.push(`Ignored invalid config value for ${fullPath}`);
      }
      continue;
    }

    if (isPlainObject(currentValue)) {
      if (fullPath === "parallelization" && typeof value === "boolean") {
        currentValue.enabled = value;
        warnings.push(
          "Migrated shorthand config key parallelization to parallelization.enabled"
        );
        continue;
      }

      if (!isPlainObject(value)) {
        warnings.push(`Ignored invalid config object for ${fullPath}`);
        continue;
      }

      applyConfigLayer(currentValue, value, scope, warnings, [...pathPrefix, key], appliedPaths);
      continue;
    }

    if (currentValue === null) {
      if (value === null || typeof value === "string") {
        target[key] = value;
        appliedPaths?.add(fullPath);
      } else {
        warnings.push(`Ignored invalid nullable config value for ${fullPath}`);
      }
      continue;
    }

    if (typeof value === typeof currentValue) {
      target[key] = value;
      appliedPaths?.add(fullPath);
      continue;
    }

    warnings.push(`Ignored invalid config type for ${fullPath}`);
  }
}

function normalizeConfigLayer(
  candidate: unknown,
  scope: Exclude<ConfigScope, "effective">
): { config: BlueprintConfig; warnings: string[] } {
  if (!isPlainObject(candidate)) {
    throw new Error("Blueprint config must be a JSON object.");
  }

  const config = getHardCodedConfig();
  const warnings: string[] = [];
  const coercedCandidate = coerceLegacyConfigCandidate(candidate, warnings);
  applyConfigLayer(
    config as unknown as Record<string, unknown>,
    coercedCandidate,
    scope,
    warnings
  );
  alignHostSpecificMaintenanceDefaults(config, warnings);

  return { config, warnings };
}

function getNestedValue(
  source: Record<string, unknown>,
  pathSegments: string[]
): unknown {
  let current: unknown = source;

  for (const segment of pathSegments) {
    if (!isPlainObject(current) || !(segment in current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function buildAppliedConfigLayer(
  normalized: BlueprintConfig,
  appliedPaths: Set<string>
): Record<string, unknown> {
  const layer: Record<string, unknown> = {};

  for (const fullPath of appliedPaths) {
    const pathSegments = fullPath.split(".");
    const value = getNestedValue(normalized as unknown as Record<string, unknown>, pathSegments);

    if (value === undefined) {
      continue;
    }

    setNestedValue(layer, pathSegments, value);
  }

  return layer;
}

function normalizeSparseConfigLayer(
  candidate: unknown,
  scope: Exclude<ConfigScope, "effective">
): { config: Record<string, unknown>; warnings: string[] } {
  if (!isPlainObject(candidate)) {
    throw new Error("Blueprint config must be a JSON object.");
  }

  const config = getHardCodedConfig();
  const warnings: string[] = [];
  const appliedPaths = new Set<string>();
  const coercedCandidate = coerceLegacyConfigCandidate(candidate, warnings);
  applyConfigLayer(
    config as unknown as Record<string, unknown>,
    coercedCandidate,
    scope,
    warnings,
    [],
    appliedPaths
  );
  alignHostSpecificMaintenanceDefaults(config, warnings);

  return {
    config: buildAppliedConfigLayer(config, appliedPaths),
    warnings
  };
}

function flattenPatchKeys(
  candidate: Record<string, unknown>,
  prefix: string[] = []
): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(candidate)) {
    const fullPath = [...prefix, key];

    if (isPlainObject(value) && key !== "agent_skills") {
      keys.push(...flattenPatchKeys(value, fullPath));
    } else {
      keys.push(fullPath.join("."));
    }
  }

  return keys;
}

function collectChangedKeys(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix: string[] = []
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];

  for (const key of keys) {
    const pathSegments = [...prefix, key];
    const beforeValue = before[key];
    const afterValue = after[key];

    if (
      isPlainObject(beforeValue) &&
      isPlainObject(afterValue) &&
      key !== "agent_skills"
    ) {
      changed.push(...collectChangedKeys(beforeValue, afterValue, pathSegments));
      continue;
    }

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changed.push(pathSegments.join("."));
    }
  }

  return changed;
}

async function readProjectConfig(
  projectRoot: string
): Promise<Record<string, unknown> | null> {
  return readJsonIfPresent(resolveBlueprintPath(projectRoot, BLUEPRINT_CONFIG_PATH));
}

async function readDefaultsConfig(
  defaultsPath?: string
): Promise<{
  config: BlueprintConfig | null;
  path: string;
  warnings: string[];
}> {
  const resolvedPath = getDefaultUserConfigPath(defaultsPath);
  const raw = await readJsonIfPresent(resolvedPath).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);

    return {
      __error: message
    } as Record<string, unknown>;
  });

  if (!raw) {
    return {
      config: null,
      path: resolvedPath,
      warnings: []
    };
  }

  if ("__error" in raw) {
    return {
      config: null,
      path: resolvedPath,
      warnings: [
        `Saved defaults at ${resolvedPath} could not be normalized; falling back to hardcoded defaults.`
      ]
    };
  }

  try {
    const normalized = normalizeConfigLayer(raw, "defaults");

    return {
      config: normalized.config,
      path: resolvedPath,
      warnings: normalized.warnings
    };
  } catch {
    return {
      config: null,
      path: resolvedPath,
      warnings: [
        `Saved defaults at ${resolvedPath} could not be normalized; falling back to hardcoded defaults.`
      ]
    };
  }
}

async function composeConfig(
  projectRoot: string,
  defaultsPath?: string
): Promise<{
  config: BlueprintConfig;
  provenance: ConfigProvenance;
  warnings: string[];
  sourcePath: string | null;
}> {
  const warnings: string[] = [];
  const defaults = await readDefaultsConfig(defaultsPath);
  const projectConfigRaw = await readProjectConfig(projectRoot);
  let projectConfig: BlueprintConfig | null = null;
  let projectConfigLayer: Record<string, unknown> | null = null;
  let projectWarnings: string[] = [];

  if (defaults.config) {
    warnings.push(...defaults.warnings);
  } else if (defaults.warnings.length > 0) {
    warnings.push(...defaults.warnings);
  }

  if (projectConfigRaw) {
    const normalized = normalizeConfigLayer(projectConfigRaw, "project");
    projectConfig = normalized.config;
    const sparseNormalized = normalizeSparseConfigLayer(projectConfigRaw, "project");
    projectConfigLayer = sparseNormalized.config;
    projectWarnings = normalized.warnings;
  }

  warnings.push(...projectWarnings);

  const config = getHardCodedConfig();

  if (defaults.config) {
    applyConfigLayer(
      config as unknown as Record<string, unknown>,
      defaults.config as unknown as Record<string, unknown>,
      "defaults",
      warnings
    );
  }

  if (projectConfigLayer) {
    applyConfigLayer(
      config as unknown as Record<string, unknown>,
      projectConfigLayer,
      "project",
      warnings
    );
  }

  const projectPath = resolveBlueprintPath(projectRoot, BLUEPRINT_CONFIG_PATH);

  return {
    config,
    provenance: {
      layersApplied: [
        "hardcoded",
        ...(defaults.config ? ["defaults"] : []),
        ...(projectConfig ? ["project"] : [])
      ],
      defaultsPath: defaults.config ? defaults.path : null,
      projectPath: projectConfig ? toRepoRelativePath(projectRoot, projectPath) : null,
      defaultsApplied: defaults.config !== null,
      projectApplied: projectConfig !== null
    },
    warnings,
    sourcePath: projectConfig
      ? toRepoRelativePath(projectRoot, projectPath)
      : defaults.config
        ? defaults.path
        : null
  };
}

export async function blueprintConfigGet(
  args: ConfigGetArgs = {}
): Promise<ConfigGetResult> {
  const scope = args.scope ?? "effective";
  const projectRoot = await ensureRepoRoot(args.cwd);
  const defaultsPath = getDefaultUserConfigPath(args.defaultsPath);
  const projectConfigPath = resolveBlueprintPath(projectRoot, BLUEPRINT_CONFIG_PATH);

  if (scope === "effective") {
    const composed = await composeConfig(projectRoot, args.defaultsPath);

    return {
      scope,
      config: composed.config,
      provenance: composed.provenance,
      sourcePath: composed.sourcePath,
      warnings: composed.warnings
    };
  }

  if (scope === "defaults") {
    const defaults = await readDefaultsConfig(args.defaultsPath);

    return {
      scope,
      config: defaults.config ?? getHardCodedConfig(),
      provenance: {
        layersApplied: ["hardcoded", ...(defaults.config ? ["defaults"] : [])],
        defaultsPath: defaults.config ? defaults.path : null,
        projectPath: null,
        defaultsApplied: defaults.config !== null,
        projectApplied: false
      },
      sourcePath: defaults.config ? defaults.path : null,
      warnings: defaults.warnings
    };
  }

  const rawProjectConfig = await readProjectConfig(projectRoot);

  if (!rawProjectConfig) {
    return {
      scope,
      config: getHardCodedConfig(),
      provenance: {
        layersApplied: ["hardcoded"],
        defaultsPath,
        projectPath: null,
        defaultsApplied: false,
        projectApplied: false
      },
      sourcePath: null,
      warnings: ["Project config does not exist yet; returning hardcoded defaults."]
    };
  }

  const normalized = normalizeConfigLayer(rawProjectConfig, "project");

  return {
    scope,
    config: normalized.config,
    provenance: {
      layersApplied: ["hardcoded", "project"],
      defaultsPath,
      projectPath: toRepoRelativePath(projectRoot, projectConfigPath),
      defaultsApplied: false,
      projectApplied: true
    },
    sourcePath: toRepoRelativePath(projectRoot, projectConfigPath),
    warnings: normalized.warnings
  };
}

export async function blueprintConfigSet(
  args: ConfigSetArgs = {}
): Promise<ConfigSetResult> {
  const scope = args.scope ?? "project";
  const patch = args.patch ?? {};

  if (!isPlainObject(patch)) {
    throw new Error("Config patch must be a JSON object.");
  }

  const projectRoot = await ensureRepoRoot(args.cwd);
  const baseResult = await blueprintConfigGet({
    scope: scope === "project" ? "effective" : "defaults",
    cwd: projectRoot,
    defaultsPath: args.defaultsPath
  });
  const previousConfig = cloneConfig(baseResult.config);
  const nextConfig = cloneConfig(baseResult.config);
  const warnings = [...baseResult.warnings];

  for (const key of flattenPatchKeys(patch)) {
    if (isReservedKey(scope, key)) {
      throw new Error(`Config key is not allowed in ${scope} scope: ${key}`);
    }
  }

  applyConfigLayer(
    nextConfig as unknown as Record<string, unknown>,
    patch,
    scope,
    warnings
  );

  const configPath =
    scope === "project"
      ? resolveBlueprintPath(projectRoot, BLUEPRINT_CONFIG_PATH)
      : getDefaultUserConfigPath(args.defaultsPath);

  await writeJsonFile(configPath, nextConfig as unknown as Record<string, unknown>);

  const changedKeys = collectChangedKeys(
    previousConfig as unknown as Record<string, unknown>,
    nextConfig as unknown as Record<string, unknown>
  );
  const patchKeys = flattenPatchKeys(patch);

  return {
    scope,
    updatedKeys: patchKeys.filter((key) => changedKeys.includes(key)),
    config: nextConfig,
    provenance: {
      layersApplied: ["hardcoded", scope],
      defaultsPath:
        scope === "defaults"
          ? configPath
          : baseResult.provenance.defaultsApplied
            ? baseResult.provenance.defaultsPath
            : null,
      projectPath:
        scope === "project"
          ? toRepoRelativePath(projectRoot, configPath)
          : baseResult.provenance.projectPath,
      defaultsApplied:
        scope === "defaults" || baseResult.provenance.defaultsApplied,
      projectApplied:
        scope === "project" || baseResult.provenance.projectApplied
    },
    configPath:
      scope === "project" ? toRepoRelativePath(projectRoot, configPath) : configPath,
    warnings
  };
}

export async function blueprintConfigSetProfile(
  args: ConfigSetProfileArgs
): Promise<ConfigSetProfileResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const projectConfig = await readProjectConfig(projectRoot);

  if (!projectConfig) {
    throw new Error(
      "Blueprint project config is missing. Initialize the repo first with /blu-new-project."
    );
  }

  const result = await blueprintConfigSet({
    cwd: projectRoot,
    defaultsPath: args.defaultsPath,
    scope: "project",
    patch: {
      model_profile: args.profile
    }
  });

  return {
    profile: args.profile,
    updatedKeys: ["model_profile"],
    configPath: result.configPath
  };
}

export async function seedProjectConfig(
  args: SeedProjectConfigArgs = {}
): Promise<SeedProjectConfigResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const composed = await composeConfig(projectRoot, args.defaultsPath);
  const projectConfigPath = resolveBlueprintPath(projectRoot, BLUEPRINT_CONFIG_PATH);
  const relativeConfigPath = toRepoRelativePath(projectRoot, projectConfigPath);

  await writeJsonFile(
    projectConfigPath,
    composed.config as unknown as Record<string, unknown>
  );

  return {
    config: composed.config,
    configPath: relativeConfigPath,
    provenance: {
      ...composed.provenance,
      projectPath: relativeConfigPath,
      projectApplied: true
    },
    warnings: composed.warnings
  };
}

export const configToolDefinitions = [
  {
    name: "blueprint_config_get",
    description: "Load normalized Blueprint config from project, defaults, or effective scope.",
    inputSchema: configGetInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintConfigGet(args as ConfigGetArgs)
  },
  {
    name: "blueprint_config_set",
    description: "Persist a normalized Blueprint config patch to project or defaults scope.",
    inputSchema: configSetInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintConfigSet(args as ConfigSetArgs)
  },
  {
    name: "blueprint_config_set_profile",
    description: "Persist a project-local Blueprint model profile without mutating saved defaults.",
    inputSchema: configSetProfileInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintConfigSetProfile(args as ConfigSetProfileArgs)
  }
];
