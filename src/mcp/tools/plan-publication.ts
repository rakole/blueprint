import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type PlanPublicationStatus = {
  status: "absent" | "pending" | "committed" | "invalid";
  token: string;
  reason: string | null;
};

export type PlanPublicationFile = { path: string; hash: string };

export type PlanPublicationSnapshot = PlanPublicationStatus & {
  version: 1 | 2 | null;
  files: readonly PlanPublicationFile[];
  removedPaths: readonly string[];
  /** Exact decoded bytes whose hashes were checked against a v2 committed receipt. */
  contents: ReadonlyMap<string, string> | null;
};

export type PlanLifecycleOwnership = {
  hasSession: boolean;
  ownsPublication: boolean;
  token: string;
  reason: string | null;
};

/** Metadata-only ownership inference used while older sessions gain the durable flag. */
export function planSessionOwnsPublication(data: Record<string, unknown>): boolean {
  const migratedPlanInventoryOwnsPublication = data.publicationOwned === undefined && data.version === 2 &&
    Array.isArray(data.targets) && data.targets.length > 0 &&
    Array.isArray(data.existingPlans) && data.existingPlans.length > 0;
  const historyOwnsPublication = data.version === 1 && Array.isArray(data.history) && data.history.some(entry =>
    Boolean(entry && typeof entry === "object" && "journal" in entry && entry.journal && typeof entry.journal === "object"));
  const requestsOwnPublication = data.requests && typeof data.requests === "object" && !Array.isArray(data.requests) &&
    Object.values(data.requests).some(request => Boolean(request && typeof request === "object" &&
      "receipt" in request && request.receipt && typeof request.receipt === "object" &&
      "status" in request.receipt && request.receipt.status === "published"));
  return data.publicationOwned === true ||
    Boolean(data.journal && typeof data.journal === "object") ||
    Boolean(data.legacyPublication && typeof data.legacyPublication === "object") ||
    data.needsIntent === true ||
    migratedPlanInventoryOwnsPublication ||
    historyOwnsPublication ||
    Boolean(requestsOwnPublication);
}

const digest = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

function invalidSnapshot(
  reason: string,
  token = "invalid",
  details: Pick<PlanPublicationSnapshot, "version" | "files" | "removedPaths"> = {
    version: null,
    files: [],
    removedPaths: []
  }
): PlanPublicationSnapshot {
  return { status: "invalid", token, reason, ...details, contents: null };
}

function scopeIsValid(phaseDir: string, phasePrefix: string): boolean {
  return /^\.blueprint\/phases\/[^/]+$/.test(phaseDir) &&
    !phaseDir.split("/").some(part => part === "." || part === "..") &&
    /^\d+(?:\.\d+)*$/.test(phasePrefix);
}

async function containedRegularFile(
  projectRoot: string,
  absolutePath: string,
  maxBytes: number
): Promise<{ ok: true } | { ok: false; missing: boolean; reason: string }> {
  try {
    const stat = await fs.lstat(absolutePath);
    if (!stat.isFile() || stat.size > maxBytes) {
      return { ok: false, missing: false, reason: "must be a bounded regular file" };
    }
    const [realParent, realRoot] = await Promise.all([
      fs.realpath(path.dirname(absolutePath)),
      fs.realpath(projectRoot)
    ]);
    const relative = path.relative(realRoot, realParent);
    if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
      return { ok: false, missing: false, reason: "escapes the repository" };
    }
    return { ok: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, missing: true, reason: "is missing" };
    }
    return { ok: false, missing: false, reason: "cannot be inspected" };
  }
}

/**
 * Inspect only metadata needed to decide whether a missing marker is safe.
 * No draft, plan body, review prose, or diagnostic payload is retained or returned.
 */
export async function readPlanLifecycleOwnership(
  projectRoot: string,
  phaseDir: string,
  phasePrefix: string
): Promise<PlanLifecycleOwnership> {
  if (!scopeIsValid(phaseDir, phasePrefix)) {
    return { hasSession: true, ownsPublication: true, token: "invalid-scope", reason: "Invalid plan publication scope." };
  }
  const sessionPath = path.join(projectRoot, phaseDir, `${phasePrefix}-PLAN-SESSION.json`);
  const inspected = await containedRegularFile(projectRoot, sessionPath, 32 * 1024 * 1024);
  if (!inspected.ok) {
    if (inspected.missing) return { hasSession: false, ownsPublication: false, token: "missing", reason: null };
    return {
      hasSession: true,
      ownsPublication: true,
      token: "invalid-session",
      reason: `Plan lifecycle session ${inspected.reason}; resume planning before reading or writing plans.`
    };
  }
  let raw: string;
  try {
    raw = await fs.readFile(sessionPath, "utf8");
  } catch {
    return { hasSession: true, ownsPublication: true, token: "unreadable-session", reason: "Cannot verify plan lifecycle session ownership; resume planning before reading or writing plans." };
  }
  const token = digest(raw);
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { hasSession: true, ownsPublication: true, token, reason: "Plan lifecycle session is malformed; resume planning before reading or writing plans." };
  }
  if (!data || typeof data !== "object" || (data.version !== 1 && data.version !== 2)) {
    return { hasSession: true, ownsPublication: true, token, reason: "Plan lifecycle session version is unsupported; resume planning before reading or writing plans." };
  }
  if (Object.hasOwn(data, "publicationOwned") && typeof data.publicationOwned !== "boolean") {
    return { hasSession: true, ownsPublication: true, token, reason: "Plan lifecycle publication ownership metadata is malformed; resume planning before reading or writing plans." };
  }
  const ownsPublication = planSessionOwnsPublication(data);
  return { hasSession: true, ownsPublication, token, reason: null };
}

async function verifyCommittedPublication(
  projectRoot: string,
  phaseDir: string,
  canonicalPlan: (value: unknown) => value is string,
  files: PlanPublicationFile[],
  removedPaths: string[]
): Promise<{ issue: string | null; contents: ReadonlyMap<string, string> | null }> {
  const expectedPaths = new Set(files.map(file => file.path));
  const removed = new Set(removedPaths);
  if (expectedPaths.size !== files.length || removed.size !== removedPaths.length ||
      files.some(file => removed.has(file.path))) {
    return { issue: "Plan publication marker contains conflicting or duplicate targets.", contents: null };
  }

  const phasePath = path.join(projectRoot, phaseDir);
  const actualPaths = (await fs.readdir(phasePath, { withFileTypes: true }))
    .map(entry => `${phaseDir}/${entry.name}`)
    .filter(canonicalPlan);
  if (actualPaths.length !== expectedPaths.size || actualPaths.some(planPath => !expectedPaths.has(planPath))) {
    return {
      issue: "Committed plan publication receipt no longer matches the canonical plan inventory; resume planning and reconcile the observed targets.",
      contents: null
    };
  }

  const contents = new Map<string, string>();
  for (const file of files) {
    const absolutePath = path.join(projectRoot, file.path);
    let stat;
    try {
      stat = await fs.lstat(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { issue: "A committed plan is missing; resume planning and reconcile the observed targets.", contents: null };
      }
      throw error;
    }
    if (!stat.isFile()) {
      return { issue: "A committed plan is not a regular file; resume planning and reconcile the observed targets.", contents: null };
    }
    const bytes = await fs.readFile(absolutePath);
    if (digest(bytes) !== file.hash) {
      return { issue: "A committed plan changed after publication; resume planning and reconcile the observed targets.", contents: null };
    }
    contents.set(file.path, bytes.toString("utf8"));
  }

  for (const removedPath of removedPaths) {
    try {
      await fs.lstat(path.join(projectRoot, removedPath));
      return { issue: "A removed plan reappeared after publication; resume planning and reconcile the observed targets.", contents: null };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return { issue: null, contents };
}

/**
 * Read one guarded publication generation. Version 1 committed markers were
 * delta receipts, so they require explicit target-hash reconciliation. Version
 * 2 markers bind the complete canonical plan inventory and exact consumed bytes.
 */
export async function readPlanPublicationSnapshot(
  projectRoot: string,
  phaseDir: string,
  phasePrefix: string,
  options: { allowOwnedMissing?: boolean } = {}
): Promise<PlanPublicationSnapshot> {
  if (!scopeIsValid(phaseDir, phasePrefix)) return invalidSnapshot("Invalid plan publication scope.");
  const marker = path.join(projectRoot, phaseDir, `${phasePrefix}-PLAN-PUBLICATION.json`);
  const inspected = await containedRegularFile(projectRoot, marker, 1024 * 1024);
  if (!inspected.ok) {
    if (!inspected.missing) return invalidSnapshot(`Plan publication marker ${inspected.reason}.`);
    if (options.allowOwnedMissing) {
      return { status: "absent", token: "missing", reason: null, version: null, files: [], removedPaths: [], contents: null };
    }
    const ownership = await readPlanLifecycleOwnership(projectRoot, phaseDir, phasePrefix);
    if (ownership.ownsPublication) {
      return invalidSnapshot(
        ownership.reason ?? "Plan publication marker is missing for a lifecycle-owned plan set; resume planning and reconcile the observed targets.",
        `missing:${ownership.token}`
      );
    }
    return { status: "absent", token: "missing", reason: null, version: null, files: [], removedPaths: [], contents: null };
  }

  let raw: string;
  try {
    raw = await fs.readFile(marker, "utf8");
  } catch {
    return invalidSnapshot("Cannot read plan publication marker.");
  }
  const token = digest(raw);
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return invalidSnapshot("Plan publication marker is malformed; resume planning before execution.", token);
  }
  const canonicalPlan = (value: unknown): value is string => typeof value === "string" &&
    path.posix.dirname(value) === phaseDir &&
    new RegExp(`^${phasePrefix.replace(/\./g, "\\.")}-\\d+-PLAN\\.md$`).test(path.posix.basename(value));
  if (!data || typeof data !== "object" || (data.version !== 1 && data.version !== 2) ||
      typeof data.status !== "string" || !["pending", "committed"].includes(data.status) ||
      typeof data.requestId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(data.requestId) ||
      !Number.isSafeInteger(data.revision) || Number(data.revision) < 0 ||
      !Array.isArray(data.files) || !data.files.every(file => file &&
        typeof file === "object" && canonicalPlan(file.path) && typeof file.hash === "string" && /^[a-f0-9]{64}$/.test(file.hash)) ||
      !Array.isArray(data.removedPaths) || !data.removedPaths.every(canonicalPlan)) {
    return invalidSnapshot("Plan publication marker is invalid; resume planning before execution.", token);
  }
  const version = data.version as 1 | 2;
  const files = data.files as PlanPublicationFile[];
  const removedPaths = data.removedPaths as string[];
  const details = { version, files, removedPaths };
  if (data.status === "pending") {
    return {
      status: "pending",
      token,
      reason: version === 1
        ? "Legacy plan publication is incomplete; retry its owning submit or explicitly reconcile the observed targets."
        : "Plan publication is incomplete; resume /blu-plan-phase before execution.",
      ...details,
      contents: null
    };
  }
  if (version === 1) {
    return invalidSnapshot(
      "Legacy v1 plan publication records only changed targets; explicitly reconcile the complete observed target hashes before execution.",
      token,
      details
    );
  }

  try {
    const verified = await verifyCommittedPublication(projectRoot, phaseDir, canonicalPlan, files, removedPaths);
    if (verified.issue) return invalidSnapshot(verified.issue, token, details);
    const afterRaw = await fs.readFile(marker, "utf8");
    if (digest(afterRaw) !== token) {
      return invalidSnapshot("Plan publication changed during capture of its committed bytes; refresh before execution.", token, details);
    }
    return { status: "committed", token, reason: null, ...details, contents: verified.contents };
  } catch {
    return invalidSnapshot("Cannot verify committed plan publication files; resume planning before execution.", token, details);
  }
}

export function planPublicationConsumptionIssue(
  snapshot: PlanPublicationSnapshot,
  consumed: ReadonlyMap<string, string>,
  options: { complete: boolean }
): string | null {
  if (snapshot.status === "pending" || snapshot.status === "invalid") {
    return snapshot.reason ?? "Phase plan publication is incomplete; resume planning before execution.";
  }
  if (snapshot.status === "absent") return null;
  if (snapshot.version !== 2 || !snapshot.contents) {
    return "Committed plan publication bytes could not be verified; resume planning before execution.";
  }
  const expected = new Map(snapshot.files.map(file => [file.path, file.hash]));
  if (options.complete && consumed.size !== expected.size) {
    return "The consumed plan inventory does not match the committed publication receipt.";
  }
  for (const [planPath, content] of consumed) {
    if (digest(content) !== expected.get(planPath)) {
      return `Consumed plan bytes do not match the committed publication receipt: ${planPath}.`;
    }
  }
  return null;
}

export async function readPlanPublicationStatus(
  projectRoot: string,
  phaseDir: string,
  phasePrefix: string,
  options: { allowOwnedMissing?: boolean } = {}
): Promise<PlanPublicationStatus> {
  const { status, token, reason } = await readPlanPublicationSnapshot(projectRoot, phaseDir, phasePrefix, options);
  return { status, token, reason };
}
