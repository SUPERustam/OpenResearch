# Scripts (`scripts/`)

## `dev-slot.mjs` (required for local app work)

Isolates ports, `ORX_DATA_DIR`, and processes so two checkouts do not share a database.

```sh
scripts/dev-slot.mjs start --db empty --open     # clean slate
scripts/dev-slot.mjs start --db copy --open      # WAL-safe snapshot of the normal local DB + run logs
scripts/dev-slot.mjs status|stop|cleanup
```

Slots 1–9. `--db copy` is how you test against real experiments without mutating `~/.local/share/openresearch`. Tests: `dev-slot.test.mjs` (CI runs these).

Do not start a raw `orx up` against the default data dir while another dashboard is already bound to `:4791` unless that is the instance you mean to reuse.

## OpenCode

- `test-opencode-compat.py` / `test-opencode-compat-host.py` — harness protocol checks
- Install: `curl -fsSL https://opencode.ai/install | bash` → `~/.opencode/bin/opencode`

## Packaging (touch carefully)

`build-macos-app.sh` and `package-macos-app.sh` are code-owned (see `.github/CODEOWNERS`). They handle Developer ID signing. Do not casually edit them in a product PR.
