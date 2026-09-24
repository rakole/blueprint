import * as z from "zod/v4";
/**
 * Portable codebase-map contracts are intentionally source-owned.  Consumers
 * can copy a sealed generation and use these values without a Blueprint
 * runtime, while writers can still reject a generation from another format.
 */
export declare const PORTABLE_MAP_FORMAT_VERSION: 1;
export declare const PORTABLE_MAP_PROTOCOL_VERSION: 1;
export declare const PORTABLE_MAP_PUBLICATION_MARKER_VERSION: 2;
export declare const PORTABLE_MAP_OPERATION_METADATA_VERSION: 2;
export declare const PORTABLE_MAP_VERSION: 1;
export declare const PORTABLE_MAP_MARKER_VERSION: 2;
export declare const PORTABLE_MAP_BYTE_LIMITS: {
    readonly index: number;
    readonly entry: number;
    readonly intermediateRoute: number;
    readonly capabilityPage: number;
    readonly recordPage: number;
    readonly searchShard: number;
    readonly searchHit: number;
    readonly structuralDetailSegment: number;
    readonly modelPacket: number;
};
export declare const PORTABLE_MAP_MAX_MODEL_PACKET_BYTES: number;
export declare const PORTABLE_MAP_MAX_MODEL_PACKET_UTF8_BYTES: number;
export declare const PORTABLE_MAP_MAX_INDEX_BYTES: number;
export declare const PORTABLE_MAP_MAX_ENTRY_BYTES: number;
export declare const PORTABLE_MAP_MAX_ROUTE_PAGE_BYTES: number;
export declare const PORTABLE_MAP_MAX_CAPABILITY_PAGE_BYTES: number;
export declare const PORTABLE_MAP_MAX_RECORD_PAGE_BYTES: number;
export declare const PORTABLE_MAP_MAX_SEARCH_SHARD_BYTES: number;
export declare const PORTABLE_MAP_MAX_SEARCH_HIT_BYTES: number;
export declare const PORTABLE_MAP_MAX_STRUCTURAL_DETAIL_SEGMENT_BYTES: number;
/**
 * Coordinates are intentionally explicit at the format boundary.  Adapters
 * normalize their parser-specific positions to one-based lines, zero-based
 * UTF-8 byte columns, and zero-based UTF-8 byte offsets.  Ranges are
 * end-exclusive, so a zero-length range is represented by equal endpoints.
 */
export declare const PORTABLE_MAP_COORDINATE_CONVENTION: {
    readonly line: "one-based";
    readonly column: "zero-based-utf8-byte";
    readonly byte: "zero-based-utf8-byte-offset";
    readonly range: "end-exclusive";
};
/** UTF-8 bytes, rather than JavaScript UTF-16 code units. */
export declare function utf8ByteLength(value: string): number;
/**
 * Serialize a packet exactly as it crosses the model boundary.  Callers must
 * split on record boundaries when this exceeds the cap; this helper never
 * truncates or otherwise changes the supplied value.
 */
export declare function serializedUtf8ByteLength(value: unknown): number;
export declare const portableSha256Schema: z.ZodString;
export declare const portableGitCommitSchema: z.ZodString;
/** Safe, generation-local identifiers never become path fragments. */
export declare const generationLocalIdSchema: z.ZodString;
export type GenerationLocalId = z.infer<typeof generationLocalIdSchema>;
/** Repository-relative paths only; dot segments, separators and control bytes are rejected. */
export declare const repositoryRelativePathSchema: z.ZodString;
export type RepositoryRelativePath = z.infer<typeof repositoryRelativePathSchema>;
/** End-exclusive source range with one-based lines and UTF-8 byte positions. */
export declare const portableSourceCoordinateSchema: z.ZodObject<{
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
export type PortableSourceCoordinate = z.infer<typeof portableSourceCoordinateSchema>;
export declare const PORTABLE_MAP_LANGUAGES: readonly ["javascript", "jsx", "typescript", "tsx", "python", "java", "unknown"];
export declare const portableLanguageSchema: z.ZodEnum<{
    unknown: "unknown";
    tsx: "tsx";
    typescript: "typescript";
    javascript: "javascript";
    jsx: "jsx";
    python: "python";
    java: "java";
}>;
export type PortableLanguage = z.infer<typeof portableLanguageSchema>;
export declare const PORTABLE_MAP_FILE_ROLES: readonly ["source", "test", "configuration", "documentation", "generated", "unknown"];
export declare const portableFileRoleSchema: z.ZodEnum<{
    unknown: "unknown";
    test: "test";
    source: "source";
    generated: "generated";
    configuration: "configuration";
    documentation: "documentation";
}>;
export declare const PORTABLE_MAP_PARSE_STATUSES: readonly ["parsed", "partial", "failed", "unsupported", "skipped"];
export declare const portableParseStatusSchema: z.ZodEnum<{
    failed: "failed";
    skipped: "skipped";
    partial: "partial";
    unsupported: "unsupported";
    parsed: "parsed";
}>;
export type PortableParseStatus = z.infer<typeof portableParseStatusSchema>;
export declare const PORTABLE_MAP_COVERAGE_STATUSES: readonly ["full", "file", "none"];
export declare const portableCoverageStatusSchema: z.ZodEnum<{
    file: "file";
    none: "none";
    full: "full";
}>;
export type PortableCoverageStatus = z.infer<typeof portableCoverageStatusSchema>;
export declare const PORTABLE_MAP_LIMITATION_REASONS: readonly ["none", "unsupported-language", "too-large", "binary", "parse-error", "excluded", "unreadable", "not-extracted", "unsafe-content", "unsupported-construct"];
export declare const portableLimitationReasonSchema: z.ZodEnum<{
    binary: "binary";
    none: "none";
    unreadable: "unreadable";
    excluded: "excluded";
    "too-large": "too-large";
    "unsafe-content": "unsafe-content";
    "unsupported-language": "unsupported-language";
    "parse-error": "parse-error";
    "not-extracted": "not-extracted";
    "unsupported-construct": "unsupported-construct";
}>;
export declare const portableFileRecordSchema: z.ZodObject<{
    id: z.ZodString;
    path: z.ZodString;
    language: z.ZodEnum<{
        unknown: "unknown";
        tsx: "tsx";
        typescript: "typescript";
        javascript: "javascript";
        jsx: "jsx";
        python: "python";
        java: "java";
    }>;
    role: z.ZodEnum<{
        unknown: "unknown";
        test: "test";
        source: "source";
        generated: "generated";
        configuration: "configuration";
        documentation: "documentation";
    }>;
    byteSize: z.ZodNumber;
    contentHash: z.ZodString;
    parseStatus: z.ZodEnum<{
        failed: "failed";
        skipped: "skipped";
        partial: "partial";
        unsupported: "unsupported";
        parsed: "parsed";
    }>;
    coverageStatus: z.ZodEnum<{
        file: "file";
        none: "none";
        full: "full";
    }>;
    limitationReason: z.ZodOptional<z.ZodEnum<{
        binary: "binary";
        none: "none";
        unreadable: "unreadable";
        excluded: "excluded";
        "too-large": "too-large";
        "unsafe-content": "unsafe-content";
        "unsupported-language": "unsupported-language";
        "parse-error": "parse-error";
        "not-extracted": "not-extracted";
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
}, z.core.$strict>;
export type PortableFileRecord = z.infer<typeof portableFileRecordSchema>;
export declare const PORTABLE_MAP_SYMBOL_KINDS: readonly ["module", "class", "interface", "type", "enum", "function", "method", "constructor", "variable", "constant", "property", "field", "unknown"];
export declare const portableSymbolKindSchema: z.ZodEnum<{
    function: "function";
    unknown: "unknown";
    enum: "enum";
    type: "type";
    field: "field";
    constructor: "constructor";
    method: "method";
    module: "module";
    class: "class";
    interface: "interface";
    variable: "variable";
    constant: "constant";
    property: "property";
}>;
export type PortableSymbolKind = z.infer<typeof portableSymbolKindSchema>;
export declare const PORTABLE_MAP_STRUCTURAL_DETAIL_FIELDS: readonly ["qualifiedName", "signature"];
export declare const portableStructuralDetailFieldSchema: z.ZodEnum<{
    qualifiedName: "qualifiedName";
    signature: "signature";
}>;
export type PortableStructuralDetailField = z.infer<typeof portableStructuralDetailFieldSchema>;
/** A bounded link to a lossless chain of structural text segments. */
export declare const portableStructuralDetailReferenceSchema: z.ZodObject<{
    field: z.ZodEnum<{
        qualifiedName: "qualifiedName";
        signature: "signature";
    }>;
    firstSegmentId: z.ZodString;
    segmentCount: z.ZodNumber;
    byteSize: z.ZodNumber;
    contentHash: z.ZodString;
}, z.core.$strict>;
export type PortableStructuralDetailReference = z.infer<typeof portableStructuralDetailReferenceSchema>;
/**
 * Structural text is limited to declaration names/signatures.  Long values
 * are split on UTF-8 byte boundaries by the adapter and reassembled by the
 * later validator; bodies, comments, and arbitrary literal payloads have no
 * field in this contract.
 */
export declare const portableStructuralDetailRecordSchema: z.ZodObject<{
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
}, z.core.$strict>;
export type PortableStructuralDetailRecord = z.infer<typeof portableStructuralDetailRecordSchema>;
export declare const portableStructuralTextDetailSchema: z.ZodObject<{
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
}, z.core.$strict>;
export type PortableStructuralTextDetail = PortableStructuralDetailRecord;
export declare const portableSymbolRecordSchema: z.ZodObject<{
    id: z.ZodString;
    fileId: z.ZodString;
    path: z.ZodString;
    qualifiedName: z.ZodOptional<z.ZodString>;
    kind: z.ZodEnum<{
        function: "function";
        unknown: "unknown";
        enum: "enum";
        type: "type";
        field: "field";
        constructor: "constructor";
        method: "method";
        module: "module";
        class: "class";
        interface: "interface";
        variable: "variable";
        constant: "constant";
        property: "property";
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
}, z.core.$strict>;
export type PortableSymbolRecord = z.infer<typeof portableSymbolRecordSchema>;
export declare const PORTABLE_MAP_UNRESOLVED_REASONS: readonly ["dynamic-import", "reflection", "dependency-injection", "dynamic-dispatch", "ambiguous-module", "unsupported-resolution", "missing-target", "parse-error", "external-dependency", "unknown"];
export declare const portableUnresolvedReasonSchema: z.ZodEnum<{
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
}>;
export type PortableUnresolvedReason = z.infer<typeof portableUnresolvedReasonSchema>;
export declare const PORTABLE_MAP_RESOLUTION_STATUSES: readonly ["resolved", "unresolved", "ambiguous", "unsupported"];
export declare const portableResolutionStatusSchema: z.ZodEnum<{
    resolved: "resolved";
    ambiguous: "ambiguous";
    unsupported: "unsupported";
    unresolved: "unresolved";
}>;
export type PortableResolutionStatus = z.infer<typeof portableResolutionStatusSchema>;
export declare const portableImportRelationshipSchema: z.ZodObject<{
    origin: z.ZodLiteral<"syntax">;
    certainty: z.ZodEnum<{
        unknown: "unknown";
        observed: "observed";
        "supported-inference": "supported-inference";
    }>;
    resolutionStatus: z.ZodEnum<{
        resolved: "resolved";
        ambiguous: "ambiguous";
        unsupported: "unsupported";
        unresolved: "unresolved";
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
}, z.core.$strict>;
export type PortableImportRelationship = z.infer<typeof portableImportRelationshipSchema>;
export type PortableImportRecord = PortableImportRelationship;
export declare const portableImportRecordSchema: z.ZodObject<{
    origin: z.ZodLiteral<"syntax">;
    certainty: z.ZodEnum<{
        unknown: "unknown";
        observed: "observed";
        "supported-inference": "supported-inference";
    }>;
    resolutionStatus: z.ZodEnum<{
        resolved: "resolved";
        ambiguous: "ambiguous";
        unsupported: "unsupported";
        unresolved: "unresolved";
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
}, z.core.$strict>;
export declare const portableRelationshipRecordSchema: z.ZodObject<{
    origin: z.ZodEnum<{
        inferred: "inferred";
        syntax: "syntax";
        authored: "authored";
    }>;
    certainty: z.ZodEnum<{
        unknown: "unknown";
        observed: "observed";
        "supported-inference": "supported-inference";
    }>;
    resolutionStatus: z.ZodEnum<{
        resolved: "resolved";
        ambiguous: "ambiguous";
        unsupported: "unsupported";
        unresolved: "unresolved";
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
}, z.core.$strict>;
export type PortableRelationshipRecord = z.infer<typeof portableRelationshipRecordSchema>;
export declare const PORTABLE_MAP_RECORD_KINDS: readonly ["files", "symbols", "imports", "relationships", "details"];
export declare const portableRecordKindSchema: z.ZodEnum<{
    files: "files";
    symbols: "symbols";
    imports: "imports";
    relationships: "relationships";
    details: "details";
}>;
export declare const portableInventoryContinuationSchema: z.ZodObject<{
    cursor: z.ZodNullable<z.ZodString>;
    hasMore: z.ZodBoolean;
}, z.core.$strict>;
export type PortableInventoryContinuation = z.infer<typeof portableInventoryContinuationSchema>;
/** A bounded structural shard. The manifest is the index over multiple shards. */
export declare const portableStructuralInventorySchema: z.ZodObject<{
    generationId: z.ZodString;
    shardId: z.ZodString;
    files: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        path: z.ZodString;
        language: z.ZodEnum<{
            unknown: "unknown";
            tsx: "tsx";
            typescript: "typescript";
            javascript: "javascript";
            jsx: "jsx";
            python: "python";
            java: "java";
        }>;
        role: z.ZodEnum<{
            unknown: "unknown";
            test: "test";
            source: "source";
            generated: "generated";
            configuration: "configuration";
            documentation: "documentation";
        }>;
        byteSize: z.ZodNumber;
        contentHash: z.ZodString;
        parseStatus: z.ZodEnum<{
            failed: "failed";
            skipped: "skipped";
            partial: "partial";
            unsupported: "unsupported";
            parsed: "parsed";
        }>;
        coverageStatus: z.ZodEnum<{
            file: "file";
            none: "none";
            full: "full";
        }>;
        limitationReason: z.ZodOptional<z.ZodEnum<{
            binary: "binary";
            none: "none";
            unreadable: "unreadable";
            excluded: "excluded";
            "too-large": "too-large";
            "unsafe-content": "unsafe-content";
            "unsupported-language": "unsupported-language";
            "parse-error": "parse-error";
            "not-extracted": "not-extracted";
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
            field: "field";
            constructor: "constructor";
            method: "method";
            module: "module";
            class: "class";
            interface: "interface";
            variable: "variable";
            constant: "constant";
            property: "property";
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
            resolved: "resolved";
            ambiguous: "ambiguous";
            unsupported: "unsupported";
            unresolved: "unresolved";
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
            inferred: "inferred";
            syntax: "syntax";
            authored: "authored";
        }>;
        certainty: z.ZodEnum<{
            unknown: "unknown";
            observed: "observed";
            "supported-inference": "supported-inference";
        }>;
        resolutionStatus: z.ZodEnum<{
            resolved: "resolved";
            ambiguous: "ambiguous";
            unsupported: "unsupported";
            unresolved: "unresolved";
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
}, z.core.$strict>;
export type PortableStructuralInventory = z.infer<typeof portableStructuralInventorySchema>;
export declare const portableEvidenceDependencySchema: z.ZodObject<{
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
}, z.core.$strict>;
export type PortableEvidenceDependency = z.infer<typeof portableEvidenceDependencySchema>;
export declare const portableClaimSchema: z.ZodObject<{
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
}, z.core.$strict>;
export type PortableClaim = z.infer<typeof portableClaimSchema>;
export declare const portableCapabilitySchema: z.ZodObject<{
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
}, z.core.$strict>;
export type PortableCapability = z.infer<typeof portableCapabilitySchema>;
export declare const portableAliasSchema: z.ZodObject<{
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
}, z.core.$strict>;
export type PortableAlias = z.infer<typeof portableAliasSchema>;
/** Accepted authored meaning; structural inventory is deliberately not embedded here. */
export declare const portableAcceptedSemanticModelSchema: z.ZodObject<{
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
}, z.core.$strict>;
export type PortableAcceptedSemanticModel = z.infer<typeof portableAcceptedSemanticModelSchema>;
/** Existing seven codebase views, made required for a portable submission. */
export declare const portableCompleteCodebaseMapModelSchema: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodObject<{
    summary: z.ZodString;
    sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        content: z.ZodString;
    }, z.core.$strict>>>;
    evidencePaths: z.ZodArray<z.ZodString>;
}, z.core.$strict>>, z.core.$strict>;
export type PortableCompleteCodebaseMapModel = z.infer<typeof portableCompleteCodebaseMapModelSchema>;
export declare const portableSevenViewModelSchema: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodObject<{
    summary: z.ZodString;
    sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        content: z.ZodString;
    }, z.core.$strict>>>;
    evidencePaths: z.ZodArray<z.ZodString>;
}, z.core.$strict>>, z.core.$strict>;
export type PortableSevenViewModel = PortableCompleteCodebaseMapModel;
export declare const portableCodebaseDocumentModelSchema: z.ZodObject<{
    summary: z.ZodString;
    sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        content: z.ZodString;
    }, z.core.$strict>>>;
    evidencePaths: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare const portableCodebaseMapModelSchema: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodObject<{
    summary: z.ZodString;
    sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        heading: z.ZodString;
        content: z.ZodString;
    }, z.core.$strict>>>;
    evidencePaths: z.ZodArray<z.ZodString>;
}, z.core.$strict>>, z.core.$strict>;
export declare const PORTABLE_MAP_REQUIRED_DOCUMENT_IDS: readonly ["stack", "architecture", "structure", "conventions", "testing", "integrations", "concerns"];
export declare const portableMapSubmissionSchema: z.ZodObject<{
    formatVersion: z.ZodLiteral<1>;
    generationId: z.ZodString;
    documents: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodObject<{
        summary: z.ZodString;
        sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            content: z.ZodString;
        }, z.core.$strict>>>;
        evidencePaths: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>, z.core.$strict>;
    semantic: z.ZodObject<{
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
    }, z.core.$strict>;
}, z.core.$strict>;
export type PortableMapSubmission = z.infer<typeof portableMapSubmissionSchema>;
export declare const portableMapModelSchema: z.ZodObject<{
    formatVersion: z.ZodLiteral<1>;
    generationId: z.ZodString;
    documents: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodObject<{
        summary: z.ZodString;
        sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
            heading: z.ZodString;
            content: z.ZodString;
        }, z.core.$strict>>>;
        evidencePaths: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>, z.core.$strict>;
    semantic: z.ZodObject<{
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
    }, z.core.$strict>;
}, z.core.$strict>;
export type PortableMapModel = PortableMapSubmission;
export declare const portableInventoryShardManifestSchema: z.ZodObject<{
    shardId: z.ZodString;
    path: z.ZodString;
    recordKind: z.ZodEnum<{
        files: "files";
        symbols: "symbols";
        imports: "imports";
        relationships: "relationships";
        details: "details";
    }>;
    recordCount: z.ZodNumber;
    byteSize: z.ZodNumber;
    checksum: z.ZodString;
}, z.core.$strict>;
export type PortableInventoryShardManifest = z.infer<typeof portableInventoryShardManifestSchema>;
export declare const portableStructuralCoverageSchema: z.ZodObject<{
    filesInventoried: z.ZodNumber;
    filesWithFullCoverage: z.ZodNumber;
    filesWithFileCoverage: z.ZodNumber;
    symbolsExtracted: z.ZodNumber;
    importsExtracted: z.ZodNumber;
    relationshipsExtracted: z.ZodNumber;
}, z.core.$strict>;
export type PortableStructuralCoverage = z.infer<typeof portableStructuralCoverageSchema>;
export declare const portableSemanticCoverageSchema: z.ZodObject<{
    capabilitiesAccepted: z.ZodNumber;
    claimsAccepted: z.ZodNumber;
    aliasesAccepted: z.ZodNumber;
    evidenceDependencies: z.ZodNumber;
}, z.core.$strict>;
export type PortableSemanticCoverage = z.infer<typeof portableSemanticCoverageSchema>;
declare const pageChecksumSchema: z.ZodObject<{
    path: z.ZodString;
    checksum: z.ZodString;
}, z.core.$strict>;
export declare const portablePageChecksumSchema: z.ZodObject<{
    path: z.ZodString;
    checksum: z.ZodString;
}, z.core.$strict>;
export type PortablePageChecksum = z.infer<typeof pageChecksumSchema>;
export declare const portableCompatibilityViewHashesSchema: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodString>, z.core.$strict>;
export type PortableCompatibilityViewHashes = z.infer<typeof portableCompatibilityViewHashesSchema>;
/** Hashes and locators for an immutable, already sealed generation. */
export declare const portableSealedGenerationReferenceSchema: z.ZodObject<{
    generationId: z.ZodString;
    manifest: z.ZodObject<{
        path: z.ZodString;
        checksum: z.ZodString;
    }, z.core.$strict>;
    entry: z.ZodObject<{
        path: z.ZodString;
        checksum: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>;
export type PortableSealedGenerationReference = z.infer<typeof portableSealedGenerationReferenceSchema>;
/** Accepted legacy bytes retained for v1 pre-commit restoration. */
export declare const portableV1BackupReferenceSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    rootPath: z.ZodString;
    generationId: z.ZodNullable<z.ZodString>;
    compatibility: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodObject<{
        path: z.ZodString;
        checksum: z.ZodString;
    }, z.core.$strict>>, z.core.$strict>;
}, z.core.$strict>;
export type PortableV1BackupReference = z.infer<typeof portableV1BackupReferenceSchema>;
/**
 * A predecessor proof is metadata-only.  It links a generation to the
 * checksummed manifest/ENTRY of the previously committed generation and the
 * root INDEX hash observed when that predecessor was active.  It never embeds
 * a future INDEX hash, so sealing the next manifest cannot form a checksum
 * cycle.
 */
export declare const portablePredecessorPublicationProofSchema: z.ZodObject<{
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
}, z.core.$strict>;
export type PortablePredecessorPublicationProof = z.infer<typeof portablePredecessorPublicationProofSchema>;
export declare const portableGenerationChecksumsSchema: z.ZodObject<{
    entry: z.ZodString;
    pages: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        checksum: z.ZodString;
    }, z.core.$strict>>;
    compatibility: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodString>, z.core.$strict>;
}, z.core.$strict>;
export type PortableGenerationChecksums = z.infer<typeof portableGenerationChecksumsSchema>;
export declare const portableGenerationManifestSchema: z.ZodObject<{
    formatVersion: z.ZodLiteral<1>;
    protocolVersion: z.ZodLiteral<1>;
    generationId: z.ZodString;
    generatedAt: z.ZodString;
    gitCommit: z.ZodNullable<z.ZodString>;
    inventoryFingerprint: z.ZodString;
    structuralCoverage: z.ZodObject<{
        filesInventoried: z.ZodNumber;
        filesWithFullCoverage: z.ZodNumber;
        filesWithFileCoverage: z.ZodNumber;
        symbolsExtracted: z.ZodNumber;
        importsExtracted: z.ZodNumber;
        relationshipsExtracted: z.ZodNumber;
    }, z.core.$strict>;
    semanticCoverage: z.ZodObject<{
        capabilitiesAccepted: z.ZodNumber;
        claimsAccepted: z.ZodNumber;
        aliasesAccepted: z.ZodNumber;
        evidenceDependencies: z.ZodNumber;
    }, z.core.$strict>;
    parserAssets: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        version: z.ZodString;
        checksum: z.ZodString;
    }, z.core.$strict>>;
    inventoryShards: z.ZodArray<z.ZodObject<{
        shardId: z.ZodString;
        path: z.ZodString;
        recordKind: z.ZodEnum<{
            files: "files";
            symbols: "symbols";
            imports: "imports";
            relationships: "relationships";
            details: "details";
        }>;
        recordCount: z.ZodNumber;
        byteSize: z.ZodNumber;
        checksum: z.ZodString;
    }, z.core.$strict>>;
    checksums: z.ZodObject<{
        entry: z.ZodString;
        pages: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            checksum: z.ZodString;
        }, z.core.$strict>>;
        compatibility: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodString>, z.core.$strict>;
    }, z.core.$strict>;
    evidenceDependencies: z.ZodArray<z.ZodObject<{
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
    predecessorGenerationId: z.ZodNullable<z.ZodString>;
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
export type PortableGenerationManifest = z.infer<typeof portableGenerationManifestSchema>;
export declare const portableSourceBasisSchema: z.ZodObject<{
    rootHash: z.ZodString;
    inventoryHash: z.ZodString;
    evidenceHash: z.ZodString;
}, z.core.$strict>;
export type PortableSourceBasis = z.infer<typeof portableSourceBasisSchema>;
export declare const portableTargetHashesSchema: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodNullable<z.ZodString>>, z.core.$strict>;
export type PortableTargetHashes = z.infer<typeof portableTargetHashesSchema>;
/** Every portable publication must render all seven compatibility views. */
export declare const portablePublishedTargetHashesSchema: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodString>, z.core.$strict>;
export type PortablePublishedTargetHashes = PortableCompatibilityViewHashes;
export declare const PORTABLE_MAP_OPERATION_STAGES: readonly ["prepared"];
export declare const portableOperationStageSchema: z.ZodEnum<{
    prepared: "prepared";
}>;
export type PortableOperationStage = z.infer<typeof portableOperationStageSchema>;
export declare const PORTABLE_MAP_PUBLICATION_STAGES: readonly ["publishing", "index-committed", "cleanup"];
export declare const portablePublicationStageSchema: z.ZodEnum<{
    cleanup: "cleanup";
    publishing: "publishing";
    "index-committed": "index-committed";
}>;
export type PortablePublicationStage = z.infer<typeof portablePublicationStageSchema>;
/** Pre-authoring state. It intentionally has no future rendered hash. */
export declare const portableOperationMetadataSchema: z.ZodObject<{
    version: z.ZodLiteral<2>;
    operationId: z.ZodString;
    stage: z.ZodEnum<{
        prepared: "prepared";
    }>;
    generationId: z.ZodString;
    previousGenerationId: z.ZodNullable<z.ZodString>;
    previousIndexHash: z.ZodNullable<z.ZodString>;
    sourceBasis: z.ZodObject<{
        rootHash: z.ZodString;
        inventoryHash: z.ZodString;
        evidenceHash: z.ZodString;
    }, z.core.$strict>;
    targetHashes: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodNullable<z.ZodString>>, z.core.$strict>;
    createdAt: z.ZodString;
}, z.core.$strict>;
export type PortableOperationMetadata = z.infer<typeof portableOperationMetadataSchema>;
export declare const portablePreparedOperationMetadataSchema: z.ZodObject<{
    version: z.ZodLiteral<2>;
    operationId: z.ZodString;
    stage: z.ZodEnum<{
        prepared: "prepared";
    }>;
    generationId: z.ZodString;
    previousGenerationId: z.ZodNullable<z.ZodString>;
    previousIndexHash: z.ZodNullable<z.ZodString>;
    sourceBasis: z.ZodObject<{
        rootHash: z.ZodString;
        inventoryHash: z.ZodString;
        evidenceHash: z.ZodString;
    }, z.core.$strict>;
    targetHashes: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodNullable<z.ZodString>>, z.core.$strict>;
    createdAt: z.ZodString;
}, z.core.$strict>;
export type PortablePreparedOperationMetadata = PortableOperationMetadata;
/** Accepted publication state. Only this marker carries sealed next hashes. */
export declare const portablePublicationMarkerSchema: z.ZodObject<{
    version: z.ZodLiteral<2>;
    operationId: z.ZodString;
    transactionId: z.ZodString;
    stage: z.ZodEnum<{
        cleanup: "cleanup";
        publishing: "publishing";
        "index-committed": "index-committed";
    }>;
    generationId: z.ZodString;
    previousGenerationId: z.ZodNullable<z.ZodString>;
    previousIndexHash: z.ZodNullable<z.ZodString>;
    nextIndexHash: z.ZodString;
    sourceBasis: z.ZodObject<{
        rootHash: z.ZodString;
        inventoryHash: z.ZodString;
        evidenceHash: z.ZodString;
    }, z.core.$strict>;
    previousTargetHashes: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodNullable<z.ZodString>>, z.core.$strict>;
    nextTargetHashes: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodString>, z.core.$strict>;
    sealedGeneration: z.ZodObject<{
        generationId: z.ZodString;
        manifest: z.ZodObject<{
            path: z.ZodString;
            checksum: z.ZodString;
        }, z.core.$strict>;
        entry: z.ZodObject<{
            path: z.ZodString;
            checksum: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>;
    v1BackupReference: z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<1>;
        rootPath: z.ZodString;
        generationId: z.ZodNullable<z.ZodString>;
        compatibility: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodObject<{
            path: z.ZodString;
            checksum: z.ZodString;
        }, z.core.$strict>>, z.core.$strict>;
    }, z.core.$strict>>;
    createdAt: z.ZodString;
}, z.core.$strict>;
export type PortablePublicationMarker = z.infer<typeof portablePublicationMarkerSchema>;
/**
 * Bounded, selected context for one authoring request. It has no inventory
 * field, so an entire inventory cannot accidentally be embedded in a model
 * submission or a session receipt.
 */
export declare const portableModelPacketSchema: z.ZodObject<{
    packetVersion: z.ZodLiteral<1>;
    operationId: z.ZodString;
    generationId: z.ZodString;
    selectedFiles: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        path: z.ZodString;
        language: z.ZodEnum<{
            unknown: "unknown";
            tsx: "tsx";
            typescript: "typescript";
            javascript: "javascript";
            jsx: "jsx";
            python: "python";
            java: "java";
        }>;
        role: z.ZodEnum<{
            unknown: "unknown";
            test: "test";
            source: "source";
            generated: "generated";
            configuration: "configuration";
            documentation: "documentation";
        }>;
        byteSize: z.ZodNumber;
        contentHash: z.ZodString;
        parseStatus: z.ZodEnum<{
            failed: "failed";
            skipped: "skipped";
            partial: "partial";
            unsupported: "unsupported";
            parsed: "parsed";
        }>;
        coverageStatus: z.ZodEnum<{
            file: "file";
            none: "none";
            full: "full";
        }>;
        limitationReason: z.ZodOptional<z.ZodEnum<{
            binary: "binary";
            none: "none";
            unreadable: "unreadable";
            excluded: "excluded";
            "too-large": "too-large";
            "unsafe-content": "unsafe-content";
            "unsupported-language": "unsupported-language";
            "parse-error": "parse-error";
            "not-extracted": "not-extracted";
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
    selectedSymbols: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        fileId: z.ZodString;
        path: z.ZodString;
        qualifiedName: z.ZodOptional<z.ZodString>;
        kind: z.ZodEnum<{
            function: "function";
            unknown: "unknown";
            enum: "enum";
            type: "type";
            field: "field";
            constructor: "constructor";
            method: "method";
            module: "module";
            class: "class";
            interface: "interface";
            variable: "variable";
            constant: "constant";
            property: "property";
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
    selectedDetails: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
    selectedImports: z.ZodArray<z.ZodObject<{
        origin: z.ZodLiteral<"syntax">;
        certainty: z.ZodEnum<{
            unknown: "unknown";
            observed: "observed";
            "supported-inference": "supported-inference";
        }>;
        resolutionStatus: z.ZodEnum<{
            resolved: "resolved";
            ambiguous: "ambiguous";
            unsupported: "unsupported";
            unresolved: "unresolved";
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
    selectedRelationships: z.ZodArray<z.ZodObject<{
        origin: z.ZodEnum<{
            inferred: "inferred";
            syntax: "syntax";
            authored: "authored";
        }>;
        certainty: z.ZodEnum<{
            unknown: "unknown";
            observed: "observed";
            "supported-inference": "supported-inference";
        }>;
        resolutionStatus: z.ZodEnum<{
            resolved: "resolved";
            ambiguous: "ambiguous";
            unsupported: "unsupported";
            unresolved: "unresolved";
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
    selectedCapabilities: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        summary: z.ZodString;
    }, z.core.$strict>>;
    continuation: z.ZodOptional<z.ZodObject<{
        cursor: z.ZodNullable<z.ZodString>;
        hasMore: z.ZodBoolean;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type PortableModelPacket = z.infer<typeof portableModelPacketSchema>;
export declare const portableModelEvidencePacketSchema: z.ZodObject<{
    packetVersion: z.ZodLiteral<1>;
    operationId: z.ZodString;
    generationId: z.ZodString;
    selectedFiles: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        path: z.ZodString;
        language: z.ZodEnum<{
            unknown: "unknown";
            tsx: "tsx";
            typescript: "typescript";
            javascript: "javascript";
            jsx: "jsx";
            python: "python";
            java: "java";
        }>;
        role: z.ZodEnum<{
            unknown: "unknown";
            test: "test";
            source: "source";
            generated: "generated";
            configuration: "configuration";
            documentation: "documentation";
        }>;
        byteSize: z.ZodNumber;
        contentHash: z.ZodString;
        parseStatus: z.ZodEnum<{
            failed: "failed";
            skipped: "skipped";
            partial: "partial";
            unsupported: "unsupported";
            parsed: "parsed";
        }>;
        coverageStatus: z.ZodEnum<{
            file: "file";
            none: "none";
            full: "full";
        }>;
        limitationReason: z.ZodOptional<z.ZodEnum<{
            binary: "binary";
            none: "none";
            unreadable: "unreadable";
            excluded: "excluded";
            "too-large": "too-large";
            "unsafe-content": "unsafe-content";
            "unsupported-language": "unsupported-language";
            "parse-error": "parse-error";
            "not-extracted": "not-extracted";
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
    selectedSymbols: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        fileId: z.ZodString;
        path: z.ZodString;
        qualifiedName: z.ZodOptional<z.ZodString>;
        kind: z.ZodEnum<{
            function: "function";
            unknown: "unknown";
            enum: "enum";
            type: "type";
            field: "field";
            constructor: "constructor";
            method: "method";
            module: "module";
            class: "class";
            interface: "interface";
            variable: "variable";
            constant: "constant";
            property: "property";
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
    selectedDetails: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
    selectedImports: z.ZodArray<z.ZodObject<{
        origin: z.ZodLiteral<"syntax">;
        certainty: z.ZodEnum<{
            unknown: "unknown";
            observed: "observed";
            "supported-inference": "supported-inference";
        }>;
        resolutionStatus: z.ZodEnum<{
            resolved: "resolved";
            ambiguous: "ambiguous";
            unsupported: "unsupported";
            unresolved: "unresolved";
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
    selectedRelationships: z.ZodArray<z.ZodObject<{
        origin: z.ZodEnum<{
            inferred: "inferred";
            syntax: "syntax";
            authored: "authored";
        }>;
        certainty: z.ZodEnum<{
            unknown: "unknown";
            observed: "observed";
            "supported-inference": "supported-inference";
        }>;
        resolutionStatus: z.ZodEnum<{
            resolved: "resolved";
            ambiguous: "ambiguous";
            unsupported: "unsupported";
            unresolved: "unresolved";
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
    selectedCapabilities: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        summary: z.ZodString;
    }, z.core.$strict>>;
    continuation: z.ZodOptional<z.ZodObject<{
        cursor: z.ZodNullable<z.ZodString>;
        hasMore: z.ZodBoolean;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type PortableModelEvidencePacket = PortableModelPacket;
/** Fixed public vocabulary; never expose Zod prose, keys, inputs, or values. */
export declare const PORTABLE_CONTRACT_DIAGNOSTIC_CODES: readonly ["invalid-structure", "invalid-type", "invalid-format", "too-small", "too-large", "missing-field", "unrecognized-field", "invalid-value"];
export type PortableContractDiagnosticCode = typeof PORTABLE_CONTRACT_DIAGNOSTIC_CODES[number];
export declare function portableContractIssues(error: z.ZodError): Array<{
    path: string;
    code: PortableContractDiagnosticCode;
    message: string;
}>;
export {};
