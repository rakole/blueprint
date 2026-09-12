import { promises as fs } from "node:fs";
import * as z from "zod/v4";
import { prepareTextForPersistence, validateFieldNameSegment } from "../../shared/security.js";
import { readArtifactContract } from "../artifact-contracts/index.js";
import type { ToolDefinition } from "../tool-types.js";
import { CODEBASE_ARTIFACTS, extractMarkdownTableRows, resolveBlueprintPath, validatePhaseArtifactContent, writeTextFile, isScaffoldGeneratedArtifact, isBootstrapStarterContext } from "./artifacts.js";
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
import { researchNumericPhase, researchLookup, researchRequestId, researchLocation, checkedResearchPayload, readResearchSession, saveResearchSession, withResearchSession, initialResearchSession, type ResearchSession, type ResearchLocation } from "./research-session.js";

const prepareInput = z.object({
  cwd: z.string().optional(), phase: researchNumericPhase.optional(),
  evidencePaths: z.array(z.string().min(1)).max(60).optional(),
  expectedRevision: z.number().int().min(0).optional(),
  acknowledgeChangedInputs: z.boolean().optional(),
  reconcile: z.object({ confirmed: z.literal(true), researchHash: z.string().nullable() }).optional(),
});
const correctionSchema = z.object({ path: z.array(z.string()).min(1).max(20), value: z.unknown().optional(), operation: z.enum(["set", "remove"]).default("set") });
const recordInput = z.object({ ...researchLookup, requestId: researchRequestId, expectedRevision: z.number().int().min(0), candidate: z.unknown().optional(), corrections: z.array(correctionSchema).max(50).optional(), notes: z.string().max(20000).optional() });
const submitInput = z.object({ ...researchLookup, requestId: researchRequestId, expectedRevision: z.number().int().min(0), candidate: z.unknown().optional().describe("Complete JSON research candidate or raw string. Durably saved before schema and publication checks; get the compact model schema from prepare."), overwrite: z.boolean().optional(), reuse: z.boolean().optional(), externalSourcesApproved: z.boolean().optional() });

async function safeNextAction(proposed: string | null | undefined) {
  const catalog = await blueprintCommandCatalog();
  const command = proposed?.match(/\/blu-([a-z][a-z-]*)\b/)?.[1];
  if (command && catalog.commands[command]?.implemented) return proposed!;
  return catalog.commands.progress?.implemented ? "Run /blu-progress to review the next safe action." : null;
}
function lines(section: string) {
  return section.split("\n").map(line => line.trim()).filter(line => line && !/^\|?[-| :]+\|?$/.test(line));
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
function requestKey(args: Record<string, unknown>) {
  // Relative cwd spelling is transport context, not logical request identity.
  const { cwd: _cwd, ...input } = args;
  return researchDigest(stableResearchValue(input));
}
function requestReplay(session: ResearchSession, requestId: string, hash: string) {
  const previous = Object.hasOwn(session.requests, requestId) ? session.requests[requestId] : undefined;
  if (!previous) return null;
  if (previous.hash !== hash) return { status: "rejected", reason: "Request ID conflict", revision: session.revision };
  return previous.receipt ?? null;
}
async function saveReceipt(loc: ResearchLocation, session: ResearchSession, requestId: string, receipt: Record<string, unknown>) {
  session.requests[requestId].receipt = receipt;
  await saveResearchSession(loc, session);
  return receipt;
}
function assessment(session: ResearchSession) {
  const ids = session.grounding.requirements.map(item => item.id);
  return validatePhaseResearchModelInput(session.candidate, { knownRequirementIds: ids, requiredRequirementIds: ids });
}

export async function blueprintResearchPrepare(raw: z.input<typeof prepareInput> = {}) {
  const args = prepareInput.parse(raw);
  try {
    return await withResearchSession(args, async loc => {
      const session = await readResearchSession(loc) ?? initialResearchSession(loc);
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
        checkpoint: await blueprintPhaseCheckpointGet({ cwd: loc.projectRoot, phase: session.phase, expectedOwnerCommand: "/blu-research-phase", expectedMode: "research" }),
      };
      if (args.expectedRevision !== undefined && session.revision !== args.expectedRevision) return { ...packet, status: "stale", revision: session.revision, reason: "Revision conflict" };
      const changed = session.prepared ? await researchBasisFreshness(loc.projectRoot, session.readSet) : null;
      const topologyChanged = !phaseTopologyFingerprintsMatch(session.topology, phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase));
      const targetChanged = session.prepared && (existing.hash !== session.baselineHash || provenance.hash !== session.baselineProvenanceHash);
      const pending = session.journal && !session.journal.receipt;
      const pendingRequest = Object.entries(session.requests).find(([, request]) => !request.receipt);
      if (pendingRequest && !pending && !args.reconcile) return { ...packet, status: "partial", revision: session.revision, nextAction: `Retry blueprint_research_${pendingRequest[1].operation} with requestId ${pendingRequest[0]} and identical arguments.` };
      if ((targetChanged || topologyChanged || pending && args.reconcile) && (!args.reconcile || args.reconcile.researchHash !== existing.hash || args.expectedRevision !== session.revision)) return { ...packet, status: "reconciliation_required", revision: session.revision, reason: "Review changed publication targets, then prepare with expectedRevision and reconcile containing the observed research hash." };
      if (pending && !args.reconcile) return { ...packet, status: "partial", revision: session.revision, nextAction: `Retry blueprint_research_submit with requestId ${session.journal!.requestId} and identical arguments.` };
      if (changed && changed.status !== "fresh" && (!args.acknowledgeChangedInputs || args.expectedRevision !== session.revision)) return { ...packet, status: "stale", revision: session.revision, freshness: changed, nextAction: "Review changed inputs, then prepare with expectedRevision and acknowledgeChangedInputs=true; preserve and correct the saved candidate." };
      if (args.reconcile && session.journal) {
        session.history.push({ revision: session.revision, kind: "publication-reconciled", journal: session.journal });
        session.requests[session.journal.requestId].receipt = { status: "superseded", saved: true, revision: session.revision, nextAction: "Use the current prepared revision; this publication attempt was reconciled." };
        delete session.journal;
      }
      if (args.reconcile && pendingRequest) {
        if (args.expectedRevision !== session.revision || args.reconcile.researchHash !== existing.hash) return { ...packet, status: "reconciliation_required", revision: session.revision };
        pendingRequest[1].receipt = { status: "superseded", saved: true, revision: session.revision, nextAction: "Use the current prepared revision." };
      }
      session.topology = phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase);
      session.readSet = readSet; session.evidencePaths = evidencePaths;
      session.baselineHash = existing.hash; session.baselineProvenanceHash = provenance.hash;
      const contextUsable = contextValidation?.valid === true && !isBootstrapStarterContext(context.content ?? "");
      session.prepared = contextUsable && (!specValidation || specValidation.valid);
      session.grounding = {
        requirements: requirementDescriptions(inputs.find(item => item.path === ".blueprint/REQUIREMENTS.md")?.content ?? "", [...new Set(phaseContext.requirements)]),
        ...contextGrounding(context.content ?? "", phaseContext.projectBrief.constraints),
      };
      session.revision++;
      await saveResearchSession(loc, session);
      return { ...packet, status: session.prepared ? "prepared" : "blocked", revision: session.revision, sessionPath: loc.sessionPath, candidateSaved: session.candidate !== undefined, diagnostics: [...(contextValidation?.diagnostics ?? []), ...(specValidation?.diagnostics ?? [])], nextAction: session.prepared ? "Investigate unresolved planning decisions; submit the candidate once using this revision. Prepare with evidencePaths before relying on additional repository sources." : await safeNextAction(`Run /blu-${contextUsable ? "spec" : "discuss"}-phase ${session.phase} to repair saved phase evidence.`) };
    });
  } catch (error) {
    return { status: "blocked", reason: (error as Error).message, nextAction: await safeNextAction("Run /blu-progress to resolve the research preparation blocker.") };
  }
}

export async function blueprintResearchRecord(raw: z.input<typeof recordInput>) {
  const args = recordInput.parse(raw);
  if (args.candidate !== undefined && args.corrections?.length) throw new Error("Pass candidate or field corrections, not both.");
  checkedResearchPayload(args);
  return withResearchSession(args, async loc => {
    const session = await readResearchSession(loc);
    if (!session) return { status: "not_found", nextAction: "Call blueprint_research_prepare first." };
    const hash = requestKey(args);
    const replay = requestReplay(session, args.requestId, hash); if (replay) return replay;
    const accepted = Object.hasOwn(session.requests, args.requestId) ? session.requests[args.requestId] : undefined;
    const pendingRequest = Object.entries(session.requests).find(([id, request]) => id !== args.requestId && !request.receipt);
    if (pendingRequest) return { status: "partial", nextAction: `Retry blueprint_research_${pendingRequest[1].operation} requestId ${pendingRequest[0]} first.` };
    if (session.journal && !session.journal.receipt) return { status: "partial", nextAction: `Retry blueprint_research_submit requestId ${session.journal.requestId} before changing the candidate.` };
    if (accepted) {
      if (accepted.revision !== session.revision || accepted.operation !== "record") return { status: "stale", revision: session.revision, reason: "Accepted request was superseded." };
      const result = assessment(session);
      return saveReceipt(loc, session, args.requestId, { status: "recorded", saved: true, candidateSaved: session.candidate !== undefined, revision: session.revision, sessionPath: loc.sessionPath, validation: result.validation });
    }
    if (session.revision !== args.expectedRevision) return { status: "stale", revision: session.revision, reason: "Revision conflict" };
    if (args.candidate !== undefined) session.candidate = checkedResearchPayload(args.candidate);
    for (const correction of args.corrections ?? []) {
      correction.path.forEach(segment => {
        validateFieldNameSegment(segment);
        if (["__proto__", "constructor", "prototype"].includes(segment)) throw new Error("Unsafe correction path.");
      });
      let target = session.candidate as Record<string, unknown>;
      for (const segment of correction.path.slice(0, -1)) {
        if (!target || typeof target !== "object" || !Object.hasOwn(target, segment)) throw new Error("Correction parent does not exist.");
        target = target[segment] as Record<string, unknown>;
      }
      if (!target || typeof target !== "object") throw new Error("Correction target is not an object.");
      const field = correction.path.at(-1)!;
      if (Array.isArray(target) && (!/^(0|[1-9]\d*)$/.test(field) || Number(field) > target.length)) throw new Error("Array correction requires an in-range index.");
      if (correction.operation === "remove") { if (Array.isArray(target)) target.splice(Number(field), 1); else delete target[field]; }
      else target[field] = checkedResearchPayload(correction.value);
    }
    if (args.notes !== undefined) session.notes.push(args.notes);
    checkedResearchPayload(session.candidate ?? null);
    session.revision++;
    session.history.push({ revision: session.revision, kind: "record", ...(session.candidate !== undefined ? { candidate: session.candidate } : {}) });
    session.requests[args.requestId] = { hash, revision: session.revision, operation: "record" };
    // Candidate is durable even if model assessment throws or returns issues.
    await saveResearchSession(loc, session);
    const result = assessment(session);
    return saveReceipt(loc, session, args.requestId, { status: "recorded", saved: true, candidateSaved: session.candidate !== undefined, revision: session.revision, sessionPath: loc.sessionPath, validation: result.validation, nextAction: result.validation.valid ? "Call blueprint_research_submit using this saved revision." : "Correct only the saved fields identified in diagnostics." });
  });
}

export async function blueprintResearchRead(args: { cwd?: string; phase: string | number }) {
  z.object(researchLookup).parse(args);
  return withResearchSession(args, async loc => {
    const session = await readResearchSession(loc);
    const publishedPath = artifactPathFor(loc.resolved, "research");
    const published = await readResearchEvidence(loc.projectRoot, publishedPath, 4 * 1024 * 1024).catch(async error => ({
      path: publishedPath,
      hash: await researchInputHash(loc.projectRoot, publishedPath).catch(() => null),
      content: null,
      error: (error as Error).message,
    }));
    return { status: session || published.content ? "found" : "not_found", sessionPath: loc.sessionPath, session, published, freshness: session ? await researchBasisFreshness(loc.projectRoot, session.readSet) : null };
  });
}

// Injectable owning operations let tests exercise interruption after each durable stage.
export const researchSubmitDependencies = { artifactWrite: blueprintPhaseArtifactWrite, stateUpdate: blueprintStateUpdate, stateLoad: blueprintStateLoad, checkpointDelete: blueprintPhaseCheckpointDelete, writeText: writeTextFile };

export async function blueprintResearchSubmit(raw: z.input<typeof submitInput>) {
  const args = submitInput.parse(raw);
  if (args.reuse && args.candidate !== undefined) throw new Error("A reuse request cannot replace the candidate.");
  checkedResearchPayload(args);
  return withResearchSession(args, async loc => {
    const session = await readResearchSession(loc);
    if (!session) return { status: "not_found", saved: false, nextAction: "Call blueprint_research_prepare before submitting research." };
    const hash = requestKey(args);
    const replay = requestReplay(session, args.requestId, hash); if (replay) return replay;
    const accepted = Object.hasOwn(session.requests, args.requestId) ? session.requests[args.requestId] : undefined;
    const pendingRequest = Object.entries(session.requests).find(([id, request]) => id !== args.requestId && !request.receipt);
    if (pendingRequest) return { status: "partial", saved: session.candidate !== undefined, nextAction: `Retry blueprint_research_${pendingRequest[1].operation} requestId ${pendingRequest[0]} first.` };
    let journal = session.journal;
    if (journal && journal.requestId !== args.requestId && !journal.receipt) return { status: "partial", saved: session.candidate !== undefined, nextAction: `Retry blueprint_research_submit requestId ${journal.requestId} and identical arguments.` };
    const researchPath = artifactPathFor(loc.resolved, "research");
    const provenancePath = researchProvenancePath(researchPath);
    if (!journal || journal.requestId !== args.requestId) {
      if (accepted) {
        if (accepted.revision !== session.revision || accepted.operation !== "submit") return { status: "stale", revision: session.revision, reason: "Accepted request was superseded." };
      } else {
        if (session.revision !== args.expectedRevision) return { status: "stale", saved: false, revision: session.revision, reason: "Revision conflict" };
        if (args.candidate !== undefined) session.candidate = checkedResearchPayload(args.candidate);
        session.revision++;
        session.history.push({ revision: session.revision, kind: "submit", ...(session.candidate !== undefined ? { candidate: session.candidate } : {}) });
        session.requests[args.requestId] = { hash, revision: session.revision, operation: "submit" };
        await saveResearchSession(loc, session);
      }
      const fail = (status: string, details: Record<string, unknown>) => saveReceipt(loc, session, args.requestId, { status, saved: session.candidate !== undefined || Boolean(args.reuse), candidateSaved: session.candidate !== undefined, revision: session.revision, sessionPath: loc.sessionPath, ...details });
      const freshness = await researchBasisFreshness(loc.projectRoot, session.readSet);
      if (!session.prepared || freshness.status !== "fresh") return fail("needs_revision", { freshness, nextAction: "Refresh blueprint_research_prepare and reconcile changed inputs; the candidate is saved." });
      let content: string;
      if (args.reuse) {
        const existing = await readResearchEvidence(loc.projectRoot, researchPath, 4 * 1024 * 1024);
        const reuseFreshness = await readPublishedResearchFreshness(loc.projectRoot, researchPath);
        if (existing.content === null || reuseFreshness.status !== "fresh" || !validatePhaseArtifactContent(existing.content, "research").valid) return fail("needs_revision", { freshness: reuseFreshness, nextAction: "Review and submit updated research; only verified-fresh published research can be reused." });
        content = existing.content;
      } else {
        const result = assessment(session);
        if (!result.model || !result.validation.valid) return fail("needs_revision", { validation: result.validation, nextAction: "Repair the saved fields with blueprint_research_record; resubmit using the returned revision and a new requestId." });
        const config = await blueprintConfigGet({ cwd: loc.projectRoot, scope: "effective" });
        const external = result.model.sources.some(source => source.lane === "external");
        if (external && (config.config.research.external_sources === "off" || config.config.research.external_sources === "ask" && !args.externalSourcesApproved)) return fail("needs_revision", { reason: "External source policy does not authorize the candidate's live external evidence.", nextAction: "Honor off/ask/auto policy; record honest supplied or repository evidence, or obtain the ask approval before retrying." });
        const missing = result.model.sources.filter(source => source.lane === "repo").map(source => {
          const relative = source.reference.replace(/(?::\d+(?:-\d+)?)?(?:#.*)?$/, "");
          try { return canonicalResearchEvidencePath(loc.projectRoot, relative); } catch { return relative; }
        }).filter(p => !session.readSet.some(item => item.path === p && item.hash !== null));
        if (missing.length) return fail("needs_revision", { missingEvidencePaths: [...new Set(missing)], nextAction: "Call blueprint_research_prepare with these evidencePaths, review the captured evidence, then resubmit the saved candidate." });
        content = renderPhaseResearchModelContent({ resolved: loc.resolved, model: result.model, ...session.grounding, researchedAt: new Date().toISOString().slice(0, 10) });
      }
      content = prepareTextForPersistence(content).content.replace(/\r\n/g, "\n");
      if (Buffer.byteLength(content) > 4 * 1024 * 1024) return fail("needs_revision", { reason: "Rendered research exceeds 4 MiB; candidate is saved. Reduce repeated prose before publishing." });
      const validation = validatePhaseArtifactContent(content, "research");
      if (!validation.valid) return fail("needs_revision", { validation, reason: "Rendered research did not satisfy the compatibility contract; candidate is retained." });
      const observed = await researchInputHash(loc.projectRoot, researchPath);
      const observedProvenance = await researchInputHash(loc.projectRoot, provenancePath);
      if (observed !== session.baselineHash || observedProvenance !== session.baselineProvenanceHash) return fail("stale", { reason: "Publication targets changed after preparation.", nextAction: "Prepare with explicit reconciliation against the observed target hash." });
      if (observed && observed !== researchDigest(content) && !args.overwrite) {
        const existing = await fs.readFile(resolveBlueprintPath(loc.projectRoot, researchPath), "utf8");
        if (!isScaffoldGeneratedArtifact(existing)) return fail("needs_revision", { reason: "Explicit update/overwrite authorization is required.", nextAction: "After the user chooses update, submit the saved candidate with overwrite=true." });
      }
      // Reuse retains the original source basis, never silently rebases stale evidence.
      const originalProvenance = args.reuse ? await readResearchEvidence(loc.projectRoot, provenancePath) : null;
      const provenance = originalProvenance?.content ?? JSON.stringify({ version: 1, researchHash: researchDigest(content), readSet: session.readSet, publishedAt: new Date().toISOString() }, null, 2) + "\n";
      journal = { requestId: args.requestId, requestHash: hash, revision: session.revision, content, contentHash: researchDigest(content), baselineHash: observed, provenance, provenanceHash: researchDigest(provenance), baselineProvenanceHash: observedProvenance, readSet: args.reuse ? JSON.parse(provenance).readSet : session.readSet, reuse: args.reuse ?? false, stages: {} };
      session.journal = journal;
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
        journal.stages[stage] = "intent"; await checkpoint(); await assertFresh();
        if (stage === "artifact") {
          const result = await researchSubmitDependencies.artifactWrite({ cwd: loc.projectRoot, phase: session.phase, artifact: "research", content: journal.content, overwrite: args.overwrite, expectedContentHash: baseline, expectedTopology: session.topology });
          if (result.status === "invalid") throw new Error("Research artifact publication failed validation.");
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
      const nextAction = await safeNextAction(state.derivedStatus.nextAction);
      if (!nextAction) throw new Error("No implemented follow-up is currently available.");
      journal.stages.routing = "complete"; await checkpoint();
      const warnings = [...(state.warnings ?? [])];
      if (journal.stages.cleanup !== "complete") {
        journal.stages.cleanup = "intent"; await checkpoint();
        const cleanup = await researchSubmitDependencies.checkpointDelete({ cwd: loc.projectRoot, phase: session.phase, expectedTopology: session.topology, expectedOwnerCommand: "/blu-research-phase", expectedMode: "research" });
        if (!cleanup.deleted && cleanup.reason) warnings.push(cleanup.reason);
        journal.stages.cleanup = "complete"; await checkpoint();
      }
      await assertFresh();
      if (await researchInputHash(loc.projectRoot, researchPath) !== journal.contentHash) throw new Error("Research changed before final receipt.");
      if (await researchInputHash(loc.projectRoot, provenancePath) !== journal.provenanceHash) throw new Error("Research provenance changed before final receipt.");
      journal.receipt = { status: journal.reuse ? "reused" : "published", saved: true, ready: true, revision: session.revision, path: researchPath, sessionPath: loc.sessionPath, provenancePath, stages: { ...journal.stages }, warnings, nextAction };
      session.baselineHash = journal.contentHash; session.baselineProvenanceHash = journal.provenanceHash;
      return await saveReceipt(loc, session, args.requestId, journal.receipt);
    } catch (error) {
      return { status: "partial", saved: true, ready: false, revision: session.revision, sessionPath: loc.sessionPath, path: journal.stages.artifact === "complete" ? researchPath : null, stages: journal.stages, reason: (error as Error).message, nextAction: `Retry blueprint_research_submit with requestId ${args.requestId} and identical arguments; if inputs or targets changed, prepare with explicit reconciliation. The candidate is saved.` };
    }
  });
}

export const researchToolDefinitions: ToolDefinition[] = [
  { name: "blueprint_research_prepare", description: "Prepare one freshness-bound phase research packet and durable session revision with context, optional spec, requirements, source policy, existing research, and compact model schema.", inputSchema: prepareInput.shape, handler: args => blueprintResearchPrepare(args as z.input<typeof prepareInput>) },
  { name: "blueprint_research_record", description: "Save a raw research candidate, incremental notes, or narrow field corrections before model validation. Revision CAS and request IDs preserve work across retries.", inputSchema: recordInput.shape, handler: args => blueprintResearchRecord(args as z.input<typeof recordInput>) },
  { name: "blueprint_research_read", description: "Recover the exact saved research candidate, revision, history and publication journal; normal research starts with prepare.", inputSchema: researchLookup, handler: args => blueprintResearchRead(args as z.input<typeof researchLookupSchema>) },
  { name: "blueprint_research_submit", description: "Durably save a research candidate before validation, then render and publish planner-ready research with freshness checks and resumable state/routing completion. Reuse requires fresh research; overwrite requires user update authorization.", inputSchema: submitInput.shape, handler: args => blueprintResearchSubmit(args as z.input<typeof submitInput>) },
];
const researchLookupSchema = z.object(researchLookup);
