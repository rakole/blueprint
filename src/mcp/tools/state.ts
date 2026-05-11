import { promises as fs } from "node:fs";

import * as z from "zod/v4";

import { readArtifactContract } from "../artifact-contracts/index.js";
import {
  isBootstrapStarterContext,
  BLUEPRINT_DIR,
  buildBlueprintReportPath,
  blueprintPathExists,
  BLUEPRINT_STATE_PATH,
  ensureRepoRoot,
  inspectBlueprintArtifacts,
  inspectBootstrapArtifacts,
  extractMarkdownTableRows,
  isExplicitUiSkipRationale,
  isVerificationArtifactReadyForUat,
  readUatArtifactState,
  resolveBlueprintPath,
  toRepoRelativePath,
  validatePlanArtifactContent,
  validateResearchArtifactContent,
  validateUatArtifactContent,
  validateVerificationArtifactContent,
  writeTextFile
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import {
  buildPhaseQualityGateNextAction,
  evaluatePhaseQualityGates,
  type PhaseQualityGateEvaluation,
  type PhaseQualityGateMissingGate
} from "./quality-gates.js";
import {
  blueprintDirectCommand,
  blueprintRunDirectCommand
} from "../command-paths.js";
import {
  formatBlueprintPhasePrefix,
  normalizeBlueprintPhaseRef
} from "../../shared/security.js";

export type BlueprintState = {
  projectStatus: string;
  currentMilestone: string;
  currentPhase: string;
  activeCommand: string;
  nextAction: string;
  blockers: string[];
  roadmapEvolutionNotes: string[];
  lastUpdated: string;
};

type StateUpdateArgs = {
  cwd?: string;
  base?: "stored" | "synced";
  patch?: Partial<BlueprintState>;
};

type StateUpdateResult = {
  updatedFields: string[];
  statePath: string;
  warnings: string[];
};

type StateLoadArgs = {
  cwd?: string;
};

type StateLoadResult = {
  state: BlueprintState;
  blockers: string[];
  derivedStatus: {
    projectStatus: string;
    currentPhase: string | null;
    nextAction: string;
    hasBlockers: boolean;
    milestoneAudit: MilestoneAuditReportStatus;
  };
};

type PauseHandoffRecord = {
  reportType: "pause-work";
  schemaVersion: 1;
  status: "paused";
  timestamp: string;
  projectStatus: string;
  currentMilestone: string | null;
  currentPhase: string | null;
  activeCommand: string;
  currentState: string;
  completedWork: string[];
  remainingWork: string[];
  decisions: string[];
  blockers: string[];
  humanActionsPending: string[];
  modifiedFiles: string[];
  contextNotes: string;
  nextAction: string;
  artifactSnapshot: {
    core: string[];
    phaseArtifacts: string[];
    reports: string[];
    missing: string[];
  };
};

const PAUSE_WORK_CONTRACT = readArtifactContract("report.pause-work");
const [
  PAUSE_CURRENT_STATE_HEADING,
  PAUSE_COMPLETED_WORK_HEADING,
  PAUSE_REMAINING_WORK_HEADING,
  PAUSE_DECISIONS_HEADING,
  PAUSE_BLOCKERS_HEADING,
  PAUSE_HUMAN_ACTIONS_HEADING,
  PAUSE_MODIFIED_FILES_HEADING,
  PAUSE_BLUEPRINT_SNAPSHOT_HEADING,
  PAUSE_NEXT_ACTION_HEADING,
  PAUSE_CONTEXT_NOTES_HEADING
] = PAUSE_WORK_CONTRACT.requiredHeadings;

type PauseHandoffGetArgs = {
  cwd?: string;
};

type PauseHandoffWriteArgs = {
  cwd?: string;
  currentState: string;
  completedWork?: string[];
  remainingWork?: string[];
  decisions?: string[];
  blockers?: string[];
  humanActionsPending?: string[];
  modifiedFiles?: string[];
  contextNotes?: string;
  nextAction?: string;
  overwrite?: boolean;
};

type PauseHandoffGetResult = {
  found: boolean;
  path: string | null;
  handoff: PauseHandoffRecord | null;
  reason: string | null;
  warnings: string[];
};

type PauseHandoffWriteResult = {
  path: string;
  written: boolean;
  created: boolean;
  overwritten: boolean;
  status: "created" | "updated" | "reused";
  handoff: PauseHandoffRecord;
  warnings: string[];
};

type StateSyncArgs = {
  cwd?: string;
};

type StateSyncResult = {
  syncedFields: string[];
  warnings: string[];
  statePath: string;
};

type CommandCatalogEntry = {
  implemented: boolean;
};

type CommandCatalogResult = {
  commands: Record<string, CommandCatalogEntry>;
};

type PhaseSummaryIndexSnapshot = {
  phaseFound: boolean;
  summaries: {
    planId: string;
    path: string;
    status: "COMPLETED" | "PARTIAL" | "BLOCKED" | null;
  }[];
  completedPlans: string[];
  pendingPlans: string[];
  warnings: string[];
};

type CurrentPhaseArtifactStatus = {
  currentPhase: string | null;
  phaseDir: string | null;
  phasePrefix: string | null;
  contextPath: string | null;
  contextNeedsAuthoring: boolean;
  researchPath: string | null;
  uiSpecPath: string | null;
  uiReviewPath: string | null;
  reviewPath: string | null;
  securityPath: string | null;
  reviewNextSafeAction: string | null;
  verificationPath: string | null;
  verificationNextSafeAction: string | null;
  verificationHasDeferredTestGaps: boolean;
  uatPath: string | null;
  planIds: string[];
  summaryIds: string[];
  hasContext: boolean;
  hasResearch: boolean;
  hasUiSpec: boolean;
  hasUiReview: boolean;
  hasReview: boolean;
  hasSecurity: boolean;
  hasVerification: boolean;
  verificationReadyForUat: boolean;
  hasUat: boolean;
  hasPlans: boolean;
  hasSummaries: boolean;
  hasPendingExecution: boolean;
  codeReviewEnabled: boolean;
  requiresCodeReview: boolean;
  hasReviewableFiles: boolean;
  reviewableFiles: string[];
  qualityGateMissingGate: PhaseQualityGateMissingGate;
  qualityGatesSatisfied: boolean;
  qualityGateNextAction: string | null;
  researchValid: boolean | null;
  blockers: string[];
  warnings: string[];
};

type RoadmapPhaseSignal = {
  phaseNumber: string;
  completed: boolean;
};

type RoadmapPhaseDetailSignal = {
  phaseNumber: string;
  completed: boolean | null;
};

function roadmapDetailStatusIsComplete(status: string | null): boolean | null {
  if (status === null) {
    return null;
  }

  return ["completed", "done"].includes(status.trim().toLowerCase().replace(/-/g, "_"));
}

function readRoadmapPhaseDetailSignals(raw: string): RoadmapPhaseDetailSignal[] {
  const phaseDetails = extractMarkdownSection(raw, "Phase Details");
  const phases: RoadmapPhaseDetailSignal[] = [];

  for (const rawBlock of phaseDetails.split(/^### Phase\s+/gm).slice(1)) {
    const newlineIndex = rawBlock.indexOf("\n");
    const heading = newlineIndex === -1 ? rawBlock.trim() : rawBlock.slice(0, newlineIndex).trim();
    const body = newlineIndex === -1 ? "" : rawBlock.slice(newlineIndex + 1);
    const match = heading.match(/^(\d+(?:\.\d+)?)(?=$|\s|:|-|–|—)/);

    if (!match) {
      continue;
    }

    const phaseNumber = normalizeBlueprintPhaseRef(match[1] ?? "") ?? (match[1] ?? "");
    const status = body.match(/^\*\*Status\*\*:\s*(.+)$/im)?.[1]?.trim() ?? null;

    phases.push({
      phaseNumber,
      completed: roadmapDetailStatusIsComplete(status)
    });
  }

  return phases;
}

function mergeRoadmapPhaseSignals(
  checkboxPhases: RoadmapPhaseSignal[],
  detailPhases: RoadmapPhaseDetailSignal[]
): RoadmapPhaseSignal[] {
  const phaseByNumber = new Map<string, RoadmapPhaseSignal>();

  for (const phase of checkboxPhases) {
    phaseByNumber.set(phase.phaseNumber, phase);
  }

  for (const phase of detailPhases) {
    const existing = phaseByNumber.get(phase.phaseNumber);

    phaseByNumber.set(phase.phaseNumber, {
      phaseNumber: phase.phaseNumber,
      completed: existing
        ? phase.completed === null
          ? existing.completed
          : existing.completed && phase.completed
        : (phase.completed ?? false)
    });
  }

  return [...phaseByNumber.values()];
}

type MilestoneEvidenceStatus = {
  missingVerificationPhases: string[];
  missingUatPhases: string[];
  verificationNotReadyPhases: string[];
  verificationTestGapPhases: string[];
  verificationRepairActions: Record<string, string>;
  pendingSummaryCoveragePhases: string[];
  missingQualityGatePhases: string[];
  qualityGateDebtPhases: string[];
  qualityGateRepairActions: Record<string, string>;
  qualityGateMissingGates: Record<string, Exclude<PhaseQualityGateMissingGate, null>>;
  qualityGateReviewableFiles: Record<string, string[]>;
  blockingPhase: string | null;
  qualityGateBlockingPhase: string | null;
  allCompletedPhasesReady: boolean;
  warnings: string[];
};

type MilestoneAuditReportStatus = {
  found: boolean;
  verdict: "READY_TO_CLOSE" | "FOLLOW_UP" | "BLOCKED" | null;
  gapSections: {
    requirement: MilestoneAuditGapRow[];
    integration: MilestoneAuditGapRow[];
    flow: MilestoneAuditGapRow[];
    optional: MilestoneAuditGapRow[];
  };
  hasActionableGaps: boolean;
  hasArchivalBlockers: boolean;
  nextSafeAction: string | null;
  readyForCompletion: boolean;
};

type MilestoneAuditGapRow = {
  gapId: string;
  surface: string;
  evidence: string;
  repair: string;
};

function emptyMilestoneAuditReportStatus(): MilestoneAuditReportStatus {
  return {
    found: false,
    verdict: null,
    gapSections: {
      requirement: [],
      integration: [],
      flow: [],
      optional: []
    },
    hasActionableGaps: false,
    hasArchivalBlockers: false,
    nextSafeAction: null,
    readyForCompletion: false
  };
}

type BootstrapRoutingSignals = {
  brownfieldDetected: boolean;
  codebaseMapped: boolean;
};

type WorkflowRoutingSignals = {
  researchEnabled: boolean;
  uiPhaseEnabled: boolean;
};

const DEFAULT_STATE: BlueprintState = {
  projectStatus: "uninitialized",
  currentMilestone: "v1",
  currentPhase: "1",
  activeCommand: blueprintDirectCommand("new-project"),
  nextAction: blueprintRunDirectCommand("new-project"),
  blockers: [],
  roadmapEvolutionNotes: [],
  lastUpdated: new Date(0).toISOString()
};

const PAUSE_HANDOFF_REPORT_PATH = ".blueprint/reports/pause-work-latest.md";
const PAUSE_WORK_COMMAND = blueprintDirectCommand("pause-work");
const RESUME_WORK_COMMAND = blueprintDirectCommand("resume-work");
const PAUSE_HANDOFF_BLOCKER_PREFIX = "Paused handoff is active at ";
const PATCH_PHASE_OVERRIDE_COMMANDS = [
  blueprintDirectCommand("discuss-phase"),
  blueprintDirectCommand("research-phase"),
  blueprintDirectCommand("ui-phase"),
  blueprintDirectCommand("plan-phase"),
  blueprintDirectCommand("execute-phase"),
  blueprintDirectCommand("validate-phase"),
  blueprintDirectCommand("verify-work"),
  blueprintDirectCommand("add-tests")
] as const;
const PATCH_PHASE_SCOPED_ROUTING_OVERRIDE_COMMANDS: ReadonlySet<string> = new Set(
  PATCH_PHASE_OVERRIDE_COMMANDS
);
const STORED_PHASE_SCOPED_ROUTING_OVERRIDE_COMMANDS: ReadonlySet<string> = new Set([
  blueprintDirectCommand("research-phase"),
  blueprintDirectCommand("ui-phase"),
  blueprintDirectCommand("plan-phase"),
  blueprintDirectCommand("execute-phase"),
  blueprintDirectCommand("validate-phase"),
  blueprintDirectCommand("verify-work"),
  blueprintDirectCommand("add-tests")
]);

const stateUpdateInputSchema = {
  cwd: z.string().optional(),
  base: z.enum(["stored", "synced"]).optional(),
  patch: z
    .object({
      projectStatus: z.string().optional(),
      currentMilestone: z.string().optional(),
      currentPhase: z.string().optional(),
      activeCommand: z.string().optional(),
      nextAction: z.string().optional(),
      blockers: z.array(z.string()).optional(),
      roadmapEvolutionNotes: z.array(z.string()).optional(),
      lastUpdated: z.string().optional()
    })
    .optional()
};
const stateLoadInputSchema = {
  cwd: z.string().optional()
};
const pauseHandoffGetInputSchema = {
  cwd: z.string().optional()
};
const pauseHandoffWriteInputSchema = {
  cwd: z.string().optional(),
  currentState: z.string(),
  completedWork: z.array(z.string()).optional(),
  remainingWork: z.array(z.string()).optional(),
  decisions: z.array(z.string()).optional(),
  blockers: z.array(z.string()).optional(),
  humanActionsPending: z.array(z.string()).optional(),
  modifiedFiles: z.array(z.string()).optional(),
  contextNotes: z.string().optional(),
  nextAction: z.string().optional(),
  overwrite: z.boolean().optional()
};
const stateSyncInputSchema = {
  cwd: z.string().optional()
};

let implementedCommandNamesPromise: Promise<Set<string>> | null = null;

function normalizeTextContent(content: string): string {
  return `${content.replace(/\r\n/g, "\n").trimEnd()}\n`;
}

function normalizeLines(values: string[] | undefined): string[] {
  return [...new Set(
    (values ?? [])
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  )];
}

function normalizeParagraph(value: string | undefined, fallback = "None recorded."): string {
  const normalized = value?.trim().replace(/\r\n/g, "\n");
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);

  if (!match) {
    return {};
  }

  return Object.fromEntries(
    match[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.includes(":"))
      .map((line) => {
        const separator = line.indexOf(":");
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      })
  );
}

function extractMarkdownSection(markdown: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(`(?:^|\\n)## ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
  );

  return match?.[1]?.trim() ?? "";
}

function parseBulletSection(markdown: string, heading: string): string[] {
  const section = extractMarkdownSection(markdown, heading);

  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0 && line.toLowerCase() !== "none");
}

function renderBulletSection(title: string, values: string[]): string {
  const lines = values.length === 0 ? "- none" : values.map((value) => `- ${value}`).join("\n");
  return `## ${title}\n\n${lines}\n`;
}

function renderPauseHandoff(record: PauseHandoffRecord): string {
  const phaseValue = record.currentPhase ?? "none";
  const milestoneValue = record.currentMilestone ?? "none";
  const reports = record.artifactSnapshot.reports.join(", ") || "none";
  const coreArtifacts = record.artifactSnapshot.core.join(", ") || "none";
  const phaseArtifacts = record.artifactSnapshot.phaseArtifacts.join(", ") || "none";
  const missingArtifacts = record.artifactSnapshot.missing.join(", ") || "none";

  return normalizeTextContent(`---
report_type: ${record.reportType}
schema_version: ${record.schemaVersion}
status: ${record.status}
timestamp: ${record.timestamp}
project_status: ${record.projectStatus}
current_milestone: ${milestoneValue}
current_phase: ${phaseValue}
active_command: ${record.activeCommand}
---

# Pause Work Handoff

## ${PAUSE_CURRENT_STATE_HEADING}

${record.currentState}

${renderBulletSection(PAUSE_COMPLETED_WORK_HEADING, record.completedWork)}
${renderBulletSection(PAUSE_REMAINING_WORK_HEADING, record.remainingWork)}
${renderBulletSection(PAUSE_DECISIONS_HEADING, record.decisions)}
${renderBulletSection(PAUSE_BLOCKERS_HEADING, record.blockers)}
${renderBulletSection(PAUSE_HUMAN_ACTIONS_HEADING, record.humanActionsPending)}
${renderBulletSection(PAUSE_MODIFIED_FILES_HEADING, record.modifiedFiles)}
## ${PAUSE_BLUEPRINT_SNAPSHOT_HEADING}

- Core artifacts: ${coreArtifacts}
- Phase artifacts: ${phaseArtifacts}
- Existing reports: ${reports}
- Missing artifacts: ${missingArtifacts}

## ${PAUSE_NEXT_ACTION_HEADING}

${record.nextAction}

## ${PAUSE_CONTEXT_NOTES_HEADING}

${record.contextNotes}
`);
}

function parseSnapshotLine(section: string, label: string): string[] {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = section.match(new RegExp(`^- ${escapedLabel}:\\s*(.+)$`, "m"));
  const value = match?.[1]?.trim() ?? "none";

  return value === "none"
    ? []
    : value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

function parsePauseHandoff(raw: string): PauseHandoffRecord {
  const frontmatter = parseFrontmatter(raw);
  const snapshot = extractMarkdownSection(raw, PAUSE_BLUEPRINT_SNAPSHOT_HEADING);

  return {
    reportType: "pause-work",
    schemaVersion: 1,
    status: "paused",
    timestamp: frontmatter.timestamp ?? new Date(0).toISOString(),
    projectStatus: frontmatter.project_status ?? DEFAULT_STATE.projectStatus,
    currentMilestone:
      frontmatter.current_milestone && frontmatter.current_milestone !== "none"
        ? frontmatter.current_milestone
        : null,
    currentPhase:
      frontmatter.current_phase && frontmatter.current_phase !== "none"
        ? frontmatter.current_phase
        : null,
    activeCommand: frontmatter.active_command ?? PAUSE_WORK_COMMAND,
    currentState: normalizeParagraph(extractMarkdownSection(raw, PAUSE_CURRENT_STATE_HEADING)),
    completedWork: parseBulletSection(raw, PAUSE_COMPLETED_WORK_HEADING),
    remainingWork: parseBulletSection(raw, PAUSE_REMAINING_WORK_HEADING),
    decisions: parseBulletSection(raw, PAUSE_DECISIONS_HEADING),
    blockers: parseBulletSection(raw, PAUSE_BLOCKERS_HEADING),
    humanActionsPending: parseBulletSection(raw, PAUSE_HUMAN_ACTIONS_HEADING),
    modifiedFiles: parseBulletSection(raw, PAUSE_MODIFIED_FILES_HEADING),
    nextAction: normalizeParagraph(extractMarkdownSection(raw, PAUSE_NEXT_ACTION_HEADING)),
    contextNotes: normalizeParagraph(extractMarkdownSection(raw, PAUSE_CONTEXT_NOTES_HEADING)),
    artifactSnapshot: {
      core: parseSnapshotLine(snapshot, "Core artifacts"),
      phaseArtifacts: parseSnapshotLine(snapshot, "Phase artifacts"),
      reports: parseSnapshotLine(snapshot, "Existing reports"),
      missing: parseSnapshotLine(snapshot, "Missing artifacts")
    }
  };
}

async function loadPauseHandoffReport(projectRoot: string): Promise<PauseHandoffGetResult> {
  const absolutePath = resolveBlueprintPath(projectRoot, PAUSE_HANDOFF_REPORT_PATH);

  if (!(await blueprintPathExists(absolutePath))) {
    return {
      found: false,
      path: PAUSE_HANDOFF_REPORT_PATH,
      handoff: null,
      reason: `${PAUSE_HANDOFF_REPORT_PATH} does not exist.`,
      warnings: []
    };
  }

  const raw = await fs.readFile(absolutePath, "utf8");

  return {
    found: true,
    path: PAUSE_HANDOFF_REPORT_PATH,
    handoff: parsePauseHandoff(raw),
    reason: null,
    warnings: []
  };
}

function parseTimestamp(value: string | null | undefined): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function isPauseHandoffActive(
  handoff: PauseHandoffRecord | null,
  existingState: BlueprintState
): boolean {
  if (!handoff) {
    return false;
  }

  return (
    existingState.activeCommand === PAUSE_WORK_COMMAND ||
    parseTimestamp(handoff.timestamp) >= parseTimestamp(existingState.lastUpdated)
  );
}

function comparablePauseHandoffRecord(record: PauseHandoffRecord): Record<string, unknown> {
  return {
    reportType: record.reportType,
    schemaVersion: record.schemaVersion,
    status: record.status,
    projectStatus: record.projectStatus,
    currentMilestone: record.currentMilestone,
    currentPhase: record.currentPhase,
    activeCommand: record.activeCommand,
    currentState: record.currentState,
    completedWork: record.completedWork,
    remainingWork: record.remainingWork,
    decisions: record.decisions,
    blockers: record.blockers,
    humanActionsPending: record.humanActionsPending,
    modifiedFiles: record.modifiedFiles,
    contextNotes: record.contextNotes,
    nextAction: record.nextAction
  };
}

function buildPauseHandoffNextAction(
  currentPhase: string | null,
  handoff: PauseHandoffRecord
): string {
  const phaseLabel = currentPhase ?? handoff.currentPhase;

  return phaseLabel
    ? `Run ${RESUME_WORK_COMMAND} to restore the saved pause handoff for Phase ${phaseLabel} and recover the next safe implemented action`
    : `Run ${RESUME_WORK_COMMAND} to restore the saved pause handoff and recover the next safe implemented action`;
}

function renderStateDocument(state: BlueprintState): string {
  const blockers =
    state.blockers.length === 0 ? "- none" : state.blockers.map((item) => `- ${item}`).join("\n");
  const roadmapEvolutionNotes =
    state.roadmapEvolutionNotes.length === 0
      ? ""
      : `\n## Roadmap Evolution Notes\n\n${state.roadmapEvolutionNotes
          .map((item) => `- ${item}`)
          .join("\n")}\n`;

  return `# Blueprint State

- Project status: ${state.projectStatus}
- Current milestone: ${state.currentMilestone}
- Current phase: ${state.currentPhase}
- Active command: ${state.activeCommand}
- Next action: ${state.nextAction}
- Last updated: ${state.lastUpdated}

## Blockers

${blockers}
${roadmapEvolutionNotes}
`;
}

function parseStateDocument(raw: string): BlueprintState {
  const getLineValue = (label: string): string | null => {
    const match = raw.match(new RegExp(`^- ${label}:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : null;
  };

  const blockersSection = extractMarkdownSection(raw, "Blockers");
  const roadmapEvolutionNotesSection = extractMarkdownSection(raw, "Roadmap Evolution Notes");
  const blockers = blockersSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line && line !== "none");
  const roadmapEvolutionNotes = roadmapEvolutionNotesSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0 && line !== "none");
  const currentPhaseValue = getLineValue("Current phase");

  return {
    projectStatus: getLineValue("Project status") ?? DEFAULT_STATE.projectStatus,
    currentMilestone:
      getLineValue("Current milestone") ?? DEFAULT_STATE.currentMilestone,
    currentPhase:
      currentPhaseValue === null
        ? DEFAULT_STATE.currentPhase
        : (normalizeSelectedPhase(currentPhaseValue) ?? ""),
    activeCommand: getLineValue("Active command") ?? DEFAULT_STATE.activeCommand,
    nextAction: getLineValue("Next action") ?? DEFAULT_STATE.nextAction,
    lastUpdated: getLineValue("Last updated") ?? DEFAULT_STATE.lastUpdated,
    blockers,
    roadmapEvolutionNotes
  };
}

function normalizePhaseNumber(value: string): string {
  return normalizeBlueprintPhaseRef(value);
}

function comparePhaseNumbers(left: string, right: string): number {
  const leftParts = normalizePhaseNumber(left)
    .split(".")
    .map((segment) => Number.parseInt(segment, 10));
  const rightParts = normalizePhaseNumber(right)
    .split(".")
    .map((segment) => Number.parseInt(segment, 10));
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return 0;
}

function normalizeSelectedPhase(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed || trimmed.length === 0) {
    return null;
  }

  try {
    return normalizeBlueprintPhaseRef(trimmed);
  } catch {
    const match = trimmed.match(/^(?:phase\s+)?(\d+(?:\.\d+)?)(?:\b|[^0-9.].*)$/i);
    return match?.[1] ? normalizeBlueprintPhaseRef(match[1]) : null;
  }
}

function extractNextActionPhaseSelection(nextAction: string): {
  command: string | null;
  currentPhase: string | null;
} {
  const match = nextAction.match(/(\/blu-[a-z0-9-]+)(?:\s+(\d+(?:\.\d+)?))?/i);

  return {
    command: match?.[1] ?? null,
    currentPhase: normalizeSelectedPhase(match?.[2])
  };
}

function resolveStoredPhaseRoutingOverride(args: {
  activeCommand: string;
  currentPhase: string | null;
  nextAction: string;
  roadmapCurrentPhase: string | null;
}): string | null {
  const nextActionSelection = extractNextActionPhaseSelection(args.nextAction);

  if (
    !PATCH_PHASE_SCOPED_ROUTING_OVERRIDE_COMMANDS.has(args.activeCommand) ||
    nextActionSelection.command === null ||
    nextActionSelection.command === args.activeCommand ||
    !STORED_PHASE_SCOPED_ROUTING_OVERRIDE_COMMANDS.has(nextActionSelection.command)
  ) {
    return null;
  }

  if (
    args.currentPhase === null ||
    args.roadmapCurrentPhase === null ||
    nextActionSelection.currentPhase !== args.currentPhase
  ) {
    return null;
  }

  return comparePhaseNumbers(args.currentPhase, args.roadmapCurrentPhase) < 0
    ? args.currentPhase
    : null;
}

function resolvePatchedPhaseRoutingOverride(args: {
  activeCommand: string;
  currentPhase: string | null;
  roadmapCurrentPhase: string | null;
}): string | null {
  if (!PATCH_PHASE_SCOPED_ROUTING_OVERRIDE_COMMANDS.has(args.activeCommand)) {
    return null;
  }

  if (args.currentPhase === null || args.roadmapCurrentPhase === null) {
    return null;
  }

  return comparePhaseNumbers(args.currentPhase, args.roadmapCurrentPhase) < 0
    ? args.currentPhase
    : null;
}

async function phaseDirectoryExists(projectRoot: string, phaseNumber: string): Promise<boolean> {
  const normalizedPhase = normalizePhaseNumber(phaseNumber);
  const phaseDirs = await listImmediateDirectories(
    resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/phases`)
  );

  return phaseDirs.some((phaseDir) => {
    const extractedPhase = extractPhaseNumberFromDirectory(phaseDir);
    return extractedPhase !== null && normalizePhaseNumber(extractedPhase) === normalizedPhase;
  });
}

function formatPhasePrefix(value: string): string {
  return formatBlueprintPhasePrefix(value);
}

function extractPhasePlanIds(artifacts: Iterable<string>, phasePrefix: string, kind: "PLAN" | "SUMMARY"): string[] {
  const suffix = kind === "PLAN" ? "PLAN" : "SUMMARY";
  const matcher = new RegExp(`/${phasePrefix.replace(".", "\\.")}-(\\d+)-${suffix}\\.md$`);

  return [...new Set(
    [...artifacts]
      .map((artifact) => artifact.match(matcher)?.[1]?.padStart(2, "0") ?? null)
      .filter((value): value is string => value !== null)
  )].sort();
}

function extractPhaseArtifactDirectory(
  artifacts: Iterable<string>,
  phasePrefix: string
): string | null {
  const matcher = new RegExp(
    `^${BLUEPRINT_DIR.replace(".", "\\.")}/phases/([^/]+)/${phasePrefix.replace(".", "\\.")}-`
  );

  for (const artifact of artifacts) {
    const match = artifact.match(matcher);

    if (match) {
      return match[1] ?? null;
    }
  }

  return null;
}

function phaseArtifactPathsForDirectory(artifacts: string[], phaseDir: string | null): string[] {
  if (!phaseDir) {
    return [];
  }

  const prefix = `${BLUEPRINT_DIR}/phases/${phaseDir}/`;

  return artifacts.filter((artifact) => artifact.startsWith(prefix));
}

function findPhaseArtifactPath(
  artifacts: Iterable<string>,
  phasePrefix: string,
  suffix: string
): string | null {
  const expectedSuffix = `/${phasePrefix}${suffix}`;

  for (const artifact of artifacts) {
    if (artifact.endsWith(expectedSuffix)) {
      return artifact;
    }
  }

  return null;
}

async function collectValidatedSummaryPathsForPhase(
  projectRoot: string,
  phaseNumber: string
): Promise<{
  summaryIds: string[];
  summaryPaths: string[];
  pendingPlanIds: string[];
  warnings: string[];
}> {
  const phaseModule = (await import("./phase.js")) as {
    blueprintPhaseSummaryIndex: (args: {
      cwd?: string;
      phase?: string;
    }) => Promise<PhaseSummaryIndexSnapshot>;
  };
  const summaryIndex = await phaseModule.blueprintPhaseSummaryIndex({
    cwd: projectRoot,
    phase: phaseNumber
  });
  const completedPlanIds = new Set(summaryIndex.completedPlans);

  return {
    summaryIds: [...completedPlanIds].sort(),
    summaryPaths: summaryIndex.summaries
      .filter((summary) => completedPlanIds.has(summary.planId))
      .map((summary) => summary.path)
      .sort((left, right) => left.localeCompare(right)),
    pendingPlanIds: [...summaryIndex.pendingPlans],
    warnings: [...summaryIndex.warnings]
  };
}

async function inspectValidatedPhaseValidationArtifacts(
  projectRoot: string,
  phaseArtifacts: string[],
  phasePrefix: string,
  summaryPaths: string[]
): Promise<{
  hasVerification: boolean;
  verificationReadyForUat: boolean;
  verificationNextSafeAction: string | null;
  verificationHasDeferredTestGaps: boolean;
  hasUat: boolean;
  warnings: string[];
}> {
  const warnings: string[] = [];
  let hasVerification = false;
  let verificationReadyForUat = false;
  let verificationNextSafeAction: string | null = null;
  let verificationHasDeferredTestGaps = false;
  let hasUat = false;

  if (summaryPaths.length === 0) {
    warnings.push(
      `${phasePrefix}: no valid execution summaries were found, so VERIFICATION and UAT evidence cannot count toward milestone closeout.`
    );

    return {
      hasVerification: false,
      verificationReadyForUat: false,
      verificationNextSafeAction: null,
      verificationHasDeferredTestGaps: false,
      hasUat: false,
      warnings
    };
  }

  for (const artifact of ["verification", "uat"] as const) {
    const artifactPath = phaseArtifacts.find((candidate) =>
      candidate.endsWith(
        artifact === "verification" ? `${phasePrefix}-VERIFICATION.md` : `${phasePrefix}-UAT.md`
      )
    );

    if (!artifactPath) {
      continue;
    }

    const content = await fs.readFile(resolveBlueprintPath(projectRoot, artifactPath), "utf8");
    const validation =
      artifact === "verification"
        ? validateVerificationArtifactContent(content, summaryPaths)
        : validateUatArtifactContent(content, summaryPaths, {
            requireReadyVerificationEvidence: true
          });

    if (artifact === "verification") {
      verificationNextSafeAction = extractNextSafeActionCommand(content);
      verificationHasDeferredTestGaps = hasDeferredTestGap(content);
    }

    if (validation.valid) {
      if (artifact === "verification") {
        hasVerification = true;
        verificationReadyForUat = isVerificationArtifactReadyForUat(content);

        if (!verificationReadyForUat) {
          warnings.push(
            `${artifactPath}: verification artifact is valid but does not declare ready for UAT, so it should not route to conversational UAT yet.`
          );
        }
      } else {
        const uatState = readUatArtifactState(content);

        if (uatState.complete) {
          hasUat = true;
        } else {
          warnings.push(
            `${artifactPath}: UAT artifact is valid but remains incomplete (${uatState.status ?? "unknown status"} with checkpoint ${uatState.checkpoint ?? "missing"}), so it does not count toward milestone closeout yet.`
          );
        }
      }
      continue;
    }

    warnings.push(
      `${artifactPath}: ${artifact.toUpperCase()} artifact is invalid and does not count as completed validation evidence.`
    );
    warnings.push(...validation.issues.map((issue) => `${artifactPath}: ${issue}`));
    warnings.push(...validation.warnings.map((warning) => `${artifactPath}: ${warning}`));
  }

  return {
    hasVerification,
    verificationReadyForUat,
    verificationNextSafeAction,
    verificationHasDeferredTestGaps,
    hasUat,
    warnings
  };
}

async function listImmediateDirectories(rootPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(rootPath, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function extractPhaseNumberFromDirectory(phaseDir: string): string | null {
  return phaseDir.match(/^(\d+(?:\.\d+)?)/)?.[1] ?? null;
}

async function getImplementedCommandNames(): Promise<Set<string>> {
  if (!implementedCommandNamesPromise) {
    implementedCommandNamesPromise = (async () => {
      try {
        const projectModule = (await import("./project.js")) as {
          blueprintCommandCatalog: () => Promise<CommandCatalogResult>;
        };
        const catalog = await projectModule.blueprintCommandCatalog();

        return new Set(
          Object.entries(catalog.commands)
            .filter(([, entry]) => entry.implemented)
            .map(([commandName]) => blueprintDirectCommand(commandName))
        );
      } catch {
        return new Set();
      }
    })();
  }

  return implementedCommandNamesPromise;
}

function emptyCurrentPhaseQualityGateStatus(): Pick<
  CurrentPhaseArtifactStatus,
  | "securityPath"
  | "hasReview"
  | "hasSecurity"
  | "codeReviewEnabled"
  | "requiresCodeReview"
  | "hasReviewableFiles"
  | "reviewableFiles"
  | "qualityGateMissingGate"
  | "qualityGatesSatisfied"
  | "qualityGateNextAction"
> {
  return {
    securityPath: null,
    hasReview: false,
    hasSecurity: false,
    codeReviewEnabled: true,
    requiresCodeReview: false,
    hasReviewableFiles: false,
    reviewableFiles: [],
    qualityGateMissingGate: null,
    qualityGatesSatisfied: true,
    qualityGateNextAction: null
  };
}

function implementedReviewNextSafeAction(
  reviewNextSafeAction: string | null,
  implementedCommands: Set<string>
): string | null {
  if (!reviewNextSafeAction) {
    return null;
  }

  const reviewNextCommand =
    reviewNextSafeAction.match(/\/blu-[a-z0-9-]+/i)?.[0] ?? null;

  if (
    reviewNextCommand === null ||
    reviewNextCommand === blueprintDirectCommand("progress") ||
    !implementedCommands.has(reviewNextCommand)
  ) {
    return null;
  }

  return reviewNextSafeAction;
}

function resolvePhaseQualityGateNextAction(args: {
  phaseNumber: string;
  evaluation: PhaseQualityGateEvaluation;
  implementedCommands: Set<string>;
  hasReviewableUiSpec: boolean;
  hasUiReview: boolean;
}): string | null {
  const missingGateAction = buildPhaseQualityGateNextAction({
    phaseNumber: args.phaseNumber,
    evaluation: args.evaluation,
    implementedCommandNames: args.implementedCommands
  });

  if (missingGateAction !== null) {
    return missingGateAction;
  }

  const savedReviewRepairAction = implementedReviewNextSafeAction(
    args.evaluation.reviewNextSafeAction,
    args.implementedCommands
  );

  if (args.evaluation.requiresCodeReview && savedReviewRepairAction !== null) {
    return savedReviewRepairAction;
  }

  if (
    (args.evaluation.gatesSatisfied || !args.evaluation.requiresCodeReview) &&
    args.hasReviewableUiSpec &&
    !args.hasUiReview &&
    args.implementedCommands.has(blueprintDirectCommand("ui-review"))
  ) {
    return `Run ${blueprintDirectCommand("ui-review")} ${normalizeBlueprintPhaseRef(args.phaseNumber)} to audit the shipped UI work before phase closeout`;
  }

  return null;
}

async function uiSpecRequiresUiReview(
  projectRoot: string,
  uiSpecPath: string,
  warnings: string[]
): Promise<boolean> {
  try {
    const raw = await fs.readFile(resolveBlueprintPath(projectRoot, uiSpecPath), "utf8");
    return !isExplicitUiSkipRationale(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`${uiSpecPath}: ${message}`);
    return true;
  }
}

async function inspectCurrentPhaseArtifacts(
  projectRoot: string,
  inspectionPhases: string[],
  currentPhase: string | null
): Promise<CurrentPhaseArtifactStatus> {
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (!currentPhase) {
    warnings.push("No current phase could be determined; Blueprint will fall back to progress.");

    return {
      currentPhase: null,
      phaseDir: null,
      phasePrefix: null,
      contextPath: null,
      contextNeedsAuthoring: false,
      researchPath: null,
      uiSpecPath: null,
      uiReviewPath: null,
      reviewPath: null,
      ...emptyCurrentPhaseQualityGateStatus(),
      reviewNextSafeAction: null,
      verificationPath: null,
      verificationNextSafeAction: null,
      verificationHasDeferredTestGaps: false,
      uatPath: null,
      planIds: [],
      summaryIds: [],
      hasContext: false,
      hasResearch: false,
      hasUiSpec: false,
      hasUiReview: false,
      hasVerification: false,
      verificationReadyForUat: false,
      hasUat: false,
      hasPlans: false,
      hasSummaries: false,
      hasPendingExecution: false,
      researchValid: null,
      blockers,
      warnings
    };
  }

  const normalizedPhase = normalizePhaseNumber(currentPhase);
  const phaseDirs = await listImmediateDirectories(
    resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/phases`)
  );
  const matchingPhaseDirs = phaseDirs.filter((phaseDir) => {
    const phaseNumber = extractPhaseNumberFromDirectory(phaseDir);

    return phaseNumber !== null && normalizePhaseNumber(phaseNumber) === normalizedPhase;
  });

  if (matchingPhaseDirs.length === 0) {
    if (inspectionPhases.length === 0) {
      warnings.push(
        `Current phase ${currentPhase} does not have a phase directory yet; Blueprint will fall back to the safest next implemented command until discovery artifacts exist.`
      );
    } else {
      blockers.push(
        `Current phase ${currentPhase} is missing a matching directory under ${BLUEPRINT_DIR}/phases/.`
      );
      warnings.push(
        `Blueprint could not resolve a current-phase directory for ${currentPhase}; next action will stay on health until the phase tree is repaired.`
      );
    }

    return {
      currentPhase,
      phaseDir: null,
      phasePrefix: formatPhasePrefix(normalizedPhase),
      contextPath: null,
      contextNeedsAuthoring: false,
      researchPath: null,
      uiSpecPath: null,
      uiReviewPath: null,
      reviewPath: null,
      ...emptyCurrentPhaseQualityGateStatus(),
      reviewNextSafeAction: null,
      verificationPath: null,
      verificationNextSafeAction: null,
      verificationHasDeferredTestGaps: false,
      uatPath: null,
      planIds: [],
      summaryIds: [],
      hasContext: false,
      hasResearch: false,
      hasUiSpec: false,
      hasUiReview: false,
      hasVerification: false,
      verificationReadyForUat: false,
      hasUat: false,
      hasPlans: false,
      hasSummaries: false,
      hasPendingExecution: false,
      researchValid: null,
      blockers,
      warnings
    };
  }

  if (matchingPhaseDirs.length > 1) {
    blockers.push(
      `Current phase ${currentPhase} has multiple matching directories under ${BLUEPRINT_DIR}/phases/: ${matchingPhaseDirs
        .map((phaseDir) => `${BLUEPRINT_DIR}/phases/${phaseDir}/`)
        .join(", ")}.`
    );
    warnings.push(
      `Blueprint could not choose a single current-phase directory for ${currentPhase}; next action will stay on health until the ambiguity is resolved.`
    );

    return {
      currentPhase,
      phaseDir: null,
      phasePrefix: formatPhasePrefix(normalizedPhase),
      contextPath: null,
      contextNeedsAuthoring: false,
      researchPath: null,
      uiSpecPath: null,
      uiReviewPath: null,
      reviewPath: null,
      ...emptyCurrentPhaseQualityGateStatus(),
      reviewNextSafeAction: null,
      verificationPath: null,
      verificationNextSafeAction: null,
      verificationHasDeferredTestGaps: false,
      uatPath: null,
      planIds: [],
      summaryIds: [],
      hasContext: false,
      hasResearch: false,
      hasUiSpec: false,
      hasUiReview: false,
      hasVerification: false,
      verificationReadyForUat: false,
      hasUat: false,
      hasPlans: false,
      hasSummaries: false,
      hasPendingExecution: false,
      researchValid: null,
      blockers,
      warnings
    };
  }

  const phaseDir = matchingPhaseDirs[0];
  const phasePrefix = formatPhasePrefix(normalizedPhase);
  const phaseRoot = `${BLUEPRINT_DIR}/phases/${phaseDir}`;
  const phaseArtifacts = inspectionPhases.filter((artifact) => artifact.startsWith(`${phaseRoot}/`));
  const contextPath = `${phaseRoot}/${phasePrefix}-CONTEXT.md`;
  const researchPath = `${phaseRoot}/${phasePrefix}-RESEARCH.md`;
  const uiSpecPath = `${phaseRoot}/${phasePrefix}-UI-SPEC.md`;
  const uiReviewPath = `${phaseRoot}/${phasePrefix}-UI-REVIEW.md`;
  const reviewPath = `${phaseRoot}/${phasePrefix}-REVIEW.md`;
  const securityPath = `${phaseRoot}/${phasePrefix}-SECURITY.md`;
  const verificationPath = `${phaseRoot}/${phasePrefix}-VERIFICATION.md`;
  const uatPath = `${phaseRoot}/${phasePrefix}-UAT.md`;
  const hasContext = phaseArtifacts.includes(contextPath);
  let contextNeedsAuthoring = false;
  const hasResearch = phaseArtifacts.includes(researchPath);
  const hasUiSpec = phaseArtifacts.includes(uiSpecPath);
  let hasReviewableUiSpec = hasUiSpec;
  const hasUiReview = phaseArtifacts.includes(uiReviewPath);
  const hasReview = phaseArtifacts.includes(reviewPath);
  const hasSecurity = phaseArtifacts.includes(securityPath);
  const planPaths = phaseArtifacts.filter((artifact) => artifact.endsWith("-PLAN.md"));
  const planIds = extractPhasePlanIds(phaseArtifacts, phasePrefix, "PLAN");
  const {
    summaryIds,
    summaryPaths,
    pendingPlanIds,
    warnings: summaryWarnings
  } = await collectValidatedSummaryPathsForPhase(projectRoot, normalizedPhase);
  const {
    hasVerification,
    verificationReadyForUat,
    verificationNextSafeAction,
    verificationHasDeferredTestGaps,
    hasUat,
    warnings: validationWarnings
  } = await inspectValidatedPhaseValidationArtifacts(
    projectRoot,
    phaseArtifacts,
    phasePrefix,
    summaryPaths
  );
  const hasPlans = planPaths.length > 0;
  const hasSummaries = summaryPaths.length > 0;
  const hasPendingExecution = pendingPlanIds.length > 0;
  const hasLaterArtifacts = [...phaseArtifacts].some(
    (artifact) =>
      artifact.endsWith(`${phasePrefix}-DISCUSSION-LOG.md`) ||
      artifact.endsWith(`${phasePrefix}-DISCUSS-CHECKPOINT.json`) ||
      artifact.endsWith(`${phasePrefix}-RESEARCH.md`) ||
      artifact.endsWith(`${phasePrefix}-UI-SPEC.md`) ||
      artifact.endsWith(`${phasePrefix}-VERIFICATION.md`) ||
      artifact.endsWith(`${phasePrefix}-UAT.md`) ||
      artifact.endsWith("-PLAN.md") ||
      artifact.endsWith("-SUMMARY.md") ||
      artifact.endsWith(`${phasePrefix}-VERIFICATION.md`) ||
      artifact.endsWith(`${phasePrefix}-UAT.md`)
  );
  let researchValid: boolean | null = null;

  if (hasContext) {
    try {
      const raw = await fs.readFile(resolveBlueprintPath(projectRoot, contextPath), "utf8");
      contextNeedsAuthoring = isBootstrapStarterContext(raw);

      if (contextNeedsAuthoring) {
        warnings.push(
          `Current phase ${currentPhase} still has a bootstrap starter CONTEXT artifact; ${blueprintRunDirectCommand("discuss-phase", currentPhase)} to author the saved phase context.`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${contextPath}: ${message}`);
    }
  }

  if (hasResearch) {
    try {
      const raw = await fs.readFile(resolveBlueprintPath(projectRoot, researchPath), "utf8");
      const validation = validateResearchArtifactContent(raw);
      researchValid = validation.valid;

      for (const issue of validation.issues) {
        warnings.push(`${researchPath}: ${issue}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${researchPath}: ${message}`);
      researchValid = false;
    }
  }

  if (hasUiSpec) {
    hasReviewableUiSpec = await uiSpecRequiresUiReview(projectRoot, uiSpecPath, warnings);
  }

  if (!hasContext && hasLaterArtifacts) {
    warnings.push(
      `Current phase ${currentPhase} has later discovery artifacts without a CONTEXT artifact; ${blueprintRunDirectCommand("discuss-phase", currentPhase)} to repair the phase scaffold.`
    );
  }

  for (const planPath of planPaths) {
    try {
      const raw = await fs.readFile(resolveBlueprintPath(projectRoot, planPath), "utf8");
      const validation = validatePlanArtifactContent(raw, normalizedPhase);

      for (const issue of validation.issues) {
        warnings.push(`${planPath}: ${issue}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${planPath}: ${message}`);
    }
  }

  if (hasVerification && !hasSummaries) {
    warnings.push(
      `Current phase ${currentPhase} has a VERIFICATION artifact without execution summaries; validate the summary trail before trusting completion state.`
    );
  }
  if (hasVerification && !verificationReadyForUat) {
    warnings.push(
      `Current phase ${currentPhase} has a VERIFICATION artifact that is not ready for UAT; repair validation evidence before advancing to conversational UAT.`
    );
  }
  if (hasUat && !hasVerification) {
    warnings.push(
      `Current phase ${currentPhase} has a UAT artifact without a VERIFICATION artifact; confirm validation evidence is not missing.`
    );
  }

  warnings.push(...summaryWarnings, ...validationWarnings);
  const qualityGateEvaluation = await evaluatePhaseQualityGates({
    projectRoot,
    phaseNumber: normalizedPhase,
    phasePrefix,
    phaseDir: phaseRoot,
    artifacts: phaseArtifacts
  });
  const qualityGateNextAction = resolvePhaseQualityGateNextAction({
    phaseNumber: normalizedPhase,
    evaluation: qualityGateEvaluation,
    implementedCommands: await getImplementedCommandNames(),
    hasReviewableUiSpec,
    hasUiReview
  });

  if (qualityGateEvaluation.requiresCodeReview && !qualityGateEvaluation.gatesSatisfied) {
    warnings.push(
      `Current phase ${currentPhase} has quality gate debt: ${qualityGateEvaluation.missingGate === "review" ? "REVIEW evidence is missing" : "SECURITY evidence is missing"} for ${qualityGateEvaluation.reviewableFiles.length} reviewable file(s).`
    );
  }

  warnings.push(...qualityGateEvaluation.warnings);

  return {
    currentPhase,
    phaseDir,
    phasePrefix,
    contextPath,
    contextNeedsAuthoring,
    researchPath,
    uiSpecPath,
    uiReviewPath,
    reviewPath: qualityGateEvaluation.reviewPath ?? (hasReview ? reviewPath : null),
    securityPath: qualityGateEvaluation.securityPath ?? (hasSecurity ? securityPath : null),
    reviewNextSafeAction: qualityGateEvaluation.reviewNextSafeAction,
    verificationPath,
    verificationNextSafeAction,
    verificationHasDeferredTestGaps,
    uatPath,
    planIds,
    summaryIds,
    hasContext,
    hasResearch,
    hasUiSpec,
    hasUiReview,
    hasReview: qualityGateEvaluation.hasReview,
    hasSecurity: qualityGateEvaluation.hasSecurity,
    hasVerification,
    verificationReadyForUat,
    hasUat,
    hasPlans,
    hasSummaries,
    hasPendingExecution,
    codeReviewEnabled: qualityGateEvaluation.codeReviewEnabled,
    requiresCodeReview: qualityGateEvaluation.requiresCodeReview,
    hasReviewableFiles: qualityGateEvaluation.reviewableFiles.length > 0,
    reviewableFiles: qualityGateEvaluation.reviewableFiles,
    qualityGateMissingGate: qualityGateEvaluation.missingGate,
    qualityGatesSatisfied: qualityGateEvaluation.gatesSatisfied,
    qualityGateNextAction,
    researchValid,
    blockers,
    warnings
  };
}

async function readRoadmapSignals(projectRoot: string): Promise<{
  currentMilestone: string | null;
  currentPhase: string | null;
  allPhasesComplete: boolean;
  phases: RoadmapPhaseSignal[];
}> {
  const roadmapPath = resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/ROADMAP.md`);

  try {
    const raw = await fs.readFile(roadmapPath, "utf8");
    const milestoneMatch = raw.match(/Active milestone:\s*(.+)$/m);
    const checkboxPhases = [...raw.matchAll(
      /^\s*-\s+\[([ xX])\]\s+(?:\*\*)?Phase\s+(\d+(?:\.\d+)?)(?:\*\*)?\s*(?::|-)\s+/gm
    )].map((match) => ({
      phaseNumber: normalizeBlueprintPhaseRef(match[2]) ?? match[2],
      completed: match[1].toLowerCase() === "x"
    }));
    const phases = mergeRoadmapPhaseSignals(
      checkboxPhases,
      readRoadmapPhaseDetailSignals(raw)
    );
    const currentPhase =
      phases.find((phase) => !phase.completed)?.phaseNumber ??
      phases.at(-1)?.phaseNumber ??
      null;

    return {
      currentMilestone: milestoneMatch?.[1]?.trim() ?? null,
      currentPhase,
      allPhasesComplete:
        phases.length > 0 &&
        phases.every((phase) => phase.completed),
      phases
    };
  } catch {
    return {
      currentMilestone: null,
      currentPhase: null,
      allPhasesComplete: false,
      phases: []
    };
  }
}

async function inspectMilestoneEvidence(
  projectRoot: string,
  phaseArtifacts: string[],
  phases: RoadmapPhaseSignal[]
): Promise<MilestoneEvidenceStatus> {
  const missingVerificationPhases: string[] = [];
  const missingUatPhases: string[] = [];
  const verificationNotReadyPhases: string[] = [];
  const verificationTestGapPhases: string[] = [];
  const verificationRepairActions: Record<string, string> = {};
  const pendingSummaryCoveragePhases: string[] = [];
  const missingQualityGatePhases: string[] = [];
  const qualityGateDebtPhases: string[] = [];
  const qualityGateRepairActions: Record<string, string> = {};
  const qualityGateMissingGates: Record<string, Exclude<PhaseQualityGateMissingGate, null>> = {};
  const qualityGateReviewableFiles: Record<string, string[]> = {};
  const warnings: string[] = [];
  const implementedCommands = await getImplementedCommandNames();

  for (const phase of phases) {
    if (!phase.completed) {
      continue;
    }

    const phasePrefix = formatBlueprintPhasePrefix(phase.phaseNumber);
    const phaseDir = extractPhaseArtifactDirectory(phaseArtifacts, phasePrefix);
    const phaseScopedArtifacts = phaseArtifactPathsForDirectory(phaseArtifacts, phaseDir);
    const uiSpecPath = findPhaseArtifactPath(phaseScopedArtifacts, phasePrefix, "-UI-SPEC.md");
    const hasReviewableUiSpec =
      uiSpecPath === null
        ? false
        : await uiSpecRequiresUiReview(projectRoot, uiSpecPath, warnings);
    const hasUiReview =
      findPhaseArtifactPath(phaseScopedArtifacts, phasePrefix, "-UI-REVIEW.md") !== null;
    const {
      summaryPaths,
      pendingPlanIds,
      warnings: summaryWarnings
    } = await collectValidatedSummaryPathsForPhase(projectRoot, phase.phaseNumber);

    if (pendingPlanIds.length > 0) {
      pendingSummaryCoveragePhases.push(phase.phaseNumber);
      warnings.push(
        `Phase ${phase.phaseNumber} has pending execution plans without valid summaries; milestone closeout remains blocked until the summary trail is complete.`
      );
    }

    const {
      hasVerification,
      verificationReadyForUat,
      verificationHasDeferredTestGaps,
      verificationNextSafeAction,
      hasUat,
      warnings: validationWarnings
    } = await inspectValidatedPhaseValidationArtifacts(
      projectRoot,
      phaseScopedArtifacts,
      phasePrefix,
      summaryPaths
    );

    warnings.push(...summaryWarnings, ...validationWarnings);

    if (verificationHasDeferredTestGaps) {
      verificationTestGapPhases.push(phase.phaseNumber);
    }

    if (!hasVerification) {
      missingVerificationPhases.push(phase.phaseNumber);
    }

    if (hasVerification && !verificationReadyForUat) {
      verificationNotReadyPhases.push(phase.phaseNumber);
      warnings.push(
        `Phase ${phase.phaseNumber} has verification evidence that is valid but not ready for UAT, so milestone closeout remains blocked until validation is repaired.`
      );
    }

    if (
      (verificationHasDeferredTestGaps || (hasVerification && !verificationReadyForUat)) &&
      verificationNextSafeAction
    ) {
      verificationRepairActions[phase.phaseNumber] = verificationNextSafeAction;
    }

    if (!hasUat) {
      missingUatPhases.push(phase.phaseNumber);
    }

    const qualityGateEvaluation = await evaluatePhaseQualityGates({
      projectRoot,
      phaseNumber: phase.phaseNumber,
      phasePrefix,
      phaseDir: phaseDir ? `${BLUEPRINT_DIR}/phases/${phaseDir}` : undefined,
      artifacts: phaseScopedArtifacts
    });
    const qualityGateNextAction = resolvePhaseQualityGateNextAction({
      phaseNumber: phase.phaseNumber,
      evaluation: qualityGateEvaluation,
      implementedCommands,
      hasReviewableUiSpec,
      hasUiReview
    });

    warnings.push(...qualityGateEvaluation.warnings);

    if (qualityGateEvaluation.reviewableFiles.length > 0) {
      qualityGateReviewableFiles[phase.phaseNumber] = qualityGateEvaluation.reviewableFiles;
    }

    if (
      qualityGateEvaluation.requiresCodeReview &&
      qualityGateEvaluation.missingGate !== null
    ) {
      missingQualityGatePhases.push(phase.phaseNumber);
      qualityGateDebtPhases.push(phase.phaseNumber);
      qualityGateMissingGates[phase.phaseNumber] = qualityGateEvaluation.missingGate;
      warnings.push(
        `Phase ${phase.phaseNumber} has quality gate debt: ${qualityGateEvaluation.missingGate === "review" ? "REVIEW evidence is missing" : "SECURITY evidence is missing"} for ${qualityGateEvaluation.reviewableFiles.length} reviewable file(s).`
      );
    } else if (qualityGateNextAction !== null) {
      qualityGateDebtPhases.push(phase.phaseNumber);
      warnings.push(
        `Phase ${phase.phaseNumber} has derived quality gate debt: ${qualityGateNextAction}`
      );
    }

    if (qualityGateNextAction !== null) {
      qualityGateRepairActions[phase.phaseNumber] = qualityGateNextAction;
    }
  }

  return {
    missingVerificationPhases,
    missingUatPhases,
    verificationNotReadyPhases,
    verificationTestGapPhases,
    verificationRepairActions,
    pendingSummaryCoveragePhases,
    missingQualityGatePhases,
    qualityGateDebtPhases,
    qualityGateRepairActions,
    qualityGateMissingGates,
    qualityGateReviewableFiles,
    blockingPhase:
      missingVerificationPhases[0] ??
      verificationTestGapPhases[0] ??
      verificationNotReadyPhases[0] ??
      missingUatPhases[0] ??
      qualityGateDebtPhases[0] ??
      pendingSummaryCoveragePhases[0] ??
      null,
    qualityGateBlockingPhase: qualityGateDebtPhases[0] ?? null,
    allCompletedPhasesReady:
      missingVerificationPhases.length === 0 &&
      verificationNotReadyPhases.length === 0 &&
      verificationTestGapPhases.length === 0 &&
      missingUatPhases.length === 0 &&
      qualityGateDebtPhases.length === 0 &&
      pendingSummaryCoveragePhases.length === 0,
    warnings
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractMarkdownSectionLines(content: string, heading: string): string[] {
  const lines = content.split(/\r?\n/);
  const headingPattern = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`);
  const startIndex = lines.findIndex((line) => headingPattern.test(line.trim()));

  if (startIndex === -1) {
    return [];
  }

  const sectionLines: string[] = [];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";

    if (/^##\s+/.test(line)) {
      break;
    }

    if (line.length === 0) {
      continue;
    }

    sectionLines.push(line);
  }

  return sectionLines;
}

function normalizeReportSignalLine(line: string): string {
  return line
    .replace(/^[*-]\s+/, "")
    .replace(/`/g, "")
    .trim()
    .replace(/[.]+$/, "")
    .toLowerCase();
}

function isNoneLikeReportSignal(line: string): boolean {
  const normalized = normalizeReportSignalLine(line);

  return (
    normalized === "none" ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized.startsWith("no gaps") ||
    normalized.startsWith("no actionable gaps") ||
    normalized.startsWith("no blockers") ||
    normalized.startsWith("no archival blockers")
  );
}

function extractBlueprintCommand(line: string, exactMilestoneArgument?: string | null): string | null {
  const match = line.match(/\/blu(?:-[a-z0-9]+(?:-[a-z0-9]+)*|\s+[a-z0-9]+(?:-[a-z0-9]+)*)/i);

  if (!match || match.index === undefined) {
    return null;
  }

  const command = match[0].trim().replace(/^\/blu\s+/i, "/blu-").toLowerCase();
  let argumentText = line.slice(match.index + match[0].length).trimStart();

  if (
    exactMilestoneArgument &&
    (
      command === "/blu-audit-milestone" ||
      command === "/blu-complete-milestone" ||
      command === "/blu-milestone-summary"
    ) &&
    argumentText.includes(exactMilestoneArgument)
  ) {
    return `${command} ${exactMilestoneArgument}`;
  }

  if (argumentText.length === 0 || /^[`'").,;:!?]/.test(argumentText)) {
    return command;
  }

  const wrapperIndex = argumentText.search(/[`'"]/);

  if (wrapperIndex >= 0) {
    argumentText = argumentText.slice(0, wrapperIndex);
  }

  argumentText = argumentText
    .replace(/\s+(?:to|then|so)\s+.+$/i, "")
    .replace(/[.,;:!?]+$/g, "")
    .trim();

  if (argumentText.length === 0 || /^(?:to|then|so)\b/i.test(argumentText)) {
    return command;
  }

  if (
    command === "/blu-audit-milestone" ||
    command === "/blu-complete-milestone" ||
    command === "/blu-milestone-summary"
  ) {
    return `${command} ${argumentText}`;
  }

  const simpleArgument = argumentText.match(/^[^\s`'").,;:!?]+/)?.[0] ?? null;

  return simpleArgument ? `${command} ${simpleArgument}` : command;
}

function extractNextSafeActionCommand(content: string): string | null {
  return (
    extractMarkdownSectionLines(content, "Next Safe Action")
      .map((line) => extractBlueprintCommand(line))
      .find((command): command is string => command !== null) ?? null
  );
}

function hasDeferredTestGap(content: string): boolean {
  const gapRows = extractMarkdownTableRows(
    extractMarkdownSectionLines(content, "Gap Classification").join("\n")
  );

  return gapRows.some(
    ([gapClass]) => normalizeReportSignalLine(gapClass ?? "") === "deferred-test"
  );
}

async function readReviewArtifactNextSafeAction(args: {
  projectRoot: string;
  artifactPath: string;
}): Promise<{
  nextAction: string | null;
  warnings: string[];
}> {
  try {
    const raw = await fs.readFile(
      resolveBlueprintPath(args.projectRoot, args.artifactPath),
      "utf8"
    );
    const nextSafeAction = extractNextSafeActionCommand(raw);

    if (nextSafeAction) {
      return { nextAction: nextSafeAction, warnings: [] };
    }

    return {
      nextAction: null,
      warnings: [
        `${args.artifactPath}: Next Safe Action does not contain a Blueprint command; state routing will fall back to derived phase status.`
      ]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      nextAction: null,
      warnings: [`${args.artifactPath}: ${message}`]
    };
  }
}

function parseMilestoneAuditGapSection(section: string): MilestoneAuditGapRow[] {
  return extractMarkdownTableRows(section).flatMap((row) => {
    if (row.length !== 4) {
      return [];
    }

    const [gapId, surface, evidence, repair] = row.map((cell) => cell.trim());

    return [
      {
        gapId,
        surface,
        evidence,
        repair
      }
    ];
  });
}

function hasActionableMilestoneAuditGap(rows: MilestoneAuditGapRow[]): boolean {
  return rows.some((row) => {
    return [row.gapId, row.surface, row.evidence, row.repair].some(
      (value) => !isNoneLikeReportSignal(value)
    );
  });
}

async function inspectMilestoneAuditReportStatus(args: {
  projectRoot: string;
  currentMilestone: string | null;
  reports: string[];
}): Promise<MilestoneAuditReportStatus> {
  if (args.currentMilestone === null) {
    return emptyMilestoneAuditReportStatus();
  }

  const reportPath = buildBlueprintReportPath(`milestone-audit-${args.currentMilestone}`);

  if (!args.reports.includes(reportPath)) {
    return emptyMilestoneAuditReportStatus();
  }

  try {
    const raw = await fs.readFile(resolveBlueprintPath(args.projectRoot, reportPath), "utf8");
    const auditVerdictLines = extractMarkdownSectionLines(raw, "Audit Verdict");
    const requirementGapRows = parseMilestoneAuditGapSection(
      extractMarkdownSection(raw, "Requirement Gaps")
    );
    const integrationGapRows = parseMilestoneAuditGapSection(
      extractMarkdownSection(raw, "Integration Gaps")
    );
    const flowGapRows = parseMilestoneAuditGapSection(extractMarkdownSection(raw, "Flow Gaps"));
    const optionalGapRows = parseMilestoneAuditGapSection(
      extractMarkdownSection(raw, "Optional Gaps")
    );
    const gapsFound = extractMarkdownSectionLines(raw, "Gaps Found");
    const archivalBlockers = extractMarkdownSectionLines(raw, "Archival Blockers");
    const nextSafeActionLines = extractMarkdownSectionLines(raw, "Next Safe Action");
    const verdict =
      auditVerdictLines
        .map((line) => line.match(/^- Verdict:\s*(READY_TO_CLOSE|FOLLOW_UP|BLOCKED)\s*$/)?.[1] ?? null)
      .find((value): value is "READY_TO_CLOSE" | "FOLLOW_UP" | "BLOCKED" => value !== null) ??
      null;
    const verdictBlocksCompletion = verdict === "FOLLOW_UP" || verdict === "BLOCKED";
    const nextSafeAction =
      nextSafeActionLines
        .map((line) => extractBlueprintCommand(line, args.currentMilestone))
        .find((command) => command !== null) ?? null;
    const gapSections = {
      requirement: requirementGapRows,
      integration: integrationGapRows,
      flow: flowGapRows,
      optional: optionalGapRows
    };
    const hasStructuredGapSections = Object.values(gapSections).some((rows) => rows.length > 0);
    const actionableGaps =
      hasActionableMilestoneAuditGap(requirementGapRows) ||
      hasActionableMilestoneAuditGap(integrationGapRows) ||
      hasActionableMilestoneAuditGap(flowGapRows) ||
      hasActionableMilestoneAuditGap(optionalGapRows) ||
      (!hasStructuredGapSections && gapsFound.some((line) => !isNoneLikeReportSignal(line)));

    return {
      found: true,
      verdict,
      gapSections,
      hasActionableGaps: actionableGaps,
      hasArchivalBlockers: archivalBlockers.some((line) => !isNoneLikeReportSignal(line)),
      nextSafeAction,
      readyForCompletion:
        verdict === "READY_TO_CLOSE" &&
        !verdictBlocksCompletion &&
        !actionableGaps &&
        archivalBlockers.every(isNoneLikeReportSignal)
    };
  } catch {
    return {
      ...emptyMilestoneAuditReportStatus(),
      found: true
    };
  }
}

async function deriveNextAction(args: {
  projectStatus: string;
  blockers: string[];
  currentPhase: string | null;
  currentMilestone: string | null;
  allPhasesComplete: boolean;
  milestoneAuditReport: MilestoneAuditReportStatus;
  hasMilestoneCompletion: boolean;
  hasMilestoneSummary: boolean;
  phaseArtifacts: CurrentPhaseArtifactStatus;
  milestoneEvidence: MilestoneEvidenceStatus;
  bootstrapRouting: BootstrapRoutingSignals;
  workflow: WorkflowRoutingSignals;
}): Promise<string> {
  if (args.projectStatus === "uninitialized") {
    return args.bootstrapRouting.brownfieldDetected && !args.bootstrapRouting.codebaseMapped
      ? `${blueprintRunDirectCommand("map-codebase")} before ${blueprintDirectCommand("new-project")} so brownfield bootstrap starts from a mapped baseline`
      : blueprintRunDirectCommand("new-project");
  }

  if (args.projectStatus === "mapping-incomplete") {
    return `${blueprintRunDirectCommand("map-codebase")} to finish the interrupted codebase-only mapping bundle`;
  }

  if (args.projectStatus === "mapped-only") {
    return `${blueprintRunDirectCommand("new-project")} to bootstrap project artifacts while preserving the mapped codebase docs`;
  }

  if (args.projectStatus === "partial") {
    return `${blueprintRunDirectCommand("health")} to inspect the partial .blueprint state`;
  }

  if (args.blockers.length > 0) {
    return `${blueprintRunDirectCommand("health")} to inspect blockers and repair options`;
  }

  if (args.bootstrapRouting.brownfieldDetected && !args.bootstrapRouting.codebaseMapped) {
    return `${blueprintRunDirectCommand("map-codebase")} before treating the roadmap as durable`;
  }

  const implementedCommands = await getImplementedCommandNames();
  const discussPhaseCommand = blueprintDirectCommand("discuss-phase");
  const researchPhaseCommand = blueprintDirectCommand("research-phase");
  const uiPhaseCommand = blueprintDirectCommand("ui-phase");
  const planPhaseCommand = blueprintDirectCommand("plan-phase");
  const executePhaseCommand = blueprintDirectCommand("execute-phase");
  const validatePhaseCommand = blueprintDirectCommand("validate-phase");
  const verifyWorkCommand = blueprintDirectCommand("verify-work");
  const addTestsCommand = blueprintDirectCommand("add-tests");
  const auditMilestoneCommand = blueprintDirectCommand("audit-milestone");
  const planMilestoneGapsCommand = blueprintDirectCommand("plan-milestone-gaps");
  const completeMilestoneCommand = blueprintDirectCommand("complete-milestone");
  const milestoneSummaryCommand = blueprintDirectCommand("milestone-summary");
  const newMilestoneCommand = blueprintDirectCommand("new-milestone");

  if (!args.currentPhase || !args.phaseArtifacts.phaseDir) {
    return `${blueprintRunDirectCommand("progress")} to review the next safe Blueprint action`;
  }

  if (
    (!args.phaseArtifacts.hasContext || args.phaseArtifacts.contextNeedsAuthoring) &&
    implementedCommands.has(discussPhaseCommand)
  ) {
    return args.phaseArtifacts.contextNeedsAuthoring
      ? `Run ${discussPhaseCommand} ${args.currentPhase} to author the current phase context`
      : `Run ${discussPhaseCommand} ${args.currentPhase} to rebuild the current phase context`;
  }

  if (
    args.workflow.researchEnabled &&
    args.phaseArtifacts.hasContext &&
    !args.phaseArtifacts.hasResearch &&
    implementedCommands.has(researchPhaseCommand)
  ) {
    return `Run ${researchPhaseCommand} ${args.currentPhase} to capture phase research`;
  }

  if (
    args.workflow.researchEnabled &&
    args.phaseArtifacts.hasResearch &&
    args.phaseArtifacts.researchValid === false &&
    !args.phaseArtifacts.hasPlans &&
    !args.phaseArtifacts.hasSummaries &&
    !args.phaseArtifacts.hasVerification &&
    !args.phaseArtifacts.hasUat &&
    implementedCommands.has(researchPhaseCommand)
  ) {
    return `Run ${researchPhaseCommand} ${args.currentPhase} to repair invalid phase research`;
  }

  if (
    !args.workflow.researchEnabled &&
    args.phaseArtifacts.hasContext &&
    args.workflow.uiPhaseEnabled &&
    !args.phaseArtifacts.hasUiSpec &&
    implementedCommands.has(uiPhaseCommand)
  ) {
    return `Run ${uiPhaseCommand} ${args.currentPhase} to draft the phase UI contract`;
  }

  if (
    args.phaseArtifacts.hasResearch &&
    args.workflow.uiPhaseEnabled &&
    !args.phaseArtifacts.hasUiSpec &&
    implementedCommands.has(uiPhaseCommand)
  ) {
    return `Run ${uiPhaseCommand} ${args.currentPhase} to draft the phase UI contract`;
  }

  const researchReady =
    !args.workflow.researchEnabled ||
    (args.phaseArtifacts.hasResearch && args.phaseArtifacts.researchValid !== false);
  const uiReady = !args.workflow.uiPhaseEnabled || args.phaseArtifacts.hasUiSpec;

  if (
    args.phaseArtifacts.hasContext &&
    researchReady &&
    uiReady &&
    !args.phaseArtifacts.hasPlans &&
    implementedCommands.has(planPhaseCommand)
  ) {
    return `Run ${planPhaseCommand} ${args.currentPhase} to create execution-ready phase plans`;
  }

  if (
    args.phaseArtifacts.hasPlans &&
    args.phaseArtifacts.hasPendingExecution &&
    implementedCommands.has(executePhaseCommand)
  ) {
    return `Run ${executePhaseCommand} ${args.currentPhase} to execute the remaining phase plans`;
  }

  const savedReviewRepairAction =
    args.phaseArtifacts.hasReview && args.phaseArtifacts.hasSecurity
      ? implementedReviewNextSafeAction(
          args.phaseArtifacts.reviewNextSafeAction,
          implementedCommands
        )
      : null;

  if (savedReviewRepairAction) {
    return `Run ${savedReviewRepairAction}.`;
  }

  if (
    args.phaseArtifacts.hasPlans &&
    !args.phaseArtifacts.hasPendingExecution &&
    args.phaseArtifacts.verificationHasDeferredTestGaps &&
    implementedCommands.has(addTestsCommand)
  ) {
    return `Run ${addTestsCommand} ${args.currentPhase} to add tests for deferred validation gaps before rerunning validation`;
  }

  if (
    args.phaseArtifacts.hasPlans &&
    !args.phaseArtifacts.hasPendingExecution &&
    !args.phaseArtifacts.hasVerification &&
    implementedCommands.has(validatePhaseCommand)
  ) {
    return `Run ${validatePhaseCommand} ${args.currentPhase} to validate the completed phase execution`;
  }

  if (
    args.phaseArtifacts.hasVerification &&
    !args.phaseArtifacts.verificationReadyForUat
  ) {
    const verificationNextCommand =
      args.phaseArtifacts.verificationNextSafeAction?.match(/\/blu-[a-z0-9-]+/i)?.[0] ?? null;

    if (
      args.phaseArtifacts.verificationHasDeferredTestGaps &&
      (!verificationNextCommand || verificationNextCommand === validatePhaseCommand) &&
      implementedCommands.has(addTestsCommand)
    ) {
      return `Run ${addTestsCommand} ${args.currentPhase} to add tests for deferred validation gaps before rerunning validation`;
    }

    if (
      verificationNextCommand &&
      args.phaseArtifacts.verificationNextSafeAction &&
      implementedCommands.has(verificationNextCommand)
    ) {
      return args.phaseArtifacts.verificationNextSafeAction;
    }

    if (
      args.phaseArtifacts.verificationHasDeferredTestGaps &&
      implementedCommands.has(addTestsCommand)
    ) {
      return `Run ${addTestsCommand} ${args.currentPhase} to add tests for deferred validation gaps before rerunning validation`;
    }

    if (implementedCommands.has(validatePhaseCommand)) {
      return `Run ${validatePhaseCommand} ${args.currentPhase} to repair the verification evidence before UAT`;
    }
  }

  if (
    args.phaseArtifacts.hasVerification &&
    args.phaseArtifacts.verificationReadyForUat &&
    !args.phaseArtifacts.hasUat &&
    implementedCommands.has(verifyWorkCommand)
  ) {
    return `Run ${verifyWorkCommand} ${args.currentPhase} to capture conversational UAT evidence`;
  }

  if (args.phaseArtifacts.hasUat && args.phaseArtifacts.qualityGateNextAction) {
    return args.phaseArtifacts.qualityGateNextAction;
  }

  if (
    args.allPhasesComplete &&
    args.milestoneEvidence.missingVerificationPhases.length > 0 &&
    implementedCommands.has(validatePhaseCommand)
  ) {
    const phaseNumber = args.milestoneEvidence.missingVerificationPhases[0];

    if (
      args.milestoneEvidence.verificationTestGapPhases.includes(phaseNumber) &&
      implementedCommands.has(addTestsCommand)
    ) {
      return `Run ${addTestsCommand} ${phaseNumber} to add tests for deferred milestone validation gaps before closeout`;
    }

    return `Run ${validatePhaseCommand} ${phaseNumber} to restore missing milestone validation evidence before closeout`;
  }

  if (
    args.allPhasesComplete &&
    args.milestoneEvidence.missingVerificationPhases.length === 0 &&
    args.milestoneEvidence.verificationNotReadyPhases.length > 0 &&
    implementedCommands.has(validatePhaseCommand)
  ) {
    const phaseNumber = args.milestoneEvidence.verificationNotReadyPhases[0];
    const verificationRepairAction = args.milestoneEvidence.verificationRepairActions[phaseNumber] ?? null;
    const verificationRepairCommand =
      verificationRepairAction?.match(/\/blu-[a-z0-9-]+/i)?.[0] ?? null;
    const hasDeferredTestGap =
      args.milestoneEvidence.verificationTestGapPhases.includes(phaseNumber);

    if (
      hasDeferredTestGap &&
      (!verificationRepairCommand || verificationRepairCommand === validatePhaseCommand) &&
      implementedCommands.has(addTestsCommand)
    ) {
      return `Run ${addTestsCommand} ${phaseNumber} to add tests for deferred milestone validation gaps before closeout`;
    }

    if (verificationRepairCommand && implementedCommands.has(verificationRepairCommand)) {
      return verificationRepairAction;
    }

    if (hasDeferredTestGap && implementedCommands.has(addTestsCommand)) {
      return `Run ${addTestsCommand} ${phaseNumber} to add tests for deferred milestone validation gaps before closeout`;
    }

    return `Run ${validatePhaseCommand} ${phaseNumber} to repair milestone validation evidence before closeout`;
  }

  if (
    args.allPhasesComplete &&
    args.milestoneEvidence.missingVerificationPhases.length === 0 &&
    args.milestoneEvidence.verificationNotReadyPhases.length === 0 &&
    args.milestoneEvidence.missingUatPhases.length > 0 &&
    implementedCommands.has(verifyWorkCommand)
  ) {
    return `Run ${verifyWorkCommand} ${args.milestoneEvidence.missingUatPhases[0]} to restore missing milestone UAT evidence before closeout`;
  }

  if (
    args.allPhasesComplete &&
    args.milestoneEvidence.missingVerificationPhases.length === 0 &&
    args.milestoneEvidence.verificationNotReadyPhases.length === 0 &&
    args.milestoneEvidence.missingUatPhases.length === 0 &&
    args.milestoneEvidence.qualityGateDebtPhases.length > 0
  ) {
    const phaseNumber = args.milestoneEvidence.qualityGateDebtPhases[0];
    const qualityGateRepairAction =
      args.milestoneEvidence.qualityGateRepairActions[phaseNumber] ?? null;

    if (qualityGateRepairAction !== null) {
      return qualityGateRepairAction;
    }

    return `${blueprintRunDirectCommand("progress")} to review quality gate debt for Phase ${phaseNumber}`;
  }

  if (
    args.allPhasesComplete &&
    args.milestoneEvidence.allCompletedPhasesReady &&
    !args.milestoneAuditReport.found &&
    implementedCommands.has(auditMilestoneCommand)
  ) {
    const milestoneSuffix = args.currentMilestone ? ` ${args.currentMilestone}` : "";

    return `Run ${auditMilestoneCommand}${milestoneSuffix} to audit milestone completion before archiving`;
  }

  if (
    args.allPhasesComplete &&
    args.milestoneEvidence.allCompletedPhasesReady &&
    args.milestoneAuditReport.found &&
    args.milestoneAuditReport.verdict !== "READY_TO_CLOSE" &&
    args.milestoneAuditReport.nextSafeAction &&
    implementedCommands.has(
      args.milestoneAuditReport.nextSafeAction.match(/\/blu-[a-z0-9-]+/i)?.[0] ?? ""
    )
  ) {
    return args.milestoneAuditReport.nextSafeAction;
  }

  if (
    args.allPhasesComplete &&
    args.milestoneEvidence.allCompletedPhasesReady &&
    args.milestoneAuditReport.found &&
    (args.milestoneAuditReport.hasActionableGaps || args.milestoneAuditReport.hasArchivalBlockers) &&
    implementedCommands.has(planMilestoneGapsCommand)
  ) {
    return `Run ${planMilestoneGapsCommand} to close milestone gaps before archival`;
  }

  if (
    args.allPhasesComplete &&
    args.milestoneEvidence.allCompletedPhasesReady &&
    args.milestoneAuditReport.found &&
    args.milestoneAuditReport.readyForCompletion &&
    !args.hasMilestoneCompletion &&
    implementedCommands.has(completeMilestoneCommand)
  ) {
    const milestoneSuffix = args.currentMilestone ? ` ${args.currentMilestone}` : "";

    return `Run ${completeMilestoneCommand}${milestoneSuffix} to record milestone closeout after the audit`;
  }

  if (
    args.allPhasesComplete &&
    args.milestoneEvidence.allCompletedPhasesReady &&
    args.milestoneAuditReport.found &&
    args.hasMilestoneCompletion &&
    !args.hasMilestoneSummary &&
    implementedCommands.has(milestoneSummaryCommand)
  ) {
    const milestoneSuffix = args.currentMilestone ? ` ${args.currentMilestone}` : "";

    return `Run ${milestoneSummaryCommand}${milestoneSuffix} to generate the final milestone summary`;
  }

  if (
    args.allPhasesComplete &&
    args.milestoneEvidence.allCompletedPhasesReady &&
    args.milestoneAuditReport.found &&
    args.hasMilestoneCompletion &&
    args.hasMilestoneSummary &&
    implementedCommands.has(newMilestoneCommand)
  ) {
    return `Run ${newMilestoneCommand} to start the next milestone from the saved carry-forward summary`;
  }

  return args.currentPhase
    ? `${blueprintRunDirectCommand("progress")} to review Phase ${args.currentPhase} and the next safe action`
    : `${blueprintRunDirectCommand("progress")} to review the next safe Blueprint action`;
}

async function buildSyncedState(
  projectRoot: string,
  patch: Pick<Partial<BlueprintState>, "activeCommand" | "currentPhase"> = {}
): Promise<{
  state: BlueprintState;
  warnings: string[];
  milestoneAuditReport: MilestoneAuditReportStatus;
}> {
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const bootstrapDiagnostics = await inspectBootstrapArtifacts(projectRoot);
  const existingState = await loadBlueprintState(projectRoot);
  const pauseHandoff = await loadPauseHandoffReport(projectRoot);
  const roadmapSignals = await readRoadmapSignals(projectRoot);
  const warnings: string[] = [];

  if (!inspection.blueprintRootExists) {
    throw new Error(
      `Cannot sync Blueprint state before .blueprint/ exists. ${blueprintRunDirectCommand("new-project")} instead.`
    );
  }

  if (!(await blueprintPathExists(resolveBlueprintPath(projectRoot, BLUEPRINT_STATE_PATH)))) {
    warnings.push("STATE.md was missing and has been reconstructed from surviving artifacts.");
  }

  if (!(await blueprintPathExists(resolveBlueprintPath(projectRoot, `${BLUEPRINT_DIR}/ROADMAP.md`)))) {
    warnings.push("ROADMAP.md is missing; state sync fell back to the last known milestone and phase.");
  }

  const projectStatus = inspection.readiness;
  const requestedCurrentPhase = normalizeSelectedPhase(patch.currentPhase);
  const requestedCurrentPhaseExists =
    requestedCurrentPhase !== null &&
    (await phaseDirectoryExists(projectRoot, requestedCurrentPhase));
  const effectivePatchCurrentPhase =
    requestedCurrentPhaseExists ? requestedCurrentPhase : null;
  const statePhaseIsAheadOfRoadmap =
    roadmapSignals.currentPhase !== null &&
    existingState.currentPhase.length > 0 &&
    comparePhaseNumbers(existingState.currentPhase, roadmapSignals.currentPhase) > 0;
  const patchedPhaseRoutingOverride =
    patch.activeCommand !== undefined || patch.currentPhase !== undefined
      ? resolvePatchedPhaseRoutingOverride({
          activeCommand: patch.activeCommand ?? existingState.activeCommand,
          currentPhase:
            effectivePatchCurrentPhase ?? normalizeSelectedPhase(existingState.currentPhase),
          roadmapCurrentPhase: roadmapSignals.currentPhase
        })
      : null;
  const storedPhaseRoutingOverride =
    patch.activeCommand === undefined && patch.currentPhase === undefined
      ? resolveStoredPhaseRoutingOverride({
          activeCommand: existingState.activeCommand,
          currentPhase: normalizeSelectedPhase(existingState.currentPhase),
          nextAction: existingState.nextAction,
          roadmapCurrentPhase: roadmapSignals.currentPhase
        })
      : null;
  const milestoneEvidence = await inspectMilestoneEvidence(
    projectRoot,
    inspection.phases,
    roadmapSignals.phases
  );
  const qualityGateDebtPhase =
    patch.activeCommand === undefined && patch.currentPhase === undefined
      ? milestoneEvidence.qualityGateBlockingPhase
      : null;
  const currentPhase =
    qualityGateDebtPhase ??
    effectivePatchCurrentPhase ??
    patchedPhaseRoutingOverride ??
    storedPhaseRoutingOverride ??
    (statePhaseIsAheadOfRoadmap
      ? existingState.currentPhase
      : (roadmapSignals.currentPhase ?? existingState.currentPhase));
  const currentMilestone = roadmapSignals.currentMilestone ?? existingState.currentMilestone;

  if (
    requestedCurrentPhase !== null &&
    !requestedCurrentPhaseExists
  ) {
    warnings.push(
      `STATE.md refresh ignored the requested phase ${requestedCurrentPhase} because no matching phase directory exists under ${BLUEPRINT_DIR}/phases/.`
    );
  }

  if (
    effectivePatchCurrentPhase !== null &&
    roadmapSignals.currentPhase !== null &&
    effectivePatchCurrentPhase !== roadmapSignals.currentPhase
  ) {
    warnings.push(
      `STATE.md refresh used the requested phase ${effectivePatchCurrentPhase} instead of the roadmap current phase ${roadmapSignals.currentPhase}.`
    );
  }

  if (
    patchedPhaseRoutingOverride !== null &&
    roadmapSignals.currentPhase !== null
  ) {
    warnings.push(
      `STATE.md preserved selected phase ${patchedPhaseRoutingOverride} for ${patch.activeCommand ?? existingState.activeCommand} instead of the roadmap current phase ${roadmapSignals.currentPhase}.`
    );
  }

  if (
    storedPhaseRoutingOverride !== null &&
    roadmapSignals.currentPhase !== null
  ) {
    warnings.push(
      `STATE.md preserved selected phase ${storedPhaseRoutingOverride} from ${existingState.activeCommand} follow-up ${existingState.nextAction} instead of the roadmap current phase ${roadmapSignals.currentPhase}.`
    );
  }

  if (
    qualityGateDebtPhase !== null &&
    roadmapSignals.currentPhase !== null &&
    qualityGateDebtPhase !== roadmapSignals.currentPhase
  ) {
    warnings.push(
      `STATE.md routed back to completed Phase ${qualityGateDebtPhase} because unresolved quality gate debt blocks routing to roadmap phase ${roadmapSignals.currentPhase}.`
    );
  }

  if (
    effectivePatchCurrentPhase === null &&
    patchedPhaseRoutingOverride === null &&
    storedPhaseRoutingOverride === null &&
    statePhaseIsAheadOfRoadmap &&
    roadmapSignals.currentPhase !== null
  ) {
    warnings.push(
      `STATE.md is ahead of ROADMAP.md: current phase ${existingState.currentPhase} will be used instead of the stale roadmap phase ${roadmapSignals.currentPhase}.`
    );
  }

  const milestoneCompletionReportPath =
    currentMilestone === null
      ? null
      : buildBlueprintReportPath(`milestone-complete-${currentMilestone}`);
  const milestoneSummaryReportPath =
    currentMilestone === null
      ? null
      : buildBlueprintReportPath(`milestone-summary-${currentMilestone}`);
  const milestoneAuditReport = await inspectMilestoneAuditReportStatus({
    projectRoot,
    currentMilestone,
    reports: inspection.reports
  });
  const structuralBlockers = inspection.core.missing.map(
    (artifact) => `Missing ${artifact}`
  );
  const nonStructuralBlockers = existingState.blockers.filter(
    (blocker) =>
      !blocker.startsWith("Missing .blueprint/") &&
      !blocker.startsWith(PAUSE_HANDOFF_BLOCKER_PREFIX)
  );
  const currentPhaseArtifacts = await inspectCurrentPhaseArtifacts(
    projectRoot,
    inspection.phases,
    currentPhase
  );
  const bootstrapRouting: BootstrapRoutingSignals = {
    brownfieldDetected: bootstrapDiagnostics.brownfield.repoShape === "brownfield",
    codebaseMapped: bootstrapDiagnostics.brownfield.codebaseMapped
  };
  let workflowRouting: WorkflowRoutingSignals = {
    researchEnabled: true,
    uiPhaseEnabled: true
  };

  try {
    const effectiveConfig = await blueprintConfigGet({
      scope: "effective",
      cwd: projectRoot
    });
    workflowRouting = {
      researchEnabled: effectiveConfig.config.workflow.research,
      uiPhaseEnabled: effectiveConfig.config.workflow.ui_phase
    };
  } catch {
    // Keep the hard-coded Blueprint defaults when config cannot be read.
  }
  const blockers =
    projectStatus === "partial"
      ? [
          ...new Set([
            ...nonStructuralBlockers,
            ...structuralBlockers,
            ...currentPhaseArtifacts.blockers
          ])
        ]
      : [...new Set([...nonStructuralBlockers, ...currentPhaseArtifacts.blockers])];
  const activePauseHandoff =
    projectStatus === "initialized" &&
    isPauseHandoffActive(pauseHandoff.handoff, existingState);

  if (activePauseHandoff && pauseHandoff.path) {
    blockers.push(`${PAUSE_HANDOFF_BLOCKER_PREFIX}${pauseHandoff.path}.`);
  }

  warnings.push(...currentPhaseArtifacts.warnings);
  warnings.push(...milestoneEvidence.warnings);
  warnings.push(...pauseHandoff.warnings);

  return {
    state: {
      projectStatus,
      currentMilestone,
      currentPhase,
      activeCommand:
        projectStatus === "partial"
          ? blueprintDirectCommand("health")
          : activePauseHandoff
            ? PAUSE_WORK_COMMAND
            : existingState.activeCommand,
      nextAction:
        activePauseHandoff && pauseHandoff.handoff
          ? buildPauseHandoffNextAction(currentPhase, pauseHandoff.handoff)
          : await deriveNextAction({
              projectStatus,
              blockers,
              currentPhase,
              currentMilestone,
              allPhasesComplete: roadmapSignals.allPhasesComplete,
              milestoneAuditReport,
              hasMilestoneCompletion:
                milestoneCompletionReportPath !== null &&
                inspection.reports.includes(milestoneCompletionReportPath),
              hasMilestoneSummary:
                milestoneSummaryReportPath !== null &&
                inspection.reports.includes(milestoneSummaryReportPath),
              phaseArtifacts: currentPhaseArtifacts,
              milestoneEvidence,
              bootstrapRouting,
              workflow: workflowRouting
            }),
      blockers,
      roadmapEvolutionNotes: existingState.roadmapEvolutionNotes,
      lastUpdated: new Date().toISOString()
    },
    warnings,
    milestoneAuditReport
  };
}

export async function blueprintPauseHandoffGet(
  args: PauseHandoffGetArgs = {}
): Promise<PauseHandoffGetResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  return loadPauseHandoffReport(projectRoot);
}

export async function blueprintPauseHandoffWrite(
  args: PauseHandoffWriteArgs
): Promise<PauseHandoffWriteResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const inspection = await inspectBlueprintArtifacts(projectRoot);

  if (inspection.readiness !== "initialized") {
    throw new Error(
      "pause-work requires an initialized Blueprint project before a handoff can be written."
    );
  }

  const stateResult = await blueprintStateLoad({ cwd: projectRoot });
  const currentPhase = stateResult.derivedStatus.currentPhase ?? stateResult.state.currentPhase;
  const phasePrefix = currentPhase ? formatPhasePrefix(currentPhase) : null;
  const reportSnapshot = {
    core: inspection.core.present,
    phaseArtifacts:
      phasePrefix === null
        ? []
        : inspection.phases.filter((artifact) =>
            artifact.includes(`/${phasePrefix}`)
          ),
    reports: [...new Set([...inspection.reports, PAUSE_HANDOFF_REPORT_PATH])].sort(),
    missing: inspection.core.missing
  };
  const handoff: PauseHandoffRecord = {
    reportType: "pause-work",
    schemaVersion: 1,
    status: "paused",
    timestamp: new Date().toISOString(),
    projectStatus: stateResult.derivedStatus.projectStatus,
    currentMilestone: stateResult.state.currentMilestone,
    currentPhase,
    activeCommand: PAUSE_WORK_COMMAND,
    currentState: normalizeParagraph(args.currentState),
    completedWork: normalizeLines(args.completedWork),
    remainingWork: normalizeLines(args.remainingWork),
    decisions: normalizeLines(args.decisions),
    blockers: normalizeLines(args.blockers),
    humanActionsPending: normalizeLines(args.humanActionsPending),
    modifiedFiles: normalizeLines(args.modifiedFiles),
    contextNotes: normalizeParagraph(args.contextNotes),
    nextAction: normalizeParagraph(args.nextAction, stateResult.derivedStatus.nextAction),
    artifactSnapshot: reportSnapshot
  };
  const absolutePath = resolveBlueprintPath(projectRoot, PAUSE_HANDOFF_REPORT_PATH);
  const content = renderPauseHandoff(handoff);
  const exists = await blueprintPathExists(absolutePath);
  const warnings: string[] = [];

  if (exists) {
    const existingContent = await fs.readFile(absolutePath, "utf8");
    const existingHandoff = parsePauseHandoff(existingContent);

    if (
      JSON.stringify(comparablePauseHandoffRecord(existingHandoff)) ===
      JSON.stringify(comparablePauseHandoffRecord(handoff))
    ) {
      warnings.push("Preserved existing pause handoff because the content was unchanged.");

      return {
        path: PAUSE_HANDOFF_REPORT_PATH,
        written: false,
        created: false,
        overwritten: false,
        status: "reused",
        handoff: existingHandoff,
        warnings
      };
    }

    if (!(args.overwrite ?? false)) {
      throw new Error(
        `${PAUSE_HANDOFF_REPORT_PATH} already exists. Re-run only after explicit overwrite confirmation.`
      );
    }
  }

  warnings.push(
    ...await writeTextFile(absolutePath, content, {
      label: PAUSE_HANDOFF_REPORT_PATH
    })
  );

  if (exists) {
    warnings.push(`Replaced existing pause handoff: ${PAUSE_HANDOFF_REPORT_PATH}`);
  }

  return {
    path: PAUSE_HANDOFF_REPORT_PATH,
    written: true,
    created: !exists,
    overwritten: exists,
    status: exists ? "updated" : "created",
    handoff,
    warnings
  };
}

export async function loadBlueprintState(cwd?: string): Promise<BlueprintState> {
  const projectRoot = await ensureRepoRoot(cwd);
  const statePath = resolveBlueprintPath(projectRoot, BLUEPRINT_STATE_PATH);

  try {
    const raw = await fs.readFile(statePath, "utf8");
    return parseStateDocument(raw);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function blueprintStateLoad(
  args: StateLoadArgs = {}
): Promise<StateLoadResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const inspection = await inspectBlueprintArtifacts(projectRoot);
  const bootstrapDiagnostics = await inspectBootstrapArtifacts(projectRoot);
  const bootstrapRouting: BootstrapRoutingSignals = {
    brownfieldDetected: bootstrapDiagnostics.brownfield.repoShape === "brownfield",
    codebaseMapped: bootstrapDiagnostics.brownfield.codebaseMapped
  };
  const readOnlyBootstrapState =
    inspection.readiness === "uninitialized" ||
    inspection.readiness === "mapping-incomplete" ||
    inspection.readiness === "mapped-only";
  const syncedState =
    readOnlyBootstrapState
      ? null
      : await buildSyncedState(projectRoot);
  const state =
    readOnlyBootstrapState
      ? {
          ...(await loadBlueprintState(projectRoot)),
          projectStatus: inspection.readiness,
          currentPhase: "",
          activeCommand:
            inspection.readiness === "mapping-incomplete"
              ? blueprintDirectCommand("map-codebase")
              : inspection.readiness === "mapped-only"
                ? blueprintDirectCommand("new-project")
                : DEFAULT_STATE.activeCommand,
          nextAction: await deriveNextAction({
            projectStatus: inspection.readiness,
            blockers: [],
            currentPhase: null,
            currentMilestone: null,
            allPhasesComplete: false,
            milestoneAuditReport: emptyMilestoneAuditReportStatus(),
            hasMilestoneCompletion: false,
            hasMilestoneSummary: false,
            phaseArtifacts: await inspectCurrentPhaseArtifacts(projectRoot, inspection.phases, null),
            milestoneEvidence: {
              missingVerificationPhases: [],
              missingUatPhases: [],
              verificationNotReadyPhases: [],
              verificationTestGapPhases: [],
              verificationRepairActions: {},
              pendingSummaryCoveragePhases: [],
              missingQualityGatePhases: [],
              qualityGateDebtPhases: [],
              qualityGateRepairActions: {},
              qualityGateMissingGates: {},
              qualityGateReviewableFiles: {},
              blockingPhase: null,
              qualityGateBlockingPhase: null,
              allCompletedPhasesReady: false,
              warnings: []
            },
            bootstrapRouting,
            workflow: {
              researchEnabled: true,
              uiPhaseEnabled: true
            }
          })
        }
      : syncedState!.state;
  const currentPhase = readOnlyBootstrapState ? null : state.currentPhase;
  const blockers = state.blockers;
  const nextAction = state.nextAction;
  const milestoneAuditReport =
    readOnlyBootstrapState
      ? emptyMilestoneAuditReportStatus()
      : syncedState!.milestoneAuditReport;

  return {
    state,
    blockers,
    derivedStatus: {
      projectStatus: inspection.readiness,
      currentPhase,
      nextAction,
      hasBlockers: blockers.length > 0,
      milestoneAudit: milestoneAuditReport
    }
  };
}

export async function blueprintStateUpdate(
  args: StateUpdateArgs = {}
): Promise<StateUpdateResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const statePath = resolveBlueprintPath(projectRoot, BLUEPRINT_STATE_PATH);
  const useSyncedBase = args.base === "synced";
  const patch = args.patch ?? {};
  let normalizedPatchCurrentPhase: string | undefined;

  if (patch.currentPhase !== undefined) {
    const normalizedCurrentPhase = normalizeSelectedPhase(patch.currentPhase);

    if (normalizedCurrentPhase === null) {
      throw new Error(
        `STATE currentPhase patch must start with a numeric Blueprint phase reference: ${patch.currentPhase}`
      );
    }

    normalizedPatchCurrentPhase = normalizedCurrentPhase;
  }

  const normalizedPatch =
    normalizedPatchCurrentPhase === undefined
      ? patch
      : {
          ...patch,
          currentPhase: normalizedPatchCurrentPhase
        };
  const syncedBase = useSyncedBase
    ? await buildSyncedState(projectRoot)
    : null;
  const synced = useSyncedBase
    ? await buildSyncedState(projectRoot, {
        activeCommand: normalizedPatch.activeCommand,
        currentPhase: normalizedPatch.currentPhase
      })
    : null;
  const currentState =
    synced?.state ?? syncedBase?.state ?? (await loadBlueprintState(projectRoot));
  const comparisonState = syncedBase?.state ?? currentState;
  const sanitizedPatch =
    useSyncedBase &&
    normalizedPatch.currentPhase !== undefined &&
    normalizedPatch.nextAction === undefined &&
    currentState.currentPhase !== normalizedPatch.currentPhase
      ? {
          ...normalizedPatch,
          currentPhase: currentState.currentPhase
        }
      : normalizedPatch;
  const nextState: BlueprintState = {
    ...currentState,
    ...sanitizedPatch,
    blockers: sanitizedPatch.blockers ?? currentState.blockers,
    roadmapEvolutionNotes:
      sanitizedPatch.roadmapEvolutionNotes ?? currentState.roadmapEvolutionNotes,
    lastUpdated: sanitizedPatch.lastUpdated ?? new Date().toISOString()
  };
  const updatedFields = [
    ...new Set([
      ...Object.keys(sanitizedPatch),
      ...(sanitizedPatch.lastUpdated ? [] : ["lastUpdated"])
    ])
  ].filter((key) => {
    const field = key as keyof BlueprintState;
    return JSON.stringify(comparisonState[field]) !== JSON.stringify(nextState[field]);
  });

  const warnings = [...(synced?.warnings ?? [])];
  warnings.push(
    ...await writeTextFile(statePath, renderStateDocument(nextState), {
      label: BLUEPRINT_STATE_PATH
    })
  );

  return {
    updatedFields,
    statePath: toRepoRelativePath(projectRoot, statePath),
    warnings
  };
}

export async function blueprintStateSync(
  args: StateSyncArgs = {}
): Promise<StateSyncResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const statePath = resolveBlueprintPath(projectRoot, BLUEPRINT_STATE_PATH);
  const currentState = await loadBlueprintState(projectRoot);
  const synced = await buildSyncedState(projectRoot);
  const nextState = synced.state;
  const syncedFields = (Object.keys(nextState) as (keyof BlueprintState)[]).filter(
    (field) =>
      JSON.stringify(currentState[field]) !== JSON.stringify(nextState[field])
  );

  await writeTextFile(statePath, renderStateDocument(nextState), {
    label: BLUEPRINT_STATE_PATH
  });

  return {
    syncedFields,
    warnings: synced.warnings,
    statePath: toRepoRelativePath(projectRoot, statePath)
  };
}

export const stateToolDefinitions = [
  {
    name: "blueprint_state_load",
    description: "Load Blueprint STATE.md together with derived project status signals.",
    inputSchema: stateLoadInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintStateLoad(args as StateLoadArgs)
  },
  {
    name: "blueprint_state_update",
    description: "Patch Blueprint STATE.md deterministically and return the updated fields.",
    inputSchema: stateUpdateInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintStateUpdate(args as StateUpdateArgs)
  },
  {
    name: "blueprint_pause_handoff_get",
    description:
      "Read the latest Blueprint pause-work handoff report without mutating repo state.",
    inputSchema: pauseHandoffGetInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPauseHandoffGet(args as PauseHandoffGetArgs)
  },
  {
    name: "blueprint_pause_handoff_write",
    description:
      "Persist the latest Blueprint pause-work handoff report with overwrite protection.",
    inputSchema: pauseHandoffWriteInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPauseHandoffWrite(args as PauseHandoffWriteArgs)
  },
  {
    name: "blueprint_state_sync",
    description:
      "Rebuild Blueprint STATE.md from surviving state, roadmap, and artifact signals.",
    inputSchema: stateSyncInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintStateSync(args as StateSyncArgs)
  }
];
