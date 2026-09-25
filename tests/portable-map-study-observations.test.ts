import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  extractObservedSession,
  extractObservedSessions,
  PortableMapStudyObservationError
} from "../scripts/portable-map-study-observations.mjs";

const parentId = "parent-wave22";
const agentPath = "/root/portable_wave22_author";

function event(type: string, payload: Record<string, unknown>, sequence = 1) {
  return { type, timestamp: `2026-09-25T12:00:${String(sequence).padStart(2, "0")}.000Z`, payload };
}

function lineage() {
  return event("session_meta", {
    id: "session-author",
    source: { subagent: { thread_spawn: { parent_thread_id: parentId, agent_path: agentPath } } }
  }, 0);
}

function token(total: number, input = total - 10, output = 10, cached = 2, reasoning = 3, sequence = total) {
  return event("event_msg", {
    type: "token_count",
    info: {
      total_token_usage: {
        input_tokens: input,
        cached_input_tokens: cached,
        cache_write_input_tokens: 0,
        output_tokens: output,
        reasoning_output_tokens: reasoning,
        total_tokens: total
      },
      last_token_usage: { input_tokens: input, output_tokens: output }
    }
  }, sequence);
}

function execCall(input: string, callId: string, sequence: number) {
  return event("response_item", { type: "custom_tool_call", name: "exec", call_id: callId, input }, sequence);
}

function execResult(callId: string, output: unknown, sequence: number, extra: Record<string, unknown> = {}) {
  return event("response_item", { type: "custom_tool_call_output", call_id: callId, output, ...extra }, sequence);
}

function harnessOutput(actual: string, asJson = false) {
  const prefix = { type: "input_text", text: "Script completed\nWall time: 0.01 seconds\nOutput:\n" };
  const text = asJson ? JSON.stringify({ output: actual, exit_code: 0 }) : actual;
  return [prefix, { type: "input_text", text }];
}

function sourceSnapshot(content: string) {
  return {content, sha256: createHash("sha256").update(content).digest("hex")};
}

async function writeSession(directory: string, rows: unknown[], name = "session.jsonl", trailing = true) {
  const sessionFile = path.join(directory, name);
  const body = rows.map((row) => JSON.stringify(row)).join("\n") + (trailing ? "\n" : "");
  await writeFile(sessionFile, body);
  return sessionFile;
}

async function withTemp(callback: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "portable-map-observations-"));
  try {
    await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("requires exact named session lineage and does not discover neighboring files", async () => {
  await withTemp(async (directory) => {
    const sessionFile = await writeSession(directory, [lineage(), token(20)]);
    await writeSession(directory, [{ unrelated: true }], "unrelated.jsonl");
    const observation = await extractObservedSession({ sessionFile, parentId, agentPath });
    assert.equal(observation.lineage.sessionId, "session-author");
    await assert.rejects(
      extractObservedSession({ sessionFile, parentId: "other-parent", agentPath }),
      (error: unknown) => error instanceof PortableMapStudyObservationError && error.code === "lineage-mismatch"
    );
  });
});

test("extracts the real custom exec envelope, preserves ordered calls/results, and recognizes only delivered cat/sed bytes", async () => {
  await withTemp(async (directory) => {
    const sourceRoot = path.join(directory, "source");
    const catCall = 'const r = await tools.exec_command({cmd:"cat src/a.ts",workdir:"' + sourceRoot + '"}); text(r.output);';
    const sedCall = 'const r = await tools.exec_command({cmd:"sed -n \'2,3p\' src/a.ts",workdir:"' + sourceRoot + '"}); text(r);';
    const rgCall = 'const r = await tools.exec_command({cmd:"rg -n needle src/a.ts",workdir:"' + sourceRoot + '"}); text(r.output);';
    const rows = [
      lineage(),
      token(20, 10, 10, 2, 3, 1),
      token(40, 30, 10, 4, 4, 2),
      execCall(catCall, "cat-1", 3),
      execResult("cat-1", harnessOutput("export const a = 1;\nline two\nline three\n"), 4),
      execCall(sedCall, "sed-1", 5),
      execResult("sed-1", harnessOutput("line two\nline three\n", true), 6),
      execCall(rgCall, "rg-1", 7),
      execResult("rg-1", harnessOutput("src/a.ts:2:needle\n"), 8),
      event("response_item", { type: "message", role: "assistant", phase: "final", content: [{ type: "output_text", text: "Checked src/a.ts:2-3 and applied the fix." }], hiddenReasoning: "must not retain" }, 9),
      event("event_msg", { type: "task_complete" }, 10)
    ];
    const sessionFile = await writeSession(directory, rows);
    const observation = await extractObservedSession({ sessionFile, parentId, agentPath, workspaceRoot: sourceRoot, sourceSnapshots: {"src/a.ts": sourceSnapshot("export const a = 1;\nline two\nline three\n")} });
    assert.deepEqual(observation.usage, {
      inputTokens: 30,
      cachedInputTokens: 4,
      outputTokens: 10,
      reasoningOutputTokens: 4,
      totalTokens: 40,
      monetaryCost: null
    });
    assert.deepEqual(observation.sourceReads.map((read) => ({ path: read.path, command: read.command, lineStart: read.lineStart, lineEnd: read.lineEnd })), [
      { path: "src/a.ts", command: "cat", lineStart: 1, lineEnd: null },
      { path: "src/a.ts", command: "sed", lineStart: 2, lineEnd: 3 }
    ]);
    assert.equal(observation.sourceReads[0].coverageBytes, Buffer.byteLength("export const a = 1;\nline two\nline three\n"));
    assert.equal(observation.candidateSearches.length, 1);
    assert.equal(observation.orderedToolEvents.map((entry) => entry.kind).join(","), "call,result,call,result,call,result");
    assert.equal(observation.completionStatus, "completed");
    assert.deepEqual(observation.retentionProxy.overlapPaths, ["src/a.ts"]);
    assert.equal(JSON.stringify(observation).includes("must not retain"), false);
  });
});

test("recognizes final_answer while rejecting commentary and unmarked assistant messages", async () => {
  await withTemp(async (directory) => {
    const rows = [
      lineage(),
      event("response_item", { type: "message", role: "assistant", phase: "commentary", content: [{ type: "output_text", text: "Working from src/commentary.ts:1" }] }, 1),
      event("response_item", { type: "message", role: "assistant", content: [{ type: "output_text", text: "Unmarked src/unmarked.ts:1" }] }, 2),
      event("response_item", { type: "message", role: "assistant", phase: "final_answer", content: [{ type: "output_text", text: "Finished src/final.ts:1" }] }, 3)
    ];
    const incompleteFile = await writeSession(directory, rows, "final-answer-incomplete.jsonl");
    const incomplete = await extractObservedSession({ sessionFile: incompleteFile, parentId, agentPath });
    assert.equal(incomplete.completionStatus, "incomplete");
    assert.equal(incomplete.completionEvidence.explicitFinalMarker, true);
    assert.equal(incomplete.assistantFinals.length, 1);
    assert.deepEqual(incomplete.assistantFinals[0].evidenceRefs, ["src/final.ts"]);

    const completeFile = await writeSession(directory, [...rows, event("event_msg", { type: "task_complete" }, 4)], "final-answer-complete.jsonl");
    const complete = await extractObservedSession({ sessionFile: completeFile, parentId, agentPath });
    assert.equal(complete.completionStatus, "completed");
    assert.equal(complete.parseIssues.length, 0);
    assert.equal(complete.assistantFinals.length, 1);
  });
});

test("keeps missing, duplicate, decreasing, and truncated token metadata visible", async () => {
  await withTemp(async (directory) => {
    const rows = [
      lineage(),
      token(20, 10, 10, 2, 3, 1),
      token(20, 10, 10, 2, 3, 2),
      token(15, 5, 10, 1, 1, 3),
      token(50, 40, 10, 50, 12, 4),
      event("event_msg", { type: "token_count", info: { last_token_usage: { input_tokens: 100 } } }, 5)
    ];
    const sessionFile = await writeSession(directory, rows, "decreasing.jsonl");
    await writeFile(sessionFile, `${await readFile(sessionFile, "utf8")}{"type":"event_msg"`, "utf8");
    const observation = await extractObservedSession({ sessionFile, parentId, agentPath });
    assert.equal(observation.usage, null);
    assert.equal(observation.usageMetadata.duplicates.length, 1);
    assert.ok(observation.usageMetadata.issues.some((issue) => issue.code === "decreasing-cumulative-counter"));
    assert.ok(observation.usageMetadata.issues.some((issue) => issue.code === "cached-input-not-subset"));
    assert.ok(observation.usageMetadata.issues.some((issue) => issue.code === "reasoning-output-not-subset"));
    assert.ok(observation.usageMetadata.issues.some((issue) => issue.code === "missing-cumulative-counters"));
    assert.ok(observation.usageMetadata.issues.some((issue) => issue.code === "truncated-session"));
    assert.equal(observation.truncated, true);
    assert.ok(observation.parseIssues.some((issue) => issue.code === "truncated-json-line"));
  });
});

test("does not guess through batches, missing results, malformed wrappers, or truncated reads", async () => {
  await withTemp(async (directory) => {
    const sourceRoot = path.join(directory, "source");
    const batch = 'const a = await tools.exec_command({cmd:"cat src/a.ts",workdir:"' + sourceRoot + '"}); const b = await tools.exec_command({cmd:"cat src/b.ts",workdir:"' + sourceRoot + '"}); text(a.output);';
    const unsupported = 'const r = await tools.exec_command({cmd:"cat src/c.ts | sed -n \'1,2p\'",workdir:"' + sourceRoot + '"}); text(r.output);';
    const rows = [
      lineage(),
      execCall(batch, "batch-1", 1),
      execResult("batch-1", harnessOutput("a\n"), 2),
      execCall(unsupported, "pipe-1", 3),
      execResult("pipe-1", harnessOutput("pipe output\n"), 4),
      execCall('const r = await tools.exec_command({cmd:"cat src/d.ts",workdir:"' + sourceRoot + '"});', "missing-1", 5),
      event("response_item", { type: "custom_tool_call", name: "exec", call_id: "missing-2", input: { cmd: "cat src/e.ts", workdir: sourceRoot } }, 6),
      execCall('const r = await tools.exec_command({cmd:"cat src/f.ts",workdir:"' + sourceRoot + '"}); text(r.output);', "truncated-1", 7),
      execResult("truncated-1", harnessOutput("partial\n"), 8, { truncated: true })
    ];
    const sessionFile = await writeSession(directory, rows);
    const observation = await extractObservedSession({ sessionFile, parentId, agentPath, workspaceRoot: sourceRoot });
    assert.equal(observation.sourceReads.length, 0);
    assert.ok(observation.unclassifiableEvents.some((event) => event.reason === "multiple-exec-commands"));
    assert.ok(observation.unclassifiableEvents.some((event) => event.reason === "shell-composition"));
    assert.ok(observation.unclassifiableEvents.some((event) => event.reason === "missing-tool-result"));
    assert.ok(observation.unclassifiableEvents.some((event) => event.reason === "unparseable-output-forwarding"));
    assert.ok(observation.unclassifiableEvents.some((event) => event.reason === "truncated-tool-output"));
    assert.equal(observation.truncated, true);
  });
});

test("explicit multi-session extraction requires matching agent paths", async () => {
  await withTemp(async (directory) => {
    const first = await writeSession(directory, [lineage(), token(20)], "one.jsonl");
    const second = await writeSession(directory, [lineage(), token(30)], "two.jsonl");
    const observations = await extractObservedSessions({ sessionFiles: [first, second], parentId, agentPaths: [agentPath, agentPath] });
    assert.equal(observations.length, 2);
    await assert.rejects(
      extractObservedSessions({ sessionFiles: [first, second], parentId, agentPaths: [agentPath] }),
      (error: unknown) => error instanceof PortableMapStudyObservationError && error.code === "invalid-option"
    );
  });
});

test("rejects result-before-call, duplicate results, failed reads, and non-trailing malformed JSON", async () => {
  await withTemp(async (directory) => {
    const root = path.join(directory, "source");
    const catCall = 'const r = await tools.exec_command({cmd:"cat src/a.ts",workdir:"' + root + '"}); text(r.output);';
    const rows = [
      lineage(),
      execResult("cat-1", harnessOutput("wrong\n"), 1),
      execCall(catCall, "cat-1", 2),
      execResult("cat-1", harnessOutput("cat: src/a.ts: No such file or directory\n"), 3),
      execResult("cat-1", harnessOutput("duplicate\n"), 4),
      execCall(catCall.replace("cat src/a.ts", "cat src/missing.ts"), "fail-1", 5),
      execResult("fail-1", harnessOutput("cat: src/missing.ts: No such file or directory\n"), 6),
      event("response_item", {type: "message", role: "assistant", phase: "final", content: [{type: "output_text", text: "done"}]}, 7),
      event("event_msg", {type: "task_complete"}, 8)
    ];
    const sessionFile = await writeSession(directory, rows);
    await writeFile(sessionFile, `${(await readFile(sessionFile, "utf8")).split("\n").slice(0, 3).join("\n")}\n{bad-json}\n${(await readFile(sessionFile, "utf8")).split("\n").slice(3).join("\n")}`, "utf8");
    const observation = await extractObservedSession({sessionFile, parentId, agentPath, workspaceRoot: root});
    assert.equal(observation.completionStatus, "incomplete");
    assert.equal(observation.sourceReads.length, 0);
    assert.ok(observation.unclassifiableEvents.some((item) => item.reason === "result-before-call"));
    assert.ok(observation.unclassifiableEvents.some((item) => item.reason === "duplicate-tool-result"));
    assert.ok(observation.unclassifiableEvents.some((item) => item.reason === "failed-tool-result"));
    assert.equal(observation.truncated, true);
  });
});

test("requires verified source snapshots before reporting delivered range bytes", async () => {
  await withTemp(async (directory) => {
    const root = path.join(directory, "source");
    const catCall = 'const r = await tools.exec_command({cmd:"cat src/a.ts",workdir:"' + root + '"}); text(r.output);';
    const rows = [lineage(), execCall(catCall, "cat-1", 1), execResult("cat-1", harnessOutput("a\n"), 2), event("response_item", {type: "message", role: "assistant", phase: "final", content: [{type: "output_text", text: "src/a.ts:1"}]}, 3), event("event_msg", {type: "task_complete"}, 4)];
    const sessionFile = await writeSession(directory, rows);
    const unverified = await extractObservedSession({sessionFile, parentId, agentPath, workspaceRoot: root});
    assert.equal(unverified.sourceReads[0].coverageBytes, null);
    const mismatch = await extractObservedSession({sessionFile, parentId, agentPath, workspaceRoot: root, sourceSnapshots: {"src/a.ts": sourceSnapshot("changed\n")}});
    assert.equal(mismatch.sourceReads.length, 0);
    assert.ok(mismatch.unclassifiableEvents.some((item) => item.reason === "source-output-mismatch"));
  });
});
