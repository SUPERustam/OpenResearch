# CI and GitHub (`.github/`)

Authoritative PR checks: `workflows/ci.yml`.

`Select checks` reads the diff and turns jobs on. A workflow, action, or `scripts/ci-*` change runs every job. Docs-only changes do not. Exact commands live in `workflows/ci.yml`.

`Frontend` checks localization and style tokens, installs UI dependencies with Node 22 and pnpm 10, runs `vite build`, typecheck, and `ui/tests/*.test.mjs`. It does not rewrite committed `ui/dist`. UI changes still need a local `pnpm build` in the PR.

`Helper tests` runs the dev-slot, chart, embedded JavaScript, and release-notes suites that the diff selects.

`Rust` runs the SSH helper protocol tests, fmt (including `windows/launcher`), clippy, and `cargo test --locked`. Pull requests skip the two long supervisor tests named in the workflow. A debug build must report the `development` channel. The release build and its channel check run only when CI is called for a release.

`linux app` lints and builds `--features desktop` on Ubuntu 22.04 (x86_64 and aarch64). It does not package the AppImage; that stays in `release-linux-app.yml`.

`windows` lints the crate and `windows/launcher`, then runs `cargo test --locked`. Pull requests split lint and test. Desktop installers are attached by the release app workflows, not by this job.

The `fmt, clippy, test` job only checks that every selected job passed.

## Rules that GitHub settings must keep

- Required checks: `fmt, clippy, test`, `version sanity`, and `linked issue`, including for administrators. `linked issue` is `workflows/linked-issue.yml` (`pull_request_target`; it must not check out PR code). Fork PRs must link an issue in this repository. Branches in this repository are exempt.
- No merge queue. Do not require branches to be up to date.
- `pull_request` CI must test the merge ref. Jobs check out `github.sha`, which for `pull_request` is that merge commit, not the PR head alone. Release calls pass `source-sha` instead.

These are required policies, not proof of live GitHub settings. CI also runs on `main`; new commits on `main` do not automatically rerun every open PR's merge candidate.

Releases call this same CI workflow on the packaged commit. When regenerating cargo-dist release workflow, keep `./ci` in `global-artifacts-jobs`.

## Version sanity (`version-guard`)

A `Cargo.toml` version bump on a PR must move forward, must not reuse a released `v*` tag, and must come with a regenerated `Cargo.lock`. Merging a bump **cuts a release**. Leave the version alone for ordinary fixes and ports.

## Do not casually edit

`CODEOWNERS` lists release/signing paths (`workflows/`, macOS build/package scripts, `macos/`). Those reach the Developer ID certificate.

Telemetry contract: `workflows/telemetry-contract.yml`. Source builds must not enable production telemetry.
