import { type ErrorObject } from "ajv/dist/2020.js";
export declare function ajvInstancePathToModelPath(instancePath: string): string;
export declare function modelPathToJsonPointer(pathValue: string): string | null;
export declare function appendJsonPointerSegment(pointer: string, segment: string): string;
export declare function getValueAtJsonPointer(value: unknown, pointer: string | null): unknown;
export declare function ajvAllowedValues(error: ErrorObject): unknown[] | undefined;
