// Achievements: long-term goals that make even a 2-minute session feel like progress.
import { party } from './state';
import { talent } from './talents';
import type { GameState, Track } from './types';

export interface AchievementDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  check: (s: GameState, t: Track) => boolean;
  progress?: (s: GameState, t: Track) => [number, number];
}

export const LANDMARK_KINDS_TOTAL = 26;
const PASSABLE_BIOMES = 8;

export function track(s: GameState): Track {
  s.track ??= { landmarks: [], biomes: [], styles: [], omens: [], buys: 0, talks: 0, deathSaves: 0, recruits: 0, sword: false };
  return s.track;
}

/** Add a value to one of the "distinct things seen" lists. */
export function trackSeen(s: GameState, list: 'landmarks' | 'biomes' | 'styles' | 'omens', value: string) {
  const t = track(s);
  if (!t[list].includes(value)) t[list].push(value);
}

const at = (n: number, max: number): [number, number] => [Math.min(n, max), max];

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-steps', icon: '👣', name: 'First Steps', desc: 'Explore 10 hexes.', check: (s) => s.stats.explored >= 10, progress: (s) => at(s.stats.explored, 10) },
  { id: 'pathfinder', icon: '🧭', name: 'Pathfinder', desc: 'Explore 75 hexes.', check: (s) => s.stats.explored >= 75, progress: (s) => at(s.stats.explored, 75) },
  { id: 'world-walker', icon: '🗺️', name: 'World Walker', desc: 'Explore 300 hexes.', check: (s) => s.stats.explored >= 300, progress: (s) => at(s.stats.explored, 300) },
  { id: 'chapter-one', icon: '🏕️', name: 'Chapter One', desc: 'Make camp and finish your first day.', check: (s) => s.chapters.length >= 1 },
  { id: 'week', icon: '📅', name: 'A Week in the Wilds', desc: 'Reach day 7.', check: (s) => s.day >= 7, progress: (s) => at(s.day, 7) },
  { id: 'nat20', icon: '🎲', name: 'Natural 20', desc: 'Roll your first critical success.', check: (s) => s.stats.crits >= 1 },
  { id: 'lucky', icon: '🍀', name: 'Fortune\'s Favourite', desc: 'Roll 10 natural 20s.', check: (s) => s.stats.crits >= 10, progress: (s) => at(s.stats.crits, 10) },
  { id: 'snake-eyes', icon: '🐍', name: 'Snake Eyes', desc: 'Roll a natural 1. It happens to the best of us.', check: (s) => s.stats.fumbles >= 1 },
  { id: 'first-blood', icon: '⚔️', name: 'First Blood', desc: 'Win your first fight.', check: (s) => s.stats.kills >= 1 },
  { id: 'hunter', icon: '🏹', name: 'Monster Hunter', desc: 'Defeat 25 foes.', check: (s) => s.stats.kills >= 25, progress: (s) => at(s.stats.kills, 25) },
  { id: 'silver-tongue', icon: '💬', name: 'Silver Tongue', desc: 'End a fight with words instead of steel.', check: (_s, t) => t.talks >= 1 },
  { id: 'not-today', icon: '💀', name: 'Not Today', desc: 'Survive a death save.', check: (_s, t) => t.deathSaves >= 1 },
  { id: 'fellowship', icon: '🤝', name: 'Fellowship', desc: 'Welcome a companion into your party.', check: (_s, t) => t.recruits >= 1 },
  { id: 'full-party', icon: '👥', name: 'Full Party', desc: 'Travel with two companions at once.', check: (s) => party(s).length >= 2 },
  { id: 'questbearer', icon: '★', name: 'Questbearer', desc: 'Complete a quest.', check: (s) => s.questsDone >= 1 },
  { id: 'legend', icon: '👑', name: 'Living Legend', desc: 'Complete 5 quests.', check: (s) => s.questsDone >= 5, progress: (s) => at(s.questsDone, 5) },
  { id: 'seasoned', icon: '🛡️', name: 'Seasoned', desc: 'Reach level 5.', check: (s) => s.player.level >= 5, progress: (s) => at(s.player.level, 5) },
  { id: 'heroic', icon: '🌟', name: 'Heroic', desc: 'Reach level 10.', check: (s) => s.player.level >= 10, progress: (s) => at(s.player.level, 10) },
  { id: 'apex', icon: '🏔️', name: 'Apex', desc: 'Reach level 20.', check: (s) => s.player.level >= 20, progress: (s) => at(s.player.level, 20) },
  { id: 'talented', icon: '✦', name: 'Talented', desc: 'Learn your first talent.', check: (s) => (s.player.talents?.length ?? 0) >= 1 },
  { id: 'mastery', icon: '🌠', name: 'Mastery', desc: 'Learn a tier-4 talent.', check: (s) => (s.player.talents ?? []).some((t) => talent(t)?.row === 4) },
  { id: 'mentor', icon: '🎓', name: 'Mentor', desc: 'Choose a talent for a companion.', check: (_s, t) => (t.mentored ?? 0) >= 1 },
  { id: 'hoard', icon: '💰', name: 'Dragon\'s Hoard', desc: 'Hold 300 gold at once.', check: (s) => s.player.gold >= 300, progress: (s) => at(s.player.gold, 300) },
  { id: 'patron', icon: '🛒', name: 'Patron of Markets', desc: 'Buy 5 things at markets.', check: (_s, t) => t.buys >= 5, progress: (_s, t) => at(t.buys, 5) },
  { id: 'wonder-seeker', icon: '🗿', name: 'Wonder Seeker', desc: 'Discover 10 kinds of landmark.', check: (_s, t) => t.landmarks.length >= 10, progress: (_s, t) => at(t.landmarks.length, 10) },
  { id: 'wonders', icon: '🏛️', name: 'Wonders of the World', desc: `Discover all ${LANDMARK_KINDS_TOTAL} kinds of landmark.`, check: (_s, t) => t.landmarks.length >= LANDMARK_KINDS_TOTAL, progress: (_s, t) => at(t.landmarks.length, LANDMARK_KINDS_TOTAL) },
  { id: 'once-and-future', icon: '🗡️', name: 'Once and Future', desc: 'Pull the sword from the stone.', check: (_s, t) => t.sword },
  { id: 'far-traveller', icon: '🌍', name: 'Far Traveller', desc: 'Set foot in every kind of land.', check: (_s, t) => t.biomes.length >= PASSABLE_BIOMES, progress: (_s, t) => at(t.biomes.length, PASSABLE_BIOMES) },
  { id: 'connoisseur', icon: '🍂', name: 'Connoisseur of Landscapes', desc: 'Walk through 18 different terrains.', check: (_s, t) => t.styles.length >= 18, progress: (_s, t) => at(t.styles.length, 18) },
  { id: 'omen-reader', icon: '🔮', name: 'Omen Reader', desc: 'Live through 5 different omens.', check: (_s, t) => t.omens.length >= 5, progress: (_s, t) => at(t.omens.length, 5) },
];

/** Unlock anything newly earned; returns the new ones (oldest first). */
export function checkAchievements(s: GameState): AchievementDef[] {
  s.ach ??= {};
  const t = track(s);
  const fresh: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (s.ach[a.id]) continue;
    if (a.check(s, t)) {
      s.ach[a.id] = Date.now();
      fresh.push(a);
    }
  }
  return fresh;
}

export const achievementCount = (s: GameState) => Object.keys(s.ach ?? {}).length;
