import { BLUEPRINT_DIR, BLUEPRINT_PHASES_PATH } from "./artifacts.js";
import type {
  AuditBackedGapCategory,
  AuditBackedGapGroup,
  RoadmapAuditBackedDetails
} from "./phase-tool-types.js";
import {
  computeNextWholePhaseNumber,
  extractPhaseNumberToken,
  formatPhasePrefix,
  isIntegerPhaseNumber,
  normalizePhaseDescription,
  normalizePhaseNumber,
  slugifyPhaseName,
  type NumericInput
} from "./phase-numbering.js";
import type { ParsedRoadmapPhase } from "./phase-roadmap-parser.js";

export function buildBlueprintPhaseDirectoryPath(
  phaseNumber: string | number,
  phaseName: string
): string {
  const phasePrefix = formatPhasePrefix(phaseNumber);
  const normalizedPhaseName = normalizePhaseDescription(phaseName);

  return `${BLUEPRINT_PHASES_PATH}/${phasePrefix}-${slugifyPhaseName(normalizedPhaseName)}`;
}

export function nextIntegerPhaseNumber(phases: ParsedRoadmapPhase[]): string {
  return computeNextWholePhaseNumber(phases);
}

export function previousIntegerPhaseNumber(value: NumericInput): string | null {
  const normalizedPhaseNumber = normalizePhaseNumber(value);

  if (!isIntegerPhaseNumber(normalizedPhaseNumber)) {
    return null;
  }

  const previousPhaseNumber = Number.parseInt(normalizedPhaseNumber, 10) - 1;

  return previousPhaseNumber > 0 ? String(previousPhaseNumber) : null;
}

export function nextDecimalPhaseNumber(
  phases: ParsedRoadmapPhase[],
  afterPhaseNumber: string
): string {
  const normalizedAfterPhase = normalizePhaseNumber(afterPhaseNumber);
  const decimalMatcher = new RegExp(`^${escapeForRegex(normalizedAfterPhase)}\\.(\\d+)$`);
  const suffixes = phases
    .map((phase) => phase.phaseNumber)
    .map((phaseNumber) => phaseNumber.match(decimalMatcher)?.[1] ?? null)
    .filter((suffix): suffix is string => suffix !== null)
    .map((suffix) => Number.parseInt(suffix, 10))
    .filter((suffix) => !Number.isNaN(suffix));
  const nextSuffix = suffixes.length === 0 ? 1 : Math.max(...suffixes) + 1;

  return `${normalizedAfterPhase}.${nextSuffix}`;
}

export function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function replaceWithPlaceholders(
  value: string,
  replacements: Array<{
    pattern: RegExp;
    replacement: string;
  }>
): string {
  const placeholders = replacements.map((_, index) => `__BLUEPRINT_PHASE_${index}__`);
  let updated = value;

  replacements.forEach((replacement, index) => {
    updated = updated.replace(replacement.pattern, placeholders[index]);
  });

  placeholders.forEach((placeholder, index) => {
    updated = updated.replaceAll(placeholder, replacements[index]?.replacement ?? placeholder);
  });

  return updated;
}

export function rewriteDependencyLines(
  value: string,
  renumberMap: ReadonlyMap<string, string>
): string {
  return value.replace(/^(\*\*Depends on\*\*:\s*)(.+)$/gm, (_full, prefix: string, body: string) => {
    const trimmedBody = body.trim();

    if (trimmedBody.length === 0 || ["none", "n/a"].includes(trimmedBody.toLowerCase())) {
      return `${prefix}${body}`;
    }

    const rewritten = body
      .split(",")
      .map((rawEntry) => {
        const entry = rawEntry.trim();
        const phaseNumber = extractPhaseNumberToken(entry);

        if (!phaseNumber) {
          return rawEntry;
        }

        const replacement = renumberMap.get(phaseNumber);

        if (!replacement) {
          return rawEntry;
        }

        const phasePrefix = entry.startsWith("Phase ")
          ? "Phase "
          : entry.startsWith("phase ")
            ? "phase "
            : "";

        return rawEntry.replace(
          new RegExp(`${escapeForRegex(phasePrefix)}${escapeForRegex(phaseNumber)}\\b`),
          `${phasePrefix}${replacement}`
        );
      })
      .join(",");

    return `${prefix}${rewritten}`;
  });
}

export function rewriteRoadmapPhaseReferences(
  value: string,
  renumberMap: ReadonlyMap<string, string>
): string {
  const replacements = [...renumberMap.entries()].flatMap(([from, to]) => [
    {
      pattern: new RegExp(`\\bPhase ${escapeForRegex(from)}\\b`, "g"),
      replacement: `Phase ${to}`
    },
    {
      pattern: new RegExp(`\\bphase ${escapeForRegex(from)}\\b`, "g"),
      replacement: `phase ${to}`
    }
  ]);

  return rewriteDependencyLines(replaceWithPlaceholders(value, replacements), renumberMap);
}

export function normalizeRoadmapGoal(value: string | undefined): string {
  return (value ?? "").trim();
}

export function normalizeRoadmapSuccessCriteriaList(values: string[] | undefined): string[] {
  return [
    ...new Set(
      (values ?? [])
        .flatMap((value) => value.split(/\s*;\s*/))
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  ];
}

export function normalizeRoadmapSuccessCriteriaString(value: string | undefined): string[] {
  return normalizeRoadmapSuccessCriteriaList(value ? [value] : undefined);
}

export function requireRoadmapPhaseMetadata(options: {
  command: "/blu-add-phase" | "/blu-insert-phase";
  goal: string;
  successCriteria: string[];
}): void {
  if (options.goal.length === 0) {
    throw new Error(
      `Phase goal required. Re-run ${options.command} with a concrete ROADMAP objective for the new phase.`
    );
  }

  if (options.successCriteria.length < 2 || options.successCriteria.length > 5) {
    throw new Error(
      `Phase successCriteria must include 2-5 concrete criteria. Re-run ${options.command} with successCriteria containing 2-5 items.`
    );
  }
}

export function requireConfirmedRoadmapMutation(options: {
  command: "/blu-add-phase" | "/blu-insert-phase" | "/blu-remove-phase";
  confirmed: boolean | undefined;
  gate: "phase-number-confirmation" | "phase-insert-confirmation" | "remove-phase-confirmation";
  mutation: string;
}): void {
  if (options.confirmed === true) {
    return;
  }

  throw new Error(
    `${options.command} blocked: confirmed: true is required after the ${options.gate} ask_user approval before ${options.mutation}. Safe default: stop without writing.`
  );
}

export function buildRoadmapPhaseListBlock(options: {
  phaseNumber: string;
  phaseName: string;
  requirementIds?: string[];
  goal: string;
  successCriteria: string[];
  inserted?: boolean;
}): string {
  const requirements = normalizeRoadmapDetailList(options.requirementIds);
  const requirementsSuffix =
    requirements.length > 0 ? ` (Requirements: ${requirements.join(", ")})` : "";
  const insertedLine = options.inserted ? "\n  - Inserted: yes" : "";
  const successCriteria = options.successCriteria
    .map((criterion) => `    - ${criterion}`)
    .join("\n");

  return `- [ ] Phase ${options.phaseNumber}: ${options.phaseName}${requirementsSuffix}${insertedLine}
  - Objective: ${options.goal}
  - Success Criteria:
${successCriteria}`;
}

export function appendPhaseLineToRoadmap(
  raw: string,
  phaseNumber: string,
  phaseName: string,
  options: {
    requirementIds?: string[];
    goal: string;
    successCriteria: string[];
  }
): string {
  const phaseBlock = buildRoadmapPhaseListBlock({
    phaseNumber,
    phaseName,
    requirementIds: options.requirementIds,
    goal: options.goal,
    successCriteria: options.successCriteria
  });
  const phasesSectionPattern = /(## Phases\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phasesSectionPattern.test(raw)) {
    throw new Error(
      `Malformed ${BLUEPRINT_DIR}/ROADMAP.md: missing field "## Phases" while appending Phase ${phaseNumber}. Repair by adding a top-level "## Phases" section containing checkbox phase lines such as "- [ ] Phase ${phaseNumber}: ${phaseName} (Requirements: REQ-01)", then re-run /blu-add-phase.`
    );
  }

  return raw.replace(phasesSectionPattern, (_full, header: string, body: string) => {
    const trimmedBody = body.trimEnd();
    const nextBody = trimmedBody.length === 0 ? phaseBlock : `${trimmedBody}\n${phaseBlock}`;
    return `${header}${nextBody}\n`;
  });
}

export function splitRoadmapPhaseListBlocks(body: string): string[] {
  const blocks: string[] = [];
  let currentBlock: string[] = [];

  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    if (/^\s*-\s*\[[ xX]\]\s+(?:\*\*)?Phase\s+\d+(?:\.\d+)?:\s+\S/.test(line)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join("\n").trimEnd());
      }

      currentBlock = [line];
      continue;
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

export function insertPhaseLineToRoadmap(
  raw: string,
  insertAfterPhaseNumber: string,
  phaseNumber: string,
  phaseName: string,
  options: {
    requirementIds?: string[];
    goal: string;
    successCriteria: string[];
  }
): string {
  const normalizedAnchor = normalizePhaseNumber(insertAfterPhaseNumber);
  const phaseBlock = buildRoadmapPhaseListBlock({
    phaseNumber,
    phaseName,
    requirementIds: options.requirementIds,
    goal: options.goal,
    successCriteria: options.successCriteria,
    inserted: true
  });
  const phasesSectionPattern = /(## Phases\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phasesSectionPattern.test(raw)) {
    throw new Error(
      `Malformed ${BLUEPRINT_DIR}/ROADMAP.md: missing field "## Phases" while inserting Phase ${phaseNumber} after Phase ${insertAfterPhaseNumber}. Repair by adding a top-level "## Phases" section with checkbox phase lines such as "- [ ] Phase ${insertAfterPhaseNumber}: <title>", then re-run /blu-insert-phase.`
    );
  }

  let inserted = false;

  const content = raw.replace(phasesSectionPattern, (_full, header: string, body: string) => {
    const blocks = splitRoadmapPhaseListBlocks(body);
    const anchorIndex = blocks.findIndex((block) => {
      const firstLine = block.split("\n")[0] ?? "";
      const match = firstLine.match(/^- \[[ xX]\] (?:\*\*)?Phase (\d+(?:\.\d+)?): [^\n]+$/);
      return match ? normalizePhaseNumber(match[1]) === normalizedAnchor : false;
    });

    if (anchorIndex === -1) {
      return `${header}${body}`;
    }

    blocks.splice(anchorIndex + 1, 0, phaseBlock);
    inserted = true;

    return `${header}${blocks.join("\n")}\n`;
  });

  if (!inserted) {
    throw new Error(
      `Phase ${insertAfterPhaseNumber} could not be located in ${BLUEPRINT_DIR}/ROADMAP.md field "## Phases" while inserting Phase ${phaseNumber}. Repair by adding or normalizing the anchor line to "- [ ] Phase ${insertAfterPhaseNumber}: <title>" or "- [ ] **Phase ${insertAfterPhaseNumber}: <title>**", then re-run /blu-insert-phase.`
    );
  }

  return content;
}

export type PhaseDetailBlockOptions = {
  phaseNumber: string;
  phaseName: string;
  dependsOnPhaseNumber?: string | null;
  insertedMarker?: string | null;
  goal?: string;
  requirements?: string[];
  successCriteria?: string;
  auditBackedDetails?: RoadmapAuditBackedDetails | null;
};

export function titleCaseAuditBackedCategory(category: AuditBackedGapCategory): string {
  return category
    .split("-")
    .map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
}

export function normalizeRoadmapDetailList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0))];
}

export function renderAuditBackedGapGroups(
  gapGroups: AuditBackedGapGroup[] | undefined
): string {
  const renderedGroups = (gapGroups ?? [])
    .filter((group) => group.rows.length > 0)
    .map((group) => {
      const rows = group.rows
        .map(
          (row) =>
            `| ${row.gapId.trim()} | ${row.surface.trim()} | ${row.evidence.trim()} | ${row.repair.trim()} |`
        )
        .join("\n");

      return `### ${titleCaseAuditBackedCategory(group.category)} Gaps

| Gap ID | Surface | Evidence | Repair |
|--------|---------|----------|--------|
${rows}`;
    });

  return renderedGroups.join("\n\n");
}

export function renderRequirementTraceabilityRepairSection(
  requirementIds: string[] | undefined,
  phaseNumber: string,
  sourceReportPath: string | undefined
): string {
  const ids = normalizeRoadmapDetailList(requirementIds);

  if (ids.length === 0) {
    return "";
  }

  const reportReference = sourceReportPath?.trim() || "milestone audit";
  const rows = ids
    .map(
      (requirementId) =>
        `| ${requirementId} | pending | Phase ${phaseNumber} | Reassigned from ${reportReference}. |`
    )
    .join("\n");

  return `## Requirement Traceability Repair

| Requirement ID | Status | Assignment | Notes |
|----------------|--------|------------|-------|
${rows}`;
}

export function normalizeRoadmapSuccessCriteriaField(value: string | undefined): string {
  const criteria = normalizeRoadmapSuccessCriteriaString(value);

  if (criteria.length < 2 || criteria.length > 5) {
    throw new Error(
      `Roadmap phase details require 2-5 success criteria before writing ${BLUEPRINT_DIR}/ROADMAP.md.`
    );
  }

  return criteria.join("; ");
}

export function buildPhaseDetailBlock(options: PhaseDetailBlockOptions): string {
  const goal = options.goal?.trim();

  if (!goal) {
    throw new Error(
      `Roadmap phase details require a concrete goal before writing ${BLUEPRINT_DIR}/ROADMAP.md.`
    );
  }

  const requirements = normalizeRoadmapDetailList(options.requirements);
  const successCriteria = normalizeRoadmapSuccessCriteriaField(options.successCriteria);
  const auditBackedDetails = options.auditBackedDetails ?? null;
  const auditSections = auditBackedDetails
    ? [
        "## Audit-Backed Gap Details",
        `**Source Audit**: ${auditBackedDetails.sourceReportPath?.trim() || "none"}`,
        `**Traceability Repair**: ${
          normalizeRoadmapDetailList(auditBackedDetails.repairRequirementIds).join(", ") || "none"
        }`,
        renderAuditBackedGapGroups(auditBackedDetails.gapGroups),
        renderRequirementTraceabilityRepairSection(
          auditBackedDetails.repairRequirementIds,
          options.phaseNumber,
          auditBackedDetails.sourceReportPath
        )
      ]
        .filter((section) => section.trim().length > 0)
        .join("\n\n")
    : "";

  return `### Phase ${options.phaseNumber}: ${options.phaseName}
**Goal**: ${goal}
**Requirements**: ${requirements.length > 0 ? requirements.join(", ") : "none yet"}
**Depends on**: ${options.dependsOnPhaseNumber ? `Phase ${options.dependsOnPhaseNumber}` : "none"}
${options.insertedMarker ? `**Inserted**: ${options.insertedMarker}\n` : ""}**Success Criteria**: ${successCriteria}
**Status**: planned
${auditSections ? `\n${auditSections}\n` : ""}`;
}

export function appendPhaseDetailsSection(raw: string, detailBlock: string): string {
  const section = `\n\n## Phase Details\n\n${detailBlock.trimEnd()}\n`;
  const notesHeadingPattern = /(\n## Notes\s*\n)/;

  if (notesHeadingPattern.test(raw)) {
    return raw.replace(notesHeadingPattern, `${section}$1`);
  }

  return `${raw.trimEnd()}${section}`;
}

export function appendPhaseDetailsToRoadmap(
  raw: string,
  phaseNumber: string,
  phaseName: string,
  detailOptions: Omit<PhaseDetailBlockOptions, "phaseNumber" | "phaseName"> = {}
): string {
  const detailHeadingPattern = new RegExp(`^### Phase ${escapeForRegex(phaseNumber)}: `, "m");

  if (detailHeadingPattern.test(raw)) {
    return raw;
  }

  const detailBlock = buildPhaseDetailBlock({
    phaseNumber,
    phaseName,
    ...detailOptions
  });
  const phaseDetailsSectionPattern = /(## Phase Details\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (phaseDetailsSectionPattern.test(raw)) {
    return raw.replace(
      phaseDetailsSectionPattern,
      (_full, header: string, body: string) => {
        const trimmedBody = body.trimEnd();
        const nextBody =
          trimmedBody.length === 0 ? detailBlock.trimEnd() : `${trimmedBody}\n\n${detailBlock.trimEnd()}`;
        return `${header}${nextBody}\n`;
      }
    );
  }

  return appendPhaseDetailsSection(raw, detailBlock);
}

export function insertPhaseDetailsToRoadmap(
  raw: string,
  phaseGroupNumbers: string[],
  phaseNumber: string,
  phaseName: string,
  dependsOnPhaseNumber: string,
  detailOptions: Omit<
    PhaseDetailBlockOptions,
    "phaseNumber" | "phaseName" | "dependsOnPhaseNumber" | "insertedMarker"
  > = {}
): string {
  const detailHeadingPattern = new RegExp(`^### Phase ${escapeForRegex(phaseNumber)}: `, "m");

  if (detailHeadingPattern.test(raw)) {
    return raw;
  }

  const detailBlock = buildPhaseDetailBlock({
    phaseNumber,
    phaseName,
    dependsOnPhaseNumber,
    insertedMarker: "yes",
    ...detailOptions
  }).trimEnd();
  const phaseDetailsSectionPattern = /(## Phase Details\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phaseDetailsSectionPattern.test(raw)) {
    return appendPhaseDetailsSection(raw, detailBlock);
  }

  const phaseGroupSet = new Set(phaseGroupNumbers.map((value) => normalizePhaseNumber(value)));
  let inserted = false;
  const content = raw.replace(phaseDetailsSectionPattern, (_full, header: string, body: string) => {
    const blocks = splitRoadmapPhaseDetailBlocks(body);

    let insertIndex = -1;

    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      const blockMatch = blocks[index]?.match(/^### Phase (\d+(?:\.\d+)?): /m);
      const blockPhaseNumber = blockMatch ? normalizePhaseNumber(blockMatch[1]) : null;

      if (blockPhaseNumber && phaseGroupSet.has(blockPhaseNumber)) {
        insertIndex = index + 1;
        break;
      }
    }

    if (insertIndex === -1) {
      insertIndex = blocks.length;
    }

    blocks.splice(insertIndex, 0, detailBlock);
    inserted = true;

    return `${header}${blocks.join("\n\n")}\n`;
  });

  if (!inserted) {
    throw new Error(
      `Phase ${phaseNumber} could not be inserted into ${BLUEPRINT_DIR}/ROADMAP.md field "## Phase Details". Repair by ensuring Phase ${dependsOnPhaseNumber} and any decimal siblings have valid "### Phase N: <title>" detail headings, then re-run /blu-insert-phase.`
    );
  }

  return content;
}

export function splitRoadmapPhaseDetailBlocks(body: string): string[] {
  return body
    .split(/^### Phase /gm)
    .slice(1)
    .map((block) => `### Phase ${block}`.trimEnd());
}

export function removePhaseLineFromRoadmap(
  raw: string,
  phaseNumber: string
): {
  content: string;
  removed: boolean;
} {
  const phasesSectionPattern = /(## Phases\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phasesSectionPattern.test(raw)) {
    throw new Error(
      `Malformed ${BLUEPRINT_DIR}/ROADMAP.md: missing a usable "## Phases" section.`
    );
  }

  let removed = false;
  const content = raw.replace(phasesSectionPattern, (_full, header: string, body: string) => {
    const blocks = splitRoadmapPhaseListBlocks(body);

    if (blocks.length === 0) {
      return `${header}${body}`;
    }

    const nextBlocks = blocks.filter((block) => {
      const firstLine = block.split("\n")[0] ?? "";
      const match = firstLine.match(/^\s*-\s*\[[ xX]\]\s+(?:\*\*)?Phase\s+(\d+(?:\.\d+)?):\s+[^\n]+$/);

      if (match && normalizePhaseNumber(match[1]) === phaseNumber) {
        removed = true;
        return false;
      }

      return true;
    });

    return `${header}${nextBlocks.join("\n").trimEnd()}\n`;
  });

  return {
    content,
    removed
  };
}

export function removePhaseDetailsFromRoadmap(
  raw: string,
  phaseNumber: string
): {
  content: string;
  removed: boolean;
} {
  const phaseDetailsSectionPattern = /(## Phase Details\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phaseDetailsSectionPattern.test(raw)) {
    return {
      content: raw,
      removed: false
    };
  }

  let removed = false;
  const content = raw.replace(phaseDetailsSectionPattern, (_full, header: string, body: string) => {
    const blocks = splitRoadmapPhaseDetailBlocks(body);
    const nextBlocks = blocks.filter((block) => {
      const match = block.match(/^### Phase (\d+(?:\.\d+)?): /m);

      if (!match) {
        return true;
      }

      if (normalizePhaseNumber(match[1]) === phaseNumber) {
        removed = true;
        return false;
      }

      return true;
    });
    const nextBody = nextBlocks.join("\n\n");

    return nextBody.length > 0 ? `${header}${nextBody}\n` : `${header}`;
  });

  return {
    content,
    removed
  };
}

export function replacePhaseLineCompletionMarker(
  raw: string,
  phaseNumber: string,
  completed: boolean
): {
  content: string;
  found: boolean;
  changed: boolean;
} {
  const marker = completed ? "x" : " ";
  const pattern = new RegExp(
    `^(- \\[)([ xX])(\\]\\s+(?:\\*\\*)?Phase\\s+${escapeForRegex(phaseNumber)}(?:\\*\\*)?\\s*:\\s+[^\\n]+)$`,
    "m"
  );
  const match = raw.match(pattern);

  if (!match) {
    return {
      content: raw,
      found: false,
      changed: false
    };
  }

  const changed = (match[2]?.toLowerCase() === "x") !== completed;

  return {
    content: raw.replace(pattern, `$1${marker}$3`),
    found: true,
    changed
  };
}

export function replacePhaseDetailStatus(
  raw: string,
  phaseNumber: string,
  nextStatus: string
): {
  content: string;
  found: boolean;
  changed: boolean;
} {
  const phaseDetailsSectionPattern = /(## Phase Details\s*\n)([\s\S]*?)(?=\n## |\s*$)/;

  if (!phaseDetailsSectionPattern.test(raw)) {
    return {
      content: raw,
      found: false,
      changed: false
    };
  }

  let found = false;
  let changed = false;
  const content = raw.replace(phaseDetailsSectionPattern, (_full, header: string, body: string) => {
    const blocks = splitRoadmapPhaseDetailBlocks(body);
    const nextBlocks = blocks.map((block) => {
      const match = block.match(/^### Phase (\d+(?:\.\d+)?)\s*(?::|-)\s+/m);

      if (!match || normalizePhaseNumber(match[1]) !== phaseNumber) {
        return block;
      }

      found = true;

      if (/^\*\*Status\*\*:\s*(.+)$/m.test(block)) {
        const existingStatus = block.match(/^\*\*Status\*\*:\s*(.+)$/m)?.[1]?.trim() ?? "";

        if (existingStatus.toLowerCase() === nextStatus.toLowerCase()) {
          return block;
        }

        changed = true;
        return block.replace(/^\*\*Status\*\*:\s*(.+)$/m, `**Status**: ${nextStatus}`);
      }

      changed = true;
      return `${block}\n**Status**: ${nextStatus}`;
    });

    return `${header}${nextBlocks.join("\n\n")}\n`;
  });

  return {
    content,
    found,
    changed
  };
}
