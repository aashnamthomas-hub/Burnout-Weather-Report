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

/* ---------- Cycle: when to gently suggest mentioning something to a doctor ---------- */

export const CYCLE_SAFETY = {
  /** Heavy flow on this many check-ins in a row. */
  heavyInARow: 3,
  /** Strong pain on at least this many of the last few check-ins. */
  strongPainCount: 3,
  strongPainWindow: 5,
} as const;

export const CYCLE_NOTES = {
  strongPain: "Severe or worsening period pain is worth checking with a doctor.",
  heavyFlow: "Heavy flow on three check-ins in a row is worth mentioning to a doctor, if you haven't already.",
  repeatedPain: "Strong period pain has come up several times lately. Many people find it helps to mention that to a doctor.",
} as const;

/**
 * Gentle notes about the cycle answers. Uses only what the person has answered:
 * today's answers plus their earlier check-ins. Never predicts or diagnoses.
 */
export function cycleNotes(history: CheckIn[], today: { flow?: string; cramps?: string }): string[] {
  const earlier = [...history]
    .filter((c) => Number.isFinite(Date.parse(c?.date)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .map((c) => c.answers ?? {});
  const series = [...earlier, today];

  const notes: string[] = [];
  if (today.cramps === "strong") notes.push(CYCLE_NOTES.strongPain);

  const lastHeavy = series.slice(-CYCLE_SAFETY.heavyInARow);
  if (lastHeavy.length === CYCLE_SAFETY.heavyInARow && lastHeavy.every((a) => a.flow === "heavy")) {
    notes.push(CYCLE_NOTES.heavyFlow);
  }

  const recent = series.slice(-CYCLE_SAFETY.strongPainWindow);
  if (today.cramps === "strong" && recent.filter((a) => a.cramps === "strong").length >= CYCLE_SAFETY.strongPainCount) {
    notes.push(CYCLE_NOTES.repeatedPain);
  }
  return notes;
}
