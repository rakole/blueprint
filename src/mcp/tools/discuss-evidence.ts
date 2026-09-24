import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { resolveRepoRelativeInputPathSync } from "../../shared/security.js";
import { blueprintConfigGet } from "./config.js";
import { resolvePhaseRuntimeSnapshot } from "./phase-resolution.js";
import { artifactPathFor, checkpointPathFor } from "./phase-locations.js";
import { blueprintPhaseArtifactScaffold } from "./phase-artifacts.js";
import { loadBlueprintState } from "./state.js";
import {
  validatePhaseArtifactContent,
  assertCodebasePublicationComplete,
  isScaffoldGeneratedArtifact,
} from "./artifacts.js";
import {
  preparePortableProviderEvidence,
  resolvePortableProviderEvidence,
  type PortableProviderEvidenceBasis,
  type PortableProviderEvidenceDelivery,
  type PortableProviderEvidenceNext,
  type PortableProviderEvidenceSuccess
} from "../codebase-index/provider-evidence.js";
import {type PortableSelection} from "../codebase-index/resolver.js";

export const evidenceDigest = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export const stableEvidence = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
export async function readDiscussEvidence(root: string, relative: string) {
  await assertCodebasePublicationComplete(root, relative);
  try {
    const bytes = await fs.readFile(
      resolveRepoRelativeInputPathSync(root, relative),
    );
    if (bytes.length > 256 * 1024)
      throw new Error(
        `Discuss evidence exceeds 256 KiB: ${relative}; select a smaller source.`,
      );
    return {
      path: relative,
      hash: evidenceDigest(bytes),
      content: bytes.toString("utf8"),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { path: relative, hash: null, content: null };
    throw error;
  }
}
export async function discussPlanInventory(root: string, phaseDir: string) {
  return (await fs.readdir(resolveRepoRelativeInputPathSync(root, phaseDir)))
    .filter((name) => /(?:^|-)PLAN(?:\.json|\.md)$/.test(name))
    .sort();
}
/** Controlled runtime projections; never accept arbitrary virtual fingerprints from the model. */
export async function discussEvidenceHash(root: string, relative: string) {
  if (relative === "@discuss/effective-config") {
    const config = await blueprintConfigGet({ cwd: root, scope: "effective" });
    return evidenceDigest(
      stableEvidence({ config: config.config, provenance: config.provenance }),
    );
  }
  if (relative.startsWith("@discuss/prior/")) {
    const snapshot = await resolvePhaseRuntimeSnapshot({ cwd: root, phase: relative.slice("@discuss/prior/".length) });
    return evidenceDigest(stableEvidence({ resolved: snapshot.resolved, reason: snapshot.located.reason }));
  }
  if (relative.startsWith("@discuss/plans/"))
    return evidenceDigest(
      stableEvidence(
        await discussPlanInventory(
          root,
          relative.slice("@discuss/plans/".length),
        ),
      ),
    );
  return (await readDiscussEvidence(root, relative)).hash;
}

export type DiscussPortableMetadata = {
  selections: PortableSelection[];
  basis: PortableProviderEvidenceBasis;
  next: PortableProviderEvidenceNext;
};

export type DiscussPortableDelivery = Pick<PortableProviderEvidenceDelivery, "mode" | "readTimeEvidence">;

export type DiscussOrdinaryDelivery = {
  delivered: Array<{path: string; hash: string}>;
  registered: Array<{path: string; hash: string}>;
};

// Keep the evidence-delivery hash's canonical key order when metadata has
// crossed the Zod/session boundary (the schema's field order is different).
function portablePriorIdentities(
  values: readonly {path: string; generation: string; hash: string}[],
) {
  return values.map((item) => ({
    path: item.path,
    hash: item.hash,
    generation: item.generation,
  }));
}

function discussEvidenceBudget(
  readSet: readonly {path: string}[],
  evidencePaths: readonly string[],
  portableSelections: readonly unknown[] | undefined,
) {
  const explicit = new Set(evidencePaths);
  const baseline = readSet.filter((item) => !explicit.has(item.path)).length;
  const selected = explicit.size;
  const compactEntryBaseline = portableSelections?.length ? 0 : 1;
  return {
    baselineSelectedCount: baseline + selected + compactEntryBaseline,
    baselineReadSetCount: baseline + selected,
    maxSourceCount: 20 + baseline + compactEntryBaseline,
  };
}

export async function collectDiscussEvidence(args: {
  cwd?: string;
  phase?: string | number;
  evidencePaths?: string[];
  resolveEvidencePaths?: (root: string, sessionPath: string) => Promise<string[]>;
  portableSelections?: PortableSelection[];
  evidenceDelivery?: DiscussPortableDelivery;
  expectedRevision?: number;
  acknowledgeChangedInputs?: boolean;
  resolvePortableMetadata?: (root: string, sessionPath: string) => Promise<DiscussPortableMetadata | undefined>;
  resolveOrdinaryDelivery?: (root: string, sessionPath: string) => Promise<DiscussOrdinaryDelivery | undefined>;
}) {
  // Resolution helpers read separately: bind their result to the exact roadmap bytes before/after.
  const { ensureRepoRoot } = await import("./artifacts.js");
  const root = await ensureRepoRoot(args.cwd);
  const roadmap = await readDiscussEvidence(root, ".blueprint/ROADMAP.md");
  let snapshot = await resolvePhaseRuntimeSnapshot({ ...args, cwd: root });
  if (
    !snapshot.resolved &&
    snapshot.matchedPhase &&
    !snapshot.matchedPhase.completed &&
    snapshot.located.reason?.includes("no matching directory")
  ) {
    await blueprintPhaseArtifactScaffold({
      cwd: root,
      phase: snapshot.matchedPhase.phaseNumber,
      artifact: "context",
    });
    snapshot = await resolvePhaseRuntimeSnapshot({ ...args, cwd: root });
  }
  if (!snapshot.resolved || !snapshot.matchedPhase)
    return {
      status: "blocked" as const,
      selection: snapshot.located,
      reason: snapshot.located.reason,
    };
  const selected = snapshot.resolved;
  const sessionPath = `${selected.phaseDir}/${selected.phasePrefix}-DISCUSS-SESSION.json`;
  const evidencePaths = args.resolveEvidencePaths
    ? await args.resolveEvidencePaths(root, sessionPath)
    : args.evidencePaths ?? [];
  const priorPortable = args.resolvePortableMetadata
    ? await args.resolvePortableMetadata(root, sessionPath)
    : undefined;
  const priorOrdinary = args.resolveOrdinaryDelivery
    ? await args.resolveOrdinaryDelivery(root, sessionPath)
    : undefined;
  const portableSelections = args.portableSelections ?? priorPortable?.selections;
  // Prefer a verified portable map when one is already available, while
  // preserving ordinary discovery for absent, malformed, or unsupported maps.
  // The probe is intentionally read-only; the owner below issues the durable
  // receipt once the complete packet has been assembled.
  const defaultPortable = portableSelections === undefined && !priorPortable
    ? await resolvePortableProviderEvidence({root})
    : undefined;
  const portableIndexPresent = portableSelections !== undefined || Boolean(priorPortable) || defaultPortable?.status === "ok";
  const effectivePortableSelections = portableSelections ?? (defaultPortable?.status === "ok" ? [] : undefined);
  const guardedPortableFallback = defaultPortable !== undefined && defaultPortable.status !== "ok" &&
    (defaultPortable.diagnostics ?? []).some(item => (item as {code?: string}).code !== "missing");
  const skipCompatibilityViews = portableIndexPresent || guardedPortableFallback;
  const contextPath = artifactPathFor(selected, "context");
  const logPath = artifactPathFor(selected, "discussion-log");
  const specPath = artifactPathFor(selected, "spec");
  const [config, ambient, targets, inventory, checkpoint] = await Promise.all([
    blueprintConfigGet({ cwd: root, scope: "effective" }),
    loadBlueprintState(root),
    Promise.all(
      [contextPath, logPath, specPath].map((p) => readDiscussEvidence(root, p)),
    ),
    discussPlanInventory(root, selected.phaseDir),
    readDiscussEvidence(root, checkpointPathFor(selected)),
  ]);
  const [context, log, spec] = targets;
  const detail =
    (roadmap.content ?? "")
      .split(/^###\s+/m)
      .find((part) =>
        new RegExp(
          `^Phase\\s+${selected.phaseNumber.replaceAll(".", "\\.")}\\s*:`,
          "i",
        ).test(part),
      ) ?? "";
  const dependencyText = [
    detail
      .split("\n")
      .filter((line) => /depend(?:s|encies|ency)\b/i.test(line))
      .join("\n"),
    context.content,
    spec.content,
  ].join("\n");
  const explicit = new Set(
    [
      ...dependencyText.matchAll(
        /(?:phase\s+|phases\/)(\d+(?:\.\d+)*)(?=\b|[-/])/gi,
      ),
    ].map((m) => m[1].replace(/^0+(?=\d)/, "")),
  );
  const phaseIndex = snapshot.roadmap!.phases.findIndex(
    (p) => p.phaseNumber === selected.phaseNumber,
  );
  const relevant = snapshot
    .roadmap!.phases.slice(0, phaseIndex)
    .reverse()
    .filter(
      (p) =>
        explicit.has(p.phaseNumber) ||
        p.requirements.some((id) =>
          snapshot.matchedPhase!.requirements.includes(id),
        ),
    )
    .sort(
      (a, b) =>
        Number(explicit.has(b.phaseNumber)) -
        Number(explicit.has(a.phaseNumber)),
    );
  const prior = relevant.slice(0, 3);
  const omittedPriorPhases = relevant.slice(3).map((p) => p.phaseNumber);
  const priorSnapshots = await Promise.all(
    prior.map((p) =>
      resolvePhaseRuntimeSnapshot({ cwd: root, phase: p.phaseNumber }),
    ),
  );
  const priorPaths = priorSnapshots.flatMap((s) =>
    s.resolved ? [artifactPathFor(s.resolved, "context")] : [],
  );
  const paths = [
    ...new Set([
      ".blueprint/PROJECT.md",
      ".blueprint/REQUIREMENTS.md",
      ".blueprint/config.json",
      ...(skipCompatibilityViews
        ? []
        : [
            ".blueprint/codebase/ARCHITECTURE.md",
            ".blueprint/codebase/STRUCTURE.md",
            ".blueprint/codebase/CONVENTIONS.md",
          ]),
      "package.json",
      "README.md",
      ...priorPaths,
      ...evidencePaths,
      ...inventory.map((name) => `${selected.phaseDir}/${name}`),
    ]),
  ].filter((p) => ![contextPath, logPath, specPath, roadmap.path].includes(p));
  if (
    paths.some((p) =>
      /(?:^|\/)(?:STATE\.md|.*DISCUSS-(?:SESSION|CHECKPOINT)\.json)$/.test(p),
    )
  )
    throw new Error(
      "Mutable state/session/checkpoint cannot be discussion evidence.",
    );
  const sources = await Promise.all(
    paths.map((p) => readDiscussEvidence(root, p)),
  );
  if (
    [roadmap, ...targets, checkpoint, ...sources].reduce(
      (sum, item) => sum + Buffer.byteLength(item.content ?? ""),
      0,
    ) >
    512 * 1024
  )
    return {
      status: "blocked" as const,
      reason:
        "Evidence packet exceeds 512 KiB; narrow source inputs before preparing.",
    };
  const readSet = [roadmap, spec, ...sources].map(({ path, hash }) => ({
    path,
    hash,
  }));
  readSet.push(...priorSnapshots.map((snapshot, index) => ({
    path: `@discuss/prior/${prior[index].phaseNumber}`,
    hash: evidenceDigest(stableEvidence({ resolved: snapshot.resolved, reason: snapshot.located.reason })),
  })));
  readSet.push(
    {
      path: "@discuss/effective-config",
      hash: evidenceDigest(
        stableEvidence({
          config: config.config,
          provenance: config.provenance,
        }),
      ),
    },
    {
      path: `@discuss/plans/${selected.phaseDir}`,
      hash: evidenceDigest(stableEvidence(inventory)),
    },
  );
  const observed = await Promise.all(
    readSet.map(async (item) => ({
      path: item.path,
      hash: await discussEvidenceHash(root, item.path),
    })),
  );
  const changed = readSet
    .filter((item, i) => item.hash !== observed[i].hash)
    .map((item) => item.path);
  if (changed.length)
    return {
      status: "stale" as const,
      reason: "Inputs changed while preparing; retry.",
      changedPaths: changed,
    };
  let portableResult: PortableProviderEvidenceSuccess | null = null;
  if (portableIndexPresent) {
    const samePortableSelections =
      priorPortable &&
      JSON.stringify(priorPortable.selections) ===
        JSON.stringify(effectivePortableSelections ?? priorPortable.selections);
    const refreshingPortable = Boolean(
      priorPortable && args.acknowledgeChangedInputs && args.expectedRevision !== undefined,
    );
    const reusePortable = Boolean(samePortableSelections && priorPortable && !refreshingPortable);
    const prior = reusePortable && priorPortable
      ? {
          binding: {
            pinnedGeneration: priorPortable.basis.generationId,
            identities: portablePriorIdentities(priorPortable.basis.bound),
            hash: priorPortable.basis.bindingHash,
          },
          delivered: portablePriorIdentities(priorPortable.next.delivered),
          registered: portablePriorIdentities(priorPortable.next.registered),
        }
      : undefined;
    const budget = discussEvidenceBudget(readSet, evidencePaths, portableSelections);
    const portableInput = {
      root,
      ...(effectivePortableSelections !== undefined ? {selections: effectivePortableSelections} : {}),
      ...(reusePortable && priorPortable?.basis.pinReceipt
        ? {pinReceipt: priorPortable.basis.pinReceipt}
        : {}),
      ...(reusePortable && priorPortable ? {generationId: priorPortable.basis.generationId} : {}),
      evidenceDelivery: {
        mode: args.evidenceDelivery?.mode ?? "full",
        ...(prior ? {prior} : {}),
        ...(effectivePortableSelections?.length && args.evidenceDelivery?.readTimeEvidence
          ? {readTimeEvidence: args.evidenceDelivery.readTimeEvidence}
          : {}),
        limits: {
          maxSourceCount: budget.maxSourceCount,
          maxReadSetCount: 100,
        },
        baseline: {
          selectedCount: budget.baselineSelectedCount,
          readSetCount: budget.baselineReadSetCount,
        },
      },
    } as const;
    const result = reusePortable
      ? await resolvePortableProviderEvidence(portableInput)
      : await preparePortableProviderEvidence(portableInput);
    if (result.status !== "ok") {
      return {
        ...result,
        root,
        phase: selected.phaseNumber,
        changedPaths: result.paths,
      };
    }
    portableResult = result;
  }
  const priorOrdinaryDelivered = new Map(
    (priorOrdinary?.delivered ?? []).map((item) => [item.path, item.hash]),
  );
  const priorOrdinaryRegistered = new Map(
    (priorOrdinary?.registered ?? []).map((item) => [item.path, item.hash]),
  );
  const ordinaryReadTime = new Map<string, string>();
  for (const item of args.evidenceDelivery?.readTimeEvidence ?? []) {
    const bytes = item.bytes === undefined
      ? undefined
      : typeof item.bytes === "string"
        ? new TextEncoder().encode(item.bytes)
        : item.bytes;
    const actual = bytes === undefined ? item.hash : evidenceDigest(Buffer.from(bytes));
    if (!actual || (item.hash !== undefined && item.hash !== actual))
      return {
        status: "invalid" as const,
        reason: "Read-time evidence does not match its supplied bytes or hash.",
        changedPaths: [item.path],
      };
    const source = sources.find((candidate) => candidate.path === item.path);
    if (source && source.hash !== actual)
      return {
        status: "invalid" as const,
        reason: "Read-time evidence does not match selected ordinary source bytes.",
        changedPaths: [item.path],
      };
    ordinaryReadTime.set(item.path, actual);
  }
  const ordinaryDelivered = new Map(priorOrdinaryDelivered);
  const ordinaryRegistered = new Map(priorOrdinaryRegistered);
  const ordinaryShouldDeliver = new Map<string, boolean>();
  for (const item of sources) {
    if (!evidencePaths.includes(item.path) || !item.hash) continue;
    const priorValid =
      priorOrdinaryDelivered.get(item.path) === item.hash ||
      priorOrdinaryRegistered.get(item.path) === item.hash;
    const readProof = ordinaryReadTime.get(item.path) === item.hash;
    const mode = args.evidenceDelivery?.mode ?? "full";
    const include = mode === "full" || (mode === "delta" ? !priorValid : !priorValid && !readProof);
    ordinaryShouldDeliver.set(item.path, include);
    if (include) ordinaryDelivered.set(item.path, item.hash);
    else if (mode === "register" && readProof) ordinaryRegistered.set(item.path, item.hash);
  }
  const artifact = (
    item: typeof context,
    kind: "context" | "spec" | "discussion-log",
  ) => ({
    ...item,
    status:
      item.content === null
        ? "missing"
        : isScaffoldGeneratedArtifact(item.content)
          ? "scaffold"
          : "present",
    validation:
      item.content === null
        ? null
          : validatePhaseArtifactContent(item.content, kind),
  });
  // Ground all ordinary sources privately above, then apply the caller's
  // outward delivery mode. Session metadata retains hashes and paths only.
  const outwardSources = sources.map((item) => {
    if (
      args.evidenceDelivery?.mode !== "full" &&
      evidencePaths.includes(item.path) &&
      ordinaryShouldDeliver.get(item.path) === false
    ) {
      // Keep the packet shape stable while dropping the body itself. JSON
      // serialization omits this undefined field, and private grounding above
      // has already validated the bytes and hash.
      return {...item, content: undefined};
    }
    return item;
  });
  return {
    status: "collected" as const,
    root,
    phase: selected.phaseNumber,
    readSet,
    packet: {
      selectedPhase: { ...selected, ...snapshot.matchedPhase },
      ambientCurrentPhase: ambient.currentPhase,
      config,
      artifacts: {
        context: artifact(context, "context"),
        spec: artifact(spec, "spec"),
        log: artifact(log, "discussion-log"),
      },
      ...(portableResult ? {portableEvidence: portableResult.packet} : {}),
      sources: [roadmap, ...outwardSources],
      priorContextPaths: priorPaths,
      omittedPriorPhases,
      checkpoint,
      planInventory: inventory,
      warnings: [
        ...config.warnings,
        ...(inventory.length
          ? [
              "Existing plans may be stale after changed decisions; refresh through /blu-plan-phase.",
            ]
          : []),
        ...(omittedPriorPhases.length
          ? [
              `Prior context budget omitted phases ${omittedPriorPhases.join(", ")}; inspect relevant dependencies with evidencePaths before deciding.`,
            ]
          : []),
        ...(sources.some(
          (s) => s.path.startsWith(".blueprint/codebase/") && s.content,
        )
          ? [
              "Saved codebase summaries are evidence; confirm applicable live paths before relying on them.",
            ]
          : [
              "No saved codebase summaries; inspect narrow live evidence if implementation choices need it.",
            ]),
        ...(portableResult
          ? [
              "Portable codebase ENTRY and selected evidence were freshly verified; compatibility summaries were omitted.",
            ]
          : []),
      ],
    },
    ...(portableResult
      ? {
          portable: {
            selections: [...(portableSelections ?? [])],
            basis: portableResult.basis,
            next: portableResult.next,
          } satisfies DiscussPortableMetadata,
        }
      : {}),
    ordinaryDelivery: {
      delivered: [...ordinaryDelivered.entries()].map(([path, hash]) => ({path, hash})).sort((a, b) => a.path.localeCompare(b.path)),
      registered: [...ordinaryRegistered.entries()].map(([path, hash]) => ({path, hash})).sort((a, b) => a.path.localeCompare(b.path)),
    } satisfies DiscussOrdinaryDelivery,
  };
}
