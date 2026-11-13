# Steward — long-lived engineering team

> More than shipping features: keep the project understandable, verifiable, reversible, and evolvable after every change.

[简体中文](README.md) | English

Steward is a role-based engineering team plugin for ZCode, MiniMax and DeepSeek Harness (DSH). The lead agent acts as **Tech Lead**, decomposes work into a task DAG with file ownership, and dispatches specialist subagents.

## What is Steward

The current release (ZCode 1.1.0 / MiniMax 1.1.0 / DSH 1.1.0) covers feature delivery with two execution modes (subagent / inline), bug fixing (B0-B3 triage), plan-only mode, the maintenance loop, takeover (T1 generation + first health scan), and the evolution loop; both legacy hosts share the full docTier=3 documentation pipeline (seven-phase docs tree + full PRD/FRD/contract/page/test/deployment templates + naming guard and doc checks) plus a first-principles clarification step with a 3-question P0 budget for M/L requests, plus a using-steward router skill on both hosts, with optional MiniMax GenUI views for the task DAG, defect triage, and maintenance health. Since DSH 0.2.0 the DSH side is implemented entirely with DSH-native mechanisms: roles are **no longer registered as Agent Presets** since 0.3.0 (a writable specialist mode would bypass the gates), the bundle is host-only since 0.4.0, 0.5.0 split the main skill on demand into `inline` / `docs` and wired the **Agent Teams shared task board**, 0.6.0 added the **Steward team panel**, 0.9.0 added the `docs-governance` skill with G1–G11 local gates, and 1.0.0 closed the release. **The ZCode 1.0.0 and MiniMax 1.0.0 releases each align with DSH 1.0.0's process updates** (each host keeps its own native mechanism, semantics aligned): both add a `steward:docs-governance` skill (living / record / baseline document tiers, size budgets with hub-and-spoke splitting, frontmatter read contracts, `history/` snapshots with bidirectional traceability) and the harness-agnostic `steward:project-lifecycle` skill; ZCode keeps its gates under `scripts/docs-gov/`, MiniMax under `scripts/` (host-owned scripts, never cross-injected); the MiniMax side additionally splits the main skill on demand into `inline` / `docs` (pointer lines left in the main skill), implemented with MiniMax Code's own mechanisms (on-demand skills, subagent frontmatter, hooks, Mini App). The DSH side keeps zero functional changes.

**Since 1.1.0**: the DSH native roster command `/steward` is renamed **`/steward-roster`** — when a command shares a skill's name, the client side claims the token for the command, so `/steward` always echoed the roster and the skill body never loaded (the shadowing root cause); after the rename `/steward` is again the slash gesture that triggers the `steward` skill (the ZCode/MiniMax `/steward` slash commands are unaffected). The gate scripts' single source moved to `shared/scripts/` (shared by all three hosts; `zcode/scripts/` is downgraded to ZCode/MiniMax-proprietary tools plus write-back artifacts). A harness-agnostic skill-install path (`.agents/skills/`) is documented below.

## Modes

| Mode | Command | Status |
|---|---|---|
| Feature delivery | `/steward <request>` | Available in 0.6.0 |
| Inline execution | `/steward:inline <request>` | Available in 0.10.0 (S / B3 / maintenance small fixes only; M requires explicit opt-in; L and B0/B1/B2 are not allowed) |
| Clarification | with `/steward` (M/L/ambiguous) | Available in 0.8.0+ on both hosts (first-principles four questions + max 3 P0 questions; S-level skips) |
| Bug fix | `/steward:fix <bug>` | Available in 0.5.0 (ZCode command; on MiniMax / DSH trigger by natural language) |
| Plan only | `/steward:plan <request>` | Available in 0.5.0 (ZCode command; on MiniMax / DSH trigger by natural language) |
| Maintenance | `/steward:maintain` | Available in 0.6.0 (`maintain.mjs` scan + backlog; on MiniMax / DSH trigger by natural language) |
| Takeover | `/steward:take-over` | Available in 0.7.0+ (T1 generation + first health scan; on MiniMax / DSH trigger by natural language) |
| Documentation pipeline | `docTier: 3` (with `/steward`) | Available in 0.8.0+ on both hosts (seven-phase tree + full templates + doc checks; MiniMax synced in 1.6.0) |
| On-demand skill split | load `steward:inline` / `steward:docs` | Available in 1.0.0 on MiniMax (same as DSH 0.5.0: the main skill keeps a pointer, sections load on demand) |
| Document governance | load `steward:docs-governance` | Available in 1.0.0 on MiniMax (same as DSH 0.9.0: three document classes + G1–G11 gates + baseline snapshots) |
| Skill routing | load `steward:using-steward` | Available in 0.8.1+ on both hosts (route to the right mode when unsure which entry point/skill to use) |
| Subagent model config | load `steward:agent-settings` | Available in 0.9.0 on MiniMax (visual config page / CLI; ZCode keeps the host default model); DSH 0.2.0–0.3.0 used a native Settings → Steward page plus the `steward_config` tool — **since 0.4.0 the route is `modelRouting` in the project's `steward.config.json`** (page and tool removed) |
| DSH native mechanisms | registered with the plugin | DSH-native extension points since 0.2.0; roles de-moded since 0.3.0; **host-only** since 0.4.0 (no settings page / private config / browser half); 0.5.0 adds on-demand `inline` / `docs` skills + the **Agent Teams shared task board** (`steward_board` builds the board, the native Team panel is the dashboard); 0.6.0 adds the **Steward team panel**; since 1.1.0 the roster command is `/steward-roster` |
| Host guard hooks | active with the plugin (PreToolUse) | Available on both hosts since 0.11.0 (three guards: secrets / ownership / dangerous commands) |

Feature delivery: intake & sizing (S/M/L) → plan → approval gate → implementation → QA → browser acceptance → final review → finishing. Bug fixes are triaged by severity: B2/B3 follow "repro → failing test → root cause → minimal fix → regression → record"; B0/B1 add mitigation-first and a postmortem. Plan-only mode stops after the approval gate — no implementation. Maintenance: an eight-category scan (deps / security / duplication / churn / doc drift / cycles / flaky / TODO) → scored backlog → small fixes → HEALTH.md updates. Full design: [docs/ROADMAP.md](docs/ROADMAP.md).

## Roster (7 roles + Explore)

| Role | Dispatch name | Responsibility |
|---|---|---|
| Requirements analyst | `steward:pm` | Vague request → testable spec |
| Architect | `steward:architect` | Spec → technical plan + task DAG |
| Backend dev | `steward:backend-dev` | TDD implementation within file ownership |
| Frontend dev | `steward:frontend-dev` | UI implementation + acceptance script |
| QA engineer | `steward:qa-engineer` | Test / lint / typecheck gate |
| Browser tester | `steward:browser-tester` | Black-box browser acceptance |
| Reviewer | `steward:reviewer` | Final diff review, three severity levels |
| Explore (external) | built-in | Repository reconnaissance for L-sized work |

> On DSH the roles are **charters injected at dispatch time** (no Agent Preset is registered, so no Steward specialist mode appears in the mode picker); call `steward_dispatch(role=...)` with the role only, never hand-write a model.

## Core mechanics

- **Task DAG + file ownership**: parallel only when there is no dependency and file sets are disjoint.
- **S/M/L sizing**: small changes do not trigger the full team; M/L go through the plan approval gate (clean-context Plan Critic + user approval).
- **Execution modes (v0.10.0)**: `execution.mode` is either `subagent` (default: dispatch specialist subagents) or `inline` (the lead executes the plan itself, one task at a time). Inline keeps the plan, baseline, TDD, verify, and report gates — only the executor changes. S / B3 / maintenance small fixes are inline-eligible; M requires an explicit opt-in; L and B0/B1/B2 are forbidden.
- **Trusted-change gates (v0.5)**: `validate-plan.mjs` machine-checks the plan (paths exist / DAG acyclic / ownership disjoint / AC coverage / test changes must declare a reason); `verify.mjs` independently reruns test/lint/typecheck (`--repeat` detects flaky); `baseline record/check` records a rollback anchor and blocks out-of-bounds diffs; `run-state.mjs` resumes interrupted runs, stops after the same error twice, and enforces a retry budget. Local Node scripts only — no CI.
- **Bug track (v0.5)**: B0–B3 severity; a reproducible bug is not fixed without a failing test; anti-cheating (undeclared test diffs and weakened assertions are blocking).
- **Maintenance loop (v0.6)**: `maintain.mjs` scans eight categories (deps / security / duplication / churn / doc drift / cycles / flaky / TODO) → scored backlog → small fixes with evidence → HEALTH.md updates.
- **Browser evidence contract (v0.6)**: `browser-evidence.json` — every verdict cites readable state (ARIA/DOM/console/network/URL); Playwright / Chrome DevTools MCP first, built-in browser as fallback; layout/color findings are marked "visually unverified"; screenshots are attachments only.
- **Learning loop (v0.6)**: 05-record backfill — review findings, incident lessons, and user corrections are persisted into CONSTITUTION / ADRs / RUNBOOK / HEALTH.
- **Lightweight skills (v0.6)**: `systematic-debugging`, `tdd`, `verification-before-completion` — loaded on demand, never injected by default.
- **On-demand main-skill split (v1.0.0, MiniMax side)**: the "execution mode (inline)" and "T3 docs upgrade + documentation pipeline" sections are split out of the main skill into the `steward:inline` / `steward:docs` skills, leaving a pointer line in the main skill. `shared/` stays the single body source; the split is driven by the host config `host/<host>/skills/split-rules.json` (DSH does the same).
- **Document governance (v1.0.0, MiniMax side)**: the new `steward:docs-governance` skill applies three document classes (living documents govern size, record documents govern index, baseline documents govern version), size budgets, hub-and-spoke splitting, frontmatter read contracts, layered `07-治理` archiving, and `history/` snapshots with bidirectional traceability. The bundle ships `scripts/docs-gate.mjs` (G1–G11 gates: `check` / `init` / `fix` / `--baseline-write`) and `scripts/doc-snapshot.mjs` (nine-step baseline snapshot, idempotent).
- **Skill router (v0.8.1, ZCode side)**: load `steward:using-steward` when the user is unsure which entry point or skill to use; it only routes, never replaces the main skill.
- **Subagent model and thinking-effort configuration (v0.9.0, MiniMax side)**: change the model and effort of the 7 subagents from a visual page (an in-app Mini App, or the equivalent local page started by `agent-config.mjs serve`). The effort dropdown lists only the levels the selected model really supports (read live from the local model catalog, never hardcoded), and every write follows validate → back up → write → re-validate → roll back on failure. Project-level `steward.config.json` takes effect on the next dispatch; plugin defaults take effect in a **new session** after build + install. This also fixes the existing defect where agent frontmatter declared `model` but not `effort`, so a directly invoked subagent ran on the runtime default (observed: low) instead of the roster's high.
- **DSH native mechanisms (DSH 0.2.0 → 0.4.0)**: instead of porting the ZCode role/config shape, the DSH side is rebuilt on DSH's own extension points. (1) Roles are **never registered as Agent Presets**: a DSH preset is a user-selectable session mode with no "internal preset" concept; shipping the seven roles as presets would publish writable specialist modes that bypass the plan gate / baseline guard / QA / final review, so `steward_dispatch` starts children on the built-in `standard` composition and prepends the role charter (`roles/*.md`) before the task text (charter first, task last). (2) **One source of routes**: `modelRouting.<role>` in the project's `steward.config.json`, versioned with the code, reviewed in the same diff and machine-checked by the bundled `validate-config.mjs` — no native Config, no settings page, no `steward_config` tool. (3) `/steward-roster` registers on the native human-command registry (renamed from `/steward` in 1.1.0, which is now the slash gesture that triggers the `steward` skill). (4) Skills register through `ctx.skills`. (5) The plugin is **host-only**: no browser half, no private HTTP bridge, no private config file. Dispatch preflights the model and effort with `llm.resolveModelInfo`. The DSH-only builder `node host/dsh/build.mjs` reads `shared/` (including `shared/scripts/`) and the `zcode/skills/` reference library, writes only `dsh/`, and rewrites ZCode/MiniMax-specific prose (host MCP / `context7`) in the generated `roles/*.md` into DSH-native retrieval guidance; the package contract fails if `index.js` contains `agentPresets.register` / `export const Config` / `settings.update` / `steward_config`, or if `dsh/client.js` exists.
- **Project memory (v0.5)**: `take-over.mjs` drafts AGENTS.md + the seven `docs/project/` files (T0/T1) for a target project.
- **Artifact handoff**: `tmp/steward/<run-id>/`; no long prose in prompts.
- **Three quality gates**: QA → browser acceptance (when UI) → review; defects are routed back by ownership, at most two rounds.
- **Evidence over claims**: real output only; no polishing, no fabrication.

## Repository layout

```text
steward/
├── shared/                     # Single source: shared skill / agent bodies + the single-source gate scripts in shared/scripts/ (with @@SLOT@@ markers)
├── host/{zcode,minimax,dsh}/   # Host fragments: frontmatter, dispatch mechanics, model table, browser ops
├── zcode/                      # ZCode plugin package (skills/agents generated by build.mjs)
├── minimax/                    # MiniMax plugin package (skills/agents generated by build.mjs)
├── dsh/                        # DSH plugin package (host/client plugin + skills/roles/scripts, generated)
├── docs/
│   ├── README.md
│   ├── ROADMAP.md              # 2026 roadmap
│   └── ROADMAP-STATUS.md       # Delivery status with evidence
├── README.md                   # Chinese version
├── README.en.md                # English version (this file)
└── CHANGELOG.md
```

> Maintainer note: ZCode / MiniMax bodies are edited in `shared/` (common) or `host/<host>/` (host deltas) and generated with `node zcode/scripts/build.mjs`; the DSH side also consumes `shared/` but is generated by its own builder, `node host/dsh/build.mjs`, which only reads `shared/` (including `shared/scripts/`) plus the `zcode/skills/` reference library and only writes `dsh/`. Neither builder writes the other host's package; both `--check` modes catch hand edits and drift. Installed plugin copies do not need and should not run a builder.
>
> **Host isolation**: ZCode-side work touches only `zcode/` + `host/zcode/`; MiniMax-side work touches only `minimax/` + `host/minimax/`; DSH-side work touches only `dsh/` + `host/dsh/`. `shared/` (including `shared/scripts/`) is the shared source for all three hosts; since 1.1.0 `zcode/scripts/` holds only the ZCode/MiniMax-proprietary tools plus write-back artifacts, and DSH no longer reads it. Install/update separately: `zcode plugins update` for ZCode, `agent-config.mjs install --apply` for MiniMax, `plugin_manager install_bundle` targeting `dsh/` for DSH. See `AGENTS.md`.

## Installation

Each host's full install → usage → troubleshooting lives in its own README; this section only points there:

| Host | Package | How to install (see the link) | How to start |
|---|---|---|---|
| ZCode | `zcode/` | Local marketplace directory, 5 steps: [zcode/README.md](zcode/README.md) | New task with `/steward <request>` |
| MiniMax | `minimax/` | Rebuild first, then copy into `%USERPROFILE%\.minimax\plugins\steward\`: [minimax/README.md](minimax/README.md) | Natural language (the "开发团队 / Steward" keywords auto-trigger) |
| DSH | `dsh/` | Rebuild `dsh/` in the source repo → plugin-manager `install_bundle` targeting `dsh/` → **restart DSH**: [host/dsh/README.en.md](host/dsh/README.en.md) | Natural language ("Use Steward to build <request>"); roster command `/steward-roster` (`/steward` is the skill gesture) |

> Updates/upgrades and troubleshooting live in the same per-host READMEs. The generated packages (`zcode/`, `minimax/`, `dsh/`) are never hand-edited: edit `shared/` or `host/<host>/` and rerun the matching builder (see the maintainer note above).

## Universal harness skills (no full install needed)

Four Steward skills are harness-agnostic pure-instruction skills — no subagent, command-registry or hook requirements — and live under `shared/skills/` in the repository: `systematic-debugging` (systematic debugging discipline), `tdd` (test-first discipline), `verification-before-completion` (verify before claiming done) and `project-lifecycle` (the project lifecycle playbook, shipped with `references/` and `assets/`). Any harness with a skill directory can take them without installing the whole bundle:

- **Project level** (this repository only): copy into `<target-repo>/.agents/skills/<skill>/`;
- **User level** (every project on the machine): copy into `~/.agents/skills/<skill>/`. DSH discovers both paths natively; other harnesses follow their own skill-directory convention.

Copy command (PowerShell, project level; `<repo>` is this checkout, `<target-repo>` the project to install into):

```powershell
$src = "<repo>\shared\skills"; $dst = "<target-repo>\.agents\skills"
New-Item -ItemType Directory -Force "$dst" | Out-Null
'systematic-debugging','tdd','verification-before-completion','project-lifecycle' |
  ForEach-Object { Copy-Item -Path "$src\$_" -Destination "$dst\$_" -Recurse -Force }
```

For user level set `$dst` to `"$env:USERPROFILE\.agents\skills"`. A plain directory copy (SKILL.md + references/assets) — **no npm/npx installer involved**; it takes effect in a new session.

## Roadmap

- [docs/ROADMAP.md](docs/ROADMAP.md) · Delivery status: [docs/ROADMAP-STATUS.md](docs/ROADMAP-STATUS.md)
- Shipped in v0.5: bug track (B0–B3), plan approval gate + Plan Critic, plan validation / independent verification / baseline guard, resumable run state, T0/T1 project memory generation.
- Shipped in v0.6: maintenance loop (eight-category scan), browser evidence contract, learning loop (05-record backfill), systematic-debugging / TDD / verification skills, optional worktree + finishing, model routing + retry budget.
- Shipped in v0.7: takeover (T1 generation + first health scan), evolution loop (refactor-ratio check, codemod planning), six on-demand T3 templates, local dual-host build (build.mjs single source + validation), optional host guards (ownership / dangerous commands / secrets), GenUI maintenance health dashboard (dedicated recipe C), monorepo / multi-service guidance.
- Shipped in v0.8: full documentation pipeline — seven-phase `docs/01..07` tree, 19 template types + T2 requirement/evidence/record templates, AGENTS/rules constraint layer, naming guard and doc checks as local scripts (`scripts/doc/`); first-principles clarification kernel (four questions + a max-3 P0 question budget, S-level skips); worktree multi-branch merge drill 6/6 PASS; taskboard two non-blocking leftovers cleaned up (filter race + Cache-Control), fixture 22/22. The docs pipeline and clarification kernel are synced to both hosts by build.mjs since MiniMax 1.6.0.
- Shipped in v0.8.1: `steward:using-steward` router — when unsure which entry point/skill to use, route to feature delivery / bug / plan-only / maintenance / takeover / docs, and point to debugging / TDD / verification before completion; the MiniMax side is synced since 1.6.2 (routing table adapts per host: ZCode slash commands / MiniMax natural language).
- Shipped in DSH 0.2.0: the DSH side is rebuilt on native mechanisms — seven Agent Presets (`ctx.agentPresets`, persona + native tool compositions), model routes as this plugin's Config served by the native Settings namespace `steward` (volatile fields, persisted through the profile config editor), a settings page over `ctx.configForms` + `remote.session.modelCatalog()` (the private HTTP bridge and `~/.dsh/steward/subagent-config.json` are gone), preset-based dispatch over `ctx.subagents`, a native `/steward` command (renamed `/steward-roster` in 1.1.0), and skills through `ctx.skills`. The independent builder `node host/dsh/build.mjs` reads `shared/` and writes only `dsh/`, and rewrites ZCode/MiniMax-only MCP prose in generated role bodies into DSH-native retrieval guidance. `node --test host/dsh/tests/` covers eight cases: preset registration, Config, native settings persistence, preset dispatch, project routing, and the command.
- Shipped in 1.0.0 (MiniMax side, aligned with DSH 1.0.0): on-demand main-skill split (`inline` / `docs`) + the `docs-governance` document-governance skill + bundled gates (`docs-gate.mjs` G1–G11, `doc-snapshot.mjs` idempotent snapshots). The shared builder gained three host hooks (host-level skill split, host-level skill override, host-level script directory); the ZCode output stays byte-identical. Both legacy hosts move to version 1.0.0.
- Shipped in 1.1.0: the DSH native command was renamed to `/steward-roster`, un-shadowing the `steward` skill (breaking change; `/steward` is the skill gesture again); the gate scripts' single source moved from `zcode/scripts/` to `shared/scripts/`; the harness-agnostic `.agents/skills/` install paths are documented; README responsibilities were re-split and versions unified.
- Next: MiniMax-host GenUI verification and DSH **Steward team panel** browser rendering/interaction verification (the Client Slots check confirmed the page occupant is active, but no visual capture was taken).

## Renamed from dev-team

Steward is the renamed version of the `dev-team` plugin. The plugin ID, command, agent prefix, and skill namespace are now `steward`; uninstall the old version before installing the new one.

## License

MIT
