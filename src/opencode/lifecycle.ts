import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rmdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { parseDocument } from "yaml";

import { loadBlueprintNativeAssets } from "./assets.js";
import { withDirectoryLock } from "../mcp/directory-lock.js";

export const BLUEPRINT_STATE_COMPATIBILITY = "blueprint-state-v1";

export type LifecycleAction = "install" | "upgrade" | "rollback" | "uninstall" | "status";
export type OpenCodeLifecycleAction = LifecycleAction;
export type LifecycleStep =
  | "beforeJournalWrite"
  | "afterJournalWrite"
  | "afterConfigWrite"
  | "afterLedgerWrite"
  | "afterReceiptWrite"
  | "afterActivation";

export type LifecycleCleanupKind =
  | "config"
  | "generation"
  | "receipt"
  | "launcher"
  | "ledger"
  | "transactionJournal"
  | "generationsDirectory"
  | "receiptsDirectory"
  | "installRoot"
  | "cleanupJournal";

export type LifecycleGeneration = {
  generationId: string;
  packageRoot: string;
  sourceSpec: string;
  stateCompatibility: string;
  version: string;
};

export type OpenCodeLifecycleResult = {
  action: LifecycleAction;
  active: LifecycleGeneration | null;
  previous: LifecycleGeneration | null;
  registration: string | null;
  status: "configured" | "not-installed";
};

export type PackageInstaller = (input: {
  packageSpec: string;
  stagingPrefix: string;
  env: NodeJS.ProcessEnv;
}) => Promise<{ packageRoot: string }>;

export type OpenCodeLifecycleDependencies = {
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  randomId?: () => string;
  packageInstaller?: PackageInstaller;
  allowRegistryPackageSpec?: boolean;
  validatePackageAssets?: boolean;
  onStep?: (step: LifecycleStep) => Promise<void> | void;
  beforeCleanup?: (targetPath: string, kind: LifecycleCleanupKind) => Promise<void> | void;
  lockOptions?: { timeoutMs?: number; pollMs?: number; staleMs?: number };
};

export type OpenCodeLifecycleInput = {
  action: LifecycleAction;
  configPath: string;
  cwd?: string;
  packageSpec?: string;
};

type Ledger = {
  schemaVersion: 1;
  configPath: string;
  registration: string;
  active: LifecycleGeneration | null;
  previous: LifecycleGeneration | null;
  ownedConfigHash: string | null;
  cwd: string | null;
  configCreated: boolean;
};

type TransactionJournal = {
  schemaVersion: 1;
  beforeConfigBase64: string;
  beforeConfigExisted: boolean;
  beforeConfigMode: number;
  afterConfigHash: string;
  beforeLedgerBase64: string | null;
  afterLedgerHash: string;
  createdGenerationRoot: string | null;
  createdGenerationEntries: ReceiptEntry[] | null;
};

type ReceiptEntry = { path: string; type: "directory" | "file"; sha256?: string };
type Receipt = { schemaVersion: 1; generationId: string; entries: ReceiptEntry[] };

type CleanupGeneration = {
  generation: LifecycleGeneration;
  entries: ReceiptEntry[];
};

type CleanupJournal = {
  schemaVersion: 1;
  action: "retire" | "uninstall";
  generations: CleanupGeneration[];
  allowedGenerationIds: string[];
  retainedGenerationIds: string[];
  expectedLedgerHash: string;
  removeConfigIfHash: string | null;
};

type ParsedSemver = {
  core: [bigint, bigint, bigint];
  prerelease: Array<bigint | string> | null;
};

const execFileAsync = promisify(execFile);

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isContained(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function exists(candidate: string): Promise<boolean> {
  return access(candidate, constants.F_OK).then(() => true, () => false);
}

async function writeAtomic(filePath: string, contents: string, mode?: number): Promise<void> {
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(temporary, contents, mode === undefined ? undefined : { mode });
    await rename(temporary, filePath);
    if (mode !== undefined) await chmod(filePath, mode);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

function parseStrictSemver(value: string, source: string): ParsedSemver {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(value);
  if (!match) {
    throw new Error(`${source} must be an exact semantic version without build metadata`);
  }
  const prerelease = match[4]?.split(".").map((identifier): bigint | string => {
    if (/^\d+$/.test(identifier)) {
      if (identifier.length > 1 && identifier.startsWith("0")) {
        throw new Error(`${source} contains a numeric prerelease identifier with a leading zero`);
      }
      return BigInt(identifier);
    }
    return identifier;
  }) ?? null;
  return {
    core: [BigInt(match[1]!), BigInt(match[2]!), BigInt(match[3]!)],
    prerelease
  };
}

async function parseStrictObject(contents: string, source: string): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`${source} must be strict JSON: ${(error as Error).message}`);
  }
  const document = parseDocument(contents, { uniqueKeys: true, strict: true });
  if (document.errors.length > 0) {
    throw new Error(`${source} contains a duplicate key: ${document.errors[0]!.message}`);
  }
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${source} must contain a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function assertAbsolute(name: string, value: string | undefined): string {
  if (!value || !path.isAbsolute(value)) throw new Error(`${name} must be an absolute path`);
  return path.resolve(value);
}

function validatePackageSpec(spec: string): void {
  if (path.isAbsolute(spec)) return;
  const match = /^blueprint@(.+)$/.exec(spec);
  if (!match) {
    throw new Error("--package must be an absolute tarball path or blueprint@exact-semver");
  }
  parseStrictSemver(match[1]!, "--package version");
}

function assertNoReservedConfig(config: Record<string, unknown>, ownedRegistration?: string, requireOwned = true): void {
  const plugins = config.plugin;
  if (plugins !== undefined && (!Array.isArray(plugins) || plugins.some((entry) => typeof entry !== "string"))) {
    throw new Error("OpenCode config plugin must be an array of strings");
  }
  for (const entry of (plugins ?? []) as string[]) {
    if (/blueprint/i.test(entry) && entry !== ownedRegistration) throw new Error(`Foreign Blueprint plugin registration is not owned: ${entry}`);
  }
  if (ownedRegistration && requireOwned && (plugins as string[]).filter((entry) => entry === ownedRegistration).length !== 1) {
    throw new Error("Owned Blueprint plugin registration is missing or duplicated");
  }
  const namespaces: Array<[string, unknown, (key: string) => boolean]> = [
    ["mcp.blueprint", config.mcp, (key) => key === "blueprint"],
    ["command.blu*", config.command, (key) => key === "blu" || key.startsWith("blu-")],
    ["agent.blueprint*", config.agent, (key) => key === "blueprint" || key.startsWith("blueprint-")]
  ];
  for (const [label, value, reserved] of namespaces) {
    if (value === undefined) continue;
    if (value === null || Array.isArray(value) || typeof value !== "object") {
      throw new Error(`${label.split(".")[0]} must be an object`);
    }
    const conflicting = Object.keys(value).find(reserved);
    if (conflicting) throw new Error(`Reserved OpenCode namespace conflict at ${label.split(".")[0]}.${conflicting}`);
  }
}

function locateRootPlugin(contents: string): { open: number; close: number; itemRanges: Array<[number, number]>; rootClose: number } {
  const document = parseDocument(contents, { uniqueKeys: true, strict: true }) as any;
  const root = document.contents;
  if (!root || !Array.isArray(root.items) || !Array.isArray(root.range)) throw new Error("OpenCode config must be a JSON object");
  const pair = root.items.find((item: any) => item?.key?.value === "plugin");
  const rootClose = root.range[1] - 1;
  if (!pair) return { open: -1, close: -1, itemRanges: [], rootClose };
  const sequence = pair.value;
  if (!sequence?.flow || !Array.isArray(sequence.items) || !Array.isArray(sequence.range)) throw new Error("plugin must be an array");
  return {
    open: sequence.range[0],
    close: sequence.range[1] - 1,
    itemRanges: sequence.items.map((item: any) => [item.range[0], item.range[1]]),
    rootClose
  };
}

function addRegistration(contents: string, registration: string): string {
  const config = JSON.parse(contents) as Record<string, unknown>;
  const plugins = (config.plugin ?? []) as string[];
  if (plugins.includes(registration)) return contents;
  const bounds = locateRootPlugin(contents);
  const literal = JSON.stringify(registration);
  if (bounds.open >= 0) {
    const body = contents.slice(bounds.open + 1, bounds.close);
    const lineStart = contents.lastIndexOf("\n", bounds.close) + 1;
    const closingIndent = contents.slice(lineStart, bounds.close).match(/^\s*/)?.[0] ?? "";
    const itemIndent = `${closingIndent}  `;
    if (body.trim() === "") {
      return `${contents.slice(0, bounds.open + 1)}\n${itemIndent}${literal}\n${closingIndent}${contents.slice(bounds.close)}`;
    }
    const trailingWhitespace = body.match(/\s*$/)?.[0] ?? "";
    const substantive = body.slice(0, body.length - trailingWhitespace.length);
    return `${contents.slice(0, bounds.open + 1)}${substantive},\n${itemIndent}${literal}${trailingWhitespace}${contents.slice(bounds.close)}`;
  }
  const close = bounds.rootClose;
  if (close < 0) throw new Error("OpenCode config object is not closed");
  const before = contents.slice(0, close);
  const hasProperties = Object.keys(config).length > 0;
  const rootIndent = before.match(/\n([ \t]*)[^\n]*$/)?.[1] ?? "";
  const insertion = `${hasProperties ? "," : ""}\n${rootIndent}  \"plugin\": [\n${rootIndent}    ${literal}\n${rootIndent}  ]\n${rootIndent}`;
  return `${before.replace(/\s*$/, "")}${insertion}${contents.slice(close)}`;
}

function removeRegistration(contents: string, registration: string): string {
  const config = JSON.parse(contents) as Record<string, unknown>;
  const plugins = config.plugin as string[] | undefined;
  if (!plugins?.includes(registration)) throw new Error("Owned Blueprint plugin registration is missing or changed");
  const bounds = locateRootPlugin(contents);
  if (bounds.open < 0) throw new Error("Owned Blueprint plugin array is missing");
  const body = contents.slice(bounds.open + 1, bounds.close);
  const index = plugins.indexOf(registration);
  if (index < 0 || plugins.lastIndexOf(registration) !== index || !bounds.itemRanges[index]) {
    throw new Error("Owned Blueprint plugin registration is ambiguous");
  }
  let start = bounds.itemRanges[index]![0] - bounds.open - 1;
  let end = bounds.itemRanges[index]![1] - bounds.open - 1;
  const before = body.slice(0, start);
  const after = body.slice(end);
  const precedingComma = before.match(/,\s*$/);
  const followingComma = after.match(/^\s*,/);
  if (followingComma) {
    const lineStart = before.lastIndexOf("\n") + 1;
    if (/^\s*$/.test(before.slice(lineStart))) start = lineStart;
    end += followingComma[0].length;
    if (body[end] === "\n") end += 1;
  }
  else if (precedingComma) start -= precedingComma[0].length;
  else {
    start = 0;
    end = body.length;
  }
  return `${contents.slice(0, bounds.open + 1)}${body.slice(0, start)}${body.slice(end)}${contents.slice(bounds.close)}`;
}

async function canonicalProspective(candidate: string): Promise<string> {
  const suffix: string[] = [];
  let cursor = path.resolve(candidate);
  while (!(await exists(cursor))) {
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    suffix.unshift(path.basename(cursor));
    cursor = parent;
  }
  return path.join(await realpath(cursor), ...suffix);
}

async function assertRootIsolation(installerRoot: string, configPath: string, cwd: string | undefined, env: NodeJS.ProcessEnv): Promise<void> {
  const roots: Array<[string, string]> = [];
  if (cwd) roots.push(["project .blueprint", path.join(cwd, ".blueprint")]);
  const home = env.HOME?.trim() || os.homedir();
  const defaultGlobal = path.join(env.XDG_DATA_HOME?.trim() || path.join(home, ".local", "share"), "opencode", "blueprint");
  roots.push(["BLUEPRINT_GLOBAL_HOME", env.BLUEPRINT_GLOBAL_HOME?.trim() || defaultGlobal]);
  const canonicalInstaller = await canonicalProspective(installerRoot);
  for (const [label, candidate] of roots) {
    const canonicalCandidate = await canonicalProspective(candidate);
    if (isContained(canonicalInstaller, canonicalCandidate) || isContained(canonicalCandidate, canonicalInstaller)) {
      throw new Error(`Installer root may not overlap or alias ${label}`);
    }
    const canonicalConfig = await canonicalProspective(configPath);
    if (isContained(canonicalCandidate, canonicalConfig)) throw new Error(`OpenCode config may not be inside ${label}`);
  }
}

async function withLifecycleLock<T>(
  lockPath: string,
  options: OpenCodeLifecycleDependencies["lockOptions"],
  callback: () => Promise<T>
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const pollMs = options?.pollMs ?? 25;
  const staleMs = options?.staleMs ?? 120_000;
  return withDirectoryLock({
    lockPath,
    timeoutMs,
    timing: { retryMs: pollMs, staleMs, heartbeatMs: Math.max(10, Math.floor(staleMs / 3)) }
  }, callback);
}

async function assertLiteralContained(root: string, candidate: string): Promise<string> {
  const absoluteRoot = path.resolve(root);
  const absoluteCandidate = path.resolve(candidate);
  const canonicalRoot = await realpath(absoluteRoot);
  if ((await lstat(absoluteCandidate)).isSymbolicLink()) throw new Error(`Installed package path must be literal, not symbolic: ${absoluteCandidate}`);
  const canonical = await realpath(absoluteCandidate);
  if (!isContained(canonicalRoot, canonical)) throw new Error("Installed package root must be a literal contained path");
  return canonical;
}

async function defaultPackageInstaller(input: Parameters<PackageInstaller>[0]): Promise<{ packageRoot: string }> {
  await writeAtomic(path.join(input.stagingPrefix, "package.json"), json({
    name: "blueprint-opencode-generation",
    private: true
  }), 0o600);
  await execFileAsync("npm", [
    "install",
    "--prefix",
    input.stagingPrefix,
    "--omit=dev",
    "--ignore-scripts",
    "--no-bin-links",
    input.packageSpec
  ], { cwd: input.stagingPrefix, env: input.env, maxBuffer: 10 * 1024 * 1024 });
  return { packageRoot: path.join(input.stagingPrefix, "node_modules", "blueprint") };
}

async function readPackageGeneration(
  generationId: string,
  generationRoot: string,
  packageRoot: string,
  sourceSpec: string,
  validateNativeAssets: boolean
): Promise<LifecycleGeneration> {
  const canonicalPackageRoot = await assertLiteralContained(generationRoot, packageRoot);
  const packageJsonPath = path.join(canonicalPackageRoot, "package.json");
  const packageJson = await parseStrictObject(await readFile(packageJsonPath, "utf8"), "Installed package.json");
  if (packageJson.name !== "blueprint") throw new Error("Installed package name must be blueprint");
  if (typeof packageJson.version !== "string") {
    throw new Error("Installed Blueprint package must have an exact semantic version");
  }
  parseStrictSemver(packageJson.version, "Installed Blueprint package version");
  const exportsField = packageJson.exports;
  if (!exportsField || Array.isArray(exportsField) || typeof exportsField !== "object") throw new Error("Installed package exports are missing");
  const exportsObject = exportsField as Record<string, unknown>;
  if (exportsObject["."] !== "./dist/opencode/plugin.js" || exportsObject["./server"] !== "./dist/opencode/plugin.js") {
    throw new Error("Installed package exports . and ./server must resolve to ./dist/opencode/plugin.js");
  }
  const bin = packageJson.bin;
  if (!bin || Array.isArray(bin) || typeof bin !== "object" || (bin as Record<string, unknown>)["blueprint-opencode"] !== "./dist/opencode/lifecycle-cli.js") {
    throw new Error("Installed package must expose the blueprint-opencode lifecycle CLI");
  }
  const blueprint = packageJson.blueprint;
  const compatibility = blueprint && !Array.isArray(blueprint) && typeof blueprint === "object"
    ? (blueprint as Record<string, unknown>).stateCompatibility
    : undefined;
  if (compatibility !== BLUEPRINT_STATE_COMPATIBILITY) throw new Error("Installed package has incompatible Blueprint state compatibility");
  const pluginPath = path.join(canonicalPackageRoot, "dist", "opencode", "plugin.js");
  const cliPath = path.join(canonicalPackageRoot, "dist", "opencode", "lifecycle-cli.js");
  for (const required of [packageJsonPath, pluginPath, ...(validateNativeAssets ? [cliPath] : [])]) {
    const metadata = await lstat(required);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Installed package asset must be a literal file: ${required}`);
  }
  if (validateNativeAssets) await loadBlueprintNativeAssets(canonicalPackageRoot);
  return {
    generationId,
    packageRoot: canonicalPackageRoot,
    sourceSpec,
    stateCompatibility: compatibility,
    version: packageJson.version
  };
}

async function inventory(root: string): Promise<ReceiptEntry[]> {
  const entries: ReceiptEntry[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const name of (await readdir(directory)).sort()) {
      const absolute = path.join(directory, name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      const metadata = await lstat(absolute);
      if (metadata.isSymbolicLink()) throw new Error(`Installed generation contains symbolic link ${relative}`);
      if (metadata.isDirectory()) {
        entries.push({ path: relative, type: "directory" });
        await visit(absolute);
      } else if (metadata.isFile()) {
        entries.push({ path: relative, type: "file", sha256: sha256(await readFile(absolute)) });
      } else {
        throw new Error(`Installed generation contains unsupported entry ${relative}`);
      }
    }
  };
  await visit(root);
  return entries;
}

function assertInventorySubset(actual: ReceiptEntry[], approved: ReceiptEntry[], message: string): void {
  const approvedEntries = new Map(approved.map((entry) => [entry.path, JSON.stringify(entry)]));
  if (actual.some((entry) => approvedEntries.get(entry.path) !== JSON.stringify(entry))) {
    throw new Error(message);
  }
}

async function writeReceipt(receiptPath: string, generationId: string, generationRoot: string): Promise<Receipt> {
  const receipt: Receipt = { schemaVersion: 1, generationId, entries: await inventory(generationRoot) };
  await writeAtomic(receiptPath, json(receipt), 0o600);
  return receipt;
}

async function verifyReceipt(receiptPath: string, generationRoot: string): Promise<Receipt> {
  const expected = JSON.parse(await readFile(receiptPath, "utf8")) as Receipt;
  if (expected.schemaVersion !== 1 || !Array.isArray(expected.entries)) throw new Error("Generation receipt is malformed");
  const actual = await inventory(generationRoot);
  if (JSON.stringify(actual) !== JSON.stringify(expected.entries)) {
    throw new Error("Installed generation has unknown, unexpected, or tampered files; refusing operation");
  }
  return expected;
}

function launcherSource(ledgerPath: string): string {
  return [
    'import { readFile } from "node:fs/promises";',
    'import { pathToFileURL } from "node:url";',
    `const ledgerPath = ${JSON.stringify(ledgerPath)};`,
    "export default async function blueprintLifecycleLauncher(...args) {",
    '  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));',
    '  if (!ledger.active?.packageRoot) throw new Error("Blueprint has no active lifecycle generation");',
    '  const module = await import(pathToFileURL(`${ledger.active.packageRoot}/dist/opencode/plugin.js`).href);',
    '  return module.default(...args);',
    "}",
    ""
  ].join("\n");
}

async function readLedger(ledgerPath: string): Promise<{ ledger: Ledger; raw: string } | null> {
  if (!(await exists(ledgerPath))) return null;
  const raw = await readFile(ledgerPath, "utf8");
  const ledger = JSON.parse(raw) as Ledger;
  if (ledger.schemaVersion !== 1 || typeof ledger.configPath !== "string" || typeof ledger.registration !== "string") {
    throw new Error("Blueprint lifecycle ledger is malformed");
  }
  return { ledger, raw };
}

async function assertSupportedRuntimeState(ledger: Ledger, env: NodeJS.ProcessEnv): Promise<void> {
  const jsonMarkers = [
    ledger.cwd ? path.join(ledger.cwd, ".blueprint", "config.json") : null,
    path.join(env.BLUEPRINT_GLOBAL_HOME?.trim() || path.join(env.XDG_DATA_HOME?.trim() || path.join(env.HOME?.trim() || os.homedir(), ".local", "share"), "opencode", "blueprint"), "defaults.json")
  ].filter((entry): entry is string => entry !== null);
  for (const marker of jsonMarkers) {
    if (!(await exists(marker))) continue;
    const value = await parseStrictObject(await readFile(marker, "utf8"), marker);
    if (value.version !== 2) throw new Error(`${marker} has an unsupported or newer state version`);
  }
  if (ledger.cwd) {
    const statePath = path.join(ledger.cwd, ".blueprint", "STATE.md");
    if (await exists(statePath)) {
      const state = await readFile(statePath, "utf8");
      const frontmatter = /^---\r?\n([\s\S]*?)^---\r?(?:\n|$)/m.exec(state)?.[1];
      const rawVersion = frontmatter?.split(/\r?\n/)
        .map((line) => /^blueprint_state_version:\s*(.+)$/.exec(line.trimEnd())?.[1])
        .find((value): value is string => value !== undefined);
      let version = rawVersion?.trim();
      if (version?.startsWith('"') && version.endsWith('"')) {
        try {
          const parsed = JSON.parse(version) as unknown;
          version = typeof parsed === "string" ? parsed : version;
        } catch {
          version = version.slice(1, -1);
        }
      }
      if (version !== "1.0") throw new Error(`${statePath} has an unsupported or newer compatibility version`);
    }
  }
}

function receiptPathFor(root: string, generationId: string): string {
  assertGenerationId(generationId);
  return path.join(root, "receipts", `${generationId}.json`);
}

function generationRootFor(root: string, generationId: string): string {
  assertGenerationId(generationId);
  return path.join(root, "generations", generationId);
}

function assertGenerationId(generationId: string): void {
  if (!/^[0-9A-Za-z._-]+$/.test(generationId) || generationId === "." || generationId === "..") {
    throw new Error("Lifecycle generation id is malformed");
  }
}

function lifecycleResult(action: LifecycleAction, ledger: Ledger | null): OpenCodeLifecycleResult {
  return {
    action,
    active: ledger?.active ?? null,
    previous: ledger?.previous ?? null,
    registration: ledger?.registration ?? null,
    status: ledger?.active ? "configured" : "not-installed"
  };
}

async function recoverJournal(
  journalPath: string,
  configPath: string,
  ledgerPath: string,
  root: string
): Promise<void> {
  if (!(await exists(journalPath))) return;
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as TransactionJournal;
  if (journal.schemaVersion !== 1) throw new Error("Lifecycle transaction journal is malformed");
  const beforeConfig = Buffer.from(journal.beforeConfigBase64, "base64").toString("utf8");
  const currentConfig = await readFile(configPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (currentConfig !== null && ![sha256(beforeConfig), journal.afterConfigHash].includes(sha256(currentConfig))) {
    throw new Error("OpenCode config changed during interrupted lifecycle transaction; preserving user edits");
  }
  if (currentConfig === null && journal.beforeConfigExisted) throw new Error("OpenCode config disappeared during interrupted lifecycle transaction");
  const currentLedger = await readFile(ledgerPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  const beforeLedger = journal.beforeLedgerBase64 === null
    ? null
    : Buffer.from(journal.beforeLedgerBase64, "base64").toString("utf8");
  const currentLedgerHash = currentLedger === null ? null : sha256(currentLedger);
  const beforeLedgerHash = beforeLedger === null ? null : sha256(beforeLedger);
  if (currentLedgerHash !== beforeLedgerHash && currentLedgerHash !== journal.afterLedgerHash) {
    throw new Error("Lifecycle ledger changed during interrupted transaction; refusing recovery");
  }
  if (!journal.beforeConfigExisted) await rm(configPath, { force: true });
  else if (currentConfig !== beforeConfig) await writeAtomic(configPath, beforeConfig, journal.beforeConfigMode);
  if (beforeLedger === null) await rm(ledgerPath, { force: true });
  else if (currentLedger !== beforeLedger) await writeAtomic(ledgerPath, beforeLedger, 0o600);
  if (journal.createdGenerationRoot) {
    const generationId = path.basename(journal.createdGenerationRoot);
    if (path.resolve(journal.createdGenerationRoot) !== generationRootFor(root, generationId)) {
      throw new Error("Lifecycle journal contains an invalid generation path");
    }
    if (await exists(journal.createdGenerationRoot)) {
      if (!journal.createdGenerationEntries) {
        throw new Error("Interrupted generation contains unknown files; refusing recovery deletion");
      }
      assertInventorySubset(
        await inventory(journal.createdGenerationRoot),
        journal.createdGenerationEntries,
        "Interrupted generation contains unknown files; refusing recovery deletion"
      );
      const receiptPath = receiptPathFor(root, generationId);
      if (await exists(receiptPath)) {
        const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as Receipt;
        if (receipt.generationId !== generationId || JSON.stringify(receipt.entries) !== JSON.stringify(journal.createdGenerationEntries)) {
          throw new Error("Interrupted generation receipt changed; refusing recovery deletion");
        }
      }
      await rm(journal.createdGenerationRoot, { recursive: true, force: true });
      await rm(receiptPath, { force: true });
    }
  }
  if (beforeLedger === null) await rm(path.join(root, "launcher.mjs"), { force: true });
  await rm(journalPath, { force: true });
}

async function writeTransactionJournal(
  journalPath: string,
  beforeConfig: string,
  beforeConfigExisted: boolean,
  beforeConfigMode: number,
  afterConfig: string,
  beforeLedgerRaw: string | null,
  afterLedgerRaw: string,
  createdGenerationRoot: string | null
  , createdGenerationEntries: ReceiptEntry[] | null
): Promise<void> {
  const journal: TransactionJournal = {
    schemaVersion: 1,
    beforeConfigBase64: Buffer.from(beforeConfig).toString("base64"),
    beforeConfigExisted,
    beforeConfigMode,
    afterConfigHash: sha256(afterConfig),
    beforeLedgerBase64: beforeLedgerRaw === null ? null : Buffer.from(beforeLedgerRaw).toString("base64"),
    afterLedgerHash: sha256(afterLedgerRaw),
    createdGenerationRoot,
    createdGenerationEntries
  };
  await writeAtomic(journalPath, json(journal), 0o600);
}

async function validateRecordedGeneration(root: string, generation: LifecycleGeneration): Promise<Receipt> {
  const generationRoot = generationRootFor(root, generation.generationId);
  const receipt = await verifyReceipt(receiptPathFor(root, generation.generationId), generationRoot);
  const observed = await readPackageGeneration(
    generation.generationId,
    generationRoot,
    generation.packageRoot,
    generation.sourceSpec,
    false
  );
  if (JSON.stringify(observed) !== JSON.stringify(generation)) throw new Error("Installed generation metadata was tampered");
  return receipt;
}

async function writeCleanupJournal(cleanupJournalPath: string, journal: CleanupJournal): Promise<void> {
  await writeAtomic(cleanupJournalPath, json(journal), 0o600);
}

function parseCleanupJournal(raw: string): CleanupJournal {
  const journal = JSON.parse(raw) as CleanupJournal;
  if (
    journal.schemaVersion !== 1
    || !["retire", "uninstall"].includes(journal.action)
    || !Array.isArray(journal.generations)
    || !Array.isArray(journal.allowedGenerationIds)
    || !Array.isArray(journal.retainedGenerationIds)
    || typeof journal.expectedLedgerHash !== "string"
    || !(journal.removeConfigIfHash === null || typeof journal.removeConfigIfHash === "string")
  ) {
    throw new Error("Lifecycle cleanup journal is malformed");
  }
  const allowedIds = new Set(journal.allowedGenerationIds);
  const retainedIds = new Set(journal.retainedGenerationIds);
  const cleanupIds = new Set<string>();
  for (const id of allowedIds) assertGenerationId(id);
  for (const id of retainedIds) {
    assertGenerationId(id);
    if (!allowedIds.has(id)) throw new Error("Lifecycle cleanup journal retained generation is malformed");
  }
  for (const target of journal.generations) {
    if (!target || typeof target !== "object" || !target.generation || !Array.isArray(target.entries)) {
      throw new Error("Lifecycle cleanup journal generation is malformed");
    }
    const id = target.generation.generationId;
    assertGenerationId(id);
    if (!allowedIds.has(id) || retainedIds.has(id) || cleanupIds.has(id)) {
      throw new Error("Lifecycle cleanup journal generation ownership is malformed");
    }
    cleanupIds.add(id);
  }
  if (allowedIds.size !== journal.allowedGenerationIds.length || retainedIds.size !== journal.retainedGenerationIds.length) {
    throw new Error("Lifecycle cleanup journal generation inventory is malformed");
  }
  if (allowedIds.size !== retainedIds.size + cleanupIds.size) {
    throw new Error("Lifecycle cleanup journal generation inventory is incomplete");
  }
  if (journal.action === "uninstall" && retainedIds.size !== 0) {
    throw new Error("Lifecycle uninstall cleanup journal may not retain generations");
  }
  if (journal.action === "retire" && cleanupIds.size !== 1) {
    throw new Error("Lifecycle retirement cleanup journal must own one retired generation");
  }
  return journal;
}

async function assertCleanupInventory(
  root: string,
  ledgerPath: string,
  launcherPath: string,
  journal: CleanupJournal
): Promise<void> {
  if (!(await exists(root))) {
    if (journal.action === "retire") throw new Error("Installer root disappeared during generation retirement");
    return;
  }
  const rootMetadata = await lstat(root);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error("Installer root changed during committed cleanup");
  }
  const expectedRootEntries = new Set(["generations", "launcher.mjs", "ledger.json", "receipts", "transaction.json"]);
  for (const entry of await readdir(root)) {
    if (!expectedRootEntries.has(entry)) throw new Error(`Unknown installer artifact ${entry}; refusing committed cleanup`);
  }

  const generationNames = await readdir(path.join(root, "generations")).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const receiptNames = await readdir(path.join(root, "receipts")).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const allowedIds = new Set(journal.allowedGenerationIds);
  if (generationNames.some((name) => !allowedIds.has(name))) {
    throw new Error("Unknown installer generation; refusing committed cleanup");
  }
  if (receiptNames.some((name) => !name.endsWith(".json") || !allowedIds.has(name.slice(0, -5)))) {
    throw new Error("Unknown installer receipt; refusing committed cleanup");
  }
  const generationSet = new Set(generationNames);
  const receiptSet = new Set(receiptNames);
  for (const id of journal.retainedGenerationIds) {
    if (!generationSet.has(id) || !receiptSet.has(`${id}.json`)) {
      throw new Error("Retained installer generation inventory is incomplete during committed cleanup");
    }
  }
  for (const target of journal.generations) {
    const id = target.generation.generationId;
    const generationExists = generationSet.has(id);
    const receiptExists = receiptSet.has(`${id}.json`);
    if (generationExists && !receiptExists) {
      throw new Error("Cleanup target receipt disappeared before its generation; refusing deletion");
    }
    if (generationExists) {
      const generationRoot = generationRootFor(root, id);
      const actualEntries = await inventory(generationRoot);
      assertInventorySubset(actualEntries, target.entries, "Cleanup target generation contains content not approved at commit; refusing deletion");
      const receipt = JSON.parse(await readFile(receiptPathFor(root, id), "utf8")) as Receipt;
      if (receipt.generationId !== id || JSON.stringify(receipt.entries) !== JSON.stringify(target.entries)) {
        throw new Error("Cleanup target receipt changed after commit; refusing deletion");
      }
    }
  }

  if (await exists(ledgerPath)) {
    const ledgerRaw = await readFile(ledgerPath, "utf8");
    if (sha256(ledgerRaw) !== journal.expectedLedgerHash) {
      throw new Error("Lifecycle ledger changed during committed cleanup; refusing deletion");
    }
  } else if (journal.action === "retire") {
    throw new Error("Lifecycle ledger disappeared during generation retirement");
  }
  if (await exists(launcherPath)) {
    await assertOwnedLauncher(launcherPath, ledgerPath);
  } else if (journal.action === "retire") {
    throw new Error("Owned Blueprint launcher disappeared during generation retirement");
  }
}

async function removeCleanupPath(
  targetPath: string,
  kind: LifecycleCleanupKind,
  dependencies: OpenCodeLifecycleDependencies,
  directoryOnly = false,
  validateBeforeRemove?: () => Promise<void>
): Promise<void> {
  if (!(await exists(targetPath))) return;
  await dependencies.beforeCleanup?.(targetPath, kind);
  await validateBeforeRemove?.();
  if (directoryOnly) {
    await rmdir(targetPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    return;
  }
  await rm(targetPath, { recursive: kind === "generation", force: true });
}

async function recoverCommittedCleanup(
  cleanupJournalPath: string,
  transactionJournalPath: string,
  configPath: string,
  root: string,
  ledgerPath: string,
  launcherPath: string,
  dependencies: OpenCodeLifecycleDependencies
): Promise<boolean> {
  if (!(await exists(cleanupJournalPath))) return false;
  const journal = parseCleanupJournal(await readFile(cleanupJournalPath, "utf8"));
  await assertCleanupInventory(root, ledgerPath, launcherPath, journal);

  if (journal.removeConfigIfHash && await exists(configPath)) {
    const currentConfig = await readFile(configPath, "utf8");
    if (sha256(currentConfig) === journal.removeConfigIfHash) {
      await dependencies.beforeCleanup?.(configPath, "config");
      if (await exists(configPath) && sha256(await readFile(configPath, "utf8")) === journal.removeConfigIfHash) {
        await rm(configPath, { force: true });
      }
    }
  }
  const validateRoot = () => assertCleanupInventory(root, ledgerPath, launcherPath, journal);
  for (const target of journal.generations) {
    await removeCleanupPath(generationRootFor(root, target.generation.generationId), "generation", dependencies, false, validateRoot);
    await removeCleanupPath(receiptPathFor(root, target.generation.generationId), "receipt", dependencies, false, validateRoot);
  }
  await removeCleanupPath(transactionJournalPath, "transactionJournal", dependencies, false, validateRoot);

  if (journal.action === "uninstall") {
    await removeCleanupPath(launcherPath, "launcher", dependencies, false, validateRoot);
    await removeCleanupPath(ledgerPath, "ledger", dependencies, false, validateRoot);
    await removeCleanupPath(path.join(root, "receipts"), "receiptsDirectory", dependencies, true, validateRoot);
    await removeCleanupPath(path.join(root, "generations"), "generationsDirectory", dependencies, true, validateRoot);
    await removeCleanupPath(root, "installRoot", dependencies, true, validateRoot);
  }
  await removeCleanupPath(cleanupJournalPath, "cleanupJournal", dependencies, false, validateRoot);
  return true;
}

async function assertOwnedInstallRoot(root: string, ledger: Ledger): Promise<void> {
  const expectedRootEntries = new Set(["generations", "launcher.mjs", "ledger.json", "receipts"]);
  for (const entry of await readdir(root)) {
    if (!expectedRootEntries.has(entry)) throw new Error(`Unknown installer artifact ${entry}; refusing deletion`);
  }
  const expectedIds = new Set([ledger.active, ledger.previous]
    .filter((value): value is LifecycleGeneration => value !== null)
    .map((value) => value.generationId));
  const generationNames = await readdir(path.join(root, "generations")).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const receiptNames = await readdir(path.join(root, "receipts")).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  if (generationNames.some((name) => !expectedIds.has(name)) || receiptNames.some((name) => !expectedIds.has(name.replace(/\.json$/, "")))) {
    throw new Error("Unknown installer generation or receipt; refusing deletion");
  }
  if (generationNames.length !== expectedIds.size || receiptNames.length !== expectedIds.size) {
    throw new Error("Installer generation inventory is incomplete; refusing deletion");
  }
}

async function assertOwnedLauncher(launcherPath: string, ledgerPath: string): Promise<void> {
  if (await readFile(launcherPath, "utf8") !== launcherSource(ledgerPath)) {
    throw new Error("Owned Blueprint launcher is missing or modified");
  }
}

async function isClaimableEmptyRoot(root: string): Promise<boolean> {
  for (const entry of await readdir(root)) {
    if (!["generations", "receipts"].includes(entry)) return false;
    if ((await readdir(path.join(root, entry))).length > 0) return false;
  }
  return true;
}

function compareVersions(left: string, right: string): number {
  const a = parseStrictSemver(left, "Installed Blueprint package version");
  const b = parseStrictSemver(right, "Active Blueprint package version");
  for (let index = 0; index < 3; index += 1) {
    if (a.core[index]! !== b.core[index]!) return a.core[index]! < b.core[index]! ? -1 : 1;
  }
  if (a.prerelease === null) return b.prerelease === null ? 0 : 1;
  if (b.prerelease === null) return -1;
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = a.prerelease[index];
    const rightIdentifier = b.prerelease[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    if (leftIdentifier === rightIdentifier) continue;
    if (typeof leftIdentifier === "bigint" && typeof rightIdentifier === "bigint") {
      return leftIdentifier < rightIdentifier ? -1 : 1;
    }
    if (typeof leftIdentifier === "bigint") return -1;
    if (typeof rightIdentifier === "bigint") return 1;
    return leftIdentifier < rightIdentifier ? -1 : 1;
  }
  return 0;
}

export async function runOpenCodeLifecycle(
  input: OpenCodeLifecycleInput,
  dependencies: OpenCodeLifecycleDependencies = {}
): Promise<OpenCodeLifecycleResult> {
  const env = dependencies.env ?? process.env;
  const configPath = assertAbsolute("configPath", input.configPath);
  const cwd = input.cwd === undefined ? undefined : assertAbsolute("cwd", input.cwd);
  const configDir = path.dirname(configPath);
  const root = path.join(configDir, ".blueprint-install");
  const ledgerPath = path.join(root, "ledger.json");
  const journalPath = path.join(root, "transaction.json");
  const cleanupJournalPath = `${root}.cleanup.json`;
  const launcherPath = path.join(root, "launcher.mjs");
  const registration = pathToFileURL(launcherPath).href;
  if (!["install", "upgrade"].includes(input.action) && input.packageSpec !== undefined) {
    throw new Error(`${input.action} does not accept --package`);
  }
  const initialConfigExisted = await exists(configPath);
  if (initialConfigExisted && (await lstat(configPath)).isSymbolicLink()) throw new Error("OpenCode config must be a literal file, not a symbolic link");
  const initialConfig = initialConfigExisted ? await readFile(configPath, "utf8") : "{}\n";
  const parsedInitialConfig = await parseStrictObject(initialConfig, "OpenCode config");
  const rootWasPresent = await exists(root);
  const cleanupWasPresent = await exists(cleanupJournalPath);
  if (!rootWasPresent && !cleanupWasPresent) assertNoReservedConfig(parsedInitialConfig);
  await assertRootIsolation(root, configPath, cwd, env);

  if (!rootWasPresent && !cleanupWasPresent) {
    if (input.action === "status") return lifecycleResult("status", null);
    if (input.action === "rollback" || input.action === "uninstall") throw new Error("Blueprint is not installed for this OpenCode config");
  } else if (rootWasPresent) {
    const rootMetadata = await lstat(root);
    if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) throw new Error("Installer root must be a literal directory");
    if ((rootMetadata.mode & 0o077) !== 0) throw new Error("Installer root permissions are not private");
  }

  const result = await withLifecycleLock(`${root}.lock`, dependencies.lockOptions, async () => {
    await recoverCommittedCleanup(cleanupJournalPath, journalPath, configPath, root, ledgerPath, launcherPath, dependencies);
    if (!(await exists(root))) {
      if (input.action === "status") return lifecycleResult("status", null);
      if (input.action === "rollback" || input.action === "uninstall") throw new Error("Blueprint is not installed for this OpenCode config");
      if (input.action === "upgrade") throw new Error("Blueprint must be installed before upgrade");
      const latestConfig = await parseStrictObject(await readFile(configPath, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return "{}\n";
        throw error;
      }), "OpenCode config");
      assertNoReservedConfig(latestConfig);
      await mkdir(root, { mode: 0o700 });
    }
    await recoverJournal(journalPath, configPath, ledgerPath, root);
    const currentConfigExisted = await exists(configPath);
    const currentConfig = currentConfigExisted ? await readFile(configPath, "utf8") : "{}\n";
    const configObject = await parseStrictObject(currentConfig, "OpenCode config");
    const ledgerRecord = await readLedger(ledgerPath);
    const ledger = ledgerRecord?.ledger ?? null;
    if (!ledger && !(await isClaimableEmptyRoot(root))) throw new Error("Existing installer root has no owned ledger or recovery journal");
    if (ledger && path.resolve(ledger.configPath) !== configPath) throw new Error("Lifecycle ledger config ownership conflict");
    if (cwd !== undefined && ledger?.cwd) {
      const [canonicalSuppliedCwd, canonicalRecordedCwd] = await Promise.all([
        canonicalProspective(cwd),
        canonicalProspective(ledger.cwd)
      ]);
      if (canonicalSuppliedCwd !== canonicalRecordedCwd) {
        throw new Error("Supplied cwd does not match the lifecycle ledger customer root");
      }
    }
    await assertRootIsolation(root, configPath, cwd ?? ledger?.cwd ?? undefined, env);
    assertNoReservedConfig(configObject, ledger?.registration);
    if (ledger?.active) await assertOwnedLauncher(launcherPath, ledgerPath);

    if (input.action === "status") {
      if (ledger?.active) await validateRecordedGeneration(root, ledger.active);
      if (ledger?.previous) await validateRecordedGeneration(root, ledger.previous);
      return lifecycleResult("status", ledger);
    }

    if (input.action === "rollback") {
      if (!ledger?.active || !ledger.previous) throw new Error("No previous Blueprint generation is available for rollback");
      await assertSupportedRuntimeState(ledger, env);
      await validateRecordedGeneration(root, ledger.active);
      await validateRecordedGeneration(root, ledger.previous);
      if (ledger.previous.stateCompatibility !== ledger.active.stateCompatibility || ledger.previous.stateCompatibility !== BLUEPRINT_STATE_COMPATIBILITY) {
        throw new Error("Previous Blueprint generation has incompatible state compatibility");
      }
      const afterLedger: Ledger = { ...ledger, active: ledger.previous, previous: ledger.active };
      const afterLedgerRaw = json(afterLedger);
      const afterConfig = currentConfig;
      const configMode = (await lstat(configPath)).mode & 0o777;
      await dependencies.onStep?.("beforeJournalWrite");
      await writeTransactionJournal(journalPath, currentConfig, true, configMode, afterConfig, ledgerRecord!.raw, afterLedgerRaw, null, null);
      await dependencies.onStep?.("afterJournalWrite");
      await dependencies.onStep?.("afterConfigWrite");
      await writeAtomic(ledgerPath, afterLedgerRaw, 0o600);
      await dependencies.onStep?.("afterLedgerWrite");
      await dependencies.onStep?.("afterReceiptWrite");
      await dependencies.onStep?.("afterActivation");
      await rm(journalPath, { force: true });
      return lifecycleResult("rollback", afterLedger);
    }

    if (input.action === "uninstall") {
      if (!ledger?.active) throw new Error("Blueprint is not installed for this OpenCode config");
      const cleanupGenerations: CleanupGeneration[] = [{
        generation: ledger.active,
        entries: (await validateRecordedGeneration(root, ledger.active)).entries
      }];
      if (ledger.previous) cleanupGenerations.push({
        generation: ledger.previous,
        entries: (await validateRecordedGeneration(root, ledger.previous)).entries
      });
      await assertOwnedInstallRoot(root, ledger);
      const afterConfig = removeRegistration(currentConfig, ledger.registration);
      const afterConfigObject = await parseStrictObject(afterConfig, "Updated OpenCode config");
      const removeOwnedEmptyConfig = ledger.configCreated
        && Object.keys(afterConfigObject).length === 1
        && Array.isArray(afterConfigObject.plugin)
        && afterConfigObject.plugin.length === 0;
      const afterLedger: Ledger = { ...ledger, active: null, previous: null, ownedConfigHash: null };
      const afterLedgerRaw = json(afterLedger);
      const configMode = (await lstat(configPath)).mode & 0o777;
      await dependencies.onStep?.("beforeJournalWrite");
      await writeTransactionJournal(journalPath, currentConfig, true, configMode, afterConfig, ledgerRecord!.raw, afterLedgerRaw, null, null);
      await dependencies.onStep?.("afterJournalWrite");
      await writeAtomic(configPath, afterConfig, configMode);
      await dependencies.onStep?.("afterConfigWrite");
      await writeAtomic(ledgerPath, afterLedgerRaw, 0o600);
      await dependencies.onStep?.("afterLedgerWrite");
      await dependencies.onStep?.("afterReceiptWrite");
      await dependencies.onStep?.("afterActivation");
      await writeCleanupJournal(cleanupJournalPath, {
        schemaVersion: 1,
        action: "uninstall",
        generations: cleanupGenerations,
        allowedGenerationIds: cleanupGenerations.map((entry) => entry.generation.generationId),
        retainedGenerationIds: [],
        expectedLedgerHash: sha256(afterLedgerRaw),
        removeConfigIfHash: removeOwnedEmptyConfig ? sha256(afterConfig) : null
      });
      await recoverCommittedCleanup(cleanupJournalPath, journalPath, configPath, root, ledgerPath, launcherPath, dependencies);
      return lifecycleResult("uninstall", null);
    }

    const packageSpec = input.packageSpec;
    if (!packageSpec) throw new Error(`${input.action} requires --package`);
    validatePackageSpec(packageSpec);
    if (path.isAbsolute(packageSpec)) {
      if (!packageSpec.endsWith(".tgz")) throw new Error("Absolute --package paths must name a .tgz archive");
      const archiveMetadata = await lstat(packageSpec);
      if (!archiveMetadata.isFile() || archiveMetadata.isSymbolicLink()) throw new Error("Package archive must be a literal regular .tgz file");
    } else if (!dependencies.allowRegistryPackageSpec) {
      throw new Error("Registry Blueprint installation is disabled until the published package identity is qualified; use an absolute .tgz path");
    }
    if (!cwd) throw new Error(`${input.action} requires an absolute cwd`);
    if (input.action === "upgrade" && !ledger?.active) throw new Error("Blueprint must be installed before upgrade");
    if (input.action === "install" && ledger?.active && ledger.active.sourceSpec !== packageSpec) {
      throw new Error("Blueprint is already installed; use upgrade for a different package source");
    }
    const generationId = `${dependencies.now?.().toISOString().replace(/[^0-9]/g, "") ?? Date.now()}-${dependencies.randomId?.() ?? randomUUID()}`;
    const generationRoot = generationRootFor(root, generationId);
    await mkdir(path.dirname(generationRoot), { recursive: true, mode: 0o700 });
    await mkdir(generationRoot, { mode: 0o700 });
    const installer = dependencies.packageInstaller ?? defaultPackageInstaller;
    const validateNativeAssets = dependencies.validatePackageAssets ?? dependencies.packageInstaller === undefined;
    let generation!: LifecycleGeneration;
    let newEntries!: ReceiptEntry[];
    let afterConfig!: string;
    let afterLedger!: Ledger;
    let afterLedgerRaw!: string;
    let configMode!: number;
    let stagedBeforeConfig!: string;
    let stagedBeforeConfigExisted!: boolean;
    let retiredGeneration: CleanupGeneration | null = null;
    let journalOwnsGeneration = false;
    try {
      let installedPackageRoot: string;
      ({ packageRoot: installedPackageRoot } = await installer({ packageSpec, stagingPrefix: generationRoot, env }));
      generation = await readPackageGeneration(generationId, generationRoot, installedPackageRoot, packageSpec, validateNativeAssets);
      const namedVersion = /^blueprint@(.+)$/.exec(packageSpec)?.[1];
      if (namedVersion && generation.version !== namedVersion) {
        throw new Error(`Installed Blueprint version ${generation.version} does not match requested exact version ${namedVersion}`);
      }
      newEntries = await inventory(generationRoot);
      if (ledger?.active) {
        const activeReceipt = await validateRecordedGeneration(root, ledger.active);
        const sameContent = JSON.stringify(activeReceipt.entries) === JSON.stringify(newEntries);
        if (generation.version === ledger.active.version) {
          await rm(generationRoot, { recursive: true, force: true });
          if (generation.sourceSpec === ledger.active.sourceSpec && sameContent) return lifecycleResult(input.action, ledger);
          throw new Error("Equal-version Blueprint package changed source or content; refusing blind replacement");
        }
        if (compareVersions(generation.version, ledger.active.version) < 0) {
          throw new Error("Blueprint package downgrade requires rollback to a retained compatible generation");
        }
        if (ledger.previous) {
          retiredGeneration = {
            generation: ledger.previous,
            entries: (await validateRecordedGeneration(root, ledger.previous)).entries
          };
        }
      }
      stagedBeforeConfigExisted = await exists(configPath);
      stagedBeforeConfig = stagedBeforeConfigExisted ? await readFile(configPath, "utf8") : "{}\n";
      const stagedConfigObject = await parseStrictObject(stagedBeforeConfig, "OpenCode config");
      assertNoReservedConfig(stagedConfigObject, ledger?.registration);
      afterConfig = ledger ? stagedBeforeConfig : addRegistration(stagedBeforeConfig, registration);
      await parseStrictObject(afterConfig, "Updated OpenCode config");
      afterLedger = {
        schemaVersion: 1,
        configPath,
        registration,
        active: generation,
        previous: ledger?.active ?? null,
        ownedConfigHash: sha256(afterConfig),
        cwd,
        configCreated: ledger?.configCreated ?? !stagedBeforeConfigExisted
      };
      afterLedgerRaw = json(afterLedger);
      configMode = stagedBeforeConfigExisted ? (await lstat(configPath)).mode & 0o777 : 0o600;
      await dependencies.onStep?.("beforeJournalWrite");
      const preJournalConfigExisted = await exists(configPath);
      const preJournalConfig = preJournalConfigExisted ? await readFile(configPath, "utf8") : "{}\n";
      if (preJournalConfigExisted !== stagedBeforeConfigExisted || preJournalConfig !== stagedBeforeConfig) {
        throw new Error("OpenCode config changed during package staging; preserving customer edits");
      }
      await writeTransactionJournal(journalPath, stagedBeforeConfig, stagedBeforeConfigExisted, configMode, afterConfig, ledgerRecord?.raw ?? null, afterLedgerRaw, generationRoot, newEntries);
      journalOwnsGeneration = true;
    } catch (error) {
      if (!journalOwnsGeneration) await rm(generationRoot, { recursive: true, force: true });
      throw error;
    }
    await dependencies.onStep?.("afterJournalWrite");
    const preWriteConfigExisted = await exists(configPath);
    const preWriteConfig = preWriteConfigExisted ? await readFile(configPath, "utf8") : "{}\n";
    if (preWriteConfigExisted !== stagedBeforeConfigExisted || preWriteConfig !== stagedBeforeConfig) {
      const currentLedgerRaw = await readFile(ledgerPath, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (currentLedgerRaw !== (ledgerRecord?.raw ?? null)) {
        throw new Error("OpenCode config and lifecycle ledger changed before activation; refusing automatic recovery");
      }
      await rm(generationRoot, { recursive: true, force: true });
      await rm(journalPath, { force: true });
      throw new Error("OpenCode config changed before activation; preserving customer edits");
    }
    if (!stagedBeforeConfigExisted || afterConfig !== stagedBeforeConfig) {
      await writeAtomic(configPath, afterConfig, configMode);
    }
    await dependencies.onStep?.("afterConfigWrite");
    await writeAtomic(ledgerPath, afterLedgerRaw, 0o600);
    await dependencies.onStep?.("afterLedgerWrite");
    await mkdir(path.join(root, "receipts"), { recursive: true, mode: 0o700 });
    await writeReceipt(receiptPathFor(root, generationId), generationId, generationRoot);
    await dependencies.onStep?.("afterReceiptWrite");
    if (!(await exists(launcherPath))) await writeAtomic(launcherPath, launcherSource(ledgerPath), 0o600);
    else if (await readFile(launcherPath, "utf8") !== launcherSource(ledgerPath)) throw new Error("Owned Blueprint launcher was modified");
    await dependencies.onStep?.("afterActivation");
    if (retiredGeneration) {
      const retainedGenerationIds = [afterLedger.active, afterLedger.previous]
        .filter((value): value is LifecycleGeneration => value !== null)
        .map((value) => value.generationId);
      await writeCleanupJournal(cleanupJournalPath, {
        schemaVersion: 1,
        action: "retire",
        generations: [retiredGeneration],
        allowedGenerationIds: [...new Set([...retainedGenerationIds, retiredGeneration.generation.generationId])],
        retainedGenerationIds,
        expectedLedgerHash: sha256(afterLedgerRaw),
        removeConfigIfHash: null
      });
      await recoverCommittedCleanup(cleanupJournalPath, journalPath, configPath, root, ledgerPath, launcherPath, dependencies);
    } else {
      await rm(journalPath, { force: true });
    }
    return lifecycleResult(input.action, afterLedger);
  });

  return result;
}
