# Scripts (`scripts/`)

## `dev-slot.mjs` (required for local app work)

On macOS/Linux, `empty` and `copy` modes isolate ports, data, config, cache, and processes. Run from the repository root.

```sh
scripts/dev-slot.mjs start --db empty --open     # clean slate
scripts/dev-slot.mjs start --db copy --open      # WAL-safe snapshot of the normal local DB + run logs
scripts/dev-slot.mjs status
scripts/dev-slot.mjs stop
# Removes the stopped slot's managed data and configuration:
scripts/dev-slot.mjs cleanup
```

Slots 1–9. `--db copy` snapshots the normal database and run logs; it does not copy artifact files or repositories. Repository/worktree paths in copied rows can still point to real checkouts. `--db live` uses the normal data/config/cache in place and is not isolated. Use `empty` for disposable fixtures. Tests: `node --test scripts/dev-slot.test.mjs` (CI runs these).

Do not start a raw `orx up` against the default data dir while another dashboard is already bound to `:4791` unless that is the instance you mean to reuse.

## OpenCode

- `test-opencode-compat.py` / `test-opencode-compat-host.py` — harness protocol checks
- Install: `curl -fsSL https://opencode.ai/install | bash` → `~/.opencode/bin/opencode`

## Packaging (touch carefully)

`build-macos-app.sh` and `package-macos-app.sh` are code-owned (see `.github/CODEOWNERS`). They handle Developer ID signing. Do not casually edit them in a product PR.
