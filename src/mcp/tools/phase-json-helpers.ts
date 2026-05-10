import { Ajv2020 } from "ajv/dist/2020.js";

export function collectModelStringValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectModelStringValues(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap((item) => collectModelStringValues(item));
  }

  return [];
}

export function cloneJsonObject<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function asJsonObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function getJsonObjectProperty(
  value: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  return asJsonObject(value[key]);
}

export function createAjvValidator(): Ajv2020 {
  return new Ajv2020({
    allErrors: true,
    strict: false,
    validateSchema: true
  });
}
