import {createHash} from "node:crypto";
import {promisify} from "node:util";
import {execFile as execFileCallback} from "node:child_process";
import {promises as fs} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {performance} from "node:perf_hooks";

import {CODEBASE_DOCUMENT_IDS} from "../src/mcp/codebase-authoring.js";
import {
  extractPortableRepository,
  packetizePortableModelEvidence,
  type PortableExtractionSuccess
} from "../src/mcp/codebase-index/extraction.js";
import {
  serializedUtf8ByteLength,
  type PortableCapability,
  type PortableFileRecord,
  type PortableMapSubmission,
  type PortableSourceBasis,
  type PortableSymbolRecord
} from "../src/mcp/codebase-index/contracts.js";
import {validatePortableMapModel} from "../src/mcp/codebase-index/model-validation.js";
import {buildSourceInventory} from "../src/mcp/codebase-index/inventory.js";
import {
  capturePortablePublicationPreflight,
  publishPortableMap,
  type PortablePublicationPreflight,
  type PortablePublicationResult
} from "../src/mcp/codebase-index/publication.js";
import {renderPortableMap, type PortableRenderSuccess} from "../src/mcp/codebase-index/render.js";
import {resolveCodebaseNavigation} from "../src/mcp/codebase-index/resolver.js";

const execFile = promisify(execFileCallback);
const encoder = new TextEncoder();
const MODEL_PACKET_LIMIT = 48 * 1024;
const GENERATOR_VERSION = "portable-map-scale-v1";

export const SCALE_FILE_TARGETS = {
  javascript: 1600,
  jsx: 1400,
  typescript: 1700,
  tsx: 1400,
  python: 1800,
  java: 1700,
  unsupported: 400
} as const;

type ScaleLanguage = keyof typeof SCALE_FILE_TARGETS;
type ScaleSource = {readonly path: string; readonly language: ScaleLanguage; readonly responsibility: string; readonly content: string};

export type ScaleFixtureManifest = {
  readonly generatorVersion: string;
  readonly requestedFileCount: number;
  readonly fileCount: number;
  readonly languageCounts: Readonly<Record<ScaleLanguage, number>>;
  readonly knownResponsibilities: readonly {readonly path: string; readonly responsibility: string}[];
  readonly largeSource: {readonly path: string; readonly byteSize: number} | null;
};

export type ScaleMetrics = {
  readonly generatorVersion: string;
  readonly environment: {
    readonly node: string;
    readonly platform: string;
    readonly arch: string;
    readonly memoryMethod: string;
  };
  readonly fixture: ScaleFixtureManifest;
  readonly extraction: {
    readonly elapsedMs: number;
    readonly files: number;
    readonly fileCoverageFull: number;
    readonly fileCoverageOnly: number;
    readonly symbols: number;
    readonly imports: number;
    readonly relationships: number;
    readonly structuralShards: number;
    readonly sourceBytes: number;
    readonly sourceHashManifest: {readonly records: number; readonly serializedBytes: number; readonly sha256: string};
    readonly coverageStatement: string;
  };
  readonly packets: {
    readonly elapsedMs: number;
    readonly count: number;
    readonly serializedBytes: number;
    readonly maxSerializedBytes: number;
    readonly allWithinUtf8Cap: boolean;
    readonly losslessReconstruction: boolean;
    readonly sourceRecordCounts: {readonly files: number; readonly symbols: number; readonly imports: number; readonly relationships: number};
    readonly method: string;
  };
  readonly authoredModel: {
    readonly completeSubmissionUtf8Bytes: number;
    readonly capabilities: number;
    readonly claims: number;
    readonly aliases: number;
    readonly documents: number;
    readonly semanticEvidenceDependencies: number;
    readonly validated: boolean;
    readonly coverage: string;
  };
  readonly rendering: {
    readonly elapsedMs: number;
    readonly files: number;
    readonly pages: number;
    readonly bytes: number;
    readonly indexBytes: number;
    readonly entryBytes: number;
    readonly compatibilityViews: number;
  };
  readonly publication: {
    readonly first: {readonly elapsedMs: number; readonly status: PortablePublicationResult["status"]; readonly committed: boolean; readonly retainedGenerations: number; readonly retainedBytes: number};
    readonly firstResolution: {readonly elapsedMs: number; readonly status: string; readonly generationId: string | null; readonly fallbackUsed: boolean};
    readonly secondGeneration: {readonly elapsedMs: number; readonly status: PortablePublicationResult["status"]; readonly committed: boolean; readonly retainedGenerations: number; readonly retainedBytes: number};
    readonly secondResolution: {readonly elapsedMs: number; readonly status: string; readonly generationId: string | null; readonly fallbackUsed: boolean};
    readonly retainedFirstResolution: {readonly elapsedMs: number; readonly status: string; readonly generationId: string | null; readonly fallbackUsed: boolean};
    readonly generationDisk: {
      readonly firstBytes: number;
      readonly secondBytes: number;
      readonly refreshGrowthBytes: number;
      readonly allocatedGenerationDirectories: number;
      readonly provedPublishedGenerationIds: readonly string[];
      readonly method: string;
    };
    readonly freshnessMethod: string;
  };
  readonly multipartDecision: {
    readonly thresholdUtf8Bytes: number;
    readonly completeAuthoredSubmissionUtf8Bytes: number;
    readonly requiresMultipart: boolean;
    readonly decision: string;
    readonly boundedSingleSubmissionCovers: readonly string[];
  };
  readonly operationContinuation: {
    readonly measured: boolean;
    readonly fixture: string;
    readonly method: string;
  };
  readonly memory: {
    readonly observedRssMiB: number;
    readonly samples: readonly {readonly stage: string; readonly rssMiB: number}[];
    readonly method: string;
  };
  readonly limitations: readonly string[];
};

const knownSources: readonly ScaleSource[] = [
  {
    path: "src/domains/checkout/cart.ts",
    language: "typescript",
    responsibility: "checkout totals and basket line validation",
    content: "\uFEFFimport {quoteShippingRate} from \"../../python/fulfillment/rates\";\r\n\r\nexport interface CartLine { sku: string; quantity: number; unitPrice: number; }\r\n\r\nexport function calculateCartTotal(lines: CartLine[]): number {\r\n  return lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);\r\n}\r\n\r\nexport function summarizeCheckout(lines: CartLine[]): string {\r\n  const shipping = quoteShippingRate(lines.length);\r\n  return `東京 checkout: ${calculateCartTotal(lines) + shipping}`;\r\n}\r\n"
  },
  {
    path: "src/domains/checkout/authorize.ts",
    language: "typescript",
    responsibility: "checkout authorization boundary",
    content: "import {calculateCartTotal, type CartLine} from \"./cart\";\n\nexport class CheckoutAuthorizer {\n  authorize(lines: CartLine[], token: string): boolean {\n    return token.length > 0 && calculateCartTotal(lines) >= 0;\n  }\n}\n\nexport function authorizePayment(lines: CartLine[], token: string): boolean {\n  return new CheckoutAuthorizer().authorize(lines, token);\n}\n"
  },
  {
    path: "src/domains/shipping/label.js",
    language: "javascript",
    responsibility: "shipping label creation and carrier routing",
    content: "import {createHash} from \"node:crypto\";\n\nexport function createShippingLabel(orderId, destination) {\n  const routeKey = createHash(\"sha256\").update(`${orderId}:${destination}`).digest(\"hex\");\n  return {orderId, destination, routeKey, carrier: \"ground\"};\n}\n\nexport const normalizeDestination = value => String(value).trim();\n"
  },
  {
    path: "src/domains/ui/CheckoutPanel.jsx",
    language: "jsx",
    responsibility: "customer checkout interaction surface",
    content: "import React from \"react\";\n\nexport function CheckoutPanel({cart, onAuthorize}) {\n  return <section aria-label=\"checkout\"><button onClick={() => onAuthorize(cart)}>Pay {cart.total}</button></section>;\n}\n"
  },
  {
    path: "src/domains/catalog/CatalogSearch.tsx",
    language: "tsx",
    responsibility: "catalog search and result rendering",
    content: "import React from \"react\";\nimport {calculateCartTotal} from \"../checkout/cart\";\n\nexport type CatalogResult = {sku: string; title: string};\n\nexport const CatalogSearch = ({query, results}: {query: string; results: CatalogResult[]}) => {\n  const visible = results.filter(result => result.title.includes(query));\n  return <div data-total={calculateCartTotal([])}>{visible.map(result => <span key={result.sku}>{result.title}</span>)}</div>;\n};\n"
  },
  {
    path: "python/fulfillment/rates.py",
    language: "python",
    responsibility: "shipping rate policy and carrier quote calculation",
    content: "from decimal import Decimal\n\n\ndef quoteShippingRate(item_count: int) -> Decimal:\n    \"\"\"Return the deterministic fixture shipping quote.\"\"\"\n    return Decimal(item_count) * Decimal(\"1.25\")\n\n\nclass RatePolicy:\n    def chooseCarrier(self, destination: str) -> str:\n        return \"ground\" if destination else \"unknown\"\n"
  },
  {
    path: "java/com/example/payments/PaymentGateway.java",
    language: "java",
    responsibility: "payment gateway authorization and receipt creation",
    content: "package com.example.payments;\n\nimport java.util.List;\n\npublic class PaymentGateway {\n  public PaymentReceipt authorize(String token, List<String> orderLines) {\n    return new PaymentReceipt(token.length() > 0, orderLines.size());\n  }\n\n  public static record PaymentReceipt(boolean accepted, int lineCount) {}\n}\n"
  },
  {
    path: "db/migrations/001_orders.sql",
    language: "unsupported",
    responsibility: "orders persistence schema migration (file-level unsupported coverage)",
    content: "CREATE TABLE orders (id TEXT PRIMARY KEY, status TEXT NOT NULL, created_at TEXT NOT NULL);\nCREATE INDEX orders_status_idx ON orders(status);\n"
  }
];

const targetForLanguage = (language: ScaleLanguage): string => {
  switch (language) {
    case "javascript": return ".js";
    case "jsx": return ".jsx";
    case "typescript": return ".ts";
    case "tsx": return ".tsx";
    case "python": return ".py";
    case "java": return ".java";
    case "unsupported": return ".sql";
  }
};

function languageForKnown(language: ScaleLanguage): ScaleLanguage {
  return language;
}

function generatedSource(language: ScaleLanguage, index: number): ScaleSource {
  const padded = String(index).padStart(5, "0");
  const group = String(Math.floor(index / 100)).padStart(3, "0");
  const extension = targetForLanguage(language);
  const prefix = language === "unsupported"
    ? "db/generated"
    : language === "python"
      ? "python/generated"
      : language === "java"
        ? "java/generated"
        : "src/generated";
  const base = `${prefix}/${language}/group-${group}/module-${padded}${extension}`;
  const name = `Generated${language[0]!.toUpperCase()}${language.slice(1)}${padded}`;
  const unicode = index % 113 === 0 ? " // café 東京 🚀" : "";
  switch (language) {
    case "javascript":
      return {path: base, language, responsibility: "generated JavaScript module inventory", content: `export function ${name}(value) { return {value, module: \"${name}\"}; }${unicode}\n`};
    case "jsx":
      return {path: base, language, responsibility: "generated JSX interaction module inventory", content: `export function ${name}({value}) { return <span data-module=\"${name}\">{value}</span>; }${unicode}\n`};
    case "typescript":
      return {path: base, language, responsibility: "generated TypeScript domain module inventory", content: `export interface ${name}Input { value: string; }\nexport function ${name}(input: ${name}Input): string { return input.value; }${unicode}\n`};
    case "tsx":
      return {path: base, language, responsibility: "generated TSX presentation module inventory", content: `export type ${name}Props = {value: string};\nexport const ${name} = ({value}: ${name}Props) => <span>{value}</span>;${unicode}\n`};
    case "python":
      return {path: base, language, responsibility: "generated Python service module inventory", content: `def ${name}(value: str) -> str:\n    return value\n${unicode}\n`};
    case "java":
      return {path: base, language, responsibility: "generated Java service module inventory", content: `package generated.${language}.group${group};\n\npublic class ${name} {\n  public String run(String value) { return value; }\n}${unicode}\n`};
    case "unsupported":
      return {path: base, language, responsibility: "generated unsupported data inventory", content: `-- ${name} fixture migration\nCREATE TABLE ${name.toLowerCase()} (value TEXT NOT NULL);\n`};
  }
}

function largeTypeScriptSource(): string {
  const line = "export const oversizedFixtureMarker = \"Unicode café 東京 🚀\";\r\n";
  const targetBytes = 1_100_000;
  const repeated = line.repeat(Math.ceil(targetBytes / Buffer.byteLength(line, "utf8")));
  return repeated.slice(0, targetBytes - 1) + "\n";
}

async function initializeGit(root: string): Promise<void> {
  await execFile("git", ["init", "--quiet"], {cwd: root});
  await execFile("git", ["config", "user.email", "codex@example.invalid"], {cwd: root});
  await execFile("git", ["config", "user.name", "Codex Scale Fixture"], {cwd: root});
}

/** Generate the source tree in a temporary checkout; source files are never committed to Blueprint. */
export async function generatePortableMapScaleFixture(
  root: string,
  options: {readonly fileCount?: number; readonly includeLargeFile?: boolean} = {}
): Promise<ScaleFixtureManifest> {
  const requestedFileCount = options.fileCount ?? 10_000;
  const includeLargeFile = options.includeLargeFile ?? requestedFileCount >= 10_000;
  const known = includeLargeFile
    ? [...knownSources, {path: "src/scale/oversized.ts", language: "typescript" as const, responsibility: "large source file retained at file-level coverage", content: largeTypeScriptSource()}]
    : [...knownSources];
  if (requestedFileCount < known.length) throw new Error(`fileCount must be at least ${known.length}`);
  const targetCounts = {...SCALE_FILE_TARGETS};
  if (requestedFileCount !== 10_000) {
    const remainder = requestedFileCount - known.length;
    const generatedTargets = Object.fromEntries(Object.keys(targetCounts).map(language => [language, 0])) as Record<ScaleLanguage, number>;
    const languages = Object.keys(targetCounts) as ScaleLanguage[];
    for (let index = 0; index < remainder; index += 1) generatedTargets[languages[index % languages.length]!] += 1;
    for (const source of known) generatedTargets[languageForKnown(source.language)] += 1;
    const totals = Object.fromEntries(languages.map(language => [language, generatedTargets[language]!])) as Record<ScaleLanguage, number>;
    for (const language of languages) targetCounts[language] = totals[language]!;
  }
  const languageCounts = Object.fromEntries(Object.keys(targetCounts).map(language => [language, 0])) as Record<ScaleLanguage, number>;
  const occupied = new Set<string>();
  await fs.mkdir(root, {recursive: true});
  await initializeGit(root);
  for (const source of known) {
    const absolute = path.join(root, source.path);
    await fs.mkdir(path.dirname(absolute), {recursive: true});
    await fs.writeFile(absolute, source.content, "utf8");
    occupied.add(source.path);
    languageCounts[source.language] += 1;
  }
  for (const language of Object.keys(targetCounts) as ScaleLanguage[]) {
    let index = 0;
    while (languageCounts[language] < targetCounts[language]) {
      const source = generatedSource(language, index);
      index += 1;
      if (occupied.has(source.path)) continue;
      const absolute = path.join(root, source.path);
      await fs.mkdir(path.dirname(absolute), {recursive: true});
      await fs.writeFile(absolute, source.content, "utf8");
      occupied.add(source.path);
      languageCounts[language] += 1;
    }
  }
  if (Object.values(languageCounts).reduce((sum, count) => sum + count, 0) !== requestedFileCount) {
    throw new Error("Scale fixture generator produced the wrong file count.");
  }
  await execFile("git", ["add", "."], {cwd: root, maxBuffer: 8 * 1024 * 1024});
  await execFile("git", ["commit", "--quiet", "-m", "deterministic portable map scale fixture"], {cwd: root, maxBuffer: 8 * 1024 * 1024});
  return {
    generatorVersion: GENERATOR_VERSION,
    requestedFileCount,
    fileCount: requestedFileCount,
    languageCounts,
    knownResponsibilities: knownSources.map(source => ({path: source.path, responsibility: source.responsibility})),
    largeSource: includeLargeFile ? {path: "src/scale/oversized.ts", byteSize: Buffer.byteLength(known.find(source => source.path === "src/scale/oversized.ts")!.content, "utf8")} : null
  };
}

function digest(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

function allStructural<T extends keyof PortableExtractionSuccess["structuralShards"][number]>(extraction: PortableExtractionSuccess, key: T): Array<PortableExtractionSuccess["structuralShards"][number][T] extends readonly (infer U)[] ? U : never> {
  return extraction.structuralShards.flatMap(shard => [...(shard[key] as readonly unknown[])]) as never;
}

function findFile(extraction: PortableExtractionSuccess, sourcePath: string): PortableFileRecord {
  const file = allStructural(extraction, "files").find(item => (item as PortableFileRecord).path === sourcePath) as PortableFileRecord | undefined;
  if (!file) throw new Error(`Scale fixture file was not extracted: ${sourcePath}`);
  return file;
}

function findSymbol(extraction: PortableExtractionSuccess, sourcePath: string, names: readonly string[]): PortableSymbolRecord {
  const symbols = allStructural(extraction, "symbols") as PortableSymbolRecord[];
  const found = symbols.find(symbol => symbol.path === sourcePath && names.includes(symbol.qualifiedName ?? ""));
  if (!found) throw new Error(`Scale fixture declaration was not extracted: ${sourcePath} (${names.join(", ")})`);
  return found;
}

function fileEvidence(file: PortableFileRecord) {
  return {kind: "file" as const, path: file.path, recordId: file.id, contentHash: file.contentHash, coordinate: file.coordinate};
}

function symbolEvidence(symbol: PortableSymbolRecord) {
  return {kind: "symbol" as const, path: symbol.path, recordId: symbol.id, contentHash: symbol.contentHash, coordinate: symbol.coordinate};
}

function modelFor(extraction: PortableExtractionSuccess): PortableMapSubmission {
  const cart = findSymbol(extraction, "src/domains/checkout/cart.ts", ["calculateCartTotal"]);
  const authorization = findSymbol(extraction, "src/domains/checkout/authorize.ts", ["CheckoutAuthorizer.authorize", "authorizePayment"]);
  const shipping = findSymbol(extraction, "src/domains/shipping/label.js", ["createShippingLabel"]);
  const panel = findSymbol(extraction, "src/domains/ui/CheckoutPanel.jsx", ["CheckoutPanel"]);
  const catalog = findSymbol(extraction, "src/domains/catalog/CatalogSearch.tsx", ["CatalogSearch"]);
  const rates = findSymbol(extraction, "python/fulfillment/rates.py", ["quoteShippingRate"]);
  const gateway = findSymbol(extraction, "java/com/example/payments/PaymentGateway.java", ["PaymentGateway.authorize"]);
  const migration = findFile(extraction, "db/migrations/001_orders.sql");
  const evidenceByPath = [cart.path, authorization.path, shipping.path, panel.path, catalog.path, rates.path, gateway.path, migration.path];
  const claimDefinitions = [
    ["claim-cart-total", "observed", "Checkout totals are calculated from quantity and unit price lines.", symbolEvidence(cart)],
    ["claim-authorization", "observed", "Checkout authorization requires a non-empty token and a valid cart total.", symbolEvidence(authorization)],
    ["claim-shipping-label", "observed", "Shipping labels derive a route key from the order and destination.", symbolEvidence(shipping)],
    ["claim-checkout-ui", "observed", "The checkout panel routes a cart action through its authorization callback.", symbolEvidence(panel)],
    ["claim-catalog-search", "observed", "Catalog search filters result titles by the requested query.", symbolEvidence(catalog)],
    ["claim-rate-policy", "observed", "The rate policy returns a deterministic decimal quote per item.", symbolEvidence(rates)],
    ["claim-payment-gateway", "observed", "The payment gateway returns an acceptance receipt with line count.", symbolEvidence(gateway)],
    ["claim-order-schema", "observed", "The order migration defines status and creation fields with an index.", fileEvidence(migration)]
  ] as const;
  const claims = claimDefinitions.map(([id, basis, statement, evidence]) => ({id, basis, statement, evidence: [evidence]})) as PortableMapSubmission["semantic"]["claims"];
  const capabilityDefinitions: Array<{id: string; name: string; summary: string; claimIds: string[]; evidence: ReturnType<typeof symbolEvidence | typeof fileEvidence>}> = [
    {id: "cap-checkout", name: "Checkout totals", summary: "Coordinates basket totals before authorization and UI submission.", claimIds: ["claim-cart-total"], evidence: symbolEvidence(cart)},
    {id: "cap-authorization", name: "Checkout authorization", summary: "Applies the authorization boundary for a cart and payment token.", claimIds: ["claim-authorization"], evidence: symbolEvidence(authorization)},
    {id: "cap-shipping", name: "Shipping labels", summary: "Creates carrier-ready labels and route keys for orders.", claimIds: ["claim-shipping-label"], evidence: symbolEvidence(shipping)},
    {id: "cap-checkout-ui", name: "Checkout interface", summary: "Presents the customer checkout action as a JSX component.", claimIds: ["claim-checkout-ui"], evidence: symbolEvidence(panel)},
    {id: "cap-catalog", name: "Catalog search", summary: "Filters and renders catalog results in the TSX search surface.", claimIds: ["claim-catalog-search"], evidence: symbolEvidence(catalog)},
    {id: "cap-rate-policy", name: "Rate policy", summary: "Calculates shipping quotes and chooses a carrier policy in Python.", claimIds: ["claim-rate-policy"], evidence: symbolEvidence(rates)},
    {id: "cap-payments", name: "Payment gateway", summary: "Authorizes payment tokens and creates typed Java receipts.", claimIds: ["claim-payment-gateway"], evidence: symbolEvidence(gateway)},
    {id: "cap-orders", name: "Order persistence", summary: "Defines the unsupported-language SQL migration for order storage.", claimIds: ["claim-order-schema"], evidence: fileEvidence(migration)}
  ];
  const capabilities = capabilityDefinitions.map(definition => ({...definition, evidence: [definition.evidence]}));
  const aliases: PortableMapSubmission["semantic"]["aliases"] = [
    {id: "alias-basket-total", alias: "basket total", targetKind: "symbol", targetId: cart.id, evidence: [fileEvidence(findFile(extraction, cart.path))]},
    {id: "alias-pay-cart", alias: "pay cart", targetKind: "symbol", targetId: authorization.id, evidence: [fileEvidence(findFile(extraction, authorization.path))]},
    {id: "alias-label-order", alias: "order label", targetKind: "symbol", targetId: shipping.id, evidence: [fileEvidence(findFile(extraction, shipping.path))]},
    {id: "alias-checkout-screen", alias: "checkout screen", targetKind: "symbol", targetId: panel.id, evidence: [fileEvidence(findFile(extraction, panel.path))]},
    {id: "alias-find-products", alias: "find products", targetKind: "symbol", targetId: catalog.id, evidence: [fileEvidence(findFile(extraction, catalog.path))]},
    {id: "alias-shipping-quote", alias: "shipping quote", targetKind: "symbol", targetId: rates.id, evidence: [fileEvidence(findFile(extraction, rates.path))]},
    {id: "alias-gateway-charge", alias: "gateway charge", targetKind: "symbol", targetId: gateway.id, evidence: [fileEvidence(findFile(extraction, gateway.path))]},
    {id: "alias-order-table", alias: "order table", targetKind: "capability", targetId: "cap-orders", evidence: [fileEvidence(migration)]}
  ];
  const documentCopy: Record<string, {summary: string; sections: Array<{heading: string; content: string}>; evidencePaths: string[]}> = {
    stack: {summary: "The fixture contains JavaScript, JSX, TypeScript, TSX, Python, Java, and unsupported SQL files. Supported declarations use the pinned parser adapters.", sections: [{heading: "Coverage", content: "Structural coverage is full for supported files below the one MiB extraction limit and file-level for unsupported or oversized content."}], evidencePaths: evidenceByPath},
    architecture: {summary: "The known flow crosses checkout totals, authorization, customer UI, shipping, rates, payment gateway, and order persistence boundaries.", sections: [{heading: "Flow", content: "The checkout symbols provide concrete entrypoints for following a cart from calculation through authorization and payment receipt."}], evidencePaths: evidenceByPath},
    structure: {summary: "Responsibilities are nested under source, Python, Java, and database prefixes, with generated language modules grouped by stable numeric directories.", sections: [{heading: "Known paths", content: "The scale fixture keeps a small set of named responsibilities alongside deterministic generated modules so path search and capability search are both meaningful."}], evidencePaths: evidenceByPath},
    conventions: {summary: "Source declarations use exported functions, classes, interfaces, typed components, Python definitions, and Java package members with Unicode and mixed line endings present in the known examples.", sections: [{heading: "Parser details", content: "Parser output records coordinates and signatures while excluding bodies and arbitrary literal payloads."}], evidencePaths: evidenceByPath},
    testing: {summary: "The scale harness validates extraction, packet byte caps and lossless reconstruction, complete model joining, rendering, publication, refresh retention, and cold resolution.", sections: [{heading: "Method", content: "The explicit scale result records counts and observed timings without treating wallclock or end RSS observations as universal performance claims."}], evidencePaths: evidenceByPath},
    integrations: {summary: "Known source boundaries include local TypeScript imports, external React and Java library imports, Python standard library imports, and unsupported SQL migration files.", sections: [{heading: "Runtime", content: "The portable bundle remains consumable through ordinary file reads and search after publication."}], evidencePaths: evidenceByPath},
    concerns: {summary: "The generated map separates structural inventory from authored semantics and reports file-level limitations for unsupported SQL and the oversized TypeScript file.", sections: [{heading: "Open limits", content: "Semantic coverage is intentionally bounded to eight named capabilities, eight source-linked claims, and eight aliases; generated modules remain structurally discoverable."}], evidencePaths: evidenceByPath}
  };
  const documents = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, documentCopy[id]!])) as PortableMapSubmission["documents"];
  return {formatVersion: 1, generationId: extraction.generationId, documents, semantic: {capabilities, claims, aliases}};
}

export const buildPortableMapModel = modelFor;

function flattenRecords(extraction: PortableExtractionSuccess): {files: PortableFileRecord[]; symbols: PortableSymbolRecord[]; imports: unknown[]; relationships: unknown[]} {
  return {
    files: allStructural(extraction, "files") as PortableFileRecord[],
    symbols: allStructural(extraction, "symbols") as PortableSymbolRecord[],
    imports: allStructural(extraction, "imports") as unknown[],
    relationships: allStructural(extraction, "relationships") as unknown[]
  };
}

function compareId(left: {id: string}, right: {id: string}): number {
  return left.id.localeCompare(right.id);
}

function packetMetrics(extraction: PortableExtractionSuccess, operationId: string, capabilities: readonly PortableCapability[]) {
  const result = packetizePortableModelEvidence(extraction, operationId, {
    capabilities: capabilities.map(capability => ({id: capability.id, name: capability.name, summary: capability.summary}))
  });
  if (!result.ok || !result.complete) throw new Error("Portable scale packetization did not complete.");
  const original = flattenRecords(extraction);
  const reconstructed = {
    files: result.packets.flatMap(packet => packet.selectedFiles).sort(compareId),
    symbols: result.packets.flatMap(packet => packet.selectedSymbols).sort(compareId),
    imports: result.packets.flatMap(packet => packet.selectedImports).sort(compareId),
    relationships: result.packets.flatMap(packet => packet.selectedRelationships).sort(compareId)
  };
  const expected = {
    files: [...original.files].sort(compareId),
    symbols: [...original.symbols].sort(compareId),
    imports: [...original.imports].sort(compareId),
    relationships: [...original.relationships].sort(compareId)
  };
  return {
    result,
    lossless: JSON.stringify(reconstructed) === JSON.stringify(expected),
    sourceRecordCounts: {files: original.files.length, symbols: original.symbols.length, imports: original.imports.length, relationships: original.relationships.length}
  };
}

function publicationBasis(extraction: PortableExtractionSuccess): PortableSourceBasis {
  return {
    rootHash: digest(`portable-map-scale-root-v1:${extraction.inventoryFingerprint}`),
    inventoryHash: extraction.inventoryFingerprint,
    evidenceHash: digest(canonicalJson(extraction.sourceBasis))
  };
}

async function verifyFreshSource(root: string, expected: PortableSourceBasis): Promise<boolean> {
  // This callback hashes the current eligible source bytes on every publication phase.
  // It intentionally does not bless the stored prepared hash by itself.
  const current = await buildSourceInventory(root);
  return current.inventoryFingerprint === expected.inventoryHash;
}

async function publishGeneration(
  root: string,
  generationId: string,
  operationId: string,
  transactionId: string,
  sourceBasis: PortableSourceBasis,
  rendered: PortableRenderSuccess,
  intent: "new" | "refresh"
): Promise<{elapsedMs: number; result: PortablePublicationResult}> {
  const started = performance.now();
  const freshness = () => verifyFreshSource(root, sourceBasis);
  const captured = await capturePortablePublicationPreflight({repositoryRoot: root, operationId, transactionId, generationId, sourceBasis, intent, verifyFreshness: freshness});
  if (!("operationId" in captured)) throw new Error(`Portable publication preflight failed: ${JSON.stringify(captured)}`);
  const preflight = captured as PortablePublicationPreflight;
  const result = await publishPortableMap({repositoryRoot: root, operationId, transactionId, generationId, sourceBasis, rendered, preflight, verifyFreshness: freshness});
  if (!result.ok || !result.committed) throw new Error(`Portable publication failed: ${JSON.stringify(result.diagnostics)}`);
  return {elapsedMs: performance.now() - started, result};
}

async function treeSize(root: string): Promise<{bytes: number; files: number; directories: number}> {
  let bytes = 0;
  let files = 0;
  let directories = 0;
  async function visit(current: string): Promise<void> {
    for (const entry of await fs.readdir(current, {withFileTypes: true})) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        directories += 1;
        await visit(absolute);
      } else if (entry.isFile()) {
        files += 1;
        bytes += (await fs.stat(absolute)).size;
      }
    }
  }
  await visit(root);
  return {bytes, files, directories};
}

function rssMiB(): number {
  return Number((process.memoryUsage().rss / (1024 * 1024)).toFixed(2));
}

function sourceHashManifest(extraction: PortableExtractionSuccess) {
  const records = extraction.sourceBasis.files
    .map(file => ({path: file.path, byteSize: file.byteSize, contentHash: file.contentHash}))
    .sort((left, right) => left.path.localeCompare(right.path));
  const serialized = canonicalJson(records);
  return {records: records.length, serializedBytes: encoder.encode(serialized).byteLength, sha256: digest(serialized)};
}

function renderMetadata(extraction: PortableExtractionSuccess, generationId: string, predecessor?: PortableRenderSuccess): Parameters<typeof renderPortableMap>[1] {
  const parserAssets = [
    {name: extraction.provenance.runtime.package, version: extraction.provenance.runtime.version, checksum: extraction.provenance.runtime.packageSha256},
    ...extraction.provenance.grammars.map(grammar => ({name: grammar.asset, version: grammar.version, checksum: grammar.sha256}))
  ];
  return {
    generationId,
    generatedAt: generationId.endsWith("002") ? "2026-09-24T00:00:01+00:00" : "2026-09-24T00:00:00+00:00",
    gitCommit: null,
    inventoryFingerprint: extraction.inventoryFingerprint,
    parserAssets,
    predecessorGenerationId: predecessor?.manifest.generationId ?? null,
    ...(predecessor ? {
      predecessorPublicationProof: {
        generationId: predecessor.manifest.generationId,
        manifest: predecessor.sealedGeneration.manifest,
        entry: predecessor.sealedGeneration.entry,
        committedIndexHash: predecessor.rootIndexHash
      }
    } : {})
  };
}

function extractionSummary(extraction: PortableExtractionSuccess, elapsedMs: number, sourceManifest: ReturnType<typeof sourceHashManifest>): ScaleMetrics["extraction"] {
  const files = allStructural(extraction, "files") as PortableFileRecord[];
  const symbols = allStructural(extraction, "symbols");
  const imports = allStructural(extraction, "imports");
  const relationships = allStructural(extraction, "relationships");
  return {
    elapsedMs,
    files: files.length,
    fileCoverageFull: files.filter(file => file.coverageStatus === "full").length,
    fileCoverageOnly: files.filter(file => file.coverageStatus === "file").length,
    symbols: symbols.length,
    imports: imports.length,
    relationships: relationships.length,
    structuralShards: extraction.structuralShards.length,
    sourceBytes: extraction.sourceBasis.files.reduce((total, file) => total + file.byteSize, 0),
    sourceHashManifest: sourceManifest,
    coverageStatement: "File inventory covers every eligible source path. Full declaration coverage applies only to successfully parsed supported files at or below the one MiB limit; unsupported and oversized files are intentionally file-level. Authored semantics cover eight named responsibilities with eight claims and eight aliases."
  };
}

function renderSummary(rendered: PortableRenderSuccess, elapsedMs: number): ScaleMetrics["rendering"] {
  return {
    elapsedMs,
    files: Object.keys(rendered.files).length,
    pages: rendered.manifest.checksums.pages.length,
    bytes: Object.values(rendered.files).reduce((total, bytes) => total + bytes.byteLength, 0),
    indexBytes: rendered.rootIndexBytes.byteLength,
    entryBytes: rendered.entryBytes.byteLength,
    compatibilityViews: Object.keys(rendered.rootViewBytes).length
  };
}

function resolutionSummary(value: Awaited<ReturnType<typeof resolveCodebaseNavigation>>, elapsedMs: number) {
  return {elapsedMs, status: value.status, generationId: value.status === "ok" ? value.portable.generationId : null, fallbackUsed: value.fallbackUsed};
}

export async function runPortableMapScale(root: string, fixture: ScaleFixtureManifest): Promise<ScaleMetrics> {
  const rssSamples: Array<{stage: string; rssMiB: number}> = [{stage: "start", rssMiB: rssMiB()}];
  const extractionStarted = performance.now();
  const extracted = await extractPortableRepository({repositoryRoot: root, generationId: "gen-scale-001"});
  if (!extracted.ok) throw new Error(`Portable scale extraction failed: ${JSON.stringify(extracted.diagnostics)}`);
  rssSamples.push({stage: "extraction", rssMiB: rssMiB()});
  const firstExtraction = extracted;
  const sourceManifest = sourceHashManifest(firstExtraction);
  const extraction = extractionSummary(firstExtraction, performance.now() - extractionStarted, sourceManifest);
  const model = modelFor(firstExtraction);
  const packetStarted = performance.now();
  const packets = packetMetrics(firstExtraction, "op-scale-001", model.semantic.capabilities);
  rssSamples.push({stage: "packets", rssMiB: rssMiB()});
  if (!packets.lossless || packets.result.serializedBytes.some(bytes => bytes > MODEL_PACKET_LIMIT)) throw new Error("Portable scale packet reconstruction or cap check failed.");
  const packetSummary = {
    elapsedMs: performance.now() - packetStarted,
    count: packets.result.packets.length,
    serializedBytes: packets.result.serializedBytes.reduce((total, bytes) => total + bytes, 0),
    maxSerializedBytes: Math.max(...packets.result.serializedBytes),
    allWithinUtf8Cap: packets.result.serializedBytes.every(bytes => bytes <= MODEL_PACKET_LIMIT),
    losslessReconstruction: packets.lossless,
    sourceRecordCounts: packets.sourceRecordCounts,
    method: "packetizePortableModelEvidence over the complete extracted structural inventory; records were sorted by id and reconstructed byte-for-byte by record JSON equality. Persisted public operation receipts were not walked at 10k because each receipt revalidates the full source basis."
  } satisfies ScaleMetrics["packets"];
  const validation = validatePortableMapModel(firstExtraction.structuralShards, model, firstExtraction.sourceBasis);
  if (!validation.ok) throw new Error(`Portable scale model validation failed: ${JSON.stringify(validation.diagnostics)}`);
  const completeSubmissionBytes = serializedUtf8ByteLength(model);
  rssSamples.push({stage: "validation", rssMiB: rssMiB()});
  const validated = validation;
  const authoredModel = {
    completeSubmissionUtf8Bytes: completeSubmissionBytes,
    capabilities: model.semantic.capabilities.length,
    claims: model.semantic.claims.length,
    aliases: model.semantic.aliases.length,
    documents: Object.keys(model.documents).length,
    semanticEvidenceDependencies: new Set([
      ...model.semantic.capabilities.flatMap(item => item.evidence.map(evidence => `${evidence.kind}:${evidence.recordId}`)),
      ...model.semantic.claims.flatMap(item => item.evidence.map(evidence => `${evidence.kind}:${evidence.recordId}`)),
      ...model.semantic.aliases.flatMap(item => item.evidence.map(evidence => `${evidence.kind}:${evidence.recordId}`))
    ]).size,
    validated: true,
    coverage: "Eight named capabilities; eight observed source-linked claims; eight source-linked aliases; all seven compatibility documents substantive."
  } satisfies ScaleMetrics["authoredModel"];
  const renderStarted = performance.now();
  const firstRenderedResult = renderPortableMap(validated.data, renderMetadata(firstExtraction, "gen-scale-001"));
  if (!firstRenderedResult.ok) throw new Error(`Portable scale render failed: ${JSON.stringify(firstRenderedResult.diagnostics)}`);
  const firstRendered = firstRenderedResult;
  rssSamples.push({stage: "render", rssMiB: rssMiB()});
  const rendering = renderSummary(firstRendered, performance.now() - renderStarted);
  const firstBasis = publicationBasis(firstExtraction);
  const firstPublished = await publishGeneration(root, "gen-scale-001", "op-scale-001", "tx-scale-001", firstBasis, firstRendered, "new");
  const firstDisk = await treeSize(path.join(root, ".blueprint", "codebase", "generations"));
  const firstResolutionStarted = performance.now();
  const firstResolution = await resolveCodebaseNavigation(root);
  const firstResolutionSummary = resolutionSummary(firstResolution, performance.now() - firstResolutionStarted);
  if (firstResolution.status !== "ok" || firstResolution.portable.generationId !== "gen-scale-001") throw new Error("Cold first portable resolution did not prove the published generation.");
  rssSamples.push({stage: "first-resolution", rssMiB: rssMiB()});

  const refreshPath = path.join(root, "src", "refresh", "RefreshBoundary.ts");
  await fs.mkdir(path.dirname(refreshPath), {recursive: true});
  await fs.writeFile(refreshPath, "export function refreshBoundary(value: string): string { return value.trim(); }\n", "utf8");
  const secondExtractionStarted = performance.now();
  const secondExtracted = await extractPortableRepository({repositoryRoot: root, generationId: "gen-scale-002"});
  if (!secondExtracted.ok) throw new Error(`Portable scale refresh extraction failed: ${JSON.stringify(secondExtracted.diagnostics)}`);
  const secondExtraction = secondExtracted;
  const secondModel = modelFor(secondExtraction);
  const secondValidation = validatePortableMapModel(secondExtraction.structuralShards, secondModel, secondExtraction.sourceBasis);
  if (!secondValidation.ok) throw new Error(`Portable scale refresh model validation failed: ${JSON.stringify(secondValidation.diagnostics)}`);
  const secondRenderedResult = renderPortableMap(secondValidation.data, renderMetadata(secondExtraction, "gen-scale-002", firstRendered));
  if (!secondRenderedResult.ok) throw new Error(`Portable scale refresh render failed: ${JSON.stringify(secondRenderedResult.diagnostics)}`);
  const secondRendered = secondRenderedResult;
  const secondBasis = publicationBasis(secondExtraction);
  const secondPublished = await publishGeneration(root, "gen-scale-002", "op-scale-002", "tx-scale-002", secondBasis, secondRendered, "refresh");
  const secondDisk = await treeSize(path.join(root, ".blueprint", "codebase", "generations"));
  const secondResolutionStarted = performance.now();
  const secondResolution = await resolveCodebaseNavigation(root);
  const secondResolutionSummary = resolutionSummary(secondResolution, performance.now() - secondResolutionStarted);
  if (secondResolution.status !== "ok" || secondResolution.portable.generationId !== "gen-scale-002") throw new Error("Cold refreshed portable resolution did not prove the new generation.");
  const retainedResolutionStarted = performance.now();
  const retainedResolution = await resolveCodebaseNavigation(root, {requestedGenerationId: "gen-scale-001"});
  const retainedResolutionSummary = resolutionSummary(retainedResolution, performance.now() - retainedResolutionStarted);
  if (retainedResolution.status !== "ok" || retainedResolution.portable.generationId !== "gen-scale-001") throw new Error("Retained first generation resolution failed.");
  rssSamples.push({stage: "refresh-resolution", rssMiB: rssMiB()});
  const allocated = (await fs.readdir(path.join(root, ".blueprint", "codebase", "generations"), {withFileTypes: true})).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const provedPublishedGenerationIds = [firstResolutionSummary.generationId, secondResolutionSummary.generationId, retainedResolutionSummary.generationId].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
  return {
    generatorVersion: GENERATOR_VERSION,
    environment: {node: process.version, platform: process.platform, arch: process.arch, memoryMethod: "Sampled end-of-stage process.memoryUsage().rss; this is an observed lower bound, not peak RSS."},
    fixture,
    extraction,
    packets: packetSummary,
    authoredModel,
    rendering,
    publication: {
      first: {elapsedMs: firstPublished.elapsedMs, status: firstPublished.result.status, committed: firstPublished.result.committed, retainedGenerations: firstPublished.result.retainedGenerations, retainedBytes: firstPublished.result.retainedBytes},
      firstResolution: firstResolutionSummary,
      secondGeneration: {elapsedMs: secondPublished.elapsedMs, status: secondPublished.result.status, committed: secondPublished.result.committed, retainedGenerations: secondPublished.result.retainedGenerations, retainedBytes: secondPublished.result.retainedBytes},
      secondResolution: secondResolutionSummary,
      retainedFirstResolution: retainedResolutionSummary,
      generationDisk: {firstBytes: firstDisk.bytes, secondBytes: secondDisk.bytes, refreshGrowthBytes: secondDisk.bytes - firstDisk.bytes, allocatedGenerationDirectories: allocated.length, provedPublishedGenerationIds, method: "Counted and summed literal files under .blueprint/codebase/generations after each committed publication; retained ids were proved by cold resolver calls."},
      freshnessMethod: "Publisher verifyFreshness callback rebuilt the current source inventory and compared its freshly hashed inventory fingerprint on each pre-commit publication phase."
    },
    multipartDecision: {
      thresholdUtf8Bytes: MODEL_PACKET_LIMIT,
      completeAuthoredSubmissionUtf8Bytes: completeSubmissionBytes,
      requiresMultipart: completeSubmissionBytes > MODEL_PACKET_LIMIT,
      decision: completeSubmissionBytes > MODEL_PACKET_LIMIT ? "The authored model exceeds the PLAN5.3 threshold; this scale lane records the size observation and does not implement multipart staging." : "The authored model fits the PLAN5.3 threshold; this is a model-size observation and does not establish operation continuation safety.",
      boundedSingleSubmissionCovers: ["eight named capabilities", "eight source-linked observed claims", "eight source-linked aliases", "seven substantive compatibility documents", "structural inventory supplied separately through bounded packets"]
    },
    operationContinuation: {
      measured: false,
      fixture: "tests/portable-map-operations.test.ts",
      method: "The 10,000-file run measures direct packetization and model size. Durable receipt traversal, disk reload, and lossless reconstruction are measured by the manageable operation fixture; this scale run does not claim a 10,000-file operation walk."
    },
    memory: {
      observedRssMiB: Math.max(...rssSamples.map(sample => sample.rssMiB)),
      samples: rssSamples,
      method: "Sampled process.memoryUsage().rss after named stages; observed maximum is not a peak allocation measurement."
    },
    limitations: [
      "The fixture is deterministic source generation and is not a hosted-model quality or downstream-efficiency benchmark.",
      "Wallclock values depend on the host and are recorded for reproducibility only; no timing threshold is asserted.",
      "RSS samples are end-of-stage observations rather than peak or per-stage allocations.",
      "The authored model intentionally covers eight known responsibilities; generated modules remain structural-only semantics.",
      "The refresh adds one source file and retains both published generations; garbage collection is not exercised.",
      "No multipart protocol is implemented in Wave12 C."
    ]
  };
}

export async function createTemporaryScaleFixture(options: {readonly fileCount?: number; readonly includeLargeFile?: boolean} = {}): Promise<{root: string; manifest: ScaleFixtureManifest; cleanup: () => Promise<void>}> {
  // Publication's literal-ancestor guard rejects a symlinked temporary-root
  // alias on some hosts (for example /var -> /private/var). Use its canonical
  // directory while keeping the generated result free of host-specific paths.
  const temporaryBase = await fs.realpath(os.tmpdir()).catch(() => os.tmpdir());
  const root = await fs.mkdtemp(path.join(temporaryBase, "blueprint-portable-map-scale-"));
  const manifest = await generatePortableMapScaleFixture(root, options);
  return {root, manifest, cleanup: async () => fs.rm(root, {recursive: true, force: true})};
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const countIndex = args.indexOf("--file-count");
  const outputIndex = args.indexOf("--output");
  const fileCount = countIndex >= 0 ? Number(args[countIndex + 1]) : 10_000;
  const output = outputIndex >= 0 ? args[outputIndex + 1] : null;
  if (!Number.isSafeInteger(fileCount) || fileCount < knownSources.length) throw new Error("--file-count must be a safe integer large enough for the named responsibilities.");
  if (!output) throw new Error("--output is required so the explicit scale result is reviewable.");
  const temporary = await createTemporaryScaleFixture({fileCount, includeLargeFile: fileCount >= 10_000});
  try {
    const result = await runPortableMapScale(temporary.root, temporary.manifest);
    await fs.mkdir(path.dirname(path.resolve(output)), {recursive: true});
    await fs.writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify({output: path.normalize(output), files: result.fixture.fileCount, packets: result.packets.count, completeAuthoredSubmissionUtf8Bytes: result.authoredModel.completeSubmissionUtf8Bytes, multipartRequired: result.multipartDecision.requiresMultipart})}\n`);
  } finally {
    await temporary.cleanup();
  }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invoked) await main();
