import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createPortableMapStudyAdapter,
  measureMcpResponse,
  PortableMapStudyAdapterError,
  STUDY_ARMS,
  STUDY_ROUTES
} from "../scripts/portable-map-study-adapter.mjs";
import { createGitRepo } from "./helpers/git-fixtures.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function createDevelopmentMcpWorkspace() {
  const root = await createGitRepo("portable-study-adapter-");
  await mkdir(path.join(root, ".blueprint", "phases", "01-adapter"), { recursive: true });
  await writeFile(path.join(root, ".blueprint", "PROJECT.md"), "# Adapter fixture\n\nA development-only MCP adapter fixture.\n", "utf8");
  await writeFile(
    path.join(root, ".blueprint", "REQUIREMENTS.md"),
    "# Requirements\n\n| ID | Requirement | Status | Notes |\n| --- | --- | --- | --- |\n| R-1 | Preserve native MCP preparation. | Pending | Adapter fixture. |\n",
    "utf8"
  );
  await writeFile(
    path.join(root, ".blueprint", "ROADMAP.md"),
    "# Roadmap: Adapter fixture\n\n## Phases\n\n- [ ] **Phase 1: Adapter** - Exercise the public adapter\n\n## Phase Details\n\n### Phase 1: Adapter\n**Goal**: Exercise the public adapter.\n**Requirements**: R-1\n",
    "utf8"
  );
  await writeFile(
    path.join(root, ".portable-map-study-development-fixture"),
    "Disposable development-only prerequisite fixture; no study outcomes or authored artifacts.\n",
    "utf8"
  );
  return root;
}

function selectedDevelopmentExtensions() {
  const configured = String(process.env.PORTABLE_MAP_STUDY_BASELINES ?? "")
    .split(path.delimiter)
    .filter(Boolean)
    .map((extensionPath) => path.resolve(extensionPath));
  return [...new Set([repoRoot, ...configured])];
}

function createSyntheticAdapter() {
  const adapter = createPortableMapStudyAdapter({ extensionPath: repoRoot });
  const toolMap = new Map(Object.values(STUDY_ROUTES).map((route) => [
    route.tool,
    {
      name: route.tool,
      inputSchema: {
        properties: {
          cwd: {},
          phase: {},
          portableSelections: {},
          evidenceDelivery: {},
          artifact: {},
          files: {},
          depth: {},
          includeAuthoringContext: {}
        }
      }
    }
  ]));
  const calls = [];
  adapter.client = {
    async callTool(request, _resultSchema, requestOptions) {
      calls.push({ request, requestOptions });
      return {
        content: [{ type: "text", text: JSON.stringify({ status: "ok" }) }],
        structuredContent: { status: "ok" }
      };
    },
    async close() {}
  };
  adapter.toolMap = toolMap;
  return { adapter, calls };
}

test("response accounting keeps one logical payload separate from mirrored MCP transport content", () => {
  const payload = { status: "ready", nested: { value: "payload" } };
  const text = JSON.stringify(payload);
  const accounting = measureMcpResponse({
    content: [{ type: "text", text }],
    structuredContent: payload
  });

  assert.equal(accounting.logicalPayloadBytes, Buffer.byteLength(text));
  assert.equal(accounting.contentTextBytes, Buffer.byteLength(text));
  assert.equal(accounting.structuredContentBytes, Buffer.byteLength(text));
  assert.equal(accounting.mirroredPayloadBytes, Buffer.byteLength(text));
  assert.equal(accounting.contentAndStructuredBytes, Buffer.byteLength(text) * 2);
  assert.equal(accounting.mirrored, true);
  assert.ok(accounting.transportResultBytes > accounting.logicalPayloadBytes);
});

test("real bundled stdio MCP verifies public routes and preserves the native response", async (t) => {
  const workspace = await createDevelopmentMcpWorkspace();
  t.after(async () => rm(path.dirname(workspace), { recursive: true, force: true }));

  const adapter = createPortableMapStudyAdapter({
    extensionPath: repoRoot,
    cwd: workspace,
    clientName: "portable-map-study-adapter-test"
  });
  await adapter.connect();
  t.after(() => adapter.close());

  assert.equal(adapter.listTools().length, 114);
  assert.deepEqual(
    Object.fromEntries(Object.entries(STUDY_ROUTES).map(([key, route]) => [key, route.tool])),
    {
      discuss: "blueprint_discuss_prepare",
      research: "blueprint_research_prepare",
      plan: "blueprint_plan_prepare",
      implementation: "blueprint_phase_context",
      review: "blueprint_review_scope",
      testing: "blueprint_phase_context"
    }
  );

  for (const taskClass of Object.keys(STUDY_ROUTES)) {
    const verified = adapter.verifyRoute(taskClass, STUDY_ARMS.currentLegacy);
    assert.equal(verified.taskClass, taskClass);
    assert.equal(verified.route, STUDY_ROUTES[taskClass].route);
  }
  const portableResearch = adapter.verifyRoute("research", STUDY_ARMS.currentPortable);
  assert.ok(portableResearch.advertisedProperties.includes("portableSelections"));
  assert.ok(portableResearch.advertisedProperties.includes("evidenceDelivery"));
  const compactResearch = adapter.verifyRoute("research", STUDY_ARMS.currentCompactLexical);
  assert.ok(compactResearch.advertisedProperties.includes("evidenceDelivery"));

  const result = await adapter.prepare({
    taskClass: "implementation",
    arm: STUDY_ARMS.currentLegacy,
    cwd: workspace,
    phase: "1",
    provenance: { participant: "development-smoke", repeat: 1 }
  });
  assert.equal(result.response.content[0]?.type, "text");
  assert.deepEqual(result.payload, result.response.structuredContent);
  assert.equal(result.provenance.tool, "blueprint_phase_context");
  assert.equal(result.provenance.taskClass, "implementation");
  assert.equal(result.provenance.arm, STUDY_ARMS.currentLegacy);
  assert.equal(result.provenance.participant, "development-smoke");
  assert.equal(result.accounting.mirrored, true);
  assert.ok(result.accounting.logicalPayloadBytes > 0);
  assert.ok(result.accounting.transportResultBytes >= result.accounting.logicalPayloadBytes);
});

test("unknown tools and flags fail before invocation without fabricating provenance actions", async (t) => {
  const workspace = await createDevelopmentMcpWorkspace();
  t.after(async () => rm(path.dirname(workspace), { recursive: true, force: true }));
  const adapter = createPortableMapStudyAdapter({ extensionPath: repoRoot, cwd: workspace });
  await adapter.connect();
  t.after(() => adapter.close());

  await assert.rejects(
    () => adapter.invoke("blueprint_study_only_tool", {}),
    (error: unknown) => error instanceof PortableMapStudyAdapterError && error.code === "unknown-tool"
  );
  await assert.rejects(
    () => adapter.invoke("blueprint_phase_context", { cwd: workspace, phase: "1", injectedCompactFlag: true }),
    (error: unknown) => error instanceof PortableMapStudyAdapterError && error.code === "unknown-argument"
  );
  assert.deepEqual(adapter.getActionProvenance().actions, []);
});

test("prepare rejects complete option-shape and arm violations before any synthetic action", async () => {
  const cases = [
    {
      name: "unknown top-level flag",
      options: { taskClass: "implementation", injectedCompactFlag: true },
      code: "unknown-option"
    },
    {
      name: "non-provider portable selection",
      options: {
        taskClass: "implementation",
        nativeArguments: { portableSelections: [{ kind: "file", recordId: "file-1" }] }
      },
      code: "unsupported-arm"
    },
    {
      name: "native argument conflict",
      options: { taskClass: "implementation", cwd: "/top-level", nativeArguments: { cwd: "/native" } },
      code: "native-argument-conflict"
    },
    {
      name: "native argument from another route",
      options: { taskClass: "implementation", nativeArguments: { files: ["README.md"] } },
      code: "unsupported-route-argument"
    },
    {
      name: "non-provider evidence delivery",
      options: { taskClass: "review", nativeArguments: { evidenceDelivery: { mode: "full" } } },
      code: "unsupported-arm"
    }
  ];

  for (const testCase of cases) {
    const { adapter, calls } = createSyntheticAdapter();
    await assert.rejects(
      () => adapter.prepare(testCase.options),
      (error: unknown) => error instanceof PortableMapStudyAdapterError && error.code === testCase.code,
      testCase.name
    );
    assert.deepEqual(calls, [], `${testCase.name} must not invoke a synthetic MCP client`);
    assert.deepEqual(adapter.getActionProvenance().actions, [], `${testCase.name} must not record provenance`);
  }
});

test("prepare preserves allowed native arguments while enforcing route policy", async () => {
  const { adapter, calls } = createSyntheticAdapter();
  await adapter.prepare({
    taskClass: "implementation",
    nativeArguments: { cwd: "/native-workspace", phase: "1" }
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].request.arguments, {
    cwd: "/native-workspace",
    phase: "1"
  });
  assert.deepEqual(calls[0].requestOptions, { timeout: 30_000 });
});

test("timeoutMs reaches connect, tools/list, and delayed tools/call SDK requests", async () => {
  const requests = [];
  const fakeClient = {
    async connect(_transport, options) {
      await new Promise((resolve) => setTimeout(resolve, 2));
      requests.push({ operation: "connect", options });
    },
    async listTools(_params, options) {
      await new Promise((resolve) => setTimeout(resolve, 2));
      requests.push({ operation: "listTools", options });
      return {
        tools: [{
          name: "blueprint_phase_context",
          inputSchema: { properties: { cwd: {}, phase: {} } }
        }]
      };
    },
    async callTool(_request, _resultSchema, options) {
      await new Promise((resolve) => setTimeout(resolve, 2));
      requests.push({ operation: "callTool", options });
      return {
        content: [{ type: "text", text: JSON.stringify({ status: "ready" }) }],
        structuredContent: { status: "ready" }
      };
    },
    async close() {}
  };
  const adapter = createPortableMapStudyAdapter({
    extensionPath: repoRoot,
    timeoutMs: 4321,
    clientFactory: () => fakeClient,
    transportFactory: () => ({})
  });
  await adapter.connect();
  await adapter.invoke("blueprint_phase_context", { cwd: "/fixture", phase: "1" });
  assert.deepEqual(requests, [
    { operation: "connect", options: { timeout: 4321 } },
    { operation: "listTools", options: { timeout: 4321 } },
    { operation: "callTool", options: { timeout: 4321 } }
  ]);
});

test("development review and testing routes expose native prerequisite packets", async (t) => {
  const workspace = await createDevelopmentMcpWorkspace();
  t.after(async () => rm(path.dirname(workspace), { recursive: true, force: true }));

  const observations = [];
  for (const extensionPath of selectedDevelopmentExtensions()) {
    const adapter = createPortableMapStudyAdapter({ extensionPath, cwd: workspace, timeoutMs: 5000 });
    await adapter.connect();
    try {
      const review = await adapter.prepare({
        taskClass: "review",
        arm: STUDY_ARMS.currentLegacy,
        cwd: workspace,
        phase: "1",
        files: [".portable-map-study-development-fixture"]
      });
      assert.equal(review.response.isError, undefined);
      assert.equal(review.payload.status, "ready");
      assert.equal(review.payload.reviewMode.source, "explicit-files");
      assert.deepEqual(review.payload.artifacts.summaries, []);

      const testing = await adapter.prepare({
        taskClass: "testing",
        arm: STUDY_ARMS.currentLegacy,
        cwd: workspace,
        phase: "1"
      });
      assert.equal(Boolean(testing.response.isError), false);
      assert.equal(testing.payload.phaseSelection.found, true);
      assert.equal(testing.payload.phaseSelection.phaseNumber, "1");
      assert.equal(testing.payload.phase.phaseNumber, "1");
      assert.ok(Array.isArray(testing.payload.missingArtifacts));
      observations.push({
        extensionPath,
        review: { isError: Boolean(review.response.isError), status: review.payload.status, packetKeys: Object.keys(review.payload) },
        testing: { isError: Boolean(testing.response.isError), phaseFound: testing.payload.phaseSelection.found, phaseNumber: testing.payload.phaseSelection.phaseNumber, packetKeys: Object.keys(testing.payload) }
      });
    } finally {
      await adapter.close();
    }
  }
  assert.ok(observations.length >= 1);
});

test("native MCP validation errors remain observable and action provenance is bounded", async (t) => {
  const workspace = await createDevelopmentMcpWorkspace();
  t.after(async () => rm(path.dirname(workspace), { recursive: true, force: true }));
  const adapter = createPortableMapStudyAdapter({ extensionPath: repoRoot, cwd: workspace, maxActions: 1 });
  await adapter.connect();
  t.after(() => adapter.close());

  const invalid = await adapter.invoke("blueprint_phase_validation_authoring_context", {
    cwd: workspace,
    phase: "1",
    artifact: "invalid-artifact"
  });
  assert.equal(invalid.response.isError, true);
  assert.equal(invalid.provenance.status, "error");
  assert.ok(invalid.response.content[0]?.text?.includes("Input validation error"));

  const valid = await adapter.prepare({
    taskClass: "implementation",
    cwd: workspace,
    phase: "1"
  });
  assert.ok(valid.response);
  const provenance = adapter.getActionProvenance();
  assert.equal(provenance.actions.length, 1);
  assert.equal(provenance.droppedActions, 1);
  assert.equal(provenance.bounded, true);
  assert.equal(provenance.actions[0]?.tool, "blueprint_phase_validation_authoring_context");
  assert.equal("content" in provenance.actions[0]!, false);
});

test("standalone arms remain outside the MCP adapter", async () => {
  const adapter = createPortableMapStudyAdapter({ extensionPath: repoRoot });
  await assert.rejects(
    () => adapter.prepare({ taskClass: "implementation", arm: "standalone" }),
    (error: unknown) => error instanceof PortableMapStudyAdapterError && error.code === "standalone-arm"
  );
  await assert.rejects(
    () => adapter.prepare({
      taskClass: "research",
      arm: STUDY_ARMS.currentLegacy,
      portableSelections: [{ kind: "file", recordId: "file-1" }]
    }),
    (error: unknown) => error instanceof PortableMapStudyAdapterError && error.code === "unsupported-arm"
  );
});
