// Helpers for looking at saved check-ins one day at a time, in local time.

import type { CheckIn } from "./types";

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export type DayEntry = {
  /** Local midnight of the day. */
  date: Date;
  /** The latest check-in of that day, if there is one. */
  checkIn?: CheckIn;
};

/**
 * The last `days` days ending today, oldest first. Days without a check-in are
 * kept (with no `checkIn`) so charts can show gaps honestly.
 */
export function lastDays(checkIns: CheckIn[], now: Date, days = 7): DayEntry[] {
  const latest = new Map<string, { time: number; checkIn: CheckIn }>();
  for (const checkIn of checkIns) {
    const time = Date.parse(checkIn?.date);
    if (!Number.isFinite(time) || !checkIn.scores) continue;
    const key = dayKey(new Date(time));
    const seen = latest.get(key);
    if (!seen || time > seen.time) latest.set(key, { time, checkIn });
  }

  const entries: DayEntry[] = [];
  for (let back = days - 1; back >= 0; back--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    entries.push({ date, checkIn: latest.get(dayKey(date))?.checkIn });
  }
  return entries;
}
