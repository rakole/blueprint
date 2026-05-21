import { formatPhasePrefix, normalizePhaseNumber } from "./phase-numbering.js";

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

export type ParsedRoadmapPhaseListLine = {
  completed: boolean;
  phaseNumber: string;
  phaseName: string;
  requirements: string[];
};

export type ParsedRoadmapPhaseDetailHeading = {
  phaseNumber: string;
  phaseName: string;
};

const ROADMAP_PHASE_LIST_LINE_PATTERN =
  /^- \[( |x)\] Phase (\d+(?:\.\d+)?): (.+?)(?: \(Requirements: ([^)]+)\))?\s*$/;
const ROADMAP_PHASE_DETAIL_HEADING_PATTERN = /^### Phase (\d+(?:\.\d+)?): (.+?)\s*$/;
const ROADMAP_PHASE_LIST_CANDIDATE_PATTERN =
  /^\s*-\s*\[[^\]]+\]\s*\**Phase\s+\d+(?:\.\d+)?\b/i;
const ROADMAP_PHASE_DETAIL_HEADING_CANDIDATE_PATTERN =
  /^\s*###\s*\**Phase\s+\d+(?:\.\d+)?\b/i;

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

function hasBoldRoadmapFormatting(value: string): boolean {
  return value.includes("**");
}

function isNonCanonicalRoadmapPhaseListCandidate(line: string): boolean {
  return ROADMAP_PHASE_LIST_CANDIDATE_PATTERN.test(line) && parseRoadmapPhaseListLine(line) === null;
}

function isNonCanonicalRoadmapPhaseDetailHeadingCandidate(line: string): boolean {
  return (
    ROADMAP_PHASE_DETAIL_HEADING_CANDIDATE_PATTERN.test(line) &&
    parseRoadmapPhaseDetailHeading(line) === null
  );
}

function roadmapPhaseListRepairError(line: string): Error {
  return new Error(
    `Non-canonical ROADMAP phase checklist line: "${line}". Repair by using "- [ ] Phase N: Title (Requirements: REQ-01)" or "- [x] Phase N: Title"; use ":" as the only separator and do not bold "Phase".`
  );
}

function roadmapPhaseDetailHeadingRepairError(line: string): Error {
  return new Error(
    `Non-canonical ROADMAP Phase Details heading: "${line}". Repair by using "### Phase N: Title"; use ":" as the only separator and do not bold "Phase".`
  );
}

export function parseRoadmapPhaseListLine(line: string): ParsedRoadmapPhaseListLine | null {
  const match = line.match(ROADMAP_PHASE_LIST_LINE_PATTERN);

  if (!match) {
    return null;
  }

  const phaseName = (match[3] ?? "").trim();

  if (phaseName.length === 0 || hasBoldRoadmapFormatting(line)) {
    return null;
  }

  return {
    completed: (match[1] ?? "") === "x",
    phaseNumber: normalizePhaseNumber(match[2] ?? ""),
    phaseName,
    requirements: parseRoadmapRequirements(match[4] ?? null)
  };
}

export function formatRoadmapPhaseListLine(line: {
  completed: boolean;
  phaseNumber: string;
  phaseName: string;
  requirementIds?: readonly string[];
  requirements?: readonly string[];
}): string {
  const requirements = [...(line.requirementIds ?? line.requirements ?? [])];
  const requirementClause =
    requirements.length > 0 ? ` (Requirements: ${requirements.join(", ")})` : "";

  return `- [${line.completed ? "x" : " "}] Phase ${normalizePhaseNumber(line.phaseNumber)}: ${line.phaseName}${requirementClause}`;
}

export function splitRoadmapPhaseListBlocks(body: string): string[] {
  const blocks: string[] = [];
  let currentBlock: string[] = [];

  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    if (parseRoadmapPhaseListLine(line)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join("\n").trimEnd());
      }

      currentBlock = [line];
      continue;
    }

    if (isNonCanonicalRoadmapPhaseListCandidate(line)) {
      throw roadmapPhaseListRepairError(line);
    }

    if (currentBlock.length > 0) {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join("\n").trimEnd());
  }

  return blocks;
}

export function parseRoadmapPhaseDetailHeading(
  heading: string
): ParsedRoadmapPhaseDetailHeading | null {
  const match = heading.match(ROADMAP_PHASE_DETAIL_HEADING_PATTERN);

  if (!match) {
    return null;
  }

  const phaseName = (match[2] ?? "").trim();

  if (phaseName.length === 0 || hasBoldRoadmapFormatting(heading)) {
    return null;
  }

  return {
    phaseNumber: normalizePhaseNumber(match[1] ?? ""),
    phaseName
  };
}

export function formatRoadmapPhaseDetailHeading(
  heading: ParsedRoadmapPhaseDetailHeading
): string {
  return `### Phase ${normalizePhaseNumber(heading.phaseNumber)}: ${heading.phaseName}`;
}

export function splitRoadmapPhaseDetailBlocks(body: string): string[] {
  const blocks: string[] = [];
  let currentBlock: string[] = [];

  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    if (parseRoadmapPhaseDetailHeading(line)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join("\n").trimEnd());
      }

      currentBlock = [line];
      continue;
    }

    if (isNonCanonicalRoadmapPhaseDetailHeadingCandidate(line)) {
      throw roadmapPhaseDetailHeadingRepairError(line);
    }

    if (currentBlock.length > 0) {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join("\n").trimEnd());
  }

  return blocks;
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

function parseRoadmapPhaseDetailBody(body: string): {
  goal: string | null;
  successCriteria: string | null;
} {
  return {
    goal: body.match(/^\*\*Goal\*\*:\s*(.+)$/m)?.[1]?.trim() ?? null,
    successCriteria: body.match(/^\*\*Success Criteria\*\*:\s*(.+)$/m)?.[1]?.trim() ?? null
  };
}

export function parseRoadmapDocument(raw: string): {
  milestone: string | null;
  phases: ParsedRoadmapPhase[];
} {
  const milestone = raw.match(/- Active milestone:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const details = new Map<
    string,
    {
      goal: string | null;
      successCriteria: string | null;
    }
  >();

  for (const block of splitRoadmapPhaseDetailBlocks(raw)) {
    const [headingLine = "", ...bodyLines] = block.split("\n");
    const heading = parseRoadmapPhaseDetailHeading(headingLine);

    if (!heading) {
      continue;
    }

    details.set(heading.phaseNumber, parseRoadmapPhaseDetailBody(bodyLines.join("\n")));
  }

  const phases: ParsedRoadmapPhase[] = [];

  for (const block of splitRoadmapPhaseListBlocks(raw)) {
    const [firstLine = "", ...childLines] = block.split("\n");
    const inlinePhase = parseRoadmapPhaseListLine(firstLine);

    if (!inlinePhase) {
      continue;
    }

    const phaseChildren = parseRoadmapPhaseChildLines(childLines);
    const detail = details.get(inlinePhase.phaseNumber);

    phases.push({
      phaseNumber: inlinePhase.phaseNumber,
      phasePrefix: formatPhasePrefix(inlinePhase.phaseNumber),
      phaseName: inlinePhase.phaseName,
      completed: inlinePhase.completed,
      summary: null,
      goal: detail?.goal ?? phaseChildren.goal,
      successCriteria: detail?.successCriteria ?? phaseChildren.successCriteria,
      requirements: inlinePhase.requirements
    });
  }

  return { milestone, phases };
}
