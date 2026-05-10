export function validPhaseContextModel(
  options: {
    openQuestions?: string[];
    phaseLabel?: string;
    projectBrief?: string;
    decision?: string;
  } = {}
): Record<string, unknown> {
  const phaseLabel = options.phaseLabel ?? "phase 3";

  return {
    phaseBoundary: {
      goal: `Capture durable discovery context for ${phaseLabel}.`,
      inScope: [
        "Persist phase-scoped discovery decisions for downstream planning.",
        "Keep saved context grounded in Blueprint-managed artifacts."
      ],
      outOfScope: [
        "Change implementation code during discovery.",
        "Rewrite later lifecycle artifacts from the context writer."
      ],
      successCriteria: [
        "Saved context validates through the phase.context schema and renderer.",
        "Downstream commands can reuse the saved context without re-eliciting basics."
      ]
    },
    discoveryGrounding: {
      projectBrief:
        options.projectBrief ??
        "Blueprint stores phase planning artifacts under .blueprint/phases/.",
      requirementsGrounding: [
        "Discovery output must stay usable by research, UI, and planning commands."
      ],
      workflowPosture:
        "Discuss-phase owns context authoring and repair before downstream work begins.",
      confirmedDecisions: [
        "Structured phase.context models are the semantic source of truth."
      ]
    },
    implementationDecisions: [
      {
        decision:
          options.decision ??
          "Render context Markdown from a structured model.",
        tradeoffOrConstraint:
          "Existing downstream readers still parse the canonical rendered Markdown."
      }
    ],
    specificIdeas: [
      "Keep context authoring explicit so later planning does not infer filler prose.",
      "Preserve exact section-level semantics through validation and repair loops."
    ],
    existingCodeInsights: [
      "src/mcp/tools/phase.ts owns phase artifact persistence.",
      "src/mcp/artifact-contracts/index.ts owns the phase.context contract."
    ],
    dependencies: {
      priorPhaseArtifacts: [".blueprint/ROADMAP.md"],
      externalConstraints: ["Do not mutate host-global Blueprint state."],
      requiredFollowUpReads: [
        "src/mcp/tools/phase.ts",
        "src/mcp/artifact-contracts/index.ts"
      ]
    },
    openQuestions: options.openQuestions ?? ["Which gray area should be discussed next?"],
    deferredIdeas: [
      "Revisit optional refinements only after the current phase boundary stays stable."
    ],
    canonicalReferences: [
      {
        source: "src/mcp/tools/phase.ts",
        relevance: "Defines blueprint_phase_artifact_write behavior."
      },
      {
        source: "src/mcp/artifact-contracts/index.ts",
        relevance: "Defines the phase.context schema and renderer contract."
      }
    ]
  };
}
