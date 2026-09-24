import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {promises as fs} from "node:fs";
import path from "node:path";

import {createGitRepo} from "./git-fixtures.js";
import {validPhaseContextModel} from "./context-model.js";
import {CODEBASE_DOCUMENT_IDS} from "../../src/mcp/codebase-authoring.js";
import {adaptJavaFile} from "../../src/mcp/codebase-index/adapters/java.js";
import {adaptJavaScriptFile} from "../../src/mcp/codebase-index/adapters/javascript.js";
import {adaptPythonFile} from "../../src/mcp/codebase-index/adapters/python.js";
import {validatePortableMapModel} from "../../src/mcp/codebase-index/model-validation.js";
import {renderPortableMap} from "../../src/mcp/codebase-index/render.js";
import {blueprintConfigSet} from "../../src/mcp/tools/config.js";
import {blueprintPhaseArtifactWrite} from "../../src/mcp/tools/phase-artifacts.js";
import {createToolResponseContent} from "../../src/mcp/public-response.js";

const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

export const providerPhaseDir = ".blueprint/phases/01-service";
export const providerLookup = (cwd: string) => ({cwd, phase: "1"});

export function publicPayload(tool: string, result: unknown): any {
  return JSON.parse(createToolResponseContent(tool, result as any)[0]!.text);
}

export function countPublicString(tool: string, result: unknown, value: string): number {
  const walk = (candidate: unknown): number => {
    if (typeof candidate === "string") return candidate === value ? 1 : 0;
    if (!candidate || typeof candidate !== "object") return 0;
    return Object.values(candidate).reduce((count, item) => count + walk(item), 0);
  };
  return walk(publicPayload(tool, result));
}

export function portablePackets(value: unknown): any[] {
  const packets: any[] = [];
  const walk = (candidate: unknown) => {
    if (!candidate || typeof candidate !== "object") return;
    if (Object.hasOwn(candidate, "entries") && Array.isArray((candidate as any).entries) && typeof (candidate as any).pinnedGeneration === "string") packets.push(candidate);
    Object.values(candidate).forEach(walk);
  };
  walk(value);
  return packets;
}

type PortableMap = {
  rendered: any;
  files: Array<{path: string; bytes: Buffer}>;
  extracted: any[];
};

type MapOptions = {
  changedService?: boolean;
  predecessorPublicationProof?: Record<string, unknown>;
};

function providerSources(changedService = false) {
  return [
    {
      path: "src/service.ts",
      language: "typescript",
      source: changedService
        ? "export class Service { async fetch(id: string): Promise<string> { return refreshedPayload(id); } }\n"
        : "export class Service { async fetch(id: string): Promise<string> { return privateBodyPayload(id); } }\n",
    },
    {
      path: "src/main.ts",
      language: "typescript",
      source: "import {Service} from \"./service\"; export const create = (): Service => new Service();\n",
    },
    {
      path: "python/library.py",
      language: "python",
      source: "class Library:\n    async def resolve(self, name: str) -> str:\n        return privatePythonPayload(name)\n",
    },
    {
      path: "java/Quote.java",
      language: "java",
      source: "package demo; public record Quote(int units) { public Quote { privateConstructorPayload(); } public String label() throws java.io.IOException { return privateJavaPayload(); } }\n",
    },
    {
      path: "java/Policy.java",
      language: "java",
      source: "package demo; sealed interface Policy permits Allowed {} final class Allowed implements Policy {}\n",
    },
    {
      path: "schema/queries.sql",
      language: "unknown",
      source: "select stable_column from stable_table;\n",
    },
  ].map((row, index) => ({...row, bytes: Buffer.from(row.source), id: `file-${index}`}));
}

export async function createProviderMap(generationId: string, options: MapOptions = {}): Promise<PortableMap> {
  const sources = providerSources(options.changedService);
  const known = sources.map((row) => ({
    id: row.id,
    path: row.path,
    language: row.language,
    role: row.language === "unknown" ? "unknown" : "source",
    byteSize: row.bytes.length,
    contentHash: digest(row.bytes),
    parseStatus: row.language === "unknown" ? "unsupported" : "parsed",
    coverageStatus: row.language === "unknown" ? "file" : "full",
    ...(row.language === "unknown" ? {limitationReason: "unsupported-language"} : {}),
  }));
  const extracted: any[] = [];
  for (let index = 0; index < sources.length; index++) {
    const row = sources[index]!;
    const file = known[index]!;
    if (row.language === "unknown") {
      extracted.push({ok: true, file, symbols: [], imports: [], relationships: [], details: []});
      continue;
    }
    const adapter = row.language === "java" ? adaptJavaFile : row.language === "python" ? adaptPythonFile : adaptJavaScriptFile;
    const output = await adapter({file, source: row.bytes, knownFiles: known} as any);
    assert.equal(output.ok, true, JSON.stringify(output));
    extracted.push(output);
  }
  const shards = extracted.map((output, index) => ({
    generationId,
    shardId: `shard-${index}`,
    files: [output.file],
    symbols: output.symbols,
    imports: output.imports,
    relationships: output.relationships,
    details: output.details,
  }));
  const evidence = extracted.map((output) => ({
    kind: "file",
    recordId: output.file.id,
    path: output.file.path,
    contentHash: output.file.contentHash,
    coordinate: output.file.coordinate,
  }));
  const documents = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map((id) => [id, {
    summary: `The ${id} view covers the provider fixture sources.`,
    sections: [{heading: "Implementation", content: "Supported declarations retain source coordinates and unsupported source remains directly inspectable."}],
    evidencePaths: sources.map((row) => row.path),
  }]));
  const submission = {
    formatVersion: 1,
    generationId,
    documents,
    semantic: {
      capabilities: [{id: "mixed-capability", name: "Mixed implementation", summary: "Indexed provider fixture sources.", claimIds: ["mixed-claim"], evidence}],
      claims: [{id: "mixed-claim", basis: "observed", statement: "The provider fixture contains source-backed files.", evidence}],
      aliases: [{id: "mixed-alias", alias: "provider sources", targetKind: "capability", targetId: "mixed-capability", evidence: evidence.slice(0, 1)}],
    },
  };
  const records = extracted.flatMap((output) => [
    {kind: "file", recordId: output.file.id, path: output.file.path, contentHash: output.file.contentHash, coordinate: output.file.coordinate},
    ...output.symbols.map((record: any) => ({kind: "symbol", recordId: record.id, path: record.path, contentHash: record.contentHash, coordinate: record.coordinate})),
    ...output.imports.map((record: any) => ({kind: "import", recordId: record.id, path: record.sourcePath, contentHash: record.contentHash, coordinate: record.coordinate})),
    ...output.relationships.map((record: any) => ({kind: "relationship", recordId: record.id, path: record.sourcePath, contentHash: record.contentHash, coordinate: record.coordinate})),
  ]);
  const validated = validatePortableMapModel(shards, submission as any, {
    generationId,
    files: extracted.map((output) => ({path: output.file.path, byteSize: output.file.byteSize, contentHash: output.file.contentHash})),
    records,
  });
  assert.equal(validated.ok, true, JSON.stringify(validated));
  if (!validated.ok) throw new Error("provider fixture validation failed");
  const rendered = renderPortableMap(validated.data, {
    generationId,
    generatedAt: "2026-09-24T09:00:00.000Z",
    gitCommit: null,
    inventoryFingerprint: digest(`provider-inventory-${generationId}`),
    parserAssets: [],
    ...(options.predecessorPublicationProof ? {predecessorPublicationProof: options.predecessorPublicationProof} : {}),
  } as any);
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  if (!rendered.ok) throw new Error("provider fixture render failed");
  return {rendered, files: sources.map((row) => ({path: row.path, bytes: row.bytes})), extracted};
}

export async function installProviderMap(root: string, rendered: any, immutableOnly = false) {
  for (const [relative, bytes] of Object.entries(rendered.files)) {
    if (immutableOnly && relative !== "INDEX.md" && !relative.startsWith("generations/")) continue;
    const target = path.join(root, ".blueprint", "codebase", relative);
    await fs.mkdir(path.dirname(target), {recursive: true});
    await fs.writeFile(target, bytes as Uint8Array);
  }
}

async function installSources(root: string, files: Array<{path: string; bytes: Buffer}>) {
  for (const file of files) {
    const target = path.join(root, file.path);
    await fs.mkdir(path.dirname(target), {recursive: true});
    await fs.writeFile(target, file.bytes);
  }
}

export async function createProviderFixture(options: {portableOnly?: boolean} = {}) {
  const root = await createGitRepo("portable-provider-regression-");
  try {
    const map = await createProviderMap("provider-original");
    await installSources(root, map.files);
    await installProviderMap(root, map.rendered, options.portableOnly ?? true);
    await fs.mkdir(path.join(root, providerPhaseDir), {recursive: true});
    await fs.writeFile(path.join(root, "README.md"), "# Service fixture\nService lookup returns the selected catalog record.\n");
    await fs.writeFile(path.join(root, ".blueprint/PROJECT.md"), "# Project\n\nMaintain a service and preserve customer records.\n\n## Constraints\n\n- Preserve customer records during refresh and retries.\n");
    await fs.writeFile(path.join(root, ".blueprint/REQUIREMENTS.md"), "# Requirements\n\n- R-1: Preserve service lookup behavior and bind inspected source evidence.\n");
    await fs.writeFile(path.join(root, ".blueprint/ROADMAP.md"), "# Roadmap: Service\n\n## Phases\n\n- [ ] **Phase 1: Service** - Maintain service lookup\n\n## Phase Details\n\n### Phase 1: Service\n**Goal**: Maintain service lookup.\n**Requirements**: R-1\n**Success Criteria**:\n1. Source changes invalidate stale findings.\n");
    await blueprintConfigSet({cwd: root, patch: {workflow: {research: false, ui_phase: false, plan_check: false}, research: {external_sources: "off"}}});
    const context = await blueprintPhaseArtifactWrite({
      ...providerLookup(root),
      artifact: "context",
      model: validPhaseContextModel({phaseLabel: "phase 1", openQuestions: [], deferredIdeas: [], externalConstraints: ["Preserve customer records during refresh and retries."]}),
    });
    assert.notEqual(context.status, "invalid", JSON.stringify(context));
    const service = map.extracted.find((item) => item.file.path === "src/service.ts");
    const method = service?.symbols.find((item: any) => item.kind === "method");
    assert.ok(method);
    return {
      root,
      map,
      selectionServiceFile: {kind: "file" as const, recordId: "file-0"},
      selectionServiceSymbol: {kind: "symbol" as const, recordId: method.id},
      selectionPythonFile: {kind: "file" as const, recordId: "file-2"},
      cleanup: () => fs.rm(path.dirname(root), {recursive: true, force: true}),
    };
  } catch (error) {
    await fs.rm(path.dirname(root), {recursive: true, force: true});
    throw error;
  }
}

export async function installProviderSuccessor(root: string, prior: PortableMap, generationId = "provider-next", changedService = false) {
  const old = prior.rendered;
  const successor = await createProviderMap(generationId, {
    changedService,
    predecessorPublicationProof: {
      generationId: old.sealedGeneration.generationId,
      manifest: old.sealedGeneration.manifest,
      entry: old.sealedGeneration.entry,
      committedIndexHash: old.rootIndexHash,
    },
  });
  await installSources(root, successor.files);
  await installProviderMap(root, successor.rendered, true);
  return successor;
}

export function providerResearchModel() {
  return {
    summary: "Preserve the inspected service lookup implementation when extending its validation.",
    findings: [{id: "CLM-001", finding: "The Service class exposes the fetch method for lookup.", sourceIds: ["SRC-001"], confidence: "HIGH", requirementIds: ["R-1"], status: "supported"}],
    recommendations: [{id: "REC-001", recommendation: "Keep source-backed lookup behavior and verify evidence freshness before publishing.", findingIds: ["CLM-001"], affectedSurfaces: ["src/service.ts"], verification: ["Change the selected source and verify that the previous research basis becomes stale."], requirementIds: ["R-1"], status: "ready"}],
    openQuestions: [],
    sources: [{id: "SRC-001", lane: "repo", reference: "src/service.ts:1", excerpt: "export class Service"}],
  };
}

export function projectCitationResearchModel() {
  const model = providerResearchModel();
  return {...model, sources: [{id: "SRC-001", lane: "repo", reference: ".blueprint/PROJECT.md:1", excerpt: "# Project"}]};
}

export function providerPlanModel() {
  return {
    plans: [{
      key: "lookup",
      title: "Preserve service lookup",
      goal: "Keep the existing service behavior while verifying freshness.",
      scope: ["Update src/service.ts and its source freshness checks."],
      dependsOn: [],
      tasks: [{id: "T1", title: "Verify service lookup evidence", readFirst: ["src/service.ts"], filesModified: ["src/service.ts"], requirements: ["R-1"], action: ["Preserve the Service.fetch method and its lookup behavior."], acceptanceCriteria: ["src/service.ts still exports Service with its fetch method.", "The selected source freshness check rejects changed bytes."]}],
      mustHaves: ["Source changes cannot be represented as unchanged inspected evidence."],
    }],
  };
}

export async function installSqlPortableMap(root: string, generationId: string) {
  const rows = Array.from({length: 70}, (_, index) => {
    const bytes = Buffer.from(`select column_${index} from table_${index};\n`);
    return {id: `file-${index}`, path: `sql/query-${index}.sql`, bytes};
  });
  await installSources(root, rows);
  const files = rows.map((row) => ({id: row.id, path: row.path, language: "unknown", role: "unknown", byteSize: row.bytes.length, contentHash: digest(row.bytes), parseStatus: "unsupported", coverageStatus: "file", limitationReason: "unsupported-language"}));
  const evidence = files.map((file) => ({kind: "file", recordId: file.id, path: file.path, contentHash: file.contentHash}));
  const claims = Array.from({length: 3}, (_, index) => ({id: `claim-${index}`, basis: "observed", statement: "The selected SQL statements name their declared table and column.", evidence: evidence.slice(index * 24, (index + 1) * 24)}));
  const documents = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map((id) => [id, {summary: "The portable map inventories SQL query sources.", sections: [{heading: "Queries", content: "SQL files are available for direct inspection."}], evidencePaths: rows.slice(0, 3).map((row) => row.path)}]));
  const model = {formatVersion: 1, generationId, documents, semantic: {capabilities: [{id: "all-queries", name: "Query inventory", summary: "A source-backed inventory of query statements.", claimIds: claims.map((claim) => claim.id), evidence: evidence.slice(0, 1)}], claims, aliases: [{id: "queries-alias", alias: "database queries", targetKind: "capability", targetId: "all-queries", evidence: evidence.slice(0, 1)}]}};
  const checked = validatePortableMapModel([{generationId, shardId: "sql", files, symbols: [], imports: [], relationships: [], details: []}], model as any, {generationId, files: files.map((file) => ({path: file.path, byteSize: file.byteSize, contentHash: file.contentHash})), records: evidence});
  assert.equal(checked.ok, true, JSON.stringify(checked));
  if (!checked.ok) throw new Error("SQL fixture validation failed");
  const rendered = renderPortableMap(checked.data, {generationId, generatedAt: "2026-09-24T09:00:00.000Z", gitCommit: null, inventoryFingerprint: digest(`sql-${generationId}`), parserAssets: []});
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  if (!rendered.ok) throw new Error("SQL fixture render failed");
  await installProviderMap(root, rendered, true);
  return {rendered, selections: rows.map((row) => ({kind: "file" as const, recordId: row.id}))};
}
