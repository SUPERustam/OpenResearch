# Dashboard source (`ui/src/`)

React 19 dashboard. `App.tsx` owns tab openers. Data goes through `api.ts` and `queries/`.

## Three file surfaces (do not mix)

| User label | What it is | Open path |
|------------|------------|-----------|
| **Logs** | Per-run log file | `openExperimentTab` / `openRunLogs` → `LogTerminal` (`GET /api/runs/{id}/log`) |
| **Code** | Git branch checkout | `openCodeTabForExperiment` → `CodeTab` (`/api/projects/{id}/code-tree`) |
| **Artifacts** | Project files directory | `openArtifactFileTab` / `ArtifactsTab` (`/api/projects/{id}/files*`) |

The sidebar **Artifacts** tab (`WorkspaceTools` → `ArtifactsTab`) is the project explorer. Per-experiment Artifacts is a **portal file list**, not a jump to that tab.

## Per-experiment Artifacts (required parity)

Shared pieces:

- Matcher: `experimentArtifacts.ts` (`matchExperimentArtifactRoot`, `experimentArtifactFiles`)
- Menu: `components/ExperimentArtifactsMenu.tsx` (portal to `document.body`)
- Open: `App.openArtifactFileTab` with the same `tabOpenGestureHandlers` as Logs/Code

Wire it on **all four** Logs/Code neighbors:

- `components/TreeView.tsx` (`ExpNode`, `NODE_W = 304`, `NODE_H = 132`)
- `components/ExpHoverCard.tsx`
- `components/ExperimentOverview.tsx` (via `DetailDrawer`)
- `components/ExperimentsTable.tsx`

Do not fork a second popover. Extend the shared menu.

### Matcher (do not weaken)

Against **top-level** project artifact entries only:

1. Exact `name === exp.slug` (file or folder) wins.
2. Else a **unique** top-level `slug-…`, or file stem equals / starts with `slug-`.
3. Else a **unique** top-level name sharing **≥ 2** hyphen-separated tokens with the slug (demo: `cpu-apple-silicon-pipeline-results.md` ↔ `cpu-apple-silicon-end-to-end-baseline`).
4. Ambiguous or none → `[]`. **Never** return the rest of the project.

A matched folder is flattened; nested paths are relative to that folder. Always show the Artifacts button. Empty copy is `tree_view_no_matching_artifacts` (**No matching artifacts**). Logs may hide when there are 0 runs; Code and Artifacts stay.

### Portal / event pitfalls

- The menu must be a portal. Inside a React Flow node it inherits canvas zoom.
- `stopPropagation` on pointer/click/aux/double-click. Table row `onClick` otherwise opens overview instead of the file. Mount the trigger inside the row actions group.
- Dismiss: outside pointer, Escape, resize, tree pan (`subscribeDismiss`). Opening the menu should dismiss the hover card.
- Opening a file uses existing preview / keep-open gestures. Do not reimplement viewers; `FileViewer` / `MediaPreview` already handle csv, images, pdf, markdown.

i18n keys (do not rename lightly): `tree_view_artifacts`, `tree_view_open_artifacts`, `tree_view_no_matching_artifacts`, `experiment_overview_artifacts`, `experiment_overview_open_artifacts`, `experiments_table_artifacts`, `experiments_table_open_artifacts`.

## UI kit

Use `components/ui/` (`Button`, `IconButton`, `MenuItem`, `cn`). Prefer `tabOpenGestureHandlers` from `tabPreview.ts` for anything that opens a tab.

## When the user shows a screenshot

Tree card, hover card, overview header, and table row are four components. Fix the surface in the screenshot, then keep the other three in parity.
