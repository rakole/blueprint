import {
  blueprintDiscoverableSkillPath,
  blueprintLegacySkillPath
} from "./runtime-vocabulary.js";

type RelativePathReader = (relativePath: string) => Promise<string | null>;

interface BlueprintSkillFrontmatterObject {
  [key: string]: BlueprintSkillFrontmatterValue;
}

type BlueprintSkillFrontmatterValue = string | string[] | BlueprintSkillFrontmatterObject;

export type BlueprintSkillResolvedInputs = {
  skill: string;
  shared: string[];
  commandSpecific: string[];
  effective: string[];
};

function extractFrontmatterBlock(content: string): { frontmatter: string; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);

  if (!match) {
    return null;
  }

  return {
    frontmatter: match[1],
    body: match[2]
  };
}

function countLeadingSpaces(line: string): number {
  const match = line.match(/^ */);
  return match?.[0]?.length ?? 0;
}

function normalizeFrontmatterKey(rawKey: string): string {
  const trimmed = rawKey.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function collapseBlockLines(lines: string[]): string {
  return lines
    .map((line) => line.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function findNextMeaningfulLine(lines: string[], startIndex: number): number {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (lines[index].trim().length > 0) {
      return index;
    }
  }

  return -1;
}

function parseArray(
  lines: string[],
  startIndex: number,
  indent: number
): { value: string[]; nextIndex: number } {
  const value: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (trimmed.length === 0) {
      index += 1;
      continue;
    }

    const lineIndent = countLeadingSpaces(rawLine);

    if (lineIndent < indent || lineIndent !== indent || !trimmed.startsWith("- ")) {
      break;
    }

    value.push(normalizeFrontmatterKey(trimmed.slice(2).trim()));
    index += 1;
  }

  return {
    value,
    nextIndex: index
  };
}

function parseObject(
  lines: string[],
  startIndex: number,
  indent: number
): { value: BlueprintSkillFrontmatterObject; nextIndex: number } {
  const value: BlueprintSkillFrontmatterObject = {};
  let index = startIndex;

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (trimmed.length === 0) {
      index += 1;
      continue;
    }

    const lineIndent = countLeadingSpaces(rawLine);

    if (lineIndent < indent) {
      break;
    }

    if (lineIndent > indent) {
      index += 1;
      continue;
    }

    const match = trimmed.match(/^(.+?):\s*(.*)$/);

    if (!match) {
      index += 1;
      continue;
    }

    const key = normalizeFrontmatterKey(match[1]);
    const rawValue = match[2].trim();

    if (rawValue === ">" || rawValue === "|") {
      const blockLines: string[] = [];
      let blockIndent: number | null = null;
      index += 1;

      while (index < lines.length) {
        const blockLine = lines[index];
        const blockTrimmed = blockLine.trim();

        if (blockTrimmed.length === 0) {
          blockLines.push("");
          index += 1;
          continue;
        }

        const blockLineIndent = countLeadingSpaces(blockLine);

        if (blockLineIndent <= lineIndent) {
          break;
        }

        blockIndent ??= blockLineIndent;
        blockLines.push(blockLine.slice(blockIndent));
        index += 1;
      }

      value[key] = rawValue === ">" ? collapseBlockLines(blockLines) : blockLines.join("\n").trim();
      continue;
    }

    if (rawValue.length > 0) {
      value[key] = normalizeFrontmatterKey(rawValue);
      index += 1;
      continue;
    }

    const nextIndex = findNextMeaningfulLine(lines, index + 1);

    if (nextIndex === -1) {
      value[key] = "";
      index += 1;
      continue;
    }

    const nextLine = lines[nextIndex];
    const nextIndent = countLeadingSpaces(nextLine);
    const nextTrimmed = nextLine.trim();

    if (nextIndent <= lineIndent) {
      value[key] = "";
      index = nextIndex;
      continue;
    }

    if (nextTrimmed.startsWith("- ")) {
      const parsedArray = parseArray(lines, nextIndex, nextIndent);
      value[key] = parsedArray.value;
      index = parsedArray.nextIndex;
      continue;
    }

    const parsedObject = parseObject(lines, nextIndex, nextIndent);
    value[key] = parsedObject.value;
    index = parsedObject.nextIndex;
  }

  return {
    value,
    nextIndex: index
  };
}

function parseFrontmatter(frontmatter: string): BlueprintSkillFrontmatterObject {
  return parseObject(frontmatter.split("\n"), 0, 0).value;
}

function extractMarkdownSection(markdown: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(`(?:^|\\n)## ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
  );

  return match?.[1]?.trim() ?? "";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function parseLegacyRequiredInputs(content: string): string[] {
  return unique(
    extractMarkdownSection(content, "Required Inputs")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2).trim())
      .map((line) => line.replace(/^`(.+)`$/, "$1"))
      .filter((line) => line.length > 0)
  );
}

function asStringArray(value: BlueprintSkillFrontmatterValue | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return unique(value.filter((item): item is string => typeof item === "string"));
}

function isObject(
  value: BlueprintSkillFrontmatterValue | undefined
): value is Record<string, BlueprintSkillFrontmatterValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function resolveBlueprintSkillInputsFromContent(
  skillName: string,
  commandPath: string,
  content: string
): BlueprintSkillResolvedInputs {
  const extracted = extractFrontmatterBlock(content);

  if (!extracted) {
    const legacyInputs = parseLegacyRequiredInputs(content);

    return {
      skill: skillName,
      shared: legacyInputs,
      commandSpecific: [],
      effective: legacyInputs
    };
  }

  const frontmatter = parseFrontmatter(extracted.frontmatter);
  const rawBundles = frontmatter.input_bundles;

  if (isObject(rawBundles)) {
    const shared = asStringArray(rawBundles.shared);
    const rawCommands = isObject(rawBundles.commands) ? rawBundles.commands : {};
    const commandSpecific = asStringArray(rawCommands[commandPath]);

    return {
      skill: skillName,
      shared,
      commandSpecific,
      effective: unique([...shared, ...commandSpecific])
    };
  }

  const legacyInputs = parseLegacyRequiredInputs(content);

  return {
    skill: skillName,
    shared: legacyInputs,
    commandSpecific: [],
    effective: legacyInputs
  };
}

export async function loadBlueprintSkillInputs(
  skillName: string,
  commandPath: string,
  readRelativePath: RelativePathReader,
  preferredPath?: string | null
): Promise<BlueprintSkillResolvedInputs> {
  const candidatePaths = unique(
    [
      preferredPath ?? null,
      blueprintDiscoverableSkillPath(skillName),
      blueprintLegacySkillPath(skillName)
    ].filter((path): path is string => typeof path === "string" && path.length > 0)
  );

  for (const candidatePath of candidatePaths) {
    const content = await readRelativePath(candidatePath);

    if (content !== null) {
      return resolveBlueprintSkillInputsFromContent(skillName, commandPath, content);
    }
  }

  return {
    skill: skillName,
    shared: [],
    commandSpecific: [],
    effective: []
  };
}
