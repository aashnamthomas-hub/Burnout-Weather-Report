import { describe, expect, it } from "vitest";
import { lastDays } from "./days";
import { generateInsight } from "./insights";
import { sampleWeek } from "./sample";
import type { Answers, CheckIn, Scores } from "./types";

const now = new Date(2026, 9, 3, 18); // Saturday 3 October 2026

const day = (daysAgo: number, over: Partial<Scores> = {}, answers: Answers = {}, crash = 20): CheckIn => ({
  date: new Date(2026, 9, 3 - daysAgo, 9).toISOString(),
  answers,
  scores: { energy: 60, focus: 60, mood: 60, social: 60, pressure: 40, ...over },
  crash,
});

describe("lastDays", () => {
  it("returns seven days ending today, keeping gaps and using the latest check-in of a day", () => {
    const early = day(0, { energy: 10 });
    const late = { ...day(0, { energy: 99 }), date: new Date(2026, 9, 3, 17).toISOString() };
    const days = lastDays([early, late, day(2)], now);
    expect(days).toHaveLength(7);
    expect(days[6].checkIn?.scores.energy).toBe(99);
    expect(days[4].checkIn).toBeDefined();
    expect(days[5].checkIn).toBeUndefined();
  });
});

describe("generateInsight", () => {
  it("handles an empty week and a single check-in", () => {
    expect(generateInsight([], now).kind).toBe("none");
    expect(generateInsight([day(0)], now).kind).toBe("one");
  });

  it("says when pressure has been rising for several days", () => {
    const week = [day(3, { pressure: 30 }), day(2, { pressure: 42 }), day(1, { pressure: 55 }), day(0, { pressure: 70 })];
    expect(generateInsight(week, now)).toEqual({
      kind: "pressure-rising",
      text: "Pressure has been rising for 4 days. A burnout front may be approaching.",
    });
  });

  it("says when pressure has been easing", () => {
    const week = [day(3, { pressure: 80 }), day(2, { pressure: 65 }), day(1, { pressure: 50 }), day(0, { pressure: 35 })];
    const insight = generateInsight(week, now);
    expect(insight.kind).toBe("pressure-falling");
    expect(insight.text).toContain("easing for 4 days");
  });

  it("does not call a trend from tiny changes, a gap in the days, or two days", () => {
    expect(generateInsight([day(2, { pressure: 40 }), day(1, { pressure: 42 }), day(0, { pressure: 44 })], now).kind).not.toMatch(/pressure/);
    const gap = [day(4, { pressure: 20 }), day(3, { pressure: 40 }), day(1, { pressure: 60 }), day(0, { pressure: 80 })];
    expect(generateInsight(gap, now).kind).not.toBe("pressure-rising");
    expect(generateInsight([day(1, { pressure: 20 }), day(0, { pressure: 80 })], now).kind).toBe("summary");
  });

  it("connects crash days to skipped meals", () => {
    const week = [
      day(4, { pressure: 40 }, { mealType: "balanced" }, 15),
      day(3, { pressure: 45 }, { mealType: "skipped" }, 70),
      day(2, { pressure: 40 }, { mealType: "balanced" }, 20),
      day(1, { pressure: 44 }, { lastMeal: "nothingYet" }, 75),
      day(0, { pressure: 40 }, { mealType: "balanced" }, 25),
    ];
    expect(generateInsight(week, now)).toEqual({ kind: "meals", text: "Your crash days are the days you skip a proper meal." });
  });

  it("does not blame meals when crash days and calm days both skip them", () => {
    const week = [
      day(3, { pressure: 40 }, { mealType: "skipped" }, 15),
      day(2, { pressure: 45 }, { mealType: "skipped" }, 70),
      day(1, { pressure: 40 }, { mealType: "skipped" }, 20),
      day(0, { pressure: 44 }, { mealType: "skipped" }, 75),
    ];
    expect(generateInsight(week, now).kind).not.toBe("meals");
  });

  it("notices lower energy after short sleep", () => {
    const week = [
      day(3, { energy: 40 }, { sleep: "under5" }),
      day(2, { energy: 70 }, { sleep: "7to8" }),
      day(1, { energy: 42 }, { sleep: "5to6" }),
      day(0, { energy: 68 }, { sleep: "8plus" }),
    ];
    expect(generateInsight(week, now)).toEqual({ kind: "sleep", text: "On short-sleep days your energy runs about 28 points lower." });
  });

  it("names the best day when there are no stronger patterns", () => {
    const week = [day(3, { energy: 55 }), day(2, { energy: 80 }), day(1, { energy: 60 }), day(0, { energy: 58 })];
    expect(generateInsight(week, now)).toEqual({ kind: "best-day", text: "Your best day this week was Thursday, with energy at 80." });
  });

  it("falls back to a short summary with only a few days", () => {
    const insight = generateInsight([day(2, { energy: 50 }), day(0, { energy: 70 })], now);
    expect(insight).toEqual({ kind: "summary", text: "So far this week: energy averaging 60, focus 60, burnout pressure 40." });
  });

  it("ignores check-ins older than a week and malformed ones", () => {
    const broken = { date: "nope", answers: {}, scores: undefined, crash: 0 } as unknown as CheckIn;
    expect(generateInsight([day(20), day(15), broken], now).kind).toBe("none");
  });
});

describe("sampleWeek", () => {
  it("makes seven sample check-ins ending today with scores from the real engine", () => {
    const week = sampleWeek(now);
    expect(week).toHaveLength(7);
    expect(week.every((c) => c.sample)).toBe(true);
    expect(lastDays(week, now).every((d) => d.checkIn)).toBe(true);
    expect(week[6].scores.energy).toBeGreaterThan(week[3].scores.energy);
    expect(week[3].crash).toBeGreaterThanOrEqual(50);
  });

  it("tells a story worth reading", () => {
    const insight = generateInsight(sampleWeek(now), now);
    expect(["pressure-falling", "meals", "sleep"]).toContain(insight.kind);
  });
});
