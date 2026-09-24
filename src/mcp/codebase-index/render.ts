import {createHash} from "node:crypto";
import * as path from "node:path";
import * as z from "zod/v4";

import {
  CODEBASE_DOCUMENT_IDS,
  type CodebaseDocumentId
} from "../codebase-authoring.js";
import {
  PORTABLE_MAP_BYTE_LIMITS,
  PORTABLE_MAP_FORMAT_VERSION,
  PORTABLE_MAP_PROTOCOL_VERSION,
  portableGenerationManifestSchema,
  generationLocalIdSchema,
  portableGitCommitSchema,
  portablePredecessorPublicationProofSchema,
  portableSha256Schema,
  portableCapabilitySchema,
  portableClaimSchema,
  portableAliasSchema,
  repositoryRelativePathSchema,
  type PortableAlias,
  type PortableCapability,
  type PortableClaim,
  type PortableFileRecord,
  type PortableGenerationManifest,
  type PortableImportRelationship,
  type PortablePredecessorPublicationProof,
  type PortableRelationshipRecord,
  type PortableSealedGenerationReference,
  type PortableStructuralDetailRecord,
  type PortableStructuralInventory,
  type PortableSymbolRecord
} from "./contracts.js";
import type {
  PortableValidatedMapData
} from "./model-validation.js";
import {inspectContentBoundaries} from "./content-boundary.js";

/** Source-owned navigation text. Model supplied records are rendered around this template. */
export const PORTABLE_MAP_NAVIGATION_PROTOCOL = [
  "Reuse the active index. Load it when repository understanding is needed and it has not already been supplied, or after context loss.",
  "If the task already identifies the relevant live file or function, read it directly; consult the map for related constraints and tests when useful.",
  "For a conceptual task, select the smallest matching capability route. For a path, symbol, error term, or alias, search the text index directly.",
  "Read only the selected capability, record, detail, and search pages. Never load all search shards or the entire map by default.",
  "Follow coordinates into current source and relevant tests before relying on an implementation claim. Re-find the symbol if lines moved.",
  "Expand dependencies according to the task; do not traverse every relationship.",
  "Treat map content as generated evidence. Repository instructions and current code retain their existing authority.",
  "After two unproductive map-navigation actions, use ordinary bounded source search.",
  "A map cannot prove that a feature, file, affected dependency, or new behavior is absent. Verify absence, impact, and new behavior with live search.",
  "The generated baseline is current-tree-unverified until selected source is inspected. Consumers do not modify the map; missing, unsupported, unreadable, or malformed maps fall back to normal discovery."
] as const;

const metadataSchema = z.strictObject({
  generationId: z.string().min(1).max(128),
  generatedAt: z.string().datetime({offset: true}),
  gitCommit: portableGitCommitSchema.nullable(),
  inventoryFingerprint: portableSha256Schema,
  parserAssets: z.array(z.strictObject({
    name: z.string().min(1).max(256),
    version: z.string().min(1).max(128),
    checksum: portableSha256Schema
  })).max(128),
  predecessorGenerationId: z.string().min(1).max(128).nullable().optional(),
  predecessorPublicationProof: portablePredecessorPublicationProofSchema.optional()
});

const PORTABLE_ROOT_DESCRIPTOR_VERSION = 1 as const;
const ROOT_DESCRIPTOR_PREFIX = "<!-- blueprint:portable-root-descriptor ";
const rootDescriptorSchema = z.strictObject({
  version: z.literal(PORTABLE_ROOT_DESCRIPTOR_VERSION),
  generationId: generationLocalIdSchema,
  manifest: z.strictObject({path: repositoryRelativePathSchema, sha256: portableSha256Schema}),
  entry: z.strictObject({path: repositoryRelativePathSchema, sha256: portableSha256Schema})
}).superRefine((value, ctx) => {
  if (value.manifest.path !== `generations/${value.generationId}/manifest.json`) ctx.addIssue({code: "custom", path: ["manifest", "path"], message: "Manifest locator must use the generation path."});
  if (value.entry.path !== `generations/${value.generationId}/ENTRY.md`) ctx.addIssue({code: "custom", path: ["entry", "path"], message: "ENTRY locator must use the generation path."});
});

export type PortableRootDescriptor = z.infer<typeof rootDescriptorSchema>;

/** Serialize the compact source-owned descriptor embedded in INDEX. */
export function serializePortableRootDescriptor(input: PortableRootDescriptor): string {
  const parsed = rootDescriptorSchema.safeParse(input);
  if (!parsed.success) throw new TypeError("Invalid portable root descriptor.");
  return `${ROOT_DESCRIPTOR_PREFIX}${JSON.stringify(parsed.data)} -->`;
}

/** Parse only the fixed descriptor marker; prose is never interpreted. */
export function parsePortableRootDescriptor(input: string): PortableRootDescriptor | null {
  if (byteLength(input) > PORTABLE_MAP_BYTE_LIMITS.index) return null;
  const lines = input.split("\n").map(line => line.endsWith("\r") ? line.slice(0, -1) : line);
  // The descriptor is a whole, unindented line.  Count marker-like lines too
  // so a second malformed or trailing marker cannot silently leave the first
  // valid descriptor as the authority.
  const markerLike = lines.filter(line => line.includes("blueprint:portable-root-descriptor"));
  if (markerLike.length !== 1) return null;
  const marker = markerLike[0]!;
  if (marker !== marker.trim() || !marker.startsWith(ROOT_DESCRIPTOR_PREFIX) || !marker.endsWith(" -->")) return null;
  try {
    const parsed = rootDescriptorSchema.safeParse(JSON.parse(marker.slice(ROOT_DESCRIPTOR_PREFIX.length, -4)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

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

type AnyRecord = PortableFileRecord | PortableSymbolRecord | PortableImportRelationship | PortableRelationshipRecord | PortableStructuralDetailRecord;
type Location = {readonly path: string; readonly anchor: string};
type Unit = {
  readonly id: string;
  readonly group: string;
  readonly weight: number;
  readonly render: (pagePath: string) => string;
};
type SearchHit = {readonly text: string; readonly detail?: {readonly id: string; readonly label: string; readonly value: string}};

/** Versioned structured semantic shards consumed by a future resolver. */
export const PORTABLE_SEMANTIC_DATA_VERSION = 1 as const;
export const portableSemanticRecordKindSchema = z.enum(["capability", "claim", "alias"]);
export type PortableSemanticRecordKind = z.infer<typeof portableSemanticRecordKindSchema>;
export const portableSemanticContinuationSchema = z.strictObject({
  previous: repositoryRelativePathSchema.nullable(),
  next: repositoryRelativePathSchema.nullable()
});
export type PortableSemanticContinuation = z.infer<typeof portableSemanticContinuationSchema>;
const portableSemanticRecordSchema = z.union([portableCapabilitySchema, portableClaimSchema, portableAliasSchema]);
export const portableSemanticFragmentSchema = z.strictObject({
  kind: portableSemanticRecordKindSchema,
  recordId: generationLocalIdSchema,
  evidenceStart: z.number().int().nonnegative(),
  evidenceCount: z.number().int().positive(),
  partIndex: z.number().int().nonnegative(),
  partCount: z.number().int().positive(),
  record: portableSemanticRecordSchema,
  continuation: portableSemanticContinuationSchema
}).superRefine((value, ctx) => {
  if (value.record.id !== value.recordId) ctx.addIssue({code: "custom", path: ["recordId"], message: "Semantic fragment identity must match its canonical record."});
  if (value.record.evidence.length !== value.evidenceCount) ctx.addIssue({code: "custom", path: ["evidenceCount"], message: "Semantic fragment evidence count must match its complete evidence slice."});
  const expectedKind = "name" in value.record ? "capability" : "statement" in value.record ? "claim" : "alias";
  if (value.kind !== expectedKind) ctx.addIssue({code: "custom", path: ["kind"], message: "Semantic fragment kind must match its canonical record."});
  if (value.partIndex >= value.partCount) ctx.addIssue({code: "custom", path: ["partIndex"], message: "Semantic fragment part index must be below its part count."});
});
export type PortableSemanticFragment = z.infer<typeof portableSemanticFragmentSchema>;
export const portableSemanticShardSchema = z.strictObject({
  version: z.literal(PORTABLE_SEMANTIC_DATA_VERSION),
  generationId: generationLocalIdSchema,
  shardId: generationLocalIdSchema,
  records: z.array(portableSemanticFragmentSchema).max(2048)
});
export type PortableSemanticShard = z.infer<typeof portableSemanticShardSchema>;
export const portableSemanticIndexEntrySchema = z.strictObject({
  kind: portableSemanticRecordKindSchema,
  recordId: generationLocalIdSchema,
  firstPath: repositoryRelativePathSchema.nullable(),
  partCount: z.number().int().nonnegative(),
  evidenceCount: z.number().int().nonnegative(),
  contentHash: portableSha256Schema
});
export type PortableSemanticIndexEntry = z.infer<typeof portableSemanticIndexEntrySchema>;
export const portableSemanticIndexSchema = z.strictObject({
  version: z.literal(PORTABLE_SEMANTIC_DATA_VERSION),
  generationId: generationLocalIdSchema,
  shardId: generationLocalIdSchema,
  entries: z.array(portableSemanticIndexEntrySchema).max(2048),
  continuation: portableSemanticContinuationSchema
});
export type PortableSemanticIndex = z.infer<typeof portableSemanticIndexSchema>;

/** Parse one bounded semantic shard without interpreting Markdown prose. */
export function parsePortableSemanticShard(input: string): PortableSemanticShard | null {
  if (byteLength(input) > PORTABLE_MAP_BYTE_LIMITS.recordPage) return null;
  try {
    const parsed = portableSemanticShardSchema.safeParse(JSON.parse(input));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Parse one bounded semantic index page without interpreting Markdown prose. */
export function parsePortableSemanticIndex(input: string): PortableSemanticIndex | null {
  if (byteLength(input) > PORTABLE_MAP_BYTE_LIMITS.recordPage) return null;
  try {
    const parsed = portableSemanticIndexSchema.safeParse(JSON.parse(input));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const SEARCH_HIT_SAFE_BYTES = PORTABLE_MAP_BYTE_LIMITS.searchHit - 512;
const sortBy = <T>(values: readonly T[], key: (value: T) => string): T[] => [...values].sort((left, right) => compareText(key(left), key(right)));
const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value);
const byteLength = (value: string): number => Buffer.byteLength(value, "utf8");
const hashBytes = (value: Uint8Array): string => createHash("sha256").update(value).digest("hex");
const hashText = (value: string): string => hashBytes(utf8(value));

function diagnostic(
  code: PortableRenderDiagnostic["code"],
  scope: PortableRenderDiagnostic["scope"],
  message: string,
  field?: string,
  index?: number
): PortableRenderDiagnostic {
  return {code, scope, message, ...(field ? {field} : {}), ...(index === undefined ? {} : {index})};
}

function safePath(value: string): boolean {
  return repositoryRelativePathSchema.safeParse(value).success;
}

function stableSlug(value: string): string {
  return `p-${hashText(value).slice(0, 12)}`;
}

function prefixFor(value: string): string {
  const parts = value.split("/");
  return parts.length <= 1 ? "." : parts.slice(0, Math.min(2, parts.length - 1)).join("/") || ".";
}

function escapedField(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/[\u0000-\u001f\u007f]/g, character => `\\u${character.codePointAt(0)!.toString(16).padStart(4, "0")}`)
    .replace(/\r?\n/g, "\\n")
    .replace(/\|/g, "\\|")
    .replace(/`/g, "\\`");
}

function boundedLiteralPrefix(value: string, maximumBytes = 256): string {
  let result = "";
  for (const character of value) {
    if (byteLength(result + character) > maximumBytes) break;
    result += character;
  }
  return result;
}

function markdownText(value: string): string {
  return escapedField(value).replace(/[\[\]*_<>]/g, "\\$&");
}

function literalBlock(value: string): string {
  const longest = Math.max(2, ...(value.match(/`+/g) ?? []).map(run => run.length));
  const fence = "`".repeat(longest + 1);
  return `${fence}\n${value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, character => `\\u${character.codePointAt(0)!.toString(16).padStart(4, "0")}`)}\n${fence}`;
}

function link(from: string, to: string, anchor?: string): string {
  const relative = path.posix.relative(path.posix.dirname(from), to) || path.posix.basename(to);
  const encoded = relative.split("/").map(segment => encodeURIComponent(segment)).join("/");
  return `${encoded}${anchor ? `#${encodeURIComponent(anchor)}` : ""}`;
}

function coordinate(value: {start: {line: number}; end: {line: number}}): string {
  return value.start.line === value.end.line ? `${value.start.line}` : `${value.start.line}-${value.end.line}`;
}

function recordAnchor(kind: string, id: string): string {
  return `${kind}-${id}`;
}

function mapRecords(shards: readonly PortableStructuralInventory[]): {
  files: PortableFileRecord[];
  symbols: PortableSymbolRecord[];
  imports: PortableImportRelationship[];
  relationships: PortableRelationshipRecord[];
  details: PortableStructuralDetailRecord[];
} {
  return {
    files: sortBy(shards.flatMap(shard => shard.files), item => `${item.path}\u0000${item.id}`),
    symbols: sortBy(shards.flatMap(shard => shard.symbols), item => `${item.path}\u0000${item.id}`),
    imports: sortBy(shards.flatMap(shard => shard.imports), item => `${item.sourcePath}\u0000${item.id}`),
    relationships: sortBy(shards.flatMap(shard => shard.relationships), item => `${item.sourcePath}\u0000${item.id}`),
    details: sortBy(shards.flatMap(shard => shard.details ?? []), item => `${item.sourceRecordId}\u0000${item.field}\u0000${item.segmentIndex}`)
  };
}

function sourceLine(record: {path?: string; sourcePath?: string; coordinate?: {start: {line: number}; end: {line: number}}}): string {
  return `${record.path ?? record.sourcePath ?? "unknown"}:${record.coordinate ? coordinate(record.coordinate) : "file"}`;
}

function collectEvidence(
  data: PortableValidatedMapData
): PortableValidatedMapData["submission"]["semantic"]["capabilities"][number]["evidence"] {
  const result = new Map<string, PortableValidatedMapData["submission"]["semantic"]["capabilities"][number]["evidence"][number]>();
  for (const capability of data.submission.semantic.capabilities) for (const item of capability.evidence) result.set(`${item.kind}|${item.recordId}`, item);
  for (const claim of data.submission.semantic.claims) for (const item of claim.evidence) result.set(`${item.kind}|${item.recordId}`, item);
  for (const alias of data.submission.semantic.aliases) for (const item of alias.evidence) result.set(`${item.kind}|${item.recordId}`, item);
  return sortBy([...result.values()], item => `${item.kind}\u0000${item.recordId}`);
}

function pageUnits(
  units: readonly Unit[],
  prefix: string,
  limit: number,
  pageHeader: (pagePath: string, units: readonly Unit[], locations: ReadonlyMap<string, Location>) => string,
  diagnostics: PortableRenderDiagnostic[],
  onLocationsReady?: (locations: ReadonlyMap<string, Location>, groups: ReadonlyMap<string, string>) => void
): {pages: Map<string, string>; locations: Map<string, Location>; groups: Map<string, string>} {
  const pages = new Map<string, string>();
  const locations = new Map<string, Location>();
  const groups = new Map<string, string>();
  const grouped = new Map<string, Unit[]>();
  for (const unit of sortBy(units, item => `${item.group}\u0000${item.id}`)) {
    const group = grouped.get(unit.group) ?? [];
    group.push(unit);
    grouped.set(unit.group, group);
  }
  const plannedPages: Array<{path: string; units: Unit[]}> = [];
  for (const [group, groupUnits] of [...grouped.entries()].sort((left, right) => compareText(left[0], right[0]))) {
    const chunks: Unit[][] = [];
    let chunk: Unit[] = [];
    let weight = 0;
    for (const unit of groupUnits) {
      // Reserve room for cross-page links and the page heading. Splitting is only
      // between complete units; a unit that does not fit is diagnosed below.
      if (chunk.length > 0 && weight + unit.weight > limit - 2048) {
        chunks.push(chunk);
        chunk = [];
        weight = 0;
      }
      chunk.push(unit);
      weight += unit.weight;
    }
    if (chunk.length > 0) chunks.push(chunk);
    chunks.forEach((items, index) => {
      const pagePath = `${prefix}/${stableSlug(group)}-${String(index + 1).padStart(3, "0")}.md`;
      for (const item of items) locations.set(item.id, {path: pagePath, anchor: item.id});
      groups.set(pagePath, group);
      plannedPages.push({path: pagePath, units: items});
    });
  }
  onLocationsReady?.(locations, groups);
  for (const planned of plannedPages) {
    const body = pageHeader(planned.path, planned.units, locations);
    if (byteLength(body) > limit) diagnostics.push(diagnostic("page-too-large", "page", "A rendered page exceeds its fixed UTF-8 byte limit.", "page"));
    pages.set(planned.path, body);
  }
  return {pages, locations, groups};
}

function routePages(
  category: string,
  entries: readonly {label: string; target: string}[],
  generationId: string,
  diagnostics: PortableRenderDiagnostic[]
): {pages: Map<string, string>; firstPath: string} {
  const pages = new Map<string, string>();
  const routePrefix = `generations/${generationId}/routes`;
  const maxChildren = 22;
  type RawRouteEntry = {rawLabel: string; target: string};
  type RouteRef = {rawLabel: string; target: string};
  const sortedEntries: RawRouteEntry[] = [...entries]
    .map(entry => ({rawLabel: entry.label, target: entry.target}))
    .sort((left, right) => compareText(left.rawLabel, right.rawLabel) || compareText(left.target, right.target));
  const title = `${category[0]!.toUpperCase()}${category.slice(1)} routes`;
  const displayLabel = (rawLabel: string, maximumBytes = 256): string => {
    const suffix = "…";
    if (byteLength(markdownText(rawLabel)) <= maximumBytes) return markdownText(rawLabel);
    let prefix = "";
    for (const character of rawLabel) {
      if (byteLength(markdownText(prefix + character + suffix)) > maximumBytes) break;
      prefix += character;
    }
    return markdownText(prefix + suffix);
  };
  const routeBody = (pagePath: string, heading: string, items: readonly RouteRef[]): string =>
    `# ${heading}\n\n${items.map(item => `- [${displayLabel(item.rawLabel)}](${item.target === "#" ? "#" : link(pagePath, item.target)})`).join("\n")}\n`;
  const checkAndStore = (pagePath: string, body: string, count: number): boolean => {
    const valid = byteLength(body) <= PORTABLE_MAP_BYTE_LIMITS.intermediateRoute && count <= 24;
    if (!valid) {
      diagnostics.push(diagnostic("page-too-large", "page", "A route page exceeds its fixed UTF-8 byte limit.", "route"));
    }
    pages.set(pagePath, body);
    return valid;
  };
  const renderLinks = (pagePath: string, heading: string, items: readonly RouteRef[]): void => {
    const body = routeBody(pagePath, heading, items);
    checkAndStore(pagePath, body, items.length);
  };
  if (sortedEntries.length === 0) {
    const firstPath = `${routePrefix}/${category}-001.md`;
    renderLinks(firstPath, title, [{rawLabel: "No pages were emitted for this category.", target: "#"}]);
    return {pages, firstPath};
  }
  const rangeLabel = (first: string, last: string): string => first === last ? first : `${first} .. ${last}`;
  const leafRefs: RouteRef[] = [];
  let leafStart = 0;
  while (leafStart < sortedEntries.length) {
    const leafOrdinal = String(leafRefs.length + 1).padStart(3, "0");
    const leafPath = `${routePrefix}/${category}-leaf-${leafOrdinal}.md`;
    const leafItems: RouteRef[] = [];
    while (leafStart < sortedEntries.length && leafItems.length < maxChildren) {
      const candidate = [...leafItems, sortedEntries[leafStart]!];
      if (leafItems.length > 0 && byteLength(routeBody(leafPath, title, candidate)) > PORTABLE_MAP_BYTE_LIMITS.intermediateRoute) break;
      leafItems.push(sortedEntries[leafStart]!);
      leafStart += 1;
    }
    // A single ordinary route label is always bounded by displayLabel. This
    // guard keeps the diagnostic metadata-only if a future label changes.
    renderLinks(leafPath, title, leafItems);
    leafRefs.push({rawLabel: rangeLabel(leafItems[0]!.rawLabel, leafItems.at(-1)!.rawLabel), target: leafPath});
  }
  let refs: RouteRef[] = leafRefs;
  let level = 0;
  const rootPath = `${routePrefix}/${category}-001.md`;
  while (refs.length > maxChildren || byteLength(routeBody(rootPath, `${title} directory`, refs)) > PORTABLE_MAP_BYTE_LIMITS.intermediateRoute) {
    const next: RouteRef[] = [];
    let groupStart = 0;
    while (groupStart < refs.length) {
      const branchOrdinal = String(next.length + 1).padStart(3, "0");
      const branchPath = `${routePrefix}/${category}-branch-${String(level + 1).padStart(2, "0")}-${branchOrdinal}.md`;
      const group: RouteRef[] = [];
      while (groupStart < refs.length && group.length < maxChildren) {
        const candidate = [...group, refs[groupStart]!];
        if (group.length > 0 && byteLength(routeBody(branchPath, `${title} branch ${level + 1}`, candidate)) > PORTABLE_MAP_BYTE_LIMITS.intermediateRoute) break;
        group.push(refs[groupStart]!);
        groupStart += 1;
      }
      renderLinks(branchPath, `${title} branch ${level + 1}`, group);
      next.push({rawLabel: rangeLabel(group[0]!.rawLabel, group.at(-1)!.rawLabel), target: branchPath});
    }
    refs = next;
    level += 1;
  }
  renderLinks(rootPath, `${title} directory`, refs);
  return {pages, firstPath: rootPath};
}

function searchPages(
  category: string,
  hits: readonly SearchHit[],
  generationId: string,
  diagnostics: PortableRenderDiagnostic[],
  rewrite: (text: string, pagePath: string) => string = text => text
): {pages: Map<string, string>; firstPath: string} {
  const pages = new Map<string, string>();
  const chunks: SearchHit[][] = [];
  let chunk: SearchHit[] = [];
  let bytes = 0;
  for (const hit of hits) {
    // The final page path is known from the chunk ordinal below only after
    // packing. Reserve a small link-growth margin here; the final check after
    // rendering remains authoritative.
    const hitBytes = byteLength(`${hit.text}\n`) + 256;
    if (hitBytes > PORTABLE_MAP_BYTE_LIMITS.searchHit) {
      diagnostics.push(diagnostic("page-too-large", "page", "A search result could not be bounded to one complete hit.", "searchHit"));
      continue;
    }
    if (chunk.length > 0 && bytes + hitBytes > PORTABLE_MAP_BYTE_LIMITS.searchShard) {
      chunks.push(chunk);
      chunk = [];
      bytes = 0;
    }
    chunk.push(hit);
    bytes += hitBytes;
  }
  if (chunk.length === 0) chunk.push({text: `No accepted ${category} records are available.`});
  chunks.push(chunk);
  chunks.forEach((items, index) => {
    const pagePath = `generations/${generationId}/search/${category}-${String(index + 1).padStart(3, "0")}.md`;
    const renderedHits = items.map(item => rewrite(item.text, pagePath));
    for (const text of renderedHits) {
      if (byteLength(text) > PORTABLE_MAP_BYTE_LIMITS.searchHit) diagnostics.push(diagnostic("page-too-large", "page", "A search result could not be bounded to one complete hit.", "searchHit"));
    }
    const body = `# ${category} search\n\n${renderedHits.join("\n")}\n`;
    if (byteLength(body) > PORTABLE_MAP_BYTE_LIMITS.searchShard) diagnostics.push(diagnostic("page-too-large", "page", "A search shard exceeds its fixed UTF-8 byte limit.", "searchShard"));
    pages.set(pagePath, body);
  });
  return {pages, firstPath: `generations/${generationId}/search/${category}-001.md`};
}

function jsonPages(
  records: readonly AnyRecord[],
  kind: "files" | "symbols" | "imports" | "relationships" | "details",
  generationId: string,
  sourceShardId: string,
  diagnostics: PortableRenderDiagnostic[]
): {pages: Map<string, string>; manifests: PortableGenerationManifest["inventoryShards"]} {
  const pages = new Map<string, string>();
  const manifests: PortableGenerationManifest["inventoryShards"] = [];
  const chunks: AnyRecord[][] = [];
  let chunk: AnyRecord[] = [];
  let bytes = 0;
  for (const record of records) {
    const single = byteLength(JSON.stringify(record));
    if (chunk.length > 0 && bytes + single + 128 > PORTABLE_MAP_BYTE_LIMITS.intermediateRoute) {
      chunks.push(chunk);
      chunk = [];
      bytes = 0;
    }
    chunk.push(record);
    bytes += single + 1;
  }
  if (chunk.length > 0) chunks.push(chunk);
  chunks.forEach((items, index) => {
    const shardId = `inv-${sourceShardId}-${kind}-${String(index + 1).padStart(3, "0")}`;
    const relativePath = `generations/${generationId}/data/${shardId}.json`;
    const body = `${JSON.stringify({generationId, shardId, recordKind: kind, records: items})}\n`;
    if (byteLength(body) > PORTABLE_MAP_BYTE_LIMITS.intermediateRoute) diagnostics.push(diagnostic("page-too-large", "page", "A structured inventory shard exceeds its fixed UTF-8 byte limit.", "data"));
    pages.set(relativePath, body);
    manifests.push({shardId, path: relativePath, recordKind: kind, recordCount: items.length, byteSize: byteLength(body), checksum: hashText(body)});
  });
  return {pages, manifests};
}

function mapOf<T extends {id: string}>(values: readonly T[]): Map<string, T> {
  return new Map(values.map(value => [value.id, value]));
}

/**
 * Render a validated model to an immutable portable bundle. This function is
 * deliberately in-memory: it does not read or write files, call tools, or
 * decide whether a publisher may commit the returned bytes.
 */
export function renderPortableMap(
  validated: PortableValidatedMapData,
  metadataInput: PortableRenderMetadata
): PortableRenderResult {
  const diagnostics: PortableRenderDiagnostic[] = [];
  const parsedMetadata = metadataSchema.safeParse(metadataInput);
  if (!parsedMetadata.success) return {ok: false, diagnostics: [diagnostic("invalid-metadata", "metadata", "Server-supplied generation metadata is invalid.", "metadata")]};
  const metadata = parsedMetadata.data;
  if (metadata.generationId !== validated.submission.generationId) {
    return {ok: false, diagnostics: [diagnostic("invalid-metadata", "metadata", "Generation metadata does not match the validated model.", "generationId")]};
  }
  const generationId = metadata.generationId;
  const records = mapRecords(validated.structuralShards);
  const structuralIds = new Set([
    ...records.files.map(item => item.id),
    ...records.symbols.map(item => item.id),
    ...records.imports.map(item => item.id),
    ...records.relationships.map(item => item.id),
    ...records.details.map(item => item.id)
  ]);
  const semanticIds = [
    ...validated.submission.semantic.capabilities.map(item => item.id),
    ...validated.submission.semantic.claims.map(item => item.id),
    ...validated.submission.semantic.aliases.map(item => item.id)
  ];
  if (semanticIds.some(id => structuralIds.has(id))) {
    return {ok: false, diagnostics: [diagnostic("duplicate-path", "bundle", "Structural and semantic identifiers must remain unambiguous.", "id")]};
  }
  const symbolsById = mapOf(records.symbols);
  const capabilitiesById = mapOf(validated.submission.semantic.capabilities);
  const aliases = sortBy(validated.submission.semantic.aliases, item => `${item.alias}\u0000${item.id}`);
  const sourcePathById = new Map<string, string>([
    ...records.files.map(item => [item.id, item.path] as const),
    ...records.symbols.map(item => [item.id, item.path] as const),
    ...records.imports.map(item => [item.id, item.sourcePath] as const),
    ...records.relationships.map(item => [item.id, item.sourcePath] as const)
  ]);

  const generationPrefix = `generations/${generationId}`;
  const pages = new Map<string, string>();
  const pageChecksums = new Map<string, string>();
  const allLocations = new Map<string, Location>();
  const structuralKindById = new Map<string, "file" | "symbol" | "import" | "relationship" | "detail">([
    ...records.files.map(record => [record.id, "file"] as const),
    ...records.symbols.map(record => [record.id, "symbol"] as const),
    ...records.imports.map(record => [record.id, "import"] as const),
    ...records.relationships.map(record => [record.id, "relationship"] as const),
    ...records.details.map(record => [record.id, "detail"] as const)
  ]);
  const detailValues = new Map<string, string>();
  for (const detail of records.details) {
    const key = `${detail.sourceRecordId}\u0000${detail.field}`;
    const parts = records.details.filter(item => item.sourceRecordId === detail.sourceRecordId && item.field === detail.field)
      .sort((left, right) => left.segmentIndex - right.segmentIndex);
    detailValues.set(key, parts.map(item => item.text).join(""));
  }

  // Detail pages are assigned first so structural records can link lossless
  // long names/signatures without embedding oversized values.
  const detailUnits: Unit[] = records.details.map(detail => ({
    id: detail.id,
    group: prefixFor(sourcePathById.get(detail.sourceRecordId) ?? detail.sourceRecordId),
    weight: byteLength(detail.text) + 500,
    render: pagePath => [
      `### ${recordAnchor("detail", detail.id)}`,
      `- source record: ${markdownText(detail.sourceRecordId)}`,
      `- field: ${detail.field}`,
      `- segment: ${detail.segmentIndex + 1}/${detail.segmentCount}`,
      ...(detail.previousSegmentId && allLocations.has(detail.previousSegmentId)
        ? [`- [Previous detail segment](${link(pagePath, allLocations.get(detail.previousSegmentId)!.path, allLocations.get(detail.previousSegmentId)!.anchor)})`]
        : []),
      ...(detail.nextSegmentId && allLocations.has(detail.nextSegmentId)
        ? [`- [Next detail segment](${link(pagePath, allLocations.get(detail.nextSegmentId)!.path, allLocations.get(detail.nextSegmentId)!.anchor)})`]
        : []),
      "",
      literalBlock(detail.text),
      ""
    ].join("\n")
  }));
  const detailResult = pageUnits(detailUnits, `${generationPrefix}/records/details`, PORTABLE_MAP_BYTE_LIMITS.recordPage, (pagePath, units) => {
    return `# Structural detail records\n\n${units.map(unit => unit.render(pagePath)).join("\n")}`;
  }, diagnostics, locations => {
    for (const [id, location] of locations) allLocations.set(id, {path: location.path, anchor: recordAnchor("detail", id)});
  });
  for (const [filePath, body] of detailResult.pages) pages.set(filePath, body);

  const recordUnits: Unit[] = [];
  for (const file of records.files) recordUnits.push({
    id: file.id, group: prefixFor(file.path), weight: byteLength(JSON.stringify(file)) + 500,
    render: pagePath => [
      `### ${recordAnchor("file", file.id)}`,
      `- path: ${literalBlock(file.path)}`,
      `- language: ${file.language}`,
      `- role: ${file.role}`,
      `- coverage: ${file.coverageStatus}`,
      `- parse: ${file.parseStatus}`,
      `- source hash: ${file.contentHash}`,
      ""
    ].join("\n")
  });
  for (const symbol of records.symbols) recordUnits.push({
    id: symbol.id, group: prefixFor(symbol.path), weight: byteLength(JSON.stringify(symbol)) + 700,
    render: pagePath => {
      const details = (symbol.detailReferences ?? []).map(reference => {
        const location = allLocations.get(reference.firstSegmentId);
        return location ? `- ${reference.field}: [lossless detail](${link(pagePath, location.path, location.anchor)})` : `- ${reference.field}: detail chain`;
      });
      return [
        `### ${recordAnchor("symbol", symbol.id)}`,
        `- name: ${symbol.qualifiedName ? literalBlock(symbol.qualifiedName) : "[lossless detail]"}`,
        `- kind: ${symbol.kind}`,
        `- source: ${markdownText(sourceLine(symbol))}`,
        `- exported: ${symbol.exported ? "yes" : "no"}`,
        `- content hash: ${symbol.contentHash}`,
        ...(symbol.signature ? [`- signature: ${literalBlock(symbol.signature)}`] : []),
        ...details,
        ""
      ].join("\n");
    }
  });
  for (const item of records.imports) recordUnits.push({
    id: item.id, group: prefixFor(item.sourcePath), weight: byteLength(JSON.stringify(item)) + 700,
    render: pagePath => {
      const targetFile = item.targetFileId ? allLocations.get(item.targetFileId) : undefined;
      const targetSymbol = item.targetSymbolId ? allLocations.get(item.targetSymbolId) : undefined;
      return [
        `### ${recordAnchor("import", item.id)}`,
        `- ${item.kind}: ${literalBlock(item.specifier)}`,
        `- source: ${markdownText(sourceLine(item))}`,
        `- resolution: ${item.resolutionStatus}${item.unresolvedReason ? ` (${item.unresolvedReason})` : ""}`,
        ...(targetFile ? [`- target file: [${markdownText(item.targetFileId!)}](${link(pagePath, targetFile.path, targetFile.anchor)})`] : []),
        ...(targetSymbol ? [`- target symbol: [${markdownText(item.targetSymbolId!)}](${link(pagePath, targetSymbol.path, targetSymbol.anchor)})`] : []),
        ""
      ].join("\n");
    }
  });
  for (const item of records.relationships) recordUnits.push({
    id: item.id, group: prefixFor(item.sourcePath), weight: byteLength(JSON.stringify(item)) + 700,
    render: pagePath => {
      const source = item.sourceSymbolId ? allLocations.get(item.sourceSymbolId) : undefined;
      const targetFile = item.targetFileId ? allLocations.get(item.targetFileId) : undefined;
      const targetSymbol = item.targetSymbolId ? allLocations.get(item.targetSymbolId) : undefined;
      return [
        `### ${recordAnchor("relationship", item.id)}`,
        `- kind: ${item.kind}`,
        `- source: ${markdownText(sourceLine(item))}`,
        `- resolution: ${item.resolutionStatus}${item.unresolvedReason ? ` (${item.unresolvedReason})` : ""}`,
        ...(source ? [`- source symbol: [${markdownText(item.sourceSymbolId!)}](${link(pagePath, source.path, source.anchor)})`] : []),
        ...(targetFile ? [`- target file: [${markdownText(item.targetFileId!)}](${link(pagePath, targetFile.path, targetFile.anchor)})`] : []),
        ...(targetSymbol ? [`- target symbol: [${markdownText(item.targetSymbolId!)}](${link(pagePath, targetSymbol.path, targetSymbol.anchor)})`] : []),
        ""
      ].join("\n");
    }
  });
  const recordResult = pageUnits(recordUnits, `${generationPrefix}/records`, PORTABLE_MAP_BYTE_LIMITS.recordPage, (pagePath, units, locations) => {
    return `# Structural records\n\n${units.map(unit => unit.render(pagePath)).join("\n")}`;
  }, diagnostics, locations => {
    for (const [id, location] of locations) {
      const kind = structuralKindById.get(id);
      if (kind && kind !== "detail") allLocations.set(id, {path: location.path, anchor: recordAnchor(kind, id)});
    }
  });
  for (const [filePath, body] of recordResult.pages) pages.set(filePath, body);

  const claimUnits: Unit[] = validated.submission.semantic.claims.map((claim: PortableClaim) => ({
    id: claim.id,
    group: prefixFor(claim.evidence[0]?.path ?? claim.id),
    weight: byteLength(JSON.stringify(claim)) + 600,
    render: pagePath => [
      `### ${recordAnchor("claim", claim.id)}`,
      `- basis: ${claim.basis}`,
      "",
      markdownText(claim.statement),
      "",
      "Evidence:",
      ...claim.evidence.map(item => `- ${item.kind}: ${markdownText(sourcePathById.get(item.recordId) ?? item.path)}${item.coordinate ? `:${coordinate(item.coordinate)}` : ""}`),
      ""
    ].join("\n")
  }));
  const claimResult = pageUnits(claimUnits, `${generationPrefix}/capabilities/claims`, PORTABLE_MAP_BYTE_LIMITS.capabilityPage, (pagePath, units) => `# Accepted claims\n\n${units.map(unit => unit.render(pagePath)).join("\n")}`, diagnostics);
  for (const [filePath, body] of claimResult.pages) pages.set(filePath, body);
  for (const [id, location] of claimResult.locations) allLocations.set(id, {path: location.path, anchor: recordAnchor("claim", id)});

  const capabilityUnits: Unit[] = validated.submission.semantic.capabilities.map((capability: PortableCapability) => ({
    id: capability.id,
    group: prefixFor(capability.evidence[0]?.path ?? capability.id),
    weight: byteLength(JSON.stringify(capability)) + 800,
    render: pagePath => [
      `### ${recordAnchor("capability", capability.id)}`,
      `## ${markdownText(capability.name)}`,
      "",
      markdownText(capability.summary),
      "",
      "Claims:",
      ...capability.claimIds.map(claimId => {
        const location = allLocations.get(claimId);
        return location ? `- [${markdownText(claimId)}](${link(pagePath, location.path, location.anchor)})` : `- ${markdownText(claimId)}`;
      }),
      "",
      "Evidence:",
      ...capability.evidence.map(item => `- ${item.kind}: ${markdownText(sourcePathById.get(item.recordId) ?? item.path)}${item.coordinate ? `:${coordinate(item.coordinate)}` : ""}`),
      ""
    ].join("\n")
  }));
  const capabilityResult = pageUnits(capabilityUnits, `${generationPrefix}/capabilities`, PORTABLE_MAP_BYTE_LIMITS.capabilityPage, (pagePath, units) => `# Accepted capabilities\n\n${units.map(unit => unit.render(pagePath)).join("\n")}`, diagnostics);
  for (const [filePath, body] of capabilityResult.pages) pages.set(filePath, body);
  for (const [id, location] of capabilityResult.locations) allLocations.set(id, {path: location.path, anchor: recordAnchor("capability", id)});

  const exceptionUnits: Unit[] = [];
  const makeSearchLink = (id: string): string => `RECORDREF-${id}`;
  const fileHits: SearchHit[] = records.files.map(file => {
    const plain = `file | ${escapedField(file.path)} | language: ${file.language} | role: ${file.role} | coverage: ${file.coverageStatus} | source: ${escapedField(sourceLine(file))} | record: ${makeSearchLink(file.id)}`;
    if (byteLength(plain) <= SEARCH_HIT_SAFE_BYTES) return {text: plain};
    const detailId = `exception-file-${file.id}`;
    exceptionUnits.push({id: detailId, group: prefixFor(file.path), weight: byteLength(file.path) + 600, render: pagePath => `### ${detailId}\n\n- kind: file\n- complete path:\n\n${literalBlock(file.path)}\n`});
    return {text: `file | exceptional path | coverage: ${file.coverageStatus} | record: ${makeSearchLink(file.id)} | details: EXCEPTION-${detailId}`, detail: {id: detailId, label: "file path", value: file.path}};
  });
  const symbolHits: SearchHit[] = records.symbols.map(symbol => {
    const name = symbol.qualifiedName ?? detailValues.get(`${symbol.id}\u0000qualifiedName`) ?? "";
    const plain = `symbol | ${escapedField(name)} | ${escapedField(symbol.path)} | kind: ${symbol.kind} | source: ${escapedField(sourceLine(symbol))} | record: ${makeSearchLink(symbol.id)}`;
    if (symbol.qualifiedName && byteLength(plain) <= SEARCH_HIT_SAFE_BYTES) return {text: plain};
    const detailId = `exception-symbol-${symbol.id}`;
    exceptionUnits.push({id: detailId, group: prefixFor(symbol.path), weight: byteLength(name) + 800, render: pagePath => `### ${detailId}\n\n- kind: symbol\n- complete name (lossless details):\n\n${literalBlock(name)}\n- source: ${literalBlock(symbol.path)}\n`});
    return {text: `symbol | exceptional literal prefix: ${escapedField(boundedLiteralPrefix(name))} | kind: ${symbol.kind} | record: ${makeSearchLink(symbol.id)} | lossless name details: EXCEPTION-${detailId}`, detail: {id: detailId, label: "lossless symbol name", value: name}};
  });
  const aliasHits: SearchHit[] = aliases.map((alias: PortableAlias) => {
    const target = alias.targetKind === "symbol" ? symbolsById.get(alias.targetId)?.qualifiedName ?? alias.targetId : capabilitiesById.get(alias.targetId)?.name ?? alias.targetId;
    const targetId = alias.targetId;
    const plain = `alias | ${escapedField(alias.alias)} | target: ${escapedField(target)} | record: ${makeSearchLink(targetId)} | source: ${escapedField(alias.evidence[0]?.path ?? "unknown")}`;
    if (byteLength(plain) <= SEARCH_HIT_SAFE_BYTES) return {text: plain};
    const detailId = `exception-alias-${alias.id}`;
    exceptionUnits.push({id: detailId, group: prefixFor(alias.evidence[0]?.path ?? alias.id), weight: byteLength(alias.alias) + 700, render: pagePath => `### ${detailId}\n\n- kind: alias\n- complete alias:\n\n${literalBlock(alias.alias)}\n`});
    return {text: `alias | exceptional term | target: ${escapedField(target)} | record: ${makeSearchLink(targetId)} | details: EXCEPTION-${detailId}`, detail: {id: detailId, label: "alias", value: alias.alias}};
  });
  const exceptionResult = pageUnits(exceptionUnits, `${generationPrefix}/records/exceptions`, PORTABLE_MAP_BYTE_LIMITS.recordPage, (pagePath, units) => `# Exceptional structural terms\n\n${units.map(unit => unit.render(pagePath)).join("\n")}`, diagnostics);
  for (const [filePath, body] of exceptionResult.pages) pages.set(filePath, body);
  const rewriteSearchText = (text: string, pagePath: string): string => {
    let rewritten = text.replace(/RECORDREF-([a-z0-9_-]+)/g, (_match, id: string) => {
      const location = allLocations.get(id);
      return location ? link(pagePath, location.path, location.anchor) : "#";
    });
    rewritten = rewritten.replace(/EXCEPTION-([a-z0-9_-]+)/g, (_match, id: string) => {
      const location = exceptionResult.locations.get(id);
      return location ? link(pagePath, location.path, location.anchor) : "#";
    });
    return rewritten;
  };
  const searchFileResult = searchPages("files", fileHits, generationId, diagnostics, rewriteSearchText);
  const searchSymbolResult = searchPages("symbols", symbolHits, generationId, diagnostics, rewriteSearchText);
  const searchAliasResult = searchPages("aliases", aliasHits, generationId, diagnostics, rewriteSearchText);
  for (const [filePath, body] of [...searchFileResult.pages, ...searchSymbolResult.pages, ...searchAliasResult.pages]) pages.set(filePath, body);

  const dataPages = new Map<string, string>();
  const inventoryShards: PortableGenerationManifest["inventoryShards"] = [];
  for (const [kind, values] of [["files", records.files], ["symbols", records.symbols], ["imports", records.imports], ["relationships", records.relationships], ["details", records.details]] as const) {
    const result = jsonPages(values, kind, generationId, "all", diagnostics);
    for (const [filePath, body] of result.pages) dataPages.set(filePath, body);
    inventoryShards.push(...result.manifests);
  }
  // Semantic records are first-class structured data as well as rendered
  // prose. Each fragment keeps a complete canonical record shape with a
  // complete evidence-item slice. A consumer reconstructs one record by
  // grouping `recordId`, sorting `evidenceStart`, and concatenating evidence.
  // The manifest checksums every shard; `continuation` and semantic-index.json
  // provide deterministic linkable navigation without hashing a page from
  // inside itself.
  type SemanticKind = PortableSemanticRecordKind;
  type SemanticRecord = PortableCapability | PortableClaim | PortableAlias;
  type SemanticPart = Omit<PortableSemanticFragment, "continuation">;
  const semanticRecords: Array<{kind: SemanticKind; record: SemanticRecord}> = [
    ...sortBy(validated.submission.semantic.capabilities, item => item.id).map(record => ({kind: "capability" as const, record})),
    ...sortBy(validated.submission.semantic.claims, item => item.id).map(record => ({kind: "claim" as const, record})),
    ...sortBy(validated.submission.semantic.aliases, item => item.id).map(record => ({kind: "alias" as const, record}))
  ];
  const semanticContinuationProbe: PortableSemanticContinuation = {
    previous: `${generationPrefix}/data/semantic-999.json`,
    next: `${generationPrefix}/data/semantic-999.json`
  };
  const semanticParts: SemanticPart[] = [];
  for (const item of semanticRecords) {
    let evidenceStart = 0;
    const partStarts: number[] = [];
    while (evidenceStart < item.record.evidence.length) {
      partStarts.push(evidenceStart);
      let evidenceEnd = evidenceStart;
      while (evidenceEnd < item.record.evidence.length) {
        const candidate: SemanticPart = {
          kind: item.kind,
          recordId: item.record.id,
          evidenceStart,
          evidenceCount: evidenceEnd + 1 - evidenceStart,
          partIndex: partStarts.length - 1,
          partCount: 1,
          record: {...item.record, evidence: item.record.evidence.slice(evidenceStart, evidenceEnd + 1)}
        };
        const probe = JSON.stringify({version: PORTABLE_SEMANTIC_DATA_VERSION, generationId, shardId: "semantic-000", records: [{...candidate, continuation: semanticContinuationProbe}]});
        if (byteLength(probe) > PORTABLE_MAP_BYTE_LIMITS.recordPage - 512 && evidenceEnd > evidenceStart) break;
        evidenceEnd += 1;
      }
      if (evidenceEnd === evidenceStart) {
        diagnostics.push(diagnostic("page-too-large", "page", "A semantic evidence item could not be bounded to one complete record fragment.", "semanticData"));
        break;
      }
      semanticParts.push({
        kind: item.kind,
        recordId: item.record.id,
        evidenceStart,
        evidenceCount: evidenceEnd - evidenceStart,
        partIndex: partStarts.length - 1,
        partCount: 0,
        record: {...item.record, evidence: item.record.evidence.slice(evidenceStart, evidenceEnd)}
      });
      evidenceStart = evidenceEnd;
    }
  }
  const partsByRecord = new Map<string, SemanticPart[]>();
  for (const part of semanticParts) {
    const key = `${part.kind}\u0000${part.recordId}`;
    const existing = partsByRecord.get(key) ?? [];
    existing.push(part);
    partsByRecord.set(key, existing);
  }
  for (const parts of partsByRecord.values()) for (const [index, part] of parts.entries()) {
    part.partIndex = index;
    part.partCount = parts.length;
  }
  const semanticShardChunks: SemanticPart[][] = [];
  let semanticChunk: SemanticPart[] = [];
  for (const part of semanticParts) {
    const probeRecords = [...semanticChunk, part];
    const probe = JSON.stringify({version: PORTABLE_SEMANTIC_DATA_VERSION, generationId, shardId: "semantic-000", records: probeRecords.map(candidate => ({...candidate, continuation: semanticContinuationProbe}))});
    if (semanticChunk.length > 0 && byteLength(probe) > PORTABLE_MAP_BYTE_LIMITS.recordPage - 512) {
      semanticShardChunks.push(semanticChunk);
      semanticChunk = [];
    }
    semanticChunk.push(part);
  }
  if (semanticChunk.length > 0) semanticShardChunks.push(semanticChunk);
  const semanticPartPaths = new Map<SemanticPart, string>();
  semanticShardChunks.forEach((chunk, index) => {
    const shardId = `semantic-${String(index + 1).padStart(3, "0")}`;
    const filePath = `${generationPrefix}/data/${shardId}.json`;
    for (const part of chunk) semanticPartPaths.set(part, filePath);
  });
  const semanticPartFor = (part: SemanticPart, offset: -1 | 1): SemanticPart | undefined => {
    const parts = partsByRecord.get(`${part.kind}\u0000${part.recordId}`) ?? [];
    const target = parts[part.partIndex + offset];
    return target;
  };
  semanticShardChunks.forEach((chunk, index) => {
    const shardId = `semantic-${String(index + 1).padStart(3, "0")}`;
    const filePath = `${generationPrefix}/data/${shardId}.json`;
    const recordsForPage = chunk.map(part => ({
      ...part,
      continuation: {
        previous: semanticPartFor(part, -1) ? semanticPartPaths.get(semanticPartFor(part, -1)!) ?? null : null,
        next: semanticPartFor(part, 1) ? semanticPartPaths.get(semanticPartFor(part, 1)!) ?? null : null
      }
    }));
    const body = `${JSON.stringify({version: PORTABLE_SEMANTIC_DATA_VERSION, generationId, shardId, records: recordsForPage})}\n`;
    if (byteLength(body) > PORTABLE_MAP_BYTE_LIMITS.recordPage) diagnostics.push(diagnostic("page-too-large", "page", "A semantic data shard exceeds its fixed UTF-8 byte limit.", "semanticData"));
    dataPages.set(filePath, body);
  });
  const semanticIndexEntries: PortableSemanticIndexEntry[] = semanticRecords.map(item => {
    const parts = partsByRecord.get(`${item.kind}\u0000${item.record.id}`) ?? [];
    return {
      kind: item.kind,
      recordId: item.record.id,
      firstPath: parts[0] ? semanticPartPaths.get(parts[0]) ?? null : null,
      partCount: parts.length,
      evidenceCount: item.record.evidence.length,
      contentHash: hashText(JSON.stringify(item.record))
    };
  });
  const semanticIndexChunks: PortableSemanticIndexEntry[][] = [];
  let semanticIndexChunk: PortableSemanticIndexEntry[] = [];
  for (const entry of semanticIndexEntries) {
    const probeEntries = [...semanticIndexChunk, entry];
    const probe = JSON.stringify({version: PORTABLE_SEMANTIC_DATA_VERSION, generationId, shardId: "semantic-index-000", entries: probeEntries, continuation: {previous: null, next: null}});
    if (semanticIndexChunk.length > 0 && byteLength(probe) > PORTABLE_MAP_BYTE_LIMITS.recordPage - 512) {
      semanticIndexChunks.push(semanticIndexChunk);
      semanticIndexChunk = [];
    }
    semanticIndexChunk.push(entry);
  }
  if (semanticIndexChunk.length > 0 || semanticIndexChunks.length === 0) semanticIndexChunks.push(semanticIndexChunk);
  semanticIndexChunks.forEach((entries, index) => {
    const shardId = `semantic-index-${String(index + 1).padStart(3, "0")}`;
    const filePath = `${generationPrefix}/data/${shardId}.json`;
    const continuation: PortableSemanticContinuation = {
      previous: index > 0 ? `${generationPrefix}/data/semantic-index-${String(index).padStart(3, "0")}.json` : null,
      next: index + 1 < semanticIndexChunks.length ? `${generationPrefix}/data/semantic-index-${String(index + 2).padStart(3, "0")}.json` : null
    };
    const body = `${JSON.stringify({version: PORTABLE_SEMANTIC_DATA_VERSION, generationId, shardId, entries, continuation})}\n`;
    if (byteLength(body) > PORTABLE_MAP_BYTE_LIMITS.recordPage) diagnostics.push(diagnostic("page-too-large", "page", "A semantic index exceeds its fixed UTF-8 byte limit.", "semanticData"));
    dataPages.set(filePath, body);
  });
  for (const [filePath, body] of dataPages) pages.set(filePath, body);

  const compatibilityEntries = CODEBASE_DOCUMENT_IDS.map(id => ({label: `${id.toUpperCase()}.md`, target: `${generationPrefix}/compatibility/${id.toUpperCase()}.md`}));
  for (const id of CODEBASE_DOCUMENT_IDS) pages.set(`${generationPrefix}/compatibility/${id.toUpperCase()}.md`, validated.compiledDocuments[id]);

  const pageRange = (target: string): string => target.match(/-(\d{3})\.(?:md|json)$/)?.[1] ?? "001";
  const groupName = (group: string | undefined): string => group && group !== "." ? group : "repository root";
  const groupedEntries = (targets: readonly string[], groups: ReadonlyMap<string, string>, scope: string) => targets.map(target => ({
    label: `${scope} path prefix ${groupName(groups.get(target))} range ${pageRange(target)}`,
    target
  }));
  const capabilityNamesByPage = new Map<string, string[]>();
  for (const capability of validated.submission.semantic.capabilities) {
    const location = capabilityResult.locations.get(capability.id);
    if (!location) continue;
    const names = capabilityNamesByPage.get(location.path) ?? [];
    names.push(capability.name);
    capabilityNamesByPage.set(location.path, names);
  }
  const namedCapabilityEntries = [...capabilityResult.pages.keys()].map(target => {
    const names = capabilityNamesByPage.get(target) ?? [];
    const concept = names.length > 0 ? boundedLiteralPrefix(names.join(" | "), 180) : "unlabelled capability";
    return {label: `capability ${concept} path prefix ${groupName(capabilityResult.groups.get(target))} range ${pageRange(target)}`, target};
  });
  const recordEntries = [
    ...groupedEntries([...recordResult.pages.keys()], recordResult.groups, "structural records"),
    ...groupedEntries([...detailResult.pages.keys()], detailResult.groups, "lossless details"),
    ...groupedEntries([...exceptionResult.pages.keys()], exceptionResult.groups, "exceptional terms")
  ];
  const capabilityEntries = [
    ...namedCapabilityEntries,
    ...groupedEntries([...claimResult.pages.keys()], claimResult.groups, "claim")
  ];
  const searchEntries = [...searchFileResult.pages.keys(), ...searchSymbolResult.pages.keys(), ...searchAliasResult.pages.keys()].map(target => ({label: `search shard ${path.posix.basename(target)}`, target}));
  const dataEntries = [...dataPages.keys()].map(target => ({label: `structured data ${path.posix.basename(target)}`, target}));
  const routeRecords = routePages("records", recordEntries, generationId, diagnostics);
  const routeCapabilities = routePages("capabilities", capabilityEntries, generationId, diagnostics);
  const routeSearch = routePages("search", searchEntries, generationId, diagnostics);
  const routeData = routePages("data", dataEntries, generationId, diagnostics);
  const routeCompatibility = routePages("compatibility", compatibilityEntries, generationId, diagnostics);
  for (const [filePath, body] of [...routeRecords.pages, ...routeCapabilities.pages, ...routeSearch.pages, ...routeData.pages, ...routeCompatibility.pages]) pages.set(filePath, body);

  const rootRouteEntries = [
    {label: "capabilities", target: routeCapabilities.firstPath},
    {label: "records", target: routeRecords.firstPath},
    {label: "search", target: routeSearch.firstPath},
    {label: "structured data", target: routeData.firstPath},
    {label: "seven compatibility views", target: routeCompatibility.firstPath}
  ];
  const rootRoutePath = `${generationPrefix}/routes/root-001.md`;
  const rootRoute = `# Portable map routes\n\n${rootRouteEntries.map(item => `- [${item.label}](${link(rootRoutePath, item.target)})`).join("\n")}\n\nStructural coverage is separate from semantic coverage. The baseline is current-tree-unverified.\n`;
  pages.set(rootRoutePath, rootRoute);
  if (byteLength(rootRoute) > PORTABLE_MAP_BYTE_LIMITS.intermediateRoute) diagnostics.push(diagnostic("page-too-large", "page", "The root route exceeds its fixed UTF-8 byte limit.", "rootRoute"));

  const structuralCoverage = {
    filesInventoried: records.files.length,
    filesWithFullCoverage: records.files.filter(item => item.coverageStatus === "full").length,
    filesWithFileCoverage: records.files.filter(item => item.coverageStatus === "file").length,
    symbolsExtracted: records.symbols.length,
    importsExtracted: records.imports.length,
    relationshipsExtracted: records.relationships.length
  };
  const evidenceDependencies = collectEvidence(validated);
  const semanticCoverage = {
    capabilitiesAccepted: validated.submission.semantic.capabilities.length,
    claimsAccepted: validated.submission.semantic.claims.length,
    aliasesAccepted: validated.submission.semantic.aliases.length,
    evidenceDependencies: evidenceDependencies.length
  };

  const generationPages = [...pages.entries()].sort((left, right) => compareText(left[0], right[0]));
  for (const [filePath, body] of generationPages) {
    if (!safePath(filePath)) diagnostics.push(diagnostic("invalid-path", "bundle", "A generated bundle path is invalid.", "path"));
    pageChecksums.set(filePath, hashText(body));
  }
  const entryPath = `${generationPrefix}/ENTRY.md`;
  const manifestPath = `${generationPrefix}/manifest.json`;
  const entryBody = [
    "# Portable Codebase Map Entry",
    "",
    `Generation: ${generationId}`,
    "",
    "This entry is an immutable copy of the source-owned navigation protocol. Structural coverage and semantic coverage are separate; the generated baseline is current-tree-unverified.",
    "",
    "## Navigation protocol",
    "",
    ...PORTABLE_MAP_NAVIGATION_PROTOCOL.map((item, index) => `${index + 1}. ${item}`),
    "",
    `- [Map routes](${link(entryPath, rootRoutePath)})`,
    `- [Seven compatibility views](${link(entryPath, routeCompatibility.firstPath)})`,
    `- [Manifest](manifest.json)`,
    ""
  ].join("\n");
  if (byteLength(entryBody) > PORTABLE_MAP_BYTE_LIMITS.entry) diagnostics.push(diagnostic("page-too-large", "page", "ENTRY exceeds its fixed UTF-8 byte limit.", "entry"));
  const entryHash = hashText(entryBody);
  const compatibilityHashes = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, hashText(validated.compiledDocuments[id])])) as Record<CodebaseDocumentId, string>;
  const manifestCandidate: PortableGenerationManifest = {
    formatVersion: PORTABLE_MAP_FORMAT_VERSION,
    protocolVersion: PORTABLE_MAP_PROTOCOL_VERSION,
    generationId,
    generatedAt: metadata.generatedAt,
    gitCommit: metadata.gitCommit,
    inventoryFingerprint: metadata.inventoryFingerprint,
    structuralCoverage,
    semanticCoverage,
    parserAssets: [...metadata.parserAssets].sort((left, right) => compareText(`${left.name}\u0000${left.version}`, `${right.name}\u0000${right.version}`)),
    inventoryShards: inventoryShards.sort((left, right) => compareText(left.path, right.path)),
    checksums: {
      entry: entryHash,
      pages: [...pageChecksums.entries()].map(([filePath, checksum]) => ({path: filePath, checksum})),
      compatibility: compatibilityHashes
    },
    evidenceDependencies,
    predecessorGenerationId: metadata.predecessorGenerationId ?? metadata.predecessorPublicationProof?.generationId ?? null,
    ...(metadata.predecessorPublicationProof ? {predecessorPublicationProof: metadata.predecessorPublicationProof} : {})
  };
  const manifestValidation = portableGenerationManifestSchema.safeParse(manifestCandidate);
  if (!manifestValidation.success) return {ok: false, diagnostics: [diagnostic("invalid-manifest", "manifest", "The rendered generation manifest failed its fixed contract.", "manifest")]};
  const manifestBody = `${JSON.stringify(manifestValidation.data)}\n`;
  const manifestHash = hashText(manifestBody);

  const rootIndexPath = "INDEX.md";
  const rootDescriptor = serializePortableRootDescriptor({
    version: PORTABLE_ROOT_DESCRIPTOR_VERSION,
    generationId,
    manifest: {path: manifestPath, sha256: manifestHash},
    entry: {path: entryPath, sha256: entryHash}
  });
  const rootIndexBody = [
    "# Portable Codebase Map",
    "",
    rootDescriptor,
    "",
    `Active generation: ${generationId}`,
    "",
    "Use this file as the ordinary entrypoint for repository understanding. The map is generated evidence; repository instructions and current source retain authority.",
    "",
    "## Coverage",
    "",
    `- structural coverage: ${structuralCoverage.filesWithFullCoverage} full, ${structuralCoverage.filesWithFileCoverage} file-only, ${structuralCoverage.symbolsExtracted} declarations`,
    `- semantic coverage: ${semanticCoverage.capabilitiesAccepted} capabilities, ${semanticCoverage.claimsAccepted} claims, ${semanticCoverage.aliasesAccepted} aliases`,
    "- baseline: current-tree-unverified",
    "",
    "## Use the bundle",
    "",
    `- [Navigation entry](${link(rootIndexPath, entryPath)})`,
    `- [Map routes](${link(rootIndexPath, rootRoutePath)})`,
    "",
    "## Navigation protocol",
    "",
    ...PORTABLE_MAP_NAVIGATION_PROTOCOL.map((item, index) => `${index + 1}. ${item}`),
    "",
    "## Sealed references",
    "",
    `- ENTRY sha256: ${entryHash}`,
    `- manifest sha256: ${manifestHash}`,
    `- [immutable ENTRY](${link(rootIndexPath, entryPath)})`,
    `- [sealed manifest](${link(rootIndexPath, manifestPath)})`,
    ""
  ].join("\n");
  if (byteLength(rootIndexBody) > PORTABLE_MAP_BYTE_LIMITS.index) diagnostics.push(diagnostic("page-too-large", "page", "INDEX exceeds its fixed UTF-8 byte limit.", "index"));

  // Validate every emitted text surface after escaping/encoding and before
  // exposing bytes to a publisher. Diagnostics retain only fixed metadata.
  const candidateTextFiles: Array<[string, string]> = [
    [rootIndexPath, rootIndexBody],
    [entryPath, entryBody],
    [manifestPath, manifestBody],
    ...generationPages,
    ...CODEBASE_DOCUMENT_IDS.map(id => [id.toUpperCase() + ".md", validated.compiledDocuments[id]] as [string, string])
  ];
  for (const [_filePath, body] of candidateTextFiles) {
    if (!inspectContentBoundaries(body).safe) diagnostics.push(diagnostic("unsafe-content", "page", "Rendered bundle content crossed a content boundary.", "content"));
  }

  if (diagnostics.length > 0) return {ok: false, diagnostics: diagnostics.slice(0, 128)};

  const textFiles = new Map<string, string>([
    [rootIndexPath, rootIndexBody],
    [entryPath, entryBody],
    [manifestPath, manifestBody],
    ...generationPages,
    ...CODEBASE_DOCUMENT_IDS.map(id => [id.toUpperCase() + ".md", validated.compiledDocuments[id]] as const)
  ]);
  const fileBytes: Record<string, Uint8Array> = {};
  const checksums: Record<string, string> = {};
  const renderedFiles: PortableRenderedFile[] = [];
  for (const [filePath, body] of [...textFiles.entries()].sort((left, right) => compareText(left[0], right[0]))) {
    const bytes = utf8(body);
    fileBytes[filePath] = bytes;
    checksums[filePath] = hashBytes(bytes);
    renderedFiles.push({path: filePath, bytes, checksum: checksums[filePath]!});
  }
  const sealedGeneration: PortableSealedGenerationReference = {
    generationId,
    manifest: {path: manifestPath, checksum: manifestHash},
    entry: {path: entryPath, checksum: entryHash}
  };
  const rootViewBytes = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id.toUpperCase() + ".md", utf8(validated.compiledDocuments[id])])) as PortableRenderSuccess["rootViewBytes"];
  return {
    ok: true,
    files: fileBytes,
    bytes: fileBytes,
    checksums,
    renderedFiles,
    rootIndexBytes: fileBytes[rootIndexPath]!,
    entryBytes: fileBytes[entryPath]!,
    manifest: manifestValidation.data,
    sealedGeneration,
    rootIndexHash: checksums[rootIndexPath]!,
    rootViewBytes
  };
}

export const renderPortableBundle = renderPortableMap;
export const renderPortableCodebaseMap = renderPortableMap;
