# Run or stop OpenResearch

Run commands from the worktree being tested. The helper assigns that worktree
isolated backend/UI ports and tracks its processes.

```sh
# Start fresh; --open opens the default browser (optional); prints URLs when ready
scripts/dev-slot.mjs start --db live --open

# Show the slot, database mode, ports, and data directory
scripts/dev-slot.mjs status

# Stop its UI and backend; keep the slot and database mode
scripts/dev-slot.mjs stop
```

Database modes:

- `empty`: new isolated database with no projects (safest).
- `copy`: safely snapshot the normal CLI database and copy its run logs.
- `live`: use normal OpenResearch data, config, and cache directly; changes
  affect real local data.

To change modes, remove the stopped slot first:

```sh
scripts/dev-slot.mjs stop
scripts/dev-slot.mjs cleanup
```

`cleanup` removes the slot reservation, isolated data, logs, and config—not the
normal directories used by `copy` or `live`.

Prefer the helper to stopping one port: it stops the related UI and backend.
For an unmanaged process (example port `5202`):

```sh
lsof -nP -iTCP:5202 -sTCP:LISTEN
kill "$(lsof -tiTCP:5202 -sTCP:LISTEN)"
```

Installed release:

```sh
orx up        # Start; opens http://127.0.0.1:4791
# Press Ctrl+C to stop.
```
