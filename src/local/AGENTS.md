# Local mode (`src/local/`)

Projects, experiments, chats, and runs for `orx up` live in the local store; IDs resolve only when the row exists there. Hosted integrations include `openresearch.rs` (managed compute), `ssh_identity.rs` (registered SSH keys), and `starter.rs` (paper context through the literature client).

## Artifacts (`files.rs`)

- Disk: `<data dir>/files/<project slug>/`. Product name is Artifacts; physical dir stays `files/` (legacy `artifacts/` is migrated only when `files/` is missing).
- Filesystem is the source of truth: no DB registry, no upload step. Listings are capped at 2000 entries (`MAX_ENTRIES`).
- `files_dir_display` must stay the un-canonicalized path so chat `<file path="artifacts/…">` prefix matching works on symlinked data dirs (`/tmp` → `/private/tmp`).
- Containment: `is_safe_rel_path` + `resolve_contained`. Do not serve paths outside the project dir.

Agents are told to group durable outputs under topic/experiment folders (see `agent-skills/orx-reports`). The dashboard slug matcher depends on that convention. Do not flatten everything to the artifacts root.

## Playbook and skills

- Session playbook: repo-root `SYSTEM_PROMPT.md`, rendered by `opencode.rs` (`{artifacts}` token).
- Skills: `agent_skills.rs` copies `agent-skills/` into the session worktree each turn (harness-specific skills dir). Edit the canonical files under `agent-skills/`, not generated copies.

## Demo seed (`demo.rs`)

First-run **nanochat** project (preferred slug `nanochat`; collisions use a fallback). Embedded sources come from `demo/nanochat/`. See [`demo/AGENTS.md`](../../demo/AGENTS.md) for evidence and artifact-matcher fixtures.

## OpenCode runtime

- `opencode.rs` / `opencode_runtime.rs` / `opencode_db.rs`: spawn `opencode serve`, V1 vs V2 DB, binary resolve.
- Common install location: `~/.opencode/bin/opencode`. Detect the installed protocol; see [`harness/AGENTS.md`](harness/AGENTS.md).

## Python / worktrees

Session playbook rules apply: never share `.venv` across worktrees; run command is a fixed contract; vary committed code, not env-prefixed knobs.
