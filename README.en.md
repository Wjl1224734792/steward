# Steward — long-lived engineering team

> More than shipping features: keep the project understandable, verifiable, reversible, and evolvable after every change.

[简体中文](README.md) | English

Steward is a role-based engineering team plugin for ZCode, MiniMax and DeepSeek Harness (DSH). The lead agent acts as **Tech Lead**, decomposes work into a task DAG with file ownership, and dispatches specialist subagents.

## What is Steward

The current release (ZCode 0.11.0 / MiniMax 0.11.0 / DSH 0.2.0) covers feature delivery with two execution modes (subagent / inline), bug fixing (B0-B3 triage), plan-only mode, the maintenance loop, takeover (T1 generation + first health scan), and the evolution loop; both legacy hosts share the full docTier=3 documentation pipeline (seven-phase docs tree + full PRD/FRD/contract/page/test/deployment templates + naming guard and doc checks) plus a first-principles clarification step with a 3-question P0 budget for M/L requests, plus a using-steward router skill on both hosts, with optional MiniMax GenUI views for the task DAG, defect triage, and maintenance health. Since DSH 0.2.0 the DSH side is implemented entirely with DSH-native mechanisms: seven role **Agent Presets** (persona + native tool compositions), model routes in the native Settings namespace `steward`, `steward_dispatch` over `ctx.subagents`, a native `/steward` command, and skills through `ctx.skills`.

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
| Skill routing | load `steward:using-steward` | Available in 0.8.1+ on both hosts (route to the right mode when unsure which entry point/skill to use) |
| Subagent model config | load `steward:agent-settings` | Available in 0.9.0 on MiniMax (visual config page / CLI; ZCode keeps the host default model); DSH 0.2.0 ships a native Settings → Steward page plus the `steward_config` tool |
| DSH native mechanisms | registered with the plugin | DSH 0.2.0+: 7 roles are Agent Presets (`steward-<role>`), model routes live in the native `steward` settings namespace, `steward_dispatch` delegates over `ctx.subagents`, `/steward` is a native command, skills register through `ctx.skills` |

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

> On DSH the roles are Agent Presets (`steward-pm` … `steward-reviewer`): call `steward_dispatch(role=...)` with the role only, never hand-write a model.

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
- **Skill router (v0.8.1, ZCode side)**: load `steward:using-steward` when the user is unsure which entry point or skill to use; it only routes, never replaces the main skill.
- **Subagent model and thinking-effort configuration (v0.9.0, MiniMax side)**: change the model and effort of the 7 subagents from a visual page (an in-app Mini App, or the equivalent local page started by `agent-config.mjs serve`). The effort dropdown lists only the levels the selected model really supports (read live from the local model catalog, never hardcoded), and every write follows validate → back up → write → re-validate → roll back on failure. Project-level `steward.config.json` takes effect on the next dispatch; plugin defaults take effect in a **new session** after build + install. This also fixes the existing defect where agent frontmatter declared `model` but not `effort`, so a directly invoked subagent ran on the runtime default (observed: low) instead of the roster's high.
- **DSH native mechanisms (DSH 0.2.0)**: instead of porting the ZCode role/config mechanisms, the DSH side is rebuilt on DSH's own extension points. (1) The seven roles are **Agent Presets** (`steward-pm` … `steward-reviewer`), each composing `dsh-persona` with native tool plugins (fs / fs-search / pwsh|bash / web / skill / todo / compaction …); a dispatched child gets its system prompt and tool set from the preset, and `steward_dispatch` only carries the task text. (2) Model and reasoning-effort routes are this plugin's **Config** (`.volatile()` fields), served by the native Settings service as namespace `steward` and persisted through the profile's config editor; saving updates in place, with no restart. (3) The settings page renders over `ctx.configForms` + `remote.session.modelCatalog()` — no private HTTP bridge and no `~/.dsh/steward/subagent-config.json`. (4) `/steward` registers on the native human-command registry. (5) Skills still register through `ctx.skills`. Project-level `steward.config.json` `modelRouting` still outranks the settings page, and dispatch preflights the route with `llm.resolveModelInfo`. The DSH-only builder `node host/dsh/build.mjs` reads `shared/` and `zcode/scripts/`, writes only `dsh/`, and rewrites host-specific prose in the generated `roles/*.md` (host MCP / `context7`) into DSH-native retrieval guidance.
- **Project memory (v0.5)**: `take-over.mjs` drafts AGENTS.md + the seven `docs/project/` files (T0/T1) for a target project.
- **Artifact handoff**: `tmp/steward/<run-id>/`; no long prose in prompts.
- **Three quality gates**: QA → browser acceptance (when UI) → review; defects are routed back, at most two rounds.
- **Evidence over claims**: real output only; no polishing, no fabrication.

## Repository layout

```text
steward/
├── shared/                     # Single source: shared skill / agent bodies (with @@SLOT@@ markers)
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

> Maintainer note: ZCode / MiniMax bodies are edited in `shared/` (common) or `host/<host>/` (host deltas) and generated with `node zcode/scripts/build.mjs`; the DSH side also consumes `shared/` but is generated by its own builder, `node host/dsh/build.mjs`, which only reads `shared/` and only writes `dsh/`. Neither builder writes the other host's package; both `--check` modes catch hand edits and drift. Installed plugin copies do not need and should not run a builder.
>
> **Host isolation**: ZCode-side work touches only `zcode/` + `host/zcode/`; MiniMax-side work touches only `minimax/` + `host/minimax/`; DSH-side work touches only `dsh/` + `host/dsh/`. `shared/` is the ZCode/MiniMax shared source, consumed read-only by DSH; `zcode/scripts/` is likewise read-only for DSH. Install/update separately: `zcode plugins update` for ZCode, `agent-config.mjs install --apply` for MiniMax, `plugin_manager install_bundle` targeting `dsh/` for DSH. See `AGENTS.md`.

## Installation

### ZCode

1. Clone the repository (for example into `steward/`).
2. Create `marketplace.json` next to the repository; point `source` at your cloned `zcode/` directory:

```json
{
  "name": "my-local-plugins",
  "plugins": [
    {
      "name": "steward",
      "source": "./steward/zcode",
      "version": "0.11.0",
      "displayName": "Steward — long-lived engineering team",
      "category": "developer-tools"
    }
  ]
}
```

3. ZCode → Plugin Marketplace → Add Marketplace, and paste the directory containing `marketplace.json`.
4. Install **Steward**.
5. Start a new task with `/steward <request>`.

### MiniMax

Copy `minimax/` into `%USERPROFILE%\.minimax\plugins\steward\`:

```powershell
Copy-Item -LiteralPath "<repo>\minimax\*" -Destination "$env:USERPROFILE\.minimax\plugins\steward\" -Recurse -Force
```

When the input contains "开发团队", "开发小组", or "Steward", the `UserPromptSubmit` hook loads the skill automatically.

### DSH (DeepSeek Harness)

`dsh/` is a standard DSH bundle (Host + Client + skills/roles + gate scripts). Rebuild it with `node host/dsh/build.mjs` (writes only `dsh/`), then install the local bundle directory from DSH:

```text
plugin_manager(action="install_bundle", target="<repo>/dsh")
```

After installation a session sees six skills (`steward`, `using-steward`, `agent-settings`, `systematic-debugging`, `tdd`, `verification-before-completion`) through `ctx.skills`, seven Agent Presets (`steward-pm` … `steward-reviewer`) through `ctx.agentPresets`, two tools (`steward_config`, `steward_dispatch`), a `/steward` command, and a native **Settings → Steward** section over the `steward` settings namespace. The plugin page also shows this bundle's introduction and usage (`dsh/README.zh.md` in Chinese, `dsh/README.en.md` in English). Model routes persist through the native settings service into your profile's `cordis.patch.yml` (`- id: steward` config override); the plugin never hand-edits that file. Host code loads on DSH restart or a plugin-manager disable/enable; the settings page follows a browser refresh.

> DSH 0.2.0 boundaries: skills, roles (Agent Presets), model routing (native Settings), dispatch, the `/steward` command and the gate scripts are aligned; the ZCode/MiniMax `PreToolUse` guard hooks are not ported yet (DSH tool guards are a different in-Host mechanism). The browser tester uses a three-step ladder — repository Playwright → DSH sidebar driven by a human → manual fallback — instead of the ZCode-only Tabbit skill.

### Configure subagent models and thinking effort (v0.9.0 / DSH 0.2.0)

Start a new session and say "configure subagent models" or "switch QA to another model with a higher thinking effort": the main agent loads `agent-settings`, reads the live model catalog and shows each role's current model, effort and where it comes from.

- **Visual page (MiniMax)**: open the Steward subagent model configuration page in the MiniMax app panel (Mini App). If the host has not accepted the Mini App yet, use the equivalent local page: run `node zcode/scripts/agent-config.mjs serve` in the source repo and open `http://127.0.0.1:7317` (the port is printed if it had to change).
- **Visual page (DSH)**: Settings → Steward over `ctx.configForms`. Pick provider / model / reasoning effort per role; the effort dropdown lists exactly what `remote.session.modelCatalog()` reports for that model. "Refresh catalog" re-reads it; saving writes through the native settings service and applies to the next dispatch immediately.
- **CLI (MiniMax)**: `node zcode/scripts/agent-config.mjs set --role qa-engineer --model custom_provider:provider-f9b585/glm-5.3-flash --effort medium --scope both` (`--scope` is project / plugin / both).
- **Read only (MiniMax)**: `node zcode/scripts/agent-config.mjs show`.
- **DSH tool**: `steward_config(action="set", role="qa-engineer", provider="ctaigw", model="glm-5.3", effort="high")`; omit `role` to edit the defaults, use `action="reset"` to clear. Writes use the same native settings path (no private JSON file).
- After changing MiniMax plugin defaults run `node zcode/scripts/agent-config.mjs install --apply` in the source repo (build + mirror-install); changes apply in a **new session**.

## Usage

```text
/steward Write a money-summary script in tmp/demo, with unit tests and a green run.
```

> On DSH, state the request in natural language ("Use Steward to build <request>"); the native `/steward` command only echoes the roster, preset ids and current routes — it does not dispatch work.

## Roadmap

- [docs/ROADMAP.md](docs/ROADMAP.md) · Delivery status: [docs/ROADMAP-STATUS.md](docs/ROADMAP-STATUS.md)
- Shipped in v0.5: bug track (B0–B3), plan approval gate + Plan Critic, plan validation / independent verification / baseline guard, resumable run state, T0/T1 project memory generation.
- Shipped in v0.6: maintenance loop (eight-category scan), browser evidence contract, learning loop (05-record backfill), systematic-debugging / TDD / verification skills, optional worktree + finishing, model routing + retry budget.
- Shipped in v0.7: takeover (T1 generation + first health scan), evolution loop (refactor-ratio check, codemod planning), six on-demand T3 templates, local dual-host build (build.mjs single source + validation), optional host guards (ownership / dangerous commands / secrets), GenUI maintenance health dashboard (dedicated recipe C), monorepo / multi-service guidance.
- Shipped in v0.8: full documentation pipeline — seven-phase `docs/01..07` tree, 19 template types + T2 requirement/evidence/record templates, AGENTS/rules constraint layer, naming guard and doc checks as local scripts (`scripts/doc/`); first-principles clarification kernel (four questions + a max-3 P0 question budget, S-level skips); worktree multi-branch merge drill 6/6 PASS; taskboard two non-blocking leftovers cleaned up (filter race + Cache-Control), fixture 22/22. The docs pipeline and clarification kernel are synced to both hosts by build.mjs since MiniMax 1.6.0.
- Shipped in v0.8.1: `steward:using-steward` router — when unsure which entry point/skill to use, route to feature delivery / bug / plan-only / maintenance / takeover / docs, and point to debugging / TDD / verification before completion; the MiniMax side is synced since 1.6.2 (routing table adapts per host: ZCode slash commands / MiniMax natural language).
- Shipped in DSH 0.2.0: the DSH side is rebuilt on native mechanisms — seven Agent Presets (`ctx.agentPresets`, persona + native tool compositions), model routes as this plugin's Config served by the native Settings namespace `steward` (volatile fields, persisted through the profile config editor), a settings page over `ctx.configForms` + `remote.session.modelCatalog()` (the private HTTP bridge and `~/.dsh/steward/subagent-config.json` are gone), preset-based dispatch over `ctx.subagents`, a native `/steward` command, and skills through `ctx.skills`. The independent builder `node host/dsh/build.mjs` reads `shared/` and writes only `dsh/`, and rewrites ZCode/MiniMax-only MCP prose in generated role bodies into DSH-native retrieval guidance. `node --test host/dsh/tests/` covers eight cases: preset registration, Config, native settings persistence, preset dispatch, project routing, and the command.
- Next: MiniMax-host GenUI verification and DSH settings-page browser rendering/interaction verification (the Client Slots check confirmed the page occupant is active, but no visual capture was taken).

## Renamed from dev-team

Steward is the renamed version of the `dev-team` plugin. The plugin ID, command, agent prefix, and skill namespace are now `steward`; uninstall the old version before installing the new one.

## License

MIT
