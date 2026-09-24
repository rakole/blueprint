/** Operational state is deliberately outside the portable transfer bundle. */
export declare const PORTABLE_PIN_AUTHORITY_ROOT = ".blueprint/codebase-operations/pin-authority";
export declare const PORTABLE_PIN_AUTHORITY_KEY_FILE = "owner.key";
export declare const PORTABLE_PIN_AUTHORITY_RECEIPTS_ROOT = "receipts";
export declare const PORTABLE_PIN_RECEIPT_VERSION: 1;
export type PortablePinAuthorityRootIdentity = {
    readonly path: string;
    readonly realPath: string;
    readonly device: number;
    readonly inode: number;
    readonly ancestors: readonly {
        readonly path: string;
        readonly device: number;
        readonly inode: number;
    }[];
};
export type PortablePinAuthorityPin = {
    readonly generationId: string;
    readonly entry: {
        readonly path: string;
        readonly sha256: string;
    };
    readonly manifest: {
        readonly path: string;
        readonly sha256: string;
    };
};
export type PortablePinReceipt = {
    readonly version: typeof PORTABLE_PIN_RECEIPT_VERSION;
    readonly root: PortablePinAuthorityRootIdentity;
    readonly pin: PortablePinAuthorityPin;
    readonly issuedAt: string;
    readonly authentication: string;
};
export type PortablePinAuthorityDirectoryIdentity = {
    readonly path: string;
    readonly device: number;
    readonly inode: number;
};
/** Capture the canonical repository identity before a publication proof. */
export declare function capturePortablePinAuthorityRoot(root: string): Promise<PortablePinAuthorityRootIdentity | null>;
/** Create and persist an owner-authenticated receipt after the resolver has proved the pin. */
export declare function persistPortablePinReceipt(root: string, pin: PortablePinAuthorityPin, expectedIdentity?: PortablePinAuthorityRootIdentity): Promise<PortablePinReceipt | null>;
/** Restore only an authentic receipt persisted by this repository's owner key. */
export declare function restorePortablePinReceipt(root: string, value: unknown): Promise<PortablePinReceipt | null>;
