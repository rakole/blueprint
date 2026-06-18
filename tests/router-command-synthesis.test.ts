import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

function assertOrderedIncludes(content: string, orderedSnippets: string[], message: string) {
  let previousIndex = -1;

  for (const snippet of orderedSnippets) {
    const currentIndex = content.indexOf(snippet);
    assert.ok(currentIndex >= 0, `${message}: missing ${snippet}`);
    assert.ok(currentIndex > previousIndex, `${message}: ${snippet} should appear after the prior step`);
    previousIndex = currentIndex;
  }
}

test("/blu and /blu-help synthesize route guidance from the live command catalog instead of prompt-local chooser mirrors", async () => {
  const [rootRouter, helpCommand] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu.toml"), "utf8"),
    readFile(path.join(repoRoot, "commands/blu-help.toml"), "utf8")
  ]);

  for (const [label, content] of [
    ["root router", rootRouter],
    ["help command", helpCommand]
  ] as const) {
    assert.match(
      content,
      /Synthesize .*route list.*`mcp_blueprint_blueprint_command_catalog`.*runtime after reading it.*do not rely on prompt-local command mirrors/i,
      `${label} should synthesize route guidance from the live catalog`
    );
    assert.doesNotMatch(
      content,
      /command-registry:prompt-chooser:start|I want to\.\.\./,
      `${label} should not embed a generated prompt chooser mirror`
    );
  }

  assertOrderedIncludes(
    rootRouter,
    [
      "Read `mcp_blueprint_blueprint_project_status`",
      "Read `mcp_blueprint_blueprint_command_catalog`",
      "Read `mcp_blueprint_blueprint_config_get`",
      "route inline to the documented Blueprint command behavior",
    ],
    "/blu should consult live project and command state before inline routing"
  );

  assertOrderedIncludes(
    helpCommand,
    [
      "Read `mcp_blueprint_blueprint_project_status`",
      "Read `mcp_blueprint_blueprint_command_catalog`",
      "Return concise routing guidance",
    ],
    "/blu-help should read live project and command state before returning routing guidance"
  );

  assert.match(
    rootRouter,
    /Only recommend or route commands whose `mcp_blueprint_blueprint_command_catalog` entry is `implemented: true`\./,
    "/blu should keep implemented-only routing tied to the live catalog"
  );
  assert.match(
    helpCommand,
    /Only recommend commands whose catalog entry is `implemented: true`\./,
    "/blu-help should keep implemented-only routing tied to the live catalog"
  );
});
