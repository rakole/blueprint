import { promises as fs } from "node:fs";

import {
  ensureRepoRoot,
  isVerificationArtifactReadyForUat,
  readUatArtifactState,
  resolveBlueprintPath,
  validateStrictSummaryArtifactContent,
  validateUatArtifactContent,
  validateVerificationArtifactContent,
  writeTextFile
} from "./artifacts.js";
import { getPhasePlanImplementedCommandNames } from "./phase-command-actions.js";
import { blueprintConfigGet } from "./config.js";
import {
  asJsonObject,
  collectModelStringValues,
  createAjvValidator
} from "./phase-json-helpers.js";
import {
  validationArtifactPathFor,
  pathExists
} from "./phase-locations.js";
import {
  extractMarkdownHeading,
  normalizeTextContent,
  sectionToList
} from "./phase-markdown.js";
import {
  resolveLocatedPhaseForMutation,
  resolveLocatedPhaseForRead,
  toResolvedPhaseLocation,
  withFreshPhaseTopologyForMutation
} from "./phase-resolution.js";
import {
  collectReferencedValidatedSummaryPaths,
  collectValidatedSummaryPaths,
  completedSummaryRecords
} from "./phase-summary-inventory.js";
import {
  countPhaseValidationDiagnostics,
  formatPhaseValidationDiagnostic,
  phaseValidationDiagnostic,
  phaseValidationResidualDiagnostics,
  schemaDiagnosticFromPhaseValidationAjvError
} from "./phase-validation-diagnostics.js";
import {
  PHASE_VALIDATION_ALLOWED_VALUES,
  clonePhaseValidationAllowedValues,
  validationArtifactContract,
  validationArtifactContractId
} from "./phase-validation-contracts.js";
import {
  normalizeVerificationStructuredModel,
  renderUatContent,
  renderVerificationContent,
  uatPayloadIssues,
  verificationPayloadIssues,
  type PhaseUatStructuredModel,
  type PhaseValidationRenderArgs,
  type PhaseVerificationStructuredModel
} from "./phase-validation-rendering.js";
import {
  phaseUatModelSchemas,
  phaseVerificationModelSchemas
} from "./phase-validation-schemas.js";
import {
  phaseTopologyFingerprintFromLocation
} from "./phase-topology-lock.js";
import type {
  PhaseSummaryIndexResult,
  PhaseSummaryRecord,
  PhaseValidationAuthoringContextArgs,
  PhaseValidationAuthoringContextResult,
  PhaseValidationReadArgs,
  PhaseValidationReadResult,
  PhaseValidationRenderResult,
  PhaseValidationStandaloneValidateModelResult,
  PhaseValidationSummaryEvidence,
  PhaseValidationValidateModelArgs,
  PhaseValidationValidateModelResult,
  PhaseValidationWriteArgs,
  PhaseValidationWriteResult,
  PlanIndexArgs,
  ResolvedPhaseLocation
} from "./phase-tool-types.js";
import { extractBlueprintDirectCommands } from "./phase-command-actions.js";

export type PhaseValidationToolRuntimeDependencies = {
  readSummaryIndex: (args: PlanIndexArgs) => Promise<PhaseSummaryIndexResult>;
  syncRoadmapPhaseCompletion: (
    projectRoot: string,
    resolved: ResolvedPhaseLocation,
    options?: { noUat?: boolean }
  ) => Promise<string[]>;
};

export function trimPhaseValidationStandaloneValidateModelResult(
  validation: PhaseValidationValidateModelResult
): PhaseValidationStandaloneValidateModelResult {
  const {
    taskSchema: _taskSchema,
    normalizedModel: _normalizedModel,
    renderPreview: _renderPreview,
    ...trimmed
  } = validation;

  return trimmed;
}

async function validatePhaseValidationModelCommands(
  model: Record<string, unknown>,
  artifact: PhaseValidationWriteArgs["artifact"]
): Promise<string[]> {
  const commands = [
    ...new Set(
      collectModelStringValues(model).flatMap((value) => extractBlueprintDirectCommands(value))
    )
  ];

  if (commands.length === 0) {
    return [];
  }

  const implementedCommands = await getPhasePlanImplementedCommandNames();

  if (implementedCommands === null || implementedCommands.size === 0) {
    return [
      `Phase ${artifact} model Blueprint command references could not be checked because the implemented command catalog was unavailable.`
    ];
  }

  const nonImplementedCommands = commands.filter((command) => !implementedCommands.has(command));

  return nonImplementedCommands.length > 0
    ? [
        `Phase ${artifact} model references non-implemented Blueprint command(s): ${nonImplementedCommands.join(", ")}.`
      ]
    : [];
}

function resolvedPhaseFromValidationContext(
  context: PhaseValidationAuthoringContextResult
): ResolvedPhaseLocation | null {
  return context.phaseFound &&
    context.phaseNumber &&
    context.phasePrefix &&
    context.phaseName &&
    context.phaseDir
    ? {
        phaseNumber: context.phaseNumber,
        phasePrefix: context.phasePrefix,
        phaseName: context.phaseName,
        phaseDir: context.phaseDir
      }
    : null;
}

async function readWorkflowNoUat(projectRoot: string): Promise<boolean> {
  try {
    const config = await blueprintConfigGet({
      cwd: projectRoot,
      scope: "effective"
    });

    return config.config.workflow.no_uat === true;
  } catch {
    return false;
  }
}

function phaseValidationRoutingRules(phaseNumber: string | null, noUat = false): string[] {
  const phaseRef = phaseNumber ?? "<phase>";
  const passRoute = noUat
    ? "PASS verification must use Readiness: ready for UAT and route to /blu-progress because workflow.no_uat=true; /blu-verify-work remains manual only."
    : `PASS verification must use Readiness: ready for UAT and route to /blu-verify-work ${phaseRef}.`;

  return [
    passRoute,
    "PARTIAL or BLOCKED verification must use Readiness: not ready for UAT.",
    `Test-generation gaps route to /blu-add-tests ${phaseRef}; implementation or behavior gaps route to /blu-audit-fix ${phaseRef}.`,
    "UAT PASS is complete only when **Checkpoint:** is none; checkpointed UAT should route back to /blu-verify-work."
  ];
}

function normalizeSummaryEvidenceHeading(value: string): string {
  return value
    .replace(/\s+#+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractSummaryEvidenceSection(markdown: string, heading: string): string {
  const expectedHeading = normalizeSummaryEvidenceHeading(heading);
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let startIndex = -1;
  let startLevel = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);

    if (match && normalizeSummaryEvidenceHeading(match[2]) === expectedHeading) {
      startIndex = index + 1;
      startLevel = match[1].length;
      break;
    }
  }

  if (startIndex < 0) {
    return "";
  }

  let endIndex = lines.length;

  for (let index = startIndex; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+/);

    if (match && match[1].length <= startLevel) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex, endIndex).join("\n").trim();
}

function mergeSummarySections(content: string, headings: string[]): string[] {
  return headings.flatMap((heading) => sectionToList(extractSummaryEvidenceSection(content, heading)));
}

async function collectValidationAuthoringSummaryEvidence(
  projectRoot: string,
  summaries: PhaseSummaryRecord[],
  completedPlanIds: ReadonlySet<string>
): Promise<{
  summaryPaths: string[];
  evidence: PhaseValidationSummaryEvidence[];
  warnings: string[];
}> {
  const summaryPaths: string[] = [];
  const evidence: PhaseValidationSummaryEvidence[] = [];
  const warnings: string[] = [];

  for (const summary of completedSummaryRecords(summaries, completedPlanIds)) {
    const content = await fs.readFile(resolveBlueprintPath(projectRoot, summary.path), "utf8");
    const validation = validateStrictSummaryArtifactContent(content, {
      linkedPlanPath: summary.linkedPlanPath
    });

    if (!validation.valid) {
      warnings.push(
        `${summary.path}: summary artifact is invalid and does not count as completed execution evidence.`
      );
      warnings.push(...validation.issues.map((issue) => `${summary.path}: ${issue}`));
      warnings.push(...validation.warnings.map((warning) => `${summary.path}: ${warning}`));
      continue;
    }

    summaryPaths.push(summary.path);
    evidence.push({
      planId: summary.planId,
      path: summary.path,
      linkedPlanPath: summary.linkedPlanPath,
      status: "COMPLETED",
      title: extractMarkdownHeading(content) ?? summary.title,
      summary: summary.summary,
      outcome: mergeSummarySections(content, ["Outcome", "Result"]),
      changesMade: mergeSummarySections(content, ["Changes Made"]),
      verification: mergeSummarySections(content, ["Verification"]),
      followUps: mergeSummarySections(content, ["Follow-Ups", "Follow Ups"]),
      evidence: mergeSummarySections(content, ["Evidence"])
    });
  }

  return { summaryPaths, evidence, warnings };
}

async function validationPrerequisiteBlockers(
  projectRoot: string,
  resolved: ResolvedPhaseLocation,
  artifact: PhaseValidationWriteArgs["artifact"],
  summaryPaths: string[],
  deps: PhaseValidationToolRuntimeDependencies
): Promise<{
  blockers: string[];
  verification: PhaseValidationReadResult | null;
}> {
  const blockers: string[] = [];
  let verification: PhaseValidationReadResult | null = null;

  if (summaryPaths.length === 0) {
    blockers.push(
      `Phase ${resolved.phaseNumber} does not have any valid completed execution summaries.`
    );
  }

  if (artifact === "uat") {
    verification = await blueprintPhaseValidationRead({
      cwd: projectRoot,
      phase: resolved.phaseNumber,
      artifact: "verification"
    }, deps);

    if (!verification.found) {
      blockers.push(
        `Phase ${resolved.phaseNumber} must have a saved VERIFICATION artifact before UAT.`
      );
    } else if (!verification.validation?.valid) {
      blockers.push(
        `Phase ${resolved.phaseNumber} must have a valid VERIFICATION artifact before UAT.`
      );
    } else if (!verification.verificationReadyForUat) {
      blockers.push(
        `Phase ${resolved.phaseNumber} verification is valid but not ready for UAT.`
      );
    }
  }

  return { blockers, verification };
}

export async function blueprintPhaseValidationAuthoringContext(
  args: PhaseValidationAuthoringContextArgs,
  deps: PhaseValidationToolRuntimeDependencies
): Promise<PhaseValidationAuthoringContextResult> {
  const { projectRoot, located, resolved } = await resolveLocatedPhaseForRead(args);
  const contract = validationArtifactContract(args.artifact, resolved ?? undefined);
  const allowedValues = clonePhaseValidationAllowedValues();

  if (!resolved) {
    const reason = located.reason ?? "Phase could not be resolved for validation authoring.";

    return {
      status: "invalid",
      phaseFound: false,
      phaseNumber: null,
      phasePrefix: null,
      phaseName: null,
      phaseDir: null,
      artifact: args.artifact,
      path: null,
      contract,
      summaryPaths: [],
      summaryEvidence: [],
      existing: null,
      verification: null,
      prerequisiteBlockers: [reason],
      readyForDraft: false,
      schemaPath: null,
      baseSchema: null,
      taskSchema: null,
      allowedValues,
      routingRules: phaseValidationRoutingRules(null),
      warnings: [],
      reason
    };
  }

  const summaryIndex = await deps.readSummaryIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const noUat = await readWorkflowNoUat(projectRoot);
  const completedSummaryPlanIds = new Set(summaryIndex.completedPlans);
  const summaryEvidence = await collectValidationAuthoringSummaryEvidence(
    projectRoot,
    summaryIndex.summaries,
    completedSummaryPlanIds
  );
  const existing = await blueprintPhaseValidationRead({
    cwd: projectRoot,
    phase: resolved.phaseNumber,
    artifact: args.artifact
  }, deps);
  const prerequisites = await validationPrerequisiteBlockers(
    projectRoot,
    resolved,
    args.artifact,
    summaryEvidence.summaryPaths,
    deps
  );
  const verification = args.artifact === "verification" ? existing : prerequisites.verification;
  const modelSchemas =
    args.artifact === "verification"
      ? await phaseVerificationModelSchemas({
          contract,
          phaseNumber: resolved.phaseNumber,
          summaryPaths: summaryEvidence.summaryPaths,
          noUat
        })
      : await phaseUatModelSchemas({
          contract,
          phaseNumber: resolved.phaseNumber,
          summaryPaths: summaryEvidence.summaryPaths,
          verificationPath:
            prerequisites.verification?.found &&
            prerequisites.verification.validation?.valid &&
            prerequisites.verification.verificationReadyForUat
              ? prerequisites.verification.path
              : null
        });
  const readyForDraft = prerequisites.blockers.length === 0;

  return {
    status: readyForDraft ? "ready" : "invalid",
    phaseFound: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    artifact: args.artifact,
    path: validationArtifactPathFor(resolved, args.artifact),
    contract,
    summaryPaths: summaryEvidence.summaryPaths,
    summaryEvidence: summaryEvidence.evidence,
    existing,
    verification,
    prerequisiteBlockers: prerequisites.blockers,
    readyForDraft,
    schemaPath: modelSchemas.schemaPath,
    baseSchema: modelSchemas.baseSchema,
    taskSchema: modelSchemas.taskSchema,
    allowedValues,
    routingRules: phaseValidationRoutingRules(resolved.phaseNumber, noUat),
    warnings: summaryEvidence.warnings,
    reason: readyForDraft ? null : prerequisites.blockers.join(" ")
  };
}

export async function blueprintPhaseValidationValidateModel(
  args: PhaseValidationValidateModelArgs,
  deps: PhaseValidationToolRuntimeDependencies
): Promise<PhaseValidationValidateModelResult> {
  const context = await blueprintPhaseValidationAuthoringContext({
    cwd: args.cwd,
    phase: args.phase,
    artifact: args.artifact
  }, deps);
  const resolved = resolvedPhaseFromValidationContext(context);
  const diagnostics = context.prerequisiteBlockers.map((message) =>
    phaseValidationDiagnostic({
      source: "scope",
      path: "phase.summaryPaths",
      code: "scope.prerequisite_blocker",
      message,
      context: { phase: context.phaseNumber },
      suggestion:
        args.artifact === "verification"
          ? "Create valid completed execution summaries before authoring phase.verification evidence."
          : "Create valid completed execution summaries and ready verification evidence before authoring phase.uat evidence."
    })
  );
  const modelObject = asJsonObject(args.model);

  if (!modelObject) {
    diagnostics.push(
      phaseValidationDiagnostic({
        source: "schema",
        path: "model",
        code: "schema.type",
        message: `Phase ${args.artifact} model must be a JSON object.`,
        context: { receivedType: Array.isArray(args.model) ? "array" : typeof args.model },
        suggestion: "Return a JSON object that matches taskSchema."
      })
    );
  }

  if (!context.taskSchema) {
    diagnostics.push(
      phaseValidationDiagnostic({
        source: "scope",
        path: "taskSchema",
        code: "contract.missing_schema",
        message: `${validationArtifactContractId(args.artifact)} did not expose a runtime task schema.`,
        context: {},
        suggestion: `Read the live ${validationArtifactContractId(args.artifact)} contract and authoring context before writing.`
      })
    );
  }

  let normalizedModel: PhaseVerificationStructuredModel | PhaseUatStructuredModel | null = null;

  if (modelObject && context.taskSchema) {
    const validationModelObject =
      args.artifact === "verification"
        ? {
            ...modelObject,
            manualOrDeferredCoverage: modelObject.manualOrDeferredCoverage ?? [],
            gapClassification: modelObject.gapClassification ?? [],
            gapsFound: modelObject.gapsFound ?? [],
            suggestedRepairs: modelObject.suggestedRepairs ?? []
          }
        : modelObject;
    const validate = createAjvValidator().compile(context.taskSchema);
    const schemaValid = validate(validationModelObject);

    if (!schemaValid) {
      diagnostics.push(
        ...(validate.errors ?? []).map((error) =>
          schemaDiagnosticFromPhaseValidationAjvError(error, context.taskSchema!, modelObject)
        )
      );
    }

    diagnostics.push(
      ...phaseValidationResidualDiagnostics(
        validationModelObject,
        context.contract.modelContract,
        args.artifact
      )
    );

    for (const issue of await validatePhaseValidationModelCommands(validationModelObject, args.artifact)) {
      diagnostics.push(
        phaseValidationDiagnostic({
          source: "residual",
          path: "model",
          code: "content.non_implemented_command",
          message: issue,
          context: {},
          suggestion: "Use only implemented Blueprint command references from the task schema."
        })
      );
    }

    if (schemaValid) {
      normalizedModel =
        args.artifact === "verification"
          ? normalizeVerificationStructuredModel(
              validationModelObject as PhaseVerificationStructuredModel
            )
          : validationModelObject as PhaseUatStructuredModel;
    }
  }

  let renderPreview: string | null = null;
  const noUat =
    args.artifact === "verification" && resolved
      ? await readWorkflowNoUat(await ensureRepoRoot(args.cwd))
      : false;

  if (diagnostics.length === 0 && normalizedModel && resolved) {
    const rendered =
      args.artifact === "verification"
        ? renderVerificationContent(
            {
              cwd: args.cwd,
              phase: resolved.phaseNumber,
              artifact: "verification",
              ...(normalizedModel as PhaseVerificationStructuredModel)
            },
            resolved,
            context.summaryPaths,
            PHASE_VALIDATION_ALLOWED_VALUES.verification.readinessByGate
          )
        : renderUatContent(
            {
              cwd: args.cwd,
              phase: resolved.phaseNumber,
              artifact: "uat",
              ...(normalizedModel as PhaseUatStructuredModel)
            },
            resolved
          );
    const validation =
      args.artifact === "verification"
        ? validateVerificationArtifactContent(rendered, context.summaryPaths, { noUat })
        : validateUatArtifactContent(rendered, context.summaryPaths, {
            requireReadyVerificationEvidence: true
          });

    for (const issue of validation.issues) {
      diagnostics.push(
        phaseValidationDiagnostic({
          source: "markdown",
          path: "renderPreview",
          code: "markdown.invalid_render",
          message: issue,
          context: {},
          suggestion:
            `Repair the model so MCP-rendered Markdown satisfies the ${validationArtifactContractId(args.artifact)} artifact contract.`
        })
      );
    }

    if (validation.issues.length === 0) {
      renderPreview = rendered;
    }
  }

  return {
    status: diagnostics.length === 0 ? "valid" : "invalid",
    valid: diagnostics.length === 0,
    phase: resolved,
    artifact: args.artifact,
    path: context.path,
    schemaPath: context.schemaPath,
    taskSchema: context.taskSchema,
    diagnostics,
    diagnosticCounts: countPhaseValidationDiagnostics(diagnostics),
    normalizedModel: diagnostics.some((diagnostic) => diagnostic.source === "schema")
      ? null
      : normalizedModel,
    renderPreview,
    warnings: args.artifact === "verification" ? [] : context.warnings
  };
}

export async function blueprintPhaseValidationRender(
  args: PhaseValidationRenderArgs,
  deps: PhaseValidationToolRuntimeDependencies
): Promise<PhaseValidationRenderResult> {
  const { projectRoot, located, resolved } = await resolveLocatedPhaseForRead(args);

  if (!resolved) {
    const reason = located.reason ?? "Phase could not be resolved for validation rendering.";
    const validation = {
      valid: false,
      issues: [reason],
      warnings: [] as string[]
    };

    return {
      phaseFound: false,
      phaseNumber: null,
      phasePrefix: null,
      phaseName: null,
      phaseDir: null,
      artifact: args.artifact,
      path: null,
      content: "",
      validation,
      summaryPaths: [],
      referencedSummaryPaths: [],
      prerequisiteBlockers: [reason],
      readyToWrite: false,
      issues: [reason],
      warnings: []
    };
  }

  const summaryIndex = await deps.readSummaryIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const completedSummaryPlanIds = new Set(summaryIndex.completedPlans);
  const summaryEvidence = await collectValidationAuthoringSummaryEvidence(
    projectRoot,
    summaryIndex.summaries,
    completedSummaryPlanIds
  );
  const prerequisites = await validationPrerequisiteBlockers(
    projectRoot,
    resolved,
    args.artifact,
    summaryEvidence.summaryPaths,
    deps
  );
  const content =
    args.artifact === "verification"
      ? renderVerificationContent(
          args,
          resolved,
          summaryEvidence.summaryPaths,
          PHASE_VALIDATION_ALLOWED_VALUES.verification.readinessByGate
        )
      : renderUatContent(args, resolved);
  const referencedSummaryPaths = collectReferencedValidatedSummaryPaths(
    content,
    summaryIndex.summaries,
    completedSummaryPlanIds
  );
  const noUat = await readWorkflowNoUat(projectRoot);
  const validation =
    args.artifact === "verification"
      ? validateVerificationArtifactContent(content, summaryEvidence.summaryPaths, { noUat })
      : validateUatArtifactContent(content, summaryEvidence.summaryPaths, {
          requireReadyVerificationEvidence: true
        });
  const payloadIssues =
    args.artifact === "verification"
      ? verificationPayloadIssues(args)
      : uatPayloadIssues(args);
  const issues = [
    ...prerequisites.blockers,
    ...payloadIssues,
    ...validation.issues
  ];
  const warnings = [...summaryEvidence.warnings, ...validation.warnings];

  return {
    phaseFound: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    artifact: args.artifact,
    path: validationArtifactPathFor(resolved, args.artifact),
    content,
    validation,
    summaryPaths: summaryEvidence.summaryPaths,
    referencedSummaryPaths,
    prerequisiteBlockers: prerequisites.blockers,
    readyToWrite: issues.length === 0,
    issues,
    warnings
  };
}

export async function blueprintPhaseValidationRead(
  args: PhaseValidationReadArgs,
  deps: PhaseValidationToolRuntimeDependencies
): Promise<PhaseValidationReadResult> {
  const { projectRoot, located, resolved } = await resolveLocatedPhaseForRead(args);

  if (!resolved) {
    return {
      phaseFound: false,
      found: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      artifact: args.artifact,
      path: null,
      content: null,
      validation: null,
      verificationReadyForUat: false,
      uatStatus: null,
      resumeState: null,
      checkpoint: null,
      complete: false,
      summaryPaths: [],
      reason: located.reason
    };
  }

  const artifactPath = validationArtifactPathFor(resolved, args.artifact);
  const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);

  if (!(await pathExists(absolutePath))) {
    return {
      phaseFound: true,
      found: false,
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      artifact: args.artifact,
      path: artifactPath,
      content: null,
      validation: null,
      verificationReadyForUat: false,
      uatStatus: null,
      resumeState: null,
      checkpoint: null,
      complete: false,
      summaryPaths: [],
      reason: `${artifactPath} does not exist yet.`
    };
  }

  const content = await fs.readFile(absolutePath, "utf8");
  const summaryIndex = await deps.readSummaryIndex({
    cwd: projectRoot,
    phase: resolved.phaseNumber
  });
  const completedSummaryPlanIds = new Set(summaryIndex.completedPlans);
  const completedSummaries = completedSummaryRecords(
    summaryIndex.summaries,
    completedSummaryPlanIds
  );
  const { summaryPaths: completedSummaryPaths, warnings: completedSummaryWarnings } =
    await collectValidatedSummaryPaths(projectRoot, completedSummaries);
  const noUat = await readWorkflowNoUat(projectRoot);
  const validation =
    args.artifact === "verification"
      ? validateVerificationArtifactContent(content, completedSummaryPaths, { noUat })
      : validateUatArtifactContent(content, completedSummaryPaths, {
          requireReadyVerificationEvidence: true
        });
  const validationWithSummaryWarnings = {
    ...validation,
    warnings: [...completedSummaryWarnings, ...validation.warnings]
  };
  const uatState = args.artifact === "uat" ? readUatArtifactState(content) : null;
  const verificationReadyForUat =
    args.artifact === "verification" &&
    validationWithSummaryWarnings.valid &&
    completedSummaryPaths.length > 0
      ? isVerificationArtifactReadyForUat(content)
      : false;
  const complete =
    args.artifact === "verification"
      ? validationWithSummaryWarnings.valid && verificationReadyForUat
      : validationWithSummaryWarnings.valid && Boolean(uatState?.complete);

  return {
    phaseFound: true,
    found: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    artifact: args.artifact,
    path: artifactPath,
    content,
    validation: validationWithSummaryWarnings,
    verificationReadyForUat,
    uatStatus: uatState?.status ?? null,
    resumeState: uatState?.resumeState ?? null,
    checkpoint: uatState?.checkpoint ?? null,
    complete,
    summaryPaths: completedSummaryPaths,
    reason: null
  };
}

export async function blueprintPhaseValidationWrite(
  args: PhaseValidationWriteArgs,
  deps: PhaseValidationToolRuntimeDependencies
): Promise<PhaseValidationWriteResult> {
  const { projectRoot, resolved, matchedPhase } = await resolveLocatedPhaseForMutation(args);
  const expectedTopology = phaseTopologyFingerprintFromLocation(resolved, matchedPhase);
  const artifactPath = validationArtifactPathFor(resolved, args.artifact);
  const hasContent = args.content !== undefined;
  const hasModel = args.model !== undefined;

  if (hasContent === hasModel) {
    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      artifact: args.artifact,
      path: artifactPath,
      summaryPaths: [],
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      issues: [
        "Phase validation writes must supply exactly one of content or model."
      ],
      warnings: []
    };
  }

  if (args.authoringMode === "model-only" && hasContent) {
    return {
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      artifact: args.artifact,
      path: artifactPath,
      summaryPaths: [],
      written: false,
      created: false,
      overwritten: false,
      status: "invalid",
      issues: [
        "Phase validation model-only writes must supply the validated structured model, not Markdown content."
      ],
      warnings: []
    };
  }

  return withFreshPhaseTopologyForMutation(
    projectRoot,
    args,
    expectedTopology,
    "Phase validation write",
    async ({ resolved: refreshedResolved }) => {
      const refreshedArtifactPath = validationArtifactPathFor(refreshedResolved, args.artifact);
      const absolutePath = resolveBlueprintPath(projectRoot, refreshedArtifactPath);
      const summaryIndex = await deps.readSummaryIndex({
        cwd: projectRoot,
        phase: refreshedResolved.phaseNumber
      });

      if (!summaryIndex.phaseFound) {
        throw new Error(
          `Phase ${refreshedResolved.phaseNumber} could not be resolved for validation persistence.`
        );
      }

      const { summaryPaths, warnings: summaryWarnings } = await collectValidatedSummaryPaths(
        projectRoot,
        completedSummaryRecords(summaryIndex.summaries, new Set(summaryIndex.completedPlans))
      );
      const noUat = await readWorkflowNoUat(projectRoot);
      const artifactLabel = args.artifact === "verification" ? "verification" : "UAT";
      const shouldSurfaceWarnings = args.artifact !== "verification" || noUat;
      const warnings: string[] = shouldSurfaceWarnings ? [...summaryWarnings] : [];

      if (summaryPaths.length === 0) {
        throw new Error(
          `Phase ${refreshedResolved.phaseNumber} does not have any valid execution summaries yet. Run /blu-execute-phase ${refreshedResolved.phaseNumber} after fixing summary artifacts before writing ${artifactLabel} artifacts.`
        );
      }

      let normalizedContent: string;

      if (hasModel) {
        const modelValidation = await blueprintPhaseValidationValidateModel({
          cwd: projectRoot,
          phase: refreshedResolved.phaseNumber,
          artifact: args.artifact,
          model: args.model
        }, deps);

        if (!modelValidation.valid || !modelValidation.renderPreview) {
          return {
            phaseNumber: refreshedResolved.phaseNumber,
            phasePrefix: refreshedResolved.phasePrefix,
            phaseName: refreshedResolved.phaseName,
            phaseDir: refreshedResolved.phaseDir,
            artifact: args.artifact,
            path: refreshedArtifactPath,
            summaryPaths,
            written: false,
            created: false,
            overwritten: false,
            status: "invalid",
            issues: modelValidation.diagnostics.map(formatPhaseValidationDiagnostic),
            warnings: shouldSurfaceWarnings ? [...warnings, ...modelValidation.warnings] : []
          };
        }

        normalizedContent = normalizeTextContent(modelValidation.renderPreview);
      } else {
        normalizedContent = normalizeTextContent(args.content ?? "");
      }

      const exists = await pathExists(absolutePath);
      const validationSummaryPaths = summaryPaths;
      const validation =
        normalizedContent.trim().length === 0
          ? {
              valid: false,
              issues: [`${args.artifact} content must not be empty.`],
              warnings: [] as string[]
            }
          : args.artifact === "verification"
            ? validateVerificationArtifactContent(normalizedContent, summaryPaths, { noUat })
            : validateUatArtifactContent(normalizedContent, validationSummaryPaths, {
                requireReadyVerificationEvidence: true
              });

      if (args.artifact === "uat") {
        const verificationPath = validationArtifactPathFor(refreshedResolved, "verification");
        const verificationAbsolutePath = resolveBlueprintPath(projectRoot, verificationPath);

        if (!(await pathExists(verificationAbsolutePath))) {
          throw new Error(
            `Phase ${refreshedResolved.phaseNumber} must be validated before UAT. Run /blu-validate-phase ${refreshedResolved.phaseNumber} first.`
          );
        }

        const verificationContent = await fs.readFile(verificationAbsolutePath, "utf8");
        const verificationValidation = validateVerificationArtifactContent(
          verificationContent,
          summaryPaths,
          { noUat }
        );

        if (!verificationValidation.valid) {
          throw new Error(
            `Phase ${refreshedResolved.phaseNumber} must have a valid VERIFICATION artifact before UAT. Repair the verification evidence before writing ${artifactLabel} artifacts.`
          );
        }

        if (!isVerificationArtifactReadyForUat(verificationContent)) {
          throw new Error(
            `Phase ${refreshedResolved.phaseNumber} must have a VERIFICATION artifact that is ready for UAT before writing ${artifactLabel} artifacts. Repair the verification evidence before writing ${artifactLabel} artifacts.`
          );
        }
      }

      if (exists) {
        const existingContent = await fs.readFile(absolutePath, "utf8");
        const existingReferencedSummaryPaths = collectReferencedValidatedSummaryPaths(
          existingContent,
          summaryIndex.summaries,
          new Set(summaryIndex.completedPlans)
        );
        const existingValidation =
          args.artifact === "verification"
            ? validateVerificationArtifactContent(existingContent, existingReferencedSummaryPaths, {
                noUat
              })
            : validateUatArtifactContent(existingContent, validationSummaryPaths, {
                requireReadyVerificationEvidence: true
              });
        const existingUatState =
          args.artifact === "uat" ? readUatArtifactState(existingContent) : null;
        const nextUatState =
          args.artifact === "uat" ? readUatArtifactState(normalizedContent) : null;

        if (existingContent === normalizedContent) {
          if (!validation.valid) {
            return {
              phaseNumber: refreshedResolved.phaseNumber,
              phasePrefix: refreshedResolved.phasePrefix,
              phaseName: refreshedResolved.phaseName,
              phaseDir: refreshedResolved.phaseDir,
              artifact: args.artifact,
              path: refreshedArtifactPath,
              summaryPaths: validationSummaryPaths,
              written: false,
              created: false,
              overwritten: false,
              status: "invalid",
              issues: validation.issues,
              warnings: shouldSurfaceWarnings ? [...warnings, ...validation.warnings] : []
            };
          }

          if (shouldSurfaceWarnings) {
            warnings.push(`Preserved existing ${args.artifact} artifact because the content was unchanged.`);
          }
          if (args.artifact === "uat" || (args.artifact === "verification" && noUat)) {
            warnings.push(
              ...(await deps.syncRoadmapPhaseCompletion(projectRoot, refreshedResolved, { noUat }))
            );
          }

          return {
            phaseNumber: refreshedResolved.phaseNumber,
            phasePrefix: refreshedResolved.phasePrefix,
            phaseName: refreshedResolved.phaseName,
            phaseDir: refreshedResolved.phaseDir,
            artifact: args.artifact,
            path: refreshedArtifactPath,
            summaryPaths: validationSummaryPaths,
            written: false,
            created: false,
            overwritten: false,
            status: "reused",
            issues: validation.issues,
            warnings: shouldSurfaceWarnings ? [...warnings, ...validation.warnings] : []
          };
        }

        const resumableUatContinuation =
          args.artifact === "uat" &&
          existingValidation.valid &&
          existingUatState !== null &&
          !existingUatState.complete &&
          nextUatState !== null &&
          !nextUatState.complete &&
          nextUatState.resumeState !== "NEW";

        if (!(args.overwrite ?? false) && !resumableUatContinuation) {
          throw new Error(
            `${refreshedArtifactPath} already exists. Re-run only after explicit overwrite confirmation.`
          );
        }

        if (resumableUatContinuation) {
          warnings.push(
            `Continuing the existing incomplete UAT artifact at ${refreshedArtifactPath} without the replace path because the saved pass remains resumable.`
          );
        }
      }

      if (!validation.valid) {
        return {
          phaseNumber: refreshedResolved.phaseNumber,
          phasePrefix: refreshedResolved.phasePrefix,
          phaseName: refreshedResolved.phaseName,
          phaseDir: refreshedResolved.phaseDir,
          artifact: args.artifact,
          path: refreshedArtifactPath,
          summaryPaths: validationSummaryPaths,
          written: false,
          created: false,
          overwritten: false,
          status: "invalid",
          issues: validation.issues,
          warnings: [...warnings, ...validation.warnings]
        };
      }

      const persistenceWarnings = await writeTextFile(absolutePath, normalizedContent, {
        label: refreshedArtifactPath
      });
      if (shouldSurfaceWarnings) {
        warnings.push(...persistenceWarnings);
      }

      if (exists && shouldSurfaceWarnings) {
        warnings.push(`Replaced existing ${args.artifact} artifact: ${refreshedArtifactPath}`);
      }

      if (args.artifact === "uat" || (args.artifact === "verification" && noUat)) {
        warnings.push(
          ...(await deps.syncRoadmapPhaseCompletion(projectRoot, refreshedResolved, { noUat }))
        );
      }

      return {
        phaseNumber: refreshedResolved.phaseNumber,
        phasePrefix: refreshedResolved.phasePrefix,
        phaseName: refreshedResolved.phaseName,
        phaseDir: refreshedResolved.phaseDir,
        artifact: args.artifact,
        path: refreshedArtifactPath,
        summaryPaths: validationSummaryPaths,
        written: true,
        created: !exists,
        overwritten: exists,
        status: exists ? "updated" : "created",
        issues: validation.issues,
        warnings: shouldSurfaceWarnings ? [...warnings, ...validation.warnings] : []
      };
    }
  );
}
