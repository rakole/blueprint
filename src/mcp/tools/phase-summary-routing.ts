import {
  normalizePlanId,
  planPathFor
} from "./phase-plan-identifiers.js";

type PhaseSummaryPathLocation = {
  phaseDir: string;
  phasePrefix: string;
};

export type PhaseSummaryCompletedRoute = {
  readiness: "ready-for-validation" | "not-ready-for-validation";
  nextSafeAction: string;
};

export type PhaseSummaryCompletedRouteValidation =
  | { mode: "skip" }
  | { mode: "exact"; route: PhaseSummaryCompletedRoute }
  | { mode: "indexed" };

export function parseSummaryArtifactPath(
  pathValue: string,
  phasePrefix: string
): string | null {
  const match = pathValue.match(
    new RegExp(`${phasePrefix.replace(".", "\\.")}-(\\d+)-SUMMARY\\.md$`)
  );

  return match ? normalizePlanId(match[1]) : null;
}

export function summaryPathFor(
  located: PhaseSummaryPathLocation,
  planId: string
): string {
  return `${located.phaseDir}/${located.phasePrefix}-${normalizePlanId(planId)}-SUMMARY.md`;
}

function normalizeSummaryMarkerValue(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();

  if (
    (trimmed.startsWith("`") && trimmed.endsWith("`")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

export function phaseSummaryCompletedRoute(args: {
  phaseNumber: string;
  hasRemainingPendingPlans: boolean;
}): PhaseSummaryCompletedRoute {
  return args.hasRemainingPendingPlans
    ? {
        readiness: "not-ready-for-validation",
        nextSafeAction: `/blu-execute-phase ${args.phaseNumber}`
      }
    : {
        readiness: "ready-for-validation",
        nextSafeAction: `/blu-validate-phase ${args.phaseNumber}`
      };
}

function remainingPlanIdsAfterSelectedCompletion(args: {
  planIds: string[];
  completedPlanIds: ReadonlySet<string>;
  selectedPlanId: string;
}): string[] {
  const completedAfterSelection = new Set(args.completedPlanIds);
  completedAfterSelection.add(args.selectedPlanId);

  return args.planIds.filter((planId) => !completedAfterSelection.has(planId));
}

export function completedRouteAfterSelectedCompletion(args: {
  phaseNumber: string;
  planIds: string[];
  completedPlanIds: ReadonlySet<string>;
  selectedPlanId: string;
}): PhaseSummaryCompletedRoute {
  return phaseSummaryCompletedRoute({
    phaseNumber: args.phaseNumber,
    hasRemainingPendingPlans:
      remainingPlanIdsAfterSelectedCompletion(args).length > 0
  });
}

export function routesMatch(
  actual: { readiness: string | null; nextSafeAction: string | null },
  expected: PhaseSummaryCompletedRoute
): boolean {
  return (
    actual.readiness === expected.readiness &&
    actual.nextSafeAction === expected.nextSafeAction
  );
}

export function formatCompletedSummaryRoute(route: PhaseSummaryCompletedRoute): string {
  return `**Readiness:** ${route.readiness} and **Next Safe Action:** ${route.nextSafeAction}`;
}

export function extractPhaseSummaryMarkerValue(content: string, marker: string): string | null {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`^\\*\\*${escapedMarker}:\\*\\*\\s*(.+)$`, "m"));

  return normalizeSummaryMarkerValue(match?.[1] ?? null);
}

export function dependencyPlanRowsForPlan(
  dependsOn: string[],
  availablePlanIds: ReadonlySet<string>,
  resolved: PhaseSummaryPathLocation
): Array<{ planId: string; path: string }> {
  return dependsOn.flatMap((dependency) => {
    try {
      const normalizedDependency = normalizePlanId(dependency);

      return availablePlanIds.has(normalizedDependency)
        ? [
            {
              planId: normalizedDependency,
              path: planPathFor(resolved, normalizedDependency)
            }
          ]
        : [];
    } catch {
      return [];
    }
  });
}

export function normalizeDependencyPlanIds(dependsOn: string[]): string[] {
  return dependsOn.flatMap((dependency) => {
    try {
      return [normalizePlanId(dependency)];
    } catch {
      return [];
    }
  });
}
