# CLI commands (`src/commands/`)

Every command module follows `commands/mod.rs`:

```rust
pub async fn run(args: crate::<Args>) -> crate::error::Result<()>
```

- Args are the clap `Args` type from `main.rs`, moved in by value.
- Local research commands read the local store. Account / org / sandbox / managed-compute commands call `crate::error::require_credentials().await` themselves.
- Return `Ok(())`; `main` prints errors. Do not talk to `openresearch.sh` from local-only paths.

## `orx up` (`up.rs`)

One axum process on loopback:

- `/` — embedded SPA (`ui/dist`)
- `/api/*` — local research data and dashboard integrations/settings (including hosted capabilities where applicable)
- `/api/events` — SSE

Artifact routes (project-scoped, filesystem is source of truth):

- `GET/PATCH/DELETE /api/projects/{id}/files`
- `GET /api/projects/{id}/files/file?path=`

Harness picker / first-run install: `up/harness_setup.rs` plus `GET /api/harnesses?refresh=1`. When no coding agent is installed, auto-install OpenCode rather than leaving onboarding stuck.

`up.rs` is large. Prefer adding handlers next to the existing route table and keeping filesystem serving in `file_serve.rs` / `local/files.rs`.

## Live dashboard flags agents actually use

```sh
ORX_DATA_DIR=/absolute/path/to/disposable-data ./target/debug/orx --no-telemetry up --no-browser --no-agent --port 4791
```

Prefer `scripts/dev-slot.mjs` for local work; the direct command above shows the flags and requires replacing the placeholder with a disposable directory. `ORX_DATA_DIR` alone does not isolate config/cache. Seed projects with `POST /api/projects`, then add nodes with `orx create-experiment` or the dashboard; `orx exp` operates on existing nodes. Write files under `<data dir>/files/<project-slug>/`.
