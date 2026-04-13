import type { HookInput, HookOutput } from "./shared.js";
type HookHandler = (input: HookInput) => HookOutput | Promise<HookOutput>;
export declare function runHook(handler: HookHandler): Promise<void>;
export declare function writeHookOutput(pathname: string, output: HookOutput): Promise<void>;
export {};
