/**
 * Pure, dependency-free analysis for the frozen portable-map study interface.
 *
 * This module consumes only observed rows.  It does not read study artifacts,
 * call a model, grade output, or write state.  `corpus` is the preregistered
 * repository/language label; repeats are clustered under corpus/taskId so they
 * do not become independent tasks.
 */

export const OBSERVATION_SCHEMA_VERSION = "v1";

export const TASK_CLASSES = Object.freeze([
  "discussion",
  "research",
  "planning",
  "implementation",
  "review",
  "testing"
]);

export const ARMS = Object.freeze([
  "blueprint-legacy",
  "blueprint-compact",
  "blueprint-portable",
  "standalone-source",
  "standalone-portable"
]);

export const STATUSES = Object.freeze([
  "completed",
  "failed",
  "interrupted",
  "not-started"
]);

const TASK_CLASS_SET = new Set(TASK_CLASSES);
const ARM_SET = new Set(ARMS);
const STATUS_SET = new Set(STATUSES);
const STUDY_SET = new Set(["pilot", "confirmatory"]);
const HASH_FIELDS = Object.freeze([
  "sourceManifestSha256",
  "mapManifestSha256",
  "taskDatasetSha256",
  "runtimeServerSha256",
  "adapterSha256",
  "evaluatorSha256",
  "protocolSha256",
  "promptSha256",
  "guidanceSha256",
  "toolchain"
]);
const PROVENANCE_KEYS = new Set(HASH_FIELDS);
const USAGE_KEYS = new Set([
  "inputTokens",
  "cachedInputTokens",
  "outputTokens",
  "reasoningOutputTokens",
  "totalTokens",
  "monetaryCost"
]);
const QUALITY_KEYS = new Set([
  "status",
  "complete",
  "rubricScore",
  "criteria",
  "criticalFailures"
]);
const OBSERVATION_KEYS = new Set([
  "runId",
  "study",
  "corpus",
  "taskId",
  "taskClass",
  "knownTarget",
  "repeat",
  "arm",
  "status",
  "provenance",
  "usage",
  "quality"
]);
const DESIGN_KEYS = new Set([
  "study",
  "expectedTasks",
  "repeats",
  "arms",
  "seed",
  "bootstrapReplicates",
  "minimumTokenReduction",
  "completionNoninferiorityMargin",
  "rubricNoninferiorityMargin",
  "allowIncomplete",
  "allowInconclusive",
  "navigationEvidence"
]);

const DEFAULT_ALPHA = 0.05;
const DEFAULT_LIMITED_CLUSTER_THRESHOLD = 4;
const SHA256 = /^[a-f0-9]{64}$/u;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function ownKeys(value) {
  return isRecord(value) ? Object.keys(value) : [];
}

function sortedUnknownKeys(value, allowed) {
  return ownKeys(value).filter((key) => !allowed.has(key)).sort();
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function error(code, message, path = undefined) {
  return path === undefined ? { code, message } : { code, message, path };
}

function pushUnknown(errors, value, allowed, path) {
  for (const key of sortedUnknownKeys(value, allowed)) {
    errors.push(error("unknown-field", `Unknown field: ${key}`, `${path}.${key}`));
  }
}

function expectFields(value, fields, errors, path) {
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) errors.push(error("missing-field", `Missing field: ${field}`, `${path}.${field}`));
  }
}

function validateProvenance(provenance, path = "provenance") {
  const errors = [];
  if (!isRecord(provenance)) return [error("invalid-type", "provenance must be an object", path)];
  pushUnknown(errors, provenance, PROVENANCE_KEYS, path);
  expectFields(provenance, HASH_FIELDS, errors, path);

  for (const field of HASH_FIELDS) {
    if (!Object.hasOwn(provenance, field)) continue;
    const value = provenance[field];
    if (field === "mapManifestSha256" || field === "runtimeServerSha256") {
      if (value !== null && (!requiredString(value) || !SHA256.test(value))) {
        errors.push(error("invalid-provenance", `${field} must be a lowercase hexadecimal SHA-256 string or null`, `${path}.${field}`));
      }
    } else if (field === "toolchain") {
      if (!requiredString(value) && !isRecord(value)) {
        errors.push(error("invalid-provenance", "toolchain must be a non-empty string or object", `${path}.${field}`));
      }
    } else if (!requiredString(value) || !SHA256.test(value)) {
      errors.push(error("invalid-provenance", `${field} must be a lowercase hexadecimal SHA-256 string`, `${path}.${field}`));
    }
  }
  return errors;
}

function validateUsage(usage, path = "usage") {
  const errors = [];
  if (usage === null) return errors;
  if (!isRecord(usage)) return [error("invalid-type", "usage must be an object or null", path)];
  pushUnknown(errors, usage, USAGE_KEYS, path);
  expectFields(usage, [...USAGE_KEYS], errors, path);
  for (const field of ["inputTokens", "cachedInputTokens", "outputTokens", "reasoningOutputTokens", "totalTokens"]) {
    if (Object.hasOwn(usage, field) && !isNonNegativeInteger(usage[field])) {
      errors.push(error("invalid-usage", `${field} must be a non-negative safe integer`, `${path}.${field}`));
    }
  }
  if (Object.hasOwn(usage, "monetaryCost") && usage.monetaryCost !== null) {
    errors.push(error("invalid-usage", "monetaryCost must be null when unavailable", `${path}.monetaryCost`));
  }
  if (isNonNegativeInteger(usage.inputTokens) && isNonNegativeInteger(usage.cachedInputTokens) &&
      usage.cachedInputTokens > usage.inputTokens) {
    errors.push(error("invalid-usage", "cachedInputTokens must be a subset of inputTokens", `${path}.cachedInputTokens`));
  }
  if (isNonNegativeInteger(usage.outputTokens) && isNonNegativeInteger(usage.reasoningOutputTokens) &&
      usage.reasoningOutputTokens > usage.outputTokens) {
    errors.push(error("invalid-usage", "reasoningOutputTokens must be a subset of outputTokens", `${path}.reasoningOutputTokens`));
  }
  if (isNonNegativeInteger(usage.inputTokens) && isNonNegativeInteger(usage.outputTokens) &&
      isNonNegativeInteger(usage.totalTokens) &&
      usage.totalTokens !== usage.inputTokens + usage.outputTokens) {
    errors.push(error("invalid-usage", "totalTokens must equal inputTokens + outputTokens", `${path}.totalTokens`));
  }
  return errors;
}

function validateQuality(quality, path = "quality") {
  const errors = [];
  if (quality === null) return errors;
  if (!isRecord(quality)) return [error("invalid-type", "quality must be an object or null", path)];
  pushUnknown(errors, quality, QUALITY_KEYS, path);
  expectFields(quality, [...QUALITY_KEYS], errors, path);
  if (Object.hasOwn(quality, "status") && quality.status !== "graded") {
    errors.push(error("invalid-quality", "quality.status must be graded", `${path}.status`));
  }
  if (Object.hasOwn(quality, "complete") && typeof quality.complete !== "boolean") {
    errors.push(error("invalid-quality", "quality.complete must be boolean", `${path}.complete`));
  }
  if (Object.hasOwn(quality, "rubricScore") &&
      (!isFiniteNumber(quality.rubricScore) || quality.rubricScore < 0 || quality.rubricScore > 1)) {
    errors.push(error("invalid-quality", "quality.rubricScore must be a number in [0, 1]", `${path}.rubricScore`));
  }
  for (const field of ["criteria", "criticalFailures"]) {
    if (Object.hasOwn(quality, field) && !Array.isArray(quality[field])) {
      errors.push(error("invalid-quality", `${field} must be an array`, `${path}.${field}`));
    }
  }
  return errors;
}

/** Validate one canonical observation without mutating it. */
export function validateObservation(observation, options = {}) {
  const errors = [];
  if (!isRecord(observation)) {
    return { valid: false, errors: [error("invalid-type", "Observation must be an object")] };
  }
  pushUnknown(errors, observation, OBSERVATION_KEYS, "observation");
  expectFields(observation, [...OBSERVATION_KEYS], errors, "observation");
  for (const field of ["runId", "corpus", "taskId"]) {
    if (Object.hasOwn(observation, field) && !requiredString(observation[field])) {
      errors.push(error("invalid-field", `${field} must be a non-empty string`, `observation.${field}`));
    }
  }
  if (Object.hasOwn(observation, "study") && !STUDY_SET.has(observation.study)) {
    errors.push(error("invalid-field", "study must be pilot or confirmatory", "observation.study"));
  }
  if (Object.hasOwn(observation, "taskClass") && !TASK_CLASS_SET.has(observation.taskClass)) {
    errors.push(error("invalid-field", `taskClass must be one of ${TASK_CLASSES.join(", ")}`, "observation.taskClass"));
  }
  if (Object.hasOwn(observation, "knownTarget") && typeof observation.knownTarget !== "boolean") {
    errors.push(error("invalid-field", "knownTarget must be boolean", "observation.knownTarget"));
  }
  if (Object.hasOwn(observation, "repeat") && !isPositiveInteger(observation.repeat)) {
    errors.push(error("invalid-field", "repeat must be a positive safe integer", "observation.repeat"));
  }
  if (Object.hasOwn(observation, "arm") && !ARM_SET.has(observation.arm)) {
    errors.push(error("invalid-field", `arm must be one of ${ARMS.join(", ")}`, "observation.arm"));
  }
  if (Object.hasOwn(observation, "status") && !STATUS_SET.has(observation.status)) {
    errors.push(error("invalid-field", `status must be one of ${STATUSES.join(", ")}`, "observation.status"));
  }
  if (Object.hasOwn(observation, "provenance")) errors.push(...validateProvenance(observation.provenance));
  if (Object.hasOwn(observation, "usage")) errors.push(...validateUsage(observation.usage));
  if (Object.hasOwn(observation, "quality")) errors.push(...validateQuality(observation.quality));

  if (options.study !== undefined && observation.study !== options.study) {
    errors.push(error("study-mismatch", `Observation study does not match ${options.study}`, "observation.study"));
  }
  return { valid: errors.length === 0, errors };
}

/** Validate and normalize the explicit design supplied to analyzeStudy. */
export function validateDesign(design) {
  const errors = [];
  if (!isRecord(design)) return { valid: false, errors: [error("invalid-type", "Design must be an object")] };
  pushUnknown(errors, design, DESIGN_KEYS, "design");
  expectFields(
    design,
    ["study", "expectedTasks", "repeats", "arms", "seed", "bootstrapReplicates"],
    errors,
    "design"
  );
  if (Object.hasOwn(design, "study") && !STUDY_SET.has(design.study)) {
    errors.push(error("invalid-design", "study must be pilot or confirmatory", "design.study"));
  }
  if (!Array.isArray(design.expectedTasks) || design.expectedTasks.length === 0) {
    errors.push(error("invalid-design", "expectedTasks must be a non-empty array", "design.expectedTasks"));
  }
  const expectedTaskKeys = new Set();
  if (Array.isArray(design.expectedTasks)) {
    design.expectedTasks.forEach((task, index) => {
      const path = `design.expectedTasks[${index}]`;
      if (!isRecord(task)) {
        errors.push(error("invalid-design", "expected task must be an object", path));
        return;
      }
      const taskKeys = new Set(["corpus", "taskId", "taskClass", "knownTarget"]);
      pushUnknown(errors, task, taskKeys, path);
      expectFields(task, [...taskKeys], errors, path);
      if (!requiredString(task.corpus)) errors.push(error("invalid-design", "corpus must be a non-empty string", `${path}.corpus`));
      if (!requiredString(task.taskId)) errors.push(error("invalid-design", "taskId must be a non-empty string", `${path}.taskId`));
      if (!TASK_CLASS_SET.has(task.taskClass)) errors.push(error("invalid-design", "taskClass is invalid", `${path}.taskClass`));
      if (typeof task.knownTarget !== "boolean") errors.push(error("invalid-design", "knownTarget must be boolean", `${path}.knownTarget`));
      if (requiredString(task.corpus) && requiredString(task.taskId)) {
        const key = taskKey(task);
        if (expectedTaskKeys.has(key)) errors.push(error("duplicate-design-task", `Duplicate expected task: ${key}`, path));
        expectedTaskKeys.add(key);
      }
    });
  }
  if (!isPositiveInteger(design.repeats)) errors.push(error("invalid-design", "repeats must be a positive safe integer", "design.repeats"));
  if (!Array.isArray(design.arms) || design.arms.length === 0) {
    errors.push(error("invalid-design", "arms must be a non-empty array", "design.arms"));
  } else {
    const seen = new Set();
    for (const arm of design.arms) {
      if (!ARM_SET.has(arm)) errors.push(error("invalid-design", `Unknown arm: ${String(arm)}`, "design.arms"));
      if (seen.has(arm)) errors.push(error("duplicate-design-arm", `Duplicate arm: ${arm}`, "design.arms"));
      seen.add(arm);
    }
  }
  if (!(typeof design.seed === "string" || Number.isSafeInteger(design.seed))) {
    errors.push(error("invalid-design", "seed must be a string or safe integer", "design.seed"));
  }
  if (!isPositiveInteger(design.bootstrapReplicates) || design.bootstrapReplicates > 100_000) {
    errors.push(error("invalid-design", "bootstrapReplicates must be an integer in [1, 100000]", "design.bootstrapReplicates"));
  }
  for (const [field, fallback] of [
    ["minimumTokenReduction", 0.20],
    ["completionNoninferiorityMargin", 0.05],
    ["rubricNoninferiorityMargin", 0.05]
  ]) {
    if (design[field] === undefined) continue;
    if (!isFiniteNumber(design[field]) || design[field] < 0 || design[field] > 1) {
      errors.push(error("invalid-design", `${field} must be a number in [0, 1]`, `design.${field}`));
    }
  }
  for (const field of ["allowIncomplete", "allowInconclusive"]) {
    if (design[field] !== undefined && typeof design[field] !== "boolean") {
      errors.push(error("invalid-design", `${field} must be boolean`, `design.${field}`));
    }
  }
  if (design.navigationEvidence !== undefined) {
    if (!isRecord(design.navigationEvidence)) {
      errors.push(error("invalid-design", "navigationEvidence must be an object", "design.navigationEvidence"));
    } else {
      const navigationKeys = new Set(["measured", "firstUsefulImprovement", "mapValueVsCompact", "standaloneBenefit", "sourceManifestSha256", "mapManifestSha256"]);
      pushUnknown(errors, design.navigationEvidence, navigationKeys, "design.navigationEvidence");
      for (const field of ["measured", "firstUsefulImprovement", "mapValueVsCompact", "standaloneBenefit"]) {
        if (design.navigationEvidence[field] !== undefined && typeof design.navigationEvidence[field] !== "boolean") {
          errors.push(error("invalid-design", `${field} must be boolean`, `design.navigationEvidence.${field}`));
        }
      }
      for (const field of ["sourceManifestSha256", "mapManifestSha256"]) {
        if (design.navigationEvidence[field] !== undefined && !SHA256.test(String(design.navigationEvidence[field]))) {
          errors.push(error("invalid-design", `${field} must be a lowercase hexadecimal SHA-256 string`, `design.navigationEvidence.${field}`));
        }
      }
    }
  }
  if (errors.length > 0) return { valid: false, errors };
  const normalized = {
    study: design.study,
    expectedTasks: design.expectedTasks.map((task) => ({ ...task })),
    repeats: design.repeats,
    arms: [...design.arms],
    seed: design.seed,
    bootstrapReplicates: design.bootstrapReplicates,
    minimumTokenReduction: design.minimumTokenReduction ?? 0.20,
    completionNoninferiorityMargin: design.completionNoninferiorityMargin ?? 0.05,
    rubricNoninferiorityMargin: design.rubricNoninferiorityMargin ?? 0.05,
    allowIncomplete: design.allowIncomplete === true,
    allowInconclusive: design.allowInconclusive === true,
    navigationEvidence: design.navigationEvidence === undefined ? null : {...design.navigationEvidence}
  };
  return { valid: true, errors: [], design: normalized };
}

function taskKey(task) {
  return `${task.corpus}\u001f${task.taskId}`;
}

function cellKey(row) {
  return `${row.corpus}\u001f${row.taskId}\u001f${row.repeat}\u001f${row.arm}`;
}

function clusterKey(row) {
  return `${row.corpus}\u001f${row.taskId}`;
}

function expectedCellKey(task, repeat, arm) {
  return `${task.corpus}\u001f${task.taskId}\u001f${repeat}\u001f${arm}`;
}

function displayCellKey(value) {
  return value.split("\u001f").join("/");
}

function mean(values) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sumOrNull(values) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0);
}

/** Linear interpolation quantile with a deterministic empty-sample result. */
export function quantile(values, probability) {
  if (!Array.isArray(values) || values.length === 0) return null;
  if (!isFiniteNumber(probability) || probability < 0 || probability > 1) throw new RangeError("probability must be in [0, 1]");
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function hashSeed(seed) {
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bootstrap cluster means; clusters, rather than repeated cells, are resampled. */
export function bootstrapMean(values, replicates, seed) {
  if (!Array.isArray(values) || values.length === 0) {
    return { samples: 0, replicates: 0, lower: null, median: null, upper: null };
  }
  const count = Math.max(0, Math.floor(Number(replicates)));
  if (count === 0) return { samples: values.length, replicates: 0, lower: null, median: null, upper: null };
  const random = seededRandom(seed);
  const estimates = [];
  for (let iteration = 0; iteration < count; iteration += 1) {
    let total = 0;
    for (let index = 0; index < values.length; index += 1) {
      total += values[Math.floor(random() * values.length)];
    }
    estimates.push(total / values.length);
  }
  return {
    samples: values.length,
    replicates: count,
    lower: quantile(estimates, 0.025),
    median: quantile(estimates, 0.5),
    upper: quantile(estimates, 0.975)
  };
}

function bootstrapHierarchical(clusters, replicates, seed, statistic = mean) {
  if (!Array.isArray(clusters) || clusters.length === 0) {
    return { samples: 0, repositories: 0, replicates: 0, lower: null, median: null, upper: null, method: "hierarchical repository-then-task bootstrap" };
  }
  const byRepository = groupRows(clusters, (cluster) => cluster.repository);
  const repositories = [...byRepository.values()];
  const count = Math.max(0, Math.floor(Number(replicates)));
  if (count === 0) return { samples: clusters.length, repositories: repositories.length, replicates: 0, lower: null, median: null, upper: null, method: "hierarchical repository-then-task bootstrap" };
  const random = seededRandom(seed);
  const estimates = [];
  for (let iteration = 0; iteration < count; iteration += 1) {
    const sampledRepositories = [];
    for (let index = 0; index < repositories.length; index += 1) {
      const repository = repositories[Math.floor(random() * repositories.length)];
      const sampledTasks = [];
      for (let taskIndex = 0; taskIndex < repository.length; taskIndex += 1) {
        sampledTasks.push(repository[Math.floor(random() * repository.length)].value);
      }
      sampledRepositories.push(mean(sampledTasks));
    }
    estimates.push(statistic(sampledRepositories));
  }
  return {
    samples: clusters.length,
    repositories: repositories.length,
    replicates: count,
    lower: quantile(estimates, 0.025),
    median: quantile(estimates, 0.5),
    upper: quantile(estimates, 0.975),
    method: "hierarchical repository-then-task bootstrap"
  };
}

function finiteBound(values, alpha = DEFAULT_ALPHA) {
  if (values.length === 0) {
    return { samples: 0, radius: null, lower: null, upper: null, method: "one-sided 95% Hoeffding bound for differences in [-1,1]" };
  }
  const observed = mean(values);
  // A difference of two rates/scores lies in [-1, 1], whose range width is 2.
  // This is the one-sided alpha bound used for non-inferiority decisions.
  const radius = Math.sqrt((2 * Math.log(1 / alpha)) / values.length);
  return {
    samples: values.length,
    radius,
    lower: Math.max(-1, observed - radius),
    upper: Math.min(1, observed + radius),
    alpha,
    range: [-1, 1],
    method: "one-sided 95% Hoeffding bound for differences in [-1,1]"
  };
}

export { finiteBound };

function inferDisposition(bounds, margin) {
  if (bounds.lower === null) return "incomplete";
  if (bounds.lower > -margin) return "pass";
  if (bounds.upper < -margin) return "fail";
  return "inconclusive";
}

function boundedParity(bounds, margin) {
  if (bounds.lower === null) return "incomplete";
  if (bounds.lower > -margin && bounds.upper < margin) return "supported";
  if (bounds.upper <= -margin || bounds.lower >= margin) return "not-supported";
  return "inconclusive";
}

function summarizeUsage(rows) {
  const observed = rows.filter((row) => row.usage !== null);
  const values = (field) => observed.map((row) => row.usage[field]);
  const complete = observed.length === rows.length;
  const observedTotals = {
    totalTokens: sumOrNull(values("totalTokens")),
    inputTokens: sumOrNull(values("inputTokens")),
    outputTokens: sumOrNull(values("outputTokens")),
    cachedInputTokens: sumOrNull(values("cachedInputTokens")),
    reasoningOutputTokens: sumOrNull(values("reasoningOutputTokens"))
  };
  return {
    participantRows: rows.length,
    rowsWithUsage: observed.length,
    rowsMissingUsage: rows.length - observed.length,
    // A complete total is null when any participant cost is unavailable.  The
    // observed subtotal remains available for descriptive accounting and is
    // explicitly named so it cannot be mistaken for a complete total.
    totalTokens: complete ? observedTotals.totalTokens : null,
    inputTokens: complete ? observedTotals.inputTokens : null,
    outputTokens: complete ? observedTotals.outputTokens : null,
    cachedInputTokens: complete ? observedTotals.cachedInputTokens : null,
    reasoningOutputTokens: complete ? observedTotals.reasoningOutputTokens : null,
    observedTotalTokens: observedTotals.totalTokens,
    observedInputTokens: observedTotals.inputTokens,
    observedOutputTokens: observedTotals.outputTokens,
    observedCachedInputTokens: observedTotals.cachedInputTokens,
    observedReasoningOutputTokens: observedTotals.reasoningOutputTokens,
    monetaryCost: null,
    costStatus: complete ? "complete" : observed.length === 0 ? "unavailable" : "partial"
  };
}

function summarizeCritical(rows) {
  const graded = rows.filter((row) => row.quality !== null);
  const withCriticalFailure = graded.filter((row) => row.quality.criticalFailures.length > 0);
  return {
    gradedRows: graded.length,
    rowsWithCriticalFailures: withCriticalFailure.length,
    criticalFailureRate: graded.length === 0 ? null : withCriticalFailure.length / graded.length,
    criticalFailureObservations: graded.reduce((sum, row) => sum + row.quality.criticalFailures.length, 0)
  };
}

function groupRows(rows, keyFunction) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFunction(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function qualityRowsFromPair(pair) {
  return pair.left.status === "completed" && pair.right.status === "completed" &&
    pair.left.quality !== null && pair.right.quality !== null;
}

function pairClusters(pairs, valueFunction) {
  const grouped = groupRows(pairs, (pair) => clusterKey(pair.left));
  const clusters = [];
  for (const [key, clusterPairs] of grouped) {
    const values = clusterPairs.map(valueFunction).filter((value) => isFiniteNumber(value));
    if (values.length === 0) continue;
    clusters.push({ key, repository: clusterPairs[0].left.corpus, value: mean(values), pairs: clusterPairs.length });
  }
  return clusters;
}

function pairedQualityClusters(pairs) {
  const grouped = groupRows(pairs, (pair) => clusterKey(pair.left));
  const clusters = [];
  for (const [key, clusterPairs] of grouped) {
    if (clusterPairs.some((pair) => !qualityRowsFromPair(pair))) continue;
    clusters.push({
      key,
      repository: clusterPairs[0].left.corpus,
      left: mean(clusterPairs.map((pair) => pair.left.quality.rubricScore)),
      right: mean(clusterPairs.map((pair) => pair.right.quality.rubricScore)),
      value: mean(clusterPairs.map((pair) => pair.left.quality.rubricScore - pair.right.quality.rubricScore)),
      pairs: clusterPairs.length
    });
  }
  return clusters;
}

/** Completion uses the exact same completed-and-graded repeats as quality. */
function pairedCompletionClusters(pairs) {
  const grouped = groupRows(pairs, (pair) => clusterKey(pair.left));
  const clusters = [];
  for (const [key, clusterPairs] of grouped) {
    if (clusterPairs.some((pair) => !qualityRowsFromPair(pair))) continue;
    const left = mean(clusterPairs.map((pair) => pair.left.quality.complete ? 1 : 0));
    const right = mean(clusterPairs.map((pair) => pair.right.quality.complete ? 1 : 0));
    clusters.push({
      key,
      repository: clusterPairs[0].left.corpus,
      left,
      right,
      value: left - right,
      pairs: clusterPairs.length
    });
  }
  return clusters;
}

function tokenClusters(pairs) {
  const grouped = groupRows(pairs, (pair) => clusterKey(pair.left));
  const clusters = [];
  for (const [key, clusterPairs] of grouped) {
    if (clusterPairs.some((pair) => pair.left.usage === null || pair.right.usage === null)) continue;
    clusters.push({key, repository: clusterPairs[0].left.corpus, value: mean(clusterPairs.map((pair) => pair.left.usage.totalTokens - pair.right.usage.totalTokens)), pairs: clusterPairs.length});
  }
  return clusters;
}

function metricClusters(pairs, valueFunction) {
  return pairClusters(pairs, valueFunction).map((item) => ({
    key: item.key,
    repository: item.repository,
    value: item.value
  }));
}

function hierarchicalMetricBounds(clusters, replicates, seed, statistic = mean) {
  const values = clusters.map((cluster) => cluster.value);
  const bootstrap = bootstrapHierarchical(clusters, replicates, seed, statistic);
  const repositoryMeans = [...groupRows(clusters, (cluster) => cluster.repository).values()]
    .map((repository) => mean(repository.map((cluster) => cluster.value)));
  return {
    bootstrap,
    finiteSample: finiteBound(repositoryMeans),
    taskSamples: values.length,
    repositorySamples: repositoryMeans.length
  };
}

function bootstrapTaskVectorMedian(taskClusters, replicates, seed) {
  if (taskClusters.length === 0) return {samples: 0, repositories: 0, replicates: 0, lower: null, median: null, upper: null, method: "hierarchical repository-then-task bootstrap of pooled paired-repeat median"};
  const byRepository = groupRows(taskClusters, (cluster) => cluster.repository);
  const repositories = [...byRepository.values()];
  const count = Math.max(0, Math.floor(Number(replicates)));
  if (count === 0) return {samples: taskClusters.reduce((sum, task) => sum + task.values.length, 0), repositories: repositories.length, replicates: 0, lower: null, median: null, upper: null, method: "hierarchical repository-then-task bootstrap of pooled paired-repeat median"};
  const random = seededRandom(seed);
  const estimates = [];
  for (let iteration = 0; iteration < count; iteration += 1) {
    const sampledValues = [];
    for (const repository of repositories) {
      for (let index = 0; index < repository.length; index += 1) {
        const task = repository[Math.floor(random() * repository.length)];
        sampledValues.push(...task.values);
      }
    }
    estimates.push(quantile(sampledValues, 0.5));
  }
  return {samples: taskClusters.reduce((sum, task) => sum + task.values.length, 0), repositories: repositories.length, replicates: count, lower: quantile(estimates, 0.025), median: quantile(estimates, 0.5), upper: quantile(estimates, 0.975), method: "hierarchical repository-then-task bootstrap of pooled paired-repeat median"};
}

function makeStratumRows(pairs, keyFunction) {
  const groups = groupRows(pairs, keyFunction);
  const output = [];
  for (const [value, rows] of groups) {
    const completion = pairedCompletionClusters(rows);
    const quality = pairedQualityClusters(rows);
    output.push({
      value,
      pairedRows: rows.length,
      independentClusters: new Set(rows.map((pair) => clusterKey(pair.left))).size,
      completionDifference: completion.length === 0 ? null : mean(completion.map((item) => item.value)),
      rubricDifference: quality.length === 0 ? null : mean(quality.map((item) => item.value))
    });
    const reductions = rows
      .filter((pair) => pair.left.usage !== null && pair.right.usage !== null && pair.right.usage.totalTokens > 0)
      .map((pair) => (pair.right.usage.totalTokens - pair.left.usage.totalTokens) / pair.right.usage.totalTokens);
    output.at(-1).tokenReductionMedian = quantile(reductions, 0.5);
    output.at(-1).tokenReductionP90 = quantile(reductions, 0.9);
    output.at(-1).tokenReductionSamples = reductions.length;
    const tokenDeltas = rows.filter((pair) => pair.left.usage !== null && pair.right.usage !== null)
      .map((pair) => pair.left.usage.totalTokens - pair.right.usage.totalTokens);
    output.at(-1).tokenOverheadP90 = quantile(tokenDeltas, 0.9);
    output.at(-1).tokenOverheadMedian = quantile(tokenDeltas, 0.5);
  }
  return output.sort((a, b) => String(a.value).localeCompare(String(b.value)));
}

function p90Overhead(pairs) {
  const runDeltas = pairs
    .filter((pair) => pair.left.usage !== null && pair.right.usage !== null)
    .map((pair) => pair.left.usage.totalTokens - pair.right.usage.totalTokens);
  const clusters = tokenClusters(pairs);
  const deltas = clusters.map((item) => item.value);
  return {
    samples: runDeltas.length,
    independentClusters: deltas.length,
    p90Tokens: quantile(runDeltas, 0.9),
    medianTokens: quantile(runDeltas, 0.5),
    taskAggregateP90Tokens: quantile(deltas, 0.9),
    taskAggregateMedianTokens: quantile(deltas, 0.5),
    basis: "actual paired-run left totalTokens minus right totalTokens",
    taskAggregateBasis: "task means clustered by corpus/taskId",
    unavailableWhenUsageMissing: true
  };
}

function criticalComparison(pairs) {
  const left = summarizeCritical(pairs.map((pair) => pair.left));
  const right = summarizeCritical(pairs.map((pair) => pair.right));
  return {
    left,
    right,
    rateDifference: left.criticalFailureRate === null || right.criticalFailureRate === null
      ? null
      : left.criticalFailureRate - right.criticalFailureRate
  };
}

function comparisonLabel(leftArm, rightArm) {
  if (leftArm === "blueprint-portable" && rightArm === "blueprint-legacy") return "portable-vs-legacy";
  if (leftArm === "blueprint-portable" && rightArm === "blueprint-compact") return "portable-vs-compact";
  return "standalone-portable-vs-source";
}

function analyzeComparison(pairs, leftArm, rightArm, design) {
  const label = comparisonLabel(leftArm, rightArm);
  const left = pairs.map((pair) => pair.left);
  const right = pairs.map((pair) => pair.right);
  const qualityPairs = pairs.filter(qualityRowsFromPair);
  const completionClusters = pairedCompletionClusters(pairs);
  const completionDifferences = completionClusters.map((item) => item.value);
  const completionBounds = hierarchicalMetricBounds(completionClusters, design.bootstrapReplicates, `${design.seed}:${label}:completion`);
  const completionBootstrap = completionBounds.bootstrap;
  const completionFinite = completionBounds.finiteSample;
  const completion = {
    pairedRows: qualityPairs.length,
    independentClusters: completionDifferences.length,
    leftRate: completionClusters.length === 0 ? null : mean(completionClusters.map((item) => item.left)),
    rightRate: completionClusters.length === 0 ? null : mean(completionClusters.map((item) => item.right)),
    observedDifference: mean(completionDifferences),
    discordantClusters: completionDifferences.filter((value) => value !== 0).length,
    zeroDiscordance: completionDifferences.length > 0 && completionDifferences.every((value) => value === 0),
    bootstrap: completionBootstrap,
    finiteSample: completionFinite,
    nonInferiority: {
      margin: design.completionNoninferiorityMargin,
      status: inferDisposition(completionFinite, design.completionNoninferiorityMargin),
      lowerBound: completionFinite.lower,
      upperBound: completionFinite.upper
    },
    clusteredBy: "repository then corpus/taskId",
    repositoryClusters: completionBounds.repositorySamples,
    taskClusters: completionBounds.taskSamples,
    repeatsAreNotIndependent: true
  };

  const qualityClusters = pairedQualityClusters(pairs);
  const qualityDifferences = qualityClusters.map((item) => item.value);
  const qualityBounds = hierarchicalMetricBounds(qualityClusters, design.bootstrapReplicates, `${design.seed}:${label}:quality`);
  const qualityBootstrap = qualityBounds.bootstrap;
  const qualityFinite = qualityBounds.finiteSample;
  const quality = {
    pairedRows: qualityPairs.length,
    independentClusters: qualityDifferences.length,
    missingQualityPairs: pairs.length - qualityPairs.length,
    leftRubricMean: qualityClusters.length === 0 ? null : mean(qualityClusters.map((item) => item.left)),
    rightRubricMean: qualityClusters.length === 0 ? null : mean(qualityClusters.map((item) => item.right)),
    observedDifference: mean(qualityDifferences),
    bootstrap: qualityBootstrap,
    finiteSample: qualityFinite,
    nonInferiority: {
      margin: design.rubricNoninferiorityMargin,
      status: inferDisposition(qualityFinite, design.rubricNoninferiorityMargin),
      lowerBound: qualityFinite.lower,
      upperBound: qualityFinite.upper
    },
    parity: {
      status: boundedParity(qualityFinite, design.rubricNoninferiorityMargin),
      margin: design.rubricNoninferiorityMargin,
      lowerBound: qualityFinite.lower,
      upperBound: qualityFinite.upper,
      zeroDiscordanceIsNotProof: true
    },
    // Critical failures are descriptive observations, not a paired score. Keep
    // known failures visible even when the counterpart is missing or failed.
    criticalFailures: criticalComparison(pairs),
    clusteredBy: "repository then corpus/taskId",
    repositoryClusters: qualityBounds.repositorySamples,
    taskClusters: qualityBounds.taskSamples,
    repeatsAreNotIndependent: true
  };

  const tokenPairs = pairs.filter((pair) => pair.left.usage !== null && pair.right.usage !== null);
  const leftUsage = summarizeUsage(left);
  const rightUsage = summarizeUsage(right);
  const pairedLeftUsage = summarizeUsage(tokenPairs.map((pair) => pair.left));
  const pairedRightUsage = summarizeUsage(tokenPairs.map((pair) => pair.right));
  const reductions = tokenPairs
    .map((pair) => {
      const comparator = pair.right.usage.totalTokens;
      return comparator === 0 ? null : (comparator - pair.left.usage.totalTokens) / comparator;
    })
    .filter((value) => value !== null);
  // pairedDifferenceClusters reports left-right token deltas.  Reductions are
  // ratios, so retain task/repository membership and compute the ratio directly.
  const reductionByTask = new Map();
  for (const pair of tokenPairs) {
    const denominator = pair.right.usage.totalTokens;
    if (denominator === 0) continue;
    const key = clusterKey(pair.left);
    if (!reductionByTask.has(key)) reductionByTask.set(key, {key, repository: pair.left.corpus, values: []});
    reductionByTask.get(key).values.push((denominator - pair.left.usage.totalTokens) / denominator);
  }
  const reductionClustersForBootstrap = [...reductionByTask.values()];
  const reductionBootstrap = bootstrapTaskVectorMedian(reductionClustersForBootstrap, design.bootstrapReplicates, `${design.seed}:${label}:token-median`);
  const reductionMedianInterval = {lower: reductionBootstrap.lower, median: reductionBootstrap.median, upper: reductionBootstrap.upper, method: reductionBootstrap.method, samples: reductionBootstrap.samples, repositories: reductionBootstrap.repositories};
  const overhead = p90Overhead(pairs);
  const tokenReduction = tokenPairs.length === 0 || pairedRightUsage.totalTokens === null || pairedRightUsage.totalTokens === 0
    ? null
    : (pairedRightUsage.totalTokens - pairedLeftUsage.totalTokens) / pairedRightUsage.totalTokens;
  const strata = {
    taskClass: makeStratumRows(pairs, (pair) => pair.left.taskClass),
    language: makeStratumRows(pairs, (pair) => pair.left.corpus),
    corpus: makeStratumRows(pairs, (pair) => pair.left.corpus),
    knownTarget: makeStratumRows(pairs, (pair) => String(pair.left.knownTarget)),
    task: makeStratumRows(pairs, (pair) => `${pair.left.corpus}/${pair.left.taskId}`)
  };
  const limitations = [];
  if (completionDifferences.length < DEFAULT_LIMITED_CLUSTER_THRESHOLD) {
    limitations.push(`Only ${completionDifferences.length} independent corpus/task clusters support completion uncertainty; finite bounds are conservative.`);
  }
  if (qualityDifferences.length < DEFAULT_LIMITED_CLUSTER_THRESHOLD) {
    limitations.push(`Only ${qualityDifferences.length} independent corpus/task clusters have paired blinded grades; rubric bounds are conservative.`);
  }
  if (pairs.some((pair) => pair.left.usage === null || pair.right.usage === null)) {
    limitations.push("Some paired participant costs are unavailable; missing usage is not treated as zero.");
  }
  return {
    label,
    available: true,
    leftArm,
    rightArm,
    pairedRows: pairs.length,
    independentClusters: new Set(pairs.map((pair) => clusterKey(pair.left))).size,
    completion,
    quality,
    tokens: {
      left: leftUsage,
      right: rightUsage,
      paired: { left: pairedLeftUsage, right: pairedRightUsage },
      pairedRowsWithUsage: tokenPairs.length,
      totalTokenReduction: tokenReduction,
      pairedReductionMean: mean(reductions),
      minimumReduction: design.minimumTokenReduction,
      reductionMeetsMinimum: label === "portable-vs-legacy"
        ? (reductionMedianInterval.lower === null || quantile(reductions, 0.5) === null
          ? null
          : quantile(reductions, 0.5) >= design.minimumTokenReduction && reductionMedianInterval.lower > 0)
        : null,
      positiveMedianWithInterval: reductionMedianInterval.lower === null || quantile(reductions, 0.5) === null
        ? null
        : quantile(reductions, 0.5) > 0 && reductionMedianInterval.lower > 0,
      pairedReductionMedian: quantile(reductions, 0.5),
      pairedReductionP90: quantile(reductions, 0.9),
      medianPairedDownstreamReduction: quantile(reductions, 0.5),
      pairedReduction: {
        samples: reductions.length,
        median: quantile(reductions, 0.5),
        p90: quantile(reductions, 0.9),
        medianInterval: reductionMedianInterval
      },
      cachedAndReasoningAreReportedSeparately: true
    },
    overhead,
    criticalObservations: quality.criticalFailures,
    strata,
    limitations
  };
}

function emptyComparison(label, leftArm, rightArm, reason) {
  return {
    label,
    leftArm,
    rightArm,
    available: false,
    reason,
    pairedRows: 0,
    independentClusters: 0,
    completion: null,
    quality: null,
    tokens: null,
    overhead: null,
    criticalObservations: null,
    strata: { taskClass: [], language: [], corpus: [], knownTarget: [], task: [] },
    limitations: [reason]
  };
}

function expectedCells(design) {
  const cells = [];
  for (const task of design.expectedTasks) {
    for (let repeat = 1; repeat <= design.repeats; repeat += 1) {
      for (const arm of design.arms) cells.push(expectedCellKey(task, repeat, arm));
    }
  }
  return cells;
}

function pairedRows(uniqueRows, design, leftArm, rightArm) {
  const rows = [];
  for (const task of design.expectedTasks) {
    for (let repeat = 1; repeat <= design.repeats; repeat += 1) {
      const left = uniqueRows.get(expectedCellKey(task, repeat, leftArm));
      const right = uniqueRows.get(expectedCellKey(task, repeat, rightArm));
      if (left && right && sharedPairCompatible(left, right)) rows.push({ key: `${taskKey(task)}\u001f${repeat}`, left, right });
    }
  }
  return rows;
}

const SHARED_PAIR_FIELDS = Object.freeze(["sourceManifestSha256", "taskDatasetSha256", "protocolSha256", "toolchain"]);

function sharedPairMismatches(left, right) {
  const canonical = (value) => {
    if (Array.isArray(value)) return value.map(canonical);
    if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
    return value;
  };
  return SHARED_PAIR_FIELDS.filter((field) => JSON.stringify(canonical(left.provenance?.[field])) !== JSON.stringify(canonical(right.provenance?.[field])));
}

function sharedPairCompatible(left, right) {
  return sharedPairMismatches(left, right).length === 0;
}

function comparisonFor(uniqueRows, design, leftArm, rightArm, label) {
  if (!design.arms.includes(leftArm) || !design.arms.includes(rightArm)) {
    return emptyComparison(label, leftArm, rightArm, `Comparison requires both ${leftArm} and ${rightArm} in design.arms.`);
  }
  return analyzeComparison(pairedRows(uniqueRows, design, leftArm, rightArm), leftArm, rightArm, design);
}

function gateReasons({ diagnostics, comparisons, design, validRows }) {
  const reasons = [];
  if (diagnostics.invalidRows.length > 0) reasons.push("invalid-observations");
  if (diagnostics.duplicateCells.length > 0) reasons.push("duplicate-cells");
  if (diagnostics.missingCells.length > 0) reasons.push("missing-expected-cells");
  if (diagnostics.unexpectedCells.length > 0) reasons.push("unexpected-cells");
  if (diagnostics.duplicateRunIds.length > 0) reasons.push("duplicate-run-ids");
  if (diagnostics.missingUsage.length > 0) reasons.push("missing-usage");
  if (diagnostics.missingQuality.length > 0) reasons.push("missing-quality");
  if (diagnostics.nonCompletedRows.length > 0) reasons.push("non-completed-rows");
  if (diagnostics.metadataMismatches.length > 0) reasons.push("expected-task-metadata-mismatch");
  if (diagnostics.provenanceMismatches.length > 0) reasons.push("shared-provenance-mismatch");
  const navigation = design.navigationEvidence;
  if (!navigation?.measured) reasons.push("navigation-evidence-unmeasured");
  else if (!navigation.firstUsefulImprovement) reasons.push("navigation-first-useful-not-improved");
  for (const comparison of Object.values(comparisons)) {
    if (!comparison.available) {
      reasons.push(`${comparison.label}-not-designed`);
      continue;
    }
    if (comparison.pairedRows === 0) reasons.push(`${comparison.label}-no-pairs`);
    if (comparison.completion.nonInferiority.status !== "pass") reasons.push(`${comparison.label}-completion-${comparison.completion.nonInferiority.status}`);
    if (comparison.quality.nonInferiority.status !== "pass") reasons.push(`${comparison.label}-quality-${comparison.quality.nonInferiority.status}`);
    if (comparison.quality.criticalFailures?.left?.rowsWithCriticalFailures > 0) reasons.push(`${comparison.label}-critical-failure-left`);
    if (comparison.label === "portable-vs-legacy" && comparison.tokens.reductionMeetsMinimum !== true) reasons.push(`${comparison.label}-median-token-reduction-not-supported`);
    if (comparison.label !== "portable-vs-legacy" && comparison.tokens.positiveMedianWithInterval !== true) reasons.push(`${comparison.label}-positive-median-token-evidence-not-supported`);
    if (comparison.label === "portable-vs-compact" && navigation?.mapValueVsCompact !== true) reasons.push(`${comparison.label}-map-value-not-established`);
    if (comparison.label === "standalone-portable-vs-source" && navigation?.standaloneBenefit !== true) reasons.push(`${comparison.label}-standalone-benefit-not-established`);
  }
  if (validRows.length === 0) reasons.push("no-valid-observations");
  return [...new Set(reasons)];
}

/**
 * Analyze observed rows against an explicit frozen design.
 *
 * The returned disposition is deliberately conservative.  Missing or invalid
 * rows and uncertain finite-sample bounds remain visible; callers must opt in
 * with allowIncomplete/allowInconclusive to treat those outputs as usable.
 */
export function analyzeStudy(observations, design) {
  const designResult = validateDesign(design);
  if (!designResult.valid) {
    return {
      schemaVersion: OBSERVATION_SCHEMA_VERSION,
      valid: false,
      status: "invalid-design",
      disposition: "invalid-design",
      decisionAllowed: false,
      designErrors: designResult.errors,
      diagnostics: {
        invalidRows: [],
        duplicateCells: [],
        duplicateRunIds: [],
        missingCells: [],
        unexpectedCells: [],
        missingUsage: [],
        missingQuality: [],
        metadataMismatches: [],
        provenanceMismatches: []
      },
      comparisons: {},
      limitations: ["No estimates are produced until the explicit study design validates."]
    };
  }
  const normalizedDesign = designResult.design;
  const diagnostics = {
    invalidRows: [],
    duplicateCells: [],
    duplicateRunIds: [],
    missingCells: [],
    unexpectedCells: [],
    missingUsage: [],
    missingQuality: [],
    nonCompletedRows: [],
    metadataMismatches: [],
    provenanceMismatches: []
  };
  const uniqueRows = new Map();
  const cellRunIds = new Map();
  const ambiguousCells = new Set();
  const runIds = new Map();
  const validatedRows = [];
  const expected = new Set(expectedCells(normalizedDesign));
  const rows = Array.isArray(observations) ? observations : [];
  if (!Array.isArray(observations)) diagnostics.invalidRows.push({ index: null, errors: [error("invalid-type", "observations must be an array")] });

  rows.forEach((row, index) => {
    const result = validateObservation(row, { study: normalizedDesign.study });
    if (!result.valid) {
      diagnostics.invalidRows.push({ index, runId: row?.runId ?? null, errors: result.errors });
      return;
    }
    validatedRows.push(row);
    const key = cellKey(row);
    const expectedTask = normalizedDesign.expectedTasks.find((task) => task.corpus === row.corpus && task.taskId === row.taskId);
    if (expectedTask && (expectedTask.taskClass !== row.taskClass || expectedTask.knownTarget !== row.knownTarget)) {
      diagnostics.metadataMismatches.push({
        index,
        runId: row.runId,
        expected: {taskClass: expectedTask.taskClass, knownTarget: expectedTask.knownTarget},
        actual: {taskClass: row.taskClass, knownTarget: row.knownTarget}
      });
      return;
    }
    if (!expected.has(key)) {
      diagnostics.unexpectedCells.push({ index, runId: row.runId, cell: displayCellKey(key) });
      return;
    }
    if (row.status !== "completed") {
      diagnostics.nonCompletedRows.push({cell: displayCellKey(key), runId: row.runId, status: row.status});
    }
    if (runIds.has(row.runId)) {
      diagnostics.duplicateRunIds.push({ runId: row.runId, indices: [runIds.get(row.runId), index] });
    } else {
      runIds.set(row.runId, index);
    }
    const seenRunIds = cellRunIds.get(key) ?? [];
    if (seenRunIds.includes(row.runId)) {
      return;
    }
    if (seenRunIds.length > 0) {
      const duplicateCell = displayCellKey(key);
      diagnostics.duplicateCells.push({ cell: duplicateCell, runIds: [...seenRunIds, row.runId] });
      ambiguousCells.add(key);
      uniqueRows.delete(key);
    } else if (!ambiguousCells.has(key)) {
      uniqueRows.set(key, row);
    }
    cellRunIds.set(key, [...seenRunIds, row.runId]);
    if (row.usage === null) diagnostics.missingUsage.push({ cell: displayCellKey(key), runId: row.runId });
    if (row.quality === null) diagnostics.missingQuality.push({ cell: displayCellKey(key), runId: row.runId });
  });

  for (const key of expected) {
    if (!uniqueRows.has(key)) diagnostics.missingCells.push(displayCellKey(key));
  }
  for (const task of normalizedDesign.expectedTasks) {
    for (let repeat = 1; repeat <= normalizedDesign.repeats; repeat += 1) {
      for (const [leftArm, rightArm] of [["blueprint-portable", "blueprint-legacy"], ["blueprint-portable", "blueprint-compact"], ["standalone-portable", "standalone-source"]]) {
        const left = uniqueRows.get(expectedCellKey(task, repeat, leftArm));
        const right = uniqueRows.get(expectedCellKey(task, repeat, rightArm));
        if (left && right) {
          const mismatches = sharedPairMismatches(left, right);
          if (mismatches.length > 0) diagnostics.provenanceMismatches.push({cell: `${taskKey(task)}/${repeat}`, leftArm, rightArm, fields: mismatches});
        }
      }
    }
  }
  const validRows = [...uniqueRows.values()];
  const chargedByRunId = new Map();
  for (const row of validatedRows) if (!chargedByRunId.has(row.runId)) chargedByRunId.set(row.runId, row);
  const chargedRows = [...chargedByRunId.values()];
  // Participant accounting follows the deduplicated charged ledger. Inference
  // uses only unambiguous expected cells below, but every distinct observed run
  // remains visible in cost accounting, including retries and unexpected cells.
  const allRowsSummary = summarizeUsage(chargedRows);
  const duplicateCellRunIds = diagnostics.duplicateCells.flatMap((item) => item.runIds);
  const duplicateCellDistinctRunIds = [...new Set(duplicateCellRunIds)];
  const chargedRetryRunIds = [...new Set(diagnostics.duplicateCells.flatMap((item) => item.runIds.slice(1)))];
  const unexpectedRunIds = [...new Set(validatedRows.filter((row) => !expected.has(cellKey(row))).map((row) => row.runId))];
  const allQualitySummary = summarizeCritical(validRows);
  const portableVsLegacy = comparisonFor(uniqueRows, normalizedDesign, "blueprint-portable", "blueprint-legacy", "portable-vs-legacy");
  const portableVsCompact = comparisonFor(uniqueRows, normalizedDesign, "blueprint-portable", "blueprint-compact", "portable-vs-compact");
  const standalonePortableVsSource = comparisonFor(uniqueRows, normalizedDesign, "standalone-portable", "standalone-source", "standalone-portable-vs-source");
  const comparisons = { portableVsLegacy, portableVsCompact, standalonePortableVsSource };
  const reasons = gateReasons({ diagnostics, comparisons, design: normalizedDesign, validRows });
  const incompleteReasons = reasons.filter((reason) => !reason.includes("completion-") && !reason.includes("quality-") && !reason.includes("token-reduction"));
  const uncertaintyReasons = reasons.filter((reason) => reason.includes("completion-") || reason.includes("quality-") || reason.includes("token-reduction"));
  const incomplete = incompleteReasons.length > 0;
  const inconclusive = !incomplete && uncertaintyReasons.length > 0;
  let disposition = "decision-ready";
  if (incomplete) disposition = normalizedDesign.allowIncomplete ? "incomplete-opt-in" : "incomplete";
  else if (inconclusive) disposition = normalizedDesign.allowInconclusive ? "inconclusive-opt-in" : "inconclusive";
  const limitations = [
    "These are descriptive observed-result estimates; no causal or hosted-model claim is made.",
    "Bootstrap intervals resample corpus/task clusters and never treat repeats as independent tasks.",
    "Finite-sample bounds use a conservative bounded-difference inequality; zero-discordance bootstrap intervals do not prove quality parity.",
    "Participant usage is separate from helper, parent, and map accounting; those scopes are unavailable unless separately observed."
  ];
  if (allQualitySummary.gradedRows > 0 && allQualitySummary.gradedRows < DEFAULT_LIMITED_CLUSTER_THRESHOLD) {
    limitations.push("Fewer than four graded rows are available for broad quality interpretation; this study output remains limited.");
  }
  if (incomplete) limitations.push(`Default decision gate is blocked by: ${incompleteReasons.join(", ")}.`);
  if (inconclusive) limitations.push(`Default decision gate is inconclusive because: ${uncertaintyReasons.join(", ")}.`);
  return {
    schemaVersion: OBSERVATION_SCHEMA_VERSION,
    valid: diagnostics.invalidRows.length === 0 &&
      diagnostics.duplicateCells.length === 0 &&
      diagnostics.duplicateRunIds.length === 0 &&
      diagnostics.missingCells.length === 0 &&
      diagnostics.unexpectedCells.length === 0 &&
      diagnostics.metadataMismatches.length === 0 &&
      diagnostics.provenanceMismatches.length === 0,
    status: incomplete ? "incomplete" : inconclusive ? "inconclusive" : "complete",
    disposition,
    decisionAllowed: reasons.length === 0,
    exploratoryAllowed: normalizedDesign.allowIncomplete || normalizedDesign.allowInconclusive,
    optIn: {
      allowIncomplete: normalizedDesign.allowIncomplete,
      allowInconclusive: normalizedDesign.allowInconclusive,
      requested: normalizedDesign.allowIncomplete || normalizedDesign.allowInconclusive
    },
    design: normalizedDesign,
    diagnostics,
    accounting: {
      participant: allRowsSummary,
      rawObserved: summarizeUsage(validatedRows),
      chargedObserved: summarizeUsage(chargedRows),
      observedCostLedger: {
        distinctRunIds: new Set(validatedRows.map((row) => row.runId)).size,
        unexpectedRunIds,
        duplicateCellRunIds,
        deduplicatedRunIds: duplicateCellDistinctRunIds,
        chargedRetryRunIds,
        invalidRowsHaveNoInferredCost: true,
        inferenceExcludesUnexpectedAndDuplicateCells: true
      },
      quality: allQualitySummary,
      helper: { totalTokens: null, cachedInputTokens: null, reasoningOutputTokens: null, status: "unavailable" },
      parent: { totalTokens: null, cachedInputTokens: null, reasoningOutputTokens: null, status: "unavailable" },
      map: { totalTokens: null, cachedInputTokens: null, reasoningOutputTokens: null, status: "unavailable" },
      absentScopesAreNotCalledZero: true
    },
    comparisons,
    gate: {
      defaultPass: reasons.length === 0,
      incomplete,
      inconclusive,
      reasons,
      incompleteReasons,
      uncertaintyReasons
    },
    limitations
  };
}
