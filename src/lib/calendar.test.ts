import { describe, expect, it } from "vitest";
import { eventsForDay, formatDuration, formatMinutes, readCalendar, sampleCalendar, summariseDay, type CalendarEvent } from "./calendar";

// A Saturday, so weekly rules below are easy to read.
const day = new Date(2026, 9, 3);
const at = (h: number, m = 0) => new Date(2026, 9, 3, h, m);
const timed = (sh: number, sm: number, eh: number, em: number, title?: string): CalendarEvent => ({
  start: at(sh, sm),
  end: at(eh, em),
  allDay: false,
  title,
});

const ics = (...events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//EN", ...events, "END:VCALENDAR"].join("\r\n");
const vevent = (...lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");

describe("summariseDay", () => {
  it("handles an empty day", () => {
    expect(summariseDay([], day, "ics")).toEqual({
      source: "ics",
      count: 0,
      allDay: 0,
      totalMinutes: 0,
      longestRunMinutes: 0,
      longestRunStart: null,
      longestRunEnd: null,
      blocks: [],
      gaps: [],
      firstStart: null,
      freeBeforeFirst: 0,
    });
  });

  it("counts an all-day event separately and does not treat it as a meeting", () => {
    const allDay: CalendarEvent = { start: at(0), end: new Date(2026, 9, 4), allDay: true, title: "Public holiday" };
    const summary = summariseDay([allDay, timed(10, 0, 11, 0)], day, "ics");
    expect(summary.count).toBe(1);
    expect(summary.allDay).toBe(1);
    expect(summary.totalMinutes).toBe(60);
    expect(summariseDay([allDay], day, "ics").count).toBe(0);
  });

  it("counts overlapping meetings once in the total, but each one in the count", () => {
    const summary = summariseDay([timed(10, 0, 11, 0), timed(10, 30, 11, 30), timed(10, 15, 10, 45)], day, "ics");
    expect(summary.count).toBe(3);
    expect(summary.totalMinutes).toBe(90);
    expect(summary.longestRunMinutes).toBe(90);
    expect(summary.gaps).toEqual([]);
  });

  it("finds free gaps of 15 minutes or more, with times, and ignores shorter ones", () => {
    const summary = summariseDay([timed(9, 30, 10, 0), timed(10, 10, 11, 0), timed(11, 30, 12, 0), timed(14, 0, 15, 0)], day, "ics");
    expect(summary.gaps).toEqual([
      { start: 11 * 60, end: 11 * 60 + 30 },
      { start: 12 * 60, end: 14 * 60 },
    ]);
    expect(summary.firstStart).toBe(9 * 60 + 30);
    expect(summary.freeBeforeFirst).toBe(30);
  });

  it("finds the longest back-to-back run", () => {
    const summary = summariseDay([timed(9, 0, 9, 30), timed(14, 0, 14, 45), timed(14, 45, 15, 30), timed(15, 32, 16, 15)], day, "ics");
    expect(summary.longestRunMinutes).toBe(135);
    expect(summary.longestRunStart).toBe(14 * 60);
    expect(summary.longestRunEnd).toBe(16 * 60 + 15);
  });

  it("reports no free window when the first meeting starts before the working day", () => {
    expect(summariseDay([timed(8, 0, 9, 0)], day, "ics").freeBeforeFirst).toBe(0);
  });
});

describe("sampleCalendar", () => {
  it("is a realistic day: six meetings, a short midday gap, a back-to-back afternoon", () => {
    const { summary, events } = sampleCalendar(day);
    expect(events).toHaveLength(6);
    expect(summary.source).toBe("sample");
    expect(summary.count).toBe(6);
    expect(summary.gaps).toContainEqual({ start: 12 * 60, end: 12 * 60 + 30 });
    expect(summary.longestRunMinutes).toBe(135);
    expect(summary.longestRunStart).toBe(14 * 60);
  });

  it("works for any date", () => {
    expect(sampleCalendar(new Date(2027, 1, 28)).summary.count).toBe(6);
  });
});

describe("eventsForDay (.ics parsing)", () => {
  it("rejects text that isn't a calendar", () => {
    expect(eventsForDay("hello", day).error).toMatch(/calendar/);
  });

  it("reads floating local times, titles and folded, escaped text", () => {
    const text = ics(
      vevent("UID:1", "DTSTART:20261003T093000", "DTEND:20261003T100000", "SUMMARY:Planning\\, part one", " continued"),
    );
    const { events } = eventsForDay(text, day);
    expect(events).toHaveLength(1);
    expect(events[0].start.getHours()).toBe(9);
    expect(events[0].title).toBe("Planning, part onecontinued");
  });

  it("reads UTC times", () => {
    const text = ics(vevent("UID:2", "DTSTART:20261003T043000Z", "DTEND:20261003T053000Z", "SUMMARY:Call"));
    const instant = new Date(Date.UTC(2026, 9, 3, 4, 30));
    const { events } = eventsForDay(text, instant);
    expect(events[0].start.toISOString()).toBe("2026-10-03T04:30:00.000Z");
    expect(events[0].end.toISOString()).toBe("2026-10-03T05:30:00.000Z");
  });

  it("reads times in a named time zone, including Outlook's Windows names", () => {
    const iana = ics(vevent("UID:3", "DTSTART;TZID=Asia/Kolkata:20261003T093000", "DTEND;TZID=Asia/Kolkata:20261003T103000"));
    const windows = ics(vevent("UID:4", "DTSTART;TZID=India Standard Time:20261003T093000", "DTEND;TZID=India Standard Time:20261003T103000"));
    const instant = new Date(Date.UTC(2026, 9, 3, 4, 0));
    expect(eventsForDay(iana, instant).events[0].start.toISOString()).toBe("2026-10-03T04:00:00.000Z");
    expect(eventsForDay(windows, instant).events[0].start.toISOString()).toBe("2026-10-03T04:00:00.000Z");
  });

  it("reads all-day events and durations", () => {
    const text = ics(
      vevent("UID:5", "DTSTART;VALUE=DATE:20261003", "DTEND;VALUE=DATE:20261004", "SUMMARY:Holiday"),
      vevent("UID:6", "DTSTART:20261003T140000", "DURATION:PT1H30M", "SUMMARY:Workshop"),
    );
    const { events } = eventsForDay(text, day);
    expect(events.map((e) => e.allDay)).toEqual([true, false]);
    const workshop = events.find((e) => e.title === "Workshop")!;
    expect(workshop.end.getTime() - workshop.start.getTime()).toBe(90 * 60_000);
  });

  it("ignores cancelled events and events on other days", () => {
    const text = ics(
      vevent("UID:7", "DTSTART:20261003T090000", "DTEND:20261003T100000", "STATUS:CANCELLED"),
      vevent("UID:8", "DTSTART:20261004T090000", "DTEND:20261004T100000"),
      vevent("UID:9", "DTSTART:20261003T110000", "DTEND:20261003T120000", "TRANSP:TRANSPARENT"),
    );
    expect(eventsForDay(text, day).events).toEqual([]);
  });

  it("expands daily and weekly repeats for today's date", () => {
    const text = ics(
      vevent("UID:10", "DTSTART:20260928T090000", "DTEND:20260928T093000", "RRULE:FREQ=DAILY", "SUMMARY:Standup"),
      vevent("UID:11", "DTSTART:20260928T150000", "DTEND:20260928T160000", "RRULE:FREQ=WEEKLY;BYDAY=MO,SA", "SUMMARY:Weekly sync"),
      vevent("UID:12", "DTSTART:20260928T170000", "DTEND:20260928T180000", "RRULE:FREQ=WEEKLY;BYDAY=MO", "SUMMARY:Mondays only"),
    );
    const titles = eventsForDay(text, day).events.map((e) => e.title);
    expect(titles).toEqual(["Standup", "Weekly sync"]);
  });

  it("respects INTERVAL, COUNT, UNTIL and EXDATE", () => {
    const text = ics(
      vevent("UID:13", "DTSTART:20260929T090000", "DTEND:20260929T100000", "RRULE:FREQ=DAILY;INTERVAL=2", "SUMMARY:Every other day"),
      vevent("UID:14", "DTSTART:20260929T110000", "DTEND:20260929T120000", "RRULE:FREQ=DAILY;COUNT=3", "SUMMARY:Three times"),
      vevent("UID:15", "DTSTART:20260929T130000", "DTEND:20260929T140000", "RRULE:FREQ=DAILY;COUNT=5", "SUMMARY:Five times"),
      vevent("UID:16", "DTSTART:20260929T150000", "DTEND:20260929T160000", "RRULE:FREQ=DAILY;UNTIL=20261002T235959", "SUMMARY:Ended"),
      vevent("UID:17", "DTSTART:20260929T170000", "DTEND:20260929T180000", "RRULE:FREQ=DAILY", "EXDATE:20261003T170000", "SUMMARY:Skipped today"),
    );
    // Oct 3 is 4 days after Sep 29: every-other-day hits; the third daily occurrence was Oct 1.
    expect(eventsForDay(text, day).events.map((e) => e.title)).toEqual(["Every other day", "Five times"]);
  });

  it("lets an edited occurrence replace the original on that date", () => {
    const text = ics(
      vevent("UID:20", "DTSTART:20260928T090000", "DTEND:20260928T100000", "RRULE:FREQ=DAILY", "SUMMARY:Standup"),
      vevent("UID:20", "RECURRENCE-ID:20261003T090000", "DTSTART:20261003T110000", "DTEND:20261003T113000", "SUMMARY:Standup (moved)"),
    );
    const { events } = eventsForDay(text, day);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Standup (moved)");
    expect(events[0].start.getHours()).toBe(11);
  });

  it("turns a whole file into a summary without keeping titles in it", () => {
    const text = ics(
      vevent("UID:30", "DTSTART:20261003T100000", "DTEND:20261003T110000", "SUMMARY:Secret project review"),
      vevent("UID:31", "DTSTART:20261003T110000", "DTEND:20261003T120000", "SUMMARY:Salary discussion"),
    );
    const result = readCalendar(text, day);
    expect("summary" in result).toBe(true);
    if ("summary" in result) {
      expect(result.summary.count).toBe(2);
      expect(result.summary.longestRunMinutes).toBe(120);
      expect(JSON.stringify(result.summary)).not.toMatch(/Secret|Salary/);
    }
  });
});

describe("formatting", () => {
  it("formats times and durations", () => {
    expect(formatMinutes(9 * 60 + 30)).toBe("9:30 AM");
    expect(formatMinutes(0)).toBe("12:00 AM");
    expect(formatMinutes(12 * 60)).toBe("12:00 PM");
    expect(formatMinutes(15 * 60 + 5)).toBe("3:05 PM");
    expect(formatDuration(135)).toBe("2 h 15 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(45)).toBe("45 min");
  });
});
