import { describe, expect, it } from "vitest";
import { earnedAchievements, computeStats, type Today } from "./achievements";
import { shareText } from "./share";
import { LIBRARY, daySeed, feelingFor, pickSuggestions } from "./suggestions";
import type { Answers, CheckIn, Scores } from "./types";

const scores = (over: Partial<Scores> = {}): Scores => ({ energy: 70, focus: 70, mood: 65, social: 70, pressure: 30, ...over });

const pickFor = (answers: Answers, s: Scores, good = false, seed = 3) =>
  pickSuggestions({ answers, scores: s, good, seed });

describe("suggestions library", () => {
  it("has about 40 suggestions with unique ids, a mix of Indian and international titles", () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(38);
    expect(new Set(LIBRARY.map((s) => s.id)).size).toBe(LIBRARY.length);
    const watch = LIBRARY.filter((s) => s.kind === "watch");
    expect(watch.some((s) => s.origin === "india")).toBe(true);
    expect(watch.some((s) => s.origin === "intl")).toBe(true);
  });
});

describe("feelingFor", () => {
  it("reads the head answer first, then mood, energy and a good day", () => {
    expect(feelingFor({ head: "flat" }, scores(), false)).toBe("flat");
    expect(feelingFor({ head: "racing" }, scores({ mood: 20 }), false)).toBe("racing");
    expect(feelingFor({}, scores({ mood: 30 }), false)).toBe("low");
    expect(feelingFor({}, scores({ energy: 30 }), false)).toBe("drained");
    expect(feelingFor({}, scores(), true)).toBe("good");
    expect(feelingFor({}, scores(), false)).toBe("steady");
  });
});

describe("pickSuggestions", () => {
  it("recommends feel-good films, one Indian and one international, plus something to do with people when mood is low", () => {
    const { feeling, items } = pickFor({}, scores({ mood: 30 }));
    expect(feeling).toBe("low");
    const watch = items.filter((s) => s.kind === "watch");
    expect(watch.map((s) => s.origin).sort()).toEqual(["india", "intl"]);
    expect(items.some((s) => s.kind === "people")).toBe(true);
    expect(items.length).toBeLessThanOrEqual(4);
    expect(items.every((s) => s.feelings.includes("low"))).toBe(true);
  });

  it("suggests calming picks for a racing head", () => {
    const { feeling, items } = pickFor({ head: "racing" }, scores());
    expect(feeling).toBe("racing");
    expect(items.every((s) => s.feelings.includes("racing"))).toBe(true);
  });

  it("only suggests people ideas that need no talking when they'd rather not talk to people", () => {
    for (let seed = 0; seed < 12; seed++) {
      const { items } = pickFor({ avoidPeople: true }, scores({ mood: 30, social: 40 }), false, seed);
      for (const s of items.filter((i) => i.kind === "people")) expect(s.quiet).toBe(true);
    }
  });

  it("varies by day but is deterministic for a given day", () => {
    const a = pickFor({}, scores({ mood: 30 }), false, 1).items.map((s) => s.id);
    const b = pickFor({}, scores({ mood: 30 }), false, 1).items.map((s) => s.id);
    const c = pickFor({}, scores({ mood: 30 }), false, 2).items.map((s) => s.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(daySeed(new Date(2026, 0, 1))).toBe(1);
  });

  it("always has something to offer for every feeling", () => {
    for (const answers of [{ head: "flat" }, { head: "racing" }, {}] as Answers[]) {
      for (const s of [scores(), scores({ mood: 20 }), scores({ energy: 20 })]) {
        expect(pickFor(answers, s).items.length).toBeGreaterThanOrEqual(2);
      }
    }
    expect(pickFor({}, scores(), true).items.length).toBeGreaterThanOrEqual(2);
  });
});

const day = (daysAgo: number, over: Partial<Scores> = {}): CheckIn => ({
  date: new Date(2026, 9, 3 - daysAgo, 9).toISOString(),
  answers: {},
  scores: scores({ pressure: 50, ...over }),
  crash: 20,
});
const now = new Date(2026, 9, 3, 18);
const todayOf = (over: Partial<Scores> = {}, crash = 20): Today => ({ date: new Date(2026, 9, 3, 17).toISOString(), scores: scores({ pressure: 50, ...over }), crash });

describe("achievements and stats", () => {
  it("counts days and the streak ending today", () => {
    expect(computeStats([], todayOf(), now)).toEqual({ totalDays: 1, streak: 1 });
    expect(computeStats([day(1), day(2), day(4)], todayOf(), now)).toEqual({ totalDays: 4, streak: 3 });
    expect(computeStats([day(1), day(1), day(1)], todayOf(), now).totalDays).toBe(2);
  });

  it("celebrates a first check-in and streak milestones", () => {
    expect(earnedAchievements([], todayOf(), now).map((a) => a.id)).toContain("first");
    expect(earnedAchievements([day(1), day(2)], todayOf(), now).map((a) => a.id)).toContain("streak-3");
    expect(earnedAchievements([day(1)], todayOf(), now).map((a) => a.id)).not.toContain("streak-3");
  });

  it("notices pressure easing over three days", () => {
    const history = [day(2, { pressure: 70 }), day(1, { pressure: 60 })];
    expect(earnedAchievements(history, todayOf({ pressure: 45 }), now).map((a) => a.id)).toContain("easing");
    expect(earnedAchievements(history, todayOf({ pressure: 65 }), now).map((a) => a.id)).not.toContain("easing");
  });

  it("only awards clear skies on a genuinely good day", () => {
    expect(earnedAchievements([day(1)], todayOf({ pressure: 20 }, 10), now).map((a) => a.id)).toContain("clear");
    expect(earnedAchievements([day(1)], todayOf({ mood: 30 }), now).map((a) => a.id)).not.toContain("clear");
  });

  it("awards best energy only against enough history", () => {
    const history = [day(4, { energy: 50 }), day(3, { energy: 55 }), day(2, { energy: 60 }), day(1, { energy: 58 })];
    expect(earnedAchievements(history, todayOf({ energy: 80 }), now).map((a) => a.id)).toContain("best-energy");
    expect(earnedAchievements(history.slice(2), todayOf({ energy: 80 }), now).map((a) => a.id)).not.toContain("best-energy");
  });

  it("ignores malformed history", () => {
    const broken = { date: "nope", answers: {}, scores: undefined, crash: 0 } as unknown as CheckIn;
    expect(computeStats([broken], todayOf(), now)).toEqual({ totalDays: 1, streak: 1 });
  });
});

describe("shareText", () => {
  it("has the headline, readings and milestones, and nothing from the answers", () => {
    const text = shareText("Clear skies. Protect your morning.", scores(), [{ id: "first", label: "First check-in", detail: "x" }], "https://example.com");
    expect(text).toBe(
      "Clear skies. Protect your morning.\nEnergy 70 · Focus 70 · Mood 65 · Social battery 70\nFirst check-in\nCheck your own weather: https://example.com",
    );
  });
});
