# Discussion recovery (load only when needed)

- Revision conflict: use prepare's compact session or discuss_read for the exact
  saved candidate, merge new answers against current records, retry with the
  returned expectedRevision and a new requestId. Never reuse a requestId with
  changed arguments.
- Changed inputs: prepare returns changedPaths, affectedRecordIds and whether the
  candidate needs review. Review those inputs, ask about conflicting/high-impact
  decisions, save field/record corrections, then prepare with expectedRevision and
  acknowledgeChangedInputs=true. This acknowledges a reviewed basis; it does not
  erase history. Raw drafts can always be saved while publication is stale.
- Canonical context/log or topology changed: review the current packet and ask for
  explicit target reconciliation. Prepare with expectedRevision and reconcile:
  {confirmed:true, contextHash:<packet context hash>, logHash:<packet log hash>}.
  Also acknowledge changed evidence when requested. This archives the old journal
  and baseline. Overwrite confirmation is separate and still required to publish.
- Partial finalize: preserve the receipt and saved draft. Retry the same requestId
  and identical arguments after resolving the failure. MCP verifies already
  published bytes and resumes unfinished stages; do not manually rewrite files,
  update STATE, or delete checkpoints. Externally changed published targets require
  explicit reconciliation before a new publication.
- Malformed candidate: discuss_read returns exact raw data. Repair individual
  object/array fields through record.corrections; remove unsupported fields with
  operation: "remove" and the exact field path. Schema diagnostics are field-addressed. Repeated
  identical errors should stop with a saved draft and exact diagnostics, not a
  claim of completion or a source-code investigation during the product workflow.
