// A made-up week for "Load sample week", so the chart can be seen populated
// straight away. Scores come from the real forecast engine, not hand-typed numbers.

import { computeScores } from "./forecast";
import type { Answers, CheckIn } from "./types";

type Day = { hour: number; answers: Answers };

const BASE: Answers = { profile: "desk", caffeine: "1", caffeineTiming: "beforeNoon", water: "1to3" };

// A busy week: a calm start, a meeting-heavy middle, and a recovery at the end.
const WEEK: Day[] = [
  { hour: 9, answers: { sleep: "7to8", wake: "okay", lastMeal: "within2h", mealType: "balanced", movement: "today", meetings: "1to2", head: "clear", water: "4plus" } },
  { hour: 9, answers: { sleep: "6to7", wake: "okay", lastMeal: "2to4h", mealType: "carbs", movement: "yesterday", meetings: "3to5", head: "busy" } },
  { hour: 10, answers: { sleep: "5to6", wake: "groggy", lastMeal: "4to6h", mealType: "skipped", movement: "2to3days", meetings: "6plus", head: "busy" } },
  { hour: 15, answers: { sleep: "under5", wake: "wrecked", lastMeal: "nothingYet", caffeine: "3plus", caffeineTiming: "afterNoon", movement: "cantRemember", meetings: "6plus", head: "racing", water: "none" } },
  { hour: 10, answers: { sleep: "6to7", wake: "groggy", lastMeal: "6hplus", mealType: "coffee", movement: "2to3days", meetings: "3to5", head: "foggy" } },
  { hour: 9, answers: { sleep: "7to8", wake: "okay", lastMeal: "within2h", mealType: "balanced", movement: "today", meetings: "1to2", head: "clear" } },
  { hour: 9, answers: { sleep: "8plus", lastMeal: "within2h", mealType: "balanced", movement: "today", meetings: "0", head: "clear", water: "4plus" } },
];

/** Seven check-ins ending today, each marked `sample`. */
export function sampleWeek(now: Date): CheckIn[] {
  const history: CheckIn[] = [];
  WEEK.forEach((day, i) => {
    const when = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (WEEK.length - 1 - i), day.hour, 15);
    const answers = { ...BASE, ...day.answers };
    const { scores, crash } = computeScores(answers, history, when);
    history.push({ sample: true, date: when.toISOString(), answers, scores, crash });
  });
  return history;
}
