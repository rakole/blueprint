import { promises as fs } from "node:fs";

import * as z from "zod/v4";

import {
  classifyLightweightScope,
  type LightweightMode,
  type ScopeClassification,
} from "../lightweight-classifier.js";
import type { ToolDefinition } from "../tool-types.js";
import {
  buildBlueprintReportPath,
  ensureRepoRoot,
  resolveBlueprintPath,
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import {
  blueprintCommandCatalog,
  blueprintProjectStatus,
} from "./project.js";

type LightweightPreflightArgs = {
  cwd?: string;
  mode: LightweightMode;
  taskText: string;
  flags?: string[];
};

type LightweightPreflightProjectStatus = {
  initialized: boolean;
  health: "healthy" | "partial" | "uninitialized" | "unhealthy";
  currentPhase?: string | null;
  currentMilestone?: string | null;
  nextAction?: string | null;
};

type LightweightPreflightEffectiveConfig = {
  workflow?: {
    subagents?: boolean;
    no_uat?: boolean;
    quick?: unknown;
  };
  provenance?: unknown;
  warnings?: string[];
};

type LightweightPreflightResult = {
  mode: LightweightMode;
  classification: ScopeClassification;
  projectStatus: LightweightPreflightProjectStatus;
  effectiveConfig?: LightweightPreflightEffectiveConfig;
  implementedRoutes: string[];
  quickReport?: {
    name: "quick-run-latest";
    exists: boolean;
    path?: string;
    updatedAt?: string;
  };
  gates: {
    healthGate: "pass" | "route-health" | "route-new-project";
    overwriteGate?: "none" | "requires-confirmation" | "force-bypassed";
    clarityGate: "pass" | "requires-clarification";
  };
  nextSafeAction: string;
  warnings: string[];
};

const lightweightPreflightInputSchema = {
  cwd: z.string().optional(),
  mode: z.enum(["fast", "quick"]),
  taskText: z.string(),
  flags: z.array(z.string()).optional(),
};

function normalizeFlags(flags: string[] = []): string[] {
  return flags
    .map((flag) => flag.trim().toLowerCase())
    .filter((flag) => flag.length > 0)
    .map((flag) => flag.replace(/^--/, ""));
}

function toClassifierFlags(flags: string[] = []) {
  const normalized = new Set(normalizeFlags(flags));

  return {
    discuss: normalized.has("discuss") || normalized.has("full"),
    research: normalized.has("research") || normalized.has("full"),
    validate: normalized.has("validate") || normalized.has("full"),
    full: normalized.has("full"),
  };
}

function projectHealthStatus(
  status: Awaited<ReturnType<typeof blueprintProjectStatus>>,
): LightweightPreflightProjectStatus["health"] {
  if (status.status === "uninitialized") {
    return "uninitialized";
  }

  if (status.status === "partial") {
    return "partial";
  }

  if (!status.initialized) {
    return "unhealthy";
  }

  const blockingWarnings = status.health.warnings.filter(
    (warning) => !/validated and ready for reuse|ready for reuse/i.test(warning),
  );

  return status.health.missingArtifacts.length === 0 && blockingWarnings.length === 0
    ? "healthy"
    : "unhealthy";
}

function routeAction(route: ScopeClassification["route"]): string {
  return route === "fast" || route === "quick"
    ? `/blu-${route}`
    : `/blu-${route}`;
}

function deriveGatedClassification(args: {
  mode: LightweightMode;
  classification: ScopeClassification;
  healthGate: LightweightPreflightResult["gates"]["healthGate"];
  health: LightweightPreflightProjectStatus["health"];
}): ScopeClassification {
  if (args.healthGate === "route-health") {
    return {
      ...args.classification,
      route: "health",
      confidence: "high",
      allowedWrites: [],
      requiredGates: [
        ...new Set([...args.classification.requiredGates, "project-health"]),
      ],
      validationBudget: "route",
      reasons: [
        "Blueprint state is partial or unhealthy; route to health before mutation.",
        ...args.classification.reasons,
      ],
    };
  }

  if (args.healthGate === "route-new-project") {
    return {
      ...args.classification,
      route: "new-project",
      confidence: "high",
      allowedWrites: [],
      requiredGates: [
        ...new Set([...args.classification.requiredGates, "project-bootstrap"]),
      ],
      validationBudget: "route",
      reasons: [
        "Blueprint is uninitialized; route to new-project before Blueprint persistence.",
        ...args.classification.reasons,
      ],
    };
  }

  if (
    args.health === "uninitialized" &&
    args.mode === "fast" &&
    args.classification.route === "fast"
  ) {
    return {
      ...args.classification,
      allowedWrites: args.classification.allowedWrites.filter(
        (allowedWrite) => !/\.blueprint\//.test(allowedWrite),
      ),
      requiredGates: [
        ...new Set([...args.classification.requiredGates, "no-blueprint-persistence"]),
      ],
      reasons: [
        "Blueprint is uninitialized; fast may only perform trivial inline repo work without Blueprint persistence.",
        ...args.classification.reasons,
      ],
    };
  }

  return args.classification;
}

function deriveNextSafeAction(args: {
  mode: LightweightMode;
  classification: ScopeClassification;
  healthGate: LightweightPreflightResult["gates"]["healthGate"];
  overwriteGate?: LightweightPreflightResult["gates"]["overwriteGate"];
}): string {
  if (args.healthGate === "route-health") {
    return "/blu-health";
  }

  if (args.healthGate === "route-new-project") {
    return "/blu-new-project";
  }

  if (args.classification.route === "clarify") {
    return `/blu-${args.mode}`;
  }

  return args.classification.route === "fast" || args.classification.route === "quick"
    ? `/blu-${args.classification.route}`
    : routeAction(args.classification.route);
}

function workflowConfigSubset(config: unknown): LightweightPreflightEffectiveConfig["workflow"] {
  if (!config || typeof config !== "object" || !("workflow" in config)) {
    return undefined;
  }

  const workflow = (config as { workflow?: Record<string, unknown> }).workflow;

  if (!workflow || typeof workflow !== "object") {
    return undefined;
  }

  return {
    subagents:
      typeof workflow.subagents === "boolean" ? workflow.subagents : undefined,
    no_uat: typeof workflow.no_uat === "boolean" ? workflow.no_uat : undefined,
    quick: workflow.quick,
  };
}

async function quickRunReportStatus(projectRoot: string): Promise<
  NonNullable<LightweightPreflightResult["quickReport"]>
> {
  const reportPath = buildBlueprintReportPath("quick-run-latest");
  const absolutePath = resolveBlueprintPath(projectRoot, reportPath);

  try {
    const stats = await fs.stat(absolutePath);

    return {
      name: "quick-run-latest",
      exists: true,
      path: reportPath,
      updatedAt: stats.mtime.toISOString(),
    };
  } catch {
    return {
      name: "quick-run-latest",
      exists: false,
      path: reportPath,
    };
  }
}

export async function blueprintLightweightPreflight(
  args: LightweightPreflightArgs,
): Promise<LightweightPreflightResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const normalizedFlags = normalizeFlags(args.flags);
  const baseClassification = classifyLightweightScope({
    mode: args.mode,
    taskText: args.taskText,
    flags: toClassifierFlags(args.flags),
  });
  const status = await blueprintProjectStatus({ cwd: projectRoot });
  const health = projectHealthStatus(status);
  const healthGate =
    health === "partial" || health === "unhealthy"
      ? "route-health"
      : health === "uninitialized" &&
          (args.mode === "quick" || baseClassification.route !== "fast")
        ? "route-new-project"
        : "pass";
  const classification = deriveGatedClassification({
    mode: args.mode,
    classification: baseClassification,
    healthGate,
    health,
  });
  const catalog = await blueprintCommandCatalog();
  const implementedRoutes = Object.values(catalog.commands)
    .filter((entry) => entry.implemented)
    .map((entry) => entry.command)
    .sort();
  const warnings = [...status.health.warnings];
  let effectiveConfig: LightweightPreflightEffectiveConfig | undefined;

  if (args.mode === "quick") {
    try {
      const configResult = await blueprintConfigGet({
        cwd: projectRoot,
        scope: "effective",
      });

      effectiveConfig = {
        workflow: workflowConfigSubset(configResult.config),
        provenance: configResult.provenance,
        warnings: configResult.warnings,
      };
      warnings.push(...configResult.warnings);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Effective config could not be read: ${message}`);
    }
  }

  const quickReport =
    args.mode === "quick" ? await quickRunReportStatus(projectRoot) : undefined;
  const overwriteGate =
    args.mode !== "quick" || !quickReport?.exists
      ? "none"
      : normalizedFlags.includes("force")
        ? "force-bypassed"
        : "requires-confirmation";
  const clarityGate =
    classification.route === "clarify" ? "requires-clarification" : "pass";
  const nextSafeAction = deriveNextSafeAction({
    mode: args.mode,
    classification,
    healthGate,
    overwriteGate,
  });

  if (args.mode === "fast" && health === "uninitialized") {
    warnings.push(
      "Blueprint is uninitialized; fast may complete trivial repo work inline but must not persist Blueprint state.",
    );
  }

  return {
    mode: args.mode,
    classification,
    projectStatus: {
      initialized: status.initialized,
      health,
      currentPhase: status.currentPhase,
      currentMilestone: status.currentMilestone,
      nextAction: status.nextAction,
    },
    ...(effectiveConfig ? { effectiveConfig } : {}),
    implementedRoutes,
    ...(quickReport ? { quickReport } : {}),
    gates: {
      healthGate,
      overwriteGate,
      clarityGate,
    },
    nextSafeAction,
    warnings: [...new Set(warnings)],
  };
}

export const lightweightToolDefinitions = [
  {
    name: "blueprint_lightweight_preflight",
    description:
      "Read-only deterministic preflight for /blu-fast and /blu-quick scope, health, routing, config, and overwrite gates.",
    inputSchema: lightweightPreflightInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintLightweightPreflight(args as LightweightPreflightArgs),
  },
] as const satisfies readonly ToolDefinition[];
