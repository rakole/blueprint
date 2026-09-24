import {createHash} from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";

import {
  JAVA_ADAPTER_MAX_FILE_BYTES,
  adaptJavaFile,
  type JavaAdapterResult
} from "../src/mcp/codebase-index/adapters/java.ts";
import {
  portableFileRecordSchema,
  portableImportRelationshipSchema,
  portableRelationshipRecordSchema,
  portableStructuralDetailRecordSchema,
  portableSymbolRecordSchema,
  type PortableFileRecord
} from "../src/mcp/codebase-index/contracts.ts";

function hash(source: Uint8Array): string {
  return createHash("sha256").update(source).digest("hex");
}

function fileRecord(path: string, source: Uint8Array, id = `file-${path.toLowerCase().replace(/[^a-z0-9]/gu, "-")}`): PortableFileRecord {
  return {
    id,
    path,
    language: "java",
    role: "source",
    byteSize: source.byteLength,
    contentHash: hash(source),
    parseStatus: "parsed",
    coverageStatus: "full",
    limitationReason: "none"
  };
}

async function adapt(path: string, text: string, knownFiles: readonly PortableFileRecord[] = []): Promise<JavaAdapterResult> {
  const source = new TextEncoder().encode(text);
  return adaptJavaFile({file: fileRecord(path, source), source, knownFiles});
}

function complete(result: JavaAdapterResult) {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected successful adapter result");
  return result;
}

test("extracts Java package, declarations, nested/local types, members, overloads, and heritage", async () => {
  const result = complete(await adapt("src/Service.java", [
    "package demo.service;",
    "import java.util.List;",
    "import static java.util.Collections.emptyList;",
    "public class Service<T extends Base> extends Parent implements Runnable, AutoCloseable {",
    "  private int field = hiddenInitializerPayload;",
    "  public static final String CONSTANT = \"ordinary body payload\";",
    "  public Service() {}",
    "  public void run() {}",
    "  public void overloaded(int value) {}",
    "  public void overloaded(String value) { class Local { void nested() {} } }",
    "  interface Inner { void act(); }",
    "  enum State { READY, DONE }",
    "  record Pair(int left, String right) {}",
    "  @interface Marker { String value() default \"annotationDefaultPayload\"; }",
    "}"
  ].join("\n")));

  assert.equal(result.status, "complete");
  assert.equal(result.file.parseStatus, "parsed");
  assert.equal(result.file.coverageStatus, "full");
  const byName = new Map(result.symbols.map(symbol => [symbol.qualifiedName, symbol]));
  assert.equal(byName.get("demo.service")?.kind, "module");
  assert.equal(byName.get("Service")?.kind, "class");
  assert.match(byName.get("Service")?.signature ?? "", /extends Parent implements Runnable, AutoCloseable/u);
  assert.equal(byName.get("Service.field")?.kind, "field");
  assert.equal(byName.get("Service.CONSTANT")?.kind, "constant");
  assert.equal(byName.get("Service.Service")?.kind, "constructor");
  assert.equal(byName.get("Service.overloaded")?.kind, "method");
  assert.equal(result.symbols.filter(symbol => symbol.qualifiedName === "Service.overloaded").length, 2);
  assert.equal(byName.get("Service.Inner")?.kind, "interface");
  assert.equal(byName.get("Service.State")?.kind, "enum");
  assert.equal(byName.get("Service.Pair")?.kind, "type");
  assert.equal(byName.get("Service.Pair.left")?.kind, "field");
  assert.equal(byName.get("Service.Marker")?.kind, "interface");
  assert.equal(byName.get("Service.overloaded.Local")?.kind, "class");
  assert.equal(byName.get("Service.overloaded.Local.nested")?.kind, "method");
  assert.equal(byName.get("Service.field")?.signature, "int field");
  assert.equal(byName.get("Service.CONSTANT")?.signature, "String CONSTANT");
  const serialized = JSON.stringify(result);
  for (const payload of ["hiddenInitializerPayload", "ordinary body payload", "annotationDefaultPayload"]) {
    assert.equal(serialized.includes(payload), false, `serialized output leaked ${payload}`);
  }
  assert.ok(result.symbols.every(symbol => portableSymbolRecordSchema.safeParse(symbol).success));
  assert.ok(result.imports.every(item => portableImportRelationshipSchema.safeParse(item).success));
  assert.ok(result.relationships.every(item => portableRelationshipRecordSchema.safeParse(item).success));
});

test("retains compact constructors, throws, and sealed permits while reporting unsupported direct members", async () => {
  const result = complete(await adapt("src/Sealed.java", [
    "record Result(int value) {",
    "  Result { String COMPACT_BODY_PAYLOAD = \"ordinary\"; }",
    "  public void load() throws java.io.IOException, Retryable {}",
    "}",
    "sealed interface Outcome permits Success, Failure {}",
    "final class Success implements Outcome {}",
    "final class Failure implements Outcome {}"
  ].join("\n")));
  const byName = new Map(result.symbols.map(symbol => [symbol.qualifiedName, symbol]));
  assert.equal(byName.get("Result.Result")?.kind, "constructor");
  assert.equal(byName.get("Result.Result")?.signature, "Result()");
  assert.equal(byName.get("Result.load")?.signature, "void load() throws java.io.IOException, Retryable");
  assert.equal(byName.get("Outcome")?.signature, "sealed interface Outcome permits Success, Failure");
  assert.equal(JSON.stringify(result).includes("COMPACT_BODY_PAYLOAD"), false);

  const unsupported = complete(await adapt("src/Initializer.java", "class Initializer { static { String UNIQUE_INITIALIZER_PAYLOAD = \"ordinary\"; } }"));
  assert.equal(unsupported.status, "partial");
  assert.equal(unsupported.file.coverageStatus, "file");
  assert.equal(unsupported.file.limitationReason, "unsupported-construct");
  assert.ok(unsupported.diagnostics.some(item => item.code === "unsupported-construct"));
  assert.equal(JSON.stringify(unsupported).includes("UNIQUE_INITIALIZER_PAYLOAD"), false);
});

test("records ordinary and static imports with narrow known-file resolution", async () => {
  const source = new TextEncoder().encode([
    "package demo;",
    "import demo.dep.Dependency;",
    "import static demo.dep.Utility.run;",
    "import demo.dep.*;",
    "class Main {}"
  ].join("\n"));
  const file = fileRecord("src/demo/Main.java", source);
  const dependencySource = new TextEncoder().encode("class Dependency {}\n");
  const utilitySource = new TextEncoder().encode("class Utility {}\n");
  const dependency = fileRecord("src/demo/dep/Dependency.java", dependencySource, "file-dependency");
  const utility = fileRecord("src/demo/dep/Utility.java", utilitySource, "file-utility");
  const result = complete(await adaptJavaFile({file, source, knownFiles: [dependency, utility]}));
  assert.equal(result.imports.find(item => item.specifier === "demo.dep.Dependency")?.targetFileId, dependency.id);
  assert.equal(result.imports.find(item => item.specifier === "demo.dep.Dependency")?.resolutionStatus, "resolved");
  assert.equal(result.imports.find(item => item.specifier === "demo.dep.Utility.run")?.targetFileId, utility.id);
  assert.equal(result.imports.find(item => item.specifier === "demo.dep.*")?.resolutionStatus, "unsupported");
  const external = complete(await adapt("src/Main.java", "import java.util.List; class Main {}"));
  assert.equal(external.imports[0]?.resolutionStatus, "unresolved");
  assert.equal(external.imports[0]?.unresolvedReason, "external-dependency");
});

test("preserves BOM, CRLF, astral text, and exact UTF-8 coordinates", async () => {
  const text = "\uFEFF// 🚀\r\npackage demo;\r\nclass Привет {\r\n  void run() {}\r\n}\r\n";
  const source = new TextEncoder().encode(text);
  const result = complete(await adaptJavaFile({file: fileRecord("src/Unicode.java", source), source}));
  const symbol = result.symbols.find(item => item.qualifiedName === "Привет");
  assert.ok(symbol);
  assert.equal(symbol.coordinate.start.line, 3);
  assert.equal(symbol.coordinate.start.column, 0);
  assert.equal(symbol.coordinate.start.byte, Buffer.byteLength("\uFEFF// 🚀\r\npackage demo;\r\n", "utf8"));
  assert.equal(result.file.coordinate?.end.byte, Buffer.byteLength(text, "utf8"));
  assert.equal(result.file.coordinate?.end.line, 6);
});

test("degrades malformed Java to truthful file-level partial coverage", async () => {
  const result = complete(await adapt("src/Broken.java", "class Okay { void run() {} class Broken {"));
  assert.equal(result.status, "partial");
  assert.equal(result.file.parseStatus, "partial");
  assert.equal(result.file.coverageStatus, "file");
  assert.equal(result.file.limitationReason, "parse-error");
  assert.ok(result.diagnostics.some(item => item.code === "parse-error"));
});

test("returns typed stale, unsupported, invalid UTF-8, and too-large outcomes", async () => {
  const source = new TextEncoder().encode("class Value {}\n");
  const file = fileRecord("src/Value.java", source);
  const stale = await adaptJavaFile({file: {...file, contentHash: "0".repeat(64)}, source});
  assert.equal(stale.ok, false);
  assert.equal(stale.status, "stale");
  assert.equal(stale.diagnostics[0]?.code, "source-mismatch");

  const unsupported = await adaptJavaFile({file: {...file, language: "python"}, source});
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.status, "unsupported");
  assert.equal(unsupported.file.parseStatus, "unsupported");

  const invalidSource = new Uint8Array([0xff, 0xfe, 0xfd]);
  const invalidFile = fileRecord("src/Invalid.java", invalidSource);
  const invalid = await adaptJavaFile({file: invalidFile, source: invalidSource});
  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, "invalid");
  assert.equal(invalid.diagnostics[0]?.code, "invalid-utf8");

  const largeSource = new TextEncoder().encode("// x\n".repeat(Math.ceil((JAVA_ADAPTER_MAX_FILE_BYTES + 1) / 5)));
  const large = await adaptJavaFile({file: fileRecord("src/Large.java", largeSource), source: largeSource});
  assert.equal(large.ok, false);
  assert.equal(large.status, "invalid");
  assert.equal(large.file.parseStatus, "skipped");
  assert.equal(large.file.coverageStatus, "file");
  assert.equal(large.file.limitationReason, "too-large");
  assert.ok(portableFileRecordSchema.safeParse(large.file).success);
});

test("keeps long names and signatures lossless through linked detail segments", async () => {
  const longName = `C${"界".repeat(1700)}`;
  const parameters = Array.from({length: 700}, (_, index) => `int value${index}`).join(", ");
  const source = new TextEncoder().encode(`class ${longName} { void run(${parameters}) {} }`);
  const result = complete(await adaptJavaFile({file: fileRecord("src/Long.java", source), source}));
  const symbol = result.symbols.find(item => item.kind === "class");
  assert.ok(symbol);
  assert.equal(symbol.qualifiedName, undefined);
  const nameReference = symbol.detailReferences?.find(item => item.field === "qualifiedName");
  assert.ok(nameReference);
  const nameValue = result.details.filter(item => item.sourceRecordId === symbol.id && item.field === "qualifiedName").sort((a, b) => a.segmentIndex - b.segmentIndex).map(item => item.text).join("");
  assert.equal(nameValue, longName);
  const method = result.symbols.find(item => item.kind === "method");
  assert.ok(method);
  const signatureReference = method.detailReferences?.find(item => item.field === "signature");
  assert.ok(signatureReference);
  const signatureValue = result.details.filter(item => item.sourceRecordId === method.id && item.field === "signature").sort((a, b) => a.segmentIndex - b.segmentIndex).map(item => item.text).join("");
  assert.equal(signatureValue, `void run(${parameters})`);
  assert.ok(result.details.every(detail => portableStructuralDetailRecordSchema.safeParse(detail).success));
});

test("is deterministic, nonmutating, and keeps body-only identifiers out of output", async () => {
  const text = "class C { void run() { String UNIQUE_BODY_IDENTIFIER = \"ordinary\"; } }";
  const source = new TextEncoder().encode(text);
  const file = fileRecord("src/Run.java", source);
  const knownFiles = [file];
  const beforeSource = Buffer.from(source);
  const beforeFile = JSON.stringify(file);
  const first = await adaptJavaFile({file, source, knownFiles});
  const second = await adaptJavaFile({file, source, knownFiles});
  assert.deepEqual(first, second);
  assert.deepEqual(Buffer.from(source), beforeSource);
  assert.equal(JSON.stringify(file), beforeFile);
  assert.equal(JSON.stringify(first).includes("UNIQUE_BODY_IDENTIFIER"), false);
  assert.ok(first.ok && second.ok);
});
