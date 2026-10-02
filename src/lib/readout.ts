// Turns "scores before" and "scores after" the latest answer into what the live
// readout shows: how far each score moved, and which rules moved it.

import type { ScoreResult } from "./forecast";
import type { ScoreKey, Scores } from "./types";

export const SCORE_NAMES: Record<ScoreKey, string> = {
  energy: "energy",
  focus: "focus",
  mood: "mood",
  social: "social battery",
  pressure: "pressure",
};

const KEYS: ScoreKey[] = ["energy", "focus", "mood", "social", "pressure"];

export type Change = {
  /** After minus before, for every score. */
  deltas: Scores;
  /** One line per rule the latest answer set off, e.g. "Slept under 5 hours: energy -16, focus -14". */
  reasons: string[];
};

export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `-${Math.abs(n)}` : "0");

export function describeChange(before: ScoreResult, after: ScoreResult): Change {
  const deltas = Object.fromEntries(
    KEYS.map((k) => [k, after.scores[k] - before.scores[k]]),
  ) as Scores;

  const reasons: string[] = [];
  for (const rule of after.rules) {
    if (rule.id.startsWith("crash.")) continue;
    const previous = before.rules.find((r) => r.id === rule.id);
    const changed = !previous || KEYS.some((k) => (previous.delta[k] ?? 0) !== (rule.delta[k] ?? 0));
    if (!changed) continue;
    const parts = KEYS.filter((k) => rule.delta[k]).map(
      (k) => `${SCORE_NAMES[k]} ${signed(rule.delta[k] ?? 0)}`,
    );
    if (parts.length > 0) reasons.push(`${rule.label}: ${parts.join(", ")}`);
  }
  return { deltas, reasons };
}
