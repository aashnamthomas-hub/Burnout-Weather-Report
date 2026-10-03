// Calendar awareness, done privately: a small hand-written .ics parser and the
// maths that turns one day of events into numbers (meeting count, hours, longest
// back-to-back run, free gaps). Nothing here talks to a network. Event titles
// are returned to the caller but are never part of the stored summary.

import type { CalendarSummary } from "./types";

export type CalendarEvent = {
  start: Date;
  end: Date;
  allDay: boolean;
  title?: string;
};

export const CALENDAR_RULES = {
  /** The working day starts here, for "free window before the first meeting". */
  workStartMinutes: 9 * 60,
  /** Free time shorter than this isn't worth naming as a gap. */
  minGapMinutes: 15,
  /** Meetings this close together count as back to back. */
  backToBackSlackMinutes: 5,
  /** Refuse files bigger than this. */
  maxFileBytes: 2_000_000,
  /** Safety limit when counting recurrences day by day. */
  maxRecurrenceDays: 4000,
} as const;

/* ---------- Formatting ---------- */

/** Minutes since midnight as "9:30 AM". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/** 135 -> "2 h 15 min", 60 -> "1 h", 45 -> "45 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/* ---------- Reading dates ---------- */

// Outlook writes Windows time zone names; map the common ones to IANA names.
const WINDOWS_ZONES: Record<string, string> = {
  "India Standard Time": "Asia/Kolkata",
  "UTC": "UTC",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  "GMT Standard Time": "Europe/London",
  "W. Europe Standard Time": "Europe/Berlin",
  "Central Europe Standard Time": "Europe/Budapest",
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "Pacific Standard Time": "America/Los_Angeles",
  "Singapore Standard Time": "Asia/Singapore",
  "China Standard Time": "Asia/Shanghai",
  "Tokyo Standard Time": "Asia/Tokyo",
  "AUS Eastern Standard Time": "Australia/Sydney",
  "Arab Standard Time": "Asia/Riyadh",
  "Arabian Standard Time": "Asia/Dubai",
};

/** The instant at which a wall-clock time happens in a named time zone, or null if the zone is unknown. */
function zonedToDate(y: number, mo: number, d: number, h: number, mi: number, s: number, zone: string): Date | null {
  const name = WINDOWS_ZONES[zone] ?? zone;
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: name,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    const wanted = Date.UTC(y, mo - 1, d, h, mi, s);
    let guess = wanted;
    // Two passes settle the offset, including across a daylight saving change.
    for (let i = 0; i < 2; i++) {
      const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((p) => [p.type, Number(p.value)]));
      const shown = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
      guess += wanted - shown;
    }
    return new Date(guess);
  } catch {
    return null;
  }
}

type ParsedDate = { date: Date; allDay: boolean };

function parseDateValue(value: string, params: Record<string, string>): ParsedDate | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (m[4] === undefined || params.VALUE === "DATE") return { date: new Date(y, mo - 1, d), allDay: true };
  const [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6])];
  if (m[7]) return { date: new Date(Date.UTC(y, mo - 1, d, h, mi, s)), allDay: false };
  if (params.TZID) {
    const zoned = zonedToDate(y, mo, d, h, mi, s, params.TZID);
    if (zoned) return { date: zoned, allDay: false };
  }
  // No zone given (a "floating" time): it means the viewer's own local time.
  return { date: new Date(y, mo - 1, d, h, mi, s), allDay: false };
}

function parseDuration(value: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m) return null;
  const ms = ((Number(m[2] ?? 0) * 7 + Number(m[3] ?? 0)) * 86400 + Number(m[4] ?? 0) * 3600 + Number(m[5] ?? 0) * 60 + Number(m[6] ?? 0)) * 1000;
  return m[1] === "-" ? -ms : ms;
}

/* ---------- Reading lines ---------- */

type Prop = { name: string; params: Record<string, string>; value: string };

function parseLine(line: string): Prop | null {
  let colon = -1;
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ":" && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon < 1) return null;
  const [name, ...rest] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const p of rest) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

const unescapeText = (s: string) => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");

type RawEvent = {
  uid?: string;
  title?: string;
  start?: ParsedDate;
  end?: ParsedDate;
  durationMs?: number | null;
  rrule?: string;
  exdates: ParsedDate[];
  recurrenceId?: ParsedDate;
  cancelled: boolean;
  free: boolean;
};

function readEvents(text: string): RawEvent[] {
  // Long lines are folded: a line starting with a space or tab continues the one before.
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events: RawEvent[] = [];
  let current: RawEvent | null = null;
  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      current = { exdates: [], cancelled: false, free: false };
      continue;
    }
    if (upper === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const prop = parseLine(line);
    if (!prop) continue;
    switch (prop.name) {
      case "UID": current.uid = prop.value.trim(); break;
      case "SUMMARY": current.title = unescapeText(prop.value).trim(); break;
      case "DTSTART": current.start = parseDateValue(prop.value, prop.params) ?? undefined; break;
      case "DTEND": current.end = parseDateValue(prop.value, prop.params) ?? undefined; break;
      case "DURATION": current.durationMs = parseDuration(prop.value); break;
      case "RRULE": current.rrule = prop.value; break;
      case "EXDATE":
        for (const v of prop.value.split(",")) {
          const d = parseDateValue(v, prop.params);
          if (d) current.exdates.push(d);
        }
        break;
      case "RECURRENCE-ID": current.recurrenceId = parseDateValue(prop.value, prop.params) ?? undefined; break;
      case "STATUS": current.cancelled = prop.value.trim().toUpperCase() === "CANCELLED"; break;
      case "TRANSP": current.free = prop.value.trim().toUpperCase() === "TRANSPARENT"; break;
    }
  }
  return events;
}

/* ---------- Repeating events ---------- */

type Rule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count?: number;
  until?: Date;
  byDay: number[];
  byMonthDay: number[];
};

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function parseRule(value: string): Rule | null {
  const parts = Object.fromEntries(
    value.split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k?.toUpperCase(), v ?? ""];
    }),
  );
  const freq = parts.FREQ;
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") return null;
  const until = parts.UNTIL ? parseDateValue(parts.UNTIL, {}) : null;
  return {
    freq,
    interval: Math.max(1, Number(parts.INTERVAL) || 1),
    count: parts.COUNT ? Number(parts.COUNT) : undefined,
    // A date-only UNTIL means "through the end of that day".
    until: until ? (until.allDay ? new Date(until.date.getFullYear(), until.date.getMonth(), until.date.getDate() + 1) : until.date) : undefined,
    byDay: (parts.BYDAY ?? "")
      .split(",")
      .map((d) => WEEKDAYS.indexOf(d.replace(/^[+-]?\d+/, "")))
      .filter((d) => d >= 0),
    byMonthDay: (parts.BYMONTHDAY ?? "").split(",").map(Number).filter((n) => n > 0),
  };
}

const dateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const dayNumber = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
const mondayNumber = (d: Date) => dayNumber(d) - ((d.getDay() + 6) % 7);

/** Does the repeating rule have an occurrence on `day` (a local date)? Counts day by day, so COUNT is exact. */
function occursOn(rule: Rule, start: Date, day: Date): boolean {
  const first = dateOnly(start);
  if (day < first) return false;

  const matches = (d: Date): boolean => {
    const diff = dayNumber(d) - dayNumber(first);
    switch (rule.freq) {
      case "DAILY":
        return diff % rule.interval === 0;
      case "WEEKLY": {
        const days = rule.byDay.length ? rule.byDay : [start.getDay()];
        return days.includes(d.getDay()) && ((mondayNumber(d) - mondayNumber(first)) / 7) % rule.interval === 0;
      }
      case "MONTHLY": {
        const months = (d.getFullYear() - first.getFullYear()) * 12 + d.getMonth() - first.getMonth();
        const days = rule.byMonthDay.length ? rule.byMonthDay : [first.getDate()];
        return months % rule.interval === 0 && days.includes(d.getDate());
      }
      case "YEARLY":
        return (d.getFullYear() - first.getFullYear()) % rule.interval === 0 && d.getMonth() === first.getMonth() && d.getDate() === first.getDate();
    }
  };

  const withinLimits = (d: Date) => !rule.until || d.getTime() < rule.until.getTime();
  if (!matches(day) || !withinLimits(day)) return false;
  if (rule.count === undefined) return true;

  let seen = 0;
  const cursor = new Date(first);
  for (let i = 0; i < CALENDAR_RULES.maxRecurrenceDays && cursor <= day; i++) {
    if (matches(cursor)) seen++;
    if (seen > rule.count) return false;
    cursor.setDate(cursor.getDate() + 1);
  }
  return seen <= rule.count;
}

/* ---------- Public: one day of events ---------- */

export type ParseResult = { events: CalendarEvent[]; error?: string };

/** The events that happen on `day` (a local date), with repeats expanded and cancelled events left out. */
export function eventsForDay(icsText: string, day: Date): ParseResult {
  if (!/BEGIN:VCALENDAR/i.test(icsText)) {
    return { events: [], error: "That doesn't look like a calendar (.ics) file." };
  }
  const dayStart = dateOnly(day);
  const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);
  const raw = readEvents(icsText);

  // An edited occurrence of a repeating event replaces the original on that date.
  const replaced = new Set(raw.filter((e) => e.uid && e.recurrenceId).map((e) => `${e.uid}|${dayKey(e.recurrenceId!.date)}`));

  const events: CalendarEvent[] = [];
  for (const e of raw) {
    if (!e.start || e.cancelled || e.free) continue;
    const allDay = e.start.allDay;
    const length =
      e.end ? e.end.date.getTime() - e.start.date.getTime()
      : e.durationMs != null ? e.durationMs
      : allDay ? 86_400_000
      : 0;
    if (length <= 0) continue;

    let start = e.start.date;
    if (e.rrule && !e.recurrenceId) {
      const rule = parseRule(e.rrule);
      if (!rule || !occursOn(rule, e.start.date, dayStart)) continue;
      if (e.exdates.some((x) => dayKey(x.date) === dayKey(dayStart))) continue;
      if (e.uid && replaced.has(`${e.uid}|${dayKey(dayStart)}`)) continue;
      // Same wall-clock time on the day in question.
      start = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), e.start.date.getHours(), e.start.date.getMinutes(), e.start.date.getSeconds());
    }
    const end = new Date(start.getTime() + length);
    if (start >= dayEnd || end <= dayStart) continue;
    events.push({ start, end, allDay, title: e.title });
  }
  return { events: events.sort((a, b) => a.start.getTime() - b.start.getTime()) };
}

/* ---------- Public: numbers for a day ---------- */

const minutesOfDay = (d: Date, dayStart: Date) => Math.round((d.getTime() - dayStart.getTime()) / 60_000);

type Span = { start: number; end: number };

/** Joins spans that overlap or sit within `slack` minutes of each other. */
function merge(spans: Span[], slack: number): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end + slack) last.end = Math.max(last.end, s.end);
    else out.push({ ...s });
  }
  return out;
}

/** Counts, hours, the longest back-to-back run and the free gaps for one day. All-day events are counted but not treated as meetings. */
export function summariseDay(events: CalendarEvent[], day: Date, source: CalendarSummary["source"]): CalendarSummary {
  const dayStart = dateOnly(day);
  const timed = events.filter((e) => !e.allDay);
  const spans: Span[] = timed.map((e) => ({
    start: Math.max(0, minutesOfDay(e.start, dayStart)),
    end: Math.min(24 * 60, minutesOfDay(e.end, dayStart)),
  }));

  const busy = merge(spans, 0);
  const runs = merge(spans, CALENDAR_RULES.backToBackSlackMinutes);
  const longest = runs.reduce<Span | null>((best, r) => (!best || r.end - r.start > best.end - best.start ? r : best), null);

  const gaps: Span[] = [];
  for (let i = 1; i < busy.length; i++) {
    if (busy[i].start - busy[i - 1].end >= CALENDAR_RULES.minGapMinutes) {
      gaps.push({ start: busy[i - 1].end, end: busy[i].start });
    }
  }

  const firstStart = busy.length ? busy[0].start : null;
  return {
    source,
    count: timed.length,
    allDay: events.length - timed.length,
    totalMinutes: busy.reduce((sum, b) => sum + (b.end - b.start), 0),
    blocks: busy,
    longestRunMinutes: longest ? longest.end - longest.start : 0,
    longestRunStart: longest ? longest.start : null,
    longestRunEnd: longest ? longest.end : null,
    gaps,
    firstStart,
    freeBeforeFirst: firstStart === null ? 0 : Math.max(0, firstStart - CALENDAR_RULES.workStartMinutes),
  };
}

/** Reads an .ics file's text and summarises one day, returning the events too (titles stay in memory only). */
export function readCalendar(icsText: string, day: Date): { summary: CalendarSummary; events: CalendarEvent[] } | { error: string } {
  const { events, error } = eventsForDay(icsText, day);
  if (error) return { error };
  return { summary: summariseDay(events, day, "ics"), events };
}

/* ---------- Demo day ---------- */

/** A realistic demo: six meetings, a short gap at midday, and a back-to-back run in the afternoon. Always works. */
export function sampleCalendar(day: Date): { summary: CalendarSummary; events: CalendarEvent[] } {
  const at = (h: number, m: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
  const events: CalendarEvent[] = [
    { title: "Team standup", start: at(9, 30), end: at(10, 0), allDay: false },
    { title: "Sprint planning", start: at(11, 0), end: at(12, 0), allDay: false },
    { title: "Design review", start: at(12, 30), end: at(13, 0), allDay: false },
    { title: "Client sync", start: at(14, 0), end: at(14, 45), allDay: false },
    { title: "Roadmap review", start: at(14, 45), end: at(15, 30), allDay: false },
    { title: "1:1 with manager", start: at(15, 30), end: at(16, 15), allDay: false },
  ];
  return { summary: summariseDay(events, day, "sample"), events };
}
