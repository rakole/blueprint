import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";

import {
  BoundedStdioServerTransport,
  MAX_MCP_JSON_RPC_REQUEST_BYTES
} from "../src/mcp/bounded-stdio-transport.js";

const settle = () => new Promise<void>(resolve => setImmediate(resolve));

async function harness() {
  const input = new PassThrough();
  const output = new PassThrough();
  const messages: unknown[] = [];
  const errors: Error[] = [];
  let stdout = "";
  let closed = 0;
  output.setEncoding("utf8");
  output.on("data", chunk => { stdout += chunk; });
  const transport = new BoundedStdioServerTransport(input, output);
  transport.onmessage = message => { messages.push(message); };
  transport.onerror = error => { errors.push(error); };
  transport.onclose = () => { closed++; };
  await transport.start();
  return { input, output, transport, messages, errors, stdout: () => stdout, closed: () => closed };
}

test("bounded stdio accepts one-byte chunks, partial lines, and multiple frames without quadratic assembly", async () => {
  const state = await harness();
  const first = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" });
  for (const byte of Buffer.from(first)) state.input.write(Buffer.of(byte));
  await settle();
  assert.equal(state.messages.length, 0, "an unterminated partial frame must not dispatch");

  const second = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "ping" });
  const third = JSON.stringify({ jsonrpc: "2.0", id: 3, method: "ping" });
  state.input.write(Buffer.from(`\n${second}\n${third}\n`));
  await settle();
  assert.deepEqual(state.messages.map(message => (message as { id: number }).id), [1, 2, 3]);
  assert.deepEqual(state.errors, []);
  assert.equal(state.stdout(), "");
  await state.transport.close();
});

test("bounded stdio counts CRLF exactly and rejects max plus one before dispatch", async () => {
  const state = await harness();
  const template = (pad: string) => JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", params: { pad } });
  const emptyBytes = Buffer.byteLength(template(""), "utf8");
  const exact = `${template("x".repeat(MAX_MCP_JSON_RPC_REQUEST_BYTES - emptyBytes - 2))}\r\n`;
  assert.equal(Buffer.byteLength(exact), MAX_MCP_JSON_RPC_REQUEST_BYTES);
  state.input.write(exact);
  await settle();
  assert.equal(state.messages.length, 1);

  const tooLarge = `${template("x".repeat(MAX_MCP_JSON_RPC_REQUEST_BYTES - emptyBytes - 1))}\r\n`;
  assert.equal(Buffer.byteLength(tooLarge), MAX_MCP_JSON_RPC_REQUEST_BYTES + 1);
  state.input.write(tooLarge);
  await settle();
  assert.equal(state.messages.length, 1, "the over-limit frame must never reach the handler");
  const output = state.stdout().trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  assert.equal(output.length, 1);
  assert.equal(output[0].id, null);
  assert.match(output[0].error.message, /request frame exceeds/);
  await state.transport.close();
});

test("bounded stdio recovers after malformed frames, treats EOF as a boundary, and keeps stdout protocol-only", async () => {
  const state = await harness();
  state.input.write("{malformed}\n");
  state.input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 7, method: "ping" })}\n`);
  await settle();
  assert.equal(state.errors.length, 1);
  assert.deepEqual(state.messages.map(message => (message as { id: number }).id), [7]);
  assert.equal(state.stdout(), "", "parse diagnostics must not contaminate protocol stdout");
  state.input.write('{"jsonrpc":"2.0","id":8');
  state.input.end();
  await settle();
  assert.equal(state.messages.length, 1);
  assert.equal(state.errors.length, 2);
  assert.match(state.errors[1]!.message, /incomplete frame/);
  assert.equal(state.closed(), 1);
  assert.equal(state.stdout(), "");

  const oversized = await harness();
  oversized.input.write("x".repeat(MAX_MCP_JSON_RPC_REQUEST_BYTES));
  oversized.input.end();
  await settle();
  const rejection = JSON.parse(oversized.stdout().trim());
  assert.equal(rejection.id, null);
  assert.match(rejection.error.message, /request frame exceeds/);
  assert.equal(oversized.messages.length, 0);
  assert.equal(oversized.closed(), 1);
});
