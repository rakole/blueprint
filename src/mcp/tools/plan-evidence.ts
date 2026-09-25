import { CODEBASE_ARTIFACTS } from "./artifacts.js";
import { safeJsonParseObject } from "../../shared/security.js";
import { blueprintConfigGet } from "./config.js";
import { artifactPathFor } from "./phase-locations.js";
import { planLocation, type PlanLocation, type PlanSession } from "./plan-session.js";
import { canonicalResearchEvidencePath, readResearchEvidence, researchDigest, researchInputHash, stableResearchValue, type ResearchReadSet } from "./research-evidence.js";
import {
  hashPortableProviderMemberSets,
  portableProviderEvidenceBasisSchema,
  type PortableProviderEvidenceBasis
} from "../codebase-index/provider-evidence.js";

// Mutable outputs have independent compare-and-swap baselines, not evidence hashes.
function evidenceInventory(loc: PlanLocation) {
  return loc.artifacts.filter(p => !/-PLAN\.md$/.test(p) && !/-SESSION\.json$/.test(p) && !/-CHECKPOINT\.json$/.test(p) && !/-PLAN-PUBLICATION\.json$/.test(p)).sort();
}

export async function planInputHash(root: string, relative: string, phase: string) {
  if (relative === "@plan/effective-config") {
    const config = await blueprintConfigGet({ cwd: root, scope: "effective" });
    return researchDigest(stableResearchValue({ config: config.config, provenance: config.provenance }));
  }
  if (relative === "@plan/evidence-inventory") return researchDigest(stableResearchValue(evidenceInventory(await planLocation({ cwd: root, phase }))));
  return researchInputHash(root, relative);
}

function mapMemberName(pathValue: string, generationId: string): string {
  const mapPath = pathValue.startsWith(".blueprint/codebase/") ? pathValue.slice(".blueprint/codebase/".length) : pathValue;
  const prefix = `generations/${generationId}/`;
  return mapPath.startsWith(prefix) ? mapPath.slice(prefix.length) : mapPath;
}

function portableMemberSets(basis: PortableProviderEvidenceBasis) {
  const parsed = portableProviderEvidenceBasisSchema.safeParse(basis);
  if (!parsed.success) return null;
  const value = parsed.data;
  const contexts = value.trustedPins.length ? value.trustedPins : [{ pin: value.pin, ...(value.pinReceipt ? { receipt: value.pinReceipt } : {}) }];
  return contexts.map(context => {
    const members = new Set(["ENTRY.md", "manifest.json"]);
    for (const item of value.readSet.sourceAndPage) {
      if (item.kind === "page" && item.generation === context.pin.generationId) members.add(mapMemberName(item.path, context.pin.generationId));
    }
    for (const item of value.readSet.sealedMembers) {
      if (item.generationId === context.pin.generationId) members.add(mapMemberName(item.path, context.pin.generationId));
    }
    return {
      pin: context.pin,
      ...(context.receipt ? { receipt: context.receipt } : {}),
      members: [...members].sort()
    };
  });
}

async function portableBasisFreshness(root: string, bases: readonly PortableProviderEvidenceBasis[]) {
  const sets = bases.flatMap(portableMemberSets).filter((value): value is NonNullable<ReturnType<typeof portableMemberSets>>[number] => Boolean(value));
  if (sets.length !== bases.length && bases.some(value => !portableProviderEvidenceBasisSchema.safeParse(value).success)) {
    return { status: "unknown" as const, stalePaths: [] as string[], unknownPaths: ["portable"] };
  }
  if (!sets.length) return { status: "fresh" as const, stalePaths: [] as string[], unknownPaths: [] as string[] };
  if (sets.some(set => !set.receipt)) return { status: "unknown" as const, stalePaths: [] as string[], unknownPaths: ["portable"] };
  const result = await hashPortableProviderMemberSets(root, sets as any);
  if (result.status !== "ok") return { status: "unknown" as const, stalePaths: [], unknownPaths: ["portable"] };
  return { status: "fresh" as const, stalePaths: [] as string[], unknownPaths: [] as string[] };
}

export async function planBasisFreshness(root: string, phase: string, readSet: ResearchReadSet, portableBases: readonly PortableProviderEvidenceBasis[] = []) {
  const stalePaths: string[] = [], unknownPaths: string[] = [];
  if (!readSet.length) unknownPaths.push("readSet");
  await Promise.all(readSet.map(async item => {
    try { if (await planInputHash(root, item.path, phase) !== item.hash) stalePaths.push(item.path); }
    catch { unknownPaths.push(item.path); }
  }));
  if (portableBases.length) {
    const portable = await portableBasisFreshness(root, portableBases);
    stalePaths.push(...portable.stalePaths);
    unknownPaths.push(...portable.unknownPaths);
  }
  stalePaths.sort(); unknownPaths.sort();
  return { status: stalePaths.length ? "stale" : unknownPaths.length ? "unknown" : "fresh", stalePaths, unknownPaths };
}

export type CapturePlanEvidenceOptions = { skipCodebaseArtifacts?: boolean };

export async function capturePlanEvidence(loc: PlanLocation, selectedPaths: string[], options: CapturePlanEvidenceOptions = {}) {
  const evidencePaths = [...new Set(selectedPaths.map(p => canonicalResearchEvidencePath(loc.projectRoot, p)))];
  if (evidencePaths.some(p => p === ".blueprint/STATE.md" || /-(?:PLAN|SESSION|CHECKPOINT|PLAN-PUBLICATION)\.(?:md|json)$/.test(p))) throw new Error("Select repository evidence, not mutable plans, state, sessions, or checkpoints.");
  const researchPath = artifactPathFor(loc.resolved, "research");
  const paths = [...new Set([
    ".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", ".blueprint/ROADMAP.md", ".blueprint/config.json",
    ...(options.skipCodebaseArtifacts ? [] : CODEBASE_ARTIFACTS), ...["context", "spec", "research", "ui-spec"].map(kind => artifactPathFor(loc.resolved, kind as "context")),
    researchPath.replace(/-RESEARCH\.md$/, "-RESEARCH-PROVENANCE.json"), ...evidenceInventory(loc), ...evidencePaths,
  ])];
  const inputs = await Promise.all(paths.map(p => readResearchEvidence(loc.projectRoot, p, 1024 * 1024)));
  const readSet: ResearchReadSet = inputs.map(({ path, hash }) => ({ path, hash }));
  // Capture current transitive source bytes before readiness. Readiness compares
  // historical research fingerprints; planning freshness detects later changes
  // without turning already-stale research into an endless retry loop.
  const provenance = inputs.find(input => input.path === researchPath.replace(/-RESEARCH\.md$/, "-RESEARCH-PROVENANCE.json"));
  if (provenance?.content) {
    const parsed = safeJsonParseObject(provenance.content, { label: provenance.path, maxBytes: 1024 * 1024 });
    if (parsed.version !== 1 || !Array.isArray(parsed.readSet) || parsed.readSet.length > 100) throw new Error("Research provenance has an invalid source read set.");
    for (const item of parsed.readSet) {
      if (!item || typeof item !== "object" || typeof item.path !== "string" || !(item.hash === null || typeof item.hash === "string" && /^[a-f0-9]{64}$/.test(item.hash))) throw new Error("Research provenance contains an invalid source fingerprint.");
      if (item.path.startsWith("@") && item.path !== "@research/effective-config") throw new Error("Research provenance contains an unknown virtual input.");
      const path = item.path === "@research/effective-config" ? item.path : canonicalResearchEvidencePath(loc.projectRoot, item.path);
      const captured = readSet.find(entry => entry.path === path);
      if (!captured) readSet.push({ path, hash: await researchInputHash(loc.projectRoot, path) });
    }
  } else {
    // Without provenance, legacy compatibility depends on the research session:
    // a newly interrupted publication must not be mistaken for legacy evidence.
    const path = researchPath.replace(/-RESEARCH\.md$/, "-RESEARCH-SESSION.json");
    readSet.push({ path, hash: await researchInputHash(loc.projectRoot, path) });
  }
  readSet.push({ path: "@plan/effective-config", hash: await planInputHash(loc.projectRoot, "@plan/effective-config", loc.resolved.phaseNumber) });
  readSet.push({ path: "@plan/evidence-inventory", hash: researchDigest(stableResearchValue(evidenceInventory(loc))) });
  return { inputs, readSet, evidencePaths };
}

export type PlanOrdinaryDeliveryArgs = {
  readonly mode?: "full" | "delta" | "register";
  readonly readTimeEvidence?: readonly { path: string; hash?: string; bytes?: string }[];
};

type PlanOrdinaryEvidenceInput = {
  readonly path: string;
  readonly hash: string | null;
  readonly content: string | null;
};

export function shapePlanOrdinaryEvidence(
  inputs: readonly PlanOrdinaryEvidenceInput[],
  args: PlanOrdinaryDeliveryArgs | undefined,
  delivery: PlanSession["delivery"]
) {
  const mode = args?.mode ?? "full";
  const previousDelivered = new Map((delivery?.delivered ?? []).map(item => [item.path, item.hash]));
  const previousRegistered = new Map((delivery?.registered ?? []).map(item => [item.path, item.hash]));
  const asserted = new Map((args?.readTimeEvidence ?? []).map(item => [item.path, item.hash ?? (item.bytes === undefined ? null : researchDigest(item.bytes))]));
  const malformed = (args?.readTimeEvidence ?? []).filter(item => item.bytes !== undefined && item.hash !== undefined && researchDigest(item.bytes) !== item.hash).map(item => item.path);
  if (malformed.length) return { status: "reread_required" as const, paths: malformed };
  const selected = new Set(inputs.map(item => item.path));
  const unknown = [...asserted.keys()].filter(pathValue => !selected.has(pathValue));
  if (unknown.length) return { status: "reread_required" as const, paths: unknown };
  const mismatched = [...asserted.entries()]
    .filter(([pathValue, readAtTime]) => readAtTime === null || inputs.find(item => item.path === pathValue)?.hash !== readAtTime)
    .map(([pathValue]) => pathValue);
  if (mismatched.length) return { status: "reread_required" as const, paths: mismatched };
  const delivered = new Map(previousDelivered);
  const registered = new Map(previousRegistered);
  const evidence = inputs.map(item => {
    const unchanged = previousDelivered.get(item.path) === item.hash || previousRegistered.get(item.path) === item.hash;
    const readAtTime = asserted.get(item.path);
    const registeredNow = readAtTime !== null && readAtTime !== undefined && readAtTime === item.hash;
    const omitBody = item.content !== null && ((mode === "delta" && unchanged) || (mode === "register" && (unchanged || registeredNow)));
    if (item.content !== null && item.hash) {
      // Any emitted body proves delivery, including the first delta/register
      // response.  Registration is reserved for an omitted body with a
      // verified read-time hash.
      if (!omitBody) delivered.set(item.path, item.hash);
      if (registeredNow) registered.set(item.path, item.hash);
    }
    return omitBody ? { path: item.path, hash: item.hash } : item;
  });
  return { status: "ok" as const, evidence, delivery: { delivered: [...delivered.entries()].map(([path, hash]) => ({path, hash})), registered: [...registered.entries()].map(([path, hash]) => ({path, hash})) } };
}

export async function readPlanTargetHashes(loc: PlanLocation) {
  const prefix = `${loc.resolved.phaseDir}/${loc.resolved.phasePrefix}-`;
  return Promise.all(loc.artifacts.filter(p => p.startsWith(prefix) && /^\d+-PLAN\.md$/.test(p.slice(prefix.length))).sort().map(async path => ({ path, hash: await researchInputHash(loc.projectRoot, path) })));
}

export async function planTargetFreshness(loc: PlanLocation, session: PlanSession) {
  const current = await planLocation({ cwd: loc.projectRoot, phase: session.phase });
  const targets = await readPlanTargetHashes(current);
  return { fresh: stableResearchValue(targets) === stableResearchValue(session.targets), targets };
}
