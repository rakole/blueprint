import {createHash} from "node:crypto";
import * as z from "zod/v4";

import {CODEBASE_DOCUMENT_IDS} from "../codebase-authoring.js";
import {ensureRepoRoot, inspectBlueprintArtifacts, inspectBootstrapArtifacts} from "../tools/artifacts.js";
import {
  PORTABLE_MAP_FORMAT_VERSION,
  generationLocalIdSchema,
  portableMapSubmissionSchema,
  portableTargetHashesSchema,
  type PortableMapSubmission
} from "./contracts.js";
import {
  capturePortableSourceFreshness,
  type PortableExtractionSuccess
} from "./extraction.js";
import {
  applyInstructionLink,
  prepareInstructionLink,
  type InstructionLinkApplyResult,
  type InstructionLinkPrepareResult
} from "./instruction-link.js";
import {
  loadPortableOperation,
  portableOperationCommitState,
  PORTABLE_OPERATION_PUBLIC_PACKET_BUDGET_BYTES,
  portableOperationPublicationPreflight,
  preparePortableOperation,
  readPortableOperationReceipt,
  recordPortableOperationCommitUnderPublicationLock,
  recordPortableOperationAcceptance,
  revalidatePortableOperation
} from "./operations.js";
import {publishPortableMap, type PortableFreshnessContext, type PortablePublicationResult} from "./publication.js";
import {CODEBASE_INDEX_INSTRUCTION_SNIPPET} from "./instruction-link.js";
import {renderPortableMap} from "./render.js";
import {validatePortableMapModel} from "./model-validation.js";

const portableRepairSchema = z.strictObject({
  authorized: z.literal(true),
  previousIndexHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  targetHashes: portableTargetHashesSchema,
  observedMarkerHash: z.string().regex(/^[a-f0-9]{64}$/).nullable()
});

const portablePrepareSchema = z.strictObject({
  cwd: z.string().optional(),
  formatVersion: z.literal(PORTABLE_MAP_FORMAT_VERSION),
  operationId: generationLocalIdSchema.optional(),
  cursor: z.string().optional(),
  intent: z.enum(["new", "refresh", "upgrade", "repair"]).default("new"),
  repair: portableRepairSchema.optional()
});

const portableSubmitSchema = z.strictObject({
  cwd: z.string().optional(),
  formatVersion: z.literal(PORTABLE_MAP_FORMAT_VERSION),
  operationId: generationLocalIdSchema,
  model: portableMapSubmissionSchema.optional(),
  submission: portableMapSubmissionSchema.optional(),
  intent: z.enum(["new", "refresh", "upgrade", "repair"]).default("new"),
  linkInstructions: z.boolean().default(false),
  instructionPath: z.string().optional()
}).superRefine((value, context) => {
  if ((value.model === undefined) === (value.submission === undefined)) {
    context.addIssue({code: "custom", path: ["model"], message: "Provide one complete portable map model."});
  }
});

type PortablePrepareInput = z.input<typeof portablePrepareSchema>;
type PortableSubmitInput = z.input<typeof portableSubmitSchema>;
type PublicResult = Record<string, unknown>;

const AUTHORING_RESOURCE = "blueprint://commands/map-codebase/runtime-contract";
const MAX_PUBLIC_RESPONSE_BYTES = 48 * 1024;
const MAX_PUBLIC_MODEL_BYTES = 48 * 1024;
const PUBLIC_FAILURE = "The portable map operation could not be completed.";
const PUBLIC_INVALID = "The portable map request is invalid.";
const PORTABLE_SUBMISSION_SCHEMA = z.toJSONSchema(portableMapSubmissionSchema);

function digest(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function modelHash(model: PortableMapSubmission): string {
  return digest(`${canonical(model)}\n`);
}

function modelBytes(model: PortableMapSubmission): number {
  // The cap applies to the complete authored JSON payload itself.  The hash
  // framing newline is an internal digest detail and is not authored input.
  return Buffer.byteLength(canonical(model), "utf8");
}

function rawModelBytes(raw: unknown): number | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = Object.hasOwn(raw, "model") ? (raw as Record<string, unknown>).model : (raw as Record<string, unknown>).submission;
  if (value === undefined) return null;
  try { return Buffer.byteLength(JSON.stringify(value), "utf8"); } catch { return Number.POSITIVE_INFINITY; }
}

function fixedFailure(status: string = "invalid", code = "invalid-input"): PublicResult {
  return {status, saved: false, committed: false, issues: [{code, message: status === "invalid" ? PUBLIC_INVALID : PUBLIC_FAILURE}], warnings: []};
}

function diagnosticsFor(values: readonly {readonly code?: string; readonly message?: string}[]): readonly {code: string; message: string}[] {
  return values.slice(0, 8).map(value => ({code: typeof value.code === "string" ? value.code : "invalid-state", message: typeof value.message === "string" ? value.message : PUBLIC_FAILURE}));
}

function compactCoverage(extraction: Pick<PortableExtractionSuccess, "coverage">) {
  return {
    candidates: extraction.coverage.candidateCount,
    included: extraction.coverage.includedCount,
    excluded: extraction.coverage.excludedCount,
    structural: extraction.coverage.structural,
    exclusions: extraction.coverage.exclusions
  };
}

function authoringContract(generationId: string): PublicResult {
  const documents = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, {
    summary: `Observed findings for the ${id} area, grounded in the prepared source evidence.`,
    evidencePaths: ["<prepared-source-path>"]
  }])) as Record<string, unknown>;
  return {
    formatVersion: PORTABLE_MAP_FORMAT_VERSION,
    schema: PORTABLE_SUBMISSION_SCHEMA,
    schemaResource: AUTHORING_RESOURCE,
    example: {
      formatVersion: PORTABLE_MAP_FORMAT_VERSION,
      generationId,
      documents,
      semantic: {capabilities: [], claims: [], aliases: []}
    },
    requiredDocuments: [...CODEBASE_DOCUMENT_IDS],
    rules: [
      "Submit the complete model using the prepared generationId and every required document.",
      "Use only structural record ids and source coordinates from the prepared evidence packet.",
      "Every semantic record and document must cite exact evidence; unknowns must remain explicit.",
      "The server validates the whole structure, provenance, safety boundaries, and all seven substantive views before publication.",
      "Rejected models are discarded; prepare again when evidence or targets are stale."
    ]
  };
}

function receipt(result: Awaited<ReturnType<typeof readPortableOperationReceipt>>): PublicResult {
  if (!result) return fixedFailure();
  if (!("ok" in result) || !result.ok) {
    return {
      formatVersion: PORTABLE_MAP_FORMAT_VERSION,
      status: result.status,
      saved: false,
      committed: false,
      operationId: result.operationId,
      generationId: result.generationId,
      receipt: result,
      issues: diagnosticsFor(result.diagnostics),
      warnings: []
    };
  }
  return {
    formatVersion: PORTABLE_MAP_FORMAT_VERSION,
    status: result.status,
    saved: true,
    committed: false,
    operationId: result.operationId,
    generationId: result.generationId,
    receipt: result,
    warnings: []
  };
}

function fitsPublicResponse(value: PublicResult): boolean {
  try { return Buffer.byteLength(JSON.stringify(value), "utf8") <= MAX_PUBLIC_RESPONSE_BYTES; } catch { return false; }
}

function freshnessFor(repositoryRoot: string, extraction: PortableExtractionSuccess) {
  return async (_context: PortableFreshnessContext): Promise<boolean> => {
    const fresh = await capturePortableSourceFreshness(repositoryRoot);
    if (!fresh.ok) return false;
    const root = extraction.root;
    return fresh.root.path === root.path && fresh.root.realPath === root.realPath && fresh.root.device === root.device && fresh.root.inode === root.inode &&
      fresh.inventoryFingerprint === extraction.inventoryFingerprint && digest(`${canonical(fresh.provenance)}\n`) === digest(`${canonical(extraction.provenance)}\n`);
  };
}

function publicationResult(result: PortablePublicationResult, operationId: string, generationId: string, extraction: PortableExtractionSuccess): PublicResult {
  const output: PublicResult = {
    formatVersion: PORTABLE_MAP_FORMAT_VERSION,
    status: result.status,
    saved: result.committed,
    committed: result.committed,
    operationId,
    generationId,
    coverage: compactCoverage(extraction),
    paths: result.committed ? [".blueprint/codebase/INDEX.md"] : [],
    retainedGenerations: result.retainedGenerations,
    retainedBytes: result.retainedBytes,
    allocatedGenerations: result.allocatedGenerations,
    allocatedBytes: result.allocatedBytes,
    cleanupPending: result.cleanupPending ?? false,
    historicallyCommitted: result.committed,
    generationValid: result.committed,
    instructionSnippet: CODEBASE_INDEX_INSTRUCTION_SNIPPET,
    warnings: result.diagnostics.filter(item => item.code === "compatibility-divergence").map(item => item.message),
    issues: diagnosticsFor(result.diagnostics)
  };
  return fitsPublicResponse(output) ? output : fixedFailure("invalid", "response-too-large");
}

function compactInstructionLink(value: InstructionLinkPrepareResult | InstructionLinkApplyResult): PublicResult {
  if (value.status === "ready") return {status: "ready", instructionPath: value.instructionPath, currentStatus: value.currentStatus};
  if (value.status === "applied" || value.status === "already-linked") return {status: value.status, instructionPath: value.instructionPath, changed: value.changed};
  if (value.status === "choices") return {status: value.status, choices: [...value.choices], snippet: value.snippet, action: value.action};
  if (value.status === "snippet") return {status: value.status, snippet: value.snippet, action: value.action};
  return {status: "failure", action: "action" in value ? value.action : PUBLIC_FAILURE};
}

async function portableEligibility(root: string): Promise<{allowed: boolean; readiness: string; next: string}> {
  const inspection = await inspectBlueprintArtifacts(root);
  if (inspection.readiness === "partial") return {allowed: false, readiness: inspection.readiness, next: "health"};
  if (inspection.readiness === "uninitialized" || inspection.readiness === "mapping-incomplete") {
    const bootstrap = await inspectBootstrapArtifacts(root, inspection);
    if (bootstrap.brownfield.repoShape !== "brownfield") return {allowed: false, readiness: inspection.readiness, next: "new-project"};
  }
  return {allowed: true, readiness: inspection.readiness, next: inspection.readiness === "initialized" ? "progress" : "new-project"};
}

async function applyOptionalInstructionLink(repositoryRoot: string, input: PortableSubmitInput): Promise<PublicResult | null> {
  if (!input.linkInstructions) return null;
  const prepared = await prepareInstructionLink({repositoryRoot, ...(input.instructionPath === undefined ? {} : {instructionPath: input.instructionPath})});
  if (prepared.status !== "ready") return compactInstructionLink(prepared);
  return compactInstructionLink(await applyInstructionLink({repositoryRoot, instructionPath: prepared.instructionPath, expectedHash: prepared.expectedHash}));
}

export async function blueprintPortableMapPrepare(raw: unknown): Promise<PublicResult> {
  const parsed = portablePrepareSchema.safeParse(raw);
  if (!parsed.success) return fixedFailure();
  try {
    const root = await ensureRepoRoot(parsed.data.cwd);
    if (parsed.data.operationId) {
      const next = await readPortableOperationReceipt({repositoryRoot: root, operationId: parsed.data.operationId, ...(parsed.data.cursor === undefined ? {} : {cursor: parsed.data.cursor})});
      const output = receipt(next);
      return fitsPublicResponse(output) ? output : fixedFailure("invalid", "response-too-large");
    }
    if (parsed.data.intent === "repair" && !parsed.data.repair) return fixedFailure();
    const gate = await portableEligibility(root);
    if (!gate.allowed) return {status: "blocked", saved: false, committed: false, readiness: gate.readiness, nextAction: gate.next, issues: [{code: "readiness", message: "Project prerequisites are incomplete for portable mapping."}], warnings: []};
    const prepared = await preparePortableOperation({
      repositoryRoot: root,
      packetBudgetBytes: PORTABLE_OPERATION_PUBLIC_PACKET_BUDGET_BYTES,
      ...(parsed.data.intent === "repair" && parsed.data.repair ? {repair: parsed.data.repair} : {})
    });
    if (!prepared.ok) return {status: prepared.diagnostics[0]?.code === "unknown-marker" ? "conflict" : prepared.status, saved: false, committed: false, issues: diagnosticsFor(prepared.diagnostics), warnings: []};
    const output: PublicResult = {
      formatVersion: PORTABLE_MAP_FORMAT_VERSION,
      status: "ready",
      saved: false,
      committed: false,
      operationId: prepared.operationId,
      generationId: prepared.generationId,
      receipt: prepared.receipt,
      coverage: {candidates: prepared.metadata.coverage.candidateCount, included: prepared.metadata.coverage.includedCount, excluded: prepared.metadata.coverage.excludedCount,
        structural: prepared.metadata.coverage.structural, exclusions: prepared.metadata.coverage.exclusions},
      authoring: authoringContract(prepared.generationId),
      warnings: []
    };
    if (!fitsPublicResponse(output)) {
      const compact = {...output, authoring: {...authoringContract(prepared.generationId), example: undefined, rules: ["Read the registered source-owned contract before submitting the complete model."]}};
      if (!fitsPublicResponse(compact)) return fixedFailure("invalid", "response-too-large");
      return compact;
    }
    return output;
  } catch {
    return fixedFailure("invalid-state");
  }
}

export async function blueprintPortableMapSubmit(raw: unknown): Promise<PublicResult> {
  const authoredBytes = rawModelBytes(raw);
  if (authoredBytes !== null && authoredBytes > MAX_PUBLIC_MODEL_BYTES) return fixedFailure("invalid", "model-too-large");
  const parsed = portableSubmitSchema.safeParse(raw);
  if (!parsed.success) return fixedFailure();
  const input = parsed.data;
  const model = (input.model ?? input.submission)!;
  if (modelBytes(model) > MAX_PUBLIC_MODEL_BYTES) return fixedFailure("invalid", "model-too-large");
  try {
    const root = await ensureRepoRoot(input.cwd);
    const modelDigest = modelHash(model);
    // Read the durable operation identity before readiness gating. A known
    // exact committed operation is recovery work: it must be able to finish
    // marker cleanup after source/project changes and report its truthful
    // committed state without authorizing a new publication.
    const state = await portableOperationCommitState({repositoryRoot: root, operationId: input.operationId});
    const committedRecovery = Boolean(state.committed && state.accepted?.modelHash === modelDigest);
    const gate = await portableEligibility(root);
    if (!gate.allowed && !committedRecovery) return {status: "blocked", saved: false, committed: false, readiness: gate.readiness, nextAction: gate.next, issues: [{code: "readiness", message: "Project prerequisites are incomplete for portable mapping."}], warnings: []};
    const historicallyCommitted = Boolean(state.historicallyCommitted && state.accepted?.modelHash === modelDigest);
    if (state.accepted && state.accepted.modelHash !== modelDigest) return {status: "conflict", saved: false, committed: state.committed, operationId: input.operationId, generationId: state.accepted.generationId, issues: [{code: "publication-conflict", message: state.committed ? "This operation already committed a different model." : "This operation already accepted a different model. Prepare again before changing it."}], warnings: []};
    const committedRetry = Boolean(state.committed && state.accepted && state.accepted.modelHash === modelDigest && state.current);
    if (state.committed && state.accepted && state.accepted.modelHash === modelDigest && !state.current) {
      return {
        formatVersion: PORTABLE_MAP_FORMAT_VERSION, status: "reused", saved: true, committed: true, historicallyCommitted: true, generationValid: true, current: false, retained: true,
        operationId: input.operationId, generationId: state.accepted.generationId, paths: [], instructionSnippet: CODEBASE_INDEX_INSTRUCTION_SNIPPET, warnings: []
      };
    }
    if (state.receipt && !state.committed && state.accepted?.modelHash === modelDigest) {
      return {
        status: "conflict", saved: false, committed: false, historicallyCommitted, generationValid: false, current: state.current,
        operationId: input.operationId, generationId: state.accepted.generationId,
        issues: [{code: "invalid-generation", message: PUBLIC_FAILURE}], warnings: []
      };
    }
    const loaded = await loadPortableOperation({repositoryRoot: root, operationId: input.operationId});
    if (!loaded.ok) return {status: loaded.status, saved: false, committed: false, operationId: input.operationId, issues: diagnosticsFor(loaded.diagnostics), warnings: []};
    const fresh = committedRetry
      ? {ok: true as const, status: "fresh" as const, metadata: loaded.metadata, extraction: loaded.extraction}
      : await revalidatePortableOperation({repositoryRoot: root, operationId: input.operationId});
    if (!fresh.ok) return {status: fresh.status, saved: false, committed: false, operationId: input.operationId, generationId: fresh.generationId ?? loaded.metadata.generationId, issues: diagnosticsFor(fresh.diagnostics), warnings: []};
    const validation = validatePortableMapModel(fresh.extraction.structuralShards, model, fresh.extraction.sourceBasis);
    if (!validation.ok) return {status: "invalid", saved: false, committed: false, operationId: input.operationId, generationId: loaded.metadata.generationId, issues: diagnosticsFor(validation.diagnostics), warnings: []};
    const predecessor = fresh.metadata.predecessorProof;
    if (fresh.metadata.previousGenerationId && !predecessor) return {status: "conflict", saved: false, committed: false, operationId: input.operationId, generationId: loaded.metadata.generationId, issues: [{code: "invalid-generation", message: PUBLIC_FAILURE}], warnings: []};
    const rendered = renderPortableMap(validation.data, {
      generationId: fresh.metadata.generationId,
      generatedAt: fresh.metadata.renderGeneratedAt,
      gitCommit: null,
      inventoryFingerprint: fresh.extraction.inventoryFingerprint,
      parserAssets: [
        {name: fresh.extraction.provenance.runtime.package, version: fresh.extraction.provenance.runtime.version, checksum: fresh.extraction.provenance.runtime.packageSha256},
        ...fresh.extraction.provenance.grammars.map(grammar => ({name: grammar.asset, version: grammar.version, checksum: grammar.sha256}))
      ],
      predecessorGenerationId: fresh.metadata.previousGenerationId,
      ...(predecessor ? {predecessorPublicationProof: predecessor} : {})
    });
    if (!rendered.ok) return {status: "invalid", saved: false, committed: false, operationId: input.operationId, generationId: fresh.metadata.generationId, issues: diagnosticsFor(rendered.diagnostics), warnings: []};
    if (!(await recordPortableOperationAcceptance({repositoryRoot: root, operationId: input.operationId, generationId: fresh.metadata.generationId, modelHash: modelDigest, rootIndexHash: rendered.rootIndexHash}))) {
      const accepted = await portableOperationCommitState({repositoryRoot: root, operationId: input.operationId});
      if (accepted.accepted?.modelHash !== modelDigest) return {status: "conflict", saved: false, committed: false, operationId: input.operationId, generationId: fresh.metadata.generationId, issues: [{code: "publication-conflict", message: "A concurrent submission won this operation."}], warnings: []};
      return fixedFailure("invalid-state");
    }
    const published = await publishPortableMap({
      repositoryRoot: root,
      operationId: input.operationId,
      transactionId: fresh.metadata.transactionId,
      generationId: fresh.metadata.generationId,
      sourceBasis: fresh.metadata.sourceBasis,
      rendered,
      preflight: portableOperationPublicationPreflight(fresh.metadata),
      onCommitted: async () => recordPortableOperationCommitUnderPublicationLock({
        repositoryRoot: root,
        operationId: input.operationId,
        generationId: fresh.metadata.generationId,
        modelHash: modelDigest,
        rootIndexHash: rendered.rootIndexHash,
        manifestHash: digest(rendered.files[rendered.sealedGeneration.manifest.path]!),
        entryHash: digest(rendered.files[rendered.sealedGeneration.entry.path]!)
      }),
      verifyFreshness: freshnessFor(root, fresh.extraction)
    });
    const output = publicationResult(published, input.operationId, fresh.metadata.generationId, fresh.extraction);
    if (published.committed) {
      const link = await applyOptionalInstructionLink(root, input);
      if (link) output.instructionLink = link;
    }
    return output;
  } catch {
    return fixedFailure("invalid-state");
  }
}
