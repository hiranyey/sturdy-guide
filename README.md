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
- **Combat:** attack rolls against AC, damage dice, and a once-per-fight class ability. The enemy shows its next move in advance (a heavy blow or raising its guard), so you can respond with Defend, Talk (persuade a foe and they may become a friend), Flee or a Potion. If you drop to 0 HP you get one **death save** per fight.
- **Classes:**
  - **Warrior** (Mighty Blow)
  - **Rogue** (Sneak Attack)
  - **Mage** (Firebolt and Thunderwave)
  - **Bard** (Vicious Mockery; Talk rolls are made with advantage)
- **Companions** (up to 2) fight beside you, heal you when you're in trouble, and **remember** what you did. Their memories go back into the AI prompts, so returning NPCs bring up your past together.
- **Level ups** raise HP and let you add +2 to a stat. Loot is upgraded automatically, and villages let you buy, sell and rest.

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

### Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. Enable it under **Settings → Pages → Source: GitHub Actions**. The app is a PWA, so you can "Add to Home Screen" for a full-screen, offline-capable install.

## Architecture

```
src/core/      pure game logic (no DOM): seeded hex world, rules, combat, resolution, state/save
src/ai/        OpenRouter client (JSON mode, OAuth), prompts + validation ("director")
src/ui/        canvas map renderer, dice roller, sheets, screens, synth audio, SVG portraits
```

- The **world** is infinite and deterministic from a seed: layered value-noise elevation, moisture and temperature produce biomes, and points of interest are placed by local minima in a hash so they never clump. The save file stores only the changes (visited tiles, finished POIs, NPCs, story).
- The **AI acts as narrator and the engine as referee.** The model returns JSON. `sanitizeEvent` clamps DCs to the danger tier, fixes invalid stats and enemies, and ensures there's always a way out. Rewards and penalties are applied by `core/resolve.ts`, and the model is told the result only so it can narrate it.
- **Long-term memory stays small:** a rolling ~140-word story summary, up to 20 "world facts", the last few log lines, and per-NPC memories. These are rewritten at each camp.
- **Latency is hidden:** the outcome narration request starts the moment the die is thrown and runs while it tumbles. Region names load in the background, and every AI call has a timeout and a fallback.
