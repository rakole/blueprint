import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

const SKILL_BUNDLES = [
  {
    name: "blueprint-capture",
    description: "Project-local capture and parking-lot workflows for Blueprint",
    commands: [
      "/blu-note",
      "/blu-add-todo",
      "/blu-check-todos",
      "/blu-add-backlog",
      "/blu-review-backlog",
      "/blu-explore"
    ]
  },
  {
    name: "blueprint-phase-discovery",
    description: "Pre-planning discovery and requirements shaping",
    commands: ["/blu-discuss-phase", "/blu-research-phase", "/blu-ui-phase", "/blu-list-phase-assumptions"]
  },
  {
    name: "blueprint-phase-planning",
    description: "Plan synthesis, plan checks, and phase plan persistence",
    commands: ["/blu-plan-phase"]
  },
  {
    name: "blueprint-phase-execution",
    description: "Plan execution, bounded quick delivery, and summary or report generation",
    commands: ["/blu-execute-phase", "/blu-fast", "/blu-quick"]
  },
  {
    name: "blueprint-phase-validation",
    description: "Verification, UAT, tests, and gap closure",
    commands: ["/blu-validate-phase", "/blu-verify-work"]
  },
  {
    name: "blueprint-debug",
    description: "Debug investigations and recovery plans",
    commands: ["/blu-debug"]
  },
  {
    name: "blueprint-docs",
    description: "Documentation generation and verification",
    commands: ["/blu-docs-update"]
  },
  {
    name: "blueprint-roadmap-admin",
    description: "Roadmap append, milestone audits, and future roadmap or milestone mutations",
    commands: [
      "/blu-add-phase",
      "/blu-insert-phase",
      "/blu-remove-phase",
      "/blu-plan-milestone-gaps",
      "/blu-audit-milestone",
      "/blu-complete-milestone",
      "/blu-milestone-summary",
      "/blu-new-milestone"
    ]
  }
] as const;

for (const skill of SKILL_BUNDLES) {
  test(`${skill.name} bundle is discoverable with Gemini metadata`, async () => {
    const raw = await readFile(
      path.join(repoRoot, "skills", skill.name, "SKILL.md"),
      "utf8"
    );

    assert.match(raw, new RegExp(`name: ${skill.name}`));
    assert.match(raw, /description:/);
    assert.match(raw, /status: implemented/);

    for (const command of skill.commands) {
      assert.match(raw, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }

    assert.match(raw, new RegExp(skill.description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
}
