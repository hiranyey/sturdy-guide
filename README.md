# Hexbound

A pocket-sized fantasy RPG for your phone. Explore a hex world, roll D&D-style dice, fight, make friends, and keep a story going **five minutes at a time**.

An **AI Dungeon Master** (any model on [OpenRouter](https://openrouter.ai)) writes the events, NPCs, regions, quests and end-of-day recaps. The **game engine** rolls every die and decides every outcome, so the AI can't break the rules. With no API key, a hand-written storyteller takes over and the game still works completely offline.

## How a session plays

1. **Open the app.** You get a *"Previously in…"* recap, the cliffhanger from last time, and maybe a small gift if you've been away.
2. **Spend 12 torches.** Each step burns one; marsh, peaks and snow cost two. Tap a glowing hex to move, or tap any revealed hex to walk there.
3. **Things happen.** Villages, ruins, caves, shrines, towers, groves, strangers, random ambushes and odd wilderness moments.
4. **Make camp.** This ends the day. The AI writes the chapter recap, your companion says something by the fire, and you get a hook for tomorrow. Everything is saved, so it's a natural place to stop.

## D&D-style mechanics

- **Six abilities** (STR/DEX/CON/INT/WIS/CHA) with standard modifiers, plus a **proficiency bonus** on your class's two best stats.
- **Ability checks:** you tap a d20, it tumbles and lands, and your total is compared against the DC. Each choice shows its DC and your odds before you commit.
- **Nat 20** is a critical (double rewards and **Inspiration**). **Nat 1** is a fumble.
- **Inspiration:** spend it on any roll to get **advantage** (roll two d20s and keep the higher).
- **Combat:** attack rolls against AC, damage dice, and class abilities with a few uses per fight. Some abilities are **bonus actions** (⚡): they resolve at once and you still take your turn. The enemy shows its next move in advance (a heavy blow, raising its guard, or several attacks against a party), so you can respond with Defend, Talk (persuade a foe and they may become a friend), Flee, a Potion or First Aid. If you drop to 0 HP you get one **death save** per fight.
- **Classes:** each has a signature ability and a **talent tree** of three paths:

  | Class | Signature | Talent paths |
  |---|---|---|
  | **Warrior** | Mighty Blow | ⚔ Champion (crits, Titan Strike) · 🛡 Guardian (Bodyguard, Second Wind, Unbreakable) · 🚩 Warlord (Battle Cry, Leadership, Command) |
  | **Rogue** | Sneak Attack | 🗡 Assassin (poison, ambush, Execute) · 🌫 Shadow (Evasion, Uncanny Dodge, Vanish) · 🃏 Trickster (Expertise, Light Fingers, Dirty Trick, Lucky) |
  | **Mage** | Thunderwave | 🔥 Evoker (Overchannel, Fireball, Archmage) · 🔮 Abjurer (Arcane Ward, Shield, Hold Monster) · 👁 Diviner (Scholar, Far Sight, Foresight, Seer) |
  | **Bard** | Vicious Mockery (Talk rolls are made with advantage) | 🤺 Valor (Hideous Laughter, Battle Magic) · 💚 Healing (Healing Word, Song of Rest, Guardian Song) · 💬 Silver Tongue (Captivate, Song of Courage, Legend) |

- **Talents:** every level gives a talent point. Each path has four tiers, opening at levels 2, 5, 8 and 12, and a tier needs the one above it. Talents unlock new abilities, sharpen old ones (more uses, more dice), or give passives such as +AC, a wider crit range, rerolling natural 1s, extra torches, more gold, market discounts or seeing further. Once a tree is complete, extra levels give stat increases instead.
- **Companions are heroes too.** Up to 2 travel with you, and each has the same sheet as yours: a class (from the story, or guessed from their role), level, HP, gear, stats and the same class talent tree. They level up with you and join at your level. You pick their talents (or let them choose; each leans towards a favourite path). In a fight they act on their own with their abilities: healing whoever is hurt, opening with buffs, stunning a foe that winds up a big blow. They can fall and be revived. Their check talents lend a hand on your rolls (they show up as a named bonus on the die), and party-wide talents like *Forced March* or *Light Fingers* work for everyone. Loot you don't need goes to the companion it upgrades, or you can hand bag items to them yourself. They also **remember** what you did. Their memories go back into the AI prompts, so returning NPCs bring up your past together.
- **Levelling** runs from 1 to 20 on a smooth XP curve: level L → L+1 costs 100 + 80·(L−1) XP (100, 180, 260, 340, …), so every level asks exactly 80 more than the last. XP rewards grow with the danger tier, and foes in a region you've outgrown are worth +10% per level of the gap, so the encounters needed per level rise gently, from about 4 at first to about 8 by level 10 and 9–10 near the cap. Each level raises HP and gives a talent point; levels 4, 8, 12, 16 and 19 add +2 to a stat of your choice. Foes grow tougher with the danger tier, your party's size and how far you've outgrown a region. Loot is upgraded automatically, and villages let you buy, sell and rest.

## Made for phones

- **Gestures:** tap a hex to move. Press and hold a hex for its terrain, landmark, danger and move cost. Press and hold a choice for its exact odds ("need 16+ on the die, 25%, 44% with Inspiration") and what success gives. Flick the d20 upward to throw it (a harder flick tumbles longer). Swipe sheets down to close them. Drag to look around and pinch to zoom.
- **Add to Home Screen:** offered after your first finished chapter. On Android and desktop Chrome or Edge this uses the native install prompt; on iOS it shows a step-by-step Share → Add to Home Screen guide. You can install any time from Settings. If you say "Maybe later", it waits 3 days before asking again.
- **Share cards:** 1080×1350 images for a chapter recap (with a snapshot of your map), a natural 20, an achievement, or your hero. They open the native share sheet where supported, with "Save image" and "Copy caption" as fallbacks.
- **Achievements:** 30 of them, from *First Steps* to *Wonders of the World* (including *Talented*, *Mastery*, *Mentor* and *Apex*). Each shows a progress bar, and when one unlocks a banner appears that you can tap to share.
- **Sound:** synthesized sound effects and optional ambient music whose mood follows the terrain (and changes for combat and camp), each with its own volume slider. *Read story aloud* narrates events and recaps using the device's voice.
- **Accessibility:** a text size setting (S to XL), a Reduce motion toggle (which follows the OS setting by default), screen-reader labels and live announcements for dice results and outcomes, and difficulty badges marked with ✓ / ≈ / ! as well as colour.
- **Battery saver:** the map redraws at full frame rate only while something is moving. Otherwise it idles at about 12 fps for ambient effects, or doesn't redraw at all with Reduce motion on.
- **Never lose progress:** if you close the app mid-event or mid-fight, it reopens exactly there next time. Once the die is thrown the result is saved, so reopening can't be used to re-roll. **Settings → Save backup** exports your whole journey as a compact text code (copy, share or download it) and imports it on any device. Abandoning or importing a journey can't be undone by the page writing the old game back as it reloads.
- **Portrait-first:** respects safe areas for notches and the Dynamic Island, and phones held sideways see a polite "turn your phone upright" note.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 — open on your phone via your LAN IP
npm test
npm run build    # static site in dist/
```

### Connect the AI

Open **Settings & AI**. Then either:
- tap **Connect with OpenRouter** (OAuth PKCE: you log in and the key comes back to the app automatically; no copy-pasting), or
- paste an OpenRouter API key.

Choose any model (the default is `google/gemini-2.5-flash`, which is fast and cheap). The key is stored only in your browser's localStorage and sent only to `openrouter.ai`.

OAuth needs a secure origin, so use `https://` or `localhost`.

### Configuration

The game itself needs **no environment variables**. It is a static site, and saves and settings live in each player's browser. The OpenRouter key is entered by each player in **Settings & AI**. Never bake it in at build time, because anything in the bundle is public.

| Where | Name | Required | Purpose |
| --- | --- | --- | --- |
| Container | `PORT` | no (defaults to `3000`, set in the Dockerfile) | Port `scripts/serve.mjs` listens on |
| GitHub Actions secret | `REPOFLOW_USERNAME` | yes, to deploy | Registry login that can push the image |
| GitHub Actions secret | `REPOFLOW_PASSWORD` | yes, to deploy | Password for that login |
| GitHub Actions secret | `WEBHOOK_URL` | yes, to deploy | Vibeship deploy webhook. Treat it like a password: anyone holding it can deploy the project |

Add the secrets under **Settings → Secrets and variables → Actions**.

### Deploy

`.github/workflows/deploy.yml` deploys to **Vibeship** (not GitHub Pages):

1. It runs `npm ci` and `npm test`. Pull requests stop here.
2. It builds the Docker image (`linux/amd64`) and pushes it to `api.repoflow.io/hiranyeyg-6713/vibes/sturdy-guide`, tagged `:latest` and `:<commit sha>`.
3. It calls the Vibeship webhook with that exact image digest. Vibeship pulls the image and health-checks it. Traffic only switches to the new version once it is healthy; otherwise the previous version keeps serving.

The workflow runs on every push to `main` or `claude/jolly-galileo-03dgpb`, and can also be started by hand (**Run workflow**). One deploy runs at a time; later pushes queue behind it.

To run the production container locally:

```bash
docker build -t hexbound .
docker run --rm -p 3000:3000 hexbound   # http://localhost:3000, health check at /health
```

Without Docker, run `npm run build && node scripts/serve.mjs`.

The container serves `dist/` on port 3000 on all interfaces. `GET /health` returns 200 once the site is present. Nothing is written to disk.

The app is a PWA, so players can **Add to Home Screen** for a full-screen, offline-capable install.

## Architecture

```
src/core/      pure game logic (no DOM): seeded hex world, rules, combat, resolution, state/save
src/ai/        OpenRouter client (JSON mode, OAuth), prompts + validation ("director")
src/ui/        canvas map renderer, dice roller, sheets, screens, synth audio, SVG portraits
```

- **Map variety** (`core/terrain.ts`, `ui/terrain-art.ts`): 10 biomes split into 30 sub-styles that form coherent patches (autumn woods, birch groves, jungle, mangroves, dead marsh, heather/rocky hills, red crags, volcanic peaks with lava, glaciers, tundra, mesas, salt flats, farmland around villages, lily shallows, kelp seas…). Rivers follow a downhill flow model: each river hex drains into exactly one lower neighbour, so streams branch, merge and run to the sea. **26 midhex landmarks** (standing stones, swords in stones, giant ribcages, crystal outcrops, windmills, wells, hot springs, oases, shipwrecks, lava vents, ice spires…) sit at hex centres. Passive ones grant lore plus a perk on first visit (heal, map reveal, Inspiration, gold, potion, XP, +1 torch). Interactive ones open their own event, and when AI is on the landmark becomes the centrepiece of the generated scene.
- **Heroes and talents** (`core/talents.ts`, `core/companions.ts`, `core/combat.ts`): the player and every companion share one `Hero` shape, so AC, attack, checks, levelling and talents are computed by the same functions for both. Talent trees are data: each node lists passive `Mods` (summed per hero, or across the party for utility perks) or grants an ability, and the combat engine resolves abilities by id. Companion tactics are a small rule-based AI. Balance was tuned with simulated fights across every class, level, tier and party size, and `talents.test.ts` keeps win rates in range. Older saves are migrated on load: heroes get the talent points for levels they already earned, and companions get a full sheet.
- The **world** is infinite and deterministic from a seed: layered value-noise elevation, moisture and temperature produce biomes, and points of interest are placed by local minima in a hash so they never clump. The save file stores only the changes (visited tiles, finished POIs, NPCs, story).
- The **AI acts as narrator and the engine as referee.** The model returns JSON. `sanitizeEvent` clamps DCs to the danger tier, fixes invalid stats and enemies, and ensures there's always a way out. Rewards and penalties are applied by `core/resolve.ts`, and the model is told the result only so it can narrate it.
- **Long-term memory stays small:** a rolling ~140-word story summary, up to 20 "world facts", the last few log lines, and per-NPC memories. These are rewritten at each camp.
- **Latency is hidden:** the outcome narration request starts the moment the die is thrown and runs while it tumbles. Region names load in the background, and every AI call has a timeout and a fallback.
