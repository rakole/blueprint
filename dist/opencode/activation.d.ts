import type { Hooks } from "@opencode-ai/plugin";
export type BlueprintActivationOptions = {
    privateHelperQualified?: boolean;
};
export declare function createBlueprintActivationHooks(skillAliases: ReadonlySet<string>, options?: BlueprintActivationOptions): Hooks;
