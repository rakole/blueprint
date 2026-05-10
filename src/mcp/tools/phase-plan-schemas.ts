import {
  cloneJsonObject,
  getJsonObjectProperty
} from "./phase-json-helpers.js";
import {
  allowOnlyEmptyArray,
  exactObjectPropertyContains,
  setArrayItemEnum,
  setArrayMaxItems
} from "./phase-task-schema-helpers.js";

export function buildPhasePlanTaskSchema(args: {
  baseSchema: Record<string, unknown>;
  knownRequirements: string[];
  knownEvidenceArtifacts: string[];
  allowedDependencyPlanIds: string[];
}): Record<string, unknown> {
  const schema = cloneJsonObject(args.baseSchema);
  const properties = getJsonObjectProperty(schema, "properties");
  const defs = getJsonObjectProperty(schema, "$defs");
  const task = defs ? getJsonObjectProperty(defs, "task") : null;
  const taskProperties = task ? getJsonObjectProperty(task, "properties") : null;
  const requirementCoverageRow = defs
    ? getJsonObjectProperty(defs, "requirementCoverageRow")
    : null;
  const requirementCoverageRowProperties = requirementCoverageRow
    ? getJsonObjectProperty(requirementCoverageRow, "properties")
    : null;
  const evidenceCoverageRow = defs ? getJsonObjectProperty(defs, "evidenceCoverageRow") : null;
  const evidenceCoverageRowProperties = evidenceCoverageRow
    ? getJsonObjectProperty(evidenceCoverageRow, "properties")
    : null;

  if (!properties) {
    return schema;
  }

  const dependsOn = getJsonObjectProperty(properties, "dependsOn");
  if (dependsOn) {
    if (args.allowedDependencyPlanIds.length > 0) {
      setArrayItemEnum(dependsOn, args.allowedDependencyPlanIds);
    } else {
      dependsOn.maxItems = 0;
    }
  }

  if (args.knownRequirements.length > 0) {
    setArrayItemEnum(getJsonObjectProperty(properties, "requirements"), args.knownRequirements);
    if (taskProperties) {
      setArrayItemEnum(
        getJsonObjectProperty(taskProperties, "requirements"),
        args.knownRequirements
      );
    }

    const requirement = requirementCoverageRowProperties
      ? getJsonObjectProperty(requirementCoverageRowProperties, "requirement")
      : null;
    if (requirement) {
      requirement.enum = args.knownRequirements;
    }

    const requirementCoverage = getJsonObjectProperty(properties, "requirementCoverage");
    if (requirementCoverage) {
      requirementCoverage.allOf = args.knownRequirements.map((requirementId) =>
        exactObjectPropertyContains("requirement", requirementId)
      );
    }
  } else {
    setArrayMaxItems(getJsonObjectProperty(properties, "requirements"), 0);
    if (taskProperties) {
      setArrayMaxItems(getJsonObjectProperty(taskProperties, "requirements"), 0);
    }

    setArrayMaxItems(getJsonObjectProperty(properties, "requirementCoverage"), 0);
  }

  if (args.knownEvidenceArtifacts.length > 0) {
    const artifact = evidenceCoverageRowProperties
      ? getJsonObjectProperty(evidenceCoverageRowProperties, "artifact")
      : null;
    if (artifact) {
      artifact.enum = args.knownEvidenceArtifacts;
    }

    const evidenceCoverage = getJsonObjectProperty(properties, "evidenceCoverage");
    if (evidenceCoverage) {
      evidenceCoverage.allOf = args.knownEvidenceArtifacts.map((artifactPath) =>
        exactObjectPropertyContains("artifact", artifactPath)
      );
    }
  } else {
    allowOnlyEmptyArray(getJsonObjectProperty(properties, "evidenceCoverage"));
  }

  schema["x-blueprint-runtimeContext"] = {
    knownRequirements: args.knownRequirements,
    knownEvidenceArtifacts: args.knownEvidenceArtifacts,
    allowedDependencyPlanIds: args.allowedDependencyPlanIds
  };

  return schema;
}
