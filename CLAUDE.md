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
- `src/styles/` — the stylesheet, split by area (`base`, `chrome`, `surfaces`, `cards`, `dice`, `combat`, `panels`, `screens`); `src/style.css` only imports them.

## Conventions

- Saves live in localStorage (`hexbound.save.v1`). When the save shape changes, migrate old saves in `migrateSave` (`src/core/companions.ts`) rather than breaking them.
- Art is procedural SVG/canvas. Don't add external image assets. SVG gradient ids must be unique per call.
- Icons: `src/ui/art/icons.ts` is the one icon set (32-unit SVGs, ink outline, flat tones, no gradients or ids). `h()` in `src/ui/dom.ts` swaps any emoji that has an icon (`EMOJI` map) for its drawing when text is added to the page, so core code can keep writing `"-1 🔥"`. Text set with `textContent` is not converted: use `setText(el, text)`. When you use a new emoji as an icon in the UI, add a drawing and a mapping for it; `icons.test.ts` fails if a sign, block, weather, omen, ability, talent or achievement glyph has none. On the canvas map use `svgImage()` (`src/ui/art/raster.ts`) to draw icons, foe art and portraits.
- Look and feel: use the tokens in `src/styles/base.css` (night surfaces, gold trim, parchment and ink, `--r-*` radii, `--sh-*` shadows, `--card` for a raised card) instead of one-off colours. Night-blue sheets (`Sheet('panel')`) are for the hero and menus; story sheets (`Sheet('event')`) are full-width parchment holding one `.parchment` card, with an optional `.ev-scene` banner across the top. Buttons are `.btn` (quiet), `.btn-primary` (gold) and `.buy` (small gold); they all press down the same way.
- Combat screen (`Game.combat`, `src/styles/combat.css`): the top is the `.arena`, the same scene art as story sheets, with the foe's plate (name, HP, next move) top-left, its portrait top-right and the party chips along the bottom. Below it `.fight-console` holds the dice tray and the log, then abilities, then moves in a four-column grid where Attack and Defend span two columns. Hit effects attach to `.foe-sprite` and the `.pchip` of the target, so keep those elements.
- The player and companions share the `Hero` type; give new combat rules to both.
- Deploys: pushes to `main` build the Docker image via `.github/workflows/deploy.yml`.
- Screen edges: `#map-wrap` fills the whole screen and the HUD/dock float over it as frosted glass tinted by the scene (`src/ui/edges.ts`, also sets `theme-color`). Overlay UI on the map must stay between `var(--hud-h)` and `var(--dock-h)`; the camera gets the same insets via `map.setInsets`.
- PWA updates: the service worker is built from `src/pwa/sw.js` by the `pwa()` plugin in `vite.config.ts` (version + file list baked in, plus `dist/version.json`). The page is network-first, `/assets/*` cache-first. `src/ui/updates.ts` polls `version.json` when the app returns to the foreground and shows an "Update" banner. Don't add a static `public/sw.js`, and keep `scripts/serve.mjs` sending `no-store`/`no-cache` for `sw.js`, `version.json` and `index.html`.
- Encounters are written ahead: `src/ai/foresight.ts` prepares scenes for nearby places, landmarks and the quest climax (one background AI call at a time, saved in `s.foresight`), plus spare wilderness scenes per terrain. `runEvent` takes a ready scene first (`foresight.take`) and only calls the model live when none fits. Unused scenes go to a pool and are reused for the next place of the same kind and terrain. Keep `Game.foresee()` in step with `enterTile`'s rules for which tile gets which encounter.
- Weather: `src/core/weather.ts` picks a daily front per region (deterministic from seed, day and region) and each tile's terrain turns it into rain, storm, snow, fog, heat or wind. `Game.setScene` feeds it to ambience (`rain`/`storm` layers), the map overlay (`src/ui/weather-fx.ts`), the edge colours and the HUD; the AI prompts mention it.
- First-journey tips live in `src/ui/hints.ts` (`hint(id, text)` shows once per device; Settings → "Show tips again" resets them).
- Write your own action: `src/ai/freeform.ts`. Offered only at special moments (`isOpenMoment`: quest climax, landmark scene, returning character, or a scene the AI flagged `open`). The AI only maps the typed text to a check/fight/leave (stat, DC 8–20, reward, up-front cost, `clever` → advantage) and the engine rolls; `sanitizeIntent` enforces the rules and the hero's purse, and `keywordIntent` covers play without AI.
- Turning points: a typed action at a special moment records a `Turn` (`addTurn`, newest 12 in `s.turns`) with the AI's account of what changed (`Outcome.turn`) or a plain fallback. They go into `storyContext` (`turning_points`), into event prompts for the same region, into quest prompts, and the journal. Prepared scenes written before a turning point in their region are not reused.
- Blocked ways: `src/core/blocks.ts`. `s.blocks` holds story blocks (from a turning point's `Outcome.block`, or a fumble in hills/mountains/snow); storms flood river hexes for the day (computed, not stored). `placeBlocks` never closes the hero's tile, villages, the start or the quest goal, and never cuts off the quest or boxes the hero in. Movement uses `canEnter`; tapping an adjacent block opens `Game.openBlock` (check for a torch, pay guards, or leave). Fires and floods expire via `expireBlocks` each morning.
- Story text is plain by default: `PLAIN_STYLE` in `src/ai/director.ts` asks for short sentences (under 18 words), everyday words and no purple prose, and `plain()` splits semicolon chains in what comes back. Settings → "Simple story text" (`settings.plainStory`) switches to richer prose. Keep new prompts and hand-written text easy to read.
- Story voice: `src/ui/voice.ts` (Deepgram Aura-2 TTS, the player's own key in `settings.dgKey`, called from the browser). Only big moments are voiced via `narrate()`: the opening hook, a new quest, the quest climax and other open moments, a turning point's outcome, the "Previously…" recap and the chapter end. Other scenes use `say()` (browser voice, only with "Read every scene aloud"). The narrator follows the tone (`TONE_NARRATOR`) unless picked in Settings; characters get a lasting voice from `voiceFor(name, hint)` using the `voice` hint the event prompt asks for (`parseVoice`), or `guessVoice` from pronouns. `castLines` gives quoted speech to its speaker. Voice plays on its own bus and ducks music/ambience. On failure it falls back to the browser voice.
- Map signs: `src/core/encounters.ts`. `signAt(s, hex)` gives each open tile a sign for the day (foe, scene, quick moment, cache, herbs), deterministic from seed, day and tile, so the map draws them (within `max(2, vision)` of the hero) before you step there; `spendSign` uses one up. `enterTile` follows the sign; there is no hidden random roll any more. Paths route around foe signs unless you tapped one. Quick moments (`MOMENTS`, `takeMoment`) are one-tap trade-offs with no dice.
- Trade-off choices: `src/core/choices.ts`. A `Choice` can carry `cost` (gold/torch/HP, paid up front), `bold` (harder, double reward, failing hurts more) or `sure` (no roll, needs a cost). `shapeChoices` runs once per scene in `runEvent` (AI or hand-written): it prices rests (torches outside villages, gold at inns), marks the hardest of two or more checks bold, and adds a paid sure option (a heal when the hero is below half HP). The AI prompt asks for these too; `clampCost` keeps prices sane.
- Tension: a heavy blow does `HEAVY_MULT` (×3) damage and Defend halves it (`src/core/combat.ts`); `talents.test.ts` balances against a player who braces for heavy blows. Defeat costs the day's gold (at least a quarter) and a bag item (`defeatLoss`). Keep healing scarce: HP carries across a day.

