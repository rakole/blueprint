import { Ajv2020 } from "ajv/dist/2020.js";
export declare function collectModelStringValues(value: unknown): string[];
export declare function cloneJsonObject<T extends Record<string, unknown>>(value: T): T;
export declare function asJsonObject(value: unknown): Record<string, unknown> | null;
export declare function getJsonObjectProperty(value: Record<string, unknown>, key: string): Record<string, unknown> | null;
export declare function createAjvValidator(): Ajv2020;
