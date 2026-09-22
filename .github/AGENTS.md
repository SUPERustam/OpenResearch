# CI and GitHub (`.github/`)

Authoritative PR checks: `workflows/ci.yml`.

Ubuntu checks localization, styles, dev-slot tests, UI typecheck/unit tests, and Rust fmt/clippy/build/test. It builds both debug and release binaries and verifies both report the `development` channel. CI uses Node 22 and pnpm 10; exact commands and ordering live in `workflows/ci.yml`.

Windows runs clippy/build/test without Node (`ui/dist` is committed), plus a release executable upload outside reusable release calls. CI does not regenerate `ui/dist`; UI changes must include a local build.

## Rules that GitHub settings must keep

- Required checks: `fmt, clippy, test` and `version sanity`, including for administrators.
- No merge queue. Do not require branches to be up to date.
- `pull_request` CI must test the merge ref (`actions/checkout` default), not the PR head alone.

These are required policies, not proof of live GitHub settings. CI also runs on `main`; new commits on `main` do not automatically rerun every open PR's merge candidate.

Releases call this same CI workflow on the packaged commit. When regenerating cargo-dist release workflow, keep `./ci` in `global-artifacts-jobs`.

## Version sanity (`version-guard`)

A `Cargo.toml` version bump on a PR must move forward, must not reuse a released `v*` tag, and must come with a regenerated `Cargo.lock`. Merging a bump **cuts a release**. Leave the version alone for ordinary fixes and ports.

## Do not casually edit

`CODEOWNERS` lists release/signing paths (`workflows/`, macOS build/package scripts, `macos/`). Those reach the Developer ID certificate.

Telemetry contract: `workflows/telemetry-contract.yml`. Source builds must not enable production telemetry.
