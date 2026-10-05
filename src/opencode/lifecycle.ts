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
  | "afterJournalWrite"
  | "afterConfigWrite"
  | "afterLedgerWrite"
  | "afterReceiptWrite"
  | "afterActivation";

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
  validatePackageAssets?: boolean;
  onStep?: (step: LifecycleStep) => Promise<void> | void;
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

type Journal = {
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
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(temporary, contents, mode === undefined ? undefined : { mode });
  await rename(temporary, filePath);
  if (mode !== undefined) await chmod(filePath, mode);
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
  if (!/^blueprint@(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(spec)) {
    throw new Error("--package must be an absolute tarball path or blueprint@exact-semver");
  }
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
  await execFileAsync("npm", [
    "install",
    "--prefix",
    input.stagingPrefix,
    "--omit=dev",
    "--ignore-scripts",
    input.packageSpec
  ], { env: input.env, maxBuffer: 10 * 1024 * 1024 });
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
  if (typeof packageJson.version !== "string" || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(packageJson.version)) {
    throw new Error("Installed Blueprint package must have an exact semantic version");
  }
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
      const match = /^---\n[\s\S]*?^blueprint_state_version:\s*([^\s]+)[\s\S]*?^---\n/m.exec(state);
      if (!match || match[1] !== "1.0") throw new Error(`${statePath} has an unsupported or newer compatibility version`);
    }
  }
}

function receiptPathFor(root: string, generationId: string): string {
  return path.join(root, "receipts", `${generationId}.json`);
}

function generationRootFor(root: string, generationId: string): string {
  return path.join(root, "generations", generationId);
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
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as Journal;
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
    if (!/^[0-9A-Za-z._-]+$/.test(generationId) || path.resolve(journal.createdGenerationRoot) !== generationRootFor(root, generationId)) {
      throw new Error("Lifecycle journal contains an invalid generation path");
    }
    if (await exists(journal.createdGenerationRoot)) {
      if (!journal.createdGenerationEntries || JSON.stringify(await inventory(journal.createdGenerationRoot)) !== JSON.stringify(journal.createdGenerationEntries)) {
        throw new Error("Interrupted generation contains unknown files; refusing recovery deletion");
      }
      const receiptPath = receiptPathFor(root, generationId);
      if (await exists(receiptPath)) await verifyReceipt(receiptPath, journal.createdGenerationRoot);
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
  const journal: Journal = {
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

async function validateRecordedGeneration(root: string, generation: LifecycleGeneration): Promise<void> {
  const generationRoot = generationRootFor(root, generation.generationId);
  await verifyReceipt(receiptPathFor(root, generation.generationId), generationRoot);
  const observed = await readPackageGeneration(
    generation.generationId,
    generationRoot,
    generation.packageRoot,
    generation.sourceSpec,
    false
  );
  if (JSON.stringify(observed) !== JSON.stringify(generation)) throw new Error("Installed generation metadata was tampered");
}

async function assertOwnedInstallRoot(root: string, ledger: Ledger): Promise<void> {
  const expectedRootEntries = new Set(["generations", "launcher.mjs", "ledger.json", "lock", "receipts"]);
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
  const parse = (value: string) => value.split("-", 1)[0]!.split(".").map(Number);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index]! !== b[index]!) return a[index]! - b[index]!;
  }
  return left.localeCompare(right);
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
  const launcherPath = path.join(root, "launcher.mjs");
  const registration = pathToFileURL(launcherPath).href;
  const initialConfigExisted = await exists(configPath);
  if (initialConfigExisted && (await lstat(configPath)).isSymbolicLink()) throw new Error("OpenCode config must be a literal file, not a symbolic link");
  const initialConfig = initialConfigExisted ? await readFile(configPath, "utf8") : "{}\n";
  const parsedInitialConfig = await parseStrictObject(initialConfig, "OpenCode config");
  const rootWasPresent = await exists(root);
  if (!rootWasPresent) assertNoReservedConfig(parsedInitialConfig);
  await assertRootIsolation(root, configPath, cwd, env);

  if (!rootWasPresent) {
    if (input.action === "status") return lifecycleResult("status", null);
    if (input.action === "rollback" || input.action === "uninstall") throw new Error("Blueprint is not installed for this OpenCode config");
    await mkdir(root, { recursive: true, mode: 0o700 });
  } else {
    const rootMetadata = await lstat(root);
    if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) throw new Error("Installer root must be a literal directory");
    if ((rootMetadata.mode & 0o077) !== 0) throw new Error("Installer root permissions are not private");
  }

  const result = await withLifecycleLock(`${root}.lock`, dependencies.lockOptions, async () => {
    if (!(await exists(root))) {
      if (input.action === "status") return lifecycleResult("status", null);
      if (input.action === "rollback" || input.action === "uninstall") throw new Error("Blueprint is not installed for this OpenCode config");
      await mkdir(root, { recursive: true, mode: 0o700 });
    }
    await recoverJournal(journalPath, configPath, ledgerPath, root);
    const currentConfigExisted = await exists(configPath);
    const currentConfig = currentConfigExisted ? await readFile(configPath, "utf8") : "{}\n";
    const configObject = await parseStrictObject(currentConfig, "OpenCode config");
    const ledgerRecord = await readLedger(ledgerPath);
    const ledger = ledgerRecord?.ledger ?? null;
    if (!ledger && !(await isClaimableEmptyRoot(root))) throw new Error("Existing installer root has no owned ledger or recovery journal");
    if (ledger && path.resolve(ledger.configPath) !== configPath) throw new Error("Lifecycle ledger config ownership conflict");
    await assertRootIsolation(root, configPath, cwd ?? ledger?.cwd ?? undefined, env);
    assertNoReservedConfig(configObject, ledger?.registration);
    if (ledger?.active) await assertOwnedLauncher(launcherPath, ledgerPath);

    if (input.action === "status") {
      if (ledger?.active) await readPackageGeneration(ledger.active.generationId, generationRootFor(root, ledger.active.generationId), ledger.active.packageRoot, ledger.active.sourceSpec, false);
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
      await validateRecordedGeneration(root, ledger.active);
      if (ledger.previous) await validateRecordedGeneration(root, ledger.previous);
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
      await writeTransactionJournal(journalPath, currentConfig, true, configMode, afterConfig, ledgerRecord!.raw, afterLedgerRaw, null, null);
      await dependencies.onStep?.("afterJournalWrite");
      await writeAtomic(configPath, afterConfig, configMode);
      await dependencies.onStep?.("afterConfigWrite");
      await writeAtomic(ledgerPath, afterLedgerRaw, 0o600);
      await dependencies.onStep?.("afterLedgerWrite");
      await dependencies.onStep?.("afterReceiptWrite");
      await dependencies.onStep?.("afterActivation");
      await rm(journalPath, { force: true });
      if (removeOwnedEmptyConfig) await rm(configPath, { force: true });
      for (const generation of [ledger.active, ledger.previous].filter((value): value is LifecycleGeneration => value !== null)) {
        await rm(generationRootFor(root, generation.generationId), { recursive: true, force: true });
        await rm(receiptPathFor(root, generation.generationId), { force: true });
      }
      await rm(launcherPath, { force: true });
      await rm(ledgerPath, { force: true });
      await rmdir(path.join(root, "receipts")).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
      await rmdir(path.join(root, "generations")).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
      await rmdir(root);
      return lifecycleResult("uninstall", null);
    }

    const packageSpec = input.packageSpec;
    if (!packageSpec) throw new Error(`${input.action} requires --package`);
    validatePackageSpec(packageSpec);
    if (path.isAbsolute(packageSpec)) {
      if (!packageSpec.endsWith(".tgz")) throw new Error("Absolute --package paths must name a .tgz archive");
      const archiveMetadata = await lstat(packageSpec);
      if (!archiveMetadata.isFile() || archiveMetadata.isSymbolicLink()) throw new Error("Package archive must be a literal regular .tgz file");
    }
    if (!cwd) throw new Error(`${input.action} requires an absolute cwd`);
    if (input.action === "upgrade" && !ledger?.active) throw new Error("Blueprint must be installed before upgrade");
    if (input.action === "install" && ledger?.active && ledger.active.sourceSpec !== packageSpec) {
      throw new Error("Blueprint is already installed; use upgrade for a different package source");
    }
    const generationId = `${dependencies.now?.().toISOString().replace(/[^0-9]/g, "") ?? Date.now()}-${dependencies.randomId?.() ?? randomUUID()}`;
    const generationRoot = generationRootFor(root, generationId);
    await mkdir(generationRoot, { recursive: true, mode: 0o700 });
    const installer = dependencies.packageInstaller ?? defaultPackageInstaller;
    let installedPackageRoot: string;
    try {
      ({ packageRoot: installedPackageRoot } = await installer({ packageSpec, stagingPrefix: generationRoot, env }));
    } catch (error) {
      await rm(generationRoot, { recursive: true, force: true });
      throw error;
    }
    const validateNativeAssets = dependencies.validatePackageAssets ?? dependencies.packageInstaller === undefined;
    let generation: LifecycleGeneration;
    try {
      generation = await readPackageGeneration(generationId, generationRoot, installedPackageRoot, packageSpec, validateNativeAssets);
    } catch (error) {
      await rm(generationRoot, { recursive: true, force: true });
      throw error;
    }
    const namedVersion = /^blueprint@(.+)$/.exec(packageSpec)?.[1];
    if (namedVersion && generation.version !== namedVersion) {
      await rm(generationRoot, { recursive: true, force: true });
      throw new Error(`Installed Blueprint version ${generation.version} does not match requested exact version ${namedVersion}`);
    }
    const newEntries = await inventory(generationRoot);
    if (ledger?.active) {
      await validateRecordedGeneration(root, ledger.active);
      const activeReceipt = await verifyReceipt(receiptPathFor(root, ledger.active.generationId), generationRootFor(root, ledger.active.generationId));
      const sameContent = JSON.stringify(activeReceipt.entries) === JSON.stringify(newEntries);
      if (generation.version === ledger.active.version) {
        await rm(generationRoot, { recursive: true, force: true });
        if (generation.sourceSpec === ledger.active.sourceSpec && sameContent) return lifecycleResult(input.action, ledger);
        throw new Error("Equal-version Blueprint package changed source or content; refusing blind replacement");
      }
      if (compareVersions(generation.version, ledger.active.version) < 0) {
        await rm(generationRoot, { recursive: true, force: true });
        throw new Error("Blueprint package downgrade requires rollback to a retained compatible generation");
      }
    }
    const afterConfig = ledger ? currentConfig : addRegistration(currentConfig, registration);
    await parseStrictObject(afterConfig, "Updated OpenCode config");
    const afterLedger: Ledger = {
      schemaVersion: 1,
      configPath,
      registration,
      active: generation,
      previous: ledger?.active ?? null,
      ownedConfigHash: sha256(afterConfig),
      cwd,
      configCreated: ledger?.configCreated ?? !currentConfigExisted
    };
    const afterLedgerRaw = json(afterLedger);
    const configMode = currentConfigExisted ? (await lstat(configPath)).mode & 0o777 : 0o600;
    await writeTransactionJournal(journalPath, currentConfig, currentConfigExisted, configMode, afterConfig, ledgerRecord?.raw ?? null, afterLedgerRaw, generationRoot, newEntries);
    await dependencies.onStep?.("afterJournalWrite");
    await writeAtomic(configPath, afterConfig, configMode);
    await dependencies.onStep?.("afterConfigWrite");
    await writeAtomic(ledgerPath, afterLedgerRaw, 0o600);
    await dependencies.onStep?.("afterLedgerWrite");
    await mkdir(path.join(root, "receipts"), { recursive: true, mode: 0o700 });
    await writeReceipt(receiptPathFor(root, generationId), generationId, generationRoot);
    await dependencies.onStep?.("afterReceiptWrite");
    if (!(await exists(launcherPath))) await writeAtomic(launcherPath, launcherSource(ledgerPath), 0o600);
    else if (await readFile(launcherPath, "utf8") !== launcherSource(ledgerPath)) throw new Error("Owned Blueprint launcher was modified");
    await dependencies.onStep?.("afterActivation");
    await rm(journalPath, { force: true });
    return lifecycleResult(input.action, afterLedger);
  });

  return result;
}
