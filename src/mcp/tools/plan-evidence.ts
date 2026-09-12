import { CODEBASE_ARTIFACTS } from "./artifacts.js";
import { safeJsonParseObject } from "../../shared/security.js";
import { blueprintConfigGet } from "./config.js";
import { artifactPathFor } from "./phase-locations.js";
import { planLocation, type PlanLocation, type PlanSession } from "./plan-session.js";
import { canonicalResearchEvidencePath, readResearchEvidence, researchDigest, researchInputHash, stableResearchValue, type ResearchReadSet } from "./research-evidence.js";

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

export async function planBasisFreshness(root: string, phase: string, readSet: ResearchReadSet) {
  const stalePaths: string[] = [], unknownPaths: string[] = [];
  if (!readSet.length) unknownPaths.push("readSet");
  await Promise.all(readSet.map(async item => {
    try { if (await planInputHash(root, item.path, phase) !== item.hash) stalePaths.push(item.path); }
    catch { unknownPaths.push(item.path); }
  }));
  stalePaths.sort(); unknownPaths.sort();
  return { status: stalePaths.length ? "stale" : unknownPaths.length ? "unknown" : "fresh", stalePaths, unknownPaths };
}

export async function capturePlanEvidence(loc: PlanLocation, selectedPaths: string[]) {
  const evidencePaths = [...new Set(selectedPaths.map(p => canonicalResearchEvidencePath(loc.projectRoot, p)))];
  if (evidencePaths.some(p => p === ".blueprint/STATE.md" || /-(?:PLAN|SESSION|CHECKPOINT|PLAN-PUBLICATION)\.(?:md|json)$/.test(p))) throw new Error("Select repository evidence, not mutable plans, state, sessions, or checkpoints.");
  const researchPath = artifactPathFor(loc.resolved, "research");
  const paths = [...new Set([
    ".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", ".blueprint/ROADMAP.md", ".blueprint/config.json",
    ...CODEBASE_ARTIFACTS, ...["context", "spec", "research", "ui-spec"].map(kind => artifactPathFor(loc.resolved, kind as "context")),
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

export async function readPlanTargetHashes(loc: PlanLocation) {
  const prefix = `${loc.resolved.phaseDir}/${loc.resolved.phasePrefix}-`;
  return Promise.all(loc.artifacts.filter(p => p.startsWith(prefix) && /^\d+-PLAN\.md$/.test(p.slice(prefix.length))).sort().map(async path => ({ path, hash: await researchInputHash(loc.projectRoot, path) })));
}

export async function planTargetFreshness(loc: PlanLocation, session: PlanSession) {
  const current = await planLocation({ cwd: loc.projectRoot, phase: session.phase });
  const targets = await readPlanTargetHashes(current);
  return { fresh: stableResearchValue(targets) === stableResearchValue(session.targets), targets };
}
