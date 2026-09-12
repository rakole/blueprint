import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type PlanPublicationStatus = {
  status: "absent" | "pending" | "committed" | "invalid";
  token: string;
  reason: string | null;
};

/** Readers compare tokens before and after a read to reject mixed generations. */
export async function readPlanPublicationStatus(
  projectRoot: string,
  phaseDir: string,
  phasePrefix: string
): Promise<PlanPublicationStatus> {
  const invalid = (reason: string, token = "invalid"): PlanPublicationStatus => ({
    status: "invalid", token, reason
  });
  if (!/^\.blueprint\/phases\/[^/]+$/.test(phaseDir) ||
      phaseDir.split("/").some(part => part === "." || part === "..") || !/^\d+(?:\.\d+)*$/.test(phasePrefix)) {
    return invalid("Invalid plan publication scope.");
  }
  const marker = path.join(projectRoot, phaseDir, `${phasePrefix}-PLAN-PUBLICATION.json`);
  try {
    const stat = await fs.lstat(marker);
    if (!stat.isFile() || stat.size > 1024 * 1024) {
      return invalid("Plan publication marker must be a bounded regular file.");
    }
    const [realParent, realRoot] = await Promise.all([
      fs.realpath(path.dirname(marker)), fs.realpath(projectRoot)
    ]);
    const relative = path.relative(realRoot, realParent);
    if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
      return invalid("Plan publication marker escapes the repository.");
    }
    const raw = await fs.readFile(marker, "utf8");
    const token = createHash("sha256").update(raw).digest("hex");
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      return invalid("Plan publication marker is malformed; resume planning before execution.", token);
    }
    const canonicalPlan = (value: unknown): value is string => typeof value === "string" &&
      path.posix.dirname(value) === phaseDir &&
      new RegExp(`^${phasePrefix.replace(/\./g, "\\.")}-\\d+-PLAN\\.md$`).test(path.posix.basename(value));
    if (!data || typeof data !== "object" || data.version !== 1 ||
        typeof data.status !== "string" || !["pending", "committed"].includes(data.status) ||
        typeof data.requestId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(data.requestId) ||
        !Number.isSafeInteger(data.revision) || Number(data.revision) < 0 ||
        !Array.isArray(data.files) || !data.files.every(file => file &&
          typeof file === "object" && canonicalPlan(file.path) && typeof file.hash === "string" && /^[a-f0-9]{64}$/.test(file.hash)) ||
        !Array.isArray(data.removedPaths) || !data.removedPaths.every(canonicalPlan)) {
      return invalid("Plan publication marker is invalid; resume planning before execution.", token);
    }
    return {
      status: data.status as "pending" | "committed", token,
      reason: data.status === "pending"
        ? "Plan publication is incomplete; resume /blu-plan-phase before execution."
        : null
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "absent", token: "missing", reason: null };
    }
    return invalid(`Cannot read plan publication marker: ${(error as Error).message}`);
  }
}
