import path from "node:path";

export type ExecutionSurfaceKind =
  | "files_modified"
  | "read_first"
  | "generated_artifact"
  | "other";

export type PhaseExecutionTargetConflictSurface = {
  value: string;
  kinds: ExecutionSurfaceKind[];
};

type PhaseExecutionSurfacePlan = {
  filesModified: string[];
  readFirst: string[];
};

type PhaseExecutionSurface = {
  kind: ExecutionSurfaceKind;
  value: string;
};

export function normalizeExecutionSurfacePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").trim();
  const withoutDotPrefix = normalized.replace(/^\.\//, "");
  const collapsed = path.posix.normalize(withoutDotPrefix);

  if (collapsed === ".") {
    return withoutDotPrefix.replace(/\/+$/u, "");
  }

  return collapsed.replace(/\/+$/u, "");
}

function classifyExecutionSurfaceKind(
  source: "files_modified" | "read_first",
  value: string
): ExecutionSurfaceKind {
  const normalized = normalizeExecutionSurfacePath(value);

  if (source === "files_modified" && (/^\.blueprint\//u.test(normalized) || /^dist\//u.test(normalized))) {
    return "generated_artifact";
  }

  return source;
}

function executionSurfacePathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function executionSurfaceSharedValue(left: string, right: string): string {
  if (left === right) {
    return left;
  }

  return left.startsWith(`${right}/`) ? right : left;
}

export function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function planExecutionSurfaces(plan: PhaseExecutionSurfacePlan): PhaseExecutionSurface[] {
  const surfaces = [
    ...plan.filesModified.map((value) => ({
      kind: classifyExecutionSurfaceKind("files_modified", value),
      value: normalizeExecutionSurfacePath(value)
    })),
    ...plan.readFirst.map((value) => ({
      kind: classifyExecutionSurfaceKind("read_first", value),
      value: normalizeExecutionSurfacePath(value)
    }))
  ];
  const seen = new Set<string>();

  return surfaces.filter((surface) => {
    if (surface.value.length === 0) {
      return false;
    }

    const key = `${surface.kind}:${surface.value}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function sharedExecutionSurfaces(
  left: PhaseExecutionSurfacePlan,
  right: PhaseExecutionSurfacePlan
): PhaseExecutionTargetConflictSurface[] {
  const shared = new Map<string, PhaseExecutionTargetConflictSurface>();
  const leftSurfaces = planExecutionSurfaces(left);
  const rightSurfaces = planExecutionSurfaces(right);

  for (const leftSurface of leftSurfaces) {
    for (const rightSurface of rightSurfaces) {
      if (!executionSurfacePathsOverlap(leftSurface.value, rightSurface.value)) {
        continue;
      }

      const value = executionSurfaceSharedValue(leftSurface.value, rightSurface.value);
      const kinds = uniqueSortedStrings([leftSurface.kind, rightSurface.kind]) as ExecutionSurfaceKind[];
      const key = `${value}:${kinds.join(",")}`;

      if (!shared.has(key)) {
        shared.set(key, { value, kinds });
      }
    }
  }

  return [...shared.values()].sort((leftSurface, rightSurface) =>
    leftSurface.value.localeCompare(rightSurface.value)
  );
}
