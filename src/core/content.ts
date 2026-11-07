// Hand-written fallback content. Used when no OpenRouter key is set,
// when a request fails, and for cheap "filler" turns that never need an LLM.
import { pick, type Rand, rand, chance } from './rng';
import type { Biome, EnemySpec, EventContext, GameEvent, NpcSpec, PoiKind, Tone } from './types';

const FIRST = ['Mira', 'Tobin', 'Esk', 'Wren', 'Holt', 'Isolde', 'Fenn', 'Brakka', 'Lio', 'Senna', 'Orrin', 'Talia', 'Quill', 'Marrow', 'Juna', 'Cassius', 'Pip', 'Yara', 'Dov', 'Ilse', 'Rook', 'Nessa', 'Bram', 'Calla', 'Zeph', 'Odo', 'Vesna', 'Garrick', 'Lumi', 'Thane'];
const EPITHET = ['the Lantern-Bearer', 'Half-Hand', 'of the Reeds', 'Ashcloak', 'the Unlucky', 'Saltborn', 'the Quiet', 'Ironbrow', 'Two-Coins', 'the Wanderer', 'Moth-Eyed', 'the Kind'];
const LOOKS = ['a patched green cloak and a crooked smile', 'silver-streaked braids and ink-stained fingers', 'a scarred jaw and a beekeeper\'s veil', 'too many rings and a nervous laugh', 'a wolf-pelt mantle and calm grey eyes', 'a bright red scarf and muddy boots', 'freckles, a slingshot and a bandaged knee', 'a monk\'s robe singed at the hem'];
const PERSONALITIES = ['cheerful but secretly grieving', 'gruff, loyal once trust is earned', 'curious to a fault', 'sarcastic and brave', 'gentle, speaks in proverbs', 'boastful, terrified of the dark', 'shrewd and honest', 'dreamy, hums old songs'];
const ROLES = ['wandering herbalist', 'retired sellsword', 'runaway apprentice', 'travelling tinker', 'disgraced knight', 'map-maker', 'monster hunter', 'shrine keeper', 'goat herder', 'smuggler'];

export function npcName(r: Rand = rand) {
  return `${pick(FIRST, r)}${chance(0.5, r) ? ' ' + pick(EPITHET, r) : ''}`;
}

export function randomNpc(r: Rand = rand, role?: string): NpcSpec {
  return { name: npcName(r), role: role ?? pick(ROLES, r), look: pick(LOOKS, r), personality: pick(PERSONALITIES, r) };
}

const REGION_ADJ: Record<Biome, string[]> = {
  grass: ['Golden', 'Whispering', 'Windward', 'Bramble', 'Sunlit', 'Hollow'],
  forest: ['Thornwood', 'Elder', 'Mossy', 'Gloaming', 'Owlsong', 'Tangle'],
  swamp: ['Weeping', 'Drowned', 'Mire', 'Lantern', 'Rotting', 'Croaking'],
  hills: ['Barrow', 'Rolling', 'Shepherd\'s', 'Cairn', 'Windswept'],
  mountain: ['Thunder', 'Iron', 'Skyfang', 'Broken', 'Giant\'s'],
  snow: ['Frost', 'Pale', 'Howling', 'Glacier', 'Silent'],
  desert: ['Sunscour', 'Amber', 'Bone', 'Mirage', 'Scorched'],
  sand: ['Saltwind', 'Gull', 'Driftwood', 'Pearl', 'Tide'],
  water: ['Glass'], deep: ['Abyssal'],
};
const REGION_NOUN: Record<Biome, string[]> = {
  grass: ['Meadows', 'Downs', 'Fields', 'Vale', 'Leas'],
  forest: ['Wood', 'Weald', 'Thicket', 'Glades', 'Grove'],
  swamp: ['Fens', 'Bog', 'Marshes', 'Mire', 'Sloughs'],
  hills: ['Hills', 'Tors', 'Knolls', 'Barrows', 'Heights'],
  mountain: ['Peaks', 'Spires', 'Crags', 'Teeth', 'Range'],
  snow: ['Wastes', 'Reach', 'Expanse', 'Tundra', 'Drifts'],
  desert: ['Dunes', 'Sands', 'Flats', 'Expanse', 'Barrens'],
  sand: ['Shore', 'Strand', 'Coast', 'Banks', 'Sands'],
  water: ['Waters'], deep: ['Deep'],
};

export function regionName(biome: Biome, r: Rand = rand) {
  return `The ${pick(REGION_ADJ[biome], r)} ${pick(REGION_NOUN[biome], r)}`;
}

const REGION_BLURB: Record<Biome, string[]> = {
  grass: ['Larks circle over endless swaying grass.', 'Old cart-tracks crisscross gentle green land.'],
  forest: ['Branches knit overhead into a green cathedral.', 'Something watches from between the trunks.'],
  swamp: ['Will-o\'-wisps drift above black water.', 'The air is thick, sweet and rotten.'],
  hills: ['Burial mounds dot the rolling slopes.', 'Wind sings through standing stones.'],
  mountain: ['Thunder rolls between jagged peaks.', 'Eagles scream high above narrow passes.'],
  snow: ['Every footstep crunches loud in the hush.', 'Blue ice hides shapes you\'d rather not name.'],
  desert: ['Heat ripples over dunes the colour of honey.', 'Half-buried statues stare at the sun.'],
  sand: ['Gulls quarrel over wreckage on the beach.', 'Salt crusts every rock and rope.'],
  water: ['Calm waters.'], deep: ['The deep.'],
};
export function regionBlurb(biome: Biome, r: Rand = rand) {
  return pick(REGION_BLURB[biome], r);
}

export const FLAVOR: Record<Biome, string[]> = {
  grass: ['Wind combs the tall grass into silver waves.', 'A hare bolts from under your boots.', 'Wildflowers nod as you pass.', 'You find a rusted horseshoe — luck, perhaps.', 'Distant bells chime from somewhere unseen.'],
  forest: ['Pine needles hush your footsteps.', 'A woodpecker drums an urgent message.', 'Sunlight spills through the canopy in golden coins.', 'Mushrooms ring a mossy stump.', 'Branches creak as if whispering about you.'],
  swamp: ['Your boots sink with a wet sucking sound.', 'Bubbles rise from something breathing below.', 'Frogs fall silent as you approach.', 'A lantern-light flickers, then vanishes.', 'Reeds rattle like dry bones.'],
  hills: ['From the ridge you see for miles.', 'A cairn of stones marks someone\'s grave.', 'Sheep watch you with deep suspicion.', 'Wind tugs at your cloak like an impatient child.'],
  mountain: ['Thin air burns your lungs.', 'Pebbles skitter down a sheer drop.', 'An eagle shadow sweeps over you.', 'Snow crunches at the edge of the path.'],
  snow: ['Your breath hangs in the air like ghosts.', 'Ice groans somewhere beneath the snow.', 'Fresh pawprints — big ones — cross your path.', 'The cold gnaws through your gloves.'],
  desert: ['Heat shimmers off the dunes.', 'A scorpion scuttles into the shade of a skull.', 'Sand hisses in the wind.', 'A mirage of a palace wavers and vanishes.'],
  sand: ['Waves hiss against the shore.', 'Gulls cry overhead.', 'Driftwood shaped like a hand points inland.', 'You pocket a pretty shell.'],
  water: [''], deep: [''],
};

// --- Enemies ---
export const ENEMIES: Record<Biome, EnemySpec[]> = {
  grass: [{ name: 'Road Bandit', kind: 'humanoid', emoji: '🥷' }, { name: 'Dire Boar', kind: 'beast', emoji: '🐗' }, { name: 'Gnoll Scout', kind: 'humanoid', emoji: '👺' }],
  forest: [{ name: 'Grey Wolf', kind: 'beast', emoji: '🐺' }, { name: 'Giant Spider', kind: 'monster', emoji: '🕷️' }, { name: 'Goblin Raider', kind: 'humanoid', emoji: '👹' }, { name: 'Restless Dryad', kind: 'spirit', emoji: '🧚' }],
  swamp: [{ name: 'Bog Zombie', kind: 'undead', emoji: '🧟' }, { name: 'Marsh Serpent', kind: 'beast', emoji: '🐍' }, { name: 'Will-o\'-Wisp', kind: 'spirit', emoji: '👻' }, { name: 'Lizardfolk Hunter', kind: 'humanoid', emoji: '🦎' }],
  hills: [{ name: 'Barrow Wight', kind: 'undead', emoji: '💀' }, { name: 'Hill Ogre', kind: 'monster', emoji: '👹' }, { name: 'Highwayman', kind: 'humanoid', emoji: '🥷' }],
  mountain: [{ name: 'Rock Troll', kind: 'monster', emoji: '🧌' }, { name: 'Giant Eagle', kind: 'beast', emoji: '🦅' }, { name: 'Harpy', kind: 'monster', emoji: '🦇' }],
  snow: [{ name: 'Frost Wolf', kind: 'beast', emoji: '🐺' }, { name: 'Ice Wraith', kind: 'spirit', emoji: '👻' }, { name: 'Yeti', kind: 'monster', emoji: '🦍' }],
  desert: [{ name: 'Giant Scorpion', kind: 'beast', emoji: '🦂' }, { name: 'Sand Mummy', kind: 'undead', emoji: '🧟' }, { name: 'Desert Raider', kind: 'humanoid', emoji: '🥷' }],
  sand: [{ name: 'Giant Crab', kind: 'beast', emoji: '🦀' }, { name: 'Wrecker Pirate', kind: 'humanoid', emoji: '🏴‍☠️' }, { name: 'Drowned Sailor', kind: 'undead', emoji: '🧟' }],
  water: [], deep: [],
};

export const KIND_EMOJI: Record<string, string> = { beast: '🐺', humanoid: '🥷', undead: '💀', monster: '👹', spirit: '👻' };

export const ENEMY_INTRO = [
  '{e} bursts from cover, blocking your path!',
  'You hear it before you see it — {e}, and it\'s coming for you.',
  '{e} has been stalking you. It strikes now.',
  'Too late, you notice {e} lying in wait.',
];

// --- Events ---
type EventMaker = (ctx: EventContext, r: Rand) => GameEvent;
const tierDc = (base: number, ctx: EventContext) => Math.min(20, base + ctx.tier);

const POI_EVENTS: Record<PoiKind | 'wild' | 'quest', EventMaker[]> = {
  start: [() => ({ title: 'Last Embers', text: 'The campfire where your journey began still smoulders. Someone left a note pinned under a stone: "Don\'t trust the crows."', npc: null, choices: [{ label: 'Study the note', kind: 'check', stat: 'int', dc: 10, reward: 'lore' }, { label: 'Move on', kind: 'leave' }] })],
  village: [
    (ctx, r) => {
      const npc = randomNpc(r, 'innkeeper');
      return { title: 'A Crooked Inn', text: `Smoke curls from the chimney of the Gilded Goose. ${npc.name}, the innkeeper, eyes your boots and grins: "Mud from ${ctx.regionName}, eh? Got stories?"`, npc, choices: [
        { label: 'Tell a rousing tale', kind: 'check', stat: 'cha', dc: tierDc(10, ctx), reward: 'ally' },
        { label: 'Browse the market', kind: 'trade' },
        { label: 'Rent a bed (10g)', kind: 'rest' },
        { label: 'Wander on', kind: 'leave' },
      ] };
    },
    (ctx, r) => {
      const npc = randomNpc(r, 'worried farmer');
      return { title: 'Missing Goats', text: `A village of thatched roofs and barking dogs. ${npc.name} wrings their hat: "Three goats gone in three nights. Tracks lead to the woods — big tracks."`, npc, choices: [
        { label: 'Follow the tracks', kind: 'check', stat: 'wis', dc: tierDc(11, ctx), reward: 'gold' },
        { label: 'Wait in ambush', kind: 'fight', enemy: { name: 'Hungry Owlbear Cub', kind: 'beast', emoji: '🦉' } },
        { label: 'Visit the market', kind: 'trade' },
        { label: 'Wish them luck', kind: 'leave' },
      ] };
    },
    (ctx, r) => {
      const npc = randomNpc(r, 'blacksmith');
      return { title: 'Sparks & Gossip', text: `The forge glows orange. ${npc.name} hammers a blade and talks without looking up: "Heard ${ctx.regionName} has a buried vault. Heard it's cursed too."`, npc, choices: [
        { label: 'Help work the bellows', kind: 'check', stat: 'str', dc: tierDc(10, ctx), reward: 'item' },
        { label: 'Ask about the vault', kind: 'check', stat: 'cha', dc: tierDc(9, ctx), reward: 'lore' },
        { label: 'Trade goods', kind: 'trade' },
        { label: 'Leave', kind: 'leave' },
      ] };
    },
  ],
  ruin: [
    (ctx) => ({ title: 'Toppled Temple', text: 'Broken columns lean like tired giants. Beneath an altar slab, you glimpse a glint of gold — and a faded warning carved in an old tongue.', npc: null, choices: [
      { label: 'Heave the slab aside', kind: 'check', stat: 'str', dc: tierDc(12, ctx), reward: 'gold' },
      { label: 'Decipher the warning', kind: 'check', stat: 'int', dc: tierDc(11, ctx), reward: 'lore' },
      { label: 'Leave it be', kind: 'leave' },
    ] }),
    (ctx) => ({ title: 'The Bone Gallery', text: 'A collapsed hall lined with skulls in niches. One skull\'s eye sockets glow faintly. The air turns cold as you step inside.', npc: null, choices: [
      { label: 'Snatch the glowing skull', kind: 'check', stat: 'dex', dc: tierDc(12, ctx), reward: 'item' },
      { label: 'Face what wakes', kind: 'fight', enemy: { name: 'Skeleton Warden', kind: 'undead', emoji: '💀' } },
      { label: 'Back away slowly', kind: 'leave' },
    ] }),
    (ctx) => ({ title: 'Sunken Library', text: 'Shelves of rotting books slope into a flooded basement. A single dry tome rests on a floating desk, just out of reach.', npc: null, choices: [
      { label: 'Leap across the debris', kind: 'check', stat: 'dex', dc: tierDc(11, ctx), reward: 'xp' },
      { label: 'Read the spines from afar', kind: 'check', stat: 'wis', dc: tierDc(10, ctx), reward: 'lore' },
      { label: 'Not worth drowning for', kind: 'leave' },
    ] }),
  ],
  cave: [
    (ctx) => ({ title: 'Breathing Cave', text: 'Warm air sighs out of the cave mouth, then draws back in. Coins glitter on the floor just inside — scattered like bait.', npc: null, choices: [
      { label: 'Sneak in and grab coins', kind: 'check', stat: 'dex', dc: tierDc(12, ctx), reward: 'gold' },
      { label: 'Wake whatever lives here', kind: 'fight', enemy: { name: 'Cave Troll', kind: 'monster', emoji: '🧌' } },
      { label: 'Nope', kind: 'leave' },
    ] }),
    (ctx, r) => {
      const npc = randomNpc(r, 'trapped miner');
      return { title: 'Cave-In', text: `Rubble blocks a tunnel. A muffled voice — ${npc.name} — calls from beyond: "Please! The supports are cracking!"`, npc, choices: [
        { label: 'Dig them out', kind: 'check', stat: 'str', dc: tierDc(11, ctx), reward: 'ally' },
        { label: 'Find a safer way round', kind: 'check', stat: 'int', dc: tierDc(12, ctx), reward: 'ally' },
        { label: 'Leave them', kind: 'leave' },
      ] };
    },
  ],
  shrine: [
    (ctx) => ({ title: 'Moonwell Shrine', text: 'A ring of white stones around a still pool that reflects stars, even by day. An offering bowl sits empty.', npc: null, choices: [
      { label: 'Pray for guidance', kind: 'check', stat: 'wis', dc: tierDc(10, ctx), reward: 'heal' },
      { label: 'Drink from the pool', kind: 'check', stat: 'con', dc: tierDc(11, ctx), reward: 'xp' },
      { label: 'Rest in the stillness', kind: 'rest' },
      { label: 'Move along', kind: 'leave' },
    ] }),
    (ctx, r) => {
      const npc = randomNpc(r, 'shrine keeper');
      return { title: 'The Keeper\'s Riddle', text: `${npc.name} tends a mossy shrine and smiles: "Answer me this, traveller: what grows the more you take from it?"`, npc, choices: [
        { label: '"A hole."', kind: 'check', stat: 'int', dc: tierDc(9, ctx), reward: 'item' },
        { label: 'Charm them for a hint', kind: 'check', stat: 'cha', dc: tierDc(11, ctx), reward: 'ally' },
        { label: 'Rest at the shrine', kind: 'rest' },
        { label: 'Shrug and leave', kind: 'leave' },
      ] };
    },
  ],
  camp: [
    (ctx) => ({ title: 'Bandit Camp', text: 'Three tents, a stewpot, and a lookout who has fallen asleep on watch. A strongbox sits by the fire.', npc: null, choices: [
      { label: 'Steal the strongbox', kind: 'check', stat: 'dex', dc: tierDc(13, ctx), reward: 'gold' },
      { label: 'Charge in', kind: 'fight', enemy: { name: 'Bandit Captain', kind: 'humanoid', emoji: '🥷' } },
      { label: 'Slip past unseen', kind: 'leave' },
    ] }),
    (ctx, r) => {
      const npc = randomNpc(r, 'deserter');
      return { title: 'A Lonely Fire', text: `${npc.name} sits alone by a campfire, sword across their knees. "Sit if you're friendly. Run if you're not."`, npc, choices: [
        { label: 'Share your rations', kind: 'check', stat: 'cha', dc: tierDc(9, ctx), reward: 'ally' },
        { label: 'Spar for sport', kind: 'check', stat: 'str', dc: tierDc(12, ctx), reward: 'xp' },
        { label: 'Keep walking', kind: 'leave' },
      ] };
    },
  ],
  tower: [
    (ctx) => ({ title: 'Wizard\'s Folly', text: 'A crooked tower leans at an impossible angle. Its door is a mouth — and it is asking for a password.', npc: null, choices: [
      { label: 'Guess the password', kind: 'check', stat: 'int', dc: tierDc(12, ctx), reward: 'item' },
      { label: 'Climb the outer wall', kind: 'check', stat: 'str', dc: tierDc(13, ctx), reward: 'gold' },
      { label: 'Flatter the door', kind: 'check', stat: 'cha', dc: tierDc(11, ctx), reward: 'lore' },
      { label: 'Leave the weird tower', kind: 'leave' },
    ] }),
    (ctx) => ({ title: 'Watchtower', text: 'An abandoned watchtower. From the top you could see far — but the stairs are half-rotten and something nests above.', npc: null, choices: [
      { label: 'Climb carefully', kind: 'check', stat: 'dex', dc: tierDc(11, ctx), reward: 'lore' },
      { label: 'Smoke out the nest', kind: 'fight', enemy: { name: 'Harpy Matron', kind: 'monster', emoji: '🦇' } },
      { label: 'Leave', kind: 'leave' },
    ] }),
  ],
  grove: [
    (ctx, r) => {
      const npc = randomNpc(r, 'druid');
      return { title: 'The Singing Grove', text: `Ancient trees hum a low note that you feel in your teeth. ${npc.name}, a druid with moss in their hair, watches you from a branch.`, npc, choices: [
        { label: 'Hum along', kind: 'check', stat: 'wis', dc: tierDc(10, ctx), reward: 'ally' },
        { label: 'Gather healing herbs', kind: 'check', stat: 'int', dc: tierDc(10, ctx), reward: 'heal' },
        { label: 'Rest beneath the boughs', kind: 'rest' },
        { label: 'Leave the grove', kind: 'leave' },
      ] };
    },
    (ctx) => ({ title: 'Fairy Ring', text: 'A perfect circle of red-capped mushrooms. Inside, the air glitters. Tiny laughter, then silence. A golden acorn rests at the centre.', npc: null, choices: [
      { label: 'Step in and take it', kind: 'check', stat: 'cha', dc: tierDc(12, ctx), reward: 'item' },
      { label: 'Leave a gift instead', kind: 'check', stat: 'wis', dc: tierDc(9, ctx), reward: 'lore' },
      { label: 'Walk around it', kind: 'leave' },
    ] }),
  ],
  stranger: [
    (ctx, r) => {
      const npc = randomNpc(r);
      return { title: 'A Stranger on the Road', text: `${npc.name}, a ${npc.role} with ${npc.look}, waves you down. "Oi! Walk with me a while? These parts aren't safe alone."`, npc, choices: [
        { label: 'Walk and talk', kind: 'check', stat: 'cha', dc: tierDc(9, ctx), reward: 'ally' },
        { label: 'Check if they\'re lying', kind: 'check', stat: 'wis', dc: tierDc(11, ctx), reward: 'xp' },
        { label: 'Politely decline', kind: 'leave' },
      ] };
    },
    (ctx, r) => {
      const npc = randomNpc(r, 'peddler');
      return { title: 'The Peddler\'s Cart', text: `A cart stuck axle-deep in mud. ${npc.name} pushes, red-faced: "Help me out and I'll make it worth your while!"`, npc, choices: [
        { label: 'Push the cart', kind: 'check', stat: 'str', dc: tierDc(11, ctx), reward: 'item' },
        { label: 'Browse their wares', kind: 'trade' },
        { label: 'Keep walking', kind: 'leave' },
      ] };
    },
    (ctx, r) => {
      const npc = randomNpc(r, 'injured scout');
      return { title: 'Blood on the Path', text: `${npc.name} slumps against a tree, clutching a wound. "Ambushed... they took my map. Please — I just need a bandage."`, npc, choices: [
        { label: 'Tend the wound', kind: 'check', stat: 'wis', dc: tierDc(10, ctx), reward: 'ally' },
        { label: 'Hunt the ambushers', kind: 'fight', enemy: { name: 'Ambusher', kind: 'humanoid', emoji: '🥷' } },
        { label: 'Leave a potion & go', kind: 'leave' },
      ] };
    },
  ],
  wild: [
    (ctx) => ({ title: 'Rope Bridge', text: 'A rope bridge sways over a ravine. Several planks are missing. The long way round would cost you hours.', npc: null, choices: [
      { label: 'Dash across', kind: 'check', stat: 'dex', dc: tierDc(11, ctx), reward: 'xp' },
      { label: 'Test each plank', kind: 'check', stat: 'wis', dc: tierDc(10, ctx), reward: 'xp' },
      { label: 'Take the long way', kind: 'leave' },
    ] }),
    (ctx) => ({ title: 'Glittering Stream', text: 'Something gold winks from the bottom of a fast, freezing stream.', npc: null, choices: [
      { label: 'Plunge in', kind: 'check', stat: 'con', dc: tierDc(11, ctx), reward: 'gold' },
      { label: 'Fish it out with a stick', kind: 'check', stat: 'dex', dc: tierDc(12, ctx), reward: 'gold' },
      { label: 'Ignore it', kind: 'leave' },
    ] }),
    (ctx) => ({ title: 'Strange Tracks', text: 'Footprints that start mid-field and end at a lonely door frame standing by itself. No walls. Just a door.', npc: null, choices: [
      { label: 'Open the door', kind: 'check', stat: 'cha', dc: tierDc(12, ctx), reward: 'item' },
      { label: 'Study it carefully', kind: 'check', stat: 'int', dc: tierDc(11, ctx), reward: 'lore' },
      { label: 'Absolutely not', kind: 'leave' },
    ] }),
    (ctx) => ({ title: 'Storm Front', text: 'Black clouds roll in fast. Lightning forks close enough to smell. You need shelter, now.', npc: null, choices: [
      { label: 'Endure it', kind: 'check', stat: 'con', dc: tierDc(11, ctx), reward: 'xp' },
      { label: 'Find shelter quickly', kind: 'check', stat: 'wis', dc: tierDc(10, ctx), reward: 'heal' },
    ] }),
    (ctx) => ({ title: 'The Talking Crow', text: 'A crow lands on a branch at eye level. "Shiny for a secret," it croaks, eyeing your coin purse.', npc: null, choices: [
      { label: 'Pay a coin', kind: 'check', stat: 'wis', dc: tierDc(8, ctx), reward: 'lore' },
      { label: 'Outwit the bird', kind: 'check', stat: 'int', dc: tierDc(12, ctx), reward: 'gold' },
      { label: 'Shoo it away', kind: 'leave' },
    ] }),
    (ctx) => ({ title: 'Abandoned Wagon', text: 'An overturned wagon, its horses long gone. Crates spill across the ground. Claw marks on the wood are fresh.', npc: null, choices: [
      { label: 'Search quickly', kind: 'check', stat: 'int', dc: tierDc(10, ctx), reward: 'item' },
      { label: 'Wait for the clawed thing', kind: 'fight' },
      { label: 'Move on', kind: 'leave' },
    ] }),
  ],
  quest: [
    (ctx) => ({ title: 'The Heart of It', text: `You've arrived. The place hums with old power, and a guardian rises from the earth to bar your way. This is what you came to ${ctx.regionName} for.`, npc: null, choices: [
      { label: 'Fight the guardian', kind: 'fight', enemy: { name: 'Ancient Guardian', kind: 'monster', emoji: '🗿' } },
      { label: 'Speak the old words', kind: 'check', stat: 'int', dc: tierDc(13, ctx), reward: 'item' },
      { label: 'Slip past while it wakes', kind: 'check', stat: 'dex', dc: tierDc(14, ctx), reward: 'item' },
    ] }),
  ],
};

export function fallbackEvent(ctx: EventContext, r: Rand = rand): GameEvent {
  const pool = POI_EVENTS[ctx.poi] ?? POI_EVENTS.wild;
  const ev = pick(pool, r)(ctx, r);
  // Fill an unspecified fight enemy from the biome table.
  for (const c of ev.choices) if (c.kind === 'fight' && !c.enemy) c.enemy = pick(ENEMIES[ctx.biome].length ? ENEMIES[ctx.biome] : ENEMIES.grass, r);
  if (ctx.returningNpc && ev.npc) {
    const n = ctx.returningNpc;
    ev.text = `"${ctx.returningNpc.name}! Fancy meeting you again." ` + ev.text.replace(ev.npc.name, n.name);
    ev.npc = { name: n.name, role: n.role, look: n.look, personality: n.personality };
  }
  return ev;
}

// --- Outcome narration ---
const OUTCOME_OK: Record<string, string[]> = {
  gold: ['Coins spill into your palm — a good haul.', 'Your purse grows heavier. Fortune favours the bold.'],
  item: ['You come away with something remarkable.', 'Among the dust, you find a treasure worth keeping.'],
  ally: ['A warm grin. You\'ve made a friend today.', 'Trust is earned — and you just earned some.'],
  heal: ['Warmth spreads through your limbs; your wounds knit.', 'You feel lighter, mended, ready.'],
  lore: ['Knowledge settles in your mind like a key into a lock. The land around you seems clearer.', 'You learn something old and useful about these lands.'],
  xp: ['You did it — and you\'re sharper for the experience.', 'Hard-won lessons stick best.'],
};
const OUTCOME_FAIL = ['It goes badly. You limp away wiser, and a little bruised.', 'Not your finest moment. Pain is an excellent teacher.', 'You stumble, and the world punishes you for it.', 'Fate laughs. You don\'t.'];
const OUTCOME_CRIT = ['A perfect, legendary moment — bards will sing of it!', 'Everything goes exactly right. Impossibly right.'];
const OUTCOME_FUMBLE = ['A catastrophe of slapstick proportions.', 'Somewhere, a god of misfortune snorts with laughter.'];

export function fallbackOutcome(reward: string | undefined, success: boolean, crit: boolean, fumble: boolean, r: Rand = rand) {
  if (crit) return pick(OUTCOME_CRIT, r) + ' ' + pick(OUTCOME_OK[reward ?? 'xp'] ?? OUTCOME_OK.xp, r);
  if (fumble) return pick(OUTCOME_FUMBLE, r) + ' ' + pick(OUTCOME_FAIL, r);
  return success ? pick(OUTCOME_OK[reward ?? 'xp'] ?? OUTCOME_OK.xp, r) : pick(OUTCOME_FAIL, r);
}

// --- Quests & premise ---
const QUESTS = [
  { title: 'The Sunken Bell', description: 'A bell tolls beneath the earth each midnight. Find where it rings.', place: 'the Bell Hollow' },
  { title: 'Ember of the First Fire', description: 'A coal that never cools is said to rest at an old hearth-shrine. Bring it back.', place: 'the Cold Hearth' },
  { title: 'The Crow King\'s Crown', description: 'The crows whisper of a crown hidden in their roosting place.', place: 'the Roost of Crows' },
  { title: 'A Map Drawn in Blood', description: 'Your torn map marks an X with a single word: "Mother".', place: 'the Marked Stone' },
  { title: 'The Hollow Saint', description: 'Pilgrims vanish on the way to a forgotten saint\'s tomb. Find out why.', place: 'the Saint\'s Tomb' },
  { title: 'Star-Iron', description: 'A falling star struck these lands. Smiths would kill for its iron.', place: 'the Starfall Crater' },
  { title: 'The Weeping Door', description: 'A door in the wilds weeps salt water. Something behind it wants out.', place: 'the Weeping Door' },
  { title: 'The Last Lighthouse', description: 'A lighthouse burns far inland where no sea has been for a thousand years.', place: 'the Inland Light' },
];

export function fallbackQuest(n: number, r: Rand = rand) {
  return { ...QUESTS[(n + Math.floor(r() * QUESTS.length)) % QUESTS.length] };
}

export const PREMISES: Record<Tone, { name: string; hook: string }[]> = {
  heroic: [
    { name: 'The Shattered Crown', hook: 'The old king is dead, his crown broken into shards and scattered across the wilds. Every shard sings to those brave enough to listen — and you, a nobody with a pack and a stubborn heart, can hear them.' },
    { name: 'Dawnmarch', hook: 'The sun has risen a little later every day for a year. Scholars are panicking. Priests are praying. You are walking out to find out why.' },
  ],
  grim: [
    { name: 'The Ashen Vale', hook: 'The plague-fires have burned out and the vale is quiet. Too quiet. You wake in a field of ash with a name on your tongue you do not recognise, and a debt someone expects you to pay.' },
    { name: 'Hollowmere', hook: 'Every night, the dead of Hollowmere walk one mile closer to the living. You have eleven nights before they reach your village. Walk fast.' },
  ],
  whimsical: [
    { name: 'The Teapot Rebellion', hook: 'The Duke\'s enchanted teapot has run away, and it took the kingdom\'s luck with it. Reward: one thousand gold and a lifetime supply of biscuits. You are very much in it for the biscuits.' },
    { name: 'Moonpie Meadows', hook: 'The moon fell into a pie contest and lost. Now it\'s sulking somewhere in the countryside, and the tides have gone completely silly. Someone has to apologise to it.' },
  ],
};

export const HOOKS = [
  'Tonight, the crows are watching your camp. Tomorrow, they may do more than watch.',
  'As the fire dies, you hear a voice on the wind say your name.',
  'Your map has changed overnight. A new mark has appeared — in someone else\'s hand.',
  'Far off, a bell rings once. Then the forest goes completely silent.',
  'You wake to footprints circling your bedroll. They aren\'t yours.',
  'A lantern bobs on the horizon, moving toward you, unhurried.',
];

export const CAMP_BANTER = [
  '{c} pokes the fire. "You know, for someone who talks to doors, you\'re alright."',
  '{c} hums an old song and refuses to tell you where they learned it.',
  '{c} counts the coins twice. "Just checking. Old habit."',
  '{c} stares at the stars. "Do you think they\'re watching us back?"',
  '{c} sharpens a blade and smiles at nothing in particular.',
];

export const AWAY_GIFTS = [
  { text: 'While you were away, a travelling tinker left a potion by your bedroll.', potions: 1 },
  { text: 'You find a few coins you forgot sewing into your boot.', gold: 8 },
  { text: 'A raven drops a note: "The road ahead is kind today." You feel inspired.', inspiration: true },
  { text: 'You slept long and deep. Every ache is gone.', heal: 999 },
];

export const ENEMY_TAUNTS = ['snarls', 'circles you warily', 'bares its teeth', 'steadies itself', 'lets out a terrible cry'];

// --- Daily omens: a small twist on each day so every session feels different ---
export interface Omen { id: string; icon: string; name: string; desc: string }
export const OMENS: Omen[] = [
  { id: 'fair-winds', icon: '🌬️', name: 'Fair Winds', desc: '+3 torches today.' },
  { id: 'blood-moon', icon: '🌕', name: 'Blood Moon', desc: 'Monsters roam more often, but foes give +50% XP.' },
  { id: 'lucky-stars', icon: '🌠', name: 'Lucky Stars', desc: 'You wake with Inspiration.' },
  { id: 'market-day', icon: '🛒', name: 'Market Day', desc: 'Prices are 30% lower everywhere.' },
  { id: 'golden-hour', icon: '🌅', name: 'Golden Hour', desc: 'Gold rewards are increased by 50%.' },
  { id: 'still-air', icon: '🍃', name: 'Still Air', desc: 'The wilds are quiet: fewer ambushes.' },
  { id: 'clear-skies', icon: '☀️', name: 'Clear Skies', desc: 'You see one hex further today.' },
];
export function omenFor(seed: number, day: number): Omen {
  return OMENS[Math.abs((seed ^ Math.imul(day, 2654435761)) >>> 0) % OMENS.length];
}
