import type { Readable, Writable } from "node:stream";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { type JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
/** Complete newline-delimited JSON-RPC input frame, including escaped string bytes. */
export declare const MAX_MCP_JSON_RPC_REQUEST_BYTES: number;
/** A response must echo its id, so accepted ids reserve a bounded part of the response frame. */
export declare const MAX_MCP_JSON_RPC_ID_BYTES: number;
export declare class BoundedStdioServerTransport implements Transport {
    private readonly input;
    private readonly output;
    private frameBuffer;
    private bufferedBytes;
    private discardingOversizedFrame;
    private started;
    private closed;
    constructor(input?: Readable, output?: Writable);
    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage) => void;
    private readonly onInputError;
    private write;
    private reject;
    private clearFrame;
    private append;
    private processLine;
    private readonly onData;
    private readonly onEnd;
    private finishClose;
    start(): Promise<void>;
    close(): Promise<void>;
    send(message: JSONRPCMessage): Promise<void>;
}
