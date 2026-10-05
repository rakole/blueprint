import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parseNativeMarkdown } from "../src/shared/native-frontmatter.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const commandsDir = path.join(repoRoot, "commands");
const argumentReplacementFiles = new Set(["blu-discuss-phase.md", "blu-plan-phase.md"]);
const expectedCommandFiles = [
  "blu.md", "blu-add-backlog.md", "blu-add-phase.md", "blu-add-tests.md", "blu-add-todo.md",
  "blu-audit-fix.md", "blu-audit-milestone.md", "blu-check-todos.md", "blu-cleanup.md",
  "blu-code-review-fix.md", "blu-code-review.md", "blu-complete-milestone.md", "blu-debug.md",
  "blu-discuss-phase.md", "blu-docs-update.md", "blu-execute-phase.md", "blu-explore.md", "blu-fast.md",
  "blu-health.md", "blu-help.md", "blu-impact.md", "blu-insert-phase.md", "blu-list-phase-assumptions.md",
  "blu-map-codebase.md", "blu-milestone-summary.md", "blu-new-milestone.md", "blu-new-project.md",
  "blu-new-workspace.md", "blu-next.md", "blu-note.md", "blu-pause-work.md", "blu-plan-milestone-gaps.md",
  "blu-plan-phase.md", "blu-pr-branch.md", "blu-progress.md", "blu-quick.md", "blu-reapply-patches.md",
  "blu-remove-phase.md", "blu-remove-workspace.md", "blu-research-phase.md", "blu-resume-work.md",
  "blu-review-backlog.md", "blu-review.md", "blu-run-plan.md", "blu-secure-phase.md", "blu-set-profile.md",
  "blu-settings.md", "blu-ship.md", "blu-spec-phase.md", "blu-ui-phase.md", "blu-ui-review.md",
  "blu-undo.md", "blu-update.md", "blu-validate-phase.md", "blu-verify-work.md", "blu-workstreams.md"
].sort();

test("native command conversion preserves the complete command identity set", async () => {
  const files = (await readdir(commandsDir)).filter((entry) => entry.startsWith("blu") && entry.endsWith(".md")).sort();
  const tomls = (await readdir(commandsDir)).filter((entry) => entry.startsWith("blu") && entry.endsWith(".toml"));

  assert.deepEqual(files, expectedCommandFiles);
  assert.equal(tomls.length, 0);
});

test("every native command has only the locked schema and one literal argument token", async () => {
  let phaseInterpolationTokens = 0;

  for (const file of expectedCommandFiles) {
    const content = await readFile(path.join(commandsDir, file), "utf8");
    const parsed = parseNativeMarkdown(content, `commands/${file}`);

    assert.deepEqual(Object.keys(parsed.frontmatter).sort(), ["agent", "description", "subtask"]);
    assert.equal(typeof parsed.frontmatter.description, "string");
    assert.equal(parsed.frontmatter.agent, "blueprint");
    assert.equal(parsed.frontmatter.subtask, false);
    assert.ok(parsed.body.endsWith("\n"), `${file} must retain the terminal-LF convention`);
    assert.equal((parsed.body.match(/\$ARGUMENTS/g) ?? []).length, 1, `${file} must contain one argument token`);
    assert.ok(!parsed.body.includes("{{args}}"), `${file} must not retain a legacy argument marker`);
    phaseInterpolationTokens += (parsed.body.match(/\$\{phaseDir\}|\$\{phasePrefix\}/g) ?? []).length;

    if (argumentReplacementFiles.has(file)) {
      assert.match(parsed.body, /User request: \$ARGUMENTS/);
    } else {
      assert.ok(parsed.body.endsWith("\n\n$ARGUMENTS\n"), `${file} must append an argument paragraph`);
    }
  }

  assert.equal(phaseInterpolationTokens, 6);
});
