import {createHash} from "node:crypto";

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

/** Java extraction is tied to the bundled Java grammar and parser contract. */
export const JAVA_ADAPTER_RULE_VERSION = "java-declarations-v1/tree-sitter-0.27.0" as const;
export const JAVA_ADAPTER_SUPPORTED_LANGUAGES = ["java"] as const;
export const JAVA_ADAPTER_MAX_FILE_BYTES = 1 * 1024 * 1024;

type JavaLanguage = typeof JAVA_ADAPTER_SUPPORTED_LANGUAGES[number];

export type JavaAdapterInput = {
  readonly file: PortableFileRecord;
  readonly source: Uint8Array;
  readonly knownFiles?: readonly PortableFileRecord[];
};

export type JavaAdapterDiagnosticCode =
  | "source-mismatch"
  | "unsupported-language"
  | "too-large"
  | "invalid-utf8"
  | "unsafe-content"
  | "parse-error"
  | "unsupported-construct"
  | "invalid-output";

export type JavaAdapterDiagnostic = {
  readonly code: JavaAdapterDiagnosticCode;
  readonly message: string;
};

export type JavaAdapterSuccess = {
  readonly ok: true;
  readonly status: "complete" | "partial";
  readonly file: PortableFileRecord;
  readonly symbols: readonly PortableSymbolRecord[];
  readonly imports: readonly PortableImportRelationship[];
  readonly relationships: readonly PortableRelationshipRecord[];
  readonly details: readonly PortableStructuralDetailRecord[];
  readonly diagnostics: readonly JavaAdapterDiagnostic[];
  readonly ruleVersion: typeof JAVA_ADAPTER_RULE_VERSION;
};

export type JavaAdapterFailure = {
  readonly ok: false;
  readonly status: "stale" | "unsupported" | "invalid";
  readonly file: PortableFileRecord;
  readonly symbols: readonly [];
  readonly imports: readonly [];
  readonly relationships: readonly [];
  readonly details: readonly [];
  readonly diagnostics: readonly JavaAdapterDiagnostic[];
  readonly ruleVersion: typeof JAVA_ADAPTER_RULE_VERSION;
};

export type JavaAdapterResult = JavaAdapterSuccess | JavaAdapterFailure;

type Rendered = {text: string; supported: boolean};
const rendered = (text: string, supported = true): Rendered => ({text, supported});

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

function languageSupported(value: PortableLanguage): value is JavaLanguage {
  return (JAVA_ADAPTER_SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

function firstNamed(node: SyntaxNodeView, ...types: string[]): SyntaxNodeView | null {
  return node.namedChildren.find(child => types.includes(child.type)) ?? null;
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

function identifierName(source: Uint8Array, node: SyntaxNodeView | null): string | null {
  if (!node) return null;
  const value = trimSpace(nodeText(source, node));
  return value.length > 0 ? value : null;
}

function nameNode(node: SyntaxNodeView): SyntaxNodeView | null {
  return node.childForFieldName("name") ?? firstNamed(node, "identifier", "type_identifier");
}

function declarationName(source: Uint8Array, node: SyntaxNodeView): string | null {
  return identifierName(source, nameNode(node));
}

function isPublic(node: SyntaxNodeView): boolean {
  const modifiers = node.childForFieldName("modifiers") ?? firstNamed(node, "modifiers");
  return Boolean(modifiers?.children.some(child => child.type === "public"));
}

function childrenOfType(node: SyntaxNodeView, ...types: string[]): SyntaxNodeView[] {
  return node.namedChildren.filter(child => types.includes(child.type));
}

function renderType(source: Uint8Array, node: SyntaxNodeView | null): Rendered {
  if (!node) return rendered("", true);
  const children = node.namedChildren;
  if ([
    "identifier", "type_identifier", "integral_type", "floating_point_type", "boolean_type", "void_type",
    "scoped_identifier", "scoped_type_identifier", "type_parameter"
  ].includes(node.type)) {
    if (node.type === "scoped_identifier" || node.type === "scoped_type_identifier") {
      const parts = children.map(child => renderType(source, child));
      return rendered(parts.map(part => part.text).filter(Boolean).join("."), parts.every(part => part.supported));
    }
    if (node.type === "type_parameter") {
      const name = renderType(source, children[0] ?? null);
      const bound = children.find(child => child.type === "type_bound");
      const boundRendered = bound ? renderType(source, bound) : rendered("", true);
      return rendered(`${name.text}${boundRendered.text ? ` extends ${boundRendered.text}` : ""}`, name.supported && boundRendered.supported);
    }
    return rendered(trimSpace(nodeText(source, node)));
  }
  if (node.type === "generic_type") {
    const base = renderType(source, children[0] ?? null);
    const args = children.find(child => child.type === "type_arguments");
    const renderedArgs = args ? args.namedChildren.map(child => renderType(source, child)) : [];
    return rendered(`${base.text}${args ? `<${renderedArgs.map(item => item.text).join(", ")}>` : ""}`, base.supported && renderedArgs.every(item => item.supported));
  }
  if (node.type === "type_arguments" || node.type === "type_list" || node.type === "super_interfaces") {
    const parts = children.map(child => renderType(source, child));
    return rendered(parts.map(item => item.text).join(", "), parts.every(item => item.supported));
  }
  if (node.type === "type_bound") {
    const parts = children.map(child => renderType(source, child));
    return rendered(parts.map(item => item.text).join(" & "), parts.every(item => item.supported));
  }
  if (node.type === "array_type") {
    const base = renderType(source, children[0] ?? null);
    const dimensions = children.find(child => child.type === "dimensions");
    const count = dimensions ? Math.max(1, (nodeText(source, dimensions).match(/\[\]/gu) ?? []).length) : 1;
    return rendered(`${base.text}${"[]".repeat(count)}`, base.supported);
  }
  if (node.type === "wildcard") {
    const bound = children[0] ? renderType(source, children[0]) : rendered("", true);
    const operator = node.children.some(child => child.type === "extends") ? " extends "
      : node.children.some(child => child.type === "super") ? " super " : "";
    return rendered(`?${operator}${bound.text}`, bound.supported);
  }
  if (node.type === "type") return renderType(source, children[0] ?? null);
  // Annotation arguments, literals, invocations, and arbitrary expressions
  // are deliberately not structural types.
  return rendered("unknown", false);
}

function renderTypeParameters(source: Uint8Array, node: SyntaxNodeView | null): Rendered {
  if (!node) return rendered("");
  const parts = node.namedChildren.map(child => renderType(source, child));
  return rendered(`<${parts.map(item => item.text).join(", ")}>`, parts.every(item => item.supported));
}

function renderParameter(source: Uint8Array, node: SyntaxNodeView): Rendered {
  if (node.type === "formal_parameter") {
    const type = renderType(source, node.childForFieldName("type"));
    const name = identifierName(source, node.childForFieldName("name") ?? firstNamed(node, "identifier"));
    return rendered(`${type.text}${name ? ` ${name}` : ""}`, type.supported && Boolean(name));
  }
  if (node.type === "spread_parameter") {
    const type = renderType(source, firstNamed(node, "type_identifier", "integral_type", "floating_point_type", "generic_type", "array_type", "scoped_type_identifier"));
    const declarator = node.childForFieldName("name") ?? firstNamed(node, "variable_declarator");
    const name = identifierName(source, declarator?.childForFieldName("name") ?? firstNamed(declarator ?? node, "identifier"));
    return rendered(`${type.text}...${name ? ` ${name}` : ""}`, type.supported && Boolean(name));
  }
  if (node.type === "receiver_parameter") {
    const type = renderType(source, node.childForFieldName("type"));
    const name = identifierName(source, node.childForFieldName("name"));
    return rendered(`${type.text}${name ? ` ${name}` : ""}`, type.supported);
  }
  return rendered("unknown", false);
}

function renderParameters(source: Uint8Array, node: SyntaxNodeView | null): Rendered {
  if (!node) return rendered("()", true);
  const parts = node.namedChildren.filter(child => ["formal_parameter", "spread_parameter", "receiver_parameter"].includes(child.type)).map(child => renderParameter(source, child));
  const unsupported = node.namedChildren.some(child => !["formal_parameter", "spread_parameter", "receiver_parameter"].includes(child.type));
  return rendered(`(${parts.map(item => item.text).join(", ")})`, !unsupported && parts.every(item => item.supported));
}

function renderHeritage(source: Uint8Array, node: SyntaxNodeView | null, prefix: "extends" | "implements"): Rendered {
  if (!node) return rendered("");
  const targetList = node.type === "type_list" ? node : firstNamed(node, "type_list");
  const targets = (targetList?.namedChildren ?? node.namedChildren.filter(child => !["extends", "implements"].includes(child.type))).map(child => renderType(source, child));
  return rendered(`${prefix} ${targets.map(item => item.text).join(", ")}`, targets.length > 0 && targets.every(item => item.supported));
}

function renderDeclarationModifiers(source: Uint8Array, node: SyntaxNodeView): Rendered {
  const modifiers = node.childForFieldName("modifiers") ?? firstNamed(node, "modifiers");
  if (!modifiers) return rendered("");
  const allowed = new Set(["public", "protected", "private", "abstract", "final", "static", "sealed", "non-sealed", "strictfp"]);
  const values = modifiers.children
    .filter(child => allowed.has(child.type))
    .map(child => trimSpace(nodeText(source, child)))
    .filter(Boolean);
  const unsupported = modifiers.namedChildren.some(child => !allowed.has(child.type));
  return rendered(values.join(" "), !unsupported);
}

function renderThrows(source: Uint8Array, node: SyntaxNodeView): Rendered {
  const throwsNode = node.childForFieldName("throws") ?? firstNamed(node, "throws");
  if (!throwsNode) return rendered("");
  const targets = throwsNode.namedChildren.map(child => renderType(source, child));
  return rendered(`throws ${targets.map(item => item.text).join(", ")}`, targets.length > 0 && targets.every(item => item.supported));
}

function renderPermits(source: Uint8Array, node: SyntaxNodeView): Rendered {
  const permitsNode = node.childForFieldName("permits") ?? firstNamed(node, "permits");
  if (!permitsNode) return rendered("");
  const list = permitsNode.type === "type_list" ? permitsNode : firstNamed(permitsNode, "type_list");
  const targets = (list?.namedChildren ?? permitsNode.namedChildren).map(child => renderType(source, child));
  return rendered(`permits ${targets.map(item => item.text).join(", ")}`, targets.length > 0 && targets.every(item => item.supported));
}

function signatureForType(source: Uint8Array, node: SyntaxNodeView, kind: PortableSymbolKind, name: string): Rendered {
  const typeParameters = renderTypeParameters(source, node.childForFieldName("type_parameters"));
  if (kind === "module") return rendered(`package ${name}`);
  if (node.type === "record_declaration") {
    const modifiers = renderDeclarationModifiers(source, node);
    const typeParameters = renderTypeParameters(source, node.childForFieldName("type_parameters") ?? firstNamed(node, "type_parameters"));
    const parameters = renderParameters(source, node.childForFieldName("parameters"));
    const heritage = renderHeritage(source, node.childForFieldName("super_interfaces") ?? firstNamed(node, "super_interfaces"), "implements");
    const permits = renderPermits(source, node);
    return rendered(`${modifiers.text ? `${modifiers.text} ` : ""}record ${name}${typeParameters.text}${parameters.text}${heritage.text ? ` ${heritage.text}` : ""}${permits.text ? ` ${permits.text}` : ""}`, modifiers.supported && typeParameters.supported && parameters.supported && heritage.supported && permits.supported);
  }
  if (kind === "class" || kind === "interface" || kind === "enum") {
    const modifiers = renderDeclarationModifiers(source, node);
    const keyword = node.type === "annotation_type_declaration" ? "@interface" : kind;
    const heritage: Rendered[] = [];
    if (kind === "class") {
      heritage.push(renderHeritage(source, node.childForFieldName("superclass") ?? firstNamed(node, "superclass"), "extends"));
      heritage.push(renderHeritage(source, node.childForFieldName("interfaces") ?? node.childForFieldName("super_interfaces") ?? firstNamed(node, "super_interfaces"), "implements"));
    } else if (kind === "interface") {
      heritage.push(renderHeritage(source, node.childForFieldName("extends_interfaces") ?? firstNamed(node, "extends_interfaces"), "extends"));
    } else if (kind === "enum") {
      heritage.push(renderHeritage(source, node.childForFieldName("interfaces") ?? node.childForFieldName("super_interfaces") ?? firstNamed(node, "super_interfaces"), "implements"));
    }
    const permits = renderPermits(source, node);
    return rendered(`${modifiers.text ? `${modifiers.text} ` : ""}${keyword} ${name}${typeParameters.text}${heritage.filter(item => item.text).map(item => ` ${item.text}`).join("")}${permits.text ? ` ${permits.text}` : ""}`, modifiers.supported && typeParameters.supported && heritage.every(item => item.supported) && permits.supported);
  }
  if (kind === "type") {
    return rendered(`record ${name}${typeParameters.text}`, typeParameters.supported);
  }
  if (node.type === "method_declaration") {
    const typeParameters = renderTypeParameters(source, node.childForFieldName("type_parameters") ?? firstNamed(node, "type_parameters"));
    const type = renderType(source, node.childForFieldName("type"));
    const parameters = renderParameters(source, node.childForFieldName("parameters"));
    const throws = renderThrows(source, node);
    return rendered(`${typeParameters.text}${type.text} ${name}${parameters.text}${throws.text ? ` ${throws.text}` : ""}`, typeParameters.supported && type.supported && parameters.supported && throws.supported);
  }
  if (node.type === "constructor_declaration" || node.type === "compact_constructor_declaration") {
    const typeParameters = renderTypeParameters(source, node.childForFieldName("type_parameters") ?? firstNamed(node, "type_parameters"));
    const parameters = renderParameters(source, node.childForFieldName("parameters"));
    const throws = renderThrows(source, node);
    return rendered(`${typeParameters.text}${name}${parameters.text}${throws.text ? ` ${throws.text}` : ""}`, typeParameters.supported && parameters.supported && throws.supported);
  }
  if (node.type === "annotation_type_element_declaration") {
    const type = renderType(source, node.childForFieldName("type"));
    return rendered(`${type.text} ${name}()`, type.supported);
  }
  return rendered(name);
}

function signatureForField(source: Uint8Array, declaration: SyntaxNodeView, name: string): Rendered {
  const type = renderType(source, declaration.childForFieldName("type"));
  return rendered(`${type.text} ${name}`, type.supported);
}

function isTypeDeclaration(node: SyntaxNodeView): boolean {
  return ["class_declaration", "interface_declaration", "enum_declaration", "record_declaration", "annotation_type_declaration"].includes(node.type);
}

function typeKind(node: SyntaxNodeView): PortableSymbolKind {
  if (node.type === "class_declaration") return "class";
  if (node.type === "interface_declaration" || node.type === "annotation_type_declaration") return "interface";
  if (node.type === "enum_declaration") return "enum";
  return "type";
}

function exportedFor(node: SyntaxNodeView, parent: DeclarationCandidate | null): boolean {
  return isPublic(node) || (parent === null && isPublic(node));
}

function makeCandidate(node: SyntaxNodeView, parent: DeclarationCandidate | null, kind: PortableSymbolKind, name: string, signature: Rendered, exported: boolean): DeclarationCandidate {
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

function fieldCandidates(source: Uint8Array, node: SyntaxNodeView, parent: DeclarationCandidate): DeclarationCandidate[] {
  const modifiers = node.childForFieldName("modifiers") ?? firstNamed(node, "modifiers");
  const isConstant = node.type === "constant_declaration" || Boolean(modifiers?.children.some(child => child.type === "static")) && Boolean(modifiers?.children.some(child => child.type === "final"));
  const kind: PortableSymbolKind = isConstant ? "constant" : "field";
  return node.namedChildren.filter(child => child.type === "variable_declarator").flatMap(declarator => {
    const name = identifierName(source, declarator.childForFieldName("name") ?? firstNamed(declarator, "identifier"));
    return name ? [makeCandidate(declarator, parent, kind, name, signatureForField(source, node, name), isPublic(node))] : [];
  });
}

function methodCandidate(source: Uint8Array, node: SyntaxNodeView, parent: DeclarationCandidate): DeclarationCandidate | null {
  const name = declarationName(source, node);
  if (!name) return null;
  const kind: PortableSymbolKind = ["constructor_declaration", "compact_constructor_declaration"].includes(node.type) ? "constructor" : "method";
  return makeCandidate(node, parent, kind, name, signatureForType(source, node, kind, name), isPublic(node));
}

function typeCandidate(source: Uint8Array, node: SyntaxNodeView, parent: DeclarationCandidate | null): DeclarationCandidate | null {
  const name = declarationName(source, node);
  if (!name) return null;
  const kind = typeKind(node);
  return makeCandidate(node, parent, kind, name, signatureForType(source, node, kind, name), exportedFor(node, parent));
}

function enumConstantCandidate(source: Uint8Array, node: SyntaxNodeView, parent: DeclarationCandidate): DeclarationCandidate | null {
  const name = declarationName(source, node);
  return name ? makeCandidate(node, parent, "constant", name, rendered(name), isPublic(node)) : null;
}

function recordComponentCandidates(source: Uint8Array, node: SyntaxNodeView, parent: DeclarationCandidate): DeclarationCandidate[] {
  if (node.type !== "record_declaration") return [];
  const parameters = node.childForFieldName("parameters");
  return (parameters?.namedChildren ?? []).filter(child => child.type === "formal_parameter").flatMap(parameter => {
    const name = identifierName(source, parameter.childForFieldName("name") ?? firstNamed(parameter, "identifier"));
    return name ? [makeCandidate(parameter, parent, "field", name, signatureForField(source, parameter, name), parent.exported)] : [];
  });
}

/** Walk direct type members, then method bodies only for local type declarations. */
function visitTypeBody(source: Uint8Array, node: SyntaxNodeView, parent: DeclarationCandidate, candidates: DeclarationCandidate[], state: {unsupported: boolean}): void {
  const body = node.childForFieldName("body") ?? firstNamed(node, "class_body", "interface_body", "enum_body", "annotation_type_body");
  if (!body) return;
  const visitMember = (member: SyntaxNodeView): void => {
    if (isTypeDeclaration(member)) {
      const candidate = typeCandidate(source, member, parent);
      if (candidate) {
        candidates.push(candidate);
        if (!candidate.signatureSupported) state.unsupported = true;
        visitTypeBody(source, member, candidate, candidates, state);
      }
      return;
    }
    if (["field_declaration", "constant_declaration"].includes(member.type)) {
      const fields = fieldCandidates(source, member, parent);
      candidates.push(...fields);
      if (fields.some(field => !field.signatureSupported)) state.unsupported = true;
      return;
    }
    if (member.type === "enum_constant") {
      const candidate = enumConstantCandidate(source, member, parent);
      if (candidate) candidates.push(candidate);
      return;
    }
    if (["method_declaration", "constructor_declaration", "compact_constructor_declaration", "annotation_type_element_declaration"].includes(member.type)) {
      const candidate = methodCandidate(source, member, parent);
      if (candidate) {
        candidates.push(candidate);
        if (!candidate.signatureSupported) state.unsupported = true;
        const methodBody = member.childForFieldName("body") ?? firstNamed(member, "block", "constructor_body");
        if (methodBody) visitLocalTypes(source, methodBody, candidate, candidates, state);
      }
      return;
    }
    if (member.type === "enum_body_declarations") {
      for (const child of member.namedChildren) visitMember(child);
      return;
    }
    // Keep coverage honest when a valid direct member form is outside the
    // whitelisted structural surface.  Do not inspect or echo its payload.
    state.unsupported = true;
  };
  for (const member of body.namedChildren) visitMember(member);
  candidates.push(...recordComponentCandidates(source, node, parent));
}

/** Search statement blocks for named local types while skipping expressions. */
function visitLocalTypes(source: Uint8Array, node: SyntaxNodeView, parent: DeclarationCandidate, candidates: DeclarationCandidate[], state: {unsupported: boolean}): void {
  if (["object_creation_expression", "method_invocation", "argument_list", "annotation", "marker_annotation", "modifiers", "lambda_expression", "variable_declarator"].includes(node.type)) return;
  if (isTypeDeclaration(node)) {
    const candidate = typeCandidate(source, node, parent);
    if (candidate) {
      candidates.push(candidate);
      if (!candidate.signatureSupported) state.unsupported = true;
      visitTypeBody(source, node, candidate, candidates, state);
    }
    return;
  }
  for (const child of node.namedChildren) visitLocalTypes(source, child, parent, candidates, state);
}

function collectCandidates(source: Uint8Array, root: SyntaxNodeView, identityPath: string): {candidates: DeclarationCandidate[]; unsupported: boolean} {
  const candidates: DeclarationCandidate[] = [];
  const state = {unsupported: false};
  const packageNode = firstNamed(root, "package_declaration");
  if (packageNode) {
    const name = packageNode.namedChildren.find(child => ["identifier", "scoped_identifier"].includes(child.type));
    const packageName = identifierName(source, name ?? null);
    if (packageName) candidates.push(makeCandidate(packageNode, null, "module", packageName, rendered(`package ${packageName}`), false));
  }
  const visitTop = (node: SyntaxNodeView): void => {
    if (isTypeDeclaration(node)) {
      const candidate = typeCandidate(source, node, null);
      if (candidate) {
        candidates.push(candidate);
        if (!candidate.signatureSupported) state.unsupported = true;
        visitTypeBody(source, node, candidate, candidates, state);
      }
      return;
    }
    for (const child of node.namedChildren) {
      if (!["package_declaration", "import_declaration"].includes(child.type)) visitTop(child);
    }
  };
  for (const child of root.namedChildren) visitTop(child);
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
  return {candidates, unsupported: state.unsupported};
}

function splitUtf8(value: string): string[] {
  const segments: string[] = [];
  let current = "";
  for (const character of value) {
    if (Buffer.byteLength(current + character, "utf8") > PORTABLE_MAP_MAX_STRUCTURAL_DETAIL_SEGMENT_BYTES && current.length > 0) {
      segments.push(current);
      current = character;
    } else current += character;
  }
  if (current.length > 0) segments.push(current);
  return segments.length > 0 ? segments : [""];
}

function addDetails(records: MutableRecords, sourceRecordId: string, field: "qualifiedName" | "signature", value: string): {reference: {field: "qualifiedName" | "signature"; firstSegmentId: string; segmentCount: number; byteSize: number; contentHash: string}} {
  const pieces = splitUtf8(value);
  const ids = pieces.map((_, index) => stableId("det-", `${sourceRecordId}:${field}:${index}`));
  for (const [index, text] of pieces.entries()) {
    records.details.push({
      id: ids[index]!, sourceRecordId, field, segmentIndex: index, segmentCount: pieces.length,
      text, byteSize: Buffer.byteLength(text, "utf8"), contentHash: digest(text),
      previousSegmentId: index === 0 ? null : ids[index - 1]!,
      nextSegmentId: index === pieces.length - 1 ? null : ids[index + 1]!
    });
  }
  return {reference: {field, firstSegmentId: ids[0]!, segmentCount: pieces.length, byteSize: Buffer.byteLength(value, "utf8"), contentHash: digest(value)}};
}

function safeStructuralValue(value: string): boolean {
  return inspectContentBoundaries(value).safe && !/[\u0000]/u.test(value);
}

function makeFile(file: PortableFileRecord, status: PortableFileRecord["parseStatus"], coverageStatus: PortableFileRecord["coverageStatus"], limitationReason: NonNullable<PortableFileRecord["limitationReason"]>, coordinate?: PortableSourceCoordinate): PortableFileRecord {
  return {...file, parseStatus: status, coverageStatus, limitationReason, ...(coordinate ? {coordinate} : {})};
}

function emptyFailure(file: PortableFileRecord, status: JavaAdapterFailure["status"], diagnostics: readonly JavaAdapterDiagnostic[]): JavaAdapterFailure {
  return {ok: false, status, file, symbols: [], imports: [], relationships: [], details: [], diagnostics, ruleVersion: JAVA_ADAPTER_RULE_VERSION};
}

function importResolution(file: PortableFileRecord, specifier: string, knownFiles: readonly PortableFileRecord[], isStatic = false): Resolution {
  const wildcard = specifier.endsWith(".*");
  const targetName = wildcard ? specifier.slice(0, -2) : specifier;
  const parts = targetName.split(".");
  const classPath = (wildcard ? targetName : isStatic ? parts.slice(0, -1).join(".") : targetName).replaceAll(".", "/");
  if (wildcard) {
    return {resolutionStatus: "unsupported", targetFileId: null, targetSymbolId: null, unresolvedReason: "unsupported-resolution", certainty: "unknown"};
  }
  if (!classPath) return {resolutionStatus: "unresolved", targetFileId: null, targetSymbolId: null, unresolvedReason: "external-dependency", certainty: "unknown"};
  const expectedPath = `${classPath}.java`;
  const candidates = knownFiles.filter(known => known.path === expectedPath || known.path.endsWith(`/${expectedPath}`));
  const unique = new Map(candidates.map(candidate => [candidate.id, candidate]));
  if (unique.size === 1) return {resolutionStatus: "resolved", targetFileId: unique.keys().next().value ?? null, targetSymbolId: null, certainty: "supported-inference"};
  if (unique.size > 1) return {resolutionStatus: "ambiguous", targetFileId: null, targetSymbolId: null, unresolvedReason: "ambiguous-module", certainty: "unknown"};
  return {resolutionStatus: "unresolved", targetFileId: null, targetSymbolId: null, unresolvedReason: "external-dependency", certainty: "unknown"};
}

function recordContentHash(source: Uint8Array, node: SyntaxNodeView): string {
  return digest(source.slice(node.coordinate.start.byte, node.coordinate.end.byte));
}

function importRecord(source: Uint8Array, file: PortableFileRecord, node: SyntaxNodeView, specifier: string, resolution: Resolution, index: number): PortableImportRelationship {
  return {
    id: stableId("imp-", `${file.path}:import:${specifier}:${node.coordinate.start.byte}:${index}`),
    kind: "import", sourceFileId: file.id, sourcePath: file.path, specifier, coordinate: node.coordinate,
    contentHash: recordContentHash(source, node), resolutionStatus: resolution.resolutionStatus,
    targetFileId: resolution.targetFileId, targetSymbolId: resolution.targetSymbolId,
    ...(resolution.unresolvedReason ? {unresolvedReason: resolution.unresolvedReason} : {}), origin: "syntax", certainty: resolution.certainty
  };
}

function importSpecifier(source: Uint8Array, node: SyntaxNodeView): string | null {
  const names = node.namedChildren.filter(child => ["scoped_identifier", "identifier"].includes(child.type));
  const first = names[0];
  if (!first) return null;
  let value = trimSpace(nodeText(source, first));
  if (node.namedChildren.some(child => child.type === "asterisk")) value += ".*";
  return value.length > 0 ? value : null;
}

function localTarget(candidates: readonly DeclarationCandidate[], name: string): DeclarationCandidate | null {
  const short = name.split(".").at(-1) ?? name;
  return candidates.find(candidate => candidate.parent === null && ["class", "interface", "enum", "type"].includes(candidate.kind) && (candidate.name === short || candidate.qualifiedName === name)) ?? null;
}

function typeRelationship(source: Uint8Array, file: PortableFileRecord, node: SyntaxNodeView, candidate: DeclarationCandidate, targetNode: SyntaxNodeView, kind: "extends" | "implements", candidates: readonly DeclarationCandidate[], knownFiles: readonly PortableFileRecord[], index: number): PortableRelationshipRecord {
  const targetRendered = renderType(source, targetNode);
  const targetName = targetRendered.text.replace(/<.*$/u, "");
  const local = targetRendered.supported ? localTarget(candidates, targetName) : null;
  const resolution: Resolution = !targetRendered.supported || !targetName || targetName === "unknown"
    ? {resolutionStatus: "unsupported", targetFileId: null, targetSymbolId: null, unresolvedReason: "unsupported-resolution", certainty: "unknown"}
    : local?.id
      ? {resolutionStatus: "resolved", targetFileId: file.id, targetSymbolId: local.id, certainty: "observed"}
      : targetName.includes(".") && importResolution(file, targetName, knownFiles).targetFileId
        ? {...importResolution(file, targetName, knownFiles), targetSymbolId: null}
        : {resolutionStatus: "unresolved", targetFileId: null, targetSymbolId: null, unresolvedReason: "missing-target", certainty: "unknown"};
  return {
    id: stableId("rel-", `${file.path}:${kind}:${candidate.id}:${targetName}:${index}`), kind,
    sourceFileId: file.id, sourceSymbolId: candidate.id ?? null, sourcePath: file.path,
    coordinate: node.coordinate, contentHash: recordContentHash(source, node),
    resolutionStatus: resolution.resolutionStatus, targetFileId: resolution.targetFileId, targetSymbolId: resolution.targetSymbolId,
    ...(resolution.unresolvedReason ? {unresolvedReason: resolution.unresolvedReason} : {}), origin: "syntax", certainty: resolution.certainty
  };
}

function buildRecords(source: Uint8Array, file: PortableFileRecord, tree: SyntaxTreeView, knownFiles: readonly PortableFileRecord[]): {records: MutableRecords; diagnostics: JavaAdapterDiagnostic[]; partial: boolean} {
  const records: MutableRecords = {symbols: [], imports: [], relationships: [], details: []};
  const diagnostics: JavaAdapterDiagnostic[] = [];
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
      id, fileId: file.id, path: file.path, ...(inlineName ? {qualifiedName: inlineName} : {}), kind: candidate.kind,
      ...(inlineSignature !== undefined ? {signature: inlineSignature} : {}), coordinate: candidate.node.coordinate,
      contentHash: recordContentHash(source, candidate.node), lexicalParentId: candidate.parent?.id ?? null,
      exported: candidate.exported, ...(detailReferences.length > 0 ? {detailReferences} : {})
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
      id: stableId("rel-", `${file.path}:contains:${parent.id}:${child.id}`), kind: "contains", sourceFileId: file.id,
      sourceSymbolId: parent.id, sourcePath: file.path, coordinate: child.coordinate, contentHash: child.contentHash,
      resolutionStatus: "resolved", targetFileId: file.id, targetSymbolId: child.id, origin: "syntax", certainty: "observed"
    };
    if (portableRelationshipRecordSchema.safeParse(relationship).success) records.relationships.push(relationship);
  }
  for (const candidate of collected.candidates) {
    const sourceSymbol = candidateToSymbol.get(candidate);
    if (!sourceSymbol || !["class", "interface", "enum", "type"].includes(candidate.kind)) continue;
    const heritage: Array<{node: SyntaxNodeView; kind: "extends" | "implements"}> = [];
    if (candidate.node.type === "class_declaration") {
      const superclass = candidate.node.childForFieldName("superclass") ?? firstNamed(candidate.node, "superclass");
      const target = superclass ? firstNamed(superclass, "type_identifier", "scoped_type_identifier", "generic_type") : null;
      if (target) heritage.push({node: target, kind: "extends"});
      const interfaces = candidate.node.childForFieldName("interfaces") ?? candidate.node.childForFieldName("super_interfaces") ?? firstNamed(candidate.node, "super_interfaces");
      for (const item of interfaces?.namedChildren.flatMap(child => child.type === "type_list" ? child.namedChildren : [child]) ?? []) heritage.push({node: item, kind: "implements"});
    } else if (candidate.node.type === "interface_declaration") {
      const interfaces = candidate.node.childForFieldName("extends_interfaces") ?? firstNamed(candidate.node, "extends_interfaces");
      for (const item of interfaces?.namedChildren.flatMap(child => child.type === "type_list" ? child.namedChildren : [child]) ?? []) heritage.push({node: item, kind: "extends"});
    } else if (candidate.node.type === "enum_declaration" || candidate.node.type === "record_declaration") {
      const interfaces = candidate.node.childForFieldName("super_interfaces") ?? firstNamed(candidate.node, "super_interfaces");
      for (const item of interfaces?.namedChildren.flatMap(child => child.type === "type_list" ? child.namedChildren : [child]) ?? []) heritage.push({node: item, kind: "implements"});
    }
    heritage.forEach((item, index) => {
      const relationship = typeRelationship(source, file, item.node, candidate, item.node, item.kind, collected.candidates, knownFiles, index);
      if (portableRelationshipRecordSchema.safeParse(relationship).success) records.relationships.push(relationship);
      if (relationship.resolutionStatus === "unsupported") partial = true;
    });
  }
  let importIndex = 0;
  for (const node of tree.rootNode.namedChildren.filter(child => child.type === "import_declaration")) {
    const specifier = importSpecifier(source, node);
    if (!specifier || !safeStructuralValue(specifier)) {
      partial = true;
      diagnostics.push({code: "unsupported-construct", message: "An import declaration could not be represented safely."});
      continue;
    }
    const resolution = importResolution(file, specifier, knownFiles, node.children.some(child => child.type === "static"));
    const record = importRecord(source, file, node, specifier, resolution, importIndex++);
    if (portableImportRelationshipSchema.safeParse(record).success) records.imports.push(record);
  }
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

/** Extract Java declarations and syntax relationships without retaining source bodies. */
export async function adaptJavaFile(input: JavaAdapterInput): Promise<JavaAdapterResult> {
  const {file, source, knownFiles = []} = input;
  if (source.byteLength !== file.byteSize || digest(source) !== file.contentHash) return emptyFailure(file, "stale", [{code: "source-mismatch", message: "Source bytes do not match the inventory record."}]);
  if (!languageSupported(file.language)) return emptyFailure(makeFile(file, "unsupported", "file", "unsupported-language"), "unsupported", [{code: "unsupported-language", message: "The Java adapter supports Java files only."}]);
  if (source.byteLength > JAVA_ADAPTER_MAX_FILE_BYTES) {
    return {ok: false, status: "invalid", file: makeFile(file, "skipped", "file", "too-large"), symbols: [], imports: [], relationships: [], details: [], diagnostics: [{code: "too-large", message: "Files above the default one MiB extraction limit retain file-level coverage only."}], ruleVersion: JAVA_ADAPTER_RULE_VERSION};
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(source);
  } catch {
    return emptyFailure(makeFile(file, "failed", "none", "parse-error"), "invalid", [{code: "invalid-utf8", message: "Source bytes are not valid UTF-8."}]);
  }
  if (!inspectContentBoundaries(text).safe) {
    return {ok: true, status: "partial", file: makeFile(file, "partial", "file", "unsafe-content"), symbols: [], imports: [], relationships: [], details: [], diagnostics: [{code: "unsafe-content", message: "Source content crossed a content boundary; structural extraction was omitted."}], ruleVersion: JAVA_ADAPTER_RULE_VERSION};
  }
  try {
    return await withParsedSource(file.language, source, tree => {
      const extracted = buildRecords(source, file, tree, knownFiles);
      if (!validateRecords(extracted.records)) return emptyFailure(makeFile(file, "failed", "none", "parse-error"), "invalid", [{code: "invalid-output", message: "Adapter output did not satisfy the portable record contracts."}]);
      const fileCoordinate: PortableSourceCoordinate = {start: {line: 1, column: 0, byte: 0}, end: tree.rootNode.coordinate.end};
      const updatedFile = makeFile(file, extracted.partial ? "partial" : "parsed", extracted.partial ? "file" : "full", extracted.partial ? (extracted.diagnostics.some(item => item.code === "unsafe-content") ? "unsafe-content" : extracted.diagnostics.some(item => item.code === "unsupported-construct") ? "unsupported-construct" : "parse-error") : "none", fileCoordinate);
      return {ok: true, status: extracted.partial ? "partial" : "complete", file: updatedFile, symbols: extracted.records.symbols, imports: extracted.records.imports, relationships: extracted.records.relationships, details: extracted.records.details, diagnostics: extracted.diagnostics, ruleVersion: JAVA_ADAPTER_RULE_VERSION};
    });
  } catch {
    return emptyFailure(makeFile(file, "failed", "none", "parse-error"), "invalid", [{code: "parse-error", message: "The pinned parser could not analyze this file."}]);
  }
}

export const extractJavaFile = adaptJavaFile;
export const analyzeJavaFile = adaptJavaFile;
