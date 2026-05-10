# Subagent 4: Product Adoption And Open Source UX Audit

Scope: README, install/onboarding docs, help/progress/next behavior, command discoverability, examples, screenshots/assets, contribution/release signals, and beginner adoption flow.

Constraints followed: discovery/reporting only. No source fixes, tests, installs, Blueprint commands, host-global mutations, or `.blueprint/` mutations were run. The only write was this report.

## Executive Summary

Blueprint has a strong product core: a memorable premise, a clear durable-state model, a guarded `/blu` router, and an unusually explicit command catalog. The public experience still reads more like a maintainer rollout notebook than a polished open-source developer tool. A first-time user sees wave history, runtime-layout internals, 53 implemented direct commands, one planned command exception, and large command lists before they see a crisp demo, a realistic first project, or a comparison against common alternatives.

The top adoption problem is not missing capability. It is that Blueprint has not packaged its capability into a beginner path. Strong open-source developer tools usually give visitors a fast "why", a 60-second demo, a copy/paste quickstart, a small number of first commands, visible trust signals, examples from real projects, and contribution/release expectations. Blueprint has many of those ingredients scattered in README, `docs/presentation/blueprint-team-presentation-qa.md`, command specs, diagrams, and catalog tables, but the public README does not yet compose them into an adoption funnel.

## Prioritized Findings

### P0 - README opening is too implementation-oriented for first-time adoption

Evidence:

- README begins with a clear one-sentence value prop, then immediately shifts into implementation status and wave language: "Wave 0", "Phase 3 discovery", "parity closeout", and a lifecycle slice note (`README.md:5-15`).
- The "Current Runtime Layout" section is explicitly representative, not exhaustive, and lists internal files such as command TOML and skill paths (`README.md:17-36`).
- That section also contains a stale-looking skill path, `skills/blueprint-router.md`, while actual skills are `skills/<name>/SKILL.md` (`README.md:34`; file inventory shows `skills/blueprint-router/SKILL.md`).

Impact:

New users must parse implementation history before understanding the product. This weakens positioning and trust compared with strong OSS tools that lead with "what it does, why it matters, install, run this".

Recommended hardening:

1. Replace the opening status block with a concise adoption pitch:
   - "Blueprint makes AI coding work visible, resumable, and reviewable by storing project intent, plans, validation, and review evidence in `.blueprint/`."
2. Move wave/phase/runtime-layout notes into maintainer docs.
3. Add a "30-second path" before the full command inventory:
   - Install.
   - Run `/blu-help`.
   - In an existing repo, run `/blu-map-codebase`.
   - Run `/blu-progress` or `/blu-next`.
   - Try `/blu-impact --staged` on a real diff.

### P0 - Too many commands are public before there is a beginner command ladder

Evidence:

- `PROGRESS.md` lists 53 completed commands (`PROGRESS.md:27-85`).
- `docs/COMMAND-CATALOG.md` exposes a dense command table with command, wave, family, skill, status, writes, and risk (`docs/COMMAND-CATALOG.md:5-60`).
- README lists foundation, lifecycle, roadmap, capture, quality, shipping, workspace, update, cleanup, and patch replay commands in one long flow (`README.md:163-244`).
- The "Quality, review, docs, and shipping" README section mixes low-risk review/report commands with high-risk git/workspace/patch commands (`README.md:221-244`).

Impact:

The command surface looks powerful but intimidating. Beginners need a small number of default choices; advanced users can discover the rest after trust is established.

Recommended hardening:

1. Add a "Use this first" table above the full list:

   | I want to... | Start with | Why |
   |---|---|---|
   | Know what Blueprint recommends | `/blu` or `/blu-next` | Reads repo state and picks the next safe implemented action. |
   | Add Blueprint to an existing repo | `/blu-map-codebase` | Captures current repo facts before planning. |
   | Start a new project | `/blu-new-project` | Creates the starter `.blueprint/` artifacts. |
   | Try value without changing source | `/blu-impact --staged` | Produces a blast-radius report for a diff. |
   | Do a small task | `/blu-quick "..."` | Lower ceremony than a full phase. |

2. Hide the full direct-command inventory behind "Command reference".
3. Split README command groups into "Start", "Plan/Build/Verify", "Capture", "Quality Evidence", "Git/Release", and "Workspace/Maintenance".

### P0 - There is no public quick demo despite an internal demo story existing

Evidence:

- README has install and quick start steps, but no transcript, GIF, screenshot, sample output, or before/after artifact diff (`README.md:46-127`).
- The strongest demo guidance exists in internal presentation material: `/blu-impact --staged` is named as the best first demo (`docs/presentation/blueprint-team-presentation-qa.md:45-49`, `docs/presentation/blueprint-team-presentation-qa.md:653-657`).
- Public assets include brand images and presentation output (`resources/*.png`, `docs/presentation/output.pptx`), but README only embeds the banner (`README.md:3`). The available PNGs are brand/banner graphics, not CLI screenshots or real report examples.

Impact:

Prospective users cannot quickly see the product "click". Strong developer tools usually show the core loop visually or with a tight terminal transcript.

Recommended hardening:

1. Add a "See it in 60 seconds" section:
   - Show a small staged diff.
   - Run `/blu-impact --staged`.
   - Show abbreviated output with "owners/tests/docs/unknowns/next action".
   - Show the resulting `.blueprint/impact/<id>/IMPACT.md`.
2. Add one lifecycle demo for a toy feature:
   - `/blu-new-project` -> `/blu-discuss-phase 1` -> `/blu-plan-phase 1` -> `/blu-execute-phase 1` -> `/blu-validate-phase 1`.
3. Add one screenshot or terminal recording. If visual capture is not available yet, include a copy/paste transcript.

### P1 - The "why not a todo list / issue tracker / agent prompt?" positioning exists, but not where adopters need it

Evidence:

- Presentation Q&A answers differentiation against prompts, project management software, CI, and code review (`docs/presentation/blueprint-team-presentation-qa.md:24-34`).
- It also has clear beginner phrasing: "Blueprint makes AI coding work visible, resumable, and reviewable" (`docs/presentation/blueprint-team-presentation-qa.md:659-663`).
- README says Blueprint has durable `.blueprint/` state and implemented-only routing (`README.md:38-44`) but does not explicitly answer why this is better than a todo list, GitHub Issues, Linear/Jira, CI, or a custom agent prompt.

Impact:

The public page does not preempt the most likely skepticism. Users may classify Blueprint as "a heavy todo list" or "a pile of prompts" before seeing the actual distinction: repo-local evidence plus MCP-owned state contracts.

Recommended hardening:

Add a README section "Why not just...?"

- Todo list: todos track tasks; Blueprint links intent, plans, execution summaries, validation, review, and next safe actions.
- Issue tracker: trackers manage team coordination; Blueprint keeps agent-readable implementation evidence in the repo.
- Agent prompt: prompts vanish with chat; Blueprint persists artifacts and validates writes through MCP tools.
- CI: CI verifies known checks; Blueprint helps decide what should be checked, reviewed, documented, or escalated.

### P1 - Open-source readiness signals are incomplete

Evidence:

- `package.json` is marked `"private": true` and versioned `0.1.0` (`package.json:2-5`).
- Both extension manifests are also versioned `0.1.0` (`gemini-extension.json:1-4`, `tabnine-extension.json:1-4`).
- I did not find root-level `LICENSE`, `CONTRIBUTING`, `CHANGELOG`, `RELEASE`, `SECURITY`, or `CODE_OF_CONDUCT` files with a depth-2 repository search excluding `node_modules` and `dist`. Uncertainty: security-related test files exist, but not a public security policy document.
- README install uses `gemini extensions install https://github.com/rakole/blueprint` (`README.md:55-64`), implying public consumption from GitHub.
- `/blu-update` exists as an advisory update command in README (`README.md:242`) and command docs, but there is no public release/versioning story.

Impact:

For a GitHub-installed open-source developer tool, missing license/contribution/release/security signals reduce adoption confidence. Users cannot tell how stable 0.1.0 is, how updates are cut, how to report vulnerabilities, or whether outside contributions are welcome.

Recommended hardening:

1. Add `LICENSE`.
2. Add `CONTRIBUTING.md` with local dev setup, `npm ci`, `npm run typecheck`, `npm test`, and integration test caveats.
3. Add `CHANGELOG.md` or GitHub Releases policy.
4. Add `SECURITY.md` with vulnerability reporting and disclosure posture.
5. Add a "Versioning and updates" README section explaining manifest/package version sync and `/blu-update`'s advisory-only role.

### P1 - Help/progress routing is strong, but public docs do not show example output

Evidence:

- `/blu` is catalog-gated and must only route commands whose live catalog entry is `implemented: true` (`commands/blu.toml:7-16`, `commands/blu.toml:18-25`).
- `/blu-help` reads project status and command catalog, then returns safe relevant commands and the next safe action (`commands/blu-help.toml:9-25`).
- `/blu-progress` reads project status, config, state, artifact list, and command catalog, then reports warnings, blockers, and next safe action (`commands/blu-progress.toml:9-27`).
- `/blu-next` is read-only and returns a single next safe direct command (`commands/blu-next.toml:7-25`).
- Tests assert these router surfaces remain implemented-only and waiting-state explicit (`tests/router-pilot-regression.test.ts:10-74`).

Impact:

This is a product strength, but the README asks users to trust `/blu-help` and `/blu-progress` without showing what they look like. A realistic output sample would make the safety and beginner path tangible.

Recommended hardening:

Add compact README examples:

- Fresh repo `/blu-help` output.
- Brownfield repo `/blu-progress` routing to `/blu-map-codebase`.
- Initialized repo `/blu-next` routing to the next phase command.
- Planned command request showing `/blu-do` blocked/non-public.

### P1 - `/blu-do` remains a public-status footgun

Evidence:

- README correctly says `/blu-do` is not public and will not be advertised by `/blu` or `/blu-help` (`README.md:293-299`).
- `PROGRESS.md` says `do` is the lone incomplete planned command and non-routable until its manifest lands (`PROGRESS.md:7-25`).
- `docs/COMMAND-CATALOG.md` marks `do` as `planned` (`docs/COMMAND-CATALOG.md:20`).
- But `docs/commands/do.md` says "Root-routable | Yes" and shows runnable-looking paths `/blu-do` and `/blu do` (`docs/commands/do.md:1-28`).

Impact:

This undermines command discoverability because user-facing docs and runtime-status docs disagree. It also creates a trap for agents reading command specs directly.

Recommended hardening:

1. Put a planned-only banner at the top of `docs/commands/do.md`.
2. Change "Root-routable | Yes" to "No until implemented".
3. Move examples into a "Future examples" block or remove them until the manifest ships.

### P2 - Install docs omit verification, uninstall, update, and host caveats

Evidence:

- README install requires Gemini CLI and Node 20, then shows `gemini extensions install`, restart, and `/blu-help` (`README.md:46-64`).
- Local checkout install shows `npm ci`, `npm run build`, and `gemini extensions link .` (`README.md:66-74`).
- Troubleshooting only covers help not appearing, uninitialized repos, under-informed brownfield roadmap, partial state, and next move (`README.md:301-327`).
- Gemini and Tabnine manifests both launch `dist/mcp/server.js` via Node (`gemini-extension.json:6-15`, `tabnine-extension.json:6-15`).

Impact:

Installation is short, which is good, but mature OSS tools usually include "verify install", "update", "uninstall", "supported hosts", and "what gets installed". Blueprint has host-specific complexity, built `dist` dependency, and advisory update semantics that deserve explicit docs.

Recommended hardening:

1. Add "Verify install" with expected `/blu-help` behavior.
2. Add "Update" explaining reinstall/restart and `/blu-update`.
3. Add "Uninstall/remove extension" or link to host docs.
4. Add "Supported hosts": Gemini primary, Tabnine compatible if relevant to public users.
5. Add "What is installed": commands, skills, agents, hooks, MCP server, and built assets.

### P2 - Real-world examples are missing from public docs

Evidence:

- README examples are mostly command names or generic tasks such as keyboard shortcuts and env var rename (`README.md:83-91`, `README.md:257-263`).
- The internal presentation suggests measuring whether impact reports catch reviewers, tests, docs, or dependency concerns before humans do (`docs/presentation/blueprint-team-presentation-qa.md:641-648`), but no real example report is published in README or `docs/examples/`.
- `docs/bugs/BPBUG-000-illustrative-example.md` is explicitly fictional/illustrative, not a product example.

Impact:

Users cannot map Blueprint onto their own work. The product promises "artifact-backed workflow", but public docs do not show an actual `.blueprint/` artifact set from a realistic repo change.

Recommended hardening:

Add `docs/examples/` with at least:

1. Brownfield onboarding: map existing repo, bootstrap plan, inspect progress.
2. Small task: `/blu-quick` from ask to report.
3. Risk review: `/blu-impact --staged` report for a mixed code/docs/test diff.
4. Phase lifecycle: context -> plan -> summary -> verification -> UAT.

Each example should include inputs, abbreviated command transcript, files written, and final next action.

### P2 - Visual assets are brand-heavy rather than product-demonstrative

Evidence:

- README embeds `resources/README_banner_dark.png` (`README.md:3`).
- Local assets include brand/banner PNGs (`resources/README_banner_dark.png`, `README_banner_light.png`, `core_mark.png`, `favicon.png`, `github_avatar.png`, `img.png`, `img_5.png`) and Draw.io workflow diagrams under `docs/diagrams/`.
- The banner is polished and on-brand, but the inspected PNGs are brand graphics rather than screenshots of `/blu-help`, `/blu-progress`, or `.blueprint/` outputs. Uncertainty: `docs/presentation/output.pptx` may contain demo visuals, but I did not parse the presentation binary.

Impact:

Brand quality is good, but developer adoption usually benefits more from product proof than identity graphics. A screenshot or terminal recording would carry more explanatory weight.

Recommended hardening:

1. Keep the banner.
2. Add one terminal screenshot or GIF immediately after the install/quick demo.
3. Convert at least one Draw.io workflow into a README-friendly static image only if it explains a beginner path, not internal mechanics.

## Recommended Adoption Hardening Roadmap

### First pass: public README funnel

1. Rewrite the README opening around the beginner value prop.
2. Add "See it in 60 seconds" with `/blu-impact --staged`.
3. Add "Use this first" command chooser.
4. Move wave/runtime internals to maintainer docs.
5. Add example output for `/blu-help`, `/blu-progress`, and `/blu-next`.

### Second pass: OSS trust signals

1. Add `LICENSE`, `CONTRIBUTING.md`, `CHANGELOG.md`, and `SECURITY.md`.
2. Add release/versioning docs and version-sync expectations.
3. Add update/uninstall/troubleshooting details.
4. Add badges only after CI/release gates exist, so badges represent real enforcement.

### Third pass: proof and examples

1. Add `docs/examples/impact-staged.md`.
2. Add `docs/examples/brownfield-onboarding.md`.
3. Add `docs/examples/phase-lifecycle.md`.
4. Add one product screenshot or terminal GIF.
5. Add "Why not just..." to README using the already-good presentation Q&A language.

## Evidence Commands

- `rg --files -g '!*node_modules*' -g '!dist' -g '!coverage'`
- `sed -n '1,560p' README.md`
- `sed -n '1,260p' docs/COMMAND-CATALOG.md`
- `sed -n '1,220p' PROGRESS.md`
- `sed -n '1,220p' commands/blu.toml`
- `sed -n '1,220p' commands/blu-help.toml`
- `sed -n '1,240p' commands/blu-progress.toml`
- `sed -n '1,220p' commands/blu-next.toml`
- `find docs -maxdepth 2 -type d -print | sort`
- `find resources docs -maxdepth 3 -type f \( -iname '*.png' -o -iname '*.pptx' \) -print | sort`
- `find . -maxdepth 2 -path './node_modules' -prune -o -path './dist' -prune -o -type f \( -iname 'CONTRIBUTING*' -o -iname 'LICENSE*' -o -iname 'CHANGELOG*' -o -iname 'RELEASE*' -o -iname 'SECURITY*' -o -iname 'CODE_OF_CONDUCT*' \) -print`

## Residual Uncertainty

- I did not run Gemini/Tabnine host commands, so help/progress observations are based on command manifests and tests rather than live CLI screenshots.
- I did not parse `docs/presentation/output.pptx`; it may contain useful visuals that are not exposed in README.
- I did not inspect every command spec; findings focus on adoption, first-run UX, and public trust signals.
