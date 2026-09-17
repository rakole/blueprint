# Planning Recovery

Load only after a rejected model, stale preparation or partial publication.

- Rejected model: fix the returned diagnostic fields in conversation and submit
  the corrected model at the same expectedRevision. No failed draft is stored.
- Stale evidence: read changed inputs, reconsider affected decisions, then prepare
  with expectedRevision and acknowledgeChangedInputs=true. Review changed content
  before submitting. Never silently rebase a plan onto unread evidence.
- Changed existing plans or scope: use prepare's observed target hashes and
  explicit reconciliation. Preserve unrelated files. Revise/replace still require
  overwrite authorization. Reconciliation does not restore document backups.
- Interrupted publication: retry the same requestId and control arguments. Resend
  the model while an intended canonical file remains unwritten. Once all intended
  plan bytes are saved, the tool can finish state/routing from metadata without
  the model. Do not regenerate different work under the accepted request ID.
- Read returns canonical plan documents and session metadata only. It cannot
  recover rejected models. Legacy sessions are migrated through owning tools,
  dropping candidate/history/document payloads. Follow returned reconciliation
  instructions for interrupted legacy publication.

The publication marker keeps partial plan sets out of execution. Do not hand-edit
it or the journal. Report partial outcomes accurately and follow the tool's next
action; a saved file alone is not a completed publication receipt.

If the same diagnostics repeat after a targeted correction, report the blocker
and stop that repair loop. Do not inspect MCP source code during the user workflow.
