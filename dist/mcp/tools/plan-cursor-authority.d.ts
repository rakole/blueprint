/** Legacy repository-visible location, retained only for safe one-time cleanup. */
export declare const PLAN_CURSOR_AUTHORITY_ROOT = ".blueprint/plan-operations";
export declare const PLAN_CURSOR_AUTHORITY_KEY_FILE = "cursor.key";
export declare const PLAN_CURSOR_GIT_AUTHORITY_ROOT = "blueprint";
export declare const PLAN_CURSOR_GIT_AUTHORITY_KEY_FILE = "plan-cursor.key";
export declare function loadPlanCursorAuthorityKey(root: string, provision: boolean): Promise<Uint8Array | null>;
export declare function sealPlanCursor(key: Uint8Array, kind: "evidence" | "plan", payload: unknown): string;
export declare function verifyPlanCursorSeal(key: Uint8Array, kind: "evidence" | "plan", payload: unknown, seal: string): boolean;
