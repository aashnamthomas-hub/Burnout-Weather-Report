// Streaks and small milestones for the share card, like the stats on a run
// summary. Built only from scores and dates, never from personal answers.

import { isGoodScores } from "./report";
import type { CheckIn, Scores } from "./types";

export type Stats = {
  /** Different days with a check-in, counting today. */
  totalDays: number;
  /** Days in a row ending today. */
  streak: number;
};

export type Achievement = { id: string; label: string; detail: string };

export const ACHIEVEMENT_RULES = {
  streaks: [3, 7, 14, 30],
  easingDays: 3,
  /** Prior days needed before "best energy" means anything. */
  bestEnergyMinDays: 4,
  bestEnergyWindowDays: 14,
} as const;

export type Today = { date: string; scores: Scores; crash: number };

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** The latest check-in of each day, oldest first. */
function latestPerDay(entries: Today[]): { key: string; time: number; entry: Today }[] {
  const byDay = new Map<string, { key: string; time: number; entry: Today }>();
  for (const entry of entries) {
    const time = Date.parse(entry?.date);
    if (!Number.isFinite(time) || !entry.scores) continue;
    const key = dayKey(new Date(time));
    const seen = byDay.get(key);
    if (!seen || time > seen.time) byDay.set(key, { key, time, entry });
  }
  return [...byDay.values()].sort((a, b) => a.time - b.time);
}

/** Consecutive-day runs ending at `end` (a day key), counting backwards. */
function runEndingAt(days: { key: string }[], end: Date): number {
  const keys = new Set(days.map((d) => d.key));
  let run = 0;
  const cursor = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (keys.has(dayKey(cursor))) {
    run += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return run;
}

export function computeStats(history: CheckIn[], today: Today, now: Date): Stats {
  const days = latestPerDay([...history, today]);
  return { totalDays: days.length, streak: runEndingAt(days, now) };
}

export function earnedAchievements(history: CheckIn[], today: Today, now: Date): Achievement[] {
  const days = latestPerDay([...history, today]);
  const todayKey = dayKey(now);
  const prior = days.filter((d) => d.key !== todayKey);
  const earned: Achievement[] = [];
  const streak = runEndingAt(days, now);

  if (prior.length === 0) {
    earned.push({ id: "first", label: "First check-in", detail: "Your first forecast is in" });
  }
  if ((ACHIEVEMENT_RULES.streaks as readonly number[]).includes(streak)) {
    earned.push({ id: `streak-${streak}`, label: `${streak} days running`, detail: "Checking in every day" });
  }

  // Pressure has fallen on each of the last few days.
  const recent = days.slice(-ACHIEVEMENT_RULES.easingDays);
  const consecutive = recent.length === ACHIEVEMENT_RULES.easingDays && runEndingAt(days, now) >= ACHIEVEMENT_RULES.easingDays;
  if (
    consecutive &&
    recent.every((d, i) => i === 0 || d.entry.scores.pressure < recent[i - 1].entry.scores.pressure)
  ) {
    earned.push({ id: "easing", label: "Pressure easing", detail: `Down ${ACHIEVEMENT_RULES.easingDays} days in a row` });
  }

  if (isGoodScores(today.scores, today.crash)) {
    earned.push({ id: "clear", label: "Clear skies", detail: "A good-weather day" });
  }

  const window = prior.slice(-ACHIEVEMENT_RULES.bestEnergyWindowDays);
  if (
    window.length >= ACHIEVEMENT_RULES.bestEnergyMinDays &&
    today.scores.energy > Math.max(...window.map((d) => d.entry.scores.energy))
  ) {
    earned.push({ id: "best-energy", label: "Best energy lately", detail: `Highest in your last ${window.length} check-ins` });
  }

  return earned;
}
