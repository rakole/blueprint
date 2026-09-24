import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import * as z from "zod/v4";

import { readArtifactContract, renderArtifactScaffoldTemplate } from "../artifact-contracts/index.js";
import {
  CODEBASE_DOCUMENT_IDS, codebaseMapModelSchema, compileCodebaseMap,
  validateCodebaseContent, type CodebaseDocumentId
} from "../codebase-authoring.js";
import {
  portableLegacyPublicationPendingSchema,
  portableLegacyPublicationSnapshotSchema,
  type PortableLegacyPublicationSnapshot
} from "../codebase-index/contracts.js";
import { prepareTextForPersistence } from "../../shared/security.js";
import { scrubLegacyCodebaseFailureLog } from "../write-failure-log.js";
import {
  CODEBASE_PUBLICATION_PATH, ensureRepoRoot, inspectBlueprintArtifacts,
  inspectBootstrapArtifacts, inspectCodebaseWriteGuard, resolveBlueprintPath, resolveRepoRelativePath,
  withBlueprintRepoLock, writeJsonFile, writeTextFile
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import { blueprintCommandCatalog } from "./project.js";

const execFileAsync = promisify(execFile);
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const snapshotSchema = portableLegacyPublicationSnapshotSchema;
type Snapshot = PortableLegacyPublicationSnapshot;
const pendingSchema = portableLegacyPublicationPendingSchema;
const prepareSchema = z.object({cwd: z.string().optional(), inputs: z.array(z.string()).default([]), focus: z.string().optional(), restart: z.boolean().default(false)}).strict();
const submitSchema = z.object({cwd: z.string().optional(), snapshot: snapshotSchema,
  documents: codebaseMapModelSchema.default({}), overwrite: z.boolean().default(false)}).strict();
const artifactId = (id: CodebaseDocumentId) => `codebase.${id}` as const;
const artifactPath = (id: CodebaseDocumentId) => readArtifactContract(artifactId(id)).canonicalFilePattern;

async function readOptional(file: string): Promise<string | null> {
  try {
    if (!(await fs.lstat(file)).isFile()) throw new Error("Mapping inputs and targets must be regular files, not symlinks or directories.");
    return await fs.readFile(file, "utf8");
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
async function targets(root: string) {
  const entries = await Promise.all(CODEBASE_DOCUMENT_IDS.map(async id => [id,
    await readOptional(resolveBlueprintPath(root, artifactPath(id)))] as const));
  return Object.fromEntries(entries) as Record<CodebaseDocumentId, string | null>;
}
function targetHashes(contents: Record<CodebaseDocumentId, string | null>): Snapshot["targets"] {
  return Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, contents[id] === null ? null : hash(contents[id])])) as Snapshot["targets"];
}
async function inventory(root: string): Promise<string[]> {
  const {stdout} = await execFileAsync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {cwd: root, maxBuffer: 16 * 1024 * 1024});
  return [...new Set(stdout.split("\0").filter(file => file && !/^(?:\.blueprint|\.planning|\.git)(?:\/|$)/.test(file)))].sort();
}
function evidencePath(root: string, input: string): string {
  // Paths are explicit inputs, never inferred from prose or example code.
  if (input !== input.trim() || /[\r\n\0]/.test(input) || input.includes("\\")) throw new Error("Evidence paths must be literal repo-relative file paths.");
  const absolute = resolveRepoRelativePath(root, input);
  const relative = path.relative(root, absolute).split(path.sep).join("/");
  if (/^(?:\.blueprint|\.planning|\.git)(?:\/|$)/.test(relative) || /(?:^|\/)(?:\.env(?:\..*)?|.*\.(?:pem|key)|credentials(?:\.[^/]*)?)$/i.test(relative)) {
    throw new Error("Select source evidence, excluding runtime state and secret-bearing files.");
  }
  return relative;
}
async function inputHashes(root: string, inputs: string[]) {
  const entries = await Promise.all([...new Set(inputs.map(input => evidencePath(root, input)))].sort().map(async input => {
    const absolute = resolveRepoRelativePath(root, input);
    if (!(await fs.lstat(absolute)).isFile()) throw new Error("Evidence inputs must be regular files, not symlinks or directories.");
    // Also inspect the resolved location: an ancestor directory can be a symlink
    // into excluded runtime state or secrets while its lexical name looks safe.
    evidencePath(root, path.relative(await fs.realpath(root), await fs.realpath(absolute)).split(path.sep).join("/"));
    return [input, hash(await fs.readFile(absolute))];
  }));
  return Object.fromEntries(entries) as Record<string, string>;
}
async function coreHash(root: string): Promise<string> {
  const files = ["PROJECT.md", "REQUIREMENTS.md", "ROADMAP.md", "STATE.md", "config.json"];
  return hash(JSON.stringify(await Promise.all(files.map(file => readOptional(resolveBlueprintPath(root, `.blueprint/${file}`))))));
}
async function eligibility(root: string) {
  const inspection = await inspectBlueprintArtifacts(root);
  if (inspection.readiness === "partial") return {allowed: false, readiness: inspection.readiness, next: "health"};
  if (inspection.readiness === "uninitialized" || inspection.readiness === "mapping-incomplete") {
    const bootstrap = await inspectBootstrapArtifacts(root, inspection);
    if (bootstrap.brownfield.repoShape !== "brownfield") return {allowed: false, readiness: inspection.readiness, next: "new-project"};
  }
  return {allowed: true, readiness: inspection.readiness, next: inspection.readiness === "initialized" ? "progress" : "new-project"};
}
async function route(command: string): Promise<string | null> {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands[command];
  return entry?.implemented && entry.status === "implemented" ? entry.command : null;
}
async function readPending(root: string) {
  const content = await readOptional(resolveBlueprintPath(root, CODEBASE_PUBLICATION_PATH));
  if (content === null) return null;
  try { return pendingSchema.parse(JSON.parse(content)); }
  catch { return {operationId: hash(content), snapshot: null, hashes: null}; }
}

export async function blueprintMapPrepare(raw: {cwd?: string; inputs?: string[]; focus?: string; restart?: boolean}) {
  const args = prepareSchema.parse(raw);
  const root = await ensureRepoRoot(args.cwd);
  await scrubLegacyCodebaseFailureLog(root);
  return withBlueprintRepoLock(root, "codebase-publication", async () => {
    const gate = await eligibility(root);
    if (!gate.allowed) return {status: "blocked", readiness: gate.readiness, nextAction: await route(gate.next)};
    const guard = await inspectCodebaseWriteGuard(root);
    if (!guard.allowed) {
      return {
        status: "blocked",
        readiness: gate.readiness,
        issues: [guard.reason ?? "Portable codebase publication state blocks legacy mapping mutations."],
        nextAction: null
      };
    }
    const pending = await readPending(root);
    if (pending && !args.restart) return {status: "partial", snapshot: pending.snapshot, expectedHashes: pending.hashes,
      issues: ["An accepted bundle publication is incomplete. Resubmit its original snapshot and documents. If these are unavailable or inputs changed, prepare with restart:true, then author all seven documents from fresh evidence and submit with overwrite:true. Rejected content was not stored."], nextAction: null};
    const [contents, files, config, core, inputs] = await Promise.all([
      targets(root), inventory(root), blueprintConfigGet({cwd: root, scope: "effective"}), coreHash(root), inputHashes(root, args.inputs)
    ]);
    const snapshot: Snapshot = {version: 1, root: hash(await fs.realpath(root)), inventory: hash(JSON.stringify(files)), inputs, core, targets: targetHashes(contents), previousPublication: pending?.operationId ?? null};
    const existing = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, {path: artifactPath(id),
      status: contents[id] === null ? "missing" : validateCodebaseContent(contents[id], artifactId(id)).valid ? "valid" : "invalid"}]));
    const requiredDocuments = CODEBASE_DOCUMENT_IDS.filter(id => pending || existing[id].status !== "valid");
    const samplePath = Object.keys(inputs)[0];
    const needsInputs = (requiredDocuments.length > 0 || Boolean(args.focus)) && !samplePath;
    return {
      status: needsInputs ? "blocked" : requiredDocuments.length || args.focus ? "ready" : "reused",
      issues: needsInputs ? ["Select representative repository files and prepare again with inputs before authoring."] : [], readiness: gate.readiness, focus: args.focus ?? null,
      snapshot, existing, requiredDocuments,
      inputsUsed: Object.keys(inputs), inventory: files.slice(0, 500), omittedInventoryCount: Math.max(0, files.length - 500),
      workflow: {subagents: config.config.workflow.subagents, parallelization: config.config.parallelization.enabled},
      authoring: {
        schema: z.toJSONSchema(codebaseMapModelSchema),
        example: samplePath ? {stack: {summary: `Describe the runtime established by ${samplePath}.`, evidencePaths: [samplePath]}} : null,
        exampleIsIllustrative: true,
        rules: ["Author only documents that need mapping or an explicitly requested refresh. Omitted valid documents are reused.",
          "Each authored document needs substantive summary and at least one evidencePaths entry from inputsUsed. Read those sources; citations alone do not establish facts.",
          "Optional sections may be omitted or empty. Multiline prose, Unicode and fenced code are supported. Runtime supplies titles, headings and evidence lists.",
          "Use a targeted file inventory to choose inputs before prepare. If more sources are needed, prepare again with the expanded inputs before authoring.",
          "All missing or invalid documents must be supplied. Source/input changes and concurrent target changes block publication.",
          "Explicit refresh or replace intent authorizes overwrite:true. Otherwise reuse existing documents; ask only when replacement is needed.",
          "Prompt-boundary safety, valid evidence references, and non-placeholder substantive content remain blocking. No word counts or mandatory filler."]
      },
      warnings: config.warnings,
      nextAction: requiredDocuments.length || args.focus ? null : await route(gate.next)
    };
  });
}

export async function blueprintMapSubmit(raw: {cwd?: string; snapshot: Snapshot; documents?: unknown; overwrite?: boolean}) {
  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) return {status: "invalid", saved: false, issues: parsed.error.issues.map(issue => ({path: issue.path.join("."), code: issue.code})), warnings: []};
  const args = parsed.data;
  const root = await ensureRepoRoot(args.cwd);
  await scrubLegacyCodebaseFailureLog(root);
  return withBlueprintRepoLock(root, "codebase-publication", async () => {
    const gate = await eligibility(root);
    if (!gate.allowed) return {status: "blocked", saved: false, nextAction: await route(gate.next), issues: ["Project prerequisites changed."]};
    const guard = await inspectCodebaseWriteGuard(root);
    if (!guard.allowed) {
      return {
        status: "blocked",
        saved: false,
        issues: [guard.reason ?? "Portable codebase publication state blocks legacy mapping mutations."],
        warnings: []
      };
    }
    const snapshot = {...args.snapshot, inputs: Object.fromEntries(Object.entries(args.snapshot.inputs).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0))};
    const pending = await readPending(root);
    const [current, files, inputs, core] = await Promise.all([
      targets(root), inventory(root), inputHashes(root, Object.keys(snapshot.inputs)), coreHash(root)
    ]);
    if (snapshot.root !== hash(await fs.realpath(root)) || snapshot.inventory !== hash(JSON.stringify(files)) || snapshot.core !== core || Object.keys(inputs).length !== Object.keys(snapshot.inputs).length || Object.entries(inputs).some(([file, digest]) => snapshot.inputs[file] !== digest)) {
      return {status: "stale", saved: false, issues: ["Prepared source evidence, repository inventory, or project state changed. Review fresh evidence before generating again."], warnings: []};
    }
    const warnings: string[] = [];
    const issues: string[] = [];
    let compiled: Partial<Record<CodebaseDocumentId, string>>;
    try { compiled = compileCodebaseMap(args.documents); }
    catch { return {status: "invalid", saved: false, issues: ["Document content violates the authoring contract. Use substantive summary, unique section headings and evidence paths."], warnings: []}; }
    for (const id of CODEBASE_DOCUMENT_IDS) {
      const document = args.documents[id];
      if (document) for (const reference of document.evidencePaths) {
        let referencePath: string;
        try { referencePath = evidencePath(root, reference); }
        catch { issues.push(`${id}: evidence reference must be an allowed repo-relative source file.`); continue; }
        if (!Object.hasOwn(snapshot.inputs, referencePath)) issues.push(`${id}: evidence reference was not included in prepared inputs.`);
      }
      if (compiled[id] !== undefined) {
        try {
          const prepared = prepareTextForPersistence(compiled[id]!, {label: artifactPath(id)});
          compiled[id] = prepared.content;
          warnings.push(...prepared.warnings);
        } catch { issues.push(`${id}: content failed the prompt-boundary safety check.`); }
      }
      const content = compiled[id] ?? current[id];
      if (content === null) { issues.push(`${id}: missing document must be authored.`); continue; }
      const validation = validateCodebaseContent(content, artifactId(id));
      issues.push(...validation.issues.map(issue => `${id}: ${issue}`));
      warnings.push(...validation.warnings);
    }
    if (issues.length) return {status: "invalid", saved: false, issues, warnings};
    const wanted = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, compiled[id] ?? current[id]])) as Record<CodebaseDocumentId, string>;
    const hashes = targetHashes(wanted);
    const operationId = hash(JSON.stringify({snapshot, hashes}));
    const restarting = pending && snapshot.previousPublication === pending.operationId && args.overwrite && CODEBASE_DOCUMENT_IDS.every(id => compiled[id] !== undefined);
    if (pending && pending.operationId !== operationId && !restarting) return {status: "blocked", saved: false, issues: ["Resume the accepted partial publication with the original snapshot and documents, or prepare restart:true and submit all seven fresh documents with overwrite:true."], warnings};
    if (!pending && snapshot.previousPublication !== null && CODEBASE_DOCUMENT_IDS.some(id => (current[id] === null ? null : hash(current[id])) !== hashes[id])) return {status: "stale", saved: false, issues: ["The publication selected for restart has already changed. Prepare again."], warnings};
    const currentHashes = targetHashes(current);
    for (const id of CODEBASE_DOCUMENT_IDS) {
      const alreadyCommitted = pending?.operationId === operationId && pending.hashes?.[id] === currentHashes[id];
      if (!alreadyCommitted && currentHashes[id] !== snapshot.targets[id] && (compiled[id] === undefined || currentHashes[id] !== hashes[id])) issues.push(`${id}: target changed since preparation.`);
      if (!pending && current[id] !== null && currentHashes[id] !== hashes[id] && !args.overwrite && current[id] !== renderArtifactScaffoldTemplate(artifactId(id))) issues.push(`${id}: replacement requires explicit refresh intent (overwrite:true).`);
    }
    if (issues.length) return {status: "stale", saved: false, issues, warnings};
    const changed = CODEBASE_DOCUMENT_IDS.filter(id => currentHashes[id] !== hashes[id]);
    if (!changed.length && !pending) return {status: "reused", saved: true, paths: CODEBASE_DOCUMENT_IDS.map(artifactPath), warnings, nextAction: await route(gate.next)};
    // Only hashes, paths and operation identity survive between individual atomic writes.
    // Validate all content and preconditions above before creating this accepted-publication marker.
    await writeJsonFile(resolveBlueprintPath(root, CODEBASE_PUBLICATION_PATH), {version: 1, operationId, snapshot, hashes, stage: "publishing"});
    const written: string[] = [];
    try {
      for (const id of changed) {
        const target = resolveBlueprintPath(root, artifactPath(id));
        const observed = await readOptional(target);
        if ((observed === null ? null : hash(observed)) !== currentHashes[id]) throw new Error("Target changed during publication.");
        await writeTextFile(target, wanted[id]);
        written.push(artifactPath(id));
      }
      const finalHashes = targetHashes(await targets(root));
      if (JSON.stringify(finalHashes) !== JSON.stringify(hashes)) throw new Error("Publication verification failed.");
      const finalInputs = await inputHashes(root, Object.keys(snapshot.inputs));
      if (Object.entries(finalInputs).some(([file, digest]) => snapshot.inputs[file] !== digest) ||
          await coreHash(root) !== snapshot.core || hash(JSON.stringify(await inventory(root))) !== snapshot.inventory) {
        throw new Error("Evidence changed during publication.");
      }
      await fs.unlink(resolveBlueprintPath(root, CODEBASE_PUBLICATION_PATH));
    } catch {
      const published = CODEBASE_DOCUMENT_IDS.filter(id => written.includes(artifactPath(id)) || snapshot.targets[id] !== hashes[id] && currentHashes[id] === hashes[id]).map(artifactPath);
      return {status: "partial", saved: published.length > 0, written, published, issues: ["Accepted publication is incomplete. Retry the original snapshot and documents. Canonical files already written are preserved."], warnings, nextAction: null};
    }
    return {status: "published", saved: true, written, reused: CODEBASE_DOCUMENT_IDS.filter(id => !changed.includes(id)).map(artifactPath),
      paths: CODEBASE_DOCUMENT_IDS.map(artifactPath), warnings, nextAction: await route(gate.next)};
  });
}

export const mapToolDefinitions = [
  {name: "blueprint_map_prepare", description: "Prepare codebase mapping: readiness, reuse, schema, selected evidence hashes and target snapshot. No drafts or scaffolds are written.", inputSchema: prepareSchema.shape,
    handler: (args: Record<string, unknown>) => blueprintMapPrepare(args as z.input<typeof prepareSchema>)},
  {name: "blueprint_map_submit", description: "Validate and publish a prepared codebase bundle directly. Echo snapshot unchanged; author substantive summaries, optional sections and references from inputsUsed. Explicit refresh intent authorizes overwrite.", inputSchema: submitSchema.shape,
    handler: (args: Record<string, unknown>) => blueprintMapSubmit(args as z.input<typeof submitSchema>)}
];
