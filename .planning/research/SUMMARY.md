# Research Summary: Blueprint Defect Discovery

**Date:** 2026-05-01

## Key Findings

**Stack:** Use Blueprint's existing TypeScript/Node/MCP/test stack and local docs as the source of truth. Run `npm ci` before any build, typecheck, or test command in the fresh worktree.

**Table stakes:** The milestone needs a bug template, stable bug ids, per-defect `docs/bugs/*.md` reports, a bug index, severity/confidence taxonomy, exact evidence, reproduction or verification steps, and explicit no-fix discipline.

**Watch out for:** The biggest risks are confusing Blueprint with GSD, treating docs as infallible, mixing fixes into the audit, under-checking generated assets, and creating vague or duplicate reports.

## Recommended Milestone Shape

Use nine small phases:

1. Bug taxonomy and reporting harness.
2. Bootstrap, router, config, and health.
3. Core phase lifecycle.
4. Roadmap, capture, and lightweight execution.
5. Review, quality, docs, impact, and shipping.
6. Workspace and maintenance.
7. Extension host, packaging, build, dist, and hooks.
8. Cross-cut drift and regression gaps.
9. Bug index, dedupe, and priority review.

## Output Standard

Each discovered defect should become a self-contained `docs/bugs/BPBUG-###-short-slug.md` file with:

- severity, confidence, status, and affected surfaces
- expected behavior from Blueprint docs/contracts
- actual behavior from code, tests, manifests, or command output
- evidence and reproduction or verification steps
- likely cause and suggested fix direction
- related files and related bugs
- explicit note that no fix was applied

## Scope Boundary

This milestone should create planning artifacts and bug documentation only. Source fixes, test repairs, command manifest corrections, generated asset refreshes, and runtime behavior changes belong to a later milestone chosen by the user.
