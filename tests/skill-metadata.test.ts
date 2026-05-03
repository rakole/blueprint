import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  loadBlueprintSkillInputs,
  resolveBlueprintSkillInputsFromContent
} from "../src/mcp/skill-metadata.js";

const repoRoot = process.cwd();

async function readRelativePath(relativePath: string): Promise<string | null> {
  try {
    return await readFile(path.join(repoRoot, relativePath), "utf8");
  } catch {
    return null;
  }
}

test("structured input bundles resolve command-specific discovery inputs", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-phase-discovery",
    "/blu-discuss-phase",
    readRelativePath
  );

  assert.equal(inputs.skill, "blueprint-phase-discovery");
  assert.deepEqual(inputs.shared, []);
  assert.deepEqual(inputs.commandSpecific, [
    "skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md",
    "skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md"
  ]);
  assert.deepEqual(inputs.effective, [
    "skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md",
    "skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md"
  ]);
  assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
});

test("structured multi-command skills return shared-only inputs for unknown commands", async () => {
  const raw = await readFile(
    path.join(repoRoot, "skills/blueprint-phase-discovery/SKILL.md"),
    "utf8"
  );
  const inputs = resolveBlueprintSkillInputsFromContent(
    "blueprint-phase-discovery",
    "/blu-unknown-discovery-command",
    raw
  );

  assert.deepEqual(inputs.shared, []);
  assert.deepEqual(inputs.commandSpecific, []);
  assert.deepEqual(inputs.effective, []);
});

test("structured input bundles resolve docs-free command-specific execution inputs", async () => {
  const expectations = [
    [
      "/blu-execute-phase",
      [
        "commands/blu-execute-phase.toml",
        "skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md",
        "skills/blueprint-phase-execution/references/long-running-execution-profile.md"
      ]
    ],
    [
      "/blu-quick",
      [
        "commands/blu-quick.toml",
        "skills/blueprint-phase-execution/references/quick-runtime-contract.md",
        "skills/blueprint-phase-execution/references/long-running-execution-profile.md"
      ]
    ],
    [
      "/blu-fast",
      [
        "commands/blu-fast.toml",
        "skills/blueprint-phase-execution/references/fast-runtime-contract.md"
      ]
    ]
  ] as const;

  for (const [commandName, commandSpecificInputs] of expectations) {
    const inputs = await loadBlueprintSkillInputs(
      "blueprint-phase-execution",
      commandName,
      readRelativePath
    );

    assert.equal(inputs.skill, "blueprint-phase-execution");
    assert.deepEqual(inputs.shared, []);
    assert.deepEqual(inputs.commandSpecific, commandSpecificInputs);
    assert.deepEqual(inputs.effective, commandSpecificInputs);
    assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
  }
});

test("plan-phase skill resolves its slim command-scoped input bundle", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-phase-planning",
    "/blu-plan-phase",
    readRelativePath
  );

  assert.equal(inputs.skill, "blueprint-phase-planning");
  assert.deepEqual(inputs.shared, []);
  assert.deepEqual(inputs.commandSpecific, [
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
  ]);
  assert.deepEqual(inputs.effective, [
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
  ]);
  assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
});

test("roadmap-admin add-phase resolves docless command-scoped input override", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-roadmap-admin",
    "/blu-add-phase",
    readRelativePath
  );

  assert.equal(inputs.skill, "blueprint-roadmap-admin");
  assert.deepEqual(inputs.shared, []);
  assert.deepEqual(inputs.commandSpecific, [
    "skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md"
  ]);
  assert.deepEqual(inputs.effective, [
    "skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md"
  ]);
  assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
});

test("capture commands resolve only command-scoped manifest inputs", async () => {
  const expectations = [
    ["note", "commands/blu-note.toml"],
    ["add-todo", "commands/blu-add-todo.toml"],
    ["check-todos", "commands/blu-check-todos.toml"],
    ["add-backlog", "commands/blu-add-backlog.toml"],
    ["review-backlog", "commands/blu-review-backlog.toml"],
    ["explore", "commands/blu-explore.toml"]
  ] as const;

  for (const [commandName, manifestPath] of expectations) {
    const inputs = await loadBlueprintSkillInputs(
      "blueprint-capture",
      `/blu-${commandName}`,
      readRelativePath
    );

    assert.equal(inputs.skill, "blueprint-capture");
    assert.deepEqual(inputs.shared, []);
    assert.deepEqual(inputs.commandSpecific, [manifestPath]);
    assert.deepEqual(inputs.effective, [manifestPath]);
    assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
  }
});

test("review commands resolve docs-free manifest and local runtime-contract inputs", async () => {
  const expectations = [
    ["code-review", "commands/blu-code-review.toml", "code-review-runtime-contract.md"],
    [
      "code-review-fix",
      "commands/blu-code-review-fix.toml",
      "code-review-fix-runtime-contract.md"
    ],
    ["audit-fix", "commands/blu-audit-fix.toml", "audit-fix-runtime-contract.md"],
    ["secure-phase", "commands/blu-secure-phase.toml", "secure-phase-runtime-contract.md"],
    ["review", "commands/blu-review.toml", "review-runtime-contract.md"],
    ["ui-review", "commands/blu-ui-review.toml", "ui-review-runtime-contract.md"]
  ] as const;

  for (const [commandName, manifestPath, contractFile] of expectations) {
    const runtimeContractPath = `skills/blueprint-review/references/${contractFile}`;
    const inputs = await loadBlueprintSkillInputs(
      "blueprint-review",
      `/blu-${commandName}`,
      readRelativePath
    );

    assert.equal(inputs.skill, "blueprint-review");
    assert.deepEqual(inputs.shared, []);
    assert.deepEqual(inputs.commandSpecific, [manifestPath, runtimeContractPath]);
    assert.deepEqual(inputs.effective, [manifestPath, runtimeContractPath]);
    assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
  }
});

test("validation commands resolve only command-scoped local runtime-contract inputs", async () => {
  const expectations = [
    ["validate-phase", "validate-phase-runtime-contract.md"],
    ["verify-work", "verify-work-runtime-contract.md"],
    ["add-tests", "add-tests-runtime-contract.md"]
  ] as const;

  for (const [commandName, contractFile] of expectations) {
    const runtimeContractPath =
      `skills/blueprint-phase-validation/references/${contractFile}`;
    const inputs = await loadBlueprintSkillInputs(
      "blueprint-phase-validation",
      `/blu-${commandName}`,
      readRelativePath
    );

    assert.equal(inputs.skill, "blueprint-phase-validation");
    assert.deepEqual(inputs.shared, []);
    assert.deepEqual(inputs.commandSpecific, [runtimeContractPath]);
    assert.deepEqual(inputs.effective, [runtimeContractPath]);
    assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
  }
});

test("maintenance commands resolve docs-free manifest and local runtime-contract inputs", async () => {
  const expectations = [
    ["pr-branch", "commands/blu-pr-branch.toml"],
    ["ship", "commands/blu-ship.toml"],
    ["undo", "commands/blu-undo.toml"],
    ["new-workspace", "commands/blu-new-workspace.toml"],
    ["remove-workspace", "commands/blu-remove-workspace.toml"],
    ["workstreams", "commands/blu-workstreams.toml"],
    ["cleanup", "commands/blu-cleanup.toml"],
    ["update", "commands/blu-update.toml"],
    ["reapply-patches", "commands/blu-reapply-patches.toml"]
  ] as const;

  for (const [commandName, manifestPath] of expectations) {
    const runtimeContractPath =
      `skills/blueprint-maintenance/references/${commandName}-runtime-contract.md`;
    const inputs = await loadBlueprintSkillInputs(
      "blueprint-maintenance",
      `/blu-${commandName}`,
      readRelativePath
    );

    assert.equal(inputs.skill, "blueprint-maintenance");
    assert.deepEqual(inputs.shared, []);
    assert.deepEqual(inputs.commandSpecific, [manifestPath, runtimeContractPath]);
    assert.deepEqual(inputs.effective, [manifestPath, runtimeContractPath]);
    assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
  }
});

test("governance commands resolve only command-scoped runtime references", async () => {
  const expectations = [
    ["settings", "settings-runtime-contract.md"],
    ["set-profile", "set-profile-runtime-contract.md"],
    ["health", "health-runtime-contract.md"],
    ["pause-work", "pause-work-runtime-contract.md"],
    ["resume-work", "resume-work-runtime-contract.md"]
  ] as const;

  for (const [commandName, referenceName] of expectations) {
    const referencePath = `skills/blueprint-governance/references/${referenceName}`;
    const inputs = await loadBlueprintSkillInputs(
      "blueprint-governance",
      `/blu-${commandName}`,
      readRelativePath
    );

    assert.equal(inputs.skill, "blueprint-governance");
    assert.deepEqual(inputs.shared, []);
    assert.deepEqual(inputs.commandSpecific, [referencePath]);
    assert.deepEqual(inputs.effective, [referencePath]);
    assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
  }
});

test("roadmap-admin siblings keep legacy Required Inputs fallback", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-roadmap-admin",
    "/blu-insert-phase",
    readRelativePath
  );

  assert.equal(inputs.skill, "blueprint-roadmap-admin");
  assert.equal(inputs.commandSpecific.length, 0);
  assert.deepEqual(inputs.shared, inputs.effective);
  assert.ok(inputs.effective.includes("docs/commands/insert-phase.md"));
  assert.ok(inputs.effective.includes("docs/COMMAND-CATALOG.md"));
  assert.ok(inputs.effective.includes("docs/RUNTIME-REFERENCE.md"));
  assert.ok(
    inputs.effective.some((input) =>
      input.startsWith(
        "skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md"
      )
    )
  );
  assert.equal(inputs.effective.includes("docs/commands/add-phase.md"), false);
  assert.equal(
    inputs.effective.includes(
      "skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md"
    ),
    false
  );
});
