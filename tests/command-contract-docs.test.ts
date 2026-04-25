import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

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
    /^\| `([^`]+)` \| `docs\/commands\/[^`]+\.md` \| `([^`]+)` \|/gm
  )) {
    const [, command, skill] = match;
    skills.set(command, skill);
  }

  return skills;
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
    /Router, progress, and discovery-style commands must continue to use the current docs plus read-oriented MCP tools directly for the resource paths that are still planned/i
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
  assert.match(exploreDoc, /## Required MCP Tools[\s\S]*`blueprint_artifact_mutate_index`/);
  assert.match(exploreDoc, /## Required MCP Tools[\s\S]*`blueprint_roadmap_add_phase`/);
  assert.match(exploreDoc, /## Required MCP Tools[\s\S]*`blueprint_artifact_scaffold`/);
  assert.match(exploreDoc, /Confirm the final routing target before any durable write\./);
  assert.match(exploreDoc, /scaffolded phase context/i);
  assert.match(
    migrationMarkdown,
    /\| `explore` \| `commands\/gsd\/explore\.md` \| GSD has an upstream workflow file \| `docs\/commands\/explore\.md` \| `blueprint-capture` \| `blueprint_project_status`<br>`blueprint_artifact_mutate_index`<br>`blueprint_roadmap_add_phase`<br>`blueprint_artifact_scaffold` \| `blueprint-researcher` \|/
  );
  assert.match(
    mcpToolsDoc,
    /\| `blueprint_artifact_mutate_index` \| Append or update canonical capture entries in Blueprint indexes such as backlog, notes, and todos/
  );
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

test("map-codebase docs keep the repaired brownfield mapping contract explicit", async () => {
  const [catalogMarkdown, commandDoc, skillDoc, runtimeReference, mcpToolsDoc] = await Promise.all([
    readRepoFile("docs/COMMAND-CATALOG.md"),
    readRepoFile("docs/commands/map-codebase.md"),
    readRepoFile("skills/blueprint-map/SKILL.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md"),
    readRepoFile("docs/MCP-TOOLS.md")
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
  assert.match(
    runtimeReference,
    /Long-running-mutation profile for read-heavy brownfield mapping: keep `Resolve`\/`Read`\/`Decide`\/`Execute`\/`Persist`\/`Validate`\/`Route` narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible/i
  );
  assert.match(
    runtimeReference,
    /\| `map-codebase` \| `docs\/commands\/map-codebase\.md` \| `blueprint-map` \| `blueprint_project_status`<br>`blueprint_artifact_contract_read`<br>`blueprint_artifact_scaffold`<br>`blueprint_artifact_list`<br>`blueprint_artifact_summary_digest`<br>`blueprint_codebase_artifact_write`<br>`blueprint_artifact_validate` \| `blueprint-mapper` \|/
  );
  assert.match(
    mcpToolsDoc,
    /`map-codebase` uses `blueprint_project_status`, `blueprint_artifact_contract_read`, `blueprint_artifact_scaffold`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_codebase_artifact_write`, and `blueprint_artifact_validate`/i
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
    /\| `add-todo` \| `docs\/commands\/add-todo\.md` \| `blueprint-capture` \| `blueprint_artifact_mutate_index` \|/
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
    /\| `check-todos` \| `docs\/commands\/check-todos\.md` \| `blueprint-capture` \| `blueprint_artifact_mutate_index`<br>`blueprint_project_status` \|/
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
    /\| `review-backlog` \| `docs\/commands\/review-backlog\.md` \| `blueprint-capture` \| `blueprint_artifact_mutate_index`<br>`blueprint_roadmap_promote_backlog`<br>`blueprint_state_update` \|/
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
    /\| `blueprint-phase-execution` \| `implemented` \| Plan execution, bounded quick delivery, and summary or report generation \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-executor` \| `implemented` \| Execute plan tasks and produce summaries \|/
  );
});

test("execute-phase runtime references keep the topic/todo contract, summary contract read, and lower-wave gating explicit", async () => {
  const [runtimeReference, migrationMarkdown] = await Promise.all([
    readRepoFile("docs/RUNTIME-REFERENCE.md"),
    readRepoFile("docs/GSD-RUNTIME-MIGRATION.md")
  ]);

  assert.match(
    runtimeReference,
    /\| `execute-phase` \| `docs\/commands\/execute-phase\.md` \| `blueprint-phase-execution` \| `blueprint_phase_locate`<br>`blueprint_phase_plan_index`<br>`blueprint_phase_plan_read`<br>`blueprint_phase_summary_index`<br>`blueprint_phase_summary_read`<br>`blueprint_artifact_contract_read`<br>`blueprint_phase_summary_write`<br>`blueprint_config_get`<br>`blueprint_artifact_validate`<br>`blueprint_state_load`<br>`blueprint_state_update` \|/
  );
  assert.match(runtimeReference, /Long-running-mutation profile; keep Resolve\/Read\/Decide\/Execute\/Persist\/Validate\/Route narration/i);
  assert.match(runtimeReference, /pair Gemini-native `update_topic` and `write_todos` for long execution runs without turning them into persistence/i);
  assert.match(runtimeReference, /reads the canonical `phase\.summary` contract before any summary write or replacement/i);
  assert.match(runtimeReference, /stops later-wave execution when lower-wave gaps remain/i);
  assert.match(
    migrationMarkdown,
    /\| `execute-phase` \| `commands\/gsd\/execute-phase\.md` \| GSD has an upstream workflow file \| `docs\/commands\/execute-phase\.md` \| `blueprint-phase-execution` \| `blueprint_phase_locate`<br>`blueprint_phase_plan_index`<br>`blueprint_phase_plan_read`<br>`blueprint_phase_summary_index`<br>`blueprint_phase_summary_read`<br>`blueprint_artifact_contract_read`<br>`blueprint_phase_summary_write`<br>`blueprint_config_get`<br>`blueprint_artifact_validate`<br>`blueprint_state_load`<br>`blueprint_state_update` \|/
  );
  assert.match(migrationMarkdown, /reads the canonical `phase\.summary` contract before summary writes/i);
  assert.match(migrationMarkdown, /keeps later-wave work blocked until lower-wave gaps are closed/i);
});

test("quick command docs keep the bounded report-backed execution contract explicit", async () => {
  const quickDoc = await readRepoFile("docs/commands/quick.md");

  assert.match(quickDoc, /Primary skill: `blueprint-phase-execution`/);
  assert.match(quickDoc, /blueprint_project_status/);
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

test("review skill and security auditor are marked implemented in docs for secure-phase", async () => {
  const [skillsMarkdown, securePhaseDoc] = await Promise.all([
    readRepoFile("docs/SKILLS-AND-AGENTS.md"),
    readRepoFile("docs/commands/secure-phase.md")
  ]);

  assert.match(
    skillsMarkdown,
    /\| `blueprint-review` \| `implemented` \| Reviews, bounded remediation, security, UI, peer review \| `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `ui-review`, `review` \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-security-auditor` \| `implemented` \| Verify threat mitigations and security coverage \|/
  );
  assert.match(securePhaseDoc, /Primary skill: `blueprint-review`/);
  assert.match(securePhaseDoc, /`blueprint_phase_plan_index`/);
  assert.match(securePhaseDoc, /`blueprint_phase_plan_read`/);
  assert.match(securePhaseDoc, /`blueprint_artifact_contract_read`/);
  assert.match(securePhaseDoc, /review\.security/);
  assert.match(securePhaseDoc, /`blueprint_review_record`/);
  assert.match(securePhaseDoc, /`blueprint-security-auditor`/);
  assert.match(securePhaseDoc, /phase XX-SECURITY\.md/);
});

test("ui-review docs and UI auditor are marked implemented in docs", async () => {
  const [skillsMarkdown, uiReviewDoc, mcpToolsDoc, migrationMarkdown] = await Promise.all([
    readRepoFile("docs/SKILLS-AND-AGENTS.md"),
    readRepoFile("docs/commands/ui-review.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(
    skillsMarkdown,
    /\| `blueprint-ui-auditor` \| `implemented` \| Perform retroactive six-pillar UI audits \|/
  );
  assert.match(uiReviewDoc, /Primary skill: `blueprint-review`/);
  assert.match(uiReviewDoc, /`blueprint_phase_locate`/);
  assert.match(uiReviewDoc, /`blueprint_artifact_list`/);
  assert.match(uiReviewDoc, /`blueprint_review_record`/);
  assert.match(uiReviewDoc, /`blueprint-ui-auditor`/);
  assert.match(uiReviewDoc, /phase XX-UI-REVIEW\.md/);
  assert.match(
    mcpToolsDoc,
    /`ui-review` uses `blueprint_phase_locate`, `blueprint_artifact_list`, and `blueprint_review_record`/
  );
  assert.match(
    migrationMarkdown,
    /\| `ui-review` \| `docs\/commands\/ui-review\.md` \| `blueprint-review` \| `blueprint_phase_locate`<br>`blueprint_artifact_list`<br>`blueprint_review_record` \|/
  );
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
    /\| `pr-branch` \| `docs\/commands\/pr-branch\.md` \| `blueprint-maintenance` \| `blueprint_project_status`<br>`blueprint_config_get`<br>`blueprint_artifact_summary_digest`<br>`blueprint_artifact_contract_read`<br>`blueprint_artifact_report_write` \|/
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
    /\| `workstreams` \| `docs\/commands\/workstreams\.md` \| `blueprint-maintenance` \| `blueprint_workstream_list`<br>`blueprint_workstream_mutate`<br>`blueprint_state_update` \|/
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
  assert.match(shipDoc, /`blueprint_artifact_report_write`/);
  assert.match(shipDoc, /`blueprint_state_update`/);
  assert.match(shipDoc, /ship-latest\.md/);
  assert.match(shipDoc, /Confirm draft versus ready state/i);
  assert.match(shipDoc, /manual fallback/i);
  assert.match(
    mcpToolsDoc,
    /`ship` uses `blueprint_project_status`, `blueprint_phase_locate`, `blueprint_config_get`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, and `blueprint_state_update`/
  );
  assert.match(
    migrationMarkdown,
    /\| `ship` \| `docs\/commands\/ship\.md` \| `blueprint-maintenance` \| `blueprint_project_status`<br>`blueprint_phase_locate`<br>`blueprint_config_get`<br>`blueprint_artifact_list`<br>`blueprint_artifact_summary_digest`<br>`blueprint_artifact_report_write`<br>`blueprint_state_update` \|/
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
    /\| `cleanup` \| `docs\/commands\/cleanup\.md` \| `blueprint-maintenance` \| `blueprint_project_status`<br>`blueprint_roadmap_read`<br>`blueprint_artifact_list`<br>`blueprint_artifact_summary_digest`<br>`blueprint_artifact_report_write`<br>`blueprint_state_update` \|/
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
    /\| `remove-workspace` \| `docs\/commands\/remove-workspace\.md` \| `blueprint-maintenance` \| `blueprint_workspace_registry_get`<br>`blueprint_workspace_remove` \|/
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
    /\| `update` \| `docs\/commands\/update\.md` \| `blueprint-maintenance` \| `blueprint_update_check`<br>`blueprint_update_plan` \|/
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
  assert.match(undoDoc, /`blueprint_artifact_report_write`/);
  assert.match(undoDoc, /`blueprint_state_update`/);
  assert.match(undoDoc, /undo-latest\.md/);
  assert.match(undoDoc, /git revert/i);
  assert.match(undoDoc, /git reset --hard/i);
  assert.match(
    mcpToolsDoc,
    /`undo` uses `blueprint_project_status`, `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_artifact_summary_digest`, `blueprint_artifact_report_write`, and `blueprint_state_update`/
  );
  assert.match(
    migrationMarkdown,
    /\| `undo` \| `docs\/commands\/undo\.md` \| `blueprint-maintenance` \| `blueprint_project_status`<br>`blueprint_phase_locate`<br>`blueprint_artifact_list`<br>`blueprint_artifact_summary_digest`<br>`blueprint_artifact_report_write`<br>`blueprint_state_update` \|/
  );
});

test("code-review docs and reviewer agent are marked implemented in docs", async () => {
  const [skillsMarkdown, codeReviewDoc, runtimeReference] = await Promise.all([
    readRepoFile("docs/SKILLS-AND-AGENTS.md"),
    readRepoFile("docs/commands/code-review.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(
    skillsMarkdown,
    /\| `blueprint-reviewer` \| `implemented` \| Produce bounded code review findings from a resolved Blueprint scope \|/
  );
  assert.match(codeReviewDoc, /Primary skill: `blueprint-review`/);
  assert.match(codeReviewDoc, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(codeReviewDoc, /## Shared Runtime Contract/);
  assert.match(codeReviewDoc, /## In-Flight Progress Contract/);
  assert.match(codeReviewDoc, /`blueprint_review_scope`/);
  assert.match(codeReviewDoc, /`blueprint-reviewer`/);
  assert.match(codeReviewDoc, /phase XX-REVIEW\.md/);
  assert.match(
    runtimeReference,
    /\| `code-review` \| `docs\/commands\/code-review\.md` \| `blueprint-review` \| `blueprint_config_get`<br>`blueprint_phase_locate`<br>`blueprint_artifact_list`<br>`blueprint_artifact_contract_read`<br>`blueprint_review_scope`<br>`blueprint_review_record` \| `blueprint-reviewer` \|/
  );
  assert.match(runtimeReference, /Long-running-mutation profile for deterministic phase-scoped review/i);
  assert.match(runtimeReference, /use Gemini-native `update_topic` and `write_todos` for non-trivial review runs/i);
});

test("review docs and migration notes keep the peer-review contract explicit", async () => {
  const [reviewDoc, mcpToolsDoc, migrationMarkdown, catalogMarkdown] = await Promise.all([
    readRepoFile("docs/commands/review.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md"),
    readRepoFile("docs/COMMAND-CATALOG.md")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `review` \| 4 \| `Quality And Shipping` \| `blueprint-review` \| `implemented` \| `phase XX-REVIEWS\.md` \| `Medium: external reviewer orchestration without default repo mutation\.` \|/
  );
  assert.match(reviewDoc, /Primary skill: `blueprint-review`/);
  assert.match(reviewDoc, /`blueprint_phase_locate`/);
  assert.match(reviewDoc, /`blueprint_artifact_list`/);
  assert.match(reviewDoc, /`blueprint_phase_plan_index`/);
  assert.match(reviewDoc, /`blueprint_phase_plan_read`/);
  assert.match(reviewDoc, /`blueprint_review_record`/);
  assert.match(reviewDoc, /phase XX-REVIEWS\.md/);
  assert.match(reviewDoc, /preserve disagreement/i);
  assert.match(
    mcpToolsDoc,
    /`review` uses `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_phase_plan_index`, `blueprint_phase_plan_read`, and `blueprint_review_record`/
  );
  assert.match(
    migrationMarkdown,
    /\| `review` \| `docs\/commands\/review\.md` \| `blueprint-review` \| `blueprint_phase_locate`<br>`blueprint_artifact_list`<br>`blueprint_phase_plan_index`<br>`blueprint_phase_plan_read`<br>`blueprint_review_record` \|/
  );
});

test("audit-fix docs and migration notes keep the remediation contract explicit", async () => {
  const [auditFixDoc, mcpToolsDoc, migrationMarkdown] = await Promise.all([
    readRepoFile("docs/commands/audit-fix.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(auditFixDoc, /Primary skill: `blueprint-review`/);
  assert.match(auditFixDoc, /`blueprint_phase_locate`/);
  assert.match(auditFixDoc, /`blueprint_artifact_list`/);
  assert.match(auditFixDoc, /`blueprint_review_scope`/);
  assert.match(auditFixDoc, /`blueprint_artifact_report_write`/);
  assert.match(auditFixDoc, /`blueprint_artifact_mutate_index`/);
  assert.match(auditFixDoc, /`blueprint_state_update`/);
  assert.match(auditFixDoc, /--source <review\|security\|verification\|uat\|all>/);
  assert.match(auditFixDoc, /--severity <medium\|high\|all>/);
  assert.match(auditFixDoc, /--max N/);
  assert.match(auditFixDoc, /--dry-run/);
  assert.match(auditFixDoc, /ask_user/);
  assert.match(auditFixDoc, /## In-Flight Progress Contract/);
  assert.match(auditFixDoc, /stop on first failed fix attempt or failed required verification/i);
  assert.match(auditFixDoc, /commit traceability/i);
  assert.match(auditFixDoc, /planned inventory and is not a required runtime path/i);
  assert.match(auditFixDoc, /audit-fix-runtime-contract\.md/);
  assert.match(auditFixDoc, /classification table before mutation/i);
  assert.match(auditFixDoc, /Browser-only, web-search-only, shell-only, or generic agents are not substitutes/i);
  assert.match(auditFixDoc, /\.blueprint\/reports\/audit-fix-<phase>\.md/);
  assert.match(
    mcpToolsDoc,
    /`audit-fix` uses `blueprint_phase_locate`, `blueprint_artifact_list`, `blueprint_review_scope`, `blueprint_artifact_report_write`, `blueprint_artifact_mutate_index`, and `blueprint_state_update` to keep audit-driven remediation evidence-first/
  );
  assert.match(
    migrationMarkdown,
    /\| `audit-fix` \| `docs\/commands\/audit-fix\.md` \| `blueprint-review` \| `blueprint_phase_locate`<br>`blueprint_artifact_list`<br>`blueprint_review_scope`<br>`blueprint_artifact_report_write`<br>`blueprint_artifact_mutate_index`<br>`blueprint_state_update` \|/
  );
  assert.match(
    migrationMarkdown,
    /ask_user confirmation for non-trivial mutation and todo capture/
  );
  assert.match(
    migrationMarkdown,
    /classify from saved evidence selected by `--source` into `auto-fixable`, `manual-only`, and `skip` rows before mutation/
  );
  assert.match(
    migrationMarkdown,
    /repair invalid `report\.audit-fix` writes once against canonical headings/
  );
  assert.match(
    migrationMarkdown,
    /The planned `blueprint-fixer` remains unshipped and is not an active required runtime path\./
  );
});

test("code-review-fix docs and migration notes keep the review-remediation contract explicit", async () => {
  const [codeReviewFixDoc, mcpToolsDoc, migrationMarkdown] = await Promise.all([
    readRepoFile("docs/commands/code-review-fix.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md")
  ]);

  assert.match(codeReviewFixDoc, /Primary skill: `blueprint-review`/);
  assert.match(codeReviewFixDoc, /`blueprint_phase_locate`/);
  assert.match(codeReviewFixDoc, /`blueprint_review_load_findings`/);
  assert.match(codeReviewFixDoc, /`blueprint_artifact_contract_read`/);
  assert.match(codeReviewFixDoc, /`blueprint_review_record`/);
  assert.match(codeReviewFixDoc, /`blueprint_state_update`/);
  assert.match(codeReviewFixDoc, /## In-Flight Progress Contract/);
  assert.match(codeReviewFixDoc, /`--auto` is a bounded finding-selection shortcut only/i);
  assert.match(codeReviewFixDoc, /phase XX-REVIEW-FIX\.md/);
  assert.match(
    mcpToolsDoc,
    /`code-review-fix` uses `blueprint_phase_locate`, `blueprint_review_load_findings`, `blueprint_artifact_contract_read`, `blueprint_review_record`, and `blueprint_state_update`/
  );
  assert.match(
    migrationMarkdown,
    /\| `code-review-fix` \| `docs\/commands\/code-review-fix\.md` \| `blueprint-review` \| `blueprint_phase_locate`<br>`blueprint_review_load_findings`<br>`blueprint_artifact_contract_read`<br>`blueprint_review_record`<br>`blueprint_state_update` \|/
  );
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
  assert.match(addPhaseDoc, /Refuses to append when the confirmed next phase number is stale\./);
  assert.match(
    addPhaseDoc,
    /Returns `\/blu-discuss-phase <new phase number>` as the next safe Blueprint follow-up\./
  );
  assert.match(addPhaseDoc, /\.blueprint\/phases\/<phase-slug>\//);
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
  assert.match(insertPhaseDoc, /do not renumber later phases/i);
  assert.match(insertPhaseDoc, /\/blu-discuss-phase <decimal>/);
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
  assert.match(completeMilestoneDoc, /milestone-audit-<version>\.md/);
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
  assert.match(milestoneSummaryDoc, /milestone-complete-<version>\.md/);
  assert.match(milestoneSummaryDoc, /contract\.authoringTemplate/);
  assert.match(milestoneSummaryDoc, /\/blu-new-milestone/);
  assert.doesNotMatch(milestoneSummaryDoc, /blueprint-doc-writer/);
});

test("new-milestone command docs keep the carry-forward default and phase continuity explicit", async () => {
  const newMilestoneDoc = await readRepoFile("docs/commands/new-milestone.md");

  assert.match(newMilestoneDoc, /Primary skill: `blueprint-roadmap-admin`/);
  assert.match(newMilestoneDoc, /blueprint_roadmap_read/);
  assert.match(newMilestoneDoc, /blueprint_artifact_summary_digest/);
  assert.match(newMilestoneDoc, /blueprint_artifact_scaffold/);
  assert.match(newMilestoneDoc, /blueprint_state_update/);
  assert.match(newMilestoneDoc, /carry-forward from the saved milestone summary/i);
  assert.match(newMilestoneDoc, /next whole-number phase/i);
  assert.match(newMilestoneDoc, /Preserves historical phase directories/i);
  assert.match(newMilestoneDoc, /\/blu-discuss-phase <first phase>/);
});

test("docs-update command docs keep the scoped report-backed docs contract explicit", async () => {
  const docsUpdateDoc = await readRepoFile("docs/commands/docs-update.md");

  assert.match(docsUpdateDoc, /Primary skill: `blueprint-docs`/);
  assert.match(docsUpdateDoc, /blueprint_project_status/);
  assert.match(docsUpdateDoc, /blueprint_artifact_list/);
  assert.match(docsUpdateDoc, /blueprint_artifact_summary_digest/);
  assert.match(docsUpdateDoc, /blueprint_artifact_report_write/);
  assert.match(docsUpdateDoc, /`--verify-only` must never mutate repo documentation files/i);
  assert.match(docsUpdateDoc, /docs-update-latest\.md/);
  assert.match(docsUpdateDoc, /Leaves unrelated repo files untouched/i);
});
