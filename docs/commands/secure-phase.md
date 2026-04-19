# `/blu-secure-phase`
| Field | Value |
|---|---|
| Wave | `4` |
| Family | `Quality And Shipping` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |


## Purpose


`secure-phase` is Blueprint's command for retroactively verify threat mitigations for a completed phase. Blueprint ships it as a host-native threat-verification command: it reads saved phase evidence, loads the canonical `review.security` contract before drafting, uses the phase plan index and plan reader to parse the saved phase threat model from plan evidence, builds a threat register, and keeps the audit bounded to the declared threats and mitigations instead of running a generic security scan.


## Command Path And Examples

- CLI command path: `/blu-secure-phase`
- Root router form: `/blu secure-phase`
- Argument hint: `[phase number]`
- `/blu-secure-phase 3`
- `/blu secure-phase`

## Inputs, Project State, And Prerequisite Artifacts


- The target phase must already have executed artifacts.


## Outputs


- User-facing result: a concise completion summary, then either a verification-or-acceptance decision for open threats or a blocked advancement result when threats remain open.
- Repo side effects: Writes only the declared phase-scoped security artifact for this command.


## Blueprint And Global State Reads


- Phase resolution, artifact inventory, phase plan index/read, and the saved phase threat model plus related phase evidence through the documented phase and artifact MCP tools


## Blueprint And Global State Writes


- `phase XX-SECURITY.md`


## Required MCP Tools


- `blueprint_phase_locate` -> `{found, phaseNumber, phaseName, phaseDir, artifacts}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_phase_plan_index` -> `{plans, waves, missingPlans}`
- `blueprint_phase_plan_read` -> `{phaseFound, found, phaseNumber, phasePrefix, phaseName, phaseDir, planId, path, content, metadata, validation, reason}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}`
- `blueprint_review_record` -> `{reportPath, counts, followUps}`

## Security Artifact Contract

- Read the canonical `review.security` contract through `blueprint_artifact_contract_read` before drafting or revising `XX-SECURITY.md`, and use the returned template and required headings as the baseline instead of a copied prompt-local variant.
- Use `blueprint_phase_plan_index` and `blueprint_phase_plan_read` to parse the saved phase threat model from the executed plan evidence before building the threat register.
- Keep the returned template's threat register, accepted risks, and audit-trail structure explicit even when the final audit concludes there are no open threats.
- Persist the durable security audit through `blueprint_review_record` with `artifact: "security"` and treat the returned `reportPath` as authoritative instead of hand-building `XX-SECURITY.md`.
- Do not compute a next action until all threats are closed or explicitly accepted.


## Skills And Subagents


- Primary skill: `blueprint-review`
- Optional subagents:
- `blueprint-security-auditor`


## Dependencies


- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/execute-phase.md`


## External Shell Or Git Dependencies


- External dependencies:
- none


## Shell Risk Profile

- Low: audit artifact only.

## User Prompts And Confirmation Gates


- Present the user with the choice to verify open threats or explicitly accept them. If threats remain open, block advancement and do not emit a next-step route.


## Edge Cases


- The command scope does not match the currently changed files, branch, or phase artifacts.
- External tooling such as `git`, `gh`, or peer-review CLIs is missing or only partially available.


## Failure Modes And Recovery


- Preserve generated security artifacts when the audit needs revision or external context is incomplete.
- Fall back to explicit evidence gaps and the safest implemented next step instead of guessing missing mitigations.
- Keep prompt-boundary or suspicious-content concerns explicit in the saved artifact instead of silently trusting compromised evidence.


## Acceptance Criteria


- Produces a durable artifact for review, security, UI, or shipping work.
- Never hides destructive git behavior behind an implicit step.
- Creates or updates only the declared artifacts for this command.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Distinguishes confirmed mitigations, open threats, accepted risks, suspicious artifact content, and explicit hardening follow-ups inside the saved security evidence.
- Parses the saved phase threat model, builds a threat register, and keeps the audit bounded to declared threats and mitigations.
- Blocks advancement while any threat remains open.


## Test Cases


- Phase review or shipping fixture.
- Git or external CLI availability fixture.
- Direct `secure-phase` happy-path fixture.
