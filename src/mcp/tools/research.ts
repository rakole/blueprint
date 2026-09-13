import { promises as fs } from "node:fs";
import * as z from "zod/v4";
import { prepareTextForPersistence } from "../../shared/security.js";
import { readArtifactContract } from "../artifact-contracts/index.js";
import type { ToolDefinition } from "../tool-types.js";
import { CODEBASE_ARTIFACTS, extractMarkdownTableRows, resolveBlueprintPath, validatePhaseArtifactContent, writeTextFile, isScaffoldGeneratedArtifact, isBootstrapStarterContext, researchHasPlanningBlockers } from "./artifacts.js";
import { artifactPathFor } from "./phase-locations.js";
import { blueprintPhaseArtifactWrite } from "./phase-artifacts.js";
import { blueprintPhaseContext } from "./phase-context-tools.js";
import { blueprintPhaseCheckpointDelete, blueprintPhaseCheckpointGet } from "./phase-checkpoints.js";
import { blueprintConfigGet } from "./config.js";
import { blueprintCommandCatalog } from "./project.js";
import { blueprintStateUpdate, blueprintStateLoad } from "./state.js";
import { phaseTopologyFingerprintFromLocation, phaseTopologyFingerprintsMatch } from "./phase-topology-lock.js";
import { withFreshPhaseTopologyForMutation } from "./phase-resolution.js";
import { extractMarkdownSection } from "./phase-markdown.js";
import { validatePhaseResearchModelInput, renderPhaseResearchModelContent } from "./phase-research-model.js";
import { canonicalResearchEvidencePath, readResearchEvidence, researchInputHash, researchBasisFreshness, readPublishedResearchFreshness, researchProvenancePath, researchDigest, stableResearchValue, type ResearchReadSet } from "./research-evidence.js";
import { researchNumericPhase, researchLookup, researchRequestId, researchLocation, checkedResearchPayload, readResearchSession, saveResearchSession, withResearchSession, initialResearchSession, type ResearchSession } from "./research-session.js";

const prepareInput = z.object({
  cwd: z.string().optional(), phase: researchNumericPhase.optional(),
  evidencePaths: z.array(z.string().min(1)).max(60).optional(),
  expectedRevision: z.number().int().min(0).optional(),
  acknowledgeChangedInputs: z.boolean().optional(),
  reconcile: z.object({ confirmed: z.literal(true), researchHash: z.string().nullable() }).optional(),
});
const submitInput = z.object({
  ...researchLookup, requestId: researchRequestId, expectedRevision: z.number().int().min(0),
  model: z.unknown().optional().describe("Research model following prepare.schema and prepare.example. Validated and normalized in memory; rejected documents are never stored."),
  candidate: z.unknown().optional().describe("Deprecated alias for model; no draft is retained."),
  overwrite: z.boolean().optional(), reuse: z.boolean().optional(), externalSourcesApproved: z.boolean().optional(),
});
const validationRules = {
  reject: ["Malformed or empty essential research content", "Broken evidence references or unsupported ready recommendations", "Unsupported HIGH confidence and unknown requirement references", "Unauthorized external sources, uncaptured repository evidence, stale inputs or changed publication targets", "Unsafe paths/content and unapproved substantive overwrite"],
  planningOnly: ["Explicit blocking questions or blocked recommendations are saved as useful research; planning remains blocked until resolved."],
  advisory: ["Missing optional topics, complete requirement coverage, access dates or verification detail do not reject a useful document."],
  normalize: ["MCP supplies canonical headings, timestamps and saved context grounding.", "Use the schema's optional defaults; include only relevant prose. No exact empty sentinel, 17-section checklist or template padding is required."],
};

async function safeNextAction(proposed: string | null | undefined) {
  const catalog = await blueprintCommandCatalog();
  const command = proposed?.match(/\/blu-([a-z][a-z-]*)\b/)?.[1];
  if (command && catalog.commands[command]?.implemented) return proposed!;
  return catalog.commands.progress?.implemented ? "Run /blu-progress to review the next safe action." : null;
}
function lines(section: string) {
  return section.split("\n").map(line => line.trim().replace(/^[-*+]\s+/, "")).filter(line => line && !/^\|?[-| :]+\|?$/.test(line));
}
function contextGrounding(content: string, projectConstraints: string[]) {
  const decisions = extractMarkdownSection(content, "Implementation Decisions");
  const decisionRows = extractMarkdownTableRows(decisions).filter(row => row[0]?.toLowerCase() !== "decision");
  const discovery = extractMarkdownSection(content, "Discovery Grounding");
  const confirmed = discovery.match(/^- \*\*Confirmed decisions\*\*\s*\n([\s\S]*)/m)?.[1] ?? "";
  const dependencies = extractMarkdownSection(content, "Dependencies");
  const externalConstraints = dependencies.match(/^- External constraints:[ \t]*\n([\s\S]*?)(?=^- (?:Required follow-up reads|Prior phase artifacts):|(?![\s\S]))/m)?.[1] ?? "";
  return {
    lockedDecisions: [...(decisionRows.length ? decisionRows.map(row => row.join(" — ")) : lines(decisions)), ...lines(confirmed)],
    userConstraints: [...projectConstraints, ...lines(extractMarkdownSection(content, "Phase Boundary")), ...lines(externalConstraints)],
  };
}
function requirementDescriptions(content: string, ids: string[]) {
  const rows = extractMarkdownTableRows(content);
  return ids.map(id => {
    const row = rows.find(cells => cells[0]?.replace(/[`*]/g, "").trim() === id);
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const bullet = content.match(new RegExp(`^.*?(?:\\*\\*|\\x60)?${escaped}(?:\\*\\*|\\x60)?\\s*[:—-]\\s*(.+)$`, "m"));
    return { id, description: row?.[1] || bullet?.[1] || "See the saved phase requirements and context for this requirement's definition." };
  });
}
function requestKey(args: z.infer<typeof submitInput>) {
  return researchDigest(stableResearchValue({
    phase: String(args.phase), requestId: args.requestId, expectedRevision: args.expectedRevision,
    overwrite: args.overwrite ?? false, reuse: args.reuse ?? false, externalSourcesApproved: args.externalSourcesApproved ?? false,
  }));
}
function assessment(session: ResearchSession, model: unknown) {
  const ids = session.grounding.requirements.map(item => item.id);
  return validatePhaseResearchModelInput(model, { knownRequirementIds: ids, requiredRequirementIds: ids });
}

export async function blueprintResearchPrepare(raw: z.input<typeof prepareInput> = {}) {
  const args = prepareInput.parse(raw);
  try {
    return await withResearchSession(args, async loc => {
      const session = await readResearchSession(loc) ?? initialResearchSession(loc);
      const before = stableResearchValue(session);
      const researchPath = artifactPathFor(loc.resolved, "research");
      const contextPath = artifactPathFor(loc.resolved, "context");
      const specPath = artifactPathFor(loc.resolved, "spec");
      const evidencePaths = [...new Set((args.evidencePaths ?? session.evidencePaths).map(p => canonicalResearchEvidencePath(loc.projectRoot, p)))];
      // Never bind mutable outputs or session files into their own read set.
      const excluded = new Set([researchPath, researchProvenancePath(researchPath), loc.sessionPath, ".blueprint/STATE.md"]);
      if (evidencePaths.some(p => excluded.has(p) || /-CHECKPOINT\.json$/.test(p) || p.startsWith("@"))) throw new Error("Select repository evidence, not this phase's research outputs, state, checkpoints, or virtual paths.");
      const paths = [...new Set([".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", ".blueprint/ROADMAP.md", contextPath, specPath, ...CODEBASE_ARTIFACTS, ...evidencePaths])];
      const [inputs, config, existing, provenance] = await Promise.all([
        Promise.all(paths.map(p => readResearchEvidence(loc.projectRoot, p))),
        blueprintConfigGet({ cwd: loc.projectRoot, scope: "effective" }),
        readResearchEvidence(loc.projectRoot, researchPath, 4 * 1024 * 1024),
        readResearchEvidence(loc.projectRoot, researchProvenancePath(researchPath)),
      ]);
      const readSet: ResearchReadSet = inputs.map(({ path, hash }) => ({ path, hash }));
      readSet.push({ path: "@research/effective-config", hash: researchDigest(stableResearchValue({ config: config.config, provenance: config.provenance })) });
      const context = inputs.find(item => item.path === contextPath)!;
      const spec = inputs.find(item => item.path === specPath)!;
      const phaseContext = await blueprintPhaseContext({ cwd: loc.projectRoot, phase: session.phase });
      const fresh = await researchBasisFreshness(loc.projectRoot, readSet);
      const current = await researchLocation({ cwd: loc.projectRoot, phase: session.phase });
      if (fresh.status !== "fresh" || !phaseTopologyFingerprintsMatch(phaseTopologyFingerprintFromLocation(loc.resolved, loc.matchedPhase), phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase)))
        return { status: "stale", freshness: fresh, nextAction: "Retry blueprint_research_prepare; inputs changed during collection." };
      const contextValidation = context.content === null ? null : validatePhaseArtifactContent(context.content, "context");
      const specValidation = spec.content === null ? null : validatePhaseArtifactContent(spec.content, "spec");
      const existingValidation = existing.content === null ? null : validatePhaseArtifactContent(existing.content, "research");
      const existingFreshness = existing.content === null ? null : await readPublishedResearchFreshness(loc.projectRoot, researchPath);
      const packet = {
        phase: phaseContext.phase, context, spec, requirements: phaseContext.requirements,
        projectBrief: phaseContext.projectBrief, config: config.config,
        codebase: phaseContext.codebase,
        evidence: inputs.filter(item => item.path !== contextPath && item.path !== specPath),
        readSet, existing: { path: researchPath, hash: existing.hash, valid: existingValidation?.valid ?? false, freshness: existingFreshness, ...(existingFreshness?.status === "fresh" ? {} : { content: existing.content }) },
        schema: readArtifactContract("phase.research").modelContract?.jsonSchema,
        example: readArtifactContract("phase.research").modelContract?.minimalValidExample,
        grounding: {
          requirements: requirementDescriptions(inputs.find(item => item.path === ".blueprint/REQUIREMENTS.md")?.content ?? "", [...new Set(phaseContext.requirements)]),
          ...contextGrounding(context.content ?? "", phaseContext.projectBrief.constraints),
        },
        validationRules,
        checkpoint: await blueprintPhaseCheckpointGet({ cwd: loc.projectRoot, phase: session.phase, expectedOwnerCommand: "/blu-research-phase", expectedMode: "research" }),
      };
      if (args.expectedRevision !== undefined && session.revision !== args.expectedRevision) return { ...packet, status: "stale", revision: session.revision, reason: "Revision conflict" };
      const changed = session.prepared ? await researchBasisFreshness(loc.projectRoot, session.readSet) : null;
      const topologyChanged = !phaseTopologyFingerprintsMatch(session.topology, phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase));
      const targetChanged = session.prepared && (existing.hash !== session.baselineHash || provenance.hash !== session.baselineProvenanceHash);
      const pending = session.journal && !session.journal.receipt;
      if ((targetChanged || topologyChanged || pending && args.reconcile) && (!args.reconcile || args.reconcile.researchHash !== existing.hash || args.expectedRevision !== session.revision)) return { ...packet, status: "reconciliation_required", revision: session.revision, reason: "Review changed publication targets, then prepare with expectedRevision and reconcile containing the observed research hash." };
      if (pending && !args.reconcile) return { ...packet, status: "partial", revision: session.revision, nextAction: `Retry blueprint_research_submit with requestId ${session.journal!.requestId} and identical arguments.` };
      if (changed && changed.status !== "fresh" && (!args.acknowledgeChangedInputs || args.expectedRevision !== session.revision)) return { ...packet, status: "stale", revision: session.revision, freshness: changed, nextAction: "Review changed inputs, then prepare with expectedRevision and acknowledgeChangedInputs=true; recheck affected findings before submitting the model." };
      if (args.reconcile && session.journal) {
        delete session.requests[session.journal.requestId];
        delete session.journal;
      }
      session.topology = phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase);
      session.readSet = readSet; session.evidencePaths = evidencePaths;
      session.baselineHash = existing.hash; session.baselineProvenanceHash = provenance.hash;
      const contextUsable = contextValidation?.valid === true && !isBootstrapStarterContext(context.content ?? "");
      session.prepared = contextUsable && (!specValidation || specValidation.valid);
      session.grounding = packet.grounding;
      if (before !== stableResearchValue(session) || session.revision === 0) {
        session.revision++;
        await saveResearchSession(loc, session);
      }
      return { ...packet, status: session.prepared ? "prepared" : "blocked", revision: session.revision, sessionPath: loc.sessionPath, diagnostics: [...(contextValidation?.diagnostics ?? []), ...(specValidation?.diagnostics ?? [])], nextAction: session.prepared ? "Investigate unresolved planning decisions; use the schema, example, grounding and validationRules to submit the model once using this revision. Prepare with evidencePaths before relying on additional repository sources." : await safeNextAction(`Run /blu-${contextUsable ? "spec" : "discuss"}-phase ${session.phase} to repair saved phase evidence.`) };
    });
  } catch (error) {
    return { status: "blocked", reason: (error as Error).message, nextAction: await safeNextAction("Run /blu-progress to resolve the research preparation blocker.") };
  }
}

export async function blueprintResearchRead(args: { cwd?: string; phase: string | number }) {
  z.object(researchLookup).parse(args);
  return withResearchSession(args, async loc => {
    const session = await readResearchSession(loc);
    const publishedPath = artifactPathFor(loc.resolved, "research");
    const published = await readResearchEvidence(loc.projectRoot, publishedPath, 4 * 1024 * 1024).catch(async error => ({
      path: publishedPath, hash: await researchInputHash(loc.projectRoot, publishedPath).catch(() => null),
      content: null, error: (error as Error).message,
    }));
    return { status: session || published.content ? "found" : "not_found", sessionPath: loc.sessionPath, session, published, freshness: session ? await researchBasisFreshness(loc.projectRoot, session.readSet) : null };
  });
}

// Owning operations are injectable for publication interruption tests.
export const researchSubmitDependencies = { artifactWrite: blueprintPhaseArtifactWrite, stateUpdate: blueprintStateUpdate, stateLoad: blueprintStateLoad, checkpointDelete: blueprintPhaseCheckpointDelete, writeText: writeTextFile };

export async function blueprintResearchSubmit(raw: z.input<typeof submitInput>) {
  const args = submitInput.parse(raw);
  if (args.model !== undefined && args.candidate !== undefined) throw new Error("Pass model only, not both model and its deprecated alias.");
  const suppliedModel = args.model ?? args.candidate;
  if (args.reuse && suppliedModel !== undefined) throw new Error("A reuse request cannot replace the model.");
  checkedResearchPayload(args);
  return withResearchSession(args, async loc => {
    const session = await readResearchSession(loc);
    if (!session) return { status: "not_found", saved: false, nextAction: "Call blueprint_research_prepare before submitting research." };
    const reject = (status: string, details: Record<string, unknown>) => ({
      status, saved: false, ready: false, outcome: "rejected-not-saved", revision: session.revision, ...details,
    });
    const requestHash = requestKey(args);
    const accepted = Object.hasOwn(session.requests, args.requestId) ? session.requests[args.requestId] : undefined;
    if (accepted && accepted.hash !== requestHash) return reject("rejected", { reason: "Request ID conflict." });
    let journal = session.journal?.requestId === args.requestId ? session.journal : undefined;
    if (session.journal && !session.journal.receipt && !journal) return reject("partial", {
      nextAction: `Finish blueprint_research_submit requestId ${session.journal.requestId} first, or explicitly reconcile its publication metadata.`,
    });
    if (!accepted && session.revision !== args.expectedRevision) return reject("stale", { reason: "Revision conflict." });

    // Models live only in this invocation, including failures and normalization.
    const result = suppliedModel === undefined ? null : assessment(session, suppliedModel);
    if (result && (!result.model || !result.validation.valid)) return reject("needs_revision", {
      validation: result.validation, nextAction: "Correct the indicated fields in this model and submit again with the same revision. No draft was stored.",
    });
    const modelHash = result?.model ? researchDigest(stableResearchValue(result.model)) : undefined;
    if (accepted && modelHash && accepted.modelHash !== modelHash) return reject("rejected", { reason: "Request ID model conflict." });
    const researchPath = artifactPathFor(loc.resolved, "research");
    const provenancePath = researchProvenancePath(researchPath);
    if (accepted?.receipt) {
      const receipt = accepted.receipt;
      if (await researchInputHash(loc.projectRoot, researchPath) !== receipt.contentHash || await researchInputHash(loc.projectRoot, provenancePath) !== receipt.provenanceHash)
        return reject("stale", { reason: "The previously published research has changed; prepare before another publication." });
      const freshness = await readPublishedResearchFreshness(loc.projectRoot, researchPath);
      if (freshness.status !== "fresh") return reject("stale", { freshness, nextAction: "Prepare and review changed evidence before reusing research." });
      return receipt;
    }
    let content: string | undefined;
    if (!journal) {
      if (!args.reuse && !result?.model) return reject("needs_revision", { reason: "Supply the research model using prepare.schema and prepare.example." });
      const freshness = await researchBasisFreshness(loc.projectRoot, session.readSet);
      if (!session.prepared || freshness.status !== "fresh") return reject("needs_revision", { freshness, nextAction: "Refresh blueprint_research_prepare and review changed inputs before submitting the model." });
      const researchedAt = new Date().toISOString().slice(0, 10);
      let planningReady = result?.validation.planningReady ?? true;
      let originalProvenance: string | null = null;
      if (args.reuse) {
        const existing = await readResearchEvidence(loc.projectRoot, researchPath, 4 * 1024 * 1024);
        const reuseFreshness = await readPublishedResearchFreshness(loc.projectRoot, researchPath);
        if (existing.content === null || reuseFreshness.status !== "fresh" || !validatePhaseArtifactContent(existing.content, "research").valid)
          return reject("needs_revision", { freshness: reuseFreshness, nextAction: "Review and submit updated research; reuse requires verified-fresh published evidence." });
        content = existing.content;
        originalProvenance = (await readResearchEvidence(loc.projectRoot, provenancePath)).content;
        planningReady = reuseFreshness.planningReady !== false;
      } else {
        const model = result!.model!;
        const config = await blueprintConfigGet({ cwd: loc.projectRoot, scope: "effective" });
        const external = model.sources.some(source => source.lane === "external");
        if (external && (config.config.research.external_sources === "off" || config.config.research.external_sources === "ask" && !args.externalSourcesApproved))
          return reject("needs_revision", { reason: "External source policy does not authorize live external evidence.", nextAction: "Honor off/ask/auto policy; obtain the ask approval or use evidence that was actually supplied or read from the repository." });
        const missing = model.sources.filter(source => source.lane === "repo").map(source => {
          const relative = source.reference.replace(/(?::\d+(?:-\d+)?)?(?:#.*)?$/, "");
          try { return canonicalResearchEvidencePath(loc.projectRoot, relative); } catch { return relative; }
        }).filter(p => !session.readSet.some(item => item.path === p && item.hash !== null));
        if (missing.length) return reject("needs_revision", { missingEvidencePaths: [...new Set(missing)], nextAction: "Prepare with these evidencePaths, review the returned source evidence, and submit the model." });
        content = renderPhaseResearchModelContent({ resolved: loc.resolved, model, ...session.grounding, researchedAt });
      }
      content = prepareTextForPersistence(content).content.replace(/\r\n/g, "\n");
      if (Buffer.byteLength(content) > 4 * 1024 * 1024) return reject("needs_revision", { reason: "Rendered research exceeds 4 MiB; reduce repeated prose." });
      const validation = validatePhaseArtifactContent(content, "research");
      if (!validation.valid) return reject("needs_revision", { validation });
      planningReady = planningReady && !researchHasPlanningBlockers(content);
      const observed = await researchInputHash(loc.projectRoot, researchPath);
      const observedProvenance = await researchInputHash(loc.projectRoot, provenancePath);
      if (observed !== session.baselineHash || observedProvenance !== session.baselineProvenanceHash)
        return reject("stale", { reason: "Publication targets changed after preparation.", nextAction: "Prepare with explicit reconciliation against the observed research hash." });
      if (observed && observed !== researchDigest(content) && !args.overwrite) {
        const existing = await fs.readFile(resolveBlueprintPath(loc.projectRoot, researchPath), "utf8");
        if (!isScaffoldGeneratedArtifact(existing)) return reject("needs_revision", { reason: "Explicit update/overwrite authorization is required.", nextAction: "After the user chooses update, submit the model with overwrite=true." });
      }
      const provenance = originalProvenance ?? JSON.stringify({ version: 1, researchHash: researchDigest(content), readSet: session.readSet, publishedAt: new Date().toISOString(), planningReady }, null, 2) + "\n";
      session.revision++;
      journal = {
        requestId: args.requestId, requestHash, modelHash, researchedAt, revision: session.revision,
        contentHash: researchDigest(content), baselineHash: observed, provenance, provenanceHash: researchDigest(provenance), baselineProvenanceHash: observedProvenance,
        readSet: args.reuse ? JSON.parse(provenance).readSet : session.readSet, reuse: args.reuse ?? false, planningReady, stages: {},
      };
      session.journal = journal;
      session.requests[args.requestId] = { hash: requestHash, modelHash, revision: session.revision };
      // Only validated publication intent is durable. No model, rendered body,
      // rejected draft, diagnostic prose or document history is written here.
      await saveResearchSession(loc, session);
    }
    const checkpoint = () => saveResearchSession(loc, session);
    const assertFresh = async () => {
      const current = await researchLocation({ cwd: loc.projectRoot, phase: session.phase });
      if (!phaseTopologyFingerprintsMatch(session.topology, phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase))) throw new Error("Phase topology changed; explicitly reconcile publication.");
      const fresh = await researchBasisFreshness(loc.projectRoot, journal!.readSet);
      if (fresh.status !== "fresh") throw new Error(`Research evidence changed: ${[...fresh.stalePaths, ...fresh.unknownPaths].join(", ")}. Prepare and reconcile before publishing.`);
    };
    try {
      await assertFresh();
      for (const stage of ["artifact", "provenance"] as const) {
        const target = stage === "artifact" ? researchPath : provenancePath;
        const desired = stage === "artifact" ? journal.contentHash : journal.provenanceHash;
        const baseline = stage === "artifact" ? journal.baselineHash : journal.baselineProvenanceHash;
        const observed = await researchInputHash(loc.projectRoot, target);
        if (journal.stages[stage] && observed === desired) { journal.stages[stage] = "complete"; await checkpoint(); continue; }
        if (journal.stages[stage] === "complete" || observed !== baseline) throw new Error(`Publication target changed externally: ${target}. Reconcile without overwriting it.`);
        if (stage === "artifact" && content === undefined) {
          if (journal.reuse) content = (await readResearchEvidence(loc.projectRoot, researchPath, 4 * 1024 * 1024)).content ?? undefined;
          else if (result?.model) content = prepareTextForPersistence(renderPhaseResearchModelContent({ resolved: loc.resolved, model: result.model, ...session.grounding, researchedAt: journal.researchedAt })).content.replace(/\r\n/g, "\n");
          if (content === undefined) throw new Error("Resend the model to retry publication; no research document was saved before this interruption.");
          if (researchDigest(content) !== journal.contentHash) throw new Error("The supplied model does not match the accepted publication intent.");
        }
        journal.stages[stage] = "intent"; await checkpoint(); await assertFresh();
        if (stage === "artifact") {
          const written = await researchSubmitDependencies.artifactWrite({ cwd: loc.projectRoot, phase: session.phase, artifact: "research", content: content!, overwrite: args.overwrite, expectedContentHash: baseline, expectedTopology: session.topology });
          if (written.status === "invalid") throw new Error("Research artifact publication failed validation.");
        } else {
          await withFreshPhaseTopologyForMutation(loc.projectRoot, { phase: session.phase }, session.topology, "Research provenance publication", async () => {
            if (await researchInputHash(loc.projectRoot, target) !== baseline) throw new Error("Research provenance changed during publication.");
            await researchSubmitDependencies.writeText(resolveBlueprintPath(loc.projectRoot, target), journal!.provenance);
          });
        }
        if (await researchInputHash(loc.projectRoot, target) !== desired) throw new Error(`Published bytes differ from intent: ${target}.`);
        journal.stages[stage] = "complete"; await checkpoint();
      }
      await assertFresh();
      if (journal.stages.state !== "complete") {
        journal.stages.state = "intent"; await checkpoint();
        await researchSubmitDependencies.stateUpdate({ cwd: loc.projectRoot, base: "synced", patch: { currentPhase: session.phase, activeCommand: "/blu-research-phase" } });
        journal.stages.state = "complete"; await checkpoint();
      }
      const state = await researchSubmitDependencies.stateLoad({ cwd: loc.projectRoot });
      const nextAction = await safeNextAction(journal.planningReady ? state.derivedStatus.nextAction : `Run /blu-research-phase ${session.phase} to resolve the planning blockers documented in the saved research.`);
      if (!nextAction) throw new Error("No implemented follow-up is currently available.");
      journal.stages.routing = "complete"; await checkpoint();
      const warnings = [...(state.warnings ?? []), ...(result?.validation.warnings ?? [])];
      if (journal.stages.cleanup !== "complete") {
        journal.stages.cleanup = "intent"; await checkpoint();
        const cleanup = await researchSubmitDependencies.checkpointDelete({ cwd: loc.projectRoot, phase: session.phase, expectedTopology: session.topology, expectedOwnerCommand: "/blu-research-phase", expectedMode: "research" });
        if (!cleanup.deleted && cleanup.reason) warnings.push(cleanup.reason);
        journal.stages.cleanup = "complete"; await checkpoint();
      }
      await assertFresh();
      if (await researchInputHash(loc.projectRoot, researchPath) !== journal.contentHash) throw new Error("Research changed before final receipt.");
      if (await researchInputHash(loc.projectRoot, provenancePath) !== journal.provenanceHash) throw new Error("Research provenance changed before final receipt.");
      journal.receipt = { status: journal.reuse ? "reused" : "published", saved: true, ready: journal.planningReady, planningReady: journal.planningReady, revision: session.revision, path: researchPath, sessionPath: loc.sessionPath, provenancePath, contentHash: journal.contentHash, provenanceHash: journal.provenanceHash, nextAction };
      session.requests[args.requestId].receipt = journal.receipt;
      session.baselineHash = journal.contentHash; session.baselineProvenanceHash = journal.provenanceHash;
      delete session.legacyPublication;
      await checkpoint();
      return { ...journal.receipt, warnings, stages: { ...journal.stages } };
    } catch (error) {
      const saved = await researchInputHash(loc.projectRoot, researchPath).catch(() => null) === journal.contentHash;
      return { status: "partial", saved, ready: false, revision: session.revision, path: saved ? researchPath : null, stages: journal.stages, reason: (error as Error).message, nextAction: `Retry blueprint_research_submit with requestId ${args.requestId} and the same expectedRevision/control flags${saved ? "; the canonical document is saved and model may be omitted" : "; resend the model because no document draft is retained"}. Reconcile changed inputs or targets explicitly.` };
    }
  });
}

export const researchToolDefinitions: ToolDefinition[] = [
  { name: "blueprint_research_prepare", description: "Prepare phase evidence, source policy, model schema/example, grounding and rejection rules for first-attempt research publication. Saves only preparation metadata.", inputSchema: prepareInput.shape, handler: args => blueprintResearchPrepare(args as z.input<typeof prepareInput>) },
  { name: "blueprint_research_read", description: "Read canonical research and publication metadata. Rejected research documents are never stored or recoverable through this tool.", inputSchema: researchLookup, handler: args => blueprintResearchRead(args as { cwd?: string; phase: string | number }) },
  { name: "blueprint_research_submit", description: "Normalize and assess a research model in memory, then publish canonical research. Harmless formatting is normalized; useful planning blockers are documented separately. Rejected drafts are not stored. Prepare supplies the schema and example.", inputSchema: submitInput.shape, handler: args => blueprintResearchSubmit(args as z.input<typeof submitInput>) },
];
