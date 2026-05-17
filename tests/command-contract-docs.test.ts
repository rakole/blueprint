import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import {
  getRuntimeOwnedCommandMetadata,
  MAP_CODEBASE_RUNTIME_METADATA
} from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();
const commandDocsRoot = path.join(repoRoot, "docs/commands");

type CatalogEntry = {
  command: string;
  wave: string;
  family: string;
  primarySkill: string;
};

type CommandSpecEntry = {
  command: string;
  wave: string;
  family: string;
  primarySkill: string;
};

type RuntimeReferenceEntry = {
  command: string;
  commandSpecPath: string;
  primarySkill: string;
  contractNotes: string;
  evidenceState: string;
};

const SOURCE_OWNED_CAPTURE_COMMANDS = [
  "note",
  "add-todo",
  "check-todos",
  "add-backlog",
  "review-backlog",
  "explore"
] as const;

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function parseCatalog(markdown: string): Map<string, CatalogEntry> {
  const entries = new Map<string, CatalogEntry>();

  for (const match of markdown.matchAll(
    /^\| `([^`]+)` \| ([0-9]+) \| `([^`]+)` \| `([^`]+)` \| `(planned|implemented|blocked|repairing)` \|/gm
  )) {
    const [, command, wave, family, primarySkill] = match;
    entries.set(command, { command, wave, family, primarySkill });
  }

  return entries;
}

function parseSkillOwnership(markdown: string): Map<string, string> {
  const ownership = new Map<string, string>();

  for (const match of markdown.matchAll(
    /^\| `([^`]+)` \| `(implemented|planned)` \| [^|]+ \| (.+) \|$/gm
  )) {
    const [, skill, , commandsCell] = match;
    const commands = commandsCell
      .split(",")
      .map((value) => value.replaceAll("`", "").trim())
      .filter((value) => value.length > 0 && !value.startsWith("/"));

    for (const command of commands) {
      ownership.set(command, skill);
    }
  }

  return ownership;
}

function parseMigrationSkills(markdown: string): Map<string, string> {
  const skills = new Map<string, string>();

  for (const match of markdown.matchAll(
    /^\| `([^`]+)` \| `(?:docs\/commands\/[^`]+\.md|src\/mcp\/command-runtime-metadata\.ts#[^`]+)` \| `([^`]+)` \|/gm
  )) {
    const [, command, skill] = match;
    skills.set(command, skill);
  }

  return skills;
}

function parseRuntimeReferenceRows(markdown: string): Map<string, RuntimeReferenceEntry> {
  const entries = new Map<string, RuntimeReferenceEntry>();

  for (const line of markdown.split("\n")) {
    const trimmedLine = line.trim();

    if (!trimmedLine.startsWith("| `") || !trimmedLine.endsWith("|")) {
      continue;
    }

    const cells = trimmedLine
      .slice(1, -1)
      .split(" | ")
      .map((cell) => cell.trim());

    if (cells.length !== 8) {
      continue;
    }

    const commandMatch = cells[0].match(/^`([^`]+)`$/);
    const commandSpecMatch = cells[1].match(/^`([^`]+)`$/);
    const primarySkillMatch = cells[2].match(/^`([^`]+)`$/);

    if (!commandMatch || !commandSpecMatch || !primarySkillMatch) {
      continue;
    }

    entries.set(commandMatch[1], {
      command: commandMatch[1],
      commandSpecPath: commandSpecMatch[1],
      primarySkill: primarySkillMatch[1],
      contractNotes: cells[6],
      evidenceState: cells[7]
    });
  }

  return entries;
}

function parseCommandSpec(markdown: string, command: string): CommandSpecEntry {
  const waveMatch = markdown.match(/\| Wave \| `([^`]+)` \|/);
  const familyMatch = markdown.match(/\| Family \| `([^`]+)` \|/);
  const skillMatch = markdown.match(/- Primary skill: `([^`]+)`/);

  assert.ok(waveMatch, `Missing wave metadata in ${command}`);
  assert.ok(familyMatch, `Missing family metadata in ${command}`);
  assert.ok(skillMatch, `Missing primary skill metadata in ${command}`);

  return {
    command,
    wave: waveMatch[1],
    family: familyMatch[1],
    primarySkill: skillMatch[1]
  };
}

async function loadCommandSpecs(): Promise<Map<string, CommandSpecEntry>> {
  const entries = new Map<string, CommandSpecEntry>();
  const files = await readdir(commandDocsRoot);

  for (const file of files) {
    if (!file.endsWith(".md") || file === "_template.md" || file === "root-router.md") {
      continue;
    }

    const command = file.replace(/\.md$/, "");
    const markdown = await readFile(path.join(commandDocsRoot, file), "utf8");
    entries.set(command, parseCommandSpec(markdown, command));
  }

  return entries;
}

test("command catalog entries match per-command specs for wave, family, and primary skill", async () => {
  const [catalogMarkdown, commandSpecs] = await Promise.all([
    readRepoFile("docs/COMMAND-CATALOG.md"),
    loadCommandSpecs()
  ]);
  const catalog = parseCatalog(catalogMarkdown);

  assert.deepEqual([...catalog.keys()].sort(), [...commandSpecs.keys()].sort());

  for (const [command, entry] of catalog) {
    const spec = commandSpecs.get(command);
    assert.ok(spec, `Missing command spec for ${command}`);
    assert.equal(spec.wave, entry.wave, `Wave mismatch for ${command}`);
    assert.equal(spec.family, entry.family, `Family mismatch for ${command}`);
    assert.equal(spec.primarySkill, entry.primarySkill, `Primary skill mismatch for ${command}`);
  }
});

test("skill inventory and migration matrix agree with canonical primary skill ownership", async () => {
  const [catalogMarkdown, skillsMarkdown, migrationMarkdown] = await Promise.all([
    readRepoFile("docs/COMMAND-CATALOG.md"),
    readRepoFile("docs/SKILLS-AND-AGENTS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);
  const catalog = parseCatalog(catalogMarkdown);
  const skillOwnership = parseSkillOwnership(skillsMarkdown);
  const migrationSkills = parseMigrationSkills(migrationMarkdown);

  for (const [command, entry] of catalog) {
    assert.equal(
      skillOwnership.get(command),
      entry.primarySkill,
      `Skill inventory mismatch for ${command}`
    );
    assert.equal(
      migrationSkills.get(command),
      entry.primarySkill,
      `Migration matrix mismatch for ${command}`
    );
  }
});

test("phase 2.2 drift fixes stay locked for the known ownership mismatches", async () => {
  const [skillsMarkdown, migrationMarkdown] = await Promise.all([
    readRepoFile("docs/SKILLS-AND-AGENTS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);
  const skillOwnership = parseSkillOwnership(skillsMarkdown);
  const migrationSkills = parseMigrationSkills(migrationMarkdown);

  const expectedOwnership = new Map<string, string>([
    ["next", "blueprint-router"],
    ["do", "blueprint-router"],
    ["pause-work", "blueprint-governance"],
    ["resume-work", "blueprint-governance"],
    ["plan-milestone-gaps", "blueprint-roadmap-admin"]
  ]);

  for (const [command, skill] of expectedOwnership) {
    assert.equal(skillOwnership.get(command), skill, `Skills doc drifted for ${command}`);
    assert.equal(migrationSkills.get(command), skill, `Migration doc drifted for ${command}`);
  }
});

test("resource contract docs keep live command exposure scoped and read-only", async () => {
  const [mcpToolsDoc, artifactSchema, runtimeReference] = await Promise.all([
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/ARTIFACT-SCHEMA.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(mcpToolsDoc, /## Read-Only MCP Resource Contract/);
  assert.match(
    mcpToolsDoc,
    /Router, progress, and discovery-style reads may adopt these resources later, but implemented-only command exposure must stay unchanged/i
  );
  assert.match(
    mcpToolsDoc,
    /Resource views must mirror existing command\/tool truth; they do not get to invent new routing, status, or persistence semantics/i
  );

  assert.match(artifactSchema, /## Read-Only MCP Resource Views/);
  assert.match(
    artifactSchema,
    /Blueprint's planned MCP resources are derived read views over existing runtime truth/i
  );
  assert.match(
    artifactSchema,
    /Resource views are for discovery and grounding only\. Writes remain on the existing MCP tool surface for config, roadmap, phase, report, review, and capture persistence/i
  );

  assert.match(runtimeReference, /## Read-Only MCP Resource Contract/);
  assert.match(
    runtimeReference,
    /Router and progress commands use command manifests, `blueprint-router` input bundles, source-owned runtime metadata, and read-oriented MCP tools\. Docs remain control-plane history, not runtime inputs/i
  );
  assert.match(
    runtimeReference,
    /`blueprint:\/\/commands\/catalog` may mirror the full retained catalog metadata, but `\/blu`, `help`, `progress`, and `next` must still recommend only commands whose catalog entry is `implemented`/i
  );
  assert.match(
    runtimeReference,
    /No writes move onto resource surfaces\. Config, roadmap, phase, report, review, and capture persistence remain on the existing Blueprint MCP tool surface/i
  );
});

test("phase discovery skill and bounded agent contracts are marked implemented in docs", async () => {
  const skillsMarkdown = await readRepoFile("docs/SKILLS-AND-AGENTS.md");

  assert.match(
    skillsMarkdown,
    /\| `blueprint-phase-discovery` \| `implemented` \| Pre-planning discovery and requirements shaping \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-researcher` \| `implemented` \| Phase-specific technical research \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-ui-designer` \| `implemented` \| Produce `UI-SPEC` contracts \|/
  );
});

test("capture skill and shipped note, backlog, and explore docs are marked implemented in docs", async () => {
  const [skillsMarkdown, noteDoc, addBacklogDoc, exploreDoc, mcpToolsDoc, catalogMarkdown, migrationMarkdown] = await Promise.all([
    readRepoFile("docs/SKILLS-AND-AGENTS.md"),
    readRepoFile("docs/commands/note.md"),
    readRepoFile("docs/commands/add-backlog.md"),
    readRepoFile("docs/commands/explore.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/COMMAND-CATALOG.md"),
    readRepoFile("docs/GSD-RUNTIME-MIGRATION.md")
  ]);

  assert.match(
    skillsMarkdown,
    /\| `blueprint-capture` \| `implemented` \| Notes, todos, backlog, ideation routing \| `note`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, `explore` \|/
  );
  assert.match(catalogMarkdown, /\| `note` \| 3 \| `Capture And Lightweight Execution` \| `blueprint-capture` \| `implemented` \|/);
  assert.match(noteDoc, /Primary skill: `blueprint-capture`/);
  assert.match(noteDoc, /## Required MCP Tools[\s\S]*`blueprint_artifact_mutate_index`/);
  assert.match(noteDoc, /## Blueprint And Global State Writes[\s\S]*`\.blueprint\/notes\/NOTES\.md`/);
  assert.match(noteDoc, /Keeps? notes project-local/i);
  assert.match(addBacklogDoc, /Primary skill: `blueprint-capture`/);
  assert.match(addBacklogDoc, /## Required MCP Tools[\s\S]*`blueprint_artifact_mutate_index`/);
  assert.match(addBacklogDoc, /## Required MCP Tools[\s\S]*`blueprint_artifact_scaffold`/);
  assert.match(addBacklogDoc, /999\.x numbering/);
  assert.match(addBacklogDoc, /Confirm immediate phase-stub reservation when used\./);
  assert.match(
    catalogMarkdown,
    /\| `explore` \| 3 \| `Capture And Lightweight Execution` \| `blueprint-capture` \| `implemented` \|/
  );
  assert.match(exploreDoc, /Primary skill: `blueprint-capture`/);
  assert.match(exploreDoc, /Argument hint: `<topic>`/);
  assert.match(exploreDoc, /## Required MCP Tools[\s\S]*`blueprint_project_status`/);
  assert.match(exploreDoc, /## Required MCP Tools[\s\S]*`blueprint_config_get`/);
  assert.match(exploreDoc, /## Required MCP Tools[\s\S]*`blueprint_artifact_mutate_index`/);
  assert.match(exploreDoc, /## Required MCP Tools[\s\S]*`blueprint_roadmap_add_phase`/);
  assert.match(exploreDoc, /## Required MCP Tools[\s\S]*`blueprint_artifact_scaffold`/);
  assert.match(exploreDoc, /Confirm the final routing target before any durable write\./);
  assert.match(exploreDoc, /scaffolded phase context/i);
  assert.match(
    migrationMarkdown,
    /\| `explore` \| `commands\/gsd\/explore\.md` \| GSD has an upstream workflow file \| `docs\/commands\/explore\.md` \| `blueprint-capture` \| `blueprint_project_status`<br>`blueprint_config_get`<br>`blueprint_artifact_mutate_index`<br>`blueprint_roadmap_add_phase`<br>`blueprint_artifact_scaffold` \| `blueprint-researcher` \|/
  );
  assert.match(
    mcpToolsDoc,
    /\| `blueprint_artifact_mutate_index` \| Append or update canonical capture entries in Blueprint indexes such as backlog, notes, and todos/
  );
});

test("capture runtime reference rows are source-owned, not docs-aligned active contracts", async () => {
  const runtimeReference = await readRepoFile("docs/RUNTIME-REFERENCE.md");
  const runtimeRows = parseRuntimeReferenceRows(runtimeReference);

  assert.match(
    runtimeReference,
    /Capture commands `note`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, and `explore` are source-owned\/docless for live runtime-contract metadata\./
  );
  assert.match(
    runtimeReference,
    /active runtime contract comes from `src\/mcp\/command-runtime-metadata\.ts`, the matching `commands\/blu-\*\.toml` manifest, and `skills\/blueprint-capture\/SKILL\.md` `input_bundles`/
  );

  for (const command of SOURCE_OWNED_CAPTURE_COMMANDS) {
    const row = runtimeRows.get(command);

    assert.ok(row, `Missing runtime reference row for ${command}`);
    assert.equal(row.commandSpecPath, `src/mcp/command-runtime-metadata.ts#${command}`);
    assert.equal(row.primarySkill, "blueprint-capture");
    assert.match(row.evidenceState, /`source-owned`/);
    assert.doesNotMatch(row.evidenceState, /`docs-aligned`/);
    assert.doesNotMatch(row.commandSpecPath, /^docs\/commands\//);
  }
});

test("do docs and router skill keep the planned freeform-routing contract explicit", async () => {
  const [catalogMarkdown, doDoc, routerSkill, runtimeReference, readme] = await Promise.all([
    readRepoFile("docs/COMMAND-CATALOG.md"),
    readRepoFile("docs/commands/do.md"),
    readRepoFile("skills/blueprint-router/SKILL.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md"),
    readRepoFile("README.md")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `do` \| 3 \| `Capture And Lightweight Execution` \| `blueprint-router` \| `planned` \| `none` \| `Low: routing only\.` \|/
  );
  assert.match(doDoc, /\| Execution profile \| `router` \|/);
  assert.match(
    doDoc,
    /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    doDoc,
    /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(doDoc, /Repo or status guidance routes to `help`, `progress`, or `next`\./);
  assert.match(
    doDoc,
    /Lightweight capture routes to `note`, `add-todo`, `add-backlog`, or `review-backlog`\./
  );
  assert.match(doDoc, /Idea shaping routes to `explore`\./);
  assert.match(doDoc, /Small execution routes to `fast`\./);
  assert.match(doDoc, /Bounded execution routes to `quick`\./);
  assert.match(
    doDoc,
    /Planning or lifecycle escalation routes to `discuss-phase` or `plan-phase`\./
  );
  assert.match(
    doDoc,
    /Never hide high-risk maintenance, git, workspace, shipping, cleanup, undo, or patch behavior behind vague freeform intent\./
  );
  assert.match(doDoc, /Never routes to planned, blocked, or repairing commands\./);
  assert.match(routerSkill, /## Planned `\/blu-do` Contract/);
  assert.match(
    routerSkill,
    /`\/blu-do` remains a planned direct freeform router contract until its own manifest ships\./
  );
  assert.match(routerSkill, /Repo or status guidance -> `help`, `progress`, `next`/);
  assert.match(
    routerSkill,
    /Lightweight capture -> `note`, `add-todo`, `add-backlog`, `review-backlog`/
  );
  assert.match(routerSkill, /Idea shaping -> `explore`/);
  assert.match(routerSkill, /Small execution -> `fast`/);
  assert.match(routerSkill, /Bounded execution -> `quick`/);
  assert.match(routerSkill, /Planning or lifecycle escalation -> `discuss-phase`, `plan-phase`/);
  assert.match(
    routerSkill,
    /`\/blu` is the front door, `\/blu-explore` is ideation with confirmation-gated persistence, and `\/blu-do` is the future direct freeform router\./
  );
  assert.match(
    runtimeReference,
    /\| `do` \| `docs\/commands\/do\.md` \| `blueprint-router` \| `blueprint_command_catalog`<br>`blueprint_project_status` \| none \| none \| Planned direct freeform router contract only: control-plane docs keep `\/blu-do` declared `planned`, while the live catalog may still derive `repairing` until the dedicated manifest ships\./
  );
  assert.match(
    runtimeReference,
    /Keep it non-routable until the catalog marks it `implemented`, use the documented intent taxonomy for repo\/status guidance, lightweight capture, ideation, small execution, bounded execution, and planning escalation/i
  );
  assert.match(
    runtimeReference,
    /never hide maintenance behavior or route to planned, blocked, or repairing commands\./i
  );
  assert.match(readme, /## Commands Not Public Yet/);
  assert.match(readme, /\/blu-do/);
  assert.match(
    readme,
    /control-plane docs keep it `planned`, but the live runtime keeps it non-routable until the dedicated manifest is shipped/i
  );
  assert.match(readme, /\/blu-workstreams/);
  assert.match(readme, /\/blu-update/);
  assert.doesNotMatch(readme, /## Commands Not Public Yet[\s\S]*\/blu-workstreams/);
  assert.doesNotMatch(readme, /## Commands Not Public Yet[\s\S]*\/blu-update/);
});

test("map-codebase docs history and runtime contract keep the repaired brownfield mapping behavior explicit", async () => {
  const [catalogMarkdown, commandDoc, skillDoc, mcpToolsDoc, runtimeContract] = await Promise.all([
    readRepoFile("docs/COMMAND-CATALOG.md"),
    readRepoFile("docs/commands/map-codebase.md"),
    readRepoFile("skills/blueprint-map/SKILL.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    buildBlueprintCommandRuntimeContractResource("map-codebase")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `map-codebase` \| 0 \| `Foundation` \| `blueprint-map` \| `implemented` \|/
  );
  assert.match(commandDoc, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(commandDoc, /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/);
  assert.match(commandDoc, /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/);
  assert.match(commandDoc, /reuse-versus-refresh posture explicit/i);
  assert.match(commandDoc, /focus-area deepening/i);
  assert.match(commandDoc, /ask_user/i);
  assert.match(commandDoc, /blueprint_artifact_contract_read/i);
  assert.match(commandDoc, /blueprint_artifact_scaffold/i);
  assert.match(commandDoc, /blueprint_artifact_summary_digest/i);
  assert.match(commandDoc, /blueprint_codebase_artifact_write/i);
  assert.match(commandDoc, /blueprint_artifact_validate/i);
  assert.match(commandDoc, /Existing codebase docs should be reused by default\./i);
  assert.match(skillDoc, /ask_user/i);
  assert.match(skillDoc, /blueprint_artifact_contract_read/i);
  assert.match(skillDoc, /Execution profile: `long-running-mutation`/);
  assert.match(skillDoc, /Keep the shared stage vocabulary explicit during non-trivial runs/i);
  assert.match(skillDoc, /Keep the in-flight status contract legible throughout the mapping pass/i);
  assert.match(skillDoc, /reuse-by-default behavior/i);
  assert.match(skillDoc, /reuse-versus-refresh guidance/i);
  assert.equal(runtimeContract.catalog.specPath, MAP_CODEBASE_RUNTIME_METADATA.sourceId);
  assert.equal(runtimeContract.spec?.path, MAP_CODEBASE_RUNTIME_METADATA.sourceId);
  assert.equal(
    runtimeContract.runtimeReference?.commandSpecPath,
    MAP_CODEBASE_RUNTIME_METADATA.sourceId
  );
  assert.deepEqual(
    runtimeContract.runtimeReference?.exactMcpDestination,
    [...MAP_CODEBASE_RUNTIME_METADATA.requiredTools]
  );
  assert.deepEqual(
    runtimeContract.runtimeReference?.optionalAgents,
    [...MAP_CODEBASE_RUNTIME_METADATA.optionalAgents]
  );
  assert.match(
    runtimeContract.runtimeReference?.contractNotes ?? "",
    /Long-running-mutation profile for read-heavy brownfield mapping/i
  );
  assert.match(runtimeContract.runtimeReference?.contractNotes ?? "", /local map runtime contract/i);
  assert.deepEqual(runtimeContract.skillInputs.shared, []);
  assert.deepEqual(
    runtimeContract.skillInputs.commandSpecific,
    [...(MAP_CODEBASE_RUNTIME_METADATA.requiredInputPaths ?? [])]
  );
  assert.deepEqual(
    runtimeContract.skillInputs.effective,
    [...(MAP_CODEBASE_RUNTIME_METADATA.requiredInputPaths ?? [])]
  );
  assert.equal(
    runtimeContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.match(
    mcpToolsDoc,
    /`map-codebase` uses `blueprint_project_status`, `blueprint_config_get`, `blueprint_artifact_contract_read`, `blueprint_artifact_scaffold`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_codebase_artifact_write`, and `blueprint_artifact_validate`/i
  );
});

test("add-todo docs and catalog metadata are marked implemented with the shipped capture tool", async () => {
  const [catalogMarkdown, addTodoDoc, migrationMarkdown] = await Promise.all([
    readRepoFile("docs/COMMAND-CATALOG.md"),
    readRepoFile("docs/commands/add-todo.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `add-todo` \| 3 \| `Capture And Lightweight Execution` \| `blueprint-capture` \| `implemented` \| `\.blueprint\/todos\/TODO\.md` \| `Low: todo index update only\.` \|/
  );
  assert.match(addTodoDoc, /Primary skill: `blueprint-capture`/);
  assert.match(addTodoDoc, /Argument hint: `<description>`/);
  assert.match(addTodoDoc, /## Required MCP Tools[\s\S]*`blueprint_artifact_mutate_index`/);
  assert.doesNotMatch(addTodoDoc, /`blueprint_state_update`/);
  assert.match(
    migrationMarkdown,
    /\| `add-todo` \| `src\/mcp\/command-runtime-metadata\.ts#add-todo` \| `blueprint-capture` \| `blueprint_artifact_mutate_index` \|/
  );
});

test("check-todos docs and catalog metadata are marked implemented with the shipped todo-review tools", async () => {
  const [catalogMarkdown, checkTodosDoc, migrationMarkdown] = await Promise.all([
    readRepoFile("docs/COMMAND-CATALOG.md"),
    readRepoFile("docs/commands/check-todos.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `check-todos` \| 3 \| `Capture And Lightweight Execution` \| `blueprint-capture` \| `implemented` \| `todo status fields when selection or completion changes` \| `Low: todo selection and status update only\.` \|/
  );
  assert.match(checkTodosDoc, /Primary skill: `blueprint-capture`/);
  assert.match(checkTodosDoc, /Argument hint: `\[area filter\]`/);
  assert.match(checkTodosDoc, /## Required MCP Tools[\s\S]*`blueprint_artifact_mutate_index`/);
  assert.match(checkTodosDoc, /## Required MCP Tools[\s\S]*`blueprint_project_status`/);
  assert.match(checkTodosDoc, /Confirm active or completed status changes before writing them\./);
  assert.doesNotMatch(checkTodosDoc, /`blueprint_state_update`/);
  assert.match(
    migrationMarkdown,
    /\| `check-todos` \| `src\/mcp\/command-runtime-metadata\.ts#check-todos` \| `blueprint-capture` \| `blueprint_artifact_mutate_index`<br>`blueprint_project_status` \|/
  );
});

test("review-backlog docs and catalog metadata are marked implemented with the backlog-promotion tool", async () => {
  const [catalogMarkdown, reviewBacklogDoc, mcpToolsDoc, migrationMarkdown] = await Promise.all([
    readRepoFile("docs/COMMAND-CATALOG.md"),
    readRepoFile("docs/commands/review-backlog.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `review-backlog` \| 3 \| `Capture And Lightweight Execution` \| `blueprint-capture` \| `implemented` \|/
  );
  assert.match(reviewBacklogDoc, /Primary skill: `blueprint-capture`/);
  assert.match(reviewBacklogDoc, /## Required MCP Tools[\s\S]*`blueprint_artifact_mutate_index`/);
  assert.match(reviewBacklogDoc, /## Required MCP Tools[\s\S]*`blueprint_roadmap_promote_backlog`/);
  assert.match(reviewBacklogDoc, /## Required MCP Tools[\s\S]*`blueprint_state_update`/);
  assert.match(reviewBacklogDoc, /reserved `999\.x` stubs/i);
  assert.match(reviewBacklogDoc, /Promoted backlog items become active roadmap phases without deleting backlog history\./);
  assert.match(
    mcpToolsDoc,
    /\| `blueprint_roadmap_promote_backlog` \| Preview backlog items or promote confirmed items into appended roadmap phases while reusing reserved `999\.x` phase stubs when present/
  );
  assert.match(
    migrationMarkdown,
    /\| `review-backlog` \| `src\/mcp\/command-runtime-metadata\.ts#review-backlog` \| `blueprint-capture` \| `blueprint_artifact_mutate_index`<br>`blueprint_roadmap_promote_backlog`<br>`blueprint_state_update` \|/
  );
});

test("list-phase-assumptions docs stay read-only and use the discovery MCP tools", async () => {
  const [commandDoc, skillsMarkdown] = await Promise.all([
    readRepoFile("docs/commands/list-phase-assumptions.md"),
    readRepoFile("docs/SKILLS-AND-AGENTS.md")
  ]);

  assert.match(commandDoc, /Primary skill: `blueprint-phase-discovery`/);
  assert.match(commandDoc, /Repo side effects: No durable artifact writes are planned\./);
  assert.match(commandDoc, /## Blueprint And Global State Writes[\s\S]*none/);
  assert.match(commandDoc, /## Required MCP Tools[\s\S]*`blueprint_phase_locate`/);
  assert.match(commandDoc, /## Required MCP Tools[\s\S]*`blueprint_phase_context`/);
  assert.match(commandDoc, /## Required MCP Tools[\s\S]*`blueprint_roadmap_read`/);
  assert.match(commandDoc, /## Required MCP Tools[\s\S]*`blueprint_project_status`/);
  assert.match(commandDoc, /Shell Risk Profile[\s\S]*Low: read-only analysis\./);
  assert.match(
    skillsMarkdown,
    /\| `blueprint-phase-discovery` \| `implemented` \| Pre-planning discovery and requirements shaping \| `discuss-phase`, `research-phase`, `ui-phase`, `list-phase-assumptions` \|/
  );
});

test("phase planning skill and bounded planning agents are marked implemented in docs", async () => {
  const skillsMarkdown = await readRepoFile("docs/SKILLS-AND-AGENTS.md");

  assert.match(
    skillsMarkdown,
    /\| `blueprint-phase-planning` \| `implemented` \| Plan synthesis, plan checks, and phase plan persistence \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-planner` \| `implemented` \| Create plan files \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-checker` \| `implemented` \| Verify plan quality before execution and UI-spec readiness before persistence \|/
  );
});

test("phase execution skill and bounded execution agent are marked implemented in docs", async () => {
  const skillsMarkdown = await readRepoFile("docs/SKILLS-AND-AGENTS.md");

  assert.match(
    skillsMarkdown,
    /\| `blueprint-phase-execution` \| `implemented` \| Plan execution, bounded quick delivery, and durable execution evidence \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-executor` \| `implemented` \| Execute plan tasks and produce summaries \|/
  );
});

test("execute-phase source-owned runtime metadata keeps the trimmed common read path and hard lifecycle gates explicit", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("execute-phase");
  const contract = await buildBlueprintCommandRuntimeContractResource("execute-phase");

  assert.ok(metadata);
  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.deepEqual(contract.spec.requiredTools, [...metadata.requiredTools]);
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /Long-running-mutation profile; keep Resolve\/Read\/Decide\/Execute\/Persist\/Validate\/Route narration/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /pair Gemini-native update_topic and write_todos for long execution runs without turning them into persistence/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /use blueprint_phase_execution_targets as the common read authority/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /selectedPlans, existingSummaries, blockers, and conflicts as the default public metadata source/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /read plan bodies through blueprint_phase_plan_read only for the selected plans/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /read blueprint_phase_summary_read only when overwrite or repair reasoning truly needs existing summary body text/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /keep blueprint_artifact_contract_read with artifactId: "phase\.summary"/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /do not treat blueprint_artifact_validate or blueprint_state_load as default pre-write gates on the common path/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /preserve wave order, lower-wave blockers, gap-only routing, overlap detection, and external-service confirmation through execution_targets/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /keep the post-write sequence as blueprint_phase_summary_index followed by blueprint_artifact_validate and blueprint_state_update with base: "synced"/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /never persist execute-phase reports/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /never claim phase completion before validation and verification evidence exists/i
  );
});

test("quick command docs keep the bounded report-backed execution contract explicit", async () => {
  const quickDoc = await readRepoFile("docs/commands/quick.md");

  assert.match(quickDoc, /Primary skill: `blueprint-phase-execution`/);
  assert.match(quickDoc, /blueprint_project_status/);
  assert.match(quickDoc, /blueprint_config_get/);
  assert.match(quickDoc, /blueprint_command_catalog/);
  assert.match(quickDoc, /blueprint_artifact_report_write/);
  assert.match(quickDoc, /blueprint_state_update/);
  assert.match(quickDoc, /quick-run-latest\.md/);
  assert.match(quickDoc, /Confirm optional discuss, research, or full verification modes before starting\./);
  assert.match(quickDoc, /Leaves unrelated repo files untouched/i);
});

test("debug skill and bounded debugger agent are marked implemented in docs", async () => {
  const skillsMarkdown = await readRepoFile("docs/SKILLS-AND-AGENTS.md");

  assert.match(
    skillsMarkdown,
    /\| `blueprint-debug` \| `implemented` \| Debug investigations and recovery plans \| `debug` \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-debugger` \| `implemented` \| Run structured debugging investigations \|/
  );
});

test("debug command docs keep the report-backed investigation contract explicit", async () => {
  const debugDoc = await readRepoFile("docs/commands/debug.md");

  assert.match(debugDoc, /Primary skill: `blueprint-debug`/);
  assert.match(debugDoc, /blueprint_project_status/);
  assert.match(debugDoc, /blueprint_config_get/);
  assert.match(debugDoc, /blueprint_artifact_report_write/);
  assert.match(debugDoc, /blueprint_artifact_mutate_index/);
  assert.match(debugDoc, /blueprint_state_update/);
  assert.match(debugDoc, /debug-latest\.md/);
  assert.match(debugDoc, /diagnose-only mode/i);
  assert.match(debugDoc, /Leaves unrelated repo files untouched/i);
});

test("fast command docs keep the trivial inline execution contract explicit", async () => {
  const fastDoc = await readRepoFile("docs/commands/fast.md");

  assert.match(fastDoc, /\| Execution profile \| `interactive-read` \|/);
  assert.match(fastDoc, /## Shared Runtime Contract/);
  assert.match(fastDoc, /Primary skill: `blueprint-phase-execution`/);
  assert.match(fastDoc, /blueprint_project_status/);
  assert.match(fastDoc, /blueprint_state_update/);
  assert.match(fastDoc, /optional `?\.blueprint\/STATE\.md`?/);
  assert.match(fastDoc, /May run inside or outside a Blueprint project/);
  assert.match(fastDoc, /no subagents, no planning overhead/i);
  assert.match(fastDoc, /does not adopt tracker-backed branching or the long-running progress layer used by `quick` and lifecycle execution/i);
  assert.match(fastDoc, /Do not use `update_topic`, `write_todos`, or tracker tools to make a trivial run look long-running\./);
  assert.match(fastDoc, /Explicitly excludes `update_topic`, `write_todos`, tracker-backed branching, and other long-running progress behavior\./);
  assert.match(fastDoc, /Does not create quick-run reports, phase artifacts, or subagent side effects\./);
  assert.match(fastDoc, /Leaves unrelated repo files untouched/i);
});

test("phase validation skill and bounded verifier agent are marked implemented in docs", async () => {
  const skillsMarkdown = await readRepoFile("docs/SKILLS-AND-AGENTS.md");

  assert.match(
    skillsMarkdown,
    /\| `blueprint-phase-validation` \| `implemented` \| Verification, UAT, tests, and gap closure \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-verifier` \| `implemented` \| Verify execution results and UAT evidence \|/
  );
});

test("docs skill and bounded docs agents are marked implemented in docs", async () => {
  const skillsMarkdown = await readRepoFile("docs/SKILLS-AND-AGENTS.md");

  assert.match(
    skillsMarkdown,
    /\| `blueprint-docs` \| `implemented` \| Documentation generation and verification \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-doc-writer` \| `implemented` \| Draft scoped repo documentation updates \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-doc-verifier` \| `implemented` \| Fact-check repo docs against saved evidence \|/
  );
});

test("review skill docs and secure-phase manifest keep security runtime ownership explicit", async () => {
  const [skillsMarkdown, securePhaseManifest] = await Promise.all([
    readRepoFile("docs/SKILLS-AND-AGENTS.md"),
    readRepoFile("commands/blu-secure-phase.toml")
  ]);

  assert.match(
    skillsMarkdown,
    /\| `blueprint-review` \| `implemented` \| Reviews, bounded remediation, security, UI, peer review \| `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `ui-review`, `review` \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-security-auditor` \| `implemented` \| Verify threat mitigations and security coverage \|/
  );
  assert.match(securePhaseManifest, /Use the `blueprint-review` skill/);
  assert.match(securePhaseManifest, /blueprint_phase_plan_index/);
  assert.match(securePhaseManifest, /blueprint_phase_plan_read/);
  assert.match(securePhaseManifest, /blueprint_artifact_contract_read/);
  assert.match(securePhaseManifest, /review\.security/);
  assert.match(securePhaseManifest, /blueprint_review_record/);
  assert.match(securePhaseManifest, /`blueprint-security-auditor` subagent/);
  assert.match(securePhaseManifest, /XX-SECURITY\.md/);
});

test("ui-review manifest, runtime resource, and UI auditor docs stay aligned", async () => {
  const [skillsMarkdown, uiReviewManifest, mcpToolsDoc, contract] = await Promise.all([
    readRepoFile("docs/SKILLS-AND-AGENTS.md"),
    readRepoFile("commands/blu-ui-review.toml"),
    readRepoFile("docs/MCP-TOOLS.md"),
    buildBlueprintCommandRuntimeContractResource("ui-review")
  ]);

  assert.match(
    skillsMarkdown,
    /\| `blueprint-ui-auditor` \| `implemented` \| Perform retroactive six-pillar UI audits \|/
  );
  assert.match(uiReviewManifest, /Use the `blueprint-review` skill/);
  assert.match(uiReviewManifest, /blueprint_phase_locate/);
  assert.match(uiReviewManifest, /blueprint_artifact_list/);
  assert.match(uiReviewManifest, /blueprint_artifact_contract_read/);
  assert.match(uiReviewManifest, /blueprint_review_authoring_context/);
  assert.match(uiReviewManifest, /blueprint_review_validate_model/);
  assert.match(uiReviewManifest, /blueprint_review_record/);
  assert.match(uiReviewManifest, /`blueprint-ui-auditor` subagent/);
  assert.match(uiReviewManifest, /XX-UI-REVIEW\.md/);
  assert.match(
    mcpToolsDoc,
    /`ui-review` uses `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_artifact_contract_read`, `blueprint_config_get`, `blueprint_review_authoring_context`, `blueprint_review_validate_model`, and `blueprint_review_record`/
  );
  assert.equal(contract.runtimeReference?.commandSpecPath, "src/mcp/command-runtime-metadata.ts#ui-review");
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    "blueprint_phase_locate",
    "blueprint_artifact_list",
    "blueprint_artifact_contract_read",
    "blueprint_config_get",
    "blueprint_review_authoring_context",
    "blueprint_review_validate_model",
    "blueprint_review_record"
  ]);
});

test("maintenance skill and pr-branch docs keep the review-branch contract explicit", async () => {
  const [skillsMarkdown, prBranchDoc, mcpToolsDoc, migrationMarkdown] = await Promise.all([
    readRepoFile("docs/SKILLS-AND-AGENTS.md"),
    readRepoFile("docs/commands/pr-branch.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(
    skillsMarkdown,
    /\| `blueprint-maintenance` \| `implemented` \| Git, review-branch prep, workspace, cleanup, update, and patch operations \| `pr-branch`, `ship`, `undo`, `new-workspace`, `remove-workspace`, `workstreams`, `cleanup`, `update`, `reapply-patches` \|/
  );
  assert.match(prBranchDoc, /Primary skill: `blueprint-maintenance`/);
  assert.match(prBranchDoc, /blueprint_project_status/);
  assert.match(prBranchDoc, /blueprint_config_get/);
  assert.match(prBranchDoc, /blueprint_artifact_summary_digest/);
  assert.match(prBranchDoc, /blueprint_artifact_contract_read/);
  assert.match(prBranchDoc, /blueprint_artifact_report_write/);
  assert.match(prBranchDoc, /pr-branch-latest\.md/);
  assert.match(prBranchDoc, /Preserves the source branch/i);
  assert.match(prBranchDoc, /planning\.commit_docs/);
  assert.match(
    mcpToolsDoc,
    /`pr-branch` uses `blueprint_project_status`, `blueprint_config_get`, `blueprint_artifact_summary_digest`, `blueprint_artifact_contract_read`, and `blueprint_artifact_report_write`/
  );
  assert.match(
    migrationMarkdown,
    /\| `pr-branch` \| `src\/mcp\/command-runtime-metadata\.ts#pr-branch` \| `blueprint-maintenance` \| `blueprint_project_status`<br>`blueprint_config_get`<br>`blueprint_artifact_summary_digest`<br>`blueprint_artifact_contract_read`<br>`blueprint_artifact_report_write` \|/
  );
});

test("maintenance skill and workstreams docs keep the project-local workstream contract explicit", async () => {
  const [workstreamsDoc, mcpToolsDoc, migrationMarkdown] = await Promise.all([
    readRepoFile("docs/commands/workstreams.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(workstreamsDoc, /Primary skill: `blueprint-maintenance`/);
  assert.match(workstreamsDoc, /`blueprint_workstream_list`/);
  assert.match(workstreamsDoc, /`blueprint_workstream_mutate`/);
  assert.match(workstreamsDoc, /`blueprint_state_update`/);
  assert.match(workstreamsDoc, /`ask_user`/);
  assert.match(workstreamsDoc, /workstream-switch-confirmation/);
  assert.match(workstreamsDoc, /missing-resume-snapshot/);
  assert.match(workstreamsDoc, /\.blueprint\/workstreams\/<slug>\/state\.json/);
  assert.match(
    mcpToolsDoc,
    /`workstreams` uses `blueprint_workstream_list`, `blueprint_workstream_mutate`, and `blueprint_state_update`/
  );
  assert.match(
    migrationMarkdown,
    /\| `workstreams` \| `src\/mcp\/command-runtime-metadata\.ts#workstreams` \| `blueprint-maintenance` \| `blueprint_workstream_list`<br>`blueprint_workstream_mutate`<br>`blueprint_state_update` \|/
  );
});

test("maintenance skill and ship docs keep the shipping contract explicit", async () => {
  const [shipDoc, mcpToolsDoc, migrationMarkdown] = await Promise.all([
    readRepoFile("docs/commands/ship.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(shipDoc, /Primary skill: `blueprint-maintenance`/);
  assert.match(shipDoc, /`blueprint_project_status`/);
  assert.match(shipDoc, /`blueprint_phase_locate`/);
  assert.match(shipDoc, /`blueprint_config_get`/);
  assert.match(shipDoc, /`blueprint_artifact_list`/);
  assert.match(shipDoc, /`blueprint_artifact_summary_digest`/);
  assert.match(shipDoc, /`blueprint_artifact_contract_read`/);
  assert.match(shipDoc, /`blueprint_artifact_report_write`/);
  assert.match(shipDoc, /`blueprint_state_update`/);
  assert.match(shipDoc, /ship-latest\.md/);
  assert.match(shipDoc, /contract\.authoringTemplate/);
  assert.match(shipDoc, /Confirm draft versus ready state/i);
  assert.match(shipDoc, /manual fallback/i);
  assert.match(
    mcpToolsDoc,
    /`ship` uses `blueprint_project_status`, `blueprint_phase_locate`, `blueprint_config_get`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, and `blueprint_state_update`/
  );
  assert.match(
    mcpToolsDoc,
    /The full shipping flow also reads `blueprint_artifact_contract_read` so it can load the canonical `report\.ship` contract and use `contract\.authoringTemplate` before it persists `ship-latest`/i
  );
  assert.match(
    migrationMarkdown,
    /\| `ship` \| `src\/mcp\/command-runtime-metadata\.ts#ship` \| `blueprint-maintenance` \| `blueprint_project_status`<br>`blueprint_phase_locate`<br>`blueprint_config_get`<br>`blueprint_artifact_list`<br>`blueprint_artifact_summary_digest`<br>`blueprint_artifact_contract_read`<br>`blueprint_artifact_report_write`<br>`blueprint_state_update` \|/
  );
});

test("maintenance skill and cleanup docs keep the archival contract explicit", async () => {
  const [cleanupDoc, mcpToolsDoc, migrationMarkdown] = await Promise.all([
    readRepoFile("docs/commands/cleanup.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(cleanupDoc, /Primary skill: `blueprint-maintenance`/);
  assert.match(cleanupDoc, /`blueprint_project_status`/);
  assert.match(cleanupDoc, /`blueprint_roadmap_read`/);
  assert.match(cleanupDoc, /`blueprint_artifact_list`/);
  assert.match(cleanupDoc, /`blueprint_artifact_summary_digest`/);
  assert.match(cleanupDoc, /`blueprint_artifact_report_write`/);
  assert.match(cleanupDoc, /`blueprint_state_update`/);
  assert.match(cleanupDoc, /cleanup-latest\.md/);
  assert.match(cleanupDoc, /Require confirmation before moving or deleting/i);
  assert.match(cleanupDoc, /Never archives the current phase/i);
  assert.match(
    mcpToolsDoc,
    /`cleanup` uses `blueprint_project_status`, `blueprint_roadmap_read`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, and `blueprint_state_update`/
  );
  assert.match(
    migrationMarkdown,
    /\| `cleanup` \| `src\/mcp\/command-runtime-metadata\.ts#cleanup` \| `blueprint-maintenance` \| `blueprint_project_status`<br>`blueprint_roadmap_read`<br>`blueprint_artifact_list`<br>`blueprint_artifact_summary_digest`<br>`blueprint_artifact_report_write`<br>`blueprint_state_update` \|/
  );
});

test("maintenance skill and remove-workspace docs keep the workspace-teardown contract explicit", async () => {
  const [removeWorkspaceDoc, mcpToolsDoc, migrationMarkdown, skillDoc] = await Promise.all([
    readRepoFile("docs/commands/remove-workspace.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md"),
    readRepoFile("skills/blueprint-maintenance/SKILL.md")
  ]);

  assert.match(removeWorkspaceDoc, /Primary skill: `blueprint-maintenance`/);
  assert.match(removeWorkspaceDoc, /\| Execution profile \| `high-risk-maintenance` \|/);
  assert.match(removeWorkspaceDoc, /## Shared Runtime Contract/);
  assert.match(removeWorkspaceDoc, /`blueprint_workspace_registry_get`/);
  assert.match(removeWorkspaceDoc, /`blueprint_workspace_remove`/);
  assert.match(removeWorkspaceDoc, /remove-workspace-confirmation/);
  assert.match(removeWorkspaceDoc, /workspace-path-ambiguity/);
  assert.match(removeWorkspaceDoc, /registry-drift/);
  assert.match(removeWorkspaceDoc, /\.blueprint-workspace\.json/);
  assert.match(skillDoc, /### `remove-workspace`/);
  assert.match(skillDoc, /`blueprint_workspace_remove`/);
  assert.match(
    mcpToolsDoc,
    /`remove-workspace` uses `blueprint_workspace_registry_get` and `blueprint_workspace_remove`/
  );
  assert.match(
    migrationMarkdown,
    /\| `remove-workspace` \| `src\/mcp\/command-runtime-metadata\.ts#remove-workspace` \| `blueprint-maintenance` \| `blueprint_workspace_registry_get`<br>`blueprint_workspace_remove` \|/
  );
});

test("maintenance skill and update docs keep the advisory update contract explicit", async () => {
  const [updateDoc, mcpToolsDoc, runtimeReference] = await Promise.all([
    readRepoFile("docs/commands/update.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(updateDoc, /Primary skill: `blueprint-maintenance`/);
  assert.match(updateDoc, /\| Execution profile \| `interactive-read` \|/);
  assert.match(updateDoc, /`blueprint_update_check`/);
  assert.match(updateDoc, /`blueprint_update_plan`/);
  assert.match(updateDoc, /`ask_user`/);
  assert.match(updateDoc, /manual fallback/i);
  assert.match(updateDoc, /update-plan-latest\.json/);
  assert.match(updateDoc, /update-plan-latest\.md/);
  assert.match(updateDoc, /restart guidance/i);
  assert.match(
    mcpToolsDoc,
    /`update` uses `blueprint_update_check` and `blueprint_update_plan` to keep extension-path handling read-only/i
  );
  assert.match(
    runtimeReference,
    /\| `update` \| `src\/mcp\/command-runtime-metadata\.ts#update` \| `blueprint-maintenance` \| `blueprint_update_check`<br>`blueprint_update_plan` \|/
  );
});

test("maintenance skill and undo docs keep the safe-revert contract explicit", async () => {
  const [undoDoc, mcpToolsDoc, migrationMarkdown] = await Promise.all([
    readRepoFile("docs/commands/undo.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(undoDoc, /Primary skill: `blueprint-maintenance`/);
  assert.match(undoDoc, /`blueprint_project_status`/);
  assert.match(undoDoc, /`blueprint_phase_locate`/);
  assert.match(undoDoc, /`blueprint_artifact_list`/);
  assert.match(undoDoc, /`blueprint_artifact_summary_digest`/);
  assert.match(undoDoc, /`blueprint_artifact_contract_read`/);
  assert.match(undoDoc, /`blueprint_artifact_report_write`/);
  assert.match(undoDoc, /`blueprint_state_update`/);
  assert.match(undoDoc, /undo-latest\.md/);
  assert.match(undoDoc, /contract\.authoringTemplate/);
  assert.match(undoDoc, /git revert/i);
  assert.match(undoDoc, /git reset --hard/i);
  assert.match(
    mcpToolsDoc,
    /`undo` uses `blueprint_project_status`, `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, and `blueprint_state_update`/
  );
  assert.match(
    mcpToolsDoc,
    /The full undo flow also reads `blueprint_artifact_contract_read` so it can load the canonical `report\.undo` contract and use `contract\.authoringTemplate` before it persists `undo-latest`/i
  );
  assert.match(
    migrationMarkdown,
    /\| `undo` \| `src\/mcp\/command-runtime-metadata\.ts#undo` \| `blueprint-maintenance` \| `blueprint_project_status`<br>`blueprint_phase_locate`<br>`blueprint_artifact_list`<br>`blueprint_artifact_summary_digest`<br>`blueprint_artifact_contract_read`<br>`blueprint_artifact_report_write`<br>`blueprint_state_update` \|/
  );
});

test("code-review manifest, runtime resource, and reviewer docs stay aligned", async () => {
  const [skillsMarkdown, codeReviewManifest, contract] = await Promise.all([
    readRepoFile("docs/SKILLS-AND-AGENTS.md"),
    readRepoFile("commands/blu-code-review.toml"),
    buildBlueprintCommandRuntimeContractResource("code-review")
  ]);

  assert.match(
    skillsMarkdown,
    /\| `blueprint-reviewer` \| `implemented` \| Produce bounded code review findings from a resolved Blueprint scope \|/
  );
  assert.match(codeReviewManifest, /Use the `blueprint-review` skill/);
  assert.match(codeReviewManifest, /Execution profile: `long-running-mutation`/);
  assert.match(codeReviewManifest, /runtime contract's shared review posture/i);
  assert.match(codeReviewManifest, /update_topic/);
  assert.match(codeReviewManifest, /blueprint_review_scope/);
  assert.match(codeReviewManifest, /blueprint_review_load_findings/);
  assert.match(codeReviewManifest, /blueprint_review_validate_model/);
  assert.match(codeReviewManifest, /blueprint-reviewer/);
  assert.match(codeReviewManifest, /XX-REVIEW\.md/);
  assert.equal(contract.runtimeReference?.commandSpecPath, "src/mcp/command-runtime-metadata.ts#code-review");
  assert.deepEqual(contract.runtimeReference?.optionalAgents, ["blueprint-reviewer"]);
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /Long-running-mutation profile for deterministic phase-scoped review/i
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /update_topic and write_todos for non-trivial review runs/i
  );
});

test("review manifest and runtime resource keep the peer-review contract explicit", async () => {
  const [reviewManifest, mcpToolsDoc, catalogMarkdown, contract] = await Promise.all([
    readRepoFile("commands/blu-review.toml"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/COMMAND-CATALOG.md"),
    buildBlueprintCommandRuntimeContractResource("review")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `review` \| 4 \| `Quality And Shipping` \| `blueprint-review` \| `implemented` \| `phase XX-REVIEWS\.md` \| `Medium: external reviewer orchestration without default repo mutation\.` \|/
  );
  assert.match(reviewManifest, /Use the `blueprint-review` skill/);
  assert.match(reviewManifest, /blueprint_phase_locate/);
  assert.match(reviewManifest, /blueprint_artifact_list/);
  assert.match(reviewManifest, /blueprint_phase_plan_index/);
  assert.match(reviewManifest, /blueprint_phase_plan_read/);
  assert.match(reviewManifest, /blueprint_phase_summary_index/);
  assert.match(reviewManifest, /blueprint_phase_execution_targets/);
  assert.match(reviewManifest, /blueprint_review_authoring_context/);
  assert.match(reviewManifest, /blueprint_review_validate_model/);
  assert.match(reviewManifest, /blueprint_review_record/);
  assert.match(reviewManifest, /XX-REVIEWS\.md/);
  assert.match(reviewManifest, /Preserve partial fan-out results/i);
  assert.match(reviewManifest, /preserve the disagreement/i);
  assert.match(
    mcpToolsDoc,
    /`review` uses `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_artifact_contract_read`, `blueprint_config_get`, `blueprint_phase_plan_index`, `blueprint_phase_plan_read`, `blueprint_phase_summary_index`, `blueprint_phase_summary_read`, `blueprint_phase_execution_targets`, `blueprint_review_authoring_context`, `blueprint_review_validate_model`, and `blueprint_review_record`/
  );
  assert.equal(contract.runtimeReference?.commandSpecPath, "src/mcp/command-runtime-metadata.ts#review");
  assert.deepEqual(contract.runtimeReference?.optionalAgents, ["blueprint-reviewer"]);
  assert.match(contract.runtimeReference?.contractNotes ?? "", /saved-plan peer review/i);
});

test("audit-fix manifest and runtime contract keep the remediation contract explicit", async () => {
  const [auditFixManifest, mcpToolsDoc, runtimeContract, contract] = await Promise.all([
    readRepoFile("commands/blu-audit-fix.toml"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("skills/blueprint-review/references/audit-fix-runtime-contract.md"),
    buildBlueprintCommandRuntimeContractResource("audit-fix")
  ]);

  assert.match(auditFixManifest, /Use the `blueprint-review` skill/);
  assert.match(auditFixManifest, /blueprint_phase_locate/);
  assert.match(auditFixManifest, /blueprint_artifact_list/);
  assert.match(auditFixManifest, /blueprint_review_scope/);
  assert.match(auditFixManifest, /blueprint_artifact_contract_read/);
  assert.match(auditFixManifest, /blueprint_artifact_report_authoring_context/);
  assert.match(auditFixManifest, /blueprint_artifact_report_validate_model/);
  assert.match(auditFixManifest, /blueprint_artifact_report_write/);
  assert.match(auditFixManifest, /blueprint_artifact_mutate_index/);
  assert.match(auditFixManifest, /blueprint_state_update/);
  assert.match(auditFixManifest, /--source <review\|security\|verification\|uat\|all>/);
  assert.match(auditFixManifest, /--severity <medium\|high\|all>/);
  assert.match(auditFixManifest, /--max <N>/);
  assert.match(auditFixManifest, /--dry-run/);
  assert.match(auditFixManifest, /ask_user/);
  assert.match(auditFixManifest, /resolved scope, active stage, pending gate, execution mode, and next safe action/);
  assert.match(auditFixManifest, /Stop on the first failed mutation or failed required verification/);
  assert.match(auditFixManifest, /commit traceability/i);
  assert.match(auditFixManifest, /Treat `blueprint-fixer` as planned-only inventory/);
  assert.match(auditFixManifest, /audit-fix-runtime-contract\.md/);
  assert.match(auditFixManifest, /auditFixContext \{source, severity, maxAttempts, dryRun, scopeFiles\}/i);
  assert.match(auditFixManifest, /classification table/i);
  assert.match(runtimeContract, /No browser\/web\/search-only or generic agent was used as a substitute/i);
  assert.match(auditFixManifest, /\.blueprint\/reports\/audit-fix-<phase>\.md/);
  assert.match(
    mcpToolsDoc,
    /`audit-fix` uses `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_review_scope`, `blueprint_artifact_contract_read`, `blueprint_config_get`, `blueprint_artifact_report_authoring_context`, `blueprint_artifact_report_validate_model`, `blueprint_artifact_report_write`, `blueprint_artifact_mutate_index`, and `blueprint_state_update` to keep audit-driven remediation evidence-first/
  );
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    "blueprint_phase_locate",
    "blueprint_artifact_list",
    "blueprint_review_scope",
    "blueprint_artifact_contract_read",
    "blueprint_config_get",
    "blueprint_artifact_report_authoring_context",
    "blueprint_artifact_report_validate_model",
    "blueprint_artifact_report_write",
    "blueprint_artifact_mutate_index",
    "blueprint_state_update"
  ]);
  assert.match(
    runtimeContract,
    /confirmation-gated\s+when non-trivial/
  );
  assert.match(
    runtimeContract,
    /Selected evidence was read before classification/
  );
  assert.match(runtimeContract, /auditFixContext \{source, severity, maxAttempts,\s+dryRun, scopeFiles\}/i);
  assert.match(
    runtimeContract,
    /repair retry/i
  );
  assert.match(
    runtimeContract,
    /`blueprint-fixer` remained planned-only and non-routable/
  );
  assert.equal(contract.runtimeReference?.commandSpecPath, "src/mcp/command-runtime-metadata.ts#audit-fix");
});

test("code-review-fix manifest and runtime resource keep review remediation explicit", async () => {
  const [codeReviewFixManifest, mcpToolsDoc, contract] = await Promise.all([
    readRepoFile("commands/blu-code-review-fix.toml"),
    readRepoFile("docs/MCP-TOOLS.md"),
    buildBlueprintCommandRuntimeContractResource("code-review-fix")
  ]);

  assert.match(codeReviewFixManifest, /Use the `blueprint-review` skill/);
  assert.match(codeReviewFixManifest, /blueprint_phase_locate/);
  assert.match(codeReviewFixManifest, /blueprint_review_load_findings/);
  assert.match(codeReviewFixManifest, /blueprint_review_authoring_context/);
  assert.match(codeReviewFixManifest, /blueprint_review_validate_model/);
  assert.match(codeReviewFixManifest, /blueprint_review_record/);
  assert.match(codeReviewFixManifest, /blueprint_state_update/);
  assert.match(codeReviewFixManifest, /resolved scope, active stage, pending gate, execution mode, and next safe action/);
  assert.match(codeReviewFixManifest, /`--auto` as bounded automatic finding selection only/i);
  assert.match(codeReviewFixManifest, /XX-REVIEW-FIX\.md/);
  assert.match(codeReviewFixManifest, /exact selected saved target ids as `targetIds`/);
  assert.match(codeReviewFixManifest, /Markdown `content` fallback is invalid/);
  assert.match(
    mcpToolsDoc,
    /`code-review-fix` uses `blueprint_phase_locate`, `blueprint_config_get`, `blueprint_review_load_findings`, `blueprint_review_authoring_context`, `blueprint_review_validate_model`, `blueprint_review_record`, and `blueprint_state_update`/
  );
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    "src/mcp/command-runtime-metadata.ts#code-review-fix"
  );
  assert.deepEqual(contract.runtimeReference?.optionalAgents, ["blueprint-reviewer"]);
});

test("add-phase command docs keep the roadmap append contract explicit", async () => {
  const addPhaseDoc = await readRepoFile("docs/commands/add-phase.md");

  assert.match(addPhaseDoc, /Primary skill: `blueprint-roadmap-admin`/);
  assert.match(addPhaseDoc, /blueprint_roadmap_read/);
  assert.match(addPhaseDoc, /blueprint_roadmap_add_phase/);
  assert.match(addPhaseDoc, /blueprint_artifact_scaffold/);
  assert.match(addPhaseDoc, /blueprint_state_update/);
  assert.match(addPhaseDoc, /non-empty phase description is required/i);
  assert.match(addPhaseDoc, /next integer after the highest base phase number/i);
  assert.match(addPhaseDoc, /Preview the exact computed next integer phase number from the roadmap read result before append\./);
  assert.match(
    addPhaseDoc,
    /Use Gemini CLI's built-in `ask_user` dialog for the structured confirmation gate instead of prose-only confirmation when the user must approve that exact phase number\./
  );
  assert.match(addPhaseDoc, /expectedPhaseNumber/);
  assert.match(addPhaseDoc, /Safe default: stop without writing/);
  assert.match(addPhaseDoc, /named in-flight receipt/i);
  assert.match(addPhaseDoc, /command response receipt only/i);
  assert.match(addPhaseDoc, /does not create `?\.blueprint\/receipts`?, `?\.blueprint\/runs`?/i);
  assert.match(addPhaseDoc, /successCriteriaCount/);
  assert.match(addPhaseDoc, /contextScaffoldPath/);
  assert.match(addPhaseDoc, /stateRoute/);
  assert.match(addPhaseDoc, /safeRetry/);
  assert.match(addPhaseDoc, /Mutation not attempted/);
  assert.match(addPhaseDoc, /Roadmap mutation succeeded, scaffold failed/);
  assert.match(addPhaseDoc, /Scaffold succeeded, state update failed/);
  assert.match(addPhaseDoc, /Same preview and same returned files on retry/);
  assert.match(addPhaseDoc, /Same confirmation token but changed params or files/);
  assert.match(addPhaseDoc, /Stale `expectedPhaseNumber`/);
  assert.match(addPhaseDoc, /Undeclared `requirementIds`/);
  assert.match(addPhaseDoc, /Missing returned metadata/);
  assert.match(addPhaseDoc, /Refuses to append when the confirmed next phase number is stale\./);
  assert.match(
    addPhaseDoc,
    /Returns `\/blu-discuss-phase <new phase number>` as the next safe Blueprint follow-up\./
  );
  assert.match(addPhaseDoc, /\.blueprint\/phases\/<phase-slug>\//);
  for (const snippet of [
    "Shared phase-admin spine",
    "phase-number-confirmation",
    "requirement source",
    "auditBackedDetails.repairRequirementIds",
    "starter material only",
    "STATE.md` only after scaffold succeeds",
    "planned-only shortcuts",
  ]) {
    assert.ok(addPhaseDoc.includes(snippet), `expected add-phase doc to include ${snippet}`);
  }
});

test("insert-phase command docs keep the decimal insertion contract explicit", async () => {
  const insertPhaseDoc = await readRepoFile("docs/commands/insert-phase.md");

  assert.match(insertPhaseDoc, /Primary skill: `blueprint-roadmap-admin`/);
  assert.match(insertPhaseDoc, /blueprint_roadmap_read/);
  assert.match(insertPhaseDoc, /blueprint_roadmap_insert_phase/);
  assert.match(insertPhaseDoc, /blueprint_artifact_scaffold/);
  assert.match(insertPhaseDoc, /blueprint_state_update/);
  assert.match(insertPhaseDoc, /existing integer phase/i);
  assert.match(insertPhaseDoc, /next decimal/i);
  assert.match(insertPhaseDoc, /Safe default: stop without writing/);
  assert.match(insertPhaseDoc, /named in-flight receipt/i);
  assert.match(insertPhaseDoc, /command response receipt only/i);
  assert.match(insertPhaseDoc, /does not create `?\.blueprint\/receipts`?, `?\.blueprint\/runs`?/i);
  assert.match(insertPhaseDoc, /requirementMappingStatus/);
  assert.match(insertPhaseDoc, /requirementsPath/);
  assert.match(insertPhaseDoc, /contextScaffoldPath/);
  assert.match(insertPhaseDoc, /safeRetry/);
  assert.match(insertPhaseDoc, /Mutation not attempted/);
  assert.match(insertPhaseDoc, /Roadmap mutation succeeded, scaffold failed/);
  assert.match(insertPhaseDoc, /Scaffold succeeded, state update failed/);
  assert.match(insertPhaseDoc, /Same preview and same returned files on retry/);
  assert.match(insertPhaseDoc, /Same confirmation token but changed params or files/);
  assert.match(insertPhaseDoc, /Invalid anchor \(non-integer\)/);
  assert.match(insertPhaseDoc, /Declared-ID failure/);
  assert.match(insertPhaseDoc, /Already-mapped IDs/);
  assert.match(insertPhaseDoc, /Conflicting decimal directory/);
  assert.match(insertPhaseDoc, /Dependency-review warning/);
  assert.match(insertPhaseDoc, /do not renumber later phases/i);
  assert.match(insertPhaseDoc, /\/blu-discuss-phase <decimal>/);
  for (const snippet of [
    "Shared phase-admin spine",
    "phase-insert-confirmation",
    ".blueprint/REQUIREMENTS.md",
    "already be mapped to another roadmap phase",
    "starter material only",
    "STATE.md` only after scaffold succeeds",
    "planned-only shortcuts",
  ]) {
    assert.ok(insertPhaseDoc.includes(snippet), `expected insert-phase doc to include ${snippet}`);
  }
});

test("cleanup command docs keep Gemini-native ask_user confirmation gates explicit", async () => {
  const cleanupDoc = await readRepoFile("docs/commands/cleanup.md");

  assert.match(cleanupDoc, /Primary skill: `blueprint-maintenance`/);
  assert.match(cleanupDoc, /Use Gemini CLI's built-in `ask_user` interaction tool for cleanup confirmation, archive-destination creation approval, and report-overwrite approval when it is available\./);
  assert.match(cleanupDoc, /`ask_user` is a Gemini CLI interaction surface, not Blueprint MCP persistence/i);
  assert.match(cleanupDoc, /`cleanup-confirmation` until the user approves through `ask_user` when available/i);
  assert.match(cleanupDoc, /if `ask_user` is unavailable, stop honestly with `cleanup-confirmation` still visible/i);
  assert.match(cleanupDoc, /keep the report-overwrite waiting state visible as `report-overwrite-confirmation` while blocked, use `ask_user` when available/i);
  assert.match(cleanupDoc, /keep that waiting state visible as `archive-destination-confirmation` while blocked, use `ask_user` when available/i);
  assert.match(cleanupDoc, /stop honestly with that named pending gate still visible when `ask_user` is unavailable/i);
});

test("plan-milestone-gaps command docs keep the audit-first grouped gap-closure contract explicit", async () => {
  const planMilestoneGapsDoc = await readRepoFile("docs/commands/plan-milestone-gaps.md");

  assert.match(planMilestoneGapsDoc, /Primary skill: `blueprint-roadmap-admin`/);
  assert.match(planMilestoneGapsDoc, /blueprint_roadmap_read/);
  assert.match(planMilestoneGapsDoc, /blueprint_artifact_list/);
  assert.match(planMilestoneGapsDoc, /blueprint_artifact_summary_digest/);
  assert.match(planMilestoneGapsDoc, /blueprint_roadmap_add_phase/);
  assert.match(planMilestoneGapsDoc, /blueprint_state_update/);
  assert.match(planMilestoneGapsDoc, /milestone audit report should already exist/i);
  assert.match(planMilestoneGapsDoc, /groups related gaps into a few coherent phases/i);
  assert.match(planMilestoneGapsDoc, /ask_user/i);
  assert.match(planMilestoneGapsDoc, /Requirement Gaps/i);
  assert.match(planMilestoneGapsDoc, /Integration Gaps/i);
  assert.match(planMilestoneGapsDoc, /Flow Gaps/i);
  assert.match(planMilestoneGapsDoc, /Optional Gaps/i);
  assert.match(planMilestoneGapsDoc, /requirements traceability repair/i);
  assert.match(planMilestoneGapsDoc, /\/blu-discuss-phase <phase>/);
  assert.doesNotMatch(planMilestoneGapsDoc, /code or git mutation/i);
});

test("audit-milestone command docs keep the grouped-gap audit and traceability contract explicit", async () => {
  const auditMilestoneDoc = await readRepoFile("docs/commands/audit-milestone.md");

  assert.match(auditMilestoneDoc, /Primary skill: `blueprint-roadmap-admin`/);
  assert.match(auditMilestoneDoc, /blueprint_roadmap_read/);
  assert.match(auditMilestoneDoc, /blueprint_phase_summary_index/);
  assert.match(auditMilestoneDoc, /blueprint_artifact_list/);
  assert.match(auditMilestoneDoc, /blueprint_artifact_contract_read/);
  assert.match(auditMilestoneDoc, /blueprint_artifact_summary_digest/);
  assert.match(auditMilestoneDoc, /artifactPaths/);
  assert.match(auditMilestoneDoc, /blueprint_artifact_report_write/);
  assert.match(auditMilestoneDoc, /explicit confirmation before replacing/i);
  assert.match(auditMilestoneDoc, /ask_user/);
  assert.match(auditMilestoneDoc, /Requirement Gaps/i);
  assert.match(auditMilestoneDoc, /Integration Gaps/i);
  assert.match(auditMilestoneDoc, /Flow Gaps/i);
  assert.match(auditMilestoneDoc, /Optional Gaps/i);
  assert.match(auditMilestoneDoc, /traceability notes/i);
  assert.match(auditMilestoneDoc, /\.blueprint\/reports\//);
  assert.match(auditMilestoneDoc, /\/blu-plan-milestone-gaps/);
  assert.match(auditMilestoneDoc, /\/blu-progress/);
  assert.doesNotMatch(auditMilestoneDoc, /code or git history/i);
});

test("remove-phase command docs keep the roadmap removal contract explicit", async () => {
  const removePhaseDoc = await readRepoFile("docs/commands/remove-phase.md");

  assert.match(removePhaseDoc, /Primary skill: `blueprint-roadmap-admin`/);
  assert.match(removePhaseDoc, /blueprint_roadmap_read/);
  assert.match(removePhaseDoc, /blueprint_phase_locate/);
  assert.match(removePhaseDoc, /blueprint_roadmap_remove_phase/);
  assert.match(removePhaseDoc, /blueprint_state_update/);
  assert.match(removePhaseDoc, /ask_user/);
  assert.match(removePhaseDoc, /force removal/i);
  assert.match(removePhaseDoc, /future phase/i);
  assert.match(removePhaseDoc, /execution evidence/i);
  assert.match(removePhaseDoc, /\/blu-progress/);
});

test("complete-milestone command docs keep the report-driven closeout contract explicit", async () => {
  const completeMilestoneDoc = await readRepoFile("docs/commands/complete-milestone.md");

  assert.match(completeMilestoneDoc, /Primary skill: `blueprint-roadmap-admin`/);
  assert.match(completeMilestoneDoc, /blueprint_roadmap_read/);
  assert.match(completeMilestoneDoc, /blueprint_artifact_list/);
  assert.match(completeMilestoneDoc, /blueprint_state_load/);
  assert.match(completeMilestoneDoc, /blueprint_artifact_summary_digest/);
  assert.match(completeMilestoneDoc, /blueprint_artifact_report_write/);
  assert.match(completeMilestoneDoc, /blueprint_state_update/);
  assert.match(completeMilestoneDoc, /milestone-audit-<milestone>\.md/);
  assert.match(completeMilestoneDoc, /derivedStatus\.milestoneAudit/);
  assert.match(completeMilestoneDoc, /READY_TO_CLOSE/);
  assert.match(completeMilestoneDoc, /audit readiness/i);
  assert.match(completeMilestoneDoc, /contract\.authoringTemplate/);
  assert.match(completeMilestoneDoc, /\/blu-plan-milestone-gaps/);
  assert.match(completeMilestoneDoc, /\/blu-milestone-summary <milestone>/);
  assert.doesNotMatch(completeMilestoneDoc, /blueprint_phase_mark_complete/);
});

test("milestone-summary command docs keep the Wave 2 local summary contract explicit", async () => {
  const milestoneSummaryDoc = await readRepoFile("docs/commands/milestone-summary.md");

  assert.match(milestoneSummaryDoc, /Primary skill: `blueprint-roadmap-admin`/);
  assert.match(milestoneSummaryDoc, /blueprint_roadmap_read/);
  assert.match(milestoneSummaryDoc, /blueprint_artifact_list/);
  assert.match(milestoneSummaryDoc, /blueprint_artifact_summary_digest/);
  assert.match(milestoneSummaryDoc, /blueprint_artifact_report_write/);
  assert.match(milestoneSummaryDoc, /blueprint_state_update/);
  assert.match(milestoneSummaryDoc, /milestone-complete-<milestone>\.md/);
  assert.match(milestoneSummaryDoc, /contract\.authoringTemplate/);
  assert.match(milestoneSummaryDoc, /\/blu-new-milestone/);
  assert.doesNotMatch(milestoneSummaryDoc, /blueprint-doc-writer/);
});

test("new-milestone command docs keep the carry-forward default and phase continuity explicit", async () => {
  const newMilestoneDoc = await readRepoFile("docs/commands/new-milestone.md");

  assert.match(newMilestoneDoc, /Primary skill: `blueprint-roadmap-admin`/);
  assert.match(newMilestoneDoc, /blueprint_roadmap_read/);
  assert.match(newMilestoneDoc, /blueprint_config_get/);
  assert.match(newMilestoneDoc, /blueprint_artifact_summary_digest/);
  assert.match(newMilestoneDoc, /blueprint_artifact_scaffold/);
  assert.match(newMilestoneDoc, /blueprint_state_update/);
  assert.match(newMilestoneDoc, /carry-forward from the saved milestone summary/i);
  assert.match(newMilestoneDoc, /requirementTransitions/);
  assert.match(newMilestoneDoc, /starter-seed evidence only/i);
  assert.match(newMilestoneDoc, /sourceRefs/);
  assert.match(newMilestoneDoc, /self-derived/);
  assert.match(newMilestoneDoc, /uncertain/);
  assert.match(newMilestoneDoc, /Safe default: stop without writing/);
  assert.match(newMilestoneDoc, /named in-flight receipt/i);
  assert.match(newMilestoneDoc, /command response receipt only/i);
  assert.match(newMilestoneDoc, /does not create `?\.blueprint\/receipts`?, `?\.blueprint\/runs`?/i);
  assert.match(newMilestoneDoc, /New Milestone First-Phase Handoff Packet/);
  assert.match(newMilestoneDoc, /openForDiscuss/);
  assert.match(newMilestoneDoc, /riskWatchlist/);
  assert.match(newMilestoneDoc, /deferredNotDoingNow/);
  assert.match(newMilestoneDoc, /canonicalReferences/);
  assert.match(newMilestoneDoc, /routeReceipt/);
  assert.match(newMilestoneDoc, /12-18 bullets/i);
  assert.match(newMilestoneDoc, /starter-only seed material/i);
  assert.match(newMilestoneDoc, /roadmapperMode/);
  assert.match(newMilestoneDoc, /firstPhaseTarget/);
  assert.match(newMilestoneDoc, /scaffoldPathStatuses/);
  assert.match(newMilestoneDoc, /stateUpdated/);
  assert.match(newMilestoneDoc, /safeRetry/);
  assert.match(newMilestoneDoc, /nextAction/);
  assert.match(newMilestoneDoc, /deletedPhaseDirectories: \[\]/);
  assert.match(newMilestoneDoc, /renamedPhaseDirectories: \[\]/);
  assert.match(newMilestoneDoc, /Mutation not attempted/);
  assert.match(newMilestoneDoc, /Roadmap mutation succeeded, scaffold failed/);
  assert.match(newMilestoneDoc, /Scaffold succeeded, state update failed/);
  assert.match(newMilestoneDoc, /Same preview and same returned files on retry/);
  assert.match(newMilestoneDoc, /Same confirmation token but changed params or files/);
  assert.match(newMilestoneDoc, /Summary missing/);
  assert.match(newMilestoneDoc, /Reset ambiguity/);
  assert.match(newMilestoneDoc, /Starter overwrite blocked/);
  assert.match(newMilestoneDoc, /Stale first-phase number/);
  assert.match(newMilestoneDoc, /Directory conflict/);
  assert.match(newMilestoneDoc, /State mismatch/);
  assert.match(newMilestoneDoc, /next whole-number phase/i);
  assert.match(newMilestoneDoc, /Preserves historical phase directories/i);
  assert.match(newMilestoneDoc, /\/blu-discuss-phase <first phase>/);
  assert.match(newMilestoneDoc, /Does not route directly to `\/blu-plan-phase` or `\/blu-execute-phase`/);
  assert.doesNotMatch(newMilestoneDoc, /route to requirements/i);
  for (const snippet of [
    "Shared phase-admin spine",
    "inputsUsed",
    "starter-doc-overwrite-confirmation",
    "stop without writing",
    "starter material only",
    "STATE.md` only after scaffold succeeds",
    "planned-only shortcuts",
  ]) {
    assert.ok(newMilestoneDoc.includes(snippet), `expected new-milestone doc to include ${snippet}`);
  }
});

test("docs-update command docs keep the scoped report-backed docs contract explicit", async () => {
  const docsUpdateDoc = await readRepoFile("docs/commands/docs-update.md");

  assert.match(docsUpdateDoc, /Primary skill: `blueprint-docs`/);
  assert.match(docsUpdateDoc, /blueprint_project_status/);
  assert.match(docsUpdateDoc, /blueprint_config_get/);
  assert.match(docsUpdateDoc, /blueprint_artifact_list/);
  assert.match(docsUpdateDoc, /blueprint_artifact_summary_digest/);
  assert.match(docsUpdateDoc, /blueprint_artifact_report_write/);
  assert.match(docsUpdateDoc, /`--verify-only` must never mutate repo documentation files/i);
  assert.match(docsUpdateDoc, /docs-update-latest\.md/);
  assert.match(docsUpdateDoc, /Leaves unrelated repo files untouched/i);
});

test("docs-facing optional-subagent tool inventories include blueprint_config_get", async () => {
  const [runtimeReference, mcpToolsDoc, quickDoc, debugDoc, exploreDoc, docsUpdateDoc, addTestsDoc] =
    await Promise.all([
      readRepoFile("docs/RUNTIME-REFERENCE.md"),
      readRepoFile("docs/MCP-TOOLS.md"),
      readRepoFile("docs/commands/quick.md"),
      readRepoFile("docs/commands/debug.md"),
      readRepoFile("docs/commands/explore.md"),
      readRepoFile("docs/commands/docs-update.md"),
      readRepoFile("docs/commands/add-tests.md")
    ]);

  assert.match(
    runtimeReference,
    /\| `quick` \| `docs\/commands\/quick\.md` \| `blueprint-phase-execution` \| `blueprint_project_status`<br>`blueprint_config_get`<br>`blueprint_command_catalog`<br>`blueprint_artifact_report_write`<br>`blueprint_state_update` \| `blueprint-researcher`<br>`blueprint-planner`<br>`blueprint-executor`<br>`blueprint-verifier` \|/
  );
  assert.match(
    runtimeReference,
    /\| `explore` \| `src\/mcp\/command-runtime-metadata\.ts#explore` \| `blueprint-capture` \| `blueprint_project_status`<br>`blueprint_config_get`<br>`blueprint_artifact_mutate_index`<br>`blueprint_roadmap_add_phase`<br>`blueprint_artifact_scaffold` \| `blueprint-researcher` \|/
  );
  assert.match(
    runtimeReference,
    /\| `docs-update` \| `docs\/commands\/docs-update\.md` \| `blueprint-docs` \| `blueprint_project_status`<br>`blueprint_config_get`<br>`blueprint_artifact_list`<br>`blueprint_artifact_summary_digest`<br>`blueprint_artifact_report_write` \| `blueprint-doc-writer`<br>`blueprint-doc-verifier` \|/
  );
  assert.match(
    runtimeReference,
    /\| `add-tests` \| `src\/mcp\/command-runtime-metadata\.ts#add-tests` \| `blueprint-phase-validation` \| `blueprint_phase_locate`<br>`blueprint_phase_summary_index`<br>`blueprint_phase_summary_read`<br>`blueprint_phase_validation_read`<br>`blueprint_phase_validation_authoring_context`<br>`blueprint_phase_validation_render`<br>`blueprint_artifact_contract_read`<br>`blueprint_config_get`<br>`blueprint_phase_validation_write`<br>`blueprint_artifact_list`<br>`blueprint_artifact_validate`<br>`blueprint_artifact_report_authoring_context`<br>`blueprint_artifact_report_validate_model`<br>`blueprint_artifact_report_write`<br>`blueprint_state_load`<br>`blueprint_state_update` \| `blueprint-executor`<br>`blueprint-verifier` \|/
  );
  assert.match(
    runtimeReference,
    /\| `debug` \| `docs\/commands\/debug\.md` \| `blueprint-debug` \| `blueprint_project_status`<br>`blueprint_config_get`<br>`blueprint_artifact_report_write`<br>`blueprint_artifact_mutate_index`<br>`blueprint_state_update` \| `blueprint-debugger` \|/
  );

  assert.match(
    mcpToolsDoc,
    /`explore` uses `blueprint_project_status`, `blueprint_config_get`, `blueprint_artifact_mutate_index`, `blueprint_roadmap_add_phase`, and `blueprint_artifact_scaffold`/i
  );
  assert.match(
    mcpToolsDoc,
    /`quick` uses `blueprint_project_status`, `blueprint_config_get`, `blueprint_command_catalog`, `blueprint_artifact_report_write`, and `blueprint_state_update`/i
  );
  assert.match(
    mcpToolsDoc,
    /`debug` uses `blueprint_project_status`, `blueprint_config_get`, `blueprint_artifact_report_write`, `blueprint_artifact_mutate_index`, and `blueprint_state_update`/i
  );
  assert.match(
    mcpToolsDoc,
    /`add-tests` uses phase locate, summary index\/read, validation read\/write, `blueprint_phase_validation_authoring_context`, `blueprint_phase_validation_render`, `blueprint_artifact_contract_read`, `blueprint_config_get`/i
  );
  assert.match(
    mcpToolsDoc,
    /`docs-update` uses `blueprint_project_status`, `blueprint_config_get`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, and `blueprint_artifact_report_write`/i
  );

  for (const doc of [quickDoc, debugDoc, exploreDoc, docsUpdateDoc, addTestsDoc]) {
    assert.match(doc, /blueprint_config_get/);
  }
});
