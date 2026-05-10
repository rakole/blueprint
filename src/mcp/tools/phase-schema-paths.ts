import { type ErrorObject } from "ajv/dist/2020.js";

export function ajvInstancePathToModelPath(instancePath: string): string {
  if (instancePath.length === 0) {
    return "model";
  }

  return `model${instancePath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const decoded = segment.replace(/~1/g, "/").replace(/~0/g, "~");
      return /^\d+$/.test(decoded) ? `[${decoded}]` : `.${decoded}`;
    })
    .join("")}`;
}

export function modelPathToJsonPointer(pathValue: string): string | null {
  if (pathValue === "model") {
    return "";
  }

  if (!pathValue.startsWith("model.")) {
    return null;
  }

  const pathWithoutRoot = pathValue.slice("model.".length);
  const segments = pathWithoutRoot
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.replace(/~/g, "~0").replace(/\//g, "~1"));

  return `/${segments.join("/")}`;
}

export function appendJsonPointerSegment(pointer: string, segment: string): string {
  const encoded = segment.replace(/~/g, "~0").replace(/\//g, "~1");

  return pointer.length === 0 ? `/${encoded}` : `${pointer}/${encoded}`;
}

export function getValueAtJsonPointer(value: unknown, pointer: string | null): unknown {
  if (pointer === null) {
    return undefined;
  }

  if (pointer === "") {
    return value;
  }

  let current: unknown = value;
  const segments = pointer
    .split("/")
    .slice(1)
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      current = Number.isInteger(index) ? current[index] : undefined;
      continue;
    }

    if (typeof current === "object" && current !== null) {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }

    return undefined;
  }

  return current;
}

export function ajvAllowedValues(error: ErrorObject): unknown[] | undefined {
  if (
    typeof error.params === "object" &&
    error.params !== null &&
    "allowedValues" in error.params &&
    Array.isArray(error.params.allowedValues)
  ) {
    return error.params.allowedValues;
  }

  if (
    typeof error.params === "object" &&
    error.params !== null &&
    "allowedValue" in error.params
  ) {
    return [error.params.allowedValue];
  }

  return undefined;
}
