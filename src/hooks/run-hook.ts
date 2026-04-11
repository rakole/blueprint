import { writeFile } from "node:fs/promises";

import type { HookInput, HookOutput } from "./shared.js";
import { readHookInput } from "./shared.js";

type HookHandler = (input: HookInput) => HookOutput | Promise<HookOutput>;

async function readAllInput(): Promise<HookInput> {
  try {
    return await readHookInput();
  } catch (error) {
    console.error(
      `blueprint hook: unable to parse stdin JSON${error instanceof Error ? `: ${error.message}` : ""}`
    );
    return {};
  }
}

export async function runHook(handler: HookHandler): Promise<void> {
  const input = await readAllInput();

  try {
    const output = await handler(input);
    process.stdout.write(`${JSON.stringify(output ?? {})}\n`);
  } catch (error) {
    console.error(
      `blueprint hook: unexpected failure${error instanceof Error ? `: ${error.message}` : ""}`
    );
    process.stdout.write("{}\n");
  }
}

export async function writeHookOutput(pathname: string, output: HookOutput): Promise<void> {
  await writeFile(pathname, `${JSON.stringify(output)}\n`, "utf8");
}
