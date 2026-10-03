import { describe, expect, it } from "vitest";
import { sampleCalendar } from "./calendar";
import { computeScores, meetingsBucket, WEIGHTS } from "./forecast";
import type { Answers, CalendarSummary } from "./types";

const at = (hour: number) => new Date(2026, 9, 3, hour, 0);

describe("cycle score adjustments", () => {
  const base = computeScores({}, [], at(9)).scores;

  it("adds nothing when there are no cycle answers", () => {
    const result = computeScores({ profile: "desk" }, [], at(9));
    expect(result.rules.filter((r) => r.id.startsWith("cycle"))).toEqual([]);
  });

  it("applies the exact points for each answer (energy, focus, mood, social, pressure)", () => {
    const cases: [Answers, number[]][] = [
      [{ cycle: "period", flow: "light" }, [-3, 0, -2, 0, 0]],
      [{ cycle: "period", flow: "heavy" }, [-10, -4, -3, 0, 4]],
      [{ cycle: "period", cramps: "strong" }, [-8, -8, -5, -5, 5]],
      [{ cycle: "pms" }, [-4, -3, -8, -6, 3]],
      [{ cycle: "between" }, [0, 0, 0, 0, 0]],
      [{ cycle: "unsure" }, [0, 0, 0, 0, 0]],
      [{ cycle: "period", flow: "medium", cramps: "mild" }, [0, 0, 0, 0, 0]],
    ];
    for (const [answers, [e, f, m, s, p]] of cases) {
      const { scores } = computeScores(answers, [], at(9));
      expect(scores).toEqual({
        energy: base.energy + e,
        focus: base.focus + f,
        mood: base.mood + m,
        social: base.social + s,
        pressure: base.pressure + p,
      });
    }
  });

  it("stacks heavy flow with strong cramps and lists every adjustment as a rule", () => {
    const result = computeScores({ cycle: "period", flow: "heavy", cramps: "strong" }, [], at(9));
    expect(result.scores.energy).toBe(base.energy - 18);
    expect(result.rules.map((r) => r.id)).toEqual(["cycle.flow.heavy", "cycle.cramps.strong"]);
    expect(result.rules.map((r) => r.label)).toEqual(["Heavy flow", "Strong cramps or pain"]);
  });

  it("keeps the values in WEIGHTS", () => {
    expect(WEIGHTS.cycle.phase.pms).toEqual({ energy: -4, focus: -3, mood: -8, social: -6, pressure: 3 });
  });
});

describe("calendar score adjustments", () => {
  it("buckets the meeting count like the manual question", () => {
    expect([0, 1, 2, 3, 5, 6, 9].map(meetingsBucket)).toEqual(["0", "1to2", "1to2", "3to5", "3to5", "6plus", "6plus"]);
  });

  it("stands in for the manual meetings answer", () => {
    const { summary } = sampleCalendar(new Date(2026, 9, 3));
    const fromCalendar = computeScores({ calendar: summary }, [], at(9));
    const manual = computeScores({ meetings: "6plus" }, [], at(9));
    expect(fromCalendar.rules.find((r) => r.id === "meetings.6plus")).toBeDefined();
    // The same six-meeting day, plus the back-to-back run on top.
    expect(fromCalendar.scores.social).toBeLessThan(manual.scores.social);
    expect(fromCalendar.scores.pressure).toBeGreaterThan(manual.scores.pressure);
  });

  it("raises pressure and lowers social battery for longer back-to-back runs, up to a limit", () => {
    const withRun = (longestRunMinutes: number): CalendarSummary => ({
      source: "ics", count: 3, allDay: 0, totalMinutes: longestRunMinutes, longestRunMinutes,
      longestRunStart: 600, longestRunEnd: 600 + longestRunMinutes, blocks: [{ start: 600, end: 600 + longestRunMinutes }], gaps: [], firstStart: 600, freeBeforeFirst: 60,
    });
    const at0 = computeScores({ calendar: withRun(60) }, [], at(9)).scores;
    const at2h = computeScores({ calendar: withRun(180) }, [], at(9)).scores;
    const at4h = computeScores({ calendar: withRun(300) }, [], at(9)).scores;
    const at8h = computeScores({ calendar: withRun(480) }, [], at(9)).scores;
    expect(at2h.pressure).toBeGreaterThan(at0.pressure);
    expect(at2h.social).toBeLessThan(at0.social);
    expect(at4h.pressure).toBeGreaterThan(at2h.pressure);
    expect(at8h).toEqual(at4h); // capped
    const rule = computeScores({ calendar: withRun(135) }, [], at(9)).rules.find((r) => r.id === "calendar.backToBack");
    expect(rule?.label).toBe("Back-to-back meetings for 2 h 15 min");
  });

  it("prefers a manual meetings answer over the calendar count so nothing is double counted", () => {
    const { summary } = sampleCalendar(new Date(2026, 9, 3));
    const rules = computeScores({ calendar: summary, meetings: "1to2" }, [], at(9)).rules.map((r) => r.id);
    expect(rules).toContain("meetings.1to2");
    expect(rules).not.toContain("meetings.6plus");
  });
});
