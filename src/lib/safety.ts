// Gentle, non-diagnostic support note. It only reads the saved scores; it never
// labels what someone is going through, and it never gives medical advice.

import { consecutiveDaysBefore } from "./questions";
import type { CheckIn, Scores } from "./types";

export const SAFETY_RULES = {
  /** Mood at or below this counts as very low. */
  veryLowMood: 30,
  /** Or a low mood together with very low energy. */
  lowMood: 40,
  veryLowEnergy: 30,
  /** Days in a row, today included. */
  days: 3,
} as const;

export const isVeryLowDay = (scores: Scores | undefined): boolean =>
  Boolean(scores) &&
  Number.isFinite(scores!.mood) &&
  (scores!.mood <= SAFETY_RULES.veryLowMood ||
    (scores!.mood <= SAFETY_RULES.lowMood && scores!.energy <= SAFETY_RULES.veryLowEnergy));

/** True when today and the days before it make a run of very low days. */
export function needsSupportNote(history: CheckIn[], today: Scores, now: Date): boolean {
  if (!isVeryLowDay(today)) return false;
  const before = consecutiveDaysBefore(history, now, (c) => isVeryLowDay(c.scores));
  return before + 1 >= SAFETY_RULES.days;
}

export const SUPPORT_NOTE = {
  title: "A gentle note",
  body: "The last few days have looked heavy. That's worth taking seriously, and you don't have to carry it alone. Consider talking to someone you trust, or a professional, about how you've been feeling.",
  urgent: "If you ever feel unsafe, please contact your local emergency services or a helpline in your area.",
} as const;
