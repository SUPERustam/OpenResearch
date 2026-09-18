# Coding-agent harnesses (`src/local/harness/`)

One `Harness` trait; add a harness with one `impl` and one `registry()` line (`mod.rs`). Capabilities are optional: detect, `run_turn`, skill install.

## OpenCode is V2

Current `opencode.ai/install` ships **OpenCode V2**. A V1-only adapter cannot drive `orx up` chat.

- `opencode.rs` — detect, host, V1 path
- `opencode_v2.rs` — V2 turn / event adapter
- Sibling runtime/DB: `../opencode_runtime.rs`, `../opencode_db.rs`
- First-run install / Settings terminals: `../../commands/up/harness_setup.rs`

Rules that already bit this fork:

- Detect **binary** and **DB** independently. Back up / migrate before opening a V2 DB. Do not let V1 open an upgraded DB.
- Auto-install OpenCode when no harness is present (upstream OpenResearch #348 / #350). Port behavior; do not bump crate version for the port.
- When porting UI strings, match this fork’s locale set. Do not copy Arabic (or any extra locale) unless `ui/project.inlang/settings.json` already has it.

Compat scripts: `scripts/test-opencode-compat.py`, `scripts/test-opencode-compat-host.py`.

## Auth vs “signed in”

- Harness `authenticated` / `agentReady` from `GET /api/harnesses?refresh=1` is OpenCode (or Claude/Codex/Cursor) state.
- `orx login` is openresearch.sh org/compute. Cloud VMs usually cannot finish Google/GitHub OAuth. Do not invent tokens.
- OpenCode **free models** (`opencode/big-pickle` and Settings “Free models · No sign-in required”) are enough to prove chat + dashboard wiring.

## Other harnesses

Claude, Codex, and Cursor each have a file here. Plan-mode read-only allowlist: `plan_gate.rs` (keep in sync with new read-only CLI verbs).
