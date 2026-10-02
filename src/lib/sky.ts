// Maps the five internal-weather scores onto visual sky parameters.
// Pure and framework-free so the mapping can be tested and tuned in one place.

export type SkyState = {
  energy: number; // 0-100, low dims the sun
  focus: number; // 0-100, low brings fog
  mood: number; // 0-100, low greys the sky
  social: number; // 0-100, low speeds up clouds and wind
  pressure: number; // 0-100, high builds storm clouds (higher is worse)
  racing?: boolean; // a racing head also whips up the wind
};

/** Every value is 0-1. */
export type SkyParams = {
  sun: number;
  fog: number;
  wind: number;
  storm: number;
  rain: number;
  gloom: number;
  cover: number;
  stars: number;
};

export const BASELINE_SKY: SkyState = {
  energy: 70,
  focus: 70,
  mood: 65,
  social: 70,
  pressure: 30,
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Linear ramp: 0 at `from`, 1 at `to` (works in either direction). */
const ramp = (value: number, from: number, to: number) =>
  clamp01((value - from) / (to - from));

export function deriveSky(state: SkyState): SkyParams {
  const sun = clamp01(0.15 + 0.85 * ramp(state.energy, 0, 100));
  const fog = ramp(state.focus, 65, 10);
  const wind = Math.max(ramp(state.social, 70, 10), state.racing ? 0.8 : 0);
  const storm = ramp(state.pressure, 45, 90);
  const rain = ramp(storm, 0.55, 1);
  const gloom = ramp(state.mood, 60, 10);
  const cover = clamp01(0.15 + 0.45 * gloom + 0.4 * storm + 0.15 * wind);
  const stars = clamp01((1 - fog) * (1 - storm) * (1 - 0.7 * cover));
  return { sun, fog, wind, storm, rain, gloom, cover, stars };
}

/** Above this storm level the sky is dark enough that text over it flips to light ink. */
export const DARK_SKY_STORM = 0.55;
