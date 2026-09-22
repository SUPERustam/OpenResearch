# Rust crate (`src/`)

Binary name `orx` (`src/main.rs`). Crate name `openresearch-cli`.

## Layout

| Module | Owns |
|--------|------|
| `commands/` | CLI subcommands and `orx up` HTTP. See [`commands/AGENTS.md`](commands/AGENTS.md). |
| `local/` | Local store, artifacts FS, harnesses, demo, playbook. See [`local/AGENTS.md`](local/AGENTS.md). |
| `jobs/` | Compute backends orx launches itself (SSH, Slurm, HF, Modal, K8s, Ray, Tinker, local). |
| `client.rs` | Hosted API client (orgs, instances, managed compute) and literature services (alphaXiv, arXiv, OpenAlex). |
| `store.rs` | SQLite + run-log paths. Data dir: `$ORX_DATA_DIR`, else settings, else XDG/`~/.local/share/openresearch`. |
| `telemetry.rs` | Opt-out analytics. Source builds must stay `development` channel and must not send production telemetry. |
| `compute.rs`, `plane/`, `remote.rs` | Remote/runtime wiring. |

Project/experiment/run rows always live in the local store. Keep hosted calls limited to service-owned capabilities; existing `local/` callers include `openresearch.rs` (managed boxes), `ssh_identity.rs` (registered SSH keys), and `starter.rs` (paper context).

## Build / test

```sh
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo build --locked
cargo test --locked
```

Do not bump `version` in `Cargo.toml` unless cutting a release. A bump on `main` is the release trigger; `Cargo.lock` must match. See [`.github/AGENTS.md`](../.github/AGENTS.md).

Adding a **read-only** CLI verb also requires updating the plan-mode allowlist in `local/harness/plan_gate.rs`.

## Artifacts vs logs vs code

- Artifacts API is project-scoped (`local/files.rs` + routes on `commands/up.rs`). There is **no** `/api/experiments/{id}/artifacts`. Do not add a registry unless the product asks for one; the UI slug matcher is intentional.
- Run logs are `<data dir>/run-logs/{runId}.log`, not the artifacts folder.
- Code browsing is git (`/api/projects/{id}/code-tree`, diffs), not the files tree.
