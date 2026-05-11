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

test("debug resolves docs-free manifest and command-local runtime-contract inputs", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-debug",
    "/blu-debug",
    readRelativePath
  );

  assert.equal(inputs.skill, "blueprint-debug");
  assert.deepEqual(inputs.shared, []);
  assert.deepEqual(inputs.commandSpecific, [
    "commands/blu-debug.toml",
    "skills/blueprint-debug/references/debug-runtime-contract.md"
  ]);
  assert.deepEqual(inputs.effective, [
    "commands/blu-debug.toml",
    "skills/blueprint-debug/references/debug-runtime-contract.md"
  ]);
  assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
});

test("debug runtime inputs stay available when repository docs are unavailable", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-debug",
    "/blu-debug",
    async (relativePath) => {
      if (relativePath.startsWith("docs/")) {
        return null;
      }

      return readRelativePath(relativePath);
    }
  );

  assert.deepEqual(inputs.effective, [
    "commands/blu-debug.toml",
    "skills/blueprint-debug/references/debug-runtime-contract.md"
  ]);
  assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
});

test("router commands resolve only command manifests as active inputs", async () => {
  const expectations = [
    ["/blu", ["commands/blu.toml"]],
    ["/blu-help", ["commands/blu-help.toml"]],
    ["/blu-progress", ["commands/blu-progress.toml"]],
    ["/blu-next", ["commands/blu-next.toml"]]
  ] as const;

  for (const [commandPath, commandSpecificInputs] of expectations) {
    const inputs = await loadBlueprintSkillInputs(
      "blueprint-router",
      commandPath,
      readRelativePath
    );

    assert.equal(inputs.skill, "blueprint-router");
    assert.deepEqual(inputs.shared, []);
    assert.deepEqual(inputs.commandSpecific, commandSpecificInputs);
    assert.deepEqual(inputs.effective, commandSpecificInputs);
    assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
  }
});

test("router inputs stay docless when repository docs are unavailable", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-router",
    "/blu-next",
    async (relativePath) => {
      if (relativePath.startsWith("docs/")) {
        return null;
      }

      return readRelativePath(relativePath);
    }
  );

  assert.deepEqual(inputs.effective, ["commands/blu-next.toml"]);
  assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
});

test("router skill keeps planned do prose out of active runtime inputs", async () => {
  const raw = await readFile(
    path.join(repoRoot, "skills/blueprint-router/SKILL.md"),
    "utf8"
  );
  const inputs = resolveBlueprintSkillInputsFromContent(
    "blueprint-router",
    "/blu-do",
    raw
  );

  assert.match(raw, /## Planned `\/blu-do` Contract/);
  assert.deepEqual(inputs.shared, []);
  assert.deepEqual(inputs.commandSpecific, []);
  assert.deepEqual(inputs.effective, []);
});

test("debug structured input bundle does not fall back to legacy docs for unknown commands", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-debug",
    "/blu-unknown-debug-command",
    readRelativePath
  );

  assert.equal(inputs.skill, "blueprint-debug");
  assert.deepEqual(inputs.shared, []);
  assert.deepEqual(inputs.commandSpecific, []);
  assert.deepEqual(inputs.effective, []);
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

test("roadmap-admin commands resolve docless command-scoped inputs", async () => {
  const expectations = [
    [
      "/blu-add-phase",
      ["skills/blueprint-roadmap-admin/references/add-phase-runtime-contract.md"]
    ],
    [
      "/blu-insert-phase",
      ["skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md"]
    ],
    ["/blu-remove-phase", ["commands/blu-remove-phase.toml"]],
    ["/blu-plan-milestone-gaps", ["commands/blu-plan-milestone-gaps.toml"]],
    ["/blu-audit-milestone", ["commands/blu-audit-milestone.toml"]],
    ["/blu-complete-milestone", ["commands/blu-complete-milestone.toml"]],
    ["/blu-milestone-summary", ["commands/blu-milestone-summary.toml"]],
    ["/blu-new-milestone", ["commands/blu-new-milestone.toml"]]
  ] as const;

  for (const [commandPath, commandSpecificInputs] of expectations) {
    const inputs = await loadBlueprintSkillInputs(
      "blueprint-roadmap-admin",
      commandPath,
      readRelativePath
    );

    assert.equal(inputs.skill, "blueprint-roadmap-admin");
    assert.deepEqual(inputs.shared, []);
    assert.deepEqual(inputs.commandSpecific, commandSpecificInputs);
    assert.deepEqual(inputs.effective, commandSpecificInputs);
    assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
  }
});

test("map-codebase resolves docs-free manifest and local runtime-contract inputs", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-map",
    "/blu-map-codebase",
    readRelativePath
  );

  assert.equal(inputs.skill, "blueprint-map");
  assert.deepEqual(inputs.shared, []);
  assert.deepEqual(inputs.commandSpecific, [
    "commands/blu-map-codebase.toml",
    "skills/blueprint-map/references/map-runtime-contract.md"
  ]);
  assert.deepEqual(inputs.effective, [
    "commands/blu-map-codebase.toml",
    "skills/blueprint-map/references/map-runtime-contract.md"
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
    assert.equal(
      inputs.effective.some((input) => input.includes("blueprint-god-review")),
      false
    );
  }
});

test("private blueprint-god-review skill is not part of public review input bundles", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-god-review",
    "/blu-code-review",
    readRelativePath
  );

  assert.equal(inputs.skill, "blueprint-god-review");
  assert.deepEqual(inputs.shared, []);
  assert.deepEqual(inputs.commandSpecific, []);
  assert.deepEqual(inputs.effective, []);
});

test("private blueprint-god-review references are loaded by the hidden skill, not public input bundles", async () => {
  const privateReferencePaths = [
    "skills/blueprint-god-review/references/review-method.md",
    "skills/blueprint-god-review/references/lane-rubrics.md",
    "skills/blueprint-god-review/references/finding-quality.md",
    "skills/blueprint-god-review/references/context-selection.md",
    "skills/blueprint-god-review/references/finding-examples.md",
    "skills/blueprint-god-review/references/final-curation.md"
  ];
  const skill = await readRelativePath("skills/blueprint-god-review/SKILL.md");

  for (const referencePath of privateReferencePaths) {
    assert.match(skill, new RegExp(referencePath.replaceAll("/", "\\/")));
  }
  assert.match(skill, /finding-examples\.md` only when classifying duplicate, weak, or no-edit\s+outcomes/i);
  assert.match(skill, /final-curation\.md` only after a\s+hidden review invocation reaches terminal review status/i);

  const publicInputs = await loadBlueprintSkillInputs(
    "blueprint-review",
    "/blu-code-review",
    readRelativePath
  );
  for (const referencePath of privateReferencePaths) {
    assert.equal(publicInputs.effective.includes(referencePath), false);
  }
});

test("docs-update resolves docs-free manifest and local runtime-contract inputs", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-docs",
    "/blu-docs-update",
    readRelativePath
  );

  assert.equal(inputs.skill, "blueprint-docs");
  assert.deepEqual(inputs.shared, []);
  assert.deepEqual(inputs.commandSpecific, [
    "commands/blu-docs-update.toml",
    "skills/blueprint-docs/references/docs-update-runtime-contract.md"
  ]);
  assert.deepEqual(inputs.effective, [
    "commands/blu-docs-update.toml",
    "skills/blueprint-docs/references/docs-update-runtime-contract.md"
  ]);
  assert.equal(inputs.effective.some((input) => input.startsWith("docs/")), false);
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

test("roadmap-admin unknown commands do not fall back to legacy docs inputs", async () => {
  const inputs = await loadBlueprintSkillInputs(
    "blueprint-roadmap-admin",
    "/blu-unknown-roadmap-admin-command",
    readRelativePath
  );

  assert.equal(inputs.skill, "blueprint-roadmap-admin");
  assert.deepEqual(inputs.shared, []);
  assert.deepEqual(inputs.commandSpecific, []);
  assert.deepEqual(inputs.effective, []);
});
