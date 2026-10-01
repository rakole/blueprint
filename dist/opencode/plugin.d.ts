import type { Plugin } from "@opencode-ai/plugin";
import { type NativePermission } from "./assets.js";
export declare function mergePermissionWithCallerRestrictions(permission: NativePermission | undefined, userPermission: unknown): NativePermission;
export declare function allowBlueprintPackageReads(permission: NativePermission, directories: readonly string[]): NativePermission;
export declare function resolveBlueprintPluginGlobalHome(packageRoot: string, env?: NodeJS.ProcessEnv): string;
export declare const BlueprintPlugin: Plugin;
export default BlueprintPlugin;
