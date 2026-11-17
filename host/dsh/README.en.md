# Steward — long-lived engineering team (DSH plugin)

Steward is a multi-role engineering team plugin for DeepSeek Harness. The lead agent acts as **Tech Lead**: it decomposes a request into a task DAG, dispatches each task to the right specialist subagent by dependency and file ownership, and ships only after the plan approval gate, QA, browser acceptance, and final review.

The goal is not to write the code once, but to keep the project **understandable, verifiable, reversible, and evolvable** after every change.

The plugin uses DSH-native extension points only: roles are **charters injected at dispatch time** (`roles/*.md`; no Agent Preset is registered, so roles never occupy the mode picker), model routes prefer the project's `steward.config.json` and fall back to the **Settings → Steward** table, dispatch goes through `steward_dispatch` over `ctx.subagents` (children run the built-in `standard` composition), `/steward-roster` is a native human command (`/steward` is the slash gesture that triggers the `steward` skill — type a space after it, or just press Enter), skills register through `ctx.skills`, and the UI is a **per-session team panel in the right sidebar** (a layered workflow graph by default — Lead → spec → architecture → implementation → quality → acceptance → review, compact cards per stage joined by hand-off connectors; each node shows role, actual model, task, state, elapsed and usage; click a node to enter its session; a native task-progress bar on top) plus the **Settings → Steward model table**, built on native slots / configForms / session navigation — no custom HTTP bridge.

## The Steward team panel in the right sidebar (one per session)

The panel lives in the session's **right sidebar**. That sidebar saves its layout per session, so **every session opens its own panel — switching sessions switches panels**. Three ways to open it:

1. the **Steward icon** in the session header (`conversation.session.header.utilities`);
2. the **"Steward team" entry** on the right sidebar's guide page;
3. **automatically**: the first Steward dispatch in a session (a subagent started by `steward_dispatch`, labelled like `backend-dev · T1 export endpoint`) opens the panel once; once the user closes it, it stays closed.

**The panel answers one question: which agent, with which model, doing which task, how far along.** Three blocks from top to bottom:

1. **Native task progress bar** — `done/total`, one segment per native task (done green / in-progress blue pulse / not-started grey / blocked amber), in-progress and blocked counts, and the source (`Agent Teams board` or `Session task list`). **Counts only — no task names**: read the tasks in the task list DSH itself keeps.
2. **Layered workflow tree (default view, free-drag and zoomable canvas)** — the `Lead · this session` card roots the tree at the top left (its own actual model and usage), and a vertical trunk chains the stage hubs **spec → architecture → implementation → quality → acceptance → review** (empty stages are skipped). Every hub branches right into its cards — up to three columns on a wide panel, one on a narrow one — with exactly one parent edge per card and no crossings, so eighteen concurrent agents add cards, not lines. A node shows: the role (localized name) and state dot (the role id lives in the details); the **actual model** (`model @ reasoning effort`, read from that child's `modelSelection` projection — "model pending" before its first request, never a guess); the task description; elapsed time (ticking while it runs) and summed tokens.

   Interactions: the graph is a **free canvas** — **dragging a card moves that card** (kept until the panel closes; `⟲` or `r` restores the computed layout), dragging empty space pans the view, `Ctrl`/`⌘`+wheel zooms at the pointer, and the toolbar offers `− / 100% / + / ⤢ / ⟲` (click the percentage to reset, `⤢` fits, `⟲` re-layouts); with focus, `+` / `-` / `0` / `f` / `r` / arrows work too, and double-clicking empty space resets the view. **Clicking a card opens that child session** (a drag never does); the `⌄` in its corner expands the facts in place (provider / reasoning effort / four token buckets / turns · steps / mode / child session id / open action). The second toolbar row is the **filter**: `All / Hide done / Active only` (with a hidden count on the right, remembered in `dsh-steward.panel.filters`); **clicking a hub collapses or expands that stage's cards** (the collapsed hub keeps the count and the waiting dot). The header still switches between **Graph (default)** and **List**.
3. **Artifacts (collapsed by default)** — files under `tmp/steward/<run>/` (`run.json`, `03-plan.json`, plus the reports and evidence under `reports/` and `evidence/`); click a row to open the file in the right sidebar. The run directory sits under the toggle.

**Every fact comes from a native live projection** — no task-file polling:

| What the panel shows | Native source |
|---|---|
| Subagent roster / role | the `subagentCatalog` projection (label = `role · task`) |
| Running / **waiting on you** | Session UI status (`running` / `pendingInteraction` from `useSessionStatus`) |
| Actual model | the `modelSelection` projection (`lastUsed`, else `next`) |
| Tokens | the `tokenUsage` projection (uncached input / output / cache read / cache write) |
| Elapsed / normal completion | the `subagentTiming` projection (`settledMs`, `active.since`, `lastTurnCompleted`) |
| Turns / steps (detail) | the `sessionStats` projection (the panel asks the host once per child) |
| Task progress | the `agentTeam` projection (Agent Teams shared board), else the `todos` projection |
| Artifacts / run directory | the workspace-files Remote, polled every 15s |

The panel **does not read** the task content of `03-plan.json`, **does not draw** a task DAG or an ownership matrix, and **does not copy** the task list: task state belongs to DSH's native task system (copying it was the root cause of the stale task list users saw in the old panel). Without a workspace file service the artifacts section prints one explanatory line and everything else works as usual.

**Settings now holds models only**: the "Settings → Steward" section renders nothing but the per-role model and reasoning-effort table (role / provider / model / effort / source, plus the defaults row and save / discard). The runtime panel is gone from Settings. The precedence is unchanged: project `steward.config.json` `modelRouting.<role>` > the role's Settings entry > the Settings default > inherit the parent agent.

The **left navigation no longer has a Steward page**: the panel exists only in the right sidebar. It registers no Agent Preset, writes no files and opens no HTTP bridge.

## Installation

Prerequisite: Node.js on the machine. `dsh/` is generated by `host/dsh/build.mjs`; rebuild it from the source repo before installing:

```powershell
node host/dsh/build.mjs            # regenerate dsh/ (writes only dsh/)
node host/dsh/build.mjs --check    # expect PASS with zero warnings
```

Then install the local bundle directory from the DSH plugin manager:

```text
plugin_manager(action="install_bundle", target="<repo>/dsh")
```

**Restart DSH afterwards** (host code loads on restart) and open a **new session**; the session skill list is a snapshot, so an old session may still show the previous wording. To upgrade, run `install_bundle` against the same directory again and restart; during development you can hot-reload with the plugin manager's disable/enable. The installed plugin directory never needs — and should never run — a builder.

## What you get after installation

| Capability | Shape |
|---|---|
| Seven roles | Role charters injected at dispatch time (`roles/*.md`): pm, architect, backend-dev, frontend-dev, qa-engineer, browser-tester, reviewer. **No Agent Preset is registered**, so roles never appear in the mode picker |
| Dispatch | `steward_dispatch(role, description, prompt, cwd?)`: one call per role; the charter is prepended to the task prompt, the child session id comes back, and the result arrives automatically |
| Model & effort | `modelRouting.<role>` in the project's `steward.config.json` (wins, checked by `scripts/validate-config.mjs`), else the role's or default selection in **Settings → Steward**, else the parent agent |
| **Right-sidebar team panel** | One per session, opened three ways (the Steward icon in the session header / the right sidebar's guide entry / once automatically on the first Steward dispatch): a **free-drag, zoomable workflow tree by default** — the `Lead` roots it at the top left, a vertical trunk chains the stage hubs (spec → architecture → implementation → quality → acceptance → review) and every hub branches right into compact cards (auto 2–3 columns on a wide panel); cards can be dragged, hubs collapsed and finished agents filtered out; each node shows role / **actual model** (provider/model + effort) / task / state (waiting on you, running, not started, completed, idle) / elapsed / tokens; **click a node to open its child session**, `⌄` expands the facts (provider, four token buckets, turns/steps, mode, child session id). Drag to pan, `Ctrl`+wheel or the toolbar to zoom, double-click to reset. A **native task-progress bar** on top counts the task list DSH itself keeps (counts and source only, never the tasks); artifacts sit in a collapsed section (`tmp/steward/<run>/`, click a row to open the file). The per-role model table lives in Settings → Steward |
| Main skill | `steward`: the Tech Lead playbook (sizing / DAG / dispatch / gates / finishing) |
| Documentation entries (4) | `docs-new` (new project, build the 01→07 baseline), `docs-takeover` (existing repository: inventory and re-home first, then fill gaps), `docs-feature` (one feature or requirement change: only the touched phases), `docs-review` (dispatch a fresh reviewer, then issue the receipt). One scenario per entry, no "one skill does everything" |
| Documentation rules | `docs-rules`: seven-phase writing rules, SSOT map, change-link table and template index (an entry it is not) |
| Readiness gate | `scripts/docs-ready.mjs`: phase artifacts, empty shells, template placeholders, `na` reasons, FR↔FP traceability, plan `docsRead`, review verdict — the receipt `.steward/docs-state.json` must be green before `backend-dev` / `frontend-dev` can be dispatched |
| On-demand skills | `inline` (what the lead must still do when it executes a task itself) and `docs-governance` (the increment layer for splitting, archiving, versioned snapshots and the `docs-gate` / `doc-snapshot` gates) |
| Companion skills | `using-steward` (routing), `agent-settings` (model config), `systematic-debugging`, `tdd`, `verification-before-completion` |
| Shared task board | `steward_board(action="sync"/"status"/"brief")`: turns `03-plan.json` into gate + work tasks on the Agent Teams board; read task state in the **native Team panel**, the right-sidebar panel only counts it |
| Command | `/steward-roster`: echoes the roster and the routing rule (it does not dispatch work); `/steward` is the slash gesture that triggers the `steward` skill |
| Gate scripts | `scripts/`: `validate-plan.mjs`, `verify.mjs` (including `baseline record/check`), `run-state.mjs`, `maintain.mjs`, `take-over.mjs`, `validate-config.mjs`, `docs-ready.mjs` (documentation receipt), `docs-gate.mjs` / `doc-snapshot.mjs` (documentation governance), plus the `doc/` documentation-pipeline tools |

## Why no modes (Agent Presets)

In DSH a preset *is* a user-selectable session mode; there is no "internal preset". Shipping the seven roles as presets publishes seven **writable specialist modes**: a human switches into "Steward · Backend engineer", asks it to edit code, and gets a fake Steward that bypasses the plan gate, baseline guard, QA and final review — defeating the only thing this plugin is worth.

So the DSH side registers no Agent Preset at all. Steward is a *process* (skills + tools + gate scripts): `steward_dispatch` starts each child on the built-in `standard` composition and prepends that role's **charter** to the task prompt. The trade-off: workers carry the full `standard` toolset (delegation depth defaults to 1, which stops worker-of-worker), in exchange for a clean mode picker and no preset composition to keep in sync with DSH upgrades.

## Why routing lives in the project

Same argument, applied to configuration: **the project is the first source of truth**. Per-role models and reasoning efforts live in `modelRouting.<role>` in the project's `steward.config.json` — versioned with the code, reviewed in the same diff, revertible, and machine-checked by the bundled `validate-config.mjs`. Only roles the project omits fall back to the native Config in **Settings → Steward** (namespace `steward`), then to the parent route. That way "which model does QA use in this repo?" always has a definite answer instead of becoming unsearchable per-machine history. The plugin ships **no** `steward_config` tool and **builds no** private config file or HTTP bridge of its own.

## The shared task board and the right-sidebar team panel (Agent Teams)

With the host's Agent Teams bundle enabled, the shared task board is the **authoritative source** of task state; the **native Team panel in the Web session header** is where tasks are read (members, owners, dependencies, readiness, write scopes, overlap warnings). Steward's **right-sidebar team panel** no longer mirrors the board: it draws the **agents** (who runs where, with which model, doing which task, how far along) and counts the **tasks** (the progress bar shows `done/total`, in-progress and blocked counts and the source). `steward_board(action="sync", plan="<run>/03-plan.json", level="M")` turns the plan into native board tasks (idempotent, matched through the `steward:plan=` / `steward:gate=` markers in each description):

| Board task | Source | What the native Team panel shows |
|---|---|---|
| `G1 · Plan approval` | gate | Until it is completed no work item can be claimed (native dependency gate) |
| `T<id> · <role> · <title>` | `03-plan.json` tasks | Status dot, owner, dependencies, readiness; write scopes come from file ownership and overlaps warn |
| `G2 · QA gate` / `G3 · Final review` | gate | Blocked by all work items / by QA, so the process order is visible |

- The description is a fixed block: goal, done-when, ownership, report path, covered acceptance criteria, plus the `steward:plan=` / `steward:role=` markers (a two-line summary in the Team panel, expandable full text).
- Status semantics: `pending` not started / `in_progress` owned by someone / `completed` means the report landed and the task's own verification passed. **A blocked task cannot be claimed** — Steward's DAG and gates run at the native layer.
- Dispatch: `steward_board(action="brief", role="backend-dev", task="T1")` → hand the brief to `spawn_teammate` → `team_task_update(action="reassign", owner=<teammate>)`; the teammate claims before working.
- Without the bundle there is no `agentTeams` service, `steward_board` fails loudly, and the solo `steward_dispatch` + `run.json` path stays in charge; the panel's progress bar then falls back to the Session's own task list (the `todos` projection) while the agent graph is unaffected.

## Documentation entries and the implementation gate (docTier=3)

Writing docs is no longer one blanket skill: three entry skills per scenario plus a review entry, with the rules and templates kept in a separate library.

| You say | Loads | Covers |
|---|---|---|
| New project / build the baseline from scratch | `docs-new` | 01 requirements (PRD→FRD) → 02 architecture → 03 contracts (+05 pages) → 06 test baseline → 07 governance files → closure check → review → receipt |
| Take over an existing repository | `docs-takeover` | `take-over.mjs` writes T1 → inventory and re-homing map (needs a decision) → `docs-gate --baseline-write` records the baseline → fill the gaps |
| One feature / requirement change | `docs-feature` | Impact scan → collect the decisions → touch only the affected phases (the rest `na` with a reason) → land the change-link table in one batch |
| Review / can we start implementing? | `docs-review` | A fresh reviewer (clean context, read-only) → verdict lands in `docs/07-治理/评审记录/` with a machine-readable block → `approve` |

**The gate is not a prompt.** With `docTier: 3` in `steward.config.json`, `steward_dispatch` verifies the receipt in `.steward/docs-state.json` and the current docs hash before dispatching `backend-dev` / `frontend-dev`, and refuses otherwise. `architect` / `reviewer` / `qa-engineer` / `browser-tester` are never gated, so someone can fix and review the documents. Only the script issues receipts:

```bash
node scripts/docs-ready.mjs <root> init --scope new|takeover|feature --write   # declare the scope
node scripts/docs-ready.mjs <root> check [--plan <03-plan.json>] [--strict]    # closure check
node scripts/docs-ready.mjs <root> approve --review <review record>            # issue the receipt
node scripts/docs-ready.mjs <root> status                                      # current state (incl. stale)
```

Codes: `E-DOC-MISSING` / `E-DOC-PLACEHOLDER` / `E-DOC-THIN` / `E-NA-REASON` / `E-PLAN-DOCSREAD` / `E-PLAN-NA-CONFLICT` / `E-STATE-STALE` / `E-REVIEW-*`. Any change to a rule-bearing document voids the receipt; `执行步骤.md`, `评审状态.md` and `评审记录/` are excluded from the hash so day-to-day bookkeeping does not force a re-review.

**Rollback**: set `docTier` back to 1 or 2 and the whole gate is off — no code change needed.

## Documentation governance (`docs-governance`, an increment layer)

`docs-new` / `docs-takeover` / `docs-feature` build and update the tree; `docs-governance` keeps that tree from turning into a swamp: splitting, archiving, versions and read contracts. Triggers: "the docs are getting too long", "reviews are piling up under 07-governance", "this PRD needs a version".

| Kind of document | How it grows | Treatment |
|---|---|---|
| Living (AGENTS / README / docs map / T1 / a single volume) | edited in place, one document per topic | line budgets (100 / 120 / 150 / 120 / 400 / 150) + hub-and-spoke splits |
| Record (one ADR, one review) | append-only, a record never mutates | thin always-read index + quarterly `archive/` rotation |
| Baseline (PRD / FRD / API contract / data model) | edited in place + milestone snapshots | frontmatter `version` + revision log + same-domain `history/` snapshots with a sha256 manifest |

Two bundled scripts (plain Node, zero dependencies, run by absolute path from the target repo root):

| Script | What it does |
|---|---|
| `scripts/docs-gate.mjs <root> check` | G1–G11: budgets, frontmatter read contract, no frontmatter on AGENTS, 07 layering, generated index block, ADR cross-check, version in three places, snapshot integrity, current version not in history, revision evidence, plan `docsRead` |
| `scripts/docs-gate.mjs <root> init` / `fix` | Scaffold the inner 07 layers and each domain's `history/`; rewrite the generated index block in `docs/README.md` (idempotent, never overwrites) |
| `scripts/doc-snapshot.mjs <doc> --next <ver>` | Baseline snapshot: original into `history/` + manifest hash + index row + `superseded-by` + current-doc bump + revision row (idempotent; a rerun prints `skip`) |

Overrides for budgets and the baseline live under `docsGovernance` in the project's `steward.config.json`; on an existing project record the baseline with `--baseline-write` and ratchet down only. It runs alongside `doc-check.mjs`, not instead of it.

## Quick start

1. **Install** following the Installation section above: rebuild `dsh/` → `install_bundle` targeting `<repo>/dsh` → restart DSH.

2. **Open a new session** and state the request in natural language, for example:

   ```text
   Use Steward to write a money-summary script in tmp/demo, with unit tests and a green run.
   ```

   The lead agent loads the `steward` skill: intake & sizing (S/M/L) → clarification → task DAG + file ownership → dispatch → QA → browser acceptance → final review → report.

3. **Change a subagent model**: add `modelRouting` to the project's `steward.config.json` (or just say "configure subagent models" and the lead loads `agent-settings` to edit it and run `validate-config.mjs`). The next `steward_dispatch` uses it immediately, with no restart.

## Entry points

| Goal | Say |
|---|---|
| Feature delivery | "Use Steward to build <request>" → six stages + plan approval gate |
| Inline execution | "Do it yourself / don't spawn subagents" → S / B3 / maintenance small fixes only; M requires explicit opt-in; L and B0/B1/B2 are forbidden |
| Bug fix | "Fix this bug / this feature is broken" → B0–B3 triage |
| Plan only | "Plan only, don't write code yet" → stop at the approval gate, no implementation |
| Maintenance loop | "Run a maintenance scan" → eight-category scan + scored backlog + small fixes |
| Takeover | "Take over this repository, inventory first" → T1 project memory + first health scan |
| Documentation entry (new project) | "New project / initialise the seven-phase docs" → `docs-new`: build the baseline, review it, then get the receipt |
| Documentation entry (takeover) | "Take over this repo / the docs are missing" → `docs-takeover`: inventory and re-home, then fill gaps |
| Documentation entry (one feature) | "Write the docs for this feature / which docs does this change touch" → `docs-feature`: impact scan, only the affected phases |
| Documentation review | "Review the docs / is the documentation ready to start" → `docs-review`: fresh reviewer → review record → `approve` |
| Documentation governance | "The docs are too long / reviews pile up under 07 / this PRD needs a version" → `docs-governance`: splitting, archiving, `history/` snapshots, `docs-gate` / `doc-snapshot` |
| Model / effort | "Configure subagent models" → `agent-settings`: edit `modelRouting` in the project's `steward.config.json` and run `validate-config.mjs` |
| Unsure which entry | Load `using-steward` to route |

## Roster

| Role | `role` | Responsibility |
|---|---|---|
| Requirements analyst | `pm` | Vague request → testable spec |
| Architect | `architect` | Spec → technical plan + task DAG |
| Backend dev | `backend-dev` | TDD implementation within file ownership |
| Frontend dev | `frontend-dev` | UI implementation + acceptance script |
| QA engineer | `qa-engineer` | Test / lint / typecheck gate |
| Browser tester | `browser-tester` | Black-box browser acceptance |
| Reviewer | `reviewer` | Final diff review, three severity levels |

## Model routes

```json
{
  "modelRouting": {
    "reviewer": { "model": "ctaigw/glm-5.3", "effort": "high" },
    "qa-engineer": { "model": "ctaigw/glm-5.3-flash" }
  }
}
```

1. **The user's explicit choice** for this dispatch wins.
2. **Project-level** `modelRouting.<role>`: `steward_dispatch` walks up from the dispatch `cwd` to the project root; the next dispatch uses it.
3. **Inherit the parent agent** when the role has no entry.

Before dispatching, the route is checked with `llm.resolveModelInfo`; an unknown model or an unsupported effort fails loudly instead of degrading silently. A malformed entry (for example a `model` without the `provider/` prefix) counts as "not configured" and degrades to inheriting the parent. Validate the file with `node <package>/scripts/validate-config.mjs <project>/steward.config.json`.

## How it works and its boundaries

- Tasks run in parallel only when they have no dependency and disjoint file ownership; everything else follows the DAG.
- S/M/L sizing: small changes skip the full team; M/L pass the plan approval gate (clean-context Plan Critic + user approval).
- Trusted-change gates: plan machine-check, independent test/lint/typecheck reruns, baseline guard, resumable run state, and a retry budget.
- Three quality gates: QA → browser acceptance (when UI) → review; defects are routed back by ownership, at most two rounds.
- Evidence over claims: no polishing, no fabrication; a failure is reported as a failure.
- DSH-side scope: skills (main skill plus on-demand `inline` / `docs-rules` / `docs-governance` and the four documentation entries `docs-new` / `docs-takeover` / `docs-feature` / `docs-review`, 13 in total), roles (charters injected at dispatch time, no registered modes), model routing (project file first, then Settings), dispatch (with the docTier=3 documentation gate), the **right-sidebar team panel** (one per session; a layered workflow graph by default (stages from top to bottom, hand-off connectors) with role / actual model / task / state / elapsed / usage per node, click-through to the child session, and a native task-progress bar that only counts) with the Settings model table, the Agent Teams shared task board, the `/steward-roster` roster command, and the gate scripts are aligned. The ZCode/MiniMax `PreToolUse` guard hooks are not ported yet (DSH tool guards are a different in-host mechanism). Browser acceptance follows a three-step ladder: repository Playwright → DSH sidebar driven by a human → manual fallback.

## Universal harness skills (no full install needed)

Four Steward skills are harness-agnostic pure-instruction skills — no subagent, command-registry or hook requirements — and live under `shared/skills/` in the repository: `systematic-debugging` (systematic debugging discipline), `tdd` (test-first discipline), `verification-before-completion` (verify before claiming done) and `project-lifecycle` (the project lifecycle playbook, shipped with `references/` and `assets/`). Any harness with a skill directory can take them without installing the whole bundle:

- **Project level** (this repository only): copy into `<target-repo>/.agents/skills/<skill>/`;
- **User level** (every project on the machine): copy into `~/.agents/skills/<skill>/`. DSH discovers both paths natively (the `project-agents` / `user-agents` discovery roots); other harnesses follow their own skill-directory convention.

Copy command (PowerShell, project level; `<repo>` is this checkout, `<target-repo>` the project to install into):

```powershell
$src = "<repo>\shared\skills"; $dst = "<target-repo>\.agents\skills"
New-Item -ItemType Directory -Force "$dst" | Out-Null
'systematic-debugging','tdd','verification-before-completion','project-lifecycle' |
  ForEach-Object { Copy-Item -Path "$src\$_" -Destination "$dst\$_" -Recurse -Force }
```

For user level set `$dst` to `"$env:USERPROFILE\.agents\skills"` (or point `DSH_AGENTS_HOME` at a custom directory). A plain directory copy (SKILL.md + references/assets) — **no npm/npx installer involved**; it takes effect in a new session.

## Troubleshooting

- **Typing `/steward` echoes the roster instead of the skill**: since 1.1.0 the roster command is `/steward-roster`; `/steward` is the skill gesture again. If it still echoes the roster you are on an old bundle — reinstall with `install_bundle` and restart DSH.
- **The `/steward` gesture does not load the skill**: the gesture requires a space after `/steward` (or just Enter); typing it glued to the request (e.g. `/stewarddo X`) is not recognized. Natural language ("Use Steward to build <request>") always works.
- **Nothing changed after installing**: host code loads after a DSH restart; skill lists are per-session snapshots — open a **new session**; during development use the plugin manager's disable/enable to hot-reload.
- **Hand edits to `dsh/` fail `--check`**: `dsh/` is generated; edit `shared/` or `host/dsh/` and rerun `node host/dsh/build.mjs`.
- **Model route not applied**: a malformed `modelRouting.<role>` entry (for example a `model` without the `provider/` prefix) counts as "not configured" and inherits the parent; validate with `node <package>/scripts/validate-config.mjs <project>/steward.config.json`.
- **Known limitation**: the bundled `scripts/validate-config.mjs` cannot run standalone — it misses the host-proprietary `agent-config-core.mjs`, which is not shipped in the DSH bundle (this does not affect `steward_dispatch`'s project-level route reading, which the plugin resolves itself); run the identical script from the source repo when you need the machine check.

## More

- Repository and full docs (Chinese): <https://github.com/Wjl1224734792/steward>
- 中文：<https://github.com/Wjl1224734792/steward/blob/main/dsh/README.zh.md>
- Changelog: <https://github.com/Wjl1224734792/steward/blob/main/CHANGELOG.md>
- Roadmap: <https://github.com/Wjl1224734792/steward/blob/main/docs/ROADMAP.md>
- License: MIT
