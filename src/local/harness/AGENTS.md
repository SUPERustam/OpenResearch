# Coding-agent harnesses (`src/local/harness/`)

One `Harness` trait; add a harness with one `impl` and one `registry()` line (`mod.rs`). Capabilities are optional: detect, `run_turn`, skill install.

## OpenCode protocol compatibility

The repository supports **V1 and V2** binaries. Detect the installed protocol; a V1-only adapter cannot drive a V2 binary.

- `opencode.rs` — detect, host, V1 path
- `opencode_v2.rs` — V2 turn / event adapter
- Sibling runtime/DB: `../opencode_runtime.rs`, `../opencode_db.rs`
- First-run install / Settings terminals: `../../commands/up/harness_setup.rs`

Rules that already bit this fork:

- Detect **binary** and **DB** independently. Preserve backup and validation before migration, and gate turns on compatible DB state. Do not let V1 open an upgraded DB.
- Auto-install OpenCode when no harness is present (upstream OpenResearch #348 / #350). Port behavior; do not bump crate version for the port.
- When porting UI strings, use the complete locale set in `ui/project.inlang/settings.json` (see `ui/AGENTS.md`).

Compat scripts: `scripts/test-opencode-compat.py`, `scripts/test-opencode-compat-host.py`.

## Auth vs “signed in”

- Harness `authenticated` / `agentReady` from `GET /api/harnesses?refresh=1` is OpenCode (or Claude/Codex/Cursor) state.
- `orx login` authenticates openresearch.sh org/compute. OAuth needs a real user session; do not invent tokens or infer compute access from harness readiness.
- For chat/dashboard smoke tests without Zen OAuth, use a free model available in the detected catalog. Do not assume a specific model remains available.

## Other harnesses

Claude, Codex, and Cursor each have a file here. Plan-mode read-only allowlist: `plan_gate.rs` (keep in sync with new read-only CLI verbs).
