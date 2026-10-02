// The text that goes with a shared forecast. Only the headline, the four
// readings and public milestones: never answers, calendar or cycle information.

import type { Achievement } from "./achievements";
import type { Scores } from "./types";

export function shareText(headline: string, scores: Scores, achievements: Achievement[], url?: string): string {
  const readings = `Energy ${scores.energy} · Focus ${scores.focus} · Mood ${scores.mood} · Social battery ${scores.social}`;
  const lines = [`${headline}`, readings];
  if (achievements.length > 0) lines.push(achievements.slice(0, 3).map((a) => a.label).join(" · "));
  lines.push(url ? `Check your own weather: ${url}` : "Check your own weather before you plan the day.");
  return lines.join("\n");
}
