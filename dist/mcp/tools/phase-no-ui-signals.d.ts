type NoUiSignalArgs = {
    contextContent?: string | null;
};
type NoUiSignalDetection = {
    bypassAllowed: boolean;
    strongNoUiSignals: string[];
    positiveUiSignals: string[];
};
export declare function detectStrongExplicitNoUiSignal(args: NoUiSignalArgs): NoUiSignalDetection;
export {};
