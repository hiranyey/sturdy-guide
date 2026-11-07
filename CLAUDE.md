# Hexbound — notes for Claude

Mobile-first web RPG: Vite 6 + TypeScript (strict, `noUnused*`), vanilla DOM, Vitest. See README.md for the full feature list and architecture.

## Commands

- `npm run dev` — dev server
- `npm test` — unit tests (Vitest)
- `npx tsc --noEmit -p .` — type check
- `npm run build` — type check + production build

Run the type check and tests before every commit.

## Versioning — bump before every push to `main`

The app version lives in `package.json` (`"version"`). It is the single source of truth: `vite.config.ts` injects it as `__APP_VERSION__`, and Settings shows it as "Hexbound vX.Y.Z".

**Before every push to `main`, increase the version** and commit the bump with the change:

```sh
npm version patch --no-git-tag-version   # fixes and small tweaks
npm version minor --no-git-tag-version   # new features
npm version major --no-git-tag-version   # save-breaking or very large changes
```

This updates `package.json` and `package-lock.json`. Don't create git tags. Never push to `main` with the same version as the previous push to `main`; check with `git show origin/main:package.json | grep version`.

## Layout

- `src/core/` — pure game logic, no DOM: world, rules, talents, companions, combat, resolve, state/save.
- `src/ai/` — OpenRouter client and prompts. The engine decides outcomes; the LLM only narrates.
- `src/ui/` — canvas map, dice, sheets, screens, audio, procedural SVG art (`src/ui/art/`).

## Conventions

- Saves live in localStorage (`hexbound.save.v1`). When the save shape changes, migrate old saves in `migrateSave` (`src/core/companions.ts`) rather than breaking them.
- Art is procedural SVG/canvas. Don't add external image assets. SVG gradient ids must be unique per call.
- The player and companions share the `Hero` type; give new combat rules to both.
- Deploys: pushes to `main` build the Docker image via `.github/workflows/deploy.yml`.
- Screen edges: `#map-wrap` fills the whole screen and the HUD/dock float over it as frosted glass tinted by the scene (`src/ui/edges.ts`, also sets `theme-color`). Overlay UI on the map must stay between `var(--hud-h)` and `var(--dock-h)`; the camera gets the same insets via `map.setInsets`.
- PWA updates: the service worker is built from `src/pwa/sw.js` by the `pwa()` plugin in `vite.config.ts` (version + file list baked in, plus `dist/version.json`). The page is network-first, `/assets/*` cache-first. `src/ui/updates.ts` polls `version.json` when the app returns to the foreground and shows an "Update" banner. Don't add a static `public/sw.js`, and keep `scripts/serve.mjs` sending `no-store`/`no-cache` for `sw.js`, `version.json` and `index.html`.
- Encounters are written ahead: `src/ai/foresight.ts` prepares scenes for nearby places, landmarks and the quest climax (one background AI call at a time, saved in `s.foresight`), plus spare wilderness scenes per terrain. `runEvent` takes a ready scene first (`foresight.take`) and only calls the model live when none fits. Unused scenes go to a pool and are reused for the next place of the same kind and terrain. Keep `Game.foresee()` in step with `enterTile`'s rules for which tile gets which encounter.
- Weather: `src/core/weather.ts` picks a daily front per region (deterministic from seed, day and region) and each tile's terrain turns it into rain, storm, snow, fog, heat or wind. `Game.setScene` feeds it to ambience (`rain`/`storm` layers), the map overlay (`src/ui/weather-fx.ts`), the edge colours and the HUD; the AI prompts mention it.
- First-journey tips live in `src/ui/hints.ts` (`hint(id, text)` shows once per device; Settings → "Show tips again" resets them).
