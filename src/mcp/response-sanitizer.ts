import path from "node:path";

import type { ToolResult } from "./tool-types.js";
import {
  areEquivalentJsonValues,
  asRecord,
  getBoolean,
  getNextAction,
  getString
} from "./tool-result-utils.js";

const IMPACT_CONFIG_SUCCESS_WARNING =
  "Impact config loaded successfully through the Phase 3 config resolver.";

const IMPACT_ANALYZE_DUPLICATE_REPORT_KEYS = [
  "impactId",
  "status",
  "impactStatus",
  "risk",
  "confidence",
  "surfaces",
  "areaSummary",
  "surfaceSummary",
  "ownership",
  "dependencyGraph",
  "findings",
  "obligations",
  "unknowns",
  "evidence"
] as const;

function shouldTrimMatchedEntryIds(result: ToolResult): boolean {
  const entries = result.entries;
  const matchedEntryIds = result.matchedEntryIds;

  if (!Array.isArray(entries) || !Array.isArray(matchedEntryIds)) {
    return false;
  }

  const entryIds = entries.map((entry) => asRecord(entry)?.id);

  if (entryIds.some((entryId) => typeof entryId !== "string")) {
    return false;
  }

  return areEquivalentJsonValues(entryIds, matchedEntryIds);
}

function shouldTrimSelectedBacklogIds(result: ToolResult): boolean {
  if (getString(result, "status") !== "updated") {
    return false;
  }

  const selectedBacklogIds = result.selectedBacklogIds;
  const promotedItems = result.promotedItems;

  if (!Array.isArray(selectedBacklogIds) || !Array.isArray(promotedItems)) {
    return false;
  }

  const promotedBacklogIds = promotedItems.map((item) => asRecord(item)?.backlogId);

  if (promotedBacklogIds.some((backlogId) => typeof backlogId !== "string")) {
    return false;
  }

  return areEquivalentJsonValues(promotedBacklogIds, selectedBacklogIds);
}

function shouldTrimCreatedPhaseDirs(result: ToolResult): boolean {
  if (getString(result, "status") !== "updated") {
    return false;
  }

  const createdPhaseDirs = result.createdPhaseDirs;
  const promotedItems = result.promotedItems;

  if (!Array.isArray(createdPhaseDirs) || !Array.isArray(promotedItems)) {
    return false;
  }

  const promotedCreatedPhaseDirs = promotedItems
    .filter((item) => asRecord(item)?.createdPhaseDir === true)
    .map((item) => asRecord(item)?.phaseDir);

  if (promotedCreatedPhaseDirs.some((phaseDir) => typeof phaseDir !== "string")) {
    return false;
  }

  return areEquivalentJsonValues(promotedCreatedPhaseDirs, createdPhaseDirs);
}

function shouldTrimRoadmapPhaseSlug(toolName: string, result: ToolResult): boolean {
  if (
    toolName !== "blueprint_roadmap_add_phase" &&
    toolName !== "blueprint_roadmap_insert_phase"
  ) {
    return false;
  }

  if (getBoolean(result, "written") !== true) {
    return false;
  }

  const slug = getString(result, "slug");
  const phaseName = getString(result, "phaseName");
  const phaseDir = getString(result, "phaseDir");

  if (!slug || !phaseName || !phaseDir) {
    return false;
  }

  const phaseDirBaseName = phaseDir.split("/").at(-1);

  if (!phaseDirBaseName) {
    return false;
  }

  const phaseDirSlug = phaseDirBaseName.replace(/^\d+(?:\.\d+)?-/, "");

  return phaseDirSlug.length > 0 && phaseDirSlug === slug;
}

function shouldTrimUpdatePlanPath(result: ToolResult): boolean {
  const pathValue = getString(result, "path");
  const savedPaths = asRecord(result.savedPaths);
  const metadataPath = typeof savedPaths?.metadataPath === "string"
    ? savedPaths.metadataPath
    : null;

  return pathValue !== null && metadataPath !== null && pathValue === metadataPath;
}

function trimRedundantInstallProvenanceSource(result: ToolResult): ToolResult {
  const extensionPath = getString(result, "extensionPath");
  const installProvenance = asRecord(result.installProvenance);
  const source = typeof installProvenance?.source === "string"
    ? installProvenance.source
    : null;

  if (extensionPath === null || installProvenance === null || source !== extensionPath) {
    return result;
  }

  const { source: _source, ...trimmedInstallProvenance } = installProvenance;

  return {
    ...result,
    installProvenance: trimmedInstallProvenance
  };
}

function trimUpdatePlanPublicFields(result: ToolResult): ToolResult {
  const { extensionManifestPath: _extensionManifestPath, ...manifestTrimmedResult } = result;
  const provenanceTrimmedResult = trimRedundantInstallProvenanceSource(manifestTrimmedResult);
  let trimmedResult = provenanceTrimmedResult;

  const savedPaths = asRecord(trimmedResult.savedPaths);
  const updatesDir = typeof savedPaths?.updatesDir === "string"
    ? savedPaths.updatesDir
    : null;
  const metadataPath = typeof savedPaths?.metadataPath === "string"
    ? savedPaths.metadataPath
    : null;
  const checklistPath = typeof savedPaths?.checklistPath === "string"
    ? savedPaths.checklistPath
    : null;
  const shouldTrimUpdatesDir = (
    updatesDir !== null &&
    metadataPath !== null &&
    checklistPath !== null &&
    path.dirname(metadataPath) === updatesDir &&
    path.dirname(checklistPath) === updatesDir
  );

  if (shouldTrimUpdatesDir && savedPaths !== null) {
    const { updatesDir: _updatesDir, ...trimmedSavedPaths } = savedPaths;

    trimmedResult = {
      ...trimmedResult,
      savedPaths: trimmedSavedPaths,
    };
  }

  if (shouldTrimUpdatePlanPath(trimmedResult)) {
    const { path: _path, ...pathTrimmedResult } = trimmedResult;

    return pathTrimmedResult;
  }

  return trimmedResult;
}

function trimTopLevelStatePath(result: ToolResult): ToolResult {
  const { statePath: _statePath, ...trimmedResult } = result;

  return trimmedResult;
}

function trimEmptyTopLevelWarnings(result: ToolResult): ToolResult {
  if (!Array.isArray(result.warnings) || result.warnings.length !== 0) {
    return result;
  }

  const { warnings: _warnings, ...trimmedResult } = result;

  return trimmedResult;
}

function trimRedundantConfigGetSourcePath(result: ToolResult): ToolResult {
  const sourcePath = getString(result, "sourcePath");
  const provenance = asRecord(result.provenance);
  const defaultsPath = typeof provenance?.defaultsPath === "string"
    ? provenance.defaultsPath
    : null;
  const projectPath = typeof provenance?.projectPath === "string"
    ? provenance.projectPath
    : null;

  if (sourcePath === null || (sourcePath !== defaultsPath && sourcePath !== projectPath)) {
    return result;
  }

  const { sourcePath: _sourcePath, ...trimmedResult } = result;

  return trimmedResult;
}

function trimEmptyTopLevelArrayFields(
  result: ToolResult,
  keys: readonly string[]
): ToolResult {
  let trimmedResult: ToolResult = result;

  for (const key of keys) {
    const value = trimmedResult[key];

    if (!Array.isArray(value) || value.length !== 0) {
      continue;
    }

    const { [key]: _trimmedField, ...nextTrimmedResult } = trimmedResult;
    trimmedResult = nextTrimmedResult;
  }

  return trimmedResult;
}

function trimReadinessArtifactBodies(value: unknown): Record<string, unknown> | undefined {
  const bodies = asRecord(value);

  if (!bodies) {
    return undefined;
  }

  const trimmedBodies: Record<string, unknown> = {};

  for (const [key, bodyValue] of Object.entries(bodies)) {
    const body = asRecord(bodyValue);

    if (!body) {
      trimmedBodies[key] = bodyValue;
      continue;
    }

    if (body.omittedReason && typeof body.content === "string") {
      const { content: _content, ...trimmedBody } = body;
      trimmedBodies[key] = trimmedBody;
      continue;
    }

    trimmedBodies[key] = body;
  }

  return trimmedBodies;
}

function trimPhasePlanReadinessPublicFields(result: ToolResult): ToolResult {
  const validationEvidence = asRecord(result.validationEvidence);
  const trimmedValidationEvidence = validationEvidence
    ? validationEvidence.found === true
      ? result.validationEvidence
      : (({
          content: _content,
          ...trimmed
        }) => trimmed)(validationEvidence)
    : result.validationEvidence;

  return trimEmptyTopLevelWarnings({
    status: result.status,
    phaseSelection: result.phaseSelection,
    context: result.context,
    researchStatus: result.researchStatus,
    planIndex: result.planIndex,
    authoringContext: result.authoringContext,
    effectiveConfig: result.effectiveConfig,
    stateSnapshot: result.stateSnapshot,
    contract: result.contract,
    artifactBodies: trimReadinessArtifactBodies(result.artifactBodies),
    validationEvidence: trimmedValidationEvidence,
    reviewFindings: result.reviewFindings,
    savedPlanBodies: result.savedPlanBodies,
    readSet: result.readSet,
    freshness: result.freshness,
    nextSafeAction: result.nextSafeAction,
    warnings: result.warnings
  });
}

function trimRoadmapReadPublicFields(result: ToolResult): ToolResult {
  let trimmedResult = trimEmptyTopLevelArrayFields(result, [
    "warnings",
    "recovery"
  ]);
  const roadmap = asRecord(trimmedResult.roadmap);
  const phases = trimmedResult.phases;

  if (!roadmap || !Array.isArray(phases) || roadmap.phaseCount !== phases.length) {
    return trimmedResult;
  }

  const { phaseCount: _phaseCount, ...trimmedRoadmap } = roadmap;

  trimmedResult = {
    ...trimmedResult,
    roadmap: trimmedRoadmap
  };

  return trimmedResult;
}

function trimPhaseLocatePublicFields(result: ToolResult): ToolResult {
  return trimEmptyTopLevelArrayFields(result, [
    "warnings",
    "recovery"
  ]);
}

function shouldTrimPhasePlanIndexWaves(result: ToolResult): boolean {
  const plans = result.plans;
  const waves = result.waves;

  if (!Array.isArray(plans) || !asRecord(waves)) {
    return false;
  }

  const derivedWaves: Record<string, string[]> = {};

  for (const plan of plans) {
    const planRecord = asRecord(plan);
    const planPath = typeof planRecord?.path === "string" ? planRecord.path : null;
    const wave = typeof planRecord?.wave === "number" ? planRecord.wave : null;

    if (planPath === null) {
      return false;
    }

    const waveKey = String(wave ?? "unassigned");
    derivedWaves[waveKey] ??= [];
    derivedWaves[waveKey].push(planPath);
  }

  return areEquivalentJsonValues(derivedWaves, waves);
}

function shouldTrimCommandCatalogWaves(result: ToolResult): boolean {
  const commands = asRecord(result.commands);
  const waves = asRecord(result.waves);

  if (!commands || !waves) {
    return false;
  }

  const derivedWaves: Record<string, string[]> = {};

  for (const [commandName, commandValue] of Object.entries(commands)) {
    const commandRecord = asRecord(commandValue);
    const wave = typeof commandRecord?.wave === "number" ? commandRecord.wave : null;

    if (wave === null) {
      return false;
    }

    const waveKey = String(wave);
    derivedWaves[waveKey] ??= [];
    derivedWaves[waveKey].push(commandName);
  }

  return areEquivalentJsonValues(derivedWaves, waves);
}

function trimWorkstreamPublicStatePath(workstream: unknown): unknown {
  const workstreamRecord = asRecord(workstream);

  if (!workstreamRecord) {
    return workstream;
  }

  const { statePath: _statePath, ...trimmedWorkstream } = workstreamRecord;

  return trimmedWorkstream;
}

function trimWorkstreamPublicFields(result: ToolResult): ToolResult {
  const trimmedActive = trimWorkstreamPublicStatePath(result.active);
  const trimmedWorkstreams = Array.isArray(result.workstreams)
    ? result.workstreams.map((entry) => trimWorkstreamPublicStatePath(entry))
    : result.workstreams;

  return {
    ...result,
    active: trimmedActive,
    workstreams: trimmedWorkstreams
  };
}

function shouldTrimStateLoadBlockers(result: ToolResult): boolean {
  const topLevelBlockers = result.blockers;
  const state = asRecord(result.state);
  const nestedBlockers = state?.blockers;

  return (
    Array.isArray(topLevelBlockers) &&
    Array.isArray(nestedBlockers) &&
    areEquivalentJsonValues(topLevelBlockers, nestedBlockers)
  );
}

function trimPhaseResearchStatusPlanningDiagnostics(result: ToolResult): ToolResult {
  const planningReadiness = asRecord(result.planningReadiness);

  if (!planningReadiness || !Array.isArray(planningReadiness.diagnostics)) {
    return result;
  }

  const nestedDiagnostics = planningReadiness.diagnostics;

  const topLevelContextDiagnostics = result.contextDiagnostics;
  const topLevelUiSpecDiagnostics = result.uiSpecDiagnostics;
  const duplicatesContextDiagnostics =
    Array.isArray(topLevelContextDiagnostics) &&
    areEquivalentJsonValues(nestedDiagnostics, topLevelContextDiagnostics);
  const duplicatesUiSpecDiagnostics =
    Array.isArray(topLevelUiSpecDiagnostics) &&
    areEquivalentJsonValues(nestedDiagnostics, topLevelUiSpecDiagnostics);

  if (!duplicatesContextDiagnostics && !duplicatesUiSpecDiagnostics) {
    return result;
  }

  const { diagnostics: _diagnostics, ...trimmedPlanningReadiness } = planningReadiness;

  return {
    ...result,
    planningReadiness: trimmedPlanningReadiness
  };
}

function shouldTrimProjectStatusBootstrapNextAction(result: ToolResult): boolean {
  const nextAction = getNextAction(result);
  const bootstrap = asRecord(result.bootstrap);
  const recommendedNextAction =
    typeof bootstrap?.recommendedNextAction === "string" &&
    bootstrap.recommendedNextAction.length > 0
      ? bootstrap.recommendedNextAction
      : null;

  return nextAction !== null && recommendedNextAction !== null && nextAction === recommendedNextAction;
}

function shouldTrimNestedWarnings(
  result: ToolResult,
  key: "config" | "roadmap"
): boolean {
  const topLevelWarnings = result.warnings;
  const nestedRecord = asRecord(result[key]);
  const nestedWarnings = nestedRecord?.warnings;

  if (!Array.isArray(topLevelWarnings) || !Array.isArray(nestedWarnings)) {
    return false;
  }

  if (nestedWarnings.length === 0) {
    return false;
  }

  return nestedWarnings.every((warning) => topLevelWarnings.includes(warning));
}

function trimNestedWarnings(
  result: ToolResult,
  key: "config" | "roadmap"
): ToolResult {
  const nestedRecord = asRecord(result[key]);

  if (!nestedRecord || !("warnings" in nestedRecord)) {
    return result;
  }

  const { warnings: _warnings, ...trimmedNestedRecord } = nestedRecord;

  return {
    ...result,
    [key]: trimmedNestedRecord
  };
}

function shouldTrimPhaseContextCodebaseWarnings(result: ToolResult): boolean {
  const topLevelWarnings = result.warnings;
  const codebase = asRecord(result.codebase);
  const nestedWarnings = codebase?.warnings;

  if (!Array.isArray(topLevelWarnings) || !Array.isArray(nestedWarnings)) {
    return false;
  }

  if (nestedWarnings.length === 0) {
    return false;
  }

  return nestedWarnings.every((warning) => topLevelWarnings.includes(warning));
}

function trimPhaseContextCodebaseWarnings(result: ToolResult): ToolResult {
  const codebase = asRecord(result.codebase);

  if (!codebase || !("warnings" in codebase)) {
    return result;
  }

  const { warnings: _warnings, ...trimmedCodebase } = codebase;

  return {
    ...result,
    codebase: trimmedCodebase
  };
}

function shouldTrimPhaseValidationRenderValidationWarnings(result: ToolResult): boolean {
  const topLevelWarnings = result.warnings;
  const validation = asRecord(result.validation);
  const nestedWarnings = validation?.warnings;

  if (!Array.isArray(topLevelWarnings) || !Array.isArray(nestedWarnings)) {
    return false;
  }

  if (nestedWarnings.length === 0) {
    return false;
  }

  return nestedWarnings.every((warning) => topLevelWarnings.includes(warning));
}

function trimPhaseValidationRenderValidationWarnings(result: ToolResult): ToolResult {
  const validation = asRecord(result.validation);

  if (!validation || !("warnings" in validation)) {
    return result;
  }

  const { warnings: _warnings, ...trimmedValidation } = validation;

  return {
    ...result,
    validation: trimmedValidation
  };
}

function trimImpactContextLoadConfigPublicFields(result: ToolResult): ToolResult {
  const config = asRecord(result.config);

  if (!config) {
    return result;
  }

  const {
    provenance: _provenance,
    sourcePath: _sourcePath,
    ...trimmedConfig
  } = config;

  return {
    ...result,
    config: trimmedConfig
  };
}

function trimImpactConfigGetPublicWarnings(result: ToolResult): ToolResult {
  if (!Array.isArray(result.warnings)) {
    return result;
  }

  const warnings = result.warnings.filter(
    (warning) => warning !== IMPACT_CONFIG_SUCCESS_WARNING
  );

  return trimEmptyTopLevelWarnings({
    ...result,
    warnings
  });
}

function trimImpactAnalyzeDuplicatedTopLevelReportFields(result: ToolResult): ToolResult {
  const report = asRecord(result.report);

  if (!report) {
    return result;
  }

  let trimmedResult: ToolResult = result;

  for (const key of IMPACT_ANALYZE_DUPLICATE_REPORT_KEYS) {
    if (!(key in trimmedResult) || !(key in report)) {
      continue;
    }

    if (!areEquivalentJsonValues(trimmedResult[key], report[key])) {
      continue;
    }

    const { [key]: _trimmedField, ...nextTrimmedResult } = trimmedResult;
    trimmedResult = nextTrimmedResult;
  }

  return trimmedResult;
}

function trimImpactScopeResolveDuplicatedChangedFiles(result: ToolResult): ToolResult {
  const scope = asRecord(result.scope);
  const scopeFiles = scope?.files;
  const changedFiles = result.changedFiles;

  if (!Array.isArray(scopeFiles) || !Array.isArray(changedFiles)) {
    return trimEmptyTopLevelWarnings(result);
  }

  const warningsTrimmedResult = trimEmptyTopLevelWarnings(result);

  if (!areEquivalentJsonValues(scopeFiles, changedFiles)) {
    return warningsTrimmedResult;
  }

  const { changedFiles: _changedFiles, ...trimmedResult } = warningsTrimmedResult;

  return trimmedResult;
}

function trimReviewScopeDuplicatedAuthoringContext(result: ToolResult): ToolResult {
  const authoringContext = asRecord(result.authoringContext);

  if (!authoringContext) {
    return trimEmptyTopLevelWarnings(result);
  }

  let trimmedAuthoringContext = authoringContext;

  for (const key of ["phase", "files", "reviewMode"] as const) {
    if (!(key in trimmedAuthoringContext) || !(key in result)) {
      continue;
    }

    if (!areEquivalentJsonValues(trimmedAuthoringContext[key], result[key])) {
      continue;
    }

    const { [key]: _trimmedField, ...nextTrimmedAuthoringContext } = trimmedAuthoringContext;
    trimmedAuthoringContext = nextTrimmedAuthoringContext;
  }

  const warningsTrimmedResult = trimEmptyTopLevelWarnings(result);

  if (trimmedAuthoringContext === authoringContext) {
    return warningsTrimmedResult;
  }

  return {
    ...warningsTrimmedResult,
    authoringContext: trimmedAuthoringContext
  };
}

function derivePlanStringArray(
  plans: unknown,
  key: "planId" | "path"
): string[] | null {
  if (!Array.isArray(plans)) {
    return null;
  }

  const derivedValues: string[] = [];

  for (const plan of plans) {
    const value = asRecord(plan)?.[key];

    if (typeof value !== "string") {
      return null;
    }

    derivedValues.push(value);
  }

  return derivedValues;
}

function shouldTrimPhaseExecutionTargetPlanField(
  result: ToolResult,
  field: "candidatePlanIds" | "candidatePlanPaths" | "selectedPlanIds" | "selectedPlanPaths",
  plansKey: "candidatePlans" | "selectedPlans",
  planKey: "planId" | "path"
): boolean {
  const fieldValue = result[field];

  if (!Array.isArray(fieldValue)) {
    return false;
  }

  const derivedValues = derivePlanStringArray(result[plansKey], planKey);

  return derivedValues !== null && areEquivalentJsonValues(derivedValues, fieldValue);
}

function trimPhaseExecutionTargetsPublicFields(result: ToolResult): ToolResult {
  let trimmedResult = result;

  for (const [field, plansKey, planKey] of [
    ["candidatePlanIds", "candidatePlans", "planId"],
    ["candidatePlanPaths", "candidatePlans", "path"],
    ["selectedPlanIds", "selectedPlans", "planId"],
    ["selectedPlanPaths", "selectedPlans", "path"]
  ] as const) {
    if (!shouldTrimPhaseExecutionTargetPlanField(trimmedResult, field, plansKey, planKey)) {
      continue;
    }

    const { [field]: _trimmedField, ...nextTrimmedResult } = trimmedResult;
    trimmedResult = nextTrimmedResult;
  }

  return trimmedResult;
}

function trimWorkspaceResponsePaths(
  result: ToolResult,
  entry: Record<string, unknown> | null,
  pathKey: "workspacePath" | "removedPath"
): ToolResult {
  const { registryPath: _registryPath, ...registryTrimmedResult } = result;
  let trimmedResult = registryTrimmedResult;
  const pathValue = getString(result, pathKey);
  const entryPath = typeof entry?.path === "string" ? entry.path : null;

  if (pathValue !== null && entryPath !== null && pathValue === entryPath) {
    const { [pathKey]: _duplicatePath, ...nextTrimmedResult } = trimmedResult;
    trimmedResult = nextTrimmedResult;
  }

  const manifestPath = getString(result, "manifestPath");
  const entryManifestPath =
    typeof entry?.manifestPath === "string" ? entry.manifestPath : null;

  if (
    manifestPath !== null &&
    entryManifestPath !== null &&
    manifestPath === entryManifestPath
  ) {
    const { manifestPath: _duplicateManifestPath, ...nextTrimmedResult } = trimmedResult;
    trimmedResult = nextTrimmedResult;
  }

  if (!entry) {
    return trimmedResult;
  }

  const { manifestPath: _nestedManifestPath, ...trimmedEntry } = entry;

  return {
    ...trimmedResult,
    [pathKey === "workspacePath" ? "registryEntry" : "removedEntry"]: trimmedEntry
  };
}

function trimPatchListPublicFields(result: ToolResult): ToolResult {
  const trimmedPatches = Array.isArray(result.patches)
    ? result.patches.map((patchEntry) => {
        const patchRecord = asRecord(patchEntry);

        if (!patchRecord) {
          return patchEntry;
        }

        const {
          manifestPath: _manifestPath,
          patchPath: _patchPath,
          auditPath: _auditPath,
          ...trimmedPatchRecord
        } = patchRecord;

        return trimmedPatchRecord;
      })
    : result.patches;

  const { registryPath: _registryPath, ...trimmedResult } = result;

  return {
    ...trimmedResult,
    patches: trimmedPatches
  };
}

function trimWorkspaceRegistryPublicFields(result: ToolResult): ToolResult {
  const trimmedWorkspaces = Array.isArray(result.workspaces)
    ? result.workspaces.map((workspaceEntry) => {
        const workspaceRecord = asRecord(workspaceEntry);

        if (!workspaceRecord) {
          return workspaceEntry;
        }

        const { manifestPath: _manifestPath, ...trimmedWorkspaceRecord } = workspaceRecord;

        return trimmedWorkspaceRecord;
      })
    : result.workspaces;

  const { registryPath: _registryPath, ...trimmedResult } = result;

  return {
    ...trimmedResult,
    workspaces: trimmedWorkspaces
  };
}


export function sanitizeToolResultForPublicResponse(
  toolName: string,
  result: ToolResult
): ToolResult {
  if (toolName === "blueprint_project_init") {
    const status = getString(result, "status");

    if (status === "invalid") {
      return result;
    }

    const bootstrapDiagnostics = asRecord(result.bootstrapDiagnostics);
    const placeholderArtifacts = bootstrapDiagnostics?.placeholderArtifacts;
    const {
      configProvenance: _configProvenance,
      bootstrapDiagnostics: _bootstrapDiagnostics,
      ...trimmedResult
    } = result;

    if (Array.isArray(placeholderArtifacts)) {
      return trimEmptyTopLevelWarnings({
        ...trimmedResult,
        bootstrapDiagnostics: {
          placeholderArtifacts
        }
      });
    }

    return trimEmptyTopLevelWarnings(trimmedResult);
  }

  if (toolName === "blueprint_config_set") {
    const {
      scope,
      updatedKeys,
      configPath,
      warnings
    }: {
      scope?: unknown;
      updatedKeys?: unknown;
      configPath?: unknown;
      warnings?: unknown;
    } = result;

    return trimEmptyTopLevelWarnings({
      scope,
      updatedKeys,
      configPath,
      warnings
    });
  }

  if (toolName === "blueprint_config_get") {
    return trimRedundantConfigGetSourcePath(result);
  }

  if (toolName === "blueprint_impact_config_get") {
    return trimImpactConfigGetPublicWarnings(result);
  }

  if (toolName === "blueprint_review_load_findings") {
    return trimEmptyTopLevelWarnings(result);
  }

  if (
    toolName === "blueprint_workstream_list" ||
    toolName === "blueprint_workstream_mutate"
  ) {
    const trimmedNestedResult = trimEmptyTopLevelWarnings(
      trimWorkstreamPublicFields(result)
    );
    const {
      rootPath: _rootPath,
      indexPath: _indexPath,
      ...resultWithoutPaths
    } = trimmedNestedResult;
    const active = asRecord(trimmedNestedResult.active);
    const workstreams = trimmedNestedResult.workstreams;

    if (active && Array.isArray(workstreams)) {
      const duplicateActive = workstreams.some(
        (entry) => areEquivalentJsonValues(entry, active)
      );

      if (duplicateActive) {
        const { active: _active, ...trimmedResult } = resultWithoutPaths;

        return trimmedResult;
      }
    }

    return resultWithoutPaths;
  }

  if (toolName === "blueprint_workspace_create") {
    const registryEntry = asRecord(result.registryEntry);
    const nestedRepos = registryEntry?.repos;
    const repoMembers = result.repoMembers;
    let trimmedResult = trimWorkspaceResponsePaths(
      result,
      registryEntry,
      "workspacePath"
    );

    if (Array.isArray(nestedRepos) && Array.isArray(repoMembers)) {
      if (areEquivalentJsonValues(nestedRepos, repoMembers)) {
        const { repoMembers: _repoMembers, ...nextTrimmedResult } = trimmedResult;
        trimmedResult = nextTrimmedResult;
      }
    }

    return trimmedResult;
  }

  if (toolName === "blueprint_workspace_remove") {
    const removedEntry = asRecord(result.removedEntry);
    const nestedRepos = removedEntry?.repos;
    const removedMembers = result.removedMembers;
    let trimmedResult = trimWorkspaceResponsePaths(
      result,
      removedEntry,
      "removedPath"
    );

    if (Array.isArray(nestedRepos) && Array.isArray(removedMembers)) {
      if (areEquivalentJsonValues(nestedRepos, removedMembers)) {
        const { removedMembers: _removedMembers, ...nextTrimmedResult } = trimmedResult;
        trimmedResult = nextTrimmedResult;
      }
    }

    return trimmedResult;
  }

  if (toolName === "blueprint_workspace_registry_get") {
    return trimWorkspaceRegistryPublicFields(result);
  }

  if (toolName === "blueprint_pause_handoff_write") {
    const status = getString(result, "status");
    const isSuccessfulWriteStatus =
      status === "created" || status === "updated" || status === "reused";
    const shouldTrimHandoff = (isSuccessfulWriteStatus || status === "invalid") && "handoff" in result;

    if (shouldTrimHandoff) {
      const { handoff: _handoff, ...trimmedResult } = result;

      return trimEmptyTopLevelWarnings(trimmedResult);
    }

    return result;
  }

  if (toolName === "blueprint_pause_handoff_get") {
    return trimEmptyTopLevelWarnings(result);
  }

  if (toolName === "blueprint_update_plan") {
    return trimEmptyTopLevelWarnings(trimUpdatePlanPublicFields(result));
  }

  if (toolName === "blueprint_update_check") {
    const { extensionManifestPath: _extensionManifestPath, ...trimmedResult } = result;

    return trimEmptyTopLevelWarnings(trimRedundantInstallProvenanceSource(trimmedResult));
  }

  if (toolName === "blueprint_state_load") {
    if (shouldTrimStateLoadBlockers(result)) {
      const { blockers: _blockers, ...trimmedResult } = result;

      return trimmedResult;
    }

    return result;
  }

  if (
    toolName === "blueprint_state_update" ||
    toolName === "blueprint_state_sync"
  ) {
    return trimEmptyTopLevelWarnings(trimTopLevelStatePath(result));
  }

  if (toolName === "blueprint_roadmap_read") {
    return trimRoadmapReadPublicFields(result);
  }

  if (toolName === "blueprint_phase_locate") {
    return trimPhaseLocatePublicFields(result);
  }

  if (toolName === "blueprint_command_catalog") {
    if (!shouldTrimCommandCatalogWaves(result)) {
      return result;
    }

    const { waves: _waves, ...trimmedResult } = result;

    return trimmedResult;
  }

  if (toolName === "blueprint_phase_plan_index") {
    if (!shouldTrimPhasePlanIndexWaves(result)) {
      return result;
    }

    const { waves: _waves, ...trimmedResult } = result;

    return trimmedResult;
  }

  if (toolName === "blueprint_phase_plan_readiness") {
    return trimPhasePlanReadinessPublicFields(result);
  }

  if (toolName === "blueprint_phase_execution_targets") {
    return trimPhaseExecutionTargetsPublicFields(result);
  }

  if (toolName === "blueprint_phase_checkpoint_get") {
    return trimEmptyTopLevelWarnings(result);
  }

  if (
    toolName === "blueprint_artifact_list" ||
    toolName === "blueprint_phase_summary_index" ||
    toolName === "blueprint_artifact_report_authoring_context"
  ) {
    return trimEmptyTopLevelWarnings(result);
  }

  if (toolName === "blueprint_phase_research_status") {
    return trimPhaseResearchStatusPlanningDiagnostics(result);
  }

  if (toolName === "blueprint_phase_context") {
    if (shouldTrimPhaseContextCodebaseWarnings(result)) {
      return trimPhaseContextCodebaseWarnings(result);
    }

    return result;
  }

  if (toolName === "blueprint_phase_validation_render") {
    if (shouldTrimPhaseValidationRenderValidationWarnings(result)) {
      return trimPhaseValidationRenderValidationWarnings(result);
    }

    return result;
  }

  if (toolName === "blueprint_impact_context_load") {
    let trimmedResult = trimImpactContextLoadConfigPublicFields(result);

    if (shouldTrimNestedWarnings(trimmedResult, "config")) {
      trimmedResult = trimNestedWarnings(trimmedResult, "config");
    }

    if (shouldTrimNestedWarnings(trimmedResult, "roadmap")) {
      trimmedResult = trimNestedWarnings(trimmedResult, "roadmap");
    }

    return trimmedResult;
  }

  if (toolName === "blueprint_impact_analyze") {
    return trimImpactAnalyzeDuplicatedTopLevelReportFields(result);
  }

  if (toolName === "blueprint_impact_scope_resolve") {
    return trimImpactScopeResolveDuplicatedChangedFiles(result);
  }

  if (toolName === "blueprint_review_scope") {
    return trimReviewScopeDuplicatedAuthoringContext(result);
  }

  if (toolName === "blueprint_impact_output_render") {
    return trimEmptyTopLevelWarnings(result);
  }

  if (toolName === "blueprint_project_status") {
    if (!shouldTrimProjectStatusBootstrapNextAction(result)) {
      return result;
    }

    const bootstrap = asRecord(result.bootstrap);

    if (!bootstrap) {
      return result;
    }

    const {
      recommendedNextAction: _recommendedNextAction,
      ...trimmedBootstrap
    } = bootstrap;

    return {
      ...result,
      bootstrap: trimmedBootstrap
    };
  }

  if (toolName === "blueprint_artifact_mutate_index") {
    if (shouldTrimMatchedEntryIds(result)) {
      const { matchedEntryIds: _matchedEntryIds, ...trimmedResult } = result;

      return trimmedResult;
    }

    return result;
  }

  if (toolName === "blueprint_roadmap_promote_backlog") {
    let trimmedResult = result;

    if (shouldTrimSelectedBacklogIds(result)) {
      const { selectedBacklogIds: _selectedBacklogIds, ...nextTrimmedResult } = trimmedResult;
      trimmedResult = nextTrimmedResult;
    }

    if (shouldTrimCreatedPhaseDirs(result)) {
      const { createdPhaseDirs: _createdPhaseDirs, ...nextTrimmedResult } = trimmedResult;
      trimmedResult = nextTrimmedResult;
    }

    if (getString(result, "status") === "updated") {
      return trimEmptyTopLevelWarnings(trimmedResult);
    }

    return trimmedResult;
  }

  if (
    toolName === "blueprint_roadmap_add_phase" ||
    toolName === "blueprint_roadmap_insert_phase"
  ) {
    const slugTrimmedResult = shouldTrimRoadmapPhaseSlug(toolName, result)
      ? (({ slug: _slug, ...trimmedResult }) => trimmedResult)(result)
      : result;

    if (getBoolean(result, "written") === true) {
      return trimEmptyTopLevelWarnings(slugTrimmedResult);
    }

    return slugTrimmedResult;
  }

  if (toolName === "blueprint_roadmap_remove_phase") {
    if (getBoolean(result, "written") === true) {
      return trimEmptyTopLevelWarnings(result);
    }

    return result;
  }

  if (toolName === "blueprint_artifact_scaffold" || toolName === "blueprint_phase_artifact_scaffold") {
    return trimEmptyTopLevelWarnings(result);
  }

  if (toolName === "blueprint_patch_record") {
    const {
      registryPath: _registryPath,
      manifestPath: _manifestPath,
      patchPath: _patchPath,
      auditPath: _auditPath,
      ...trimmedResult
    } = result;

    return trimmedResult;
  }

  if (toolName === "blueprint_patch_list") {
    return trimPatchListPublicFields(result);
  }

  if (toolName === "blueprint_patch_reapply") {
    const { registryPath: _registryPath, ...trimmedResult } = result;

    return trimmedResult;
  }

  if (toolName === "blueprint_artifact_validate") {
    if (getBoolean(result, "valid") !== true) {
      return result;
    }

    return trimEmptyTopLevelArrayFields(result, [
      "issues",
      "diagnostics",
      "suggestedRepairs"
    ]);
  }

  if (
    toolName === "blueprint_phase_summary_write" ||
    toolName === "blueprint_codebase_artifact_write" ||
    toolName === "blueprint_phase_validation_write" ||
    toolName === "blueprint_artifact_report_write"
  ) {
    const status = getString(result, "status");
    const isSuccessfulWriteStatus =
      status === "created" || status === "updated" || status === "reused";
    if (isSuccessfulWriteStatus) {
      const issues = result.issues;
      const trimmedIssuesResult =
        Array.isArray(issues) && issues.length === 0
          ? (({ issues: _issues, ...trimmedResult }) => trimmedResult)(result)
          : result;

      return trimEmptyTopLevelWarnings(trimmedIssuesResult);
    }

    return result;
  }

  if (toolName === "blueprint_impact_report_write") {
    const status = getString(result, "status");
    const isSuccessfulWriteStatus =
      status === "written" || status === "overwritten" || status === "reused";
    const errors = result.errors;

    if (isSuccessfulWriteStatus && Array.isArray(errors) && errors.length === 0) {
      const { errors: _errors, ...trimmedResult } = result;

      return trimEmptyTopLevelWarnings(trimmedResult);
    }

    if (status === "invalid") {
      return trimEmptyTopLevelWarnings(result);
    }

    return result;
  }

  if (toolName === "blueprint_phase_checkpoint_put") {
    if (getBoolean(result, "updated") === true) {
      return trimEmptyTopLevelWarnings(result);
    }

    return result;
  }

  if (
    toolName !== "blueprint_phase_plan_write" &&
    toolName !== "blueprint_phase_artifact_write"
  ) {
    return result;
  }

  const status = getString(result, "status");
  const validation = asRecord(result.validation);
  const validationValid = validation?.valid === true;
  const isSuccessfulWriteStatus =
    status === "created" || status === "updated" || status === "reused";
  const warningsTrimmedResult = trimEmptyTopLevelWarnings(result);

  if (!isSuccessfulWriteStatus || !validationValid) {
    return warningsTrimmedResult;
  }

  const { validation: _validation, ...trimmedResult } = warningsTrimmedResult;

  return trimEmptyTopLevelWarnings(trimmedResult);
}
