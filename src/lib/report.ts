// Turns scores into the forecast page: a headline, a four-block day strip,
// the barometer reading and an optional storm warning. Pure and tested.
// Presentation thresholds live in REPORT; scoring numbers stay in WEIGHTS.

import type { ScoreResult } from "./forecast";
import { partOfDay, type PartOfDay } from "./questions";
import type { Answers, Scores, Trend } from "./types";

/** "day": before noon, forecast the whole day. "now": noon to 6 PM. "tonight": 6 PM onward. */
export type Mode = "day" | "now" | "tonight";

export const REPORT = {
  conditions: { stormyPressure: 70, foggyFocus: 45, overcastMood: 45, dimEnergy: 45, windySocial: 40 },
  good: { minScore: 60, maxPressure: 40, maxCrash: 40 },
  /** The crash shows in the headline from here, and turns red from `alarmFrom`. */
  crashShownFrom: 40,
  crashAlarmFrom: 50,
  /** The dip is centred at `latest` for a low crash probability and slides to `earliest` at the cap. */
  dip: { earliest: 12, latest: 15, cap: 95, width: 1.3, energyDepth: 0.35, focusDepth: 0.3 },
  // Offsets from the day's score by hour (linear in between): the natural rise and the afternoon slump.
  circadianEnergy: [[6, -4], [9, 4], [11, 4], [13, -2], [15, -6], [17, -3], [20, -5], [22, -10]],
  circadianFocus: [[6, -4], [9, 6], [11, 6], [13, -1], [15, -5], [17, -3], [20, -8], [22, -12]],
  storm: { pressure: 65, crash: 70, energy: 35, mood: 35 },
  barometer: { changeFrom: 40, stormyFrom: 70 },
  samplesPerBlock: 7,
} as const;

export type BlockId = "morning" | "midday" | "afternoon" | "evening";

const BLOCKS: { id: BlockId; label: string; start: number; end: number }[] = [
  { id: "morning", label: "Morning", start: 6, end: 12 },
  { id: "midday", label: "Midday", start: 12, end: 15 },
  { id: "afternoon", label: "Afternoon", start: 15, end: 18 },
  { id: "evening", label: "Evening", start: 18, end: 22 },
];

export type DayBlock = {
  id: BlockId;
  label: string;
  range: string;
  startHour: number;
  endHour: number;
  status: "past" | "now" | "later";
  /** Sampled across the block, 0-100. */
  energy: number[];
  focus: number[];
  avgEnergy: number;
  avgFocus: number;
  /** Hour of the predicted dip when it falls inside this block. */
  dipHour?: number;
  warning?: string;
};

export type Report = {
  mode: Mode;
  good: boolean;
  headline: string;
  /** One plain sentence: the lowest reading and what pulled it down most. */
  summary: string;
  blocks: DayBlock[];
  /** Hour of the predicted dip (24h), or null when it has passed or doesn't apply. */
  crashHour: number | null;
  pressure: {
    value: number;
    trend: Trend;
    zone: "Fair" | "Change" | "Stormy";
    note: string;
  };
  stormWarning: string | null;
  tomorrowNote: string | null;
};

export const clock12 = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 && hour < 24 ? "PM" : "AM"}`;

export function modeFor(now: Date): Mode {
  const part: PartOfDay = partOfDay(now);
  return part === "morning" ? "day" : part === "afternoon" ? "now" : "tonight";
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function interpolate(table: readonly (readonly [number, number])[], hour: number): number {
  if (hour <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [h1, v1] = table[i];
    const [h0, v0] = table[i - 1];
    if (hour <= h1) return v0 + ((v1 - v0) * (hour - h0)) / (h1 - h0);
  }
  return table[table.length - 1][1];
}

/** Centre of the predicted dip: a higher crash probability moves it earlier. */
export function dipCentre(crash: number): number {
  const { earliest, latest, cap } = REPORT.dip;
  return Math.round(latest - ((latest - earliest) * clamp(crash, 0, cap)) / cap);
}

function curveAt(
  base: number,
  table: readonly (readonly [number, number])[],
  depthPerCrash: number,
  crash: number,
  hour: number,
): number {
  const dip = depthPerCrash * crash * Math.exp(-(((hour - dipCentre(crash)) / REPORT.dip.width) ** 2));
  return clamp(Math.round(base + interpolate(table, hour) - dip), 0, 100);
}

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

export function isGoodDay(result: ScoreResult): boolean {
  return isGoodScores(result.scores, result.crash);
}

export function isGoodScores(scores: Scores, crash: number): boolean {
  const { minScore, maxPressure, maxCrash } = REPORT.good;
  return (
    Math.min(scores.energy, scores.focus, scores.mood, scores.social) >= minScore &&
    scores.pressure <= maxPressure &&
    crash < maxCrash
  );
}

function conditionWords(result: ScoreResult): string[] {
  const { scores } = result;
  const c = REPORT.conditions;
  const words: string[] = [];
  if (scores.pressure >= c.stormyPressure) words.push("stormy");
  if (scores.focus < c.foggyFocus) words.push("foggy");
  if (scores.mood < c.overcastMood) words.push("overcast");
  if (scores.energy < c.dimEnergy) words.push("dim");
  if (scores.social < c.windySocial) words.push("windy");
  return words.slice(0, 2);
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function buildHeadline(
  result: ScoreResult,
  mode: Mode,
  good: boolean,
  crashHour: number | null,
  answers: Answers,
): string {
  const words = conditionWords(result);
  const period = mode === "day" ? "morning" : mode === "now" ? "afternoon" : "evening";

  if (mode === "tonight") {
    const tomorrow = answers.tomorrow === "packed" ? ", tomorrow looks heavy" : "";
    if (good) return "Clear skies tonight. Protect your sleep.";
    if (words.length === 0) return `Partly cloudy evening${tomorrow}. Wind down early.`;
    return `${capitalise(words.join(" and "))} evening${tomorrow}`;
  }

  if (good) {
    return mode === "day" ? "Clear skies. Protect your morning." : "Clear skies. Keep the afternoon steady.";
  }

  const crashClause =
    crashHour !== null && result.crash >= REPORT.crashShownFrom
      ? `, ${result.crash}% chance of a ${clock12(crashHour)} crash`
      : "";
  if (words.length === 0) return crashClause ? `Partly cloudy${crashClause}` : "Partly cloudy. Pace yourself.";
  return `${capitalise(words.join(" and "))} ${period}${crashClause}`;
}

function buildSummary(result: ScoreResult, good: boolean): string {
  if (good) return "All four readings are in a comfortable range.";
  const { scores } = result;
  const named: [string, number][] = [
    ["Energy", scores.energy],
    ["Focus", scores.focus],
    ["Mood", scores.mood],
    ["Social battery", scores.social],
  ];
  const [lowName, lowValue] = named.reduce((a, b) => (b[1] < a[1] ? b : a));

  // The rule that cost the most across the four readings, minus any added pressure.
  const cost = (r: ScoreResult["rules"][number]) =>
    (r.delta.energy ?? 0) + (r.delta.focus ?? 0) + (r.delta.mood ?? 0) + (r.delta.social ?? 0) - (r.delta.pressure ?? 0);
  const worst = result.rules
    .filter((r) => !r.id.startsWith("crash."))
    .reduce<(typeof result.rules)[number] | null>((a, b) => (!a || cost(b) < cost(a) ? b : a), null);

  const drag = worst && cost(worst) < 0 ? ` Biggest drag: ${worst.label.charAt(0).toLowerCase()}${worst.label.slice(1)}.` : "";
  return `Lowest reading: ${lowName.toLowerCase()} at ${lowValue}.${drag}`;
}

function buildStormWarning(result: ScoreResult, mode: Mode, crashHour: number | null): string | null {
  const { scores, crash } = result;
  const s = REPORT.storm;
  if (scores.pressure >= s.pressure) {
    return mode === "tonight"
      ? "Avoid big decisions or tense conversations tonight."
      : "Avoid big decisions or tense conversations after 4 PM.";
  }
  if (crash >= s.crash && crashHour !== null) {
    return `Expect a hard dip around ${clock12(crashHour)}. Don't schedule anything demanding then.`;
  }
  if (scores.energy < s.energy && scores.focus < s.energy) {
    return "Low visibility today: double-check anything important before you send it.";
  }
  if (scores.mood < s.mood) {
    return "Mood is running low. Keep decisions small and skip the doom-scrolling.";
  }
  return null;
}

function buildTomorrowNote(answers: Answers, result: ScoreResult, mode: Mode): string | null {
  if (mode !== "tonight") return null;
  const parts: string[] = [];
  if (answers.tomorrow === "packed") parts.push("Tomorrow looks packed, so tonight's sleep matters.");
  else if (answers.tomorrow === "light") parts.push("Tomorrow looks light, so there's no need to push tonight.");
  if (answers.screens === "likely") parts.push("Screens before bed will make it harder to switch off.");
  if (result.flags.eveningSleepWarning) parts.push("Caffeine after noon may cost you some sleep.");
  return parts.length ? parts.join(" ") : null;
}

export function buildReport(
  answers: Answers,
  result: ScoreResult,
  historyCount: number,
  now: Date,
): Report {
  const mode = modeFor(now);
  const hour = now.getHours() + now.getMinutes() / 60;
  const good = isGoodDay(result);
  const centre = dipCentre(result.crash);

  // Once the dip hour has passed (or the day is winding down) there is nothing left to warn about.
  const crashHour = mode === "tonight" ? null : Math.max(centre, Math.floor(hour) + 1);
  const upcomingCrash = crashHour !== null && crashHour <= 17 ? crashHour : null;

  const blocks: DayBlock[] = BLOCKS.map(({ id, label, start, end }) => {
    const hours = Array.from(
      { length: REPORT.samplesPerBlock },
      (_, i) => start + ((end - start) * i) / (REPORT.samplesPerBlock - 1),
    );
    const energy = hours.map((h) => curveAt(result.scores.energy, REPORT.circadianEnergy, REPORT.dip.energyDepth, result.crash, h));
    const focus = hours.map((h) => curveAt(result.scores.focus, REPORT.circadianFocus, REPORT.dip.focusDepth, result.crash, h));
    const showDip = result.crash >= REPORT.crashShownFrom && centre >= start && centre < end;
    return {
      id,
      label,
      range: `${clock12(start)}-${clock12(end)}`,
      startHour: start,
      endHour: end,
      status: hour >= end ? "past" : hour >= start ? "now" : "later",
      energy,
      focus,
      avgEnergy: mean(energy),
      avgFocus: mean(focus),
      dipHour: showDip ? centre : undefined,
      warning:
        id === "evening" && result.flags.eveningSleepWarning
          ? "Caffeine after noon: tonight's sleep may suffer."
          : undefined,
    };
  });

  const value = result.scores.pressure;
  const zone = value >= REPORT.barometer.stormyFrom ? "Stormy" : value >= REPORT.barometer.changeFrom ? "Change" : "Fair";
  const trendNote =
    result.trend === "Rising"
      ? "Climbing across your recent check-ins."
      : result.trend === "Falling"
        ? "Easing across your recent check-ins."
        : historyCount < 2
          ? "A trend appears after a few check-ins."
          : "Holding level across your recent check-ins.";

  return {
    mode,
    good,
    headline: buildHeadline(result, mode, good, upcomingCrash, answers),
    summary: buildSummary(result, good),
    blocks,
    crashHour: upcomingCrash,
    pressure: { value, trend: result.trend, zone, note: trendNote },
    stormWarning: good ? null : buildStormWarning(result, mode, upcomingCrash),
    tomorrowNote: buildTomorrowNote(answers, result, mode),
  };
}

/** The whole day as (hour, value) points, for charts that span the four blocks. */
export function dayCurve(blocks: DayBlock[], key: "energy" | "focus"): [number, number][] {
  const points: [number, number][] = [];
  for (const block of blocks) {
    const values = block[key];
    values.forEach((value, i) => {
      if (i === 0 && points.length > 0) return; // the block boundary is already there
      points.push([block.startHour + ((block.endHour - block.startHour) * i) / (values.length - 1), value]);
    });
  }
  return points;
}
