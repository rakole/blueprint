# Plan Recovery

Load only after a planning error, stale result or interruption.

- Validation failure: the candidate is already saved. Read its revision if needed,
  repair affected fields through submit corrections, and use the returned
  revision/hash for review and finalization. Raw invalid JSON can be corrected
  by replacing the candidate text. Do not weaken publication validation.
- If identical diagnostics repeat: preserve the candidate, report the exact unresolved
  requirement or split point, and stop automatic repair after one unchanged
  retry. Do not inspect MCP source or use a canonical Markdown escape path.
- Revision conflict: read the current session. Reconcile the new candidate before
  applying edits. Do not overwrite another revision merely to retry.
- Unknown tool outcome: retry the same requestId with identical arguments. A
  changed payload requires a new requestId; never guess whether files were saved.
- Failed assessment: diagnostics are bounded; use their total/truncated fields
  to recognize omitted findings. A corrected candidate at the current revision
  may supersede an assessment-only pending request while retaining its history.
  Pending publication journals require their own recovery instead.
- Changed evidence: prepare with expectedRevision and explicit acknowledgment of
  changed inputs. Retain all previously tracked inputs unless an explicit,
  justified reconciliation removes their dependency. Recheck affected decisions.
- Changed canonical targets: review current target hashes and obtain explicit
  reconciliation before resuming. Never use a previous overwrite decision for
  unseen content. Leave unrelated plans, summaries and other artifacts intact.
- Partial publication: follow the returned exact finalizer retry. The journal
  contains the intended files and completion stages. Do not delete or edit the
  session/publication marker and do not start competing publication requests.
- Checker unavailable: perform and label an inline review when enabled. A
  blocked or revise verdict cannot authorize publication. Bind acceptance to
  the saved candidate revision/hash; edits require a new review.

For blocked upstream evidence, use the returned implemented producing command.
Use `/blu-progress` only when the recovery action is ambiguous.
