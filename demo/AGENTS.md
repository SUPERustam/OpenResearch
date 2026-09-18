# Embedded demo (`demo/`)

`demo/nanochat/` is the first-run project source. `src/local/demo.rs` embeds it, builds a deterministic git history, and seeds chats/runs. Do not treat this tree as a standalone app the dashboard talks to directly.

## Why matcher tests care

Baseline experiment identity uses the long slug `cpu-apple-silicon-end-to-end-baseline`. Demo artifact names often share only a **two-token hyphen prefix** (`cpu-apple-silicon-…`). A matcher that only does exact `slug` or `slug-` will miss them. Keep `experimentArtifacts.ts`’s ≥2-token rule.

## Browser QA

If you have not seeded an Artifacts Lab project, start `orx up` / `dev-slot` and use the bundled nanochat demo: tree cards, Code, Logs, and slug-matched artifacts (figures, csv, pdf). Empty sibling experiments should still show **No matching artifacts**, not the whole demo files tree.

Evidence fixtures under `demo/nanochat/evidence/` and reports under `demo/nanochat/reports/` are sample outputs, not the live artifacts dir. Live artifacts are copied into `<data dir>/files/nanochat/` when the demo project is created.
