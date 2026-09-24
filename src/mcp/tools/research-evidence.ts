import { assertCodebasePublicationComplete } from "./artifacts.js";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { resolveRepoRelativeInputPathSync, safeJsonParseObject } from "../../shared/security.js";
import { blueprintConfigGet } from "./config.js";
import { hashPortableProviderMemberSets, portableProviderEvidenceBasisSchema, type PortableProviderEvidenceBasis } from "../codebase-index/provider-evidence.js";
import { readHardenedLiteralFile } from "../codebase-index/literal-read.js";

export type ResearchReadSet = Array<{ path: string; hash: string | null }>;
export const researchDigest = (value: string | Buffer | Uint8Array) => createHash("sha256").update(value).digest("hex");
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

async function portableBasisFreshness(root: string, basis: PortableProviderEvidenceBasis) {
  const parsed = portableProviderEvidenceBasisSchema.safeParse(basis);
  if (!parsed.success) return {status: "unknown" as const, stalePaths: [] as string[], unknownPaths: ["portable"]};
  const value = parsed.data;
  const receipt = value.pinReceipt ?? value.trustedPins.find(item => item.pin.generationId === value.generationId)?.receipt;
  if (!receipt) return {status: "unknown" as const, stalePaths: [] as string[], unknownPaths: ["portable"]};
  const memberName = (member: {path: string; generationId: string}) => {
    const mapPath = member.path.startsWith(".blueprint/codebase/")
      ? member.path.slice(".blueprint/codebase/".length)
      : member.path;
    const prefix = `generations/${member.generationId}/`;
    return mapPath.startsWith(prefix) ? mapPath.slice(prefix.length) : mapPath;
  };
  const memberNames = [...new Set([
    "ENTRY.md",
    "manifest.json",
    ...value.readSet.sourceAndPage.filter(item => item.kind === "page").map(item => memberName({path: item.path, generationId: item.generation})),
    ...value.readSet.sealedMembers.map(memberName)
  ])];
  const members = await hashPortableProviderMemberSets(root, [{receipt, pin: value.pin, members: memberNames}]);
  if (members.status !== "ok") return {status: "unknown" as const, stalePaths: [] as string[], unknownPaths: ["portable"]};
  const generationPrefix = `generations/${value.generationId}/`;
  const expectedMembers = new Map<string, string>([
    [`${generationPrefix}ENTRY.md`, value.pin.entry.sha256],
    [`${generationPrefix}manifest.json`, value.pin.manifest.sha256],
    ...value.readSet.sourceAndPage.filter(item => item.kind === "page").map(item => [`${generationPrefix}${memberName({path: item.path, generationId: item.generation})}`, item.hash] as const),
    ...value.readSet.sealedMembers.map(member => {
      return [`${generationPrefix}${memberName(member)}`, member.sha256] as const;
    })
  ]);
  if (members.members.some(member => expectedMembers.get(member.path) !== member.sha256)) {
    return {status: "unknown" as const, stalePaths: [] as string[], unknownPaths: ["portable"]};
  }
  const stalePaths: string[] = [];
  const unknownPaths: string[] = [];
  await Promise.all(value.readSet.sourceAndPage.map(async item => {
    if (item.kind === "page") return;
    if (item.path.startsWith("@")) {
      unknownPaths.push(item.path);
      return;
    }
    try {
      const read = await readHardenedLiteralFile(root, item.path, 128 * 1024 * 1024);
      if (!read.ok) {
        unknownPaths.push(item.path);
        return;
      }
      if (researchDigest(read.bytes) !== (item.fullFileHash ?? item.hash)) stalePaths.push(item.path);
    } catch {
      unknownPaths.push(item.path);
    }
  }));
  stalePaths.sort();
  unknownPaths.sort();
  return {status: stalePaths.length ? "stale" as const : unknownPaths.length ? "unknown" as const : "fresh" as const, stalePaths, unknownPaths};
}

export async function researchBasisFreshness(root: string, readSet: ResearchReadSet, portableBasis?: PortableProviderEvidenceBasis) {
  const stalePaths: string[] = [];
  const unknownPaths: string[] = [];
  if (!readSet.length) unknownPaths.push("readSet");
  await Promise.all(readSet.map(async item => {
    try {
      if (await researchInputHash(root, item.path) !== item.hash) stalePaths.push(item.path);
    } catch { unknownPaths.push(item.path); }
  }));
  if (portableBasis) {
    const portable = await portableBasisFreshness(root, portableBasis);
    stalePaths.push(...portable.stalePaths);
    unknownPaths.push(...portable.unknownPaths);
  }
  stalePaths.sort(); unknownPaths.sort();
  return { status: stalePaths.length ? "stale" as const : unknownPaths.length ? "unknown" as const : "fresh" as const, stalePaths, unknownPaths };
}

export function researchProvenancePath(researchPath: string) {
  if (!researchPath.endsWith("-RESEARCH.md")) throw new Error("Invalid research artifact path.");
  return researchPath.replace(/-RESEARCH\.md$/, "-RESEARCH-PROVENANCE.json");
}

export type ResearchProvenance = { version: 1; researchHash: string; readSet: ResearchReadSet; publishedAt: string; planningReady?: boolean; portable?: PortableProviderEvidenceBasis };

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
    }) || parsed.portable !== undefined && !portableProviderEvidenceBasisSchema.safeParse(parsed.portable).success) throw new Error("Invalid research provenance.");
    if (await researchInputHash(root, researchPath) !== parsed.researchHash)
      return { status: "stale" as const, stalePaths: [researchPath], unknownPaths: [] as string[], reason: "Research content changed after publication." };
    return { ...await researchBasisFreshness(root, parsed.readSet as ResearchReadSet, parsed.portable as PortableProviderEvidenceBasis | undefined), reason: null, ...(typeof parsed.planningReady === "boolean" ? { planningReady: parsed.planningReady } : {}) };
  } catch (error) {
    return { status: "unknown" as const, stalePaths: [] as string[], unknownPaths: [researchProvenancePath(researchPath)], reason: (error as Error).message };
  }
}
