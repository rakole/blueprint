# Schema-First Document Migration Progress

## Changed Artifact Families

- `report.quick-run`: moved from metadata-only model contract exposure to schema-backed authoring context, model validation, MCP Markdown rendering, and model-only persistence through `blueprint_artifact_report_write`.
- `phase.context`: moved context persistence to model-only input on `blueprint_phase_artifact_write`; MCP validates the model against `phase.context.modelContract`, renders canonical `XX-CONTEXT.md`, and then applies rendered-shape validation before persistence.

## Removed Legacy / Freehand Behaviors

- `report.quick-run` no longer accepts Markdown `content` fallback; hand-written quick-run Markdown is rejected with model-only diagnostics.
- `report.quick-run` contract required headings now match the model-rendered surface, including `Changed Surfaces` and `Evidence Used`.
- `phase.context` no longer accepts prompt-authored Markdown `content`; Markdown fallback is rejected with model-only diagnostics and model identity/path fields remain MCP-owned.

## Verification Log

- `npm ci` - passed.
- `npx tsx --test tests/lifecycle-pilot-integration.test.ts` - passed.
- `npm run typecheck` - passed after each source slice.
- `npx tsx --test tests/artifact-contracts.test.ts tests/quick-metadata.test.ts tests/lightweight-execution-regression.test.ts` - failed once on stale quick runtime-reference wording, then `npx tsx --test tests/lightweight-execution-regression.test.ts` passed after doc repair.
- `npx tsx --test tests/mcp-contract-audit-metadata.test.ts tests/command-contract-docs.test.ts` - passed.
- `npx tsx --test tests/context-diagnostics.test.ts tests/context-contract-parity.test.ts` - passed after renderer placeholder-label repair.
- `npx tsx --test tests/phase-discovery-discuss.test.ts tests/phase-discovery-ui.test.ts tests/phase-discovery-research.test.ts` - passed.
- `npm test` - passed before the final `phase.context` model-only tightening.
- `npx tsx --test tests/context-diagnostics.test.ts tests/phase-discovery-discuss.test.ts tests/phase-discovery-ui.test.ts tests/phase-discovery-research.test.ts tests/mcp-server-summary.test.ts` - passed after the final `phase.context` Markdown fallback rejection.
- `npm run typecheck` - passed after final source and docs alignment.
- `npm run build` - passed after final source and docs alignment.
- `npx tsx --test tests/phase-discovery-discuss.test.ts tests/command-contract-docs.test.ts tests/mcp-contract-audit-metadata.test.ts` - passed after runtime-facing wording alignment.
- `npx tsx --test tests/phase-discovery-discuss.test.ts tests/command-contract-docs.test.ts tests/mcp-contract-audit-metadata.test.ts tests/context-diagnostics.test.ts tests/mcp-server-summary.test.ts` - passed after final wording and public-response test updates.
- `npm test` - passed after final source and docs alignment: 1137 passed, 0 failed.
