# Repository Guide

## What this repository is

`openresearch-cli` is the open-source Rust implementation of the `orx` command-line tool. It owns the local CLI, dashboard and API, SQLite store, coding-agent integrations, experiment orchestration, and execution backends.

This GitHub repo (`SUPERustam/OpenResearch`) is a fork of [`alphaXiv/OpenResearch`](https://github.com/alphaXiv/OpenResearch). Treat it as a **drop-in replacement for OpenResearch**: port and stay compatible with upstream behavior; do not invent fork-only product surfaces unless asked. Package version stays put unless someone is cutting a release.

Self-update does **not** follow upstream. `orx update`, background auto-update, the macOS app manifest, remote installs, and cargo-dist releases all come from this fork (`REPO_URL` in `src/updates.rs`, `repository` in `Cargo.toml`). `build.rs` may also accept an alphaXiv Actions run for the production channel; that does not change the download URL. Literature search still uses alphaXiv.

`openresearch.sh` is the companion service. It owns the website and documentation, accounts and organizations, sandbox provisioning, and managed-compute catalogs. Research projects, experiments, runs, logs, and artifacts remain local to `orx`.

When changing authentication, organization, sandbox, or managed-compute APIs, inspect the corresponding `openresearch.sh` implementation and keep both sides compatible. Do not edit the companion repository unless it is explicitly in scope.

## Nested agent guides

Read this guide and each nested guide along the path you are editing. Paths below are repository-relative. Keep shared rules here and implementation details in the narrowest applicable guide.

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

- Rust code lives in `src/`; the dashboard lives in `ui/src/`. Keep research state local; hosted account/compute and literature integrations belong behind their existing clients.
- Run local app instances through `scripts/dev-slot.mjs` with `--db empty` or `--db copy`; see its guide for isolation limits. Normal `orx up` serves the dashboard at `http://127.0.0.1:4791`.
- `ui/dist` is committed and embedded in the binary. Dashboard source/catalog/build changes require `pnpm build` in `ui/` and regenerated assets; documentation-only changes do not.
- Follow `ui/AGENTS.md` for theme utilities and localization. New UI copy must cover every locale in `ui/project.inlang/settings.json`; do not import upstream-only catalogs.
- Before shipping, follow the checks in `.github/workflows/ci.yml`.
- Keep unrelated files (for example `.claude/launch.json`) off feature PRs.

## Product conventions (do not regress)

**Logs, Code, and Artifacts are three different things.** Logs are per-run files. Code is a git branch / worktree browser. Artifacts are the project files tree (`<data dir>/files/<project slug>/`). There is no experiment↔file registry; the dashboard matches by slug heuristic.

Per-experiment **Artifacts** belongs next to Logs and Code on the tree card, hover card, experiment overview, and table row. The control is a **portal file list** (`ExperimentArtifactsMenu`) that opens a file through `openArtifactFileTab`. It must not navigate to the global sidebar Artifacts tab. Always show the button; no unique match shows **No matching artifacts** — never dump the whole project tree.

Preserve OpenCode **V1/V2** protocol detection, DB migration safeguards, and first-run installation. See `src/local/harness/AGENTS.md` before changing them.

## Working rules for agents

- One overlapping feature → one branch/PR. Close duplicates only after the surviving PR exists.
- Preserve human commits and unrelated working-tree changes. Use fast-forward updates on shared branches when possible; do not rewrite others' work.
- Ask when product association is ambiguous. Implement the attached plan; do not edit plan files; do not start a second plan when the user said to build.
- Do not invent IdP credentials or tokens. Harness authentication and OpenResearch org/compute authentication are separate; see `src/local/harness/AGENTS.md` for smoke-test options.
- UI changes that a user can click must be click-tested in the browser when a dashboard can be started. Re-check every surface that shares the control (tree, hover, overview, table). If click-test is impossible, say so.
- Screenshot surface matters: overview is `ExperimentOverview`, not the tree card.

## Local verify

```sh
# Isolated slot (preferred while developing)
scripts/dev-slot.mjs start --db empty --open    # or --db copy for a WAL-safe snapshot of the real DB

# Slot status (ports and logs)
scripts/dev-slot.mjs status
```

Useful fixtures: create the bundled **nanochat** demo through onboarding (`demo/`, seeded by `src/local/demo.rs`), or create a disposable lab project with **Transformer Sweep** (slug `transformer-sweep`) and **Empty Probe** (slug `empty-probe`). Put `figures/loss.pdf`, `figures/patch-size.jpg`, `metrics.csv`, and `report.md` under the lab project's `files/<project slug>/transformer-sweep/` directory. Leave Empty Probe unmatched. Sweep must list those files; Empty Probe must show **No matching artifacts**. Opening `metrics.csv` must open a file tab, not the experiment overview. The lab fixture is not bundled.

Probe harness state with `GET /api/harnesses?refresh=1` on the slot's backend.

## CI and release gates

`.github/workflows/ci.yml` defines CI; `.github/AGENTS.md` records required branch-protection and release behavior. A package version bump on `main` triggers a release, so leave the version unchanged for ordinary fixes and ports.

Minimum checks before a UI PR:

```sh
node ui/scripts/check-i18n.mjs
node ui/scripts/check-styles.mjs
(cd ui && pnpm install --frozen-lockfile && pnpm exec paraglide-js compile --silent --emit-ts-declarations && pnpm typecheck)
node --test --experimental-strip-types ui/tests/*.test.mjs
(cd ui && pnpm build)   # commit regenerated ui/dist
```

Rust / harness changes also need `cargo fmt --all --check`, `cargo clippy --all-targets -- -D warnings`, `cargo build --locked`, and `cargo test --locked`. Script changes need their relevant tests, including `node --test scripts/dev-slot.test.mjs` for dev-slot changes. For guide-only edits, validate referenced paths, commands, and claims against the source; application builds and browser tests are unnecessary.
