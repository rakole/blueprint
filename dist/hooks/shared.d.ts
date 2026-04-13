export interface HookInput {
    cwd?: string;
    hook_event_name?: string;
    session_id?: string;
    timestamp?: string;
    transcript_path?: string;
    tool_input?: Record<string, unknown>;
    tool_name?: string;
    [key: string]: unknown;
}
export interface HookOutput {
    continue?: boolean;
    decision?: "allow" | "deny" | "block";
    hookSpecificOutput?: Record<string, unknown>;
    reason?: string;
    stopReason?: string;
    suppressOutput?: boolean;
    systemMessage?: string;
}
export declare function isWriteTool(toolName: unknown): toolName is string;
export declare function cwdOrProcess(input: HookInput): string;
export declare function resolveCandidatePath(cwd: string, candidate: unknown): string | null;
export declare function isBlueprintPath(cwd: string, targetPath: string): boolean;
export declare function isExistingPath(targetPath: string): boolean;
export declare function makeAdvisory(systemMessage: string): HookOutput;
export declare function noop(): HookOutput;
export declare function readHookInput(): Promise<HookInput>;
export declare function readTranscript(transcriptPath: string | undefined): Promise<unknown>;
export declare function readTranscriptForCwd(cwd: string, transcriptPath: string | undefined): Promise<unknown>;
export declare function getTargetPath(input: HookInput): string | null;
export declare function wasTargetRead(input: HookInput, targetPath: string): Promise<boolean>;
export declare function contentFromToolInput(input: HookInput): string | null;
export declare function hasPromptInjectionSignals(content: string): boolean;
export declare function isResearchArtifactPath(targetPath: string): boolean;
export declare function hasResearchArtifactMarkers(content: string): boolean;
export declare function advisoryReason(targetPath: string, message: string): HookOutput;
