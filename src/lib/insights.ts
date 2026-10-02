// One plain sentence about the week, generated from the saved check-ins.
// Rules are checked in order and the first that applies wins. No guessing:
// every sentence is backed by numbers in the data.

import { lastDays, type DayEntry } from "./days";
import { WEIGHTS } from "./forecast";
import type { CheckIn } from "./types";

export type InsightKind =
  | "none"
  | "one"
  | "pressure-rising"
  | "pressure-falling"
  | "meals"
  | "sleep"
  | "best-day"
  | "summary";

export type Insight = { kind: InsightKind; text: string };

export const INSIGHT_RULES = {
  /** Check-in days in a row needed to call a pressure trend. */
  trendDays: 3,
  /** Check-in days needed before looking for patterns. */
  patternDays: 4,
  /** A day with at least this crash probability counts as a crash day. */
  crashFrom: 50,
  minCrashDays: 2,
  /** Share of crash days with a thin meal, and the most allowed on other days. */
  mealShareOnCrashDays: 0.75,
  mealShareOnOtherDays: 0.34,
  minShortSleepDays: 2,
  /** Energy points lower on short-sleep days before it is worth saying. */
  sleepEnergyGap: 10,
} as const;

type Day = { date: Date; checkIn: CheckIn };

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

const isThinMeal = (c: CheckIn) =>
  c.answers?.mealType === "skipped" ||
  c.answers?.mealType === "coffee" ||
  c.answers?.lastMeal === "nothingYet" ||
  c.answers?.lastMeal === "6hplus";

const isShortSleep = (c: CheckIn) => c.answers?.sleep === "under5" || c.answers?.sleep === "5to6";

/** The run of consecutive days ending at the latest check-in in which pressure moves one way. */
function pressureRun(days: DayEntry[]): { direction: "rising" | "falling"; length: number } | null {
  let end = days.length - 1;
  while (end >= 0 && !days[end].checkIn) end--;
  if (end < 1) return null;

  const previous = days[end - 1].checkIn;
  if (!previous) return null;
  const direction = days[end].checkIn!.scores.pressure - previous.scores.pressure > 0 ? "rising" : "falling";

  let length = 1;
  for (let i = end; i > 0; i--) {
    const current = days[i].checkIn;
    const before = days[i - 1].checkIn;
    if (!current || !before) break;
    const step = current.scores.pressure - before.scores.pressure;
    if ((direction === "rising" && step > 0) || (direction === "falling" && step < 0)) length++;
    else break;
  }

  const first = days[end - length + 1].checkIn!.scores.pressure;
  const last = days[end].checkIn!.scores.pressure;
  if (length < INSIGHT_RULES.trendDays || Math.abs(last - first) < WEIGHTS.trend.minChange) return null;
  return { direction, length };
}

export function generateInsight(checkIns: CheckIn[], now: Date): Insight {
  const days = lastDays(checkIns, now);
  const logged: Day[] = days.filter((d): d is Day => Boolean(d.checkIn));

  if (logged.length === 0) {
    return { kind: "none", text: "Nothing recorded this week yet. Your first check-in starts the record." };
  }
  if (logged.length === 1) {
    return { kind: "one", text: "One check-in so far. Add a few more days and patterns will start to show." };
  }

  const run = pressureRun(days);
  if (run?.direction === "rising") {
    return { kind: "pressure-rising", text: `Pressure has been rising for ${run.length} days. A burnout front may be approaching.` };
  }
  if (run?.direction === "falling") {
    return { kind: "pressure-falling", text: `Pressure has been easing for ${run.length} days. Whatever you're doing is working.` };
  }

  if (logged.length >= INSIGHT_RULES.patternDays) {
    const crash = logged.filter((d) => d.checkIn.crash >= INSIGHT_RULES.crashFrom);
    const calm = logged.filter((d) => d.checkIn.crash < INSIGHT_RULES.crashFrom);
    if (crash.length >= INSIGHT_RULES.minCrashDays && calm.length > 0) {
      const onCrash = crash.filter((d) => isThinMeal(d.checkIn)).length / crash.length;
      const onCalm = calm.filter((d) => isThinMeal(d.checkIn)).length / calm.length;
      if (onCrash >= INSIGHT_RULES.mealShareOnCrashDays && onCalm <= INSIGHT_RULES.mealShareOnOtherDays) {
        return { kind: "meals", text: "Your crash days are the days you skip a proper meal." };
      }
    }

    const short = logged.filter((d) => isShortSleep(d.checkIn));
    const rested = logged.filter((d) => !isShortSleep(d.checkIn) && d.checkIn.answers?.sleep);
    if (short.length >= INSIGHT_RULES.minShortSleepDays && rested.length > 0) {
      const gap = mean(rested.map((d) => d.checkIn.scores.energy)) - mean(short.map((d) => d.checkIn.scores.energy));
      if (gap >= INSIGHT_RULES.sleepEnergyGap) {
        return { kind: "sleep", text: `On short-sleep days your energy runs about ${gap} points lower.` };
      }
    }

    const best = logged.reduce((a, b) => (b.checkIn.scores.energy > a.checkIn.scores.energy ? b : a));
    const weekday = best.date.toLocaleDateString("en-GB", { weekday: "long" });
    return { kind: "best-day", text: `Your best day this week was ${weekday}, with energy at ${best.checkIn.scores.energy}.` };
  }

  const avg = (key: "energy" | "focus" | "pressure") => mean(logged.map((d) => d.checkIn.scores[key]));
  return {
    kind: "summary",
    text: `So far this week: energy averaging ${avg("energy")}, focus ${avg("focus")}, burnout pressure ${avg("pressure")}.`,
  };
}
