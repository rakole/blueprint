import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { resolveRepoRelativeInputPathSync } from "../../shared/security.js";

export type PhaseCheckpointFreshness = {
  status: "fresh" | "stale" | "unknown" | "not-applicable";
  stalePaths: string[];
  unknownPaths: string[];
  warnings: string[];
};

/** Legacy or virtual read-set entries remain readable evidence, never verified inputs. */
export async function evaluateCheckpointFreshness(
  projectRoot: string,
  checkpoint: Record<string, unknown>
): Promise<PhaseCheckpointFreshness> {
  const result: PhaseCheckpointFreshness = {
    status: "not-applicable", stalePaths: [], unknownPaths: [], warnings: []
  };
  // Research owns a separate ledger/freshness contract.
  if (checkpoint.ownerCommand !== "/blu-discuss-phase") return result;
  const entries = Array.isArray(checkpoint.readSet) ? checkpoint.readSet : [];
  if (entries.length === 0) result.unknownPaths.push("readSet");
  for (const [index, entry] of entries.entries()) {
    const record = typeof entry === "object" && entry !== null && !Array.isArray(entry)
      ? entry as Record<string, unknown> : null;
    const inputPath = typeof record?.path === "string" ? record.path
      : typeof entry === "string" ? entry : `readSet[${index}]`;
    const fingerprint = record?.hash ?? record?.fingerprint;
    const expectedHash = typeof fingerprint === "string" && /^(?:sha256:)?[a-f0-9]{64}$/i.test(fingerprint)
      ? fingerprint.replace(/^sha256:/i, "").toLowerCase() : null;
    const expectedTime = typeof record?.updatedAt === "string" ? Date.parse(record.updatedAt) : NaN;
    if (!record || (!expectedHash && !Number.isFinite(expectedTime))) {
      result.unknownPaths.push(inputPath);
      continue;
    }
    let absolutePath: string;
    try {
      absolutePath = resolveRepoRelativeInputPathSync(projectRoot, inputPath);
    } catch {
      result.unknownPaths.push(inputPath);
      continue;
    }
    try {
      const stat = await fs.stat(absolutePath);
      if (!stat.isFile()) {
        result.unknownPaths.push(inputPath);
        continue;
      }
      const unchanged = expectedHash
        ? createHash("sha256").update(await fs.readFile(absolutePath)).digest("hex") === expectedHash
        : stat.mtime.getTime() === expectedTime;
      if (!unchanged) result.stalePaths.push(inputPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") result.stalePaths.push(inputPath);
      else result.unknownPaths.push(inputPath);
    }
  }
  result.status = result.stalePaths.length ? "stale" : result.unknownPaths.length ? "unknown" : "fresh";
  if (result.stalePaths.length) result.warnings.push(`Checkpoint inputs changed or disappeared: ${result.stalePaths.join(", ")}. Reconcile affected decisions before resuming.`);
  if (result.unknownPaths.length) result.warnings.push(`Checkpoint input freshness cannot be verified: ${result.unknownPaths.join(", ")}. Refresh these inputs before resuming.`);
  return result;
}
