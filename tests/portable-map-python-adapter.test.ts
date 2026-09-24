import {createHash} from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";

import {
  PYTHON_ADAPTER_MAX_FILE_BYTES,
  adaptPythonFile,
  type PythonAdapterResult
} from "../src/mcp/codebase-index/adapters/python.ts";
import {
  portableFileRecordSchema,
  portableImportRelationshipSchema,
  portableRelationshipRecordSchema,
  portableStructuralDetailRecordSchema,
  portableSymbolRecordSchema,
  type PortableFileRecord
} from "../src/mcp/codebase-index/contracts.ts";

function fileRecord(path: string, source: Uint8Array, id = `file-${path.replace(/[^a-z0-9]/giu, "-")}`): PortableFileRecord {
  return {
    id,
    path,
    language: "python",
    role: "source",
    byteSize: source.byteLength,
    contentHash: createHash("sha256").update(source).digest("hex"),
    parseStatus: "parsed",
    coverageStatus: "full",
    limitationReason: "none"
  };
}

async function adapt(path: string, text: string, knownFiles: readonly PortableFileRecord[] = []): Promise<PythonAdapterResult> {
  const source = new TextEncoder().encode(text);
  return adaptPythonFile({file: fileRecord(path, source), source, knownFiles});
}

function complete(result: PythonAdapterResult) {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected successful adapter result");
  return result;
}

test("extracts module declarations, decorated async functions, nested classes, methods, fields, and constructors", async () => {
  const result = complete(await adapt("src/service.py", [
    "VALUE: int = 1",
    "@decorator('decorator-secret')",
    "async def outer(value: int = 1) -> str:",
    "    local = value",
    "    class Inner(Base):",
    "        field: str = 'field-secret'",
    "        def __init__(self, name: str):",
    "            self.name = name",
    "        async def method(self, item: int = 2) -> None:",
    "            return None",
    "    def nested(argument: int):",
    "        return argument",
    "class Top:",
    "    @property",
    "    def value(self) -> int:",
    "        return 1",
    ""
  ].join("\n")));

  assert.equal(result.status, "complete");
  assert.equal(result.file.parseStatus, "parsed");
  assert.equal(result.file.coverageStatus, "full");
  const byName = new Map(result.symbols.map(symbol => [symbol.qualifiedName, symbol]));
  assert.equal(byName.get("VALUE")?.kind, "constant");
  assert.equal(byName.get("outer")?.kind, "function");
  assert.match(byName.get("outer")?.signature ?? "", /^async def outer\(value: int\) -> str$/u);
  assert.equal(byName.get("outer.Inner")?.kind, "class");
  assert.equal(byName.get("outer.Inner.field")?.kind, "field");
  assert.equal(byName.get("outer.Inner.__init__")?.kind, "constructor");
  assert.equal(byName.get("outer.Inner.method")?.kind, "method");
  assert.equal(byName.get("outer.nested")?.kind, "function");
  assert.equal(byName.get("Top.value")?.kind, "method");
  const nested = byName.get("outer.nested");
  const outer = byName.get("outer");
  assert.equal(nested?.lexicalParentId, outer?.id);
  assert.ok(result.relationships.some(item => item.targetSymbolId === nested?.id));
  assert.ok(result.symbols.every(item => portableSymbolRecordSchema.safeParse(item).success));
  assert.ok(result.relationships.every(item => portableRelationshipRecordSchema.safeParse(item).success));
});

test("records import forms and resolves only an unambiguous known Python module", async () => {
  const depBytes = new TextEncoder().encode("VALUE = 1\n");
  const dep = fileRecord("src/pkg.py", depBytes, "file-src-pkg-py");
  const ambiguousPackageBytes = new TextEncoder().encode("VALUE = 1\n");
  const ambiguousModule = fileRecord("src/amb.py", ambiguousPackageBytes, "file-src-amb-py");
  const ambiguousPackage = fileRecord("src/amb/__init__.py", ambiguousPackageBytes, "file-src-amb-init-py");
  const result = complete(await adapt("src/main.py", [
    "from .pkg import VALUE as imported",
    "from .amb import VALUE",
    "import os, sys as system",
    "import importlib",
    "importlib.import_module(module_name)",
    "getattr(module, attribute_name)",
    ""
  ].join("\n"), [dep, ambiguousModule, ambiguousPackage]));

  const local = result.imports.find(item => item.specifier === ".pkg");
  assert.equal(local?.resolutionStatus, "resolved");
  assert.equal(local?.targetFileId, dep.id);
  assert.equal(local?.certainty, "supported-inference");
  assert.equal(result.imports.find(item => item.specifier === ".amb")?.resolutionStatus, "ambiguous");
  assert.equal(result.imports.find(item => item.specifier === ".amb")?.unresolvedReason, "ambiguous-module");
  assert.equal(result.imports.find(item => item.specifier === "os")?.unresolvedReason, "external-dependency");
  assert.equal(result.imports.find(item => item.specifier === "sys")?.unresolvedReason, "external-dependency");
  assert.equal(result.imports.find(item => item.specifier === "<dynamic>")?.resolutionStatus, "unsupported");
  assert.equal(result.imports.find(item => item.specifier === "<dynamic>")?.unresolvedReason, "dynamic-import");
  assert.equal(result.imports.find(item => item.specifier === "<reflection>")?.unresolvedReason, "reflection");
  assert.ok(result.imports.every(item => portableImportRelationshipSchema.safeParse(item).success));
});

test("preserves BOM, CRLF, astral text, and exact UTF-8 coordinates", async () => {
  const source = "\uFEFF# 🚀\r\nзначение: int = 1\r\nasync def привет(value: int) -> str:\r\n    return 'x'\r\n";
  const result = complete(await adapt("src/unicode.py", source));
  const symbol = result.symbols.find(item => item.qualifiedName === "привет");
  assert.ok(symbol);
  assert.equal(symbol.coordinate.start.line, 3);
  assert.equal(symbol.coordinate.start.column, 0);
  assert.equal(symbol.coordinate.start.byte, Buffer.byteLength("\uFEFF# 🚀\r\nзначение: int = 1\r\n", "utf8"));
  assert.equal(result.file.coordinate?.end.byte, Buffer.byteLength(source, "utf8"));
  assert.equal(result.file.coordinate?.end.line, 5);
});

test("degrades malformed Python to truthful file-level partial coverage", async () => {
  const result = complete(await adapt("src/broken.py", "def okay(value: int):\n    return value\ndef broken(:\n    pass\n"));
  assert.equal(result.status, "partial");
  assert.equal(result.file.parseStatus, "partial");
  assert.equal(result.file.coverageStatus, "file");
  assert.equal(result.file.limitationReason, "parse-error");
  assert.ok(result.diagnostics.some(item => item.code === "parse-error"));
});

test("returns typed stale, unsupported, invalid UTF-8, and too-large outcomes", async () => {
  const source = new TextEncoder().encode("VALUE = 1\n");
  const file = fileRecord("src/value.py", source);
  const stale = await adaptPythonFile({file: {...file, contentHash: "0".repeat(64)}, source});
  assert.equal(stale.ok, false);
  assert.equal(stale.status, "stale");
  assert.equal(stale.diagnostics[0]?.code, "source-mismatch");

  const unsupported = await adaptPythonFile({
    file: {...file, language: "javascript"},
    source
  });
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.status, "unsupported");
  assert.equal(unsupported.file.parseStatus, "unsupported");

  const invalidSource = new Uint8Array([0xff, 0xfe, 0xfd]);
  const invalidFile = fileRecord("src/invalid.py", invalidSource);
  const invalid = await adaptPythonFile({file: invalidFile, source: invalidSource});
  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, "invalid");
  assert.equal(invalid.diagnostics[0]?.code, "invalid-utf8");

  const largeSource = new TextEncoder().encode("# x\n".repeat(Math.ceil((PYTHON_ADAPTER_MAX_FILE_BYTES + 1) / 4)));
  const large = await adaptPythonFile({file: fileRecord("src/large.py", largeSource), source: largeSource});
  assert.equal(large.ok, false);
  assert.equal(large.status, "invalid");
  assert.equal(large.file.parseStatus, "skipped");
  assert.equal(large.file.coverageStatus, "file");
  assert.equal(large.file.limitationReason, "too-large");
  assert.ok(portableFileRecordSchema.safeParse(large.file).success);
});

test("keeps long multibyte names and signatures lossless through linked detail segments", async () => {
  const longName = `f${"界".repeat(1700)}`;
  const result = complete(await adapt("src/long.py", `def ${longName}(argument: int) -> str:\n    return 'body-secret'\n`));
  const symbol = result.symbols.find(item => item.kind === "function");
  assert.ok(symbol);
  assert.equal(symbol.qualifiedName, undefined);
  const nameReference = symbol.detailReferences?.find(item => item.field === "qualifiedName");
  const signatureReference = symbol.detailReferences?.find(item => item.field === "signature");
  assert.ok(nameReference);
  assert.ok(signatureReference);
  for (const reference of [nameReference, signatureReference]) {
    const detail = result.details
      .filter(item => item.sourceRecordId === symbol.id && item.field === reference.field)
      .sort((left, right) => left.segmentIndex - right.segmentIndex);
    assert.equal(detail.length, reference.segmentCount);
    assert.equal(detail.map(item => item.text).join(""), reference.field === "qualifiedName" ? longName : `def ${longName}(argument: int) -> str`);
    assert.ok(detail.every(item => portableStructuralDetailRecordSchema.safeParse(item).success));
  }
});

test("does not serialize comments, defaults, bodies, docstrings, or unsafe private-key material", async () => {
  const source = [
    "# COMMENT_SECRET",
    "@decorator('DECORATOR_SECRET')",
    "def safe(value: str = 'DEFAULT_SECRET') -> str:",
    "    \"\"\"DOCSTRING_SECRET\"\"\"",
    "    body = 'BODY_SECRET'",
    "    return value",
    "private_key = '-----BEGIN PRIVATE KEY-----'",
    ""
  ].join("\n");
  const result = await adapt("src/secrets.py", source);
  assert.equal(result.ok, true);
  const serialized = JSON.stringify(result);
  for (const secret of ["COMMENT_SECRET", "DECORATOR_SECRET", "DEFAULT_SECRET", "DOCSTRING_SECRET", "BODY_SECRET", "BEGIN PRIVATE KEY"]) {
    assert.equal(serialized.includes(secret), false, `serialized output leaked ${secret}`);
  }
  assert.equal(result.file.limitationReason, "unsafe-content");
  assert.ok(result.diagnostics.every(item => !item.message.includes("SECRET") && !item.message.includes("PRIVATE")));
});

test("is deterministic and does not mutate source or inventory inputs", async () => {
  const source = new TextEncoder().encode("VALUE = 1\nasync def run(value: str) -> str:\n    return value\n");
  const file = fileRecord("src/run.py", source);
  const knownFiles = [file];
  const beforeSource = Buffer.from(source);
  const beforeFile = JSON.stringify(file);
  const first = await adaptPythonFile({file, source, knownFiles});
  const second = await adaptPythonFile({file, source, knownFiles});
  assert.deepEqual(first, second);
  assert.deepEqual(Buffer.from(source), beforeSource);
  assert.equal(JSON.stringify(file), beforeFile);
  assert.ok(first.ok && second.ok);
});

test("renders Python defaults, bases, and annotations from AST structure", async () => {
  const result = complete(await adapt("src/unsafe-signatures.py", [
    "def f(x=lambda a, b: hiddenDefaultBody):",
    "    pass",
    "class C(factory(lambda: hiddenClassBaseBody)):",
    "    pass",
    "def g(x: factory(lambda: hiddenAnnotationBody)) -> factory(lambda: hiddenReturnBody):",
    "    pass",
    ""
  ].join("\n")));
  const serialized = JSON.stringify(result);
  for (const value of ["hiddenDefaultBody", "hiddenClassBaseBody", "hiddenAnnotationBody", "hiddenReturnBody"]) {
    assert.equal(serialized.includes(value), false, `serialized output leaked ${value}`);
  }
  assert.equal(result.status, "partial");
  assert.equal(result.symbols.find(symbol => symbol.qualifiedName === "f")?.signature, "def f(x)");
});

test("renders only actual Python union operators and rejects value operators", async () => {
  const union = complete(await adapt("src/union.py", "def f(x: A | B) -> C | D:\n    pass\n"));
  assert.equal(union.status, "complete");
  assert.equal(union.symbols.find(symbol => symbol.qualifiedName === "f")?.signature, "def f(x: A | B) -> C | D");

  for (const [operator, source] of [["+", "def f(x: A + B) -> C + D:\n    pass\n"], ["*", "def f(x: A * B) -> C * D:\n    pass\n"]] as const) {
    const result = complete(await adapt(`src/value-${operator}.py`, source));
    assert.equal(result.status, "partial");
    assert.equal(result.symbols.find(symbol => symbol.qualifiedName === "f")?.signature, "def f(x: unknown) -> unknown");
    assert.ok(result.diagnostics.some(item => item.code === "unsupported-construct"));
    assert.ok(result.diagnostics.some(item => item.message.includes("structural syntax")));
  }
});

test("rejects relative import ascent beyond repository root while resolving valid levels", async () => {
  const empty = new Uint8Array();
  const packageModule = fileRecord("pkg/x.py", empty, "file-pkg-x");
  const rootModule = fileRecord("x.py", empty, "file-root-x");
  const result = complete(await adapt("pkg/main.py", [
    "from .x import value",
    "from ..x import value as root_value",
    "from ...x import value as overflow_value",
    ""
  ].join("\n"), [packageModule, rootModule]));
  assert.equal(result.imports.find(item => item.specifier === ".x")?.targetFileId, packageModule.id);
  assert.equal(result.imports.find(item => item.specifier === "..x")?.targetFileId, rootModule.id);
  const overflow = result.imports.find(item => item.specifier === "...x");
  assert.equal(overflow?.resolutionStatus, "unresolved");
  assert.equal(overflow?.targetFileId, null);
  assert.equal(overflow?.unresolvedReason, "missing-target");
});

test("enumerates chained names and preserves annotated ordinary assignments", async () => {
  const result = complete(await adapt("src/assignments.py", [
    "a = b = 1",
    "value: int = 2",
    "items, other = (1, 2)",
    ""
  ].join("\n")));
  assert.equal(result.status, "partial");
  assert.ok(result.symbols.some(symbol => symbol.qualifiedName === "a"));
  assert.ok(result.symbols.some(symbol => symbol.qualifiedName === "b"));
  assert.equal(result.symbols.find(symbol => symbol.qualifiedName === "value")?.signature, "value: int");
  assert.equal(result.symbols.some(symbol => symbol.qualifiedName === "items"), false);
  assert.equal(result.symbols.some(symbol => symbol.qualifiedName === "other"), false);
});
