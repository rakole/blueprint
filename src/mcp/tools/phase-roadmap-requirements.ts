import { promises as fs } from "node:fs";

import { BLUEPRINT_DIR, resolveBlueprintPath } from "./artifacts.js";
import { pathExists, type ParsedRoadmap } from "./phase-locations.js";
import { normalizeRoadmapDetailList } from "./phase-roadmap-mutations.js";
import type { RoadmapInsertPhaseRequirementMappingStatus } from "./phase-tool-types.js";

export type RequirementTableRow = {
  id: string;
  requirement: string;
  status: string;
  notes: string;
};

export const REQUIREMENTS_TABLE_SECTION_PATTERN =
  /(## Requirements Table\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

export function parseRequirementTableRow(line: string): RequirementTableRow | null {
  if (!/^\|.*\|$/.test(line)) {
    return null;
  }

  const cells = line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());

  if (cells.length !== 4) {
    return null;
  }

  const [id, requirement, status, notes] = cells;

  if (
    /^id$/i.test(id) &&
    /^requirement$/i.test(requirement) &&
    /^status$/i.test(status) &&
    /^notes$/i.test(notes)
  ) {
    return null;
  }

  if (cells.every((cell) => /^-+$/.test(cell.replace(/:/g, "")))) {
    return null;
  }

  return {
    id,
    requirement,
    status,
    notes
  };
}

export function renderRequirementTableRow(row: RequirementTableRow): string {
  return `| ${row.id} | ${row.requirement} | ${row.status} | ${row.notes} |`;
}

export async function readRequirementTable(
  projectRoot: string,
  options: {
    missingFileMessage: string;
    malformedMessage: string;
  }
): Promise<{
  rawRequirements: string;
  rows: RequirementTableRow[];
}> {
  const requirementsPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/REQUIREMENTS.md`);

  if (!(await pathExists(requirementsPath))) {
    throw new Error(options.missingFileMessage);
  }

  const rawRequirements = await fs.readFile(requirementsPath, "utf8");
  const requirementsSectionMatch = rawRequirements.match(REQUIREMENTS_TABLE_SECTION_PATTERN);

  if (!requirementsSectionMatch) {
    throw new Error(options.malformedMessage);
  }

  const rows = requirementsSectionMatch[2]
    .split("\n")
    .map((line) => parseRequirementTableRow(line))
    .filter((row): row is RequirementTableRow => row !== null);

  return {
    rawRequirements,
    rows
  };
}

export function findUndeclaredRequirementIds(
  rows: RequirementTableRow[],
  requirementIds: string[]
): string[] {
  const declaredRequirementIds = new Set(rows.map((row) => row.id));

  return requirementIds.filter((requirementId) => !declaredRequirementIds.has(requirementId));
}

export async function requireDeclaredRequirementIds(
  projectRoot: string,
  requirementIds: string[],
  options: {
    missingFileMessage: string;
    malformedMessage: string;
    undeclaredMessage: (undeclaredRequirementIds: string[]) => string;
  }
): Promise<void> {
  const { rows } = await readRequirementTable(projectRoot, options);
  const undeclaredRequirementIds = findUndeclaredRequirementIds(rows, requirementIds);

  if (undeclaredRequirementIds.length > 0) {
    throw new Error(options.undeclaredMessage(undeclaredRequirementIds));
  }
}

export async function repairRequirementsTraceability(
  projectRoot: string,
  requirementIds: string[],
  phaseNumber: string,
  phaseName: string,
  sourceReportPath?: string
): Promise<{
  content: string;
  warnings: string[];
}> {
  const normalizedRequirementIds = [
    ...new Set(requirementIds.map((value) => value.trim()).filter((value) => value.length > 0))
  ];

  if (normalizedRequirementIds.length === 0) {
    return {
      content: "",
      warnings: []
    };
  }

  const { rawRequirements } = await readRequirementTable(projectRoot, {
    missingFileMessage: `Cannot repair requirement traceability because ${BLUEPRINT_DIR}/REQUIREMENTS.md is missing.`,
    malformedMessage: `Malformed ${BLUEPRINT_DIR}/REQUIREMENTS.md: missing a usable "## Requirements Table" section.`
  });

  const remainingRequirementIds = new Set(normalizedRequirementIds);
  const noteSource = sourceReportPath?.trim() || "the milestone audit report";
  let updated = false;
  const reassignmentNote = `Reassigned to Phase ${phaseNumber} (${phaseName}) from ${noteSource}.`;

  const content = rawRequirements.replace(
    REQUIREMENTS_TABLE_SECTION_PATTERN,
    (_full, header: string, body: string) => {
      const nextBody = body
        .split("\n")
        .map((line) => {
          const row = parseRequirementTableRow(line);

          if (!row || !remainingRequirementIds.has(row.id)) {
            return line;
          }

          remainingRequirementIds.delete(row.id);
          const notes = row.notes.trim();
          const nextNotes = notes.includes(reassignmentNote)
            ? notes
            : notes.length > 0
              ? `${notes} ${reassignmentNote}`
              : reassignmentNote;
          const nextStatus = "pending";

          if (row.status.trim() === nextStatus && nextNotes === row.notes) {
            return line;
          }

          updated = true;

          return renderRequirementTableRow({
            ...row,
            status: nextStatus,
            notes: nextNotes
          });
        })
        .join("\n");

      return `${header}${nextBody}\n`;
    }
  );

  if (remainingRequirementIds.size > 0) {
    throw new Error(
      `Requirement traceability repair could not find requirement IDs in ${BLUEPRINT_DIR}/REQUIREMENTS.md: ${[
        ...remainingRequirementIds
      ].join(", ")}`
    );
  }

  return {
    content,
    warnings: updated
      ? [
          `Reset requirements ${normalizedRequirementIds.join(", ")} to pending and reassigned them to Phase ${phaseNumber}.`
        ]
      : [`Requirements ${normalizedRequirementIds.join(", ")} already reflected the requested repair.`]
  };
}

export async function mapRequirementsToInsertedPhase(
  projectRoot: string,
  requirementIds: string[],
  phaseNumber: string,
  phaseName: string
): Promise<{
  content: string;
  mappingStatus: RoadmapInsertPhaseRequirementMappingStatus;
  warnings: string[];
}> {
  const normalizedRequirementIds = normalizeRoadmapDetailList(requirementIds);
  await requireDeclaredRequirementIds(projectRoot, normalizedRequirementIds, {
    missingFileMessage: `Cannot insert Phase ${phaseNumber} because ${BLUEPRINT_DIR}/REQUIREMENTS.md is missing.`,
    malformedMessage: `Cannot insert Phase ${phaseNumber} because ${BLUEPRINT_DIR}/REQUIREMENTS.md is missing a usable "## Requirements Table" section.`,
    undeclaredMessage: (undeclaredRequirementIds) =>
      `Cannot insert Phase ${phaseNumber} because requirement IDs are not declared in ${BLUEPRINT_DIR}/REQUIREMENTS.md Requirements Table: ${undeclaredRequirementIds.join(", ")}`
  });
  const { rawRequirements } = await readRequirementTable(projectRoot, {
    missingFileMessage: `Cannot insert Phase ${phaseNumber} because ${BLUEPRINT_DIR}/REQUIREMENTS.md is missing.`,
    malformedMessage: `Cannot insert Phase ${phaseNumber} because ${BLUEPRINT_DIR}/REQUIREMENTS.md is missing a usable "## Requirements Table" section.`
  });

  const remainingRequirementIds = new Set(normalizedRequirementIds);
  const mappingNote = `Mapped to inserted Phase ${phaseNumber} (${phaseName}).`;
  let mappingUpdated = false;

  const content = rawRequirements.replace(
    REQUIREMENTS_TABLE_SECTION_PATTERN,
    (_full, header: string, body: string) => {
      const nextBody = body
        .split("\n")
        .map((line) => {
          const row = parseRequirementTableRow(line);

          if (!row || !remainingRequirementIds.has(row.id)) {
            return line;
          }

          remainingRequirementIds.delete(row.id);
          const notes = row.notes.trim();
          const nextNotes = notes.includes(mappingNote)
            ? notes
            : notes.length > 0
              ? `${notes} ${mappingNote}`
              : mappingNote;

          if (nextNotes === row.notes) {
            return line;
          }

          mappingUpdated = true;

          return renderRequirementTableRow({
            ...row,
            notes: nextNotes
          });
        })
        .join("\n");

      return `${header}${nextBody}\n`;
    }
  );

  return {
    content,
    mappingStatus: mappingUpdated ? "updated" : "unchanged",
    warnings: []
  };
}

export function requireUnassignedRoadmapRequirements(
  roadmap: ParsedRoadmap,
  requirementIds: string[],
  phaseNumber: string
): void {
  const existingMappings = new Map<string, string[]>();

  for (const phase of roadmap.phases) {
    for (const requirementId of phase.requirements) {
      const phaseLabels = existingMappings.get(requirementId) ?? [];
      phaseLabels.push(`Phase ${phase.phaseNumber}`);
      existingMappings.set(requirementId, phaseLabels);
    }
  }

  const reusedRequirementIds = requirementIds.filter((requirementId) =>
    existingMappings.has(requirementId)
  );

  if (reusedRequirementIds.length === 0) {
    return;
  }

  const reusedRequirementSummary = reusedRequirementIds
    .map((requirementId) => {
      const mappedPhases = existingMappings.get(requirementId)?.join(", ");
      return `${requirementId} (${mappedPhases})`;
    })
    .join(", ");

  throw new Error(
    `Cannot insert Phase ${phaseNumber} because requirement IDs are already mapped in ${BLUEPRINT_DIR}/ROADMAP.md: ${reusedRequirementSummary}. Use requirement IDs not already assigned to another roadmap phase.`
  );
}
