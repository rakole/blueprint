export type LightweightMode = "fast" | "quick";

export type LightweightRoute =
  | "fast"
  | "quick"
  | "debug"
  | "plan-phase"
  | "execute-phase"
  | "health"
  | "new-project"
  | "clarify";

export type ValidationBudget = "none" | "cheap" | "ask" | "route";
export type ScopeConfidence = "high" | "medium" | "low";

export type ScopeClassification = {
  route: LightweightRoute;
  confidence: ScopeConfidence;
  reasons: string[];
  allowedWrites: string[];
  requiredGates: string[];
  validationBudget: ValidationBudget;
};

export type LightweightClassifierFlags = {
  discuss?: boolean;
  research?: boolean;
  validate?: boolean;
  full?: boolean;
};

export type ClassifyLightweightScopeArgs = {
  mode: LightweightMode;
  taskText: string;
  flags?: LightweightClassifierFlags;
};

const VAGUE_TASK_PATTERNS = [
  /^fix it$/,
  /^make better$/,
  /^do quick$/,
  /^update stuff$/,
  /^update this$/,
  /^improve this$/,
  /^clean this up$/,
  /^help$/,
  /^do it$/,
] as const;

const INVESTIGATION_PATTERNS = [
  /\binvestigat(?:e|ing|ion)\b/,
  /\bfailing\b/,
  /\bflaky\b/,
  /\berror\b/,
  /\bexception\b/,
  /\bstack trace\b/,
  /\bregression\b/,
  /\bdebug\b/,
  /\bdiagnos(?:e|is|ing)\b/,
  /\broot cause\b/,
  /\bwhy (?:does|is|are)\b/,
] as const;

const PLAN_PHASE_PATTERNS = [
  /\barchitecture\b/,
  /\barchitectural\b/,
  /\brefactor\b/,
  /\bmigration\b/,
  /\bmigrate\b/,
  /\bmulti-wave\b/,
  /\brollout\b/,
  /\bcross-cutting\b/,
  /\bmultiple subsystems\b/,
  /\bseveral subsystems\b/,
  /\bbroad\b/,
  /\brepo-wide\b/,
  /\ball commands\b/,
  /\ball packages\b/,
  /\ball routes\b/,
  /\ball schemas\b/,
  /\bnew schema\b/,
  /\bsaved plan\b/,
  /\bphase plan\b/,
] as const;

const EXECUTE_PHASE_PATTERNS = [
  /\bexecute phase\b/,
  /\bexecute the plan\b/,
  /\bcarry out the plan\b/,
  /\bimplement the plan\b/,
  /\bship the rollout\b/,
  /\broll out\b/,
] as const;

const HEALTH_PATTERNS = [
  /\bhealth check\b/,
  /\bproject health\b/,
  /\bunhealthy\b/,
  /\bpartial blueprint\b/,
  /\brepair blueprint state\b/,
  /\bfix blueprint state\b/,
] as const;

const NEW_PROJECT_PATTERNS = [
  /\bnew project\b/,
  /\bstart a project\b/,
  /\bcreate a project\b/,
  /\bbootstrap (?:a |an )?(?:new )?(?:blueprint |project|repo|repository|workspace)\b/,
  /\bbootstrap(?:ing)? (?:this |the )?(?:blueprint |project|repo|repository|workspace)\b/,
  /\binitialize (?:a |an )?(?:new )?(?:blueprint |project|repo|repository|workspace)\b/,
  /\binitialize(?:d|ing)? (?:this |the )?(?:blueprint |project|repo|repository|workspace)\b/,
  /\bset up a project\b/,
] as const;

const FAST_SURFACE_PATTERNS = [
  /\breadme\b/,
  /\bdocs?\b/,
  /\bdocumentation\b/,
  /\bheading\b/,
  /\bcomment\b/,
  /\bcopy\b/,
  /\bwording\b/,
  /\bspelling\b/,
  /\btypo\b/,
  /\bpackage description\b/,
] as const;

const FAST_EDIT_PATTERNS = [
  /\bfix typo\b/,
  /\bfix spelling\b/,
  /\bupdate wording\b/,
  /\brename heading\b/,
  /\bupdate package description\b/,
  /\bclarify\b/,
] as const;

const QUICK_ACTION_PATTERNS = [
  /\brename\b/,
  /\bupdate\b/,
  /\bfix\b/,
  /\bchange\b/,
  /\badd\b/,
  /\bremove\b/,
  /\bedit\b/,
  /\badjust\b/,
  /\bwire\b/,
  /\bpatch\b/,
  /\bbootstrap\b/,
  /\binitialize\b/,
] as const;

const BROAD_MIGRATION_PATTERNS = [
  /\bmigrate all\b/,
  /\bacross the repo\b/,
  /\bevery command\b/,
  /\ball command[s]?\b/,
  /\bentire\b/,
  /\bglobal\b/,
] as const;

const QUICK_SCOPE_RISK_PATTERNS = [
  /\bacross\b/,
  /\bfront-?end\b.*\bback-?end\b/,
  /\bback-?end\b.*\bfront-?end\b/,
  /\bclient\b.*\bserver\b/,
  /\bserver\b.*\bclient\b/,
  /\bdocs?\b.*\btests?\b.*\brelease notes?\b/,
  /\brelease notes?\b.*\bdocs?\b.*\btests?\b/,
  /\bmultiple (?:files|modules|packages|surfaces|areas)\b/,
  /\bseveral (?:files|modules|packages|surfaces|areas)\b/,
] as const;

const MULTI_FILE_OR_ARCHITECTURE_PATTERNS = [
  /\band update\b/,
  /\band add\b/,
  /\band rename\b/,
  /\band remove\b/,
  /\btests?\b/,
  /\barchitecture\b/,
  /\bsubsystems?\b/,
] as const;

function normalizeTaskText(taskText: string): string {
  return taskText.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function hasFastDisqualifier(
  taskText: string,
  flags: LightweightClassifierFlags | undefined,
): boolean {
  return Boolean(
    flags?.discuss ||
      flags?.research ||
      flags?.validate ||
      flags?.full ||
      matchesAny(taskText, INVESTIGATION_PATTERNS) ||
      matchesAny(taskText, BROAD_MIGRATION_PATTERNS) ||
      matchesAny(taskText, MULTI_FILE_OR_ARCHITECTURE_PATTERNS),
  );
}

function isExplicitlyVague(taskText: string): boolean {
  if (taskText.length === 0) {
    return true;
  }

  if (VAGUE_TASK_PATTERNS.some((pattern) => pattern.test(taskText))) {
    return true;
  }

  const words = taskText.split(" ");

  return words.length <= 2 && !matchesAny(taskText, FAST_SURFACE_PATTERNS);
}

function qualifiesForFast(
  taskText: string,
  flags: LightweightClassifierFlags | undefined,
): boolean {
  if (hasFastDisqualifier(taskText, flags)) {
    return false;
  }

  return (
    matchesAny(taskText, FAST_EDIT_PATTERNS) &&
    matchesAny(taskText, FAST_SURFACE_PATTERNS)
  );
}

function qualifiesForQuick(taskText: string): boolean {
  return (
    matchesAny(taskText, QUICK_ACTION_PATTERNS) &&
    !matchesAny(taskText, BROAD_MIGRATION_PATTERNS) &&
    !matchesAny(taskText, QUICK_SCOPE_RISK_PATTERNS) &&
    !matchesAny(taskText, EXECUTE_PHASE_PATTERNS) &&
    !matchesAny(taskText, NEW_PROJECT_PATTERNS) &&
    !matchesAny(taskText, HEALTH_PATTERNS)
  );
}

function buildClassification(
  route: LightweightRoute,
  confidence: ScopeConfidence,
  reasons: string[],
  allowedWrites: string[],
  requiredGates: string[],
  validationBudget: ValidationBudget,
): ScopeClassification {
  return {
    route,
    confidence,
    reasons,
    allowedWrites,
    requiredGates,
    validationBudget,
  };
}

export function classifyLightweightScope({
  mode,
  taskText,
  flags,
}: ClassifyLightweightScopeArgs): ScopeClassification {
  const normalizedTaskText = normalizeTaskText(taskText);

  if (normalizedTaskText.length === 0) {
    return buildClassification(
      "clarify",
      "high",
      ["Task text is blank."],
      [],
      ["task-clarity"],
      "ask",
    );
  }

  if (isExplicitlyVague(normalizedTaskText)) {
    return buildClassification(
      "clarify",
      "high",
      ["Task text is too vague for deterministic routing."],
      [],
      ["task-clarity"],
      "ask",
    );
  }

  if (matchesAny(normalizedTaskText, HEALTH_PATTERNS)) {
    return buildClassification(
      "health",
      "high",
      ["Task asks for repo or Blueprint health recovery."],
      [],
      ["project-health"],
      "route",
    );
  }

  if (matchesAny(normalizedTaskText, NEW_PROJECT_PATTERNS)) {
    return buildClassification(
      "new-project",
      "high",
      ["Task is project bootstrap or initialization work."],
      [".blueprint/ bootstrap artifacts through MCP"],
      ["bootstrap-intent"],
      "route",
    );
  }

  if (matchesAny(normalizedTaskText, INVESTIGATION_PATTERNS)) {
    return buildClassification(
      "debug",
      "high",
      ["Task is symptom-first or investigation-oriented."],
      [],
      ["issue-statement"],
      "ask",
    );
  }

  if (matchesAny(normalizedTaskText, EXECUTE_PHASE_PATTERNS)) {
    return buildClassification(
      "execute-phase",
      "high",
      ["Task explicitly asks for saved-plan or rollout execution."],
      ["phase execution summaries through MCP"],
      ["saved-plan"],
      "route",
    );
  }

  if (
    matchesAny(normalizedTaskText, PLAN_PHASE_PATTERNS) ||
    matchesAny(normalizedTaskText, BROAD_MIGRATION_PATTERNS) ||
    matchesAny(normalizedTaskText, QUICK_SCOPE_RISK_PATTERNS)
  ) {
    return buildClassification(
      "plan-phase",
      "high",
      ["Task looks broad, architectural, or migration-oriented."],
      [],
      ["scope-review"],
      "route",
    );
  }

  if (mode === "fast" && qualifiesForFast(normalizedTaskText, flags)) {
    return buildClassification(
      "fast",
      "high",
      ["Task is an explicit trivial text or docs edit."],
      ["repo files", ".blueprint/STATE.md through blueprint_state_update"],
      [],
      "none",
    );
  }

  if (qualifiesForQuick(normalizedTaskText)) {
    const reasons = ["Task is explicit and bounded but not trivial inline work."];

    if (mode === "fast") {
      reasons.push("Fast mode can reroute bounded non-trivial work to quick.");
    }

    if (flags?.validate || /\btests?\b/.test(normalizedTaskText)) {
      reasons.push("Task suggests cheap validation should stay in scope.");
    }

    return buildClassification(
      "quick",
      mode === "fast" ? "high" : "medium",
      reasons,
      [
        "repo files",
        "quick-run-latest through blueprint_artifact_report_write",
        ".blueprint/STATE.md through blueprint_state_update",
      ],
      flags?.validate || /\btests?\b/.test(normalizedTaskText)
        ? ["cheap-validation"]
        : [],
      "cheap",
    );
  }

  return buildClassification(
    "clarify",
    "low",
    ["Task does not match a safe deterministic lightweight route."],
    [],
    ["task-clarity"],
    "ask",
  );
}
