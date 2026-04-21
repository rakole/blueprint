# Blueprint Gemini-First Effectiveness Spine Slice Index

## S0 Shared Contract Foundation

| Slice ID | Slice Name | Asset Family | Write Scope | Depends On | Verification Focus | Review Focus |
|---|---|---|---|---|---|---|
| `S0.1` | Gemini-tools playbook | Shared docs | One new shared playbook doc plus any direct future-looking references | None | Playbook covers tool usage boundaries, host fallback, and shell/web/resource rules | Contract completeness without inventing runtime behavior |
| `S0.2` | Shared template and runtime-reference fields | Shared docs | `docs/commands/_template.md` and `docs/RUNTIME-REFERENCE.md` | `S0.1` | Execution profile, stage vocabulary, and in-flight status fields are present and consistent | No drift from existing command/status vocabulary |
| `S0.3` | Metadata enforcement tests | Shared tests | Narrow docs/metadata test cluster | `S0.2` | Tests fail when new shared fields are missing | Test scope stays metadata-only |
| `S0.4` | Host-doc alignment | Shared docs | `GEMINI.md`, `docs/GEMINI-CONSTRAINTS.md`, `docs/TEST-STRATEGY.md` | `S0.1`, `S0.2` | Host docs reflect the shared spine and test expectations | No accidental runtime commitments beyond the shared contract |

## S1 Router Pilot

| Slice ID | Slice Name | Asset Family | Write Scope | Depends On | Verification Focus | Review Focus |
|---|---|---|---|---|---|---|
| `S1.1` | Root router waiting-state contract | Router | `/blu` manifest, router skill, runtime-reference router entry | `S0.2` | Router surfaces waiting state without widening routable commands | Implemented-only exposure preserved |
| `S1.2` | `help` spine alignment | Router | `help` manifest/spec/runtime-reference row/tests | `S1.1` | `help` reports waiting state coherently | No planned-command leakage |
| `S1.3` | `progress` spine alignment | Router | `progress` manifest/spec/runtime-reference row/tests | `S1.1` | `progress` reports blockers, pending gates, next safe action | Read-only router behavior remains intact |
| `S1.4` | `next` spine alignment | Router | `next` manifest/spec/runtime-reference row/tests | `S1.1` | `next` reflects waiting state and safe follow-up | No hidden destructive routing |
| `S1.5` | Router pilot regression coverage | Router tests | Focused router test cluster | `S1.2`, `S1.3`, `S1.4` | Implemented-only routing plus waiting-state reporting | Test assertions stay router-scoped |

## S2 Lifecycle Pilot

| Slice ID | Slice Name | Asset Family | Write Scope | Depends On | Verification Focus | Review Focus |
|---|---|---|---|---|---|---|
| `S2.1` | `plan-phase` visible planning contract | Lifecycle planning | `plan-phase` manifest/spec/skill/runtime-reference/tests | `S0.2` | Reuse/revise/replace gates and stage narration are explicit | No scope widening into later lifecycle commands |
| `S2.2` | Planner/checker bounded ownership | Agents | `blueprint-planner`, `blueprint-checker`, direct tests/docs | `S2.1` | Parent owns orchestration and persistence; agents stay bounded | Agent boundaries stay sharp |
| `S2.3` | `execute-phase` topic/todo contract | Lifecycle execution | `execute-phase` manifest/spec/skill/runtime-reference/tests | `S2.1` | Long-running execution visibility requirements are explicit | No hidden persistence beyond MCP |
| `S2.4` | Executor bounded progress contract | Agent | `blueprint-executor` contract and direct tests | `S2.3` | Progress checkpoints and shell isolation are explicit | Agent does not absorb parent orchestration |
| `S2.5` | `validate-phase` visible verification stages | Lifecycle validation | `validate-phase` manifest/spec/skill/runtime-reference/tests | `S2.3` | Verification stages, pending gates, and next action are explicit | No drift from saved-summary-first contract |
| `S2.6` | `verify-work` checkpoint and gate contract | Lifecycle validation | `verify-work` manifest/spec/skill/runtime-reference/tests | `S2.5` | Review/skip/stop gates and UAT checkpointing are explicit | UAT remains resumable and bounded |
| `S2.7` | `add-tests` bounded visibility contract | Lifecycle validation | `add-tests` manifest/spec/skill/runtime-reference/tests | `S2.5` | Test-generation visibility and verification status stay explicit | Mutation remains narrow and evidence-backed |
| `S2.8` | Lifecycle pilot integration coverage | Lifecycle tests | Focused integration test cluster | `S2.1` through `S2.7` | `plan -> execute -> validate -> verify -> add-tests` contract coherence | Integration scope stays pilot-only |

## S3 Lightweight Execution

| Slice ID | Slice Name | Asset Family | Write Scope | Depends On | Verification Focus | Review Focus |
|---|---|---|---|---|---|---|
| `S3.1` | `quick` tracker-eligible contract | Lightweight execution | `quick` manifest/spec/skill/runtime-reference/tests | `S0.2` | Branchy quick flow gets visibility and tracker eligibility | No bleed into full lifecycle planning |
| `S3.2` | `debug` explicit follow-up gate | Debug | `debug` manifest/spec/skill/runtime-reference/tests and debugger contract if needed | `S0.2` | Todo capture and debug follow-up gates stay explicit | Diagnose-only mode remains honest |
| `S3.3` | `fast` explicit exclusion contract | Lightweight execution | `fast` manifest/spec/runtime-reference/tests | `S0.2` | `fast` explicitly excludes tracker/long-running progress behavior | Trivial path stays trivial |
| `S3.4` | Lightweight execution regression coverage | Lightweight execution tests | Focused test cluster | `S3.1`, `S3.2`, `S3.3` | Trivial vs long-running visibility split | No accidental contract merging |

## S4 Review And Docs Family

| Slice ID | Slice Name | Asset Family | Write Scope | Depends On | Verification Focus | Review Focus |
|---|---|---|---|---|---|---|
| `S4.1` | `code-review` spine alignment | Review | One command bundle plus focused tests | `S0.2` | Scope confirmation and visible review posture | Review scope stays deterministic |
| `S4.2` | `code-review-fix` spine alignment | Review | One command bundle plus focused tests | `S4.1` | Finding-selection gates and bounded remediation | No auto-fixer behavior sneaks in |
| `S4.3` | `audit-fix` spine alignment | Review | One command bundle plus focused tests | `S4.2` | Long-running remediation visibility and stop conditions | Mutation remains evidence-first |
| `S4.4` | `secure-phase` spine alignment | Review | One command bundle plus focused tests | `S0.2` | Threat review gates and pending-open-threat status | Threat-model-bounded behavior preserved |
| `S4.5` | `review` spine alignment | Review | One command bundle plus focused tests | `S0.2` | External review posture and waiting state | No hidden reviewer assumptions |
| `S4.6` | `ui-review` spine alignment | Review | One command bundle plus focused tests | `S0.2` | UI review stage/reporting clarity | UI audit remains phase-scoped |
| `S4.7` | `docs-update` spine alignment | Docs | One command bundle plus focused tests | `S0.2` | External truth vs repo truth posture and visible progress | Doc-update scope stays narrow |
| `S4.8` | Review/docs agent contract alignment | Agents | One agent contract per micro-slice plus tests | `S4.1` through `S4.7` as needed | Agent tool boundaries and bounded outputs | No agent type proliferation without need |
| `S4.9` | Review/docs safety regression coverage | Review/docs tests | Focused test cluster | `S4.1` through `S4.8` | Overwrite, scope, remediation, and approved external-tool behavior | Safety assertions stay within shipped families |

## S5 Maintenance Family

| Slice ID | Slice Name | Asset Family | Write Scope | Depends On | Verification Focus | Review Focus |
|---|---|---|---|---|---|---|
| `S5.1` | `pr-branch` waiting-state visibility | Maintenance | One command bundle plus focused tests | `S0.2` | Report-before-mutate and pending-gate language | No in-place branch rewrite behavior |
| `S5.2` | `ship` tracker/todo contract | Maintenance | One command bundle plus focused tests | `S0.2` | Branchy shipping flow visibility and next safe action | Push/PR fallback honesty preserved |
| `S5.3` | `undo` destructive-gate visibility | Maintenance | One command bundle plus focused tests | `S0.2` | Explicit destructive approval and waiting state | Safe revert posture preserved |
| `S5.4` | `cleanup` protected-scope visibility | Maintenance | One command bundle plus focused tests | `S0.2` | Protected-scope reporting and approval gate | No active-scope archival drift |
| `S5.5` | Maintenance regression coverage | Maintenance tests | Focused test cluster | `S5.1` through `S5.4` | Dirty-tree aborts, report-before-mutate, pending approval | Tests stay maintenance-scoped |

## S6 Discovery/Bootstrap/Read-Heavy Family

| Slice ID | Slice Name | Asset Family | Write Scope | Depends On | Verification Focus | Review Focus |
|---|---|---|---|---|---|---|
| `S6.1` | `new-project` shared-profile normalization | Bootstrap | One command bundle plus focused tests | `S0.1`, `S0.2` | Existing rich Gemini behavior is preserved under shared contract | No regression of shipped bootstrap behavior |
| `S6.2` | `map-codebase` spine alignment | Discovery | One command bundle plus focused tests | `S0.2` | Reuse/refresh and visible progress posture | Seven-doc bundle contract stays intact |
| `S6.3` | `discuss-phase` spine alignment | Discovery | One command bundle plus focused tests | `S0.2` | One-question branching, checkpoints, and visible stage posture | No extra file-crawl promises appear |
| `S6.4` | `research-phase` spine alignment | Discovery | One command bundle plus focused tests | `S0.2` | External-truth policy and topic-strand progress | Repo truth vs web truth remains explicit |
| `S6.5` | `ui-phase` spine alignment | Discovery | One command bundle plus focused tests | `S0.2` | UI skip/contract gates and visibility | UI contract remains bounded and MCP-owned |
| `S6.6` | `list-phase-assumptions` profile alignment | Discovery | Manifest/spec/runtime-reference/tests | `S0.2` | Read-only profile and waiting-state clarity if applicable | No accidental write behavior |
| `S6.7` | Discovery/bootstrap agent alignment | Agents | One agent contract per micro-slice plus tests | `S6.1` through `S6.5` as needed | External research and self-correction rules are explicit | Agent contracts stay evidence-bound |

## S7 Roadmap-Admin And Capture Family

| Slice ID | Slice Name | Asset Family | Write Scope | Depends On | Verification Focus | Review Focus |
|---|---|---|---|---|---|---|
| `S7.1` | Capture command alignment pack | Capture | One command per micro-slice across `note`, `add-todo`, `check-todos`, `add-backlog`, `review-backlog`, `explore` | `S0.2` | Confirmation language cleanup and no unnecessary long-run progress layer | Capture stays deterministic and local |
| `S7.2` | Roadmap-admin command alignment pack | Roadmap admin | One command per micro-slice across roadmap and milestone commands | `S0.2` | `ask_user` standardization and waiting-gate language | No extra routing or state promises |
| `S7.3` | Capture/roadmap regression coverage | Capture and roadmap tests | Focused test cluster | `S7.1`, `S7.2` | Confirmation style and implemented-only routing | Test scope remains family-local |

## S8 Shared Runtime Infra

| Slice ID | Slice Name | Asset Family | Write Scope | Depends On | Verification Focus | Review Focus |
|---|---|---|---|---|---|---|
| `S8.1` | Config contract docs/schema/tests | Infra | Config docs/schema plus focused tests | `S0`, `S1`, `S2` pilots proven | New config keys are documented and validated | No speculative config semantics beyond the spine |
| `S8.2` | Config runtime implementation | Infra | [config.ts](/Users/rhishi/dev/repositories/blueprint/src/mcp/tools/config.ts), settings docs/tests | `S8.1` | New config keys normalize and read correctly | Existing config behavior stays stable |
| `S8.3` | MCP resource contract docs/tests | Infra | `docs/MCP-TOOLS.md`, `docs/ARTIFACT-SCHEMA.md`, `docs/RUNTIME-REFERENCE.md`, focused tests | `S8.1` | Resource contract is explicit and test-backed | No writes move onto resource surfaces |
| `S8.4` | Resource implementation: command catalog and per-command contract | Infra | One resource implementation slice plus tests | `S8.3` | Resource output matches live command truth | No drift from existing catalog logic |
| `S8.5` | Resource implementation: phase and codebase bundles | Infra | One resource implementation slice plus tests | `S8.4` | Bundle reads match existing artifact truth | Resource scope stays read-only |
| `S8.6` | Resource implementation: latest reports index | Infra | One resource implementation slice plus tests | `S8.4` | Latest-report index stays accurate and read-only | No report-write semantics leak in |
| `S8.7` | Resource adoption in router/progress/discovery | Infra adoption | Narrow adoption slices plus fallback tests | `S8.4`, `S8.5`, `S8.6` | Commands use resources with coherent fallback when unavailable | Adoption does not change command truth or routing guarantees |
