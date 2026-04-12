import { blueprintAgentDefinitionPath } from "./runtime-vocabulary.js";

export type BlueprintAgentFrontmatterValue = string | string[];

export type BlueprintAgentDefinitionValidation = {
  agentName: string;
  relativePath: string;
  valid: boolean;
  frontmatter: Record<string, BlueprintAgentFrontmatterValue>;
  issues: string[];
};

type RelativePathReader = (relativePath: string) => Promise<string | null>;

function extractFrontmatterBlock(content: string): { frontmatter: string; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    return null;
  }

  return {
    frontmatter: match[1],
    body: match[2]
  };
}

function parseFrontmatter(frontmatter: string): {
  frontmatter: Record<string, BlueprintAgentFrontmatterValue>;
  issues: string[];
} {
  const result: Record<string, BlueprintAgentFrontmatterValue> = {};
  const issues: string[] = [];
  const lines = frontmatter.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line.trim()) {
      continue;
    }

    const match = line.match(/^([a-zA-Z_]+):\s*(.*)$/);

    if (!match) {
      issues.push(`Unsupported frontmatter line: ${line}`);
      continue;
    }

    const [, key, rawValue] = match;

    if (rawValue === ">" || rawValue === "|") {
      const blockLines: string[] = [];

      for (index += 1; index < lines.length; index += 1) {
        const blockLine = lines[index];

        if (blockLine.startsWith("  ")) {
          blockLines.push(blockLine.slice(2).trim());
          continue;
        }

        index -= 1;
        break;
      }

      result[key] = blockLines.join(" ").trim();
      continue;
    }

    if (!rawValue) {
      const items: string[] = [];

      for (index += 1; index < lines.length; index += 1) {
        const itemLine = lines[index];
        const itemMatch = itemLine.match(/^  - (.+)$/);

        if (!itemMatch) {
          index -= 1;
          break;
        }

        items.push(itemMatch[1].trim());
      }

      result[key] = items;
      continue;
    }

    result[key] = rawValue.trim();
  }

  return {
    frontmatter: result,
    issues
  };
}

export function validateBlueprintAgentDefinitionContent(
  expectedAgentName: string,
  content: string,
  relativePath = blueprintAgentDefinitionPath(expectedAgentName)
): BlueprintAgentDefinitionValidation {
  const issues: string[] = [];
  const extracted = extractFrontmatterBlock(content);

  if (!extracted) {
    return {
      agentName: expectedAgentName,
      relativePath,
      valid: false,
      frontmatter: {},
      issues: [`Missing YAML frontmatter block in ${relativePath}`]
    };
  }

  const parsed = parseFrontmatter(extracted.frontmatter);
  const frontmatter = parsed.frontmatter;
  issues.push(...parsed.issues);

  if (typeof frontmatter.name !== "string" || frontmatter.name.length === 0) {
    issues.push(`Missing agent name in ${relativePath}`);
  } else if (frontmatter.name !== expectedAgentName) {
    issues.push(
      `Agent name mismatch in ${relativePath}: expected ${expectedAgentName}, found ${frontmatter.name}`
    );
  }

  if (typeof frontmatter.description !== "string" || frontmatter.description.length === 0) {
    issues.push(`Missing agent description in ${relativePath}`);
  }

  if (typeof frontmatter.kind !== "string" || frontmatter.kind !== "local") {
    issues.push(`Missing or invalid agent kind in ${relativePath}`);
  }

  if (!Array.isArray(frontmatter.tools) || frontmatter.tools.length === 0) {
    issues.push(`Missing or empty tools list in ${relativePath}`);
  }

  return {
    agentName: expectedAgentName,
    relativePath,
    valid: issues.length === 0,
    frontmatter,
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
    return {
      agentName,
      relativePath,
      valid: false,
      frontmatter: {},
      issues: [`Missing agent file: ${relativePath}`]
    };
  }

  return validateBlueprintAgentDefinitionContent(agentName, content, relativePath);
}

export async function resolveAvailableOptionalAgents(
  agentNames: string[],
  readRelativePath: RelativePathReader
): Promise<string[]> {
  const available: string[] = [];

  for (const agentName of agentNames) {
    const validation = await validateBundledBlueprintAgentDefinition(agentName, readRelativePath);

    if (validation.valid) {
      available.push(agentName);
    }
  }

  return available;
}
