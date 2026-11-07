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
