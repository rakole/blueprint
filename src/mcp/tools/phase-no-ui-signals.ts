import {
  extractMarkdownHeading,
} from "./phase-markdown.js";

type NoUiSignalArgs = {
  contextContent?: string | null;
};

type NoUiSignalDetection = {
  bypassAllowed: boolean;
  strongNoUiSignals: string[];
  positiveUiSignals: string[];
};

const CONTEXT_LINE_PREFIXES_TO_IGNORE = [
  /^workflow posture\b/i,
  /^requirements grounding\b/i,
  /^prior-context sweep\b/i
];

const PROCESS_ONLY_LINE_PATTERN =
  /(?:\/blu-|ui-spec|workflow\.ui_phase|ui\s+gates?\b|phase-scoped artifacts|\.blueprint\/)/i;

const STRONG_NO_UI_PATTERNS = [
  /\bno\s+ui\b/gi,
  /\bno\s+user\s+interface\b/gi,
  /\bno\s+frontend\b/gi,
  /\bno\s+front-end\b/gi,
  /\bno\s+web(?:\s+ui|\s+interface)?\b/gi,
  /\bwithout\s+(?:any\s+)?ui\b/gi,
  /\bwithout\s+(?:any\s+)?user\s+interface\b/gi,
  /\bwithout\s+(?:any\s+)?frontend\b/gi,
  /\bwithout\s+(?:any\s+)?front-end\b/gi,
  /\bbackend[-\s]+only\b/gi,
  /\bapi[-\s]+only\b/gi,
  /\bservice[-\s]+only\b/gi,
  /\bcli[-\s]+only\b/gi,
  /\b(?:purely|strictly|entirely)\s+backend\b/gi,
  /\bno\s+user[-\s]?facing\s+(?:ui|frontend|screen|screens|view|views|page|pages)\b/gi,
  /\bnot\s+user[-\s]?facing\s+(?:ui|frontend|screen|screens|view|views|page|pages)\b/gi,
  /\bno\s+user[-\s]?facing\b/gi,
  /\bnot\s+user[-\s]?facing\b/gi,
  /\bheadless\s+(?:service|worker|job|api|backend)\b/gi
];

const POSITIVE_UI_SIGNAL_PATTERN =
  /\b(?:frontend|front-end|web|ui|user\s+interface|screen|view|form|dashboard|page|component|layout|navigation|react|mobile|ios|android|design[\s-]system|browser|ux|html|css)\b/i;

function normalizeSignalLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function normalizeLineForPrefixMatching(line: string): string {
  return line.replace(/^(?:[-*+]\s+|\d+\.\s+)/, "").trim();
}

function collectContextSignalLines(content: string): string[] {
  const heading = extractMarkdownHeading(content);
  const contentLines = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(normalizeSignalLine)
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  return [
    ...(heading ? [normalizeSignalLine(heading)] : []),
    ...contentLines
  ].filter(
    (line) =>
      !CONTEXT_LINE_PREFIXES_TO_IGNORE.some((pattern) =>
        pattern.test(normalizeLineForPrefixMatching(line))
      )
  );
}

function collectSignalLines(args: NoUiSignalArgs): string[] {
  return args.contextContent ? collectContextSignalLines(args.contextContent) : [];
}

export function detectStrongExplicitNoUiSignal(args: NoUiSignalArgs): NoUiSignalDetection {
  const strongNoUiSignals = new Set<string>();
  const positiveUiSignals = new Set<string>();

  for (const line of collectSignalLines(args)) {
    if (PROCESS_ONLY_LINE_PATTERN.test(line)) {
      continue;
    }

    let positiveScanLine = line;
    let matchedStrongNoUiSignal = false;

    for (const pattern of STRONG_NO_UI_PATTERNS) {
      pattern.lastIndex = 0;

      if (pattern.test(positiveScanLine)) {
        matchedStrongNoUiSignal = true;
        strongNoUiSignals.add(line);
        positiveScanLine = positiveScanLine.replace(pattern, " ");
      }
    }

    if (matchedStrongNoUiSignal) {
      positiveScanLine = normalizeSignalLine(positiveScanLine);
    }

    if (positiveScanLine.length > 0 && POSITIVE_UI_SIGNAL_PATTERN.test(positiveScanLine)) {
      positiveUiSignals.add(line);
    }
  }

  return {
    bypassAllowed: strongNoUiSignals.size > 0 && positiveUiSignals.size === 0,
    strongNoUiSignals: [...strongNoUiSignals],
    positiveUiSignals: [...positiveUiSignals]
  };
}
