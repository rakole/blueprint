import * as z from "zod/v4";

import { parseNativeMarkdown } from "../shared/native-frontmatter.js";
import { blueprintAgentDefinitionPath } from "./runtime-vocabulary.js";

export type BlueprintAgentFrontmatterValue =
  | string
  | number
  | boolean
  | null
  | BlueprintAgentFrontmatterValue[]
  | { [key: string]: BlueprintAgentFrontmatterValue };

export type BlueprintAgentDefinitionValidation = {
  agentName: string;
  relativePath: string;
  valid: boolean;
  frontmatter: Record<string, BlueprintAgentFrontmatterValue>;
  issues: string[];
};

type RelativePathReader = (relativePath: string) => Promise<string | null>;

const permissionRuleSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.enum(["allow", "ask", "deny"]),
    z.record(z.string().min(1), permissionRuleSchema)
  ])
);

const nativeAgentFrontmatterSchema = z
  .object({
    description: z.string().min(1),
    mode: z.enum(["primary", "subagent"]),
    steps: z.number().int().positive(),
    permission: z.record(z.string().min(1), permissionRuleSchema)
  })
  .strict();

function invalid(
  agentName: string,
  relativePath: string,
  issues: string[],
  frontmatter: Record<string, BlueprintAgentFrontmatterValue> = {}
): BlueprintAgentDefinitionValidation {
  return { agentName, relativePath, valid: false, frontmatter, issues };
}

export function validateBlueprintAgentDefinitionContent(
  expectedAgentName: string,
  content: string,
  relativePath = blueprintAgentDefinitionPath(expectedAgentName)
): BlueprintAgentDefinitionValidation {
  let parsed: ReturnType<typeof parseNativeMarkdown>;

  try {
    parsed = parseNativeMarkdown(content, relativePath);
  } catch (error) {
    return invalid(
      expectedAgentName,
      relativePath,
      [error instanceof Error ? error.message : String(error)]
    );
  }

  const validation = nativeAgentFrontmatterSchema.safeParse(parsed.frontmatter);
  const rawFrontmatter =
    parsed.frontmatter as Record<string, BlueprintAgentFrontmatterValue>;

  if (!validation.success) {
    return invalid(
      expectedAgentName,
      relativePath,
      validation.error.issues.map((issue) => {
        const pathLabel = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return `${pathLabel}${issue.message}`;
      }),
      rawFrontmatter
    );
  }

  const issues: string[] = [];
  const expectedMode = expectedAgentName === "blueprint" ? "primary" : "subagent";

  if (validation.data.mode !== expectedMode) {
    issues.push(
      `Invalid agent mode in ${relativePath}: expected ${expectedMode}, found ${validation.data.mode}`
    );
  }

  if (parsed.body.trim().length === 0) {
    issues.push(`Missing agent instructions in ${relativePath}`);
  }

  return {
    agentName: expectedAgentName,
    relativePath,
    valid: issues.length === 0,
    frontmatter:
      validation.data as Record<string, BlueprintAgentFrontmatterValue>,
    issues
  };
}

export async function validateBundledBlueprintAgentDefinition(
  agentName: string,
  readRelativePath: RelativePathReader
): Promise<BlueprintAgentDefinitionValidation> {
  const relativePath = blueprintAgentDefinitionPath(agentName);
  const content = await readRelativePath(relativePath);

  if (content === null) {
    return invalid(agentName, relativePath, [`Missing agent file: ${relativePath}`]);
  }

  return validateBlueprintAgentDefinitionContent(agentName, content, relativePath);
}

export async function resolveAvailableOptionalAgents(
  agentNames: string[],
  readRelativePath: RelativePathReader
): Promise<string[]> {
  const available: string[] = [];

  for (const agentName of agentNames) {
    const validation = await validateBundledBlueprintAgentDefinition(
      agentName,
      readRelativePath
    );

    if (validation.valid) {
      available.push(agentName);
    }
  }

  return available;
}
