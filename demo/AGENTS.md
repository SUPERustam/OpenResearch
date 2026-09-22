# Embedded demo (`demo/`)

`demo/nanochat/` is the first-run project source. `src/local/demo.rs` embeds it, builds a deterministic git history, and seeds chats/runs. Do not treat this tree as a standalone app the dashboard talks to directly.

## Why matcher tests care

Baseline experiment identity uses the long slug `cpu-apple-silicon-end-to-end-baseline`. Its report `cpu-apple-silicon-pipeline-results.md` shares three leading tokens (`cpu-apple-silicon`). Exact `slug` or `slug-` matching misses it; preserve `ui/src/experimentArtifacts.ts`'s unique-match fallback requiring at least two leading tokens.

## Browser QA

Start an isolated dev slot and create the bundled nanochat demo through onboarding. Use its baseline report to check slug matching. For nested figures/CSV/PDF and empty-state coverage, create the Artifacts Lab fixture described in the root guide; those exact fixtures are not seeded automatically.

Evidence under `demo/nanochat/evidence/` and reports under `demo/nanochat/reports/` are bundled historical outputs, not the live artifacts directory. Demo creation writes artifacts under `<data dir>/files/<project slug>/` (normally `nanochat`; collisions use a fallback). Large model weights, optimizer states, datasets, and environments are intentionally omitted; check the evidence manifest before claiming they are available.
