# Discussion recovery (load only when needed)

- Revision conflict: prepare or discuss_read returns notes and history. Merge new
  answers against current records, then use the returned expectedRevision and a
  new requestId. Record retries reuse the same requestId and identical arguments.
- Changed inputs: review changedPaths and affectedRecordIds, ask about conflicting
  or high-impact decisions, update notes, then prepare with expectedRevision and
  acknowledgeChangedInputs=true. This acknowledges the reviewed basis without
  erasing notes history.
- Canonical context/log or topology changed: review the packet and ask for explicit
  target reconciliation. Prepare with expectedRevision and reconcile:
  {confirmed:true, contextHash:<packet context hash>, logHash:<packet log hash>}.
  Acknowledge changed evidence when requested. This archives metadata for the old
  journal and baseline. Substantive overwrite confirmation remains separate.
- Rejected-not-saved: the model was not stored. Use returned diagnostics to correct
  the in-memory model if still available and submit to finalize; do not tell the
  user a draft was saved. Otherwise regenerate from resumable notes and defaults.
- Interrupted finalize: before context commits, resubmit the model with the same
  requestId. After context commits, retry the same requestId without model to
  resume remaining stages. MCP verifies canonical hashes; externally changed
  targets require explicit reconciliation. Never manually rewrite files, update
  STATE, or delete checkpoints. Report saved-but-state-incomplete honestly.
- Repeated identical errors: stop with exact diagnostics and resumable notes,
  clearly stating that the generated document was not saved. Avoid source-code investigation during the product workflow or claim completion.
