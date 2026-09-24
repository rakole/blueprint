import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath, pathToFileURL} from "node:url";
import path from "node:path";

/** Languages for which the portable map has a bundled Tree-sitter grammar. */
export const PARSER_LANGUAGES = [
  "javascript", "jsx", "typescript", "tsx", "python", "java"
] as const;
export type ParserLanguageId = typeof PARSER_LANGUAGES[number];

export const PARSER_RUNTIME_VERSION = "0.27.0" as const;
export const PARSER_BINDING_INDEX_UNIT = "utf16-code-unit" as const;
export const PARSER_OUTPUT_COLUMN_UNIT = "utf8-byte" as const;

const PINNED_RUNTIME_ASSETS = {
  module: "runtime/web-tree-sitter.js",
  moduleSha256: "7c49e3c1d87e24e0bb4c2def909d17154dfde281f5f8280225450090bb4b8110",
  wasm: "runtime/web-tree-sitter.wasm",
  wasmSha256: "c03bccdc3b448a32848f5ae327e209c982bbb0840d43eec8bc2d5759544a1ed3"
} as const;

export type SourcePoint = {
  /** One-based line number. */
  readonly line: number;
  /** Zero-based UTF-8 byte column within the line. */
  readonly column: number;
  /** Zero-based UTF-8 byte offset in the complete source. */
  readonly byte: number;
};

export type SourceCoordinate = {
  /** The end point is exclusive. */
  readonly start: SourcePoint;
  readonly end: SourcePoint;
};

/**
 * A read-only, private syntax-node view.  Deliberately absent are `text`,
 * source bytes, and any method that returns a source body.  Adapters can use
 * type/field/child structure and exact coordinates while the source remains
 * in the caller's transient scope.
 */
export interface SyntaxNodeView {
  readonly type: string;
  readonly isNamed: boolean;
  readonly isError: boolean;
  readonly isMissing: boolean;
  readonly hasError: boolean;
  readonly coordinate: SourceCoordinate;
  readonly childCount: number;
  readonly namedChildCount: number;
  readonly children: readonly SyntaxNodeView[];
  readonly namedChildren: readonly SyntaxNodeView[];
  child(index: number): SyntaxNodeView | null;
  namedChild(index: number): SyntaxNodeView | null;
  childForFieldName(name: string): SyntaxNodeView | null;
}

export interface SyntaxTreeView {
  readonly language: ParserLanguageId;
  readonly rootNode: SyntaxNodeView;
  readonly sourceByteLength: number;
  readonly sourceCodeUnitLength: number;
  /** Binding units are recorded instead of assumed by coordinate consumers. */
  readonly bindingIndexUnit: typeof PARSER_BINDING_INDEX_UNIT;
  readonly outputColumnUnit: typeof PARSER_OUTPUT_COLUMN_UNIT;
  readonly endExclusive: true;
  dispose(): void;
}

export type ParserAssetOrigin = {
  readonly npm: string;
  readonly repository: string;
};

export type ParserAssetManifest = {
  readonly formatVersion: number;
  readonly runtime: {
    readonly package: string;
    readonly version: string;
    readonly origin: ParserAssetOrigin;
    readonly packageSha256: string;
    readonly module: string;
    readonly moduleSha256: string;
    readonly wasm: string;
    readonly wasmSha256: string;
    readonly license: string;
    readonly licenseFile: string;
    readonly languageVersion: number;
    readonly minimumCompatibleVersion: number;
  };
  readonly grammars: readonly Record<string, unknown>[];
  readonly languages: Readonly<Record<ParserLanguageId, {
    readonly grammar: string;
    readonly asset: string;
    readonly sha256: string;
    readonly abiVersion: number;
  }>>;
  readonly bindingCoordinates: {
    readonly indexUnit: typeof PARSER_BINDING_INDEX_UNIT;
    readonly columnUnit: typeof PARSER_BINDING_INDEX_UNIT;
    readonly outputLineBase: 1;
    readonly outputColumnUnit: typeof PARSER_OUTPUT_COLUMN_UNIT;
    readonly outputColumnBase: 0;
    readonly outputByteBase: 0;
    readonly endExclusive: true;
  };
};

type RawPoint = {row: number; column: number};

type RawNode = {
  type: string;
  isNamed: boolean;
  isError: boolean;
  isMissing: boolean;
  hasError: boolean;
  childCount: number;
  namedChildCount: number;
  children: RawNode[];
  namedChildren: RawNode[];
  startIndex: number;
  endIndex: number;
  startPosition: RawPoint;
  endPosition: RawPoint;
  child(index: number): RawNode | null;
  namedChild(index: number): RawNode | null;
  childForFieldName(name: string): RawNode | null;
};

type RawTree = {
  rootNode: RawNode;
  delete(): void;
};

type RawLanguage = {
  readonly abiVersion: number;
};

type RawParser = {
  language: RawLanguage | null;
  setLanguage(language: RawLanguage): RawParser;
  parse(source: string): RawTree | null;
  delete(): void;
};

type WebTreeSitterModule = {
  readonly Parser: {
    new(): RawParser;
    init(options?: {locateFile?: (file: string, prefix: string) => string}): Promise<void>;
  };
  readonly Language: {
    load(input: Uint8Array): Promise<RawLanguage>;
  };
  readonly LANGUAGE_VERSION: number;
  readonly MIN_COMPATIBLE_VERSION: number;
};

type LanguageAsset = {
  readonly asset: string;
  readonly sha256: string;
  readonly abiVersion: number;
};

const LANGUAGE_GRAMMAR_ASSET: Readonly<Record<ParserLanguageId, LanguageAsset>> = {
  javascript: {
    asset: "grammars/tree-sitter-javascript.wasm",
    sha256: "5fb488d0cabb4775a594bab85682de5ad6ce83c0d6ac997a9f82dd084d571240",
    abiVersion: 15
  },
  jsx: {
    asset: "grammars/tree-sitter-javascript.wasm",
    sha256: "5fb488d0cabb4775a594bab85682de5ad6ce83c0d6ac997a9f82dd084d571240",
    abiVersion: 15
  },
  typescript: {
    asset: "grammars/tree-sitter-typescript.wasm",
    sha256: "778025db5a8be0e70f8ccc3671e486dfeddd048c25d9e8a70c26de2e1bf6f97d",
    abiVersion: 14
  },
  tsx: {
    asset: "grammars/tree-sitter-tsx.wasm",
    sha256: "79e5da75ea62855a0cd67177685f0164eac87d5f630b3cbe1e0a099751ad30f8",
    abiVersion: 14
  },
  python: {
    asset: "grammars/tree-sitter-python.wasm",
    sha256: "16108b50df4ee9a30168794252ab55e7c93bfc5765d7fa0aa3e335752c515f47",
    abiVersion: 15
  },
  java: {
    asset: "grammars/tree-sitter-java.wasm",
    sha256: "4fdeac4ca6ca089f06c6f7e562abcac1733cd465728cc7031ebb73c2019122c4",
    abiVersion: 14
  }
};

const parserAssetRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "parser-assets");
const manifestPath = path.join(parserAssetRoot, "manifest.json");
let manifestPromise: Promise<ParserAssetManifest> | undefined;
let runtimePromise: Promise<WebTreeSitterModule> | undefined;
const languagePromises = new Map<ParserLanguageId, Promise<RawLanguage>>();

function isParserLanguage(value: string): value is ParserLanguageId {
  return (PARSER_LANGUAGES as readonly string[]).includes(value);
}

function isSafeAssetPath(assetPath: string): boolean {
  return assetPath.length > 0 &&
    !path.isAbsolute(assetPath) &&
    !assetPath.split("/").some(segment => segment === "" || segment === "." || segment === "..") &&
    !assetPath.includes("\\");
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function loadManifest(): Promise<ParserAssetManifest> {
  if (!manifestPromise) {
    manifestPromise = readFile(manifestPath, "utf8").then(serialized => {
      const parsed = JSON.parse(serialized) as ParserAssetManifest;
      if (parsed.formatVersion !== 1 || parsed.runtime.version !== PARSER_RUNTIME_VERSION) {
        throw new Error("Unsupported or mismatched parser asset manifest.");
      }
      if (parsed.runtime.module !== PINNED_RUNTIME_ASSETS.module ||
          parsed.runtime.moduleSha256 !== PINNED_RUNTIME_ASSETS.moduleSha256 ||
          parsed.runtime.wasm !== PINNED_RUNTIME_ASSETS.wasm ||
          parsed.runtime.wasmSha256 !== PINNED_RUNTIME_ASSETS.wasmSha256 ||
          !isSafeAssetPath(parsed.runtime.module) || !isSafeAssetPath(parsed.runtime.wasm)) {
        throw new Error("Parser runtime assets must be safe relative paths.");
      }
      for (const language of PARSER_LANGUAGES) {
        const entry = parsed.languages?.[language];
        const expected = LANGUAGE_GRAMMAR_ASSET[language];
        if (!entry || entry.asset !== expected.asset || entry.sha256 !== expected.sha256 || entry.abiVersion !== expected.abiVersion) {
          throw new Error(`Parser asset manifest does not describe ${language}.`);
        }
        if (!isSafeAssetPath(entry.asset)) throw new Error(`Unsafe parser asset path for ${language}.`);
      }
      return parsed;
    });
    manifestPromise = manifestPromise.catch(error => {
      manifestPromise = undefined;
      throw error;
    });
  }
  return manifestPromise;
}

async function readVerifiedAsset(assetPath: string, expectedSha256: string): Promise<Uint8Array> {
  if (!isSafeAssetPath(assetPath)) throw new Error("Unsafe parser asset path.");
  const bytes = await readFile(path.join(parserAssetRoot, ...assetPath.split("/")));
  const actual = sha256(bytes);
  if (actual !== expectedSha256) {
    throw new Error(`Parser asset checksum mismatch for ${assetPath}.`);
  }
  return bytes;
}

async function loadRuntime(): Promise<WebTreeSitterModule> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const manifest = await loadManifest();
      await readVerifiedAsset(manifest.runtime.wasm, manifest.runtime.wasmSha256);
      const modulePath = path.join(parserAssetRoot, manifest.runtime.module);
      await readVerifiedAsset(manifest.runtime.module, manifest.runtime.moduleSha256);
      const runtime = await import(pathToFileURL(modulePath).href) as unknown as WebTreeSitterModule;
      await runtime.Parser.init({
        locateFile: file => path.join(parserAssetRoot, "runtime", path.basename(file))
      });
      if (runtime.LANGUAGE_VERSION !== manifest.runtime.languageVersion ||
          runtime.MIN_COMPATIBLE_VERSION !== manifest.runtime.minimumCompatibleVersion) {
        throw new Error("Parser runtime ABI metadata does not match the pinned manifest.");
      }
      return runtime;
    })();
    runtimePromise = runtimePromise.catch(error => {
      runtimePromise = undefined;
      throw error;
    });
  }
  return runtimePromise;
}

function findLineStarts(value: string): number[] {
  const starts = [0];
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) === 0x0a) starts.push(index + 1);
  }
  return starts;
}

function findByteLineStarts(bytes: Uint8Array): number[] {
  const starts = [0];
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 0x0a) starts.push(index + 1);
  }
  return starts;
}

function upperBound(starts: readonly number[], value: number): number {
  let low = 0;
  let high = starts.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (starts[middle] <= value) low = middle + 1;
    else high = middle;
  }
  return Math.max(0, low - 1);
}

/**
 * web-tree-sitter 0.27 reports node indices and point columns in JavaScript
 * UTF-16 code units.  This index verifies those binding units and converts
 * them to exact UTF-8 byte offsets/columns without normalizing BOM or CRLF.
 */
class Utf8CoordinateIndex {
  readonly sourceByteLength: number;
  readonly sourceCodeUnitLength: number;
  #unitToByte: number[];
  #unitLineStarts: number[];
  #byteLineStarts: number[];

  constructor(sourceBytes: Uint8Array, sourceText: string) {
    this.sourceByteLength = sourceBytes.byteLength;
    this.sourceCodeUnitLength = sourceText.length;
    this.#unitLineStarts = findLineStarts(sourceText);
    this.#byteLineStarts = findByteLineStarts(sourceBytes);
    this.#unitToByte = new Array(sourceText.length + 1).fill(-1);
    this.#unitToByte[0] = 0;
    let byteOffset = 0;
    for (let unit = 0; unit < sourceText.length;) {
      const codePoint = sourceText.codePointAt(unit);
      if (codePoint === undefined) throw new Error("Unable to index parser input.");
      const unitWidth = codePoint > 0xffff ? 2 : 1;
      const nextUnit = unit + unitWidth;
      const encoded = Buffer.byteLength(sourceText.slice(unit, nextUnit), "utf8");
      if (unitWidth === 2) this.#unitToByte[unit + 1] = -1;
      byteOffset += encoded;
      this.#unitToByte[nextUnit] = byteOffset;
      unit = nextUnit;
    }
    if (byteOffset !== sourceBytes.byteLength ||
        !Buffer.from(sourceText, "utf8").equals(Buffer.from(sourceBytes))) {
      throw new Error("Parser input could not be represented as stable UTF-8 bytes.");
    }
  }

  private bindingPoint(index: number): {row: number; column: number} {
    const row = upperBound(this.#unitLineStarts, index);
    return {row, column: index - this.#unitLineStarts[row]};
  }

  private bytePoint(byte: number): SourcePoint {
    const row = upperBound(this.#byteLineStarts, byte);
    return {line: row + 1, column: byte - this.#byteLineStarts[row], byte};
  }

  point(index: number, bindingPoint: RawPoint): SourcePoint {
    if (!Number.isInteger(index) || index < 0 || index > this.sourceCodeUnitLength) {
      throw new Error("Tree-sitter returned an invalid source index.");
    }
    const mapped = this.#unitToByte[index];
    if (mapped < 0) throw new Error("Tree-sitter returned an index inside an astral code point.");
    const expected = this.bindingPoint(index);
    if (expected.row !== bindingPoint.row || expected.column !== bindingPoint.column) {
      throw new Error("Tree-sitter binding coordinate units changed unexpectedly.");
    }
    return this.bytePoint(mapped);
  }

  coordinate(node: RawNode): SourceCoordinate {
    return {
      start: this.point(node.startIndex, node.startPosition),
      end: this.point(node.endIndex, node.endPosition)
    };
  }
}

type ParserLifetime = {
  alive: boolean;
  rawTree: RawTree | null;
  clearers: Set<() => void>;
};

class SyntaxNodeViewImpl implements SyntaxNodeView {
  #state: ParserLifetime;
  #raw: RawNode | null;
  #coordinates: Utf8CoordinateIndex | null;

  constructor(state: ParserLifetime, raw: RawNode, coordinates: Utf8CoordinateIndex) {
    this.#state = state;
    this.#raw = raw;
    this.#coordinates = coordinates;
    state.clearers.add(() => this.#clear());
  }

  #node(): RawNode {
    if (!this.#state.alive || !this.#raw) throw new Error("Syntax tree has been disposed.");
    return this.#raw;
  }

  #clear(): void {
    this.#raw = null;
    this.#coordinates = null;
  }

  get type(): string { return this.#node().type; }
  get isNamed(): boolean { return this.#node().isNamed; }
  get isError(): boolean { return this.#node().isError; }
  get isMissing(): boolean { return this.#node().isMissing; }
  get hasError(): boolean { return this.#node().hasError; }
  get coordinate(): SourceCoordinate {
    const coordinates = this.#coordinates;
    if (!coordinates) throw new Error("Syntax tree has been disposed.");
    return coordinates.coordinate(this.#node());
  }
  get childCount(): number { return this.#node().childCount; }
  get namedChildCount(): number { return this.#node().namedChildCount; }
  get children(): readonly SyntaxNodeView[] {
    return this.#node().children.map(child => this.#wrap(child));
  }
  get namedChildren(): readonly SyntaxNodeView[] {
    return this.#node().namedChildren.map(child => this.#wrap(child));
  }
  child(index: number): SyntaxNodeView | null {
    const child = this.#node().child(index);
    return child ? this.#wrap(child) : null;
  }
  namedChild(index: number): SyntaxNodeView | null {
    const child = this.#node().namedChild(index);
    return child ? this.#wrap(child) : null;
  }
  childForFieldName(name: string): SyntaxNodeView | null {
    const child = this.#node().childForFieldName(name);
    return child ? this.#wrap(child) : null;
  }
  #wrap(child: RawNode): SyntaxNodeView {
    const coordinates = this.#coordinates;
    if (!coordinates) throw new Error("Syntax tree has been disposed.");
    return new SyntaxNodeViewImpl(this.#state, child, coordinates);
  }
}

class SyntaxTreeViewImpl implements SyntaxTreeView {
  #state: ParserLifetime;
  #root: SyntaxNodeViewImpl | null;

  constructor(
    raw: RawTree,
    coordinates: Utf8CoordinateIndex,
    readonly language: ParserLanguageId
  ) {
    this.#state = { alive: true, rawTree: raw, clearers: new Set() };
    this.#root = new SyntaxNodeViewImpl(this.#state, raw.rootNode, coordinates);
    this.sourceByteLength = coordinates.sourceByteLength;
    this.sourceCodeUnitLength = coordinates.sourceCodeUnitLength;
  }

  readonly sourceByteLength: number;
  readonly sourceCodeUnitLength: number;
  get rootNode(): SyntaxNodeView {
    if (!this.#state.alive || !this.#root) throw new Error("Syntax tree has been disposed.");
    return this.#root;
  }
  readonly bindingIndexUnit = PARSER_BINDING_INDEX_UNIT;
  readonly outputColumnUnit = PARSER_OUTPUT_COLUMN_UNIT;
  readonly endExclusive = true as const;

  dispose(): void {
    if (!this.#state.alive) return;
    this.#state.alive = false;
    this.#state.rawTree?.delete();
    this.#state.rawTree = null;
    for (const clear of this.#state.clearers) clear();
    this.#state.clearers.clear();
    this.#root = null;
  }
}

function sourceBytesAndText(source: Uint8Array | string): {bytes: Uint8Array; text: string} {
  const bytes = typeof source === "string" ? new TextEncoder().encode(source) : new Uint8Array(source);
  const text = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(bytes);
  return {bytes, text};
}

async function loadLanguage(language: ParserLanguageId, runtime: WebTreeSitterModule): Promise<RawLanguage> {
  const existing = languagePromises.get(language);
  if (existing) return existing;
  const promise = (async () => {
    const manifest = await loadManifest();
    const expected = LANGUAGE_GRAMMAR_ASSET[language];
    const manifestLanguage = manifest.languages[language];
    const bytes = await readVerifiedAsset(manifestLanguage.asset, expected.sha256);
    const loaded = await runtime.Language.load(bytes);
    if (loaded.abiVersion !== expected.abiVersion ||
        loaded.abiVersion < manifest.runtime.minimumCompatibleVersion ||
        loaded.abiVersion > manifest.runtime.languageVersion) {
      throw new Error(`Incompatible ABI for ${language} grammar.`);
    }
    return loaded;
  })();
  languagePromises.set(language, promise);
  promise.catch(() => languagePromises.delete(language));
  return promise;
}

/** Parse one source file into a private transient syntax-tree view. */
export async function parseSource(
  language: ParserLanguageId,
  source: Uint8Array | string
): Promise<SyntaxTreeView> {
  if (!isParserLanguage(language)) throw new Error(`Unsupported parser language: ${language}`);
  const {bytes, text} = sourceBytesAndText(source);
  const coordinates = new Utf8CoordinateIndex(bytes, text);
  const runtime = await loadRuntime();
  const loadedLanguage = await loadLanguage(language, runtime);
  const parser = new runtime.Parser();
  try {
    parser.setLanguage(loadedLanguage);
    const rawTree = parser.parse(text);
    if (!rawTree) throw new Error(`Tree-sitter returned no tree for ${language}.`);
    return new SyntaxTreeViewImpl(rawTree, coordinates, language);
  } finally {
    parser.delete();
  }
}

/** Parse and dispose deterministically, including when the adapter throws. */
export async function withParsedSource<T>(
  language: ParserLanguageId,
  source: Uint8Array | string,
  callback: (tree: SyntaxTreeView) => T | Promise<T>
): Promise<T> {
  const tree = await parseSource(language, source);
  try {
    return await callback(tree);
  } finally {
    tree.dispose();
  }
}

/** Return a copy of the verified pinned asset metadata for diagnostics/tests. */
export async function getParserAssetManifest(): Promise<ParserAssetManifest> {
  const manifest = await loadManifest();
  return JSON.parse(JSON.stringify(manifest)) as ParserAssetManifest;
}
