# CI and GitHub (`.github/`)

Authoritative PR checks: `workflows/ci.yml`.

Ubuntu checks localization, styles, dev-slot tests, UI typecheck/unit tests, and Rust fmt/clippy/build/test. It builds both debug and release binaries and verifies both report the `development` channel. It also runs `vite build` and fails if committed `ui/dist` differs. CI uses Node 22 and pnpm 10; exact commands and ordering live in `workflows/ci.yml`.

`linux app` packages the desktop AppImage (`desktop` feature) on Ubuntu 22.04 for x86_64 and aarch64.

Windows runs clippy/build/test without Node (`ui/dist` is committed), plus release executable and desktop-installer uploads outside reusable release calls. UI changes must include a local `pnpm build`; CI does not commit a regenerated `ui/dist`.

## Rules that GitHub settings must keep

- Required checks: `fmt, clippy, test`, `version sanity`, and `linked issue`, including for administrators. `linked issue` is `workflows/linked-issue.yml` (`pull_request_target`; it must not check out PR code). Fork PRs must link an issue in this repository. Branches in this repository are exempt.
- No merge queue. Do not require branches to be up to date.
- `pull_request` CI must test the merge ref (`actions/checkout` default), not the PR head alone.

These are required policies, not proof of live GitHub settings. CI also runs on `main`; new commits on `main` do not automatically rerun every open PR's merge candidate.

Releases call this same CI workflow on the packaged commit. When regenerating cargo-dist release workflow, keep `./ci` in `global-artifacts-jobs`.

## Version sanity (`version-guard`)

A `Cargo.toml` version bump on a PR must move forward, must not reuse a released `v*` tag, and must come with a regenerated `Cargo.lock`. Merging a bump **cuts a release**. Leave the version alone for ordinary fixes and ports.

## Do not casually edit

`CODEOWNERS` lists release/signing paths (`workflows/`, macOS build/package scripts, `macos/`). Those reach the Developer ID certificate.

Telemetry contract: `workflows/telemetry-contract.yml`. Source builds must not enable production telemetry.
