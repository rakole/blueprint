import * as z from "zod/v4";

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
type ParsedYamlBlock = {
  issues: string[];
  nextIndex: number;
  value: BlueprintAgentFrontmatterValue;
};

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/;
const AGENT_NAME_PATTERN = /^[a-z0-9-_]+$/;

const yamlValueSchema: z.ZodType<BlueprintAgentFrontmatterValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(yamlValueSchema),
    z.record(z.string(), yamlValueSchema)
  ])
);

const localAgentFrontmatterSchema = z
  .object({
    kind: z.literal("local").optional().default("local"),
    name: z.string().regex(AGENT_NAME_PATTERN, "Name must be a valid slug"),
    description: z.string().min(1),
    display_name: z.string().optional(),
    tools: z.array(z.string()).optional(),
    mcp_servers: z.record(z.string(), yamlValueSchema).optional(),
    model: z.string().optional(),
    temperature: z.number().optional(),
    max_turns: z.number().int().positive().optional(),
    timeout_mins: z.number().int().positive().optional()
  })
  .strict();

function extractFrontmatterBlock(content: string): { frontmatter: string; body: string } | null {
  const match = content.match(FRONTMATTER_REGEX);

  if (!match) {
    return null;
  }

  return {
    frontmatter: match[1],
    body: match[2] ?? ""
  };
}

function countIndent(line: string): number {
  let indent = 0;

  while (indent < line.length && line[indent] === " ") {
    indent += 1;
  }

  return indent;
}

function parseScalar(value: string): BlueprintAgentFrontmatterValue {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (value === "null") {
    return null;
  }

  if (/^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  if (/^-?\d+\.\d+$/.test(value)) {
    return Number.parseFloat(value);
  }

  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function foldBlockLines(lines: string[]): string {
  const paragraphs: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      paragraphs.push(paragraph.join(" "));
      paragraph = [];
    }
  };

  for (const line of lines) {
    if (line.length === 0) {
      flushParagraph();
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();

  if (paragraphs.length === 0) {
    return "";
  }

  return `${paragraphs.join("\n\n")}\n`;
}

function parseBlockScalar(
  lines: string[],
  startIndex: number,
  indent: number,
  indicator: ">" | "|"
): ParsedYamlBlock {
  const blockLines: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().length === 0) {
      blockLines.push("");
      index += 1;
      continue;
    }

    if (countIndent(line) < indent) {
      break;
    }

    blockLines.push(line.slice(indent));
    index += 1;
  }

  return {
    value:
      indicator === ">"
        ? foldBlockLines(blockLines)
        : `${blockLines.join("\n")}${blockLines.length > 0 ? "\n" : ""}`,
    nextIndex: index,
    issues: []
  };
}

function parseArray(lines: string[], startIndex: number, indent: number): ParsedYamlBlock {
  const issues: string[] = [];
  const values: BlueprintAgentFrontmatterValue[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    const lineIndent = countIndent(line);

    if (lineIndent < indent) {
      break;
    }

    if (lineIndent !== indent) {
      issues.push(`Unexpected indentation at line ${index + 1}.`);
      index += 1;
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed.startsWith("- ")) {
      break;
    }

    const remainder = trimmed.slice(2).trimStart();

    if (remainder.length === 0) {
      let nextIndex = index + 1;

      while (nextIndex < lines.length && lines[nextIndex].trim().length === 0) {
        nextIndex += 1;
      }

      if (nextIndex >= lines.length || countIndent(lines[nextIndex]) <= indent) {
        values.push(null);
        index += 1;
        continue;
      }

      const childIndent = countIndent(lines[nextIndex]);
      const parsed = lines[nextIndex].trim().startsWith("- ")
        ? parseArray(lines, nextIndex, childIndent)
        : parseObject(lines, nextIndex, childIndent);

      values.push(parsed.value);
      issues.push(...parsed.issues);
      index = parsed.nextIndex;
      continue;
    }

    values.push(parseScalar(remainder));
    index += 1;
  }

  return {
    value: values,
    nextIndex: index,
    issues
  };
}

function parseObject(lines: string[], startIndex: number, indent: number): ParsedYamlBlock {
  const issues: string[] = [];
  const value: Record<string, BlueprintAgentFrontmatterValue> = {};
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    const lineIndent = countIndent(line);

    if (lineIndent < indent) {
      break;
    }

    if (lineIndent !== indent) {
      issues.push(`Unexpected indentation at line ${index + 1}.`);
      index += 1;
      continue;
    }

    const trimmed = line.trim();
    const keyMatch = /^([A-Za-z0-9_-]+):(.*)$/.exec(trimmed);

    if (!keyMatch) {
      issues.push(`Invalid YAML mapping at line ${index + 1}.`);
      index += 1;
      continue;
    }

    const [, key, rawRemainder] = keyMatch;
    const remainder = rawRemainder.trimStart();

    if (remainder === ">" || remainder === "|") {
      const parsed = parseBlockScalar(lines, index + 1, indent + 2, remainder);
      value[key] = parsed.value;
      issues.push(...parsed.issues);
      index = parsed.nextIndex;
      continue;
    }

    if (remainder.length === 0) {
      let nextIndex = index + 1;

      while (nextIndex < lines.length && lines[nextIndex].trim().length === 0) {
        nextIndex += 1;
      }

      if (nextIndex >= lines.length || countIndent(lines[nextIndex]) <= indent) {
        value[key] = null;
        index += 1;
        continue;
      }

      const childIndent = countIndent(lines[nextIndex]);
      const parsed = lines[nextIndex].trim().startsWith("- ")
        ? parseArray(lines, nextIndex, childIndent)
        : parseObject(lines, nextIndex, childIndent);

      value[key] = parsed.value;
      issues.push(...parsed.issues);
      index = parsed.nextIndex;
      continue;
    }

    value[key] = parseScalar(remainder);
    index += 1;
  }

  return {
    value,
    nextIndex: index,
    issues
  };
}

function parseFrontmatter(frontmatter: string): {
  frontmatter: Record<string, BlueprintAgentFrontmatterValue>;
  issues: string[];
} {
  const parsed = parseObject(frontmatter.split(/\r?\n/), 0, 0);

  if (!parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    return {
      frontmatter: {},
      issues: ["Agent frontmatter must be a YAML object."]
    };
  }

  const validation = localAgentFrontmatterSchema.safeParse(parsed.value);

  if (!validation.success) {
    return {
      frontmatter: parsed.value as Record<string, BlueprintAgentFrontmatterValue>,
      issues: [
        ...parsed.issues,
        ...validation.error.issues.map((issue) => {
          const pathLabel = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
          return `${pathLabel}${issue.message}`;
        })
      ]
    };
  }

  return {
    frontmatter: validation.data as Record<string, BlueprintAgentFrontmatterValue>,
    issues: parsed.issues
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

  if (frontmatter.kind !== undefined && frontmatter.kind !== "local") {
    issues.push(`Invalid agent kind in ${relativePath}: ${String(frontmatter.kind)}`);
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
