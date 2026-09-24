import {createHash} from "node:crypto";
import path from "node:path";

import {
  PORTABLE_MAP_MAX_STRUCTURAL_DETAIL_SEGMENT_BYTES,
  portableFileRecordSchema,
  portableImportRelationshipSchema,
  portableRelationshipRecordSchema,
  portableStructuralDetailRecordSchema,
  portableSymbolRecordSchema,
  type PortableFileRecord,
  type PortableImportRelationship,
  type PortableLanguage,
  type PortableRelationshipRecord,
  type PortableSourceCoordinate,
  type PortableStructuralDetailRecord,
  type PortableSymbolKind,
  type PortableSymbolRecord
} from "../contracts.js";
import {inspectContentBoundaries} from "../content-boundary.js";
import {
  withParsedSource,
  type SyntaxNodeView,
  type SyntaxTreeView
} from "../parser-runtime.js";

/** Python extraction is tied to the bundled grammar and its parser contract. */
export const PYTHON_ADAPTER_RULE_VERSION = "python-declarations-v1/tree-sitter-0.27.0" as const;
export const PYTHON_ADAPTER_SUPPORTED_LANGUAGES = ["python"] as const;
export const PYTHON_ADAPTER_MAX_FILE_BYTES = 1 * 1024 * 1024;

type PythonLanguage = typeof PYTHON_ADAPTER_SUPPORTED_LANGUAGES[number];

export type PythonAdapterInput = {
  readonly file: PortableFileRecord;
  readonly source: Uint8Array;
  readonly knownFiles?: readonly PortableFileRecord[];
};

export type PythonAdapterDiagnosticCode =
  | "source-mismatch"
  | "unsupported-language"
  | "too-large"
  | "invalid-utf8"
  | "unsafe-content"
  | "parse-error"
  | "unsupported-construct"
  | "invalid-output";

export type PythonAdapterDiagnostic = {
  readonly code: PythonAdapterDiagnosticCode;
  readonly message: string;
};

export type PythonAdapterSuccess = {
  readonly ok: true;
  readonly status: "complete" | "partial";
  readonly file: PortableFileRecord;
  readonly symbols: readonly PortableSymbolRecord[];
  readonly imports: readonly PortableImportRelationship[];
  readonly relationships: readonly PortableRelationshipRecord[];
  readonly details: readonly PortableStructuralDetailRecord[];
  readonly diagnostics: readonly PythonAdapterDiagnostic[];
  readonly ruleVersion: typeof PYTHON_ADAPTER_RULE_VERSION;
};

export type PythonAdapterFailure = {
  readonly ok: false;
  readonly status: "stale" | "unsupported" | "invalid";
  readonly file: PortableFileRecord;
  readonly symbols: readonly [];
  readonly imports: readonly [];
  readonly relationships: readonly [];
  readonly details: readonly [];
  readonly diagnostics: readonly PythonAdapterDiagnostic[];
  readonly ruleVersion: typeof PYTHON_ADAPTER_RULE_VERSION;
};

export type PythonAdapterResult = PythonAdapterSuccess | PythonAdapterFailure;

type DeclarationCandidate = {
  readonly node: SyntaxNodeView;
  readonly kind: PortableSymbolKind;
  readonly name: string;
  readonly signature: string | undefined;
  readonly signatureSupported: boolean;
  readonly exported: boolean;
  readonly parent: DeclarationCandidate | null;
  readonly startByte: number;
  ordinal: number;
  qualifiedName?: string;
  id?: string;
};

type Resolution = {
  readonly resolutionStatus: "resolved" | "unresolved" | "ambiguous" | "unsupported";
  readonly targetFileId: string | null;
  readonly targetSymbolId: string | null;
  readonly unresolvedReason?: "dynamic-import" | "reflection" | "dependency-injection" | "dynamic-dispatch" | "ambiguous-module" | "unsupported-resolution" | "missing-target" | "parse-error" | "external-dependency" | "unknown";
  readonly certainty: "observed" | "supported-inference" | "unknown";
};

type MutableRecords = {
  symbols: PortableSymbolRecord[];
  imports: PortableImportRelationship[];
  relationships: PortableRelationshipRecord[];
  details: PortableStructuralDetailRecord[];
};

const compareBySource = (left: {startByte: number}, right: {startByte: number}): number =>
  left.startByte - right.startByte;

function digest(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableId(prefix: string, value: string): string {
  return `${prefix}${digest(value).slice(0, 32)}`;
}

function languageSupported(value: PortableLanguage): value is PythonLanguage {
  return (PYTHON_ADAPTER_SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

function firstNamed(node: SyntaxNodeView, ...types: string[]): SyntaxNodeView | null {
  for (const child of node.namedChildren) {
    if (types.includes(child.type)) return child;
  }
  return null;
}

function bytesToText(source: Uint8Array, start: number, end: number): string {
  return new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(source.slice(start, end));
}

function nodeText(source: Uint8Array, node: SyntaxNodeView | null): string {
  return node ? bytesToText(source, node.coordinate.start.byte, node.coordinate.end.byte) : "";
}

function trimSpace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

type Rendered = {text: string; supported: boolean};
const rendered = (text: string, supported = true): Rendered => ({text, supported});

function renderPythonType(source: Uint8Array, node: SyntaxNodeView | null): Rendered {
  if (!node) return rendered("", true);
  const children = node.namedChildren;
  if (node.type === "type") return renderPythonType(source, children[0] ?? null);
  if (["identifier", "dotted_name", "attribute", "keyword", "none", "true", "false"].includes(node.type)) {
    if (node.type === "attribute") {
      const parts = children.map(child => renderPythonType(source, child));
      return rendered(parts.map(item => item.text).join("."), parts.every(item => item.supported));
    }
    return rendered(trimSpace(nodeText(source, node)));
  }
  if (node.type === "subscript") {
    const base = renderPythonType(source, children[0] ?? null);
    const index = renderPythonType(source, children[1] ?? null);
    return rendered(`${base.text}[${index.text}]`, base.supported && index.supported);
  }
  if (node.type === "binary_operator") {
    const parts = children.map(child => renderPythonType(source, child));
    const raw = trimSpace(nodeText(source, node));
    const operator = raw.match(/(?:^|\s)([|+*~&^<>\/-])(?:\s|$)/u)?.[1];
    if (operator !== "|") return rendered("unknown", false);
    return rendered(parts.map(item => item.text).join(" | "), parts.every(item => item.supported));
  }
  // Calls, lambdas, literals, and container expressions can carry arbitrary
  // values. Keep a bounded skeleton and truthfully lower file coverage.
  return rendered("unknown", false);
}

function renderPythonParameter(source: Uint8Array, node: SyntaxNodeView): Rendered {
  const children = node.namedChildren;
  if (node.type === "default_parameter") return renderPythonParameter(source, children[0] ?? node);
  if (node.type === "typed_default_parameter") {
    const name = children.find(child => child.type === "identifier");
    const annotation = children.find(child => child.type === "type");
    const base = name ? renderPythonParameter(source, name) : rendered("unknown", false);
    const type = annotation ? renderPythonType(source, annotation) : rendered("", true);
    return rendered(`${base.text}: ${type.text}`, base.supported && type.supported);
  }
  if (node.type === "typed_parameter") {
    const name = children.find(child => child.type !== "type");
    const annotation = children.find(child => child.type === "type");
    const base = name ? renderPythonParameter(source, name) : rendered("unknown", false);
    const type = annotation ? renderPythonType(source, annotation) : rendered("", true);
    return rendered(`${base.text}: ${type.text}`, base.supported && type.supported);
  }
  if (node.type === "list_splat" || node.type === "dictionary_splat") {
    const child = children[0] ? renderPythonParameter(source, children[0]!) : rendered("unknown", false);
    return rendered(`${node.type === "list_splat" ? "*" : "**"}${child.text}`, child.supported);
  }
  if (node.type === "identifier") return rendered(trimSpace(nodeText(source, node)));
  if (["positional_separator", "keyword_separator"].includes(node.type)) return rendered(node.type === "positional_separator" ? "/" : "*");
  if (["tuple", "list", "tuple_pattern", "list_pattern"].includes(node.type)) {
    const parts = children.map(child => renderPythonParameter(source, child));
    return rendered(`(${parts.map(item => item.text).join(", ")})`, parts.every(item => item.supported));
  }
  return rendered("unknown", false);
}

function parameterSignature(source: Uint8Array, node: SyntaxNodeView | null): Rendered {
  if (!node) return rendered("()", true);
  const parts = node.namedChildren.map(child => renderPythonParameter(source, child));
  return rendered(`(${parts.map(item => item.text).join(", ")})`, parts.every(item => item.supported));
}

function declarationName(source: Uint8Array, node: SyntaxNodeView): string | null {
  const named = node.childForFieldName("name") ?? firstNamed(node, "identifier", "type_identifier");
  if (!named) return null;
  const value = trimSpace(nodeText(source, named));
  return value.length > 0 ? value : null;
}

function assignmentName(source: Uint8Array, node: SyntaxNodeView): string | null {
  const left = node.childForFieldName("left");
  if (!left || left.type !== "identifier") return null;
  const value = trimSpace(nodeText(source, left));
  return value.length > 0 ? value : null;
}

function assignmentTargetNames(source: Uint8Array, node: SyntaxNodeView): string[] {
  const names: string[] = [];
  let current: SyntaxNodeView | null = node;
  while (current?.type === "assignment") {
    const left = current.childForFieldName("left") ?? current.namedChildren[0] ?? null;
    if (!left || left.type !== "identifier") return names;
    const name = trimSpace(nodeText(source, left));
    if (name) names.push(name);
    current = current.childForFieldName("right") ?? current.namedChildren[1] ?? null;
  }
  return names;
}

function isPublicName(name: string): boolean {
  return !name.startsWith("_");
}

function isAsyncFunction(node: SyntaxNodeView): boolean {
  return node.children.some(child => child.type === "async");
}

function signatureFor(source: Uint8Array, node: SyntaxNodeView, kind: PortableSymbolKind, name: string): Rendered {
  if (node.type === "function_definition") {
    const prefix = isAsyncFunction(node) ? "async def" : "def";
    const parameters = parameterSignature(source, node.childForFieldName("parameters"));
    const returnType = renderPythonType(source, node.childForFieldName("return_type") ?? node.childForFieldName("type"));
    return rendered(`${prefix} ${name}${parameters.text}${returnType.text ? ` -> ${returnType.text}` : ""}`, parameters.supported && returnType.supported);
  }
  if (node.type === "class_definition") {
    const argumentList = firstNamed(node, "argument_list");
    const bases = argumentList?.namedChildren.map(child => renderPythonType(source, child)) ?? [];
    return rendered(`class ${name}${bases.length > 0 ? `(${bases.map(item => item.text).join(", ")})` : ""}`, bases.every(item => item.supported));
  }
  if (node.type === "assignment") {
    const annotation = renderPythonType(source, node.childForFieldName("type"));
    return rendered(annotation.text ? `${name}: ${annotation.text}` : name, annotation.supported);
  }
  if (node.type === "type_alias_statement") return rendered(`type ${name}`);
  return rendered(kind === "variable" || kind === "constant" || kind === "field" ? name : "");
}

function kindForAssignment(name: string, parent: DeclarationCandidate | null): PortableSymbolKind {
  if (parent?.kind === "class") return "field";
  return /^[A-Z][A-Z0-9_]*$/u.test(name) ? "constant" : "variable";
}

function assignmentCandidate(source: Uint8Array, node: SyntaxNodeView, parent: DeclarationCandidate | null, name: string): DeclarationCandidate {
  const kind = kindForAssignment(name, parent);
  const signature = signatureFor(source, node, kind, name);
  return {
    node,
    kind,
    name,
    signature: signature.text,
    signatureSupported: signature.supported,
    exported: parent === null && isPublicName(name),
    parent,
    startByte: node.coordinate.start.byte,
    ordinal: 0
  };
}

function candidateFor(source: Uint8Array, node: SyntaxNodeView, parent: DeclarationCandidate | null): DeclarationCandidate | null {
  if (node.type === "function_definition") {
    const name = declarationName(source, node);
    if (!name) return null;
    const kind: PortableSymbolKind = parent?.kind === "class"
      ? (name === "__init__" ? "constructor" : "method")
      : "function";
    const signature = signatureFor(source, node, kind, name);
    return {
      node,
      kind,
      name,
      signature: signature.text,
      signatureSupported: signature.supported,
      exported: parent === null && isPublicName(name),
      parent,
      startByte: node.coordinate.start.byte,
      ordinal: 0
    };
  }
  if (node.type === "class_definition") {
    const name = declarationName(source, node);
    if (!name) return null;
    const signature = signatureFor(source, node, "class", name);
    return {
      node,
      kind: "class",
      name,
      signature: signature.text,
      signatureSupported: signature.supported,
      exported: parent === null && isPublicName(name),
      parent,
      startByte: node.coordinate.start.byte,
      ordinal: 0
    };
  }
  if (node.type === "assignment") {
    const name = assignmentName(source, node);
    if (!name) return null;
    return assignmentCandidate(source, node, parent, name);
  }
  if (node.type === "type_alias_statement") {
    const name = firstNamed(node, "type")?.namedChildren[0];
    if (!name) return null;
    const value = trimSpace(nodeText(source, name));
    if (value.length === 0) return null;
    return {
      node,
      kind: "type",
      name: value,
      signature: `type ${value}`,
      signatureSupported: true,
      exported: parent === null && isPublicName(value),
      parent,
      startByte: node.coordinate.start.byte,
      ordinal: 0
    };
  }
  return null;
}

function collectCandidates(source: Uint8Array, root: SyntaxNodeView, identityPath: string): {candidates: DeclarationCandidate[]; unsupported: boolean} {
  const candidates: DeclarationCandidate[] = [];
  let unsupported = false;
  const visit = (node: SyntaxNodeView, parent: DeclarationCandidate | null): void => {
    // A decorated_definition is syntax around exactly one declaration. The
    // decorator is intentionally ignored for identity/signature purposes.
    if (node.type === "assignment") {
      const targets = assignmentTargetNames(source, node);
      if (targets.length > 1) {
        for (const name of targets) {
          const candidate = assignmentCandidate(source, node, parent, name);
          candidates.push(candidate);
          if (!candidate.signatureSupported) unsupported = true;
        }
        return;
      }
    }
    const candidate = candidateFor(source, node, parent);
    if (candidate) {
      candidates.push(candidate);
      if (!candidate.signatureSupported) unsupported = true;
      if (node.type === "assignment") return;
    } else if (node.type === "assignment") {
      const left = node.childForFieldName("left");
      if (left && ["pattern_list", "list", "tuple", "dictionary"].includes(left.type)) unsupported = true;
    }
    const nextParent = candidate ?? parent;
    for (const child of node.namedChildren) visit(child, nextParent);
  };
  visit(root, null);
  candidates.sort(compareBySource);
  const counts = new Map<string, number>();
  const qualified = (candidate: DeclarationCandidate): string => {
    if (candidate.qualifiedName) return candidate.qualifiedName;
    const parent = candidate.parent ? qualified(candidate.parent) : null;
    candidate.qualifiedName = parent ? `${parent}.${candidate.name}` : candidate.name;
    return candidate.qualifiedName;
  };
  for (const candidate of candidates) {
    const qualifiedName = qualified(candidate);
    const countKey = `${qualifiedName}\0${candidate.kind}`;
    const ordinal = counts.get(countKey) ?? 0;
    counts.set(countKey, ordinal + 1);
    candidate.ordinal = ordinal;
    candidate.id = stableId("sym-", `${identityPath}:${qualifiedName}:${candidate.kind}:${ordinal}`);
  }
  return {candidates, unsupported};
}

function splitUtf8(value: string): string[] {
  const segments: string[] = [];
  let current = "";
  for (const character of value) {
    if (Buffer.byteLength(current + character, "utf8") > PORTABLE_MAP_MAX_STRUCTURAL_DETAIL_SEGMENT_BYTES && current.length > 0) {
      segments.push(current);
      current = character;
    } else {
      current += character;
    }
  }
  if (current.length > 0) segments.push(current);
  return segments.length > 0 ? segments : [""];
}

function addDetails(
  records: MutableRecords,
  sourceRecordId: string,
  field: "qualifiedName" | "signature",
  value: string
): {reference: {field: "qualifiedName" | "signature"; firstSegmentId: string; segmentCount: number; byteSize: number; contentHash: string}} {
  const pieces = splitUtf8(value);
  const ids = pieces.map((_, index) => stableId("det-", `${sourceRecordId}:${field}:${index}`));
  for (const [index, text] of pieces.entries()) {
    records.details.push({
      id: ids[index]!,
      sourceRecordId,
      field,
      segmentIndex: index,
      segmentCount: pieces.length,
      text,
      byteSize: Buffer.byteLength(text, "utf8"),
      contentHash: digest(text),
      previousSegmentId: index === 0 ? null : ids[index - 1]!,
      nextSegmentId: index === pieces.length - 1 ? null : ids[index + 1]!
    });
  }
  return {
    reference: {
      field,
      firstSegmentId: ids[0]!,
      segmentCount: pieces.length,
      byteSize: Buffer.byteLength(value, "utf8"),
      contentHash: digest(value)
    }
  };
}

function safeStructuralValue(value: string): boolean {
  return inspectContentBoundaries(value).safe && !/[\u0000]/u.test(value);
}

function makeFile(
  file: PortableFileRecord,
  status: PortableFileRecord["parseStatus"],
  coverageStatus: PortableFileRecord["coverageStatus"],
  limitationReason: NonNullable<PortableFileRecord["limitationReason"]>,
  coordinate?: PortableSourceCoordinate
): PortableFileRecord {
  return {
    ...file,
    parseStatus: status,
    coverageStatus,
    limitationReason,
    ...(coordinate ? {coordinate} : {})
  };
}

function emptyFailure(
  file: PortableFileRecord,
  status: PythonAdapterFailure["status"],
  diagnostics: readonly PythonAdapterDiagnostic[]
): PythonAdapterFailure {
  return {
    ok: false,
    status,
    file,
    symbols: [],
    imports: [],
    relationships: [],
    details: [],
    diagnostics,
    ruleVersion: PYTHON_ADAPTER_RULE_VERSION
  };
}

/**
 * Resolve only module paths that have one unambiguous inventory match. The
 * rule is deliberately file based: package/module.py and package/module/__init__.py
 * are candidates, while imported symbols and runtime package metadata remain unknown.
 */
function moduleResolution(file: PortableFileRecord, specifier: string, knownFiles: readonly PortableFileRecord[]): Resolution {
  const relative = specifier.startsWith(".");
  const withoutDots = relative ? specifier.replace(/^\.+/u, "") : specifier;
  const level = relative ? (specifier.match(/^\.+/u)?.[0].length ?? 0) : 0;
  const modulePath = withoutDots.replaceAll(".", "/");
  const fileDir = path.posix.dirname(file.path);
  let base: string;
  if (relative) {
    const directoryParts = fileDir === "." ? [] : fileDir.split("/").filter(Boolean);
    // A single leading dot refers to the current package directory. Each
    // additional dot consumes one parent directory; beyond repository root
    // there is no sound local target to inspect.
    if (level > directoryParts.length + 1) {
      return {resolutionStatus: "unresolved", targetFileId: null, targetSymbolId: null, unresolvedReason: "missing-target", certainty: "unknown"};
    }
    let directory = fileDir;
    for (let index = 1; index < level; index += 1) directory = path.posix.dirname(directory);
    base = path.posix.normalize(path.posix.join(directory, modulePath));
  } else {
    base = path.posix.normalize(modulePath);
  }
  if (base === "." || base === ".." || base.startsWith("../")) {
    return {resolutionStatus: "unresolved", targetFileId: null, targetSymbolId: null, unresolvedReason: "missing-target", certainty: "unknown"};
  }
  const candidatePaths = new Set([base, `${base}.py`, `${base}/__init__.py`]);
  const candidates = new Map<string, PortableFileRecord>();
  for (const known of knownFiles) {
    if (candidatePaths.has(known.path)) candidates.set(known.id, known);
  }
  if (candidates.size === 1) {
    return {resolutionStatus: "resolved", targetFileId: candidates.keys().next().value ?? null, targetSymbolId: null, certainty: "supported-inference"};
  }
  if (candidates.size > 1) {
    return {resolutionStatus: "ambiguous", targetFileId: null, targetSymbolId: null, unresolvedReason: "ambiguous-module", certainty: "unknown"};
  }
  return {
    resolutionStatus: "unresolved",
    targetFileId: null,
    targetSymbolId: null,
    unresolvedReason: relative ? "missing-target" : "external-dependency",
    certainty: "unknown"
  };
}

function importRecord(
  source: Uint8Array,
  file: PortableFileRecord,
  node: SyntaxNodeView,
  specifier: string,
  resolution: Resolution,
  index: number
): PortableImportRelationship {
  return {
    id: stableId("imp-", `${file.path}:import:${specifier}:${node.coordinate.start.byte}:${index}`),
    kind: "import",
    sourceFileId: file.id,
    sourcePath: file.path,
    specifier,
    coordinate: node.coordinate,
    contentHash: digest(source.slice(node.coordinate.start.byte, node.coordinate.end.byte)),
    resolutionStatus: resolution.resolutionStatus,
    targetFileId: resolution.targetFileId,
    targetSymbolId: resolution.targetSymbolId,
    ...(resolution.unresolvedReason ? {unresolvedReason: resolution.unresolvedReason} : {}),
    origin: "syntax",
    certainty: resolution.certainty
  };
}

function directImportSpecifiers(source: Uint8Array, node: SyntaxNodeView): string[] {
  if (node.type === "import_statement") {
    return node.namedChildren.flatMap(child => {
      if (child.type === "dotted_name") return [trimSpace(nodeText(source, child))];
      if (child.type === "aliased_import") {
        const module = firstNamed(child, "dotted_name");
        return module ? [trimSpace(nodeText(source, module))] : [];
      }
      return [];
    });
  }
  if (node.type === "import_from_statement") {
    const relative = firstNamed(node, "relative_import");
    if (relative) return [trimSpace(nodeText(source, relative)).replace(/\s+/gu, "")];
    const module = firstNamed(node, "dotted_name");
    return module ? [trimSpace(nodeText(source, module))] : [];
  }
  return [];
}

function callCallee(source: Uint8Array, node: SyntaxNodeView): string {
  const callee = node.namedChildren[0];
  return callee ? trimSpace(nodeText(source, callee)).replace(/\s+/gu, "") : "";
}

function buildRecords(
  source: Uint8Array,
  file: PortableFileRecord,
  tree: SyntaxTreeView,
  knownFiles: readonly PortableFileRecord[]
): {records: MutableRecords; diagnostics: PythonAdapterDiagnostic[]; partial: boolean} {
  const records: MutableRecords = {symbols: [], imports: [], relationships: [], details: []};
  const diagnostics: PythonAdapterDiagnostic[] = [];
  const collected = collectCandidates(source, tree.rootNode, file.path);
  let partial = collected.unsupported;
  const candidateToSymbol = new Map<DeclarationCandidate, PortableSymbolRecord>();

  for (const candidate of collected.candidates) {
    const id = candidate.id!;
    const qualifiedName = candidate.qualifiedName!;
    if (!safeStructuralValue(qualifiedName) || (candidate.signature !== undefined && !safeStructuralValue(candidate.signature))) {
      partial = true;
      diagnostics.push({code: "unsafe-content", message: "A structural declaration value crossed a content boundary and was omitted."});
      continue;
    }
    const detailReferences: PortableSymbolRecord["detailReferences"] = [];
    let inlineName: string | undefined = qualifiedName;
    // The inline contract has both a character bound (1024) and the shared
    // UTF-8 detail-segment bound. Keep a genuine value lossless in either case.
    if (qualifiedName.length > 1024 || Buffer.byteLength(qualifiedName, "utf8") > PORTABLE_MAP_MAX_STRUCTURAL_DETAIL_SEGMENT_BYTES) {
      inlineName = undefined;
      detailReferences.push(addDetails(records, id, "qualifiedName", qualifiedName).reference);
    }
    let inlineSignature = candidate.signature;
    if (inlineSignature !== undefined && Buffer.byteLength(inlineSignature, "utf8") > PORTABLE_MAP_MAX_STRUCTURAL_DETAIL_SEGMENT_BYTES) {
      const fullSignature = inlineSignature;
      inlineSignature = undefined;
      detailReferences.push(addDetails(records, id, "signature", fullSignature).reference);
    }
    const symbol: PortableSymbolRecord = {
      id,
      fileId: file.id,
      path: file.path,
      ...(inlineName ? {qualifiedName: inlineName} : {}),
      kind: candidate.kind,
      ...(inlineSignature !== undefined ? {signature: inlineSignature} : {}),
      coordinate: candidate.node.coordinate,
      contentHash: digest(source.slice(candidate.node.coordinate.start.byte, candidate.node.coordinate.end.byte)),
      lexicalParentId: candidate.parent?.id ?? null,
      exported: candidate.exported,
      ...(detailReferences.length > 0 ? {detailReferences} : {})
    };
    if (!portableSymbolRecordSchema.safeParse(symbol).success) {
      partial = true;
      diagnostics.push({code: "invalid-output", message: "A structural declaration did not satisfy the portable record contract."});
      continue;
    }
    records.symbols.push(symbol);
    candidateToSymbol.set(candidate, symbol);
  }

  for (const candidate of collected.candidates) {
    const child = candidateToSymbol.get(candidate);
    if (!child || !candidate.parent) continue;
    const parent = candidateToSymbol.get(candidate.parent);
    if (!parent) continue;
    const relationship: PortableRelationshipRecord = {
      id: stableId("rel-", `${file.path}:contains:${parent.id}:${child.id}`),
      kind: "contains",
      sourceFileId: file.id,
      sourceSymbolId: parent.id,
      sourcePath: file.path,
      coordinate: child.coordinate,
      contentHash: child.contentHash,
      resolutionStatus: "resolved",
      targetFileId: file.id,
      targetSymbolId: child.id,
      origin: "syntax",
      certainty: "observed"
    };
    if (portableRelationshipRecordSchema.safeParse(relationship).success) records.relationships.push(relationship);
  }

  let importIndex = 0;
  const walkImports = (node: SyntaxNodeView): void => {
    if (node.type === "import_statement" || node.type === "import_from_statement") {
      for (const specifier of directImportSpecifiers(source, node)) {
        if (specifier.length === 0 || !safeStructuralValue(specifier)) {
          partial = true;
          diagnostics.push({code: "unsafe-content", message: "An import specifier crossed a content boundary and was omitted."});
          continue;
        }
        const record = importRecord(source, file, node, specifier, moduleResolution(file, specifier, knownFiles), importIndex++);
        if (portableImportRelationshipSchema.safeParse(record).success) {
          records.imports.push(record);
        } else {
          partial = true;
          diagnostics.push({code: "invalid-output", message: "An import relationship did not satisfy the portable record contract."});
        }
      }
    }
    if (node.type === "call") {
      const callee = callCallee(source, node);
      const dynamic = callee === "__import__" || callee === "importlib.import_module" || callee === "import_module";
      const reflection = callee === "getattr" || callee === "__getattribute__" || callee === "eval" || callee === "exec";
      if (dynamic || reflection) {
        const resolution: Resolution = {
          resolutionStatus: "unsupported",
          targetFileId: null,
          targetSymbolId: null,
          unresolvedReason: dynamic ? "dynamic-import" : "reflection",
          certainty: "unknown"
        };
        const specifier = dynamic ? "<dynamic>" : "<reflection>";
        const record = importRecord(source, file, node, specifier, resolution, importIndex++);
        if (portableImportRelationshipSchema.safeParse(record).success) {
          records.imports.push(record);
        } else {
          partial = true;
          diagnostics.push({code: "invalid-output", message: "A dynamic relationship did not satisfy the portable record contract."});
        }
      }
    }
    for (const child of node.namedChildren) walkImports(child);
  };
  walkImports(tree.rootNode);

  if (tree.rootNode.hasError) {
    partial = true;
    diagnostics.push({code: "parse-error", message: "The pinned parser reported syntax errors for this file."});
  }
  if (collected.unsupported) diagnostics.push({code: "unsupported-construct", message: "Some structural syntax was omitted from portable coverage."});
  return {records, diagnostics, partial};
}

function validateRecords(records: MutableRecords): boolean {
  return records.symbols.every(record => portableSymbolRecordSchema.safeParse(record).success) &&
    records.imports.every(record => portableImportRelationshipSchema.safeParse(record).success) &&
    records.relationships.every(record => portableRelationshipRecordSchema.safeParse(record).success) &&
    records.details.every(record => portableStructuralDetailRecordSchema.safeParse(record).success);
}

/** Extract Python declarations and syntax imports from one inventory file. */
export async function adaptPythonFile(input: PythonAdapterInput): Promise<PythonAdapterResult> {
  const {file, source, knownFiles = []} = input;
  if (source.byteLength !== file.byteSize || digest(source) !== file.contentHash) {
    return emptyFailure(file, "stale", [{code: "source-mismatch", message: "Source bytes do not match the inventory record."}]);
  }
  if (!languageSupported(file.language)) {
    return emptyFailure(makeFile(file, "unsupported", "file", "unsupported-language"), "unsupported", [{code: "unsupported-language", message: "The Python adapter supports Python files only."}]);
  }
  if (source.byteLength > PYTHON_ADAPTER_MAX_FILE_BYTES) {
    return {
      ok: false,
      status: "invalid",
      file: makeFile(file, "skipped", "file", "too-large"),
      symbols: [],
      imports: [],
      relationships: [],
      details: [],
      diagnostics: [{code: "too-large", message: "Files above the default one MiB extraction limit retain file-level coverage only."}],
      ruleVersion: PYTHON_ADAPTER_RULE_VERSION
    };
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(source);
  } catch {
    return emptyFailure(makeFile(file, "failed", "none", "parse-error"), "invalid", [{code: "invalid-utf8", message: "Source bytes are not valid UTF-8."}]);
  }
  if (!inspectContentBoundaries(text).safe) {
    return {
      ok: true,
      status: "partial",
      file: makeFile(file, "partial", "file", "unsafe-content"),
      symbols: [],
      imports: [],
      relationships: [],
      details: [],
      diagnostics: [{code: "unsafe-content", message: "Source content crossed a content boundary; structural extraction was omitted."}],
      ruleVersion: PYTHON_ADAPTER_RULE_VERSION
    };
  }
  try {
    return await withParsedSource("python", source, tree => {
      const extracted = buildRecords(source, file, tree, knownFiles);
      if (!validateRecords(extracted.records)) {
        return emptyFailure(makeFile(file, "failed", "none", "parse-error"), "invalid", [{code: "invalid-output", message: "Adapter output did not satisfy the portable record contracts."}]);
      }
      const limitationReason = extracted.partial
        ? (extracted.diagnostics.some(item => item.code === "parse-error") ? "parse-error" : extracted.diagnostics.some(item => item.code === "unsafe-content") ? "unsafe-content" : "unsupported-construct")
        : "none";
      const updatedFile = makeFile(file, extracted.partial ? "partial" : "parsed", extracted.partial ? "file" : "full", limitationReason, tree.rootNode.coordinate);
      return {
        ok: true,
        status: extracted.partial ? "partial" : "complete",
        file: updatedFile,
        symbols: extracted.records.symbols,
        imports: extracted.records.imports,
        relationships: extracted.records.relationships,
        details: extracted.records.details,
        diagnostics: extracted.diagnostics,
        ruleVersion: PYTHON_ADAPTER_RULE_VERSION
      };
    });
  } catch {
    return emptyFailure(makeFile(file, "failed", "none", "parse-error"), "invalid", [{code: "parse-error", message: "The pinned parser could not analyze this file."}]);
  }
}

export const extractPythonFile = adaptPythonFile;
export const analyzePythonFile = adaptPythonFile;
