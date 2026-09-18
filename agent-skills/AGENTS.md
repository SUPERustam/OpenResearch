# Bundled skills (`agent-skills/`)

Canonical `SKILL.md` packages installed into session worktrees (`src/local/agent_skills.rs`) and printed by `orx skill`. Directory names use the `orx-` prefix. Edit these files; generated `.claude/skills` (and friends) are copies.

## Artifact layout (the dashboard matcher depends on this)

`orx-reports` tells research agents to write durable outputs into the playbook `{artifacts}` directory, grouped by topic — typically a **folder named like the experiment slug**:

```text
<artifacts-dir>/
  transformer-sweep/
    report.md
    metrics.csv
    figures/loss.pdf
```

Do not change that convention without updating `ui/src/experimentArtifacts.ts` and its tests. Chat citations use `<file path="artifacts/<relative-path>" />` (see repo-root `SYSTEM_PROMPT.md`).

`orx-figures` is required before plotting; default matplotlib output is not acceptable in reports.

## Cardinal experiment-tree rules

`SKILL.md` (repo root) and `orx-experiment-tree` are binding for agents *inside* `orx` sessions, not for this CLI codebase — but do not contradict them from playbook or skill text:

1. Never edit a node once a run has answered it; branch a child.
2. Run command and environment are a fixed contract.
3. Vary committed code/config, not knobs in the command.
4. Grow the tree downward, not a wide root with no grandchildren.

## Sets

Local `orx up` sessions get the Local set (no onboarding). `orx install-skills --full` writes the Full set. Keep one canonical `SKILL.md` per module; put extras under `references/` or `assets/`.
