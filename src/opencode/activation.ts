import { createHash } from "node:crypto";

import type { Hooks } from "@opencode-ai/plugin";

const GOD_REVIEW_SKILL = "blueprint-god-review";
const ELIGIBLE_COMMANDS = new Set(["blu-code-review", "blu-code-review-fix"]);
const FLAG_PATTERN = /(?:^|\s)--feels-like-god(?=$|\s)/;

type PendingActivation = {
  command: string;
  eligible: boolean;
  fingerprint: string;
};

export type BlueprintActivationOptions = {
  privateHelperQualified?: boolean;
};

function semanticPart(part: unknown): unknown {
  if (part === null || typeof part !== "object") return part;
  const value = part as Record<string, unknown>;
  return {
    type: value.type,
    text: value.text,
    name: value.name,
    url: value.url,
    filename: value.filename,
    mime: value.mime,
    source: value.source
  };
}

function fingerprintParts(parts: readonly unknown[]): string {
  return createHash("sha256")
    .update(JSON.stringify(parts.map(semanticPart)))
    .digest("hex");
}

function eventSessionId(event: { properties?: unknown }): string | undefined {
  const properties = event.properties;
  if (properties === null || typeof properties !== "object") return undefined;
  const value = properties as Record<string, unknown>;
  if (typeof value.sessionID === "string") return value.sessionID;
  const info = value.info;
  if (info !== null && typeof info === "object" && typeof (info as Record<string, unknown>).id === "string") {
    return (info as Record<string, unknown>).id as string;
  }
  return undefined;
}

export function createBlueprintActivationHooks(
  skillAliases: ReadonlySet<string>,
  options: BlueprintActivationOptions = {}
): Hooks {
  const privateHelperQualified = options.privateHelperQualified === true;
  const pending = new Map<string, PendingActivation>();
  const grants = new Map<string, { command: string; messageID?: string }>();

  const clear = (sessionID: string): void => {
    pending.delete(sessionID);
    grants.delete(sessionID);
  };

  return {
    "command.execute.before": async (input, output) => {
      if (skillAliases.has(input.command)) {
        clear(input.sessionID);
        throw new Error(
          `Blueprint skills are internal workflow components and cannot run as slash commands. Use /blu-help to choose an implemented Blueprint command.`
        );
      }

      if (pending.has(input.sessionID)) {
        clear(input.sessionID);
        return;
      }

      grants.delete(input.sessionID);
      pending.set(input.sessionID, {
        command: input.command,
        eligible: ELIGIBLE_COMMANDS.has(input.command) && FLAG_PATTERN.test(input.arguments),
        fingerprint: fingerprintParts(output.parts)
      });
    },

    "chat.message": async (input, output) => {
      const candidate = pending.get(input.sessionID);
      pending.delete(input.sessionID);
      if (!candidate || candidate.fingerprint !== fingerprintParts(output.parts)) {
        grants.delete(input.sessionID);
        return;
      }
      if (!candidate.eligible) {
        grants.delete(input.sessionID);
        return;
      }
      grants.set(input.sessionID, { command: candidate.command, messageID: input.messageID });
    },

    "tool.execute.before": async (input, output) => {
      if (input.tool !== "skill" || output.args?.name !== GOD_REVIEW_SKILL) return;
      if (!privateHelperQualified) {
        throw new Error(
          `${GOD_REVIEW_SKILL} is blocked because its native OpenCode activation lifecycle has not been qualified on the actual host.`
        );
      }
      if (!grants.has(input.sessionID)) {
        throw new Error(
          `${GOD_REVIEW_SKILL} requires /blu-code-review or /blu-code-review-fix with the standalone --feels-like-god flag in the same active user dispatch.`
        );
      }
    },

    event: async ({ event }) => {
      if (
        event.type !== "command.executed" &&
        event.type !== "session.idle" &&
        event.type !== "session.error" &&
        event.type !== "session.deleted"
      ) {
        return;
      }
      const sessionID = eventSessionId(event as { properties?: unknown });
      if (sessionID) clear(sessionID);
    },

    dispose: async () => {
      pending.clear();
      grants.clear();
    }
  };
}
