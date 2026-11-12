# Steward — long-lived engineering team (DSH plugin)

Steward is a multi-role engineering team plugin for DeepSeek Harness. The lead agent acts as **Tech Lead**: it decomposes a request into a task DAG, dispatches each task to the right specialist subagent by dependency and file ownership, and ships only after the plan approval gate, QA, browser acceptance, and final review.

The goal is not to write the code once, but to keep the project **understandable, verifiable, reversible, and evolvable** after every change.

The plugin uses DSH-native extension points only: roles are **charters injected at dispatch time** (`roles/*.md`; no Agent Preset is registered, so roles never occupy the mode picker), model routes prefer the project's `steward.config.json` and fall back to the **Steward panel** settings, dispatch goes through `steward_dispatch` over `ctx.subagents` (children run the built-in `standard` composition), `/steward` is a native human command, skills register through `ctx.skills`, and the UI is the **Steward team panel** (a sidebar full page plus a settings section, built on native slots / configForms / session navigation — no custom HTTP bridge).

## The Steward team panel (full Web page)

Click **Steward team** in the sidebar (`sidebar.panellist` entry → the `main` page). The page skeleton, type scale and hairlines follow the host's own pages (20px page title, 14px section titles, `.5px` dividers, 960px content column); every color comes from `--dsw-alias-*` theme tokens, so light and dark both work without literal colors.

**One picture answers "where is this stuck".** The board is a dependency DAG (G1 → T1/T2/T3 → G2 → G3), so the default view is a graph rather than a list:

1. **Run summary** — a completion ring, one progress segment per task (with ticks at the gate positions) and the member / running / blocked counts sit in the page header. With more than one Agent Teams session a **team switcher** appears above (`role="tablist"`, arrow keys move between teams) and only one team is expanded.
2. **Dependency graph (default)** — tasks are layered left to right by dependency with orthogonal, arrowed edges. A node shows its plan short id, the title (without the redundant role prefix), the owner's initials and how many files it writes; state reads from the left accent bar, the dashed border for blocked work and the legend. **Hovering or selecting highlights the whole upstream/downstream path** and fades the rest. Keyboard: Tab enters, arrow keys move between tasks, Enter opens the detail, Escape clears. Deep boards narrow the nodes so nothing overflows; past 40 tasks the list view is shown by default.
3. **Ownership matrix** — one row per write path, one column per agent, a real `<table>` that screen readers can follow; a file written by two agents gets an "overlap" row tint, so Steward's file-ownership rule is visible at a glance.
4. **List** — the complete text alternative, linked to the graph: selecting a row highlights its node and vice versa.
5. **Detail and rail** — selecting a task shows its status, owner, dependencies (clickable to jump to the prerequisite), write scopes, overlap warnings, description and an "Open the owner's session" action; the rail lists the lead and members (avatar, state, model, current task — click to open the sub-session) plus **needs attention** items (failed members, file overlaps, dangling dependencies, cycles).
6. **Models and effort** — one compact table (role / provider / model / effort / source) headed by the defaults row; the dropdowns are fed by the live model catalog and saved through the native `configForms` into the profile's `- id: steward` row. A `modelRouting` entry in the project's `steward.config.json` still wins for that role, and each row shows which source is in effect. Below 760px the table degrades to one card per role.

With no shared board yet, the page explains the three setup steps and offers "Copy the board request". The panel never registers a session mode, never writes files and never opens an HTTP bridge.


## What you get after installation

| Capability | Shape |
|---|---|
| Seven roles | Role charters injected at dispatch time (`roles/*.md`): pm, architect, backend-dev, frontend-dev, qa-engineer, browser-tester, reviewer. **No Agent Preset is registered**, so roles never appear in the mode picker |
| Dispatch | `steward_dispatch(role, description, prompt, cwd?)`: one call per role; the charter is prepended to the task prompt, the child session id comes back, and the result arrives automatically |
| Model & effort | `modelRouting.<role>` in the project's `steward.config.json` (wins, checked by `scripts/validate-config.mjs`), else the Steward panel's per-role/default selection, else the parent agent |
| **Team panel** | Sidebar "Steward team" full page (`main` slot): run summary (members / completion / blocked with a progress bar), a team switcher when several boards exist, lead row + member cards (**click one to open its session**), a gate phase rail with work-item rows, and the per-role model + effort table (the same table is in Settings → Steward) |
| Main skill | `steward`: the Tech Lead playbook (sizing / DAG / dispatch / gates / finishing) |
| On-demand skills | `inline` (what the lead must still do when it executes a task itself) and `docs` (the docTier=3 seven-phase pipeline), both split out of the main skill |
| Companion skills | `using-steward` (routing), `agent-settings` (model config), `systematic-debugging`, `tdd`, `verification-before-completion` |
| Shared task board | `steward_board(action="sync"/"status"/"brief")`: turns `03-plan.json` into gate + work tasks on the Agent Teams board; status is read in the native Team panel |
| Command | `/steward`: echoes the roster and the routing rule (it does not dispatch work) |
| Gate scripts | `scripts/`: `validate-plan.mjs`, `verify.mjs` (including `baseline record/check`), `run-state.mjs`, `maintain.mjs`, `take-over.mjs`, `validate-config.mjs`, plus the `doc/` documentation-pipeline tools |

## Why no modes (Agent Presets)

In DSH a preset *is* a user-selectable session mode; there is no "internal preset". Shipping the seven roles as presets publishes seven **writable specialist modes**: a human switches into "Steward · Backend engineer", asks it to edit code, and gets a fake Steward that bypasses the plan gate, baseline guard, QA and final review — defeating the only thing this plugin is worth.

So the DSH side registers no Agent Preset at all. Steward is a *process* (skills + tools + gate scripts): `steward_dispatch` starts each child on the built-in `standard` composition and prepends that role's **charter** to the task prompt. The trade-off: workers carry the full `standard` toolset (delegation depth defaults to 1, which stops worker-of-worker), in exchange for a clean mode picker and no preset composition to keep in sync with DSH upgrades.

## Why routing lives in the project

Same argument, applied to configuration: **one source of truth**. Per-role models and reasoning efforts live in `modelRouting.<role>` in the project's `steward.config.json` — versioned with the code, reviewed in the same diff, revertible, and machine-checked by the bundled `validate-config.mjs`. That is why this plugin **declares no native Config, ships no Settings → Steward page, has no `steward_config` tool and no browser half**: a per-machine route store turns "which model does QA use in this repo?" into unsearchable history.

## The shared task board *is* the dashboard (Agent Teams)

With the host's Agent Teams bundle enabled, **the Team panel in the Web session header is Steward's run dashboard** — there is no second UI to build. `steward_board(action="sync", plan="<run>/03-plan.json", level="M")` turns the plan into native board tasks (idempotent, matched through the `steward:plan=` / `steward:gate=` markers in each description):

| Board task | Source | What the panel shows |
|---|---|---|
| `G1 · Plan approval` | gate | Until it is completed no work item can be claimed (native dependency gate) |
| `T<id> · <role> · <title>` | `03-plan.json` tasks | Status dot, owner, dependencies, readiness; write scopes come from file ownership and overlaps warn |
| `G2 · QA gate` / `G3 · Final review` | gate | Blocked by all work items / by QA, so the process order is visible |

- The description is a fixed block: goal, done-when, ownership, report path, covered acceptance criteria, plus the `steward:plan=` / `steward:role=` markers (two-line summary in the panel, expandable full text).
- Status semantics: `pending` not started / `in_progress` owned by someone / `completed` means the report landed and the task's own verification passed. **A blocked task cannot be claimed** — Steward's DAG and gates run at the native layer.
- Dispatch: `steward_board(action="brief", role="backend-dev", task="T1")` → hand the brief to `spawn_teammate` → `team_task_update(action="reassign", owner=<teammate>)`; the teammate claims before working.
- Without the bundle there is no `agentTeams` service, `steward_board` fails loudly, and the solo `steward_dispatch` + `run.json` path stays in charge.

## Quick start

1. **Install** from the DSH plugin manager, targeting the local bundle directory (rebuild `dsh/` with `node host/dsh/build.mjs` from the source repo first):

   ```text
   plugin_manager(action="install_bundle", target="<repo>/dsh")
   ```

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
| Documentation pipeline | `docTier: 3` (with `/steward`) → seven-phase docs tree + full templates |
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
- DSH-side 0.6.0 scope: skills (main skill plus on-demand `inline` / `docs`), roles (charters injected at dispatch time, no registered modes), model routing (project file first, then the panel), dispatch, the **team panel** (full page + settings section), the Agent Teams shared task board, `/steward`, and the gate scripts are aligned. The ZCode/MiniMax `PreToolUse` guard hooks are not ported yet (DSH tool guards are a different in-host mechanism). Browser acceptance follows a three-step ladder: repository Playwright → DSH sidebar driven by a human → manual fallback.

## More

- Repository and full docs (Chinese): <https://github.com/Wjl1224734792/steward>
- 中文：<https://github.com/Wjl1224734792/steward/blob/main/dsh/README.zh.md>
- Changelog: <https://github.com/Wjl1224734792/steward/blob/main/CHANGELOG.md>
- Roadmap: <https://github.com/Wjl1224734792/steward/blob/main/docs/ROADMAP.md>
- License: MIT
