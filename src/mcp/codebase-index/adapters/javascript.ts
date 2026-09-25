import {createHash} from "node:crypto";
import path from "node:path";

import {
  PORTABLE_MAP_MAX_STRUCTURAL_DETAIL_SEGMENT_BYTES,
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

/** The JS-family extraction rule is part of the pinned parser contract. */
export const JAVASCRIPT_ADAPTER_RULE_VERSION = "javascript-declarations-v1/tree-sitter-0.27.0" as const;
export const JAVASCRIPT_ADAPTER_SUPPORTED_LANGUAGES = ["javascript", "jsx", "typescript", "tsx"] as const;
export const JAVASCRIPT_ADAPTER_MAX_FILE_BYTES = 1 * 1024 * 1024;

type JavaScriptLanguage = typeof JAVASCRIPT_ADAPTER_SUPPORTED_LANGUAGES[number];

export type JavaScriptAdapterInput = {
  readonly file: PortableFileRecord;
  readonly source: Uint8Array;
  readonly knownFiles?: readonly PortableFileRecord[];
};

export type JavaScriptAdapterDiagnosticCode =
  | "source-mismatch"
  | "unsupported-language"
  | "too-large"
  | "invalid-utf8"
  | "unsafe-content"
  | "parse-error"
  | "unsupported-construct"
  | "invalid-output";

export type JavaScriptAdapterDiagnostic = {
  readonly code: JavaScriptAdapterDiagnosticCode;
  readonly message: string;
};

type AdapterRecords = {
  readonly symbols: readonly PortableSymbolRecord[];
  readonly imports: readonly PortableImportRelationship[];
  readonly relationships: readonly PortableRelationshipRecord[];
  readonly details: readonly PortableStructuralDetailRecord[];
};

export type JavaScriptAdapterSuccess = {
  readonly ok: true;
  readonly status: "complete" | "partial";
  readonly file: PortableFileRecord;
  readonly symbols: readonly PortableSymbolRecord[];
  readonly imports: readonly PortableImportRelationship[];
  readonly relationships: readonly PortableRelationshipRecord[];
  readonly details: readonly PortableStructuralDetailRecord[];
  readonly diagnostics: readonly JavaScriptAdapterDiagnostic[];
  readonly ruleVersion: typeof JAVASCRIPT_ADAPTER_RULE_VERSION;
};

export type JavaScriptAdapterFailure = {
  readonly ok: false;
  readonly status: "stale" | "unsupported" | "invalid";
  readonly file: PortableFileRecord;
  readonly symbols: readonly [];
  readonly imports: readonly [];
  readonly relationships: readonly [];
  readonly details: readonly [];
  readonly diagnostics: readonly JavaScriptAdapterDiagnostic[];
  readonly ruleVersion: typeof JAVASCRIPT_ADAPTER_RULE_VERSION;
};

export type JavaScriptAdapterResult = JavaScriptAdapterSuccess | JavaScriptAdapterFailure;

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

function languageSupported(value: PortableLanguage): value is JavaScriptLanguage {
  return (JAVASCRIPT_ADAPTER_SUPPORTED_LANGUAGES as readonly string[]).includes(value);
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

function renderTypeNode(source: Uint8Array, node: SyntaxNodeView | null): Rendered {
  if (!node) return rendered("", true);
  const children = node.namedChildren;
  switch (node.type) {
    case "type_annotation":
      return renderTypeNode(source, children[0] ?? null);
    case "identifier":
    case "type_identifier":
    case "predefined_type":
    case "property_identifier":
    case "private_property_identifier":
    case "this_type":
      return rendered(trimSpace(nodeText(source, node)));
    case "nested_type_identifier":
    case "member_expression":
    case "qualified_name": {
      const parts = children.map(child => renderTypeNode(source, child));
      return rendered(parts.map(part => part.text).filter(Boolean).join("."), parts.every(part => part.supported));
    }
    case "generic_type": {
      const base = renderTypeNode(source, children[0] ?? null);
      const args = children[1] ?? null;
      const renderedArgs = args?.namedChildren.map(child => renderTypeNode(source, child)) ?? [];
      return rendered(`${base.text}${args ? `<${renderedArgs.map(item => item.text).join(", ")}>` : ""}`, base.supported && renderedArgs.every(item => item.supported));
    }
    case "type_arguments": {
      const args = children.map(child => renderTypeNode(source, child));
      return rendered(args.map(item => item.text).join(", "), args.every(item => item.supported));
    }
    case "type_parameter": {
      const name = renderTypeNode(source, children[0] ?? null);
      const constraint = children.find(child => child.type === "constraint");
      const defaultType = children.find(child => child.type === "default_type");
      const constraintValue = constraint ? renderTypeNode(source, constraint.namedChildren[0] ?? null) : rendered("", true);
      const defaultValue = defaultType ? renderTypeNode(source, defaultType.namedChildren[0] ?? null) : rendered("", true);
      return rendered(`${name.text}${constraintValue.text ? ` extends ${constraintValue.text}` : ""}${defaultValue.text ? ` = ${defaultValue.text}` : ""}`, name.supported && constraintValue.supported && defaultValue.supported);
    }
    case "array_type": {
      const item = renderTypeNode(source, children[0] ?? null);
      return rendered(`${item.text}[]`, item.supported);
    }
    case "parenthesized_type": {
      const item = renderTypeNode(source, children[0] ?? null);
      return rendered(`(${item.text})`, item.supported);
    }
    case "union_type":
    case "intersection_type": {
      const separator = node.type === "union_type" ? " | " : " & ";
      const parts = children.map(child => renderTypeNode(source, child));
      return rendered(parts.map(item => item.text).join(separator), parts.every(item => item.supported));
    }
    case "function_type": {
      const parameters = children.find(child => child.type === "formal_parameters");
      const returnNode = children.find(child => child.type !== "formal_parameters");
      const params = renderParameters(source, parameters ?? null);
      const result = returnNode ? renderTypeNode(source, returnNode) : rendered("unknown", false);
      return rendered(`${params.text} => ${result.text}`, params.supported && result.supported);
    }
    case "literal_type":
    case "object_type":
    case "object_type_annotation":
    case "call_expression":
    case "arguments":
      return rendered("unknown", false);
    default:
      return rendered("unknown", false);
  }
}

function renderParameter(source: Uint8Array, node: SyntaxNodeView): Rendered {
  const children = node.namedChildren;
  if (node.type === "decorator") return rendered("");
  if (node.type === "pair_pattern") {
    const key = children[0] ? renderParameter(source, children[0]) : rendered("unknown", false);
    const value = children[1] ? renderParameter(source, children[1]) : rendered("unknown", false);
    return rendered(`${key.text}: ${value.text}`, key.supported && value.supported);
  }
  if (["assignment_pattern", "object_assignment_pattern"].includes(node.type)) {
    return renderParameter(source, children[0] ?? node);
  }
  if (["required_parameter", "optional_parameter", "rest_pattern", "rest_parameter"].includes(node.type)) {
    const pattern = children.find(child => child.type !== "type_annotation" && child.type !== "decorator");
    const annotation = children.find(child => child.type === "type_annotation");
    const base = pattern ? renderParameter(source, pattern) : rendered("unknown", false);
    const typed = annotation ? renderTypeNode(source, annotation) : null;
    const prefix = node.type.startsWith("rest") ? "..." : "";
    const optional = node.type === "optional_parameter" ? "?" : "";
    return rendered(`${prefix}${base.text}${optional}${typed ? `: ${typed.text}` : ""}`, base.supported && (typed?.supported ?? true));
  }
  if (["object_pattern", "array_pattern"].includes(node.type)) {
    const open = node.type === "object_pattern" ? "{" : "[";
    const close = node.type === "object_pattern" ? "}" : "]";
    const parts = children.map(child => renderParameter(source, child));
    return rendered(`${open}${parts.map(item => item.text).join(", ")}${close}`, parts.every(item => item.supported));
  }
  if (["identifier", "type_identifier", "property_identifier", "private_property_identifier", "shorthand_property_identifier_pattern"].includes(node.type)) {
    return rendered(trimSpace(nodeText(source, node)));
  }
  if (["call_expression", "arguments", "member_expression", "object", "array"].includes(node.type)) {
    return rendered("unknown", false);
  }
  if (children.length > 0) {
    const parts = children.map(child => renderParameter(source, child));
    return rendered(parts.map(item => item.text).join(""), parts.every(item => item.supported));
  }
  return rendered("unknown", false);
}

function renderParameters(source: Uint8Array, node: SyntaxNodeView | null): Rendered {
  if (!node) return rendered("()", true);
  const parts = node.namedChildren.map(child => renderParameter(source, child));
  return rendered(`(${parts.map(item => item.text).join(", ")})`, parts.every(item => item.supported));
}

function renderSingleParameter(source: Uint8Array, node: SyntaxNodeView | null): Rendered {
  if (!node) return rendered("()", false);
  const value = renderParameter(source, node);
  return rendered(`(${value.text})`, value.supported);
}

function renderTypeParameters(source: Uint8Array, node: SyntaxNodeView | null): Rendered {
  if (!node) return rendered("");
  const parts = node.namedChildren.map(child => renderTypeNode(source, child));
  return rendered(`<${parts.map(item => item.text).join(", ")}>`, parts.every(item => item.supported));
}

function renderReturnType(source: Uint8Array, node: SyntaxNodeView): Rendered {
  const returnType = node.childForFieldName("return_type") ?? firstNamed(node, "type_annotation");
  if (!returnType) return rendered("");
  const result = renderTypeNode(source, returnType);
  return rendered(result.text ? `: ${result.text}` : "", result.supported);
}

function renderHeritage(source: Uint8Array, node: SyntaxNodeView | null): Rendered {
  if (!node) return rendered("");
  const parts: Rendered[] = [];
  for (const clause of node.namedChildren.filter(child => ["extends_clause", "implements_clause", "extends_type_clause"].includes(child.type))) {
    const targets = clause.namedChildren.map(child => renderTypeNode(source, child));
    const prefix = clause.type === "implements_clause" ? " implements " : " extends ";
    parts.push(rendered(`${prefix}${targets.map(item => item.text).join(", ") || "unknown"}`, targets.length > 0 && targets.every(item => item.supported)));
  }
  return rendered(parts.map(item => item.text).join(""), parts.every(item => item.supported));
}

function declarationName(source: Uint8Array, node: SyntaxNodeView): string | null {
  const named = node.childForFieldName("name") ?? firstNamed(node,
    "identifier", "type_identifier", "property_identifier", "private_property_identifier");
  if (!named || named.type === "computed_property_name") return null;
  const value = trimSpace(nodeText(source, named));
  return value.length > 0 ? value : null;
}

function variableName(source: Uint8Array, node: SyntaxNodeView): string | null {
  const name = node.childForFieldName("name") ?? node.namedChildren[0] ?? null;
  if (!name || !["identifier", "shorthand_property_identifier_pattern", "type_identifier"].includes(name.type)) return null;
  const value = trimSpace(nodeText(source, name));
  return value.length > 0 ? value : null;
}

function initializer(node: SyntaxNodeView): SyntaxNodeView | null {
  return node.childForFieldName("value") ?? node.namedChildren.at(-1) ?? null;
}

function isFunctionInitializer(node: SyntaxNodeView | null): boolean {
  return node !== null && ["arrow_function", "function", "function_expression", "generator_function"].includes(node.type);
}

function signatureFor(source: Uint8Array, node: SyntaxNodeView, kind: PortableSymbolKind, name: string): Rendered {
  const typeParameters = renderTypeParameters(source, node.childForFieldName("type_parameters") ?? firstNamed(node, "type_parameters"));
  const parameterNode = node.childForFieldName("parameters") ?? firstNamed(node, "formal_parameters");
  const arrowParameter = node.type === "arrow_function" && !parameterNode
    ? node.childForFieldName("parameter") ?? node.namedChildren.find(child => child.type !== "statement_block")
    : null;
  const parameters = parameterNode ? renderParameters(source, parameterNode) : renderSingleParameter(source, arrowParameter ?? null);
  const returnType = renderReturnType(source, node);
  switch (node.type) {
    case "function":
    case "function_declaration":
    case "function_signature":
    case "generator_function_declaration":
      return rendered(`function ${name}${typeParameters.text}${parameters.text}${returnType.text}`, typeParameters.supported && parameters.supported && returnType.supported);
    case "arrow_function":
      return rendered(`function ${name}${typeParameters.text}${parameters.text}${returnType.text}`, typeParameters.supported && parameters.supported && returnType.supported);
    case "method_definition":
    case "method_signature":
    case "construct_signature":
      return rendered(`${name}${typeParameters.text}${parameters.text}${returnType.text}`, typeParameters.supported && parameters.supported && returnType.supported);
    case "class":
    case "class_declaration":
      {
        const heritage = renderHeritage(source, firstNamed(node, "class_heritage", "extends_type_clause"));
        return rendered(`class ${name}${typeParameters.text}${heritage.text}`, typeParameters.supported && heritage.supported);
      }
    case "interface_declaration":
      return rendered(`interface ${name}${typeParameters.text}`, typeParameters.supported);
    case "type_alias_declaration":
      return rendered(`type ${name}${typeParameters.text}`, typeParameters.supported);
    case "enum_declaration":
      return rendered(`enum ${name}${typeParameters.text}`, typeParameters.supported);
    case "field_definition":
    case "public_field_definition":
    case "property_signature":
      {
        const annotation = renderTypeNode(source, firstNamed(node, "type_annotation"));
        return rendered(`${name}${annotation.text ? `: ${annotation.text}` : ""}`, annotation.supported);
      }
    case "variable_declarator":
      {
        const annotation = renderTypeNode(source, firstNamed(node, "type_annotation"));
        return rendered(`${name}${annotation.text ? `: ${annotation.text}` : ""}`, annotation.supported);
      }
    default:
      return rendered(kind === "variable" || kind === "constant" ? name : "", true);
  }
}

function kindFor(node: SyntaxNodeView): PortableSymbolKind | null {
  switch (node.type) {
    case "function":
    case "function_declaration":
    case "function_signature":
    case "generator_function_declaration":
    case "arrow_function":
    case "function_expression":
    case "generator_function":
      return "function";
    case "class":
    case "class_declaration":
      return "class";
    case "interface_declaration":
      return "interface";
    case "type_alias_declaration":
      return "type";
    case "enum_declaration":
      return "enum";
    case "method_definition":
    case "method_signature":
      return "method";
    case "construct_signature":
      return "constructor";
    case "field_definition":
    case "public_field_definition":
      return "field";
    case "property_signature":
      return "property";
    case "variable_declarator":
      return "variable";
    default:
      return null;
  }
}

function candidateFor(source: Uint8Array, node: SyntaxNodeView, parent: DeclarationCandidate | null, exported: boolean): DeclarationCandidate | null {
  if (node.type === "variable_declarator") {
    const name = variableName(source, node);
    if (!name) return null;
    const value = initializer(node);
    const kind: PortableSymbolKind = isFunctionInitializer(value) ? "function" : "variable";
    const signatureNode = isFunctionInitializer(value) ? value! : node;
    const signature = signatureFor(source, signatureNode, kind, name);
    return {
      node: signatureNode,
      kind,
      name,
      signature: signature.text,
      signatureSupported: signature.supported,
      exported,
      parent,
      startByte: node.coordinate.start.byte,
      ordinal: 0
    };
  }
  let kind = kindFor(node);
  if (!kind || node.type === "arrow_function" || node.type === "function_expression" || node.type === "generator_function") return null;
  let name = declarationName(source, node);
  if (!name && node.type === "construct_signature") name = "new";
  if (!name && exported && ["function_declaration", "function_signature", "class_declaration", "class", "function"].includes(node.type)) name = "default";
  if (!name) return null;
  if (kind === "method" && name === "constructor") kind = "constructor";
  const signature = signatureFor(source, node, kind, name);
  return {
    node,
    kind,
    name,
    signature: signature.text,
    signatureSupported: signature.supported,
    exported,
    parent,
    startByte: node.coordinate.start.byte,
    ordinal: 0
  };
}

function shouldVisitChildren(node: SyntaxNodeView): boolean {
  return !["jsx_element", "jsx_self_closing_element", "string", "template_string", "regex"].includes(node.type);
}

function collectCandidates(source: Uint8Array, root: SyntaxNodeView, identityPath: string): {candidates: DeclarationCandidate[]; unsupported: boolean} {
  const candidates: DeclarationCandidate[] = [];
  let unsupported = false;
  const visit = (node: SyntaxNodeView, parent: DeclarationCandidate | null, pendingExport: boolean): void => {
    const computed = node.type === "computed_property_name" || node.type === "computed_field_definition";
    if (computed) unsupported = true;
    const candidate = candidateFor(source, node, parent, pendingExport);
    if (!candidate && [
      "method_definition", "method_signature", "field_definition", "public_field_definition", "property_signature",
      "variable_declarator", "arrow_function", "function_expression", "generator_function"
    ].includes(node.type)) {
      unsupported = true;
    }
    if (candidate) {
      candidates.push(candidate);
      if (!candidate.signatureSupported) unsupported = true;
      if (node.type === "variable_declarator" && isFunctionInitializer(initializer(node))) {
        // The initializer is represented by the variable candidate itself,
        // while declarations nested in its body retain lexical containment.
        const value = initializer(node);
        for (const child of value?.namedChildren ?? []) visit(child, candidate, false);
        return;
      }
    }
    const nextParent = candidate ?? parent;
    const nextPendingExport = candidate ? false : pendingExport || node.type === "export_statement";
    if (!shouldVisitChildren(node)) return;
    for (const child of node.namedChildren) visit(child, nextParent, nextPendingExport);
  };
  visit(root, null, false);
  candidates.sort(compareBySource);
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    const parentName = candidate.parent?.qualifiedName;
    const qualifiedName = parentName ? `${parentName}.${candidate.name}` : candidate.name;
    candidate.qualifiedName = qualifiedName;
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

function addDetails(records: MutableRecords, sourceRecordId: string, field: "qualifiedName" | "signature", value: string): {reference: {field: "qualifiedName" | "signature"; firstSegmentId: string; segmentCount: number; byteSize: number; contentHash: string}} {
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

function makeFile(file: PortableFileRecord, status: PortableFileRecord["parseStatus"], coverageStatus: PortableFileRecord["coverageStatus"], limitationReason: NonNullable<PortableFileRecord["limitationReason"]>, coordinate?: PortableSourceCoordinate): PortableFileRecord {
  return {
    ...file,
    parseStatus: status,
    coverageStatus,
    limitationReason,
    ...(coordinate ? {coordinate} : {})
  };
}

function emptyFailure(file: PortableFileRecord, status: JavaScriptAdapterFailure["status"], diagnostics: readonly JavaScriptAdapterDiagnostic[]): JavaScriptAdapterFailure {
  return {
    ok: false,
    status,
    file,
    symbols: [],
    imports: [],
    relationships: [],
    details: [],
    diagnostics,
    ruleVersion: JAVASCRIPT_ADAPTER_RULE_VERSION
  };
}

function moduleResolution(file: PortableFileRecord, specifier: string, knownFiles: readonly PortableFileRecord[]): Resolution {
  if (!specifier.startsWith(".")) {
    return {resolutionStatus: "unresolved", targetFileId: null, targetSymbolId: null, unresolvedReason: "external-dependency", certainty: "unknown"};
  }
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), specifier));
  if (base === ".." || base.startsWith("../")) {
    return {resolutionStatus: "unresolved", targetFileId: null, targetSymbolId: null, unresolvedReason: "missing-target", certainty: "unknown"};
  }
  const candidates = new Map<string, PortableFileRecord>();
  const extensions = ["", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"];
  for (const candidate of [base, ...extensions.map(extension => `${base}${extension}`), ...extensions.slice(1).map(extension => `${base}/index${extension}`)]) {
    for (const known of knownFiles) {
      if (known.path === candidate) candidates.set(known.id, known);
    }
  }
  if (candidates.size === 1) {
    return {resolutionStatus: "resolved", targetFileId: candidates.keys().next().value ?? null, targetSymbolId: null, certainty: "supported-inference"};
  }
  if (candidates.size > 1) {
    return {resolutionStatus: "ambiguous", targetFileId: null, targetSymbolId: null, unresolvedReason: "ambiguous-module", certainty: "unknown"};
  }
  return {resolutionStatus: "unresolved", targetFileId: null, targetSymbolId: null, unresolvedReason: "missing-target", certainty: "unknown"};
}

function literalSpecifier(source: Uint8Array, node: SyntaxNodeView | null): {value: string; supported: boolean} | null {
  if (!node) return null;
  const raw = nodeText(source, node);
  const quote = raw[0];
  if (!quote || raw.at(-1) !== quote || !["'", '"'].includes(quote)) return {value: "", supported: false};
  let value = "";
  for (let index = 1; index < raw.length - 1; index += 1) {
    const character = raw[index]!;
    if (character !== "\\") {
      value += character;
      continue;
    }
    const escape = raw[++index];
    if (!escape) return {value: "", supported: false};
    const simple: Record<string, string> = {n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "\\": "\\", "'": "'", '"': '"'};
    if (simple[escape] !== undefined) {
      value += simple[escape];
      continue;
    }
    if (escape === "x") {
      const hex = raw.slice(index + 1, index + 3);
      if (!/^[0-9a-f]{2}$/iu.test(hex)) return {value: "", supported: false};
      value += String.fromCodePoint(Number.parseInt(hex, 16));
      index += 2;
      continue;
    }
    if (escape === "u") {
      if (raw[index + 1] === "{") {
        const close = raw.indexOf("}", index + 2);
        const hex = close < 0 ? "" : raw.slice(index + 2, close);
        if (!/^[0-9a-f]{1,6}$/iu.test(hex)) return {value: "", supported: false};
        value += String.fromCodePoint(Number.parseInt(hex, 16));
        index = close;
      } else {
        const hex = raw.slice(index + 1, index + 5);
        if (!/^[0-9a-f]{4}$/iu.test(hex)) return {value: "", supported: false};
        value += String.fromCodePoint(Number.parseInt(hex, 16));
        index += 4;
      }
      continue;
    }
    if (escape === "\n" || escape === "\r") {
      if (escape === "\r" && raw[index + 1] === "\n") index += 1;
      continue;
    }
    return {value: "", supported: false};
  }
  return {value, supported: true};
}

function recordContentHash(source: Uint8Array, node: SyntaxNodeView): string {
  return digest(source.slice(node.coordinate.start.byte, node.coordinate.end.byte));
}

function importRecord(
  source: Uint8Array,
  file: PortableFileRecord,
  node: SyntaxNodeView,
  kind: "import" | "export" | "reexport",
  specifier: string,
  resolution: Resolution,
  index: number
): PortableImportRelationship {
  return {
    id: stableId("imp-", `${file.path}:${kind}:${specifier}:${node.coordinate.start.byte}:${index}`),
    kind,
    sourceFileId: file.id,
    sourcePath: file.path,
    specifier,
    coordinate: node.coordinate,
    contentHash: recordContentHash(source, node),
    resolutionStatus: resolution.resolutionStatus,
    targetFileId: resolution.targetFileId,
    targetSymbolId: resolution.targetSymbolId,
    ...(resolution.unresolvedReason ? {unresolvedReason: resolution.unresolvedReason} : {}),
    origin: "syntax",
    certainty: resolution.certainty
  };
}

function localSymbolForName(candidates: readonly DeclarationCandidate[], name: string): DeclarationCandidate | null {
  return candidates.find(candidate => candidate.name === name && candidate.parent === null) ?? null;
}

function buildRecords(
  source: Uint8Array,
  file: PortableFileRecord,
  tree: SyntaxTreeView,
  knownFiles: readonly PortableFileRecord[]
): {records: MutableRecords; diagnostics: JavaScriptAdapterDiagnostic[]; partial: boolean} {
  const records: MutableRecords = {symbols: [], imports: [], relationships: [], details: []};
  const diagnostics: JavaScriptAdapterDiagnostic[] = [];
  const collected = collectCandidates(source, tree.rootNode, file.path);
  const explicitExportNames = new Set<string>();
  const collectExplicitExports = (node: SyntaxNodeView): void => {
    if (node.type === "export_statement" && !firstNamed(node, "string")) {
      const clause = firstNamed(node, "export_clause");
      for (const specifier of clause?.namedChildren.filter(child => child.type === "export_specifier") ?? []) {
        const local = specifier.childForFieldName("name") ?? specifier.namedChildren[0];
        if (local) explicitExportNames.add(trimSpace(nodeText(source, local)));
      }
    }
    for (const child of node.namedChildren) collectExplicitExports(child);
  };
  collectExplicitExports(tree.rootNode);
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
      contentHash: recordContentHash(source, candidate.node),
      lexicalParentId: candidate.parent?.id ?? null,
      exported: candidate.exported || (candidate.parent === null && explicitExportNames.has(candidate.name)),
      ...(detailReferences.length > 0 ? {detailReferences} : {})
    };
    const parsed = portableSymbolRecordSchema.safeParse(symbol);
    if (!parsed.success) {
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

  for (const candidate of collected.candidates) {
    const sourceSymbol = candidateToSymbol.get(candidate);
    if (!sourceSymbol || !["class_declaration", "interface_declaration"].includes(candidate.node.type)) continue;
    const clauses: SyntaxNodeView[] = [];
    const heritage = firstNamed(candidate.node, "class_heritage", "extends_type_clause");
    if (heritage) clauses.push(...heritage.namedChildren.filter(child =>
      ["extends_clause", "implements_clause", "extends_type_clause"].includes(child.type)
    ));
    clauses.push(...candidate.node.namedChildren.filter(child =>
      ["extends_clause", "implements_clause", "extends_type_clause"].includes(child.type)
    ));
    for (const clause of clauses) {
      const relationshipKind: "extends" | "implements" = clause.type === "implements_clause" ? "implements" : "extends";
      for (const [targetIndex, targetNode] of clause.namedChildren.entries()) {
        const targetRendered = renderTypeNode(source, targetNode);
        if (!targetRendered.supported || !targetRendered.text || targetRendered.text === "unknown") {
          partial = true;
          continue;
        }
        const targetName = targetRendered.text.replace(/<.*$/u, "");
        const target = localSymbolForName(collected.candidates, targetName);
        const resolution: Resolution = target?.id
          ? {resolutionStatus: "resolved", targetFileId: file.id, targetSymbolId: target.id, certainty: "observed"}
          : {resolutionStatus: "unresolved", targetFileId: null, targetSymbolId: null, unresolvedReason: "missing-target", certainty: "unknown"};
        const relationship: PortableRelationshipRecord = {
          id: stableId("rel-", `${file.path}:${relationshipKind}:${sourceSymbol.id}:${targetName}:${targetIndex}`),
          kind: relationshipKind,
          sourceFileId: file.id,
          sourceSymbolId: sourceSymbol.id,
          sourcePath: file.path,
          coordinate: clause.coordinate,
          contentHash: recordContentHash(source, clause),
          resolutionStatus: resolution.resolutionStatus,
          targetFileId: resolution.targetFileId,
          targetSymbolId: resolution.targetSymbolId,
          ...(resolution.unresolvedReason ? {unresolvedReason: resolution.unresolvedReason} : {}),
          origin: "syntax",
          certainty: resolution.certainty
        };
        if (portableRelationshipRecordSchema.safeParse(relationship).success) records.relationships.push(relationship);
      }
    }
  }

  let importIndex = 0;
  const walkImports = (node: SyntaxNodeView): void => {
    if (node.type === "call_expression" && firstNamed(node, "import")) {
      const dynamicResolution: Resolution = {
        resolutionStatus: "unsupported",
        targetFileId: null,
        targetSymbolId: null,
        unresolvedReason: "dynamic-import",
        certainty: "unknown"
      };
      const record = importRecord(source, file, node, "import", "<dynamic>", dynamicResolution, importIndex++);
      if (portableImportRelationshipSchema.safeParse(record).success) records.imports.push(record);
    }
    if (node.type === "import_statement") {
      const stringNode = firstNamed(node, "string");
      const parsedSpecifier = literalSpecifier(source, stringNode);
      if (parsedSpecifier !== null) {
        const specifier = parsedSpecifier.supported ? parsedSpecifier.value : "<unsupported-literal>";
        const resolution = parsedSpecifier.supported
          ? moduleResolution(file, specifier, knownFiles)
          : {resolutionStatus: "unsupported" as const, targetFileId: null, targetSymbolId: null, unresolvedReason: "unsupported-resolution" as const, certainty: "unknown" as const};
        const record = importRecord(source, file, node, "import", specifier, resolution, importIndex++);
        if (portableImportRelationshipSchema.safeParse(record).success) records.imports.push(record);
      }
    }
    if (node.type === "export_statement") {
      const stringNode = firstNamed(node, "string");
      const parsedSpecifier = literalSpecifier(source, stringNode);
      if (parsedSpecifier !== null) {
        const specifier = parsedSpecifier.supported ? parsedSpecifier.value : "<unsupported-literal>";
        const kind = firstNamed(node, "export_clause") ? "reexport" : "reexport";
        const resolution = parsedSpecifier.supported
          ? moduleResolution(file, specifier, knownFiles)
          : {resolutionStatus: "unsupported" as const, targetFileId: null, targetSymbolId: null, unresolvedReason: "unsupported-resolution" as const, certainty: "unknown" as const};
        const record = importRecord(source, file, node, kind, specifier, resolution, importIndex++);
        if (portableImportRelationshipSchema.safeParse(record).success) records.imports.push(record);
      } else {
        const clause = firstNamed(node, "export_clause");
        for (const specifierNode of clause?.namedChildren.filter(child => child.type === "export_specifier") ?? []) {
          const local = specifierNode.childForFieldName("name") ?? specifierNode.namedChildren[0];
          const alias = specifierNode.childForFieldName("alias");
          const localName = local ? trimSpace(nodeText(source, local)) : "";
          const exported = alias ? trimSpace(nodeText(source, alias)) : localName;
          const target = localSymbolForName(collected.candidates, localName);
          const resolution: Resolution = target && target.id
            ? {resolutionStatus: "resolved", targetFileId: file.id, targetSymbolId: target.id, certainty: "observed"}
            : {resolutionStatus: "unresolved", targetFileId: null, targetSymbolId: null, unresolvedReason: "missing-target", certainty: "unknown"};
          const record = importRecord(source, file, specifierNode, "export", exported || "<export>", resolution, importIndex++);
          if (portableImportRelationshipSchema.safeParse(record).success) records.imports.push(record);
        }
        const declaration = node.namedChildren.find(child => child.type !== "export_clause" && child.type !== "string");
        if (declaration) {
          const isDefault = nodeText(source, node).trimStart().startsWith("export default");
          const targets = collected.candidates.filter(candidate =>
            candidate.startByte >= declaration.coordinate.start.byte &&
            candidate.startByte < declaration.coordinate.end.byte &&
            candidate.parent === null
          );
          const selectedTargets = isDefault ? targets.slice(0, 1) : targets;
          if (selectedTargets.length === 0) {
            const resolution: Resolution = {resolutionStatus: "unresolved", targetFileId: null, targetSymbolId: null, unresolvedReason: "missing-target", certainty: "unknown"};
            const record = importRecord(source, file, node, "export", isDefault ? "default" : "<export>", resolution, importIndex++);
            if (portableImportRelationshipSchema.safeParse(record).success) records.imports.push(record);
          }
          for (const target of selectedTargets) {
            const resolution: Resolution = target.id
              ? {resolutionStatus: "resolved", targetFileId: file.id, targetSymbolId: target.id, certainty: "observed"}
              : {resolutionStatus: "unresolved", targetFileId: null, targetSymbolId: null, unresolvedReason: "missing-target", certainty: "unknown"};
            const record = importRecord(source, file, node, "export", isDefault ? "default" : target.name, resolution, importIndex++);
            if (portableImportRelationshipSchema.safeParse(record).success) records.imports.push(record);
          }
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

function validateRecords(records: AdapterRecords): boolean {
  return records.symbols.every(record => portableSymbolRecordSchema.safeParse(record).success) &&
    records.imports.every(record => portableImportRelationshipSchema.safeParse(record).success) &&
    records.relationships.every(record => portableRelationshipRecordSchema.safeParse(record).success) &&
    records.details.every(record => portableStructuralDetailRecordSchema.safeParse(record).success);
}

/**
 * Extract declaration and syntax records from one JS/JSX/TS/TSX inventory file.
 * The source/tree are transient inputs; neither is retained in the result.
 */
export async function adaptJavaScriptFile(input: JavaScriptAdapterInput): Promise<JavaScriptAdapterResult> {
  const {file, source, knownFiles = []} = input;
  const actualHash = digest(source);
  if (source.byteLength !== file.byteSize || actualHash !== file.contentHash) {
    return emptyFailure(file, "stale", [{code: "source-mismatch", message: "Source bytes do not match the inventory record."}]);
  }
  if (!languageSupported(file.language)) {
    return emptyFailure(file, "unsupported", [{code: "unsupported-language", message: "The JavaScript-family adapter does not support this language."}]);
  }
  if (source.byteLength > JAVASCRIPT_ADAPTER_MAX_FILE_BYTES) {
    return {
      ok: false,
      status: "invalid",
      file: makeFile(file, "skipped", "file", "too-large"),
      symbols: [],
      imports: [],
      relationships: [],
      details: [],
      diagnostics: [{code: "too-large", message: "Files above the default one MiB extraction limit retain file-level coverage only."}],
      ruleVersion: JAVASCRIPT_ADAPTER_RULE_VERSION
    };
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(source);
  } catch {
    return emptyFailure(makeFile(file, "failed", "none", "parse-error"), "invalid", [{code: "invalid-utf8", message: "Source bytes are not valid UTF-8."}]);
  }
  const boundary = inspectContentBoundaries(text);
  if (!boundary.safe) {
    return {
      ok: true,
      status: "partial",
      file: makeFile(file, "partial", "file", "unsafe-content"),
      symbols: [],
      imports: [],
      relationships: [],
      details: [],
      diagnostics: [{code: "unsafe-content", message: "Source content crossed a content boundary; structural extraction was omitted."}],
      ruleVersion: JAVASCRIPT_ADAPTER_RULE_VERSION
    };
  }
  try {
    return await withParsedSource(file.language, source, tree => {
      const extracted = buildRecords(source, file, tree, knownFiles);
      const records: AdapterRecords = extracted.records;
      if (!validateRecords(records)) {
        return emptyFailure(makeFile(file, "failed", "none", "parse-error"), "invalid", [{code: "invalid-output", message: "Adapter output did not satisfy the portable record contracts."}]);
      }
      const fileCoordinate: PortableSourceCoordinate = {
        start: {line: 1, column: 0, byte: 0},
        end: tree.rootNode.coordinate.end
      };
      const updatedFile = makeFile(file, extracted.partial ? "partial" : "parsed", extracted.partial ? "file" : "full", extracted.partial ? (extracted.diagnostics.some(item => item.code === "unsafe-content") ? "unsafe-content" : extracted.diagnostics.some(item => item.code === "unsupported-construct") ? "unsupported-construct" : "parse-error") : "none", fileCoordinate);
      return {
        ok: true,
        status: extracted.partial ? "partial" : "complete",
        file: updatedFile,
        symbols: records.symbols,
        imports: records.imports,
        relationships: records.relationships,
        details: records.details,
        diagnostics: extracted.diagnostics,
        ruleVersion: JAVASCRIPT_ADAPTER_RULE_VERSION
      };
    });
  } catch {
    return emptyFailure(makeFile(file, "failed", "none", "parse-error"), "invalid", [{code: "parse-error", message: "The pinned parser could not analyze this file."}]);
  }
}

export const extractJavaScriptFile = adaptJavaScriptFile;
export const analyzeJavaScriptFile = adaptJavaScriptFile;
