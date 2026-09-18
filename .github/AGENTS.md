# CI and GitHub (`.github/`)

Authoritative PR checks: `workflows/ci.yml`.

On Ubuntu, in order: i18n → styles → `scripts/dev-slot.test.mjs` → pnpm install/paraglide → UI typecheck → UI unit tests → Rust fmt → clippy → `cargo build --locked` → assert source builds are `development` channel → `cargo test --locked`.

Windows job: clippy, build, test (no Node; `ui/dist` is committed).

## Rules that GitHub settings must keep

- Required checks: `fmt, clippy, test` and `version sanity`, including for administrators.
- No merge queue. Do not require branches to be up to date.
- `pull_request` CI must test the merge ref (`actions/checkout` default), not the PR head alone.

Releases call this same CI workflow on the packaged commit. When regenerating cargo-dist release workflow, keep `./ci` in `global-artifacts-jobs`.

## Version sanity (`version-guard`)

A `Cargo.toml` version bump on a PR must move forward, must not reuse a released `v*` tag, and must come with a regenerated `Cargo.lock`. Merging a bump **cuts a release**. Leave the version alone for ordinary fixes and ports.

## Do not casually edit

`CODEOWNERS` lists release/signing paths (`workflows/`, macOS build/package scripts, `macos/`). Those reach the Developer ID certificate.

Telemetry contract: `workflows/telemetry-contract.yml`. Source builds must not enable production telemetry.
