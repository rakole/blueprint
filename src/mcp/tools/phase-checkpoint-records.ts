import * as z from "zod/v4";

export type PhaseCheckpointRecord = Record<string, unknown>;

type PhaseCheckpointDecisionRecord = {
  topic: string;
  decision: string;
  rationale?: string;
};

type PhaseCheckpointDeferredIdeaRecord = {
  idea: string;
  reason?: string;
  revisitWhen?: string;
};

type PhaseCheckpointReferenceRecord = {
  label: string;
  target: string;
  note?: string;
};

export type PhaseCheckpointOwnerCommand =
  | "/blu-discuss-phase"
  | "/blu-research-phase";

export type PhaseCheckpointResumeMode = "discuss" | "research";

type PhaseCheckpointResumeMetaRecord = {
  mode: PhaseCheckpointResumeMode;
  pendingTopics: string[];
  completedTopics: string[];
  currentQuestion?: string;
  notes: string[];
  resumeHint?: string;
  updatedAt: string;
};

export type PhaseCheckpointWriteRecord = PhaseCheckpointRecord & {
  ownerCommand: PhaseCheckpointOwnerCommand;
  completedAreas: string[];
  remainingAreas: string[];
  decisions: PhaseCheckpointDecisionRecord[];
  deferredIdeas: PhaseCheckpointDeferredIdeaRecord[];
  canonicalReferences: PhaseCheckpointReferenceRecord[];
  resumeMeta: PhaseCheckpointResumeMetaRecord;
};

const PHASE_CHECKPOINT_OWNER_COMMANDS = [
  "/blu-discuss-phase",
  "/blu-research-phase"
] as const;
const PHASE_CHECKPOINT_RESUME_MODES = ["discuss", "research"] as const;

export const PHASE_CHECKPOINT_OWNER_MODES: Record<
  PhaseCheckpointOwnerCommand,
  PhaseCheckpointResumeMode
> = {
  "/blu-discuss-phase": "discuss",
  "/blu-research-phase": "research"
};

const phaseCheckpointDecisionSchema = z
  .object({
    topic: z.string().min(1),
    decision: z.string().min(1),
    rationale: z.string().min(1).optional()
  })
  .catchall(z.unknown());

const phaseCheckpointDeferredIdeaSchema = z
  .object({
    idea: z.string().min(1),
    reason: z.string().min(1).optional(),
    revisitWhen: z.string().min(1).optional()
  })
  .catchall(z.unknown());

const phaseCheckpointReferenceSchema = z
  .object({
    label: z.string().min(1),
    target: z.string().min(1),
    note: z.string().min(1).optional()
  })
  .catchall(z.unknown());

export const phaseCheckpointOwnerCommandSchema = z.enum(PHASE_CHECKPOINT_OWNER_COMMANDS);
export const phaseCheckpointResumeModeSchema = z.enum(PHASE_CHECKPOINT_RESUME_MODES);

const phaseCheckpointResumeMetaSchema = z
  .object({
    mode: phaseCheckpointResumeModeSchema,
    pendingTopics: z.array(z.string().min(1)),
    completedTopics: z.array(z.string().min(1)),
    currentQuestion: z.string().min(1).optional(),
    notes: z.array(z.string().min(1)),
    resumeHint: z.string().min(1).optional(),
    updatedAt: z.string().min(1)
  })
  .catchall(z.unknown());

export const phaseCheckpointWriteSchema = z
  .object({
    ownerCommand: phaseCheckpointOwnerCommandSchema,
    completedAreas: z.array(z.string().min(1)),
    remainingAreas: z.array(z.string().min(1)),
    decisions: z.array(phaseCheckpointDecisionSchema),
    deferredIdeas: z.array(phaseCheckpointDeferredIdeaSchema),
    canonicalReferences: z.array(phaseCheckpointReferenceSchema),
    resumeMeta: phaseCheckpointResumeMetaSchema
  })
  .catchall(z.unknown())
  .superRefine((value, context) => {
    const requiredSections = [
      "ownerCommand",
      "completedAreas",
      "remainingAreas",
      "decisions",
      "deferredIdeas",
      "canonicalReferences",
      "resumeMeta"
    ];

    if (!requiredSections.every((key) => key in value)) {
      context.addIssue({
        code: "custom",
        message:
          "Checkpoint writes must include ownerCommand, completedAreas, remainingAreas, decisions, deferredIdeas, canonicalReferences, and resumeMeta."
      });
    }

    const expectedMode = PHASE_CHECKPOINT_OWNER_MODES[value.ownerCommand];
    if (expectedMode && value.resumeMeta.mode !== expectedMode) {
      context.addIssue({
        code: "custom",
        path: ["resumeMeta", "mode"],
        message: `${value.ownerCommand} checkpoints must use resumeMeta.mode "${expectedMode}".`
      });
    }
  });

export function ensureCheckpointObject(
  checkpoint: unknown,
  checkpointPath: string
): PhaseCheckpointRecord {
  if (typeof checkpoint !== "object" || checkpoint === null || Array.isArray(checkpoint)) {
    throw new Error(`${checkpointPath} must contain a JSON object.`);
  }

  return checkpoint as PhaseCheckpointRecord;
}

export function ensureCheckpointForPersistence(
  checkpoint: unknown,
  checkpointPath: string
): PhaseCheckpointWriteRecord {
  const parsed = phaseCheckpointWriteSchema.safeParse(
    ensureCheckpointObject(checkpoint, checkpointPath)
  );

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`${checkpointPath} must contain a structured discuss checkpoint. ${issues}`);
  }

  return parsed.data as PhaseCheckpointWriteRecord;
}

function checkpointStringField(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function checkpointResumeMeta(record: Record<string, unknown>): Record<string, unknown> | null {
  const resumeMeta = record.resumeMeta;
  if (typeof resumeMeta !== "object" || resumeMeta === null || Array.isArray(resumeMeta)) {
    return null;
  }

  return resumeMeta as Record<string, unknown>;
}

function checkpointOwnerCommand(record: Record<string, unknown>): string | null {
  return checkpointStringField(record, "ownerCommand");
}

function checkpointResumeMode(record: Record<string, unknown>): string | null {
  return (
    checkpointStringField(checkpointResumeMeta(record) ?? {}, "mode") ??
    checkpointStringField(record, "mode")
  );
}

function isKnownCheckpointOwnerCommand(value: string | null): value is PhaseCheckpointOwnerCommand {
  return value !== null && PHASE_CHECKPOINT_OWNER_COMMANDS.includes(value as PhaseCheckpointOwnerCommand);
}

function isKnownCheckpointResumeMode(value: string | null): value is PhaseCheckpointResumeMode {
  return value !== null && PHASE_CHECKPOINT_RESUME_MODES.includes(value as PhaseCheckpointResumeMode);
}

export function checkpointExpectedOwnerFromMode(
  value: string | null
): PhaseCheckpointOwnerCommand | null {
  switch (value) {
    case "discuss":
      return "/blu-discuss-phase";
    case "research":
      return "/blu-research-phase";
    default:
      return null;
  }
}

export function checkpointOwnershipBlockerReason(
  checkpointPath: string,
  warnings: string[],
  action: "overwrite" | "delete"
): string {
  const details = warnings.join(" ");

  return `Refusing to ${action} ${checkpointPath} because ${details}`;
}

export function evaluateCheckpointResumeSafety(
  checkpoint: Record<string, unknown>,
  checkpointPath: string,
  expectedOwnerCommand?: PhaseCheckpointOwnerCommand,
  expectedMode?: PhaseCheckpointResumeMode
): {
  ownerCommand: string | null;
  resumeMode: string | null;
  safeToResume: boolean;
  warnings: string[];
} {
  const ownerCommand = checkpointOwnerCommand(checkpoint);
  const resumeMode = checkpointResumeMode(checkpoint);
  const warnings: string[] = [];

  if (!ownerCommand) {
    warnings.push(
      `${checkpointPath} does not declare ownerCommand; treating it as a legacy checkpoint.`
    );
  } else if (!isKnownCheckpointOwnerCommand(ownerCommand)) {
    warnings.push(`${checkpointPath} declares unknown ownerCommand "${ownerCommand}".`);
  }

  if (!resumeMode) {
    warnings.push(`${checkpointPath} does not declare a resumable mode.`);
  } else if (!isKnownCheckpointResumeMode(resumeMode)) {
    warnings.push(`${checkpointPath} declares unknown resumeMeta.mode "${resumeMode}".`);
  }

  if (
    isKnownCheckpointOwnerCommand(ownerCommand) &&
    isKnownCheckpointResumeMode(resumeMode) &&
    PHASE_CHECKPOINT_OWNER_MODES[ownerCommand] !== resumeMode
  ) {
    warnings.push(
      `${checkpointPath} ownerCommand "${ownerCommand}" does not match resumeMeta.mode "${resumeMode}".`
    );
  }

  if (expectedOwnerCommand && ownerCommand && ownerCommand !== expectedOwnerCommand) {
    warnings.push(
      `${checkpointPath} belongs to ${ownerCommand}, not ${expectedOwnerCommand}; do not resume it for this command.`
    );
  }

  if (expectedMode && resumeMode && resumeMode !== expectedMode) {
    warnings.push(
      `${checkpointPath} has resumeMeta.mode "${resumeMode}", not "${expectedMode}"; do not resume it for this command.`
    );
  }

  const hasForeignOwner = Boolean(expectedOwnerCommand && ownerCommand && ownerCommand !== expectedOwnerCommand);
  const hasForeignMode = Boolean(expectedMode && resumeMode && resumeMode !== expectedMode);
  const hasUnknownOwner = Boolean(ownerCommand && !isKnownCheckpointOwnerCommand(ownerCommand));
  const hasUnknownMode = Boolean(resumeMode && !isKnownCheckpointResumeMode(resumeMode));
  const missingExpectedMode = Boolean(expectedMode && !resumeMode);
  const ownerModeMismatch = Boolean(
    isKnownCheckpointOwnerCommand(ownerCommand) &&
      isKnownCheckpointResumeMode(resumeMode) &&
      PHASE_CHECKPOINT_OWNER_MODES[ownerCommand] !== resumeMode
  );

  return {
    ownerCommand,
    resumeMode,
    safeToResume:
      !hasForeignOwner &&
      !hasForeignMode &&
      !hasUnknownOwner &&
      !hasUnknownMode &&
      !missingExpectedMode &&
      !ownerModeMismatch,
    warnings
  };
}
