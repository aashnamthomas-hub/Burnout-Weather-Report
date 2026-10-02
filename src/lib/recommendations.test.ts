import { describe, expect, it } from "vitest";
import { computeScores } from "./forecast";
import { LIBRARY, MAX_RECOMMENDATIONS, pickRecommendations, type Category } from "./recommendations";
import { isGoodDay, modeFor } from "./report";
import type { Answers } from "./types";

const at = (hour: number) => new Date(2026, 9, 3, hour, 0);

function recsFor(answers: Answers, now: Date) {
  const r = computeScores(answers, [], now);
  return pickRecommendations({ a: answers, r, hour: now.getHours(), mode: modeFor(now), good: isGoodDay(r) });
}

const ORDER: Category[] = ["safety", "sleep", "food", "movement", "workload", "comfort"];

const GOOD: Answers = {
  profile: "desk", sleep: "8plus", lastMeal: "within2h", mealType: "balanced", water: "4plus",
  caffeine: "1", caffeineTiming: "beforeNoon", movement: "today", meetings: "0", head: "clear",
};

const ROUGH: Answers = {
  profile: "desk", sleep: "5to6", wake: "groggy", lastMeal: "4to6h", mealType: "carbs", water: "none",
  caffeine: "2", caffeineTiming: "afterNoon", movement: "2to3days", meetings: "3to5", head: "busy",
};

describe("recommendation library", () => {
  it("has about 40 recommendations with unique ids", () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(40);
    expect(new Set(LIBRARY.map((r) => r.id)).size).toBe(LIBRARY.length);
  });
});

describe("pickRecommendations", () => {
  it("returns at most four, ordered safety/sleep, food, movement, workload, comfort", () => {
    const picks = recsFor(ROUGH, at(10));
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.length).toBeLessThanOrEqual(MAX_RECOMMENDATIONS);
    const positions = picks.map((p) => ORDER.indexOf(p.category));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("gives every recommendation a reason", () => {
    for (const pick of recsFor(ROUGH, at(10))) expect(pick.reason.length).toBeGreaterThan(10);
  });

  it("names the actual reason, such as the carb-heavy meal", () => {
    const eat = recsFor(ROUGH, at(10)).find((p) => p.id === "food-eat-now");
    expect(eat?.reason).toBe("It's been over 4 hours since you ate, and the meal was mostly carbs.");
  });

  it("uses profile-specific wording", () => {
    const study = recsFor(
      { profile: "study", sleep: "7to8", lastMeal: "2to4h", mealType: "snack", water: "4plus", caffeine: "none", movement: "today", deadlines: "2", head: "busy" },
      at(10),
    ).map((p) => p.text);
    expect(study.join(" ")).toContain("Eat before you open a book.");
    const training = recsFor(
      { profile: "training", sleep: "7to8", lastMeal: "4to6h", mealType: "coffee", water: "none", training: "hard", head: "flat", movement: "yesterday", caffeine: "none" },
      at(10),
    ).map((p) => p.text);
    expect(training.join(" ")).toContain("Protein and carbs within an hour of training");
  });

  it("switches to rest and suggests a professional when there is pain", () => {
    const picks = recsFor(
      { profile: "training", sleep: "7to8", lastMeal: "within2h", mealType: "balanced", water: "4plus", caffeine: "none", movement: "today", training: "brutal", pain: "pain", head: "clear" },
      at(9),
    );
    expect(picks[0].id).toBe("pain-rest");
    expect(picks[0].text).toContain("see a professional");
    const ids = picks.map((p) => p.id);
    expect(ids).not.toContain("move-training-swap");
    expect(ids).not.toContain("move-training-cap");
  });

  it("puts food first when nothing has been eaten by mid-afternoon", () => {
    const picks = recsFor({ ...ROUGH, lastMeal: "nothingYet", mealType: undefined, canEat: "yes" }, at(15));
    expect(picks[0].category).toBe("food");
  });

  it("never suggests advice for a part of the day that has passed", () => {
    const ids = recsFor({ ...ROUGH, lastMeal: "nothingYet", mealType: undefined }, at(15)).map((p) => p.id);
    expect(ids).not.toContain("food-nothing-morning");
    expect(ids).not.toContain("work-hardest-first");
  });

  it("keeps good days light and never invents problems", () => {
    const ids = recsFor(GOOD, at(9)).map((p) => p.id);
    expect(ids.length).toBeLessThanOrEqual(2);
    expect(ids).not.toContain("food-eat-now");
    expect(ids).not.toContain("sleep-nap");
  });

  it("always has something to say", () => {
    expect(recsFor({}, at(9)).length).toBeGreaterThan(0);
  });
});
