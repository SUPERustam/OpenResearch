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
- `/api/*` — local SQLite + run logs + artifacts
- `/api/events` — SSE

Artifact routes (project-scoped, filesystem is source of truth):

- `GET/PATCH/DELETE /api/projects/{id}/files`
- `GET /api/projects/{id}/files/file?path=`

Harness picker / first-run install: `up/harness_setup.rs` plus `GET /api/harnesses?refresh=1`. When no coding agent is installed, auto-install OpenCode rather than leaving onboarding stuck.

`up.rs` is large. Prefer adding handlers next to the existing route table and keeping filesystem serving in `file_serve.rs` / `local/files.rs`.

## Live dashboard flags agents actually use

```sh
./target/debug/orx --no-telemetry up --no-browser --no-agent --port 4791
```

Set `ORX_DATA_DIR` (and prefer `scripts/dev-slot.mjs`) so you do not clobber the user’s real store. Seed projects with `POST /api/projects` plus `orx experiment` / the dashboard; write files under `$ORX_DATA_DIR/files/<project-slug>/`.
