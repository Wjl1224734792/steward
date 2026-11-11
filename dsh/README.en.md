# Steward — long-lived engineering team (DSH plugin)

Steward is a multi-role engineering team plugin for DeepSeek Harness. The lead agent acts as **Tech Lead**: it decomposes a request into a task DAG, dispatches each task to the right specialist subagent by dependency and file ownership, and ships only after the plan approval gate, QA, browser acceptance, and final review.

The goal is not to write the code once, but to keep the project **understandable, verifiable, reversible, and evolvable** after every change.

The plugin uses DSH-native extension points only: roles are **Agent Presets**, model routes are this plugin's **Config** served by the native **Settings** namespace `steward`, dispatch goes through `steward_dispatch` over `ctx.subagents`, `/steward` is a native human command, and skills register through `ctx.skills`.

## What you get after installation

| Capability | Shape |
|---|---|
| Seven roles | Agent Presets: `steward-pm`, `steward-architect`, `steward-backend-dev`, `steward-frontend-dev`, `steward-qa-engineer`, `steward-browser-tester`, `steward-reviewer` |
| Dispatch | `steward_dispatch(role, description, prompt, cwd?)`: one call per role, returns the child session id, and the result comes back automatically |
| Model & effort | `steward_config(action="list" / "set" / "reset")` or the native Settings → Steward page |
| Main skill | `steward`: the Tech Lead playbook (sizing / DAG / dispatch / gates / finishing) |
| Companion skills | `using-steward` (routing), `agent-settings` (model config), `systematic-debugging`, `tdd`, `verification-before-completion` |
| Command | `/steward`: echoes the roster, preset ids, and the routes currently in effect (it does not dispatch work) |
| Gate scripts | `scripts/`: `validate-plan.mjs`, `verify.mjs` (including `baseline record/check`), `run-state.mjs`, `maintain.mjs`, `take-over.mjs`, `validate-config.mjs`, plus the `doc/` documentation-pipeline tools |
| Settings page | Settings → Steward: pick provider / model / reasoning effort per role; saving applies to the next dispatch immediately |

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

3. **Change a subagent model**: open Settings → Steward, or just say "configure subagent models". Saving applies to the next `steward_dispatch` immediately, with no restart.

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
| Model / effort | "Configure subagent models" → `agent-settings` + Settings → Steward |
| Unsure which entry | Load `using-steward` to route |

## Roster

| Role | Preset | Responsibility |
|---|---|---|
| Requirements analyst | `steward-pm` | Vague request → testable spec |
| Architect | `steward-architect` | Spec → technical plan + task DAG |
| Backend dev | `steward-backend-dev` | TDD implementation within file ownership |
| Frontend dev | `steward-frontend-dev` | UI implementation + acceptance script |
| QA engineer | `steward-qa-engineer` | Test / lint / typecheck gate |
| Browser tester | `steward-browser-tester` | Black-box browser acceptance |
| Reviewer | `steward-reviewer` | Final diff review, three severity levels |

## Model route precedence

1. `modelRouting.<role>` in the project's `steward.config.json` (highest; applies to the next dispatch)
2. Settings → Steward / `steward_config set`
3. The defaults written by `steward_config set`
4. Inherit the parent agent

Before dispatching, the route is checked with `llm.resolveModelInfo`; an unknown model or an unsupported effort fails loudly (`MODEL_SELECTION_INVALID`) instead of degrading silently.

## How it works and its boundaries

- Tasks run in parallel only when they have no dependency and disjoint file ownership; everything else follows the DAG.
- S/M/L sizing: small changes skip the full team; M/L pass the plan approval gate (clean-context Plan Critic + user approval).
- Trusted-change gates: plan machine-check, independent test/lint/typecheck reruns, baseline guard, resumable run state, and a retry budget.
- Three quality gates: QA → browser acceptance (when UI) → review; defects are routed back by ownership, at most two rounds.
- Evidence over claims: no polishing, no fabrication; a failure is reported as a failure.
- DSH 0.2.0 scope: skills, roles (Agent Presets), model routing (native Settings), dispatch, `/steward`, and the gate scripts are aligned; the ZCode/MiniMax `PreToolUse` guard hooks are not ported yet (DSH tool guards are a different in-host mechanism). Browser acceptance follows a three-step ladder: repository Playwright → DSH sidebar driven by a human → manual fallback.

## More

- Repository and full docs (Chinese): <https://github.com/Wjl1224734792/steward>
- 中文：<https://github.com/Wjl1224734792/steward/blob/main/dsh/README.zh.md>
- Changelog: <https://github.com/Wjl1224734792/steward/blob/main/CHANGELOG.md>
- Roadmap: <https://github.com/Wjl1224734792/steward/blob/main/docs/ROADMAP.md>
- License: MIT
