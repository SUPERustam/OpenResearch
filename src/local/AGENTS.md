# Local mode (`src/local/`)

Projects, experiments, chats, and runs for `orx up`. Nothing here calls the hosted OpenResearch API except `openresearch.rs` (managed compute). IDs resolve only when the row exists in the local store.

## Artifacts (`files.rs`)

- Disk: `<data dir>/files/<project slug>/`. Product name is Artifacts; physical dir stays `files/` (legacy `artifacts/` is migrated only when `files/` is missing).
- Filesystem is the source of truth: no DB registry, no upload step. Cap ~2000 entries.
- `files_dir_display` must stay the un-canonicalized path so chat `<file path="artifacts/…">` prefix matching works on symlinked data dirs (`/tmp` → `/private/tmp`).
- Containment: `is_safe_rel_path` + `resolve_contained`. Do not serve paths outside the project dir.

Agents are told to group durable outputs under topic/experiment folders (see `agent-skills/orx-reports`). The dashboard slug matcher depends on that convention. Do not flatten everything to the artifacts root.

## Playbook and skills

- Session playbook: repo-root `SYSTEM_PROMPT.md`, rendered by `opencode.rs` (`{artifacts}` token).
- Skills: `agent_skills.rs` copies `agent-skills/` into the session worktree each turn (harness-specific skills dir). Edit the canonical files under `agent-skills/`, not generated copies.

## Demo seed (`demo.rs`)

First-run **nanochat** project (`PROJECT_SLUG = "nanochat"`). Baseline experiment slug/branch uses `cpu-apple-silicon-end-to-end-baseline`. Artifact names like `cpu-apple-silicon-pipeline-results.md` only match via the **two-token hyphen prefix** rule. Embedded sources come from `demo/nanochat/`.

## OpenCode runtime

- `opencode.rs` / `opencode_runtime.rs` / `opencode_db.rs`: spawn `opencode serve`, V1 vs V2 DB, binary resolve.
- Install location agents see: `~/.opencode/bin/opencode`. Current installs are V2; see [`harness/AGENTS.md`](harness/AGENTS.md).

## Python / worktrees

Session playbook rules apply: never share `.venv` across worktrees; run command is a fixed contract; vary committed code, not env-prefixed knobs.
