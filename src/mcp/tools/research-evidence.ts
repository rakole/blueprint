import { assertCodebasePublicationComplete } from "./artifacts.js";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveRepoRelativeInputPathSync, safeJsonParseObject } from "../../shared/security.js";
import { blueprintConfigGet } from "./config.js";

export type ResearchReadSet = Array<{ path: string; hash: string | null }>;
export const researchDigest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const stableResearchValue = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

export function canonicalResearchEvidencePath(root: string, relative: string) {
  return path.relative(root, resolveRepoRelativeInputPathSync(root, relative)).split(path.sep).join("/");
}

export async function readResearchEvidence(root: string, relative: string, maxBytes = 256 * 1024) {
  await assertCodebasePublicationComplete(root, relative);
  const absolute = resolveRepoRelativeInputPathSync(root, relative);
  try {
    const bytes = await fs.readFile(absolute);
    if (bytes.length > maxBytes) throw new Error(`Research evidence exceeds ${maxBytes} bytes: ${relative}. Select a smaller source.`);
    return { path: relative, hash: researchDigest(bytes), content: bytes.toString("utf8") };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { path: relative, hash: null, content: null };
    throw error;
  }
}

export async function researchInputHash(root: string, relative: string): Promise<string | null> {
  if (relative === "@research/effective-config") {
    const config = await blueprintConfigGet({ cwd: root, scope: "effective" });
    return researchDigest(stableResearchValue({ config: config.config, provenance: config.provenance }));
  }
  await assertCodebasePublicationComplete(root, relative);
  try { return researchDigest(await fs.readFile(resolveRepoRelativeInputPathSync(root, relative))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

export async function researchBasisFreshness(root: string, readSet: ResearchReadSet) {
  const stalePaths: string[] = [];
  const unknownPaths: string[] = [];
  if (!readSet.length) unknownPaths.push("readSet");
  await Promise.all(readSet.map(async item => {
    try {
      if (await researchInputHash(root, item.path) !== item.hash) stalePaths.push(item.path);
    } catch { unknownPaths.push(item.path); }
  }));
  stalePaths.sort(); unknownPaths.sort();
  return { status: stalePaths.length ? "stale" as const : unknownPaths.length ? "unknown" as const : "fresh" as const, stalePaths, unknownPaths };
}

export function researchProvenancePath(researchPath: string) {
  if (!researchPath.endsWith("-RESEARCH.md")) throw new Error("Invalid research artifact path.");
  return researchPath.replace(/-RESEARCH\.md$/, "-RESEARCH-PROVENANCE.json");
}

export type ResearchProvenance = { version: 1; researchHash: string; readSet: ResearchReadSet; publishedAt: string; planningReady?: boolean };

export async function readPublishedResearchFreshness(root: string, researchPath: string): Promise<{ status: "fresh" | "stale" | "unknown"; stalePaths: string[]; unknownPaths: string[]; reason: string | null; planningReady?: boolean }> {
  try {
    const evidence = await readResearchEvidence(root, researchProvenancePath(researchPath));
    if (evidence.content === null) {
      const saved = await readResearchEvidence(root, researchPath.replace(/-RESEARCH\.md$/, "-RESEARCH-SESSION.json"), 32 * 1024 * 1024);
      const session = saved.content ? safeJsonParseObject(saved.content, { label: saved.path, maxBytes: 32 * 1024 * 1024 }) : null;
      const journal = session?.journal as { contentHash?: string; stages?: { artifact?: string } } | undefined;
      const legacyPublication = session?.legacyPublication as { contentHash?: string } | undefined;
      const publishedHash = await researchInputHash(root, researchPath);
      const incomplete = Boolean(journal?.stages?.artifact && journal.contentHash === publishedHash || legacyPublication?.contentHash && legacyPublication.contentHash === publishedHash);
      return { status: "unknown" as const, stalePaths: [] as string[], unknownPaths: [incomplete ? "publication" : "provenance"], reason: incomplete ? "Research session has not published source provenance." : "Legacy research has no recorded input fingerprints; review before reuse." };
    }
    const parsed = safeJsonParseObject(evidence.content, { label: evidence.path });
    if (parsed.version !== 1 || (parsed.planningReady !== undefined && typeof parsed.planningReady !== "boolean") || typeof parsed.researchHash !== "string" || !/^[a-f0-9]{64}$/.test(parsed.researchHash) || !Array.isArray(parsed.readSet) || parsed.readSet.length > 100 || !parsed.readSet.every((r: unknown) => {
      const x = r as { path?: unknown; hash?: unknown } | null;
      return x && typeof x.path === "string" && (x.hash === null || typeof x.hash === "string" && /^[a-f0-9]{64}$/.test(x.hash));
    })) throw new Error("Invalid research provenance.");
    if (await researchInputHash(root, researchPath) !== parsed.researchHash)
      return { status: "stale" as const, stalePaths: [researchPath], unknownPaths: [] as string[], reason: "Research content changed after publication." };
    return { ...await researchBasisFreshness(root, parsed.readSet as ResearchReadSet), reason: null, ...(typeof parsed.planningReady === "boolean" ? { planningReady: parsed.planningReady } : {}) };
  } catch (error) {
    return { status: "unknown" as const, stalePaths: [] as string[], unknownPaths: [researchProvenancePath(researchPath)], reason: (error as Error).message };
  }
}
