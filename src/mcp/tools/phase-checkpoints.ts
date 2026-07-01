import { promises as fs } from "node:fs";

import {
  resolveBlueprintPath,
  withBlueprintRepoLock,
  writeJsonFile
} from "./artifacts.js";
import {
  PHASE_CHECKPOINT_OWNER_MODES,
  checkpointExpectedOwnerFromMode,
  checkpointOwnershipBlockerReason,
  ensureCheckpointForPersistence,
  ensureCheckpointObject,
  evaluateCheckpointResumeSafety
} from "./phase-checkpoint-records.js";
import {
  checkpointPathFor,
  pathExists
} from "./phase-locations.js";
import {
  resolveLocatedPhaseForMutation,
  resolvePhaseRuntimeSnapshot,
  withFreshPhaseTopologyForMutation
} from "./phase-resolution.js";
import {
  safeJsonParseObject
} from "../../shared/security.js";
import type {
  PhaseCheckpointDeleteArgs,
  PhaseCheckpointDeleteResult,
  PhaseCheckpointGetArgs,
  PhaseCheckpointGetResult,
  PhaseCheckpointPutArgs,
  PhaseCheckpointPutResult
} from "./phase-tool-types.js";
import {
  phaseTopologyFingerprintFromLocation
} from "./phase-topology-lock.js";

export async function blueprintPhaseCheckpointGet(
  args: PhaseCheckpointGetArgs = {}
): Promise<PhaseCheckpointGetResult> {
  const snapshot = await resolvePhaseRuntimeSnapshot(args);
  const { projectRoot, located, resolved } = snapshot;

  if (!resolved) {
    return {
      phaseFound: false,
      found: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      path: null,
      checkpoint: null,
      ownerCommand: null,
      resumeMode: null,
      safeToResume: false,
      warnings: [],
      reason: located.reason
    };
  }

  const checkpointPath = checkpointPathFor(resolved);
  const absolutePath = resolveBlueprintPath(projectRoot, checkpointPath);

  if (!(await pathExists(absolutePath))) {
    return {
      phaseFound: true,
      found: false,
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      path: checkpointPath,
      checkpoint: null,
      ownerCommand: null,
      resumeMode: null,
      safeToResume: false,
      warnings: [],
      reason: `${checkpointPath} does not exist.`
    };
  }

  const parsed = ensureCheckpointObject(
    safeJsonParseObject(await fs.readFile(absolutePath, "utf8"), {
      label: checkpointPath,
      maxBytes: 256 * 1024
    }),
    checkpointPath
  );
  const resumeSafety = evaluateCheckpointResumeSafety(
    parsed,
    checkpointPath,
    args.expectedOwnerCommand,
    args.expectedMode
  );

  return {
    phaseFound: true,
    found: true,
    phaseNumber: resolved.phaseNumber,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    path: checkpointPath,
    checkpoint: parsed,
    ownerCommand: resumeSafety.ownerCommand,
    resumeMode: resumeSafety.resumeMode,
    safeToResume: resumeSafety.safeToResume,
    warnings: resumeSafety.warnings,
    reason: null
  };
}

export async function blueprintPhaseCheckpointPut(
  args: PhaseCheckpointPutArgs
): Promise<PhaseCheckpointPutResult> {
  const { projectRoot, resolved, matchedPhase } = await resolveLocatedPhaseForMutation(args);
  const expectedTopology = phaseTopologyFingerprintFromLocation(resolved, matchedPhase);

  return withFreshPhaseTopologyForMutation(
    projectRoot,
    args,
    expectedTopology,
    "Phase checkpoint put",
    async ({ resolved }) => withBlueprintRepoLock(projectRoot, "phase-checkpoint", async () => {
      const checkpointPath = checkpointPathFor(resolved);
      const absolutePath = resolveBlueprintPath(projectRoot, checkpointPath);
      const nextCheckpoint = ensureCheckpointForPersistence(args.checkpoint, checkpointPath);
      const nextRaw = `${JSON.stringify(nextCheckpoint, null, 2)}\n`;
      const warnings: string[] = [];

      if (await pathExists(absolutePath)) {
        const existingRaw = await fs.readFile(absolutePath, "utf8");

        if (existingRaw === nextRaw) {
          warnings.push(`Preserved existing phase checkpoint because the content was unchanged.`);

          return {
            phaseNumber: resolved.phaseNumber,
            phasePrefix: resolved.phasePrefix,
            phaseName: resolved.phaseName,
            phaseDir: resolved.phaseDir,
            path: checkpointPath,
            updated: false,
            warnings
          };
        }

        const existingCheckpoint = ensureCheckpointObject(
          safeJsonParseObject(existingRaw, {
            label: checkpointPath,
            maxBytes: 256 * 1024
          }),
          checkpointPath
        );
        const ownershipSafety = evaluateCheckpointResumeSafety(
          existingCheckpoint,
          checkpointPath,
          args.checkpoint.ownerCommand,
          args.checkpoint.mode
        );

        if (!ownershipSafety.safeToResume) {
          throw new Error(
            checkpointOwnershipBlockerReason(
              checkpointPath,
              ownershipSafety.warnings,
              "overwrite"
            )
          );
        }

        warnings.push(...ownershipSafety.warnings);
      }

      await writeJsonFile(absolutePath, nextCheckpoint);

      return {
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        path: checkpointPath,
        updated: true,
        warnings
      };
    })
  );
}

export async function blueprintPhaseCheckpointDelete(
  args: PhaseCheckpointDeleteArgs = {}
): Promise<PhaseCheckpointDeleteResult> {
  const snapshot = await resolvePhaseRuntimeSnapshot(args);
  const { projectRoot, located, resolved, matchedPhase } = snapshot;

  if (!resolved) {
    return {
      phaseFound: false,
      phaseNumber: located.phaseNumber,
      phasePrefix: located.phasePrefix,
      phaseName: located.phaseName,
      phaseDir: located.phaseDir,
      path: null,
      deleted: false,
      reason: located.reason
    };
  }

  const expectedTopology = phaseTopologyFingerprintFromLocation(resolved, matchedPhase);

  if (!args.expectedOwnerCommand && !args.expectedMode) {
    const checkpointPath = checkpointPathFor(resolved);

    return {
      phaseFound: true,
      phaseNumber: resolved.phaseNumber,
      phasePrefix: resolved.phasePrefix,
      phaseName: resolved.phaseName,
      phaseDir: resolved.phaseDir,
      path: checkpointPath,
      deleted: false,
      reason: `Refusing to delete ${checkpointPath} without expectedOwnerCommand or expectedMode; shared checkpoint deletes must provide an ownership guard.`
    };
  }

  return withFreshPhaseTopologyForMutation(
    projectRoot,
    args,
    expectedTopology,
    "Phase checkpoint delete",
    async ({ resolved }) => withBlueprintRepoLock(projectRoot, "phase-checkpoint", async () => {
      const checkpointPath = checkpointPathFor(resolved);
      const absolutePath = resolveBlueprintPath(projectRoot, checkpointPath);

      if (!(await pathExists(absolutePath))) {
        return {
          phaseFound: true,
          phaseNumber: resolved.phaseNumber,
          phasePrefix: resolved.phasePrefix,
          phaseName: resolved.phaseName,
          phaseDir: resolved.phaseDir,
          path: checkpointPath,
          deleted: false,
          reason: `${checkpointPath} did not exist.`
        };
      }

      const parsed = ensureCheckpointObject(
        safeJsonParseObject(await fs.readFile(absolutePath, "utf8"), {
          label: checkpointPath,
          maxBytes: 256 * 1024
        }),
        checkpointPath
      );
      const expectedOwnerCommand =
        args.expectedOwnerCommand ?? checkpointExpectedOwnerFromMode(args.expectedMode ?? null);
      const expectedMode =
        args.expectedMode ??
        (expectedOwnerCommand ? PHASE_CHECKPOINT_OWNER_MODES[expectedOwnerCommand] : undefined);
      const ownershipSafety = evaluateCheckpointResumeSafety(
        parsed,
        checkpointPath,
        expectedOwnerCommand ?? undefined,
        expectedMode
      );

      if (!ownershipSafety.safeToResume) {
        return {
          phaseFound: true,
          phaseNumber: resolved.phaseNumber,
          phasePrefix: resolved.phasePrefix,
          phaseName: resolved.phaseName,
          phaseDir: resolved.phaseDir,
          path: checkpointPath,
          deleted: false,
          reason: checkpointOwnershipBlockerReason(
            checkpointPath,
            ownershipSafety.warnings,
            "delete"
          )
        };
      }

      await fs.rm(absolutePath, { force: true });

      return {
        phaseFound: true,
        phaseNumber: resolved.phaseNumber,
        phasePrefix: resolved.phasePrefix,
        phaseName: resolved.phaseName,
        phaseDir: resolved.phaseDir,
        path: checkpointPath,
        deleted: true,
        reason: null
      };
    })
  );
}
