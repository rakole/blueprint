import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * Public study routes.  These are deliberately kept at the MCP boundary so a
 * study runner cannot smuggle evaluator-only flags into a product call.
 */
export const STUDY_ROUTES = Object.freeze({
  discuss: Object.freeze({
    tool: "blueprint_discuss_prepare",
    route: "native-discuss-prepare"
  }),
  research: Object.freeze({
    tool: "blueprint_research_prepare",
    route: "native-research-prepare"
  }),
  plan: Object.freeze({
    tool: "blueprint_plan_prepare",
    route: "native-plan-prepare"
  }),
  implementation: Object.freeze({
    tool: "blueprint_phase_context",
    route: "native-phase-context"
  }),
  review: Object.freeze({
    tool: "blueprint_review_scope",
    route: "native-review-scope"
  }),
  testing: Object.freeze({
    tool: "blueprint_phase_context",
    route: "native-phase-context"
  })
});

export const STUDY_ARMS = Object.freeze({
  baselineLegacy: "baseline-legacy",
  currentLegacy: "current-legacy",
  currentCompactLexical: "current-compact-lexical",
  currentPortable: "current-portable"
});

const PREPARATION_CLASSES = new Set(Object.keys(STUDY_ROUTES));
const TASK_CLASS_ALIASES = Object.freeze({ discussion: "discuss", planning: "plan" });
const PROVIDER_CLASSES = new Set(["discuss", "research", "plan"]);
const KNOWN_STUDY_ARMS = new Set(Object.values(STUDY_ARMS));
const NATIVE_PREPARE_OPTIONS = Object.freeze([
  "expectedRevision",
  "acknowledgeChangedInputs",
  "reconcile"
]);
const PROVIDER_ARGUMENTS = Object.freeze([
  "evidencePaths",
  "portableSelections",
  "evidenceDelivery",
  ...NATIVE_PREPARE_OPTIONS
]);
const ROUTE_ARGUMENTS = Object.freeze({
  discuss: Object.freeze([...PROVIDER_ARGUMENTS]),
  research: Object.freeze([...PROVIDER_ARGUMENTS]),
  plan: Object.freeze(["mode", "targetPlanIds", ...PROVIDER_ARGUMENTS]),
  implementation: Object.freeze([]),
  review: Object.freeze(["files", "depth", "includeAuthoringContext"]),
  testing: Object.freeze([])
});
const PREPARE_OPTION_KEYS = new Set([
  "taskClass",
  "arm",
  "cwd",
  "phase",
  "provenance",
  "nativeArguments",
  ...new Set(Object.values(ROUTE_ARGUMENTS).flat())
]);
const ARM_CONTROL_KEYS = new Set(["portableSelections", "evidenceDelivery"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function byteLength(value) {
  return Buffer.byteLength(String(value ?? ""), "utf8");
}

function compactErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown MCP error");
  return message.replace(/[\r\n]+/g, " ").slice(0, 500);
}

function serializedBytes(value) {
  try {
    return byteLength(JSON.stringify(value));
  } catch {
    return 0;
  }
}

function structuredText(response) {
  if (!response || response.structuredContent === undefined) return null;
  try {
    return JSON.stringify(response.structuredContent);
  } catch {
    return null;
  }
}

/**
 * Measure the public result returned by the SDK.
 *
 * `logicalPayloadBytes` counts one structured payload.  The MCP server also
 * mirrors that payload in content[0].text, so `mirroredPayloadBytes` records
 * the second copy.  `serializedResultBytes` is the JSON representation of the
 * SDK result object; it is a reproducible result-size proxy, not billed model
 * tokens or complete JSON-RPC wire bytes.
 */
export function measureMcpResponse(response) {
  const textBlocks = Array.isArray(response?.content)
    ? response.content.filter((item) => item?.type === "text" && typeof item.text === "string")
    : [];
  const contentTextBytes = textBlocks.reduce((total, item) => total + byteLength(item.text), 0);
  const firstText = textBlocks[0]?.text ?? "";
  const structured = structuredText(response);
  const structuredContentBytes = structured === null ? 0 : byteLength(structured);
  const mirrored = structured !== null && firstText === structured;
  const logicalPayloadBytes = structured !== null ? structuredContentBytes : byteLength(firstText);
  const mirroredPayloadBytes = mirrored ? structuredContentBytes : 0;
  const contentAndStructuredBytes = contentTextBytes + structuredContentBytes;

  return Object.freeze({
    logicalPayloadBytes,
    contentTextBytes,
    structuredContentBytes,
    mirroredPayloadBytes,
    contentAndStructuredBytes,
    serializedResultBytes: serializedBytes(response),
    // A descriptive alias for callers that use the preflight terminology.
    transportResultBytes: serializedBytes(response),
    mirrored
  });
}

export class PortableMapStudyAdapterError extends Error {
  constructor(code, message, details = {}, cause = undefined) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "PortableMapStudyAdapterError";
    this.code = code;
    this.details = Object.freeze({ ...details });
    if (cause !== undefined) this.nativeError = cause;
  }
}

function routeFor(taskClass) {
  const canonical = typeof taskClass === "string" ? TASK_CLASS_ALIASES[taskClass] ?? taskClass : taskClass;
  if (typeof canonical !== "string" || !PREPARATION_CLASSES.has(canonical)) {
    throw new PortableMapStudyAdapterError(
      "unsupported-class",
      `Unsupported study task class: ${String(taskClass)}`,
      { taskClass }
    );
  }
  return STUDY_ROUTES[canonical];
}

function canonicalTaskClass(taskClass) {
  const canonical = typeof taskClass === "string" ? TASK_CLASS_ALIASES[taskClass] ?? taskClass : taskClass;
  routeFor(canonical);
  return canonical;
}

function assertStudyArm(arm) {
  if (typeof arm !== "string" || !KNOWN_STUDY_ARMS.has(arm)) {
    throw new PortableMapStudyAdapterError(
      "unsupported-arm",
      `Unsupported Blueprint study arm: ${String(arm)}`,
      { arm }
    );
  }
}

function normalizeEnvironment(environment) {
  const merged = { ...process.env, ...(environment ?? {}) };
  return Object.fromEntries(
    Object.entries(merged).filter(([, value]) => typeof value === "string")
  );
}

function normalizeActionMetadata(metadata) {
  if (!isRecord(metadata)) return {};
  const allowed = ["taskClass", "arm", "repeat", "participant", "cohort"];
  const result = {};
  for (const key of allowed) {
    if (metadata[key] !== undefined && metadata[key] !== null) {
      result[key] = typeof metadata[key] === "number"
        ? metadata[key]
        : String(metadata[key]).slice(0, 120);
    }
  }
  return result;
}

function statusFromResponse(response, payload) {
  if (response?.isError) return "error";
  if (isRecord(payload) && typeof payload.status === "string") return payload.status.slice(0, 80);
  return "ok";
}

function assertPrepareOptionShape(options, taskClass) {
  const unknown = Object.keys(options).filter((key) => !PREPARE_OPTION_KEYS.has(key)).sort();
  if (unknown.length > 0) {
    throw new PortableMapStudyAdapterError(
      "unknown-option",
      `Preparation option(s) are not supported: ${unknown.join(", ")}`,
      { taskClass, unknown }
    );
  }
  if (options.provenance !== undefined && !isRecord(options.provenance)) {
    throw new PortableMapStudyAdapterError(
      "invalid-provenance",
      "Preparation provenance must be an object.",
      { taskClass }
    );
  }
  if (options.nativeArguments !== undefined && !isRecord(options.nativeArguments)) {
    throw new PortableMapStudyAdapterError(
      "invalid-native-arguments",
      "nativeArguments must be an object.",
      { taskClass }
    );
  }
  const routeKeys = new Set(ROUTE_ARGUMENTS[taskClass] ?? []);
  const unsupported = Object.keys(options)
    .filter((key) => PREPARE_OPTION_KEYS.has(key))
    .filter((key) => !new Set(["taskClass", "arm", "cwd", "phase", "provenance", "nativeArguments"]).has(key))
    .filter((key) => !routeKeys.has(key));
  const unsupportedControls = unsupported.filter((key) => ARM_CONTROL_KEYS.has(key));
  if (unsupportedControls.length > 0 && !PROVIDER_CLASSES.has(taskClass)) {
    throw new PortableMapStudyAdapterError(
      "unsupported-arm",
      `Study controls are not valid for the ${taskClass} route: ${unsupportedControls.join(", ")}`,
      { taskClass, controls: unsupportedControls }
    );
  }
  if (unsupported.length > 0) {
    throw new PortableMapStudyAdapterError(
      "unsupported-route-argument",
      `Preparation option(s) are not supported for the ${taskClass} route: ${unsupported.join(", ")}`,
      { taskClass, unsupported }
    );
  }
}

function routeArguments(options, taskClass, arm) {
  const canonical = canonicalTaskClass(taskClass);
  const route = routeFor(canonical);
  const args = {};
  const commonKeys = ["cwd", "phase"];
  const routeKeys = [...(ROUTE_ARGUMENTS[canonical] ?? [])];
  for (const key of [...commonKeys, ...routeKeys]) {
    if (options[key] !== undefined) args[key] = options[key];
  }
  if (isRecord(options.nativeArguments)) {
    for (const [key, value] of Object.entries(options.nativeArguments)) {
      if (Object.hasOwn(args, key)) {
        throw new PortableMapStudyAdapterError(
          "native-argument-conflict",
          `nativeArguments conflicts with the preparation option: ${key}`,
          { taskClass: canonical, key }
        );
      }
      args[key] = value;
    }
  }
  return { route, args };
}

function parsePublicPayload(response) {
  if (response?.structuredContent !== undefined) return response.structuredContent;
  const firstText = Array.isArray(response?.content)
    ? response.content.find((item) => item?.type === "text" && typeof item.text === "string")?.text
    : undefined;
  if (typeof firstText !== "string" || firstText.length === 0) return null;
  try {
    return JSON.parse(firstText);
  } catch {
    return null;
  }
}

function assertArmControls(taskClass, arm, args) {
  if (Object.hasOwn(args, "portableSelections") &&
      (!PROVIDER_CLASSES.has(taskClass) || arm !== STUDY_ARMS.currentPortable)) {
    throw new PortableMapStudyAdapterError(
      "unsupported-arm",
      "Portable selections are only valid for the current portable provider arm.",
      { arm, taskClass }
    );
  }
  if (Object.hasOwn(args, "evidenceDelivery") &&
      (!PROVIDER_CLASSES.has(taskClass) ||
        (arm !== STUDY_ARMS.currentCompactLexical && arm !== STUDY_ARMS.currentPortable))) {
    throw new PortableMapStudyAdapterError(
      "unsupported-arm",
      "Evidence delivery controls are only valid for current compact lexical or portable provider arms.",
      { arm, taskClass }
    );
  }
}

function assertRouteArguments(taskClass, args) {
  const allowed = new Set(["cwd", "phase", ...(ROUTE_ARGUMENTS[taskClass] ?? [])]);
  const unsupported = Object.keys(args).filter((key) => !allowed.has(key)).sort();
  if (unsupported.length > 0) {
    throw new PortableMapStudyAdapterError(
      "unsupported-route-argument",
      `Native argument(s) are not valid for the ${taskClass} route: ${unsupported.join(", ")}`,
      { taskClass, unsupported }
    );
  }
}

export class PortableMapStudyAdapter {
  constructor(options = {}) {
    if (!isRecord(options)) {
      throw new PortableMapStudyAdapterError("invalid-options", "Adapter options must be an object.");
    }
    const extensionPath = options.extensionPath ?? path.resolve(scriptDirectory, "../");
    const serverPath = options.serverPath ?? path.join(extensionPath, "dist/mcp/server.js");
    this.extensionPath = path.resolve(extensionPath);
    this.serverPath = path.resolve(serverPath);
    this.cwd = path.resolve(options.cwd ?? process.cwd());
    this.environment = normalizeEnvironment(options.environment);
    this.clientName = String(options.clientName ?? "blueprint-portable-map-study-adapter").slice(0, 120);
    this.clientVersion = String(options.clientVersion ?? "0.1.0").slice(0, 80);
    this.timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1000, Number(options.timeoutMs)) : 30_000;
    this.clientFactory = typeof options.clientFactory === "function"
      ? options.clientFactory
      : (info) => new Client(info);
    this.transportFactory = typeof options.transportFactory === "function"
      ? options.transportFactory
      : (transportOptions) => new StdioClientTransport(transportOptions);
    this.rejectUnknownArguments = options.rejectUnknownArguments !== false;
    this.maxActions = Number.isFinite(options.maxActions)
      ? Math.max(1, Math.min(1000, Math.floor(Number(options.maxActions))))
      : 256;
    this.client = null;
    this.transport = null;
    this.toolMap = null;
    this.actions = [];
    this.droppedActions = 0;
    this.nextActionId = 1;
  }

  get connected() {
    return this.client !== null && this.toolMap !== null;
  }

  async connect() {
    if (this.connected) return this;
    try {
      await access(this.serverPath);
    } catch (error) {
      throw new PortableMapStudyAdapterError(
        "missing-server",
        `Bundled MCP server is unavailable: ${this.serverPath}`,
        { serverPath: this.serverPath },
        error
      );
    }

    const transport = this.transportFactory({
      command: process.execPath,
      args: [this.serverPath],
      cwd: this.cwd,
      env: this.environment,
      stderr: "pipe"
    });
    const client = this.clientFactory({ name: this.clientName, version: this.clientVersion });
    try {
      const requestOptions = { timeout: this.timeoutMs };
      await client.connect(transport, requestOptions);
      const listing = await client.listTools(undefined, requestOptions);
      if (!Array.isArray(listing?.tools)) {
        throw new Error("MCP tools/list returned no tools array.");
      }
      const map = new Map();
      for (const tool of listing.tools) {
        if (!tool || typeof tool.name !== "string" || map.has(tool.name)) {
          throw new Error("MCP tools/list returned an invalid or duplicate tool name.");
        }
        map.set(tool.name, tool);
      }
      this.transport = transport;
      this.client = client;
      this.toolMap = map;
      return this;
    } catch (error) {
      await client.close().catch(() => {});
      throw new PortableMapStudyAdapterError(
        "connect-failed",
        `Unable to connect to the bundled MCP server: ${compactErrorMessage(error)}`,
        { serverPath: this.serverPath },
        error
      );
    }
  }

  async close() {
    const client = this.client;
    this.client = null;
    this.transport = null;
    this.toolMap = null;
    if (client) await client.close().catch(() => {});
  }

  listTools() {
    this.requireConnected();
    return [...this.toolMap.values()];
  }

  getTool(name) {
    this.requireConnected();
    return this.toolMap.get(name);
  }

  verifyTool(name, requiredProperties = []) {
    const tool = this.getTool(name);
    if (!tool) {
      throw new PortableMapStudyAdapterError("unknown-tool", `MCP tool is not advertised: ${name}`, { name });
    }
    const properties = Object.keys(tool.inputSchema?.properties ?? {});
    const missing = requiredProperties.filter((property) => !properties.includes(property));
    if (missing.length > 0) {
      throw new PortableMapStudyAdapterError(
        "schema-mismatch",
        `MCP tool ${name} does not advertise required properties: ${missing.join(", ")}`,
        { name, missing, advertisedProperties: properties }
      );
    }
    return tool;
  }

  verifyRoute(taskClass, arm = STUDY_ARMS.currentLegacy) {
    assertStudyArm(arm);
    const canonical = canonicalTaskClass(taskClass);
    const { route } = routeArguments({ }, canonical, arm);
    const tool = this.verifyTool(route.tool);
    if (arm === STUDY_ARMS.currentPortable && PROVIDER_CLASSES.has(canonical)) {
      this.verifyTool(route.tool, ["portableSelections", "evidenceDelivery"]);
    }
    if (arm === STUDY_ARMS.currentCompactLexical && PROVIDER_CLASSES.has(canonical)) {
      this.verifyTool(route.tool, ["evidenceDelivery"]);
    }
    return Object.freeze({
      taskClass: canonical,
      arm,
      route: route.route,
      tool: route.tool,
      advertisedProperties: Object.keys(tool.inputSchema?.properties ?? {})
    });
  }

  async invoke(name, args = {}, metadata = {}) {
    this.requireConnected();
    const tool = this.verifyTool(name);
    if (!isRecord(args)) {
      throw new PortableMapStudyAdapterError("invalid-arguments", "MCP tool arguments must be an object.", { name });
    }
    const knownProperties = new Set(Object.keys(tool.inputSchema?.properties ?? {}));
    const unknown = Object.keys(args).filter((key) => !knownProperties.has(key)).sort();
    if (this.rejectUnknownArguments && unknown.length > 0) {
      throw new PortableMapStudyAdapterError(
        "unknown-argument",
        `MCP tool ${name} does not advertise argument(s): ${unknown.join(", ")}`,
        { name, unknown, advertisedProperties: [...knownProperties].sort() }
      );
    }

    const action = {
      actionId: `mcp-action-${this.nextActionId++}`,
      kind: "tool-call",
      tool: name,
      requestKeys: Object.keys(args).sort(),
      ...normalizeActionMetadata(metadata)
    };
    try {
      const response = await this.client.callTool(
        { name, arguments: args },
        undefined,
        { timeout: this.timeoutMs }
      );
      const payload = parsePublicPayload(response);
      const accounting = measureMcpResponse(response);
      const provenance = Object.freeze({
        ...action,
        status: statusFromResponse(response, payload),
        isError: Boolean(response?.isError),
        accounting
      });
      this.recordAction(provenance);
      return Object.freeze({ response, payload, accounting, provenance });
    } catch (error) {
      const provenance = Object.freeze({
        ...action,
        status: "transport-error",
        isError: true,
        error: compactErrorMessage(error)
      });
      this.recordAction(provenance);
      if (error instanceof PortableMapStudyAdapterError) throw error;
      throw new PortableMapStudyAdapterError(
        "native-tool-error",
        `MCP tool ${name} failed: ${compactErrorMessage(error)}`,
        { name },
        error
      );
    }
  }

  async prepare(options = {}) {
    if (!isRecord(options)) {
      throw new PortableMapStudyAdapterError("invalid-options", "Preparation options must be an object.");
    }
    const taskClass = canonicalTaskClass(options.taskClass);
    const arm = options.arm ?? STUDY_ARMS.currentLegacy;
    if (arm === "standalone" || arm === "file-only") {
      throw new PortableMapStudyAdapterError(
        "standalone-arm",
        "Standalone file-only arms do not use the Blueprint MCP study adapter.",
        { arm }
      );
    }
    assertStudyArm(arm);
    assertPrepareOptionShape(options, taskClass);
    const { route, args } = routeArguments(options, taskClass, arm);
    assertArmControls(taskClass, arm, args);
    assertRouteArguments(taskClass, args);
    const verified = this.verifyRoute(taskClass, arm);
    const knownProperties = new Set(verified.advertisedProperties);
    const unknown = Object.keys(args).filter((key) => !knownProperties.has(key)).sort();
    if (unknown.length > 0) {
      throw new PortableMapStudyAdapterError(
        "unknown-argument",
        `MCP tool ${route.tool} does not advertise argument(s): ${unknown.join(", ")}`,
        { name: route.tool, unknown, advertisedProperties: verified.advertisedProperties }
      );
    }
    return this.invoke(route.tool, args, {
      ...options.provenance,
      taskClass,
      arm,
      route: verified.route
    });
  }

  getActionProvenance() {
    return Object.freeze({
      actions: this.actions.map((action) => ({ ...action })),
      droppedActions: this.droppedActions,
      bounded: true
    });
  }

  requireConnected() {
    if (!this.connected) {
      throw new PortableMapStudyAdapterError(
        "not-connected",
        "Connect the public MCP adapter before listing or invoking tools."
      );
    }
  }

  recordAction(action) {
    if (this.actions.length >= this.maxActions) {
      this.droppedActions += 1;
      return;
    }
    this.actions.push(action);
  }
}

export function createPortableMapStudyAdapter(options = {}) {
  return new PortableMapStudyAdapter(options);
}

export async function withPortableMapStudyAdapter(options, callback) {
  const adapter = createPortableMapStudyAdapter(options);
  await adapter.connect();
  try {
    return await callback(adapter);
  } finally {
    await adapter.close();
  }
}
