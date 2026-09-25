/**
 * The text is intentionally small.  It is a pointer to the generated map,
 * rather than a copy of the map's navigation protocol.
 */
export declare const CODEBASE_INDEX_INSTRUCTION_SNIPPET = "When locating code, understanding repository responsibilities or constraints, or finding related tests, read `.blueprint/codebase/INDEX.md` if present and follow its guidance. Reuse it within the task; read an already-known target directly.";
/** The one prior owned body accepted for an in-place upgrade. */
export declare const CODEBASE_INDEX_INSTRUCTION_LEGACY_SNIPPET = "When locating code, understanding repository responsibilities, or finding related tests, read `.blueprint/codebase/INDEX.md` if present and follow its guidance.";
export declare const CODEBASE_INDEX_INSTRUCTION_START = "<!-- blueprint:portable-codebase-index:start -->";
export declare const CODEBASE_INDEX_INSTRUCTION_END = "<!-- blueprint:portable-codebase-index:end -->";
export declare const SUPPORTED_ROOT_INSTRUCTION_FILES: readonly ["AGENTS.md", "GEMINI.md", "CLAUDE.md", "TABNINE.md"];
export type SupportedRootInstructionFile = (typeof SUPPORTED_ROOT_INSTRUCTION_FILES)[number];
export type InstructionLinkPrepareRequest = {
    repositoryRoot: string;
    /** A repository-relative path. Omit to inspect supported root candidates. */
    instructionPath?: string;
};
type InstructionLinkFailureCode = "invalid-root" | "unsafe-path" | "missing-target" | "unsafe-target" | "invalid-target" | "malformed-block" | "read-failed" | "write-failed" | "hash-conflict";
export type InstructionLinkFailure = {
    status: "failure";
    code: InstructionLinkFailureCode;
    message: string;
    action: string;
    instructionPath?: string;
};
export type InstructionLinkPrepareResult = {
    status: "ready";
    instructionPath: string;
    expectedHash: string;
    currentHash: string;
    currentStatus: "missing-block" | "already-linked";
    proposedBlock: string;
    proposedHash: string;
} | {
    status: "choices";
    choices: readonly string[];
    snippet: string;
    message: string;
    action: string;
} | {
    status: "snippet";
    snippet: string;
    message: string;
    action: string;
} | InstructionLinkFailure;
export type InstructionLinkApplyRequest = {
    repositoryRoot: string;
    instructionPath: string;
    /** The exact hash returned by a prior prepare call. */
    expectedHash: string;
};
/** @internal Deterministic race seam used only by focused filesystem tests. */
export declare const instructionLinkTestHooks: {
    beforeTempCreate?: (repositoryRoot: string, instructionPath: string) => Promise<void> | void;
    beforeFinalRecheck?: (repositoryRoot: string, instructionPath: string) => Promise<void> | void;
};
export type InstructionLinkApplyResult = {
    status: "applied" | "already-linked";
    instructionPath: string;
    beforeHash: string;
    afterHash: string;
    changed: boolean;
} | InstructionLinkFailure;
/** Inspect a target and return a bounded, hash-guarded write proposal. */
export declare function prepareInstructionLink(request: InstructionLinkPrepareRequest): Promise<InstructionLinkPrepareResult>;
/** Apply only the exact repository-relative target and hash captured by prepare. */
export declare function applyInstructionLink(request: InstructionLinkApplyRequest): Promise<InstructionLinkApplyResult>;
export {};
