import * as z from "zod/v4";

export type PhaseCheckpointRecord = Record<string, unknown>;

export type PhaseCheckpointOwnerCommand =
  | "/blu-discuss-phase"
  | "/blu-research-phase";

export type PhaseCheckpointResumeMode = "discuss" | "research";

export type PhaseCheckpointWriteRecord = PhaseCheckpointRecord & {
  schemaVersion: 2;
  ownerCommand: PhaseCheckpointOwnerCommand;
  mode: PhaseCheckpointResumeMode;
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

const phaseCheckpointAreaSchema = z
  .object({
    areaId: z.string().min(1),
    title: z.string().min(1),
    state: z.enum(["questioning", "assumed", "decided", "blocked", "needs-revisit", "unseen"]),
    decisionIds: z.array(z.string().min(1)).optional(),
    evidenceRefs: z.array(z.string().min(1)).optional(),
    downstreamConsumers: z.array(z.string().min(1)).optional(),
    currentQuestion: z.string().min(1).optional(),
    questionWhyItMatters: z.string().min(1).optional(),
    lastUserAnswer: z.unknown().optional(),
    blockingReason: z.string().min(1).optional(),
    resolutionCriterion: z.string().min(1).optional()
  })
  .catchall(z.unknown());

const checkpointProgressSchema = z.object({}).catchall(z.unknown());
const checkpointCarryForwardSchema = z.object({}).catchall(z.unknown());
const checkpointReadSetSchema = z.array(z.unknown());
const researchLedgerSchema = z
  .object({
    schemaVersion: z.literal("research-ledger/v1"),
    strands: z.array(z.object({}).catchall(z.unknown()))
  })
  .catchall(z.unknown());

export const phaseCheckpointOwnerCommandSchema = z.enum(PHASE_CHECKPOINT_OWNER_COMMANDS);
export const phaseCheckpointResumeModeSchema = z.enum(PHASE_CHECKPOINT_RESUME_MODES);

const phaseCheckpointBaseSchema = z.object({
  schemaVersion: z.literal(2),
  ownerCommand: phaseCheckpointOwnerCommandSchema,
  mode: phaseCheckpointResumeModeSchema
});

const discussCheckpointWriteSchema = phaseCheckpointBaseSchema
  .extend({
    ownerCommand: z.literal("/blu-discuss-phase"),
    mode: z.literal("discuss"),
    progress: checkpointProgressSchema,
    areaQueue: z.array(phaseCheckpointAreaSchema),
    carryForward: checkpointCarryForwardSchema,
    readSet: checkpointReadSetSchema
  })
  .catchall(z.unknown());

const researchCheckpointWriteSchema = phaseCheckpointBaseSchema
  .extend({
    ownerCommand: z.literal("/blu-research-phase"),
    mode: z.literal("research"),
    researchLedger: researchLedgerSchema
  })
  .catchall(z.unknown());

export const phaseCheckpointWriteSchema = z.union([
  discussCheckpointWriteSchema,
  researchCheckpointWriteSchema
]);

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
    throw new Error(
      `${checkpointPath} must contain a structured checkpoint v2 object. ${issues}`
    );
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

function checkpointOwnerCommand(record: Record<string, unknown>): string | null {
  return checkpointStringField(record, "ownerCommand");
}

function checkpointResumeMode(record: Record<string, unknown>): string | null {
  const topLevelMode = checkpointStringField(record, "mode");

  if (topLevelMode) {
    return topLevelMode;
  }

  const resumeMeta = record.resumeMeta;

  if (typeof resumeMeta !== "object" || resumeMeta === null || Array.isArray(resumeMeta)) {
    return null;
  }

  return checkpointStringField(resumeMeta as Record<string, unknown>, "mode");
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
  const parsed = phaseCheckpointWriteSchema.safeParse(checkpoint);
  const warnings: string[] = [];

  if (!parsed.success) {
    warnings.push(
      `${checkpointPath} is not a valid checkpoint v2 object; treating it as non-resumable evidence.`
    );
  }

  if (!ownerCommand) {
    warnings.push(
      `${checkpointPath} does not declare ownerCommand; treating it as non-resumable legacy checkpoint evidence.`
    );
  } else if (!isKnownCheckpointOwnerCommand(ownerCommand)) {
    warnings.push(`${checkpointPath} declares unknown ownerCommand "${ownerCommand}".`);
  }

  if (!resumeMode) {
    warnings.push(`${checkpointPath} does not declare a resumable mode.`);
  } else if (!isKnownCheckpointResumeMode(resumeMode)) {
    warnings.push(`${checkpointPath} declares unknown mode "${resumeMode}".`);
  }

  if (
    isKnownCheckpointOwnerCommand(ownerCommand) &&
    isKnownCheckpointResumeMode(resumeMode) &&
    PHASE_CHECKPOINT_OWNER_MODES[ownerCommand] !== resumeMode
  ) {
    warnings.push(
      `${checkpointPath} ownerCommand "${ownerCommand}" does not match mode "${resumeMode}".`
    );
  }

  if (expectedOwnerCommand && ownerCommand && ownerCommand !== expectedOwnerCommand) {
    warnings.push(
      `${checkpointPath} belongs to ${ownerCommand}, not ${expectedOwnerCommand}; do not resume it for this command.`
    );
  }

  if (expectedMode && resumeMode && resumeMode !== expectedMode) {
    warnings.push(
      `${checkpointPath} has mode "${resumeMode}", not "${expectedMode}"; do not resume it for this command.`
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
      parsed.success &&
      !hasForeignOwner &&
      !hasForeignMode &&
      !hasUnknownOwner &&
      !hasUnknownMode &&
      !missingExpectedMode &&
      !ownerModeMismatch,
    warnings
  };
}
