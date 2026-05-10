Complete a staged, behavior-preserving TypeScript decomposition pass across Blueprint source excluding src/mcp/server.ts, without stopping until every large non-generated source module has either been safely decomposed or explicitly left with documented rationale, verification passes, and the work is merged to origin/main.

Repo: /Users/rhishi/dev/repositories/blueprint

Hard rules:
- Do not use GSD or Blueprint workflow commands. Use Codex harness, shell, git, tests, and direct code edits only.
- Before any file change, create a fresh worktree from origin/main. You and any subagents must work only in that worktree.
- Run npm ci in the fresh worktree before build/typecheck/test.
- Do not mutate installed extension directories or host-global ~/.gemini/blueprint state.
- Use subagents if helpful, max 3 at a time, with disjoint ownership. Close each immediately when done.
- Preserve tracked dist behavior: after runtime-affecting changes, run build and commit updated dist outputs if they change.
- After completion: push branch, open PR, merge to origin/main with gh CLI, fast-forward local main in /Users/rhishi/dev/repositories/blueprint, remove stale worktree/branch. If blocked, report exact blocker and commands.

Read first:
- AGENTS.md
- package.json
- tsconfig.json
- src/mcp/tools/phase.ts
~~- src/mcp/tools/artifacts.ts~~
~~- src/mcp/tools/review.ts~~
~~- src/mcp/tools/impact.ts~~
~~- src/mcp/artifact-contracts/index.ts~~
~~- src/mcp/tools/workspace.ts~~
~~- src/mcp/command-runtime-metadata.ts~~
~~- src/mcp/tools/state.ts~~
- the most relevant tests for each touched module

Objective:
Decompose the remaining large TypeScript source modules into smaller cohesive modules while preserving behavior and public contracts. Prioritize by risk and size:
1. src/mcp/tools/phase.ts
~~2. src/mcp/tools/artifacts.ts~~
~~3. src/mcp/tools/review.ts~~
~~4. src/mcp/tools/impact.ts~~
~~5. src/mcp/artifact-contracts/index.ts~~
~~6. src/mcp/tools/workspace.ts~~
~~7. src/mcp/command-runtime-metadata.ts~~
~~8. src/mcp/tools/state.ts~~
~~9. smaller modules only if there is an obvious low-risk extraction~~

Constraints:
- Do not attempt one giant rewrite. Work module family by module family.
- Prefer pure helper modules, typed contracts, parsers, validators, renderers, repo adapters, and mutation orchestrators.
- Do not introduce Java-style OOP just for familiarity. Classes are acceptable only for real stateful adapters or dependency boundaries.
- Preserve existing exported function names unless there is a very small, well-tested re-export shim.
- Keep behavior stable; tests should not need semantic updates.
- Do not refactor tests wholesale. Touch tests only to update imports or add small characterization coverage where extraction exposes a gap.

Checkpoint plan:
1. Create an inventory of large modules, current exports, test coverage, and safe extraction seams.
2. Pick one module family at a time.
3. For each family, first add or identify focused characterization tests.
4. Extract cohesive helpers into new files with NodeNext .js imports.
5. Run focused tests and typecheck after each module family.
6. Commit each completed family separately.
7. Continue until all large non-server source modules are handled or documented as intentionally deferred.

Required verification:
- npm run typecheck after each completed module family
- focused npx tsx --test suites for touched module families
- npm run build --silent after runtime-affecting extractions
- npm test before final merge

Stop only when:
- all large non-server TS modules have been decomposed or intentionally deferred with clear rationale in the final summary
- public exports and runtime contracts remain stable
- full verification passes, or any failure is proven unrelated and documented
- branch is pushed, PR merged, local main fast-forwarded, stale worktree/branch cleaned
