export type PhaseSummaryModelDiagnosticSource = "scope" | "schema" | "residual" | "markdown";

export type PhaseSummaryModelDiagnostic = {
  source: PhaseSummaryModelDiagnosticSource;
  path: string;
  code: string;
  message: string;
  context: Record<string, unknown>;
  suggestion: string;
};

export type PhaseSummaryDiagnosticCounts = {
  total: number;
  bySource: Record<PhaseSummaryModelDiagnosticSource, number>;
  byCode: Record<string, number>;
};

export function phaseSummaryDiagnostic(
  args: PhaseSummaryModelDiagnostic
): PhaseSummaryModelDiagnostic {
  return args;
}

export function emptyPhaseSummaryDiagnosticCounts(): PhaseSummaryDiagnosticCounts {
  return {
    total: 0,
    bySource: {
      scope: 0,
      schema: 0,
      residual: 0,
      markdown: 0
    },
    byCode: {}
  };
}

export function countPhaseSummaryDiagnostics(
  diagnostics: PhaseSummaryModelDiagnostic[]
): PhaseSummaryDiagnosticCounts {
  const counts = emptyPhaseSummaryDiagnosticCounts();

  for (const diagnostic of diagnostics) {
    counts.total += 1;
    counts.bySource[diagnostic.source] += 1;
    counts.byCode[diagnostic.code] = (counts.byCode[diagnostic.code] ?? 0) + 1;
  }

  return counts;
}

export function formatPhaseSummaryDiagnostic(diagnostic: PhaseSummaryModelDiagnostic): string {
  return `${diagnostic.source}:${diagnostic.path}:${diagnostic.code}: ${diagnostic.message} Suggestion: ${diagnostic.suggestion}`;
}
