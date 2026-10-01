import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { resolveBlueprintRuntimeHost } from "../src/mcp/runtime-host.js";

test("runtime host resolves the OpenCode package and isolated XDG state", () => {
  const result = resolveBlueprintRuntimeHost({
    BLUEPRINT_HOST: "opencode",
    BLUEPRINT_EXTENSION_PATH: "/opt/blueprint",
    XDG_DATA_HOME: "/tmp/opencode-data"
  });

  assert.equal(result.host, "opencode");
  assert.equal(result.manifestFileName, "package.json");
  assert.equal(result.contextFileName, "AGENTS.md");
  assert.equal(result.extensionPath, "/opt/blueprint");
  assert.equal(result.globalBlueprintDir, path.resolve("/tmp/opencode-data/opencode/blueprint"));
});

test("runtime host retains an explicit BLUEPRINT_GLOBAL_HOME", () => {
  const result = resolveBlueprintRuntimeHost({
    BLUEPRINT_GLOBAL_HOME: "/tmp/blueprint-isolated"
  });
  assert.equal(result.host, "opencode");
  assert.equal(result.globalBlueprintDir, path.resolve("/tmp/blueprint-isolated"));
  assert.equal(result.updatesDir, path.resolve("/tmp/blueprint-isolated/updates"));
});

test("runtime host rejects legacy host identities", () => {
  assert.throws(
    () => resolveBlueprintRuntimeHost({ BLUEPRINT_HOST: "gemini" }),
    /expected opencode/
  );
});
