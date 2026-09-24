import * as z from "zod/v4";
import { type PortableAcceptedSemanticModel, type PortableStructuralInventory } from "./contracts.js";
import { type PortableAuthoritativeSourceBasis } from "./model-validation.js";
import { type ExtractionCoverageSummary, type ExtractionParserProvenance, type PortableExtractionFailure, type PortableExtractionOptions, type PortableExtractionSuccess, type ExtractionRootIdentity } from "./extraction.js";
declare const CACHE_VERSION: 1;
export declare const portableIncrementalProvenanceSchema: z.ZodObject<{
    runtime: z.ZodObject<{
        package: z.ZodString;
        version: z.ZodString;
        packageSha256: z.ZodString;
        module: z.ZodString;
        moduleSha256: z.ZodString;
        wasm: z.ZodString;
        wasmSha256: z.ZodString;
        languageVersion: z.ZodNumber;
        minimumCompatibleVersion: z.ZodNumber;
    }, z.core.$strict>;
    grammars: z.ZodArray<z.ZodObject<{
        package: z.ZodString;
        version: z.ZodString;
        packageSha256: z.ZodString;
        asset: z.ZodString;
        sha256: z.ZodString;
        abiVersion: z.ZodNumber;
    }, z.core.$strict>>;
    adapters: z.ZodArray<z.ZodObject<{
        name: z.ZodEnum<{
            javascript: "javascript";
            python: "python";
            java: "java";
        }>;
        ruleVersion: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
/**
 * Checksummed operational cache.  It intentionally stores accepted structure
 * and provenance metadata only; source bytes, model prompts, and rejected
 * payloads never enter this projection.
 */
export type PortableIncrementalCache = {
    readonly version: typeof CACHE_VERSION;
    readonly trust: "operational";
    readonly generationId: string;
    readonly root: ExtractionRootIdentity;
    readonly inventoryFingerprint: string;
    readonly provenance: ExtractionParserProvenance;
    readonly provenanceHash: string;
    readonly structuralShards: readonly PortableStructuralInventory[];
    readonly sourceBasis: PortableAuthoritativeSourceBasis;
    readonly coverage: ExtractionCoverageSummary;
    readonly semantic?: PortableAcceptedSemanticModel;
    readonly cacheHash: string;
};
export declare const portableIncrementalCacheSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    trust: z.ZodLiteral<"operational">;
    generationId: z.ZodString;
    root: z.ZodObject<{
        path: z.ZodString;
        realPath: z.ZodString;
        device: z.ZodNumber;
        inode: z.ZodNumber;
    }, z.core.$strict>;
    inventoryFingerprint: z.ZodString;
    provenance: z.ZodObject<{
        runtime: z.ZodObject<{
            package: z.ZodString;
            version: z.ZodString;
            packageSha256: z.ZodString;
            module: z.ZodString;
            moduleSha256: z.ZodString;
            wasm: z.ZodString;
            wasmSha256: z.ZodString;
            languageVersion: z.ZodNumber;
            minimumCompatibleVersion: z.ZodNumber;
        }, z.core.$strict>;
        grammars: z.ZodArray<z.ZodObject<{
            package: z.ZodString;
            version: z.ZodString;
            packageSha256: z.ZodString;
            asset: z.ZodString;
            sha256: z.ZodString;
            abiVersion: z.ZodNumber;
        }, z.core.$strict>>;
        adapters: z.ZodArray<z.ZodObject<{
            name: z.ZodEnum<{
                javascript: "javascript";
                python: "python";
                java: "java";
            }>;
            ruleVersion: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    provenanceHash: z.ZodString;
    structuralShards: z.ZodArray<z.ZodObject<{
        generationId: z.ZodString;
        shardId: z.ZodString;
        files: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            path: z.ZodString;
            language: z.ZodEnum<{
                unknown: "unknown";
                javascript: "javascript";
                jsx: "jsx";
                typescript: "typescript";
                tsx: "tsx";
                python: "python";
                java: "java";
            }>;
            role: z.ZodEnum<{
                unknown: "unknown";
                test: "test";
                source: "source";
                configuration: "configuration";
                documentation: "documentation";
                generated: "generated";
            }>;
            byteSize: z.ZodNumber;
            contentHash: z.ZodString;
            parseStatus: z.ZodEnum<{
                failed: "failed";
                skipped: "skipped";
                partial: "partial";
                parsed: "parsed";
                unsupported: "unsupported";
            }>;
            coverageStatus: z.ZodEnum<{
                file: "file";
                none: "none";
                full: "full";
            }>;
            limitationReason: z.ZodOptional<z.ZodEnum<{
                binary: "binary";
                none: "none";
                "unsupported-language": "unsupported-language";
                "too-large": "too-large";
                "parse-error": "parse-error";
                excluded: "excluded";
                unreadable: "unreadable";
                "not-extracted": "not-extracted";
                "unsafe-content": "unsafe-content";
                "unsupported-construct": "unsupported-construct";
            }>>;
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
        symbols: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            fileId: z.ZodString;
            path: z.ZodString;
            qualifiedName: z.ZodOptional<z.ZodString>;
            kind: z.ZodEnum<{
                function: "function";
                unknown: "unknown";
                enum: "enum";
                type: "type";
                module: "module";
                class: "class";
                interface: "interface";
                method: "method";
                constructor: "constructor";
                variable: "variable";
                constant: "constant";
                property: "property";
                field: "field";
            }>;
            signature: z.ZodOptional<z.ZodString>;
            coordinate: z.ZodObject<{
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
            }, z.core.$strict>;
            contentHash: z.ZodString;
            lexicalParentId: z.ZodNullable<z.ZodString>;
            exported: z.ZodBoolean;
            detailReferences: z.ZodOptional<z.ZodArray<z.ZodObject<{
                field: z.ZodEnum<{
                    qualifiedName: "qualifiedName";
                    signature: "signature";
                }>;
                firstSegmentId: z.ZodString;
                segmentCount: z.ZodNumber;
                byteSize: z.ZodNumber;
                contentHash: z.ZodString;
            }, z.core.$strict>>>;
        }, z.core.$strict>>;
        imports: z.ZodArray<z.ZodObject<{
            origin: z.ZodLiteral<"syntax">;
            certainty: z.ZodEnum<{
                unknown: "unknown";
                observed: "observed";
                "supported-inference": "supported-inference";
            }>;
            resolutionStatus: z.ZodEnum<{
                unsupported: "unsupported";
                resolved: "resolved";
                unresolved: "unresolved";
                ambiguous: "ambiguous";
            }>;
            targetFileId: z.ZodNullable<z.ZodString>;
            targetSymbolId: z.ZodNullable<z.ZodString>;
            unresolvedReason: z.ZodOptional<z.ZodEnum<{
                unknown: "unknown";
                "parse-error": "parse-error";
                "dynamic-import": "dynamic-import";
                reflection: "reflection";
                "dependency-injection": "dependency-injection";
                "dynamic-dispatch": "dynamic-dispatch";
                "ambiguous-module": "ambiguous-module";
                "unsupported-resolution": "unsupported-resolution";
                "missing-target": "missing-target";
                "external-dependency": "external-dependency";
            }>>;
            id: z.ZodString;
            kind: z.ZodEnum<{
                import: "import";
                export: "export";
                reexport: "reexport";
            }>;
            sourceFileId: z.ZodString;
            sourcePath: z.ZodString;
            specifier: z.ZodString;
            coordinate: z.ZodObject<{
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
            }, z.core.$strict>;
            contentHash: z.ZodString;
        }, z.core.$strict>>;
        relationships: z.ZodArray<z.ZodObject<{
            origin: z.ZodEnum<{
                syntax: "syntax";
                inferred: "inferred";
                authored: "authored";
            }>;
            certainty: z.ZodEnum<{
                unknown: "unknown";
                observed: "observed";
                "supported-inference": "supported-inference";
            }>;
            resolutionStatus: z.ZodEnum<{
                unsupported: "unsupported";
                resolved: "resolved";
                unresolved: "unresolved";
                ambiguous: "ambiguous";
            }>;
            targetFileId: z.ZodNullable<z.ZodString>;
            targetSymbolId: z.ZodNullable<z.ZodString>;
            unresolvedReason: z.ZodOptional<z.ZodEnum<{
                unknown: "unknown";
                "parse-error": "parse-error";
                "dynamic-import": "dynamic-import";
                reflection: "reflection";
                "dependency-injection": "dependency-injection";
                "dynamic-dispatch": "dynamic-dispatch";
                "ambiguous-module": "ambiguous-module";
                "unsupported-resolution": "unsupported-resolution";
                "missing-target": "missing-target";
                "external-dependency": "external-dependency";
            }>>;
            id: z.ZodString;
            kind: z.ZodEnum<{
                contains: "contains";
                references: "references";
                implements: "implements";
                extends: "extends";
                uses: "uses";
            }>;
            sourceFileId: z.ZodString;
            sourceSymbolId: z.ZodNullable<z.ZodString>;
            sourcePath: z.ZodString;
            coordinate: z.ZodObject<{
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
            }, z.core.$strict>;
            contentHash: z.ZodString;
        }, z.core.$strict>>;
        details: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            sourceRecordId: z.ZodString;
            field: z.ZodEnum<{
                qualifiedName: "qualifiedName";
                signature: "signature";
            }>;
            segmentIndex: z.ZodNumber;
            segmentCount: z.ZodNumber;
            text: z.ZodString;
            byteSize: z.ZodNumber;
            contentHash: z.ZodString;
            previousSegmentId: z.ZodNullable<z.ZodString>;
            nextSegmentId: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>>>;
        continuation: z.ZodOptional<z.ZodObject<{
            cursor: z.ZodNullable<z.ZodString>;
            hasMore: z.ZodBoolean;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    sourceBasis: z.ZodObject<{
        generationId: z.ZodString;
        files: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            byteSize: z.ZodNumber;
            contentHash: z.ZodString;
        }, z.core.$strict>>;
        records: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<{
                symbol: "symbol";
                file: "file";
                import: "import";
                relationship: "relationship";
            }>;
            recordId: z.ZodString;
            path: z.ZodString;
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
    }, z.core.$strict>;
    coverage: z.ZodObject<{
        candidateCount: z.ZodNumber;
        includedCount: z.ZodNumber;
        excludedCount: z.ZodNumber;
        exclusions: z.ZodArray<z.ZodObject<{
            reason: z.ZodString;
            count: z.ZodNumber;
        }, z.core.$strict>>;
        structural: z.ZodObject<{
            filesInventoried: z.ZodNumber;
            filesWithFullCoverage: z.ZodNumber;
            filesWithFileCoverage: z.ZodNumber;
            symbolsExtracted: z.ZodNumber;
            importsExtracted: z.ZodNumber;
            relationshipsExtracted: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>;
    semantic: z.ZodOptional<z.ZodObject<{
        capabilities: z.ZodArray<z.ZodObject<{
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
        }, z.core.$strict>>;
        claims: z.ZodArray<z.ZodObject<{
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
        }, z.core.$strict>>;
        aliases: z.ZodArray<z.ZodObject<{
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
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    cacheHash: z.ZodString;
}, z.core.$strict>;
export type PortableIncrementalReason = "cold" | "no-cache" | "invalid-cache" | "provenance-drift" | "root-drift" | "unchanged" | "source-changed" | "inventory-scope-changed" | "dependency-reparse";
export type PortableIncrementalCounters = {
    readonly cacheAccepted: boolean;
    readonly filesConsidered: number;
    readonly filesReused: number;
    readonly filesParsed: number;
    readonly filesAdded: number;
    readonly filesChanged: number;
    readonly filesDeleted: number;
    readonly importerFilesReparsed: number;
};
export type PortableSemanticInvalidation = {
    readonly model?: PortableAcceptedSemanticModel;
    readonly invalidatedCapabilityIds: readonly string[];
    readonly invalidatedClaimIds: readonly string[];
    readonly invalidatedAliasIds: readonly string[];
    readonly reasons: readonly ("evidence-changed" | "dependency-closure" | "inventory-scope")[];
};
export type PortableIncrementalSuccess = PortableExtractionSuccess & {
    readonly cache: PortableIncrementalCache;
    readonly incremental: {
        readonly reason: PortableIncrementalReason;
        readonly counters: PortableIncrementalCounters;
        readonly semantic: PortableSemanticInvalidation;
    };
};
export type PortableIncrementalResult = PortableIncrementalSuccess | PortableExtractionFailure;
/** @internal Test-only seam for exercising parser provenance drift. */
export declare const incrementalTestHooks: {
    provenanceOverride?: ExtractionParserProvenance;
};
export declare function portableProvenanceHash(provenance: ExtractionParserProvenance): string;
export declare function createPortableIncrementalCache(extraction: PortableExtractionSuccess, semantic?: PortableAcceptedSemanticModel): PortableIncrementalCache;
export declare function parsePortableIncrementalCache(input: unknown): PortableIncrementalCache | null;
/**
 * Remove semantic records whose declared evidence changed, then close over
 * capability -> claims and alias -> capability/symbol dependencies.  The
 * returned model contains only records still eligible to be called fresh.
 */
export declare function invalidatePortableSemanticModel(model: PortableAcceptedSemanticModel | undefined, options?: {
    readonly changedPaths?: ReadonlySet<string>;
    readonly changedRecordIds?: ReadonlySet<string>;
    readonly inventoryScopeChanged?: boolean;
}): PortableSemanticInvalidation;
/**
 * Incrementally refresh a previously accepted operational extraction. Public
 * lifecycle owners may adopt this later; this module deliberately performs no
 * operation-store, publication, or MCP writes.
 */
export declare function extractPortableRepositoryIncremental(options: PortableExtractionOptions & {
    readonly previous?: unknown;
    readonly semantic?: PortableAcceptedSemanticModel;
}): Promise<PortableIncrementalResult>;
export declare const refreshPortableRepository: typeof extractPortableRepositoryIncremental;
export declare const incrementalExtractPortableRepository: typeof extractPortableRepositoryIncremental;
export declare const extractPortableRepositoryIncrementally: typeof extractPortableRepositoryIncremental;
export {};
