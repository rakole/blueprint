import process from "node:process";
import type { Readable, Writable } from "node:stream";

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ErrorCode, JSONRPCMessageSchema, type JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

/** Complete newline-delimited JSON-RPC input frame, including escaped string bytes. */
export const MAX_MCP_JSON_RPC_REQUEST_BYTES = 2304 * 1024;
/** A response must echo its id, so accepted ids reserve a bounded part of the response frame. */
export const MAX_MCP_JSON_RPC_ID_BYTES = 16 * 1024;

export class BoundedStdioServerTransport implements Transport {
  private frameBuffer: Buffer | null = null;
  private bufferedBytes = 0;
  private discardingOversizedFrame = false;
  private started = false;
  private closed = false;

  constructor(
    private readonly input: Readable = process.stdin,
    private readonly output: Writable = process.stdout
  ) {}

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  private readonly onInputError = (error: Error) => this.onerror?.(error);

  private write(message: JSONRPCMessage): Promise<void> {
    return new Promise(resolve => {
      if (this.output.write(`${JSON.stringify(message)}\n`)) resolve();
      else this.output.once("drain", resolve);
    });
  }

  private reject(reason: "frame" | "id") {
    const message = reason === "frame"
      ? "JSON-RPC request frame exceeds the fixed encoded byte limit."
      : "JSON-RPC request id exceeds the fixed encoded byte limit.";
    void this.write({
      jsonrpc: "2.0",
      id: null,
      error: { code: ErrorCode.InvalidRequest, message }
    } as unknown as JSONRPCMessage).catch(error => this.onerror?.(error instanceof Error ? error : new Error(String(error))));
  }

  private clearFrame(release = false) {
    this.bufferedBytes = 0;
    if (release) this.frameBuffer = null;
  }

  private append(fragment: Buffer) {
    if (!fragment.byteLength) return;
    this.frameBuffer ??= Buffer.allocUnsafe(MAX_MCP_JSON_RPC_REQUEST_BYTES - 1);
    fragment.copy(this.frameBuffer, this.bufferedBytes);
    this.bufferedBytes += fragment.byteLength;
  }

  private processLine(line: Buffer) {
    const bytes = line.length > 0 && line[line.length - 1] === 0x0d ? line.subarray(0, -1) : line;
    try {
      const message = JSONRPCMessageSchema.parse(JSON.parse(bytes.toString("utf8")));
      if ("method" in message && "id" in message &&
          Buffer.byteLength(JSON.stringify(message.id), "utf8") > MAX_MCP_JSON_RPC_ID_BYTES) {
        this.reject("id");
        return;
      }
      this.onmessage?.(message);
    } catch (error) {
      this.onerror?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private readonly onData = (chunk: Buffer) => {
    let offset = 0;
    while (offset < chunk.byteLength) {
      const newline = chunk.indexOf(0x0a, offset);
      if (this.discardingOversizedFrame) {
        if (newline < 0) return;
        this.discardingOversizedFrame = false;
        this.reject("frame");
        offset = newline + 1;
        continue;
      }
      if (newline < 0) {
        const fragment = chunk.subarray(offset);
        // A complete frame still needs at least one delimiter byte. Once the
        // unterminated payload reaches the frame limit it cannot become legal.
        if (this.bufferedBytes + fragment.byteLength >= MAX_MCP_JSON_RPC_REQUEST_BYTES) {
          this.clearFrame();
          this.discardingOversizedFrame = true;
        } else {
          this.append(fragment);
        }
        return;
      }
      const fragment = chunk.subarray(offset, newline);
      // The raw frame includes LF and, for CRLF, the CR retained in fragment.
      const framedBytes = this.bufferedBytes + fragment.byteLength + 1;
      if (framedBytes > MAX_MCP_JSON_RPC_REQUEST_BYTES) {
        this.clearFrame();
        this.reject("frame");
      } else {
        this.append(fragment);
        const line = this.frameBuffer?.subarray(0, this.bufferedBytes) ?? Buffer.alloc(0);
        this.clearFrame();
        this.processLine(line);
      }
      offset = newline + 1;
    }
  };

  private readonly onEnd = () => {
    if (this.discardingOversizedFrame) this.reject("frame");
    else if (this.bufferedBytes > 0) this.onerror?.(new Error("JSON-RPC input ended with an incomplete frame."));
    this.discardingOversizedFrame = false;
    this.clearFrame(true);
    this.finishClose();
  };

  private finishClose() {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }

  async start(): Promise<void> {
    if (this.started) throw new Error("BoundedStdioServerTransport already started.");
    this.started = true;
    this.input.on("data", this.onData);
    this.input.on("error", this.onInputError);
    this.input.on("end", this.onEnd);
  }

  async close(): Promise<void> {
    this.input.off("data", this.onData);
    this.input.off("error", this.onInputError);
    this.input.off("end", this.onEnd);
    if (this.input.listenerCount("data") === 0) this.input.pause();
    this.discardingOversizedFrame = false;
    this.clearFrame(true);
    this.finishClose();
  }

  send(message: JSONRPCMessage): Promise<void> {
    return this.write(message);
  }
}
