import {createHash} from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";

import {
  JAVASCRIPT_ADAPTER_MAX_FILE_BYTES,
  adaptJavaScriptFile,
  type JavaScriptAdapterResult
} from "../src/mcp/codebase-index/adapters/javascript.ts";
import {
  portableFileRecordSchema,
  portableImportRelationshipSchema,
  portableRelationshipRecordSchema,
  portableStructuralDetailRecordSchema,
  portableSymbolRecordSchema,
  type PortableFileRecord
} from "../src/mcp/codebase-index/contracts.ts";

function fileRecord(path: string, language: PortableFileRecord["language"], source: Uint8Array, id = `file-${path.replace(/[^a-z0-9]/giu, "-")}`): PortableFileRecord {
  return {
    id,
    path,
    language,
    role: "source",
    byteSize: source.byteLength,
    contentHash: createHash("sha256").update(source).digest("hex"),
    parseStatus: "parsed",
    coverageStatus: "full",
    limitationReason: "none"
  };
}

async function adapt(path: string, language: PortableFileRecord["language"], text: string, knownFiles: readonly PortableFileRecord[] = []): Promise<JavaScriptAdapterResult> {
  const source = new TextEncoder().encode(text);
  return adaptJavaScriptFile({file: fileRecord(path, language, source), source, knownFiles});
}

function complete(result: JavaScriptAdapterResult) {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected successful adapter result");
  return result;
}

test("extracts declarations from JavaScript, JSX, TypeScript, and TSX", async () => {
  const cases = [
    ["src/main.js", "javascript", "export function run(value) { return value; } const arrow = (x) => x;"],
    ["src/view.jsx", "jsx", "export function View({name}) { return <div>{name}</div>; }"],
    ["src/types.ts", "typescript", "export interface User { name: string } export type Id = string | number; export enum Role { Admin, User }"],
    ["src/view.tsx", "tsx", "export const App = ({name}: Props) => <div>{name}</div>; interface Props { name: string }" ]
  ] as const;
  for (const [path, language, source] of cases) {
    const result = complete(await adapt(path, language, source));
    assert.equal(result.file.parseStatus, "parsed");
    assert.ok(result.symbols.length > 0, `${language} should produce symbols`);
    assert.ok(result.symbols.every(item => portableSymbolRecordSchema.safeParse(item).success));
  }
});

test("keeps lexical containment and distinguishes class members, constructors, fields, and overloads", async () => {
  const result = complete(await adapt("src/service.ts", "typescript", [
    "export class Service<T> extends Base implements Contract {",
    "  field: T = secretBody;",
    "  constructor(value: T) { this.value = value; }",
    "  run(value: T): T { function nested() { return value; } return nested(); }",
    "}",
    "function overloaded(value: string): string;",
    "function overloaded(value: number): number;"
  ].join("\n")));
  const names = result.symbols.map(symbol => symbol.qualifiedName);
  assert.ok(names.includes("Service"));
  assert.ok(names.includes("Service.field"));
  assert.ok(names.includes("Service.constructor"));
  assert.ok(names.includes("Service.run"));
  assert.ok(names.includes("Service.run.nested"));
  assert.equal(result.symbols.filter(symbol => symbol.qualifiedName === "overloaded").length, 2);
  const nested = result.symbols.find(symbol => symbol.qualifiedName === "Service.run.nested");
  const run = result.symbols.find(symbol => symbol.qualifiedName === "Service.run");
  assert.equal(nested?.lexicalParentId, run?.id);
  assert.ok(result.relationships.some(item => item.kind === "contains" && item.targetSymbolId === nested?.id));
  assert.ok(result.symbols.every(item => portableSymbolRecordSchema.safeParse(item).success));
  assert.ok(result.relationships.every(item => portableRelationshipRecordSchema.safeParse(item).success));
});

test("resolves unambiguous local imports, labels ambiguous and external modules, and records reexports", async () => {
  const dep = new TextEncoder().encode("export const value = 1;");
  const first = fileRecord("src/dep.ts", "typescript", dep, "file-dep-ts");
  const second = fileRecord("src/dep.js", "javascript", dep, "file-dep-js");
  const source = "import {value} from './dep'; import React from 'react'; export * from './dep.ts'; const loaded = import('./dynamic');";
  const result = complete(await adapt("src/main.ts", "typescript", source, [first]));
  const importRecord = result.imports.find(item => item.kind === "import" && item.specifier === "./dep");
  assert.equal(importRecord?.resolutionStatus, "resolved");
  assert.equal(importRecord?.targetFileId, first.id);
  assert.equal(result.imports.find(item => item.specifier === "react")?.unresolvedReason, "external-dependency");
  assert.ok(result.imports.some(item => item.kind === "reexport" && item.specifier === "./dep.ts"));
  const dynamic = result.imports.find(item => item.specifier === "<dynamic>");
  assert.equal(dynamic?.resolutionStatus, "unsupported");
  assert.equal(dynamic?.unresolvedReason, "dynamic-import");

  const ambiguous = complete(await adapt("src/main.ts", "typescript", "import x from './dep';", [first, second]));
  assert.equal(ambiguous.imports[0]?.resolutionStatus, "ambiguous");
  assert.equal(ambiguous.imports[0]?.unresolvedReason, "ambiguous-module");
  assert.ok(ambiguous.imports.every(item => portableImportRelationshipSchema.safeParse(item).success));
});

test("preserves BOM, CRLF, astral text, and exact UTF-8 coordinates", async () => {
  const source = "\uFEFFconst café = 1;\r\nfunction привет(value) { return value; }\r\n";
  const result = complete(await adapt("src/unicode.ts", "typescript", source));
  const symbol = result.symbols.find(item => item.qualifiedName === "привет");
  assert.ok(symbol);
  assert.equal(symbol.coordinate.start.line, 2);
  assert.equal(symbol.coordinate.start.column, 0);
  assert.equal(symbol.coordinate.start.byte, Buffer.byteLength("\uFEFFconst café = 1;\r\n", "utf8"));
  assert.equal(result.file.coordinate?.start.byte, 0);
  assert.equal(result.file.coordinate?.end.byte, Buffer.byteLength(source, "utf8"));
  assert.equal(result.file.coordinate?.end.line, 3);
});

test("degrades malformed source to file-level partial coverage", async () => {
  const result = complete(await adapt("src/broken.js", "javascript", "function okay() { return 1; } function broken( {"));
  assert.equal(result.status, "partial");
  assert.equal(result.file.coverageStatus, "file");
  assert.equal(result.file.limitationReason, "parse-error");
  assert.ok(result.diagnostics.some(item => item.code === "parse-error"));
});

test("returns typed stale, unsupported, and too-large outcomes", async () => {
  const source = new TextEncoder().encode("const value = 1;");
  const staleFile = fileRecord("src/stale.js", "javascript", source);
  const stale = await adaptJavaScriptFile({file: {...staleFile, contentHash: "0".repeat(64)}, source});
  assert.equal(stale.ok, false);
  assert.equal(stale.status, "stale");
  assert.equal(stale.diagnostics[0]?.code, "source-mismatch");

  const unsupported = await adaptJavaScriptFile({file: fileRecord("src/x.py", "python", source), source});
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.status, "unsupported");

  const largeSource = new TextEncoder().encode("const value = 'x';\n".repeat(Math.ceil((JAVASCRIPT_ADAPTER_MAX_FILE_BYTES + 1) / 19)));
  const large = await adaptJavaScriptFile({file: fileRecord("src/large.js", "javascript", largeSource), source: largeSource});
  assert.equal(large.ok, false);
  assert.equal(large.status, "invalid");
  assert.equal(large.file.coverageStatus, "file");
  assert.equal(large.file.limitationReason, "too-large");
});

test("keeps long multibyte structural values lossless through linked detail segments", async () => {
  const longName = `field${"界".repeat(1600)}`;
  const source = `interface ${longName} { value: string }`;
  const result = complete(await adapt("src/long.ts", "typescript", source));
  const symbol = result.symbols.find(item => item.kind === "interface");
  assert.ok(symbol);
  assert.equal(symbol.qualifiedName, undefined);
  const reference = symbol.detailReferences?.find(item => item.field === "qualifiedName");
  assert.ok(reference);
  const detail = result.details.filter(item => item.sourceRecordId === symbol.id && item.field === "qualifiedName").sort((a, b) => a.segmentIndex - b.segmentIndex);
  assert.equal(detail.length, reference.segmentCount);
  assert.equal(detail.map(item => item.text).join(""), longName);
  assert.ok(detail.every(item => portableStructuralDetailRecordSchema.safeParse(item).success));
});

test("does not serialize comments, bodies, defaults, private-key material, or raw source", async () => {
  const source = [
    "// body-comment SECRET_COMMENT",
    "function safe(value = 'DEFAULT_SECRET') { const body = 'BODY_SECRET'; return value; }",
    "const privateKey = '-----BEGIN PRIVATE KEY-----';"
  ].join("\n");
  const result = await adapt("src/secrets.js", "javascript", source);
  assert.equal(result.ok, true);
  assert.equal(result.file.limitationReason, "unsafe-content");
  const serialized = JSON.stringify(result);
  for (const secret of ["SECRET_COMMENT", "DEFAULT_SECRET", "BODY_SECRET", "BEGIN PRIVATE KEY"]) {
    assert.equal(serialized.includes(secret), false, `serialized output leaked ${secret}`);
  }
});

test("is deterministic and does not mutate source or inventory inputs", async () => {
  const source = new TextEncoder().encode("export function run(🚀: string) { return 🚀; }");
  const file = fileRecord("src/run.ts", "typescript", source);
  const known = [file];
  const beforeSource = Buffer.from(source);
  const beforeFile = JSON.stringify(file);
  const first = await adaptJavaScriptFile({file, source, knownFiles: known});
  const second = await adaptJavaScriptFile({file, source, knownFiles: known});
  assert.deepEqual(first, second);
  assert.deepEqual(Buffer.from(source), beforeSource);
  assert.equal(JSON.stringify(file), beforeFile);
  assert.ok(first.ok && second.ok);
});

test("renders JavaScript signatures from AST structure without body or default payloads", async () => {
  const heritage = complete(await adapt("src/heritage.ts", "typescript", "export class C extends factory(() => { return hiddenHeritageBody; }) {}"));
  const defaults = complete(await adapt("src/defaults.ts", "typescript", "export function f({ x = privateDefaultFactory() } = {}) {}"));
  const functionType = complete(await adapt("src/types.ts", "typescript", "interface I { call(cb: (v: string) => number): void }"));
  const heritageText = JSON.stringify(heritage);
  const defaultText = JSON.stringify(defaults);
  assert.equal(heritageText.includes("hiddenHeritageBody"), false);
  assert.equal(defaultText.includes("privateDefaultFactory"), false);
  assert.equal(heritage.status, "partial");
  assert.equal(defaults.status, "complete");
  assert.match(functionType.symbols.find(symbol => symbol.qualifiedName === "I.call")?.signature ?? "", /=> number/u);
});

test("preserves JavaScript bindings and signature punctuation without decorator payloads", async () => {
  const typed = complete(await adapt("src/types.ts", "typescript", "class C { field: string; method(x?: number): boolean {return true;} }"));
  assert.equal(typed.symbols.find(symbol => symbol.qualifiedName === "C.field")?.signature, "field: string");
  assert.equal(typed.symbols.find(symbol => symbol.qualifiedName === "C.method")?.signature, "method(x?: number): boolean");

  const arrow = complete(await adapt("src/arrow.ts", "typescript", "export const id = x => x;"));
  assert.equal(arrow.symbols.find(symbol => symbol.qualifiedName === "id")?.signature, "function id(x)");

  const renamed = complete(await adapt("src/renamed.ts", "typescript", "function f({x: renamed = privateDefaultFactory()}) {}"));
  assert.equal(renamed.symbols.find(symbol => symbol.qualifiedName === "f")?.signature, "function f({x: renamed})");

  const decorated = complete(await adapt("src/decorated.ts", "typescript", "class C { constructor(@Inject(hiddenArgument()) value: T) {} }"));
  assert.equal(JSON.stringify(decorated).includes("hiddenArgument"), false);
  assert.equal(decorated.symbols.find(symbol => symbol.qualifiedName === "C.constructor")?.signature, "constructor(value: T)");
});

test("keeps anonymous default exports lexical and resolves their export target", async () => {
  const result = complete(await adapt("src/default.ts", "typescript", "export default class { run() {} }"));
  const declaration = result.symbols.find(symbol => symbol.qualifiedName === "default");
  const method = result.symbols.find(symbol => symbol.qualifiedName === "default.run");
  assert.equal(declaration?.kind, "class");
  assert.equal(method?.lexicalParentId, declaration?.id);
  assert.equal(result.imports.find(item => item.kind === "export" && item.specifier === "default")?.targetSymbolId, declaration?.id);
  assert.equal(result.symbols.some(symbol => symbol.qualifiedName === "run"), false);
});

test("decodes complete escaped import literals without resolving a truncated prefix", async () => {
  const empty = new Uint8Array();
  const decoy = fileRecord("src/d.ts", "typescript", empty, "file-decoy");
  const result = complete(await adapt("src/main.ts", "typescript", "import x from './d\\u0065p';", [decoy]));
  const imported = result.imports[0];
  assert.equal(imported?.specifier, "./dep");
  assert.equal(imported?.resolutionStatus, "unresolved");
  assert.equal(imported?.targetFileId, null);
  assert.equal(imported?.unresolvedReason, "missing-target");
});

test("enumerates multiple heritage targets and exported declarators", async () => {
  const result = complete(await adapt("src/multiple.ts", "typescript", "interface A {} interface B {} interface C extends A, B {} export const a = 1, b = 2;"));
  const c = result.symbols.find(symbol => symbol.qualifiedName === "C");
  const heritage = result.relationships.filter(item => item.sourceSymbolId === c?.id && item.kind === "extends");
  assert.equal(heritage.length, 2);
  const exports = result.imports.filter(item => item.kind === "export").map(item => item.specifier).sort();
  assert.deepEqual(exports, ["a", "b"]);
});

test("preserves long ASCII qualified names through detail references", async () => {
  for (const length of [1025, 2000]) {
    const name = `N${"a".repeat(length - 1)}`;
    const result = complete(await adapt(`src/long-${length}.ts`, "typescript", `interface ${name} {}`));
    const symbol = result.symbols.find(item => item.kind === "interface");
    assert.ok(symbol);
    assert.equal(symbol.qualifiedName, undefined);
    const reference = symbol.detailReferences?.find(item => item.field === "qualifiedName");
    assert.ok(reference);
    const value = result.details.filter(item => item.sourceRecordId === symbol.id && item.field === "qualifiedName").sort((a, b) => a.segmentIndex - b.segmentIndex).map(item => item.text).join("");
    assert.equal(value, name);
    assert.equal(value.length, length);
  }
});
