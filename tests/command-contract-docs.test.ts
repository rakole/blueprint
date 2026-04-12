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
    /^\| `([^`]+)` \| `commands\/gsd\/[^`]+\.md` \| .* \| `docs\/commands\/[^`]+\.md` \| `([^`]+)` \|/gm
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
    readRepoFile("docs/GSD-RUNTIME-MIGRATION.md")
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
    readRepoFile("docs/GSD-RUNTIME-MIGRATION.md")
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
    /\| `blueprint-checker` \| `implemented` \| Verify plan quality before execution \|/
  );
});

test("phase execution skill and bounded execution agent are marked implemented in docs", async () => {
  const skillsMarkdown = await readRepoFile("docs/SKILLS-AND-AGENTS.md");

  assert.match(
    skillsMarkdown,
    /\| `blueprint-phase-execution` \| `implemented` \| Plan execution and summary generation \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-executor` \| `implemented` \| Execute plan tasks and produce summaries \|/
  );
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

test("add-phase command docs keep the roadmap append contract explicit", async () => {
  const addPhaseDoc = await readRepoFile("docs/commands/add-phase.md");

  assert.match(addPhaseDoc, /Primary skill: `blueprint-roadmap-admin`/);
  assert.match(addPhaseDoc, /blueprint_roadmap_read/);
  assert.match(addPhaseDoc, /blueprint_roadmap_add_phase/);
  assert.match(addPhaseDoc, /blueprint_artifact_scaffold/);
  assert.match(addPhaseDoc, /blueprint_state_update/);
  assert.match(addPhaseDoc, /non-empty phase description is required/i);
  assert.match(addPhaseDoc, /next integer after the highest base phase number/i);
  assert.match(addPhaseDoc, /\.blueprint\/phases\/<phase-slug>\//);
});
