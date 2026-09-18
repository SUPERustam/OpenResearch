# Repository Guide

## What this repository is

`openresearch-cli` is the open-source Rust implementation of the `orx` command-line tool. It owns the local CLI, dashboard and API, SQLite store, coding-agent integrations, experiment orchestration, and execution backends.

This GitHub repo (`SUPERustam/OpenResearch`) is a fork of [`alphaXiv/OpenResearch`](https://github.com/alphaXiv/OpenResearch). Treat it as a **drop-in replacement for OpenResearch**: port and stay compatible with upstream behavior; do not invent fork-only product surfaces unless asked. Package version stays put unless someone is cutting a release.

`openresearch.sh` is the companion service. It owns the website and documentation, accounts and organizations, sandbox provisioning, and managed-compute catalogs. Research projects, experiments, runs, logs, and artifacts remain local to `orx`.

When changing authentication, organization, sandbox, or managed-compute APIs, inspect the corresponding `openresearch.sh` implementation and keep both sides compatible. Do not edit the companion repository unless it is explicitly in scope.

## Nested agent guides

Read the guide for the tree you are editing. They add folder-specific rules; they do not replace this file.

| Path | When to read |
|------|----------------|
| [`ui/AGENTS.md`](ui/AGENTS.md) | Dashboard build, i18n, styles, tests, committed `ui/dist` |
| [`ui/src/AGENTS.md`](ui/src/AGENTS.md) | React dashboard, experiment Artifacts menus, tabs |
| [`src/AGENTS.md`](src/AGENTS.md) | Rust crate layout, local vs hosted API |
| [`src/commands/AGENTS.md`](src/commands/AGENTS.md) | CLI subcommands and `orx up` HTTP |
| [`src/local/AGENTS.md`](src/local/AGENTS.md) | SQLite store, artifacts FS, demo seed, playbook |
| [`src/local/harness/AGENTS.md`](src/local/harness/AGENTS.md) | Claude / Codex / OpenCode / Cursor adapters |
| [`scripts/AGENTS.md`](scripts/AGENTS.md) | Isolated `dev-slot` and OpenCode compat helpers |
| [`agent-skills/AGENTS.md`](agent-skills/AGENTS.md) | Bundled research-agent skills and artifact layout |
| [`demo/AGENTS.md`](demo/AGENTS.md) | Embedded nanochat demo project |
| [`.github/AGENTS.md`](.github/AGENTS.md) | CI and release gates |

## Development guidelines

- Rust code lives in `src/`; the dashboard lives in `ui/src/`. Keep local-only behavior local and use the production API client only for capabilities owned by `openresearch.sh`.
- Run local app instances through `scripts/dev-slot.mjs` so development data, ports, and processes stay isolated. Production-like: `orx up` (dashboard `http://127.0.0.1:4791`).
- `ui/dist` is committed and embedded in release builds. After UI changes, run `pnpm build` in `ui/` and include the regenerated assets.
- Prefer canonical Tailwind utilities (`flex flex-col h-full min-h-0`) and project theme aliases (`bg-background`, `text-subtext`, `border-border`). Use arbitrary values only when no project utility exists, and preserve semantic marker classes when selectors or runtime behavior depend on them.
- New UI copy must land in **every** locale under `ui/messages/` (`en`, `zh-CN`, `fa`, `ar`, `es`, `hi`). The locale set drifts versus upstream; when porting, match **this** repo’s `ui/project.inlang/settings.json`, do not copy extra catalogs.
- Before shipping, follow the checks in `.github/workflows/ci.yml`.
- Do not bump `Cargo.toml` version for ports or product fixes unless releasing.
- Keep unrelated files (for example `.claude/launch.json`) off feature PRs.

## Product conventions (do not regress)

**Logs, Code, and Artifacts are three different things.** Logs are per-run files. Code is a git branch / worktree browser. Artifacts are the project files tree (`<data dir>/files/<project slug>/`). There is no experiment↔file registry; the dashboard matches by slug heuristic.

Per-experiment **Artifacts** belongs next to Logs and Code on the tree card, hover card, experiment overview, and table row. The control is a **portal file list** (`ExperimentArtifactsMenu`) that opens a file through `openArtifactFileTab`. It must not navigate to the global sidebar Artifacts tab. Always show the button; no unique match shows **No matching artifacts** — never dump the whole project tree.

OpenCode installs are **V2**. Detection, DB inspect/migrate, and first-run install live under `src/local/harness/` and `src/commands/up/harness_setup.rs`. A V1-only adapter cannot drive a current `opencode` binary.

## Working rules for agents

- Informal “PR 2” may not be GitHub `#2`. Resolve numbers against titles and branches before editing.
- One overlapping feature → one branch/PR. Close duplicates only after the surviving PR exists.
- Preserve human commits on a shared branch (`git pull` / fast-forward). Do not rewrite them away.
- Ask when product association is ambiguous. Implement the attached plan; do not edit plan files; do not start a second plan when the user said to build.
- Do not invent IdP credentials. Hosted `orx login` and `opencode.ai/auth` need a real Google/GitHub session. Local OpenCode **free models** (for example `opencode/big-pickle`) still work without Zen OAuth. OpenCode signed in ≠ OpenResearch compute signed in.
- UI changes that a user can click must be click-tested in the browser when a dashboard can be started. Re-check every surface that shares the control (tree, hover, overview, table). If click-test is impossible, say so.
- Screenshot surface matters: overview is `ExperimentOverview`, not the tree card.

## Local verify

```sh
# Isolated slot (preferred while developing)
scripts/dev-slot.mjs start --db empty --open    # or --db copy for a WAL-safe snapshot of the real DB

# Production-like dashboard
./target/debug/orx --no-telemetry up --no-browser --port 4791
```

Useful fixtures: bundled **nanochat** demo (`demo/`, seeded by `src/local/demo.rs`), or a lab project with **Transformer Sweep** (`transformer-sweep/…`) and **Empty Probe** (`empty-probe`). Sweep should list `figures/loss.pdf`, `figures/patch-size.jpg`, `metrics.csv`, `report.md`; Empty Probe must show **No matching artifacts**. Opening `metrics.csv` must open a file tab, not the experiment overview.

OpenCode binary is often `~/.opencode/bin/opencode` (`curl -fsSL https://opencode.ai/install | bash`). Probe harness state with `GET /api/harnesses?refresh=1`.

## CI and release gates

- GitHub protection for `main` must require the `fmt, clippy, test` and `version sanity` checks from GitHub Actions, including for administrators. Do not require a merge queue or require branches to be up to date. These settings are managed in GitHub, not by this file.
- PR CI must test GitHub's simulated merge (`refs/pull/<number>/merge`), which `actions/checkout` selects by default for `pull_request` events, rather than checking out the PR head alone. Each run tests its merge candidate; subsequent changes to `main` do not automatically rerun open PRs.
- CI also runs on `main`. Releases call the same CI workflow on the commit being packaged; publishing requires that run to succeed. Keep `./ci` in cargo-dist's `global-artifacts-jobs` when regenerating the release workflow.

Minimum checks before a UI PR:

```sh
node ui/scripts/check-i18n.mjs
node ui/scripts/check-styles.mjs
pnpm typecheck          # in ui/
node --test --experimental-strip-types ui/tests/*.test.mjs
pnpm build              # in ui/; commit ui/dist
```

Rust / harness changes also need `cargo fmt --all --check`, `cargo clippy --all-targets -- -D warnings`, and `cargo test --locked`.
