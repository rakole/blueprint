import {
  readArtifactContract,
  type ArtifactContractReadResult
} from "../artifact-contracts/index.js";
import { type PhaseValidationArtifactKind } from "./phase-locations.js";

type PhaseValidationContractResolvedPhase = {
  phasePrefix: string;
  phaseName: string;
  phaseDir: string;
};

export type PhaseValidationAllowedValues = {
  verification: {
    gateStates: string[];
    coverageStates: string[];
    manualCoverageStatuses: string[];
    gapClasses: string[];
    readinessByGate: Record<string, string>;
    readyForUatCommand: string;
    repairCommands: string[];
  };
  uat: {
    statuses: string[];
    resumeStates: string[];
    completeCheckpoint: string;
    testResults: string[];
    structuredGapStatuses: string[];
    structuredGapSeverities: string[];
  };
};

export const PHASE_VALIDATION_ALLOWED_VALUES: PhaseValidationAllowedValues = {
  verification: {
    gateStates: ["PASS", "PARTIAL", "BLOCKED"],
    coverageStates: ["PASS", "COVERED", "covered", "MANUAL", "DEFERRED", "BLOCKED"],
    manualCoverageStatuses: ["MANUAL", "DEFERRED", "NONE"],
    gapClasses: [
      "missing-evidence",
      "partial-coverage",
      "manual-only",
      "deferred-test",
      "contradiction",
      "none"
    ],
    readinessByGate: {
      PASS: "ready for UAT",
      PARTIAL: "not ready for UAT",
      BLOCKED: "not ready for UAT"
    },
    readyForUatCommand: "/blu-verify-work",
    repairCommands: ["/blu-add-tests", "/blu-audit-fix"]
  },
  uat: {
    statuses: ["PASS", "FAIL", "PARTIAL"],
    resumeStates: ["RESUMED", "NEW", "CONTINUED"],
    completeCheckpoint: "none",
    testResults: ["pending", "pass", "issue", "skipped", "blocked"],
    structuredGapStatuses: ["failed", "partial", "blocked", "none"],
    structuredGapSeverities: ["blocker", "major", "minor", "cosmetic", "none"]
  }
};

export function clonePhaseValidationAllowedValues(): PhaseValidationAllowedValues {
  return {
    verification: {
      gateStates: [...PHASE_VALIDATION_ALLOWED_VALUES.verification.gateStates],
      coverageStates: [...PHASE_VALIDATION_ALLOWED_VALUES.verification.coverageStates],
      manualCoverageStatuses: [
        ...PHASE_VALIDATION_ALLOWED_VALUES.verification.manualCoverageStatuses
      ],
      gapClasses: [...PHASE_VALIDATION_ALLOWED_VALUES.verification.gapClasses],
      readinessByGate: {
        ...PHASE_VALIDATION_ALLOWED_VALUES.verification.readinessByGate
      },
      readyForUatCommand: PHASE_VALIDATION_ALLOWED_VALUES.verification.readyForUatCommand,
      repairCommands: [...PHASE_VALIDATION_ALLOWED_VALUES.verification.repairCommands]
    },
    uat: {
      statuses: [...PHASE_VALIDATION_ALLOWED_VALUES.uat.statuses],
      resumeStates: [...PHASE_VALIDATION_ALLOWED_VALUES.uat.resumeStates],
      completeCheckpoint: PHASE_VALIDATION_ALLOWED_VALUES.uat.completeCheckpoint,
      testResults: [...PHASE_VALIDATION_ALLOWED_VALUES.uat.testResults],
      structuredGapStatuses: [...PHASE_VALIDATION_ALLOWED_VALUES.uat.structuredGapStatuses],
      structuredGapSeverities: [...PHASE_VALIDATION_ALLOWED_VALUES.uat.structuredGapSeverities]
    }
  };
}

export function validationArtifactContractId(
  artifact: PhaseValidationArtifactKind
): "phase.verification" | "phase.uat" {
  return artifact === "verification" ? "phase.verification" : "phase.uat";
}

function validationArtifactContractContext(
  resolved?: PhaseValidationContractResolvedPhase
): {
  phaseLabel?: string;
  phasePrefix?: string;
  phaseName?: string;
  phaseDir?: string;
  summaryFile?: string;
  summaryPath?: string;
} {
  if (!resolved) {
    return {};
  }

  return {
    phaseLabel: `Phase ${resolved.phasePrefix}: ${resolved.phaseName}`,
    phasePrefix: resolved.phasePrefix,
    phaseName: resolved.phaseName,
    phaseDir: resolved.phaseDir,
    summaryFile: `${resolved.phasePrefix}-01-SUMMARY.md`,
    summaryPath: `${resolved.phaseDir}/${resolved.phasePrefix}-01-SUMMARY.md`
  };
}

export function validationArtifactContract(
  artifact: PhaseValidationArtifactKind,
  resolved?: PhaseValidationContractResolvedPhase
): ArtifactContractReadResult {
  return readArtifactContract(
    validationArtifactContractId(artifact),
    validationArtifactContractContext(resolved)
  );
}
