import * as z from "zod/v4";
import { type CodebaseDocumentId } from "../codebase-authoring.js";
import { type PortableGenerationManifest, type PortableSealedGenerationReference } from "./contracts.js";
import type { PortableValidatedMapData } from "./model-validation.js";
/** Source-owned navigation text. Model supplied records are rendered around this template. */
export declare const PORTABLE_MAP_NAVIGATION_PROTOCOL: readonly ["Reuse the active index. Load it when repository understanding is needed and it has not already been supplied, or after context loss.", "If the task already identifies the relevant live file or function, read it directly; consult the map for related constraints and tests when useful.", "For a conceptual task, select the smallest matching capability route. For a path, symbol, error term, or alias, search the text index directly.", "Read only the selected capability, record, detail, and search pages. Never load all search shards or the entire map by default.", "Follow coordinates into current source and relevant tests before relying on an implementation claim. Re-find the symbol if lines moved.", "Expand dependencies according to the task; do not traverse every relationship.", "Treat map content as generated evidence. Repository instructions and current code retain their existing authority.", "After two unproductive map-navigation actions, use ordinary bounded source search.", "A map cannot prove that a feature, file, affected dependency, or new behavior is absent. Verify absence, impact, and new behavior with live search.", "The generated baseline is current-tree-unverified until selected source is inspected. Consumers do not modify the map; missing, unsupported, unreadable, or malformed maps fall back to normal discovery."];
declare const metadataSchema: z.ZodObject<{
    generationId: z.ZodString;
    generatedAt: z.ZodString;
    gitCommit: z.ZodNullable<z.ZodString>;
    inventoryFingerprint: z.ZodString;
    parserAssets: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        version: z.ZodString;
        checksum: z.ZodString;
    }, z.core.$strict>>;
    predecessorGenerationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    predecessorPublicationProof: z.ZodOptional<z.ZodObject<{
        generationId: z.ZodString;
        manifest: z.ZodObject<{
            path: z.ZodString;
            checksum: z.ZodString;
        }, z.core.$strict>;
        entry: z.ZodObject<{
            path: z.ZodString;
            checksum: z.ZodString;
        }, z.core.$strict>;
        committedIndexHash: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
declare const rootDescriptorSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    generationId: z.ZodString;
    manifest: z.ZodObject<{
        path: z.ZodString;
        sha256: z.ZodString;
    }, z.core.$strict>;
    entry: z.ZodObject<{
        path: z.ZodString;
        sha256: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>;
export type PortableRootDescriptor = z.infer<typeof rootDescriptorSchema>;
/** Serialize the compact source-owned descriptor embedded in INDEX. */
export declare function serializePortableRootDescriptor(input: PortableRootDescriptor): string;
/** Parse only the fixed descriptor marker; prose is never interpreted. */
export declare function parsePortableRootDescriptor(input: string): PortableRootDescriptor | null;
export type PortableRenderMetadata = z.input<typeof metadataSchema>;
export type PortableRenderDiagnostic = {
    readonly code: "invalid-metadata" | "page-too-large" | "invalid-path" | "invalid-manifest" | "duplicate-path" | "unsafe-content";
    readonly scope: "metadata" | "page" | "manifest" | "bundle";
    readonly message: string;
    readonly field?: string;
    readonly index?: number;
};
export type PortableRenderedFile = {
    readonly path: string;
    readonly bytes: Uint8Array;
    readonly checksum: string;
};
export type PortableRenderSuccess = {
    readonly ok: true;
    /** All bytes are keyed by codebase-root-relative paths. */
    readonly files: Readonly<Record<string, Uint8Array>>;
    /** Alias retained for publisher code that calls the map a byte bundle. */
    readonly bytes: Readonly<Record<string, Uint8Array>>;
    readonly checksums: Readonly<Record<string, string>>;
    readonly renderedFiles: readonly PortableRenderedFile[];
    readonly rootIndexBytes: Uint8Array;
    readonly entryBytes: Uint8Array;
    readonly manifest: PortableGenerationManifest;
    readonly sealedGeneration: PortableSealedGenerationReference;
    readonly rootIndexHash: string;
    /** Seven root compatibility bytes are supplied separately to the publisher. */
    readonly rootViewBytes: Readonly<Record<`${Uppercase<CodebaseDocumentId>}.md`, Uint8Array>>;
};
export type PortableRenderResult = PortableRenderSuccess | {
    readonly ok: false;
    readonly diagnostics: readonly PortableRenderDiagnostic[];
};
/** Versioned structured semantic shards consumed by a future resolver. */
export declare const PORTABLE_SEMANTIC_DATA_VERSION: 1;
export declare const portableSemanticRecordKindSchema: z.ZodEnum<{
    alias: "alias";
    capability: "capability";
    claim: "claim";
}>;
export type PortableSemanticRecordKind = z.infer<typeof portableSemanticRecordKindSchema>;
export declare const portableSemanticContinuationSchema: z.ZodObject<{
    previous: z.ZodNullable<z.ZodString>;
    next: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
export type PortableSemanticContinuation = z.infer<typeof portableSemanticContinuationSchema>;
export declare const portableSemanticFragmentSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        alias: "alias";
        capability: "capability";
        claim: "claim";
    }>;
    recordId: z.ZodString;
    evidenceStart: z.ZodNumber;
    evidenceCount: z.ZodNumber;
    partIndex: z.ZodNumber;
    partCount: z.ZodNumber;
    record: z.ZodUnion<readonly [z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        summary: z.ZodString;
        claimIds: z.ZodArray<z.ZodString>;
        evidence: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                symbol: "symbol";
                file: "file";
                relationship: "relationship";
                "compatibility-document": "compatibility-document";
            }>;
            path: z.ZodString;
            recordId: z.ZodString;
            contentHash: z.ZodString;
            coordinate: z.ZodOptional<z.ZodObject<{
                start: z.ZodObject<{
                    line: z.ZodNumber;
                    column: z.ZodNumber;
                    byte: z.ZodNumber;
                }, z.core.$strict>;
                end: z.ZodObject<{
                    line: z.ZodNumber;
                    column: z.ZodNumber;
                    byte: z.ZodNumber;
                }, z.core.$strict>;
            }, z.core.$strict>>;
        }, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        basis: z.ZodEnum<{
            unknown: "unknown";
            observed: "observed";
            "supported-inference": "supported-inference";
        }>;
        statement: z.ZodString;
        evidence: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                symbol: "symbol";
                file: "file";
                relationship: "relationship";
                "compatibility-document": "compatibility-document";
            }>;
            path: z.ZodString;
            recordId: z.ZodString;
            contentHash: z.ZodString;
            coordinate: z.ZodOptional<z.ZodObject<{
                start: z.ZodObject<{
                    line: z.ZodNumber;
                    column: z.ZodNumber;
                    byte: z.ZodNumber;
                }, z.core.$strict>;
                end: z.ZodObject<{
                    line: z.ZodNumber;
                    column: z.ZodNumber;
                    byte: z.ZodNumber;
                }, z.core.$strict>;
            }, z.core.$strict>>;
        }, z.core.$strict>>;
    }, z.core.$strict>, z.ZodObject<{
        id: z.ZodString;
        alias: z.ZodString;
        targetKind: z.ZodEnum<{
            symbol: "symbol";
            capability: "capability";
        }>;
        targetId: z.ZodString;
        evidence: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                symbol: "symbol";
                file: "file";
                relationship: "relationship";
                "compatibility-document": "compatibility-document";
            }>;
            path: z.ZodString;
            recordId: z.ZodString;
            contentHash: z.ZodString;
            coordinate: z.ZodOptional<z.ZodObject<{
                start: z.ZodObject<{
                    line: z.ZodNumber;
                    column: z.ZodNumber;
                    byte: z.ZodNumber;
                }, z.core.$strict>;
                end: z.ZodObject<{
                    line: z.ZodNumber;
                    column: z.ZodNumber;
                    byte: z.ZodNumber;
                }, z.core.$strict>;
            }, z.core.$strict>>;
        }, z.core.$strict>>;
    }, z.core.$strict>]>;
    continuation: z.ZodObject<{
        previous: z.ZodNullable<z.ZodString>;
        next: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>;
}, z.core.$strict>;
export type PortableSemanticFragment = z.infer<typeof portableSemanticFragmentSchema>;
export declare const portableSemanticShardSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    generationId: z.ZodString;
    shardId: z.ZodString;
    records: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<{
            alias: "alias";
            capability: "capability";
            claim: "claim";
        }>;
        recordId: z.ZodString;
        evidenceStart: z.ZodNumber;
        evidenceCount: z.ZodNumber;
        partIndex: z.ZodNumber;
        partCount: z.ZodNumber;
        record: z.ZodUnion<readonly [z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            summary: z.ZodString;
            claimIds: z.ZodArray<z.ZodString>;
            evidence: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<{
                    symbol: "symbol";
                    file: "file";
                    relationship: "relationship";
                    "compatibility-document": "compatibility-document";
                }>;
                path: z.ZodString;
                recordId: z.ZodString;
                contentHash: z.ZodString;
                coordinate: z.ZodOptional<z.ZodObject<{
                    start: z.ZodObject<{
                        line: z.ZodNumber;
                        column: z.ZodNumber;
                        byte: z.ZodNumber;
                    }, z.core.$strict>;
                    end: z.ZodObject<{
                        line: z.ZodNumber;
                        column: z.ZodNumber;
                        byte: z.ZodNumber;
                    }, z.core.$strict>;
                }, z.core.$strict>>;
            }, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            id: z.ZodString;
            basis: z.ZodEnum<{
                unknown: "unknown";
                observed: "observed";
                "supported-inference": "supported-inference";
            }>;
            statement: z.ZodString;
            evidence: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<{
                    symbol: "symbol";
                    file: "file";
                    relationship: "relationship";
                    "compatibility-document": "compatibility-document";
                }>;
                path: z.ZodString;
                recordId: z.ZodString;
                contentHash: z.ZodString;
                coordinate: z.ZodOptional<z.ZodObject<{
                    start: z.ZodObject<{
                        line: z.ZodNumber;
                        column: z.ZodNumber;
                        byte: z.ZodNumber;
                    }, z.core.$strict>;
                    end: z.ZodObject<{
                        line: z.ZodNumber;
                        column: z.ZodNumber;
                        byte: z.ZodNumber;
                    }, z.core.$strict>;
                }, z.core.$strict>>;
            }, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            id: z.ZodString;
            alias: z.ZodString;
            targetKind: z.ZodEnum<{
                symbol: "symbol";
                capability: "capability";
            }>;
            targetId: z.ZodString;
            evidence: z.ZodArray<z.ZodObject<{
                kind: z.ZodEnum<{
                    symbol: "symbol";
                    file: "file";
                    relationship: "relationship";
                    "compatibility-document": "compatibility-document";
                }>;
                path: z.ZodString;
                recordId: z.ZodString;
                contentHash: z.ZodString;
                coordinate: z.ZodOptional<z.ZodObject<{
                    start: z.ZodObject<{
                        line: z.ZodNumber;
                        column: z.ZodNumber;
                        byte: z.ZodNumber;
                    }, z.core.$strict>;
                    end: z.ZodObject<{
                        line: z.ZodNumber;
                        column: z.ZodNumber;
                        byte: z.ZodNumber;
                    }, z.core.$strict>;
                }, z.core.$strict>>;
            }, z.core.$strict>>;
        }, z.core.$strict>]>;
        continuation: z.ZodObject<{
            previous: z.ZodNullable<z.ZodString>;
            next: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type PortableSemanticShard = z.infer<typeof portableSemanticShardSchema>;
export declare const portableSemanticIndexEntrySchema: z.ZodObject<{
    kind: z.ZodEnum<{
        alias: "alias";
        capability: "capability";
        claim: "claim";
    }>;
    recordId: z.ZodString;
    firstPath: z.ZodNullable<z.ZodString>;
    partCount: z.ZodNumber;
    evidenceCount: z.ZodNumber;
    contentHash: z.ZodString;
}, z.core.$strict>;
export type PortableSemanticIndexEntry = z.infer<typeof portableSemanticIndexEntrySchema>;
export declare const portableSemanticIndexSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    generationId: z.ZodString;
    shardId: z.ZodString;
    entries: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<{
            alias: "alias";
            capability: "capability";
            claim: "claim";
        }>;
        recordId: z.ZodString;
        firstPath: z.ZodNullable<z.ZodString>;
        partCount: z.ZodNumber;
        evidenceCount: z.ZodNumber;
        contentHash: z.ZodString;
    }, z.core.$strict>>;
    continuation: z.ZodObject<{
        previous: z.ZodNullable<z.ZodString>;
        next: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>;
}, z.core.$strict>;
export type PortableSemanticIndex = z.infer<typeof portableSemanticIndexSchema>;
/** Parse one bounded semantic shard without interpreting Markdown prose. */
export declare function parsePortableSemanticShard(input: string): PortableSemanticShard | null;
/** Parse one bounded semantic index page without interpreting Markdown prose. */
export declare function parsePortableSemanticIndex(input: string): PortableSemanticIndex | null;
/**
 * Render a validated model to an immutable portable bundle. This function is
 * deliberately in-memory: it does not read or write files, call tools, or
 * decide whether a publisher may commit the returned bytes.
 */
export declare function renderPortableMap(validated: PortableValidatedMapData, metadataInput: PortableRenderMetadata): PortableRenderResult;
export declare const renderPortableBundle: typeof renderPortableMap;
export declare const renderPortableCodebaseMap: typeof renderPortableMap;
export {};
