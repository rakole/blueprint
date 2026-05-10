import {
  extractPhaseNumberToken,
  formatPhasePrefix,
  normalizePhaseNumber
} from "./phase-numbering.js";

export type ParsedRoadmapPhase = {
  phaseNumber: string;
  phasePrefix: string;
  phaseName: string;
  completed: boolean;
  summary: string | null;
  goal: string | null;
  successCriteria: string | null;
  requirements: string[];
};

function parseRequirements(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(
      (entry) =>
        entry.length > 0 &&
        !["none", "none yet", "n/a", "not yet mapped"].includes(entry.toLowerCase())
    );
}

function uniqueRequirements(values: string[]): string[] {
  return [...new Set(values)];
}

function extractDurableRequirementIds(value: string): string[] {
  return [...value.matchAll(/\b([A-Z][A-Z0-9-]*-\d+)\b/g)]
    .map((match) => match[1] ?? "")
    .filter((requirementId) => requirementId.length > 0);
}

function parseRoadmapRequirements(value: string | null): string[] {
  return uniqueRequirements(
    parseRequirements(value).flatMap((entry) => {
      const durableIds = extractDurableRequirementIds(entry);

      return durableIds.length > 0 ? durableIds : [entry];
    })
  );
}

function extractRoadmapDetailRequirements(body: string): string[] {
  return uniqueRequirements(
    body
      .replace(/\r\n/g, "\n")
      .split("\n")
      .flatMap((line) => {
        const normalized = line
          .trim()
          .replace(/^[-*+]\s+/, "")
          .replace(/\*\*/g, "")
          .trim();
        const match = normalized.match(
          /^(?:mapped\s+)?requirements?(?:\s+ids?)?\s*:\s*(.+)$/i
        );

        return match ? parseRoadmapRequirements(match[1] ?? null) : [];
      })
  );
}

function parseRoadmapPhaseTitle(value: string): {
  phaseName: string;
  requirements: string[];
} {
  const unbolded = value.trim().replace(/\*\*$/u, "").trim();
  const requirementsMatch = unbolded.match(/\s*\(\s*Requirements:\s*([^)]+)\)\s*$/i);

  if (!requirementsMatch) {
    return {
      phaseName: unbolded,
      requirements: []
    };
  }

  return {
    phaseName: unbolded.slice(0, requirementsMatch.index).trim(),
    requirements: parseRoadmapRequirements(requirementsMatch[1] ?? null)
  };
}

function parseRoadmapPhaseLine(line: string): {
  completed: boolean;
  phaseNumber: string;
  phaseName: string;
  summary: string | null;
  requirements: string[];
} | null {
  const match = line.match(
    /^- \[([ xX])\]\s+(?:\*\*)?Phase\s+(\d+(?:\.\d+)?):\s+(.+?)(?:\*\*)?(?:\s+-\s+(.+))?\s*$/
  );

  if (!match) {
    return null;
  }

  const title = parseRoadmapPhaseTitle(match[3] ?? "");

  return {
    completed: (match[1] ?? "").toLowerCase() === "x",
    phaseNumber: normalizePhaseNumber(match[2] ?? ""),
    phaseName: title.phaseName,
    summary: match[4]?.trim() ?? null,
    requirements: title.requirements
  };
}

function parseRoadmapPhaseChildLines(lines: string[]): {
  goal: string | null;
  successCriteria: string | null;
} {
  let goal: string | null = null;
  const successCriteria: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const objectiveMatch = lines[index]?.match(/^\s+-\s+Objective:\s*(.+)$/i);

    if (objectiveMatch) {
      goal = objectiveMatch[1]?.trim() ?? null;
      continue;
    }

    const successCriteriaMatch = lines[index]?.match(/^(\s*)-\s+Success Criteria:\s*(.*)$/i);

    if (!successCriteriaMatch) {
      continue;
    }

    const labelIndent = successCriteriaMatch[1]?.length ?? 0;
    const inlineCriterion = successCriteriaMatch[2]?.trim() ?? "";

    if (inlineCriterion.length > 0) {
      successCriteria.push(inlineCriterion);
    }

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nestedMatch = lines[nextIndex]?.match(/^(\s*)-\s+(.+)$/);

      if (!nestedMatch || (nestedMatch[1]?.length ?? 0) <= labelIndent) {
        break;
      }

      successCriteria.push(nestedMatch[2]?.trim() ?? "");
      index = nextIndex;
    }
  }

  return {
    goal,
    successCriteria:
      successCriteria.length > 0
        ? successCriteria.filter((value) => value.length > 0).join("; ")
        : null
  };
}

function parseSimpleMarkdownTableCells(line: string): string[] | null {
  const trimmed = line.trim();

  if (!/^\|.*\|$/.test(trimmed)) {
    return null;
  }

  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function isSimpleMarkdownTableSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function normalizeRoadmapTableHeader(value: string): string {
  return value
    .replace(/[`*_]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isRoadmapPhaseTableHeader(value: string): boolean {
  return ["phase", "phase #", "phase number", "#"].includes(
    normalizeRoadmapTableHeader(value)
  );
}

function isRoadmapRequirementsTableHeader(value: string): boolean {
  return /^(?:mapped\s+)?requirements?(?:\s+ids?)?$/.test(
    normalizeRoadmapTableHeader(value)
  );
}

function extractRoadmapPhaseTableRequirements(raw: string): Map<string, string[]> {
  const requirementsByPhase = new Map<string, string[]>();
  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const headers = parseSimpleMarkdownTableCells(lines[index] ?? "");

    if (!headers) {
      continue;
    }

    const separator = parseSimpleMarkdownTableCells(lines[index + 1] ?? "");

    if (!separator || !isSimpleMarkdownTableSeparator(separator)) {
      continue;
    }

    const phaseIndex = headers.findIndex(isRoadmapPhaseTableHeader);
    const requirementsIndex = headers.findIndex(isRoadmapRequirementsTableHeader);

    if (phaseIndex < 0 || requirementsIndex < 0) {
      continue;
    }

    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const cells = parseSimpleMarkdownTableCells(lines[rowIndex] ?? "");

      if (!cells) {
        break;
      }

      if (isSimpleMarkdownTableSeparator(cells)) {
        continue;
      }

      const phaseNumber = extractPhaseNumberToken(cells[phaseIndex] ?? "");
      const requirements = parseRoadmapRequirements(cells[requirementsIndex] ?? null);

      if (!phaseNumber || requirements.length === 0) {
        continue;
      }

      requirementsByPhase.set(phaseNumber, requirements);
    }
  }

  return requirementsByPhase;
}

export function parseRoadmapDocument(raw: string): {
  milestone: string | null;
  phases: ParsedRoadmapPhase[];
} {
  const milestone = raw.match(/- Active milestone:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const tableRequirements = extractRoadmapPhaseTableRequirements(raw);
  const details = new Map<
    string,
    {
      goal: string | null;
      successCriteria: string | null;
      requirements: string[];
    }
  >();

  for (const block of raw.split(/^### Phase /gm).slice(1)) {
    const newlineIndex = block.indexOf("\n");
    const header = newlineIndex === -1 ? block.trim() : block.slice(0, newlineIndex).trim();
    const body = newlineIndex === -1 ? "" : block.slice(newlineIndex + 1);
    const headerMatch = header.match(/^(\d+(?:\.\d+)?): (.+)$/);

    if (!headerMatch) {
      continue;
    }

    const phaseNumber = normalizePhaseNumber(headerMatch[1]);
    const goal = body.match(/^\*\*Goal\*\*:\s*(.+)$/m)?.[1]?.trim() ?? null;
    const successCriteria =
      body.match(/^\*\*Success Criteria\*\*:\s*(.+)$/m)?.[1]?.trim() ?? null;
    const requirements = extractRoadmapDetailRequirements(body);

    details.set(phaseNumber, { goal, successCriteria, requirements });
  }

  const phases: ParsedRoadmapPhase[] = [];
  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const inlinePhase = parseRoadmapPhaseLine(lines[index] ?? "");

    if (!inlinePhase) {
      continue;
    }

    const childLines: string[] = [];

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex] ?? "";

      if (parseRoadmapPhaseLine(nextLine) || /^#{1,6}\s+/.test(nextLine)) {
        break;
      }

      if (nextLine.trim().length === 0 || /^\s+-\s+/.test(nextLine)) {
        childLines.push(nextLine);
        index = nextIndex;
        continue;
      }

      break;
    }

    const phaseNumber = inlinePhase.phaseNumber;
    const phaseChildren = parseRoadmapPhaseChildLines(childLines);
    const detail = details.get(phaseNumber);
    const requirements =
      detail && detail.requirements.length > 0
        ? detail.requirements
        : inlinePhase.requirements.length > 0
          ? inlinePhase.requirements
          : tableRequirements.get(phaseNumber) ?? [];

    phases.push({
      phaseNumber,
      phasePrefix: formatPhasePrefix(phaseNumber),
      phaseName: inlinePhase.phaseName,
      completed: inlinePhase.completed,
      summary: inlinePhase.summary,
      goal: detail ? detail.goal : phaseChildren.goal,
      successCriteria: detail ? detail.successCriteria : phaseChildren.successCriteria,
      requirements
    });
  }

  return { milestone, phases };
}
