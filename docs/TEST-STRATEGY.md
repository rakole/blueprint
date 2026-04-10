# Blueprint Test Strategy

## Goals

- keep command behavior deterministic
- keep artifact schemas stable
- make it safe to implement commands one at a time
- catch Gemini-specific integration issues early

## Test Layers

### 1. Shared schema and MCP unit tests

Cover:
- `config.json` schema
- config precedence and provenance
- config migration from the legacy minimal Blueprint schema
- core markdown artifact required fields
- phase artifact naming rules
- path safety
- MCP tool input validation
- MCP tool return shapes

### 2. Command fixture tests

One fixture suite per retained command:

- happy path
- missing prerequisite
- idempotent rerun behavior
- risky-operation confirmation path when applicable

### 3. Hook fixture tests

For advisory hooks:

- stdin fixture in
- structured advisory out
- silent no-op cases
- no false positives for normal `.blueprint/` writes

### 4. Integration tests

Cover command chains:

- `new-project` -> `discuss-phase` -> `plan-phase`
- `plan-phase` -> `execute-phase` -> `verify-work`
- roadmap mutation flows
- backlog promotion flows
- review and review-fix loops
- workspace and workstream bookkeeping
- config-conditioned routing and execution behavior

### 5. Git behavior tests

Required for:

- `pr-branch`
- `ship`
- `undo`
- `cleanup`
- `new-workspace`
- `remove-workspace`
- `reapply-patches`

### 6. Install and packaging tests

Cover:

- extension installs from a clean checkout
- bundled code is present
- command files resolve
- hooks and MCP server paths resolve from the installed extension

## End-to-End Smoke Flow

The minimum smoke flow is:

1. install Blueprint
2. restart Gemini CLI
3. `/blu:new-project`
4. `/blu:discuss-phase`
5. `/blu:plan-phase`
6. `/blu:execute-phase`
7. `/blu:verify-work`
8. assert `.blueprint/` tree and generated artifacts

## Command-Spec Test Contract

Every command spec in `docs/commands/` should yield:

- one fixture test for the happy path
- one fixture test for the main missing-precondition path
- one regression fixture for the command's riskiest edge case

## Non-Goals

- no test coverage for omitted commands
- no test reliance on an installer-generated runtime conversion layer
