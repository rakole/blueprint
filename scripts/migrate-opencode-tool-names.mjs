#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const configPath = path.join(repoRoot, "scripts/migrate-opencode-tool-names.config.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const args = new Set(process.argv.slice(2));
const supportedArgs = new Set(["--apply", "--help", "--verbose"]);

if ([...args].some((arg) => !supportedArgs.has(arg))) {
  fail("Usage: node scripts/migrate-opencode-tool-names.mjs [--apply] [--verbose]");
}
if (args.has("--help")) {
  console.log("Dry-run is the default. Pass --apply to write only after complete preflight.");
  process.exit(0);
}

const apply = args.has("--apply");
const verbose = args.has("--verbose");
const counts = new Map();
const manual = new Map();

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function git(...gitArgs) {
  return execFileSync("git", gitArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function hash(content) {
  return createHash("sha256").update(content).digest("hex");
}

function increment(label, amount = 1) {
  counts.set(label, (counts.get(label) ?? 0) + amount);
}

function queueManual(label, relativePath) {
  const paths = manual.get(label) ?? new Set();
  paths.add(relativePath);
  manual.set(label, paths);
}

function replaceExact(text, before, after, label, requiredCount) {
  const occurrences = text.split(before).length - 1;
  if (requiredCount !== undefined && occurrences !== requiredCount) {
    throw new Error(`${label}: expected ${requiredCount} occurrence(s), found ${occurrences}`);
  }
  if (occurrences > 0) increment(label, occurrences);
  return text.split(before).join(after);
}

function guardWorktree() {
  if (git("rev-parse", "--show-toplevel") !== repoRoot) {
    fail(`script must run from its owning worktree: ${repoRoot}`);
  }
  const branch = git("branch", "--show-current");
  if (branch !== config.expectedBranch) {
    fail(`expected branch ${config.expectedBranch}; found ${branch || "detached HEAD"}`);
  }
  const base = git("rev-parse", config.expectedBaseRef);
  if (base !== config.expectedBaseSha) {
    fail(`${config.expectedBaseRef} moved: expected ${config.expectedBaseSha}, found ${base}`);
  }
  if (git("merge-base", "HEAD", config.expectedBaseRef) !== config.expectedBaseSha) {
    fail(`feature branch is not based on the reviewed ${config.expectedBaseRef} commit`);
  }
}

function basePromptFiles() {
  const output = git("ls-tree", "-r", "--name-only", config.expectedBaseSha, "--", ...config.promptRoots);
  return output.split("\n").filter(Boolean).filter((entry) =>
    config.promptExtensions.includes(path.extname(entry))
  );
}

function baseContent(relativePath) {
  return execFileSync("git", ["show", `${config.expectedBaseSha}:${relativePath}`], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function maskInventoriedValues(relativePath, text) {
  const masks = [];
  for (const literal of config.preservedAskUserLiterals[relativePath] ?? []) {
    const occurrences = text.split(literal).length - 1;
    if (occurrences !== 1) {
      throw new Error(`${relativePath}: expected one preserved backend literal ${literal}; found ${occurrences}`);
    }
    const marker = `__BLUEPRINT_PRESERVED_ASK_USER_${masks.length}__`;
    masks.push([marker, literal]);
    text = text.replace(literal, marker);
  }
  return { text, masks };
}

function restoreMasks(text, masks) {
  for (const [marker, literal] of masks) text = text.replaceAll(marker, literal);
  return text;
}

function transformGuidance(relativePath, source) {
  let { text, masks } = maskInventoriedValues(relativePath, source);

  text = replaceExact(text, "mcp_blueprint_blueprint_", "blueprint_blueprint_", "MCP FQN prefix");
  text = replaceExact(text, "mcp_blueprint_*", "blueprint_blueprint_*", "generic MCP FQN guidance");
  text = replaceExact(
    text,
    "use the current host's runtime FQN form `mcp_blueprint_<toolName>`.",
    "translate an internal id such as `blueprint_project_status` to the exposed OpenCode name `blueprint_blueprint_project_status`.",
    "generic MCP FQN example"
  );
  text = replaceExact(text, "  - list_directory\n  - read_file\n", "  - read\n", "agent read allowlist");
  text = replaceExact(text, "  - grep_search\n", "  - grep\n", "agent grep allowlist");
  text = replaceExact(
    text,
    "  - replace\n  - write_file\n  - run_shell_command\n",
    "  - apply_patch\n  - edit\n  - write\n  - bash\n",
    "executor mutation allowlist"
  );

  for (const [before, after] of [
    ["list_directory", "read"],
    ["read_file", "read"],
    ["grep_search", "grep"],
    ["run_shell_command", "bash"],
    ["write_todos", "todowrite"]
  ]) {
    const pattern = new RegExp(`\\b${before}\\b`, "g");
    const occurrences = [...text.matchAll(pattern)].length;
    if (occurrences > 0) increment(`${before} -> ${after}`, occurrences);
    text = text.replace(pattern, after);
  }

  text = replaceExact(text, "`ask_user`", "`question`", "backticked question tool");
  const oldSchemaSentence = "For structured decisions, use `question` with `type: \"choice\"`, 2-4 labeled options, concise descriptions, and a placeholder such as `Type your own answer...` so the built-in custom-answer path stays open.";
  text = replaceExact(text, oldSchemaSentence, config.questionSchemaSentence, "question schema sentence");
  text = replaceExact(
    text,
    "- Use `type: \"choice\"` with 2-4 options, each with a clear label and short\n  description.\n- Include a placeholder such as `Type your own answer...` so the built-in\n  custom-answer path stays open.",
    `- ${config.questionSchemaSentence}`,
    "questioning reference schema"
  );

  if (relativePath === "agents/blueprint-executor.md" && !text.includes(config.modelEditingInstruction)) {
    const anchor = "## Shell Isolation\n\n";
    text = replaceExact(text, anchor, `${anchor}${config.modelEditingInstruction}\n\n`, "executor model editing guidance", 1);
  }

  return restoreMasks(text, masks);
}

function transformFixed(relativePath, source) {
  let text = source;
  text = replaceExact(text, "mcp_blueprint_blueprint_", "blueprint_blueprint_", "fixed MCP FQN prefix");

  if (relativePath.endsWith("agent-metadata.ts") || relativePath.endsWith("agent-schema.test.ts") || relativePath.endsWith("agent-tool-allowlist.test.ts")) {
    for (const [before, after] of [
      ["list_directory", "read"],
      ["read_file", "read"],
      ["grep_search", "grep"],
      ["replace", "edit"],
      ["write_file", "write"],
      ["run_shell_command", "bash"]
    ]) text = text.replace(new RegExp(`"${before}"`, "g"), `"${after}"`);

    const duplicateReadPattern = /"read",\s*"read",/g;
    const duplicateReadCount = [...text.matchAll(duplicateReadPattern)].length;
    if (duplicateReadCount > 0) increment("deduplicated read allowlist", duplicateReadCount);
    text = text.replace(duplicateReadPattern, '"read",');

    text = text.replace(/\bwrite_todos\b/g, "todowrite");
    text = replaceExact(text, "`ask_user`", "`question`", "fixed test question tool");

    text = text.replace(
      /"edit",\n(\s*)"write",\n\1"bash"/g,
      '"apply_patch",\n$1"edit",\n$1"write",\n$1"bash"'
    );
    if (relativePath.endsWith("agent-schema.test.ts")) {
      text = replaceExact(
        text,
        'const VALID_BUILTIN_TOOLS = new Set([\n  "read",',
        'const VALID_BUILTIN_TOOLS = new Set([\n  "apply_patch",\n  "read",',
        "schema apply_patch registry",
        1
      );
    }
  }

  if (relativePath === "src/mcp/runtime-vocabulary.ts") {
    text = replaceExact(
      text,
      "): `mcp_${typeof BLUEPRINT_MCP_SERVER_NAME}_${BlueprintInternalToolName}` {\n  return `mcp_${BLUEPRINT_MCP_SERVER_NAME}_${toolName}`;",
      "): `${typeof BLUEPRINT_MCP_SERVER_NAME}_${BlueprintInternalToolName}` {\n  return `${BLUEPRINT_MCP_SERVER_NAME}_${toolName}`;",
      "runtime FQN helper",
      1
    );
  }
  return text;
}

function auditExpected(relativePath, text) {
  const errors = [];
  for (const [label, pattern] of [
    ["legacy or generic MCP FQN", /mcp_blueprint_/],
    ["legacy read/shell/progress tool", /\b(list_directory|read_file|grep_search|run_shell_command|write_todos)\b/],
    ["legacy mutating tool reference", /`replace`|`write_file`/],
    ["unmigrated question schema", /`type:\s*"choice"`|placeholder such as `Type your own answer\.\.\.`/]
  ]) if (pattern.test(text)) errors.push(`${relativePath}: ${label}`);

  let unprotectedText = text;
  for (const literal of config.preservedAskUserLiterals[relativePath] ?? []) {
    unprotectedText = unprotectedText.replace(literal, "");
  }
  if (/["']ask_user["']/.test(unprotectedText)) {
    errors.push(`${relativePath}: unexpected structured ask_user value`);
  }
  if (/\bask_user\b/.test(unprotectedText)) {
    queueManual("unquoted ask_user prose", relativePath);
  }
  if (/\bupdate_topic\b/.test(text)) queueManual("semantic update_topic prose", relativePath);
  return errors;
}

guardWorktree();
const promptFiles = basePromptFiles();
const files = [...new Set([...promptFiles, ...config.fixedFiles])].sort();
const prepared = [];
const errors = [];

for (const relativePath of files) {
  try {
    const baseline = baseContent(relativePath);
    const normalizedBase = baseline.replaceAll("\r\n", "\n");
    const isGuidance = config.promptRoots.some((root) => relativePath.startsWith(`${root}/`)) || relativePath.startsWith("agent-docs/");
    const expected = isGuidance
      ? transformGuidance(relativePath, normalizedBase)
      : transformFixed(relativePath, normalizedBase);
    errors.push(...auditExpected(relativePath, expected));

    const absolutePath = path.join(repoRoot, relativePath);
    const current = await readFile(absolutePath, "utf8");
    const normalizedCurrent = current.replaceAll("\r\n", "\n");
    const state = normalizedBase === expected
      ? normalizedCurrent === normalizedBase ? "neutral" : "unrecognized"
      : normalizedCurrent === normalizedBase
        ? "original"
        : normalizedCurrent === expected
          ? "migrated"
          : "unrecognized";
    prepared.push({ relativePath, absolutePath, current, expected, state, originalHash: hash(current) });
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
  }
}

const states = new Set(prepared.map((entry) => entry.state).filter((state) => state !== "neutral"));
if (states.has("unrecognized") || (states.has("original") && states.has("migrated"))) {
  errors.push("target set must be either the exact pinned-base state or the exact fully migrated state; mixed/unrecognized edits are rejected");
}
if (errors.length > 0) fail(`preflight rejected without writes:\n${errors.join("\n")}`);

const changed = prepared.filter((entry) => entry.state === "original" && entry.current.replaceAll("\r\n", "\n") !== entry.expected);
console.log(`${apply ? "APPLY" : "DRY-RUN"}: ${changed.length} file(s) require migration.`);
for (const [label, count] of [...counts.entries()].sort()) console.log(`  ${label}: ${count}`);
for (const [label, paths] of [...manual.entries()].sort()) {
  console.log(`  manual ${label}: ${paths.size} file(s)`);
  if (verbose) for (const relativePath of [...paths].sort()) console.log(`    ${relativePath}`);
}
if (verbose) for (const entry of changed) console.log(`  change ${entry.relativePath}`);

if (apply && changed.length > 0) {
  for (const entry of prepared) {
    const fresh = await readFile(entry.absolutePath, "utf8");
    if (hash(fresh) !== entry.originalHash) fail(`pre-write hash changed for ${entry.relativePath}; wrote nothing`);
  }
  for (const entry of changed) {
    const mode = (await stat(entry.absolutePath)).mode;
    const eol = entry.current.includes("\r\n") ? "\r\n" : "\n";
    await writeFile(entry.absolutePath, entry.expected.replaceAll("\n", eol), { mode });
  }
}

console.log("Preflight errors: 0");
