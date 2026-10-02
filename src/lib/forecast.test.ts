import { describe, expect, it } from "vitest";
import { computeScores, WEIGHTS, type RuleHit } from "./forecast";
import type { Answers, CheckIn, ScoreKey } from "./types";

// Local-time dates so hour-of-day rules behave the same in any timezone.
const at = (hour: number, minute = 0) => new Date(2026, 9, 3, hour, minute);

const ruleIds = (rules: RuleHit[]) => rules.map((r) => r.id);

const checkIn = (daysAgo: number, pressure: number): CheckIn => ({
  date: new Date(2026, 9, 3 - daysAgo, 9).toISOString(),
  answers: {},
  scores: { energy: 60, focus: 60, mood: 60, social: 60, pressure },
  crash: 10,
});

describe("computeScores", () => {
  it("returns the baselines when nothing has been answered", () => {
    const result = computeScores({}, [], at(9));
    expect(result.scores).toEqual(WEIGHTS.baseline);
    expect(result.crash).toBe(WEIGHTS.crash.baseline);
    expect(result.trend).toBe("Steady");
    expect(result.rules).toEqual([]);
    expect(result.flags.eveningSleepWarning).toBe(false);
  });

  it("scores a rough desk morning exactly", () => {
    const answers: Answers = {
      profile: "desk",
      sleep: "5to6",
      wake: "groggy",
      lastMeal: "nothingYet",
      water: "none",
      caffeine: "2",
      caffeineTiming: "beforeNoon",
      movement: "2to3days",
      meetings: "3to5",
      head: "busy",
    };
    const result = computeScores(answers, [], at(9));

    // Energy 70 -12 sleep -6 groggy -3 nothing yet (morning) -6 no water +4 coffee -5 movement (x1.25 desk)
    expect(result.scores).toEqual({ energy: 42, focus: 46, mood: 48, social: 55, pressure: 52 });
    expect(result.crash).toBe(25); // baseline 10 + short sleep 15
    expect(result.flags.eveningSleepWarning).toBe(false);
    expect(result.rules.find((r) => r.id === "movement.2to3days")?.label).toContain("desk day");
  });

  it("treats an empty stomach as much worse after 11 AM, and as a crash risk after noon", () => {
    const morning = computeScores({ lastMeal: "nothingYet" }, [], at(10, 30));
    expect(morning.scores.energy).toBe(67);
    expect(morning.scores.focus).toBe(70);
    expect(morning.crash).toBe(10);

    const lateMorning = computeScores({ lastMeal: "nothingYet" }, [], at(11, 30));
    expect(lateMorning.scores).toMatchObject({ energy: 56, focus: 56 });
    expect(lateMorning.crash).toBe(10);

    const afternoon = computeScores({ lastMeal: "nothingYet" }, [], at(15));
    expect(afternoon.scores).toMatchObject({ energy: 56, focus: 56 });
    expect(afternoon.crash).toBe(40);
    expect(ruleIds(afternoon.rules)).toContain("crash.nothingAfterNoon");
  });

  it("builds crash probability only from its rules", () => {
    const result = computeScores(
      { sleep: "under5", wake: "wrecked", lastMeal: "4to6h", mealType: "carbs" },
      [],
      at(14),
    );
    // Energy 70 -16 -10 -8 -6 = 30, so the low-energy rule fires too.
    expect(result.scores.energy).toBe(30);
    expect(result.crash).toBe(10 + 20 + 15 + 15 + 10);
    expect(ruleIds(result.rules).filter((id) => id.startsWith("crash."))).toEqual([
      "crash.meal4to6h",
      "crash.sugarOrCoffee",
      "crash.shortSleep",
      "crash.lowEnergy",
    ]);
  });

  it("caps crash probability at 95 and clamps every score to 0-100", () => {
    const worst: Answers = {
      profile: "training",
      sleep: "under5",
      wake: "wrecked",
      lastMeal: "6hplus",
      mealType: "coffee",
      water: "none",
      caffeine: "3plus",
      caffeineTiming: "afterNoon",
      movement: "cantRemember",
      training: "brutal",
      head: "flat",
      avoidPeople: true,
    };
    const history = [checkIn(3, 30), checkIn(2, 50), checkIn(1, 70)];
    const result = computeScores(worst, history, at(16));

    for (const value of Object.values(result.scores)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    expect(result.scores.energy).toBe(0);
    expect(result.crash).toBeLessThanOrEqual(95);

    const best = computeScores(
      { sleep: "8plus", wake: "rested", mealType: "balanced", water: "4plus", caffeine: "2", movement: "today", head: "clear" },
      [],
      at(9),
    );
    expect(best.scores.energy).toBe(70 + 3 + 3 + 3 + 2 + 4 + 3);
    expect(best.crash).toBe(10);
  });

  it("matches baseline plus the sum of fired rules when nothing is clamped", () => {
    const answers: Answers = {
      profile: "study",
      sleep: "6to7",
      lastMeal: "2to4h",
      mealType: "snack",
      water: "1to3",
      caffeine: "1",
      deadlines: "2",
      head: "racing",
    };
    const result = computeScores(answers, [], at(10));
    const keys: ScoreKey[] = ["energy", "focus", "mood", "social", "pressure"];
    for (const key of keys) {
      const sum = result.rules.reduce((s, r) => s + (r.delta[key] ?? 0), 0);
      expect(result.scores[key]).toBe(WEIGHTS.baseline[key] + sum);
    }
    // Racing head counts 1.25x on a study day: focus -12 -> -15.
    expect(result.rules.find((r) => r.id === "head.racing")?.delta.focus).toBe(-15);
  });

  it("weights fuel more heavily on a training day", () => {
    const answers: Answers = { lastMeal: "4to6h", mealType: "carbs", water: "none" };
    const plain = computeScores(answers, [], at(10));
    const training = computeScores({ ...answers, profile: "training" }, [], at(10));
    // Plain: -8 -6 -6 = -20. Training: -10 -8 -9 = -27 (half rounds away from zero).
    expect(plain.scores.energy).toBe(50);
    expect(training.scores.energy).toBe(43);
  });

  it("flags evening sleep only when there was caffeine after noon", () => {
    expect(computeScores({ caffeine: "1", caffeineTiming: "afterNoon" }, [], at(15)).flags.eveningSleepWarning).toBe(true);
    expect(computeScores({ caffeine: "1", caffeineTiming: "beforeNoon" }, [], at(15)).flags.eveningSleepWarning).toBe(false);
    expect(computeScores({ caffeine: "none", caffeineTiming: "afterNoon" }, [], at(15)).flags.eveningSleepWarning).toBe(false);
  });

  it("applies 3+ cups of caffeine as a small energy bump with focus and social costs", () => {
    const result = computeScores({ caffeine: "3plus" }, [], at(10));
    expect(result.scores).toMatchObject({ energy: 72, focus: 68, social: 67 });
  });

  it("only lowers social battery for meetings and avoiding people", () => {
    const result = computeScores({ meetings: "6plus", avoidPeople: true }, [], at(9));
    expect(result.scores).toMatchObject({ focus: 65, social: 30, pressure: 50 });
  });

  describe("trend", () => {
    it("is Rising when pressure climbed over recent check-ins", () => {
      const result = computeScores({}, [checkIn(2, 30), checkIn(1, 45)], at(9));
      expect(result.trend).toBe("Rising");
      expect(result.scores.pressure).toBe(35);
    });

    it("is Falling when pressure eased", () => {
      const result = computeScores({}, [checkIn(3, 60), checkIn(2, 55), checkIn(1, 40)], at(9));
      expect(result.trend).toBe("Falling");
      expect(result.scores.pressure).toBe(25);
    });

    it("is Steady with small changes, a single check-in, or stale history", () => {
      expect(computeScores({}, [checkIn(2, 30), checkIn(1, 35)], at(9)).trend).toBe("Steady");
      expect(computeScores({}, [checkIn(1, 90)], at(9)).trend).toBe("Steady");
      expect(computeScores({}, [checkIn(20, 10), checkIn(19, 90)], at(9)).trend).toBe("Steady");
    });

    it("only looks at the most recent check-ins, in date order", () => {
      // Oldest entry would suggest Rising; the latest three are flat.
      const history = [checkIn(1, 50), checkIn(4, 10), checkIn(2, 50), checkIn(3, 50)];
      expect(computeScores({}, history, at(9)).trend).toBe("Steady");
    });

    it("ignores malformed history entries", () => {
      const broken = { date: "not a date", answers: {}, scores: undefined, crash: 0 } as unknown as CheckIn;
      expect(computeScores({}, [broken, checkIn(1, 40)], at(9)).trend).toBe("Steady");
    });
  });

  it("is pure: same inputs give the same output and inputs are not mutated", () => {
    const answers: Answers = { sleep: "under5", head: "foggy" };
    const history = [checkIn(2, 30), checkIn(1, 60)];
    const snapshot = JSON.stringify({ answers, history });
    const a = computeScores(answers, history, at(9));
    const b = computeScores(answers, history, at(9));
    expect(a).toEqual(b);
    expect(JSON.stringify({ answers, history })).toBe(snapshot);
  });
});
