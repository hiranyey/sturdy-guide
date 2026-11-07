// Weather: each region gets a front for the day (calm, wet, stormy, misty, gusty,
// hot), and each tile's terrain turns the front into what you actually see:
// a wet front is rain on the plains but snow on the peaks; a storm over the
// desert is a sandstorm-like gale. Deterministic from the world seed, the day
// and the region, so it's the same after reloading and changes every morning.
import { hashString, mulberry32 } from './rng';
import { biomeAt, regionKey } from './world';
import type { Hex } from './hex';
import type { Biome } from './types';

export type Weather = 'clear' | 'rain' | 'storm' | 'snow' | 'fog' | 'heat' | 'wind';
type Front = 'calm' | 'wet' | 'storm' | 'mist' | 'gusty' | 'hot';

export const WEATHER_INFO: Record<Weather, { icon: string; name: string; prompt: string; arrive: string }> = {
  clear: { icon: '☀️', name: 'Clear skies', prompt: 'clear weather', arrive: 'The clouds part and the sky clears.' },
  rain: { icon: '🌧️', name: 'Rain', prompt: 'steady rain', arrive: 'Rain begins to patter on your hood.' },
  storm: { icon: '⛈️', name: 'Thunderstorm', prompt: 'a thunderstorm: lashing rain, wind and lightning', arrive: 'Thunder growls. A storm rolls in.' },
  snow: { icon: '🌨️', name: 'Snowfall', prompt: 'falling snow', arrive: 'Snow starts to drift down around you.' },
  fog: { icon: '🌫️', name: 'Fog', prompt: 'thick fog that hides what is ahead', arrive: 'Fog creeps in, swallowing the path ahead.' },
  heat: { icon: '🥵', name: 'Heatwave', prompt: 'baking heat and shimmering air', arrive: 'The air shimmers with heat.' },
  wind: { icon: '🌬️', name: 'High winds', prompt: 'strong gusting wind', arrive: 'The wind picks up, tugging at your cloak.' },
};

const FRONTS: [Front, number][] = [['calm', 40], ['wet', 18], ['storm', 7], ['mist', 13], ['gusty', 10], ['hot', 12]];

const COLD: Biome[] = ['snow', 'mountain'];
const HOT: Biome[] = ['desert', 'sand', 'grass'];

/** What a front looks like on a given terrain. */
export function weatherFor(front: Front, biome: Biome): Weather {
  const cold = COLD.includes(biome), desert = biome === 'desert';
  switch (front) {
    case 'calm': return 'clear';
    case 'wet': return cold ? 'snow' : desert ? 'clear' : 'rain';
    case 'storm': return cold ? 'snow' : desert ? 'wind' : 'storm';
    case 'mist': return desert ? 'heat' : 'fog';
    case 'gusty': return 'wind';
    case 'hot': return HOT.includes(biome) ? 'heat' : 'clear';
  }
}

/** The day's front over a region. The first morning is always calm. */
export function frontAt(seed: number, day: number, hx: Hex): Front {
  if (day <= 1) return 'calm';
  const r = mulberry32(hashString(`${seed}:${day}:${regionKey(hx)}`));
  let roll = r() * FRONTS.reduce((a, [, w]) => a + w, 0);
  for (const [f, w] of FRONTS) if ((roll -= w) < 0) return f;
  return 'calm';
}

/** Weather on a tile today. */
export function weatherAt(seed: number, day: number, hx: Hex): Weather {
  return weatherFor(frontAt(seed, day, hx), biomeAt(hx, seed));
}
