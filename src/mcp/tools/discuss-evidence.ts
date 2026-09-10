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
  isScaffoldGeneratedArtifact,
} from "./artifacts.js";

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
export async function collectDiscussEvidence(args: {
  cwd?: string;
  phase?: string | number;
  evidencePaths?: string[];
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
      ".blueprint/codebase/ARCHITECTURE.md",
      ".blueprint/codebase/STRUCTURE.md",
      ".blueprint/codebase/CONVENTIONS.md",
      "package.json",
      "README.md",
      ...priorPaths,
      ...(args.evidencePaths ?? []),
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
      sources: [roadmap, ...sources],
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
      ],
    },
  };
}
