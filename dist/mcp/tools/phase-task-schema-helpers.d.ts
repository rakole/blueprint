export declare function setArrayItemEnum(schema: Record<string, unknown> | null, values: string[]): void;
export declare function setArrayMaxItems(schema: Record<string, unknown> | null, maxItems: number): void;
export declare function allowOnlyEmptyArray(schema: Record<string, unknown> | null): void;
export declare function exactObjectPropertyContains(propertyName: string, value: string): Record<string, unknown>;
export declare function objectPropertyContainsAtLeast(propertyName: string, value: string): Record<string, unknown>;
export declare function exactStringArrayContains(value: string): Record<string, unknown>;
