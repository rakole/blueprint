import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { promises as fs } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createGitRepo } from "./helpers/git-fixtures.js";
import { validPhaseContextModel } from "./helpers/context-model.js";
import { blueprintConfigSet } from "../src/mcp/tools/config.js";
import { blueprintPhaseArtifactWrite } from "../src/mcp/tools/phase-artifacts.js";
import { blueprintPhaseExecutionTargets, blueprintPhasePlanIndex, blueprintPhasePlanRead, blueprintPhasePlanValidate, blueprintPhasePlanWrite } from "../src/mcp/tools/phase.js";
import { blueprintPlanPrepare, blueprintPlanSubmit, blueprintPlanRead, planDependencies } from "../src/mcp/tools/plan.js";
import { loadPlanCursorAuthorityKey, sealPlanCursor } from "../src/mcp/tools/plan-cursor-authority.js";
import { type PlanningCandidate } from "../src/mcp/tools/plan-model.js";
import { researchDigest } from "../src/mcp/tools/research-evidence.js";
import { blueprintResearchPrepare, blueprintResearchSubmit } from "../src/mcp/tools/research.js";
import { blueprintStateLoad } from "../src/mcp/tools/state.js";
import { createBlueprintServer, createToolResponseContent, MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES, planMcpJsonRpcResponseBytes } from "../src/mcp/server.js";

const phaseDir = ".blueprint/phases/01-planning";
const firstPath = `${phaseDir}/01-01-PLAN.md`;
const secondPath = `${phaseDir}/01-02-PLAN.md`;
const lookup = (cwd: string) => ({ cwd, phase: "1" });
const revision = (result: unknown) => {
  assert.ok(result && typeof result === "object" && "revision" in result, JSON.stringify(result));
  return result.revision as number;
};
function candidate(keys = ["core"]): PlanningCandidate {
  return { plans: keys.map((key, index) => ({
    key, title: `Implement ${key}`, goal: `Expose ${key} behavior through the existing service.`, scope: [`Update src/${key}.ts and its acceptance checks.`],
    dependsOn: index ? [keys[index - 1]] : [],
    tasks: [{ id: "T1", title: `Implement ${key} behavior`, readFirst: ["README.md", `src/${key}.ts`], filesModified: [`src/${key}.ts`], requirements: ["R-1"], action: [`Add the ${key} behavior in src/${key}.ts.`], acceptanceCriteria: [`src/${key}.ts exports the ${key} function.`, "npm test exits with status 0."] }],
    mustHaves: [`The ${key} function exposes the required behavior.`],
  })) };
}
async function fixture(t: TestContext, options: { context?: boolean; checker?: boolean; research?: boolean } = {}) {
  const cwd = await createGitRepo("plan-lifecycle-");
  t.after(() => rm(path.dirname(cwd), { recursive: true, force: true }));
  await mkdir(path.join(cwd, phaseDir), { recursive: true });
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await writeFile(path.join(cwd, "src/core.ts"), "export const core = 1;\n");
  await writeFile(path.join(cwd, ".blueprint/PROJECT.md"), "# Project\n\nDurable planning for a small product.\n\n## Constraints\n\n- Preserve customer data.\n");
  await writeFile(path.join(cwd, ".blueprint/REQUIREMENTS.md"), "# Requirements\n\n- R-1: Expose service behavior and preserve complete plans before publication validation.\n");
  await writeFile(path.join(cwd, ".blueprint/ROADMAP.md"), "# Roadmap: Fixture\n\n## Phases\n\n- [ ] **Phase 1: Planning** - Durable planning\n\n## Phase Details\n\n### Phase 1: Planning\n**Goal**: Save durable planning.\n**Requirements**: R-1\n");
  await blueprintConfigSet({ cwd, patch: { workflow: { research: options.research ?? false, ui_phase: false, plan_check: options.checker ?? false }, research: { external_sources: "off" } } });
  if (options.context !== false) {
    const result = await blueprintPhaseArtifactWrite({ ...lookup(cwd), artifact: "context", model: validPhaseContextModel({ phaseLabel: "phase 1", openQuestions: [], deferredIdeas: [], externalConstraints: ["Preserve customer data across all retries."] }) });
    assert.notEqual(result.status, "invalid", JSON.stringify(result));
  }
  return cwd;
}
async function prepare(cwd: string) {
  const result = await blueprintPlanPrepare({ ...lookup(cwd), evidencePaths: ["src/core.ts"] });
  assert.equal(result.status, "prepared", JSON.stringify(result));
  return result;
}
async function submit(cwd: string, prepared: unknown, draft = candidate(), requestId = "draft") {
  const result = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId, model: draft });
  assert.equal(result.status, "published", JSON.stringify(result));
  return result;
}
async function publishResearchBasis(cwd: string, sourcePath: string, source: string) {
  const research = await blueprintResearchPrepare({ ...lookup(cwd), evidencePaths: [sourcePath] });
  assert.equal(research.status, "prepared", JSON.stringify(research));
  const publishedResearch = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "research-basis", expectedRevision: revision(research), candidate: {
    summary: "Preserve the existing core entry point while adding durable planning persistence.",
    findings: [{ id: "CLM-001", finding: "The research module exports the integration finding.", sourceIds: ["SRC-001"], confidence: "HIGH", requirementIds: ["R-1"], status: "supported" }],
    recommendations: [{ id: "REC-001", recommendation: "Extend the existing core entry point with durable persistence.", findingIds: ["CLM-001"], affectedSurfaces: ["src/core.ts"], verification: ["Interrupt publication and verify that retry preserves the complete draft."], requirementIds: ["R-1"], status: "ready" }],
    openQuestions: [], sources: [{ id: "SRC-001", lane: "repo", reference: `${sourcePath}:1`, excerpt: source.trim() }],
  } });
  assert.equal(publishedResearch.status, "published", JSON.stringify(publishedResearch));
}

const sessionPath = `${phaseDir}/01-PLAN-SESSION.json`;
const markerPath = `${phaseDir}/01-PLAN-PUBLICATION.json`;
async function sessionBytes(cwd: string) { return readFile(path.join(cwd, sessionPath), "utf8"); }
async function targets(cwd: string) { return Object.fromEntries((await blueprintPlanRead(lookup(cwd))).published.map(file => [file.path, file.hash])); }
async function prepareInFreshProcess(input: unknown) {
  const script = `
    const { blueprintPlanPrepare } = await import("./src/mcp/tools/plan.ts");
    const input = JSON.parse(process.env.BLUEPRINT_PLAN_CURSOR_INPUT);
    process.stdout.write(JSON.stringify(await blueprintPlanPrepare(input)));
  `;
  return new Promise<any>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], {
      cwd: process.cwd(),
      env: { ...process.env, BLUEPRINT_PLAN_CURSOR_INPUT: JSON.stringify(input) },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) reject(new Error(`Fresh planning process failed (${code}): ${stderr}`));
      else resolve(JSON.parse(stdout));
    });
  });
}

async function authorityInFreshProcess(cwd: string, startAt: number): Promise<string> {
  const script = `
    const { loadPlanCursorAuthorityKey } = await import("./src/mcp/tools/plan-cursor-authority.ts");
    const startAt = Number(process.env.BLUEPRINT_CURSOR_START_AT);
    if (Date.now() < startAt) await new Promise(resolve => setTimeout(resolve, startAt - Date.now()));
    const key = await loadPlanCursorAuthorityKey(process.env.BLUEPRINT_CURSOR_ROOT, true);
    process.stdout.write(key ? Buffer.from(key).toString("hex") : "null");
  `;
  return new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BLUEPRINT_CURSOR_ROOT: cwd,
        BLUEPRINT_CURSOR_START_AT: String(startAt)
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "", stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) reject(new Error(`Fresh cursor-authority process failed (${code}): ${stderr}`));
      else resolve(stdout);
    });
  });
}

async function gitCommand(cwd: string, args: readonly string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("git", [...args], { cwd, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(`git ${args.join(" ")} failed (${code}): ${stderr}`)));
  });
}

async function bindTestCursorAuthority(cwd: string, rawKey: Uint8Array): Promise<Uint8Array> {
  const rootReal = await fs.realpath(cwd);
  const rootStat = await fs.lstat(cwd);
  const gitReal = await fs.realpath(path.join(cwd, ".git"));
  const gitStat = await fs.lstat(gitReal);
  const repositoryBinding = JSON.stringify({
    version: 1,
    root: { path: rootReal, device: rootStat.dev, inode: rootStat.ino },
    git: { path: gitReal, device: gitStat.dev, inode: gitStat.ino }
  });
  return createHmac("sha256", rawKey)
    .update("blueprint-plan-cursor-repository-v1\0", "utf8")
    .update(repositoryBinding, "utf8")
    .digest();
}

test("one model submission publishes the complete canonical plan set and one replayable receipt", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd);
  assert.ok("schema" in prepared && "example" in prepared && "validationRules" in prepared && "derivedFields" in prepared);
  assert.ok(JSON.stringify(prepared.example).includes("R-1"));
  assert.equal(revision(await prepare(cwd)), revision(prepared));
  const original = planDependencies.validate;
  let validations = 0;
  t.after(() => { planDependencies.validate = original; });
  planDependencies.validate = async args => { validations++; return original(args); };
  const model = candidate(["core", "api"]);
  delete model.plans[0].mustHaves;
  model.plans[0].tasks[0].acceptanceCriteria = ["```\nnpm test\n```"];
  const schema = prepared.schema as { properties: { plans: { items: { properties: {
    evidence: { items: { properties: { artifact: { enum: string[] } } } };
  } } } } };
  assert.deepEqual(schema.properties.plans.items.properties.evidence.items.properties.artifact.enum, prepared.knownEvidenceArtifacts);
  const args = { ...lookup(cwd), expectedRevision: revision(prepared), requestId: "publish", model };
  const result = await blueprintPlanSubmit(args);
  assert.equal(result.status, "published", JSON.stringify(result));
  assert.equal(validations, 1, "The successful first submission validates its complete set once.");
  assert.deepEqual(await blueprintPlanSubmit(args), result);
  assert.equal(validations, 1, "Receipt replay does not regenerate or revalidate the model.");
  const plans = await blueprintPhasePlanIndex(lookup(cwd));
  assert.deepEqual(plans.plans.map(plan => [plan.planId, plan.wave]), [["01", 1], ["02", 2]]);
  assert.equal((await blueprintPhasePlanValidate(lookup(cwd))).status, "valid");
  const restored = await blueprintPlanRead(lookup(cwd));
  assert.equal(restored.publication.status, "committed");
  assert.equal(restored.published.length, 2);
  assert.match(restored.published[0].content!, /Implement core/);
  assert.equal(restored.session!.version, 2);
  assert.equal("candidate" in restored.session!, false);
  assert.equal("history" in restored.session!, false);
  const metadata = await sessionBytes(cwd);
  for (const phrase of ["Expose core behavior through the existing service.", "Add the core behavior", '"content":', '"backup":', '"review":']) assert.ok(!metadata.includes(phrase), phrase);
});

test("direct publication receipts reject legacy plan overwrites and continue to guard every reader", async t => {
  const cwd = await fixture(t), published = await submit(cwd, await prepare(cwd));
  const original = await readFile(path.join(cwd, firstPath), "utf8");
  const replacement = original.replace("Implement core", "Mutate published core");
  assert.notEqual(replacement, original);

  const write = await blueprintPhasePlanWrite({
    ...lookup(cwd),
    planId: "01",
    content: replacement,
    overwrite: true,
    validationMode: "warn"
  });
  assert.equal(write.status, "invalid", JSON.stringify(write));
  assert.equal(write.written, false);
  assert.match(write.validation.issues.join("\n"), /blueprint_plan_prepare.*blueprint_plan_submit/i);
  assert.equal(await readFile(path.join(cwd, firstPath), "utf8"), original);

  const lifecycle = await blueprintPlanRead(lookup(cwd));
  const index = await blueprintPhasePlanIndex(lookup(cwd));
  const validation = await blueprintPhasePlanValidate(lookup(cwd));
  const execution = await blueprintPhaseExecutionTargets(lookup(cwd));
  assert.equal(lifecycle.publication.status, "committed");
  assert.match(lifecycle.published[0]?.content ?? "", /Implement core/);
  assert.ok(index.plans.every(plan => plan.valid), JSON.stringify(index.warnings));
  assert.equal(validation.status, "valid", JSON.stringify(validation.issues));
  assert.equal(execution.blockers.executionBlocked, false, JSON.stringify(execution.blockers.reasons));
  assert.equal(revision(lifecycle.session), revision(published));
});

test("direct publication ownership survives every later planning intent and reconciliation", async t => {
  const scenarios = ["choice", "add", "revise", "replace", "reconcile"] as const;

  for (const scenario of scenarios) {
    await t.test(scenario, async subtest => {
      const cwd = await fixture(subtest);
      const published = await submit(cwd, await prepare(cwd), candidate(["core", "api"]));
      let next;
      if (scenario === "choice") {
        next = await blueprintPlanPrepare(lookup(cwd));
        assert.equal(next.status, "choice_required", JSON.stringify(next));
      } else if (scenario === "reconcile") {
        await writeFile(path.join(cwd, firstPath), (await readFile(path.join(cwd, firstPath), "utf8")) + "\nReviewed external note.\n");
        const observed = await targets(cwd);
        assert.equal((await blueprintPlanPrepare(lookup(cwd))).status, "reconciliation_required");
        next = await blueprintPlanPrepare({
          ...lookup(cwd), expectedRevision: revision(published), acknowledgeChangedInputs: true,
          reconcile: { confirmed: true, targetHashes: observed }, mode: "add"
        });
        assert.equal(next.status, "prepared", JSON.stringify(next));
      } else {
        next = await blueprintPlanPrepare({
          ...lookup(cwd), expectedRevision: revision(published), mode: scenario,
          ...(scenario === "add" ? {} : { targetPlanIds: ["01"] })
        });
        assert.equal(next.status, "prepared", JSON.stringify(next));
      }

      const metadata = JSON.parse(await sessionBytes(cwd)) as {
        publicationOwned?: boolean;
        needsIntent?: boolean;
        journal?: unknown;
      };
      assert.equal(metadata.publicationOwned, true);
      if (scenario !== "choice") {
        assert.equal(metadata.needsIntent, false);
        assert.equal(metadata.journal, undefined);
      }

      await rm(path.join(cwd, markerPath));
      const lifecycle = await blueprintPlanRead(lookup(cwd));
      assert.equal(lifecycle.publication.status, "invalid");
      assert.match(lifecycle.publication.reason ?? "", /marker is missing.*lifecycle-owned/i);
      assert.ok(lifecycle.published.every(file => file.content === null));
      const write = await blueprintPhasePlanWrite({
        ...lookup(cwd), planId: "01", content: await readFile(path.join(cwd, firstPath), "utf8"),
        overwrite: true, validationMode: "warn"
      });
      assert.equal(write.status, "invalid", JSON.stringify(write));
      assert.equal(write.written, false);
    });
  }
});

test("existing published sessions migrate durable ownership through the projected schema", async t => {
  const cwd = await fixture(t);
  const published = await submit(cwd, await prepare(cwd), candidate(["core", "api"]));
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), expectedRevision: revision(published), mode: "add" });
  assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
  const legacy = JSON.parse(await sessionBytes(cwd)) as Record<string, unknown>;
  delete legacy.publicationOwned;
  legacy.rejectedDraft = "private legacy prose must be projected away";
  await writeFile(path.join(cwd, sessionPath), JSON.stringify(legacy));

  assert.equal((await blueprintPlanRead(lookup(cwd))).publication.status, "committed");
  const migratedText = await sessionBytes(cwd);
  const migrated = JSON.parse(migratedText) as Record<string, unknown>;
  assert.equal(migrated.publicationOwned, true);
  assert.equal("rejectedDraft" in migrated, false);
  assert.doesNotMatch(migratedText, /private legacy prose/);

  await rm(path.join(cwd, markerPath));
  const blocked = await blueprintPlanRead(lookup(cwd));
  assert.equal(blocked.publication.status, "invalid");
  assert.match(blocked.publication.reason ?? "", /marker is missing.*lifecycle-owned/i);
});

test("committed snapshot reads return not found for plan ids outside the receipt without a live read", async t => {
  const cwd = await fixture(t);
  await submit(cwd, await prepare(cwd));
  const absentPath = path.join(cwd, phaseDir, "01-99-PLAN.md");
  const originalReadFile = fs.readFile;
  let absentReads = 0;
  t.mock.method(fs, "readFile", async (...args: Parameters<typeof fs.readFile>) => {
    if (String(args[0]) === absentPath) {
      absentReads += 1;
      throw new Error("unexpected live read of an absent committed plan id");
    }
    return originalReadFile(...args);
  });

  const result = await blueprintPhasePlanRead({ ...lookup(cwd), planId: "99" });
  assert.equal(result.phaseFound, true);
  assert.equal(result.found, false);
  assert.equal(result.path, `${phaseDir}/01-99-PLAN.md`);
  assert.equal(result.content, null);
  assert.equal(result.validation, null);
  assert.match(result.reason ?? "", /does not exist yet/i);
  assert.equal(absentReads, 0);
});

test("deleting a lifecycle-owned publication marker fails closed across every plan consumer", async t => {
  const cwd = await fixture(t);
  await submit(cwd, await prepare(cwd));
  const original = await readFile(path.join(cwd, firstPath), "utf8");
  await rm(path.join(cwd, markerPath));

  const lifecycle = await blueprintPlanRead(lookup(cwd));
  const primitive = await blueprintPhasePlanRead({ ...lookup(cwd), planId: "01" });
  const index = await blueprintPhasePlanIndex(lookup(cwd));
  const validation = await blueprintPhasePlanValidate(lookup(cwd));
  const state = await blueprintStateLoad({ cwd });
  const execution = await blueprintPhaseExecutionTargets(lookup(cwd));

  assert.equal(lifecycle.publication.status, "invalid");
  assert.match(lifecycle.publication.reason ?? "", /marker is missing.*lifecycle-owned/i);
  assert.ok(lifecycle.published.every(file => file.content === null));
  assert.equal(primitive.validation?.valid, false);
  assert.match(primitive.validation?.issues.join("\n") ?? "", /marker is missing.*lifecycle-owned/i);
  assert.ok(index.plans.every(plan => !plan.valid));
  assert.match(index.warnings.join("\n"), /marker is missing.*lifecycle-owned/i);
  assert.equal(validation.status, "invalid");
  assert.match(validation.issues.join("\n"), /marker is missing.*lifecycle-owned/i);
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-execute-phase/);
  assert.match(state.warnings?.join("\n") ?? "", /marker is missing.*lifecycle-owned/i);
  assert.equal(execution.blockers.executionBlocked, true);
  assert.match(execution.blockers.reasons.join("\n"), /marker is missing.*lifecycle-owned/i);

  const replacement = original.replace("Implement core", "Unreviewed replacement");
  const write = await blueprintPhasePlanWrite({
    ...lookup(cwd), planId: "01", content: replacement, overwrite: true, validationMode: "warn"
  });
  assert.equal(write.status, "invalid", JSON.stringify(write));
  assert.equal(write.written, false);
  assert.match(write.validation.issues.join("\n"), /owned by blueprint_plan_prepare.*blueprint_plan_submit/i);
  assert.equal(await readFile(path.join(cwd, firstPath), "utf8"), original);
});

test("all plan consumers reject bytes substituted between publication checks", async t => {
  const consumers = ["lifecycle", "read", "index", "validate", "state", "execution"] as const;

  for (const consumer of consumers) {
    await t.test(consumer, async subtest => {
      const cwd = await fixture(subtest);
      await submit(cwd, await prepare(cwd));
      const absolutePlan = path.join(cwd, firstPath);
      const original = await readFile(absolutePlan, "utf8");
      const alternate = original.replace("Implement core", "Substituted core");
      assert.notEqual(alternate, original);
      const originalReadFile = fs.readFile;
      let planReads = 0;
      subtest.mock.method(fs, "readFile", async (...args: Parameters<typeof fs.readFile>) => {
        const content = await originalReadFile(...args);
        if (String(args[0]) === absolutePlan) {
          planReads += 1;
          if (planReads === 2) {
            return typeof content === "string" ? alternate : Buffer.from(alternate);
          }
        }
        return content;
      });

      if (consumer === "lifecycle") {
        const result = await blueprintPlanRead(lookup(cwd));
        assert.equal(result.publication.status, "invalid");
        assert.ok(result.published.every(file => file.content === null));
      } else if (consumer === "read") {
        const result = await blueprintPhasePlanRead({ ...lookup(cwd), planId: "01" });
        assert.equal(result.validation?.valid, false);
        assert.match(result.validation?.issues.join("\n") ?? "", /changed after publication|publication changed/i);
      } else if (consumer === "index") {
        const result = await blueprintPhasePlanIndex(lookup(cwd));
        assert.ok(result.plans.every(plan => !plan.valid));
        assert.match(result.warnings.join("\n"), /changed after publication|publication changed/i);
      } else if (consumer === "validate") {
        const result = await blueprintPhasePlanValidate(lookup(cwd));
        assert.equal(result.status, "invalid");
        assert.match(result.issues.join("\n"), /changed after publication|publication changed/i);
      } else if (consumer === "state") {
        const result = await blueprintStateLoad({ cwd });
        assert.doesNotMatch(result.derivedStatus.nextAction, /\/blu-execute-phase/);
        assert.match(result.warnings?.join("\n") ?? "", /changed after publication|publication changed/i);
      } else {
        const result = await blueprintPhaseExecutionTargets(lookup(cwd));
        assert.equal(result.blockers.executionBlocked, true);
        assert.match(JSON.stringify(result), /changed after publication|publication changed/i);
      }
      assert.ok(planReads >= 2, `${consumer} must verify the guarded plan generation twice.`);
    });
  }
});

test("committed publication receipts fail closed when canonical plan bytes are changed outside the owner", async t => {
  const cwd = await fixture(t);
  await submit(cwd, await prepare(cwd));
  await writeFile(path.join(cwd, firstPath), "# Unreviewed replacement\n");

  const lifecycle = await blueprintPlanRead(lookup(cwd));
  const index = await blueprintPhasePlanIndex(lookup(cwd));
  const validation = await blueprintPhasePlanValidate(lookup(cwd));
  const execution = await blueprintPhaseExecutionTargets(lookup(cwd));
  assert.equal(lifecycle.publication.status, "invalid");
  assert.match(lifecycle.publication.reason ?? "", /changed after publication/i);
  assert.ok(lifecycle.published.every(file => file.content === null));
  assert.ok(index.plans.every(plan => !plan.valid));
  assert.match(index.warnings.join("\n"), /changed after publication/i);
  assert.equal(validation.status, "invalid");
  assert.match(validation.issues.join("\n"), /changed after publication/i);
  assert.equal(execution.blockers.executionBlocked, true);
  assert.match(execution.blockers.reasons.join("\n"), /changed after publication/i);
});

test("invalid objects and malformed JSON are rejected without changing session or storing any draft", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), original = await sessionBytes(cwd);
  const malformed = ' { "plans": [{"title":"private rejected prose"}\n';
  const invalid = candidate(); invalid.plans[0].tasks[0].filesModified = ["../unsafe.ts"];
  for (const model of [malformed, invalid, { plans: [] }]) {
    const result = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "invalid", model });
    assert.equal(result.status, "needs_revision", JSON.stringify(result));
    assert.equal(result.saved, false); assert.equal(revision(result), revision(prepared));
    assert.equal(await sessionBytes(cwd), original);
    assert.equal((await blueprintPhasePlanIndex(lookup(cwd))).plans.length, 0);
  }
  // A rejected request ID was never reserved; correcting it needs no new revision.
  await submit(cwd, prepared, candidate(), "invalid");
});

test("assessment exceptions retain no prose or pending request and a retry can publish", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), before = await sessionBytes(cwd);
  const original = planDependencies.compile;
  t.after(() => { planDependencies.compile = original; });
  planDependencies.compile = () => { throw new Error("private injected assessor failure"); };
  const args = { ...lookup(cwd), expectedRevision: revision(prepared), requestId: "retry", model: candidate() };
  assert.equal((await blueprintPlanSubmit(args)).status, "needs_revision");
  assert.equal(await sessionBytes(cwd), before);
  planDependencies.compile = original;
  assert.equal((await blueprintPlanSubmit(args)).status, "published");
  assert.equal((await blueprintPlanSubmit({ ...args, model: { plans: [] } })).status, "rejected");
  assert.equal((await blueprintPlanSubmit({ ...args, requestId: "stale" })).status, "stale");
});

test("missing context and enabled research gates reject models without retaining them", async t => {
  for (const options of [{ context: false }, { research: true }]) {
    const cwd = await fixture(t, options), prepared = await blueprintPlanPrepare(lookup(cwd));
    assert.equal(prepared.status, "blocked");
    const before = await sessionBytes(cwd);
    const result = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "blocked-model", model: candidate() });
    assert.equal(result.status, "needs_revision"); assert.equal(result.saved, false);
    assert.equal(await sessionBytes(cwd), before);
  }
});

test("changed project, requirements and repository evidence require a reviewed refresh", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd);
  for (const relative of [".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", "src/core.ts"]) await writeFile(path.join(cwd, relative), (await readFile(path.join(cwd, relative), "utf8")) + "\nChanged evidence.\n");
  const before = await sessionBytes(cwd);
  assert.equal((await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "stale", model: candidate() })).status, "needs_revision");
  assert.equal(await sessionBytes(cwd), before);
  assert.equal((await blueprintPlanPrepare(lookup(cwd))).status, "stale");
  const refreshed = await blueprintPlanPrepare({ ...lookup(cwd), expectedRevision: revision(prepared), acknowledgeChangedInputs: true });
  assert.equal(refreshed.status, "prepared", JSON.stringify(refreshed));
  await submit(cwd, refreshed);
});

test("optional checker reviews the supplied model without caller-computed hashes or review storage", async t => {
  const cwd = await fixture(t, { checker: true }), prepared = await prepare(cwd), before = await sessionBytes(cwd);
  const args = { ...lookup(cwd), expectedRevision: revision(prepared), requestId: "review", model: candidate() };
  assert.equal((await blueprintPlanSubmit(args)).status, "needs_revision");
  assert.equal((await blueprintPlanSubmit({ ...args, review: { verdict: "revise", summary: "Private reviewer details." } })).status, "needs_revision");
  assert.equal(await sessionBytes(cwd), before);
  const accepted = await blueprintPlanSubmit({ ...args, review: { verdict: "accept", summary: "Private reviewer details." } });
  assert.equal(accepted.status, "published", JSON.stringify(accepted));
  assert.ok(!(await sessionBytes(cwd)).includes("Private reviewer"));
  assert.equal((await blueprintPlanSubmit({ ...args, model: candidate(["different"]) })).status, "rejected");
});

test("interrupted multi-plan publication blocks readers; retry resends the unstored model", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), original = planDependencies.writeText;
  t.after(() => { planDependencies.writeText = original; });
  let failed = false;
  planDependencies.writeText = async (...args) => { if (!failed && args[0].endsWith("01-02-PLAN.md")) { failed = true; throw new Error("private second plan failure"); } return original(...args); };
  const args = { ...lookup(cwd), expectedRevision: revision(prepared), requestId: "interrupted", model: candidate(["core", "api"]) };
  const partial = await blueprintPlanSubmit(args);
  assert.equal(partial.status, "partial", JSON.stringify(partial)); assert.equal(partial.saved, false);
  assert.equal((await blueprintPlanRead(lookup(cwd))).publication.status, "pending");
  assert.equal((await blueprintPhasePlanRead({ ...lookup(cwd), planId: "01" })).validation?.valid, false);
  assert.equal((await blueprintPhasePlanValidate(lookup(cwd))).status, "invalid");
  const metadata = await sessionBytes(cwd);
  assert.ok(!metadata.includes("Expose api behavior")); assert.ok(!metadata.includes("private second plan failure"));
  const { model: _model, ...retry } = args;
  const missing = await blueprintPlanSubmit(retry);
  assert.equal(missing.status, "partial"); assert.match(String("reason" in missing && missing.reason), /Resend/);
  planDependencies.writeText = original;
  assert.equal((await blueprintPlanSubmit(args)).status, "published");
  assert.equal((await blueprintPhasePlanIndex(lookup(cwd))).plans.length, 2);
});

test("state synchronization retry can omit model after canonical files are saved", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), original = planDependencies.stateUpdate;
  t.after(() => { planDependencies.stateUpdate = original; });
  planDependencies.stateUpdate = async () => { throw new Error("private state failure"); };
  const args = { ...lookup(cwd), expectedRevision: revision(prepared), requestId: "state-retry", model: candidate() };
  const partial = await blueprintPlanSubmit(args);
  assert.equal(partial.status, "partial"); assert.equal(partial.saved, true);
  const bytes = await readFile(path.join(cwd, firstPath), "utf8");
  planDependencies.stateUpdate = original;
  const { model: _model, ...retry } = args;
  assert.equal((await blueprintPlanSubmit(retry)).status, "published");
  assert.equal(await readFile(path.join(cwd, firstPath), "utf8"), bytes);
});

test("selected revise preserves other plans and requires explicit overwrite", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd), candidate(["core", "api"]));
  const second = await readFile(path.join(cwd, secondPath), "utf8");
  assert.equal((await blueprintPlanPrepare(lookup(cwd))).status, "choice_required");
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), mode: "revise", targetPlanIds: ["01"], expectedRevision: revision(saved) });
  assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
  const model = candidate(); model.plans[0].title = "Improve core implementation";
  const args = { ...lookup(cwd), expectedRevision: revision(prepared), requestId: "revise", model };
  assert.equal((await blueprintPlanSubmit(args)).status, "needs_revision");
  assert.equal((await blueprintPlanSubmit({ ...args, overwrite: true })).status, "published");
  assert.equal(await readFile(path.join(cwd, secondPath), "utf8"), second);
  assert.match(await readFile(path.join(cwd, firstPath), "utf8"), /Improve core implementation/);
});

test("replace deletes selected surplus plans while add allocates the next slot", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd), candidate(["core", "api"]));
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), mode: "replace", expectedRevision: revision(saved) });
  assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
  const replaced = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "replace", overwrite: true, model: candidate() });
  assert.equal(replaced.status, "published", JSON.stringify(replaced));
  assert.deepEqual((await blueprintPhasePlanIndex(lookup(cwd))).plans.map(p => p.planId), ["01"]);
  const added = await blueprintPlanPrepare({ ...lookup(cwd), mode: "add", expectedRevision: revision(replaced) });
  const model = candidate(["api"]); model.plans[0].dependsOn = ["01"];
  assert.equal((await submit(cwd, added, model, "add")).status, "published");
  assert.deepEqual((await blueprintPhasePlanIndex(lookup(cwd))).plans.map(p => p.planId), ["01", "02"]);
});

test("executed plans and changed targets cannot be overwritten", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd));
  await writeFile(path.join(cwd, `${phaseDir}/01-01-SUMMARY.md`), "# Summary\n\nCompleted core behavior.\n");
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), mode: "replace", targetPlanIds: ["01"], expectedRevision: revision(saved), acknowledgeChangedInputs: true });
  assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
  const result = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "executed", overwrite: true, model: candidate() });
  assert.equal(result.status, "needs_revision"); assert.match(String("reason" in result && result.reason), /Executed/);
  await writeFile(path.join(cwd, firstPath), (await readFile(path.join(cwd, firstPath), "utf8")) + "\nExternal update.\n");
  assert.equal((await blueprintPlanPrepare({ ...lookup(cwd), mode: "replace", targetPlanIds: ["01"] })).status, "reconciliation_required");
});

test("marker write interruptions resume before and after the commit boundary", async t => {
  for (const status of ["pending", "committed"]) {
    const cwd = await fixture(t), prepared = await prepare(cwd), original = planDependencies.writeText;
    t.after(() => { planDependencies.writeText = original; });
    let failed = false;
    planDependencies.writeText = async (...args) => { if (!failed && args[0].endsWith("PLAN-PUBLICATION.json") && args[1].includes(`"status": "${status}"`)) { failed = true; throw new Error(`injected ${status} marker failure`); } return original(...args); };
    const args = { ...lookup(cwd), expectedRevision: revision(prepared), requestId: status, model: candidate() };
    assert.equal((await blueprintPlanSubmit(args)).status, "partial");
    planDependencies.writeText = original;
    assert.equal((await blueprintPlanSubmit(args)).status, "published");
  }
});

test("reconciliation preserves observed canonical and unrelated files without backups", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), original = planDependencies.writeText;
  t.after(() => { planDependencies.writeText = original; });
  planDependencies.writeText = async (...args) => { if (args[0].endsWith("01-02-PLAN.md")) throw new Error("second file interruption"); return original(...args); };
  const interrupted = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "interrupt", model: candidate(["core", "api"]) });
  assert.equal(interrupted.status, "partial");
  planDependencies.writeText = original;
  const originalFirst = await readFile(path.join(cwd, firstPath), "utf8");
  const external = originalFirst + "\nExternally reviewed note.\n";
  await writeFile(path.join(cwd, firstPath), external);
  const unrelated = path.join(cwd, phaseDir, "user-notes.md"); await writeFile(unrelated, "Keep these user notes.\n");
  const observed = await targets(cwd);
  assert.equal((await blueprintPlanPrepare(lookup(cwd))).status, "reconciliation_required");
  const bad = await blueprintPlanPrepare({ ...lookup(cwd), expectedRevision: revision(interrupted), acknowledgeChangedInputs: true, reconcile: { confirmed: true, targetHashes: {} }, mode: "add" });
  assert.equal(bad.status, "reconciliation_required");
  const next = await blueprintPlanPrepare({ ...lookup(cwd), expectedRevision: revision(interrupted), acknowledgeChangedInputs: true, reconcile: { confirmed: true, targetHashes: observed }, mode: "add" });
  assert.equal(next.status, "prepared", JSON.stringify(next));
  assert.equal(await readFile(path.join(cwd, firstPath), "utf8"), external);
  assert.equal(await readFile(unrelated, "utf8"), "Keep these user notes.\n");
  assert.equal((await blueprintPlanRead(lookup(cwd))).publication.status, "committed");
  assert.equal((await blueprintPlanRead(lookup(cwd))).session!.journal, undefined);
});

test("reconciliation failure keeps metadata available for a safe retry", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), original = planDependencies.writeText;
  t.after(() => { planDependencies.writeText = original; });
  planDependencies.writeText = async (...args) => { if (args[0].endsWith("01-02-PLAN.md")) throw new Error("stop"); return original(...args); };
  const partial = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "partial", model: candidate(["core", "api"]) });
  const observed = await targets(cwd);
  const args = { ...lookup(cwd), expectedRevision: revision(partial), acknowledgeChangedInputs: true, reconcile: { confirmed: true as const, targetHashes: observed }, mode: "add" as const };
  planDependencies.writeText = async (...input) => { if (input[0].endsWith("PLAN-PUBLICATION.json")) throw new Error("marker recovery interruption"); return original(...input); };
  assert.equal((await blueprintPlanPrepare(args)).status, "blocked");
  assert.ok((await blueprintPlanRead(lookup(cwd))).session!.journal);
  planDependencies.writeText = original;
  assert.equal((await blueprintPlanPrepare(args)).status, "prepared");
});

test("legacy session migration deletes draft history and reconciles a pending read barrier", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd);
  const session = JSON.parse(await sessionBytes(cwd));
  session.version = 1; session.candidate = { secret: "legacy private rejected draft" }; session.candidateHash = researchDigest(JSON.stringify(session.candidate));
  session.history = [{ revision: 0, kind: "submit", candidate: "legacy private history" }];
  session.journal = { content: "legacy rendered body", backup: "legacy old backup", review: { summary: "legacy reviewer prose" } };
  await writeFile(path.join(cwd, sessionPath), JSON.stringify(session));
  await writeFile(path.join(cwd, markerPath), JSON.stringify({ version: 1, status: "pending", requestId: "legacy", revision: revision(prepared), files: [], removedPaths: [] }));
  const read = await blueprintPlanRead(lookup(cwd));
  assert.equal(read.session!.version, 2); assert.ok(read.session!.legacyPublication);
  const migrated = await sessionBytes(cwd);
  for (const phrase of ["private rejected draft", "private history", "rendered body", "old backup", "reviewer prose"]) assert.ok(!migrated.includes(phrase));
  const next = await blueprintPlanPrepare({ ...lookup(cwd), expectedRevision: read.session!.revision, mode: "add", acknowledgeChangedInputs: true, reconcile: { confirmed: true, targetHashes: {} } });
  assert.equal(next.status, "prepared", JSON.stringify(next));
  assert.equal((await blueprintPlanRead(lookup(cwd))).publication.status, "committed");
  await submit(cwd, next);
});

test("legacy v1 delta receipts migrate only after explicit complete-target reconciliation", async t => {
  const cwd = await fixture(t);
  const published = await submit(cwd, await prepare(cwd), candidate(["core", "api"]));
  const first = await readFile(path.join(cwd, firstPath), "utf8");
  await writeFile(path.join(cwd, markerPath), JSON.stringify({
    version: 1,
    status: "committed",
    requestId: "legacy-delta",
    revision: revision(published),
    files: [{ path: firstPath, hash: researchDigest(first) }],
    removedPaths: []
  }));

  const blocked = await blueprintPlanRead(lookup(cwd));
  assert.equal(blocked.publication.status, "invalid");
  assert.match(blocked.publication.reason ?? "", /legacy v1.*explicitly reconcile.*complete observed target hashes/i);
  assert.ok(blocked.published.every(file => file.content === null));
  const observed = await targets(cwd);
  assert.deepEqual(Object.keys(observed).sort(), [firstPath, secondPath]);
  assert.equal((await blueprintPlanPrepare(lookup(cwd))).status, "reconciliation_required");

  const next = await blueprintPlanPrepare({
    ...lookup(cwd),
    expectedRevision: revision(published),
    acknowledgeChangedInputs: true,
    reconcile: { confirmed: true, targetHashes: observed },
    mode: "add"
  });
  assert.equal(next.status, "prepared", JSON.stringify(next));
  const migrated = JSON.parse(await readFile(path.join(cwd, markerPath), "utf8")) as {
    version: number;
    files: Array<{ path: string }>;
  };
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.files.map(file => file.path).sort(), [firstPath, secondPath]);
  assert.equal((await blueprintPlanRead(lookup(cwd))).publication.status, "committed");
});

test("completed publication requires new intent and cannot silently reuse its previous add mode", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), saved = await submit(cwd, prepared);
  assert.equal((await blueprintPlanPrepare(lookup(cwd))).status, "choice_required");
  const before = await sessionBytes(cwd);
  assert.equal((await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(saved), requestId: "implicit", model: candidate(["api"]) })).status, "needs_revision");
  assert.equal(await sessionBytes(cwd), before);
  const next = await blueprintPlanPrepare({ ...lookup(cwd), expectedRevision: revision(saved), mode: "add" });
  assert.equal(next.status, "prepared", JSON.stringify(next)); assert.ok(revision(next) > revision(saved));
});

test("retained plan mutation during state sync cannot be silently accepted", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd), candidate(["core", "api"]));
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), expectedRevision: revision(saved), mode: "revise", targetPlanIds: ["01"] });
  const original = planDependencies.stateUpdate;
  t.after(() => { planDependencies.stateUpdate = original; });
  planDependencies.stateUpdate = async args => {
    const result = await original(args);
    await writeFile(path.join(cwd, secondPath), (await readFile(path.join(cwd, secondPath), "utf8")) + "\nUnrelated concurrent edit.\n");
    return result;
  };
  const result = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "race", overwrite: true, model: candidate() });
  assert.equal(result.status, "partial", JSON.stringify(result));
  assert.match(String("reason" in result && result.reason), /complete published plan set changed/);
});

test("transitive research source changes are rejected even when not explicitly selected", async t => {
  const cwd = await fixture(t, { research: true }), sourcePath = "src/research-only.ts", source = "export const researchFinding = true;\n";
  await writeFile(path.join(cwd, sourcePath), source);
  await publishResearchBasis(cwd, sourcePath, source);
  const prepared = await prepare(cwd), original = planDependencies.writeText;
  t.after(() => { planDependencies.writeText = original; });
  planDependencies.writeText = async (...args) => {
    const result = await original(...args);
    if (args[0].endsWith("01-01-PLAN.md")) await writeFile(path.join(cwd, sourcePath), source + "// Changed after planning readiness.\n");
    return result;
  };
  const result = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "source-race", model: candidate() });
  assert.equal(result.status, "partial", JSON.stringify(result));
  assert.match(String("reason" in result && result.reason), /research-only/);
  assert.equal((await blueprintPlanRead(lookup(cwd))).publication.status, "pending");
});

test("large malformed input produces bounded diagnostics and never grows metadata", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), before = await sessionBytes(cwd);
  const result = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "large", model: { plans: Array.from({ length: 5000 }, () => ({})) } });
  assert.equal(result.status, "needs_revision");
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 100000);
  assert.equal(await sessionBytes(cwd), before);
});

test("prepare exposes late saved constraints outside truncated evidence excerpts", async t => {
  const cwd = await fixture(t);
  const lateConstraint = "Never send customer records to the public network.";
  const contextPath = path.join(cwd, `${phaseDir}/01-CONTEXT.md`);
  const content = await readFile(contextPath, "utf8");
  await writeFile(contextPath, content.replace("## Dependencies", `${"Useful implementation background. ".repeat(800)}\n\n## Dependencies`).replace("Preserve customer data across all retries.", lateConstraint));
  const prepared = await prepare(cwd);
  assert.ok("grounding" in prepared && JSON.stringify(prepared.grounding).includes(lateConstraint));
  assert.ok("evidence" in prepared && prepared.evidence.some(item => item.path.endsWith("CONTEXT.md") && item.truncated));
  assert.ok(!(await sessionBytes(cwd)).includes(lateConstraint), "Grounding is returned to the author but not duplicated in metadata.");
});

test("prepare bounds selected ordinary evidence and exposes byte continuations", async t => {
  const cwd = await fixture(t);
  const source = Array.from({ length: 20000 }, (_, index) => `export const value${index} = "é";`).join("\n");
  await writeFile(path.join(cwd, "src/core.ts"), source);

  const first: any = await blueprintPlanPrepare({ ...lookup(cwd), evidencePaths: ["src/core.ts"] });
  assert.equal(first.status, "prepared", JSON.stringify(first));
  const bodyBytes = first.evidence.reduce((total: number, item: { content?: string | null }) =>
    total + (typeof item.content === "string" ? Buffer.byteLength(item.content, "utf8") : 0), 0);
  assert.ok(bodyBytes <= 48 * 1024, String(bodyBytes));
  assert.equal(first.evidenceBudget.ordinary.deliveredBodyBytes, bodyBytes);
  assert.ok(first.evidenceBudget.aggregate.deliveredPayloadBytes <= first.evidenceBudget.aggregate.maxPayloadBytes);
  const continuation = first.evidenceBudget.ordinary.continuations.find((item: { path: string }) => item.path === "src/core.ts");
  assert.ok(continuation, JSON.stringify(first.evidenceBudget));
  const delta: any = await blueprintPlanPrepare({
    ...lookup(cwd), evidencePaths: ["src/core.ts"], expectedRevision: first.revision,
    evidenceDelivery: { mode: "delta" }
  });
  assert.equal(typeof delta.evidence.find((item: { path: string }) => item.path === "src/core.ts").content, "string",
    "a truncated excerpt must not claim that the complete source was delivered");
  const currentContinuation = delta.evidenceBudget.ordinary.continuations.find((item: { path: string }) => item.path === "src/core.ts");
  assert.ok(currentContinuation, JSON.stringify(delta.evidenceBudget));

  const next: any = await blueprintPlanPrepare({
    ...lookup(cwd), evidencePaths: ["src/core.ts"], expectedRevision: delta.revision,
    evidenceDelivery: { mode: "full", continuations: [currentContinuation] }
  });
  assert.equal(next.status, "prepared", JSON.stringify(next));
  const continued = next.evidence.find((item: { path: string }) => item.path === "src/core.ts");
  assert.equal(continued.contentOffsetBytes, currentContinuation.offsetBytes);
  assert.ok(typeof continued.content === "string" && continued.content.length > 0);

  await writeFile(path.join(cwd, "src/core.ts"), source.replaceAll("value", "changed"));
  const mixed: any = await blueprintPlanPrepare({
    ...lookup(cwd), evidencePaths: ["src/core.ts"], expectedRevision: next.revision,
    acknowledgeChangedInputs: true,
    evidenceDelivery: { mode: "full", continuations: [currentContinuation] }
  });
  assert.equal(mixed.status, "reread_required", JSON.stringify(mixed));
  assert.equal(Object.hasOwn(mixed, "evidence"), false, "an A-prefix cursor must never expose a B-tail body");
});

test("first nonportable prepare continuation is immediately reusable unchanged", async t => {
  const cwd = await fixture(t);
  await writeFile(path.join(cwd, "src/core.ts"), "export const stable = \"ordinary\";\n".repeat(10000));

  const first: any = await blueprintPlanPrepare({
    ...lookup(cwd), evidencePaths: ["src/core.ts"]
  });
  assert.equal(first.status, "prepared", JSON.stringify(first));
  const continuation = first.evidenceBudget.ordinary.continuations.find((item: { path: string }) => item.path === "src/core.ts");
  assert.ok(continuation, JSON.stringify(first.evidenceBudget));

  const resumed: any = await blueprintPlanPrepare({
    ...lookup(cwd), evidencePaths: ["src/core.ts"], expectedRevision: first.revision,
    evidenceDelivery: { mode: "full", continuations: [continuation] }
  });
  assert.equal(resumed.status, "prepared", JSON.stringify(resumed));
  assert.equal(resumed.revision, first.revision);
  assert.equal(resumed.evidence.find((item: { path: string }) => item.path === "src/core.ts").contentOffsetBytes, continuation.offsetBytes);

  const restarted: any = await prepareInFreshProcess({
    ...lookup(cwd), evidencePaths: ["src/core.ts"], expectedRevision: first.revision,
    evidenceDelivery: { mode: "full", continuations: [continuation] }
  });
  assert.equal(restarted.status, "prepared", JSON.stringify(restarted));
  assert.equal(restarted.evidence.find((item: { path: string }) => item.path === "src/core.ts").contentOffsetBytes, continuation.offsetBytes);

  const forged: any = await blueprintPlanPrepare({
    ...lookup(cwd), evidencePaths: ["src/core.ts"], expectedRevision: first.revision,
    evidenceDelivery: { mode: "full", continuations: [{ ...continuation, offsetBytes: continuation.offsetBytes + 1 }] }
  });
  assert.equal(forged.status, "reread_required", JSON.stringify(forged));
  assert.equal(Object.hasOwn(forged, "evidence"), false);
});

test("cursor authority is repository-bound, private, permission-repairing, and restart-stable", async t => {
  const cwd = await fixture(t);
  await writeFile(path.join(cwd, "src/core.ts"), "export const stable = \"repository bound\";\n".repeat(10000));
  const first: any = await blueprintPlanPrepare({ ...lookup(cwd), evidencePaths: ["src/core.ts"] });
  const continuation = first.evidenceBudget.ordinary.continuations.find((item: { path: string }) => item.path === "src/core.ts");
  assert.ok(continuation, JSON.stringify(first.evidenceBudget));

  const privateDirectory = path.join(cwd, ".git/blueprint");
  const keyPath = path.join(privateDirectory, "plan-cursor.key");
  const directoryStat = await fs.stat(privateDirectory);
  const keyStat = await fs.stat(keyPath);
  assert.equal(directoryStat.mode & 0o077, 0);
  assert.equal(keyStat.mode & 0o077, 0);
  const keyBytes = await readFile(keyPath);
  assert.equal(keyBytes.byteLength, 32);
  assert.doesNotMatch(JSON.stringify(first), new RegExp(keyBytes.toString("hex"), "i"));
  assert.doesNotMatch(await sessionBytes(cwd), new RegExp(keyBytes.toString("hex"), "i"));

  await fs.chmod(privateDirectory, 0o755);
  await fs.chmod(keyPath, 0o644);
  const repaired: any = await prepareInFreshProcess({
    ...lookup(cwd), evidencePaths: ["src/core.ts"], expectedRevision: first.revision,
    evidenceDelivery: { mode: "full", continuations: [continuation] }
  });
  assert.equal(repaired.status, "prepared", JSON.stringify(repaired));
  assert.equal((await fs.stat(privateDirectory)).mode & 0o077, 0);
  assert.equal((await fs.stat(keyPath)).mode & 0o077, 0);

  const copied = await fixture(t);
  await writeFile(path.join(copied, "src/core.ts"), await readFile(path.join(cwd, "src/core.ts")));
  await writeFile(path.join(copied, sessionPath), await readFile(path.join(cwd, sessionPath)));
  const copiedPrivateDirectory = path.join(copied, ".git/blueprint");
  await mkdir(copiedPrivateDirectory, { recursive: true, mode: 0o700 });
  await writeFile(path.join(copiedPrivateDirectory, "plan-cursor.key"), keyBytes, { mode: 0o600 });
  const replayed: any = await blueprintPlanPrepare({
    ...lookup(copied), evidencePaths: ["src/core.ts"], expectedRevision: first.revision,
    evidenceDelivery: { mode: "full", continuations: [continuation] }
  });
  assert.equal(replayed.status, "reread_required", JSON.stringify(replayed));
  assert.equal(Object.hasOwn(replayed, "evidence"), false);
});

test("legacy cursor keys are discarded during atomic private-authority migration", async t => {
  const legacyRelative = ".blueprint/plan-operations/cursor.key";
  const payload = { version: 1, offsetBytes: 4096, sourceHash: "a".repeat(64) };

  const cwd = await fixture(t);
  const legacyKey = Buffer.alloc(32, 0x4c);
  const legacyPath = path.join(cwd, legacyRelative);
  await mkdir(path.dirname(legacyPath), { recursive: true });
  await writeFile(legacyPath, legacyKey, { mode: 0o644 });
  await fs.chmod(legacyPath, 0o644);
  await gitCommand(cwd, ["add", "-f", legacyRelative]);

  const authority = await loadPlanCursorAuthorityKey(cwd, true);
  assert.ok(authority);
  const privatePath = path.join(cwd, ".git/blueprint/plan-cursor.key");
  const privateBytes = await readFile(privatePath);
  assert.equal(privateBytes.byteLength, 32);
  assert.notDeepEqual(privateBytes, legacyKey, "known legacy bytes must never seed the private authority");
  const legacyAuthority = await bindTestCursorAuthority(cwd, legacyKey);
  assert.notEqual(
    sealPlanCursor(authority, "evidence", payload),
    sealPlanCursor(legacyAuthority, "evidence", payload),
    "a known legacy key must not reproduce new cursor seals"
  );
  await assert.rejects(() => fs.access(legacyPath));
  assert.equal((await fs.stat(path.dirname(privatePath))).mode & 0o077, 0);
  assert.equal((await fs.stat(privatePath)).mode & 0o077, 0);
  assert.deepEqual(await loadPlanCursorAuthorityKey(cwd, false), authority, "the migrated private key must survive restart");

  const installedBeforeCleanup = await fixture(t);
  const installedKey = Buffer.alloc(32, 0x31);
  const interruptedLegacyPath = path.join(installedBeforeCleanup, legacyRelative);
  const installedPrivatePath = path.join(installedBeforeCleanup, ".git/blueprint/plan-cursor.key");
  await mkdir(path.dirname(installedPrivatePath), { recursive: true, mode: 0o700 });
  await writeFile(installedPrivatePath, installedKey, { mode: 0o600 });
  await mkdir(path.dirname(interruptedLegacyPath), { recursive: true });
  await writeFile(interruptedLegacyPath, Buffer.alloc(32, 0x32), { mode: 0o644 });

  const recovered = await loadPlanCursorAuthorityKey(installedBeforeCleanup, true);
  assert.ok(recovered);
  assert.deepEqual(await readFile(installedPrivatePath), installedKey, "cleanup recovery must retain the installed private key");
  assert.deepEqual(recovered, await bindTestCursorAuthority(installedBeforeCleanup, installedKey));
  await assert.rejects(() => fs.access(interruptedLegacyPath));
  assert.deepEqual(await loadPlanCursorAuthorityKey(installedBeforeCleanup, false), recovered);

  const partialInstall = await fixture(t);
  const partialLegacyKey = Buffer.alloc(32, 0x71);
  const partialLegacyPath = path.join(partialInstall, legacyRelative);
  const partialPrivatePath = path.join(partialInstall, ".git/blueprint/plan-cursor.key");
  await mkdir(path.dirname(partialPrivatePath), { recursive: true, mode: 0o755 });
  await writeFile(partialPrivatePath, Buffer.alloc(7, 0x70), { mode: 0o644 });
  await mkdir(path.dirname(partialLegacyPath), { recursive: true });
  await writeFile(partialLegacyPath, partialLegacyKey, { mode: 0o644 });

  const repaired = await loadPlanCursorAuthorityKey(partialInstall, true);
  assert.ok(repaired);
  const repairedBytes = await readFile(partialPrivatePath);
  assert.equal(repairedBytes.byteLength, 32);
  assert.notDeepEqual(repairedBytes, partialLegacyKey);
  assert.equal((await fs.stat(path.dirname(partialPrivatePath))).mode & 0o077, 0);
  assert.equal((await fs.stat(partialPrivatePath)).mode & 0o077, 0);
  await assert.rejects(() => fs.access(partialLegacyPath));
  assert.deepEqual(await loadPlanCursorAuthorityKey(partialInstall, false), repaired);
});

test("concurrent processes atomically converge when repairing a truncated private cursor key", async t => {
  const cwd = await fixture(t);
  const privateDirectory = path.join(cwd, ".git/blueprint");
  const privatePath = path.join(privateDirectory, "plan-cursor.key");
  const legacyPath = path.join(cwd, ".blueprint/plan-operations/cursor.key");
  await mkdir(privateDirectory, { recursive: true, mode: 0o755 });
  await writeFile(privatePath, Buffer.alloc(7, 0x61), { mode: 0o644 });
  await mkdir(path.dirname(legacyPath), { recursive: true });
  await writeFile(legacyPath, Buffer.alloc(32, 0x62), { mode: 0o644 });

  const startAt = Date.now() + 750;
  const authorities = await Promise.all(
    Array.from({ length: 8 }, () => authorityInFreshProcess(cwd, startAt))
  );
  assert.ok(authorities.every(value => value !== "null"), JSON.stringify(authorities));
  assert.equal(new Set(authorities).size, 1, JSON.stringify(authorities));

  const stored = await readFile(privatePath);
  assert.equal(stored.byteLength, 32);
  assert.equal(authorities[0], Buffer.from(await bindTestCursorAuthority(cwd, stored)).toString("hex"));
  assert.equal((await fs.stat(privateDirectory)).mode & 0o077, 0);
  assert.equal((await fs.stat(privatePath)).mode & 0o077, 0);
  await assert.rejects(() => fs.access(legacyPath));
  assert.deepEqual(await fs.readdir(privateDirectory), ["plan-cursor.key"], "repair lock and temporary files must be cleaned up");

  const restarted = await authorityInFreshProcess(cwd, Date.now());
  assert.equal(restarted, authorities[0]);
  assert.deepEqual(await readFile(privatePath), stored);
});

test("prepare rejects private Blueprint operational state as selected evidence", async t => {
  const cwd = await fixture(t);
  const paths = [
    ".git/blueprint/plan-cursor.key",
    ".blueprint/plan-operations/cursor.key",
    ".blueprint/codebase-operations/private.json",
    ".blueprint/codebase-incremental/cache.json",
    ".blueprint/locks/plan.lock",
    ".blueprint/runs/private.json",
    `${phaseDir}/01-AUX-SESSION.json`
  ];
  for (const relative of paths) {
    await mkdir(path.dirname(path.join(cwd, relative)), { recursive: true });
    await writeFile(path.join(cwd, relative), "private operational sentinel\n");
    const rejected: any = await blueprintPlanPrepare({ ...lookup(cwd), evidencePaths: [relative] });
    assert.equal(rejected.status, "blocked", `${relative}: ${JSON.stringify(rejected)}`);
    assert.match(rejected.reason, /private Blueprint operational state/, relative);
  }
});

test("prepare rejects aggregate read-time evidence before creating planning state", async t => {
  const cwd = await fixture(t);
  const oversized = "x".repeat(64 * 1024);
  await assert.rejects(() => blueprintPlanPrepare({
    ...lookup(cwd), evidencePaths: ["src/core.ts"],
    evidenceDelivery: {
      mode: "register",
      readTimeEvidence: Array.from({ length: 33 }, () => ({ path: "src/core.ts", bytes: oversized }))
    }
  }), /aggregate limit/);
  await assert.rejects(() => fs.access(path.join(cwd, sessionPath)));
});

test("plan read returns metadata or bounded resumable body pages", async t => {
  const cwd = await fixture(t);
  const largePlan = `# Plan 01\n\n${"évidence\n".repeat(12000)}`;
  await writeFile(path.join(cwd, firstPath), largePlan);

  const metadata: any = await blueprintPlanRead({ ...lookup(cwd), bodyMode: "metadata" });
  assert.equal(metadata.published[0].content, null);
  assert.equal(metadata.bodyPage.deliveredBytes, 0);

  const first: any = await blueprintPlanRead({ ...lookup(cwd), bodyMode: "page", bodyByteLimit: 48 * 1024 });
  assert.ok(Buffer.byteLength(first.published[0].content, "utf8") <= 48 * 1024);
  assert.equal(first.published[0].contentOffsetBytes, 0);
  assert.equal(first.published[0].contentComplete, false);
  assert.ok(first.bodyPage.nextCursor);
  await assert.rejects(() => blueprintPlanRead({
    ...lookup(cwd), bodyMode: "page",
    bodyCursor: { ...first.bodyPage.nextCursor, offsetBytes: first.bodyPage.nextCursor.offsetBytes + 1 }
  }), /stale|cursor/);
  const second: any = await blueprintPlanRead({ ...lookup(cwd), bodyMode: "page", bodyCursor: first.bodyPage.nextCursor });
  assert.equal(second.published[0].contentOffsetBytes, first.bodyPage.nextCursor.offsetBytes);
  assert.ok(second.published[0].content.length > 0);

  await assert.rejects(() => blueprintPlanRead({
    ...lookup(cwd), bodyMode: "page", planIds: ["01"], bodyCursor: first.bodyPage.nextCursor
  }), /filters/);
  await assert.rejects(() => blueprintPlanRead({
    ...lookup(cwd), bodyMode: "page",
    bodyCursor: { ...first.bodyPage.nextCursor, offsetBytes: first.bodyPage.nextCursor.totalBytes }
  }), /stale|cursor|offset or total/);
  await writeFile(path.join(cwd, firstPath), largePlan.replace("Plan 01", "Changed Plan 01"));
  await assert.rejects(() => blueprintPlanRead({
    ...lookup(cwd), bodyMode: "page", bodyCursor: first.bodyPage.nextCursor
  }), /stale|publication/);
});

test("live plan read response stays bounded after text mirroring near the body limit", async t => {
  const cwd = await fixture(t);
  await writeFile(path.join(cwd, "src/core.ts"), "export const bounded = true;\n".repeat(20000));
  const server = createBlueprintServer();
  const client = new Client({ name: "plan-response-boundary", version: "1.0.0" }, { capabilities: {} });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => Promise.all([client.close(), server.close()]));
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const prepared: any = await client.callTool({
    name: "blueprint_plan_prepare",
    arguments: { ...lookup(cwd), evidencePaths: ["src/core.ts"] }
  });
  const preparedText = prepared.content[0].text as string;
  assert.equal(preparedText, JSON.stringify(prepared.structuredContent));
  const preparedBytes = planMcpJsonRpcResponseBytes(prepared.structuredContent);
  assert.ok(preparedBytes <= MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES, String(preparedBytes));
  assert.notEqual(prepared.structuredContent.status, "response_limit");
  assert.ok(prepared.structuredContent.evidenceBudget.ordinary.continuations.length > 0);

  await writeFile(path.join(cwd, firstPath), `# Plan 01\n\n${"bounded body\n".repeat(12000)}`);

  const metadata: any = await client.callTool({
    name: "blueprint_plan_read",
    arguments: { ...lookup(cwd), bodyMode: "metadata" }
  });
  assert.ok(metadata.structuredContent.published.every((item: { content: unknown }) => item.content === null));
  assert.doesNotMatch(metadata.content[0].text, /bounded body/);

  const response: any = await client.callTool({
    name: "blueprint_plan_read",
    arguments: { ...lookup(cwd), bodyMode: "page", bodyByteLimit: 48 * 1024 }
  });
  const text = response.content[0].text as string;
  assert.equal(text, JSON.stringify(response.structuredContent));
  const responseBytes = planMcpJsonRpcResponseBytes(response.structuredContent);
  assert.ok(responseBytes <= MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES, String(responseBytes));
  const actualJsonRpcBytes = Buffer.byteLength(JSON.stringify({ jsonrpc: "2.0", id: 1, result: response }), "utf8");
  assert.ok(actualJsonRpcBytes <= MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES, String(actualJsonRpcBytes));
  assert.notEqual(response.structuredContent.status, "response_limit");
  assert.ok(response.structuredContent.bodyPage.nextCursor);

  const savedSessionPath = path.join(cwd, sessionPath);
  const savedSession = JSON.parse(await readFile(savedSessionPath, "utf8"));
  savedSession.knownEvidenceArtifacts = Array.from({ length: 120 }, (_, index) =>
    `src/${index}-${"quoted-\\\"-path-".repeat(220)}.ts`);
  await writeFile(savedSessionPath, JSON.stringify(savedSession, null, 2) + "\n");
  const oversizedMetadata: any = await client.callTool({
    name: "blueprint_plan_read",
    arguments: { ...lookup(cwd), bodyMode: "metadata" }
  });
  assert.equal(oversizedMetadata.structuredContent.status, "found");
  assert.equal(oversizedMetadata.structuredContent.session.revision, savedSession.revision);
  assert.equal(oversizedMetadata.structuredContent.session.counts.knownEvidenceArtifacts, 120);
  assert.deepEqual(oversizedMetadata.structuredContent.publication, { status: "absent", token: "missing", reason: null });
  assert.doesNotMatch(oversizedMetadata.content[0].text, /quoted-\\\"-path/);
  assert.ok(planMcpJsonRpcResponseBytes(oversizedMetadata.structuredContent) <= MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES);
});

test("planIds binds a large session projection and a single-plan metadata read remains bounded", async t => {
  const cwd = await fixture(t);
  await prepare(cwd);
  const savedSessionPath = path.join(cwd, sessionPath);
  const saved = JSON.parse(await readFile(savedSessionPath, "utf8"));
  const planIds = Array.from({ length: 100 }, (_, index) => String(index + 1).padStart(2, "0"));
  saved.targetPlanIds = planIds;
  saved.existingPlans = planIds.map((planId, index) => ({
    planId,
    wave: index + 1,
    dependsOn: index ? [planIds[index - 1]] : [],
    requirements: [`R-${planId}-${"quoted-\\\"-metadata-".repeat(700)}`]
  }));
  const savedBytes = JSON.stringify(saved, null, 2) + "\n";
  assert.ok(Buffer.byteLength(savedBytes, "utf8") > 1_200_000);
  await writeFile(savedSessionPath, savedBytes);

  const result: any = await blueprintPlanRead({ ...lookup(cwd), bodyMode: "metadata", planIds: ["01"] });
  assert.deepEqual(result.session.targetPlanIds, ["01"]);
  assert.deepEqual(result.session.existingPlans.map((plan: { planId: string }) => plan.planId), ["01"]);
  assert.deepEqual(result.session.metadataScope.planIds, ["01"]);
  assert.equal(result.session.metadataScope.filtered, true);
  assert.equal(result.session.metadataScope.truncated, true);
  assert.equal(result.session.counts.targetPlanIds, 100);
  assert.equal(result.session.counts.scopedTargetPlanIds, 1);
  assert.equal(result.session.counts.existingPlans, 100);
  assert.equal(result.session.counts.scopedExistingPlans, 1);
  assert.ok(planMcpJsonRpcResponseBytes(result) <= MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES);
});

test("public plan response guard replaces an oversized mirrored payload with recovery guidance", () => {
  const evidenceContinuation = {
    path: "src/large-\"quoted\\path.ts", offsetBytes: 1024, totalBytes: 4096,
    hash: "a".repeat(64), revision: 7, basisHash: "b".repeat(64), seal: "f".repeat(64)
  };
  const content = createToolResponseContent("blueprint_plan_prepare", {
    status: "prepared", revision: 7, session: { metadata: "\\\"".repeat(MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES) },
    evidenceBudget: { ordinary: { continuations: [evidenceContinuation] } },
    evidence: [{ path: evidenceContinuation.path, content: "\\\"".repeat(MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES) }]
  });
  const result = JSON.parse(content[0].text);
  assert.equal(result.status, "response_limit");
  assert.equal(result.originalStatus, "prepared");
  assert.equal(result.revision, 7);
  assert.deepEqual(result.evidenceContinuation, evidenceContinuation);
  assert.match(result.nextAction, /evidenceContinuation/);
  assert.ok(planMcpJsonRpcResponseBytes(result) <= MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES);

  const bodyCursor = {
    planId: "01", offsetBytes: 2048, totalBytes: 8192, planHash: "c".repeat(64),
    publicationToken: "d".repeat(64), filterHash: "e".repeat(64), seal: "f".repeat(64)
  };
  const readResult = JSON.parse(createToolResponseContent("blueprint_plan_read", {
    status: "found", session: { metadata: "\\\"".repeat(MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES) },
    bodyPage: { nextCursor: bodyCursor }, publication: { status: "committed", token: bodyCursor.publicationToken }
  })[0].text);
  assert.equal(readResult.status, "response_limit");
  assert.deepEqual(readResult.bodyCursor, bodyCursor);
  assert.deepEqual(readResult.publication, { status: "committed", token: bodyCursor.publicationToken });
  assert.match(readResult.nextAction, /same planIds filter/);
  assert.ok(planMcpJsonRpcResponseBytes(readResult) <= MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES);

  const metadataFallback = JSON.parse(createToolResponseContent("blueprint_plan_read", {
    status: "found",
    session: { metadata: "\\\"".repeat(MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES) },
    published: Array.from({ length: 10 }, (_, index) => ({
      path: `.blueprint/phases/01-planning/01-${String(index + 1).padStart(2, "0")}-PLAN.md`,
      hash: "a".repeat(64), content: null
    })),
    publication: { status: "absent", token: "missing" }
  })[0].text);
  assert.equal(metadataFallback.status, "response_limit");
  assert.deepEqual(metadataFallback.availablePlanIds, Array.from({ length: 10 }, (_, index) => String(index + 1).padStart(2, "0")));
  assert.match(metadataFallback.nextAction, /smaller subset of availablePlanIds/);
  assert.doesNotMatch(metadataFallback.nextAction, /same idempotent|bodyMode=metadata\.$/);

  const singlePlanFallback = JSON.parse(createToolResponseContent("blueprint_plan_read", {
    status: "found",
    session: {
      version: 2, phase: "1", revision: 9, prepared: true,
      counts: { existingPlans: 1, targetPlanIds: 1 },
      metadataScope: { filtered: true, planIds: ["01"], truncated: true },
      existingPlans: [{ planId: "01", requirements: ["\\\"".repeat(MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES)] }]
    },
    published: [{ path: ".blueprint/phases/01-planning/01-01-PLAN.md", hash: "a".repeat(64), content: null }],
    publication: { status: "absent", token: "missing" }
  })[0].text);
  assert.equal(singlePlanFallback.status, "response_limit");
  assert.deepEqual(singlePlanFallback.availablePlanIds, ["01"]);
  assert.equal(singlePlanFallback.metadataProjection.revision, 9);
  assert.deepEqual(singlePlanFallback.metadataProjection.metadataScope.planIds, ["01"]);
  assert.match(singlePlanFallback.nextAction, /metadataProjection|body page/);
  assert.doesNotMatch(singlePlanFallback.nextAction, /smaller subset/);
});
