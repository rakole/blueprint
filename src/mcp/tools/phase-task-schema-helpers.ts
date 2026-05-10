import { getJsonObjectProperty } from "./phase-json-helpers.js";

export function setArrayItemEnum(schema: Record<string, unknown> | null, values: string[]): void {
  if (!schema || values.length === 0) {
    return;
  }

  const items = getJsonObjectProperty(schema, "items");
  if (items) {
    items.enum = values;
  }
}

export function setArrayMaxItems(schema: Record<string, unknown> | null, maxItems: number): void {
  if (!schema) {
    return;
  }

  schema.maxItems = maxItems;
}

export function allowOnlyEmptyArray(schema: Record<string, unknown> | null): void {
  if (!schema) {
    return;
  }

  schema.minItems = 0;
  schema.maxItems = 0;
}

export function exactObjectPropertyContains(
  propertyName: string,
  value: string
): Record<string, unknown> {
  return {
    contains: {
      type: "object",
      required: [propertyName],
      properties: {
        [propertyName]: { const: value }
      }
    },
    minContains: 1,
    maxContains: 1
  };
}

export function objectPropertyContainsAtLeast(
  propertyName: string,
  value: string
): Record<string, unknown> {
  return {
    contains: {
      type: "object",
      required: [propertyName],
      properties: {
        [propertyName]: { const: value }
      }
    },
    minContains: 1
  };
}

export function exactStringArrayContains(value: string): Record<string, unknown> {
  return {
    contains: { const: value },
    minContains: 1,
    maxContains: 1
  };
}
