import * as z from "zod/v4";

import { parseNativeMarkdown } from "../shared/native-frontmatter.js";
import { blueprintCommandDefinitionPath } from "./command-paths.js";

export type BlueprintCommandDefinitionValidation = {
  commandName: string;
  relativePath: string;
  valid: boolean;
  issues: string[];
};

type RelativePathReader = (relativePath: string) => Promise<string | null>;

const nativeCommandFrontmatterSchema = z
  .object({
    description: z.string().trim().min(1),
    agent: z.literal("blueprint"),
    subtask: z.literal(false)
  })
  .strict();

function invalid(
  commandName: string,
  relativePath: string,
  issues: string[]
): BlueprintCommandDefinitionValidation {
  return { commandName, relativePath, valid: false, issues };
}

export function validateBlueprintCommandDefinitionContent(
  commandName: string,
  content: string,
  relativePath = blueprintCommandDefinitionPath(commandName)
): BlueprintCommandDefinitionValidation {
  let parsed: ReturnType<typeof parseNativeMarkdown>;
  try {
    parsed = parseNativeMarkdown(content, relativePath);
  } catch (error) {
    return invalid(commandName, relativePath, [
      error instanceof Error ? error.message : String(error)
    ]);
  }

  const validation = nativeCommandFrontmatterSchema.safeParse(parsed.frontmatter);
  const issues = validation.success
    ? []
    : validation.error.issues.map((issue) => {
        const pathLabel = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return `${pathLabel}${issue.message}`;
      });

  if (parsed.body.trim().length === 0) {
    issues.push(`Missing command instructions in ${relativePath}`);
  }
  const argumentTokens = parsed.body.match(/\$ARGUMENTS/g)?.length ?? 0;
  if (argumentTokens !== 1) {
    issues.push(
      `Expected exactly one literal $ARGUMENTS token in ${relativePath}; found ${argumentTokens}`
    );
  }

  return { commandName, relativePath, valid: issues.length === 0, issues };
}

export async function validateBundledBlueprintCommandDefinition(
  commandName: string,
  readRelativePath: RelativePathReader
): Promise<BlueprintCommandDefinitionValidation> {
  const relativePath = blueprintCommandDefinitionPath(commandName);
  const content = await readRelativePath(relativePath);
  if (content === null) {
    return invalid(commandName, relativePath, [`Missing command file: ${relativePath}`]);
  }
  return validateBlueprintCommandDefinitionContent(commandName, content, relativePath);
}
