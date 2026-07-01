import { promises as fs } from "node:fs";

import {
  type PhaseArtifactValidationDiagnostic,
  blueprintArtifactScaffold,
  canonicalizeResearchHeadingLines,
  ensureRepoRoot,
  isScaffoldGeneratedArtifact,
  resolveBlueprintPath,
  validatePhaseArtifactContent,
  withBlueprintRepoLock,
  writeTextFile
} from "./artifacts.js";
import {
  renderPhaseContextModelContent,
  validatePhaseContextModelInput
} from "./phase-context-model.js";
import { artifactPathFor, materializePhaseDirectory, pathExists } from "./phase-locations.js";
import { normalizeTextContent } from "./phase-markdown.js";
import {
  assertFreshPhaseTopology,
  resolveLocatedPhaseForMutation,
  resolvePhaseRuntimeSnapshot,
  resolvePlannedContextScaffoldPhase,
  toResolvedPhaseLocation,
  withFreshPhaseTopologyForMutation
} from "./phase-resolution.js";
import { PHASE_TOPOLOGY_LOCK_NAME, phaseTopologyFingerprintFromLocation } from "./phase-topology-lock.js";
import type { PhaseArtifactKind } from "./phase-locations.js";
import type {
  PhaseArtifactReadArgs,
  PhaseArtifactReadResult,
  PhaseArtifactRetryPlan,
  PhaseArtifactScaffoldArgs,
  PhaseArtifactScaffoldResult,
  PhaseArtifactWriteArgs,
  PhaseArtifactWriteResult,
  PhaseUiSkipWriteArgs,
  ResolvedPhaseLocation
} from "./phase-tool-types.js";

export function isScaffoldGeneratedPhaseArtifact(content: string): boolean {
  return isScaffoldGeneratedArtifact(content);
}

export async function blueprintPhaseArtifactRead(
  args: PhaseArtifactReadArgs
): Promise<PhaseArtifactReadResult> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  const located = (await resolvePhaseRuntimeSnapshot(args)).located;
  const resolved = toResolvedPhaseLocation(located);

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
      reason: located.reason
    };
  }

  const artifactPath = artifactPathFor(resolved, args.artifact);
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
      reason: `${artifactPath} does not exist yet.`
    };
  }

  return {
    phaseFound: true,
    found: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    artifact: args.artifact,
    path: artifactPath,
    content: await fs.readFile(absolutePath, "utf8"),
    reason: null
  };
}

export async function blueprintPhaseArtifactScaffold(
  args: PhaseArtifactScaffoldArgs
): Promise<PhaseArtifactScaffoldResult> {
  const plannedContextScaffold = await resolvePlannedContextScaffoldPhase(args);
  if (plannedContextScaffold) {
    const { projectRoot, expectedTopology } = plannedContextScaffold;

    return withBlueprintRepoLock(projectRoot, PHASE_TOPOLOGY_LOCK_NAME, async () => {
      const latest = await resolvePlannedContextScaffoldPhase({ ...args, cwd: projectRoot });

      if (!latest) {
        throw new Error(
          "Phase artifact scaffold rejected stale planned phase topology before materializing context."
        );
      }

      assertFreshPhaseTopology({
        operation: "Phase artifact scaffold",
        expected: expectedTopology,
        resolved: latest.resolved,
        matchedPhase: latest.matchedPhase
      });

      const phaseDirState = await materializePhaseDirectory(projectRoot, latest.resolved.phaseDir);
      const artifactPath = artifactPathFor(latest.resolved, args.artifact);

      try {
        const scaffoldResult = await withBlueprintRepoLock(projectRoot, "phase-artifact-write", async () => {
          return blueprintArtifactScaffold({
            cwd: projectRoot,
            artifacts: [artifactPath],
            overwrite: args.overwrite
          });
        });

        return {
          phaseNumber: latest.resolved.phaseNumber,
          phasePrefix: latest.resolved.phasePrefix,
          phaseName: latest.resolved.phaseName,
          phaseDir: latest.resolved.phaseDir,
          artifact: args.artifact,
          path: artifactPath,
          createdFiles: scaffoldResult.createdFiles,
          reusedFiles: scaffoldResult.reusedFiles,
          warnings: [...phaseDirState.warnings, ...scaffoldResult.warnings]
        };
      } catch (error) {
        if (phaseDirState.created) {
          try {
            await fs.rm(phaseDirState.phaseDirPath, { recursive: true, force: true });
          } catch (rollbackError) {
            const reason = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
            const original = error instanceof Error ? error.message : String(error);

            throw new Error(
              `Phase artifact scaffold failed and rollback of ${latest.resolved.phaseDir} also failed: ${reason}. Original error: ${original}`
            );
          }
        }

        throw error;
      }
    });
  }

  const { projectRoot, resolved, matchedPhase } = await resolveLocatedPhaseForMutation(args);
  const expectedTopology = phaseTopologyFingerprintFromLocation(resolved, matchedPhase);

  return withFreshPhaseTopologyForMutation(
    projectRoot,
    args,
    expectedTopology,
    "Phase artifact scaffold",
    async ({ resolved }) => {
      const artifactPath = artifactPathFor(resolved, args.artifact);
      const scaffoldResult = await withBlueprintRepoLock(projectRoot, "phase-artifact-write", async () => {
        return blueprintArtifactScaffold({
          cwd: projectRoot,
          artifacts: [artifactPath],
          overwrite: args.overwrite
        });
      });

      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        artifact: args.artifact,
        path: artifactPath,
        createdFiles: scaffoldResult.createdFiles,
        reusedFiles: scaffoldResult.reusedFiles,
        warnings: scaffoldResult.warnings
      };
    }
  );
}

export function phaseArtifactSuggestedRepairs(
  artifact: PhaseArtifactKind,
  diagnostics: readonly PhaseArtifactValidationDiagnostic[]
): string[] {
  const errorDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity !== "warning");

  if (errorDiagnostics.length > 0) {
    return [...new Set(errorDiagnostics.map((diagnostic) => diagnostic.repair))];
  }

  if (artifact === "research") {
    return [
      "Add the required research sections, confidence marker, and at least one cited source before retrying."
    ];
  }

  if (artifact === "ui-spec") {
    return [
      "If Outcome Mode is `UI contract`, populate every missing required UI-contract section before retrying. If Outcome Mode is `Explicit skip rationale`, provide a non-empty `Rationale` instead."
    ];
  }

  if (artifact === "context") {
    return [
      "Add a real context artifact title, remove scaffold placeholders, and populate every required context section with substantive downstream-planning detail before retrying."
    ];
  }

  return [
    `Add a real ${artifact} artifact title, remove scaffold placeholders, and populate at least one contract section before retrying.`
  ];
}

export function phaseArtifactRetryPlan(
  artifact: PhaseArtifactKind,
  diagnostics: readonly PhaseArtifactValidationDiagnostic[]
): PhaseArtifactRetryPlan {
  const errorDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity !== "warning");
  const suggestedRepairs = phaseArtifactSuggestedRepairs(artifact, errorDiagnostics);
  const command =
    artifact === "context" || artifact === "discussion-log"
      ? "/blu-discuss-phase"
      : artifact === "research"
        ? "/blu-research-phase"
        : artifact === "spec"
          ? "/blu-spec-phase"
          : "/blu-ui-phase";

  return {
    retryable: errorDiagnostics.length === 0 || errorDiagnostics.every((diagnostic) => diagnostic.retryable),
    nextTool: "blueprint_phase_artifact_write",
    steps: [
      `Read blueprint_artifact_contract_read for phase.${artifact === "discussion-log" ? "discussion-log" : artifact}.`,
      ...suggestedRepairs,
      `Use ${command} orchestration or retry blueprint_phase_artifact_write with repaired content.`
    ]
  };
}

export function invalidPhaseArtifactWriteResult(args: {
  resolved: ResolvedPhaseLocation;
  artifact: PhaseArtifactKind;
  path: string;
  validation: ReturnType<typeof validatePhaseArtifactContent>;
  warnings: string[];
}): PhaseArtifactWriteResult {
  const suggestedRepairs = phaseArtifactSuggestedRepairs(args.artifact, args.validation.diagnostics);
  const retryPlan = phaseArtifactRetryPlan(args.artifact, args.validation.diagnostics);

  return {
    phaseNumber: args.resolved.phaseNumber,
    phasePrefix: args.resolved.phasePrefix,
    phaseName: args.resolved.phaseName,
    phaseDir: args.resolved.phaseDir,
    artifact: args.artifact,
    path: args.path,
    written: false,
    created: false,
    overwritten: false,
    status: "invalid",
    validation: {
      valid: false,
      issues: args.validation.issues,
      warnings: args.validation.warnings,
      suggestedRepairs,
      diagnostics: args.validation.diagnostics,
      retryPlan
    },
    diagnostics: args.validation.diagnostics,
    suggestedRepairs,
    retryPlan,
    warnings: [...args.warnings, ...args.validation.warnings]
  };
}

export function renderExplicitUiSkipArtifact(
  resolved: Pick<ResolvedPhaseLocation, "phasePrefix" | "phaseName">,
  skipRationale: string
): string {
  const title = resolved.phaseName
    ? `# Phase ${resolved.phasePrefix}: ${resolved.phaseName} - UI Spec`
    : `# Phase ${resolved.phasePrefix} - UI Spec`;

  return `${title}

## Outcome Mode

- Explicit skip rationale

## Rationale

${normalizeTextContent(skipRationale)}
`;
}

export async function blueprintPhaseArtifactWrite(
  args: PhaseArtifactWriteArgs
): Promise<PhaseArtifactWriteResult> {
  const { projectRoot, resolved, matchedPhase } = await resolveLocatedPhaseForMutation(args);
  const expectedTopology = phaseTopologyFingerprintFromLocation(resolved, matchedPhase);
  const artifactPath = artifactPathFor(resolved, args.artifact);
  const hasContent = args.content !== undefined;
  const hasModel = args.model !== undefined;

  if (hasContent === hasModel) {
    return invalidPhaseArtifactWriteResult({
      resolved,
      artifact: args.artifact,
      path: artifactPath,
      validation: {
        valid: false,
        issues: ["Phase artifact writes must supply exactly one of content or model."],
        warnings: [],
        diagnostics: [
          {
            path: "args",
            code: "write.exactly_one_input",
            message: "Phase artifact writes must supply exactly one of content or model.",
            repair: "Pass either finalized Markdown content for freehand phase artifacts or a structured model for phase.context, not both.",
            retryable: true,
            nextTool: "blueprint_phase_artifact_write"
          }
        ]
      },
      warnings: []
    });
  }

  if (hasModel && args.artifact !== "context") {
    return invalidPhaseArtifactWriteResult({
      resolved,
      artifact: args.artifact,
      path: artifactPath,
      validation: {
        valid: false,
        issues: [`phase.${args.artifact} does not support structured model writes. Supply canonical Markdown content instead.`],
        warnings: [],
        diagnostics: [
          {
            path: "args.model",
            code: "write.unsupported_model",
            message: `phase.${args.artifact} does not support structured model writes.`,
            repair: "Use Markdown content for this freehand phase artifact, or use artifact: \"context\" with a phase.context structured model.",
            retryable: true,
            nextTool: "blueprint_phase_artifact_write"
          }
        ]
      },
      warnings: []
    });
  }

  if (args.artifact === "context" && hasContent) {
    return invalidPhaseArtifactWriteResult({
      resolved,
      artifact: args.artifact,
      path: artifactPath,
      validation: {
        valid: false,
        issues: [
          "phase.context is model-only; Markdown content fallback is not supported."
        ],
        warnings: [],
        diagnostics: [
          {
            path: "args.content",
            code: "write.model_only",
            message: "phase.context is model-only; Markdown content fallback is not supported.",
            repair: "Remove content, pass the structured phase.context model, and let blueprint_phase_artifact_write render canonical Markdown.",
            retryable: true,
            nextTool: "blueprint_phase_artifact_write"
          }
        ]
      },
      warnings: []
    });
  }

  let normalizedContent: string;

  if (hasModel) {
    const modelValidation = validatePhaseContextModelInput(args.model);

    if (!modelValidation.model) {
      return invalidPhaseArtifactWriteResult({
        resolved,
        artifact: args.artifact,
        path: artifactPath,
        validation: modelValidation.validation,
        warnings: []
      });
    }

    normalizedContent = normalizeTextContent(
      renderPhaseContextModelContent({
        resolved,
        model: modelValidation.model
      })
    );
  } else {
    normalizedContent = normalizeTextContent(args.content ?? "");
  }

  if (args.artifact === "research") {
    normalizedContent = canonicalizeResearchHeadingLines(normalizedContent);
  }

  const validation = validatePhaseArtifactContent(normalizedContent, args.artifact);

  return withFreshPhaseTopologyForMutation(
    projectRoot,
    args,
    expectedTopology,
    "Phase artifact write",
    async ({ resolved }) => {
      const artifactPath = artifactPathFor(resolved, args.artifact);
      const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);

      return withBlueprintRepoLock(projectRoot, "phase-artifact-write", async () => {
        const exists = await pathExists(absolutePath);
        const warnings: string[] = [];

        if (exists) {
          const existingContent = await fs.readFile(absolutePath, "utf8");
          const existingValidation = validatePhaseArtifactContent(
            args.artifact === "research"
              ? canonicalizeResearchHeadingLines(normalizeTextContent(existingContent))
              : existingContent,
            args.artifact
          );

          if (existingContent === normalizedContent) {
            if (!validation.valid) {
              return invalidPhaseArtifactWriteResult({
                resolved,
                artifact: args.artifact,
                path: artifactPath,
                validation,
                warnings
              });
            }

            warnings.push(`Preserved existing ${args.artifact} artifact because the content was unchanged.`);

            return {
              phaseNumber: resolved.phaseNumber,
              phasePrefix: resolved.phasePrefix,
              phaseName: resolved.phaseName,
              phaseDir: resolved.phaseDir,
              artifact: args.artifact,
              path: artifactPath,
              written: false,
              created: false,
              overwritten: false,
              status: "reused",
              validation: {
                valid: validation.valid,
                issues: validation.issues,
                warnings: validation.warnings,
                suggestedRepairs: [],
                diagnostics: validation.diagnostics
              },
              warnings: [...warnings, ...validation.warnings]
            };
          }

          if (!(args.overwrite ?? false) && !isScaffoldGeneratedPhaseArtifact(existingContent)) {
            throw new Error(
              `${artifactPath} already exists. Re-run only after explicit overwrite confirmation.`
            );
          }

          if (!(args.overwrite ?? false) && !existingValidation.valid) {
            warnings.push(`Replacing the existing scaffold ${args.artifact} artifact with authored content.`);
          } else if (!(args.overwrite ?? false)) {
            throw new Error(
              `${artifactPath} already exists. Re-run only after explicit overwrite confirmation.`
            );
          }
        }

        if (!validation.valid && (args.validationMode ?? "strict") === "strict") {
          return invalidPhaseArtifactWriteResult({
            resolved,
            artifact: args.artifact,
            path: artifactPath,
            validation,
            warnings
          });
        }

        warnings.push(
          ...await writeTextFile(absolutePath, normalizedContent, {
            label: artifactPath
          })
        );

        if (exists) {
          warnings.push(`Replaced existing ${args.artifact} artifact: ${artifactPath}`);
        }

        return {
          phaseNumber: resolved.phaseNumber,
          phasePrefix: resolved.phasePrefix,
          phaseName: resolved.phaseName,
          phaseDir: resolved.phaseDir,
          artifact: args.artifact,
          path: artifactPath,
          written: true,
          created: !exists,
          overwritten: exists,
          status: exists ? "updated" : "created",
          validation: {
            valid: validation.valid,
            issues: validation.issues,
            warnings: validation.warnings,
            suggestedRepairs: [],
            diagnostics: validation.diagnostics
          },
          warnings: [...warnings, ...validation.warnings]
        };
      });
    }
  );
}

export async function blueprintPhaseUiSkipWrite(
  args: PhaseUiSkipWriteArgs
): Promise<PhaseArtifactWriteResult> {
  const { projectRoot, resolved, matchedPhase } = await resolveLocatedPhaseForMutation(args);
  const expectedTopology = phaseTopologyFingerprintFromLocation(resolved, matchedPhase);

  return withFreshPhaseTopologyForMutation(
    projectRoot,
    args,
    expectedTopology,
    "Phase UI skip write",
    async ({ resolved }) => {
      const artifactPath = artifactPathFor(resolved, "ui-spec");
      const absolutePath = resolveBlueprintPath(projectRoot, artifactPath);
      const normalizedContent = normalizeTextContent(
        renderExplicitUiSkipArtifact(resolved, args.skipRationale)
      );
      const validation = validatePhaseArtifactContent(normalizedContent, "ui-spec");

      return withBlueprintRepoLock(projectRoot, "phase-artifact-write", async () => {
        const exists = await pathExists(absolutePath);
        const warnings: string[] = [];

        if (exists) {
          const existingContent = await fs.readFile(absolutePath, "utf8");
          const existingValidation = validatePhaseArtifactContent(existingContent, "ui-spec");

          if (existingContent === normalizedContent) {
            if (!validation.valid) {
              return invalidPhaseArtifactWriteResult({
                resolved,
                artifact: "ui-spec",
                path: artifactPath,
                validation,
                warnings
              });
            }

            warnings.push("Preserved existing ui-spec artifact because the content was unchanged.");

            return {
              phaseNumber: resolved.phaseNumber,
              phasePrefix: resolved.phasePrefix,
              phaseName: resolved.phaseName,
              phaseDir: resolved.phaseDir,
              artifact: "ui-spec",
              path: artifactPath,
              written: false,
              created: false,
              overwritten: false,
              status: "reused",
              validation: {
                valid: validation.valid,
                issues: validation.issues,
                warnings: validation.warnings,
                suggestedRepairs: [],
                diagnostics: validation.diagnostics
              },
              warnings: [...warnings, ...validation.warnings]
            };
          }

          if (!(args.overwrite ?? false) && !isScaffoldGeneratedPhaseArtifact(existingContent)) {
            throw new Error(
              `${artifactPath} already exists. Re-run only after explicit overwrite confirmation.`
            );
          }

          if (!(args.overwrite ?? false) && !existingValidation.valid) {
            warnings.push("Replacing the existing scaffold ui-spec artifact with authored content.");
          } else if (!(args.overwrite ?? false)) {
            throw new Error(
              `${artifactPath} already exists. Re-run only after explicit overwrite confirmation.`
            );
          }
        }

        if (!validation.valid) {
          return invalidPhaseArtifactWriteResult({
            resolved,
            artifact: "ui-spec",
            path: artifactPath,
            validation,
            warnings
          });
        }

        warnings.push(
          ...await writeTextFile(absolutePath, normalizedContent, {
            label: artifactPath
          })
        );

        if (exists) {
          warnings.push(`Replaced existing ui-spec artifact: ${artifactPath}`);
        }

        return {
          phaseNumber: resolved.phaseNumber,
          phasePrefix: resolved.phasePrefix,
          phaseName: resolved.phaseName,
          phaseDir: resolved.phaseDir,
          artifact: "ui-spec",
          path: artifactPath,
          written: true,
          created: !exists,
          overwritten: exists,
          status: exists ? "updated" : "created",
          validation: {
            valid: validation.valid,
            issues: validation.issues,
            warnings: validation.warnings,
            suggestedRepairs: [],
            diagnostics: validation.diagnostics
          },
          warnings: [...warnings, ...validation.warnings]
        };
      });
    }
  );
}
