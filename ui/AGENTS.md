# Dashboard (`ui/`)

Vite + React SPA, embedded into `orx up` via committed `dist/`.

## Locales

Canonical list is `project.inlang/settings.json`: **`en`**, **`zh-CN`**, **`fa`**, **`ar`**, **`es`**, **`hi`**. Catalogs live in `messages/{locale}.json`.

- Every new string must exist in **all** of those files with the same placeholders.
- Do not add a locale because upstream has it; do not skip one this fork already has.
- `node scripts/check-i18n.mjs` (also `pnpm lint:i18n`) is the gate. Paraglide compile happens in `pnpm build` / CI (`pnpm exec paraglide-js compile`).

## Styles

- Theme aliases: `bg-background`, `text-subtext`, `text-text`, `border-border`, `bg-surface`.
- Canonical layout: `flex flex-col h-full min-h-0`.
- Arbitrary Tailwind values only when no project utility exists. Keep semantic marker classes (`empty-state`, `option-menu`, `model-item`, …) that tests or runtime selectors depend on.
- `node scripts/check-styles.mjs` (`pnpm lint:styles`) forbids raw colors and most arbitrary color/text classes.

## Tests and typecheck

```sh
pnpm typecheck          # regenerates TanStack routes, then tsc
pnpm test               # node --test ui/tests/*.test.mjs
```

CI runs `node --test --experimental-strip-types ui/tests/*.test.mjs` from the repo root. Put unit tests next to the helper they cover (for example `tests/experimentArtifacts.test.mjs`).

## `dist/` is source of truth for the binary

`orx up` serves `ui/dist` through rust-embed. After any UI change:

```sh
pnpm build              # i18n + paraglide + typecheck + vite
```

Commit the regenerated `dist/` assets. Skipping this ships a stale dashboard.

## Do not

- Touch only `en` / `zh-CN` / `fa` after Spanish, Hindi, and Arabic landed.
- Check in a `pnpm-lock.yaml` change without intending a dependency bump.
- Serve the dashboard through ad-hoc Vite against production data; use `scripts/dev-slot.mjs` or `orx up`.
